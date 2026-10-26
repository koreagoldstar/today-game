/*
 * 환경 장식 모델 (나무 · 덤불 · 바위 · 꽃 · 버섯 · 침엽수 · 수정 · 현무암 · 무덤 …)
 *  - 부품을 한 모양(BufferGeometry)으로 '구워' 색을 꼭짓점에 넣는다 → 같은 장식 여러 개를 한 번에 그림(인스턴싱)
 *  - 둥근 잎덩이는 잡음으로 울퉁불퉁하게, 바위는 각진 면으로 → 기본 도형 티가 덜 나게
 *  - 아래쪽은 어둡게(땅 그늘) · 잎덩이 밑면은 어둡게 → 조명 없이도 입체감
 *  - 빛나는 부품(버섯 점 · 등불 · 용암 틈)은 따로 구워 빛을 받지 않는 재질로
 *  - 바람: 정해 둔 높이 위쪽만 셰이더에서 흔듦 (FX.time)
 */
import { THREE, FX } from "./kit.js";
import { noise2, rngOf, smooth } from "./noise.js";

const tm = new THREE.Matrix4();
const tq = new THREE.Quaternion();
const te = new THREE.Euler();
const tv = new THREE.Vector3();
const ts = new THREE.Vector3();
const tn = new THREE.Vector3();

const GEO = new Map();
let SEG = 1; // 먼 장식은 면 수를 줄여 굽는다 (0.5)
const cached = (key, make) => GEO.get(key) || (GEO.set(key, make()), GEO.get(key));
/** 잡음으로 울퉁불퉁한 공 (잎덩이 · 구름) */
export function blob(r, seg = 12, amp = 0.3, seed = 1) {
  seg = Math.max(6, Math.round(seg * SEG));
  return cached(`blob${r}|${seg}|${amp}|${seed}`, () => {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.75)));
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      tv.fromBufferAttribute(p, i);
      const k = 2.6 / r;
      const n = noise2(tv.x * k + tv.z * 1.3 * k, tv.y * k - tv.z * 0.7 * k, seed) * 0.65 + noise2(tv.x * k * 2.1, tv.y * k * 2.1 + tv.z * k, seed + 7) * 0.35;
      tv.multiplyScalar(1 + (n - 0.5) * amp);
      p.setXYZ(i, tv.x, tv.y, tv.z);
    }
    g.computeVertexNormals();
    return g;
  });
}
/** 각진 바위 */
export function rockGeo(r, seed = 1, detail = 1) {
  return cached(`rock${r}|${seed}|${detail}`, () => {
    const g = new THREE.IcosahedronGeometry(r, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      tv.fromBufferAttribute(p, i);
      const k = 2.2 / r;
      const n = noise2(tv.x * k + tv.z * 0.9 * k, tv.y * k + tv.z * 0.4 * k, seed);
      tv.multiplyScalar(0.82 + n * 0.36);
      p.setXYZ(i, tv.x, tv.y, tv.z);
    }
    g.computeVertexNormals();
    return g;
  });
}
const cyl = (a, b, h, s = 8) => ((s = Math.max(5, Math.round(s * SEG))), cached(`cyl${a}|${b}|${h}|${s}`, () => new THREE.CylinderGeometry(a, b, h, s)));
const cone = (r, h, s = 8) => cached(`cone${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const sph = (r, a = 10, b = 8) => cached(`sph${r}|${a}|${b}`, () => new THREE.SphereGeometry(r, a, b));
const ico = (r, d = 0) => cached(`ico${r}|${d}`, () => new THREE.IcosahedronGeometry(r, d));
const octa = (r) => cached(`oct${r}`, () => new THREE.OctahedronGeometry(r, 0));
const box = (x, y, z) => cached(`box${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));
const capHemi = (r, s = 14) => cached(`hemi${r}|${s}`, () => new THREE.SphereGeometry(r, s, 8, 0, Math.PI * 2, 0, Math.PI / 2));

/** 부품 모아 한 모양으로 굽기 */
class Baker {
  constructor(seed = 1) {
    this.body = [];
    this.glow = [];
    this.rnd = rngOf(seed);
  }
  /**
   * o: p 위치 · s 크기 · r 회전 · under(밑면 어둡기 0~1) · top(윗면 색 · 이끼 · 눈) · topK · flat(각진 면) · glow · jit(색 얼룩)
   */
  add(g0, color, o = {}) {
    let g = g0.index ? g0.toNonIndexed() : g0.clone();
    if (g.attributes.uv) g.deleteAttribute("uv");
    if (g.attributes.uv1) g.deleteAttribute("uv1");
    if (o.flat) g.computeVertexNormals();
    const n = g.attributes.position.count;
    g.computeBoundingBox();
    const y0 = g.boundingBox.min.y;
    const y1 = g.boundingBox.max.y;
    const ly = new Float32Array(n);
    for (let i = 0; i < n; i++) ly[i] = g.attributes.position.getY(i);
    te.set(...(o.r || [0, 0, 0]));
    tq.setFromEuler(te);
    const s = o.s == null ? [1, 1, 1] : typeof o.s === "number" ? [o.s, o.s, o.s] : o.s;
    tm.compose(tv.set(...(o.p || [0, 0, 0])), tq, ts.set(...s));
    g.applyMatrix4(tm);
    const base = new THREE.Color(color);
    const top = o.top != null ? new THREE.Color(o.top) : null;
    const col = new Float32Array(n * 3);
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.copy(base);
      if (top) {
        tn.fromBufferAttribute(N, i);
        c.lerp(top, smooth(o.topK ?? 0.45, (o.topK ?? 0.45) + 0.25, tn.y));
      }
      let k = 1;
      if (o.under) k *= 1 - o.under + o.under * smooth(y0, y1, ly[i]);
      if (o.jit) k *= 1 + (noise2(P.getX(i) * 3.1, P.getZ(i) * 3.1 + P.getY(i) * 2, 5) - 0.5) * o.jit;
      col[i * 3] = c.r * k;
      col[i * 3 + 1] = c.g * k;
      col[i * 3 + 2] = c.b * k;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    (o.glow ? this.glow : this.body).push(g);
    return this;
  }
  bake({ ao = 0.3 } = {}) {
    const merge = (list, aoK) => {
      if (!list.length) return null;
      let total = 0;
      for (const g of list) total += g.attributes.position.count;
      const pos = new Float32Array(total * 3);
      const nrm = new Float32Array(total * 3);
      const col = new Float32Array(total * 3);
      let o = 0;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const g of list) {
        pos.set(g.attributes.position.array, o * 3);
        nrm.set(g.attributes.normal.array, o * 3);
        col.set(g.attributes.color.array, o * 3);
        o += g.attributes.position.count;
        g.dispose();
      }
      for (let i = 0; i < total; i++) {
        minY = Math.min(minY, pos[i * 3 + 1]);
        maxY = Math.max(maxY, pos[i * 3 + 1]);
      }
      if (aoK > 0) {
        const span = Math.max(0.2, (maxY - minY) * 0.4);
        for (let i = 0; i < total; i++) {
          const k = 1 - aoK + aoK * smooth(minY, minY + span, pos[i * 3 + 1]);
          col[i * 3] *= k;
          col[i * 3 + 1] *= k;
          col[i * 3 + 2] *= k;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.computeBoundingSphere();
      g.userData.height = maxY;
      return g;
    };
    return { body: merge(this.body, ao), glow: merge(this.glow, 0) };
  }
}

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

/* ---------- 장식 만들기 (L: 월드 팔레트 · v: 변형 번호) ---------- */
const BUILD = {
  roundTree(L, v) {
    const b = new Baker(v);
    const F = L.foliage;
    b.add(cyl(0.085, 0.16, 1.05, 8), L.trunk, { p: [0, 0.52, 0], under: 0.35, jit: 0.2 });
    b.add(cyl(0.03, 0.055, 0.5, 6), L.trunk, { p: [0.16, 0.86, 0.02], r: [0, 0, -0.95] });
    b.add(cyl(0.025, 0.05, 0.42, 6), L.trunk, { p: [-0.13, 0.92, -0.04], r: [0.2, 0, 0.9] });
    b.add(blob(0.64, 16, 0.32, 3 + v), F[0], { p: [0, 1.5, 0], s: [1, 0.86, 1], under: 0.5, jit: 0.15 });
    b.add(blob(0.44, 14, 0.34, 4 + v), F[1], { p: [0.46, 1.3, 0.16], under: 0.5, jit: 0.15 });
    b.add(blob(0.42, 14, 0.34, 5 + v), F[2], { p: [-0.44, 1.26, -0.14], under: 0.5 });
    b.add(blob(0.38, 12, 0.34, 6 + v), F[0], { p: [0.06, 1.32, 0.48], under: 0.45 });
    b.add(blob(0.36, 12, 0.3, 7 + v), F[1], { p: [-0.12, 1.95, -0.05], under: 0.3 });
    return b.bake({ ao: 0.28 });
  },
  fruitTree(L, v) {
    const b = new Baker(v + 20);
    const F = L.foliage;
    b.add(cyl(0.09, 0.17, 0.95, 8), L.trunk, { p: [0, 0.47, 0], under: 0.35, jit: 0.2 });
    b.add(blob(0.7, 16, 0.28, 13 + v), F[1], { p: [0, 1.42, 0], s: [1.05, 0.82, 1.05], under: 0.5, jit: 0.15 });
    b.add(blob(0.4, 12, 0.3, 14 + v), F[0], { p: [0.5, 1.2, -0.2], under: 0.5 });
    b.add(blob(0.38, 12, 0.3, 15 + v), F[2], { p: [-0.45, 1.25, 0.25], under: 0.5 });
    const fruit = [0xff5a4a, 0xff8a3a, 0xffd04a];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39;
      const y = 1.15 + (i % 3) * 0.28;
      const r = 0.62 - (i % 3) * 0.12;
      b.add(sph(0.075, 8, 6), fruit[i % 3], { p: [Math.cos(a) * r, y, Math.sin(a) * r] });
    }
    return b.bake({ ao: 0.28 });
  },
  tallTree(L, v) {
    const b = new Baker(v + 40);
    const F = L.foliage;
    b.add(cyl(0.07, 0.13, 1.3, 7), L.trunk, { p: [0, 0.65, 0], under: 0.35, jit: 0.2 });
    b.add(blob(0.5, 14, 0.3, 23 + v), F[2], { p: [0, 1.25, 0], s: [1, 1.1, 1], under: 0.5 });
    b.add(blob(0.42, 14, 0.3, 24 + v), F[0], { p: [0, 1.85, 0], s: [1, 1.15, 1], under: 0.45 });
    b.add(blob(0.3, 12, 0.3, 25 + v), F[1], { p: [0, 2.38, 0], s: [1, 1.2, 1], under: 0.35 });
    return b.bake({ ao: 0.28 });
  },
  bush(L, v) {
    const b = new Baker(v + 60);
    const F = L.foliage;
    b.add(blob(0.36, 12, 0.32, 31 + v), F[0], { p: [0, 0.24, 0], s: [1.15, 0.85, 1], under: 0.5, jit: 0.15 });
    b.add(blob(0.26, 10, 0.32, 32 + v), F[1], { p: [0.3, 0.18, 0.12], under: 0.5 });
    b.add(blob(0.24, 10, 0.32, 33 + v), F[2], { p: [-0.28, 0.16, -0.08], under: 0.5 });
    return b.bake({ ao: 0.32 });
  },
  flowerBush(L, v) {
    const b = new Baker(v + 70);
    const F = L.foliage;
    b.add(blob(0.34, 12, 0.3, 41 + v), F[1], { p: [0, 0.22, 0], s: [1.2, 0.8, 1], under: 0.5 });
    b.add(blob(0.24, 10, 0.3, 42 + v), F[0], { p: [0.28, 0.16, 0.1], under: 0.5 });
    const fl = L.flowers;
    for (let i = 0; i < 10; i++) {
      const a = i * 2.39 + v;
      const r = 0.22 + (i % 3) * 0.08;
      b.add(ico(0.055, 0), fl[(i + v) % fl.length], { p: [Math.cos(a) * r, 0.36 + (i % 2) * 0.06 - r * 0.25, Math.sin(a) * r] });
    }
    return b.bake({ ao: 0.32 });
  },
  rock(L, v) {
    const b = new Baker(v + 80);
    b.add(rockGeo(0.42, 51 + v), L.rock[0], { p: [0, 0.2, 0], s: [1.15, 0.72, 1], flat: true, top: L.moss, topK: 0.62, jit: 0.25 });
    b.add(rockGeo(0.2, 52 + v), L.rock[1], { p: [0.4, 0.08, 0.16], s: [1, 0.8, 1], flat: true, top: L.moss, topK: 0.7, jit: 0.25 });
    if (v % 2) b.add(rockGeo(0.14, 53 + v), L.rock[1], { p: [-0.36, 0.05, 0.22], flat: true, jit: 0.25 });
    return b.bake({ ao: 0.3 });
  },
  flowerPatch(L, v) {
    const b = new Baker(v + 90);
    const fl = L.flowers;
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4 + v;
      const r = 0.12 + (i % 3) * 0.12;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = 0.2 + ((i * 7) % 5) * 0.04;
      b.add(cyl(0.012, 0.016, h, 4), 0x4f9a3a, { p: [x, h / 2, z] });
      b.add(ico(0.065, 0), fl[(i + v) % fl.length], { p: [x, h + 0.02, z], s: [1.2, 0.55, 1.2] });
      b.add(sph(0.026, 6, 4), 0xffd34d, { p: [x, h + 0.05, z] });
    }
    b.add(blob(0.12, 8, 0.3, 61 + v), L.foliage[0], { p: [0, 0.05, 0], s: [1.6, 0.6, 1.6], under: 0.4 });
    return b.bake({ ao: 0.2 });
  },
  shroomSmall(L, v) {
    const b = new Baker(v + 100);
    for (const [x, z, s, c] of [[0, 0, 1, 0xe5483a], [0.2, 0.12, 0.7, 0xff9a3a], [-0.16, 0.16, 0.6, 0xe5483a]]) {
      b.add(cyl(0.045 * s, 0.065 * s, 0.24 * s, 8), 0xfff1dc, { p: [x, 0.12 * s, z] });
      b.add(capHemi(0.15 * s), c, { p: [x, 0.22 * s, z], s: [1, 0.75, 1], under: 0.4 });
      for (let i = 0; i < 4; i++) b.add(sph(0.022 * s, 6, 4), 0xffffff, { p: [x + Math.cos(i * 1.7) * 0.08 * s, 0.31 * s, z + Math.sin(i * 1.7) * 0.08 * s] });
    }
    return b.bake({ ao: 0.2 });
  },
  /* --- 버섯 숲 --- */
  bigShroom(L, v) {
    const b = new Baker(v + 120);
    const capC = [0xa04ad8, 0x6a5ad8, 0xd85aa8][v % 3];
    b.add(cyl(0.16, 0.26, 1.3, 12), 0xf2e6d8, { p: [0, 0.65, 0], under: 0.3, jit: 0.1 });
    b.add(cyl(0.7, 0.42, 0.12, 18), shade(capC, 1.45), { p: [0, 1.32, 0] });
    b.add(capHemi(0.82, 18), capC, { p: [0, 1.32, 0], s: [1, 0.55, 1], under: 0.35, jit: 0.15 });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39;
      const r = 0.28 + (i % 3) * 0.17;
      b.add(sph(0.06, 8, 6), 0xe8ff9a, { p: [Math.cos(a) * r, 1.32 + Math.sqrt(Math.max(0, 0.68 - r * r)) * 0.5, Math.sin(a) * r], glow: true });
    }
    return b.bake({ ao: 0.3 });
  },
  shroomTree(L, v) {
    const b = new Baker(v + 130);
    b.add(cyl(0.08, 0.14, 1.6, 8), 0xe6d8c8, { p: [0, 0.8, 0], under: 0.3 });
    const cols = [0x4ab8a8, 0x5ad0b8, 0x3a98a0];
    for (let i = 0; i < 3; i++) b.add(capHemi(0.62 - i * 0.14, 16), cols[i], { p: [0, 0.9 + i * 0.42, 0], s: [1, 0.42, 1], under: 0.4 });
    b.add(sph(0.08, 8, 6), 0xb4ff6a, { p: [0, 1.95, 0], glow: true });
    return b.bake({ ao: 0.3 });
  },
  shroomCluster(L, v) {
    const b = new Baker(v + 140);
    const caps = [0xe0453a, 0xff9a3a, 0xd8a0ff, 0x7a6aff];
    for (const [x, z, s] of [[0, 0, 1], [0.24, 0.14, 0.72], [-0.2, 0.2, 0.62], [0.08, -0.24, 0.55]]) {
      b.add(cyl(0.05 * s, 0.075 * s, 0.32 * s, 8), 0xfff1dc, { p: [x, 0.16 * s, z] });
      b.add(capHemi(0.19 * s, 12), caps[(v + Math.round(s * 10)) % caps.length], { p: [x, 0.3 * s, z], s: [1, 0.7, 1], under: 0.4 });
    }
    return b.bake({ ao: 0.2 });
  },
  fern(L, v) {
    const b = new Baker(v + 150);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + v;
      b.add(sph(0.3, 8, 6), L.foliage[i % 3], { p: [Math.cos(a) * 0.28, 0.2, Math.sin(a) * 0.28], s: [0.16, 0.06, 0.62], r: [0, -a + Math.PI / 2, 0], under: 0.4 });
    }
    b.add(blob(0.14, 8, 0.3, 71 + v), L.foliage[2], { p: [0, 0.08, 0] });
    return b.bake({ ao: 0.35 });
  },
  stump(L, v) {
    const b = new Baker(v + 160);
    b.add(cyl(0.3, 0.38, 0.34, 12), L.trunk, { p: [0, 0.17, 0], under: 0.35, jit: 0.2 });
    b.add(cyl(0.28, 0.28, 0.02, 12), 0xd8b08a, { p: [0, 0.345, 0] });
    for (const [x, z] of [[0.3, 0.1], [0.24, -0.2]]) {
      b.add(cyl(0.025, 0.035, 0.12, 6), 0xfff1dc, { p: [x, 0.06, z] });
      b.add(capHemi(0.07, 8), 0xff9a3a, { p: [x, 0.12, z], s: [1, 0.7, 1] });
    }
    return b.bake({ ao: 0.3 });
  },
  /* --- 얼음 계곡 --- */
  pine(L, v, snow = false) {
    const b = new Baker(v + 170);
    b.add(cyl(0.07, 0.11, 0.55, 7), L.trunk, { p: [0, 0.27, 0], under: 0.35 });
    const F = L.foliage;
    for (let i = 0; i < 4; i++) {
      const r = 0.62 - i * 0.13;
      const y = 0.6 + i * 0.42;
      b.add(cone(r, 0.72, 9), F[i % 3], { p: [0, y, 0], under: 0.55, jit: 0.12, top: snow ? 0xffffff : null, topK: 0.55 });
    }
    return b.bake({ ao: 0.25 });
  },
  snowPine(L, v) {
    return BUILD.pine(L, v, true);
  },
  iceRock(L, v) {
    const b = new Baker(v + 180);
    b.add(rockGeo(0.44, 81 + v), L.rock[1], { p: [0, 0.22, 0], s: [1.1, 0.75, 1], flat: true, top: 0xffffff, topK: 0.5, jit: 0.2 });
    b.add(rockGeo(0.22, 82 + v), L.rock[0], { p: [0.38, 0.1, 0.1], flat: true, top: 0xffffff, topK: 0.5 });
    return b.bake({ ao: 0.25 });
  },
  snowBush(L, v) {
    const b = new Baker(v + 190);
    b.add(blob(0.34, 12, 0.3, 91 + v), 0xf4faff, { p: [0, 0.2, 0], s: [1.2, 0.8, 1], under: 0.35 });
    b.add(blob(0.24, 10, 0.3, 92 + v), 0xe2eefa, { p: [0.28, 0.14, 0.1], under: 0.35 });
    return b.bake({ ao: 0.3 });
  },
  crystal(L, v) {
    const b = new Baker(v + 200);
    for (const [x, z, h, r, tilt] of [[0, 0, 1.0, 0.2, 0.05], [0.22, 0.12, 0.66, 0.13, 0.3], [-0.2, 0.1, 0.55, 0.12, -0.35], [0.05, -0.2, 0.45, 0.1, -0.2]]) {
      b.add(octa(r), 0xaeeeff, { p: [x, h * 0.45, z], s: [0.85, h * 3.6, 0.85], r: [tilt * 0.5, 0, tilt], flat: true, top: 0xffffff, topK: 0.7 });
      b.add(octa(r * 0.45), 0x7fe8ff, { p: [x, h * 0.45, z], s: [0.85, h * 3.2, 0.85], r: [tilt * 0.5, 0, tilt], glow: true });
    }
    return b.bake({ ao: 0.15 });
  },
  /* --- 용암 협곡 --- */
  basalt(L, v) {
    const b = new Baker(v + 210);
    for (const [x, z, h] of [[0, 0, 1.1], [0.26, 0.12, 0.75], [-0.22, 0.18, 0.6], [0.06, -0.26, 0.85], [-0.26, -0.14, 0.45]]) b.add(cyl(0.15, 0.16, h, 6), L.rock[(Math.round(h * 10) % 2)], { p: [x, h / 2, z], flat: true, top: shade(L.rock[0], 1.5), topK: 0.8, jit: 0.2 });
    return b.bake({ ao: 0.3 });
  },
  volRock(L, v) {
    const b = new Baker(v + 220);
    b.add(rockGeo(0.46, 101 + v), L.rock[0], { p: [0, 0.22, 0], s: [1.1, 0.8, 1], flat: true, jit: 0.25 });
    b.add(rockGeo(0.2, 102 + v), L.rock[1], { p: [0.4, 0.08, 0.14], flat: true });
    for (let i = 0; i < 3; i++) b.add(box(0.05, 0.03, 0.34), 0xff7a2a, { p: [Math.cos(i * 2.1) * 0.25, 0.32 - i * 0.05, Math.sin(i * 2.1) * 0.25], r: [0.3, i * 2.1, 0.2], glow: true });
    return b.bake({ ao: 0.3 });
  },
  emberRock(L, v) {
    const b = new Baker(v + 230);
    b.add(rockGeo(0.36, 111 + v), L.rock[1], { p: [0, 0.18, 0], s: [1.1, 0.7, 1], flat: true });
    for (let i = 0; i < 4; i++) b.add(sph(0.07, 8, 6), [0xff6a1a, 0xffb03a][i % 2], { p: [Math.cos(i * 1.6) * 0.2, 0.34, Math.sin(i * 1.6) * 0.2], glow: true });
    return b.bake({ ao: 0.3 });
  },
  ashTree(L, v) {
    const b = new Baker(v + 240);
    b.add(cyl(0.06, 0.14, 1.3, 6), L.trunk, { p: [0, 0.65, 0], r: [0.05, 0, 0.08], jit: 0.2 });
    for (const [a, l, y] of [[0.7, 0.5, 0.95], [-0.8, 0.45, 1.05], [2.2, 0.38, 1.2], [3.6, 0.32, 0.8]]) {
      b.add(cyl(0.02, 0.045, l, 5), L.trunk, { p: [Math.sin(a) * 0.16, y, Math.cos(a) * 0.16], r: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9] });
      b.add(sph(0.05, 6, 4), 0xff8a3a, { p: [Math.sin(a) * (0.16 + l * 0.42), y + l * 0.32, Math.cos(a) * (0.16 + l * 0.42)], glow: true });
    }
    return b.bake({ ao: 0.2 });
  },
  /* --- 어둠의 성채 --- */
  spire(L, v) {
    const b = new Baker(v + 250);
    b.add(cyl(0.34, 0.42, 1.6, 8), 0x3a3456, { p: [0, 0.8, 0], flat: true, jit: 0.2 });
    b.add(cyl(0.44, 0.44, 0.14, 8), 0x2a2440, { p: [0, 1.62, 0], flat: true });
    b.add(cone(0.42, 0.9, 8), 0x5a3a7a, { p: [0, 2.14, 0], flat: true, under: 0.3 });
    b.add(box(0.14, 0.24, 0.05), 0xffd36a, { p: [0, 1.05, 0.38], glow: true });
    b.add(box(0.12, 0.2, 0.05), 0xffb03a, { p: [0.36, 0.6, 0.1], r: [0, Math.PI / 2.4, 0], glow: true });
    return b.bake({ ao: 0.3 });
  },
  grave(L, v) {
    const b = new Baker(v + 260);
    b.add(box(0.42, 0.42, 0.12), 0x7a7494, { p: [0, 0.21, 0], jit: 0.2 });
    b.add(cyl(0.21, 0.21, 0.12, 12, 1), 0x7a7494, { p: [0, 0.42, 0], r: [Math.PI / 2, 0, 0] });
    b.add(box(0.5, 0.06, 0.3), 0x5e587a, { p: [0, 0.03, 0.08] });
    b.add(box(0.24, 0.04, 0.02), 0x3a3650, { p: [0, 0.32, 0.07] });
    return b.bake({ ao: 0.3 });
  },
  lamp(L, v) {
    const b = new Baker(v + 270);
    b.add(cyl(0.04, 0.06, 1.1, 6), 0x2a2638, { p: [0, 0.55, 0] });
    b.add(cone(0.16, 0.14, 6), 0x2a2638, { p: [0, 1.28, 0] });
    b.add(sph(0.11, 10, 8), 0xc8a8ff, { p: [0, 1.12, 0], glow: true });
    return b.bake({ ao: 0.2 });
  },
  deadTree(L, v) {
    const b = new Baker(v + 280);
    b.add(cyl(0.05, 0.13, 1.4, 6), L.trunk, { p: [0, 0.7, 0], r: [0, 0, 0.1], jit: 0.2 });
    for (const [a, l, y] of [[0.6, 0.55, 1.0], [-0.9, 0.5, 1.15], [2.4, 0.42, 1.3], [3.8, 0.36, 0.8]]) b.add(cyl(0.015, 0.04, l, 5), L.trunk, { p: [Math.sin(a) * 0.18, y, Math.cos(a) * 0.18], r: [Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0] });
    return b.bake({ ao: 0.2 });
  },
  deadBush(L, v) {
    const b = new Baker(v + 290);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + v;
      b.add(cyl(0.012, 0.025, 0.42, 4), L.trunk, { p: [Math.cos(a) * 0.08, 0.18, Math.sin(a) * 0.08], r: [Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6] });
    }
    b.add(rockGeo(0.14, 121 + v), L.rock[1], { p: [0, 0.04, 0], flat: true });
    return b.bake({ ao: 0.3 });
  },
  /* --- 공통: 구름 · 먼 산 --- */
  cloud(L, v) {
    const b = new Baker(v + 300);
    for (const [x, y, z, r] of [[0, 0.2, 0, 1.2], [1.2, 0, 0.2, 0.9], [-1.2, 0.05, -0.1, 0.95], [0.5, 0.55, -0.2, 0.8], [-0.5, 0.45, 0.25, 0.75]]) b.add(blob(r, 12, 0.2, 131 + v), 0xffffff, { p: [x, y, z], s: [1, 0.72, 0.9], under: 0.22 });
    return b.bake({ ao: 0 });
  },
  mountain(L, v) {
    const b = new Baker(v + 310);
    b.add(blob(1, 16, 0.45, 141 + v), L.far, { s: [1, 0.85, 1], under: 0.35, top: L.key === "meadow" || L.key === "ice" ? 0xf4f8ff : null, topK: 0.82 });
    return b.bake({ ao: 0 });
  },
};

/** 흔들림(바람) 설정: 이 높이 위만 흔듦 */
export const SWAY = {
  roundTree: [0.95, 0.05],
  fruitTree: [0.9, 0.05],
  tallTree: [1.0, 0.045],
  bush: [0.1, 0.05],
  flowerBush: [0.1, 0.05],
  flowerPatch: [0.05, 0.12],
  fern: [0.05, 0.12],
  pine: [0.6, 0.03],
  snowPine: [0.6, 0.03],
  shroomTree: [0.9, 0.03],
  bigShroom: [1.0, 0.02],
  ashTree: [0.8, 0.02],
  deadTree: [0.8, 0.02],
  deadBush: [0.05, 0.08],
};

const BAKED = new Map();
/** 월드 팔레트 + 종류 + 변형 → 구운 모양 (한 번만) */
export function baked(L, key, kind, v = 0, lod = 0) {
  const k = `${key}|${kind}|${v}|${lod}`;
  if (!BAKED.has(k)) {
    const fn = BUILD[kind];
    SEG = lod ? 0.5 : 1;
    BAKED.set(k, fn ? fn({ ...L, key }, v) : null);
    SEG = 1;
  }
  return BAKED.get(k);
}

/* ---------- 재질 (바람에 흔들리는 셰이더 포함) ---------- */
const MATS = new Map();
export function propMat(kind) {
  const sw = SWAY[kind];
  const key = sw ? `sway${sw[0]}|${sw[1]}` : "still";
  if (MATS.has(key)) return MATS.get(key);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  m.envMapIntensity = 0.5;
  if (sw) {
    const uni = { uStart: { value: sw[0] }, uAmp: { value: sw[1] } };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = FX.time;
      sh.uniforms.uStart = uni.uStart;
      sh.uniforms.uAmp = uni.uAmp;
      sh.vertexShader = sh.vertexShader.replace("void main() {", "uniform float uTime;\nuniform float uStart;\nuniform float uAmp;\nvoid main() {").replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          float hgt = max(0.0, position.y - uStart);
          float ph = 0.0;
          #ifdef USE_INSTANCING
            ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
          #endif
          transformed.x += sin(uTime * 1.4 + ph) * hgt * uAmp;
          transformed.z += cos(uTime * 1.1 + ph * 1.3) * hgt * uAmp * 0.6;
        }`
      );
    };
    m.customProgramCacheKey = () => "cdn-sway";
  }
  MATS.set(key, m);
  return m;
}
let glowMat = null;
export function propGlowMat() {
  if (!glowMat) glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  return glowMat;
}
export { Baker, cyl, cone, sph, ico, octa, box, capHemi };
