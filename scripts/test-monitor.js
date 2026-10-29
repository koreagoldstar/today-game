/**
 * 모니터실 자동 점검 — 실제 저장소 · 실제 비밀번호를 쓰지 않는다
 *  - 가짜 Redis(Upstash 방식) · 가짜 방문자 카운터(abacus)를 메모리에 두고 API 코드를 그대로 돌린다
 *  - 시험용 비밀번호는 이 파일 안의 값 (운영 비밀번호와 무관)
 *  - 브라우저 점검: 이 스크립트가 직접 띄우는 작은 서버(정적 파일 + /api) 에서 실제 Chrome 으로
 *
 * 사용: node scripts/test-monitor.js
 */
"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const TEST_PIN = "test-2468"; // 시험용 (운영 비밀번호 아님)
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}

/* ---------------- 가짜 Redis · abacus ---------------- */
const store = new Map(); // key → { v, exp }
let abacusCalls = 0;
const abacus = new Map();
function alive(k) {
  const e = store.get(k);
  if (!e) return null;
  if (e.exp && e.exp < Date.now()) {
    store.delete(k);
    return null;
  }
  return e;
}
function cmd(c) {
  const [op, ...a] = c.map((x, i) => (i === 0 ? String(x).toUpperCase() : x));
  switch (op) {
    case "GET": {
      const e = alive(a[0]);
      return e ? (typeof e.v === "object" ? null : String(e.v)) : null;
    }
    case "SET": {
      const nx = a.includes("NX");
      const ex = a.indexOf("EX");
      if (nx && alive(a[0])) return null;
      store.set(a[0], { v: String(a[1]), exp: ex > 0 ? Date.now() + Number(a[ex + 1]) * 1000 : 0 });
      return "OK";
    }
    case "DEL":
      return store.delete(a[0]) ? 1 : 0;
    case "INCR": {
      const e = alive(a[0]);
      const n = (e ? Number(e.v) : 0) + 1;
      store.set(a[0], { v: String(n), exp: e ? e.exp : 0 });
      return n;
    }
    case "EXPIRE": {
      const e = alive(a[0]);
      if (!e) return 0;
      e.exp = Date.now() + Number(a[1]) * 1000;
      return 1;
    }
    case "HINCRBY": {
      const e = alive(a[0]) || { v: {}, exp: 0 };
      e.v[a[1]] = (Number(e.v[a[1]]) || 0) + Number(a[2]);
      store.set(a[0], e);
      return e.v[a[1]];
    }
    case "HSET": {
      const e = alive(a[0]) || { v: {}, exp: 0 };
      let n = 0;
      for (let i = 1; i + 1 < a.length; i += 2) {
        if (!(a[i] in e.v)) n++;
        e.v[a[i]] = String(a[i + 1]);
      }
      store.set(a[0], e);
      return n;
    }
    case "HGETALL": {
      const e = alive(a[0]);
      if (!e) return [];
      return Object.entries(e.v).flatMap(([k, v]) => [k, String(v)]);
    }
  }
  throw new Error("가짜 Redis 가 모르는 명령: " + op);
}
const REDIS_URL = "https://fake-redis.test";
global.fetch = async (url, opt = {}) => {
  const u = String(url);
  const json = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj });
  if (u.startsWith(REDIS_URL)) {
    const body = JSON.parse(opt.body || "[]");
    if (u.endsWith("/pipeline")) return json(body.map((c) => ({ result: cmd(c) })));
    return json({ result: cmd(body) });
  }
  const m = u.match(/abacus\.jasoncameron\.dev\/(hit|get)\/[^/]+\/(.+)$/);
  if (m) {
    abacusCalls++;
    const k = decodeURIComponent(m[2]);
    if (m[1] === "hit") {
      abacus.set(k, (abacus.get(k) || 0) + 1);
      return json({ value: abacus.get(k) });
    }
    return abacus.has(k) ? json({ value: abacus.get(k) }) : json({ error: "Key not found" }, 404);
  }
  throw new Error("점검 중 바깥 주소 호출 금지: " + u);
};
process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

const handlers = {
  monitor: require("../api/monitor.js"),
  plays: require("../api/plays.js"),
  scores: require("../api/scores.js"),
  visits: require("../api/visits.js"),
};
const stats = require("../api/_stats.js");

/** 서버리스 함수 한 번 부르기 */
async function invoke(name, { method = "GET", body = null, headers = {}, query = {}, ip = "1.1.1.1" } = {}) {
  let status = 200;
  let out = null;
  const res = {
    setHeader() {},
    status(c) {
      status = c;
      return res;
    },
    json(o) {
      out = o;
      return res;
    },
    end() {
      return res;
    },
  };
  await handlers[name]({ method, body, headers: { "x-forwarded-for": ip, ...headers }, query, socket: {} }, res);
  return { status, json: out };
}

function seed() {
  const today = stats.seoulDay();
  const d = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < 110; i++) {
    const day = d.toISOString().slice(0, 10);
    if (day >= "2026-07-15") abacus.set(`day-${day}`, 20 + ((i * 37) % 60));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  cmd(["SET", "todaygame:visits:total", "5000"]);
  cmd(["SET", stats.dayKey("visitors", today), "7"]); // 2026-10-29 부터 오늘 방문자는 우리 저장소
  for (const [g, n] of [
    ["jelly-factory", 120],
    ["slime-lab", 300],
    ["tetris", 900],
    ["suika", 450],
  ])
    cmd(["HINCRBY", "todaygame:plays", g, n]);
  // 어제 · 그제 기록 (날짜별 기록이 시작된 뒤라고 가정)
  const y = new Date(`${today}T00:00:00Z`);
  for (let k = 1; k <= 2; k++) {
    y.setUTCDate(y.getUTCDate() - 1);
    const day = y.toISOString().slice(0, 10);
    cmd(["HINCRBY", stats.dayKey("plays", day), "tetris", 10 * k]);
    cmd(["HINCRBY", stats.dayKey("plays", day), "slime-lab", 4 * k]);
    cmd(["HINCRBY", stats.dayKey("ranks", day), "tetris", k]);
  }
}

(async () => {
  seed();
  /* ---------- M1: 설정 없음 ---------- */
  delete process.env.MONITOR_KEY;
  const noKey = await invoke("monitor", { method: "POST", body: { action: "login", pin: "x" } });
  process.env.UPSTASH_REDIS_REST_URL = "";
  const noStore = await invoke("monitor", { method: "GET" });
  process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
  check("M1", "비밀번호가 서버에 없으면 들어갈 수 없음 · 저장소가 없으면 안내", noKey.status === 503 && noKey.json.error === "key-not-configured" && noStore.status === 503, `${noKey.status} ${noKey.json.error} · ${noStore.status} ${noStore.json.error}`);

  process.env.MONITOR_KEY = TEST_PIN;
  /* ---------- M2: 틀린 비밀번호 · 잠금 ---------- */
  const tries = [];
  for (let i = 0; i < 5; i++) tries.push(await invoke("monitor", { method: "POST", body: { action: "login", pin: "000000" }, ip: "9.9.9.9" }));
  const lockedRight = await invoke("monitor", { method: "POST", body: { action: "login", pin: TEST_PIN }, ip: "9.9.9.9" });
  const otherRight = await invoke("monitor", { method: "POST", body: { action: "login", pin: TEST_PIN }, ip: "2.2.2.2" });
  check("M2", "틀리면 401 (남은 횟수) · 같은 곳에서 5번 틀리면 맞는 비밀번호도 15분 잠금 · 다른 곳은 그대로", tries.slice(0, 5).every((t) => t.status === 401) && tries[0].json.left === 4 && tries[4].json.left === 0 && lockedRight.status === 429 && lockedRight.json.retryMinutes === 15 && otherRight.status === 200 && /^[a-f0-9]{64}$/.test(otherRight.json.token), `남은 ${tries.map((t) => t.json.left).join(",")} · 잠긴 곳 ${lockedRight.status} · 다른 곳 ${otherRight.status}`);

  /* ---------- M3: 여러 곳에서 마구 시도 → 전체 잠금 ---------- */
  for (let i = 0; i < 30; i++) await invoke("monitor", { method: "POST", body: { action: "login", pin: String(100000 + i) }, ip: `10.0.${i}.1` });
  const globalLocked = await invoke("monitor", { method: "POST", body: { action: "login", pin: TEST_PIN }, ip: "3.3.3.3" });
  check("M3", "여러 곳에서 1시간에 30번 넘게 틀리면 1시간 동안 모두 잠금 (비밀번호를 하나씩 맞혀 보는 공격 막기)", globalLocked.status === 429 && globalLocked.json.retryMinutes === 60, `${globalLocked.status} ${JSON.stringify(globalLocked.json)}`);
  for (const k of [...store.keys()]) if (k.startsWith("todaygame:monitor:fail:")) store.delete(k);

  /* ---------- M4: 열쇠(토큰) ---------- */
  const login = await invoke("monitor", { method: "POST", body: { action: "login", pin: TEST_PIN } });
  const token = login.json.token;
  const auth = { authorization: `Bearer ${token}` };
  const noTok = await invoke("monitor", { method: "GET" });
  const badTok = await invoke("monitor", { method: "GET", headers: { authorization: `Bearer ${"a".repeat(64)}` } });
  const got = await invoke("monitor", { method: "GET", headers: auth, query: { days: "30" } });
  const sessionKeys = [...store.keys()].filter((k) => k.startsWith("todaygame:monitor:session:"));
  const tokenStored = sessionKeys.some((k) => k.endsWith(token));
  const g = got.json;
  const today = g.days[g.days.length - 1];
  const yesterday = g.days[g.days.length - 2];
  check("M4", "맞으면 열쇠 발급(저장소엔 열쇠 원문 대신 지문만) · 열쇠 없거나 틀리면 401 · 있으면 30일 통계 (방문자 · 게임별 참여 · 랭킹 · 제목)", login.status === 200 && noTok.status === 401 && badTok.status === 401 && got.status === 200 && g.days.length === 30 && today.day === stats.seoulDay() && today.visitors > 0 && yesterday.plays.tetris === 10 && yesterday.ranks.tetris === 1 && g.playsTotal.tetris === 900 && g.visitTotal === 5000 && g.titles["jelly-factory"] === "말랑콩떡! 젤리 공장" && !tokenStored && sessionKeys.length >= 1, `발급 ${login.status} · 없음 ${noTok.status} · 틀림 ${badTok.status} · 받음 ${got.status} (${g.days.length}일 · 오늘 방문 ${today.visitors} · 어제 테트리스 ${yesterday.plays.tetris}) · 열쇠 원문 저장 ${tokenStored}`);

  /* ---------- M5: 날짜별 기록 ---------- */
  await invoke("plays", { method: "POST", body: { game: "jelly-factory" } });
  await invoke("plays", { method: "POST", body: { game: "jelly-factory" } });
  await invoke("plays", { method: "POST", body: { game: "no-such-game" } });
  await invoke("scores", { method: "POST", body: { game: "jelly-factory", name: "점검이", score: 777 } });
  const v0 = Number(cmd(["GET", stats.dayKey("visitors", stats.seoulDay())]) || 0);
  const totalBefore = Number(cmd(["GET", "todaygame:visits:total"]) || 0);
  abacusCalls = 0;
  const counted = (await invoke("visits", { method: "GET", query: { count: "1" } })).json;
  const readOnly = (await invoke("visits", { method: "GET", query: {} })).json;
  const visitsAbacus = abacusCalls;
  const v1 = Number(cmd(["GET", stats.dayKey("visitors", stats.seoulDay())]) || 0);
  const after = (await invoke("monitor", { method: "GET", headers: auth, query: { days: "7" } })).json;
  const t2 = after.days[after.days.length - 1];
  check("M5", "게임 열기 · 랭킹 등록 · 방문이 오늘 날짜로 쌓임 (없는 게임은 안 셈 · 세지 않는 조회는 안 셈) · 누적도 그대로 늘어남", t2.plays["jelly-factory"] === 2 && !t2.plays["no-such-game"] && t2.ranks["jelly-factory"] === 1 && v1 === v0 + 1 && after.playsTotal["jelly-factory"] === 122 && t2.tracked, `오늘 젤리 공장 참여 ${t2.plays["jelly-factory"]} · 랭킹 ${t2.ranks["jelly-factory"]} · 방문 ${v0}→${v1} · 누적 ${after.playsTotal["jelly-factory"]}`);

  check("M5b", "홈 '오늘 방문' 숫자 = 모니터실 오늘 방문자 (우리 저장소 · 바깥 카운터 안 부름) · 세면 오늘 · 누적 +1 · 읽기만 하면 그대로", counted.today === v1 && readOnly.today === v1 && t2.visitors === v1 && counted.total === totalBefore + 1 && readOnly.total === counted.total && visitsAbacus === 0, `세기 ${JSON.stringify(counted)} · 읽기 ${JSON.stringify(readOnly)} · 모니터 오늘 ${t2.visitors} · 바깥 호출 ${visitsAbacus}`);

  /* ---------- M6: 지난 방문자 수는 한 번만 바깥에서 ---------- */
  abacusCalls = 0;
  await invoke("monitor", { method: "GET", headers: auth, query: { days: "90" } });
  const first = abacusCalls;
  abacusCalls = 0;
  await invoke("monitor", { method: "GET", headers: auth, query: { days: "90" } });
  const second = abacusCalls;
  check("M6", "지난 날 방문자 수는 한 번 읽으면 저장해 두고 다음부터는 오늘 것만 바깥 카운터에서 (90일 화면도 빠르게)", first >= 55 && second <= 2, `처음 ${first}번 → 다음 ${second}번`);

  /* ---------- M7: 나가기 ---------- */
  await invoke("monitor", { method: "POST", body: { action: "logout" }, headers: auth });
  const out = await invoke("monitor", { method: "GET", headers: auth });
  check("M7", "나가기 하면 그 열쇠는 더 못 씀", out.status === 401, `${out.status}`);

  /* ---------- 브라우저 점검 ---------- */
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (_) {
    console.log("playwright 없음 → 브라우저 점검 건너뜀");
  }
  if (chromium) await browserChecks(chromium);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e && e.stack ? e.stack : e);
  process.exit(1);
});

/* ---------------- 작은 서버 (정적 파일 + /api) ---------------- */
function startServer() {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const m = u.pathname.match(/^\/api\/([a-z-]+)$/);
    if (m && handlers[m[1]]) {
      let raw = "";
      for await (const c of req) raw += c;
      let status = 200;
      const adapter = {
        setHeader: (k, v) => res.setHeader(k, v),
        status(c) {
          status = c;
          return adapter;
        },
        json(o) {
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(o));
          return adapter;
        },
        end() {
          res.writeHead(status);
          res.end();
          return adapter;
        },
      };
      await handlers[m[1]]({ method: req.method, headers: { ...req.headers, "x-forwarded-for": "127.0.0.1" }, query: Object.fromEntries(u.searchParams), body: raw ? JSON.parse(raw) : null, socket: {} }, adapter);
      return;
    }
    let p = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!p.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

async function browserChecks(chromium) {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome" });
  } catch (_) {
    browser = await chromium.launch();
  }
  const errors = [];
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: opts.w || 1280, height: opts.h || 900 }, colorScheme: opts.dark ? "dark" : "light", isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
    p.ctx = ctx;
    return p;
  };
  const p = await open();
  await p.goto(`${base}/monitor/`);
  const robots = await p.getAttribute('meta[name="robots"]', "content");
  const loginShown = await p.isVisible("#login");
  await p.fill("#pin", "999999");
  await p.click("#login-btn");
  await p.waitForFunction(() => /달라요/.test(document.getElementById("login-msg").textContent));
  const wrongMsg = await p.textContent("#login-msg");
  await p.fill("#pin", TEST_PIN);
  await p.click("#login-btn");
  await p.waitForFunction(() => window.__monitor && window.__monitor.data, null, { timeout: 10000 });
  const dash = await p.evaluate(() => ({
    tiles: [...document.querySelectorAll(".tile")].map((t) => t.textContent.replace(/\s+/g, " ").trim()),
    visitBars: document.querySelectorAll("#chart-visit path.bar").length,
    playBars: document.querySelectorAll("#chart-play path.bar").length,
    top: [...document.querySelectorAll("#chart-top .hrow .name")].map((n) => n.textContent),
    rows: document.querySelectorAll("#games-table tbody tr").length,
    firstRow: document.querySelector("#games-table tbody tr td").textContent,
    scrollW: document.documentElement.scrollWidth - innerWidth,
  }));
  check("B1", "모니터실: 검색 제외 표시 · 잠금 화면 · 틀린 비밀번호 안내 → 맞으면 요약 칸 · 일별 그래프 · 많이 한 게임 · 게임별 표", /noindex/.test(robots) && loginShown && /달라요/.test(wrongMsg) && dash.tiles.length === 5 && /오늘 방문자/.test(dash.tiles[0]) && dash.visitBars >= 25 && dash.playBars >= 2 && dash.top[0] === "말랑콩떡! 젤리 공장" && dash.rows >= 80 && dash.scrollW <= 1, `요약 [${dash.tiles.map((t) => t.slice(0, 18)).join(" | ")}] · 방문 막대 ${dash.visitBars} · 참여 막대 ${dash.playBars} · 1위 ${dash.top[0]} · 표 ${dash.rows}줄`);

  // 기간 · 정렬 · 찾기 · 표 보기 · 툴팁
  await p.click('#range button[data-days="7"]');
  const r7 = await p.evaluate(() => ({ bars: document.querySelectorAll("#chart-visit path.bar").length, tile: document.querySelectorAll(".tile")[1].textContent }));
  await p.click('#range button[data-days="90"]');
  const r90 = await p.evaluate(() => document.querySelectorAll("#chart-visit path.bar").length);
  await p.click('#games-table th:nth-child(5) button'); // 누적 → 내림차순
  const sorted = await p.evaluate(() => document.querySelector("#games-table tbody tr td").textContent);
  await p.fill("#game-search", "슬라임");
  const found = await p.evaluate(() => [...document.querySelectorAll("#games-table tbody tr td.game")].map((t) => t.textContent));
  await p.fill("#game-search", "");
  await p.click('[data-table="visit"]');
  const tbl = await p.evaluate(() => ({ shown: !document.getElementById("table-visit").hidden, rows: document.querySelectorAll("#table-visit tbody tr").length, chartHidden: document.getElementById("chart-visit").hidden }));
  await p.click('[data-table="visit"]');
  const bar = await p.$("#chart-visit rect.bar-hit:last-of-type");
  const box = await bar.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height - 4);
  const tip = await p.evaluate(() => ({ shown: !document.getElementById("tip").hidden, text: document.getElementById("tip").textContent }));
  await p.click('#top-range button[data-top="all"]');
  const topAll = await p.evaluate(() => document.querySelector("#chart-top .hrow .name").textContent);
  check("B2", "기간 7일 · 90일 바꾸기 · 표 정렬(누적) · 게임 찾기 · 그래프 ↔ 표 · 막대 위 툴팁 · 많이 한 게임 기준 바꾸기", r7.bars === 7 && /7일 방문자 합/.test(r7.tile) && r90 >= 85 && sorted === "블록 팡팡" && found.length === 1 && /슬라임/.test(found[0]) && tbl.shown && tbl.rows === 90 && tbl.chartHidden && tip.shown && /방문자/.test(tip.text) && topAll === "블록 팡팡", `7일 막대 ${r7.bars} · 90일 ${r90} · 누적 1위 ${sorted} · 찾기 ${found} · 표 ${tbl.rows}줄 · 툴팁 "${tip.text}" · 누적 기준 1위 ${topAll}`);

  // 새로고침해도 들어와 있음 → 나가기 → 잠금
  await p.reload();
  await p.waitForFunction(() => window.__monitor && window.__monitor.data, null, { timeout: 10000 });
  const stay = await p.isVisible("#app");
  await p.click("#logout-btn");
  await p.waitForSelector("#login", { state: "visible" });
  const tokenLeft = await p.evaluate(() => localStorage.getItem("today-monitor-token"));
  await p.reload();
  const backToLogin = await p.isVisible("#login");
  check("B3", "새로고침해도 이 기기에선 그대로 · 나가기 하면 잠금 화면으로 (열쇠 지움)", stay && !tokenLeft && backToLogin, `유지 ${stay} · 남은 열쇠 ${tokenLeft} · 다시 잠금 ${backToLogin}`);
  await p.ctx.close();

  // 휴대폰 · 어두운 화면
  const m = await open({ w: 390, h: 844, mobile: true, dark: true });
  await m.goto(`${base}/monitor/`);
  await m.fill("#pin", TEST_PIN);
  await m.click("#login-btn");
  await m.waitForFunction(() => window.__monitor && window.__monitor.data, null, { timeout: 10000 });
  const mob = await m.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    bg: getComputedStyle(document.body).backgroundColor,
    tilesInView: [...document.querySelectorAll(".tile")].every((t) => t.getBoundingClientRect().right <= innerWidth + 1),
  }));
  await m.screenshot({ path: path.join(ROOT, "test-results", "monitor-mobile-dark.png"), fullPage: true }).catch(() => {});
  check("B4", "휴대폰(390px) · 어두운 화면: 옆으로 넘치지 않음 · 어두운 배경", mob.overflow <= 1 && mob.tilesInView && mob.bg === "rgb(13, 13, 13)", mob);
  await m.ctx.close();
  check("B5", "페이지 오류 없음", errors.length === 0, errors.length ? errors.slice(0, 4) : "없음");
  await browser.close();
  server.close();
}
