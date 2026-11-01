/**
 * 애플 스네이크 — 자동 점검
 *
 * 사용: npm run start 후 node scripts/test-snake.js   (SNAKE_SHOTS=폴더 면 화면 사진)
 *
 * - 돌 배치가 판을 가르지 않고 출발 자리가 비어 있음
 * - 길찾기 봇이 게임과 같은 코드(setDirection · tick)로 50 스테이지를 모두 깸
 * - 벽 앞에서 바로 죽지 않고 기다려 줌 · 그대로 두면 목숨이 줄어듦 · 몸 반대로 못 꺾음 · 칸을 막 떠날 때 누르면 바로 꺾음
 * - /api/* 는 가짜 응답
 */
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.SNAKE_BASE || "http://localhost:3456";
const SHOTS = process.env.SNAKE_SHOTS || "";
const results = [];
const check = (name, ok, detail) => {
  results.push({ ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""}`);
};

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.route("**/api/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(`${BASE}/games/snake/`);
  await page.waitForFunction(() => window.AppleSnake);
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, "title.png") });
  }

  const conn = await page.evaluate(() => {
    const S = window.AppleSnake;
    const out = [];
    for (let i = 0; i < S.PATTERN_COUNT; i++) out.push(S.patternConnected(i));
    return out;
  });
  check("돌 배치 10종 모두 이어져 있음", conn.every(Boolean), conn.join(","));

  // 움직임 규칙
  const rules = await page.evaluate(() => {
    const S = window.AppleSnake;
    S.pauseLoop();
    S.start(0);
    S.pauseLoop();
    const out = {};
    // 준비 시간 지나기
    for (let i = 0; i < 70; i++) S.tick(1 / 60);
    // 오른쪽으로 벽까지 그대로
    let guard = 0;
    while (S.snake[S.snake.length - 1].x < S.COLS - 1 && guard++ < 2000) S.tick(1 / 60);
    const livesBefore = S.lives;
    S.tick(0.06);
    out.waited = S.lives === livesBefore; // 벽 앞에서 바로 죽지 않음
    S.setDirection(S.DIRS.up);
    S.tick(1 / 60);
    S.tick(1 / 60);
    out.turned = S.lives === livesBefore && S.dir === S.DIRS.up;
    // 위로 쭉 → 벽 앞에서 그대로 두면 목숨 감소
    guard = 0;
    while (S.lives === livesBefore && guard++ < 4000) S.tick(1 / 60);
    out.hit = S.lives === livesBefore - 1;
    // 반대 방향 금지 + 바로 꺾기
    S.start(0);
    S.pauseLoop();
    S.setDirection(S.DIRS.up);
    S.tick(1 / 60);
    const headY = S.snake[S.snake.length - 1].y;
    out.quickTurn = S.next && S.next.y === headY - 1;
    S.start(0);
    S.pauseLoop();
    S.tick(1.2);
    S.setDirection(S.DIRS.left);
    for (let i = 0; i < 30; i++) S.tick(1 / 60);
    out.noReverse = S.dir === S.DIRS.right && S.lives === 3;
    return out;
  });
  check("벽 앞에서 잠깐 기다려 줌", rules.waited);
  check("기다리는 동안 방향을 바꾸면 산다", rules.turned);
  check("그대로 두면 목숨이 준다", rules.hit);
  check("누르면 바로 꺾는다", rules.quickTurn);
  check("몸 반대쪽으로는 안 꺾인다", rules.noReverse);

  // 길찾기 봇으로 50 스테이지
  const play = await page.evaluate(() => {
    const S = window.AppleSnake;
    S.pauseLoop();
    const key = (x, y) => x * 100 + y;
    const dirs = [S.DIRS.up, S.DIRS.down, S.DIRS.left, S.DIRS.right];
    function path(from, to, blocked) {
      const prev = new Map();
      const seen = new Set([key(from.x, from.y)]);
      const q = [from];
      while (q.length) {
        const c = q.shift();
        if (c.x === to.x && c.y === to.y) break;
        for (const d of dirs) {
          const n = { x: c.x + d.x, y: c.y + d.y };
          const k = key(n.x, n.y);
          if (n.x < 0 || n.x >= S.COLS || n.y < 0 || n.y >= S.ROWS || seen.has(k) || blocked.has(k)) continue;
          seen.add(k);
          prev.set(k, { c, d });
          q.push(n);
        }
      }
      const k = key(to.x, to.y);
      if (!prev.has(k)) return null;
      let cur = k;
      let first = null;
      while (prev.has(cur)) {
        const p = prev.get(cur);
        first = p.d;
        cur = key(p.c.x, p.c.y);
      }
      return first;
    }
    const out = [];
    for (let st = 0; st < S.TOTAL_STAGES; st++) {
      S.start(st);
      S.pauseLoop();
      let guard = 0;
      while (S.state === "play" && guard++ < 400000) {
        // 칸에 도착할 때마다 다음 방향 정함
        const h = S.snake[S.snake.length - 1];
        const blocked = new Set();
        for (let i = 1; i < S.snake.length; i++) blocked.add(key(S.snake[i].x, S.snake[i].y));
        for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.isWall(x, y)) blocked.add(key(x, y));
        let d = S.apple ? path(h, S.apple, blocked) : null;
        if (!d) {
          // 사과로 가는 길이 몸에 막혔으면 꼬리를 따라감 (곧 길이 열림)
          const tail = S.snake[0];
          d = path(h, tail, blocked);
        }
        if (!d) {
          d = dirs.find((q) => {
            const n = { x: h.x + q.x, y: h.y + q.y };
            return n.x >= 0 && n.x < S.COLS && n.y >= 0 && n.y < S.ROWS && !blocked.has(key(n.x, n.y));
          });
        }
        if (d && !(d.x === S.dir.x && d.y === S.dir.y)) S.setDirection(d);
        const before = S.snake[S.snake.length - 1];
        let g2 = 0;
        while (S.state === "play" && S.snake[S.snake.length - 1] === before && g2++ < 600) S.tick(1 / 60);
      }
      out.push({ st: st + 1, state: S.state, eaten: S.eaten, goal: S.goal(st), lives: S.lives });
      if (S.state !== "clear" && S.state !== "all") {
        if (!(st === S.TOTAL_STAGES - 1 && S.state === "clear")) break;
      }
    }
    return out;
  });
  const clearAll = play.length === 50 && play.every((p) => p.state === "clear");
  check("봇이 50 스테이지를 모두 깸", clearAll, clearAll ? `목숨 잃은 판 ${play.filter((p) => p.lives < (p.st <= 10 ? 3 : 4)).length}개` : play[play.length - 1]);
  if (SHOTS) {
    for (const st of [0, 9, 14, 24, 37, 46]) {
      await page.evaluate((s) => {
        const S = window.AppleSnake;
        S.start(s);
        S.pauseLoop();
        document.querySelectorAll(".overlay").forEach((o) => o.classList.add("hidden"));
        for (let i = 0; i < 90; i++) S.tick(1 / 60);
        S.setDirection(S.DIRS.up);
        for (let i = 0; i < 40; i++) S.tick(1 / 60);
        S.setDirection(S.DIRS.left);
        for (let i = 0; i < 30; i++) S.tick(1 / 60);
        S.draw();
      }, st);
      await page.screenshot({ path: path.join(SHOTS, `stage-${st + 1}.png`) });
    }
  }
  check("콘솔 오류 없음", errs.length === 0, errs.slice(0, 5));
  await browser.close();
  const fail = results.filter((x) => !x.ok).length;
  console.log(`\n${results.length - fail} / ${results.length} 통과`);
  process.exit(fail ? 1 : 0);
})();
