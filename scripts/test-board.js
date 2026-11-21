/**
 * 게임 요청함 API 점검 (가짜 저장소 · 실제 데이터는 건드리지 않음)
 *   node scripts/test-board.js
 */
const crypto = require("crypto");

/* ---------- 가짜 Upstash (pipeline 만) ---------- */
const db = new Map();
const z = (k) => (db.has(k) ? db.get(k) : db.set(k, new Map()).get(k));
const h = (k) => (db.has(k) ? db.get(k) : db.set(k, {}).get(k));
const s = (k) => (db.has(k) ? db.get(k) : db.set(k, new Set()).get(k));
function exec([cmd, k, ...a]) {
  switch (cmd) {
    case "INCR": db.set(k, String(Number(db.get(k) || 0) + 1)); return Number(db.get(k));
    case "EXPIRE": return 1;
    case "GET": return db.has(k) ? db.get(k) : null;
    case "HSET": { const o = h(k); for (let i = 0; i < a.length; i += 2) o[a[i]] = String(a[i + 1]); return a.length / 2; }
    case "HGET": return db.has(k) ? (h(k)[a[0]] ?? null) : null;
    case "HGETALL": return db.has(k) ? Object.entries(h(k)).flat() : [];
    case "HINCRBY": { const o = h(k); o[a[0]] = String(Number(o[a[0]] || 0) + Number(a[1])); return Number(o[a[0]]); }
    case "ZADD": z(k).set(String(a[1]), Number(a[0])); return 1;
    case "ZINCRBY": { const m = z(k); m.set(String(a[1]), (m.get(String(a[1])) || 0) + Number(a[0])); return m.get(String(a[1])); }
    case "ZREM": return z(k).delete(String(a[0])) ? 1 : 0;
    case "ZREVRANGE": return [...z(k).entries()].sort((x, y) => y[1] - x[1] || Number(y[0]) - Number(x[0])).slice(a[0], a[1] + 1).map((e) => e[0]);
    case "SADD": { const st = s(k); const had = st.has(a[0]); st.add(a[0]); return had ? 0 : 1; }
    case "SCARD": return s(k).size;
    case "DEL": { let n = 0; for (const key of [k, ...a]) n += db.delete(key) ? 1 : 0; return n; }
    default: throw new Error("fake redis: " + cmd);
  }
}
process.env.KV_REST_API_URL = "https://fake.upstash";
process.env.KV_REST_API_TOKEN = "t";
global.fetch = async (url, opt) => ({ ok: true, json: async () => JSON.parse(opt.body).map((c) => ({ result: exec(c) })) });

const handler = require("../api/board.js");
const { mask, blocked } = handler._test;

let ip = 1;
async function call(method, body, { query = {}, token = "", sameIp = false } = {}) {
  if (!sameIp) ip += 1;
  const req = { method, body, query, headers: { "x-forwarded-for": `10.0.0.${ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}) } };
  let code = 0, json = null;
  const res = { setHeader() {}, status(c) { code = c; return this; }, json(j) { json = j; } };
  await handler(req, res);
  return { code, json };
}
const dev = () => crypto.randomBytes(16).toString("hex");
const NAME = "초록 공룡 #4821";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

(async () => {
  const a = dev();
  let r = await call("POST", { action: "post", kind: "new", title: "공룡 키우기 게임", body: "알을 키워요", name: NAME, device: a });
  check("B1 글 올리기", r.code === 200 && r.json.post.id === 1 && r.json.post.votes === 1, JSON.stringify(r.json));

  r = await call("POST", { action: "post", kind: "new", title: "철수에요", body: "제 번호 010-1234-5678", name: NAME, device: a });
  check("B2 전화번호 막음", r.code === 400 && /전화번호/.test(r.json.error), r.json.error);
  r = await call("POST", { action: "post", kind: "new", title: "놀러와", body: "www.example.com", name: NAME, device: a });
  check("B3 링크 막음", r.code === 400 && /링크/.test(r.json.error), r.json.error);
  r = await call("POST", { action: "post", kind: "new", title: "재밌어", name: "김철수", device: a });
  check("B4 자유 이름 막음 (자동 이름표만)", r.code === 400, r.json.error);
  check("B5 나쁜 말 가림", mask("이 게임 씨 발 어려워") === "이 게임 ●● 어려워" && mask("병신") === "●●", mask("이 게임 씨 발 어려워"));
  check("B6 평범한 숫자는 허용", blocked("점수 12000 넘었어요") === "", blocked("점수 12000 넘었어요"));

  for (let i = 0; i < 3; i += 1) await call("POST", { action: "post", kind: "talk", title: `도배 ${i}`, name: NAME, device: a }, { sameIp: i > 0 });
  r = await call("POST", { action: "post", kind: "talk", title: "도배 3", name: NAME, device: a }, { sameIp: true });
  check("B7 같은 곳에서 10분에 3개 넘으면 막음", r.code === 429, r.json.error);

  const b = dev();
  r = await call("POST", { action: "vote", id: 1, device: b });
  const r2 = await call("POST", { action: "vote", id: 1, device: b });
  check("B8 나도 원해요 · 같은 기기 두 번은 안 셈", r.json.votes === 2 && r2.json.already === true, JSON.stringify([r.json, r2.json]));

  r = await call("GET", null, { query: { sort: "top" } });
  check("B9 인기순 맨 위", r.code === 200 && r.json.posts[0].id === 1 && r.json.posts[0].votes === 2 && !("ip" in r.json.posts[0]), JSON.stringify(r.json.posts[0]));

  for (let i = 0; i < 3; i += 1) await call("POST", { action: "report", id: 2, device: dev() });
  r = await call("GET", null, { query: { sort: "new" } });
  check("B10 신고 3번이면 숨김", !r.json.posts.some((p) => p.id === 2), r.json.posts.map((p) => p.id).join(","));

  r = await call("POST", { action: "admin", id: 1, op: "status", value: "done", link: "/games/slime-lab/" });
  check("B11 열쇠 없으면 운영자 기능 거절", r.code === 401);
  const token = crypto.randomBytes(32).toString("hex");
  db.set(`todaygame:monitor:session:${crypto.createHash("sha256").update(token).digest("hex")}`, "1");
  r = await call("POST", { action: "admin", id: 1, op: "status", value: "done", link: "/games/slime-lab/" }, { token });
  await call("POST", { action: "admin", id: 1, op: "reply", value: "만들었어요!" }, { token });
  const g = await call("GET", null, { query: { sort: "top" } });
  const p1 = g.json.posts.find((p) => p.id === 1);
  check("B12 운영자 상태 · 링크 · 답글", r.code === 200 && p1.status === "done" && p1.link === "/games/slime-lab/" && p1.reply === "만들었어요!", JSON.stringify(p1));
  r = await call("GET", null, { query: { sort: "new", all: "1" }, token });
  check("B13 운영자는 숨긴 글도 봄", r.json.admin === true && r.json.posts.some((p) => p.id === 2 && p.hidden), "");
  await call("POST", { action: "admin", id: 2, op: "delete" }, { token });
  r = await call("GET", null, { query: { sort: "new", all: "1" }, token });
  check("B14 지우기", !r.json.posts.some((p) => p.id === 2), "");

  let pass = 0;
  for (const x of results) {
    console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.ok ? "" : "  — " + x.detail}`);
    if (x.ok) pass += 1;
  }
  console.log(`\n${pass}/${results.length} PASS`);
  process.exit(pass === results.length ? 0 : 1);
})();
