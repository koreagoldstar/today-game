/*
 * 하늘섬 대탈출 · 주인공 '토리' (꼬마 모험가)
 *  코드로 만든 3D 모형 + 관절(뼈대) 애니메이션. 외부 모델 파일 없음.
 *  - 챙 넓은 펠트 모자 + 놋쇠 고글 · 앞머리 · 크고 반짝이는 눈 · 볼터치
 *  - 가죽 깃 · 대각선 가방끈 · 허리띠 · 풍선 바지 · 끈 달린 부츠 · 배낭(침낭 말이) · 빨간 목도리
 *  - 동작: idle · walk · run · jump · fall · land · dash · hit · celebrate · defeat · look(타이틀) · wave
 *  - 표정: 눈(뜸 · 웃음 · 질끈 · 슬픔) · 입(미소 · 벌림 · 오 · 시무룩) · 눈썹 · 눈 깜빡임
 *  관절 각도는 매 프레임 '목표 자세'를 계산해서 부드럽게 따라간다 (동작 사이가 자연스럽게 이어짐).
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { roundedBox, taperTube } from "./geo.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));

/* ---------------- 재질 ---------------- */
function eyeTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.translate(64, 64);
  const g = x.createRadialGradient(0, 10, 4, 0, 0, 62);
  g.addColorStop(0, "#e2a35a");
  g.addColorStop(0.45, "#9a5a2a");
  g.addColorStop(0.85, "#5a321a");
  g.addColorStop(1, "#2a160c");
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, 62, 0, TAU);
  x.fill();
  // 홍채 결
  x.strokeStyle = "rgba(255,210,150,0.25)";
  x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    x.beginPath();
    x.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
    x.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
    x.stroke();
  }
  // 동공
  x.fillStyle = "#120a08";
  x.beginPath();
  x.arc(0, 2, 27, 0, TAU);
  x.fill();
  // 반짝임 (큰 것 · 작은 것)
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

function makeMats() {
  const S = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
  return {
    skin: S("#ffd2b8", { roughness: 0.55, emissive: "#ff8a6a", emissiveIntensity: 0.05 }),
    blush: new THREE.MeshBasicMaterial({ color: "#ff8f8f", transparent: true, opacity: 0.42, depthWrite: false }),
    hair: S("#3d2a24", { roughness: 0.42, side: THREE.DoubleSide }),
    felt: S("#9a6544", { roughness: 0.92, side: THREE.DoubleSide }),
    band: S("#4c2e22", { roughness: 0.6 }),
    leather: S("#7c4a2c", { roughness: 0.5 }),
    leatherDk: S("#4f301f", { roughness: 0.55 }),
    shirt: S("#f1dfba", { roughness: 0.92 }),
    pants: S("#647d48", { roughness: 0.9 }),
    boot: S("#8c5634", { roughness: 0.5 }),
    sole: S("#3a2a22", { roughness: 0.8 }),
    brass: S("#d6b56e", { roughness: 0.28, metalness: 0.85 }),
    glass: S("#3f6a72", { roughness: 0.06, metalness: 0.3, envMapIntensity: 1.6 }),
    pack: S("#6f7f4a", { roughness: 0.88 }),
    packDk: S("#59683a", { roughness: 0.88 }),
    roll: S("#e2d2a8", { roughness: 0.95 }),
    laces: S("#c49a6a", { roughness: 0.8 }),
    scarf: S("#e4573f", { roughness: 0.9 }),
    gem: S("#3fbf7a", { roughness: 0.15, metalness: 0.2, emissive: "#1f8a4a", emissiveIntensity: 0.25 }),
    white: S("#ffffff", { roughness: 0.18 }),
    iris: new THREE.MeshBasicMaterial({ map: eyeTex(), transparent: true }),
    dark: S("#2a1612", { roughness: 0.5 }),
    mouth: S("#5a1c22", { roughness: 0.6, side: THREE.DoubleSide }),
    tongue: S("#ff8a8a", { roughness: 0.6 }),
  };
}

/* ---------------- 모형 도우미 ---------------- */
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
/**
 * 머리카락 껍질: 머리를 감싸는 한 덩어리. 머리선(아래 끝)의 높이가 방향마다 달라서
 *  앞 = 이마를 덮는 앞머리 가닥(뾰족한 끝 4~5개) · 옆 = 귀를 덮고 볼까지 · 뒤 = 목덜미까지 짧게
 */
function hairGeo(R) {
  const segU = 96;
  const segV = 20;
  const sm = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const edge = (a) => {
    const A = Math.abs(a);
    // 옆으로 넘긴 앞머리: 가닥 끝 5개 (오른쪽으로 갈수록 조금 길게)
    const front = 0.98 + 0.25 * Math.pow(Math.abs(Math.cos((a + 0.2) * 5.6)), 2.6) + 0.07 * (a + 0.9) / 1.8;
    const side = 1.9 + 0.16 * Math.pow(Math.abs(Math.cos(A * 5.5)), 4);
    const back = 2.2 + 0.1 * Math.pow(Math.abs(Math.cos(a * 7)), 3);
    const wf = 1 - sm(0.82, 1.12, A);
    const wb = sm(1.95, 2.35, A);
    return front * wf + back * wb + side * Math.max(0, 1 - wf - wb);
  };
  const pos = [];
  const idx = [];
  const rows = segV + 2;
  for (let i = 0; i < segU; i++) {
    const a = -Math.PI + (i / segU) * Math.PI * 2;
    const e = edge(a);
    for (let j = 0; j <= segV; j++) {
      const v = j / segV;
      const th = v * e;
      // 위는 부풀고 끝은 머리에 붙는다
      const r = R * (1.085 - 0.045 * v * v + 0.015 * Math.sin(a * 9) * v);
      pos.push(Math.sin(a) * Math.sin(th) * r * 1.04, Math.cos(th) * r * 0.96, Math.cos(a) * Math.sin(th) * r * 0.98);
    }
    // 끝을 안으로 말아 넣어 두께가 보이게
    const th = e + 0.02;
    const r = R * 0.985;
    pos.push(Math.sin(a) * Math.sin(th) * r * 1.04, Math.cos(th) * r * 0.96, Math.cos(a) * Math.sin(th) * r * 0.98);
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

/** 그룹의 바로 아래 메시들 중 같은 재질끼리 합친다 (하위 관절 그룹은 그대로) */
function mergeChildren(group) {
  const by = new Map();
  for (const c of group.children) {
    if (!c.isMesh || c.material.transparent) continue;
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

/** 머리 표면 위의 한 점 (머리 중심 기준, 앞 = +z) */
function onHead(R, yaw, pitch, out = 1) {
  return V(Math.sin(yaw) * Math.cos(pitch) * R * out, Math.sin(pitch) * R * out, Math.cos(yaw) * Math.cos(pitch) * R * out);
}

export class Hero {
  constructor() {
    this.M = makeMats();
    this.group = new THREE.Group();
    this.pos = this.group.position;
    this.face = 0;
    this.faceTo = 0;
    this.state = "idle";
    this.st = 0;
    this.t = 0;
    this.speed01 = 0;
    this.phase = 0;
    this.blinkT = 2;
    this.blink = 0;
    this.lookT = 3;
    this.lookYaw = 0;
    this.onStep = null;
    this.lastStep = 0;
    this.wind = 0; // 목도리 펄럭임 (0~1)
    this.P = {}; // 지금 자세 (관절 각도)
    this.build();
    this.expression("smile", "open");
  }

  /* ================================================================
   * 모형
   * ============================================================== */
  build() {
    const M = this.M;
    const J = (this.J = {});
    const root = this.group;
    const body = (J.body = new THREE.Group());
    root.add(body);
    // 골반
    const hips = (J.hips = new THREE.Group());
    hips.position.y = 0.34;
    body.add(hips);
    hips.add(mesh(sphere(24), M.pants, [0, 0.02, 0], [0.165, 0.1, 0.13]));
    // 허리띠 + 버클 + 작은 주머니
    const belt = mesh(cg("belt", () => new THREE.TorusGeometry(0.152, 0.024, 10, 36)), M.leather, [0, 0.07, 0], [1, 1, 0.84], [Math.PI / 2, 0, 0]);
    hips.add(belt);
    hips.add(mesh(cg("buckle", () => roundedBox(0.07, 0.05, 0.018, 0.008)), M.brass, [0, 0.07, 0.13]));
    hips.add(mesh(cg("buckleIn", () => roundedBox(0.04, 0.026, 0.02, 0.004)), M.leatherDk, [0, 0.07, 0.133]));
    hips.add(mesh(cg("pouch", () => roundedBox(0.075, 0.07, 0.045, 0.015)), M.leatherDk, [-0.13, 0.04, 0.07], 1, [0, -0.8, 0]));
    // 다리
    for (const s of [1, -1]) {
      const side = s > 0 ? "L" : "R";
      const leg = (J["leg" + side] = new THREE.Group());
      leg.position.set(0.075 * s, 0, 0);
      hips.add(leg);
      leg.add(mesh(cg("thigh", () => lathe([[0.0, 0.03], [0.06, 0.03], [0.083, -0.03], [0.086, -0.09], [0.072, -0.14], [0.05, -0.165], [0.0, -0.165]])), M.pants));
      const knee = (J["knee" + side] = new THREE.Group());
      knee.position.y = -0.15;
      leg.add(knee);
      knee.add(mesh(cg("shin", () => lathe([[0.0, 0.01], [0.055, 0.01], [0.06, -0.03], [0.05, -0.05], [0.0, -0.05]])), M.pants));
      // 부츠 목 (가죽) + 접힌 윗단 + 끈
      knee.add(mesh(cg("bootShaft", () => lathe([[0.0, -0.035], [0.064, -0.035], [0.06, -0.08], [0.058, -0.13], [0.0, -0.13]])), M.boot));
      knee.add(mesh(cg("bootCuff", () => lathe([[0.0, -0.02], [0.066, -0.02], [0.072, -0.03], [0.07, -0.055], [0.062, -0.06], [0.0, -0.06]], 24)), M.leatherDk));
      for (let i = 0; i < 2; i++) for (const k of [1, -1]) knee.add(mesh(cg("lace", () => new THREE.BoxGeometry(0.036, 0.006, 0.006)), M.laces, [0, -0.077 - i * 0.02, 0.059], 1, [0, 0, 0.45 * k]));
      const foot = (J["foot" + side] = new THREE.Group());
      foot.position.y = -0.15;
      knee.add(foot);
      foot.add(mesh(sphere(20), M.boot, [0, -0.005, 0.035], [0.066, 0.052, 0.1]));
      foot.add(mesh(cg("sole", () => roundedBox(0.125, 0.026, 0.21, 0.012)), M.sole, [0, -0.035, 0.03]));
    }
    // 몸통
    const spine = (J.spine = new THREE.Group());
    spine.position.y = 0.06;
    hips.add(spine);
    const torso = mesh(cg("torso", () => lathe([[0.0, 0.0], [0.135, 0.0], [0.158, 0.05], [0.166, 0.12], [0.156, 0.19], [0.124, 0.235], [0.07, 0.262], [0.0, 0.27]], 32)), M.shirt, [0, 0, 0], [1, 1, 0.84]);
    spine.add(torso);
    // 가죽 깃 (양쪽으로 접힌 큰 깃)
    for (const s of [1, -1]) {
      const flap = mesh(cg("collar", () => roundedBox(0.085, 0.06, 0.016, 0.008)), M.leather, [0.045 * s, 0.232, 0.085], 1, [0.55, 0.38 * s, -0.55 * s]);
      spine.add(flap);
    }
    // 단추 + 초록 보석 핀
    for (let i = 0; i < 2; i++) spine.add(mesh(sphere(10), M.brass, [0, 0.16 - i * 0.055, 0.14 - i * 0.004], 0.011));
    spine.add(mesh(cg("gem", () => new THREE.OctahedronGeometry(1, 0)), M.gem, [0.02, 0.2, 0.128], [0.012, 0.02, 0.008]));
    // 대각선 가방끈 (왼쪽 어깨 → 오른쪽 허리) + 버클
    spine.add(
      mesh(
        cg("strap", () => taperTube([V(0.11, 0.255, -0.03), V(0.09, 0.22, 0.1), V(0.0, 0.12, 0.148), V(-0.1, 0.03, 0.128), V(-0.155, -0.02, 0.03)], () => 0.017, 24, 8, { flat: 0.32 })),
        M.leatherDk
      )
    );
    spine.add(mesh(cg("strapBuckle", () => roundedBox(0.03, 0.026, 0.01, 0.004)), M.brass, [0.03, 0.15, 0.148], 1, [0, 0, 0.75]));
    // 목도리 (목에 감김 + 매듭 + 펄럭이는 두 꼬리)
    spine.add(mesh(cg("scarfRing", () => new THREE.TorusGeometry(0.085, 0.034, 10, 28)), M.scarf, [0, 0.262, 0.01], [1, 1, 0.9], [Math.PI / 2 + 0.12, 0, 0]));
    spine.add(mesh(sphere(14), M.scarf, [-0.05, 0.245, 0.085], [0.034, 0.03, 0.026]));
    const tails = (J.scarf = new THREE.Group());
    tails.position.set(-0.06, 0.24, 0.09);
    spine.add(tails);
    for (const s of [1, -1]) {
      const tail = new THREE.Group();
      tail.position.x = 0.012 * s;
      tails.add(tail);
      tail.add(mesh(cg("scarfTail" + s, () => taperTube([V(0, 0, 0), V(-0.01, -0.04, 0.02), V(-0.02, -0.08, 0.025), V(-0.03, s > 0 ? -0.13 : -0.11, 0.02)], (t) => 0.028 - t * 0.006, 14, 8, { flat: 0.3 })), M.scarf));
      J["tail" + (s > 0 ? "L" : "R")] = tail;
    }
    // 배낭 (몸 뒤 -z)
    const pack = (J.pack = new THREE.Group());
    pack.position.set(0, 0.13, -0.16);
    spine.add(pack);
    pack.add(mesh(cg("packMain", () => roundedBox(0.27, 0.28, 0.14, 0.05)), M.pack));
    pack.add(mesh(cg("packFlap", () => roundedBox(0.28, 0.12, 0.155, 0.04)), M.packDk, [0, 0.09, -0.005]));
    pack.add(mesh(cg("packPocket", () => roundedBox(0.17, 0.1, 0.05, 0.02)), M.packDk, [0, -0.06, -0.08]));
    for (const s of [1, -1]) {
      pack.add(mesh(cg("packBand", () => roundedBox(0.03, 0.2, 0.012, 0.005)), M.leatherDk, [0.07 * s, 0.03, -0.08]));
      pack.add(mesh(cg("packBuckle", () => roundedBox(0.034, 0.026, 0.014, 0.004)), M.brass, [0.07 * s, -0.03, -0.088]));
      // 어깨끈 (배낭 위 → 어깨 위 → 겨드랑이 앞)
      spine.add(mesh(cg("shoulderStrap" + s, () => taperTube([V(0.08 * s, 0.24, -0.1), V(0.1 * s, 0.27, -0.01), V(0.12 * s, 0.22, 0.09), V(0.14 * s, 0.1, 0.1)], () => 0.016, 14, 6, { flat: 0.4 })), M.leatherDk));
    }
    // 침낭 말이
    const roll = mesh(cg("roll", () => new THREE.CylinderGeometry(0.055, 0.055, 0.32, 20)), M.roll, [0, 0.19, -0.01], 1, [0, 0, Math.PI / 2]);
    pack.add(roll);
    for (const s of [1, -1]) pack.add(mesh(cg("rollBand", () => new THREE.TorusGeometry(0.057, 0.008, 6, 20)), M.leatherDk, [0.09 * s, 0.19, -0.01], 1, [0, Math.PI / 2, 0]));
    // 팔
    for (const s of [1, -1]) {
      const side = s > 0 ? "L" : "R";
      const sh = (J["sh" + side] = new THREE.Group());
      sh.position.set(0.152 * s, 0.205, 0);
      spine.add(sh);
      sh.add(mesh(sphere(16), M.shirt, [0, 0, 0], 0.052));
      sh.add(mesh(cg("upperArm", () => new THREE.CapsuleGeometry(0.046, 0.075, 6, 14)), M.shirt, [0, -0.06, 0]));
      const el = (J["el" + side] = new THREE.Group());
      el.position.y = -0.12;
      sh.add(el);
      el.add(mesh(cg("foreArm", () => new THREE.CapsuleGeometry(0.042, 0.06, 6, 14)), M.shirt, [0, -0.04, 0]));
      el.add(mesh(cg("bracer", () => lathe([[0.0, 0.0], [0.049, 0.0], [0.051, -0.025], [0.048, -0.05], [0.0, -0.05]], 20)), M.leather, [0, -0.045, 0]));
      const hand = (J["hand" + side] = new THREE.Group());
      hand.position.y = -0.115;
      el.add(hand);
      hand.add(mesh(sphere(18), M.skin, [0, -0.012, 0.005], [0.052, 0.058, 0.046]));
      hand.add(mesh(sphere(12), M.skin, [-0.035 * s, -0.004, 0.025], [0.02, 0.028, 0.02], [0, 0, 0.4 * s]));
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
    // 관절마다 같은 재질 메시를 하나로 (그리기 횟수 줄이기)
    const groups = [];
    root.traverse((o) => o.isGroup && groups.push(o));
    for (const g of groups) mergeChildren(g);
    // 그림자: 모든 메시
    root.traverse((o) => {
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
    this.R = R;
    head.add(mesh(sphere(40), M.skin, [0, 0, 0], [R * 1.04, R * 0.96, R * 0.98]));
    // 볼터치
    for (const s of [1, -1]) {
      const p = onHead(R, 0.52 * s, -0.24, 1.0);
      const b = mesh(cg("blush", () => new THREE.CircleGeometry(0.045, 20)), M.blush, [p.x, p.y, p.z], [1, 0.6, 1]);
      b.lookAt(p.clone().multiplyScalar(2));
      b.position.copy(p.multiplyScalar(1.004));
      head.add(b);
    }
    // 코
    head.add(mesh(sphere(12), M.skin, [0, -0.075, R * 0.965], [0.02, 0.015, 0.014]));
    // 눈 (흰자 + 홍채 그림) · 웃는 눈 · 질끈 눈
    const eyes = (J.eyes = { open: [], happy: [], squint: [], sad: [] });
    for (const s of [1, -1]) {
      const p = onHead(R, 0.34 * s, -0.04, 0.9);
      const g = new THREE.Group();
      g.position.copy(p);
      g.lookAt(p.clone().multiplyScalar(3).add(V(0, 0, 0.3)));
      head.add(g);
      const white = mesh(sphere(24), M.white, [0, 0, 0], [0.072, 0.088, 0.04]);
      g.add(white);
      const iris = mesh(cg("iris", () => new THREE.CircleGeometry(0.06, 32)), M.iris, [0, -0.004, 0.039]);
      iris.castShadow = false;
      g.add(iris);
      g.userData.side = s;
      eyes.open.push(g);
      // 웃는 눈 (∩)
      const hp = new THREE.Group();
      hp.position.copy(p.clone().multiplyScalar(1.08));
      hp.lookAt(p.clone().multiplyScalar(3));
      hp.add(mesh(cg("happyArc", () => new THREE.TorusGeometry(0.045, 0.011, 6, 18, Math.PI)), M.dark, [0, -0.015, 0]));
      head.add(hp);
      eyes.happy.push(hp);
      // 질끈 (> <)
      const sq = new THREE.Group();
      sq.position.copy(p.clone().multiplyScalar(1.08));
      sq.lookAt(p.clone().multiplyScalar(3));
      for (const k of [1, -1]) sq.add(mesh(cg("squintLine", () => roundedBox(0.075, 0.016, 0.01, 0.006)), M.dark, [0.0, 0.016 * k, 0], 1, [0, 0, 0.42 * k * -s]));
      head.add(sq);
      eyes.squint.push(sq);
      // 슬픈 눈 (아래로 처진 ∪)
      const sd = new THREE.Group();
      sd.position.copy(p.clone().multiplyScalar(1.08));
      sd.lookAt(p.clone().multiplyScalar(3));
      sd.add(mesh(cg("happyArc", () => new THREE.TorusGeometry(0.045, 0.011, 6, 18, Math.PI)), M.dark, [0, 0.02, 0], 1, [0, 0, Math.PI]));
      head.add(sd);
      eyes.sad.push(sd);
    }
    // 눈썹
    J.brows = [];
    for (const s of [1, -1]) {
      const p = onHead(R, 0.33 * s, 0.24, 1.0);
      const g = new THREE.Group();
      g.position.copy(p);
      g.lookAt(p.clone().multiplyScalar(3));
      g.add(mesh(cg("brow", () => taperTube([V(-0.04, -0.004, 0), V(0, 0.008, 0), V(0.04, -0.002, 0)], (t) => 0.011 - Math.abs(t - 0.4) * 0.008, 10, 6)), M.hair));
      g.userData.side = s;
      head.add(g);
      J.brows.push(g);
    }
    // 입: 미소 · 벌림 · 오 · 시무룩
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
    mk("smile").add(mesh(cg("smileArc", () => new THREE.TorusGeometry(0.035, 0.009, 6, 16, Math.PI)), M.dark, [0, 0.012, 0.002], 1, [0, 0, Math.PI]));
    const open = mk("open");
    open.add(mesh(sphere(18), M.mouth, [0, 0, -0.004], [0.032, 0.026, 0.012]));
    open.add(mesh(sphere(12), M.tongue, [0, -0.012, 0.004], [0.017, 0.008, 0.008]));
    mk("o").add(mesh(sphere(14), M.mouth, [0, -0.004, 0], [0.019, 0.026, 0.015]));
    mk("frown").add(mesh(cg("smileArc", () => new THREE.TorusGeometry(0.035, 0.009, 6, 16, Math.PI)), M.dark, [0, -0.02, 0.002]));
    // 머리카락 (한 덩어리 껍질 + 머리선)
    head.add(mesh(cg("hair", () => hairGeo(R)), M.hair));
    // 모자 (챙 넓은 펠트 모자 + 띠 + 고글)
    const hat = (J.hat = new THREE.Group());
    hat.position.set(0, R * 0.58, -0.02);
    hat.rotation.x = -0.2;
    head.add(hat);
    hat.add(
      mesh(
        cg("hatShape", () =>
          lathe(
            [
              [0.0, 0.215],
              [0.13, 0.208],
              [0.225, 0.185],
              [0.27, 0.13],
              [0.287, 0.06],
              [0.298, 0.032],
              [0.43, 0.022],
              [0.5, 0.044],
              [0.512, 0.034],
              [0.45, 0.002],
              [0.3, 0.004],
              [0.27, -0.004],
            ],
            44
          )
        ),
        M.felt
      )
    );
    hat.add(mesh(cg("hatBand", () => new THREE.CylinderGeometry(0.285, 0.29, 0.045, 40, 1, true)), M.band, [0, 0.055, 0]));
    // 고글: 모자 앞 크라운 위
    const gog = new THREE.Group();
    gog.position.set(0, 0.112, 0.235);
    gog.rotation.x = -0.18;
    hat.add(gog);
    gog.add(mesh(cg("gogStrap", () => new THREE.TorusGeometry(0.27, 0.014, 6, 40, Math.PI * 0.9)), M.leatherDk, [0, 0, -0.232], [1, 1, 1], [Math.PI / 2, 0, Math.PI * 0.05 - Math.PI / 2 + Math.PI * 0.55]));
    for (const s of [1, -1]) {
      const lens = new THREE.Group();
      lens.position.set(0.075 * s, 0, 0.012);
      lens.rotation.y = 0.32 * s;
      gog.add(lens);
      lens.add(mesh(cg("gogCup", () => new THREE.CylinderGeometry(0.052, 0.058, 0.04, 22)), M.leatherDk, [0, 0, -0.012], 1, [Math.PI / 2, 0, 0]));
      lens.add(mesh(cg("gogRim", () => new THREE.TorusGeometry(0.052, 0.013, 10, 26)), M.brass, [0, 0, 0.01]));
      lens.add(mesh(cg("gogGlass", () => new THREE.SphereGeometry(0.05, 22, 12, 0, TAU, 0, 1.0)), M.glass, [0, 0, -0.022], [1, 1, 0.75], [Math.PI / 2, 0, 0]));
    }
    gog.add(mesh(cg("gogBridge", () => new THREE.CylinderGeometry(0.009, 0.009, 0.05, 8)), M.brass, [0, 0, 0.02], 1, [0, 0, Math.PI / 2]));
  }

  /** 표정 바꾸기: eyes = open|happy|squint|sad · mouth = smile|open|o|frown */
  expression(eyes, mouth, brow = "normal") {
    const E = this.J.eyes;
    for (const k of ["open", "happy", "squint", "sad"]) for (const g of E[k]) g.visible = k === eyes;
    for (const [k, g] of Object.entries(this.J.mouth)) g.visible = k === mouth;
    this.eyeMode = eyes;
    this.browMode = brow;
  }

  /** 동작 바꾸기 */
  play(state, opts = {}) {
    if (this.state === state && !opts.restart) return;
    this.state = state;
    this.st = 0;
    this.opts = opts;
    const face = {
      idle: ["open", "smile"],
      walk: ["open", "smile"],
      run: ["open", "open", "brave"],
      startRun: ["open", "open", "brave"],
      jump: ["open", "open", "up"],
      fall: ["open", "o", "worried"],
      land: ["open", "smile"],
      dash: ["squint", "open", "brave"],
      hit: ["squint", "o", "worried"],
      celebrate: ["happy", "open", "up"],
      defeat: ["sad", "frown", "worried"],
      look: ["open", "smile", "up"],
      wave: ["happy", "open", "up"],
      checkpoint: ["happy", "open", "up"],
      surprise: ["open", "o", "worried"],
    }[state] || ["open", "smile"];
    this.expression(face[0], face[1], face[2]);
  }

  /* ================================================================
   * 매 프레임: 목표 자세 → 부드럽게 따라가기
   * ============================================================== */
  update(dt) {
    this.t += dt;
    this.st += dt;
    const s = this.state;
    const st = this.st;
    const t = this.t;
    const sp = clamp(this.speed01, 0, 1);
    // 기본 자세 (차렷에서 팔 살짝 벌림)
    const T = {
      y: 0,
      pitch: 0,
      roll: 0,
      yaw: 0,
      sq: 1,
      hipL: 0,
      hipR: 0,
      kneeL: 0.05,
      kneeR: 0.05,
      footL: 0,
      footR: 0,
      spL: 0.04,
      spR: -0.04,
      shL: 0.05,
      shR: 0.05,
      shLr: 0.16,
      shRr: -0.16,
      elL: -0.2,
      elR: -0.2,
      headP: 0,
      headY: 0,
      headR: 0,
      scarf: 0.25,
    };
    let rate = 16;
    if (s === "idle" || s === "look" || s === "wave" || s === "checkpoint") {
      const br = Math.sin(t * 2.2);
      T.y = br * 0.004;
      T.sq = 1 + br * 0.008;
      T.pitch = 0.02;
      T.shLr = 0.18 + br * 0.03;
      T.shRr = -0.18 - br * 0.03;
      // 가끔 두리번
      this.lookT -= dt;
      if (this.lookT <= 0) {
        this.lookT = 2 + Math.random() * 3;
        this.lookYaw = (Math.random() - 0.5) * 0.9;
      }
      T.headY = this.lookYaw;
      T.headP = -0.04;
      rate = 9;
      if (s === "look") {
        // 절벽 끝에서 손으로 해를 가리고 멀리 바라봄
        T.shR = -2.15;
        T.shRr = -0.55;
        T.elR = -2.05;
        T.headY = Math.sin(t * 0.45) * 0.45;
        T.headP = -0.12;
        T.pitch = 0.04;
        T.shL = 0.1;
      } else if (s === "wave") {
        T.shR = -0.4;
        T.shRr = -2.5;
        T.elR = -0.6 + Math.sin(t * 9) * 0.45;
        T.headR = 0.12;
        T.headY = 0;
      } else if (s === "checkpoint") {
        // 주먹 불끈 + 살짝 뜀
        const k = Math.min(1, st / 0.25);
        T.y = Math.sin(Math.min(1, st / 0.5) * Math.PI) * 0.12;
        T.shR = -2.7 * k;
        T.shRr = -0.2;
        T.elR = -0.5;
        T.shL = -0.2;
        T.headP = -0.15;
        if (st > 0.9) this.play("idle");
      }
    } else if (s === "walk" || s === "run" || s === "startRun") {
      const run = s !== "walk";
      const v = run ? Math.max(0.55, sp) : Math.max(0.3, sp);
      this.phase += dt * (run ? 7.5 + 6 * v : 5.5 + 4 * v);
      const ph = this.phase;
      const A = run ? 0.95 * v : 0.5;
      const sL = Math.sin(ph);
      T.hipL = -A * sL;
      T.hipR = A * sL;
      T.kneeL = 0.12 + (run ? 1.15 : 0.55) * Math.max(0, Math.cos(ph + 0.97));
      T.kneeR = 0.12 + (run ? 1.15 : 0.55) * Math.max(0, Math.cos(ph + Math.PI + 0.97));
      T.footL = -T.hipL * 0.3;
      T.footR = -T.hipR * 0.3;
      T.shL = A * 0.9 * sL;
      T.shR = -A * 0.9 * sL;
      T.elL = run ? -1.35 : -0.35;
      T.elR = run ? -1.35 : -0.35;
      T.shLr = run ? 0.22 : 0.15;
      T.shRr = run ? -0.22 : -0.15;
      T.y = Math.abs(Math.sin(ph)) * (run ? 0.055 : 0.022) - (run ? 0.02 : 0);
      T.pitch = run ? 0.2 * v + (s === "startRun" ? 0.2 * (1 - Math.min(1, st / 0.16)) : 0) : 0.05;
      T.roll = sL * (run ? 0.05 : 0.03);
      T.yaw = sL * (run ? 0.14 : 0.08);
      T.headP = -T.pitch * 0.6;
      T.headY = -T.yaw * 0.6;
      T.scarf = run ? 0.9 * v + 0.2 : 0.4;
      rate = 20;
      // 발소리
      const k = Math.floor(ph / Math.PI);
      if (k !== this.lastStep) {
        this.lastStep = k;
        if (this.onStep && v > 0.25) this.onStep(v);
      }
      if (s === "startRun" && st > 0.16) this.play(sp < 0.5 ? "walk" : "run");
    } else if (s === "jump") {
      const k = Math.min(1, st / 0.18);
      T.sq = 1.12 - 0.12 * k;
      T.hipL = -0.95;
      T.kneeL = 1.45;
      T.hipR = -0.35;
      T.kneeR = 0.9;
      T.shL = -2.3 * k;
      T.shR = -1.9 * k;
      T.shLr = 0.45;
      T.shRr = -0.45;
      T.elL = -0.35;
      T.elR = -0.5;
      T.pitch = -0.06;
      T.headP = -0.18;
      T.scarf = 1.2;
      rate = 22;
    } else if (s === "fall") {
      const f = Math.sin(t * 16);
      T.shL = -0.7 + f * 0.25;
      T.shR = -0.7 - f * 0.25;
      T.shLr = 1.35 + f * 0.2;
      T.shRr = -1.35 + f * 0.2;
      T.elL = -0.4;
      T.elR = -0.4;
      T.hipL = -0.3 + Math.sin(t * 9) * 0.25;
      T.hipR = -0.1 - Math.sin(t * 9) * 0.25;
      T.kneeL = 0.5;
      T.kneeR = 0.65;
      T.pitch = 0.08;
      T.headP = -0.05;
      T.scarf = 1.6;
      rate = 14;
    } else if (s === "land") {
      // 쿵: 납작해졌다가 튕겨 오름
      const k = Math.min(1, st / 0.2);
      const amt = (this.opts && this.opts.k) || 0.7;
      const sq = Math.sin(k * Math.PI) * 0.2 * amt;
      T.sq = 1 - sq;
      T.y = -sq * 0.3;
      T.hipL = -0.65 * (1 - k);
      T.hipR = -0.65 * (1 - k);
      T.kneeL = 1.1 * (1 - k) + 0.05;
      T.kneeR = 1.1 * (1 - k) + 0.05;
      T.footL = T.footR = 0;
      T.shLr = 0.7 * (1 - k) + 0.16;
      T.shRr = -0.7 * (1 - k) - 0.16;
      T.pitch = 0.18 * (1 - k);
      rate = 30;
      if (st > 0.2) this.play(this.opts && this.opts.next ? this.opts.next : "idle");
    } else if (s === "dash") {
      T.pitch = 0.6;
      T.y = -0.02;
      T.shL = 1.15;
      T.shR = 1.15;
      T.shLr = 0.25;
      T.shRr = -0.25;
      T.elL = -0.15;
      T.elR = -0.15;
      T.hipL = -0.55;
      T.kneeL = 0.35;
      T.hipR = 0.75;
      T.kneeR = 0.7;
      T.headP = -0.45;
      T.scarf = 1.8;
      T.sq = 0.94;
      rate = 30;
    } else if (s === "hit") {
      const k = Math.min(1, st / 0.15);
      T.pitch = -0.35 * k;
      T.y = 0.02;
      T.shL = -1.5;
      T.shR = -1.5;
      T.shLr = 0.75;
      T.shRr = -0.75;
      T.elL = -1.5;
      T.elR = -1.5;
      T.hipL = -0.4;
      T.kneeL = 0.6;
      T.headP = 0.15;
      T.headR = Math.sin(st * 30) * 0.08 * (1 - k * 0.5);
      T.scarf = 1.2;
      rate = 26;
    } else if (s === "celebrate") {
      const h = Math.abs(Math.sin(st * 5.4));
      T.y = h * 0.2;
      T.sq = 1 + (h > 0.9 ? 0.06 : -0.03);
      const alt = Math.sin(st * 5.4) > 0;
      T.shR = alt ? -2.9 : -2.2;
      T.shL = alt ? -1.6 : -2.6;
      T.shLr = 0.5;
      T.shRr = -0.5;
      T.elL = -0.6;
      T.elR = -0.4;
      T.hipL = -0.3 * h;
      T.kneeL = 0.6 * h;
      T.hipR = -0.3 * h;
      T.kneeR = 0.6 * h;
      T.headP = -0.2;
      T.headR = Math.sin(st * 2.7) * 0.15;
      T.yaw = Math.sin(st * 2.7) * 0.25;
      T.scarf = 0.9;
      rate = 18;
    } else if (s === "surprise") {
      // 깜짝! 뒤돌아보며 두 손을 번쩍
      const k = Math.min(1, st / 0.2);
      T.y = Math.sin(Math.min(1, st / 0.3) * Math.PI) * 0.1;
      T.shL = -1.2 * k;
      T.shR = -1.2 * k;
      T.shLr = 1.0 * k;
      T.shRr = -1.0 * k;
      T.elL = -1.6;
      T.elR = -1.6;
      T.pitch = -0.18 * k;
      T.headP = -0.15;
      T.hipL = -0.2;
      T.kneeL = 0.3;
      T.scarf = 0.6;
      rate = 20;
    } else if (s === "defeat") {
      const k = Math.min(1, st / 0.6);
      T.y = -0.1 * k;
      T.pitch = 0.45 * k;
      T.hipL = -0.9 * k;
      T.hipR = -0.9 * k;
      T.kneeL = 1.5 * k;
      T.kneeR = 1.5 * k;
      T.footL = -0.6 * k;
      T.footR = -0.6 * k;
      T.shL = -0.35;
      T.shR = -0.35;
      T.shLr = 0.1;
      T.shRr = -0.1;
      T.elL = -0.3;
      T.elR = -0.3;
      T.headP = 0.45 * k;
      T.scarf = 0.1;
      rate = 6;
    }
    // 부드럽게 따라가기
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
    // 방향 돌기
    let d = this.faceTo - this.face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.face += d * Math.min(1, dt * 16);
    this.group.rotation.y = this.face;
  }

  apply(P, dt) {
    const J = this.J;
    J.body.position.y = P.y;
    const sq = P.sq;
    J.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    J.hips.rotation.set(P.pitch * 0.4, P.yaw * 0.5, P.roll);
    J.spine.rotation.set(P.pitch * 0.6, -P.yaw, -P.roll * 0.5);
    J.legL.rotation.set(P.hipL - P.pitch * 0.4, 0, 0.03);
    J.legR.rotation.set(P.hipR - P.pitch * 0.4, 0, -0.03);
    J.kneeL.rotation.x = P.kneeL;
    J.kneeR.rotation.x = P.kneeR;
    J.footL.rotation.x = P.footL - (P.hipL + P.kneeL) * 0.35;
    J.footR.rotation.x = P.footR - (P.hipR + P.kneeR) * 0.35;
    J.shL.rotation.set(P.shL, 0, P.shLr);
    J.shR.rotation.set(P.shR, 0, P.shRr);
    J.elL.rotation.x = P.elL;
    J.elR.rotation.x = P.elR;
    J.head.rotation.set(P.headP, P.headY, P.headR);
    // 목도리 꼬리: 달릴수록 뒤로 날리고 펄럭
    const w = Math.max(P.scarf, this.wind);
    const fl = Math.sin(this.t * (8 + w * 10)) * 0.18 * (0.3 + w);
    // 매듭은 오른쪽 가슴 앞: 바람이 불면 오른쪽 어깨 너머 뒤로 날린다
    J.tailL.rotation.set(w * 0.9 + fl, 0, -0.1 - w * 1.25 - fl * 0.4);
    J.tailR.rotation.set(w * 0.8 - fl * 0.7, 0, -0.05 - w * 1.05 + fl * 0.3);
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
