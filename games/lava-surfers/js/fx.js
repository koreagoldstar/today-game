/*
 * 용암 서핑 · 효과 (알갱이)
 *  - 점 알갱이 2종: 연기 · 먼지(보통 섞기) / 불티 · 빛(더하기 섞기) — 각각 그리기 1번
 *  - 바위 조각: 인스턴스 메시 1개
 *  정해 둔 수(풀)에서 꺼내 쓴다 → 아무리 많이 터져도 성능이 일정
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { dotTex, puffTex } from "./tex.js?v=1";

class PointSystem {
  constructor(scene, n, tex, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.p = [];
    for (let i = 0; i < n; i++) this.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, a0: 1, g: 0, drag: 0, r: 1, gg: 1, b: 1 });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 600 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; varying float vD; uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; varying float vD; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); float f = smoothstep(fogNear, fogFar, vD); vec3 c = mix(vC, fogColor, f * ${additive ? "0.0" : "1.0"}); gl_FragColor = vec4(c, t.a * vA * (1.0 - f * ${additive ? "1.0" : "0.3"})); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat);
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
    for (const a of ["position", "color", "size", "alpha"]) this.geo.getAttribute(a).needsUpdate = true;
  }
  clear() {
    for (const p of this.p) p.life = 0;
  }
}
const hex = (h) => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
};
const R = () => Math.random() - 0.5;

export class FX {
  constructor(scene, { quality = 1 } = {}) {
    this.scene = scene;
    this.q = quality;
    this.smoke = new PointSystem(scene, quality >= 0.9 ? 260 : 140, puffTex(), false);
    this.glow = new PointSystem(scene, quality >= 0.9 ? 480 : 240, dotTex(), true);
    const n = 60;
    this.chunks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: "#4a3a3e", roughness: 0.9, flatShading: true, emissive: "#ff4a1a", emissiveIntensity: 0.3 }), n);
    this.chunks.castShadow = true;
    this.chunks.frustumCulled = false;
    this.cd = [];
    this.o = new THREE.Object3D();
    this.o.scale.setScalar(0);
    this.o.updateMatrix();
    for (let i = 0; i < n; i++) {
      this.cd.push({ life: 0 });
      this.chunks.setMatrixAt(i, this.o.matrix);
    }
    scene.add(this.chunks);
    this.nc = 0;
  }
  setFog(fog) {
    for (const s of [this.smoke, this.glow]) {
      s.mat.uniforms.fogColor.value.copy(fog.color);
      s.mat.uniforms.fogNear.value = fog.near;
      s.mat.uniforms.fogFar.value = fog.far;
    }
  }
  setScale(h) {
    for (const s of [this.smoke, this.glow]) s.mat.uniforms.scale.value = h * 0.9;
  }
  /** 보드 뒤 불꽃 가루 (달릴 때) */
  trail(x, y, z, vx, vz, k = 1) {
    this.glow.spawn({ x: x + R() * 0.3, y: y + 0.1, z: z + R() * 0.3, vx: -vx * 0.15 + R(), vy: 1 + Math.random() * 1.5, vz: -vz * 0.15 + R(), life: 0.35 + Math.random() * 0.3, s0: 0.22 * k, s1: 0.02, color: hex(Math.random() < 0.5 ? "#ffb04a" : "#ff6a2a"), g: 4 });
  }
  /** 부스터 불꽃 */
  boostFire(x, y, z, vx, vz) {
    for (let i = 0; i < 2; i++) this.glow.spawn({ x, y: y + 0.12, z, vx: -vx * 0.4 + R() * 2, vy: R() * 1.2, vz: -vz * 0.4 + R() * 2, life: 0.25 + Math.random() * 0.2, s0: 0.5, s1: 0.05, color: hex(i ? "#fff0a0" : "#ff8a2a") });
  }
  dust(x, y, z, k = 1) {
    this.smoke.spawn({ x: x + R() * k, y: y + 0.2, z: z + R() * k, vx: R() * 2, vy: 1 + Math.random(), vz: R() * 2, life: 0.8 + Math.random() * 0.5, s0: 0.8 * k, s1: 2.4 * k, a: 0.5, color: hex("#6a5a5e"), drag: 1.5 });
  }
  land(x, y, z, k = 1) {
    for (let i = 0; i < 10 * k; i++) {
      const a = Math.random() * Math.PI * 2;
      this.smoke.spawn({ x, y: y + 0.15, z, vx: Math.cos(a) * 4 * k, vy: 0.5 + Math.random(), vz: Math.sin(a) * 4 * k, life: 0.6 + Math.random() * 0.4, s0: 0.6, s1: 1.8, a: 0.45, color: hex("#7a6a6e"), drag: 3 });
    }
    for (let i = 0; i < 8 * k; i++) this.glow.spawn({ x, y: y + 0.1, z, vx: R() * 6, vy: 2 + Math.random() * 3, vz: R() * 6, life: 0.4, s0: 0.2, s1: 0.02, color: hex("#ffb04a"), g: 10 });
  }
  ember(x, y, z, k = 1) {
    this.glow.spawn({ x: x + R() * k, y, z: z + R() * k, vx: R() * 2, vy: 3 + Math.random() * 4, vz: R() * 2, life: 0.8 + Math.random() * 0.6, s0: 0.25, s1: 0.03, color: hex(Math.random() < 0.5 ? "#ffb04a" : "#ffe27a"), g: 2 });
  }
  /** 용암에 풍덩 */
  splash(x, y, z) {
    for (let i = 0; i < 40; i++) this.glow.spawn({ x, y, z, vx: R() * 9, vy: 4 + Math.random() * 9, vz: R() * 9, life: 0.7 + Math.random() * 0.5, s0: 0.45, s1: 0.05, color: hex(i % 3 ? "#ff7a2a" : "#fff0a0"), g: 18 });
    for (let i = 0; i < 12; i++) this.smoke.spawn({ x: x + R() * 2, y: y + 0.5, z: z + R() * 2, vx: R() * 2, vy: 3 + Math.random() * 2, vz: R() * 2, life: 1.4, s0: 1.5, s1: 4.5, a: 0.55, color: hex("#3a2a2e"), drag: 0.5 });
  }
  /** 부딪힘: 불꽃 + 바위 조각 */
  hit(x, y, z) {
    for (let i = 0; i < 24; i++) this.glow.spawn({ x, y: y + 0.6, z, vx: R() * 10, vy: Math.random() * 7, vz: R() * 10, life: 0.4 + Math.random() * 0.3, s0: 0.3, s1: 0.02, color: hex(i % 2 ? "#ffe27a" : "#ffffff"), g: 12 });
    this.debris(x, y + 0.5, z, 6);
  }
  orb(x, y, z, big = false) {
    for (let i = 0; i < (big ? 36 : 14); i++) this.glow.spawn({ x, y, z, vx: R() * 5, vy: R() * 5, vz: R() * 5, life: 0.5, s0: big ? 0.6 : 0.35, s1: 0.02, color: hex(big ? "#9af4ff" : "#ffe27a"), drag: 2 });
  }
  burst(x, y, z, n = 30, cols = ["#ffe27a", "#ff7a2a", "#ffffff"]) {
    for (let i = 0; i < n; i++) this.glow.spawn({ x, y, z, vx: R() * 12, vy: Math.random() * 10, vz: R() * 12, life: 0.8 + Math.random() * 0.6, s0: 0.4, s1: 0.03, color: hex(cols[i % cols.length]), g: 8 });
  }
  debris(x, y, z, n = 4) {
    for (let i = 0; i < n; i++) {
      const d = this.cd[this.nc];
      this.nc = (this.nc + 1) % this.cd.length;
      Object.assign(d, { life: 1.6, x, y, z, vx: R() * 8, vy: 3 + Math.random() * 5, vz: R() * 8, rx: Math.random() * 6, ry: Math.random() * 6, s: 0.6 + Math.random() * 0.9 });
    }
  }
  update(dt) {
    this.smoke.update(dt);
    this.glow.update(dt);
    const o = this.o;
    for (let i = 0; i < this.cd.length; i++) {
      const d = this.cd[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      d.vy -= 22 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      o.position.set(d.x, d.y, d.z);
      o.rotation.set(d.rx * d.life, d.ry * d.life, 0);
      o.scale.setScalar(d.life > 0 ? d.s * Math.min(1, d.life * 2) : 0);
      o.updateMatrix();
      this.chunks.setMatrixAt(i, o.matrix);
    }
    this.chunks.instanceMatrix.needsUpdate = true;
  }
  reset() {
    this.smoke.clear();
    this.glow.clear();
    for (const d of this.cd) d.life = 0;
    const o = new THREE.Object3D();
    o.scale.setScalar(0);
    o.updateMatrix();
    for (let i = 0; i < this.cd.length; i++) this.chunks.setMatrixAt(i, o.matrix);
    this.chunks.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    for (const s of [this.smoke, this.glow]) {
      s.geo.dispose();
      s.mat.dispose();
    }
    this.chunks.geometry.dispose();
    this.chunks.material.dispose();
  }
}
