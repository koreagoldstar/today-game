/*
 * 말랑콩떡! 젤리 공장 · 규칙 엔진 (화면과 상관없는 순수 계산 — 게임 · 자동 풀이기 · 점검이 같은 코드를 씀)
 *
 * ■ 보드 (칸 = 바닥 무늬 tile + 위에 놓인 것 piece)
 *   바닥: 바닥 · 벽(못 지나감) · 끈적판(들어오면 멈춤) · 튕김 패드(그 칸에서 화살표 방향으로 꺾임) · 파이프(짝 파이프로 나와 같은 방향으로 계속)
 *   위에 놓인 것: 젤리(6색) · 꽁꽁 젤리(못 움직임 · 연결엔 끼움) · 쿠키 상자(체력 1 · 2) · 특수 젤리(번개 가로/세로 · 별 · 폭신 · 무지개)
 *
 * ■ 이동: 젤리(또는 특수 젤리)를 상하좌우로 밀면, 다음 칸이 보드 끝 · 벽 · 다른 무언가이면 멈출 때까지 미끄러진다.
 *   한 칸도 못 가면 이동이 아니다(횟수도 안 줄어듦). 같은 칸 · 같은 방향을 다시 지나면(패드 고리) 거기서 멈춘다.
 *
 * ■ 연결: 멈춘 젤리와 같은 색이 상하좌우로 3개 이상 이어지면 하나로 합쳐지며 사라진다.
 *   - 붙어 있던 쿠키 상자는 체력 -1 (0 이면 깨짐) · 붙어 있던 꽁꽁 젤리는 녹음
 *   - 4개 한 줄 → 번개(가로 줄이면 가로 · 세로 줄이면 세로) · 4개 T자 → 별 · 4개 ㄱ자 · S자 → 폭신 · 5개 이상 → 무지개
 *     (특수 젤리는 멈춘 젤리 자리에 생긴다)
 *
 * ■ 특수 젤리: 밀어서 멈춘 자리에서 터진다 (다른 특수 젤리 효과에 맞아도 터짐 · 한 번 이동에 하나는 한 번만 → 끝없는 연쇄 없음)
 *   번개: 그 줄 전체 (젤리 · 상자 · 꽁꽁 젤리) · 별: 둘레 3×3 · 폭신: 둘레 5×5 의 상자와 얼음만 (젤리는 그대로, 얼음은 녹음)
 *   무지개: 밀어서 부딪힌 젤리와 같은 색을 모두 (벽 · 상자에 부딪히면 아무 일 없음) · 다른 효과에 맞으면 가장 많은 색을 모두
 *
 * ■ 점수: 연결 = (30 × 개수 + 4개 이상이면 50 × (개수 − 3)) × 콤보 배율 · 특수 젤리 만들기 +60
 *   특수 효과 = (젤리 20 + 상자 30) × 콤보 배율 · 콤보: 이동마다 하나라도 없앴으면 +1, 아니면 0 (배율 1 + 0.25 × (콤보 − 1), 최대 2.5)
 */

export const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]; // 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽
export const DIR_NAMES = ["위", "오른쪽", "아래", "왼쪽"];

// 바닥
export const FLOOR = 0;
export const WALL = 1;
export const STICKY = 2;
export const PAD = 3; // 3 + 방향 (3..6)
export const PIPE = 10; // 10 + 번호 (짝끼리 같은 번호)
// 위에 놓인 것
export const EMPTY = 0;
export const CRATE1 = 21;
export const CRATE2 = 22;
export const BOLT_H = 31;
export const BOLT_V = 32;
export const STAR = 33;
export const FLUFFY = 34;
export const RAINBOW = 35;
export const COLORS = 6;

export const isJelly = (p) => (p >= 1 && p <= 6) || (p >= 11 && p <= 16);
export const isFree = (p) => p >= 1 && p <= 6;
export const isFrozen = (p) => p >= 11 && p <= 16;
export const colorOf = (p) => (p <= 6 ? p - 1 : p - 11);
export const isCrate = (p) => p === CRATE1 || p === CRATE2;
export const isSpecial = (p) => p >= 31 && p <= 35;
export const movable = (p) => isFree(p) || isSpecial(p);
export const isPad = (t) => t >= PAD && t <= PAD + 3;
export const isPipe = (t) => t >= PIPE && t < PIPE + 20;

/* ================================================================
 * 스테이지 글자 지도 → 보드
 *  . 바닥  # 벽  ~ 끈적판  ^ > v < 튕김 패드  1~9 파이프(같은 숫자 둘이 짝)
 *  R Y B G P O 젤리(분홍 · 노랑 · 하늘 · 초록 · 보라 · 주황)  r y b g p o 꽁꽁 젤리
 *  x 쿠키 상자(체력 1)  X 쿠키 상자(체력 2)  - 가로 번개  | 세로 번개  S 별  F 폭신  W 무지개
 *  def.on = [[x, y, 글자], …] : 특수 바닥 위에 놓인 것 (예: 끈적판 위 젤리)
 * ============================================================== */
const PIECE_CH = { R: 1, Y: 2, B: 3, G: 4, P: 5, O: 6, r: 11, y: 12, b: 13, g: 14, p: 15, o: 16, x: CRATE1, X: CRATE2, "-": BOLT_H, "|": BOLT_V, S: STAR, F: FLUFFY, W: RAINBOW };
const TILE_CH = { ".": FLOOR, "#": WALL, "~": STICKY, "^": PAD, ">": PAD + 1, v: PAD + 2, "<": PAD + 3 };

export function parse(def) {
  const rows = def.map;
  const h = rows.length;
  const w = rows[0].length;
  const tiles = new Uint8Array(w * h);
  const pieces = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`지도 줄 길이가 달라요 (${def.id || "?"} ${y}줄)`);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const i = y * w + x;
      if (ch in TILE_CH) tiles[i] = TILE_CH[ch];
      else if (ch >= "1" && ch <= "9") tiles[i] = PIPE + Number(ch);
      else if (ch in PIECE_CH) pieces[i] = PIECE_CH[ch];
      else throw new Error(`모르는 글자 '${ch}' (${def.id || "?"})`);
    }
  }
  for (const [x, y, ch] of def.on || []) pieces[y * w + x] = PIECE_CH[ch];
  // 파이프 짝
  const pipeAt = new Int16Array(w * h).fill(-1);
  const seen = {};
  for (let i = 0; i < w * h; i++) {
    if (!isPipe(tiles[i])) continue;
    const id = tiles[i];
    if (seen[id] == null) seen[id] = i;
    else {
      pipeAt[i] = seen[id];
      pipeAt[seen[id]] = i;
    }
  }
  for (let i = 0; i < w * h; i++) if (isPipe(tiles[i]) && pipeAt[i] < 0) throw new Error(`짝 없는 파이프 (${def.id || "?"})`);
  return { w, h, tiles, pipeAt };
}

/** 새 판 상태 */
export function create(def) {
  const board = parse(def);
  const pieces = new Uint8Array(board.w * board.h);
  const rows = def.map;
  for (let y = 0; y < board.h; y++) for (let x = 0; x < board.w; x++) pieces[y * board.w + x] = PIECE_CH[rows[y][x]] || 0;
  for (const [x, y, ch] of def.on || []) pieces[y * board.w + x] = PIECE_CH[ch];
  return {
    board,
    pieces,
    moves: 0, // 쓴 이동 수
    score: 0,
    combo: 0,
    maxCombo: 0,
    maxGroup: 0,
    cleared: [0, 0, 0, 0, 0, 0], // 색깔별 없앤 젤리
    crates: 0, // 깬 상자
    thawed: 0, // 녹인(또는 없앤) 꽁꽁 젤리
    made: { bolt: 0, star: 0, fluffy: 0, rainbow: 0, all: 0 }, // 만든 특수 젤리
    used: 0, // 터뜨린 특수 젤리
    merges: 0,
  };
}

export function clone(s) {
  return {
    board: s.board,
    pieces: s.pieces.slice(),
    moves: s.moves,
    score: s.score,
    combo: s.combo,
    maxCombo: s.maxCombo,
    maxGroup: s.maxGroup,
    cleared: s.cleared.slice(),
    crates: s.crates,
    thawed: s.thawed,
    made: { ...s.made },
    used: s.used,
    merges: s.merges,
  };
}

/* ================================================================
 * 미끄러지기 (상태는 바꾸지 않음 · 미리 보기에도 씀)
 *  → { valid, end, path:[칸…], steps:[{i, kind:'slide'|'pad'|'pipe'|'sticky'|'loop', dir}], dir(마지막 방향) }
 * ============================================================== */
export function slide(s, from, dir) {
  const { w, h, tiles, pipeAt } = s.board;
  const P = s.pieces;
  const piece = P[from];
  const res = { valid: false, end: from, path: [from], steps: [], dir };
  if (!movable(piece)) return res;
  P[from] = EMPTY; // 미끄러지는 동안 원래 자리는 빈 칸
  let pos = from;
  let d = dir;
  const seen = new Set();
  for (let n = 0; n < 4 * w * h; n++) {
    const x = (pos % w) + DIRS[d][0];
    const y = Math.floor(pos / w) + DIRS[d][1];
    if (x < 0 || y < 0 || x >= w || y >= h) break;
    const nx = y * w + x;
    if (tiles[nx] === WALL || P[nx] !== EMPTY) break;
    pos = nx;
    res.path.push(pos);
    const t = tiles[pos];
    if (t === STICKY) {
      res.steps.push({ i: pos, kind: "sticky", dir: d });
      break;
    }
    if (isPad(t)) {
      d = t - PAD;
      res.steps.push({ i: pos, kind: "pad", dir: d });
    } else if (isPipe(t)) {
      const out = pipeAt[pos];
      if (P[out] !== EMPTY) {
        res.steps.push({ i: pos, kind: "pipeBlocked", dir: d });
        break;
      }
      res.steps.push({ i: pos, kind: "pipe", to: out, dir: d });
      pos = out;
      res.path.push(pos);
    }
    const key = pos * 4 + d;
    if (seen.has(key)) {
      res.steps.push({ i: pos, kind: "loop", dir: d });
      break;
    }
    seen.add(key);
  }
  P[from] = piece;
  res.end = pos;
  res.dir = d;
  res.valid = pos !== from;
  return res;
}

/** 같은 색 이어진 칸 (상하좌우 · 꽁꽁 젤리 포함) */
export function group(s, i) {
  const { w, h } = s.board;
  const P = s.pieces;
  if (!isJelly(P[i])) return [];
  const c = colorOf(P[i]);
  const out = [i];
  const seen = new Set(out);
  for (let k = 0; k < out.length; k++) {
    const p = out[k];
    const x = p % w;
    const y = (p - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (!seen.has(q) && isJelly(P[q]) && colorOf(P[q]) === c) {
        seen.add(q);
        out.push(q);
      }
    }
  }
  return out;
}

/** 연결 모양 → 만들어질 특수 젤리 (없으면 0) */
export function specialFor(cells, w) {
  const n = cells.length;
  if (n >= 5) return RAINBOW;
  if (n !== 4) return 0;
  const xs = cells.map((c) => c % w);
  const ys = cells.map((c) => Math.floor(c / w));
  if (ys.every((y) => y === ys[0])) return BOLT_H;
  if (xs.every((x) => x === xs[0])) return BOLT_V;
  // T자 (한 칸이 나머지 셋과 모두 붙음) → 별 · ㄱ자 · S자 → 폭신
  //  (네모 2×2 는 셋이 먼저 이어져 합쳐지므로 한 번 밀어서는 생길 수 없음)
  const set = new Set(cells);
  for (const c of cells) {
    const x = c % w;
    let nb = 0;
    if (set.has(c - w)) nb++;
    if (set.has(c + w)) nb++;
    if (x > 0 && set.has(c - 1)) nb++;
    if (x < w - 1 && set.has(c + 1)) nb++;
    if (nb === 3) return STAR;
  }
  return FLUFFY;
}
export const SPECIAL_KEY = { [BOLT_H]: "bolt", [BOLT_V]: "bolt", [STAR]: "star", [FLUFFY]: "fluffy", [RAINBOW]: "rainbow" };

const comboMult = (c) => Math.min(2.5, 1 + 0.25 * Math.max(0, c - 1));

/* ================================================================
 * 한 번 이동 → 새 상태 + 일어난 일 목록 (화면은 이 목록대로 보여 줌)
 *  잘못된 이동이면 null
 * ============================================================== */
export function move(state, from, dir) {
  if (!movable(state.pieces[from])) return null;
  const sl = slide(state, from, dir);
  if (!sl.valid) return null;
  const s = clone(state);
  const { w } = s.board;
  const P = s.pieces;
  const piece = P[from];
  P[from] = EMPTY;
  P[sl.end] = piece;
  s.moves++;
  const log = [{ type: "move", from, to: sl.end, piece, path: sl.path, steps: sl.steps, dir: sl.dir }];
  // 이번 이동에서 없앤 것 (점수는 콤보가 정해진 뒤에)
  const pend = [];
  if (isSpecial(piece)) fire(s, sl.end, piece, sl.dir, log, pend);
  else {
    const g = group(s, sl.end);
    if (g.length >= 3) merge(s, g, sl.end, log, pend);
  }
  // 콤보 · 점수
  if (pend.length) {
    s.combo++;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
  } else s.combo = 0;
  const m = comboMult(s.combo);
  let pts = 0;
  for (const e of pend) {
    e.points = Math.round(e.base * m) + (e.bonus || 0);
    pts += e.points;
  }
  s.score += pts;
  log.push({ type: "end", points: pts, combo: s.combo });
  return { state: s, log };
}

function clearCell(s, i) {
  const p = s.pieces[i];
  if (isJelly(p)) {
    s.cleared[colorOf(p)]++;
    if (isFrozen(p)) s.thawed++;
  } else if (isCrate(p)) s.crates++;
  s.pieces[i] = EMPTY;
}

function merge(s, g, anchor, log, pend) {
  const { w, h } = s.board;
  const P = s.pieces;
  const color = colorOf(P[anchor]);
  const sp = specialFor(g, w);
  const inG = new Set(g);
  for (const i of g) clearCell(s, i);
  // 붙어 있던 상자 · 꽁꽁 젤리
  const near = new Set();
  for (const i of g) {
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (!inG.has(q)) near.add(q);
    }
  }
  const cracked = [];
  const broke = [];
  const thaw = [];
  for (const q of near) {
    const p = P[q];
    if (p === CRATE2) {
      P[q] = CRATE1;
      cracked.push(q);
    } else if (p === CRATE1) {
      P[q] = EMPTY;
      s.crates++;
      broke.push(q);
    } else if (isFrozen(p)) {
      P[q] = p - 10;
      s.thawed++;
      thaw.push(q);
    }
  }
  if (sp) {
    P[anchor] = sp;
    s.made[SPECIAL_KEY[sp]]++;
    s.made.all++;
  }
  s.merges++;
  s.maxGroup = Math.max(s.maxGroup, g.length);
  const n = g.length;
  const e = { type: "merge", cells: g, anchor, color, special: sp, cracked, broke, thaw, base: 30 * n + (n >= 4 ? 50 * (n - 3) : 0), bonus: sp ? 60 : 0 };
  log.push(e);
  pend.push(e);
}

/** 특수 젤리 터뜨리기 (연쇄 포함 · 한 이동에 하나는 한 번만) */
function fire(s, pos, piece, dir, log, pend) {
  const { w, h } = s.board;
  const P = s.pieces;
  const queue = [{ pos, piece, dir, depth: 0 }];
  const done = new Set();
  while (queue.length) {
    const it = queue.shift();
    if (done.has(it.pos)) continue;
    done.add(it.pos);
    P[it.pos] = EMPTY;
    s.used++;
    const x0 = it.pos % w;
    const y0 = (it.pos - x0) / w;
    let cells = [];
    let target = -1;
    if (it.piece === BOLT_H) for (let x = 0; x < w; x++) cells.push(y0 * w + x);
    else if (it.piece === BOLT_V) for (let y = 0; y < h; y++) cells.push(y * w + x0);
    else if (it.piece === STAR || it.piece === FLUFFY) {
      const r = it.piece === STAR ? 1 : 2;
      for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) if (x >= 0 && y >= 0 && x < w && y < h) cells.push(y * w + x);
    } else if (it.piece === RAINBOW) {
      if (it.dir != null) {
        // 밀어서 부딪힌 것
        const nx = x0 + DIRS[it.dir][0];
        const ny = y0 + DIRS[it.dir][1];
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && isJelly(P[ny * w + nx])) target = colorOf(P[ny * w + nx]);
      } else {
        // 다른 효과에 맞음: 가장 많은 색 (같으면 앞 번호)
        const cnt = [0, 0, 0, 0, 0, 0];
        for (let i = 0; i < w * h; i++) if (isJelly(P[i])) cnt[colorOf(P[i])]++;
        let best = -1;
        for (let c = 0; c < COLORS; c++) if (cnt[c] > 0 && (best < 0 || cnt[c] > cnt[best])) best = c;
        target = best;
      }
      if (target >= 0) for (let i = 0; i < w * h; i++) if (isJelly(P[i]) && colorOf(P[i]) === target) cells.push(i);
    }
    let jel = 0;
    let crt = 0;
    const hit = [];
    for (const i of cells) {
      if (i === it.pos) continue;
      const p = P[i];
      if (it.piece === FLUFFY) {
        // 폭신: 상자 · 얼음만
        if (isCrate(p)) {
          P[i] = EMPTY;
          s.crates++;
          crt++;
          hit.push(i);
        } else if (isFrozen(p)) {
          P[i] = p - 10;
          s.thawed++;
          hit.push(i);
        }
        continue;
      }
      if (isSpecial(p)) {
        if (!done.has(i)) queue.push({ pos: i, piece: p, dir: null, depth: it.depth + 1 });
        continue;
      }
      if (isJelly(p)) {
        clearCell(s, i);
        jel++;
        hit.push(i);
      } else if (isCrate(p)) {
        clearCell(s, i);
        crt++;
        hit.push(i);
      }
    }
    const e = { type: "special", piece: it.piece, pos: it.pos, cells, hit, target, depth: it.depth, base: 20 * jel + 30 * crt };
    log.push(e);
    pend.push(e);
  }
}

/** 지금 할 수 있는 이동 전부 [[칸, 방향], …] */
export function validMoves(s) {
  const out = [];
  const n = s.pieces.length;
  for (let i = 0; i < n; i++) {
    if (!movable(s.pieces[i])) continue;
    for (let d = 0; d < 4; d++) if (slide(s, i, d).valid) out.push([i, d]);
  }
  return out;
}

/* ================================================================
 * 목표
 *  {type:'score', n} · {type:'color', color, n} · {type:'crates'} (모두) · {type:'special', kind:'any'|'bolt'|…, n}
 *  {type:'use', n} (특수 젤리 터뜨리기) · {type:'clear'} (색 젤리를 모두) · {type:'frozen'} (꽁꽁 젤리를 모두 구하기)
 * ============================================================== */
export function count(s, pred) {
  let n = 0;
  for (const p of s.pieces) if (pred(p)) n++;
  return n;
}
export function goalProgress(s, g, start) {
  switch (g.type) {
    case "score":
      return { v: s.score, n: g.n };
    case "color":
      return { v: s.cleared[g.color], n: g.n };
    case "crates": {
      const total = start ? count(start, isCrate) : g.n;
      return { v: s.crates, n: g.n || total };
    }
    case "special":
      return { v: g.kind && g.kind !== "any" ? s.made[g.kind] : s.made.all, n: g.n };
    case "use":
      return { v: s.used, n: g.n };
    case "clear": {
      const left = count(s, isJelly);
      const total = start ? count(start, isJelly) : left;
      return { v: total - left, n: total };
    }
    case "frozen": {
      const left = count(s, isFrozen);
      const total = start ? count(start, isFrozen) : left;
      return { v: total - left, n: total };
    }
  }
  return { v: 0, n: 1 };
}
export function goalsDone(s, goals, start) {
  return goals.every((g) => {
    const p = goalProgress(s, g, start);
    return p.v >= p.n;
  });
}

/** 상태 고유 열쇠 (자동 풀이기에서 같은 판 다시 안 보게) */
export function key(s, goals) {
  let k = String.fromCharCode(...s.pieces);
  for (const g of goals) if (g.type === "score") k += "|" + s.score;
  else if (g.type === "color") k += "|" + s.cleared[g.color];
  else if (g.type === "special") k += "|" + s.made.all;
  else if (g.type === "use") k += "|" + s.used;
  return k;
}

/** 시드 고정 난수 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 점수 도전: 빈 칸에 새 젤리 k 개 (바로 3개가 이어지지 않게) → 놓은 칸들 (자리가 없으면 그만큼 적게)
 */
export function spawn(s, k, colors, rand) {
  const { w, h, tiles } = s.board;
  const P = s.pieces;
  const empty = [];
  for (let i = 0; i < w * h; i++) if (P[i] === EMPTY && tiles[i] !== WALL && !isPipe(tiles[i]) && !isPad(tiles[i])) empty.push(i);
  const placed = [];
  for (let n = 0; n < k && empty.length; n++) {
    const at = empty.splice(Math.floor(rand() * empty.length), 1)[0];
    let ok = false;
    for (let t = 0; t < 8 && !ok; t++) {
      const c = colors[Math.floor(rand() * colors.length)];
      P[at] = c + 1;
      if (group(s, at).length < 3) ok = true;
    }
    if (!ok) {
      for (const c of colors) {
        P[at] = c + 1;
        if (group(s, at).length < 3) {
          ok = true;
          break;
        }
      }
    }
    if (!ok) P[at] = EMPTY;
    else placed.push(at);
  }
  return placed;
}

/** 별: 쓴 이동이 par(가장 짧은 풀이) 에 가까울수록 */
export function starsFor(used, par, limit) {
  const slack = Math.max(1, limit - par);
  if (used <= par + Math.floor(slack / 3)) return 3;
  if (used <= par + Math.floor((2 * slack) / 3)) return 2;
  return 1;
}
