/*
 * WORLD 3 · DESERT STORM
 *  모래 언덕 지형 위 흙벽 마을(열린 창 · 옥상), 감시탑, 천막, 벽, 야자, 바위 — 저격 위치는 바위 능선 위 폐허
 */
import { THREE, Batch, rng, pick, range, std, mat4, worldBox, noise2, fbm } from "../kit.js";
import { BAY, GROUND, FLOOR, sandPBR, mudPBR, tarpPBR, concretePBR } from "../textures.js";
import { cityMaterials, CityBuilder, nestInto, carInto, palmInto, rockInto, sandbagsInto, movingCar } from "./common.js";

export const DESERT_VANTAGE = {
  ridge: { x: 0, h: 34, yaw: 0, range: 0.92 },
  dune: { x: 46, h: 24, yaw: -0.1, range: 0.95 },
};

export function buildDesert(o) {
  const r = rng(o.seed || 1);
  const root = new THREE.Group();
  const M = cityMaterials(false, ["adobe", "sand"]);
  const SD = sandPBR();
  const MD = mudPBR();
  const TP = tarpPBR();
  const CON = concretePBR();
  const mSand = std({ map: SD.map, normalMap: SD.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.98 });
  const mMud = std({ map: MD.map, normalMap: MD.normal, roughness: 0.96 });
  const mRock = std({ map: CON.map, normalMap: CON.normal, normalScale: new THREE.Vector2(1.5, 1.5), roughness: 0.96 });
  const mTarp = std({ map: TP.map, normalMap: TP.normal, roughness: 0.95, side: THREE.DoubleSide });
  M.roof = mMud;
  const C = new CityBuilder(M);
  C.r = r;
  const V = DESERT_VANTAGE[o.vantage] || DESERT_VANTAGE.ridge;
  const n = noise2(o.seed || 3);
  const n2 = noise2((o.seed || 3) + 9);

  /* 지형: 마을 터는 평평, 멀수록 언덕, 뒤로 능선 */
  const villageFlat = (x, z) => {
    const dx = x / 240;
    const dz = (z + 130) / 125;
    return Math.min(1, Math.max(0, 1 - Math.hypot(dx, dz)) * 3.2);
  };
  const H = (x, z) => {
    const big = fbm(n, x * 0.0026 + 5, z * 0.0026 + 5, 4) - 0.5;
    const rip = fbm(n2, x * 0.012, z * 0.016, 3) - 0.5;
    let h = big * 95 + rip * 9;
    const far = Math.max(0, (-z - 320) / 500);
    h += far * far * 46;
    const f = villageFlat(x, z);
    return h * (1 - f);
  };
  const SIZE = 2200;
  const SEG = 220;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  tg.translate(0, 0, -600);
  const tp = tg.attributes.position;
  const tuv = tg.attributes.uv;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i);
    const z = tp.getZ(i);
    tp.setY(i, H(x, z));
    tuv.setXY(i, x / 26, z / 26);
  }
  tg.computeVertexNormals();
  const land = new THREE.Mesh(tg, mSand);
  land.receiveShadow = true;
  land.userData.block = true;
  land.name = "land";
  root.add(land);

  /* 저격 위치: 바위 능선 + 폐허 */
  const floors = Math.max(2, Math.round((V.h - GROUND) / FLOOR));
  const nestTop = GROUND + floors * FLOOR;
  C.building({ x: V.x, z: -14, face: "nz", bays: 8, depthBays: 8, floors, style: "adobe", shop: false, roofProps: false });
  const nestPos = nestInto(root, M, V.x, nestTop, { tint: 0xe6cfa8 });
  const rocks = new Batch();
  // 능선: 옆 · 뒤는 높게, 앞은 낮게 (시야를 막지 않음)
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const front = Math.sin(a) < -0.1;
    const rx = V.x + Math.cos(a) * 22 * (0.7 + r() * 0.6);
    const rz = (front ? -12 : -4) + Math.sin(a) * (front ? 9 : 18) * (0.7 + r() * 0.6);
    const hh = front ? range(r, 3, 7) : range(r, 10, nestTop * 0.72);
    rockInto(rocks, mRock, rx, 2, rz, range(r, 10, 18), hh, front ? range(r, 5, 8) : range(r, 10, 18), 0xb9a07c, r() * 6);
  }
  // 흩어진 바위 (엄폐 포함)
  C.spots.cover = [];
  C.spots.ground = [];
  C.spots.wall = [];
  C.spots.tower = [];
  for (let i = 0; i < 26; i++) {
    const x = range(r, -230, 230);
    const z = range(r, -250, -60);
    const s = range(r, 1.2, 2.6);
    const y = H(x, z);
    rockInto(rocks, mRock, x, y + s * 0.3, z, s * 1.5, s, s * 1.2, 0xaf9672, r() * 6);
  }
  // 엄폐 바위 (허리 높이 → 일어서면 머리가 보임)
  for (let i = 0; i < 22; i++) {
    const x = range(r, -200, 200);
    const z = range(r, -210, -66);
    const y = H(x, z);
    rockInto(rocks, mRock, x, y, z, 1.6, 1.2, 0.9, 0xa98f6a, r() * 6);
    C.spots.cover.push({ type: "cover", pos: new THREE.Vector3(x, y, z - 1.15), yaw: 0 });
  }
  for (let i = 0; i < 40; i++) {
    const a = range(r, -1.4, 1.4);
    const d = range(r, 320, 900);
    const x = Math.sin(a) * d;
    const z = -Math.cos(a) * d - 60;
    const s = range(r, 10, 42);
    rockInto(rocks, mRock, x, H(x, z) + s * 0.1, z, s * 1.6, s * 0.9, s * 1.2, 0xa98f6a, r() * 6);
  }
  rocks.build(root, { name: "rocks" });

  /* 마을: 흙벽 건물 (길 두 개를 남김) */
  const roadZ = [-100, -168];
  const placeRow = (z, face, x0, x1) => {
    let x = x0;
    while (x < x1) {
      const bays = 2 + Math.floor(r() * 3);
      const w = bays * BAY;
      if (x < 12 && x + w > -12) {
        x = 12;
        continue;
      }
      const f = z > -100 ? 1 + Math.floor(r() * 2) : 1 + Math.floor(r() * 3);
      const open = [];
      for (let k = 0; k < 1 + Math.floor(r() * 2); k++) open.push({ bay: Math.floor(r() * bays), floor: Math.floor(r() * f) });
      C.building({ x: x + w / 2, z, face, bays, depthBays: 2 + Math.floor(r() * 2), floors: f, style: r() < 0.82 ? "adobe" : "sand", open, shop: false, roofProps: false });
      x += w + range(r, 1, 7);
    }
  };
  placeRow(-84, "pz", -200, 200);
  placeRow(-128, "pz", -210, 210);
  placeRow(-186, "pz", -220, 220);
  placeRow(-228, "pz", -210, 210);

  /* 벽 · 감시탑 · 천막 · 야자 · 차 */
  const p = new Batch();
  const walls = [
    [-150, -64, 40],
    [-60, -68, 32],
    [50, -66, 36],
    [150, -62, 40],
    [-110, -150, 30],
    [100, -148, 34],
  ];
  for (const [x, z, len] of walls) {
    p.add(mMud, worldBox(len, 2.9, 0.7, 3), mat4(x, 1.45, z), 0xc8ae86);
    for (let k = -len / 2 + 1; k < len / 2; k += 2.2) p.add(mMud, worldBox(1.1, 0.5, 0.75, 2), mat4(x + k, 3.1, z), 0xc0a67e);
    // 벽 끝에서 나오는 자리
    for (const s of [-1, 1]) {
      C.spots.wall.push({ type: "wall", pos: new THREE.Vector3(x + s * (len / 2 + 0.9), 0, z - 0.6), out: new THREE.Vector3(x + s * (len / 2 + 0.9), 0, z - 0.6), in: new THREE.Vector3(x + s * (len / 2 - 1.5), 0, z - 0.8), yaw: 0 });
    }
  }
  const towerAt = (x, z, h) => {
    for (const [sx, sz] of [
      [-1.5, -1.5],
      [1.5, -1.5],
      [-1.5, 1.5],
      [1.5, 1.5],
    ]) {
      p.add(M.bark, new THREE.CylinderGeometry(0.14, 0.17, h, 8), mat4(x + sx, h / 2, z + sz), 0xa89070);
    }
    for (const yy of [h * 0.35, h * 0.7]) {
      p.box(M.bark, 3.3, 0.12, 0.12, x, yy, z + 1.5, 0, 0x8d7656);
      p.box(M.bark, 3.3, 0.12, 0.12, x, yy, z - 1.5, 0, 0x8d7656);
      p.box(M.bark, 0.12, 0.12, 3.3, x + 1.5, yy, z, 0, 0x8d7656);
      p.box(M.bark, 0.12, 0.12, 3.3, x - 1.5, yy, z, 0, 0x8d7656);
    }
    p.box(M.bark, 4.2, 0.2, 4.2, x, h, z, 0, 0x7c6448);
    // 낮은 판자벽 (허리까지 → 가슴 위가 보임)
    p.box(M.bark, 4.2, 0.85, 0.1, x, h + 0.2, z + 2.05, 0, 0x8c7352);
    p.box(M.bark, 0.1, 0.85, 4.2, x - 2.05, h + 0.2, z, 0, 0x8c7352);
    p.box(M.bark, 0.1, 0.85, 4.2, x + 2.05, h + 0.2, z, 0, 0x8c7352);
    // 지붕
    for (const [sx, sz] of [
      [-1.9, -1.9],
      [1.9, -1.9],
      [-1.9, 1.9],
      [1.9, 1.9],
    ])
      p.box(M.bark, 0.1, 2.3, 0.1, x + sx, h + 0.2, z + sz, 0, 0x7c6448);
    p.add(mTarp, new THREE.BoxGeometry(4.8, 0.12, 4.8), mat4(x, h + 2.6, z), 0xffffff);
    C.spots.tower.push({ type: "tower", pos: new THREE.Vector3(x, h + 0.2, z + 0.6), yaw: 0 });
  };
  towerAt(-132, -76, 9);
  towerAt(132, -72, 10);
  towerAt(-60, -140, 11);
  towerAt(68, -138, 9);
  towerAt(-178, -180, 12);
  towerAt(178, -176, 11);
  // 천막
  const tentAt = (x, z, s) => {
    p.add(mTarp, new THREE.ConeGeometry(4.6 * s, 3 * s, 4), mat4(x, 1.5 * s, z, 0, Math.PI / 4), pick(r, [0xc9b98c, 0xa89c7a, 0x8d8a6a]));
    p.box(M.dark, 1.3 * s, 1.6 * s, 0.06, x, 0, z + 3.2 * s, 0, 0x181512);
  };
  for (let i = 0; i < 10; i++) {
    const x = range(r, -190, 190);
    const z = pick(r, [-58, -112, -152]);
    tentAt(x, z, range(r, 0.8, 1.2));
    C.spots.ground.push({ type: "ground", pos: new THREE.Vector3(x + 3, 0, z + 5.2), yaw: 0, along: [1, 0, 0], len: 3 });
  }
  // 시장 가판 (천 지붕)
  for (let i = 0; i < 14; i++) {
    const x = range(r, -130, 130);
    const z = roadZ[i % 2] + 7;
    if (Math.abs(x) < 8) continue;
    p.box(M.bark, 2.6, 0.9, 1.1, x, 0, z, 0, 0x6a543a);
    p.add(mTarp, new THREE.BoxGeometry(3.2, 0.06, 2), mat4(x, 2.3, z + 0.2, 0.18), pick(r, [0x9a4a32, 0x3f5e78, 0xb08a3a, 0x6b7a4a]));
    for (const [sx, sz] of [
      [-1.5, -0.9],
      [1.5, -0.9],
      [-1.5, 1.1],
      [1.5, 1.1],
    ])
      p.box(M.bark, 0.06, 2.3, 0.06, x + sx, 0, z + sz, 0, 0x5a4630);
  }
  // 드럼통 · 모래주머니 · 차
  for (let i = 0; i < 26; i++) p.cyl(M.paint, 0.3, 0.3, 0.9, range(r, -190, 190), 0, range(r, -210, -50), pick(r, [0x4f5a3a, 0x7a3a28, 0x4a4a48]), 12);
  for (let i = 0; i < 10; i++) sandbagsInto(p, M, range(r, -180, 180), 0, pick(r, [-58, -112, -156]), range(r, 3, 7), 0, 3);
  for (let i = 0; i < 14; i++) carInto(p, M, range(r, -190, 190), 0, roadZ[i % 2] + (i % 4 < 2 ? -6 : 6), r() < 0.5 ? 0 : Math.PI, pick(r, [0x8b7a58, 0x5a5f46, 0x9c8d70, 0x4a4438]), r);
  p.build(root, { name: "village" });
  const palms = new Batch();
  for (let i = 0; i < 24; i++) {
    const x = range(r, -210, 210);
    const z = pick(r, [-54, -74, -110, -150, -158, -206]) + range(r, -2, 2);
    palmInto(palms, M, x, z, range(r, 0.9, 1.5), r);
  }
  palms.build(root, { name: "palms", block: false });

  /* 자리 · 길 */
  for (let x = -190; x < 190; x += 16) {
    C.spots.ground.push({ type: "ground", pos: new THREE.Vector3(x + range(r, -4, 4), 0, -106 + range(r, -3, 3)), yaw: range(r, -0.5, 0.5), along: [1, 0, 0], len: 3 });
    C.spots.ground.push({ type: "ground", pos: new THREE.Vector3(x + range(r, -4, 4), 0, -170 + range(r, -3, 3)), yaw: range(r, -0.5, 0.5), along: [1, 0, 0], len: 3 });
    C.spots.ground.push({ type: "ground", pos: new THREE.Vector3(x + range(r, -4, 4), 0, -66 + range(r, -3, 3)), yaw: range(r, -0.5, 0.5), along: [1, 0, 0], len: 3 });
  }
  const v3 = (x, z) => new THREE.Vector3(x, 0, z);
  for (const z of roadZ) {
    C.spots.street.push({ type: "street", path: [v3(-185, z + 1.5), v3(185, z - 1.5)] });
    C.spots.street.push({ type: "street", path: [v3(170, z - 3), v3(-170, z + 2.5)] });
    C.spots.street.push({ type: "street", path: [v3(-120, z + 4), v3(120, z + 4)] });
  }
  C.spots.street.push({ type: "street", path: [v3(-200, -62), v3(200, -60)] });
  C.spots.street.push({ type: "street", path: [v3(0, -60), v3(0, -240)] });

  C.build(root);
  C.spots.roof = C.spots.roof.filter((sp) => sp.pos.z < -40);

  /* 움직이는 지프 */
  const movers = [];
  for (let i = 0; i < 3; i++) {
    const g = movingCar(M, pick(r, [0x8b7a58, 0x5a5f46]), r);
    const z = roadZ[i % 2] - 2;
    g.position.set(range(r, -180, 180), 0, z);
    const dir = i % 2 ? 1 : -1;
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    root.add(g);
    movers.push({ g, dir, speed: range(r, 5, 8) });
  }

  return {
    root,
    spots: C.spots,
    night: false,
    shadowCenter: new THREE.Vector3(0, 0, -130),
    shadowSize: 240,
    smoke: [
      { x: -300, y: H(-300, -600), z: -600, h: 260, s: 30 },
      { x: 220, y: H(220, -420), z: -420, h: 200, s: 22 },
    ],
    wind: [9, 0, -1],
    nest: { pos: nestPos, yaw: V.yaw, range: V.range, pitchMin: -0.42, pitchMax: 0.28 },
    update(dt) {
      for (const m of movers) {
        m.g.position.x += m.dir * m.speed * dt;
        if (m.g.position.x > 200) m.g.position.x = -200;
        if (m.g.position.x < -200) m.g.position.x = 200;
      }
    },
  };
}
