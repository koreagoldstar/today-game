/*
 * 드래곤 석상 대작전 · 지역 보스 (거대 드래곤)
 *
 *  몸: 관절이 있는 드래곤 (다리 4 · 목 · 머리 · 열리는 턱 · 날개 · 꼬리 8마디 · 이마의 약점 수정)
 *  공격 (모두 예고가 먼저 보인다 — 맞는 순간에만 아프다):
 *   1) 꼬리 휘두르기: 꼬리를 들고 빛남 + 바닥 고리 표시 → 한 바퀴 휘두름 (점프하거나 멀리 피하기)
 *   2) 돌진: 몸을 낮추고 빨간 길 표시 → 직선 돌진 → 벽에 부딪혀 어질어질 (약점 노출!)
 *   3) 바닥 충격파: 일어서며 빛나는 원 → 쿵! 퍼지는 고리 (고리가 올 때 점프)
 *   4) 떨어지는 것: 포효 → 바닥 표시 → 돌 · 물방울 · 수정 · 불덩이 · 고드름이 떨어짐 (지역마다 다름)
 *   약점: 지치면 머리를 땅에 대고 이마 수정이 빛난다 → 방망이로 콩! (한 번에 최대 2번)
 *  체력이 반 아래로 내려가면 조금 빨라지고(예고 0.8배), 충격파가 두 겹이 된다. 피할 수 없는 공격은 없다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { taperTube, slab, horn, part, bake } from "./geo.js?v=1";
import { stoneTex, stoneBump, scaleTex, lavaCrackTex, dotTex } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sph = (n = 20) => new THREE.SphereGeometry(1, n, Math.round(n * 0.75));

/* ---------------- 보스 종류 ---------------- */
export const BOSSES = {
  forest: { name: "고대 숲 드래곤", en: "ANCIENT FOREST DRAGON", hp: 6, speed: 1, body: "#78c454", belly: "#f4e8a8", accent: "#3f8a2a", eye: "#9aff6a", weak: "#7aff9a", horn: "#f2e4bc", wing: "#5aa83e", rain: "rock", extra: "moss", egg: "forest" },
  water: { name: "물보라 드래곤", en: "SPLASH DRAGON", hp: 7, speed: 1.05, body: "#56b8e6", belly: "#e8f8ff", accent: "#2a9ad8", eye: "#8ae8ff", weak: "#8ae8ff", horn: "#f0fbff", wing: "#3a8ccc", rain: "drop", extra: "fins", egg: "sea" },
  crystal: { name: "수정 드래곤", en: "CRYSTAL DRAGON", hp: 7, speed: 1.1, body: "#c4a8ff", belly: "#f6efff", accent: "#c48aff", eye: "#ffcf7a", weak: "#ffcf3a", horn: "#fff4ff", wing: "#9070ea", rain: "crystal", extra: "crystals", egg: "star" },
  lava: { name: "용암 드래곤", en: "LAVA DRAGON", hp: 8, speed: 1.15, body: "#6a3e30", belly: "#c8885a", accent: "#ff6a1a", eye: "#ffd23f", weak: "#ffd23f", horn: "#2a2220", wing: "#8a3a24", rain: "fireball", extra: "lava", egg: "fire" },
  ice: { name: "얼음 드래곤", en: "ICE DRAGON", hp: 8, speed: 1.15, body: "#a6dcff", belly: "#ffffff", accent: "#5ac8ff", eye: "#3ab8ff", weak: "#bff4ff", horn: "#ffffff", wing: "#6ab4ec", rain: "icicle", extra: "icicles", egg: "ice" },
  king: { name: "고대 드래곤 왕", en: "ANCIENT DRAGON KING", hp: 10, speed: 1.2, body: "#e8b44a", belly: "#fff0c4", accent: "#ffcf3a", eye: "#ff6a4a", weak: "#ffe27a", horn: "#f2c14e", wing: "#c8543a", rain: "mix", extra: "crown", egg: "gold" },
};

function mats(B) {
  const own = (t, r = 1) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(r, r);
    return c;
  };
  const stone = own(stoneTex(43), 1.5);
  const live = own(scaleTex("color", 7), 2);
  const m = {
    skin: new THREE.MeshStandardMaterial({ color: B.body, map: stone, bumpMap: own(scaleTex("bump", 7), 2), bumpScale: 1.4, roughness: 0.8, vertexColors: true }),
    belly: new THREE.MeshStandardMaterial({ color: B.belly, map: stone, roughness: 0.8, vertexColors: true }),
    accent: new THREE.MeshStandardMaterial({ color: B.accent, roughness: 0.7, vertexColors: true }),
    horn: new THREE.MeshStandardMaterial({ color: B.horn, roughness: 0.45, metalness: B.extra === "crown" ? 0.8 : 0.05, vertexColors: true }),
    wing: new THREE.MeshStandardMaterial({ color: B.wing, map: stone, roughness: 0.8, side: THREE.DoubleSide, vertexColors: true }),
    claw: new THREE.MeshStandardMaterial({ color: "#3a3430", roughness: 0.5, vertexColors: true }),
    glow: new THREE.MeshStandardMaterial({ color: B.accent, emissive: B.accent, emissiveIntensity: 1.1, roughness: 0.2, vertexColors: true, transparent: true, opacity: 0.92 }),
    eye: new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: B.eye, emissiveIntensity: 0.1, roughness: 0.2 }),
    weak: new THREE.MeshStandardMaterial({ color: B.weak, emissive: B.weak, emissiveIntensity: 0.25, roughness: 0.1, flatShading: true }),
  };
  if (B.extra === "lava") {
    m.skin.emissive = new THREE.Color("#ff5a10");
    m.skin.emissiveMap = own(lavaCrackTex(), 2);
    m.skin.emissiveIntensity = 1.2;
  }
  if (B.extra === "icicles") {
    m.skin.roughness = 0.25;
    m.skin.metalness = 0.05;
  }
  if (B.extra === "crown") {
    m.horn.color.set("#f2c14e");
  }
  m.maps = { stone, live };
  return m;
}
/** part 들을 재질별로 구워 한 그룹 안의 메시 몇 개로 */
function solidify(g, M) {
  const geos = bake(g, { ao: 0.3, height: 6, base: -1 });
  const out = new THREE.Group();
  out.position.copy(g.position);
  out.rotation.copy(g.rotation);
  for (const [k, geo] of Object.entries(geos)) {
    const m = new THREE.Mesh(geo, M[k] || M.skin);
    m.castShadow = true;
    m.receiveShadow = true;
    out.add(m);
  }
  return out;
}
function bakeChildren(g, M) {
  // g 의 직속 part 메시만 굽고, 하위 그룹(움직이는 관절)은 그대로 둔다
  const tmp = new THREE.Group();
  const keep = [];
  for (const c of [...g.children]) {
    if (c.isMesh && c.userData.mat) tmp.add(c);
    else keep.push(c);
  }
  const baked = solidify(tmp, M);
  g.clear();
  for (const c of baked.children.slice()) g.add(c);
  for (const c of keep) g.add(c);
}

/* ---------------- 드래곤 몸 만들기 ---------------- */
function buildDragon(B, M) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.9;
  root.add(body);
  const add = (grp, geo, mat, pos, scale = 1, rot = [0, 0, 0]) => grp.add(part(geo, mat, { pos, scale, rot }));
  // 몸통 · 가슴 · 배판
  add(body, sph(28), "skin", [0, 0.15, 0], [1.55, 1.3, 2.3]);
  add(body, sph(24), "skin", [0, 0.45, 1.45], [1.3, 1.25, 1.25]);
  for (let i = 0; i < 6; i++) add(body, new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, -1.0, 2.0), "belly", [0, -0.75 + i * 0.04, 1.6 - i * 0.62], [0.95 - i * 0.04, 0.16, 0.42], [-0.15, 0, 0]);
  // 등 가시 (지역마다 모양)
  for (let i = 0; i < 7; i++) {
    const z = 1.6 - i * 0.62;
    const y = 1.35 - Math.abs(i - 2) * 0.08;
    if (B.extra === "crystals") add(body, new THREE.OctahedronGeometry(0.3, 0), "glow", [0, y + 0.15, z], [0.7, 1.6, 0.7], [0.2, i, 0]);
    else if (B.extra === "icicles") add(body, new THREE.ConeGeometry(0.22, 0.8, 6), "horn", [0, y + 0.3, z], 1, [-0.3, 0, 0]);
    else add(body, new THREE.ConeGeometry(0.2, 0.6, 6), B.extra === "lava" ? "glow" : "horn", [0, y + 0.2, z], 1, [-0.4, 0, 0]);
  }
  if (B.extra === "moss") {
    for (let i = 0; i < 9; i++) add(body, sph(10), "accent", [(i % 3 - 1) * 0.8, 1.1 + (i % 2) * 0.1, 1.2 - i * 0.4], [0.55, 0.16, 0.45], [0, i, 0]);
  }
  if (B.extra === "fins") for (const s of [-1, 1]) add(body, new THREE.ConeGeometry(0.4, 1.4, 4), "accent", [s * 1.3, 0.6, 0], [0.4, 1, 1], [0, 0, -s * 1.2]);
  bakeChildren(body, M);
  // 다리 4개 (엉덩이 관절)
  const legs = [];
  for (const [x, z, front] of [
    [-1.25, 1.35, true],
    [1.25, 1.35, true],
    [-1.3, -1.1, false],
    [1.3, -1.1, false],
  ]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0, z);
    add(leg, sph(14), "skin", [0, -0.15, 0], [0.62, 0.75, 0.75]);
    add(leg, new THREE.CylinderGeometry(0.34, 0.42, 1.4, 12), "skin", [0, -1.0, 0.1]);
    add(leg, sph(12), "skin", [0, -1.72, 0.3], [0.5, 0.28, 0.65]);
    for (let k = -1; k <= 1; k++) add(leg, new THREE.ConeGeometry(0.1, 0.36, 6), "claw", [k * 0.22, -1.78, 0.9], 1, [Math.PI / 2, 0, 0]);
    bakeChildren(leg, M);
    body.add(leg);
    legs.push({ g: leg, front, x });
  }
  // 목 (3마디) + 머리
  const neck = new THREE.Group();
  neck.position.set(0, 0.85, 2.1);
  body.add(neck);
  const neckSegs = [];
  let parent = neck;
  for (let i = 0; i < 3; i++) {
    const sg = new THREE.Group();
    sg.position.set(0, i === 0 ? 0 : 0.55, i === 0 ? 0 : 0.42);
    add(sg, sph(16), "skin", [0, 0, 0], [0.75 - i * 0.08, 0.72 - i * 0.07, 0.75 - i * 0.08]);
    add(sg, new THREE.ConeGeometry(0.15, 0.4, 6), "horn", [0, 0.68 - i * 0.05, -0.1], 1, [-0.5, 0, 0]);
    bakeChildren(sg, M);
    parent.add(sg);
    neckSegs.push(sg);
    parent = sg;
  }
  const head = new THREE.Group();
  head.position.set(0, 0.55, 0.55);
  parent.add(head);
  add(head, sph(24), "skin", [0, 0.1, 0], [0.82, 0.68, 0.95]);
  add(head, sph(20), "skin", [0, -0.08, 0.85], [0.55, 0.42, 0.78]);
  add(head, sph(12), "skin", [0, 0.28, 0.45], [0.7, 0.18, 0.5]);
  for (const s of [-1, 1]) {
    add(head, sph(10), "claw", [s * 0.18, 0.02, 1.55], [0.07, 0.05, 0.05]);
    add(head, sph(12), "skin", [s * 0.5, 0.42, 0.42], [0.28, 0.14, 0.32], [0, 0, -s * 0.3]);
    // 큰 뿔
    add(head, horn(1.5, 0.22, 1.1, 0.4, 12), "horn", [s * 0.45, 0.45, -0.3], 1, [-0.5, 0, -s * 0.55]);
    add(head, new THREE.ConeGeometry(0.1, 0.5, 6), "horn", [s * 0.75, 0.0, -0.1], 1, [0, 0, -s * 1.3]);
  }
  if (B.extra === "crown") {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI - Math.PI / 2;
      add(head, new THREE.ConeGeometry(0.12, 0.45, 6), "horn", [Math.sin(a) * 0.45, 0.85, -0.1 + Math.cos(a) * 0.15], 1, [-0.2, 0, -Math.sin(a) * 0.3]);
    }
  }
  bakeChildren(head, M);
  // 눈 (빛남) · 약점 수정 (이마)
  const eyeMeshes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(sph(14), M.eye);
    e.position.set(s * 0.46, 0.22, 0.66);
    e.scale.set(0.24, 0.19, 0.15);
    head.add(e);
    eyeMeshes.push(e);
  }
  const weak = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), M.weak);
  weak.position.set(0, 0.62, 0.58);
  weak.scale.set(1, 1.3, 0.8);
  head.add(weak);
  const weakHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: B.weak, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  weakHalo.scale.setScalar(2.2);
  weak.add(weakHalo);
  // 턱 (열린다)
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.25, 0.15);
  add(jaw, sph(16), "skin", [0, -0.1, 0.75], [0.48, 0.2, 0.75]);
  for (const s of [-1, 1]) add(jaw, new THREE.ConeGeometry(0.06, 0.2, 5), "horn", [s * 0.28, 0.06, 1.25], 1, [0, 0, 0]);
  bakeChildren(jaw, M);
  head.add(jaw);
  // 날개
  const wings = [];
  const ws = new THREE.Shape();
  ws.moveTo(0, 0);
  ws.lineTo(1.6, 1.5);
  ws.lineTo(3.8, 2.4);
  ws.lineTo(4.4, 1.6);
  ws.lineTo(3.3, 1.1);
  ws.lineTo(4.0, 0.2);
  ws.lineTo(2.8, 0.1);
  ws.lineTo(2.9, -0.8);
  ws.lineTo(1.6, -0.4);
  ws.lineTo(0, -0.6);
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 1.0, 1.05, 0.9);
    const inner = new THREE.Group();
    inner.add(part(slab(ws, 0.06, 0.02), "wing", { scale: [s, 1, 1] }));
    inner.add(part(taperTube([V(0, 0, 0), V(s * 1.6, 1.5, 0), V(s * 3.8, 2.4, 0)], (t) => 0.16 * (1 - t * 0.6), 10, 8), "horn"));
    bakeChildren(inner, M);
    w.add(inner);
    body.add(w);
    wings.push({ g: w, s });
  }
  // 꼬리 (8마디, 마디마다 돌아가서 휘어진다)
  const tail = [];
  let tp = body;
  for (let i = 0; i < 8; i++) {
    const sg = new THREE.Group();
    sg.position.set(0, i === 0 ? -0.1 : 0, i === 0 ? -2.0 : -0.72);
    const r = 0.72 - i * 0.075;
    add(sg, sph(14), "skin", [0, 0, -0.3], [r, r * 0.9, 0.62]);
    if (i % 2 === 0) add(sg, new THREE.ConeGeometry(0.12, 0.38, 6), B.extra === "lava" || B.extra === "crystals" ? "glow" : "horn", [0, r * 0.85, -0.3], 1, [-0.5, 0, 0]);
    if (i === 7) {
      const tipS = new THREE.Shape();
      tipS.moveTo(0, 0.0);
      tipS.lineTo(0.55, -0.6);
      tipS.lineTo(0, -1.3);
      tipS.lineTo(-0.55, -0.6);
      tipS.lineTo(0, 0);
      add(sg, slab(tipS, 0.12, 0.04), "horn", [0, 0, -0.6], 1, [Math.PI / 2, 0, 0]);
    }
    bakeChildren(sg, M);
    tp.add(sg);
    tail.push(sg);
    tp = sg;
  }
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { root, body, legs, neck, neckSegs, head, jaw, wings, tail, eyes: eyeMeshes, weak, weakHalo };
}

/* ================================================================
 * 보스
 * ============================================================== */
export class Boss {
  constructor(kind, arena, scene, fx, { calm = false } = {}) {
    this.kind = kind;
    this.B = BOSSES[kind] || BOSSES.forest;
    this.arena = arena;
    this.scene = scene;
    this.fx = fx;
    this.calm = calm;
    this.M = mats(this.B);
    this.R = buildDragon(this.B, this.M);
    this.root = new THREE.Group();
    scene.add(this.root);
    this.root.add(this.R.root);
    this.maxHp = this.B.hp;
    this.hp = this.B.hp;
    this.pos = arena.c.clone().add(V(0, 0, -arena.r * 0.35));
    this.yaw = 0;
    this.state = "sleep";
    this.st = 0;
    this.t = 0;
    this.phase2 = false;
    this.queue = [];
    this.patterns = 0;
    this.tiredHits = 0;
    this.hurtT = 0;
    this.shake = 0;
    this.walk = 0;
    // 예고 표시들
    this.mk = this.makeMarkers();
    this.waves = [];
    this.rains = [];
    this.statue(true);
    this.place();
  }
  makeMarkers() {
    const red = (op = 0) => new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
    const annulus = new THREE.Mesh(new THREE.RingGeometry(2.2, 7.8, 64), red());
    annulus.rotation.x = -Math.PI / 2;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), red());
    lane.rotation.x = -Math.PI / 2;
    const slamRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: this.B.accent, transparent: true, opacity: 0, depthWrite: false }));
    slamRing.rotation.x = -Math.PI / 2;
    for (const m of [annulus, lane, slamRing]) {
      m.renderOrder = 3;
      this.root.add(m);
    }
    return { annulus, lane, slamRing };
  }
  /** 잠든 석상 모습 ↔ 깨어난 모습 */
  statue(on) {
    this.isStatue = on;
    const M = this.M;
    M.eye.emissiveIntensity = on ? 0 : 1.4;
    // 잠든 동안은 회색 돌, 깨어나면 제 색 + 반질한 비늘
    M.skin.color.set(on ? "#9a9a8e" : this.B.body);
    M.belly.color.set(on ? "#aaa89a" : this.B.belly);
    M.wing.color.set(on ? "#8a8a80" : this.B.wing);
    for (const k of ["skin", "belly", "wing"]) {
      M[k].map = on ? M.maps.stone : M.maps.live;
      M[k].roughness = on ? 0.85 : k === "wing" ? 0.7 : 0.55;
    }
    if (!on && this.B.extra === "icicles") M.skin.roughness = 0.25;
    if (this.B.extra === "lava") this.M.skin.emissiveIntensity = on ? 0.15 : 1.2;
    this.M.glow.emissiveIntensity = on ? 0.15 : 1.1;
  }
  get floorY() {
    return this.arena.c.y;
  }
  /** 이마 약점 수정 위치 */
  weakPos(out = new THREE.Vector3()) {
    return this.R.weak.getWorldPosition(out);
  }
  get weakOpen() {
    return this.state === "tired" || this.state === "stunned";
  }
  /** 보스와 주인공을 함께 비출 카메라 기준점 */
  focus(out = new THREE.Vector3()) {
    return out.copy(this.pos).setY(this.floorY + 2.4);
  }

  wake() {
    this.state = "awake";
    this.st = 0;
  }
  setState(s) {
    this.state = s;
    this.st = 0;
  }
  nextPattern(P) {
    if (!this.queue.length) {
      const bag = ["tail", "slam", "rain"];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      const n = this.phase2 ? 2 : 1 + (Math.random() < 0.5 ? 1 : 0);
      this.queue = bag.slice(0, n).concat(["charge"]);
    }
    const d = Math.hypot(P.pos.x - this.pos.x, P.pos.z - this.pos.z);
    let p = this.queue.shift();
    // 너무 가까우면 꼬리, 너무 멀면 돌진이 어울린다 (차례만 살짝 바꿈)
    if (p === "rain" && d < 3.5 && this.queue.includes("tail")) {
      this.queue.splice(this.queue.indexOf("tail"), 1, "rain");
      p = "tail";
    }
    return p;
  }

  /** @returns 일어난 일: { type: 'hurt', from } · 'warn' · 'slam' · 'roar' · 'crash' · 'hit' · 'dead' … */
  update(dt, P) {
    const ev = [];
    this.t += dt;
    this.st += dt;
    const W = this.phase2 ? 0.8 : 1; // 예고 시간 배율
    const pp = P.pos;
    const dx = pp.x - this.pos.x;
    const dz = pp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const faceTo = (tx, tz, rate) => {
      const target = Math.atan2(tx, tz);
      let d = target - this.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += clamp(d, -rate * dt, rate * dt);
      return Math.abs(d);
    };
    const pose = { lift: 0, neck: 0, jaw: 0, wing: 0.1, tailUp: 0, tailSway: Math.sin(this.t * 1.4) * 0.12, low: 0, walk: false, spin: 0, glowTail: 0 };
    const mk = this.mk;
    mk.annulus.material.opacity = 0;
    mk.lane.material.opacity = 0;
    mk.slamRing.material.opacity = 0;
    this.hurtT = Math.max(0, this.hurtT - dt);
    switch (this.state) {
      case "sleep":
        break;
      case "awake": {
        // 석상에서 깨어남: 눈 → 몸 → 날개 → 포효
        const k = this.st;
        if (k > 0.5 && this.isStatue) {
          this.statue(false);
          this.fx.shatter(this.pos.clone().setY(this.floorY + 2), 2.2, { power: 1.4 });
          ev.push({ type: "wake" });
        }
        pose.wing = Math.min(1, Math.max(0, (k - 0.8) / 0.6));
        pose.neck = -0.35 * Math.sin(Math.min(1, Math.max(0, (k - 1.2) / 1)) * Math.PI);
        pose.jaw = k > 1.3 && k < 2.4 ? 0.6 : 0;
        if (k > 1.3 && !this.roared) {
          this.roared = true;
          ev.push({ type: "roar" });
        }
        if (k > 2.8) this.setState("idle");
        break;
      }
      case "idle": {
        faceTo(dx, dz, 1.8);
        // 멀리 있으면 천천히 다가간다
        if (dist > 8.5) {
          const sp = 1.6 * this.B.speed;
          this.pos.x += (Math.sin(this.yaw) * sp) * dt;
          this.pos.z += (Math.cos(this.yaw) * sp) * dt;
          pose.walk = true;
        }
        if (this.st > (this.phase2 ? 0.75 : 1.2)) {
          const p = this.nextPattern(P);
          this.setState(p + "Wind");
          if (p === "charge") {
            this.laneDir = V(dx, 0, dz).normalize();
            if (!isFinite(this.laneDir.x)) this.laneDir.set(0, 0, 1);
          }
          if (p === "rain") this.rainSpots = this.pickRain(P);
          ev.push({ type: "warn", p });
        }
        break;
      }
      // 1) 꼬리 휘두르기
      case "tailWind": {
        const k = this.st / (1.05 * W);
        pose.tailUp = 0.5 * Math.min(1, k * 2);
        pose.glowTail = 1;
        pose.low = 0.1;
        mk.annulus.material.opacity = 0.18 + 0.22 * Math.min(1, k) + Math.sin(this.t * 20) * 0.08;
        if (k >= 1) {
          this.setState("tail");
          this.spinFrom = this.yaw;
          this.hitDone = false;
          ev.push({ type: "swoosh" });
        }
        break;
      }
      case "tail": {
        const dur = 0.75 * W;
        const k = Math.min(1, this.st / dur);
        this.yaw = this.spinFrom + ease(k) * TAU;
        pose.tailUp = 0.05;
        pose.glowTail = 1;
        pose.tailSway = 0.5;
        mk.annulus.material.opacity = 0.35;
        // 꼬리가 지나가는 방향 (꼬리는 몸 뒤쪽)
        const tailAng = this.yaw + Math.PI;
        const pAng = Math.atan2(dx, dz);
        let da = Math.atan2(Math.sin(pAng - tailAng), Math.cos(pAng - tailAng));
        const feet = pp.y - this.floorY;
        if (!this.hitDone && dist > 1.8 && dist < 8.0 && Math.abs(da) < 0.35 && feet < 0.9 && k > 0.05 && k < 0.98) {
          this.hitDone = true;
          ev.push({ type: "hurt", from: this.pos.clone() });
        }
        if (k >= 1) {
          this.setState("recover");
          this.patterns++;
        }
        break;
      }
      // 2) 돌진 → 벽에 쿵 → 어질어질 (약점)
      case "chargeWind": {
        const k = this.st / (1.1 * W);
        faceTo(this.laneDir.x, this.laneDir.z, 5);
        pose.low = 0.45 * Math.min(1, k * 2);
        pose.neck = 0.35;
        pose.jaw = 0.2;
        // 빨간 길 표시: 보스에서 경기장 끝까지
        const end = this.laneEnd();
        const len = Math.max(1, end.distanceTo(this.pos));
        mk.lane.scale.set(1, len, 1);
        mk.lane.position.set((this.pos.x + end.x) / 2, this.floorY + 0.04, (this.pos.z + end.z) / 2);
        mk.lane.rotation.z = -Math.atan2(this.laneDir.x, this.laneDir.z) + Math.PI;
        mk.lane.material.opacity = 0.18 + 0.25 * Math.min(1, k) + Math.sin(this.t * 22) * 0.08;
        if (Math.random() < 0.3) this.fx.puff(this.pos.x + Math.sin(this.yaw) * 1.4, this.floorY, this.pos.z + Math.cos(this.yaw) * 1.4, 0.8, 1);
        if (k >= 1) {
          this.setState("charge");
          this.hitDone = false;
          ev.push({ type: "chargeGo" });
        }
        break;
      }
      case "charge": {
        const sp = 13 * this.B.speed;
        this.pos.x += this.laneDir.x * sp * dt;
        this.pos.z += this.laneDir.z * sp * dt;
        pose.low = 0.4;
        pose.neck = 0.35;
        pose.walk = true;
        this.walk += dt * 10;
        // 몸통 선 (머리 ~ 엉덩이) 에 닿으면 아프다
        if (!this.hitDone) {
          const hx = this.pos.x + this.laneDir.x * 2.8;
          const hz = this.pos.z + this.laneDir.z * 2.8;
          const bx = this.pos.x - this.laneDir.x * 1.5;
          const bz = this.pos.z - this.laneDir.z * 1.5;
          const d = segDist(pp.x, pp.z, bx, bz, hx, hz);
          if (d < 1.75 && pp.y - this.floorY < 2.4) {
            this.hitDone = true;
            ev.push({ type: "hurt", from: this.pos.clone() });
          }
        }
        if (Math.random() < 0.6) this.fx.puff(this.pos.x, this.floorY, this.pos.z, 1, 1);
        const r = Math.hypot(this.pos.x - this.arena.c.x, this.pos.z - this.arena.c.z);
        if (r > this.arena.r - 3.2 || this.st > 2.2) {
          // 벽에 쿵!
          const k = (this.arena.r - 3.2) / Math.max(r, 0.01);
          if (r > this.arena.r - 3.2) {
            this.pos.x = this.arena.c.x + (this.pos.x - this.arena.c.x) * k;
            this.pos.z = this.arena.c.z + (this.pos.z - this.arena.c.z) * k;
          }
          this.setState("stunned");
          this.shake = 1;
          this.patterns++;
          ev.push({ type: "crash", p: this.headPos() });
        }
        break;
      }
      case "stunned":
      case "tired": {
        // 머리를 땅에 대고 이마 수정이 빛난다
        const dur = this.state === "stunned" ? 3.0 : 2.6;
        const k = Math.min(1, this.st / 0.45);
        pose.low = 0.9 * ease(k);
        pose.neck = 0.95 * ease(k);
        pose.jaw = 0.15;
        pose.wing = 0.0;
        if (this.st > dur || this.tiredHits >= 2) {
          this.setState("getup");
          this.tiredHits = 0;
          ev.push({ type: "roar", small: true });
        }
        break;
      }
      case "getup": {
        const k = Math.min(1, this.st / 0.6);
        pose.low = 0.9 * (1 - ease(k));
        pose.neck = 0.95 * (1 - ease(k));
        pose.wing = 0.5 * Math.sin(k * Math.PI);
        // 일어나며 살짝 밀어냄 (아프지 않음)
        if (dist < 5 && k < 0.5) ev.push({ type: "bump", from: this.pos.clone(), strength: 6 });
        if (k >= 1) this.setState("idle");
        break;
      }
      // 3) 바닥 충격파
      case "slamWind": {
        const k = this.st / (1.1 * W);
        faceTo(dx, dz, 1.5);
        pose.lift = 0.65 * ease(Math.min(1, k * 1.3));
        pose.wing = Math.min(1, k * 1.5);
        pose.jaw = 0.4;
        mk.slamRing.position.set(this.pos.x, this.floorY + 0.05, this.pos.z);
        mk.slamRing.scale.setScalar(2.4 + Math.sin(this.t * 14) * 0.15);
        mk.slamRing.material.opacity = 0.5 + Math.sin(this.t * 20) * 0.3;
        if (k >= 1) {
          this.setState("slam");
          this.wave(0);
          if (this.phase2 || this.B.extra === "fins") this.wave(0.65);
          this.shake = 0.8;
          ev.push({ type: "slam", p: this.pos.clone().setY(this.floorY) });
        }
        break;
      }
      case "slam": {
        const k = Math.min(1, this.st / 0.25);
        pose.lift = 0.65 * (1 - k);
        pose.wing = 1 - k * 0.6;
        if (this.st > 1.1) {
          this.setState("recover");
          this.patterns++;
        }
        break;
      }
      // 4) 떨어지는 것
      case "rainWind": {
        const k = this.st / (0.9 * W);
        pose.neck = -0.5 * Math.min(1, k * 2);
        pose.jaw = 0.7;
        pose.wing = 0.7;
        if (k >= 1) {
          this.setState("rain");
          for (const [i, s] of this.rainSpots.entries()) this.dropAt(s, 1.25 * W + i * 0.12);
          ev.push({ type: "roar", small: true });
        }
        break;
      }
      case "rain": {
        pose.neck = -0.3;
        pose.wing = 0.4;
        if (this.st > 1.8 * W) {
          this.setState("recover");
          this.patterns++;
        }
        break;
      }
      case "recover": {
        faceTo(dx, dz, 1.2);
        pose.jaw = 0.1;
        // 공격 두 번마다 한 번은 잠깐 지쳐서 약점을 보인다 (버튼 연타만으로는 못 이기게)
        if (this.st > 0.55) {
          if (this.patterns >= 2 && this.queue[0] !== "charge") {
            this.patterns = 0;
            this.setState("tired");
            ev.push({ type: "tired" });
          } else this.setState("idle");
        }
        break;
      }
      case "hurt": {
        pose.low = 0.9;
        pose.neck = 0.95 - Math.sin(Math.min(1, this.st / 0.35) * Math.PI) * 0.3;
        pose.jaw = 0.6;
        if (this.st > 0.4) this.state = this.prevWeak || "tired";
        break;
      }
      case "dying": {
        const k = Math.min(1, this.st / 2.2);
        pose.low = 1.1 * ease(k);
        pose.neck = 1.0;
        pose.wing = 0.3 * (1 - k);
        pose.jaw = 0.4;
        this.shake = 0.5 * (1 - k);
        if (Math.random() < 0.25) this.fx.sparkle(this.pos.clone().setY(this.floorY + 1 + Math.random() * 2.5), 6, [this.B.accent, "#ffffff"]);
        if (k >= 1) {
          this.setState("dead");
          this.R.root.visible = false;
          const c = this.pos.clone().setY(this.floorY + 1.6);
          this.fx.shatter(c, 2.6, { power: 2 });
          this.fx.shatter(c.clone().add(V(0, 1.2, 1.5)), 2, { power: 1.4 });
          ev.push({ type: "dead", p: c });
        }
        break;
      }
    }
    // 경기장 안에 머물기
    const rr = Math.hypot(this.pos.x - this.arena.c.x, this.pos.z - this.arena.c.z);
    const lim = this.arena.r - 3;
    if (rr > lim) {
      this.pos.x = this.arena.c.x + ((this.pos.x - this.arena.c.x) / rr) * lim;
      this.pos.z = this.arena.c.z + ((this.pos.z - this.arena.c.z) / rr) * lim;
    }
    // 충격파 · 떨어지는 것
    this.updateWaves(dt, P, ev);
    this.updateRain(dt, P, ev);
    // 몸에 닿으면 밀려남 (아프지 않음)
    if (this.state !== "dead" && this.state !== "dying" && this.state !== "sleep") {
      const bx = this.pos.x + Math.sin(this.yaw) * 0.6;
      const bz = this.pos.z + Math.cos(this.yaw) * 0.6;
      if (Math.hypot(pp.x - bx, pp.z - bz) < 2.5 && pp.y - this.floorY < 3) ev.push({ type: "bump", from: V(bx, 0, bz), strength: 3 });
    }
    if (pose.walk || this.state === "idle") this.walk += dt * (pose.walk ? 5 : 0);
    this.pose(pose, dt);
    this.place();
    return ev;
  }
  laneEnd() {
    // 보스에서 laneDir 로 경기장 끝까지
    const c = this.arena.c;
    const ox = this.pos.x - c.x;
    const oz = this.pos.z - c.z;
    const R = this.arena.r - 3.2;
    const b = ox * this.laneDir.x + oz * this.laneDir.z;
    const cc = ox * ox + oz * oz - R * R;
    const t = -b + Math.sqrt(Math.max(0, b * b - cc));
    return V(this.pos.x + this.laneDir.x * t, this.floorY, this.pos.z + this.laneDir.z * t);
  }
  headPos() {
    return this.R.head.getWorldPosition(new THREE.Vector3());
  }
  /** 떨어질 곳: 주인공 근처 + 경기장 여기저기 (피할 틈은 항상 남긴다) */
  pickRain(P) {
    const n = this.phase2 ? 6 : 4;
    const spots = [];
    const c = this.arena.c;
    spots.push(V(P.pos.x, this.floorY, P.pos.z));
    for (let i = 1; i < n; i++) {
      let x;
      let z;
      let tries = 0;
      do {
        const a = Math.random() * TAU;
        const r = i < 3 ? 2.8 + Math.random() * 1.5 : Math.random() * (this.arena.r - 2);
        x = (i < 3 ? P.pos.x : c.x) + Math.cos(a) * r;
        z = (i < 3 ? P.pos.z : c.z) + Math.sin(a) * r;
        tries++;
      } while (tries < 10 && (Math.hypot(x - c.x, z - c.z) > this.arena.r - 1.5 || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 2.6)));
      spots.push(V(x, this.floorY, z));
    }
    return spots;
  }
  dropAt(p, delay) {
    const kind = this.B.rain === "mix" ? ["rock", "fireball", "icicle", "crystal"][Math.floor(Math.random() * 4)] : this.B.rain;
    const colors = { rock: "#8a8a7a", drop: "#7ad8ff", crystal: "#c48aff", fireball: "#ff8a2a", icicle: "#cfefff" };
    let geo;
    if (kind === "icicle") {
      geo = new THREE.ConeGeometry(0.45, 2.0, 7);
      geo.rotateX(Math.PI);
    } else if (kind === "crystal") geo = new THREE.OctahedronGeometry(0.6, 0);
    else if (kind === "drop") geo = new THREE.SphereGeometry(0.55, 14, 10);
    else geo = new THREE.DodecahedronGeometry(0.6, 1);
    const glowy = kind === "fireball" || kind === "crystal";
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[kind], emissive: glowy ? colors[kind] : "#000000", emissiveIntensity: glowy ? 1.2 : 0, roughness: kind === "drop" || kind === "icicle" ? 0.1 : 0.8, transparent: kind === "drop", opacity: kind === "drop" ? 0.8 : 1 }));
    m.castShadow = true;
    m.visible = false;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: 0.5, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, p.y + 0.05, p.z);
    ring.scale.setScalar(0.3);
    this.root.add(m, ring);
    this.rains.push({ p, m, ring, t: -delay, done: false, kind });
  }
  updateRain(dt, P, ev) {
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      r.t += dt;
      const fallT = 0.45;
      if (r.t < -fallT) {
        // 예고: 고리가 커진다
        const k = 1 - (-r.t - fallT) / 1.2;
        r.ring.scale.setScalar(0.3 + Math.max(0, k) * 0.95);
        r.ring.material.opacity = 0.35 + Math.sin(r.t * 20) * 0.2;
      } else if (r.t < 0) {
        r.m.visible = true;
        const k = 1 + r.t / fallT;
        r.m.position.set(r.p.x, r.p.y + 0.5 + (1 - k) * 12, r.p.z);
        r.ring.scale.setScalar(1.2);
        r.ring.material.opacity = 0.8;
      } else if (!r.done) {
        r.done = true;
        this.fx.puff(r.p.x, r.p.y, r.p.z, 1.2, 4);
        this.fx.sparkle(r.p.clone().setY(r.p.y + 0.4), 10, [r.kind === "fireball" ? "#ff8a2a" : "#ffffff", "#ffe27a"]);
        ev.push({ type: "thud", p: r.p });
        if (Math.hypot(P.pos.x - r.p.x, P.pos.z - r.p.z) < 1.25 && P.pos.y - r.p.y < 1.4) ev.push({ type: "hurt", from: r.p.clone() });
        r.m.position.y = r.p.y + 0.5;
        r.ring.material.opacity = 0;
      } else if (r.t > 0.7) {
        this.root.remove(r.m, r.ring);
        r.m.geometry.dispose();
        r.m.material.dispose();
        r.ring.geometry.dispose();
        r.ring.material.dispose();
        this.rains.splice(i, 1);
      } else {
        r.m.material.transparent = true;
        r.m.material.opacity = Math.max(0, 1 - r.t / 0.7);
      }
    }
  }
  /** 퍼지는 충격파 고리 */
  wave(delay) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 8, 72), new THREE.MeshBasicMaterial({ color: this.B.accent, transparent: true, opacity: 0.9, depthWrite: false }));
    m.rotation.x = Math.PI / 2;
    m.visible = false;
    this.root.add(m);
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 72), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2;
    glow.visible = false;
    this.root.add(glow);
    this.waves.push({ m, glow, t: -delay, c: this.pos.clone().setY(this.floorY), hit: false });
  }
  updateWaves(dt, P, ev) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.t += dt;
      if (w.t < 0) continue;
      const R = 2 + w.t * 8.5;
      w.m.visible = w.glow.visible = true;
      w.m.position.set(w.c.x, w.c.y + 0.25, w.c.z);
      w.m.scale.set(R, R, 1.6);
      w.glow.position.set(w.c.x, w.c.y + 0.06, w.c.z);
      w.glow.scale.setScalar(R);
      const fade = Math.max(0, 1 - w.t / 1.4);
      w.m.material.opacity = 0.85 * fade;
      w.glow.material.opacity = 0.5 * fade;
      const d = Math.hypot(P.pos.x - w.c.x, P.pos.z - w.c.z);
      if (!w.hit && Math.abs(d - R) < 0.55 && P.pos.y - w.c.y < 0.45) {
        w.hit = true;
        ev.push({ type: "hurt", from: w.c.clone() });
      }
      if (R > this.arena.r + 1) {
        this.root.remove(w.m, w.glow);
        w.m.geometry.dispose();
        w.m.material.dispose();
        w.glow.geometry.dispose();
        w.glow.material.dispose();
        this.waves.splice(i, 1);
      }
    }
  }

  /** 방망이로 약점을 쳤는지 확인 → 맞으면 true */
  tryHit(P, fwd) {
    if (!this.weakOpen || this.hurtT > 0) return false;
    const w = this.weakPos();
    const dx = w.x - P.pos.x;
    const dz = w.z - P.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.1 || Math.abs(w.y - (P.pos.y + 0.7)) > 1.6) return false;
    if (d > 0.7 && (dx * fwd.x + dz * fwd.z) / d < 0.2) return false;
    this.hp -= 1;
    this.tiredHits++;
    this.hurtT = 0.35;
    this.prevWeak = this.state;
    this.fx.hitSpark(w, [this.B.weak, "#ffffff", "#ffe27a"]);
    this.fx.shatter(w, 0.7, { power: 0.6 });
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState("dying");
      this.clearAttacks();
      return true;
    }
    if (!this.phase2 && this.hp <= this.maxHp / 2) {
      this.phase2 = true;
      this.M.eye.emissiveIntensity = 2.2;
    }
    this.state = "hurt";
    this.st = 0;
    return true;
  }
  clearAttacks() {
    for (const w of this.waves) this.root.remove(w.m, w.glow);
    this.waves = [];
    for (const r of this.rains) this.root.remove(r.m, r.ring);
    this.rains = [];
  }

  /* ---------------- 자세 ---------------- */
  pose(p, dt) {
    const R = this.R;
    const t = this.t;
    const k = Math.min(1, dt * 8);
    const cur = this.cur || (this.cur = { lift: 0, neck: 0, jaw: 0, wing: 0, tailUp: 0, low: 0 });
    for (const key of ["lift", "neck", "jaw", "wing", "tailUp", "low"]) cur[key] += (p[key] - cur[key]) * k;
    const breathe = Math.sin(t * 1.6) * 0.04;
    R.body.position.y = 1.9 - cur.low * 0.9 + breathe + cur.lift * 0.6;
    R.body.rotation.x = -cur.lift * 0.6 + cur.low * 0.12;
    // 다리: 걷기 · 몸이 낮아지면 접힘
    for (const [i, L] of R.legs.entries()) {
      const ph = this.walk + (i % 2 ? Math.PI : 0) + (L.front ? 0 : Math.PI / 2);
      L.g.rotation.x = (p.walk ? Math.sin(ph) * 0.45 : 0) + (L.front ? cur.lift * 0.9 : 0);
      L.g.position.y = cur.low * 0.75 * (L.front ? 1 : 0.8) - (L.front ? cur.lift * 0.4 : 0);
    }
    // 목 · 머리 (낮추면 이마가 땅 가까이)
    R.neck.rotation.x = cur.neck * 0.7;
    for (const [i, s] of R.neckSegs.entries()) s.rotation.x = cur.neck * 0.25 + (i === 0 ? Math.sin(t * 1.3) * 0.03 : 0);
    R.head.rotation.x = -cur.neck * 0.1 + Math.sin(t * 1.1) * 0.04;
    R.jaw.rotation.x = cur.jaw * 0.55;
    // 날개 (접기 0 ~ 펼치기 1)
    for (const w of R.wings) {
      const open = cur.wing;
      w.g.rotation.set(-0.2 + open * 0.2, w.s * (1.25 - open * 0.95), w.s * (-0.9 + open * 0.75 + Math.sin(t * 2) * 0.05 * open));
    }
    // 꼬리
    const glow = this.state === "tailWind" || this.state === "tail";
    this.M.glow.emissiveIntensity = glow ? 1.6 + Math.sin(t * 20) * 0.6 : this.isStatue ? 0.15 : 1.1;
    for (const [i, s] of R.tail.entries()) {
      s.rotation.y = Math.sin(t * 1.4 - i * 0.5) * 0.08 + (this.state === "tail" ? 0.12 : 0) + p.tailSway * 0.02 * i;
      s.rotation.x = (i < 3 ? -cur.tailUp * 0.35 : cur.tailUp * 0.15) + (i > 4 ? 0.04 : 0);
    }
    // 약점 수정 (지쳤을 때 밝게)
    const open = this.weakOpen || this.state === "hurt";
    this.M.weak.emissiveIntensity = open ? 1.8 + Math.sin(t * 9) * 0.7 : 0.25;
    R.weakHalo.material.opacity = open ? 0.75 + Math.sin(t * 9) * 0.2 : 0;
    R.weak.rotation.y += dt * (open ? 3 : 0.6);
    // 눈: 공격 예고 때 번쩍
    if (!this.isStatue) {
      const warn = this.state.endsWith("Wind");
      this.M.eye.emissiveIntensity = (this.phase2 ? 2.2 : 1.4) + (warn ? Math.sin(t * 24) * 0.8 + 0.6 : 0);
    }
  }
  place() {
    const sh = this.calm ? 0 : this.shake;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.03);
    this.R.root.position.set(this.pos.x + (Math.random() - 0.5) * sh * 0.15, this.floorY, this.pos.z + (Math.random() - 0.5) * sh * 0.15);
    this.R.root.rotation.y = this.yaw;
    this.mk.annulus.position.set(this.pos.x, this.floorY + 0.04, this.pos.z);
  }
  dispose() {
    this.clearAttacks();
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && !Object.values(this.M).includes(o.material)) o.material.dispose && o.material.dispose();
    });
    // 재질 + 재질마다 복제해 둔 무늬 (보스를 만날 때마다 쌓이지 않게)
    const texs = new Set(Object.values(this.M.maps));
    for (const [k, m] of Object.entries(this.M)) {
      if (k === "maps") continue;
      for (const t of ["map", "bumpMap", "emissiveMap"]) if (m[t]) texs.add(m[t]);
      m.dispose();
    }
    for (const t of texs) t.dispose();
  }
}
function segDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const L2 = abx * abx + abz * abz || 1;
  const u = clamp(((px - ax) * abx + (pz - az) * abz) / L2, 0, 1);
  return Math.hypot(px - (ax + abx * u), pz - (az + abz * u));
}
