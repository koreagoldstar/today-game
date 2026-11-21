/**
 * 게임 요청함 (/board/) — 로그인 없이 쓰는 요청 · 투표 게시판
 *
 * GET  ?sort=top|new                         → { posts: [...] } (숨긴 글 빼고 최대 100개)
 * POST { action: "post", kind, title, body, name, device, game? }
 * POST { action: "vote", id, device }        '나도 원해요' (기기마다 한 번)
 * POST { action: "report", id, device }      신고 3번이면 자동으로 숨김
 * 운영자 (모니터실 로그인 열쇠 · Authorization: Bearer <token>)
 * GET  ?sort=…&all=1                         숨긴 글까지
 * POST { action: "admin", id, op: "status"|"reply"|"hide"|"show"|"delete", value? }
 *
 * 아이들이 쓰는 곳이라: 이름은 자동 이름표만 · 전화번호 · 메일 · 주소(링크) 막음 · 나쁜 말 가림 · 도배 제한
 */
const crypto = require("crypto");
const stats = require("./_stats");

const P = "todaygame:board";
const KINDS = ["new", "fix", "talk"];
const STATUSES = ["review", "making", "done"];
const COLORS = ["빨간", "주황", "노란", "초록", "파란", "보라", "분홍", "하늘색", "하얀", "까만"];
const ANIMALS = ["공룡", "펭귄", "토끼", "고양이", "강아지", "병아리", "판다", "여우", "곰", "다람쥐", "고래", "부엉이"];
const NAME_RE = new RegExp(`^(${COLORS.join("|")}) (${ANIMALS.join("|")}) #\\d{4}$`);
const BAD = ["시발", "씨발", "씨바", "씨팔", "시팔", "ㅅㅂ", "ㅆㅂ", "병신", "븅신", "ㅂㅅ", "개새끼", "개색기", "ㅅㄲ", "좆", "존나", "졸라", "지랄", "ㅈㄹ", "미친놈", "미친년", "닥쳐", "꺼져", "엿먹어", "썅", "느금", "니애미", "니미", "애미", "애비", "섹스", "야동", "fuck", "shit", "bitch"];
const LIMITS = { post10m: 3, postDay: 10, voteDay: 80, reportDay: 20 };

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

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
function bearer(req) {
  const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || "");
  const m = h.match(/^Bearer\s+([a-f0-9]{64})$/i);
  return m ? m[1].toLowerCase() : "";
}

/** 나쁜 말은 ● 로 가림 (띄어쓰기 · 점을 섞어 써도 잡도록 글자 사이 공백 허용) */
function mask(text) {
  let out = text;
  for (const w of BAD) {
    const re = new RegExp([...w].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s.·_-]*"), "gi");
    out = out.replace(re, (m) => "●".repeat([...m.replace(/[\s.·_-]/g, "")].length));
  }
  return out;
}
/** 개인정보 · 광고로 보이면 이유를 돌려줌 */
function blocked(text) {
  if (/0\s*1\s*[016789][\s.-]*\d{3,4}[\s.-]*\d{4}/.test(text) || /\d[\d\s.-]{8,}\d/.test(text)) return "전화번호 같은 숫자는 쓸 수 없어요";
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) return "메일 주소는 쓸 수 없어요";
  if (/https?:\/\/|www\.|\.(com|net|kr|io|me|gg)\b/i.test(text)) return "인터넷 주소(링크)는 쓸 수 없어요";
  return "";
}
function clean(s, max) {
  return String(s || "").replace(/[\u0000-\u0009\u000b-\u001f\u007f<>]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

async function run(cmds) {
  return stats.pipeline(cmds);
}
const val = (r) => (r && !r.error ? r.result : null);
function toObj(arr) {
  const o = {};
  for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}
function publicPost(o) {
  return {
    id: Number(o.id),
    kind: o.kind,
    title: o.title,
    body: o.body || "",
    name: o.name,
    ts: Number(o.ts),
    status: o.status || "review",
    votes: Number(o.votes || 0),
    reply: o.reply || "",
    link: o.link || "",
    game: o.game || "",
    hidden: o.hidden === "1",
  };
}

async function isAdmin(req) {
  const token = bearer(req);
  if (!token) return false;
  const out = await run([["GET", `todaygame:monitor:session:${sha(token)}`]]);
  return !!(out && val(out[0]) != null);
}

/** 오늘(서울) 이 사람이 몇 번째인지 세고 한도를 넘었는지 */
async function overLimit(ipHash, kind, max, ttl, bucket = stats.seoulDay()) {
  const key = `${P}:rl:${kind}:${bucket}:${ipHash}`;
  const out = await run([["INCR", key], ["EXPIRE", key, ttl]]);
  return !out || Number(val(out[0])) > max;
}

async function list(sort, withHidden) {
  const z = sort === "new" ? `${P}:new` : `${P}:top`;
  const ids = await run([["ZREVRANGE", z, 0, 149]]);
  const idList = (ids && val(ids[0])) || [];
  if (!idList.length) return [];
  const rows = await run(idList.map((id) => ["HGETALL", `${P}:post:${id}`]));
  if (!rows) return null;
  return rows
    .map((r) => toObj(val(r)))
    .filter((o) => o.id && (withHidden || o.hidden !== "1"))
    .map(publicPost)
    .slice(0, 100);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const send = (code, obj) => res.status(code).json(obj);

  if (req.method === "GET") {
    const admin = req.query && req.query.all === "1" ? await isAdmin(req) : false;
    const posts = await list(req.query && req.query.sort, admin);
    if (!posts) return send(503, { error: "잠시 뒤에 다시 열어 주세요" });
    return send(200, { posts, admin });
  }
  if (req.method !== "POST") return send(405, { error: "method" });

  const b = parseBody(req);
  const ipHash = sha(`board:${clientIp(req)}`).slice(0, 24);
  const device = /^[a-f0-9]{16,64}$/.test(String(b.device || "")) ? String(b.device) : "";

  if (b.action === "post") {
    const kind = KINDS.includes(b.kind) ? b.kind : "";
    const name = String(b.name || "");
    const title = mask(clean(b.title, 40));
    const body = mask(clean(b.body, 300));
    const game = /^[a-z0-9-]{2,40}$/.test(String(b.game || "")) ? String(b.game) : "";
    if (!kind || !device || !NAME_RE.test(name)) return send(400, { error: "다시 열고 써 주세요" });
    if (title.length < 2) return send(400, { error: "제목을 두 글자 이상 써 주세요" });
    const why = blocked(`${title} ${body}`) || blocked(`${b.title || ""} ${b.body || ""}`);
    if (why) return send(400, { error: why });
    if (await overLimit(ipHash, "post10m", LIMITS.post10m, 600, String(Math.floor(Date.now() / 600000)))) return send(429, { error: "조금 있다가 다시 써 주세요" });
    if (await overLimit(ipHash, "postday", LIMITS.postDay, 86400)) return send(429, { error: "오늘은 글을 많이 썼어요. 내일 또 써 주세요" });

    const seq = await run([["INCR", `${P}:seq`]]);
    const id = seq && Number(val(seq[0]));
    if (!id) return send(503, { error: "잠시 뒤에 다시 써 주세요" });
    const ts = Date.now();
    const fields = { id, kind, title, body, name, ts, status: "review", votes: 1, game, ip: ipHash, dev: sha(device).slice(0, 24) };
    const out = await run([
      ["HSET", `${P}:post:${id}`, ...Object.entries(fields).flat().map(String)],
      ["ZADD", `${P}:new`, ts, id],
      ["ZADD", `${P}:top`, 1, id],
      ["SADD", `${P}:voted:${id}`, sha(device)],
    ]);
    if (!out) return send(503, { error: "잠시 뒤에 다시 써 주세요" });
    return send(200, { ok: true, post: publicPost(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)]))) });
  }

  if (b.action === "vote" || b.action === "report") {
    const id = Number(b.id);
    if (!Number.isInteger(id) || id < 1 || !device) return send(400, { error: "다시 열어 주세요" });
    const exists = await run([["HGET", `${P}:post:${id}`, "id"]]);
    if (!exists || val(exists[0]) == null) return send(404, { error: "없는 글이에요" });
    if (b.action === "vote") {
      if (await overLimit(ipHash, "vote", LIMITS.voteDay, 86400)) return send(429, { error: "오늘은 하트를 많이 눌렀어요" });
      const add = await run([["SADD", `${P}:voted:${id}`, sha(device)]]);
      if (!add) return send(503, { error: "잠시 뒤에 다시 눌러 주세요" });
      if (Number(val(add[0])) === 0) return send(200, { ok: true, already: true });
      const out = await run([["HINCRBY", `${P}:post:${id}`, "votes", 1], ["ZINCRBY", `${P}:top`, 1, id]]);
      return send(200, { ok: true, votes: Number(val(out && out[0])) || null });
    }
    if (await overLimit(ipHash, "report", LIMITS.reportDay, 86400)) return send(429, { error: "오늘은 신고를 많이 했어요" });
    const out = await run([["SADD", `${P}:reported:${id}`, sha(device)], ["SCARD", `${P}:reported:${id}`]]);
    if (out && Number(val(out[1])) >= 3) await run([["HSET", `${P}:post:${id}`, "hidden", "1"]]);
    return send(200, { ok: true });
  }

  if (b.action === "admin") {
    if (!(await isAdmin(req))) return send(401, { error: "운영자만 할 수 있어요" });
    const id = Number(b.id);
    if (!Number.isInteger(id) || id < 1) return send(400, { error: "id" });
    const key = `${P}:post:${id}`;
    const v = String(b.value == null ? "" : b.value);
    let cmds;
    if (b.op === "status" && STATUSES.includes(v)) {
      cmds = [["HSET", key, "status", v]];
      const link = String(b.link || "");
      if (v === "done" && /^\/games\/[a-z0-9-]+\/$/.test(link)) cmds.push(["HSET", key, "link", link]);
    } else if (b.op === "reply") cmds = [["HSET", key, "reply", clean(v, 300)]];
    else if (b.op === "hide") cmds = [["HSET", key, "hidden", "1"]];
    else if (b.op === "show") cmds = [["HSET", key, "hidden", "0"], ["DEL", `${P}:reported:${id}`]];
    else if (b.op === "delete") cmds = [["DEL", key, `${P}:voted:${id}`, `${P}:reported:${id}`], ["ZREM", `${P}:new`, id], ["ZREM", `${P}:top`, id]];
    else return send(400, { error: "op" });
    const out = await run(cmds);
    return out ? send(200, { ok: true }) : send(503, { error: "저장소 오류" });
  }

  return send(400, { error: "action" });
};

module.exports._test = { mask, blocked, NAME_RE, COLORS, ANIMALS };
