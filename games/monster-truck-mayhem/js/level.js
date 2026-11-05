/* 코스 빌더 + 높이 격자. 물리와 그림이 같은 격자를 본다.
 *
 * - 앞 방향 = (sinθ, 0, cosθ), 오른쪽 = (-cosθ, 0, sinθ). turn 양수 = 오른쪽.
 * - 격자 1m: H 높이, O 벽까지 거리(0 보다 크면 코스 밖), M 재질.
 */
import { OBJECTS } from "./data.js?v=2";

export const MAT = { DIRT: 0, ASPHALT: 1, SNOW: 2, ICE: 3, ROCK: 4, LAVA: 5, GRASS: 6, VOID: 7 };
export const MU = [1.25, 1.5, 0.92, 0.34, 1.3, 1.2, 1.15, 1.2];

const smooth = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

function noise2(x, z) {
  const a = Math.sin(x * 0.13 + z * 0.07) + Math.sin(x * 0.31 - z * 0.23 + 1.7) * 0.6 + Math.sin(x * 0.71 + z * 0.61 + 4.1) * 0.25;
  return a / 1.85;
}

export class Builder {
  constructor(theme, opts = {}) {
    this.theme = theme;
    this.K = opts.k || 1.8;
    this.w = opts.w || 26;
    this.samples = [];
    this.extra = []; // 지름길 등 덧붙인 길
    this.s = 0;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.th = 0;
    this.objects = [];
    this.stamps = [];
    this.pads = [];
    this.zones = [];
    this.geysers = [];
    this.triggers = [];
    this.ramps = [];
    this.shape = null;
    this.noFinish = false;
    this.pushSample();
  }

  pushSample() {
    this.samples.push({ x: this.x, y: this.y, z: this.z, th: this.th, w: this.w, s: this.s });
  }

  /** 길을 이어 붙인다. turn: 도(오른쪽 +), dy: 높이 변화, w: 폭 */
  go(len, { turn = 0, dy = 0, w } = {}) {
    const n = Math.max(1, Math.round(len * this.K));
    const y0 = this.y;
    const w0 = this.w;
    const w1 = w || this.w;
    const dTh = -(turn * (this.turnK || 1) * Math.PI) / 180 / n;
    for (let i = 1; i <= n; i += 1) {
      this.th += dTh;
      this.x += Math.sin(this.th);
      this.z += Math.cos(this.th);
      this.y = y0 + dy * smooth(i / n);
      this.w = w0 + (w1 - w0) * (i / n);
      this.s += 1;
      this.pushSample();
    }
    return this;
  }

  /** s 지점의 표본 */
  at(s) {
    // 길을 다 이은 뒤의 표본을 쓴다: 설계 코드에서 물체를 길보다 먼저 놓아도 제자리에 놓인다
    const list = this.finalSamples || this.samples;
    const i = Math.max(0, Math.min(list.length - 1, Math.round(s * this.K)));
    return list[i];
  }

  /** (s, d) → 세계 좌표. d 양수 = 오른쪽 */
  pos(s, d = 0) {
    const a = this.at(s);
    return { x: a.x - Math.cos(a.th) * d, y: a.y, z: a.z + Math.sin(a.th) * d, th: a.th };
  }

  /** 물체 놓기. 놓인 자리의 땅 높이는 굽기 뒤에 맞춘다 */
  put(type, s, d = 0, o = {}) {
    if (!OBJECTS[type]) throw new Error(`없는 물체 ${type}`);
    const p = this.pos(s, d);
    const rec = { type, x: p.x, z: p.z, yaw: p.th + (o.yaw || 0), lift: o.lift || 0, on: o.on == null ? -1 : o.on, tag: o.tag || null, color: o.color, big: o.big };
    this.objects.push(rec);
    return this.objects.length - 1;
  }

  /** 세계 좌표로 놓기 (경기장용) */
  putAt(type, x, z, o = {}) {
    if (!OBJECTS[type]) throw new Error(`없는 물체 ${type}`);
    const rec = { type, x, z, yaw: o.yaw || 0, lift: o.lift || 0, on: o.on == null ? -1 : o.on, tag: o.tag || null, color: o.color, big: o.big };
    this.objects.push(rec);
    return this.objects.length - 1;
  }

  /** 점프대: s 에서 시작해 l 만큼 올라가 h 높이에서 끝난다 */
  ramp(s, d = 0, { h = 3.2, l = 12, w = 9, yaw = 0, kick = false } = {}) {
    const p = this.pos(s, d);
    const th = p.th + yaw;
    this.stamps.push({ kind: "ramp", x: p.x, z: p.z, th, h, l, w, kick });
    this.ramps.push({ x: p.x, z: p.z, th, h, l, w, s });
    return this;
  }

  rampAt(x, z, th, { h = 3.2, l = 12, w = 9 } = {}) {
    this.stamps.push({ kind: "ramp", x, z, th, h, l, w });
    this.ramps.push({ x, z, th, h, l, w, s: 0 });
    return this;
  }

  /** 둥근 언덕 */
  hump(s, d = 0, { h = 2, l = 10, w = 16 } = {}) {
    const p = this.pos(s, d);
    this.stamps.push({ kind: "hump", x: p.x, z: p.z, th: p.th, h, l, w });
    return this;
  }

  humpAt(x, z, th, { h = 2, l = 10, w = 16 } = {}) {
    this.stamps.push({ kind: "hump", x, z, th, h, l, w });
    return this;
  }

  /** 울퉁불퉁 구간 */
  bumps(s, len, { h = 0.5, every = 7 } = {}) {
    for (let t = 0; t < len * this.K; t += every) this.hump(s + t / this.K, 0, { h, l: every * 0.7, w: this.w + 6 });
    return this;
  }

  /** 끊어진 구간. kind: lava | void */
  gap(s, len, { kind = "lava", depth = 7 } = {}) {
    this.stamps.push({ kind: "gap", s: s * this.K, len, depth, type: kind });
    return this;
  }

  /** 점프대 + 바로 뒤에 끊어진 구간 (길이는 실제 미터). 착지 자리는 코스가 충분히 이어져 있어야 한다 */
  jumpGap(s, d, ramp, len, { kind = "lava", depth = 7 } = {}) {
    this.ramp(s, d, ramp);
    const lip = s * this.K + (ramp.l || 12);
    this.stamps.push({ kind: "gap", s: lip + 0.8, len, depth, type: kind });
    return lip;
  }

  /** 재질 구간 */
  surface(s, len, mat) {
    this.stamps.push({ kind: "mat", s: s * this.K, len: len * this.K, mat });
    return this;
  }

  ice(s, len) {
    return this.surface(s, len, MAT.ICE);
  }

  /** 부스터 발판 */
  pad(s, d = 0) {
    const p = this.pos(s, d);
    this.pads.push({ x: p.x, z: p.z, th: p.th, r: 3.6 });
    return this;
  }

  /** 착지 목표 구역 */
  zone(s, d = 0, r = 9) {
    const p = this.pos(s, d);
    this.zones.push({ x: p.x, z: p.z, r });
    return this;
  }

  zoneAt(x, z, r = 9) {
    this.zones.push({ x, z, r });
    return this;
  }

  /** 불꽃 분출구 */
  geyser(s, d = 0, { period = 3.2, on = 1.2, off = 0 } = {}) {
    const p = this.pos(s, d);
    this.geysers.push({ x: p.x, z: p.z, period, on, off, r: 2.6 });
    return this;
  }

  /** s 를 지나면 일어나는 일 (눈사태 등) */
  trigger(s, kind, data = {}) {
    this.triggers.push({ s: s * this.K, kind, ...data, done: false });
    return this;
  }

  /** 나무 다리: 끊어진 구간 위에 판자를 깐다. 밟으면 곧 무너진다 */
  bridge(s, len, { w = 6, d = 0 } = {}) {
    const n = Math.max(2, Math.round(len / 2.4));
    for (let i = 0; i < n; i += 1) {
      const t = s + ((i + 0.5) * len) / n / this.K;
      this.put("plank", t, d, { lift: 0, tag: "bridge" });
      const rec = this.objects[this.objects.length - 1];
      rec.fixedY = this.at(t).y - 0.15;
      rec.span = w;
    }
    return this;
  }

  /** 지름길: 두 지점을 곧게 잇는 길을 판다. 입구는 물체로 막는다 */
  shortcut(fromS, toS, { w = 10 } = {}) {
    const a = this.at(fromS);
    const b = this.at(toS);
    const list = [];
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const th = Math.atan2(b.x - a.x, b.z - a.z);
    for (let i = 0; i <= dist; i += 1) {
      const k = i / dist;
      list.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, th, w, s: a.s + (b.s - a.s) * k });
    }
    this.extra.push(list);
    return { th, a, b, dist };
  }

  /** 결승선 없는 길 (목표를 이루면 끝) */
  openEnd() {
    this.noFinish = true;
    return this;
  }

  /** 넓은 경기장 (둥근 사각형). 진행 표시가 없는 스테이지 */
  arena(rx, rz, { r = 12 } = {}) {
    this.shape = { rx, rz, r };
    this.noFinish = true;
    this.K = 1;
    // 시작 자리: 남쪽 벽 앞
    this.samples = [];
    for (let i = 0; i <= 8; i += 1) this.samples.push({ x: 0, y: 0, z: -rz + 8 + i, th: 0, w: rx * 2, s: i });
    this.s = 8;
    return this;
  }

  bake() {
    return new Level(this);
  }
}

export class Level {
  constructor(b) {
    this.theme = b.theme;
    this.samples = b.samples;
    this.length = b.samples[b.samples.length - 1].s;
    this.objects = b.objects;
    this.pads = b.pads;
    this.zones = b.zones;
    this.geysers = b.geysers;
    this.triggers = b.triggers;
    this.ramps = b.ramps;
    this.shape = b.shape;
    this.noFinish = b.noFinish;
    this.extra = b.extra;
    this.stamps = b.stamps;
    this.bakeGrid(b);
    this.settleObjects(b);
    const last = this.samples[this.samples.length - 1];
    this.finish = b.noFinish ? null : { x: last.x, z: last.z, y: this.height(last.x, last.z), th: last.th, w: last.w };
    const first = this.samples[0];
    this.start = { x: first.x, z: first.z, th: first.th, y: this.height(first.x, first.z) };
  }

  bakeGrid(b) {
    const margin = 46;
    if (!b.shape && b.samples.length > 1) {
      const a = b.samples[0];
      const z = b.samples[b.samples.length - 1];
      const back = [];
      for (let i = 16; i >= 1; i -= 1) back.push({ x: a.x - Math.sin(a.th) * i, y: a.y, z: a.z - Math.cos(a.th) * i, th: a.th, w: a.w, s: 0 });
      const tail = [];
      for (let i = 1; i <= 44; i += 1) tail.push({ x: z.x + Math.sin(z.th) * i, y: z.y, z: z.z + Math.cos(z.th) * i, th: z.th, w: z.w, s: z.s + i });
      b.extra.push(back, tail);
    }
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    const all = [b.samples, ...b.extra];
    for (const list of all) {
      for (const q of list) {
        x0 = Math.min(x0, q.x);
        x1 = Math.max(x1, q.x);
        z0 = Math.min(z0, q.z);
        z1 = Math.max(z1, q.z);
      }
    }
    if (b.shape) {
      x0 = -b.shape.rx;
      x1 = b.shape.rx;
      z0 = -b.shape.rz;
      z1 = b.shape.rz;
    }
    this.x0 = Math.floor(x0 - margin);
    this.z0 = Math.floor(z0 - margin);
    this.nx = Math.ceil(x1 + margin - this.x0) + 1;
    this.nz = Math.ceil(z1 + margin - this.z0) + 1;
    const n = this.nx * this.nz;
    const H = new Float32Array(n);
    const O = new Float32Array(n).fill(999);
    const M = new Uint8Array(n);
    const Y = new Float32Array(n);
    const SS = new Float32Array(n).fill(-1);
    const best = new Float32Array(n).fill(1e9);
    const base = this.theme.mat;
    this.H = H;
    this.O = O;
    this.M = M;
    const { nx, nz, x0: gx, z0: gz } = this;

    if (b.shape) {
      const { rx, rz, r } = b.shape;
      for (let j = 0; j < nz; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          const x = gx + i;
          const z = gz + j;
          const qx = Math.abs(x) - (rx - r);
          const qz = Math.abs(z) - (rz - r);
          const out = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
          O[i + j * nx] = out;
          Y[i + j * nx] = 0;
          SS[i + j * nx] = 1;
        }
      }
    } else {
      for (const list of all) {
        for (const q of list) {
          const hw = q.w / 2;
          const rad = Math.ceil(hw + 40);
          const fx = Math.sin(q.th);
          const fz = Math.cos(q.th);
          const rxv = -fz;
          const rzv = fx;
          const ci = Math.round(q.x - gx);
          const cj = Math.round(q.z - gz);
          for (let j = Math.max(0, cj - rad); j <= Math.min(nz - 1, cj + rad); j += 1) {
            for (let i = Math.max(0, ci - rad); i <= Math.min(nx - 1, ci + rad); i += 1) {
              const dx = gx + i - q.x;
              const dz = gz + j - q.z;
              const along = dx * fx + dz * fz;
              if (Math.abs(along) > 1.3) continue;
              const lat = dx * rxv + dz * rzv;
              const off = Math.abs(lat) - hw;
              const idx = i + j * nx;
              if (off < O[idx]) O[idx] = off;
              const dist = Math.abs(lat) + Math.abs(along) * 0.2;
              if (dist < best[idx]) {
                best[idx] = dist;
                Y[idx] = q.y;
                SS[idx] = q.s;
              }
            }
          }
        }
      }
    }

    // 표본 사이 구멍 메우기 (곡선 바깥쪽)
    for (let pass = 0; pass < 2; pass += 1) {
      for (let j = 1; j < nz - 1; j += 1) {
        for (let i = 1; i < nx - 1; i += 1) {
          const idx = i + j * nx;
          if (SS[idx] >= 0) continue;
          for (const k of [idx - 1, idx + 1, idx - nx, idx + nx]) {
            if (SS[k] >= 0) {
              SS[idx] = SS[k];
              Y[idx] = Y[k];
              O[idx] = Math.min(O[idx], O[k] + 1);
              break;
            }
          }
        }
      }
    }

    const amp = this.theme.rough == null ? 0.16 : this.theme.rough;
    const outer = this.theme.outer == null ? 3.2 : this.theme.outer;
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const idx = i + j * nx;
        const x = gx + i;
        const z = gz + j;
        const o = O[idx];
        const y = Y[idx];
        const rise = o > 0 ? smooth(o / 22) * outer + smooth((o - 8) / 30) * noise2(x * 0.4, z * 0.4) * 2.4 : 0;
        H[idx] = y + rise + noise2(x, z) * amp;
        M[idx] = base;
      }
    }

    for (const st of b.stamps) this.applyStamp(st, Y, SS, b);

    // 높이가 갑자기 튀는 격자 틈 정리 (경사 얕은 곳만 살짝)
    this.minY = -20;
  }

  applyStamp(st, Y, SS, b) {
    const { nx, nz, x0: gx, z0: gz, H, M } = this;
    if (st.kind === "ramp" || st.kind === "hump") {
      const fx = Math.sin(st.th);
      const fz = Math.cos(st.th);
      const rx = -fz;
      const rz = fx;
      const reach = Math.ceil(Math.hypot(st.l, st.w) + 6);
      const cx = st.kind === "ramp" ? st.x + (fx * st.l) / 2 : st.x;
      const cz = st.kind === "ramp" ? st.z + (fz * st.l) / 2 : st.z;
      const ci = Math.round(cx - gx);
      const cj = Math.round(cz - gz);
      for (let j = Math.max(0, cj - reach); j <= Math.min(nz - 1, cj + reach); j += 1) {
        for (let i = Math.max(0, ci - reach); i <= Math.min(nx - 1, ci + reach); i += 1) {
          const dx = gx + i - st.x;
          const dz = gz + j - st.z;
          const al = dx * fx + dz * fz;
          const la = Math.abs(dx * rx + dz * rz);
          const idx = i + j * nx;
          if (st.kind === "ramp") {
            if (al < 0 || al > st.l) continue;
            const side = 1 - smooth((la - st.w / 2) / 1.6);
            if (side <= 0) continue;
            // 처음엔 완만하게, 끝에서 살짝 들린다
            const t = al / st.l;
            const prof = t * (0.72 + 0.28 * t);
            H[idx] += st.h * prof * side;
          } else {
            const u = al / (st.l / 2);
            const v = la / (st.w / 2);
            const d = u * u + v * v * v * v;
            if (d >= 1) continue;
            H[idx] += st.h * (1 + Math.cos(Math.PI * Math.sqrt(d))) * 0.5;
          }
        }
      }
      return;
    }
    if (st.kind === "matAll") {
      for (let k = 0; k < M.length; k += 1) if (this.O[k] < 2) M[k] = st.mat;
      return;
    }
    if (st.kind === "gap" || st.kind === "mat") {
      for (let j = 0; j < nz; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          const idx = i + j * nx;
          const s = SS[idx];
          if (s < st.s - 2 || s > st.s + st.len + 2) continue;
          if (this.O[idx] > 16) continue;
          if (st.kind === "mat") {
            if (s >= st.s && s <= st.s + st.len && this.O[idx] < 2) M[idx] = st.mat;
          } else {
            const k = Math.min(smooth((s - st.s + 1.2) / 1.4), smooth((st.s + st.len + 1.2 - s) / 1.4));
            if (k <= 0) continue;
            H[idx] = Y[idx] - st.depth * k;
            if (k > 0.5) M[idx] = st.type === "lava" ? MAT.LAVA : MAT.VOID;
          }
        }
      }
    }
  }

  settleObjects() {
    for (const o of this.objects) {
      const def = OBJECTS[o.type];
      if (o.fixedY != null) {
        o.y = o.fixedY;
        continue;
      }
      if (o.on >= 0) {
        const p = this.objects[o.on];
        const pd = OBJECTS[p.type];
        o.y = p.y + pd.h[1] + def.h[1] + o.lift;
      } else {
        o.y = this.height(o.x, o.z) + def.h[1] + o.lift;
      }
    }
  }

  idx(x, z) {
    return Math.max(0, Math.min(this.nx - 1, Math.round(x - this.x0))) + Math.max(0, Math.min(this.nz - 1, Math.round(z - this.z0))) * this.nx;
  }

  sample(A, x, z) {
    const fx = Math.max(0, Math.min(this.nx - 1.001, x - this.x0));
    const fz = Math.max(0, Math.min(this.nz - 1.001, z - this.z0));
    const i = fx | 0;
    const j = fz | 0;
    const u = fx - i;
    const v = fz - j;
    const k = i + j * this.nx;
    const a = A[k];
    const b = A[k + 1];
    const c = A[k + this.nx];
    const d = A[k + this.nx + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  height(x, z) {
    return this.sample(this.H, x, z);
  }

  off(x, z) {
    return this.sample(this.O, x, z);
  }

  mat(x, z) {
    return this.M[this.idx(x, z)];
  }

  normal(x, z, out = [0, 1, 0]) {
    const e = 0.9;
    const dx = this.sample(this.H, x + e, z) - this.sample(this.H, x - e, z);
    const dz = this.sample(this.H, x, z + e) - this.sample(this.H, x, z - e);
    const ny = 2 * e;
    const len = Math.hypot(dx, ny, dz);
    out[0] = -dx / len;
    out[1] = ny / len;
    out[2] = -dz / len;
    return out;
  }

  /** 벽 안쪽 방향 (O 가 줄어드는 쪽) */
  wallNormal(x, z, out = [0, 0]) {
    const e = 1.4;
    const dx = this.sample(this.O, x + e, z) - this.sample(this.O, x - e, z);
    const dz = this.sample(this.O, x, z + e) - this.sample(this.O, x, z - e);
    const len = Math.hypot(dx, dz) || 1;
    out[0] = -dx / len;
    out[1] = -dz / len;
    return out;
  }
}
