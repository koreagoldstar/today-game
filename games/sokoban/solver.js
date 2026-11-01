/*
 * 소코반 풀이: 미는 횟수가 가장 적은 답을 너비 우선으로 찾는다
 *  상태 = 상자 자리들 + 사람이 닿을 수 있는 칸 중 가장 작은 칸 (같은 영역이면 같은 상태)
 *  구석에 끼면 절대 못 빼는 칸은 미리 걸러서 빠르게 끝낸다. 힌트와 점검에 같이 쓴다.
 *  브라우저: window.SokobanSolver · Node: require
 */
(function (root) {
  "use strict";

  const DIRS = [
    [0, -1, "U"],
    [1, 0, "R"],
    [0, 1, "D"],
    [-1, 0, "L"],
  ];

  /** map: 문자열 배열 → { w, h, walls(Uint8Array), goals(Uint8Array), crates[], player } */
  function parse(map) {
    const h = map.length;
    const w = Math.max(...map.map((r) => r.length));
    const walls = new Uint8Array(w * h);
    const goals = new Uint8Array(w * h);
    const crates = [];
    let player = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const ch = map[y][x] || " ";
        const i = y * w + x;
        if (ch === "#") walls[i] = 1;
        if (ch === "." || ch === "*" || ch === "+") goals[i] = 1;
        if (ch === "$" || ch === "*") crates.push(i);
        if (ch === "@" || ch === "+") player = i;
      }
    }
    return { w, h, walls, goals, crates, player };
  }

  /** 상자를 목표까지 끌어올 수 있는 칸만 true (거꾸로 당겨 봄) */
  function liveCells(p) {
    const { w, h, walls, goals } = p;
    const live = new Uint8Array(w * h);
    const stack = [];
    for (let i = 0; i < w * h; i += 1) {
      if (goals[i]) {
        live[i] = 1;
        stack.push(i);
      }
    }
    while (stack.length) {
      const c = stack.pop();
      const x = c % w;
      const y = (c - x) / w;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        const fx = x + dx * 2;
        const fy = y + dy * 2;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || fx < 0 || fy < 0 || fx >= w || fy >= h) continue;
        const n = ny * w + nx;
        const f = fy * w + fx;
        if (walls[n] || walls[f] || live[n]) continue;
        live[n] = 1;
        stack.push(n);
      }
    }
    return live;
  }

  /** 사람이 닿는 칸 표시. 돌려주는 값은 가장 작은 칸 */
  function reach(p, occupied, start, seen, stamp, queue) {
    const { w, walls } = p;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = stamp;
    let min = start;
    while (head < tail) {
      const c = queue[head++];
      if (c < min) min = c;
      for (const n of [c - w, c + 1, c + w, c - 1]) {
        if (seen[n] === stamp || walls[n] || occupied[n]) continue;
        seen[n] = stamp;
        queue[tail++] = n;
      }
    }
    return min;
  }

  /**
   * 풀기. opts: { limit: 살펴볼 상태 수 · budgetMs: 시간 한도 }
   * 돌려줌: { pushes: [{ crate, to, dir }], states } 또는 { none: true } / { gaveUp: true }
   */
  function solve(p, opts = {}) {
    const limit = opts.limit || 3000000;
    const budget = opts.budgetMs || 0;
    const started = budget ? Date.now() : 0;
    const { w, h, walls, goals } = p;
    const size = w * h;
    const live = liveCells(p);
    const occupied = new Uint8Array(size);
    const seen = new Int32Array(size);
    const seen2 = new Int32Array(size);
    const queue = new Int32Array(size);
    let stamp = 0;
    let stamp2 = 0;
    const goalCount = goals.reduce((a, b) => a + b, 0);
    const need = Math.min(goalCount, p.crates.length);

    const keyOf = (crates, min) => `${crates.join(",")}|${min}`;
    const start = [...p.crates].sort((a, b) => a - b);
    for (const c of start) occupied[c] = 1;
    stamp += 1;
    const startMin = reach(p, occupied, p.player, seen, stamp, queue);
    for (const c of start) occupied[c] = 0;
    const visited = new Set([keyOf(start, startMin)]);
    const nodes = [{ crates: start, player: p.player, parent: -1, from: 0, to: 0, dir: 0 }];
    const isDone = (crates) => {
      let n = 0;
      for (const c of crates) if (goals[c]) n += 1;
      return n >= need;
    };
    if (isDone(start)) return { pushes: [], states: 1 };
    let head = 0;
    while (head < nodes.length) {
      if (nodes.length > limit) return { gaveUp: true, states: nodes.length };
      if (budget && head % 512 === 0 && Date.now() - started > budget) return { gaveUp: true, states: nodes.length };
      const node = nodes[head];
      const { crates } = node;
      for (const c of crates) occupied[c] = 1;
      stamp += 1;
      reach(p, occupied, node.player, seen, stamp, queue);
      for (let i = 0; i < crates.length; i += 1) {
        const c = crates[i];
        for (let d = 0; d < 4; d += 1) {
          const dx = DIRS[d][0];
          const dy = DIRS[d][1];
          const behind = c - dx - dy * w;
          const to = c + dx + dy * w;
          if (seen[behind] !== stamp) continue;
          if (to < 0 || to >= size || walls[to] || occupied[to] || !live[to]) continue;
          const next = crates.slice();
          next[i] = to;
          next.sort((a, b) => a - b);
          // 사람은 상자가 있던 자리로 옮겨 감
          occupied[c] = 0;
          occupied[to] = 1;
          stamp2 += 1;
          const min = reach(p, occupied, c, seen2, stamp2, queue);
          occupied[to] = 0;
          occupied[c] = 1;
          const k = keyOf(next, min);
          if (visited.has(k)) continue;
          visited.add(k);
          nodes.push({ crates: next, player: c, parent: head, from: c, to, dir: d });
          if (isDone(next)) {
            const pushes = [];
            for (let n = nodes.length - 1; n > 0; n = nodes[n].parent) pushes.push({ crate: nodes[n].from, to: nodes[n].to, dir: nodes[n].dir });
            pushes.reverse();
            for (const q of crates) occupied[q] = 0;
            return { pushes, states: nodes.length };
          }
        }
      }
      for (const c of crates) occupied[c] = 0;
      head += 1;
    }
    return { none: true, states: nodes.length };
  }

  /** 사람 길찾기: from → to (상자 · 벽 피해서). 칸 목록 또는 null */
  function walkPath(p, crateMask, from, to) {
    const { w, walls } = p;
    if (from === to) return [];
    const prev = new Int32Array(w * p.h).fill(-1);
    const q = [from];
    prev[from] = from;
    for (let head = 0; head < q.length; head += 1) {
      const c = q[head];
      for (const n of [c - w, c + 1, c + w, c - 1]) {
        if (n < 0 || n >= w * p.h || prev[n] !== -1 || walls[n] || crateMask[n]) continue;
        prev[n] = c;
        if (n === to) {
          const path = [];
          for (let i = n; i !== from; i = prev[i]) path.push(i);
          return path.reverse();
        }
        q.push(n);
      }
    }
    return null;
  }

  /** 미는 답을 걷는 길까지 풀어서 전체 걸음 수 계산 */
  function expand(p, pushes) {
    const { w } = p;
    const mask = new Uint8Array(w * p.h);
    for (const c of p.crates) mask[c] = 1;
    let at = p.player;
    let moves = 0;
    const route = [];
    for (const push of pushes) {
      const dx = DIRS[push.dir][0];
      const dy = DIRS[push.dir][1];
      const behind = push.crate - dx - dy * w;
      const path = walkPath(p, mask, at, behind);
      if (!path) return null;
      moves += path.length;
      route.push(...path);
      mask[push.crate] = 0;
      mask[push.to] = 1;
      at = push.crate;
      moves += 1;
      route.push(at);
    }
    return { moves, route };
  }

  const api = { parse, solve, expand, walkPath, liveCells, DIRS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SokobanSolver = api;
  // Worker 로 불렀을 때: 화면을 멈추지 않고 뒤에서 품
  if (typeof document === "undefined" && typeof importScripts === "function") {
    root.onmessage = (e) => {
      const r = solve(parse(e.data.map), { budgetMs: e.data.budgetMs || 6000 });
      root.postMessage({ pushes: r.pushes ? r.pushes.slice(0, 1) : null, none: Boolean(r.none), gaveUp: Boolean(r.gaveUp) });
    };
  }
})(typeof self !== "undefined" ? self : globalThis);
