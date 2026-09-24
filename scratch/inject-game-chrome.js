const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const AUDIO = '<script src="/js/today-audio.js?v=1"></script>';
const CHROME = '<script src="/js/game-chrome.js?v=2"></script>';
const CSS = '<link rel="stylesheet" href="/css/game-chrome.css?v=1" />';

function bumpScript(html, file, version) {
  const re = new RegExp(`(<script src="[^"]*${file})(?:\\?v=\\d+)?"`, "g");
  return html.replace(re, `$1?v=${version}"`);
}

function inject(html, { hub } = {}) {
  if (html.includes("today-audio.js")) return html;
  if (!html.includes("game-chrome.css")) {
    html = html.replace(/[ \t]*<\/head>/, `    ${CSS}\n  </head>`);
  }
  const audioTag = hub ? '<script src="js/today-audio.js?v=1"></script>' : AUDIO;
  const chromeTag = hub ? '<script src="js/game-chrome.js?v=1"></script>' : CHROME;
  const firstSrc = html.match(/<script src="[^"]+"><\/script>/);
  if (firstSrc) {
    html = html.replace(firstSrc[0], `${audioTag}\n    ${chromeTag}\n    ${firstSrc[0]}`);
  }
  return html;
}

function walkGames() {
  const gamesDir = path.join(root, "games");
  let n = 0;
  for (const id of fs.readdirSync(gamesDir)) {
    const file = path.join(gamesDir, id, "index.html");
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, "utf8");
    const next = bumpScript(
      bumpScript(bumpScript(bumpScript(inject(html), "pause.js", 3), "bgm.js", 6), "hip-core.js", 4),
      "edu-speech.js",
      10
    );
    if (next !== html) {
      fs.writeFileSync(file, next);
      n += 1;
    }
  }
  return n;
}

const hubPath = path.join(root, "index.html");
let hub = fs.readFileSync(hubPath, "utf8");
const hubNext = bumpScript(bumpScript(inject(hub, { hub: true }), "bgm.js", 6), "edu-speech.js", 10);
if (hubNext !== hub) fs.writeFileSync(hubPath, hubNext);

const games = walkGames();
console.log(`updated games=${games} hub=1`);
