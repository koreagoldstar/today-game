"use strict";
/* 이 PC 에서만: marketing/.env.local (git 제외) 의 KEY=VALUE 를 환경 변수로. 이미 있는 값은 덮지 않는다. */
const fs = require("fs");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    n++;
  }
  return n;
}

module.exports = { loadEnvFile };
