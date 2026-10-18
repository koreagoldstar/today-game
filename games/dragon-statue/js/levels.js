/*
 * 드래곤 석상 대작전 · 지역(레벨) 데이터
 *
 *  지역마다: id · 이름 · 배경 테마 · 석상 퍼즐 설정 · 보스 · 난이도 · 별 기준 · 그리고 길(build)
 *  길은 '커서'를 앞으로 옮기며 짓는다: ground(길이) · gap(길이) · up(높이) · bridge · stones · mover · crumbles · ramp · turn …
 *  각 구간 안에서 s.line(수정) · s.log(통나무) · s.enemy(적) · s.cp(체크포인트) 처럼 '구간 시작에서 몇 m' 로 놓는다.
 *  → 결과는 순수한 데이터 { start, path, pieces[], killY, under } 이고, level.js 가 3D 로 짓는다.
 *
 *  몸 능력(기준): 달리기 6.5 m/s · 점프 높이 약 2 m · 점프 거리 약 4.5 m · 대시 약 3 m
 *  → 초반 틈은 1.6~2.2 m, 후반 최대 3.2 m. 올라가는 턱은 최대 1.2 m. 모든 장애물은 피할 수 있다.
 */

/* ================================================================
 * 길 짓는 도구
 * ============================================================== */
class Seg {
  constructor(B, x, y, z, d, len, w) {
    this.B = B;
    this.o = [x, y, z];
    this.d = d;
    this.len = len;
    this.w = w;
  }
  P(a, s = 0, u = 0) {
    const [x, y, z] = this.o;
    const rx = -this.d[1];
    const rz = this.d[0];
    return [x + this.d[0] * a + rx * s, y + u, z + this.d[1] * a + rz * s];
  }
  put(pc) {
    this.B.pieces.push(pc);
    return this;
  }
  /* 수집품 */
  cr(a, s = 0, u = 0, bonus = false) {
    const [x, y, z] = this.P(a, s, u);
    return this.put({ t: "cr", x, y, z, bonus });
  }
  line(n, a0, a1, s = 0, u = 0, bonus = false) {
    for (let i = 0; i < n; i++) this.cr(n === 1 ? a0 : a0 + ((a1 - a0) * i) / (n - 1), s, u, bonus);
    return this;
  }
  arc(n, a0, a1, s = 0, h = 1.4, bonus = false) {
    for (let i = 0; i < n; i++) {
      const k = n === 1 ? 0.5 : i / (n - 1);
      this.cr(a0 + (a1 - a0) * k, s, Math.sin(k * Math.PI) * h, bonus);
    }
    return this;
  }
  big(a, s = 0, u = 0) {
    const [x, y, z] = this.P(a, s, u);
    return this.put({ t: "big", x, y, z });
  }
  heart(a, s = 0, u = 0) {
    const [x, y, z] = this.P(a, s, u);
    return this.put({ t: "heart", x, y, z });
  }
  /* 장애물 */
  log(a, len = null) {
    const [x, y, z] = this.P(a);
    return this.put({ t: "log", x, y, z, len: len || this.w + 0.4, axis: this.d[0] !== 0 ? "z" : "x" });
  }
  rock(a, s, size = 1.2) {
    const [x, y, z] = this.P(a, s);
    return this.put({ t: "rock", x, y, z, s: size });
  }
  crate(a, s = 0, loot = "crystals") {
    const [x, y, z] = this.P(a, s);
    return this.put({ t: "crate", x, y, z, loot });
  }
  fence(a) {
    const p = this.P(a, -this.w / 2);
    const q = this.P(a + 0.3, this.w / 2);
    return this.put({ t: "fence", x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), y: this.o[1], z0: Math.min(p[2], q[2]), z1: Math.max(p[2], q[2]) });
  }
  enemy(kind, a0, s0, a1, s1, u = 0) {
    return this.put({ t: "en", kind, a: this.P(a0, s0, u), b: this.P(a1, s1, u) });
  }
  cp(a, s = 0) {
    const [x, y, z] = this.P(a, s);
    return this.put({ t: "cp", x, y, z, yaw: Math.atan2(this.d[0], this.d[1]) });
  }
  tut(step, a0, a1) {
    const p = this.P(a0, -this.w / 2 - 0.5);
    const q = this.P(a1, this.w / 2 + 0.5);
    return this.put({ t: "tut", step, x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), z0: Math.min(p[2], q[2]), z1: Math.max(p[2], q[2]) });
  }
  jet(a, s = 0, kind = "fire", period = 3.2, phase = 0) {
    const [x, y, z] = this.P(a, s);
    return this.put({ t: "jet", x, y, z, kind, period, phase });
  }
  drop(a, s = 0, kind = "log", period = 3.8, phase = 0) {
    const [x, y, z] = this.P(a, s);
    return this.put({ t: "drop", x, y, z, kind, period, phase, r: kind === "log" ? 1.3 : 1.0 });
  }
  boulder(a0, a1, s = 0, { r = 0.7, speed = 5, pause = 1.4, phase = 0, u0 = 0, u1 = 0 } = {}) {
    return this.put({ t: "boulder", a: this.P(a0, s, u0), b: this.P(a1, s, u1), r, speed, pause, phase });
  }
  wind(a0, a1, dirSide = 1, force = 3.2, period = 5, phase = 0) {
    const p = this.P(a0, -this.w / 2 - 2);
    const q = this.P(a1, this.w / 2 + 2);
    const rx = -this.d[1] * dirSide;
    const rz = this.d[0] * dirSide;
    return this.put({ t: "wind", x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), z0: Math.min(p[2], q[2]), z1: Math.max(p[2], q[2]), y: this.o[1], dir: [rx, rz], force, period, phase });
  }
  sw(a, s, gate) {
    const [x, y, z] = this.P(a, s);
    return this.put({ t: "switch", x, y, z, gate });
  }
  gate(id, a) {
    const p = this.P(a, -this.w / 2);
    const q = this.P(a + 0.35, this.w / 2);
    return this.put({ t: "gate", id, x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), y: this.o[1], z0: Math.min(p[2], q[2]), z1: Math.max(p[2], q[2]) });
  }
  deco(kind, a, s, o = {}) {
    const [x, y, z] = this.P(a, s, o.u || 0);
    return this.put({ t: "deco", kind, x, y, z, ...o });
  }
  falls(a, s, o = {}) {
    const [x, y, z] = this.P(a, s, o.u || 0);
    return this.put({ t: "falls", x, y, z, rot: Math.atan2(this.d[0], this.d[1]) + (o.turn || 0), ...o });
  }
  /** 옆쪽 높은 보너스 발판 (도전 길: 위험하지만 보상이 많다) */
  ledge(a0, len, s, up, w = 3, o = {}) {
    const p = this.P(a0, s - w / 2, 0);
    const q = this.P(a0 + len, s + w / 2, 0);
    this.put({ t: "box", x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), z0: Math.min(p[2], q[2]), z1: Math.max(p[2], q[2]), y0: this.o[1] + up - 2.5, y1: this.o[1] + up, rails: false, edge: 0, top: o.top, side: o.side, deco: false });
    return this;
  }
  goal(a, boss = true) {
    const [x, y, z] = this.P(a);
    return this.put({ t: "goal", x, y, z, yaw: Math.atan2(this.d[0], this.d[1]), boss });
  }
}

class Builder {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.d = [0, -1];
    this.pieces = [];
    this.path = [[0, 0, 0]];
    this.width = 7;
    this.edge = 2.4;
  }
  axis() {
    return this.d[0] !== 0 ? "x" : "z";
  }
  P(a, s = 0, u = 0) {
    return [this.x + this.d[0] * a - this.d[1] * s, this.y + u, this.z + this.d[1] * a + this.d[0] * s];
  }
  rect(a0, a1, s0, s1) {
    const p = this.P(a0, s0);
    const q = this.P(a1, s1);
    return { x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), z0: Math.min(p[2], q[2]), z1: Math.max(p[2], q[2]) };
  }
  adv(len) {
    this.x += this.d[0] * len;
    this.z += this.d[1] * len;
    this.path.push([this.x, this.y, this.z]);
  }
  seg(len, w) {
    return new Seg(this, this.x, this.y, this.z, this.d.slice(), len, w);
  }
  /** 땅 구간 (w: 걷는 폭 · edge: 바깥 장식 띠 · rails: 'both' | 'L' | 'R' | false) */
  ground(len, o = {}, fn = null) {
    const w = o.w ?? this.width;
    const edge = o.edge ?? (o.rails === false ? 0 : this.edge);
    const sh = o.shift ?? 0;
    const rails = o.rails === undefined ? "both" : o.rails;
    // 한쪽만 난간이면 열린 쪽은 장식 띠 · 벽이 없다 (보너스 발판으로 뛰어갈 수 있게)
    const openR = rails === "L";
    const openL = rails === "R";
    const R = this.rect(0, len, -w / 2 - (openL ? 0 : edge) + sh, w / 2 + (openR ? 0 : edge) + sh);
    // 세계 좌표에서 열린 쪽이 작은 쪽(min)인지 큰 쪽(max)인지
    const rx = -this.d[1];
    const rz = this.d[0];
    const rightIsMax = rx + rz > 0;
    const openSide = openR ? (rightIsMax ? "max" : "min") : openL ? (rightIsMax ? "min" : "max") : null;
    this.pieces.push({ t: "box", ...R, y0: this.y - (o.thick ?? 3.5), y1: this.y, rails: rails ? true : false, openSide, edge, axis: this.axis(), top: o.top, side: o.side, slip: o.slip, deco: o.deco, under: o.under });
    const s = this.seg(len, w);
    s.o = [this.x - this.d[1] * sh, this.y, this.z + this.d[0] * sh];
    this.adv(len);
    if (fn) fn(s);
    return this;
  }
  gap(len, fn = null) {
    const s = this.seg(len, this.width);
    this.adv(len);
    if (fn) fn(s);
    return this;
  }
  up(h) {
    this.y += h;
    return this;
  }
  /** 디딤돌: n 개 (크기 · 사이 틈 · 좌우로 엇갈림) */
  stones(n, size, gap, o = {}, fn = null) {
    const zig = o.zig ?? 0;
    for (let i = 0; i < n; i++) {
      this.gap(gap);
      const shift = zig ? (i % 2 ? zig : -zig) : 0;
      this.ground(size, { w: size, edge: 0, rails: false, shift, top: o.top, side: o.side, deco: false, thick: o.thick ?? 2.5, slip: o.slip }, fn ? (s) => fn(s, i) : null);
    }
    return this.gap(gap);
  }
  /** 다리 (출렁다리면 sway > 0) */
  bridge(len, o = {}, fn = null) {
    const w = o.w ?? 2.6;
    const R = this.rect(0, len, -w / 2, w / 2);
    this.pieces.push({ t: "bridge", ...R, y: this.y, axis: this.axis(), rails: o.rails !== false, sway: o.sway || 0 });
    const s = this.seg(len, w);
    this.adv(len);
    if (fn) fn(s);
    return this;
  }
  /** 길을 따라 왔다 갔다 하는 발판으로 건너는 틈 */
  mover(len, o = {}, fn = null) {
    const size = o.size ?? 3.2;
    const a = this.P(size / 2 + 0.25);
    const b = this.P(len - size / 2 - 0.25);
    this.pieces.push({ t: "mover", a, b, w: size, d: size, period: o.period ?? 4.4, phase: o.phase ?? 0 });
    return this.gap(len, fn);
  }
  /** 옆으로 왔다 갔다 하는 발판 (틈 가운데) */
  moverSide(len, amp, o = {}, fn = null) {
    const size = o.size ?? 3.2;
    const a = this.P(len / 2, -amp);
    const b = this.P(len / 2, amp);
    this.pieces.push({ t: "mover", a, b, w: size, d: size, period: o.period ?? 4.2, phase: o.phase ?? 0 });
    return this.gap(len, fn);
  }
  /** 위로 올라가는 승강 발판 (올라간 뒤 다음 땅은 rise 만큼 높다) */
  lift(rise, o = {}) {
    const size = o.size ?? 3;
    const a = this.P(size / 2 + 0.3);
    const b = this.P(size / 2 + 0.3, 0, rise);
    this.pieces.push({ t: "mover", a, b, w: size, d: size, period: o.period ?? 5, phase: o.phase ?? 0 });
    this.gap(size + 0.6);
    return this.up(rise);
  }
  /** 무너지는 발판 줄 */
  crumbles(n, size = 2.2, gap = 0.5, o = {}) {
    for (let i = 0; i < n; i++) {
      this.gap(gap);
      const [x, y, z] = this.P(size / 2, o.zig ? (i % 2 ? o.zig : -o.zig) : 0);
      this.pieces.push({ t: "crumble", x, y, z, w: size, d: size });
      this.adv(size);
    }
    return this.gap(gap);
  }
  /** 경사로 (dh 만큼 오르내림) */
  ramp(len, dh, o = {}, fn = null) {
    const w = o.w ?? this.width;
    const R = this.rect(0, len, -w / 2, w / 2);
    const ax = this.axis();
    const start = ax === "z" ? this.z : this.x;
    const end = ax === "z" ? this.z + this.d[1] * len : this.x + this.d[0] * len;
    const sign = ax === "z" ? -this.d[1] : this.d[0];
    this.pieces.push({ t: "ramp", ...R, axis: ax, h0: this.y, h1: this.y + dh, start, end, dirSign: sign, rails: o.rails !== false, edge: 0 });
    const s = this.seg(len, w);
    this.y += dh;
    this.adv(len);
    if (fn) fn(s);
    return this;
  }
  /** 90° 꺾기 (모퉁이 발판을 깔고 방향을 바꾼다) */
  turn(side, o = {}) {
    const w = o.w ?? this.width;
    const R = this.rect(0, w, -w / 2, w / 2);
    this.pieces.push({ t: "box", ...R, y0: this.y - 3.5, y1: this.y, rails: false, edge: 0, top: o.top, side: o.side, deco: false });
    this.adv(w / 2);
    // 오른쪽 = (d.x, d.z) → (-d.z, d.x)
    this.d = side === "R" ? [-this.d[1], this.d[0]] : [this.d[1], -this.d[0]];
    this.adv(w / 2);
    return this;
  }
  /** 보스 경기장 */
  arena(r, boss) {
    const [x, y, z] = this.P(r + 1.5);
    this.pieces.push({ t: "arena", x, y, z, r, boss, entry: this.P(1) });
    this.adv(r * 2 + 3);
    return this;
  }
  deco(kind, a, s, o = {}) {
    const [x, y, z] = this.P(a, s, o.u || 0);
    this.pieces.push({ t: "deco", kind, x, y, z, ...o });
    return this;
  }
}

/* ================================================================
 * 지역 1 · 초록 정글 (연습 · 첫 보스: 고대 숲 드래곤)
 * ============================================================== */
function jungle(B) {
  B.width = 7;
  B.edge = 2.6;
  // 출발: 봉인을 푼 문을 지나 숲길로
  B.ground(16, {}, (s) => {
    s.tut("move", 1, 14);
    s.line(4, 6, 14);
  });
  B.ground(12, {}, (s) => {
    s.tut("jump", 0, 5.6);
    s.log(6.5);
    s.arc(3, 5.3, 7.7, 0, 1.7);
    s.cr(10.5);
  });
  B.ground(14, {}, (s) => {
    s.tut("dash", 0, 4);
    s.line(6, 5, 12.5, 0);
  });
  B.ground(12, {}, (s) => {
    s.tut("attack", 0, 5.5);
    s.fence(7);
    s.crate(10.2, -2.2, "crystals");
    s.crate(10.2, 2.2, "crystals");
  });
  B.ground(16, {}, (s) => {
    s.tut("enemy", 0, 4);
    s.enemy("lizard", 9, -2.4, 9, 2.4);
    s.line(3, 12, 15, 0);
  });
  B.ground(7, {}, (s) => s.cp(3.5));
  // 작은 구덩이
  B.gap(1.8, (s) => s.arc(3, 0.1, 1.7, 0, 1.4));
  B.ground(8, {}, (s) => s.line(3, 2, 6));
  // 돌다리 (옆에 작은 폭포)
  B.ground(12, { w: 3.4, edge: 0, top: "stone", side: "stone", deco: false }, (s) => {
    s.line(4, 2, 10);
    s.falls(6, -9, { w: 3.5, h: 9, u: -4, turn: Math.PI / 2 });
    s.deco("rock", 4, 6, { s: 1.6 });
  });
  B.ground(8, {}, (s) => s.cr(4));
  // 디딤돌 (시냇물 위)
  B.stones(3, 3.4, 1.4, { thick: 2 }, (s) => s.cr(1.7, 0, 0.2));
  // 오른쪽이 트인 길: 높은 바위 위 보너스 수정 (도전 길)
  B.ground(12, { rails: "L" }, (s) => {
    s.enemy("lizard", 3, -2, 9, -2);
    s.rock(6, 2.6, 1.0);
    s.line(3, 3, 9, -1);
    s.ledge(3, 7, 6.6, 1.2, 3);
    s.line(3, 4, 8, 6.6, 1.2, true);
    s.big(9.2, 6.6, 1.2);
  });
  B.ground(7, {}, (s) => {
    s.cp(3.5);
    s.heart(5.5, 2);
  });
  // 오르막 턱 두 개 (점프로)
  B.gap(2.0, (s) => s.arc(3, 0.1, 1.9, 0, 1.3));
  B.ground(6, { rails: false, w: 7, edge: 0 }, (s) => s.cr(3));
  B.up(1.0);
  B.ground(6, { rails: false, w: 7, edge: 0 }, (s) => s.cr(3, 0, 0.6));
  B.up(1.0);
  B.ground(14, {}, (s) => {
    s.enemy("lizard", 4, 2.4, 4, -2.4);
    s.enemy("lizard", 10, -2.4, 10, 2.4);
    s.line(5, 2, 13, 0);
    s.crate(12, 2.6, "heart");
  });
  B.ramp(8, 1.5, {}, (s) => s.line(3, 2, 6, 0, 0.8));
  // 신전 앞마당 → 보스 경기장
  B.ground(12, { w: 9, edge: 2, top: "stone", side: "stone" }, (s) => {
    s.deco("pillar", 2, -5.5, { h: 5 });
    s.deco("pillar", 2, 5.5, { h: 5, broken: true });
    s.deco("pillar", 9, -5.5, { h: 5, broken: true });
    s.deco("pillar", 9, 5.5, { h: 5 });
    s.line(4, 2, 9);
    s.goal(11, true);
  });
  B.arena(13, "forest");
  // 먼 배경: 양옆 절벽 숲 · 멀리 신전
  for (let i = 0; i < 9; i++) {
    const a = -150 + i * 22;
    B.pieces.push({ t: "deco", kind: "cliff", x: -18 - (i % 2) * 6, y: -2 + (i % 3), z: a, w: 10, d: 14, h: 26, trees: 3 });
    B.pieces.push({ t: "deco", kind: "cliff", x: 18 + (i % 2) * 5, y: -1 + ((i + 1) % 3), z: a + 9, w: 10, d: 14, h: 26, trees: 3 });
  }
  B.pieces.push({ t: "deco", kind: "temple", x: 0, y: B.y - 6, z: B.z - 24, s: 2.2 });
  B.pieces.push({ t: "falls", x: -13, y: -3, z: -70, w: 5, h: 16, rot: Math.PI / 2 });
}

/* ================================================================
 * 지역 2 · 폭포 계곡 (출렁다리 · 움직이는 발판 · 물기둥 · 떨어지는 통나무)
 * ============================================================== */
function falls(B) {
  B.width = 6.5;
  B.edge = 1.6;
  B.ground(12, {}, (s) => {
    s.line(3, 5, 11);
  });
  B.bridge(14, { sway: 0.12 }, (s) => s.line(5, 1.5, 12.5));
  B.ground(9, { rails: false, edge: 0 }, (s) => {
    s.enemy("minidragon", 5, -2.2, 5, 2.2, 0);
    s.cr(2);
    s.cr(7.5);
  });
  B.mover(8.5, { size: 2.8, period: 4.4 }, (s) => s.line(3, 2.5, 6, 0, 1.0));
  B.ground(12, { rails: false, edge: 0 }, (s) => {
    s.jet(4, -1.4, "water", 3.4, 0);
    s.jet(8, 1.4, "water", 3.4, 0.5);
    s.line(3, 2, 10, 0);
  });
  B.ground(6, { rails: false, edge: 0 }, (s) => s.cp(3));
  B.stones(4, 3.4, 1.6, { zig: 0.9, thick: 2 }, (s) => s.cr(1.7, 0, 0.3));
  B.ground(10, { rails: false, edge: 0 }, (s) => {
    s.enemy("minidragon", 3, 2.4, 8, 2.4);
    s.line(3, 2, 8, -1.5);
    s.crate(8, -2.2, "heart");
  });
  B.bridge(16, { sway: 0.1 }, (s) => {
    s.drop(5, 0, "log", 4.2, 0);
    s.drop(11, 0, "log", 4.2, 0.5);
    s.line(6, 1.5, 14.5);
  });
  B.ground(8, { rails: false, edge: 0 }, (s) => s.cp(4));
  B.moverSide(6.8, 1.8, { period: 5.2 }, (s) => s.cr(3.4, 0, 1.2));
  B.ground(5, { rails: false, edge: 0, w: 5 });
  B.moverSide(6.8, 1.8, { period: 5.2, phase: 0.5 }, (s) => s.cr(3.4, 0, 1.2));
  // 보너스: 물 위 높은 바위 세 개 (오른쪽)
  B.ground(12, { rails: false, edge: 0 }, (s) => {
    s.line(4, 1.5, 10.5);
    s.ledge(2, 2.2, 5.2, 1.0, 2.2);
    s.ledge(5.6, 2.2, 7.6, 2.0, 2.2);
    s.ledge(9.2, 2.2, 5.2, 1.0, 2.2);
    s.cr(3.1, 5.2, 1.0, true);
    s.big(6.7, 7.6, 2.0);
    s.cr(10.3, 5.2, 1.0, true);
  });
  B.ground(15, { w: 5, edge: 0, rails: false }, (s) => {
    s.jet(3, -1.2, "water", 3.0, 0);
    s.jet(7.5, 1.2, "water", 3.0, 0.33);
    s.jet(12, 0, "water", 3.0, 0.66);
    s.line(4, 1.5, 13.5, 0, 0);
  });
  B.ground(7, { rails: false, edge: 0 }, (s) => {
    s.cp(3.5);
    s.heart(5.5, -1.8);
  });
  B.ramp(9, 2.2, { rails: false }, (s) => s.line(3, 2, 7, 0, 1.1));
  B.ground(10, {}, (s) => {
    s.enemy("minidragon", 5, -2.2, 5, 2.2);
    s.line(3, 2, 8);
    s.goal(9.5, true);
  });
  B.arena(13, "water");
  // 배경: 큰 폭포들 · 물 위 바위 · 숲 절벽
  for (let i = 0; i < 8; i++) {
    const a = -20 - i * 24;
    B.pieces.push({ t: "deco", kind: "cliff", x: -22 - (i % 2) * 4, y: 4 + (i % 3) * 2, z: a, w: 12, d: 16, h: 30, trees: 3 });
    B.pieces.push({ t: "deco", kind: "cliff", x: 22 + ((i + 1) % 2) * 4, y: 3 + ((i + 1) % 3) * 2, z: a - 10, w: 12, d: 16, h: 30, trees: 3 });
    if (i % 2 === 0) B.pieces.push({ t: "falls", x: -15.8 - (i % 2) * 4, y: -3, z: a, w: 4.5, h: 9 + (i % 3) * 2, rot: Math.PI / 2 });
    else B.pieces.push({ t: "falls", x: 15.8 + ((i + 1) % 2) * 4, y: -3, z: a - 10, w: 4.5, h: 9 + (i % 3) * 2, rot: -Math.PI / 2 });
    B.pieces.push({ t: "deco", kind: "rock", x: (i % 2 ? 7 : -7) + (i % 3), y: -3, z: a - 6, s: 1.6, mat: "rock" });
  }
}

/* ================================================================
 * 지역 3 · 수정 동굴 (좁은 길 · 무너지는 바닥 · 승강 발판 · 구르는 돌 · 스위치 문)
 * ============================================================== */
function crystal(B) {
  B.width = 6;
  B.edge = 1.5;
  B.ground(10, {}, (s) => {
    s.line(3, 4, 9);
  });
  B.ground(12, { w: 2.6, edge: 0, rails: false }, (s) => s.line(5, 1.5, 11));
  B.crumbles(5, 2.2, 0.15);
  B.ground(10, { rails: false, edge: 0 }, (s) => {
    s.enemy("bat", 5, -2, 5, 2, 0);
    s.line(3, 2, 8, 1.6);
  });
  B.lift(3.0, { size: 3, period: 5.2 });
  B.ground(8, {}, (s) => {
    s.cp(4);
    s.cr(6.5, -1.8);
  });
  // 구르는 돌 복도 (옆으로 비키거나 점프)
  B.ground(22, { w: 5.4, edge: 0.8 }, (s) => {
    // 가운데 한 줄로 굴러온다 → 벽 쪽으로 비키거나 점프
    s.boulder(21, 0.5, 0, { r: 0.75, speed: 5.2, pause: 1.4, phase: 0 });
    s.boulder(21, 0.5, 0, { r: 0.75, speed: 5.2, pause: 1.4, phase: 0.5 });
    s.line(5, 3, 19, 0, 0);
  });
  // 스위치를 쳐서 문 열기
  B.ground(12, { w: 6 }, (s) => {
    s.sw(5, -2.2, "g3");
    s.gate("g3", 9);
    s.cr(5, 1.8);
  });
  B.turn("R", { w: 5 });
  B.ground(8, { w: 3, edge: 0, rails: false }, (s) => s.line(3, 1.5, 6.5));
  B.turn("L", { w: 5 });
  B.ground(14, { rails: false, edge: 0 }, (s) => {
    s.enemy("bat", 4, 2, 4, -2);
    s.enemy("bat", 10, -2, 10, 2);
    s.line(4, 2, 12, 0);
    s.crate(12.5, -2.2, "heart");
  });
  B.ground(7, {}, (s) => s.cp(3.5));
  B.moverSide(6.8, 1.8, { period: 5.2 }, (s) => s.cr(3.4, 0, 1.2));
  B.ground(4.5, { rails: false, edge: 0, w: 4.5 });
  B.moverSide(6.8, 1.8, { period: 5.2, phase: 0.5 }, (s) => s.cr(3.4, 0, 1.2));
  B.ground(6, { rails: false, edge: 0 }, (s) => {
    // 보너스: 무너지는 발판 너머 큰 수정
    s.ledge(1, 3, -5.4, 0.8, 2.4);
    s.big(2.5, -5.4, 0.8);
  });
  B.crumbles(4, 2.2, 0.15, { zig: 0.6 });
  B.ramp(8, 1.6, {}, (s) => s.line(3, 2, 6, 0, 0.8));
  B.ground(10, {}, (s) => {
    s.line(3, 2, 7);
    s.goal(9.5, true);
  });
  B.arena(13, "crystal");
  // 배경: 거대한 수정 · 종유석 기둥
  for (let i = 0; i < 10; i++) {
    const a = -10 - i * 18;
    B.pieces.push({ t: "deco", kind: "cliff", x: -16 - (i % 3) * 3, y: 6 + (i % 2) * 4, z: a, w: 8, d: 10, h: 30, trees: 2 });
    B.pieces.push({ t: "deco", kind: "cliff", x: 16 + (i % 3) * 3, y: 5 + ((i + 1) % 2) * 4, z: a - 8, w: 8, d: 10, h: 30, trees: 2 });
    B.pieces.push({ t: "deco", kind: "crystals", x: (i % 2 ? 9 : -9), y: -8, z: a - 4, s: 3.2, mat: i % 2 ? "crystal" : "crystal2" });
  }
}

/* ================================================================
 * 지역 4 · 화산 왕국 (불기둥 · 무너지는 돌다리 · 용암 위 발판 · 구르는 바위)
 * ============================================================== */
function volcano(B) {
  B.width = 6.4;
  B.edge = 1.6;
  B.ground(12, {}, (s) => {
    s.line(3, 4, 11);
  });
  B.ground(15, { w: 6 }, (s) => {
    s.jet(4, -1.5, "fire", 3.0, 0);
    s.jet(8, 1.5, "fire", 3.0, 0.4);
    s.jet(12, -0.5, "fire", 3.0, 0.75);
    s.line(4, 2, 14, 0);
  });
  B.crumbles(6, 2.3, 0.12);
  B.ground(9, { rails: false, edge: 0 }, (s) => {
    s.enemy("spirit", 5, -2, 5, 2, 0.6);
    s.line(3, 2, 7, 1.8);
  });
  B.mover(8.5, { size: 2.8, period: 4.2 }, (s) => s.line(3, 2.5, 6, 0, 1));
  B.ground(4, { rails: false, edge: 0, w: 5 });
  B.mover(8.5, { size: 2.8, period: 4.2, phase: 0.5 }, (s) => s.line(3, 2.5, 6, 0, 1));
  B.ground(7, {}, (s) => {
    s.cp(3.5);
    s.heart(5.6, 1.8);
  });
  // 오르막 + 굴러 내려오는 바위 두 줄
  B.ramp(16, 2.2, { w: 6.4 }, (s) => {
    s.boulder(15.8, 0.3, -1.6, { r: 0.7, speed: 5, pause: 1.8, phase: 0, u0: 2.2, u1: 0.05 });
    s.boulder(15.8, 0.3, 1.6, { r: 0.7, speed: 5, pause: 1.8, phase: 0.5, u0: 2.2, u1: 0.05 });
    s.line(4, 3, 14, 0, 1.2);
  });
  B.ground(12, {}, (s) => {
    s.enemy("spirit", 4, 2.2, 8, 2.2, 0.6);
    s.enemy("spirit", 9, -2.2, 9, 2.2, 0.6);
    s.line(4, 2, 11, -0.5);
  });
  B.ground(6, { rails: false, edge: 0 }, (s) => s.jet(3, 0, "fire", 2.8, 0.2));
  B.crumbles(3, 2.3, 0.12);
  B.ground(7, {}, (s) => s.cp(3.5));
  B.stones(4, 3.4, 1.8, { zig: 1.0, thick: 2 }, (s) => s.cr(1.7, 0, 0.3));
  B.ground(12, { rails: "L" }, (s) => {
    s.jet(6, -1.2, "fire", 3.2, 0);
    s.line(3, 2, 10, -1);
    // 보너스: 용암 위 오른쪽 바위
    s.ledge(4, 5, 6.4, 0.6, 2.6, { top: "basalt" });
    s.big(6.5, 6.4, 0.6);
    s.crate(10, -2, "heart");
  });
  B.ramp(8, 1.4, {}, (s) => s.line(3, 2, 6, 0, 0.8));
  B.ground(10, {}, (s) => {
    s.line(3, 2, 7);
    s.goal(9.5, true);
  });
  B.arena(13, "lava");
  // 배경: 화산 · 검은 바위 섬
  B.pieces.push({ t: "deco", kind: "volcano", x: 40, y: -10, z: -120, s: 2.2 });
  B.pieces.push({ t: "deco", kind: "volcano", x: -55, y: -10, z: -60, s: 1.5 });
  for (let i = 0; i < 9; i++) {
    const a = -10 - i * 20;
    B.pieces.push({ t: "deco", kind: "cliff", x: -19 - (i % 2) * 5, y: 2 + (i % 3) * 2, z: a, w: 9, d: 12, h: 24, trees: 2 });
    B.pieces.push({ t: "deco", kind: "cliff", x: 19 + ((i + 1) % 2) * 5, y: 1 + ((i + 1) % 3) * 2, z: a - 9, w: 9, d: 12, h: 24, trees: 2 });
  }
}

/* ================================================================
 * 지역 5 · 얼음 드래곤 성 (미끄러운 바닥 · 떨어지는 고드름 · 바람 · 움직이는 발판)
 * ============================================================== */
function ice(B) {
  B.width = 6.4;
  B.edge = 1.8;
  B.ground(12, {}, (s) => {
    s.line(3, 4, 11);
  });
  B.ground(15, { top: "ice", slip: true }, (s) => {
    s.enemy("slime", 8, -2.2, 8, 2.2);
    s.line(5, 2, 13, 0);
  });
  B.bridge(13, { w: 3.2, rails: false }, (s) => {
    s.wind(1, 12, 1, 3.0, 5.2, 0);
    s.line(5, 1.5, 11.5);
  });
  B.ground(14, {}, (s) => {
    s.drop(3.5, -1.5, "icicle", 3.6, 0);
    s.drop(7, 1.5, "icicle", 3.6, 0.33);
    s.drop(10.5, 0, "icicle", 3.6, 0.66);
    s.line(4, 2, 12.5, 0);
  });
  B.ground(7, {}, (s) => {
    s.cp(3.5);
    s.heart(5.6, -1.8);
  });
  B.mover(8.5, { size: 2.8, period: 4.4 }, (s) => s.line(3, 2.5, 6, 0, 1));
  B.ground(5, { rails: false, edge: 0, w: 5 });
  B.lift(2.6, { size: 3, period: 5 });
  B.ground(14, { top: "ice", slip: true }, (s) => {
    s.enemy("slime", 4, 2.2, 4, -2.2);
    s.enemy("slime", 10, -2.2, 10, 2.2);
    s.line(4, 2, 12.5);
    s.crate(12.5, 2.4, "heart");
  });
  B.ground(12, { rails: false, edge: 0 }, (s) => {
    s.wind(0, 12, -1, 3.2, 5, 0.3);
    s.line(4, 1.5, 10.5);
  });
  B.ground(7, {}, (s) => s.cp(3.5));
  B.stones(4, 3.4, 1.6, { zig: 1.0, slip: true, top: "ice", side: "ice", thick: 2 }, (s) => s.cr(1.7, 0, 0.3));
  // 성으로 오르는 얼음 계단 (고드름 조심)
  B.ground(5, { rails: false, edge: 0 });
  B.up(0.8);
  B.ground(5, { rails: false, edge: 0 }, (s) => s.drop(2.5, 0, "icicle", 3.4, 0.2));
  B.up(0.8);
  B.ground(5, { rails: false, edge: 0 }, (s) => {
    s.cr(2.5, 0, 0.5);
    s.ledge(0.5, 4, -5.2, 1.4, 2.4, { top: "ice", side: "ice" });
    s.big(2.5, -5.2, 1.4);
  });
  B.up(0.8);
  B.ground(12, {}, (s) => {
    s.line(3, 2, 7);
    s.enemy("slime", 6, 2, 6, -2);
    s.goal(11, true);
  });
  B.arena(13, "ice");
  // 배경: 얼음 성 탑 · 눈 덮인 절벽
  for (let i = 0; i < 6; i++) B.pieces.push({ t: "deco", kind: "tower", x: (i % 2 ? 26 : -26) + (i % 3) * 3, y: -6, z: -40 - i * 28, s: 1.6 });
  for (let i = 0; i < 9; i++) {
    const a = -10 - i * 20;
    B.pieces.push({ t: "deco", kind: "cliff", x: -18 - (i % 2) * 4, y: 2 + (i % 3) * 2, z: a, w: 9, d: 12, h: 26, trees: 3 });
    B.pieces.push({ t: "deco", kind: "cliff", x: 18 + ((i + 1) % 2) * 4, y: 1 + ((i + 1) % 3) * 2, z: a - 9, w: 9, d: 12, h: 26, trees: 3 });
  }
}

/* ================================================================
 * 지역 6 · 고대 용의 성 (지금까지 배운 것 모두: 석상 수호자 · 스위치 문 · 불기둥 · 발판 · 바위)
 * ============================================================== */
function castle(B) {
  B.width = 6.6;
  B.edge = 1.8;
  B.ground(12, { top: "temple", side: "templewall" }, (s) => {
    s.line(3, 4, 11);
  });
  B.ground(14, { top: "temple", side: "templewall" }, (s) => {
    s.enemy("guard", 8, -2, 8, 2);
    s.line(3, 2, 6, 0);
    s.line(2, 11, 13, 0);
  });
  B.ground(14, { top: "temple", side: "templewall", w: 6 }, (s) => {
    s.jet(3.5, -1.4, "fire", 3.0, 0);
    s.jet(7, 1.4, "fire", 3.0, 0.35);
    s.jet(10.5, 0, "fire", 3.0, 0.7);
    s.line(4, 2, 12.5, 0);
  });
  B.mover(8.5, { size: 2.8, period: 4.2 }, (s) => s.line(3, 2.5, 6, 0, 1));
  B.ground(4, { rails: false, edge: 0, w: 5, top: "temple", side: "templewall" });
  B.moverSide(6.8, 1.8, { period: 5.2 }, (s) => s.cr(3.4, 0, 1.2));
  B.ground(7, { top: "temple", side: "templewall" }, (s) => s.cp(3.5));
  // 스위치 문: 길 왼쪽 스위치를 방망이로 쳐야 문이 열린다 (오른쪽 높은 발판은 보너스)
  B.ground(14, { top: "temple", side: "templewall", rails: "L" }, (s) => {
    s.gate("g6", 12);
    s.ledge(4, 4, 6.4, 0, 3, { top: "temple", side: "templewall" });
    s.sw(7, -2.4, "g6");
    s.big(6, 6.4, 0);
    s.line(3, 3, 9, 1);
    s.enemy("minidragon", 6, -2, 9, -2, 0);
  });
  B.crumbles(5, 2.3, 0.12);
  B.ramp(14, 2, { w: 6.4 }, (s) => {
    s.boulder(13.8, 0.3, -1.6, { r: 0.7, speed: 5, pause: 1.8, phase: 0, u0: 2, u1: 0.05 });
    s.boulder(13.8, 0.3, 1.6, { r: 0.7, speed: 5, pause: 1.8, phase: 0.5, u0: 2, u1: 0.05 });
    s.line(3, 3, 11, 0, 1);
  });
  B.ground(14, { top: "temple", side: "templewall" }, (s) => {
    s.enemy("guard", 5, 2, 5, -2);
    s.enemy("guard", 11, -2, 11, 2);
    s.line(4, 2, 12.5);
    s.crate(12.6, 2.4, "heart");
  });
  B.ground(7, { top: "temple", side: "templewall" }, (s) => s.cp(3.5));
  B.stones(3, 3.4, 1.8, { zig: 1, top: "temple", side: "templewall", thick: 2 }, (s) => s.cr(1.7, 0, 0.3));
  // 왕좌로 오르는 큰 계단 (양옆 거대 조각상)
  for (let i = 0; i < 4; i++) {
    B.ground(4, { top: "temple", side: "templewall", rails: false, edge: 0, w: 8 }, (s) => {
      s.cr(2, 0, 0.4);
      if (i === 1) {
        s.deco("statue", 2, -9, { s: 1.1, rot: Math.PI / 2 });
        s.deco("statue", 2, 9, { s: 1.1, rot: -Math.PI / 2 });
      }
    });
    B.up(0.8);
  }
  B.ground(10, { top: "temple", side: "templewall" }, (s) => {
    s.big(5, 0, 0.5);
    s.goal(9.5, true);
  });
  B.arena(14, "king");
  for (let i = 0; i < 8; i++) {
    const a = -20 - i * 24;
    B.pieces.push({ t: "deco", kind: "statue", x: i % 2 ? 22 : -22, y: -2, z: a, s: 1.5, rot: i % 2 ? -Math.PI / 2 : Math.PI / 2 });
    B.pieces.push({ t: "deco", kind: "cliff", x: i % 2 ? -26 : 26, y: 2, z: a - 10, w: 10, d: 12, h: 26, trees: 2 });
  }
}

/* ================================================================
 * 지역 목록
 * ============================================================== */
export const REGIONS = [
  {
    id: "jungle",
    no: 1,
    name: "초록 정글",
    en: "GREEN JUNGLE",
    theme: "jungle",
    build: jungle,
    under: "valley",
    killY: -9,
    underY: -26,
    puzzle: { count: 3, diff: 0.45, types: ["folded"], mix: 1, time: 30 },
    boss: "forest",
    tier: "초보",
    misses: 3,
    crystalGoal: 0.6,
    enemy: "lizard",
    intro: "숲길을 달리고 점프해서 첫 보물을 찾아요!",
  },
  {
    id: "falls",
    no: 2,
    name: "폭포 계곡",
    en: "WATERFALL VALLEY",
    theme: "falls",
    build: falls,
    under: "water",
    killY: -2.4,
    underY: -2,
    puzzle: { count: 5, diff: 0.36, types: ["spread"], mix: 1, time: 28 },
    boss: "water",
    tier: "초보",
    misses: 3,
    crystalGoal: 0.6,
    enemy: "minidragon",
    intro: "출렁다리와 움직이는 발판을 건너 폭포 위로!",
  },
  {
    id: "crystal",
    no: 3,
    name: "수정 동굴",
    en: "CRYSTAL CAVE",
    theme: "crystal",
    build: crystal,
    under: "abyss",
    killY: -8,
    underY: -30,
    puzzle: { count: 6, diff: 0.28, types: ["crystal", "folded"], mix: 2, time: 26 },
    boss: "crystal",
    tier: "보통",
    misses: 2,
    crystalGoal: 0.6,
    enemy: "bat",
    intro: "무너지는 바닥과 굴러오는 돌을 조심해요!",
  },
  {
    id: "volcano",
    no: 4,
    name: "화산 왕국",
    en: "VOLCANO KINGDOM",
    theme: "volcano",
    build: volcano,
    under: "lava",
    killY: -2.2,
    underY: -2,
    puzzle: { count: 8, diff: 0.22, types: ["lava", "armored"], mix: 2, time: 25 },
    boss: "lava",
    tier: "보통",
    misses: 2,
    crystalGoal: 0.6,
    enemy: "spirit",
    intro: "불기둥이 빛나면 곧 뿜어요. 타이밍을 봐요!",
  },
  {
    id: "ice",
    no: 5,
    name: "얼음 드래곤 성",
    en: "ICE DRAGON CASTLE",
    theme: "ice",
    build: ice,
    under: "icewater",
    killY: -3,
    underY: -2.6,
    puzzle: { count: 9, diff: 0.19, types: ["ice", "folded", "spread"], mix: 3, time: 24 },
    boss: "ice",
    tier: "도전",
    misses: 2,
    crystalGoal: 0.6,
    enemy: "slime",
    intro: "얼음 바닥은 미끄러워요. 바람이 불기 전에 눈발이 보여요!",
  },
  {
    id: "castle",
    no: 6,
    name: "고대 용의 성",
    en: "ANCIENT DRAGON CASTLE",
    theme: "master",
    build: castle,
    under: "abyss",
    killY: -8,
    underY: -30,
    puzzle: { count: 10, diff: 0.16, types: ["ancient", "gold", "spread"], mix: 3, time: 23 },
    boss: "king",
    tier: "도전",
    misses: 2,
    crystalGoal: 0.6,
    enemy: "guard",
    intro: "지금까지 배운 모든 것을 써서 왕좌까지!",
  },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** 지역 → 레벨 데이터 (매번 같은 결과) */
const cache = new Map();
export function levelData(region) {
  if (cache.has(region.id)) return cache.get(region.id);
  const B = new Builder();
  region.build(B);
  // 출발 지점: 첫 구간 2m 앞
  const start = { x: 0, y: 0, z: -2.2, yaw: Math.PI };
  const crystals = B.pieces.filter((p) => p.t === "cr").length;
  const bigs = B.pieces.filter((p) => p.t === "big").length;
  const data = {
    id: region.id,
    theme: region.theme,
    seed: region.no * 131,
    killY: region.killY,
    under: region.under,
    underY: region.underY,
    start,
    path: B.path,
    pieces: B.pieces,
    totals: { crystals, bigs },
  };
  cache.set(region.id, data);
  return data;
}
