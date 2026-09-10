/**
 * Builds sitemap.xml from js/main.js GAMES plus static pages.
 * Usage: node scripts/generate-sitemap.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ORIGIN = "https://www.todaygame.co.kr";

const STATIC_PAGES = [
  { path: "/", priority: "1.0" },
  { path: "/rankings/", priority: "0.8" },
  { path: "/fame/", priority: "0.6" },
  { path: "/privacy/", priority: "0.3" },
  { path: "/terms/", priority: "0.3" },
];

/** Per-path overrides. New games default to 0.7 (archive: 0.6). */
const PRIORITY_BY_PATH = {
  "/games/rhythm-easy/": "0.5",
  "/games/wordle/": "0.9",
  "/games/minesweeper/": "0.9",
  "/games/tetris/": "0.8",
  "/games/suika/": "0.8",
  "/games/slide-2048/": "0.8",
};

function loadGames() {
  const src = fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8");
  const match = src.match(/const GAMES = (\[[\s\S]*?\n  \]);/);
  if (!match) throw new Error("GAMES array not found in js/main.js");
  return Function(`"use strict"; return (${match[1]});`)();
}

function gamePriority(game) {
  if (PRIORITY_BY_PATH[game.href]) return PRIORITY_BY_PATH[game.href];
  if (game.category === "archive") return "0.6";
  return "0.7";
}

function urlTag(loc, priority) {
  return `  <url><loc>${loc}</loc><priority>${priority}</priority></url>`;
}

function buildSitemap(games = loadGames()) {
  const seen = new Set();
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ];

  for (const page of STATIC_PAGES) {
    const loc = `${ORIGIN}${page.path}`;
    seen.add(loc);
    lines.push(urlTag(loc, page.priority));
  }

  lines.push("");

  for (const game of games) {
    const loc = `${ORIGIN}${game.href}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    lines.push(urlTag(loc, gamePriority(game)));
  }

  lines.push(`</urlset>`, "");
  return lines.join("\n");
}

function writeSitemap() {
  const xml = buildSitemap();
  const out = path.join(ROOT, "sitemap.xml");
  fs.writeFileSync(out, xml);
  return out;
}

if (require.main === module) {
  writeSitemap();
  const games = loadGames();
  console.log(`Wrote sitemap.xml (${STATIC_PAGES.length} pages + ${games.length} games)`);
}

module.exports = { buildSitemap, writeSitemap };
