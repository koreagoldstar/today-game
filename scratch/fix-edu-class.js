const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "games");
for (const id of fs.readdirSync(dir)) {
  if (!id.startsWith("edu-")) continue;
  const file = path.join(dir, id, "index.html");
  let html = fs.readFileSync(file, "utf8");
  const next = html.replace(/class="(?:edu-play\s*)+"/g, 'class="edu-play"');
  if (next !== html) {
    fs.writeFileSync(file, next);
    console.log("fixed", id);
  }
}
