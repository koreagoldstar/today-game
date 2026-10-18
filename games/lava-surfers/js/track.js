/*
 * 용암 서핑 · 코스 (트랙 좌표계)
 *
 *  코스는 화산 경사면을 내려가는 중심선(곡선) 하나로 정한다.
 *   s = 출발점부터 중심선을 따라 간 거리(m) · u = 중심선에서 오른쪽(+)/왼쪽(-)으로 떨어진 거리(m)
 *  표면 높이 = 중심선 높이 + 가장자리로 갈수록 살짝 올라가는 그릇 모양 + 점프대(경사로)
 *  틈(용암 강 · 절벽) 구간에는 땅이 없다 → 빠지면 용암.
 *  모든 장애물 · 수집물 · 체크포인트도 (s, u) 로 놓는다 → 충돌 판정과 보이는 모양이 같은 자리에 있게.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** (s, 값) 키프레임 사이를 부드럽게 */
function keyed(keys, s) {
  if (s <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (s <= keys[i][0]) {
      const [s0, v0] = keys[i - 1];
      const [s1, v1] = keys[i];
      let t = (s - s0) / (s1 - s0 || 1);
      t = t * t * (3 - 2 * t);
      return lerp(v0, v1, t);
    }
  }
  return keys[keys.length - 1][1];
}

export class Track {
  /**
   * @param def { points:[[x,y,z]...], width:[[s,hw]...], walls:[[s0,s1,side]], gaps:[[s0,s1]], ramps:[[s0,s1,h]], pads:[{s,u,r,h}] }
   */
  constructor(def) {
    this.def = def;
    const curve = new THREE.CatmullRomCurve3(def.points.map(([x, y, z]) => V(x, y, z)), false, "centripetal");
    this.curve = curve;
    this.len = curve.getLength();
    // 0.5m 마다 미리 계산 (위치 · 앞 방향 · 오른쪽)
    this.step = 0.5;
    const n = Math.ceil(this.len / this.step) + 1;
    this.n = n;
    this.P = new Float32Array(n * 3);
    this.T = new Float32Array(n * 3);
    this.R = new Float32Array(n * 3);
    const up = V(0, 1, 0);
    const t = V();
    const r = V();
    for (let i = 0; i < n; i++) {
      const u = Math.min(1, (i * this.step) / this.len);
      const p = curve.getPointAt(u);
      curve.getTangentAt(u, t);
      r.crossVectors(t, up).normalize();
      this.P.set([p.x, p.y, p.z], i * 3);
      this.T.set([t.x, t.y, t.z], i * 3);
      this.R.set([r.x, r.y, r.z], i * 3);
    }
    this.gaps = def.gaps || [];
    this.ramps = def.ramps || [];
    this.pads = def.pads || [];
    this.holes = []; // 무너진 땅 (실행 중에 생김): {s0,s1,u0,u1}
  }
  /** s 에서 중심선 정보 (선형 보간) */
  frame(s, out = {}) {
    const f = clamp(s / this.step, 0, this.n - 1.001);
    const i = Math.floor(f);
    const k = f - i;
    const a = i * 3;
    const b = a + 3;
    const L = (arr, o) => arr[a + o] + (arr[b + o] - arr[a + o]) * k;
    out.x = L(this.P, 0);
    out.y = L(this.P, 1);
    out.z = L(this.P, 2);
    out.tx = L(this.T, 0);
    out.ty = L(this.T, 1);
    out.tz = L(this.T, 2);
    out.rx = L(this.R, 0);
    out.rz = L(this.R, 2);
    const rl = Math.hypot(out.rx, out.rz) || 1;
    out.rx /= rl;
    out.rz /= rl;
    return out;
  }
  /** 경사 (내려가는 정도 0~): 앞 방향의 아래쪽 성분 */
  slope(s) {
    const f = this.frame(s, this._f || (this._f = {}));
    return -f.ty / (Math.hypot(f.tx, f.ty, f.tz) || 1);
  }
  halfWidth(s) {
    return keyed(this.def.width, s);
  }
  /** 가장자리 높은 벽이 있나 (side: -1 왼쪽 · 1 오른쪽) */
  wall(s, side) {
    for (const [s0, s1, sd] of this.def.walls || []) if (s >= s0 && s <= s1 && (sd === 0 || sd === side)) return true;
    return false;
  }
  rampAdd(s) {
    for (const [s0, s1, h] of this.ramps) {
      if (s >= s0 && s <= s1) {
        const t = (s - s0) / (s1 - s0);
        return h * t * t; // 점점 가팔라지는 킥 (끝에서 튀어 오름)
      }
    }
    return 0;
  }
  /** 이 s 의 바닥이 '틈'(용암 강 · 절벽)인가 */
  inGap(s) {
    for (const [s0, s1] of this.gaps) if (s > s0 && s < s1) return true;
    return false;
  }
  /** 가운데 그릇 모양 (가장자리로 갈수록 올라감) */
  bowl(s, u) {
    const hw = this.halfWidth(s);
    const k = clamp(Math.abs(u) / hw, 0, 1.4);
    return k > 0.7 ? (k - 0.7) * (k - 0.7) * hw * 0.45 : 0;
  }
  /**
   * (s,u) 표면 높이 (없으면 null): 틈 · 무너진 땅 · 코스 밖(벽 없는 가장자리)
   */
  surfaceY(s, u) {
    if (s < -20 || s > this.len) return null;
    const hw = this.halfWidth(s);
    // 용암 위 바위 발판
    for (const p of this.pads) {
      if (Math.abs(s - p.s) < p.r && Math.hypot(s - p.s, u - p.u) < p.r) return this.frame(p.s, this._g || (this._g = {})).y + (p.h || 0);
    }
    if (this.inGap(s)) return null;
    if (Math.abs(u) > hw + 0.25) return null;
    for (const h of this.holes) if (s > h.s0 && s < h.s1 && u > h.u0 && u < h.u1) return null;
    const f = this.frame(s, this._h || (this._h = {}));
    return f.y + this.bowl(s, u) + this.rampAdd(s);
  }
  /** 용암 강 높이 (틈 아래 · 코스 옆 아래) */
  lavaY(s) {
    return this.frame(s, this._l || (this._l = {})).y - (this.def.lavaDepth || 9);
  }
  /** (s,u,y) → 세계 좌표 */
  toWorld(s, u, y, out = V()) {
    const f = this.frame(s, this._w || (this._w = {}));
    return out.set(f.x + f.rx * u, y, f.z + f.rz * u);
  }
  /** 세계 좌표 → 가장 가까운 s (카메라 · 배경용, 근처 s 에서 찾기) */
  nearestS(x, z, guess = 0, range = 40) {
    let best = guess;
    let bd = Infinity;
    for (let s = Math.max(0, guess - range); s <= Math.min(this.len, guess + range); s += 1) {
      const f = this.frame(s, this._n || (this._n = {}));
      const d = (f.x - x) ** 2 + (f.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }
}
