/*
 * 하늘섬 대탈출 · 스테이지 목록과 코스 짓기
 *  1 구름 마을 · 2 바람 협곡 · 3 공중 항구 · 4 수정 구름 동굴 · 5 폭풍의 하늘성 · 6 고대 용의 성(최종 보스)
 *  스테이지마다 다른 땅 모양 · 배경 · 빛 · 장애물 조합을 쓴다 (테마는 world.js THEMES).
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { islandGeo, roundedBox, part, shadeVerts, bake, taperTube } from "./geo.js?v=1";
import { dotTex, seeded, lavaTex } from "./tex.js?v=1";
import { mushroomHouse, Flag, Airship } from "./world.js?v=1";
import { Turntable, Windmill, Conveyor, Swing, Cannon, Drawbridge, PhasePad, Dropper, Beam, Lightning, Spikes, WindZone } from "./mechs.js?v=1";
import { MechaDragon, EnergyGate } from "./boss.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/* ================================================================
 * 1. 구름 마을 — 노을 · 버섯 집 마을 · 기본 장애물 모두 + 무너지는 섬 탈출
 * ============================================================== */
function stage1(c) {
  const M = c.M;
    const path = [
      [0, 0, 5.2],
      [0, 0, -10],
      [0, 0, -22],
      [0.8, 0.4, -31],
      [-0.6, 0.8, -37],
      [0, 0.8, -44],
      [1.3, 1.1, -49.8],
      [-1.0, 1.4, -53.6],
      [1.2, 1.7, -57.3],
      [-0.6, 2.0, -61],
      [0, 2, -67],
      [0, 2, -85],
      [0, 2, -97.6],
      [0, 2, -121],
      [0, 3, -137],
      [-1.2, 3.4, -144],
      [1.2, 3.8, -148],
      [-1.1, 4.2, -152],
      [0, 4.2, -158],
      [0, 4.2, -163],
      [0, 9.4, -168.6],
      [0, 9.4, -186.4],
      [0, 10.2, -203.6],
      [0, 10.2, -225.4],
      [1.0, 10.6, -232.8],
      [-1.0, 11.0, -236.6],
      [0.9, 11.4, -240.4],
      [-0.4, 11.8, -244.2],
      [0, 11.8, -250.2],
      [0, 15, -259.4],
      [0, 15, -302],
      [0.8, 15, -305.6],
      [-0.8, 15.3, -309.6],
      [0.6, 15.6, -313.6],
      [0, 15.8, -319.4],
      [0, 12.2, -340],
    ];
    c.setPath(path, { p: V(0, 0, 5.2), yaw: Math.PI });

    /* ---------- 1. 구름 마을 (안전한 출발지) ---------- */
    const village = c.island(0, 0, 0, 11, { deco: "meadow", depth: 15, seed: 3, falls: 1, flowers: 0.6 }).g;
    c.village = village;
    const houses = [
      [-6.7, -1.6, Math.PI / 2, 1.0, 1],
      [6.9, 1.4, -Math.PI / 2, 0.95, 2],
      [-5.6, 6.2, Math.PI * 0.8, 0.8, 3],
      [5.6, -6.4, -Math.PI * 0.3, 0.7, 4],
    ];
    for (const [x, z, ry, s, seed] of houses) {
      const h = mushroomHouse(M, s, seed);
      h.position.set(x, 0, z);
      h.rotation.y = ry;
      village.add(h);
      c.disc(x, z, 1.35 * s, 3.9 * s, { noCam: true });
      c.solids[c.solids.length - 1].y0 = 0;
    }
    for (const [x, z, h] of [
      [8.4, -3.6, 3.8],
      [-8.8, 2.4, 4.2],
      [3.4, 8.6, 3.2],
    ])
      c.tree(village, x, z, h, Math.round(x * 3));
    // 길가 등불 · 깃발 · 표지판
    const lamp = (x, z) => {
      const d = new THREE.Group();
      d.add(part(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 8), "woodDark", { pos: [x, 0.8, z] }));
      d.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), "woodDark", { pos: [x + 0.2, 1.55, z], rot: [0, 0, Math.PI / 2] }));
      c.bakeInto(d, village);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), M.lantern);
      l.position.set(x + 0.42, 1.38, z);
      village.add(l);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffcf7a", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.copy(l.position);
      glow.scale.setScalar(1.3);
      village.add(glow);
      c.box(x - 0.1, x + 0.1, 0, 1.6, z - 0.1, z + 0.1, { noCam: true });
    };
    lamp(-2.3, 1.5);
    lamp(2.3, -3.5);
    lamp(-2.3, -7.5);
    for (const s of [-1, 1]) {
      const f = new Flag(s > 0 ? "#ff7a6a" : "#ffb84a", 1.1, 0.7, 3.2);
      f.group.position.set(s * 1.9, 0, -10.2);
      f.group.rotation.y = s > 0 ? Math.PI : 0;
      f.group.userData.keep = true;
      village.add(f.group);
      c.flags.push(f);
      c.box(s * 1.9 - 0.07, s * 1.9 + 0.07, 0, 3.2, -10.27, -10.13, { noCam: true });
    }
    {
      const d = new THREE.Group();
      d.add(part(new THREE.CylinderGeometry(0.07, 0.08, 1.4, 8), "woodDark", { pos: [2.6, 0.7, -8.4] }));
      d.add(part(roundedBox(1.2, 0.36, 0.08, 0.04), "wood", { pos: [2.85, 1.25, -8.4], rot: [0, -0.3, 0] }));
      d.add(part(new THREE.ConeGeometry(0.2, 0.3, 3), "wood", { pos: [3.45, 1.25, -8.6], rot: [0, -0.3, -Math.PI / 2] }));
      c.bakeInto(d, village);
      c.box(2.5, 2.7, 0, 1.4, -8.5, -8.3, { noCam: true });
    }
    // 마을 연못 (빛나는 물) + 디딤돌
    {
      const pond = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshStandardMaterial({ color: "#7ad8ff", emissive: "#3ab0e0", emissiveIntensity: 0.3, roughness: 0.08, metalness: 0.1 }));
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(5.0, 0.02, 4.8);
      village.add(pond);
      const d = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        d.add(part(new THREE.DodecahedronGeometry(0.28, 0), "stone", { pos: [5 + Math.cos(a) * 1.7, 0.1, 4.8 + Math.sin(a) * 1.7], scale: [1, 0.6, 1] }));
      }
      c.bakeInto(d, village);
    }
    // 마을 밖 장식 섬 (옆) — 배경을 깊어 보이게
    c.island(-17, -3, -6, 4.2, { deco: "mushroom", seed: 41, falls: 1, path: false, trees: [[0, -1, 2.8]] });
    c.island(18, -2, 6, 3.6, { deco: "crystal", seed: 42, path: false, trees: [[1, 1, 3]] });
    c.ropeBridge(0, 0, -10.75, -17.7, 2.4);

    /* ---------- 2. 기본 이동 · 점프 ---------- */
    c.island(0, 0, -22.4, 4.8, { seed: 5, flowers: 0.8, trees: [[-3.4, -0.6, 2.8]] });
    c.log(0, 0, -22.6, 7.2);
    c.orbLine(V(0, 0.9, -19), V(0, 0.9, -21.4), 3);
    c.orbArc(V(0, 0.6, -22.0), V(0, 0.6, -23.6), 1.2, 2);
    c.island(0.9, 0.4, -31.1, 2.1, { seed: 6, deco: "none" });
    c.island(-0.7, 0.8, -36.9, 2.2, { seed: 7, deco: "none" });
    c.island(0, 0.8, -43.6, 3.4, { seed: 8, deco: "crystal" });
    c.orbArc(V(0.3, 1.0, -27.6), V(0.9, 1.3, -30.0), 1.4, 3);
    c.orbArc(V(0.6, 1.6, -33.5), V(-0.5, 1.8, -35.2), 1.3, 2);
    c.orbLine(V(0, 1.7, -41.4), V(0, 1.7, -45.4), 3);

    /* ---------- 3. 작은 발판 ---------- */
    const stones = [
      [1.5, 1.1, -49.7],
      [-1.1, 1.4, -53.5],
      [1.3, 1.7, -57.2],
      [-0.7, 2.0, -61.0],
    ];
    stones.forEach(([x, y, z], i) => {
      c.stone(x, y, z, 1.2, 20 + i);
      c.orb(x, y + 1.7, z);
    });
    c.island(0, 2.0, -67.0, 3.8, { seed: 9, deco: "mushroom", falls: 1 });
    c.checkpoint(0, 2.0, -67.0, -1, "작은 발판 통과");

    /* ---------- 4. 움직이는 발판 ---------- */
    c.mover(V(0, 2.0, -73.6), V(0, 2.0, -79.4), 1.7, 4.6, 0);
    c.orbLine(V(0, 3.0, -73.4), V(0, 3.0, -79.6), 3);
    c.island(0, 2.0, -85.0, 3.0, { seed: 10, deco: "crystal" });
    c.pass(-84, "움직이는 발판");
    c.mover(V(-2.4, 2.0, -91.3), V(2.4, 2.0, -91.3), 1.7, 6.0, 0.25);
    c.orb(0, 3.4, -91.3);
    c.island(0, 2.0, -97.6, 3.5, { seed: 11, deco: "meadow", trees: [[2.6, -0.4, 2.8]] });
    c.pass(-96.5, "옆으로 가는 발판");

    /* ---------- 5. 무너지는 돌다리 ---------- */
    for (let i = 0; i < 8; i++) {
      const z = -101.1 - 0.875 - i * 1.83;
      c.crumble(0, 2.0, z);
      if (i % 2 === 0) c.orb(0, 2.9, z);
    }
    c.island(0, 2.0, -121.2, 5.4, { seed: 12, deco: "mushroom", flowers: 1, trees: [[-3.6, 1.2, 3.2]] });
    c.checkpoint(0, 2.0, -119.4, 1, "돌다리 통과");
    c.pass(-117.5, "무너지는 돌다리");

    /* ---------- 6. 에너지 구슬 (점프대 · 떠 있는 구슬) ---------- */
    c.pad(0, 2.0, -124.8, V(0, 14.5, -9.6), 1.0);
    c.orbArc(V(0, 3.4, -126.0), V(0, 3.6, -133.6), 4.6, 6);
    c.island(0, 3.0, -136.6, 4.0, { seed: 13, deco: "crystal", falls: 1 });
    const os = [
      [-1.3, 3.4, -143.9],
      [1.3, 3.8, -147.9],
      [-1.2, 4.2, -151.9],
    ];
    os.forEach(([x, y, z], i) => {
      c.stone(x, y, z, 1.25, 30 + i);
      c.orb(x, y + 1.0, z);
      c.orb(x, y + 1.9, z);
      if (i === 1) c.orb(x, y + 2.9, z, true);
    });
    c.island(0, 4.2, -158.0, 3.6, { seed: 14, deco: "meadow" });

    /* ---------- 7. 바람 (상승기류 · 옆바람 다리 · 바람 고리) ---------- */
    // 바람 돌 위에서 뛰면 위로 휭 → 앞으로 밀면 높은 섬 위로 (앞을 계속 눌러도 기둥 안에 머문다)
    c.stone(0, 4.2, -163.0, 1.5, 61);
    c.vent(0, 4.2, -163.0, 2.05, 12.4, 52);
    c.orbLine(V(0, 6.2, -163.0), V(0, 10.4, -163.0), 4);
    c.island(0, 9.4, -168.6, 3.6, { seed: 15, deco: "crystal", falls: 1 });
    c.checkpoint(0, 9.4, -168.0, -1, "바람 기둥 통과");
    c.plankBridge(0, 9.4, -172.15, -182.65, 2.0);
    c.fan(-6.2, 8.1, -177.4, V(1, 0, 0), { x0: -1.4, x1: 4.5, z0: -182.6, z1: -172.2, y0: 8.3, y1: 13 }, { strength: 3.1, on: 1.8, off: 1.8, warn: 0.75 });
    c.orbLine(V(0, 10.3, -173.5), V(0, 10.3, -181.5), 4);
    c.island(0, 9.4, -186.4, 3.8, { seed: 16, deco: "mushroom" });
    c.pass(-185, "옆바람 다리");
    c.boostRing(0, 10.7, -191.6, V(0, 7.2, -15.5), 1.4);
    c.orbArc(V(0, 11.3, -193.5), V(0, 10.6, -200.0), 1.4, 5);
    c.island(0, 10.2, -203.6, 4.2, { seed: 17, deco: "crystal", trees: [[3, 1, 3]] });
    c.checkpoint(0, 10.2, -203.0, 1, "바람 고리 통과");
    c.pass(-202, "바람 고리");

    /* ---------- 8. 연속 장애물 (회전 기둥 · 구름 발판 · 점프대) ---------- */
    c.plankBridge(0, 10.2, -207.75, -221.85, 1.5);
    c.sweeper(1.95, 10.2, -212.4, 2.9, 1.75, 0.5, 0);
    c.sweeper(-1.95, 10.2, -217.6, 2.9, -1.95, 0.5, 1.6);
    c.orbLine(V(0, 11.0, -209), V(0, 11.0, -220.5), 6);
    c.island(0, 10.2, -225.4, 3.6, { seed: 18, deco: "meadow" });
    c.pass(-224, "회전 나무 기둥");
    const cl = [
      [1.0, 10.6, -232.8],
      [-1.0, 11.0, -236.6],
      [0.9, 11.4, -240.4],
      [-0.4, 11.8, -244.2],
    ];
    cl.forEach(([x, y, z]) => {
      c.cloudPad(x, y, z, 1.45);
      c.orb(x, y + 1.2, z);
    });
    c.island(0, 11.8, -250.2, 3.4, { seed: 19, deco: "crystal" });
    c.pass(-249, "구름 발판");
    c.pad(0, 11.8, -252.0, V(0, 15.6, -7.6), 1.0);
    c.orbArc(V(0, 13.2, -252.6), V(0, 15.8, -256.5), 2.5, 4);
    c.island(0, 15.0, -259.4, 3.8, { seed: 20, deco: "mushroom", falls: 1 });
    c.checkpoint(0, 15.0, -259.4, -1, "섬 끝이 보여요!");

    /* ---------- 9. 무너지는 하늘섬 ---------- */
    c.buildCollapse(15.0, -263.3, 24);
    c.debris = [];
    const dbs = [
      [0.8, 15.0, -305.6],
      [-0.8, 15.3, -309.6],
      [0.6, 15.6, -313.6],
    ];
    for (const [x, y, z] of dbs) {
      const isl = c.island(x, y, z, 1.5, { seed: Math.round(-z), deco: "none", flowers: 0.2, depth: 2.4, merge: false });
      c.debris.push({ g: isl.g, solid: isl.solid, home: V(x, y, z), sink: 0, v: 0 });
      c.orb(x, y + 1.3, z);
    }
    {
      const isl = c.island(0, 15.8, -319.4, 2.6, { seed: 77, deco: "none", flowers: 0.4, depth: 3, merge: false });
      c.lastRock = { g: isl.g, solid: isl.solid, home: V(0, 15.8, -319.4), sink: 0, v: 0 };
      c.debris.push(c.lastRock);
    }
    c.pad(0, 15.8, -320.4, V(0, 13.2, -15.2), 1.1);
    c.orbArc(V(0, 17.2, -321.5), V(0, 13.6, -334.0), 5.2, 7);
    // 배경: 무너지는 큰 바위들 (연출용 · 멀리)
    c.bigRocks = [];
    for (let i = 0; i < 8; i++) {
      const s = 2.2 + (i % 3) * 1.2;
      const geo = islandGeo(s, s * 1.6, { seed: 90 + i, seg: 20 });
      shadeVerts(geo.top, { bottom: 0.9 });
      shadeVerts(geo.rock, { bottom: 0.5 });
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo.top, M.grass), new THREE.Mesh(geo.rock, M.rock));
      const x = (i % 2 ? 1 : -1) * (8.5 + (i % 3) * 4);
      g.position.set(x, 15.5 - (i % 2) * 2.5, -270 - i * 5.5);
      g.userData.home = g.position.clone();
      g.userData.v = 0;
      g.userData.spin = V((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
      c.root.add(g);
      c.bigRocks.push(g);
    }

    /* ---------- 10. 비행선 (결승) ---------- */
    c.goalShip(0, 9.5, -342, 1.5);

    // 길 옆 · 아래 배경: 먼 섬 · 구름
    const W = c.world;
    W.farIsland(-62, 3, -82, 10, { trees: 4, castle: true, falls: 2, seed: 2 });
    W.farIsland(85, 6, -140, 12, { trees: 3, castle: true, falls: 2, seed: 4 });
    W.farIsland(-95, 12, -230, 10, { trees: 5, falls: 1, seed: 6 });
    W.farIsland(60, -12, -300, 8, { trees: 3, falls: 1, seed: 8 });
    W.farIsland(-55, 18, -380, 14, { castle: true, trees: 2, falls: 2, seed: 10 });
    W.farIsland(40, 2, 40, 7, { trees: 2, falls: 1, seed: 12 });
    const rnd = seeded(99);
    for (let i = 0; i < 26; i++) {
      const z = 20 - i * 15;
      const side = i % 2 ? 1 : -1;
      W.addCloud(side * (10 + rnd() * 16), -8 - rnd() * 10 + (z < -150 ? 6 : 0), z - rnd() * 6, 4 + rnd() * 4, i);
    }
}

/* ================================================================
 * 꾸밈 도우미 (스테이지 2~6 공용)
 * ============================================================== */
/** 천막 (협곡 야영지) */
function tent(d, x, z, ry, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.add(part(new THREE.ConeGeometry(1.3 * s, 1.9 * s, 4, 1, true), "cloth", { pos: [0, 0.95 * s, 0], rot: [0, Math.PI / 4, 0], tint: "#f0c890" }));
  g.add(part(new THREE.CylinderGeometry(0.05, 0.05, 2.3 * s, 6), "woodDark", { pos: [0, 1.1 * s, 0] }));
  g.add(part(new THREE.PlaneGeometry(0.7 * s, 1.0 * s), "woodDark", { pos: [0, 0.5 * s, 0.93 * s], rot: [-0.45, 0, 0] }));
  d.add(g);
}
/** 나무 상자 더미 */
function crates(d, x, y, z, n = 3, s = 0.7, seed = 1) {
  const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    const k = s * (0.8 + rnd() * 0.4);
    const px = x + (rnd() - 0.5) * s * 1.6;
    const pz = z + (rnd() - 0.5) * s * 1.6;
    d.add(part(roundedBox(k, k, k, 0.05), "wood", { pos: [px, y + k / 2 + (i > 1 ? s : 0), pz], rot: [0, rnd() * 1.5, 0], tint: 0.85 + rnd() * 0.3 }));
  }
}
/** 둥근 선인장 */
function cactus(d, x, z, h = 1.4, seed = 1) {
  const rnd = seeded(seed);
  d.add(part(new THREE.CapsuleGeometry(0.22, h, 4, 10), "leaf", { pos: [x, h / 2 + 0.2, z], tint: "#7aa858" }));
  for (const s of [-1, 1]) {
    if (rnd() < 0.3) continue;
    const ah = h * (0.3 + rnd() * 0.3);
    d.add(part(new THREE.CapsuleGeometry(0.13, ah * 0.5, 4, 8), "leaf", { pos: [x + s * 0.38, h * 0.55, z], rot: [0, 0, s * 1.2], tint: "#7aa858" }));
    d.add(part(new THREE.CapsuleGeometry(0.13, ah, 4, 8), "leaf", { pos: [x + s * 0.55, h * 0.55 + ah * 0.5, z], tint: "#7aa858" }));
  }
  d.add(part(new THREE.IcosahedronGeometry(0.1, 0), "flower", { pos: [x, h + 0.55, z], tint: "#ff7a9a" }));
}
/** 줄에 매단 작은 깃발들 */
function bunting(c, a, b, cols = ["#ff7a6a", "#ffd24a", "#7ad0ff", "#9aff8a"]) {
  const d = new THREE.Group();
  const sag = a.distanceTo(b) * 0.06;
  d.add(part(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(V(0, -sag * 2, 0)), b), 16, 0.025, 4), "rope"));
  const n = Math.round(a.distanceTo(b) / 0.9);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag * 2 * 0.95;
    const tri = new THREE.BufferGeometry().setFromPoints([V(-0.22, 0, 0), V(0.22, 0, 0), V(0, -0.5, 0)]);
    tri.computeVertexNormals();
    d.add(part(tri, "cloth", { pos: [p.x, p.y, p.z], rot: [0, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, 0], tint: cols[i % cols.length] }));
  }
  const g = new THREE.Group();
  c.bakeInto(d, g);
  g.traverse((o) => o.isMesh && (o.material = o.material.clone(), (o.material.side = THREE.DoubleSide)));
  c.root.add(g);
}
/** 꾸밈 풍차 (돌기만 함 · 위험하지 않음) */
function decoMill(c, x, y, z, s = 1, ry = 0) {
  const M = c.M;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const d = new THREE.Group();
  d.add(part(new THREE.CylinderGeometry(0.7 * s, 1.1 * s, 4.2 * s, 8), "stone", { pos: [0, 2.1 * s, 0] }));
  d.add(part(new THREE.ConeGeometry(1.0 * s, 1.3 * s, 8), "roof", { pos: [0, 4.85 * s, 0] }));
  d.add(part(roundedBox(0.5 * s, 0.9 * s, 0.1, 0.05), "woodDark", { pos: [0, 0.45 * s, 1.08 * s] }));
  c.bakeInto(d, g);
  const rotor = new THREE.Group();
  rotor.position.set(0, 4.0 * s, 1.05 * s);
  rotor.userData.keep = true;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * TAU;
    arm.add(new THREE.Mesh(shadeVerts(roundedBox(0.12 * s, 3.0 * s, 0.1 * s, 0.03)), M.woodDark));
    arm.children[0].position.y = 1.5 * s;
    const sail = new THREE.Mesh(shadeVerts(new THREE.PlaneGeometry(0.75 * s, 2.3 * s), { bottom: 0.85 }), M.cloth);
    sail.material = M.cloth.clone();
    sail.material.side = THREE.DoubleSide;
    sail.position.set(0.42 * s, 1.75 * s, 0.03);
    arm.add(sail);
    rotor.add(arm);
  }
  rotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 10, 8), M.brass));
  g.add(rotor);
  c.root.add(g);
  const sp = 0.6 + (x % 3) * 0.1;
  c.anim.push((dt) => (rotor.rotation.z += dt * sp));
  return g;
}
/** 자연 바위 아치 (길 위를 넘어감 · 보기만) */
function rockArch(c, x, y, z, w = 9, h = 7, seed = 1) {
  for (const s of [-1, 1]) c.slab(x + (s * w) / 2, y + h * 0.15, z, 2.2, 2.6, { depth: h + 6, seed: seed + s, taper: 0.15, top: "rock", solid: false });
  const geo = new THREE.TorusGeometry(w / 2, 1.1, 10, 24, Math.PI);
  const p = geo.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const n = Math.sin(p.getX(i) * 1.7 + seed) * 0.18 + Math.cos(p.getY(i) * 2.3) * 0.12;
    p.setXYZ(i, p.getX(i) * (1 + n * 0.1), p.getY(i) * 0.8 + n, p.getZ(i) * (1 + n));
  }
  geo.computeVertexNormals();
  shadeVerts(geo, { bottom: 0.55 });
  const m = new THREE.Mesh(geo, c.M.rock);
  m.position.set(x, y + h * 0.95, z);
  m.castShadow = true;
  c.root.add(m);
}
/** 협곡 양쪽 높은 절벽 벽 (보기만 · 지나갈 수 없게 멀리) */
function canyonWalls(c, z0, z1, { gap = 12.5, seed = 1, yTop = 22 } = {}) {
  const rnd = seeded(seed);
  for (const s of [-1, 1]) {
    for (let z = z0; z > z1; ) {
      const l = 18 + rnd() * 16;
      const w = 6 + rnd() * 5;
      const top = yTop + (rnd() - 0.4) * 12;
      const x = s * (gap + w / 2 + rnd() * 3);
      c.slab(x, top, z - l / 2, w, l, { depth: top + 45, seed: Math.round(z) + s * 7, taper: 0.12, lumpy: 0.3, solid: false });
      // 꼭대기 장식: 마른 덤불 · 가끔 풍차
      if (rnd() < 0.35) decoMill(c, x - s * (w / 2 - 1.5), top, z - l / 2, 0.9 + rnd() * 0.4, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      z -= l + (rnd() < 0.25 ? 10 + rnd() * 10 : -1.5);
    }
  }
}

/* ================================================================
 * 2. 바람 협곡 — 맑은 낮 · 붉은 바위 대지 · 높은 절벽
 *  바위 대지 건너기 → 풍차 다리 → 맞바람 절벽길(낙석) → 회전 원판 → 바람 기둥 두 번(절벽 오르기)
 *  → 바람 고리 연속 → 번갈아 부는 옆바람 다리(풍차) → 낙석 계곡 → 협곡 출구 비행선
 * ============================================================== */
function stage2(c) {
  const M = c.M;
  c.setPath(
    [
      [0, 0, 5.5],
      [0, 0, -8],
      [0, 0, -13.5],
      [1.5, 0.6, -20],
      [-1, 1.2, -26.5],
      [0, 1.2, -31],
      [0, 1.2, -42],
      [0, 1.2, -58],
      [0, 1.2, -70],
      [0, 1.2, -86],
      [0, 1.2, -92],
      [0, 1.6, -101],
      [0, 2.0, -107.5],
      [0, 2.4, -114],
      [0, 2.4, -119],
      [0, 2.4, -131],
      [0, 2.4, -135],
      [0, 7.6, -138.6],
      [0, 7.6, -140.2],
      [0, 12.8, -143],
      [0, 12.8, -156.8],
      [0, 13.6, -168],
      [0, 12, -177],
      [0, 12, -190],
      [0, 12, -206],
      [0, 12, -218],
      [0, 11.2, -223],
      [1.6, 10.4, -229],
      [-1.4, 9.6, -235],
      [0, 9.6, -240],
      [0, 9.6, -261],
      [0, 9.6, -266],
    ],
    { p: V(0, 0, 5.5), yaw: Math.PI }
  );
  const W = c.world;

  /* ---------- 1. 협곡 야영지 (출발) ---------- */
  const camp = c.slab(0, 0, 0, 15, 17, { depth: 9, seed: 2 }).g;
  {
    const d = new THREE.Group();
    tent(d, -4.8, 2.5, 0.4, 1.1);
    tent(d, 5.0, -2.0, -0.6, 1.0);
    tent(d, -5.2, -4.2, 0.9, 0.9);
    crates(d, 4.8, 0, 4.4, 4, 0.75, 3);
    crates(d, -5.5, 0, 6.2, 3, 0.6, 5);
    cactus(d, 6.2, 6.0, 1.5, 2);
    cactus(d, -6.4, -7.0, 1.2, 4);
    cactus(d, 6.4, -7.2, 1.0, 6);
    // 모닥불 돌
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      d.add(part(new THREE.DodecahedronGeometry(0.22, 0), "stone", { pos: [2.6 + Math.cos(a) * 0.55, 0.12, 3.0 + Math.sin(a) * 0.55], scale: [1, 0.6, 1] }));
    }
    d.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), "trunk", { pos: [2.6, 0.12, 3.0], rot: [0, 0.5, Math.PI / 2] }));
    d.add(part(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), "trunk", { pos: [2.6, 0.14, 3.0], rot: [0, -0.7, Math.PI / 2] }));
    c.bakeInto(d, camp);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 8), M.lantern);
    fire.position.set(2.6, 0.35, 3.0);
    camp.add(fire);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffb04a", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.position.set(2.6, 0.6, 3.0);
    glow.scale.setScalar(2.2);
    camp.add(glow);
    c.anim.push((dt, t) => {
      fire.scale.set(1 + Math.sin(t * 13) * 0.12, 1 + Math.sin(t * 17) * 0.2, 1 + Math.cos(t * 11) * 0.12);
      glow.material.opacity = 0.5 + Math.sin(t * 9) * 0.1;
    });
    for (const [x, z, r] of [
      [-4.8, 2.5, 1.2],
      [5.0, -2.0, 1.1],
      [-5.2, -4.2, 1.0],
    ])
      c.disc(x, z, r, 1.6, { noCam: true });
    for (const s of [-1, 1]) {
      const f = new Flag(s > 0 ? "#ff7a4a" : "#4ac8ff", 1.0, 0.65, 3.0);
      f.group.position.set(s * 2.0, 0, -8.0);
      f.group.userData.keep = true;
      camp.add(f.group);
      c.flags.push(f);
      c.box(s * 2.0 - 0.07, s * 2.0 + 0.07, 0, 3, -8.07, -7.93, { noCam: true });
    }
  }
  decoMill(c, -5.6, 0, -1.2, 1.0, Math.PI / 2);
  c.box(-6.4, -4.8, 0, 4, -2.0, -0.4, { noCam: true });
  bunting(c, V(-2.0, 2.9, -8.0), V(2.0, 2.9, -8.0));

  /* ---------- 2. 바위 대지 건너기 ---------- */
  c.slab(0, 0, -13.5, 4, 5, { depth: 6, seed: 3 });
  c.slab(1.5, 0.6, -20, 3.6, 4, { depth: 6, seed: 4 });
  c.slab(-1, 1.2, -26.5, 3.6, 4, { depth: 7, seed: 5 });
  c.orbLine(V(0, 0.9, -10), V(0, 0.9, -15), 3);
  c.orbArc(V(0.2, 1.2, -16.2), V(1.4, 1.8, -19.2), 1.2, 2);
  c.orbArc(V(1.0, 1.8, -22.4), V(-0.8, 2.4, -25.6), 1.2, 2);
  {
    const mesa = c.slab(0, 1.2, -36, 8, 12, { depth: 10, seed: 6 }).g;
    const d = new THREE.Group();
    cactus(d, -2.8, 3.0, 1.3, 7);
    cactus(d, 3.0, -3.5, 1.6, 8);
    crates(d, 2.8, 0, 3.4, 2, 0.6, 9);
    c.bakeInto(d, mesa);
    c.box(-3.1, -2.5, 1.2, 3, -33.3, -32.7, { noCam: true });
    c.box(2.7, 3.3, 1.2, 3.2, -39.8, -39.2, { noCam: true });
  }
  c.orbLine(V(0, 2.1, -31.5), V(0, 2.1, -40.5), 4);

  /* ---------- 3. 풍차 다리 ---------- */
  c.plankBridge(0, 1.2, -42, -58, 2.0);
  new Windmill(c, 0, 1.2, -50, { len: 4.0, speed: 1.15, n: 4, h: 4.7, side: 1 });
  c.orbLine(V(0, 2.1, -43.5), V(0, 2.1, -48), 3);
  c.orbLine(V(0, 2.1, -52), V(0, 2.1, -56.5), 3);
  {
    const e = c.slab(0, 1.2, -64, 7, 12, { depth: 10, seed: 7 }).g;
    const d = new THREE.Group();
    cactus(d, 2.6, 2.6, 1.2, 10);
    tent(d, -2.4, -3.6, 1.2, 0.8);
    c.bakeInto(d, e);
    c.disc(-2.4, -67.6, 0.9, 2.7, { noCam: true });
  }
  c.checkpoint(0, 1.2, -64, 1, "풍차 다리 통과");
  c.pass(-57.5, "풍차 다리");

  /* ---------- 4. 맞바람 절벽길 + 낙석 ---------- */
  c.slab(0, 1.2, -78, 2.6, 16, { depth: 5, seed: 8, lumpy: 0.3 });
  new WindZone(c, { x0: -1.8, x1: 1.8, z0: -86, z1: -70, y0: 0.8, y1: 6 }, V(0, 0, 1), { strength: 3.2, on: 1.8, off: 2.2, warn: 0.75 });
  new Dropper(c, 0, 1.2, -75.5, { mode: "timer", look: "rock", h: 9.5, period: 4.2, phase: 0, r: 0.8 });
  new Dropper(c, 0, 1.2, -81.5, { mode: "timer", look: "rock", h: 9.5, period: 4.2, phase: 0.08, r: 0.8 });
  // 위로 튀어나온 절벽 (낙석이 떨어지는 곳)
  c.slab(-3.6, 12.5, -79, 6, 13, { depth: 4, seed: 9, taper: 0.4, solid: false, top: "rock" });
  c.slab(-8.5, 12, -79, 6, 18, { depth: 26, seed: 10, taper: 0.1, solid: false });
  c.orbLine(V(0, 2.1, -72), V(0, 2.1, -85), 6);
  c.slab(0, 1.2, -92, 6, 8, { depth: 8, seed: 11 });
  c.pass(-87, "맞바람 절벽길");

  /* ---------- 5. 회전 원판 ---------- */
  new Turntable(c, 0, 1.6, -101, 2.2, 0.85, { look: "mill" });
  new Turntable(c, 0, 2.0, -107.5, 2.2, -1.0, { look: "mill" });
  new Turntable(c, 0, 2.4, -114, 2.2, 1.1, { look: "mill" });
  c.orb(0, 2.6, -101);
  c.orb(0, 3.0, -107.5);
  c.orb(0, 4.6, -107.5, true);
  c.orb(0, 3.4, -114);
  c.orbArc(V(0, 2.4, -96.5), V(0, 2.6, -98.6), 1.0, 2);
  {
    const g2 = c.slab(0, 2.4, -125, 7, 12, { depth: 10, seed: 12 }).g;
    const d = new THREE.Group();
    crates(d, -2.4, 0, 3.0, 3, 0.7, 11);
    cactus(d, 2.6, -1.0, 1.4, 12);
    c.bakeInto(d, g2);
    c.box(-3.2, -1.6, 2.4, 4, -122.8, -121.2, { noCam: true });
    c.box(2.3, 2.9, 2.4, 4.2, -126.3, -125.7, { noCam: true });
  }
  c.checkpoint(0, 2.4, -125, 1, "회전 원판 통과");
  c.pass(-118.5, "회전 원판");

  /* ---------- 6. 바람 기둥 두 번 (절벽 오르기) ---------- */
  c.slab(0, 2.4, -135, 3.2, 3, { depth: 5, seed: 13 });
  c.vent(0, 2.4, -135, 1.8, 10.6, 52);
  c.slab(0, 7.6, -138.9, 4.6, 4.6, { depth: 5.5, seed: 14, taper: 0.3, wall: 6 });
  c.vent(0, 7.6, -140.2, 1.7, 15.8, 52);
  c.orbLine(V(0, 4.4, -135), V(0, 8.4, -135), 3);
  c.orbLine(V(0, 9.6, -140.2), V(0, 13.6, -140.2), 3);
  // 절벽 (오르는 벽)
  c.slab(0, 12.8, -149, 9, 15.6, { depth: 16, seed: 15, taper: 0.2, wall: 8 });
  c.slab(-7.5, 15.5, -150, 6, 16, { depth: 20, seed: 16, taper: 0.15, solid: false });
  {
    const d = new THREE.Group();
    const g = new THREE.Group();
    g.position.set(0, 12.8, -149);
    cactus(d, 3.2, 3.5, 1.6, 13);
    cactus(d, -3.3, -4.0, 1.1, 14);
    c.bakeInto(d, g);
    c.root.add(g);
    c.box(2.95, 3.45, 12.8, 14.5, -145.75, -145.25, { noCam: true });
  }
  c.checkpoint(0, 12.8, -150, -1, "절벽 위!");
  c.pass(-144, "바람 기둥");

  /* ---------- 7. 바람 고리 연속 (협곡 틈 건너기) ---------- */
  c.boostRing(0, 14.3, -158.5, V(0, 8.5, -14), 1.5);
  c.boostRing(0, 14.0, -168, V(0, 8, -14), 1.6);
  c.orbArc(V(0, 15.2, -159.5), V(0, 14.8, -167), 1.6, 5);
  c.orbArc(V(0, 14.8, -169), V(0, 13.2, -176), 1.4, 4);
  c.orb(0, 18.2, -163.5, true);
  {
    const j = c.slab(0, 12, -182, 8, 16, { depth: 12, seed: 17 }).g;
    const d = new THREE.Group();
    tent(d, 2.6, 4.0, -0.8, 0.8);
    crates(d, -2.8, 0, -4.5, 3, 0.7, 15);
    c.bakeInto(d, j);
    c.disc(2.6, -178, 0.9, 13.5, { noCam: true });
  }
  c.pass(-176, "고리 연속 점프");

  /* ---------- 8. 번갈아 부는 옆바람 다리 + 풍차 ---------- */
  c.plankBridge(0, 12, -190, -206, 2.4);
  new WindZone(c, { x0: -2.6, x1: 2.6, z0: -206, z1: -190, y0: 11.5, y1: 16 }, V(1, 0, 0), { strength: 2.5, on: 1.6, off: 2.2, warn: 0.8, phase: 0 });
  new WindZone(c, { x0: -2.6, x1: 2.6, z0: -206, z1: -190, y0: 11.5, y1: 16 }, V(-1, 0, 0), { strength: 2.5, on: 1.6, off: 2.2, warn: 0.8, phase: 0.5 });
  new Windmill(c, 0, 12, -199, { len: 4.0, speed: -1.25, n: 4, h: 4.7, side: -1, phase: 0.5 });
  c.orbLine(V(0, 12.9, -191.5), V(0, 12.9, -197), 3);
  c.orbLine(V(0, 12.9, -201), V(0, 12.9, -205), 3);
  {
    const k = c.slab(0, 12, -212, 7, 12, { depth: 12, seed: 18 }).g;
    const d = new THREE.Group();
    cactus(d, -2.6, -2.0, 1.4, 16);
    crates(d, 2.6, 0, -3.0, 2, 0.6, 17);
    c.bakeInto(d, k);
    c.box(-2.85, -2.35, 12, 13.8, -214.25, -213.75, { noCam: true });
  }
  c.checkpoint(0, 12, -212, 1, "바람 다리 통과");
  c.pass(-206.5, "바람 다리");

  /* ---------- 9. 내려가는 바위 + 낙석 계곡 ---------- */
  c.slab(0, 11.2, -223, 3.2, 4, { depth: 6, seed: 19 });
  c.slab(1.6, 10.4, -229, 3, 4, { depth: 6, seed: 20 });
  c.slab(-1.4, 9.6, -235, 3, 4, { depth: 6, seed: 21 });
  c.orbArc(V(0, 12.4, -218.5), V(0, 12, -222), 1, 2);
  c.orbArc(V(0.4, 11.6, -224.5), V(1.4, 11.2, -227.6), 1, 2);
  c.orbArc(V(1.2, 10.8, -230.6), V(-1.2, 10.4, -233.6), 1, 2);
  c.slab(0, 9.6, -250, 6, 22, { depth: 12, seed: 22 });
  new Dropper(c, -1.0, 9.6, -245, { mode: "timer", look: "rock", h: 10, period: 2.9, phase: 0.0, r: 0.85 });
  new Dropper(c, 1.0, 9.6, -250.5, { mode: "timer", look: "rock", h: 10, period: 2.9, phase: 0.35, r: 0.85 });
  new Dropper(c, 0, 9.6, -256, { mode: "timer", look: "rock", h: 10, period: 2.9, phase: 0.7, r: 0.85 });
  rockArch(c, 0, 9.6, -250, 10, 8, 23);
  c.orbLine(V(0, 10.5, -241), V(0, 10.5, -260), 7);
  c.pass(-261, "낙석 계곡");

  /* ---------- 10. 협곡 출구 비행선 ---------- */
  c.goalShip(0, 6.9, -270.4, 1.5, "#e8b07a");
  bunting(c, V(-2.2, 12.6, -262.5), V(2.2, 12.6, -262.5));

  /* ---------- 배경: 높은 절벽 벽 · 먼 붉은 대지 · 구름 ---------- */
  canyonWalls(c, 20, -300, { gap: 17, seed: 31, yTop: 15 });
  W.farIsland(-70, 4, -60, 12, { trees: 2, falls: 0, seed: 21 });
  W.farIsland(90, 14, -160, 14, { trees: 1, castle: true, falls: 0, seed: 23 });
  W.farIsland(-95, 22, -260, 12, { trees: 2, falls: 0, seed: 25 });
  W.farIsland(60, -8, -330, 10, { trees: 1, falls: 0, seed: 27 });
  for (let i = 0; i < 6; i++) {
    const s = i % 2 ? 1 : -1;
    c.slab(s * (45 + i * 6), -10 + i * 3, -40 - i * 52, 10 + (i % 3) * 4, 10 + (i % 2) * 6, { depth: 40, seed: 40 + i, taper: 0.35, solid: false });
  }
  const rnd = seeded(77);
  for (let i = 0; i < 18; i++) {
    const z = 20 - i * 18;
    const side = i % 2 ? 1 : -1;
    W.addCloud(side * (8 + rnd() * 6), -14 - rnd() * 8, z - rnd() * 6, 5 + rnd() * 4, i);
  }
}

/* ---------------- 항구 꾸밈 ---------------- */
/** 부두 (나무 판자 + 아래 기둥 · 버팀대) — 윗면 = 상자 */
function pier(c, x, y, z0, z1, w = 3, { posts = true, rails = 0 } = {}) {
  const g = new THREE.Group();
  const d = new THREE.Group();
  const len = Math.abs(z1 - z0);
  const zc = (z0 + z1) / 2;
  const n = Math.max(2, Math.round(len / 0.5));
  const rnd = seeded(Math.round(z0 * 7 + x));
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * (i + 0.5)) / n;
    d.add(part(roundedBox(w, 0.16, (len / n) * 0.92, 0.03), "wood", { pos: [x + (rnd() - 0.5) * 0.05, y - 0.08, z], rot: [0, (rnd() - 0.5) * 0.03, 0], tint: 0.82 + rnd() * 0.3 }));
  }
  for (const s of [-1, 1]) d.add(part(roundedBox(0.2, 0.3, len, 0.04), "woodDark", { pos: [x + s * (w / 2 - 0.12), y - 0.3, zc] }));
  if (posts) {
    for (let z = z0; z >= z1 - 0.01; z -= Math.max(2.5, len / Math.ceil(len / 3.5))) {
      for (const s of [-1, 1]) {
        d.add(part(new THREE.CylinderGeometry(0.13, 0.16, 7, 8), "woodDark", { pos: [x + s * (w / 2 - 0.15), y - 3.7, z] }));
      }
      d.add(part(roundedBox(w, 0.14, 0.16, 0.03), "woodDark", { pos: [x, y - 1.6, z] }));
    }
  }
  for (const s of rails === 2 ? [-1, 1] : rails === 1 ? [1] : rails === -1 ? [-1] : []) {
    for (let z = z0; z >= z1 - 0.01; z -= 2) d.add(part(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 6), "woodDark", { pos: [x + s * (w / 2 - 0.08), y + 0.5, z] }));
    d.add(part(new THREE.TubeGeometry(new THREE.LineCurve3(V(x + s * (w / 2 - 0.08), y + 0.95, z0), V(x + s * (w / 2 - 0.08), y + 0.95, z1)), 4, 0.04, 5), "rope"));
    c.box(x + s * (w / 2) - 0.08, x + s * (w / 2) + 0.04, y, y + 1.0, Math.min(z0, z1), Math.max(z0, z1), { rail: true, noCam: true });
  }
  c.bakeInto(d, g);
  c.root.add(g);
  return c.box(x - w / 2, x + w / 2, y - 0.3, y, Math.min(z0, z1), Math.max(z0, z1));
}
/** 항구 집 (벽 + 세모 지붕 + 창 + 문) */
function house(d, x, z, w, h, l, ry = 0, roofTint = "#4a6ac8", seed = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.add(part(roundedBox(w, h, l, 0.08), "cloth", { pos: [0, h / 2, 0], tint: "#f4e8d4" }));
  // 세모 지붕: 삼각기둥 (용마루가 앞뒤 방향)
  const r = w * 0.66;
  const roof = new THREE.CylinderGeometry(r, r, l * 1.12, 3, 1);
  roof.rotateX(-Math.PI / 2);
  g.add(part(roof, "roof", { pos: [0, h + 0.5 * r * 0.62, 0], scale: [1, 0.62, 1], tint: roofTint }));
  g.add(part(roundedBox(w + 0.2, 0.18, l + 0.2, 0.05), "woodDark", { pos: [0, h, 0] }));
  g.add(part(roundedBox(0.7, 1.2, 0.08, 0.05), "woodDark", { pos: [0, 0.6, l / 2 + 0.02] }));
  const rnd = seeded(seed);
  for (let i = 0; i < 2; i++) {
    const wx = (i ? 1 : -1) * w * 0.28;
    g.add(part(new THREE.PlaneGeometry(0.45, 0.55), "window", { pos: [wx, h * 0.62, l / 2 + 0.05] }));
    g.add(part(new THREE.PlaneGeometry(0.45, 0.55), "window", { pos: [w / 2 + 0.05, h * 0.6, (i ? 1 : -1) * l * 0.25], rot: [0, Math.PI / 2, 0] }));
  }
  if (rnd() < 0.6) g.add(part(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), "stone", { pos: [w * 0.25, h + w * 0.4, -l * 0.2] }));
  d.add(g);
}
/** 술통 */
function barrel(d, x, y, z, s = 0.55) {
  d.add(part(new THREE.CylinderGeometry(s * 0.46, s * 0.5, s * 1.1, 14), "wood", { pos: [x, y + s * 0.55, z], tint: 0.8 }));
  for (const yy of [0.2, 0.9]) d.add(part(new THREE.CylinderGeometry(s * 0.51, s * 0.51, s * 0.08, 14), "woodDark", { pos: [x, y + s * yy, z] }));
}
/** 길가 등불 (빛 + 기둥) */
function harborLamp(c, x, y, z) {
  const d = new THREE.Group();
  d.add(part(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 8), "woodDark", { pos: [x, y + 1.1, z] }));
  d.add(part(roundedBox(0.36, 0.08, 0.36, 0.02), "woodDark", { pos: [x, y + 2.2, z] }));
  d.add(part(new THREE.SphereGeometry(0.17, 12, 10), "lantern", { pos: [x, y + 2.42, z] }));
  const g = new THREE.Group();
  c.bakeInto(d, g);
  (c.toMerge || (c.toMerge = [])).push(g);
  c.root.add(g);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffcf7a", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(x, y + 2.42, z);
  glow.scale.setScalar(1.6);
  c.root.add(glow);
  c.box(x - 0.1, x + 0.1, y, y + 2.3, z - 0.1, z + 0.1, { noCam: true });
}
/** 묶여 있는 비행선 (갑판에 설 수 있음 · 살짝 출렁) — 갑판이 길을 가로지르게 옆으로 돌려 둔다 */
function mooredShip(c, x, y, z, { scale = 1.2, color = "#f0c8a0", ry = Math.PI / 2 } = {}) {
  const ship = new Airship(c.M, { scale, color });
  ship.group.position.set(x, y, z);
  ship.group.rotation.y = ry;
  c.root.add(ship.group);
  const hx = Math.abs(Math.cos(ry)) * ship.deckHalf.x + Math.abs(Math.sin(ry)) * ship.deckHalf.z;
  const hz = Math.abs(Math.sin(ry)) * ship.deckHalf.x + Math.abs(Math.cos(ry)) * ship.deckHalf.z;
  const top = y + ship.deckY;
  const solid = c.box(x - hx, x + hx, top - 0.3, top, z - hz, z + hz);
  // 선실 (옆에 있음)
  const cl = 2.8 * scale;
  const cx = x + Math.sin(ry) * -cl;
  const cz = z + Math.cos(ry) * -cl;
  c.box(cx - 1.4 * scale, cx + 1.4 * scale, top, top + 2.2 * scale, cz - 1.4 * scale, cz + 1.4 * scale, { noCam: true });
  c.mechs.push({
    kind: "ship",
    update(dt) {
      ship.update(dt * 0.6);
      const ny = top + ship.inner.position.y;
      solid.dy = ny - solid.y1;
      solid.y1 = ny;
      solid.y0 = ny - 0.3;
    },
    reset() {},
  });
  return ship;
}
/** 등대 (줄무늬 탑 + 도는 불빛) */
function lighthouse(c, x, y, z, h = 14) {
  const M = c.M;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const d = new THREE.Group();
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const r0 = 1.7 - (i / bands) * 0.55;
    const r1 = 1.7 - ((i + 1) / bands) * 0.55;
    d.add(part(new THREE.CylinderGeometry(r1, r0, h / bands, 20, 1), "cloth", { pos: [0, (h / bands) * (i + 0.5), 0], tint: i % 2 ? "#e85a4a" : "#fff4e4" }));
  }
  d.add(part(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 20), "woodDark", { pos: [0, h + 0.15, 0] }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    d.add(part(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5), "woodDark", { pos: [Math.cos(a) * 1.5, h + 0.7, Math.sin(a) * 1.5] }));
  }
  d.add(part(new THREE.ConeGeometry(1.3, 1.3, 16), "roof", { pos: [0, h + 2.4, 0], tint: "#e85a4a" }));
  d.add(part(roundedBox(0.9, 1.5, 0.1, 0.05), "woodDark", { pos: [0, 0.75, 1.65] }));
  c.bakeInto(d, g);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 16), M.lantern);
  lamp.position.y = h + 1.0;
  g.add(lamp);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffe2a0", transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.y = h + 1.0;
  glow.scale.setScalar(6);
  g.add(glow);
  const beam = new THREE.Group();
  beam.position.y = h + 1.0;
  beam.userData.keep = true;
  const bg = new THREE.ConeGeometry(2.6, 26, 20, 1, true);
  bg.translate(0, -13, 0);
  bg.rotateZ(Math.PI / 2);
  const bm = new THREE.MeshBasicMaterial({ color: "#fff0b0", transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(bg, bm);
    m.rotation.y = s > 0 ? 0 : Math.PI;
    beam.add(m);
  }
  g.add(beam);
  c.root.add(g);
  c.anim.push((dt) => (beam.rotation.y += dt * 0.7));
  c.disc(x, z, 1.75, y + h, { noCam: true });
  return g;
}

/* ================================================================
 * 3. 공중 항구 — 황금빛 늦은 오후 · 나무 부두 · 비행선이 묶인 항구
 *  짐 나르는 띠(앞으로 · 옆으로 · 거꾸로 바뀜) → 출렁이는 하늘 배 → 포대 부두(포탄)
 *  → 크레인 짐받침 흔들기 → 등대 섬 → 상자 계단 → 도개교 → 묶인 비행선 갑판 → 떠나는 비행선
 * ============================================================== */
function stage3(c) {
  const M = c.M;
  const W = c.world;
  c.setPath(
    [
      [0, 0, 5.5],
      [0, 0, -8],
      [0, 0, -12],
      [0, 0, -20],
      [0, 0, -25],
      [0, 0, -30],
      [0, 0, -34],
      [0, 0, -46],
      [0, 0, -49],
      [0, 0.2, -52.5],
      [0, 0.4, -58],
      [0, 0.6, -63.5],
      [0, 0.8, -69],
      [0, 1, -72.5],
      [0, 1, -84.5],
      [0, 1, -112],
      [0, 1, -124],
      [0, 1.8, -129.5],
      [0, 1.8, -138.5],
      [0, 1.8, -147.5],
      [0, 1, -152.3],
      [0, 1, -166.3],
      [0, 2, -169],
      [1.6, 3, -173],
      [-0.4, 4, -177],
      [1.2, 5, -181],
      [0, 6, -184],
      [0, 6, -193],
      [0, 6, -207],
      [0, 6, -219],
      [0, 6, -229],
      [0, 6, -235],
      [0, 6, -242],
      [0, 6, -262],
      [0, 6, -267],
    ],
    { p: V(0, 0, 5.5), yaw: Math.PI }
  );

  /* ---------- 1. 항구 입구 광장 (출발) ---------- */
  const plaza = c.slab(0, 0, 0, 14, 16, { depth: 9, seed: 31 }).g;
  {
    const d = new THREE.Group();
    house(d, -4.6, 3.0, 3.2, 2.8, 3.6, Math.PI / 2, "#6a8ae8", 1);
    house(d, 4.8, -1.5, 3.0, 2.6, 3.4, -Math.PI / 2, "#f08a5a", 2);
    house(d, -4.8, -4.6, 2.6, 2.4, 3.0, Math.PI / 2, "#6ac89a", 3);
    for (const [x, z] of [
      [3.6, 5.2],
      [4.3, 5.8],
      [3.9, 4.6],
      [-2.9, -7.2],
    ])
      barrel(d, x, 0, z);
    crates(d, 5.2, 0, 4.0, 3, 0.7, 21);
    crates(d, -5.6, 0, 6.6, 2, 0.6, 22);
    // 분수 (가운데 둥근 연못)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      d.add(part(roundedBox(0.5, 0.4, 0.3, 0.06), "stone", { pos: [Math.cos(a) * 1.4 + 3.2, 0.2, Math.sin(a) * 1.4 - 5.6], rot: [0, -a, 0] }));
    }
    c.bakeInto(d, plaza);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshStandardMaterial({ color: "#6ad0ff", emissive: "#2a90c8", emissiveIntensity: 0.3, roughness: 0.1 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(3.2, 0.25, -5.6);
    plaza.add(water);
    for (const [x, z, w, l] of [
      [-4.6, 3.0, 3.6, 3.2],
      [4.8, -1.5, 3.4, 3.0],
      [-4.8, -4.6, 3.0, 2.6],
    ])
      c.box(x - w / 2, x + w / 2, 0, 3.2, z - l / 2, z + l / 2, { noCam: true });
    c.disc(3.2, -5.6, 1.6, 0.4, { noCam: true });
  }
  harborLamp(c, -2.0, 0, -7.4);
  harborLamp(c, 2.0, 0, -7.4);
  bunting(c, V(-2.0, 2.3, -7.4), V(2.0, 2.3, -7.4), ["#ff7a6a", "#fff4e4", "#4ac8ff"]);
  // 옆에 묶인 큰 비행선 (배경)
  {
    const big = new Airship(M, { scale: 1.6, color: "#d8e0f0", deck: false });
    big.group.position.set(-15, -2, -6);
    big.group.rotation.y = 0.2;
    c.root.add(big.group);
    c.anim.push((dt) => big.update(dt));
    pier(c, -9.5, 0, -3, -9, 4, { posts: true });
  }

  /* ---------- 2. 짐 나르는 띠 (앞으로 · 옆으로 · 거꾸로) ---------- */
  pier(c, 0, 0, -8, -12, 3);
  new Conveyor(c, 0, 0, -16, 2.6, 8, V(0, 0, -3.2));
  pier(c, 0, 0, -20, -25, 3);
  new Conveyor(c, 0, 0, -27.5, 7, 5, V(3.0, 0, 0));
  pier(c, 0, 0, -30, -34, 3);
  new Conveyor(c, 0, 0, -40, 2.6, 12, V(0, 0, 3.0), { flip: 3.4, warn: 1.2 });
  pier(c, 0, 0, -46, -49, 3, { rails: 0 });
  {
    const d = new THREE.Group();
    crates(d, 1.9, 0, -21.5, 2, 0.6, 23);
    barrel(d, -1.9, 0, -32);
    const g = new THREE.Group();
    c.bakeInto(d, g);
    c.root.add(g);
  }
  c.orbLine(V(0, 0.9, -13), V(0, 0.9, -19.5), 4);
  c.orbLine(V(-1.2, 0.9, -26), V(1.2, 0.9, -29), 3);
  c.orbLine(V(0, 0.9, -35), V(0, 0.9, -45), 5);
  c.pass(-46.5, "짐 나르는 띠");

  /* ---------- 3. 출렁이는 하늘 배 ---------- */
  c.mover(V(-1.1, 0.2, -52.5), V(1.1, 0.2, -52.5), 1.5, 5.2, 0, { look: "boat", bob: 0.18, bobT: 2.6 });
  c.mover(V(1.2, 0.4, -58), V(-1.2, 0.4, -58), 1.5, 4.8, 0.2, { look: "boat", bob: 0.2, bobT: 2.9 });
  c.mover(V(-1.2, 0.6, -63.5), V(1.2, 0.6, -63.5), 1.5, 5.0, 0.5, { look: "boat", bob: 0.18, bobT: 2.4 });
  c.mover(V(1.1, 0.8, -69), V(-1.1, 0.8, -69), 1.5, 4.6, 0.7, { look: "boat", bob: 0.2, bobT: 3.1 });
  for (const z of [-52.5, -58, -63.5, -69]) c.orb(0, 1.7 + (-52.5 - z) * 0.03, z);
  {
    const q2 = c.slab(0, 1.0, -78.5, 10, 12, { depth: 9, seed: 32 }).g;
    const d = new THREE.Group();
    house(d, -3.4, -2.0, 2.6, 2.4, 3.0, Math.PI / 2, "#f08a5a", 4);
    crates(d, 3.6, 0, 3.2, 3, 0.7, 24);
    barrel(d, 3.8, 0, -3.8);
    barrel(d, 3.2, 0, -4.4);
    c.bakeInto(d, q2);
    c.box(-4.6, -2.2, 1.0, 3.6, -81.8, -79.2, { noCam: true });
  }
  harborLamp(c, 3.4, 1.0, -73.7);
  c.checkpoint(0, 1.0, -78.5, 1, "하늘 배 건너기 통과");
  c.pass(-73, "출렁이는 배");

  /* ---------- 4. 포대 부두 (포탄이 길을 가로지름) ---------- */
  pier(c, 0, 1.0, -84.5, -112, 3.4);
  new Cannon(c, 7.5, 1.0, -91, V(-1, 0, 0), { period: 3.6, phase: 0.0, range: 16, floorY: 1.0 });
  new Cannon(c, 7.5, 1.0, -98, V(-1, 0, 0), { period: 3.6, phase: 0.33, range: 16, floorY: 1.0 });
  new Cannon(c, -7.5, 1.0, -105, V(1, 0, 0), { period: 3.6, phase: 0.66, range: 16, floorY: 1.0 });
  c.orbLine(V(0, 1.9, -87.5), V(0, 1.9, -110.5), 9);
  {
    const d = new THREE.Group();
    crates(d, -1.25, 1.0, -94.5, 2, 0.5, 25);
    crates(d, 1.25, 1.0, -101.5, 2, 0.5, 26);
    const g = new THREE.Group();
    c.bakeInto(d, g);
    c.root.add(g);
  }
  {
    const q3 = c.slab(0, 1.0, -118, 8, 12, { depth: 9, seed: 33 }).g;
    const d = new THREE.Group();
    crates(d, -2.8, 0, 3.4, 3, 0.8, 27);
    barrel(d, 2.9, 0, 3.6);
    c.bakeInto(d, q3);
  }
  c.pass(-112.5, "포대 부두");

  /* ---------- 5. 크레인 짐받침 (앞뒤로 흔들림 · 서로 엇갈려 가까워질 때 건너기) ---------- */
  new Swing(c, 0, 8.5, -129.5, 7, { axis: "z", amp: 0.45, period: 4.4, phase: 0, w: 2.6, l: 2.4, look: "crate", side: 1 });
  new Swing(c, 0, 8.5, -138.5, 7, { axis: "z", amp: 0.45, period: 4.4, phase: 0.5, w: 2.6, l: 2.4, look: "crate", side: -1 });
  new Swing(c, 0, 8.5, -147.5, 7, { axis: "z", amp: 0.45, period: 4.4, phase: 0, w: 2.6, l: 2.4, look: "crate", side: 1 });
  c.orb(0, 3.6, -129.5);
  c.orb(0, 3.6, -138.5);
  c.orb(0, 3.6, -147.5);
  c.orb(0, 5.2, -134, true);
  {
    const isl = c.island(0, 1.0, -159.3, 7, { deco: "meadow", seed: 34, falls: 1, flowers: 0.5, trees: [[-4.5, -2.0, 3.0]] }).g;
    const d = new THREE.Group();
    crates(d, -4.6, 0, 3.0, 3, 0.7, 28);
    barrel(d, -3.6, 0, 4.4);
    c.bakeInto(d, isl);
  }
  c.island(10.5, 0.4, -162, 2.6, { depth: 7, seed: 37, deco: "none", flowers: 0.4, falls: 1 });
  lighthouse(c, 10.5, 0.4, -162, 15);
  c.checkpoint(0, 1.0, -158.5, -1, "크레인 통과");
  c.pass(-152, "크레인 짐받침");

  /* ---------- 6. 상자 계단 (위층 부두로) ---------- */
  const stair = [
    [0, 2.0, -169],
    [1.6, 3.0, -173],
    [-0.4, 4.0, -177],
    [1.2, 5.0, -181],
  ];
  stair.forEach(([x, y, z], i) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const d = new THREE.Group();
    d.add(part(roundedBox(2.6, 0.9, 2.6, 0.08), "wood", { pos: [0, -0.45, 0], tint: 0.9 + (i % 2) * 0.12 }));
    d.add(part(roundedBox(2.4, 1.3, 2.4, 0.08), "wood", { pos: [0.1, -1.6, 0.05], rot: [0, 0.1, 0], tint: 0.8 }));
    d.add(part(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), "woodDark", { pos: [0, -4.5, 0] }));
    c.bakeInto(d, g);
    c.root.add(g);
    c.box(x - 1.3, x + 1.3, y - 2.3, y, z - 1.3, z + 1.3);
    c.orb(x, y + 1.0, z);
  });
  {
    const u1 = c.slab(0, 6.0, -188, 6, 10, { depth: 8, seed: 35 }).g;
    const d = new THREE.Group();
    house(d, -1.6, 2.6, 2.2, 2.2, 2.6, Math.PI / 2, "#6a8ae8", 5);
    c.bakeInto(d, u1);
    c.box(-2.9, -0.3, 6.0, 8.4, -186.5, -184.3, { noCam: true });
  }
  harborLamp(c, 2.4, 6.0, -192.2);
  c.pass(-184, "상자 계단");

  /* ---------- 7. 도개교 ---------- */
  new Drawbridge(c, 0, 6.0, -193, -207, { w: 2.8, down: 3.8, warn: 1.1, up: 1.6, move: 0.6 });
  c.orbLine(V(0, 6.9, -195), V(0, 6.9, -205), 5);
  {
    const u2 = c.slab(0, 6.0, -213, 8, 12, { depth: 9, seed: 36 }).g;
    const d = new THREE.Group();
    crates(d, 2.8, 0, 3.6, 3, 0.7, 29);
    barrel(d, -3.0, 0, -3.8);
    c.bakeInto(d, u2);
  }
  c.checkpoint(0, 6.0, -213, 1, "도개교 통과");
  c.pass(-207.5, "도개교");

  /* ---------- 8. 묶인 비행선 갑판 건너기 ---------- */
  pier(c, 0, 6.0, -219, -227.4, 2.2, { posts: false, rails: 0 });
  mooredShip(c, 0, 6.0 - 2.16, -229, { scale: 1.2, color: "#f0c8a0" });
  mooredShip(c, 0, 6.0 - 2.16, -235, { scale: 1.2, color: "#a8d0f0", ry: -Math.PI / 2 });
  pier(c, 0, 6.0, -236.6, -242, 2.2, { posts: false });
  c.orbArc(V(0, 6.8, -230.8), V(0, 6.8, -233.2), 1.2, 2);
  c.orb(0, 9.4, -232, true);

  /* ---------- 9. 마지막 부두 (띠 + 대포) → 떠나는 비행선 ---------- */
  pier(c, 0, 6.0, -242, -244, 3);
  new Conveyor(c, 0, 6.0, -248, 2.6, 8, V(0, 0, -3.4));
  pier(c, 0, 6.0, -252, -262, 3);
  new Cannon(c, -7.5, 6.0, -257, V(1, 0, 0), { period: 3.4, phase: 0.2, range: 16, floorY: 6.0 });
  harborLamp(c, 1.3, 6.0, -261.4);
  harborLamp(c, -1.3, 6.0, -261.4);
  c.orbLine(V(0, 6.9, -244.5), V(0, 6.9, -251.5), 4);
  c.orbLine(V(0, 6.9, -253), V(0, 6.9, -261), 4);
  c.pass(-262, "마지막 부두");
  c.goalShip(0, 3.3, -271.4, 1.5, "#ffd890");

  /* ---------- 배경: 먼 항구 섬 · 떠 있는 비행선들 · 구름 ---------- */
  W.farIsland(-60, 2, -40, 11, { trees: 3, castle: true, falls: 1, seed: 41 });
  W.farIsland(70, 8, -130, 13, { trees: 4, castle: true, falls: 2, seed: 43 });
  W.farIsland(-80, 14, -220, 12, { trees: 3, castle: true, falls: 1, seed: 45 });
  W.farIsland(55, -4, -300, 10, { trees: 2, falls: 1, seed: 47 });
  const rnd = seeded(303);
  for (let i = 0; i < 4; i++) {
    const s = i % 2 ? 1 : -1;
    const sh = new Airship(M, { scale: 0.9 + rnd() * 0.7, color: ["#f0c8a0", "#a8d0f0", "#f8e0b0", "#d8b0e0"][i % 4], deck: false });
    sh.group.position.set(s * (24 + rnd() * 16), 3 + rnd() * 12, -10 - i * 70);
    sh.group.rotation.y = rnd() * TAU;
    c.root.add(sh.group);
    const sp = 0.6 + rnd() * 0.6;
    const ang = sh.group.rotation.y;
    c.anim.push((dt) => {
      sh.update(dt);
      sh.group.position.x += Math.sin(ang) * dt * sp;
      sh.group.position.z += Math.cos(ang) * dt * sp;
    });
  }
  // 멀리 부두들 (배경)
  for (let i = 0; i < 5; i++) {
    const s = i % 2 ? 1 : -1;
    c.slab(s * (24 + i * 3), -1 + i * 1.5, -30 - i * 55, 9, 7, { depth: 7, seed: 50 + i, solid: false });
  }
  for (let i = 0; i < 22; i++) {
    const z = 20 - i * 14;
    const side = i % 2 ? 1 : -1;
    W.addCloud(side * (10 + rnd() * 14), -10 - rnd() * 10, z - rnd() * 6, 4 + rnd() * 4, i);
  }
}

/* ---------------- 동굴 꾸밈 ---------------- */
/** 커다란 수정 기둥 (빛남) */
function crystalSpire(c, x, y, z, h = 4, { color = 0, tilt = 0.2, seed = 1 } = {}) {
  const rnd = seeded(seed);
  const d = new THREE.Group();
  const mat = color ? "crystal2" : "crystal";
  for (let i = 0; i < 5; i++) {
    const hh = h * (i === 0 ? 1 : 0.35 + rnd() * 0.4);
    const r = h * (i === 0 ? 0.16 : 0.07 + rnd() * 0.05);
    const g = new THREE.CylinderGeometry(r * 0.7, r, hh * 0.78, 6);
    g.translate(0, hh * 0.39, 0);
    const tip = new THREE.ConeGeometry(r * 0.7, hh * 0.24, 6);
    tip.translate(0, hh * 0.78 + hh * 0.12, 0);
    const a = rnd() * TAU;
    const off = i === 0 ? 0 : h * 0.18;
    const rot = [Math.cos(a) * (i === 0 ? tilt * 0.3 : tilt + rnd() * 0.3), rnd() * 3, Math.sin(a) * (i === 0 ? tilt * 0.3 : tilt + rnd() * 0.3)];
    d.add(part(g, i % 2 ? mat : color ? "crystal" : "crystal2", { pos: [x + Math.cos(a) * off, y, z + Math.sin(a) * off], rot }));
    d.add(part(tip, i % 2 ? mat : color ? "crystal" : "crystal2", { pos: [x + Math.cos(a) * off, y, z + Math.sin(a) * off], rot }));
  }
  const g = new THREE.Group();
  c.bakeInto(d, g);
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  c.root.add(g);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: color ? "#7af4ff" : "#d08aff", transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(x, y + h * 0.5, z);
  glow.scale.setScalar(h * 1.6);
  c.root.add(glow);
  return g;
}
/** 천장에 매달린 바위 덩어리 (아래로 뾰족) */
function hangingRock(c, x, y, z, s = 6, seed = 1) {
  const geo = islandGeo(s, s * 1.8, { seed, lumpy: 0.45, seg: 28 }).rock;
  geo.rotateX(Math.PI);
  shadeVerts(geo, { top: 0.5, bottom: 1.0 });
  const m = new THREE.Mesh(geo, c.M.rock);
  m.position.set(x, y, z);
  c.root.add(m);
  // 아래로 자란 작은 수정
  const d = new THREE.Group();
  const rnd = seeded(seed * 3);
  for (let i = 0; i < 4; i++) {
    const a = rnd() * TAU;
    const r = rnd() * s * 0.5;
    const hh = 0.8 + rnd() * 1.6;
    const g = new THREE.ConeGeometry(0.2 + rnd() * 0.2, hh, 6);
    g.rotateX(Math.PI);
    d.add(part(g, rnd() < 0.5 ? "crystal" : "crystal2", { pos: [x + Math.cos(a) * r, y + 0.45 + s * 0.4 * (1 - r / s) - 0.45 - hh / 2, z + Math.sin(a) * r] }));
  }
  const g = new THREE.Group();
  c.bakeInto(d, g);
  c.root.add(g);
}
/** 위에서 내려오는 빛줄기 */
function lightShaft(c, x, y, z, h = 16, r = 2.2, color = "#b8a8ff") {
  const geo = new THREE.CylinderGeometry(r * 0.6, r, h, 20, 1, true);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.position.set(x, y + h / 2, z);
  c.root.add(m);
  const t0 = Math.random() * 10;
  c.anim.push((dt, t) => (m.material.opacity = 0.08 + Math.sin(t * 0.7 + t0) * 0.03));
}

/* ================================================================
 * 4. 수정 구름 동굴 — 어두운 보랏빛 · 빛나는 수정과 버섯 · 천장 바위
 *  버섯 섬 → 나타났다 사라지는 수정 발판 → 고드름 수정 터널(빛줄기) → 통통 버섯 → 움직이는 수정
 *  → 빛줄기 정원 → 무너지는 수정 다리 → 빛 기둥 → 마지막 발판 리듬 → 동굴 출구 비행선
 * ============================================================== */
function stage4(c) {
  const W = c.world;
  c.setPath(
    [
      [0, 0, 5],
      [0, 0, -9],
      [0.8, 0.4, -12.2],
      [-0.8, 0.8, -17.5],
      [0.6, 1.2, -22.8],
      [0, 1.2, -26.5],
      [0, 1.2, -33.5],
      [0, 1.2, -36.3],
      [0, 1.2, -40.8],
      [0, 1.2, -45.3],
      [0, 1.2, -49.8],
      [0, 1.2, -53.1],
      [0, 1.2, -60.1],
      [0, 1.2, -84.1],
      [0, 1.2, -93.6],
      [0, 4.4, -100.5],
      [0, 4.4, -111.5],
      [0, 4.4, -118],
      [0, 4.8, -125.4],
      [0, 5.2, -129.9],
      [0, 5.2, -133.2],
      [0, 5.2, -157.2],
      [0, 5.2, -171.8],
      [0, 5.2, -181.2],
      [0, 5.2, -183.2],
      [0, 10.4, -185.5],
      [0, 10.4, -196.7],
      [0, 10.4, -199.4],
      [0, 10.4, -203.9],
      [0, 10.4, -208.4],
      [0, 10.4, -211.7],
      [0, 10.4, -219.7],
      [0, 10.4, -224],
    ],
    { p: V(0, 0, 5), yaw: Math.PI }
  );

  /* ---------- 1. 동굴 입구 버섯 섬 (출발) ---------- */
  {
    const isl = c.island(0, 0, 0, 9, { deco: "mushroom", depth: 13, seed: 51, flowers: 0.8 }).g;
    const d = new THREE.Group();
    // 큰 빛 버섯 세 송이 (섬 가장자리)
    for (const [x, z, s] of [
      [-5.6, 2.6, 1.3],
      [6.0, -1.0, 1.1],
      [-4.8, -5.4, 0.9],
    ]) {
      d.add(part(new THREE.CylinderGeometry(0.22 * s, 0.32 * s, 2.4 * s, 10), "stem", { pos: [x, 1.2 * s, z] }));
      const cap = new THREE.SphereGeometry(1.3 * s, 20, 10, 0, TAU, 0, Math.PI / 2);
      d.add(part(cap, "mushPink", { pos: [x, 2.3 * s, z], scale: [1, 0.55, 1] }));
    }
    // 수정 등불 길
    for (const [x, z] of [
      [-1.8, 2],
      [1.8, -2],
      [-1.8, -6],
      [1.8, -8.2],
    ]) {
      d.add(part(new THREE.CylinderGeometry(0.06, 0.08, 1.3, 6), "trunk", { pos: [x, 0.65, z] }));
      d.add(part(new THREE.OctahedronGeometry(0.2, 0), "crystal2", { pos: [x, 1.45, z] }));
    }
    c.bakeInto(d, isl);
    for (const [x, z, s] of [
      [-5.6, 2.6, 1.3],
      [6.0, -1.0, 1.1],
      [-4.8, -5.4, 0.9],
    ])
      c.disc(x, z, 0.35 * s, 2.4 * s, { noCam: true });
    for (const [x, z] of [
      [-1.8, 2],
      [1.8, -2],
      [-1.8, -6],
      [1.8, -8.2],
    ]) {
      c.box(x - 0.08, x + 0.08, 0, 1.6, z - 0.08, z + 0.08, { noCam: true });
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#7af4ff", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.position.set(x, 1.45, z);
      gl.scale.setScalar(1.3);
      c.root.add(gl);
    }
  }
  crystalSpire(c, 6.2, 0, 4.0, 4.5, { seed: 1 });
  crystalSpire(c, -6.8, 0, -1.5, 3.4, { color: 1, seed: 2 });
  rockArch(c, 0, 0, -8.6, 13, 10, 52);
  hangingRock(c, 0, 26, -10, 9, 53);

  /* ---------- 2. 빛 버섯 돌 건너기 ---------- */
  c.island(0.8, 0.4, -12.2, 1.35, { depth: 3, seed: 54, deco: "mushroom", flowers: 0.4 });
  c.island(-0.8, 0.8, -17.5, 1.35, { depth: 3, seed: 55, deco: "mushroom", flowers: 0.4 });
  c.island(0.6, 1.2, -22.8, 1.35, { depth: 3, seed: 56, deco: "mushroom", flowers: 0.4 });
  c.orbArc(V(0.3, 1.0, -9.6), V(0.8, 1.4, -11.6), 1, 2);
  c.orbArc(V(0.4, 1.8, -13.6), V(-0.6, 2.2, -16.4), 1, 2);
  c.orbArc(V(-0.4, 2.2, -18.9), V(0.4, 2.6, -21.7), 1, 2);
  c.island(0, 1.2, -30, 3.5, { depth: 6, seed: 57, deco: "crystal" });
  crystalSpire(c, -2.2, 1.2, -31.2, 2.2, { color: 1, seed: 3 });

  /* ---------- 3. 나타났다 사라지는 수정 발판 (하늘색 ↔ 분홍 번갈아) ---------- */
  const PH = { on: 3.0, off: 1.4, flicker: 0.8 };
  new PhasePad(c, 0, 1.2, -36.3, 1.3, { ...PH, phase: 0 });
  new PhasePad(c, 0, 1.2, -40.8, 1.3, { ...PH, phase: 0.5, color: "#ff9aff" });
  new PhasePad(c, 0, 1.2, -45.3, 1.3, { ...PH, phase: 0 });
  new PhasePad(c, 0, 1.2, -49.8, 1.3, { ...PH, phase: 0.5, color: "#ff9aff" });
  for (const z of [-36.3, -40.8, -45.3, -49.8]) c.orb(0, 2.2, z);
  c.orb(0, 4.6, -43, true);
  c.island(0, 1.2, -56.6, 3.5, { depth: 6, seed: 58, deco: "mushroom" });
  c.checkpoint(0, 1.2, -56.6, 1, "수정 발판 통과");
  c.pass(-53.2, "사라지는 수정 발판");

  /* ---------- 4. 고드름 수정 터널 (+ 옆에서 도는 빛줄기) ---------- */
  c.slab(0, 1.2, -72.1, 3.2, 24, { depth: 5, seed: 59, lumpy: 0.3 });
  c.slab(3.4, 1.2, -73, 4, 5, { depth: 4, seed: 60 });
  new Beam(c, 3.0, 1.2, -73, { len: 4.4, speed: 1.25, h: 0.5, arms: 1, color: "#ff5ad8" });
  for (const [x, z] of [
    [0.4, -64],
    [-0.4, -68.5],
    [0.3, -78],
    [-0.3, -82],
  ])
    new Dropper(c, x, 1.2, z, { mode: "trigger", look: "crystal", h: 7.5, trigger: 5.5, r: 0.7 });
  for (const z of [-62, -77.5, -86.5]) rockArch(c, 0, 1.2, z, 9, 7.5, 61 + Math.round(-z));
  c.orbLine(V(0, 2.1, -61), V(0, 2.1, -83), 9);
  for (let i = 0; i < 5; i++) crystalSpire(c, (i % 2 ? 1 : -1) * (3.4 + (i % 3) * 0.8), 0.9, -63 - i * 5.0, 2 + (i % 3), { color: i % 2, seed: 10 + i, tilt: 0.4 });
  c.island(0, 1.2, -90, 4, { depth: 7, seed: 62, deco: "mushroom", falls: 0 });
  c.pass(-85, "고드름 터널");

  /* ---------- 5. 통통 버섯 (위층으로) ---------- */
  c.pad(0, 1.2, -93.6, V(0, 15.5, -8.5), 1.0);
  c.orbArc(V(0, 3.2, -94.4), V(0, 5.4, -100), 3.2, 5);
  c.slab(0, 4.4, -105.5, 6, 12, { depth: 8, seed: 63, wall: 4 });
  crystalSpire(c, 2.2, 4.4, -108, 2.4, { color: 1, seed: 4 });
  c.pass(-100, "통통 버섯");

  /* ---------- 6. 움직이는 수정 + 사라지는 발판 ---------- */
  c.mover(V(0, 4.4, -115), V(0, 4.4, -121), 1.6, 5.2, 0, { look: "crystal" });
  new PhasePad(c, 0, 4.8, -125.4, 1.3, { ...PH, phase: 0 });
  new PhasePad(c, 0, 5.2, -129.9, 1.3, { ...PH, phase: 0.5, color: "#ff9aff" });
  c.orbLine(V(0, 5.4, -114), V(0, 5.4, -122), 4);
  c.orb(0, 5.8, -125.4);
  c.orb(0, 6.2, -129.9);
  c.island(0, 5.2, -136.7, 3.5, { depth: 6, seed: 64, deco: "crystal" });
  c.checkpoint(0, 5.2, -136.7, -1, "동굴 한가운데");
  c.pass(-133.3, "움직이는 수정");

  /* ---------- 7. 빛줄기 정원 ---------- */
  {
    const pl = c.slab(0, 5.2, -149.2, 9, 16, { depth: 7, seed: 65 }).g;
    const d = new THREE.Group();
    for (const [x, z] of [
      [-3.6, 6],
      [3.6, -6.5],
    ])
      c.glowShroom(d, x, z, 0.9, seeded(Math.round(z * 3 + 100)));
    c.bakeInto(d, pl);
  }
  new Beam(c, -2.2, 5.2, -145.2, { len: 3.8, speed: 1.3, h: 0.5, arms: 2, color: "#7af4ff" });
  new Beam(c, 2.2, 5.2, -152.7, { len: 3.8, speed: -1.45, h: 0.5, arms: 2, color: "#ff5ad8", phase: 1 });
  crystalSpire(c, -3.9, 5.2, -154.2, 3.2, { seed: 5 });
  crystalSpire(c, 3.9, 5.2, -142.7, 2.8, { color: 1, seed: 6 });
  c.orbLine(V(0, 6.1, -142.2), V(0, 6.1, -156.2), 7);
  c.pass(-157.2, "빛줄기 정원");

  /* ---------- 8. 무너지는 수정 다리 ---------- */
  for (let i = 0; i < 8; i++) {
    const z = -157.2 - 0.875 - i * 1.83;
    c.crumble(0, 5.2, z);
    if (i % 2 === 0) c.orb(0, 6.1, z);
  }
  new Dropper(c, 0, 5.2, -163, { mode: "trigger", look: "crystal", h: 7, trigger: 4.5, r: 0.7 });
  new Dropper(c, 0, 5.2, -169, { mode: "trigger", look: "crystal", h: 7, trigger: 4.5, r: 0.7 });
  c.island(0, 5.2, -177.2, 4, { depth: 7, seed: 66, deco: "mushroom" });
  c.checkpoint(0, 5.2, -176.7, 1, "무너지는 다리 통과");
  c.pass(-173.3, "무너지는 수정 다리");

  /* ---------- 9. 빛 기둥 (출구 층으로) ---------- */
  c.slab(0, 5.2, -182.7, 3, 3, { depth: 5, seed: 67 });
  c.vent(0, 5.2, -183.2, 1.8, 13.4, 52);
  c.orbLine(V(0, 7.2, -183.2), V(0, 11.2, -183.2), 3);
  c.slab(0, 10.4, -190.7, 8, 12, { depth: 12, seed: 68, wall: 6 });
  crystalSpire(c, -3, 10.4, -193.2, 3.0, { color: 1, seed: 7 });
  crystalSpire(c, 3.2, 10.4, -187.7, 2.4, { seed: 8 });
  c.pass(-185.6, "빛 기둥");

  /* ---------- 10. 마지막 발판 리듬 → 출구 ---------- */
  new PhasePad(c, 0, 10.4, -199.4, 1.3, { ...PH, phase: 0 });
  new PhasePad(c, 0, 10.4, -203.9, 1.3, { ...PH, phase: 0.5, color: "#ff9aff" });
  new PhasePad(c, 0, 10.4, -208.4, 1.3, { ...PH, phase: 0 });
  for (const z of [-199.4, -203.9, -208.4]) c.orb(0, 11.4, z);
  c.slab(0, 10.4, -215.7, 6, 8, { depth: 8, seed: 69 });
  c.pass(-211.8, "마지막 리듬");
  c.goalShip(0, 7.7, -229.1, 1.5, "#c8b0ff");
  // 출구: 큰 바위 아치
  rockArch(c, 0, 10.4, -221, 14, 11, 70);

  /* ---------- 동굴 천장 · 벽 · 먼 수정 ---------- */
  const rnd = seeded(404);
  for (let i = 0; i < 15; i++) {
    const z = 4 - i * 16;
    hangingRock(c, (rnd() - 0.5) * 18, 22 + rnd() * 8, z, 6 + rnd() * 5, 80 + i);
  }
  for (const s of [-1, 1]) {
    for (let z = 10; z > -250; ) {
      const l = 14 + rnd() * 14;
      const w = 6 + rnd() * 5;
      const top = 6 + rnd() * 14;
      c.slab(s * (17 + w / 2 + rnd() * 4), top, z - l / 2, w, l, { depth: top + 40, seed: Math.round(z) + s * 9, taper: 0.1, lumpy: 0.35, solid: false, top: "rock" });
      if (rnd() < 0.6) crystalSpire(c, s * (15 + rnd() * 3), top * 0.3, z - l / 2, 3 + rnd() * 3, { color: rnd() < 0.5 ? 1 : 0, seed: Math.round(-z), tilt: 0.5 });
      z -= l + (rnd() < 0.3 ? 8 : -1);
    }
  }
  for (const [x, z] of [
    [-6, -45],
    [5, -100],
    [-5, -150],
    [6, -200],
  ])
    lightShaft(c, x, -6, z, 30, 3, "#b8a8ff");
  W.farIsland(-60, 8, -80, 10, { trees: 0, falls: 1, seed: 61 });
  W.farIsland(70, 16, -170, 12, { trees: 1, falls: 1, seed: 63 });
  for (let i = 0; i < 14; i++) {
    const z = 10 - i * 18;
    const side = i % 2 ? 1 : -1;
    W.addCloud(side * (7 + rnd() * 6), -12 - rnd() * 8, z, 4 + rnd() * 3, i);
  }
}

/* ---------------- 성 꾸밈 ---------------- */
/** 성벽 길 양쪽 톱니 모양 돌 (총안) — 낮은 돌이라 막아 주지만 틈이 있다 */
function battlements(c, x, y, z0, z1, w, { both = true } = {}) {
  const d = new THREE.Group();
  const g = new THREE.Group();
  const step = 1.35;
  for (const s of both ? [-1, 1] : [1]) {
    for (let z = z0 - 0.5; z > z1 + 0.4; z -= step) {
      const bx = x + s * (w / 2 - 0.25);
      d.add(part(roundedBox(0.5, 0.75, 0.75, 0.06), "stone", { pos: [bx, y + 0.37, z], tint: 0.85 + ((z * 7) % 3) * 0.06 }));
      c.box(bx - 0.25, bx + 0.25, y, y + 0.75, z - 0.37, z + 0.37, { noCam: true });
    }
  }
  c.bakeInto(d, g);
  (c.toMerge || (c.toMerge = [])).push(g);
  c.root.add(g);
}
/** 성 탑 (원통 + 원뿔 지붕 + 불 켜진 창 + 깃발) */
function tower(c, x, y, z, r = 2.2, h = 12, { flag = true, seed = 1, roof = "#3a4a8a" } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const d = new THREE.Group();
  const body = new THREE.CylinderGeometry(r, r * 1.08, h, 18, 6);
  body.translate(0, h / 2, 0);
  d.add(part(body, "castle"));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    d.add(part(roundedBox(0.6, 0.7, 0.5, 0.05), "castle", { pos: [Math.cos(a) * r * 1.02, h + 0.35, Math.sin(a) * r * 1.02], rot: [0, -a, 0] }));
  }
  d.add(part(new THREE.ConeGeometry(r * 1.2, r * 1.8, 18), "roof", { pos: [0, h + 0.7 + r * 0.9, 0], tint: roof }));
  const rnd = seeded(seed);
  for (let i = 0; i < 5; i++) {
    const a = rnd() * TAU;
    const wy = h * (0.3 + rnd() * 0.55);
    d.add(part(new THREE.PlaneGeometry(0.4, 0.7), "window", { pos: [Math.cos(a) * (r + 0.02), wy, Math.sin(a) * (r + 0.02)], rot: [0, Math.PI / 2 - a, 0] }));
  }
  c.bakeInto(d, g);
  if (flag) {
    const f = new Flag("#c84a5a", 1.2, 0.75, 1.6);
    f.group.position.y = h + 0.7 + r * 1.8;
    f.group.userData.keep = true;
    g.add(f.group);
    c.flags.push(f);
  }
  c.root.add(g);
  return g;
}
/** 횃불 (깜빡이는 불) */
function torch(c, x, y, z) {
  const d = new THREE.Group();
  d.add(part(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), "woodDark", { pos: [x, y + 0.7, z] }));
  d.add(part(new THREE.CylinderGeometry(0.14, 0.08, 0.22, 8), "woodDark", { pos: [x, y + 1.45, z] }));
  const g = new THREE.Group();
  c.bakeInto(d, g);
  (c.toMerge || (c.toMerge = [])).push(g);
  c.root.add(g);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 8), c.M.lantern);
  fire.position.set(x, y + 1.72, z);
  c.root.add(fire);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffa04a", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(x, y + 1.75, z);
  glow.scale.setScalar(1.8);
  c.root.add(glow);
  const t0 = Math.random() * 10;
  c.anim.push((dt, t) => {
    fire.scale.set(1 + Math.sin(t * 17 + t0) * 0.15, 1 + Math.sin(t * 23 + t0) * 0.25, 1);
    glow.material.opacity = 0.5 + Math.sin(t * 13 + t0) * 0.12;
  });
  c.box(x - 0.08, x + 0.08, y, y + 1.6, z - 0.08, z + 0.08, { noCam: true });
}
/** 기사 석상 */
function knight(d, x, y, z, ry = 0, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  g.add(part(roundedBox(1.0 * s, 0.6 * s, 1.0 * s, 0.06), "stone", { pos: [0, 0.3 * s, 0] }));
  g.add(part(new THREE.CapsuleGeometry(0.32 * s, 0.9 * s, 4, 10), "stone", { pos: [0, 1.35 * s, 0] }));
  g.add(part(new THREE.SphereGeometry(0.3 * s, 14, 10), "stone", { pos: [0, 2.15 * s, 0] }));
  g.add(part(roundedBox(0.5 * s, 0.1 * s, 0.12 * s, 0.03), "stone", { pos: [0, 2.15 * s, 0.24 * s], tint: 0.6 }));
  g.add(part(roundedBox(0.1 * s, 1.6 * s, 0.1 * s, 0.03), "stone", { pos: [0.45 * s, 1.3 * s, 0.25 * s], rot: [0.1, 0, 0.05], tint: 1.1 }));
  g.add(part(roundedBox(0.5 * s, 0.08 * s, 0.1 * s, 0.03), "stone", { pos: [0.45 * s, 1.75 * s, 0.25 * s], tint: 1.1 }));
  d.add(g);
}
/** 젖은 미끄러운 판자 다리 (윗면 반짝 · 밟으면 미끄러짐) */
function wetBridge(c, x, y, z0, z1, w = 3) {
  const g = new THREE.Group();
  const d = new THREE.Group();
  const len = Math.abs(z1 - z0);
  const n = Math.round(len / 0.6);
  const rnd = seeded(Math.round(-z0 * 5));
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * (i + 0.5)) / n;
    d.add(part(roundedBox(w, 0.14, (len / n) * 0.9, 0.03), "wood", { pos: [x, y - 0.07, z], rot: [0, (rnd() - 0.5) * 0.04, 0], tint: 0.75 + rnd() * 0.2 }));
  }
  for (const s of [-1, 1]) d.add(part(roundedBox(0.16, 0.2, len, 0.04), "woodDark", { pos: [x + s * (w / 2 - 0.1), y - 0.2, (z0 + z1) / 2] }));
  d.add(part(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V(x, y - 0.3, z0), V(x, y - 1.6, (z0 + z1) / 2), V(x, y - 0.3, z1)), 16, 0.06, 5), "rope"));
  const geos = bake(d, { ao: 0.3, height: 1, base: y - 0.4 });
  const wet = c.M.wood.clone();
  wet.roughness = 0.22;
  wet.metalness = 0.1;
  wet.color.set("#b8b8d8");
  c.ownMats.push(wet);
  for (const [mat, geo] of Object.entries(geos)) {
    const m = new THREE.Mesh(geo, mat === "wood" ? wet : c.M[mat]);
    m.receiveShadow = true;
    m.castShadow = true;
    g.add(m);
  }
  // 물웅덩이 반짝임
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.35 + rnd() * 0.3, 16), new THREE.MeshStandardMaterial({ color: "#a8c0ff", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.5 }));
    p.rotation.x = -Math.PI / 2;
    p.position.set(x + (rnd() - 0.5) * (w - 0.8), y + 0.012, z0 + (z1 - z0) * (0.15 + i * 0.22));
    g.add(p);
  }
  c.root.add(g);
  return c.box(x - w / 2, x + w / 2, y - 0.25, y, Math.min(z0, z1), Math.max(z0, z1), { slip: true });
}
/** 돌 아치 (쇠사슬을 매다는 곳) */
function stoneArch(c, x, y, z, w = 7, h = 9) {
  const d = new THREE.Group();
  for (const s of [-1, 1]) d.add(part(roundedBox(1.1, h, 1.1, 0.1), "castle", { pos: [x + (s * w) / 2, y + h / 2 - 6, z] }));
  d.add(part(roundedBox(w + 1.6, 1.0, 1.2, 0.12), "castle", { pos: [x, y + h - 6 + 0.5, z] }));
  const g = new THREE.Group();
  c.bakeInto(d, g);
  c.root.add(g);
}

/* ================================================================
 * 5. 폭풍의 하늘성 — 밤 · 비 · 번개 · 돌 성벽과 탑
 *  성문 마당 → 번개 성벽 → 톱니바퀴 → 가시 복도 → 젖은 판자(번갈아 바람) → 쇠사슬 그네
 *  → 탑 돌계단 → 번개 높은 성벽 → 무너지는 성벽 → 톱니+가시 관문 → 성 꼭대기 비행선
 * ============================================================== */
function stage5(c) {
  const W = c.world;
  c.setPath(
    [
      [0, 0, 5.5],
      [0, 0, -8],
      [0, 0, -28],
      [0, 0, -32.5],
      [0, 0.4, -39],
      [0, 0.8, -45.5],
      [0, 0.8, -50],
      [0, 0.8, -58],
      [0, 0.8, -74],
      [0, 0.8, -90],
      [0, 0.8, -101],
      [0, 1.6, -106.5],
      [0, 1.6, -115.5],
      [0, 0.8, -120.3],
      [0, 0.8, -131.7],
      [0, 1.8, -134],
      [1.4, 2.8, -138],
      [-1.2, 3.8, -142],
      [1.0, 4.8, -146],
      [0, 5.8, -149],
      [0, 5.8, -165],
      [0, 5.8, -180.6],
      [0, 5.8, -190.6],
      [0, 5.8, -195.5],
      [0, 5.8, -200],
      [0, 5.8, -210],
      [0, 5.8, -222],
      [0, 5.8, -227],
    ],
    { p: V(0, 0, 5.5), yaw: Math.PI }
  );

  /* ---------- 1. 성문 마당 (출발) ---------- */
  const yard = c.slab(0, 0, 0, 14, 16, { depth: 10, seed: 71 }).g;
  {
    const d = new THREE.Group();
    knight(d, -3.2, 0, -6.4, 0.3, 1.1);
    knight(d, 3.2, 0, -6.4, -0.3, 1.1);
    crates(d, 5.4, 0, 5.0, 3, 0.7, 41);
    barrel(d, -5.4, 0, 5.6);
    barrel(d, -4.8, 0, 6.2);
    c.bakeInto(d, yard);
    for (const s of [-1, 1]) c.box(s * 3.2 - 0.55, s * 3.2 + 0.55, 0, 2.6, -6.95, -5.85, { noCam: true });
  }
  // 성문 (들어 올린 쇠살문)
  {
    const d = new THREE.Group();
    for (const s of [-1, 1]) d.add(part(roundedBox(2.2, 7, 2.2, 0.1), "castle", { pos: [s * 3.4, 3.5, -8.4] }));
    d.add(part(roundedBox(9, 1.6, 2.4, 0.12), "castle", { pos: [0, 6.6, -8.4] }));
    for (let i = 0; i < 7; i++) d.add(part(roundedBox(0.12, 1.4, 0.12, 0.03), "woodDark", { pos: [-1.8 + i * 0.6, 5.4, -8.4] }));
    d.add(part(roundedBox(4.2, 0.14, 0.14, 0.03), "woodDark", { pos: [0, 4.8, -8.4] }));
    const g = new THREE.Group();
    c.bakeInto(d, g);
    c.root.add(g);
    for (const s of [-1, 1]) c.box(s * 3.4 - 1.1, s * 3.4 + 1.1, 0, 7, -9.5, -7.3);
  }
  torch(c, -2.0, 0, -6.8);
  torch(c, 2.0, 0, -6.8);
  tower(c, -6.5, 0, -3, 1.6, 9, { seed: 1 });
  tower(c, 6.5, 0, 3, 1.6, 8, { seed: 2 });
  c.disc(-6.5, -3, 1.6, 9, { noCam: true });
  c.disc(6.5, 3, 1.6, 8, { noCam: true });

  /* ---------- 2. 번개 성벽 ---------- */
  c.slab(0, 0, -18, 3.4, 20, { depth: 8, seed: 72, top: "grass", side: "rock" });
  battlements(c, 0, 0, -8, -28, 3.4);
  new Lightning(c, [
    [0, 0, -12.5],
    [0, 0, -17.5],
    [0, 0, -22.5],
  ], { r: 1.45, period: 3.0, warn: 1.2, offsets: [0, 0.33, 0.66] });
  c.orbLine(V(0, 0.9, -9.5), V(0, 0.9, -26.5), 7);
  c.pass(-28, "번개 성벽");

  /* ---------- 3. 톱니바퀴 ---------- */
  new Turntable(c, 0, 0, -32.5, 2.4, 1.0, { look: "gear" });
  new Turntable(c, 0, 0.4, -39, 2.4, -1.2, { look: "gear" });
  new Turntable(c, 0, 0.8, -45.5, 2.4, 1.3, { look: "gear" });
  c.orb(0, 1.0, -32.5);
  c.orb(0, 1.4, -39);
  c.orb(0, 3.4, -39, true);
  c.orb(0, 1.8, -45.5);
  {
    const t1 = c.slab(0, 0.8, -54, 7, 8, { depth: 9, seed: 73 }).g;
    const d = new THREE.Group();
    knight(d, -2.6, 0, -2.6, 0.5, 0.9);
    c.bakeInto(d, t1);
    c.box(-3.1, -2.1, 0.8, 3.0, -57.1, -56.1, { noCam: true });
  }
  torch(c, 2.8, 0.8, -51);
  c.checkpoint(0, 0.8, -54, 1, "톱니바퀴 통과");
  c.pass(-50.5, "톱니바퀴");

  /* ---------- 4. 가시 복도 ---------- */
  c.slab(0, 0.8, -66, 3.4, 16, { depth: 7, seed: 74 });
  battlements(c, 0, 0.8, -58, -74, 3.4);
  new Spikes(c, 0, 0.8, -61.2, 2.3, 2.0, { up: 1.1, down: 1.9, warn: 0.6, phase: 0 });
  new Spikes(c, 0, 0.8, -66, 2.3, 2.0, { up: 1.1, down: 1.9, warn: 0.6, phase: 0.36 });
  new Spikes(c, 0, 0.8, -70.8, 2.3, 2.0, { up: 1.1, down: 1.9, warn: 0.6, phase: 0.72 });
  c.orbLine(V(0, 1.7, -59), V(0, 1.7, -73), 6);
  c.pass(-74, "가시 복도");

  /* ---------- 5. 젖은 판자 + 번갈아 부는 바람 ---------- */
  wetBridge(c, 0, 0.8, -74, -91, 3.0);
  new WindZone(c, { x0: -3, x1: 3, z0: -91, z1: -74, y0: 0.4, y1: 5 }, V(1, 0, 0), { strength: 1.9, on: 1.6, off: 2.4, warn: 0.8, phase: 0 });
  new WindZone(c, { x0: -3, x1: 3, z0: -91, z1: -74, y0: 0.4, y1: 5 }, V(-1, 0, 0), { strength: 1.9, on: 1.6, off: 2.4, warn: 0.8, phase: 0.5 });
  c.orbLine(V(0, 1.7, -75.5), V(0, 1.7, -89.5), 6);
  {
    const t2 = c.slab(0, 0.8, -96, 7, 10, { depth: 9, seed: 75 }).g;
    const d = new THREE.Group();
    barrel(d, 2.6, 0, 3.0);
    c.bakeInto(d, t2);
  }
  torch(c, -2.8, 0.8, -93);
  c.pass(-91, "젖은 판자");

  /* ---------- 6. 쇠사슬 그네 (돌 아치에 매달림 · 엇갈려 가까워질 때) ---------- */
  stoneArch(c, 0, 8.3, -106.5, 7, 9);
  stoneArch(c, 0, 8.3, -115.5, 7, 9);
  new Swing(c, 0, 8.3, -106.5, 7, { axis: "z", amp: 0.45, period: 4.4, phase: 0, w: 2.4, l: 2.4, look: "cage", crane: false });
  new Swing(c, 0, 8.3, -115.5, 7, { axis: "z", amp: 0.45, period: 4.4, phase: 0.5, w: 2.4, l: 2.4, look: "cage", crane: false });
  c.orb(0, 2.6, -106.5);
  c.orb(0, 2.6, -115.5);
  {
    const t3 = c.slab(0, 0.8, -126, 8, 11.4, { depth: 9, seed: 76 }).g;
    const d = new THREE.Group();
    knight(d, 3.0, 0, 2.4, -0.6, 0.9);
    c.bakeInto(d, t3);
    c.box(2.5, 3.5, 0.8, 3.0, -124.1, -123.1, { noCam: true });
  }
  c.checkpoint(0, 0.8, -126, -1, "쇠사슬 그네 통과");
  c.pass(-120.5, "쇠사슬 그네");

  /* ---------- 7. 탑 돌계단 → 번개 높은 성벽 ---------- */
  const steps = [
    [0, 1.8, -134],
    [1.4, 2.8, -138],
    [-1.2, 3.8, -142],
    [1.0, 4.8, -146],
  ];
  steps.forEach(([x, y, z], i) => {
    c.slab(x, y, z, 2.4, 2.4, { depth: 2.5 + i * 0.4, seed: 77 + i, taper: 0.3 });
    c.orb(x, y + 1.0, z);
  });
  tower(c, 5.2, -6, -141, 2.6, 16, { seed: 3 });
  c.disc(5.2, -141, 2.6, 10, { noCam: true });
  c.slab(0, 5.8, -157, 3.2, 16, { depth: 9, seed: 81 });
  battlements(c, 0, 5.8, -149, -165, 3.2);
  new Lightning(c, [
    [0, 5.8, -152.5],
    [0, 5.8, -157],
    [0, 5.8, -161.5],
  ], { r: 1.45, period: 2.8, warn: 1.15, offsets: [0.66, 0.33, 0] });
  c.orbLine(V(0, 6.7, -150), V(0, 6.7, -164), 6);
  c.pass(-165, "번개 높은 성벽");

  /* ---------- 8. 무너지는 성벽 ---------- */
  for (let i = 0; i < 8; i++) {
    const z = -165 - 0.875 - i * 1.83;
    c.crumble(0, 5.8, z);
    if (i % 2 === 0) c.orb(0, 6.7, z);
  }
  new WindZone(c, { x0: -3, x1: 3, z0: -180, z1: -165, y0: 5, y1: 10 }, V(1, 0, 0), { strength: 1.6, on: 1.4, off: 2.6, warn: 0.8, phase: 0.3 });
  {
    const t4 = c.slab(0, 5.8, -185.6, 7, 10, { depth: 10, seed: 82 }).g;
    const d = new THREE.Group();
    crates(d, -2.6, 0, -3.0, 2, 0.6, 43);
    c.bakeInto(d, t4);
  }
  torch(c, 2.8, 5.8, -182);
  c.checkpoint(0, 5.8, -185.6, 1, "무너지는 성벽 통과");
  c.pass(-180.5, "무너지는 성벽");

  /* ---------- 9. 톱니 + 가시 관문 → 성 꼭대기 ---------- */
  new Turntable(c, 0, 5.8, -195.5, 2.4, -1.4, { look: "gear" });
  c.slab(0, 5.8, -205, 3.2, 10, { depth: 8, seed: 83 });
  battlements(c, 0, 5.8, -200, -210, 3.2);
  new Spikes(c, 0, 5.8, -203, 2.2, 2.0, { up: 1.0, down: 2.0, warn: 0.6, phase: 0 });
  new Spikes(c, 0, 5.8, -207.2, 2.2, 2.0, { up: 1.0, down: 2.0, warn: 0.6, phase: 0.45 });
  c.orb(0, 6.8, -195.5);
  c.orbLine(V(0, 6.7, -201), V(0, 6.7, -209), 4);
  {
    const top = c.slab(0, 5.8, -216, 9, 12, { depth: 12, seed: 84 }).g;
    const d = new THREE.Group();
    knight(d, -3.4, 0, -4.2, 0.4, 1.0);
    knight(d, 3.4, 0, -4.2, -0.4, 1.0);
    c.bakeInto(d, top);
    for (const s of [-1, 1]) c.box(s * 3.4 - 0.5, s * 3.4 + 0.5, 5.8, 8.2, -220.7, -219.7, { noCam: true });
  }
  torch(c, -1.6, 5.8, -221.4);
  torch(c, 1.6, 5.8, -221.4);
  c.pass(-210.5, "마지막 관문");
  c.goalShip(0, 3.1, -231.4, 1.5, "#d8d0f0");

  /* ---------- 배경: 큰 성 · 탑 · 먹구름 ---------- */
  const rnd = seeded(505);
  // 성 본관 (멀리 · 길 왼쪽 위로 우뚝)
  {
    const d = new THREE.Group();
    const g = new THREE.Group();
    g.position.set(-38, -4, -150);
    d.add(part(roundedBox(22, 18, 30, 0.4), "castle", { pos: [0, 9, 0] }));
    for (let i = 0; i < 8; i++) d.add(part(roundedBox(1.6, 1.4, 1.6, 0.1), "castle", { pos: [-10 + i * 2.9, 18.7, 15.2] }));
    c.bakeInto(d, g);
    c.root.add(g);
    for (const [x, z, r, h] of [
      [-28, -130, 3.6, 30],
      [-48, -138, 3.0, 26],
      [-30, -168, 3.2, 28],
      [-46, -170, 4.2, 36],
    ])
      tower(c, x, -4, z, r, h, { seed: Math.round(-z) });
  }
  for (let i = 0; i < 9; i++) {
    const s = i % 2 ? 1 : -1;
    tower(c, s * (14 + rnd() * 10), -14 + rnd() * 6, 10 - i * 28, 1.6 + rnd() * 1.4, 12 + rnd() * 10, { seed: 90 + i, flag: rnd() < 0.6 });
  }
  W.farIsland(70, 10, -110, 13, { trees: 1, castle: true, falls: 1, seed: 71 });
  W.farIsland(-90, 20, -260, 14, { trees: 1, castle: true, falls: 1, seed: 73 });
  // 먹구름: 길 아래 · 멀리 (길과 카메라를 가리지 않게)
  for (let i = 0; i < 16; i++) {
    const z = 20 - i * 16;
    const side = i % 2 ? 1 : -1;
    W.addCloud(side * (16 + rnd() * 12), -16 - rnd() * 8, z - rnd() * 6, 4 + rnd() * 3, i);
  }
}

/* ---------------- 용의 성 꾸밈 ---------------- */
/** 용 석상 (받침 + 웅크린 몸 + 머리 + 뿔 · 눈이 빛남) */
function dragonStatue(c, x, y, z, ry = 0, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const d = new THREE.Group();
  d.add(part(roundedBox(2.4 * s, 1.0 * s, 2.4 * s, 0.1), "stone", { pos: [0, 0.5 * s, 0], tint: 0.8 }));
  d.add(part(new THREE.SphereGeometry(1.0 * s, 18, 12), "stone", { pos: [0, 1.7 * s, -0.2 * s], scale: [0.9, 0.8, 1.2] }));
  d.add(part(taperTube([V(0, 2.0 * s, 0.4 * s), V(0, 2.9 * s, 0.7 * s), V(0, 3.4 * s, 1.0 * s)], (t) => 0.42 * s * (1 - t * 0.35), 10, 10), "stone"));
  d.add(part(roundedBox(0.8 * s, 0.6 * s, 1.2 * s, 0.2 * s), "stone", { pos: [0, 3.55 * s, 1.35 * s] }));
  for (const k of [-1, 1]) {
    d.add(part(taperTube([V(k * 0.3 * s, 3.8 * s, 1.1 * s), V(k * 0.5 * s, 4.3 * s, 0.6 * s), V(k * 0.55 * s, 4.5 * s, 0.1 * s)], (t) => 0.1 * s * (1 - t * 0.8), 8, 6), "brass"));
    // 접힌 날개
    const wing = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(k * 1.4 * s, 1.4 * s, -0.8 * s), V(k * 0.4 * s, -0.2 * s, -1.4 * s), V(0, 0, 0), V(k * 1.4 * s, 1.4 * s, -0.8 * s), V(k * 1.5 * s, 0.2 * s, -1.2 * s)]);
    wing.computeVertexNormals();
    d.add(part(wing, "stone", { pos: [k * 0.6 * s, 2.0 * s, -0.2 * s], tint: 0.75 }));
  }
  d.add(part(taperTube([V(0, 1.2 * s, -1.2 * s), V(0.8 * s, 1.0 * s, -1.9 * s), V(1.3 * s, 1.1 * s, -1.2 * s)], (t) => 0.3 * s * (1 - t * 0.85), 12, 8), "stone"));
  c.bakeInto(d, g);
  for (const k of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), c.M.lantern);
    e.position.set(k * 0.28 * s, 3.7 * s, 1.85 * s);
    g.add(e);
  }
  c.root.add(g);
  return g;
}
/** 불 그릇 (화로) */
function brazier(c, x, y, z) {
  const d = new THREE.Group();
  d.add(part(new THREE.CylinderGeometry(0.12, 0.2, 1.1, 8), "stone", { pos: [x, y + 0.55, z] }));
  d.add(part(new THREE.CylinderGeometry(0.55, 0.3, 0.35, 12), "brass", { pos: [x, y + 1.25, z] }));
  const g = new THREE.Group();
  c.bakeInto(d, g);
  (c.toMerge || (c.toMerge = [])).push(g);
  c.root.add(g);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 10), c.M.lantern);
  fire.position.set(x, y + 1.8, z);
  c.root.add(fire);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff8a3a", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(x, y + 1.9, z);
  glow.scale.setScalar(3.2);
  c.root.add(glow);
  const t0 = x * 3 + z;
  c.anim.push((dt, t) => {
    fire.scale.set(1 + Math.sin(t * 15 + t0) * 0.12, 1 + Math.sin(t * 21 + t0) * 0.22, 1 + Math.cos(t * 13 + t0) * 0.12);
    glow.material.opacity = 0.6 + Math.sin(t * 11 + t0) * 0.12;
  });
  c.disc(x, z, 0.55, y + 1.4, { noCam: true });
}
/** 용암 폭포 · 용암 바다 (빛나고 흐름) */
function lavaFall(c, x, y, z, w = 3, h = 30, ry = 0) {
  const t = lavaTex().clone();
  t.needsUpdate = true;
  t.repeat.set(w / 4, h / 8);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), new THREE.MeshBasicMaterial({ map: t, color: "#ffb070", fog: true }));
  m.position.set(x, y - h / 2, z);
  m.rotation.y = ry;
  c.root.add(m);
  c.anim.push((dt) => (t.offset.y += dt * 0.35));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(x, y - 1, z);
  glow.scale.setScalar(w * 2.5);
  c.root.add(glow);
}
function lavaSea(c, y, z0, z1) {
  const t = lavaTex().clone();
  t.needsUpdate = true;
  t.repeat.set(30, Math.abs(z1 - z0) / 12);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(400, Math.abs(z1 - z0) + 200), new THREE.MeshBasicMaterial({ map: t, color: "#ff9a5a" }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, y, (z0 + z1) / 2);
  m.userData.noCull = true;
  c.root.add(m);
  c.anim.push((dt) => {
    t.offset.x += dt * 0.004;
    t.offset.y += dt * 0.01;
  });
}

/* ================================================================
 * 6. 고대 용의 성 — 붉은 저녁 · 현무암과 용암 · 용 석상
 *  용의 다리(용머리 포탑) → 주황 수정 발판 → 톱니 + 가시 → 추격 다리(용이 옆에서 불덩이)
 *  → 최종 결전 아레나(고대 기계 용) → 성문 열림 → 무너지는 성에서 비행선으로 탈출
 * ============================================================== */
function stage6(c) {
  const W = c.world;
  const AY = 0.8;
  c.setPath(
    [
      [0, 0, 5.5],
      [0, 0, -8],
      [0, 0, -26],
      [0, 0, -28.6],
      [0, 0, -33.1],
      [0, 0, -37.6],
      [0, 0, -41],
      [0, 0, -51],
      [0, 0.4, -55.5],
      [0, 0.8, -62],
      [0, 0.8, -66],
      [0, 0.8, -80],
      [0, 0.8, -150],
      [0, 0.8, -161],
      [0, AY, -174],
      [12.6, AY, -174],
      [16.5, AY, -175.8],
      [16.5, AY, -211],
      [16.5, AY, -221.5],
      [16.5, AY, -226],
    ],
    { p: V(0, 0, 5.5), yaw: Math.PI }
  );

  /* ---------- 1. 용의 다리 입구 (출발) ---------- */
  const gate = c.slab(0, 0, 0, 14, 16, { depth: 12, seed: 91 }).g;
  {
    const d = new THREE.Group();
    crates(d, 5.2, 0, 5.6, 2, 0.6, 51);
    c.bakeInto(d, gate);
  }
  dragonStatue(c, -4.6, 0, -4.5, 0.25, 1.15);
  dragonStatue(c, 4.6, 0, -4.5, -0.25, 1.15);
  for (const s of [-1, 1]) c.box(s * 4.6 - 1.4, s * 4.6 + 1.4, 0, 4.4, -5.9, -3.1, { noCam: true });
  brazier(c, -2.2, 0, -7.4);
  brazier(c, 2.2, 0, -7.4);
  for (const s of [-1, 1]) {
    const f = new Flag(s > 0 ? "#c83a3a" : "#e8a83a", 1.3, 0.85, 3.6);
    f.group.position.set(s * 6.2, 0, 3.0);
    f.group.userData.keep = true;
    gate.add(f.group);
    c.flags.push(f);
    c.box(s * 6.2 - 0.07, s * 6.2 + 0.07, 0, 3.6, 2.93, 3.07, { noCam: true });
  }

  /* ---------- 2. 용머리 포탑 다리 ---------- */
  c.slab(0, 0, -17, 3.4, 18, { depth: 8, seed: 92 });
  new Cannon(c, 7.6, 0, -13, V(-1, 0, 0), { look: "dragon", period: 3.4, phase: 0, range: 16, speed: 10, floorY: 0 });
  new Cannon(c, -7.6, 0, -21, V(1, 0, 0), { look: "dragon", period: 3.4, phase: 0.5, range: 16, speed: 10, floorY: 0 });
  c.orbLine(V(0, 0.9, -9.5), V(0, 0.9, -25), 7);
  c.pass(-26, "용머리 포탑");

  /* ---------- 3. 주황 수정 발판 ---------- */
  const PH = { on: 3.0, off: 1.4, flicker: 0.8 };
  new PhasePad(c, 0, 0, -28.6, 1.3, { ...PH, phase: 0, color: "#ffb04a" });
  new PhasePad(c, 0, 0, -33.1, 1.3, { ...PH, phase: 0.5, color: "#ff6a4a" });
  new PhasePad(c, 0, 0, -37.6, 1.3, { ...PH, phase: 0, color: "#ffb04a" });
  for (const z of [-28.6, -33.1, -37.6]) c.orb(0, 1.0, z);
  {
    const p1 = c.slab(0, 0, -46, 7, 10, { depth: 10, seed: 93 }).g;
    const d = new THREE.Group();
    crates(d, -2.6, 0, 3.0, 2, 0.6, 52);
    c.bakeInto(d, p1);
  }
  brazier(c, 2.6, 0, -43);
  c.checkpoint(0, 0, -46, -1, "용의 성 입구");
  c.pass(-41, "주황 수정 발판");

  /* ---------- 4. 톱니바퀴 + 가시 ---------- */
  new Turntable(c, 0, 0.4, -55.5, 2.4, 1.2, { look: "gear" });
  new Turntable(c, 0, 0.8, -62, 2.4, -1.4, { look: "gear" });
  c.slab(0, 0.8, -73, 3.4, 14, { depth: 8, seed: 94 });
  new Spikes(c, 0, 0.8, -70, 2.3, 2.0, { up: 1.0, down: 1.9, warn: 0.6, phase: 0 });
  new Spikes(c, 0, 0.8, -76, 2.3, 2.0, { up: 1.0, down: 1.9, warn: 0.6, phase: 0.5 });
  c.orb(0, 1.4, -55.5);
  c.orb(0, 1.8, -62);
  c.orb(0, 3.8, -62, true);
  c.orbLine(V(0, 1.7, -67), V(0, 1.7, -79), 5);
  c.pass(-80, "톱니와 가시");

  /* ---------- 5. 추격 다리 (용이 옆에서 날며 불덩이) ---------- */
  c.slab(0, 0.8, -91, 3.6, 22, { depth: 7, seed: 95 });
  c.slab(0, 0.8, -115, 3.6, 22, { depth: 7, seed: 96 });
  c.slab(0, 0.8, -139, 3.6, 22, { depth: 7, seed: 97 });
  {
    // 다리 끝마다 돌기둥 (불 그릇)
    const d = new THREE.Group();
    for (const z of [-80.5, -101.5, -104.5, -125.5, -128.5, -149.5]) {
      for (const s of [-1, 1]) {
        d.add(part(roundedBox(0.5, 1.6, 0.5, 0.08), "stone", { pos: [s * 1.55, 0.8 + 0.8, z] }));
        c.box(s * 1.55 - 0.25, s * 1.55 + 0.25, 0.8, 2.4, z - 0.25, z + 0.25, { noCam: true });
      }
    }
    const g = new THREE.Group();
    c.bakeInto(d, g);
    c.root.add(g);
  }
  c.orbLine(V(0, 1.7, -82), V(0, 1.7, -101), 6);
  c.orbArc(V(0, 1.7, -101.5), V(0, 1.7, -104.5), 1.6, 2);
  c.orbLine(V(0, 1.7, -106), V(0, 1.7, -125), 6);
  c.orbArc(V(0, 1.7, -125.5), V(0, 1.7, -128.5), 1.6, 2);
  c.orbLine(V(0, 1.7, -130), V(0, 1.7, -149), 6);
  c.pass(-150, "추격 다리");

  /* ---------- 6. 결전 직전 · 아레나 ---------- */
  {
    const ap = c.slab(0, AY, -156, 8, 10, { depth: 10, seed: 98 }).g;
    const d = new THREE.Group();
    crates(d, 3.0, 0, 3.4, 2, 0.6, 53);
    c.bakeInto(d, ap);
  }
  brazier(c, -3.0, AY, -159.4);
  brazier(c, 3.0, AY, -159.4);
  c.checkpoint(0, AY, -155.5, 1, "최종 결전 직전");
  const arena = c.island(0, AY, -174, 12.5, { deco: "bare", depth: 16, seed: 99, flowers: 0, rim: false }).g;
  {
    // 바닥 마법진 (빛나는 고리)
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.0, 64), new THREE.MeshBasicMaterial({ color: "#ff8a3a", transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, AY + 0.03, -174);
    c.root.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(9.3, 9.5, 64), ring.material);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.set(0, AY + 0.03, -174);
    c.root.add(ring2);
    // 가장자리 부서진 돌기둥 (용이 있는 먼 쪽 · 출구(오른쪽)는 비움)
    const d = new THREE.Group();
    for (const a of [-2.5, -2.0, -1.2, -0.6, 0.6, 1.2, 2.4]) {
      const x = Math.sin(a) * 11.6;
      const z = Math.cos(a) * 11.6;
      const h = 1.6 + ((a * 7) % 3 + 3) % 3 * 0.8;
      d.add(part(roundedBox(0.9, h, 0.9, 0.1), "stone", { pos: [x, h / 2, z], rot: [0, a, (a % 2) * 0.05] }));
      c.box(x - 0.45, x + 0.45, AY, AY + h, -174 + z - 0.45, -174 + z + 0.45, { noCam: true });
    }
    c.bakeInto(d, arena);
  }
  {
    // 아레나 가까운 쪽 낮은 돌담 (떨어지지 않게 · 입구와 오른쪽 출구는 비움)
    const d = new THREE.Group();
    const r = 12.5 - 0.45;
    for (let a = -2.15; a <= 2.15; a += 0.075) {
      if (Math.abs(a) < 0.38 || (a > 1.22 && a < 1.92)) continue;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      // 군데군데 무너진 자리 (보이는 돌이 없는 곳은 막지도 않는다)
      if (Math.round(a * 40) % 9 === 0) continue;
      d.add(part(roundedBox(0.75, 0.75, 0.75, 0.08), "stone", { pos: [x, 0.37, z], rot: [0, a, 0], tint: 0.8 + ((a * 13) % 1) * 0.2 }));
      c.box(x - 0.4, x + 0.4, AY, AY + 0.75, -174 + z - 0.4, -174 + z + 0.4, { noCam: true });
    }
    c.bakeInto(d, arena);
  }
  brazier(c, -8.4, AY, -165.2);
  brazier(c, 8.0, AY, -164.8);
  const exitGate = new EnergyGate(c, 12.9, AY, -174, 3.4, { axis: "z" });
  new MechaDragon(c, {
    arena: { x: 0, y: AY, z: -174, r: 12.5 },
    chase: { z0: -82, z1: -146, x: 13, y: 7.5, laneX: 0, floorY: () => 0.8 },
    gate: exitGate,
  });
  c.pass(-162, "아레나 입장");

  /* ---------- 7. 무너지는 성에서 탈출 → 비행선 ---------- */
  c.slab(15.6, AY, -174, 6.2, 3.6, { depth: 8, seed: 100 });
  c.buildCollapse(AY, -175.8, 22, { x0: 16.5, armed: false });
  c.orbLine(V(16.5, 1.7, -178), V(16.5, 1.7, -209), 10);
  c.slab(16.5, AY, -216.5, 6, 10, { depth: 10, seed: 101 });
  c.goalShip(16.5, AY - 2.7, -230.9, 1.6, "#ffd86a");

  /* ---------- 배경: 용의 성 · 용암 · 떠다니는 현무암 ---------- */
  lavaSea(c, -34, 40, -300);
  lavaFall(c, -9, -2, -30, 3.2, 34);
  lavaFall(c, 10.5, 0, -100, 2.6, 36);
  lavaFall(c, -10, 0, -190, 3.4, 38);
  {
    // 성 본관 (아레나 너머 멀리 · 붉은 지붕 탑들)
    const d = new THREE.Group();
    const g = new THREE.Group();
    g.position.set(0, -8, -262);
    d.add(part(roundedBox(40, 26, 18, 0.5), "castle", { pos: [0, 13, 0] }));
    for (let i = 0; i < 10; i++) d.add(part(roundedBox(2.2, 2, 2.2, 0.15), "castle", { pos: [-18 + i * 4, 27, 9] }));
    c.bakeInto(d, g);
    c.root.add(g);
    for (const [x, z, r, h] of [
      [-22, -255, 4.2, 40],
      [22, -255, 4.2, 40],
      [-10, -268, 3.4, 48],
      [10, -268, 3.4, 48],
      [0, -272, 5, 60],
    ])
      tower(c, x, -8, z, r, h, { seed: Math.round(-z + x), roof: "#c84a3a" });
  }
  const rnd = seeded(606);
  for (let i = 0; i < 8; i++) {
    const s = i % 2 ? 1 : -1;
    W.farIsland(s * (40 + rnd() * 40), -6 + rnd() * 24, 20 - i * 36, 6 + rnd() * 8, { trees: 0, falls: 0, seed: 100 + i });
  }
  for (let i = 0; i < 12; i++) {
    const z = 20 - i * 22;
    const side = i % 2 ? 1 : -1;
    W.addCloud(side * (18 + rnd() * 14), -14 - rnd() * 6, z, 4 + rnd() * 3, i);
  }
}

/* ================================================================
 * 스테이지 목록 (순서 = 잠금 해제 순서)
 *  theme: world.js THEMES · music: audio.js MUSIC · par: 이 시간보다 빠르면 시간 보너스
 *  hints: 그 z 를 지날 때 한 번 보여 주는 안내 (키보드 / 터치)
 * ============================================================== */
const H = (z, key, touch = key) => ({ z, key, touch });
export const STAGES = [
  {
    id: 1,
    name: "구름 마을",
    en: "CLOUD VILLAGE",
    theme: "sunset",
    music: "play",
    par: 240,
    intro: "무너지기 전에 비행선까지 달려요",
    colors: ["#ffb08a", "#9a8ae2"],
    collapseText: "섬이 무너진다!",
    build: stage1,
    hints: [
      H(3, "WASD · 방향키로 달려요!", "왼쪽 화면을 누르고 밀어서 달려요!"),
      H(-19.5, "Space 로 통나무를 뛰어넘어요", "점프 버튼으로 통나무를 뛰어넘어요"),
      H(-46, "작은 발판을 하나씩 콩콩!"),
      H(-70, "발판이 가까이 왔을 때 뛰어요"),
      H(-99.5, "금 간 돌다리! 멈추지 말고 건너요"),
      H(-122.6, "분홍 버섯을 밟으면 높이 날아요"),
      H(-156.5, "바람 기둥에 뛰어들면 위로 휭~"),
      H(-169.5, "옆바람! 바람이 멈출 때 건너요"),
      H(-188.4, "끝에서 점프! 빛나는 고리를 지나가요"),
      H(-206.5, "빙글빙글 통나무는 점프로 넘어요 (Shift 대시도 OK)", "빙글빙글 통나무는 점프로 넘어요 (대시도 OK)"),
      H(-229.5, "구름 발판은 금방 사라져요. 멈추지 마요!"),
    ],
  },
  {
    id: 2,
    name: "바람 협곡",
    en: "WIND CANYON",
    theme: "canyon",
    music: "canyon",
    par: 230,
    intro: "바람을 타고 붉은 협곡을 건너요",
    colors: ["#ffb070", "#4aa0f0"],
    mats: { ground: "sand", strata: "canyon", leaf: "#a8b04a", leafDk: "#7a8c3c", stone: "#d8a888", roof: "#c8603a", trunk: "#8a5a3a", cloth: "#f4e2c4", flower: "#ffe0b0" },
    build: stage2,
    hints: [
      H(3, "바람 협곡! 붉은 바위 대지를 건너요"),
      H(-40, "풍차 날개가 위로 올라간 틈에 지나가요"),
      H(-68, "맞바람! 바람이 약해질 때 앞으로 · 바닥 그림자는 낙석이에요"),
      H(-95, "빙글빙글 원판 위에서는 몸도 같이 돌아요"),
      H(-131, "바람 기둥에 뛰어들고 앞으로! 두 번 타고 절벽 위로"),
      H(-154, "절벽 끝에서 점프! 고리 두 개를 연달아 통과"),
      H(-188, "좌우로 번갈아 부는 바람 · 풍차 날개도 조심"),
      H(-237, "그림자 원이 차오르면 바위가 떨어져요"),
    ],
  },
  {
    id: 3,
    name: "공중 항구",
    en: "SKY HARBOR",
    theme: "harbor",
    music: "harbor",
    par: 240,
    intro: "비행선이 떠나기 전에 항구를 가로질러요",
    colors: ["#ffd08a", "#4a8ad8"],
    mats: { ground: "quay", strata: "harbor", roof: "#f4ece4", stone: "#d8ccb8", cloth: "#f8f0e0", leaf: "#7ac25a" },
    build: stage3,
    hints: [
      H(3, "공중 항구! 짐 나르는 띠를 타고 달려요"),
      H(-24, "옆으로 미는 띠 · 반대쪽으로 버티며 건너요"),
      H(-31, "띠 옆 불이 깜빡이면 방향이 바뀌어요"),
      H(-48, "출렁이는 하늘 배가 가까이 올 때 점프!"),
      H(-85, "바닥에 빨간 줄이 생기면 포탄이 와요 · 멈췄다가 지나가요 (점프로 넘어도 돼요)"),
      H(-122, "짐받침이 가장 가까이 왔을 때 뛰어요"),
      H(-191, "도개교: 초록불일 때 건너요 · 종이 울리면 올라가요"),
      H(-218, "묶인 비행선 갑판을 건너요"),
    ],
  },
  {
    id: 4,
    name: "수정 구름 동굴",
    en: "CRYSTAL CAVE",
    theme: "cave",
    music: "cave",
    par: 230,
    intro: "빛나는 수정을 따라 동굴 출구로",
    colors: ["#b07aff", "#3ae0ff"],
    killY: -20,
    mats: { ground: "moss", glow: 0.55, strata: "cave", leaf: "#6a8ae8", leafDk: "#4a5ac8", trunk: "#5a4a7a", stone: "#9a8ac8", stem: "#e0d8ff", flower: "#9af4ff", wood: "#b8a8d8", woodDark: "#5a4a7a" },
    build: stage4,
    hints: [
      H(3, "수정 구름 동굴! 빛나는 버섯을 따라가요"),
      H(-31, "수정 발판이 깜빡이면 곧 사라져요 · 다음 발판이 나타나면 건너요"),
      H(-58, "고드름 수정이 흔들리면 떨어져요 · 멈추지 말고 지나가요"),
      H(-70, "옆에서 도는 빛줄기는 점프로 넘어요"),
      H(-88, "분홍 버섯을 밟으면 위층으로!"),
      H(-111, "움직이는 수정 발판 → 나타나는 발판"),
      H(-139, "빛줄기 정원 · 낮게 도는 빛은 점프!"),
      H(-155, "금 간 수정 다리! 멈추지 말고"),
      H(-179, "빛 기둥에 뛰어들어 출구 층으로!"),
    ],
  },
  {
    id: 5,
    name: "폭풍의 하늘성",
    en: "STORM CASTLE",
    theme: "storm",
    music: "storm",
    par: 240,
    intro: "번개 치는 성벽을 넘어 성 꼭대기로",
    colors: ["#7a8ad8", "#ffe24a"],
    mats: { ground: "slate", groundRough: 0.55, strata: "storm", stone: "#9a9eb8", castle: "#9a9cb8", roof: "#e8e4f4", wood: "#a89888", woodDark: "#3e3844", cloth: "#c8c0d8", leaf: "#4a6a5a", leafDk: "#2e4a3e", trunk: "#4a3e3a" },
    build: stage5,
    hints: [
      H(3, "폭풍의 하늘성! 노란 원이 차오르면 번개가 쳐요 · 원 밖에서 기다려요"),
      H(-29, "톱니바퀴 위에서는 몸도 같이 돌아요"),
      H(-57, "가시가 덜컥거리면 곧 솟아요 · 들어갈 때를 기다려요"),
      H(-73, "젖은 판자는 미끄러워요 · 옆바람도 조심!"),
      H(-100, "쇠사슬 그네가 가장 가까이 올 때 뛰어요"),
      H(-132, "돌계단을 올라 높은 성벽으로"),
      H(-163, "금 간 성벽은 멈추지 말고!"),
      H(-191, "마지막 관문! 톱니바퀴 → 가시 → 비행선"),
    ],
  },
  {
    id: 6,
    name: "고대 용의 성",
    en: "ANCIENT DRAGON CASTLE",
    theme: "dragon",
    music: "dragon",
    par: 300,
    boss: true,
    intro: "최종 보스 · 고대 기계 용을 쓰러뜨리고 탈출!",
    colors: ["#ff6a4a", "#ffd24a"],
    killY: -26,
    collapseText: "용의 성이 무너진다!",
    mats: { ground: "basalt", glow: 0.9, strata: "dragon", stone: "#7a6a74", castle: "#6a5260", roof: "#c84a3a", wood: "#9a7a6a", woodDark: "#3a2a30", cloth: "#e8c8a8", leaf: "#7a5a3a", leafDk: "#5a3a2a", trunk: "#3a2a2a" },
    build: stage6,
    hints: [
      H(3, "고대 용의 성! 지금까지 배운 걸 모두 써요"),
      H(-8.5, "용머리 포탑의 빨간 줄 · 불덩이가 지나간 뒤에 건너요"),
      H(-27, "주황 수정 발판 리듬 · 나타날 때 건너요"),
      H(-52, "톱니바퀴 → 가시 복도"),
      H(-150.5, "아레나에 들어서면 최종 보스! 약점이 빛날 때 대시"),
    ],
  },
];
