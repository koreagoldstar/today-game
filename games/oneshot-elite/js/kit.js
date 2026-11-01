/*
 * ONE SHOT ELITE · 3D 도구
 *  - 메쉬 합치기(같은 재질끼리 하나로 → 그리기 횟수 줄임)
 *  - 사각면 묶음(건물 벽 · 창문 구멍) · 세계 좌표 기준 UV (텍스처가 건물 크기와 상관없이 같은 크기로 반복)
 *  - 캔버스로 그린 텍스처 (건물 외벽 · 가게 · 지붕 · 도로 · 컨테이너 · 모래 …) — 외부 그림 파일 없음
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

export { THREE };

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

/** 같은 씨앗이면 같은 수열 */
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
export const range = (r, a, b) => a + r() * (b - a);

/* ---------- 텍스처 ---------- */
let ANISO = 4;
export function setAniso(n) {
  ANISO = n;
}
export function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
export function tex(c, { repeat = true, srgb = true, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  if (!mip) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  return t;
}
/** 잔잔한 얼룩 (때 · 바랜 자국) */
export function grime(g, w, h, r, n = 60, a = 0.06, col = "0,0,0") {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 10 + r() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col},${a * (0.4 + r())})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}
export function speckle(g, w, h, r, n, a, light = false) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = light ? `rgba(255,255,255,${a * r()})` : `rgba(0,0,0,${a * r()})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

/** 높이 그림 → 노멀맵 */
export function normalFrom(hc, strength = 2) {
  const w = hc.width;
  const h = hc.height;
  const src = hc.getContext("2d").getImageData(0, 0, w, h).data;
  const c = canvas(w, h);
  const g = c.getContext("2d");
  const out = g.createImageData(w, h);
  const d = out.data;
  for (let y = 0; y < h; y++) {
    const ya = ((y + h - 1) % h) * w;
    const yb = ((y + 1) % h) * w;
    const y0 = y * w;
    for (let x = 0; x < w; x++) {
      const xa = (x + w - 1) % w;
      const xb = (x + 1) % w;
      const dx = ((src[(y0 + xb) * 4] - src[(y0 + xa) * 4]) / 255) * strength;
      const dy = ((src[(yb + x) * 4] - src[(ya + x) * 4]) / 255) * strength;
      const il = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y0 + x) * 4;
      d[i] = (-dx * il * 0.5 + 0.5) * 255;
      d[i + 1] = (dy * il * 0.5 + 0.5) * 255;
      d[i + 2] = (il * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return tex(c, { srgb: false });
}

/* ---------- 사각면 묶음 (세계 UV) ---------- */
export class Quads {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = null;
  }
  /** o: 왼쪽 아래 모서리 · u: 가로 벡터 · v: 세로 벡터 · uv: [u0, v0, u1, v1] */
  quad(o, u, v, uv, col, colLow) {
    const nx = u[1] * v[2] - u[2] * v[1];
    const ny = u[2] * v[0] - u[0] * v[2];
    const nz = u[0] * v[1] - u[1] * v[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    const p0 = o;
    const p1 = [o[0] + u[0], o[1] + u[1], o[2] + u[2]];
    const p2 = [o[0] + u[0] + v[0], o[1] + u[1] + v[1], o[2] + u[2] + v[2]];
    const p3 = [o[0] + v[0], o[1] + v[1], o[2] + v[2]];
    const [u0, v0, u1, v1] = uv;
    const P = [p0, p1, p2, p0, p2, p3];
    const UV = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v0],
      [u1, v1],
      [u0, v1],
    ];
    for (let i = 0; i < 6; i++) {
      this.p.push(P[i][0], P[i][1], P[i][2]);
      this.n.push(nx / l, ny / l, nz / l);
      this.uv.push(UV[i][0], UV[i][1]);
    }
    if (col) {
      if (!this.c) this.c = new Array((this.p.length / 3 - 6) * 3).fill(1);
      const L = colLow || col;
      // p0 · p1 은 아래, p2 · p3 은 위
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const q = k < 2 ? L : col;
        this.c.push(q[0], q[1], q[2]);
      }
    } else if (this.c) for (let i = 0; i < 6; i++) this.c.push(1, 1, 1);
  }
  /**
   * 세계 UV 로 면 하나: 시작점 o, 가로 방향 단위벡터 dir(수평), 너비 w, 높이 h
   * UV 는 (가로 거리 / tw, 높이 / th) — uOff/vOff 로 시작 위치 맞춤
   */
  wall(o, dir, w, h, tw, th, uOff = 0, vOff = 0, col, colLow) {
    this.quad(o, [dir[0] * w, dir[1] * w, dir[2] * w], [0, h, 0], [uOff / tw, vOff / th, (uOff + w) / tw, (vOff + h) / th], col, colLow);
  }
  get empty() {
    return this.p.length === 0;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/* ---------- 메쉬 합치기 ---------- */
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
export function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  tmpE.set(rx, ry, rz);
  tmpQ.setFromEuler(tmpE);
  tmpP.set(x, y, z);
  tmpS.set(sx, sy, sz);
  return new THREE.Matrix4().compose(tmpP, tmpQ, tmpS);
}

/** 재질별로 도형을 모아 마지막에 한 메쉬로 */
export class Batch {
  constructor() {
    this.map = new Map();
  }
  add(material, geo, matrix, color) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    const c = new Float32Array(n * 3);
    const col = color instanceof THREE.Color ? color : new THREE.Color(color == null ? 0xffffff : color);
    for (let i = 0; i < n; i++) {
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    if (!this.map.has(material)) this.map.set(material, []);
    this.map.get(material).push(g);
    return this;
  }
  box(material, w, h, d, x, y, z, ry = 0, color, rx = 0, rz = 0) {
    return this.add(material, BOX, mat4(x, y + h / 2, z, rx, ry, rz, w, h, d), color);
  }
  cyl(material, rTop, rBot, h, x, y, z, color, seg = 12, rx = 0, rz = 0) {
    const key = `${seg}`;
    if (!CYL[key]) CYL[key] = new THREE.CylinderGeometry(1, 1, 1, seg);
    // 위아래 반지름이 다르면 따로 만든 도형
    const geo = rTop === rBot ? CYL[key] : new THREE.CylinderGeometry(rTop, rBot, 1, seg);
    const s = rTop === rBot ? rTop : 1;
    return this.add(material, geo, mat4(x, y + h / 2, z, rx, 0, rz, s, h, s), color);
  }
  quads(material, q) {
    if (q.empty) return this;
    const g = q.geometry();
    if (!this.map.has(material)) this.map.set(material, []);
    if (!g.attributes.color) {
      const c = new Float32Array(g.attributes.position.count * 3).fill(1);
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    }
    this.map.get(material).push(g);
    return this;
  }
  build(parent, { cast = true, receive = true, block = true, name = "" } = {}) {
    const out = [];
    for (const [material, list] of this.map) {
      const g = merge(list);
      if (!g) continue;
      if (!material.vertexColors) material.vertexColors = true;
      const m = new THREE.Mesh(g, material);
      m.castShadow = cast;
      m.receiveShadow = receive;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.userData.block = block;
      m.name = name;
      parent.add(m);
      out.push(m);
    }
    this.map.clear();
    return out;
  }
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = {};

/** 무늬가 늘어나지 않는 상자 (tile m 마다 텍스처 한 장) */
export function worldBox(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const size = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * size[f][0]) / tile, (uv.getY(k) * size[f][1]) / tile);
    }
  return g;
}

export function merge(list) {
  if (!list.length) return null;
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    else col.fill(1, o * 3, (o + c) * 3);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export function std(opts) {
  return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...opts });
}

/* ---------- 값 잡음 (지형 · 구름) ---------- */
export function noise2(seed) {
  const r = rng(seed);
  const P = new Uint8Array(512);
  for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [P[i], P[j]] = [P[j], P[i]];
  }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const V = new Float32Array(256).map(() => r());
  const f = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const a = V[P[(P[xi & 255] + yi) & 255]];
    const b = V[P[(P[(xi + 1) & 255] + yi) & 255]];
    const c = V[P[(P[xi & 255] + yi + 1) & 255]];
    const d = V[P[(P[(xi + 1) & 255] + yi + 1) & 255]];
    const u = f(xf);
    const v = f(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
}
export function fbm(n, x, y, oct = 4) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * n(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  return s;
}

/* ---------- 빛나는 점 (가로등 · 네온 · 섬광) ---------- */
let GLOW = null;
export function glowTex() {
  if (GLOW) return GLOW;
  const c = canvas(128, 128);
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.18, "rgba(255,255,255,0.65)");
  gr.addColorStop(0.45, "rgba(255,255,255,0.16)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  GLOW = tex(c, { repeat: false });
  return GLOW;
}
export function glow(color, size, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  s.userData.block = false;
  return s;
}
