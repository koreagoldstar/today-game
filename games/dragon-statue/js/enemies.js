/*
 * 드래곤 석상 대작전 · 장난꾸러기 적 6종 (무섭지 않게, 행동은 단순하고 또렷하게)
 *  돌 도마뱀 · 장난꾸러기 미니 드래곤 · 수정 박쥐 · 불꽃 정령 · 얼음 슬라임 · 석상 수호자
 *  공통 흐름: 순찰 → (발견) 짧게 쫓기 → 예고(빨간 표시 · ! · 반짝) → 공격(이때만 아프다) → 쉬기(어질어질, 이때 치기 좋다)
 *  몸에 닿기만 하면 살짝 밀릴 뿐 아프지 않다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { taperTube, slab } from "./geo.js?v=1";
import { dotTex } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const sph = (n = 16) => new THREE.SphereGeometry(1, n, Math.round(n * 0.75));

/* ---------------- 종류별 성질 ---------------- */
export const ENEMY = {
  lizard: { name: "돌 도마뱀", hp: 1, speed: 1.6, chase: 2.8, detect: 5.5, reach: 1.7, windup: 0.75, recover: 1.1, type: "lunge", radius: 0.55, hover: 0, score: 30 },
  minidragon: { name: "장난꾸러기 미니 드래곤", hp: 1, speed: 1.8, chase: 1.4, detect: 8, reach: 7, windup: 0.85, recover: 1.4, type: "shoot", radius: 0.5, hover: 1.25, score: 40 },
  bat: { name: "수정 박쥐", hp: 1, speed: 2.2, chase: 2.2, detect: 7, reach: 6, windup: 0.75, recover: 1.3, type: "dive", radius: 0.5, hover: 2.4, score: 40 },
  spirit: { name: "화산 불꽃 정령", hp: 1, speed: 1.5, chase: 1.2, detect: 8.5, reach: 8, windup: 0.95, recover: 1.1, type: "lob", radius: 0.5, hover: 0.7, score: 40 },
  slime: { name: "얼음 슬라임", hp: 2, speed: 1.3, chase: 2.2, detect: 6, reach: 2.8, windup: 0.75, recover: 1.1, type: "slam", radius: 0.6, hover: 0, score: 50 },
  guard: { name: "움직이는 석상 수호자", hp: 3, speed: 1.2, chase: 1.8, detect: 6, reach: 2.1, windup: 1.0, recover: 1.4, type: "smash", radius: 0.75, hover: 0, score: 70 },
};

/* ---------------- 모양 ---------------- */
const mc = new Map();
function M(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!mc.has(k)) mc.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o }));
  return mc.get(k);
}
function mesh(geo, mat, pos, scale = 1, rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scale === "number") m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}
/** 귀여운 눈 한 쌍 (흰자 · 까만 눈동자 · 반사광) */
function eyes(parent, x, y, z, r = 0.08, { brow = 0, glow = null } = {}) {
  const out = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(s * x, y, z);
    e.add(mesh(sph(12), M("#ffffff", { roughness: 0.3 }), [0, 0, 0], [r, r * 1.1, r * 0.6]));
    e.add(mesh(sph(10), glow ? M(glow, { emissive: glow, emissiveIntensity: 1.2 }) : M("#1a1214", { roughness: 0.1 }), [0, 0, r * 0.45], [r * 0.62, r * 0.72, r * 0.35]));
    e.add(mesh(sph(6), new THREE.MeshBasicMaterial({ color: "#ffffff" }), [-r * 0.2, r * 0.3, r * 0.72], r * 0.2));
    if (brow) e.add(mesh(new THREE.BoxGeometry(r * 1.6, r * 0.28, r * 0.3), M("#2a1a14"), [0, r * 1.2, r * 0.3], 1, [0, 0, s * brow]));
    parent.add(e);
    out.push(e);
  }
  return out;
}
function buildModel(kind) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const parts = { body };
  if (kind === "lizard") {
    const skin = M("#a8a294", { roughness: 0.8 });
    const moss = M("#6fa04a", { roughness: 0.9 });
    body.add(mesh(sph(), skin, [0, 0.32, 0], [0.32, 0.26, 0.48]));
    body.add(mesh(sph(), M("#d8d2be"), [0, 0.24, 0.06], [0.24, 0.16, 0.36]));
    const head = new THREE.Group();
    head.position.set(0, 0.42, 0.48);
    head.add(mesh(sph(), skin, [0, 0, 0], [0.26, 0.22, 0.28]));
    head.add(mesh(sph(), skin, [0, -0.05, 0.18], [0.18, 0.12, 0.16]));
    eyes(head, 0.12, 0.1, 0.17, 0.085, { brow: 0.35 });
    body.add(head);
    parts.head = head;
    // 등 이끼 가시
    for (let i = 0; i < 4; i++) body.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 5), moss, [0, 0.58 - i * 0.02, 0.22 - i * 0.18], 1, [-0.3, 0, 0]));
    const legs = [];
    for (const [x, z] of [
      [-0.26, 0.26],
      [0.26, 0.26],
      [-0.26, -0.24],
      [0.26, -0.24],
    ]) {
      const l = mesh(sph(8), skin, [x, 0.1, z], [0.1, 0.1, 0.13]);
      body.add(l);
      legs.push(l);
    }
    parts.legs = legs;
    const tail = new THREE.Group();
    tail.position.set(0, 0.3, -0.42);
    tail.add(mesh(taperTube([V(0, 0, 0), V(0, 0.05, -0.3), V(0.1, 0.15, -0.6)], (t) => 0.13 * (1 - t * 0.85), 8, 8), skin, [0, 0, 0]));
    body.add(tail);
    parts.tail = tail;
  } else if (kind === "minidragon") {
    const skin = M("#5ac8b8", { roughness: 0.5 });
    body.add(mesh(sph(), skin, [0, 0, 0], [0.26, 0.28, 0.26]));
    body.add(mesh(sph(), M("#e8fff4"), [0, -0.03, 0.12], [0.17, 0.2, 0.15]));
    const head = new THREE.Group();
    head.position.set(0, 0.34, 0.06);
    head.add(mesh(sph(18), skin, [0, 0, 0], [0.3, 0.26, 0.28]));
    head.add(mesh(sph(), skin, [0, -0.07, 0.22], [0.16, 0.11, 0.12]));
    eyes(head, 0.12, 0.04, 0.22, 0.075, { brow: -0.4 });
    for (const s of [-1, 1]) head.add(mesh(new THREE.ConeGeometry(0.05, 0.16, 6), M("#ffd23f"), [s * 0.12, 0.26, -0.04], 1, [-0.3, 0, -s * 0.3]));
    body.add(head);
    parts.head = head;
    const wingS = new THREE.Shape();
    wingS.moveTo(0, 0);
    wingS.quadraticCurveTo(0.15, 0.25, 0.42, 0.24);
    wingS.quadraticCurveTo(0.32, 0.1, 0.36, 0);
    wingS.quadraticCurveTo(0.2, 0.0, 0, 0);
    const wingM = M("#8ae8d8", { side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    parts.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.14, 0.1, -0.12);
      w.add(mesh(slab(wingS, 0.015, 0.005), wingM, [0, 0, 0], [s, 1, 1]));
      body.add(w);
      parts.wings.push(w);
    }
    body.add(mesh(new THREE.ConeGeometry(0.09, 0.32, 8), skin, [0, -0.2, -0.24], 1, [-2.1, 0, 0]));
  } else if (kind === "bat") {
    const fur = M("#4a3a7a", { roughness: 0.7 });
    body.add(mesh(sph(), fur, [0, 0, 0], [0.3, 0.3, 0.28]));
    body.add(mesh(sph(), M("#7a6aaa"), [0, -0.04, 0.12], [0.2, 0.2, 0.16]));
    for (const s of [-1, 1]) body.add(mesh(new THREE.ConeGeometry(0.09, 0.26, 6), fur, [s * 0.15, 0.3, 0], 1, [0, 0, -s * 0.35]));
    eyes(body, 0.11, 0.06, 0.24, 0.08, { brow: -0.3 });
    const wingM = M("#7fe8ff", { emissive: "#38b8ff", emissiveIntensity: 0.5, transparent: true, opacity: 0.85, side: THREE.DoubleSide, flatShading: true, roughness: 0.15 });
    const ws = new THREE.Shape();
    ws.moveTo(0, 0);
    ws.lineTo(0.55, 0.2);
    ws.lineTo(0.48, -0.02);
    ws.lineTo(0.62, -0.16);
    ws.lineTo(0.36, -0.12);
    ws.lineTo(0.3, -0.26);
    ws.lineTo(0, -0.08);
    parts.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.22, 0.04, 0);
      w.add(mesh(slab(ws, 0.02, 0.006), wingM, [0, 0, 0], [s, 1, 1]));
      body.add(w);
      parts.wings.push(w);
    }
  } else if (kind === "spirit") {
    const fire = M("#ff8a2a", { emissive: "#ff6a10", emissiveIntensity: 1.4, roughness: 0.4 });
    const core = M("#ffe27a", { emissive: "#ffd23f", emissiveIntensity: 1.6 });
    body.add(mesh(sph(18), fire, [0, 0.1, 0], [0.32, 0.3, 0.3]));
    body.add(mesh(new THREE.ConeGeometry(0.28, 0.55, 12), fire, [0, 0.45, -0.03], 1, [-0.15, 0, 0]));
    body.add(mesh(new THREE.ConeGeometry(0.12, 0.3, 10), core, [0.1, 0.42, 0.05], 1, [0, 0, -0.3]));
    body.add(mesh(sph(12), core, [0, 0.08, 0.1], [0.2, 0.18, 0.2]));
    eyes(body, 0.1, 0.16, 0.26, 0.075, { brow: -0.35 });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffa04a", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.6);
    glow.position.y = 0.2;
    body.add(glow);
  } else if (kind === "slime") {
    const jelly = M("#7fd8ff", { roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.88, emissive: "#2a7ab0", emissiveIntensity: 0.25 });
    body.add(mesh(sph(20), jelly, [0, 0.38, 0], [0.5, 0.4, 0.5]));
    body.add(mesh(new THREE.OctahedronGeometry(0.14, 0), M("#ffffff", { emissive: "#9ae8ff", emissiveIntensity: 0.6, flatShading: true }), [0.05, 0.82, -0.05], [0.8, 1.4, 0.8]));
    eyes(body, 0.16, 0.48, 0.42, 0.095, { brow: -0.25 });
    body.add(mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 12, Math.PI), M("#2a3a5a"), [0, 0.32, 0.47], 1, [0, 0, Math.PI]));
  } else if (kind === "guard") {
    const stone = M("#b8a888", { roughness: 0.85 });
    const dark = M("#8a7a62", { roughness: 0.9 });
    body.add(mesh(new THREE.BoxGeometry(0.8, 0.75, 0.6), stone, [0, 0.72, 0]));
    body.add(mesh(new THREE.BoxGeometry(0.86, 0.12, 0.66), dark, [0, 1.1, 0]));
    for (const s of [-1, 1]) body.add(mesh(new THREE.BoxGeometry(0.26, 0.36, 0.3), dark, [s * 0.22, 0.2, 0]));
    const head = new THREE.Group();
    head.position.set(0, 1.38, 0.05);
    head.add(mesh(new THREE.BoxGeometry(0.56, 0.42, 0.5), stone, [0, 0, 0]));
    head.add(mesh(new THREE.BoxGeometry(0.34, 0.22, 0.28), stone, [0, -0.06, 0.32]));
    for (const s of [-1, 1]) head.add(mesh(new THREE.ConeGeometry(0.07, 0.3, 6), M("#e8d8b0"), [s * 0.2, 0.3, -0.05], 1, [-0.4, 0, -s * 0.3]));
    eyes(head, 0.13, 0.06, 0.26, 0.07, { glow: "#7ff0ff" });
    body.add(head);
    parts.head = head;
    parts.arms = [];
    for (const s of [-1, 1]) {
      const a = new THREE.Group();
      a.position.set(s * 0.52, 0.98, 0);
      a.add(mesh(new THREE.BoxGeometry(0.24, 0.5, 0.24), stone, [0, -0.25, 0]));
      a.add(mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), dark, [0, -0.6, 0.02]));
      body.add(a);
      parts.arms.push(a);
    }
    body.add(mesh(new THREE.CircleGeometry(0.12, 6), new THREE.MeshBasicMaterial({ color: "#7ff0ff" }), [0, 0.78, 0.31]));
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { g, parts };
}

/* ---------------- 예고 표시 (! · 빨간 고리) ---------------- */
let _bang = null;
function bangTex() {
  if (_bang) return _bang;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "#ff4a3a";
  x.beginPath();
  x.arc(32, 32, 28, 0, TAU);
  x.fill();
  x.strokeStyle = "#ffffff";
  x.lineWidth = 5;
  x.stroke();
  x.fillStyle = "#ffffff";
  x.font = "bold 44px sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("!", 32, 35);
  _bang = new THREE.CanvasTexture(c);
  _bang.colorSpace = THREE.SRGBColorSpace;
  return _bang;
}
let _dizzy = null;
function dizzyTex() {
  if (_dizzy) return _dizzy;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 48;
  const x = c.getContext("2d");
  x.fillStyle = "#ffe14a";
  x.strokeStyle = "#3a2412";
  x.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const cx = 22 + i * 42;
    x.beginPath();
    for (let k = 0; k <= 10; k++) {
      const r = k % 2 ? 7 : 16;
      const a = (k / 10) * TAU - Math.PI / 2;
      k ? x.lineTo(cx + Math.cos(a) * r, 24 + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, 24 + Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
    x.stroke();
  }
  _dizzy = new THREE.CanvasTexture(c);
  _dizzy.colorSpace = THREE.SRGBColorSpace;
  return _dizzy;
}

/* ================================================================
 * 적
 * ============================================================== */
export class Enemy {
  constructor(kind, data, level, root) {
    this.kind = kind;
    this.S = ENEMY[kind];
    this.level = level;
    this.a = V(...data.a);
    this.b = V(...data.b);
    this.hp = this.S.hp;
    this.pos = this.a.clone();
    this.groundY = this.groundAt(this.pos);
    this.pos.y = this.groundY + this.S.hover;
    this.toB = true;
    this.state = "patrol";
    this.t = Math.random() * 3;
    this.st = 0;
    this.yaw = Math.atan2(this.b.x - this.a.x, this.b.z - this.a.z) || 0;
    this.cool = 0;
    this.flash = 0;
    this.target = new THREE.Vector3();
    const { g, parts } = buildModel(kind);
    this.mesh = g;
    this.parts = parts;
    root.add(g);
    // 예고 고리 · ! · 어질 별
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 36), new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: 0, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    root.add(this.ring);
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(1, 36), new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: 0, depthWrite: false }));
    this.fill.rotation.x = -Math.PI / 2;
    root.add(this.fill);
    this.bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex(), transparent: true, depthTest: false }));
    this.bang.scale.setScalar(0.55);
    this.bang.visible = false;
    this.bang.renderOrder = 15;
    root.add(this.bang);
    this.dizzy = new THREE.Sprite(new THREE.SpriteMaterial({ map: dizzyTex(), transparent: true, depthTest: false }));
    this.dizzy.scale.set(0.9, 0.34, 1);
    this.dizzy.visible = false;
    this.dizzy.renderOrder = 15;
    root.add(this.dizzy);
    this.root = root;
    this.place();
  }
  groundAt(p) {
    const g = this.level.ground(p.x, p.z, 0.3, p.y + 3);
    return g ? g.h : p.y;
  }
  get alive() {
    return this.state !== "dead" && this.state !== "gone";
  }
  /** 몸 가운데 (방망이 판정용) */
  center(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + (this.kind === "guard" ? 0.9 : 0.35), this.pos.z);
  }
  /** 방망이로 칠 수 있는 높이인가 (공중 높이 나는 박쥐는 내려왔을 때만) */
  get hittable() {
    if (!this.alive) return false;
    return this.pos.y - this.groundY < 1.9;
  }
  setState(s) {
    this.state = s;
    this.st = 0;
  }

  /**
   * @returns 일어난 일 목록: { type: 'hurt', from } (주인공이 맞음) · { type: 'shoot', ... } · { type: 'warn' }
   */
  update(dt, P) {
    const ev = [];
    if (this.state === "gone") return ev;
    this.t += dt;
    this.st += dt;
    this.cool = Math.max(0, this.cool - dt);
    const S = this.S;
    const pp = P.pos;
    const dx = pp.x - this.pos.x;
    const dz = pp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = Math.abs(pp.y - this.groundY);
    const sees = dist < S.detect && dy < 2.2 && !P.dead;
    const seg = this.a.distanceTo(this.b);
    if (this.state === "dead") {
      // 퐁 사라지기
      const k = Math.min(1, this.st / 0.35);
      this.mesh.scale.setScalar(1 + k * 0.5);
      this.mesh.position.y += dt * 2;
      this.mesh.traverse((o) => o.isMesh && o.material && (o.material.transparent = true));
      if (k >= 1) {
        this.state = "gone";
        this.mesh.visible = false;
      }
      return ev;
    }
    const face = (tx, tz, rate = 8) => {
      const target = Math.atan2(tx, tz);
      let d = target - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * rate);
    };
    const moveTo = (tx, tz, speed) => {
      const ddx = tx - this.pos.x;
      const ddz = tz - this.pos.z;
      const d = Math.hypot(ddx, ddz);
      if (d < 0.05) return true;
      const m = Math.min(d, speed * dt);
      this.pos.x += (ddx / d) * m;
      this.pos.z += (ddz / d) * m;
      face(ddx, ddz);
      return d < 0.1;
    };
    // 순찰 구간 밖으로 너무 멀리 쫓아가지 않기
    const clampToZone = () => {
      const ab = new THREE.Vector3().subVectors(this.b, this.a);
      const L2 = ab.lengthSq() || 1;
      const u = Math.max(-0.4, Math.min(1.4, new THREE.Vector3().subVectors(this.pos, this.a).dot(ab) / L2));
      const px = this.a.x + ab.x * u;
      const pz = this.a.z + ab.z * u;
      const off = Math.hypot(this.pos.x - px, this.pos.z - pz);
      const lim = Math.max(2.5, seg * 0.6);
      if (off > lim) {
        this.pos.x = px + ((this.pos.x - px) / off) * lim;
        this.pos.z = pz + ((this.pos.z - pz) / off) * lim;
      }
    };
    let ring = 0;
    let ringR = 1.3;
    let ringAt = null;
    let bang = false;
    let diz = false;
    let hoverY = S.hover;
    switch (this.state) {
      case "patrol": {
        const T = this.toB ? this.b : this.a;
        if (seg < 0.3) face(dx, dz, 2);
        else if (moveTo(T.x, T.z, S.speed)) this.toB = !this.toB;
        if (sees && this.cool <= 0) this.setState(S.type === "shoot" || S.type === "lob" || S.type === "dive" ? "aim" : "chase");
        break;
      }
      case "chase": {
        if (!sees) {
          this.setState("patrol");
          break;
        }
        if (dist > S.reach * 0.85) moveTo(pp.x, pp.z, S.chase);
        else face(dx, dz);
        clampToZone();
        if (dist < S.reach && this.cool <= 0) {
          this.setState("windup");
          this.target.set(this.pos.x + (dx / (dist || 1)) * Math.min(1.1, dist), this.groundY, this.pos.z + (dz / (dist || 1)) * Math.min(1.1, dist));
          if (S.type === "slam") this.target.set(pp.x, this.groundAt(pp), pp.z);
          ev.push({ type: "warn", e: this });
        }
        if (this.st > 4) this.setState("patrol");
        break;
      }
      case "aim": {
        // 멀리서 쏘는 적: 주인공 쪽을 보고 예고
        face(dx, dz);
        if (!sees) {
          this.setState("patrol");
          break;
        }
        this.setState("windup");
        if (S.type === "dive") this.target.set(pp.x, this.groundAt(pp), pp.z);
        else if (S.type === "lob") this.target.set(pp.x, this.groundAt(pp), pp.z);
        ev.push({ type: "warn", e: this });
        break;
      }
      case "windup": {
        const k = this.st / S.windup;
        bang = true;
        if (S.type === "lunge" || S.type === "smash") {
          ring = k;
          ringR = S.type === "smash" ? 1.9 : 1.35;
          ringAt = this.target;
        } else if (S.type === "dive" || S.type === "lob") {
          ring = k;
          ringR = 1.15;
          ringAt = this.target;
          if (S.type === "dive") face(this.target.x - this.pos.x, this.target.z - this.pos.z);
        } else if (S.type === "slam") {
          ring = k;
          ringR = 1.4;
          ringAt = this.target;
        } else if (S.type === "shoot") face(dx, dz);
        if (k >= 1) {
          this.setState("attack");
          this.from = this.pos.clone();
          this.hitDone = false;
          if (S.type === "shoot") {
            const c = this.center();
            const tgt = V(pp.x, pp.y + 0.5, pp.z);
            ev.push({ type: "shoot", from: c, to: tgt, kind: "bubble" });
          } else if (S.type === "lob") {
            ev.push({ type: "shoot", from: this.center(), to: this.target.clone(), kind: "fireball" });
          }
        }
        break;
      }
      case "attack": {
        const dur = S.type === "lunge" ? 0.25 : S.type === "dive" ? 0.4 : S.type === "slam" ? 0.45 : S.type === "smash" ? 0.18 : 0.2;
        const k = Math.min(1, this.st / dur);
        if (S.type === "lunge") {
          this.pos.lerpVectors(this.from, V(this.target.x, this.pos.y, this.target.z), k);
          ring = 1;
          ringR = 1.35;
          ringAt = this.target;
          if (!this.hitDone && k > 0.5 && Math.hypot(pp.x - this.target.x, pp.z - this.target.z) < 1.35 && Math.abs(pp.y - this.groundY) < 1.2) {
            this.hitDone = true;
            ev.push({ type: "hurt", from: this.pos.clone() });
          }
        } else if (S.type === "dive" || S.type === "slam") {
          const tx = this.from.x + (this.target.x - this.from.x) * k;
          const tz = this.from.z + (this.target.z - this.from.z) * k;
          this.pos.x = tx;
          this.pos.z = tz;
          const base = this.groundY + (S.type === "dive" ? S.hover * (1 - k) : 0);
          hoverY = S.type === "dive" ? S.hover * (1 - k) : Math.sin(k * Math.PI) * 1.6;
          ring = 1;
          ringR = S.type === "dive" ? 1.15 : 1.4;
          ringAt = this.target;
          if (k >= 1 && !this.hitDone) {
            this.hitDone = true;
            this.groundY = this.target.y;
            ev.push({ type: "impact", p: this.target.clone(), e: this });
            if (Math.hypot(pp.x - this.target.x, pp.z - this.target.z) < ringR && Math.abs(pp.y - this.target.y) < 1.3) ev.push({ type: "hurt", from: this.target.clone() });
          }
          void base;
        } else if (S.type === "smash") {
          ring = 1;
          ringR = 1.9;
          ringAt = this.target;
          if (!this.hitDone && k >= 1) {
            this.hitDone = true;
            ev.push({ type: "impact", p: this.target.clone(), e: this });
            if (Math.hypot(pp.x - this.target.x, pp.z - this.target.z) < 1.9 && Math.abs(pp.y - this.groundY) < 1.3) ev.push({ type: "hurt", from: this.pos.clone() });
          }
        }
        if (k >= 1) {
          this.setState("recover");
          this.cool = 0.8;
        }
        break;
      }
      case "recover": {
        diz = true;
        if (S.type === "dive") hoverY = 0;
        if (this.st >= S.recover) {
          this.setState(S.type === "dive" ? "rise" : "patrol");
          this.cool = 0.9;
        }
        break;
      }
      case "rise": {
        const k = Math.min(1, this.st / 0.6);
        hoverY = S.hover * k;
        if (k >= 1) this.setState("patrol");
        break;
      }
      case "stun": {
        diz = true;
        if (S.type === "dive") hoverY = Math.min(S.hover, this.pos.y - this.groundY);
        if (this.st > 0.7) this.setState(S.type === "dive" ? "rise" : "patrol");
        break;
      }
      case "knock": {
        // 맞고 뒤로 밀림
        const k = Math.min(1, this.st / 0.25);
        this.pos.x += this.kb.x * dt * (1 - k) * 6;
        this.pos.z += this.kb.z * dt * (1 - k) * 6;
        diz = true;
        if (k >= 1) this.setState("stun");
        break;
      }
    }
    // 땅 높이 따라가기 (걷는 적)
    if (S.hover === 0 || S.type === "dive") {
      const gy = this.groundAt(V(this.pos.x, this.pos.y + 1, this.pos.z));
      if (S.type !== "dive" && S.type !== "slam") this.groundY = gy;
      else if (this.state === "patrol" || this.state === "rise") this.groundY = gy;
    }
    const bob = S.hover > 0 ? Math.sin(this.t * 3) * 0.12 : 0;
    this.pos.y = this.groundY + hoverY + (this.state === "attack" && S.type === "slam" ? 0 : bob);
    // 몸에 닿으면 살짝 밀기 (공격이 아니면 아프지 않음)
    if (!P.dead && dist < S.radius + 0.35 && Math.abs(pp.y - this.pos.y) < 1.2) ev.push({ type: "bump", from: this.pos.clone() });
    // 표시
    this.flash = Math.max(0, this.flash - dt);
    this.place(ring, ringR, ringAt, bang, diz);
    return ev;
  }

  place(ring = 0, ringR = 1.3, ringAt = null, bang = false, diz = false) {
    const g = this.mesh;
    g.position.copy(this.pos);
    g.rotation.y = this.yaw;
    const p = this.parts;
    const t = this.t;
    const S = this.S;
    // 동작
    if (p.wings) for (const [i, w] of p.wings.entries()) w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * (this.kind === "bat" ? 20 : 16)) * 0.6);
    if (p.legs) p.legs.forEach((l, i) => (l.position.y = 0.1 + Math.max(0, Math.sin(t * 12 + i * Math.PI)) * 0.06 * (this.state === "patrol" || this.state === "chase" ? 1 : 0)));
    if (p.tail) p.tail.rotation.y = Math.sin(t * 6) * 0.4 + (this.state === "windup" ? Math.sin(t * 30) * 0.4 : 0);
    if (this.kind === "lizard" && p.head) p.head.rotation.x = this.state === "windup" ? -0.3 : 0;
    if (this.kind === "spirit") p.body.scale.set(1 + Math.sin(t * 10) * 0.05, 1 + Math.sin(t * 13) * 0.08 + (this.state === "windup" ? 0.25 * (this.st / S.windup) : 0), 1);
    if (this.kind === "slime") {
      const sq = this.state === "windup" ? 0.75 : this.state === "recover" ? 0.6 : 1 + Math.sin(t * 5) * 0.06;
      p.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }
    if (this.kind === "guard" && p.arms) {
      const up = this.state === "windup" ? -2.6 * Math.min(1, this.st / 0.4) : this.state === "attack" ? 0.3 : Math.sin(t * 3) * 0.15;
      p.arms.forEach((a) => (a.rotation.x = up));
      p.body.position.y = this.state === "patrol" || this.state === "chase" ? Math.abs(Math.sin(t * 6)) * 0.05 : 0;
    }
    if (this.kind === "minidragon" && this.state === "windup") p.body.scale.setScalar(1 + (this.st / S.windup) * 0.2);
    else if (this.kind === "minidragon") p.body.scale.setScalar(1);
    // 맞은 순간 하얗게 반짝 (크기로 통통)
    const pop = this.flash > 0 ? 1 + this.flash * 1.2 : 1;
    if (this.kind !== "slime" && this.kind !== "spirit") p.body.scale.setScalar(pop * (this.kind === "minidragon" && this.state === "windup" ? 1 + (this.st / S.windup) * 0.2 : 1));
    // 예고 고리
    const R = this.ring;
    if (ring > 0 && ringAt) {
      R.position.set(ringAt.x, ringAt.y + 0.05, ringAt.z);
      R.scale.setScalar(ringR);
      R.material.opacity = 0.55 + Math.sin(t * 22) * 0.3;
      this.fill.position.set(ringAt.x, ringAt.y + 0.04, ringAt.z);
      this.fill.scale.setScalar(ringR * Math.min(1, ring));
      this.fill.material.opacity = 0.18 + 0.2 * Math.min(1, ring);
    } else {
      R.material.opacity = 0;
      this.fill.material.opacity = 0;
    }
    const top = this.pos.y + (this.kind === "guard" ? 2.0 : this.kind === "slime" ? 1.1 : 0.95);
    this.bang.visible = bang;
    if (bang) {
      this.bang.position.set(this.pos.x, top + 0.2 + Math.abs(Math.sin(t * 10)) * 0.1, this.pos.z);
    }
    this.dizzy.visible = diz;
    if (diz) {
      this.dizzy.position.set(this.pos.x, top + 0.05, this.pos.z);
      this.dizzy.material.rotation = t * 3;
    }
  }

  /** 방망이에 맞음 → 'hit' | 'defeat' | null */
  hit(from) {
    if (!this.hittable) return null;
    this.hp -= 1;
    this.flash = 0.25;
    if (this.hp <= 0) {
      this.setState("dead");
      this.ring.material.opacity = 0;
      this.fill.material.opacity = 0;
      this.bang.visible = false;
      this.dizzy.visible = false;
      return "defeat";
    }
    let dx = this.pos.x - from.x;
    let dz = this.pos.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    this.kb = { x: dx / d, z: dz / d };
    this.setState("knock");
    this.cool = 1.2;
    return "hit";
  }
  dispose() {
    for (const o of [this.mesh, this.ring, this.fill, this.bang, this.dizzy]) this.root.remove(o);
    this.mesh.traverse((o) => {
      if (o.isMesh && o.geometry) o.geometry.dispose();
    });
    this.ring.geometry.dispose();
    this.fill.geometry.dispose();
  }
}

/* ================================================================
 * 날아가는 것 (물방울 · 불덩이) — 방망이로 치면 사라진다
 * ============================================================== */
export class Projectiles {
  constructor(root, fx) {
    this.root = root;
    this.fx = fx;
    this.list = [];
    this.mats = {
      bubble: new THREE.MeshStandardMaterial({ color: "#9ae8ff", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75, emissive: "#3aa8e8", emissiveIntensity: 0.3 }),
      fireball: new THREE.MeshStandardMaterial({ color: "#ffb04a", emissive: "#ff6a10", emissiveIntensity: 1.5, roughness: 0.4 }),
      rock: new THREE.MeshStandardMaterial({ color: "#8a8a7a", roughness: 0.9 }),
    };
    this.geo = new THREE.SphereGeometry(1, 16, 12);
  }
  /** kind: bubble(곧게) · fireball(포물선, 바닥 표시) */
  spawn(kind, from, to) {
    const m = new THREE.Mesh(this.geo, this.mats[kind] || this.mats.rock);
    const r = kind === "bubble" ? 0.32 : 0.36;
    m.scale.setScalar(r);
    m.castShadow = true;
    m.position.copy(from);
    this.root.add(m);
    const o = { kind, m, r, life: 0, from: from.clone(), to: to.clone() };
    if (kind === "bubble") {
      const d = new THREE.Vector3().subVectors(to, from);
      d.y = Math.max(-0.2, Math.min(0.2, d.y));
      o.vel = d.normalize().multiplyScalar(5.2);
      o.max = 2.6;
    } else {
      o.dur = 1.0;
      o.max = 1.0;
      // 떨어질 곳 표시
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 30), new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: 0.6, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(to.x, to.y + 0.05, to.z);
      ring.scale.setScalar(1.0);
      this.root.add(ring);
      o.ring = ring;
    }
    this.list.push(o);
    return o;
  }
  /** @returns 맞은 것 [{from}] */
  update(dt, P, level) {
    const hurt = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      o.life += dt;
      let done = o.life >= o.max;
      if (o.kind === "bubble") {
        o.m.position.addScaledVector(o.vel, dt);
        o.m.scale.setScalar(o.r * (1 + Math.sin(o.life * 12) * 0.08));
        if (!P.dead && o.m.position.distanceTo(V(P.pos.x, P.pos.y + 0.5, P.pos.z)) < o.r + 0.4) {
          hurt.push({ from: o.m.position.clone() });
          done = true;
        }
      } else {
        const k = Math.min(1, o.life / o.dur);
        o.m.position.lerpVectors(o.from, o.to, k);
        o.m.position.y += Math.sin(k * Math.PI) * 2.4;
        if (o.ring) o.ring.material.opacity = 0.4 + Math.sin(o.life * 20) * 0.25;
        if (k >= 1) {
          this.fx.puff(o.to.x, o.to.y, o.to.z, 1, 4);
          this.fx.sparkle(o.to.clone().setY(o.to.y + 0.3), 10, ["#ffb04a", "#ff6a2a"]);
          if (!P.dead && Math.hypot(P.pos.x - o.to.x, P.pos.z - o.to.z) < 1.05 && Math.abs(P.pos.y - o.to.y) < 1.2) hurt.push({ from: o.to.clone() });
          done = true;
        }
      }
      if (done) this.remove(i);
    }
    return hurt;
  }
  /** 방망이에 맞은 날아오는 것 지우기 */
  batHit(origin, fwd, reach) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      const p = o.m.position;
      const dx = p.x - origin.x;
      const dz = p.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d < reach + o.r && Math.abs(p.y - (origin.y + 0.6)) < 1.4 && (d < 0.6 || (dx * fwd.x + dz * fwd.z) / d > 0.2)) {
        this.fx.hitSpark(p.clone(), o.kind === "bubble" ? ["#ffffff", "#9ae8ff"] : ["#ffe27a", "#ff8a2a"]);
        this.remove(i);
        n++;
      }
    }
    return n;
  }
  remove(i) {
    const o = this.list[i];
    this.root.remove(o.m);
    if (o.ring) {
      this.root.remove(o.ring);
      o.ring.geometry.dispose();
      o.ring.material.dispose();
    }
    this.list.splice(i, 1);
  }
  clear() {
    for (let i = this.list.length - 1; i >= 0; i--) this.remove(i);
  }
}
