/*
 * 월드 공용 조각: 건물(진짜 열린 창 · 방 · 발코니 · 옥상), 차, 나무, 가로등, 모래주머니 …
 *  건물 외벽은 스타일마다 한 메쉬로 합침 (그리기 횟수 줄임)
 */
import { THREE, Quads, Batch, mat4, rng, pick, range, std, glow, glowTex, noise2, fbm, worldBox } from "../kit.js";
import { BAY, FLOOR, GROUND, WIN_W, WIN_H, WIN_Y, TILE_W, TILE_H, facade, shopfront, roofPBR, interiorTex, concretePBR, barkTex, leafTex, frondTex, FACADES } from "../textures.js";

/** 재질 모음 (월드 하나에 한 벌 · 밤이면 창이 빛남) */
export function cityMaterials(night, styles = ["paris", "brick", "stucco", "sand", "modern", "office", "brutal"]) {
  const M = { night, styles: {}, shops: [] };
  for (const k of styles) {
    const t = facade(k, k === "modern" || k === "office" ? 3 : 1, night);
    M.styles[k] = std({ map: t.map, roughnessMap: t.orm, metalnessMap: t.orm, normalMap: t.normal, normalScale: new THREE.Vector2(1, 1), roughness: 1, metalness: 1, emissiveMap: t.emissive || null, emissive: t.emissive ? 0xffffff : 0x000000, emissiveIntensity: t.emissive ? 0.95 : 0 });
  }
  for (let i = 0; i < 3; i++) {
    const t = shopfront(i + 1, night);
    M.shops.push(std({ map: t.map, roughnessMap: t.orm, metalnessMap: t.orm, normalMap: t.normal, roughness: 1, metalness: 1, emissiveMap: t.emissive || null, emissive: t.emissive ? 0xffffff : 0x000000, emissiveIntensity: t.emissive ? 0.85 : 0 }));
  }
  const roof = roofPBR();
  M.roof = std({ map: roof.map, normalMap: roof.normal, roughness: 0.95 });
  M.stone = std({ roughness: 0.85 });
  M.interior = std({ map: interiorTex(night), roughness: 0.9, emissiveMap: night ? interiorTex(true) : null, emissive: night ? 0xffd2a0 : 0x000000, emissiveIntensity: night ? 0.7 : 0 });
  M.metal = std({ roughness: 0.45, metalness: 0.6 });
  M.dark = std({ roughness: 0.6 });
  M.glass = std({ color: 0x2b3a46, roughness: 0.08, metalness: 0.9 });
  const con = concretePBR();
  M.concrete = std({ map: con.map, normalMap: con.normal, roughness: 0.94 });
  M.foliage = std({ roughness: 0.95, color: 0x1f2a17 });
  M.leaf = std({ map: leafTex(), alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, roughness: 0.82 });
  M.frond = std({ map: frondTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  M.bark = std({ map: barkTex(), roughness: 0.95 });
  M.paint = std({ roughness: 0.38, metalness: 0.55 });
  M.tire = std({ color: 0x151515, roughness: 0.9 });
  M.light = std({ emissive: 0xfff2cc, emissiveIntensity: night ? 3.2 : 0.4, roughness: 0.4 });
  M.fabric = std({ roughness: 0.95, side: THREE.DoubleSide });
  return M;
}

/**
 * 건물 하나
 *  o: { x, z (앞면 가운데 · 앞면이 바라보는 방향 face: 'pz' | 'px' | 'nx' | 'nz'), bays, depthBays, floors, style, shop, open: [{bay, floor}], balconies, roofProps }
 *  돌려줌: spots (window · balcony · roof)
 */
const FACE = {
  pz: { dir: [1, 0, 0], n: [0, 0, 1] },
  nz: { dir: [-1, 0, 0], n: [0, 0, -1] },
  px: { dir: [0, 0, -1], n: [1, 0, 0] },
  nx: { dir: [0, 0, 1], n: [-1, 0, 0] },
};

export class CityBuilder {
  constructor(M) {
    this.M = M;
    // 구역(100 m 칸)마다 따로 합침 → 화면 밖 구역은 안 그리고, 총알 판정도 빠름
    this.chunks = new Map();
    this.ck = "0,0";
    this.spots = { window: [], balcony: [], roof: [], street: [], car: [] };
    this.uOff = 0;
  }
  get C() {
    let c = this.chunks.get(this.ck);
    if (!c) {
      c = { style: {}, shop: this.M.shops.map(() => new Quads()), roof: new Quads(), interior: new Quads(), b: new Batch() };
      this.chunks.set(this.ck, c);
    }
    return c;
  }
  get b() {
    return this.C.b;
  }
  get shop() {
    return this.C.shop;
  }
  get roof() {
    return this.C.roof;
  }
  get interior() {
    return this.C.interior;
  }
  quadsFor(style) {
    const st = this.C.style;
    if (!st[style]) st[style] = new Quads();
    return st[style];
  }

  /** 외벽 한 면 (구멍 포함) */
  face(style, shopIdx, o, dir, n, bays, floors, holes, uOff) {
    const q = this.quadsFor(style);
    const w = bays * BAY;
    const T = this.tint;
    const low = [T[0] * 0.5, T[1] * 0.5, T[2] * 0.52];
    // 1층 (가게 줄 또는 같은 외벽) — 땅 쪽은 그늘져 어두움
    if (shopIdx >= 0) this.shop[shopIdx].wall(o, dir, w, GROUND, TILE_W, GROUND, uOff, 0, T, low);
    else q.wall(o, dir, w, GROUND, TILE_W, TILE_H, uOff, -GROUND, T, low);
    const at = (dist, y) => [o[0] + dir[0] * dist, o[1] + y, o[2] + dir[2] * dist];
    const holeSet = new Set(holes.map((h) => `${h.bay},${h.floor}`));
    for (let f = 0; f < floors; f++) {
      const y0 = GROUND + f * FLOOR;
      const rowHoles = [];
      for (let b = 0; b < bays; b++) if (holeSet.has(`${b},${f}`)) rowHoles.push(b);
      const vOff = f * FLOOR;
      if (!rowHoles.length) {
        q.wall(at(0, y0), dir, w, FLOOR, TILE_W, TILE_H, uOff, vOff, T);
        continue;
      }
      // 창 아래 · 위 띠
      q.wall(at(0, y0), dir, w, WIN_Y, TILE_W, TILE_H, uOff, vOff, T);
      q.wall(at(0, y0 + WIN_Y + WIN_H), dir, w, FLOOR - WIN_Y - WIN_H, TILE_W, TILE_H, uOff, vOff + WIN_Y + WIN_H, T);
      // 창 높이 띠: 구멍 사이만
      let x = 0;
      for (const b of rowHoles) {
        const hx = b * BAY + (BAY - WIN_W) / 2;
        if (hx > x) q.wall(at(x, y0 + WIN_Y), dir, hx - x, WIN_H, TILE_W, TILE_H, uOff + x, vOff + WIN_Y, T);
        x = hx + WIN_W;
        this.room(o, dir, n, hx, y0, uOff);
      }
      if (x < w) q.wall(at(x, y0 + WIN_Y), dir, w - x, WIN_H, TILE_W, TILE_H, uOff + x, vOff + WIN_Y, T);
    }
    return w;
  }

  /** 열린 창 안쪽 방 + 창틀 + 서 있을 자리 */
  room(o, dir, n, hx, y0, uOff) {
    const q = this.interior;
    const D = 3.2;
    const back = [-n[0] * D, 0, -n[2] * D];
    // 방은 창 칸(BAY) 크기
    const bx = hx - (BAY - WIN_W) / 2;
    const at = (dist, y, depth = 0) => [o[0] + dir[0] * dist - n[0] * depth, o[1] + y, o[2] + dir[2] * dist - n[2] * depth];
    // 뒷벽 (창 쪽을 봄)
    const dim = this.M.night ? [1, 1, 1] : [0.46, 0.46, 0.47];
    q.wall(at(bx, y0, D), dir, BAY, FLOOR, 3, 3, 0, 0, dim);
    // 옆벽 · 바닥 · 천장
    q.quad(at(bx, y0, 0), back, [0, FLOOR, 0], [0, 0, 1, 1], dim);
    q.quad(at(bx + BAY, y0, D), [-back[0], 0, -back[2]], [0, FLOOR, 0], [0, 0, 1, 1], dim);
    q.quad(at(bx, y0 + 0.01, 0), [dir[0] * BAY, 0, dir[2] * BAY], back, [0, 0, 1, 1], [0.3, 0.25, 0.22]);
    q.quad(at(bx, y0 + FLOOR - 0.05, D), [dir[0] * BAY, 0, dir[2] * BAY], [-back[0], 0, -back[2]], [0, 0, 1, 1], [0.42, 0.41, 0.4]);
    // 창틀
    const M = this.M;
    const cx = o[0] + dir[0] * (hx + WIN_W / 2) + n[0] * 0.04;
    const cz = o[2] + dir[2] * (hx + WIN_W / 2) + n[2] * 0.04;
    const yaw = Math.atan2(dir[0], dir[2]) - Math.PI / 2;
    const frame = (dx, dy, w, h) => {
      const px = cx + dir[0] * dx;
      const pz = cz + dir[2] * dx;
      this.b.add(M.stone, BOXG, mat4(px, y0 + dy, pz, 0, yaw, 0, w, h, 0.12), this.frameCol);
    };
    frame(0, WIN_Y - 0.03, WIN_W + 0.16, 0.08);
    frame(0, WIN_Y + WIN_H + 0.03, WIN_W + 0.16, 0.08);
    frame(-WIN_W / 2 - 0.04, WIN_Y + WIN_H / 2, 0.08, WIN_H + 0.12);
    frame(WIN_W / 2 + 0.04, WIN_Y + WIN_H / 2, 0.08, WIN_H + 0.12);
    // 커튼 (양쪽)
    for (const s of [-1, 1]) {
      const px = cx + dir[0] * s * (WIN_W / 2 - 0.12) - n[0] * 0.35;
      const pz = cz + dir[2] * s * (WIN_W / 2 - 0.12) - n[2] * 0.35;
      this.b.add(M.fabric, BOXG, mat4(px, y0 + WIN_Y + WIN_H / 2 + 0.1, pz, 0, yaw, 0, 0.26, WIN_H + 0.3, 0.04), pick(this.r || Math.random, [0xb9a184, 0x8f2f2f, 0x5a6b7d, 0xd8cdb8]));
    }
    // 서 있을 자리 (창에서 0.75 m 안쪽 · 바깥을 봄)
    const sx = cx - n[0] * 0.8;
    const sz = cz - n[2] * 0.8;
    this.spots.window.push({
      type: "window",
      pos: new THREE.Vector3(sx, y0, sz),
      out: new THREE.Vector3(cx - n[0] * 0.45, y0, cz - n[2] * 0.45),
      in: new THREE.Vector3(cx - n[0] * 1.9, y0, cz - n[2] * 1.9),
      yaw: Math.atan2(n[0], n[2]),
      floor: Math.round((y0 - GROUND) / FLOOR),
      n,
    });
  }

  /** 건물 전체 */
  building(o) {
    const r = this.r || (this.r = rng(1));
    this.frameCol = new THREE.Color((FACADES[o.style] || FACADES.paris).frame).multiplyScalar(0.8);
    this.ck = `${Math.floor(o.x / 100)},${Math.floor(o.z / 100)}`;
    // 같은 외벽 그림이라도 건물마다 밝기 · 색이 조금씩 다름
    const br = 0.78 + r() * 0.34;
    const warm = (r() - 0.5) * 0.09;
    this.tint = [br * (1 + warm), br, br * (1 - warm)];
    const f = FACE[o.face];
    const W = o.bays * BAY;
    const D = (o.depthBays || 4) * BAY;
    const floors = o.floors;
    const Htop = GROUND + floors * FLOOR;
    const n = f.n;
    const dir = f.dir;
    // 앞면 왼쪽 아래 모서리
    const fx = o.x - dir[0] * (W / 2);
    const fz = o.z - dir[2] * (W / 2);
    const corner = [fx, 0, fz];
    const back = [-n[0], 0, -n[2]];
    const uBase = Math.floor(r() * 4) * BAY;
    const shop = o.shop === false ? -1 : o.shop ?? Math.floor(r() * this.M.shops.length);
    // 앞면
    this.face(o.style, shop, corner, dir, n, o.bays, floors, o.open || [], uBase);
    // 오른쪽 면 (앞면 끝에서 뒤로)
    const c2 = [fx + dir[0] * W, 0, fz + dir[2] * W];
    this.face(o.style, -1, c2, back, dir, o.depthBays || 4, floors, [], uBase + W);
    // 뒷면
    const c3 = [c2[0] + back[0] * D, 0, c2[2] + back[2] * D];
    const ndir = [-dir[0], 0, -dir[2]];
    this.face(o.style, -1, c3, ndir, back, o.bays, floors, [], uBase);
    // 왼쪽 면
    const c4 = [fx + back[0] * D, 0, fz + back[2] * D];
    this.face(o.style, -1, c4, [n[0], 0, n[2]], [-dir[0], 0, -dir[2]], o.depthBays || 4, floors, [], uBase);
    // 지붕
    this.roof.quad([fx, Htop, fz], [dir[0] * W, 0, dir[2] * W], [back[0] * D, 0, back[2] * D], [0, 0, W / 8, D / 8]);
    // 난간 (지붕 둘레) + 처마
    const M = this.M;
    const yaw = Math.atan2(dir[0], dir[2]) - Math.PI / 2;
    const cap = o.style === "modern" ? 0x4a5359 : o.style === "brick" ? 0x6b6256 : o.style === "brutal" || o.style === "office" ? 0x75746f : 0x9c9585;
    const cx = fx + dir[0] * W / 2 + back[0] * D / 2;
    const cz = fz + dir[2] * W / 2 + back[2] * D / 2;
    const ph = o.style === "modern" ? 1.2 : 1.0;
    const edge = (ex, ez, len, ry) => this.b.add(M.stone, BOXG, mat4(ex, Htop + ph / 2, ez, 0, ry, 0, len, ph, 0.3), cap);
    edge(fx + dir[0] * W / 2 - n[0] * 0.15, fz + dir[2] * W / 2 - n[2] * 0.15, W, yaw);
    edge(fx + dir[0] * W / 2 + back[0] * (D - 0.15), fz + dir[2] * W / 2 + back[2] * (D - 0.15), W, yaw);
    edge(fx + dir[0] * 0.15 + back[0] * D / 2, fz + dir[2] * 0.15 + back[2] * D / 2, D, yaw + Math.PI / 2);
    edge(fx + dir[0] * (W - 0.15) + back[0] * D / 2, fz + dir[2] * (W - 0.15) + back[2] * D / 2, D, yaw + Math.PI / 2);
    // 지붕 코니스 (윤곽 · 그림자) · 모서리 기둥
    const wallCol = { paris: 0xa59d8c, brick: 0x5e3b30, stucco: 0x94866e, sand: 0x8f8671, modern: 0x2f363c, office: 0x7b7a75, brutal: 0x6f6e69 }[o.style] || 0x8f8f8f;
    this.b.add(M.stone, BOXG, mat4(fx + dir[0] * W / 2 + n[0] * 0.2, Htop - 0.12, fz + dir[2] * W / 2 + n[2] * 0.2, 0, yaw, 0, W + 0.5, 0.34, 0.55), cap);
    if (o.style !== "modern") {
      for (const a of [0.2, W - 0.2]) this.b.add(M.stone, BOXG, mat4(fx + dir[0] * a + n[0] * 0.09, Htop / 2, fz + dir[2] * a + n[2] * 0.09, 0, yaw, 0, 0.5, Htop, 0.2), wallCol);
    }
    // 처마 띠 (1층 위)
    this.b.add(M.stone, BOXG, mat4(fx + dir[0] * W / 2 + n[0] * 0.12, GROUND - 0.1, fz + dir[2] * W / 2 + n[2] * 0.12, 0, yaw, 0, W + 0.2, 0.25, 0.3), cap);
    // 발코니
    for (const bal of o.balconies || []) {
      const dist = bal.bay * BAY + BAY / 2;
      const y = GROUND + bal.floor * FLOOR;
      const bxp = fx + dir[0] * dist + n[0] * 0.65;
      const bzp = fz + dir[2] * dist + n[2] * 0.65;
      this.b.add(M.stone, BOXG, mat4(bxp, y - 0.08, bzp, 0, yaw, 0, 2.6, 0.18, 1.3), cap);
      // 난간 (총알은 지나감)
      const rail = this.railB || (this.railB = new Batch());
      rail.add(M.metal, BOXG, mat4(bxp + n[0] * 0.62, y + 0.55, bzp + n[2] * 0.62, 0, yaw, 0, 2.6, 0.05, 0.05), 0x22262a);
      for (let k = -6; k <= 6; k++) rail.add(M.metal, BOXG, mat4(bxp + n[0] * 0.62 + dir[0] * k * 0.2, y + 0.28, bzp + n[2] * 0.62 + dir[2] * k * 0.2, 0, yaw, 0, 0.025, 0.55, 0.025), 0x22262a);
      for (const s of [-1, 1]) rail.add(M.metal, BOXG, mat4(bxp + dir[0] * s * 1.28, y + 0.55, bzp + dir[2] * s * 1.28, 0, yaw, 0, 0.05, 0.05, 1.3), 0x22262a);
      this.spots.balcony.push({ type: "balcony", pos: new THREE.Vector3(bxp + n[0] * 0.1, y, bzp + n[2] * 0.1), yaw: Math.atan2(n[0], n[2]), n, floor: bal.floor });
    }
    // 옥상 물건 + 서 있을 자리
    if (o.roofProps !== false) this.roofProps(r, fx, fz, dir, back, W, D, Htop, yaw);
    for (let k = 0; k < 3; k++) {
      const dist = W * (0.2 + 0.3 * k) + range(r, -1, 1);
      this.spots.roof.push({ type: "roof", pos: new THREE.Vector3(fx + dir[0] * dist + back[0] * 1.1, Htop, fz + dir[2] * dist + back[2] * 1.1), yaw: Math.atan2(n[0], n[2]), n, h: Htop, along: dir.slice(), back: back.slice(), W, D, fx, fz });
    }
    return { Htop, W, D };
  }

  roofProps(r, fx, fz, dir, back, W, D, H, yaw) {
    const M = this.M;
    const P = (a, b) => [fx + dir[0] * a + back[0] * b, fz + dir[2] * a + back[2] * b];
    // 물탱크
    if (r() < 0.55) {
      const [x, z] = P(range(r, 3, W - 3), range(r, D * 0.45, D - 3));
      for (const [lx, lz] of [
        [-0.9, -0.9],
        [0.9, -0.9],
        [-0.9, 0.9],
        [0.9, 0.9],
      ])
        this.b.box(M.metal, 0.12, 2.2, 0.12, x + lx, H, z + lz, 0, 0x3b3b3b);
      this.b.cyl(M.paint, 1.35, 1.35, 2.6, x, H + 2.2, z, 0x6b5a48, 16);
      this.b.cyl(M.paint, 1.45, 0.05, 0.9, x, H + 4.8, z, 0x5a4a3a, 16);
    }
    // 실외기
    const ac = 1 + Math.floor(r() * 4);
    for (let i = 0; i < ac; i++) {
      const [x, z] = P(range(r, 2, W - 2), range(r, 2.5, D - 2));
      this.b.box(M.metal, 1.1, 0.9, 0.8, x, H, z, yaw, 0xc9ccce);
      this.b.cyl(M.dark, 0.32, 0.32, 0.04, x, H + 0.9, z, 0x2a2d30, 14);
    }
    // 환기구 · 안테나
    if (r() < 0.6) {
      const [x, z] = P(range(r, 2, W - 2), range(r, 3, D - 2));
      this.b.box(M.concrete, 2.2, 2.4, 2.2, x, H, z, yaw, 0xb8b4ac);
      this.b.box(M.dark, 0.9, 1.9, 0.06, x + dir[0] * 0.5 - back[0] * 1.12, H, z + dir[2] * 0.5 - back[2] * 1.12, yaw, 0x3a3027);
    }
    if (r() < 0.5) {
      const [x, z] = P(range(r, 2, W - 2), range(r, D * 0.5, D - 2));
      this.b.box(M.metal, 0.07, 6, 0.07, x, H, z, 0, 0x555a60);
      this.b.box(M.metal, 1.4, 0.05, 0.05, x, H + 4.8, z, yaw, 0x555a60);
      this.b.box(M.metal, 1, 0.05, 0.05, x, H + 5.4, z, yaw, 0x555a60);
    }
  }

  /** 모은 것을 메쉬로 */
  build(parent) {
    const out = [];
    const M = this.M;
    for (const c of this.chunks.values()) {
      for (const [k, q] of Object.entries(c.style)) out.push(...new Batch().quads(M.styles[k], q).build(parent, { name: `facade-${k}` }));
      c.shop.forEach((q, i) => out.push(...new Batch().quads(M.shops[i], q).build(parent, { name: "shop" })));
      out.push(...new Batch().quads(M.roof, c.roof).build(parent, { name: "roof" }));
      out.push(...new Batch().quads(M.interior, c.interior).build(parent, { name: "interior", cast: false }));
      out.push(...c.b.build(parent, { name: "props" }));
    }
    if (this.railB) out.push(...this.railB.build(parent, { block: false, name: "rail", cast: false }));
    return out;
  }
}

const BOXG = new THREE.BoxGeometry(1, 1, 1);

/* ---------- 차 ---------- */
let CAR_GEO = null;
function carGeo() {
  if (CAR_GEO) return CAR_GEO;
  const s = new THREE.Shape();
  // 옆모습 (길이 4.4 m · 높이 1.45 m)
  s.moveTo(-2.2, 0.32);
  s.lineTo(-2.2, 0.78);
  s.quadraticCurveTo(-2.15, 0.92, -1.85, 0.95);
  s.lineTo(-1.1, 1.0);
  s.quadraticCurveTo(-0.8, 1.42, -0.35, 1.45);
  s.lineTo(0.75, 1.45);
  s.quadraticCurveTo(1.15, 1.4, 1.45, 1.0);
  s.lineTo(2.05, 0.92);
  s.quadraticCurveTo(2.22, 0.88, 2.22, 0.7);
  s.lineTo(2.2, 0.32);
  s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: 1.76, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 8 });
  body.translate(0, 0, -0.88);
  const w = new THREE.Shape();
  w.moveTo(-1.02, 1.03);
  w.quadraticCurveTo(-0.75, 1.38, -0.33, 1.4);
  w.lineTo(0.72, 1.4);
  w.quadraticCurveTo(1.08, 1.36, 1.36, 1.03);
  w.closePath();
  const win = new THREE.ExtrudeGeometry(w, { depth: 1.8, bevelEnabled: false, curveSegments: 6 });
  win.translate(0, 0, -0.9);
  CAR_GEO = { body, win, wheel: new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14) };
  return CAR_GEO;
}
const CAR_COL = [0xb8b9bb, 0x1f2329, 0x8a1d1d, 0x23446e, 0xe8e6e0, 0x4a5a3a, 0x9a6b2b, 0x5a5f66, 0xd2b04a];
export function carInto(b, M, x, y, z, yaw, color, r) {
  const G = carGeo();
  const col = color ?? pick(r, CAR_COL);
  b.add(M.paint, G.body, mat4(x, y, z, 0, yaw, 0), col);
  b.add(M.glass, G.win, mat4(x, y + 0.01, z, 0, yaw, 0, 1, 1, 1), 0xffffff);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  for (const [lx, lz] of [
    [-1.35, -0.82],
    [1.35, -0.82],
    [-1.35, 0.82],
    [1.35, 0.82],
  ]) {
    b.add(M.tire, G.wheel, mat4(x + lx * c + lz * s, y + 0.34, z - lx * s + lz * c, Math.PI / 2, yaw, 0), 0xffffff);
  }
  // 앞뒤 등
  b.box(M.light, 0.06, 0.12, 0.35, x + 2.22 * c + 0.55 * s, y + 0.72, z - 2.22 * s + 0.55 * c, yaw, 0xfff6dc);
  b.box(M.light, 0.06, 0.12, 0.35, x + 2.22 * c - 0.55 * s, y + 0.72, z - 2.22 * s - 0.55 * c, yaw, 0xfff6dc);
  b.box(M.paint, 0.06, 0.12, 0.35, x - 2.22 * c + 0.6 * s, y + 0.75, z + 2.22 * s + 0.6 * c, yaw, 0xa01818);
  b.box(M.paint, 0.06, 0.12, 0.35, x - 2.22 * c - 0.6 * s, y + 0.75, z + 2.22 * s - 0.6 * c, yaw, 0xa01818);
}
/** 움직이는 차 (한 대 = 한 그룹) */
export function movingCar(M, color, r) {
  const g = new THREE.Group();
  const b = new Batch();
  carInto(b, M, 0, 0, 0, 0, color, r);
  b.build(g, { name: "car" });
  return g;
}

/* ---------- 나무 · 가로등 · 기타 ---------- */
function leafGeo() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const n = noise2(61);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 0.72 + 0.5 * fbm(n, v.x * 2.4 + 5, v.y * 2.4 + v.z * 2.4 + 5, 3);
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // 잎을 작게 (무늬를 여러 번 반복)
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.2, uv.getY(i) * 2.4);
  g.computeVertexNormals();
  return g;
}
const LEAF = leafGeo();
/** 나무 자리 기록 (표적이 나무에 가리는지 판단) */
export const TREES = { list: [] };
const TRUNK = new THREE.CylinderGeometry(1, 1, 1, 6);
export function treeInto(b, M, x, z, s, r, y = 0) {
  const h = 3.4 * s;
  TREES.list.push({ x, y: y + h + 1.1 * s, z, r: 2.1 * s });
  b.cyl(M.bark, 0.1 * s, 0.17 * s, h, x, y, z, 0xffffff, 8);
  for (const a of [0.7, 2.6, 4.5]) b.add(M.bark, TRUNK, mat4(x + Math.cos(a) * 0.5 * s, y + h * 0.82, z + Math.sin(a) * 0.5 * s, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7, 0.05 * s, 1.5 * s, 0.05 * s), 0xffffff);
  // 안쪽 어두운 덩어리 (잎 사이로 비침)
  b.add(M.foliage, LEAF, mat4(x, y + h + 0.5 * s, z, 0, r() * 3, 0, 1.45 * s, 1.15 * s, 1.45 * s), 0xffffff);
  b.add(M.foliage, LEAF, mat4(x + range(r, -0.5, 0.5) * s, y + h + 1.4 * s, z + range(r, -0.5, 0.5) * s, 0, r() * 3, 0, 1.05 * s, 0.9 * s, 1.05 * s), 0xffffff);
  // 겉 잎 덩어리: 아래는 어둡고 위는 밝음, 구멍이 숭숭
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const ang = r() * 6.28;
    const rad = (1 - t * 0.7) * 1.55 * s * (0.5 + r() * 0.6);
    const ry = h + (-0.25 + t * 2.5) * s;
    const sc = (1.0 - t * 0.35) * range(r, 0.72, 1.08) * s;
    const v = 0.55 + t * 0.6 + r() * 0.12;
    const warm = 1 + (r() - 0.5) * 0.14;
    const col = new THREE.Color(v * warm, v, v * (2 - warm) * 0.92);
    b.add(M.leaf, LEAF, mat4(x + Math.cos(ang) * rad, y + ry, z + Math.sin(ang) * rad, r() * 3, r() * 3, r() * 3, sc, sc * 0.85, sc), col);
  }
}
export function lampInto(b, M, x, z, h = 6, yaw = 0, y = 0) {
  b.cyl(M.metal, 0.08, 0.11, h, x, y, z, 0x2b2f33, 8);
  b.box(M.metal, 0.08, 0.08, 1.1, x + Math.sin(yaw) * 0.5, y + h - 0.05, z + Math.cos(yaw) * 0.5, yaw, 0x2b2f33);
  b.box(M.light, 0.4, 0.12, 0.6, x + Math.sin(yaw) * 1.0, y + h - 0.18, z + Math.cos(yaw) * 1.0, yaw, 0xffffff);
  return new THREE.Vector3(x + Math.sin(yaw) * 1.0, y + h - 0.3, z + Math.cos(yaw) * 1.0);
}
export function sandbagsInto(b, M, x, y, z, len, yaw, rows = 2) {
  const n = Math.max(1, Math.round(len / 0.62));
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const d = (i - (n - 1) / 2) * 0.62 + (j % 2 ? 0.31 : 0);
      b.add(M.fabric, PILLOW, mat4(x + Math.cos(yaw) * d, y + 0.12 + j * 0.22, z - Math.sin(yaw) * d, 0, yaw, 0, 0.32, 0.12, 0.2), j % 2 ? 0xb39c74 : 0xa58e66);
    }
}
const PILLOW = new THREE.SphereGeometry(1, 10, 6);

/** 반짝이는 가로등 불빛 (밤) */
export function lampGlows(parent, pts, color = 0xffd9a0, size = 5) {
  for (const p of pts) {
    const s = glow(color, size, 0.85);
    s.position.copy(p);
    parent.add(s);
  }
}

/** 땅 위 빛 웅덩이 (가로등 · 조명탑 아래) — 한 번에 그림 */
export function lightPools(parent, pts, color = 0xffc98a, size = 16, y = 0.16, opacity = 0.55) {
  const q = new Quads();
  for (const p of pts) q.quad([p.x - size / 2, y, p.z + size / 2], [size, 0, 0], [0, 0, -size], [0, 0, 1, 1]);
  const mat = new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const m = new THREE.Mesh(q.geometry(), mat);
  m.userData.block = false;
  m.renderOrder = 1;
  parent.add(m);
  return m;
}

/** 땅 · 길 (사각형 평면 · 세계 UV) */
export function groundPlane(parent, mat, x0, z0, x1, z1, y = 0, uvScale = 8, name = "ground") {
  const q = new Quads();
  q.quad([x0, y, z1], [x1 - x0, 0, 0], [0, 0, z0 - z1], [x0 / uvScale, -z1 / uvScale, x1 / uvScale, -z0 / uvScale]);
  const [m] = new Batch().quads(mat, q).build(parent, { cast: false, name });
  return m;
}


/* ---------- 내 저격 위치 (앞 난간 · 왼쪽 기둥 · 머리 위 슬래브 · 탄창 상자 · 탄피) ---------- */
export function nestInto(root, M, x, top, { tint = 0xffffff, frame = true } = {}) {
  const CON = concretePBR();
  const ledgeMat = std({ map: CON.map, normalMap: CON.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.96 });
  const col = (c) => new THREE.Color(c).multiply(new THREE.Color(tint));
  const ledge = new Batch();
  const lb = (w, h, d, bx, y, z, c) => ledge.add(ledgeMat, worldBox(w, h, d, 1.6), mat4(bx, y + h / 2, z), col(c));
  lb(16, 0.3, 0.62, x, top + 0.72, -13.72, 0xd8d5cc);
  lb(16, 0.75, 0.46, x, top, -13.8, 0xb5b2a9);
  ledge.build(root, { name: "ledge", block: false });
  if (frame) {
    const fr = new Batch();
    const fb = (w, h, d, bx, y, z, c) => fr.add(ledgeMat, worldBox(w, h, d, 1.6), mat4(bx, y + h / 2, z), col(c));
    fb(1.3, 12, 1.3, x - 4.9, top - 7, -17.2, 0xd0cdc5);
    fb(6.4, 0.55, 5.2, x - 7.2, top + 2.9, -15.0, 0xc4c1b9);
    fb(0.5, 0.75, 5.2, x - 4.25, top + 2.2, -15.0, 0xb5b2aa);
    fb(3.2, 0.8, 0.45, x - 5.7, top + 2.15, -17.4, 0xb5b2aa);
    fr.build(root, { name: "nest-frame", cast: false });
  }
  const nb = new Batch();
  sandbagsInto(nb, M, x - 3.4, top + 1.02, -13.72, 3.4, 0, 1);
  sandbagsInto(nb, M, x + 3.4, top + 1.02, -13.72, 3.4, 0, 1);
  nb.box(M.dark, 2.2, 0.06, 3.2, x, top + 0.01, -12.2, 0, 0x3a3d30);
  // 탄창 상자 (금속 뚜껑 + 모서리 놋쇠) · 탄피
  const px = x - 0.62;
  const py = top + 1.02;
  const pz = -13.56;
  nb.box(M.metal, 0.3, 0.075, 0.16, px, py, pz, 0.12, 0x2a2d2f);
  nb.box(M.metal, 0.31, 0.012, 0.17, px, py + 0.075, pz, 0.12, 0x46494b);
  for (let k = 0; k < 5; k++) nb.box(M.metal, 0.042, 0.008, 0.11, px - 0.1 + k * 0.05, py + 0.086, pz + k * 0.006, 0.12, 0x6b6e70);
  nb.box(M.paint, 0.022, 0.08, 0.17, px - 0.154, py, pz + 0.02, 0.12, 0x9a7a3c);
  nb.box(M.paint, 0.022, 0.08, 0.17, px + 0.154, py, pz - 0.02, 0.12, 0x9a7a3c);
  for (const [dx, dz, ry] of [
    [0.32, 0.12, 0.6],
    [0.42, -0.05, 2.1],
    [-0.42, 0.09, 1.3],
  ])
    nb.cyl(M.paint, 0.008, 0.009, 0.06, px + dx, py + 0.008, pz + dz, 0xb08d44, 8, Math.PI / 2, ry);
  nb.build(root, { name: "nest-props", block: false });
  return new THREE.Vector3(x, top + 1.62, -12.72);
}

/* ---------- 바위 ---------- */
const ROCKS = [];
function rockGeo(i) {
  if (ROCKS[i]) return ROCKS[i];
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const n = noise2(100 + i * 7);
  const v = new THREE.Vector3();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k);
    const f = 0.62 + 0.75 * fbm(n, v.x * 1.6 + 9, v.y * 1.6 + v.z * 1.6 + 9, 4);
    v.multiplyScalar(f);
    p.setXYZ(k, v.x, v.y, v.z);
    uv.setXY(k, uv.getX(k) * 4, uv.getY(k) * 2);
  }
  g.computeVertexNormals();
  ROCKS[i] = g;
  return g;
}
export function rockInto(b, mat, x, y, z, sx, sy, sz, col = 0xffffff, ry = 0) {
  b.add(mat, rockGeo(Math.abs(Math.round(x + z)) % 3), mat4(x, y, z, 0, ry, 0, sx, sy, sz), col);
}

/* ---------- 야자 ---------- */
const FROND = (() => {
  const g = new THREE.PlaneGeometry(0.95, 3.6, 1, 5);
  g.translate(0, 1.8, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 3.6;
    const zz = t * t * 1.7;
    p.setZ(i, p.getY(i) * 0.55);
    p.setY(i, p.getY(i) * 0.82 - zz * 2.1 + 0.3);
  }
  g.computeVertexNormals();
  return g;
})();
export function palmInto(b, M, x, z, s, r, y = 0) {
  const h = 6.5 * s;
  const lean = (r() - 0.5) * 0.14;
  let cx = x;
  const seg = 5;
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg;
    cx += lean * (h / seg);
    b.add(M.bark, TRUNK, mat4(cx, y + h * (t0 + 0.1), z, 0, 0, -lean, (0.2 - t0 * 0.08) * s, (h / seg) * 1.04, (0.2 - t0 * 0.08) * s), 0xc9b79a);
  }
  TREES.list.push({ x: cx, y: y + h + 0.3 * s, z, r: 1.7 * s });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + r() * 0.3;
    const c = 0.78 + r() * 0.4;
    b.add(M.frond, FROND, mat4(cx, y + h, z, -0.35 * (0.6 + r() * 0.5), a, 0, s, s, s), new THREE.Color(c, c, c * 0.95));
  }
}
