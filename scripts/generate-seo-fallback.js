/**
 * Builds static SEO fallback HTML snippets + sitemap.xml from js/main.js GAMES.
 * Usage: node scripts/generate-seo-fallback.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
const match = src.match(/const GAMES = (\[[\s\S]*?\n  \]);/);
if (!match) throw new Error("GAMES array not found in js/main.js");

const GAMES = Function(`"use strict"; return (${match[1]});`)();

const CATEGORIES = [
  { id: "rhythm", title: "리듬 · 음악", desc: "비트에 맞춰 톡톡" },
  { id: "sports", title: "스포츠 · 레이싱", desc: "공 치고 달리고" },
  { id: "action", title: "액션 · 슈팅", desc: "손맛 있게 쏘고 피하는 게임" },
  { id: "puzzle", title: "퍼즐 · 두뇌", desc: "생각하고 맞추는 게임" },
  { id: "arcade", title: "아케이드 · 캐치", desc: "짧게 중독되는 캐주얼" },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slot(game, opts = {}) {
  const classes = [
    game.thumb ? "slot has-photo" : "slot",
    opts.compact ? "slot-compact" : "",
    opts.external ? "slot-external" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const art = game.thumb
    ? `<img src="${escapeHtml(game.thumb)}" alt="" width="220" height="220" loading="lazy" />`
    : `<span class="slot-emoji" aria-hidden="true">🎮</span>`;
  const tag = opts.external
    ? `<p class="slot-tag">${escapeHtml(game.tag)}</p><span class="slot-ext">↗ 외부 연결</span>`
    : `<p class="slot-tag">${escapeHtml(game.tag)}</p><span class="slot-play">플레이</span>`;
  return [
    `<a class="${classes}" href="${escapeHtml(game.href)}" aria-label="${escapeHtml(game.title)} 플레이">`,
    `  <div class="slot-art">${art}</div>`,
    `  <div class="slot-meta">`,
    `    <p class="slot-name">${escapeHtml(game.title)}</p>`,
    `    ${tag}`,
    `  </div>`,
    `</a>`,
  ].join("\n");
}

function indent(text, spaces) {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

function buildCatalog() {
  const parts = [];
  for (const cat of CATEGORIES) {
    const games = GAMES.filter((g) => g.category === cat.id);
    if (!games.length) continue;
    const cards = games.map((g) => indent(slot(g), 12)).join("\n");
    parts.push(
      [
        `        <section class="cat-shelf" id="cat-${cat.id}" aria-labelledby="cat-title-${cat.id}">`,
        `          <div class="cat-head">`,
        `            <div>`,
        `              <h3 class="cat-title" id="cat-title-${cat.id}">${escapeHtml(cat.title)}</h3>`,
        `              <p class="cat-desc">${escapeHtml(cat.desc)}</p>`,
        `            </div>`,
        `            <span class="cat-count">${games.length}개</span>`,
        `          </div>`,
        `          <div class="game-grid">`,
        cards,
        `          </div>`,
        `        </section>`,
      ].join("\n")
    );
  }
  return parts.join("\n\n");
}

function buildArchive() {
  return GAMES.filter((g) => g.category === "archive")
    .map((g) => indent(slot(g, { compact: true, external: true }), 10))
    .join("\n");
}

function buildSitemap() {
  const today = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  const urls = [
    { loc: "https://www.todaygame.co.kr/", changefreq: "daily", priority: "1.0" },
    { loc: "https://www.todaygame.co.kr/rankings/", changefreq: "daily", priority: "0.9" },
    { loc: "https://www.todaygame.co.kr/fame/", changefreq: "daily", priority: "0.9" },
  ];
  const seen = new Set(urls.map((u) => u.loc));
  for (const game of GAMES) {
    const loc = `https://www.todaygame.co.kr${game.href}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    urls.push({ loc, changefreq: "weekly", priority: "0.8" });
  }
  // Folders that exist but may not be in the hub catalog
  for (const extra of ["/games/odd-even/", "/games/rps/"]) {
    const loc = `https://www.todaygame.co.kr${extra}`;
    if (seen.has(loc)) continue;
    seen.add(loc);
    urls.push({ loc, changefreq: "weekly", priority: "0.7" });
  }
  urls.sort((a, b) => {
    if (a.priority !== b.priority) return Number(b.priority) - Number(a.priority);
    return a.loc.localeCompare(b.loc);
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls.flatMap((u) => [
      `  <url>`,
      `    <loc>${u.loc}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${u.changefreq}</changefreq>`,
      `    <priority>${u.priority}</priority>`,
      `  </url>`,
    ]),
    `</urlset>`,
    ``,
  ].join("\n");
}

function patchIndex(catalogHtml, archiveHtml) {
  const indexPath = path.join(root, "index.html");
  let html = fs.readFileSync(indexPath, "utf8");

  if (!html.includes('id="catalog"')) throw new Error("#catalog not found");
  if (!html.includes('id="archive-list"')) throw new Error("#archive-list not found");

  const catalogBlock = [
    `<div class="catalog" id="catalog">`,
    `        <!-- seo:catalog:start -->`,
    catalogHtml,
    `        <!-- seo:catalog:end -->`,
    `      </div>`,
  ].join("\n");

  const archiveBlock = [
    `<div class="archive-rail-list" id="archive-list">`,
    `          <!-- seo:archive:start -->`,
    archiveHtml,
    `          <!-- seo:archive:end -->`,
    `        </div>`,
  ].join("\n");

  if (html.includes("<!-- seo:catalog:start -->")) {
    html = html.replace(
      /<!-- seo:catalog:start -->[\s\S]*?<!-- seo:catalog:end -->/,
      `<!-- seo:catalog:start -->\n${catalogHtml}\n        <!-- seo:catalog:end -->`
    );
  } else {
    html = html.replace(
      /<div class="catalog" id="catalog">[\s\S]*?<\/div>(?=\s*<\/section>)/,
      catalogBlock
    );
  }

  if (html.includes("<!-- seo:archive:start -->")) {
    html = html.replace(
      /<!-- seo:archive:start -->[\s\S]*?<!-- seo:archive:end -->/,
      `<!-- seo:archive:start -->\n${archiveHtml}\n          <!-- seo:archive:end -->`
    );
  } else {
    html = html.replace(
      /<div class="archive-rail-list" id="archive-list">[\s\S]*?<\/div>(?=\s*<\/aside>)/,
      archiveBlock
    );
  }

  // Google Search Console — paste meta tag from Search Console when verifying.
  if (!html.includes("google-site-verification") && !html.includes("Google Search Console")) {
    html = html.replace(
      '<meta name="naver-site-verification"',
      "<!-- Google Search Console: add <meta name=\"google-site-verification\" content=\"...\" /> here -->\n    <meta name=\"naver-site-verification\""
    );
  }

  fs.writeFileSync(indexPath, html);
}

function patchRankingsAndFame() {
  const rankablePath = path.join(root, "js/rankable.js");
  const rankSrc = fs.readFileSync(rankablePath, "utf8");
  const rMatch = rankSrc.match(/const RANKABLE = (\[[\s\S]*?\n  \]);/);
  if (!rMatch) throw new Error("RANKABLE not found");
  const RANKABLE = Function(`"use strict"; return (${rMatch[1]});`)();

  const listItems = RANKABLE.map(
    (g) =>
      `          <li><a href="/games/${escapeHtml(g.id)}/">${escapeHtml(g.title)}</a></li>`
  ).join("\n");

  const crawlBlock = (id, title) =>
    [
      `      <section class="seo-crawl" aria-label="${title}">`,
      `        <h2>${title}</h2>`,
      `        <ul id="${id}">`,
      listItems,
      `        </ul>`,
      `      </section>`,
    ].join("\n");

  const rankingsPath = path.join(root, "rankings/index.html");
  let rankings = fs.readFileSync(rankingsPath, "utf8");
  if (!rankings.includes('id="seo-game-index"')) {
    rankings = rankings.replace(
      `    </main>`,
      `${crawlBlock("seo-game-index", "랭킹 가능 게임")}\n    </main>`
    );
    fs.writeFileSync(rankingsPath, rankings);
  }

  const famePath = path.join(root, "fame/index.html");
  let fame = fs.readFileSync(famePath, "utf8");
  if (!fame.includes('id="seo-fame-index"')) {
    fame = fame.replace(
      `    </main>`,
      `${crawlBlock("seo-fame-index", "게임별 명예의 전당")}\n    </main>`
    );
    fs.writeFileSync(famePath, fame);
  }
}

const catalogHtml = buildCatalog();
const archiveHtml = buildArchive();
fs.writeFileSync(path.join(root, "sitemap.xml"), buildSitemap());
patchIndex(catalogHtml, archiveHtml);
patchRankingsAndFame();

console.log(
  `SEO fallback ready: ${GAMES.length} games, catalog + archive in index.html, sitemap updated`
);
