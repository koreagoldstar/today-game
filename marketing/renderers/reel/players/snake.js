"use strict";
/* 사과 스네이크: 화면의 뱀 · 사과 · 돌을 보고(window.AppleSnake 읽기) 사과까지 가는 길을 찾아 실제 방향키로 움직인다. 막히면 가장 넓은 쪽으로. */
const { sleep, rand } = require("../io");
const { clickStart } = require("./common");

// 페이지 안에서: 머리에서 사과까지 BFS (벽 · 몸통 피함, 꼬리는 비켜 줌) → 첫 방향 이름
function nextDir() {
  const A = window.AppleSnake;
  if (!A || A.state !== "play") return null;
  const body = A.snake;
  const head = body[0];
  const block = new Set(body.slice(0, -1).map((c) => `${c.x},${c.y}`));
  const free = (x, y) => x >= 0 && y >= 0 && x < A.COLS && y < A.ROWS && !A.isWall(x, y) && !block.has(`${x},${y}`);
  const names = Object.keys(A.DIRS);
  const back = names.find((n) => A.DIRS[n].x === -A.dir.x && A.DIRS[n].y === -A.dir.y);
  const opts = names.filter((n) => n !== back);
  if (A.apple) {
    const seen = new Map([[`${head.x},${head.y}`, null]]);
    const q = [];
    for (const n of opts) {
      const x = head.x + A.DIRS[n].x;
      const y = head.y + A.DIRS[n].y;
      if (free(x, y) && !seen.has(`${x},${y}`)) {
        seen.set(`${x},${y}`, n);
        q.push([x, y, n]);
      }
    }
    while (q.length) {
      const [x, y, first] = q.shift();
      if (x === A.apple.x && y === A.apple.y) return first;
      for (const n of names) {
        const nx = x + A.DIRS[n].x;
        const ny = y + A.DIRS[n].y;
        if (free(nx, ny) && !seen.has(`${nx},${ny}`)) {
          seen.set(`${nx},${ny}`, first);
          q.push([nx, ny, first]);
        }
      }
    }
  }
  // 길이 없으면 가장 넓게 트인 쪽
  let best = null;
  for (const n of opts) {
    const sx = head.x + A.DIRS[n].x;
    const sy = head.y + A.DIRS[n].y;
    if (!free(sx, sy)) continue;
    const seen = new Set([`${sx},${sy}`]);
    const q = [[sx, sy]];
    while (q.length && seen.size < 200) {
      const [x, y] = q.shift();
      for (const m of names) {
        const k = `${x + A.DIRS[m].x},${y + A.DIRS[m].y}`;
        if (!seen.has(k) && free(x + A.DIRS[m].x, y + A.DIRS[m].y)) {
          seen.add(k);
          q.push([x + A.DIRS[m].x, y + A.DIRS[m].y]);
        }
      }
    }
    if (!best || seen.size > best.n) best = { name: n, n: seen.size };
  }
  return best && best.name;
}

const KEY = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

module.exports = {
  id: "snake",
  level: "easy",
  strategy: "E",
  genre: "arcade",
  hooks: ["사과 하나 더 먹으면 끝?", "뱀이 길어질수록 손이 떨린다", "몇 단계까지 가 봤어요?"],
  captions: { score: ["냠!", "쑥쑥 길어진다", "한 칸 더!"], clear: ["스테이지 클리어!"], fail: ["앗, 부딪혔다!", "꼬리에 걸렸다"] },
  thumbText: ["사과 몇 개?", "사과 스네이크"],

  async start(io) {
    return clickStart(io, { titleId: "title" });
  },

  async play(io) {
    let eaten = 0;
    let lives = null;
    let last = null;
    while (io.running()) {
      const s = await io.page.evaluate(() => {
        const A = window.AppleSnake;
        return A && { state: A.state, eaten: A.eaten, lives: A.lives, dir: A.dir };
      }).catch(() => null);
      if (!s) {
        await sleep(80);
        continue;
      }
      if (s.state === "clear") {
        io.mark("clear", "스테이지 클리어!", 4);
        await sleep(rand(1200, 1700));
        if (!(await io.click("#next-btn").catch(() => false))) await io.key("Enter");
        eaten = 0;
        continue;
      }
      if (s.state === "over") {
        io.mark("fail", "게임 끝", 2);
        await sleep(1500);
        await io.click("#retry-btn").catch(() => io.click("#again-btn").catch(() => {}));
        eaten = 0;
        lives = null;
        continue;
      }
      if (s.state !== "play") {
        await sleep(100);
        continue;
      }
      if (s.eaten > eaten) io.mark("score", `${s.eaten}개`, 1.5);
      if (lives !== null && s.lives < lives) io.mark("fail", "부딪혔다", 1.5);
      eaten = s.eaten;
      lives = s.lives;
      const d = await io.page.evaluate(nextDir).catch(() => null);
      if (d && d !== last) {
        await io.key(KEY[d], 30);
        last = d;
      } else if (d) last = d;
      await sleep(30);
    }
  },
};
