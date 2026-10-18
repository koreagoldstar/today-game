/*
 * 드래곤 석상 대작전 · 꼬마 동물단 4종 (코드로 만든 3D 캐릭터) + 방망이
 *  병아리 · 새끼곰 · 새끼토끼 · 새끼수달 — 같은 뼈대(몸 · 머리 · 팔 · 다리 · 방망이)에 생김새만 다르다.
 *  움직임: 대기 · 걷기 · 달리기(출발) · 점프(시작 · 공중 · 낙하 · 착지) · 대시 · 방망이 공격(달리면서도) · 맞음 · 축하 · 쓰러짐
 *         · 체크포인트 · 등장 · 손 흔들기 · 석상 퍼즐 휘두르기 · 정답(점프) · 실패(깜짝 · 주저앉기) · 승리
 *  꾸미기: 모자 · 장식 (외형만)
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { woodTex } from "./tex.js?v=1";
import { slab, taperTube, horn } from "./geo.js?v=1";

const TAU = Math.PI * 2;
const sphCache = new Map();
/** 단위 공 (마디 수별로 하나만 만들어 같이 쓴다 → 메모리 절약) */
const sph = (seg = 28) => {
  if (!sphCache.has(seg)) {
    const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
    g.userData.shared = true;
    sphCache.set(seg, g);
  }
  return sphCache.get(seg);
};
/** 같이 쓰는 것(공 · 재질)은 남기고 이 캐릭터만의 모양을 정리 */
export function disposeModel(root) {
  root.traverse((o) => {
    if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
  });
}
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** 방망이 공격: 0~ATK_ON 들어 올림 · ATK_ON~ATK_OFF 맞는 순간(판정) · ~ATK_TIME 따라가기 */
export const ATK_ON = 0.09;
export const ATK_OFF = 0.19;
export const ATK_TIME = 0.34;

/* ---------------- 재질 (털: 벨벳 같은 부드러운 반사) ---------------- */
const matCache = new Map();
function fur(color, sheen = "#ffffff") {
  const k = `fur${color}${sheen}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshPhysicalMaterial({ color, roughness: 0.78, metalness: 0, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(sheen) }));
  return matCache.get(k);
}
function plain(color, o = {}) {
  const k = `pl${color}${JSON.stringify(o)}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o }));
  return matCache.get(k);
}
function basic(color, opacity = 1) {
  const k = `ba${color}${opacity}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
  return matCache.get(k);
}
function mesh(geo, mat, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scale === "number") m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}

/* ---------------- 캐릭터 정의 ---------------- */
export const CHARACTERS = [
  { id: "chick", name: "병아리", sub: "용감한 기본 캐릭터", color: "#ffd84a", belly: "#fff1a8", accent: "#ff9a2e", bat: "star", hop: 1, tag: "밝고 용감해요" },
  { id: "bear", name: "새끼곰", sub: "힘찬 휘두르기", color: "#a8703f", belly: "#f1d4a8", accent: "#5a3420", bat: "leaf", hop: 0.85, tag: "튼튼하고 힘차요" },
  { id: "bunny", name: "새끼토끼", sub: "빠르고 경쾌하게", color: "#fbf7f4", belly: "#ffffff", accent: "#ff9ab8", bat: "ribbon", hop: 1.25, tag: "빠르고 경쾌해요" },
  { id: "otter", name: "새끼수달", sub: "사랑스러운 점프", color: "#8a5a3a", belly: "#f4dcb8", accent: "#3a2418", bat: "water", hop: 1.1, tag: "통통 점프를 잘해요" },
];
export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

/* 방망이 꾸미기 (외형만 · 판정 · 힘과 상관없음) */
export const BATS = [
  { id: "wood", name: "기본 나무 방망이", need: 0, hint: "처음부터" },
  { id: "starlight", name: "별빛 방망이", need: 15, hint: "별 15개" },
  { id: "rainbow", name: "무지개 방망이", need: 40, hint: "별 40개" },
  { id: "crystal", name: "수정 방망이", need: 80, hint: "별 80개" },
  { id: "gold", name: "황금 방망이", need: 140, hint: "별 140개" },
];

/* ---------------- 방망이 ---------------- */
function starShape(r1, r2, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (n * 2)) * TAU + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
export function makeBat(decor, skin = "wood") {
  const g = new THREE.Group();
  // 나무 방망이: 손잡이 → 굵은 머리 (선반으로 깎은 모양)
  const prof = [
    [0.0, 0],
    [0.035, 0],
    [0.04, 0.02],
    [0.03, 0.04],
    [0.03, 0.2],
    [0.05, 0.32],
    [0.085, 0.45],
    [0.1, 0.56],
    [0.098, 0.62],
    [0.07, 0.66],
    [0, 0.665],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 20);
  let mat;
  if (skin === "starlight") mat = plain("#3a4aa8", { roughness: 0.35, emissive: "#1a2a7a", emissiveIntensity: 0.6 });
  else if (skin === "rainbow") mat = plain("#ffffff", { roughness: 0.4, map: rainbowTex() });
  else if (skin === "crystal") mat = plain("#9ff4ff", { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82, emissive: "#3ad8ff", emissiveIntensity: 0.35 });
  else if (skin === "gold") mat = plain("#f2c14e", { roughness: 0.25, metalness: 1 });
  else mat = new THREE.MeshStandardMaterial({ color: "#c8925a", map: woodTex("#c8925a"), roughness: 0.62 });
  g.add(mesh(geo, mat));
  // 손잡이 감은 천
  g.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.1, 14), plain(skin === "gold" ? "#a0281e" : "#d8463a", { roughness: 0.8 }), [0, 0.11, 0]));
  // 캐릭터 장식
  const top = 0.5;
  if (decor === "star" || skin === "starlight") {
    const st = mesh(slab(starShape(0.09, 0.04), 0.03, 0.012), plain(skin === "starlight" ? "#fff6a0" : "#ffd23f", { roughness: 0.35, emissive: "#ffb000", emissiveIntensity: 0.25 }), [0, top, 0.09], 1, [0, 0, 0.15]);
    g.add(st);
  }
  if (decor === "leaf") {
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0);
    leaf.quadraticCurveTo(0.07, 0.06, 0, 0.17);
    leaf.quadraticCurveTo(-0.07, 0.06, 0, 0);
    for (const [a, z] of [
      [-0.5, 1],
      [0.4, 1],
      [2.6, -1],
    ]) g.add(mesh(slab(leaf, 0.012, 0.004), plain("#4fbf4a", { roughness: 0.6 }), [0, top - 0.04, 0.09 * z], 1, [0.2 * z, 0, a]));
  }
  if (decor === "ribbon") {
    const pink = plain("#ff7aa8", { roughness: 0.55 });
    for (const s of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(0.045, 0.018, 8, 16), pink, [s * 0.05, top + 0.02, 0.09], [1, 0.7, 0.6], [0, 0, s * 0.5]));
    g.add(mesh(sph(10), pink, [0, top + 0.02, 0.1], 0.03));
    for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.03, 0.09, 0.012), pink, [s * 0.03, top - 0.05, 0.1], 1, [0, 0, s * 0.3]));
  }
  if (decor === "water") {
    const drop = new THREE.Shape();
    drop.moveTo(0, 0.1);
    drop.quadraticCurveTo(0.07, 0.0, 0.0, -0.06);
    drop.quadraticCurveTo(-0.07, 0.0, 0, 0.1);
    g.add(mesh(slab(drop, 0.03, 0.012), plain("#5ac8ff", { roughness: 0.15, transparent: true, opacity: 0.9, emissive: "#1a7acc", emissiveIntensity: 0.3 }), [0.02, top, 0.09]));
    g.add(mesh(slab(starShape(0.045, 0.02), 0.02, 0.008), plain("#3a8aff", { roughness: 0.3, emissive: "#1a4aaa", emissiveIntensity: 0.3 }), [-0.06, top + 0.08, 0.06], 1, [0, 0.4, 0.3]));
  }
  if (skin === "crystal") for (let k = 0; k < 3; k++) g.add(mesh(new THREE.OctahedronGeometry(0.035, 0), plain("#dffcff", { emissive: "#7ff0ff", emissiveIntensity: 0.8 }), [Math.cos(k * 2.1) * 0.1, 0.52 + k * 0.03, Math.sin(k * 2.1) * 0.1]));
  if (skin === "gold") g.add(mesh(sph(10), plain("#ff4a6a", { roughness: 0.1, emissive: "#a01030", emissiveIntensity: 0.4 }), [0, 0.6, 0.09], 0.03));
  g.traverse((o) => (o.castShadow = true));
  return g;
}
let _rb = null;
function rainbowTex() {
  if (_rb) return _rb;
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 128;
  const x = c.getContext("2d");
  const cols = ["#ff5a5a", "#ffa63a", "#ffe14a", "#5ad86a", "#4aa8ff", "#8a6aff"];
  cols.forEach((col, i) => {
    x.fillStyle = col;
    x.fillRect(0, (i / cols.length) * 128, 8, 128 / cols.length + 1);
  });
  _rb = new THREE.CanvasTexture(c);
  _rb.colorSpace = THREE.SRGBColorSpace;
  return _rb;
}

/* ---------------- 꾸미기: 모자 · 장식 (외형만 · 능력과 상관없음) ---------------- */
export const HATS = [
  { id: "none", name: "모자 없음" },
  { id: "explorer", name: "탐험가 모자" },
  { id: "flower", name: "꽃 화관" },
  { id: "leaf", name: "나뭇잎 모자" },
  { id: "wizard", name: "마법사 모자" },
  { id: "crown", name: "황금 왕관" },
  { id: "horns", name: "드래곤 뿔" },
];
export const DECOS = [
  { id: "none", name: "장식 없음" },
  { id: "scarf", name: "빨간 목도리" },
  { id: "medal", name: "별 메달" },
  { id: "cape", name: "모험가 망토" },
  { id: "wings", name: "꼬마 드래곤 날개" },
];
function leafShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.08 * s, 0.07 * s, 0, 0.2 * s);
  sh.quadraticCurveTo(-0.08 * s, 0.07 * s, 0, 0);
  return sh;
}
/** 모자 (머리 꼭대기 기준 원점) */
export function makeHat(id) {
  const g = new THREE.Group();
  if (id === "explorer") {
    const khaki = plain("#d9bb7c", { roughness: 0.85 });
    g.add(mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.14, 22), khaki, [0, 0.06, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.04, 22), plain("#7a4a2a", { roughness: 0.7 }), [0, 0.02, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.022, 28), khaki, [0, -0.01, 0]));
    g.add(mesh(sph(10), plain("#e84a3a"), [0.17, 0.05, 0.08], [0.035, 0.035, 0.035]));
  } else if (id === "flower") {
    g.add(mesh(new THREE.TorusGeometry(0.25, 0.03, 8, 28), plain("#4fae48", { roughness: 0.7 }), [0, -0.02, 0], 1, [Math.PI / 2, 0, 0]));
    const cols = ["#ff8fb8", "#ffe14a", "#ffffff", "#b48aff", "#ff8fb8", "#ffe14a", "#ffffff"];
    cols.forEach((c, i) => {
      const a = (i / cols.length) * TAU;
      const p = [Math.cos(a) * 0.25, 0.0, Math.sin(a) * 0.25];
      for (let k = 0; k < 5; k++) {
        const b = (k / 5) * TAU;
        g.add(mesh(sph(8), plain(c, { roughness: 0.6 }), [p[0] + Math.cos(b) * 0.035, p[1] + 0.01, p[2] + Math.sin(b) * 0.035], [0.03, 0.018, 0.03]));
      }
      g.add(mesh(sph(8), plain("#ffb43a"), [p[0], p[1] + 0.025, p[2]], 0.02));
    });
  } else if (id === "leaf") {
    g.add(mesh(slab(leafShape(2.8), 0.02, 0.008), plain("#5fbf4a", { roughness: 0.6, side: THREE.DoubleSide }), [0, 0.0, 0.02], 1, [-0.45, 0, 0.35]));
    g.add(mesh(slab(leafShape(2.0), 0.02, 0.008), plain("#7ad65a", { roughness: 0.6, side: THREE.DoubleSide }), [0.03, 0.0, 0.0], 1, [-0.3, 0.9, -0.55]));
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 6), plain("#6a4a2a"), [0, 0.06, 0], 1, [0.2, 0, -0.3]));
  } else if (id === "wizard") {
    const purple = plain("#6a4ab8", { roughness: 0.65 });
    g.add(mesh(new THREE.ConeGeometry(0.2, 0.46, 20), purple, [0, 0.23, -0.02], 1, [-0.2, 0, 0.12]));
    g.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.022, 26), purple, [0, 0, 0]));
    g.add(mesh(slab(starShape(0.06, 0.026), 0.02, 0.006), plain("#ffd23f", { emissive: "#ffb000", emissiveIntensity: 0.4 }), [0, 0.15, 0.17], 1, [-0.3, 0, 0]));
  } else if (id === "crown") {
    const gold = plain("#f2c14e", { roughness: 0.25, metalness: 1, side: THREE.DoubleSide });
    g.add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.11, 10, 1, true), gold, [0, 0.04, 0]));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.add(mesh(new THREE.ConeGeometry(0.035, 0.09, 6), gold, [Math.sin(a) * 0.16, 0.13, Math.cos(a) * 0.16]));
      g.add(mesh(sph(8), plain("#fff2b0", { metalness: 0.6, roughness: 0.2 }), [Math.sin(a) * 0.16, 0.18, Math.cos(a) * 0.16], 0.02));
    }
    g.add(mesh(sph(10), plain("#ff4a6a", { roughness: 0.1, emissive: "#a01030", emissiveIntensity: 0.4 }), [0, 0.05, 0.165], 0.03));
  } else if (id === "horns") {
    const bone = plain("#f4e6c8", { roughness: 0.5 });
    for (const s of [-1, 1]) {
      const h = mesh(horn(0.26, 0.05, 0.9, 0.3, 10), bone, [s * 0.13, -0.02, -0.02], 1, [-0.3, 0, -s * 0.5]);
      g.add(h);
    }
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry(0.03, 0.08, 6), plain("#5ac8a8", { roughness: 0.5 }), [0, -0.0 - i * 0.01, -0.08 - i * 0.09], 1, [-0.7 - i * 0.25, 0, 0]));
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}
/** 장식 (몸에 붙는다) */
function addDeco(id, R, def) {
  const parts = [];
  const add = (m, parent = R.body) => {
    parent.add(m);
    parts.push(m);
    return m;
  };
  R.cape = null;
  R.decoWings = null;
  if (id === "scarf") {
    const red = plain("#e8463a", { roughness: 0.8 });
    add(mesh(new THREE.TorusGeometry(R.neckR, 0.05, 10, 28), red, [0, R.neckY, 0], [1, 1, 0.7], [Math.PI / 2, 0, 0]));
    add(mesh(new THREE.BoxGeometry(0.09, 0.2, 0.04), red, [R.neckR * 0.55, R.neckY - 0.1, -R.neckR * 0.8], 1, [0.3, 0, 0.25]));
    add(mesh(new THREE.BoxGeometry(0.09, 0.03, 0.045), plain("#ffd84a"), [R.neckR * 0.55, R.neckY - 0.19, -R.neckR * 0.84], 1, [0.3, 0, 0.25]));
  } else if (id === "medal") {
    add(mesh(new THREE.BoxGeometry(0.05, 0.14, 0.02), plain("#3a8aff"), [0, R.neckY - 0.08, R.bodyR * 0.92], 1, [-0.25, 0, 0]));
    add(mesh(slab(starShape(0.075, 0.034), 0.025, 0.008), plain("#ffd23f", { roughness: 0.3, metalness: 0.6, emissive: "#ffa000", emissiveIntensity: 0.25 }), [0, R.neckY - 0.17, R.bodyR * 0.98], 1, [-0.2, 0, 0]));
  } else if (id === "cape") {
    const pivot = new THREE.Group();
    pivot.position.set(0, R.neckY - 0.02, -R.bodyR * 0.72);
    const sh = new THREE.Shape();
    sh.moveTo(-0.17, 0);
    sh.lineTo(0.17, 0);
    sh.lineTo(0.26, -0.42);
    sh.quadraticCurveTo(0, -0.48, -0.26, -0.42);
    sh.lineTo(-0.17, 0);
    pivot.add(mesh(slab(sh, 0.02, 0.006), plain("#c8302e", { roughness: 0.75, side: THREE.DoubleSide }), [0, 0, -0.02]));
    pivot.add(mesh(new THREE.TorusGeometry(0.17, 0.02, 6, 16, Math.PI), plain("#ffd84a"), [0, 0.01, 0.06], 1, [Math.PI / 2, 0, 0]));
    add(pivot);
    R.cape = pivot;
  } else if (id === "wings") {
    const teal = plain("#5ad0b8", { roughness: 0.5, side: THREE.DoubleSide, emissive: "#1a6a5a", emissiveIntensity: 0.2 });
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.quadraticCurveTo(0.12, 0.16, 0.26, 0.14);
    sh.quadraticCurveTo(0.2, 0.06, 0.24, 0.0);
    sh.quadraticCurveTo(0.14, -0.02, 0.15, -0.08);
    sh.quadraticCurveTo(0.07, -0.02, 0, 0);
    R.decoWings = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(s * 0.06, R.neckY - 0.08, -R.bodyR * 0.85);
      w.add(mesh(slab(sh, 0.015, 0.005), teal, [0, 0, 0], [s, 1, 1]));
      add(w);
      R.decoWings.push(w);
    }
  }
  for (const p of parts) p.traverse((o) => o.isMesh && (o.castShadow = true));
  return parts;
}

/* ---------------- 얼굴 부품 ---------------- */
function addEyes(head, { y = 0.04, x = 0.15, z = 0.36, r = 0.085, tilt = 0 }) {
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(s * x, y, z);
    e.rotation.set(-0.1, s * 0.32, s * tilt);
    // 눈동자 (반짝이는 검정) + 반사광 둘
    e.add(mesh(sph(20), plain("#1a1214", { roughness: 0.12 }), [0, 0, 0], [r * 0.82, r, r * 0.55]));
    e.add(mesh(sph(10), basic("#ffffff"), [-0.03 * (r / 0.085), 0.034 * (r / 0.085), r * 0.42], r * 0.32));
    e.add(mesh(sph(8), basic("#ffffff"), [0.022 * (r / 0.085), -0.02 * (r / 0.085), r * 0.45], r * 0.14));
    e.add(mesh(sph(8), basic("#5a4aa0", 0.55), [0, -0.035 * (r / 0.085), r * 0.3], [r * 0.5, r * 0.3, r * 0.2]));
    head.add(e);
    eyes.push(e);
  }
  return eyes;
}
function addCheeks(head, { y = -0.06, x = 0.24, z = 0.3, color = "#ff8fb0", r = 0.07 }) {
  for (const s of [-1, 1]) head.add(mesh(sph(14), basic(color, 0.55), [s * x, y, z], [r, r * 0.6, r * 0.3], [0, s * 0.6, 0]));
}
/** 입: 작은 웃는 곡선 (닫힘) · 벌린 입 (열림) — 둘 다 만들어 두고 켜고 끈다 */
function addMouth(head, { y = -0.1, z = 0.38, w = 0.05, color = "#5a2a2a" }) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * w, -Math.sin(a) * w * 0.5, 0));
  }
  const smile = mesh(taperTube(pts, () => 0.008, 10, 6), plain(color, { roughness: 0.6 }), [0, y, z]);
  head.add(smile);
  const open = new THREE.Group();
  open.add(mesh(sph(14), plain("#7a2a3a", { roughness: 0.7 }), [0, 0, 0], [w * 1.1, w * 0.9, w * 0.45]));
  open.add(mesh(sph(10), plain("#ff7a8a", { roughness: 0.7 }), [0, -w * 0.4, w * 0.15], [w * 0.7, w * 0.35, w * 0.3]));
  open.position.set(0, y - 0.01, z - 0.01);
  open.visible = false;
  head.add(open);
  return { smile, open };
}

/* ---------------- 종별 몸 만들기 ---------------- */
function buildBody(def) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 엉덩이 기준 (튀어 오르기 · 기울기)
  root.add(body);
  const head = new THREE.Group();
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  const legs = [];
  const hand = new THREE.Group(); // 방망이 잡는 곳
  const ears = [];
  const F = fur(def.color, def.id === "bunny" ? "#fff6fa" : "#fff4d6");
  const Fb = fur(def.belly, "#ffffff");
  const acc = plain(def.accent, { roughness: 0.55 });
  let faceZ = 0.36;
  let headR = 0.4;

  if (def.id === "chick") {
    // 동그란 몸 + 큰 머리가 한 덩어리처럼
    body.add(mesh(sph(), F, [0, 0.3, 0], [0.34, 0.31, 0.32]));
    body.add(mesh(sph(), Fb, [0, 0.27, 0.12], [0.24, 0.22, 0.22]));
    head.position.set(0, 0.62, 0.02);
    head.add(mesh(sph(32), F, [0, 0, 0], [0.4, 0.37, 0.38]));
    // 머리 위 깃털 세 가닥
    for (const [x, rz, s] of [
      [-0.06, 0.5, 0.8],
      [0, 0, 1],
      [0.06, -0.5, 0.8],
    ]) head.add(mesh(sph(14), F, [x, 0.38, -0.02], [0.05 * s, 0.13 * s, 0.05 * s], [0.2, 0, rz]));
    // 부리 (위 · 아래)
    head.add(mesh(new THREE.ConeGeometry(0.075, 0.12, 14), acc, [0, -0.04, 0.37], 1, [Math.PI / 2 + 0.25, 0, 0]));
    head.add(mesh(new THREE.ConeGeometry(0.055, 0.07, 14), plain("#e8742a", { roughness: 0.55 }), [0, -0.09, 0.33], 1, [Math.PI / 2 - 0.35, 0, 0]));
    faceZ = 0.34;
    headR = 0.38;
    // 날개 (팔)
    for (const [arm, s] of [
      [armL, -1],
      [armR, 1],
    ]) {
      arm.position.set(s * 0.3, 0.38, 0.02);
      arm.add(mesh(sph(16), F, [s * 0.05, -0.08, 0], [0.09, 0.15, 0.11], [0, 0, s * 0.35]));
      for (let i = 0; i < 3; i++) arm.add(mesh(sph(10), F, [s * (0.08 + i * 0.012), -0.2 - i * 0.02, 0.02 - i * 0.03], [0.04, 0.06, 0.04]));
    }
    // 다리 · 발 (주황)
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.13, 0.06, 0.02);
      leg.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8), acc, [0, 0.02, 0]));
      for (const a of [-0.45, 0, 0.45]) leg.add(mesh(sph(10), acc, [Math.sin(a) * 0.05, -0.03, Math.cos(a) * 0.06], [0.03, 0.022, 0.06], [0, a, 0]));
      root.add(leg);
      legs.push(leg);
    }
    // 작은 배낭 (등)
    body.add(mesh(new THREE.BoxGeometry(0.26, 0.24, 0.12), plain("#c8622e", { roughness: 0.7 }), [0, 0.38, -0.33], 1, [0.1, 0, 0]));
  } else {
    // 곰 · 토끼 · 수달: 작은 몸통 + 큰 머리 + 짧은 팔다리
    const bw = def.id === "bear" ? 0.27 : def.id === "otter" ? 0.24 : 0.23;
    body.add(mesh(sph(), F, [0, 0.27, 0], [bw, 0.27, bw * 0.92]));
    body.add(mesh(sph(), Fb, [0, 0.25, bw * 0.92 - bw * 0.42], [bw * 0.72, 0.2, bw * 0.5]));
    head.position.set(0, 0.66, 0.02);
    headR = def.id === "bear" ? 0.4 : 0.38;
    head.add(mesh(sph(32), F, [0, 0, 0], [headR, headR * 0.92, headR * 0.94]));
    if (def.id === "bear") {
      // 주둥이 · 코 · 둥근 귀
      head.add(mesh(sph(22), Fb, [0, -0.1, 0.3], [0.17, 0.12, 0.12]));
      head.add(mesh(sph(16), plain("#2a1a14", { roughness: 0.25 }), [0, -0.05, 0.42], [0.055, 0.04, 0.035]));
      for (const s of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(s * 0.27, 0.27, -0.02);
        ear.add(mesh(sph(16), F, [0, 0, 0], [0.11, 0.11, 0.07]));
        ear.add(mesh(sph(14), Fb, [0, -0.005, 0.04], [0.065, 0.065, 0.03]));
        head.add(ear);
        ears.push(ear);
      }
      faceZ = 0.36;
    } else if (def.id === "bunny") {
      // 긴 귀 (안쪽 분홍) · 분홍 코 · 앞니
      for (const s of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(s * 0.13, 0.3, -0.04);
        ear.rotation.set(-0.15, 0, s * -0.12);
        ear.add(mesh(sph(18), F, [0, 0.22, 0], [0.085, 0.26, 0.055]));
        ear.add(mesh(sph(14), plain("#ffb3c8", { roughness: 0.6 }), [0, 0.22, 0.035], [0.05, 0.2, 0.02]));
        head.add(ear);
        ears.push(ear);
      }
      head.add(mesh(sph(14), plain("#ff8fae", { roughness: 0.35 }), [0, -0.03, 0.37], [0.04, 0.03, 0.03]));
      head.add(mesh(sph(14), Fb, [0, -0.09, 0.32], [0.12, 0.08, 0.08]));
      for (const s of [-1, 1]) head.add(mesh(new THREE.BoxGeometry(0.035, 0.045, 0.015), plain("#ffffff", { roughness: 0.3 }), [s * 0.019, -0.15, 0.37]));
      // 동그란 꼬리
      body.add(mesh(sph(14), Fb, [0, 0.16, -0.24], 0.09));
      faceZ = 0.35;
    } else {
      // 수달: 크림색 얼굴 아래 · 작은 귀 · 코 · 수염 · 납작 꼬리
      head.add(mesh(sph(22), Fb, [0, -0.1, 0.22], [0.24, 0.16, 0.18]));
      head.add(mesh(sph(16), plain("#2a1814", { roughness: 0.25 }), [0, -0.05, 0.39], [0.06, 0.04, 0.035]));
      for (const s of [-1, 1]) {
        const ear = mesh(sph(12), F, [s * 0.29, 0.18, -0.02], [0.06, 0.06, 0.04]);
        head.add(ear);
        ears.push(ear);
        for (const dy of [-0.01, 0.025]) head.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 4), plain("#ffffff", { roughness: 0.4 }), [s * 0.16, -0.08 + dy, 0.34], 1, [0, 0, Math.PI / 2 + s * dy * 3]));
      }
      body.add(mesh(sph(16), F, [0, 0.06, -0.3], [0.1, 0.05, 0.22], [0.5, 0, 0]));
      faceZ = 0.35;
    }
    // 팔 (짧은 앞발)
    for (const [arm, s] of [
      [armL, -1],
      [armR, 1],
    ]) {
      arm.position.set(s * (bw - 0.02), 0.4, 0.04);
      arm.add(mesh(sph(14), F, [s * 0.03, -0.1, 0], [0.065, 0.13, 0.065], [0, 0, s * 0.2]));
      arm.add(mesh(sph(12), def.id === "bear" ? F : Fb, [s * 0.05, -0.21, 0.01], [0.06, 0.055, 0.06]));
    }
    // 다리 (짧고 통통) + 발바닥
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(s * 0.12, 0.08, 0.02);
      leg.add(mesh(sph(14), F, [0, 0.02, 0.02], [0.08, 0.08, 0.1]));
      leg.add(mesh(sph(10), Fb, [0, -0.01, 0.1], [0.05, 0.035, 0.03]));
      root.add(leg);
      legs.push(leg);
    }
  }
  // 얼굴: 눈 · 볼 · 입
  const eyes = addEyes(head, { y: def.id === "chick" ? 0.06 : 0.05, x: def.id === "chick" ? 0.14 : 0.15, z: faceZ - 0.02, r: def.id === "bear" ? 0.08 : 0.085 });
  addCheeks(head, { y: def.id === "chick" ? -0.04 : -0.06, x: headR * 0.6, z: faceZ - 0.08 });
  const mouth = addMouth(head, { y: def.id === "chick" ? -0.13 : def.id === "bunny" ? -0.07 : -0.12, z: faceZ + (def.id === "chick" ? -0.02 : 0.03), w: 0.045 });
  if (def.id === "chick") mouth.smile.visible = false; // 병아리는 부리가 입

  body.add(head);
  body.add(armL);
  body.add(armR);
  // 방망이: 오른팔 끝에 (들고 있는 기본 자세: 어깨에 기대듯)
  hand.position.set(0.06, -0.2, 0.04);
  armR.add(hand);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const chick = def.id === "chick";
  return {
    root,
    body,
    head,
    armL,
    armR,
    legs,
    hand,
    ears,
    eyes,
    mouth,
    bodyR: chick ? 0.34 : def.id === "bear" ? 0.27 : def.id === "otter" ? 0.24 : 0.23,
    neckY: chick ? 0.4 : 0.44,
    neckR: chick ? 0.37 : 0.31,
    headTop: chick ? 0.35 : headR * 0.9,
  };
}

/* ================================================================
 * 캐릭터: 모양 + 움직임
 * ============================================================== */
export class Character {
  constructor(id, batSkin = "wood") {
    this.def = CHAR_BY_ID[id];
    this.rig = buildBody(this.def);
    this.group = this.rig.root;
    this.setBat(batSkin);
    this.t = Math.random() * 10;
    this.state = "idle";
    this.st = 0;
    this.blinkT = 2;
    this.blink = 0;
    this.face = 0; // 몸이 보는 방향 (y 회전)
    this.faceTo = 0;
    this.jump = 0;
    this.squash = 0;
    this.onDone = null;
    this.pos = new THREE.Vector3();
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.mood = "happy";
    this.atkT = -1;
    this.speed01 = 0;
    this.outfit = { hat: "none", deco: "none" };
    this.outfitParts = [];
  }
  /** 모자 · 장식 바꾸기 */
  setOutfit({ hat = "none", deco = "none" } = {}) {
    for (const p of this.outfitParts) {
      p.parent && p.parent.remove(p);
      disposeModel(p);
    }
    this.outfitParts = [];
    this.outfit = { hat, deco };
    const R = this.rig;
    if (hat && hat !== "none") {
      const h = makeHat(hat);
      h.position.set(0, R.headTop - 0.05, -0.03);
      h.rotation.x = -0.2;
      R.head.add(h);
      this.outfitParts.push(h);
    }
    if (deco && deco !== "none") this.outfitParts.push(...addDeco(deco, R, this.def));
  }
  setBat(skin) {
    const h = this.rig.hand;
    while (h.children.length) {
      disposeModel(h.children[0]);
      h.remove(h.children[0]);
    }
    const bat = makeBat(this.def.bat, skin);
    // 방망이 축 = 팔 방향(-y)과 앞(+z) 사이 → 팔을 들면 머리 뒤로, 내리치면 앞쪽 아래로
    bat.rotation.set(2.1, 0, -0.12);
    bat.position.set(0, 0.04, -0.07);
    h.add(bat);
    this.bat = bat;
  }
  /** 동작 시작: idle · walk · hop(to) · swing · happy · oops · sit · win · wave · enter */
  play(state, opts = {}) {
    this.state = state;
    this.st = 0;
    this.opts = opts;
    if (state === "swing") this.hitFired = false;
    if (opts.to) {
      this.from.copy(this.pos);
      this.to.copy(opts.to);
    }
  }
  /** 방망이 공격 (윗몸만 · 달리면서도 휘두른다). 반환: 시작했으면 true */
  attack() {
    if (this.atkT >= 0 && this.atkT < ATK_TIME) return false;
    this.atkT = 0;
    this.atkHit = new Set();
    return true;
  }
  /** 지금 방망이가 맞는 순간인가 (모션과 판정이 일치) */
  get attackActive() {
    return this.atkT >= ATK_ON && this.atkT <= ATK_OFF;
  }
  /** 방망이 끝 위치 (세계 좌표) */
  batTip(out) {
    out.set(0, 0.62, 0);
    if (this.bat) this.bat.localToWorld(out);
    return out;
  }
  update(dt) {
    this.t += dt;
    this.st += dt;
    const R = this.rig;
    const d = this.def;
    const t = this.t;
    const st = this.st;
    // 눈 깜빡임
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinkT = 2 + Math.random() * 2.5;
      this.blink = 0.14;
    }
    if (this.blink > 0) this.blink -= dt;
    // 기본 자세로 조금씩 돌아오기
    let bodyY = 0;
    let bodyRX = 0;
    let bodyRZ = 0;
    let headRX = 0;
    let headRZ = Math.sin(t * 1.3) * 0.05;
    let armRX = -1.25;
    let armRZ = 0.2;
    let armLX = 0;
    let armLZ = -0.15;
    let sq = 1 + Math.sin(t * 2.6) * 0.02; // 숨쉬기
    let legLift = [0, 0];
    let legZ = [0, 0];
    let eyeOpen = this.blink > 0 ? 0.12 : 1;
    let mouthOpen = false;
    let earWiggle = Math.sin(t * 2) * 0.06;
    let face = this.faceTo;
    const s = this.state;
    const sp = clamp(this.speed01 || 0, 0, 1);
    if (s === "idle") {
      bodyY = Math.abs(Math.sin(t * 1.4)) * 0.008;
    } else if (s === "run" || s === "walk" || s === "startRun") {
      // 달리기 · 걷기 · 출발: 다리가 앞뒤로 번갈아, 팔은 반대로, 몸은 앞으로 기운다 (속도에 맞춰 보폭 · 빠르기)
      const v = s === "walk" ? Math.max(0.35, sp) : s === "startRun" ? Math.max(0.55, sp) : sp;
      this.runPh = (this.runPh || 0) + dt * (7 + 8 * v);
      const ph = this.runPh;
      const sn = Math.sin(ph);
      legZ = [sn * 0.1 * v, -sn * 0.1 * v];
      legLift = [Math.max(0, Math.cos(ph)) * 0.08 * v, Math.max(0, -Math.cos(ph)) * 0.08 * v];
      bodyY = Math.abs(sn) * 0.05 * v * d.hop;
      bodyRX = 0.2 * v + (s === "startRun" ? 0.24 * (1 - Math.min(1, st / 0.16)) : 0); // 출발: 확 숙이며 박차고 나간다
      bodyRZ = sn * 0.05 * v;
      armLX = -sn * 1.0 * v;
      armLZ = -0.3;
      armRX = -1.3 + sn * 0.3 * v;
      headRX = -0.1 * v;
      earWiggle = Math.sin(ph * 2) * 0.18 * v;
      // 발이 땅에 닿을 때 발소리
      const sg = sn >= 0 ? 1 : -1;
      if (this.lastSg && sg !== this.lastSg && v > 0.25 && this.onStep) this.onStep(v);
      this.lastSg = sg;
      if (s === "startRun" && st > 0.16) this.play(sp < 0.5 ? "walk" : "run");
    } else if (s === "jumpStart") {
      // 점프 시작: 쭉 늘어나며 튀어 오름
      const k = Math.min(1, st / 0.12);
      sq = 1.16 - 0.1 * k;
      armLX = -2.4 * k;
      armLZ = -0.6;
      armRX = -1.3 - 0.6 * k;
      legLift = [0.06, 0.06];
      mouthOpen = true;
      if (st > 0.12) this.play("jumpLoop");
    } else if (s === "jumpLoop") {
      // 공중 (올라가는 중): 다리를 접고 팔을 위로
      sq = 1.05;
      armLX = -2.3;
      armLZ = -0.7;
      armRX = -1.9;
      armRZ = 0.4;
      legLift = [0.09, 0.07];
      legZ = [0.03, -0.03];
      bodyRX = -0.05;
      mouthOpen = true;
    } else if (s === "fall") {
      // 떨어지는 중: 팔을 파닥파닥, 다리는 늘어뜨림
      armLX = -2.6 + Math.sin(t * 18) * 0.45;
      armLZ = -0.9;
      armRX = -2.0 + Math.sin(t * 18 + 1) * 0.3;
      armRZ = 0.6;
      legZ = [Math.sin(t * 14) * 0.04, -Math.sin(t * 14) * 0.04];
      bodyRX = 0.08;
      mouthOpen = true;
      eyeOpen = this.blink > 0 ? 0.12 : 1.18;
      earWiggle = 0.4;
    } else if (s === "land") {
      // 착지: 꾹 눌렸다 펴짐
      const k = Math.min(1, st / 0.14);
      sq = 0.8 + 0.2 * k;
      bodyY = -0.035 * (1 - k);
      armLX = -0.6 * (1 - k);
      if (k >= 1) this.finish(this.opts.next || "idle");
    } else if (s === "dodge") {
      // 대시: 몸을 낮추고 앞으로 쭉 (팔은 뒤로)
      const k = Math.min(1, st / 0.26);
      sq = 0.86;
      bodyRX = 0.32 * Math.sin(k * Math.PI) + 0.12;
      headRX = -0.35;
      bodyY = 0.02;
      armLX = 1.0;
      armLZ = -0.5;
      armRX = 0.5;
      armRZ = 0.5;
      legZ = [-0.06, -0.06];
      legLift = [0.04, 0.04];
      earWiggle = -0.6;
      if (k >= 1) this.finish(this.opts.next || "idle");
    } else if (s === "hop") {
      // 목표 석상 앞으로 깡충 (opts.dur)
      const dur = this.opts.dur || 0.28;
      const k = Math.min(1, st / dur);
      this.pos.lerpVectors(this.from, this.to, ease(k));
      bodyY = Math.sin(k * Math.PI) * 0.28 * d.hop;
      sq = 1 + Math.sin(k * Math.PI) * 0.08;
      armRX = -0.9 - k * 1.2; // 미리 방망이를 든다
      armRZ = 0.2 + k * 0.2;
      legLift = [0.05, 0.05];
      if (k >= 1) this.finish(this.opts.next || "idle");
    } else if (s === "wave" || s === "enter") {
      // 손 흔들기 (선택 화면) · 등장: 깡충 뛰어 들어와 손 흔들기
      if (s === "enter" && st < 0.6) {
        const k = st / 0.6;
        this.pos.lerpVectors(this.from, this.to, ease(k));
        bodyY = Math.sin(k * Math.PI * 3) * 0.12 * d.hop;
        legLift = [Math.max(0, Math.sin(k * 18)) * 0.05, Math.max(0, -Math.sin(k * 18)) * 0.05];
      } else {
        armLX = -2.6 + Math.sin(t * 9) * 0.35;
        armLZ = -0.5;
        mouthOpen = true;
        bodyY = Math.abs(Math.sin(t * 4)) * 0.02;
        headRZ = Math.sin(t * 4) * 0.08;
        if (s === "enter" && st > 1.6) this.finish("idle");
      }
    } else if (s === "swing") {
      // 석상 퍼즐 휘두르기: 뒤로 젖힘(0~0.12) → 쾅(0.12~0.22) → 따라가기
      const a = st;
      if (a < 0.12) {
        const k = a / 0.12;
        armRX = -2.1 - k * 1.1;
        armRZ = 0.4 + k * 0.15;
        bodyRX = -0.12 * k;
        bodyY = 0.03 * k;
        sq = 1 + 0.06 * k;
      } else if (a < 0.24) {
        const k = (a - 0.12) / 0.12;
        armRX = -3.2 + ease(k) * 3.3;
        armRZ = 0.55 - k * 0.4;
        bodyRX = -0.12 + k * 0.32;
        sq = 1.06 - k * 0.14;
        mouthOpen = true;
        if (!this.hitFired && k > 0.6) {
          this.hitFired = true;
          if (this.opts.onHit) this.opts.onHit();
        }
      } else {
        const k = Math.min(1, (a - 0.24) / 0.25);
        armRX = 0.1 - k * 1.0;
        armRZ = 0.15 + k * 0.05;
        bodyRX = 0.2 - k * 0.2;
        sq = 0.92 + k * 0.08;
        if (k >= 1) this.finish(this.opts.next || "idle");
      }
    } else if (s === "happy" || s === "win" || s === "celebrate") {
      // 신나서 폴짝 (win · celebrate 는 빙글 돌며)
      const per = s === "happy" ? 0.42 : 0.55;
      const k = (st % per) / per;
      bodyY = Math.sin(k * Math.PI) * 0.22 * d.hop;
      sq = k < 0.1 ? 0.88 : 1.04;
      armLX = -2.8;
      armLZ = -0.6;
      armRX = -2.4;
      armRZ = 0.7;
      mouthOpen = true;
      eyeOpen = 0.55; // 웃는 눈 (반달)
      if (s !== "happy") face = this.faceTo + st * 6;
      earWiggle = Math.sin(t * 14) * 0.2;
      if (this.opts.dur && st > this.opts.dur) this.finish(this.opts.next || "idle");
    } else if (s === "checkpoint") {
      // 체크포인트: 깡충 한 번 + 손 번쩍
      const k = Math.min(1, st / 0.55);
      bodyY = Math.sin(k * Math.PI) * 0.2 * d.hop;
      armLX = -2.9;
      armLZ = -0.4 + Math.sin(t * 16) * 0.2;
      mouthOpen = true;
      eyeOpen = 0.6;
      if (k >= 1) this.finish(this.opts.next || "idle");
    } else if (s === "hit" || s === "oops") {
      // 맞음 · 깜짝! 뒤로 폴짝 → 엉덩방아(oops 만) → 털고 일어남
      const short = s === "hit";
      if (st < 0.25) {
        const k = st / 0.25;
        bodyY = Math.sin(k * Math.PI) * 0.16;
        bodyRX = -0.35 * k;
        armLX = -1.8;
        armRX = -1.4;
        eyeOpen = short ? 0.15 : 1.25;
        mouthOpen = true;
        headRZ = short ? Math.sin(st * 40) * 0.15 : headRZ;
      } else if (!short && st < 0.75) {
        const k = (st - 0.25) / 0.5;
        bodyY = -0.06 * Math.sin(k * Math.PI);
        sq = 0.86 + 0.14 * k;
        bodyRX = -0.35 + k * 0.2;
        headRZ = Math.sin(st * 30) * 0.12 * (1 - k); // 어질어질
        eyeOpen = 0.35;
      } else {
        const k = Math.min(1, (st - (short ? 0.25 : 0.75)) / 0.2);
        bodyRX = -0.15 * (1 - k);
        if (k >= 1) this.finish(this.opts.next || "idle");
      }
    } else if (s === "sad") {
      // 게임 오버: 주저앉아 훌쩍
      bodyY = -0.05;
      sq = 0.9;
      headRX = 0.35;
      eyeOpen = 0.3;
      armLX = -0.3;
      armRX = -0.3;
      earWiggle = -0.3;
    } else if (s === "defeat") {
      // 쓰러짐: 뒤로 콩 넘어져 어질어질
      const k = Math.min(1, st / 0.35);
      bodyRX = -1.15 * ease(k);
      bodyY = 0.05 * Math.sin(k * Math.PI);
      armLX = -2.4;
      armLZ = -0.9;
      armRX = -2.2;
      armRZ = 0.8;
      legLift = [0.1 * k, 0.06 * k];
      legZ = [0.12 * k, 0.08 * k];
      eyeOpen = 0.1;
      mouthOpen = true;
      headRZ = Math.sin(t * 6) * 0.15;
      earWiggle = -0.5;
    }
    // 방망이 공격 (윗몸만 덮어쓴다 · 달리면서도)
    if (this.atkT >= 0 && this.atkT < ATK_TIME) {
      this.atkT += dt;
      const a = this.atkT;
      if (a < ATK_ON) {
        const k = a / ATK_ON;
        armRX = -2.2 - k * 1.0;
        armRZ = 0.45;
        bodyRX = Math.min(bodyRX, 0) - 0.1 * k;
      } else if (a < ATK_OFF + 0.02) {
        const k = Math.min(1, (a - ATK_ON) / (ATK_OFF + 0.02 - ATK_ON));
        armRX = -3.2 + ease(k) * 3.4;
        armRZ = 0.5 - k * 0.35;
        bodyRX += 0.25 * k;
        mouthOpen = true;
      } else {
        const k = Math.min(1, (a - ATK_OFF - 0.02) / (ATK_TIME - ATK_OFF - 0.02));
        armRX = 0.2 - k * 1.4;
        armRZ = 0.15;
      }
    }
    // 적용
    this.face += (face - this.face) * Math.min(1, dt * 12);
    this.group.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.group.rotation.y = this.face;
    R.body.position.y = bodyY;
    R.body.rotation.set(bodyRX, 0, bodyRZ);
    R.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    R.head.rotation.set(headRX, 0, headRZ);
    R.armR.rotation.set(armRX, 0, armRZ);
    R.armL.rotation.set(armLX, 0, armLZ);
    const legY = d.id === "chick" ? 0.06 : 0.08;
    R.legs.forEach((l, i) => {
      l.position.y = legY + legLift[i] + Math.max(0, bodyY) * 0.4;
      l.position.z = 0.02 + legZ[i];
    });
    for (const e of R.eyes) e.scale.y = clamp(eyeOpen, 0.08, 1.3);
    R.mouth.open.visible = mouthOpen && d.id !== "chick";
    if (d.id !== "chick") R.mouth.smile.visible = !mouthOpen;
    R.ears.forEach((e, i) => {
      if (d.id === "bunny") e.rotation.x = -0.15 + earWiggle * (i ? 1 : -1) * 0.6 + (s === "sad" || s === "defeat" ? 0.9 : 0) + (s === "run" ? 0.5 * sp : 0);
      else e.rotation.z = earWiggle * (i ? 1 : -1);
    });
    // 장식: 작은 날개는 파닥 · 망토는 달리면 펄럭
    if (R.decoWings) for (const [i, w] of R.decoWings.entries()) w.rotation.y = (i ? -1 : 1) * (0.5 + Math.sin(t * (s === "fall" || s === "jumpLoop" ? 26 : 5)) * 0.35);
    if (R.cape) R.cape.rotation.x = 0.15 + sp * 0.7 + Math.sin(t * 9) * 0.06 * (0.3 + sp);
  }
  dispose() {
    disposeModel(this.group);
  }
  finish(next) {
    const cb = this.onDone;
    this.play(next);
    if (cb) {
      this.onDone = null;
      cb();
    }
  }
}
