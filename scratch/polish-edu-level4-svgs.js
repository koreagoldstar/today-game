"use strict";

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "assets", "edu");
const files = [
  "edu_opp_big.svg",
  "edu_opp_small.svg",
  "edu_opp_long.svg",
  "edu_opp_short.svg",
  "edu_opp_hot.svg",
  "edu_opp_cold.svg",
  "edu_opp_fast.svg",
  "edu_opp_slow.svg",
  "edu_opp_many.svg",
  "edu_opp_few.svg",
  "edu_ball.svg",
  "edu_water.svg",
  "edu_carrot.svg",
  "edu_acorn.svg",
];

for (const f of files) {
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("FFF8E8")) continue;
  s = s.replace(/(<svg[^>]*>)/, '$1\n  <rect width="200" height="200" rx="36" fill="#FFF8E8"/>');
  fs.writeFileSync(p, s, "utf8");
  console.log("bg", f);
}
