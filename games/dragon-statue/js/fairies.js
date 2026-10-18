/*
 * 드래곤 석상 대작전 · 꼬마 드래곤 요정 6마리 (모으기)
 *  석상을 깨면 그 지역 요정이 '퐁' 나와서 날아간다. 조건을 채우면 도감에 친구로 들어온다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { slab } from "./geo.js?v=1";

export const FAIRIES = [
  { id: "forest", name: "숲 드래곤", color: "#7fd65a", belly: "#e8ffc8", wing: "#b8f08a", accent: "#4aa83a", item: "leaf", how: "햇살 숲(1~3단계)을 모두 통과하면", theme: "forest" },
  { id: "sea", name: "바다 드래곤", color: "#4ab8ff", belly: "#d8f4ff", wing: "#8ad8ff", accent: "#2a7ad8", item: "fin", how: "비밀 정글 보스(7단계)를 물리치면", theme: "jungle" },
  { id: "star", name: "별빛 드래곤", color: "#8a7aff", belly: "#e8e0ff", wing: "#c8b8ff", accent: "#ffe27a", item: "star", how: "수정 동굴 보스(12단계)를 물리치면", theme: "crystal" },
  { id: "fire", name: "불꽃 드래곤", color: "#ff7a3a", belly: "#ffe0b0", wing: "#ffb07a", accent: "#ffd23f", item: "flame", how: "불꽃 화산 보스(17단계)를 물리치면", theme: "volcano" },
  { id: "ice", name: "얼음 드래곤", color: "#9ae8ff", belly: "#ffffff", wing: "#d8f6ff", accent: "#4ab8e8", item: "ice", how: "얼음 성 보스(24단계)를 물리치면", theme: "ice" },
  { id: "gold", name: "황금 드래곤", color: "#ffcf3a", belly: "#fff4c0", wing: "#ffe68a", accent: "#ff9a2a", item: "crown", how: "마지막 보스(30단계)를 물리치면", theme: "master" },
];
export const FAIRY_BY_ID = Object.fromEntries(FAIRIES.map((f) => [f.id, f]));
export const FAIRY_OF_THEME = Object.fromEntries(FAIRIES.map((f) => [f.theme, f.id]));

const sph = (n = 20) => new THREE.SphereGeometry(1, n, Math.round(n * 0.75));
const mats = new Map();
function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.45, ...o }));
  return mats.get(k);
}
function m(geo, mt, pos, scale = 1, rot = [0, 0, 0]) {
  const o = new THREE.Mesh(geo, mt);
  o.position.set(...pos);
  if (typeof scale === "number") o.scale.setScalar(scale);
  else o.scale.set(...scale);
  o.rotation.set(...rot);
  return o;
}

/** 요정 모델 (머리 큰 아기 드래곤 · 날개 파닥) — 높이 약 0.6 */
const templates = new Map();
/** 요정 하나 (같은 종류는 모양을 같이 쓰는 복제본) */
export function makeFairy(id) {
  if (!templates.has(id)) templates.set(id, buildFairy(id));
  const g = templates.get(id).clone();
  const body = g.getObjectByName("body");
  g.userData = { wings: [g.getObjectByName("wing0"), g.getObjectByName("wing1")], body, head: g.getObjectByName("head"), tail: g.getObjectByName("tail"), def: templates.get(id).userData.def };
  return g;
}
function buildFairy(id) {
  const F = FAIRY_BY_ID[id] || FAIRIES[0];
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = "body";
  g.add(body);
  const C = mat(F.color, { emissive: F.color, emissiveIntensity: 0.12 });
  const B = mat(F.belly);
  const A = mat(F.accent, { emissive: F.accent, emissiveIntensity: 0.2 });
  body.add(m(sph(), C, [0, 0, 0], [0.17, 0.19, 0.16]));
  body.add(m(sph(), B, [0, -0.02, 0.08], [0.11, 0.14, 0.09]));
  // 머리
  const head = new THREE.Group();
  head.name = "head";
  head.position.set(0, 0.24, 0.03);
  head.add(m(sph(24), C, [0, 0, 0], [0.2, 0.18, 0.19]));
  head.add(m(sph(), C, [0, -0.05, 0.15], [0.11, 0.08, 0.09]));
  for (const s of [-1, 1]) {
    head.add(m(sph(12), mat("#1a1420", { roughness: 0.1 }), [s * 0.085, 0.02, 0.16], [0.045, 0.055, 0.03]));
    head.add(m(sph(8), mat("#ffffff", { emissive: "#ffffff", emissiveIntensity: 1 }), [s * 0.085 - 0.015, 0.04, 0.185], 0.016));
    head.add(m(sph(10), mat("#ff9ab8", { transparent: true, opacity: 0.6 }), [s * 0.13, -0.05, 0.13], [0.035, 0.022, 0.01]));
    // 작은 뿔
    head.add(m(new THREE.ConeGeometry(0.03, 0.1, 8), A, [s * 0.08, 0.17, -0.03], 1, [-0.3, 0, -s * 0.3]));
  }
  body.add(head);
  // 날개 (반짝이는 반투명)
  const wingS = new THREE.Shape();
  wingS.moveTo(0, 0);
  wingS.quadraticCurveTo(0.12, 0.2, 0.3, 0.18);
  wingS.quadraticCurveTo(0.24, 0.08, 0.28, 0.02);
  wingS.quadraticCurveTo(0.18, 0.0, 0.2, -0.08);
  wingS.quadraticCurveTo(0.1, -0.02, 0, 0);
  const wingGeo = slab(wingS, 0.01, 0.004);
  const W = mat(F.wing, { transparent: true, opacity: 0.85, emissive: F.wing, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.name = "wing" + wings.length;
    w.position.set(s * 0.08, 0.08, -0.08);
    const wm = m(wingGeo, W, [0, 0, 0], [s, 1, 1]);
    w.add(wm);
    body.add(w);
    wings.push(w);
  }
  // 꼬리 + 끝 장식
  const tail = new THREE.Group();
  tail.name = "tail";
  tail.position.set(0, -0.12, -0.12);
  tail.add(m(new THREE.ConeGeometry(0.06, 0.22, 10), C, [0, -0.02, -0.08], 1, [-2.1, 0, 0]));
  body.add(tail);
  // 장식
  if (F.item === "leaf") head.add(m(slab(leafShape(), 0.01, 0.004), mat("#4aa83a"), [0.02, 0.18, 0], 1, [0, 0, -0.4]));
  if (F.item === "fin") head.add(m(new THREE.ConeGeometry(0.05, 0.14, 3), A, [0, 0.19, -0.04], [1, 1, 0.4], [-0.3, 0, 0]));
  if (F.item === "star") tail.add(m(slab(starShape(0.07, 0.03), 0.02, 0.006), mat("#ffe27a", { emissive: "#ffd23f", emissiveIntensity: 0.9 }), [0, -0.12, -0.15], 1, [0, 0, 0]));
  if (F.item === "flame") tail.add(m(new THREE.ConeGeometry(0.05, 0.12, 8), mat("#ffd23f", { emissive: "#ff8a2a", emissiveIntensity: 1.2 }), [0, -0.1, -0.16], 1, [-2.1, 0, 0]));
  if (F.item === "ice") for (const s of [-1, 0, 1]) head.add(m(new THREE.OctahedronGeometry(0.035, 0), mat("#ffffff", { emissive: "#9ae8ff", emissiveIntensity: 0.8 }), [s * 0.06, 0.19 + (s ? 0 : 0.03), -0.02], [0.8, 1.4, 0.8]));
  if (F.item === "crown") {
    const cr = new THREE.CylinderGeometry(0.07, 0.08, 0.06, 5, 1, true);
    head.add(m(cr, mat("#ffd23f", { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }), [0, 0.19, 0]));
  }
  // 복제할 때 userData 는 JSON 으로 복사되므로 단순한 값만 둔다 (부위는 이름으로 찾는다)
  g.userData = { def: F };
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}
function leafShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.06, 0.05, 0, 0.13);
  s.quadraticCurveTo(-0.06, 0.05, 0, 0);
  return s;
}
function starShape(r1, r2) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/** 날갯짓 · 둥실 (매 프레임) */
export function animateFairy(g, t, speed = 1) {
  const u = g.userData;
  const f = Math.sin(t * 22 * speed);
  u.wings[0].rotation.set(0, -0.3 - f * 0.7, 0.2);
  u.wings[1].rotation.set(0, 0.3 + f * 0.7, -0.2);
  u.body.position.y = Math.sin(t * 4) * 0.04;
  u.head.rotation.z = Math.sin(t * 2.3) * 0.12;
  u.tail.rotation.x = Math.sin(t * 5) * 0.25;
}
