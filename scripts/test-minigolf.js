/*
 * 홀인원 골프 점검
 *  node scripts/test-minigolf.js  (로컬 서버 3456 필요)
 *  - 18홀 모두 봇이 끝까지 돌 수 있는지 (사람처럼 조금 빗맞게)
 *  - 파 기준에 맞는지 · 클럽 거리 · 물 / OB / 벙커 처리
 *  - 3번 탭 스윙 · 스코어카드 · 저장 · 이어하기 · 결과 화면 · 휴대폰 화면 배치
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

/* 페이지 안에서 돌리는 봇: 후보 샷을 물리로 끝까지 돌려 보고 제일 나은 것을 고른다 */
const BOT = `
window.botPlay = function (holeIndex, seed, errScale) {
  const G = window.GolfGame;
  const { CLUBS, GROUND, launchBall, puttBall, runToRest, PUTT_RANGES } = G.lib;
  G.swapHole(holeIndex);
  G.setupHole();
  G.state = "bot";
  const hole = G.hole;
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // 바람은 씨앗으로 고정 (점검 결과가 매번 같게)
  const windAngle = rnd() * Math.PI * 2;
  const windSpeed = (hole.def.wind[0] + rnd() * (hole.def.wind[1] - hole.def.wind[0])) * 0.6;
  const wind = { x: Math.sin(windAngle) * windSpeed, z: Math.cos(windAngle) * windSpeed };
  const pos = { x: hole.tee.x, y: hole.tee.y, z: hole.tee.z };
  let strokes = 0;
  let onTee = true;
  let last = { ...pos };
  const log = [];
  const yawTo = (x, z) => Math.atan2(x - pos.x, -(z - pos.z));
  const dist = () => Math.hypot(pos.x - hole.pin.x, pos.z - hole.pin.z);
  const cost = (b) => {
    if (b.result === "holed") return -50;
    if (b.result === "water" || b.result === "ob") return 500;
    const surf = hole.surface(b.x, b.z);
    const d = Math.hypot(b.x - hole.pin.x, b.z - hole.pin.z);
    const pen = { green: 0, fringe: 3, fairway: 4, first: 7, rough: 14, deep: 28, sand: 26, tee: 4 }[surf] ?? 10;
    return d + pen + (b.tree ? 12 : 0);
  };
  const trial = (club, yaw, power, range) => {
    const surf = onTee ? "tee" : hole.surface(pos.x, pos.z);
    let b;
    if (club.putter) b = puttBall(pos.x, pos.y, pos.z, yaw, range, power, 0, GROUND[surf].roll);
    else {
      const lie = GROUND[surf].lie * (club.id === "SW" && surf === "sand" ? 1.35 : 1);
      b = launchBall(pos.x, pos.y + (onTee ? 0.05 : 0), pos.z, yaw, club, power, lie, 0, 0);
    }
    runToRest(b, hole, wind, rnd);
    return b;
  };
  const planShot = () => {
    const d = dist();
    const surf = onTee ? "tee" : hole.surface(pos.x, pos.z);
    const yaws = [];
    const py = yawTo(hole.pin.x, hole.pin.z);
    for (const off of [0, -0.03, 0.03, -0.08, 0.08, -0.16, 0.16]) yaws.push(py + off);
    const from = hole.locate(pos.x, pos.z).t;
    for (let t = from + 0.1; t < 1; t += 0.1) {
      const q = hole.atT(t);
      yaws.push(yawTo(q.x, q.z));
    }
    let best = null;
    const consider = (club, yaw, power, range) => {
      const b = trial(club, yaw, power, range);
      const c = cost(b);
      if (!best || c < best.c) best = { c, club, yaw, power, range };
    };
    if (surf === "green" || (surf === "fringe" && d < 14)) {
      const putter = CLUBS[CLUBS.length - 1];
      const range = PUTT_RANGES.find((r) => r >= d * 1.25) || PUTT_RANGES[PUTT_RANGES.length - 1];
      for (const off of [0, -0.02, 0.02, -0.04, 0.04, -0.08, 0.08, -0.14, 0.14]) {
        for (const k of [0.9, 1, 1.1, 1.2, 1.35]) consider(putter, py + off, Math.min(1, (d * k) / range), range);
      }
      return best;
    }
    for (const club of CLUBS) {
      if (club.putter) continue;
      if (club.id === "DR" && !onTee) continue;
      for (const yaw of yaws) for (const p of [1, 0.85, 0.7, 0.5, 0.3]) consider(club, yaw, p, 0);
    }
    return best;
  };
  while (strokes < 16) {
    const plan = planShot();
    strokes += 1;
    last = { ...pos };
    const surf = onTee ? "tee" : hole.surface(pos.x, pos.z);
    // 사람처럼 조금씩 빗맞음
    const e = (rnd() - 0.5) * 2 * errScale;
    const power = Math.min(1, plan.power * (1 + (rnd() - 0.5) * 0.06 * errScale));
    let b;
    if (plan.club.putter) {
      b = puttBall(pos.x, pos.y, pos.z, plan.yaw, plan.range, power, e * 1.2, GROUND[surf].roll);
    } else {
      const lie = GROUND[surf].lie * (plan.club.id === "SW" && surf === "sand" ? 1.35 : 1);
      b = launchBall(pos.x, pos.y + (onTee ? 0.05 : 0), pos.z, plan.yaw, plan.club, power, lie, e * 3, e * 0.0006);
    }
    runToRest(b, hole, wind, rnd);
    onTee = false;
    log.push({ club: plan.club.id, p: +power.toFixed(2), res: b.result || hole.surface(b.x, b.z), d: Math.round(Math.hypot(b.x - hole.pin.x, b.z - hole.pin.z) * 10) / 10 });
    if (b.result === "holed") break;
    if (b.result === "water") {
      strokes += 1;
      G.lastSpot.set(last.x, last.y, last.z);
      const q = G.dropFromWater(b.x, b.z);
      pos.x = q.x; pos.y = q.y; pos.z = q.z;
    } else if (b.result === "ob") {
      strokes += 1;
      pos.x = last.x; pos.y = last.y; pos.z = last.z;
    } else {
      pos.x = b.x; pos.y = hole.height(b.x, b.z); pos.z = b.z;
      if (Math.hypot(pos.x - hole.pin.x, pos.z - hole.pin.z) < 0.5) { strokes += 1; break; }
    }
  }
  return { n: hole.def.n, par: hole.def.par, len: Math.round(hole.length), strokes, log };
};
`;

(async () => {
  const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|fonts\.g/.test(m.text())) errs.push(m.text().slice(0, 240));
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/games/minigolf/?q=mid`);
  await page.waitForFunction(() => window.GolfGame, null, { timeout: 60000 });

  console.log("\n[클럽 거리]");
  const carries = await page.evaluate(() => {
    const G = window.GolfGame;
    const { CLUBS, launchBall } = G.lib;
    const flat = { height: () => 0 };
    return CLUBS.filter((c) => !c.putter).map((c) => {
      const out = {};
      for (const p of [1, 0.5, 0.25]) {
        const b = launchBall(0, 0, 0, 0, c, p, 1, 0, 0);
        let t = 0;
        let apex = 0;
        while ((b.y > 0 || b.vy > 0) && t < 40) {
          G.lib.step(b, 1 / 120);
          t += 1 / 120;
          apex = Math.max(apex, b.y);
        }
        out[p] = { d: Math.hypot(b.x, b.z), t, apex };
      }
      return { id: c.id, carry: c.carry, out };
    });
  });
  for (const c of carries) {
    check(`${c.id} 정타 비거리 ${Math.round(c.out[1].d)}m (표 ${c.carry}m)`, Math.abs(c.out[1].d - c.carry) < 2.5, `체공 ${c.out[1].t.toFixed(1)}초 · 최고 ${Math.round(c.out[1].apex)}m · 50%힘 ${Math.round(c.out[0.5].d)}m`);
  }
  check("클럽이 길수록 멀리 간다", carries.every((c, i) => i === 0 || carries[i - 1].out[1].d > c.out[1].d));
  check("힘을 줄이면 거의 비례해서 준다", carries.every((c) => c.out[0.5].d > c.out[1].d * 0.38 && c.out[0.5].d < c.out[1].d * 0.65));

  console.log("\n[18홀 봇 라운드 (조금 빗맞는 사람처럼 2번씩)]");
  await page.evaluate(BOT);
  let total = 0;
  let parSum = 0;
  let lenSum = 0;
  const lines = [];
  for (let i = 0; i < 18; i += 1) {
    const a = await page.evaluate((k) => window.botPlay(k, 1000 + k, 0.5), i);
    const b = await page.evaluate((k) => window.botPlay(k, 2000 + k, 0.5), i);
    total += a.strokes + b.strokes;
    parSum += a.par * 2;
    lenSum += a.len;
    lines.push(`${a.n}번(파${a.par} ${a.len}m): ${a.strokes} · ${b.strokes}  [${a.log.map((l) => `${l.club}→${l.res}`).join(" ")}]`);
    const worst = Math.max(a.strokes, b.strokes);
    check(`${a.n}번 홀을 끝낼 수 있다`, worst <= a.par + 4, `${a.strokes}타 · ${b.strokes}타 (파 ${a.par})`);
    const lenOk = a.par === 3 ? a.len >= 110 && a.len <= 190 : a.par === 4 ? a.len >= 280 && a.len <= 430 : a.len >= 440 && a.len <= 560;
    check(`${a.n}번 길이가 파에 맞다`, lenOk, `${a.len}m`);
  }
  console.log(lines.join("\n"));
  check("전체 난이도가 파 근처", Math.abs(total / 2 - parSum / 2) <= 14, `봇 평균 ${total / 2}타 · 파 ${parSum / 2} · 코스 ${lenSum}m`);
  check("파 합계 72", parSum / 2 === 72);

  console.log("\n[벌타 · 땅 판정]");
  const rule = await page.evaluate(() => {
    const G = window.GolfGame;
    const out = {};
    G.swapHole(1); // 2번: 물 넘기기
    G.setupHole();
    G.state = "bot";
    const hole = G.hole;
    const w = hole.waters[0];
    out.waterSurface = hole.surface(w.x, w.z);
    out.pinSurface = hole.surface(hole.pin.x, hole.pin.z);
    const { launchBall, runToRest, CLUBS } = G.lib;
    const c = CLUBS.find((k) => k.id === "SW");
    const yaw = Math.atan2(w.x - hole.tee.x, -(w.z - hole.tee.z));
    let p = 0.2;
    let b = null;
    for (; p <= 1; p += 0.02) {
      b = launchBall(hole.tee.x, hole.tee.y, hole.tee.z, yaw, c, p, 1, 0, 0);
      runToRest(b, hole, null, Math.random);
      if (b.result === "water") break;
    }
    out.waterResult = b && b.result;
    G.lastSpot.copy(hole.tee);
    const q = G.dropFromWater(b.x, b.z);
    out.dropSurface = hole.surface(q.x, q.z);
    G.swapHole(16); // 17번: 호수 위 그린
    G.setupHole();
    G.state = "bot";
    const h2 = G.hole;
    out.islandGreen = h2.surface(h2.pin.x, h2.pin.z);
    out.islandAboveWater = h2.pin.y - h2.waters[0].level;
    G.swapHole(0);
    G.setupHole();
    G.state = "bot";
    const h3 = G.hole;
    const bk = h3.bunkers[0];
    out.bunker = h3.surface(bk.x, bk.z);
    const a = h3.atT(0.5);
    out.ob = h3.surface(a.x + 90, a.z);
    return out;
  });
  check("호수 가운데는 물", rule.waterSurface === "water");
  check("핀 자리는 그린", rule.pinSurface === "green");
  check("공이 물에 빠지면 결과가 물", rule.waterResult === "water");
  check("물에 빠진 뒤 드롭 자리는 물 밖", rule.dropSurface !== "water", rule.dropSurface);
  check("17번 섬 그린이 물 위에 있다", rule.islandGreen === "green" && rule.islandAboveWater > 0.3, `수면 위 ${rule.islandAboveWater.toFixed(2)}m`);
  check("벙커 판정", rule.bunker === "sand");
  check("코스 밖은 OB", rule.ob === "ob");

  console.log("\n[실제 조작]");
  await page.evaluate(() => {
    localStorage.removeItem("minigolf-round-v1");
  });
  await page.reload();
  await page.waitForFunction(() => window.GolfGame, null, { timeout: 60000 });
  await page.click("#btn-front");
  await page.waitForFunction(() => window.GolfGame.state === "intro", null, { timeout: 15000 });
  await page.click("#skip");
  await page.waitForFunction(() => window.GolfGame.state === "aim", null, { timeout: 8000 });
  const yaw0 = await page.evaluate(() => window.GolfGame.yaw);
  const box = await page.locator("#game").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + 200, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  const yaw1 = await page.evaluate(() => window.GolfGame.yaw);
  check("화면을 밀면 조준이 돌아간다", yaw1 > yaw0 + 0.05, `${(yaw1 - yaw0).toFixed(3)} rad`);
  await page.click("#aim-btn");
  const club0 = await page.textContent("#club-short");
  await page.click("#club-next");
  const club1 = await page.textContent("#club-short");
  check("클럽을 바꿀 수 있다", club0 !== club1, `${club0} → ${club1}`);
  await page.click("#club-prev");
  // 스윙: 버튼 3번 (힘 90% · 정타)
  await page.dispatchEvent("#swing", "pointerdown");
  check("1탭: 게이지 시작", (await page.evaluate(() => window.GolfGame.state)) === "power");
  await page.waitForFunction(() => window.GolfGame.gauge >= 0.9, null, { polling: "raf", timeout: 4000 });
  await page.dispatchEvent("#swing", "pointerdown");
  check("2탭: 힘 고정", (await page.evaluate(() => window.GolfGame.state)) === "impact");
  const pw = await page.evaluate(() => window.GolfGame.power);
  check("고른 힘이 게이지와 같다", Math.abs(pw - 0.9) < 0.1, `${Math.round(pw * 100)}%`);
  await page.waitForFunction(() => window.GolfGame.gauge <= 0.012, null, { polling: "raf", timeout: 4000 });
  await page.dispatchEvent("#swing", "pointerdown");
  const word = await page.evaluate(() => window.GolfGame.plan.word);
  check("3탭: 임팩트 판정", /PERFECT|NICE/.test(word), word);
  await page.waitForFunction(() => window.GolfGame.state === "fly", null, { timeout: 2000 });
  check("샷이 날아가면 타수가 1", (await page.evaluate(() => window.GolfGame.strokes)) === 1);
  await page.waitForFunction(() => window.GolfGame.state === "aim", null, { timeout: 40000 });
  const after = await page.evaluate(() => {
    const G = window.GolfGame;
    return { strokes: G.strokes, surf: G.surface(), d: G.distToPin(), trail: G.trail.pts.length };
  });
  check("다음 샷 준비로 돌아온다", after.strokes >= 1, `${after.surf} · 남은 ${Math.round(after.d)}m`);
  check("다음 샷 때 궤적이 지워진다", after.trail === 0);

  // 홀아웃 → 스코어카드 → 저장 → 이어하기
  await page.evaluate(() => {
    const G = window.GolfGame;
    G.strokes = 3;
    G.pos.copy(G.hole.pin);
    G.onHoled();
  });
  check("버디면 버디라고 나온다", (await page.textContent("#score-word b")) === "버디");
  await page.waitForFunction(() => window.GolfGame.state === "card", null, { timeout: 6000 });
  check("스코어카드에 점수가 적힌다", (await page.textContent("#card-table")).includes("3"), await page.textContent("#card-title"));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("minigolf-round-v1")));
  check("라운드가 저장된다", saved.round && saved.round.i === 1 && saved.round.scores[0].strokes === 3);
  await page.reload();
  await page.waitForFunction(() => window.GolfGame, null, { timeout: 60000 });
  check("다시 들어오면 이어하기가 보인다", await page.isVisible("#btn-continue"), await page.textContent("#continue-note"));
  await page.click("#btn-continue");
  await page.waitForFunction(() => window.GolfGame.state === "intro", null, { timeout: 15000 });
  check("이어하기는 2번 홀부터", (await page.evaluate(() => window.GolfGame.hole.def.n)) === 2);

  // 라운드 끝 → 결과 · 순위
  await page.evaluate(() => {
    const G = window.GolfGame;
    const R = G.round;
    while (R.i < R.list.length - 1) {
      const d = G.lib.HOLES[R.list[R.i]];
      R.scores.push({ n: d.n, par: d.par, strokes: d.par, pts: 400 });
      R.points += 400;
      R.i += 1;
    }
    G.state = "x";
  });
  await page.evaluate(() => window.GolfGame.loadCurrent());
  await page.waitForFunction(() => window.GolfGame.state === "intro", null, { timeout: 15000 });
  await page.evaluate(() => {
    const G = window.GolfGame;
    G.endIntro();
  });
  await page.waitForFunction(() => window.GolfGame.state === "aim", null, { timeout: 8000 });
  await page.evaluate(() => {
    const G = window.GolfGame;
    G.strokes = 3;
    G.onHoled();
  });
  await page.waitForFunction(() => window.GolfGame.state === "card", null, { timeout: 6000 });
  await page.click("#btn-next");
  await page.waitForFunction(() => window.GolfGame.state === "result", null, { timeout: 4000 });
  check("결과 화면이 나온다", await page.isVisible("#res-total"), await page.textContent("#res-total"));
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem("minigolf-round-v1")));
  check("끝난 라운드는 이어하기에서 빠진다", best.round === null);
  check("최고 기록이 저장된다", Boolean(best.best.front));
  const rank = await page.evaluate(() => Boolean(document.querySelector("#rank-slot").children.length || document.querySelector(".today-rank-form")));
  check("순위 등록 칸이 있다", rank);

  console.log("\n[내 얼굴 · 개인정보]");
  const face = await page.evaluate(() => ({ data: document.body.dataset.face, hasFace: Boolean(window.TodayFace), scoreBody: !/TodayFace|dataUrl/.test(String(window.GolfGame.showResult)) }));
  check("내 얼굴 기능이 켜져 있다", face.data === "1" && face.hasFace);
  check("결과 전송에 얼굴을 쓰지 않는다", face.scoreBody);

  check("페이지 오류 없음", errs.length === 0, errs.slice(0, 3).join(" | "));
  await ctx.close();

  console.log("\n[휴대폰 화면]");
  for (const [name, w, h] of [["세로", 390, 780], ["작은 세로", 360, 640], ["가로", 780, 360]]) {
    const c2 = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    const p2 = await c2.newPage();
    const e2 = [];
    p2.on("pageerror", (e) => e2.push(e.message));
    await p2.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await p2.goto(`${BASE}/games/minigolf/?q=low`);
    await p2.waitForFunction(() => window.GolfGame, null, { timeout: 60000 });
    await p2.tap("#btn-18");
    await p2.waitForFunction(() => window.GolfGame.state === "intro", null, { timeout: 15000 });
    await p2.tap("#skip");
    await p2.waitForFunction(() => window.GolfGame.state === "aim", null, { timeout: 8000 });
    await p2.waitForTimeout(500);
    const r = await p2.evaluate(() => {
      const rect = (s) => document.querySelector(s).getBoundingClientRect();
      const inside = (b) => b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
      const swing = rect("#swing");
      const hit = document.elementFromPoint(swing.left + swing.width / 2, swing.top + swing.height / 2);
      const ball = window.GolfGame.ball.position.clone().project(window.GolfGame.E.camera);
      const ballY = (-ball.y * 0.5 + 0.5) * innerHeight;
      return { swing: inside(swing), clubs: inside(rect(".clubs")), gauge: inside(rect("#gauge")), hud: inside(rect(".h-card")), mini: inside(rect("#mini")), top: hit && hit.id === "swing", ballAbove: ballY < rect("#shot").top + 40, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    check(`${name}: 단추가 모두 화면 안`, r.swing && r.clubs && r.gauge && r.hud && r.mini, JSON.stringify(r));
    check(`${name}: 스윙 단추가 가려지지 않음`, r.top);
    check(`${name}: 공이 패널 위에 보임`, r.ballAbove);
    check(`${name}: 가로 넘침 없음`, !r.overflow);
    await p2.tap("#swing");
    await p2.waitForTimeout(200);
    check(`${name}: 터치로 스윙 시작`, (await p2.evaluate(() => window.GolfGame.state)) === "power");
    check(`${name}: 오류 없음`, e2.length === 0, e2.slice(0, 2).join(" | "));
    await c2.close();
  }

  await browser.close();
  console.log(`\n결과: 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
