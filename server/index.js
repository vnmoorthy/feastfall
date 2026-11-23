// FEASTFALL server: Express static + WebSocket multiplayer + Bruin learning loop + Runware art.
import express from 'express';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { Game } from './game.js';
import { Runware, loadEnv } from './runware.js';
import { Band } from './band.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
for (const d of ['ledger', 'matches', 'memory', 'images']) fs.mkdirSync(path.join(DATA, d), { recursive: true });
const env = loadEnv(ROOT);
const PORT = Number(process.env.PORT || env.PORT || 8787);

const runware = new Runware({ root: ROOT, key: env.RUNWARE_API_KEY, model: env.RUNWARE_MODEL });
const app = express();
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.use('/images', express.static(path.join(DATA, 'images')));
app.use('/vendor/three', express.static(path.join(ROOT, 'node_modules', 'three')));
app.use('/deck', express.static(path.join(ROOT, 'deck')));
app.use('/docs', express.static(path.join(ROOT, 'docs')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Map(); // wsId -> {ws, charId, role}
let wsSeq = 0;

let band = null;
function broadcast(msg) {
  band?.relay(msg);
  const s = JSON.stringify(msg);
  for (const { ws } of sockets.values()) if (ws.readyState === 1) ws.send(s);
}
function sendTo(wsId, msg) {
  const s = sockets.get(wsId); if (s && s.ws.readyState === 1) s.ws.send(JSON.stringify(msg));
}

// ---------- Bruin learning loop ----------
let bruinState = { running: false, last: null, log: [] };
function loadMemory() {
  try {
    const mem = JSON.parse(fs.readFileSync(path.join(DATA, 'memory', 'reputation.json'), 'utf8'));
    game.setMemory(mem);
    return mem;
  } catch (e) { return null; }
}
function runBruin(trigger = 'manual') {
  if (bruinState.running) return false;
  const script = path.join(ROOT, 'scripts', 'run-bruin.sh');
  if (!fs.existsSync(script)) { broadcast({ type: 'bruin', status: 'error', line: 'scripts/run-bruin.sh not found' }); return false; }
  bruinState = { running: true, started: Date.now(), log: [], trigger };
  broadcast({ type: 'bruin', status: 'start', trigger });
  const p = spawn('bash', [script], { cwd: ROOT, env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin:${os.homedir()}/.local/bin` } });
  const onData = (buf) => {
    for (const line of buf.toString().split('\n')) {
      const clean = line.replace(/\x1b\[[0-9;]*m/g, '').trimEnd();
      if (!clean) continue;
      bruinState.log.push(clean); if (bruinState.log.length > 300) bruinState.log.shift();
      broadcast({ type: 'bruin', status: 'log', line: clean });
    }
  };
  p.stdout.on('data', onData); p.stderr.on('data', onData);
  p.on('close', (code) => {
    const ms = Date.now() - bruinState.started;
    bruinState.running = false;
    const mem = code === 0 ? loadMemory() : null;
    bruinState.last = { code, ms, at: new Date().toISOString(), actors: mem ? Object.keys(mem.actors || {}).length : 0 };
    broadcast({ type: 'bruin', status: code === 0 ? 'done' : 'error', code, ms, memory: mem ? summarizeMemory(mem) : null });
  });
  return true;
}
function summarizeMemory(mem) {
  const actors = Object.entries(mem.actors || {}).map(([id, a]) => ({ id, ...a })).sort((a, b) => a.reputation - b.reputation);
  return { generated_at: mem.generated_at, actors, matches: (mem.matches || []).slice(0, 10), policy: mem.policy || {} };
}

// ---------- game ----------
const game = new Game({
  broadcast, sendTo, dataDir: DATA,
  images: (kind) => runware.file(kind),
  onMatchEnd: () => setTimeout(() => runBruin('match-end'), 1200),
});
loadMemory();
band = new Band({ agentKey: env.BAND_AGENT_KEY, chatId: env.BAND_CHAT_ID, ownerId: env.BAND_OWNER_ID, onRemoteChat: (m) => game.remoteChat(m) });

// lazily generate event art we don't have yet
const eventArt = (kind) => { if (!runware.file(kind)) runware.generate(kind).then((url) => url && broadcast({ type: 'image', name: kind, url })); };

function lanUrl() {
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return `http://${i.address}:${PORT}`;
  return `http://localhost:${PORT}`;
}

wss.on('connection', (ws) => {
  const wsId = ++wsSeq;
  sockets.set(wsId, { ws, charId: null });
  ws.send(JSON.stringify({ type: 'hello', wsId, roster: game.roster(), images: imageMap(), joinUrl: lanUrl(), memory: summarizeMemory(game.memory || {}), bruin: bruinState.last, runware: runware.enabled(), band: band?.enabled() || false }));
  ws.send(JSON.stringify(game.resources()));
  ws.send(JSON.stringify({ type: 'ledger_bulk', entries: game.ledger.slice(-80) }));
  if (game.phase !== 'lobby') ws.send(JSON.stringify({ type: 'match', matchId: game.matchId, matchNo: game.matchNo, phase: game.phase, goals: game.goals(), dayLength: game.dayLength }));
  if (game.lastSummary && game.phase === 'end') {
    ws.send(JSON.stringify({ type: 'reveal', entries: [...game.sealed.values()] }));
    ws.send(JSON.stringify({ type: 'end', summary: game.lastSummary }));
    if (bruinState.last?.code === 0) ws.send(JSON.stringify({ type: 'bruin', status: 'done', code: 0, ms: bruinState.last.ms, memory: summarizeMemory(game.memory || {}) }));
  }
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const s = sockets.get(wsId); if (!s) return;
    if (msg.type === 'join') {
      if (s.charId) game.removeHuman(s.charId);
      const c = game.addHuman(wsId, msg.name);
      s.charId = c.id;
      sendTo(wsId, { type: 'joined', id: c.id, name: c.name, color: c.color });
    } else if (msg.type === 'spectate') {
      if (s.charId) { game.removeHuman(s.charId); s.charId = null; }
    } else if (msg.type === 'director') {
      director(msg, wsId);
    } else if (s.charId) {
      game.humanInput(s.charId, msg);
    }
  });
  ws.on('close', () => {
    const s = sockets.get(wsId);
    if (s?.charId) game.removeHuman(s.charId);
    sockets.delete(wsId);
  });
});

function director(msg, wsId) {
  switch (msg.cmd) {
    case 'start': game.start(); eventArt('sunrise'); break;
    case 'end': game.endMatch('sunset'); break;
    case 'abort': game.endMatch('abort'); break;
    case 'speed': game.speed = [1, 2, 4].includes(msg.value) ? msg.value : 1; break;
    case 'drama': game.drama = !!msg.value; break;
    case 'length': if (game.phase === 'lobby' || game.phase === 'end') game.dayLength = [120, 210, 300, 420].includes(msg.value) ? msg.value : 210; break;
    case 'council': {
      const owl = game.chars.get('marigold');
      if (owl && !owl.exiled && game.phase === 'day') game.callCouncil(owl, 'The Elder senses something is wrong');
      break;
    }
    case 'bruin': runBruin('manual'); break;
    case 'lobby': if (game.phase === 'end') { game.resetWorld(); broadcast(game.resources()); broadcast({ type: 'lobby' }); } break;
  }
  broadcast({ type: 'director', speed: game.speed, drama: game.drama, dayLength: game.dayLength });
}

function imageMap() {
  const out = {};
  for (const f of fs.readdirSync(path.join(DATA, 'images'))) out[f.replace(/\.\w+$/, '')] = `/images/${f}`;
  return out;
}

// ---------- HTTP API ----------
app.get('/api/health', (_, res) => res.json({ ok: true, phase: game.phase, players: [...game.chars.values()].filter((c) => c.kind === 'human').length, runware: runware.enabled(), runwareCalls: runware.calls, bruin: bruinState.last, band: band?.status() }));
app.get('/api/qr', async (_, res) => res.type('image/svg+xml').send(await QRCode.toString(lanUrl(), { type: 'svg', margin: 1, color: { dark: '#1a1208', light: '#fff4e0' } })));
app.get('/api/join-url', (_, res) => res.json({ url: lanUrl() }));
app.get('/api/memory', (_, res) => res.json(summarizeMemory(game.memory || {})));
app.get('/api/policy', (_, res) => res.json(game.policy));
app.get('/api/ledger', (_, res) => res.json(game.ledger));
app.get('/api/ledger/:match.jsonl', (req, res) => {
  const f = path.join(DATA, 'ledger', `match-${req.params.match.replace(/[^\w-]/g, '')}.jsonl`);
  if (!fs.existsSync(f)) return res.status(404).end();
  res.type('application/x-ndjson').send(fs.readFileSync(f));
});
app.get('/api/bruin', (_, res) => res.json(bruinState));
app.post('/api/bruin/run', (_, res) => res.json({ started: runBruin('api') }));
app.get('/api/band', (_, res) => res.json(band?.status() || { enabled: false }));
app.get('/api/images', (_, res) => res.json(imageMap()));

// ---------- loop ----------
let last = Date.now(), resTimer = 0;
setInterval(() => {
  const now = Date.now(); const dt = Math.min(0.25, (now - last) / 1000); last = now;
  game.tick(dt);
  broadcast(game.snapshot());
  resTimer += dt;
  if (game.resDirty && resTimer > 0.5) { game.resDirty = false; resTimer = 0; broadcast(game.resources()); }
  // per-player trust view (what each agent thinks of YOU)
  for (const [wsId, s] of sockets) if (s.charId && Math.random() < 0.2) sendTo(wsId, { type: 'trust', trust: game.trustFor(s.charId) });
}, 100);

server.listen(PORT, () => {
  console.log(`\n  🦃 FEASTFALL running\n  ▸ local:  http://localhost:${PORT}\n  ▸ phones: ${lanUrl()}\n  ▸ runware: ${runware.enabled() ? 'enabled (' + runware.model + ')' : 'disabled — add RUNWARE_API_KEY to .env'}\n  ▸ band:    ${band?.enabled() ? 'bridged to room ' + env.BAND_CHAT_ID : 'disabled — add BAND_AGENT_KEY/BAND_CHAT_ID/BAND_OWNER_ID to .env'}\n`);
  if (runware.enabled()) runware.warm().then(() => broadcast({ type: 'images', images: imageMap() }));
});
