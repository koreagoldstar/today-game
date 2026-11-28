/**
 * 이용자 행동 측정 점검 — 실제 저장소를 쓰지 않는다 (가짜 Redis · 이 스크립트가 띄우는 작은 서버 · 실제 Chrome)
 *  방문 · 조회 · 시작 · 완료 · 재플레이 · 다른 게임 · 같은 브라우저 재방문 · 다른 브라우저 · 휴대폰 ·
 *  점수 등록 · 챌린지 · 공유 · 광고 차단(네트워크 오류) · 중복 막기 · 모니터실 표시
 * 사용: node scripts/test-act.js
 */
"use strict";
const path = require("path");
const fs = require("fs");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const TEST_PIN = "test-act-1357"; // 시험용 (운영 비밀번호 아님)
const results = [];
function check(id, name, ok, detail) {
  results.push({ ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}

/* ---------- 가짜 Redis (Upstash pipeline) ---------- */
const store = new Map();
const H = (k) => (store.get(k) && store.get(k).h) || null;
function cmd(c) {
  const op = String(c[0]).toUpperCase();
  const a = c.slice(1);
  switch (op) {
    case "GET":
      return store.has(a[0]) && store.get(a[0]).v != null ? String(store.get(a[0]).v) : null;
    case "SET": {
      if (a.includes("NX") && store.has(a[0])) return null;
      store.set(a[0], { v: String(a[1]) });
      return "OK";
    }
    case "DEL":
      return store.delete(a[0]) ? 1 : 0;
    case "INCR": {
      const n = (Number(store.get(a[0]) && store.get(a[0]).v) || 0) + 1;
      store.set(a[0], { v: n });
      return n;
    }
    case "EXPIRE":
      return store.has(a[0]) ? 1 : 0;
    case "HINCRBY": {
      const e = store.get(a[0]) || { h: {} };
      e.h = e.h || {};
      e.h[a[1]] = (Number(e.h[a[1]]) || 0) + Number(a[2]);
      store.set(a[0], e);
      return e.h[a[1]];
    }
    case "HSET": {
      const e = store.get(a[0]) || { h: {} };
      e.h = e.h || {};
      for (let i = 1; i + 1 < a.length; i += 2) e.h[a[i]] = a[i + 1];
      store.set(a[0], e);
      return 1;
    }
    case "HGETALL": {
      const h = H(a[0]);
      return h ? Object.entries(h).flat().map(String) : [];
    }
    case "PFADD": {
      const e = store.get(a[0]) || { s: new Set() };
      e.s = e.s || new Set();
      const before = e.s.size;
      for (const x of a.slice(1)) e.s.add(x);
      store.set(a[0], e);
      return e.s.size > before ? 1 : 0;
    }
    case "PFCOUNT":
      return (store.get(a[0]) && store.get(a[0]).s && store.get(a[0]).s.size) || 0;
    default:
      throw new Error("unknown " + op);
  }
}
const realFetch = global.fetch;
global.fetch = async (url, opt = {}) => {
  if (String(url).startsWith("http://fake-redis")) {
    const body = JSON.parse(opt.body);
    return { ok: true, json: async () => body.map((c) => ({ result: cmd(c) })) };
  }
  return realFetch(url, opt);
};
process.env.UPSTASH_REDIS_REST_URL = "http://fake-redis";
process.env.UPSTASH_REDIS_REST_TOKEN = "t";
process.env.MONITOR_KEY = TEST_PIN;

const API = { act: require("../api/act.js"), monitor: require("../api/monitor.js") };
const stats = require("../api/_stats.js");
const DAY = stats.seoulDay();
const cnt = (field) => Number((H(`todaygame:act:cnt:${DAY}`) || {})[field] || 0);
const pf = (k) => cmd(["PFCOUNT", k]);
let actRequests = 0;

/* ---------- 작은 서버: 정적 파일 + /api/act · /api/monitor (나머지 /api 는 빈 답) ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".woff2": "font/woff2" };
function vercelRes(res) {
  const r = {
    statusCode: 200,
    setHeader: (k, v) => res.setHeader(k, v),
    status(c) {
      r.statusCode = c;
      return r;
    },
    json(o) {
      res.writeHead(r.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(o));
    },
    end() {
      res.writeHead(r.statusCode);
      res.end();
    },
  };
  return r;
}
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")) {
    let body = "";
    for await (const ch of req) body += ch;
    const name = u.pathname.slice(5).replace(/\/$/, "");
    if (name === "act" || name === "monitor") {
      if (name === "act") actRequests++;
      const r2 = vercelRes(res);
      await API[name]({ method: req.method, headers: req.headers, body, query: Object.fromEntries(u.searchParams), socket: req.socket }, r2);
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, scores: [], rankDay: 1, today: 1, total: 1 }));
    return;
  }
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ channel: "chrome" });
  const newCtx = (o = {}) => browser.newContext({ serviceWorkers: "block", viewport: { width: 1200, height: 860 }, ...o });
  const flush = (p) => p.evaluate(() => window.TodayAct && window.TodayAct.flush()).catch(() => {});
  const settle = async (p) => {
    await flush(p);
    await p.waitForTimeout(500);
  };

  /* --- 1. 첫 방문 · 새로고침 --- */
  const ctxA = await newCtx();
  const a = await ctxA.newPage();
  const errs = [];
  a.on("pageerror", (e) => errs.push(e.message));
  await a.goto(`${BASE}/`);
  await a.waitForFunction(() => window.TodayAct, null, { timeout: 10000 });
  await settle(a);
  check("A1", "홈 첫 방문 = site_visit 1 · 방문 브라우저 1 · 신규 1", cnt("site_visit") === 1 && pf(`todaygame:act:uv:${DAY}`) === 1 && pf(`todaygame:act:new:${DAY}`) === 1, { visit: cnt("site_visit") });
  await a.reload();
  await a.waitForFunction(() => window.TodayAct);
  await settle(a);
  await a.reload();
  await a.waitForFunction(() => window.TodayAct);
  await settle(a);
  check("A2", "새로고침 두 번 = 방문이 늘지 않음 (같은 세션)", cnt("site_visit") === 1);

  /* --- 2. 게임 조회 · 시작 · 완료 · 재플레이 --- */
  await a.goto(`${BASE}/games/flappy/`);
  await a.waitForFunction(() => window.TodayAct);
  await settle(a);
  await a.reload();
  await a.waitForFunction(() => window.TodayAct);
  await settle(a);
  check("B1", "게임 페이지 = game_view 1 (새로고침해도 1) · 방문은 그대로 1", cnt("game_view|flappy") === 1 && cnt("site_visit") === 1);
  check("B2", "페이지만 열면 시작이 아님", cnt("game_start") === 0);
  await a.click("#start-btn");
  await a.waitForTimeout(300);
  check("B3", "시작 버튼 = game_start 1", (await flush(a), await a.waitForTimeout(400), cnt("game_start|flappy")) === 1);
  // 날갯짓 없이 떨어지면 끝 → 결과 화면
  await a.waitForSelector("#over:not(.hidden)", { timeout: 15000 });
  await a.waitForTimeout(400);
  await settle(a);
  const t1 = H(`todaygame:act:time:${DAY}`) || {};
  check("B4", "게임 오버 화면 = game_complete 1 (공용 결과 창 · 화면 감지 중복 없이 한 번) · 플레이 시간 기록", cnt("game_complete|flappy") === 1 && Number(t1["flappy|n"]) === 1 && Number(t1["flappy|ms"]) >= 200, t1);
  await a.click("#retry-btn");
  await a.waitForTimeout(300);
  await a.waitForSelector("#over:not(.hidden)", { timeout: 15000 });
  await a.waitForTimeout(400);
  await settle(a);
  check("B5", "다시! = game_replay 1 · 두 번째 완료 = complete 2 · game_start 는 그대로 1", cnt("game_replay|flappy") === 1 && cnt("game_complete|flappy") === 2 && cnt("game_start|flappy") === 1);

  /* --- 3. 점수 등록 · 공유 --- */
  await a.fill("#player-name", "테스트");
  await a.click("#submit-btn");
  await a.waitForTimeout(500);
  await settle(a);
  check("C1", "랭킹 등록 = score_submit 1 · 이미 끝난 판이라 완료는 그대로 2", cnt("score_submit|flappy") === 1 && cnt("game_complete|flappy") === 2);
  const shareVisible = await a.$("#share-rank-btn:not([hidden])");
  if (shareVisible) {
    await a.click("#share-rank-btn").catch(() => {});
    await a.waitForTimeout(300);
  } else await a.evaluate(() => document.getElementById("share-rank-btn") && (document.getElementById("share-rank-btn").hidden = false, document.getElementById("share-rank-btn").click()));
  await settle(a);
  check("C2", "공유 버튼 = share_click 1", cnt("share_click") === 1);

  /* --- 4. 다른 게임으로 이동 --- */
  await a.goto(`${BASE}/games/ninja-dodge/`);
  await a.waitForFunction(() => window.TodayAct);
  await a.click("#start-btn");
  await a.waitForTimeout(300);
  await settle(a);
  check("D1", "다른 게임 = 그 게임 game_view · game_start 각 1 · 방문은 그대로 1", cnt("game_view|ninja-dodge") === 1 && cnt("game_start|ninja-dodge") === 1 && cnt("site_visit") === 1);

  /* --- 5. 챌린지 --- */
  await a.goto(`${BASE}/games/flappy/?challenge=1`);
  await a.waitForFunction(() => window.TodayAct);
  await a.click("#start-btn");
  await a.waitForTimeout(300);
  await settle(a);
  check("E1", "?challenge=1 에서 시작 = challenge_start 1 · 같은 세션 같은 게임 조회는 그대로 1", cnt("challenge_start") === 1 && cnt("game_view|flappy") === 1);

  /* --- 6. 같은 브라우저 재방문 (다음 날 · 7일 뒤) --- */
  const fdYesterday = new Date(Date.parse(`${DAY}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  await a.evaluate((d) => {
    localStorage.setItem("tg-act-first", d);
    localStorage.removeItem("tg-act-sess");
  }, fdYesterday);
  await a.goto(`${BASE}/`);
  await a.waitForFunction(() => window.TodayAct);
  await settle(a);
  check("F1", "다음 날 다시 온 브라우저 = 새 세션 방문 · 1일 재방문 무리에 들어감 · 신규 아님", cnt("site_visit") === 2 && pf(`todaygame:act:coh:${fdYesterday}:d1`) === 1 && pf(`todaygame:act:coh:${fdYesterday}:w7`) === 1 && pf(`todaygame:act:new:${DAY}`) === 1);

  /* --- 7. 다른 브라우저 · 휴대폰 --- */
  const ctxB = await newCtx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const b = await ctxB.newPage();
  b.on("pageerror", (e) => errs.push(e.message));
  await b.goto(`${BASE}/games/flappy/`);
  await b.waitForFunction(() => window.TodayAct);
  await b.tap("#start-btn");
  await b.waitForTimeout(300);
  await settle(b);
  const dev = H(`todaygame:act:dev:${DAY}`) || {};
  check("G1", "다른 브라우저(휴대폰) = 방문 브라우저 2 · 신규 2 · 기기 휴대폰 세션 1 (PC 는 A 의 두 세션) · 터치 시작도 셈", pf(`todaygame:act:uv:${DAY}`) === 2 && pf(`todaygame:act:new:${DAY}`) === 2 && Number(dev.mobile) === 1 && Number(dev.desktop) === 2 && cnt("game_start|flappy") === 3, dev);

  /* --- 8. 광고 차단 · 네트워크 오류 --- */
  const ctxC = await newCtx();
  const c = await ctxC.newPage();
  const cErr = [];
  c.on("pageerror", (e) => cErr.push(e.message));
  // sendBeacon 은 가로채기가 안 되므로 페이지를 연 뒤 인터넷을 끊어 보낼 수 없게 함
  await c.goto(`${BASE}/games/flappy/`);
  await c.waitForFunction(() => window.TodayAct);
  await ctxC.setOffline(true);
  const before = actRequests;
  await c.click("#start-btn");
  await c.waitForSelector("#over:not(.hidden)", { timeout: 15000 });
  await c.click("#retry-btn");
  await c.waitForTimeout(150);
  const playing = await c.evaluate(() => document.getElementById("over").classList.contains("hidden"));
  await flush(c);
  await c.waitForTimeout(500);
  check("H1", "측정 요청이 막혀도 게임은 그대로 (오류 0 · 다시 하기 정상) · 막힌 이벤트는 저장 안 됨", cErr.length === 0 && playing && actRequests === before, { cErr, playing });
  // 측정 스크립트 자체가 막혀도
  const ctxD = await newCtx();
  const d = await ctxD.newPage();
  const dErr = [];
  d.on("pageerror", (e) => dErr.push(e.message));
  await d.route("**/js/act.js*", (r) => r.abort("blockedbyclient"));
  await d.goto(`${BASE}/games/flappy/`);
  await d.click("#start-btn");
  await d.waitForSelector("#over:not(.hidden)", { timeout: 15000 });
  check("H2", "측정 스크립트가 막혀도 게임 · 결과 화면 정상", dErr.length === 0);

  /* --- 9. 서버: 중복 · 잘못된 값 --- */
  const ev = { id: "a".repeat(24), e: "game_start", g: "flappy", uid: "b".repeat(24), sid: "c".repeat(24), dev: "desktop", src: "direct", fd: DAY };
  const s0 = cnt("game_start|flappy");
  const call = (events) => API.act({ method: "POST", body: JSON.stringify({ events }) }, { setHeader() {}, status() { return this; }, end() {}, json() {} });
  await call([ev]);
  await call([ev]);
  check("I1", "같은 이벤트 id 두 번 = 한 번만 셈", cnt("game_start|flappy") === s0 + 1);
  await call([{ ...ev, id: "d".repeat(24), g: "no-such-game" }, { ...ev, id: "e".repeat(24), e: "hack" }, { ...ev, id: "x", uid: "zz" }]);
  check("I2", "없는 게임 · 모르는 이벤트 · 이상한 id 는 버림", cnt("game_start|flappy") === s0 + 1 && !cnt("hack"));
  const keys = [...store.keys()].filter((k) => k.startsWith("todaygame:act:"));
  check("I3", "저장 키에 IP · 이름 같은 개인정보 없음 (집계 · 익명 id 만)", keys.every((k) => /^todaygame:act:(cnt|uv|new|src|dev|time|coh|id):/.test(k)) && !JSON.stringify([...store.values()].map((v) => v.h || null)).includes("테스트"), keys.slice(0, 6));

  /* --- 10. 모니터실에 보임 --- */
  const m = await (await newCtx()).newPage();
  const mErr = [];
  m.on("pageerror", (e) => mErr.push(e.message));
  await m.goto(`${BASE}/monitor/`);
  await m.fill("#pin", TEST_PIN);
  await m.click("#login-btn");
  await m.waitForSelector("#act-tiles .tile", { timeout: 15000 });
  await m.waitForTimeout(500);
  const view = await m.evaluate(() => ({
    sub: document.getElementById("act-sub").textContent,
    tiles: [...document.querySelectorAll("#act-tiles .tile")].map((t) => t.innerText.replace(/\s+/g, " ")),
    funnel: [...document.querySelectorAll("#act-funnel .fstep")].map((t) => t.innerText.replace(/\s+/g, " ")),
    cmpRows: document.querySelectorAll("#act-cmp-table tbody tr").length,
    games: [...document.querySelectorAll("#act-games tbody tr")].map((t) => t.innerText.replace(/\s+/g, " ")),
    src: document.getElementById("act-src").innerText.replace(/\s+/g, " "),
    oldTiles: document.querySelectorAll("#tiles .tile").length,
  }));
  check("J1", "모니터실: 분석 칸 (방문 브라우저 · 신규 · 재방문 · 재방문율 · 퍼널 5단계 · 기간 비교 · 게임 표 · 유입) + 기존 칸 그대로", view.tiles.length === 7 && /오늘 방문 브라우저 3/.test(view.tiles[0]) /* A · B + 서버 점검(I1)의 익명 id */ && view.funnel.length === 5 && view.cmpRows >= 10 && view.games.length >= 2 && /플래피|펄럭|flappy/i.test(view.games.join()) && view.oldTiles === 5 && mErr.length === 0, view);
  await m.click('#cmp-range [data-cmp="30"]');
  await m.click('#act-game-key [data-key="game_complete"]');
  const view2 = await m.evaluate(() => ({ head: document.querySelector("#act-cmp-table thead").innerText, first: (document.querySelector("#act-games tbody tr") || {}).innerText }));
  check("J2", "기간 비교 30일 · 완료 순 정렬 바꾸기", /최근 30일/.test(view2.head) && /펄럭|플래피|flappy/i.test(view2.first || ""), view2);

  /* --- 11. 가벼움 --- */
  const size = fs.statSync(path.join(ROOT, "js/act.js")).size;
  check("K1", "측정 스크립트 작고(12KB 미만) 늦게(async) 불러옴 · 페이지 오류 0", size < 12000 && errs.length === 0, { size, errs });

  await browser.close();
  server.close();
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - bad}/${results.length} ${bad ? "FAIL" : "PASS"}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
