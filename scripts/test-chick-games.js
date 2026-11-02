/*
 * 스피드 삐약이 · 드리프트 삐약이 · 삐약이 건너기 점검
 *  node scripts/test-chick-games.js  (로컬 서버 3456 필요)
 *  - 봇이 반응 시간을 두고 전 스테이지를 끝까지 깰 수 있는지 (불공평한 판 찾기)
 *  - 그림이 또렷하게 그려지는지 (캔버스 해상도) · 옛 그림 요청 없음
 *  - 저장 · 이어하기 · 일시정지 · 하트 · 휴대폰 화면 배치
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3456";
let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${extra ? ` — ${extra}` : ""}`);
}

async function openPage(browser, game, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 420, height: 800 }, deviceScaleFactor: opts.dpr || 1, hasTouch: Boolean(opts.touch), isMobile: Boolean(opts.touch), serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  const bad = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) bad.push(`${r.status()} ${r.url()}`);
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/games/${game}/`);
  return { ctx, page, errs, bad };
}

/* ---------- 스피드 삐약이 봇: 0.12초마다 판단, 앞에 차 없는 차선으로 한 칸씩 ---------- */
const RACE_BOT = `
window.raceBot = function (stage) {
  const G = window.SpeedChick;
  G.startStage(stage);
  let t = 0;
  let think = 0;
  let guard = 0;
  let minHearts = 3;
  const dt = 1 / 60;
  while (guard < 60 * 300) {
    guard += 1;
    G.update(dt);
    const s = G.s;
    minHearts = Math.min(minHearts, s.hearts);
    if (s.state === "clear" || s.state === "over") return { stage, state: s.state, hearts: s.hearts, secs: Math.round(guard / 60) };
    if (s.state !== "play") continue;
    think -= dt;
    if (think > 0) continue;
    think = 0.12;
    const danger = (lane) => {
      let d = 0;
      for (const e of s.enemies) {
        if (e.hit) continue;
        const cx = 58 + (274 / 3) * (lane + 0.5);
        const inLane = Math.abs(e.x - cx) < 66 || (e.changer >= 1 && e.to === lane);
        if (!inLane) continue;
        if (e.y > s.y - 240 && e.y < s.y + 76) d = Math.max(d, 1 + (e.y - (s.y - 240)) / 300);
      }
      return d;
    };
    const cur = s.target;
    const scores = [0, 1, 2].map((l) => danger(l) * 10 + Math.abs(l - cur) * 0.4);
    let best = cur;
    for (const l of [0, 1, 2]) if (scores[l] < scores[best] - 0.2) best = l;
    if (best !== cur) G.moveLane(best > cur ? 1 : -1);
  }
  return { stage, state: "timeout", hearts: minHearts };
};
`;

/* ---------- 드리프트 봇: 0.25초 늦게 커브 쪽을 누름 ---------- */
const DRIFT_BOT = `
window.driftBot = function (target) {
  const D = window.DriftChick;
  D.start();
  const dt = 1 / 60;
  const delay = Math.round(0.25 / dt);
  const hist = [];
  let guard = 0;
  let hits = 0;
  let lastHearts = 3;
  while (guard < 60 * 400) {
    guard += 1;
    D.update(dt);
    const s = D.s;
    if (s.hearts < lastHearts) {
      hits += 1;
      lastHearts = s.hearts;
    }
    if (s.state !== "play") return { dist: Math.round(s.dist), state: s.state, hits, score: Math.round(s.score), maxCombo: s.maxCombo };
    if (s.dist >= target) return { dist: Math.round(s.dist), state: "done", hits, score: Math.round(s.score), maxCombo: s.maxCombo, themeI: s.themeI };
    hist.push(s.curve);
    const c = hist[Math.max(0, hist.length - 1 - delay)];
    if (Math.abs(c) > 0.0065) D.input(true, Math.sign(c));
    else D.input(false, 0);
  }
  return { state: "timeout" };
};
window.driftIdle = function () {
  const D = window.DriftChick;
  D.start();
  const dt = 1 / 60;
  let guard = 0;
  while (guard < 60 * 120) {
    guard += 1;
    D.update(dt);
    if (D.s.state !== "play") return { state: D.s.state, dist: Math.round(D.s.dist) };
  }
  return { state: "alive", dist: Math.round(D.s.dist) };
};
`;

/* ---------- 건너기 봇: 앞이 안전할 때 뜀, 위험하면 비킴 ---------- */
const CROSS_BOT = `
window.crossBot = function (stage) {
  const C = window.CrossyChick;
  C.startStage(stage);
  const dt = 1 / 60;
  let guard = 0;
  let wait = 0;
  const after = (lane, e, t) => e.x + lane.v * t;
  const roadSafe = (lane, x, t0, t1) => {
    for (const e of lane.ents) {
      for (let t = t0; t <= t1; t += 0.05) {
        const ex = after(lane, e, t);
        if (x + 0.8 + 0.12 > ex && x + 0.2 - 0.12 < ex + e.w) return false;
      }
    }
    return true;
  };
  const landSafe = (z, x) => {
    const lane = C.laneAt(z);
    if (lane.type === "grass") return !C.treeAt(lane, x);
    if (lane.type === "road") return roadSafe(lane, Math.round(x), 0, C.HOP + 0.2);
    if (lane.type === "rail") return !lane.train && !lane.warn && lane.timer > 1.4;
    if (lane.type === "river") {
      for (const e of lane.ents) {
        const ex = after(lane, e, C.HOP);
        if (x + 0.72 > ex && x + 0.28 < ex + e.w) {
          const rest = x - ex;
          return rest >= -0.1 && rest <= e.w - 0.9 + 0.1;
        }
      }
      return false;
    }
    return false;
  };
  const inDanger = (z, x) => {
    const lane = C.laneAt(z);
    if (lane.type === "road") return !roadSafe(lane, x, 0, 0.32);
    if (lane.type === "rail") return lane.warn || Boolean(lane.train);
    if (lane.type === "river") return (lane.v < 0 && x < 1.4) || (lane.v > 0 && x > C.COLS - 2.4);
    return false;
  };
  while (guard < 60 * 420) {
    guard += 1;
    C.update(dt);
    const s = C.s;
    if (s.state === "clear" || s.state === "over" || s.state === "all") return { stage, state: s.state, hearts: s.hearts, secs: Math.round(guard / 60), goal: s.goal };
    if (s.state === "finish") {
      C.finishNow();
      continue;
    }
    if (s.state !== "play" || s.hop) continue;
    wait -= dt;
    if (wait > 0) continue;
    wait = 0.08 + Math.random() * 0.1; // 사람의 판단 시간 (매번 조금씩 다름)
    const x = s.x;
    const z = s.z;
    const danger = inDanger(z, x);
    const forwardX = C.laneAt(z + 1).type === "river" ? x : Math.round(x);
    if (forwardX >= 0 && forwardX <= C.COLS - 1 && landSafe(z + 1, forwardX)) {
      C.tryMove(0, 1);
      continue;
    }
    const lane = C.laneAt(z);
    const next = C.laneAt(z + 1);
    const opts = [];
    const staticBlock = (c) => (next.type === "grass" && next.trees.includes(c)) || (next.lily && !next.ents.some((e) => e.x === c));
    if (lane.type !== "river" && staticBlock(Math.round(x))) {
      // 다음 줄이 나무 · 연잎 때문에 막히면 지나갈 수 있는 칸 쪽으로
      const here = lane.type === "grass" ? lane.trees : [];
      let target = null;
      for (const dir of [-1, 1]) {
        for (let c = Math.round(x) + dir; c >= 0 && c < C.COLS; c += dir) {
          if (here.includes(c)) break;
          if (!staticBlock(c) && (target == null || Math.abs(c - x) < Math.abs(target - x))) target = c;
        }
      }
      if (target != null) opts.push(target > x ? 1 : -1);
      else if (z > 0 && landSafe(z - 1, Math.round(x))) {
        C.tryMove(0, -1);
        continue;
      }
    }
    // 위험하면 먼저 뒤 풀밭으로 물러남 (찻길을 따라 옆으로 걷다 가장자리에서 잡히지 않게)
    if (danger && z > 0 && lane.type !== "river" && C.laneAt(z - 1).type === "grass" && landSafe(z - 1, Math.round(x))) {
      C.tryMove(0, -1);
      continue;
    }
    if (danger) opts.push(x < C.COLS / 2 ? 1 : -1, x < C.COLS / 2 ? -1 : 1);
    let moved = false;
    for (const dx of opts) {
      const nx = lane.type === "river" ? x + dx : Math.round(x) + dx;
      if (nx < 0 || nx > C.COLS - 1) continue;
      if (landSafe(z, nx)) {
        C.tryMove(dx, 0);
        moved = true;
        break;
      }
    }
    if (!moved && danger && z > 0) {
      const backX = C.laneAt(z - 1).type === "river" ? x : Math.round(x);
      if (backX >= 0 && backX <= C.COLS - 1 && landSafe(z - 1, backX)) C.tryMove(0, -1);
    }
  }
  return { stage, state: "timeout", hearts: C.s.hearts, z: C.s.z, goal: C.s.goal };
};
`;

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });

  /* ---------- 스피드 삐약이 ---------- */
  console.log("\n[스피드 삐약이]");
  {
    const { ctx, page, errs, bad } = await openPage(browser, "racing");
    await page.waitForFunction(() => window.SpeedChick, null, { timeout: 20000 });
    await page.waitForTimeout(300);
    const hero = await page.evaluate(() => {
      const im = document.querySelector("#title .hero");
      const c = document.createElement("canvas");
      c.width = c.height = 16;
      const g = c.getContext("2d");
      g.drawImage(im, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data;
      let magenta = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] < 60 && d[i + 2] > 220) magenta += 1;
      return { w: im.naturalWidth, magenta };
    });
    check("첫 화면 그림에 분홍 네모가 없다", hero.magenta === 0 && hero.w >= 384, JSON.stringify(hero));
    const params = await page.evaluate(() => {
      const G = window.SpeedChick;
      return [0, 24, 49].map((i) => G.params(i));
    });
    check("뒤로 갈수록 빠르다", params[0].speed < params[1].speed && params[1].speed < params[2].speed, params.map((p) => p.speed.toFixed(2)).join(" < "));
    await page.evaluate(RACE_BOT);
    const results = [];
    for (let i = 0; i < 50; i += 1) {
      let r = await page.evaluate((k) => window.raceBot(k), i);
      let tries = 1;
      while (r.state !== "clear" && r.state !== "all" && tries < 3) {
        r = await page.evaluate((k) => window.raceBot(k), i);
        tries += 1;
      }
      r.tries = tries;
      results.push(r);
    }
    const cleared = results.filter((r) => r.state === "clear" || r.state === "all");
    check("한 번에 깨는 스테이지가 대부분", results.filter((r) => r.tries === 1).length >= 44, `${results.filter((r) => r.tries === 1).length}/50`);
    const fails = results.filter((r) => r.state !== "clear" && r.state !== "all");
    check("봇이 50스테이지를 모두 깬다", fails.length === 0, `${cleared.length}/50 ${fails.slice(0, 5).map((r) => `#${r.stage + 1}:${r.state}`).join(" ")}`);
    const avg = results.reduce((a, r) => a + (r.hearts || 0), 0) / results.length;
    check("봇이 대부분 무사히 지나간다 (피할 틈이 있음)", avg >= 2, `평균 하트 ${avg.toFixed(2)}`);
    const secs = results.map((r) => r.secs || 0);
    check("스테이지 길이가 적당하다", Math.min(...secs) >= 10 && Math.max(...secs) <= 60, `${Math.min(...secs)}~${Math.max(...secs)}초`);
    // 저장
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("speed-bbaek-save")));
    check("진행이 저장된다", saved && saved.stage >= 49, JSON.stringify({ stage: saved && saved.stage }));
    await page.reload();
    await page.waitForFunction(() => window.SpeedChick);
    check("이어서 달리기가 나온다", (await page.textContent("#start-btn")).includes("이어서"), await page.textContent("#start-btn"));
    await page.click("#start-btn");
    await page.waitForFunction(() => window.SpeedChick.s.state === "play", null, { timeout: 8000 });
    const before = await page.evaluate(() => window.SpeedChick.s.stageDist);
    await page.waitForTimeout(350);
    const running = await page.evaluate(() => window.SpeedChick.s.stageDist);
    check("실제 화면에서 달린다", running > before);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(80);
    check("방향키로 차선을 바꾼다", (await page.evaluate(() => window.SpeedChick.s.target)) === 2);
    // 일시정지 후 다시
    await page.click(".today-pause-btn");
    await page.waitForTimeout(120);
    const a = await page.evaluate(() => window.SpeedChick.s.stageDist);
    await page.waitForTimeout(300);
    const b = await page.evaluate(() => window.SpeedChick.s.stageDist);
    check("일시정지하면 멈춘다", a === b);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll(".today-pause-overlay button")].find((x) => /계속|이어|다시 시작/.test(x.textContent)) || document.querySelector(".today-pause-overlay button");
      btn.click();
    });
    await page.waitForTimeout(300);
    const c = await page.evaluate(() => window.SpeedChick.s.stageDist);
    check("다시 누르면 이어서 달린다", c > b);
    check("페이지 오류 없음", errs.length === 0, errs.slice(0, 2).join(" | "));
    check("없는 파일 요청 없음", bad.length === 0, bad.slice(0, 3).join(" | "));
    await ctx.close();
  }

  /* ---------- 드리프트 삐약이 ---------- */
  console.log("\n[드리프트 삐약이]");
  {
    const { ctx, page, errs, bad } = await openPage(browser, "drift-chick");
    await page.waitForFunction(() => window.DriftChick, null, { timeout: 20000 });
    await page.evaluate(DRIFT_BOT);
    const runs = [];
    for (let i = 0; i < 6; i += 1) runs.push(await page.evaluate(() => window.driftBot(6000)));
    check("0.25초 늦게 눌러도 6000m 를 간다", runs.every((r) => r.state === "done"), runs.map((r) => `${r.dist}m/${r.hits}회`).join(" "));
    check("맞게 누르면 거의 안 부딪힌다", runs.every((r) => r.hits <= 1), runs.map((r) => r.hits).join(","));
    check("풍경이 바뀌고 콤보가 쌓인다", runs[0].themeI != null && runs.every((r) => r.maxCombo >= 3), `콤보 ${runs.map((r) => r.maxCombo).join(",")}`);
    const idle = [];
    for (let i = 0; i < 3; i += 1) idle.push(await page.evaluate(() => window.driftIdle()));
    check("아무것도 안 누르면 코스 아웃된다 (긴장감 유지)", idle.every((r) => r.state === "over"), idle.map((r) => `${r.dist}m`).join(" "));
    await page.reload();
    await page.waitForFunction(() => window.DriftChick);
    await page.click("#start-btn");
    await page.waitForTimeout(400);
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(250);
    await page.keyboard.up("ArrowLeft");
    const before = await page.evaluate(() => window.DriftChick.s.dist);
    check("실제 화면에서 달린다", before > 0);
    // 예전엔 일시정지 뒤 화면이 멈췄음
    await page.click(".today-pause-btn");
    await page.waitForTimeout(150);
    const a = await page.evaluate(() => window.DriftChick.s.dist);
    await page.waitForTimeout(250);
    const b = await page.evaluate(() => window.DriftChick.s.dist);
    check("일시정지하면 멈춘다", a === b);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll(".today-pause-overlay button")].find((x) => /계속|이어|다시 시작/.test(x.textContent)) || document.querySelector(".today-pause-overlay button");
      btn.click();
    });
    await page.waitForTimeout(300);
    const c = await page.evaluate(() => window.DriftChick.s.dist);
    check("다시 누르면 이어서 달린다 (예전 버그)", c > b);
    check("페이지 오류 없음", errs.length === 0, errs.slice(0, 2).join(" | "));
    check("없는 파일 요청 없음", bad.length === 0, bad.slice(0, 3).join(" | "));
    await ctx.close();
  }

  /* ---------- 삐약이 건너기 ---------- */
  console.log("\n[삐약이 건너기]");
  {
    const { ctx, page, errs, bad } = await openPage(browser, "crossy");
    await page.waitForFunction(() => window.CrossyChick, null, { timeout: 20000 });
    const kinds = await page.evaluate(() => {
      const C = window.CrossyChick;
      const out = { road: 0, river: 0, rail: 0, grass: 0, lily: 0, bus: 0, wrongTree: 0 };
      for (const st of [0, 10, 25, 49]) {
        C.startStage(st);
        for (let z = 0; z < C.s.goal; z += 1) {
          const l = C.laneAt(z);
          out[l.type] += 1;
          if (l.lily) out.lily += 1;
          if (l.type === "road") for (const e of l.ents) if (e.kind === "bus") out.bus += 1;
          if (l.type === "grass" && l.trees.length > 4) out.wrongTree += 1;
        }
      }
      return out;
    });
    check("도로 · 강 · 선로 · 풀밭이 고루 나온다", kinds.road > 10 && kinds.river > 5 && kinds.rail > 1 && kinds.grass > 10, JSON.stringify(kinds));
    check("풀밭 한 줄이 나무로 막히지 않는다", kinds.wrongTree === 0);
    await page.evaluate(CROSS_BOT);
    const results = [];
    for (let i = 0; i < 50; i += 1) {
      let r = await page.evaluate((k) => window.crossBot(k), i);
      let tries = 1;
      while (r.state !== "clear" && r.state !== "all" && tries < 4) {
        r = await page.evaluate((k) => window.crossBot(k), i);
        tries += 1;
      }
      r.tries = tries;
      results.push(r);
    }
    const fails = results.filter((r) => r.state !== "clear" && r.state !== "all");
    console.log("     죽은 이유:", JSON.stringify(await page.evaluate(() => window.CrossyChick.deaths)));
    check("봇이 50스테이지를 모두 깬다", fails.length === 0, `${50 - fails.length}/50 ${fails.slice(0, 5).map((r) => `#${r.stage + 1}:${r.state}(${r.z}/${r.goal})`).join(" ")}`);
    const firstTry = results.filter((r) => r.tries === 1).length;
    check("대부분 한 번에 깬다", firstTry >= 40, `${firstTry}/50`);
    const avg = results.reduce((a, r) => a + (r.hearts || 0), 0) / results.length;
    check("하트가 적당히 남는다", avg >= 1.6, `평균 ${avg.toFixed(2)}`);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("crossy-save-v2")));
    check("진행이 저장된다", saved && saved.stage >= 49);
    await page.reload();
    await page.waitForFunction(() => window.CrossyChick);
    check("이어서 건너기가 나온다", (await page.textContent("#start-btn")).includes("이어서"));
    await page.evaluate(() => localStorage.removeItem("crossy-save-v2"));
    await page.reload();
    await page.waitForFunction(() => window.CrossyChick);
    await page.waitForTimeout(250);
    await page.click("#start-btn");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(260);
    const s1 = await page.evaluate(() => window.CrossyChick.s);
    check("방향키로 한 칸 뛴다", s1.z === 1 && s1.score === 10, JSON.stringify({ z: s1.z, score: s1.score }));
    const treeTest = await page.evaluate(() => {
      const C = window.CrossyChick;
      C.startStage(20);
      let z = 3;
      for (; z < 40; z += 1) if (C.laneAt(z).type === "grass" && C.laneAt(z).trees.length) break;
      return { z, tree: C.laneAt(z).trees[0], ok: C.treeAt(C.laneAt(z), C.laneAt(z).trees[0]) };
    });
    check("나무 칸을 알아본다", treeTest.ok);
    // 하트 줄고 다시 살아남
    const heart = await page.evaluate(async () => {
      const C = window.CrossyChick;
      C.startStage(0);
      const h0 = C.s.hearts;
      C.die("squish");
      const dying = C.s.state;
      for (let i = 0; i < 60; i += 1) C.update(1 / 60);
      return { h0, dying, after: C.s.hearts, state: C.s.state, inv: C.s.invT > 0 };
    });
    check("부딪히면 하트가 줄고 다시 시작한다", heart.h0 === 3 && heart.after === 2 && heart.dying === "dying" && heart.state === "play" && heart.inv, JSON.stringify(heart));
    check("페이지 오류 없음", errs.length === 0, errs.slice(0, 2).join(" | "));
    check("없는 파일 요청 없음", bad.length === 0, bad.slice(0, 3).join(" | "));
    await ctx.close();
  }

  /* ---------- 공통: 또렷함 · 휴대폰 ---------- */
  console.log("\n[또렷함 · 휴대폰 화면]");
  for (const [game, api, startSel, stateFn] of [
    ["racing", "SpeedChick", "#start-btn", "ready|play"],
    ["drift-chick", "DriftChick", "#start-btn", "play"],
    ["crossy", "CrossyChick", "#start-btn", "play"],
  ]) {
    for (const [name, w, h, dpr] of [["세로", 390, 844, 3], ["작은 세로", 360, 640, 2], ["가로", 780, 360, 2]]) {
      const { ctx, page, errs } = await openPage(browser, game, { viewport: { width: w, height: h }, dpr, touch: true });
      await page.waitForFunction((a) => window[a], api, { timeout: 20000 });
      await page.waitForTimeout(350);
      const chip = await page.evaluate(() => {
        const c = document.querySelector(".today-face-chip");
        const s = document.querySelector("#start-btn");
        return Boolean(c && s && c.nextElementSibling === s);
      });
      if (name === "세로") check(`${game}: 내 얼굴 버튼이 시작 위에 있다`, chip);
      await page.evaluate(() => {
        const t = document.getElementById("title");
        t.scrollTop = 0;
      });
      await page.locator(startSel).scrollIntoViewIfNeeded();
      await page.locator(startSel).tap();
      await page.waitForFunction(([a, re]) => new RegExp(re).test(window[a].s.state), [api, stateFn], { timeout: 6000 });
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => {
        const cv = document.getElementById("game").getBoundingClientRect();
        const c = document.getElementById("game");
        const inside = (el) => {
          if (!el) return true;
          const b = el.getBoundingClientRect();
          return b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        };
        const overlap = (a, b) => {
          if (!a || !b) return false;
          const p = a.getBoundingClientRect();
          const q = b.getBoundingClientRect();
          return p.left < q.right && p.right > q.left && p.top < q.bottom && p.bottom > q.top;
        };
        const hud = document.getElementById("hud");
        const mute = document.querySelector(".today-mute-btn");
        const pause = document.querySelector(".today-pause-btn");
        const pads = [...document.querySelectorAll(".pad-btn")];
        return {
          sharp: Math.abs(c.width - Math.round(cv.width * devicePixelRatio)) <= 1 && Math.abs(c.height - Math.round(cv.height * devicePixelRatio)) <= 1,
          buf: `${c.width}x${c.height}`,
          css: `${Math.round(cv.width)}x${Math.round(cv.height)}`,
          hud: inside(hud),
          pads: pads.every(inside),
          hudMute: overlap(hud, mute),
          hudPause: overlap(hud, pause),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      check(`${game} ${name}: 화면 픽셀대로 그려 또렷하다`, r.sharp, `${r.css} → ${r.buf}`);
      check(`${game} ${name}: 점수판 · 단추가 화면 안`, r.hud && r.pads && !r.overflow, JSON.stringify({ hud: r.hud, pads: r.pads, overflow: r.overflow }));
      check(`${game} ${name}: 점수판이 음소거 · 일시정지와 안 겹친다`, !r.hudMute && !r.hudPause, JSON.stringify({ mute: r.hudMute, pause: r.hudPause }));
      check(`${game} ${name}: 오류 없음`, errs.length === 0, errs.slice(0, 2).join(" | "));
      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\n결과: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
