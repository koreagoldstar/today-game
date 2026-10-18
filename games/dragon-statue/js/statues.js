/*
 * 드래곤 석상 대작전 · 드래곤 석상 10종 (코드로 만든 3D 조각)
 *  모두 '앉아 있는 드래곤 + 돌 받침'. 종류마다 머리 · 뿔 · 날개 · 꼬리 · 장식 · 재질 · 실루엣이 다르다.
 *  만든 뒤 재질별로 한 덩어리로 굽고(bake), 높이를 1 로 맞춘다 → 크기 비교가 정확하다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { taperTube, slab, part, bake, horn } from "./geo.js?v=1";
import { stoneTex, stoneBump, lavaCrackTex, scaleTex } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sph = (seg = 20) => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
const cone = (seg = 10) => new THREE.ConeGeometry(1, 1, seg);
const P = 0.42; // 받침 윗면 높이
const H_REF = 2.7; // 만든 단위 → 석상 단위 (보통 높이 ≈ 1)
export const PED_R = 0.66 / H_REF; // 받침 반지름 (석상 단위)
const PED_PARTS = 3; // buildGroup 이 맨 먼저 넣는 받침 조각 수

/* ---------------- 석상 종류 ---------------- */
export const STATUE_TYPES = [
  { id: "baby", name: "아기 드래곤", head: 1.35, body: 0.86, neck: 0.7, wings: "small", horns: "nub", spikes: 0.6, tail: 1 },
  { id: "spread", name: "날개 펼친 드래곤", head: 1, body: 1, neck: 1, wings: "spread", horns: "back", spikes: 1, tail: 1 },
  { id: "bighorn", name: "뿔이 큰 드래곤", head: 1.05, body: 1.02, neck: 0.95, wings: "none", horns: "ram", spikes: 1.1, tail: 1, cheek: true },
  { id: "folded", name: "날개를 접은 드래곤", head: 0.95, body: 0.96, neck: 1.25, wings: "folded", horns: "back", spikes: 0.9, tail: 1.1 },
  { id: "crystal", name: "수정이 박힌 드래곤", head: 1, body: 1, neck: 1, wings: "folded", horns: "back", spikes: 0, tail: 1, crystals: true },
  { id: "armored", name: "돌 갑옷 드래곤", head: 1.02, body: 1.14, neck: 0.85, wings: "none", horns: "short", spikes: 0.7, tail: 0.95, armor: true },
  { id: "ice", name: "얼음 드래곤", head: 1, body: 0.98, neck: 1.05, wings: "spread", horns: "spike", spikes: 1.2, tail: 1, mat: "ice", icicles: true },
  { id: "lava", name: "화산 드래곤", head: 1.04, body: 1.05, neck: 0.95, wings: "folded", horns: "short", spikes: 1.3, tail: 1, mat: "lava" },
  { id: "gold", name: "황금 드래곤", head: 1, body: 1, neck: 1.05, wings: "spread", horns: "back", spikes: 0.8, tail: 1, mat: "gold", crown: true },
  { id: "ancient", name: "고대 수호 드래곤", head: 1.12, body: 1.08, neck: 1.0, wings: "spread", horns: "four", spikes: 1.1, tail: 1.1, beard: true, rune: true },
];
export const TYPE_BY_ID = Object.fromEntries(STATUE_TYPES.map((t) => [t.id, t]));

/* ---------------- 날개 모양 (오른쪽: +x 로 펼침) ---------------- */
function wingShape(span, rise, mirror = false) {
  const m = mirror ? -1 : 1;
  const pts = [
    [0, 0],
    [0.42 * span, 0.62 * rise],
    [0.96 * span, 0.86 * rise],
    [0.82 * span, 0.5 * rise],
    [1.0 * span, 0.32 * rise],
    [0.74 * span, 0.08 * rise],
    [0.78 * span, -0.16 * rise],
    [0.42 * span, -0.12 * rise],
    [0.08 * span, -0.2 * rise],
  ];
  const s = new THREE.Shape();
  const P2 = pts.map(([x, y]) => [x * m, y]);
  s.moveTo(P2[0][0], P2[0][1]);
  s.lineTo(P2[1][0], P2[1][1]);
  s.lineTo(P2[2][0], P2[2][1]);
  // 손가락 사이 막은 안쪽으로 오목하게
  for (let i = 3; i < P2.length; i++) {
    const [px, py] = P2[i - 1];
    const [x, y] = P2[i];
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    const toRoot = Math.hypot(mx, my) || 1;
    s.quadraticCurveTo(mx - (mx / toRoot) * 0.08 * span, my - (my / toRoot) * 0.08 * span, x, y);
  }
  s.lineTo(P2[0][0], P2[0][1]);
  if (mirror) {
    // 거울상은 점 순서가 뒤집혀 면이 안쪽을 본다 → 다시 만들기
    const rev = new THREE.Shape(s.getPoints(8).reverse());
    return { shape: rev, bones: P2 };
  }
  return { shape: s, bones: P2 };
}

function addWing(g, side, kind, sc) {
  const span = kind === "spread" ? 0.95 : kind === "small" ? 0.42 : 0.62;
  const rise = kind === "spread" ? 0.9 : kind === "small" ? 0.42 : 0.62;
  const { shape, bones } = wingShape(span, rise, side < 0);
  const w = new THREE.Group();
  w.add(part(slab(shape, 0.035, 0.012), "skin", { tint: 0.92 }));
  // 뼈대 (앞 날개뼈 · 손가락)
  const root = V(0, 0, 0);
  const wrist = V(bones[1][0], bones[1][1], 0);
  w.add(part(taperTube([root, V(wrist.x * 0.5, wrist.y * 0.55, 0.02), wrist], (t) => 0.055 - t * 0.02, 8, 8), "stone"));
  for (const k of [2, 4, 6]) {
    const tip = V(bones[k][0], bones[k][1], 0);
    w.add(part(taperTube([wrist, V((wrist.x + tip.x) / 2, (wrist.y + tip.y) / 2, 0.015), tip], (t) => 0.03 * (1 - t * 0.8), 8, 6), "stone"));
  }
  // 손목 발톱
  w.add(part(cone(8), "stone", { pos: [wrist.x, wrist.y + 0.05, 0], scale: [0.03, 0.1, 0.03], rot: [0, 0, -0.3 * side] }));
  if (kind === "spread") {
    w.position.set(side * 0.22 * sc, P + 0.92 * sc, -0.12 * sc);
    w.rotation.set(-0.15, side * -0.55, side * 0.42);
  } else if (kind === "folded") {
    w.position.set(side * 0.24 * sc, P + 0.86 * sc, -0.14 * sc);
    w.rotation.set(0.1, side * -1.35, side * -0.55);
  } else {
    w.position.set(side * 0.2 * sc, P + 0.82 * sc, -0.1 * sc);
    w.rotation.set(-0.1, side * -0.7, side * 0.3);
  }
  w.scale.setScalar(sc);
  g.add(w);
}

/* ---------------- 석상 하나 만들기 (그룹) ---------------- */
function buildGroup(T) {
  const g = new THREE.Group();
  const B = T.body;
  const H = T.head * 1.22;
  const NK = T.neck;
  const accent = T.mat === "gold" ? "gold" : "stone";
  const iceAcc = T.mat === "ice" ? "ice" : accent;

  /* 받침 (팔각 돌 받침 + 테두리) */
  g.add(part(new THREE.CylinderGeometry(0.6, 0.66, 0.26, 8), "base", { pos: [0, 0.13, 0], tint: 0.82 }));
  g.add(part(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 8), "base", { pos: [0, 0.32, 0], tint: 0.95 }));
  g.add(part(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 8), "base", { pos: [0, 0.27, 0], tint: 0.72 }));

  /* 뒷다리 (허벅지 + 발 + 발톱) */
  for (const s of [-1, 1]) {
    g.add(part(sph(), "stone", { pos: [s * 0.29 * B, P + 0.25 * B, -0.06], scale: [0.25 * B, 0.29 * B, 0.35 * B], rot: [0.25, 0, s * -0.18] }));
    g.add(part(sph(16), "stone", { pos: [s * 0.33 * B, P + 0.07, 0.22 * B], scale: [0.14 * B, 0.08, 0.2 * B] }));
    for (const c of [-1, 0, 1]) g.add(part(cone(), "stone", { pos: [s * 0.33 * B + c * 0.06 * B, P + 0.05, 0.4 * B], rot: [Math.PI / 2, 0, 0], scale: [0.03, 0.09, 0.03], tint: 0.85 }));
  }
  /* 몸통: 배 + 가슴 (가슴을 앞으로 내밀어 당당하게) */
  g.add(part(sph(26), "stone", { pos: [0, P + 0.45 * B, 0], scale: [0.34 * B, 0.36 * B, 0.32 * B] }));
  g.add(part(sph(26), "stone", { pos: [0, P + 0.78 * B, 0.07 * B], scale: [0.28 * B, 0.34 * B, 0.28 * B], rot: [-0.25, 0, 0] }));
  /* 배 비늘 판 (앞쪽 줄무늬) */
  for (let i = 0; i < 7; i++) {
    const y = P + 0.24 * B + i * 0.105 * B;
    const z = (0.18 + Math.sin((i / 6) * Math.PI) * 0.1 + (i > 3 ? (i - 3) * 0.02 : 0)) * B;
    const w = (0.2 - Math.abs(i - 3) * 0.018) * B;
    g.add(part(new THREE.CylinderGeometry(1, 1, 1, 20, 1, false, -1.15, 2.3), "stone", { pos: [0, y, z - 0.12 * B], scale: [w, 0.05 * B, 0.16 * B], rot: [-0.18, 0, 0], tint: 1.08 }));
  }
  /* 앞다리 (어깨 → 팔꿈치 → 발) */
  for (const s of [-1, 1]) {
    const sh = V(s * 0.24 * B, P + 0.86 * B, 0.12 * B);
    const el = V(s * 0.3 * B, P + 0.48 * B, 0.26 * B);
    const ft = V(s * 0.21 * B, P + 0.07, 0.38 * B);
    g.add(part(sph(16), "stone", { pos: [sh.x, sh.y, sh.z], scale: [0.13 * B, 0.15 * B, 0.13 * B] }));
    g.add(part(taperTube([sh, el, ft], (t) => (0.105 - t * 0.035) * B, 14, 10), "stone"));
    g.add(part(sph(14), "stone", { pos: [ft.x, P + 0.065, ft.z + 0.04], scale: [0.1 * B, 0.07, 0.13 * B] }));
    for (const c of [-1, 0, 1]) g.add(part(cone(), "stone", { pos: [ft.x + c * 0.05 * B, P + 0.045, ft.z + 0.16 * B], rot: [Math.PI / 2, 0, 0], scale: [0.026, 0.085, 0.026], tint: 0.85 }));
  }
  /* 꼬리 (옆으로 감아 앞으로) */
  const tailPts = [V(0, P + 0.2 * B, -0.3 * B), V(0.34 * B, P + 0.08, -0.38 * B), V(0.56 * B * T.tail, P + 0.06, -0.02), V(0.5 * B * T.tail, P + 0.06, 0.32 * B), V(0.26 * B, P + 0.1, 0.5 * B)];
  g.add(part(taperTube(tailPts, (t) => 0.14 * B * (1 - t * 0.82), 26, 10), "stone"));
  const tipS = new THREE.Shape();
  tipS.moveTo(0, 0);
  tipS.lineTo(0.09, 0.05);
  tipS.lineTo(0, 0.17);
  tipS.lineTo(-0.09, 0.05);
  tipS.lineTo(0, 0);
  g.add(part(slab(tipS, 0.035, 0.01), "stone", { pos: [0.24 * B, P + 0.1, 0.5 * B], rot: [-Math.PI / 2 + 0.2, 0, 2.2], scale: [B, B, B] }));

  /* 목 (짧고 굵게, 앞으로) */
  const nb = V(0, P + 1.0 * B, 0.02);
  const n1 = V(0, P + (1.0 + 0.2 * NK) * B, 0.1 * B);
  const n2 = V(0, P + (1.02 + 0.36 * NK) * B, 0.2 * B);
  g.add(part(taperTube([nb, n1, n2], (t) => (0.18 - t * 0.05) * B, 14, 12), "stone"));

  /* ---------- 머리 (따로 묶어 살짝 아래를 내려다보게) ---------- */
  const head = new THREE.Group();
  head.position.set(0, n2.y + 0.1 * H, n2.z + 0.05 * H);
  head.rotation.x = 0.16;
  head.scale.setScalar(H);
  g.add(head);
  // 얼굴 · 머리는 매끈한 돌 (비늘 무늬 없이)
  const hd = (geo, mat, o) => head.add(part(geo, mat === "stone" ? "skin" : mat, o));
  // 머리뼈 · 볼
  hd(sph(24), "stone", { pos: [0, 0, 0], scale: [0.2, 0.18, 0.2] });
  for (const s of [-1, 1]) hd(sph(14), "stone", { pos: [s * 0.12, -0.06, 0.08], scale: [0.09, 0.08, 0.1] });
  // 위턱 (길쭉한 주둥이) · 아래턱 · 입선
  hd(sph(22), "stone", { pos: [0, -0.04, 0.21], scale: [0.13, 0.1, 0.22], rot: [0.1, 0, 0] });
  hd(sph(16), "stone", { pos: [0, -0.12, 0.17], scale: [0.11, 0.05, 0.18], tint: 0.94 });
  hd(sph(12), "stone", { pos: [0, -0.095, 0.22], scale: [0.115, 0.012, 0.17], tint: 0.42 });
  // 콧등 혹 · 콧구멍
  for (const s of [-1, 1]) {
    hd(sph(10), "stone", { pos: [s * 0.055, 0.035, 0.36], scale: [0.035, 0.03, 0.04] });
    hd(sph(8), "stone", { pos: [s * 0.05, 0.02, 0.405], scale: [0.02, 0.016, 0.014], tint: 0.4 });
  }
  // 송곳니 (작게)
  for (const s of [-1, 1]) hd(cone(6), "stone", { pos: [s * 0.075, -0.12, 0.32], rot: [Math.PI, 0, 0], scale: [0.018, 0.05, 0.018], tint: 1.1 });
  // 눈: 움푹한 눈구멍 + 눈알 + 굵은 눈썹 능선
  const eR = T.id === "baby" ? 0.062 : 0.048;
  const eyeMat = T.mat === "lava" || T.rune ? "glow" : T.crystals ? "crystal" : T.mat === "ice" ? "ice" : "stone";
  for (const s of [-1, 1]) {
    hd(sph(12), "stone", { pos: [s * 0.105, 0.03, 0.12], scale: [eR * 1.4, eR * 1.25, eR], tint: 0.55 });
    hd(sph(12), eyeMat, { pos: [s * 0.11, 0.03, 0.135], scale: [eR, eR * 1.08, eR * 0.8], tint: 1.15 });
    if (eyeMat === "stone" || eyeMat === "ice") hd(sph(10), eyeMat, { pos: [s * 0.112, 0.028, 0.135 + eR * 0.62], scale: [eR * 0.42, eR * 0.6, eR * 0.3], tint: 0.32 });
    hd(sph(10), "stone", { pos: [s * 0.1, 0.105 + eR * 0.4, 0.1], scale: [0.085, 0.026, 0.055], rot: [0.25, 0, s * -0.42] });
  }
  // 귀 지느러미 (크게, 옆으로)
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.quadraticCurveTo(0.1, 0.06, 0.22, 0.2);
  fin.lineTo(0.13, 0.08);
  fin.lineTo(0.24, 0.06);
  fin.lineTo(0.12, -0.02);
  fin.lineTo(0.2, -0.08);
  fin.lineTo(0, -0.02);
  for (const s of [-1, 1]) hd(slab(fin, 0.022, 0.007), "stone", { pos: [s * 0.17, 0.01, -0.04], rot: [0.1, s > 0 ? -0.75 : Math.PI + 0.75, s * 0.15] });

  /* 뿔 */
  for (const s of [-1, 1]) {
    const hb = [s * 0.1, 0.13, -0.06];
    if (T.horns === "nub") hd(cone(10), accent, { pos: hb, scale: [0.045, 0.1, 0.045], rot: [-0.35, 0, s * -0.25] });
    else if (T.horns === "back" || T.horns === "four") hd(horn(0.46, 0.055, 1.2), accent, { pos: hb, rot: [-0.5, s * 0.3, s * -0.3] });
    else if (T.horns === "short") hd(horn(0.27, 0.06, 0.9), accent, { pos: hb, rot: [-0.35, s * 0.2, s * -0.4] });
    else if (T.horns === "spike") hd(cone(8), iceAcc, { pos: [hb[0], hb[1] + 0.14, hb[2] - 0.06], scale: [0.05, 0.36, 0.05], rot: [-0.5, 0, s * -0.32] });
    else if (T.horns === "ram") {
      // 머리 옆으로 크게 말린 숫양 뿔 (앞에서도 잘 보이게)
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const th = 2.3 - t * 5.4;
        const r = 0.16 * (1 - t * 0.6);
        pts.push(V(s * (0.27 + Math.cos(th) * r), 0.02 + Math.sin(th) * r, -0.05 - Math.sin(t * Math.PI) * 0.07));
      }
      hd(taperTube(pts, (t) => 0.072 * (1 - t * 0.75), 40, 12), accent, { tint: 1.06 });
      // 뿔 마디 고리
      for (let i = 2; i < 12; i += 3) hd(new THREE.TorusGeometry(0.065 * (1 - (i / 14) * 0.75), 0.008, 6, 14), accent, { pos: [pts[i].x, pts[i].y, pts[i].z], rot: [0, Math.PI / 2, 0], tint: 0.8 });
    }
    if (T.horns === "four") hd(horn(0.3, 0.04, 1.0), accent, { pos: [s * 0.17, 0.05, -0.08], rot: [-0.8, s * 0.7, s * -0.8] });
    if (T.cheek) hd(cone(8), accent, { pos: [s * 0.2, -0.05, 0.02], scale: [0.032, 0.13, 0.032], rot: [0.3, 0, s * -1.6] });
  }
  // 왕관 (황금)
  if (T.crown) {
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      hd(cone(5), "gold", { pos: [Math.sin(a) * 0.11, 0.2, Math.cos(a) * 0.08 - 0.02], scale: [0.032, 0.1 + (i === 2 ? 0.05 : 0), 0.032] });
    }
    hd(new THREE.TorusGeometry(0.12, 0.024, 8, 20), "gold", { pos: [0, 0.155, -0.01], rot: [Math.PI / 2 - 0.2, 0, 0], scale: [1, 0.75, 1] });
    hd(sph(10), "crystal", { pos: [0, 0.18, 0.1], scale: 0.035 });
  }
  // 수염 (고대 수호)
  if (T.beard) {
    for (let i = 0; i < 5; i++) hd(cone(6), "stone", { pos: [(i - 2) * 0.045, -0.2, 0.14], rot: [Math.PI - 0.25, 0, (i - 2) * 0.12], scale: [0.026, 0.15 - Math.abs(i - 2) * 0.02, 0.026] });
  }
  // 이마 수정
  if (T.crystals) {
    for (let k = 0; k < 3; k++) hd(new THREE.OctahedronGeometry(1, 0), "crystal", { pos: [(k - 1) * 0.045, 0.2, 0.02 - Math.abs(k - 1) * 0.02], rot: [-0.3, k, (k - 1) * 0.45], scale: [0.04, 0.12 + (k === 1 ? 0.06 : 0), 0.04] });
  }
  if (T.armor) hd(new THREE.BoxGeometry(0.2, 0.06, 0.2), "base", { pos: [0, 0.15, 0.04], rot: [-0.2, 0, 0], tint: 0.9 });

  /* 등 가시 (머리 뒤 → 목 → 등 → 꼬리 시작) — 어깨 위로 실루엣이 보이게 */
  if (T.spikes > 0) {
    const spine = new THREE.CatmullRomCurve3([V(0, head.position.y + 0.14 * H, head.position.z - 0.12 * H), n1.clone().add(V(0, 0.04, -0.13 * B)), V(0, P + 1.0 * B, -0.2 * B), V(0, P + 0.66 * B, -0.33 * B), V(0, P + 0.3 * B, -0.35 * B)]);
    const n = 10;
    for (let i = 0; i < n; i++) {
      const t = 0.06 + (i / (n - 1)) * 0.88;
      const p = spine.getPointAt(t);
      const tan = spine.getTangentAt(t);
      const h = (0.08 + Math.sin(t * Math.PI) * 0.07) * T.spikes;
      const ang = Math.atan2(-tan.z, tan.y);
      g.add(part(cone(T.mat === "lava" ? 5 : 8), T.mat === "ice" && T.icicles ? "ice" : accent, { pos: [p.x, p.y, p.z], rot: [ang - Math.PI / 2 - 0.4, 0, 0], scale: [0.045 * T.spikes, h, 0.055 * T.spikes] }));
    }
  }
  /* 날개 */
  if (T.wings !== "none") for (const s of [-1, 1]) addWing(g, s, T.wings, 1);

  /* 수정 다발 (어깨 · 등 — 앞에서도 보이게 바깥으로) */
  if (T.crystals) {
    const spots = [
      [0.27, P + 0.96 * B, 0.02 * B, 1.5, -0.1, -0.6],
      [-0.27, P + 0.96 * B, 0.02 * B, 1.35, -0.1, 0.6],
      [0, P + 1.1 * B, -0.22 * B, 1.7, -0.5, 0],
      [0.16, P + 0.72 * B, -0.3 * B, 1.2, -0.8, -0.5],
      [-0.18, P + 0.66 * B, -0.3 * B, 1.2, -0.9, 0.5],
      [0.34 * B, P + 0.3 * B, 0.2 * B, 1.0, 0.2, -0.8],
    ];
    for (const [x, y, z, s, rx, rz] of spots) {
      for (let k = 0; k < 3; k++) {
        g.add(part(new THREE.OctahedronGeometry(1, 0), "crystal", { pos: [x + (k - 1) * 0.04, y + 0.02, z], rot: [rx + (k - 1) * 0.2, k, rz + (k - 1) * 0.4], scale: [0.045 * s, (0.15 + k * 0.035) * s, 0.045 * s] }));
      }
    }
  }
  if (T.armor) {
    // 가슴판 · 어깨 갑옷
    g.add(part(new THREE.BoxGeometry(0.4, 0.34, 0.08), "base", { pos: [0, P + 0.72 * B, 0.3 * B], rot: [-0.3, 0, 0], tint: 0.88 }));
    for (let i = 0; i < 3; i++) g.add(part(new THREE.BoxGeometry(0.42, 0.03, 0.09), "base", { pos: [0, P + (0.62 + i * 0.1) * B, 0.33 * B - i * 0.025], rot: [-0.3, 0, 0], tint: 0.7 }));
    for (const s of [-1, 1]) g.add(part(sph(14), "base", { pos: [s * 0.3 * B, P + 0.9 * B, 0.1 * B], scale: [0.16, 0.12, 0.16], tint: 0.9 }));
  }
  if (T.icicles) {
    for (let i = 0; i < 5; i++) g.add(part(cone(6), "ice", { pos: [-0.16 + i * 0.08, P + 0.3 * B, 0.29 * B], rot: [Math.PI, 0, 0], scale: [0.025, 0.1 + (i % 2) * 0.05, 0.025] }));
  }
  if (T.rune) {
    // 가슴의 빛나는 룬 원판
    g.add(part(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20), "base", { pos: [0, P + 0.8 * B, 0.3 * B], rot: [Math.PI / 2 - 0.3, 0, 0], tint: 0.85 }));
    g.add(part(new THREE.TorusGeometry(0.09, 0.012, 6, 24), "glow", { pos: [0, P + 0.805 * B, 0.325 * B], rot: [-0.3, 0, 0] }));
    g.add(part(new THREE.OctahedronGeometry(0.035, 0), "glow", { pos: [0, P + 0.805 * B, 0.335 * B] }));
  }
  return g;
}

/* ---------------- 굽기 · 캐시 ---------------- */
const built = new Map();
/**
 * 종류 + 덮개(이끼 · 눈) → 재질별 지오메트리 (높이 1 로 맞춤)
 */
export function statueGeometry(typeId, cover = null, coverAmount = 0) {
  const key = `${typeId}|${cover}|${coverAmount}`;
  if (built.has(key)) return built.get(key);
  const T = TYPE_BY_ID[typeId];
  const grp = buildGroup(T);
  // 받침 위 드래곤만 (0, P, 0) 기준으로 늘이거나 줄여서 모든 종류의 전체 높이를 똑같이 맞춘다
  let box = new THREE.Box3().setFromObject(grp);
  const f = (H_REF - P) / (box.max.y - P);
  grp.children.forEach((c, i) => {
    if (i < PED_PARTS) return;
    c.position.y = P + (c.position.y - P) * f;
    c.position.x *= f;
    c.position.z *= f;
    c.scale.multiplyScalar(f);
  });
  grp.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(grp);
  const h = box.max.y;
  const geos = bake(grp, { ao: 0.45, cover, coverAmount, height: h, seed: STATUE_TYPES.indexOf(T) + 1 });
  // 모든 종류를 같은 비율로 줄인다 → 받침(크기 비교의 기준)이 종류와 상관없이 똑같다. 받침 가운데가 원점.
  const s = 1 / H_REF;
  let rad = 0;
  for (const g of Object.values(geos)) {
    g.scale(s, s, s);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const bb = g.boundingBox;
    rad = Math.max(rad, Math.hypot(Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x)), Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z))));
  }
  const res = { geos, radius: rad, height: h * s, width: (box.max.x - box.min.x) * s, depth: (box.max.z - box.min.z) * s };
  built.set(key, res);
  return res;
}

/* ---------------- 재질 (테마마다 돌 색이 다르다) ---------------- */
const mats = new Map();
export function statueMaterials(theme) {
  if (mats.has(theme.id)) return mats.get(theme.id);
  const stone = new THREE.MeshStandardMaterial({ color: theme.stone, map: scaleTex("color", 1), bumpMap: scaleTex("bump", 1), bumpScale: 0.9, roughness: 0.9, metalness: 0, vertexColors: true });
  const skin = new THREE.MeshStandardMaterial({ color: theme.stone, map: stoneTex(1), bumpMap: stoneBump(1), bumpScale: 1.0, roughness: 0.9, metalness: 0, vertexColors: true });
  const base = new THREE.MeshStandardMaterial({ color: theme.base || theme.stone, map: stoneTex(2), bumpMap: stoneBump(2), bumpScale: 1.5, roughness: 0.95, vertexColors: true });
  const gold = new THREE.MeshStandardMaterial({ color: "#e8b440", map: scaleTex("color", 3), bumpMap: scaleTex("bump", 3), bumpScale: 1.6, metalness: 0.85, roughness: 0.38, vertexColors: true });
  const crystal = new THREE.MeshStandardMaterial({ color: theme.crystal || "#6ff2ff", emissive: theme.crystal || "#38d8ff", emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.2, vertexColors: true, transparent: true, opacity: 0.92 });
  const ice = new THREE.MeshStandardMaterial({ color: "#bfe9ff", map: stoneTex(4), bumpMap: scaleTex("bump", 4), bumpScale: 1.0, roughness: 0.16, metalness: 0.08, emissive: "#3a7fb0", emissiveIntensity: 0.2, vertexColors: true });
  const lavaStone = new THREE.MeshStandardMaterial({ color: "#5a4c48", map: stoneTex(5), bumpMap: scaleTex("bump", 5), bumpScale: 2, roughness: 0.88, emissive: "#ff7a22", emissiveMap: lavaCrackTex(), emissiveIntensity: 1.25, vertexColors: true });
  const glow = new THREE.MeshStandardMaterial({ color: "#fff3b0", emissive: theme.glow || "#ffb43a", emissiveIntensity: 1.4, roughness: 0.4, vertexColors: true });
  const m = { stone, skin, base, gold, crystal, ice, lava: lavaStone, glow };
  mats.set(theme.id, m);
  return m;
}

/**
 * 석상 하나 (화면에 놓을 그룹). typeId 의 재질 규칙: ice/lava/gold 종류는 몸 전체가 그 재질.
 * @returns {THREE.Group} userData: { typeId, radius }
 */
export function makeStatue(typeId, theme) {
  const T = TYPE_BY_ID[typeId];
  const { geos, radius } = statueGeometry(typeId, theme.cover || null, theme.coverAmount || 0);
  const M = statueMaterials(theme);
  const g = new THREE.Group();
  for (const [mat, geo] of Object.entries(geos)) {
    let m = M[mat] || M.stone;
    if ((mat === "stone" || mat === "skin") && T.mat) m = M[T.mat];
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.mat = mat;
    g.add(mesh);
  }
  g.userData.typeId = typeId;
  g.userData.radius = radius;
  g.userData.height = statueGeometry(typeId, theme.cover || null, theme.coverAmount || 0).height;
  return g;
}
