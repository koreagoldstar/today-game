/*
 * WORLD 2 · HARBOR STRIKE (낮) / NIGHT HUNTER 의 밤 부두
 *  앞쪽 콘크리트 부두에 컨테이너 더미(사이는 통로), 창고, 항만 크레인, 부두에 붙은 화물선, 건너편 도시
 */
import { THREE, Batch, rng, pick, range, std, glow, mat4, worldBox } from "../kit.js";
import { BAY, GROUND, FLOOR, containerPBR, concretePBR, waterPBR, metalPBR, asphaltPBR } from "../textures.js";
import { cityMaterials, CityBuilder, groundPlane, nestInto, carInto, movingCar, lampGlows, lightPools } from "./common.js";

export const HARBOR_VANTAGE = {
  crane: { x: -40, h: 37, yaw: 0.08, range: 0.92 },
  warehouse: { x: 36, h: 25, yaw: -0.05, range: 0.95 },
};
const CW = 12.2;
const CH = 2.6;
const CD = 2.44;
const CCOL = [0x6f3a2e, 0x34495c, 0x3c5247, 0x8a5f3c, 0x6b6e6f, 0x5f3431, 0x3f4a55, 0x7d7350, 0x4f453a, 0x7a7a74, 0x52585a];

export function buildHarbor(o) {
  const night = !!o.night;
  const r = rng(o.seed || 1);
  const root = new THREE.Group();
  const M = cityMaterials(night, ["sand", "brutal", "office", "modern", "brick"]);
  const C = new CityBuilder(M);
  C.r = r;
  const V = HARBOR_VANTAGE[o.vantage] || HARBOR_VANTAGE.crane;
  const CP = containerPBR();
  const CON = concretePBR();
  const AS = asphaltPBR();
  const MT = metalPBR();
  const WT = waterPBR();
  const mCont = std({ map: CP.map, normalMap: CP.normal, roughness: 0.62, metalness: 0.35 });
  const mCon = std({ map: CON.map, normalMap: CON.normal, roughness: 0.92 });
  const mAsp = std({ map: AS.map, normalMap: AS.normal, roughness: night ? 0.42 : 0.86 });
  const mMetal = std({ map: MT.map, normalMap: MT.normal, roughness: 0.5, metalness: 0.65 });

  /* 물 */
  const nor = WT.normal.clone();
  const map = WT.map.clone();
  for (const t of [nor, map]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(70, 70);
    t.needsUpdate = true;
  }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), std({ map, normalMap: nor, normalScale: new THREE.Vector2(0.55, 0.55), color: night ? 0x2a3844 : 0x7f939c, roughness: 0.12, metalness: 0.8 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -2.4, -600);
  water.receiveShadow = true;
  water.userData.block = false;
  root.add(water);

  /* 부두 바닥 · 안벽 */
  groundPlane(root, mAsp, -300, -192, 300, 40, 0, 26, "yard");
  const quay = new Batch();
  quay.add(mCon, worldBox(600, 3, 2, 4), mat4(0, -1.5, -193), 0xa8a59c);
  // 두 번째 돌제 (오른쪽으로 뻗음)
  quay.add(mCon, worldBox(46, 3, 170, 6), mat4(150, -1.5, -278), 0x98958c);
  // 안벽 말뚝 · 계선주 · 노란 선
  for (let x = -280; x < 280; x += 18) quay.cyl(M.metal, 0.28, 0.34, 0.75, x, 0, -190.8, 0x2b2c2e, 12);
  for (let x = -280; x < 280; x += 6) quay.box(M.stone, 3.2, 0.02, 0.2, x, 0.02, -186, 0, 0xb09230);
  for (let z = -180; z < 0; z += 6) {
    quay.box(M.stone, 0.2, 0.02, 3.2, -216, 0.02, z, 0, 0x8f8a78);
    quay.box(M.stone, 0.2, 0.02, 3.2, 216, 0.02, z, 0, 0x8f8a78);
  }
  quay.build(root, { name: "quay" });

  /* 내 저격 위치 건물 */
  const floors = Math.max(2, Math.round((V.h - GROUND) / FLOOR));
  const nestTop = GROUND + floors * FLOOR;
  C.building({ x: V.x, z: -14, face: "nz", bays: 8, depthBays: 9, floors, style: "brutal", shop: false, roofProps: false });
  const nestPos = nestInto(root, M, V.x, nestTop);
  for (const side of [-1, 1]) {
    let x = V.x + side * 28;
    for (let i = 0; i < 4; i++) {
      const bays = 4 + Math.floor(r() * 3);
      const w = bays * BAY;
      x += side * (w / 2);
      C.building({ x, z: -12, face: "nz", bays, depthBays: 5, floors: 1 + Math.floor(r() * 3), style: pick(r, ["sand", "brutal", "brick"]), shop: false, roofProps: true });
      x += side * (w / 2 + 3);
    }
  }

  /* 창고 (열린 창 · 옥상) */
  const wh = [
    { x: -222, z: -60, bays: 8, f: 3 },
    { x: 222, z: -50, bays: 9, f: 2 },
    { x: -226, z: -128, bays: 7, f: 4 },
    { x: 224, z: -122, bays: 8, f: 3 },
  ];
  for (const w of wh) {
    const open = [];
    for (let k = 0; k < 4; k++) open.push({ bay: Math.floor(r() * w.bays), floor: Math.floor(r() * w.f) });
    C.building({ x: w.x, z: w.z, face: "pz", bays: w.bays, depthBays: 6, floors: w.f, style: pick(r, ["sand", "brick", "brutal"]), open, shop: false, roofProps: true });
  }
  // 가운데 낮은 사무동
  C.building({ x: 0, z: -30, face: "pz", bays: 4, depthBays: 3, floors: 1, style: "office", open: [], shop: false, roofProps: true });

  /* 컨테이너 더미 */
  const CG = worldBox(CW, CH, CD, 2.6);
  const cb = new Batch();
  const spots = C.spots;
  spots.container = [];
  spots.ground = [];
  spots.door = [];
  spots.cover = [];
  spots.deck = [];
  spots.deckpath = [];
  spots.crane = [];
  const aisleZ = [];
  let zRow = -52;
  const rows = 6;
  for (let j = 0; j < rows; j++) {
    const blockD = CD * 4;
    let x = -196;
    while (x < 196) {
      const cols = 1 + Math.floor(r() * 3);
      const bw = cols * (CW + 0.3);
      if (r() < 0.82) {
        for (let c = 0; c < cols; c++) {
          for (let k = 0; k < 4; k++) {
            const h = 1 + Math.floor(r() * (j > 2 ? 4 : 3));
            for (let y = 0; y < h; y++) {
              const cx = x + c * (CW + 0.3) + CW / 2;
              const cz = zRow - k * (CD + 0.1) - CD / 2;
              cb.add(mCont, CG, mat4(cx + range(r, -0.08, 0.08), y * CH + CH / 2, cz, 0, (r() - 0.5) * 0.012, 0), pick(r, CCOL));
            }
            if (k === 0) {
              const top = h * CH;
              const cx = x + c * (CW + 0.3) + CW / 2;
              const cz = zRow - CD / 2;
              spots.container.push({ type: "container", pos: new THREE.Vector3(cx, top, cz), yaw: 0, along: [1, 0, 0], len: 3.6 });
            }
          }
        }
        // 더미 끝: 문 열고 나오는 자리 (앞 통로)
        const ey = 0;
        spots.door.push({ type: "door", pos: new THREE.Vector3(x - 0.9, ey, zRow - 1.2), in: new THREE.Vector3(x + 1.2, ey, zRow - 1.2), out: new THREE.Vector3(x - 0.9, ey, zRow - 1.2), yaw: 0 });
        spots.door.push({ type: "door", pos: new THREE.Vector3(x + bw + 0.6, ey, zRow - 1.2), in: new THREE.Vector3(x + bw - 1.5, ey, zRow - 1.2), out: new THREE.Vector3(x + bw + 0.6, ey, zRow - 1.2), yaw: 0 });
      }
      x += bw + range(r, 6, 14);
    }
    aisleZ.push(zRow + 3.2);
    zRow -= blockD + 11;
  }
  cb.build(root, { name: "containers" });

  /* 통로 자리 · 걷는 길 */
  for (const az of aisleZ) {
    for (let x = -190; x < 190; x += 14) spots.ground.push({ type: "ground", pos: new THREE.Vector3(x + range(r, -3, 3), 0, az + range(r, -1, 1)), yaw: range(r, -0.6, 0.6), along: [1, 0, 0], len: 3.2 });
    spots.street.push({ type: "street", path: [new THREE.Vector3(-185, 0, az + 1), new THREE.Vector3(185, 0, az - 1)] });
  }
  spots.street.push({ type: "street", path: [new THREE.Vector3(-210, 0, -183), new THREE.Vector3(120, 0, -183)] });
  spots.street.push({ type: "street", path: [new THREE.Vector3(135, 0, -190), new THREE.Vector3(150, 0, -340)] });
  for (let x = -210; x < 210; x += 12) spots.ground.push({ type: "ground", pos: new THREE.Vector3(x, 0, -182 + range(r, -2, 2)), yaw: range(r, -0.5, 0.5), along: [1, 0, 0], len: 3 });

  /* 엄폐 (나무 상자 더미) */
  const crates = new Batch();
  for (let i = 0; i < 18; i++) {
    const az = pick(r, aisleZ);
    const x = range(r, -170, 170);
    const s = range(r, 1.2, 1.32);
    crates.box(M.paint, s * 1.5, s, s, x, 0, az + 0.8, 0, 0x5f4a30);
    crates.box(M.paint, s, s * 0.9, s, x + s * 1.3, 0, az + 0.8, 0.2, 0x6d5636);
    spots.cover.push({ type: "cover", pos: new THREE.Vector3(x, 0, az - 0.4), yaw: 0 });
  }
  crates.build(root, { name: "crates" });

  /* 지게차 · 트럭 · 드럼통 */
  const props = new Batch();
  for (let i = 0; i < 16; i++) carInto(props, M, range(r, -190, 190), 0, pick(r, aisleZ) + range(r, -1, 1), r() < 0.5 ? 0 : Math.PI, pick(r, [0x8a8a86, 0x35506b, 0x7c2e2e, 0x9a7f2f, 0x2c2c2c]), r);
  for (let i = 0; i < 40; i++) {
    const x = range(r, -200, 200);
    const z = pick(r, aisleZ) + range(r, -1.6, 1.6);
    props.cyl(mMetal, 0.3, 0.3, 0.9, x, 0, z, pick(r, [0x7c3a28, 0x2c4a63, 0x56594f]), 12);
  }
  props.build(root, { name: "props" });

  /* 항만 크레인 */
  const cr = new Batch();
  const craneAt = (cx, cz, h, col) => {
    const LW = 11;
    const LD = 7;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        cr.add(mMetal, worldBox(0.95, h, 0.95, 3), mat4(cx + sx * LW, h / 2, cz + sz * LD), col);
        cr.add(mMetal, new THREE.BoxGeometry(1.4, 1, 2.2), mat4(cx + sx * LW, 0.5, cz + sz * LD), 0x2c2d2e);
      }
    for (const sz of [-1, 1]) {
      cr.add(mMetal, worldBox(LW * 2 + 1, 1.2, 1, 3), mat4(cx, h - 0.6, cz + sz * LD), col);
      cr.add(mMetal, worldBox(LW * 2 + 1, 0.7, 0.7, 3), mat4(cx, h * 0.5, cz + sz * LD), col);
    }
    for (const sx of [-1, 1]) {
      cr.add(mMetal, worldBox(1, 1.2, LD * 2 + 1, 3), mat4(cx + sx * LW, h - 0.6, cz), col);
      cr.add(mMetal, new THREE.BoxGeometry(0.5, Math.hypot(h * 0.5, LD * 2), 0.5), mat4(cx + sx * LW, h * 0.75, cz, Math.atan2(LD * 2, h * 0.5), 0, 0), col);
    }
    // 붐 (바다 쪽으로)
    cr.add(mMetal, worldBox(2.4, 1.8, 92, 3), mat4(cx, h + 1.4, cz - 18), col);
    cr.add(mMetal, worldBox(5, 12, 5, 3), mat4(cx, h + 8, cz + 4), col);
    for (const k of [-44, -22, 0, 18]) cr.add(mMetal, new THREE.BoxGeometry(0.18, 0.18, Math.hypot(14 - Math.abs(k) * 0.1, k - 4)), mat4(cx, h + 7.8, cz + (k + 4) / 2 - 16 + 16, Math.atan2(k - 4, 11), 0, 0), 0x35383a);
    // 운전실 + 발판
    cr.add(mMetal, worldBox(4, 3, 3.2, 3), mat4(cx - 3, h - 2.3, cz - 12), 0xa9a8a2);
    cr.add(M.glass, new THREE.BoxGeometry(3.6, 1.3, 3.3), mat4(cx - 3, h - 1.9, cz - 12), 0xffffff);
    cr.add(mMetal, worldBox(6, 0.14, 2.2, 3), mat4(cx - 3, h - 3.8, cz - 9.5), 0x3a3c3d);
    cr.add(M.metal, new THREE.BoxGeometry(6, 0.06, 0.06), mat4(cx - 3, h - 2.8, cz - 8.5), 0x303234);
    spots.crane.push({ type: "crane", pos: new THREE.Vector3(cx - 3, h - 3.73, cz - 9.5), yaw: 0, along: [1, 0, 0], len: 1.8 });
    spots.crane.push({ type: "crane", pos: new THREE.Vector3(cx + sxTop(r), h + 2.3, cz - 2), yaw: 0, along: [0, 0, 1], len: 0.6 });
  };
  craneAt(-118, -176, 30, 0xa8562c);
  craneAt(-30, -176, 30, 0x2f5f86);
  craneAt(66, -176, 30, 0xa8562c);
  cr.build(root, { name: "cranes" });

  /* 화물선 */
  const ship = new Batch();
  const sh = new THREE.Shape();
  const L = 96;
  const Bm = 12;
  sh.moveTo(-L, -Bm * 0.8);
  sh.lineTo(L - 22, -Bm);
  sh.quadraticCurveTo(L, -Bm * 0.5, L + 8, 0);
  sh.quadraticCurveTo(L, Bm * 0.5, L - 22, Bm);
  sh.lineTo(-L, Bm * 0.8);
  sh.closePath();
  const hullG = new THREE.ExtrudeGeometry(sh, { depth: 11, bevelEnabled: false });
  hullG.rotateX(-Math.PI / 2);
  const hu = hullG.attributes.uv;
  for (let i = 0; i < hu.count; i++) hu.setXY(i, hu.getX(i) * 0.12, hu.getY(i) * 0.12);
  const SZ = -212;
  ship.add(mMetal, hullG, mat4(-6, -3, SZ), 0x2d3c4c);
  ship.add(M.paint, new THREE.BoxGeometry(150, 0.5, 0.2), mat4(-12, 6.4, SZ + Bm * 0.9), 0xb9b6ac);
  // 물에 잠긴 붉은 칠
  ship.add(mMetal, worldBox(192, 2.4, Bm * 1.98, 5), mat4(-14, -2.2, SZ), 0x6f2b22);
  // 갑판
  const deckY = 8;
  ship.add(mMetal, worldBox(170, 0.2, Bm * 1.6, 5), mat4(-8, deckY + 0.1, SZ), 0x54504a);
  // 갑판 위 컨테이너
  for (let i = 0; i < 9; i++) {
    const cx = -46 + i * 13.2;
    const hh = 1 + Math.floor(r() * 3);
    for (let y = 0; y < hh; y++) for (let k = -2; k <= 2; k++) if (r() < 0.9) ship.add(mCont, CG, mat4(cx, deckY + 0.2 + y * CH + CH / 2, SZ - 3 + k * 2.6), pick(r, CCOL));
  }
  // 난간 (앞쪽 뱃전)
  const rail = new Batch();
  for (let x = -84; x < 76; x += 2.2) rail.cyl(M.metal, 0.03, 0.03, 1.05, x, deckY + 0.2, SZ + 9.4, 0xd0cfca, 6);
  rail.box(M.metal, 160, 0.05, 0.05, -4, deckY + 1.2, SZ + 9.4, 0, 0xd0cfca);
  rail.box(M.metal, 160, 0.05, 0.05, -4, deckY + 0.7, SZ + 9.4, 0, 0xd0cfca);
  rail.build(root, { name: "ship-rail", block: false });
  ship.build(root, { name: "ship" });
  // 선교 (뒤쪽 높은 건물)
  C.building({ x: -72, z: SZ + 8, face: "pz", bays: 5, depthBays: 4, floors: 6, style: "office", shop: false, roofProps: true, open: [{ bay: 1, floor: 3 }, { bay: 3, floor: 4 }, { bay: 2, floor: 5 }] });
  // 갑판 자리 · 뱃전 길
  for (let x = -60; x < 70; x += 6) spots.deck.push({ type: "deck", pos: new THREE.Vector3(x, deckY + 0.2, SZ + 8.2), yaw: range(r, -0.5, 0.5), along: [1, 0, 0], len: 2.4 });
  spots.deckpath.push({ type: "deckpath", path: [new THREE.Vector3(-58, deckY + 0.2, SZ + 8.4), new THREE.Vector3(70, deckY + 0.2, SZ + 8.4)] });

  /* 조명탑 */
  const lamps = [];
  const lb = new Batch();
  for (let x = -180; x <= 180; x += 90) {
    lb.cyl(M.metal, 0.22, 0.34, 22, x, 0, -46, 0x4a4d50, 10);
    lb.box(M.light, 3.2, 0.5, 0.5, x, 22, -46, 0, 0xffffff);
    lamps.push(new THREE.Vector3(x, 21.8, -46.4));
  }
  lb.build(root, { name: "lamps" });
  if (night) {
    lampGlows(root, lamps, 0xffe0b0, 9);
    lightPools(root, lamps.map((q) => new THREE.Vector3(q.x, 0, q.z - 18)), 0xffd9a8, 70, 0.05, 0.42);
    lightPools(root, [-150, -75, 0, 75, 150].map((x) => new THREE.Vector3(x, 0, -160)), 0xffd9a8, 62, 0.05, 0.34);
    const moon = glow(0xdfe8ff, 150, 0.85);
    moon.position.set(500, 620, -1900);
    root.add(moon);
    // 건너편 도시 불빛
  }

  /* 건너편 도시 (멀리 · 땅 위에) */
  groundPlane(root, mAsp, -2000, -1900, 2000, -520, 1, 26, "far-land");
  const farB = new Batch();
  farB.add(mCon, worldBox(4000, 3.4, 3, 5), mat4(0, -0.7, -520), 0x8f8c84);
  farB.build(root, { name: "far-quay", block: false });
  for (let i = 0; i < 46; i++) {
    const x = range(r, -900, 900);
    C.building({ x, z: -560 - r() * 300, face: "pz", bays: 5 + Math.floor(r() * 5), depthBays: 4, floors: 6 + Math.floor(r() * 18), style: pick(r, ["modern", "office", "brutal", "modern"]), shop: false, roofProps: false });
  }

  C.build(root);
  C.spots.roof = C.spots.roof.filter((sp) => sp.pos.z < -40 && sp.pos.z > -420);
  C.spots.window = C.spots.window.filter((sp) => sp.pos.z > -420);

  /* 움직이는 것: 부두 트럭 · 예인선 */
  const movers = [];
  for (let i = 0; i < 4; i++) {
    const g = movingCar(M, pick(r, [0xb0622b, 0x34475a, 0x6f7377]), r);
    const az = aisleZ[i % aisleZ.length] - 1.6;
    g.position.set(range(r, -180, 180), 0, az);
    const dir = i % 2 ? 1 : -1;
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    root.add(g);
    movers.push({ g, dir, speed: range(r, 4, 7), axis: "x", min: -200, max: 200 });
  }
  const tug = new THREE.Group();
  const tb = new Batch();
  tb.box(mMetal, 16, 2.2, 5, 0, 0, 0, 0, 0x2b3a44);
  tb.box(M.paint, 6, 3, 3.6, -1, 2.2, 0, 0, 0xd8d3c6);
  tb.box(M.dark, 1, 3, 1, 1, 5.2, 0, 0, 0x8a2a22);
  tb.build(tug, { name: "tug", block: false });
  tug.position.set(-200, -2.4, -300);
  root.add(tug);
  movers.push({ g: tug, dir: 1, speed: 3.2, axis: "x", min: -400, max: 400 });

  return {
    root,
    spots,
    night,
    shadowCenter: new THREE.Vector3(0, 0, -120),
    shadowSize: 230,
    smoke: [
      { x: -420, y: 60, z: -880, h: 320, s: 42 },
      { x: 310, y: 50, z: -820, h: 260, s: 32 },
      { x: -72, y: 28, z: -216, h: 90, s: 7 },
    ],
    wind: [8, 0, -2],
    nest: { pos: nestPos, yaw: V.yaw, range: V.range, pitchMin: -0.42, pitchMax: 0.3 },
    update(dt) {
      nor.offset.x += dt * 0.006;
      nor.offset.y += dt * 0.004;
      map.offset.x += dt * 0.003;
      for (const m of movers) {
        const p = m.g.position;
        p[m.axis] += m.dir * m.speed * dt;
        if (p[m.axis] > m.max) p[m.axis] = m.min;
        if (p[m.axis] < m.min) p[m.axis] = m.max;
      }
    },
  };
}
function sxTop() {
  return 0;
}
