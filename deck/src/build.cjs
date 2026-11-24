// FEASTFALL pitch deck builder (pptxgenjs). Post-processed by inject_motion.py for Morph + animations.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const gi = require("react-icons/gi");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const ROOT = "/Users/moorthy/Downloads/Projects/Multiplayer Hackathon/feastfall";
const OUT = path.join(__dirname, "Feastfall.raw.pptx");
const BUILD = __dirname;

const NAVY = "0F1626", CARD = "1A2438", CARD2 = "222E47", LINE = "2E3A57",
  EMBER = "FF7A3D", GOLD = "F4C95D", CREAM = "FFF4E0", MUTED = "AEB6C8", DEEP = "0A0F1A", SLATE = "6B7A99";

const THEME = {
  name: "Feastfall", headFontFace: "Bookman Old Style", bodyFontFace: "Calibri",
  colors: { dk1: NAVY, lt1: CREAM, dk2: CARD, lt2: GOLD, accent1: EMBER, accent2: GOLD, accent3: SLATE,
    accent4: "C2553A", accent5: "8FB59A", accent6: MUTED, hlink: GOLD, folHlink: EMBER },
};

// ---------- assets ----------
async function iconData(name, color, px = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(gi[name], { color: "#" + color, size: px }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

async function makeBackgrounds() {
  const r = rand(42);
  let dots = "";
  for (let i = 0; i < 70; i++) {
    const x = r() * 1920, y = 300 + r() * 780, rad = 1 + r() * 3, o = 0.15 + r() * 0.45;
    dots += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" fill="#ff7a3d" opacity="${o.toFixed(2)}"/>`;
  }
  const main = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <defs>
      <radialGradient id="g1" cx="8%" cy="115%" r="70%"><stop offset="0" stop-color="#ff7a3d" stop-opacity="0.22"/><stop offset="1" stop-color="#ff7a3d" stop-opacity="0"/></radialGradient>
      <radialGradient id="g2" cx="100%" cy="-10%" r="55%"><stop offset="0" stop-color="#f4c95d" stop-opacity="0.10"/><stop offset="1" stop-color="#f4c95d" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="#0f1626"/><rect width="1920" height="1080" fill="url(#g1)"/><rect width="1920" height="1080" fill="url(#g2)"/>
    <g opacity="0.55">${dots}</g></svg>`;
  // low-poly island silhouette for cover
  const poly = (pts, c) => `<polygon points="${pts}" fill="${c}"/>`;
  const island =
    poly("1020,1080 1180,880 1330,960 1480,800 1600,900 1760,820 1920,930 1920,1080", "#172036") +
    poly("1180,880 1260,1000 1330,960", "#1d2840") + poly("1480,800 1540,940 1600,900", "#222e47") +
    poly("1480,800 1420,930 1330,960", "#141c2f") + poly("1760,820 1820,960 1920,930", "#1d2840") +
    poly("1300,1080 1420,980 1560,1040 1700,960 1860,1030 1920,1000 1920,1080", "#0c1220") +
    poly("1560,1040 1640,1000 1700,960 1680,1080", "#111a2b");
  const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <defs>
      <radialGradient id="c1" cx="74%" cy="38%" r="55%"><stop offset="0" stop-color="#ff7a3d" stop-opacity="0.30"/><stop offset="0.5" stop-color="#ff7a3d" stop-opacity="0.08"/><stop offset="1" stop-color="#ff7a3d" stop-opacity="0"/></radialGradient>
      <radialGradient id="c2" cx="0%" cy="100%" r="60%"><stop offset="0" stop-color="#f4c95d" stop-opacity="0.10"/><stop offset="1" stop-color="#f4c95d" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="#0f1626"/><rect width="1920" height="1080" fill="url(#c1)"/><rect width="1920" height="1080" fill="url(#c2)"/>
    <g opacity="0.7">${dots}</g>${island}</svg>`;
  await sharp(Buffer.from(main)).jpeg({ quality: 85 }).toFile(path.join(BUILD, "bg_main.jpg"));
  await sharp(Buffer.from(cover)).jpeg({ quality: 85 }).toFile(path.join(BUILD, "bg_cover.jpg"));
}

// optional real images (portraits / event art / screenshots)
async function findImage(name) {
  for (const ext of ["png", "webp", "jpg", "jpeg"]) {
    const p = path.join(ROOT, "data", "images", `${name}.${ext}`);
    if (fs.existsSync(p)) {
      const out = path.join(BUILD, `img_${name}.jpg`);
      await sharp(p).resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(out);
      return out;
    }
  }
  return null;
}
function screenshots() {
  const d = path.join(ROOT, "docs", "screenshots");
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => /\.png$/i.test(f)).sort().map((f) => path.join(d, f));
}

(async () => {
  await makeBackgrounds();
  const I = {};
  const need = {
    GiBearFace: [NAVY, CREAM], GiDeerHead: [NAVY, CREAM], GiFoxHead: [NAVY, CREAM], GiOwl: [NAVY, CREAM], GiSquirrel: [NAVY, CREAM],
    GiCampfire: [NAVY], GiCycle: [NAVY], GiKnifeFork: [NAVY, GOLD], GiWheat: [GOLD], GiBackstab: [GOLD], GiDiscussion: [GOLD],
    GiScales: [GOLD, NAVY], GiFire: [NAVY], GiEyeTarget: [NAVY], GiShield: [NAVY], GiBrain: [NAVY], GiHand: [NAVY],
    GiPadlock: [GOLD], GiCheckMark: [NAVY], GiDatabase: [NAVY],
  };
  for (const [n, cols] of Object.entries(need)) for (const c of cols) I[n + "_" + c] = await iconData(n, c);

  const AG = [
    { key: "bram", name: "Bram", sp: "the bear", icon: "GiBearFace", role: "Builder · trusting", desc: "Fills the Granary. Gives everyone the benefit of the doubt." },
    { key: "juniper", name: "Juniper", sp: "the deer", icon: "GiDeerHead", role: "Detective · vigilant", desc: "Watches everything. Accuses first." },
    { key: "vex", name: "Vex", sp: "the fox", icon: "GiFoxHead", role: "Charming merchant", desc: "Trades and gifts to buy alliances." },
    { key: "marigold", name: "Marigold", sp: "the owl", icon: "GiOwl", role: "Elder", desc: "Calls the Council when suspicion boils." },
    { key: "pip", name: "Pip", sp: "the squirrel", icon: "GiSquirrel", role: "Chaotic · brave", desc: "Takes the risky jobs. Runs toward fire." },
  ];
  for (const a of AG) a.img = await findImage(a.key);
  const EV = {};
  for (const e of ["wildfire", "council", "exile", "feast", "traitor"]) EV[e] = await findImage(e);
  const SHOTS = screenshots();
  const sq = async (name) => {
    for (const ext of ["png", "webp", "jpg"]) {
      const p = path.join(ROOT, "data", "images", `${name}.${ext}`);
      if (fs.existsSync(p)) { const out = path.join(BUILD, `sq_${name}.jpg`); await sharp(p).resize(640, 640, { fit: "cover" }).jpeg({ quality: 82 }).toFile(out); return out; }
    }
    return null;
  };
  const HERO = await sq("hero"), FEASTART = await sq("feast");
  const shot = async (rel, name) => {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) return null;
    const out = path.join(BUILD, `shot_${name}.jpg`);
    await sharp(p).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 84 }).toFile(out);
    return out;
  };
  const GAME = await shot(fs.existsSync(path.join(ROOT, "docs/screenshots/gameplay-hd.jpg")) ? "docs/screenshots/gameplay-hd.jpg" : "docs/screenshots/gameplay.jpg", "gameplay"), COUNCIL = await shot("docs/screenshots/council.jpg", "council"), END = await shot("docs/screenshots/end.jpg", "end");
  let BG1 = null;
  const RENDER = ["docs/blender-render-cycles.png", "docs/blender-render-hd.png", "docs/blender-render.png"].map((r) => path.join(ROOT, r)).find((p) => fs.existsSync(p));
  if (RENDER) {
    const ov = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs>
      <linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0f1626" stop-opacity="0.97"/><stop offset="0.42" stop-color="#0f1626" stop-opacity="0.88"/><stop offset="1" stop-color="#0f1626" stop-opacity="0.25"/></linearGradient>
      <linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="#0f1626" stop-opacity="0"/><stop offset="1" stop-color="#0f1626" stop-opacity="0.7"/></linearGradient>
      <radialGradient id="e" cx="85%" cy="22%" r="40%"><stop offset="0" stop-color="#ff7a3d" stop-opacity="0.35"/><stop offset="1" stop-color="#ff7a3d" stop-opacity="0"/></radialGradient></defs>
      <rect width="1920" height="1080" fill="#ff7a3d" opacity="0.10"/><rect width="1920" height="1080" fill="url(#l)"/><rect width="1920" height="1080" fill="url(#v)"/><rect width="1920" height="1080" fill="url(#e)"/></svg>`;
    BG1 = path.join(BUILD, "bg_slide1.jpg");
    await sharp(RENDER).resize(1920, 1080, { fit: "cover" }).composite([{ input: Buffer.from(ov) }]).jpeg({ quality: 85 }).toFile(BG1);
  }

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = "FEASTFALL — pitch deck";
  pres.author = "Feastfall team";

  const footer = [
    { text: { text: "FEASTFALL", options: { x: 0.6, y: 5.27, w: 3, h: 0.22, fontSize: 9, bold: true, color: SLATE, charSpacing: 3, margin: 0, fontFace: "Calibri" } } },
  ];
  pres.defineSlideMaster({
    title: "COVER", background: { path: path.join(BUILD, "bg_cover.jpg") },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.55, y: 1.05, w: 5.9, h: 1.3, fontSize: 60, bold: true, color: GOLD, fontFace: THEME.headFontFace, valign: "middle", align: "left", margin: 0 }, text: "" } }],
  });
  pres.defineSlideMaster({
    title: "CONTENT", background: { path: path.join(BUILD, "bg_main.jpg") },
    objects: [...footer, { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.38, w: 8.0, h: 0.75, fontSize: 32, bold: true, color: CREAM, fontFace: THEME.headFontFace, valign: "middle", align: "left", margin: 0 }, text: "" } }],
    slideNumber: { x: 8.9, y: 5.27, w: 0.5, h: 0.22, fontSize: 9, color: SLATE, align: "right", fontFace: "Calibri" },
  });
  pres.defineSlideMaster({
    title: "CLOSE", background: { path: path.join(BUILD, "bg_cover.jpg") },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.45, w: 7.2, h: 1.0, fontSize: 44, bold: true, color: GOLD, fontFace: THEME.headFontFace, valign: "middle", align: "left", margin: 0 }, text: "" } }],
  });

  const S = pres.shapes;
  const T = (slide, text, o) => slide.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: "Calibri", color: CREAM, fontSize: 14, valign: "top" }, o));
  const card = (slide, o) => slide.addShape(S.ROUNDED_RECTANGLE, Object.assign({ fill: { color: CARD }, line: { color: LINE, width: 1 }, rectRadius: 0.1 }, o));
  const iconCircle = (slide, x, y, d, fill, img, name, pad = 0.2) => {
    slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name + "-c" });
    slide.addImage({ data: img, x: x + d * pad, y: y + d * pad, w: d * (1 - 2 * pad), h: d * (1 - 2 * pad), objectName: name + "-i" });
  };
  const arrow = (slide, x, y, w, h, o = {}) => slide.addShape(S.LINE, Object.assign({ x, y, w, h, line: { color: EMBER, width: 2, endArrowType: "triangle" } }, o));
  // recurring Morph motif: the ember ("!!" prefix forces Morph to pair it across slides)
  const ember = (slide, x, y, d, halo = false, icon = false, art = null) => {
    if (halo) {
      slide.addShape(S.OVAL, { x: x - d * 0.35, y: y - d * 0.35, w: d * 1.7, h: d * 1.7, fill: { color: EMBER, transparency: 88 }, line: { color: EMBER, width: 0, transparency: 100 }, objectName: "!!halo2" });
      slide.addShape(S.OVAL, { x: x - d * 0.15, y: y - d * 0.15, w: d * 1.3, h: d * 1.3, fill: { color: EMBER, transparency: 72 }, line: { color: EMBER, width: 0, transparency: 100 }, objectName: "!!halo1" });
    }
    slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color: EMBER }, line: { color: GOLD, width: 1.5 }, objectName: "!!ember" });
    if (art) slide.addImage({ path: art, x: x + d * 0.05, y: y + d * 0.05, w: d * 0.9, h: d * 0.9, rounding: true, objectName: "!!embericon" });
    else if (icon) slide.addImage({ data: I.GiCampfire_0F1626, x: x + d * 0.22, y: y + d * 0.2, w: d * 0.56, h: d * 0.56, objectName: "!!embericon" });
  };

  // ============ 1. TITLE ============
  pres.addSection({ title: "Hook" });
  let s = pres.addSlide({ masterName: "COVER", sectionTitle: "Hook" });
  if (BG1) s.background = { path: BG1 };
  ember(s, 7.45, 0.7, 1.75, true, true);
  s.addShape(S.ROUNDED_RECTANGLE, { x: 0.6, y: 0.55, w: 3.3, h: 0.36, fill: { color: EMBER }, line: { color: EMBER, width: 0 }, rectRadius: 0.18, objectName: "anim-1-fade-pill" });
  T(s, "CO-OP MULTIPLAYER GAME TRACK", { x: 0.6, y: 0.55, w: 3.3, h: 0.36, fontSize: 11, bold: true, color: NAVY, align: "center", valign: "middle", charSpacing: 2, objectName: "anim-1-fade-pilltext" });
  s.addText("FEASTFALL", { placeholder: "title", charSpacing: 3 });
  T(s, [{ text: "Thanksgiving, but everyone's lying —", options: { breakLine: true } }, { text: "and the animals remember what you did last year." }],
    { x: 0.6, y: 2.45, w: 5.9, h: 0.9, fontSize: 20, italic: true, fontFace: THEME.headFontFace, objectName: "anim-2-up-tagline" });
  T(s, "Multiplayer AI Hackathon · Finch.AI × Crewbase · AWS Builder Loft SF · Nov 23 2026", { x: 0.6, y: 3.5, w: 6.2, h: 0.3, fontSize: 12, color: MUTED, objectName: "anim-3-fade-event" });
  AG.forEach((a, i) => {
    const x = 0.6 + i * 1.0, y = 4.05;
    if (a.img) s.addImage({ path: a.img, x, y, w: 0.72, h: 0.72, rounding: true, objectName: `anim-${4 + i}-up-badge${i}` });
    else iconCircle(s, x, y, 0.72, CARD2, I[a.icon + "_FFF4E0"], `anim-${4 + i}-up-badge${i}`, 0.18);
    T(s, a.name, { x: x - 0.15, y: y + 0.78, w: 1.02, h: 0.25, fontSize: 10, color: GOLD, bold: true, align: "center", objectName: `anim-${4 + i}-up-badgename${i}` });
  });
  s.addNotes("FEASTFALL. Thanksgiving, but everyone's lying — and the animals remember what you did last year. Built today at the Multiplayer AI Hackathon, Co-op Multiplayer Game track. Two or more humans join from any phone, five AI animals share the island, and one of them is lying. Hold here ~15s, then advance.");

  // ============ 2. PROBLEM ============
  pres.addSection({ title: "Problem" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Problem" });
  ember(s, 9.0, 0.53, 0.42);
  s.addText("NPCs forget you", { placeholder: "title" });
  T(s, "…and AI never sits at the table.", { x: 0.6, y: 1.12, w: 8.0, h: 0.45, fontSize: 20, italic: true, color: EMBER, fontFace: THEME.headFontFace, objectName: "anim-1-fade-sub" });
  T(s, "0", { x: 0.6, y: 1.75, w: 2.5, h: 2.1, fontSize: 140, bold: true, color: GOLD, fontFace: THEME.headFontFace, valign: "middle", objectName: "anim-2-up-zero" });
  T(s, "grudges held by today's NPCs", { x: 0.6, y: 3.9, w: 2.5, h: 0.6, fontSize: 16, color: CREAM, objectName: "anim-2-up-zerolabel" });
  [["GiCycle", "Scripted & amnesiac", "Betray them or save them: every NPC resets when the match ends."],
   ["GiKnifeFork", "AI is a spectator", "Party games are human-only. AI never votes, lies, or shares the feast."]].forEach(([ic, h, b], i) => {
    const x = 3.55 + i * 3.0, y = 1.8, g = `anim-${3 + i}-up-card${i}`;
    card(s, { x, y, w: 2.75, h: 2.9, objectName: g + "-bg" });
    iconCircle(s, x + 0.3, y + 0.3, 0.75, EMBER, I[ic + "_0F1626"], g);
    T(s, h, { x: x + 0.3, y: y + 1.25, w: 2.2, h: 0.4, fontSize: 18, bold: true, objectName: g + "-h" });
    T(s, b, { x: x + 0.3, y: y + 1.7, w: 2.2, h: 1.05, fontSize: 14, color: MUTED, objectName: g + "-b" });
  });
  s.addNotes("The problem. NPCs are scripted and amnesiac — betray them or save them, they reset when the match ends. And AI is always a spectator: party games are human-only. Zero grudges. We wanted AI that sits at the table, plays, lies, votes — and remembers you.");

  // ============ 3. THE GAME ============
  pres.addSection({ title: "Game" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Game" });
  ember(s, 9.0, 0.53, 0.42);
  s.addText("One island. One feast. One liar.", { placeholder: "title" });
  T(s, "2+ humans join by QR  ·  5 AI animals  ·  fill the Granary before sunset  ·  one agent is secretly the traitor",
    { x: 0.6, y: 1.12, w: 8.8, h: 0.35, fontSize: 14, color: MUTED, objectName: "anim-1-fade-sub" });
  const loop = [["GiWheat", "Gather", "berries, fish, wood"], ["GiBackstab", "Betray", "steal when unseen"], ["GiDiscussion", "Accuse", "out loud, in voice"], ["GiScales", "Council", "everyone votes"], ["GiKnifeFork", "Feast", "Granary full = win"]];
  loop.forEach(([ic, h, b], i) => {
    const d = 0.95, x = 0.85 + i * 1.83, y = 1.6, g = `anim-${2 + i}-up-node${i}`;
    s.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color: CARD }, line: { color: GOLD, width: 2 }, objectName: g + "-c" });
    s.addImage({ data: I[ic + "_F4C95D"], x: x + 0.23, y: y + 0.23, w: d - 0.46, h: d - 0.46, objectName: g + "-i" });
    T(s, h, { x: x - 0.4, y: y + d + 0.08, w: d + 0.8, h: 0.35, fontSize: 16, bold: true, align: "center", objectName: g + "-h" });
    T(s, b, { x: x - 0.4, y: y + d + 0.43, w: d + 0.8, h: 0.28, fontSize: 11, color: MUTED, align: "center", objectName: g + "-b" });
    if (i < 4) arrow(s, x + d + 0.12, y + d / 2, 1.83 - d - 0.24, 0, { objectName: `anim-${2 + i}-fade-arrow${i}` });
  });
  if (GAME) {
    s.addShape(S.ROUNDED_RECTANGLE, { x: 0.56, y: 3.41, w: 3.33, h: 1.74, fill: { color: CARD2 }, line: { color: GOLD, width: 1.5 }, rectRadius: 0.05, objectName: "anim-7-up-shot-f" });
    s.addImage({ path: GAME, x: 0.6, y: 3.45, w: 3.25, h: 3.25 * 784 / 1538, objectName: "anim-7-up-shot", altText: "Feastfall gameplay: 3D island, decision ledger and agent cards" });
  }
  [["wildfire", "GiFire", "WILDFIRE", "set by the traitor as a distraction"], ["council", "GiScales", "COUNCIL VOTE", "Marigold calls it · exile reveals roles"]].forEach(([ev, ic, h, b], i) => {
    const x = 4.15, y = 3.55 + i * 0.8, g = `anim-${8 + i}-up-chip${i}`;
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: 5.25, h: 0.6, fill: { color: CARD2 }, line: { color: i ? GOLD : EMBER, width: 1.5 }, rectRadius: 0.3, objectName: g + "-bg" });
    if (EV[ev]) s.addImage({ path: EV[ev], x: x + 0.08, y: y + 0.06, w: 0.48, h: 0.48, rounding: true, objectName: g + "-img" });
    else iconCircle(s, x + 0.08, y + 0.06, 0.48, i ? GOLD : EMBER, I[ic + "_0F1626"], g, 0.18);
    T(s, [{ text: h + "  ", options: { bold: true, color: i ? GOLD : EMBER } }, { text: b, options: { color: CREAM } }], { x: x + 0.7, y, w: 4.45, h: 0.6, fontSize: 13, valign: "middle", objectName: g + "-t" });
  });
  s.addNotes("The loop: gather berries, fish and wood into the Granary before sunset. One agent — random every match — is the traitor: it steals only when nobody is watching, frames others, and can set a wildfire as a distraction. Agents accuse out loud, Marigold calls a council vote, humans and agents exile someone, and the role is revealed. The screenshot is a real match: the council caught Juniper, and she was the traitor. Agents cause the world events — not a script.");

  // ============ 4. AGENTS ============
  pres.addSection({ title: "Agents" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Agents" });
  ember(s, 9.0, 0.53, 0.42);
  s.addText("Five animals. Five agendas.", { placeholder: "title" });
  AG.forEach((a, i) => {
    const w = 1.6, x = 0.6 + i * 1.8, y = 1.3, g = `anim-${1 + i}-up-agent${i}`;
    card(s, { x, y, w, h: 3.3, objectName: g + "-bg" });
    if (a.img) s.addImage({ path: a.img, x: x + 0.3, y: y + 0.2, w: 1.0, h: 1.0, rounding: true, objectName: g + "-img" });
    else iconCircle(s, x + 0.3, y + 0.2, 1.0, i % 2 ? GOLD : EMBER, I[a.icon + "_0F1626"], g, 0.16);
    T(s, [{ text: a.name, options: { breakLine: true, fontSize: 18, bold: true, color: CREAM } }, { text: a.sp, options: { fontSize: 11, italic: true, color: MUTED } }],
      { x: x + 0.1, y: y + 1.3, w: w - 0.2, h: 0.6, align: "center", objectName: g + "-n" });
    T(s, a.role, { x: x + 0.1, y: y + 1.95, w: w - 0.2, h: 0.3, fontSize: 12, bold: true, color: GOLD, align: "center", objectName: g + "-r" });
    T(s, a.desc, { x: x + 0.15, y: y + 2.3, w: w - 0.3, h: 0.9, fontSize: 12, color: MUTED, align: "center", objectName: g + "-d" });
  });
  T(s, "One of them is the traitor — random every match. Each speaks in its own synthesized voice.", { x: 0.6, y: 4.78, w: 8.8, h: 0.35, fontSize: 14, italic: true, color: EMBER, objectName: "anim-6-fade-foot" });
  s.addNotes("Meet the five. Bram the bear builds and trusts. Juniper the deer is the detective — vigilant, accuses first. Vex the fox is a charming merchant who gifts to buy alliances. Marigold the owl is the elder who calls councils. Pip the squirrel is chaotic and brave. Any one of them can be the traitor, and each has its own synthesized voice.");

  // ============ 5. EMERGENCE ============
  pres.addSection({ title: "How it works" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "How it works" });
  ember(s, 9.0, 0.53, 0.42);
  s.addText("Agents only know what they see", { placeholder: "title" });
  [["GiEyeTarget", "Perception", "line of sight only — no omniscience"], ["GiShield", "Trust", "per-player score: thefts, deposits, gifts"], ["GiBrain", "Utility", "every possible action scored"], ["GiHand", "Action", "gather · steal · gift · accuse · vote · wildfire"]].forEach(([ic, h, b], i) => {
    const x = 0.6 + i * 2.27, y = 1.3, w = 2.0, g = `anim-${1 + i}-up-step${i}`;
    card(s, { x, y, w, h: 1.5, objectName: g + "-bg" });
    iconCircle(s, x + 0.2, y + 0.2, 0.5, EMBER, I[ic + "_0F1626"], g, 0.17);
    T(s, h, { x: x + 0.8, y: y + 0.22, w: 1.15, h: 0.45, fontSize: 17, bold: true, valign: "middle", objectName: g + "-h" });
    T(s, b, { x: x + 0.2, y: y + 0.82, w: w - 0.35, h: 0.6, fontSize: 12, color: MUTED, objectName: g + "-b" });
    if (i < 3) arrow(s, x + w + 0.03, y + 0.75, 0.21, 0, { objectName: `anim-${2 + i}-fade-sarrow${i}` });
  });
  s.addShape(S.ROUNDED_RECTANGLE, { x: 0.6, y: 3.1, w: 5.6, h: 1.85, fill: { color: DEEP }, line: { color: LINE, width: 1 }, rectRadius: 0.08, objectName: "anim-5-up-ledger-bg" });
  T(s, "DECISION LEDGER · LIVE", { x: 0.85, y: 3.25, w: 4, h: 0.3, fontSize: 11, bold: true, color: GOLD, charSpacing: 2, objectName: "anim-5-up-ledger-h" });
  const mono = (txt, col) => ({ text: txt, options: { color: col, breakLine: true } });
  T(s, [mono("t=142  Juniper   ACCUSE Vex    u=0.86", CREAM), mono("t=150  Marigold  COUNCIL       u=0.91", CREAM), { text: "t=163  ███████   SEALED  sha256:9f3a…c21e", options: { color: EMBER } }],
    { x: 0.85, y: 3.65, w: 5.2, h: 1.15, fontSize: 13, fontFace: "Courier New", paraSpaceAfter: 6, objectName: "anim-6-fade-ledger-rows" });
  s.addImage({ data: I.GiPadlock_F4C95D, x: 6.55, y: 3.15, w: 0.55, h: 0.55, objectName: "anim-7-up-lock" });
  T(s, "Commit → reveal", { x: 7.2, y: 3.18, w: 2.3, h: 0.5, fontSize: 20, bold: true, color: GOLD, valign: "middle", objectName: "anim-7-up-lockh" });
  T(s, "Secret decisions are SHA-256 committed, then revealed at the end — proof the AI didn't cheat.", { x: 6.55, y: 3.85, w: 2.85, h: 1.1, fontSize: 14, color: CREAM, objectName: "anim-7-up-lockb" });
  s.addNotes("How agents decide. They only know what they see — line of sight, no omniscience. Each keeps a trust score toward every player, updated by witnessed thefts, deposits and gifts. Every possible action gets a utility score, and the best one wins. Every decision lands in the live decision ledger with its scores. The traitor's secret moves are sealed with a SHA-256 commitment and revealed at the end — commit-reveal proves the AI didn't cheat.");

  // ============ 6. THE GRUDGE ============
  pres.addSection({ title: "Demo" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Demo" });
  s.addText("The grudge", { placeholder: "title" });
  ember(s, 7.55, 0.62, 0.26);
  s.addShape(S.ROUNDED_RECTANGLE, { x: 7.95, y: 0.57, w: 1.45, h: 0.36, fill: { color: CARD2 }, line: { color: EMBER, width: 1.5 }, rectRadius: 0.18, objectName: "anim-1-fade-live" });
  T(s, "LIVE DEMO", { x: 7.95, y: 0.57, w: 1.45, h: 0.36, fontSize: 11, bold: true, color: EMBER, align: "center", valign: "middle", charSpacing: 2, objectName: "anim-1-fade-livet" });
  s.addShape(S.ROUNDED_RECTANGULAR_CALLOUT, { x: 0.6, y: 1.35, w: 5.6, h: 2.35, fill: { color: CREAM }, line: { color: GOLD, width: 2 }, objectName: "anim-2-up-bubble" });
  T(s, "“Moorthy. Last feast: 6 stolen. I keep records. I am watching you.”", { x: 0.95, y: 1.5, w: 4.9, h: 2.05, fontSize: 25, italic: true, color: NAVY, fontFace: THEME.headFontFace, valign: "middle", objectName: "anim-2-up-quote" });
  const jun = AG[1];
  if (jun.img) s.addImage({ path: jun.img, x: 0.6, y: 4.1, w: 0.8, h: 0.8, rounding: true, objectName: "anim-3-up-jun" });
  else iconCircle(s, 0.6, 4.1, 0.8, GOLD, I.GiDeerHead_0F1626, "anim-3-up-jun", 0.16);
  T(s, [{ text: "Juniper the deer · match 2", options: { bold: true, color: GOLD, breakLine: true } }, { text: "golden memory bubble, her own voice, camera focus", options: { color: MUTED } }],
    { x: 1.55, y: 4.15, w: 4.6, h: 0.7, fontSize: 14, objectName: "anim-3-up-junt" });
  if (COUNCIL) {
    s.addShape(S.ROUNDED_RECTANGLE, { x: 6.51, y: 1.31, w: 2.93, h: 2.93 * 470 / 923 + 0.08, fill: { color: CARD2 }, line: { color: GOLD, width: 1.5 }, rectRadius: 0.05, objectName: "anim-4-up-council-f" });
    s.addImage({ path: COUNCIL, x: 6.55, y: 1.35, w: 2.85, h: 2.85 * 470 / 923, objectName: "anim-4-up-council", altText: "The Council ballot with agent portraits and votes" });
  }
  T(s, "The council ballot: every agent votes, with a reason", { x: 6.55, y: 2.9, w: 2.85, h: 0.45, fontSize: 11, italic: true, color: MUTED, objectName: "anim-4-up-council-c" });
  card(s, { x: 6.55, y: 3.5, w: 2.85, h: 1.4, objectName: "anim-5-up-trust-bg" });
  T(s, "TRUST TOWARD MOORTHY", { x: 6.75, y: 3.6, w: 2.5, h: 0.25, fontSize: 10, bold: true, color: GOLD, charSpacing: 2, objectName: "anim-5-up-trust-h" });
  AG.forEach((a, i) => {
    const y = 3.92 + i * 0.17;
    s.addShape(S.ROUNDED_RECTANGLE, { x: 6.75, y, w: 1.3, h: 0.09, fill: { color: LINE }, line: { color: LINE, width: 0 }, rectRadius: 0.045, objectName: `anim-6-up-tt${i}` });
    s.addShape(S.ROUNDED_RECTANGLE, { x: 6.75, y, w: [0.32, 0.12, 0.38, 0.24, 0.42][i], h: 0.09, fill: { color: "D9462E" }, line: { color: "D9462E", width: 0 }, rectRadius: 0.045, objectName: `anim-6-up-tf${i}` });
  });
  T(s, "Every agent's trust bar toward you starts red.", { x: 8.2, y: 3.88, w: 1.1, h: 0.9, fontSize: 11, color: CREAM, objectName: "anim-6-up-trust-t" });
  s.addNotes("SWITCH TO LIVE DEMO HERE (http://localhost:8787/?tv). In match one, Moorthy stole six berries while Juniper was watching. The Bruin pipeline turned that into memory. Join as Moorthy in match two: Juniper's golden memory bubble appears, the camera focuses on her, and she says out loud: 'Moorthy. Last feast: 6 stolen. I keep records. I am watching you.' Every agent's trust bar toward you starts red. In one live test the council even exiled Moorthy because of the grudge.");

  // ============ 7. ARCHITECTURE ============
  pres.addSection({ title: "Architecture" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
  ember(s, 9.0, 0.53, 0.42);
  s.addText("How it fits together", { placeholder: "title" });
  const COLX = [0.6, 2.92, 5.24, 7.56], BW = 1.85;
  const box = (c, y, h, head, body, border, g, tag) => {
    const x = COLX[c];
    card(s, { x, y, w: BW, h, line: { color: border, width: border === LINE ? 1 : 2 }, objectName: g + "-bg" });
    T(s, head, { x: x + 0.15, y: y + 0.12, w: BW - 0.3, h: 0.32, fontSize: 14, bold: true, color: border === LINE ? CREAM : border, objectName: g + "-h" });
    T(s, body, { x: x + 0.15, y: y + 0.46, w: BW - 0.3, h: h - 0.52, fontSize: 11, color: MUTED, objectName: g + "-b" });
    if (tag) {
      s.addShape(S.ROUNDED_RECTANGLE, { x: x + BW - 0.9, y: y - 0.13, w: 0.8, h: 0.24, fill: { color: EMBER }, line: { color: EMBER, width: 0 }, rectRadius: 0.12, objectName: g + "-tag" });
      T(s, "SPONSOR", { x: x + BW - 0.9, y: y - 0.13, w: 0.8, h: 0.24, fontSize: 8, bold: true, color: NAVY, align: "center", valign: "middle", charSpacing: 1, objectName: g + "-tagt" });
    }
  };
  box(0, 1.3, 1.15, "Blender", "procedural island + props, exported as GLB", LINE, "anim-1-up-blender");
  box(1, 1.3, 1.15, "Phones + TV", "Three.js · GLTFLoader · QR join · voices", LINE, "anim-2-up-clients");
  box(2, 1.3, 1.15, "Game server", "Node + Express · 10 Hz sim · utility-AI agents", GOLD, "anim-3-up-server");
  box(3, 1.3, 1.15, "BAND room", "Narrator agent posts drama; agents answer back", LINE, "anim-4-up-band");
  box(0, 3.15, 1.1, "Runware API", "14 images in ~2.5 s, cached to disk", EMBER, "anim-5-up-runware", true);
  box(1, 3.15, 1.1, "ledger.jsonl", "every event + utility scores from the server", LINE, "anim-6-up-ledger");
  box(2, 3.15, 1.1, "Bruin pipeline", "DuckDB · 6 assets · 27 checks · ~0.1 s", EMBER, "anim-7-up-bruin", true);
  box(3, 3.15, 1.1, "reputation.json", "trust + policy priors, hot-loaded next match", GOLD, "anim-8-up-rep");
  const lab = (txt, x, n) => T(s, txt, { x, y: 1.55, w: 0.47, h: 0.22, fontSize: 9, color: GOLD, italic: true, align: "center", objectName: `anim-${n}-fade-lab${n}` });
  arrow(s, 2.49, 1.875, 0.39, 0, { objectName: "anim-2-fade-glb" }); lab("GLB", 2.45, 2);
  s.addShape(S.LINE, { x: 4.81, y: 1.875, w: 0.39, h: 0, line: { color: EMBER, width: 2, beginArrowType: "triangle", endArrowType: "triangle" }, objectName: "anim-3-fade-ws" }); lab("WS", 4.77, 3);
  s.addShape(S.LINE, { x: 7.13, y: 1.875, w: 0.39, h: 0, line: { color: EMBER, width: 2, beginArrowType: "triangle", endArrowType: "triangle" }, objectName: "anim-4-fade-bandarr" }); lab("2-way", 7.09, 4);
  arrow(s, 2.1, 2.52, 1.1, 0.56, { flipV: true, objectName: "anim-5-fade-dimg" });
  arrow(s, 4.5, 2.52, 1.1, 0.56, { flipH: true, objectName: "anim-6-fade-dled" });
  arrow(s, 4.81, 3.7, 0.39, 0, { objectName: "anim-7-fade-a2" });
  arrow(s, 7.13, 3.7, 0.39, 0, { objectName: "anim-8-fade-a3" });
  s.addShape(S.LINE, { x: 6.8, y: 2.52, w: 1.1, h: 0.56, line: { color: GOLD, width: 2, beginArrowType: "triangle", dashType: "dash" }, objectName: "anim-8-fade-dhot" });
  T(s, [{ text: "Blender  ", options: { bold: true, color: CREAM } }, { text: "procedural island, granary, campfire, pier, autumn trees, bushes and props as GLB; Three.js GLTFLoader with a procedural fallback.", options: { color: MUTED, breakLine: true } },
        { text: "BAND  ", options: { bold: true, color: CREAM } }, { text: "the Feastfall Narrator posts events, accusations, votes, exiles and memory callouts to a BAND room. Ask “who is the traitor?” and an island agent answers.", options: { color: MUTED } }],
    { x: 0.6, y: 4.42, w: 8.8, h: 0.8, fontSize: 11, paraSpaceAfter: 3, objectName: "anim-9-fade-cap" });
  s.addNotes("Architecture. Blender generates the procedural island — granary, campfire, pier, autumn trees, props — exported as GLB and loaded by Three.js GLTFLoader, with a procedural fallback. Phones and the TV are Three.js clients over WebSocket to a Node + Express server running an authoritative 10 Hz simulation with utility-AI agents. A two-way BAND bridge: the Feastfall Narrator agent posts events, accusations, votes, exiles and memory callouts into a BAND room, and BAND users can ask 'who is the traitor?' and an island agent answers back. Every event goes to the JSONL ledger; Bruin runs 6 assets and 27 quality checks in about 0.1 s and writes reputation.json plus policy priors, hot-loaded for the next match. Runware generated all 14 images in about 2.5 seconds.");

  // ============ 8. LEARNING LOOP ============
  pres.addSection({ title: "Learning" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Learning" });
  ember(s, 9.0, 0.53, 0.42);
  s.addText("Every match teaches the next one", { placeholder: "title" });
  const asset = (x, y, w, name, col, g) => {
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h: 0.46, fill: { color: CARD }, line: { color: col, width: 1.5 }, rectRadius: 0.08, objectName: g + "-bg" });
    T(s, name, { x: x + 0.12, y, w: w - 0.24, h: 0.46, fontSize: 13, fontFace: "Courier New", color: CREAM, valign: "middle", objectName: g + "-t" });
  };
  T(s, "BRUIN PIPELINE · DUCKDB", { x: 0.6, y: 1.22, w: 4.4, h: 0.28, fontSize: 11, bold: true, color: GOLD, charSpacing: 2, objectName: "anim-1-fade-bh" });
  asset(0.6, 1.62, 1.9, "raw.ledger", SLATE, "anim-1-up-a0");
  arrow(s, 1.55, 2.12, 0, 0.32, { objectName: "anim-2-fade-aa" });
  asset(0.6, 2.48, 1.9, "raw.matches", SLATE, "anim-2-up-a1");
  ["mart.reputation", "mart.agent_policy", "mart.match_summary"].forEach((m, i) => {
    const y = 1.62 + i * 0.66;
    asset(2.95, y, 2.25, m, EMBER, `anim-${3 + i}-up-m${i}`);
    arrow(s, 2.55, Math.min(2.71, y + 0.23), 0.36, Math.abs(y + 0.23 - 2.71), { flipV: y + 0.23 < 2.71, objectName: `anim-${3 + i}-fade-ma${i}` });
  });
  T(s, "Column quality checks", { x: 0.6, y: 3.72, w: 2.6, h: 0.35, fontSize: 14, bold: true, color: CREAM, valign: "middle", objectName: "anim-6-fade-qc" });
  ["not_null", "accepted_values", "range"].forEach((c, i) => {
    const w = [1.0, 1.55, 0.8][i], x = [0.6, 1.7, 3.35][i];
    s.addShape(S.ROUNDED_RECTANGLE, { x, y: 4.12, w, h: 0.32, fill: { color: CARD2 }, line: { color: GOLD, width: 1 }, rectRadius: 0.16, objectName: `anim-6-up-chk${i}` });
    T(s, c, { x, y: 4.12, w, h: 0.32, fontSize: 11, fontFace: "Courier New", color: GOLD, align: "center", valign: "middle", objectName: `anim-6-up-chkt${i}` });
  });
  T(s, "Auto-runs at every match end. Policies reward-updated: utility-AI + tabular reinforcement of action weights. No LLM — runs offline.",
    { x: 0.6, y: 4.55, w: 4.65, h: 0.62, fontSize: 12, color: MUTED, objectName: "anim-7-fade-pol" });
  if (END) {
    s.addShape(S.ROUNDED_RECTANGLE, { x: 5.41, y: 1.21, w: 4.03, h: 3.95 * 784 / 1538 + 0.08, fill: { color: CARD2 }, line: { color: GOLD, width: 1.5 }, rectRadius: 0.05, objectName: "anim-2-up-end-f" });
    s.addImage({ path: END, x: 5.45, y: 1.25, w: 3.95, h: 3.95 * 784 / 1538, objectName: "anim-2-up-end", altText: "Feastfall end screen: unsealed decisions, learned policy bars, Bruin log, reputation table" });
  }
  T(s, "Real end screen: unsealed traitor moves, learned policy, live Bruin log, reputation table", { x: 5.45, y: 3.35, w: 3.95, h: 0.45, fontSize: 11, italic: true, color: MUTED, objectName: "anim-3-up-end-c" });
  [["6", "assets"], ["27", "quality checks"], ["~0.1 s", "per run"]].forEach(([n, l], i) => {
    const x = 5.45 + i * 1.375;
    T(s, n, { x, y: 3.95, w: 1.25, h: 0.55, fontSize: 30, bold: true, color: GOLD, fontFace: THEME.headFontFace, objectName: `anim-${8 + i}-up-st${i}` });
    T(s, l, { x, y: 4.5, w: 1.25, h: 0.3, fontSize: 12, color: CREAM, objectName: `anim-${8 + i}-up-stl${i}` });
  });
  s.addNotes("The learning loop is the moat. Every event lands in a JSONL ledger. At every match end a Bruin pipeline on DuckDB builds raw.ledger, raw.matches and the reputation, agent_policy and match_summary marts — 6 assets and 27 column quality checks in about a tenth of a second. Out comes reputation.json and policy priors the server hot-loads. Policies are reward-updated: utility AI plus tabular reinforcement of action weights. No LLM, runs offline. The screenshot is the real end screen: unsealed traitor decisions, learned policy bars, the live Bruin log and the reputation table.");

  // ============ 9. CHECKLIST ============
  pres.addSection({ title: "Judging" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Judging" });
  ember(s, 9.0, 0.53, 0.42);
  s.addText("Every requirement. Every bonus.", { placeholder: "title" });
  T(s, [{ text: "Agents that ", options: { color: MUTED } }, { text: "“move, interact, compete, cooperate, decide outcomes”", options: { color: GOLD, italic: true } }],
    { x: 0.6, y: 1.12, w: 8.8, h: 0.38, fontSize: 16, fontFace: THEME.headFontFace, objectName: "anim-1-fade-quote" });
  card(s, { x: 0.6, y: 1.7, w: 4.4, h: 3.25, objectName: "anim-2-up-req-bg" });
  T(s, "REQUIRED", { x: 0.85, y: 1.85, w: 2, h: 0.28, fontSize: 11, bold: true, color: GOLD, charSpacing: 2, objectName: "anim-2-up-req-h" });
  const check = (x, y, txt, n, i) => {
    iconCircle(s, x, y, 0.3, EMBER, I.GiCheckMark_0F1626, `anim-${n}-up-ck${n}${i}`, 0.18);
    T(s, txt, { x: x + 0.42, y: y - 0.04, w: 3.6, h: 0.38, fontSize: 14, valign: "middle", objectName: `anim-${n}-up-ckt${n}${i}` });
  };
  ["Visual characters", "Movement across a 3D island", "5 agents with goals, roles, personalities", "Visible decision log", "2+ humans playing together", "Agent-caused world events"].forEach((t, i) => check(0.85, 2.3 + i * 0.43, t, 3, i));
  card(s, { x: 5.2, y: 1.7, w: 4.2, h: 1.2, objectName: "anim-4-up-bonus-bg" });
  T(s, "BONUS", { x: 5.45, y: 1.82, w: 2, h: 0.28, fontSize: 11, bold: true, color: GOLD, charSpacing: 2, objectName: "anim-4-up-bonus-h" });
  ["3D world", "Learning / memory", "Voice"].forEach((t, i) => {
    const x = [5.45, 6.6, 8.45][i];
    iconCircle(s, x, 2.17, 0.3, GOLD, I.GiCheckMark_0F1626, `anim-5-up-bk${i}`, 0.18);
    T(s, t, { x, y: 2.53, w: 1.75, h: 0.3, fontSize: 13, bold: true, objectName: `anim-5-up-bkt${i}` });
  });
  card(s, { x: 5.2, y: 3.05, w: 4.2, h: 1.9, line: { color: EMBER, width: 1.5 }, objectName: "anim-6-up-sp-bg" });
  T(s, "SPONSORS + TECH", { x: 5.45, y: 3.15, w: 3, h: 0.28, fontSize: 11, bold: true, color: EMBER, charSpacing: 2, objectName: "anim-6-up-sp-h" });
  const row = (b, t, last) => [{ text: b + " ", options: { bold: true, color: CREAM } }, { text: t, options: { color: MUTED, breakLine: !last } }];
  T(s, [...row("Bruin", "6 assets · 27 checks · ~0.1 s, every match end"), ...row("Runware", "14 images (portraits + scenes) in ~2.5 s"),
        ...row("BAND", "two-way Narrator bridge to a BAND room"), ...row("Blender", "procedural island world exported as GLB", true)],
    { x: 5.45, y: 3.48, w: 3.8, h: 1.4, fontSize: 12, paraSpaceAfter: 4, objectName: "anim-7-fade-sp-t" });
  s.addNotes("Coverage. Every requirement: visual characters, movement, five agents with goals, roles and personalities, a visible decision log, two-plus humans, and agent-caused world events — the wildfire and the council vote. Every bonus: 3D, learning and memory, and voice. Bruin is the memory: 6 assets, 27 checks, about 0.1 s, auto-run at every match end. Runware made all 14 images in about 2.5 seconds. BAND is a two-way bridge where the Narrator agent posts the drama and island agents answer questions. Blender builds the procedural island as GLB.");

  // ============ 10. VISION ============
  pres.addSection({ title: "Vision" });
  s = pres.addSlide({ masterName: "CLOSE", sectionTitle: "Vision" });
  ember(s, 8.2, 0.5, 1.0, true, true, FEASTART);
  s.addText("NPCs that hold grudges", { placeholder: "title" });
  [["GiBrain", "Market", "Persistent-memory social agents for games and NPCs"], ["GiKnifeFork", "Party game", "Built for family gatherings — any phone joins by QR"], ["GiCycle", "Next", "LLM dialogue plug-in · Twitch-plays mode · deeper BAND agent comms"]].forEach(([ic, h, b], i) => {
    const x = 0.6 + i * 2.95, y = 1.7, g = `anim-${1 + i}-up-col${i}`;
    card(s, { x, y, w: 2.75, h: 1.85, fill: { color: CARD, transparency: 15 }, objectName: g + "-bg" });
    iconCircle(s, x + 0.25, y + 0.25, 0.55, i === 1 ? GOLD : EMBER, I[ic + "_0F1626"], g, 0.17);
    T(s, h, { x: x + 0.95, y: y + 0.3, w: 1.7, h: 0.45, fontSize: 18, bold: true, valign: "middle", objectName: g + "-h" });
    T(s, b, { x: x + 0.25, y: y + 0.95, w: 2.3, h: 0.85, fontSize: 14, color: MUTED, objectName: g + "-b" });
  });
  T(s, "Scan the QR. Play a round. Get remembered.", { x: 0.6, y: 3.75, w: 8.8, h: 0.5, fontSize: 24, bold: true, color: GOLD, fontFace: THEME.headFontFace, objectName: "anim-4-up-ask" });
  T(s, [{ text: "Play now  ", options: { bold: true, color: CREAM } }, { text: "vnmoorthy.github.io/feastfall", options: { color: EMBER, hyperlink: { url: "https://vnmoorthy.github.io/feastfall/" } } }, { text: "   single-player browser demo", options: { color: MUTED, breakLine: true } },
        { text: "Code  ", options: { bold: true, color: CREAM } }, { text: "github.com/vnmoorthy/feastfall", options: { color: EMBER, hyperlink: { url: "https://github.com/vnmoorthy/feastfall" } } }, { text: "   ·   Team: Moorthy", options: { color: CREAM } }],
    { x: 0.6, y: 4.38, w: 8.8, h: 0.75, fontSize: 16, paraSpaceAfter: 4, objectName: "anim-5-fade-team" });
  s.addNotes("The vision: NPCs that hold grudges. Persistent-memory social agents are a platform for games and NPCs; Feastfall is the party game that proves it — perfect for family gatherings. Next: an LLM dialogue plug-in, a Twitch-plays mode, and deeper BAND agent comms. Our ask: scan the QR, play a round, and get remembered. Play the static single-player demo at vnmoorthy.github.io/feastfall; code at github.com/vnmoorthy/feastfall.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT, "portraits:", AG.filter((a) => a.img).length, "events:", Object.values(EV).filter(Boolean).length, "shots:", SHOTS.length);
})().catch((e) => { console.error(e); process.exit(1); });
