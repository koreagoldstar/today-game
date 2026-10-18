/**
 * 드래곤 석상 대작전 — 3D 모험 자동 점검 (실제 브라우저 · 실제 게임 코드 · 실제 키 · 터치 입력)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-dragon-adventure.js
 *      DS_FULL=1 을 붙이면 6개 지역을 자동 조종으로 처음부터 보스까지 (지역마다 1~4분)
 *
 * - /api/* 는 가짜 응답 → 실제 랭킹 · 인기 집계에 아무것도 쓰지 않는다.
 * - 저장 데이터는 테스트마다 새 브라우저 칸에 따로 넣는다 (내 기기 기록과 상관없음).
 * - 결과: 항목마다 PASS / FAIL 과 근거 숫자. 하나라도 FAIL 이면 종료 코드 1.
 */
"use strict";

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.error("playwright 가 필요해요: npm i -D playwright (또는 npx playwright install chromium)");
  process.exit(2);
}
const { installBot } = require("./dragon-autopilot.js");

const BASE = process.env.DS_BASE || "http://localhost:3456";
const GAME = `${BASE}/games/dragon-statue/`;
const SAVE_KEY = "today-dragon-statue-v1";
const FULL = process.env.DS_FULL === "1";
// DS_ONLY=A9,A14 처럼 일부만 (빈 값이면 전부)
const ONLY = (process.env.DS_ONLY || "").split(",").map((x) => x.trim()).filter(Boolean);
const want = (...ids) => !ONLY.length || ids.some((id) => ONLY.includes(id));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}] ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
}
const f1 = (v) => (typeof v === "number" ? v.toFixed(1) : String(v));

async function launch() {
  const args = process.env.DS_GPU === "0" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
  try {
    return await chromium.launch({ channel: "chrome", args });
  } catch (_) {
    return await chromium.launch({ args });
  }
}

/** 모험 저장 데이터 (없는 칸은 게임이 기본값으로 채운다) */
const ADV = (adv = {}, extra = {}) => ({ v: 1, tutorial: true, ...extra, adv: { unlocked: 1, regions: {}, eggs: {}, badges: {}, totalCrystals: 0, tutorial: true, puzzleSeen: true, ...adv } });

const apiLog = [];
async function openPage(browser, { width = 1180, height = 820, touch = false, save = ADV(), errors = [] } = {}) {
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
      if (sessionStorage.getItem("__ds_init")) return;
      sessionStorage.setItem("__ds_init", "1");
      if (save === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(save));
    },
    [SAVE_KEY, save]
  );
  p.ctx = ctx;
  p.touch = touch;
  return p;
}
const G = (p, fn, arg) => p.evaluate(fn, arg);

/** 페이지 열기 + 점검용 도우미 (상태 읽기 · 순간이동 · 기록) */
async function load(p) {
  await p.goto(GAME);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    if (await G(p, () => !!(window.DragonStatue && window.DragonStatue.mode === "title"))) break;
    await sleep(100);
  }
  await G(p, () => {
    const g = window.DragonStatue;
    const rec = (window.__rec = { y: -1e9, dash: 0, atk: 0, states: [], anims: new Set(), enemy: new Set(), boss: [] });
    const loop = () => {
      requestAnimationFrame(loop);
      const A = g.adv;
      if (rec.states[rec.states.length - 1] !== A.state) rec.states.push(A.state);
      const P = A.player;
      if (!P) return;
      rec.y = Math.max(rec.y, P.pos.y);
      if (P.dashT > 0) rec.dash++;
      if (P.char.atkT >= 0 && P.char.atkT < 0.34) rec.atk++;
      rec.anims.add(P.char.state);
      for (const e of A.enemies) rec.enemy.add(e.state);
      if (A.boss && rec.boss[rec.boss.length - 1] !== A.boss.state) rec.boss.push(A.boss.state);
    };
    loop();
    window.__ds = {
      s() {
        const A = g.adv;
        const P = A.player;
        const rs = A.rs || {};
        return {
          state: A.state,
          mode: g.mode,
          phase: g.phase,
          paused: g.paused,
          hearts: A.hearts,
          gems: rs.crystals,
          falls: rs.falls,
          hits: rs.hits,
          enemies: rs.enemies,
          combo: rs.combo,
          time: rs.time,
          pos: P ? [P.pos.x, P.pos.y, P.pos.z] : null,
          hs: P ? Math.hypot(P.vel.x, P.vel.z) : 0,
          onGround: P ? P.onGround : null,
          anim: P ? P.char.state : g.hero.state,
          inv: P ? P.invulnerable : false,
          boss: A.boss ? { hp: A.boss.hp, max: A.boss.maxHp, st: A.boss.state, weak: A.boss.weakOpen } : null,
          result: !document.getElementById("adv-result").hidden,
          region: A.run ? A.run.idx : -1,
        };
      },
      /** 바닥 위로 순간이동 (yaw 방향을 보게) */
      tp(x, z, yaw, dy = 0) {
        const A = g.adv;
        const P = A.player;
        const gr = A.level.ground(x, z, 0.3, 999);
        P.spawn(new P.pos.constructor(x, (gr ? gr.h : P.pos.y) + dy, z), yaw == null ? P.yaw : yaw);
        A.camDir.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
        A.placeCamera(1, true);
      },
      /** (x,z) 에서 d 만큼 떨어져 그쪽을 보게 */
      near(x, z, d, fromX, fromZ) {
        const dx = fromX - x;
        const dz = fromZ - z;
        const l = Math.hypot(dx, dz) || 1;
        const px = x + (dx / l) * d;
        const pz = z + (dz / l) * d;
        this.tp(px, pz, Math.atan2(x - px, z - pz));
      },
      god() {
        g.adv.loseHeart = function () {
          this.g.ui.advSet({ hearts: this.hearts });
        };
      },
      reset() {
        rec.y = -1e9;
        rec.dash = rec.atk = 0;
        rec.anims = new Set();
        rec.enemy = new Set();
        rec.boss = [];
      },
      rec() {
        return { y: rec.y, dash: rec.dash, atk: rec.atk, states: rec.states.slice(), anims: [...rec.anims], enemy: [...rec.enemy], boss: rec.boss.slice() };
      },
    };
  });
}
const S = (p) => G(p, () => window.__ds.s());
async function until(p, pred, ms = 15000, label = "") {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await S(p);
    if (pred(s)) return s;
    await sleep(60);
  }
  throw new Error(`시간 초과: ${label || pred.toString().slice(0, 70)} (마지막 상태 ${s && s.state})`);
}
/** 지역 바로 시작 (퍼즐 건너뜀) → PLAYING 까지 */
async function play(p, idx = 0) {
  await G(p, (i) => window.DragonStatue.adv.start(i, { retry: true }), idx);
  return until(p, (s) => s.state === "PLAYING", 12000, "PLAYING");
}
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

(async () => {
  const browser = await launch();
  const errors = [];

  /* ---------- A1. 실제 흐름: 타이틀 → 캐릭터 → 입구 석상 퍼즐(오답 하트 -1 · 정답 봉인 해제) → 지역 소개 → 플레이 ---------- */
  if (want("A1", "A2", "A3", "A4")) {
    const p = await openPage(browser, { errors, save: ADV({ puzzleSeen: false }) });
    await load(p);
    await p.click("#start-btn");
    await sleep(500);
    const selMode = await G(p, () => !document.getElementById("select").hidden && document.getElementById("select-mode").textContent);
    await p.click('[data-char="bear"]');
    await sleep(150);
    await p.click("#go-btn");
    await until(p, (s) => s.state === "STATUE_PUZZLE", 8000, "퍼즐");
    // 처음이면 규칙 카드 → 확인
    const t0 = Date.now();
    let sawRule = false;
    while (Date.now() - t0 < 8000) {
      const r = await G(p, () => ({ rule: !document.getElementById("rule").hidden, phase: window.DragonStatue.phase }));
      if (r.rule) {
        sawRule = true;
        await p.click("#rule-ok");
      }
      if (r.phase === "aim") break;
      await sleep(100);
    }
    const pt = (odd) =>
      G(
        p,
        (odd) => {
          const g = window.DragonStatue;
          const V3 = g.cam.position.constructor;
          const s = g.view.statues.find((s) => s.odd === odd && !s.gone && !s.wrong);
          const v = new V3(s.x, s.y + s.scale * 0.5, s.z).project(g.cam);
          return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, n: g.view.statues.length };
        },
        odd
      );
    const h0 = (await S(p)).hearts;
    const w = await pt(false);
    await p.mouse.click(w.x, w.y);
    await sleep(1300);
    const h1 = (await S(p)).hearts;
    await until(p, (s) => s.phase === "aim", 6000, "다시 조준");
    const r = await pt(true);
    await p.mouse.click(r.x, r.y);
    await until(p, (s) => s.state === "STAGE_INTRO", 10000, "지역 소개");
    const intro = await G(p, () => !document.getElementById("stage-intro").hidden && document.getElementById("si-h").textContent + " · " + [...document.querySelectorAll("#si-goals li")].map((l) => l.textContent).join(" / "));
    const s2 = await until(p, (s) => s.state === "PLAYING", 8000, "PLAYING");
    const rec = await G(p, () => window.__ds.rec());
    const hero = await G(p, () => window.DragonStatue.hero.def.id);
    const seq = rec.states.filter((x) => x !== "TITLE").join("→");
    check(
      "A1",
      "모험 흐름: 캐릭터 선택 → 입구 석상 퍼즐 → 봉인 해제 → 지역 소개 → 플레이",
      selMode && sawRule && r.n <= 6 && h1 === h0 - 1 && intro && s2.state === "PLAYING" && hero === "bear" && /CHARACTER_SELECT→STATUE_PUZZLE→STAGE_INTRO→PLAYING/.test(seq),
      `선택 화면 "${selMode}" · 퍼즐 석상 ${r.n}개 · 오답 하트 ${h0}→${h1} · 상태 ${seq} · 소개 "${intro}" · 주인공 ${hero}`
    );

    /* ---------- A2. PC 조작: 달리기(가속 · 감속) · 점프(길게/짧게) · 공중 조작 · 대시 · 방망이 (키 · 마우스) ---------- */
    const a = await S(p);
    await G(p, () => window.__ds.reset());
    await p.keyboard.down("KeyW");
    await sleep(40);
    const early = await S(p);
    await sleep(1100);
    const b = await S(p);
    await p.keyboard.up("KeyW");
    await sleep(600);
    const c = await S(p);
    const animsRun = (await G(p, () => window.__ds.rec())).anims;
    const ran = a.pos[2] - b.pos[2];
    // 점프: 길게 누름 vs 짧게 누름
    await G(p, () => window.__ds.reset());
    const y0 = c.pos[1];
    await p.keyboard.down("Space");
    await sleep(320);
    await p.keyboard.up("Space");
    await until(p, (s) => s.onGround, 3000, "착지");
    await sleep(250);
    const longJ = (await G(p, () => window.__ds.rec())).y - y0;
    const animsJump = (await G(p, () => window.__ds.rec())).anims;
    await G(p, () => window.__ds.reset());
    await p.keyboard.down("Space");
    await sleep(30);
    await p.keyboard.up("Space");
    await until(p, (s) => s.onGround, 3000, "착지");
    await sleep(250);
    const shortJ = (await G(p, () => window.__ds.rec())).y - y0;
    // 공중 조작: 뛰면서 오른쪽(D)
    const d0 = await S(p);
    await p.keyboard.down("Space");
    await sleep(60);
    await p.keyboard.down("KeyD");
    await sleep(380);
    await p.keyboard.up("KeyD");
    await p.keyboard.up("Space");
    await until(p, (s) => s.onGround, 3000, "착지");
    const d1 = await S(p);
    const air = d1.pos[0] - d0.pos[0];
    // 대시 (Shift) · 방망이 (J · 마우스)
    await sleep(300);
    await G(p, () => window.__ds.reset());
    await p.keyboard.down("KeyW");
    await sleep(200);
    let maxSp = 0;
    await p.keyboard.press("ShiftLeft");
    for (let i = 0; i < 6; i++) {
      maxSp = Math.max(maxSp, (await S(p)).hs);
      await sleep(25);
    }
    await p.keyboard.up("KeyW");
    const dashRec = (await G(p, () => window.__ds.rec())).dash;
    await sleep(500);
    await G(p, () => window.__ds.reset());
    await p.keyboard.press("KeyJ");
    await sleep(450);
    const atkKey = (await G(p, () => window.__ds.rec())).atk;
    await G(p, () => window.__ds.reset());
    await p.mouse.click(600, 420);
    await sleep(450);
    const atkMouse = (await G(p, () => window.__ds.rec())).atk;
    check(
      "A2",
      "PC 조작: 달리기 가속·감속 · 점프 길게/짧게 · 공중 조작 · 대시 · 방망이(J · 클릭)",
      ran > 5 && early.hs < 5.5 && b.hs > 6 && c.hs < 0.3 && ["startRun", "run", "idle"].every((x) => animsRun.includes(x)) && longJ > 1.4 && shortJ < longJ - 0.4 && air > 0.6 && maxSp > 11 && dashRec > 0 && atkKey > 0 && atkMouse > 0,
      `1.2초 ${f1(ran)}m (처음 0.04초 속도 ${f1(early.hs)} → ${f1(b.hs)}m/s, 놓으면 ${f1(c.hs)}) · 점프 길게 ${f1(longJ)}m / 짧게 ${f1(shortJ)}m · 공중 오른쪽 ${f1(air)}m · 대시 최고 ${f1(maxSp)}m/s · 방망이 키 ${atkKey > 0} 클릭 ${atkMouse > 0} · 달리기 동작 ${animsRun.join(",")} · 점프 동작 ${animsJump.join(",")}`
    );

    /* ---------- A3. 수정 모으기 · 콤보 · HUD ---------- */
    const gem = await G(p, () => {
      const A = window.DragonStatue.adv;
      const before = A.rs.crystals;
      // 땅 가까이 있는 것만 (점프해야 닿는 공중 수정 말고)
      const list = A.level.crystals.filter((c) => {
        if (c.taken || c.big) return false;
        const g = A.level.ground(c.p.x, c.p.z, 0.3, 999);
        return g && c.p.y - g.h < 1.1;
      }).slice(0, 4);
      return { before, list: list.map((c) => [c.p.x, c.p.z]) };
    });
    for (const [x, z] of gem.list) {
      await G(p, ([x, z]) => window.__ds.tp(x, z, Math.PI), [x, z]);
      await sleep(140);
    }
    await sleep(200);
    const g1 = await S(p);
    const hudGems = await G(p, () => document.getElementById("adv-gems").textContent);
    check("A3", "수정 수집 · 콤보 · HUD 숫자", g1.gems - gem.before === gem.list.length && g1.combo >= 3 && Number(hudGems) === g1.gems, `수정 ${gem.before}→${g1.gems} (4개 지나감) · 콤보 ${g1.combo} · HUD ${hudGems}`);

    /* ---------- A4. 방망이로 울타리 · 상자 부수기 ---------- */
    const br = await G(p, () => {
      const L = window.DragonStatue.adv.level;
      return L.breakables.filter((b) => !b.broken).slice(0, 2).map((b) => ({ x: b.p.x, z: b.p.z, kind: b.kind, wide: !!b.wide }));
    });
    const brk = [];
    for (const it of br) {
      const before = (await S(p)).gems;
      await G(p, (it) => window.__ds.near(it.x, it.z, it.kind === "fence" ? 1.25 : 1.2, it.x, it.z + 3), it);
      await sleep(120);
      await p.keyboard.press("KeyJ");
      await sleep(900);
      const ok = await G(p, (it) => window.DragonStatue.adv.level.breakables.find((b) => Math.abs(b.p.x - it.x) < 0.01 && Math.abs(b.p.z - it.z) < 0.01).broken, it);
      brk.push(`${it.kind}:${ok ? "부서짐" : "그대로"}(+${(await S(p)).gems - before})`);
    }
    check("A4", "방망이로 울타리 · 상자 부수기 (안에서 수정)", brk.length === 2 && brk.every((x) => x.includes("부서짐")), brk.join(" · "));
    await p.ctx.close();
  }

  /* ---------- A5 · A6 · A7: 적 · 낙하/체크포인트 · 일시정지 ---------- */
  if (want("A5", "A6", "A7")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await play(p, 0);
    // A5. 적: 순찰 → 쫓기 → 경고 → 공격 → 회복, 맞으면 하트 -1 + 무적 시간, 방망이로 물리치기
    const en = await G(p, () => {
      const e = window.DragonStatue.adv.enemies[0];
      return { kind: e.kind, x: e.pos.x, z: e.pos.z };
    });
    await G(p, () => window.__ds.reset());
    await G(p, (e) => window.__ds.near(e.x, e.z, 3.2, e.x, e.z + 3), en);
    const h0 = (await S(p)).hearts;
    const hit = await until(p, (s) => s.hearts < h0, 10000, "적에게 맞기");
    const inv0 = hit.inv;
    // 무적 시간 동안 적 바로 옆에 있어도 더 안 준다
    const ex = await G(p, () => {
      const e = window.DragonStatue.adv.enemies[0];
      return { x: e.pos.x, z: e.pos.z };
    });
    await G(p, (e) => window.__ds.near(e.x, e.z, 0.9, e.x, e.z + 3), ex);
    await sleep(900);
    const hInv = (await S(p)).hearts;
    const telegraph = (await G(p, () => window.__ds.rec())).enemy;
    // 방망이로 물리치기 (하트는 이제 안 줄게)
    await G(p, () => window.__ds.god());
    let defeated = false;
    for (let i = 0; i < 40 && !defeated; i++) {
      const e = await G(p, () => {
        const e = window.DragonStatue.adv.enemies[0];
        return { x: e.pos.x, z: e.pos.z, alive: e.alive, hittable: e.hittable };
      });
      if (!e.alive) {
        defeated = true;
        break;
      }
      await G(p, (e) => window.__ds.near(e.x, e.z, 1.1, e.x, e.z + 3), e);
      await p.keyboard.press("KeyJ");
      await sleep(380);
    }
    const sE = await S(p);
    check(
      "A5",
      "적: 순찰·쫓기·경고 표시·공격·회복 → 맞으면 하트 -1 + 무적 → 방망이로 물리침",
      hit.hearts === h0 - 1 && inv0 && hInv === hit.hearts && ["patrol", "windup", "attack"].every((x) => telegraph.includes(x)) && defeated && sE.enemies >= 1,
      `${en.kind}: 상태 ${telegraph.join(",")} · 하트 ${h0}→${hit.hearts} (무적 ${inv0}, 옆에 0.9초 더 있어도 ${hInv}) · 물리침 ${defeated} (처치 ${sE.enemies})`
    );

    // A6. 낙하 → 체크포인트에서 다시 (하트 -1)
    await G(p, () => {
      const A = window.DragonStatue.adv;
      delete A.loseHeart; // 하트가 다시 줄게 (god 해제)
      A.hearts = 3;
      A.g.ui.advSet({ hearts: 3 });
    });
    const cp = await G(p, () => {
      const c = window.DragonStatue.adv.level.checkpoints[0];
      return { x: c.p.x, y: c.p.y, z: c.p.z, yaw: c.yaw };
    });
    await G(p, (c) => window.__ds.tp(c.x, c.z, c.yaw), cp);
    await sleep(500);
    const cpOn = await G(p, () => !!window.DragonStatue.adv.rs.cp);
    await until(p, (s) => s.state === "PLAYING", 3000, "체크포인트 지나 PLAYING");
    const f0 = await S(p);
    await G(p, (c) => {
      const P = window.DragonStatue.adv.player;
      P.spawn(new P.pos.constructor(c.x + 30, c.y + 0.5, c.z), P.yaw);
    }, cp);
    const fCP = await until(p, (s) => s.state === "CHECKPOINT" || s.falls > f0.falls, 6000, "떨어짐");
    const fBack = await until(p, (s) => s.state === "PLAYING", 4000, "다시 PLAYING");
    check(
      "A6",
      "낙하 → 체크포인트에서 다시 시작 (하트 -1 · 떨어진 횟수 +1)",
      cpOn && fBack.hearts === f0.hearts - 1 && fBack.falls === f0.falls + 1 && dist2(fBack.pos, [cp.x, 0, cp.z]) < 1.5 && fCP.state === "CHECKPOINT",
      `체크포인트 켜짐 ${cpOn} · 하트 ${f0.hearts}→${fBack.hearts} · 떨어짐 ${f0.falls}→${fBack.falls} · 다시 선 곳 체크포인트에서 ${f1(dist2(fBack.pos, [cp.x, 0, cp.z]))}m`
    );

    // A7. 일시정지 (Esc) = PAUSED 상태 · 멈춘 동안 입력/시간 멈춤 · 이어하기 · 탭 숨김 자동 멈춤 · 그만하기
    await p.keyboard.press("Escape");
    await sleep(200);
    const pa = await S(p);
    const overlay = await G(p, () => !document.getElementById("pause").hidden);
    await p.keyboard.down("KeyW");
    await sleep(800);
    await p.keyboard.up("KeyW");
    const pb = await S(p);
    await p.keyboard.press("Escape");
    await sleep(200);
    const pc = await S(p);
    await p.keyboard.down("KeyW");
    await sleep(500);
    await p.keyboard.up("KeyW");
    const pd = await S(p);
    await G(p, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hid = await S(p);
    await G(p, () => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await p.click("#pause-resume");
    await sleep(200);
    const pe = await S(p);
    await p.click("#adv-pause");
    await sleep(200);
    await p.click("#pause-quit");
    await sleep(500);
    const pq = await S(p);
    check(
      "A7",
      "일시정지: Esc → PAUSED · 멈춘 동안 움직임/시간 정지 · 이어하기 · 탭 숨김 자동 멈춤 · 그만하기",
      pa.state === "PAUSED" && pa.paused && overlay && dist2(pa.pos, pb.pos) < 0.01 && pa.time === pb.time && pc.state === "PLAYING" && dist2(pc.pos, pd.pos) > 1 && hid.state === "PAUSED" && pe.state === "PLAYING" && pq.mode === "title" && pq.state === "TITLE",
      `멈춤 ${pa.state}/${pa.paused} · 멈춤 중 W 0.8초 이동 ${dist2(pa.pos, pb.pos).toFixed(3)}m · 시간 그대로 ${pa.time === pb.time} · 다시 ${pc.state} 후 이동 ${f1(dist2(pc.pos, pd.pos))}m · 탭 숨김→${hid.state} · 이어하기→${pe.state} · 그만하기→${pq.mode}/${pq.state}`
    );
    await p.ctx.close();
  }

  /* ---------- A8. 하트 0 → 게임 오버 → 결과 화면 → 다시 도전 ---------- */
  if (want("A8")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await play(p, 0);
    await G(p, () => {
      const A = window.DragonStatue.adv;
      A.hearts = 1;
      A.g.ui.advSet({ hearts: 1 });
      const P = A.player;
      P.spawn(new P.pos.constructor(P.pos.x + 30, P.pos.y + 0.5, P.pos.z), P.yaw);
    });
    const over = await until(p, (s) => s.state === "GAME_OVER", 6000, "GAME_OVER");
    const res = await until(p, (s) => s.result, 6000, "결과 화면");
    const txt = await G(p, () => ({ k: document.getElementById("ar-k").textContent, main: document.getElementById("ar-main").textContent.trim(), rank: document.getElementById("ar-rank").children.length, anim: window.DragonStatue.adv.player.char.state }));
    await p.click("#ar-main");
    const again = await until(p, (s) => s.state === "PLAYING", 8000, "다시 도전 → PLAYING");
    check(
      "A8",
      "하트 0 → 게임 오버 → 결과 화면(랭킹 입력) → 다시 도전",
      over.hearts === 0 && res.result && txt.k === "GAME OVER" && txt.anim === "defeat" && again.hearts === 3 && again.falls === 0,
      `"${txt.k}" · 주인공 ${txt.anim} · 버튼 "${txt.main}" · 랭킹 칸 ${txt.rank ? "있음" : "없음"} · 다시 도전 → ${again.state}, 하트 ${again.hearts}`
    );
    await p.ctx.close();
  }

  /* ---------- A9. 보스(고대 숲 드래곤): 등장 → 약점이 열릴 때만 데미지 → 처치 → 지역 완료 · 보상 · 저장 · 다음 지역 ---------- */
  if (want("A9", "A10", "A11")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await play(p, 0);
    const goal = await G(p, () => {
      const g = window.DragonStatue.adv.level.goal;
      return { x: g.p.x, z: g.p.z };
    });
    await G(p, (g) => window.__ds.tp(g.x, g.z + 0.6, Math.PI), goal);
    await until(p, (s) => s.state === "BOSS_INTRO", 4000, "BOSS_INTRO");
    const bb = await until(p, (s) => s.state === "BOSS_BATTLE", 9000, "BOSS_BATTLE");
    const bar = await G(p, () => !document.getElementById("boss-bar").hidden && document.getElementById("boss-name").textContent);
    // 약점이 닫혀 있을 때 방망이로 쳐도 데미지 없음
    let closedHits = 0;
    for (let i = 0; i < 4; i++) {
      const b = await G(p, () => {
        const B = window.DragonStatue.adv.boss;
        const w = B.weakPos();
        return { x: w.x, z: w.z, bx: B.pos.x, bz: B.pos.z, weak: B.weakOpen };
      });
      if (b.weak) continue;
      await G(p, (b) => window.__ds.near(b.x, b.z, 1.2, b.x + (b.x - b.bx), b.z + (b.z - b.bz)), b);
      await p.keyboard.press("KeyJ");
      await sleep(350);
      closedHits++;
    }
    const hpAfterClosed = (await S(p)).boss.hp;
    // 자동 조종으로 끝까지 (하트는 줄지 않게)
    await G(p, installBot, true);
    let s;
    const t0 = Date.now();
    while (Date.now() - t0 < 180000) {
      s = await S(p);
      if (s.state === "STAGE_CLEAR" || s.state === "GAME_OVER") break;
      await sleep(500);
    }
    const bossSeq = (await G(p, () => window.__ds.rec())).boss;
    const pats = ["tailWind", "chargeWind", "slamWind", "rainWind", "stunned", "tired", "hurt"].filter((x) => bossSeq.includes(x));
    const resShown = await until(p, (s) => s.result, 6000, "결과").then(() => true, () => false);
    const ar = await G(p, () => ({
      k: document.getElementById("ar-k").textContent,
      stars: document.querySelectorAll("#ar-stars [data-icon=star]").length,
      unlocks: [...document.querySelectorAll("#ar-unlocks .ru")].map((e) => e.textContent.trim()),
      main: document.getElementById("ar-main").textContent.trim(),
      save: JSON.parse(localStorage.getItem("today-dragon-statue-v1")).adv,
    }));
    const sv = ar.save;
    const rj = sv.regions.jungle || {};
    check(
      "A9",
      "보스: 등장 연출 → 약점 닫힘=데미지 없음 → 지침/기절 때 약점 → 처치 → 지역 완료",
      bb.boss && bar && hpAfterClosed === bb.boss.hp && s.state === "STAGE_CLEAR" && resShown && ar.k === "지역 1 완료" && pats.length >= 4,
      `${bar} HP ${bb.boss.hp} · 약점 닫혔을 때 ${closedHits}번 쳐도 HP ${hpAfterClosed} · 본 패턴 ${pats.join(",")} · ${Math.round((Date.now() - t0) / 1000)}초 · "${ar.k}" 별 ${ar.stars}`
    );
    check(
      "A10",
      "기록 · 보상 저장: 다음 지역 열림 · 별/수정/시간 · 드래곤 알 · 배지 · 꾸미기 해금",
      sv.unlocked === 2 && rj.clears === 1 && rj.stars >= 1 && rj.bestTime > 0 && sv.eggs.forest && sv.badges["jungle-clear"] && ar.unlocks.length >= 2,
      `열린 지역 ${sv.unlocked} · 정글 기록 별 ${rj.stars} 수정 ${rj.crystals} 시간 ${rj.bestTime}초 · 알 ${Object.keys(sv.eggs).join(",")} · 새로 얻음: ${ar.unlocks.join(" / ")}`
    );
    // 다음 지역 → 입구 퍼즐
    await p.click("#ar-main");
    const nx = await until(p, (s) => s.state === "STATUE_PUZZLE", 8000, "다음 지역 퍼즐").catch(() => null);
    const nxName = await G(p, () => document.getElementById("hud-stage") ? document.getElementById("hud-stage").textContent : "");
    // 새로고침해도 남는지
    await load(p);
    const kept = await G(p, () => ({ unlocked: window.DragonStatue.save.data.adv.unlocked, gem: document.getElementById("gem-label").textContent, total: window.DragonStatue.save.data.adv.totalCrystals }));
    check("A11", "다음 지역 버튼 → 지역 2 입구 퍼즐 · 새로고침 후에도 기록 유지", nx && nx.region === 1 && kept.unlocked === 2 && Number(kept.gem.replace(/\D/g, "")) === kept.total, `다음 → ${nx ? nx.state : "없음"} (지역 ${nx ? nx.region + 1 : "-"} "${nxName}") · 새로고침 후 열린 지역 ${kept.unlocked}, 타이틀 수정 ${kept.gem}`);
    await p.ctx.close();
  }

  /* ---------- A12. 마지막 지역: 보스 패턴 4가지(경고 표시) → 처치 → VICTORY → 친구들 축하 ---------- */
  if (want("A12", "A13")) {
    const p = await openPage(browser, { errors, save: ADV({ unlocked: 6 }) });
    await load(p);
    await play(p, 5);
    await G(p, () => window.__ds.god());
    const goal = await G(p, () => {
      const g = window.DragonStatue.adv.level.goal;
      return { x: g.p.x, z: g.p.z };
    });
    await G(p, (g) => window.__ds.tp(g.x, g.z + 0.6, Math.PI), goal);
    await until(p, (s) => s.state === "BOSS_BATTLE", 12000, "BOSS_BATTLE");
    const name = await G(p, () => document.getElementById("boss-name").textContent);
    const pat = {};
    for (const k of ["tail", "slam", "rain", "charge"]) {
      // 보스 앞 6m 에 서서 그 패턴을 차례대로
      await G(p, (k) => {
        const A = window.DragonStatue.adv;
        const B = A.boss;
        const c = A.level.arena.c;
        window.__ds.tp(c.x, c.z + 4, Math.PI);
        B.pos.set(c.x, c.y, c.z - 2.5);
        B.queue = [k];
        B.setState("idle");
        B.st = 5;
        window.__pat = { warn: 0, act: 0, waves: 0, rains: 0, moved: 0, x0: B.pos.x, z0: B.pos.z };
        const loop = () => {
          const w = window.__pat;
          if (!w || w.k !== k) return;
          const st = B.state;
          const mk = B.mk;
          const op = Math.max(mk.annulus.material.opacity, mk.lane.material.opacity, mk.slamRing.material.opacity);
          // 경고: 꼬리=붉은 고리 · 돌진=붉은 길 · 충격파=바닥 고리 · 바위=떨어질 자리 고리 (떨어지기 전)
          if (k === "rain") {
            if (B.rains.some((r) => r.t < -0.45 && r.ring.material.opacity > 0.1)) w.warn++;
          } else if (st === k + "Wind" && op > 0.1) w.warn++;
          if (st === k) w.act++;
          w.waves = Math.max(w.waves, B.waves.length);
          w.rains = Math.max(w.rains, B.rains.length);
          w.moved = Math.max(w.moved, Math.hypot(B.pos.x - w.x0, B.pos.z - w.z0));
          if (st === "stunned") w.stunned = true;
          requestAnimationFrame(loop);
        };
        window.__pat.k = k;
        loop();
      }, k);
      await sleep(k === "charge" ? 4200 : 3600);
      pat[k] = await G(p, () => {
        const w = window.__pat;
        window.__pat = null;
        return w;
      });
    }
    const patOk = pat.tail.warn > 5 && pat.tail.act > 5 && pat.slam.warn > 5 && pat.slam.waves > 0 && pat.rain.warn > 5 && pat.rain.rains > 0 && pat.charge.warn > 5 && pat.charge.moved > 4 && pat.charge.stunned;
    check(
      "A12",
      "보스 패턴: 꼬리 휘두르기 · 바닥 충격파 · 떨어지는 바위 · 돌진(벽에 쿵 → 기절) — 모두 미리 경고 표시",
      patOk,
      `${name} · 꼬리 경고 ${pat.tail.warn}f/공격 ${pat.tail.act}f · 충격파 경고 ${pat.slam.warn}f/파동 ${pat.slam.waves} · 바위 경고 ${pat.rain.warn}f/바위 ${pat.rain.rains} · 돌진 경고 ${pat.charge.warn}f/이동 ${f1(pat.charge.moved)}m/기절 ${!!pat.charge.stunned}`
    );
    // 마지막 한 방: HP 1 로 두고 자동 조종이 약점을 친다
    await G(p, () => {
      const B = window.DragonStatue.adv.boss;
      B.hp = 1;
      B.phase2 = true;
    });
    await G(p, installBot, true);
    const v = await until(p, (s) => s.state === "VICTORY", 90000, "VICTORY").catch(() => null);
    const vr = await until(p, (s) => s.result, 8000, "결과").catch(() => null);
    const vd = await G(p, () => ({
      pals: (window.DragonStatue.adv.pals || []).length,
      k: document.getElementById("ar-k").textContent,
      h: document.getElementById("ar-h").textContent,
      save: JSON.parse(localStorage.getItem("today-dragon-statue-v1")).adv,
    }));
    await p.screenshot({ path: "test-results/dragon-adv-victory.png" }).catch(() => {});
    check("A13", "최종 보스 처치 → VICTORY → 친구들 축하 → 결과 · 전체 완주 저장", v && vr && vd.pals === 3 && vd.k === "VICTORY" && vd.save.clearedAll && vd.save.eggs.gold, `${v ? v.state : "없음"} · 친구 ${vd.pals}명 · "${vd.k} / ${vd.h}" · 전체 완주 ${vd.save.clearedAll} · 황금 알 ${!!vd.save.eggs.gold}`);
    await p.ctx.close();
  }

  /* ---------- A14. 처음 연습 안내: 실제로 해 보면 다음 안내로 (이동 → 점프 → 대시 → 방망이 → 적) ---------- */
  if (want("A14")) {
    const p = await openPage(browser, { errors, save: ADV({ tutorial: false }) });
    await load(p);
    await play(p, 0);
    const prompt = () => G(p, () => (document.getElementById("adv-prompt").hidden ? "" : document.getElementById("prompt-t").textContent));
    const seen = [];
    const done = [];
    const gone = async () => {
      await sleep(300);
      return !(await prompt());
    };
    /** 연습 구역 입구로 가서 안내가 뜨는지 */
    const enter = async (step, re) => {
      if (step !== "move") {
        await G(p, (step) => {
          const z = window.DragonStatue.adv.level.tuts.find((t) => t.step === step);
          window.__ds.tp((z.x0 + z.x1) / 2, z.z1 - 0.6, Math.PI);
        }, step);
      }
      const t0 = Date.now();
      let t = "";
      while (Date.now() - t0 < 3000) {
        t = await prompt();
        if (re.test(t)) break;
        await sleep(80);
      }
      if (re.test(t)) seen.push(t);
      return re.test(t);
    };
    // 이동: 출발하자마자 안내 → 실제로 달리면 끝
    if (await enter("move", /W A S D/)) {
      await p.keyboard.down("KeyW");
      await sleep(1100);
      await p.keyboard.up("KeyW");
      if (await gone()) done.push("이동");
    }
    if (await enter("jump", /Space/)) {
      await p.keyboard.press("Space");
      if (await gone()) done.push("점프");
    }
    if (await enter("dash", /Shift/)) {
      await sleep(600);
      await p.keyboard.press("ShiftLeft");
      if (await gone()) done.push("대시");
    }
    if (await enter("attack", /방망이/)) {
      const fence = await G(p, () => {
        const b = window.DragonStatue.adv.level.breakables.find((b) => b.kind === "fence" && !b.broken);
        return { x: b.p.x, z: b.p.z };
      });
      await G(p, (f) => window.__ds.near(f.x, f.z, 1.25, f.x, f.z + 3), fence);
      await sleep(120);
      await p.keyboard.press("KeyJ");
      if (await gone()) done.push("방망이");
    }
    if (await enter("enemy", /빨간 표시/)) {
      await G(p, () => window.__ds.god());
      for (let i = 0; i < 40; i++) {
        const e = await G(p, () => {
          const e = window.DragonStatue.adv.enemies[0];
          return { x: e.pos.x, z: e.pos.z, alive: e.alive };
        });
        if (!e.alive) break;
        await G(p, (e) => window.__ds.near(e.x, e.z, 1.1, e.x, e.z + 3), e);
        await p.keyboard.press("KeyJ");
        await sleep(380);
      }
      if (await gone()) done.push("적");
    }
    const saved = await G(p, () => JSON.parse(localStorage.getItem("today-dragon-statue-v1")).adv.tutorial);
    check("A14", "처음 연습 안내: 직접 해 보면 다음으로 (이동·점프·대시·방망이·적) → 끝나면 저장", done.length === 5 && saved === true, `해낸 단계 ${done.join("→")} · 저장 ${saved} · 안내 예: "${seen[0] || ""}"`);
    await p.ctx.close();
  }

  /* ---------- A15. 모바일 터치: 조이스틱 이동 + 동시에 점프 · 대시 · 방망이 버튼 · 세로 화면 카메라 ---------- */
  if (want("A15")) {
    const p = await openPage(browser, { errors, width: 390, height: 844, touch: true });
    await load(p);
    await play(p, 0);
    const cdp = await p.ctx.newCDPSession(p);
    const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
    const rect = (id) => G(p, (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom };
    }, id);
    const ui = await G(p, () => ({ touch: document.body.classList.contains("touch"), shown: getComputedStyle(document.getElementById("touch-ui")).display !== "none" }));
    const zone = await rect("joy-zone");
    const jx = zone.l + Math.min(110, zone.w * 0.4);
    const jy = zone.b - Math.min(160, zone.h * 0.35);
    const a = await S(p);
    await G(p, () => window.__ds.reset());
    await T("touchStart", [[jx, jy, 1]]);
    // 살짝만 밀면 걷기
    await T("touchMove", [[jx, jy - 22, 1]]);
    await sleep(700);
    const walk = await S(p);
    for (let i = 2; i <= 6; i++) {
      await T("touchMove", [[jx, jy - i * 12, 1]]);
      await sleep(16);
    }
    await sleep(500);
    const runS = await S(p);
    // 조이스틱을 누른 채로 두 번째 손가락으로 점프
    const jb = await rect("btn-jump");
    await T("touchStart", [[jx, jy - 72, 1], [jb.x, jb.y, 2]]);
    await sleep(250);
    await T("touchEnd", [[jx, jy - 72, 1]]);
    await sleep(500);
    const b = await S(p);
    await T("touchEnd", []);
    const jumpY = (await G(p, () => window.__ds.rec())).y - a.pos[1];
    await sleep(500);
    const c = await S(p);
    const tapBtn = async (id) => {
      const r = await rect(id);
      await T("touchStart", [[r.x, r.y, 3]]);
      await sleep(60);
      await T("touchEnd", []);
      await sleep(450);
    };
    await G(p, () => window.__ds.reset());
    await tapBtn("btn-dash");
    const dash = (await G(p, () => window.__ds.rec())).dash;
    await G(p, () => window.__ds.reset());
    await tapBtn("btn-attack");
    const atk = (await G(p, () => window.__ds.rec())).atk;
    // 세로 화면: 주인공이 화면 가운데쯤 · 버튼/HUD 에 가리지 않음
    const view = await G(p, () => {
      const g = window.DragonStatue;
      const P = g.adv.player;
      const v = P.pos.clone().setY(P.pos.y + 0.5).project(g.cam);
      const x = ((v.x + 1) / 2) * innerWidth;
      const y = ((1 - v.y) / 2) * innerHeight;
      const hit = ["btn-jump", "btn-attack", "btn-dash", "adv-hud"].filter((id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      });
      return { x, y, hit };
    });
    await p.screenshot({ path: "test-results/dragon-adv-touch-390x844.png" }).catch(() => {});
    const moved = dist2(a.pos, b.pos);
    check(
      "A15",
      "모바일 터치: 조이스틱 이동 + 누른 채 점프(두 손가락) · 대시 · 방망이 버튼 · 세로 카메라",
      ui.touch && ui.shown && walk.anim === "walk" && walk.hs < 4 && walk.hs > 0.5 && runS.anim === "run" && moved > 3 && jumpY > 0.8 && c.hs < 0.5 && dash > 0 && atk > 0 && view.y > 844 * 0.25 && view.y < 844 * 0.8 && !view.hit.length,
      `터치 조작 표시 ${ui.shown} · 살짝 밀기 ${walk.anim} ${f1(walk.hs)}m/s → 끝까지 ${runS.anim} ${f1(runS.hs)}m/s · 조이스틱 ${f1(moved)}m · 동시 점프 ${f1(jumpY)}m · 손 떼면 멈춤 ${f1(c.hs)}m/s · 대시 ${dash > 0} · 방망이 ${atk > 0} · 주인공 화면 위치 ${Math.round(view.x)},${Math.round(view.y)}${view.hit.length ? " 가림:" + view.hit : ""}`
    );
    await p.ctx.close();
  }

  /* ---------- A16. 여러 화면 크기: 모험 HUD · 터치 버튼 · 지역 소개 · 결과 카드 ---------- */
  if (want("A16")) {
    const sizes = [
      [360, 640, true],
      [390, 844, true],
      [844, 390, true],
      [768, 1024, true],
      [1366, 768, false],
      [1920, 1080, false],
    ];
    const out = [];
    let allOk = true;
    for (const [w, h, touch] of sizes) {
      const p = await openPage(browser, { width: w, height: h, touch, errors });
      await load(p);
      await G(p, () => window.DragonStatue.adv.start(0, { retry: true }));
      await until(p, (s) => s.state === "STAGE_INTRO", 6000, "소개");
      await sleep(400);
      const intro = await G(p, () => {
        const r = document.getElementById("intro-card").getBoundingClientRect();
        return r.width > 0 && r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1;
      });
      await until(p, (s) => s.state === "PLAYING", 8000, "PLAYING");
      await sleep(300);
      const r = await G(p, (touch) => {
        const rect = (id) => document.getElementById(id).getBoundingClientRect();
        const inView = (b) => b.width > 0 && b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        const over = (a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
        const hud = ["adv-region", "adv-hearts", "adv-gems", "adv-pause", "adv-prog-wrap"];
        const bad = hud.filter((id) => !inView(rect(id)));
        const pairs = [["adv-region", "adv-hearts"], ["adv-hearts", "adv-pause"], ["adv-region", "adv-pause"]];
        const ov = pairs.filter(([a, b]) => over(rect(a), rect(b))).map((x) => x.join("/"));
        let btn = 999;
        if (touch) {
          const ids = ["btn-jump", "btn-attack", "btn-dash"];
          for (const id of ids) {
            const b = rect(id);
            if (!inView(b)) bad.push(id);
            btn = Math.min(btn, b.width, b.height);
            if (over(b, rect("adv-hud"))) ov.push(id + "/HUD");
          }
          for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (over(rect(ids[i]), rect(ids[j]))) ov.push(ids[i] + "/" + ids[j]);
        } else if (getComputedStyle(document.getElementById("touch-ui")).display !== "none" && rect("btn-jump").width > 0) bad.push("PC에 터치 버튼");
        const g = window.DragonStatue;
        const P = g.adv.player;
        const v = P.pos.clone().setY(P.pos.y + 0.5).project(g.cam);
        const px = ((v.x + 1) / 2) * innerWidth;
        const py = ((1 - v.y) / 2) * innerHeight;
        const heroOk = px > 0 && px < innerWidth && py > rect("adv-hud").bottom && py < innerHeight;
        return { bad, ov, btn, heroOk };
      }, touch);
      await p.screenshot({ path: `test-results/dragon-adv-${w}x${h}.png` }).catch(() => {});
      // 결과 카드: 하트 1 → 떨어짐 → 게임 오버
      await G(p, () => {
        const A = window.DragonStatue.adv;
        A.hearts = 1;
        const P = A.player;
        P.spawn(new P.pos.constructor(P.pos.x + 30, P.pos.y + 0.5, P.pos.z), P.yaw);
      });
      await until(p, (s) => s.result, 8000, "결과");
      await sleep(500);
      const resOk = await G(p, () => {
        const b = document.getElementById("ar-main");
        b.scrollIntoView({ block: "nearest" });
        const r = b.getBoundingClientRect();
        return r.width >= 120 && r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight;
      });
      const ok = intro && !r.bad.length && !r.ov.length && r.btn >= 44 && r.heroOk && resOk;
      allOk = allOk && ok;
      out.push(`${w}x${h}:${ok ? "OK" : "X"}(${touch ? `버튼 ${Math.round(r.btn)}px` : "PC"}${r.bad.length ? " 밖:" + r.bad : ""}${r.ov.length ? " 겹침:" + r.ov : ""}${r.heroOk ? "" : " 주인공 안 보임"}${intro ? "" : " 소개 넘침"}${resOk ? "" : " 결과 버튼"})`);
      await p.ctx.close();
    }
    check("A16", "여러 화면 크기: 모험 HUD · 터치 버튼(44px 이상, 안 겹침) · 지역 소개 · 결과 카드", allOk, out.join(" "));
  }

  /* ---------- A17. 지역 지도(잠금) · 수집 도감 · 꾸미기(모양만) · 설정(음악/효과음 따로) · 네 캐릭터 같은 능력 ---------- */
  if (want("A17", "A18", "A19")) {
    const p = await openPage(browser, {
      errors,
      save: ADV({ unlocked: 2, regions: { jungle: { stars: 2, crystals: 30, bestTime: 120, bestScore: 900, clears: 1 } }, eggs: { forest: "2026-10-18" }, badges: { "jungle-clear": "2026-10-18" }, totalCrystals: 30 }),
    });
    await load(p);
    await p.click("#regions-btn");
    await sleep(400);
    const map = await G(p, () => ({
      n: document.querySelectorAll("#region-grid .region").length,
      locked: document.querySelectorAll("#region-grid .region.locked").length,
      stars1: document.querySelectorAll('#region-grid [data-region="0"] [data-icon=star]').length,
    }));
    await p.click('#region-grid [data-region="3"]', { force: true }); // 잠긴 칸 (aria-disabled) 도 눌러 본다
    await sleep(300);
    const lockedStay = await G(p, () => window.DragonStatue.mode !== "adv" && !document.getElementById("regions").hidden);
    await p.click('#regions [data-back]');
    await sleep(300);
    await p.click("#collection-btn");
    await sleep(400);
    const col = await G(p, () => ({ eggs: document.querySelectorAll("#egg-grid .fairy").length, has: document.querySelectorAll("#egg-grid .fairy.has").length, badges: document.querySelectorAll("#badge-grid .badge-item").length, bHas: document.querySelectorAll("#badge-grid .badge-item.has").length }));
    await p.click('#collection [data-back]');
    await sleep(300);
    await p.click("#settings-btn");
    await sleep(300);
    await G(p, () => {
      const m = document.querySelector('[data-vol="musicVol"]');
      m.value = 30;
      m.dispatchEvent(new Event("input"));
      const s = document.querySelector('[data-vol="sfxVol"]');
      s.value = 0;
      s.dispatchEvent(new Event("input"));
    });
    const vol = await G(p, () => ({ m: window.DragonStatue.audio.musicVol, s: window.DragonStatue.audio.sfxVol, saved: JSON.parse(localStorage.getItem("today-dragon-statue-v1")).settings }));
    await p.click('#settings [data-back]');
    await sleep(300);
    // 꾸미기: 모자 탭 → 열린 것 고르기 · 잠긴 것은 안 됨
    await p.click("#char-btn");
    await sleep(500);
    await p.click('[data-ward="hat"]');
    await sleep(200);
    const hats = await G(p, () => ({ n: document.querySelectorAll("#bat-row [data-item]").length, locked: [...document.querySelectorAll("#bat-row [data-item].locked")].map((b) => b.dataset.item) }));
    await p.click('#bat-row [data-item="flower"]');
    await sleep(200);
    await p.click('#bat-row [data-item="wizard"]').catch(() => {});
    await sleep(200);
    const hatSel = await G(p, () => window.DragonStatue.save.data.hat);
    await p.click('[data-ward="deco"]');
    await sleep(200);
    await p.click('#bat-row [data-item="scarf"]');
    await sleep(200);
    const decoSel = await G(p, () => window.DragonStatue.save.data.deco);
    // 네 캐릭터: 같은 속도 · 같은 점프 (실제로 달리고 뛰어서 잼)
    const stats = [];
    for (const c of ["chick", "bear", "bunny", "otter"]) {
      await G(p, (c) => {
        window.DragonStatue.save.data.char = c;
      }, c);
      await play(p, 0);
      await p.keyboard.down("KeyW");
      await sleep(900);
      const sp = (await S(p)).hs;
      await p.keyboard.up("KeyW");
      await until(p, (s) => s.hs < 0.1, 3000, "멈춤");
      await G(p, () => window.__ds.reset());
      const y0 = (await S(p)).pos[1];
      await p.keyboard.down("Space");
      await sleep(320);
      await p.keyboard.up("Space");
      await until(p, (s) => s.onGround, 3000, "착지");
      await sleep(200);
      const jy = (await G(p, () => window.__ds.rec())).y - y0;
      const hero = await G(p, () => ({ id: window.DragonStatue.hero.def.id, hat: !!window.DragonStatue.hero.group.getObjectByName("hat") }));
      stats.push({ c, id: hero.id, sp, jy, hat: hero.hat });
    }
    const same = stats.every((s) => Math.abs(s.sp - stats[0].sp) < 0.15 && Math.abs(s.jy - stats[0].jy) < 0.08);
    check("A17", "지역 지도: 6지역 · 잠긴 곳은 못 들어감 · 기록 별 표시", map.n === 6 && map.locked === 4 && map.stars1 === 2 && lockedStay, `지역 ${map.n} · 잠김 ${map.locked} · 정글 별 ${map.stars1} · 잠긴 지역 눌러도 그대로 ${lockedStay}`);
    check("A18", "수집 도감(알 6 · 배지) · 설정(음악/효과음 크기 따로 저장)", col.eggs === 6 && col.has === 1 && col.badges === 6 && col.bHas === 1 && vol.m === 0.3 && vol.s === 0 && vol.saved.musicVol === 0.3 && vol.saved.sfxVol === 0, `알 ${col.has}/${col.eggs} · 배지 ${col.bHas}/${col.badges} · 음악 ${vol.m} 효과음 ${vol.s} (저장 ${vol.saved.musicVol}/${vol.saved.sfxVol})`);
    check("A19", "꾸미기(모자 · 장식) 열린 것만 · 네 캐릭터 능력 똑같음", hats.n === 7 && hats.locked.includes("wizard") && hatSel === "flower" && decoSel === "scarf" && same && stats.every((s) => s.id === s.c), `모자 ${hats.n}종 (잠김 ${hats.locked.join(",")}) → 고른 모자 ${hatSel} · 장식 ${decoSel} · ${stats.map((s) => `${s.c} ${f1(s.sp)}m/s 점프 ${s.jy.toFixed(2)}m`).join(" | ")}`);
    await p.ctx.close();
  }

  /* ---------- A20. 성능: 초당 프레임 · 그리기 호출 · 지역을 오가도 메모리(geometry · texture)가 늘지 않음 ---------- */
  if (want("A20")) {
    const p = await openPage(browser, { errors });
    await load(p);
    const mem = [];
    const fps = [];
    for (const idx of [0, 3, 5, 0, 3, 5, 0]) {
      await play(p, idx);
      await G(p, installBot, true);
      const m = await G(p, async () => {
        const g = window.DragonStatue;
        const r = g.renderer;
        let n = 0;
        let calls = 0;
        let tris = 0;
        const t0 = performance.now();
        await new Promise((res) => {
          const f = () => {
            n++;
            calls = Math.max(calls, r.info.render.calls);
            tris = Math.max(tris, r.info.render.triangles);
            if (performance.now() - t0 < 3000) requestAnimationFrame(f);
            else res();
          };
          requestAnimationFrame(f);
        });
        return { fps: n / ((performance.now() - t0) / 1000), calls, tris, geo: r.info.memory.geometries, tex: r.info.memory.textures, prog: r.info.programs ? r.info.programs.length : 0 };
      });
      mem.push({ idx, ...m });
      fps.push(m.fps);
    }
    // 테마 그림(하늘 · 바닥 무늬)은 처음 볼 때 한 번 만들어 두고 다시 쓴다 → 한 바퀴 돈 뒤(2번째 정글)와 3번째 정글을 비교
    const first = mem[3];
    const last = mem[mem.length - 1];
    const grow = { geo: last.geo - first.geo, tex: last.tex - first.tex };
    const minFps = Math.min(...fps);
    check(
      "A20",
      "성능: 프레임 · 그리기 호출 · 지역을 여러 번 오가도 메모리 그대로",
      minFps > 45 && Math.max(...mem.map((m) => m.calls)) < 400 && grow.geo <= 1 && grow.tex <= 1,
      `${mem.map((m) => `지역${m.idx + 1}: ${Math.round(m.fps)}fps 호출 ${m.calls} 삼각형 ${Math.round(m.tris / 1000)}k geo ${m.geo} tex ${m.tex}`).join(" | ")} · 2번째→3번째 정글 geo ${first.geo}→${last.geo}, tex ${first.tex}→${last.tex}`
    );
    await p.ctx.close();
  }

  /* ---------- A21 (선택). 6개 지역 처음부터 보스까지 자동 조종 ---------- */
  if (FULL && want("A21")) {
    const out = [];
    let allOk = true;
    for (let idx = 0; idx < 6; idx++) {
      const p = await openPage(browser, { errors, save: ADV({ unlocked: 6 }) });
      await load(p);
      await play(p, idx);
      await G(p, installBot, true);
      const t0 = Date.now();
      let s;
      while (Date.now() - t0 < 330000) {
        s = await S(p);
        if (["STAGE_CLEAR", "VICTORY", "GAME_OVER"].includes(s.state)) break;
        await sleep(1000);
      }
      const ok = s.state === (idx === 5 ? "VICTORY" : "STAGE_CLEAR");
      allOk = allOk && ok;
      out.push(`지역${idx + 1}:${ok ? "완주" : s.state}(${Math.round((Date.now() - t0) / 1000)}초 · 떨어짐 ${s.falls} · 맞음 ${s.hits} · 수정 ${s.gems})`);
      await p.ctx.close();
    }
    check("A21", "6개 지역 모두 처음부터 보스까지 완주 가능 (자동 조종 · 하트 무한)", allOk, out.join(" "));
  }

  /* ---------- 개인정보 · 오류 ---------- */
  const leaked = apiLog.filter((r) => /data:image|base64/.test(r.body) || /localStorage|today-dragon-statue/.test(r.body));
  check("A22", "/api 로 보내는 것에 사진 · 저장 데이터 없음", leaked.length === 0, `/api 요청 ${apiLog.length}건 (${[...new Set(apiLog.map((r) => r.method + " " + new URL(r.url).pathname))].join(", ") || "없음"}) · 의심 ${leaked.length}건`);
  check("A23", "콘솔 오류 · 리소스 로딩 오류 없음", errors.length === 0, errors.length ? errors.slice(0, 6) : "없음 (/api 는 가짜 응답)");

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e.message);
  process.exit(1);
});

