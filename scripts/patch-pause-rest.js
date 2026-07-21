const fs = require("fs");
const path = require("path");

const snippet = `
  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => state === "play",
      isPaused: () => state === "paused",
      pause() {
        if (state !== "play") return false;
        state = "paused";
        return true;
      },
      resume() {
        if (state !== "paused") return false;
        state = "play";
        if (typeof last !== "undefined") last = performance.now();
        return true;
      },
    });
  }
`;

const games = [
  "alggagi",
  "beat-tap",
  "diff",
  "dual-pad",
  "memory",
  "minigolf",
  "odd-even",
  "omok",
  "rhythm",
  "rps",
  "slide-beat",
  "sokoban",
];

function insertScript(htmlPath) {
  let html = fs.readFileSync(htmlPath, "utf8");
  if (html.includes("pause.js")) return "skip-tag";
  if (html.includes('/js/game-rank.js')) {
    html = html.replace(
      '<script src="/js/game-rank.js"></script>',
      '<script src="/js/game-rank.js"></script>\n    <script src="/js/pause.js"></script>'
    );
  } else if (html.includes('/js/scores.js')) {
    html = html.replace(
      '<script src="/js/scores.js"></script>',
      '<script src="/js/scores.js"></script>\n    <script src="/js/pause.js"></script>'
    );
  } else if (html.includes('/js/bgm.js')) {
    html = html.replace(
      '<script src="/js/bgm.js"></script>',
      '<script src="/js/bgm.js"></script>\n    <script src="/js/pause.js"></script>'
    );
  } else {
    return "no-tag-point";
  }
  fs.writeFileSync(htmlPath, html);
  return "ok-tag";
}

function insertMount(jsPath) {
  let code = fs.readFileSync(jsPath, "utf8");
  if (code.includes("TodayPause.mount")) return "skip-mount";
  const idx = code.lastIndexOf("})();");
  if (idx < 0) return "no-end";
  code = code.slice(0, idx) + snippet + "\n" + code.slice(idx);
  fs.writeFileSync(jsPath, code);
  return "ok-mount";
}

for (const g of games) {
  const html = path.join("games", g, "index.html");
  const js = path.join("games", g, "game.js");
  console.log(g, insertScript(html), insertMount(js));
}

// wordle + slide-2048 + minesweeper: script tags only here
for (const g of ["wordle", "slide-2048", "minesweeper"]) {
  console.log(g, insertScript(path.join("games", g, "index.html")), "manual-mount");
}
