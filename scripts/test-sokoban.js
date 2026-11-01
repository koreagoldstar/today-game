/*
 * 상자야 굴러가 점검
 *  node scripts/test-sokoban.js  (로컬 서버 3456 필요)
 *  - 50단계가 전부 풀리고 기준 걸음이 맞는지, 뒤로 갈수록 어려운지
 *  - 답대로 실제 게임에서 움직여 전 단계 클리어 · 별 3개
 *  - 되돌리기 · 다시 · 길찾기 · 상자 고르기 · 힌트 · 저장 · 휴대폰 화면
 */
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3456";
const Solver = require(path.join(__dirname, "../games/sokoban/solver.js"));
let pass = 0;
let fail = 0;
function check(name, ok, extra = "") {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${extra ? ` — ${extra}` : ""}`);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 780 }, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  const bad = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|fonts\.g/.test(m.text())) errs.push(m.text().slice(0, 240));
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) bad.push(`${r.status()} ${r.url()}`);
  });
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/games/sokoban/`);
  await page.waitForFunction(() => window.Sokoban, null, { timeout: 20000 });
  const levels = await page.evaluate(() => window.Sokoban.LEVELS);

  console.log("\n[50단계 풀이]");
  check("50단계", levels.length === 50);
  const routes = [];
  let solved = 0;
  let parOk = 0;
  let pushOk = 0;
  for (const l of levels) {
    const p = Solver.parse(l.m);
    const r = Solver.solve(p, { limit: 2500000 });
    if (!r.pushes) {
      routes.push(null);
      continue;
    }
    solved += 1;
    const e = Solver.expand(p, r.pushes);
    if (e.moves === l.p) parOk += 1;
    if (r.pushes.length === l.q) pushOk += 1;
    // 칸 번호 → 방향
    let at = p.player;
    routes.push(
      e.route.map((c) => {
        const d = c - at;
        at = c;
        return d === 1 ? [1, 0] : d === -1 ? [-1, 0] : d === p.w ? [0, 1] : [0, -1];
      })
    );
  }
  check("전부 풀린다", solved === 50, `${solved}/50`);
  check("기준 걸음이 답과 같다", parOk === 50, `${parOk}/50`);
  check("최소 밀기 수가 답과 같다", pushOk === 50, `${pushOk}/50`);
  const avg = (a, b) => levels.slice(a, b).reduce((s, l) => s + l.q * 2 + l.p * 0.2, 0) / (b - a);
  const worlds = [avg(0, 10), avg(10, 20), avg(20, 30), avg(30, 40), avg(40, 50)];
  check("월드가 뒤로 갈수록 어렵다", worlds.every((v, i) => i === 0 || v > worlds[i - 1]), worlds.map((v) => v.toFixed(1)).join(" < "));

  console.log("\n[답대로 실제 게임에서 끝까지]");
  const result = await page.evaluate(async (allRoutes) => {
    const S = window.Sokoban;
    const out = [];
    const wait = () => new Promise((r) => requestAnimationFrame(r));
    for (let i = 0; i < allRoutes.length; i += 1) {
      S.startStage(i);
      S.skipIntro();
      for (const d of allRoutes[i]) {
        // 움직임이 끝날 때까지 기다렸다 다음 걸음
        let guard = 0;
        while (S.state.anim && guard < 200) {
          await wait();
          guard += 1;
        }
        S.step(d[0], d[1], true);
      }
      let guard = 0;
      while (S.state.clearT < 0 && guard < 300) {
        await wait();
        guard += 1;
      }
      const st = S.state;
      out.push({ i, moves: st.moves, clear: st.clearT >= 0, best: S.save.best[i] });
      S.finish();
      await wait();
    }
    return out;
  }, routes);
  check("50단계 모두 클리어", result.every((r) => r.clear), `${result.filter((r) => r.clear).length}/50`);
  check("걸음 수가 기준과 같다", result.every((r, i) => r.moves === levels[i].p));
  check("기준대로 풀면 별 3개", result.every((r) => r.best && r.best.stars === 3));
  const allPts = await page.evaluate(() => Object.values(window.Sokoban.save.best).reduce((a, b) => a + b.pts, 0));
  check("전부 잘 깨면 점수가 5만 점 근처 (예전 순위와 같은 크기)", allPts > 45000 && allPts <= 50000, String(allPts));

  console.log("\n[조작]");
  await page.evaluate(() => {
    localStorage.removeItem("sokoban-v2");
  });
  await page.reload();
  await page.waitForFunction(() => window.Sokoban);
  const stars = await page.evaluate(() => [window.Sokoban.starsFor(10, 10, false), window.Sokoban.starsFor(16, 10, false), window.Sokoban.starsFor(60, 10, false), window.Sokoban.starsFor(10, 10, true)]);
  check("별 계산 (기준 · 조금 넘음 · 많이 넘음 · 힌트)", stars.join() === "3,2,1,2", stars.join());
  await page.click("#start-btn");
  await page.waitForFunction(() => window.Sokoban.state.screen === "play" && window.Sokoban.state.introT >= 1);
  const s0 = await page.evaluate(() => window.Sokoban.state);
  check("첫 단계부터 시작", s0.stage === 0);

  // 벽으로 가면 안 움직임 (토끼 옆에 벽이 있는 단계를 찾아서)
  const blocked = await page.evaluate(() => {
    const S = window.Sokoban;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (let i = 0; i < S.LEVELS.length; i += 1) {
      S.startStage(i);
      S.skipIntro();
      const st = S.state;
      const w = S.LEVELS[i].m;
      const d = dirs.find(([dx, dy]) => (w[st.player.y + dy] || "")[st.player.x + dx] === "#");
      if (!d) continue;
      S.step(d[0], d[1]);
      return { i, moves: S.state.moves, same: S.state.player.x === st.player.x && S.state.player.y === st.player.y };
    }
    return null;
  });
  check("벽으로는 못 간다", blocked && blocked.moves === 0 && blocked.same, JSON.stringify(blocked));

  // 되돌리기 · 다시
  const undoR = await page.evaluate(async () => {
    const S = window.Sokoban;
    S.startStage(15);
    S.skipIntro();
    const before = JSON.stringify(S.state.crates) + JSON.stringify(S.state.player);
    const wait = () => new Promise((r) => setTimeout(r, 220));
    let m = 0;
    for (const d of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 0], [0, 1]]) {
      if (S.step(d[0], d[1])) m += 1;
      await wait();
    }
    const moved = S.state.moves;
    for (let i = 0; i < m; i += 1) S.undo();
    const after = JSON.stringify(S.state.crates) + JSON.stringify(S.state.player);
    const zero = S.state.moves;
    return { moved, same: before === after, zero };
  });
  check("움직인 뒤 되돌리면 처음 그대로", undoR.moved > 0 && undoR.same && undoR.zero === 0, JSON.stringify(undoR));

  // 빈 칸 누르면 걸어감
  const walk = await page.evaluate(async () => {
    const S = window.Sokoban;
    S.startStage(8);
    S.skipIntro();
    const st = S.state;
    const map = S.LEVELS[8].m;
    // 2칸 이상 떨어진 빈 바닥
    let target = null;
    for (let y = 0; y < map.length && !target; y += 1) {
      for (let x = 0; x < map[y].length; x += 1) {
        if (map[y][x] === " " && Math.abs(x - st.player.x) + Math.abs(y - st.player.y) >= 2 && y > 0 && x > 0 && y < map.length - 1) {
          target = { x, y };
          break;
        }
      }
    }
    S.tapCell(target.x, target.y);
    await new Promise((r) => setTimeout(r, 1500));
    const p = S.state.player;
    return { target, p, moves: S.state.moves };
  });
  check("빈 칸을 누르면 걸어간다", walk.moves >= 1, JSON.stringify(walk.p));

  // 상자를 누르면 밀 수 있는 방향이 나오고, 방향을 누르면 밀림
  const pick = await page.evaluate(async () => {
    const S = window.Sokoban;
    S.startStage(1);
    S.skipIntro();
    const c = S.state.crates[0];
    S.tapCell(c.x, c.y);
    const options = S.state.options;
    if (!options.length) return { options };
    S.tapCell(options[0][0], options[0][1]);
    await new Promise((r) => setTimeout(r, 1500));
    return { options, pushes: S.state.pushes, moved: S.state.crates[0].x !== c.x || S.state.crates[0].y !== c.y };
  });
  check("상자를 누르면 방향이 나오고 밀 수 있다", pick.options.length > 0 && pick.moved, JSON.stringify(pick));

  // 힌트
  const hint = await page.evaluate(async () => {
    const S = window.Sokoban;
    S.startStage(30);
    S.skipIntro();
    const t0 = performance.now();
    S.hint();
    while (!S.state.hint && performance.now() - t0 < 9000) await new Promise((r) => setTimeout(r, 40));
    const st = S.state;
    return { hint: st.hint, used: st.usedHint, ms: Math.round(performance.now() - t0), crateThere: st.hint && st.crates.some((c) => c.x === st.hint.x && c.y === st.hint.y) };
  });
  check("힌트가 밀 상자를 알려 준다", Boolean(hint.hint) && hint.crateThere, `${hint.ms}ms`);
  check("힌트를 쓰면 표시된다", hint.used === true);

  // 저장 · 잠금
  await page.evaluate(() => {
    localStorage.setItem("sokoban-v2", JSON.stringify({ best: { 0: { moves: 4, stars: 3, pts: 1000 }, 1: { moves: 8, stars: 2, pts: 800 } }, last: 2 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.Sokoban);
  check("저장한 곳에서 이어하기", (await page.textContent("#start-label")).includes("1-3"), await page.textContent("#start-label"));
  await page.click("#stages-btn");
  const grid = await page.evaluate(() => [...document.querySelectorAll("#stage-grid .st")].map((b) => b.disabled));
  check("깬 단계 다음 3단계까지 열림", grid.slice(0, 5).every((d) => !d) && grid[5] === true, JSON.stringify(grid));
  await page.click("#stage-grid .st:nth-child(3)");
  await page.waitForFunction(() => window.Sokoban.state.screen === "play");
  check("단계 고르기로 들어갈 수 있다", (await page.evaluate(() => window.Sokoban.state.stage)) === 2);
  // 클리어 화면 · 순위
  const clearInfo = await page.evaluate(async (route) => {
    const S = window.Sokoban;
    S.startStage(9);
    S.skipIntro();
    for (const d of route) {
      while (S.state.anim) await new Promise((r) => requestAnimationFrame(r));
      S.step(d[0], d[1], true);
    }
    while (S.state.screen !== "clear") await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 1000));
    return { rank: !document.getElementById("rank-slot").hidden, stars: document.querySelectorAll("#clear-stars i.on").length, title: document.getElementById("clear-title").textContent };
  }, routes[9]);
  check("월드 끝 단계면 순위 등록이 나온다", clearInfo.rank, clearInfo.title);
  check("별이 차오른다", clearInfo.stars === 3, String(clearInfo.stars));
  await page.click("#next-btn");
  check("다음 단계로 넘어간다", (await page.evaluate(() => window.Sokoban.state.stage)) === 10);
  check("페이지 오류 없음", errs.length === 0, errs.slice(0, 3).join(" | "));
  check("없는 파일 요청 없음", bad.length === 0, bad.slice(0, 3).join(" | "));
  const face = await page.evaluate(() => ({ data: document.body.dataset.face, api: Boolean(window.TodayFace), chip: Boolean(document.querySelector(".today-face-chip, [class*=face-chip], .tf-chip")) }));
  check("내 얼굴 기능이 켜져 있다", face.data === "1" && face.api);
  check("내 얼굴 버튼이 첫 화면에 있다", face.chip);
  await ctx.close();

  console.log("\n[휴대폰 화면]");
  for (const [name, w, h] of [["세로", 390, 780], ["작은 세로", 360, 600], ["가로", 780, 360]]) {
    const c2 = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    const p2 = await c2.newPage();
    const e2 = [];
    p2.on("pageerror", (e) => e2.push(e.message));
    await p2.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await p2.goto(`${BASE}/games/sokoban/`);
    await p2.waitForFunction(() => window.Sokoban);
    await p2.waitForTimeout(250);
    await p2.tap("#start-btn");
    await p2.evaluate(() => {
      window.Sokoban.startStage(49);
      window.Sokoban.skipIntro();
    });
    await p2.waitForTimeout(300);
    const r = await p2.evaluate(() => {
      const S = window.Sokoban.state;
      const rect = (q) => document.querySelector(q).getBoundingClientRect();
      const inside = (b) => b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
      const bar = rect("#bar");
      const tools = rect(".tools");
      const pad = rect(".pad");
      const hud = rect("#hud");
      const bTop = S.oy - S.cell * 0.27;
      const bBottom = S.oy + S.H * S.cell + S.cell * 0.2;
      const bLeft = S.ox;
      const bRight = S.ox + S.W * S.cell;
      const land = innerWidth > innerHeight;
      const clearOfBar = land ? bRight <= pad.left + 1 && bRight <= tools.left + 1 : bBottom <= Math.min(tools.top, pad.top) + 1;
      return { cell: S.cell, inside: inside(bar) && inside(hud) && inside(tools) && inside(pad), clearOfBar, clearOfHud: bTop >= hud.bottom - 1, boardIn: bLeft >= -1 && bRight <= innerWidth + 1 && bBottom <= innerHeight + 1 };
    });
    check(`${name}: 단추가 모두 화면 안`, r.inside, JSON.stringify(r));
    check(`${name}: 판이 조작 단추를 안 가림`, r.clearOfBar && r.clearOfHud && r.boardIn, `칸 ${r.cell}px`);
    check(`${name}: 칸이 누를 만큼 크다`, r.cell >= 22, `${r.cell}px`);
    const before = await p2.evaluate(() => window.Sokoban.state.moves);
    const box = await p2.locator(".pad-btn.left").boundingBox();
    for (const dir of ["left", "right", "up", "down"]) {
      const b = await p2.locator(`.pad-btn.${dir}`).boundingBox();
      await p2.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await p2.waitForTimeout(180);
    }
    const after = await p2.evaluate(() => window.Sokoban.state.moves);
    check(`${name}: 방향 단추가 먹는다`, after > before, `${before} → ${after}`);
    void box;
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
