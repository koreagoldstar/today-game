/*
 * 전장 지도: 경로(거리 s → 위치) · 설치 칸 검사
 *  적 이동, 설치 가능 여부, 화면의 길/칸 그림이 모두 이 결과를 쓴다 (서로 어긋나지 않게).
 */
import { FIELD } from "../data/worlds.js";

export const PATH_HALF = 0.95; // 길 가운데에서 이만큼 안쪽 칸은 설치 불가

export class Path {
  constructor(points) {
    this.pts = points.map(([x, z]) => ({ x, z }));
    this.seg = [];
    let s = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i];
      const b = this.pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      this.seg.push({ a, b, s0: s, len, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len });
      s += len;
    }
    this.length = s;
  }
  /** 거리 s 의 위치와 진행 방향 (끝을 넘으면 끝) */
  at(s, out = {}) {
    const L = this.length;
    const q = Math.max(0, Math.min(L, s));
    let lo = 0;
    let hi = this.seg.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (this.seg[m].s0 <= q) lo = m;
      else hi = m - 1;
    }
    const g = this.seg[lo];
    const t = q - g.s0;
    out.x = g.a.x + g.dx * t;
    out.z = g.a.z + g.dz * t;
    out.dx = g.dx;
    out.dz = g.dz;
    return out;
  }
  /** 점에서 길까지 가장 가까운 거리 · 그때의 s */
  nearest(x, z) {
    let best = Infinity;
    let bs = 0;
    for (const g of this.seg) {
      const t = Math.max(0, Math.min(g.len, (x - g.a.x) * g.dx + (z - g.a.z) * g.dz));
      const px = g.a.x + g.dx * t;
      const pz = g.a.z + g.dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) {
        best = d;
        bs = g.s0 + t;
      }
    }
    return { d: best, s: bs };
  }
  /** 전장 안으로 들어오는 첫 지점의 s (입구가 전장 밖이므로) */
  entryS() {
    for (let s = 0; s < this.length; s += 0.1) {
      const p = this.at(s);
      if (p.x >= 0 && p.x <= FIELD.w && p.z >= 0 && p.z <= FIELD.d) return s;
    }
    return 0;
  }
}

/** 칸 종류: 0 설치 가능 · 1 길 · 2 둥지 · 3 물/용암 · 4 장식 · 5 다리 · 6 분출구 */
export const CELL = { OPEN: 0, PATH: 1, NEST: 2, WATER: 3, DECOR: 4, BRIDGE: 5, VENT: 6 };

export class GameMap {
  constructor(world) {
    this.world = world;
    this.w = FIELD.w;
    this.d = FIELD.d;
    this.paths = world.paths.map((p) => new Path(p));
    this.cells = new Uint8Array(this.w * this.d);
    this.raise = new Float32Array(this.w * this.d); // 언덕 높이 (그림 · 타워 받침 높이)
    const idx = (x, z) => z * this.w + x;
    for (let z = 0; z < this.d; z++)
      for (let x = 0; x < this.w; x++) {
        const cx = x + 0.5;
        const cz = z + 0.5;
        let onPath = false;
        for (const p of this.paths) if (p.nearest(cx, cz).d < PATH_HALF) onPath = true;
        if (onPath) this.cells[idx(x, z)] = CELL.PATH;
      }
    for (const [x, z] of world.water || []) if (this.cells[idx(x, z)] === CELL.OPEN) this.cells[idx(x, z)] = CELL.WATER;
    for (const [x, z] of world.lava || []) if (this.cells[idx(x, z)] === CELL.OPEN) this.cells[idx(x, z)] = CELL.WATER;
    for (const [x, z] of world.bridges || []) this.cells[idx(x, z)] = CELL.BRIDGE;
    for (const [x, z] of world.decor || []) if (this.cells[idx(x, z)] === CELL.OPEN) this.cells[idx(x, z)] = CELL.DECOR;
    const g = world.gimmick;
    if (g && g.kind === "lavaVent") for (const v of g.vents) this.cells[idx(Math.floor(v.x), Math.floor(v.z))] = CELL.VENT;
    // 둥지 둘레 3×3
    const nx = Math.floor(world.nest.x);
    const nz = Math.floor(world.nest.z);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = nx + dx;
        const z = nz + dz;
        if (x >= 0 && z >= 0 && x < this.w && z < this.d) this.cells[idx(x, z)] = CELL.NEST;
      }
    for (const [x0, z0, w, d] of world.raised || [])
      for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) if (x < this.w && z < this.d) this.raise[idx(x, z)] = 0.35;
  }
  inside(x, z) {
    return x >= 0 && z >= 0 && x < this.w && z < this.d;
  }
  cell(x, z) {
    return this.inside(x, z) ? this.cells[z * this.w + x] : -1;
  }
  height(x, z) {
    return this.inside(x, z) ? this.raise[z * this.w + x] : 0;
  }
  /** 설치 가능한 칸인지 (타워가 이미 있는지는 sim 이 따로 봄) */
  buildable(x, z) {
    return this.cell(x, z) === CELL.OPEN;
  }
}
