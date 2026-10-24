// 스테이지 후보 만들기: 설계도대로 무작위 배치 → 풀이기로 가장 짧은 풀이 → 조건에 맞는 것만
// node scripts/jelly-gen/gen.mjs <설계도 이름> [시도 수] [시드] > scripts/jelly-gen/out/<설계도 이름>.txt
// 환경 변수: CAP(풀이 탐색 한도) · TIME(초) · STOP(후보 몇 개면 그만) · SHOW(출력 개수)
import * as E from "../../games/jelly-factory/js/engine.js";
import { solve } from "../jelly-solver.mjs";
import { RECIPES } from "./recipes.mjs";

const name = process.argv[2];
const tries = Number(process.argv[3] || 300);
const seed0 = Number(process.argv[4] || 1);
const R = RECIPES[name];
if (!R) throw new Error("설계도 없음: " + name);
const COLCH = ["R", "Y", "B", "G", "P", "O"];
const FROZ = ["r", "y", "b", "g", "p", "o"];

function make(rand) {
  const w = R.w;
  const h = R.h;
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  const free = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) free.push([x, y]);
  const take = (inner = false) => {
    for (let t = 0; t < 200; t++) {
      const k = Math.floor(rand() * free.length);
      const [x, y] = free[k];
      if (inner && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) continue;
      free.splice(k, 1);
      return [x, y];
    }
    return free.splice(0, 1)[0];
  };
  // 번개를 만들 수 있는 줄: 같은 색 3개를 한 줄에 (한 칸 비움) + 그 빈칸으로 밀어 넣을 1개
  const lineTaken = {};
  for (const [col, len] of R.lines || (R.line ? [R.line] : [])) {
    for (let tries = 0; tries < 50; tries++) {
      const vert = rand() < 0.5;
      const L = vert ? h : w;
      const W2 = vert ? w : h;
      const a0 = Math.floor(rand() * (L - len + 1));
      const b = Math.floor(rand() * W2);
      const gap = Math.floor(rand() * len);
      const at = (a, bb) => (vert ? [bb, a] : [a, bb]);
      const cells = [];
      for (let k = 0; k < len; k++) if (k !== gap) cells.push(at(a0 + k, b));
      // 넣을 젤리: 빈칸과 같은 가로(세로) 줄 다른 곳에서 2칸 이상 떨어진 곳
      const opts = [];
      for (let bb = 0; bb < W2; bb++) if (Math.abs(bb - b) >= 2) opts.push(at(a0 + gap, bb));
      if (!opts.length) continue;
      cells.push(opts[Math.floor(rand() * opts.length)]);
      if (cells.some(([x, y]) => g[y][x] !== ".")) continue;
      for (const [x, y] of cells) {
        g[y][x] = COLCH[col];
        const k = free.findIndex(([fx, fy]) => fx === x && fy === y);
        free.splice(k, 1);
      }
      lineTaken[col] = (lineTaken[col] || 0) + cells.length;
      break;
    }
  }
  for (let i = 0; i < (R.walls || 0); i++) {
    const [x, y] = take();
    g[y][x] = "#";
  }
  for (let i = 0; i < (R.sticky || 0); i++) {
    const [x, y] = take(true);
    g[y][x] = "~";
  }
  for (let i = 0; i < (R.pads || 0); i++) {
    const [x, y] = take(true);
    g[y][x] = "^>v<"[Math.floor(rand() * 4)];
  }
  for (let i = 0; i < (R.pipes || 0); i++) {
    for (let j = 0; j < 2; j++) {
      const [x, y] = take(true);
      g[y][x] = String(i + 1);
    }
  }
  for (let i = 0; i < (R.crates || 0); i++) {
    const [x, y] = take();
    g[y][x] = "x";
  }
  for (let i = 0; i < (R.crates2 || 0); i++) {
    const [x, y] = take();
    g[y][x] = "X";
  }
  for (const [ch, n] of Object.entries(R.specials || {})) for (let i = 0; i < n; i++) {
    const [x, y] = take();
    g[y][x] = ch;
  }
  R.colors.forEach((n, c) => {
    for (let i = 0; i < n - (lineTaken[c] || 0); i++) {
      const [x, y] = take();
      g[y][x] = COLCH[c];
    }
  });
  (R.frozen || []).forEach((n, c) => {
    for (let i = 0; i < n; i++) {
      const [x, y] = take();
      g[y][x] = FROZ[c];
    }
  });
  return g.map((r) => r.join(""));
}

/** 풀이를 두어 보며 쓴 장치 */
function features(def, path) {
  let s = E.create(def);
  const f = { pad: 0, pipe: 0, sticky: 0, made: {}, fired: 0, chain: 0, merges: 0, maxGroup: 0 };
  for (const [i, d] of path) {
    const r = E.move(s, i, d);
    for (const e of r.log) {
      if (e.type === "move") for (const st of e.steps) if (st.kind in f) f[st.kind]++;
      if (e.type === "merge") {
        f.merges++;
        f.maxGroup = Math.max(f.maxGroup, e.cells.length);
        if (e.special) f.made[E.SPECIAL_KEY[e.special]] = (f.made[E.SPECIAL_KEY[e.special]] || 0) + 1;
      }
      if (e.type === "special") {
        f.fired++;
        if (e.depth > 0) f.chain++;
      }
    }
    s = r.state;
  }
  return f;
}

const rand = E.rng(seed0 * 9973 + 17);
const found = [];
let tried = 0;
const CAP = Number(process.env.CAP || R.cap || 400000);
const deadline = Date.now() + Number(process.env.TIME || 1e9) * 1000;
const STOP = Number(process.env.STOP || 1e9);
for (let t = 0; t < tries; t++) {
  if (Date.now() > deadline || found.length >= STOP) break;
  const map = make(rand);
  const def = { id: name, map, goals: R.goals, moves: R.maxPar };
  const s = E.create(def);
  let badStart = false;
  for (let i = 0; i < s.pieces.length; i++) if (E.isJelly(s.pieces[i]) && E.group(s, i).length >= 3) badStart = true;
  if (badStart || E.goalsDone(s, R.goals, s)) continue;
  tried++;
  const r = solve(def, { maxDepth: R.maxPar, cap: CAP });
  if (!r.ok || r.par < R.minPar) continue;
  const f = features(def, r.path);
  if (R.need && !R.need(f)) continue;
  // 다른 방법으로도 얼마나 쉽게 풀리나: 첫 수가 몇 가지나 통하나 (적을수록 생각하는 퍼즐)
  found.push({ par: r.par, nodes: r.nodes, map, f, path: r.path.map(([i, d]) => [i % R.w, Math.floor(i / R.w), d]) });
}
found.sort((a, b) => b.par - a.par || a.nodes - b.nodes);
console.log(`${name}: 시도 ${tried} · 맞는 것 ${found.length}`);
for (const c of found.slice(0, Number(process.env.SHOW || 4))) {
  console.log(`--- par ${c.par} · ${c.nodes}판 · ${JSON.stringify(c.f)}`);
  console.log(c.map.map((r) => `    "${r}",`).join("\n"));
  console.log(`    풀이 ${JSON.stringify(c.path)}`);
}
