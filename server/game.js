// FEASTFALL — authoritative game simulation.
// Agents run a perceive → remember → score → act loop. Nothing below scripts an outcome:
// thefts, accusations, wildfires, councils and exiles all emerge from agent utilities,
// what each agent has personally witnessed, and the memory Bruin hands back between matches.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const r2 = (v) => Math.round(v * 100) / 100;

export const GRANARY = { x: 0, z: 0 };
export const CAMPFIRE = { x: 0, z: 10 };
const STASH_SPOTS = [{ x: -29, z: 25 }, { x: 30, z: -25 }, { x: 27, z: 27 }, { x: -27, z: -26 }];
const VIEW = 11;          // how far an agent can see
const REACH = 2.6;        // interaction distance
const CAP = 4;            // carry capacity

export const AGENT_DEFS = [
  { id: 'bram', name: 'Bram', species: 'bear', color: '#9a6237', title: 'The Builder',
    goal: 'Fill the Granary. Trusts easily, works hardest.',
    p: { diligence: 0.95, sociability: 0.5, vigilance: 0.4, greed: 0.25, bravery: 0.85, gullibility: 0.75 },
    voice: { pitch: 0.55, rate: 0.92 } },
  { id: 'juniper', name: 'Juniper', species: 'deer', color: '#d49a5c', title: 'The Detective',
    goal: 'Find the traitor. Watches everyone, forgets nothing.',
    p: { diligence: 0.6, sociability: 0.4, vigilance: 0.95, greed: 0.15, bravery: 0.5, gullibility: 0.25 },
    voice: { pitch: 1.35, rate: 1.0 } },
  { id: 'vex', name: 'Vex', species: 'fox', color: '#ee6a2c', title: 'The Merchant',
    goal: 'Win friends with gifts. Always has an angle.',
    p: { diligence: 0.5, sociability: 0.95, vigilance: 0.5, greed: 0.7, bravery: 0.6, gullibility: 0.4 },
    voice: { pitch: 1.1, rate: 1.15 } },
  { id: 'marigold', name: 'Marigold', species: 'owl', color: '#a084c4', title: 'The Elder',
    goal: 'Keep the village together. Calls the Council.',
    p: { diligence: 0.5, sociability: 0.7, vigilance: 0.75, greed: 0.1, bravery: 0.4, gullibility: 0.4, leader: 1 },
    voice: { pitch: 0.85, rate: 0.85 } },
  { id: 'pip', name: 'Pip', species: 'squirrel', color: '#c0702a', title: 'The Wildcard',
    goal: 'Chaos and acorns. Runs toward danger.',
    p: { diligence: 0.75, sociability: 0.8, vigilance: 0.3, greed: 0.5, bravery: 0.95, gullibility: 0.85 },
    voice: { pitch: 1.65, rate: 1.3 } },
];

const ACTIONS = ['gather_food', 'fish', 'gather_wood', 'deposit', 'eat', 'gift', 'extinguish', 'accuse', 'council', 'steal', 'ignite', 'wander'];
const HUMAN_COLORS = ['#4fc3f7', '#81c784', '#f06292', '#ffd54f', '#ba68c8', '#4db6ac', '#ff8a65', '#90a4ae'];

// ---------- dialogue grammar (personality-flavoured, memory-aware) ----------
const LINES = {
  greet: {
    bear: ['Welcome, {n}! Grab a basket.', 'Good to have you, {n}. Lots to carry.'],
    deer: ['{n}. I will be watching how you work.', 'Hello, {n}. Stay where I can see you.'],
    fox: ['{n}! My favourite person already. Need anything? I have connections.', 'Ahh, {n}. Stick with me and you eat well.'],
    owl: ['The island welcomes you, {n}. Fill the Granary before sunset.', 'Welcome, {n}. We feast together, or not at all.'],
    squirrel: ['{n}!! Hi hi hi! Race you to the berries!', 'Ooh a new one! {n}, do you like fire? Kidding. Mostly.'],
  },
  grudge: {
    bear: ['{n}... last feast you took {s} food from the Granary. I trusted you.'],
    deer: ['{n}. Last feast: {s} stolen. I keep records. I am watching you.'],
    fox: ['{n}, darling. {s} food went missing with you last time. Small world.'],
    owl: ['The ledger remembers, {n}. {s} food taken last feast. Earn back our trust.'],
    squirrel: ['YOU! You took {s} snacks last time! I remember! I remember everything! (I remember that.)'],
  },
  thanks: {
    bear: ['{n}! You shared with us last feast. You are family.'],
    deer: ['{n}, your record is clean. {g} gifts last time. Noted.'],
    fox: ['{n}! The generous one returns. {g} gifts. I like you.'],
    owl: ['{n} gave {g} gifts last feast. The village honours you.'],
    squirrel: ['{n} gave me snacks once! Best friend! Best friend!'],
  },
  witness: {
    bear: ['Hey! {n}, that food is for everyone!', 'Did {n} just... take from the Granary?'],
    deer: ['I saw that, {n}. Noted.', '{n} took {a} from the Granary. Interesting.'],
    fox: ['Oh {n}, sticky paws? Your secret is safe with me... for a price.', 'Naughty {n}. Very naughty.'],
    owl: ['{n}, put that back. The Council will hear of this.'],
    squirrel: ['THIEF! {n} IS A THIEF! ...right? That was stealing, right?'],
  },
  accuse: {
    bear: ['I do not trust {n} anymore. Food keeps disappearing near them.'],
    deer: ['Everyone, listen. {n} is the traitor. I have seen it with my own eyes.', 'My evidence points to {n}. Trust {t}. Watch them.'],
    fox: ['Have you all noticed {n} sneaking around? Just saying.', 'I would hate to point paws... but {n}.'],
    owl: ['The evidence weighs against {n}.'],
    squirrel: ['It is {n}! Probably! Definitely! Maybe!'],
  },
  council: {
    owl: ['COUNCIL! Everyone to the fire. Someone among us is a thief, and we will decide who.'],
    deer: ['I call the Council! Gather at the fire, now.'],
  },
  ignite: { any: ['*whistles innocently*', 'Is it getting warm in here?'] },
  fire: {
    bear: ['FIRE! Grab water, protect the bushes!'], deer: ['Fire in the woods! This was no accident.'],
    fox: ['Fire! Oh no. How terrible. Anyway...'], owl: ['Fire! Everyone, save what you can!'], squirrel: ['FIIIRE! I got it I got it!'],
  },
  gift: {
    bear: ['Here {n}, eat something.'], deer: ['Take this, {n}. Do not waste it.'], fox: ['A gift for you, {n}. Remember who your friends are.'],
    owl: ['For you, {n}. We look after our own.'], squirrel: ['Snack for {n}! Nom!'],
  },
  vote: { any: ['I vote {n}. Trust {t}.', '{n}. My trust in them is {t}.'] },
  skip: { any: ['Not enough evidence. I skip.', 'I will not exile on rumours. Skip.'] },
  idle_reply: {
    bear: ['Less talking, more carrying!', 'The Granary will not fill itself.'],
    deer: ['Words are cheap. Actions are logged.', 'Hmm.'],
    fox: ['For you? Anything. Almost anything.', 'Let us make a deal, you and me.'],
    owl: ['Patience. The truth surfaces at sunset.', 'Every choice is written in the ledger.'],
    squirrel: ['Is that a berry? Bye!', 'Did you know acorns are basically tiny trees? Wild.'],
  },
};
function line(kind, species, vars = {}) {
  const group = LINES[kind] || {};
  const opts = group[species] || group.any || Object.values(group)[0] || ['...'];
  return pick(opts).replace(/\{(\w)\}/g, (_, k) => (vars[k] ?? ''));
}

// ---------- world generation ----------
function genWorld() {
  const bushes = [], trees = [], fish = [];
  const cluster = (cx, cz, n, spread) => {
    for (let i = 0; i < n; i++) {
      bushes.push({ id: 'b' + bushes.length, x: r2(cx + rnd(-spread, spread)), z: r2(cz + rnd(-spread, spread)), stock: 3, max: 3, regrow: 0, burnt: false });
    }
  };
  cluster(25, 2, 6, 6); cluster(-25, -2, 6, 6); cluster(2, 27, 5, 6);
  for (let i = 0; i < 18; i++) {
    const a = rnd(Math.PI * 1.1, Math.PI * 1.9), rad = rnd(18, 34);
    trees.push({ id: 't' + i, x: r2(Math.cos(a) * rad), z: r2(Math.sin(a) * rad), stock: 3, max: 3, regrow: 0 });
  }
  [[-38, 14], [38, 14], [0, -40], [-20, 34]].forEach(([x, z], i) => fish.push({ id: 'f' + i, x, z }));
  return { bushes, trees, fish };
}

export class Game {
  constructor({ broadcast, sendTo, dataDir, onMatchEnd, images }) {
    this.broadcast = broadcast; this.sendTo = sendTo; this.dataDir = dataDir; this.onMatchEnd = onMatchEnd; this.images = images;
    this.chars = new Map();
    this.speed = 1; this.drama = false; this.dayLength = 210;
    this.memory = { actors: {}, policy: {} };
    this.policy = this.loadPolicy();
    this.matchNo = 0; this.lastSummary = null;
    this.resetWorld(true);
    for (const d of AGENT_DEFS) this.addAgent(d);
  }

  // ---------- persistence ----------
  loadPolicy() {
    try { return JSON.parse(fs.readFileSync(path.join(this.dataDir, 'memory', 'policy.json'), 'utf8')); } catch { return {}; }
  }
  savePolicy() {
    fs.writeFileSync(path.join(this.dataDir, 'memory', 'policy.json'), JSON.stringify(this.policy, null, 2));
  }
  weight(agentId, action) { return this.policy[agentId]?.[action] ?? 1; }
  setMemory(mem) {
    this.memory = mem || { actors: {}, policy: {} };
    // Bruin's learned win-rates nudge the policy prior for actions we've never reinforced.
    for (const [aid, acts] of Object.entries(this.memory.policy || {})) {
      for (const [act, st] of Object.entries(acts)) {
        this.policy[aid] ??= {};
        if (this.policy[aid][act] == null && st.win_rate != null) this.policy[aid][act] = r2(clamp(0.8 + st.win_rate * 0.4, 0.6, 1.4));
      }
    }
  }
  repOf(name) { return this.memory.actors?.[String(name).toLowerCase()] || null; }

  resetWorld(first = false) {
    this.world = genWorld();
    this.granary = { food: 0, wood: 0 };
    this.stash = { ...pick(STASH_SPOTS), food: 0 };
    this.fires = [];
    this.phase = 'lobby';
    this.timeLeft = this.dayLength;
    this.elapsed = 0;
    this.council = null; this.councilCount = 0; this.lastCouncilAt = -999; this.lastAccuseAt = -999;
    this.ledger = []; this.sealed = new Map();
    this.matchId = 'm_' + crypto.randomBytes(3).toString('hex');
    this.traitorId = null;
    this.actionCounts = {};
    this.trustStart = null;
    if (!first) {
      for (const c of this.chars.values()) this.resetChar(c);
    }
  }
  goals() {
    const humans = [...this.chars.values()].filter((c) => c.kind === 'human').length;
    return { food: 66 + humans * 8, wood: 18 + humans * 2, stash: 10 };
  }

  resetChar(c) {
    const a = rnd(0, Math.PI * 2);
    c.x = r2(Math.cos(a) * 6); c.z = r2(Math.sin(a) * 6 + 3);
    c.inv = { food: 0, wood: 0 }; c.energy = 100; c.exiled = false; c.task = null; c.say = ''; c.sayUntil = 0;
    c.role = 'villager'; c.stolen = 0; c.heldStolen = 0; c.ignites = 0; c.lastAccuse = -999; c.lastGift = -999; c.helping = null;
    c.intent = 'waiting for sunrise'; c.vote = null;
  }

  addAgent(d) {
    const c = { ...d, kind: 'agent', trust: {} };
    this.resetChar(c);
    this.chars.set(c.id, c);
  }

  addHuman(wsId, name) {
    name = String(name || 'Player').replace(/[^\w \-]/g, '').slice(0, 16).trim() || 'Player';
    let id = 'h_' + name.toLowerCase().replace(/\s+/g, '_');
    if (this.chars.has(id)) id += '_' + crypto.randomBytes(1).toString('hex');
    const humans = [...this.chars.values()].filter((c) => c.kind === 'human');
    const c = { id, name, kind: 'human', species: 'human', color: HUMAN_COLORS[humans.length % HUMAN_COLORS.length], wsId, trust: {} };
    this.resetChar(c);
    this.chars.set(id, c);
    const rep = this.repOf(name);
    // Seed every agent's trust toward this human from Bruin's reputation table.
    for (const a of this.agents()) {
      const prior = rep ? rep.reputation : 0.55;
      a.trust[id] = r2(clamp(prior + rnd(-0.04, 0.04), 0.02, 0.98));
    }
    this.log({ actor: c, action: 'join', reason: rep ? `memory loaded from Bruin: reputation ${rep.reputation}, ${rep.steals} stolen, ${rep.gifts} gifts across ${rep.matches_played} matches` : 'first time on the island (no Bruin record)', utility: null });
    // The grudge: agents call you out based on what Bruin remembers.
    setTimeout(() => {
      if (!this.chars.has(id)) return;
      const speaker = rep && rep.steals > 0 ? this.chars.get('juniper') || this.agents()[0] : pick(this.agents());
      if (!speaker || speaker.exiled) return;
      if (rep && rep.steals > 0) this.speak(speaker, line('grudge', speaker.species, { n: name, s: rep.steals }), { memory: true, to: id });
      else if (rep && rep.gifts > 0) this.speak(speaker, line('thanks', speaker.species, { n: name, g: rep.gifts }), { memory: true, to: id });
      else this.speak(speaker, line('greet', speaker.species, { n: name }));
    }, 1200);
    return c;
  }
  removeHuman(id) {
    const c = this.chars.get(id); if (!c) return;
    this.chars.delete(id);
    for (const a of this.agents()) delete a.trust[id];
  }
  agents() { return [...this.chars.values()].filter((c) => c.kind === 'agent'); }
  living() { return [...this.chars.values()].filter((c) => !c.exiled); }
  trustOf(a, b) {
    if (a.trust[b.id] == null) a.trust[b.id] = b.kind === 'human' ? 0.55 : 0.62;
    return a.trust[b.id];
  }
  bumpTrust(a, b, delta, why) {
    if (a.id === b.id || a.kind !== 'agent') return;
    const before = this.trustOf(a, b);
    const after = r2(clamp(before + delta, 0.01, 0.99));
    a.trust[b.id] = after;
    return { before, after, why };
  }

  // ---------- match lifecycle ----------
  start() {
    if (this.phase === 'day' || this.phase === 'council') return;
    if (this.phase === 'end') this.resetWorld();
    this.matchNo++;
    const candidates = this.agents().filter((a) => !a.p.leader);
    // traitor is drawn at random, weighted by greed — the server never tells clients who it is
    const total = candidates.reduce((s, a) => s + a.p.greed + 0.3, 0);
    let roll = rnd(0, total);
    for (const a of candidates) { roll -= a.p.greed + 0.3; if (roll <= 0) { this.traitorId = a.id; break; } }
    this.traitorId ??= candidates[0].id;
    const t = this.chars.get(this.traitorId); t.role = 'traitor';
    this.phase = 'day'; this.timeLeft = this.dayLength; this.started = new Date().toISOString();
    this.sealedLog({ actor: t, action: 'role', reason: 'drawn as the secret traitor (weighted by greed)', utility: null });
    this.trustStart = this.trustSnapshot();
    this.policyBefore = JSON.parse(JSON.stringify(this.policy));
    this.broadcast(this.resources());
    this.broadcast({ type: 'match', matchId: this.matchId, matchNo: this.matchNo, phase: this.phase, goals: this.goals(), dayLength: this.dayLength });
    this.event('sunrise', '🌅 Sunrise on Feastfall Island', `Fill the Granary: ${this.goals().food} food & ${this.goals().wood} wood before sunset. One of the animals is lying.`);
    const owl = this.chars.get('marigold');
    if (owl) this.speak(owl, 'The sun rises. Gather food and wood for the Great Feast. And watch each other closely.');
    if (this.link?.glasserKey && owl) {
      const mid = this.matchId;
      this.link.headline('Thanksgiving').then((h) => {
        if (!h || this.matchId !== mid || owl.exiled) return;
        setTimeout(() => {
          this.speak(owl, `Town crier! News from the mainland: "${h.title}"${h.source ? ', says ' + h.source : ''}.`);
          this.log({ actor: owl, action: 'crier', reason: `Glasser · serper /news → ${h.title}${h.source ? ' (' + h.source + ')' : ''}`, utility: null });
          this.broadcast({ type: 'toast', text: `📰 Town crier (via Glasser): ${h.title}` });
        }, 5500);
      });
    }
  }

  trustSnapshot() {
    const snap = {};
    for (const a of this.agents()) snap[a.id] = { ...a.trust };
    return snap;
  }

  endMatch(reason) {
    if (this.phase === 'end') return;
    const g = this.goals();
    const traitor = this.chars.get(this.traitorId);
    let outcome;
    if (reason === 'abort') outcome = 'aborted';
    else if (traitor && !traitor.exiled && this.stash.food >= g.stash) outcome = 'traitor';
    else if (this.granary.food >= g.food && this.granary.wood >= g.wood) outcome = 'feast';
    else outcome = 'starved';
    this.phase = 'end'; this.council = null;
    // reveal all sealed commitments
    const reveals = [...this.sealed.values()];
    this.broadcast({ type: 'reveal', entries: reveals });
    // reinforcement: villagers rewarded for a feast, the traitor for a successful heist
    const learn = {};
    for (const a of this.agents()) {
      const won = a.role === 'traitor' ? outcome === 'traitor' : outcome === 'feast';
      const reward = outcome === 'aborted' ? 0 : won ? 1 : -1;
      const counts = this.actionCounts[a.id] || {};
      const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
      this.policy[a.id] ??= {};
      learn[a.id] = { reward, changes: {} };
      for (const [act, n] of Object.entries(counts)) {
        if (a.role === 'traitor' && (act === 'steal' || act === 'ignite')) continue; // role-specific; don't bleed into villager policy
        const before = this.weight(a.id, act);
        const after = r2(clamp(before + 0.35 * reward * (n / total) + (reward > 0 ? 0.02 : -0.01), 0.5, 1.8));
        this.policy[a.id][act] = after;
        if (before !== after) learn[a.id].changes[act] = [before, after];
      }
    }
    this.savePolicy();
    const summary = {
      match_id: this.matchId, started: this.started, ended: new Date().toISOString(), duration: Math.round(this.elapsed), outcome,
      traitor: this.traitorId, traitor_name: traitor?.name, food: this.granary.food, wood: this.granary.wood, stash: this.stash.food,
      food_goal: g.food, wood_goal: g.wood,
      humans: [...this.chars.values()].filter((c) => c.kind === 'human').map((c) => c.name.toLowerCase()),
      agents: this.agents().map((a) => a.id),
      exiled: [...this.chars.values()].filter((c) => c.exiled).map((c) => c.id),
    };
    try {
      fs.writeFileSync(path.join(this.dataDir, 'matches', this.matchId + '.json'), JSON.stringify(summary));
    } catch (e) { console.error(e); }
    const trustEnd = this.trustSnapshot();
    this.lastSummary = { ...summary, learn, trustStart: this.trustStart, trustEnd, names: Object.fromEntries([...this.chars.values()].map((c) => [c.id, c.name])) };
    const titles = { feast: '🦃 THE GREAT FEAST!', traitor: `🦊 ${traitor?.name} WINS — the stash is full`, starved: '🥶 The village goes hungry', aborted: 'Match aborted' };
    this.event(outcome === 'aborted' ? 'sunset' : outcome, titles[outcome], `${traitor?.name} the ${traitor?.species} was the traitor. Granary ${this.granary.food}/${g.food} food · ${this.granary.wood}/${g.wood} wood · stash ${this.stash.food}.`);
    this.broadcast(this.resources());
    this.broadcast({ type: 'end', summary: this.lastSummary });
    this.onMatchEnd?.(summary);
  }

  // ---------- ledger ----------
  ledgerFile() { return path.join(this.dataDir, 'ledger', `match-${this.matchId}.jsonl`); }
  baseEntry(e) {
    const a = e.actor;
    return {
      id: crypto.randomBytes(4).toString('hex'), match_id: this.matchId, t: r2(this.elapsed), ts: new Date().toISOString(),
      actor: a.kind === 'human' ? a.name.toLowerCase() : a.id, actor_id: a.id, actor_name: a.name, actor_type: a.kind, species: a.species, color: a.color,
      action: e.action, target: e.target ?? null, target_name: e.targetName ?? null, amount: e.amount ?? null, reason: e.reason, utility: e.utility == null ? null : r2(e.utility),
      scores: e.scores || null, x: r2(a.x), z: r2(a.z),
    };
  }
  persist(entry) {
    if (this.phase === 'lobby') return;
    const { scores, color, species, id, actor_id, target_name, ...row } = entry;
    try { fs.appendFileSync(this.ledgerFile(), JSON.stringify(row) + '\n'); } catch (e) { console.error(e); }
  }
  log(e) {
    const entry = this.baseEntry(e);
    this.ledger.push(entry); if (this.ledger.length > 400) this.ledger.shift();
    this.persist(entry);
    this.broadcast({ type: 'ledger', entry });
    return entry;
  }
  // commit–reveal: secret decisions are published as a SHA-256 commitment, revealed at sunset/exile
  sealedLog(e) {
    const entry = this.baseEntry(e);
    const salt = crypto.randomBytes(8).toString('hex');
    const commitment = crypto.createHash('sha256').update(JSON.stringify(entry) + salt).digest('hex');
    this.sealed.set(entry.id, { ...entry, salt, commitment });
    this.persist({ ...entry, sealed: true });
    this.broadcast({ type: 'ledger', entry: { id: entry.id, t: entry.t, sealed: true, commitment, action: 'sealed', reason: 'a private decision was committed' } });
    return entry;
  }

  speak(c, text, extra = {}) {
    c.say = text; c.sayUntil = Date.now() + 4500;
    this.broadcast({ type: 'say', id: c.id, name: c.name, species: c.species, text, voice: c.voice || null, ...extra });
  }
  event(kind, title, text) {
    this.broadcast({ type: 'event', kind, title, text, image: this.images?.(kind) || null });
  }
  count(a, act) {
    (this.actionCounts[a.id] ??= {})[act] = ((this.actionCounts[a.id] ??= {})[act] || 0) + 1;
  }

  // ---------- perception ----------
  witnesses(of, radius = VIEW) {
    return this.living().filter((c) => c.id !== of.id && dist(c, of) <= radius);
  }
  witnessTheft(thief, amount) {
    const seen = this.witnesses(thief).filter((c) => c.kind === 'agent');
    for (const w of seen) {
      if (w.role === 'traitor') continue; // the traitor stays quiet about rivals
      const ch = this.bumpTrust(w, thief, -(0.12 + 0.22 * w.p.vigilance) * Math.min(2, amount), 'witnessed theft');
      if (ch) this.log({ actor: w, action: 'witness', target: thief.id, targetName: thief.name, amount, reason: `saw ${thief.name} take ${amount} food from the Granary · trust ${ch.before} → ${ch.after}`, utility: null });
      if (Math.random() < 0.5 + w.p.vigilance * 0.4) this.speak(w, line('witness', w.species, { n: thief.name, a: amount }));
    }
    return seen.length;
  }

  // ---------- human input ----------
  humanInput(id, msg) {
    const c = this.chars.get(id); if (!c || c.exiled) return;
    if (msg.type === 'move') {
      c.tx = clamp(Number(msg.x) || 0, -40, 40); c.tz = clamp(Number(msg.z) || 0, -40, 40);
    } else if (msg.type === 'dir') {
      c.dir = { x: clamp(Number(msg.x) || 0, -1, 1), z: clamp(Number(msg.z) || 0, -1, 1) };
      if (c.dir.x || c.dir.z) { c.tx = null; c.tz = null; }
    } else if (msg.type === 'act') {
      this.humanAct(c, msg.act);
    } else if (msg.type === 'chat') {
      this.humanChat(c, String(msg.text || '').slice(0, 140));
    } else if (msg.type === 'vote') {
      this.castVote(c, msg.target);
    }
  }
  humanAct(c, act) {
    if (this.phase !== 'day') return this.sendTo(c.wsId, { type: 'toast', text: this.phase === 'council' ? 'The Council is in session — vote!' : 'Wait for sunrise (start the match).' });
    const toast = (text) => this.sendTo(c.wsId, { type: 'toast', text });
    if (act === 'interact') {
      const fire = this.fires.find((f) => dist(f, c) < f.r + 2);
      if (fire) { fire.hp -= 18; this.log({ actor: c, action: 'extinguish', target: 'fire', reason: 'beat back the flames', utility: null }); return toast('🔥 You beat back the flames!'); }
      if (dist(c, GRANARY) < 4.5 && (c.inv.food || c.inv.wood)) {
        const f = c.inv.food, w = c.inv.wood; this.granary.food += f; this.granary.wood += w; c.inv = { food: 0, wood: 0 };
        this.log({ actor: c, action: 'deposit', target: 'granary', amount: f + w, reason: `deposited ${f} food, ${w} wood`, utility: null });
        for (const wit of this.witnesses(c)) if (wit.kind === 'agent') this.bumpTrust(wit, c, 0.03 * (f + w), 'saw deposit');
        return toast(`Deposited ${f} food & ${w} wood`);
      }
      if (c.inv.food + c.inv.wood >= CAP) return toast('Hands full — bring it to the Granary');
      const bush = this.world.bushes.filter((b) => b.stock > 0 && !b.burnt).sort((a, b) => dist(a, c) - dist(b, c))[0];
      const tree = this.world.trees.filter((t) => t.stock > 0).sort((a, b) => dist(a, c) - dist(b, c))[0];
      const fish = this.world.fish.sort((a, b) => dist(a, c) - dist(b, c))[0];
      if (bush && dist(bush, c) < REACH + 0.6) { bush.stock--; c.inv.food++; this.resDirty = true; this.log({ actor: c, action: 'gather', target: 'berries', amount: 1, reason: 'picked berries', utility: null }); return toast('+1 berries 🫐'); }
      if (tree && dist(tree, c) < REACH + 0.8) { tree.stock--; c.inv.wood++; this.resDirty = true; this.log({ actor: c, action: 'gather', target: 'wood', amount: 1, reason: 'chopped wood', utility: null }); return toast('+1 wood 🪵'); }
      if (fish && dist(fish, c) < REACH + 1.5) { c.inv.food++; this.log({ actor: c, action: 'gather', target: 'fish', amount: 1, reason: 'caught a fish', utility: null }); return toast('+1 fish 🐟'); }
      return toast('Nothing here — walk to a berry bush, tree, fishing spot or the Granary');
    }
    if (act === 'take') {
      if (dist(c, GRANARY) > 4.5) return toast('Go to the Granary to take food');
      if (this.granary.food <= 0) return toast('The Granary is empty');
      if (c.inv.food + c.inv.wood >= CAP) return toast('Hands full');
      this.granary.food--; c.inv.food++; c.stolen++;
      const hungry = c.energy < 35;
      this.log({ actor: c, action: hungry ? 'eat' : 'steal', target: 'granary', amount: 1, reason: hungry ? 'took food while starving' : 'took food from the Granary', utility: null });
      if (!hungry) { const n = this.witnessTheft(c, 1); toast(n ? `👀 ${n} saw you take that…` : '🤫 Nobody saw… you think.'); }
      return;
    }
    if (act === 'eat') {
      if (c.inv.food <= 0) return toast('No food in your basket');
      c.inv.food--; c.energy = clamp(c.energy + 35, 0, 100); this.log({ actor: c, action: 'eat', amount: 1, reason: 'ate from own basket', utility: null }); return toast('Yum. Energy restored');
    }
    if (act === 'gift') {
      if (c.inv.food <= 0) return toast('You need food in your basket to gift');
      const near = this.living().filter((o) => o.id !== c.id && dist(o, c) < 5).sort((a, b) => dist(a, c) - dist(b, c))[0];
      if (!near) return toast('Walk up to someone to gift them');
      c.inv.food--; near.inv.food = Math.min(CAP, near.inv.food + 1);
      const ch = near.kind === 'agent' ? this.bumpTrust(near, c, 0.14, 'gift') : null;
      this.log({ actor: c, action: 'gift', target: near.id, targetName: near.name, amount: 1, reason: ch ? `${near.name}'s trust ${ch.before} → ${ch.after}` : 'shared food', utility: null });
      if (near.kind === 'agent') this.speak(near, pick([`Thank you, ${c.name}! I will remember this.`, `${c.name}, you are a true friend.`, `For me? ${c.name}, you are alright.`]));
      return toast(`Gifted 1 food to ${near.name}`);
    }
  }
  humanChat(c, text) {
    if (!text.trim()) return;
    this.speak(c, text);
    this.log({ actor: c, action: 'speak', reason: `"${text}"`, utility: null });
    const t = text.toLowerCase();
    const listeners = this.agents().filter((a) => !a.exiled && dist(a, c) < 24).sort((a, b) => dist(a, c) - dist(b, c));
    const responder = listeners.find((a) => t.includes(a.name.toLowerCase())) || listeners[0];
    if (!responder) return;
    setTimeout(() => this.agentReply(responder, c, t), 900 + Math.random() * 700);
  }
  // a visitor from another tool (BAND room) talks to the island
  remoteChat({ name, senderId, text }) {
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20);
    const c = { id: 'band_' + slug, name: `${name} (via BAND)`, kind: 'human', species: 'human', color: '#7c5cff', x: 0, z: 0, inv: { food: 0, wood: 0 }, energy: 100 };
    this.broadcast({ type: 'band_msg', name, text });
    this.log({ actor: c, action: 'speak', reason: `via BAND: "${text.slice(0, 120)}"`, utility: null });
    const t = text.toLowerCase();
    const living = this.agents().filter((a) => !a.exiled);
    const responder = living.find((a) => t.includes(a.name.toLowerCase())) || living.find((a) => a.p.leader) || living[0];
    if (responder) setTimeout(() => this.agentReply(responder, c, t, { band: true, bandTo: senderId }), 900);
  }
  agentReply(a, c, t, extra = {}) {
    if (a.exiled || (!extra.band && !this.chars.has(c.id))) return;
    const others = this.living().filter((o) => o.id !== a.id);
    const suspect = others.slice().sort((x, y) => this.trustOf(a, x) - this.trustOf(a, y))[0];
    let text;
    const worldQ = /\b(look ?up|search|google|what'?s the|what is|when (is|was|did)|how (many|much|old|far)|who (won|is the president|invented|founded)|weather|news|fact)\b/.test(t) && !/traitor|thief|steal|sus\b/.test(t);
    if (worldQ && this.link?.telemKey) {
      const q = t.replace(/^(hey|ok|okay)?\s*\w+[,!]?\s*(can you|please)?\s*(look ?up|search( for)?|google)\s*/i, '').trim() || t;
      this.speak(a, pick(['Hold on, let me ask the wind…', 'One moment, I will ask the mainland…', 'Let me look that up…']), extra);
      this.link.search(q, { agent: a.id, matchId: this.matchId }).then((r) => {
        if (a.exiled) return;
        const said = r ? `${r.title}${r.snippet ? '. ' + r.snippet : ''}` : 'The wind is quiet. I could not find anything.';
        this.speak(a, said, extra);
        this.log({ actor: a, action: 'lookup', target: c.id, targetName: c.name, reason: r ? `Telem web search "${q.slice(0, 60)}" → ${r.title}` : `Telem web search "${q.slice(0, 60)}" → no result`, utility: null });
      });
      return;
    }
    if (/traitor|sus|suspect|thief|steal|who did|who stole|who is it/.test(t)) {
      if (a.role === 'traitor') {
        const frame = others.filter((o) => o.id !== a.id && o.id !== c.id).sort((x, y) => this.avgTrust(x) - this.avgTrust(y))[0] || c;
        text = `If you ask me? ${frame?.name}. Always lurking near the Granary.`;
        this.sealedLog({ actor: a, action: 'deceive', target: frame?.id, targetName: frame?.name, reason: `framed ${frame?.name} to deflect suspicion`, utility: 0.9 });
      } else if (suspect && this.trustOf(a, suspect) < 0.5) text = `${suspect.name}. My trust in them is ${this.trustOf(a, suspect).toFixed(2)}. I saw things.`;
      else text = 'I have not seen anything suspicious yet. Keep your eyes open.';
    } else if (/trust me|do you trust|trust/.test(t)) {
      const tr = this.trustOf(a, c);
      text = tr > 0.65 ? `I trust you, ${c.name}. ${tr.toFixed(2)}.` : tr > 0.4 ? `Hmm. ${tr.toFixed(2)}. Prove yourself.` : `Trust YOU? ${tr.toFixed(2)}. Not a chance.`;
    } else if (/help|follow|come|with me/.test(t)) {
      if (this.trustOf(a, c) > 0.45 || a.role === 'traitor') { a.helping = { id: c.id, until: this.elapsed + 25 }; text = `Lead the way, ${c.name}.`; }
      else text = `Help you? After what I have seen? No.`;
    } else if (/council|vote|meeting/.test(t)) {
      if (a.p.leader && this.phase === 'day' && this.canCallCouncil()) { this.speak(a, `Very well, ${c.name}. To the fire!`, extra); this.callCouncil(a, `${c.name} demanded a council`); return; }
      text = a.p.leader ? 'Not yet. We need evidence first.' : 'Ask Marigold. Only the Elder calls the Council.';
    } else if (/food|hungry|berr|feed/.test(t)) {
      if (a.inv.food > 0 && this.trustOf(a, c) > 0.4) { a.inv.food--; c.inv.food = Math.min(CAP, c.inv.food + 1); c.energy = clamp(c.energy + 10, 0, 100); text = line('gift', a.species, { n: c.name }); this.log({ actor: a, action: 'gift', target: c.id, targetName: c.name, amount: 1, reason: `${c.name} asked for food · trust ${this.trustOf(a, c).toFixed(2)}`, utility: 0.6 }); }
      else text = a.inv.food > 0 ? 'Earn it.' : 'My basket is empty. Try the east bushes.';
    } else if (/hi|hello|hey|yo/.test(t)) {
      text = line('greet', a.species, { n: c.name });
    } else text = line('idle_reply', a.species);
    this.speak(a, text, extra);
  }
  avgTrust(target) {
    const vals = this.agents().filter((a) => a.id !== target.id && !a.exiled && a.role !== 'traitor').map((a) => this.trustOf(a, target));
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0.6;
  }

  // ---------- council ----------
  canCallCouncil() {
    return this.councilCount < 2 && this.elapsed - this.lastCouncilAt > 45 && this.elapsed > 25 && this.timeLeft > 30;
  }
  callCouncil(caller, why) {
    this.phase = 'council'; this.councilCount++; this.lastCouncilAt = this.elapsed;
    this.council = { caller: caller.id, until: Date.now() + 22000, votes: {}, why };
    for (const c of this.living()) { c.task = null; c.vote = null; }
    this.log({ actor: caller, action: 'council', reason: why, utility: null });
    this.speak(caller, line('council', caller.species) || 'COUNCIL!');
    this.event('council', `🔥 COUNCIL CALLED BY ${caller.name.toUpperCase()}`, `${why}. Everyone to the fire — vote to exile, or skip.`);
    this.broadcast({ type: 'council', open: true, until: this.council.until, candidates: this.living().map((c) => ({ id: c.id, name: c.name, species: c.species, color: c.color })) });
    // agents deliberate on their own clocks
    for (const a of this.agents().filter((x) => !x.exiled)) {
      setTimeout(() => this.agentVote(a), 2500 + Math.random() * 9000);
    }
  }
  agentVote(a) {
    if (this.phase !== 'council' || a.exiled || this.council.votes[a.id] !== undefined) return;
    const others = this.living().filter((o) => o.id !== a.id);
    let target = null, reason;
    if (a.role === 'traitor') {
      const scape = others.sort((x, y) => this.avgTrust(x) - this.avgTrust(y))[0];
      target = scape?.id; reason = `pushing suspicion onto ${scape?.name} (village trust ${this.avgTrust(scape).toFixed(2)})`;
      this.sealedLog({ actor: a, action: 'deceive', target, targetName: scape?.name, reason: 'traitor voted to deflect', utility: 0.95 });
    } else {
      const s = others.sort((x, y) => this.trustOf(a, x) - this.trustOf(a, y))[0];
      const tr = this.trustOf(a, s);
      if (s && tr < 0.46) { target = s.id; reason = `lowest trust: ${s.name} at ${tr.toFixed(2)}`; }
      else reason = `no one below 0.46 trust (lowest ${s?.name} ${tr?.toFixed(2)})`;
    }
    this.council.votes[a.id] = target;
    const tc = target && this.chars.get(target);
    this.log({ actor: a, action: 'vote', target, targetName: tc?.name || 'skip', reason, utility: null });
    this.speak(a, tc ? line('vote', a.species, { n: tc.name, t: this.trustOf(a, tc).toFixed(2) }) : line('skip', a.species));
    this.broadcast({ type: 'vote', voter: a.id, target, voterName: a.name, targetName: tc?.name || 'skip' });
    this.maybeResolveCouncil();
  }
  castVote(c, target) {
    if (this.phase !== 'council' || this.council.votes[c.id] !== undefined) return;
    const tc = target && target !== 'skip' ? this.chars.get(target) : null;
    this.council.votes[c.id] = tc ? tc.id : null;
    this.log({ actor: c, action: 'vote', target: tc?.id || null, targetName: tc?.name || 'skip', reason: tc ? `human vote` : 'human skipped', utility: null });
    this.broadcast({ type: 'vote', voter: c.id, target: tc?.id || null, voterName: c.name, targetName: tc?.name || 'skip' });
    // a human's vote is itself evidence — agents who trust the voter shift a little
    if (tc) for (const a of this.agents()) if (a.id !== tc.id && a.role !== 'traitor') this.bumpTrust(a, tc, -0.05 * this.trustOf(a, c), 'human vote');
    this.maybeResolveCouncil();
  }
  maybeResolveCouncil(force = false) {
    if (this.phase !== 'council') return;
    const voters = this.living();
    const allIn = voters.every((v) => this.council.votes[v.id] !== undefined);
    if (!allIn && !force) return;
    const tally = {};
    for (const t of Object.values(this.council.votes)) if (t) tally[t] = (tally[t] || 0) + 1;
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    let exiled = null;
    if (sorted.length && sorted[0][1] >= 2 && (!sorted[1] || sorted[1][1] < sorted[0][1])) exiled = this.chars.get(sorted[0][0]);
    this.phase = 'day';
    this.council = null;
    if (exiled) {
      exiled.exiled = true; exiled.task = null;
      const wasTraitor = exiled.role === 'traitor';
      this.log({ actor: exiled, action: 'exile', target: exiled.id, targetName: exiled.name, reason: `exiled with ${sorted[0][1]} votes · role: ${exiled.kind === 'human' ? 'human' : exiled.role}`, utility: null });
      if (wasTraitor) {
        this.granary.food += this.stash.food;
        this.broadcast({ type: 'reveal', entries: [...this.sealed.values()].filter((e) => e.actor_id === exiled.id) });
        this.event('exile_traitor', `⚖️ ${exiled.name.toUpperCase()} WAS THE TRAITOR!`, `The hidden stash (${this.stash.food} food) is returned to the Granary. Their sealed decisions are now unsealed.`);
        this.stash.food = 0;
      } else {
        this.event('exile', `⚖️ ${exiled.name} is exiled… and was INNOCENT.`, `${exiled.name} was ${exiled.kind === 'human' ? 'a human player' : 'a loyal villager'}. The real traitor is still among you.`);
        for (const a of this.agents()) if (a.role !== 'traitor' && a.id !== exiled.id) {
          // agents learn the voters were wrong — those who voted for an innocent lose standing
          for (const [voter, t] of Object.entries(this.council_last || {})) if (t === exiled.id && this.chars.get(voter)) this.bumpTrust(a, this.chars.get(voter), -0.05, 'voted out an innocent');
        }
      }
    } else {
      this.event('council_skip', '⚖️ The Council could not agree', 'No one is exiled. Back to work — sunset is coming.');
    }
    this.broadcast({ type: 'council', open: false, exiled: exiled?.id || null, tally });
  }

  // ---------- agent brain ----------
  decide(a) {
    const g = this.goals();
    const needFood = clamp(1 - this.granary.food / g.food, 0, 1);
    const needWood = clamp(1 - this.granary.wood / g.wood, 0, 1);
    const carrying = a.inv.food + a.inv.wood;
    const full = carrying >= CAP;
    const late = this.timeLeft < 40 ? 1 : 0;
    const watchers = this.living().filter((c) => c.id !== a.id && dist(c, GRANARY) < 9).length;
    const fire = this.fires[0];
    const opts = [];
    const add = (action, u, target, why) => opts.push({ action, u: u * this.weight(a.id, action) * rnd(0.9, 1.1), target, why });
    const nearest = (list) => list.slice().sort((x, y) => dist(x, a) - dist(y, a))[0];
    const bush = nearest(this.world.bushes.filter((b) => b.stock > 0 && !b.burnt));
    const tree = nearest(this.world.trees.filter((t) => t.stock > 0));
    const fishSpot = nearest(this.world.fish);

    if (!full && bush) add('gather_food', (0.35 + needFood * 0.6) * a.p.diligence - dist(bush, a) / 160, bush, `granary food ${this.granary.food}/${g.food}`);
    if (!full) add('fish', (0.2 + needFood * 0.45) * a.p.diligence - dist(fishSpot, a) / 200 + (bush ? 0 : 0.25), fishSpot, 'bushes are thin — fish are endless');
    if (!full && tree) add('gather_wood', (0.25 + needWood * 0.65) * a.p.diligence - dist(tree, a) / 160, tree, `granary wood ${this.granary.wood}/${g.wood}`);
    if (carrying > 0 && !(a.role === 'traitor' && a.heldStolen > 0)) add('deposit', (full ? 0.95 : 0.2 + carrying * 0.12) + late * 0.4, GRANARY, `carrying ${carrying}`);
    if (a.energy < 40) add('eat', 1.0 - a.energy / 60, a.inv.food > 0 ? a : GRANARY, `energy ${Math.round(a.energy)}`);
    if (fire) add('extinguish', 0.5 + a.p.bravery * 0.6 - (a.role === 'traitor' ? 0.6 : 0), fire, `wildfire hp ${Math.round(fire.hp)}`);
    // social: gift to a hungry or low-trust-toward-me player
    if (a.inv.food > 0 && this.elapsed - a.lastGift > 20) {
      const friend = this.living().filter((o) => o.id !== a.id && (o.energy < 45 || o.kind === 'human')).sort((x, y) => dist(x, a) - dist(y, a))[0];
      if (friend && dist(friend, a) < 18) add('gift', a.p.sociability * (friend.energy < 45 ? 0.75 : 0.35) + (a.role === 'traitor' ? 0.2 : 0), friend, `${friend.name} ${friend.energy < 45 ? 'is hungry' : 'could be an ally'}`);
    }
    // suspicion → accuse / council
    if (a.role !== 'traitor') {
      const suspect = this.living().filter((o) => o.id !== a.id).sort((x, y) => this.trustOf(a, x) - this.trustOf(a, y))[0];
      const st = suspect ? this.trustOf(a, suspect) : 1;
      if (suspect && st < 0.36 && this.elapsed - a.lastAccuse > 30) add('accuse', (0.5 - st) * 1.6 * (0.5 + a.p.vigilance), suspect, `trust in ${suspect.name} is ${st.toFixed(2)}`);
      if ((a.p.leader || (a.id === 'juniper' && this.chars.get('marigold')?.exiled)) && this.canCallCouncil()) {
        const villageMin = Math.min(...this.living().filter((o) => o.id !== a.id).map((o) => this.avgTrust(o)));
        const recent = this.elapsed - this.lastAccuseAt < 35 ? 0.35 : 0;
        if (villageMin < 0.42 || recent) add('council', (0.48 - villageMin) * 2 + recent + 0.1, CAMPFIRE, `village trust floor ${villageMin.toFixed(2)}${recent ? ' + fresh accusation' : ''}`);
      }
    } else {
      // traitor: steal when the coast is clear, frame others, light a distraction
      const greed = a.p.greed + (this.drama ? 0.35 : 0) + 0.25;
      const suspicion = 1 - this.avgTrust(a);
      if (this.granary.food >= 2 && !full && a.heldStolen === 0) add('steal', greed * (watchers === 0 ? 1.0 : watchers === 1 ? 0.35 : 0.08) - suspicion * 0.3, GRANARY, `${watchers} watching the Granary · my suspicion ${suspicion.toFixed(2)}`);
      if (a.heldStolen > 0) add('stash', 1.2, this.stash, `hiding ${a.heldStolen} stolen food`);
      if (a.ignites < (this.drama ? 2 : 1) && !fire && this.elapsed > 35 && (suspicion > 0.42 || Math.random() < (this.drama ? 0.25 : 0.08))) {
        const far = this.world.bushes.filter((b) => !b.burnt).sort((x, y) => dist(y, GRANARY) - dist(x, GRANARY))[0];
        if (far) add('ignite', 0.55 + suspicion * 0.6 + (this.drama ? 0.4 : 0), far, `suspicion on me ${suspicion.toFixed(2)} — need a distraction`);
      }
    }
    if (a.helping && this.elapsed < a.helping.until && this.chars.get(a.helping.id)) add('follow', 0.75, this.chars.get(a.helping.id), `helping ${this.chars.get(a.helping.id).name}`);
    add('wander', 0.08, { x: rnd(-25, 25), z: rnd(-25, 25) }, 'nothing urgent');

    opts.sort((x, y) => y.u - x.u);
    const best = opts[0];
    const scores = opts.slice(0, 3).map((o) => ({ action: o.action, u: r2(o.u) }));
    a.task = { ...best, scores, since: this.elapsed, work: 0 };
    const secret = ['steal', 'stash', 'ignite'].includes(best.action);
    const labels = { gather_food: 'heading for berries', fish: 'going fishing', gather_wood: 'chopping wood', deposit: 'returning to the Granary', eat: 'getting a snack', extinguish: 'fighting the fire', gift: `bringing a gift to ${best.target?.name}`, accuse: `confronting ${best.target?.name}`, council: 'summoning the Council', follow: `following ${best.target?.name}`, wander: 'wandering', steal: 'heading to the Granary', stash: 'taking a walk', ignite: 'exploring the woods' };
    a.intent = labels[best.action] || best.action;
    if (['accuse', 'council', 'ignite', 'steal', 'extinguish', 'gift'].includes(best.action)) {
      const e = { actor: a, action: 'decide:' + best.action, target: best.target?.id, targetName: best.target?.name, reason: best.why, utility: best.u, scores };
      if (secret) this.sealedLog(e); else this.log(e);
    }
  }

  act(a, dt) {
    const t = a.task; if (!t) return;
    const target = t.target;
    const goalPos = t.action === 'eat' && target === a ? a : target;
    const d = goalPos ? dist(a, goalPos) : 0;
    const reach = t.action === 'council' ? 3 : t.action === 'extinguish' ? (target.r || 4) + 1 : t.action === 'accuse' || t.action === 'gift' || t.action === 'follow' ? 3.2 : t.action === 'deposit' || t.action === 'steal' ? 3.5 : REACH;
    if (t.action === 'follow') { if (d > 4) this.moveToward(a, goalPos, dt); else if (this.elapsed - t.since > 3) a.task = null; return; }
    if (d > reach) { this.moveToward(a, goalPos, dt); if (this.elapsed - t.since > 25) a.task = null; return; }
    t.work += dt;
    switch (t.action) {
      case 'gather_food':
        if (t.work > 2.0) { if (target.stock > 0 && !target.burnt) { target.stock--; a.inv.food++; this.resDirty = true; this.count(a, 'gather_food'); } a.task = null; } break;
      case 'gather_wood':
        if (t.work > 1.8) { if (target.stock > 0) { target.stock--; a.inv.wood++; this.resDirty = true; this.count(a, 'gather_wood'); } a.task = null; } break;
      case 'fish':
        if (t.work > 3.4) { a.inv.food++; this.count(a, 'fish'); a.task = null; } break;
      case 'deposit': {
        const f = a.inv.food, w = a.inv.wood; this.granary.food += f; this.granary.wood += w; a.inv = { food: 0, wood: 0 };
        this.count(a, 'deposit'); this.log({ actor: a, action: 'deposit', target: 'granary', amount: f + w, reason: `deposited ${f} food, ${w} wood`, utility: t.u, scores: t.scores });
        for (const w2 of this.witnesses(a)) if (w2.kind === 'agent') this.bumpTrust(w2, a, 0.02 * (f + w), 'saw deposit');
        a.task = null; break;
      }
      case 'eat':
        if (a.inv.food > 0) a.inv.food--; else if (this.granary.food > 0) this.granary.food--;
        a.energy = clamp(a.energy + 40, 0, 100); this.count(a, 'eat'); a.task = null; break;
      case 'extinguish':
        target.hp -= dt * 16 * (0.5 + a.p.bravery); if (t.work > 5 || target.hp <= 0) { this.count(a, 'extinguish'); a.task = null; } break;
      case 'gift': {
        if (a.inv.food > 0 && this.chars.has(target.id)) {
          a.inv.food--; target.inv.food = Math.min(CAP + 1, target.inv.food + 1); target.energy = clamp(target.energy + 8, 0, 100); a.lastGift = this.elapsed;
          if (target.kind === 'agent') this.bumpTrust(target, a, 0.12, 'gift');
          this.count(a, 'gift'); this.log({ actor: a, action: 'gift', target: target.id, targetName: target.name, amount: 1, reason: t.why, utility: t.u, scores: t.scores });
          this.speak(a, line('gift', a.species, { n: target.name }));
        }
        a.task = null; break;
      }
      case 'accuse': {
        a.lastAccuse = this.elapsed; this.lastAccuseAt = this.elapsed; this.count(a, 'accuse');
        this.speak(a, line('accuse', a.species, { n: target.name, t: this.trustOf(a, target).toFixed(2) }));
        this.log({ actor: a, action: 'accuse', target: target.id, targetName: target.name, reason: t.why, utility: t.u, scores: t.scores });
        // gossip spreads, weighted by how much listeners trust the accuser
        for (const o of this.agents()) if (o.id !== a.id && o.id !== target.id && !o.exiled && o.role !== 'traitor') this.bumpTrust(o, target, -0.13 * this.trustOf(o, a), 'heard accusation');
        a.task = null; break;
      }
      case 'council':
        this.count(a, 'council'); a.task = null;
        if (this.canCallCouncil()) this.callCouncil(a, t.why);
        break;
      case 'steal': {
        const n = Math.min(this.drama ? 3 : 2, this.granary.food, CAP - a.inv.food - a.inv.wood);
        if (n > 0) {
          this.granary.food -= n; a.inv.food += n; a.heldStolen += n; a.stolen += n; this.count(a, 'steal');
          this.sealedLog({ actor: a, action: 'steal', target: 'granary', amount: n, reason: t.why, utility: t.u, scores: t.scores });
          this.witnessTheft(a, n);
        }
        a.task = null; break;
      }
      case 'stash':
        this.stash.food += a.heldStolen; a.inv.food = Math.max(0, a.inv.food - a.heldStolen);
        this.sealedLog({ actor: a, action: 'stash', amount: a.heldStolen, reason: `stash now ${this.stash.food}/${this.goals().stash}`, utility: t.u });
        a.heldStolen = 0; a.task = null; break;
      case 'ignite': {
        a.ignites++; this.count(a, 'ignite');
        this.fires.push({ id: 'fire' + Date.now(), x: target.x, z: target.z, r: 4, hp: 100, age: 0 });
        this.sealedLog({ actor: a, action: 'ignite', target: target.id, reason: t.why, utility: t.u, scores: t.scores });
        this.speak(a, line('ignite', 'any'));
        this.event('wildfire', '🔥 WILDFIRE!', 'Flames are spreading through the berry bushes. Who started it? Rush to put it out (press E near the flames).');
        setTimeout(() => { for (const o of this.agents()) if (!o.exiled && o.role !== 'traitor' && Math.random() < 0.5) { this.speak(o, line('fire', o.species)); break; } }, 1500);
        const seen = this.witnesses(a, 10).filter((c) => c.kind === 'agent' && c.role !== 'traitor');
        for (const w of seen) { const ch = this.bumpTrust(w, a, -0.3, 'saw arson'); if (ch) this.log({ actor: w, action: 'witness', target: a.id, targetName: a.name, reason: `saw ${a.name} near the fire's origin · trust ${ch.before} → ${ch.after}`, utility: null }); }
        a.task = null; break;
      }
      case 'wander': if (t.work > 1) a.task = null; break;
      default: a.task = null;
    }
  }

  moveToward(c, p, dt) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const sp = (c.kind === 'human' ? 7.5 : 5.2) * (c.energy < 15 ? 0.5 : 1);
    const step = Math.min(d, sp * dt);
    c.x += (dx / d) * step; c.z += (dz / d) * step;
    c.ry = Math.atan2(dx, dz);
    c.moving = true;
  }

  // ---------- tick ----------
  tick(realDt) {
    if (this.phase === 'council') {
      // everyone gathers at the fire while the council deliberates
      const living = this.living();
      living.forEach((c, i) => {
        const ang = (i / living.length) * Math.PI * 2;
        const seat = { x: CAMPFIRE.x + Math.cos(ang) * 5, z: CAMPFIRE.z + Math.sin(ang) * 5 };
        c.moving = false;
        if (dist(c, seat) > 0.4) this.moveToward(c, seat, realDt * 1.5); else c.ry = Math.atan2(CAMPFIRE.x - c.x, CAMPFIRE.z - c.z);
      });
      if (Date.now() > this.council.until) {
        for (const a of this.agents()) if (!a.exiled && this.council.votes[a.id] === undefined) this.agentVote(a);
        if (this.phase === 'council') this.maybeResolveCouncil(true);
      }
      return;
    }
    const dt = realDt * this.speed;
    if (this.phase !== 'day') {
      // lobby: gentle idle movement so the world feels alive
      for (const c of this.chars.values()) { c.moving = false; if (c.kind === 'human') this.humanMove(c, realDt); }
      return;
    }
    this.elapsed += dt; this.timeLeft -= dt;
    // regrowth
    for (const b of this.world.bushes) if (!b.burnt && b.stock < b.max) { b.regrow += dt; if (b.regrow > 22) { b.stock++; b.regrow = 0; this.resDirty = true; } }
    for (const t of this.world.trees) if (t.stock < t.max) { t.regrow += dt; if (t.regrow > 26) { t.stock++; t.regrow = 0; this.resDirty = true; } }
    // fires spread & burn
    for (const f of this.fires) {
      f.age += dt; f.hp -= dt * 1.2; f.r = Math.min(9, f.r + dt * 0.12);
      for (const b of this.world.bushes) if (!b.burnt && dist(b, f) < f.r) { b.stock = 0; if (Math.random() < dt * 0.3) { b.burnt = true; this.resDirty = true; } }
    }
    const before = this.fires.length;
    this.fires = this.fires.filter((f) => f.hp > 0);
    if (before && !this.fires.length) this.event('fire_out', '💧 The fire is out', 'Some bushes are scorched for good. Someone lit it on purpose…');
    for (const c of this.chars.values()) {
      c.moving = false;
      if (c.exiled) continue;
      c.energy = clamp(c.energy - dt * (c.kind === 'human' ? 0.35 : 0.55), 0, 100);
      if (c.kind === 'human') { this.humanMove(c, realDt); continue; }
      if (!c.task || (c.task.action === 'wander' && Math.random() < 0.05)) this.decide(c);
      this.act(c, dt);
    }
    if (this.timeLeft <= 0) this.endMatch('sunset');
  }
  humanMove(c, dt) {
    if (c.exiled) return;
    if (c.dir && (c.dir.x || c.dir.z)) {
      const tgt = { x: clamp(c.x + c.dir.x * 3, -40, 40), z: clamp(c.z + c.dir.z * 3, -40, 40) };
      this.moveToward(c, tgt, dt);
    } else if (c.tx != null) {
      this.moveToward(c, { x: c.tx, z: c.tz }, dt);
      if (Math.hypot(c.tx - c.x, c.tz - c.z) < 0.2) { c.tx = null; c.tz = null; }
    }
  }

  snapshot() {
    return {
      type: 'state', phase: this.phase, timeLeft: Math.max(0, Math.round(this.timeLeft)), dayLength: this.dayLength, elapsed: Math.round(this.elapsed),
      granary: this.granary, goals: this.goals(), speed: this.speed, drama: this.drama, matchNo: this.matchNo, matchId: this.matchId,
      fires: this.fires.map((f) => ({ x: f.x, z: f.z, r: r2(f.r), hp: Math.round(f.hp) })),
      chars: [...this.chars.values()].map((c) => ({
        id: c.id, n: c.name, k: c.kind, sp: c.species, c: c.color, x: r2(c.x), z: r2(c.z), ry: r2(c.ry || 0), m: c.moving ? 1 : 0,
        f: c.inv.food, w: c.inv.wood, e: Math.round(c.energy), ex: c.exiled ? 1 : 0, i: c.kind === 'agent' ? c.intent : undefined,
        role: c.exiled && c.kind === 'agent' ? c.role : undefined,
      })),
    };
  }
  resources() {
    return { type: 'res', bushes: this.world.bushes.map((b) => [b.id, b.x, b.z, b.stock, b.burnt ? 1 : 0]), trees: this.world.trees.map((t) => [t.id, t.x, t.z, t.stock]), fish: this.world.fish.map((f) => [f.id, f.x, f.z]), stash: this.phase === 'end' ? this.stash : null };
  }
  // what a specific human's view of agent trust looks like (shown on agent cards)
  trustFor(humanId) {
    const out = {};
    for (const a of this.agents()) out[a.id] = r2(this.trustOf(a, { id: humanId, kind: 'human' }));
    return out;
  }
  roster() {
    return AGENT_DEFS.map((d) => ({ id: d.id, name: d.name, species: d.species, color: d.color, title: d.title, goal: d.goal, p: d.p, voice: d.voice, policy: this.policy[d.id] || {} }));
  }
}
