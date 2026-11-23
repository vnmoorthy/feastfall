// FEASTFALL client — Three.js world, WebSocket multiplayer, voices, ledger, council, Bruin memory UI.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EMOJI = { bear: '🐻', deer: '🦌', fox: '🦊', owl: '🦉', squirrel: '🐿️', human: '🧑' };
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const S = {
  ws: null, me: null, tv: false, roster: [], images: {}, chars: new Map(), snap: null, phase: 'lobby', goals: { food: 1, wood: 1 },
  ledger: [], filter: 'all', trust: {}, voice: true, voices: [], memory: null, myVote: null, council: null, joinUrl: '', lastSay: {}, matchId: null,
};

// ================= THREE =================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('#scene').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf2b880, 70, 170);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 46, 52);
const hemi = new THREE.HemisphereLight(0xffe2b8, 0x3a5a3a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd29a, 2.2);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 200 });
sun.shadow.bias = -0.0005;
scene.add(sun); scene.add(sun.target);

// sky dome
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color(0x5aa0e8) }, bottom: { value: new THREE.Color(0xffc48a) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.5, h)), 1.); }',
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 24, 16), skyMat));

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });
// water
const waterGeo = new THREE.PlaneGeometry(400, 400, 60, 60); waterGeo.rotateX(-Math.PI / 2);
const water = new THREE.Mesh(waterGeo, flat(0x2f8fb5, { transparent: true, opacity: 0.92, roughness: 0.3, metalness: 0.1 }));
water.position.y = -0.6; water.receiveShadow = true; scene.add(water);
const waterBase = waterGeo.attributes.position.array.slice();
// island
const islandGeo = new THREE.CylinderGeometry(44, 47, 3, 64, 4);
{ const p = islandGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 1.4) p.setY(i, y + (Math.sin(p.getX(i) * 0.3) * Math.cos(p.getZ(i) * 0.25)) * 0.35); } islandGeo.computeVertexNormals(); }
const island = new THREE.Mesh(islandGeo, flat(0x7fae4f)); island.userData.proc = true; island.position.y = -1.5; island.receiveShadow = true; scene.add(island);
const sand = new THREE.Mesh(new THREE.CylinderGeometry(48.5, 50, 1.2, 64), flat(0xe9cf94)); sand.userData.proc = true; sand.position.y = -1.6; sand.receiveShadow = true; scene.add(sand);
// paths
const pathMat = flat(0xc9a36a);
for (const [x, z, r] of [[0, 0, 7], [0, 10, 6.5]]) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), pathMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); m.receiveShadow = true; scene.add(m); }
// granary (barn)
const granary = new THREE.Group();
{ const body = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 5), flat(0xa83a2a)); body.position.y = 2; body.castShadow = body.receiveShadow = true; granary.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3, 4), flat(0x4a2c1d)); roof.position.y = 5.5; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.85; roof.castShadow = true; granary.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(2, 2.8, 0.1), flat(0xf2e2c0)); door.position.set(0, 1.4, 2.52); granary.add(door);
  const x1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.12), flat(0xa83a2a)); x1.position.set(0, 1.4, 2.58); x1.rotation.z = 0.6; granary.add(x1);
  const x2 = x1.clone(); x2.rotation.z = -0.6; granary.add(x2); }
granary.position.set(0, 0, -1.5); scene.add(granary);
const pile = new THREE.Group(); pile.position.set(-4.2, 0, 2); scene.add(pile);
const woodPile = new THREE.Group(); woodPile.position.set(4.2, 0, 2); scene.add(woodPile);
const foodColors = [0xd7263d, 0x7b2cbf, 0xf4a261, 0xe76f51, 0x9d4edd];
// campfire
const campfire = new THREE.Group();
for (let i = 0; i < 5; i++) { const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 6), flat(0x5b3a21)); log.rotation.z = Math.PI / 2; log.rotation.y = (i / 5) * Math.PI; log.position.y = 0.25; log.castShadow = true; log.userData.proc = true; campfire.add(log); }
const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa53d, transparent: true, opacity: 0.9 });
const flames = []; for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.6 - i * 0.12, 1.8 - i * 0.3, 6), flameMat.clone()); f.material.color.setHex([0xff7a3d, 0xffb347, 0xfff1a8][i]); f.position.y = 1 + i * 0.15; campfire.add(f); flames.push(f); }
const fireLight = new THREE.PointLight(0xff8a3d, 30, 22, 1.6); fireLight.position.y = 2; campfire.add(fireLight);
for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.6, 7), flat(0x8a8f99)); st.position.set(Math.cos(a) * 6.2, 0.3, Math.sin(a) * 6.2); st.castShadow = true; st.userData.proc = true; campfire.add(st); }
campfire.position.set(0, 0, 10); scene.add(campfire);
// decorations: rocks, pumpkins, lanterns
const rand = (a, b) => a + Math.random() * (b - a);
const decos = [];
for (let i = 0; i < 26; i++) { const a = rand(0, Math.PI * 2), r = rand(14, 42); const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.5, 1.6), 0), flat(0x9aa0a6)); rk.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r); rk.rotation.set(rand(0, 3), rand(0, 3), 0); rk.castShadow = rk.receiveShadow = true; rk.userData.deco = 'rock'; decos.push(rk); scene.add(rk); }
for (let i = 0; i < 14; i++) { const a = rand(0, Math.PI * 2), r = rand(8, 16); const pk = new THREE.Mesh(new THREE.SphereGeometry(rand(0.45, 0.8), 10, 8), flat(0xff8c1a)); pk.scale.y = 0.75; pk.position.set(Math.cos(a) * r, 0.35, Math.sin(a) * r); pk.castShadow = true; pk.userData.deco = 'pumpkin'; decos.push(pk); scene.add(pk); }


// ---------- Blender-built GLB assets (graceful fallback to procedural meshes) ----------
const MODELS = {};
function cloneModel(src) {
  const c = src.clone(true);
  c.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.material = n.material.clone(); n.userData.baseColor = n.material.color?.getHex(); } });
  return c;
}
function tint(obj, hex) {
  obj.traverse((n) => { if (n.isMesh && n.material?.color) { if (n.userData.baseColor == null) n.userData.baseColor = n.material.color.getHex(); n.material.color.setHex(hex ?? n.userData.baseColor); } });
}
async function loadModels() {
  const names = ['island', 'granary', 'campfire', 'pier', 'bush_berry', 'tree_autumn_a', 'tree_autumn_b', 'tree_autumn_c', 'props'];
  const loader = new GLTFLoader();
  await Promise.all(names.map((n) => new Promise((resolve) => {
    loader.load(`models/${n}.glb`, (g) => { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.flatShading = true; } }); MODELS[n] = g.scene; resolve(); }, undefined, () => resolve());
  })));
  if (!Object.keys(MODELS).length) return;
  if (MODELS.island) { island.visible = false; sand.visible = false; const m = cloneModel(MODELS.island); scene.add(m); }
  if (MODELS.granary) { granary.children.forEach((c) => (c.visible = false)); const m = cloneModel(MODELS.granary); m.position.z = 0; granary.add(m); }
  if (MODELS.campfire) { campfire.children.forEach((c) => { if (c.userData.proc) c.visible = false; }); campfire.add(cloneModel(MODELS.campfire)); }
  if (MODELS.props) {
    const byName = (n) => { let f = null; MODELS.props.traverse((o) => { if (!f && o.name && o.name.toLowerCase().startsWith(n)) f = o; }); return f; };
    const place = (name, x, z, ry = 0, s = 1) => { const src = byName(name); if (!src) return; const m = cloneModel(src); m.position.set(x, 0, z); m.rotation.set(0, ry, 0); m.scale.setScalar(s); scene.add(m); return m; };
    for (const d of decos) {
      const src = byName(d.userData.deco === 'rock' ? (Math.random() < 0.5 ? 'rock_a' : 'rock_b') : 'pumpkin');
      if (src) { const m = cloneModel(src); m.position.set(d.position.x, 0, d.position.z); m.rotation.y = Math.random() * 6; m.scale.setScalar(d.userData.deco === 'rock' ? rand(0.6, 1.4) : rand(0.8, 1.2)); scene.add(m); d.visible = false; }
    }
    place('feast_table', 0, 18, 0, 1);
    for (const [x, z] of [[-7, 4], [7, 4], [-7, 15], [7, 15], [-4, -7], [4, -7]]) place('lantern', x, z, 0, 1);
    for (const [x, z, r] of [[-5.5, -2, 0.3], [5.6, -3, -0.4], [9, 6, 1]]) place('haybale', x, z, r, 1);
  }
  if (S.lastRes) {
    for (const map of [res.bushes, res.trees, res.fish]) { for (const o of map.values()) scene.remove(o); map.clear(); }
    applyResources(S.lastRes);
  }
  console.log('[feastfall] Blender models loaded:', Object.keys(MODELS).join(', '));
}

// ---------- resources ----------
const res = { bushes: new Map(), trees: new Map(), fish: new Map() };
const berryGeo = new THREE.SphereGeometry(0.22, 6, 5);
function makeBush() {
  const g = new THREE.Group();
  let leaf;
  if (MODELS.bush_berry) { leaf = cloneModel(MODELS.bush_berry); g.add(leaf); }
  else { leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), flat(0x3f8f3a)); leaf.position.y = 1; leaf.scale.y = 0.85; leaf.castShadow = true; g.add(leaf); }
  g.userData.leaf = leaf;
  g.userData.berries = [];
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(berryGeo, flat(0xd7263d, { emissive: 0x3a0008 })); const a = i * 2.1; b.position.set(Math.cos(a) * 1.05, 1.1 + (i % 2) * 0.3, Math.sin(a) * 1.05); g.add(b); g.userData.berries.push(b); }
  return g;
}
function makeTree() {
  const g = new THREE.Group();
  const variants = ['tree_autumn_a', 'tree_autumn_b', 'tree_autumn_c'].filter((k) => MODELS[k]);
  if (variants.length) { const m = cloneModel(MODELS[variants[Math.floor(Math.random() * variants.length)]]); m.scale.setScalar(rand(0.85, 1.15)); const wrap = new THREE.Group(); wrap.add(m); g.add(wrap); g.userData.crown = [wrap]; return g; }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 6), flat(0x6b4423)); trunk.position.y = 1.3; trunk.castShadow = true; g.add(trunk);
  const cols = [0xd9480f, 0xf08c00, 0xc92a2a, 0xe8590c];
  const col = cols[Math.floor(Math.random() * cols.length)];
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(2.2 - i * 0.5, 2.4, 7), flat(col)); c.position.y = 3 + i * 1.2; c.castShadow = true; g.add(c); }
  g.userData.crown = g.children.slice(1);
  return g;
}
function makeFish() {
  const g = new THREE.Group();
  if (MODELS.pier) { const m = cloneModel(MODELS.pier); m.rotation.y = Math.PI; g.add(m); }
  else {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 5), flat(0x8b5a2b)); deck.position.y = 0.2; deck.castShadow = true; g.add(deck);
    for (const [x, z] of [[-1.3, -2.2], [1.3, -2.2], [-1.3, 2.2], [1.3, 2.2]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2, 5), flat(0x5b3a21)); p.position.set(x, -0.3, z); g.add(p); }
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.05, -3.8); g.add(ring); g.userData.ring = ring;
  const fishM = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 5), flat(0x6ec6ff)); fishM.rotation.z = Math.PI / 2; fishM.position.set(0, 0.6, -3.8); g.add(fishM); g.userData.fish = fishM;
  return g;
}
function applyResources(m) {
  S.lastRes = m;
  for (const [id, x, z, stock, burnt] of m.bushes) {
    let o = res.bushes.get(id); if (!o) { o = makeBush(); o.rotation.y = Math.random() * 6; scene.add(o); res.bushes.set(id, o); } o.position.set(x, 0, z);
    o.userData.berries.forEach((b, i) => (b.visible = i < stock && !burnt));
    tint(o.userData.leaf, burnt ? 0x2b2b2b : stock > 0 ? null : 0x8fa86a);
  }
  for (const [id, x, z, stock] of m.trees) {
    let o = res.trees.get(id); if (!o) { o = makeTree(); o.rotation.y = Math.random() * 6; scene.add(o); res.trees.set(id, o); } o.position.set(x, 0, z);
    const s = 0.55 + stock * 0.15; o.userData.crown.forEach((c) => c.scale.setScalar(s));
  }
  for (const [id, x, z] of m.fish) {
    let o = res.fish.get(id); if (!o) { o = makeFish(); o.position.set(x, 0, z); o.lookAt(0, 0, 0); scene.add(o); res.fish.set(id, o); }
  }
  if (m.stash) showStash(m.stash);
}
let stashObj = null;
function showStash(st) {
  if (stashObj) scene.remove(stashObj);
  stashObj = new THREE.Group();
  for (let i = 0; i < Math.max(3, st.food); i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), flat(foodColors[i % 5])); b.position.set(rand(-1.2, 1.2), 0.3 + Math.floor(i / 6) * 0.4, rand(-1.2, 1.2)); stashObj.add(b); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 15; stashObj.add(beam);
  stashObj.position.set(st.x, 0, st.z); scene.add(stashObj);
}

// ---------- fires ----------
const fireObjs = [];
function syncFires(list) {
  while (fireObjs.length < list.length) {
    const g = new THREE.Group();
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(rand(0.4, 0.9), rand(1.5, 3), 5), new THREE.MeshBasicMaterial({ color: [0xff5a1f, 0xff9f1c, 0xffd166][i % 3], transparent: true, opacity: 0.85 })); f.position.set(rand(-1, 1), 0.8, rand(-1, 1)); f.userData.ph = Math.random() * 6; g.add(f); }
    const l = new THREE.PointLight(0xff5a1f, 60, 30, 1.5); l.position.y = 3; g.add(l);
    scene.add(g); fireObjs.push(g);
  }
  while (fireObjs.length > list.length) scene.remove(fireObjs.pop());
  list.forEach((f, i) => { const g = fireObjs[i]; g.position.set(f.x, 0, f.z); g.userData.r = f.r; g.children.forEach((c, j) => { if (c.isMesh) { const a = c.userData.ph + j; const rr = (j / 14) * f.r; c.position.x = Math.cos(a * 2.4) * rr; c.position.z = Math.sin(a * 2.4) * rr; } }); });
}

// ---------- characters ----------
function makeChar(sp, color) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const col = new THREE.Color(color); const dark = col.clone().multiplyScalar(0.6); const light = col.clone().lerp(new THREE.Color(0xffffff), 0.45);
  const M = (c) => flat(c);
  const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  if (sp === 'human') {
    add(new THREE.CapsuleGeometry(0.55, 1.0, 4, 8), M(col), 0, 1.15, 0);
    add(new THREE.SphereGeometry(0.48, 12, 10), M(0xf1c7a3), 0, 2.35, 0);
    const brim = add(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 16), M(0x1d1d1d), 0, 2.72, 0);
    add(new THREE.CylinderGeometry(0.42, 0.48, 0.75, 14), M(0x1d1d1d), 0, 3.1, 0);
    add(new THREE.BoxGeometry(0.3, 0.22, 0.05), M(0xf4c95d), 0, 2.9, 0.47);
    add(new THREE.SphereGeometry(0.07, 6, 6), M(0x111111), -0.16, 2.42, 0.42); add(new THREE.SphereGeometry(0.07, 6, 6), M(0x111111), 0.16, 2.42, 0.42);
    add(new THREE.BoxGeometry(0.8, 0.12, 0.05), M(0xffffff), 0, 1.75, 0.5);
    void brim;
  } else {
    const bodyM = M(col), bellyM = M(light), darkM = M(dark);
    const torso = add(new THREE.SphereGeometry(0.95, 12, 10), bodyM, 0, 1.15, 0); torso.scale.set(1, 1.15, 0.95);
    add(new THREE.SphereGeometry(0.6, 10, 8), bellyM, 0, 1.05, 0.48).scale.set(1, 1.2, 0.6);
    const head = new THREE.Group(); head.position.set(0, 2.45, 0.05); body.add(head);
    add(new THREE.SphereGeometry(0.72, 12, 10), bodyM, 0, 0, 0, head);
    const eyeW = M(0xffffff), eyeB = M(0x111111);
    const eye = (x, size = 0.13, z = 0.6) => { add(new THREE.SphereGeometry(size, 8, 8), eyeW, x, 0.12, z, head); add(new THREE.SphereGeometry(size * 0.55, 8, 8), eyeB, x, 0.12, z + size * 0.6, head); };
    if (sp === 'bear') {
      add(new THREE.SphereGeometry(0.26, 8, 8), darkM, -0.52, 0.55, 0, head); add(new THREE.SphereGeometry(0.26, 8, 8), darkM, 0.52, 0.55, 0, head);
      add(new THREE.SphereGeometry(0.32, 8, 8), bellyM, 0, -0.15, 0.6, head).scale.set(1, 0.8, 0.8); add(new THREE.SphereGeometry(0.1, 6, 6), eyeB, 0, -0.05, 0.86, head); eye(-0.25, 0.1); eye(0.25, 0.1);
      body.scale.setScalar(1.12);
    } else if (sp === 'deer') {
      for (const s of [-1, 1]) { const a = add(new THREE.CylinderGeometry(0.05, 0.07, 1.0, 5), M(0xe9d3a8), s * 0.35, 0.95, -0.05, head); a.rotation.z = -s * 0.45; const b = add(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 5), M(0xe9d3a8), s * 0.62, 1.25, -0.05, head); b.rotation.z = s * 0.4; const ear = add(new THREE.ConeGeometry(0.16, 0.45, 6), bodyM, s * 0.62, 0.35, 0, head); ear.rotation.z = -s * 1.2; }
      add(new THREE.SphereGeometry(0.3, 8, 8), bellyM, 0, -0.2, 0.55, head).scale.set(0.9, 0.75, 1); add(new THREE.SphereGeometry(0.09, 6, 6), eyeB, 0, -0.12, 0.85, head); eye(-0.28, 0.14); eye(0.28, 0.14);
    } else if (sp === 'fox') {
      for (const s of [-1, 1]) { const ear = add(new THREE.ConeGeometry(0.22, 0.6, 4), bodyM, s * 0.38, 0.72, 0, head); ear.rotation.z = -s * 0.25; }
      const snout = add(new THREE.ConeGeometry(0.3, 0.75, 6), bellyM, 0, -0.12, 0.8, head); snout.rotation.x = Math.PI / 2; add(new THREE.SphereGeometry(0.09, 6, 6), eyeB, 0, -0.12, 1.17, head); eye(-0.26, 0.11); eye(0.26, 0.11);
      const tail = add(new THREE.ConeGeometry(0.45, 1.8, 7), bodyM, 0, 1.2, -1.1); tail.rotation.x = -1.0; add(new THREE.SphereGeometry(0.28, 8, 6), bellyM, 0, 1.75, -1.75);
    } else if (sp === 'owl') {
      for (const s of [-1, 1]) { const t = add(new THREE.ConeGeometry(0.16, 0.5, 5), darkM, s * 0.42, 0.7, 0, head); t.rotation.z = -s * 0.35; const w = add(new THREE.SphereGeometry(0.5, 8, 8), darkM, s * 0.95, 1.2, -0.05); w.scale.set(0.35, 1, 0.8); }
      eye(-0.27, 0.24, 0.5); eye(0.27, 0.24, 0.5); const beak = add(new THREE.ConeGeometry(0.11, 0.3, 4), M(0xf4c95d), 0, -0.15, 0.72, head); beak.rotation.x = Math.PI / 2 + 0.4;
      const glass = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 6, 16), M(0xf4c95d)); glass.position.set(-0.27, 0.12, 0.72); head.add(glass); const g2 = glass.clone(); g2.position.x = 0.27; head.add(g2);
    } else if (sp === 'squirrel') {
      for (const s of [-1, 1]) { const ear = add(new THREE.ConeGeometry(0.15, 0.4, 5), bodyM, s * 0.4, 0.68, 0, head); ear.rotation.z = -s * 0.2; }
      eye(-0.28, 0.16); eye(0.28, 0.16); add(new THREE.SphereGeometry(0.2, 8, 8), bellyM, 0, -0.22, 0.6, head);
      const tail = add(new THREE.SphereGeometry(0.75, 10, 8), bodyM, 0, 2.0, -1.0); tail.scale.set(0.7, 1.5, 0.6); tail.rotation.x = -0.4; add(new THREE.SphereGeometry(0.4, 8, 6), bellyM, 0, 2.9, -1.2);
      body.scale.setScalar(0.85);
    }
    body.userData.head = head;
  }
  // feet
  for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), flat(dark)); f.position.set(s * 0.4, 0.15, 0.1); f.scale.set(1, 0.6, 1.3); f.castShadow = true; g.add(f); g.userData['foot' + s] = f; }
  // basket carried
  const basket = new THREE.Group(); const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.4, 8), flat(0xc8963e)); basket.add(bk); basket.position.set(0.85, 1.2, 0.45); g.add(basket); basket.visible = false; g.userData.basket = basket;
  // selection ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring); g.userData.ring = ring;
  g.userData.body = body;
  return g;
}

function ensureChar(c) {
  let o = S.chars.get(c.id);
  if (!o) {
    const mesh = makeChar(c.sp, c.c); mesh.position.set(c.x, 0, c.z); scene.add(mesh);
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.style.setProperty('--c', c.c);
    lbl.innerHTML = `<div class="bubble hidden"></div><span class="emo"></span><span class="name ${c.id === S.me ? 'me' : ''}">${esc(c.n)}</span>`;
    $('#labels').appendChild(lbl);
    o = { mesh, lbl, from: { x: c.x, z: c.z, ry: c.ry }, to: { x: c.x, z: c.z, ry: c.ry }, t: 0, data: c, exT: 0 };
    S.chars.set(c.id, o);
  }
  return o;
}

// ================= NETWORK =================
async function connect() {
  if (window.FEASTFALL_STATIC) {
    const { createLocalSocket } = await import('./local.js');
    const ws = await createLocalSocket();
    S.ws = ws; ws.onmessage = (ev) => { const m = JSON.parse(ev.data); (handlers[m.type] || (() => {}))(m); };
    ws.start();
    return;
  }
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  S.ws = ws;
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); (handlers[m.type] || (() => {}))(m); };
  ws.onclose = () => { toast('Connection lost — reconnecting…'); setTimeout(() => { connect(); if (S.myName) setTimeout(() => send({ type: 'join', name: S.myName }), 400); }, 1500); };
}
const send = (m) => S.ws?.readyState === 1 && S.ws.send(JSON.stringify(m));
let lastSnapAt = performance.now();
const handlers = {
  hello(m) {
    S.roster = m.roster; S.images = m.images || {}; S.joinUrl = m.joinUrl; S.memory = m.memory;
    renderRoster(); renderAgentCards(); $('#joinUrl').textContent = m.joinUrl; $('#joinUrl2').textContent = m.joinUrl;
    const n = m.memory?.actors?.filter((a) => a.type === 'human').length || 0;
    $('#memNote').textContent = (n ? `🧠 Bruin memory loaded: the animals remember ${n} human${n > 1 ? 's' : ''}` : '') + (m.band ? ' · 📡 BAND room bridged' : '');
    if (S.images.hero) $('#joinBg').style.backgroundImage = `url(${S.images.hero})`;
  },
  images(m) { S.images = m.images; renderRoster(); renderAgentCards(); if (S.images.hero) $('#joinBg').style.backgroundImage = `url(${S.images.hero})`; },
  image(m) { S.images[m.name] = m.url; },
  joined(m) { S.me = m.id; S.myName = m.name; localStorage.setItem('ff_name', m.name); const o = S.chars.get(m.id); if (o) o.lbl.querySelector('.name').classList.add('me'); },
  state(m) {
    S.snap = m; S.phase = m.phase; S.goals = m.goals; lastSnapAt = performance.now();
    const seen = new Set();
    for (const c of m.chars) {
      seen.add(c.id); const o = ensureChar(c);
      o.from = { x: o.mesh.position.x, z: o.mesh.position.z, ry: o.mesh.rotation.y }; o.to = { x: c.x, z: c.z, ry: c.ry }; o.data = c;
    }
    for (const [id, o] of S.chars) if (!seen.has(id)) { scene.remove(o.mesh); o.lbl.remove(); S.chars.delete(id); }
    syncFires(m.fires);
    updateHud(m);
  },
  res: applyResources,
  match(m) { S.matchId = m.matchId; S.goals = m.goals; S.ledger = []; renderLedger(); $('#endScreen').classList.add('hidden'); if (stashObj) { scene.remove(stashObj); stashObj = null; } if (!window.FEASTFALL_STATIC) $('#dlLedger').href = `api/ledger/${m.matchId}.jsonl`; },
  ledger(m) { addLedger(m.entry); },
  ledger_bulk(m) { S.ledger = m.entries; renderLedger(); },
  reveal(m) {
    for (const e of m.entries) {
      const i = S.ledger.findIndex((x) => x.id === e.id);
      const full = { ...e, revealed: true };
      if (i >= 0) S.ledger[i] = full; else S.ledger.push(full);
    }
    S.revealed = (S.revealed || []).concat(m.entries);
    renderLedger();
    verifyCommitments(m.entries);
  },
  say(m) { showBubble(m.id, m.text, m.memory, m.species === 'human'); if (m.species !== 'human') speak(m); },
  event(m) { cinematic(m); },
  toast(m) { toast(m.text); },
  band_msg(m) { toast(`📡 BAND · ${m.name}: “${m.text}”`); },
  trust(m) { S.trust = m.trust; renderAgentCards(); },
  council(m) { if (m.open) openCouncil(m); else closeCouncil(m); },
  vote(m) { councilVote(m); },
  end(m) { showEnd(m.summary); },
  lobby() { $('#endScreen').classList.add('hidden'); if (stashObj) { scene.remove(stashObj); stashObj = null; } },
  bruin(m) { bruinEvent(m); },
  director(m) { syncDirector(m); },
};

// ================= JOIN =================
function portrait(id) { return S.images[id] ? `url(${S.images[id]})` : 'none'; }
function renderRoster() {
  $('#joinRoster').innerHTML = S.roster.map((a, i) => `<div class="r" style="--c:${a.color};animation-delay:${i * 80}ms"><div class="ph" style="background-image:${portrait(a.id)}">${S.images[a.id] ? '' : `<div style="font-size:42px;display:grid;place-items:center;height:100%">${EMOJI[a.species]}</div>`}</div><b>${a.name}</b><small>${a.title}</small></div>`).join('');
}
$('#nameInput').value = localStorage.getItem('ff_name') || '';
const QR_SRC = window.FEASTFALL_STATIC ? 'qr.svg' : 'api/qr';
$('#qrImg').src = QR_SRC; $('#qrBig').src = QR_SRC;
$('#joinForm').onsubmit = (e) => { e.preventDefault(); const name = $('#nameInput').value.trim(); if (!name) return; S.myName = name; send({ type: 'join', name }); enterGame(false); unlockAudio(); };
$('#tvBtn').onclick = () => { send({ type: 'spectate' }); enterGame(true); unlockAudio(); };
function enterGame(tv) {
  S.tv = tv; document.body.classList.toggle('tv', tv);
  $('#join').classList.add('hidden');
  $$('.hud').forEach((h) => h.classList.remove('hidden'));
  $('#director').classList.add('hidden');
  if (tv) { $('#director').classList.remove('hidden'); if (!$('.qr-float')) { const q = document.createElement('div'); q.className = 'qr-float hud'; q.innerHTML = `<img src="${QR_SRC}" alt="QR"/><div><b>Scan to play</b><br><span class="mono muted" style="font-size:11px">${esc(S.joinUrl)}</span></div>`; document.body.appendChild(q); } }
}

// ================= HUD =================
function updateHud(m) {
  const pill = $('#phasePill'); pill.textContent = m.phase.toUpperCase(); pill.className = 'pill ' + m.phase;
  $('#foodBar').style.width = Math.min(100, (m.granary.food / m.goals.food) * 100) + '%'; $('#foodTxt').textContent = `${m.granary.food}/${m.goals.food}`;
  $('#woodBar').style.width = Math.min(100, (m.granary.wood / m.goals.wood) * 100) + '%'; $('#woodTxt').textContent = `${m.granary.wood}/${m.goals.wood}`;
  $('#timeTxt').textContent = m.phase === 'lobby' ? 'dawn' : fmtT(m.timeLeft);
  const p = m.phase === 'lobby' ? 0 : 1 - m.timeLeft / m.dayLength; const ang = Math.PI * (1 - p);
  const dot = $('#sunDot'); dot.setAttribute('cx', 60 + Math.cos(ang) * 52); dot.setAttribute('cy', 60 - Math.sin(ang) * 52); dot.setAttribute('fill', p > 0.8 ? '#ff6b3d' : '#ffcf5a');
  $('#matchTxt').textContent = m.matchNo ? `Match #${m.matchNo}${m.drama ? ' · 🌶️' : ''}${m.speed > 1 ? ` · ${m.speed}×` : ''}` : 'Lobby — host presses Start';
  const humans = m.chars.filter((c) => c.k === 'human');
  $('#playersTxt').textContent = `${humans.length} human${humans.length === 1 ? '' : 's'} · ${m.chars.filter((c) => c.k === 'agent' && !c.ex).length} agents`;
  const me = m.chars.find((c) => c.id === S.me);
  if (me) {
    $('#invTxt').textContent = `🧺 ${me.f} food · ${me.w} wood · ⚡${me.e}${me.ex ? ' · EXILED 👻' : ''}`;
    const nearG = Math.hypot(me.x, me.z + 0) < 4.5;
    $('#interactLbl').textContent = (S.snap.fires.some((f) => Math.hypot(f.x - me.x, f.z - me.z) < f.r + 2)) ? 'Fight fire' : nearG && (me.f || me.w) ? 'Deposit' : 'Gather';
  }
  // day/night lighting
  const tcol = new THREE.Color().setHSL(0.08, 0.9, 0.62 - p * 0.18);
  sun.color.copy(tcol); sun.intensity = 2.4 - p * 1.3 + (m.phase === 'council' ? -0.8 : 0);
  skyMat.uniforms.top.value.setHSL(0.58 - p * 0.06, 0.6, 0.6 - p * 0.38);
  skyMat.uniforms.bottom.value.setHSL(0.07, 0.95, 0.72 - p * 0.25);
  scene.fog.color.copy(skyMat.uniforms.bottom.value);
  const sa = Math.PI * (0.15 + p * 0.7); sun.position.set(Math.cos(sa) * 60, Math.sin(sa) * 55 + 8, 30);
  hemi.intensity = 0.95 - p * 0.45;
  // granary piles
  syncPile(pile, Math.min(40, m.granary.food), (i) => new THREE.Mesh(new THREE.SphereGeometry(0.33, 6, 5), flat(foodColors[i % 5])));
  syncPile(woodPile, Math.min(30, m.granary.wood), () => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 6), flat(0x8b5a2b)); l.rotation.z = Math.PI / 2; return l; });
  if (Math.random() < 0.3) renderAgentCards();
}
function syncPile(group, n, mk) {
  while (group.children.length < n) { const i = group.children.length; const o = mk(i); const layer = Math.floor(i / 9); const k = i % 9; o.position.set((k % 3 - 1) * 0.7 + rand(-0.1, 0.1), 0.3 + layer * 0.45, (Math.floor(k / 3) - 1) * 0.7); o.castShadow = true; group.add(o); }
  while (group.children.length > n) group.remove(group.children[group.children.length - 1]);
}
function trustColor(t) { return t > 0.6 ? '#7bc96f' : t > 0.4 ? '#f4c95d' : '#ff4d5e'; }
function renderAgentCards() {
  const live = new Map((S.snap?.chars || []).map((c) => [c.id, c]));
  $('#agentCards').innerHTML = S.roster.map((a) => {
    const c = live.get(a.id) || {}; const t = S.trust[a.id];
    const speaking = S.lastSay[a.id] && Date.now() - S.lastSay[a.id] < 4000;
    return `<div class="acard ${c.ex ? 'exiled' : ''} ${speaking ? 'speaking' : ''}" style="--c:${a.color}" data-id="${a.id}">
      <div class="ph" style="background-image:${portrait(a.id)}"></div>
      <div><div class="nm">${EMOJI[a.species]} ${a.name} ${c.ex ? `<span class="role ${c.role}">${c.role === 'traitor' ? 'TRAITOR' : 'INNOCENT'}</span>` : `<small>${a.title}</small>`}</div>
      <div class="intent">${c.ex ? 'exiled from the island' : esc(c.i || a.goal)}</div>
      ${t != null ? `<div class="tbar" title="${a.name}'s trust in you: ${t}"><i style="width:${t * 100}%;background:${trustColor(t)}"></i></div>` : `<div class="tbar"><i style="width:${(c.e ?? 100)}%;background:#6ec6ff"></i></div>`}</div></div>`;
  }).join('');
}
$('#agentCards').onclick = (e) => { const c = e.target.closest('.acard'); if (c) S.focus = S.focus === c.dataset.id ? null : c.dataset.id; };

// ================= LEDGER =================
const DRAMA = /steal|ignite|accuse|council|vote|exile|witness|deceive|stash|gift|role|join/;
function addLedger(e) { S.ledger.push(e); if (S.ledger.length > 400) S.ledger.shift(); renderLedgerEntry(e, true); $('#ledgerCount').textContent = S.ledger.length; }
function passes(e) {
  if (S.filter === 'all') return true;
  if (S.filter === 'sealed') return e.sealed || e.revealed;
  if (S.filter === 'agents') return e.actor_type === 'agent' || e.sealed;
  if (S.filter === 'drama') return e.sealed || DRAMA.test(e.action || '');
}
function entryHtml(e) {
  if (e.sealed && !e.revealed) return `<div class="le sealed" data-id="${e.id}"><div class="h"><b>🔒 Sealed decision</b><span class="t">t+${Math.round(e.t)}s</span></div><div class="why">Someone made a private decision. Commitment:</div><div class="hash">sha256:${e.commitment.slice(0, 32)}…</div></div>`;
  const act = (e.action || '').replace('decide:', '');
  const scores = e.scores ? `<div class="scores">${e.scores.map((s) => `<span>${s.action} ${s.u}</span>`).join('')}</div>` : '';
  return `<div class="le ${e.revealed ? 'revealed' : ''}" style="--c:${e.color || '#888'}" data-id="${e.id}"><div class="h"><span>${EMOJI[e.species] || '🔓'} <b>${esc(e.actor_name)}</b><span class="act ${act}">${(e.action || '').startsWith('decide:') ? 'decides ' : ''}${act}</span>${e.target_name ? ` → ${esc(e.target_name)}` : ''}</span><span class="t">t+${Math.round(e.t)}s</span></div><div class="why">${esc(e.reason)}${e.utility != null ? ` · u=${e.utility}` : ''}</div>${scores}${e.revealed ? `<div class="verified" data-v="${e.id}">🔓 unsealed · verifying commitment…</div>` : ''}</div>`;
}
function renderLedgerEntry(e, prepend) {
  if (!passes(e)) return;
  const el = $('#ledger'); el.insertAdjacentHTML('afterbegin', entryHtml(e));
  while (el.children.length > 120) el.lastChild.remove();
}
function renderLedger() { $('#ledger').innerHTML = S.ledger.filter(passes).slice(-120).reverse().map(entryHtml).join(''); $('#ledgerCount').textContent = S.ledger.length; }
$('#ledgerFilters').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; S.filter = b.dataset.f; $$('#ledgerFilters button').forEach((x) => x.classList.toggle('on', x === b)); renderLedger(); };
async function sha256hex(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
async function verifyCommitments(entries) {
  for (const e of entries) {
    const { salt, commitment, ...entry } = e;
    let ok = false;
    try { if (crypto.subtle) ok = (await sha256hex(JSON.stringify(entry) + salt)) === commitment; } catch {}
    const tag = ok ? '✅ commitment verified (SHA-256 matches the sealed hash)' : crypto.subtle ? '⚠️ could not verify' : '🔓 unsealed (verify over HTTPS)';
    $$(`[data-v="${e.id}"]`).forEach((n) => (n.textContent = tag));
    e.verified = ok;
  }
  renderReveals();
}

// ================= BUBBLES & VOICE =================
function showBubble(id, text, memory, human) {
  const o = S.chars.get(id); if (!o) return;
  const b = o.lbl.querySelector('.bubble'); b.textContent = text; b.className = `bubble ${memory ? 'memory' : ''} ${human ? 'human' : ''}`;
  clearTimeout(o.bt); o.bt = setTimeout(() => b.classList.add('hidden'), memory ? 7000 : 4500);
  S.lastSay[id] = Date.now();
  if (memory) { S.focus = id; setTimeout(() => (S.focus = null), 5000); }
}
function loadVoices() { S.voices = speechSynthesis.getVoices().filter((v) => /en/i.test(v.lang)); }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
let audioUnlocked = false;
function unlockAudio() { if (audioUnlocked || !('speechSynthesis' in window)) return; audioUnlocked = true; const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
const VOICE_PREF = { bram: ['Daniel', 'Fred', 'Ralph', 'Alex'], juniper: ['Samantha', 'Karen', 'Moira', 'Victoria'], vex: ['Rishi', 'Aaron', 'Tom', 'Arthur'], marigold: ['Tessa', 'Fiona', 'Serena', 'Kathy'], pip: ['Junior', 'Albert', 'Zarvox', 'Bubbles'] };
function speak(m) {
  if (!S.voice || !('speechSynthesis' in window) || !m.voice) return;
  if (speechSynthesis.pending && !m.memory) return; // never let chatter pile up
  if (m.memory) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(m.text.replace(/\*[^*]+\*/g, ''));
  const prefs = VOICE_PREF[m.id] || [];
  const v = prefs.map((p) => S.voices.find((x) => x.name.includes(p))).find(Boolean) || S.voices[(m.id.charCodeAt(0) + m.id.length) % Math.max(1, S.voices.length)];
  if (v) u.voice = v;
  u.pitch = m.voice.pitch; u.rate = m.voice.rate; u.volume = 1;
  speechSynthesis.speak(u);
}
$('#voiceBtn').onclick = () => { S.voice = !S.voice; $('#voiceBtn').textContent = S.voice ? '🔊 Voices on' : '🔇 Voices off'; if (!S.voice) speechSynthesis.cancel(); };

// ================= CINEMATIC / TOAST =================
let cineTimer;
function cinematic(m) {
  const ALIAS = { council_skip: 'council', fire_out: 'wildfire', sunset: 'sunrise' };
  const img = m.image || S.images[m.kind] || S.images[ALIAS[m.kind]] || S.images.hero;
  $('#cineImg').style.backgroundImage = img ? `url(${img})` : '';
  $('#cineTitle').textContent = m.title; $('#cineBody').textContent = m.text;
  const c = $('#cinematic'); c.classList.add('hidden'); void c.offsetWidth; c.classList.remove('hidden');
  clearTimeout(cineTimer); cineTimer = setTimeout(() => c.classList.add('hidden'), m.kind === 'sunrise' ? 4500 : 6000);
  if (m.kind === 'wildfire') shake = 1;
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 2600); while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove(); }

// ================= COUNCIL =================
function openCouncil(m) {
  S.council = { ...m, votes: {} }; S.myVote = null;
  $('#council').classList.remove('hidden'); $('#voteFeed').innerHTML = ''; $('#councilWhy').textContent = 'Vote to exile someone — or skip. Exiled players reveal their role. Agents vote by their own trust.';
  const meIsVoter = S.me && m.candidates.some((c) => c.id === S.me);
  $('#ballot').innerHTML = m.candidates.filter((c) => c.id !== S.me).map((c) => `<div class="ballot-c" data-id="${c.id}" style="--c:${c.color}"><span class="votes" data-n="${c.id}"></span><div class="ph" style="background-image:${portrait(c.id)}">${S.images[c.id] ? '' : `<div style="font-size:32px;display:grid;place-items:center;height:100%">${EMOJI[c.species]}</div>`}</div><b>${esc(c.name)}</b><div class="pips" data-p="${c.id}"></div></div>`).join('');
  $('#skipVote').classList.toggle('hidden', !meIsVoter);
  if (!meIsVoter) $('#councilWhy').textContent += ' (You are spectating.)';
  const tick = () => { if (!S.council) return; const s = Math.max(0, Math.ceil((S.council.until - Date.now()) / 1000)); $('#councilTimer').textContent = s; if (s > 0) setTimeout(tick, 250); };
  tick();
}
$('#ballot').onclick = (e) => { const b = e.target.closest('.ballot-c'); if (!b || S.myVote || !S.me || S.tv) return; S.myVote = b.dataset.id; b.classList.add('picked'); send({ type: 'vote', target: b.dataset.id }); };
$('#skipVote').onclick = () => { if (S.myVote || !S.me) return; S.myVote = 'skip'; send({ type: 'vote', target: 'skip' }); $('#skipVote').classList.add('hidden'); };
function councilVote(m) {
  if (!S.council) return;
  const voter = S.snap?.chars.find((c) => c.id === m.voter);
  $('#voteFeed').insertAdjacentHTML('afterbegin', `<div>${EMOJI[voter?.sp] || '🧑'} <b>${esc(m.voterName)}</b> voted <b style="color:var(--ember)">${esc(m.targetName)}</b></div>`);
  if (m.target) { const p = $(`[data-p="${m.target}"]`); if (p) p.insertAdjacentHTML('beforeend', `<i style="--c:${voter?.c || '#fff'};background:${voter?.c || '#fff'}" title="${esc(m.voterName)}"></i>`); const n = $(`[data-n="${m.target}"]`); if (n) n.textContent = (Number(n.textContent) || 0) + 1; }
}
function closeCouncil() { S.council = null; setTimeout(() => $('#council').classList.add('hidden'), 1400); }

// ================= END SCREEN =================
function showEnd(sum) {
  S.lastSummary = sum;
  $('#endScreen').classList.remove('hidden');
  const img = S.images[sum.outcome] || S.images.feast;
  $('#endHero').style.backgroundImage = `linear-gradient(transparent 30%, rgba(12,17,30,1)), url(${img})`;
  const titles = { feast: '🦃 The Great Feast is served!', traitor: `🦊 ${sum.traitor_name} wins. The stash is full.`, starved: '🥶 The village goes hungry.', aborted: 'Match ended early' };
  $('#endTitle').textContent = titles[sum.outcome] || sum.outcome;
  $('#endSub').innerHTML = `The traitor was <b>${esc(sum.traitor_name)}</b>. Granary ${sum.food}/${sum.food_goal} food · ${sum.wood}/${sum.wood_goal} wood · hidden stash ${sum.stash} · ${sum.duration}s · ${sum.exiled.length ? 'exiled: ' + sum.exiled.map((id) => esc(sum.names[id] || id)).join(', ') : 'nobody exiled'}`;
  renderReveals();
  // learning
  const rows = [];
  for (const [aid, l] of Object.entries(sum.learn || {})) {
    const ch = Object.entries(l.changes).sort((a, b) => Math.abs(b[1][1] - b[1][0]) - Math.abs(a[1][1] - a[1][0])).slice(0, 2);
    rows.push(`<div style="margin-bottom:6px"><b>${EMOJI[S.roster.find((r) => r.id === aid)?.species]} ${sum.names[aid]}</b> <span class="tag ${l.reward > 0 ? 'ok' : ''}">reward ${l.reward > 0 ? '+1' : l.reward}</span>${ch.map(([act, [b, a]]) => `<div class="lrow"><span>${act}</span><div class="bar"><i style="width:${(a / 1.8) * 100}%"></i></div><span class="mono">${b}→${a}</span></div>`).join('') || '<div class="muted" style="font-size:12px">no change</div>'}</div>`);
  }
  $('#learnList').innerHTML = rows.join('');
  const humans = Object.keys(sum.names).filter((id) => id.startsWith('h_'));
  $('#trustList').innerHTML = humans.map((h) => {
    const vals = Object.keys(sum.trustEnd).map((a) => [a, sum.trustStart?.[a]?.[h] ?? 0.55, sum.trustEnd[a][h] ?? 0.55]);
    return `<div style="margin-bottom:8px"><b>🧑 ${esc(sum.names[h])}</b>${vals.map(([a, b, e]) => `<div class="lrow"><span>${EMOJI[S.roster.find((r) => r.id === a)?.species]} ${sum.names[a]}</span><div class="bar"><i style="width:${e * 100}%;background:${trustColor(e)}"></i></div><span class="mono">${Number(b).toFixed(2)}→${Number(e).toFixed(2)}</span></div>`).join('')}</div>`;
  }).join('') || '<div class="muted">No humans this match.</div>';
  $('#bruinStatus').textContent = 'queued'; $('#bruinStatus').className = 'tag';
  $('#bruinLog').textContent = 'Match ledger written → data/ledger/*.jsonl\nBruin pipeline starts automatically…\n';
  $('#memTable').innerHTML = '';
  $('#dlLedger').href = window.FEASTFALL_STATIC ? URL.createObjectURL(new Blob([S.ledger.map((e) => JSON.stringify(e)).join('\n')], { type: 'application/x-ndjson' })) : `api/ledger/${sum.match_id}.jsonl`;
}
function renderReveals() {
  const list = (S.revealed || []).filter((e) => !S.lastSummary || e.match_id === S.lastSummary.match_id || !e.match_id);
  $('#revealList').innerHTML = list.length ? list.map((e) => `<div class="le revealed" style="--c:${e.color}"><div class="h"><span>${EMOJI[e.species]} <b>${esc(e.actor_name)}</b><span class="act ${e.action}">${e.action}</span></span><span class="t">t+${Math.round(e.t)}s</span></div><div class="why">${esc(e.reason)}${e.amount ? ` · ${e.amount} food` : ''}</div><div class="verified">${e.verified ? '✅ SHA-256 commitment verified' : e.verified === false ? '⚠️ unverified' : '…'}</div></div>`).join('') : '<div class="muted">No sealed decisions this match.</div>';
}
$('#nextMatch').onclick = () => send({ type: 'director', cmd: 'start' });
$('#rerunBruin').onclick = () => send({ type: 'director', cmd: 'bruin' });

// ================= BRUIN / MEMORY =================
function bruinEvent(m) {
  const logs = [$('#bruinLog'), $('#memLog')];
  if (m.status === 'start') { logs.forEach((l) => (l.textContent = `$ bruin run bruin/feastfall_memory   (trigger: ${m.trigger})\n`)); $('#bruinStatus').textContent = 'running'; $('#bruinStatus').className = 'tag run'; toast('🧠 Bruin pipeline running…'); }
  if (m.status === 'log') logs.forEach((l) => { l.textContent += m.line + '\n'; l.scrollTop = l.scrollHeight; });
  if (m.status === 'done') {
    $('#bruinStatus').textContent = `done in ${(m.ms / 1000).toFixed(1)}s`; $('#bruinStatus').className = 'tag ok';
    S.memory = m.memory; renderMemory(); toast('🧠 Memory updated — the animals will remember this match');
  }
  if (m.status === 'error') { $('#bruinStatus').textContent = 'error'; logs.forEach((l) => (l.textContent += `\n✖ ${m.line || 'pipeline failed (exit ' + m.code + ')'}\n`)); }
}
function memTable(mem) {
  if (!mem?.actors?.length) return '<div class="muted">No memory yet — finish a match and run the pipeline.</div>';
  return `<table class="mtable"><tr><th>Actor</th><th>Reputation</th><th>Stole</th><th>Gifts</th><th>Exiled</th><th>Matches</th></tr>${mem.actors.slice(0, 14).map((a) => `<tr><td>${a.type === 'human' ? '🧑' : EMOJI[S.roster.find((r) => r.id === a.id)?.species] || '•'} ${esc(a.name || a.id)}</td><td><span class="rep"><i style="width:${a.reputation * 100}%;background:${trustColor(a.reputation)}"></i></span><span class="mono">${Number(a.reputation).toFixed(2)}</span></td><td>${a.steals ?? 0}</td><td>${a.gifts ?? 0}</td><td>${a.times_exiled ?? 0}</td><td>${a.matches_played ?? 0}</td></tr>`).join('')}</table><div class="muted" style="font-size:11px;margin-top:6px">generated ${esc(mem.generated_at || '')} · ${mem.matches?.length || 0} matches in DuckDB</div>`;
}
function renderMemory() { $('#memTable').innerHTML = memTable(S.memory); $('#memBody').innerHTML = memTable(S.memory); }
$('#memBtn').onclick = () => { renderMemory(); $('#memory').classList.remove('hidden'); };
$('#memRun').onclick = () => send({ type: 'director', cmd: 'bruin' });
$$('[data-close]').forEach((b) => (b.onclick = () => $('#' + b.dataset.close).classList.add('hidden')));
$('#qrBtn').onclick = () => $('#qrModal').classList.remove('hidden');
$('#helpBtn').onclick = () => $('#help').classList.remove('hidden');

// ================= DIRECTOR =================
$('#dirBtn').onclick = () => $('#director').classList.toggle('hidden');
$('#director').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const seg = b.closest('.seg');
  if (seg) send({ type: 'director', cmd: seg.dataset.cmd, value: Number(b.dataset.v) });
  else if (b.dataset.cmd) { if (b.dataset.cmd === 'end' && !confirm('End the match at sunset now?')) return; send({ type: 'director', cmd: b.dataset.cmd }); }
};
$('#dramaChk').onchange = (e) => send({ type: 'director', cmd: 'drama', value: e.target.checked });
function syncDirector(m) {
  $$('.seg[data-cmd="speed"] button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === m.speed));
  $$('.seg[data-cmd="length"] button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === m.dayLength));
  $('#dramaChk').checked = m.drama;
}

// ================= INPUT =================
const keys = new Set();
let lastDir = '0,0';
function sendDir() {
  let x = 0, z = 0;
  if (keys.has('w') || keys.has('arrowup')) z -= 1; if (keys.has('s') || keys.has('arrowdown')) z += 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1; if (keys.has('d') || keys.has('arrowright')) x += 1;
  const k = `${x},${z}`; if (k !== lastDir) { lastDir = k; send({ type: 'dir', x, z }); }
}
function act(a) { send({ type: 'act', act: a }); const b = $(`.act[data-act="${a}"]`); if (b) { b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 150); } }
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') { $('#chatForm').classList.add('hidden'); e.target.blur(); } return; }
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); sendDir(); e.preventDefault(); }
  if (!S.me) return;
  if (k === 'e' || k === ' ') { act('interact'); e.preventDefault(); }
  if (k === 'q') act('take'); if (k === 'f') act('eat'); if (k === 'g') act('gift');
  if (k === 't' || k === 'enter') { openChat(); e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); sendDir(); });
addEventListener('blur', () => { keys.clear(); sendDir(); });
$$('.act[data-act]').forEach((b) => (b.onclick = () => act(b.dataset.act)));
function openChat() { $('#chatForm').classList.remove('hidden'); $('#chatInput').focus(); }
$('#talkBtn').onclick = openChat;
$('#chatForm').onsubmit = (e) => { e.preventDefault(); const t = $('#chatInput').value.trim(); if (t) send({ type: 'chat', text: t }); $('#chatInput').value = ''; $('#chatForm').classList.add('hidden'); $('#chatInput').blur(); };
// voice input
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) $('#micBtn').title = 'Voice input needs Chrome';
$('#micBtn').onclick = () => {
  if (!SR) return toast('Voice input needs Chrome or Edge');
  const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
  $('#micBtn').classList.add('listening'); toast('🎙️ Listening… speak to the animals');
  r.onresult = (ev) => { const t = ev.results[0][0].transcript; toast(`🗣️ “${t}”`); send({ type: 'chat', text: t }); };
  r.onend = () => $('#micBtn').classList.remove('listening');
  r.onerror = () => { $('#micBtn').classList.remove('listening'); toast('Mic unavailable'); };
  r.start();
};
// click / tap to move
const ray = new THREE.Raycaster(); const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const ndc = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY, t: performance.now() }));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || !S.me) return; const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y); downAt = null; if (moved > 8) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3(); if (ray.ray.intersectPlane(ground, p)) { send({ type: 'move', x: p.x, z: p.z }); marker.position.set(p.x, 0.06, p.z); marker.material.opacity = 0.9; }
});
const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide })); marker.rotation.x = -Math.PI / 2; scene.add(marker);
let zoom = 1;
addEventListener('wheel', (e) => { if (e.target.closest('.panel, .overlay')) return; zoom = Math.min(2.2, Math.max(0.45, zoom * (1 + e.deltaY * 0.001))); }, { passive: true });

// ================= RENDER LOOP =================
let shake = 0; const clock = new THREE.Clock(); const tmp = new THREE.Vector3(); const camTarget = new THREE.Vector3(0, 0, 4);
function frame() {
  const dt = Math.min(0.05, clock.getDelta()); const t = clock.elapsedTime;
  const alpha = Math.min(1, (performance.now() - lastSnapAt) / 100);
  for (const [id, o] of S.chars) {
    const d = o.data; const m = o.mesh;
    m.position.x = o.from.x + (o.to.x - o.from.x) * alpha; m.position.z = o.from.z + (o.to.z - o.from.z) * alpha;
    let dr = o.to.ry - m.rotation.y; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2; m.rotation.y += dr * Math.min(1, dt * 10);
    const body = m.userData.body;
    if (d.ex) { o.exT += dt; m.position.y = Math.min(30, o.exT * o.exT * 2); m.rotation.y += dt * 4; m.visible = o.exT < 6; }
    else { o.exT = 0; m.visible = true; m.position.y = 0; }
    const walking = d.m && !d.ex;
    body.position.y = walking ? Math.abs(Math.sin(t * 12 + id.length)) * 0.25 : Math.sin(t * 2 + id.length) * 0.04;
    body.rotation.z = walking ? Math.sin(t * 12 + id.length) * 0.08 : 0;
    if (m.userData['foot-1']) { m.userData['foot-1'].position.z = 0.1 + (walking ? Math.sin(t * 12) * 0.35 : 0); m.userData['foot1'].position.z = 0.1 - (walking ? Math.sin(t * 12) * 0.35 : 0); }
    m.userData.basket.visible = d.f + d.w > 0;
    m.userData.ring.visible = id === S.me || id === S.focus;
    m.userData.ring.material.opacity = 0.5 + Math.sin(t * 5) * 0.3;
    if (body.userData.head && S.snap?.phase === 'council') body.userData.head.rotation.y = Math.sin(t * 1.3 + id.length) * 0.5;
    // label
    tmp.set(m.position.x, m.position.y + (d.sp === 'human' ? 4.1 : 3.9), m.position.z).project(camera);
    const vis = tmp.z < 1 && m.visible;
    o.lbl.style.display = vis ? '' : 'none';
    if (vis) o.lbl.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
    const emo = d.ex ? '👻' : d.e < 20 ? '😵' : d.f + d.w > 0 ? (d.f ? '🫐' : '🪵') : '';
    const eEl = o.lbl.querySelector('.emo'); if (eEl.textContent !== emo) eEl.textContent = emo;
  }
  // world anim
  flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.18; f.rotation.y = t * (1 + i); });
  fireLight.intensity = (S.snap?.phase === 'council' ? 70 : 28) + Math.sin(t * 13) * 5;
  for (const g of fireObjs) g.children.forEach((c, j) => { if (c.isMesh) { c.scale.y = 0.7 + Math.abs(Math.sin(t * 7 + j)) * 0.8; c.rotation.y = t * 2 + j; } else c.intensity = 50 + Math.sin(t * 17) * 15; });
  const wp = waterGeo.attributes.position; for (let i = 0; i < wp.count; i++) { const x = waterBase[i * 3], z = waterBase[i * 3 + 2]; wp.setY(i, Math.sin(x * 0.15 + t) * 0.18 + Math.cos(z * 0.12 + t * 0.8) * 0.18); } wp.needsUpdate = true;
  for (const f of res.fish.values()) { f.userData.ring.scale.setScalar(1 + (t % 2) * 0.6); f.userData.ring.material.opacity = 0.6 - (t % 2) * 0.3; f.userData.fish.position.y = 0.3 + Math.abs(Math.sin(t * 2)) * 0.8; }
  marker.material.opacity *= 0.95;
  if (stashObj) stashObj.rotation.y += dt * 0.5;
  // camera
  const me = S.me && S.chars.get(S.me);
  const focus = S.focus && S.chars.get(S.focus);
  let desired, look;
  if (S.snap?.phase === 'council') { const a = t * 0.15; desired = tmp.set(Math.cos(a) * 20, 16, 10 + Math.sin(a) * 20).clone(); look = new THREE.Vector3(0, 1.5, 10); }
  else if (focus) { desired = new THREE.Vector3(focus.mesh.position.x + 6, 8, focus.mesh.position.z + 11); look = focus.mesh.position.clone().setY(2); }
  else if (me && !S.tv && !me.data.ex) { desired = new THREE.Vector3(me.mesh.position.x, 24 * zoom, me.mesh.position.z + 22 * zoom); look = me.mesh.position.clone(); }
  else { const a = t * 0.05; desired = new THREE.Vector3(Math.cos(a) * 58 * zoom, 44 * zoom, Math.sin(a) * 58 * zoom); look = new THREE.Vector3(0, 0, 2); }
  camera.position.lerp(desired, Math.min(1, dt * 2.2)); camTarget.lerp(look, Math.min(1, dt * 3));
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.92; if (shake < 0.01) shake = 0; }
  camera.lookAt(camTarget);
  sun.target.position.copy(camTarget);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
connect(); frame(); loadModels();
if (new URLSearchParams(location.search).has('tv')) setTimeout(() => $('#tvBtn').click(), 600);
window.__ff = S; // debug handle
