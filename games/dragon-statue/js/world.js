/*
 * 드래곤 석상 대작전 · 배경 세계 (지역 6곳)
 *  하늘 · 먼 산 3겹 · 풀밭 · 돌 광장 · 유적 기둥 · 나무 · 바위 · 수정 · 용암 · 얼음 · 폭포 · 떠다니는 빛 · 햇살 · 안개
 *  소품은 재질별로 한 덩어리로 구워(bake) 그리기 횟수를 줄인다. 광장 안쪽(놀이 구역)과 카메라 앞에는 아무것도 두지 않는다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { seeded, stoneTex, stoneBump, flagstoneTex, grassTex, woodTex, skyTex, ridgeTex, dotTex, waterfallTex } from "./tex.js?v=1";
import { part, bake, taperTube } from "./geo.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sph = (d = 1) => new THREE.IcosahedronGeometry(1, d);
const TAU = Math.PI * 2;

/* ================================================================
 * 지역(테마)
 * ============================================================== */
export const THEMES = {
  forest: {
    id: "forest",
    name: "햇살 숲",
    en: "SUNNY FOREST",
    stone: "#d2ccba",
    base: "#a39a86",
    cover: "#6f9a4a",
    coverAmount: 0.6,
    crystal: "#7ff0c8",
    glow: "#ffd36a",
    ground: "#a8977a",
    groundGap: "#4e5a34",
    moss: "#6f9a4a",
    grass: "#62b04e",
    sky: [
      [0, "#4aa6ee"],
      [0.42, "#9fd6f8"],
      [0.62, "#e4f5ff"],
      [1, "#fff4d8"],
    ],
    fog: "#d2ecf2",
    fogNear: 40,
    fogFar: 150,
    sun: "#fff0cc",
    sunI: 2.7,
    sunDir: [0.55, 0.85, 0.45],
    hemiSky: "#d8f0ff",
    hemiGround: "#6f8a4a",
    hemiI: 0.9,
    ridges: [
      { color: "#86b4c4", top: "#b4d6e2", peaks: 5, height: 0.85, r: 120, h: 34, seed: 3 },
      { color: "#5f9a74", top: "#86b88a", peaks: 7, height: 0.6, r: 95, h: 22, seed: 5, trees: true },
      { color: "#3f7a48", top: "#5a9452", peaks: 11, height: 0.45, r: 72, h: 12, seed: 8, trees: true },
    ],
    leaf: ["#5fae48", "#7cc04e", "#4a9a40", "#8fcf5a"],
    trunk: "#8a6040",
    rock: "#9a968a",
    flowers: ["#ffffff", "#ffd84a", "#ff8fb0", "#b48aff"],
    props: "forest",
    particles: "firefly",
    pColor: "#fff3a0",
    falls: true,
    rays: true,
    exposure: 1.02,
    music: { bpm: 100, root: 62, scale: "major", prog: "bright", lead: "marimba", drums: "soft", seed: 3 },
  },
  jungle: {
    id: "jungle",
    name: "비밀 정글",
    en: "SECRET JUNGLE",
    stone: "#c6c9b4",
    base: "#8e9480",
    cover: "#4f8a3a",
    coverAmount: 0.85,
    crystal: "#8affb0",
    glow: "#ffcf5a",
    ground: "#968f72",
    groundGap: "#34502a",
    moss: "#4f8a3a",
    grass: "#4a9a3e",
    sky: [
      [0, "#3f9ad8"],
      [0.45, "#8fd0e8"],
      [0.66, "#d8f2e8"],
      [1, "#f4f6d0"],
    ],
    fog: "#bfe0d0",
    fogNear: 30,
    fogFar: 120,
    sun: "#fff4c8",
    sunI: 2.5,
    sunDir: [-0.45, 0.85, 0.4],
    hemiSky: "#d0f0e0",
    hemiGround: "#4a6a3a",
    hemiI: 0.95,
    ridges: [
      { color: "#6aa49a", top: "#9ccabc", peaks: 4, height: 0.95, r: 120, h: 40, seed: 13, jag: 1.4 },
      { color: "#3f8a5a", top: "#5aa86a", peaks: 8, height: 0.7, r: 92, h: 24, seed: 15, trees: true },
      { color: "#2f6a3a", top: "#3f8a44", peaks: 13, height: 0.5, r: 70, h: 13, seed: 18, trees: true },
    ],
    leaf: ["#3f9a3a", "#5ab448", "#2f8a3a", "#7ac44a"],
    trunk: "#7a5a3a",
    rock: "#8a8a78",
    flowers: ["#ff5a7a", "#ffb43a", "#ff8ad8", "#ffffff"],
    props: "jungle",
    particles: "butterfly",
    pColor: "#ffe08a",
    falls: true,
    rays: true,
    exposure: 1.0,
    music: { bpm: 108, root: 60, scale: "pentatonic", prog: "island", lead: "steel", drums: "island", seed: 11 },
  },
  falls: {
    id: "falls",
    name: "폭포 계곡",
    en: "WATERFALL VALLEY",
    stone: "#c4c8b6",
    base: "#8e9686",
    cover: "#5a9a5a",
    coverAmount: 0.75,
    crystal: "#7ff0ff",
    glow: "#ffe08a",
    ground: "#8f8c78",
    groundGap: "#3a5a3a",
    moss: "#5a9a5a",
    grass: "#4fa85a",
    sky: [
      [0, "#3a9ae8"],
      [0.42, "#8ad4f4"],
      [0.66, "#dcf4f4"],
      [1, "#f4fff0"],
    ],
    fog: "#c8e8ec",
    fogNear: 34,
    fogFar: 130,
    sun: "#fff6d8",
    sunI: 2.6,
    sunDir: [0.4, 0.85, 0.45],
    hemiSky: "#d4f0ff",
    hemiGround: "#4a7060",
    hemiI: 1.0,
    ridges: [
      { color: "#7aaab8", top: "#a8cad4", peaks: 4, height: 1, r: 120, h: 46, seed: 61, jag: 1.6 },
      { color: "#4a8a6a", top: "#6aa87a", peaks: 6, height: 0.75, r: 92, h: 28, seed: 63, trees: true, jag: 1.4 },
      { color: "#2f6a4a", top: "#4a8a5a", peaks: 10, height: 0.5, r: 70, h: 14, seed: 67, trees: true },
    ],
    leaf: ["#3fa85a", "#5ac06a", "#2f8a4a", "#8ad06a"],
    trunk: "#6a5038",
    rock: "#8a8e84",
    flowers: ["#ffffff", "#ffd84a", "#8ad8ff", "#ff9ac0"],
    props: "jungle",
    particles: "sparkle",
    pColor: "#e8fbff",
    falls: true,
    rays: true,
    exposure: 1.0,
    music: { bpm: 100, root: 62, scale: "pentatonic", prog: "island", lead: "flute", drums: "soft", seed: 61 },
  },
  crystal: {
    id: "crystal",
    name: "수정 동굴",
    en: "CRYSTAL CAVE",
    stone: "#d0d2ea",
    base: "#8a8ca8",
    cover: "#9fd8ff",
    coverAmount: 0.25,
    crystal: "#7fe8ff",
    glow: "#9a8aff",
    ground: "#5e5c7a",
    groundGap: "#1e1c34",
    moss: "#5a6ab0",
    grass: "#4a4a6a",
    sky: [
      [0, "#0e0c24"],
      [0.4, "#241c4a"],
      [0.7, "#3a2f6a"],
      [1, "#5a4a8a"],
    ],
    fog: "#2a2650",
    fogNear: 26,
    fogFar: 95,
    sun: "#c8d8ff",
    sunI: 1.9,
    sunDir: [0.2, 1, 0.35],
    hemiSky: "#c0ccff",
    hemiGround: "#4a3f6a",
    hemiI: 1.3,
    ridges: [
      { color: "#1c1838", top: "#2c2654", peaks: 9, height: 1, r: 110, h: 60, seed: 21, jag: 2.2 },
      { color: "#2a2450", top: "#3c3470", peaks: 12, height: 0.75, r: 85, h: 30, seed: 23, jag: 2 },
      { color: "#3a3266", top: "#4a4282", peaks: 16, height: 0.5, r: 66, h: 14, seed: 27, jag: 1.6 },
    ],
    leaf: ["#5ac8ff", "#9a7aff", "#7fe8ff", "#c48aff"],
    trunk: "#4a4466",
    rock: "#5e5a7a",
    flowers: ["#7fe8ff", "#c48aff", "#ffffff", "#8affd8"],
    props: "crystal",
    particles: "sparkle",
    pColor: "#bfe8ff",
    falls: false,
    rays: true,
    rayColor: "#8ab8ff",
    exposure: 1.1,
    music: { bpm: 92, root: 64, scale: "minor", prog: "minor", lead: "bell", drums: "soft", pad: true, seed: 21 },
  },
  volcano: {
    id: "volcano",
    name: "불꽃 화산",
    en: "FIRE VOLCANO",
    stone: "#bcaea4",
    base: "#6e6460",
    cover: "#3a3230",
    coverAmount: 0.35,
    crystal: "#ffb04a",
    glow: "#ff7a2a",
    ground: "#5e524e",
    groundGap: "#22140f",
    moss: "#ff6a2a",
    grass: "#4a3a36",
    sky: [
      [0, "#2a1420"],
      [0.38, "#6a2a2a"],
      [0.62, "#c4562e"],
      [0.82, "#f09a4a"],
      [1, "#ffd08a"],
    ],
    fog: "#8a4a3a",
    fogNear: 40,
    fogFar: 150,
    sun: "#ffd0a0",
    sunI: 2.6,
    sunDir: [-0.5, 0.75, 0.3],
    hemiSky: "#ffc8a8",
    hemiGround: "#5a3a30",
    hemiI: 1.15,
    ridges: [
      { color: "#3a1e1e", top: "#5a2a26", peaks: 3, height: 1, r: 120, h: 52, seed: 31, jag: 1.2 },
      { color: "#2a1616", top: "#4a2420", peaks: 7, height: 0.65, r: 90, h: 24, seed: 33, jag: 1.8 },
      { color: "#1e1212", top: "#36201c", peaks: 12, height: 0.45, r: 68, h: 12, seed: 35, jag: 1.8 },
    ],
    leaf: ["#4a3a30", "#5a4636", "#3a2e26", "#6a5240"],
    trunk: "#3a2a24",
    rock: "#4a403c",
    flowers: ["#ff7a2a", "#ffb04a", "#ff4a2a", "#ffd04a"],
    props: "volcano",
    particles: "ember",
    pColor: "#ffa04a",
    falls: false,
    rays: false,
    exposure: 1.05,
    music: { bpm: 116, root: 57, scale: "minor", prog: "boss", lead: "pluck", drums: "storm", seed: 31 },
  },
  ice: {
    id: "ice",
    name: "얼음 성",
    en: "ICE CASTLE",
    stone: "#cfdae6",
    base: "#8ea0b6",
    cover: "#ffffff",
    coverAmount: 0.9,
    crystal: "#9ff0ff",
    glow: "#8ad8ff",
    ground: "#b4c4d4",
    groundGap: "#6a7c94",
    moss: "#ffffff",
    grass: "#e8f0f8",
    sky: [
      [0, "#5a9ade"],
      [0.45, "#a8d0f0"],
      [0.7, "#e4f0fa"],
      [1, "#ffffff"],
    ],
    fog: "#dceaf6",
    fogNear: 34,
    fogFar: 130,
    sun: "#f4f8ff",
    sunI: 2.5,
    sunDir: [0.4, 0.8, 0.5],
    hemiSky: "#e8f4ff",
    hemiGround: "#9ab0c8",
    hemiI: 1.0,
    ridges: [
      { color: "#9ab8d4", top: "#d8e8f6", peaks: 5, height: 0.95, r: 120, h: 40, seed: 41, snow: "#ffffff", jag: 1.2 },
      { color: "#7a9cbc", top: "#b8d0e6", peaks: 8, height: 0.65, r: 92, h: 22, seed: 43, snow: "#f4f8ff", jag: 1.4 },
      { color: "#5a7a9a", top: "#8aa6c0", peaks: 12, height: 0.45, r: 70, h: 12, seed: 47, trees: true },
    ],
    leaf: ["#3a6a5a", "#4a7a6a", "#2f5a4a", "#5a8a7a"],
    trunk: "#5a4a40",
    rock: "#9aa8b8",
    flowers: ["#bfe8ff", "#ffffff", "#9ad0ff", "#e0f4ff"],
    props: "ice",
    particles: "snow",
    pColor: "#ffffff",
    falls: false,
    rays: false,
    exposure: 1.0,
    music: { bpm: 96, root: 67, scale: "major", prog: "calm", lead: "bell", drums: "soft", pad: true, seed: 41 },
  },
  master: {
    id: "master",
    name: "드래곤 마스터 신전",
    en: "DRAGON MASTER TEMPLE",
    stone: "#ddc9a4",
    base: "#a08a68",
    cover: "#f4d27a",
    coverAmount: 0.35,
    crystal: "#ffe27a",
    glow: "#ffcf4a",
    ground: "#9a6a52",
    groundGap: "#e8c87a",
    moss: "#f4c84a",
    grass: "#7ab04a",
    sky: [
      [0, "#3a4aa8"],
      [0.35, "#8a6ac8"],
      [0.6, "#f09ab0"],
      [0.82, "#ffcf8a"],
      [1, "#fff0c0"],
    ],
    fog: "#f0c8b0",
    fogNear: 36,
    fogFar: 140,
    sun: "#ffe0b0",
    sunI: 2.6,
    sunDir: [0.3, 0.6, 0.5],
    hemiSky: "#ffd8e8",
    hemiGround: "#8a6a4a",
    hemiI: 1.0,
    ridges: [
      { color: "#8a6aa8", top: "#c8a0c8", peaks: 4, height: 0.8, r: 120, h: 30, seed: 51 },
      { color: "#6a5a8a", top: "#a888b0", peaks: 7, height: 0.55, r: 92, h: 18, seed: 53, trees: true },
      { color: "#4a5a5a", top: "#6a7a6a", peaks: 11, height: 0.4, r: 70, h: 10, seed: 57, trees: true },
    ],
    leaf: ["#6ab04a", "#8ac85a", "#f4b04a", "#ff9ab0"],
    trunk: "#7a5a3a",
    rock: "#a8987a",
    flowers: ["#ffd84a", "#ffffff", "#ff9ab0", "#ffb04a"],
    props: "master",
    particles: "gold",
    pColor: "#ffe08a",
    falls: true,
    rays: true,
    rayColor: "#ffd8a0",
    exposure: 1.02,
    music: { bpm: 104, root: 65, scale: "major", prog: "bright", lead: "bell", drums: "island", seed: 51 },
  },
};
export const THEME_ORDER = ["forest", "jungle", "crystal", "volcano", "ice", "master", "falls"];

/* ================================================================
 * 광장 크기 (놀이 구역) — 석상은 이 안에만 놓인다
 * ============================================================== */
export const PLAZA = { w: 17, d: 13, cz: -1.2 };

/* ================================================================
 * 소품 조각
 * ============================================================== */
export function pillar(g, x, z, h, r, { broken = false, rnd = Math.random, tint = 1 } = {}) {
  g.add(part(new THREE.CylinderGeometry(r * 1.35, r * 1.45, 0.3, 8), "stone", { pos: [x, 0.15, z], tint: tint * 0.85 }));
  const segs = Math.max(1, Math.round(h / 1.1));
  const sh = h / segs;
  for (let i = 0; i < segs; i++) {
    const last = i === segs - 1;
    const hh = broken && last ? sh * (0.4 + rnd() * 0.4) : sh * 0.98;
    g.add(part(new THREE.CylinderGeometry(r, r * 1.03, hh, 12), "stone", { pos: [x, 0.3 + i * sh + hh / 2, z], rot: [0, rnd() * 3, broken && last ? (rnd() - 0.5) * 0.12 : 0], tint: tint * (0.9 + rnd() * 0.15) }));
  }
  if (!broken) {
    g.add(part(new THREE.BoxGeometry(r * 2.8, 0.28, r * 2.8), "stone", { pos: [x, 0.3 + h + 0.14, z], tint: tint * 0.95 }));
    g.add(part(new THREE.CylinderGeometry(r * 1.3, r, 0.22, 12), "stone", { pos: [x, 0.3 + h - 0.06, z], tint }));
  } else {
    // 무너진 조각 하나 바닥에
    g.add(part(new THREE.CylinderGeometry(r, r, sh * 0.8, 12), "stone", { pos: [x + r * 2.4, r, z + (rnd() - 0.5) * 2], rot: [Math.PI / 2, rnd() * 3, 0.3], tint: tint * 0.85 }));
  }
}
export function rock(g, x, z, s, rnd, mat = "rock", tint = 1) {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const k = 0.82 + rnd() * 0.3;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  g.add(part(geo, mat, { pos: [x, s * 0.35, z], scale: [s * (0.9 + rnd() * 0.5), s * (0.6 + rnd() * 0.4), s * (0.9 + rnd() * 0.4)], rot: [rnd() * 0.4, rnd() * 6, rnd() * 0.3], tint }));
}
export function roundTree(g, x, z, s, rnd, T) {
  const trunkH = 2.2 * s;
  const pts = [V(0, 0, 0), V((rnd() - 0.5) * 0.4 * s, trunkH * 0.5, 0), V((rnd() - 0.5) * 0.6 * s, trunkH, (rnd() - 0.5) * 0.3)];
  const tg = taperTube(pts, (t) => (0.32 - t * 0.14) * s, 8, 8, { capStart: false });
  g.add(part(tg, "trunk", { pos: [x, 0, z] }));
  const top = pts[2];
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rnd();
    const rr = (0.9 + rnd() * 0.5) * s;
    g.add(part(sph(1), "leaf", { pos: [x + top.x + Math.cos(a) * 0.9 * s, top.y + 0.6 * s + rnd() * 0.8 * s, z + top.z + Math.sin(a) * 0.9 * s], scale: [rr, rr * 0.85, rr], tint: T.leaf[Math.floor(rnd() * T.leaf.length)] }));
  }
  g.add(part(sph(1), "leaf", { pos: [x + top.x, top.y + 1.4 * s, z + top.z], scale: [1.25 * s, 1.1 * s, 1.25 * s], tint: T.leaf[0] }));
}
export function pineTree(g, x, z, s, rnd, T, snow = false) {
  g.add(part(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 1.2 * s, 7), "trunk", { pos: [x, 0.6 * s, z] }));
  for (let i = 0; i < 4; i++) {
    const r = (1.25 - i * 0.26) * s;
    const y = (1.0 + i * 0.85) * s;
    g.add(part(new THREE.ConeGeometry(r, 1.5 * s, 9), "leaf", { pos: [x, y, z], rot: [0, rnd() * 3, 0], tint: T.leaf[i % T.leaf.length] }));
    if (snow) g.add(part(new THREE.ConeGeometry(r * 0.75, 0.5 * s, 9), "snow", { pos: [x, y + 0.42 * s, z], rot: [0, rnd() * 3, 0] }));
  }
}
export function jungleTree(g, x, z, s, rnd, T) {
  const h = (4 + rnd() * 2) * s;
  const lean = (rnd() - 0.5) * 1.6 * s;
  const pts = [V(0, 0, 0), V(lean * 0.2, h * 0.4, 0), V(lean * 0.7, h * 0.75, 0.2), V(lean, h, 0)];
  g.add(part(taperTube(pts, (t) => (0.28 - t * 0.14) * s, 12, 8, { capStart: false }), "trunk", { pos: [x, 0, z] }));
  const top = pts[3];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rnd() * 0.4;
    const lp = [V(0, 0, 0), V(Math.cos(a) * 1.2 * s, 0.35 * s, Math.sin(a) * 1.2 * s), V(Math.cos(a) * 2.3 * s, -0.5 * s, Math.sin(a) * 2.3 * s)];
    g.add(part(taperTube(lp, (t) => Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.42 * s + 0.02, 8, 6, { flat: 0.18 }), "leaf", { pos: [x + top.x, top.y, z + top.z], tint: T.leaf[i % T.leaf.length] }));
  }
  // 덩굴
  for (let i = 0; i < 2; i++) {
    const vx = x + top.x * (0.5 + rnd() * 0.4);
    const vy = top.y * (0.6 + rnd() * 0.3);
    const vp = [V(0, 0, 0), V(0.1, -vy * 0.3, 0.2), V(-0.05, -vy * 0.6, 0.25)];
    g.add(part(taperTube(vp, () => 0.045 * s, 8, 5), "leaf", { pos: [vx, vy, z + 0.25], tint: T.leaf[2] }));
  }
}
export function bush(g, x, z, s, rnd, T) {
  for (let i = 0; i < 4; i++) {
    const a = rnd() * TAU;
    const r = (0.5 + rnd() * 0.4) * s;
    g.add(part(sph(1), "leaf", { pos: [x + Math.cos(a) * 0.5 * s, r * 0.6, z + Math.sin(a) * 0.5 * s], scale: [r, r * 0.8, r], tint: T.leaf[Math.floor(rnd() * T.leaf.length)] }));
  }
}
export function flowers(g, x, z, rnd, T, n = 6) {
  for (let i = 0; i < n; i++) {
    const fx = x + (rnd() - 0.5) * 1.6;
    const fz = z + (rnd() - 0.5) * 1.6;
    g.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), "leaf", { pos: [fx, 0.15, fz], tint: T.leaf[0] }));
    g.add(part(sph(0), "flower", { pos: [fx, 0.32, fz], scale: 0.09, tint: T.flowers[Math.floor(rnd() * T.flowers.length)] }));
  }
}
export function crystalCluster(g, x, z, s, rnd, mat = "crystal") {
  const n = 4 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const h = (0.8 + rnd() * 1.8) * s;
    const r = (0.16 + rnd() * 0.16) * s;
    const geo = new THREE.CylinderGeometry(0, r, h * 0.3, 6);
    geo.translate(0, h * 0.5 + h * 0.15, 0);
    const body = new THREE.CylinderGeometry(r, r * 0.9, h, 6);
    body.translate(0, h * 0.5, 0);
    const ax = (rnd() - 0.5) * 0.9;
    const az = (rnd() - 0.5) * 0.9;
    const px = x + (rnd() - 0.5) * 0.6 * s;
    const pz = z + (rnd() - 0.5) * 0.6 * s;
    g.add(part(body, mat, { pos: [px, 0, pz], rot: [ax, rnd() * 3, az], tint: 0.85 + rnd() * 0.3 }));
    g.add(part(geo, mat, { pos: [px, 0, pz], rot: [ax, rnd() * 3, az], tint: 1.1 }));
  }
}
export function iceSpike(g, x, z, s, rnd) {
  for (let i = 0; i < 3; i++) {
    const h = (1.5 + rnd() * 2.2) * s;
    g.add(part(new THREE.ConeGeometry((0.3 + rnd() * 0.25) * s, h, 6), "ice", { pos: [x + (rnd() - 0.5) * s, h / 2, z + (rnd() - 0.5) * s], rot: [(rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.3], tint: 0.9 + rnd() * 0.2 }));
  }
}
export function tower(g, x, z, s, rnd, roofMat = "ice") {
  const h = (5 + rnd() * 3) * s;
  g.add(part(new THREE.CylinderGeometry(0.9 * s, 1.05 * s, h, 12), "stone", { pos: [x, h / 2, z], tint: 1.05 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.add(part(new THREE.BoxGeometry(0.35 * s, 0.4 * s, 0.35 * s), "stone", { pos: [x + Math.cos(a) * 0.95 * s, h + 0.2 * s, z + Math.sin(a) * 0.95 * s], rot: [0, -a, 0] }));
  }
  g.add(part(new THREE.ConeGeometry(1.15 * s, 2.6 * s, 12), roofMat, { pos: [x, h + 1.5 * s, z] }));
  // 창문
  g.add(part(new THREE.BoxGeometry(0.3 * s, 0.6 * s, 0.1), "glowwin", { pos: [x, h * 0.65, z + 1.0 * s] }));
}
export function arch(g, x, z, s, rot, rnd) {
  const ag = new THREE.Group();
  pillar(ag, -1.6 * s, 0, 3.4 * s, 0.32 * s, { rnd });
  pillar(ag, 1.6 * s, 0, 3.4 * s, 0.32 * s, { rnd });
  ag.add(part(new THREE.BoxGeometry(4.2 * s, 0.5 * s, 0.9 * s), "stone", { pos: [0, 0.3 + 3.4 * s + 0.55 * s, 0], tint: 0.95 }));
  ag.add(part(new THREE.BoxGeometry(3.4 * s, 0.25 * s, 0.7 * s), "stone", { pos: [0, 0.3 + 3.4 * s + 0.95 * s, 0], tint: 1.05 }));
  ag.position.set(x, 0, z);
  ag.rotation.y = rot;
  g.add(ag);
}
export function floatIsland(g, x, y, z, s, rnd, T) {
  g.add(part(new THREE.ConeGeometry(1.6 * s, 2.6 * s, 7), "rock", { pos: [x, y - 1.3 * s, z], rot: [Math.PI, rnd() * 3, 0] }));
  g.add(part(new THREE.CylinderGeometry(1.65 * s, 1.6 * s, 0.35 * s, 7), "leaf", { pos: [x, y, z], tint: T.leaf[0] }));
  const tg = new THREE.Group();
  roundTree(tg, 0, 0, 0.5 * s, rnd, T);
  tg.position.set(x, y + 0.15 * s, z);
  g.add(tg);
}
/** 쓰러진 석상 조각 (분위기) */
export function rubble(g, x, z, s, rnd) {
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.BoxGeometry(0.5 * s, 0.35 * s, 0.4 * s);
    g.add(part(geo, "stone", { pos: [x + (rnd() - 0.5) * 1.4 * s, 0.15 * s, z + (rnd() - 0.5) * 1.2 * s], rot: [rnd(), rnd() * 3, rnd() * 0.5], tint: 0.85 + rnd() * 0.15 }));
  }
}

/* ================================================================
 * 세계
 * ============================================================== */
export class World {
  constructor(renderer, scene, { quality = 1 } = {}) {
    this.r = renderer;
    this.scene = scene;
    this.quality = quality;
    this.theme = null;
    this.t = 0;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.themeRoot = null;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;

    // 빛
    this.hemi = new THREE.HemisphereLight("#ffffff", "#666666", 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#ffffff", 2.5);
    this.sun.castShadow = true;
    const ms = quality >= 1 ? 2048 : 1024;
    this.sun.shadow.mapSize.set(ms, ms);
    Object.assign(this.sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 80 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun);
    scene.add(this.sun.target);
    // 반대편 은은한 빛 (그늘이 너무 까맣지 않게)
    this.fill = new THREE.DirectionalLight("#ffffff", 0.35);
    scene.add(this.fill);
    // 뒤에서 비추는 테두리 빛 (석상 윤곽이 배경에서 떠오르게)
    this.rim = new THREE.DirectionalLight("#ffffff", 0.9);
    this.rim.position.set(-4, 9, -24);
    scene.add(this.rim);
  }

  /** 지역 바꾸기 (이전 지역 소품은 모두 정리) */
  setTheme(id, mode = "plaza") {
    const T = THEMES[id] || THEMES.forest;
    if (this.theme === T && this.mode === mode) return T;
    this.clearTheme();
    this.theme = T;
    this.mode = mode;
    const level = mode === "level";
    const root = new THREE.Group();
    this.themeRoot = root;
    this.root.add(root);
    // 먼 배경 묶음: 모험 길에서는 카메라를 따라다닌다 (길이 길어도 하늘 · 산을 벗어나지 않게)
    const far = new THREE.Group();
    this.far = far;
    root.add(far);
    const rnd = seeded(THEME_ORDER.indexOf(T.id) * 97 + 11);

    // 빛 · 안개 · 노출
    this.hemi.color.set(T.hemiSky);
    this.hemi.groundColor.set(T.hemiGround);
    this.hemi.intensity = T.hemiI;
    this.sun.color.set(T.sun);
    this.sun.intensity = T.sunI;
    this.sunDir = new THREE.Vector3(...T.sunDir).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(40);
    this.sun.target.position.set(0, 0, PLAZA.cz);
    this.sun.position.add(this.sun.target.position);
    this.fill.color.set(T.hemiSky);
    this.rim.color.set(T.sun);
    this.fill.position.set(-this.sunDir.x * 30, 12, -this.sunDir.z * 30 + 10);
    this.scene.fog = level ? new THREE.Fog(T.fog, T.fogNear * 0.7, T.fogFar * 0.75) : new THREE.Fog(T.fog, T.fogNear, T.fogFar);
    this.r.toneMappingExposure = T.exposure;
    const sc = this.sun.shadow.camera;
    const ext = level ? 16 : 12;
    Object.assign(sc, { left: -ext, right: ext, top: ext, bottom: -ext });
    sc.updateProjectionMatrix();

    // 하늘 (안개 안 받음)
    const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex(T), side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10;
    far.add(sky);
    // 해 · 달 원반 (동굴 제외)
    if (T.id !== "crystal") {
      const sunDisk = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: T.sun, fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
      const sd = this.sunDir.clone().setY(Math.min(0.35, this.sunDir.y * 0.4)).normalize();
      sunDisk.position.copy(sd).multiplyScalar(170);
      sunDisk.scale.setScalar(T.id === "volcano" ? 60 : 42);
      far.add(sunDisk);
    }
    // 구름 (하늘 지역)
    if (T.id !== "crystal") this.addClouds(far, T, rnd, level);

    // 먼 산 3겹 (원통 띠)
    T.ridges.forEach((R, i) => {
      const tex = ridgeTex(`${T.id}${i}`, R).clone();
      tex.needsUpdate = true;
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(2, 1);
      const geo = new THREE.CylinderGeometry(R.r, R.r, R.h, 48, 1, true);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: true }));
      m.position.y = R.h / 2 - 1.2;
      m.rotation.y = i * 1.3;
      m.renderOrder = -5 + i;
      far.add(m);
    });
    this.anim = [];
    if (level) {
      // 모험 길: 땅 · 광장 · 소품은 레벨이 직접 만든다
      this.addParticles(far, T, true);
      this.makeEnv(T);
      return T;
    }

    // 땅
    const gt = grassTex(T).clone();
    gt.needsUpdate = true;
    gt.repeat.set(36, 36);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(130, 48), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: "#ffffff" }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    root.add(ground);

    // 광장 (돌판) + 테두리 + 앞 계단
    this.addPlaza(root, T);

    // 소품
    const mats = this.propMaterials(T);
    const g = new THREE.Group();
    this.buildProps(g, T, rnd);
    const geos = bake(g, { ao: 0.5, height: 7, cover: T.cover, coverAmount: T.coverAmount * 0.6, seed: 3 });
    for (const [mat, geo] of Object.entries(geos)) {
      const m = new THREE.Mesh(geo, mats[mat] || mats.stone);
      m.castShadow = mat !== "flower" && mat !== "glowwin";
      m.receiveShadow = true;
      root.add(m);
    }
    // 특수 소품: 폭포 · 용암 · 햇살
    if (T.falls) this.addFalls(root, T);
    if (T.id === "volcano") this.addLava(root, rnd);
    if (T.rays && this.quality >= 0.75) this.addRays(root, T, rnd);
    if (T.id === "crystal" || T.id === "volcano") this.addGlowLights(root, T, rnd);

    // 떠다니는 빛
    this.addParticles(root, T);

    // 환경 반사 (금 · 수정 · 얼음이 반짝이게)
    this.makeEnv(T);
    return T;
  }

  clearTheme() {
    if (!this.themeRoot) return;
    this.root.remove(this.themeRoot);
    this.themeRoot.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          if (m.map && m.map.userData && m.map.userData.own) m.map.dispose();
          m.dispose();
        }
      }
    });
    this.themeRoot = null;
    this.particles = null;
    this.far = null;
    this.clouds = null;
    this.flames = null;
  }

  makeEnv(T) {
    const es = new THREE.Scene();
    const top = new THREE.Color(T.sky[0][1]);
    const hor = new THREE.Color(T.sky[Math.min(T.sky.length - 1, 2)][1]);
    const gr = new THREE.Color(T.hemiGround);
    const sun = new THREE.Color(T.sun);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: top }, hor: { value: hor }, gr: { value: gr }, sunC: { value: sun }, sunD: { value: this.sunDir.clone() } },
      vertexShader: "varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader:
        "uniform vec3 top, hor, gr, sunC, sunD; varying vec3 p; void main(){ vec3 d = normalize(p); float h = d.y; vec3 c = h > 0. ? mix(hor, top, smoothstep(0., .7, h)) : mix(hor, gr, smoothstep(0., .3, -h)); c += sunC * 2.5 * pow(max(0., dot(d, sunD)), 24.); gl_FragColor = vec4(c, 1.); }",
    });
    const sphere = new THREE.SphereGeometry(10, 24, 12);
    es.add(new THREE.Mesh(sphere, m));
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(es, 0.03);
    this.scene.environment = this.envRT.texture;
    // 환경광을 굽고 나면 쓸 일이 없다 (테마를 바꿀 때마다 쌓이지 않게)
    sphere.dispose();
    m.dispose();
  }

  propMaterials(T) {
    const own = (t) => {
      const c = t.clone();
      c.needsUpdate = true;
      c.userData.own = true;
      return c;
    };
    const rockMap = own(stoneTex(7));
    rockMap.repeat.set(2, 2);
    const stoneMap = own(stoneTex(8));
    stoneMap.repeat.set(1.5, 1.5);
    return {
      stone: new THREE.MeshStandardMaterial({ color: T.stone, map: stoneMap, bumpMap: stoneBump(8), bumpScale: 1.4, roughness: 0.92, vertexColors: true }),
      rock: new THREE.MeshStandardMaterial({ color: T.rock, map: rockMap, bumpMap: stoneBump(7), bumpScale: 2, roughness: 0.95, vertexColors: true }),
      leaf: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, vertexColors: true, flatShading: T.id !== "jungle" }),
      trunk: new THREE.MeshStandardMaterial({ color: T.trunk, map: woodTex(T.trunk), roughness: 0.9, vertexColors: true }),
      flower: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, vertexColors: true }),
      crystal: new THREE.MeshStandardMaterial({ color: T.crystal, emissive: T.crystal, emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.1, vertexColors: true, transparent: true, opacity: 0.9, flatShading: true }),
      crystal2: new THREE.MeshStandardMaterial({ color: "#c48aff", emissive: "#9a5aff", emissiveIntensity: 0.7, roughness: 0.1, vertexColors: true, transparent: true, opacity: 0.9, flatShading: true }),
      ice: new THREE.MeshStandardMaterial({ color: "#cfefff", roughness: 0.12, metalness: 0.05, emissive: "#4a8ac0", emissiveIntensity: 0.18, vertexColors: true, flatShading: true }),
      snow: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, vertexColors: true }),
      gold: new THREE.MeshStandardMaterial({ color: "#f0c050", metalness: 0.9, roughness: 0.3, vertexColors: true }),
      glowwin: new THREE.MeshBasicMaterial({ color: T.id === "ice" ? "#bfe8ff" : "#ffd88a" }),
      lavarock: new THREE.MeshStandardMaterial({ color: "#2a2220", map: rockMap, roughness: 0.95, emissive: "#ff4a10", emissiveIntensity: 0.08, vertexColors: true }),
    };
  }

  addPlaza(root, T) {
    const { w, d, cz } = PLAZA;
    const ft = flagstoneTex(T).clone();
    ft.needsUpdate = true;
    ft.userData.own = true;
    ft.repeat.set(w / 4.2, d / 4.2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.92, color: "#ffffff" }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, 0.16, cz);
    top.receiveShadow = true;
    root.add(top);
    // 둘레 돌 테두리 (살짝 높게) + 옆면
    const st = stoneTex(9).clone();
    st.needsUpdate = true;
    st.userData.own = true;
    st.repeat.set(6, 0.4);
    const sideM = new THREE.MeshStandardMaterial({ color: T.base, map: st, roughness: 0.95 });
    const side = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.3, d + 0.6), sideM);
    side.position.set(0, -0.02, cz);
    side.receiveShadow = true;
    root.add(side);
    const curbG = new THREE.Group();
    const segs = [
      [0, cz - d / 2, w + 0.6, 0.5],
      [-(w / 2), cz, 0.5, d],
      [w / 2, cz, 0.5, d],
    ];
    for (const [x, z, sw, sd] of segs) curbG.add(part(new THREE.BoxGeometry(sw, 0.34, sd), "base", { pos: [x, 0.25, z], tint: 0.92 }));
    // 앞쪽 계단 두 단
    curbG.add(part(new THREE.BoxGeometry(w * 0.55, 0.12, 0.7), "base", { pos: [0, 0.06, cz + d / 2 + 0.55], tint: 0.88 }));
    // 모서리 작은 등불 받침
    for (const sx of [-1, 1]) {
      curbG.add(part(new THREE.CylinderGeometry(0.35, 0.42, 0.9, 8), "base", { pos: [sx * (w / 2), 0.6, cz + d / 2], tint: 0.9 }));
      curbG.add(part(new THREE.CylinderGeometry(0.42, 0.3, 0.2, 8), "base", { pos: [sx * (w / 2), 1.15, cz + d / 2], tint: 1 }));
    }
    const geos = bake(curbG, { ao: 0.3, height: 1.4, cover: T.cover, coverAmount: T.coverAmount * 0.8, seed: 5 });
    const bm = new THREE.MeshStandardMaterial({ color: T.base, map: stoneTex(10), bumpMap: stoneBump(10), bumpScale: 1.2, roughness: 0.95, vertexColors: true });
    for (const geo of Object.values(geos)) {
      const m = new THREE.Mesh(geo, bm);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    }
    // 모서리 불꽃 (등불)
    for (const sx of [-1, 1]) {
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: T.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      fl.position.set(sx * (w / 2), 1.55, cz + d / 2);
      fl.scale.setScalar(1.1);
      root.add(fl);
      (this.flames || (this.flames = [])).push(fl);
    }
  }

  /** 광장 둘레 · 뒤쪽에 소품 (놀이 구역 · 카메라 쪽은 비운다) */
  buildProps(g, T, rnd) {
    const { w, d, cz } = PLAZA;
    const back = cz - d / 2;
    const L = -w / 2;
    const R = w / 2;
    const side = (fn, n, { x0 = 1.5, x1 = 9, z0 = back - 3, z1 = cz + d / 2 + 2 } = {}) => {
      for (let i = 0; i < n; i++) {
        const s = rnd() < 0.5 ? -1 : 1;
        const x = s * (w / 2 + x0 + rnd() * (x1 - x0));
        const z = z0 + rnd() * (z1 - z0);
        fn(x, z);
      }
    };
    const backRow = (fn, n, { z0 = back - 2, z1 = back - 12, spread = 30 } = {}) => {
      for (let i = 0; i < n; i++) {
        const x = (rnd() - 0.5) * spread * 2;
        const z = z0 + rnd() * (z1 - z0);
        fn(x, z);
      }
    };
    // 광장 뒤 유적 기둥 줄 (모든 지역 공통 — 지역마다 느낌만 다르게)
    // 석상 바로 뒤(가운데)는 비워서 석상 윤곽이 배경과 섞이지 않게 한다
    for (const x of [L + 0.7, L + 3.2, R - 3.2, R - 0.7]) {
      if ((T.id === "crystal" || T.id === "volcano") && Math.abs(x) < w / 2 - 1) continue;
      pillar(g, x, back - 1.6, 3.6 + rnd() * 1.4, 0.36, { broken: rnd() < 0.45, rnd, tint: 0.95 });
    }
    // 옆 기둥 (양쪽 2개씩)
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) pillar(g, sx * (w / 2 + 1.1), back + 2 + i * 4.2, 3.4 + rnd(), 0.34, { broken: rnd() < 0.5, rnd });
    rubble(g, L - 1.8, cz + 2, 1, rnd);
    rubble(g, R + 2.2, back + 1, 1.2, rnd);

    if (T.props === "forest") {
      arch(g, 0, back - 5.5, 1.4, 0, rnd);
      backRow((x, z) => roundTree(g, x, z, 1.2 + rnd() * 0.8, rnd, T), 22, { z0: back - 4, z1: back - 22, spread: 34 });
      side((x, z) => roundTree(g, x, z, 1 + rnd() * 0.7, rnd, T), 14, { x0: 2.2, x1: 14 });
      side((x, z) => bush(g, x, z, 1 + rnd() * 0.6, rnd, T), 12, { x0: 0.8, x1: 6 });
      side((x, z) => flowers(g, x, z, rnd, T), 10, { x0: 0.6, x1: 6, z1: cz + d / 2 + 5 });
      side((x, z) => rock(g, x, z, 0.6 + rnd() * 0.9, rnd), 8, { x0: 1, x1: 10 });
      // 버섯
      for (let i = 0; i < 6; i++) {
        const x = (rnd() < 0.5 ? -1 : 1) * (w / 2 + 1 + rnd() * 4);
        const z = back + rnd() * d;
        g.add(part(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 6), "flower", { pos: [x, 0.17, z], tint: "#fff4e0" }));
        g.add(part(new THREE.SphereGeometry(0.22, 10, 6, 0, TAU, 0, Math.PI / 2), "flower", { pos: [x, 0.33, z], tint: rnd() < 0.5 ? "#ff5a4a" : "#ffb04a" }));
      }
    } else if (T.props === "jungle") {
      arch(g, -3.5, back - 4.5, 1.6, 0.15, rnd);
      backRow((x, z) => jungleTree(g, x, z, 1 + rnd() * 0.6, rnd, T), 20, { z0: back - 3, z1: back - 20, spread: 34 });
      side((x, z) => jungleTree(g, x, z, 0.9 + rnd() * 0.5, rnd, T), 12, { x0: 2, x1: 13 });
      side((x, z) => bush(g, x, z, 1.2 + rnd() * 0.8, rnd, T), 16, { x0: 0.8, x1: 7 });
      side((x, z) => flowers(g, x, z, rnd, T, 5), 10, { x0: 0.6, x1: 6, z1: cz + d / 2 + 5 });
      side((x, z) => rock(g, x, z, 0.7 + rnd() * 1.0, rnd), 6, { x0: 1, x1: 10 });
      // 계단 신전 (뒤)
      for (let i = 0; i < 4; i++) g.add(part(new THREE.BoxGeometry(9 - i * 2, 1.2, 7 - i * 1.6), "stone", { pos: [6, 0.6 + i * 1.2, back - 14], tint: 0.92 - i * 0.03 }));
    } else if (T.props === "crystal") {
      backRow((x, z) => crystalCluster(g, x, z, 1.4 + rnd() * 1.4, rnd, rnd() < 0.5 ? "crystal" : "crystal2"), 16, { z0: back - 2, z1: back - 16, spread: 30 });
      side((x, z) => crystalCluster(g, x, z, 0.9 + rnd() * 0.9, rnd, rnd() < 0.6 ? "crystal" : "crystal2"), 14, { x0: 1, x1: 10 });
      // 종유석 기둥 (바닥에서 솟은 바위)
      backRow((x, z) => {
        const h = 4 + rnd() * 8;
        g.add(part(new THREE.ConeGeometry(0.8 + rnd() * 1.2, h, 7), "rock", { pos: [x, h / 2, z], rot: [0, rnd() * 3, (rnd() - 0.5) * 0.2] }));
      }, 14, { z0: back - 4, z1: back - 20, spread: 34 });
      side((x, z) => rock(g, x, z, 0.8 + rnd() * 1.2, rnd), 10, { x0: 1, x1: 12 });
    } else if (T.props === "volcano") {
      backRow((x, z) => rock(g, x, z, 1.4 + rnd() * 2.2, rnd, "lavarock"), 22, { z0: back - 3, z1: back - 20, spread: 34 });
      side((x, z) => rock(g, x, z, 0.8 + rnd() * 1.5, rnd, "lavarock"), 18, { x0: 1, x1: 13 });
      side((x, z) => crystalCluster(g, x, z, 0.6 + rnd() * 0.5, rnd), 6, { x0: 1, x1: 6 });
      // 마른 나무
      side((x, z) => {
        const pts = [V(0, 0, 0), V(0.3, 1.4, 0), V(-0.2, 2.6, 0.1)];
        g.add(part(taperTube(pts, (t) => 0.18 - t * 0.12, 8, 6, { capStart: false }), "trunk", { pos: [x, 0, z] }));
        g.add(part(taperTube([V(0, 0, 0), V(0.5, 0.4, 0), V(0.9, 0.5, 0.1)], (t) => 0.07 - t * 0.05, 6, 5), "trunk", { pos: [x + 0.25, 1.6, z] }));
      }, 6, { x0: 2, x1: 9 });
    } else if (T.props === "ice") {
      backRow((x, z) => pineTree(g, x, z, 1.2 + rnd() * 0.7, rnd, T, true), 18, { z0: back - 4, z1: back - 20, spread: 34 });
      side((x, z) => iceSpike(g, x, z, 0.8 + rnd() * 0.7, rnd), 12, { x0: 1, x1: 10 });
      side((x, z) => pineTree(g, x, z, 0.9 + rnd() * 0.5, rnd, T, true), 10, { x0: 3, x1: 13 });
      side((x, z) => rock(g, x, z, 0.6 + rnd() * 0.8, rnd, "snow"), 10, { x0: 0.8, x1: 8 });
      // 얼음 성 (뒤 가운데)
      const cx = 0;
      const czz = back - 13;
      tower(g, cx - 5, czz, 1.2, rnd);
      tower(g, cx + 5, czz, 1.2, rnd);
      tower(g, cx, czz - 3, 1.6, rnd);
      g.add(part(new THREE.BoxGeometry(10, 4.5, 1.6), "stone", { pos: [cx, 2.25, czz], tint: 1.05 }));
      for (let i = 0; i < 9; i++) g.add(part(new THREE.BoxGeometry(0.5, 0.6, 1.7), "stone", { pos: [cx - 4 + i, 4.8, czz] }));
    } else if (T.props === "master") {
      arch(g, 0, back - 5, 1.8, 0, rnd);
      backRow((x, z) => roundTree(g, x, z, 1 + rnd() * 0.6, rnd, T), 12, { z0: back - 6, z1: back - 20, spread: 34 });
      side((x, z) => bush(g, x, z, 1 + rnd() * 0.5, rnd, T), 10, { x0: 0.8, x1: 7 });
      side((x, z) => flowers(g, x, z, rnd, T, 6), 10, { x0: 0.6, x1: 6, z1: cz + d / 2 + 5 });
      // 황금 기둥 꼭대기 장식
      for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) g.add(part(new THREE.OctahedronGeometry(0.45, 0), "gold", { pos: [sx * (w / 2 + 1.1), 5.6, back + 2 + i * 4.2] }));
      // 떠 있는 섬
      for (let i = 0; i < 6; i++) floatIsland(g, (rnd() - 0.5) * 50, 8 + rnd() * 10, back - 10 - rnd() * 20, 0.8 + rnd() * 1.2, rnd, T);
    }
  }

  addClouds(root, T, rnd, around = false) {
    const mat = new THREE.SpriteMaterial({ map: dotTex(), color: T.id === "volcano" ? "#7a4a44" : T.id === "master" ? "#ffe0e8" : "#ffffff", transparent: true, opacity: T.id === "volcano" ? 0.5 : 0.75, depthWrite: false, fog: false });
    const n = this.quality >= 1 ? 12 : 7;
    this.clouds = [];
    for (let i = 0; i < n; i++) {
      const grp = new THREE.Group();
      const a = around ? rnd() * Math.PI * 2 : (rnd() - 0.5) * 2.4;
      const dist = 150;
      grp.position.set(Math.sin(a) * dist, 32 + rnd() * 34, -Math.cos(a) * dist);
      for (let k = 0; k < 5; k++) {
        const s = new THREE.Sprite(mat);
        s.position.set((k - 2) * 7 + rnd() * 4, rnd() * 4, 0);
        s.scale.set(18 + rnd() * 10, 10 + rnd() * 5, 1);
        grp.add(s);
      }
      root.add(grp);
      this.clouds.push(grp);
    }
  }

  addFalls(root, T) {
    const { w, d, cz } = PLAZA;
    // 절벽 + 물줄기 (왼쪽 뒤)
    const x = -w / 2 - 9;
    const z = cz - d / 2 - 6;
    const cliff = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.DodecahedronGeometry(1, 1);
      cliff.add(part(geo, "rock", { pos: [x + (i % 2 ? -2.6 : 2.6) + (i - 3) * 0.3, 1 + i * 1.4, z - 1 - (i % 3) * 0.4], scale: [2.6, 1.6, 1.8], rot: [0.2 * i, i, 0] }));
    }
    const geos = bake(cliff, { ao: 0.4, height: 10, cover: T.cover, coverAmount: T.coverAmount, seed: 9 });
    const cm = new THREE.MeshStandardMaterial({ color: T.rock, map: stoneTex(7), roughness: 0.95, vertexColors: true });
    for (const geo of Object.values(geos)) {
      const m = new THREE.Mesh(geo, cm);
      m.castShadow = true;
      root.add(m);
    }
    const ft = waterfallTex().clone();
    ft.needsUpdate = true;
    ft.userData.own = true;
    ft.wrapT = THREE.RepeatWrapping;
    ft.repeat.set(1, 2);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 10.5), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false, color: "#e8fbff" }));
    fall.position.set(x, 5.2, z + 0.4);
    root.add(fall);
    // 물웅덩이 + 물보라
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshStandardMaterial({ color: "#5ac0e8", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.05, z + 2);
    root.add(pool);
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false }));
    mist.position.set(x, 0.8, z + 1);
    mist.scale.set(5, 2.2, 1);
    root.add(mist);
    this.anim.push((dt) => {
      ft.offset.y += dt * 1.4;
      mist.material.opacity = 0.45 + Math.sin(this.t * 5) * 0.1;
    });
  }

  addLava(root, rnd) {
    const { w, d, cz } = PLAZA;
    // 가장자리는 식은 검은 껍질, 가운데와 금 사이로 용암이 빛난다
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    x.fillStyle = "#000";
    x.fillRect(0, 0, 256, 256);
    const gr = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, "rgba(255,210,90,1)");
    gr.addColorStop(0.35, "rgba(255,120,30,0.95)");
    gr.addColorStop(0.62, "rgba(150,40,10,0.5)");
    gr.addColorStop(0.8, "rgba(0,0,0,0)");
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = "rgba(255,150,40,0.95)";
    x.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      let px = 128 + (rnd() - 0.5) * 120;
      let py = 128 + (rnd() - 0.5) * 120;
      let a = rnd() * 6.28;
      x.lineWidth = 1.5 + rnd() * 3;
      x.beginPath();
      x.moveTo(px, py);
      for (let k = 0; k < 6; k++) {
        a += (rnd() - 0.5) * 1.2;
        px += Math.cos(a) * 12;
        py += Math.sin(a) * 12;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    const glow = new THREE.CanvasTexture(c);
    glow.colorSpace = THREE.SRGBColorSpace;
    glow.userData.own = true;
    const mat = new THREE.MeshStandardMaterial({ color: "#2a1712", roughness: 0.85, emissive: "#ffffff", emissiveMap: glow, emissiveIntensity: 1 });
    const pools = [
      [-w / 2 - 5, cz - 2, 3.2],
      [w / 2 + 6, cz - 4, 2.6],
      [-6, cz - d / 2 - 7, 3.6],
      [8, cz - d / 2 - 9, 4],
    ];
    const rimM = new THREE.MeshStandardMaterial({ color: "#3a2a24", roughness: 0.95, flatShading: true });
    for (const [px, pz, r] of pools) {
      const geo = new THREE.CircleGeometry(r, 28);
      const pa = geo.getAttribute("position");
      for (let i = 1; i < pa.count; i++) {
        const k = 0.82 + rnd() * 0.3;
        pa.setXY(i, pa.getX(i) * k, pa.getY(i) * k);
      }
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(px, 0.05, pz);
      root.add(m);
      // 둘레 바위
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rnd() * 0.3;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + rnd() * 0.35, 0), rimM);
        rock.position.set(px + Math.cos(a) * r * 1.02, 0.12, pz + Math.sin(a) * r * 1.02);
        rock.rotation.set(rnd() * 3, rnd() * 3, 0);
        rock.scale.y = 0.6;
        root.add(rock);
      }
    }
    this.anim.push(() => (mat.emissiveIntensity = 0.95 + Math.sin(this.t * 2.2) * 0.15));
  }

  /** 하늘에서 비스듬히 내려오는 햇살 띠 */
  addRays(root, T, rnd) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.3, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 256);
    const hg = x.createLinearGradient(0, 0, 64, 0);
    hg.addColorStop(0, "rgba(0,0,0,1)");
    hg.addColorStop(0.5, "rgba(0,0,0,0)");
    hg.addColorStop(1, "rgba(0,0,0,1)");
    x.globalCompositeOperation = "destination-out";
    x.fillStyle = hg;
    x.fillRect(0, 0, 64, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.userData.own = true;
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: T.rayColor || T.sun, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const { cz, d } = PLAZA;
    this.rays = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4 + rnd() * 2.5, 26), mat);
      m.position.set(-10 + i * 5 + rnd() * 2, 9, cz - d / 2 - 3 - rnd() * 4);
      m.rotation.z = -0.42 * Math.sign(this.sunDir.x || 1);
      m.rotation.y = (rnd() - 0.5) * 0.4;
      root.add(m);
      this.rays.push(m);
    }
    this.anim.push(() => (mat.opacity = 0.18 + Math.sin(this.t * 0.7) * 0.05));
  }

  addGlowLights(root, T, rnd) {
    const { w, cz, d } = PLAZA;
    const pl = [];
    const spots = [
      [-w / 2 - 2, 1.6, cz - 2],
      [w / 2 + 2, 1.6, cz - 1],
      [0, 3, cz - d / 2 - 3],
    ];
    for (const [x, y, z] of spots) {
      const L = new THREE.PointLight(T.id === "volcano" ? "#ff6a2a" : T.crystal, 18, 16, 1.6);
      L.position.set(x, y, z);
      root.add(L);
      pl.push(L);
    }
    this.anim.push(() => pl.forEach((L, i) => (L.intensity = 16 + Math.sin(this.t * 2 + i * 2) * 4)));
  }

  addParticles(root, T, around = false) {
    const n = Math.round((T.particles === "snow" ? 220 : 90) * (this.quality >= 1 ? 1 : 0.55));
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const { w, d, cz } = PLAZA;
    for (let i = 0; i < n; i++) {
      if (around) {
        pos[i * 3] = (Math.random() - 0.5) * 44;
        pos[i * 3 + 1] = Math.random() * 10 - 2;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 44;
      } else {
        pos[i * 3] = (Math.random() - 0.5) * (w + 16);
        pos[i * 3 + 1] = Math.random() * 9;
        pos[i * 3 + 2] = cz + d / 2 + 2 - Math.random() * (d + 16);
      }
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const size = { firefly: 0.16, butterfly: 0.14, sparkle: 0.16, ember: 0.14, snow: 0.13, gold: 0.14 }[T.particles] || 0.15;
    const mat = new THREE.PointsMaterial({ map: dotTex(), color: T.pColor, size, transparent: true, depthWrite: false, blending: T.particles === "snow" ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: 0.9, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    root.add(pts);
    this.particles = { pts, pos, seed, n, kind: T.particles, top: around ? 8 : 9, bottom: around ? -2 : 0 };
  }

  update(dt, focus = null) {
    this.t += dt;
    const t = this.t;
    if (focus && this.mode === "level") {
      if (this.far) this.far.position.set(focus.x, focus.y, focus.z);
      this.sun.target.position.copy(focus);
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 40);
      this.fill.position.set(focus.x - this.sunDir.x * 30, focus.y + 12, focus.z - this.sunDir.z * 30);
      this.rim.position.set(focus.x - 4, focus.y + 9, focus.z - 24);
    }
    if (this.anim) for (const f of this.anim) f(dt);
    if (this.flames) for (const [i, f] of this.flames.entries()) f.scale.setScalar(1.0 + Math.sin(t * 9 + i * 2) * 0.12 + Math.sin(t * 23 + i) * 0.06);
    if (this.clouds)
      for (const [i, c] of this.clouds.entries()) {
        c.position.x += dt * (0.4 + (i % 3) * 0.2);
        if (c.position.x > 190) c.position.x -= 380;
      }
    const P = this.particles;
    if (P) {
      const { pos, seed, n, kind } = P;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        const s = seed[i];
        if (kind === "snow") {
          pos[k + 1] -= dt * (0.8 + (s % 1) * 0.6);
          pos[k] += Math.sin(t * 0.8 + s) * dt * 0.4;
          if (pos[k + 1] < 0) pos[k + 1] = 9;
        } else if (kind === "ember") {
          pos[k + 1] += dt * (0.8 + (s % 1) * 1.2);
          pos[k] += Math.sin(t * 1.5 + s) * dt * 0.5;
          if (pos[k + 1] > 9) pos[k + 1] = 0;
        } else {
          // 반딧불 · 나비 · 반짝이 · 금가루: 천천히 떠다닌다
          pos[k] += Math.sin(t * 0.6 + s) * dt * 0.35;
          pos[k + 1] += Math.cos(t * 0.8 + s * 1.3) * dt * 0.25;
          pos[k + 2] += Math.sin(t * 0.5 + s * 0.7) * dt * 0.3;
          if (pos[k + 1] < 0.2) pos[k + 1] = 0.2;
          if (pos[k + 1] > 9) pos[k + 1] = 9;
        }
      }
      P.pts.geometry.attributes.position.needsUpdate = true;
      P.pts.material.opacity = kind === "snow" ? 0.85 : 0.5 + Math.sin(t * 3) * 0.25;
    }
  }

  dispose() {
    this.clearTheme();
    if (this.envRT) this.envRT.dispose();
    this.pmrem.dispose();
  }
}
