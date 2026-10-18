/**
 * 하늘섬 대탈출 — 자동 점검 (실제 브라우저 · 실제 게임 코드 · 실제 키 · 터치 입력)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-sky-island.js
 *
 * - /api/* 는 가짜 응답 → 실제 랭킹 · 인기 집계에 아무것도 쓰지 않는다.
 * - 저장 데이터는 테스트마다 새 브라우저 칸에서 (내 기기 기록과 상관없음).
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
const { installBot } = require("./sky-autopilot.js");

const BASE = process.env.SK_BASE || "http://localhost:3456";
const GAME = `${BASE}/games/sky-island/`;
const KEY = "today-sky-island-v1";
const ONLY = (process.env.SK_ONLY || "").split(",").filter(Boolean);
const want = (id) => !ONLY.length || ONLY.includes(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}
const f1 = (v) => (typeof v === "number" ? v.toFixed(2) : String(v));

async function launch() {
  const args = process.env.SK_GPU === "0" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
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
      if (sessionStorage.getItem("__sk_init")) return;
      sessionStorage.setItem("__sk_init", "1");
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
  await p.goto(GAME);
  for (let i = 0; i < 200; i++) {
    if (await G(p, () => !!(window.SkyIsland && window.SkyIsland.state === "title"))) break;
    await sleep(100);
  }
  await G(p, () => {
    const g = window.SkyIsland;
    const rec = (window.__rec = { y: -1e9, dashF: 0, anims: new Set(), states: [], frames: 0 });
    const loop = () => {
      requestAnimationFrame(loop);
      rec.frames++;
      const P = g.player;
      rec.y = Math.max(rec.y, P.pos.y);
      if (P.dashT > 0) rec.dashF++;
      rec.anims.add(g.hero.state);
      if (rec.states[rec.states.length - 1] !== g.state) rec.states.push(g.state);
    };
    loop();
    window.__sk = {
      s() {
        const P = g.player;
        const r = g.run;
        return {
          state: g.state,
          paused: g.paused,
          pos: [P.pos.x, P.pos.y, P.pos.z],
          vel: [P.vel.x, P.vel.y, P.vel.z],
          hs: Math.hypot(P.vel.x, P.vel.z),
          onGround: P.onGround,
          stun: P.stunT,
          hearts: r && r.hearts,
          orbs: r && r.orbs,
          score: r ? g.score() : 0,
          pts: r && { ...r.pts },
          time: r && r.time,
          combo: r && r.combo,
          falls: r && r.falls,
          cp: r && r.cp ? r.cp.idx : -1,
          anim: g.hero.state,
          screen: g.ui.current,
        };
      },
      tp(x, y, z, yaw = Math.PI) {
        const P = g.player;
        P.spawn(new g.cam.position.constructor(x, y, z), yaw);
        g.camY = y;
        g.placeCamera(1, true);
      },
      reset() {
        rec.y = -1e9;
        rec.dashF = 0;
        rec.anims = new Set();
      },
      rec() {
        return { y: rec.y, dashF: rec.dashF, anims: [...rec.anims], states: rec.states.slice(), frames: rec.frames };
      },
    };
  });
}
const S = (p) => G(p, () => window.__sk.s());
async function until(p, pred, ms = 10000, label = "") {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await S(p);
    if (pred(s)) return s;
    await sleep(50);
  }
  throw new Error(`시간 초과: ${label} (상태 ${s && s.state})`);
}
async function start(p) {
  await p.click("#start-btn");
  return until(p, (s) => s.state === "play", 4000, "play");
}

(async () => {
  const browser = await launch();
  const errors = [];

  /* ---------- T1 · T2 · T3 · T4 · T5 · T7: 시작 · 이동 · 점프 · 대시 · 충돌 ---------- */
  if (want("T1")) {
    const p = await openPage(browser, { errors });
    const t0 = Date.now();
    await load(p);
    const loadMs = Date.now() - t0;
    const title = await G(p, () => ({
      loadingHidden: document.getElementById("loading").hidden || document.getElementById("loading").classList.contains("done"),
      titleShown: !document.getElementById("title").hidden,
      buttons: [...document.querySelectorAll("#title button")].map((b) => b.textContent.trim()),
    }));
    check("T1", "불러오기 → 타이틀 (메뉴는 실제로 되는 4가지만)", title.loadingHidden && title.titleShown && title.buttons.join("|") === "게임 시작|스테이지 선택|조작 방법|사운드 설정", `${(loadMs / 1000).toFixed(1)}초 · 버튼 ${title.buttons.join(", ")}`);
    const t1 = Date.now();
    const s0 = await start(p);
    check("T2", "게임 시작 → 짧은 연출 뒤 바로 조작", s0.state === "play" && Date.now() - t1 < 3000, `시작 버튼 → 조작 가능까지 ${((Date.now() - t1) / 1000).toFixed(1)}초`);
    // 이동 (가속 · 감속)
    const a = await S(p);
    await p.keyboard.down("KeyW");
    await sleep(60);
    const early = await S(p);
    await sleep(1000);
    const b = await S(p);
    await p.keyboard.up("KeyW");
    await sleep(500);
    const c = await S(p);
    const ran = a.pos[2] - b.pos[2];
    check("T3", "이동: 가속 · 최고 속도 · 감속", ran > 5 && early.hs < 6 && b.hs > 6.5 && c.hs < 0.2, `1초 ${f1(ran)}m · 처음 ${f1(early.hs)} → ${f1(b.hs)}m/s · 놓으면 ${f1(c.hs)}`);
    // 점프 (길게 · 짧게 · 착지 · 미리 누르기)
    await G(p, () => window.__sk.reset());
    const y0 = (await S(p)).pos[1];
    await p.keyboard.down("Space");
    await sleep(350);
    await p.keyboard.up("Space");
    await until(p, (s) => s.onGround, 3000, "착지");
    const longJ = (await G(p, () => window.__sk.rec())).y - y0;
    const anims = (await G(p, () => window.__sk.rec())).anims;
    await sleep(300);
    await G(p, () => window.__sk.reset());
    await p.keyboard.press("Space");
    await until(p, (s) => !s.onGround, 2000, "뜸");
    await until(p, (s) => s.onGround, 3000, "착지");
    const shortJ = (await G(p, () => window.__sk.rec())).y - y0;
    await sleep(300);
    // 미리 누르기: 떨어지는 중 착지 0.1초 전에 누르면 착지하자마자 다시 뛴다
    await p.keyboard.down("Space");
    await sleep(320);
    await p.keyboard.up("Space");
    // 땅에 닿기 약 0.07초 전 (미리 누르기 허용 0.15초 안)
    await until(p, (s) => s.vel[1] < -9.5, 3000, "내려오는 중");
    await p.keyboard.press("Space");
    let rejump = false;
    for (let i = 0; i < 40; i++) {
      const s = await S(p);
      // 착지하자마자 다시 위로 (짧게 눌러서 낮은 점프여도 됨)
      if (!s.onGround && s.vel[1] > 0.5 && s.pos[1] - y0 < 0.7) {
        rejump = true;
        break;
      }
      await sleep(15);
    }
    check("T4", "점프: 길게/짧게 높이 다름 · 착지 · 착지 직전 입력도 받음", longJ > 1.7 && shortJ > 0.4 && shortJ < longJ - 0.5 && anims.includes("jump") && anims.includes("land") && rejump, `길게 ${f1(longJ)}m · 짧게 ${f1(shortJ)}m · 동작 ${anims.join(",")} · 미리 누르기 ${rejump}`);
    await until(p, (s) => s.onGround, 3000, "착지");
    await sleep(400);
    // 대시 (쿨다운 · 공중 1번)
    await G(p, () => window.__sk.reset());
    await p.keyboard.press("ShiftLeft");
    let maxSp = 0;
    for (let i = 0; i < 8; i++) {
      maxSp = Math.max(maxSp, (await S(p)).hs);
      await sleep(20);
    }
    await sleep(150);
    await G(p, () => window.__sk.reset());
    await p.keyboard.press("ShiftLeft");
    await sleep(120);
    const blocked = (await G(p, () => window.__sk.rec())).dashF === 0;
    await sleep(800);
    await G(p, () => window.__sk.reset());
    await p.keyboard.press("ShiftLeft");
    await sleep(150);
    const again = (await G(p, () => window.__sk.rec())).dashF > 0;
    check("T5", "대시: 빠르게 휙 · 쿨다운 동안은 다시 안 됨 · 쿨다운 뒤 다시 됨", maxSp > 13 && blocked && again, `최고 ${f1(maxSp)}m/s · 0.3초 안 재사용 막힘 ${blocked} · 0.9초 뒤 다시 ${again}`);
    await sleep(600);
    // 통나무에 막힘 · 회전 기둥에 튕김
    await G(p, () => window.__sk.tp(0, 0, -19.5));
    await sleep(200);
    await p.keyboard.down("KeyW");
    await sleep(1200);
    await p.keyboard.up("KeyW");
    const logZ = (await S(p)).pos[2];
    await G(p, () => {
      const g = window.SkyIsland;
      const s = g.course.sweepers[0];
      window.__sk.tp(0, 10.2, s.z);
      s.ang = Math.PI * 0.85;
    });
    const k0 = (await S(p)).hearts;
    const knocked = await until(p, (s) => s.stun > 0 || s.anim === "hit", 4000, "튕김").then(() => true, () => false);
    check("T7", "충돌: 통나무는 막고 · 도는 나무 기둥 팔에 닿으면 튕겨 나감", logZ > -22.3 && knocked, `통나무 앞에서 멈춘 z ${f1(logZ)} (통나무 -22.6) · 튕김 ${knocked} · 하트 ${k0}`);
    await p.ctx.close();
  }

  /* ---------- T6: 화면 빠르기(30 · 60 · 144Hz)와 상관없이 같은 움직임 ---------- */
  if (want("T6")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    const r = await G(p, async () => {
      const g = window.SkyIsland;
      const { Player } = await import("/games/sky-island/js/player.js?v=1");
      const V3 = g.cam.position.constructor;
      const run = (dt) => {
        const P = new Player(g.hero, g.course);
        P.spawn(new V3(0, 0, 3), Math.PI);
        P.hero = { play() {}, update() {}, pos: new V3(), state: "idle", st: 0 };
        P.animate = () => {};
        let peak = 0;
        let t = 0;
        let first = true;
        while (t < 1.2) {
          const f = first ? { jump: true } : {};
          first = false;
          P.update(dt, { x: 0, z: -1, mag: 1 }, f, t < 0.3);
          peak = Math.max(peak, P.pos.y);
          t += dt;
        }
        return { z: P.pos.z, peak };
      };
      return { a: run(1 / 30), b: run(1 / 60), c: run(1 / 144) };
    });
    const dz = Math.max(Math.abs(r.a.z - r.c.z), Math.abs(r.b.z - r.c.z));
    const dy = Math.max(Math.abs(r.a.peak - r.c.peak), Math.abs(r.b.peak - r.c.peak));
    check("T6", "프레임 속도와 상관없는 움직임 (30 · 60 · 144Hz 비교)", dz < 0.15 && dy < 0.06, `1.2초 동안 이동 30Hz ${f1(r.a.z)} · 60Hz ${f1(r.b.z)} · 144Hz ${f1(r.c.z)} / 점프 최고 ${f1(r.a.peak)} · ${f1(r.b.peak)} · ${f1(r.c.peak)}`);
    await p.ctx.close();
  }

  /* ---------- T8 · T9 · T10 · T11: 체크포인트 · 낙하 · 구슬 · 점수 · 일시정지 · 재시작 ---------- */
  if (want("T8")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    // 구슬 3개 먹기 (첫 구간)
    for (let i = 0; i < 3; i++) {
      const o = await G(p, (i) => {
        const c = window.SkyIsland.course.orbs.filter((o) => !o.big && !o.taken)[0];
        return { x: c.p.x, y: c.p.y, z: c.p.z };
      }, i);
      await G(p, (o) => window.__sk.tp(o.x, o.y - 0.55, o.z), o);
      await sleep(150);
    }
    const sO = await S(p);
    const sumOk = await G(p, () => {
      const g = window.SkyIsland;
      const p = g.run.pts;
      return g.score() === p.dist + p.orbs + p.pass + p.chain + p.dash + p.time;
    });
    check("T9", "에너지 구슬 수집 · 점수 · 콤보", sO.orbs === 3 && sO.pts.orbs >= 30 && sO.combo >= 3 && sumOk, `구슬 ${sO.orbs} · 구슬 점수 ${sO.pts.orbs} · 콤보 ${sO.combo} · 총점 = 항목 합 ${sumOk}`);
    // 체크포인트 켜기 → 그 뒤 구슬 먹고 떨어짐 → 체크포인트로 · 구슬 되돌림
    await G(p, () => window.__sk.tp(0, 2, -67));
    await until(p, (s) => s.cp === 0, 3000, "체크포인트");
    const snapScore = (await S(p)).score;
    const after = await G(p, () => {
      const c = window.SkyIsland.course.orbs.find((o) => !o.big && !o.taken && o.p.z < -70);
      return { x: c.p.x, y: c.p.y, z: c.p.z, idx: c.idx };
    });
    await G(p, (o) => window.__sk.tp(o.x, o.y - 0.55, o.z), after);
    await sleep(150);
    const taken = await G(p, (i) => window.SkyIsland.course.orbs[i].taken, after.idx);
    const h0 = (await S(p)).hearts;
    await G(p, () => window.__sk.tp(25, 2, -80));
    const back = await until(p, (s) => s.state === "play" && s.falls === 1 && s.onGround, 6000, "다시 시작");
    const restored = await G(p, (i) => !window.SkyIsland.course.orbs[i].taken, after.idx);
    const dCp = Math.hypot(back.pos[0], back.pos[2] + 67);
    check("T8", "낙하 → 체크포인트에서 다시 (하트 -1 · 그 뒤 얻은 점수/구슬 되돌림)", taken && back.hearts === h0 - 1 && dCp < 1 && restored && back.score <= snapScore + 1, `체크포인트 뒤 구슬 먹음 ${taken} → 떨어짐 → 하트 ${h0}→${back.hearts} · 다시 선 곳 체크포인트에서 ${f1(dCp)}m · 구슬 다시 나타남 ${restored} · 점수 ${back.score} (체크포인트 때 ${snapScore})`);
    // 일시정지
    await p.keyboard.press("Escape");
    await sleep(200);
    const pa = await S(p);
    await p.keyboard.down("KeyW");
    await sleep(700);
    await p.keyboard.up("KeyW");
    const pb = await S(p);
    const pauseShown = await G(p, () => !document.getElementById("pause").hidden);
    await p.keyboard.press("Escape");
    await sleep(200);
    const pc = await S(p);
    await G(p, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hid = await S(p);
    await G(p, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    check("T10", "일시정지: Esc 로 멈춤 · 멈춘 동안 움직임/시간 정지 · 이어하기 · 탭 숨기면 자동 멈춤", pa.paused && pauseShown && pa.pos[2] === pb.pos[2] && pa.time === pb.time && !pc.paused && hid.paused, `멈춤 ${pa.paused} · 멈춘 동안 이동 ${f1(Math.abs(pa.pos[2] - pb.pos[2]))}m · 시간 그대로 ${pa.time === pb.time} · 이어하기 ${!pc.paused} · 탭 숨김 ${hid.paused}`);
    // 재시작 (루프가 겹치지 않음)
    const f0 = (await G(p, () => window.__sk.rec())).frames;
    await sleep(1000);
    const fps0 = (await G(p, () => window.__sk.rec())).frames - f0;
    let renders = 0;
    await G(p, () => {
      const g = window.SkyIsland;
      window.__renders = 0;
      const r = g.render.bind(g);
      g.render = () => {
        window.__renders++;
        r();
      };
    });
    await p.click("#pause-restart");
    const rs = await until(p, (s) => s.state === "play", 4000, "다시 시작");
    await G(p, () => (window.__renders = 0));
    await sleep(1000);
    renders = await G(p, () => window.__renders);
    check("T11", "처음부터 다시: 점수 · 하트 · 위치 초기화 · 게임 루프 하나만", rs.hearts === 3 && rs.score === 0 && rs.falls === 0 && rs.pos[2] > 4 && renders <= fps0 + 8, `하트 ${rs.hearts} · 점수 ${rs.score} · 위치 z ${f1(rs.pos[2])} · 1초 그리기 ${renders}번 (화면 ${fps0}fps)`);
    await p.ctx.close();
  }

  /* ---------- T12 · T13 · T14 · T15 · T25: 스테이지 1 클리어 · 기록 · 다음 스테이지 · 사이트로 ---------- */
  if (want("T12")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await G(p, installBot, true);
    let s;
    const t0 = Date.now();
    while (Date.now() - t0 < 200000) {
      s = await S(p);
      if (s.state === "clear" || s.state === "over") break;
      await sleep(500);
    }
    const shown = await until(p, (s) => s.screen === "result", 8000, "결과").then(() => true, () => false);
    const res = await G(p, () => ({
      rows: document.querySelectorAll("#res-rows li").length,
      score: Number(document.getElementById("res-score").textContent.replace(/\D/g, "")),
      game: Math.round(window.SkyIsland.score()),
      stars: document.querySelectorAll("#res-stars i:not(.off)").length,
      next: !document.getElementById("res-next").hidden,
      unlockText: document.getElementById("res-unlock").hidden ? "" : document.getElementById("res-unlock").textContent,
      rankInResult: !!document.querySelector("#result .rank-slot"),
      save: JSON.parse(localStorage.getItem("today-sky-island-v1")),
    }));
    check("T12", "스테이지 1 클리어: 비행선 착지 → 축하 연출 → 결과 (점수 항목 6가지 · 별 · 다음 스테이지 버튼)", s.state === "clear" && shown && res.rows === 6 && res.score === res.game && res.stars >= 1 && res.next, `${Math.round((Date.now() - t0) / 1000)}초에 탈출 · 떨어짐 ${s.falls} · 결과 점수 ${res.score} = 게임 점수 ${res.game} · 별 ${res.stars}개 · 다음 스테이지 버튼 ${res.next}`);
    const b1 = res.save.stages.best[1] || {};
    check("T13", "기록 저장 (이 기기): 스테이지별 최고 점수 · 시간 · 별 · 다음 스테이지 열림", b1.score === res.game && b1.time > 0 && b1.clears === 1 && b1.stars >= 1 && res.save.stages.unlocked === 2 && /바람 협곡/.test(res.unlockText), `1스테이지 최고 ${b1.score} · ${f1(b1.time)}초 · 별 ${b1.stars} · 열린 스테이지 ${res.save.stages.unlocked} · "${res.unlockText.trim()}"`);
    const posted = apiLog.filter((r) => /\/api\/scores/.test(r.url) && r.method === "POST").length;
    check("T14", "랭킹: 스테이지 결과에는 없고 엔딩(6스테이지 합)에서만 · 저절로 보내지 않음", !res.rankInResult && posted === 0, `결과 화면 랭킹 칸 ${res.rankInResult ? "있음(X)" : "없음"} · 저절로 보낸 점수 ${posted}건`);
    // 다음 스테이지 버튼 → 바람 협곡이 실제로 불러와짐
    const fog1 = await G(p, () => window.SkyIsland.scene.fog.color.getHexString());
    await p.click("#res-next");
    const s2 = await until(p, (s) => s.state === "play", 15000, "스테이지 2").catch(() => null);
    const st2 = await G(p, () => ({ hud: document.getElementById("hud-stage").textContent, id: window.SkyIsland.def.id, fog: window.SkyIsland.scene.fog.color.getHexString(), mechs: [...new Set(window.SkyIsland.course.mechs.map((m) => m.kind))] }));
    check("T25", "다음 스테이지: 결과 → 바람 협곡 불러오기 (다른 하늘 · 다른 장치)", !!s2 && st2.id === 2 && /바람 협곡/.test(st2.hud) && st2.fog !== fog1 && st2.mechs.includes("blade") && st2.mechs.includes("turn"), `HUD "${st2.hud}" · 안개 색 ${fog1} → ${st2.fog} · 장치 ${st2.mechs.join(",")}`);
    // 새로고침 뒤 타이틀에 진행 표시
    await load(p);
    const tb = await G(p, () => ({ best: document.getElementById("title-best").textContent, start: document.getElementById("start-btn").textContent }));
    await p.click("#start-btn");
    await until(p, (s) => s.state === "play", 15000, "play");
    const cont = await G(p, () => window.SkyIsland.def.id);
    await p.keyboard.press("Escape");
    await sleep(200);
    await Promise.all([p.waitForURL(BASE + "/", { timeout: 10000 }), p.click("#pause a.btn-sub")]);
    check("T15", "새로고침 뒤 진행 표시 · '이어서 하기'로 스테이지 2 · 사이트로 돌아가기", p.url() === BASE + "/" && /2까지 열림/.test(tb.best) && /이어서/.test(tb.start) && cont === 2, `타이틀 "${tb.best.trim()}" · 버튼 "${tb.start.trim()}" → 스테이지 ${cont} · 일시정지 → 사이트로 → ${p.url()}`);
    await p.ctx.close();
  }

  /* ---------- T16: 게임 오버 → 이어하기 ---------- */
  if (want("T16")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await G(p, () => window.__sk.tp(0, 2, -67));
    await until(p, (s) => s.cp === 0, 3000, "체크포인트");
    await G(p, () => {
      window.SkyIsland.run.hearts = 1;
      window.__sk.tp(25, 2, -80);
    });
    const over = await until(p, (s) => s.screen === "over", 6000, "게임 오버").then(() => true, () => false);
    await p.click("#over-cp");
    const cont = await until(p, (s) => s.state === "play" && s.hearts === 3, 4000, "이어하기").catch(() => null);
    check("T16", "하트 0 → 게임 오버 → 체크포인트에서 이어하기", over && cont && Math.hypot(cont.pos[0], cont.pos[2] + 67) < 1, `게임 오버 화면 ${over} · 이어하기 → 하트 ${cont && cont.hearts}`);
    await p.ctx.close();
  }

  /* ---------- T17: 장애물 · 장치 동작 ---------- */
  if (want("T17")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    const out = {};
    // 무너지는 돌다리
    await G(p, () => window.__sk.tp(0, 2, -102.5));
    await sleep(1300);
    out.crumble = await G(p, () => window.SkyIsland.course.crumbles[0].state);
    // 움직이는 발판에 실려 감
    await G(p, () => {
      const m = window.SkyIsland.course.movers[1];
      window.__sk.tp(m.solid.cx, 2, m.solid.cz);
    });
    await sleep(150);
    const m0 = (await S(p)).pos[0];
    await sleep(900);
    const m1 = await S(p);
    out.mover = Math.abs(m1.pos[0] - m0) > 0.5 && m1.onGround;
    // 점프대
    await G(p, () => window.__sk.tp(0, 2, -124.8));
    await sleep(400);
    out.pad = (await G(p, () => window.__sk.rec())).y;
    await G(p, () => window.__sk.reset());
    await until(p, (s) => s.onGround && s.pos[2] < -128, 4000, "점프대 착지").catch(() => null);
    const padLand = await S(p);
    out.padZ = padLand.pos[2];
    // 상승기류
    await G(p, () => window.__sk.tp(0, 4.2, -163.0));
    await sleep(200);
    await G(p, () => window.__sk.reset());
    await p.keyboard.press("Space");
    await sleep(1200);
    out.ventY = (await G(p, () => window.__sk.rec())).y;
    // 옆바람
    await G(p, () => window.__sk.tp(0, 9.4, -177));
    let wind = 0;
    for (let i = 0; i < 40; i++) {
      wind = Math.max(wind, await G(p, () => Math.abs(window.SkyIsland.player.wind.x)));
      await sleep(100);
    }
    out.wind = wind;
    // 바람 고리
    await G(p, () => window.__sk.tp(0, 9.4, -189));
    await sleep(200);
    await p.keyboard.down("KeyW");
    await sleep(170);
    await p.keyboard.down("Space");
    await sleep(400);
    await p.keyboard.up("Space");
    await p.keyboard.up("KeyW");
    await until(p, (s) => s.onGround, 4000, "고리 착지").catch(() => null);
    out.ringZ = (await S(p)).pos[2];
    // 구름 발판
    await G(p, () => {
      const c = window.SkyIsland.course.clouds[0];
      window.__sk.tp(c.home.x, c.home.y, c.home.z);
    });
    await sleep(1800);
    out.cloud = await G(p, () => window.SkyIsland.course.clouds[0].state);
    // 무너지는 섬
    await G(p, () => window.__sk.tp(0, 15, -273));
    await sleep(2600);
    out.tiles = await G(p, () => window.SkyIsland.course.tiles.filter((t) => t.state !== "idle").length);
    out.cine = (await G(p, () => window.__sk.rec())).states.includes("cine");
    const ok = out.crumble !== "idle" && out.mover && out.pad > 2 + 3 && out.padZ < -132 && out.ventY > 9.4 && out.wind > 2.5 && out.ringZ < -198 && out.cloud !== "idle" && out.tiles > 6 && out.cine;
    check("T17", "장치 동작: 무너지는 돌다리 · 움직이는 발판 · 점프대 · 상승기류 · 옆바람 · 바람 고리 · 구름 발판 · 무너지는 섬", ok, `돌다리 ${out.crumble} · 발판에 실려 감 ${out.mover} · 점프대 최고 ${f1(out.pad)}m→착지 z ${f1(out.padZ)} · 바람 기둥 최고 ${f1(out.ventY)}m · 옆바람 ${f1(out.wind)}m/s · 고리 착지 z ${f1(out.ringZ)} · 구름 ${out.cloud} · 무너진 칸 ${out.tiles} · 연출 ${out.cine}`);
    await p.ctx.close();
  }

  /* ---------- T18: 모바일 터치 (조이스틱 + 동시에 점프 · 대시) ---------- */
  if (want("T18")) {
    const p = await openPage(browser, { errors, width: 390, height: 844, touch: true });
    await load(p);
    await p.tap("#start-btn");
    await until(p, (s) => s.state === "play", 4000, "play");
    const cdp = await p.ctx.newCDPSession(p);
    const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
    const rect = (id) => G(p, (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
    }, id);
    const zone = await rect("joy-zone");
    const jx = zone.l + 90;
    const jy = zone.b - 150;
    const a = await S(p);
    await G(p, () => window.__sk.reset());
    await T("touchStart", [[jx, jy, 1]]);
    for (let i = 1; i <= 6; i++) {
      await T("touchMove", [[jx, jy - i * 12, 1]]);
      await sleep(16);
    }
    await sleep(500);
    const jb = await rect("btn-jump");
    await T("touchStart", [[jx, jy - 72, 1], [jb.x, jb.y, 2]]);
    await sleep(250);
    await T("touchEnd", [[jx, jy - 72, 1]]);
    await sleep(400);
    const b = await S(p);
    await T("touchEnd", []);
    const jumpY = (await G(p, () => window.__sk.rec())).y - a.pos[1];
    await sleep(500);
    const db = await rect("btn-dash");
    await G(p, () => window.__sk.reset());
    await T("touchStart", [[db.x, db.y, 3]]);
    await sleep(60);
    await T("touchEnd", []);
    await sleep(300);
    const dash = (await G(p, () => window.__sk.rec())).dashF;
    const moved = a.pos[2] - b.pos[2];
    check("T18", "모바일 터치: 조이스틱으로 달리며 동시에 점프 · 대시 버튼", moved > 3 && jumpY > 1 && dash > 0, `조이스틱 ${f1(moved)}m · 누른 채 점프 ${f1(jumpY)}m · 대시 ${dash > 0}`);
    await p.screenshot({ path: "test-results/sky-touch-390x844.png" }).catch(() => {});
    await p.ctx.close();
  }

  /* ---------- T19: 여러 화면 크기 ---------- */
  if (want("T19")) {
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
      await sleep(300);
      const r = await G(p, (touch) => {
        const rect = (id) => document.getElementById(id).getBoundingClientRect();
        const inView = (b) => b.width > 0 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        const over = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const hud = ["hearts", "hud-orbs", "hud-score", "pause-btn", "prog-wrap"];
        const bad = hud.filter((id) => !inView(rect(id)));
        const ov = [];
        let btn = 999;
        if (touch) {
          for (const id of ["btn-jump", "btn-dash"]) {
            const b = rect(id);
            if (!inView(b)) bad.push(id);
            btn = Math.min(btn, b.width, b.height);
            if (over(b, rect("hud"))) ov.push(id + "/HUD");
          }
          if (over(rect("btn-jump"), rect("btn-dash"))) ov.push("jump/dash");
        }
        const g = window.SkyIsland;
        const v = g.player.pos.clone().setY(g.player.pos.y + 0.6).project(g.cam);
        const px = ((v.x + 1) / 2) * innerWidth;
        const py = ((1 - v.y) / 2) * innerHeight;
        return { bad, ov, btn, hero: px > 0 && px < innerWidth && py > rect("hud").bottom && py < innerHeight };
      }, touch);
      await p.screenshot({ path: `test-results/sky-${w}x${h}.png` }).catch(() => {});
      const ok = titleOk && !r.bad.length && !r.ov.length && r.btn >= 44 && r.hero;
      all = all && ok;
      out.push(`${w}x${h}:${ok ? "OK" : "X"}(${touch ? `버튼 ${Math.round(r.btn)}px` : "PC"}${r.bad.length ? " 밖:" + r.bad : ""}${r.ov.length ? " 겹침:" + r.ov : ""}${r.hero ? "" : " 주인공 안 보임"}${titleOk ? "" : " 타이틀 버튼"})`);
      await p.ctx.close();
    }
    check("T19", "여러 화면 크기: 타이틀 버튼 · HUD · 터치 버튼(44px 이상 · 안 겹침) · 주인공 보임", all, out.join(" "));
  }

  /* ---------- T20: 성능 (자동 조종으로 코스 전체) ---------- */
  if (want("T20")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await start(p);
    await G(p, () => {
      const r = window.SkyIsland.renderer;
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
    const g0 = await G(p, () => window.SkyIsland.renderer.info.memory.geometries);
    await G(p, installBot, true);
    let s;
    const t0 = Date.now();
    while (Date.now() - t0 < 200000) {
      s = await S(p);
      if (s.state === "clear") break;
      await sleep(1000);
    }
    const perf = await G(p, () => {
      const P = window.__perf;
      return { fps: P.n / ((performance.now() - P.t0) / 1000), calls: P.calls, worst: P.worst };
    });
    // 다시 하기 → 메모리 늘지 않음
    await until(p, (s) => s.screen === "result", 8000, "결과").catch(() => null);
    await p.click("#res-again");
    await until(p, (s) => s.state === "play", 4000, "다시");
    await sleep(800);
    const g1 = await G(p, () => window.SkyIsland.renderer.info.memory.geometries);
    check("T20", "성능: 코스 전체 평균 프레임 · 그리기 호출 · 다시 해도 메모리 그대로", perf.fps > 50 && perf.calls < 500 && g1 - g0 <= 6, `평균 ${Math.round(perf.fps)}fps · 가장 긴 프레임 ${Math.round(perf.worst)}ms · 그리기 호출 최대 ${perf.calls} · geometry ${g0}→${g1}`);
    await p.ctx.close();
  }

  /* ---------- T24: 스테이지 선택 (잠김 · 열림 · 바로 시작) ---------- */
  if (want("T24")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await p.click("#stages-btn");
    await sleep(300);
    const g0 = await G(p, () => ({ tiles: document.querySelectorAll("#stage-grid .stage-tile").length, locked: document.querySelectorAll("#stage-grid .stage-tile.locked").length, boss: document.querySelectorAll("#stage-grid .stage-tile .boss").length }));
    // 잠긴 칸 (aria-disabled) 을 사람이 누르듯 강제로 눌러 본다
    await p.click('#stage-grid [data-stage="2"]', { force: true });
    await sleep(600);
    const still = await S(p);
    const toast = await G(p, () => document.getElementById("toast") ? document.getElementById("toast").textContent : "");
    const p2 = await openPage(browser, { errors, save: { v: 2, stages: { unlocked: 3, best: { 1: { score: 3000, time: 150, orbs: 40, stars: 2, clears: 1 }, 2: { score: 2800, time: 140, orbs: 30, stars: 1, clears: 1 } } }, ending: { count: 0, bestTotal: 0, bestTime: 0 }, settings: { musicVol: 0.75, sfxVol: 0.9, quality: "auto" } } });
    await load(p2);
    await p2.click("#stages-btn");
    await sleep(300);
    const g1 = await G(p2, () => ({ locked: document.querySelectorAll("#stage-grid .stage-tile.locked").length, sum: document.getElementById("stages-sum").textContent, rec: [...document.querySelectorAll("#stage-grid .rec")].map((e) => e.textContent).slice(0, 2) }));
    await p2.click('#stage-grid [data-stage="2"]');
    const s3 = await until(p2, (s) => s.state === "play", 15000, "스테이지 3").catch(() => null);
    const h3 = await G(p2, () => ({ hud: document.getElementById("hud-stage").textContent, mechs: [...new Set(window.SkyIsland.course.mechs.map((m) => m.kind))] }));
    check("T24", "스테이지 선택: 6칸 · 안 열린 칸은 눌러도 시작 안 함 · 열린 칸은 바로 시작 · 별/최고 기록 표시", g0.tiles === 6 && g0.locked === 5 && g0.boss === 1 && still.state === "title" && g1.locked === 3 && /별 3/.test(g1.sum) && /3,000/.test(g1.rec[0]) && !!s3 && /공중 항구/.test(h3.hud) && h3.mechs.includes("cannon"), `처음: 6칸 중 잠김 ${g0.locked} · 잠긴 칸 누름 → ${still.state} ("${toast.trim()}") / 3까지 열림: 잠김 ${g1.locked} · "${g1.sum.trim()}" · "${g1.rec[0]}" → 3번 시작 "${h3.hud}" (장치 ${h3.mechs.join(",")})`);
    await p.ctx.close();
    await p2.ctx.close();
  }

  /* ---------- T26: 스테이지 2~5 끝까지 (자동 조종 · 실제 물리) + 장치 · 성능 ---------- */
  const ALL = { v: 2, plays: 1, stages: { unlocked: 6, best: {} }, ending: { count: 0, bestTotal: 0, bestTime: 0 }, settings: { musicVol: 0.75, sfxVol: 0.9, quality: "auto" } };
  if (want("T26")) {
    const p = await openPage(browser, { errors, save: ALL });
    await load(p);
    await G(p, installBot, true);
    const expect = { 2: ["blade", "wind", "drop", "turn"], 3: ["belt", "cannon", "swing", "draw", "ship"], 4: ["phase", "drop", "beam"], 5: ["bolt", "turn", "spike", "wind", "swing"] };
    const out = [];
    let ok = true;
    for (let id = 2; id <= 5; id++) {
      await G(p, (i) => window.SkyIsland.startStage(i), id - 1);
      await until(p, (s) => s.state === "play", 20000, "시작");
      const info = await G(p, () => {
        const g = window.SkyIsland;
        const r = g.renderer;
        window.__perf = { n: 0, t0: performance.now(), calls: 0 };
        const f = () => {
          if (window.__perfStop) return;
          requestAnimationFrame(f);
          window.__perf.n++;
          window.__perf.calls = Math.max(window.__perf.calls, r.info.render.calls);
        };
        window.__perfStop = false;
        f();
        return { id: g.def.id, kinds: [...new Set(g.course.mechs.map((m) => m.kind))], theme: g.def.theme };
      });
      const t0 = Date.now();
      let s;
      while (Date.now() - t0 < 240000) {
        s = await S(p);
        if (s.state === "clear") break;
        await sleep(500);
      }
      const perf = await G(p, () => {
        window.__perfStop = true;
        const P = window.__perf;
        return { fps: P.n / ((performance.now() - P.t0) / 1000), calls: P.calls };
      });
      await until(p, (s) => s.screen === "result", 8000, "결과").catch(() => null);
      const sv = await G(p, (id) => JSON.parse(localStorage.getItem("today-sky-island-v1")).stages.best[id], id);
      const need = expect[id].every((k) => info.kinds.includes(k));
      const good = s.state === "clear" && sv && sv.clears === 1 && need && perf.fps > 50 && perf.calls < 500;
      ok = ok && good;
      out.push(`${id}:${good ? "OK" : "X"}(${Math.round((Date.now() - t0) / 1000)}초 · 떨어짐 ${s.falls} · ${info.theme} · 장치 ${info.kinds.join("/")} · ${Math.round(perf.fps)}fps · 호출 ${perf.calls})`);
    }
    check("T26", "스테이지 2~5: 자동 조종으로 끝까지 클리어 · 스테이지마다 고유 장치 · 60fps 근처 · 그리기 호출 500 미만", ok, out.join(" "));
    await p.ctx.close();
  }

  /* ---------- T27: 스테이지 6 최종 보스 → 엔딩 ---------- */
  if (want("T27")) {
    const p = await openPage(browser, { errors, save: ALL });
    await load(p);
    await G(p, () => window.SkyIsland.startStage(5));
    await until(p, (s) => s.state === "play", 20000, "시작");
    await G(p, () => {
      const g = window.SkyIsland;
      window.__boss = { states: [], hp: [], cine: [], gate: null, coll: false };
      const f = () => {
        requestAnimationFrame(f);
        const B = g.course.boss;
        const R = window.__boss;
        if (R.states[R.states.length - 1] !== B.state) R.states.push(B.state);
        if (R.hp[R.hp.length - 1] !== B.hp) R.hp.push(B.hp);
        if (g.state === "cine" && R.cine[R.cine.length - 1] !== g.cineKind) R.cine.push(g.cineKind);
        if (B.gate && B.gate.open) R.gate = R.gate || performance.now();
        if (g.course.collapse && g.course.collapse.on) R.coll = true;
      };
      f();
    });
    await G(p, installBot, true);
    const t0 = Date.now();
    let s;
    while (Date.now() - t0 < 300000) {
      s = await S(p);
      if (s.state === "clear") break;
      await sleep(500);
    }
    const shown = await until(p, (s) => s.screen === "ending", 10000, "엔딩").then(() => true, () => false);
    const R = await G(p, () => ({ ...window.__boss, endRank: document.getElementById("end-rank").children.length, total: document.getElementById("end-total").textContent, save: JSON.parse(localStorage.getItem("today-sky-island-v1")).ending }));
    const need = ["chase", "intro", "tired", "hit", "enrage", "dying"];
    const seen = need.filter((k) => R.states.includes(k));
    const posted = apiLog.filter((r) => /\/api\/scores/.test(r.url) && r.method === "POST").length;
    check("T27", "최종 보스: 추격 → 등장 연출 → 약점 공격으로 체력 6→0 · 3단계 · 쓰러짐 연출 → 성문 열림 → 무너지는 성 탈출 → 엔딩 · 랭킹 칸", s.state === "clear" && seen.length === need.length && R.hp[R.hp.length - 1] === 0 && R.cine.includes("boss") && R.cine.includes("bossDown") && R.cine.includes("collapse") && !!R.gate && R.coll && shown && R.endRank > 0 && R.save.count === 1 && posted === 0, `${Math.round((Date.now() - t0) / 1000)}초 · 보스 상태 ${seen.join("→")} · 체력 ${R.hp.join(">")} · 연출 ${R.cine.join(",")} · 성문 ${!!R.gate} · 무너짐 ${R.coll} · 엔딩 ${shown} (합계 ${R.total}) · 랭킹 칸 ${R.endRank > 0} · 저절로 보낸 점수 ${posted}`);
    await p.ctx.close();
  }

  /* ---------- T28: 보스가 주인공을 보고 움직임 · 보스전에서 지면 그 단계부터 다시 ---------- */
  if (want("T28")) {
    const p = await openPage(browser, { errors, save: ALL });
    await load(p);
    await G(p, () => window.SkyIsland.startStage(5));
    await until(p, (s) => s.state === "play", 20000, "시작");
    await G(p, () => window.SkyIsland.warpTo(1));
    await sleep(400);
    await G(p, () => window.__sk.tp(0, 0.8, -165));
    await until(p, (s) => s.state === "play", 3000, "play");
    await G(p, () => {
      const B = window.SkyIsland.course.boss;
      return B.state;
    });
    // 등장 연출이 끝나고 싸움 시작까지
    for (let i = 0; i < 80; i++) {
      if (await G(p, () => window.SkyIsland.course.boss.fighting && window.SkyIsland.state === "play")) break;
      await sleep(100);
    }
    // 주인공을 왼쪽 · 오른쪽으로 옮기면 용이 반대쪽으로 자리를 옮기고 머리가 주인공을 본다
    const track = [];
    for (const x of [-7, 7]) {
      await G(p, (x) => {
        const B = window.SkyIsland.course.boss;
        B.go("idle");
        B.st = -3;
        window.__sk.tp(x, 0.8, -170);
      }, x);
      await sleep(2200);
      track.push(
        await G(p, () => {
          const g = window.SkyIsland;
          const B = g.course.boss;
          const hd = B.head.getWorldDirection(new g.cam.position.constructor());
          const to = g.player.pos.clone().sub(B.head.position).normalize();
          return { phi: B.phi, ang: (Math.acos(Math.max(-1, Math.min(1, hd.dot(to)))) * 180) / Math.PI };
        })
      );
    }
    // 주인공이 왼쪽(x<0)이면 용은 오른쪽(phi<π)으로, 오른쪽이면 왼쪽(phi>π)으로
    const reacts = track[0].phi < Math.PI - 0.2 && track[1].phi > Math.PI + 0.2 && track[0].ang < 40 && track[1].ang < 40;
    // 2단계(체력 4)에서 하트를 다 잃음 → 게임 오버 → '보스전 다시 도전' → 체력 4 그대로
    await G(p, () => {
      const g = window.SkyIsland;
      const B = g.course.boss;
      B.hp = 4;
      B.phaseHp = 4;
      g.ui.bossBar(B.barInfo());
      g.run.hearts = 1;
      window.__sk.tp(0, 0.8, -150 + 30);
      g.player.pos.set(30, 0.8, -174);
    });
    const over = await until(p, (s) => s.screen === "over", 8000, "게임 오버").then(() => true, () => false);
    const btn = await G(p, () => document.getElementById("over-cp").textContent);
    await p.click("#over-cp");
    await until(p, (s) => s.state === "play" && s.hearts === 3, 6000, "다시").catch(() => null);
    await sleep(600);
    const after = await G(p, () => {
      const B = window.SkyIsland.course.boss;
      return { hp: B.hp, fighting: B.fighting, bar: !document.getElementById("boss-bar").hidden, pips: document.querySelectorAll("#boss-hp i:not(.off)").length };
    });
    check("T28", "보스가 주인공을 보고 움직임(자리 · 머리 방향) · 보스전에서 지면 '보스전 다시 도전' → 그 단계 체력부터", reacts && over && /보스전/.test(btn) && after.hp === 4 && after.fighting && after.bar && after.pips === 4, `왼쪽에 서면 용 각도 ${f1(track[0].phi)}·머리 ${Math.round(track[0].ang)}° / 오른쪽 ${f1(track[1].phi)}·${Math.round(track[1].ang)}° · 게임 오버 ${over} · 버튼 "${btn}" → 체력 ${after.hp} · 막대 ${after.pips}칸`);
    await p.ctx.close();
  }

  /* ---------- T21: 홈 · 다른 게임 ---------- */
  if (want("T21")) {
    const h = await openPage(browser, { errors });
    await h.goto(BASE + "/");
    await sleep(1500);
    const home = await G(h, () => {
      const a = document.querySelector('a[href="/games/sky-island/"]');
      return { card: !!a, shelf: a ? a.closest("section").id : "", broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== "lazy").length };
    });
    const games = [];
    for (const g of ["dragon-statue", "sea-monster", "jetski-race", "ocean-blaster"]) {
      const before = errors.length;
      await h.goto(`${BASE}/games/${g}/`);
      await sleep(2000);
      games.push(`${g}:${errors.length === before ? "OK" : "오류"}`);
    }
    check("T21", "홈 아케이드 칸에 카드 · 기존 게임 정상", home.card && home.shelf === "cat-arcade" && home.broken === 0 && games.every((x) => x.endsWith("OK")), `카드 ${home.card} (${home.shelf}) · ${games.join(", ")}`);
    await h.ctx.close();
  }

  const leaked = apiLog.filter((r) => /data:image|base64|today-sky-island/.test(r.body));
  check("T22", "/api 로 보내는 것에 사진 · 저장 데이터 없음", leaked.length === 0, `/api 요청 ${apiLog.length}건 (${[...new Set(apiLog.map((r) => r.method + " " + new URL(r.url).pathname))].join(", ") || "없음"})`);
  check("T23", "콘솔 오류 · 리소스 로딩 오류 없음", errors.length === 0, errors.length ? errors.slice(0, 6) : "없음 (/api 는 가짜 응답)");

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e.message);
  process.exit(1);
});
