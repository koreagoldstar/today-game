const fs = require("fs");
const path = require("path");

const FONT = "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap";
const OLD_FONT = "https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Jua&display=swap";
const gamesDir = path.join(__dirname, "..", "games");

for (const id of fs.readdirSync(gamesDir)) {
  if (!id.startsWith("edu-")) continue;
  const file = path.join(gamesDir, id, "index.html");
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  html = html.split(OLD_FONT).join(FONT);
  html = html.replace(/<body([^>]*)>/, (m, attrs) => {
    if (/class=/.test(attrs)) {
      return `<body${attrs.replace(/class="([^"]*)"/, 'class="$1 edu-play"')}>`;
    }
    return `<body class="edu-play"${attrs}>`;
  });
  html = html.replace(/edu-play\.css\?v=\d+/, "edu-play.css?v=7");
  html = html.replace(/game-chrome\.css\?v=\d+/, "game-chrome.css?v=3");
  html = html.replace(/edu-play\.css\?v=\d+/, "edu-play.css?v=8");
  html = html.replace(/game-chrome\.js\?v=\d+/, "game-chrome.js?v=3");
  if (id === "edu-letter-trace") {
    html = html.replace(/game\.js\?v=\d+/, "game.js?v=4");
  }
  fs.writeFileSync(file, html);
  console.log("updated", id);
}
