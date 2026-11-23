// Static / GitHub Pages mode: the exact same server/game.js simulation runs in the browser.
// node:crypto, node:fs and node:path are remapped by the import map to tiny shims (see shims/).
// Multiplayer, the live Bruin CLI run, Runware generation and the BAND bridge need the Node server (`npm start`).
import { Game } from './game.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function summarizeMemory(mem) {
  const actors = Object.entries(mem?.actors || {}).map(([id, a]) => ({ id, ...a })).sort((a, b) => a.reputation - b.reputation);
  return { generated_at: mem?.generated_at, actors, matches: (mem?.matches || []).slice(0, 10), policy: mem?.policy || {} };
}

export async function createLocalSocket() {
  let mem = null;
  try { mem = JSON.parse(localStorage.getItem('ff_memory') || 'null'); } catch {}
  if (!mem) mem = await fetch('data/reputation.json').then((r) => r.json()).catch(() => ({ actors: {}, policy: {}, matches: [] }));
  const images = await fetch('images/index.json').then((r) => r.json()).catch(() => ({}));

  const sock = { readyState: 1, onmessage: null, onclose: null, _l: [], addEventListener(t, f) { if (t === 'message') this._l.push(f); }, send(raw) { handle(JSON.parse(raw)); } };
  const deliver = (m) => { const ev = { data: JSON.stringify(m) }; sock.onmessage?.(ev); sock._l.forEach((f) => f(ev)); };
  const q = (m) => queueMicrotask(() => deliver(m));
  let charId = null;
  let bruin = { running: false };

  const game = new Game({ broadcast: q, sendTo: (_, m) => q(m), dataDir: 'local', images: (k) => images[k] || null, onMatchEnd: () => setTimeout(replayBruin, 1200) });
  game.setMemory(mem);
  try { const p = JSON.parse(localStorage.getItem('ff_policy') || 'null'); if (p) game.policy = p; } catch {}
  game.savePolicy = () => localStorage.setItem('ff_policy', JSON.stringify(game.policy));

  // Mirrors bruin/feastfall_memory/assets/mart_reputation.sql for this browser's matches.
  function replayBruin() {
    if (bruin.running) return; bruin.running = true;
    const t0 = performance.now();
    const log = (line) => q({ type: 'bruin', status: 'log', line });
    q({ type: 'bruin', status: 'start', trigger: 'match-end (browser demo)' });
    const lines = [
      'Static demo: the real Bruin CLI runs on the host (`npm run bruin`).',
      'Replaying mart.reputation in-browser on this match ledger…',
      `raw.ledger      ${game.ledger.length} rows (in memory)`,
    ];
    const per = {};
    for (const e of game.ledger) {
      if (!e.actor || e.sealed) continue;
      const a = (per[e.actor] ??= { name: e.actor_name, type: e.actor_type, deposits: 0, steals: 0, gifts: 0, times_exiled: 0 });
      if (e.action === 'deposit') a.deposits += e.amount || 0;
      if (e.action === 'steal') a.steals += e.amount || 0;
      if (e.action === 'gift') a.gifts += 1;
    }
    for (const s of game.sealed.values()) if (s.action === 'steal') { const a = (per[s.actor] ??= { name: s.actor_name, type: s.actor_type, deposits: 0, steals: 0, gifts: 0, times_exiled: 0 }); a.steals += s.amount || 0; }
    for (const e of game.ledger) if (e.action === 'exile' && per[e.actor]) per[e.actor].times_exiled += 1;
    for (const [id, d] of Object.entries(per)) {
      const prev = mem.actors[id] || { deposits: 0, steals: 0, gifts: 0, times_exiled: 0, matches_played: 0 };
      const next = { name: d.name, type: d.type, deposits: prev.deposits + d.deposits, steals: prev.steals + d.steals, gifts: prev.gifts + d.gifts, times_exiled: prev.times_exiled + d.times_exiled, matches_played: (prev.matches_played || 0) + 1 };
      next.reputation = Math.round(clamp(0.5 + 0.02 * next.deposits + 0.05 * next.gifts - 0.08 * next.steals - 0.15 * next.times_exiled, 0.02, 0.98) * 100) / 100;
      mem.actors[id] = next;
    }
    mem.generated_at = new Date().toISOString();
    if (game.lastSummary) mem.matches = [game.lastSummary, ...(mem.matches || [])].slice(0, 10).map(({ learn, trustStart, trustEnd, names, ...m }) => m);
    localStorage.setItem('ff_memory', JSON.stringify(mem));
    game.setMemory(mem);
    lines.push(`mart.reputation ${Object.keys(per).length} actors updated`, 'memory.export_reputation_json → localStorage', '✓ agents will remember this match');
    lines.forEach((l, i) => setTimeout(() => log(l), 120 * i));
    setTimeout(() => { bruin.running = false; q({ type: 'bruin', status: 'done', code: 0, ms: Math.round(performance.now() - t0 + 120 * lines.length), memory: summarizeMemory(mem) }); }, 120 * lines.length + 100);
  }

  function director(msg) {
    switch (msg.cmd) {
      case 'start': game.start(); break;
      case 'end': game.endMatch('sunset'); break;
      case 'speed': game.speed = [1, 2, 4].includes(msg.value) ? msg.value : 1; break;
      case 'drama': game.drama = !!msg.value; break;
      case 'length': if (game.phase === 'lobby' || game.phase === 'end') game.dayLength = [120, 210, 300, 420].includes(msg.value) ? msg.value : 210; break;
      case 'council': { const owl = game.chars.get('marigold'); if (owl && !owl.exiled && game.phase === 'day') game.callCouncil(owl, 'The Elder senses something is wrong'); break; }
      case 'bruin': replayBruin(); break;
    }
    q({ type: 'director', speed: game.speed, drama: game.drama, dayLength: game.dayLength });
  }
  function handle(msg) {
    if (msg.type === 'join') {
      if (charId) game.removeHuman(charId);
      const c = game.addHuman(1, msg.name); charId = c.id;
      q({ type: 'joined', id: c.id, name: c.name, color: c.color });
    } else if (msg.type === 'spectate') { if (charId) { game.removeHuman(charId); charId = null; } }
    else if (msg.type === 'director') director(msg);
    else if (charId) game.humanInput(charId, msg);
  }

  sock.start = () => {
    q({ type: 'hello', wsId: 1, roster: game.roster(), images, joinUrl: location.href.split('?')[0], memory: summarizeMemory(mem), bruin: null, runware: false, band: false });
    q(game.resources());
    let last = performance.now(), acc = 0;
    setInterval(() => {
      const now = performance.now(); const dt = Math.min(0.25, (now - last) / 1000); last = now;
      game.tick(dt); deliver(game.snapshot());
      acc += dt; if (game.resDirty && acc > 0.5) { game.resDirty = false; acc = 0; deliver(game.resources()); }
      if (charId && Math.random() < 0.2) deliver({ type: 'trust', trust: game.trustFor(charId) });
    }, 100);
  };
  return sock;
}
