/**
 * 용암 서핑 — 자동 점검 (실제 브라우저 · 실제 게임 코드 · 실제 키 · 터치 입력)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-lava-surfers.js   (LS_ONLY=L1,L7 처럼 골라서도 됨)
 *
 * - /api/* 는 가짜 응답 → 실제 랭킹 · 인기 집계에 아무것도 쓰지 않는다.
 * - 저장 데이터는 테스트마다 새 브라우저 칸에서 (내 기기 기록과 상관없음).
 * - 위치 옮기기(tp)는 '그 자리에서 실제로 타 보기' 위해서만 쓰고, 판정은 게임이 실제로 낸 결과로 한다.
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
        return {
          state: g.state,
          paused: g.paused,
          screen: g.ui.current,
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
  return until(p, (s) => s.state === "play", 4000, "play");
}
/** 용암을 멀리 두고 (테스트 중 따라잡히지 않게) */
const holdLava = (p, on = true) =>
  G(p, (on) => {
    const g = window.LavaSurfers;
    clearInterval(window.__hold);
    if (on) window.__hold = setInterval(() => g.lava.lavaS = Math.min(g.lava.lavaS, g.player.s - 60), 50);
  }, on);
async function hold(p, key, ms) {
  await p.keyboard.down(key);
  await sleep(ms);
  await p.keyboard.up(key);
}

(async () => {
  const browser = await launch();
  const errors = [];

  /* ---------- L1 ~ L7: 타이틀 · 시작 · 좌우 · 점프 · 경사 속도 · 부스터 · 충돌 ---------- */
  if (["L1", "L2", "L3", "L4", "L5", "L6", "L7"].some(want)) {
    const p = await openPage(browser, { errors });
    const loadMs = await load(p);
    await sleep(600);
    const title = await G(p, () => {
      const g = window.LavaSurfers;
      const btns = [...document.querySelectorAll("#title button")].filter((b) => b.offsetParent).map((b) => b.textContent.trim());
      const parts = [];
      g.rider.group.traverse((o) => o.isMesh && parts.push(o));
      const v = g.rider.group.position.clone().setY(g.rider.group.position.y + 0.8).project(g.cam);
      return {
        loadingHidden: document.getElementById("loading").hidden,
        titleShown: !document.getElementById("title").hidden,
        buttons: btns,
        meshes: parts.length,
        board: parts.some((m) => /board/i.test(m.name || "") || (m.parent && /board/i.test(m.parent.name || ""))),
        onScreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1,
        best: document.getElementById("title-best").textContent,
      };
    });
    await p.screenshot({ path: "test-results/lava-title-1280.png" }).catch(() => {});
    if (want("L1"))
      check("L1", "불러오기 → 타이틀 (실제로 되는 버튼 3개) · 피코와 보드가 화면에 보임", title.loadingHidden && title.titleShown && title.buttons.join("|") === "게임 시작|조작 방법|사운드 설정" && title.meshes > 30 && title.onScreen, `${(loadMs / 1000).toFixed(1)}초 · 버튼 ${title.buttons.join(", ")} · 주인공+보드 부품 ${title.meshes}개 · 화면 안 ${title.onScreen} · "${title.best.trim()}"`);

    const t1 = Date.now();
    await start(p);
    const goMs = Date.now() - t1;
    const rec0 = await G(p, () => window.__ls.rec());
    if (want("L2")) check("L2", "게임 시작 → 준비 · 출발! → 바로 조작", goMs < 3000 && rec0.states.join(">").includes("title>ready>play"), `시작 버튼 → 조작까지 ${(goMs / 1000).toFixed(1)}초 · 상태 ${rec0.states.join(">")}`);
    await holdLava(p);

    // L3 좌우
    await G(p, () => window.__ls.tp(115, 0, 18));
    await sleep(300);
    const a = await S(p);
    await hold(p, "KeyA", 450);
    const b = await S(p);
    await hold(p, "ArrowRight", 800);
    const c = await S(p);
    await hold(p, "ArrowLeft", 800);
    const d = await S(p);
    const leanSeen = (await G(p, () => window.LavaSurfers.rlean)) !== undefined;
    if (want("L3")) check("L3", "좌우: A/← 왼쪽 · D/→ 오른쪽 (가속 · 놓으면 멈춤)", b.u < a.u - 1.2 && c.u > b.u + 2 && d.u < c.u, `u ${f1(a.u)} → A ${f1(b.u)} → → ${f1(c.u)} → ← ${f1(d.u)} · 기울임 ${leanSeen}`);

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

    // L5 경사 속도: 완만한 출발 비탈(경사 약 0.09) vs 가파른 비탈(약 0.17) · 둘 다 장애물 없는 곳
    const ride = async (s0, ms) => {
      await G(p, (s0) => window.__ls.tp(s0, 0, 15), s0);
      await sleep(ms);
      const x = await S(p);
      x.slope = await G(p, (s) => window.LavaSurfers.track.slope(s), x.s);
      return x;
    };
    const lo = await ride(62, 1400);
    const hi = await ride(200, 1800);
    if (want("L5")) check("L5", "경사 따라 속도: 가파른 곳이 더 빠름", hi.speed > lo.speed + 3, `완만한 곳 (s ${f1(lo.s)}, 경사 ${lo.slope.toFixed(2)}) ${f1(lo.speed * 3.6)}km/h · 가파른 곳 (s ${f1(hi.s)}, 경사 ${hi.slope.toFixed(2)}) ${f1(hi.speed * 3.6)}km/h`);

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

    // L7 충돌: 같은 자리 · 같은 용암 거리에서, 피했을 때 vs 바위 기둥에 부딪혔을 때
    await holdLava(p, false);
    const run7 = async (u) => {
      await G(p, (u) => window.__ls.tp(270, u, 22, 34), u);
      await sleep(2600);
      return S(p);
    };
    const ctrl = await run7(0);
    const h0 = ctrl.hits;
    const hit = await run7(3.5);
    const toast = await G(p, () => document.getElementById("toast").textContent);
    if (want("L7")) check("L7", "충돌: 바위 기둥에 부딪히면 느려지고 · 용암이 가까워짐 · 콤보 끊김", hit.hits >= h0 + 1 && hit.d < ctrl.d - 4 && /부딪/.test(toast), `피함: 용암 ${f1(ctrl.d)}m / 부딪힘(${hit.hits - h0}번): 용암 ${f1(hit.d)}m · "${toast.trim()}"`);
    await p.ctx.close();
  }

  /* ---------- L8: 용암 추격 → 위험 표시 → 따라잡힘(게임 오버) → 처음부터 다시 ---------- */
  if (want("L8")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await G(p, installLavaBot, { ram: true });
    const t0 = Date.now();
    let minD = 99;
    let maxDanger = 0;
    let s;
    const ds = [];
    while (Date.now() - t0 < 60000) {
      s = await S(p);
      const dg = await G(p, () => Number(getComputedStyle(document.getElementById("danger")).opacity));
      maxDanger = Math.max(maxDanger, dg);
      if (s.state === "play") minD = Math.min(minD, s.d);
      if (ds.length === 0 || Date.now() - t0 > ds.length * 2000) ds.push(`${Math.round(s.d)}`);
      if (s.state === "over") break;
      await sleep(100);
    }
    await until(p, (x) => x.screen === "over", 4000, "over screen").catch(() => null);
    const over = await G(p, () => ({ h: document.getElementById("over-h").textContent, again: !!document.getElementById("over-again").offsetParent, site: !!document.querySelector('#over a[href="/"]'), stats: document.getElementById("over-stats").textContent.replace(/\s+/g, " ") }));
    await p.screenshot({ path: "test-results/lava-caught.png" }).catch(() => {});
    await p.click("#over-again");
    const back = await until(p, (x) => x.state === "play", 4000, "restart").catch(() => null);
    check("L8", "용암 추격: 부딪힐수록 거리 줄어듦 → 위험 표시 → 거리 0 = 게임 오버 → 처음부터 다시", s.state === "over" && s.hits >= 2 && maxDanger > 0.4 && /따라잡혔/.test(over.h) && over.again && over.site && !!back && back.hearts === 3 && back.s < 90, `부딪힘 ${s.hits}번 · 거리 변화 ${ds.join("→")}m · 위험 표시 최대 ${maxDanger.toFixed(2)} · "${over.h}" (${over.stats.trim()}) · 다시 → 하트 ${back && back.hearts} · s ${back && f1(back.s)}`);
    await p.ctx.close();
  }

  /* ---------- L9 · L10 · L12: 체크포인트 · 용암에 빠짐 · 구슬 · 점수 · 콤보 ---------- */
  if (["L9", "L10", "L12"].some(want)) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await holdLava(p);
    // 구슬 길 (s 120~160, 가운데 6개)
    await G(p, () => window.__ls.tp(112, 0, 18));
    await sleep(2600);
    const o = await S(p);
    const comboShown = await G(p, () => !document.getElementById("combo").hidden);
    const hudOrbs = await G(p, () => Number(document.getElementById("hud-orbs").textContent));
    const sum = Object.values(o.pts).reduce((a, b) => a + b, 0);
    if (want("L10")) check("L10", "에너지 구슬 · 점수 · 콤보 (점수 = 항목 합)", o.orbs >= 5 && o.pts.orbs >= 100 && o.bestCombo >= 3 && comboShown && hudOrbs === o.orbs && Math.round(sum) === o.score, `구슬 ${o.orbs} (HUD ${hudOrbs}) · 구슬 점수 ${o.pts.orbs} · 최고 콤보 ${o.bestCombo} · 콤보 표시 ${comboShown} · 총점 ${o.score} = 합 ${Math.round(sum)}`);
    // 체크포인트 (s 528)
    await G(p, () => window.__ls.tp(515, 0, 20));
    const cp = await until(p, (s) => s.cp === 528, 3000, "checkpoint").catch(() => null);
    const cpToast = await G(p, () => document.getElementById("toast").textContent);
    const snap = await S(p);
    // 지름길 오른쪽(벽 없음)에서 구슬을 몇 개 먹고 → 오른쪽으로 계속 → 용암에 빠짐
    await G(p, () => window.__ls.tp(606, 7.2, 20, 60));
    await sleep(900);
    const got = await S(p);
    await p.keyboard.down("KeyD");
    const fell = await until(p, (s) => s.state === "fall", 4000, "fall").catch(() => null);
    await p.keyboard.up("KeyD");
    const back = await until(p, (s) => s.state === "play", 4000, "respawn").catch(() => null);
    await sleep(100);
    const after = await S(p);
    if (want("L12")) check("L12", "체크포인트 지나면 저장 (안내 · 표시)", !!cp && /체크포인트/.test(cpToast), `체크포인트 s ${cp && cp.cp} · "${cpToast.trim()}"`);
    if (want("L9")) check("L9", "용암에 빠짐 → 하트 -1 → 체크포인트에서 다시 (그 뒤 얻은 구슬 · 점수 되돌림 · 용암은 뒤로)", !!fell && !!back && after.hearts === snap.hearts - 1 && Math.abs(after.s - 528) < 3 && got.orbs > snap.orbs && after.orbs === snap.orbs && after.d > 30, `구슬 ${snap.orbs}→${got.orbs} → 빠짐 → 하트 ${snap.hearts}→${after.hearts} · 다시 선 곳 s ${f1(after.s)} · 구슬 ${after.orbs} · 용암 ${f1(after.d)}m 뒤`);
    // 하트 0 → 게임 오버(하트) → 체크포인트에서 이어하기
    await G(p, () => (window.LavaSurfers.run.hearts = 1));
    await G(p, () => window.__ls.tp(620, 7.5, 20, 60));
    await p.keyboard.down("KeyD");
    await until(p, (s) => s.screen === "over", 6000, "over").catch(() => null);
    await p.keyboard.up("KeyD");
    const ov = await G(p, () => ({ h: document.getElementById("over-h").textContent, cp: !!document.getElementById("over-cp").offsetParent, best: document.getElementById("over-best").textContent }));
    await p.click("#over-cp");
    const cont = await until(p, (s) => s.state === "play", 4000, "continue").catch(() => null);
    if (want("L9")) check("L9b", "하트 0 → 게임 오버 → '체크포인트에서 다시' → 하트 3 으로 528m 부터", /하트/.test(ov.h) && ov.cp && !!cont && cont.hearts === 3 && Math.abs(cont.s - 528) < 3, `"${ov.h}" · 체크포인트 버튼 ${ov.cp} · "${ov.best}" → 하트 ${cont && cont.hearts} · s ${cont && f1(cont.s)}`);
    await p.ctx.close();
  }

  /* ---------- L11: 스턴트 (공중 회전) 성공 · 실패 판정 ---------- */
  if (want("L11")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await holdLava(p);
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
    // 1) 큰 점프대(1076~1092)에서 날아오르자마자 회전 → 깨끗하게 착지
    await jumpAt("early");
    const s0 = await S(p);
    await G(p, () => window.__ls.tp(1058, 0, 26, 60));
    await until(p, (s) => s.s > 1094 && !s.onGround, 5000, "launch").catch(() => null);
    const ok1 = await until(p, (s) => s.onGround && s.s > 1105, 5000, "land").catch(() => null);
    await sleep(200);
    const a = await S(p);
    // 2) 착지 직전에 회전 시작 → 반쯤 돈 채로 착지 = 실패 (점수 없음)
    await jumpAt("late");
    await G(p, () => window.__ls.tp(1058, 0, 26, 60));
    await until(p, (s) => s.s > 1094 && !s.onGround, 5000, "launch2").catch(() => null);
    await until(p, (s) => s.onGround && s.s > 1105, 5000, "land2").catch(() => null);
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
    if (want("L13")) check("L13", "일시정지: Esc 로 멈춤 · 멈춘 동안 주인공 · 용암 · 시간 정지 · 계속하기 · 탭 숨기면 자동 멈춤", pa.paused && shown && pa.s === pb.s && pa.lavaS === pb.lavaS && pa.time === pb.time && !pc.paused && pc.s > pb.s + 3 && hid.paused, `멈춤 ${pa.paused} · 멈춘 동안 이동 ${f1(pb.s - pa.s)}m · 용암 ${f1(pb.lavaS - pa.lavaS)}m · 계속 → ${f1(pc.s - pb.s)}m · 탭 숨김 ${hid.paused}`);
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

  /* ---------- L15 · L16 · L19: 코스 끝까지 (자동 조종 · 실제 용암) → 결과 · 기록 · 성능 ---------- */
  if (want("L15") || want("L16") || want("L19")) {
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
    const geo0 = await G(p, () => window.LavaSurfers.renderer.info.memory.geometries);
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
      rows: document.querySelectorAll("#res-rows li").length,
      score: Number(document.getElementById("res-score").textContent.replace(/,/g, "")),
      game: Math.round(window.LavaSurfers.score()),
      rec: document.getElementById("res-records").textContent.replace(/\s+/g, " "),
      news: document.querySelectorAll("#res-records .new").length,
      rank: !!document.querySelector("#res-rank .today-rank-form, #res-rank form"),
      site: !!document.querySelector('#result a[href="/"]'),
      save: JSON.parse(localStorage.getItem("today-lava-surfers-v1") || "{}"),
    }));
    await p.screenshot({ path: "test-results/lava-result.png" }).catch(() => {});
    const posted = apiLog.filter((r) => r.method === "POST" && /\/api\/scores/.test(r.url)).length;
    if (want("L15")) check("L15", "코스 1 끝까지 (12구간 · 실제 용암 추격) → 안전지대 → 결과 (항목 7줄 · 점수 일치 · 기록 NEW · 사이트로)", s.state === "clear" && shown && res.rows === 7 && res.score === res.game && res.news >= 2 && res.site, `${Math.round((Date.now() - t0) / 1000)}초에 탈출 · 부딪힘 ${s.hits} · 빠짐 ${s.falls} · 용암 가장 가까울 때 ${f1(minD)}m · 결과 ${res.score}점 = 게임 ${res.game} · NEW ${res.news}개`);
    // 기록 저장 + 새로고침 뒤 타이틀
    await p.reload();
    await load(p);
    const tb = await G(p, () => document.getElementById("title-best").textContent);
    if (want("L16")) check("L16", "기록 저장 (이 기기): 최고 점수 · 가장 빠른 탈출 · 탈출 횟수 → 새로고침 뒤 타이틀에 표시 · 랭킹은 결과에서 직접 등록할 때만", res.save.best === res.game && res.save.bestTime > 0 && res.save.clears === 1 && /최고 점수/.test(tb) && /가장 빠른/.test(tb) && res.rank && posted === 0, `저장 best ${res.save.best} · ${f1(res.save.bestTime)}초 · 탈출 ${res.save.clears}번 · 타이틀 "${tb.trim()}" · 랭킹 칸 ${res.rank} · 저절로 보낸 점수 ${posted}건`);
    const geo1 = await G(p, () => window.LavaSurfers.renderer.info.memory.geometries);
    if (want("L19")) check("L19", "성능 (코스 전체 · 높은 품질 · 1280x720): 평균 프레임 · 그리기 호출", perf.fps > 50 && perf.calls < 600, `평균 ${Math.round(perf.fps)}fps · 가장 긴 프레임 ${Math.round(perf.worst)}ms · 그리기 호출 최대 ${perf.calls} · geometry 처음 ${geo0} / 새로고침 뒤 ${geo1}`);
    await p.ctx.close();
  }

  /* ---------- L17: 모바일 터치 (◀ ▶ 누르고 있기 + 동시에 점프 · 부스터) ---------- */
  if (want("L17")) {
    const p = await openPage(browser, { errors, width: 390, height: 844, touch: true });
    await load(p);
    await p.tap("#start-btn");
    await until(p, (s) => s.state === "play", 4000, "play");
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

  /* ---------- L18: 여러 화면 크기 ---------- */
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
      const p = await openPage(browser, { errors, width: w, height: h, touch });
      await load(p);
      const titleOk = await G(p, () => [...document.querySelectorAll("#title button")].every((b) => {
        const r = b.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.height >= 44;
      }));
      if (touch) await p.tap("#start-btn");
      else await p.click("#start-btn");
      await until(p, (s) => s.state === "play", 4000, "play");
      await sleep(600);
      const r = await G(p, (touch) => {
        const rect = (id) => document.getElementById(id).getBoundingClientRect();
        const inView = (b) => b.width > 0 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        const over = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const bad = ["hearts", "hud-orbs", "hud-score", "pause-btn", "chase", "speed", "boost-wrap"].filter((id) => !inView(rect(id)));
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
        // 속도계 · 부스터 막대가 HUD 글자와 겹치지 않게
        for (const id of ["hearts", "hud-orbs", "chase", "chase-t", "hud-score", "pause-btn"]) if (over(rect("meter"), id === "hud-orbs" ? document.getElementById(id).parentElement.getBoundingClientRect() : rect(id))) ov.push("속도계/" + id);
        const g = window.LavaSurfers;
        const v = g.rider.group.position.clone().setY(g.rider.group.position.y + 0.7).project(g.cam);
        const px = ((v.x + 1) / 2) * innerWidth;
        const py = ((1 - v.y) / 2) * innerHeight;
        return { bad, ov, btn, hero: px > 0 && px < innerWidth && py > rect("hud").bottom && py < innerHeight };
      }, touch);
      await p.screenshot({ path: `test-results/lava-${w}x${h}.png` }).catch(() => {});
      const ok = titleOk && !r.bad.length && !r.ov.length && r.btn >= 44 && r.hero;
      all = all && ok;
      out.push(`${w}x${h}:${ok ? "OK" : "X"}(${touch ? `버튼 ${Math.round(r.btn)}px` : "PC"}${r.bad.length ? " 밖:" + r.bad : ""}${r.ov.length ? " 겹침:" + r.ov : ""}${r.hero ? "" : " 주인공 안 보임"}${titleOk ? "" : " 타이틀 버튼"})`);
      await p.ctx.close();
    }
    check("L18", "여러 화면 크기: 타이틀 버튼 · HUD · 터치 버튼(44px 이상 · 안 겹침) · 주인공 보임", all, out.join(" "));
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

  /* ---------- L21: 홈 · 다른 게임 ---------- */
  if (want("L21")) {
    const h = await openPage(browser, { errors });
    await h.goto(BASE + "/");
    await sleep(1500);
    const home = await G(h, () => {
      const a = document.querySelector('a[href="/games/lava-surfers/"]');
      const img = a && a.querySelector("img");
      return { card: !!a, shelf: a ? (a.closest("section") || {}).id : "", thumb: img ? img.getAttribute("src") : "", broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== "lazy").length };
    });
    const games = [];
    for (const g of ["sky-island", "dragon-statue", "sea-monster", "jetski-race"]) {
      const before = errors.length;
      await h.goto(`${BASE}/games/${g}/`);
      await sleep(2000);
      games.push(`${g}:${errors.length === before ? "OK" : "오류"}`);
    }
    check("L21", "홈 아케이드 칸에 카드 · 썸네일 · 기존 게임 정상", home.card && home.shelf === "cat-arcade" && home.broken === 0 && games.every((x) => x.endsWith("OK")), `카드 ${home.card} (${home.shelf}) · 썸네일 ${home.thumb || "없음"} · ${games.join(", ")}`);
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
