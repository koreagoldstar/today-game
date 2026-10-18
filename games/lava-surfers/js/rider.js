/*
 * 용암 서핑 · 주인공 '피코' + 용암 서핑 보드
 *  코드로 만든 3D 모형 + 관절 애니메이션 (외부 모델 파일 없음).
 *  - 피코: 주황 내열복(은색 반사띠) · 하얀 장갑 · 큰 부츠 · 불꽃 모양 앞머리 · 이마 위 호박색 고글 · 냉각 팬 배낭
 *  - 보드: 흑요석 판 + 주황으로 빛나는 무늬 · 금색 테 · 뒤쪽 쌍 추진기(부스터 때 불꽃)
 *  - 발은 보드 위 고정점에 붙어 있다: 다리는 두 마디 IK 로 무릎만 굽힌다 (발이 보드에서 떨어지지 않음)
 *  - 동작: ready · ride · jump · air · land · crash · boost · win · lose
 *  - 표정: 눈(뜸 · 웃음 · 질끈 · 슬픔) · 입(미소 · 벌림 · 오 · 시무룩 · 이 꽉) · 눈썹 · 깜빡임
 *  자세 값은 매 프레임 목표를 계산해 부드럽게 따라간다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { roundedBox, taperTube } from "./geo.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

function eyeTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.translate(64, 64);
  const g = x.createRadialGradient(0, 10, 4, 0, 0, 62);
  g.addColorStop(0, "#7ae0d0");
  g.addColorStop(0.45, "#2a9a92");
  g.addColorStop(0.85, "#155a5a");
  g.addColorStop(1, "#0a2a2c");
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, 62, 0, TAU);
  x.fill();
  x.strokeStyle = "rgba(200,255,240,0.25)";
  x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    x.beginPath();
    x.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
    x.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
    x.stroke();
  }
  x.fillStyle = "#081414";
  x.beginPath();
  x.arc(0, 2, 27, 0, TAU);
  x.fill();
  x.fillStyle = "#ffffff";
  x.beginPath();
  x.ellipse(-20, -22, 15, 12, -0.5, 0, TAU);
  x.fill();
  x.beginPath();
  x.arc(18, 22, 7, 0, TAU);
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function runeTex() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#000";
  x.fillRect(0, 0, 64, 256);
  x.strokeStyle = "#fff";
  x.lineWidth = 3;
  x.lineCap = "round";
  // 가운데 선 + 화살 무늬
  x.beginPath();
  x.moveTo(32, 20);
  x.lineTo(32, 236);
  x.stroke();
  for (let i = 0; i < 5; i++) {
    const y = 40 + i * 42;
    x.beginPath();
    x.moveTo(12, y + 14);
    x.lineTo(32, y);
    x.lineTo(52, y + 14);
    x.stroke();
  }
  x.lineWidth = 2;
  x.strokeRect(6, 6, 52, 244);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makeMats() {
  const S = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
  return {
    skin: S("#ffd6bc", { roughness: 0.55, emissive: "#ff7a5a", emissiveIntensity: 0.06 }),
    blush: new THREE.MeshBasicMaterial({ color: "#ff8a7a", transparent: true, opacity: 0.45, depthWrite: false }),
    hair: S("#d8542e", { roughness: 0.45, side: THREE.DoubleSide }),
    hairTip: S("#ffb14a", { roughness: 0.45 }),
    suit: S("#ff8a3a", { roughness: 0.62 }),
    suitDk: S("#c85a2a", { roughness: 0.65 }),
    stripe: S("#e8eef4", { roughness: 0.25, metalness: 0.6 }),
    glove: S("#fff6ea", { roughness: 0.6 }),
    boot: S("#3a3440", { roughness: 0.55 }),
    sole: S("#ffb14a", { roughness: 0.6 }),
    pack: S("#5a6878", { roughness: 0.5, metalness: 0.4 }),
    fan: S("#c8d0d8", { roughness: 0.3, metalness: 0.8 }),
    led: S("#7af4ff", { emissive: "#3ae0ff", emissiveIntensity: 1.6 }),
    strap: S("#3a3440", { roughness: 0.6 }),
    brass: S("#e0b45a", { roughness: 0.28, metalness: 0.85 }),
    lens: S("#ffb84a", { roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85, emissive: "#ff8a2a", emissiveIntensity: 0.25 }),
    white: S("#ffffff", { roughness: 0.18 }),
    iris: new THREE.MeshBasicMaterial({ map: eyeTex(), transparent: true }),
    dark: S("#2a1612", { roughness: 0.5 }),
    mouth: S("#5a1c22", { roughness: 0.6, side: THREE.DoubleSide }),
    tongue: S("#ff8a8a", { roughness: 0.6 }),
    teeth: S("#ffffff", { roughness: 0.3 }),
    board: S("#1e1a22", { roughness: 0.22, metalness: 0.35 }),
    boardBot: S("#3a2a2a", { roughness: 0.5, emissive: "#ff4a1a", emissiveIntensity: 0.35 }),
    rune: new THREE.MeshBasicMaterial({ color: "#ff9a3a", map: runeTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    rail: S("#e8b85a", { roughness: 0.25, metalness: 0.9 }),
    nozzle: S("#4a4450", { roughness: 0.4, metalness: 0.8 }),
    flame: new THREE.MeshBasicMaterial({ color: "#ffb04a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}

const geoCache = new Map();
function cg(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const sphere = (seg = 24) => cg("sph" + seg, () => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)));
function mesh(geo, mat, pos = [0, 0, 0], scale = 1, rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scale === "number") m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}
function lathe(points, seg = 28) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    seg
  );
}
function onHead(R, yaw, pitch, out = 1) {
  return V(Math.sin(yaw) * Math.cos(pitch) * R * out, Math.sin(pitch) * R * out, Math.cos(yaw) * Math.cos(pitch) * R * out);
}
/** 머리카락: 뒤로 넘긴 짧은 머리 껍질 + 앞에 불꽃 모양으로 솟은 앞머리 */
function hairGeo(R) {
  const segU = 80;
  const segV = 16;
  const pos = [];
  const idx = [];
  const sm = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const edge = (a) => {
    const A = Math.abs(a);
    const front = 0.9 + 0.12 * Math.pow(Math.abs(Math.cos(a * 6)), 3);
    const side = 1.75 + 0.12 * Math.pow(Math.abs(Math.cos(A * 6)), 4);
    const back = 2.25 + 0.08 * Math.pow(Math.abs(Math.cos(a * 8)), 3);
    const wf = 1 - sm(0.8, 1.15, A);
    const wb = sm(1.9, 2.35, A);
    return front * wf + back * wb + side * Math.max(0, 1 - wf - wb);
  };
  const rows = segV + 2;
  for (let i = 0; i < segU; i++) {
    const a = -Math.PI + (i / segU) * TAU;
    const e = edge(a);
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const th = v * e;
      const r = R * (1.09 - 0.05 * v * v + 0.025 * Math.sin(a * 11) * v);
      pos.push(Math.sin(a) * Math.sin(th) * r * 1.04, Math.cos(th) * r * 0.97, Math.cos(a) * Math.sin(th) * r * 0.98);
    }
    const th = e + 0.02;
    const r = R * 0.985;
    pos.push(Math.sin(a) * Math.sin(th) * r * 1.04, Math.cos(th) * r * 0.97, Math.cos(a) * Math.sin(th) * r * 0.98);
  }
  for (let i = 0; i < segU; i++) {
    const i2 = (i + 1) % segU;
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j;
      const b = i2 * rows + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** 같은 재질 메시 합치기 (관절 그룹 단위) */
function mergeChildren(group) {
  const by = new Map();
  for (const c of group.children) {
    if (!c.isMesh || c.material.transparent || c.userData.keep) continue;
    if (!by.has(c.material)) by.set(c.material, []);
    by.get(c.material).push(c);
  }
  for (const [mat, list] of by) {
    if (list.length < 2) continue;
    const pos = [];
    const nor = [];
    const uv = [];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const N = new THREE.Matrix3();
    for (const c of list) {
      c.updateMatrix();
      N.getNormalMatrix(c.matrix);
      const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry;
      const p = g.getAttribute("position");
      const no = g.getAttribute("normal");
      const u = g.getAttribute("uv");
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(c.matrix);
        pos.push(v.x, v.y, v.z);
        n.fromBufferAttribute(no, i).applyMatrix3(N).normalize();
        nor.push(n.x, n.y, n.z);
        uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
      }
      if (g !== c.geometry) g.dispose();
      group.remove(c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    group.add(new THREE.Mesh(g, mat));
  }
}

/* 다리 길이 · 보드 위 발 자리 */
const THIGH = 0.2;
const SHIN = 0.2;
const BOARD_TOP = 0.16;
const FOOT_Z = 0.3; // 보드 앞뒤로 발 간격(절반)
const DOWN = V(0, -1, 0);

export class Rider {
  constructor() {
    this.M = makeMats();
    this.group = new THREE.Group(); // 세계 위치 · 보드 방향 (game 이 정함)
    this.spinG = new THREE.Group(); // 공중 회전
    this.spinG.scale.setScalar(1.18); // 화면에서 잘 보이게 조금 크게 (충돌 크기는 player.js)
    this.group.add(this.spinG);
    this.state = "ready";
    this.st = 0;
    this.t = 0;
    this.blinkT = 2;
    this.blink = 0;
    this.P = {};
    this.lean = 0; // 좌우 입력 (-1 왼쪽 · 1 오른쪽)
    this.speed01 = 0;
    this.boost = 0;
    this.spin = 0;
    this.buildBoard();
    this.build();
    this.expression("open", "smile");
  }

  /* ---------------- 보드 ---------------- */
  buildBoard() {
    const M = this.M;
    const b = (this.board = new THREE.Group());
    this.spinG.add(b);
    // 위에서 본 모양: 앞은 둥글고 뒤는 각진 서핑 보드 (위 · 아래 판을 따로)
    const shape = new THREE.Shape();
    const L = 0.78;
    const W = 0.25;
    shape.moveTo(0, L);
    shape.bezierCurveTo(W * 0.9, L * 0.92, W * 1.05, L * 0.45, W, 0);
    shape.bezierCurveTo(W, -L * 0.5, W * 0.85, -L * 0.85, W * 0.55, -L);
    shape.lineTo(-W * 0.55, -L);
    shape.bezierCurveTo(-W * 0.85, -L * 0.85, -W, -L * 0.5, -W, 0);
    shape.bezierCurveTo(-W * 1.05, L * 0.45, -W * 0.9, L * 0.92, 0, L);
    const deck = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 18 });
    deck.rotateX(-Math.PI / 2);
    deck.translate(0, 0.08, 0);
    // 코를 살짝 들어 올림
    const p = deck.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const z = -p.getZ(i);
      if (z > 0.45) p.setY(i, p.getY(i) + (z - 0.45) * (z - 0.45) * 0.55);
      if (z < -0.6) p.setY(i, p.getY(i) + (-0.6 - z) * 0.12);
    }
    deck.computeVertexNormals();
    const dm = mesh(deck, M.board, [0, 0, 0], 1, [0, Math.PI, 0]);
    b.add(dm);
    // 아랫면 열 차폐판 (빛남)
    const bot = mesh(cg("boardBot", () => new THREE.ShapeGeometry(shape, 16).rotateX(Math.PI / 2)), M.boardBot, [0, 0.05, 0], [0.92, 1, 0.92]);
    b.add(bot);
    // 금색 테
    const rim = [];
    const pts = shape.getSpacedPoints(60);
    for (const q of pts) rim.push(V(q.x, 0.115, -q.y));
    b.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 80, 0.014, 6, true), M.rail));
    // 빛나는 무늬
    const rn = mesh(new THREE.PlaneGeometry(0.3, 1.3), M.rune, [0, 0.138, 0.02], 1, [-Math.PI / 2, 0, 0]);
    rn.castShadow = false;
    rn.userData.keep = true;
    b.add(rn);
    this.rune = rn;
    // 발판 (미끄럼 방지 패드)
    for (const z of [FOOT_Z, -FOOT_Z]) b.add(mesh(cg("pad", () => roundedBox(0.36, 0.012, 0.2, 0.04)), M.boot, [0, 0.142, z]));
    // 뒤쪽 쌍 추진기 + 불꽃
    this.flames = [];
    for (const s of [-1, 1]) {
      b.add(mesh(cg("nozzle", () => lathe([[0.0, 0.0], [0.045, 0.0], [0.055, -0.08], [0.04, -0.12], [0.0, -0.12]], 14)), M.nozzle, [s * 0.1, 0.07, -0.74], 1, [-Math.PI / 2, 0, 0]));
      const f = mesh(cg("flame", () => new THREE.ConeGeometry(0.05, 0.4, 10).translate(0, -0.2, 0)), M.flame, [s * 0.1, 0.07, -0.86], 1, [-Math.PI / 2, 0, 0]);
      f.castShadow = false;
      f.userData.keep = true;
      b.add(f);
      this.flames.push(f);
    }
    // 앞쪽 아래 지느러미
    b.add(mesh(cg("fin", () => roundedBox(0.02, 0.08, 0.16, 0.01)), M.rail, [0, 0.02, -0.55]));
    mergeChildren(b);
  }

  /* ---------------- 피코 ---------------- */
  build() {
    const M = this.M;
    const J = (this.J = {});
    // 보드 위에서 옆으로 선다: 몸 앞(+z) = 보드 오른쪽(+x)
    const rider = (J.rider = new THREE.Group());
    rider.rotation.y = Math.PI / 2;
    this.spinG.add(rider);
    const hips = (J.hips = new THREE.Group());
    hips.position.y = 0.48;
    rider.add(hips);
    hips.add(mesh(sphere(24), M.suit, [0, 0.02, 0], [0.165, 0.11, 0.135]));
    hips.add(mesh(cg("belt", () => new THREE.TorusGeometry(0.152, 0.022, 10, 36)), M.strap, [0, 0.07, 0], [1, 1, 0.86], [Math.PI / 2, 0, 0]));
    hips.add(mesh(cg("buckle", () => roundedBox(0.07, 0.05, 0.018, 0.008)), M.brass, [0, 0.07, 0.13]));
    // 다리 (허벅지 → 무릎 → 발목): IK 로 각도를 정한다
    for (const s of [1, -1]) {
      const side = s > 0 ? "L" : "R";
      const leg = (J["leg" + side] = new THREE.Group());
      leg.position.set(0.08 * s, 0, 0);
      hips.add(leg);
      leg.add(mesh(cg("thigh", () => lathe([[0.0, 0.03], [0.065, 0.03], [0.085, -0.03], [0.084, -0.1], [0.07, -0.17], [0.0, -0.2]])), M.suit));
      leg.add(mesh(cg("kneePad", () => new THREE.SphereGeometry(0.06, 14, 10)), M.stripe, [0, -0.19, 0.045], [1, 1, 0.6]));
      const knee = (J["knee" + side] = new THREE.Group());
      knee.position.y = -THIGH;
      leg.add(knee);
      knee.add(mesh(cg("shin", () => lathe([[0.0, 0.0], [0.06, 0.0], [0.062, -0.06], [0.06, -0.1], [0.0, -0.1]])), M.suit));
      knee.add(mesh(cg("bootShaft", () => lathe([[0.0, -0.09], [0.074, -0.09], [0.078, -0.15], [0.074, -0.2], [0.0, -0.2]])), M.boot));
      knee.add(mesh(cg("bootRing", () => new THREE.TorusGeometry(0.075, 0.012, 8, 22)), M.stripe, [0, -0.095, 0], 1, [Math.PI / 2, 0, 0]));
      const foot = (J["foot" + side] = new THREE.Group());
      foot.position.y = -SHIN;
      knee.add(foot);
      foot.add(mesh(sphere(20), M.boot, [0, 0.0, 0.03], [0.075, 0.055, 0.11]));
      foot.add(mesh(cg("sole", () => roundedBox(0.14, 0.03, 0.23, 0.014)), M.sole, [0, -0.035, 0.03]));
    }
    // 몸통 (내열복 + 반사띠)
    const spine = (J.spine = new THREE.Group());
    spine.position.y = 0.06;
    hips.add(spine);
    spine.add(mesh(cg("torso", () => lathe([[0.0, 0.0], [0.14, 0.0], [0.162, 0.05], [0.17, 0.12], [0.16, 0.19], [0.128, 0.235], [0.075, 0.262], [0.0, 0.27]], 32)), M.suit, [0, 0, 0], [1, 1, 0.86]));
    spine.add(mesh(cg("stripeBand", () => new THREE.TorusGeometry(0.168, 0.016, 8, 36)), M.stripe, [0, 0.105, 0], [1, 1, 0.86], [Math.PI / 2, 0, 0]));
    spine.add(mesh(cg("zip", () => roundedBox(0.016, 0.2, 0.01, 0.004)), M.stripe, [0, 0.14, 0.142]));
    spine.add(mesh(cg("collar", () => new THREE.TorusGeometry(0.085, 0.03, 10, 28)), M.suitDk, [0, 0.258, 0.005], [1, 1, 0.9], [Math.PI / 2 + 0.1, 0, 0]));
    // 가슴 배지 (불꽃)
    spine.add(mesh(cg("badge", () => new THREE.CylinderGeometry(0.03, 0.03, 0.01, 18)), M.brass, [-0.07, 0.18, 0.133], 1, [Math.PI / 2 - 0.2, 0, 0]));
    // 냉각 팬 배낭
    const pack = (J.pack = new THREE.Group());
    pack.position.set(0, 0.13, -0.15);
    spine.add(pack);
    pack.add(mesh(cg("packBody", () => roundedBox(0.24, 0.26, 0.12, 0.05)), M.pack));
    pack.add(mesh(cg("fanRing", () => new THREE.TorusGeometry(0.075, 0.014, 8, 24)), M.fan, [0, 0.01, -0.065]));
    const fan = (J.fan = new THREE.Group());
    fan.position.set(0, 0.01, -0.066);
    fan.userData.keep = true;
    pack.add(fan);
    for (let i = 0; i < 4; i++) {
      const bl = mesh(cg("fanBlade", () => roundedBox(0.03, 0.065, 0.006, 0.006)), M.fan, [0, 0.035, 0], 1, [0, 0.35, 0]);
      const g = new THREE.Group();
      g.rotation.z = (i / 4) * TAU;
      g.add(bl);
      fan.add(g);
    }
    pack.add(mesh(cg("antenna", () => new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6)), M.strap, [0.08, 0.2, 0]));
    const ledM = mesh(sphere(10), M.led, [0.08, 0.285, 0], 0.018);
    ledM.userData.keep = true;
    pack.add(ledM);
    for (const s of [1, -1]) spine.add(mesh(cg("pstrap" + s, () => taperTube([V(0.08 * s, 0.24, -0.1), V(0.1 * s, 0.27, -0.01), V(0.12 * s, 0.22, 0.09), V(0.14 * s, 0.1, 0.1)], () => 0.016, 14, 6, { flat: 0.4 })), M.strap));
    // 팔
    for (const s of [1, -1]) {
      const side = s > 0 ? "L" : "R";
      const sh = (J["sh" + side] = new THREE.Group());
      sh.position.set(0.155 * s, 0.205, 0);
      spine.add(sh);
      sh.add(mesh(sphere(16), M.suit, [0, 0, 0], 0.054));
      sh.add(mesh(cg("upperArm", () => new THREE.CapsuleGeometry(0.046, 0.075, 6, 14)), M.suit, [0, -0.06, 0]));
      const el = (J["el" + side] = new THREE.Group());
      el.position.y = -0.12;
      sh.add(el);
      el.add(mesh(cg("foreArm", () => new THREE.CapsuleGeometry(0.043, 0.06, 6, 14)), M.suit, [0, -0.04, 0]));
      el.add(mesh(cg("cuff", () => lathe([[0.0, 0.0], [0.053, 0.0], [0.056, -0.03], [0.05, -0.04], [0.0, -0.04]], 20)), M.stripe, [0, -0.065, 0]));
      const hand = (J["hand" + side] = new THREE.Group());
      hand.position.y = -0.12;
      el.add(hand);
      hand.add(mesh(sphere(18), M.glove, [0, -0.012, 0.005], [0.056, 0.06, 0.05]));
      hand.add(mesh(sphere(12), M.glove, [-0.038 * s, -0.004, 0.026], [0.022, 0.03, 0.022], [0, 0, 0.4 * s]));
    }
    // 목 · 머리
    const neck = (J.neck = new THREE.Group());
    neck.position.y = 0.255;
    spine.add(neck);
    neck.add(mesh(cg("neckGeo", () => new THREE.CylinderGeometry(0.045, 0.05, 0.06, 14)), M.skin, [0, 0.02, 0]));
    const head = (J.head = new THREE.Group());
    head.position.y = 0.24;
    neck.add(head);
    this.buildHead(head);
    const groups = [];
    rider.traverse((o) => o.isGroup && groups.push(o));
    for (const g of groups) mergeChildren(g);
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !o.material.transparent;
        o.receiveShadow = false;
      }
    });
  }

  buildHead(head) {
    const M = this.M;
    const J = this.J;
    const R = 0.29;
    head.add(mesh(sphere(40), M.skin, [0, 0, 0], [R * 1.04, R * 0.96, R * 0.98]));
    for (const s of [1, -1]) {
      const p = onHead(R, 0.52 * s, -0.24, 1.0);
      const b = mesh(cg("blush", () => new THREE.CircleGeometry(0.046, 20)), M.blush, [p.x, p.y, p.z], [1, 0.6, 1]);
      b.lookAt(p.clone().multiplyScalar(2));
      b.position.copy(p.multiplyScalar(1.004));
      head.add(b);
      // 주근깨 세 점
      for (let i = 0; i < 3; i++) {
        const q = onHead(R, (0.44 + i * 0.06) * s, -0.15 - (i % 2) * 0.04, 1.003);
        head.add(mesh(sphere(8), M.suitDk, [q.x, q.y, q.z], 0.006));
      }
    }
    head.add(mesh(sphere(12), M.skin, [0, -0.075, R * 0.965], [0.02, 0.015, 0.014]));
    const eyes = (J.eyes = { open: [], happy: [], squint: [], sad: [] });
    for (const s of [1, -1]) {
      const p = onHead(R, 0.34 * s, -0.04, 0.9);
      const g = new THREE.Group();
      g.position.copy(p);
      g.lookAt(p.clone().multiplyScalar(3).add(V(0, 0, 0.3)));
      head.add(g);
      g.add(mesh(sphere(24), M.white, [0, 0, 0], [0.074, 0.09, 0.04]));
      const iris = mesh(cg("iris", () => new THREE.CircleGeometry(0.062, 32)), M.iris, [0, -0.004, 0.039]);
      iris.castShadow = false;
      g.add(iris);
      eyes.open.push(g);
      const mk = (fn) => {
        const gg = new THREE.Group();
        gg.position.copy(p.clone().multiplyScalar(1.08));
        gg.lookAt(p.clone().multiplyScalar(3));
        fn(gg);
        head.add(gg);
        return gg;
      };
      eyes.happy.push(mk((gg) => gg.add(mesh(cg("happyArc", () => new THREE.TorusGeometry(0.045, 0.011, 6, 18, Math.PI)), M.dark, [0, -0.015, 0]))));
      eyes.squint.push(mk((gg) => [1, -1].forEach((k) => gg.add(mesh(cg("squintLine", () => roundedBox(0.075, 0.016, 0.01, 0.006)), M.dark, [0, 0.016 * k, 0], 1, [0, 0, 0.42 * k * -s])))));
      eyes.sad.push(mk((gg) => gg.add(mesh(cg("happyArc", () => new THREE.TorusGeometry(0.045, 0.011, 6, 18, Math.PI)), M.dark, [0, 0.02, 0], 1, [0, 0, Math.PI]))));
    }
    J.brows = [];
    for (const s of [1, -1]) {
      const p = onHead(R, 0.33 * s, 0.24, 1.0);
      const g = new THREE.Group();
      g.position.copy(p);
      g.lookAt(p.clone().multiplyScalar(3));
      g.add(mesh(cg("brow", () => taperTube([V(-0.04, -0.004, 0), V(0, 0.008, 0), V(0.04, -0.002, 0)], (t) => 0.012 - Math.abs(t - 0.4) * 0.008, 10, 6)), M.hair));
      g.userData.side = s;
      head.add(g);
      J.brows.push(g);
    }
    const mp = onHead(R, 0, -0.42, 1.0);
    const mouth = (J.mouth = {});
    const mk = (name) => {
      const g = new THREE.Group();
      g.position.copy(mp);
      g.lookAt(mp.clone().multiplyScalar(3));
      head.add(g);
      mouth[name] = g;
      return g;
    };
    mk("smile").add(mesh(cg("smileArc", () => new THREE.TorusGeometry(0.036, 0.009, 6, 16, Math.PI)), M.dark, [0, 0.012, 0.002], 1, [0, 0, Math.PI]));
    const open = mk("open");
    open.add(mesh(sphere(18), M.mouth, [0, 0, -0.004], [0.034, 0.028, 0.012]));
    open.add(mesh(sphere(12), M.tongue, [0, -0.012, 0.004], [0.018, 0.008, 0.008]));
    mk("o").add(mesh(sphere(14), M.mouth, [0, -0.004, 0], [0.02, 0.027, 0.015]));
    mk("frown").add(mesh(cg("smileArc", () => new THREE.TorusGeometry(0.036, 0.009, 6, 16, Math.PI)), M.dark, [0, -0.02, 0.002]));
    const grit = mk("grit");
    grit.add(mesh(cg("gritBack", () => roundedBox(0.075, 0.03, 0.01, 0.012)), M.mouth, [0, -0.004, -0.002]));
    grit.add(mesh(cg("gritTeeth", () => roundedBox(0.068, 0.016, 0.012, 0.006)), M.teeth, [0, -0.002, 0.002]));
    // 머리카락 + 불꽃 앞머리
    head.add(mesh(cg("hair", () => hairGeo(R)), M.hair));
    const tuft = new THREE.Group();
    tuft.position.set(0.02, R * 0.88, 0.1);
    head.add(tuft);
    for (const [x, h, a, z] of [
      [0, 0.2, 0.1, 0],
      [0.06, 0.15, -0.35, -0.02],
      [-0.06, 0.13, 0.5, -0.03],
    ]) {
      tuft.add(mesh(cg("tuft" + h, () => taperTube([V(0, 0, 0), V(0.01, h * 0.5, 0.02), V(-0.03, h, -0.04)], (t) => 0.05 * (1 - t * 0.92), 10, 8)), M.hair, [x, 0, z], 1, [-0.2, 0, a]));
    }
    tuft.add(mesh(sphere(10), M.hairTip, [-0.02, 0.19, -0.03], 0.018));
    J.tuft = tuft;
    // 이마 위 고글 (호박색 렌즈)
    const gog = new THREE.Group();
    gog.position.set(0, R * 0.52, R * 0.72);
    gog.rotation.x = -0.75;
    head.add(gog);
    gog.add(mesh(cg("gogStrap", () => new THREE.TorusGeometry(0.3, 0.014, 6, 44)), M.strap, [0, 0, -0.21], [1.02, 1, 1], [Math.PI / 2, 0, 0]));
    for (const s of [1, -1]) {
      const lens = new THREE.Group();
      lens.position.set(0.075 * s, 0, 0.02);
      lens.rotation.y = 0.28 * s;
      gog.add(lens);
      lens.add(mesh(cg("gogCup", () => new THREE.CylinderGeometry(0.054, 0.06, 0.04, 22)), M.strap, [0, 0, -0.012], 1, [Math.PI / 2, 0, 0]));
      lens.add(mesh(cg("gogRim", () => new THREE.TorusGeometry(0.054, 0.012, 10, 26)), M.brass, [0, 0, 0.01]));
      lens.add(mesh(cg("gogGlass", () => new THREE.SphereGeometry(0.051, 22, 12, 0, TAU, 0, 1.0)), M.lens, [0, 0, -0.018], [1, 1, 0.75], [Math.PI / 2, 0, 0]));
    }
  }

  expression(eyes, mouth, brow = "normal") {
    const E = this.J.eyes;
    for (const k of ["open", "happy", "squint", "sad"]) for (const g of E[k]) g.visible = k === eyes;
    for (const [k, g] of Object.entries(this.J.mouth)) g.visible = k === mouth;
    this.browMode = brow;
  }

  play(state, opts = {}) {
    if (this.state === state && !opts.restart) return;
    this.state = state;
    this.st = 0;
    this.opts = opts;
    const face = {
      ready: ["open", "smile", "brave"],
      ride: ["open", "smile"],
      jump: ["open", "open", "up"],
      air: ["happy", "open", "up"],
      land: ["open", "smile"],
      crash: ["squint", "grit", "worried"],
      boost: ["squint", "grit", "brave"],
      win: ["happy", "open", "up"],
      lose: ["sad", "frown", "worried"],
      scared: ["open", "o", "worried"],
    }[state] || ["open", "smile"];
    this.expression(face[0], face[1], face[2]);
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  update(dt) {
    this.t += dt;
    this.st += dt;
    const s = this.state;
    const st = this.st;
    const t = this.t;
    const sp = clamp(this.speed01, 0, 1);
    const lean = this.lean;
    // 목표 자세
    const T = {
      hipH: 0.43, // 엉덩이 높이 (낮을수록 많이 웅크림)
      tilt: 0, // 몸이 발끝(+) / 발뒤꿈치(-) 쪽으로 기울기 (= 보드 좌우로 기울이며 돌기)
      twist: 0, // 상체를 진행 방향으로 비틈
      sway: 0, // 진행 방향 앞뒤로 무게 옮기기
      armUpL: 1.2, // 팔을 옆으로 벌림 (균형)
      armUpR: 1.2,
      armFwdL: 0.1,
      armFwdR: 0.1,
      elL: -0.5,
      elR: -0.5,
      headY: -1.15, // 진행 방향(보드 앞)을 본다
      headP: 0,
      boardRoll: 0,
      boardPitch: 0,
      sq: 1,
      grab: 0,
    };
    let rate = 14;
    const bob = Math.sin(t * 9) * 0.006 * (0.3 + sp);
    if (s === "ready") {
      // 출발 준비: 낮게 웅크렸다 폈다 · 보드를 발로 툭툭
      const k = Math.sin(t * 4.2);
      T.hipH = 0.36 + k * 0.025;
      T.sway = 0.05;
      T.armUpL = 0.6 + k * 0.1;
      T.armUpR = 0.7 - k * 0.1;
      T.elL = -1.2;
      T.elR = -1.4;
      T.armFwdL = 0.6;
      T.armFwdR = 0.7;
      T.headY = -1.0 + Math.sin(t * 0.8) * 0.15;
      rate = 8;
    } else if (s === "ride" || s === "boost") {
      const boost = s === "boost";
      T.hipH = (boost ? 0.33 : 0.39 - sp * 0.04) + bob;
      T.tilt = lean * 0.42;
      T.twist = lean * 0.18;
      T.boardRoll = -lean * 0.32;
      T.sway = boost ? 0.12 : 0.03;
      T.armUpL = boost ? 0.35 : 1.15 - lean * 0.35;
      T.armUpR = boost ? 0.35 : 1.15 + lean * 0.35;
      T.armFwdL = boost ? -0.9 : 0.15;
      T.armFwdR = boost ? -0.9 : 0.15;
      T.elL = boost ? -0.2 : -0.45;
      T.elR = boost ? -0.2 : -0.45;
      T.headY = -1.15 + lean * 0.15;
      T.headP = boost ? -0.12 : 0;
      rate = 12;
    } else if (s === "jump") {
      // 점프 순간: 웅크렸다가 쭉
      const k = Math.min(1, st / 0.14);
      T.hipH = 0.3 + 0.16 * k;
      T.armUpL = 1.7 * k + 0.6;
      T.armUpR = 1.7 * k + 0.6;
      T.headP = -0.15;
      rate = 30;
      if (st > 0.14) this.play("air");
    } else if (s === "air") {
      // 공중: 무릎을 당기고 (보드도 몸 쪽으로) 한 손으로 보드 끝 잡기
      const k = Math.min(1, st / 0.3);
      T.hipH = 0.43 - 0.13 * k;
      T.grab = k;
      T.armUpL = 1.9;
      T.armFwdL = 0.3;
      T.elL = -0.3;
      T.armUpR = 0.3 * (1 - k) + 0.1;
      T.armFwdR = 0.9 * k;
      T.elR = -0.9 * k;
      T.tilt = 0.25 * k + lean * 0.2;
      T.boardPitch = 0.12;
      T.headY = -1.05;
      T.headP = -0.1;
      rate = 14;
    } else if (s === "land") {
      const k = Math.min(1, st / 0.22);
      const amt = (this.opts && this.opts.k) || 0.6;
      const sq = Math.sin(k * Math.PI) * 0.12 * amt;
      T.hipH = 0.39 - sq * 1.2;
      T.armUpL = 1.4;
      T.armUpR = 1.4;
      T.tilt = 0.15 * (1 - k);
      rate = 28;
      if (st > 0.24) this.play("ride");
    } else if (s === "crash") {
      // 휘청: 팔 허우적 · 몸이 뒤로 젖혀졌다 돌아옴 · 보드 흔들
      const w = Math.sin(st * 22) * Math.max(0, 1 - st / 0.9);
      T.hipH = 0.34;
      T.tilt = -0.45 + w * 0.25;
      T.armUpL = 1.6 + w * 0.8;
      T.armUpR = 1.4 - w * 0.8;
      T.armFwdL = 0.8 + w;
      T.armFwdR = -0.6 - w;
      T.elL = -0.6;
      T.elR = -1.2;
      T.boardRoll = w * 0.4;
      T.headP = 0.25;
      T.headY = -0.8 + w * 0.3;
      rate = 20;
      if (st > 0.9) this.play("ride");
    } else if (s === "win") {
      // 안전지대: 보드 위에서 폴짝폴짝 만세
      const h = Math.abs(Math.sin(st * 5));
      T.hipH = 0.36 + h * 0.08;
      T.armUpL = 2.8;
      T.armUpR = 2.6 + Math.sin(st * 10) * 0.2;
      T.elL = -0.3;
      T.elR = -0.4;
      T.headY = -0.3 + Math.sin(st * 2) * 0.3;
      T.headP = -0.25;
      T.twist = 0.6;
      rate = 14;
    } else if (s === "lose") {
      // 털썩: 보드 위에 주저앉아 고개 푹
      const k = Math.min(1, st / 0.6);
      T.hipH = 0.43 - 0.2 * k;
      T.tilt = -0.2 * k;
      T.armUpL = 0.25;
      T.armUpR = 0.25;
      T.armFwdL = 0.5;
      T.armFwdR = 0.5;
      T.elL = -0.6;
      T.elR = -0.6;
      T.headP = 0.5 * k;
      T.headY = -0.4;
      rate = 6;
    } else if (s === "scared") {
      // 뒤에서 용암! 뒤돌아보며 깜짝
      T.hipH = 0.38;
      T.headY = 1.2;
      T.armUpL = 1.9;
      T.armUpR = 1.9;
      T.elL = -1.3;
      T.elR = -1.3;
      rate = 16;
    }
    const P = this.P;
    for (const k in T) P[k] = P[k] == null ? T[k] : damp(P[k], T[k], rate, dt);
    this.apply(P, dt);
    // 깜빡임 · 눈썹
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 0.13;
      this.blinkT = 2 + Math.random() * 2.8;
    }
    if (this.blink > 0) this.blink -= dt;
    const bl = this.blink > 0 ? Math.max(0.1, Math.abs(this.blink - 0.065) / 0.065) : 1;
    for (const g of this.J.eyes.open) g.scale.y = bl;
    const bm = this.browMode;
    for (const g of this.J.brows) {
      const sd = g.userData.side;
      const tgtY = bm === "up" ? 0.012 : bm === "worried" ? 0.006 : bm === "brave" ? -0.006 : 0;
      const tgtR = bm === "worried" ? -0.35 * sd : bm === "brave" ? 0.3 * sd : 0;
      g.userData.y = damp(g.userData.y || 0, tgtY, 12, dt);
      g.userData.r = damp(g.userData.r || 0, tgtR, 12, dt);
      g.children[0].position.y = g.userData.y;
      g.children[0].rotation.z = g.userData.r;
    }
    // 보드 불꽃 · 무늬 · 팬
    const b = this.boost;
    for (const f of this.flames) {
      f.visible = b > 0.02;
      f.scale.set(0.8 + b * 0.5, 0.6 + b * (1.4 + Math.sin(t * 40) * 0.3), 0.8 + b * 0.5);
    }
    this.rune.material.opacity = 0.55 + sp * 0.3 + b * 0.3 + Math.sin(t * 6) * 0.08;
    this.J.fan.rotation.z += dt * (10 + sp * 25);
    // 앞머리가 바람에 뒤로
    this.J.tuft.rotation.x = -0.15 - sp * 0.5 + Math.sin(t * 17) * 0.05 * sp;
    // 공중 회전
    this.spinG.rotation.y = this.spin;
  }

  /** 자세 → 관절 (다리는 IK: 발은 보드 위 고정) */
  apply(P) {
    const J = this.J;
    // 보드: 좌우 기울기 · 앞뒤 기울기 · 공중에서 몸 쪽으로 당김
    const pull = P.grab * 0.12;
    this.board.position.y = pull;
    this.board.rotation.set(P.boardPitch, 0, P.boardRoll);
    // 엉덩이 (라이더 기준: +z = 몸 앞 = 보드 오른쪽, +x = 몸 왼쪽 = 보드 뒤)
    const hy = P.hipH;
    J.hips.position.set(-P.sway * 0.4, hy, P.tilt * 0.12);
    J.hips.rotation.set(P.tilt * 0.5, P.twist * 0.4, 0);
    J.spine.rotation.set(P.tilt * 0.5, P.twist, 0);
    J.head.rotation.set(P.headP - P.tilt * 0.6, P.headY - P.twist, 0);
    J.shL.rotation.set(-P.armFwdL, 0, P.armUpL);
    J.shR.rotation.set(-P.armFwdR, 0, -P.armUpR);
    J.elL.rotation.x = P.elL;
    J.elR.rotation.x = P.elR;
    // 다리 IK
    for (const s of [1, -1]) {
      const side = s > 0 ? "L" : "R";
      const leg = J["leg" + side];
      const knee = J["knee" + side];
      const foot = J["foot" + side];
      // 발 자리 (라이더 좌표): 보드의 앞(-x 쪽 = 오른발) · 뒤(+x 쪽 = 왼발)
      // 보드가 앞뒤로 기울면(boardPitch) 앞발 · 뒷발 높이가 달라진다 (좌우 기울기는 발이 가운데 줄이라 거의 같음)
      const footTarget = V(FOOT_Z * s, BOARD_TOP + pull + 0.035 + FOOT_Z * s * Math.sin(P.boardPitch), 0.0);
      // 엉덩이 관절 위치 (라이더 좌표)
      const hip = V(0.08 * s, 0, 0).applyEuler(J.hips.rotation).add(J.hips.position);
      const d = footTarget.clone().sub(hip);
      let L = d.length();
      const maxL = THIGH + SHIN - 0.002;
      if (L > maxL) L = maxL;
      const dir = d.normalize();
      // 무릎이 굽는 쪽 = 몸 앞(+z) 조금 바깥
      const pole = V(0.15 * s, 0, 1).normalize();
      const pv = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
      const cosA = clamp((THIGH * THIGH + L * L - SHIN * SHIN) / (2 * THIGH * L), -1, 1);
      const A = Math.acos(cosA);
      const thighDir = dir.clone().multiplyScalar(Math.cos(A)).addScaledVector(pv, Math.sin(A)).normalize();
      const kneeP = hip.clone().addScaledVector(thighDir, THIGH);
      const shinDir = footTarget.clone().sub(kneeP).normalize();
      // 허벅지: 엉덩이 그룹 안에서 방향 맞추기
      const hipQ = new THREE.Quaternion().setFromEuler(J.hips.rotation);
      const invHip = hipQ.clone().invert();
      const tL = thighDir.clone().applyQuaternion(invHip);
      leg.quaternion.setFromUnitVectors(DOWN, tL);
      const legWorldQ = hipQ.clone().multiply(leg.quaternion);
      const sL = shinDir.clone().applyQuaternion(legWorldQ.clone().invert());
      knee.quaternion.setFromUnitVectors(DOWN, sL);
      // 발: 라이더 좌표계와 나란히 (보드 위에 평평하게)
      const kneeWorldQ = legWorldQ.clone().multiply(knee.quaternion);
      foot.quaternion.copy(kneeWorldQ.invert());
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh && ![...geoCache.values()].includes(o.geometry)) o.geometry.dispose();
    });
    for (const m of Object.values(this.M)) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  }
}
