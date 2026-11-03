// 펭귄 택배 대작전 점검: 45스테이지 봇 완주 · 물리 · 첫 30초 · 조작 · 저장 · 꾸미기 · 폰 화면 · 사이트 통합
// 실행: node scripts/test-penguin-delivery.js   (PD_SKIP_BOT=1 이면 봇 생략, TEST_BASE 로 주소 변경)
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const BASE = process.env.TEST_BASE || "http://localhost:3456";
const GPU = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
let pass = 0;
let fail = 0;
function check(name, ok, info) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${info !== undefined ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mod = (f) => import(pathToFileURL(path.join(__dirname, "..", "games", "penguin-delivery", "js", f)).href);

async function botAll() {
  const { makeCourse, WORLDS, worldStages, STAGE_COUNT } = await mod("stages.js");
  const { Sim } = await mod("sim.js");
  const { runBot } = await mod("bot.js");
  check("월드 5개 · 스테이지 40개 이상", WORLDS.length === 5 && STAGE_COUNT >= 40, { worlds: WORLDS.length, stages: STAGE_COUNT });
  const seen = new Set();
  const perWorld = [];
  const problems = [];
  let slowest = 0;
  const parBad = [];
  const signature = new Set();
  for (let w = 0; w < WORLDS.length; w += 1) {
    const types = new Set();
    worldStages(w).forEach((def, s) => {
      const label = `${w + 1}-${s + 1}`;
      const c = makeCourse(w, s);
      const kinds = [...new Set(c.pads.map((p) => p.kind).concat(c.objs.map((o) => o.type)).concat(c.zones.map((z) => z.type)).concat(c.holes.length ? ["hole"] : []).concat(c.P.some((q) => q.surf === "ice") ? ["ice"] : []))].sort();
      kinds.forEach((k) => {
        seen.add(k);
        types.add(k);
      });
      signature.add(`${c.length.toFixed(0)}:${kinds.join()}:${c.items.length}`);
      if (c.items.length < 3) problems.push(`${label} 아이템 부족`);
      if (!c.goal) problems.push(`${label} 도착 없음`);
      let wins = 0;
      let best = 1e9;
      const runs = 3;
      for (let r = 0; r < runs; r += 1) {
        const sim = new Sim(makeCourse(w, s), { seed: 5 + r * 37, intro: 0.2 });
        const res = runBot(sim, 600);
        if (sim.state === "delivering" || sim.state === "won") {
          wins += 1;
          best = Math.min(best, res.time);
          slowest = Math.max(slowest, res.time);
        }
      }
      if (wins === 0) problems.push(`${label} 봇 실패`);
      else if (best > c.par) parBad.push(`${label} ${best.toFixed(0)}>${c.par}`);
    });
    perWorld.push(types);
  }
  check("45개 스테이지 모두 봇이 끝까지 배달", problems.length === 0, problems.slice(0, 8));
  check("별 3개가 가능한 목표 시간 (봇 최고 기록 ≤ 목표)", parBad.length === 0, parBad.slice(0, 8));
  check("스테이지마다 구성이 다름 (복제 없음)", signature.size === STAGE_COUNT, { 다른구성: signature.size });
  const need = ["balls", "chaser", "mover", "plank", "vent", "rotor", "spring", "snowman", "hole", "crate", "seal", "icicle", "fox", "blizzard", "tunnel", "geyser", "windmill", "avalanche", "crumble", "vanish", "orbit", "magic", "wind", "floe", "bump", "pillar"];
  const miss = need.filter((k) => !seen.has(k));
  check("필수 장애물과 지형이 모두 있음", miss.length === 0, miss);
  for (let w = 1; w < perWorld.length; w += 1) {
    const prior = new Set();
    for (let k = 0; k < w; k += 1) perWorld[k].forEach((x) => prior.add(x));
    const fresh = [...perWorld[w]].filter((x) => !prior.has(x));
    check(`${WORLDS[w].name}: 앞 월드에 없던 새 요소`, fresh.length >= 1, fresh);
  }
  // 물리 단위 점검
  const { Sim: S2, SURF } = await mod("sim.js");
  const run = (surf) => {
    const c = makeCourse(0, 5);
    const sim = new S2(c, { intro: 0 });
    sim.tick(1 / 120);
    const P = c.P;
    const idx = P.findIndex((q) => q.surf === surf && q.solid && q.i > 8);
    const s = P[idx + 4];
    const p = sim.p;
    p.x = s.x;
    p.y = s.y;
    p.z = s.z;
    p.idx = s.i;
    p.vx = s.dx * 5.5;
    p.vz = s.dz * 5.5;
    p.grounded = true;
    p.surf = surf;
    sim.input.x = 0;
    sim.input.z = 0;
    let t = 0;
    while (Math.hypot(p.vx, p.vz) > 0.25 && t < 8) {
      sim.tick(1 / 120);
      t += 1 / 120;
    }
    return t;
  };
  const snowStop = run("snow");
  const iceStop = run("ice");
  check("얼음은 눈길보다 훨씬 오래 미끄러짐", iceStop > snowStop * 5, { 눈길초: +snowStop.toFixed(2), 얼음초: +iceStop.toFixed(2), 멈춤값: SURF.ice.brake });
  // 경사에서 택배가 굴러 내려감
  {
    const c = makeCourse(0, 0);
    const sim = new S2(c, { intro: 0 });
    sim.tick(1 / 120);
    const P = c.P;
    const slope = P.find((q) => q.solid && q.slope < -0.1 && q.surf === "ice");
    const b = sim.boxes[0];
    sim.p.stack.length = 0;
    b.state = "free";
    b.x = slope.x;
    b.z = slope.z;
    b.y = slope.y + 0.5;
    b.vx = b.vy = b.vz = 0;
    b.lock = 9;
    b.airb = true;
    const s0 = slope.s;
    for (let i = 0; i < 420; i += 1) sim.tick(1 / 120);
    const moved = P[c.nearest(b.x, b.z)].s - s0;
    check("택배가 경사로를 혼자 굴러 내려감", moved > 3, { 이동m: +moved.toFixed(1), 속도: +Math.hypot(b.vx, b.vz).toFixed(1) });
  }
  // 무게 차이
  {
    const speedOf = (kind) => {
      const c = makeCourse(0, 0);
      c.packs = [kind];
      const sim = new S2(c, { intro: 0 });
      sim.tick(1 / 120);
      sim.input.z = -1;
      for (let i = 0; i < 180; i += 1) sim.tick(1 / 120);
      return Math.hypot(sim.p.vx, sim.p.vz);
    };
    const n = speedOf("normal");
    const h = speedOf("heavy");
    check("무거운 택배는 눈에 띄게 느림", h < n * 0.9, { 일반: +n.toFixed(2), 무거움: +h.toFixed(2) });
  }
  // 고정 걸음: 화면 프레임 속도가 달라도 물리 결과가 같음
  {
    const go = (fps) => {
      const sim = new S2(makeCourse(0, 1), { intro: 0, seed: 3 });
      sim.update(0.01);
      sim.input.z = -1;
      const dt = 1 / fps;
      for (let t = 0; t < 4; t += dt) sim.update(dt);
      return sim.p.z;
    };
    const a = go(144);
    const b = go(30);
    check("프레임 속도와 무관한 물리", Math.abs(a - b) < 0.5, { fps144: +a.toFixed(2), fps30: +b.toFixed(2) });
  }
  console.log(`  봇 가장 느린 기록 ${slowest.toFixed(0)}초`);
}

async function browserChecks() {
  const browser = await chromium.launch({ channel: "chrome", args: GPU });
  const open = async (o = {}) => {
    const { url = "?q=mid", vp = { width: 1280, height: 720 }, touch = false, save = null, keepSave = false } = o;
    const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, serviceWorkers: "block" });
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
    if (!keepSave) {
      await page.addInitScript((v) => {
        try {
          if (!sessionStorage.getItem("pd-init")) {
            sessionStorage.setItem("pd-init", "1");
            localStorage.removeItem("penguin-delivery-v1");
            if (v) localStorage.setItem("penguin-delivery-v1", v);
          }
          sessionStorage.setItem("today_visit_counted", "1");
        } catch (_) {
          /* 없어도 됨 */
        }
      }, save);
    }
    await page.goto(`${BASE}/games/penguin-delivery/${url}`);
    await page.waitForFunction(() => window.PenguinDelivery && window.PenguinDelivery.screen !== "boot", null, { timeout: 30000 });
    await sleep(500);
    return page;
  };
  const st = (page) => page.evaluate(() => {
    const a = window.PenguinDelivery;
    const s = a.sim;
    if (!s) return { screen: a.screen };
    const p = s.p;
    return { screen: a.screen, state: s.state, clock: s.clock, x: p.x, y: p.y, z: p.z, v: Math.hypot(p.vx, p.vz), vy: p.vy, grounded: p.grounded, mode: p.mode, boxes: s.boxes.map((b) => b.state), stack: p.stack.length, catches: s.stats.catches, drops: s.stats.drops, fish: s.fish, progress: p.progress || 0, surf: p.surf, paused: a.paused };
  });

  /* ---------- 메인 화면 ---------- */
  const p = await open();
  const title = await p.evaluate(() => {
    const vis = (id) => {
      const el = document.getElementById(id);
      const r = el.getBoundingClientRect();
      return r.width > 10 && r.height > 10 && getComputedStyle(el).display !== "none";
    };
    return { h1: document.querySelector("#title h1").textContent, play: vis("start-btn"), worlds: vis("btn-worlds"), cos: vis("btn-costume"), rec: vis("btn-records"), snd: vis("btn-sound"), seo: Boolean(document.querySelector("#title .seo-about")), canvas: document.getElementById("game").width > 100, boot: document.getElementById("boot").classList.contains("hidden") };
  });
  check("메인 화면: 제목 · PLAY · 월드 · 꾸미기 · 기록 · 사운드", title.h1.includes("펭귄") && title.play && title.worlds && title.cos && title.rec && title.snd && title.canvas, title);
  check("소개 글이 첫 화면 안에 있음 · 불러오기 끝", title.seo && title.boot, title);
  const blink = await p.evaluate(async () => {
    const P = window.PenguinDelivery.penguin;
    const a = P.s.squash.x;
    await new Promise((r) => setTimeout(r, 500));
    return { before: a, after: P.s.squash.x, blinkT: P.blinkT };
  });
  check("메인 화면 펭귄이 숨 쉬듯 움직임", blink.before !== blink.after, blink);

  /* ---------- 첫 30초 ---------- */
  await p.click("#start-btn", { force: true });
  await p.waitForFunction(() => window.PenguinDelivery.sim && window.PenguinDelivery.sim.state === "play", null, { timeout: 8000 });
  const s0 = await st(p);
  check("PLAY 를 누르면 바로 1-1 시작", s0.screen === "play" && (await p.evaluate(() => window.PenguinDelivery.sim.c.label)) === "1-1", s0.screen);
  await p.keyboard.down("ArrowUp");
  let dropAt = null;
  let iceAt = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 28000) {
    await sleep(120);
    const s = await st(p);
    if (!iceAt && s.surf === "ice") iceAt = s.clock;
    if (s.drops > 0) {
      dropAt = s.clock;
      break;
    }
  }
  check("첫 30초: 얼음에 들어서고 택배가 떨어지는 순간까지 경험", iceAt !== null && dropAt !== null && dropAt < 25, { 얼음초: iceAt && +iceAt.toFixed(1), 떨어짐초: dropAt && +dropAt.toFixed(1) });
  const tipAfter = await p.evaluate(() => document.getElementById("tip").textContent);
  check("떨어지면 무엇을 할지 바로 알려 줌", /쫓아/.test(tipAfter), tipAfter);
  const pinOn = await p.evaluate(() => window.PenguinDelivery.view.pin.visible && window.PenguinDelivery.view.arrow.visible);
  check("떨어진 택배 위치 표시 (머리 위 화살표 · 바닥 화살표)", pinOn);
  // 쫓아가서 잡기: 앞으로 계속 + 대시
  let caught = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 16000) {
    const info = await p.evaluate(() => {
      const a = window.PenguinDelivery;
      const s = a.sim;
      const b = s.boxes[0];
      return { dx: b.x - s.p.x, dz: b.z - s.p.z, state: b.state };
    });
    if (info.state === "held") {
      caught = true;
      break;
    }
    await p.keyboard.press("ShiftLeft");
    await sleep(220);
  }
  check("쫓아가서 다시 잡음 (게임 오버 아님)", caught, await st(p));
  await p.keyboard.up("ArrowUp");
  await sleep(150);

  /* ---------- 키보드 조작 ---------- */
  const keys = await p.evaluate(() => window.PenguinDelivery.startStage(0, 1));
  void keys;
  await p.waitForFunction(() => window.PenguinDelivery.sim && window.PenguinDelivery.sim.c.label === "1-2" && window.PenguinDelivery.sim.state === "play", null, { timeout: 8000 });
  await sleep(200);
  const a0 = await st(p);
  await p.keyboard.down("KeyW");
  await sleep(500);
  const a1 = await st(p);
  check("W 로 앞으로 이동", a1.v > 2 && Math.hypot(a1.x - a0.x, a1.z - a0.z) > 1, { v: a1.v });
  await p.keyboard.up("KeyW");
  await p.keyboard.down("KeyA");
  await sleep(280);
  const a2 = await st(p);
  await p.keyboard.up("KeyA");
  check("A 로 왼쪽으로 이동", a2.x < a1.x - 0.2, { before: a1.x, after: a2.x });
  await sleep(250);
  await p.keyboard.down("Space");
  await sleep(160);
  const a3 = await st(p);
  await p.keyboard.up("Space");
  check("Space 로 점프", a3.y > a0.y + 0.2 || !a3.grounded, { y: a3.y, vy: a3.vy });
  await sleep(800);
  await p.keyboard.down("ArrowUp");
  await sleep(300);
  await p.keyboard.press("ShiftLeft");
  await sleep(70);
  const a4 = await st(p);
  check("Shift 로 배 미끄럼 대시", a4.mode === "slide" && a4.v > 7, { mode: a4.mode, v: a4.v });
  await p.keyboard.up("ArrowUp");
  // E 로 줍기
  const grabOk = await p.evaluate(() => {
    const a = window.PenguinDelivery;
    const s = a.sim;
    const b = s.p.stack[0];
    s.eject(b, 1, 0, "tip");
    b.x = s.p.x + 1.8;
    b.z = s.p.z;
    b.y = s.p.y + 0.4;
    b.vx = b.vy = b.vz = 0;
    b.lock = 0;
    b.airb = false;
    return true;
  });
  void grabOk;
  await sleep(30);
  await p.keyboard.press("KeyE");
  await sleep(120);
  const a5 = await st(p);
  check("E 로 택배 줍기", a5.stack === 1, a5.boxes);

  /* ---------- 일시정지 ---------- */
  await p.keyboard.press("Escape");
  await sleep(150);
  const b1 = await st(p);
  await sleep(350);
  const b2 = await st(p);
  const menu = await p.evaluate(() => ["today-pause-resume", "pause-restart", "pause-sound", "pause-worlds", "today-pause-home"].map((i) => {
    const el = document.getElementById(i);
    return el ? el.textContent.trim() : null;
  }));
  check("일시정지하면 시간이 멈춤", b1.paused && b1.clock === b2.clock, { a: b1.clock, b: b2.clock });
  check("일시정지 메뉴 5가지", menu.every(Boolean) && /계속/.test(menu[0]) && /재시작/.test(menu[1]) && /사운드/.test(menu[2]) && /월드/.test(menu[3]) && /나가기/.test(menu[4]), menu);
  await p.click("#pause-sound");
  await sleep(120);
  const sndOpen = await p.evaluate(() => !document.getElementById("sound").classList.contains("hidden"));
  check("일시정지에서 사운드 설정 열기", sndOpen);
  await p.click("#snd-close");
  await p.click("#today-pause-resume");
  await sleep(250);
  const b3 = await st(p);
  check("계속하기로 다시 진행", !b3.paused && b3.clock > b2.clock, { clock: b3.clock });
  await p.keyboard.press("Escape");
  await sleep(100);
  await p.click("#pause-restart");
  await p.waitForFunction(() => window.PenguinDelivery.sim && window.PenguinDelivery.sim.clock < 0.6, null, { timeout: 6000 });
  check("스테이지 재시작", true);

  /* ---------- 배달 · 별 · 다음 ---------- */
  const deliver = async (page, cond = 100, time = null) => {
    await sleep(260);
    await page.waitForFunction(() => window.PenguinDelivery.sim && window.PenguinDelivery.sim.state === "play", null, { timeout: 8000 });
    await page.evaluate(([c, t]) => {
      const s = window.PenguinDelivery.sim;
      const g = s.c.goal;
      for (const b of s.boxes) b.hp = c;
      if (t !== null) s.clock = s.par + t;
      s.p.x = g.x;
      s.p.y = g.y;
      s.p.z = g.z;
      s.p.idx = g.i;
      s.p.grounded = true;
    }, [cond, time]);
    await page.waitForFunction(() => window.PenguinDelivery.screen === "result", null, { timeout: 8000 });
    await sleep(1200);
  };
  await deliver(p);
  const r1 = await p.evaluate(() => ({ title: document.getElementById("res-title").textContent, stars: document.querySelectorAll("#res-stars i.on").length, score: document.getElementById("res-score").textContent, time: document.getElementById("res-time").textContent, cond: document.getElementById("res-cond").textContent, next: !document.getElementById("res-next").classList.contains("hidden"), retry: Boolean(document.getElementById("res-retry")), saved: JSON.parse(localStorage.getItem("penguin-delivery-v1")).best["1"] }));
  check("클리어 화면: 점수 · 별 · 시간 · 택배 상태 · 다음 · 다시", r1.title.includes("완료") && r1.stars === 3 && r1.score !== "0" && r1.next && r1.retry, r1);
  check("기록 저장", r1.saved && r1.saved.stars === 3);
  await p.click("#res-retry");
  await deliver(p, 40, 3);
  const r2 = await p.evaluate(() => ({ stars: document.querySelectorAll("#res-stars i.on").length, hint: document.getElementById("res-hint").textContent, best: JSON.parse(localStorage.getItem("penguin-delivery-v1")).best["1"].stars }));
  check("상태가 나쁘고 늦으면 별 1개 · 왜 그런지 알려 줌 · 최고 별은 유지", r2.stars === 1 && /상태/.test(r2.hint) && /시간/.test(r2.hint) && r2.best === 3, r2);
  await p.click("#res-next");
  await p.waitForFunction(() => window.PenguinDelivery.sim && window.PenguinDelivery.sim.c.label === "1-3", null, { timeout: 8000 });
  check("다음 스테이지로 이동", true);

  /* ---------- 실패 ---------- */
  await p.waitForFunction(() => window.PenguinDelivery.sim.state === "play", null, { timeout: 8000 });
  await p.evaluate(() => {
    const s = window.PenguinDelivery.sim;
    s.clock = s.limit - 0.02;
  });
  await p.waitForFunction(() => window.PenguinDelivery.screen === "fail", null, { timeout: 8000 });
  const f1 = await p.evaluate(() => ({ t: document.getElementById("fail-title").textContent, mode: window.PenguinDelivery.sim.p.mode }));
  check("시간이 끝나면 실패 화면 · 펭귄 실망 동작", /시간/.test(f1.t) && f1.mode === "sad", f1);
  await p.click("#fail-retry");
  await p.waitForFunction(() => window.PenguinDelivery.sim && window.PenguinDelivery.sim.clock < 0.5 && window.PenguinDelivery.screen === "play", null, { timeout: 8000 });
  check("실패 후 다시 도전", true);
  check("여기까지 콘솔 · 네트워크 오류 없음", p.errs.length === 0, p.errs.slice(0, 4));

  /* ---------- 월드 · 잠금 ---------- */
  await p.keyboard.press("Escape");
  await sleep(100);
  await p.click("#pause-worlds");
  await p.waitForFunction(() => window.PenguinDelivery.screen === "worlds", null, { timeout: 5000 });
  await sleep(350);
  const w1 = await p.evaluate(() => {
    const items = [...document.querySelectorAll("#stage-grid .st")];
    return { name: document.getElementById("world-name").textContent, n: items.length, done: items.filter((e) => e.classList.contains("done")).length, lock: items.filter((e) => e.classList.contains("lock")).length };
  });
  check("월드 선택: 깬 판과 잠긴 판 구분", w1.n === 9 && w1.done >= 1 && w1.lock >= 3, w1);
  await p.click("#world-next");
  await sleep(500);
  const w2 = await p.evaluate(() => ({ name: document.getElementById("world-name").textContent, locked: document.getElementById("worlds").classList.contains("locked"), sub: document.getElementById("world-sub").textContent, allLock: [...document.querySelectorAll("#stage-grid .st")].every((e) => e.classList.contains("lock")) }));
  check("다음 월드는 잠김 표시 · 여는 조건 안내", w2.name === "얼음 협곡" && w2.locked && w2.allLock && /열려요/.test(w2.sub), w2);
  await p.context().close();

  // 저장 + 월드 잠금 해제
  const fullW1 = {};
  for (let i = 0; i < 9; i += 1) fullW1[i] = { stars: 2, score: 2000, time: 30, cond: 80 };
  const u1 = await open({ save: JSON.stringify({ best: fullW1, fish: 5 }) });
  const un = await u1.evaluate(() => {
    const a = window.PenguinDelivery;
    return { w1: a.worldOpen(1), w2: a.worldOpen(2), label: document.getElementById("start-label").textContent, top: a.highestWorld() };
  });
  check("월드 1 을 다 깨고 별이 충분하면 월드 2 열림", un.w1 && !un.w2 && un.top === 1 && un.label.startsWith("2-1"), un);
  await u1.context().close();

  /* ---------- 저장 복구 ---------- */
  const bad = await open({ save: "{이건 망가진 저장" });
  const badOk = await bad.evaluate(() => {
    const a = window.PenguinDelivery;
    return { fish: a.save.fish, wear: a.save.wear, ok: a.screen === "title" };
  });
  check("저장이 망가져도 기본 상태로 복구", badOk.ok && badOk.fish === 0 && badOk.wear === "courier", badOk);
  await bad.context().close();
  const weird = await open({ save: JSON.stringify({ best: { 999: { stars: 3, score: 1 }, 0: { stars: "많이" }, 1: { stars: 9, score: 100 } }, fish: -50, wear: "없는옷", owned: ["없는옷"], music: 99 }) });
  const wOk = await weird.evaluate(() => {
    const s = window.PenguinDelivery.save;
    return { keys: Object.keys(s.best), stars: s.best[1] && s.best[1].stars, fish: s.fish, wear: s.wear, music: s.music };
  });
  check("이상한 저장값은 걸러 냄", wOk.keys.join() === "1" && wOk.stars === 3 && wOk.fish === 0 && wOk.wear === "courier" && wOk.music === 1, wOk);
  await weird.context().close();

  /* ---------- 꾸미기 · 저장 유지 ---------- */
  const c = await open({ save: JSON.stringify({ fish: 100, best: { 0: { stars: 1, score: 1500, time: 40, cond: 50 } } }) });
  await c.click("#btn-costume");
  await sleep(300);
  const items = await c.evaluate(() => [...document.querySelectorAll("#costume-list .cos")].map((e) => e.dataset.id));
  check("꾸미기 8종 + 기본", ["santa", "explorer", "space", "chef", "pirate", "crown", "bunny", "shades"].every((k) => items.includes(k)), items);
  await c.click('.cos[data-id="crown"]');
  await sleep(120);
  const c1 = await c.evaluate(() => ({ fish: window.PenguinDelivery.save.fish, wear: window.PenguinDelivery.save.wear, toast: document.getElementById("toast").textContent }));
  check("생선이 모자라면 못 삼 · 안내", c1.fish === 100 && c1.wear === "courier" && /더 필요/.test(c1.toast), c1);
  await c.click('.cos[data-id="chef"]');
  await sleep(120);
  const c2 = await c.evaluate(() => ({ fish: window.PenguinDelivery.save.fish, wear: window.PenguinDelivery.save.wear, on: document.querySelector(".cos.on").dataset.id, cos: window.PenguinDelivery.penguin.costume }));
  check("생선으로 사서 바로 입음", c2.fish === 10 && c2.wear === "chef" && c2.on === "chef" && c2.cos === "chef", c2);
  const allOk = await c.evaluate(() => {
    const P = window.PenguinDelivery.penguin;
    const ids = ["courier", "bunny", "shades", "chef", "santa", "explorer", "pirate", "space", "crown"];
    try {
      for (const id of ids) {
        P.setCostume(id);
        P.update(0.016, { mode: "run", speed: 3, grounded: true, carrying: 1 });
      }
      P.setCostume("chef");
      return true;
    } catch (e) {
      return String(e);
    }
  });
  check("모든 꾸미기 모델이 오류 없이 만들어짐", allOk === true, allOk);
  await c.click("#costume-back");
  // 사운드 저장
  await c.click("#btn-sound");
  await c.evaluate(() => {
    const m = document.getElementById("snd-music");
    m.value = 20;
    m.dispatchEvent(new Event("input"));
    const o = document.getElementById("snd-on");
    o.checked = false;
    o.dispatchEvent(new Event("change"));
  });
  await c.click("#snd-close");
  await c.reload();
  await c.waitForFunction(() => window.PenguinDelivery && window.PenguinDelivery.screen !== "boot", null, { timeout: 30000 });
  const c3 = await c.evaluate(() => {
    const s = window.PenguinDelivery.save;
    return { wear: s.wear, fish: s.fish, music: s.music, on: s.soundOn, best: s.best[0] && s.best[0].stars, cos: window.PenguinDelivery.penguin.costume };
  });
  check("새로고침해도 꾸미기 · 생선 · 소리 · 기록 유지", c3.wear === "chef" && c3.fish === 10 && Math.abs(c3.music - 0.2) < 0.01 && c3.on === false && c3.best === 1 && c3.cos === "chef", c3);
  await c.click("#btn-records");
  await sleep(200);
  const rec = await c.evaluate(() => ({ text: document.getElementById("records").innerText, worlds: document.querySelectorAll("#rec-worlds .rw").length }));
  check("도전 기록: 전체 · 월드별 진행률 · 재미있는 기록", rec.worlds === 5 && /전체 진행률/.test(rec.text) && /엉덩방아/.test(rec.text), rec.worlds);
  check("꾸미기 · 기록 오류 없음", c.errs.length === 0, c.errs.slice(0, 3));
  await c.context().close();

  /* ---------- 폰 화면 · 터치 ---------- */
  for (const [name, vp] of [["폰", { width: 390, height: 844 }], ["작은 폰", { width: 360, height: 640 }], ["폰 눕힘", { width: 844, height: 390 }]]) {
    const m = await open({ vp, touch: true, url: "?q=low" });
    const tt = await m.evaluate(() => {
      const r = document.getElementById("start-btn").getBoundingClientRect();
      const menu = document.getElementById("btn-sound").getBoundingClientRect();
      return { b: r.bottom, h: innerHeight, mb: menu.bottom, sw: document.documentElement.scrollWidth, w: innerWidth, big: r.height };
    });
    check(`${name}: 첫 화면 단추가 잘리지 않음`, tt.mb <= tt.h + 1 && tt.sw <= tt.w + 1 && tt.big >= 44, tt);
    await m.tap("#start-btn", { force: true });
    await m.waitForFunction(() => window.PenguinDelivery.sim && window.PenguinDelivery.sim.state === "play", null, { timeout: 10000 });
    await sleep(120);
    const ui = await m.evaluate(() => {
      const box = (id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
      };
      const over = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const jump = box("tc-jump");
      const dash = box("tc-dash");
      const hud = box("hud");
      const pause = document.getElementById("today-pause-btn").getBoundingClientRect();
      const mute = document.querySelector(".today-mute-btn").getBoundingClientRect();
      const P = { l: pause.left, t: pause.top, r: pause.right, b: pause.bottom };
      const M = { l: mute.left, t: mute.top, r: mute.right, b: mute.bottom };
      return { jump, dash, hudH: hud.h, hit: over(hud, P) || over(hud, M), jd: over(jump, dash), inScreen: jump.r <= innerWidth && jump.b <= innerHeight && dash.l >= 0, big: jump.w >= 70 && dash.w >= 56, pauseOk: pause.width >= 40 && pause.height >= 40 };
    });
    check(`${name}: 조이스틱 · 버튼이 엄지 크기 · 겹침 없음`, ui.big && ui.inScreen && !ui.jd && ui.pauseOk, ui);
    check(`${name}: 위쪽 정보가 일시정지 · 소리 단추와 안 겹침`, !ui.hit, { h: ui.hudH });
    // 조이스틱으로 이동
    const before = await st(m);
    const cdp = await m.context().newCDPSession(m);
    const sx = Math.round(vp.width * 0.2);
    const sy = Math.round(vp.height * 0.76);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy, id: 1 }] });
    await sleep(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: sx, y: sy - 60, id: 1 }] });
    await sleep(600);
    const moved = await st(m);
    check(`${name}: 조이스틱을 위로 밀면 앞으로 달림`, moved.v > 1.5 && Math.hypot(moved.x - before.x, moved.z - before.z) > 0.8, { v: moved.v });
    const jr = await m.evaluate(() => {
      const r = document.getElementById("tc-jump").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy - 60, id: 1 }, { x: Math.round(jr.x), y: Math.round(jr.y), id: 2 }] });
    await sleep(130);
    const jumped = await st(m);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    check(`${name}: 달리면서 점프 버튼 (두 손가락)`, !jumped.grounded, { y: jumped.y, vy: jumped.vy });
    // 눕히기 · 돌리기: 게임이 깨지지 않음
    await m.setViewportSize({ width: vp.height, height: vp.width });
    await sleep(350);
    const rs = await m.evaluate(() => {
      const a = window.PenguinDelivery;
      const c2 = document.getElementById("game");
      return { w: a.stage.w, h: a.stage.h, cw: c2.clientWidth, ch: c2.clientHeight, ia: innerWidth, ib: innerHeight };
    });
    check(`${name}: 화면을 돌려도 게임 화면이 맞춰짐`, rs.w === rs.ia && rs.h === rs.ib && rs.cw === rs.ia, rs);
    check(`${name}: 낮은 그래픽 오류 없음`, m.errs.length === 0, m.errs.slice(0, 3));
    await m.context().close();
  }

  /* ---------- 월드마다 그래픽 · 실제 렌더 ---------- */
  const g = await open({ url: "?q=high&intro=0&bot=1" });
  for (const [w, s] of [[0, 8], [1, 2], [2, 2], [3, 6], [4, 8]]) {
    await g.evaluate(([a, b]) => window.PenguinDelivery.startStage(a, b), [w, s]);
    await g.waitForFunction((lb) => window.PenguinDelivery.sim && window.PenguinDelivery.sim.c.label === lb && window.PenguinDelivery.sim.state === "play", `${w + 1}-${s + 1}`, { timeout: 12000 });
    await sleep(1500);
    const info = await g.evaluate(() => {
      const a = window.PenguinDelivery;
      const r = a.stage.renderer.info.render;
      const c = document.getElementById("game");
      const px = new Uint8Array(4);
      const gl = a.stage.renderer.getContext();
      a.stage.render();
      gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return { calls: r.calls, tris: r.triangles, px: [...px], t: a.sim.clock };
    });
    check(`${w + 1}-${s + 1} 그림이 실제로 그려짐 (삼각형 ${info.tris})`, info.tris > 2000 && info.px[3] === 255 && info.px[0] + info.px[1] + info.px[2] > 30, { calls: info.calls });
  }
  // FPS (이 PC 기준 참고값)
  const fps = await g.evaluate(async () => {
    let n = 0;
    const t0 = performance.now();
    await new Promise((res) => {
      const f = () => {
        n += 1;
        if (performance.now() - t0 < 2000) requestAnimationFrame(f);
        else res();
      };
      requestAnimationFrame(f);
    });
    return (n / (performance.now() - t0)) * 1000;
  });
  console.log(`  FPS(높음, 데스크톱 GPU): ${fps.toFixed(0)}`);
  check("높은 그래픽에서 30FPS 이상 (이 PC)", fps >= 30, { fps: +fps.toFixed(0) });
  check("그래픽 점검 오류 없음", g.errs.length === 0, g.errs.slice(0, 4));
  await g.context().close();

  /* ---------- 사이트 통합 ---------- */
  const h = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" })).newPage();
  await h.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await h.goto(`${BASE}/`);
  await sleep(1500);
  const home = await h.evaluate(async () => {
    const a = document.querySelector('a[href="/games/penguin-delivery/"]');
    const img = a && a.querySelector("img");
    if (img) {
      img.loading = "eager";
      img.scrollIntoView();
    }
    await new Promise((r) => setTimeout(r, 900));
    return { has: Boolean(a), name: a && a.textContent.includes("펭귄 택배 대작전"), w: img && img.naturalWidth, src: img && img.getAttribute("src"), cat: a && a.closest(".cat-shelf") && a.closest(".cat-shelf").id, first: a && a.parentElement.firstElementChild === a };
  });
  check("홈 목록에 카드 · 정사각 썸네일 512", home.has && home.name && home.w === 512, home);
  check("액션 칸 맨 위 (새 게임)", home.cat === "cat-action" && home.first, home);
  const others = ["/games/oneshot-elite/", "/games/memory/", "/games/penalty-kick/"];
  for (const u of others) {
    const r = await h.request.get(`${BASE}${u}`);
    check(`기존 게임 페이지 정상 ${u}`, r.ok());
  }
  const map = await (await h.request.get(`${BASE}/sitemap.xml`)).text();
  check("사이트맵에 등록", map.includes("/games/penguin-delivery/"));
  const page = await (await h.request.get(`${BASE}/games/penguin-delivery/`)).text();
  check("SEO 제목 · 설명 · OG 이미지 · 소개 글", /<title>펭귄 택배 대작전/.test(page) && /name="description"/.test(page) && /og:image" content="https:\/\/www\.todaygame\.co\.kr\/assets\/thumbs\/penguin-delivery\.png/.test(page) && /seo-about/.test(page));
  const og = await h.request.get(`${BASE}/assets/thumbs/penguin-delivery.png`);
  check("OG 그림 파일 있음", og.ok());
  await browser.close();
}

(async () => {
  if (!process.env.PD_SKIP_BOT) await botAll();
  if (!process.env.PD_ONLY_BOT) await browserChecks();
  console.log(`\n결과: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
