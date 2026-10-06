/*
 * 제트스키 썬더 레이스 · 코스(트랙)
 *
 * 코스는 5m 짜리 구간(segment)이 이어진 한 줄의 물길이다.
 *  - curve: 휨 정도(1/m, + 는 오른쪽) → 화면에서 물길이 휘고 원심력이 바깥으로 민다
 *  - y    : 그 지점 물 높이(m) → 큰 파도 · 너울
 *  - hw   : 코스 절반 폭(m) → 부표 줄 밖은 거친 물 (느려짐)
 * 물건(부표 · 바위 · 부스터 · 점프대 …)은 z(출발선에서 m) 와 x(가운데에서 m) 로 놓는다.
 */
import { clamp, lerp, seeded } from "./view.js?v=1";

export const SEG = 5;
export const RUNOUT = 420; // 결승선 뒤로 더 그려 주는 물길

/** 물건 종류별 충돌 · 효과 정보 (r: 좌우 반폭, d: 앞뒤 반길이, top: 높이 — 점프로 넘을 수 있음) */
export const OBJ = {
  rock: { solid: true, r: 1.7, d: 1.5, top: 2.2, kind: "crash" },
  rockBig: { solid: true, r: 3.2, d: 2.6, top: 3.6, kind: "crash" },
  log: { solid: true, r: 2.6, d: 0.55, top: 0.7, kind: "crash" },
  barrel: { solid: true, r: 0.75, d: 0.75, top: 1.1, kind: "crash" },
  crate: { solid: true, r: 0.9, d: 0.9, top: 1.2, kind: "crash" },
  buoy: { solid: true, r: 0.9, d: 0.9, top: 1.6, kind: "bump" },
  pylon: { solid: true, r: 1.1, d: 1.1, top: 2.6, kind: "bump" },
  coral: { solid: true, r: 1.6, d: 1.3, top: 1.4, kind: "crash" },
  iceberg: { solid: true, r: 3.4, d: 3, top: 4.5, kind: "crash" },
  iceChunk: { solid: true, r: 1.3, d: 1.2, top: 1.2, kind: "crash" },
  wreckMast: { solid: true, r: 0.9, d: 0.8, top: 2.6, kind: "crash" },
  reefHead: { solid: true, r: 1.6, d: 1.4, top: 1.0, kind: "crash" },
  lavaRock: { solid: true, r: 1.7, d: 1.5, top: 2.2, kind: "crash" },
  beaconRock: { solid: true, r: 1.6, d: 1.4, top: 2, kind: "crash" },
  // 때맞춰 위험해지는 것 (경고 → 터짐): 번개 · 증기 · 촉수
  zap: { hazard: "zap", r: 3, d: 3, period: 3.6, warn: 1.5, strike: 0.35, top: 99 },
  geyser: { hazard: "geyser", r: 2.1, d: 2.1, period: 3, warn: 1.1, strike: 1, top: 9 },
  tentacle: { hazard: "tentacle", r: 1.6, d: 1.4, period: 4.2, warn: 1.2, strike: 1.6, top: 4 },
  lightGate: { lightGate: true, r: 2.8, d: 1.2 },
  pad: { pad: true, r: 1.7, d: 3.2 },
  orb: { orb: true, r: 1.3, d: 1.3 },
  ramp: { ramp: true, r: 2.6, d: 3.5, top: 1.6 },
  bigRamp: { ramp: true, r: 3, d: 4.5, top: 2.4, big: true },
};

export class Track {
  /**
   * course: { length, build(b), theme, seed }
   */
  constructor(course) {
    this.course = course;
    this.segs = [];
    this.objs = []; // 맞부딪칠 수 있는 것 · 먹는 것
    this.scenery = []; // 코스 밖 풍경 (충돌 없음)
    this.splits = [];
    this.currents = []; // 물살 구간: { z0, z1, x0, x1, mul }
    this.swells = []; // 너울 · 큰 파도: { z0, z1, amp, len, phase }
    this.gates = [];
    this.marks = []; // 회전 표시 대형 부표 등 (코스 밖 장식 · 약한 충돌은 objs 로)
    this.waves = []; // 움직이는 큰 파도: { z0, z1, amp, len, speed, phase }
    this.winds = []; // 옆바람: { z0, z1, force }
    this.slips = []; // 미끄러운 얼음물: { z0, z1, grip }
    this.tunnels = []; // 산호 터널: { z0, z1 }
    this.time = 0;
    this.length = course.length;
    const total = Math.ceil((course.length + RUNOUT) / SEG) + 2;
    for (let i = 0; i < total; i++) this.segs.push({ i, z: i * SEG, curve: 0, y: 0, hw: course.width || 11, objs: [], scen: [], split: null, dark: 0 });
    const b = new Builder(this);
    course.build(b);
    this.finalize();
  }

  segAt(z) {
    const i = clamp(Math.floor(z / SEG), 0, this.segs.length - 1);
    return this.segs[i];
  }

  /** 물 높이 (부드럽게 이어짐) + 움직이는 큰 파도 */
  heightAt(z) {
    const i = Math.floor(z / SEG);
    const s0 = this.segs[clamp(i, 0, this.segs.length - 1)];
    const s1 = this.segs[clamp(i + 1, 0, this.segs.length - 1)];
    const f = z / SEG - i;
    const y = lerp(s0.y, s1.y, f);
    return this.waves.length ? y + this.waveAt(z) : y;
  }

  /** 움직이는 파도: 카메라 쪽으로 밀려오고, 크기가 시간에 따라 숨 쉬듯 변한다 */
  waveAt(z) {
    let y = 0;
    const t = this.time;
    for (const w of this.waves) {
      if (z < w.z0 - w.len || z > w.z1 + w.len) continue;
      const fin = clamp((z - (w.z0 - w.len)) / w.len, 0, 1);
      const fout = clamp((w.z1 + w.len - z) / w.len, 0, 1);
      const e = Math.min(fin, fout);
      const env = e * e * (3 - 2 * e);
      const breathe = 0.72 + 0.28 * Math.sin(t * 0.42 + z * 0.0031 + w.phase);
      y += Math.sin(((z + w.speed * t) / w.len) * Math.PI * 2 + w.phase) * w.amp * env * breathe;
    }
    return y;
  }

  /** 옆바람 (m/s, + 오른쪽으로 민다) — 돌풍처럼 세졌다 약해졌다 */
  windAt(z) {
    let f = 0;
    for (const w of this.winds) {
      if (z < w.z0 || z > w.z1) continue;
      const e = Math.min(1, (z - w.z0) / 30, (w.z1 - z) / 30);
      f += w.force * e * (0.65 + 0.35 * Math.sin(this.time * 0.9 + z * 0.013));
    }
    return f;
  }

  /** 터널 안 깊이 0~1 (입구 · 출구는 서서히) */
  tunnelAt(z) {
    for (const t of this.tunnels) {
      if (z < t.z0 - 20 || z > t.z1 + 10) continue;
      return clamp(Math.min((z - (t.z0 - 20)) / 30, (t.z1 + 10 - z) / 20), 0, 1);
    }
    return 0;
  }

  /** 얼음물 미끄러움 (1 = 보통, 작을수록 미끄럽다) */
  gripAt(z) {
    for (const s of this.slips) if (z >= s.z0 && z <= s.z1) return s.grip;
    return 1;
  }

  /** 위험물 상태: idle | warn | strike, k = 그 상태 진행도 0~1 */
  hazardState(o) {
    const ph = (((this.time + (o.offset || 0)) % o.period) + o.period) % o.period;
    if (ph < o.warn) return { st: "warn", k: ph / o.warn };
    if (ph < o.warn + o.strike) return { st: "strike", k: (ph - o.warn) / o.strike };
    return { st: "idle", k: (ph - o.warn - o.strike) / Math.max(0.01, o.period - o.warn - o.strike) };
  }

  hwAt(z) {
    const i = Math.floor(z / SEG);
    const s0 = this.segs[clamp(i, 0, this.segs.length - 1)];
    const s1 = this.segs[clamp(i + 1, 0, this.segs.length - 1)];
    return lerp(s0.hw, s1.hw, z / SEG - i);
  }

  curveAt(z) {
    return this.segAt(z).curve;
  }

  splitAt(z) {
    for (const s of this.splits) if (z >= s.z0 && z <= s.z1) return s;
    return null;
  }

  /** 물살 배수 (지름길 물살 · 맞바람 등) */
  currentAt(z, x) {
    let m = 1;
    for (const c of this.currents) if (z >= c.z0 && z <= c.z1 && x >= c.x0 && x <= c.x1) m *= c.mul;
    return m;
  }

  /** 가운데 섬(지름길 갈림)의 지금 폭: 앞뒤 끝은 둥글게 좁아진다 */
  dividerAt(z) {
    const s = this.splitAt(z);
    if (!s) return null;
    const u = (z - s.z0) / (s.z1 - s.z0);
    const k = Math.sin(Math.PI * clamp(u, 0, 1));
    return { cx: s.cx, w: s.dw * Math.pow(k, 0.45), s };
  }

  finalize() {
    // 너울 높이
    const segs = this.segs;
    for (const s of segs) {
      let y = 0;
      for (const w of this.swells) {
        if (s.z < w.z0 - w.len || s.z > w.z1 + w.len) continue;
        // 들어가고 나올 때 부드럽게
        const fin = clamp((s.z - (w.z0 - w.len)) / w.len, 0, 1);
        const fout = clamp((w.z1 + w.len - s.z) / w.len, 0, 1);
        const env = Math.min(fin, fout);
        y += Math.sin(((s.z - w.z0) / w.len) * Math.PI * 2 + (w.phase || 0)) * w.amp * env * env * (3 - 2 * env);
      }
      s.y = y;
    }
    // 물건을 구간에 꽂아 두기 (그리기 · 충돌 검사용)
    for (const o of this.objs) this.segAt(o.z).objs.push(o);
    for (const o of this.scenery) this.segAt(o.z).scen.push(o);
    for (const g of this.gates) this.segAt(g.z).scen.push(g);
    for (const sp of this.splits) {
      for (let z = sp.z0; z <= sp.z1; z += SEG) this.segAt(z).split = sp;
    }
  }

  /** z0~z1 사이에 있는 물건 (충돌 검사) */
  objsBetween(z0, z1, out) {
    out.length = 0;
    const i0 = clamp(Math.floor((z0 - 6) / SEG), 0, this.segs.length - 1);
    const i1 = clamp(Math.floor((z1 + 6) / SEG), 0, this.segs.length - 1);
    for (let i = i0; i <= i1; i++) for (const o of this.segs[i].objs) out.push(o);
    return out;
  }
}

/* ================================================================
 * 코스 만들기 도구 (data.js 의 build(b) 에서 사용)
 * ============================================================== */
class Builder {
  constructor(track) {
    this.t = track;
    this.z = 0;
    this.rnd = seeded(track.course.seed || 7);
  }

  /** 곧은 물길 len(m) — 시작 z 를 돌려준다 */
  straight(len) {
    const z0 = this.z;
    this.z += len;
    return z0;
  }

  /** 휘는 물길: k(1/m, + 오른쪽) · 들어가고 나오는 부분은 부드럽게 */
  curve(len, k, ease = 0.3) {
    const z0 = this.z;
    const n = Math.max(1, Math.round(len / SEG));
    const i0 = Math.floor(z0 / SEG);
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) / n;
      const e = ease > 0 ? Math.min(1, u / ease, (1 - u) / ease) : 1;
      const s = this.t.segs[i0 + j];
      if (s) s.curve += k * (e < 1 ? e * e * (3 - 2 * e) : 1);
    }
    this.z += n * SEG;
    return z0;
  }

  /** 코스 폭(절반, m)을 z0~z1 에서 바꾼다 (양 끝은 서서히) */
  width(z0, z1, hw, ramp = 30) {
    for (const s of this.t.segs) {
      if (s.z < z0 - ramp || s.z > z1 + ramp) continue;
      const f = s.z < z0 ? (s.z - (z0 - ramp)) / ramp : s.z > z1 ? (z1 + ramp - s.z) / ramp : 1;
      const k = clamp(f, 0, 1);
      s.hw = lerp(s.hw, hw, k * k * (3 - 2 * k));
    }
  }

  /** 너울 · 큰 파도 */
  swell(z0, z1, amp, len, phase = 0) {
    this.t.swells.push({ z0, z1, amp, len, phase });
  }

  /** 맞부딪치는 것 · 먹는 것 */
  obj(type, z, x, opts = {}) {
    const base = OBJ[type] || {};
    const o = { type, z, x, ...base, ...opts, id: this.t.objs.length };
    this.t.objs.push(o);
    return o;
  }

  /** 줄지어 놓기: n 개를 dz 간격으로 x 를 바꿔 가며 */
  row(type, z, xs, dz = 0, opts = {}) {
    xs.forEach((x, i) => this.obj(type, z + i * dz, x, opts));
  }

  /** 코스 밖 풍경 */
  scen(type, z, x, opts = {}) {
    const o = { type, z, x, scen: true, ...opts };
    this.t.scenery.push(o);
    return o;
  }

  /** 출발 · 결승 · 체크 게이트 */
  gate(kind, z) {
    this.t.gates.push({ type: "gate", kind, z, x: 0, scen: true });
  }

  /**
   * 갈림길(지름길): 가운데 섬이 물길을 둘로 나눈다
   *  side: 지름길 쪽 ("left" | "right") · mul: 지름길 물살 배수
   */
  split(z0, z1, { dw = 6, cx = 0, side = "right", mul = 1.12, hw = 21, decor = "palm" } = {}) {
    const sp = { z0, z1, dw, cx, side, mul, decor };
    this.t.splits.push(sp);
    this.width(z0 - 10, z1 + 14, hw, 60);
    // 가운데 섬 위 야자수 · 바위 (풍경)
    for (let z = z0 + 14; z < z1 - 10; z += 20 + this.rnd() * 8) {
      const u = (z - z0) / (z1 - z0);
      if (Math.sin(Math.PI * u) < 0.55) continue;
      const dec = decor === "rock" ? "rockIsle" : decor === "ice" ? "penguinFloe" : decor === "coral" ? "coralSpire" : "palmTuft";
      this.scen(dec, z, cx + (this.rnd() - 0.5) * dw * 0.5, { v: this.rnd(), flip: this.rnd() < 0.5 });
    }
    this.scen("rockIsle", z0 + 4, cx, { v: 0.2 });
    this.scen("rockIsle", z1 - 4, cx, { v: 0.6 });
    const x0 = side === "right" ? cx + dw * 0.6 : -99;
    const x1 = side === "right" ? 99 : cx - dw * 0.6;
    this.t.currents.push({ z0: z0 + 8, z1: z1 - 8, x0, x1, mul });
    return sp;
  }

  /** 벽(해적선 · 절벽 사이): 코스 가장자리 + margin 을 넘으면 튕겨 나온다 */
  walls(z0, z1, margin = 2.5) {
    for (const s of this.t.segs) if (s.z >= z0 && s.z <= z1) s.wall = margin;
  }

  /** 지그재그 부표 (슬라럼) */
  slalom(z0, n, dz, amp, type = "pylon", opts = {}) {
    for (let i = 0; i < n; i++) this.obj(type, z0 + i * dz, (i % 2 ? 1 : -1) * amp, opts);
  }

  /** 움직이는 큰 파도 (빅 웨이브 · 폭풍) — speed > 0 이면 카메라 쪽으로 밀려온다 */
  wave(z0, z1, amp, len, speed = 6, phase = 0) {
    this.t.waves.push({ z0, z1, amp, len, speed, phase });
  }

  /** 옆바람 구간 (+ 오른쪽) */
  wind(z0, z1, force) {
    this.t.winds.push({ z0, z1, force });
  }

  /** 산호 터널: 코스 위로 아치가 줄지어 선다 (안은 어둑) */
  tunnel(z0, z1, every = 14) {
    this.t.tunnels.push({ z0, z1 });
    for (let z = z0; z <= z1; z += every) this.t.gates.push({ type: "coralArch", z, x: 0, scen: true });
  }

  /** 미끄러운 얼음물 구간 */
  slip(z0, z1, grip = 0.4) {
    this.t.slips.push({ z0, z1, grip });
  }

  /** 그 밖의 물살 (맞바람 · 해류) */
  current(z0, z1, x0, x1, mul) {
    this.t.currents.push({ z0, z1, x0, x1, mul });
  }

  /**
   * 풍경을 한꺼번에 흩뿌리기: 코스 양쪽에 kinds 를 every(m) 마다
   *  near: [최소, 최대] 코스 가장자리에서 떨어진 거리
   */
  scatter(z0, z1, kinds, { every = 60, near = [10, 40], side = 0, jitter = 0.5 } = {}) {
    const r = this.rnd;
    for (let z = z0; z < z1; z += every * (1 - jitter / 2 + r() * jitter)) {
      const sd = side || (r() < 0.5 ? -1 : 1);
      const hw = this.t.segAt(z).hw;
      const d = near[0] + r() * (near[1] - near[0]);
      const type = Array.isArray(kinds) ? kinds[Math.floor(r() * kinds.length)] : kinds;
      this.scen(type, z, sd * (hw + d), { flip: r() < 0.5, v: r() });
    }
  }
}
