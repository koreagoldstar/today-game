/**
 * 말랑팡! 슬라임 연구소 — 자동 점검 (실제 브라우저 · 실제 게임 코드 · 실제 마우스 · 키보드 · 터치)
 *
 * 사용:
 *   1) npx --yes serve . -l 3456          (다른 창에서)
 *   2) node scripts/test-slime-lab.js      (SL_ONLY=S1,S5 처럼 골라서도 됨)
 *
 * - /api/* 는 가짜 응답 → 실제 랭킹 · 집계에 아무것도 쓰지 않는다.
 * - 저장 데이터는 테스트마다 새 브라우저 칸에서.
 * - 슬라임을 미리 놓는 것(makeBody)은 '그 상황에서 실제로 어떻게 되나' 보려고만 쓰고, 판정은 게임이 실제로 낸 결과로 한다.
 * - 한 판 끝까지는 자동 플레이(입력만 대신 · 물리 · 합체 · 점수 · 넘침은 그대로)로 시간을 빨리 돌려 본다.
 */
"use strict";

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (_) {
  console.error("playwright 가 필요해요: npm i -D playwright");
  process.exit(2);
}

const BASE = process.env.SL_BASE || "http://localhost:3456";
const GAME = `${BASE}/games/slime-lab/`;
const KEY = "today-slime-lab-v1";
const ONLY = (process.env.SL_ONLY || "").split(",").filter(Boolean);
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
async function openPage(browser, { width = 1280, height = 800, touch = false, save = null, errors = [], noStorage = false } = {}) {
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
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, scores: [], items: [], today: 1, total: 1 }) });
  });
  await p.addInitScript(
    ([key, save, noStorage]) => {
      if (noStorage) {
        // 저장소를 못 쓰는 브라우저 흉내
        Storage.prototype.setItem = () => {
          throw new Error("QuotaExceededError");
        };
        Storage.prototype.getItem = () => {
          throw new Error("SecurityError");
        };
        return;
      }
      if (sessionStorage.getItem("__sl_init")) return;
      sessionStorage.setItem("__sl_init", "1");
      if (save) localStorage.setItem(key, JSON.stringify(save));
      else localStorage.removeItem(key);
    },
    [KEY, save, noStorage]
  );
  p.ctx = ctx;
  return p;
}
const G = (p, fn, arg) => p.evaluate(fn, arg);
async function load(p) {
  const t0 = Date.now();
  await p.goto(GAME);
  await p.waitForFunction(() => window.SlimeLab && window.SlimeLab.state === "title", null, { timeout: 15000 });
  await G(p, () => {
    const g = window.SlimeLab;
    window.__sl = {
      s() {
        const k = g.keeper;
        return {
          state: g.state,
          paused: g.paused,
          screen: g.ui.current,
          mode: g.mode,
          n: g.world.bodies.length,
          levels: g.world.bodies.map((b) => b.level).sort((a, b) => a - b),
          score: k.score,
          merges: k.merges,
          events: k.events,
          maxCombo: k.maxCombo,
          maxChain: k.maxChain,
          maxMade: k.maxMade,
          drops: g.drops,
          used: g.used,
          cur: g.cur,
          aimX: g.aimX,
          cool: g.cool,
          danger: g.dangerT,
        };
      },
      /** 빈 용기에서 시작 (매달린 슬라임 없이) + 슬라임 놓기 */
      setup(bodies) {
        g.start("classic");
        g.world.clear();
        g.keeper.reset();
        g.cur = 0;
        g.cool = 99;
        for (const [lv, x, y] of bodies) g.makeBody(lv, x, y);
      },
      /** 화면 좌표 (세계 x,y → 페이지 px) */
      screen(x, y) {
        const r = g.canvas.getBoundingClientRect();
        return { x: r.left + g.X(x), y: r.top + g.Y(y) };
      },
    };
  });
  return Date.now() - t0;
}
const S = (p) => G(p, () => window.__sl.s());
async function until(p, pred, ms = 10000, label = "") {
  const t0 = Date.now();
  let s;
  while (Date.now() - t0 < ms) {
    s = await S(p);
    if (pred(s)) return s;
    await sleep(40);
  }
  throw new Error(`시간 초과: ${label} (상태 ${s && s.state})`);
}
/** 자동 플레이 봇 (같은 슬라임 옆을 노리고 · 없으면 낮은 곳 · 입력만 대신) */
function installBot(opts = {}) {
  const g = window.SlimeLab;
  window.__botStep = async () => {
    if (g.state !== "play" || g.paused || !g.cur || g.cool > 0) return false;
    if (g.t - (g.lastDropT ?? -9) < (opts.gap ?? 1.0)) return false;
    const C = await import("/games/slime-lab/js/config.js?v=1");
    const L = g.cur;
    const r = C.LEVELS[L].r;
    let best = 200;
    let bs = -1e9;
    for (let x = r; x <= C.JAR.W - r; x += 6) {
      const y = g.world.landY(x, r);
      let s = y;
      for (const b of g.world.bodies) {
        if (!b.alive) continue;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < b.r + r + 8) {
          if (b.level === L) s += 420;
          else if (b.level < L) s -= 40 * (L - b.level);
        }
      }
      s += (Math.random() - 0.5) * (opts.noise ?? 30);
      if (s > bs) {
        bs = s;
        best = x;
      }
    }
    g.aimX = best;
    return g.drop();
  };
  /** 시간 빨리 돌리기 (그리기 루프는 그대로 · 계산만 여기서) */
  window.__fast = async (maxSec, stop) => {
    const upd = (window.__upd = window.__upd || g.update.bind(g));
    g.update = () => {};
    let f = 0;
    while (f < maxSec * 60 && !stop(g)) {
      await window.__botStep();
      upd(1 / 60);
      f++;
      if (f % 600 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    g.update = upd;
    return f / 60;
  };
}

(async () => {
  const browser = await launch();
  const errors = [];

  /* ---------- S1: 불러오기 → 타이틀 ---------- */
  if (want("S1")) {
    const p = await openPage(browser, { errors });
    const ms = await load(p);
    await sleep(400);
    const t = await G(p, () => ({
      buttons: [...document.querySelectorAll("#title button")].filter((b) => b.offsetParent).map((b) => b.textContent.trim()),
      best: document.getElementById("title-best").textContent.trim(),
      bodies: window.SlimeLab.world.bodies.length,
      hud: !document.getElementById("hud").hidden,
    }));
    check("S1", "불러오기 → 타이틀 (클래식 · 미션 · 도감 · 조작 방법 · 설정) · 연구소 슬라임들 · 게임 중 화면은 숨김", t.buttons.join("|") === "클래식|미션|도감|조작 방법|설정" && t.bodies >= 5 && !t.hud, `${(ms / 1000).toFixed(1)}초 · 버튼 ${t.buttons.join(", ")} · 연구소 슬라임 ${t.bodies} · "${t.best}"`);
    await p.ctx.close();
  }

  /* ---------- S2 · S3: 마우스 · 키보드로 떨어뜨리기 (한 번 = 하나) ---------- */
  if (want("S2") || want("S3")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await p.click("#classic-btn");
    await until(p, (s) => s.state === "play" && s.cur > 0 && s.cool <= 0, 4000, "ready");
    const hud = await G(p, () => !document.getElementById("hud").hidden && !document.getElementById("hud-bottom").hidden);
    // 마우스: 용기 오른쪽 1/4 지점으로 옮기고 클릭 → 그 자리에 하나
    const pt = await G(p, () => window.__sl.screen(300, 200));
    await p.mouse.move(pt.x, pt.y);
    await sleep(100);
    const a0 = await S(p);
    await p.mouse.click(pt.x, pt.y);
    await sleep(80);
    const a1 = await S(p);
    const dropped = await G(p, () => {
      const b = window.SlimeLab.world.bodies[window.SlimeLab.world.bodies.length - 1];
      return b ? { x: b.x, level: b.level } : null;
    });
    await sleep(1400);
    const landed = await G(p, () => {
      const g = window.SlimeLab;
      return g.world.bodies.map((b) => ({ x: b.x, y: b.y, r: b.r, inside: b.x >= b.r - 0.5 && b.x <= 400 - b.r + 0.5 && b.y <= 560 - b.r + 0.5 }));
    });
    if (want("S2")) check("S2", "마우스: 옮긴 자리로 클릭 한 번 → 슬라임 하나 · 떨어져서 용기 바닥에 · HUD 보임", hud && a1.drops === a0.drops + 1 && dropped && Math.abs(dropped.x - 300) < 3 && landed.every((b) => b.inside) && landed.some((b) => b.y > 500), `투하 ${a0.drops}→${a1.drops} · x ${dropped && dropped.x.toFixed(1)} · 착지 y ${landed.map((b) => b.y.toFixed(0)).join(",")}`);
    // 키보드: → 를 누르고 있으면 오른쪽 · Space 는 한 번에 하나 (빨리 두 번 눌러도 쿨다운)
    await until(p, (s) => s.cur > 0 && s.cool <= 0, 3000, "ready2");
    const k0 = await S(p);
    await p.keyboard.down("ArrowLeft");
    await sleep(400);
    await p.keyboard.up("ArrowLeft");
    const k1 = await S(p);
    await p.keyboard.press("Space");
    await p.keyboard.press("Space");
    await sleep(60);
    const k2 = await S(p);
    if (want("S3")) check("S3", "키보드: ←/→ 로 옮기기 · Space 로 떨어뜨리기 · 빨리 두 번 눌러도 하나만 (쿨다운)", k1.aimX < k0.aimX - 60 && k2.drops === k1.drops + 1, `위치 ${k0.aimX.toFixed(0)}→${k1.aimX.toFixed(0)} · Space 두 번 → 투하 ${k1.drops}→${k2.drops}`);
    await p.ctx.close();
  }

  /* ---------- S4: 휴대폰 터치 (대고 옮긴 뒤 떼면 하나 · 다른 손가락 무시 · 화면이 안 밀림) ---------- */
  if (want("S4")) {
    const p = await openPage(browser, { errors, width: 390, height: 844, touch: true });
    await load(p);
    await p.tap("#classic-btn");
    await until(p, (s) => s.state === "play" && s.cur > 0 && s.cool <= 0, 4000, "ready");
    const cdp = await p.ctx.newCDPSession(p);
    const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
    const A = await G(p, () => window.__sl.screen(80, 300));
    const B = await G(p, () => window.__sl.screen(320, 300));
    const s0 = await S(p);
    await T("touchStart", [[A.x, A.y, 1]]);
    await sleep(60);
    for (let i = 1; i <= 6; i++) {
      await T("touchMove", [[A.x + ((B.x - A.x) * i) / 6, A.y, 1]]);
      await sleep(16);
    }
    const mid = await S(p);
    // 두 번째 손가락 (무시돼야 함)
    await T("touchStart", [[B.x, B.y, 1], [A.x, A.y + 100, 2]]);
    await T("touchEnd", [[B.x, B.y, 1]]);
    await sleep(30);
    await T("touchEnd", []);
    await sleep(80);
    const s1 = await S(p);
    const lastX = await G(p, () => {
      const b = window.SlimeLab.world.bodies[window.SlimeLab.world.bodies.length - 1];
      return b ? b.x : null;
    });
    // 톡: 그 자리에 하나
    await until(p, (s) => s.cur > 0 && s.cool <= 0, 3000, "ready2");
    const C = await G(p, () => window.__sl.screen(200, 300));
    await T("touchStart", [[C.x, C.y, 3]]);
    await sleep(70);
    await T("touchEnd", []);
    await sleep(80);
    const s2 = await S(p);
    const scroll = await G(p, () => ({ y: scrollY, x: scrollX, touch: document.body.classList.contains("touch") || window.SlimeLab.touch, hint: document.getElementById("hint").textContent }));
    check("S4", "터치: 손가락을 대고 옮긴 뒤 떼면 그 자리에 하나 · 다른 손가락은 무시 · 톡 치면 그 자리 · 화면이 밀리지 않음", s1.drops === s0.drops + 1 && Math.abs(lastX - 320) < 4 && mid.aimX > 250 && s2.drops === s1.drops + 1 && scroll.y === 0 && scroll.x === 0 && /손가락/.test(scroll.hint), `옮기는 중 위치 ${mid.aimX.toFixed(0)} · 뗀 뒤 투하 ${s0.drops}→${s1.drops} (x ${lastX && lastX.toFixed(0)}) · 톡 → ${s2.drops} · 스크롤 ${scroll.x},${scroll.y} · 안내 "${scroll.hint}"`);
    await p.screenshot({ path: "test-results/slime-touch-390x844.png" }).catch(() => {});
    await p.ctx.close();
  }

  /* ---------- S5 · S6 · S7: 합체 규칙 · 점수 중복 없음 · 경계와 안정 ---------- */
  if (["S5", "S6", "S7"].some(want)) {
    const p = await openPage(browser, { errors });
    await load(p);
    const R = await G(p, async () => (await import("/games/slime-lab/js/config.js?v=1")).LEVELS.map((L) => (L ? L.r : 0)));
    const H = 560;
    const run = async (bodies, ms) => {
      await G(p, (b) => window.__sl.setup(b), bodies);
      await sleep(ms);
      return S(p);
    };
    // 같은 단계 둘 (살짝 떨어져 닿기 직전)
    const a = await run([[3, 150, H - R[3]], [3, 150 + 2 * R[3] + 1, H - R[3]]], 700);
    // 다른 단계끼리
    const b = await run([[2, 120, H - R[2]], [1, 120 + R[2] + R[1] + 0.5, H - R[1]], [3, 230, H - R[3]], [4, 230 + R[3] + R[4] + 0.5, H - R[4]]], 900);
    // 세 개가 한꺼번에 닿음
    const c = await run([[1, 180, H - R[1]], [1, 180 + 2 * R[1], H - R[1]], [1, 180 + R[1], H - R[1] * 2.7]], 900);
    // 연쇄 3번: 1단계 둘을 2단계 위에 얹고 · 옆에 3단계
    const d = await run([[2, 100, H - R[2]], [1, 100 - R[1], H - 2 * R[2] - R[1] + 2], [1, 100 + R[1], H - 2 * R[2] - R[1] + 2], [3, 100 + 2 * R[3] + 1, H - R[3]]], 1600);
    const expect = await G(p, async () => {
      const m = await import("/games/slime-lab/js/score.js?v=1");
      return m.mergePoints(2, 1, 1) + m.mergePoints(3, 2, 2) + m.mergePoints(4, 3, 3);
    });
    if (want("S5"))
      check(
        "S5",
        "합체 규칙: 같은 단계만 하나로 (다음 단계) · 다른 단계는 그대로 · 셋이 동시에 닿아도 합체는 한 번 · 연쇄 3번 → 점수 = 점수 모듈 계산",
        a.n === 1 && a.levels[0] === 4 && a.merges === 1 && b.n === 4 && b.merges === 0 && c.n === 2 && c.levels.join() === "1,2" && c.events === 1 && d.levels.join() === "4" && d.maxChain === 3 && d.score === expect,
        `둘 → [${a.levels}] · 다른 단계 ${b.n}개 그대로 · 셋 → [${c.levels}] 합체 ${c.events}번 · 연쇄 → [${d.levels}] 연쇄 ${d.maxChain} 점수 ${d.score}=${expect}`
      );
    // 점수: 같은 합체 이벤트가 두 번 와도 한 번만
    const dup = await G(p, async () => {
      const { ScoreKeeper } = await import("/games/slime-lab/js/score.js?v=1");
      const k = new ScoreKeeper();
      const r1 = k.apply({ id: 7, level: 5, chain: 1, t: 1 });
      const r2 = k.apply({ id: 7, level: 5, chain: 1, t: 1.01 });
      // 콤보: 떨어뜨린 뒤 이어지는 합체만 · 새로 떨어뜨리면 0부터
      k.onDrop();
      const c1 = k.apply({ id: 8, level: 2, chain: 1, t: 2 }).combo;
      const c2 = k.apply({ id: 9, level: 2, chain: 1, t: 2.5 }).combo;
      k.onDrop();
      const c3 = k.apply({ id: 10, level: 2, chain: 1, t: 2.7 }).combo;
      const { mergePoints } = await import("/games/slime-lab/js/score.js?v=1");
      const expect = mergePoints(5, 1, 1) + mergePoints(2, 1, 1) + mergePoints(2, 2, 1) + mergePoints(2, 1, 1);
      return { p1: r1.points, dup: r2, score: k.score, expect, merges: k.merges, c1, c2, c3 };
    });
    if (want("S6")) check("S6", "점수: 같은 합체가 두 번 와도 한 번만 · 콤보는 떨어뜨린 뒤 이어지는 합체만 (새로 떨어뜨리면 처음부터)", dup.dup === null && dup.merges === 4 && dup.score === dup.expect && dup.c1 === 1 && dup.c2 === 2 && dup.c3 === 1, dup);
    // 경계 · 안정: 60개를 마구 던져도
    const st = await G(p, async () => {
      const g = window.SlimeLab;
      g.start("classic");
      g.world.clear();
      g.cur = 0;
      g.cool = 99;
      for (let i = 0; i < 60; i++) g.makeBody(1 + Math.floor(Math.random() * 4), 40 + Math.random() * 320, -40 - i * 25, { vx: (Math.random() - 0.5) * 1800, vy: Math.random() * 1000 });
      const bad = [];
      let maxSp = 0;
      const sec = [];
      // 15초 동안 매 프레임 확인 · 1초마다 평균 속도 (뒤늦게 만난 같은 슬라임이 합쳐지며 퐁 튀는 건 정상)
      for (let f = 1; f <= 900; f++) {
        await new Promise((r) => requestAnimationFrame(r));
        for (const b of g.world.bodies) {
          maxSp = Math.max(maxSp, Math.hypot(b.vx, b.vy));
          if (!Number.isFinite(b.x + b.y + b.vx + b.vy)) bad.push("NaN");
          if (b.x < b.r - 0.5 || b.x > 400 - b.r + 0.5 || b.y > 560 - b.r + 0.5) bad.push(`밖 ${b.level}`);
        }
        if (f % 60 === 0) sec.push(Math.round(Math.sqrt(g.world.energy() / Math.max(1, g.world.bodies.length))));
      }
      const still = sec.slice(-5).filter((v) => v < 5).length;
      return { bad: [...new Set(bad)], maxSp: Math.round(maxSp), sec: sec.join(","), still, n: g.world.bodies.length, fixes: g.world.fixes };
    });
    if (want("S7")) check("S7", "경계 · 안정: 60개를 마구 던져도 용기 밖 · NaN 없음 · 속도 제한 · 떨지 않고 가라앉음 (마지막 5초 중 3초 이상 거의 멈춤)", st.bad.length === 0 && st.maxSp <= 1700 && st.still >= 3, st);
    await p.ctx.close();
  }

  /* ---------- S8 · S9: 넘침 경고 → 게임 오버 → 결과 · 다시 하기 (이전 판이 안 남음) · 클래식 한 판 끝까지 ---------- */
  if (want("S8") || want("S9")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await G(p, installBot, { gap: 1.0 });
    await p.click("#classic-btn");
    await until(p, (s) => s.state === "play", 4000, "play");
    // 한 판 끝까지 (빨리 돌리기)
    const sec = await G(p, () => window.__fast(30 * 60, (g) => g.state !== "play"));
    const end = await S(p);
    await until(p, (s) => s.screen === "over", 6000, "over screen").catch(() => null);
    const over = await G(p, () => ({
      h: document.getElementById("over-h").textContent,
      score: Number(document.getElementById("over-score").textContent.replace(/,/g, "")),
      stats: document.getElementById("over-stats").textContent.replace(/\s+/g, " ").trim(),
      newBest: !document.getElementById("over-new").hidden,
      rank: !!document.querySelector("#over-rank form, #over-rank .today-rank-form"),
      save: JSON.parse(localStorage.getItem("today-slime-lab-v1") || "{}"),
    }));
    await p.screenshot({ path: "test-results/slime-over.png" }).catch(() => {});
    const posted = apiLog.filter((r) => r.method === "POST" && /\/api\/scores/.test(r.url)).length;
    if (want("S9")) check("S9", "클래식 한 판 끝까지 (자동 플레이 · 시간만 빨리) → 넘쳐서 끝 → 결과: 점수 · 최고 · 합체 · 최대 콤보 · 랭킹 칸 · 이 기기에 최고 점수 저장 · 저절로 안 보냄", end.state === "over" && over.score === end.score && over.score > 0 && /합체/.test(over.stats) && /콤보/.test(over.stats) && over.rank && over.save.best === end.score && over.newBest && posted === 0, `${Math.round(sec)}초 · 투하 ${end.drops} · 점수 ${over.score} · 합체 ${end.merges} · 최대 콤보 ${end.maxCombo} · 최대 연쇄 ${end.maxChain} · "${over.h}" · 저장 최고 ${over.save.best} · 저절로 보낸 점수 ${posted}건`);
    // 다시 하기 (R 키) → 이전 판 물리 · 점수가 하나도 안 남음
    await p.keyboard.press("KeyR");
    await until(p, (s) => s.state === "play", 3000, "restart").catch(() => null);
    await sleep(200);
    const re = await S(p);
    // 넘침: 자동 플레이로 위험선을 넘는 순간 경고가 보이고 · 계속 넘쳐 있으면 게임 오버
    await G(p, () => window.__fast(30 * 60, (g) => g.dangerT > 0.75 || g.state !== "play"));
    const warn = await G(p, () => !document.getElementById("warn").hidden && document.body.classList.contains("danger"));
    await G(p, () => window.__fast(30 * 60, (g) => g.state !== "play"));
    const ov2 = await until(p, (s) => s.state === "over", 6000, "overflow").catch(() => null);
    if (want("S8")) check("S8", "넘침: 위험선 위로 오래 있으면 경고 → 게임 오버 · 'R' 로 다시 하기 → 이전 판 슬라임 · 점수 · 콤보가 하나도 안 남음", re.state === "play" && re.n === 0 && re.score === 0 && re.merges === 0 && re.drops === 0 && warn && !!ov2, `다시 하기 → 슬라임 ${re.n} · 점수 ${re.score} · 투하 ${re.drops} / 넘침 경고 ${warn} → ${ov2 && ov2.state}`);
    await sleep(1800);
    const savedBest = await G(p, () => JSON.parse(localStorage.getItem("today-slime-lab-v1")).best);
    await p.reload();
    await load(p);
    const tb = await G(p, () => document.getElementById("title-best").textContent);
    if (want("S9")) check("S9b", "새로고침 뒤 타이틀에 클래식 최고 점수", savedBest >= end.score && tb.includes(savedBest.toLocaleString("ko-KR")), `"${tb.trim()}" (저장된 최고 ${savedBest})`);
    await p.ctx.close();
  }

  /* ---------- S10: 미션 (목록 · 잠금 · 성공 · 별 · 다음 · 실패 · 다음 난이도 열림) ---------- */
  if (want("S10")) {
    const p = await openPage(browser, { errors, save: { v: 1, missions: { 1: 3, 2: 1 } } });
    await load(p);
    await G(p, installBot, { gap: 1.0 });
    await p.click("#mission-btn");
    await sleep(200);
    const list = await G(p, () => ({
      tiles: document.querySelectorAll("#tiers .m-tile").length,
      tiers: [...document.querySelectorAll("#tiers .tier")].map((t) => (t.classList.contains("locked") ? "잠김" : "열림")),
      sum: document.getElementById("missions-sum").textContent,
    }));
    // 잠긴 미션 → 안내만
    // 잠긴 칸도 실제로는 누를 수 있음 (안내만 나와야 함) — 점검 도구가 aria-disabled 를 '못 누름'으로 보므로 강제로
    await p.click('#tiers [data-m="5"]', { force: true });
    await sleep(150);
    const locked = await G(p, () => ({ t: document.getElementById("toast").textContent, screen: window.SlimeLab.ui.current, state: window.SlimeLab.state }));
    // 미션 3 (쉬움) 을 깸 → 쉬움 3개 → '보통' 열림
    await p.click('#tiers [data-m="3"]');
    await until(p, (s) => s.state === "play" && s.mode === "mission", 3000, "mission");
    const hud = await G(p, () => ({ goal: document.getElementById("mission-goal").textContent, drops: document.getElementById("mission-drops").textContent, bar: !document.getElementById("mission-bar").hidden }));
    await G(p, () => window.__fast(10 * 60, (g) => g.state !== "play"));
    await until(p, (s) => s.screen === "mresult", 4000, "result").catch(() => null);
    const res = await G(p, () => ({
      h: document.getElementById("mres-h").textContent,
      stars: document.getElementById("mres-stars").textContent,
      unlock: document.getElementById("mres-unlock").hidden ? "" : document.getElementById("mres-unlock").textContent,
      next: document.getElementById("mres-next").hidden ? "" : document.getElementById("mres-next").textContent,
      saved: JSON.parse(localStorage.getItem("today-slime-lab-v1")).missions,
    }));
    await p.screenshot({ path: "test-results/slime-mission-clear.png" }).catch(() => {});
    // 다음 미션 버튼 → 미션 4
    await p.click("#mres-next");
    const m4 = await until(p, (s) => s.state === "play" && s.mode === "mission", 3000, "next").catch(() => null);
    const m4goal = await G(p, () => document.getElementById("mission-goal").textContent);
    // 실패: 투하 2개짜리로 바꾼 미션 (합체 못 하게 양 끝에) → 다 쓰면 실패
    await G(p, async () => {
      const g = window.SlimeLab;
      const { MISSIONS } = await import("/games/slime-lab/js/missions.js?v=1");
      g.start("mission", { ...MISSIONS.find((m) => m.id === 9), drops: 2 });
    });
    await until(p, (s) => s.cur > 0 && s.cool <= 0, 3000, "ready");
    await G(p, () => {
      const g = window.SlimeLab;
      g.aimX = 0;
      g.drop();
    });
    await until(p, (s) => s.cur > 0 && s.cool <= 0, 3000, "ready2");
    await G(p, () => {
      const g = window.SlimeLab;
      g.aimX = 400;
      g.drop();
    });
    const fail = await until(p, (s) => s.screen === "mresult", 9000, "fail").catch(() => null);
    const fres = await G(p, () => ({ h: document.getElementById("mres-h").textContent, stars: document.getElementById("mres-stars").textContent, next: !document.getElementById("mres-next").hidden }));
    check(
      "S10",
      "미션: 3 난이도 12개 · 잠긴 미션은 안내만 · 목표와 남은 슬라임 표시 · 성공 → 별 저장 · '보통' 열림 · 다음 미션 · 다 쓰면 실패",
      list.tiles === 12 && list.tiers.join() === "열림,잠김,잠김" && /잠겨/.test(locked.t) && locked.state === "title" && hud.bar && /연쇄/.test(hud.goal) && /남은 슬라임 30/.test(hud.drops) && res.h === "미션 성공!" && /★/.test(res.stars) && res.saved[3] >= 1 && /보통/.test(res.unlock) && /다음/.test(res.next) && !!m4 && /토끼/.test(m4goal) && !!fail && /아쉬워요/.test(fres.h) && fres.stars === "☆☆☆" && !fres.next,
      `목록 ${list.tiles}개 [${list.tiers}] "${list.sum}" · 잠김 → "${locked.t}" · HUD "${hud.goal}" "${hud.drops}" → "${res.h}" ${res.stars} 저장 ${JSON.stringify(res.saved)} · "${res.unlock}" · ${res.next} → "${m4goal}" · 실패 "${fres.h}" ${fres.stars}`
    );
    await p.ctx.close();
  }

  /* ---------- S11 · S12: 도감 · 기록 저장 (새로고침 뒤) · 저장 못 하는 브라우저 ---------- */
  if (want("S11") || want("S12")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await p.click("#dex-btn");
    await sleep(200);
    const d0 = await G(p, () => ({ names: [...document.querySelectorAll("#dex-grid b")].map((b) => b.textContent), sum: document.getElementById("dex-sum").textContent }));
    await p.click('#dex-grid [data-lv="5"]');
    const det0 = await G(p, () => document.getElementById("dex-detail").textContent.replace(/\s+/g, " "));
    await p.keyboard.press("Escape");
    // 1~5단계를 만들어 봄
    await G(p, () => {
      const g = window.SlimeLab;
      g.start("classic");
      g.world.clear();
      g.cur = 0;
      g.cool = 99;
      g.makeBody(4, 150, 523);
      g.makeBody(4, 150 + 75, 523);
    });
    await sleep(900);
    await G(p, () => window.SlimeLab.toTitle());
    await p.reload();
    await load(p);
    await p.click("#dex-btn");
    await sleep(200);
    const d1 = await G(p, () => ({ names: [...document.querySelectorAll("#dex-grid b")].map((b) => b.textContent), sum: document.getElementById("dex-sum").textContent, title: document.getElementById("title-best").textContent }));
    await p.click('#dex-grid [data-lv="5"]');
    const det1 = await G(p, () => document.getElementById("dex-detail").textContent.replace(/\s+/g, " "));
    if (want("S11")) check("S11", "도감: 못 찾은 슬라임은 ??? 실루엣 · 만들면 이름 · 단계 · 설명 · 처음 발견한 날 · 만든 횟수 (새로고침 뒤에도)", d0.names.every((n) => n === "???") && /0 \/ 8/.test(d0.sum) && /아직 발견하지 못했어요/.test(det0) && d1.names[4] === "별빛 슬라임" && d1.names[3] === "토끼 슬라임" && d1.names[7] === "???" && /처음 발견 \d{4}-\d{2}-\d{2}/.test(det1) && /만든 횟수 1번/.test(det1), `처음 "${d0.sum}" → 새로고침 뒤 "${d1.sum}" · [${d1.names.join(",")}] · "${det1.slice(0, 60)}…"`);
    await p.ctx.close();
    // 저장소를 못 쓰는 브라우저: 그래도 시작 · 투하 · 합체가 된다 · 설정에 안내
    const q = await openPage(browser, { errors, noStorage: true });
    await load(q);
    await q.click("#settings-btn");
    const note = await G(q, () => document.getElementById("save-note").textContent);
    await q.keyboard.press("Escape");
    await G(q, () => window.__sl.setup([[2, 150, 538], [2, 194.5, 538]]));
    await sleep(700);
    const ns = await S(q);
    await q.ctx.close();
    if (want("S12")) check("S12", "기록 저장: 새로고침 뒤 도감 유지 · 저장소를 못 쓰는 브라우저에서도 게임은 그대로 (설정에 안내)", d1.names[4] === "별빛 슬라임" && /저장할 수 없어요/.test(note) && ns.merges === 1 && ns.levels.join() === "3", `새로고침 뒤 도감 "${d1.sum}" · 저장 못 함 → "${note}" · 합체 ${ns.merges} [${ns.levels}]`);
  }

  /* ---------- S13: 일시정지 · 탭 숨김 · 소리 · 움직임 줄이기 ---------- */
  if (want("S13")) {
    const p = await openPage(browser, { errors });
    await load(p);
    await p.click("#classic-btn");
    await until(p, (s) => s.state === "play" && s.cur > 0 && s.cool <= 0, 3000, "play");
    await G(p, () => {
      const g = window.SlimeLab;
      g.aimX = 200;
      g.drop();
    });
    await sleep(100);
    await p.keyboard.press("Escape");
    await sleep(60);
    const y0 = await G(p, () => window.SlimeLab.world.bodies.map((b) => b.y));
    await sleep(500);
    const y1 = await G(p, () => window.SlimeLab.world.bodies.map((b) => b.y));
    const pausedScreen = await G(p, () => window.SlimeLab.ui.current);
    // 멈춘 동안 클릭해도 안 떨어짐
    const d0 = (await S(p)).drops;
    await G(p, () => window.SlimeLab.drop());
    const d1 = (await S(p)).drops;
    await p.click("#pause-resume");
    await sleep(400);
    const y2 = await G(p, () => window.SlimeLab.world.bodies.map((b) => b.y));
    await G(p, () => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const hid = await S(p);
    await G(p, () => Object.defineProperty(document, "hidden", { value: false, configurable: true }));
    await p.click("#pause-resume");
    // 소리 끄기 (저장) · 움직임 줄이기
    await p.click("#sound-btn");
    const snd = await G(p, () => ({ on: window.SlimeLab.audio.on, saved: JSON.parse(localStorage.getItem("today-slime-lab-v1")).settings.sound, label: document.getElementById("sound-btn").getAttribute("aria-label") }));
    const count = () =>
      G(p, () => {
        const g = window.SlimeLab;
        g.fx.reset();
        g.fx.burst(200, 300, 40, ["#fff"], 6, 3);
        let n = 0;
        for (const q of g.fx.p) if (q.on) n++;
        return { n, reduced: document.body.classList.contains("reduced"), shake: g.fx.shake };
      });
    const normal = await count();
    await G(p, () => window.SlimeLab.setReduced(true));
    const fxn = await count();
    fxn.normal = normal.n;
    check("S13", "일시정지: Esc 로 멈춤 (멈춘 동안 슬라임 · 투하 정지) · 계속하기 · 탭 숨기면 자동 멈춤 · 소리 끄기 저장 · 움직임 줄이기 (파티클 줄고 흔들림 없음)", pausedScreen === "pause" && y0.join() === y1.join() && d1 === d0 && y2.join() !== y1.join() && hid.paused && !snd.on && snd.saved === false && /켜기/.test(snd.label) && fxn.reduced && fxn.n <= normal.n * 0.45 && normal.shake > 0 && fxn.shake === 0, `멈춤 ${pausedScreen} · 멈춘 동안 움직임 ${y0.join() === y1.join() ? "없음" : "있음"} · 투하 ${d0}→${d1} · 탭 숨김 ${hid.paused} · 소리 ${snd.on} (저장 ${snd.saved}) · 파티클 보통 ${normal.n} → 줄이기 ${fxn.n} · 흔들림 ${normal.shake.toFixed(2)} → ${fxn.shake}`);
    await p.ctx.close();
  }

  /* ---------- S14: 여러 화면 크기 (용기 · HUD · 버튼이 화면 안 · 44px 이상) ---------- */
  if (want("S14")) {
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
        return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1 && r.height >= 44;
      }));
      await G(p, () => window.SlimeLab.start("classic"));
      await sleep(300);
      const r = await G(p, () => {
        const g = window.SlimeLab;
        const box = (id) => document.getElementById(id).getBoundingClientRect();
        // 유리 용기(안쪽) · 위 레일까지 · 받침대까지
        const glass = { l: g.X(0), r: g.X(400), t: g.Y(0), b: g.Y(560) };
        const all = { l: g.X(-12), r: g.X(412), t: g.Y(-122), b: g.Y(575) };
        const hud = box("hud");
        const bot = box("hud-bottom");
        const inter = (a, b) => Math.max(0, Math.min(a.r, b.right) - Math.max(a.l, b.left)) * Math.max(0, Math.min(a.b, b.bottom) - Math.max(a.t, b.top));
        const area = (glass.r - glass.l) * (glass.b - glass.t);
        const btns = ["pause-btn", "sound-btn"].map((id) => box(id));
        return {
          jarIn: all.l >= -1 && all.r <= innerWidth + 1 && all.t >= -1 && all.b <= innerHeight + 1,
          overlap: Math.round(((inter(glass, hud) + inter(glass, bot)) / area) * 1000) / 10,
          btn: Math.min(...btns.map((b) => Math.min(b.width, b.height))),
          hudIn: hud.right <= innerWidth + 1 && hud.left >= -1 && hud.bottom <= innerHeight + 1,
          jarW: Math.round(glass.r - glass.l),
        };
      });
      await p.screenshot({ path: `test-results/slime-${w}x${h}.png` }).catch(() => {});
      const ok = titleOk && r.jarIn && r.overlap < 1 && r.btn >= 44 && r.hudIn;
      all = all && ok;
      out.push(`${w}x${h}:${ok ? "OK" : "X"}(용기 ${r.jarW}px · 버튼 ${Math.round(r.btn)}px${titleOk ? "" : " 타이틀버튼"}${r.jarIn ? "" : " 용기밖"}${r.overlap ? ` 겹침 ${r.overlap}%` : ""})`);
      await p.ctx.close();
    }
    check("S14", "여러 화면 크기: 타이틀 버튼 · 용기 전체 · HUD 가 화면 안 · 버튼 44px 이상 · HUD · 진화표가 용기를 안 가림 (가로 휴대폰은 옆 줄)", all, out.join(" "));
  }

  /* ---------- S15: 성능 (슬라임 많을 때 · 파티클 상한) ---------- */
  if (want("S15")) {
    const p = await openPage(browser, { errors });
    await load(p);
    const perf = await G(p, async () => {
      const g = window.SlimeLab;
      g.start("classic");
      g.world.clear();
      g.cur = 0;
      g.cool = 99;
      for (let i = 0; i < 45; i++) g.makeBody(1 + (i % 4), 20 + ((i * 37) % 360), 300 - i * 20);
      for (let i = 0; i < 6; i++) g.fx.burst(200, 300, 50, ["#fff"], 8, 8);
      let n = 0;
      let worst = 0;
      let last = performance.now();
      const t0 = last;
      while (performance.now() - t0 < 3000) {
        await new Promise((r) => requestAnimationFrame(r));
        const now = performance.now();
        if (now - t0 > 500) worst = Math.max(worst, now - last);
        last = now;
        n++;
      }
      let parts = 0;
      for (const q of g.fx.p) if (q.on) parts++;
      return { fps: Math.round(n / 3), worst: Math.round(worst), bodies: g.world.bodies.length, partsCap: g.fx.p.length };
    });
    check("S15", "성능: 슬라임 45개 + 파티클 가득일 때 평균 프레임 · 파티클 개수 상한", perf.fps >= 50 && perf.partsCap <= 300, perf);
    await p.ctx.close();
  }

  /* ---------- S16: 홈 목록 · 바로 들어오기 · 새로고침 · 다른 게임 ---------- */
  if (want("S16")) {
    const h = await openPage(browser, { errors });
    await h.goto(BASE + "/");
    await sleep(1500);
    await G(h, () => {
      const a = document.querySelector('a[href="/games/slime-lab/"]');
      if (a) a.scrollIntoView({ block: "center" });
    });
    await h.waitForFunction(() => {
      const i = document.querySelector('a[href="/games/slime-lab/"] img');
      return !i || (i.complete && i.naturalWidth > 0);
    }, null, { timeout: 5000 }).catch(() => {});
    const home = await G(h, () => {
      const a = document.querySelector('a[href="/games/slime-lab/"]');
      const img = a && a.querySelector("img");
      return { card: !!a, shelf: a ? (a.closest("section") || {}).id : "", text: a ? a.textContent.replace(/\s+/g, " ").trim() : "", thumb: img ? img.getAttribute("src") : "", ok: img ? img.complete && img.naturalWidth > 0 : false };
    });
    if (home.card) {
      await h.click('a[href="/games/slime-lab/"]');
      await h.waitForFunction(() => window.SlimeLab && window.SlimeLab.state === "title", null, { timeout: 10000 }).catch(() => {});
    }
    const entered = await G(h, () => !!(window.SlimeLab && window.SlimeLab.state === "title"));
    await h.reload();
    await h.waitForFunction(() => window.SlimeLab && window.SlimeLab.state === "title", null, { timeout: 10000 }).catch(() => {});
    const reloaded = await G(h, () => !!(window.SlimeLab && window.SlimeLab.state === "title"));
    const games = [];
    for (const g of ["suika", "lava-surfers", "sky-island", "tetris"]) {
      const before = errors.length;
      await h.goto(`${BASE}/games/${g}/`);
      await sleep(1800);
      games.push(`${g}:${errors.length === before ? "OK" : "오류"}`);
    }
    check("S16", "홈 퍼즐 칸에 카드 · 썸네일 → 눌러서 들어감 · 새로고침 · 다른 게임 정상", home.card && home.shelf === "cat-puzzle" && home.ok && entered && reloaded && games.every((x) => x.endsWith("OK")), `카드 ${home.card} (${home.shelf}) "${home.text.slice(0, 40)}" · 썸네일 ${home.thumb} ${home.ok} · 들어감 ${entered} · 새로고침 ${reloaded} · ${games.join(", ")}`);
    await h.ctx.close();
  }

  const leaked = apiLog.filter((r) => /data:image|base64|today-slime-lab/.test(r.body));
  check("S17", "/api 로 보내는 것에 사진 · 저장 데이터 없음 · 저절로 보낸 점수 없음", leaked.length === 0 && !apiLog.some((r) => r.method === "POST" && /\/api\/scores/.test(r.url)), `/api 요청 ${apiLog.length}건 (${[...new Set(apiLog.map((r) => r.method + " " + new URL(r.url).pathname))].join(", ") || "없음"})`);
  check("S18", "콘솔 오류 · 리소스 로딩 오류 없음", errors.length === 0, errors.length ? errors.slice(0, 6) : "없음 (/api 는 가짜 응답)");

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PASS${failed.length ? " · FAIL: " + failed.map((f) => f.id).join(", ") : ""}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("테스트 중단:", e.message);
  process.exit(1);
});
