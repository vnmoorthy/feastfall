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
  await sharp(Buffer.from(main)).png().toFile(path.join(BUILD, "bg_main.png"));
  await sharp(Buffer.from(cover)).png().toFile(path.join(BUILD, "bg_cover.png"));
}

// optional real images (portraits / event art / screenshots)
async function findImage(name) {
  for (const ext of ["png", "webp", "jpg", "jpeg"]) {
    const p = path.join(ROOT, "data", "images", `${name}.${ext}`);
    if (fs.existsSync(p)) {
      const out = path.join(BUILD, `img_${name}.png`);
      await sharp(p).png().toFile(out);
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
      if (fs.existsSync(p)) { const out = path.join(BUILD, `sq_${name}.png`); await sharp(p).resize(640, 640, { fit: "cover" }).png().toFile(out); return out; }
    }
    return null;
  };
  const HERO = await sq("hero"), FEASTART = await sq("feast");

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = "FEASTFALL — pitch deck";
  pres.author = "Feastfall team";

  const footer = [
    { text: { text: "FEASTFALL", options: { x: 0.6, y: 5.27, w: 3, h: 0.22, fontSize: 9, bold: true, color: SLATE, charSpacing: 3, margin: 0, fontFace: "Calibri" } } },
  ];
  pres.defineSlideMaster({
    title: "COVER", background: { path: path.join(BUILD, "bg_cover.png") },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.55, y: 1.05, w: 5.9, h: 1.3, fontSize: 60, bold: true, color: GOLD, fontFace: THEME.headFontFace, valign: "middle", align: "left", margin: 0 }, text: "" } }],
  });
  pres.defineSlideMaster({
    title: "CONTENT", background: { path: path.join(BUILD, "bg_main.png") },
    objects: [...footer, { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.38, w: 8.0, h: 0.75, fontSize: 32, bold: true, color: CREAM, fontFace: THEME.headFontFace, valign: "middle", align: "left", margin: 0 }, text: "" } }],
    slideNumber: { x: 8.9, y: 5.27, w: 0.5, h: 0.22, fontSize: 9, color: SLATE, align: "right", fontFace: "Calibri" },
  });
  pres.defineSlideMaster({
    title: "CLOSE", background: { path: path.join(BUILD, "bg_cover.png") },
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
  ember(s, 6.95, 0.95, 2.3, true, true, HERO);
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
    const d = 1.15, x = 0.75 + i * 1.83, y = 1.75, g = `anim-${2 + i}-up-node${i}`;
    s.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color: CARD }, line: { color: GOLD, width: 2 }, objectName: g + "-c" });
    s.addImage({ data: I[ic + "_F4C95D"], x: x + 0.28, y: y + 0.28, w: d - 0.56, h: d - 0.56, objectName: g + "-i" });
    T(s, h, { x: x - 0.3, y: y + 1.25, w: d + 0.6, h: 0.38, fontSize: 18, bold: true, align: "center", objectName: g + "-h" });
    T(s, b, { x: x - 0.3, y: y + 1.63, w: d + 0.6, h: 0.3, fontSize: 12, color: MUTED, align: "center", objectName: g + "-b" });
    if (i < 4) arrow(s, x + d + 0.1, y + d / 2, 0.48, 0, { objectName: `anim-${2 + i}-fade-arrow${i}` });
  });
  [["wildfire", "GiFire", "WILDFIRE", "set by the traitor as a distraction"], ["council", "GiScales", "COUNCIL VOTE", "Marigold calls it · exile reveals roles"]].forEach(([ev, ic, h, b], i) => {
    const x = 0.6 + i * 4.5, y = 4.2, g = `anim-${7 + i}-up-chip${i}`;
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: 4.3, h: 0.6, fill: { color: CARD2 }, line: { color: i ? GOLD : EMBER, width: 1.5 }, rectRadius: 0.3, objectName: g + "-bg" });
    if (EV[ev]) s.addImage({ path: EV[ev], x: x + 0.08, y: y + 0.06, w: 0.48, h: 0.48, rounding: true, objectName: g + "-img" });
    else iconCircle(s, x + 0.08, y + 0.06, 0.48, i ? GOLD : EMBER, I[ic + "_0F1626"], g, 0.18);
    T(s, [{ text: h + "  ", options: { bold: true, color: i ? GOLD : EMBER } }, { text: b, options: { color: CREAM } }], { x: x + 0.7, y, w: 3.5, h: 0.6, fontSize: 12, valign: "middle", objectName: g + "-t" });
  });
  s.addNotes("The loop: gather berries, fish and wood into the Granary before sunset. One agent — random every match — is the traitor: it steals only when nobody is watching, frames others, and can set a wildfire as a distraction. Agents accuse out loud, Marigold calls a council vote, humans and agents exile someone, and the role is revealed. Agents cause the world events — not a script.");

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
  T(s, "“Moorthy… last feast you stole 6 berries. I remember.”", { x: 0.95, y: 1.5, w: 4.9, h: 2.05, fontSize: 28, italic: true, color: NAVY, fontFace: THEME.headFontFace, valign: "middle", objectName: "anim-2-up-quote" });
  const jun = AG[1];
  if (jun.img) s.addImage({ path: jun.img, x: 0.6, y: 4.1, w: 0.8, h: 0.8, rounding: true, objectName: "anim-3-up-jun" });
  else iconCircle(s, 0.6, 4.1, 0.8, GOLD, I.GiDeerHead_0F1626, "anim-3-up-jun", 0.16);
  T(s, [{ text: "Juniper the deer · match 2", options: { bold: true, color: GOLD, breakLine: true } }, { text: "spoken aloud in her own voice", options: { color: MUTED } }],
    { x: 1.55, y: 4.15, w: 4.6, h: 0.7, fontSize: 14, objectName: "anim-3-up-junt" });
  card(s, { x: 6.6, y: 1.35, w: 2.8, h: 3.55, objectName: "anim-4-up-meter-bg" });
  T(s, "JUNIPER → MOORTHY", { x: 6.85, y: 1.5, w: 2.4, h: 0.3, fontSize: 11, bold: true, color: GOLD, charSpacing: 2, objectName: "anim-4-up-meter-h" });
  T(s, "trust", { x: 6.85, y: 1.78, w: 2.4, h: 0.25, fontSize: 11, color: MUTED, objectName: "anim-4-up-meter-s" });
  const meter = (y, val, label, col, big, n) => {
    T(s, val.toFixed(2), { x: 6.85, y, w: 2.4, h: 0.6, fontSize: big, bold: true, color: col, fontFace: THEME.headFontFace, objectName: `anim-${n}-up-mv${n}` });
    s.addShape(S.ROUNDED_RECTANGLE, { x: 6.85, y: y + 0.68, w: 2.3, h: 0.14, fill: { color: LINE }, line: { color: LINE, width: 0 }, rectRadius: 0.07, objectName: `anim-${n}-up-mt${n}` });
    s.addShape(S.ROUNDED_RECTANGLE, { x: 6.85, y: y + 0.68, w: Math.max(0.15, 2.3 * val), h: 0.14, fill: { color: col }, line: { color: col, width: 0 }, rectRadius: 0.07, objectName: `anim-${n}-up-mf${n}` });
    T(s, label, { x: 6.85, y: y + 0.88, w: 2.4, h: 0.25, fontSize: 11, color: MUTED, objectName: `anim-${n}-up-ml${n}` });
  };
  meter(2.1, 0.5, "match 1 start", SLATE, 30, 5);
  meter(3.4, 0.12, "match 2 start — after the theft", EMBER, 40, 6);
  s.addNotes("SWITCH TO LIVE DEMO HERE. This is the moment we built for: in match one, Moorthy stole six berries while only Juniper was watching. The Bruin pipeline turned that into memory. Match two starts, Juniper's trust toward Moorthy opens at 0.12 instead of 0.50 — and she calls him out loud, in her own voice. NPCs that hold grudges.");

  // ============ 7. ARCHITECTURE ============
  pres.addSection({ title: "Architecture" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Architecture" });
  ember(s, 9.0, 0.53, 0.42);
  s.addText("How it fits together", { placeholder: "title" });
  const box = (x, y, w, h, head, body, border, g, tag) => {
    card(s, { x, y, w, h, line: { color: border, width: border === LINE ? 1 : 2 }, objectName: g + "-bg" });
    T(s, head, { x: x + 0.18, y: y + 0.14, w: w - 0.36, h: 0.36, fontSize: 16, bold: true, color: border === LINE ? CREAM : border, objectName: g + "-h" });
    T(s, body, { x: x + 0.18, y: y + 0.52, w: w - 0.36, h: h - 0.6, fontSize: 12, color: MUTED, objectName: g + "-b" });
    if (tag) {
      s.addShape(S.ROUNDED_RECTANGLE, { x: x + w - 0.95, y: y - 0.14, w: 0.85, h: 0.26, fill: { color: EMBER }, line: { color: EMBER, width: 0 }, rectRadius: 0.13, objectName: g + "-tag" });
      T(s, "SPONSOR", { x: x + w - 0.95, y: y - 0.14, w: 0.85, h: 0.26, fontSize: 9, bold: true, color: NAVY, align: "center", valign: "middle", charSpacing: 1, objectName: g + "-tagt" });
    }
  };
  box(0.6, 1.4, 2.4, 1.35, "Phones + TV", "Three.js low-poly island · QR join · Web Speech voices", LINE, "anim-1-up-clients");
  box(3.75, 1.4, 2.5, 1.35, "Game server", "Node + Express · authoritative 10 Hz sim · utility-AI agents", GOLD, "anim-2-up-server");
  box(7.0, 1.4, 2.4, 1.35, "Runware API", "agent portraits + cinematic event art, cached to disk", EMBER, "anim-3-up-runware", true);
  box(0.6, 3.5, 2.4, 1.2, "ledger.jsonl", "every event, every decision + utility scores", LINE, "anim-5-up-ledger");
  box(3.75, 3.5, 2.5, 1.2, "Bruin pipeline", "DuckDB assets + column quality checks", EMBER, "anim-6-up-bruin", true);
  box(7.0, 3.5, 2.4, 1.2, "reputation.json", "learned trust + policy priors", GOLD, "anim-7-up-rep");
  const lab = (txt, x, y, w, n, al = "center") => T(s, txt, { x, y, w, h: 0.25, fontSize: 10, color: GOLD, italic: true, align: al, objectName: `anim-${n}-fade-lab${n}${x}` });
  s.addShape(S.LINE, { x: 3.05, y: 2.08, w: 0.65, h: 0, line: { color: EMBER, width: 2, beginArrowType: "triangle", endArrowType: "triangle" }, objectName: "anim-2-fade-ws" });
  lab("WebSocket", 2.88, 1.78, 1.0, 2);
  arrow(s, 6.3, 2.08, 0.65, 0, { flipH: true, objectName: "anim-3-fade-img" });
  lab("images", 6.25, 1.78, 0.75, 3);
  arrow(s, 2.8, 2.8, 1.25, 0.65, { flipH: true, objectName: "anim-4-fade-d1" });
  lab("every event", 1.6, 2.98, 1.2, 4, "right");
  arrow(s, 3.05, 4.1, 0.65, 0, { objectName: "anim-6-fade-a2" });
  arrow(s, 6.3, 4.1, 0.65, 0, { objectName: "anim-7-fade-a3" });
  s.addShape(S.LINE, { x: 5.95, y: 2.8, w: 1.25, h: 0.65, line: { color: GOLD, width: 2, beginArrowType: "triangle", dashType: "dash" }, objectName: "anim-8-fade-d2" });
  lab("hot-load → next match", 7.25, 2.98, 1.9, 8, "left");
  s.addNotes("Architecture. Phones and the TV view are thin Three.js clients over WebSocket. The Node + Express server runs an authoritative 10 Hz simulation with utility-AI agents. Every event and decision goes to a JSONL ledger. Bruin runs a DuckDB pipeline with quality checks and writes reputation.json plus policy priors, which the server hot-loads for the next match. Runware generates portraits and event art, cached to disk.");

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
  T(s, "Policies reward-updated after each match: utility-AI + tabular reinforcement of action weights. No LLM required — runs offline.",
    { x: 0.6, y: 4.55, w: 4.65, h: 0.62, fontSize: 12, color: MUTED, objectName: "anim-7-fade-pol" });
  s.addChart(pres.charts.BAR, [
    { name: "Match 1 start", labels: AG.map((a) => a.name), values: [0.62, 0.5, 0.55, 0.58, 0.6] },
    { name: "Match 2 start", labels: AG.map((a) => a.name), values: [0.35, 0.12, 0.4, 0.3, 0.45] },
  ], {
    x: 5.5, y: 1.2, w: 3.95, h: 3.75, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: [SLATE, EMBER], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", dataLabelFontSize: 8, dataLabelColor: CREAM,
    showTitle: true, title: "Trust toward a player who stole (illustrative)", titleColor: GOLD, titleFontSize: 11, titleFontFace: "+mn-lt",
    catAxisLabelColor: CREAM, catAxisLabelFontSize: 10, catAxisLabelFontFace: "+mn-lt", valAxisLabelColor: MUTED, valAxisLabelFontSize: 9, valAxisLabelFontFace: "+mn-lt",
    valAxisMinVal: 0, valAxisMaxVal: 0.8, valAxisMajorUnit: 0.2, valAxisLabelFormatCode: "0.0", valGridLine: { color: LINE, size: 0.5 }, catGridLine: { style: "none" },
    catAxisLineShow: false, valAxisLineShow: false, dataLabelFontFace: "+mn-lt",
    showLegend: true, legendPos: "b", legendColor: CREAM, legendFontSize: 10, legendFontFace: "+mn-lt", objectName: "trustchart",
  });
  s.addNotes("The learning loop is the moat. Every event lands in a JSONL ledger. A Bruin pipeline on DuckDB builds raw.ledger, raw.matches, and three marts — reputation, agent_policy, match_summary — with column quality checks. Out comes reputation.json and policy priors that the game server hot-loads. Each agent starts the next match with learned trust, and policies are reward-updated: utility AI plus tabular reinforcement of action weights. No LLM required; it runs offline. Chart values are illustrative.");

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
  card(s, { x: 5.2, y: 1.7, w: 4.2, h: 1.45, objectName: "anim-4-up-bonus-bg" });
  T(s, "BONUS", { x: 5.45, y: 1.85, w: 2, h: 0.28, fontSize: 11, bold: true, color: GOLD, charSpacing: 2, objectName: "anim-4-up-bonus-h" });
  ["3D world", "Learning / memory", "Voice"].forEach((t, i) => {
    const x = [5.45, 6.6, 8.45][i];
    iconCircle(s, x, 2.35, 0.3, GOLD, I.GiCheckMark_0F1626, `anim-5-up-bk${i}`, 0.18);
    T(s, t, { x, y: 2.72, w: 1.75, h: 0.3, fontSize: 13, bold: true, objectName: `anim-5-up-bkt${i}` });
  });
  card(s, { x: 5.2, y: 3.3, w: 4.2, h: 1.65, line: { color: EMBER, width: 1.5 }, objectName: "anim-6-up-sp-bg" });
  T(s, "SPONSORS", { x: 5.45, y: 3.43, w: 2, h: 0.28, fontSize: 11, bold: true, color: EMBER, charSpacing: 2, objectName: "anim-6-up-sp-h" });
  T(s, [{ text: "Bruin ", options: { bold: true, color: CREAM } }, { text: "ledger → DuckDB marts + quality checks = the agents' memory", options: { color: MUTED, breakLine: true } },
        { text: "Runware ", options: { bold: true, color: CREAM } }, { text: "portraits + cinematic event art: wildfire, council, exile, feast", options: { color: MUTED } }],
    { x: 5.45, y: 3.78, w: 3.8, h: 1.1, fontSize: 12, paraSpaceAfter: 6, objectName: "anim-7-fade-sp-t" });
  s.addNotes("Coverage. Every requirement: visual characters, movement, five agents with goals, roles and personalities, a visible decision log, two-plus humans, and agent-caused world events — the wildfire and the council vote. Every bonus: 3D, learning and memory, and voice. Bruin is the memory; Runware draws the cast and the cinematic moments.");

  // ============ 10. VISION ============
  pres.addSection({ title: "Vision" });
  s = pres.addSlide({ masterName: "CLOSE", sectionTitle: "Vision" });
  ember(s, 8.2, 0.5, 1.0, true, true, FEASTART);
  s.addText("NPCs that hold grudges", { placeholder: "title" });
  [["GiBrain", "Market", "Persistent-memory social agents for games and NPCs"], ["GiKnifeFork", "Party game", "Built for family gatherings — any phone joins by QR"], ["GiCycle", "Next", "LLM dialogue plug-in · Twitch-plays mode · BAND cross-tool agent comms"]].forEach(([ic, h, b], i) => {
    const x = 0.6 + i * 2.95, y = 1.75, g = `anim-${1 + i}-up-col${i}`;
    card(s, { x, y, w: 2.75, h: 1.95, fill: { color: CARD, transparency: 15 }, objectName: g + "-bg" });
    iconCircle(s, x + 0.25, y + 0.25, 0.55, i === 1 ? GOLD : EMBER, I[ic + "_0F1626"], g, 0.17);
    T(s, h, { x: x + 0.95, y: y + 0.3, w: 1.7, h: 0.45, fontSize: 18, bold: true, valign: "middle", objectName: g + "-h" });
    T(s, b, { x: x + 0.25, y: y + 0.95, w: 2.3, h: 0.9, fontSize: 14, color: MUTED, objectName: g + "-b" });
  });
  T(s, "Scan the QR. Play a round. Get remembered.", { x: 0.6, y: 3.95, w: 8.8, h: 0.5, fontSize: 24, bold: true, color: GOLD, fontFace: THEME.headFontFace, objectName: "anim-4-up-ask" });
  T(s, [{ text: "Team: Moorthy  ·  ", options: { color: CREAM } }, { text: "github.com/vnmoorthy/feastfall", options: { color: EMBER, hyperlink: { url: "https://github.com/vnmoorthy/feastfall" } } }],
    { x: 0.6, y: 4.6, w: 8.8, h: 0.35, fontSize: 16, objectName: "anim-5-fade-team" });
  s.addNotes("The vision: NPCs that hold grudges. Persistent-memory social agents are a platform for games and NPCs; Feastfall is the party game that proves it — perfect for family gatherings. Next: an LLM dialogue plug-in, a Twitch-plays mode, and BAND for cross-tool agent comms. Our ask: scan the QR, play a round, and get remembered. Repo: github.com/vnmoorthy/feastfall.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT, "portraits:", AG.filter((a) => a.img).length, "events:", Object.values(EV).filter(Boolean).length, "shots:", SHOTS.length);
})().catch((e) => { console.error(e); process.exit(1); });
