/**
 * 홍보 자동화 웹 관리자 API (/mkt-admin/ 화면이 부른다) — 실제 처리는 marketing/core/admin.js
 *  잠금: Vercel 환경 변수 MKT_ADMIN_KEY (24자 이상) · 저장소: 사이트와 같은 Upstash (키는 todaygame:mkt:* 만)
 *  POST { action: "login", key } → { token } · 그 밖의 요청은 Authorization: Bearer <token>
 *  CORS 허용 헤더를 주지 않는다 (같은 사이트의 관리자 화면만 씀). 녹화 · 인코딩 같은 오래 걸리는 일은 하지 않는다.
 */
const { createStore } = require("../marketing/core/store");
const { createAdmin } = require("../marketing/core/admin");

function clientIp(req) {
  const xf = String((req.headers && req.headers["x-forwarded-for"]) || "");
  return (xf.split(",")[0] || (req.socket && req.socket.remoteAddress) || "unknown").trim();
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body));
  } catch (_) {
    return {};
  }
}

let admin = null;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (!admin) admin = createAdmin({ store: createStore() });
  } catch (e) {
    res.status(503).json({ ok: false, error: "저장소가 설정되지 않았습니다." });
    return;
  }
  const out = await admin.handle({ method: req.method, query: req.query || {}, body: parseBody(req), headers: req.headers || {}, ip: clientIp(req) });
  res.status(out.status).json(out.body);
};
