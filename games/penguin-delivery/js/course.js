/*
 * 펭귄 택배 대작전 — 코스 만들기 (화면 없음)
 *  길은 0.5m 간격의 표본(P)으로 만들고, 스테이지는 커서를 앞으로 밀며 조각을 잇는다.
 *  물리 · 봇 · 그림이 모두 이 자료 하나를 함께 쓴다.
 */
export const DS = 0.5;
const ROAD_STRETCH = 1.4;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const TAU = Math.PI * 2;
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

/** 길 조각 안에서 물건을 놓는 도구 (m: 조각 시작부터 거리, lat: 왼쪽 - / 오른쪽 +) */
class Placer {
  constructor(b, i0, n, scale = 1) {
    this.b = b;
    this.i0 = i0;
    this.n = n;
    this.len = n * DS;
    this.scale = scale;
  }
  at(m, lat = 0) {
    const P = this.b.P;
    const i = clamp(this.i0 + Math.round((m * this.scale) / DS), this.i0, this.i0 + this.n - 1);
    const s = P[i];
    return { x: s.x + s.rx * lat, y: s.y, z: s.z + s.rz * lat, h: s.h, s: s.s, i, rx: s.rx, rz: s.rz, dx: s.dx, dz: s.dz, hw: s.hw };
  }
  fish(m, lat = 0, n = 1, step = 1.4, lift = 0) {
    for (let k = 0; k < n; k += 1) {
      const a = this.at(m + k * step, lat);
      this.b.items.push({ type: "fish", x: a.x, y: a.y + 0.75 + lift, z: a.z, s: a.s, on: true });
    }
    return this;
  }
  /** 뛰어넘는 곡선을 따라 생선 */
  arc(m, lat = 0, n = 5, step = 1.1, high = 1.5) {
    for (let k = 0; k < n; k += 1) {
      const a = this.at(m + k * step, lat);
      const u = n > 1 ? k / (n - 1) : 0.5;
      this.b.items.push({ type: "fish", x: a.x, y: a.y + 0.75 + Math.sin(u * Math.PI) * high, z: a.z, s: a.s, on: true });
    }
    return this;
  }
  star(m, lat = 0, lift = 0) {
    const a = this.at(m, lat);
    this.b.items.push({ type: "star", x: a.x, y: a.y + 1 + lift, z: a.z, s: a.s, on: true });
    return this;
  }
  item(kind, m, lat = 0, lift = 0) {
    const a = this.at(m, lat);
    this.b.items.push({ type: kind, x: a.x, y: a.y + 0.95 + lift, z: a.z, s: a.s, on: true });
    return this;
  }
  snowman(m, lat = 0) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "snowman", x: a.x, y: a.y, z: a.z, r: 0.62, h: 2.1, h0: a.h, s: a.s, down: false, lat });
    return this;
  }
  pillar(m, lat = 0, r = 0.75, h = 4.5) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "pillar", x: a.x, y: a.y, z: a.z, r, h, s: a.s, lat });
    return this;
  }
  crate(m, lat = 0, o = {}) {
    const a = this.at(m, lat);
    const hw = o.size || 0.8;
    this.b.pads.push({ kind: "crate", shape: "rect", x: a.x, z: a.z, y: a.y + 1.05, hw, hd: hw, rot: a.h, surf: "snow", solid: true, side: true, base: a.y, x0: a.x, z0: a.z, ax: a.rx * (o.amp || 0), az: a.rz * (o.amp || 0), period: o.period || 3.4, phase: o.phase || 0, s: a.s, lat, obstacle: true });
    return this;
  }
  rotor(m, lat = 0, o = {}) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "rotor", x: a.x, y: a.y, z: a.z, r: 0.55, h: 4, len: o.len || 3.4, speed: o.speed || 1.5, arms: o.arms || 2, phase: o.phase || 0, ang: 0, armH: 0.95, s: a.s, lat });
    return this;
  }
  hole(m, lat = 0, r = 1.2) {
    const a = this.at(m, lat);
    this.b.holes.push({ x: a.x, y: a.y, z: a.z, r, s: a.s, lat });
    return this;
  }
  spring(m, lat = 0, power = 14) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "spring", x: a.x, y: a.y, z: a.z, r: 1, power, s: a.s, kick: 0, lat });
    return this;
  }
  vent(m, lat = 0, o = {}) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "vent", x: a.x, y: a.y, z: a.z, r: o.r || 1.5, power: o.power || 11, height: o.height || 6, period: o.period || 3.6, duty: o.duty || 0.5, phase: o.phase || 0, on: false, s: a.s, lat, h0: a.h });
    return this;
  }
  icicle(m, lat = 0, o = {}) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "icicle", x: a.x, y: a.y, z: a.z, r: 0.95, top: a.y + 6.2, fy: a.y + 6.2, state: "hang", t: 0, trig: o.trig || 5.4, s: a.s, lat });
    return this;
  }
  seal(m, lat = 0, o = {}) {
    const a = this.at(m, lat);
    const lateral = o.along ? 0 : 1;
    this.b.objs.push({ type: "seal", x: a.x, y: a.y, z: a.z, x0: a.x, z0: a.z, r: 0.85, ax: lateral ? a.rx : a.dx, az: lateral ? a.rz : a.dz, amp: o.amp === undefined ? 2.6 : o.amp, period: o.period || 3.8, phase: o.phase || 0, state: "patrol", t: 0, s: a.s, lat, dir: 0, carry: null });
    return this;
  }
  fox(m, lat = 0, o = {}) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "fox", x: a.x, y: a.y, z: a.z, x0: a.x, z0: a.z, r: 0.6, trig: o.trig || 8, state: "hide", t: 0, s: a.s, lat, dir: 0, carry: null, idx: a.i });
    return this;
  }
  geyser(m, lat = 0, o = {}) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "geyser", x: a.x, y: a.y, z: a.z, r: o.r || 1.25, power: o.power || 15, period: o.period || 3.4, duty: o.duty || 0.3, phase: o.phase || 0, state: 0, s: a.s, lat });
    return this;
  }
  windmill(m, lat = 0, o = {}) {
    const a = this.at(m, lat);
    this.b.objs.push({ type: "windmill", x: a.x, y: a.y, z: a.z, r: 0.5, hub: o.hub || 3.2, blade: o.blade || 3.1, blades: o.blades || 3, speed: o.speed || 1.1, phase: o.phase || 0, ang: 0, rx: a.rx, rz: a.rz, dx: a.dx, dz: a.dz, s: a.s, lat, h0: a.h, side: o.side === undefined ? 1 : o.side });
    return this;
  }
  bump(m, o = {}) {
    const a = this.at(m, 0);
    this.b.objs.push({ type: "bump", x: a.x, y: a.y, z: a.z, s: a.s, i: a.i, hw: a.hw, h0: a.h, force: Boolean(o.force), limit: o.limit || 6.2, used: false, dx: a.dx, dz: a.dz });
    return this;
  }
  tip(m, text, key = "") {
    const a = this.at(m, 0);
    this.b.tips.push({ s: a.s, text, key, done: false });
    return this;
  }
  check(m) {
    const a = this.at(m, 0);
    this.b.checks.push({ x: a.x, y: a.y, z: a.z, s: a.s, i: a.i, hw: a.hw, h: a.h, on: false });
    return this;
  }
  snowballs(m0, m1, o = {}) {
    const a = this.at(m0, 0);
    const b = this.at(m1, 0);
    this.b.objs.push({ type: "balls", s0: a.s, s1: b.s, i0: a.i, i1: b.i, lat: o.lat || 0, wander: o.wander === undefined ? 0 : o.wander, r: o.r || 1.25, speed: o.speed || 5.5, period: o.period || 3.2, phase: o.phase || 0, list: [], next: o.phase || 0, count: 0, trig: a.s - 26, s: a.s });
    return this;
  }
  chaser(m0, m1, o = {}) {
    const a = this.at(m0, 0);
    const b = this.at(m1, 0);
    this.b.objs.push({ type: "chaser", s0: a.s, s1: b.s, i0: a.i, i1: b.i, r: o.r || 2.2, speed: o.speed || 6.2, trig: a.s + (o.after === undefined ? 6 : o.after), active: false, done: false, sNow: a.s, x: a.x, y: a.y, z: a.z, s: a.s });
    return this;
  }
  wind(m0, m1, o = {}) {
    this.b.zones.push({ type: "wind", s0: this.at(m0).s, s1: this.at(m1).s, dir: o.dir === undefined ? 1 : o.dir, power: o.power || 9, period: o.period || 4, duty: o.duty || 0.5, phase: o.phase || 0, gust: 0, pre: 0 });
    return this;
  }
  blizzard(m0, m1, o = {}) {
    this.b.zones.push({ type: "blizzard", s0: this.at(m0).s, s1: this.at(m1).s, fog: o.fog === undefined ? 0.7 : o.fog, push: o.push === undefined ? 2.4 : o.push });
    return this;
  }
  avalanche(m, o = {}) {
    const a = this.at(m, 0);
    const band = o.band || 5;
    this.b.objs.push({ type: "avalanche", x: a.x, y: a.y, z: a.z, s: a.s, i: a.i, band, hw: a.hw, dx: a.dx, dz: a.dz, rx: a.rx, rz: a.rz, h0: a.h, period: o.period || 5, warn: 1.5, run: o.run || 1.5, phase: o.phase || 0, state: 0, k: 0 });
    return this;
  }
  tunnel(m0, m1, o = {}) {
    const a = this.at(m0);
    const b = this.at(m1);
    this.b.objs.push({ type: "tunnel", s0: a.s, s1: b.s, i0: a.i, i1: b.i, collapse: o.collapse !== false, speed: o.speed || 6.2, active: false, front: a.s, s: a.s, trig: a.s + 3, done: false, x: a.x, y: a.y, z: a.z });
    return this;
  }
}

/** 스테이지를 짓는 커서 */
export class Builder {
  constructor(world) {
    this.world = world;
    this.P = [];
    this.pads = [];
    this.objs = [];
    this.items = [];
    this.tips = [];
    this.zones = [];
    this.holes = [];
    this.checks = [];
    this.route = [];
    this.c = { x: 0, y: 0, z: 0, h: 0, s: 0 };
    this.goal = null;
  }
  _sample(hw, surf, solid, bankL, bankR, patch) {
    const c = this.c;
    const dx = Math.sin(c.h);
    const dz = -Math.cos(c.h);
    this.P.push({ i: this.P.length, x: c.x, y: c.y, z: c.z, h: c.h, s: c.s, hw, surf, solid, bankL, bankR, patch, dx, dz, rx: Math.cos(c.h), rz: Math.sin(c.h), slope: 0, k: 0 });
  }
  /**
   * 길 조각. o: w(폭) w2(끝 폭) turn(도) dy(높이 변화) surf bank/bankL/bankR
   * profile: smooth | ramp(끝으로 갈수록 가팔라짐) | line, patch: [m0,m1,lat0,lat1,surf]
   */
  road(len, o = {}, fn) {
    const { w = 8, w2 = w, turn = 0, dy = 0, surf = "snow", bank = this.world.banks === undefined ? true : this.world.banks, profile = "smooth" } = o;
    const bankL = o.bankL === undefined ? bank : o.bankL;
    const bankR = o.bankR === undefined ? bank : o.bankR;
    const stretch = len > 6.5 && profile !== "ramp" ? ROAD_STRETCH : 1;
    const n = Math.max(2, Math.round((len * stretch) / DS));
    const i0 = this.P.length;
    const y0 = this.c.y;
    const h0 = this.c.h;
    const turnRad = (turn * Math.PI) / 180;
    const patches = o.patch ? (Array.isArray(o.patch[0]) ? o.patch : [o.patch]) : [];
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const pf = profile === "ramp" ? t * t : profile === "line" ? t : smooth(t);
      this.c.y = y0 + dy * pf;
      this.c.h = h0 + turnRad * t;
      const m = (i * DS) / stretch;
      let patch = null;
      for (const q of patches) if (m >= q[0] && m <= q[1]) patch = { lat0: q[2], lat1: q[3], surf: q[4] };
      this._sample(lerp(w, w2, t) / 2, surf, true, bankL, bankR, patch);
      this.c.x += Math.sin(this.c.h) * DS;
      this.c.z += -Math.cos(this.c.h) * DS;
      this.c.s += DS;
    }
    this.c.y = y0 + dy;
    this.c.h = h0 + turnRad;
    const p = new Placer(this, i0, n, stretch);
    if (fn) fn(p);
    return p;
  }
  /** 빈 공간 (점프로 넘거나 발판으로 건넘) */
  gap(len, o = {}) {
    const { dy = 0, turn = 0 } = o;
    const n = Math.max(1, Math.round(len / DS));
    const y0 = this.c.y;
    const h0 = this.c.h;
    const i0 = this.P.length;
    const turnRad = (turn * Math.PI) / 180;
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      this.c.y = y0 + dy * t;
      this.c.h = h0 + turnRad * t;
      this._sample(3, "void", false, false, false, null);
      this.c.x += Math.sin(this.c.h) * DS;
      this.c.z += -Math.cos(this.c.h) * DS;
      this.c.s += DS;
    }
    this.c.y = y0 + dy;
    this.c.h = h0 + turnRad;
    return new Placer(this, i0, n);
  }
  /**
   * 발판 하나. d: 앞으로 가는 거리, lat, dy, 나머지는 kind 별.
   *  kind: slab(네모) floe(동그라미 얼음) mover crumble vanish orbit
   */
  hop(d, o = {}) {
    const { lat = 0, dy = 0, kind = "floe", r = 2.2, surf = "ice", w, depth } = o;
    this.gap(d, { dy, turn: o.turn || 0 });
    const c = this.c;
    const dx = Math.sin(c.h);
    const dz = -Math.cos(c.h);
    const rx = Math.cos(c.h);
    const rz = Math.sin(c.h);
    const x = c.x + rx * lat;
    const z = c.z + rz * lat;
    const pad = { kind, shape: w ? "rect" : "disc", x, y: c.y, z, r, hw: (w || 0) / 2, hd: (depth || w || 0) / 2, rot: c.h, surf, solid: true, x0: x, z0: z, y0: c.y, ax: 0, az: 0, ay: 0, period: o.period || 4, phase: o.phase || 0, s: c.s, lat, state: 0, t: 0, vx: 0, vz: 0, vy: 0, bob: o.bob === undefined ? kind === "floe" : o.bob, route: true, moved: false, sink: 0 };
    if (kind === "mover" || kind === "magic") {
      pad.ax = rx * (o.amp || 0) + dx * (o.fwd || 0);
      pad.az = rz * (o.amp || 0) + dz * (o.fwd || 0);
      pad.ay = o.ampY || 0;
      pad.moved = true;
    }
    if (kind === "orbit") {
      pad.orbit = o.radius || 3;
      pad.moved = true;
    }
    if (kind === "crumble") {
      pad.delay = o.delay || 0.9;
      pad.back = o.back === undefined ? 4.5 : o.back;
    }
    if (kind === "vanish") {
      pad.duty = o.duty || 0.62;
      pad.moved = false;
    }
    this.pads.push(pad);
    this.route.push(pad);
    if (o.items) {
      for (const it of o.items) this.items.push({ type: it, x, y: c.y + 0.85, z, s: c.s, on: true });
    }
    return pad;
  }
  /** 나무판 다리: 지나가면 차례로 무너짐 */
  bridge(len, o = {}) {
    const { w = 3.2, plank = 1.3, surf = "snow", delay = 0.55, back = 6, dy = 0 } = o;
    const n = Math.max(2, Math.round(len / plank));
    const step = len / n;
    const y0 = this.c.y;
    const i0 = this.P.length;
    for (let i = 0; i < n; i += 1) {
      const t = (i + 0.5) / n;
      this.gap(step / 2);
      this.c.y = y0 + dy * t;
      const c = this.c;
      const pad = { kind: "plank", shape: "rect", x: c.x, y: c.y, z: c.z, hw: w / 2, hd: (step + 0.06) / 2, rot: c.h, surf, solid: true, x0: c.x, z0: c.z, y0: c.y, ax: 0, az: 0, ay: 0, period: 1, phase: 0, s: c.s, lat: 0, state: 0, t: 0, vx: 0, vz: 0, vy: 0, delay, back, route: false, moved: false, sink: 0, bridge: true, r: 0 };
      this.pads.push(pad);
      this.gap(step / 2);
    }
    for (let i = i0; i < this.P.length; i += 1) this.P[i].plank = true;
    this.c.y = y0 + dy;
    return this;
  }
  goalHere(o = {}) {
    const c = this.c;
    this.road(o.len || 12, { w: o.w || 12, surf: "snow", bank: true, bankL: true, bankR: true }, (p) => {
      const a = p.at((o.len || 12) * 0.55, 0);
      this.goal = { x: a.x, y: a.y, z: a.z, r: 2.6, h: a.h, s: a.s, i: a.i };
    });
    void c;
    return this;
  }
  finish(meta) {
    const P = this.P;
    for (let i = 0; i < P.length; i += 1) {
      const a = P[i];
      const b = P[Math.min(P.length - 1, i + 1)];
      a.slope = b.solid && a.solid && a !== b ? (b.y - a.y) / DS : 0;
      let dh = b.h - a.h;
      a.k = dh / DS;
    }
    return new Course(this, meta);
  }
}

const KEY = (ix, iz) => ix * 100003 + iz;
const CELL = 3;

export class Course {
  constructor(b, meta) {
    this.world = b.world;
    Object.assign(this, meta);
    this.P = b.P;
    this.pads = b.pads;
    this.objs = b.objs;
    this.items = b.items;
    this.tips = b.tips;
    this.zones = b.zones;
    this.holes = b.holes;
    this.checks = b.checks;
    this.route = b.route;
    this.goal = b.goal;
    this.length = b.c.s;
    this.grid = new Map();
    const P = this.P;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of P) {
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
      if (!s.solid) continue;
      const seen = new Set();
      const add = (x, z) => {
        const k = KEY(Math.floor(x / CELL), Math.floor(z / CELL));
        if (seen.has(k)) return;
        seen.add(k);
        let l = this.grid.get(k);
        if (!l) {
          l = [];
          this.grid.set(k, l);
        }
        l.push(s.i);
      };
      const ext = s.hw + 1.1;
      for (let lat = -ext; lat <= ext + 0.01; lat += 1.2) {
        for (const al of [-0.75, 0, 0.75]) add(s.x + s.rx * lat + s.dx * al, s.z + s.rz * lat + s.dz * al);
      }
    }
    for (const p of this.pads) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    this.minY = minY;
    this.maxY = maxY;
    this.seaY = this.world.sea ? minY - 1.1 : null;
    this.killY = this.world.sea ? this.seaY - 0.2 : minY - 9;
    this.hit = { ok: false };
    this.edge = { ok: false };
  }
  /** (x,z) 아래에 있는 길. y+step 보다 높은 면은 무시. */
  ribbonAt(x, z, y, step = 0.6) {
    const list = this.grid.get(KEY(Math.floor(x / CELL), Math.floor(z / CELL)));
    const hit = this.hit;
    hit.ok = false;
    const edge = this.edge;
    edge.ok = false;
    if (!list) return null;
    let bestY = -Infinity;
    let bestA = Infinity;
    let edgeLat = Infinity;
    for (let n = 0; n < list.length; n += 1) {
      const s = this.P[list[n]];
      const dx = x - s.x;
      const dz = z - s.z;
      const along = dx * s.dx + dz * s.dz;
      const lat = dx * s.rx + dz * s.rz;
      const tol = (DS * 0.5 * (1 + Math.abs(lat * s.k)) + 0.05) * 1.2;
      if (along < -tol || along > tol) continue;
      const top = s.y + s.slope * along;
      if (Math.abs(lat) <= s.hw) {
        if (top > y + step) continue;
        const better = top > bestY + 0.4 || (Math.abs(top - bestY) <= 0.4 && Math.abs(along) < bestA);
        if (better) {
          bestY = top;
          bestA = Math.abs(along);
          hit.ok = true;
          hit.s = s;
          hit.y = top;
          hit.lat = lat;
          hit.along = along;
        }
      } else if (Math.abs(lat) - s.hw < edgeLat && Math.abs(top - y) < 6) {
        edgeLat = Math.abs(lat) - s.hw;
        edge.ok = true;
        edge.s = s;
        edge.lat = lat;
        edge.y = top;
      }
    }
    if (!hit.ok) return null;
    for (let i = 0; i < this.holes.length; i += 1) {
      const q = this.holes[i];
      const dx = x - q.x;
      const dz = z - q.z;
      if (dx * dx + dz * dz < q.r * q.r && Math.abs(q.y - hit.y) < 2) {
        hit.ok = false;
        return null;
      }
    }
    return hit;
  }
  surfOf(hit) {
    const s = hit.s;
    if (s.patch && hit.lat >= s.patch.lat0 && hit.lat <= s.patch.lat1) return s.patch.surf;
    return s.surf;
  }
  padAt(x, z, y, step = 0.6) {
    let best = null;
    let bestY = -Infinity;
    for (let i = 0; i < this.pads.length; i += 1) {
      const p = this.pads[i];
      if (!p.solid) continue;
      const top = p.y;
      if (top > y + step || top < bestY) continue;
      const dx = x - p.x;
      const dz = z - p.z;
      if (p.shape === "disc") {
        if (dx * dx + dz * dz > p.r * p.r) continue;
      } else {
        const c = Math.cos(p.rot);
        const sn = Math.sin(p.rot);
        const u = dx * c + dz * sn;
        const v = -dx * sn + dz * c;
        if (Math.abs(u) > p.hw || Math.abs(v) > p.hd) continue;
      }
      best = p;
      bestY = top;
    }
    return best;
  }
  /** 지금 자리에서 가까운 길 표본 (앞뒤로 찾음) */
  nearest(x, z, from = -1) {
    const P = this.P;
    let best = 0;
    let bd = Infinity;
    const a = from < 0 ? 0 : Math.max(0, from - 40);
    const b = from < 0 ? P.length - 1 : Math.min(P.length - 1, from + 40);
    for (let i = a; i <= b; i += 1) {
      const dx = P[i].x - x;
      const dz = P[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
}
