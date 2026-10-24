/**
 * 말랑콩떡! 젤리 공장 — 자동 점검 (규칙 엔진 · 스테이지 풀이 검증 · 실제 브라우저 · 실제 마우스 · 키보드 · 터치)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-jelly-factory.js  (JF_ONLY=J4,J9 처럼 골라서도 됨)
 *
 * - /api/* 는 가짜 응답 → 실제 랭킹 · 집계에 아무것도 쓰지 않는다.
 * - 저장 데이터는 테스트마다 새 브라우저 칸에서.
 * - 젤리 이동은 실제 마우스 클릭 · 끌기, 터치 밀기, 키보드로 한다 (연출 속도만 빠르게).
 * - 날짜가 바뀌는 상황은 브라우저의 Date 만 바꿔서 흉내 낸다.
 */
"use strict";

const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.error("playwright 가 필요해요: npm i -D playwright");
  process.exit(2);
}

const ROOT = path.join(__dirname, "..");
const BASE = process.env.JF_BASE || "http://localhost:3456";
const GAME = `${BASE}/games/jelly-factory/`;
const KEY = "today-jelly-factory-v1";
const ONLY = (process.env.JF_ONLY || "").split(",").filter(Boolean);
const want = (id) => !ONLY.length || ONLY.includes(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (_) {
    return await chromium.launch();
  }
}
const apiLog = [];
const warnLog = [];
const KST = (s) => Date.parse(s + "+09:00");
async function openPage(browser, { width = 1280, height = 800, touch = false, save = null, errors = [], noStorage = false, now = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: "block" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("PAGE " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200));
    if (m.type() === "warning" && /화면 · 규칙/.test(m.text())) warnLog.push(m.text());
  });
  p.on("response", (r) => {
    if (r.status() >= 400 && !/\/api\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await p.route("**/api/**", (r) => {
    const q = r.request();
    apiLog.push({ url: q.url(), method: q.method(), body: q.postData() || "" });
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, scores: [], items: [], today: 1, total: 1 }) });
  });
  await p.addInitScript(
    ([key, save, noStorage, now]) => {
      // 날짜 흉내 (기본은 진짜 시계)
      const RealDate = Date;
      let off = now == null ? 0 : now - RealDate.now();
      class FakeDate extends RealDate {
        constructor(...a) {
          if (a.length === 0) super(RealDate.now() + off);
          else super(...a);
        }
        static now() {
          return RealDate.now() + off;
        }
      }
      window.Date = FakeDate;
      window.__setNow = (ms) => {
        off = ms - RealDate.now();
      };
      if (noStorage) {
        Storage.prototype.setItem = () => {
          throw new Error("QuotaExceededError");
        };
        Storage.prototype.getItem = () => {
          throw new Error("SecurityError");
        };
        return;
      }
      if (sessionStorage.getItem("__jf_init")) return;
      sessionStorage.setItem("__jf_init", "1");
      if (save) localStorage.setItem(key, JSON.stringify(save));
      else localStorage.removeItem(key);
    },
    [KEY, save, noStorage, now]
  );
  p.ctx = ctx;
  return p;
}
const G = (p, fn, arg) => p.evaluate(fn, arg);
async function load(p, speed = 5) {
  const t0 = Date.now();
  await p.goto(GAME);
  await p.waitForFunction(() => window.JellyFactory && !document.getElementById("title").hidden, null, { timeout: 15000 });
  await G(p, (sp) => {
    window.JellyFactory.testSpeed = sp;
  }, speed);
  return Date.now() - t0;
}
const S = (p) =>
  G(p, () => {
    const g = window.JellyFactory;
    return { ...g.probe(), stack: g.ui.stack.slice(), title: !document.getElementById("title").hidden, hud: !document.getElementById("hud").hidden };
  });
async function until(p, pred, ms = 10000, label = "") {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await S(p);
    if (pred(s)) return s;
    await sleep(30);
  }
  throw new Error(`시간 초과: ${label} (${JSON.stringify(s && { mode: s.mode, busy: s.busy, stack: s.stack, moves: s.moves })})`);
}
const idle = (p, label) => until(p, (s) => !s.busy, 8000, label || "연출 끝");
const pt = (p, x, y) => G(p, ([x, y]) => window.JellyFactory.cellPoint(x, y), [x, y]);
const DXY = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
/** 마우스로 끌어서 밀기 */
async function mouseDrag(p, x, y, d) {
  const a = await pt(p, x, y);
  const cell = (await S(p)).cell;
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  for (let k = 1; k <= 5; k++) await p.mouse.move(a.x + (DXY[d][0] * cell * 0.8 * k) / 5, a.y + (DXY[d][1] * cell * 0.8 * k) / 5);
  await p.mouse.up();
}
/** 마우스로 눌러 고른 뒤 도착 칸 누르기 */
async function mouseClickMove(p, x, y, d) {
  const a = await pt(p, x, y);
  await p.mouse.click(a.x, a.y);
  const to = await G(p, (d) => {
    const g = window.JellyFactory;
    const pv = g.previews && g.previews[d];
    return pv ? { x: pv.to % g.L.w, y: Math.floor(pv.to / g.L.w) } : null;
  }, d);
  if (!to) return false;
  const b = await pt(p, to.x, to.y);
  await p.mouse.click(b.x, b.y);
  return true;
}
/** 적어 둔 풀이를 실제 마우스로 (끌기 · 클릭 번갈아) */
async function playSol(p, sol, how = "mix") {
  for (let k = 0; k < sol.length; k++) {
    const [x, y, d] = sol[k];
    await idle(p);
    const before = (await S(p)).moves;
    if (how === "drag" || (how === "mix" && k % 2 === 0)) await mouseDrag(p, x, y, d);
    else await mouseClickMove(p, x, y, d);
    await until(p, (s) => s.moves === before + 1, 3000, `${k + 1}번째 이동`);
  }
  await idle(p);
}
const levels = () => import(pathToFileURL(path.join(ROOT, "games/jelly-factory/js/levels.js")).href);

(async () => {
  const errors = [];
  const { STAGES, DAILY } = await levels();

  /* ---------- J1: 규칙 엔진 단위 점검 · 모든 판 자동 풀이 검증 · 스테이지 구성 ---------- */
  if (want("J1")) {
    let unit = "";
    let unitOk = false;
    try {
      unit = execFileSync(process.execPath, [path.join(ROOT, "scripts/test-jelly-engine.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      unitOk = true;
    } catch (e) {
      unit = String(e.stdout || "");
    }
    const unitSum = (unit.match(/(\d+)\/(\d+) PASS/) || [])[0];
    check("J1a", "규칙 엔진 단위 점검 (멈춤 · 패드 · 파이프 · 끈적판 · 고리 · 합체 · 특수 모양 · 효과 · 연쇄 한 번 · 콤보 · 목표 · 새 젤리)", unitOk && /(\d+)\/\1 PASS/.test(unitSum || ""), unitSum || unit.slice(-300));
    let solve = "";
    let solveOk = false;
    try {
      solve = execFileSync(process.execPath, [path.join(ROOT, "scripts/jelly-solver.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 600000 });
      solveOk = true;
    } catch (e) {
      solve = String(e.stdout || "");
    }
    const total = STAGES.length + DAILY.length;
    check("J1b", `자동 풀이기: 스테이지 ${STAGES.length}개 + 오늘의 퍼즐 ${DAILY.length}개 모두 (처음 판에 3개 이어진 곳 없음 · 제한 안에 풀림 · par = 가장 짧은 풀이 · 적어 둔 풀이를 두면 실제로 깨짐)`, solveOk && new RegExp(`모두 통과 \\(${total}개\\)`).test(solve), (solve.match(/모두 통과.*|문제 \d+개/) || [solve.slice(-200)])[0]);
    const ids = STAGES.map((s) => s.id).join(",");
    const tiers = [1, 2, 3].map((t) => STAGES.filter((s) => s.tier === t).length);
    const maps = new Set(STAGES.map((s) => s.map.join("/")));
    // 2단계: 방해물(상자 · 꽁꽁) · 장치(끈적판 · 패드 · 파이프) · 또는 좁은 공간(벽 5개 이상)
    const t2feat = STAGES.filter((s) => s.tier === 2 && (/[xXrybgpo~^>v<1-9]/.test(s.map.join("")) || (s.map.join("").match(/#/g) || []).length >= 5)).length;
    const t3multi = STAGES.filter((s) => s.tier === 3 && s.goals.length >= 2).length;
    const t3slack = Math.max(...STAGES.filter((s) => s.tier === 3).map((s) => s.moves - s.par));
    const allMeta = STAGES.every((s) => s.name && s.goals.length && s.moves > s.par && s.sol && s.sol.length === s.par);
    check("J1c", "스테이지 구성: 1~30 · 단계마다 10개 · 모두 다른 배치 · 이름 · 목표 · 제한 이동 > 가장 짧은 풀이 · 2단계는 방해물 · 장치 · 좁은 공간 · 3단계는 여러 목표 · 빠듯한 이동", ids === Array.from({ length: 30 }, (_, i) => i + 1).join(",") && tiers.join() === "10,10,10" && maps.size === 30 && allMeta && t2feat === 10 && t3multi >= 7 && t3slack <= 2, `단계별 ${tiers.join("/")} · 다른 배치 ${maps.size} · 2단계 장치 ${t2feat}/10 · 3단계 여러 목표 ${t3multi}/10 · 3단계 여유 최대 ${t3slack}`);
  }

  const browser = await launch();

  /* ---------- J2: 불러오기 · 첫 화면 ---------- */
  if (want("J2")) {
    const p = await openPage(browser, { errors });
    const ms = await load(p);
    const t = await G(p, () => ({
      buttons: [...document.querySelectorAll("#title button")].map((b) => b.textContent.trim()),
      hud: !document.getElementById("hud").hidden,
      bar: !document.getElementById("bar").hidden,
      best: document.getElementById("title-best").textContent,
      h1: document.querySelector("#title h1").textContent,
    }));
    check("J2", "불러오기 → 첫 화면 (스테이지 · 점수 도전 · 오늘의 퍼즐 · 도감 · 도움말 · 설정) · 게임 중 칸은 숨김", t.buttons.join("|") === "스테이지|점수 도전|오늘의 퍼즐|도감|도움말|설정" && !t.hud && !t.bar && /젤리 공장/.test(t.h1), `${(ms / 1000).toFixed(1)}초 · ${t.buttons.join(", ")} · "${t.best}"`);
    await p.ctx.close();
  }

  /* ---------- J3 · J4: 스테이지 목록 → 시작 안내 → 마우스로 1번 깨기 → 결과 → 다음 · 저장 ---------- */
  if (want("J3") || want("J4")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await p.click("#stage-btn");
    const list = await G(p, () => ({
      n: document.querySelectorAll(".stage-btn").length,
      tiers: [...document.querySelectorAll(".tier h3")].map((h) => h.textContent),
      open: [...document.querySelectorAll(".stage-btn:not(.locked)")].map((b) => b.dataset.id),
    }));
    await p.click('.stage-btn[data-id="1"]');
    const intro = await G(p, () => ({ show: !document.getElementById("intro").hidden, h: document.getElementById("intro-h").textContent, goals: document.getElementById("intro-goals").textContent, moves: document.getElementById("intro-moves").textContent, tip: document.getElementById("intro-tip").textContent }));
    const s0 = await S(p);
    if (want("J3")) check("J3", "스테이지 목록: 30칸 · 3단계 · 처음엔 1번만 열림 → 1번 → 시작 안내 (이름 · 목표 · 제한 이동 · 메모) · 안내 동안 판 멈춤", list.n === 30 && list.tiers.length === 3 && list.open.join() === "1" && intro.show && /분홍 젤리 3개/.test(intro.goals) && /5번/.test(intro.moves) && intro.tip.length > 10 && s0.paused, `${list.n}칸 · 열린 칸 ${list.open} · "${intro.h}" · ${intro.goals} · ${intro.moves}`);
    await p.click("#intro-go");
    await until(p, (s) => !s.paused && s.stack.length === 0, 2000, "시작");
    // 고르기 → 미리 보기 (네 방향 중 갈 수 있는 쪽 = 규칙 엔진과 같음)
    const a = await pt(p, 2, 0);
    await p.mouse.click(a.x, a.y);
    const pv = await G(p, () => {
      const g = window.JellyFactory;
      return { sel: g.sel, dirs: g.previews.map((v) => (v ? { to: v.to, dist: v.dist, merge: !!v.merge } : null)) };
    });
    await mouseClickMove(p, 2, 0, 1);
    await until(p, (s) => s.moves === 1, 3000, "첫 이동");
    const mid = await G(p, () => document.getElementById("hud-moves").textContent);
    await idle(p);
    await mouseDrag(p, 5, 0, 2);
    const res = await until(p, (s) => s.stack.includes("result"), 8000, "결과");
    const r = await G(p, () => ({ h: document.getElementById("res-h").textContent, stars: document.getElementById("res-stars").textContent, score: document.getElementById("res-score").textContent, next: !document.getElementById("res-next").hidden && document.getElementById("res-next").textContent, saved: JSON.parse(localStorage.getItem("today-jelly-factory-v1")) }));
    await p.click("#res-next");
    const nx = await S(p);
    const nxIntro = await G(p, () => document.getElementById("intro-h").textContent);
    if (want("J4"))
      check("J4", "마우스: 젤리를 누르면 갈 수 있는 쪽 미리 보기(위는 막힘) → 도착 칸 클릭으로 이동 · 끌어서 밀기 → 3개 합체 · 목표 → 성공 · 별 3개 · 저장 · '다음 스테이지' → 2번", pv.sel === 2 && pv.dirs[0] === null && pv.dirs[1] && pv.dirs[1].to === 5 && pv.dirs[1].dist === 3 && pv.dirs[2] && mid === "4" && res.over && /성공/.test(r.h) && r.stars === "★★★" && r.saved.stages[1].stars === 3 && r.next === "다음 스테이지" && nx.id === 2 && nx.stack.includes("intro"), `미리 보기 ${JSON.stringify(pv.dirs)} · 남은 이동 ${mid} · "${r.h}" ${r.stars} · 점수 ${r.score} · 저장 ${JSON.stringify(r.saved.stages)} · 다음 → ${nx.id} "${nxIntro}"`);
    // J14 앞부분: 새로고침 뒤 기록
    await p.reload();
    await p.waitForFunction(() => window.JellyFactory && !document.getElementById("title").hidden);
    await p.click("#stage-btn");
    const after = await G(p, () => ({ open: [...document.querySelectorAll(".stage-btn:not(.locked)")].map((b) => b.dataset.id), s1: document.querySelector('.stage-btn[data-id="1"] small').textContent, sum: document.getElementById("stages-sum").textContent }));
    if (want("J4")) check("J4b", "새로고침 뒤: 1번 ★★★ · 2번 열림 · 3번 잠김 · 모은 별", after.open.join() === "1,2" && after.s1 === "★★★" && /3 \/ 90/.test(after.sum), `열린 칸 ${after.open} · 1번 ${after.s1} · "${after.sum}"`);
    await p.ctx.close();
  }

  /* ---------- J5: 30개 스테이지 모두 목록에서 들어가 실제 마우스로 깨기 ---------- */
  if (want("J5")) {
    const stages = {};
    for (let i = 1; i <= 30; i++) stages[i] = { stars: 1, moves: 99, score: 1 };
    const p = await openPage(browser, { errors, save: { v: 1, stages } });
    await load(p, 8);
    const out = [];
    let ok = 0;
    for (const def of STAGES) {
      try {
        await p.click("#stage-btn");
        await p.click(`.stage-btn[data-id="${def.id}"]`);
        await p.click("#intro-go");
        await until(p, (s) => s.id === def.id && !s.paused && s.stack.length === 0, 3000, "시작");
        await playSol(p, def.sol, def.id % 3 === 0 ? "drag" : "mix");
        await until(p, (s) => s.stack.includes("result"), 6000, "결과");
        const r = await G(p, () => ({ h: document.getElementById("res-h").textContent, stars: document.getElementById("res-stars").textContent }));
        const s = await S(p);
        const good = /성공/.test(r.h) && r.stars === "★★★" && s.moves === def.par;
        if (good) ok++;
        else out.push(`${def.id}:${r.h}/${r.stars}/${s.moves}`);
        await p.click("#res-list");
        await until(p, (s) => s.stack.includes("stages"), 2000, "목록");
        await G(p, () => window.JellyFactory.ui.toMenu());
      } catch (e) {
        out.push(`${def.id}: ${e.message.slice(0, 80)}`);
        await G(p, () => window.JellyFactory.ui.toMenu()).catch(() => {});
      }
    }
    const saved = await G(p, () => JSON.parse(localStorage.getItem("today-jelly-factory-v1")).stages);
    const all3 = Object.values(saved).filter((s) => s.stars === 3).length;
    check("J5", "스테이지 30개 모두: 목록 → 안내 → 실제 마우스(끌기 · 클릭)로 적어 둔 풀이 → 성공 · 별 3개 · 화면 연출과 규칙 상태가 끝까지 같음", ok === 30 && all3 === 30 && warnLog.length === 0, `성공 ${ok}/30 · 별 3개 저장 ${all3} · 상태 어긋남 ${warnLog.length}${out.length ? " · 문제 " + out.join(" | ") : ""}`);
    await p.ctx.close();
  }

  /* ---------- J6 · J7: 실패 → 다시 하기 · 다시 하기 확인 ---------- */
  if (want("J6") || want("J7")) {
    const p = await openPage(browser, { errors, save: { v: 1, stages: { 1: { stars: 3, moves: 2, score: 90 }, 2: { stars: 3, moves: 3, score: 1 } } } });
    await load(p, 8);
    await G(p, () => {
      window.JellyFactory.startStage(3);
      window.JellyFactory.ui.closeAll();
    });
    const start = await S(p);
    // 목표를 이루지 않는 이동만 골라 끝까지 (입력은 게임의 commit 그대로)
    for (let n = 0; n < 12; n++) {
      const s = await idle(p);
      if (s.over) break;
      await G(p, async () => {
        const g = window.JellyFactory;
        const E = await import("/games/jelly-factory/js/engine.js?v=1");
        const st = g.run.state;
        const mv = E.validMoves(st).find(([i, d]) => {
          const r = E.move(st, i, d);
          return !r.log.some((e) => e.type === "merge" || e.type === "special");
        }) || E.validMoves(st)[0];
        g.commit(mv[0], mv[1]);
      });
    }
    const end = await until(p, (s) => s.stack.includes("result"), 6000, "실패 결과");
    const r = await G(p, () => ({ h: document.getElementById("res-h").textContent, stars: !document.getElementById("res-stars").hidden, next: !document.getElementById("res-next").hidden, saved: JSON.parse(localStorage.getItem("today-jelly-factory-v1")).stages[3] }));
    await p.click("#res-retry");
    const re = await until(p, (s) => s.stack.length === 0 && !s.over, 3000, "다시");
    if (want("J6")) check("J6", "실패: 목표 못 이루고 이동을 다 쓰면(또는 더 못 이으면) 실패 화면 · 별 없음 · 저장 안 됨 → '다시 하기' → 처음 판 · 이동 0", /이동을 다 썼어요|더는 이을 수 없어요|더 움직일 젤리가 없어요/.test(r.h) && !r.stars && !r.next && !r.saved && re.moves === 0 && re.map === start.map && re.score === 0, `"${r.h}" (이동 ${end.moves}/${end.limit}) · 다시 → 이동 ${re.moves} · 처음 판과 같음 ${re.map === start.map}`);
    // J7: 다시 하기 확인
    await mouseDrag(p, ...STAGES[2].sol[0]);
    await idle(p);
    await p.click("#restart-btn");
    const c1 = await S(p);
    await p.click("#confirm-no");
    const c2 = await S(p);
    await p.keyboard.press("r");
    const c3 = await S(p);
    await p.click("#confirm-yes");
    const c4 = await until(p, (s) => s.stack.length === 0, 2000, "확인");
    if (want("J7")) check("J7", "다시 하기: 움직인 뒤엔 확인 창 (계속하기 → 그대로 · R 키도 같은 창) → 다시 하기 → 처음 판 (안내 없이 바로)", c1.stack.join() === "confirm" && c1.paused && c2.moves === 1 && c2.stack.length === 0 && !c2.paused && c3.stack.join() === "confirm" && c4.moves === 0 && c4.map === start.map, `확인 창 ${c1.stack} → 계속 (이동 ${c2.moves}) → R ${c3.stack} → 다시 (이동 ${c4.moves})`);
    await p.ctx.close();
  }

  /* ---------- J8: 키보드 ---------- */
  if (want("J8")) {
    const p = await openPage(browser, { errors });
    await load(p, 8);
    await p.click("#stage-btn");
    await p.click('.stage-btn[data-id="1"]');
    await p.keyboard.press("Enter"); // 안내의 '시작!' (포커스)
    await G(p, () => window.JellyFactory.ui.stack.length && window.JellyFactory.ui.closeAll());
    await p.keyboard.press("ArrowRight"); // 칸 고르기 시작 (첫 젤리)
    const k0 = await G(p, () => window.JellyFactory.cursor);
    await p.keyboard.press("Enter"); // 젤리 고르기
    const k1 = await S(p);
    await p.keyboard.press("ArrowRight"); // 오른쪽으로 밀기
    await until(p, (s) => s.moves === 1 && !s.busy, 3000, "키 이동");
    for (let i = 0; i < 3; i++) await p.keyboard.press("ArrowRight");
    const k2 = await G(p, () => window.JellyFactory.cursor);
    await p.keyboard.press(" ");
    await p.keyboard.press("ArrowDown");
    const end = await until(p, (s) => s.stack.includes("result"), 6000, "키 결과");
    await G(p, () => window.JellyFactory.ui.closeAll());
    // Esc: 고른 것 취소 → 다시 Esc 는 멈춤
    await G(p, () => {
      window.JellyFactory.startStage(1);
      window.JellyFactory.ui.closeAll();
    });
    await p.keyboard.press("ArrowRight");
    await p.keyboard.press("Enter");
    const e1 = await S(p);
    await p.keyboard.press("Escape");
    const e2 = await S(p);
    await p.keyboard.press("Escape");
    const e3 = await S(p);
    check("J8", "키보드: 방향키로 칸 고르기 → Enter 로 젤리 고르기 → 방향키로 밀기 → 깨기 · Esc 는 고른 것 취소, 한 번 더 누르면 멈춤", k0 === 2 && k1.sel === 2 && k2 === 5 && end.over && e1.sel === 2 && e2.sel === -1 && !e2.paused && e3.stack.join() === "pause", `커서 ${k0} → 고름 ${k1.sel} → 커서 ${k2} → 결과 ${end.over} · Esc ${e2.sel}/${e3.stack}`);
    await p.ctx.close();
  }

  /* ---------- J9: 터치 (밀기 · 톡톡) ---------- */
  if (want("J9")) {
    const p = await openPage(browser, { errors, width: 390, height: 844, touch: true });
    await load(p, 8);
    await p.tap("#stage-btn");
    await p.tap('.stage-btn[data-id="1"]');
    await p.tap("#intro-go");
    await until(p, (s) => s.stack.length === 0, 2000, "시작");
    const cdp = await p.ctx.newCDPSession(p);
    const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
    const A = await pt(p, 2, 0);
    const cell = (await S(p)).cell;
    await T("touchStart", [[A.x, A.y, 1]]);
    for (let i = 1; i <= 6; i++) {
      await T("touchMove", [[A.x + (cell * 0.9 * i) / 6, A.y + i, 1]]);
      await sleep(16);
    }
    const mid = await G(p, () => (window.JellyFactory.drag ? window.JellyFactory.drag.dir : null));
    await T("touchEnd", []);
    const t1 = await until(p, (s) => s.moves === 1 && !s.busy, 3000, "터치 밀기");
    // 톡 (고르기) → 톡 (도착 칸)
    const B = await pt(p, 5, 0);
    await T("touchStart", [[B.x, B.y, 2]]);
    await T("touchEnd", []);
    const t2 = await S(p);
    const C = await pt(p, 5, 3);
    await T("touchStart", [[C.x, C.y, 3]]);
    await T("touchEnd", []);
    const t3 = await until(p, (s) => s.stack.includes("result"), 6000, "터치 결과");
    const scroll = await G(p, () => ({ x: scrollX, y: scrollY }));
    check("J9", "터치: 젤리에 손가락을 대고 밀면 그쪽으로 · 톡 눌러 고른 뒤 도착 칸을 톡 → 이동 · 깨기 · 화면이 밀리지 않음", mid === 1 && t1.moves === 1 && t2.sel === 5 && t3.over && scroll.x === 0 && scroll.y === 0, `밀기 방향 ${mid} · 이동 ${t1.moves} · 톡 고름 ${t2.sel} · 결과 ${t3.over} · 스크롤 ${scroll.x},${scroll.y}`);
    await p.ctx.close();
  }

  /* ---------- J10: 여러 화면 크기: 보드 · 칸 좌표 · 위아래 칸이 안 가림 · 버튼 크기 ---------- */
  if (want("J10")) {
    const sizes = [
      [360, 640, true],
      [390, 844, true],
      [768, 1024, true],
      [844, 390, true],
      [1280, 800, false],
      [1920, 1080, false],
    ];
    const out = [];
    let all = true;
    for (const [w, h, touch] of sizes) {
      const p = await openPage(browser, { errors, width: w, height: h, touch });
      await load(p, 8);
      const tb = await G(p, () => [...document.querySelectorAll("#title .menu button")].every((b) => {
        const r = b.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.height >= 44;
      }));
      await G(p, (id) => {
        window.JellyFactory.startStage(id);
        window.JellyFactory.ui.closeAll();
      }, STAGES[STAGES.length - 1].id);
      await sleep(150);
      const lay = await G(p, () => {
        const g = window.JellyFactory;
        const L = g.L;
        const box = { l: L.ox, t: L.oy, r: L.ox + L.w * L.cell, b: L.oy + L.h * L.cell };
        const hud = document.getElementById("hud").getBoundingClientRect();
        const goals = document.getElementById("hud-goals").getBoundingClientRect();
        const bar = document.getElementById("bar").getBoundingClientRect();
        const inView = box.l >= 0 && box.t >= 0 && box.r <= innerWidth && box.b <= innerHeight;
        const side = hud.width < innerWidth * 0.5;
        const hudOk = side ? hud.right <= box.l + 1 : Math.max(hud.bottom, goals.bottom) <= box.t + 1;
        const barOk = bar.height > bar.width ? bar.left >= box.r - 1 : bar.top >= box.b - 1;
        const btns = [...document.querySelectorAll("#bar button")].every((b) => {
          const r = b.getBoundingClientRect();
          return r.width >= 44 && r.height >= 44 && r.bottom <= innerHeight && r.right <= innerWidth;
        });
        return { cell: L.cell, inView, hudOk, barOk, btns, box };
      });
      // 움직일 수 있는 젤리를 실제로 눌러 그 칸이 골라지는지 (모서리 근처 포함)
      const cells = await G(p, async () => {
        const g = window.JellyFactory;
        const E = await import("/games/jelly-factory/js/engine.js?v=1");
        const out = [];
        g.run.state.pieces.forEach((pc, i) => E.movable(pc) && out.push(i));
        return out;
      });
      let hit = 0;
      for (const i of cells) {
        const w0 = await G(p, () => window.JellyFactory.L.w);
        const q = await pt(p, i % w0, Math.floor(i / w0));
        if (touch) await p.touchscreen.tap(q.x, q.y);
        else await p.mouse.click(q.x, q.y);
        const sel = await G(p, () => window.JellyFactory.sel);
        if (sel === i) hit++;
        await G(p, () => window.JellyFactory.select(-1));
      }
      const ok = tb && lay.inView && lay.hudOk && lay.barOk && lay.btns && lay.cell >= 30 && hit === cells.length;
      if (!ok) all = false;
      out.push(`${w}x${h}${touch ? "t" : ""}:${ok ? "OK" : "X"}(칸 ${lay.cell} · 누른 칸 ${hit}/${cells.length}${lay.hudOk ? "" : " · 위 칸 겹침"}${lay.barOk ? "" : " · 아래 칸 겹침"}${lay.inView ? "" : " · 보드 밖"}${tb ? "" : " · 첫 화면 버튼"}${lay.btns ? "" : " · 버튼"})`);
      await p.ctx.close();
    }
    check("J10", "여러 화면 크기 (휴대폰 세로 · 가로 · 태블릿 · PC): 보드 전체가 화면 안 · 위 · 아래 칸이 보드를 안 가림 · 버튼 44px 이상 · 누른 자리 = 그 칸", all, out.join(" "));
  }

  /* ---------- J11: 특수 젤리 (번개 · 별 · 폭신 · 무지개 · 미리 놓인 특수 젤리 연쇄) ---------- */
  if (want("J11")) {
    const p = await openPage(browser, { errors });
    await load(p, 8);
    const out = {};
    for (const want of [
      ["bolt", (d) => d.goals.some((g) => g.kind === "bolt")],
      ["star", (d) => d.goals.some((g) => g.kind === "star")],
      ["fluffy", (d) => d.id === 17],
      ["rainbow", (d) => d.goals.some((g) => g.kind === "rainbow")],
      ["chain", (d) => /[-|SFW]/.test(d.map.join(""))],
    ]) {
      const def = STAGES.find(want[1]);
      if (!def) {
        out[want[0]] = "없음";
        continue;
      }
      await G(p, (id) => {
        window.JellyFactory.startStage(id);
        window.JellyFactory.ui.closeAll();
      }, def.id);
      // 특수 젤리 미리 보기 확인용: 터지는 이동 직전 고르기
      let sawPreview = false;
      for (let k = 0; k < def.sol.length; k++) {
        const [x, y, d] = def.sol[k];
        await idle(p);
        const pv = await G(p, ([x, y, d]) => {
          const g = window.JellyFactory;
          g.select(y * g.L.w + x);
          const v = g.previews[d];
          g.select(-1);
          return v ? { sp: v.specials.length, hit: v.specials.reduce((a, s) => a + s.hit.length, 0) } : null;
        }, [x, y, d]);
        if (pv && pv.sp && pv.hit) sawPreview = true;
        await mouseDrag(p, x, y, d);
        await until(p, (s) => s.moves === k + 1, 3000, "특수 이동");
      }
      await idle(p);
      const st = await G(p, () => {
        const s = window.JellyFactory.run.state;
        return { made: s.made, used: s.used, over: window.JellyFactory.run.over };
      });
      out[want[0]] = `${def.id}번 만든 ${JSON.stringify(st.made)} 터뜨림 ${st.used} 미리보기 ${sawPreview} 성공 ${st.over}`;
      out[want[0] + "_ok"] = st.over && st.used >= 1 && sawPreview;
    }
    check("J11", "특수 젤리: 번개 · 별 · 폭신 · 무지개 · 미리 놓인 특수 젤리 연쇄 — 실제로 만들고 터뜨려 목표 달성 · 고르면 터질 칸 미리 보기", ["bolt", "star", "fluffy", "rainbow", "chain"].every((k) => out[k + "_ok"]), ["bolt", "star", "fluffy", "rainbow", "chain"].map((k) => `${k}: ${out[k]}`).join(" | "));
    await p.ctx.close();
  }

  /* ---------- J12: 점수 도전 ---------- */
  if (want("J12")) {
    const p = await openPage(browser, { errors });
    await load(p, 10);
    await p.click("#score-btn");
    const s0 = await S(p);
    const hud0 = await G(p, () => ({ moves: document.getElementById("hud-moves").textContent, goals: document.getElementById("hud-goals").textContent }));
    // 점수가 가장 많이 나는 이동 (실제 마우스 끌기)
    let n = 0;
    for (; n < 40; n++) {
      const s = await idle(p);
      if (s.over) break;
      const mv = await G(p, async () => {
        const g = window.JellyFactory;
        const E = await import("/games/jelly-factory/js/engine.js?v=1");
        const st = g.run.state;
        let best = null;
        let bs = -1;
        for (const [i, d] of E.validMoves(st)) {
          const r = E.move(st, i, d);
          const v = r.state.score - st.score + Math.random();
          if (v > bs) {
            bs = v;
            best = [i % g.L.w, Math.floor(i / g.L.w), d];
          }
        }
        return best;
      });
      if (!mv) break;
      const before = s.moves;
      await mouseDrag(p, ...mv);
      await until(p, (q) => q.moves === before + 1, 3000, "점수 이동");
    }
    const end = await until(p, (s) => s.stack.includes("result"), 8000, "점수 결과");
    const r = await G(p, () => ({ k: document.getElementById("res-k").textContent, h: document.getElementById("res-h").textContent, score: document.getElementById("res-score").textContent, stats: document.getElementById("res-stats").textContent, rank: !!document.querySelector("#res-rank .today-rank-form"), saved: JSON.parse(localStorage.getItem("today-jelly-factory-v1")).score }));
    const posted = apiLog.filter((x) => x.method === "POST" && /\/api\/scores/.test(x.url)).length;
    await p.reload();
    await p.waitForFunction(() => window.JellyFactory && !document.getElementById("title").hidden);
    const tb = await G(p, () => document.getElementById("title-best").textContent);
    check("J12", "점수 도전: 8×8 · 이동 30번 · 움직일 때마다 새 젤리 → 끝 → 점수 · 최고 · 가장 큰 무리 · 최대 콤보 · 랭킹 칸(직접 올릴 때만) · 이 기기에 최고 저장 · 새로고침 뒤 첫 화면에 최고", s0.kind === "score" && s0.limit === 30 && hud0.moves === "30" && end.over && r.score.replace(/,/g, "") === String(end.score) && /가장 큰 무리/.test(r.stats) && /최대 콤보/.test(r.stats) && r.rank && r.saved.best === end.score && r.saved.maxGroup >= 3 && posted === 0 && tb.includes(end.score.toLocaleString("ko-KR")), `이동 ${end.moves} · 점수 ${end.score} · "${r.h}" · 저장 ${JSON.stringify(r.saved)} · 랭킹 칸 ${r.rank} · 저절로 보낸 점수 ${posted}건 · 첫 화면 "${tb}"`);
    await p.ctx.close();
  }

  /* ---------- J13: 오늘의 퍼즐 (모두 같은 판 · 날짜마다 다른 판 · 자정이 지나도 시작한 판 유지) ---------- */
  if (want("J13")) {
    const day = async (now) => {
      const p = await openPage(browser, { errors, now });
      await load(p, 8);
      await p.click("#daily-btn");
      const info = await G(p, () => ({ date: document.getElementById("daily-date").textContent, name: document.getElementById("daily-name").textContent, note: document.querySelector("#daily .note").textContent }));
      await p.click("#daily-go");
      await until(p, (s) => s.kind === "daily", 2000, "오늘의 퍼즐");
      const s = await S(p);
      return { p, info, s };
    };
    const a = await day(KST("2026-10-24T10:00:00"));
    const b = await day(KST("2026-10-24T21:30:00"));
    const c = await day(KST("2026-10-25T09:00:00"));
    await b.p.ctx.close();
    await c.p.ctx.close();
    // a: 자정 직전에 시작해서 자정이 지난 뒤 깸
    const p = a.p;
    await G(p, () => window.JellyFactory.ui.closeAll());
    await G(p, (t) => window.__setNow(t), KST("2026-10-24T23:59:50"));
    const def = await G(p, () => ({ sol: window.JellyFactory.run.def.sol, key: window.JellyFactory.run.dailyKey }));
    await mouseDrag(p, ...def.sol[0]);
    await idle(p);
    await G(p, (t) => window.__setNow(t), KST("2026-10-25T00:00:20"));
    const mid = await S(p);
    for (let k = 1; k < def.sol.length; k++) {
      await idle(p);
      await mouseDrag(p, ...def.sol[k]);
      await until(p, (s) => s.moves === k + 1, 3000, "오늘 이동");
    }
    await until(p, (s) => s.stack.includes("result"), 6000, "오늘 결과");
    const r = await G(p, () => ({ h: document.getElementById("res-h").textContent, note: document.getElementById("res-note").textContent, daily: JSON.parse(localStorage.getItem("today-jelly-factory-v1")).daily }));
    // 다시 하기도 같은 판 (자정 뒤에도)
    await p.click("#res-retry");
    const re = await S(p);
    await G(p, () => window.JellyFactory.ui.toMenu());
    const title = await G(p, () => document.getElementById("title-best").textContent);
    check("J13", "오늘의 퍼즐: 같은 날은 누구나 같은 판 · 다음 날은 다른 판 · 자정 직전에 시작한 판은 자정이 지나도 그대로 → 시작한 날짜로 기록 · 다시 하기도 같은 판 · 온라인 순위 없다고 안내", a.s.map === b.s.map && a.info.name === b.info.name && a.s.map !== c.s.map && /10월 24일/.test(a.info.date) && /10월 25일/.test(c.info.date) && mid.dailyKey === "2026-10-24" && /성공/.test(r.h) && r.daily["2026-10-24"] && r.daily["2026-10-24"].stars >= 1 && !r.daily["2026-10-25"] && /자정/.test(r.note) && re.map === a.s.map && re.dailyKey === "2026-10-24" && /아직/.test(title) && /온라인 순위는 없/.test(a.info.note), `24일 "${a.info.name}" = 24일(밤) "${b.info.name}" ≠ 25일 "${c.info.name}" · 자정 지난 뒤 판 ${mid.dailyKey} · 기록 ${Object.keys(r.daily)} · "${r.note.slice(0, 50)}" · 다시 하기 ${re.dailyKey} · 첫 화면 "${title}"`);
    await p.ctx.close();
  }

  /* ---------- J14: 저장소를 못 쓰는 브라우저 ---------- */
  if (want("J14")) {
    const p = await openPage(browser, { errors, noStorage: true });
    await load(p, 8);
    await G(p, () => {
      window.JellyFactory.startStage(1);
      window.JellyFactory.ui.closeAll();
    });
    await playSol(p, STAGES[0].sol);
    const end = await until(p, (s) => s.stack.includes("result"), 6000, "결과");
    await G(p, () => window.JellyFactory.ui.toMenu());
    await p.click("#settings-btn");
    const note = await G(p, () => document.getElementById("save-note").textContent);
    await p.keyboard.press("Escape");
    await p.click("#stage-btn");
    const open = await G(p, () => [...document.querySelectorAll(".stage-btn:not(.locked)")].map((b) => b.dataset.id).join());
    check("J14", "저장소를 못 쓰는 브라우저: 게임은 그대로 (깨기 · 결과) · 이번 방문 동안은 기억 · 설정에 저장 못 한다고 안내", end.over && /저장할 수 없어요/.test(note) && open === "1,2", `결과 ${end.over} · "${note}" · 열린 칸 ${open}`);
    await p.ctx.close();
  }

  /* ---------- J15: 멈춤 · 탭 숨김 · 소리 · 움직임 줄이기 · 도움말 · 도감 · 설정 ---------- */
  if (want("J15")) {
    const p = await openPage(browser, { errors });
    await load(p, 1);
    await G(p, () => {
      window.JellyFactory.startStage(1);
      window.JellyFactory.ui.closeAll();
    });
    await p.click("#pause-btn");
    const t0 = await G(p, () => window.JellyFactory.time);
    await sleep(300);
    const t1 = await G(p, () => window.JellyFactory.time);
    const ps = await S(p);
    await p.click("#pause-resume");
    await sleep(200);
    const t2 = await G(p, () => window.JellyFactory.time);
    await G(p, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hid = await S(p);
    await G(p, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      window.JellyFactory.ui.closeAll();
    });
    // 도움말 (판 위에서 열면 멈춤 · Esc 로 닫기)
    await p.click("#help-btn");
    const help = await G(p, () => ({ show: !document.getElementById("help").hidden, text: document.getElementById("help-body").textContent, imgs: document.querySelectorAll("#help-body img").length }));
    const hp = await S(p);
    await p.keyboard.press("Escape");
    const hc = await S(p);
    // 소리 끄기 → 저장
    await p.click("#sound-btn");
    const snd = await G(p, () => ({ on: window.JellyFactory.audio.on, label: document.querySelector("#sound-btn small").textContent, saved: JSON.parse(localStorage.getItem("today-jelly-factory-v1")).settings.sound }));
    // 움직임 줄이기
    await G(p, () => window.JellyFactory.ui.toMenu());
    await p.click("#settings-btn");
    await p.check("#set-reduced");
    const red = await G(p, () => ({ r: window.JellyFactory.reduced, cls: document.body.classList.contains("reduced") }));
    await p.keyboard.press("Escape");
    await p.reload();
    await p.waitForFunction(() => window.JellyFactory && !document.getElementById("title").hidden);
    const after = await G(p, () => ({ on: window.JellyFactory.audio.on, reduced: window.JellyFactory.reduced }));
    // 도감
    await p.click("#dex-btn");
    const dex = await G(p, () => ({ n: document.querySelectorAll(".dex-item").length, names: [...document.querySelectorAll(".dex-item b")].map((b) => b.textContent), sum: document.getElementById("dex-sum").textContent }));
    await p.click(".dex-item");
    const det = await G(p, () => document.getElementById("dex-detail").textContent);
    check("J15", "멈춤(시간 정지) · 계속 · 탭 숨기면 자동 멈춤 · 도움말(그림 · 규칙 · 특수 젤리 · 장치) Esc 로 닫기 · 소리 끄기/움직임 줄이기 저장 · 도감 12칸(만난 친구만 이름 · 처음 만난 날)", ps.stack.join() === "pause" && t1 === t0 && t2 > t1 && hid.stack.join() === "pause" && help.show && help.imgs >= 10 && /번개/.test(help.text) && /끈적판/.test(help.text) && /꽁꽁/.test(help.text) && hp.paused && hc.stack.length === 0 && !hc.paused && !snd.on && snd.saved === false && /끔/.test(snd.label) && red.r && red.cls && !after.on && after.reduced && dex.n === 12 && dex.names[0] === "말랑이" && dex.names.includes("???") && /처음 만난 날 \d{4}-\d{2}-\d{2}/.test(det), `멈춤 ${ps.stack} 시간 ${t0.toFixed(2)}→${t1.toFixed(2)}→${t2.toFixed(2)} · 숨김 ${hid.stack} · 도움말 그림 ${help.imgs} · 소리 ${snd.on}/${snd.saved} · 줄이기 ${red.r} · 새로고침 뒤 ${JSON.stringify(after)} · 도감 "${dex.sum}" [${dex.names.slice(0, 4)}…]`);
    await p.ctx.close();
  }

  /* ---------- J16: 홈 목록 · 바로 들어오기 · 새로고침 · 다른 게임 ---------- */
  if (want("J16")) {
    const h = await openPage(browser, { errors });
    await h.goto(BASE + "/");
    await sleep(1500);
    await G(h, () => {
      const a = document.querySelector('a[href="/games/jelly-factory/"]');
      if (a) a.scrollIntoView({ block: "center" });
    });
    await h.waitForFunction(() => {
      const i = document.querySelector('a[href="/games/jelly-factory/"] img');
      return !i || (i.complete && i.naturalWidth > 0);
    }, null, { timeout: 5000 }).catch(() => {});
    const home = await G(h, () => {
      const a = document.querySelector('a[href="/games/jelly-factory/"]');
      const img = a && a.querySelector("img");
      return { card: !!a, shelf: a ? (a.closest("section") || {}).id : "", text: a ? a.textContent.replace(/\s+/g, " ").trim() : "", thumb: img ? img.getAttribute("src") : "", ok: img ? img.complete && img.naturalWidth > 0 : false };
    });
    if (home.card) {
      await h.click('a[href="/games/jelly-factory/"]');
      await h.waitForFunction(() => window.JellyFactory && !document.getElementById("title").hidden, null, { timeout: 10000 }).catch(() => {});
    }
    const entered = await G(h, () => !!window.JellyFactory);
    await h.reload();
    await h.waitForFunction(() => window.JellyFactory && !document.getElementById("title").hidden, null, { timeout: 10000 }).catch(() => {});
    const reloaded = await G(h, () => !!window.JellyFactory);
    const seo = await G(h, () => ({ about: !!document.querySelector("#title .seo-about"), canon: document.querySelector('link[rel="canonical"]').href }));
    const games = [];
    for (const g of ["slime-lab", "suika", "lava-surfers", "tetris"]) {
      const before = errors.length;
      await h.goto(`${BASE}/games/${g}/`);
      await sleep(1800);
      games.push(`${g}:${errors.length === before ? "OK" : "오류"}`);
    }
    check("J16", "홈 퍼즐 칸에 카드 · 썸네일 → 눌러서 들어감 · 새로고침 · 게임 소개(SEO) · 다른 게임 정상", home.card && home.shelf === "cat-puzzle" && home.ok && entered && reloaded && seo.about && /jelly-factory/.test(seo.canon) && games.every((x) => x.endsWith("OK")), `카드 ${home.card} (${home.shelf}) "${home.text.slice(0, 40)}" · 썸네일 ${home.thumb} ${home.ok} · 들어감 ${entered} · 새로고침 ${reloaded} · 소개 ${seo.about} · ${games.join(", ")}`);
    await h.ctx.close();
  }

  const leaked = apiLog.filter((r) => /today-jelly-factory/.test(r.body));
  check("J17", "/api 로 저장 데이터를 보내지 않음 · 저절로 보낸 점수 없음", leaked.length === 0 && !apiLog.some((r) => r.method === "POST" && /\/api\/scores/.test(r.url)), `/api 요청 ${apiLog.length}건 (${[...new Set(apiLog.map((r) => r.method + " " + new URL(r.url).pathname))].join(", ") || "없음"})`);
  check("J18", "콘솔 오류 · 리소스 로딩 오류 없음 · 화면 연출과 규칙 상태 어긋남 없음", errors.length === 0 && warnLog.length === 0, errors.length || warnLog.length ? [...errors, ...warnLog].slice(0, 6) : "없음 (/api 는 가짜 응답)");

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e.message);
  process.exit(1);
});
