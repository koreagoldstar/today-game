/*
 * 사람 (표적 요원 · 경비 · 민간인) — 부위마다 한 메쉬(꼭짓점 색) · 걷기 · 두리번 · 창가 오가기 · 쓰러지기
 *  맞는 자리(머리 · 몸통 · 다리)는 보이지 않는 상자 — 총알 판정에 씀
 *  아이도 하는 사이트라 피는 없음: 맞으면 뒤로 쓰러지고 먼지만 남
 */
import { THREE, Batch, mat4, rng, pick, clamp, std } from "./kit.js";

const SKIN = ["#e8c4a4", "#d8a884", "#bd8a66", "#8a5e42", "#efd0b4"];
const HAIR = ["#1b1714", "#31241b", "#57402a", "#8a6a44", "#2a2a2a", "#b09a70", "#77777a"];
const SHIRT = ["#7f3b33", "#2f4a6e", "#a68f52", "#3f5f4c", "#c9c6bc", "#55406a", "#a86a34", "#4a7683", "#8a4a60", "#5f6a70", "#3a3d42", "#8b8578"];
const PANTS = ["#2a3347", "#3b3c3e", "#5a4d3c", "#1d2127", "#4a5866", "#70634e"];

export const ACTOR_MAT = std({ vertexColors: true, roughness: 0.82 });
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

/** 생김새 정하기 */
export function look(kind, seed = 1, over = {}) {
  const r = rng(seed * 131 + kind.length * 7);
  const base = {
    kind,
    skin: pick(r, SKIN),
    hair: pick(r, HAIR),
    jacket: pick(r, SHIRT),
    shirt: "#d9d6cc",
    pants: pick(r, PANTS),
    shoes: "#191715",
    tie: null,
    glasses: null,
    hat: null,
    hatType: null,
    bag: null,
    rifle: false,
    vest: null,
    long: r() < 0.3,
    longHair: r() < 0.35,
    suit: false,
  };
  if (kind === "agent") Object.assign(base, { jacket: "#1b1d22", pants: "#1b1d22", tie: "#c8222a", glasses: "#b3121c", hair: "#171412", shoes: "#0c0c0c", suit: true, longHair: false });
  else if (kind === "boss") Object.assign(base, { jacket: "#d9d4c6", pants: "#d9d4c6", shirt: "#17171a", tie: "#c8222a", glasses: "#121212", hat: "#d9d4c6", hatType: "fedora", shoes: "#33261b", suit: true, longHair: false });
  else if (kind === "guard") Object.assign(base, { jacket: "#454c30", pants: "#373d27", shirt: "#454c30", vest: "#2b301f", hat: "#2f3424", hatType: "helmet", rifle: true, glasses: "#121212", longHair: false });
  else if (kind === "sniper") Object.assign(base, { jacket: "#3a3e38", pants: "#2c302a", vest: "#4f5447", hat: "#3a3e38", hatType: "helmet", rifle: true, glasses: "#b3121c", longHair: false });
  else if (kind === "courier") Object.assign(base, { jacket: "#565e68", pants: "#565e68", tie: "#2f4f8f", bag: "#33241a", suit: true, longHair: false });
  else if (kind === "worker") Object.assign(base, { jacket: "#c96d1c", pants: "#2a3347", vest: "#d8c42a", hat: "#f2c230", hatType: "hard", longHair: false });
  const o = Object.assign(base, over);
  if (o.hat && !o.hatType) o.hatType = "fedora";
  return o;
}

/* ---------- 도형 ---------- */
/** 고리들을 이어 만든 몸 조각: [y, 가로 반지름, 앞뒤 반지름, 앞뒤 치우침] */
function loft(rings, seg = 14) {
  const pos = [];
  const idx = [];
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const [y, rx, rz, cz = 0, cx = 0] = rings[i];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pos.push(cx + Math.cos(a) * rx, y, cz + Math.sin(a) * rz);
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < seg; k++) {
      const a = i * seg + k;
      const b = i * seg + ((k + 1) % seg);
      const c = a + seg;
      const d = b + seg;
      if (rings[i][0] < rings[i + 1][0]) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  // 양 끝 막기
  const low = pos.length / 3;
  const [y0, , , c0 = 0, x0 = 0] = rings[0];
  pos.push(x0, y0, c0);
  const high = pos.length / 3;
  const [y1, , , c1 = 0, x1 = 0] = rings[n - 1];
  pos.push(x1, y1, c1);
  const up = rings[0][0] < rings[n - 1][0];
  for (let k = 0; k < seg; k++) {
    const a = k;
    const b = (k + 1) % seg;
    if (up) idx.push(low, a, b);
    else idx.push(low, b, a);
    const c = (n - 1) * seg + k;
    const d = (n - 1) * seg + ((k + 1) % seg);
    if (up) idx.push(high, d, c);
    else idx.push(high, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const BOXG = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(1, 14, 10);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const HALF = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const GEO = {
  // 몸통: 골반 → 허리 → 가슴 → 어깨 (앞으로 살짝 가슴)
  torso: loft([
    [0.9, 0.165, 0.112],
    [0.98, 0.16, 0.108],
    [1.08, 0.152, 0.102, 0.004],
    [1.2, 0.168, 0.112, 0.012],
    [1.32, 0.19, 0.122, 0.012],
    [1.42, 0.205, 0.112, 0.004],
    [1.475, 0.17, 0.088],
    [1.5, 0.085, 0.07],
  ]),
  coat: loft([
    [0.72, 0.205, 0.145],
    [0.84, 0.192, 0.135],
    [0.98, 0.17, 0.118],
    [1.08, 0.158, 0.108, 0.004],
    [1.2, 0.174, 0.118, 0.012],
    [1.32, 0.196, 0.128, 0.012],
    [1.42, 0.212, 0.118, 0.004],
    [1.478, 0.172, 0.09],
    [1.5, 0.085, 0.07],
  ]),
  vest: loft([
    [1.0, 0.178, 0.128],
    [1.12, 0.176, 0.13, 0.006],
    [1.26, 0.192, 0.142, 0.012],
    [1.38, 0.208, 0.14, 0.008],
    [1.44, 0.19, 0.118, 0.004],
  ]),
  // 다리: 허벅지 · 정강이 (피벗 기준 아래로)
  thigh: loft([
    [0.03, 0.075, 0.085],
    [-0.1, 0.078, 0.088, 0.004],
    [-0.28, 0.062, 0.07, 0.004],
    [-0.43, 0.053, 0.058],
  ]),
  shin: loft([
    [0.02, 0.053, 0.058],
    [-0.1, 0.054, 0.062, -0.008],
    [-0.28, 0.044, 0.05, -0.004],
    [-0.42, 0.038, 0.042],
  ]),
  shoe: loft([
    [0, 0.05, 0.09, 0.05],
    [0.045, 0.052, 0.128, 0.052],
    [0.085, 0.044, 0.09, 0.022],
    [0.1, 0.036, 0.05, -0.002],
  ]),
  upper: loft([
    [0.03, 0.05, 0.056],
    [-0.08, 0.052, 0.056],
    [-0.2, 0.043, 0.046],
    [-0.29, 0.037, 0.04],
  ]),
  fore: loft([
    [0.02, 0.037, 0.04],
    [-0.08, 0.038, 0.04],
    [-0.2, 0.03, 0.032],
    [-0.26, 0.027, 0.028],
  ]),
  hand: loft([
    [0, 0.027, 0.02],
    [-0.04, 0.038, 0.016],
    [-0.08, 0.036, 0.014],
    [-0.11, 0.022, 0.011],
  ]),
  head: loft([
    [-0.122, 0.034, 0.04, 0.03],
    [-0.1, 0.06, 0.07, 0.022],
    [-0.06, 0.081, 0.092, 0.012],
    [-0.015, 0.094, 0.108, 0.006],
    [0.035, 0.1, 0.117, 0],
    [0.08, 0.096, 0.112, -0.004],
    [0.115, 0.074, 0.088, -0.006],
    [0.135, 0.036, 0.044, -0.006],
    [0.14, 0.004, 0.004, -0.006],
  ]),
  hairTop: loft([
    [0.015, 0.104, 0.122, -0.012],
    [0.06, 0.106, 0.122, -0.008],
    [0.1, 0.092, 0.106, -0.006],
    [0.13, 0.062, 0.074, -0.006],
    [0.15, 0.022, 0.026, -0.006],
  ]),
  hairBack: loft([
    [-0.2, 0.082, 0.05, -0.08],
    [-0.1, 0.1, 0.07, -0.07],
    [0, 0.106, 0.09, -0.05],
    [0.06, 0.1, 0.08, -0.05],
  ]),
};

/* ---------- 몸 만들기 ---------- */
function part(build, fn) {
  const b = new Batch();
  fn(b);
  const g = new THREE.Group();
  build.add(g);
  b.build(g, { cast: true, receive: false, block: false });
  return g;
}

export class Actor {
  constructor(L, opts = {}) {
    this.L = L;
    this.target = !!opts.target;
    this.civilian = !!opts.civilian;
    this.bonus = !!opts.bonus;
    this.id = opts.id || 0;
    this.root = new THREE.Group();
    this.root.userData.actor = this;
    this.body = new THREE.Group();
    this.root.add(this.body);
    const M = ACTOR_MAT;
    const C = (h) => new THREE.Color(h);
    const shade = (h, k) => new THREE.Color(h).multiplyScalar(k);
    // 다리 (허벅지 + 무릎 + 정강이 + 신발)
    this.legs = [];
    this.shins = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.092, 0.93, 0);
      this.body.add(pivot);
      part(pivot, (b) => b.add(M, GEO.thigh, mat4(), C(L.pants)));
      const knee = new THREE.Group();
      knee.position.set(0, -0.43, 0);
      pivot.add(knee);
      part(knee, (b) => {
        b.add(M, GEO.shin, mat4(), shade(L.pants, 0.92));
        b.add(M, GEO.shoe, mat4(0, -0.5, 0), C(L.shoes));
      });
      this.legs.push(pivot);
      this.shins.push(knee);
    }
    // 몸통
    part(this.body, (b) => {
      const jc = C(L.jacket);
      b.add(M, L.long ? GEO.coat : GEO.torso, mat4(), jc);
      // 허리 그늘 · 벨트
      if (!L.long) b.add(M, CYL, mat4(0, 0.92, 0, 0, 0, 0, 0.168, 0.05, 0.114), shade(L.pants, 0.8));
      if (L.suit || L.tie) {
        // V 자 셔츠 + 넥타이 + 깃
        b.add(M, BOXG, mat4(0, 1.36, 0.113, 0.1, 0, 0, 0.088, 0.2, 0.012), C(L.shirt));
        if (L.tie) {
          b.add(M, BOXG, mat4(0, 1.33, 0.124, 0.1, 0, 0, 0.036, 0.25, 0.008), C(L.tie));
          b.add(M, BOXG, mat4(0, 1.46, 0.112, 0.2, 0, 0.78, 0.034, 0.034, 0.012), C(L.tie));
        }
        for (const s of [-1, 1]) b.add(M, BOXG, mat4(s * 0.062, 1.33, 0.118, 0.1, 0, s * -0.32, 0.055, 0.25, 0.02), shade(L.jacket, 1.12));
      }
      if (L.vest) {
        b.add(M, GEO.vest, mat4(), C(L.vest));
        for (const s of [-1, 1]) b.add(M, BOXG, mat4(s * 0.08, 1.14, 0.132, 0, 0, 0, 0.09, 0.1, 0.03), shade(L.vest, 0.82));
      }
      // 목
      b.add(M, CYL, mat4(0, 1.53, 0.004, 0, 0, 0, 0.05, 0.09, 0.052), C(L.skin));
      if (L.rifle) {
        const gun = C("#1d2024");
        b.add(M, BOXG, mat4(0.02, 1.22, 0.175, 0, 0, -0.75, 0.05, 0.62, 0.07), gun);
        b.add(M, CYL, mat4(-0.255, 1.51, 0.175, 0, 0, -0.75, 0.012, 0.42, 0.012), gun);
        b.add(M, BOXG, mat4(0.27, 0.98, 0.175, 0, 0, -0.75, 0.05, 0.26, 0.06), C("#33291f"));
        b.add(M, BOXG, mat4(0.06, 1.1, 0.175, 0, 0, -0.1, 0.035, 0.16, 0.05), gun);
      }
    });
    // 머리
    this.head = new THREE.Group();
    this.head.position.set(0, 1.64, 0);
    this.body.add(this.head);
    part(this.head, (b) => {
      const sk = C(L.skin);
      b.add(M, GEO.head, mat4(), sk);
      b.add(M, SPH, mat4(0, -0.012, 0.114, 0, 0, 0, 0.017, 0.026, 0.022), shade(L.skin, 0.96)); // 코
      for (const s of [-1, 1]) {
        b.add(M, SPH, mat4(s * 0.099, -0.005, -0.004, 0, 0, 0, 0.012, 0.026, 0.018), sk); // 귀
        if (!L.glasses) {
          b.add(M, SPH, mat4(s * 0.039, 0.022, 0.103, 0, 0, 0, 0.014, 0.009, 0.006), C("#17120e")); // 눈
          b.add(M, BOXG, mat4(s * 0.04, 0.042, 0.103, 0, 0, s * -0.1, 0.036, 0.007, 0.006), C(L.hair));
        }
      }
      b.add(M, BOXG, mat4(0, -0.055, 0.1, 0, 0, 0, 0.036, 0.005, 0.006), shade(L.skin, 0.62)); // 입
      b.add(M, GEO.hairTop, mat4(), C(L.hair));
      if (L.longHair) b.add(M, GEO.hairBack, mat4(), C(L.hair));
      if (L.glasses) {
        const gl = C(L.glasses);
        for (const s of [-1, 1]) b.add(M, SPH, mat4(s * 0.04, 0.022, 0.1, 0, 0, 0, 0.033, 0.024, 0.012), gl);
        b.add(M, BOXG, mat4(0, 0.028, 0.108, 0, 0, 0, 0.03, 0.006, 0.006), gl);
        for (const s of [-1, 1]) b.add(M, BOXG, mat4(s * 0.09, 0.028, 0.048, 0, 0, 0, 0.006, 0.006, 0.11), gl);
      }
      if (L.hat) {
        const hc = C(L.hat);
        const t = L.hatType;
        if (t === "fedora") {
          b.add(M, CYL, mat4(0, 0.086, -0.004, 0, 0, 0, 0.158, 0.012, 0.175), hc);
          b.add(M, loftCrown(), mat4(0, 0.09, -0.004), hc);
          b.add(M, CYL, mat4(0, 0.1, -0.004, 0, 0, 0, 0.102, 0.022, 0.116), shade(L.hat, 0.45));
        } else if (t === "helmet") {
          b.add(M, HALF, mat4(0, 0.03, -0.004, 0, 0, 0, 0.122, 0.128, 0.136), hc);
          b.add(M, CYL, mat4(0, 0.03, -0.004, 0, 0, 0, 0.126, 0.012, 0.14), shade(L.hat, 0.8));
        } else if (t === "hard") {
          b.add(M, HALF, mat4(0, 0.045, -0.004, 0, 0, 0, 0.114, 0.104, 0.126), hc);
          b.add(M, CYL, mat4(0, 0.05, 0.025, 0, 0, 0, 0.126, 0.01, 0.146), hc);
          b.add(M, BOXG, mat4(0, 0.112, -0.004, 0, 0, 0, 0.022, 0.03, 0.22), shade(L.hat, 0.92));
        } else if (t === "beret") {
          b.add(M, SPH, mat4(0.012, 0.094, -0.008, 0, 0, -0.14, 0.122, 0.044, 0.128), hc);
          b.add(M, CYL, mat4(0, 0.066, -0.006, 0, 0, 0, 0.1, 0.018, 0.114), shade(L.hat, 0.72));
        } else {
          // 군모 (챙 + 넓은 위)
          b.add(M, CYL, mat4(0, 0.082, -0.004, 0, 0, 0, 0.104, 0.05, 0.118), hc);
          b.add(M, CYL, mat4(0, 0.12, -0.012, 0, 0, 0, 0.13, 0.03, 0.146), hc);
          b.add(M, CYL, mat4(0, 0.062, 0.1, -0.3, 0, 0, 0.08, 0.008, 0.045), C("#121212"));
        }
      }
    });
    // 팔 (윗팔 + 팔꿈치 + 아래팔 + 손)
    this.arms = [];
    this.fores = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.212, 1.42, 0);
      pivot.rotation.z = s * 0.05;
      this.body.add(pivot);
      part(pivot, (b) => b.add(M, GEO.upper, mat4(), C(L.jacket)));
      const el = new THREE.Group();
      el.position.set(0, -0.29, 0);
      el.rotation.x = -0.14;
      pivot.add(el);
      part(el, (b) => {
        b.add(M, GEO.fore, mat4(), shade(L.jacket, 0.95));
        b.add(M, GEO.hand, mat4(0, -0.26, 0), C(L.skin));
        if (L.bag && s > 0) {
          b.add(M, BOXG, mat4(0, -0.5, 0.005, 0, 0, 0, 0.075, 0.27, 0.36), C(L.bag));
          b.add(M, BOXG, mat4(0, -0.355, 0.005, 0, 0, 0, 0.012, 0.03, 0.09), C("#8a7a50"));
        }
      });
      this.arms.push(pivot);
      this.fores.push(el);
    }
    // 맞는 자리 (보이지 않음)
    this.hit = {};
    const hb = (name, geo, x, y, z, sx, sy, sz, parent) => {
      const m = new THREE.Mesh(geo, HIT_MAT);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.userData.hitbox = { actor: this, part: name };
      (parent || this.body).add(m);
      this.hit[name] = m;
    };
    hb("head", SPH, 0, 0.01, 0, 0.12, 0.15, 0.135, this.head);
    hb("chest", BOXG, 0, 1.2, 0, 0.5, 0.56, 0.3);
    hb("legs", BOXG, 0, 0.46, 0, 0.36, 0.92, 0.26);
    // 상태
    this.state = "idle";
    this.t = Math.random() * 10;
    this.walkPh = Math.random() * 6;
    this.speed = 0;
    this.downT = -1;
    this.alive = true;
    this.gone = false;
    this.behavior = null;
    this.headYaw = 0;
    this.pose = opts.pose || "stand";
    this.applyPose();
  }

  applyPose() {
    if (this.pose === "phone") {
      this.arms[1].rotation.set(-0.5, 0, -0.42);
      this.fores[1].rotation.x = -2.25;
    } else if (this.pose === "kneel") {
      this.legs[0].rotation.x = -1.5;
      this.shins[0].rotation.x = 1.5;
      this.legs[1].rotation.x = 0.1;
      this.shins[1].rotation.x = 1.6;
      this.body.position.y = -0.42;
    } else if (this.pose === "aim") {
      this.arms[0].rotation.set(-1.25, 0, 0.5);
      this.fores[0].rotation.x = -0.4;
      this.arms[1].rotation.set(-0.95, 0, -0.1);
      this.fores[1].rotation.x = -1.0;
    } else if (this.pose === "lean") {
      this.body.rotation.z = 0.06;
    }
  }

  place(pos, yaw) {
    this.root.position.copy(pos);
    this.root.rotation.y = yaw;
    this.baseYaw = yaw;
  }

  /** 맞은 뒤: 무릎이 풀리며 뒤로 쓰러짐 */
  down(part) {
    if (!this.alive) return;
    this.alive = false;
    this.state = "down";
    this.downT = 0;
    this.downPart = part;
    this.fallSide = Math.random() < 0.5 ? -1 : 1;
  }

  update(dt) {
    this.t += dt;
    const B = this.body;
    if (this.state === "down") {
      this.downT += dt;
      const k = clamp(this.downT / 0.62, 0, 1);
      const e = k * k * (3 - 2 * k);
      this.root.rotation.x = -e * 1.5;
      this.root.rotation.z = this.fallSide * e * 0.16;
      B.position.y = -e * 0.14;
      this.legs[0].rotation.x = e * 0.35;
      this.legs[1].rotation.x = -e * 0.18;
      this.shins[0].rotation.x = e * 0.7;
      this.shins[1].rotation.x = e * 0.25;
      this.arms.forEach((a, i) => a.rotation.set(-e * 2.3, 0, (i ? -1 : 1) * e * 0.7));
      this.fores.forEach((f) => (f.rotation.x = -0.14 - e * 0.4));
      this.head.rotation.x = -e * 0.2;
      return;
    }
    if (this.gone) return;
    if (this.behavior) this.behavior(this, dt);
    // 걷기 · 달리기
    if (this.speed > 0.05) {
      const run = clamp((this.speed - 1.6) / 1.5, 0, 1);
      this.walkPh += dt * (this.speed * 3.1 + 1.6);
      const s = Math.sin(this.walkPh);
      const c = Math.cos(this.walkPh);
      const sw = 0.46 + run * 0.34;
      this.legs[0].rotation.x = s * sw;
      this.legs[1].rotation.x = -s * sw;
      this.shins[0].rotation.x = Math.max(0, c) * (0.8 + run * 0.7) + 0.06;
      this.shins[1].rotation.x = Math.max(0, -c) * (0.8 + run * 0.7) + 0.06;
      if (this.pose !== "phone" && this.pose !== "aim") {
        this.arms[0].rotation.x = -s * (0.38 + run * 0.4);
        this.arms[1].rotation.x = s * (0.38 + run * 0.4);
        this.fores[0].rotation.x = -0.25 - run * 0.9;
        this.fores[1].rotation.x = -0.25 - run * 0.9;
      }
      B.position.y = Math.abs(c) * (0.024 + run * 0.03) - 0.018;
      B.rotation.x = 0.03 + run * 0.14;
    } else if (this.pose === "stand" || this.pose === "phone" || this.pose === "lean") {
      const f = Math.pow(0.0015, dt);
      for (const l of this.legs) l.rotation.x *= f;
      for (const l of this.shins) l.rotation.x *= f;
      if (this.pose !== "phone") {
        this.arms[0].rotation.x *= f;
        this.arms[1].rotation.x *= f;
        this.fores[0].rotation.x = -0.14 + (this.fores[0].rotation.x + 0.14) * f;
        this.fores[1].rotation.x = -0.14 + (this.fores[1].rotation.x + 0.14) * f;
      }
      B.rotation.x *= f;
      B.position.y = Math.sin(this.t * 1.5) * 0.005;
    }
    // 두리번
    this.head.rotation.y += (this.headYaw - this.head.rotation.y) * Math.min(1, dt * 3);
    if (Math.floor(this.t / 3.1) !== Math.floor((this.t - dt) / 3.1)) this.headYaw = (Math.random() - 0.5) * 1.2;
  }

  /** 머리 · 가슴 가운데 (조준 보조 · 점검용) */
  headPos(v = new THREE.Vector3()) {
    return this.hit.head.getWorldPosition(v);
  }
  chestPos(v = new THREE.Vector3()) {
    return this.hit.chest.getWorldPosition(v);
  }
}

let CROWN = null;
function loftCrown() {
  if (!CROWN)
    CROWN = loft([
      [0, 0.104, 0.118],
      [0.06, 0.1, 0.112],
      [0.095, 0.086, 0.096],
      [0.108, 0.05, 0.06],
    ]);
  return CROWN;
}

/* ---------- 움직임 ---------- */
/** 길 따라 걷기: points(세계 좌표) · loop(되돌아오기) · pause(끝에서 쉬기) · onEnd(끝나면) */
export function walkPath(points, { speed = 1.3, loop = true, pause = 1.5, onEnd = null, start = 0 } = {}) {
  const P = points.map((p) => p.clone());
  let i = start % P.length;
  let dir = 1;
  let wait = 0;
  return (a, dt) => {
    if (wait > 0) {
      wait -= dt;
      a.speed = 0;
      return;
    }
    const next = i + dir;
    if (next < 0 || next >= P.length) {
      if (!loop) {
        a.speed = 0;
        if (onEnd) onEnd(a);
        return;
      }
      dir = -dir;
      wait = pause;
      return;
    }
    const tgt = P[next];
    const pos = a.root.position;
    const dx = tgt.x - pos.x;
    const dz = tgt.z - pos.z;
    const dy = tgt.y - pos.y;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      i = next;
      if (i === 0 || i === P.length - 1) wait = pause;
      return;
    }
    const step = Math.min(d, speed * dt);
    pos.x += (dx / d) * step;
    pos.z += (dz / d) * step;
    pos.y += dy * (step / Math.max(d, 1e-6));
    const yaw = Math.atan2(dx, dz);
    let dyaw = yaw - a.root.rotation.y;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    a.root.rotation.y += dyaw * Math.min(1, dt * 8);
    a.speed = speed;
  };
}

/** 창가 오가기: 창 앞으로 나왔다(보임) 안으로 들어갔다(숨음) */
export function peek(inPos, outPos, { show = 3.5, hide = 3, phase = 0 } = {}) {
  let t = phase;
  return (a, dt) => {
    t += dt;
    const cyc = show + hide + 2;
    const k = t % cyc;
    let f;
    if (k < 1) f = k;
    else if (k < 1 + show) f = 1;
    else if (k < 2 + show) f = 2 + show - k;
    else f = 0;
    const e = f * f * (3 - 2 * f);
    a.root.position.lerpVectors(inPos, outPos, e);
    a.speed = f > 0 && f < 1 ? 0.6 : 0;
    a.exposed = e > 0.5;
  };
}
