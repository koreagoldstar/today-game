/**
 * Injects shared SEO copy into each game's index.html so crawlers see it
 * in the initial HTML (not client-only JS).
 * Usage: node scripts/inject-game-seo.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const GAMES = require("./game-seo-data");

const ROOT = path.join(__dirname, "..");
const CSS_HREF = "/css/game-seo.css?v=3";
const SCRIPT_SRC = "/js/game-seo.js?v=1";
const START = "<!-- seo:game:start -->";
const END = "<!-- seo:game:end -->";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSeo(game) {
  const title = escapeHtml(game.title);
  const intro = escapeHtml(game.intro);
  if (game.archive) {
    return [
      START,
      `<section class="seo-about" aria-label="${title} 소개">`,
      `  <h2>${title} 소개</h2>`,
      `  <p>${intro}</p>`,
      `</section>`,
      END,
    ].join("\n");
  }

  const faq = (game.faq || [])
    .map(
      (item) =>
        `    <dt>${escapeHtml(item.q)}</dt>\n    <dd>${escapeHtml(item.a)}</dd>`
    )
    .join("\n");

  return [
    START,
    `<section class="seo-about" aria-label="${title} 소개">`,
    `  <h2>${title} 소개</h2>`,
    `  <p>${intro}</p>`,
    `  <h3>플레이 방법</h3>`,
    `  <p>${escapeHtml(game.how)}</p>`,
    `  <h3>자주 묻는 질문</h3>`,
    `  <dl>`,
    faq,
    `  </dl>`,
    `</section>`,
    END,
  ].join("\n");
}

function ensureCssLink(html) {
  if (/\/css\/game-seo\.css/.test(html)) {
    return html.replace(/\/css\/game-seo\.css(\?v=\d+)?/g, "/css/game-seo.css?v=3");
  }
  if (html.includes("</head>")) {
    return html.replace("</head>", `    <link rel="stylesheet" href="${CSS_HREF}" />\n  </head>`);
  }
  return html;
}

function ensureSeoScript(html) {
  if (html.includes("/js/game-seo.js")) {
    return html.replace(/\/js\/game-seo\.js(\?v=\d+)?/g, "/js/game-seo.js?v=1");
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `    <script src="${SCRIPT_SRC}"></script>\n  </body>`);
  }
  return html;
}

function injectBlock(html, block) {
  const re = new RegExp(`${START}[\\s\\S]*?${END}\\n?`);
  if (re.test(html)) return html.replace(re, `${block}\n`);
  if (html.includes("</body>")) {
    return html.replace("</body>", `    ${block}\n  </body>`);
  }
  return `${html}\n${block}\n`;
}

/* ---------- 머리말(검색 설명 · 대표 주소 · 공유 미리보기) — 비어 있는 것만 채움 ---------- */
const SITE = "https://www.todaygame.co.kr";
const mainSrc = fs.readFileSync(path.join(ROOT, "js/main.js"), "utf8");
const mainMatch = mainSrc.match(/const GAMES = (\[[\s\S]*?\n  \]);/);
const MAIN = mainMatch ? Function(`"use strict"; return (${mainMatch[1]});`)() : [];
/** 폴더 이름으로 찾기 (목록 id 와 폴더 이름이 다른 게임이 있음: goindol → sinseokgi) */
const mainByDir = new Map(MAIN.map((g) => [String(g.href || "").split("/")[2], g]));

function attr(s) {
  return escapeHtml(String(s).replace(/\s+/g, " ").trim());
}

/** 소개 글에서 검색 설명 (150자 안쪽, 문장 단위로 자름) */
function describe(game) {
  const text = String(game.intro || "").replace(/\s+/g, " ").trim();
  if (text.length <= 150) return text;
  const cut = text.slice(0, 150);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("요. "), cut.lastIndexOf("다. "));
  return end > 60 ? cut.slice(0, end + 1).trim() : `${cut.slice(0, cut.lastIndexOf(" ")).trim()}…`;
}

function shareImage(id, entry) {
  if (fs.existsSync(path.join(ROOT, "assets/thumbs", `${id}.png`))) return `${SITE}/assets/thumbs/${id}.png`;
  if (entry && entry.thumb) return `${SITE}${String(entry.thumb).split("?")[0]}`;
  return `${SITE}/assets/og-share.png`;
}

function ensureHead(html, game) {
  const entry = mainByDir.get(game.id);
  const url = `${SITE}/games/${game.id}/`;
  const desc = describe(game);
  const add = [];
  // 제목이 게임 이름뿐이면 무슨 게임인지 · 사이트 이름을 붙임
  html = html.replace(/<title>([^<]*)<\/title>/i, (m, t) => {
    if (/[|—]| - /.test(t)) return m;
    const tag = entry && entry.tag ? ` — ${entry.tag}` : "";
    return `<title>${escapeHtml(game.title)}${escapeHtml(tag)} | 오늘의 게임</title>`;
  });
  const has = (re) => re.test(html);
  if (!has(/<meta[^>]+name="description"/i) && desc) add.push(`<meta name="description" content="${attr(desc)}" />`);
  if (!has(/<link[^>]+rel="canonical"/i)) add.push(`<link rel="canonical" href="${url}" />`);
  if (!has(/property="og:type"/i)) add.push(`<meta property="og:type" content="website" />`);
  if (!has(/property="og:site_name"/i)) add.push(`<meta property="og:site_name" content="오늘의 게임" />`);
  if (!has(/property="og:title"/i)) add.push(`<meta property="og:title" content="${attr(`${game.title} | 오늘의 게임`)}" />`);
  if (!has(/property="og:description"/i) && desc) add.push(`<meta property="og:description" content="${attr(desc)}" />`);
  if (!has(/property="og:url"/i)) add.push(`<meta property="og:url" content="${url}" />`);
  if (!has(/property="og:image"/i)) add.push(`<meta property="og:image" content="${shareImage(game.id, entry)}" />`);
  if (!has(/name="twitter:card"/i)) add.push(`<meta name="twitter:card" content="summary_large_image" />`);
  if (!add.length) return html;
  const block = add.map((line) => `    ${line}`).join("\n");
  if (/<\/title>\s*\n/i.test(html)) return html.replace(/(<\/title>[^\n]*\n)/i, `$1${block}\n`);
  return html.replace("</head>", `${block}\n  </head>`);
}

function patchGame(game) {
  const file = path.join(ROOT, "games", game.id, "index.html");
  if (!fs.existsSync(file)) {
    console.warn("skip missing", game.id);
    return false;
  }
  let html = fs.readFileSync(file, "utf8");
  html = ensureHead(html, game);
  html = ensureCssLink(html);
  html = injectBlock(html, renderSeo(game));
  html = ensureSeoScript(html);
  fs.writeFileSync(file, html, "utf8");
  return true;
}

let ok = 0;
for (const game of GAMES) {
  if (patchGame(game)) ok++;
}
console.log(`Injected SEO copy into ${ok}/${GAMES.length} game pages`);
