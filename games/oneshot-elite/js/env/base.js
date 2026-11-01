/*
 * WORLD 5 · FINAL ASSAULT — 비바람 치는 적 기지
 *  격납고 · 관제탑 · 막사(열린 창) · 감시탑 · 연료 탱크 · 방폭벽 · 헬기장 · 활주로 · 차량
 */
import { THREE, Batch, rng, pick, range, std, glow, mat4, worldBox } from "../kit.js";
import { BAY, GROUND, FLOOR, asphaltPBR, concretePBR, metalPBR, containerPBR, grassPBR } from "../textures.js";
import { cityMaterials, CityBuilder, groundPlane, nestInto, carInto, movingCar, treeInto, lampGlows, lightPools } from "./common.js";

export const BASE_VANTAGE = {
  hill: { x: 0, h: 34, yaw: 0, range: 0.95 },
  tank: { x: -58, h: 44, yaw: 0.16, range: 0.9 },
};

export function buildBase(o) {
  const night = !!o.night;
  const wet = o.atmos === "storm" || night;
  const r = rng(o.seed || 1);
  const root = new THREE.Group();
  const M = cityMaterials(night, ["brutal", "office", "sand", "modern"]);
  const C = new CityBuilder(M);
  C.r = r;
  const V = BASE_VANTAGE[o.vantage] || BASE_VANTAGE.hill;
  const AS = asphaltPBR();
  const CON = concretePBR();
  const MT = metalPBR();
  const CT = containerPBR();
  const GR = grassPBR();
  const mAsp = std({ map: AS.map, normalMap: AS.normal, roughness: wet ? 0.34 : 0.86, metalness: wet ? 0.12 : 0, color: wet ? 0xb8b8b8 : 0xffffff });
  const mCon = std({ map: CON.map, normalMap: CON.normal, roughness: wet ? 0.45 : 0.92 });
  const mMetal = std({ map: MT.map, normalMap: MT.normal, roughness: 0.5, metalness: 0.7 });
  const mSheet = std({ map: CT.map, normalMap: CT.normal, roughness: 0.55, metalness: 0.5 });
  const mGrass = std({ map: GR.map, normalMap: GR.normal, roughness: 1 });

  groundPlane(root, mGrass, -2000, -2200, 2000, 300, -0.02, 14, "field");
  groundPlane(root, mAsp, -260, -260, 260, -24, 0, 26, "apron");
  groundPlane(root, mAsp, -1200, -350, 1200, -285, 0, 26, "runway");
  const mk = new Batch();
  for (let x = -1150; x < 1150; x += 30) mk.box(M.stone, 16, 0.02, 0.6, x, 0.03, -318, 0, 0xa8a598);
  for (let x = -250; x < 250; x += 8) {
    mk.box(M.stone, 4, 0.02, 0.22, x, 0.03, -102, 0, 0xa8922f);
    mk.box(M.stone, 4, 0.02, 0.22, x, 0.03, -176, 0, 0xa8922f);
  }
  mk.build(root, { name: "marks", block: false });

  /* 저격 위치 */
  const floors = Math.max(2, Math.round((V.h - GROUND) / FLOOR));
  const nestTop = GROUND + floors * FLOOR;
  C.building({ x: V.x, z: -14, face: "nz", bays: 8, depthBays: 8, floors, style: "brutal", shop: false, roofProps: false });
  const nestPos = nestInto(root, M, V.x, nestTop, { tint: wet ? 0xb4b6b8 : 0xffffff });

  const spots = C.spots;
  spots.ground = [];
  spots.tower = [];
  spots.wall = [];
  spots.door = [];
  spots.cover = [];

  /* 격납고 (반원 지붕 · 열린 문) */
  const b = new Batch();
  const hangarAt = (x, z, w, d, h) => {
    const roof = new THREE.CylinderGeometry(w / 2, w / 2, d, 40, 1, true, 0, Math.PI);
    const uv = roof.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w * 0.5), uv.getY(i) * (d / 6));
    roof.rotateZ(Math.PI / 2);
    roof.rotateY(Math.PI / 2);
    b.add(mSheet, roof, mat4(x, 0, z - d / 2, 0, 0, 0, 1, (h * 2) / w, 1), 0x8f9296);
    // 앞면: 문 양옆 + 위
    const dw = w * 0.56;
    const side = (w - dw) / 2;
    // 앞면: 양옆 벽 + 문 위 벽 (아치 안쪽으로)
    b.add(mMetal, worldBox(side, h * 0.62, 0.4, 3), mat4(x - dw / 2 - side / 2, h * 0.31, z), 0x8d9095);
    b.add(mMetal, worldBox(side, h * 0.62, 0.4, 3), mat4(x + dw / 2 + side / 2, h * 0.31, z), 0x8d9095);
    b.add(mMetal, worldBox(dw + side * 0.9, h * 0.2, 0.4, 3), mat4(x, h * 0.72, z), 0x8d9095);
    b.add(mSheet, new THREE.BoxGeometry(w * 0.9, 0.5, 0.5), mat4(x, h * 0.62, z + 0.2), 0x5a5d60);
    // 안쪽 어두운 벽 · 뒤쪽 막음
    b.add(M.dark, new THREE.BoxGeometry(w - 1, h, 0.3), mat4(x, h / 2, z - d + 0.3), 0x14161a);
    b.add(M.dark, new THREE.BoxGeometry(0.3, h * 0.9, d), mat4(x - w / 2 + 0.2, h * 0.45, z - d / 2), 0x191b1f);
    b.add(M.dark, new THREE.BoxGeometry(0.3, h * 0.9, d), mat4(x + w / 2 - 0.2, h * 0.45, z - d / 2), 0x191b1f);
    b.add(M.dark, new THREE.BoxGeometry(w, 0.05, d), mat4(x, 0.03, z - d / 2), 0x25272b);
    b.add(M.dark, new THREE.BoxGeometry(w, 0.2, d), mat4(x, h * 0.72, z - d / 2), 0x111316);
    // 문 앞에서 나오는 자리
    for (const s of [-1, 1]) {
      const ox = x + (s * dw) / 2 - s * 1.6;
      spots.door.push({ type: "door", pos: new THREE.Vector3(ox, 0, z + 0.9), out: new THREE.Vector3(ox, 0, z + 0.9), in: new THREE.Vector3(ox + s * 4, 0, z - 1.4), yaw: 0 });
    }
    for (let k = 0; k < 3; k++) spots.ground.push({ type: "ground", pos: new THREE.Vector3(x - dw / 3 + (k * dw) / 3, 0, z + 6 + r() * 5), yaw: range(r, -0.6, 0.6), along: [1, 0, 0], len: 3.4 });
  };
  hangarAt(-135, -190, 56, 62, 17);
  hangarAt(-58, -196, 46, 56, 14);
  hangarAt(70, -194, 46, 56, 14);
  hangarAt(150, -188, 56, 62, 17);

  /* 관제탑 · 막사 */
  C.building({ x: 8, z: -170, face: "pz", bays: 4, depthBays: 4, floors: 9, style: "brutal", shop: false, roofProps: true, open: [{ bay: 1, floor: 8 }, { bay: 2, floor: 8 }, { bay: 0, floor: 6 }, { bay: 3, floor: 5 }, { bay: 1, floor: 3 }] });
  for (const [x, z, bays, f] of [
    [-205, -70, 8, 2],
    [-200, -128, 7, 3],
    [205, -66, 8, 2],
    [200, -126, 7, 3],
    [-88, -44, 5, 1],
    [90, -44, 5, 1],
  ]) {
    const open = [];
    for (let k = 0; k < 4; k++) open.push({ bay: Math.floor(r() * bays), floor: Math.floor(r() * f) });
    C.building({ x, z, face: "pz", bays, depthBays: 3, floors: f, style: pick(r, ["brutal", "sand", "office"]), open, shop: false, roofProps: true });
  }

  /* 감시탑 · 연료 탱크 · 방폭벽 · 철조망 */
  const towerAt = (x, z, h) => {
    for (const [sx, sz] of [
      [-1.6, -1.6],
      [1.6, -1.6],
      [-1.6, 1.6],
      [1.6, 1.6],
    ])
      b.add(mMetal, worldBox(0.28, h, 0.28, 3), mat4(x + sx, h / 2, z + sz), 0x4a4e52);
    for (const yy of [h * 0.3, h * 0.65]) {
      b.box(M.metal, 3.4, 0.12, 0.12, x, yy, z + 1.6, 0, 0x4a4e52);
      b.box(M.metal, 3.4, 0.12, 0.12, x, yy, z - 1.6, 0, 0x4a4e52);
      b.box(M.metal, 0.12, 0.12, 3.4, x + 1.6, yy, z, 0, 0x4a4e52);
      b.box(M.metal, 0.12, 0.12, 3.4, x - 1.6, yy, z, 0, 0x4a4e52);
    }
    b.add(mCon, worldBox(4.6, 0.25, 4.6, 3), mat4(x, h + 0.12, z), 0x7f7f7c);
    b.add(mMetal, worldBox(4.6, 0.9, 0.12, 3), mat4(x, h + 0.7, z + 2.25), 0x585c60);
    b.add(mMetal, worldBox(0.12, 0.9, 4.6, 3), mat4(x + 2.25, h + 0.7, z), 0x585c60);
    b.add(mMetal, worldBox(0.12, 0.9, 4.6, 3), mat4(x - 2.25, h + 0.7, z), 0x585c60);
    for (const [sx, sz] of [
      [-2.1, -2.1],
      [2.1, -2.1],
      [-2.1, 2.1],
      [2.1, 2.1],
    ])
      b.box(M.metal, 0.1, 2.4, 0.1, x + sx, h + 0.25, z + sz, 0, 0x3a3d40);
    b.add(mSheet, worldBox(5.4, 0.16, 5.4, 3), mat4(x, h + 2.7, z), 0x5d6063);
    spots.tower.push({ type: "tower", pos: new THREE.Vector3(x, h + 0.25, z + 0.6), yaw: 0 });
  };
  towerAt(-96, -92, 11);
  towerAt(102, -88, 12);
  towerAt(-226, -170, 13);
  towerAt(228, -166, 13);
  towerAt(-20, -128, 10);
  towerAt(40, -232, 14);
  const tankAt = (x, z, rad, h) => {
    const cg = new THREE.CylinderGeometry(rad, rad, h, 36, 1, true);
    const uv = cg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rad, uv.getY(i) * (h / 5));
    b.add(mMetal, cg, mat4(x, h / 2, z), 0xa4a5a0);
    const dome = new THREE.SphereGeometry(rad, 36, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    b.add(mMetal, dome, mat4(x, h, z, 0, 0, 0, 1, 0.22, 1), 0x8f908c);
    // 둘레 난간 · 사다리
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      b.box(M.metal, 0.05, 1.1, 0.05, x + Math.cos(a) * rad * 0.82, h + 0.8, z + Math.sin(a) * rad * 0.82, 0, 0x34373a);
    }
    b.box(M.metal, 0.5, h, 0.08, x, 0, z + rad + 0.08, 0, 0x34373a);
    spots.tower.push({ type: "tower", pos: new THREE.Vector3(x + range(r, -2, 2), h + rad * 0.2, z + rad * 0.55), yaw: 0 });
  };
  tankAt(-168, -116, 11, 15);
  tankAt(-142, -96, 8, 12);
  tankAt(172, -112, 11, 16);
  tankAt(148, -94, 8, 12);
  // 방폭벽 (T 자 콘크리트)
  for (const [x, z, n] of [
    [-110, -66, 7],
    [30, -68, 8],
    [-46, -122, 5],
    [84, -130, 6],
    [-120, -142, 5],
    [130, -140, 5],
  ]) {
    const w = 2.1;
    for (let k = 0; k < n; k++) {
      b.add(mCon, worldBox(w - 0.06, 3.3, 0.35, 2.4), mat4(x + k * w, 1.95, z), 0xa9a9a5);
      b.add(mCon, worldBox(w - 0.06, 0.3, 1.5, 2.4), mat4(x + k * w, 0.15, z), 0x9f9f9b);
    }
    for (const [ex, ix] of [
      [x - 1.9, x + 1.5],
      [x + n * w - 0.2, x + n * w - 3.4],
    ])
      spots.wall.push({ type: "wall", pos: new THREE.Vector3(ex, 0, z - 1), out: new THREE.Vector3(ex, 0, z - 1), in: new THREE.Vector3(ix, 0, z - 1), yaw: 0 });
    spots.cover.push({ type: "cover", pos: new THREE.Vector3(x + n * w * 0.5, 0, z - 0.9), yaw: 0 });
  }
  // 철조망 울타리
  const fence = new Batch();
  for (let x = -250; x <= 250; x += 8) {
    fence.box(M.metal, 0.08, 3.2, 0.08, x, 0, -262, 0, 0x4f5356);
  }
  for (const y of [0.8, 1.6, 2.4, 3.1]) fence.box(M.metal, 500, 0.03, 0.03, 0, y, -262, 0, 0x4f5356);
  fence.build(root, { name: "fence", block: false });

  /* 헬기장 · 헬기 */
  b.cyl(mCon, 11, 11, 0.12, -6, 0, -240, 0x7f7f7c, 40);
  const heli = new THREE.Group();
  const hb = new Batch();
  hb.add(M.paint, new THREE.SphereGeometry(1.6, 18, 12), mat4(0, 2.2, 0, 0, 0, 0, 2.3, 1, 1), 0x3a4032);
  hb.add(M.glass, new THREE.SphereGeometry(1.2, 16, 12), mat4(2.5, 2.3, 0, 0, 0, 0, 1, 0.8, 0.95), 0xffffff);
  hb.add(M.paint, new THREE.CylinderGeometry(0.28, 0.6, 7, 12), mat4(-6.2, 2.7, 0, 0, 0, Math.PI / 2 - 0.05), 0x3a4032);
  hb.box(M.paint, 0.2, 2, 1.1, -9.5, 2.8, 0, 0, 0x3a4032);
  hb.cyl(M.metal, 0.12, 0.14, 1, 0, 3.6, 0, 0x2c2e30, 10);
  hb.box(M.dark, 15, 0.05, 0.42, 0, 4.6, 0, 0.5, 0x1b1c1e);
  hb.box(M.dark, 15, 0.05, 0.42, 0, 4.6, 0, 2.07, 0x1b1c1e);
  hb.box(M.metal, 5, 0.14, 0.14, 0, 0.1, 1.1, 0, 0x26282a);
  hb.box(M.metal, 5, 0.14, 0.14, 0, 0.1, -1.1, 0, 0x26282a);
  hb.build(heli, { name: "heli", block: true });
  heli.position.set(-6, 0.12, -240);
  root.add(heli);

  /* 컨테이너 · 막사 줄 (마당을 채움) */
  const CG = worldBox(12.2, 2.6, 2.44, 2.6);
  for (let i = 0; i < 44; i++) {
    const x = range(r, -215, 215);
    const z = pick(r, [-84, -116, -134, -160]) + range(r, -4, 4);
    if (Math.abs(x - 8) < 26 && z < -150) continue;
    const hh = 1 + Math.floor(r() * 2);
    for (let y = 0; y < hh; y++) b.add(mSheet, CG, mat4(x, y * 2.6 + 1.3, z, 0, Math.floor(r() * 2) * Math.PI * 0.5), pick(r, [0x4e5546, 0x5a5d58, 0x444a3e, 0x68604c]));
    if (hh === 2 && r() < 0.5) spots.tower.push({ type: "tower", pos: new THREE.Vector3(x, 5.2, z), yaw: 0 });
  }
  for (let i = 0; i < 16; i++) {
    const x = range(r, -200, 200);
    const z = pick(r, [-70, -92, -124, -152]);
    const g = 1.3 + r() * 0.6;
    b.add(mCon, worldBox(g * 3, g, g, 2), mat4(x, g / 2, z), 0xa9a79f);
  }

  /* 차량 · 드럼통 · 탄약 상자 */
  for (let i = 0; i < 22; i++) carInto(b, M, range(r, -220, 220), 0, pick(r, [-58, -96, -110, -152, -226]) + range(r, -2, 2), r() < 0.5 ? 0 : Math.PI, pick(r, [0x3f4634, 0x4a4f3f, 0x2f3329, 0x58584c]), r);
  for (let i = 0; i < 12; i++) {
    const x = range(r, -200, 200);
    const z = range(r, -160, -56);
    const tk = 0x3b4132;
    b.add(mMetal, worldBox(6.6, 1.5, 3.3, 3), mat4(x, 1.1, z), tk);
    b.add(mMetal, worldBox(3.4, 0.9, 2.6, 3), mat4(x - 0.3, 2.3, z), tk);
    b.add(M.dark, new THREE.CylinderGeometry(0.09, 0.11, 4.2, 10), mat4(x + 3, 2.3, z, 0, 0, Math.PI / 2), 0x2c2f28);
    b.box(M.tire, 6.9, 0.72, 0.5, x, 0.05, z + 1.55, 0, 0xffffff);
    b.box(M.tire, 6.9, 0.72, 0.5, x, 0.05, z - 1.55, 0, 0xffffff);
    spots.cover.push({ type: "cover", pos: new THREE.Vector3(x, 0, z - 2.5), yaw: 0 });
  }
  for (let i = 0; i < 34; i++) b.cyl(mMetal, 0.3, 0.3, 0.9, range(r, -220, 220), 0, range(r, -200, -40), pick(r, [0x4f5a3a, 0x7a3a28, 0x3f4345]), 12);
  b.build(root, { name: "base" });

  /* 조명탑 */
  const lamps = [];
  const lb = new Batch();
  for (const [x, z] of [
    [-180, -55],
    [-60, -55],
    [60, -55],
    [180, -55],
    [-20, -176],
    [120, -150],
    [-120, -150],
  ]) {
    lb.cyl(M.metal, 0.2, 0.32, 18, x, 0, z, 0x3f4245, 10);
    lb.box(M.light, 2.6, 0.5, 0.5, x, 18, z, 0, 0xffffff);
    lamps.push(new THREE.Vector3(x, 17.8, z + 0.4));
  }
  lb.build(root, { name: "lamps" });
  if (night || o.atmos === "storm") {
    lampGlows(root, lamps, 0xffe6c0, night ? 10 : 6);
    if (night) lightPools(root, lamps, 0xffe0b8, 58, 0.05, 0.5);
  }
  if (night) {
    const moon = glow(0xdfe8ff, 140, 0.8);
    moon.position.set(-500, 600, -1900);
    root.add(moon);
  }

  /* 멀리 숲 · 언덕 건물 */
  const tr = new Batch();
  for (let i = 0; i < 80; i++) {
    const x = range(r, -520, 520);
    const z = -380 - r() * 180;
    treeInto(tr, M, x, z, range(r, 1.8, 2.8), r);
  }
  tr.build(root, { name: "forest", block: false });

  /* 자리 · 길 */
  for (let x = -220; x < 220; x += 16) {
    for (const z of [-74, -104, -146]) spots.ground.push({ type: "ground", pos: new THREE.Vector3(x + range(r, -4, 4), 0, z + range(r, -3, 3)), yaw: range(r, -0.6, 0.6), along: [1, 0, 0], len: 3.4 });
  }
  const v3 = (x, z) => new THREE.Vector3(x, 0, z);
  spots.street.push({ type: "street", path: [v3(-230, -102), v3(230, -102)] });
  spots.street.push({ type: "street", path: [v3(230, -176), v3(-230, -176)] });
  spots.street.push({ type: "street", path: [v3(-200, -60), v3(200, -60)] });
  spots.street.push({ type: "street", path: [v3(-150, -98), v3(-6, -228)] });
  spots.street.push({ type: "street", path: [v3(150, -96), v3(-6, -228)] });
  spots.street.push({ type: "street", path: [v3(-60, -148), v3(120, -148)] });

  C.build(root);
  spots.roof = spots.roof.filter((sp) => sp.pos.z < -40);

  /* 순찰차 */
  const movers = [];
  for (let i = 0; i < 4; i++) {
    const g = movingCar(M, 0x3f4634, r);
    const z = i % 2 ? -107 : -181;
    g.position.set(range(r, -220, 220), 0, z);
    const dir = i % 2 ? 1 : -1;
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    root.add(g);
    movers.push({ g, dir, speed: range(r, 5, 9) });
  }

  return {
    root,
    spots,
    night,
    shadowCenter: new THREE.Vector3(0, 0, -130),
    shadowSize: 240,
    smoke: [
      { x: -170, y: 22, z: -300, h: 170, s: 20 },
      { x: 220, y: 10, z: -420, h: 240, s: 32 },
      { x: -420, y: 10, z: -640, h: 300, s: 40 },
    ],
    wind: [7, 0, 3],
    nest: { pos: nestPos, yaw: V.yaw, range: V.range, pitchMin: -0.44, pitchMax: 0.3 },
    update(dt) {
      for (const m of movers) {
        m.g.position.x += m.dir * m.speed * dt;
        if (m.g.position.x > 240) m.g.position.x = -240;
        if (m.g.position.x < -240) m.g.position.x = 240;
      }
    },
  };
}
