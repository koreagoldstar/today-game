"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const issues = [];
const notes = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const main = read("js/main.js");
const match = main.match(/const GAMES = (\[[\s\S]*?\n  \]);/);
if (!match) {
  console.error("GAMES array parse failed");
  process.exit(1);
}
const GAMES = Function(`"use strict"; return (${match[1]});`)();
const seo = require(path.join(root, "scripts/game-seo-data.js"));
const seoIds = new Set(seo.map((g) => g.id));
const sitemap = read("sitemap.xml");
const rankable = read("js/rankable.js");
const rankIds = [...rankable.matchAll(/id: "([^"]+)"/g)].map((x) => x[1]);

for (const g of GAMES) {
  const indexRel = path.join("games", g.id, "index.html").replace(/\\/g, "/");
  if (!exists(indexRel)) issues.push(`게임 페이지 없음: ${g.id} (${g.href})`);
  if (g.thumb) {
    const thumbRel = g.thumb.replace(/^\//, "");
    if (!exists(thumbRel)) issues.push(`썸네일 없음: ${g.id} -> ${g.thumb}`);
  }
  if (!seoIds.has(g.id)) issues.push(`SEO 항목 없음: ${g.id}`);
  if (!sitemap.includes(g.href)) issues.push(`sitemap 누락: ${g.href}`);
}

for (const s of seo) {
  if (!GAMES.some((g) => g.id === s.id)) notes.push(`SEO만 있고 GAMES에는 없음: ${s.id}`);
}

for (const id of rankIds) {
  if (!exists(path.join("games", id, "index.html"))) {
    issues.push(`랭킹 게임 페이지 없음: ${id}`);
  }
}

const jsFiles = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === "scratch" || name === "edu-svg-assets") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (name.endsWith(".js")) jsFiles.push(full);
  }
}
walk(root);

const syntaxBad = [];
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    syntaxBad.push(path.relative(root, file) + " " + (err.stderr || err.message).toString().slice(0, 200));
  }
}

console.log(JSON.stringify({
  games: GAMES.length,
  seo: seo.length,
  rankable: rankIds.length,
  jsChecked: jsFiles.length,
  issues,
  notes,
  syntaxBad,
}, null, 2));
