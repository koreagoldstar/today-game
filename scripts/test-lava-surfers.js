/**
 * 용암 서핑 — 자동 점검 (실제 브라우저 · 실제 게임 코드 · 실제 키 · 터치 입력)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-lava-surfers.js   (LS_ONLY=L1,L7 처럼 골라서도 됨 · L26 은 18 스테이지를 모두 타서 20분쯤 걸림)
 *
 * - /api/* 는 가짜 응답 → 실제 랭킹 · 인기 집계에 아무것도 쓰지 않는다.
 * - 저장 데이터는 테스트마다 새 브라우저 칸에서 (내 기기 기록과 상관없음).
 * - 위치 옮기기(tp)는 '그 자리에서 실제로 타 보기' 위해서만 쓰고, 판정은 게임이 실제로 낸 결과로 한다.
 * - 스테이지 끝까지 타기는 자동 조종(scripts/lava-autopilot.js: 입력만 바꿈 · 물리 · 충돌 · 용암은 그대로).
 * - 결과: 항목마다 PASS / FAIL 과 근거 숫자. 하나라도 FAIL 이면 종료 코드 1.
 */
"use strict";

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.error("playwright 가 필요해요: npm i -D playwright");
  process.exit(2);
}
const { installLavaBot } = require("./lava-autopilot.js");

const BASE = process.env.LS_BASE || "http://localhost:3456";
const GAME = `${BASE}/games/lava-surfers/`;
const KEY = "today-lava-surfers-v1";
const ONLY = (process.env.LS_ONLY || "").split(",").filter(Boolean);
const want = (id) => !ONLY.length || ONLY.includes(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}
const f1 = (v) => (typeof v === "number" ? v.toFixed(1) : String(v));
/** 스테이지를 여럿 연 저장 (테스트용) */
const unlockedSave = (unlocked, best = {}) => ({ v: 2, plays: 0, clears: Object.keys(best).length, stages: { best, unlocked }, endless: { best: 0, dist: 0, runs: 0 }, ending: 0, settings: { musicVol: 0.7, sfxVol: 0.9, quality: "auto" } });

async function launch() {
  const args = process.env.LS_GPU === "0" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
  try {
    return await chromium.launch({ channel: "chrome", args });
  } catch (_) {
    return await chromium.launch({ args });
  }
}
const apiLog = [];
async function openPage(browser, { width = 1280, height = 720, touch = false, save = null, errors = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, serviceWorkers: "block" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("PAGE " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("CONSOLE " + m.text().slice(0, 200));
  });
  p.on("response", (r) => {
    if (r.status() >= 400 && !/\/api\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await p.route("**/api/**", (r) => {
    const q = r.request();
    apiLog.push({ url: q.url(), method: q.method(), body: q.postData() || "" });
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, scores: [], items: [] }) });
  });
  await p.addInitScript(
    ([key, save]) => {
      if (sessionStorage.getItem("__ls_init")) return;
      sessionStorage.setItem("__ls_init", "1");
      if (save) localStorage.setItem(key, JSON.stringify(save));
      else localStorage.removeItem(key);
    },
    [KEY, save]
  );
  p.ctx = ctx;
  return p;
}
const G = (p, fn, arg) => p.evaluate(fn, arg);
async function load(p) {
  const t0 = Date.now();
  await p.goto(GAME);
  for (let i = 0; i < 300; i++) {
    if (await G(p, () => !!(window.LavaSurfers && window.LavaSurfers.state === "title")).catch(() => false)) break;
    await sleep(100);
  }
  const ms = Date.now() - t0;
  await G(p, () => {
    const g = window.LavaSurfers;
    const rec = (window.__rec = { anims: new Set(), states: [], frames: 0, renders: 0, air: 0, maxAir: 0, spins: 0 });
    const r0 = g.renderer.render.bind(g.renderer);
    g.renderer.render = (...a) => {
      rec.renders++;
      return r0(...a);
    };
    const loop = () => {
      requestAnimationFrame(loop);
      rec.frames++;
      if (!g.track || g.loadingStage) return;
      const P = g.player;
      rec.anims.add(g.rider.state);
      if (rec.states[rec.states.length - 1] !== g.state) rec.states.push(g.state);
      const gy = g.track.surfaceY(P.s, P.u);
      if (gy != null) rec.maxAir = Math.max(rec.maxAir, P.y - gy);
    };
    loop();
    window.__ls = {
      s() {
        const P = g.player;
        const r = g.run;
        // 스테이지를 새로 만드는 동안은 지형 · 용암이 잠깐 비어 있음
        if (g.loadingStage || !g.lava || !g.track) return { state: "loading", loading: true, screen: g.ui.current, stage: g.stage && g.stage.id };
        return {
          state: g.state,
          paused: g.paused,
          screen: g.ui.current,
          stage: g.stage && g.stage.id,
          loading: !!g.loadingStage,
          s: P.s,
          u: P.u,
          y: P.y,
          vy: P.vy,
          speed: P.speed,
          onGround: P.onGround,
          boostT: P.boostT,
          boostCD: P.boostCD,
          boostReady: P.boostReady,
          d: g.lava.d,
          lavaS: g.lava.lavaS,
          lavaOff: !!g.lava.off,
          hearts: r && r.hearts,
          hits: r && r.hits,
          falls: r && r.falls,
          orbs: r && r.orbs + r.bigs,
          spins: r && r.spins,
          failedStunts: r && r.failedStunts,
          score: r ? Math.round(g.score()) : 0,
          pts: r && { ...r.pts },
          time: r && r.time,
          combo: r && r.combo,
          bestCombo: r && r.bestCombo,
          boosts: r && r.boosts,
          cp: r && r.cp ? r.cp.s : -1,
          anim: g.rider.state,
          boss: g.boss ? { state: g.boss.state, hp: g.boss.hp, max: g.boss.maxHp } : null,
          escape: !!g.escape,
        };
      },
      /** 이 자리(s, u)에서 이 빠르기로 다시 타기 · 용암은 lavaGap 뒤 */
      tp(s, u = 0, speed = 20, lavaGap = 34) {
        const P = g.player;
        P.reset(s, speed);
        P.u = u;
        g.items.reset(s - 5);
        g.lava.reset(s - lavaGap);
        g.camY = undefined;
        g.camFwd = undefined;
      },
      reset() {
        rec.anims = new Set();
        rec.maxAir = 0;
      },
      rec() {
        return { anims: [...rec.anims], states: rec.states.slice(), frames: rec.frames, renders: rec.renders, maxAir: rec.maxAir };
      },
    };
  });
  return ms;
}
const S = (p) => G(p, () => window.__ls.s());
async function until(p, pred, ms = 10000, label = "") {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await S(p);
    if (pred(s)) return s;
    await sleep(40);
  }
  throw new Error(`시간 초과: ${label} (상태 ${s && s.state} · s ${s && f1(s.s)})`);
}
async function start(p) {
  await p.click("#start-btn");
  return until(p, (s) => s.state === "play", 6000, "play");
}
/** 스테이지 바로 시작 (스테이지 선택 칸을 누른 것과 같은 길) */
async function startStage(p, id) {
  await G(p, (id) => window.LavaSurfers.startStage(id), id);
  return until(p, (s) => s.state === "play" && s.stage === id, 12000, `stage ${id} play`);
}
/** 용암을 멀리 두고 (테스트 중 따라잡히지 않게) */
const holdLava = (p, on = true) =>
  G(p, (on) => {
    const g = window.LavaSurfers;
    clearInterval(window.__hold);
    if (on) window.__hold = setInterval(() => (g.lava.lavaS = Math.min(g.lava.lavaS, g.player.s - 60)), 50);
  }, on);
async function hold(p, key, ms) {
  await p.keyboard.down(key);
  await sleep(ms);
  await p.keyboard.up(key);
}
const visibleText = (p, sel) => G(p, (sel) => [...document.querySelectorAll(sel)].filter((b) => b.offsetParent).map((b) => b.textContent.trim()), sel);

(async () => {
  const browser = await launch();
  const errors = [];

  /* ---------- L1 ~ L7: 타이틀 · 시작 · 좌우 · 점프 · 경사 속도 · 부스터 · 충돌 (STAGE 01) ---------- */
  if (["L1", "L2", "L3", "L4", "L5", "L6", "L7"].some(want)) {
    const p = await openPage(browser, { errors });
    const loadMs = await load(p);
    await sleep(600);
    const title = await G(p, () => {
      const g = window.LavaSurfers;
      const parts = [];
      g.rider.group.traverse((o) => o.isMesh && parts.push(o));
      const v = g.rider.group.position.clone().setY(g.rider.group.position.y + 0.8).project(g.cam);
      return {
        loadingHidden: document.getElementById("loading").hidden,
        titleShown: !document.getElementById("title").hidden,
        meshes: parts.length,
        onScreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1,
        best: document.getElementById("title-best").textContent,
      };
    });
    title.buttons = await visibleText(p, "#title button");
    // 아직 잠긴 무한 도전을 눌러 봄 → 안내만 · 타이틀 그대로
    await p.click("#endless-btn");
    await sleep(200);
    const lockToast = await G(p, () => ({ t: document.getElementById("toast").textContent, screen: window.LavaSurfers.ui.current, state: window.LavaSurfers.state }));
    await p.screenshot({ path: "test-results/lava-title-1280.png" }).catch(() => {});
    if (want("L1"))
      check(
        "L1",
        "불러오기 → 타이틀 (게임 시작 · 스테이지 선택 · 무한 도전(잠김) · 조작 방법 · 사운드 설정) · 피코와 보드가 화면에 보임",
        title.loadingHidden && title.titleShown && title.buttons.join("|") === "게임 시작|스테이지 선택|무한 도전 🔒|조작 방법|사운드 설정" && title.meshes > 30 && title.onScreen && /STAGE 03/.test(lockToast.t) && lockToast.screen === "title" && lockToast.state === "title",
        `${(loadMs / 1000).toFixed(1)}초 · 버튼 ${title.buttons.join(", ")} · 부품 ${title.meshes}개 · 화면 안 ${title.onScreen} · 잠긴 무한 도전 → "${lockToast.t}" · "${title.best.trim()}"`
      );

    const t1 = Date.now();
    await start(p);
    const goMs = Date.now() - t1;
    const rec0 = await G(p, () => window.__ls.rec());
    const hud0 = await G(p, () => ({ stage: document.getElementById("hud-stage").textContent, boss: document.getElementById("boss-bar").hidden, chase: !document.getElementById("chase").hidden }));
    if (want("L2")) check("L2", "게임 시작 → STAGE 01 준비 · 출발! → 바로 조작 (HUD 에 스테이지 이름 · 용암 거리)", goMs < 3500 && rec0.states.join(">").includes("title>ready>play") && hud0.stage === "STAGE 01 · 검은 화산 경사면" && hud0.boss && hud0.chase, `시작 → 조작까지 ${(goMs / 1000).toFixed(1)}초 · 상태 ${rec0.states.join(">")} · HUD "${hud0.stage}" · 보스 막대 숨김 ${hud0.boss}`);
    await holdLava(p);

    // L3 좌우 (출발 비탈 · 장애물 없음)
    await G(p, () => window.__ls.tp(115, 0, 18));
    await sleep(300);
    const a = await S(p);
    await hold(p, "KeyA", 450);
    const b = await S(p);
    await hold(p, "ArrowRight", 800);
    const c = await S(p);
    await hold(p, "ArrowLeft", 800);
    const d = await S(p);
    if (want("L3")) check("L3", "좌우: A/← 왼쪽 · D/→ 오른쪽 (가속 · 놓으면 멈춤)", b.u < a.u - 1.2 && c.u > b.u + 2 && d.u < c.u, `u ${f1(a.u)} → A ${f1(b.u)} → → ${f1(c.u)} → ← ${f1(d.u)}`);

    // L4 점프 · 착지
    await G(p, () => window.__ls.tp(130, 0, 20));
    await sleep(400);
    await G(p, () => window.__ls.reset());
    await p.keyboard.press("Space");
    const air = await until(p, (s) => !s.onGround, 600, "jump").catch(() => null);
    await until(p, (s) => s.onGround, 2500, "land").catch(() => null);
    await sleep(150);
    const r4 = await G(p, () => window.__ls.rec());
    if (want("L4")) check("L4", "점프: Space → 공중 → 착지 (점프 · 착지 동작)", !!air && r4.maxAir > 1.2 && r4.anims.includes("jump") && r4.anims.includes("land"), `최고 높이 ${f1(r4.maxAir)}m · 동작 ${r4.anims.join(",")}`);

    // L5 경사 속도: 완만한 출발 비탈(경사 0.10) vs 가파른 기둥 구간 가운데(0.14) · 같은 빠르기 · 같은 시간
    const ride = async (s0) => {
      await G(p, (s0) => window.__ls.tp(s0, 0, 15), s0);
      await sleep(1800);
      const x = await S(p);
      x.slope = await G(p, (s) => window.LavaSurfers.track.slope(s), x.s);
      return x;
    };
    const lo = await ride(62);
    const hi = await ride(640);
    if (want("L5")) check("L5", "경사 따라 속도: 가파른 곳이 더 빠름", hi.slope > lo.slope + 0.02 && hi.speed > lo.speed + 0.8 && hi.hits === lo.hits, `완만한 곳 (경사 ${lo.slope.toFixed(3)}) ${f1(lo.speed * 3.6)}km/h · 가파른 곳 (경사 ${hi.slope.toFixed(3)}) ${f1(hi.speed * 3.6)}km/h`);

    // L6 부스터 · 쿨다운
    await G(p, () => window.__ls.tp(130, 0, 18));
    await sleep(1500);
    const b0 = await S(p);
    await p.keyboard.press("ShiftLeft");
    await sleep(700);
    const b1 = await S(p);
    const hud1 = await G(p, () => document.getElementById("boost-t").textContent);
    await p.keyboard.press("ShiftLeft");
    await sleep(200);
    const b2 = await S(p);
    const ready = await until(p, (s) => s.boostReady, 6000, "boost ready").catch(() => null);
    const hud2 = await G(p, () => document.getElementById("boost-t").textContent);
    await p.keyboard.press("KeyK");
    await sleep(150);
    const b3 = await S(p);
    if (want("L6")) check("L6", "부스터: Shift → 빨라짐 · 쿨다운 동안 다시 안 됨 · 충전되면 다시 (K 키도)", b1.speed > b0.speed + 5 && b2.boosts === b1.boosts && !!ready && b3.boosts === b1.boosts + 1 && /충전/.test(hud1) && /준비/.test(hud2), `${f1(b0.speed * 3.6)} → ${f1(b1.speed * 3.6)}km/h · 쿨다운 중 다시 눌러도 횟수 ${b1.boosts}→${b2.boosts} · HUD "${hud1}" → "${hud2}" · 충전 뒤 ${b3.boosts}`);

    // L7 충돌: 같은 자리 · 같은 용암 거리에서, 피했을 때(가운데) vs 바위 기둥(621m · 오른쪽 3.5)에 부딪혔을 때
    await holdLava(p, false);
    const run7 = async (u) => {
      await G(p, (u) => window.__ls.tp(600, u, 22, 34), u);
      await sleep(2600);
      return S(p);
    };
    const ctrl = await run7(0);
    const h0 = ctrl.hits;
    const hit = await run7(3.5);
    const toast = await G(p, () => document.getElementById("toast").textContent);
    if (want("L7")) check("L7", "충돌: 바위 기둥에 부딪히면 느려지고 · 용암이 가까워짐 · 콤보 끊김", ctrl.hits === h0 && hit.hits >= h0 + 1 && hit.d < ctrl.d - 4 && /부딪/.test(toast), `피함: 용암 ${f1(ctrl.d)}m / 부딪힘(${hit.hits - h0}번): 용암 ${f1(hit.d)}m · "${toast.trim()}"`);
    await p.ctx.close();
  }

  /* ---------- L8: 용암 추격 → 위험 표시 → 따라잡힘(게임 오버) → 처음부터 다시 ----------
   *  STAGE 09 용암 파도 추격전에서 '자꾸 부딪히고 부스터는 안 쓰는' 플레이 (STAGE 01 은 처음 하는 아이용이라 너그러움) */
  if (want("L8")) {
    const p = await openPage(browser, { errors, save: unlockedSave(10) });
    await load(p);
    await startStage(p, 10);
    await G(p, installLavaBot, { ram: true });
    await G(p, () => {
      const IN = window.LavaSurfers.input;
      const c = IN.consume;
      IN.consume = () => Object.assign(c(), { boost: false });
    });
    const t0 = Date.now();
    let minD = 99;
    let maxDanger = 0;
    let s;
    const ds = [];
    while (Date.now() - t0 < 70000) {
      s = await S(p);
      const dg = await G(p, () => Number(getComputedStyle(document.getElementById("danger")).opacity));
      maxDanger = Math.max(maxDanger, dg);
      if (s.state === "play") minD = Math.min(minD, s.d);
      if (ds.length === 0 || Date.now() - t0 > ds.length * 2000) ds.push(`${Math.round(s.d)}`);
      if (s.state === "over") break;
      await sleep(100);
    }
    await until(p, (x) => x.screen === "over", 4000, "over screen").catch(() => null);
    const over = await G(p, () => ({ k: document.getElementById("over-k").textContent, h: document.getElementById("over-h").textContent, again: !!document.getElementById("over-again").offsetParent, sel: !!document.getElementById("over-select").offsetParent, site: !!document.querySelector('#over a[href="/"]'), stats: document.getElementById("over-stats").textContent.replace(/\s+/g, " ") }));
    await p.screenshot({ path: "test-results/lava-caught.png" }).catch(() => {});
    await p.click("#over-again");
    const back = await until(p, (x) => x.state === "play", 4000, "restart").catch(() => null);
    check("L8", "용암 추격 (STAGE 09): 부딪힐수록 거리 줄어듦 → 위험 표시 → 거리 0 = 게임 오버 → 처음부터 다시", s.state === "over" && s.hits >= 2 && maxDanger > 0.4 && /따라잡혔/.test(over.h) && /STAGE 09/.test(over.k) && over.again && over.sel && over.site && !!back && back.hearts === 3 && back.s < 90 && back.stage === 10, `부딪힘 ${s.hits}번 · 거리 변화 ${ds.join("→")}m · 위험 표시 최대 ${maxDanger.toFixed(2)} · "${over.k} / ${over.h}" (${over.stats.trim()}) · 다시 → 하트 ${back && back.hearts} · s ${back && f1(back.s)}`);
    await p.ctx.close();
  }

  /* ---------- L9 · L10 · L12: 체크포인트 · 용암에 빠짐 · 구슬 · 점수 · 콤보 ---------- */
  if (["L9", "L10", "L12"].some(want)) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await holdLava(p);
    // 구슬 길 (s 80~140, 가운데 6개)
    await G(p, () => window.__ls.tp(74, 0, 19));
    await sleep(3300);
    const o = await S(p);
    const comboShown = await G(p, () => !document.getElementById("combo").hidden);
    const hudOrbs = await G(p, () => Number(document.getElementById("hud-orbs").textContent));
    const sum = Object.values(o.pts).reduce((a, b) => a + b, 0);
    if (want("L10")) check("L10", "에너지 구슬 · 점수 · 콤보 (점수 = 항목 합)", o.orbs >= 5 && o.pts.orbs >= 100 && o.bestCombo >= 3 && comboShown && hudOrbs === o.orbs && Math.round(sum) === o.score, `구슬 ${o.orbs} (HUD ${hudOrbs}) · 구슬 점수 ${o.pts.orbs} · 최고 콤보 ${o.bestCombo} · 콤보 표시 ${comboShown} · 총점 ${o.score} = 합 ${Math.round(sum)}`);
    // 체크포인트 (s 520)
    await G(p, () => window.__ls.tp(505, 0, 20));
    const cp = await until(p, (s) => s.cp === 520, 3000, "checkpoint").catch(() => null);
    const cpToast = await G(p, () => document.getElementById("toast").textContent);
    const snap = await S(p);
    if (want("L12")) check("L12", "체크포인트 지나면 저장 (안내 · 표시)", !!cp && /체크포인트/.test(cpToast), `체크포인트 s ${cp && cp.cp} · "${cpToast.trim()}"`);
    // 체크포인트 뒤 구슬 몇 개 (기둥 반대편 줄) → 점프 없이 틈(775~781m)으로 → 용암에 빠짐
    await G(p, () => window.__ls.tp(612, -3.5, 16, 60));
    await sleep(1000);
    const got = await S(p);
    await G(p, () => window.__ls.tp(768, 0, 4, 60));
    const fell = await until(p, (s) => s.state === "fall", 5000, "fall").catch(() => null);
    const back = await until(p, (s) => s.state === "play", 4000, "respawn").catch(() => null);
    await sleep(100);
    const after = await S(p);
    if (want("L9")) check("L9", "용암에 빠짐 → 하트 -1 → 체크포인트에서 다시 (그 뒤 얻은 구슬 · 점수 되돌림 · 용암은 뒤로)", !!fell && !!back && after.hearts === snap.hearts - 1 && Math.abs(after.s - 520) < 3 && got.orbs > snap.orbs && after.orbs === snap.orbs && after.d > 30, `구슬 ${snap.orbs}→${got.orbs} → 빠짐 → 하트 ${snap.hearts}→${after.hearts} · 다시 선 곳 s ${f1(after.s)} · 구슬 ${after.orbs} · 용암 ${f1(after.d)}m 뒤`);
    // 하트 0 → 게임 오버(하트) → 체크포인트에서 이어하기
    await G(p, () => (window.LavaSurfers.run.hearts = 1));
    await G(p, () => window.__ls.tp(768, 0, 4, 60));
    await until(p, (s) => s.screen === "over", 7000, "over").catch(() => null);
    const ov = await G(p, () => ({ h: document.getElementById("over-h").textContent, cp: !!document.getElementById("over-cp").offsetParent, cpT: document.getElementById("over-cp").textContent, best: document.getElementById("over-best").textContent }));
    await p.click("#over-cp");
    const cont = await until(p, (s) => s.state === "play", 4000, "continue").catch(() => null);
    if (want("L9")) check("L9b", "하트 0 → 게임 오버 → '체크포인트에서 다시' → 하트 3 으로 520m 부터", /하트/.test(ov.h) && ov.cp && /체크포인트/.test(ov.cpT) && !!cont && cont.hearts === 3 && Math.abs(cont.s - 520) < 3, `"${ov.h}" · 버튼 "${ov.cpT}" · "${ov.best}" → 하트 ${cont && cont.hearts} · s ${cont && f1(cont.s)}`);
    await p.ctx.close();
  }

  /* ---------- L11: 스턴트 (공중 회전) 성공 · 실패 판정 ---------- */
  if (want("L11")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await holdLava(p);
    await G(p, () => (window.LavaSurfers.finishS = 1e9)); // 같은 점프대를 두 번 타려고 도착 판정만 끔
    // 공중에서 '언제' 점프를 누를지만 정하는 입력 (판정은 게임이 함)
    const jumpAt = (mode) =>
      G(p, (mode) => {
        const g = window.LavaSurfers;
        const IN = g.input;
        const orig = (IN.__orig = IN.__orig || IN.consume.bind(IN));
        let done = false;
        IN.consume = () => {
          const f = orig();
          const P = g.player;
          if (done || P.onGround || g.state !== "play") return f;
          const gy = g.track.surfaceY(P.s + P.speed * 0.2, P.u);
          const h = gy == null ? 99 : P.y - gy;
          const tLand = (P.vy + Math.sqrt(Math.max(0, P.vy * P.vy + 48 * h))) / 24;
          if (mode === "early" && P.airT > 0.12) (f.jump = true), (done = true);
          if (mode === "late" && P.vy < 0 && gy != null && tLand < 0.2 && tLand > 0.08) (f.jump = true), (done = true);
          return f;
        };
      }, mode);
    // 1) 마지막 큰 점프대(1001~1015 · 틈 1015~1029)에서 날아오르자마자 회전 → 깨끗하게 착지
    await jumpAt("early");
    const s0 = await S(p);
    await G(p, () => window.__ls.tp(985, 0, 26, 60));
    await until(p, (s) => s.s > 1016 && !s.onGround, 5000, "launch").catch(() => null);
    const ok1 = await until(p, (s) => s.onGround && s.s > 1030, 5000, "land").catch(() => null);
    await sleep(200);
    const a = await S(p);
    // 2) 착지 직전에 회전 시작 → 반쯤 돈 채로 착지 = 실패 (점수 없음)
    await jumpAt("late");
    await G(p, () => window.__ls.tp(985, 0, 26, 60));
    await until(p, (s) => s.s > 1016 && !s.onGround, 5000, "launch2").catch(() => null);
    await until(p, (s) => s.onGround && s.s > 1030, 5000, "land2").catch(() => null);
    await sleep(200);
    const b = await S(p);
    const toast = await G(p, () => document.getElementById("toast").textContent);
    check("L11", "스턴트: 공중 회전 후 깨끗한 착지 = 점수 · 반쯤 돈 채 착지 = 실패(점수 없음 · 넘어짐)", !!ok1 && a.spins > s0.spins && a.pts.stunt > s0.pts.stunt && b.failedStunts === a.failedStunts + 1 && b.pts.stunt === a.pts.stunt, `성공: 회전 ${a.spins}번 · 스턴트 점수 ${s0.pts.stunt}→${a.pts.stunt} / 실패 ${b.failedStunts}번 · 스턴트 점수 그대로 ${b.pts.stunt} · "${toast.trim()}"`);
    await p.ctx.close();
  }

  /* ---------- L13 · L14: 일시정지 · 다시 시작 (게임 루프 하나) ---------- */
  if (want("L13") || want("L14")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await sleep(1200);
    await p.keyboard.press("Escape");
    await sleep(100);
    const pa = await S(p);
    await sleep(900);
    const pb = await S(p);
    const shown = await G(p, () => !document.getElementById("pause").hidden);
    const pbtn = await visibleText(p, "#pause button, #pause a");
    await p.click("#pause-resume");
    await sleep(500);
    const pc = await S(p);
    await G(p, () => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await sleep(100);
    const hid = await S(p);
    await G(p, () => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
    });
    if (want("L13")) check("L13", "일시정지: Esc 로 멈춤 · 멈춘 동안 주인공 · 용암 · 시간 정지 · 계속하기 · 탭 숨기면 자동 멈춤", pa.paused && shown && pa.s === pb.s && pa.lavaS === pb.lavaS && pa.time === pb.time && !pc.paused && pc.s > pb.s + 3 && hid.paused && pbtn.includes("스테이지 선택"), `멈춤 ${pa.paused} · 멈춘 동안 이동 ${f1(pb.s - pa.s)}m · 용암 ${f1(pb.lavaS - pa.lavaS)}m · 계속 → ${f1(pc.s - pb.s)}m · 탭 숨김 ${hid.paused} · 버튼 ${pbtn.join(",")}`);
    // 처음부터 다시
    await p.click("#pause-restart");
    await until(p, (s) => s.state === "play", 4000, "restart");
    await sleep(300);
    const rs = await S(p);
    const r0 = await G(p, () => window.__ls.rec());
    await sleep(1000);
    const r1 = await G(p, () => window.__ls.rec());
    const renders = r1.renders - r0.renders;
    const frames = r1.frames - r0.frames;
    if (want("L14")) check("L14", "처음부터 다시: 점수 · 하트 · 위치 · 용암 초기화 · 게임 루프 하나만", rs.hearts === 3 && rs.score < 120 && rs.falls === 0 && rs.hits === 0 && rs.s < 80 && rs.d > 30 && renders <= frames + 2, `하트 ${rs.hearts} · 점수 ${rs.score} · s ${f1(rs.s)} · 용암 ${f1(rs.d)}m · 1초 그리기 ${renders}번 / 화면 ${frames}프레임`);
    await p.ctx.close();
  }

  /* ---------- L15 · L16 · L19 · L32: STAGE 01 끝까지 (자동 조종 · 실제 용암) → 결과 · 기록 · 다음 스테이지 · 성능 ---------- */
  if (["L15", "L16", "L19", "L32"].some(want)) {
    const p = await openPage(browser, { errors });
    await load(p);
    await G(p, installLavaBot, {});
    await G(p, () => {
      const r = window.LavaSurfers.renderer;
      window.__perf = { n: 0, t0: performance.now(), calls: 0, worst: 0, last: performance.now() };
      const f = () => {
        requestAnimationFrame(f);
        const P = window.__perf;
        const now = performance.now();
        P.n++;
        if (now - P.t0 > 2000) P.worst = Math.max(P.worst, now - P.last);
        P.last = now;
        P.calls = Math.max(P.calls, r.info.render.calls);
      };
      f();
    });
    await start(p);
    const t0 = Date.now();
    let s;
    let minD = 99;
    while (Date.now() - t0 < 150000) {
      s = await S(p);
      if (s.state === "play") minD = Math.min(minD, s.d);
      if (s.state === "clear" || s.state === "over") break;
      await sleep(250);
    }
    const perf = await G(p, () => {
      const P = window.__perf;
      return { fps: P.n / ((performance.now() - P.t0) / 1000), calls: P.calls, worst: P.worst };
    });
    const shown = await until(p, (x) => x.screen === "result", 8000, "result").then(() => true).catch(() => false);
    await sleep(600);
    const res = await G(p, () => ({
      k: document.getElementById("res-k").textContent,
      stars: document.getElementById("res-stars").textContent,
      rows: document.querySelectorAll("#res-rows li").length,
      score: Number(document.getElementById("res-score").textContent.replace(/,/g, "")),
      game: Math.round(window.LavaSurfers.score()),
      news: document.querySelectorAll("#res-records .new").length,
      unlock: document.getElementById("res-unlock").hidden ? "" : document.getElementById("res-unlock").textContent,
      next: document.getElementById("res-next").textContent,
      rankForm: !!document.querySelector("#result form, #result .today-rank-form"),
      site: !!document.querySelector('#result a[href="/"]'),
      save: JSON.parse(localStorage.getItem("today-lava-surfers-v1") || "{}"),
    }));
    await p.screenshot({ path: "test-results/lava-result.png" }).catch(() => {});
    const posted = apiLog.filter((r) => r.method === "POST" && /\/api\/scores/.test(r.url)).length;
    if (want("L15")) check("L15", "STAGE 01 끝까지 (실제 용암 추격) → 안전지대 → 결과 (별 · 항목 7줄 · 점수 일치 · 기록 NEW · 다음 스테이지 열림)", s.state === "clear" && shown && /STAGE 01/.test(res.k) && /★/.test(res.stars) && res.rows === 7 && res.score === res.game && res.news >= 2 && /STAGE 02/.test(res.unlock) && res.next === "다음: STAGE 02" && res.site, `${Math.round((Date.now() - t0) / 1000)}초에 탈출 · 부딪힘 ${s.hits} · 빠짐 ${s.falls} · 용암 가장 가까울 때 ${f1(minD)}m · 별 ${res.stars} · 결과 ${res.score}점 = 게임 ${res.game} · NEW ${res.news}개 · "${res.unlock}"`);
    // 다음 스테이지 버튼 → STAGE 02 가 새로 만들어져 시작
    await p.click("#res-next");
    const s2 = await until(p, (x) => x.state === "play" && x.stage === 2, 12000, "stage 2").catch(() => null);
    const hud2 = await G(p, () => document.getElementById("hud-stage").textContent);
    if (want("L32")) check("L32", "결과 → '다음: STAGE 02' → 불타는 바위 계곡이 바로 시작 (하트 3 · 처음 자리)", !!s2 && s2.hearts === 3 && s2.s < 90 && hud2 === "STAGE 02 · 불타는 바위 계곡", `상태 ${s2 && s2.state} · 스테이지 ${s2 && s2.stage} · HUD "${hud2}"`);
    // 기록 저장 + 새로고침 뒤 타이틀
    await p.reload();
    await load(p);
    const tb = await G(p, () => ({ best: document.getElementById("title-best").textContent, start: document.getElementById("start-btn").textContent }));
    const sv = res.save;
    const b1 = sv.stages && sv.stages.best && sv.stages.best[1];
    if (want("L16")) check("L16", "기록 저장 (이 기기): 스테이지별 최고 점수 · 가장 빠른 탈출 · 별 · 열린 스테이지 → 새로고침 뒤 타이틀 '이어서 하기 · STAGE 02' · 스테이지 결과에선 랭킹을 저절로 보내지 않음", !!b1 && b1.score === res.game && b1.time > 0 && b1.stars >= 1 && sv.stages.unlocked === 2 && /1\/18/.test(tb.best) && tb.start === "이어서 하기 · STAGE 02" && !res.rankForm && posted === 0, `저장 ${b1 && b1.score}점 · ${b1 && f1(b1.time)}초 · 별 ${b1 && b1.stars} · 열린 ${sv.stages && sv.stages.unlocked} · 타이틀 "${tb.best.trim()}" / "${tb.start}" · 저절로 보낸 점수 ${posted}건`);
    if (want("L19")) check("L19", "성능 (STAGE 01 전체 · 높은 품질 · 1280x720): 평균 프레임 · 그리기 호출", perf.fps > 50 && perf.calls < 600, `평균 ${Math.round(perf.fps)}fps · 가장 긴 프레임 ${Math.round(perf.worst)}ms · 그리기 호출 최대 ${perf.calls}`);
    await p.ctx.close();
  }

  /* ---------- L17: 모바일 터치 (◀ ▶ 누르고 있기 + 동시에 점프 · 부스터) ---------- */
  if (want("L17")) {
    const p = await openPage(browser, { errors, width: 390, height: 844, touch: true });
    await load(p);
    await p.tap("#start-btn");
    await until(p, (s) => s.state === "play", 6000, "play");
    await holdLava(p);
    await G(p, () => window.__ls.tp(115, 0, 18));
    await sleep(300);
    const cdp = await p.ctx.newCDPSession(p);
    const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
    const rect = (id) => G(p, (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, id);
    const L = await rect("btn-left");
    const R = await rect("btn-right");
    const J = await rect("btn-jump");
    const B = await rect("btn-boost");
    const a = await S(p);
    await T("touchStart", [[L.x, L.y, 1]]);
    await sleep(450);
    await T("touchEnd", []);
    const b = await S(p);
    // 손가락을 ◀ 에서 ▶ 로 미끄러뜨리기
    await sleep(500);
    const b2 = await S(p);
    await T("touchStart", [[L.x, L.y, 1]]);
    await sleep(60);
    for (let i = 1; i <= 5; i++) {
      await T("touchMove", [[L.x + ((R.x - L.x) * i) / 5, L.y, 1]]);
      await sleep(16);
    }
    await sleep(800);
    const c = await S(p);
    // ▶ 누른 채로 점프 버튼
    await G(p, () => window.__ls.reset());
    await T("touchStart", [[R.x, R.y, 1], [J.x, J.y, 2]]);
    await sleep(120);
    await T("touchEnd", [[R.x, R.y, 1]]);
    await sleep(500);
    const jr = await G(p, () => window.__ls.rec());
    await T("touchEnd", []);
    await sleep(900);
    const b0 = await S(p);
    await T("touchStart", [[B.x, B.y, 3]]);
    await sleep(80);
    await T("touchEnd", []);
    await sleep(300);
    const b1 = await S(p);
    const touchCls = await G(p, () => document.body.classList.contains("touch"));
    await p.screenshot({ path: "test-results/lava-touch-390x844.png" }).catch(() => {});
    check("L17", "모바일 터치: ◀ ▶ 누르고 있기 · 미끄러뜨려 바꾸기 · 누른 채 점프 · 부스터 버튼", b.u < a.u - 1 && c.u > b2.u + 1 && jr.maxAir > 1 && b1.boosts === b0.boosts + 1 && touchCls, `◀ ${f1(a.u)}→${f1(b.u)} · ◀에서 ▶로 밀기 ${f1(b2.u)}→${f1(c.u)} · 누른 채 점프 ${f1(jr.maxAir)}m · 부스터 ${b0.boosts}→${b1.boosts}`);
    await p.ctx.close();
  }

  /* ---------- L18: 여러 화면 크기 (타이틀 · 스테이지 선택 · 플레이 HUD · 보스 막대) ---------- */
  if (want("L18")) {
    const sizes = [
      [360, 640, true],
      [390, 844, true],
      [844, 390, true],
      [768, 1024, true],
      [1366, 768, false],
      [1920, 1080, false],
    ];
    const out = [];
    let all = true;
    for (const [w, h, touch] of sizes) {
      const p = await openPage(browser, { errors, width: w, height: h, touch, save: unlockedSave(18) });
      await load(p);
      const titleOk = await G(p, () => [...document.querySelectorAll("#title button")].every((b) => {
        const r = b.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.height >= 44;
      }));
      // 스테이지 선택: 가로로 넘치지 않음 · 칸은 손가락 크기 · 세로로 스크롤해서 끝까지
      await G(p, () => window.LavaSurfers.ui.openPanel("stages", "title"));
      await sleep(250);
      const st = await G(p, () => {
        const card = document.querySelector("#stages .card");
        const tiles = [...document.querySelectorAll("#worlds .stage-tile")];
        const minT = Math.min(...tiles.map((t) => Math.min(t.getBoundingClientRect().width, t.getBoundingClientRect().height)));
        const cr = card.getBoundingClientRect();
        return { tiles: tiles.length, minT, hOver: card.scrollWidth > card.clientWidth + 1 || cr.right > innerWidth + 1 || cr.left < -1, scroll: card.scrollHeight > card.clientHeight ? "scroll" : "fit" };
      });
      await p.screenshot({ path: `test-results/lava-stages-${w}x${h}.png` }).catch(() => {});
      await G(p, () => window.LavaSurfers.ui.show("title"));
      // 보스전 HUD (보스 막대 · 하트 · 점수 · 버튼이 안 겹침)
      await startStage(p, 7);
      await sleep(600);
      const r = await G(p, (touch) => {
        const rect = (id) => document.getElementById(id).getBoundingClientRect();
        const inView = (b) => b.width > 0 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        const over = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const bad = ["hearts", "hud-orbs", "hud-score", "pause-btn", "hud-stage", "boss-bar", "speed", "boost-wrap"].filter((id) => !inView(rect(id)));
        const ov = [];
        let btn = 999;
        if (touch) {
          const ids = ["btn-left", "btn-right", "btn-jump", "btn-boost"];
          for (const id of ids) {
            const b = rect(id);
            if (!inView(b)) bad.push(id);
            btn = Math.min(btn, b.width, b.height);
            if (over(b, rect("hud"))) ov.push(id + "/HUD");
            if (over(b, rect("meter"))) ov.push(id + "/속도계");
          }
          for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (over(rect(ids[i]), rect(ids[j]))) ov.push(ids[i] + "/" + ids[j]);
        }
        for (const id of ["hearts", "hud-stage", "boss-bar", "hud-score", "pause-btn"]) if (over(rect("meter"), rect(id))) ov.push("속도계/" + id);
        if (over(rect("boss-bar"), rect("hearts"))) ov.push("보스막대/하트");
        if (over(rect("boss-bar"), rect("hud-score"))) ov.push("보스막대/점수");
        const g = window.LavaSurfers;
        const v = g.rider.group.position.clone().setY(g.rider.group.position.y + 0.7).project(g.cam);
        const px = ((v.x + 1) / 2) * innerWidth;
        const py = ((1 - v.y) / 2) * innerHeight;
        return { bad, ov, btn, hero: px > 0 && px < innerWidth && py > rect("hud").bottom && py < innerHeight };
      }, touch);
      await p.screenshot({ path: `test-results/lava-${w}x${h}.png` }).catch(() => {});
      const ok = titleOk && st.tiles === 19 && !st.hOver && st.minT >= 44 && !r.bad.length && !r.ov.length && r.btn >= 44 && r.hero;
      all = all && ok;
      out.push(`${w}x${h}:${ok ? "OK" : "X"}(${touch ? `버튼 ${Math.round(r.btn)}px` : "PC"} · 칸 ${Math.round(st.minT)}px ${st.scroll}${st.hOver ? " 가로넘침" : ""}${r.bad.length ? " 밖:" + r.bad : ""}${r.ov.length ? " 겹침:" + r.ov : ""}${r.hero ? "" : " 주인공 안 보임"}${titleOk ? "" : " 타이틀 버튼"})`);
      await p.ctx.close();
    }
    check("L18", "여러 화면 크기: 타이틀 버튼 · 스테이지 선택(가로 안 넘침 · 칸 44px 이상) · 보스전 HUD · 터치 버튼(44px 이상 · 안 겹침) · 주인공 보임", all, out.join(" "));
  }

  /* ---------- L20: 사운드 · 화질 설정 ---------- */
  if (want("L20")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await p.click("#sound-btn");
    await sleep(200);
    const shown = await G(p, () => !document.getElementById("sound").hidden);
    await G(p, () => {
      const el = document.getElementById("vol-sfxVol");
      el.value = 30;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      const m = document.getElementById("vol-musicVol");
      m.value = 0;
      m.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await p.click("#mute-all");
    await sleep(100);
    const muted = await G(p, () => window.TodayAudio && window.TodayAudio.isMuted());
    await p.click("#mute-all");
    const pr0 = await G(p, () => window.LavaSurfers.renderer.getPixelRatio());
    await p.click('[data-q="low"]');
    await sleep(100);
    const st = await G(p, () => ({ save: JSON.parse(localStorage.getItem("today-lava-surfers-v1")).settings, pr: window.LavaSurfers.renderer.getPixelRatio(), label: document.getElementById("vol-musicVol-v").textContent, unmuted: !window.TodayAudio.isMuted() }));
    await p.keyboard.press("Escape");
    await sleep(100);
    const back = await G(p, () => window.LavaSurfers.ui.current);
    check("L20", "사운드 설정: 음악 · 효과음 크기 저장 · 모두 끄기 · 화질 낮춤 · Esc 로 닫기", shown && st.save.sfxVol === 0.3 && st.save.musicVol === 0 && st.label === "끔" && muted && st.unmuted && st.save.quality === "low" && st.pr <= pr0 && back === "title", `효과음 ${st.save.sfxVol} · 음악 ${st.save.musicVol} ("${st.label}") · 모두 끄기 ${muted}→다시 켬 ${st.unmuted} · 화질 ${st.save.quality} (픽셀 비율 ${pr0}→${st.pr}) · Esc → ${back}`);
    await p.ctx.close();
  }

  /* ---------- L24: 스테이지 선택 · 잠금 ---------- */
  if (want("L24")) {
    // 처음 하는 사람: STAGE 01 만 열림 · 잠긴 칸은 안내만
    const p = await openPage(browser, { errors });
    await load(p);
    await p.click("#stages-btn");
    await sleep(250);
    const a = await G(p, () => ({
      shown: !document.getElementById("stages").hidden,
      worlds: [...document.querySelectorAll("#worlds .world-h")].map((h) => h.textContent.trim()),
      tiles: document.querySelectorAll("#worlds .stage-tile").length,
      open: [...document.querySelectorAll("#worlds .stage-tile:not(.locked)")].map((t) => t.dataset.stage),
      boss: document.querySelectorAll("#worlds .stage-tile.boss").length,
    }));
    await p.click('#worlds [data-stage="2"]');
    await sleep(250);
    const lk = await G(p, () => ({ t: document.getElementById("toast").textContent, screen: window.LavaSurfers.ui.current, state: window.LavaSurfers.state, stage: window.LavaSurfers.stage.id }));
    await p.keyboard.press("Escape");
    await sleep(150);
    const esc = await G(p, () => window.LavaSurfers.ui.current);
    await p.ctx.close();
    // 많이 깬 사람: 보스 칸 → 골렘 보스전 (보스 체력 막대 · 용암 거리 막대는 숨김)
    const q = await openPage(browser, { errors, save: unlockedSave(18, { 1: { score: 9000, time: 60, stars: 3 } }) });
    await load(q);
    await q.click("#stages-btn");
    await sleep(250);
    const b = await G(q, () => ({
      open: document.querySelectorAll("#worlds .stage-tile:not(.locked)").length,
      t1: document.querySelector('#worlds [data-stage="1"]').textContent.replace(/\s+/g, " ").trim(),
      sum: document.getElementById("stages-sum").textContent,
    }));
    await q.click('#worlds [data-stage="7"]');
    const g7 = await until(q, (s) => s.state === "play" && s.stage === 7, 12000, "golem").catch(() => null);
    await sleep(500);
    const hud = await G(q, () => ({ stage: document.getElementById("hud-stage").textContent, boss: !document.getElementById("boss-bar").hidden, name: document.getElementById("boss-name").textContent, pips: document.querySelectorAll("#boss-pips i").length, chase: !document.getElementById("chase").hidden }));
    await q.screenshot({ path: "test-results/lava-boss-golem.png" }).catch(() => {});
    await q.ctx.close();
    check(
      "L24",
      "스테이지 선택: 5개 월드 + 무한 도전 · 처음엔 STAGE 01 만 열림(잠긴 칸은 안내만) · Esc 로 닫기 · 열린 보스 칸 → 화산 골렘 보스전 (체력 막대 6칸)",
      a.shown && a.worlds.length === 6 && a.tiles === 19 && a.open.join(",") === "1" && a.boss === 3 && /잠겨/.test(lk.t) && lk.screen === "stages" && lk.state === "title" && esc === "title" && b.open === 19 && /★★★/.test(b.t1) && /3 \/ 54/.test(b.sum) && !!g7 && hud.stage === "BOSS 1 · 화산 골렘" && hud.boss && hud.name === "화산 골렘" && hud.pips === 6 && !hud.chase,
      `월드 ${a.worlds.join(" / ")} · 칸 ${a.tiles} · 처음 열린 칸 [${a.open}] · 잠긴 칸 → "${lk.t}" (${lk.screen}) · Esc → ${esc} / 다 연 저장: 열린 칸 ${b.open} · "${b.t1}" · "${b.sum.trim()}" → HUD "${hud.stage}" · 보스 막대 ${hud.boss} "${hud.name}" ${hud.pips}칸 · 용암 막대 ${hud.chase ? "보임" : "숨김"}`
    );
  }

  /* ---------- L25: 18 스테이지 + 무한 도전이 각각 따로 만들어지고 · 저마다 다른 지형 · 장치 · 분위기 ---------- */
  if (want("L25")) {
    const p = await openPage(browser, { errors, save: unlockedSave(18) });
    await load(p);
    const geo0 = await G(p, () => window.LavaSurfers.renderer.info.memory.geometries);
    // 스테이지마다 꼭 있어야 하는 대표 장치 (지시서의 스테이지 설명)
    const need = {
      1: (x) => x.types.rock && x.types.spire && x.holes > 0,
      2: (x) => x.types["slider:boulder"] >= 5,
      3: (x) => x.types.crumble >= 20 && x.styles.includes("bridge"),
      4: (x) => x.types.fire >= 30,
      5: (x) => x.types.lavafall >= 10 && x.types["bomb:lava"] && x.fogs > 0,
      6: (x) => x.types.erupt >= 6 && x.types["bomb:rock"],
      7: (x) => x.boss === "golem",
      8: (x) => x.pads >= 12 && x.sink > 0,
      9: (x) => x.div >= 6 && x.holes >= 6,
      10: (x) => x.bigWave > 1.2 && x.lavaUp,
      11: (x) => x.types.rotor >= 5 && x.tun >= 2,
      12: (x) => x.types.wheel >= 8 && x.lift > 0,
      13: (x) => x.types.gate >= 4 && x.types.laser >= 4,
      14: (x) => x.boss === "wyvern",
      15: (x) => x.winds >= 4 && x.types["bomb:bolt"] >= 8 && x.fogs > 0,
      16: (x) => x.types["slider:claw"] && x.types["slider:tail"] && x.types["bomb:fire"],
      17: (x) => Object.keys(x.types).length >= 7 && x.pads > 0,
      18: (x) => x.boss === "dragon",
      99: (x) => x.len > 5000 && Object.keys(x.types).length >= 15,
    };
    const rows = [];
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 99]) {
      const ok = await startStage(p, id).then(() => true).catch(() => false);
      await sleep(700);
      const x = await G(p, () => {
        const g = window.LavaSurfers;
        const T = g.track;
        const c = g.course;
        const types = {};
        for (const o of g.items.obs) {
          const k = o.type + (o.look ? ":" + o.look : o.kind ? ":" + o.kind : "");
          types[k] = (types[k] || 0) + 1;
        }
        const sky = g.theme.sky.join("");
        return { id: g.stage.id, theme: g.stage.theme, sky, boss: g.stage.boss || "", types, len: Math.round(T.len), pads: T.pads.length, sink: T.pads.filter((q) => q.sink).length, lift: T.pads.filter((q) => q.lift).length, holes: T.staticHoles.length, div: T.dividers.length, winds: T.winds.length, tun: T.tunnels.length, styles: T.styles.map((s) => s[2]).join(","), fogs: (c.fogs || []).length, bigWave: g.theme.bigWave || 0, lavaUp: c.lava.length > 1 && c.lava[c.lava.length - 1].k > c.lava[0].k, calls: g.renderer.info.render.calls, music: g.music && g.music() ? 1 : 0 };
      });
      x.ok = ok && x.id === id && need[id](x);
      rows.push(x);
      await G(p, () => window.LavaSurfers.toTitle());
    }
    await startStage(p, 1);
    await sleep(500);
    const geo1 = await G(p, () => window.LavaSurfers.renderer.info.memory.geometries);
    await p.ctx.close();
    const themes = new Set(rows.map((r) => r.theme));
    const skies = new Set(rows.map((r) => r.sky));
    const bad = rows.filter((r) => !r.ok).map((r) => r.id);
    check("L25", "18 스테이지 + 무한 도전: 각각 따로 시작 · 저마다 다른 테마(하늘 · 빛) · 대표 장치가 실제로 놓임 · 스테이지를 바꿔도 메모리가 쌓이지 않음", !bad.length && themes.size === 19 && skies.size === 19 && geo1 <= geo0 * 1.25 + 40, `테마 ${themes.size}개 · 하늘 ${skies.size}가지 · 대표 장치 없음 [${bad.join(",") || "없음"}] · 그리기 호출 최대 ${Math.max(...rows.map((r) => r.calls))} · geometry 처음 ${geo0} → 19개 돌고 STAGE 01 ${geo1} · ${rows.map((r) => `${r.id}:${Object.keys(r.types).slice(0, 3).join("+") || r.boss || (r.pads ? "pads" : "")}`).join(" ")}`);
  }

  /* ---------- L26 · L29 · L31: 18 스테이지 모두 끝까지 (자동 조종 · 실제 용암 · 보스 격파) → 최종 클리어 · 엔딩 · 랭킹 ---------- */
  if (["L26", "L29", "L31"].some(want)) {
    const p = await openPage(browser, { errors, save: unlockedSave(1) });
    await load(p);
    await G(p, installLavaBot, {});
    await G(p, () => {
      const r = window.LavaSurfers.renderer;
      window.__perf = { n: 0, t0: performance.now(), calls: 0, worst: 0, last: performance.now() };
      const f = () => {
        requestAnimationFrame(f);
        const P = window.__perf;
        const now = performance.now();
        P.n++;
        if (now - P.t0 > 2000) P.worst = Math.max(P.worst, now - P.last);
        P.last = now;
        P.calls = Math.max(P.calls, r.info.render.calls);
      };
      f();
    });
    const rows = [];
    let allOk = true;
    let bossOk = true;
    for (let id = 1; id <= 18; id++) {
      // 앞 스테이지를 깨야 열림 → 저장에 열린 만큼만 시작할 수 있음
      const open = await G(p, () => window.LavaSurfers.save.unlocked);
      if (open < id) {
        rows.push(`${id}:잠김`);
        allOk = false;
        break;
      }
      let tries = 0;
      let s;
      const t0 = Date.now();
      await G(p, () => {
        const P = window.__perf;
        P.n = 0;
        P.t0 = performance.now();
        P.calls = 0;
        P.worst = 0;
      });
      while (tries < 2) {
        tries++;
        if (tries === 1) await startStage(p, id);
        else {
          await G(p, () => window.LavaSurfers.restart());
          await until(p, (x) => x.state === "play", 6000, "retry");
        }
        const ts = Date.now();
        while (Date.now() - ts < 200000) {
          s = await S(p);
          if (s.state === "clear" || (s.state === "over" && s.screen !== null && s.screen !== "title")) break;
          await sleep(300);
        }
        if (s.state === "clear") break;
      }
      const perf = await G(p, () => {
        const P = window.__perf;
        return { fps: Math.round(P.n / ((performance.now() - P.t0) / 1000)), calls: P.calls };
      });
      const cleared = s.state === "clear";
      const isBoss = [7, 14, 18].includes(id);
      if (isBoss && !(cleared && s.boss && s.boss.hp === 0 && s.escape)) bossOk = false;
      allOk = allOk && cleared;
      rows.push(`${id}:${cleared ? "탈출" : "실패"}${tries > 1 ? `(${tries}번째)` : ""} ${Math.round((Date.now() - t0) / 1000)}s 부딪힘${s.hits} 빠짐${s.falls}${isBoss ? ` 보스HP${s.boss && s.boss.hp}` : ""} ${perf.fps}fps/${perf.calls}`);
      if (!cleared) break;
      await until(p, (x) => x.screen === "result", 8000, "result").catch(() => null);
      if (id < 18) await G(p, () => window.LavaSurfers.toTitle());
    }
    if (want("L26")) check("L26", "18 스테이지 모두 끝까지 (자동 조종 · 실제 용암 · 실패하면 한 번 더) · 보스 3 마리 격파 후 탈출 · 깨면 다음 스테이지가 열림", allOk && rows.length === 18, rows.join(" · "));
    if (want("L31")) check("L31", "보스전: 체력 막대 6칸이 0 이 되면 격파 → 용암이 깨어나고 안전지대까지 탈출해야 클리어 (골렘 · 와이번 · 고대 용)", bossOk && allOk, rows.filter((r) => /보스/.test(r)).join(" · "));
    // 최종 클리어 → 엔딩 · 18 스테이지 합계 랭킹 (직접 등록할 때만 보냄)
    if (want("L29") && allOk) {
      const r = await G(p, () => ({ next: document.getElementById("res-next").textContent, h: document.getElementById("res-h").textContent }));
      await p.click("#res-next");
      await sleep(600);
      const e = await G(p, () => {
        const sv = window.LavaSurfers.save;
        return {
          screen: window.LavaSurfers.ui.current,
          total: Number(document.getElementById("end-total").textContent.replace(/,/g, "")),
          sum: sv.totalBest(),
          list: document.querySelectorAll("#end-list li").length,
          form: !!document.querySelector("#end-rank form, #end-rank .today-rank-form"),
          ending: sv.data.ending,
          endlessOpen: sv.endlessOpen(),
        };
      });
      await p.screenshot({ path: "test-results/lava-ending.png" }).catch(() => {});
      const posted = apiLog.filter((x) => x.method === "POST" && /\/api\/scores/.test(x.url)).length;
      check("L29", "고대 용 격파 → '엔딩 보기' → 최종 클리어 화면 (18 스테이지 기록 · 최고 점수 합계 = 저장 합계 · 랭킹 칸은 직접 등록할 때만 보냄)", /격파/.test(r.h) && r.next === "엔딩 보기" && e.screen === "ending" && e.total === e.sum && e.total > 0 && e.list === 18 && e.form && e.ending === 1 && e.endlessOpen && posted === 0, `"${r.h}" · 버튼 "${r.next}" → ${e.screen} · 합계 ${e.total} (저장 ${e.sum}) · 기록 ${e.list}줄 · 랭킹 칸 ${e.form} · 저절로 보낸 점수 ${posted}건`);
    } else if (want("L29")) check("L29", "최종 클리어 → 엔딩", false, "18 스테이지를 다 깨지 못해 확인 못 함");
    await p.ctx.close();
  }

  /* ---------- L27: 보스전에서 하트 0 → 게임 오버 → 보스전 다시 도전 (지금 단계부터) ---------- */
  if (want("L27")) {
    const p = await openPage(browser, { errors, save: unlockedSave(18) });
    await load(p);
    await startStage(p, 7);
    await until(p, (s) => s.boss && s.boss.state === "fight", 8000, "fight").catch(() => null);
    await sleep(500);
    const before = await S(p);
    await G(p, () => {
      const g = window.LavaSurfers;
      g.run.hearts = 1;
      g.player.invulnT = 0;
      g.onBoss({ type: "hit", u: g.player.u + 1 }); // 보스 공격에 맞음 (게임이 받는 것과 같은 일)
    });
    await until(p, (s) => s.screen === "over", 5000, "boss over").catch(() => null);
    const ov = await G(p, () => ({ k: document.getElementById("over-k").textContent, h: document.getElementById("over-h").textContent, cp: !!document.getElementById("over-cp").offsetParent, cpT: document.getElementById("over-cp").textContent }));
    await p.click("#over-cp");
    const back = await until(p, (s) => s.state === "play", 5000, "retry").catch(() => null);
    await sleep(300);
    const bar = await G(p, () => !document.getElementById("boss-bar").hidden);
    check("L27", "보스전: 하트를 모두 잃으면 '화산 골렘에게 졌어요' → '보스전 다시 도전' → 하트 3 · 보스 체력은 지금 단계 그대로", /BOSS 1/.test(ov.k) && /골렘에게 졌어요/.test(ov.h) && ov.cp && ov.cpT === "보스전 다시 도전" && !!back && back.hearts === 3 && back.boss && back.boss.hp === before.boss.hp && bar, `"${ov.k} / ${ov.h}" · 버튼 "${ov.cpT}" → 하트 ${back && back.hearts} · 보스 체력 ${before.boss && before.boss.hp} → ${back && back.boss && back.boss.hp} · 막대 ${bar}`);
    await p.ctx.close();
  }

  /* ---------- L28: 무한 도전 (STAGE 03 을 깨면 열림) → 거리 표시 → 따라잡힘 → 결과 · 기록 · 랭킹 칸 ---------- */
  if (want("L28")) {
    const p = await openPage(browser, { errors, save: unlockedSave(4, { 1: { score: 1, time: 60, stars: 1 }, 2: { score: 1, time: 60, stars: 1 }, 3: { score: 1, time: 60, stars: 1 } }) });
    await load(p);
    const eb = await G(p, () => document.getElementById("endless-btn").textContent);
    await G(p, installLavaBot, {});
    await p.click("#endless-btn");
    const s0 = await until(p, (s) => s.state === "play" && s.stage === 99, 15000, "endless").catch(() => null);
    await sleep(25000);
    const mid = await S(p);
    const hud = await G(p, () => ({ dist: document.getElementById("hud-dist").textContent, shown: !document.getElementById("hud-dist").hidden, stage: document.getElementById("hud-stage").textContent }));
    // 용암이 따라잡게 함 (게임 오버 길)
    await G(p, () => {
      const g = window.LavaSurfers;
      window.__hold = setInterval(() => g.state === "play" && (g.lava.lavaS = g.player.s + 1), 30);
    });
    await until(p, (s) => s.screen === "endless", 8000, "endless result").catch(() => null);
    await sleep(400);
    const r = await G(p, () => ({
      h: document.getElementById("eres-h").textContent,
      score: Number(document.getElementById("eres-score").textContent.replace(/,/g, "")),
      rec: document.getElementById("eres-records").textContent.replace(/\s+/g, " ").trim(),
      form: !!document.querySelector("#eres-rank form, #eres-rank .today-rank-form"),
      save: JSON.parse(localStorage.getItem("today-lava-surfers-v1")).endless,
    }));
    await p.screenshot({ path: "test-results/lava-endless.png" }).catch(() => {});
    const posted = apiLog.filter((x) => x.method === "POST" && /\/api\/scores/.test(x.url)).length;
    check("L28", "무한 도전: STAGE 03 을 깨면 열림 → 시작 · 간 거리 표시 → 따라잡히면 결과(점수 · 거리 기록 · 랭킹 칸) · 이 기기에 최고 기록 저장 · 저절로 보내지 않음", eb === "무한 도전" && !!s0 && mid.state === "play" && mid.s > 300 && hud.shown && /\d+m/.test(hud.dist) && hud.stage === "ENDLESS · 무한 도전" && /따라잡혔/.test(r.h) && r.score > 0 && r.form && r.save.best === r.score && r.save.runs === 1 && r.save.dist > 200 && posted === 0, `버튼 "${eb}" · 25초에 ${f1(mid.s - 60)}m (HUD ${hud.dist}) · "${r.h}" ${r.score}점 · ${r.rec} · 랭킹 칸 ${r.form} · 저장 최고 ${r.save.best} / ${Math.round(r.save.dist)}m · 저절로 보낸 점수 ${posted}건`);
    await p.ctx.close();
  }

  /* ---------- L30: 예전(코스 1 하나뿐이던) 기록 → 새 저장으로 옮김 ---------- */
  if (want("L30")) {
    const p = await openPage(browser, { errors, save: { plays: 3, best: 5000, bestTime: 70.5, bestDist: 900, clears: 2, settings: { musicVol: 0.5, sfxVol: 0.9, quality: "auto" } } });
    await load(p);
    const r = await G(p, () => ({ d: window.LavaSurfers.save.data, title: document.getElementById("title-best").textContent, start: document.getElementById("start-btn").textContent }));
    const b = r.d.stages.best[1];
    check("L30", "예전 기록(v1) → STAGE 01 기록으로 옮김 · STAGE 02 열림 · 설정 그대로", r.d.v === 2 && b && b.score === 5000 && b.time === 70.5 && r.d.stages.unlocked === 2 && r.d.settings.musicVol === 0.5 && /1\/18/.test(r.title) && r.start === "이어서 하기 · STAGE 02", `v${r.d.v} · STAGE 01 ${b && b.score}점 ${b && b.time}초 · 열린 ${r.d.stages.unlocked} · 음악 ${r.d.settings.musicVol} · "${r.title.trim()}" / "${r.start}"`);
    await p.ctx.close();
  }

  /* ---------- L21: 홈 · 다른 게임 ---------- */
  if (want("L21")) {
    const h = await openPage(browser, { errors });
    await h.goto(BASE + "/");
    await sleep(1500);
    const home = await G(h, () => {
      const a = document.querySelector('a[href="/games/lava-surfers/"]');
      const img = a && a.querySelector("img");
      return { card: !!a, shelf: a ? (a.closest("section") || {}).id : "", tag: a ? a.textContent.replace(/\s+/g, " ").trim() : "", thumb: img ? img.getAttribute("src") : "", broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== "lazy").length };
    });
    const games = [];
    for (const g of ["sky-island", "dragon-statue", "sea-monster", "jetski-race"]) {
      const before = errors.length;
      await h.goto(`${BASE}/games/${g}/`);
      await sleep(2000);
      games.push(`${g}:${errors.length === before ? "OK" : "오류"}`);
    }
    check("L21", "홈 아케이드 칸에 카드 · 썸네일 · 기존 게임 정상", home.card && home.shelf === "cat-arcade" && home.broken === 0 && games.every((x) => x.endsWith("OK")), `카드 ${home.card} (${home.shelf}) "${home.tag.slice(0, 40)}" · 썸네일 ${home.thumb || "없음"} · ${games.join(", ")}`);
    await h.ctx.close();
  }

  const leaked = apiLog.filter((r) => /data:image|base64|today-lava-surfers/.test(r.body));
  check("L22", "/api 로 보내는 것에 사진 · 저장 데이터 없음 · 저절로 보낸 점수 없음", leaked.length === 0 && !apiLog.some((r) => r.method === "POST" && /\/api\/scores/.test(r.url)), `/api 요청 ${apiLog.length}건 (${[...new Set(apiLog.map((r) => r.method + " " + new URL(r.url).pathname))].join(", ") || "없음"})`);
  check("L23", "콘솔 오류 · 리소스 로딩 오류 없음", errors.length === 0, errors.length ? errors.slice(0, 6) : "없음 (/api 는 가짜 응답)");

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e.message);
  process.exit(1);
});
