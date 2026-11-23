// Build a static, single-player browser demo of FEASTFALL into site/ (deployed to GitHub Pages).
// The exact server/game.js simulation runs in the browser through import-map shims.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site');
const URL_ = process.env.SITE_URL || 'https://vnmoorthy.github.io/feastfall/';
fs.rmSync(OUT, { recursive: true, force: true });
const cp = (from, to) => { fs.mkdirSync(path.dirname(path.join(OUT, to)), { recursive: true }); fs.cpSync(path.join(ROOT, from), path.join(OUT, to), { recursive: true }); };

cp('public/style.css', 'style.css');
cp('public/main.js', 'main.js');
cp('public/local.js', 'local.js');
cp('public/shims', 'shims');
cp('public/models', 'models');
cp('server/game.js', 'game.js');
cp('data/images', 'images');
cp('data/memory/reputation.json', 'data/reputation.json');
cp('node_modules/three/build/three.module.js', 'vendor/three/build/three.module.js');
cp('node_modules/three/build/three.core.js', 'vendor/three/build/three.core.js');
cp('node_modules/three/examples/jsm/loaders/GLTFLoader.js', 'vendor/three/examples/jsm/loaders/GLTFLoader.js');
cp('node_modules/three/examples/jsm/utils', 'vendor/three/examples/jsm/utils');
cp('deck', 'deck');
cp('docs', 'docs');

const images = {};
for (const f of fs.readdirSync(path.join(OUT, 'images'))) images[f.replace(/\.\w+$/, '')] = `images/${f}`;
fs.writeFileSync(path.join(OUT, 'images', 'index.json'), JSON.stringify(images));
fs.writeFileSync(path.join(OUT, 'qr.svg'), await QRCode.toString(URL_, { type: 'svg', margin: 1, color: { dark: '#1a1208', light: '#fff4e0' } }));

let html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
html = html
  .replace('href="/style.css"', 'href="style.css"')
  .replace('src="/main.js"', 'src="main.js"')
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script>window.FEASTFALL_STATIC = true;</script>
  <script type="importmap">{ "imports": { "three": "./vendor/three/build/three.module.js", "three/addons/": "./vendor/three/examples/jsm/", "node:crypto": "./shims/crypto.js", "node:fs": "./shims/fs.js", "node:path": "./shims/path.js" } }</script>`)
  .replace('<div class="sponsors">', '<div class="sponsors" style="color:#f4c95d">Browser demo: single player + 5 AI agents, simulation runs locally. For multiplayer, live Bruin runs, Runware and BAND: <code>npm start</code> from the repo.</div><div class="sponsors">');
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`static demo built → ${OUT}`);
