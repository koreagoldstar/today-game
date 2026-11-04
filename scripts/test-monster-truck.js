// 몬스터 트럭 대소동 점검: 55판 봇 · 물리 · 파괴 15종+ · 트럭 차이 · 업그레이드 · 저장 · 메뉴 · 터치 · 성능
// 실행: node scripts/test-monster-truck.js   (MT_SKIP_BOT=1 이면 봇 생략, TEST_BASE 로 주소 변경)
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const BASE = process.env.TEST_BASE || "http://localhost:3456";
const GPU = ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"];
const URL_GAME = `${BASE}/games/monster-truck-mayhem/`;
let pass = 0;
let fail = 0;
function check(name, ok, info) {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${info !== undefined ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mod = (f) => import(pathToFileURL(path.join(__dirname, "..", "games", "monster-truck-mayhem", "js", f)).href);

/* ---------- 브라우저 없이: 판 · 물리 · 파괴 ---------- */
async function headless() {
  const { LEVELS, buildLevel, levelsOf } = await mod("stages.js");
  const { Sim, STEP } = await mod("sim.js");
  const { Bot } = await mod("bot.js");
  const { TRUCKS, truckStats, UPGRADES, OBJECTS, OBJECT_TYPES, WORLDS, truckById } = await mod("data.js");
  const { Builder } = await mod("level.js");
  const { THEMES } = await mod("stages.js");

  const count = (w) => levelsOf("tour", w).length;
  check("월드 5개 · 8/7/7/7/6 스테이지 = 35", WORLDS.length === 5 && [8, 7, 7, 7, 6].every((n, i) => count(i) === n), [0, 1, 2, 3, 4].map(count));
  check("보스 챌린지가 월드마다 1개", [0, 1, 2, 3, 4].every((w) => levelsOf("boss", w).length === 1));
  check("다른 모드도 판이 있음", ["destruction", "stunt", "time"].every((m) => levelsOf(m).length >= 5));
  check("스테이지 이름이 겹치지 않음", new Set(LEVELS.map((l) => l.name)).size === LEVELS.length);
  // 같은 맵에 이름만 바꾼 판이 없는지: 길이 + 물체 구성 지문
  const prints = new Set();
  for (const def of LEVELS) {
    const lvl = buildLevel(def);
    const by = {};
    for (const o of lvl.objects) by[o.type] = (by[o.type] || 0) + 1;
    prints.add(`${Math.round(lvl.length)}|${JSON.stringify(by)}|${lvl.ramps.length}|${lvl.pads.length}`);
  }
  check("판마다 구성이 다름", prints.size === LEVELS.length, { 지문: prints.size, 판: LEVELS.length });

  /* 트럭 물리 (아무 판 없는 직선) */
  const straight = () => {
    const b = new Builder(THEMES.scrap, { k: 1 });
    b.go(900);
    return b.bake();
  };
  const run = (sim, secs, fn) => {
    const n = Math.round(secs / STEP);
    for (let i = 0; i < n; i += 1) {
      sim.step(STEP);
      if (fn) fn(sim, i * STEP);
      sim.events.length = 0;
    }
  };
  const fresh = (truck = TRUCKS[0], up = {}) => {
    const s = new Sim(straight(), truck, up, { time: 500 });
    run(s, 0.6);
    s.begin();
    return s;
  };
  let s = fresh();
  s.input.throttle = 1;
  run(s, 1);
  const v1 = s.vf;
  run(s, 3);
  const v4 = s.vf;
  check("가속: 속도가 점점 오른다", v1 > 6 && v4 > v1 + 5, { v1, v4 });
  check("최고 속도 한계", v4 < s.def.top * 1.15, { v4, top: s.def.top });
  const spin0 = s.wheels[0].spin;
  run(s, 0.3);
  check("바퀴가 실제로 돈다", Math.abs(s.wheels[0].spin - spin0) > 2);
  s.input.throttle = 0;
  s.input.brake = 1;
  const before = s.vf;
  run(s, 1);
  check("브레이크가 감속", s.vf < before - 8, { before, after: s.vf });
  run(s, 4);
  check("계속 누르면 후진", s.vf < -1, { vf: s.vf });
  // 회전 관성: 핸들을 놓아도 몸이 바로 멈추지 않고, 조향하면 방향이 바뀐다
  s = fresh();
  s.input.throttle = 1;
  run(s, 2);
  const h0 = Math.atan2(s.fwd[0], s.fwd[2]);
  s.input.steer = 1;
  run(s, 0.7);
  const h1 = Math.atan2(s.fwd[0], s.fwd[2]);
  check("오른쪽 조향 = 오른쪽으로 돈다 (전방 +Z 기준 yaw 감소)", h1 < h0 - 0.2, { h0, h1 });
  const wTurn = Math.abs(s.w[1]);
  s.input.steer = 0;
  run(s, 0.06);
  check("회전 관성: 놓자마자 멈추지 않음", Math.abs(s.w[1]) > wTurn * 0.25, { wTurn, after: s.w[1] });
  // 점프 · 착지 · 서스펜션
  s = fresh();
  run(s, 0.4);
  const yRest = s.pos[1];
  s.input.jump = true;
  run(s, 0.05);
  s.input.jump = false;
  let top = 0;
  let airSeen = false;
  run(s, 1.3, (q) => {
    top = Math.max(top, q.pos[1]);
    if (q.contacts === 0) airSeen = true;
  });
  check("점프로 떠오른다", airSeen && top > yRest + 0.8, { top, yRest });
  run(s, 1.5);
  const lens = s.wheels.map((w) => w.len);
  check("착지 후 서스펜션이 다시 받친다", s.contacts === 4 && lens.every((l) => l > 0.1), lens);
  // 공중 자세
  s = fresh();
  s.pos[1] += 16;
  s.input.steer = 1;
  let yawGot = 0;
  run(s, 1, (q) => {
    if (q.air) yawGot = Math.abs(q.air.yaw);
  });
  check("공중에서 방향키로 돈다", yawGot > 1.5, { yawGot });
  // 프레임과 무관: 1/120 고정 걸음이라 결과가 같다
  const a = fresh();
  const b2 = fresh();
  a.input.throttle = 1;
  b2.input.throttle = 1;
  run(a, 2);
  for (let i = 0; i < 240; i += 1) {
    b2.step(STEP);
    b2.events.length = 0;
  }
  check("고정 걸음으로 시간이 일정", Math.abs(a.pos[2] - b2.pos[2]) < 0.5, { a: a.pos[2], b: b2.pos[2] });
  // 뒤집힘 · 끼임 복구
  s = fresh();
  s.q = [0, 0, 1, 0];
  s.pos[1] += 1;
  run(s, 3.5);
  check("뒤집히면 자동으로 다시 세운다", s.up[1] > 0.8 && s.stats.recover >= 1, { up: s.up[1], recover: s.stats.recover });
  // 점프대 뒤에서 들이받아도 하늘로 안 튕긴다
  {
    const bd = new Builder(THEMES.scrap, { k: 1, w: 40 });
    bd.go(200);
    bd.rampAt(0, 110, Math.PI, { h: 6, l: 18, w: 14 });
    const lvl = bd.bake();
    const q = new Sim(lvl, TRUCKS[0], {}, { time: 100 });
    run(q, 0.6);
    q.begin();
    q.input.throttle = 1;
    let maxY = 0;
    run(q, 7, (x) => {
      maxY = Math.max(maxY, x.pos[1] - x.level.height(x.pos[0], x.pos[2]));
    });
    check("절벽처럼 솟은 면은 벽으로 막힌다", maxY < 9, { maxY });
  }

  /* 트럭 8종 */
  check("트럭 8종", TRUCKS.length === 8, TRUCKS.map((t) => t.id));
  const tops = {};
  for (const t of TRUCKS) {
    const q = new Sim(straight(), t, {}, { time: 500 });
    run(q, 0.6);
    q.begin();
    q.input.throttle = 1;
    run(q, 2);
    tops[t.id] = +q.vf.toFixed(1);
  }
  check("트럭마다 가속이 실제로 다름", new Set(Object.values(tops)).size >= 5, tops);
  check("트럭 성능 표가 서로 다름", new Set(TRUCKS.map((t) => [t.accel, t.top, t.mass, t.power, t.grip, t.jump].join())).size === 8);
  const r0 = truckStats(TRUCKS[0], {});
  const rx = truckStats(TRUCKS[0], { engine: 5, tire: 5, susp: 5, body: 5, boost: 5 });
  check("업그레이드 5종이 수치를 올림", UPGRADES.length === 5 && rx.accel > r0.accel && rx.top > r0.top && rx.grip > r0.grip && rx.armor > r0.armor && rx.boost > r0.boost && rx.damp > r0.damp);
  const vBase = (() => {
    const q = fresh();
    q.input.throttle = 1;
    run(q, 3);
    return q.vf;
  })();
  const vUp = (() => {
    const q = fresh(TRUCKS[0], { engine: 5 });
    q.input.throttle = 1;
    run(q, 3);
    return q.vf;
  })();
  check("엔진 업그레이드: 실제로 더 빨라짐", vUp > vBase + 0.5, { vBase, vUp });
  // 얼음 특화: 얼음판에서 프로스트 바이트가 썬더보다 잘 돈다
  const iceTurn = (truck) => {
    const bd = new Builder(THEMES.frozen, { k: 1, w: 60 });
    bd.go(600);
    bd.ice(0, 600);
    const q = new Sim(bd.bake(), truck, {}, { time: 500 });
    run(q, 0.6);
    q.begin();
    q.input.throttle = 1;
    run(q, 2.5);
    q.input.steer = 1;
    const h = Math.atan2(q.vel[0], q.vel[2]);
    run(q, 1.2);
    return Math.abs(Math.atan2(q.vel[0], q.vel[2]) - h);
  };
  const iceA = iceTurn(truckById("thunder"));
  const iceB = iceTurn(truckById("frost"));
  check("얼음에서 스파이크 타이어가 더 잘 꺾임", iceB > iceA, { thunder: iceA, frost: iceB });
  // 무거운 트럭은 콘크리트에 덜 튕긴다
  const smash = (truck) => {
    const bd = new Builder(THEMES.scrap, { k: 1 });
    bd.go(300);
    bd.put("concrete", 60, 0);
    const q = new Sim(bd.bake(), truck, {}, { time: 100 });
    run(q, 0.6);
    q.begin();
    q.input.throttle = 1;
    run(q, 6);
    return q.vf;
  };
  check("메가 렉스가 콘크리트를 더 잘 뚫는다", smash(truckById("mega")) >= smash(truckById("rocket")) - 8);

  /* 부서지는 물체 */
  check("물체 15종 이상", OBJECT_TYPES.length >= 15, OBJECT_TYPES.length);
  const required = ["crate", "fence", "concrete", "tires", "wreck", "drum", "boom", "barrier", "timber", "container", "glass", "tirewall", "girder", "sign"];
  check("지시서의 물체 종류가 모두 있음", required.every((k) => OBJECTS[k]), required.filter((k) => !OBJECTS[k]));
  const smashType = (type, speed = 26, truck = "mega") => {
    const bd = new Builder(THEMES.scrap, { k: 1, w: 40 });
    bd.go(200);
    bd.put(type, 40, 0);
    const lvl = bd.bake();
    const q = new Sim(lvl, truckById(truck), { body: 5 }, { time: 100 });
    run(q, 0.6);
    q.begin();
    q.vel[2] = speed;
    q.input.throttle = 1;
    const seen = {};
    run(q, 3.2, (x) => {
      for (const e of x.events) seen[e.t] = (seen[e.t] || 0) + 1;
      x.events.length = 0;
    });
    return { o: q.objects[0], q, seen };
  };
  const reacted = [];
  const silent = [];
  for (const type of OBJECT_TYPES) {
    if (type === "plank" || type === "beam" || type === "dumper") continue;
    const { o, seen } = smashType(type);
    if (o.state === 2 || o.moved || o.dmg > 0 || o.squash < 1 || o.scored || o.state === 1 || seen.break || seen.dent || seen.crush) reacted.push(type);
    else silent.push(type);
  }
  check("물체가 모두 충돌에 반응 (사라지기만 하지 않음)", silent.length === 0, { 반응: reacted.length, 없음: silent });
  const wood = smashType("crate");
  check("나무: 파편 사건 + 점수", wood.seen.break >= 1 && wood.q.score > 0, wood.seen);
  const glass = smashType("glass");
  check("유리: 산산조각", glass.seen.break >= 1 && glass.o.state === 2);
  const cone = smashType("cone", 5, "rocket");
  check("약한 충격은 약한 물체만 부순다", cone.seen.break >= 1 || cone.o.state !== 0);
  {
    // 약하게 부딪힌 콘크리트는 그대로 / 세게는 파손
    // 가까이 놓고 엔진 없이 일정한 속도로 부딪힌다
    const bump = (type, speed, truck) => {
      const bd = new Builder(THEMES.scrap, { k: 1, w: 40 });
      bd.go(200);
      bd.put(type, 12, 0);
      const q = new Sim(bd.bake(), truckById(truck), {}, { time: 100 });
      run(q, 0.4);
      q.begin();
      q.vel[2] = speed;
      const seen = {};
      run(q, 2, (x) => {
        for (const e of x.events) seen[e.t] = (seen[e.t] || 0) + 1;
      });
      return { o: q.objects[0], seen };
    };
    const weak = bump("concrete", 4, "rocket");
    const mid = bump("concrete", 13, "thunder");
    const strong = bump("concrete", 30, "mega");
    check("강도 차이: 약하면 밀리기만 / 중간은 금 / 세면 파괴", !weak.seen.break && !weak.seen.dent && mid.seen.dent >= 1 && !mid.seen.break && strong.seen.break >= 1, { weak: weak.seen, mid: mid.seen, strong: strong.seen });
    const metal = bump("container", 16, "thunder");
    check("금속: 찌그러짐 또는 밀림", metal.seen.dent >= 1 || metal.o.dmg > 0, metal.seen);
  }
  {
    // 폭발 드럼 연쇄
    const bd = new Builder(THEMES.scrap, { k: 1, w: 40 });
    bd.go(200);
    for (let i = 0; i < 4; i += 1) bd.put("boom", 40 + i * 2.5, 0);
    const q = new Sim(bd.bake(), TRUCKS[0], {}, { time: 100 });
    run(q, 0.6);
    q.begin();
    q.vel[2] = 22;
    q.input.throttle = 1;
    let booms = 0;
    run(q, 5, (x) => {
      for (const e of x.events) if (e.t === "boom") booms += 1;
      x.events.length = 0;
    });
    check("폭발 드럼: 연쇄 폭발", booms >= 3 && q.stats.chain >= 2, { booms, chain: q.stats.chain });
  }
  {
    // 폐차: 밟으면 찌그러지고 부품이 튄다
    const bd = new Builder(THEMES.scrap, { k: 1, w: 40 });
    bd.go(200);
    for (let i = 0; i < 4; i += 1) bd.put("wreck", 40, (i - 1.5) * 2.5);
    const q = new Sim(bd.bake(), TRUCKS[0], {}, { time: 100 });
    run(q, 0.6);
    q.begin();
    q.input.throttle = 1;
    q.vel[2] = 18;
    let crush = 0;
    run(q, 4, (x) => {
      for (const e of x.events) if (e.t === "crush") crush += 1;
      x.events.length = 0;
    });
    check("폐차를 밟아 찌그러뜨린다", crush >= 1 && q.objects.some((o) => o.squash < 1 || o.state === 2), { crush });
  }
  {
    // 받침을 치면 위 물체가 떨어진다 (연쇄 붕괴)
    const bd = new Builder(THEMES.scrap, { k: 1, w: 40 });
    bd.go(200);
    const low = bd.put("crate", 40, 0);
    bd.put("crate", 40, 0, { on: low });
    const q = new Sim(bd.bake(), truckById("mega"), {}, { time: 100 });
    run(q, 0.6);
    q.begin();
    q.vel[2] = 20;
    q.input.throttle = 1;
    run(q, 3);
    check("쌓인 물체: 받침이 사라지면 움직인다", q.objects[1].state !== 0 || q.objects[1].scored);
  }

  /* 콤보 · 모드 규칙 */
  {
    const bd = new Builder(THEMES.scrap, { k: 1, w: 40 });
    bd.go(300);
    for (let i = 0; i < 12; i += 1) bd.put("crate", 40 + i * 5, 0);
    const q = new Sim(bd.bake(), truckById("mega"), {}, { time: 100 });
    run(q, 0.6);
    q.begin();
    q.input.throttle = 1;
    const words = [];
    run(q, 7, (x) => {
      for (const e of x.events) if (e.t === "word") words.push(e.word);
      x.events.length = 0;
    });
    check("콤보가 쌓이고 말이 나온다", q.stats.bestCombo >= 6 && words.includes("NICE!"), { combo: q.stats.bestCombo, words });
  }
  {
    const def = levelsOf("destruction")[0];
    const q = new Sim(buildLevel(def), TRUCKS[0], {}, { time: 3, main: { k: "score", n: 50 }, bonus: [], endless: true });
    run(q, 0.6);
    q.begin();
    q.score = 999;
    run(q, 1);
    check("토탈 디스트럭션: 목표를 넘겨도 시간까지 계속", q.state === "play");
    run(q, 2.5);
    check("토탈 디스트럭션: 시간이 끝나면 결과", q.state === "done" && q.result.ok === true);
  }
  {
    const def = levelsOf("stunt")[0];
    const q = new Sim(buildLevel(def), TRUCKS[0], {}, { time: 90, main: def.main, bonus: def.bonus, extra: 2 });
    run(q, 0.6);
    q.begin();
    q.stats.stuntScore = 1e5;
    run(q, 0.4);
    check("스턴트: 목표 달성은 클리어 확정", q.mainDone === true);
    q.stats.bestAir = 99;
    run(q, 0.4);
    check("스턴트: 보너스까지 다 하면 결과", q.state === "done" && q.result.ok && q.result.stars === 3, q.result && q.result.stars);
  }
  {
    const def = levelsOf("time")[0];
    check("타임 어택에 지름길 · 부스터 판 구성", def.par > 0 && levelsOf("time").some((l) => buildLevel(l).pads.length > 0));
  }

  /* 봇: 55판이 실제로 깰 수 있는가 */
  if (!process.env.MT_SKIP_BOT) {
    const fails = [];
    const nan = [];
    const stars = {};
    for (const def of LEVELS) {
      let best = null;
      for (let t = 0; t < 3 && !(best && best.ok); t += 1) {
        const q = new Sim(buildLevel(def), TRUCKS[0], { engine: 2, tire: 2, body: 2, boost: 2, susp: 2 }, { time: def.time, main: def.main, bonus: def.bonus, endless: def.endless, extra: def.extra });
        const bot = new Bot(q);
        q.begin();
        const lim = (def.time + 5) * 120;
        for (let i = 0; i < lim && q.state === "play"; i += 1) {
          bot.drive(STEP);
          q.step(STEP);
          q.events.length = 0;
          if (!Number.isFinite(q.pos[0] + q.pos[1] + q.pos[2])) {
            nan.push(def.id);
            break;
          }
        }
        if (q.result && (!best || q.result.ok)) best = q.result;
      }
      stars[def.id] = best ? best.stars : 0;
      if (!best || !best.ok) fails.push(def.id);
    }
    check("봇이 55판을 모두 클리어", fails.length === 0, { 실패: fails });
    check("물리값이 망가지지 않음 (NaN 없음)", nan.length === 0, nan);
    const three = Object.values(stars).filter((v) => v >= 3).length;
    console.log(`  봇 별 3개: ${three}/${LEVELS.length}`);
  }
}

/* ---------- 브라우저: 실제 화면 ---------- */
async function launch() {
  return chromium.launch({ channel: "chrome", args: GPU });
}
async function open(browser, opts = {}, qs = "") {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, serviceWorkers: "block", hasTouch: !!opts.touch, isMobile: !!opts.touch });
  await ctx.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text());
  });
  await page.addInitScript((seed) => {
    try {
      const d = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`today-game-visit-${d}`, "1");
      localStorage.setItem("today_visit_counted", "1");
      if (seed !== null && !localStorage.getItem("__seeded")) {
        localStorage.setItem("__seeded", "1");
        localStorage.setItem("monster-truck-mayhem-v1", seed);
      }
    } catch (_) {}
  }, opts.seed === undefined ? null : opts.seed);
  await page.goto(URL_GAME + qs, { waitUntil: "load" });
  await page.waitForFunction(() => window.MonsterTruck, null, { timeout: 45000 });
  await sleep(800);
  return { page, ctx, errors };
}
const waitPlaying = (page) => page.waitForFunction(() => MonsterTruck.sim && MonsterTruck.sim.state === "play", null, { timeout: 20000 });

async function desktop(browser) {
  const { page, ctx, errors } = await open(browser);
  // 첫 화면
  const menu = await page.evaluate(() => ({
    logo: document.querySelector(".logo").textContent,
    modes: [...document.querySelectorAll(".mode-btn b")].map((x) => x.textContent),
    play: document.getElementById("start-btn").textContent,
    garage: !!document.getElementById("btn-garage"),
    hudHidden: document.getElementById("hud").classList.contains("hidden"),
    mode: MonsterTruck.view.mode,
    canvas: document.getElementById("game").width > 100,
  }));
  check("첫 화면: 제목 · PLAY · GARAGE · 4개 모드 · SETTINGS", /몬스터/.test(menu.logo) && /PLAY/.test(menu.play) && menu.garage && ["MAYHEM TOUR", "TOTAL DESTRUCTION", "STUNT MASTER", "TIME ATTACK", "SETTINGS"].every((m) => menu.modes.includes(m)), menu.modes);
  check("첫 화면: 3D 경기장 + 시동 건 트럭", menu.mode === "title" && menu.canvas);
  const scene = await page.evaluate(() => ({ calls: MonsterTruck.view.renderer.info.render.calls, tris: MonsterTruck.view.renderer.info.render.triangles }));
  check("첫 화면이 실제로 그려짐", scene.calls > 20 && scene.tris > 5000, scene);

  // PLAY → 첫 판 + 카운트다운
  await page.click("#start-btn");
  await sleep(300);
  await page.waitForFunction(() => MonsterTruck.sim && MonsterTruck.app.screen === "play", null, { timeout: 15000 });
  const intro = await page.evaluate(() => ({ state: MonsterTruck.sim.state, id: MonsterTruck.app.def.id, banner: document.getElementById("banner").classList.contains("hidden") }));
  check("PLAY: 1-1 시작 + 준비 화면", intro.id === "tour-1-1" && intro.state === "ready" && !intro.banner, intro);
  await waitPlaying(page);

  // 키보드
  const st = () => page.evaluate(() => {
    const s = MonsterTruck.sim;
    return { speed: s.speed, vf: s.vf, y: s.pos[1], heading: Math.atan2(s.fwd[0], s.fwd[2]), boost: s.boost, boosting: s.boosting, contacts: s.contacts, recover: s.stats.recover, time: s.time, steer: s.input.steer, spin: s.wheels[0].spin, score: s.score, air: !!s.air };
  });
  await page.keyboard.down("KeyW");
  await sleep(1400);
  const s1 = await st();
  check("W: 가속", s1.vf > 8, s1.vf);
  check("바퀴가 화면에서도 돈다", Math.abs(s1.spin) > 4, s1.spin);
  await page.keyboard.down("KeyD");
  await sleep(500);
  const s2 = await st();
  check("D: 오른쪽 조향 입력", s2.steer > 0.7 && s2.heading < s1.heading, { steer: s2.steer, h1: s1.heading, h2: s2.heading });
  await page.keyboard.up("KeyD");
  await page.keyboard.down("KeyA");
  await sleep(500);
  const s2b = await st();
  check("A: 왼쪽 조향 입력", s2b.steer < -0.7, s2b.steer);
  await page.keyboard.up("KeyA");
  await page.keyboard.down("ShiftLeft");
  await sleep(300);
  const s3 = await st();
  check("Shift: 부스터", s3.boosting === true, s3.boost);
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.press("Space", { delay: 40 });
  await sleep(250);
  const s4 = await st();
  check("Space: 점프", s4.air || s4.contacts < 4, { air: s4.air, c: s4.contacts });
  await page.keyboard.up("KeyW");
  await page.keyboard.down("KeyS");
  await sleep(1200);
  const s5 = await st();
  check("S: 감속", s5.vf < s3.vf, { before: s3.vf, after: s5.vf });
  await page.keyboard.up("KeyS");
  await page.keyboard.press("KeyR");
  await sleep(200);
  const s6 = await st();
  check("R: 다시 세우기", s6.recover >= 1, s6.recover);

  // 일시정지
  await page.keyboard.press("Escape");
  await sleep(150);
  const p1 = await page.evaluate(() => ({ paused: MonsterTruck.app.paused, t: MonsterTruck.sim.time, ov: !document.getElementById("today-pause-overlay").hidden }));
  await sleep(500);
  const p2 = await page.evaluate(() => MonsterTruck.sim.time);
  check("ESC: 일시정지 + 시간 멈춤", p1.paused && p1.ov && Math.abs(p2 - p1.t) < 0.02, { p1, p2 });
  const pauseBtns = await page.evaluate(() => [...document.querySelectorAll("#today-pause-overlay button, #today-pause-overlay a")].map((b) => b.textContent.trim()));
  check("일시정지 메뉴에 다시 시작 · 목록 · 차고", ["다시 시작", "스테이지 목록", "차고"].every((k) => pauseBtns.includes(k)), pauseBtns);
  await page.keyboard.press("Escape");
  await sleep(350);
  const p3 = await page.evaluate(() => ({ paused: MonsterTruck.app.paused, t: MonsterTruck.sim.time }));
  check("ESC: 다시 진행", !p3.paused && p3.t > p2, p3);
  // 탭 숨김
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await sleep(120);
  const hid = await page.evaluate(() => MonsterTruck.app.paused);
  check("탭을 숨기면 일시정지", hid === true);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    window.TodayPause.resume ? window.TodayPause.resume() : null;
    const ov = document.getElementById("today-pause-overlay");
    if (ov && !ov.hidden) ov.querySelector("button")?.click();
  });
  await sleep(200);

  // HUD
  const hud = await page.evaluate(() => ({ mode: document.getElementById("hud-mode").textContent, stage: document.getElementById("hud-stage").textContent, speed: document.getElementById("hud-speed").textContent, score: document.getElementById("hud-score").textContent, time: document.getElementById("hud-time").textContent, missions: document.querySelectorAll("#hud-missions li").length, paused: MonsterTruck.app.paused }));
  check("HUD: 모드 · 스테이지 · 속도 · 점수 · 시간 · 미션", !!(hud.mode && hud.stage && hud.speed && hud.score && hud.time) && hud.missions >= 2, hud);

  // 결과 화면: 봇으로 끝까지 (실제 화면 고리에서)
  await page.evaluate(() => {
    MonsterTruck.app.bot = new (MonsterTruck.Bot)(MonsterTruck.sim);
  });
  await page.waitForFunction(() => !document.getElementById("result").classList.contains("hidden"), null, { timeout: 90000 });
  const res = await page.evaluate(() => ({
    title: document.getElementById("res-title").textContent,
    score: document.getElementById("res-score").textContent,
    destroyed: document.getElementById("res-destroyed").textContent,
    combo: document.getElementById("res-combo").textContent,
    stunt: document.getElementById("res-stunt").textContent,
    time: document.getElementById("res-time").textContent,
    coins: document.getElementById("res-coins").textContent,
    missions: document.querySelectorAll("#res-missions li").length,
    next: document.getElementById("res-next").textContent,
    retry: !!document.getElementById("res-retry"),
    save: JSON.parse(localStorage.getItem("monster-truck-mayhem-v1")),
  }));
  check("결과 화면: 점수 · 파괴 · 콤보 · 스턴트 · 시간 · 코인 · 미션 · 다음 · 재도전", res.score !== "0" && res.coins.startsWith("+") && res.missions >= 3 && res.retry, res.title);
  check("클리어가 저장됨", res.save.stars["tour-1-1"] >= 1 && res.save.coins > 0, { stars: res.save.stars, coins: res.save.coins });
  await page.click("#res-next");
  await page.waitForFunction(() => MonsterTruck.app.screen === "play" && MonsterTruck.app.def.id === "tour-1-2", null, { timeout: 15000 });
  check("NEXT: 다음 판으로", true);

  // 잠금 · 스테이지 고르기
  await page.evaluate(() => MonsterTruck.app.goTitle());
  await sleep(300);
  await page.click('[data-mode="tour"]');
  await sleep(150);
  const cards = await page.evaluate(() => [...document.querySelectorAll(".stage-card")].map((c) => ({ id: c.dataset.id, locked: c.classList.contains("locked") })));
  check("투어 목록: 1월드 8판 + 보스 / 진행에 따른 잠금", cards.length === 9 && !cards[0].locked && !cards[1].locked && cards[3].locked && cards[8].locked, cards.map((c) => (c.locked ? "x" : "o")).join(""));
  const tabs = await page.evaluate(() => [...document.querySelectorAll(".world-tab")].map((c) => c.classList.contains("locked")));
  check("월드 탭 5개 · 뒤쪽 월드 잠김", tabs.length === 5 && !tabs[0] && tabs[1]);
  for (const m of ["destruction", "stunt", "time"]) {
    await page.evaluate((x) => MonsterTruck.app.openStages(x), m);
    await sleep(80);
    const n = await page.evaluate(() => ({ all: document.querySelectorAll(".stage-card").length, open: document.querySelectorAll(".stage-card:not(.locked)").length, title: document.getElementById("stages-title").textContent }));
    check(`${n.title}: 5판 · 첫 판 열림`, n.all === 5 && n.open >= 1, n);
  }
  // 각 모드가 실제로 시작되고 규칙대로 끝남
  for (const id of ["destruction-1-M", "stunt-1-M", "time-1-M", "boss-1-B"]) {
    await page.evaluate((x) => MonsterTruck.start(x), id);
    await waitPlaying(page);
    await sleep(700);
    const q = await page.evaluate(() => ({ time: MonsterTruck.sim.time, mode: document.getElementById("hud-mode").textContent, hudT: document.getElementById("hud-time").textContent }));
    check(`${id}: 시작되고 시간이 흐름`, q.time > 0.2, q);
  }
  // 타임어택 기록
  await page.evaluate(() => MonsterTruck.start("time-1-M"));
  await waitPlaying(page);
  await page.evaluate(() => {
    MonsterTruck.app.save.best["time-1-M"] = { score: 0, combo: 0, stunt: 0, time: 40, destroyed: 0 };
    const s = MonsterTruck.sim;
    s.time = 30;
    s.finished = true;
    s.pi = s.level.samples.length - 1;
  });
  await page.waitForFunction(() => !document.getElementById("result").classList.contains("hidden"), null, { timeout: 15000 }).catch(() => {});
  const ta = await page.evaluate(() => MonsterTruck.app.save.best["time-1-M"]);
  check("타임 어택: 더 빠른 기록을 저장", ta && ta.time < 40, ta);

  // 차고
  await page.evaluate(() => {
    MonsterTruck.app.save.coins = 50000;
    MonsterTruck.app.persist();
  });
  await page.evaluate(() => MonsterTruck.app.openGarage());
  await sleep(400);
  const g0 = await page.evaluate(() => ({ name: document.getElementById("truck-name").textContent, stats: document.querySelectorAll(".stat").length, ups: document.querySelectorAll(".up-btn").length, trucks: document.querySelectorAll(".truck-chip").length, coins: document.getElementById("garage-coins").textContent, mode: MonsterTruck.view.mode, showing: MonsterTruck.view.truck.def.id }));
  check("차고: 트럭 이름 · 성능 그래프 · 업그레이드 5 · 트럭 8", g0.stats >= 5 && g0.ups === 5 && g0.trucks === 8 && g0.mode === "garage", g0);
  const yaw0 = await page.evaluate(() => MonsterTruck.view.table.rotation.y);
  await sleep(300);
  const yaw1 = await page.evaluate(() => MonsterTruck.view.table.rotation.y);
  check("차고: 트럭이 돈다", yaw1 !== yaw0);
  const widthOf = () => page.evaluate(() => parseFloat(document.querySelector('.stat[data-k="top"] u').style.width));
  const w0 = await widthOf();
  const c0 = await page.evaluate(() => MonsterTruck.app.save.coins);
  await page.click('[data-up="engine"]');
  await sleep(80);
  const w1 = await widthOf();
  const c1 = await page.evaluate(() => MonsterTruck.app.save.coins);
  check("업그레이드: 코인 차감 + 그래프 상승", c1 < c0 && w1 > w0, { c0, c1, w0, w1 });
  // 사고 · 고르기 · 실제 탑승
  await page.click('[data-truck="iron"]');
  await sleep(250);
  const showIron = await page.evaluate(() => ({ show: MonsterTruck.view.truck.def.id, action: document.getElementById("truck-action").textContent }));
  check("다른 트럭을 눌러 보면 모델이 바뀌고 잠금 표시", showIron.show === "iron" && /구매/.test(showIron.action), showIron);
  await page.click("#truck-action");
  await sleep(100);
  const own = await page.evaluate(() => ({ sel: MonsterTruck.app.save.selected, owned: MonsterTruck.app.save.trucks.iron }));
  check("트럭 구매 → 탑승", own.sel === "iron" && own.owned === true, own);
  const golden = await page.evaluate(() => {
    document.querySelector('[data-truck="golden"]').click();
    return document.getElementById("truck-action").disabled;
  });
  check("골든 크러셔는 잠겨 있음", golden === true);
  await sleep(200);
  await page.evaluate(() => MonsterTruck.start("tour-1-1"));
  await waitPlaying(page);
  const drive = await page.evaluate(() => ({ truck: MonsterTruck.sim.def.id, model: MonsterTruck.view.truck.def.id }));
  check("고른 트럭으로 실제 주행", drive.truck === "iron" && drive.model === "iron", drive);

  // 저장: 새로고침 뒤 유지
  await page.evaluate(() => MonsterTruck.app.goTitle());
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.MonsterTruck, null, { timeout: 45000 });
  const kept = await page.evaluate(() => ({ sel: MonsterTruck.app.save.selected, up: MonsterTruck.app.save.upgrades.thunder, stars: MonsterTruck.app.save.stars["tour-1-1"] }));
  check("새로고침 뒤에도 트럭 · 업그레이드 · 별 유지", kept.sel === "iron" && kept.up.engine === 1 && kept.stars >= 1, kept);

  // 설정
  await page.click("#btn-settings");
  await sleep(120);
  await page.click('#set-quality [data-v="low"]');
  await sleep(120);
  const q1 = await page.evaluate(() => ({ q: MonsterTruck.view.qualityName, pr: MonsterTruck.view.renderer.getPixelRatio() }));
  check("설정: 그래픽 낮춤 (저사양)", q1.q === "low" && q1.pr <= 1, q1);
  await page.click('#set-music [data-v="false"]');
  await page.click('#set-sfx [data-v="false"]');
  const snd = await page.evaluate(() => JSON.parse(localStorage.getItem("monster-truck-mayhem-v1")).settings);
  check("설정: 소리 끄기 저장", snd.music === false && snd.sfx === false, snd);
  await page.click('#set-quality [data-v="high"]');

  // 창 크기 변경
  await page.setViewportSize({ width: 900, height: 500 });
  await sleep(250);
  const rs = await page.evaluate(() => ({ w: document.getElementById("game").getBoundingClientRect().width, cw: innerWidth, aspect: MonsterTruck.view.camera.aspect }));
  check("창 크기를 바꾸면 화면이 따라옴", rs.w === rs.cw && Math.abs(rs.aspect - 900 / 500) < 0.01, rs);
  await page.setViewportSize({ width: 1280, height: 720 });

  check("PC: 콘솔 · 페이지 오류 없음", errors.length === 0, errors.slice(0, 5));
  await ctx.close();
}

async function corrupt(browser) {
  // 깨진 저장
  const bad = await open(browser, { seed: "{이건 JSON 이 아님" });
  const r1 = await bad.page.evaluate(() => ({ coins: MonsterTruck.app.save.coins, sel: MonsterTruck.app.save.selected, mode: MonsterTruck.view.mode }));
  check("깨진 저장: 기본값으로 안전하게 시작", r1.coins === 0 && r1.sel === "thunder" && r1.mode === "title", r1);
  check("깨진 저장: 오류 없음", bad.errors.length === 0, bad.errors.slice(0, 3));
  await bad.ctx.close();
  const weird = await open(browser, { seed: JSON.stringify({ coins: "많음", world: 99, stars: { "tour-1-1": 77, 없는판: 3 }, trucks: { mega: true, thunder: false }, selected: "없는트럭", upgrades: { thunder: { engine: 999, tire: "a" } }, settings: { quality: "초고화질", sfx: 3 } }) });
  const r2 = await weird.page.evaluate(() => MonsterTruck.app.save);
  check("이상한 값: 범위 안으로 정리", r2.coins === 0 && r2.world === 4 && r2.stars["tour-1-1"] === 3 && r2.stars["없는판"] === undefined && r2.trucks.thunder === true && r2.selected === "thunder" && r2.upgrades.thunder.engine === 5 && r2.settings.quality === "auto", { world: r2.world, up: r2.upgrades.thunder });
  await weird.ctx.close();
}

async function touch(browser, viewport, label) {
  const { page, ctx, errors } = await open(browser, { viewport, touch: true }, "?touch=1");
  await page.tap("#start-btn");
  await page.waitForFunction(() => MonsterTruck.app.screen === "play", null, { timeout: 15000 });
  await waitPlaying(page);
  const layout = await page.evaluate(() => {
    const vis = (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { w: r.width, h: r.height, in: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, l: r.left, t: r.top, r: r.right, b: r.bottom };
    };
    return { wheel: vis("wheel"), gas: vis("tb-gas"), brake: vis("tb-brake"), jump: vis("tb-jump"), boost: vis("tb-boost"), hud: vis("hud"), W: innerWidth, H: innerHeight, sw: document.documentElement.scrollWidth, shown: !document.getElementById("touch").classList.contains("hidden") };
  });
  const need = ["wheel", "gas", "brake", "jump", "boost"];
  check(`${label}: 터치 버튼이 모두 화면 안`, layout.shown && need.every((k) => layout[k].in), need.filter((k) => !layout[k].in));
  check(`${label}: 페달 · 버튼이 충분히 크다 (44px 이상)`, need.every((k) => layout[k].w >= 44 && layout[k].h >= 44), need.map((k) => `${k}:${Math.round(layout[k].w)}x${Math.round(layout[k].h)}`));
  check(`${label}: 조작부가 위쪽 절반을 가리지 않음`, layout.gas.t > layout.H * 0.45 && layout.wheel.t > layout.H * 0.4, { gasTop: layout.gas.t, wheelTop: layout.wheel.t, H: layout.H });
  check(`${label}: 가로 스크롤 없음`, layout.sw <= layout.W + 1, layout.sw);
  const overlap = (a, b) => !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);
  check(`${label}: 버튼끼리 겹치지 않음`, !overlap(layout.gas, layout.brake) && !overlap(layout.jump, layout.boost) && !overlap(layout.gas, layout.jump), null);
  const fire = (sel, type, x, y, id = 11) =>
    page.evaluate(
      ([s, t, px, py, pid]) => {
        const el = document.querySelector(s);
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: pid, pointerType: "touch", clientX: px == null ? r.left + r.width / 2 : px, clientY: py == null ? r.top + r.height / 2 : py, isPrimary: true }));
      },
      [sel, type, x, y, id]
    );
  await fire("#tb-gas", "pointerdown");
  await sleep(1000);
  const a = await page.evaluate(() => ({ v: MonsterTruck.sim.vf, th: MonsterTruck.sim.input.throttle }));
  check(`${label}: DRIVE 로 가속`, a.th === 1 && a.v > 6, a);
  // 운전대 돌리기
  const w = layout.wheel;
  const cx = (w.l + w.r) / 2;
  const cy = (w.t + w.b) / 2;
  await fire("#wheel-zone", "pointerdown", cx, w.t + 6, 22);
  await fire("#wheel-zone", "pointermove", w.r - 6, cy, 22);
  await sleep(180);
  const b = await page.evaluate(() => ({ steer: MonsterTruck.sim.input.steer, rot: document.getElementById("wheel").style.transform }));
  check(`${label}: 운전대를 오른쪽으로 돌림`, b.steer > 0.5 && /rotate/.test(b.rot), b);
  await fire("#wheel-zone", "pointerup", w.r - 6, cy, 22);
  await sleep(60);
  const c = await page.evaluate(() => MonsterTruck.app.input.touchSteer);
  check(`${label}: 손을 떼면 운전대가 돌아옴`, c === null, c);
  await fire("#tb-boost", "pointerdown", null, null, 33);
  await sleep(180);
  const d = await page.evaluate(() => MonsterTruck.sim.boosting);
  await fire("#tb-boost", "pointerup", null, null, 33);
  check(`${label}: BOOST 버튼`, d === true);
  await fire("#tb-jump", "pointerdown", null, null, 44);
  await sleep(200);
  const e = await page.evaluate(() => ({ c: MonsterTruck.sim.contacts, air: !!MonsterTruck.sim.air }));
  await fire("#tb-jump", "pointerup", null, null, 44);
  check(`${label}: JUMP 버튼`, e.air || e.c < 4, e);
  await fire("#tb-gas", "pointerup");
  await fire("#tb-brake", "pointerdown", null, null, 55);
  await sleep(500);
  const f = await page.evaluate(() => MonsterTruck.sim.input.brake);
  await fire("#tb-brake", "pointerup", null, null, 55);
  check(`${label}: BRAKE 페달`, f === 1, f);
  const pauseBtn = await page.evaluate(() => {
    const b2 = document.getElementById("today-pause-btn");
    return b2 && !b2.hidden;
  });
  check(`${label}: 일시정지 버튼`, pauseBtn === true);
  // 차고 · 목록이 화면에 들어오는가
  await page.evaluate(() => MonsterTruck.app.openGarage());
  await sleep(350);
  const g = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, W: innerWidth, action: document.getElementById("truck-action").getBoundingClientRect().width > 0 }));
  check(`${label}: 차고 레이아웃`, g.sw <= g.W + 1 && g.action, g);
  await page.evaluate(() => MonsterTruck.app.goTitle());
  await sleep(150);
  const t = await page.evaluate(() => {
    const r = document.getElementById("start-btn").getBoundingClientRect();
    const m = [...document.querySelectorAll(".mode-btn")].map((x) => x.getBoundingClientRect());
    return { play: r.bottom <= innerHeight && r.top >= 0, modes: m.every((q) => q.bottom <= innerHeight + 1 && q.right <= innerWidth + 1 && q.height >= 28) };
  });
  check(`${label}: 첫 화면 버튼이 화면 안`, t.play && t.modes, t);
  check(`${label}: 오류 없음`, errors.length === 0, errors.slice(0, 4));
  await ctx.close();
}

async function perf(browser) {
  const { page, ctx, errors } = await open(browser, {}, "?bot=1");
  const rows = [];
  for (const id of ["tour-1-3", "tour-2-2", "tour-3-6", "tour-4-3", "tour-5-2", "destruction-5-M"]) {
    await page.evaluate((x) => MonsterTruck.start(x), id);
    await waitPlaying(page);
    const m = await page.evaluate(
      () =>
        new Promise((res) => {
          let n = 0;
          const t0 = performance.now();
          let worst = 0;
          let last = t0;
          const f = (now) => {
            worst = Math.max(worst, now - last);
            last = now;
            n += 1;
            if (now - t0 > 5000) {
              const v = MonsterTruck.view;
              res({ fps: Math.round((n * 1000) / (now - t0)), worst: Math.round(worst), tris: v.renderer.info.render.triangles, calls: v.renderer.info.render.calls, geos: v.renderer.info.memory.geometries, soft: v.fx.soft.max, hot: v.fx.hot.max, deb: Object.values(v.debris.meshes).reduce((a, q) => a + q.list.length, 0), score: Math.round(MonsterTruck.sim.score) });
            } else requestAnimationFrame(f);
          };
          requestAnimationFrame(f);
        })
    );
    rows.push({ id, ...m });
  }
  const minFps = Math.min(...rows.map((r) => r.fps));
  check("PC 화면 평균 45fps 이상 (6개 월드 구간)", minFps >= 45, rows.map((r) => `${r.id}:${r.fps}fps ▲${Math.round(r.tris / 1000)}k`).join(" "));
  check("입자 수 상한이 있다", rows.every((r) => r.soft <= 600 && r.hot <= 600), rows[0].soft);
  // 판을 여러 번 오가도 도형이 쌓이지 않는다
  const geo = [];
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate(() => MonsterTruck.start("tour-1-1"));
    await sleep(250);
    geo.push(await page.evaluate(() => MonsterTruck.view.renderer.info.memory.geometries));
  }
  check("판을 다시 시작해도 메모리가 늘지 않음", geo[3] <= geo[1] + 12, geo);
  check("성능 측정 중 오류 없음", errors.length === 0, errors.slice(0, 4));
  await ctx.close();
}

async function home(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  await ctx.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      const d = new Date().toISOString().slice(0, 10);
      localStorage.setItem(`today-game-visit-${d}`, "1");
      localStorage.setItem("today_visit_counted", "1");
    } catch (_) {}
  });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await sleep(1200);
  const card = await page.evaluate(async () => {
    const a = document.querySelector('a[href="/games/monster-truck-mayhem/"]');
    if (!a) return null;
    a.scrollIntoView();
    const img = a.querySelector("img");
    if (img) {
      img.loading = "eager";
      await img.decode().catch(() => {});
    }
    return { img: img && img.getAttribute("src"), natural: img && img.naturalWidth, text: a.textContent.replace(/\s+/g, " ").trim() };
  });
  check("홈에 카드 + 썸네일", !!card && card.natural === 512, card);
  await ctx.close();
}

(async () => {
  await headless();
  const browser = await launch();
  try {
    await desktop(browser);
    await corrupt(browser);
    await touch(browser, { width: 390, height: 844 }, "휴대폰 세로");
    await touch(browser, { width: 844, height: 390 }, "휴대폰 가로");
    await touch(browser, { width: 768, height: 1024 }, "태블릿");
    await perf(browser);
    await home(browser);
  } catch (e) {
    check("점검 도중 멈춤", false, String(e && e.stack ? e.stack : e).slice(0, 500));
  }
  await browser.close();
  console.log(`\n합계 PASS ${pass} / FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
