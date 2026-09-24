"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const main = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
const match = main.match(/const GAMES = (\[[\s\S]*?\n  \]);/);
const GAMES = Function(`"use strict"; return (${match[1]});`)();

const rankable = fs.readFileSync(path.join(root, "js/rankable.js"), "utf8");
const rankIds = [...rankable.matchAll(/id: "([^"]+)"/g)].map((x) => x[1]);

const plays = fs.readFileSync(path.join(root, "api/plays.js"), "utf8");
const scores = fs.readFileSync(path.join(root, "api/scores.js"), "utf8");
function setFrom(src) {
  const m = src.match(/const ALLOWED = new Set\(\[([\s\S]*?)\]\)/);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}
const playIds = new Set(setFrom(plays));
const scoreIds = new Set(setFrom(scores));

const missingPlays = GAMES.map((g) => g.id).filter((id) => !playIds.has(id));
const extraPlays = [...playIds].filter((id) => !GAMES.some((g) => g.id === id));
const missingScores = rankIds.filter((id) => !scoreIds.has(id));
const extraScores = [...scoreIds].filter((id) => !rankIds.includes(id));

const leftover = fs
  .readdirSync(path.join(root, "games"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => !GAMES.some((g) => g.id === name || (g.href || "").includes(`/games/${name}/`)));

const hrefMissing = GAMES.filter((g) => {
  const folder = String(g.href || "").replace(/^\/games\/|\/$/g, "");
  return !fs.existsSync(path.join(root, "games", folder, "index.html"));
}).map((g) => `${g.id} -> ${g.href}`);

console.log(
  JSON.stringify(
    {
      missingPlays,
      extraPlays,
      missingScores,
      extraScores,
      leftoverGameFolders: leftover,
      hrefMissing,
      games: GAMES.length,
      rankable: rankIds.length,
    },
    null,
    2
  )
);
