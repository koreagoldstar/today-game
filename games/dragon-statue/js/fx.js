/*
 * 드래곤 석상 대작전 · 효과
 *  돌 조각 · 수정 파편 (InstancedMesh) · 별가루 · 반짝이 (Points) · 먼지 · 충격 고리 · 번쩍 빛 · 금 간 자국 · ✕ 표시 · 정답 화살표
 *  모두 미리 만들어 두고 돌려 쓴다 (게임 중에 새로 만들지 않음).
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { dotTex, starTex, stoneTex } from "./tex.js?v=1";

const rand = (a, b) => a + Math.random() * (b - a);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

function canvasSprite(draw, size = 128) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** 금 간 자국 (가운데에서 뻗어 나가는 번개 모양 선) */
function crackTex() {
  return canvasSprite((x, S) => {
    x.translate(S / 2, S / 2);
    x.lineCap = "round";
    x.lineJoin = "round";
    const paths = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand(-0.25, 0.25);
      const pts = [[0, 0]];
      let r = 0;
      let ang = a;
      while (r < S * 0.46) {
        r += rand(8, 16);
        ang += rand(-0.45, 0.45);
        pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
      }
      paths.push(pts);
    }
    for (const [w, col] of [
      [7, "rgba(255,200,80,0.35)"],
      [3.2, "rgba(255,240,190,0.95)"],
      [1.4, "rgba(255,255,255,1)"],
    ]) {
      x.strokeStyle = col;
      x.lineWidth = w;
      for (const p of paths) {
        x.beginPath();
        p.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        x.stroke();
      }
    }
  }, 256);
}
function markTex(kind) {
  return canvasSprite((x, S) => {
    const c = S / 2;
    x.beginPath();
    x.arc(c, c, S * 0.42, 0, Math.PI * 2);
    x.fillStyle = kind === "x" ? "rgba(255,255,255,0.92)" : "rgba(220,230,245,0.85)";
    x.fill();
    x.lineWidth = S * 0.06;
    x.strokeStyle = kind === "x" ? "#ff5a6a" : "#8a9ab8";
    x.stroke();
    x.lineCap = "round";
    x.lineWidth = S * 0.11;
    if (kind === "x") {
      x.strokeStyle = "#ff4a5a";
      x.beginPath();
      x.moveTo(c - S * 0.17, c - S * 0.17);
      x.lineTo(c + S * 0.17, c + S * 0.17);
      x.moveTo(c + S * 0.17, c - S * 0.17);
      x.lineTo(c - S * 0.17, c + S * 0.17);
      x.stroke();
    } else {
      // 힌트로 지운 석상: 회색 '–'
      x.strokeStyle = "#7a8aa8";
      x.beginPath();
      x.moveTo(c - S * 0.18, c);
      x.lineTo(c + S * 0.18, c);
      x.stroke();
    }
  });
}
function arrowTex() {
  return canvasSprite((x, S) => {
    x.translate(S / 2, S / 2);
    x.beginPath();
    x.moveTo(-S * 0.22, -S * 0.36);
    x.lineTo(S * 0.22, -S * 0.36);
    x.lineTo(S * 0.22, -S * 0.04);
    x.lineTo(S * 0.4, -S * 0.04);
    x.lineTo(0, S * 0.4);
    x.lineTo(-S * 0.4, -S * 0.04);
    x.lineTo(-S * 0.22, -S * 0.04);
    x.closePath();
    x.fillStyle = "#ffd23f";
    x.strokeStyle = "#ffffff";
    x.lineWidth = S * 0.06;
    x.lineJoin = "round";
    x.stroke();
    x.fill();
  });
}
function ringTex() {
  return canvasSprite((x, S) => {
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
  });
}

export class FX {
  constructor(scene, { quality = 1, reduced = false } = {}) {
    this.scene = scene;
    this.quality = quality;
    this.reduced = reduced;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.t = 0;

    // 돌 조각
    this.chunkMax = 60;
    this.chunkMat = new THREE.MeshStandardMaterial({ color: "#ffffff", map: stoneTex(1), roughness: 0.9 });
    this.stoneColor = new THREE.Color("#bdb7a6");
    this.chunks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), this.chunkMat, this.chunkMax);
    for (let i = 0; i < this.chunkMax; i++) this.chunks.setColorAt(i, this.stoneColor);
    this.chunks.castShadow = true;
    this.chunks.frustumCulled = false;
    this.chunkData = Array.from({ length: this.chunkMax }, () => ({ life: 0 }));
    this.root.add(this.chunks);
    // 수정 파편
    this.shardMax = 50;
    this.shardMat = new THREE.MeshStandardMaterial({ color: "#9ff4ff", emissive: "#3ad8ff", emissiveIntensity: 0.9, roughness: 0.1, flatShading: true });
    this.shards = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), this.shardMat, this.shardMax);
    this.shards.frustumCulled = false;
    this.shardData = Array.from({ length: this.shardMax }, () => ({ life: 0 }));
    this.root.add(this.shards);
    this.hideAll(this.chunks, this.chunkMax);
    this.hideAll(this.shards, this.shardMax);

    // 별가루 · 반짝이 (점)
    this.pMax = 260;
    this.pPos = new Float32Array(this.pMax * 3);
    this.pCol = new Float32Array(this.pMax * 3);
    this.pData = Array.from({ length: this.pMax }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, c: new THREE.Color() }));
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(this.pPos, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ map: starTex(), size: 0.42, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    this.root.add(this.points);
    for (let i = 0; i < this.pMax; i++) this.pPos[i * 3 + 1] = -999;

    // 먼지 (스프라이트)
    this.dust = [];
    const dm = new THREE.SpriteMaterial({ map: dotTex(), color: "#d8c8a8", transparent: true, depthWrite: false, opacity: 0 });
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(dm.clone());
      s.visible = false;
      this.root.add(s);
      this.dust.push({ s, life: 0 });
    }
    // 충격 고리
    this.rings = [];
    const rt = ringTex();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: "#fff2b0" }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.root.add(m);
      this.rings.push({ m, life: 0 });
    }
    // 번쩍 빛
    this.flash = new THREE.PointLight("#fff2c0", 0, 9, 1.6);
    this.root.add(this.flash);
    this.flashT = 0;
    // 금 간 자국
    this.crackT = crackTex();
    this.cracks = [];
    // 표시 (✕ · 힌트)
    this.markTexX = markTex("x");
    this.markTexH = markTex("h");
    this.marks = [];
    // 정답 화살표
    this.arrow = new THREE.Sprite(new THREE.SpriteMaterial({ map: arrowTex(), transparent: true, depthTest: false }));
    this.arrow.visible = false;
    this.arrow.renderOrder = 20;
    this.root.add(this.arrow);
  }
  hideAll(im, n) {
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) im.setMatrixAt(i, _m);
    im.instanceMatrix.needsUpdate = true;
  }
  setTheme(T) {
    this.stoneColor.set(T.stone);
    this.shardMat.color.set(T.crystal);
    this.shardMat.emissive.set(T.crystal);
    for (const d of this.dust) d.s.material.color.set(T.id === "ice" ? "#ffffff" : T.id === "volcano" ? "#8a7a74" : T.id === "crystal" ? "#b8b8e8" : "#e0d0b0");
  }
  get budget() {
    return this.reduced ? 0.45 : this.quality >= 1 ? 1 : 0.65;
  }

  /* ---------------- 내보내기 ---------------- */
  /** 정답! 석상이 깨진다 */
  shatter(pos, scale, { gold = false, color = null, power = 1 } = {}) {
    const k = this.budget * power;
    const nC = Math.round(28 * k);
    for (let i = 0; i < nC; i++) {
      this.spawnChunk(pos.x + rand(-0.3, 0.3) * scale, pos.y + rand(0.2, 0.9) * scale, pos.z + rand(-0.3, 0.3) * scale, rand(-3.5, 3.5), rand(2.5, 7), rand(-3.5, 3.5), rand(0.045, 0.115) * scale);
    }
    const nS = Math.round(22 * k);
    for (let i = 0; i < nS; i++) {
      this.spawnShard(pos.x, pos.y + scale * 0.55, pos.z, rand(-4, 4), rand(3, 8), rand(-4, 4), rand(0.05, 0.11) * scale);
    }
    const cols = gold ? ["#ffe27a", "#ffd23f", "#fff6c0"] : [color || "#fff6a0", "#ffffff", "#9ff4ff", "#ffb8e0"];
    this.burst(pos.x, pos.y + scale * 0.55, pos.z, Math.round(70 * k), { speed: 6, cols, life: 1.1, g: -3 });
    this.puff(pos.x, pos.y + 0.1, pos.z, scale, 6);
    this.ring(pos.x, pos.y + 0.05, pos.z, scale * 2.6 * Math.min(1.5, power));
    if (power > 1.2) this.ring(pos.x, pos.y + scale * 0.6, pos.z, scale * 3.4);
    this.flashAt(pos.x, pos.y + scale * 0.6, pos.z, 7 * Math.min(1.4, power));
  }
  /** 틀렸다: 방망이가 튕긴다 (불꽃 몇 개 + 먼지) */
  bonk(pos, scale) {
    this.burst(pos.x, pos.y + scale * 0.62, pos.z + 0.25 * scale, Math.round(16 * this.budget) + 4, { speed: 3.2, cols: ["#ffffff", "#ffe08a"], life: 0.45, g: -6 });
    this.puff(pos.x, pos.y + 0.1, pos.z, scale * 0.6, 3);
  }
  /** 나무 상자 · 울타리가 부서짐 (색 있는 조각) */
  splinter(pos, scale = 1, color = "#b07a42") {
    const c = new THREE.Color(color);
    const n = Math.round(16 * this.budget * scale);
    for (let i = 0; i < n; i++) this.spawnChunk(pos.x + rand(-0.4, 0.4) * scale, pos.y + rand(-0.2, 0.4), pos.z + rand(-0.4, 0.4) * scale, rand(-3, 3), rand(2, 5.5), rand(-3, 3), rand(0.05, 0.12), c);
    this.puff(pos.x, pos.y - 0.4, pos.z, scale, 4);
    this.burst(pos.x, pos.y, pos.z, Math.round(14 * this.budget), { speed: 3, cols: ["#ffffff", "#ffe08a"], life: 0.5, g: -4 });
  }
  /** 착지 먼지 (작게) */
  landDust(x, y, z, k = 1) {
    this.puff(x, y, z, 0.45 * k, Math.max(2, Math.round(3 * k)));
  }
  /** 적을 때린 순간 (별 반짝) */
  hitSpark(pos, cols = ["#ffffff", "#fff2a0", "#ffd23f"]) {
    this.burst(pos.x, pos.y, pos.z, Math.round(18 * this.budget) + 4, { speed: 4.2, cols, life: 0.45, g: -5 });
    this.ring(pos.x, pos.y - 0.3, pos.z, 1.6);
  }
  /** 석상이 땅에서 솟아오를 때 · 사라질 때 먼지 */
  rise(pos, scale) {
    this.puff(pos.x, pos.y + 0.05, pos.z, scale * 0.8, 3);
  }
  /** 콤보 · 보상 반짝이 (높은 곳에서 퍼짐) */
  sparkle(pos, n = 40, cols = ["#fff6a0", "#ffffff", "#ffb8e0", "#9ff4ff"]) {
    this.burst(pos.x, pos.y, pos.z, Math.round(n * this.budget), { speed: 3.5, cols, life: 1.2, g: -1.2 });
  }
  /** 꼬리 반짝이 (요정이 날아갈 때) */
  trail(pos, col = "#fff6a0") {
    const d = this.nextP();
    if (!d) return;
    d.p.set(pos.x + rand(-0.06, 0.06), pos.y + rand(-0.06, 0.06), pos.z);
    d.v.set(rand(-0.3, 0.3), rand(-0.6, 0.1), rand(-0.3, 0.3));
    d.life = d.max = rand(0.4, 0.8);
    d.g = 0;
    d.c.set(col);
  }

  /* ---------------- 석상에 붙는 표시 ---------------- */
  crack(pos, scale) {
    const m = new THREE.SpriteMaterial({ map: this.crackT, transparent: true, depthTest: false, opacity: 1, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    s.position.set(pos.x, pos.y + scale * 0.55, pos.z + scale * 0.25);
    s.scale.setScalar(0.01);
    s.renderOrder = 15;
    this.root.add(s);
    this.cracks.push({ s, life: 0, size: scale * 1.15 });
  }
  mark(pos, scale, kind = "x") {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: kind === "x" ? this.markTexX : this.markTexH, transparent: true, depthTest: false }));
    s.position.set(pos.x, pos.y + scale * 1.12, pos.z);
    s.scale.setScalar(0.01);
    s.renderOrder = 18;
    this.root.add(s);
    const m = { s, life: 0, size: Math.max(0.55, scale * 0.36) };
    this.marks.push(m);
    return m;
  }
  clearMarks() {
    for (const m of this.marks) {
      this.root.remove(m.s);
      m.s.material.dispose();
    }
    this.marks = [];
    for (const c of this.cracks) {
      this.root.remove(c.s);
      c.s.material.dispose();
    }
    this.cracks = [];
    this.arrow.visible = false;
  }
  pointAt(pos, scale) {
    this.arrow.visible = true;
    this.arrowBase = new THREE.Vector3(pos.x, pos.y + scale * 1.25 + 0.4, pos.z);
    this.arrow.scale.setScalar(Math.max(0.7, scale * 0.42));
  }

  /* ---------------- 내부 ---------------- */
  spawnChunk(x, y, z, vx, vy, vz, size, color = null) {
    const i = this.chunkData.findIndex((d) => d.life <= 0);
    if (i < 0) return;
    this.chunks.setColorAt(i, color || this.stoneColor);
    this.chunks.instanceColor.needsUpdate = true;
    this.chunkData[i] = { life: 2.2, p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(vx, vy, vz), r: new THREE.Vector3(rand(0, 6), rand(0, 6), 0), w: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), size, ground: 0.16 };
  }
  spawnShard(x, y, z, vx, vy, vz, size) {
    const i = this.shardData.findIndex((d) => d.life <= 0);
    if (i < 0) return;
    this.shardData[i] = { life: 1.6, p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(vx, vy, vz), r: new THREE.Vector3(rand(0, 6), rand(0, 6), 0), w: new THREE.Vector3(rand(-12, 12), rand(-12, 12), 0), size, ground: 0.16 };
  }
  nextP() {
    for (let k = 0; k < this.pMax; k++) {
      this.pi = ((this.pi || 0) + 1) % this.pMax;
      const d = this.pData[this.pi];
      if (d.life <= 0) {
        if (!d.p) {
          d.p = new THREE.Vector3();
          d.v = new THREE.Vector3();
        }
        return d;
      }
    }
    return null;
  }
  burst(x, y, z, n, { speed = 4, cols = ["#ffffff"], life = 1, g = -3 } = {}) {
    for (let i = 0; i < n; i++) {
      const d = this.nextP();
      if (!d) return;
      const a = Math.random() * Math.PI * 2;
      const u = rand(-0.2, 1);
      const sp = speed * rand(0.35, 1);
      d.p.set(x, y, z);
      d.v.set(Math.cos(a) * sp * Math.sqrt(1 - u * u), u * sp + 1.2, Math.sin(a) * sp * Math.sqrt(1 - u * u));
      d.life = d.max = life * rand(0.6, 1.2);
      d.g = g;
      d.c.set(cols[i % cols.length]);
    }
  }
  puff(x, y, z, scale, n) {
    for (let k = 0; k < n; k++) {
      const d = this.dust.find((q) => q.life <= 0);
      if (!d) return;
      const a = (k / n) * Math.PI * 2 + rand(-0.3, 0.3);
      d.life = d.max = rand(0.6, 0.9);
      d.p = new THREE.Vector3(x + Math.cos(a) * 0.3 * scale, y + 0.15, z + Math.sin(a) * 0.3 * scale);
      d.v = new THREE.Vector3(Math.cos(a) * 1.4 * scale, rand(0.3, 0.8), Math.sin(a) * 1.4 * scale);
      d.size = rand(0.6, 1) * scale;
      d.s.visible = true;
    }
  }
  ring(x, y, z, size) {
    const r = this.rings.find((q) => q.life <= 0);
    if (!r) return;
    r.life = r.max = 0.5;
    r.size = size;
    r.m.position.set(x, y, z);
    r.m.visible = true;
  }
  flashAt(x, y, z, power) {
    if (this.reduced) power *= 0.4;
    this.flash.position.set(x, y, z);
    this.flash.intensity = power;
    this.flashT = 0.35;
    this.flashP = power;
  }

  update(dt) {
    this.t += dt;
    // 돌 조각
    let dirty = false;
    for (const [im, data] of [
      [this.chunks, this.chunkData],
      [this.shards, this.shardData],
    ]) {
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (d.life <= 0) continue;
        dirty = true;
        d.life -= dt;
        d.v.y -= 16 * dt;
        d.p.addScaledVector(d.v, dt);
        if (d.p.y < d.ground + d.size * 0.5) {
          d.p.y = d.ground + d.size * 0.5;
          d.v.y *= -0.32;
          d.v.x *= 0.6;
          d.v.z *= 0.6;
          d.w.multiplyScalar(0.6);
        }
        d.r.addScaledVector(d.w, dt);
        const k = d.life < 0.4 ? d.life / 0.4 : 1;
        _q.setFromEuler(_e.set(d.r.x, d.r.y, d.r.z));
        _s.setScalar(d.life <= 0 ? 0 : d.size * k);
        _m.compose(d.p, _q, _s);
        im.setMatrixAt(i, _m);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    // 점 입자
    for (let i = 0; i < this.pMax; i++) {
      const d = this.pData[i];
      const k3 = i * 3;
      if (d.life <= 0) {
        if (this.pPos[k3 + 1] !== -999) this.pPos[k3 + 1] = -999;
        continue;
      }
      d.life -= dt;
      d.v.y += d.g * dt;
      d.v.multiplyScalar(1 - dt * 1.6);
      d.p.addScaledVector(d.v, dt);
      this.pPos[k3] = d.p.x;
      this.pPos[k3 + 1] = d.life > 0 ? d.p.y : -999;
      this.pPos[k3 + 2] = d.p.z;
      const f = Math.max(0, d.life / d.max) * (0.7 + 0.3 * Math.sin(this.t * 30 + i));
      this.pCol[k3] = d.c.r * f;
      this.pCol[k3 + 1] = d.c.g * f;
      this.pCol[k3 + 2] = d.c.b * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    // 먼지
    for (const d of this.dust) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.p.addScaledVector(d.v, dt);
      d.v.multiplyScalar(1 - dt * 3);
      const k = 1 - d.life / d.max;
      d.s.position.copy(d.p);
      d.s.scale.setScalar(d.size * (0.6 + k * 1.2));
      d.s.material.opacity = Math.max(0, 0.55 * (1 - k));
      if (d.life <= 0) d.s.visible = false;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - r.life / r.max;
      r.m.scale.setScalar(r.size * (0.3 + k));
      r.m.material.opacity = 1 - k;
      if (r.life <= 0) r.m.visible = false;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.intensity = Math.max(0, (this.flashT / 0.35) * this.flashP);
    }
    // 금 · 표시 · 화살표
    for (let i = this.cracks.length - 1; i >= 0; i--) {
      const c = this.cracks[i];
      c.life += dt;
      c.s.scale.setScalar(c.size * Math.min(1, c.life / 0.12));
      // 석상이 깨지면 금 자국도 사라진다
      if (c.life > 0.16) c.s.material.opacity = Math.max(0, 1 - (c.life - 0.16) / 0.12);
      if (c.life > 0.3) {
        this.root.remove(c.s);
        c.s.material.dispose();
        this.cracks.splice(i, 1);
      }
    }
    for (const m of this.marks) {
      m.life += dt;
      const k = Math.min(1, m.life / 0.25);
      const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.35 : 1;
      m.s.scale.setScalar(m.size * k * pop);
    }
    if (this.arrow.visible && this.arrowBase) {
      this.arrow.position.copy(this.arrowBase);
      this.arrow.position.y += Math.abs(Math.sin(this.t * 6)) * 0.35;
    }
    return dirty;
  }

  /** 다음 판 준비: 남은 효과 정리 */
  reset() {
    for (const d of this.chunkData) d.life = 0;
    for (const d of this.shardData) d.life = 0;
    this.hideAll(this.chunks, this.chunkMax);
    this.hideAll(this.shards, this.shardMax);
    for (const d of this.pData) d.life = 0;
    for (const d of this.dust) {
      d.life = 0;
      d.s.visible = false;
    }
    for (const r of this.rings) {
      r.life = 0;
      r.m.visible = false;
    }
    this.flashT = 0;
    this.flash.intensity = 0;
    this.clearMarks();
  }
}
