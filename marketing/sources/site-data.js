"use strict";
/*
 * 사이트 소스에서 데이터 · 함수를 그대로 꺼내 쓴다 (베껴 쓰지 않음 — 사이트가 바뀌면 같이 바뀜).
 * 꺼내는 것은 순수 데이터 리터럴 · 순수 함수뿐 (네트워크 · DOM 없음).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** 소스 안의 `const NAME = <리터럴>;` 를 값으로 */
function literal(rel, name, closer = ";") {
  const src = read(rel);
  const at = src.indexOf(`const ${name} =`);
  if (at < 0) throw new Error(`${rel} 에서 ${name} 를 찾지 못했습니다.`);
  const start = src.indexOf("=", at) + 1;
  // 괄호 짝을 맞춰 리터럴 끝을 찾는다
  let depth = 0;
  let i = start;
  for (; i < src.length; i++) {
    const ch = src[i];
    if ("[{(".includes(ch)) depth++;
    else if ("]})".includes(ch)) depth--;
    else if (ch === closer && depth === 0) break;
  }
  return Function(`"use strict"; return (${src.slice(start, i)});`)();
}

/** 소스 안의 `function NAME(...) {...}` 를 함수로 */
function fn(rel, name) {
  const src = read(rel);
  const at = src.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`${rel} 에서 함수 ${name} 를 찾지 못했습니다.`);
  let depth = 0;
  let i = src.indexOf("{", at);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return Function(`"use strict"; return (${src.slice(at, i + 1)});`)();
}

const kstDay = (t = Date.now()) => new Date(t + 9 * 3600e3).toISOString().slice(0, 10);

module.exports = { ROOT, read, literal, fn, kstDay };
