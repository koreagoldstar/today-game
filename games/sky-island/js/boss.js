/*
 * 하늘섬 대탈출 · 최종 보스 '고대 기계 용'
 *
 *  흐름: 숨어 있음 → (다리 위) 추격: 옆에서 날며 불덩이 (바닥 원 표시) → 아레나 아래로 숨음
 *        → 아레나에 들어서면 등장 연출 (솟아오름 · 포효) → 싸움 (3단계) → 쓰러짐 연출 → 성문 열림
 *
 *  공격 (모두 미리 알림이 있다):
 *   · 불 뿜기   : 바닥에 빨간 길이 주인공을 따라오다 멈춤 → 불 (옆으로 대시해서 피하기)
 *   · 꼬리 휩쓸기: 바닥에 휩쓸 자리 표시 → 낮게 휩씀 (점프로 넘기)
 *   · 발톱 내려찍기 (2단계~): 주인공 자리에 그림자 원 → 쾅 + 퍼지는 충격파 (점프로 넘기)
 *   · 불덩이 비 (3단계)   : 주인공 둘레에 원 여러 개 → 떨어짐 (원 밖으로)
 *  불 뿜기 · 내려찍기 뒤에는 지쳐서 머리를 바닥에 내려놓는다 → 이마의 수정(약점)이 열림
 *   → 대시로 머리에 부딪히거나 위에서 밟으면 체력 -1. 체력 6 = 3단계 × 2.
 *  주인공을 보고 움직인다: 머리는 늘 주인공을 바라보고, 주인공 쪽으로 자리를 옮기고,
 *  가까이 있으면 꼬리, 멀리 있으면 불을 쓴다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { roundedBox, taperTube, shadeVerts, mergeByMaterial } from "./geo.js?v=1";
import { dotTex } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
const UP = V(0, 1, 0);
const FWD = V(0, 0, 1);

function glow(color, s, op = 0.8) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.setScalar(s);
  return sp;
}
function warnDisc(r, color) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
  ring.rotation.x = fill.rotation.x = -Math.PI / 2;
  ring.renderOrder = fill.renderOrder = 3;
  g.add(fill, ring);
  g.set = (k, on = true) => {
    ring.material.opacity = on ? 0.9 : 0;
    fill.material.opacity = on ? 0.2 + k * 0.32 : 0;
    fill.scale.setScalar(on ? Math.max(0.05, k) : 0.01);
  };
  g.set(0, false);
  g.userData.noCull = true;
  return g;
}
/** 두 마디 팔 (어깨 a → 끝 t): 팔꿈치 위치 */
function ik2(a, t, l1, l2, pole) {
  const d = t.clone().sub(a);
  const L = clamp(d.length(), 0.2, l1 + l2 - 0.02);
  const dir = d.normalize();
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const pv = pole.clone().sub(a);
  pv.addScaledVector(dir, -pv.dot(dir));
  if (pv.lengthSq() < 1e-6) pv.set(0, 1, 0);
  pv.normalize();
  return { elbow: a.clone().addScaledVector(dir, x).addScaledVector(pv, h), end: a.clone().addScaledVector(dir, L) };
}
/** 단위 길이 뼈(+y 방향)를 a → b 로 놓기 */
function placeBone(m, a, b, w = 1) {
  const d = b.clone().sub(a);
  const L = d.length() || 0.001;
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(UP, d.divideScalar(L));
  m.scale.set(w, L, w);
}
const _m4 = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
/** 인스턴스 하나: 위치 p, 앞 방향 fwd, 크기 s */
function setInst(im, i, p, fwd, s) {
  _z.copy(fwd).normalize();
  _x.crossVectors(UP, _z);
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0);
  _x.normalize();
  _y.crossVectors(_z, _x);
  _m4.makeBasis(_x.multiplyScalar(s), _y.multiplyScalar(s), _z.multiplyScalar(s));
  _m4.setPosition(p);
  im.setMatrixAt(i, _m4);
}
const SC = 1.35; // 몸통 · 날개 · 다리 크기
const HS = 1.3; // 머리 크기
function bez3(a, b, c, d, t, out = V()) {
  const u = 1 - t;
  const k0 = u * u * u;
  const k1 = 3 * u * u * t;
  const k2 = 3 * u * t * t;
  const k3 = t * t * t;
  return out.set(k0 * a.x + k1 * b.x + k2 * c.x + k3 * d.x, k0 * a.y + k1 * b.y + k2 * c.y + k3 * d.y, k0 * a.z + k1 * b.z + k2 * c.z + k3 * d.z);
}
function bez(a, b, c, t, out = V()) {
  const u = 1 - t;
  return out.set(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z);
}

/* ================================================================
 * 에너지 성문 (보스를 쓰러뜨리면 열림)
 * ============================================================== */
export class EnergyGate {
  /** axis "x": 문이 x 방향으로 걸쳐 있음(앞뒤로 지나감) · "z": z 방향으로 걸쳐 있음(옆으로 지나감) */
  constructor(c, x, y, z, w = 4.2, { axis = "x" } = {}) {
    const M = c.M;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (axis === "z") g.rotation.y = Math.PI / 2;
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(shadeVerts(roundedBox(0.9, 5.2, 0.9, 0.12), { bottom: 0.5 }), M.stone);
      p.position.set((s * (w + 0.9)) / 2, 2.6, 0);
      g.add(p);
      const cap = new THREE.Mesh(shadeVerts(new THREE.ConeGeometry(0.8, 1.4, 4), { bottom: 0.7 }), M.roof);
      cap.position.set((s * (w + 0.9)) / 2, 5.9, 0);
      cap.rotation.y = Math.PI / 4;
      g.add(cap);
    }
    const lintel = new THREE.Mesh(shadeVerts(roundedBox(w + 2.4, 0.8, 1.0, 0.14), { bottom: 0.6 }), M.stone);
    lintel.position.y = 5.3;
    g.add(lintel);
    const emb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), M.brass);
    emb.position.set(0, 5.3, 0.55);
    g.add(emb);
    const frame = mergeByMaterial(g);
    frame.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
    c.root.add(frame);
    // 빛 장막
    this.mat = new THREE.MeshBasicMaterial({ color: "#ff6a4a", transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.9, 1, 1), this.mat);
    this.wall.position.set(x, y + 2.45, z);
    if (axis === "z") this.wall.rotation.y = Math.PI / 2;
    this.wall.userData.noCull = true;
    c.root.add(this.wall);
    const ax = axis === "z" ? 0.25 : w / 2;
    const az = axis === "z" ? w / 2 : 0.25;
    this.solid = c.box(x - ax, x + ax, y, y + 5, z - az, z + az);
    for (const s of [-1, 1]) {
      const px = axis === "z" ? x : x + (s * (w + 0.9)) / 2;
      const pz = axis === "z" ? z + (s * (w + 0.9)) / 2 : z;
      c.box(px - 0.45, px + 0.45, y, y + 5.2, pz - 0.45, pz + 0.45);
    }
    this.open = false;
    this.k = 0;
    this.t = 0;
    this.kind = "gate";
    c.mechs.push(this);
  }
  setOpen(v) {
    this.open = v;
    this.solid.active = !v;
  }
  update(dt) {
    this.t += dt;
    this.k = damp(this.k, this.open ? 1 : 0, 3, dt);
    this.mat.opacity = (0.35 + Math.sin(this.t * 6) * 0.08) * (1 - this.k);
    this.wall.visible = this.k < 0.98;
  }
  reset() {}
}

/* ================================================================
 * 고대 기계 용
 * ============================================================== */
export class MechaDragon {
  constructor(c, { arena, chase, gate, name = "고대 기계 용" }) {
    this.kind = "boss";
    this.c = c;
    this.fx = c.fx;
    this.name = name;
    this.A = V(arena.x, arena.y, arena.z);
    this.R = arena.r;
    this.chase = chase;
    this.gate = gate;
    this.maxHp = 6;
    this.hp = 6;
    this.phaseHp = 6;
    this.t = 0;
    this.mats();
    this.build();
    this.projectiles = [];
    this.makePools();
    this.reset(true);
    c.boss = this;
    c.camHint = (P) => this.camHint(P);
    c.mechs.push(this);
  }
  /* ---------------- 재질 ---------------- */
  mats() {
    this.m = {
      armor: new THREE.MeshStandardMaterial({ color: "#64628a", metalness: 0.6, roughness: 0.34, vertexColors: true }),
      under: new THREE.MeshStandardMaterial({ color: "#2c2634", metalness: 0.5, roughness: 0.5, vertexColors: true }),
      trim: new THREE.MeshStandardMaterial({ color: "#e0aa52", metalness: 0.85, roughness: 0.28, vertexColors: true }),
      glow: new THREE.MeshStandardMaterial({ color: "#ffb070", emissive: "#ff6a1a", emissiveIntensity: 2.0, roughness: 0.4 }),
      eye: new THREE.MeshStandardMaterial({ color: "#fff0a0", emissive: "#ffb020", emissiveIntensity: 3.0, roughness: 0.3 }),
      gem: new THREE.MeshStandardMaterial({ color: "#8afcff", emissive: "#20d8ff", emissiveIntensity: 1.2, roughness: 0.1, flatShading: true }),
      wing: new THREE.MeshStandardMaterial({ color: "#a83a50", emissive: "#5a1020", emissiveIntensity: 0.45, roughness: 0.65, side: THREE.DoubleSide, vertexColors: true }),
      tooth: new THREE.MeshStandardMaterial({ color: "#f4ead8", roughness: 0.5 }),
    };
  }
  /* ---------------- 모양 만들기 ---------------- */
  build() {
    const m = this.m;
    const P = (geo, mat, pos, rot, sc) => {
      const me = new THREE.Mesh(geo, mat);
      if (pos) me.position.set(...pos);
      if (rot) me.rotation.set(...rot);
      if (sc) me.scale.set(...sc);
      return me;
    };
    const root = new THREE.Group();
    root.userData.noCull = true;
    root.scale.setScalar(SC);
    this.root = root;
    this.c.root.add(root);
    // 몸통 (가슴 · 등 · 엉덩이 + 등 가시 + 빛나는 이음새 + 배기관)
    const body = new THREE.Group();
    const sv = (g, b = 0.55) => shadeVerts(g, { bottom: b });
    body.add(P(sv(new THREE.SphereGeometry(1, 28, 20)), m.armor, [0, 0.6, 1.1], null, [2.0, 1.6, 2.3]));
    body.add(P(sv(roundedBox(2.7, 1.6, 4.8, 0.7)), m.armor, [0, 0.7, -1.1]));
    body.add(P(sv(new THREE.SphereGeometry(1, 24, 16)), m.armor, [0, 0.35, -3.2], null, [1.7, 1.35, 1.9]));
    for (let i = 0; i < 6; i++) body.add(P(sv(roundedBox(1.7 - i * 0.12, 0.28, 0.75, 0.12)), m.under, [0, -0.85 + i * 0.05, 1.8 - i * 0.85], [0.12, 0, 0]));
    for (let i = 0; i < 9; i++) {
      const h = 1.0 - Math.abs(i - 3) * 0.1;
      body.add(P(sv(new THREE.ConeGeometry(0.28, h, 5), 0.7), m.trim, [0, 1.55 + (i < 6 ? 0.15 : -0.1 * (i - 5)), 2.2 - i * 0.68], [-0.5, 0, 0]));
    }
    for (const s of [-1, 1]) {
      body.add(P(new THREE.BoxGeometry(0.06, 0.09, 4.2), m.glow, [s * 1.37, 0.55, -0.9]));
      body.add(P(sv(roundedBox(0.2, 0.9, 3.6, 0.08)), m.trim, [s * 1.4, 0.95, -1.0]));
      const pipe = P(sv(new THREE.CylinderGeometry(0.22, 0.26, 1.4, 12)), m.trim, [s * 0.75, 1.55, -2.3], [-1.1, 0, s * 0.25]);
      body.add(pipe);
      body.add(P(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), m.glow, [s * 0.88, 1.85, -2.9], [-1.1, 0, s * 0.25]));
      // 뒷다리 (접혀 있음)
      body.add(P(sv(new THREE.SphereGeometry(1, 16, 12)), m.armor, [s * 1.35, -0.2, -3.0], null, [0.75, 1.0, 1.1]));
      body.add(P(sv(roundedBox(0.55, 1.4, 0.6, 0.2)), m.under, [s * 1.45, -1.2, -2.6], [0.5, 0, 0]));
      for (let k = 0; k < 3; k++) body.add(P(new THREE.ConeGeometry(0.1, 0.5, 5), m.trim, [s * 1.45 + (k - 1) * 0.18, -1.85, -2.05], [1.4, 0, 0]));
    }
    this.body = mergeByMaterial(body);
    root.add(this.body);
    // 날개
    this.wings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 1.25, 1.75, 0.5);
      w.scale.setScalar(1.25);
      const elbow = V(s * 3.3, 1.4, -0.5);
      const wrist = V(s * 6.2, 0.6, -1.3);
      const tips = [V(s * 9.4, 2.0, -1.8), V(s * 10.2, -0.1, -2.9), V(s * 9.2, -1.8, -4.0), V(s * 7.0, -2.5, -4.5)];
      const attach = V(s * 0.2, -0.9, -3.2);
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(taperTube([V(0, 0, 0), elbow, wrist], (t) => 0.32 - t * 0.14, 20, 8), m.armor));
      for (const tp of tips) grp.add(new THREE.Mesh(taperTube([wrist, wrist.clone().lerp(tp, 0.5).add(V(0, 0.25, 0)), tp], (t) => 0.13 * (1 - t * 0.7), 12, 6), m.trim));
      grp.add(P(new THREE.SphereGeometry(0.3, 12, 8), m.trim, [elbow.x, elbow.y, elbow.z]));
      grp.add(P(new THREE.SphereGeometry(0.26, 12, 8), m.glow, [wrist.x, wrist.y, wrist.z]));
      grp.add(P(new THREE.ConeGeometry(0.16, 0.7, 6), m.trim, [wrist.x, wrist.y + 0.5, wrist.z], [0, 0, -s * 0.3]));
      // 날개막 (가장자리가 오목하게)
      const pos = [];
      const tri = (a, b, cc) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, cc.x, cc.y, cc.z);
      tri(V(0, 0, 0), elbow, wrist);
      tri(V(0, 0, 0), wrist, attach);
      for (let i = 0; i < tips.length - 1; i++) {
        const mid = tips[i].clone().lerp(tips[i + 1], 0.5).lerp(wrist, 0.22);
        tri(wrist, tips[i], mid);
        tri(wrist, mid, tips[i + 1]);
      }
      const midL = tips[3].clone().lerp(attach, 0.5).lerp(wrist, 0.2);
      tri(wrist, tips[3], midL);
      tri(wrist, midL, attach);
      const mg = new THREE.BufferGeometry();
      mg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      mg.computeVertexNormals();
      shadeVerts(mg, { bottom: 0.55 });
      grp.add(new THREE.Mesh(mg, m.wing));
      w.add(mergeByMaterial(grp));
      root.add(w);
      this.wings.push({ g: w, s });
    }
    // 앞다리 (어깨 → 팔꿈치 → 발톱): 뼈 두 개 + 발톱
    this.legs = [];
    const boneGeo = sv(new THREE.CylinderGeometry(0.34, 0.42, 1, 12, 1).translate(0, 0.5, 0));
    const boneGeo2 = sv(new THREE.CylinderGeometry(0.24, 0.34, 1, 12, 1).translate(0, 0.5, 0));
    for (const s of [-1, 1]) {
      const up = new THREE.Mesh(boneGeo, m.armor);
      const lo = new THREE.Mesh(boneGeo2, m.armor);
      const joint = new THREE.Mesh(sv(new THREE.SphereGeometry(0.42, 14, 10), 0.7), m.trim);
      const claw = new THREE.Group();
      claw.add(P(sv(roundedBox(0.8, 0.45, 0.9, 0.18)), m.under, [0, 0.1, 0.2]));
      for (let k = 0; k < 3; k++) {
        const cl = new THREE.Mesh(taperTube([V(0, 0, 0), V(0, -0.12, 0.45), V(0, -0.45, 0.75)], (t) => 0.12 * (1 - t * 0.85), 8, 6), m.tooth);
        cl.position.set((k - 1) * 0.28, 0.05, 0.55);
        claw.add(cl);
      }
      claw.add(P(new THREE.SphereGeometry(0.14, 10, 8), m.glow, [0, 0.35, 0.1]));
      const cm = mergeByMaterial(claw);
      joint.scale.setScalar(SC);
      cm.scale.setScalar(SC);
      for (const o of [up, lo, joint, cm]) {
        o.userData.noCull = true;
        this.c.root.add(o);
      }
      this.legs.push({ s, up, lo, joint, claw: cm, target: V(), cur: V(), l1: 2.7 * SC, l2: 2.8 * SC });
    }
    // 목 · 꼬리 마디 (인스턴스)
    const segGeo = sv(roundedBox(1.0, 0.9, 0.95, 0.3));
    const spikeGeo = sv(new THREE.ConeGeometry(0.2, 0.7, 5).rotateX(-0.6).translate(0, 0.6, -0.15), 0.7);
    this.neckN = 12;
    this.tailN = 14;
    const n = this.neckN + this.tailN;
    this.segs = new THREE.InstancedMesh(segGeo, m.armor, n);
    this.spikes = new THREE.InstancedMesh(spikeGeo, m.trim, n);
    this.rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.52, 0.045, 6, 18), m.glow, n);
    for (const im of [this.segs, this.spikes, this.rings]) {
      im.frustumCulled = false;
      im.castShadow = true;
      im.userData.noCull = true;
      this.c.root.add(im);
    }
    // 꼬리 끝 날 (스페이드)
    const tip = new THREE.Group();
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(0.9, 0.4, 0.2, 1.6);
    sh.lineTo(0, 1.2);
    sh.lineTo(-0.2, 1.6);
    sh.quadraticCurveTo(-0.9, 0.4, 0, 0);
    const blade = new THREE.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
    blade.translate(0, 0, -0.07);
    blade.rotateX(Math.PI / 2);
    tip.add(new THREE.Mesh(blade, m.trim));
    tip.add(P(new THREE.SphereGeometry(0.16, 10, 8), m.glow, [0, 0, 0.4]));
    this.tailTip = mergeByMaterial(tip);
    this.tailTip.userData.noCull = true;
    this.c.root.add(this.tailTip);
    // 머리
    const head = new THREE.Group();
    const hd = new THREE.Group();
    hd.add(P(sv(roundedBox(1.55, 1.05, 1.9, 0.38)), m.armor, [0, 0.15, 0]));
    hd.add(P(sv(roundedBox(1.15, 0.62, 1.6, 0.26)), m.armor, [0, 0.0, 1.35]));
    hd.add(P(sv(roundedBox(0.9, 0.16, 0.5, 0.06)), m.trim, [0, 0.33, 2.0]));
    for (const s of [-1, 1]) {
      hd.add(P(sv(roundedBox(0.75, 0.2, 1.0, 0.08)), m.trim, [s * 0.42, 0.66, 0.42], [-0.18, 0, s * 0.28]));
      hd.add(P(new THREE.SphereGeometry(0.17, 14, 10), m.eye, [s * 0.55, 0.36, 0.8]));
      hd.add(new THREE.Mesh(taperTube([V(s * 0.5, 0.55, -0.4), V(s * 0.8, 1.05, -1.15), V(s * 0.95, 1.2, -2.05)], (t) => 0.18 * (1 - t * 0.85), 14, 8), m.trim));
      hd.add(P(sv(roundedBox(0.08, 0.6, 0.95, 0.03)), m.trim, [s * 0.82, 0.05, -0.25], [0, s * 0.35, 0]));
      hd.add(P(new THREE.SphereGeometry(0.07, 8, 6), m.glow, [s * 0.25, 0.12, 2.12]));
      for (let k = 0; k < 4; k++) hd.add(P(new THREE.ConeGeometry(0.07, 0.26, 5), m.tooth, [s * (0.42 - k * 0.02), -0.36, 0.95 + k * 0.3], [Math.PI, 0, 0]));
    }
    // 이마 수정 (약점) + 덮개
    this.gem = P(new THREE.OctahedronGeometry(0.34, 0), m.gem, [0, 0.82, 0.62], null, [1, 1.25, 1]);
    this.gemGlow = glow("#5af0ff", 0.1, 0.9);
    this.gemGlow.position.set(0, 0.85, 0.66);
    this.shutters = [-1, 1].map((s) => P(sv(roundedBox(0.42, 0.14, 0.82, 0.05)), m.trim, [s * 0.22, 0.86, 0.6]));
    this.mouthGlow = glow("#ff7a2a", 0.1, 0.9);
    this.mouthGlow.position.set(0, -0.28, 1.55);
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.32, 0.15);
    const jw = new THREE.Group();
    jw.add(P(sv(roundedBox(1.0, 0.34, 1.9, 0.14)), m.armor, [0, -0.15, 1.0]));
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) jw.add(P(new THREE.ConeGeometry(0.06, 0.22, 5), m.tooth, [s * 0.36, 0.08, 0.6 + k * 0.33]));
    jw.add(P(new THREE.BoxGeometry(0.6, 0.05, 1.3), m.glow, [0, 0.02, 1.0]));
    jaw.add(mergeByMaterial(jw));
    head.add(mergeByMaterial(hd), this.gem, this.gemGlow, ...this.shutters, this.mouthGlow, jaw);
    this.eyeGlows = [-1, 1].map((s) => {
      const e = glow("#ffcc4a", 0.8, 0.9);
      e.position.set(s * 0.58, 0.38, 0.86);
      head.add(e);
      return e;
    });
    head.scale.setScalar(HS);
    head.userData.noCull = true;
    head.traverse((o) => o.isMesh && (o.castShadow = true));
    this.c.root.add(head);
    this.head = head;
    this.jaw = jaw;
    root.traverse((o) => o.isMesh && (o.castShadow = true));
    // 머리 위 · 아래 충돌 (지쳐서 내려놓았을 때만)
    this.headSolid = this.c.box(0, 0, 0, 0, 0, 0, { boss: true });
    this.headSolid.active = false;
  }
  makePools() {
    // 불 뿜기: 바닥 빨간 길 + 불꽃 기둥
    this.lane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: "#ff3a1a", transparent: true, opacity: 0, depthWrite: false }));
    this.lane.rotation.x = -Math.PI / 2;
    this.lane.renderOrder = 3;
    this.lane.userData.noCull = true;
    this.c.root.add(this.lane);
    const fg = new THREE.CylinderGeometry(0.35, 1.25, 1, 16, 1, true).translate(0, 0.5, 0);
    this.flame = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: "#ffa04a", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.flame2 = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: "#fff0a0", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.flame2.scale.set(0.45, 1, 0.45);
    for (const f of [this.flame, this.flame2]) {
      f.userData.noCull = true;
      this.c.root.add(f);
    }
    // 꼬리 휩쓸기 경고: 부채꼴
    this.sweepMark = new THREE.Mesh(new THREE.RingGeometry(1, 2, 48, 1, 0, 1), new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.sweepMark.rotation.x = -Math.PI / 2;
    this.sweepMark.renderOrder = 3;
    this.sweepMark.userData.noCull = true;
    this.c.root.add(this.sweepMark);
    // 충격파 고리
    this.wave = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 8, 64), new THREE.MeshBasicMaterial({ color: "#ffb07a", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.wave.rotation.x = Math.PI / 2;
    this.wave.userData.noCull = true;
    this.c.root.add(this.wave);
    this.waveR = -1;
    // 불덩이 (추격 · 불덩이 비)
    this.balls = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), new THREE.MeshStandardMaterial({ color: "#ffc070", emissive: "#ff5a1a", emissiveIntensity: 2.4 })));
      g.add(glow("#ff7a2a", 2.6, 0.85));
      g.visible = false;
      g.userData.noCull = true;
      this.c.root.add(g);
      const mk = warnDisc(1.6, "#ff5a2a");
      this.c.root.add(mk);
      this.balls.push({ g, mk, on: false, t: 0, dur: 1, a: V(), b: V(), h: 4 });
    }
    // 내려찍기 그림자
    this.slamMark = warnDisc(2.6, "#ff3a2a");
    this.c.root.add(this.slamMark);
  }

  /* ---------------- 상태 ---------------- */
  reset(first = false) {
    if (this.gate) this.gate.setOpen(!!this.dead && !first);
    // 체크포인트에서 다시: 지금 단계의 처음 체력으로 (처음부터는 아님)
    if (first || !this.started) {
      this.hp = this.maxHp;
      this.phaseHp = this.maxHp;
      this.started = false;
      this.dead = false;
      this.go(this.chase ? "away" : "dormant");
      this.chased = false;
    } else if (!this.dead) {
      this.hp = this.phaseHp;
      this.go("idle");
      this.st = -1.2; // 다시 시작하면 잠깐 숨 돌릴 틈
    }
    this.queue = [];
    this.waveR = -1;
    this.wave.material.opacity = 0;
    this.lane.material.opacity = 0;
    this.flame.material.opacity = this.flame2.material.opacity = 0;
    this.sweepMark.material.opacity = 0;
    this.slamMark.set(0, false);
    this.headSolid.active = false;
    this.gemOpen = 0;
    for (const b of this.balls) {
      b.on = false;
      b.g.visible = false;
      b.mk.set(0, false);
    }
    this.phi = Math.PI;
    if (this.state === "idle" || this.state === "dormant") this.placeHome(true);
  }
  get phase() {
    return this.hp > 4 ? 0 : this.hp > 2 ? 1 : 2;
  }
  get fighting() {
    return this.started && !this.dead;
  }
  barInfo() {
    return this.fighting ? { name: this.name, hp: this.hp, max: this.maxHp } : null;
  }
  go(s) {
    this.state = s;
    this.st = 0;
  }
  /** 아레나 가장자리 점 (각도 phi, 0 = +z) */
  rim(phi, r = this.R) {
    return V(this.A.x + Math.sin(phi) * r, this.A.y, this.A.z + Math.cos(phi) * r);
  }
  /** 가장자리에서 안쪽으로 향하는 방향 */
  inward(phi) {
    return V(-Math.sin(phi), 0, -Math.cos(phi));
  }
  placeHome(snap = false) {
    const base = this.rim(this.phi, this.R + 5.6);
    base.y = this.A.y + 0.3;
    this.bodyPos = this.bodyPos || V();
    if (snap) this.bodyPos.copy(base);
    this.homeBase = base;
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  update(dt, P, ev, playing) {
    this.t += dt;
    this.st += dt;
    const s = this.state;
    const ph = this.phase;
    this.ev = ev;
    this.P = P;
    // 주인공 위치 (없으면 아레나 가운데)
    const pp = P ? P.pos : this.A;
    let headTarget = null; // 머리가 갈 곳
    let lookAt = pp.clone().setY(pp.y + 0.8);
    let jawOpen = 0.05 + Math.sin(this.t * 1.7) * 0.03;
    let flap = 0.5;
    let wingOpen = 1;
    let mouth = 0;
    this.gemOpen = damp(this.gemOpen, s === "tired" ? 1 : 0, 6, dt);
    const fightIdle = () => {
      // 주인공 반대편 (먼 쪽 반원 안)으로 자리를 옮긴다
      const pPhi = Math.atan2(pp.x - this.A.x, pp.z - this.A.z);
      let want = pPhi + Math.PI;
      want = Math.atan2(Math.sin(want), Math.cos(want));
      if (want < 0) want += TAU;
      want = clamp(want, Math.PI - 0.85, Math.PI + 0.85);
      this.phi = damp(this.phi, want, 1.4, dt);
      this.placeHome();
      this.bodyPos.lerp(this.homeBase, 1 - Math.exp(-dt * 3));
      this.bodyPos.y = this.homeBase.y + Math.sin(this.t * 1.6) * 0.3;
    };
    const headHome = () => this.rim(this.phi, this.R - 2.2).setY(this.A.y + 6.4 + Math.sin(this.t * 1.3) * 0.25);
    switch (s) {
      /* ---------- 숨어 있음 / 추격 ---------- */
      case "away": {
        this.root.visible = false;
        this.setVisible(false);
        // 추격 다리를 이미 지나 있으면 (아레나 앞 체크포인트에서 다시 시작 등) 바로 아레나에서 기다린다
        if (P && this.chase && P.pos.z < this.chase.z1) {
          this.go("dormant");
          break;
        }
        if (P && playing && this.chase && P.pos.z < this.chase.z0 && P.pos.z > this.chase.z1) {
          this.go("chaseIn");
          this.chased = true;
          ev.push({ type: "sfx", name: "roar" });
          ev.push({ type: "shake", k: 0.5 });
          ev.push({ type: "banner", k: "경고!", h: "고대 기계 용이 쫓아온다!", t: "바닥에 빨간 원이 생기면 멈추지 말고 달려요", dur: 2.2, kind: "danger" });
        }
        break;
      }
      case "chaseIn":
      case "chase": {
        this.setVisible(true);
        const ch = this.chase;
        const k = s === "chaseIn" ? smooth(this.st / 1.6) : 1;
        const want = V(ch.x, ch.y + Math.sin(this.t * 1.4) * 0.8, pp.z - 2.5);
        const from = V(ch.x + 10, ch.y - 14, pp.z + 22);
        this.bodyPos = (this.bodyPos || V()).copy(from.lerp(want, k));
        this.yaw = Math.PI; // -z 쪽으로 날아감
        this.flying = true;
        flap = 1;
        headTarget = this.bodyPos.clone().add(V(-2.2, 2.4, -3.2));
        if (s === "chaseIn" && this.st > 1.6) this.go("chase");
        if (s === "chase") {
          this.fireT = (this.fireT ?? 1.2) - dt;
          if (this.fireT <= 0 && P && playing) {
            this.fireT = 2.2;
            // 지금 자리 + 조금 앞 (계속 달리면 피할 수 있게)
            const tgt = pp.clone().add(V(P.vel.x * 0.45, 0, P.vel.z * 0.45));
            tgt.x = clamp(tgt.x, ch.laneX - 1.2, ch.laneX + 1.2);
            tgt.y = ch.floorY(tgt.z);
            this.spit(this.mouthPos(), tgt, 1.15, 4);
            mouth = 1;
          }
          if (P && P.pos.z < ch.z1) {
            this.go("chaseOut");
            ev.push({ type: "sfx", name: "roar" });
          }
        }
        mouth = Math.max(mouth, this.fireT != null && this.fireT < 0.5 ? 1 - this.fireT * 2 : 0);
        break;
      }
      case "chaseOut": {
        // 앞으로 날아가 아레나 아래로 숨는다
        const k = smooth(this.st / 2.2);
        const a = V(this.chase.x, this.chase.y, pp.z - 2.5);
        const b = this.rim(Math.PI, this.R + 6).setY(this.A.y - 30);
        this.bodyPos.copy(a.lerp(b, k));
        this.yaw = Math.PI;
        flap = 1;
        headTarget = this.bodyPos.clone().add(V(0, 2.4 - k * 3, -3.5));
        if (this.st > 2.3) {
          this.go("dormant");
          this.setVisible(false);
        }
        break;
      }
      case "dormant": {
        this.setVisible(false);
        this.flying = false;
        if (P && playing && P.onGround && Math.hypot(P.pos.x - this.A.x, P.pos.z - this.A.z) < this.R - 2.5 && Math.abs(P.pos.y - this.A.y) < 1) {
          this.go("intro");
          this.phi = Math.PI;
          this.placeHome(true);
          ev.push({ type: "bossIntro" });
        }
        break;
      }
      /* ---------- 등장: 아레나 끝 아래에서 솟아올라 포효 ---------- */
      case "intro": {
        this.setVisible(true);
        const k = smooth(this.st / 2.2);
        this.bodyPos.copy(this.homeBase).add(V(0, -24 * (1 - k), 0));
        this.yaw = Math.atan2(this.A.x - this.bodyPos.x, this.A.z - this.bodyPos.z);
        flap = this.st < 2.4 ? 1.4 : 0.6;
        headTarget = headHome().add(V(0, -6 * (1 - k), 0));
        if (this.st > 2.3 && this.st < 3.5) {
          jawOpen = 0.75;
          mouth = 0.6;
          lookAt = this.rim(this.phi, -this.R).setY(this.A.y + 4);
          headTarget.y += 0.8;
        }
        if (this.st > 2.3 && !this.roared) {
          this.roared = true;
          ev.push({ type: "sfx", name: "roar" });
          ev.push({ type: "shake", k: 0.9 });
        }
        if (this.st > 3.7) {
          this.roared = false;
          this.started = true;
          this.go("idle");
          this.st = -0.6;
          ev.push({ type: "bossHp", info: this.barInfo() });
        }
        break;
      }
      /* ---------- 싸움 ---------- */
      case "idle": {
        fightIdle();
        headTarget = headHome();
        const wait = [1.5, 1.1, 0.85][ph];
        if (this.st > wait && playing) this.next(pp);
        break;
      }
      case "breathWarn":
      case "breath": {
        fightIdle();
        const warnT = [1.3, 1.1, 0.95][ph];
        const fireT = [1.15, 1.25, 1.35][ph];
        // 머리는 조금 낮게 · 앞으로
        const hp = this.rim(this.phi, this.R - 3.2).setY(this.A.y + 4.6);
        headTarget = hp;
        const mouthP = this.mouthPos();
        if (s === "breathWarn") {
          // 처음 60% 동안은 주인공을 따라가고, 그다음 멈춘다 (피할 시간)
          if (this.st < warnT * 0.6 || !this.aim) this.aim = pp.clone();
          const k = this.st / warnT;
          mouth = k;
          jawOpen = 0.2 + k * 0.4;
          this.drawLane(mouthP, this.aim, 0.25 + k * 0.35 + Math.sin(this.t * 30) * 0.05);
          if (this.st > warnT) {
            this.go("breath");
            ev.push({ type: "sfx", name: "fire" });
          }
          lookAt = this.aim.clone();
        } else {
          jawOpen = 0.85;
          mouth = 1;
          lookAt = this.aim.clone();
          this.drawLane(mouthP, this.aim, 0.5);
          this.fire(mouthP, dt, P, playing);
          if (this.st > fireT) {
            this.endFire();
            this.tired(this.laneEnd);
          }
        }
        break;
      }
      case "tailWarn":
      case "tail": {
        fightIdle();
        headTarget = headHome();
        const warnT = [1.15, 1.0, 0.9][ph];
        const sweepT = [1.2, 1.05, 0.95][ph];
        const L = this.R * 1.25;
        const piv = this.rim(this.phi, this.R - 0.6).setY(this.A.y + 0.55);
        const inA = Math.atan2(this.inward(this.phi).x, this.inward(this.phi).z);
        const half = 1.25;
        const dirS = this.sweepDir || 1;
        const a0 = inA - half * dirS;
        const a1 = inA + half * dirS;
        this.tailPivot = piv;
        if (s === "tailWarn") {
          const k = this.st / warnT;
          this.sweepMark.position.set(piv.x, this.A.y + 0.05, piv.z);
          this.sweepMark.geometry.dispose();
          this.sweepMark.geometry = new THREE.RingGeometry(1.5, L, 40, 1, 0, half * 2);
          // 링 각도 기준: x 축에서 반시계 → 세계 각도(atan2(x,z))로 맞춤
          this.sweepMark.rotation.set(-Math.PI / 2, 0, Math.min(a0, a1) - Math.PI / 2);
          this.sweepMark.material.opacity = 0.18 + k * 0.25 + Math.sin(this.t * 24) * 0.05;
          this.tailAng = a0;
          this.tailLen = L * smooth(k);
          this.tailLift = 1 - k;
          if (this.st > warnT) {
            this.go("tail");
            ev.push({ type: "sfx", name: "gust" });
          }
        } else {
          const k = smooth(this.st / sweepT);
          this.tailAng = a0 + (a1 - a0) * k;
          this.tailLen = L;
          this.tailLift = 0;
          this.sweepMark.material.opacity = 0.18 * (1 - k);
          this.tailHit(P, playing);
          if (this.st > sweepT) {
            this.sweepMark.material.opacity = 0;
            // 3단계: 한 번 더 반대로
            if (ph === 2 && !this.tailTwice) {
              this.tailTwice = true;
              this.sweepDir = -dirS;
              this.go("tailWarn");
              this.st = warnT * 0.5;
            } else {
              this.tailTwice = false;
              this.sweepDir = -(this.sweepDir || 1);
              this.tailLen = 0;
              this.go("idle");
              this.st = 0.4;
            }
          }
        }
        break;
      }
      case "slamWarn":
      case "slam": {
        fightIdle();
        headTarget = headHome();
        const warnT = [1.3, 1.2, 1.05][ph];
        const leg = this.legs[this.slamLeg || 0];
        if (s === "slamWarn") {
          if (this.st < warnT * 0.55 || !this.aim) {
            // 닿을 수 있는 곳까지 (어깨에서 9m)
            const sh = this.shoulder(leg);
            const t = pp.clone().setY(this.A.y);
            const d = t.clone().sub(sh.clone().setY(this.A.y));
            if (d.length() > 9.5) t.copy(sh.clone().setY(this.A.y)).addScaledVector(d.normalize(), 9.5);
            this.aim = t;
          }
          const k = this.st / warnT;
          this.slamMark.position.set(this.aim.x, this.A.y + 0.05, this.aim.z);
          this.slamMark.set(k);
          leg.raise = this.aim.clone().add(V(0, 5.5 * smooth(k * 1.6), 0));
          if (this.st > warnT) {
            this.go("slam");
          }
        } else {
          const k = smooth(this.st / 0.16);
          leg.raise = this.aim.clone().add(V(0, 5.5 * (1 - k), 0));
          if (this.st > 0.16 && !this.slammed) {
            this.slammed = true;
            this.slamMark.set(0, false);
            ev.push({ type: "sfx", name: "stomp" });
            ev.push({ type: "shake", k: 0.8 });
            this.fx.puff(this.aim.x, this.aim.y + 0.3, this.aim.z, 2.4, 10, "#d8b8a8");
            this.fx.debris(this.aim.clone().setY(this.A.y + 0.3), 10, { color: "#5a4a50", up: 6, spread: 2.5 });
            this.waveR = 1.2;
            this.waveC = this.aim.clone();
            if (P && playing && Math.hypot(P.pos.x - this.aim.x, P.pos.z - this.aim.z) < 2.4 && P.pos.y < this.A.y + 1.5) ev.push({ type: "hurt", from: this.aim.clone(), power: 9, p: P.pos.clone().setY(P.pos.y + 1) });
          }
          if (this.st > 1.0) {
            this.slammed = false;
            leg.raise = null;
            this.slamLeg = 1 - (this.slamLeg || 0);
            this.tired(this.aim);
          }
        }
        break;
      }
      case "rainWarn":
      case "rain": {
        fightIdle();
        headTarget = headHome().add(V(0, 1.5, 0));
        lookAt = headTarget.clone().add(V(0, 6, 0)).addScaledVector(this.inward(this.phi), 3);
        jawOpen = 0.7;
        mouth = 1;
        if (s === "rainWarn" && this.st > 0.5) {
          this.go("rain");
          ev.push({ type: "sfx", name: "fire" });
          const n = 5;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + Math.random();
            const r = i === 0 ? 0 : 2.6 + Math.random() * 2.2;
            const t = pp.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r));
            const dd = Math.hypot(t.x - this.A.x, t.z - this.A.z);
            if (dd > this.R - 1) t.set(this.A.x + ((t.x - this.A.x) * (this.R - 1)) / dd, t.y, this.A.z + ((t.z - this.A.z) * (this.R - 1)) / dd);
            t.y = this.A.y;
            this.spit(this.mouthPos(), t, 1.35 + i * 0.12, 9);
          }
        }
        if (s === "rain" && this.st > 2.0) this.go("idle");
        break;
      }
      /* ---------- 지침 (약점 열림) ---------- */
      case "tired": {
        // 머리를 바닥에 내려놓고 헐떡인다
        const rest = this.restPos;
        headTarget = rest.clone().add(V(0, 0.95 + Math.sin(this.t * 5) * 0.05, 0));
        lookAt = rest.clone().addScaledVector(this.restDir, 4).setY(this.A.y + 0.6);
        jawOpen = 0.25 + Math.sin(this.t * 5) * 0.08;
        flap = 0.15;
        wingOpen = 0.6;
        this.bodyPos.lerp(this.homeBase.clone().add(V(0, -0.8, 0)), 1 - Math.exp(-dt * 3));
        if (Math.random() < dt * 6) this.fx.puff(rest.x + (Math.random() - 0.5), rest.y + 1.6, rest.z + (Math.random() - 0.5), 0.5, 1, "#e8e0f0");
        this.updateHeadSolid(headTarget);
        this.checkHit(P, playing);
        const dur = [3.6, 3.1, 2.7][ph];
        if (this.state === "tired" && this.st > dur) {
          this.headSolid.active = false;
          this.go("recover");
          ev.push({ type: "sfx", name: "roar" });
        }
        break;
      }
      case "recover": {
        fightIdle();
        headTarget = this.restPos.clone().add(V(0, 0.95, 0)).lerp(headHome(), smooth(this.st / 0.8));
        if (this.st > 0.9) this.go("idle");
        break;
      }
      case "hit": {
        // 맞음: 머리를 홱 들고 몸부림
        headTarget = (this.hitFrom || headHome()).clone().lerp(headHome(), smooth(this.st / 0.9)).add(V(Math.sin(this.st * 30) * 0.3 * (1 - this.st), 0, 0));
        jawOpen = 0.9;
        mouth = 0.4;
        flap = 1.2;
        this.bodyPos.y = this.homeBase.y + Math.sin(this.st * 25) * 0.25 * Math.max(0, 1 - this.st);
        if (this.st > 1.4) {
          if (this.phaseUp) {
            this.phaseUp = false;
            this.go("enrage");
          } else this.go("idle");
        }
        break;
      }
      case "enrage": {
        fightIdle();
        headTarget = headHome().add(V(0, 1.2, 0));
        lookAt = headTarget.clone().add(V(0, 3, 0)).addScaledVector(this.inward(this.phi), 4);
        jawOpen = 0.9;
        mouth = 0.8;
        flap = 1.5;
        if (this.st > 0.3 && !this.roared) {
          this.roared = true;
          ev.push({ type: "sfx", name: "roar" });
          ev.push({ type: "shake", k: 0.7 });
          // 포효 충격파 (가까이 있으면 밀려남 · 다치지 않음)
          this.waveR = 1.2;
          this.waveC = this.rim(this.phi, this.R - 1.5);
          this.waveSoft = true;
        }
        if (this.st > 1.8) {
          this.roared = false;
          this.go("idle");
        }
        break;
      }
      /* ---------- 쓰러짐 ---------- */
      case "dying": {
        const k = this.st;
        headTarget = headHome().add(V(Math.sin(k * 21) * 0.5, Math.sin(k * 3) * 1.2 - k * 0.4, 0));
        lookAt = headTarget.clone().add(V(0, 4, 0));
        jawOpen = 0.9;
        flap = k < 2.2 ? 1.6 : 0.2;
        wingOpen = Math.max(0.2, 1 - k * 0.25);
        if (Math.random() < dt * 9) {
          const p = this.bodyPos.clone().add(V((Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 6));
          this.fx.puff(p.x, p.y, p.z, 1.6, 5, Math.random() < 0.5 ? "#ffb07a" : "#5a5060");
          this.fx.sparkle(p, 16, ["#ffe27a", "#ff7a3a", "#ffffff"], 6);
          if (Math.random() < 0.4) ev.push({ type: "sfx", name: "boom" });
        }
        if (k > 2.3) {
          // 뒤로 넘어가며 구름 아래로
          const f = k - 2.3;
          this.bodyPos.y -= f * f * 6 * dt * 10;
          this.bodyPos.addScaledVector(this.inward(this.phi), -dt * 3);
          this.tilt = Math.min(1.3, f * 0.7);
        }
        if (k > 4.2 && !this.goneSent) {
          this.goneSent = true;
          ev.push({ type: "bossGone" });
          if (this.gate) this.gate.setOpen(true);
          if (this.c.collapse) this.c.collapse.armed = true;
        }
        if (k > 5.5) {
          this.go("gone");
          this.setVisible(false);
        }
        break;
      }
      case "gone":
        this.setVisible(false);
        break;
    }
    // 충격파
    this.updateWave(dt, P, playing);
    // 불덩이
    this.updateBalls(dt, P, playing);
    if (!this.visible) return;
    this.pose(dt, { headTarget: headTarget || headHome(), lookAt, jawOpen, flap, wingOpen, mouth });
  }

  /** 다음 공격 고르기 (주인공 거리 · 단계에 따라) */
  next(pp) {
    if (!this.queue.length) {
      const ph = this.phase;
      const hh = this.rim(this.phi, this.R - 2.2);
      const d = Math.hypot(pp.x - hh.x, pp.z - hh.z);
      if (d < 7.5 || (ph >= 1 && Math.random() < 0.45)) this.queue.push("tail");
      if (ph === 2 && Math.random() < 0.7) this.queue.push("rain");
      this.queue.push(ph >= 1 && (d < 10 || Math.random() < 0.5) && this.lastBig !== "slam" ? "slam" : "breath");
      this.lastBig = this.queue[this.queue.length - 1];
    }
    const a = this.queue.shift();
    this.aim = null;
    if (a === "breath") this.go("breathWarn");
    else if (a === "tail") this.go("tailWarn");
    else if (a === "slam") this.go("slamWarn");
    else if (a === "rain") this.go("rainWarn");
    if (a === "breath" || a === "slam") this.ev.push({ type: "sfx", name: "charge" });
  }
  /** 지쳐서 머리를 내려놓을 자리: 아레나 안쪽 (가장자리에서 4.5m) */
  tired(near) {
    const rim = this.rim(this.phi, this.R - 4.4);
    this.restPos = rim.setY(this.A.y);
    this.restDir = this.inward(this.phi);
    this.go("tired");
    this.ev.push({ type: "bossTired" });
    this.ev.push({ type: "sfx", name: "weak" });
  }
  updateHeadSolid(hp) {
    const s = this.headSolid;
    const r = this.restPos;
    const d = this.restDir;
    // 머리 (가로 2m · 앞뒤 4m(주둥이 쪽으로 길게), 윗면 1.75m) — 보이는 머리 크기와 맞춤
    const cx = r.x + d.x * 0.8;
    const cz = r.z + d.z * 0.8;
    const hw = Math.abs(d.z) * 1.0 + Math.abs(d.x) * 2.0;
    const hl = Math.abs(d.x) * 1.0 + Math.abs(d.z) * 2.0;
    Object.assign(s, { x0: cx - hw, x1: cx + hw, z0: cz - hl, z1: cz + hl, y0: this.A.y, y1: this.A.y + 1.75, dx: 0, dy: 0, dz: 0 });
    s.active = this.st > 0.5;
  }
  /** 약점 맞히기: 머리에 대시로 부딪힘 · 위에서 밟음 */
  checkHit(P, playing) {
    if (!P || !playing || this.st < 0.5) return;
    const s = this.headSolid;
    const cx = clamp(P.pos.x, s.x0, s.x1);
    const cz = clamp(P.pos.z, s.z0, s.z1);
    const dh = Math.hypot(P.pos.x - cx, P.pos.z - cz);
    const dash = P.dashT > 0 && dh < 0.75 && P.pos.y < s.y1 + 0.8;
    const stomp = (P.onGround && P.groundSolid === s) || (!P.onGround && P.vel.y < -1 && dh < 0.3 && P.pos.y > s.y1 - 0.2 && P.pos.y < s.y1 + 0.7);
    if (!dash && !stomp) return;
    this.hp--;
    const ev = this.ev;
    this.headSolid.active = false;
    const gp = this.head.localToWorld(V(0, 0.85, 0.66));
    this.fx.sparkle(gp, 50, ["#8afcff", "#ffffff", "#ffe27a"], 8);
    this.fx.debris(gp, 8, { color: "#8ae0ff", up: 6, spread: 2 });
    ev.push({ type: "sfx", name: "bossHit" });
    ev.push({ type: "shake", k: 0.8 });
    ev.push({ type: "bossHit", p: gp, stomp, hp: this.hp });
    ev.push({ type: "bossHp", info: { name: this.name, hp: this.hp, max: this.maxHp } });
    // 주인공은 안쪽 위로 튕겨 나감
    const d = this.restDir;
    P.launch(d.x * 5, 9.5, d.z * 5);
    this.hitFrom = this.head.position.clone();
    if (this.hp <= 0) {
      this.dead = true;
      // 남아 있던 공격은 모두 거둔다
      this.waveR = -1;
      this.endFire();
      this.slamMark.set(0, false);
      this.sweepMark.material.opacity = 0;
      for (const b of this.balls) {
        b.on = false;
        b.g.visible = false;
        b.mk.set(0, false);
      }
      this.go("dying");
      this.tilt = 0;
      this.goneSent = false;
      ev.push({ type: "bossDown" });
      return;
    }
    const newPhase = this.phase;
    if (this.hp === 4 || this.hp === 2) {
      this.phaseHp = this.hp;
      this.phaseUp = true;
      ev.push({ type: "bossPhase", phase: newPhase + 1 });
    }
    this.queue = [];
    this.go("hit");
  }
  shoulder(leg) {
    const fw = V(Math.sin(this.yaw || 0), 0, Math.cos(this.yaw || 0));
    const rt = V(fw.z, 0, -fw.x);
    return this.bodyPos.clone().addScaledVector(fw, 1.8 * SC).addScaledVector(rt, -leg.s * 1.55 * SC).add(V(0, 0.3 * SC, 0));
  }
  mouthPos() {
    return this.head.localToWorld(V(0, -0.3, 1.9));
  }
  /* ---------------- 불 뿜기 ---------------- */
  drawLane(from, aim, op) {
    const a = from.clone().setY(this.A.y);
    const d = aim.clone().setY(this.A.y).sub(a);
    const len0 = d.length() || 1;
    d.divideScalar(len0);
    // 입 바로 아래부터 아레나 끝까지
    let L = 2;
    while (L < 40) {
      const p = a.clone().addScaledVector(d, L);
      if (Math.hypot(p.x - this.A.x, p.z - this.A.z) > this.R + 0.5) break;
      L += 0.5;
    }
    const st = 1.0;
    const mid = a.clone().addScaledVector(d, (st + L) / 2);
    this.lane.position.set(mid.x, this.A.y + 0.05, mid.z);
    this.lane.scale.set(2.6, L - st, 1);
    this.lane.rotation.set(-Math.PI / 2, 0, Math.atan2(d.x, d.z) + Math.PI);
    this.lane.material.opacity = op;
    this.laneA = a.clone().addScaledVector(d, st);
    this.laneB = a.clone().addScaledVector(d, L);
    this.laneEnd = this.laneB.clone();
  }
  fire(from, dt, P, playing) {
    const to = this.laneB.clone().setY(this.A.y + 0.6);
    const d = to.clone().sub(from);
    const L = d.length();
    for (const f of [this.flame, this.flame2]) {
      f.position.copy(from);
      f.quaternion.setFromUnitVectors(UP, d.clone().divideScalar(L));
      f.scale.y = L;
      f.material.opacity = 0.55 + Math.sin(this.t * 40) * 0.12;
    }
    this.flame.scale.x = this.flame.scale.z = 1 + Math.sin(this.t * 33) * 0.08;
    if (Math.random() < dt * 40) {
      const k = Math.random();
      const p = from.clone().lerp(to, k);
      this.fx.puff(p.x, p.y, p.z, 0.6 + k * 0.8, 1, Math.random() < 0.5 ? "#ffb05a" : "#ff6a2a");
    }
    if (P && playing && !P.invulnerable) {
      // 빨간 길 안 (가로 1.3m) + 낮은 높이
      const a = this.laneA;
      const b = this.laneB;
      const ab = b.clone().sub(a);
      const u = clamp(((P.pos.x - a.x) * ab.x + (P.pos.z - a.z) * ab.z) / ab.lengthSq(), 0, 1);
      const cx = a.x + ab.x * u;
      const cz = a.z + ab.z * u;
      if (Math.hypot(P.pos.x - cx, P.pos.z - cz) < 1.3 && P.pos.y < this.A.y + 2.4) this.ev.push({ type: "hurt", from: V(cx, P.pos.y, cz), power: 7, p: P.pos.clone().setY(P.pos.y + 1) });
    }
  }
  endFire() {
    this.lane.material.opacity = 0;
    this.flame.material.opacity = this.flame2.material.opacity = 0;
  }
  /* ---------------- 꼬리 ---------------- */
  tailSeg() {
    const a = this.tailAng;
    return { a: this.tailPivot.clone(), b: this.tailPivot.clone().add(V(Math.sin(a) * this.tailLen, 0, Math.cos(a) * this.tailLen)) };
  }
  tailHit(P, playing) {
    if (!P || !playing || P.invulnerable) return;
    const { a, b } = this.tailSeg();
    const y = this.A.y + 0.55;
    if (P.pos.y > y + 0.45 || P.pos.y + 1 < y - 0.4) return;
    const ab = b.clone().sub(a);
    const u = clamp(((P.pos.x - a.x) * ab.x + (P.pos.z - a.z) * ab.z) / ab.lengthSq(), 0, 1);
    const cx = a.x + ab.x * u;
    const cz = a.z + ab.z * u;
    if (Math.hypot(P.pos.x - cx, P.pos.z - cz) < 0.75) {
      const sd = this.sweepDir || 1;
      const tx = Math.cos(this.tailAng) * sd;
      const tz = -Math.sin(this.tailAng) * sd;
      this.ev.push({ type: "hurt", from: V(P.pos.x - tx, P.pos.y, P.pos.z - tz), power: 8, p: V(cx, y, cz) });
    }
  }
  /* ---------------- 충격파 ---------------- */
  updateWave(dt, P, playing) {
    if (this.waveR < 0) {
      this.wave.material.opacity = 0;
      return;
    }
    this.waveR += dt * 7.5;
    const r = this.waveR;
    this.wave.position.set(this.waveC.x, this.A.y + 0.35, this.waveC.z);
    this.wave.scale.set(r, r, 1);
    this.wave.material.opacity = Math.max(0, 0.85 - r / 30);
    if (P && playing) {
      const d = Math.hypot(P.pos.x - this.waveC.x, P.pos.z - this.waveC.z);
      if (Math.abs(d - r) < 0.55 && P.pos.y < this.A.y + 0.55) {
        if (this.waveSoft) {
          if (P.stunT <= 0) this.ev.push({ type: "knock", from: this.waveC.clone(), p: P.pos.clone() });
        } else if (!P.invulnerable) this.ev.push({ type: "hurt", from: this.waveC.clone(), power: 6, p: P.pos.clone() });
      }
    }
    if (r > this.R * 2.2) {
      this.waveR = -1;
      this.waveSoft = false;
    }
  }
  /* ---------------- 불덩이 ---------------- */
  spit(from, to, dur, h) {
    const b = this.balls.find((q) => !q.on);
    if (!b) return;
    Object.assign(b, { on: true, t: 0, dur, h });
    b.a.copy(from);
    b.b.copy(to);
    b.g.visible = true;
    b.mk.position.set(to.x, to.y + 0.05, to.z);
    b.mk.set(0);
  }
  updateBalls(dt, P, playing) {
    for (const b of this.balls) {
      if (!b.on) continue;
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      const p = b.a.clone().lerp(b.b, k);
      p.y += Math.sin(k * Math.PI) * b.h;
      b.g.position.copy(p);
      b.mk.set(k);
      if (Math.random() < dt * 30) this.fx.puff(p.x, p.y, p.z, 0.4, 1, "#ff9a4a");
      if (k >= 1) {
        b.on = false;
        b.g.visible = false;
        b.mk.set(0, false);
        this.fx.puff(b.b.x, b.b.y + 0.4, b.b.z, 1.6, 7, "#ffa05a");
        this.fx.sparkle(b.b.clone().setY(b.b.y + 0.5), 20, ["#ffe27a", "#ff7a3a"], 5);
        if (P && P.pos.distanceTo(b.b) < 20) this.ev.push({ type: "sfx", name: "boom" });
        if (P && playing && !P.invulnerable && Math.hypot(P.pos.x - b.b.x, P.pos.z - b.b.z) < 1.75 && P.pos.y < b.b.y + 1.8 && P.pos.y > b.b.y - 1) {
          this.ev.push({ type: "hurt", from: b.b.clone(), power: 7, p: P.pos.clone().setY(P.pos.y + 1) });
        }
      }
    }
  }

  /* ================================================================
   * 자세 (머리 · 목 · 다리 · 날개 · 꼬리)
   * ============================================================== */
  setVisible(v) {
    this.visible = v;
    this.root.visible = v;
    this.head.visible = v;
    this.segs.visible = this.spikes.visible = this.rings.visible = v;
    this.tailTip.visible = v;
    for (const l of this.legs) l.up.visible = l.lo.visible = l.joint.visible = l.claw.visible = v;
  }
  pose(dt, o) {
    const bp = this.bodyPos;
    if (!this.flying || this.state === "intro" || this.fighting || this.state === "dying") {
      if (this.state !== "chase" && this.state !== "chaseIn" && this.state !== "chaseOut") this.yaw = Math.atan2(this.A.x - bp.x, this.A.z - bp.z);
    }
    if (["intro", "idle", "breathWarn", "breath", "tailWarn", "tail", "slamWarn", "slam", "rainWarn", "rain", "tired", "recover", "hit", "enrage", "dying"].includes(this.state)) this.flying = false;
    const yaw = this.yaw || 0;
    this.root.position.copy(bp);
    this.root.rotation.set(-(this.tilt || 0), yaw, 0, "YXZ");
    this.root.updateMatrixWorld(true);
    const L = (x, y, z) => this.root.localToWorld(V(x, y, z));
    // 머리
    this.headPos = this.headPos || o.headTarget.clone();
    this.headPos.lerp(o.headTarget, 1 - Math.exp(-dt * (this.state === "slam" || this.state === "hit" ? 12 : 5)));
    this.head.position.copy(this.headPos);
    const look = o.lookAt.clone().sub(this.headPos);
    const want = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(V(0, 0, 0), look.negate(), UP));
    this.head.quaternion.slerp(want, 1 - Math.exp(-dt * 6));
    this.jaw.rotation.x = damp(this.jaw.rotation.x, o.jawOpen, 10, dt);
    const mg = this.mouthGlow;
    mg.scale.setScalar(damp(mg.scale.x, 0.1 + o.mouth * 2.2, 8, dt));
    // 약점
    const g = this.gemOpen;
    this.shutters.forEach((s, i) => (s.position.x = (i ? 1 : -1) * (0.22 + g * 0.42)));
    this.gem.material.emissiveIntensity = 1 + g * (2.2 + Math.sin(this.t * 10) * 0.8);
    this.gemGlow.scale.setScalar(0.1 + g * 2.2);
    const angry = this.phase === 2 ? 1 : 0;
    for (const e of this.eyeGlows) e.scale.setScalar(0.8 + angry * 0.5 + Math.sin(this.t * 8) * 0.08);
    this.m.glow.emissiveIntensity = 1.8 + angry * 1.2 + Math.sin(this.t * 4) * 0.3;
    // 목: 몸 → 머리 (곡선)
    const nb = L(0, 1.6, 2.6);
    const hdir = this.head.getWorldDirection(V());
    const head = this.headPos.clone().addScaledVector(hdir, -1.0 * HS);
    const fwd = L(0, 0, 1).sub(L(0, 0, 0)).normalize();
    const reach = nb.distanceTo(head);
    const c1 = nb.clone().addScaledVector(fwd, reach * 0.42).add(V(0, reach * 0.12, 0));
    const c2 = head.clone().addScaledVector(hdir, -reach * 0.38).add(V(0, -reach * 0.22, 0));
    const pa = V();
    const pb = V();
    for (let i = 0; i < this.neckN; i++) {
      const t0 = (i + 0.5) / this.neckN;
      bez3(nb, c1, c2, head, t0, pa);
      bez3(nb, c1, c2, head, Math.min(1, t0 + 0.04), pb);
      const dir = pb.sub(pa);
      if (dir.lengthSq() < 1e-8) dir.copy(FWD);
      dir.normalize();
      const s = 1.65 - t0 * 0.55;
      setInst(this.segs, i, pa, dir, s);
      setInst(this.spikes, i, pa, dir, s);
      setInst(this.rings, i, pa.clone().addScaledVector(dir, 0.48 * s), dir, s * 0.95);
    }
    // 꼬리: 엉덩이 뒤 → (휩쓸 땐 아레나 위로)
    const tb = L(0, 0.35, -3.7);
    let t1;
    let t2;
    if (this.tailLen > 0.5 && (this.state === "tail" || this.state === "tailWarn")) {
      const sg = this.tailSeg();
      t2 = sg.b.clone().add(V(0, (this.tailLift || 0) * 4, 0));
      t1 = sg.a.clone().add(V(0, 1.5, 0));
    } else {
      const sw = Math.sin(this.t * 1.1) * 2.5;
      t1 = L(sw * 0.5, -1.0, -8);
      t2 = L(sw, -2.2 + Math.sin(this.t * 0.9) * 0.6, -13);
    }
    this.tailEnd = t2;
    for (let i = 0; i < this.tailN; i++) {
      const t0 = (i + 0.5) / this.tailN;
      bez(tb, t1, t2, t0, pa);
      bez(tb, t1, t2, Math.min(1, t0 + 0.04), pb);
      const s = 1.35 - t0 * 0.85;
      const k = this.neckN + i;
      const dir = pb.clone().sub(pa);
      setInst(this.segs, k, pa, dir, s);
      setInst(this.spikes, k, pa, dir, s);
      setInst(this.rings, k, pa.clone().addScaledVector(dir.normalize(), 0.45 * s), dir, s * 0.9);
    }
    this.tailTip.position.copy(t2);
    this.tailTip.quaternion.setFromUnitVectors(FWD, pb.copy(t2).sub(bez(tb, t1, t2, 0.95)).normalize());
    for (const im of [this.segs, this.spikes, this.rings]) im.instanceMatrix.needsUpdate = true;
    // 앞다리: 아레나 끝을 움켜쥠 (내려찍을 땐 목표로)
    for (const leg of this.legs) {
      const sh = this.shoulder(leg);
      let tgt;
      if (leg.raise) tgt = leg.raise;
      else if (this.flying || this.state === "intro" || this.state === "dying" || this.state === "chase" || this.state === "chaseIn") tgt = sh.clone().add(V(0, -2.6, 1.2)).add(L(0, 0, 1.5).sub(L(0, 0, 0)));
      else tgt = this.rim(this.phi + leg.s * 0.2, this.R - 0.3).setY(this.A.y + 0.25);
      leg.cur.lerp(tgt, 1 - Math.exp(-dt * (leg.raise ? 14 : 6)));
      const pole = sh.clone().add(V(0, 3, 0)).addScaledVector(V(Math.sin(yaw), 0, Math.cos(yaw)), -3);
      const { elbow, end } = ik2(sh, leg.cur, leg.l1, leg.l2, pole);
      placeBone(leg.up, sh, elbow, SC);
      placeBone(leg.lo, elbow, end, SC);
      leg.joint.position.copy(elbow);
      leg.claw.position.copy(end);
      leg.claw.rotation.set(0, yaw, 0);
    }
    // 날개
    for (const w of this.wings) {
      const f = Math.sin(this.t * (2 + o.flap * 3)) * 0.35 * o.flap;
      w.g.rotation.set(0, w.s * (0.25 - (1 - o.wingOpen) * 0.6), w.s * (0.15 + f - (1 - o.wingOpen) * 0.5));
    }
  }

  /** 카메라: 싸우는 동안은 주인공 뒤에서 용 쪽을 본다 */
  camHint(P) {
    if (!this.fighting || !this.visible) return null;
    const f = this.rim(this.phi, this.R);
    let dx = f.x - P.pos.x;
    let dz = f.z - P.pos.z;
    const l = Math.hypot(dx, dz);
    if (l < 3) {
      const iw = this.inward(this.phi);
      dx = -iw.x;
      dz = -iw.z;
    } else {
      dx /= l;
      dz /= l;
    }
    return { dx, dz, dist: 2.6, hgt: 1.8 };
  }
  /** 연출 카메라가 볼 곳 */
  focus() {
    return this.head.position.clone();
  }
  dispose() {
    for (const m of Object.values(this.m)) m.dispose();
  }
}
