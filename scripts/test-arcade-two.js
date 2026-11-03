// 두더지 팡팡 · 서빙왕 점검: 봇 플레이, 실제 입력, 저장, 폰 화면, 오류
// 실행: node scripts/test-arcade-two.js   (AT_ONLY=mole 또는 serve 로 하나만)
const { chromium } = require("playwright");

const BASE = process.env.TEST_BASE || "http://localhost:3456";
let pass = 0;
let fail = 0;
function check(name, ok, info) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${info !== undefined ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, url, opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.vp || { width: 390, height: 844 }, hasTouch: Boolean(opt.touch), serviceWorkers: "block" });
  const page = await ctx.newPage();
  page.errs = [];
  page.on("pageerror", (e) => page.errs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) page.errs.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon|\/api\//.test(r.url())) page.errs.push(`${r.status()} ${r.url()}`);
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.addInitScript((seed) => {
    try {
      if (!sessionStorage.getItem("at-init")) {
        sessionStorage.setItem("at-init", "1");
        localStorage.clear();
        if (seed) for (const k of Object.keys(seed)) localStorage.setItem(k, seed[k]);
      }
      sessionStorage.setItem("today_visit_counted", "1");
    } catch (_) {
      /* 없어도 됨 */
    }
  }, opt.seed || null);
  await page.goto(`${BASE}${url}`);
  return page;
}

async function moleTests(browser) {
  const p = await open(browser, "/games/whack-mole/");
  await p.waitForFunction(() => window.WhackMole && window.WhackMole.ready, null, { timeout: 15000 });
  await sleep(300);
  const sharp = await p.evaluate(() => {
    const c = document.getElementById("game");
    const r = c.getBoundingClientRect();
    return { w: c.width, cw: r.width, title: document.querySelector("#title h1").textContent, seo: Boolean(document.querySelector("#title .seo-about")) };
  });
  check("두더지: 화면 크기에 맞춰 선명하게 그림 · 첫 화면", sharp.w >= sharp.cw && sharp.title.includes("두더지") && sharp.seo, sharp);
  // 봇: 사람 수준 반응(0.42초)으로 50단계 전부
  const run = await p.evaluate(() => {
    const W = window.WhackMole;
    W.save.seen = { gold: 1, bomb: 1, helmet: 1, bunny: 1, ice: 1 };
    const out = [];
    for (let i = 0; i < W.TOTAL; i += 1) {
      let wins = 0;
      let best = null;
      for (let r = 0; r < 3; r += 1) {
        W.startStage(i);
        W.skipReady();
        let guard = 0;
        const seen = new Map();
        const RT = 0.42;
        while (W.s.screen === "play" && W.s.endT < 0 && guard < 60 * 200) {
          W.tick(1 / 60);
          for (const h of W.holes()) {
            const m = h.mole;
            if (!m) {
              seen.delete(h.i);
              continue;
            }
            if (!seen.has(h.i) || seen.get(h.i).m !== m) seen.set(h.i, { m, t: 0 });
            const e = seen.get(h.i);
            e.t += 1 / 60;
            if (m.type === "bomb" || m.type === "bunny" || m.state === "hit") continue;
            if (e.t >= RT && (m.state === "stay" || m.state === "fall") && m.up > 0.3) {
              W.tapHole(h, true);
              e.t = RT - 0.2;
            }
          }
          guard += 1;
        }
        const s = W.s;
        if (s.endWin) {
          wins += 1;
          if (!best || s.timeLeft > best.left) best = { left: +s.timeLeft.toFixed(1), hearts: s.hearts, combo: s.maxCombo };
        }
        for (let k = 0; k < 90; k += 1) W.tick(1 / 60);
        W.setScreen("title");
      }
      out.push({ i, wins, best });
    }
    return out;
  });
  const lost = run.filter((r) => r.wins === 0).map((r) => r.i + 1);
  check("두더지: 50단계 모두 사람 수준 봇이 깸", lost.length === 0, lost);
  const tight = run.filter((r) => r.best && r.best.left < 1.5).map((r) => r.i + 1);
  check("두더지: 시간 여유가 있음", tight.length <= 2, tight);
  const easy = run.slice(0, 10).every((r) => r.wins === 3);
  check("두더지: 첫 월드는 항상 깸", easy, run.slice(0, 10).map((r) => r.wins));
  // 타입별 규칙
  const rules = await p.evaluate(() => {
    const W = window.WhackMole;
    const at = (type) => {
      W.startStage(20);
      W.skipReady();
      const h = W.holes()[0];
      h.mole = { type, t: 0, state: "stay", stay: 5, hp: 1, hitT: 0, wob: 0, helmet: type === "helmet", up: 1 };
      return h;
    };
    const out = {};
    let h = at("bomb");
    const h0 = W.s.hearts;
    W.tapHole(h, true);
    out.bomb = h0 - W.s.hearts;
    h = at("bunny");
    W.tapHole(h, true);
    out.bunny = 3 - W.s.hearts;
    h = at("helmet");
    const g0 = W.s.goalLeft;
    W.tapHole(h, true);
    out.helmet1 = W.s.goalLeft === g0 && !h.mole.helmet && h.mole.state !== "hit";
    W.tick(0.1);
    W.tick(0.1);
    W.tapHole(h, true);
    out.helmet2 = W.s.goalLeft === g0 - 1;
    h = at("gold");
    const t0 = W.s.timeLeft;
    W.tapHole(h, true);
    out.gold = W.s.timeLeft > t0 + 1.5 && W.s.score >= 500;
    h = at("ice");
    W.tapHole(h, true);
    out.ice = W.s.freezeT > 2;
    W.startStage(5);
    W.skipReady();
    for (let i = 0; i < 14; i += 1) {
      const q = W.holes()[i % W.holes().length];
      q.mole = { type: "normal", t: 0, state: "stay", stay: 5, hp: 1, hitT: 0, wob: 0, up: 1 };
      W.tapHole(q, true);
      for (let k = 0; k < 40; k += 1) W.tick(1 / 60);
      if (W.s.feverT > 0) break;
    }
    out.fever = W.s.feverT > 0;
    return out;
  });
  check("두더지: 폭탄 · 토끼는 하트 감소", rules.bomb === 1 && rules.bunny === 1, rules);
  check("두더지: 헬멧은 두 번 쳐야 잡힘", rules.helmet1 && rules.helmet2, rules);
  check("두더지: 황금은 시간 · 큰 점수, 얼음은 모두 멈춤", rules.gold && rules.ice, rules);
  check("두더지: 콤보로 피버 타임", rules.fever, rules);
  // 실제 터치 입력 · 클리어 · 저장
  await p.context().close();
  const t = await open(browser, "/games/whack-mole/", { touch: true });
  await t.waitForFunction(() => window.WhackMole && window.WhackMole.ready, null, { timeout: 15000 });
  await sleep(200);
  await t.tap("#start-btn");
  await sleep(1300);
  let hits = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const q = await t.evaluate(() => {
      const W = window.WhackMole;
      if (W.s.screen !== "play") return { done: true };
      const h = W.holes().find((x) => x.mole && x.mole.state === "stay");
      return h ? { x: h.x, y: h.y - h.w * 0.4 } : {};
    });
    if (q.done) break;
    if (q.x) {
      await t.touchscreen.tap(q.x, q.y);
      hits += 1;
    }
    await sleep(120);
  }
  await sleep(300);
  const st = await t.evaluate(() => ({ screen: window.WhackMole.s.screen, stars: document.querySelectorAll("#clear-stars i.on").length, save: JSON.parse(localStorage.getItem("whack-mole-v2") || "{}").best }));
  check("두더지: 손가락으로 쳐서 1단계 클리어 · 저장", st.screen === "clear" && st.save && st.save["0"], { hits, screen: st.screen });
  await t.reload();
  await t.waitForFunction(() => window.WhackMole && window.WhackMole.ready, null, { timeout: 15000 });
  const label = await t.evaluate(() => document.getElementById("start-btn").textContent);
  check("두더지: 다시 열면 이어하기", /이어하기 1-2/.test(label), label);
  await t.click("#stages-btn");
  await sleep(150);
  const grid = await t.evaluate(() => {
    const items = [...document.querySelectorAll("#stage-grid .st")];
    return { n: items.length, done: items.filter((e) => e.classList.contains("done")).length, lock: items.filter((e) => e.classList.contains("locked")).length };
  });
  check("두더지: 단계 고르기 (깬 판 · 잠긴 판)", grid.n === 10 && grid.done === 1 && grid.lock >= 5, grid);
  check("두더지: 오류 없음", t.errs.length === 0, t.errs.slice(0, 3));
  await t.context().close();
  // 화면 크기
  for (const [name, vp] of [["작은 폰", { width: 360, height: 640 }], ["폰 눕힘", { width: 844, height: 390 }], ["데스크톱", { width: 1280, height: 800 }]]) {
    const q = await open(browser, "/games/whack-mole/", { vp, touch: vp.width < 1000 });
    await q.waitForFunction(() => window.WhackMole && window.WhackMole.ready, null, { timeout: 15000 });
    await sleep(200);
    const lay = await q.evaluate(() => {
      const W = window.WhackMole;
      W.save.seen = { gold: 1, bomb: 1, helmet: 1, bunny: 1, ice: 1 };
      const b = document.getElementById("start-btn").getBoundingClientRect();
      const st0 = { b: b.bottom, ih: innerHeight };
      W.startStage(35);
      W.skipReady();
      const hud = document.getElementById("hud").getBoundingClientRect();
      const hs = W.holes();
      const left = Math.min(...hs.map((h) => h.x - h.w / 2));
      const right = Math.max(...hs.map((h) => h.x + h.w / 2));
      const bottom = Math.max(...hs.map((h) => h.y + h.h / 2));
      const topMole = Math.min(...hs.map((h) => h.y - h.w * 0.95));
      const pause = document.getElementById("today-pause-btn").getBoundingClientRect();
      const mute = document.querySelector(".today-mute-btn").getBoundingClientRect();
      const over = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
      return { ...st0, left, right, bottom, topMole, hudB: hud.bottom, iw: innerWidth, h2: innerHeight, minW: Math.min(...hs.map((h) => h.w)), hit: over(hud, pause) || over(hud, mute) };
    });
    check(`두더지 ${name}: 시작 단추 보임 · 구멍이 화면 안 · 겹침 없음`, lay.b <= lay.ih + 1 && lay.left >= -6 && lay.right <= lay.iw + 6 && lay.bottom <= lay.h2 && lay.topMole >= lay.hudB - 34 && !lay.hit, lay);
    check(`두더지 ${name}: 구멍이 손가락에 충분`, lay.minW >= 44, { minW: lay.minW });
    await q.context().close();
  }
}

async function serveTests(browser) {
  const p = await open(browser, "/games/stork-stride/");
  await p.waitForFunction(() => window.ServingKing && window.ServingKing.ready, null, { timeout: 15000 });
  await sleep(300);
  const sharp = await p.evaluate(() => {
    const c = document.getElementById("game");
    return { w: c.width, cw: c.getBoundingClientRect().width, title: document.querySelector("#title h1").textContent, face: Boolean(document.querySelector(".today-face-chip, [class*=face]")) };
  });
  check("서빙왕: 선명한 화면 · 첫 화면", sharp.w >= sharp.cw && sharp.title.includes("서빙왕"), sharp);
  // 봇: 반응 지연이 있는 사람 수준
  const bot = await p.evaluate(() => {
    const S = window.ServingKing;
    const out = [];
    for (let r = 0; r < 6; r += 1) {
      S.start();
      let t = 0;
      const delay = [];
      while (S.s.state === "play" && t < 160) {
        delay.push(S.s.lean + S.s.leanVel * 0.35);
        const seen = delay.length > 14 ? delay.shift() : 0;
        const want = Math.abs(seen) > 0.09 ? -Math.sign(seen) : 0;
        S.hold(want);
        S.tick(1 / 60);
        t += 1 / 60;
      }
      out.push({ dist: Math.round(S.s.distance), t: Math.round(t), serves: S.s.serves, score: S.s.score, drops: S.s.state });
      S.hold(0);
      for (let k = 0; k < 150; k += 1) S.tick(1 / 60);
      S.toTitle();
    }
    return out;
  });
  const avg = bot.reduce((a, b) => a + b.dist, 0) / bot.length;
  check("서빙왕: 사람 수준 봇이 충분히 오래 버팀 (평균 100m 이상)", avg >= 100, bot);
  check("서빙왕: 달리면서 테이블에 서빙함", bot.every((b) => b.serves >= 1), bot.map((b) => b.serves));
  const idle = await p.evaluate(() => {
    const S = window.ServingKing;
    const res = [];
    for (let r = 0; r < 5; r += 1) {
      S.start();
      S.hold(0);
      let t = 0;
      while (S.s.state === "play" && t < 120) {
        S.tick(1 / 60);
        t += 1 / 60;
      }
      res.push(+t.toFixed(1));
      for (let k = 0; k < 150; k += 1) S.tick(1 / 60);
      S.toTitle();
    }
    return res;
  });
  check("서빙왕: 아무것도 안 하면 곧 쓰러짐", Math.max(...idle) < 60 && Math.min(...idle) > 3, idle);
  const over = await p.evaluate(() => {
    const S = window.ServingKing;
    const res = [];
    for (let r = 0; r < 3; r += 1) {
      S.start();
      let t = 0;
      S.hold(1);
      while (S.s.state === "play" && t < 30) {
        S.tick(1 / 60);
        t += 1 / 60;
      }
      res.push(+t.toFixed(1));
      S.hold(0);
      for (let k = 0; k < 150; k += 1) S.tick(1 / 60);
      S.toTitle();
    }
    return res;
  });
  check("서빙왕: 계속 누르고 있으면 반대로 쓰러짐", Math.max(...over) < 6, over);
  const dtTest = await p.evaluate(() => {
    const S = window.ServingKing;
    const go = (fps) => {
      S.seed(5);
      S.start();
      const dt = 1 / fps;
      let t = 0;
      while (t < 6 && S.s.state === "play") {
        S.hold(0);
        S.update(dt);
        t += dt;
      }
      const d = S.s.distance;
      S.toTitle();
      return d;
    };
    const a = go(120);
    const b = go(30);
    return { a, b };
  });
  check("서빙왕: 프레임 속도와 무관", Math.abs(dtTest.a - dtTest.b) < 2, dtTest);
  // 실제 조작
  await p.click("#start-btn");
  await sleep(350);
  const k0 = await p.evaluate(() => window.ServingKing.s.leanVel);
  await p.keyboard.down("ArrowRight");
  await sleep(180);
  const k1 = await p.evaluate(() => window.ServingKing.s.leanVel);
  await p.keyboard.up("ArrowRight");
  await p.keyboard.down("ArrowLeft");
  await sleep(260);
  const k2 = await p.evaluate(() => window.ServingKing.s.leanVel);
  await p.keyboard.up("ArrowLeft");
  check("서빙왕: 방향키로 앞 · 뒤 보정", k1 > k0 + 0.2 && k2 < k1 - 0.2, { k0, k1, k2 });
  await p.keyboard.press("Escape");
  await sleep(120);
  const a = await p.evaluate(() => window.ServingKing.s.distance);
  await sleep(350);
  const b = await p.evaluate(() => window.ServingKing.s.distance);
  check("서빙왕: 일시정지하면 멈춤", a === b, { a, b });
  await p.click("#today-pause-resume");
  await p.evaluate(() => {
    const S = window.ServingKing;
    S.setLean(0.995);
  });
  await p.waitForFunction(() => window.ServingKing.s.state === "over", null, { timeout: 8000 });
  await sleep(200);
  const ov = await p.evaluate(() => ({ title: document.getElementById("over-title").textContent, detail: document.getElementById("over-detail").textContent, best: Number(localStorage.getItem("serving-king-best")) }));
  check("서빙왕: 쓰러지면 결과 화면 · 기록 저장", ov.title.length > 0 && /m/.test(ov.detail) && ov.best > 0, ov);
  check("서빙왕: 오류 없음", p.errs.length === 0, p.errs.slice(0, 3));
  await p.context().close();
  for (const [name, vp] of [["폰", { width: 390, height: 844 }], ["작은 폰", { width: 360, height: 640 }], ["폰 눕힘", { width: 844, height: 390 }], ["데스크톱", { width: 1280, height: 800 }]]) {
    const q = await open(browser, "/games/stork-stride/", { vp, touch: vp.width < 1000 });
    await q.waitForFunction(() => window.ServingKing && window.ServingKing.ready, null, { timeout: 15000 });
    await sleep(200);
    const b0 = await q.evaluate(() => {
      const r = document.getElementById("start-btn").getBoundingClientRect();
      return { b: r.bottom, ih: innerHeight, h: r.height };
    });
    if (vp.width < 1000) await q.tap("#start-btn");
    else await q.click("#start-btn");
    await sleep(350);
    const lay = await q.evaluate(() => {
      const S = window.ServingKing;
      const rect = (el) => el.getBoundingClientRect();
      const hud = rect(document.getElementById("hud"));
      const pads = [...document.querySelectorAll(".pad")].map(rect);
      const pause = rect(document.getElementById("today-pause-btn"));
      const mute = rect(document.querySelector(".today-mute-btn"));
      const over = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
      const v = S.layout();
      return { hudB: hud.bottom, padTop: Math.min(...pads.map((r) => r.top)), padH: pads[0].height, padW: pads[0].width, feet: v.feet, towerTop: v.towerTop, ih: innerHeight, iw: innerWidth, hit: over(hud, pause) || over(hud, mute), sw: document.documentElement.scrollWidth };
    });
    check(`서빙왕 ${name}: 시작 단추 · 조작 단추가 화면 안 · 충분히 큼`, b0.b <= b0.ih + 1 && lay.padTop + lay.padH <= lay.ih + 1 && lay.padH >= 56 && lay.padW >= 90 && lay.sw <= lay.iw + 1, { b0, lay });
    check(`서빙왕 ${name}: 접시 탑이 위쪽 정보와 안 겹침`, lay.towerTop >= lay.hudB - 4 && !lay.hit, lay);
    check(`서빙왕 ${name}: 오류 없음`, q.errs.length === 0, q.errs.slice(0, 2));
    await q.context().close();
  }
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const only = process.env.AT_ONLY;
  if (!only || only === "mole") await moleTests(browser);
  if (!only || only === "serve") await serveTests(browser);
  await browser.close();
  console.log(`\n결과: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
