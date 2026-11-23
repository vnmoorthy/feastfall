// Runware image inference: agent portraits + cinematic world-event art, cached to disk.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STYLE = 'cute stylized low-poly 3D render, autumn thanksgiving island, warm golden-hour lighting, soft shadows, vibrant, game key art, no text';
export const PROMPTS = {
  bram: `portrait of a friendly strong brown bear builder wearing a carpenter apron, holding a basket of berries, ${STYLE}`,
  juniper: `portrait of a sharp-eyed deer detective wearing a tiny scarf and holding a magnifying glass, ${STYLE}`,
  vex: `portrait of a charming sly orange fox merchant with a mischievous grin and a satchel of trinkets, ${STYLE}`,
  marigold: `portrait of a wise purple-feathered owl elder with round spectacles and a lantern, ${STYLE}`,
  pip: `portrait of a hyperactive red squirrel holding an acorn and a tiny torch, chaotic energy, ${STYLE}`,
  sunrise: `wide shot of a low-poly island village at sunrise with a wooden granary and harvest baskets, ${STYLE}`,
  wildfire: `dramatic wildfire spreading through berry bushes on a low-poly island at dusk, animals running with buckets, ${STYLE}`,
  council: `woodland animals bear deer fox owl squirrel sitting in a circle around a campfire at night holding a tense vote, dramatic, ${STYLE}`,
  exile: `a lone animal silhouette on a small boat drifting away from an island at twilight, melancholic, ${STYLE}`,
  exile_traitor: `a fox caught in a spotlight beside a hidden pile of stolen berries, other animals gasping, dramatic reveal, ${STYLE}`,
  feast: `joyful woodland animals and humans at a long thanksgiving feast table with pies and a roast, lanterns, celebration, ${STYLE}`,
  traitor: `a sly fox sitting on a huge secret hoard of food in a dark cave while the village starves, villain victory, ${STYLE}`,
  starved: `an empty granary on a cold windy low-poly island at night, sad animals, first snow, ${STYLE}`,
  hero: `epic key art: bear, deer, fox, owl and squirrel and two humans around a glowing granary on a low-poly autumn island at sunset, one fox hiding stolen berries behind its back, cinematic, ${STYLE}`,
};

export function loadEnv(root) {
  const env = {};
  try {
    for (const l of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /RUNWARE|BAND|PORT/.test(k))) };
}

export class Runware {
  constructor({ root, key, model, log }) {
    this.dir = path.join(root, 'data', 'images'); this.key = key; this.model = model || 'runware:100@1'; this.log = log || console.log;
    this.inflight = new Map(); this.calls = 0; this.lastError = null;
    fs.mkdirSync(this.dir, { recursive: true });
  }
  enabled() { return !!this.key; }
  file(name) {
    for (const ext of ['webp', 'png', 'jpg']) { const p = path.join(this.dir, `${name}.${ext}`); if (fs.existsSync(p)) return `/images/${name}.${ext}`; }
    return null;
  }
  async generate(name, prompt, { width = 768, height = 512, force = false } = {}) {
    if (!force && this.file(name)) return this.file(name);
    if (!this.key) return null;
    if (this.inflight.has(name)) return this.inflight.get(name);
    const p = (async () => {
      const t0 = Date.now();
      const res = await fetch('https://api.runware.ai/v1', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
        body: JSON.stringify([{ taskType: 'imageInference', taskUUID: crypto.randomUUID(), positivePrompt: prompt || PROMPTS[name], model: this.model, width, height, numberResults: 1, outputType: 'URL', outputFormat: 'WEBP', steps: this.model === 'runware:100@1' ? 4 : undefined }]),
      });
      const json = await res.json();
      const url = json?.data?.[0]?.imageURL;
      if (!url) throw new Error(JSON.stringify(json?.errors || json).slice(0, 300));
      const img = Buffer.from(await (await fetch(url)).arrayBuffer());
      fs.writeFileSync(path.join(this.dir, `${name}.webp`), img);
      this.calls++;
      this.log(`[runware] ${name} generated in ${Date.now() - t0}ms`);
      return `/images/${name}.webp`;
    })().catch((e) => { this.lastError = String(e.message || e); this.log('[runware] ' + this.lastError); return null; }).finally(() => this.inflight.delete(name));
    this.inflight.set(name, p);
    return p;
  }
  async warm() {
    const jobs = [];
    for (const [name, prompt] of Object.entries(PROMPTS)) {
      const portrait = ['bram', 'juniper', 'vex', 'marigold', 'pip'].includes(name);
      jobs.push(this.generate(name, prompt, portrait ? { width: 512, height: 512 } : name === 'hero' ? { width: 1280, height: 640 } : { width: 896, height: 512 }));
    }
    return Promise.all(jobs);
  }
}
