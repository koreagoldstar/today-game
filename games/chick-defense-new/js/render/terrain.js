/*
 * 지형: 높낮이 있는 땅 한 장 + 물(용암) 면
 *  - 전장 안은 평평(높이 0) — 타워 · 적 위치 규칙과 그대로 맞음
 *  - 길: 경로 선까지의 거리로 살짝 파 내리고, 흙 · 길가 그늘은 픽셀마다 계산 → 가장자리가 또렷하고 꺾이는 곳은 둥글게
 *  - 물: 물 칸 모양(이웃 칸은 이어짐)으로 둑을 파 내리고, 그 위에 물결 · 물거품이 움직이는 물 면
 *  - 언덕(raised): 칸 안은 평평한 0.35 (타워 받침 높이), 둘레는 흙벽 띠 · 윗 가장자리 밝은 테
 *  - 바깥: 전장에서 멀어질수록 언덕이 솟고 색이 옅어짐 (멀리 있는 느낌) · 입구 길은 평평하게 이어짐
 *  격자는 가운데(전장 근처)만 촘촘하고 바깥은 듬성듬성 → 한 장으로 이음매 없이.
 *  '땅 정보 그림'(R 길 거리 · G 물 · B 언덕 경계)을 셰이더가 읽어 길 · 언덕 경계를 그린다.
 */
import { THREE, canvasTex } from "./kit.js";
import { CELL } from "../sim/map.js";
import { fbm, noise2, rngOf, smooth, clamp } from "./noise.js";

const C = (hex) => new THREE.Color(hex);
const mixC = (a, b, k) => a.clone().lerp(b, clamp(k, 0, 1));

/** 경로를 입구 쪽으로 길게 늘인 선 (먼 곳에서부터 길이 이어져 오게) */
function extendPath(pts, len = 14) {
  const a = pts[0];
  const b = pts[1];
  const L = Math.hypot(a.x - b.x, a.z - b.z) || 1;
  const dx = (a.x - b.x) / L;
  const dz = (a.z - b.z) / L;
  return [{ x: a.x + dx * len, z: a.z + dz * len }, ...pts];
}
function segDist(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const L2 = vx * vx + vz * vz || 1;
    const t = clamp(((x - a.x) * vx + (z - a.z) * vz) / L2, 0, 1);
    const d = Math.hypot(x - a.x - vx * t, z - a.z - vz * t);
    if (d < best) best = d;
  }
  return best;
}
const boxOut = (x, z, cx, cz) => Math.hypot(Math.max(Math.abs(x - cx) - 0.5, 0), Math.max(Math.abs(z - cz) - 0.5, 0));

/* ---------- 땅 무늬 (회색 0.5 기준 · 곱해서 씀) ---------- */
const DET = {};
function detailTex(kind) {
  if (DET[kind]) return DET[kind];
  const rnd = rngOf(kind === "grass" ? 911 : 577);
  const t = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = "rgb(128,128,128)";
    c.fillRect(0, 0, w, h);
    const wrap = (x, y, r, fn) => {
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) if (x + dx > -r && x + dx < w + r && y + dy > -r && y + dy < h + r) fn(x + dx, y + dy);
    };
    const blots = (n, lo, hi, a) => {
      for (let i = 0; i < n; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = lo + rnd() * hi;
        const v = rnd() < 0.5 ? 108 : 150;
        wrap(x, y, r, (X, Y) => {
          const g = c.createRadialGradient(X, Y, 0, X, Y, r);
          g.addColorStop(0, `rgba(${v},${v},${v},${a})`);
          g.addColorStop(1, `rgba(${v},${v},${v},0)`);
          c.fillStyle = g;
          c.fillRect(X - r, Y - r, r * 2, r * 2);
        });
      }
    };
    if (kind === "grass") {
      blots(40, 14, 30, 0.35);
      c.lineCap = "round";
      for (let i = 0; i < 1300; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const L = 3 + rnd() * 5;
        const a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
        const v = rnd() < 0.55 ? 160 + rnd() * 30 : 92 + rnd() * 20;
        c.strokeStyle = `rgba(${v},${v},${v},${0.35 + rnd() * 0.3})`;
        c.lineWidth = 1 + rnd() * 1.4;
        wrap(x, y, 10, (X, Y) => {
          c.beginPath();
          c.moveTo(X, Y);
          c.lineTo(X + Math.cos(a) * L, Y + Math.sin(a) * L);
          c.stroke();
        });
      }
    } else {
      blots(30, 10, 26, 0.4);
      for (let i = 0; i < 170; i++) {
        const x = rnd() * w;
        const y = rnd() * h;
        const r = 1.5 + rnd() * 3.8;
        const ang = rnd() * 3;
        const v = 170 + rnd() * 40;
        wrap(x, y, r + 2, (X, Y) => {
          c.fillStyle = "rgba(70,70,70,0.45)";
          c.beginPath();
          c.ellipse(X + 0.8, Y + 1.2, r, r * 0.72, ang, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = `rgba(${v},${v},${v},0.85)`;
          c.beginPath();
          c.ellipse(X, Y, r, r * 0.72, ang, 0, Math.PI * 2);
          c.fill();
        });
      }
      c.strokeStyle = "rgba(80,80,80,0.35)";
      c.lineWidth = 1.2;
      for (let i = 0; i < 26; i++) {
        let x = rnd() * w;
        let y = rnd() * h;
        c.beginPath();
        c.moveTo(x, y);
        for (let j = 0; j < 4; j++) c.lineTo((x += (rnd() - 0.5) * 22), (y += (rnd() - 0.5) * 22));
        c.stroke();
      }
    }
  });
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  DET[kind] = t;
  return t;
}

/** 땅 재질 (월드마다 색 · 땅 정보 그림이 달라 따로 만듦) */
function makeTerrainMaterial(T) {
  const L = T.L;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  m.envMapIntensity = 0.32;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uGrassTex: { value: detailTex("grass") },
      uDirtTex: { value: detailTex("dirt") },
      uNoiseT: { value: noiseTex() },
      uGround: { value: T.groundTex },
      uGMin: { value: new THREE.Vector2(T.gx0, T.gz0) },
      uGSize: { value: new THREE.Vector2(T.gw, T.gd) },
      uDirt: { value: C(L.dirt) },
      uDirtL: { value: C(L.dirtLight) },
      uDirtD: { value: C(L.dirtDark) },
      uCliff: { value: C(L.cliff) },
    });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aDirt;\nattribute float aAO;\nvarying float vDirt;\nvarying float vAO;\nvarying vec2 vWxz;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvDirt = aDirt;\nvAO = aAO;\nvWxz = (modelMatrix * vec4(position, 1.0)).xz;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uGrassTex; uniform sampler2D uDirtTex; uniform sampler2D uNoiseT; uniform sampler2D uGround;\nuniform vec2 uGMin; uniform vec2 uGSize; uniform vec3 uDirt; uniform vec3 uDirtL; uniform vec3 uDirtD; uniform vec3 uCliff;\nvarying float vDirt; varying float vAO; varying vec2 vWxz;"
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec4 gm = texture2D(uGround, (vWxz - uGMin) / uGSize);
          float pd = gm.r * 2.5;
          float wm = gm.g;
          float ps = gm.b * 2.0 - 1.0;
          float n1 = texture2D(uNoiseT, vWxz * 0.9).r;
          float n2 = texture2D(uNoiseT, vWxz * 0.21 + 0.37).r;
          float edge = pd + (n1 - 0.5) * 0.1;
          float pm = (1.0 - smoothstep(0.69, 0.725, edge)) * (1.0 - smoothstep(0.12, 0.3, wm));
          vec3 dirt = mix(uDirt, uDirtL, smoothstep(0.4, 0.72, n2) * 0.8);
          dirt = mix(dirt, uDirtD, smoothstep(0.36, 0.7, pd) * 0.6);
          dirt *= 0.94 + n1 * 0.12;
          float rim = smoothstep(0.7, 0.735, edge) * (1.0 - smoothstep(0.735, 1.05, edge));
          vec3 base = diffuseColor.rgb * (1.0 - rim * 0.3);
          float side = smoothstep(-0.02, 0.03, ps) * (1.0 - smoothstep(0.3, 0.4, ps));
          base = mix(base, uCliff * (0.82 + n1 * 0.3), side * 0.9);
          float lip = smoothstep(-0.13, -0.06, ps) * (1.0 - smoothstep(-0.06, -0.015, ps));
          base *= 1.0 + lip * 0.22;
          diffuseColor.rgb = mix(base, dirt, pm) * vAO;
          float dm = clamp(max(max(pm, vDirt), side), 0.0, 1.0);
          vec3 gD = (texture2D(uGrassTex, vWxz * 0.45).rgb + texture2D(uGrassTex, vWxz * 0.137 + 0.31).rgb) * 0.5;
          vec3 dD = texture2D(uDirtTex, vWxz * 0.6).rgb;
          diffuseColor.rgb *= mix(gD * 2.0, dD * 2.0, dm);
        }`
      );
  };
  m.customProgramCacheKey = () => "cdn-terrain3";
  return m;
}

export class Terrain {
  constructor(world, map, look, quality) {
    this.W = world;
    this.map = map;
    this.L = look;
    this.q = quality;
    this.seed = world.id * 101;
    this.paths = map.paths.map((p) => extendPath(p.pts));
    this.water = [];
    for (let z = 0; z < map.d; z++) for (let x = 0; x < map.w; x++) if (this.isWater(x, z)) this.water.push([x + 0.5, z + 0.5]);
    this.raised = world.raised || [];
    this.col = {};
    for (const k of ["grassEdge", "dirt", "dirtDark", "dirtLight", "bank", "bed", "cliff", "hill", "far"]) this.col[k] = C(look[k]);
    this.col.grass = look.grass.map(C);
  }
  isWater(cx, cz) {
    const c = this.map.cell(cx, cz);
    return c === CELL.WATER || c === CELL.BRIDGE;
  }
  pathDist(x, z) {
    let d = Infinity;
    for (const p of this.paths) d = Math.min(d, segDist(x, z, p));
    return d;
  }
  /** 물 모양까지 거리 (안쪽 음수) — 칸 격자로 계산해 이웃 물 칸은 끊기지 않음 */
  waterSdf(x, z) {
    if (!this.water.length) return 9;
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const inside = this.isWater(ix, iz);
    let best = 2.5;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const cx = ix + dx;
        const cz = iz + dz;
        if (this.isWater(cx, cz) === inside) continue;
        best = Math.min(best, boxOut(x, z, cx + 0.5, cz + 0.5));
      }
    return inside ? -best : best;
  }
  waterMask(x, z) {
    if (!this.water.length) return 0;
    return 1 - smooth(-0.3, 0.08, this.waterSdf(x, z) + 0.1 * (noise2(x * 2.1, z * 2.1, this.seed + 21) - 0.5));
  }
  /** 언덕 경계까지 거리 (안쪽 음수) */
  plateauSdf(x, z) {
    let best = 9;
    for (const [x0, z0, w, d] of this.raised) {
      const r = 0.2;
      const qx = Math.abs(x - (x0 + w / 2)) - (w / 2 - r);
      const qz = Math.abs(z - (z0 + d / 2)) - (d / 2 - r);
      best = Math.min(best, Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r);
    }
    return best;
  }
  plateau(x, z) {
    return this.raised.length ? 0.35 * (1 - smooth(-0.02, 0.34, this.plateauSdf(x, z))) : 0;
  }
  outside(x, z) {
    const W = this.map.w;
    const D = this.map.d;
    const ox = x < 0 ? -x : x > W ? x - W : 0;
    const oz = z < 0 ? -z : z > D ? z - D : 0;
    return Math.hypot(ox, oz);
  }
  /** 땅 높이 (장식 · 풀 놓을 때도 씀) */
  height(x, z, dp = this.pathDist(x, z), w = this.waterMask(x, z)) {
    const out = this.outside(x, z);
    let h = 0;
    if (out > 0.9) {
      const o = out - 0.9;
      const n = fbm(x * 0.07 + 3.1, z * 0.07 - 1.7, this.seed, 4);
      const rise = (1 - Math.exp(-o / 4.2)) * 2.4 + o * 0.07;
      h = rise * (0.4 + 1.2 * n);
      h *= smooth(1.5, 4, dp);
    }
    h = Math.max(h, this.plateau(x, z) * smooth(0.82, 1.04, dp));
    h = h * (1 - w) - 0.36 * w;
    h -= 0.06 * (1 - smooth(0.64, 0.8, dp)) * (1 - w);
    return h;
  }
  /** 풀 · 장식 색을 땅과 맞추려고 (기울기 무시한 땅 색) */
  grassColor(x, z) {
    const col = this.col;
    const n1 = fbm(x * 0.1, z * 0.1, this.seed + 5, 3);
    let c = mixC(col.grass[2], col.grass[0], smooth(0.28, 0.52, n1));
    c = mixC(c, col.grass[1], smooth(0.56, 0.78, n1));
    c.multiplyScalar(0.94 + noise2(x * 0.55, z * 0.55, this.seed + 9) * 0.12);
    const out = this.outside(x, z);
    if (out > 0) {
      c = mixC(c, col.hill, smooth(1.5, 9, out) * 0.45);
      c = mixC(c, col.far, smooth(8, 30, out) * 0.65);
    }
    return c;
  }

  /** 땅 정보 그림: R 길까지 거리(0~2.5) · G 물 · B 언덕 경계 거리(-1~1) */
  buildGroundTex() {
    const res = this.q === "low" ? 5 : 8;
    this.gx0 = -20;
    this.gz0 = -18;
    this.gw = this.map.w + 40;
    this.gd = this.map.d + 36;
    const tw = Math.round(this.gw * res);
    const th = Math.round(this.gd * res);
    const data = new Uint8Array(tw * th * 4);
    const hasR = this.raised.length > 0;
    for (let j = 0; j < th; j++)
      for (let i = 0; i < tw; i++) {
        const x = this.gx0 + (i + 0.5) / res;
        const z = this.gz0 + (j + 0.5) / res;
        const o = (j * tw + i) * 4;
        data[o] = Math.round(clamp(this.pathDist(x, z) / 2.5, 0, 1) * 255);
        data[o + 1] = Math.round(clamp(this.waterMask(x, z), 0, 1) * 255);
        data[o + 2] = hasR ? Math.round(clamp((this.plateauSdf(x, z) + 1) / 2, 0, 1) * 255) : 255;
        data[o + 3] = 255;
      }
    const t = new THREE.DataTexture(data, tw, th, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    this.groundTex = t;
  }

  /** 땅 그물 만들기 → Mesh */
  build() {
    this.buildGroundTex();
    const q = this.q;
    const fine = q === "low" ? 0.4 : q === "medium" ? 0.28 : 0.22;
    const xs = axis(-5, this.map.w + 5, fine, -46, this.map.w + 46, 1.3);
    const zs = axis(-5, this.map.d + 5, fine, -40, this.map.d + 42, 1.3);
    const nx = xs.length;
    const nz = zs.length;
    const N = nx * nz;
    const pos = new Float32Array(N * 3);
    const hs = new Float32Array(N);
    const ws = new Float32Array(N);
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = xs[i];
        const z = zs[j];
        const w = this.waterMask(x, z);
        const h = this.height(x, z, this.pathDist(x, z), w);
        hs[k] = h;
        ws[k] = w;
        pos[k * 3] = x;
        pos[k * 3 + 1] = h;
        pos[k * 3 + 2] = z;
      }
    const idx = new (N > 65535 ? Uint32Array : Uint16Array)((nx - 1) * (nz - 1) * 6);
    let p = 0;
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        idx[p++] = a;
        idx[p++] = c;
        idx[p++] = b;
        idx[p++] = b;
        idx[p++] = c;
        idx[p++] = d;
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const nrm = g.attributes.normal.array;
    const col = new Float32Array(N * 3);
    const dirt = new Float32Array(N);
    const aos = new Float32Array(N);
    const L = this.col;
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = xs[i];
        const z = zs[j];
        const w = ws[k];
        const slope = 1 - nrm[k * 3 + 1];
        let c = this.grassColor(x, z);
        // 비탈(바깥 언덕) → 흙벽
        const cl = smooth(0.14, 0.45, slope) * (this.outside(x, z) > 0.5 ? 1 : 0);
        c = mixC(c, L.cliff, cl * 0.8);
        // 물가 → 모래 · 물 바닥
        if (w > 0.001) c = mixC(c, mixC(L.bank, L.bed, smooth(0.4, 0.95, w)), smooth(0.0, 0.3, w));
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
        dirt[k] = Math.max(cl * 0.8, smooth(0.05, 0.35, w));
        aos[k] = this.cavity(hs, nx, nz, i, j);
      }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aDirt", new THREE.BufferAttribute(dirt, 1));
    g.setAttribute("aAO", new THREE.BufferAttribute(aos, 1));
    const mesh = new THREE.Mesh(g, makeTerrainMaterial(this));
    mesh.receiveShadow = q !== "low";
    mesh.userData.own = true;
    mesh.userData.ownMat = true;
    mesh.userData.tex = this.groundTex;
    this.mesh = mesh;
    return mesh;
  }
  /** 오목한 곳은 어둡게 (주변 평균보다 낮으면 — 길 가장자리 · 언덕 밑 · 둑) */
  cavity(hs, nx, nz, i, j) {
    const h = hs[j * nx + i];
    let s = 0;
    let n = 0;
    for (const [di, dj] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      s += hs[jj * nx + ii];
      n++;
    }
    const diff = n ? s / n - h : 0;
    return 1 - clamp(diff * 5, 0, 0.3);
  }

  /** 물(용암) 면: 물 모양 마스크 + 물결 · 물거품 셰이더 */
  buildWater(t0 = 0) {
    if (!this.water.length) return null;
    let x0 = 99;
    let z0 = 99;
    let x1 = -99;
    let z1 = -99;
    for (const [x, z] of this.water) {
      x0 = Math.min(x0, x - 1.2);
      z0 = Math.min(z0, z - 1.2);
      x1 = Math.max(x1, x + 1.2);
      z1 = Math.max(z1, z + 1.2);
    }
    const res = 14;
    const tw = Math.ceil((x1 - x0) * res);
    const th = Math.ceil((z1 - z0) * res);
    const data = new Uint8Array(tw * th * 4);
    for (let j = 0; j < th; j++)
      for (let i = 0; i < tw; i++) {
        const x = x0 + (i + 0.5) / res;
        const z = z0 + (j + 0.5) / res;
        const v = Math.round(clamp(this.waterMask(x, z), 0, 1) * 255);
        const o = (j * tw + i) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    const mask = new THREE.DataTexture(data, tw, th, THREE.RGBAFormat);
    mask.magFilter = THREE.LinearFilter;
    mask.minFilter = THREE.LinearFilter;
    mask.needsUpdate = true;
    const W = this.L.water;
    const lava = !!W.lava;
    const mat = new THREE.ShaderMaterial({
      transparent: !lava,
      depthWrite: lava,
      uniforms: {
        uMask: { value: mask },
        uNoise: { value: noiseTex() },
        uTime: { value: t0 },
        uShallow: { value: C(W.shallow) },
        uDeep: { value: C(W.deep) },
        uFoam: { value: C(W.foam) },
        uAlpha: { value: W.alpha },
        uLava: { value: lava ? 1 : 0 },
      },
      vertexShader: `varying vec2 vUv; varying vec2 vW;
        void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform sampler2D uMask; uniform sampler2D uNoise; uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam; uniform float uAlpha; uniform float uLava;
        varying vec2 vUv; varying vec2 vW;
        void main(){
          float m = texture2D(uMask, vUv).r;
          if (m < 0.24) discard;
          float n1 = texture2D(uNoise, vW * 0.22 + vec2(uTime * 0.035, uTime * 0.02)).r;
          float n2 = texture2D(uNoise, vW * 0.37 - vec2(uTime * 0.025, -uTime * 0.04)).r;
          float n = (n1 + n2) * 0.5;
          float depth = smoothstep(0.5, 1.0, m);
          vec3 col = mix(uShallow, uDeep, depth * (0.75 + n * 0.5));
          float rip = smoothstep(0.58, 0.66, n) - smoothstep(0.66, 0.74, n);
          col = mix(col, vec3(1.0), rip * (0.45 - uLava * 0.3));
          float shore = 1.0 - smoothstep(0.24, 0.36, m);
          float wave = 0.5 + 0.5 * sin(uTime * 2.2 - m * 26.0 + n * 6.0);
          float foam = clamp(shore * 1.4 * (0.55 + 0.45 * wave) + smoothstep(0.7, 0.8, n1) * 0.25 * (1.0 - depth), 0.0, 1.0);
          col = mix(col, uFoam, foam * 0.7);
          col *= 0.9 + 0.1 * smoothstep(0.3, 0.6, m);
          if (uLava > 0.5) col *= 1.0 + smoothstep(0.55, 0.75, n) * 1.2;
          float a = mix(0.62, uAlpha, depth) + foam * 0.3;
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2);
    // 평면을 돌리면 uv 의 v 가 z 와 반대 → 마스크 줄 순서와 맞춤
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const m = new THREE.Mesh(geo, mat);
    m.position.set((x0 + x1) / 2, lava ? -0.06 : -0.1, (z0 + z1) / 2);
    m.renderOrder = 2;
    m.userData.own = true;
    m.userData.ownMat = true;
    this.waterMat = mat;
    return m;
  }
}

/** 가운데는 촘촘하고 바깥은 듬성듬성한 눈금 */
function axis(a, b, fine, A, B, coarse) {
  const out = [];
  for (let v = A; v < a; v += coarse) out.push(v);
  for (let v = a; v <= b + 1e-6; v += fine) out.push(+v.toFixed(4));
  for (let v = b + coarse; v <= B; v += coarse) out.push(v);
  return out;
}

let nTex = null;
export function noiseTex() {
  if (nTex) return nTex;
  const n = 128;
  const data = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const v = periodic(i / n, j / n);
      const o = (j * n + i) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(v * 255);
      data[o + 3] = 255;
    }
  nTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  nTex.wrapS = nTex.wrapT = THREE.RepeatWrapping;
  nTex.magFilter = THREE.LinearFilter;
  nTex.minFilter = THREE.LinearMipmapLinearFilter;
  nTex.generateMipmaps = true;
  nTex.needsUpdate = true;
  return nTex;
}
/** 끝과 끝이 이어지는 잡음 */
function periodic(u, v) {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    const P = 4 << o;
    const x = u * P;
    const z = v * P;
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const hh = (a, b) => noise2((a % P) + 0.5, (b % P) + 0.5, 700 + o);
    const a = hh(ix, iz);
    const b = hh(ix + 1, iz);
    const c = hh(ix, iz + 1);
    const d = hh(ix + 1, iz + 1);
    s += (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return s / norm;
}
