/*
 * 용암 서핑 · 코스 만들기 도구
 *
 *  스테이지마다 코스를 '구간을 이어 붙이는' 방식으로 짠다.
 *   C.run(길이, { slope 경사, turn 굽는 정도(라디안), hw 반폭, walls 벽 })  → 중심선을 2m 마다 찍으며 앞으로
 *   C.ramp(길이, 높이) · C.gap(길이) · C.cp() 체크포인트 · C.hint(안내) · C.lava(간격, 배수)
 *   장애물 · 수집물은 모두 '절대 s' 로 놓는다 (const s = C.s 로 지금 위치를 받아 두고 s + 20 처럼)
 *
 *  s = 중심선을 따라 간 3D 거리. 점을 2m 마다 촘촘히 찍으므로 Track 의 s 와 거의 같다 (오차 < 0.1%).
 */
import { seeded } from "./tex.js?v=2";

const STEP = 2;
const smooth = (t) => t * t * (3 - 2 * t);

export class CourseBuilder {
  constructor({ id = 0, name = "", y0 = 240, hw = 9, slope = 0.1, seed = 1, lavaDepth = 10, heading = 0 } = {}) {
    this.def = {
      id,
      name,
      lavaDepth,
      points: [[0, y0, 0]],
      width: [[0, hw]],
      walls: [],
      gaps: [],
      ramps: [],
      pads: [],
      holes: [],
      dividers: [],
      winds: [],
      styles: [],
      tunnels: [],
      checkpoints: [],
      lava: [],
      lavaStop: 1e9,
      finish: 0,
      start: 60,
      decor: [],
      signs: [],
    };
    this.items = { obs: [], orbs: [], boosts: [] };
    this.sections = [];
    this.rnd = seeded(seed * 7919 + 13);
    this.s = 0;
    this.x = 0;
    this.y = y0;
    this.z = 0;
    this.h = heading;
    this.sl = slope;
    this.hw = hw;
    this.wallMode = "both";
    this.wallStart = 0;
    this.styleMode = null;
    this.styleStart = 0;
  }
  /* ---------------- 중심선 ---------------- */
  /** 앞으로 len m: 경사는 앞 35% 에서 부드럽게 바뀌고, 방향은 고르게 turn 만큼 돈다 */
  run(len, { slope = this.sl, turn = 0, hw = this.hw, walls, style, ease = 24 } = {}) {
    if (walls !== undefined) this.walls(walls);
    if (style !== undefined) this.style(style);
    const s0 = this.s;
    const sl0 = this.sl;
    const h0 = this.h;
    if (hw !== this.hw) {
      const W = this.def.width;
      if (W[W.length - 1][0] < s0) W.push([s0, this.hw]);
      W.push([s0 + Math.min(len, ease), hw]);
      this.hw = hw;
    }
    const n = Math.max(1, Math.round(len / STEP));
    const ds = len / n;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const sl = sl0 + (slope - sl0) * smooth(Math.min(1, t / 0.35));
      const hd = h0 + turn * (t - 0.5 / n);
      const dh = ds / Math.sqrt(1 + sl * sl);
      this.x += Math.sin(hd) * dh;
      this.z -= Math.cos(hd) * dh;
      this.y -= sl * dh;
      this.def.points.push([+this.x.toFixed(3), +this.y.toFixed(3), +this.z.toFixed(3)]);
    }
    this.s += len;
    this.sl = slope;
    this.h = h0 + turn;
    return this;
  }
  /** 벽: "both" | "left" | "right" | "none" */
  walls(mode) {
    if (mode === this.wallMode) return this;
    this.closeWalls();
    this.wallMode = mode;
    this.wallStart = this.s;
    return this;
  }
  closeWalls() {
    const side = { both: 0, left: -1, right: 1 }[this.wallMode];
    if (side !== undefined && this.s > this.wallStart) this.def.walls.push([this.wallStart, this.s, side]);
  }
  /** 바닥 모양: null(기본) | "bridge" | "metal" | "bone" | "basalt" … */
  style(mode) {
    if (mode === this.styleMode) return this;
    if (this.styleMode && this.s > this.styleStart) this.def.styles.push([this.styleStart, this.s, this.styleMode]);
    this.styleMode = mode;
    this.styleStart = this.s;
    return this;
  }
  /** 점프대: 끝에서 튀어 오름 */
  ramp(len, h, opts = {}) {
    this.def.ramps.push([this.s, this.s + len, h]);
    return this.run(len, opts);
  }
  /** 땅이 없는 곳 (용암 강 · 절벽 · 끊어진 다리) */
  gap(len, opts = {}) {
    this.def.gaps.push([this.s, this.s + len]);
    return this.run(len, opts);
  }
  tunnel(len, opts = {}) {
    this.def.tunnels.push([this.s, this.s + len, opts.h || 7.5]);
    return this.run(len, opts);
  }
  cp() {
    this.def.checkpoints.push(this.s);
    return this;
  }
  hint(text, touch) {
    this.sections.push({ s: this.s, hint: text, touch });
    return this;
  }
  lava(gap, k = 1) {
    this.def.lava.push({ s: this.s, gap, k });
    return this;
  }
  /* ---------------- 바닥 장치 ---------------- */
  /** 용암 위 바위 발판: l = 앞뒤 반길이, r = 옆 반폭 (타원) · sink 밟으면 가라앉음 · lift 위아래 */
  pad(s, u, r, { l = r, h = 0, sink = false, lift = null, look = "rock" } = {}) {
    this.def.pads.push({ s, u, r, l, h, h0: h, sink, lift, look });
    return this;
  }
  /** 바닥 구멍 (그 칸만 용암) */
  hole(s0, s1, u0, u1) {
    this.def.holes.push({ s0, s1, u0, u1 });
    return this;
  }
  /** 길을 나누는 높은 현무암 벽 (넘어갈 수 없음) */
  divider(s0, s1, u, { h = 5, look = "basalt" } = {}) {
    this.def.dividers.push({ s0, s1, u, h, look });
    return this;
  }
  /** 돌풍: force(+ 오른쪽) · period 초마다 on 초 동안 */
  wind(s0, s1, force, { period = 0, on = 0, phase = 0, warn = 0.8 } = {}) {
    this.def.winds.push({ s0, s1, force, period, on, phase, warn });
    return this;
  }
  /** 연기 · 화산재로 앞이 덜 보이는 구간 (안개 시작 · 끝 거리) */
  fog(s0, s1, near, far) {
    (this.def.fogs || (this.def.fogs = [])).push({ s0, s1, near, far });
    return this;
  }
  /** 용암이 더 따라오지 못하는 곳 (마지막 절벽으로 쏟아짐) */
  stopLava(s = this.s) {
    this.def.lavaStop = s;
    return this;
  }
  sign(s, u, kind) {
    this.def.signs.push({ s, u, kind });
    return this;
  }
  decor(type, s, opts = {}) {
    this.def.decor.push({ type, s, ...opts });
    return this;
  }
  /* ---------------- 장애물 ---------------- */
  ob(o) {
    this.items.obs.push(o);
    return this;
  }
  spire(s, u, { r = 1.2, h = 6, look } = {}) {
    return this.ob({ type: "spire", s, u, r, h, look });
  }
  rock(s, u, { r = 0.9, h = 1.0, look } = {}) {
    return this.ob({ type: "rock", s, u, r, h, look });
  }
  roll(s, side, { r = 1.7, speed = 9, trigger = 44 } = {}) {
    return this.ob({ type: "roll", s, side, r, speed, trigger });
  }
  fire(s, u, { r = 1.7, period = 2.8, phase = 0, warn = 1.1, on = 1.0, big = false } = {}) {
    return this.ob({ type: "fire", s, u, r, period, phase, warn, on, big });
  }
  crumble(s0, s1, u0, u1, { trigger = 34, delay = null } = {}) {
    return this.ob({ type: "crumble", s0, s1, u0, u1, s: s0, trigger, delay });
  }
  slider(s, u0, u1, { period = 3.2, h = 2.4, w = 2.6, look, phase = 0 } = {}) {
    return this.ob({ type: "slider", s, u0, u1, period, h, w, look, phase });
  }
  bomb(s, u, { r = 1.8, from = "sky", kind = "rock", trigger = 46, flight = 1.3 } = {}) {
    return this.ob({ type: "bomb", s, u, r, from, kind, trigger, flight });
  }
  laser(s, { h = 0.7, period = 2.4, on = 1.1, warn = 0.6, phase = 0, u0, u1 } = {}) {
    return this.ob({ type: "laser", s, h, period, on, warn, phase, u0, u1 });
  }
  gate(s, u0, u1, { period = 3, open = 0.5, phase = 0, sw = null } = {}) {
    return this.ob({ type: "gate", s, u0, u1, period, open, phase, sw });
  }
  /** 터널의 도는 날개 (부채꼴 날개 arms 개, blade = 날개 폭 각도) */
  rotor(s, { cy = 3.2, L = 5.6, arms = 3, blade = 0.75, speed = 1.3, phase = 0 } = {}) {
    return this.ob({ type: "rotor", s, cy, L, arms, blade, speed, phase });
  }
  sweeper(s, u, { L = 4.2, speed = 1.6, phase = 0, h = 0.75 } = {}) {
    return this.ob({ type: "sweeper", s, u, L, speed, phase, h });
  }
  wheel(s, u0, u1, { period = 3, R = 1.5, phase = 0 } = {}) {
    return this.ob({ type: "wheel", s, u0, u1, period, R, phase });
  }
  lavafall(s, u0, u1, { period = 0, on = 0, warn = 0.9, phase = 0 } = {}) {
    return this.ob({ type: "lavafall", s, u0, u1, period, on, warn, phase });
  }
  bar(s, u0, u1, { h = 0.8, look = "pipe" } = {}) {
    return this.ob({ type: "bar", s, u0, u1, h, look });
  }
  erupt(s, u, { period = 4.5, phase = 0, warn = 1.2, ring = 16, debris = 3 } = {}) {
    return this.ob({ type: "erupt", s, u, period, phase, warn, ring, debris });
  }
  /* ---------------- 수집물 · 부스터 ---------------- */
  orbs(s0, s1, u0, u1, n, h = 0.9) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.items.orbs.push({ s: s0 + (s1 - s0) * t, u: u0 + (u1 - u0) * t, h });
    }
    return this;
  }
  arc(s0, s1, u, top, n) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      this.items.orbs.push({ s: s0 + (s1 - s0) * t, u, h: 0.9 + Math.sin(t * Math.PI) * top, air: true });
    }
    return this;
  }
  big(s, u, h = 1.2, air = false) {
    this.items.orbs.push({ s, u, h, air, big: true });
    return this;
  }
  boost(s, u, { w = 3, l = 4 } = {}) {
    this.items.boosts.push({ s, u, w, l });
    return this;
  }
  /* ---------------- 끝: 안전지대 ---------------- */
  finish({ approach = 0, flat = 150 } = {}) {
    if (approach) this.run(approach);
    this.def.finish = this.s + 2;
    this.run(flat, { slope: 0.02, hw: 12, walls: "both", style: null });
    return this;
  }
  done({ theme, start = 60 } = {}) {
    this.closeWalls();
    this.wallMode = null;
    this.style(null);
    const d = this.def;
    d.start = start;
    if (!d.lava.length) d.lava.push({ s: 0, gap: 34, k: 1 });
    d.lava.sort((a, b) => a.s - b.s);
    d.theme = theme;
    return { course: d, items: this.items, sections: this.sections };
  }
}
