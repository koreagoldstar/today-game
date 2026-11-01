/*
 * 게임 위에 놓이는 것들: 풀 다발 · 튀는 입자 · 공 궤적 · 낙하 표시 · 예상 궤적 · 그린 경사 표시
 */
import { THREE, canvas, tex, rng, std, merge, clamp } from "../../oneshot-elite/js/kit.js";

let SOFT = null;
function softTex() {
  if (SOFT) return SOFT;
  const c = canvas(64, 64);
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.5, "rgba(255,255,255,0.7)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  SOFT = tex(c, { repeat: false });
  return SOFT;
}

/* ---------- 공 주변 풀 ---------- */
export class Tufts {
  constructor(parent, count) {
    this.count = count;
    this.mesh = null;
    if (!count) return;
    const c = canvas(128, 128);
    const g = c.getContext("2d");
    const ac = canvas(128, 128);
    const ag = ac.getContext("2d");
    const r = rng(23);
    const base = g.createLinearGradient(0, 128, 0, 0);
    base.addColorStop(0, "#4d8638");
    base.addColorStop(1, "#7fb255");
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    ag.fillStyle = "#000";
    ag.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 46; i += 1) {
      const x = 8 + r() * 112;
      const h = 54 + r() * 70;
      const lean = (r() - 0.5) * 34;
      const k = 0.82 + r() * 0.36;
      const blade = (ctx, fill) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(x - 3.2, 128);
        ctx.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h);
        ctx.quadraticCurveTo(x + lean * 0.3 + 3, 128 - h * 0.55, x + 3.2, 128);
        ctx.fill();
      };
      const gr = g.createLinearGradient(0, 128, 0, 128 - h);
      gr.addColorStop(0, `rgb(${70 * k},${118 * k},${50 * k})`);
      gr.addColorStop(1, `rgb(${128 * k},${176 * k},${84 * k})`);
      blade(g, gr);
      blade(ag, "#fff");
    }
    const a = new THREE.PlaneGeometry(1, 1).toNonIndexed();
    a.translate(0, 0.5, 0);
    const b = a.clone();
    b.rotateY(Math.PI / 2);
    const geo = merge([a, b]);
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i += 1) n.setXYZ(i, 0, 1, 0);
    this.uT = { value: 0 };
    const m = std({ map: tex(c, { repeat: false }), alphaMap: tex(ac, { repeat: false, srgb: false }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.uT;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uT;").replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.x += sin(uT * 2.1 + instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.4) * 0.09 * position.y;");
    };
    this.mesh = new THREE.InstancedMesh(geo, m, count);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(this.mesh);
    this.r = rng(77);
    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
  }
  relocate(hole, x, z, R = 34) {
    if (!this.mesh) return;
    const { r, dummy, col } = this;
    for (let i = 0; i < this.count; i += 1) {
      const a = r() * Math.PI * 2;
      const d = 0.6 + R * r() ** 1.35;
      const px = x + Math.cos(a) * d;
      const pz = z + Math.sin(a) * d;
      const s = hole.surface(px, pz);
      const size = s === "deep" ? 0.46 : s === "rough" ? 0.3 : s === "first" ? 0.15 : 0;
      dummy.position.set(px, hole.height(px, pz) - 0.02, pz);
      const k = size * (0.7 + r() * 0.6);
      dummy.scale.set(k * 1.5, k || 0.001, k * 1.5);
      if (!size) dummy.scale.setScalar(0.0001);
      dummy.rotation.y = r() * 6.28;
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      const t = 0.8 + r() * 0.34;
      this.mesh.setColorAt(i, col.setRGB(t, t, t * 0.9));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  tick(time) {
    if (this.uT) this.uT.value = time;
  }
}

/* ---------- 튀는 입자 (모래 · 물 · 잔디 · 축포) ---------- */
export class Particles {
  constructor(parent, n = 260) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.grav = new Float32Array(n);
    this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 4));
    const m = new THREE.PointsMaterial({ size: 0.34, map: softTex(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    parent.add(this.points);
    this.tmp = new THREE.Color();
    this.active = false;
  }
  burst(x, y, z, count, color, spread, up, life, grav = 1) {
    const c = this.tmp.set(color);
    for (let k = 0; k < count; k += 1) {
      const i = this.i;
      this.i = (i + 1) % this.n;
      this.pos.set([x, y, z], i * 3);
      const a = Math.random() * 6.283;
      const s = spread * (0.2 + Math.random());
      this.vel.set([Math.cos(a) * s, up * (0.45 + Math.random() * 0.75), Math.sin(a) * s], i * 3);
      this.life[i] = this.max[i] = life * (0.55 + Math.random() * 0.6);
      this.grav[i] = grav;
      this.col.set([c.r, c.g, c.b, 1], i * 4);
    }
    this.active = true;
  }
  tick(dt) {
    if (!this.active) return;
    let any = false;
    for (let i = 0; i < this.n; i += 1) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const j = i * 3;
      this.vel[j + 1] -= 9.8 * this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.col[i * 4 + 3] = this.life[i] <= 0 ? 0 : clamp(this.life[i] / this.max[i], 0, 1);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.active = any;
  }
}

/* ---------- 공 궤적 (카메라를 보는 띠) ---------- */
export class Trail {
  constructor(parent, max = 150) {
    this.max = max;
    this.pts = [];
    this.pos = new Float32Array(max * 6);
    this.col = new Float32Array(max * 8);
    const idx = [];
    for (let i = 0; i < max - 1; i += 1) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 4));
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.45), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    parent.add(this.mesh);
    this.a = new THREE.Vector3();
    this.b = new THREE.Vector3();
    this.c = new THREE.Vector3();
    this.fade = 1;
  }
  clear() {
    this.pts.length = 0;
    this.mesh.geometry.setDrawRange(0, 0);
    this.fade = 1;
  }
  push(x, y, z) {
    const p = this.pts;
    const last = p[p.length - 1];
    if (last && Math.hypot(last.x - x, last.y - y, last.z - z) < 1.1) return;
    p.push({ x, y, z });
    if (p.length > this.max) p.shift();
  }
  update(cam) {
    const p = this.pts;
    const n = p.length;
    if (n < 2) return;
    const { a, b, c } = this;
    for (let i = 0; i < n; i += 1) {
      const q = p[i];
      const q2 = p[Math.min(n - 1, i + 1)];
      const q0 = p[Math.max(0, i - 1)];
      a.set(q2.x - q0.x, q2.y - q0.y, q2.z - q0.z);
      b.set(q.x - cam.x, q.y - cam.y, q.z - cam.z);
      const d = b.length();
      c.crossVectors(a, b).normalize();
      const w = clamp(d * 0.0016, 0.006, 0.26);
      this.pos.set([q.x + c.x * w, q.y + c.y * w, q.z + c.z * w, q.x - c.x * w, q.y - c.y * w, q.z - c.z * w], i * 6);
      const al = (i / (n - 1)) ** 0.7 * 0.7 * clamp((d - 2) / 22, 0, 1) * this.fade;
      this.col.set([1, 1, 1, al, 1, 1, 1, al], i * 8);
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.setDrawRange(0, (n - 1) * 6);
  }
}

/* ---------- 낙하 표시 ---------- */
export class LandMark {
  constructor(parent) {
    this.group = new THREE.Group();
    const mk = (r0, r1, op) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthTest: false, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 8;
      this.group.add(m);
      return m;
    };
    this.outer = mk(0.92, 1, 0.95);
    this.mid = mk(0.5, 0.54, 0.65);
    this.dot = mk(0, 0.08, 1);
    this.group.visible = false;
    parent.add(this.group);
    this.t = 0;
  }
  set(x, y, z, size, color) {
    this.group.position.set(x, y + 0.25, z);
    this.size = size;
    for (const m of [this.outer, this.mid, this.dot]) m.material.color.set(color).multiplyScalar(1.7);
    this.group.visible = true;
  }
  hide() {
    this.group.visible = false;
  }
  tick(dt, camDist) {
    this.t += dt;
    const k = (this.size || 1) * (1 + Math.sin(this.t * 4) * 0.05);
    const s = Math.max(k, camDist * 0.022);
    this.group.scale.set(s, 1, s);
  }
}

/* ---------- 예상 궤적 점 ---------- */
export class ArcDots {
  constructor(parent, n = 130) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 4));
    g.setDrawRange(0, 0);
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 4, map: softTex(), vertexColors: true, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, fog: false }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    parent.add(this.points);
  }
  /** 점 목록 [x,y,z,...] · alpha 는 앞쪽 몇 %까지 보여 줄지 */
  set(list, color = [1.6, 1.6, 1.5], upto = 1) {
    const total = Math.min(this.n, list.length / 3);
    const n = Math.round(total * upto);
    for (let i = 0; i < n; i += 1) {
      const j = i * 3;
      this.pos.set([list[j], list[j + 1], list[j + 2]], j);
      const a = 0.55 * (1 - (i / Math.max(1, n)) * 0.3);
      this.col.set([color[0], color[1], color[2], a], i * 4);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.setDrawRange(0, n);
  }
  clear() {
    this.points.geometry.setDrawRange(0, 0);
  }
}

/* ---------- 그린 경사 (격자 + 내리막으로 흐르는 점) ---------- */
export class PuttGrid {
  constructor(parent, hole) {
    this.hole = hole;
    const gc = hole.greenCenter;
    const R = hole.def.r * 1.5;
    const step = 1.25;
    const seg = [];
    const inG = (x, z) => hole.greenK(x, z) < 1.12;
    for (let x = gc.x - R; x <= gc.x + R; x += step) {
      for (let z = gc.z - R; z <= gc.z + R; z += step) {
        if (!inG(x, z)) continue;
        const y = hole.height(x, z) + 0.035;
        if (inG(x + step, z)) seg.push(x, y, z, x + step, hole.height(x + step, z) + 0.035, z);
        if (inG(x, z + step)) seg.push(x, y, z, x, hole.height(x, z + step) + 0.035, z + step);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24, depthWrite: false, fog: false }));
    this.lines.visible = false;
    parent.add(this.lines);
    // 흐르는 점
    const dots = [];
    const r = rng(hole.def.n * 31 + 5);
    let guard = 0;
    while (dots.length < 170 && guard < 4000) {
      guard += 1;
      const x = gc.x + (r() - 0.5) * 2 * R;
      const z = gc.z + (r() - 0.5) * 2 * R;
      if (!inG(x, z)) continue;
      const gd = hole.grad(x, z);
      const m = Math.hypot(gd.x, gd.z) || 1e-4;
      dots.push({ x, z, dx: -gd.x / m, dz: -gd.z / m, m, ph: r() });
    }
    this.dots = dots;
    this.pos = new Float32Array(dots.length * 3);
    this.col = new Float32Array(dots.length * 4);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(this.col, 4));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.075, map: softTex(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, fog: false }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    parent.add(this.points);
  }
  show(on) {
    this.lines.visible = on;
    this.points.visible = on;
  }
  tick(t) {
    if (!this.points.visible) return;
    const h = this.hole;
    this.dots.forEach((d, i) => {
      const u = (t * (0.32 + d.m * 7) + d.ph) % 1;
      const x = d.x + d.dx * u * 1.1;
      const z = d.z + d.dz * u * 1.1;
      this.pos.set([x, h.height(x, z) + 0.06, z], i * 3);
      const k = clamp(d.m / 0.06, 0, 1);
      const a = Math.sin(u * Math.PI) * 0.95;
      this.col.set([1.6, 1.6 - k * 1.1, 1.4 - k * 1.25, a], i * 4);
    });
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
  dispose() {
    this.lines.geometry.dispose();
    this.lines.material.dispose();
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.lines.removeFromParent();
    this.points.removeFromParent();
  }
}
