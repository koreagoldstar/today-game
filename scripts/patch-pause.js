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
  "flappy",
  "doodle",
  "jump-run",
  "ninja-dodge",
  "stork-stride",
  "racing",
  "drift-chick",
  "snake",
  "crossy",
  "tower",
  "brick",
  "fruit-catch",
  "bubble-pop",
  "puzzle-bubble",
  "suika",
  "whack-mole",
  "ttamogi",
  "pinball",
];

function patch(file, label) {
  let code = fs.readFileSync(file, "utf8");
  if (code.includes("TodayPause.mount")) {
    console.log("SKIP", label);
    return;
  }
  const idx = code.lastIndexOf("})();");
  if (idx < 0) {
    console.log("NO END", label);
    return;
  }
  code = code.slice(0, idx) + snippet + "\n" + code.slice(idx);
  fs.writeFileSync(file, code);
  console.log("OK", label);
}

for (const g of games) {
  patch(path.join("games", g, "game.js"), g);
}
patch(path.join("games", "cute-shoot", "js", "game.js"), "cute-shoot");
