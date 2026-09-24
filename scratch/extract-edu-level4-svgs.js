"use strict";

const fs = require("fs");
const path = require("path");

const md = fs.readFileSync("C:/Users/COM/Downloads/edu-level4-READY.md", "utf8");
const re = /#### `(edu_[^`]+)`[\s\S]*?```svg\n([\s\S]*?)```/g;
const out = path.join(__dirname, "..", "assets", "edu");
let n = 0;
let m;
while ((m = re.exec(md))) {
  const name = m[1];
  let svg = m[2].trim() + "\n";
  fs.writeFileSync(path.join(out, name), svg, "utf8");
  n += 1;
  console.log(name);
}
console.log("wrote", n);
