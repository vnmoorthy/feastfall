// World link: the island's agents reach the real world.
//  • Telem AI  — live web search for agents. Ask an animal a real-world question and it looks it up;
//                every lookup is traced as a session trajectory in the Telem console.
//  • Glasser   — premium data via one key. At sunrise Marigold reads a real Thanksgiving headline
//                (Google News through Glasser's Serper provider) as the island's town crier.
// Both are optional: without keys the game runs exactly as before.
import crypto from 'node:crypto';

const TELEM = 'https://router.telem.ai';
const GLASSER = 'https://api.glasser.ai';
const clip = (s, n = 140) => (s && s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s || '');

export class WorldLink {
  constructor({ telemKey, glasserKey, log }) {
    this.telemKey = telemKey; this.glasserKey = glasserKey; this.log = log || console.log;
    this.stats = { telemSearches: 0, telemErrors: 0, glasserRuns: 0, glasserErrors: 0, lastHeadline: null, lastError: null };
    this.headlineCache = null;
  }
  status() { return { telem: !!this.telemKey, glasser: !!this.glasserKey, ...this.stats }; }

  // ---------- Telem: agents look things up ----------
  async search(query, { agent, matchId } = {}) {
    if (!this.telemKey) return null;
    try {
      const res = await fetch(`${TELEM}/v1/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.telemKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: { query },
          search: { num_results: 3 },
          metadata: { app: 'feastfall', agent: agent || 'unknown', match_id: matchId || null, session: `feastfall-${matchId || 'lobby'}` },
        }),
        signal: AbortSignal.timeout(9000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 160)}`);
      this.stats.telemSearches++;
      const results = json.results || json.data?.results || json.search?.results ||
        (json.preprocessor_runs || []).flatMap((r) => r.output_payload?.results || r.raw_payload?.results || []);
      this.stats.lastTrajectory = json.trajectory_id || null;
      const top = results[0];
      if (!top) return null;
      const raw = String(top.snippet || top.summary || top.text || top.description || top.content || '').replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim();
      const snippet = raw.startsWith(top.title || '@@') ? raw.slice((top.title || '').length).trim() : raw;
      return { title: clip(top.title, 110), snippet: clip(snippet, 170), url: top.url || top.link, trajectory: json.trajectory_id };
    } catch (e) {
      this.stats.telemErrors++; this.stats.lastError = 'telem: ' + String(e.message || e); this.log('[telem] ' + this.stats.lastError);
      return null;
    }
  }

  // ---------- Glasser: the town crier ----------
  async headline(topic = 'Thanksgiving') {
    if (!this.glasserKey) return null;
    if (this.headlineCache && Date.now() - this.headlineCache.at < 20 * 60 * 1000) return this.headlineCache.items[Math.floor(Math.random() * this.headlineCache.items.length)];
    try {
      const res = await fetch(`${GLASSER}/v1/runs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.glasserKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ provider: 'serper', endpoint: '/news', input: { q: topic } }),
        signal: AbortSignal.timeout(12000),
      });
      let run = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(run).slice(0, 160)}`);
      // runs may complete asynchronously — poll briefly
      for (let i = 0; i < 8 && run && ['QUEUED', 'RUNNING'].includes(run.status); i++) {
        await new Promise((r) => setTimeout(r, 700));
        run = await (await fetch(`${GLASSER}/v1/runs/${run.id}`, { headers: { Authorization: `Bearer ${this.glasserKey}` } })).json();
      }
      this.stats.glasserRuns++;
      const out = run.output || run.provider_response?.body || run.result || {};
      const news = out.news || out.data?.news || out.results || [];
      const items = news.map((n) => ({ title: clip(n.title, 120), source: n.source || n.publisher || '', url: n.link || n.url })).filter((n) => n.title);
      if (!items.length) throw new Error('no news items in run ' + (run.id || ''));
      this.headlineCache = { at: Date.now(), items };
      this.stats.lastHeadline = items[0].title;
      return items[Math.floor(Math.random() * items.length)];
    } catch (e) {
      this.stats.glasserErrors++; this.stats.lastError = 'glasser: ' + String(e.message || e); this.log('[glasser] ' + this.stats.lastError);
      return null;
    }
  }
}
