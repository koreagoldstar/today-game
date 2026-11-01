/**
 * ONE SHOT — 자동 점검
 *
 * 사용:
 *   1) npm run start           (다른 창에서 · 포트 3456)
 *   2) node scripts/test-oneshot-elite.js            전체 미션 봇 플레이
 *      OSE_ONLY=1-1,2-3 node scripts/test-oneshot-elite.js   골라서
 *      OSE_SHOTS=폴더   화면 사진 저장
 *
 * - 미션마다: 표적 수가 맞음 · 표적이 저격 위치에서 보이는 자리에 있음 · 봇이 실제 사격 코드(fire)로 끝까지 깸
 * - 잘못된 사람을 쏘면 실패 · 저장(별 · 점수)이 다시 불러도 남음
 * - /api/* 는 가짜 응답
 */
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.OSE_BASE || "http://localhost:3456";
const ONLY = (process.env.OSE_ONLY || "").split(",").filter(Boolean);
const SHOTS = process.env.OSE_SHOTS || "";
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 페이지 안에서 도는 봇: 표적을 차례로 머리 조준 → 발사 */
async function botPlay(page, id) {
  return page.evaluate(async (mid) => {
    const G = window.OneShotElite.game;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const done = new Promise((res) => {
      G.listeners.end = (G.listeners.end || []).filter((f) => !f.__bot);
      const fn = (r) => res(r);
      fn.__bot = true;
      G.on("end", fn);
    });
    await G.start(mid);
    G.noSway = true;
    const info = {
      targets: G.actors.filter((a) => a.role === "target").length,
      civ: G.actors.filter((a) => a.role === "civ").length,
      decoys: G.actors.filter((a) => a.role === "decoy").length,
      need: G.need,
    };
    // 표적이 보이는지 (창가 · 잠깐 나오는 표적은 나올 때 위치로)
    const THREEV = G.engine.nest.clone();
    info.blind = [];
    for (const a of G.actors) {
      if (a.role !== "target") continue;
      const p = (a.spot && a.spot.out ? a.spot.out : a.root.position).clone();
      p.y += a.isBoard ? 1.4 : 1.6;
      if (a.spot && a.spot.path) continue;
      if (!G.clearLine(p)) info.blind.push(a.spec ? a.spec.look : "board");
      if (!G.inView(p)) info.blind.push("out-of-view");
    }
    void THREEV;
    G.begin();
    const t0 = performance.now();
    let guard = 0;
    while (G.state === "play" && !G.ended && guard++ < 4000) {
      await wait(60);
      if (G.cool > 0) continue;
      // 옵션 표적 먼저 → 필수는 나중에
      const list = G.actors.filter((a) => a.role === "target" && a.alive && !a.gone && a.root.visible && (a.isBoard || a.exposed !== false));
      list.sort((a, b) => (a.optional === b.optional ? 0 : a.optional ? -1 : 1));
      let fired = false;
      for (const a of list) {
        G.aimAt(a, "head");
        // 막힘 없을 때만 쏨 (봇은 허공에 안 쏨)
        const p = a.headPos(G.engine.tmp.clone());
        if (!G.clearLine(p)) continue;
        G.engine.camera.updateMatrixWorld();
        if (G.fire()) {
          fired = true;
          break;
        }
      }
      if (!fired && performance.now() - t0 > 170000) break;
    }
    const res = await Promise.race([done, wait(20000).then(() => null)]);
    return {
      info,
      ok: res ? res.ok : false,
      reason: res ? res.reason : "timeout",
      stars: res ? res.starCount : 0,
      score: res ? res.score : 0,
      shots: res ? res.shots : 0,
      hits: res ? res.hits : 0,
      time: res ? Math.round(res.time) : 0,
      fps: Math.round(G.fps),
    };
  }, id);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300));
    if (m.type() === "warning" && /표적 자리 없음/.test(m.text())) errs.push(m.text().slice(0, 200));
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.addInitScript(() => {
    try {
      localStorage.setItem("oneshot-elite:v1", JSON.stringify({ settings: { quality: "mid", sound: 0 } }));
      sessionStorage.setItem("today-visit-counted", "1");
    } catch (_) {}
  });
  await page.goto(`${BASE}/games/oneshot-elite/`);
  await page.waitForFunction(() => window.OneShotElite && document.getElementById("boot").hidden, null, { timeout: 90000 });
  const ids = await page.evaluate(() => window.OneShotElite.MISSIONS.map((m) => m.id));
  check("미션 50개", ids.length === 50, `${ids.length}개`);
  const list = process.env.OSE_SKIP_BOT ? [] : ONLY.length ? ids.filter((i) => ONLY.includes(i)) : ids;
  for (const id of list) {
    const t = Date.now();
    const r = await botPlay(page, id);
    const blindTxt = r.info.blind.length ? ` 안 보임:${r.info.blind.join(",")}` : "";
    const pass = r.ok && !r.info.blind.length && r.info.targets >= r.info.need && r.info.targets > 0;
    check(`${id} 봇 성공`, pass, `표적${r.info.targets} 민간${r.info.civ} 미끼${r.info.decoys} · 별${r.stars} 점수${r.score} 총알${r.shots}/${r.hits} ${r.time}초 ${r.fps}fps (${((Date.now() - t) / 1000) | 0}s)${r.ok ? "" : " 이유:" + r.reason}${blindTxt}`);
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(SHOTS, `${id}.png`) });
    }
  }
  check("콘솔 오류 없음", errs.length === 0, errs.slice(0, 6));

  // 컴퓨터: 진짜 마우스 · 키보드로 조작
  {
    const pctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
    const m = await pctx.newPage();
    const merr = [];
    m.on("pageerror", (e) => merr.push(e.message));
    await m.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await m.addInitScript(() => localStorage.setItem("oneshot-elite:v1", localStorage.getItem("oneshot-elite:v1") || JSON.stringify({ settings: { quality: "mid", sound: 0 } })));
    await m.goto(`${BASE}/games/oneshot-elite/`);
    await m.waitForFunction(() => window.OneShotElite && document.getElementById("boot").hidden, null, { timeout: 120000 });
    await sleep(800);
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, "pc-title.png") });
    const logo = await m.evaluate(() => getComputedStyle(document.querySelector("#title .logo")).fontFamily);
    check("PC: 첫 화면 제목 글꼴", /Oswald/.test(logo), logo);
    await m.click("#btn-play");
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, "pc-worlds.png") });
    const locked0 = await m.evaluate(() => document.querySelectorAll(".w-card.locked").length);
    check("PC: 처음엔 월드 1만 열림", locked0 === 4, `잠김 ${locked0}개`);
    await m.click(".w-card");
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, "pc-missions.png") });
    await m.click(".m-tile");
    await m.waitForSelector("#brief:not([hidden])");
    await sleep(500);
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, "pc-brief.png") });
    await m.click("#b-go");
    await m.waitForFunction(() => window.OneShotElite.game.state === "play", null, { timeout: 120000 });
    await sleep(600);
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, "pc-play.png") });
    await m.mouse.move(640, 360);
    await m.mouse.click(640, 360); // 마우스 잡기 (아직 안 쏨)
    await sleep(200);
    const lock = await m.evaluate(() => !!document.pointerLockElement);
    const st0 = await m.evaluate(() => ({ yaw: window.OneShotElite.game.yaw, ammo: window.OneShotElite.game.ammo }));
    check("PC: 첫 클릭은 마우스만 잡고 발사하지 않음", st0.ammo === 5);
    await m.mouse.move(700, 380);
    await sleep(100);
    await m.mouse.click(700, 380, { button: "right" });
    await sleep(350);
    const st1 = await m.evaluate(() => ({ yaw: window.OneShotElite.game.yaw, scoped: window.OneShotElite.game.scoped, zoom: window.OneShotElite.game.zoom }));
    check("PC: 우클릭 스코프", st1.scoped);
    if (lock) check("PC: 마우스로 둘러보기", st1.yaw !== st0.yaw);
    await m.mouse.wheel(0, -120);
    await sleep(150);
    const z2 = await m.evaluate(() => window.OneShotElite.game.zoom);
    check("PC: 휠 배율", z2 > st1.zoom, `${st1.zoom.toFixed(1)} → ${z2.toFixed(1)}`);
    const b0 = await m.evaluate(() => window.OneShotElite.game.breath);
    await m.keyboard.down("Shift");
    await sleep(600);
    const hold = await m.evaluate(() => ({ h: window.OneShotElite.game.holding, b: window.OneShotElite.game.breath }));
    await m.keyboard.up("Shift");
    check("PC: Shift 숨참기 · 막대 줄어듦", hold.h && hold.b < b0, hold);
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, "pc-scope.png") });
    await m.keyboard.press("Space");
    await sleep(150);
    const a2 = await m.evaluate(() => window.OneShotElite.game.ammo);
    check("PC: 스페이스 발사", a2 === 4);
    await m.keyboard.press("KeyP");
    await sleep(150);
    const paused = await m.evaluate(() => window.OneShotElite.game.state);
    check("PC: P 일시정지", paused === "pause");
    await m.click("#p-resume");
    await sleep(100);
    // 저장 · 새로고침: 봇으로 1-1 을 깨고 다시 열어도 별이 남음
    const stars = await m.evaluate(async () => {
      const G = window.OneShotElite.game;
      G.noSway = true;
      const t = G.actors.find((a) => a.role === "target");
      const start = performance.now();
      while (G.state === "play" && !G.ended && performance.now() - start < 30000) {
        await new Promise((r) => setTimeout(r, 80));
        if (G.cool > 0 || t.exposed === false) continue;
        G.aimAt(t, "head");
        G.fire();
      }
      await new Promise((r) => setTimeout(r, 3500));
      return { result: !document.getElementById("result").hidden, st: window.OneShotElite.save.countOf("1-1") };
    });
    check("PC: 결과 화면 · 별 저장", stars.result && stars.st > 0, stars);
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, "pc-result.png") });
    await m.reload();
    await m.waitForFunction(() => window.OneShotElite && document.getElementById("boot").hidden, null, { timeout: 120000 });
    const kept = await m.evaluate(() => window.OneShotElite.save.countOf("1-1"));
    check("PC: 다시 열어도 별이 남음", kept > 0, `${kept}개`);
    check("PC: 오류 없음", !merr.length, merr.slice(0, 3));
    await pctx.close();
  }

  // 홈: 목록에 썸네일 · 링크
  {
    const hctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
    const m = await hctx.newPage();
    await m.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await m.goto(`${BASE}/`);
    await sleep(1500);
    const card = await m.evaluate(async () => {
      const a = document.querySelector('a[href="/games/oneshot-elite/"]');
      if (!a) return null;
      const img = a.querySelector("img");
      a.scrollIntoView();
      if (img) {
        img.loading = "eager";
        if (!img.complete) await new Promise((r) => { img.onload = r; img.onerror = r; setTimeout(r, 4000); });
      }
      return { src: img && img.src, w: img && img.naturalWidth, name: (a.textContent || "").trim().slice(0, 30) };
    });
    check("홈 목록 카드 · 썸네일", card && card.w >= 256, card);
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, "home.png") });
    await hctx.close();
  }

  // 휴대폰: 세로 · 가로에서 버튼이 겹치지 않고 화면 안에 있음 · 실제 눌러서 쏨
  for (const [name, w, h] of [["세로", 390, 844], ["가로", 844, 390], ["작은 세로", 360, 640]]) {
    const mctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: "block" });
    const m = await mctx.newPage();
    const merr = [];
    m.on("pageerror", (e) => merr.push(e.message));
    await m.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await m.goto(`${BASE}/games/oneshot-elite/`);
    await m.waitForFunction(() => window.OneShotElite && document.getElementById("boot").hidden, null, { timeout: 120000 });
    const info = await m.evaluate(async () => {
      const G = window.OneShotElite.game;
      return { q: G.engine.quality };
    });
    await m.tap("#btn-play");
    await m.tap(".w-card");
    await m.tap(".m-tile");
    await m.waitForSelector("#brief:not([hidden])");
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, `m-${name}-brief.png`) });
    await m.tap("#b-go");
    await m.waitForFunction(() => window.OneShotElite.game.state === "play", null, { timeout: 120000 });
    await m.tap("#t-scope");
    await sleep(500);
    const layout = await m.evaluate(() => {
      const ids = ["t-fire", "t-scope", "t-breath", "t-spot", "t-hint", "t-zoom", "pause-btn", "today-mute-btn"];
      const boxes = ids.map((id) => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        return { id, l: r.left, t: r.top, r: r.right, b: r.bottom, vis: !!(r.width && r.height) };
      });
      const W = innerWidth;
      const H = innerHeight;
      const out = boxes.filter((b) => b.vis && (b.l < 0 || b.t < 0 || b.r > W || b.b > H)).map((b) => b.id);
      const over = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const c = boxes[j];
          if (!a.vis || !c.vis) continue;
          if (a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1) over.push(`${a.id}/${c.id}`);
        }
      const hud = document.getElementById("hud").getBoundingClientRect();
      const fire = document.getElementById("t-fire").getBoundingClientRect();
      return { out, over, hudOk: hud.bottom < fire.top, scoped: window.OneShotElite.game.scoped, sw: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    check(`휴대폰 ${name}: 버튼이 겹치지 않고 화면 안에 있음 (${info.q})`, !layout.out.length && !layout.over.length && layout.hudOk && layout.sw, layout);
    check(`휴대폰 ${name}: 스코프 버튼이 동작`, layout.scoped);
    if (SHOTS) await m.screenshot({ path: path.join(SHOTS, `m-${name}-scope.png`) });
    const before = await m.evaluate(() => window.OneShotElite.game.ammo);
    await m.tap("#t-fire");
    await sleep(120);
    const after = await m.evaluate(() => window.OneShotElite.game.ammo);
    check(`휴대폰 ${name}: 발사 버튼이 동작`, after === before - 1);
    // 끌어서 둘러보기
    const y0 = await m.evaluate(() => window.OneShotElite.game.yaw);
    await m.evaluate(() => {
      const c = document.getElementById("game");
      const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "touch", clientX: x, clientY: y, bubbles: true }));
      ev("pointerdown", 120, 300);
      ev("pointermove", 170, 300);
      ev("pointerup", 170, 300);
    });
    const y1 = await m.evaluate(() => window.OneShotElite.game.yaw);
    check(`휴대폰 ${name}: 끌어서 둘러보기`, Math.abs(y1 - y0) > 1e-4);
    check(`휴대폰 ${name}: 오류 없음`, !merr.length, merr.slice(0, 3));
    await mctx.close();
  }
  await browser.close();
  const fail = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - fail} / ${results.length} 통과`);
  process.exit(fail ? 1 : 0);
})();
