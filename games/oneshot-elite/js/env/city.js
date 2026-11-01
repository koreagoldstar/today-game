/*
 * WORLD 1 · CITY OPERATIONS (낮) / WORLD 4 · NIGHT HUNTER (밤) — 같은 도시 틀, 저격 위치 · 배치 · 시간이 미션마다 다름
 *  광장을 사이에 두고 앞줄 건물(창 · 발코니 · 옥상), 뒤줄 건물, 멀리 고층 빌딩, 양옆 건물, 앞으로 뻗은 큰길
 */
import { THREE, Batch, rng, pick, range, std, glow } from "../kit.js";
import { BAY, FLOOR, GROUND, asphaltPBR, pavePBR, grassPBR, neonTex, waterPBR } from "../textures.js";
import { cityMaterials, CityBuilder, carInto, movingCar, treeInto, lampInto, lampGlows, lightPools, groundPlane, nestInto } from "./common.js";

export const CITY_VANTAGE = {
  plaza: { x: 0, h: 26, yaw: 0, range: 0.95 },
  west: { x: -72, h: 38, yaw: -0.32, range: 0.9 },
  east: { x: 78, h: 31, yaw: 0.3, range: 0.9 },
  high: { x: 8, h: 52, yaw: 0.05, range: 0.85 },
  low: { x: -30, h: 15, yaw: 0.12, range: 0.9 },
};

export function buildCity(o) {
  const night = !!o.night;
  const r = rng(o.seed || 1);
  const root = new THREE.Group();
  const M = cityMaterials(night);
  const C = new CityBuilder(M);
  C.r = r;
  const V = CITY_VANTAGE[o.vantage] || CITY_VANTAGE.plaza;
  const AS = asphaltPBR();
  const PV = pavePBR();
  const GR = grassPBR();
  const asphalt = std({ map: AS.map, normalMap: AS.normal, roughness: night ? 0.42 : 0.9 });
  const pave = std({ map: PV.map, normalMap: PV.normal, roughness: night ? 0.5 : 0.88 });
  const grass = std({ map: GR.map, normalMap: GR.normal, roughness: 1 });

  /* 땅 · 길 · 광장 */
  groundPlane(root, asphalt, -1400, -1600, 1400, 400, 0, 26);
  groundPlane(root, pave, -100, -138, 100, -30, 0.06, 18, "plaza");
  for (const [x0, z0, x1, z1] of [
    [-92, -130, -18, -94],
    [18, -130, 92, -94],
    [-92, -76, -18, -40],
    [18, -76, 92, -40],
  ])
    groundPlane(root, grass, x0, z0, x1, z1, 0.09, 9, "lawn");
  // 앞줄 건물 앞 보도 · 옆 보도
  groundPlane(root, pave, -170, -156, 170, -152.5, 0.12, 18, "walk");
  groundPlane(root, pave, -170, -16, 170, -12, 0.12, 18, "walk");
  groundPlane(root, pave, -120, -152, -114, -16, 0.12, 18, "walk");
  groundPlane(root, pave, 114, -152, 120, -16, 0.12, 18, "walk");
  groundPlane(root, pave, -14, -900, -9, -156, 0.12, 18, "walk");
  groundPlane(root, pave, 9, -900, 14, -156, 0.12, 18, "walk");
  const lines = new Batch();
  for (let x = -160; x < 160; x += 6) lines.box(M.stone, 3, 0.02, 0.18, x, 0.03, -145, 0, 0x9a968a);
  for (let x = -160; x < 160; x += 6) lines.box(M.stone, 3, 0.02, 0.18, x, 0.03, -23, 0, 0x9a968a);
  for (let z = -170; z > -880; z -= 6) lines.box(M.stone, 0.18, 0.02, 3, 0, 0.03, z, 0, 0x9a968a);
  for (let i = 0; i < 9; i++) lines.box(M.stone, 0.7, 0.02, 7, -4 + i * 1.0, 0.03, -145, 0, 0xa9a598); // 횡단보도
  lines.build(root, { cast: false, receive: true, block: false, name: "lines" });

  /* 내 저격 위치 건물 (발밑 옥상 · 앞 난간이 화면 아래로 보임) */
  C.building({ x: V.x, z: -14, face: "nz", bays: 8, depthBays: 11, floors: Math.max(2, Math.round((V.h - GROUND) / FLOOR)), style: "brutal", open: [], roofProps: false, shop: 0 });
  const nestTop = GROUND + Math.max(2, Math.round((V.h - GROUND) / FLOOR)) * FLOOR;
  // 내 옆 줄 건물 (뒤에 있어 옆으로 고개 돌리면 보임)
  for (const side of [-1, 1]) {
    let x = V.x + side * 30;
    for (let i = 0; i < 4; i++) {
      const bays = 4 + Math.floor(r() * 3);
      const w = bays * BAY;
      x += side * (w / 2);
      C.building({ x, z: -12, face: "nz", bays, depthBays: 5, floors: 3 + Math.floor(r() * 5), style: pick(r, ["paris", "stucco", "brick", "sand"]), roofProps: true });
      x += side * (w / 2 + 2);
    }
  }

  /* 앞줄 (광장 건너편 · 나를 봄) */
  const frontStyles = ["paris", "stucco", "brutal", "brick", "paris", "office", "sand"];
  const opens = { front: [], back: [] };
  let x = -150;
  while (x < 150) {
    const bays = 4 + Math.floor(r() * 4);
    const w = bays * BAY;
    if (x < 10 && x + w > -10) {
      x = 10 + 0.5; // 큰길 자리
      continue;
    }
    const floors = 3 + Math.floor(r() * 5);
    const style = pick(r, frontStyles);
    const open = [];
    const nOpen = r() < 0.75 ? 1 + Math.floor(r() * 2) : 0;
    for (let k = 0; k < nOpen; k++) open.push({ bay: Math.floor(r() * bays), floor: Math.floor(r() * floors) });
    const balconies = [];
    if (style === "paris" || style === "stucco") {
      for (let k = 0; k < 1 + Math.floor(r() * 2); k++) balconies.push({ bay: Math.floor(r() * bays), floor: 1 + Math.floor(r() * (floors - 1)) });
      if (open.length && r() < 0.6) balconies.push({ ...open[0] });
    }
    C.building({ x: x + w / 2, z: -156.5, face: "pz", bays, depthBays: 5, floors, style, open, balconies });
    x += w + range(r, 0.3, 1.5);
  }
  /* 뒤줄 (더 높음) */
  x = -170;
  while (x < 170) {
    const bays = 5 + Math.floor(r() * 4);
    const w = bays * BAY;
    if (x < 12 && x + w > -12) {
      x = 12.5;
      continue;
    }
    const floors = 6 + Math.floor(r() * 6);
    const style = pick(r, ["brutal", "office", "modern", "paris", "sand", "brick"]);
    const open = r() < 0.6 ? [{ bay: Math.floor(r() * bays), floor: 2 + Math.floor(r() * (floors - 2)) }] : [];
    C.building({ x: x + w / 2, z: -186, face: "pz", bays, depthBays: 6, floors, style, open });
    x += w + range(r, 1, 3);
  }
  /* 양옆 줄 */
  for (const side of [-1, 1]) {
    let z = -36;
    while (z > -142) {
      const bays = 3 + Math.floor(r() * 3);
      const w = bays * BAY;
      if (z - w < -146) break;
      const floors = 3 + Math.floor(r() * 5);
      const open = r() < 0.7 ? [{ bay: Math.floor(r() * bays), floor: Math.floor(r() * floors) }] : [];
      C.building({ x: side * 121, z: z - w / 2, face: side < 0 ? "px" : "nx", bays, depthBays: 5, floors, style: pick(r, ["paris", "stucco", "brick", "brutal", "office"]), open, balconies: r() < 0.5 ? [{ bay: Math.floor(r() * bays), floor: 1 + Math.floor(r() * (floors - 1)) }] : [] });
      z -= w + range(r, 0.5, 2);
    }
  }
  /* 큰길 양쪽 (멀리 사라지는 거리) */
  for (const side of [-1, 1]) {
    let z = -205;
    while (z > -620) {
      const bays = 4 + Math.floor(r() * 4);
      const w = bays * BAY;
      C.building({ x: side * 18.5, z: z - w / 2, face: side < 0 ? "px" : "nx", bays, depthBays: 4, floors: 4 + Math.floor(r() * 8), style: pick(r, ["brutal", "brick", "office", "sand", "modern", "paris"]), roofProps: r() < 0.4 });
      z -= w + range(r, 1, 3);
    }
  }
  /* 멀리 고층 빌딩 */
  for (let i = 0; i < 46; i++) {
    const ang = range(r, -1.15, 1.15);
    const d = range(r, 300, 720);
    const bays = 5 + Math.floor(r() * 6);
    const floors = 9 + Math.floor(r() * 18);
    C.building({ x: Math.sin(ang) * d, z: -Math.cos(ang) * d - 120, face: "pz", bays, depthBays: 5 + Math.floor(r() * 4), floors, style: pick(r, ["modern", "office", "brutal", "modern", "office"]), roofProps: false, shop: false });
  }

  /* 광장: 분수 · 나무 · 가로등 · 벤치 · 매점 */
  const P = new Batch();
  P.cyl(M.stone, 8, 8.3, 0.75, 0, 0.06, -84, 0x8d887c, 40);
  P.cyl(M.stone, 1.1, 1.4, 3.2, 0, 0.06, -84, 0x8d887c, 18);
  P.cyl(M.stone, 2.6, 1.2, 0.5, 0, 3.2, -84, 0x8d887c, 24);
  const WT = waterPBR();
  const water = new THREE.Mesh(new THREE.CircleGeometry(7.6, 40), std({ map: WT.map, normalMap: WT.normal, normalScale: new THREE.Vector2(0.4, 0.4), color: night ? 0x22313d : 0x56666f, roughness: 0.06, metalness: 0.7 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.62, -84);
  water.userData.block = false;
  root.add(water);
  const lamps = [];
  const trees = new Batch();
  for (const [x0, z0, x1, z1] of [
    [-92, -130, -18, -94],
    [18, -130, 92, -94],
    [-92, -76, -18, -40],
    [18, -76, 92, -40],
  ]) {
    // 잔디밭마다 나무 무리 (걷는 길은 띄움)
    for (let k = 0; k < 16; k++) {
      const tx = range(r, x0 + 3, x1 - 3);
      const tz = range(r, z0 + 3, z1 - 3);
      treeInto(trees, M, tx, tz, range(r, 1.25, 2.1), r, 0.09);
    }
  }
  for (let i = -4; i <= 4; i++) {
    lamps.push(lampInto(P, M, i * 22, -36, 6.5, Math.PI));
    lamps.push(lampInto(P, M, i * 22 + 11, -134, 6.5, 0));
  }
  for (let k = 0; k < 10; k++) {
    const bx = range(r, -85, 85);
    const bz = pick(r, [-58, -112]);
    P.box(M.paint, 2, 0.08, 0.6, bx, 0.48, bz, 0, 0x6b4a2b);
    P.box(M.paint, 2, 0.5, 0.06, bx, 0.55, bz - 0.28, 0, 0x6b4a2b);
    P.box(M.metal, 0.08, 0.48, 0.5, bx - 0.9, 0.06, bz, 0, 0x2b2f33);
    P.box(M.metal, 0.08, 0.48, 0.5, bx + 0.9, 0.06, bz, 0, 0x2b2f33);
  }
  // 매점 · 광고탑
  P.box(M.paint, 4, 2.6, 3, -42, 0.06, -98, 0.3, 0x2f5b46);
  P.box(M.paint, 4.6, 0.25, 3.6, -42, 2.66, -98, 0.3, 0xe8e4d6);
  P.cyl(M.paint, 0.7, 0.7, 3.4, 44, 0.06, -100, 0x8a3b2b, 16);
  P.cyl(M.paint, 0.85, 0.85, 0.3, 44, 3.46, -100, 0x2b2f33, 16);
  // 가로수 (앞줄 보도)
  for (let xx = -140; xx < 140; xx += 15) if (Math.abs(xx) > 14) treeInto(trees, M, xx + range(r, -2, 2), -150.5, range(r, 0.8, 1.05), r);
  for (let zz = -170; zz > -560; zz -= 16) {
    treeInto(trees, M, -10.5, zz, 0.9, r);
    treeInto(trees, M, 10.5, zz - 8, 0.9, r);
    lamps.push(lampInto(P, M, -11.5, zz - 4, 7, Math.PI / 2));
  }
  P.build(root, { name: "plaza-props" });
  trees.build(root, { name: "trees", block: false });

  /* 세워 둔 차 (뒤에 숨을 수 있음) */
  const cars = new Batch();
  const carSpots = [];
  for (let xx = -150; xx < 150; xx += range(r, 6.5, 11)) {
    if (Math.abs(xx) < 12 || r() < 0.25) continue;
    carInto(cars, M, xx, 0, -141.2, r() < 0.5 ? 0 : Math.PI, null, r);
    carSpots.push({ type: "car", pos: new THREE.Vector3(xx + range(r, -0.8, 0.8), 0.12, -143.6), yaw: 0 });
  }
  for (let xx = -150; xx < 150; xx += range(r, 7, 12)) {
    if (Math.abs(xx - V.x) < 18 || r() < 0.3) continue;
    carInto(cars, M, xx, 0, -26.5, r() < 0.5 ? 0 : Math.PI, null, r);
  }
  for (let zz = -175; zz > -560; zz -= range(r, 8, 14)) carInto(cars, M, r() < 0.5 ? -6.5 : 6.5, 0, zz, Math.PI / 2, null, r);
  cars.build(root, { name: "cars" });
  C.spots.car = carSpots;

  /* 걷는 길 (민간인 · 순찰) */
  const S = C.spots.street;
  const v = (x, z, y = 0.12) => new THREE.Vector3(x, y, z);
  S.push({ type: "street", path: [v(-95, -150), v(95, -150)] });
  S.push({ type: "street", path: [v(95, -151.3), v(-95, -151.3)] });
  S.push({ type: "street", path: [v(-85, -42), v(-20, -70), v(20, -98), v(85, -128)], y: 0.06 });
  S.push({ type: "street", path: [v(85, -44), v(30, -70), v(-30, -100), v(-85, -126)] });
  S.push({ type: "street", path: [v(-80, -60), v(80, -60)] });
  S.push({ type: "street", path: [v(80, -108), v(-80, -108)] });
  S.push({ type: "street", path: [v(-117, -40), v(-117, -140)] });
  S.push({ type: "street", path: [v(117, -140), v(117, -40)] });
  S.push({ type: "street", path: [v(-11.5, -165), v(-11.5, -330)] });
  S.push({ type: "street", path: [v(11.5, -330), v(11.5, -165)] });

  /* 밤: 네온 · 가로등 빛 · 달 */
  if (night) {
    lampGlows(root, lamps, 0xffd49a, 4.5);
    lightPools(root, lamps, 0xffc98a, 20, 0.16, 0.6);
    const neon = ["HOTEL", "BAR", "24H", "CLUB", "CAFE", "NEWS"];
    const cols = ["#ff3f6c", "#3fe0ff", "#ffd23f", "#b46bff", "#5dff8a", "#ff8a3f"];
    for (let i = 0; i < 9; i++) {
      const w = C.spots.window[i % C.spots.window.length];
      const nx = range(r, -130, 130);
      if (Math.abs(nx) < 14) continue;
      const tx = neonTex(pick(r, neon), pick(r, cols));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 2), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false, fog: true }));
      m.position.set(nx, GROUND + 0.6 + r() * 2, -156.3);
      m.userData.block = false;
      root.add(m);
      const g = glow(0xffffff, 9, 0.18);
      g.position.copy(m.position).add(new THREE.Vector3(0, 0, 0.4));
      root.add(g);
      void w;
    }
    const moon = glow(0xdfe8ff, 120, 0.9);
    moon.position.set(-600, 520, -1800);
    root.add(moon);
  }

  const meshes = C.build(root);
  void meshes;

  /* 움직이는 차 */
  const movers = [];
  for (let i = 0; i < 5; i++) {
    const g = movingCar(M, null, r);
    const lane = i % 2 ? -147.5 : -142.8;
    const dir = i % 2 ? -1 : 1;
    g.position.set(range(r, -160, 160), 0, lane);
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    root.add(g);
    movers.push({ g, dir, speed: range(r, 7, 12), axis: "x", min: -170, max: 170 });
  }
  for (let i = 0; i < 4; i++) {
    const g = movingCar(M, null, r);
    const dir = i % 2 ? 1 : -1;
    g.position.set(dir > 0 ? 3 : -3, 0, range(r, -600, -170));
    g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    root.add(g);
    movers.push({ g, dir: -dir, speed: range(r, 8, 13), axis: "z", min: -650, max: -160 });
  }
  if (night) {
    for (const m of movers) {
      const hl = glow(0xfff2d0, 3.2, 0.9);
      hl.position.set(2.3, 0.7, 0);
      m.g.add(hl);
    }
  }

  /* 발밑 낮은 건물 (옥상 정원 — 시야 앞쪽을 채움) */
  const LOW = new CityBuilder(M);
  LOW.r = r;
  const garden = new Batch();
  for (const side of [-1, 1]) {
    let bx = V.x + side * 34;
    for (let i = 0; i < 4; i++) {
      const bays = 3 + Math.floor(r() * 3);
      const w = bays * BAY;
      bx += side * (w / 2);
      const floors = 1 + Math.floor(r() * 3);
      const fx = bx;
      LOW.building({ x: fx, z: -29, face: "pz", bays, depthBays: 3, floors, style: pick(r, ["brutal", "office", "sand", "stucco"]), shop: false, roofProps: r() < 0.4 });
      const top = GROUND + floors * FLOOR;
      for (let k = 0; k < 3 + Math.floor(r() * 4); k++) {
        const gx = fx + range(r, -w / 2 + 1.5, w / 2 - 1.5);
        const gz = -29 - range(r, 1.5, 3 * BAY - 1.5);
        garden.box(M.concrete, 1.8, 0.45, 1.8, gx, top, gz, 0, 0x8d8b84);
        treeInto(garden, M, gx, gz, range(r, 0.45, 0.8), r, top + 0.4);
      }
      bx += side * (w / 2 + range(r, 0.5, 3));
    }
  }
  LOW.build(root);
  garden.build(root, { name: "garden", block: false });

  /* 내 저격 위치 */
  const nestPos = nestInto(root, M, V.x, nestTop);

  // 내 건물 · 옆 건물 옥상은 표적 자리에서 뺌
  C.spots.roof = C.spots.roof.filter((sp) => sp.pos.z < -40);
  return {
    root,
    spots: C.spots,
    night,
    shadowCenter: new THREE.Vector3(V.x * 0.4, 0, -110),
    shadowSize: 190,
    smoke: [
      { x: -210, y: 30, z: -560, h: 240, s: 34 },
      { x: 150, y: 24, z: -430, h: 200, s: 26 },
      { x: 330, y: 20, z: -700, h: 300, s: 44 },
    ],
    nest: { pos: nestPos, yaw: V.yaw, range: V.range, pitchMin: -0.42, pitchMax: 0.32 },
    update(dt) {
      for (const m of movers) {
        const p = m.g.position;
        p[m.axis] += m.dir * m.speed * dt;
        if (p[m.axis] > m.max) p[m.axis] = m.min;
        if (p[m.axis] < m.min) p[m.axis] = m.max;
      }
    },
  };
}
