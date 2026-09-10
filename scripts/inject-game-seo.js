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

function patchGame(game) {
  const file = path.join(ROOT, "games", game.id, "index.html");
  if (!fs.existsSync(file)) {
    console.warn("skip missing", game.id);
    return false;
  }
  let html = fs.readFileSync(file, "utf8");
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
