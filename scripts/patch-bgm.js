const fs = require("fs");
const path = require("path");

const root = process.cwd();
const map = {
  "games/cute-shoot/index.html": "cute-shoot",
  "games/sinseokgi/index.html": "goindol",
  "games/tetris/index.html": "tetris",
  "games/tower/index.html": "tower",
  "games/slide-2048/index.html": "slide-2048",
  "games/brick/index.html": "brick",
  "games/memory/index.html": "memory",
  "games/fruit-catch/index.html": "fruit-catch",
  "games/bubble-pop/index.html": "bubble-pop",
  "games/ttamogi/index.html": "ttamogi",
  "games/suika/index.html": "suika",
  "games/puzzle-bubble/index.html": "puzzle-bubble",
  "games/diff/index.html": "diff",
  "games/sokoban/index.html": "sokoban",
  "games/crossy/index.html": "crossy",
  "games/racing/index.html": "racing",
  "games/minigolf/index.html": "minigolf",
  "index.html": "hub",
};

for (const [rel, id] of Object.entries(map)) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, "utf8");

  if (!/data-bgm=/.test(html)) {
    if (html.includes("<body>")) {
      html = html.replace("<body>", `<body data-bgm="${id}">`);
    } else {
      html = html.replace("<body ", `<body data-bgm="${id}" `);
    }
  }

  if (!html.includes("/js/bgm.js") && !html.includes("js/bgm.js")) {
    if (html.includes('<script src="game.js"></script>')) {
      html = html.replace(
        '<script src="game.js"></script>',
        '<script src="/js/bgm.js"></script>\n    <script src="game.js"></script>'
      );
    } else if (html.includes("js/ads.js")) {
      html = html.replace(
        '<script src="js/ads.js',
        '<script src="/js/bgm.js"></script>\n    <script src="js/ads.js'
      );
    } else if (html.includes('js/main.js')) {
      html = html.replace(
        '<script src="js/main.js"></script>',
        '<script src="js/bgm.js"></script>\n    <script src="js/main.js"></script>'
      );
    } else {
      html = html.replace("</body>", '    <script src="/js/bgm.js"></script>\n  </body>');
    }
  }

  fs.writeFileSync(file, html);
  console.log("ok", id);
}

console.log("done", Object.keys(map).length);
