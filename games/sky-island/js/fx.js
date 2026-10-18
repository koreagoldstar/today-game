/*
 * 하늘섬 대탈출 · 효과 (알갱이)
 *  - 점 알갱이 시스템 2개: 먼지/구름(보통 섞기) · 반짝이/빛(더하기 섞기). 각각 그리기 1번.
 *  - 돌 조각: 인스턴스 메시 1개 (무너지는 섬 · 돌다리 파편)
 *  한꺼번에 너무 많지 않게 수를 정해 둔 풀(pool)에서 꺼내 쓴다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { dotTex, puffTex, starTex } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

class PointSystem {
  constructor(scene, n, tex, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.p = [];
    for (let i = 0; i < n; i++) this.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, a0: 1, g: 0, drag: 0, r: 1, gg: 1, b: 1, spin: 0 });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 600 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; varying float vD; uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; varying float vD; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); float f = smoothstep(fogNear, fogFar, vD); vec3 c = mix(vC, fogColor, f * ${additive ? "0.0" : "1.0"}); gl_FragColor = vec4(c, t.a * vA * (1.0 - f * ${additive ? "1.0" : "0.3"})); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat = mat;
    this.pts = new THREE.Points(g, mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = additive ? 6 : 5;
    scene.add(this.pts);
    this.geo = g;
    this.next = 0;
  }
  spawn(o) {
    const p = this.p[this.next];
    this.next = (this.next + 1) % this.n;
    Object.assign(p, { life: o.life || 1, max: o.life || 1, x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, s0: o.s0 ?? 0.5, s1: o.s1 ?? 0.5, a0: o.a ?? 1, g: o.g || 0, drag: o.drag || 0 });
    const c = o.color || [1, 1, 1];
    p.r = c[0];
    p.gg = c[1];
    p.b = c[2];
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const p = this.p[i];
      if (p.life <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      p.life -= dt;
      const k = 1 - Math.max(0, p.life) / p.max;
      p.vy -= p.g * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vz *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = p.r;
      this.col[i * 3 + 1] = p.gg;
      this.col[i * 3 + 2] = p.b;
      this.size[i] = p.s0 + (p.s1 - p.s0) * k;
      this.alpha[i] = p.a0 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
    }
    this.geo.getAttribute("position").needsUpdate = true;
    this.geo.getAttribute("color").needsUpdate = true;
    this.geo.getAttribute("size").needsUpdate = true;
    this.geo.getAttribute("alpha").needsUpdate = true;
  }
  clear() {
    for (const p of this.p) p.life = 0;
  }
}

const hex = (h) => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
};

export class FX {
  constructor(scene, { quality = 1 } = {}) {
    this.scene = scene;
    this.q = quality;
    this.dust = new PointSystem(scene, quality >= 1 ? 260 : 140, puffTex(), false);
    this.glow = new PointSystem(scene, quality >= 1 ? 420 : 220, dotTex(), true);
    this.stars = new PointSystem(scene, 120, starTex(), true);
    // 돌 조각
    const n = 70;
    this.chunkGeo = new THREE.IcosahedronGeometry(0.22, 0);
    this.chunkMat = new THREE.MeshStandardMaterial({ color: "#9a7a72", roughness: 0.95, flatShading: true });
    this.chunks = new THREE.InstancedMesh(this.chunkGeo, this.chunkMat, n);
    this.chunks.castShadow = true;
    this.chunks.frustumCulled = false;
    this.chunkData = [];
    const o = new THREE.Object3D();
    o.scale.setScalar(0);
    o.updateMatrix();
    for (let i = 0; i < n; i++) {
      this.chunkData.push({ life: 0 });
      this.chunks.setMatrixAt(i, o.matrix);
    }
    scene.add(this.chunks);
    this.nextChunk = 0;
    this.o = o;
    this.reduced = false;
  }
  setFog(fog) {
    for (const s of [this.dust, this.glow, this.stars]) {
      s.mat.uniforms.fogColor.value.copy(fog.color);
      s.mat.uniforms.fogNear.value = fog.near;
      s.mat.uniforms.fogFar.value = fog.far;
    }
  }
  setScale(h) {
    for (const s of [this.dust, this.glow, this.stars]) s.mat.uniforms.scale.value = h * 0.9;
  }

  /* ---------------- 효과 모음 ---------------- */
  /** 착지 · 발소리 먼지 */
  landDust(x, y, z, k = 1) {
    const n = Math.round(6 + k * 8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const s = 1.2 + Math.random() * 1.6 * k;
      this.dust.spawn({ x: x + Math.cos(a) * 0.2, y: y + 0.08, z: z + Math.sin(a) * 0.2, vx: Math.cos(a) * s, vy: 0.4 + Math.random() * 0.6, vz: Math.sin(a) * s, life: 0.45 + Math.random() * 0.3, s0: 0.25, s1: 0.75 * (0.6 + k * 0.4), a: 0.7, drag: 4, color: hex("#f6e6d8") });
    }
  }
  step(x, y, z) {
    this.dust.spawn({ x, y: y + 0.05, z, vx: (Math.random() - 0.5) * 0.6, vy: 0.4, vz: (Math.random() - 0.5) * 0.6, life: 0.35, s0: 0.15, s1: 0.4, a: 0.45, drag: 3, color: hex("#f2e2d2") });
  }
  /** 큰 먼지 구름 (무너짐) */
  puff(x, y, z, size = 1, n = 6, color = "#e8d6cc") {
    for (let i = 0; i < n; i++) {
      this.dust.spawn({ x: x + (Math.random() - 0.5) * size, y: y + Math.random() * size * 0.4, z: z + (Math.random() - 0.5) * size, vx: (Math.random() - 0.5) * 1.6 * size, vy: 0.5 + Math.random() * 1.2, vz: (Math.random() - 0.5) * 1.6 * size, life: 0.9 + Math.random() * 0.7, s0: 0.6 * size, s1: 2.0 * size, a: 0.75, drag: 1.5, color: hex(color) });
    }
  }
  /** 반짝이 (구슬 · 체크포인트) */
  sparkle(p, n = 14, colors = ["#9ff4ff", "#ffffff", "#ffe27a"], speed = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      const sys = i % 3 === 0 ? this.stars : this.glow;
      sys.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * Math.cos(b) * s, vy: Math.sin(b) * s + 1, vz: Math.sin(a) * Math.cos(b) * s, life: 0.5 + Math.random() * 0.4, s0: i % 3 === 0 ? 0.5 : 0.35, s1: 0.05, a: 1, g: 2, drag: 2.5, color: hex(colors[i % colors.length]) });
    }
  }
  /** 구슬 먹으면: 빛 고리처럼 퍼지는 알갱이 */
  orbBurst(p, color = "#7ff0ff") {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      this.glow.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * 3.2, vy: (Math.random() - 0.3) * 1.5, vz: Math.sin(a) * 3.2, life: 0.4, s0: 0.45, s1: 0.05, a: 1, drag: 4, color: hex(i % 2 ? color : "#ffffff") });
    }
    this.stars.spawn({ x: p.x, y: p.y, z: p.z, life: 0.35, s0: 1.4, s1: 0.2, a: 1, color: hex("#ffffff") });
  }
  /** 대시 꼬리 */
  dashTrail(x, y, z) {
    for (let i = 0; i < 2; i++) this.glow.spawn({ x: x + (Math.random() - 0.5) * 0.3, y: y + 0.3 + Math.random() * 0.6, z: z + (Math.random() - 0.5) * 0.3, life: 0.3, s0: 0.5, s1: 0.1, a: 0.6, color: hex("#bfe8ff") });
  }
  /** 바람: 흘러가는 줄 알갱이 */
  windMote(x, y, z, vx, vy, vz) {
    this.glow.spawn({ x, y, z, vx, vy, vz, life: 0.8, s0: 0.18, s1: 0.18, a: 0.6, color: hex("#ffffff") });
  }
  leaf(x, y, z, vx, vy, vz) {
    this.dust.spawn({ x, y, z, vx, vy, vz, life: 1.2, s0: 0.22, s1: 0.18, a: 0.9, color: hex(Math.random() < 0.5 ? "#8fd86a" : "#d8f08a") });
  }
  /** 축하 꽃가루 */
  confetti(p, n = 70) {
    const cols = ["#ff7a8a", "#ffd23f", "#7ae0ff", "#9ff08a", "#c8a8ff", "#ffffff"];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = 2 + Math.random() * 5;
      this.glow.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: 4 + Math.random() * 6, vz: Math.sin(a) * s, life: 1.6 + Math.random() * 1.2, s0: 0.35, s1: 0.25, a: 1, g: 6, drag: 1.2, color: hex(cols[i % cols.length]) });
    }
  }
  /** 돌 조각 날리기 */
  debris(p, n = 6, { color = "#9a7a72", up = 2, spread = 1.5, size = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const k = this.nextChunk;
      this.nextChunk = (this.nextChunk + 1) % this.chunkData.length;
      this.chunkData[k] = {
        life: 1.6 + Math.random(),
        x: p.x + (Math.random() - 0.5) * spread,
        y: p.y + Math.random() * 0.3,
        z: p.z + (Math.random() - 0.5) * spread,
        vx: (Math.random() - 0.5) * 2.5,
        vy: up * (0.3 + Math.random()),
        vz: (Math.random() - 0.5) * 2.5,
        rx: Math.random() * TAU,
        ry: Math.random() * TAU,
        sx: (Math.random() - 0.5) * 8,
        s: size * (0.5 + Math.random() * 0.9),
      };
    }
    if (color) this.chunkMat.color.set(color);
  }
  update(dt) {
    this.dust.update(dt);
    this.glow.update(dt);
    this.stars.update(dt);
    const o = this.o;
    let any = false;
    for (let i = 0; i < this.chunkData.length; i++) {
      const c = this.chunkData[i];
      if (c.life <= 0) continue;
      any = true;
      c.life -= dt;
      c.vy -= 22 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.rx += c.sx * dt;
      c.ry += c.sx * 0.7 * dt;
      o.position.set(c.x, c.y, c.z);
      o.rotation.set(c.rx, c.ry, 0);
      o.scale.setScalar(c.life > 0 ? c.s * Math.min(1, c.life * 2) : 0);
      o.updateMatrix();
      this.chunks.setMatrixAt(i, o.matrix);
    }
    if (any || this.chunkDirty) {
      this.chunks.instanceMatrix.needsUpdate = true;
      this.chunkDirty = any;
    }
  }
  reset() {
    this.dust.clear();
    this.glow.clear();
    this.stars.clear();
    const o = this.o;
    o.scale.setScalar(0);
    o.updateMatrix();
    for (let i = 0; i < this.chunkData.length; i++) {
      this.chunkData[i].life = 0;
      this.chunks.setMatrixAt(i, o.matrix);
    }
    this.chunks.instanceMatrix.needsUpdate = true;
  }
}
