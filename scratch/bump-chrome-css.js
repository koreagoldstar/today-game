const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "games");
for (const id of fs.readdirSync(dir)) {
  if (!id.startsWith("edu-")) continue;
  const file = path.join(dir, id, "index.html");
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/game-chrome\.css\?v=\d+/, "game-chrome.css?v=4");
  fs.writeFileSync(file, html);
}
console.log("bumped chrome css");
