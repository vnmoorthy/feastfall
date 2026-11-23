// BAND bridge: the island's agents talk to agents and humans in other tools.
// Outbound: world events, accusations, council votes, exiles and memory callouts are posted to a BAND room
//           by the "Feastfall Narrator" agent. Inbound: any BAND participant who writes in the room is
//           relayed into the game as a remote visitor, an island agent answers, and the answer goes back to BAND.
const BASE = 'https://app.band.ai/api/v1';
const EMOJI = { bear: '🐻', deer: '🦌', fox: '🦊', owl: '🦉', squirrel: '🐿️', human: '🧑' };

export class Band {
  constructor({ agentKey, chatId, ownerId, log, onRemoteChat }) {
    this.key = agentKey; this.chatId = chatId; this.ownerId = ownerId; this.log = log || console.log; this.onRemoteChat = onRemoteChat;
    this.queue = []; this.sent = 0; this.received = 0; this.seen = new Set(); this.selfId = null; this.lastError = null;
    if (this.enabled()) { this.pump(); this.poll(true); }
  }
  enabled() { return !!(this.key && this.chatId && this.ownerId); }
  status() { return { enabled: this.enabled(), chatId: this.chatId, sent: this.sent, received: this.received, queued: this.queue.length, lastError: this.lastError }; }
  async req(method, path, body) {
    const res = await fetch(BASE + path, { method, headers: { 'X-API-Key': this.key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 200)}`);
    return json;
  }
  post(content, mentionId = this.ownerId, priority = false) {
    if (!this.enabled()) return;
    if (this.queue.length > 25) { if (!priority) return; this.queue.shift(); }
    this.queue[priority ? 'unshift' : 'push']({ content, mentionId });
  }
  async pump() {
    const next = this.queue.shift();
    if (next) {
      try {
        const r = await this.req('POST', `/agent/chats/${this.chatId}/messages`, { message: { content: next.content, mentions: [{ id: next.mentionId }] } });
        if (r?.data?.id) this.seen.add(r.data.id);
        this.sent++;
      } catch (e) { this.lastError = String(e.message || e); this.log('[band] ' + this.lastError); }
    }
    setTimeout(() => this.pump(), next ? 1300 : 400);
  }
  async poll(first = false) {
    try {
      const r = await this.req('GET', `/agent/chats/${this.chatId}/context`);
      const msgs = (r.data || []).slice().sort((a, b) => a.inserted_at.localeCompare(b.inserted_at));
      for (const m of msgs) {
        if (this.seen.has(m.id)) continue;
        this.seen.add(m.id);
        if (m.sender_type === 'Agent' && m.sender_name === 'Feastfall Narrator') { this.selfId = m.sender_id; continue; }
        if (first) continue; // don't replay history on boot
        const text = String(m.content || '').replace(/@\[\[[^\]]+\]\]\s*/g, '').replace(/@\w+/g, '').trim();
        if (!text) continue;
        this.received++;
        this.onRemoteChat?.({ name: m.sender_name || 'BAND visitor', senderId: m.sender_id, text });
      }
    } catch (e) { this.lastError = String(e.message || e); }
    setTimeout(() => this.poll(false), 3500);
  }
  // translate game broadcasts into BAND posts
  relay(msg) {
    if (!this.enabled()) return;
    if (msg.type === 'event') this.post(`**${msg.title}** — ${msg.text}`, this.ownerId, ['council', 'exile', 'exile_traitor', 'feast', 'traitor', 'starved', 'wildfire'].includes(msg.kind));
    else if (msg.type === 'say' && (msg.memory || msg.band)) this.post(`${EMOJI[msg.species] || ''} **${msg.name}**: “${msg.text}”`, msg.bandTo || this.ownerId, true);
    else if (msg.type === 'ledger' && msg.entry && ['accuse', 'vote', 'exile'].includes(msg.entry.action)) {
      const e = msg.entry; this.post(`${EMOJI[e.species] || '🧑'} ${e.actor_name} **${e.action}s** ${e.target_name || 'skip'} — ${e.reason}`);
    }
  }
}
