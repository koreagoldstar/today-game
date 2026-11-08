"use strict";
/*
 * 로그 — 콘솔(공개 저장소라 Actions 로그는 누구나 봄)과 저장소 기록에 같은 글을 남긴다.
 * 토큰 · 키는 가린다: 환경 변수 중 이름에 TOKEN · SECRET · KEY 가 든 값, access_token= · Bearer · client_secret= 뒤의 값.
 */

const SECRET_NAME = /TOKEN|SECRET|KEY|PASSWORD/i;
const PATTERNS = [
  [/(access_token|client_secret|secret_token|api_key)=([^&\s"']+)/gi, "$1=***"],
  [/(Bearer\s+)[\w.~+/=-]{8,}/gi, "$1***"],
  [/("(?:access_token|token|secret|apiKey|api_key)"\s*:\s*")[^"]+"/gi, '$1***"'],
];

function secretValues(env = process.env) {
  return Object.entries(env)
    .filter(([k, v]) => SECRET_NAME.test(k) && typeof v === "string" && v.length >= 8)
    .map(([, v]) => v)
    .sort((a, b) => b.length - a.length);
}

function mask(text, env = process.env) {
  let s = typeof text === "string" ? text : JSON.stringify(text);
  if (s === undefined) return "";
  for (const v of secretValues(env)) s = s.split(v).join("***");
  for (const [re, to] of PATTERNS) s = s.replace(re, to);
  return s;
}

/** @param {{ log(entry): Promise }} [store] 있으면 저장소 logs 에도 남긴다 */
function createLogger(store, { echo = true } = {}) {
  const write = (level) => async (msg, data = {}) => {
    let safe;
    try {
      safe = JSON.parse(mask(data) || "{}");
    } catch (_) {
      safe = { text: mask(data) };
    }
    const entry = { at: new Date().toISOString(), level, msg: mask(msg), data: safe };
    if (echo) (level === "error" ? console.error : console.log)(`[${level}] ${entry.msg}`);
    if (store) await store.log(entry).catch(() => {});
    return entry;
  };
  return { info: write("info"), warn: write("warn"), error: write("error") };
}

module.exports = { mask, createLogger };
