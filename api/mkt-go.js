/**
 * 홍보 링크 클릭 세기 → 사이트 주소로 이동 (결정 4 안 A, PHASE 10)
 *   /api/mkt-go?c=<콘텐츠 id>&ch=<채널>&to=<사이트 안 경로 + UTM>
 *  - to 는 이 사이트 안의 경로만 (다른 사이트로 보내는 열린 리다이렉트 금지). 틀리면 홈으로.
 *  - 링크 미리보기 봇(facebookexternalhit · 텔레그램 · 카카오 등)은 세지 않는다.
 *  - 저장: todaygame:mkt:clicks:{id} · clicks:{id}:{채널} · clicks:day:{서울 날짜}:{채널}. 저장이 늦거나 실패해도 이동은 바로.
 */
const { createStore } = require("../marketing/core/store");

const SITE = "https://www.todaygame.co.kr";
const CHANNELS = ["instagram", "threads", "facebook", "youtube"];
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|meta-external|embedly|whatsapp|telegram|discord|kakaotalk-scrap|skypeuripreview|headless|lighthouse/i;

/** 사이트 안 경로만 통과 (//다른곳 · \ · 스킴 금지) */
function destination(to) {
  const s = String(to || "/");
  if (!/^\/(?![\/\\])[^\s\\]*$/.test(s)) return `${SITE}/`;
  const u = new URL(s, SITE);
  return u.origin === SITE ? u.toString() : `${SITE}/`;
}

let store = null;

module.exports = async function handler(req, res) {
  const q = req.query || {};
  const dest = destination(q.to);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
  const ua = String((req.headers && req.headers["user-agent"]) || "");
  if (req.method === "GET" && ua && !BOT.test(ua)) {
    const c = /^[\w-]{4,80}$/.test(String(q.c || "")) ? String(q.c) : null;
    const ch = CHANNELS.includes(q.ch) ? q.ch : "other";
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const cmds = [
      ["INCR", `clicks:day:${day}:${ch}`],
      ["EXPIRE", `clicks:day:${day}:${ch}`, 120 * 86400],
    ];
    if (c) cmds.push(["INCR", `clicks:${c}`], ["EXPIRE", `clicks:${c}`, 180 * 86400], ["INCR", `clicks:${c}:${ch}`], ["EXPIRE", `clicks:${c}:${ch}`, 180 * 86400]);
    try {
      if (!store) store = createStore();
      await Promise.race([store.batch(cmds), new Promise((r) => setTimeout(r, 800))]); // 세기가 늦어도 이동은 0.8초 안에
    } catch (_) {}
  }
  res.statusCode = 302;
  res.setHeader("Location", dest);
  res.end();
};

module.exports.destination = destination;
module.exports.BOT = BOT;
