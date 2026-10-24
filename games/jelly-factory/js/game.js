/*
 * 말랑콩떡! 젤리 공장 · 게임 진행 · 그리기 · 입력
 *  규칙은 모두 engine.js (자동 풀이기와 같은 코드). 여기서는 그 결과(일어난 일 목록)를 차례대로 보여 준다.
 *  좌표: 보드 위치 · 칸 크기는 화면 크기가 바뀔 때마다 다시 계산하고, 누른 자리도 같은 계산으로 칸을 찾는다.
 */
import * as E from "./engine.js?v=1";
import { makePieceSprite, makeIceSprite, drawFace, drawFloor, JELLIES, rr, star5 } from "./art.js?v=1";
import { STAGES, DAILY } from "./levels.js?v=1";
import { Save, seoulDate } from "./save.js?v=1";
import { JellyAudio } from "./audio.js?v=1";
import { UI } from "./ui.js?v=1";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const easeOutBack = (t) => {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/* 점수 도전 판: 8×8 · 가운데 벽 4개 · 5색 · 이동 30번 · 이동마다 새 젤리 1개 · 2개 번갈아 */
export const SCORE_MODE = {
  map: ["........", "........", "..#..#..", "........", "........", "..#..#..", "........", "........"],
  colors: [0, 1, 2, 3, 4],
  start: 20,
  spawn: [2, 1], // 쓴 이동 수가 짝수면 2개 · 홀수면 1개
  moves: 30,
};

/* 오늘의 퍼즐: 서울 날짜 → 모음에서 하나 (모두 같은 판) */
const DAILY_EPOCH = Date.parse("2026-01-01T00:00:00+09:00");
export function dailyIndex(date, n) {
  const days = Math.round((Date.parse(date + "T00:00:00+09:00") - DAILY_EPOCH) / 86400000);
  // 같은 순서가 매번 되풀이되지 않게 고정된 순서로 섞어 둠
  const perm = [...Array(n).keys()];
  const r = E.rng(2026);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm[((days % n) + n) % n];
}
export function dailyDef(date) {
  const i = dailyIndex(date, DAILY.length);
  return { ...DAILY[i], id: `daily-${date}`, dailyNo: i + 1, name: DAILY[i].name || "오늘의 퍼즐" };
}

/** 도감 열쇠 */
export function dexKey(p) {
  if (E.isFrozen(p)) return "frozen";
  if (E.isJelly(p)) return "c" + E.colorOf(p);
  if (p === E.CRATE1 || p === E.CRATE2) return "crate";
  if (p === E.BOLT_H || p === E.BOLT_V) return "bolt";
  if (p === E.STAR) return "star";
  if (p === E.FLUFFY) return "fluffy";
  if (p === E.RAINBOW) return "rainbow";
  return null;
}

export class Game {
  constructor({ canvas, field }) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    if (!this.ctx) throw new Error("캔버스를 쓸 수 없어요");
    this.field = field;
    this.save = new Save();
    this.audio = new JellyAudio();
    this.audio.setOn(this.save.data.settings.sound !== false);
    this.applyReduced();
    this.dpr = 1;
    this.W = 1;
    this.H = 1;
    this.L = null;
    this.run = null;
    this.mode = "menu";
    this.paused = false;
    this.sel = -1;
    this.previews = null;
    this.hoverCell = -1;
    this.hoverDir = -1;
    this.drag = null;
    this.cursor = -1;
    this.keyMode = false;
    this.view = null;
    this.phases = [];
    this.ph = null;
    this.fast = 1;
    this.testSpeed = 1;
    this.fx = [];
    this.texts = [];
    this.cellFx = new Map();
    this.shake = 0;
    this.time = 0;
    this.celebrateT = -1;
    this.sadT = -1;
    this.shownScore = 0;
    this.scoreTarget = 0;
    this.sprites = new Map();
    this.spriteCell = 0;
    this.iconCache = new Map();
    this.floorCv = document.createElement("canvas");
    this.ui = new UI(this);
    this.bindInput();
    const ro = window.ResizeObserver ? new ResizeObserver(() => this.resize()) : null;
    if (ro) {
      ro.observe(field);
      for (const id of ["hud", "bar"]) {
        const el = document.getElementById(id);
        if (el) ro.observe(el);
      }
    }
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.mode === "play" && !this.run.over && !this.paused) this.ui.openPause();
    });
    this.resize();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    this.ui.showTitle();
  }

  applyReduced() {
    const r = this.save.data.settings.reduced;
    this.reduced = r == null ? !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) : !!r;
    document.body.classList.toggle("reduced", this.reduced);
  }

  /* ================================================================
   * 판 시작
   * ============================================================== */
  begin(kind, def, extra = {}) {
    this.phases = [];
    this.ph = null;
    this.fx = [];
    this.texts = [];
    this.cellFx.clear();
    this.celebrateT = -1;
    this.sadT = -1;
    this.sel = -1;
    this.previews = null;
    this.drag = null;
    this.paused = false;
    const state = E.create(def);
    this.run = { kind, def, start: state, state, limit: def.moves, over: false, ...extra };
    if (kind === "score") {
      this.run.rand = E.rng(extra.seed);
      E.spawn(state, SCORE_MODE.start, SCORE_MODE.colors, this.run.rand);
      this.run.start = E.clone(state);
    }
    this.view = state.pieces.slice();
    this.shownScore = 0;
    this.scoreTarget = 0;
    this.mode = "play";
    this.cursor = -1;
    this.relayout();
    // 도감: 처음 만난 친구
    const met = new Set();
    for (const p of state.pieces) {
      const k = dexKey(p);
      if (k) met.add(k);
    }
    for (const k of met) if (this.save.discover(k)) this.ui.discovered(k);
    this.tutorial = kind === "stage" && def.id === 1 ? 0 : -1;
    this.ui.enterPlay();
  }
  startStage(id) {
    const def = STAGES.find((s) => s.id === id);
    if (!def) return;
    this.begin("stage", def);
  }
  startScore() {
    const def = { id: "score", name: "점수 도전", map: SCORE_MODE.map, goals: [], moves: SCORE_MODE.moves };
    this.begin("score", def, { seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0 });
  }
  startDaily(date = seoulDate()) {
    this.begin("daily", dailyDef(date), { dailyKey: date });
  }
  restart() {
    const r = this.run;
    if (!r) return;
    this.skipIntro = true;
    if (r.kind === "stage") this.startStage(r.def.id);
    else if (r.kind === "daily") this.begin("daily", r.def, { dailyKey: r.dailyKey }); // 자정이 지나도 같은 퍼즐
    else this.startScore();
  }
  toMenu() {
    this.mode = "menu";
    this.run = null;
    this.phases = [];
    this.ph = null;
    this.fx = [];
    this.texts = [];
    this.sel = -1;
    this.previews = null;
    this.paused = false;
  }

  /* ================================================================
   * 화면 크기 · 보드 위치
   * ============================================================== */
  resize() {
    const r = this.field.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.relayout();
  }
  relayout() {
    if (!this.run) {
      this.L = null;
      return;
    }
    const { w, h } = this.run.state.board;
    const ins = this.ui.insets();
    const side = 10;
    const availW = Math.max(80, this.W - ins.left - ins.right - side * 2);
    const availH = Math.max(80, this.H - ins.top - ins.bottom - 12);
    const cell = Math.max(18, Math.floor(Math.min(availW / (w + 0.45), availH / (h + 0.45), 96)));
    const ox = Math.round(ins.left + side + (availW - w * cell) / 2);
    const oy = Math.round(ins.top + 6 + (availH - h * cell) / 2);
    this.L = { cell, ox, oy, w, h };
    if (cell !== this.spriteCell || this.dpr !== this.spriteDpr) {
      this.sprites.clear();
      this.spriteCell = cell;
      this.spriteDpr = this.dpr;
      this.ice = null;
    }
    // 바닥은 크기가 바뀔 때만 그려 둠
    this.floorCv.width = this.cv.width;
    this.floorCv.height = this.cv.height;
    const fc = this.floorCv.getContext("2d");
    fc.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    fc.clearRect(0, 0, this.W, this.H);
    drawFloor(fc, this.run.state.board, cell, ox, oy);
  }
  center(i) {
    const L = this.L;
    const x = i % L.w;
    const y = (i - x) / L.w;
    return { x: L.ox + (x + 0.5) * L.cell, y: L.oy + (y + 0.5) * L.cell };
  }
  cellAt(px, py) {
    const L = this.L;
    if (!L) return -1;
    const x = Math.floor((px - L.ox) / L.cell);
    const y = Math.floor((py - L.oy) / L.cell);
    if (x < 0 || y < 0 || x >= L.w || y >= L.h) return -1;
    return y * L.w + x;
  }
  /** 점검용: 칸 (x, y) 가운데의 화면 좌표 (clientX/Y) */
  cellPoint(x, y) {
    const r = this.cv.getBoundingClientRect();
    const c = this.center(y * this.L.w + x);
    return { x: r.left + c.x, y: r.top + c.y };
  }
  sprite(p) {
    let s = this.sprites.get(p);
    if (!s) {
      s = makePieceSprite(p, this.L.cell * this.dpr);
      this.sprites.set(p, s);
    }
    return s;
  }
  iceSprite() {
    if (!this.ice) this.ice = makeIceSprite(this.L.cell * this.dpr);
    return this.ice;
  }
  /** 화면 글자 옆에 쓰는 작은 그림 (data URL) */
  icon(key) {
    if (this.iconCache.has(key)) return this.iconCache.get(key);
    const S = 96;
    const cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const c = cv.getContext("2d");
    const cell = S / 1.25;
    const tileOf = { wall: E.WALL, sticky: E.STICKY, pad: E.PAD + 1, pipe: E.PIPE + 1 };
    if (key in tileOf) {
      const board = { w: 1, h: 1, tiles: Uint8Array.of(tileOf[key]), pipeAt: Int16Array.of(-1) };
      drawFloor(c, board, cell, (S - cell) / 2, (S - cell) / 2);
    } else if (key === "all") {
      // 여러 색 젤리 셋 (모두 없애기)
      const small = cell * 0.62;
      for (const [ci, x, y] of [
        [2, 0.3, 0.36],
        [1, 0.7, 0.36],
        [0, 0.5, 0.64],
      ]) {
        const spr = makePieceSprite(ci + 1, small);
        c.drawImage(spr.cv, S * x - spr.half, S * y - spr.half);
        c.save();
        c.translate(S * x, S * y + small * 0.02);
        drawFace(c, ci + 1, small * 0.38, "happy");
        c.restore();
      }
    } else {
      const p = { frozen: 11, crate: E.CRATE1, crate2: E.CRATE2, bolt: E.BOLT_H, boltv: E.BOLT_V, star: E.STAR, fluffy: E.FLUFFY, rainbow: E.RAINBOW }[key] ?? Number(key.slice(1)) + 1;
      const base = E.isFrozen(p) ? p - 10 : p;
      const spr = makePieceSprite(base, cell);
      c.drawImage(spr.cv, S / 2 - spr.half, S / 2 - spr.half - cell * 0.04);
      c.save();
      c.translate(S / 2, S / 2 - cell * 0.02);
      drawFace(c, p, cell * 0.38, E.isFrozen(p) ? "sleep" : "idle");
      c.restore();
      if (E.isFrozen(p)) {
        const ice = makeIceSprite(cell);
        c.drawImage(ice.cv, S / 2 - ice.half, S / 2 - ice.half);
      }
    }
    const url = cv.toDataURL();
    this.iconCache.set(key, url);
    return url;
  }

  /* ================================================================
   * 입력 (마우스 · 터치 · 펜 = 포인터 이벤트 · 키보드)
   * ============================================================== */
  pt(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canInput() {
    return this.mode === "play" && this.run && !this.run.over && !this.paused && !this.ui.modalOpen();
  }
  bindInput() {
    const cv = this.cv;
    cv.addEventListener("pointerdown", (e) => this.onDown(e));
    cv.addEventListener("pointermove", (e) => this.onMove(e));
    cv.addEventListener("pointerup", (e) => this.onUp(e));
    cv.addEventListener("pointercancel", () => {
      this.drag = null;
    });
    cv.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") {
        this.hoverCell = -1;
        this.hoverDir = -1;
      }
    });
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => this.onKey(e));
    // 첫 손길에 소리 열기
    const unlock = () => this.audio.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }
  onDown(e) {
    if (!this.canInput()) return;
    e.preventDefault();
    this.keyMode = false;
    if (this.busy()) {
      this.fast = 3; // 누르면 빨리 감기
      return;
    }
    const p = this.pt(e);
    const i = this.cellAt(p.x, p.y);
    if (this.sel >= 0) {
      const d = this.dirForTap(i, p);
      if (d >= 0) {
        this.commit(this.sel, d);
        return;
      }
    }
    const P = this.run.state.pieces;
    if (i >= 0 && E.movable(P[i])) {
      if (this.sel !== i) this.select(i);
      this.drag = { id: e.pointerId, x: p.x, y: p.y, i, dir: -1 };
      try {
        this.cv.setPointerCapture(e.pointerId);
      } catch (_) {}
    } else {
      if (i >= 0 && P[i] !== E.EMPTY) this.nudge(i);
      this.select(-1);
    }
  }
  onMove(e) {
    if (!this.L) return;
    const p = this.pt(e);
    if (e.pointerType === "mouse") {
      this.hoverCell = this.cellAt(p.x, p.y);
      this.hoverDir = this.sel >= 0 && !this.drag ? this.dirForTap(this.hoverCell, p) : -1;
    }
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const dist = Math.hypot(dx, dy);
    d.dir = dist < this.L.cell * 0.3 ? -1 : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    d.dist = dist;
  }
  onUp(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    if (!this.canInput() || this.busy()) return;
    if (d.dir >= 0) this.commit(d.i, d.dir);
  }
  /** 고른 젤리가 있을 때 누른 칸 → 그 방향 (경로 · 도착 칸 · 화살표) */
  dirForTap(i, p) {
    if (this.sel < 0 || !this.previews) return -1;
    if (i < 0 || i === this.sel) return -1;
    const hits = [];
    for (let d = 0; d < 4; d++) {
      const pv = this.previews[d];
      if (!pv) continue;
      if (pv.to === i) return d;
      if (pv.path.includes(i)) hits.push(d);
    }
    if (hits.length <= 1) return hits.length ? hits[0] : -1;
    // 경로가 겹치면 누른 쪽 방향
    const c = this.center(this.sel);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    return hits.includes(want) ? want : hits[0];
  }
  onKey(e) {
    const k = e.key;
    if (e.defaultPrevented || this.mode !== "play" || !this.run) return;
    if (this.ui.modalOpen()) return;
    if (k === "Escape" || k === "p" || k === "P") {
      if (this.sel >= 0 && k === "Escape") this.select(-1);
      else if (!this.run.over) this.ui.openPause();
      e.preventDefault();
      return;
    }
    if (!this.canInput()) return;
    if (k === "r" || k === "R") {
      this.ui.askRestart();
      return;
    }
    const dirKey = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 }[k];
    const L = this.L;
    if (dirKey != null) {
      e.preventDefault();
      this.keyMode = true;
      if (this.busy()) return;
      if (this.sel >= 0) {
        this.commit(this.sel, dirKey);
        return;
      }
      if (this.cursor < 0) this.cursor = this.firstMovable();
      else {
        const x = clamp((this.cursor % L.w) + E.DIRS[dirKey][0], 0, L.w - 1);
        const y = clamp(Math.floor(this.cursor / L.w) + E.DIRS[dirKey][1], 0, L.h - 1);
        this.cursor = y * L.w + x;
      }
      return;
    }
    if (k === "Enter" || k === " ") {
      e.preventDefault();
      this.keyMode = true;
      if (this.busy()) return;
      if (this.cursor < 0) {
        this.cursor = this.firstMovable();
        return;
      }
      if (this.sel === this.cursor) this.select(-1);
      else if (E.movable(this.run.state.pieces[this.cursor])) this.select(this.cursor);
      else this.nudge(this.cursor);
    }
  }
  firstMovable() {
    const P = this.run.state.pieces;
    for (let i = 0; i < P.length; i++) if (E.movable(P[i])) return i;
    return 0;
  }

  /* ================================================================
   * 고르기 · 미리 보기 · 이동
   * ============================================================== */
  select(i) {
    this.sel = i;
    this.hoverDir = -1;
    if (i < 0) {
      this.previews = null;
      return;
    }
    this.cursor = i;
    this.previews = [0, 1, 2, 3].map((d) => this.preview(i, d));
    this.cellFx.set(i, { kind: "pick", t: 0 });
    this.audio.play("select");
  }
  preview(i, d) {
    const s = this.run.state;
    const r = E.move(s, i, d);
    if (!r) return null;
    const mv = r.log[0];
    let dist = 0;
    for (let k = 1; k < mv.path.length; k++) if (this.adjacent(mv.path[k - 1], mv.path[k])) dist++;
    return {
      d,
      r,
      to: mv.to,
      path: mv.path,
      steps: mv.steps,
      dist,
      merge: r.log.find((e) => e.type === "merge") || null,
      specials: r.log.filter((e) => e.type === "special"),
      points: r.state.score - s.score,
    };
  }
  adjacent(a, b) {
    const w = this.L.w;
    return Math.abs((a % w) - (b % w)) + Math.abs(Math.floor(a / w) - Math.floor(b / w)) === 1;
  }
  nudge(i) {
    this.cellFx.set(i, { kind: "shake", t: 0 });
    this.audio.play("deny");
    const p = this.run.state.pieces[i];
    if (E.isFrozen(p)) this.ui.toast("꽁꽁 젤리는 못 움직여요 · 옆에서 같은 색을 이어 녹여 주세요");
    else if (E.isCrate(p)) this.ui.toast("쿠키 상자는 못 움직여요 · 옆에서 젤리를 이어 깨 주세요");
  }
  commit(i, d) {
    if (!this.canInput() || this.busy()) return false;
    const pv = this.sel === i && this.previews ? this.previews[d] : this.preview(i, d);
    if (!pv) {
      this.cellFx.set(i, { kind: "shake", t: 0, dir: d });
      this.audio.play("deny");
      this.ui.toast(`${E.DIR_NAMES[d]}으로는 막혀서 못 가요`);
      return false;
    }
    this.select(-1);
    this.drag = null;
    this.doMove(pv.r);
    return true;
  }
  doMove(r) {
    const run = this.run;
    this.view = run.state.pieces.slice();
    run.state = r.state;
    if (this.tutorial >= 0) this.tutorial++;
    for (const e of r.log) {
      if (e.type === "move") this.phases.push(this.phSlide(e));
      else if (e.type === "merge") this.phases.push(this.phMerge(e));
      else if (e.type === "special") this.phases.push(this.phSpecial(e));
      else if (e.type === "end") this.phases.push(this.phEnd(e));
    }
    if (run.kind === "score" && run.state.moves < run.limit) {
      const placed = E.spawn(run.state, SCORE_MODE.spawn[run.state.moves % 2], SCORE_MODE.colors, run.rand);
      if (placed.length) this.phases.push(this.phSpawn(placed.map((i) => [i, run.state.pieces[i]])));
    }
    this.phases.push({ dur: 0, finish: () => this.afterMove() });
    this.ui.hud(true);
  }
  busy() {
    return !!this.ph || this.phases.length > 0;
  }

  /* ---------------- 연출 단계 ---------------- */
  phSlide(e) {
    const segs = [];
    let t = 0;
    const path = e.path;
    for (let k = 1; k < path.length; k++) {
      const a = path[k - 1];
      const b = path[k];
      if (this.adjacent(a, b)) {
        const dur = k === 1 ? 0.075 : 0.052;
        segs.push({ a, b, t0: t, t1: t + dur, warp: false });
        t += dur;
      } else {
        segs.push({ a, b, t0: t, t1: t + 0.24, warp: true });
        t += 0.24;
      }
    }
    const tiles = this.run.state.board.tiles;
    let seen = 0;
    const ph = {
      dur: Math.max(0.08, t),
      begin: () => {
        this.view[e.from] = E.EMPTY;
        this.audio.play("slide", { n: segs.length });
      },
      tick: () => {
        // 지나가는 장치 소리 · 효과
        while (seen < segs.length && ph.t >= segs[seen].t1) {
          const s = segs[seen++];
          if (s.warp) this.audio.play("pipe");
          else if (E.isPad(tiles[s.b]) && s.b !== e.to) {
            this.audio.play("pad");
            this.cellFx.set(s.b, { kind: "boing", t: 0 });
          }
        }
      },
      draw: (ctx) => {
        const tt = ph.t;
        let s = segs[segs.length - 1];
        for (const q of segs) if (tt <= q.t1) {
          s = q;
          break;
        }
        const k = clamp((tt - s.t0) / (s.t1 - s.t0), 0, 1);
        const A = this.center(s.a);
        const B = this.center(s.b);
        if (s.warp) {
          // 파이프로 쏙 → 짝 파이프에서 뿅
          const inP = k < 0.5;
          const q = inP ? 1 - k * 2 : (k - 0.5) * 2;
          const at = inP ? A : B;
          this.drawPiece(ctx, e.piece, at.x, at.y, { sx: q, sy: q, rot: (1 - q) * 3, expr: "surprise", alpha: 0.3 + 0.7 * q });
          return;
        }
        const x = lerp(A.x, B.x, k);
        const y = lerp(A.y, B.y, k);
        const horiz = A.y === B.y;
        const st = 0.24;
        this.drawPiece(ctx, e.piece, x, y, { sx: horiz ? 1 + st : 1 - st * 0.6, sy: horiz ? 1 - st * 0.6 : 1 + st, expr: "surprise", anchor: "center" });
      },
      finish: () => {
        this.view[e.to] = e.piece;
        this.cellFx.set(e.to, { kind: "land", t: 0, dir: e.dir });
        const last = e.steps[e.steps.length - 1];
        if (last && last.kind === "sticky") {
          this.audio.play("sticky");
          this.burst(e.to, { n: 8, color: "#ff8cc6", speed: 1.2, size: 0.07, kind: "dot" });
        } else this.audio.play("land");
      },
    };
    return ph;
  }
  phMerge(e) {
    const J = JELLIES[e.color];
    const moving = [];
    const ph = {
      dur: 0.34,
      begin: () => {
        for (const c of e.cells) {
          moving.push([c, this.view[c]]);
          this.view[c] = E.EMPTY;
        }
        this.audio.play("merge", { n: e.cells.length, combo: this.run.state.combo });
      },
      draw: (ctx) => {
        const k = clamp(ph.t / ph.dur, 0, 1);
        const T = this.center(e.anchor);
        const cell = this.L.cell;
        // 끈적하게 당겨지는 다리
        ctx.save();
        ctx.lineCap = "round";
        ctx.strokeStyle = J.c[1];
        ctx.globalAlpha = 0.85;
        for (const [c] of moving) {
          if (c === e.anchor) continue;
          const A = this.center(c);
          const q = easeIn(k);
          ctx.lineWidth = cell * (0.42 - 0.22 * k);
          ctx.beginPath();
          ctx.moveTo(lerp(A.x, T.x, q), lerp(A.y, T.y, q));
          ctx.lineTo(T.x, T.y);
          ctx.stroke();
        }
        ctx.restore();
        for (const [c, p] of moving) {
          const A = this.center(c);
          const q = c === e.anchor ? 0 : easeIn(k);
          const x = lerp(A.x, T.x, q);
          const y = lerp(A.y, T.y, q);
          const horiz = Math.abs(T.x - A.x) > Math.abs(T.y - A.y);
          const st = c === e.anchor ? 0 : 0.3 * Math.sin(k * Math.PI);
          const sc = c === e.anchor ? 1 + 0.18 * Math.sin(k * Math.PI) : 1 - 0.35 * k;
          this.drawPiece(ctx, p, x, y, { sx: sc * (horiz ? 1 + st : 1 - st * 0.5), sy: sc * (horiz ? 1 - st * 0.5 : 1 + st), expr: "happy", anchor: "center" });
        }
      },
      finish: () => {
        const T = this.center(e.anchor);
        const n = e.cells.length;
        this.burst(e.anchor, { n: this.reduced ? 8 : 14 + n * 3, color: J.c[1], speed: 2.2 + n * 0.15, size: 0.09, kind: "dot" });
        this.burst(e.anchor, { n: this.reduced ? 2 : 6, color: "#ffffff", speed: 1.6, size: 0.07, kind: "star" });
        this.fx.push({ kind: "ring", x: T.x, y: T.y, t: 0, life: 0.4, color: J.c[1], r0: 0.3, r1: 0.9 + n * 0.08 });
        if (e.special) {
          this.view[e.anchor] = e.special;
          this.cellFx.set(e.anchor, { kind: "pop", t: 0 });
          this.audio.play("make");
          this.burst(e.anchor, { n: 10, color: "#fff2a0", speed: 2.6, size: 0.1, kind: "star" });
          const k = dexKey(e.special);
          if (this.save.discover(k)) this.ui.discovered(k);
        }
        for (const q of e.cracked) {
          this.view[q] = E.CRATE1;
          this.cellFx.set(q, { kind: "shake", t: 0 });
          this.burst(q, { n: 6, color: "#c98a4e", speed: 1.4, size: 0.07, kind: "crumb" });
          this.audio.play("crate");
        }
        for (const q of e.broke) {
          this.ghost(q, this.view[q]);
          this.view[q] = E.EMPTY;
          this.burst(q, { n: 12, color: "#d9a066", speed: 2, size: 0.09, kind: "crumb" });
          this.audio.play("crate");
        }
        for (const q of e.thaw) {
          this.view[q] = this.view[q] - 10;
          this.cellFx.set(q, { kind: "pop", t: 0 });
          this.burst(q, { n: 10, color: "#bfe6ff", speed: 1.8, size: 0.08, kind: "shard" });
          this.audio.play("ice");
        }
        this.scoreTarget += e.points || 0;
        this.floatText(T.x, T.y - this.L.cell * 0.2, `+${e.points}`, J.c[2], n >= 4 ? 1.25 : 1);
        if (e.special) this.floatText(T.x, T.y + this.L.cell * 0.35, specialName(e.special) + "!", "#7a4ad0", 0.8, 0.15);
        if (n >= 4 && !this.reduced) this.shake = Math.max(this.shake, 0.12);
      },
    };
    return ph;
  }
  phSpecial(e) {
    const dur = { [E.BOLT_H]: 0.4, [E.BOLT_V]: 0.4, [E.STAR]: 0.38, [E.FLUFFY]: 0.44, [E.RAINBOW]: 0.55 }[e.piece];
    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      for (const i of e.hit) {
        const p = this.view[i];
        if (e.piece === E.FLUFFY && E.isFrozen(p)) {
          this.view[i] = p - 10;
          this.cellFx.set(i, { kind: "pop", t: 0 });
          this.burst(i, { n: 8, color: "#bfe6ff", speed: 1.6, size: 0.08, kind: "shard" });
          continue;
        }
        this.ghost(i, p);
        this.view[i] = E.EMPTY;
        const col = E.isJelly(p) ? JELLIES[E.colorOf(p)].c[1] : E.isCrate(p) ? "#d9a066" : "#ffffff";
        this.burst(i, { n: this.reduced ? 3 : 7, color: col, speed: 1.6, size: 0.08, kind: E.isCrate(p) ? "crumb" : "dot" });
      }
      this.scoreTarget += e.points || 0;
      const T = this.center(e.pos);
      if (e.points) this.floatText(T.x, T.y - this.L.cell * 0.2, `+${e.points}`, "#e0679a", 1.1);
      if (e.depth > 0) this.floatText(T.x, T.y + this.L.cell * 0.35, "연쇄!", "#7a4ad0", 0.8, 0.1);
    };
    const ph = {
      dur,
      begin: () => {
        this.view[e.pos] = E.EMPTY;
        const name = { [E.BOLT_H]: "bolt", [E.BOLT_V]: "bolt", [E.STAR]: "star", [E.FLUFFY]: "fluffy", [E.RAINBOW]: "rainbow" }[e.piece];
        this.audio.play(name);
        if (!this.reduced) this.shake = Math.max(this.shake, e.piece === E.FLUFFY ? 0.08 : 0.18);
      },
      tick: (k) => {
        if (k >= 0.42) apply();
      },
      draw: (ctx) => this.drawSpecialFx(ctx, e, clamp(ph.t / ph.dur, 0, 1)),
      finish: apply,
    };
    return ph;
  }
  phEnd(e) {
    return {
      dur: 0,
      finish: () => {
        if (e.combo >= 2 && e.points > 0) {
          this.ui.combo(e.combo);
          this.audio.play("combo", { combo: e.combo });
        }
      },
    };
  }
  phSpawn(list) {
    const ph = {
      dur: 0.3,
      begin: () => this.audio.play("spawn"),
      draw: (ctx) => {
        const k = clamp(ph.t / ph.dur, 0, 1);
        for (const [i, p] of list) {
          const c = this.center(i);
          this.drawPiece(ctx, p, c.x, c.y - (1 - easeOut(k)) * this.L.cell * 1.1, { alpha: k, sx: 0.85 + 0.15 * k, sy: 1.1 - 0.1 * k, expr: "surprise" });
        }
      },
      finish: () => {
        for (const [i, p] of list) {
          this.view[i] = p;
          this.cellFx.set(i, { kind: "land", t: 0, dir: 2 });
        }
      },
    };
    return ph;
  }

  /** 모든 연출이 끝난 뒤: 깼나 · 끝났나 */
  afterMove() {
    const run = this.run;
    const s = run.state;
    // 화면 상태와 규칙 상태가 같은지 (다르면 규칙 쪽으로 맞춤)
    for (let i = 0; i < s.pieces.length; i++)
      if (this.view[i] !== s.pieces[i]) {
        console.warn("화면 · 규칙 상태가 달라 맞췄어요", i, this.view[i], s.pieces[i]);
        this.view = s.pieces.slice();
        break;
      }
    this.fast = 1;
    this.scoreTarget = s.score;
    this.ui.hud();
    if (run.kind === "score") {
      if (s.moves >= run.limit) return this.endScore("moves");
      if (!E.validMoves(s).length) return this.endScore("stuck");
      return;
    }
    if (E.goalsDone(s, run.def.goals, run.start)) return this.win();
    if (s.moves >= run.limit) return this.lose("moves");
    if (!E.validMoves(s).length) return this.lose("stuck");
    if (hopeless(s, run.def.goals)) return this.lose("hopeless");
  }
  win() {
    const run = this.run;
    const s = run.state;
    run.over = true;
    const stars = E.starsFor(s.moves, run.def.par, run.def.moves);
    this.celebrateT = this.time;
    this.audio.play("clear");
    this.confetti();
    let rec = null;
    if (run.kind === "stage") rec = this.save.recordStage(run.def.id, { stars, moves: s.moves, score: s.score });
    else rec = this.save.recordDaily(run.dailyKey, { ok: true, stars, moves: s.moves, score: s.score });
    this.ui.flash("공장 가동 성공!");
    setTimeout(() => {
      if (this.run === run) this.ui.result({ ok: true, run, stars, rec });
    }, this.reduced ? 700 : 1400);
  }
  lose(reason) {
    const run = this.run;
    run.over = true;
    this.sadT = this.time;
    this.audio.play("fail");
    if (run.kind === "daily") this.save.recordDaily(run.dailyKey, { ok: false });
    setTimeout(() => {
      if (this.run === run) this.ui.result({ ok: false, run, reason });
    }, 900);
  }
  endScore(reason) {
    const run = this.run;
    const s = run.state;
    run.over = true;
    const before = this.save.data.score.best;
    const newBest = this.save.recordScore({ score: s.score, maxGroup: s.maxGroup, maxCombo: s.maxCombo });
    if (newBest && s.score > 0) {
      this.audio.play("best");
      this.confetti();
      this.celebrateT = this.time;
    } else this.audio.play("clear");
    this.ui.flash(reason === "stuck" ? "더 움직일 젤리가 없어요" : "이동 끝!");
    setTimeout(() => {
      if (this.run === run) this.ui.scoreResult({ run, newBest: newBest && s.score > 0, before, reason });
    }, 1100);
  }

  /* ================================================================
   * 효과
   * ============================================================== */
  burst(i, { n = 10, color = "#fff", speed = 2, size = 0.08, kind = "dot" } = {}) {
    if (!this.L) return;
    const c = this.center(i);
    const cell = this.L.cell;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU;
      const v = (0.5 + Math.random()) * speed * cell;
      this.fx.push({ kind, x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - cell * 0.8, t: 0, life: 0.45 + Math.random() * 0.35, color, size: size * cell * (0.7 + Math.random() * 0.6), rot: Math.random() * TAU });
    }
  }
  ghost(i, p) {
    if (p === E.EMPTY) return;
    const c = this.center(i);
    this.fx.push({ kind: "ghost", x: c.x, y: c.y, p, t: 0, life: 0.26 });
  }
  floatText(x, y, text, color, scale = 1, delay = 0) {
    this.texts.push({ x, y, text, color, scale, t: -delay, life: 0.95 });
  }
  confetti() {
    const n = this.reduced ? 24 : 90;
    const cols = ["#ff8cc6", "#ffe066", "#8fd8ff", "#8ee69a", "#c4a6ff", "#ffbb73"];
    for (let k = 0; k < n; k++) {
      this.fx.push({ kind: "confetti", x: Math.random() * this.W, y: -20 - Math.random() * this.H * 0.3, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, t: 0, life: 2.4 + Math.random(), color: cols[k % 6], size: 6 + Math.random() * 6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10 });
    }
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  loop(ts) {
    const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    if (!this.paused) {
      this.time += dt;
      this.update(dt);
    }
    try {
      this.draw();
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((t) => this.loop(t));
  }
  update(dt) {
    this.stepPhases(dt * this.fast * this.testSpeed);
    for (const [i, f] of this.cellFx) {
      f.t += dt;
      if (f.t > 0.6) this.cellFx.delete(i);
    }
    const g = this.L ? this.L.cell * 4.5 : 300;
    this.fx = this.fx.filter((f) => {
      f.t += dt;
      if (f.vx != null) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.kind === "confetti") {
          f.vx *= 0.99;
          f.rot += f.vr * dt;
        } else f.vy += g * dt;
      }
      return f.t < f.life;
    });
    this.texts = this.texts.filter((t) => (t.t += dt) < t.life);
    this.shake = Math.max(0, this.shake - dt);
    if (this.run) {
      // 점수는 연출에서 보여 준 만큼 따라 올라감
      if (this.shownScore < this.scoreTarget) this.shownScore = Math.min(this.scoreTarget, this.shownScore + Math.max(4, (this.scoreTarget - this.shownScore) * dt * 9));
      this.ui.paintScore(Math.round(this.shownScore));
    }
  }
  stepPhases(dt) {
    for (let guard = 0; guard < 30; guard++) {
      if (!this.ph) {
        if (!this.phases.length) return;
        this.ph = this.phases.shift();
        this.ph.t = 0;
        if (this.ph.begin) this.ph.begin();
      }
      const ph = this.ph;
      ph.t += dt;
      dt = 0;
      if (ph.tick) ph.tick(ph.dur ? clamp(ph.t / ph.dur, 0, 1) : 1);
      if (ph.t >= ph.dur) {
        dt = ph.t - ph.dur;
        this.ph = null;
        if (ph.finish) ph.finish();
        continue;
      }
      return;
    }
  }

  /* ================================================================
   * 그리기
   * ============================================================== */
  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.mode !== "play" || !this.run || !this.L) {
      this.drawTitleScene(ctx);
      this.drawFx(ctx);
      return;
    }
    ctx.save();
    if (this.shake > 0) {
      const a = this.shake * this.L.cell * 0.5;
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.floorCv, 0, 0);
    ctx.restore();
    if (this.previews && !this.busy()) this.drawPreviewUnder(ctx);
    this.drawPieces(ctx);
    if (this.ph && this.ph.draw) this.ph.draw(ctx);
    if (this.previews && !this.busy()) this.drawPreviewOver(ctx);
    if (this.tutorial >= 0 && !this.busy() && !this.run.over) this.drawTutorial(ctx);
    if (this.keyMode && this.cursor >= 0 && !this.busy()) this.drawCursor(ctx);
    ctx.restore();
    this.drawFx(ctx);
  }
  drawPieces(ctx) {
    const V = this.view;
    const L = this.L;
    const cell = L.cell;
    const t = this.time;
    const look = this.sel >= 0 ? this.center(this.sel) : this.hoverCell >= 0 ? this.center(this.hoverCell) : null;
    const party = this.celebrateT >= 0 && t - this.celebrateT < 2.2;
    const sad = this.sadT >= 0;
    for (let i = 0; i < V.length; i++) {
      const p = V[i];
      if (p === E.EMPTY) continue;
      const c = this.center(i);
      const o = { sx: 1, sy: 1, dx: 0, dy: 0, expr: "idle", lx: 0, ly: 0 };
      if (!E.isCrate(p)) {
        // 숨쉬기 · 깜빡임 · 바라보기
        const b = Math.sin(t * 2.4 + i * 0.9) * 0.03;
        o.sx = 1 + b;
        o.sy = 1 - b;
        if ((t + i * 1.37) % 4.3 < 0.13) o.expr = "blink";
        if (look && i !== this.sel) {
          const dx = look.x - c.x;
          const dy = look.y - c.y;
          const m = Math.hypot(dx, dy) || 1;
          o.lx = dx / m;
          o.ly = dy / m;
        }
        if (E.isFrozen(p)) o.expr = "sleep";
        if (i === this.sel) {
          o.expr = "happy";
          const j = Math.abs(Math.sin(t * 7));
          o.dy = -j * cell * 0.08;
          o.sy = 1 + j * 0.05;
          o.sx = 1 - j * 0.03;
        }
        if (party && !E.isFrozen(p)) {
          o.expr = "happy";
          o.dy = -Math.abs(Math.sin((t - this.celebrateT) * 8 + i)) * cell * 0.14;
        } else if (sad) o.expr = "squish";
      }
      const f = this.cellFx.get(i);
      if (f) this.applyCellFx(f, o, cell);
      this.drawPiece(ctx, p, c.x + o.dx, c.y + o.dy, o);
    }
  }
  applyCellFx(f, o, cell) {
    const t = f.t;
    if (f.kind === "land") {
      const a = Math.exp(-t * 8) * Math.cos(t * 24) * 0.32;
      const vert = f.dir === 0 || f.dir === 2;
      if (vert) {
        o.sy *= 1 - a;
        o.sx *= 1 + a * 0.7;
      } else {
        o.sx *= 1 - a;
        o.sy *= 1 + a * 0.7;
        o.dx += (f.dir === 1 ? 1 : -1) * a * cell * 0.12;
      }
      if (t < 0.25) o.expr = "squish";
    } else if (f.kind === "shake") {
      if (t < 0.35) o.dx += Math.sin(t * 60) * cell * 0.07 * (1 - t / 0.35);
      if (t < 0.35 && o.expr !== "sleep") o.expr = "squish";
    } else if (f.kind === "pop") {
      const k = clamp(t / 0.32, 0, 1);
      const s = k < 1 ? easeOutBack(k) : 1;
      o.sx *= s;
      o.sy *= s;
    } else if (f.kind === "pick") {
      const a = Math.exp(-t * 9) * Math.sin(t * 30) * 0.15;
      o.sy *= 1 + a;
      o.sx *= 1 - a * 0.6;
    }
  }
  /** 놓인 것 하나 그리기 (발밑 기준으로 늘이고 줄임) */
  drawPiece(ctx, p, x, y, o = {}) {
    const cell = this.L.cell;
    const frozen = E.isFrozen(p);
    const base = frozen ? p - 10 : p;
    const spr = this.sprite(base);
    const size = spr.cv.width / this.dpr;
    const foot = o.anchor === "center" ? 0 : cell * 0.34;
    ctx.save();
    if (o.alpha != null && o.alpha < 1) ctx.globalAlpha = Math.max(0, o.alpha);
    ctx.translate(x, y + foot);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(o.sx ?? 1, o.sy ?? 1);
    ctx.translate(0, -foot);
    ctx.drawImage(spr.cv, -size / 2, -size / 2, size, size);
    if (!E.isCrate(p)) {
      ctx.translate(0, cell * 0.02);
      drawFace(ctx, p, cell * 0.38, o.expr || "idle", o.lx || 0, o.ly || 0);
      ctx.translate(0, -cell * 0.02);
    }
    if (frozen) {
      const ice = this.iceSprite();
      const s2 = ice.cv.width / this.dpr;
      ctx.drawImage(ice.cv, -s2 / 2, -s2 / 2, s2, s2);
    }
    ctx.restore();
  }

  /* ---------------- 미리 보기 ---------------- */
  focusDir() {
    if (this.drag && this.drag.dir >= 0) return this.drag.dir;
    return this.hoverDir;
  }
  drawPreviewUnder(ctx) {
    const cell = this.L.cell;
    const fd = this.focusDir();
    for (const pv of this.previews) {
      if (!pv) continue;
      const on = fd < 0 || fd === pv.d;
      const a = on ? 1 : 0.25;
      // 합쳐질 무리 (같은 색 테두리)
      if (pv.merge) {
        const J = JELLIES[pv.merge.color];
        ctx.save();
        ctx.globalAlpha = 0.55 * a;
        ctx.fillStyle = J.c[1];
        for (const c of pv.merge.cells) {
          const C = this.center(c);
          rr(ctx, C.x - cell * 0.47, C.y - cell * 0.47, cell * 0.94, cell * 0.94, cell * 0.22);
          ctx.fill();
        }
        ctx.restore();
      }
      // 특수 효과: 고른 방향이면 닿는 범위 전체, 아니면 실제로 없어질 것만
      for (const sp of pv.specials) {
        ctx.save();
        ctx.fillStyle = sp.piece === E.FLUFFY ? "#9fd3ff" : "#ffd84a";
        if (fd === pv.d) {
          ctx.globalAlpha = 0.22;
          for (const c of sp.cells) {
            const C = this.center(c);
            rr(ctx, C.x - cell * 0.46, C.y - cell * 0.46, cell * 0.92, cell * 0.92, cell * 0.2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = (0.5 + 0.15 * Math.sin(this.time * 6)) * a;
        for (const c of sp.hit) {
          const C = this.center(c);
          rr(ctx, C.x - cell * 0.47, C.y - cell * 0.47, cell * 0.94, cell * 0.94, cell * 0.22);
          ctx.fill();
        }
        ctx.restore();
      }
      // 경로 점
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(122,74,208,0.55)";
      for (let k = 1; k < pv.path.length - 1; k++) {
        const C = this.center(pv.path[k]);
        ctx.beginPath();
        ctx.arc(C.x, C.y, cell * 0.08, 0, TAU);
        ctx.fill();
      }
      // 도착 칸
      const T = this.center(pv.to);
      ctx.setLineDash([cell * 0.12, cell * 0.08]);
      ctx.lineWidth = Math.max(2, cell * 0.05);
      ctx.strokeStyle = pv.merge ? JELLIES[pv.merge.color].c[2] : "rgba(122,74,208,0.8)";
      rr(ctx, T.x - cell * 0.44, T.y - cell * 0.44, cell * 0.88, cell * 0.88, cell * 0.22);
      ctx.stroke();
      ctx.restore();
    }
  }
  drawPreviewOver(ctx) {
    const cell = this.L.cell;
    const fd = this.focusDir();
    const S = this.center(this.sel);
    const piece = this.run.state.pieces[this.sel];
    for (let d = 0; d < 4; d++) {
      const pv = this.previews[d];
      const [dx, dy] = E.DIRS[d];
      const ax = S.x + dx * cell * 0.62;
      const ay = S.y + dy * cell * 0.62;
      if (!pv) {
        // 못 가는 쪽: 흐린 X
        if (fd === d) {
          ctx.save();
          ctx.strokeStyle = "rgba(200,60,90,0.8)";
          ctx.lineWidth = Math.max(2, cell * 0.06);
          ctx.lineCap = "round";
          const r = cell * 0.12;
          ctx.beginPath();
          ctx.moveTo(ax - r, ay - r);
          ctx.lineTo(ax + r, ay + r);
          ctx.moveTo(ax + r, ay - r);
          ctx.lineTo(ax - r, ay + r);
          ctx.stroke();
          ctx.restore();
        }
        continue;
      }
      const on = fd < 0 || fd === d;
      // 도착 자리 유령
      const T = this.center(pv.to);
      this.drawPiece(ctx, piece, T.x, T.y, { alpha: on ? 0.5 : 0.18, expr: pv.merge ? "happy" : "idle" });
      // 방향 화살표
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.35;
      ctx.translate(ax, ay);
      ctx.rotate((d * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(0, -cell * 0.17);
      ctx.lineTo(cell * 0.15, cell * 0.06);
      ctx.lineTo(-cell * 0.15, cell * 0.06);
      ctx.closePath();
      ctx.fillStyle = pv.merge || pv.specials.length ? "#ff5fa2" : "#7a4ad0";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, cell * 0.045);
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      if (!on) continue;
      // 거리 · 결과 이름표
      let label = `${pv.dist}칸`;
      if (pv.merge) label += ` · ${pv.merge.cells.length}개 합체`;
      else if (pv.specials.length) {
        const n = pv.specials.reduce((a, sp) => a + sp.hit.length, 0);
        label += n ? ` · 펑! ${n}개` : " · 펑!";
      }
      this.pill(ctx, T.x, T.y - cell * 0.62, label, pv.merge || pv.specials.length ? "#ff5fa2" : "#7a4ad0");
      if (pv.merge && pv.merge.special) {
        const spr = this.sprite(pv.merge.special);
        const s = (spr.cv.width / this.dpr) * 0.42;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.drawImage(spr.cv, T.x + cell * 0.18, T.y - cell * 0.5, s, s);
        ctx.restore();
      }
    }
  }
  pill(ctx, x, y, text, color) {
    const cell = this.L.cell;
    const fs = Math.max(11, Math.round(cell * 0.24));
    ctx.save();
    ctx.font = `${fs}px Jua, sans-serif`;
    const w = ctx.measureText(text).width + fs;
    const h = fs * 1.5;
    const L = this.L;
    x = clamp(x, L.ox + w / 2 - cell * 0.3, L.ox + L.w * cell - w / 2 + cell * 0.3);
    y = Math.max(y, h / 2 + 2);
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }
  drawTutorial(ctx) {
    const sol = this.run.def.sol;
    const step = sol && sol[this.tutorial];
    if (!step || this.run.state.moves !== this.tutorial) return;
    const [x, y, d] = step;
    const i = y * this.L.w + x;
    // 다른 길로 갔으면 (그 젤리가 없거나 그쪽으로 못 감) 손가락 안내는 그만
    if (!E.movable(this.run.state.pieces[i]) || !E.slide(this.run.state, i, d).valid) return;
    const cell = this.L.cell;
    const C = this.center(i);
    const k = (this.time % 1.2) / 1.2;
    const sel = this.sel === i;
    // 손가락: 젤리를 누르고 → 방향으로 밀기
    const [dx, dy] = E.DIRS[d];
    const m = sel ? easeOut(k) * 0.9 : 0;
    const hx = C.x + cell * 0.18 + dx * cell * m;
    const hy = C.y + cell * 0.3 + dy * cell * m;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = `${Math.round(cell * 0.6)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👆", hx, hy + Math.sin(this.time * 6) * cell * 0.04);
    if (!sel) {
      ctx.strokeStyle = "rgba(255,95,162,0.9)";
      ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.beginPath();
      ctx.arc(C.x, C.y, cell * (0.5 + 0.1 * Math.sin(this.time * 6)), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawCursor(ctx) {
    const cell = this.L.cell;
    const C = this.center(this.cursor);
    ctx.save();
    ctx.strokeStyle = "#7a5af0";
    ctx.lineWidth = Math.max(2.5, cell * 0.07);
    ctx.setLineDash([cell * 0.14, cell * 0.08]);
    ctx.lineDashOffset = -this.time * cell * 0.5;
    rr(ctx, C.x - cell * 0.48, C.y - cell * 0.48, cell * 0.96, cell * 0.96, cell * 0.24);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- 특수 젤리 효과 ---------------- */
  drawSpecialFx(ctx, e, k) {
    const L = this.L;
    const cell = L.cell;
    const C = this.center(e.pos);
    ctx.save();
    if (e.piece === E.BOLT_H || e.piece === E.BOLT_V) {
      const horiz = e.piece === E.BOLT_H;
      const ext = easeOut(Math.min(1, k * 1.8)) * (horiz ? L.w : L.h) * cell;
      const th = cell * 0.62 * Math.sin(Math.PI * Math.min(1, k * 1.1));
      const x0 = horiz ? Math.max(L.ox, C.x - ext) : C.x - th / 2;
      const x1 = horiz ? Math.min(L.ox + L.w * cell, C.x + ext) : C.x + th / 2;
      const y0 = horiz ? C.y - th / 2 : Math.max(L.oy, C.y - ext);
      const y1 = horiz ? C.y + th / 2 : Math.min(L.oy + L.h * cell, C.y + ext);
      const g = horiz ? ctx.createLinearGradient(0, y0, 0, y1) : ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, "rgba(255,214,60,0)");
      g.addColorStop(0.5, "rgba(255,255,230,0.95)");
      g.addColorStop(1, "rgba(255,214,60,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      // 지그재그 번개
      ctx.strokeStyle = "rgba(255,200,40,0.95)";
      ctx.lineWidth = Math.max(2, cell * 0.06);
      ctx.lineJoin = "round";
      ctx.beginPath();
      const n = Math.max(4, Math.round(ext / (cell * 0.35)));
      for (let s = -n; s <= n; s++) {
        const q = (s / n) * ext;
        const jit = (Math.random() - 0.5) * th * 0.7;
        const px = horiz ? C.x + q : C.x + jit;
        const py = horiz ? C.y + jit : C.y + q;
        if (s === -n) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (e.piece === E.STAR) {
      const r = cell * 1.5 * easeOut(k);
      ctx.globalAlpha = 1 - k * 0.8;
      ctx.fillStyle = "rgba(255,230,120,0.35)";
      rr(ctx, C.x - cell * 1.5, C.y - cell * 1.5, cell * 3, cell * 3, cell * 0.4);
      ctx.fill();
      ctx.translate(C.x, C.y);
      ctx.rotate(k * 2);
      star5(ctx, 0, 0, r, 0.45);
      ctx.fillStyle = "rgba(255,240,150,0.85)";
      ctx.fill();
      ctx.lineWidth = Math.max(2, cell * 0.05);
      ctx.strokeStyle = "#ffb000";
      ctx.stroke();
    } else if (e.piece === E.FLUFFY) {
      ctx.globalAlpha = 1 - k;
      for (let a = 0; a < 10; a++) {
        const ang = (a / 10) * TAU + k;
        const rad = cell * 2.2 * easeOut(k);
        ctx.beginPath();
        ctx.arc(C.x + Math.cos(ang) * rad, C.y + Math.sin(ang) * rad, cell * (0.35 + 0.25 * (1 - k)), 0, TAU);
        ctx.fillStyle = a % 2 ? "rgba(255,255,255,0.95)" : "rgba(255,230,248,0.95)";
        ctx.fill();
      }
      ctx.fillStyle = "rgba(190,230,255,0.3)";
      rr(ctx, C.x - cell * 2.5, C.y - cell * 2.5, cell * 5, cell * 5, cell * 0.5);
      ctx.fill();
    } else if (e.piece === E.RAINBOW) {
      const cols = ["#ff7a8a", "#ffad5a", "#ffe066", "#7fe08a", "#6cc6ff", "#a88cff"];
      ctx.lineCap = "round";
      e.hit.forEach((i, n) => {
        const q = clamp(k * 1.8 - n * 0.04, 0, 1);
        if (q <= 0) return;
        const T = this.center(i);
        ctx.strokeStyle = cols[n % 6];
        ctx.globalAlpha = 1 - Math.max(0, k - 0.6) * 2.5;
        ctx.lineWidth = Math.max(2, cell * 0.12);
        ctx.beginPath();
        ctx.moveTo(C.x, C.y);
        ctx.lineTo(lerp(C.x, T.x, q), lerp(C.y, T.y, q));
        ctx.stroke();
      });
      ctx.globalAlpha = 1 - k;
      for (let a = 0; a < 6; a++) {
        ctx.beginPath();
        ctx.arc(C.x, C.y, cell * (0.4 + a * 0.12) * (0.5 + k), 0, TAU);
        ctx.strokeStyle = cols[a];
        ctx.lineWidth = Math.max(2, cell * 0.06);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawFx(ctx) {
    for (const f of this.fx) {
      const k = f.t / f.life;
      ctx.save();
      if (f.kind === "ghost") {
        if (!this.L) {
          ctx.restore();
          continue;
        }
        this.drawPiece(ctx, f.p, f.x, f.y, { sx: 1 + k * 0.5, sy: 1 + k * 0.5, alpha: 1 - k, expr: "surprise", anchor: "center" });
      } else if (f.kind === "ring") {
        const cell = this.L ? this.L.cell : 40;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = Math.max(2, cell * 0.08 * (1 - k));
        ctx.beginPath();
        ctx.arc(f.x, f.y, cell * lerp(f.r0, f.r1, easeOut(k)), 0, TAU);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
        ctx.fillStyle = f.color;
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot + (f.kind === "confetti" ? 0 : f.t * 6));
        if (f.kind === "star") {
          star5(ctx, 0, 0, f.size, 0.45);
          ctx.fill();
        } else if (f.kind === "shard") {
          ctx.beginPath();
          ctx.moveTo(0, -f.size);
          ctx.lineTo(f.size * 0.5, f.size * 0.6);
          ctx.lineTo(-f.size * 0.5, f.size * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (f.kind === "crumb") {
          ctx.fillRect(-f.size / 2, -f.size / 2, f.size, f.size * 0.8);
        } else if (f.kind === "confetti") {
          ctx.fillRect(-f.size / 2, -f.size / 4, f.size, f.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, f.size, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          ctx.beginPath();
          ctx.arc(-f.size * 0.3, -f.size * 0.3, f.size * 0.35, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    // 점수 글자
    for (const t of this.texts) {
      if (t.t < 0) continue;
      const k = t.t / t.life;
      const cell = this.L ? this.L.cell : 44;
      const fs = Math.round(cell * 0.42 * t.scale * (k < 0.15 ? easeOutBack(k / 0.15) : 1));
      if (fs < 2) continue;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `${fs}px "Bagel Fat One", Jua, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(3, fs * 0.18);
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#ffffff";
      const y = t.y - easeOut(Math.min(1, k * 1.5)) * cell * 0.6;
      ctx.strokeText(t.text, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, y);
      ctx.restore();
    }
  }

  /* ---------------- 첫 화면 공장 (컨베이어 위 젤리들) ---------------- */
  drawTitleScene(ctx) {
    const W = this.W;
    const H = this.H;
    const t = this.reduced ? 0 : this.time;
    const cell = clamp(Math.min(W, H) / 6.2, 44, 96);
    if (!this.titleCell || this.titleCell !== cell || this.titleDpr !== this.dpr) {
      this.titleCell = cell;
      this.titleDpr = this.dpr;
      this.titleSprites = JELLIES.map((_, c) => makePieceSprite(c + 1, cell * this.dpr));
      this.titleSpecial = [E.STAR, E.RAINBOW, E.BOLT_H, E.FLUFFY].map((p) => makePieceSprite(p, cell * this.dpr));
    }
    const beltY = H - cell * 1.15;
    // 벨트
    ctx.save();
    ctx.fillStyle = "rgba(74,47,99,0.16)";
    rr(ctx, -20, beltY + cell * 0.32, W + 40, cell * 0.62, cell * 0.3);
    ctx.fill();
    const g = ctx.createLinearGradient(0, beltY + cell * 0.28, 0, beltY + cell * 0.8);
    g.addColorStop(0, "#b9a3ee");
    g.addColorStop(1, "#8a6fd0");
    ctx.fillStyle = g;
    rr(ctx, -20, beltY + cell * 0.28, W + 40, cell * 0.5, cell * 0.25);
    ctx.fill();
    ctx.strokeStyle = "#4a2f63";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3;
    const off = (t * cell * 0.9) % (cell * 0.6);
    for (let x = -cell + off; x < W + cell; x += cell * 0.6) {
      ctx.beginPath();
      ctx.moveTo(x, beltY + cell * 0.38);
      ctx.lineTo(x + cell * 0.18, beltY + cell * 0.68);
      ctx.stroke();
    }
    ctx.restore();
    // 젤리 행진
    const gap = cell * 1.25;
    const n = Math.ceil(W / gap) + 2;
    const shift = (t * cell * 0.9) % (gap * 6);
    for (let k = -1; k < n; k++) {
      const x = k * gap + (shift % gap) - gap * 0.2;
      const idx = (((k - Math.floor(shift / gap)) % 6) + 6) % 6;
      const hop = Math.abs(Math.sin(t * 3 + k * 1.3));
      const y = beltY - hop * cell * 0.25;
      const spr = this.titleSprites[idx];
      const size = spr.cv.width / this.dpr;
      const sq = 1 - (1 - hop) * 0.12;
      ctx.save();
      ctx.translate(x, y + cell * 0.34);
      ctx.scale(1 + (1 - sq), sq);
      ctx.translate(0, -cell * 0.34);
      ctx.drawImage(spr.cv, -size / 2, -size / 2, size, size);
      ctx.translate(0, cell * 0.02);
      drawFace(ctx, idx + 1, cell * 0.38, hop > 0.8 ? "happy" : (t + k) % 3.5 < 0.15 ? "blink" : "idle", 0.3, 0);
      ctx.restore();
    }
    // 로고와 메뉴 사이가 넉넉하면 큰 젤리 셋이 통통
    const hole = this.ui.titleGap();
    if (hole && hole.bottom - hole.top > cell * 1.6) {
      const big = Math.min(cell * 1.5, (hole.bottom - hole.top) * 0.62);
      if (!this.heroSprites || this.heroCell !== big || this.heroDpr !== this.dpr) {
        this.heroCell = big;
        this.heroDpr = this.dpr;
        this.heroSprites = [2, 1, 3].map((p) => makePieceSprite(p, big * this.dpr));
      }
      const cy = (hole.top + hole.bottom) / 2 + big * 0.1;
      [
        [-0.95, 0.75, 1, 2.2],
        [0, 1, 0, 0],
        [0.95, 0.75, 2, 1.1],
      ].forEach(([dx, sc, k, ph]) => {
        const spr = this.heroSprites[k];
        const p = [2, 1, 3][k];
        const hop = Math.abs(Math.sin(t * 2.6 + ph));
        const size = (spr.cv.width / this.dpr) * sc;
        const x = hole.x + dx * big;
        const y = cy - hop * big * 0.18 + (1 - sc) * big * 0.4;
        const sq = 1 - (1 - hop) * 0.1;
        ctx.save();
        ctx.translate(x, y + big * 0.34 * sc);
        ctx.scale(1 + (1 - sq), sq);
        ctx.translate(0, -big * 0.34 * sc);
        ctx.drawImage(spr.cv, -size / 2, -size / 2, size, size);
        ctx.translate(0, big * 0.02 * sc);
        drawFace(ctx, p, big * 0.38 * sc, hop > 0.85 ? "happy" : (t + k) % 3.8 < 0.14 ? "blink" : "idle", 0, 0.3);
        ctx.restore();
      });
    }
    // 위쪽 둥둥 특수 젤리
    for (let k = 0; k < 4; k++) {
      const spr = this.titleSpecial[k];
      const size = (spr.cv.width / this.dpr) * 0.55;
      const x = W * (0.12 + k * 0.255) + Math.sin(t * 0.8 + k) * 8;
      const y = H * 0.1 + Math.sin(t * 1.3 + k * 2) * 10 + (k % 2) * cell * 0.4;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(spr.cv, x - size / 2, y - size / 2, size, size);
      ctx.restore();
    }
  }

  /** 점검용 요약 */
  probe() {
    const r = this.run;
    const s = r && r.state;
    return {
      mode: this.mode,
      kind: r ? r.kind : null,
      id: r ? r.def.id : null,
      moves: s ? s.moves : 0,
      limit: r ? r.limit : 0,
      score: s ? s.score : 0,
      busy: this.busy(),
      over: r ? r.over : false,
      paused: this.paused,
      sel: this.sel,
      dailyKey: r ? r.dailyKey || null : null,
      map: r ? Array.from(s.pieces).join(",") : "",
      goals: r && r.def.goals ? r.def.goals.map((g) => E.goalProgress(s, g, r.start)) : [],
      cell: this.L ? this.L.cell : 0,
    };
  }
}

export function specialName(p) {
  return { [E.BOLT_H]: "번개 젤리", [E.BOLT_V]: "번개 젤리", [E.STAR]: "별 젤리", [E.FLUFFY]: "폭신 젤리", [E.RAINBOW]: "무지개 젤리" }[p] || "";
}

/** 남은 젤리로는 목표를 이룰 수 없음 (특수 젤리가 없고 앞으로도 못 만들 때만 · 자동 풀이기와 같은 규칙) */
export function hopeless(s, goals) {
  if (s.pieces.some(E.isSpecial)) return false;
  const cnt = [0, 0, 0, 0, 0, 0];
  for (const p of s.pieces) if (E.isJelly(p)) cnt[E.colorOf(p)]++;
  if (cnt.some((c) => c >= 4)) return false; // 4개 이상인 색이 있으면 특수 젤리를 만들 수 있음
  for (const g of goals) {
    if (g.type === "clear" && cnt.some((c) => c === 1 || c === 2)) return true;
    if (g.type === "color" && s.cleared[g.color] + (cnt[g.color] >= 3 ? cnt[g.color] : 0) < g.n) return true;
  }
  return false;
}
