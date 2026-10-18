/*
 * 하늘섬 대탈출 · 첫 번째 스테이지 '구름 마을' 코스
 *
 *  1 구름 마을 출발지 → 2 기본 이동 · 점프 → 3 작은 발판 → 4 움직이는 발판 → 5 무너지는 돌다리
 *  → 6 에너지 구슬(점프대) → 7 바람(상승기류 · 옆바람 다리 · 바람 고리) → 8 연속 장애물(회전 나무 기둥 · 구름 발판 · 점프대)
 *  → 9 무너지는 하늘섬 탈출 → 10 비행선 착지
 *
 *  충돌 모양은 보이는 모양과 같게 만든다:
 *   - 둥근 섬 · 돌 발판 · 구름 = 원판(disc): 윗면 원 + 가장자리 1.2m 높이의 옆벽
 *   - 다리 · 판자 · 통나무 · 집 · 나무 기둥 = 상자(box)
 *   - 밧줄 난간 = 막는 벽(rail, 밟을 수는 없음)
 *   - 회전 나무 기둥의 팔 = 선분(캡슐)과 닿으면 튕겨 나감
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { islandGeo, roundedBox, taperTube, ropeGeo, part, bake, shadeVerts, mergeByMaterial, fbm3 } from "./geo.js?v=1";
import { cobbleTex, crackTex, windTex, ringTex, dotTex, seeded, groundTex, glowTex, strataTex } from "./tex.js?v=1";
import { roundTree, mushroomHouse, Waterfall, Flag, Airship } from "./world.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** 판 위 평면 UV (x,z 기준) */
function planarUV(geo, s = 0.3) {
  const p = geo.getAttribute("position");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) * s;
    uv[i * 2 + 1] = p.getZ(i) * s;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
/** 돌림체 UV 를 실제 크기에 맞춰 늘림 (무늬가 늘어나지 않게) */
function scaleUV(geo, su, sv) {
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

/**
 * 스테이지 재질: 땅 윗면(grass) · 바위 옆면(rock) 무늬를 스테이지마다 바꾸고, 잎 · 나무 · 돌 색도 바꾼다.
 *  o = { ground: "sand", strata: "canyon", glow: 0.8, leaf: "#..", ... }
 */
export function stageMaterials(M, o) {
  const out = {};
  if (o.ground) {
    const t = groundTex(o.ground);
    const opt = { map: t, roughness: o.groundRough ?? 0.95, vertexColors: true };
    if (o.glow) Object.assign(opt, { emissive: "#ffffff", emissiveMap: glowTex(o.ground), emissiveIntensity: o.glow });
    out.grass = new THREE.MeshStandardMaterial(opt);
  }
  if (o.strata) out.rock = new THREE.MeshStandardMaterial({ map: strataTex(o.strata), roughness: 0.95, vertexColors: true, ...(o.rockEmissive ? { emissive: o.rockEmissive, emissiveIntensity: 0.25 } : {}) });
  for (const k of ["leaf", "leafDk", "trunk", "stone", "wood", "woodDark", "cloth", "roof", "castle", "cap", "stem", "flower"]) {
    if (!o[k]) continue;
    const m = M[k].clone();
    m.color.set(o[k]);
    out[k] = m;
  }
  return out;
}

export class Course {
  constructor(scene, world, fx, { quality = 1, stage } = {}) {
    this.def = stage;
    this.scene = scene;
    this.world = world;
    this.fx = fx;
    this.q = quality;
    // 스테이지 재질 (없으면 공용 재질 그대로)
    this.ownMats = [];
    this.M = world.M;
    if (stage.mats) {
      const sm = stageMaterials(world.M, stage.mats);
      this.ownMats = Object.values(sm);
      this.M = { ...world.M, ...sm };
    }
    world.stageM = this.M;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.solids = [];
    this.movers = [];
    this.crumbles = [];
    this.clouds = [];
    this.sweepers = [];
    this.fans = [];
    this.vents = [];
    this.rings = [];
    this.pads = [];
    this.orbs = [];
    this.checkpoints = [];
    this.passes = [];
    this.flags = [];
    this.anim = [];
    this.path = [];
    this.killY = stage.killY ?? -24;
    this.t = 0;
    // 스테이지마다 있을 수도 · 없을 수도 있는 것들
    this.tiles = [];
    this.pillars = [];
    this.debris = [];
    this.bigRocks = [];
    this.collapse = null;
    this.mechs = []; // mechs.js 의 장치들 (update · reset · 위험)
    this.winds = []; // mechs.js 바람 구역
    this.boss = null;
    this.ship = null;
    this.deck = null;
    this.extra = {
      tileTop: new THREE.MeshStandardMaterial({ map: this.M.grass.map, roughness: 0.95, vertexColors: true }),
      cobble: new THREE.MeshStandardMaterial({ map: cobbleTex(), roughness: 0.9 }),
      crack: new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      plank: this.M.wood,
      cloud: world.cloudMat,
      pad: new THREE.MeshStandardMaterial({ color: "#ff8ac4", roughness: 0.45, emissive: "#ff4aa0", emissiveIntensity: 0.35 }),
      padStem: new THREE.MeshStandardMaterial({ color: "#fff0e0", roughness: 0.7 }),
      orb: new THREE.MeshStandardMaterial({ color: "#2ad0ff", emissive: "#0a8ad8", emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.2 }),
      orbShell: new THREE.MeshBasicMaterial({ color: "#1aa8ff", transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
      big: new THREE.MeshStandardMaterial({ color: "#ffe9a0", emissive: "#ffb83a", emissiveIntensity: 1.8, roughness: 0.15 }),
      wind: new THREE.MeshBasicMaterial({ map: windTex(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      ring: new THREE.MeshStandardMaterial({ color: "#9af4ff", emissive: "#3ad0ff", emissiveIntensity: 1.4, roughness: 0.2 }),
      glowRing: new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, color: "#9af4ff" }),
      cpOff: new THREE.MeshStandardMaterial({ color: "#8ab0c8", emissive: "#2a4a6a", emissiveIntensity: 0.3, roughness: 0.2, flatShading: true }),
      cpOn: new THREE.MeshStandardMaterial({ color: "#9affc4", emissive: "#2aff8a", emissiveIntensity: 1.6, roughness: 0.2, flatShading: true }),
    };
    this.build();
  }

  /* ================================================================
   * 충돌 세계
   * ============================================================== */
  addSolid(s) {
    const solid = { type: "box", active: true, dx: 0, dy: 0, dz: 0, ...s };
    this.solids.push(solid);
    return solid;
  }
  disc(cx, cz, rad, top, extra = {}) {
    return this.addSolid({ type: "disc", cx, cz, rad, y1: top, y0: top - 1.2, x0: cx - rad, x1: cx + rad, z0: cz - rad, z1: cz + rad, ...extra });
  }
  box(x0, x1, y0, y1, z0, z1, extra = {}) {
    return this.addSolid({ x0, x1, y0, y1, z0, z1, ...extra });
  }
  topAt(s, x, z) {
    if (s.type === "ramp") {
      const t = (z - s.z1) / (s.z0 - s.z1);
      return s.h0 + (s.h1 - s.h0) * clamp(t, 0, 1);
    }
    return s.y1;
  }
  /** 발밑 땅: (x,z) 에서 maxTop 이하인 가장 높은 윗면 */
  ground(x, z, r, maxTop) {
    let best = -Infinity;
    let bs = null;
    const e = r * 0.45;
    for (const s of this.solids) {
      if (!s.active || s.rail) continue;
      if (s.type === "disc") {
        if ((x - s.cx) ** 2 + (z - s.cz) ** 2 > (s.rad + e) ** 2) continue;
      } else if (x < s.x0 - e || x > s.x1 + e || z < s.z0 - e || z > s.z1 + e) continue;
      const h = this.topAt(s, clamp(x, s.x0, s.x1), clamp(z, s.z0, s.z1));
      if (h <= maxTop && h > best) {
        best = h;
        bs = s;
      }
    }
    return bs ? { h: best, s: bs } : null;
  }
  /** 옆으로 막기 (원 ↔ 상자 · 원판 가장자리) */
  walls(pos, r, feetY, height, step) {
    for (const s of this.solids) {
      if (!s.active) continue;
      if (s.y0 >= feetY + height || s.y1 <= feetY + step) continue;
      if (s.type === "disc") {
        const dx = pos.x - s.cx;
        const dz = pos.z - s.cz;
        const d = Math.hypot(dx, dz);
        const lim = s.rad + r * 0.6;
        if (d < lim && d > 1e-4) {
          pos.x = s.cx + (dx / d) * lim;
          pos.z = s.cz + (dz / d) * lim;
        }
        continue;
      }
      if (pos.x < s.x0 - r || pos.x > s.x1 + r || pos.z < s.z0 - r || pos.z > s.z1 + r) continue;
      const top = this.topAt(s, clamp(pos.x, s.x0, s.x1), clamp(pos.z, s.z0, s.z1));
      if (top <= feetY + step && !s.rail) continue;
      const cx = clamp(pos.x, s.x0, s.x1);
      const cz = clamp(pos.z, s.z0, s.z1);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x += (dx / d) * (r - d);
        pos.z += (dz / d) * (r - d);
      } else {
        const l = pos.x - s.x0;
        const rr = s.x1 - pos.x;
        const b = pos.z - s.z0;
        const f = s.z1 - pos.z;
        const m = Math.min(l, rr, b, f);
        if (m === l) pos.x = s.x0 - r;
        else if (m === rr) pos.x = s.x1 + r;
        else if (m === b) pos.z = s.z0 - r;
        else pos.z = s.z1 + r;
      }
    }
  }
  /** 머리 위 (섬 아랫면 · 판자) */
  ceiling(x, z, r, headY, newHeadY) {
    let low = Infinity;
    for (const s of this.solids) {
      if (!s.active || s.rail) continue;
      if (s.type === "disc") {
        if ((x - s.cx) ** 2 + (z - s.cz) ** 2 > (s.rad - r) ** 2) continue;
      } else if (x < s.x0 + r * 0.4 || x > s.x1 - r * 0.4 || z < s.z0 + r * 0.4 || z > s.z1 - r * 0.4) continue;
      if (s.y0 >= headY - 0.01 && s.y0 <= newHeadY) low = Math.min(low, s.y0);
    }
    return low === Infinity ? null : low;
  }
  /** 카메라 광선이 처음 닿는 거리 (섬 · 다리에 카메라가 파묻히지 않게) */
  ray(o, dir, maxD) {
    let best = maxD;
    for (const s of this.solids) {
      if (!s.active || s.rail || s.noCam) continue;
      let tmin = 0;
      let tmax = best;
      let ok = true;
      for (const [oo, dd, a, b] of [
        [o.x, dir.x, s.x0, s.x1],
        [o.y, dir.y, s.y0 - (s.type === "disc" ? 2 : 0), s.y1],
        [o.z, dir.z, s.z0, s.z1],
      ]) {
        if (Math.abs(dd) < 1e-9) {
          if (oo < a || oo > b) {
            ok = false;
            break;
          }
        } else {
          let t1 = (a - oo) / dd;
          let t2 = (b - oo) / dd;
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            ok = false;
            break;
          }
        }
      }
      if (ok && tmin < best && tmin > 0.2) best = tmin;
    }
    return best;
  }
  /** 바람: 옆바람 장치 (x,z) + 상승기류 (y) */
  windAt(pos, out) {
    out.set(0, 0, 0);
    for (const f of this.fans) {
      if (f.power <= 0) continue;
      const z = f.zone;
      if (pos.x < z.x0 || pos.x > z.x1 || pos.z < z.z0 || pos.z > z.z1 || pos.y < z.y0 || pos.y > z.y1) continue;
      out.x += f.dir.x * f.strength * f.power;
      out.z += f.dir.z * f.strength * f.power;
    }
    for (const f of this.winds) {
      if (f.power <= 0.01) continue;
      const z = f.zone;
      if (pos.x < z.x0 || pos.x > z.x1 || pos.z < z.z0 || pos.z > z.z1 || pos.y < z.y0 || pos.y > z.y1) continue;
      out.x += f.dir.x * f.strength * f.power;
      out.z += f.dir.z * f.strength * f.power;
    }
    for (const v of this.vents) {
      const d = Math.hypot(pos.x - v.x, pos.z - v.z);
      if (d < v.r && pos.y > v.y - 0.2 && pos.y < v.top) out.y += v.lift * (1 - (d / v.r) * 0.4);
    }
    return out;
  }
  /** 길 위 진행 (0~1) · 그 지점의 앞 방향 · 시작부터 거리(m) */
  progress(pos, out = {}) {
    const P = this.path;
    let best = 0;
    let bd = Infinity;
    let bu = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i];
      const b = P[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const L2 = abx * abx + abz * abz || 1;
      const u = clamp(((pos.x - a.x) * abx + (pos.z - a.z) * abz) / L2, 0, 1);
      const px = a.x + abx * u;
      const pz = a.z + abz * u;
      const d = (pos.x - px) ** 2 + (pos.z - pz) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
        bu = u;
      }
    }
    const a = P[best];
    const b = P[Math.min(P.length - 1, best + 1)];
    out.dist = this.pathLen[best] + (this.pathLen[best + 1] - this.pathLen[best] || 0) * bu;
    out.k = out.dist / this.total;
    out.y = a.y + (b.y - a.y) * bu;
    out.dx = b.x - a.x;
    out.dz = b.z - a.z;
    const l = Math.hypot(out.dx, out.dz) || 1;
    out.dx /= l;
    out.dz /= l;
    out.seg = best;
    return out;
  }

  /* ================================================================
   * 짓기 도우미 (보이는 것 + 충돌)
   * ============================================================== */
  /** 둥근 떠 있는 섬 (윗면 = 충돌 원판) */
  island(x, y, z, R, { deco = "meadow", depth = R * 1.25 + 1.5, seed = 1, falls = 0, path = true, flowers = 1, trees = [], rim = true, merge = true } = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.root.add(g);
    if (merge) (this.toMerge || (this.toMerge = [])).push(g);
    const { top, rock } = islandGeo(R, depth, { seed, lumpy: 0.32, seg: R > 6 ? 64 : 44 });
    planarUV(top, 0.28);
    shadeVerts(top, { top: 1.04, bottom: 0.82 });
    scaleUV(rock, Math.max(2, Math.round((TAU * R) / 5)), depth / 4.5);
    shadeVerts(rock, { top: 1.0, bottom: 0.48, color: "#ffffff" });
    const tm = new THREE.Mesh(top, this.M.grass);
    tm.receiveShadow = true;
    g.add(tm);
    const rm = new THREE.Mesh(rock, this.M.rock);
    rm.receiveShadow = true;
    rm.castShadow = true;
    g.add(rm);
    const solid = this.disc(x, z, R, y);
    // 장식 (재질별로 굽기)
    const d = new THREE.Group();
    const rnd = seeded(seed * 31 + 7);
    const free = (px, pz, pad = 2.4) => Math.abs(px + x - this.laneX(z + pz)) > pad; // 길(가운데)은 비워 둔다
    // 매달린 뿌리
    for (let i = 0; i < Math.round(R * 1.2); i++) {
      const a = rnd() * TAU;
      const rr = R * (0.55 + rnd() * 0.4);
      const len = 1.2 + rnd() * depth * 0.4;
      const p0 = V(Math.cos(a) * rr, -0.6, Math.sin(a) * rr);
      d.add(part(taperTube([p0, p0.clone().add(V(rnd() - 0.5, -len * 0.5, rnd() - 0.5)), p0.clone().add(V((rnd() - 0.5) * 1.5, -len, (rnd() - 0.5) * 1.5))], (t) => 0.09 * (1 - t * 0.8), 10, 6), rnd() < 0.5 ? "trunk" : "leafDk"));
    }
    // 가장자리 풀 · 작은 돌
    if (rim) {
      for (let i = 0; i < Math.round(R * 4); i++) {
        const a = rnd() * TAU;
        const rr = R * (0.82 + rnd() * 0.16);
        const px = Math.cos(a) * rr;
        const pz = Math.sin(a) * rr;
        if (!free(px, pz, 1.6)) continue;
        if (rnd() < 0.7) {
          const s = 0.25 + rnd() * 0.3;
          d.add(part(new THREE.ConeGeometry(s * 0.5, s * 1.4, 5), "leaf", { pos: [px, s * 0.6, pz], rot: [(rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4], tint: 0.85 + rnd() * 0.3 }));
        } else {
          const s = 0.12 + rnd() * 0.16;
          d.add(part(new THREE.DodecahedronGeometry(s, 1), "stone", { pos: [px, s * 0.3, pz], rot: [rnd() * 3, rnd() * 3, 0], scale: [1, 0.7, 1], tint: 0.9 + rnd() * 0.2 }));
        }
      }
    }
    // 꽃
    if (flowers) {
      const cols = ["#ffffff", "#ffd2e8", "#fff08a", "#c8b8ff", "#ff9aa8"];
      for (let i = 0; i < Math.round(R * R * 1.2 * flowers); i++) {
        const a = rnd() * TAU;
        const rr = Math.sqrt(rnd()) * R * 0.9;
        const px = Math.cos(a) * rr;
        const pz = Math.sin(a) * rr;
        if (!free(px, pz, 1.4)) continue;
        d.add(part(new THREE.IcosahedronGeometry(0.075, 0), "flower", { pos: [px, 0.07, pz], tint: cols[i % cols.length] }));
        d.add(part(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 4), "leaf", { pos: [px, 0.035, pz] }));
      }
    }
    // 테마 장식 (bare = 아무것도 없음)
    const n = deco === "bare" ? 0 : Math.max(0, Math.round(R * 0.6));
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU;
      const rr = R * (0.55 + rnd() * 0.3);
      const px = Math.cos(a) * rr;
      const pz = Math.sin(a) * rr;
      if (!free(px, pz, 2.6)) continue;
      if (deco === "crystal" && rnd() < 0.7) this.crystalCluster(d, px, pz, 0.6 + rnd() * 0.6, rnd);
      else if (deco === "mushroom" && rnd() < 0.7) this.glowShroom(d, px, pz, 0.5 + rnd() * 0.5, rnd);
      else this.bush(d, px, pz, 0.45 + rnd() * 0.45, rnd);
    }
    for (const [tx, tz, h] of trees) this.tree(g, tx, tz, h, seed + tx);
    this.bakeInto(d, g);
    for (let i = 0; i < falls; i++) {
      const a = Math.PI * (0.5 + (i % 2)) + (rnd() - 0.5) * 0.6;
      const wf = new Waterfall(1.2 + R * 0.12, depth * 1.6 + 6);
      wf.group.position.set(Math.cos(a) * (R + 0.08), -0.05, Math.sin(a) * (R + 0.08));
      wf.group.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      wf.group.userData.keep = true;
      g.add(wf.group);
      this.anim.push((dt) => wf.update(dt));
    }
    // 둥실둥실 떠 있는 작은 돌 (섬 아래)
    for (let i = 0; i < 2; i++) {
      const a = rnd() * TAU;
      const rr = R + 1 + rnd() * 2;
      const geo = islandGeo(0.5 + rnd() * 0.6, 1.4, { seed: seed + i * 3, seg: 16 });
      shadeVerts(geo.rock, { bottom: 0.5 });
      shadeVerts(geo.top, { bottom: 0.9 });
      const sg = new THREE.Group();
      sg.position.set(Math.cos(a) * rr, -1.5 - rnd() * 3, Math.sin(a) * rr);
      sg.add(new THREE.Mesh(geo.top, this.M.grass), new THREE.Mesh(geo.rock, this.M.rock));
      g.add(sg);
    }
    g.userData.solid = solid;
    return { g, solid };
  }
  /**
   * 네모난 바위 대지 (협곡 대지 · 부두 받침 · 성벽 길 · 용의 성 바닥)
   *  윗면 = 충돌 상자 (y), 아래는 아래로 갈수록 좁아지는 울퉁불퉁한 바위
   */
  slab(x, y, z, w, l, { depth = 4, seed = 1, top = "grass", side = "rock", taper = 0.55, lumpy = 0.22, merge = true, solid = true, edge = 0.12, wall = 3, extra = {} } = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.root.add(g);
    if (merge) (this.toMerge || (this.toMerge = [])).push(g);
    const tg = planarUV(shadeVerts(roundedBox(w, 0.5, l, edge), { bottom: 0.8 }), 0.28);
    tg.translate(0, -0.25, 0);
    const tm = new THREE.Mesh(tg, this.M[top] || this.M.grass);
    tm.receiveShadow = true;
    g.add(tm);
    if (depth > 0.6) {
      const sw = Math.max(2, Math.round(w / 1.1));
      const sl = Math.max(2, Math.round(l / 1.1));
      const sh = Math.max(3, Math.round(depth / 1.1));
      const bg = new THREE.BoxGeometry(w, depth, l, sw, sh, sl);
      bg.translate(0, -depth / 2 - 0.45, 0);
      const p = bg.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i);
        const vy = p.getY(i);
        const vz = p.getZ(i);
        const t = clamp((-vy - 0.45) / depth, 0, 1);
        const k = Math.min(1, t * 3);
        const n = fbm3(vx * 0.45 + seed * 3.1 + x * 0.1, vy * 0.6, vz * 0.45 - seed * 1.7 + z * 0.1, 3) - 0.5;
        const sc = (1 - Math.pow(t, 1.4) * taper) * (1 + n * lumpy * 2 * k + Math.sin(vy * 2.4 + seed) * 0.03 * k);
        p.setXYZ(i, vx * sc, vy + n * 0.35 * k, vz * sc);
      }
      bg.computeVertexNormals();
      scaleUV(bg, Math.max(1, Math.round(Math.max(w, l) / 7)), Math.max(1, depth / 9));
      shadeVerts(bg, { top: 1.0, bottom: 0.45 });
      const rm = new THREE.Mesh(bg, this.M[side] || this.M.rock);
      rm.castShadow = true;
      rm.receiveShadow = true;
      g.add(rm);
    }
    const sd = solid ? this.box(x - w / 2, x + w / 2, y - Math.min(depth + 0.5, wall), y, z - l / 2, z + l / 2, extra) : null;
    return { g, solid: sd };
  }
  /** 장식 굽기: 재질별로 한 덩어리 */
  bakeInto(group, parent) {
    const geos = bake(group, { ao: 0.32, height: 1.2, base: -0.2 });
    for (const [mat, geo] of Object.entries(geos)) {
      const m = new THREE.Mesh(geo, this.M[mat] || this.M.stone);
      m.castShadow = !["flower"].includes(mat);
      m.receiveShadow = true;
      parent.add(m);
    }
  }
  bush(d, x, z, s, rnd) {
    for (let i = 0; i < 3; i++) {
      const r = s * (0.55 + rnd() * 0.35);
      d.add(part(new THREE.IcosahedronGeometry(r, 1), i % 2 ? "leafDk" : "leaf", { pos: [x + (rnd() - 0.5) * s, r * 0.7, z + (rnd() - 0.5) * s], tint: 0.9 + rnd() * 0.2 }));
    }
  }
  crystalCluster(d, x, z, s, rnd) {
    for (let i = 0; i < 4; i++) {
      const h = s * (0.8 + rnd() * 1.2);
      const geo = new THREE.CylinderGeometry(0, s * 0.22, h, 6);
      geo.translate(0, h / 2, 0);
      d.add(part(geo, rnd() < 0.5 ? "crystal" : "crystal2", { pos: [x + (rnd() - 0.5) * s * 0.6, 0, z + (rnd() - 0.5) * s * 0.6], rot: [(rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.7] }));
    }
  }
  glowShroom(d, x, z, s, rnd) {
    for (let i = 0; i < 3; i++) {
      const k = s * (0.5 + rnd() * 0.6);
      const px = x + (rnd() - 0.5) * s;
      const pz = z + (rnd() - 0.5) * s;
      d.add(part(new THREE.CylinderGeometry(k * 0.12, k * 0.16, k * 0.7, 8), "stem", { pos: [px, k * 0.35, pz] }));
      const cap = new THREE.SphereGeometry(k * 0.42, 14, 8, 0, TAU, 0, Math.PI / 2);
      d.add(part(cap, "mushPink", { pos: [px, k * 0.66, pz], scale: [1, 0.7, 1] }));
    }
  }
  /** 나무 (줄기는 막힘) */
  tree(g, x, z, h = 3.5, seed = 1) {
    const t = roundTree(this.M, h, seed);
    t.position.set(x, 0, z);
    g.add(t);
    const wp = g.position;
    this.box(wp.x + x - 0.3, wp.x + x + 0.3, wp.y, wp.y + h, wp.z + z - 0.3, wp.z + z + 0.3, { noCam: true });
  }
  /** 길 가운데 x (섬마다 조금씩 비켜 있음) */
  laneX(z) {
    const P = this.path;
    if (!P.length) return 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i];
      const b = P[i + 1];
      if ((z <= a.z && z >= b.z) || (z >= a.z && z <= b.z)) {
        const u = (z - a.z) / (b.z - a.z || 1);
        return a.x + (b.x - a.x) * u;
      }
    }
    return P[P.length - 1].x;
  }

  /** 밧줄 출렁다리 (판자 + 기둥 + 밧줄 난간 = 막는 벽) */
  ropeBridge(x, y, z0, z1, w = 2.4) {
    const g = new THREE.Group();
    const d = new THREE.Group();
    const len = Math.abs(z1 - z0);
    const n = Math.round(len / 0.55);
    const rnd = seeded(Math.round(z0));
    for (let i = 0; i < n; i++) {
      const z = z0 + ((z1 - z0) * (i + 0.5)) / n;
      d.add(part(roundedBox(w, 0.12, (len / n) * 0.86, 0.03), "wood", { pos: [x + (rnd() - 0.5) * 0.06, y - 0.06, z], rot: [0, (rnd() - 0.5) * 0.05, 0], tint: 0.85 + rnd() * 0.25 }));
    }
    for (const s of [-1, 1]) {
      d.add(part(roundedBox(0.14, 0.14, len, 0.04), "woodDark", { pos: [x + s * (w / 2 - 0.05), y - 0.13, (z0 + z1) / 2] }));
      for (const zz of [z0, (z0 + z1) / 2, z1]) d.add(part(new THREE.CylinderGeometry(0.08, 0.1, 1.15, 8), "woodDark", { pos: [x + s * (w / 2 + 0.02), y + 0.45, zz] }));
      d.add(part(ropeGeo(V(x + s * (w / 2 + 0.02), y + 0.95, z0), V(x + s * (w / 2 + 0.02), y + 0.95, (z0 + z1) / 2), 0.18, 0.035, 10), "rope"));
      d.add(part(ropeGeo(V(x + s * (w / 2 + 0.02), y + 0.95, (z0 + z1) / 2), V(x + s * (w / 2 + 0.02), y + 0.95, z1), 0.18, 0.035, 10), "rope"));
      // 난간 = 막는 벽
      this.box(x + s * (w / 2) - 0.06, x + s * (w / 2) + 0.06, y, y + 1.0, Math.min(z0, z1), Math.max(z0, z1), { rail: true, noCam: true });
    }
    this.bakeInto(d, g);
    this.root.add(g);
    this.box(x - w / 2, x + w / 2, y - 0.25, y, Math.min(z0, z1), Math.max(z0, z1));
  }
  /** 좁은 공중 판자 다리 (난간 없음) */
  plankBridge(x, y, z0, z1, w = 1.5) {
    const g = new THREE.Group();
    const d = new THREE.Group();
    const len = Math.abs(z1 - z0);
    const n = Math.round(len / 0.6);
    const rnd = seeded(Math.round(z0 * 3));
    for (let i = 0; i < n; i++) {
      const z = z0 + ((z1 - z0) * (i + 0.5)) / n;
      d.add(part(roundedBox(w, 0.14, (len / n) * 0.9, 0.035), "wood", { pos: [x, y - 0.07, z], rot: [0, (rnd() - 0.5) * 0.04, 0], tint: 0.85 + rnd() * 0.25 }));
    }
    for (const s of [-1, 1]) d.add(part(roundedBox(0.12, 0.12, len, 0.04), "woodDark", { pos: [x + s * (w / 2 - 0.08), y - 0.17, (z0 + z1) / 2] }));
    // 아래 버팀 밧줄
    d.add(part(ropeGeo(V(x, y - 0.25, z0), V(x, y - 0.25, z1), 0.5, 0.04, 14), "rope"));
    this.bakeInto(d, g);
    this.root.add(g);
    this.box(x - w / 2, x + w / 2, y - 0.25, y, Math.min(z0, z1), Math.max(z0, z1));
  }
  /** 통나무 장애물 (넘어가야 함) */
  log(x, y, z, len = 6, r = 0.3) {
    const g = new THREE.Group();
    const d = new THREE.Group();
    d.add(part(new THREE.CylinderGeometry(r, r, len, 16), "trunk", { pos: [x, y + r, z], rot: [0, 0, Math.PI / 2] }));
    for (const s of [-1, 1]) d.add(part(new THREE.CircleGeometry(r * 0.92, 16), "wood", { pos: [x + s * (len / 2 + 0.005), y + r, z], rot: [0, (s * Math.PI) / 2, 0] }));
    d.add(part(new THREE.IcosahedronGeometry(0.22, 1), "leaf", { pos: [x + len * 0.2, y + r * 2, z] }));
    this.bakeInto(d, g);
    this.root.add(g);
    this.box(x - len / 2, x + len / 2, y, y + r * 2 - 0.05, z - r * 0.9, z + r * 0.9);
  }
  /** 작은 돌 발판 (둥근 원판) */
  stone(x, y, z, r = 1.2, seed = 1) {
    return this.island(x, y, z, r, { depth: 1.6 + r, seed, deco: "none", flowers: 0.3, rim: true });
  }
  /** 움직이는 발판 (a ↔ b 부드럽게 오감) */
  mover(a, b, r = 1.7, period = 4.5, phase = 0, { look = "island", bob = 0, bobT = 3.2 } = {}) {
    const g = new THREE.Group();
    let core;
    if (look === "boat") {
      // 둥근 하늘 배 (나무 배 + 놋쇠 테 + 양옆 프로펠러)
      const hull = new THREE.LatheGeometry(
        [
          [0, -0.9],
          [r * 0.55, -0.85],
          [r * 0.92, -0.45],
          [r * 1.02, -0.05],
          [r * 0.98, 0.02],
        ].map(([x, y]) => new THREE.Vector2(x, y)),
        28
      );
      scaleUV(hull, 4, 1);
      shadeVerts(hull, { bottom: 0.55 });
      g.add(new THREE.Mesh(hull, this.M.wood));
      const deck = planarUV(shadeVerts(new THREE.CylinderGeometry(r * 0.97, r * 0.97, 0.06, 28), { bottom: 0.9 }), 0.4);
      const dm = new THREE.Mesh(deck, this.M.wood);
      dm.position.y = -0.03;
      g.add(dm);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, 0.07, 8, 32), this.M.brass);
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
      core = new THREE.Group();
      for (const s of [-1, 1]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 10), this.M.brass);
        pod.rotation.z = Math.PI / 2;
        pod.position.set(s * (r + 0.25), -0.35, 0);
        g.add(pod);
        const prop = new THREE.Group();
        prop.position.set(s * (r + 0.58), -0.35, 0);
        for (let i = 0; i < 3; i++) {
          const bl = new THREE.Mesh(roundedBox(0.04, 0.5, 0.12, 0.02), this.M.woodDark);
          bl.rotation.x = (i / 3) * TAU;
          bl.position.y = 0;
          prop.add(bl);
        }
        core.add(prop);
      }
      core.userData.props = core.children;
      g.add(core);
      const flag = new Flag("#ffb84a", 0.5, 0.32, 1.1);
      flag.group.position.set(0, 0, -r * 0.8);
      g.add(flag.group);
      this.flags.push(flag);
    } else if (look === "crystal") {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 0.4, 6), this.M.crystal2);
      top.position.y = -0.2;
      g.add(top);
      core = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, 2.0, 6), this.M.crystal);
      core.rotation.x = Math.PI;
      core.position.y = -1.4;
      g.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#9af4ff", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.y = -0.8;
      glow.scale.setScalar(r * 3);
      g.add(glow);
    } else {
      const { top, rock } = islandGeo(r, 1.8, { seed: Math.round(a.z), seg: 32 });
      planarUV(top, 0.3);
      shadeVerts(top, { bottom: 0.85 });
      shadeVerts(rock, { bottom: 0.5 });
      g.add(new THREE.Mesh(top, this.M.grass), new THREE.Mesh(rock, this.M.rock));
      // 아래 바람 · 수정 엔진 (움직이는 이유)
      core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), this.M.crystal2);
      core.position.y = -2.1;
      g.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#7af4ff", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.y = -2.1;
      glow.scale.setScalar(1.6);
      g.add(glow);
    }
    g.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
    this.root.add(g);
    const solid = this.disc(a.x, a.z, r, a.y, { mover: true });
    const m = { g, solid, a: a.clone(), b: b.clone(), r, period, phase, core, pos: a.clone(), bob, bobT, look };
    solid.predict = (ahead) => this.moverAt(m, this.t + ahead);
    this.movers.push(m);
    this.placeMover(m, 0, true);
    return m;
  }
  /** 움직이는 발판이 t 초에 있을 곳 */
  moverAt(m, t) {
    const k = 0.5 - 0.5 * Math.cos(TAU * (t / m.period + m.phase));
    const bob = m.bob ? Math.sin(TAU * (t / m.bobT + m.phase)) * m.bob : 0;
    return V(m.a.x + (m.b.x - m.a.x) * k, m.a.y + (m.b.y - m.a.y) * k + bob, m.a.z + (m.b.z - m.a.z) * k);
  }
  placeMover(m, t, first = false) {
    const np = this.moverAt(m, t);
    const nx = np.x;
    const ny = np.y;
    const nz = np.z;
    const s = m.solid;
    s.dx = first ? 0 : nx - m.pos.x;
    s.dy = first ? 0 : ny - m.pos.y;
    s.dz = first ? 0 : nz - m.pos.z;
    m.pos.set(nx, ny, nz);
    s.cx = nx;
    s.cz = nz;
    s.y1 = ny;
    s.y0 = ny - 1.2;
    s.x0 = nx - m.r;
    s.x1 = nx + m.r;
    s.z0 = nz - m.r;
    s.z1 = nz + m.r;
    m.g.position.copy(m.pos);
  }
  /** 무너지는 돌다리 한 칸 */
  crumble(x, y, z, w = 2.5, l = 1.75) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(roundedBox(w, 0.42, l, 0.07), this.extra.cobble);
    top.position.y = -0.21;
    top.castShadow = top.receiveShadow = true;
    g.add(top);
    const under = new THREE.Mesh(shadeVerts(new THREE.ConeGeometry(Math.min(w, l) * 0.55, 1.0, 6), { bottom: 0.5 }), this.M.rock);
    under.rotation.x = Math.PI;
    under.position.y = -0.9;
    under.castShadow = true;
    g.add(under);
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, l * 0.9), this.extra.crack.clone());
    crack.rotation.x = -Math.PI / 2;
    crack.position.y = 0.006;
    g.add(crack);
    g.position.set(x, y, z);
    this.root.add(g);
    const solid = this.box(x - w / 2, x + w / 2, y - 0.42, y, z - l / 2, z + l / 2, { crumble: true });
    const c = { g, solid, crack, home: V(x, y, z), state: "idle", t: 0, rot: V(), spin: V((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2) };
    this.crumbles.push(c);
    return c;
  }
  /** 밟으면 가라앉는 구름 발판 */
  cloudPad(x, y, z, r = 1.45) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(this.world.cloudGeos[Math.round(Math.abs(z)) % 3], this.world.cloudMat.clone());
    m.material.transparent = true;
    m.scale.set(r * 0.95, r * 0.55, r * 0.95);
    m.position.y = -r * 0.4;
    m.castShadow = true;
    g.add(m);
    g.position.set(x, y, z);
    this.root.add(g);
    const solid = this.disc(x, z, r, y, { noCam: true });
    const c = { g, m, solid, home: V(x, y, z), state: "idle", t: 0, r };
    this.clouds.push(c);
    return c;
  }
  /** 회전하는 나무 기둥 (팔이 다리 위를 쓸고 지나감) */
  sweeper(x, y, z, armLen = 2.8, speed = 1.7, h = 0.55, phase = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    // 받침 돌 + 기둥
    const base = this.island(x, y, z, 0.75, { depth: 2.2, seed: Math.round(z), deco: "none", flowers: 0, rim: false }).g;
    const post = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.22, 0.28, h + 0.9, 12), { bottom: 0.6 }), this.M.trunk);
    post.position.y = (h + 0.9) / 2;
    post.castShadow = true;
    g.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, TAU, 0, Math.PI / 2), this.M.cap);
    cap.position.y = h + 0.9;
    g.add(cap);
    this.box(x - 0.24, x + 0.24, y, y + h + 0.9, z - 0.24, z + 0.24);
    const arm = new THREE.Group();
    arm.position.y = h;
    g.add(arm);
    const logM = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.17, 0.19, armLen, 12), { bottom: 0.7 }), this.M.trunk);
    logM.rotation.z = Math.PI / 2;
    logM.position.x = armLen / 2;
    logM.castShadow = true;
    arm.add(logM);
    // 끝에 달린 경고 띠 (빨강 · 하양)
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12), new THREE.MeshStandardMaterial({ color: i % 2 ? "#ffffff" : "#ff5a4a", roughness: 0.6 }));
      band.rotation.z = Math.PI / 2;
      band.position.x = armLen - 0.15 - i * 0.14;
      arm.add(band);
    }
    this.root.add(g);
    const s = { g, arm, x, y, z, len: armLen, speed, h, ang: phase, r: 0.19 };
    this.sweepers.push(s);
    return s;
  }
  /** 옆바람 장치 (커다란 선풍기) */
  fan(x, y, z, dir, zone, { strength = 3.2, on = 1.8, off = 1.7, warn = 0.7, phase = 0 } = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    this.island(x, y - 0.01, z, 1.6, { depth: 2.5, seed: Math.round(z), deco: "none", flowers: 0.2 });
    const body = new THREE.Mesh(shadeVerts(roundedBox(1.6, 2.4, 0.9, 0.2), { bottom: 0.7 }), this.M.woodDark);
    body.position.y = 1.3;
    body.castShadow = true;
    g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.13, 10, 36), this.M.brass);
    ring.position.set(0, 1.5, 0.48);
    g.add(ring);
    const hub = new THREE.Group();
    hub.position.set(0, 1.5, 0.55);
    g.add(hub);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(shadeVerts(roundedBox(0.34, 0.9, 0.06, 0.06), { bottom: 0.85 }), this.M.cloth);
      b.position.set(Math.sin((i / 4) * TAU) * 0.48, Math.cos((i / 4) * TAU) * 0.48, 0);
      b.rotation.z = -(i / 4) * TAU;
      b.rotation.y = 0.35;
      hub.add(b);
    }
    hub.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), this.M.brass));
    // 바람 줄무늬 (불 때 보임)
    const zx = (zone.x1 - zone.x0) / 2;
    const streaks = [];
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(zone.z1 - zone.z0) * 0.9, 2.2), this.extra.wind.clone());
      pl.rotation.set(-Math.PI / 2 + 0.0, 0, Math.PI / 2);
      pl.position.set((zone.x0 + zone.x1) / 2, y + 0.4 + i * 0.6, (zone.z0 + zone.z1) / 2);
      pl.rotation.set(0, 0, 0);
      pl.lookAt(pl.position.clone().add(V(0, 1, 0)));
      pl.rotateZ(Math.atan2(dir.x, dir.z) + Math.PI / 2);
      pl.scale.set(1, (zx * 2) / 2.2, 1);
      this.root.add(pl);
      streaks.push(pl);
    }
    this.root.add(g);
    this.box(x - 0.8, x + 0.8, y, y + 2.5, z - 0.8, z + 0.8);
    const f = { g, hub, dir: dir.clone().normalize(), zone, strength, on, off, warn, t: -phase, power: 0, streaks, state: "off", x, y, z };
    this.fans.push(f);
    return f;
  }
  /** 상승기류 (아래에서 위로 부는 바람 기둥) */
  vent(x, y, z, r = 1.5, top = 12, lift = 46) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    // 바닥 쇠창살 + 회오리 띠
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r * 0.85, 0.12, 8, 32), this.M.brass));
    g.children[0].rotation.x = Math.PI / 2;
    g.children[0].position.y = 0.06;
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(shadeVerts(new THREE.BoxGeometry(r * 1.6, 0.06, 0.08), { bottom: 0.8 }), this.M.woodDark);
      bar.position.set(0, 0.05, i * r * 0.3);
      g.add(bar);
    }
    const swirlM = this.extra.wind.clone();
    swirlM.opacity = 0.55;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.75, top - y, 24, 1, true), swirlM);
    col.position.y = (top - y) / 2;
    g.add(col);
    const col2 = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.5, top - y, 18, 1, true), swirlM.clone());
    col2.position.y = (top - y) / 2;
    g.add(col2);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 32), this.extra.glowRing.clone());
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.04;
    g.add(glow);
    this.root.add(g);
    const v = { g, col, col2, x, y, z, r, top, lift };
    this.vents.push(v);
    return v;
  }
  /** 바람 고리 (지나가면 앞으로 휙 날아감) */
  boostRing(x, y, z, v = V(0, 6.5, -15), r = 1.35) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.13, 12, 48), this.extra.ring);
    g.add(ring);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(r * 0.95, 32), this.extra.glowRing.clone());
    g.add(inner);
    // 앞쪽 화살표 세 개
    const arrows = [];
    for (let i = 0; i < 3; i++) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), this.extra.ring);
      a.rotation.x = -Math.PI / 2;
      a.position.z = -0.8 - i * 0.8;
      g.add(a);
      arrows.push(a);
    }
    this.root.add(g);
    const b = { g, ring, inner, arrows, x, y, z, r, v, used: false };
    this.rings.push(b);
    return b;
  }
  /** 점프대 (통통 버섯) */
  pad(x, y, z, v, r = 1.0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.5, 0.12, 14), this.extra.padStem);
    stem.position.y = 0.06;
    g.add(stem);
    let capG = new THREE.Group();
    capG.position.y = 0.08;
    g.add(capG);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, TAU, 0, Math.PI / 2), this.extra.pad);
    cap.scale.y = 0.3;
    capG.add(cap);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 6), this.M.capSpot);
      dot.position.set(Math.cos(a) * r * 0.62, r * 0.19, Math.sin(a) * r * 0.62);
      dot.scale.y = 0.4;
      capG.add(dot);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.05, r * 1.3, 32), this.extra.glowRing.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    g.add(ring);
    const capM = mergeByMaterial(capG);
    g.remove(capG);
    g.add(capM);
    capG = capM;
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    this.root.add(g);
    // 걸어서도 올라설 수 있는 높이 (턱 0.42m 이하)
    const top = y + 0.36;
    const solid = this.disc(x, z, r * 0.9, top, { pad: true, noCam: true });
    solid.y0 = y;
    const p = { g, capG, ring, solid, v, t: 9 };
    this.pads.push(p);
    return p;
  }
  /** 에너지 구슬 (big = 큰 구슬) */
  orb(x, y, z, big = false) {
    this.orbs.push({ p: V(x, y, z), big, taken: false, idx: this.orbs.length, ph: Math.random() * TAU });
  }
  orbLine(a, b, n) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      this.orb(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }
  }
  orbArc(a, b, h, n) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      this.orb(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * h, a.z + (b.z - a.z) * t);
    }
  }
  /** 체크포인트 (깃대 + 수정 + 바닥 고리) */
  checkpoint(x, y, z, side = 1, label = "") {
    const g = new THREE.Group();
    g.position.set(x + side * 2.4, y, z);
    const fl = new Flag("#7ac8ff", 0.9, 0.6, 2.4);
    g.add(fl.group);
    this.flags.push(fl);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), this.extra.cpOff);
    gem.position.y = 2.75;
    g.add(gem);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#7affb0", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 2.75;
    halo.scale.setScalar(2.2);
    g.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 40), this.extra.glowRing.clone());
    ring.material.color.set("#9af4ff");
    ring.material.opacity = 0.35;
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.03, z);
    this.root.add(ring);
    this.root.add(g);
    this.box(g.position.x - 0.07, g.position.x + 0.07, y, y + 2.4, z - 0.07, z + 0.07, { noCam: true });
    const cp = { g, gem, halo, ring, flag: fl, p: V(x, y, z), active: false, idx: this.checkpoints.length, label };
    this.checkpoints.push(cp);
    return cp;
  }
  /** 장애물 통과 지점 (지나가면 보너스) */
  pass(z, name) {
    this.passes.push({ z, name, done: false });
  }

  /* ================================================================
   * 코스 (구간 1~10)
   * ============================================================== */
  build() {
    // 스테이지마다 코스 짓기 (stages.js) → 공통 마무리
    this.def.build(this);
    if (!this.path.length) throw new Error("stage has no path");
    this.finalize();
  }
  /** 길 정하기 (진행률 · 카메라 방향 · 거리 점수) */
  setPath(points, start) {
    this.path = points.map(([x, y, z]) => V(x, y, z));
    this.pathLen = [0];
    for (let i = 1; i < this.path.length; i++) {
      const a = this.path[i - 1];
      const b = this.path[i];
      this.pathLen.push(this.pathLen[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
    }
    this.total = this.pathLen[this.pathLen.length - 1];
    this.start = start || { p: this.path[0].clone(), yaw: Math.PI };
  }
  /** 결승 비행선 (갑판에 서면 클리어) */
  goalShip(x, y, z, scale = 1.5, color = "#f1d6a6") {
    const ship = new Airship(this.M, { scale, color });
    ship.group.position.set(x, y, z);
    this.root.add(ship.group);
    this.ship = ship;
    this.shipHome = ship.group.position.clone();
    const dy = ship.deckY;
    this.shipY = y;
    this.deck = this.box(x - ship.deckHalf.x, x + ship.deckHalf.x, y + dy - 0.3, y + dy, z - ship.deckHalf.z, z + ship.deckHalf.z, { deck: true });
    this.box(x - 1.1 * scale, x + 1.1 * scale, y + dy, y + dy + 2.2, z - 2.8 * scale - 1.3 * scale, z - 2.8 * scale + 1.3 * scale, { noCam: true }); // 선실
    return ship;
  }
  finalize() {
    // 섬 장식 합치기: 40m 구역마다 재질별로 한 덩어리 (그리기 횟수 줄이기 · 구역 단위로는 화면 밖이면 안 그림)
    const chunks = new Map();
    for (const g of this.toMerge) {
      const k = Math.floor(-g.position.z / 40) + (Math.abs(g.position.x) > 12 ? 100 : 0);
      if (!chunks.has(k)) chunks.set(k, new THREE.Group());
      this.root.remove(g);
      chunks.get(k).add(g);
    }
    for (const cg of chunks.values()) this.root.add(mergeByMaterial(cg));
    this.toMerge = null;
    this.buildOrbs();
    // 거리로 안 그리기: 각 덩어리의 앞뒤(z) 범위를 미리 재 둔다 (인스턴스 메시는 늘 그림)
    this.cullList = [];
    const box = new THREE.Box3();
    for (const c of this.root.children) {
      if (c.isInstancedMesh || c.userData.noCull) continue;
      box.setFromObject(c);
      if (box.isEmpty()) continue;
      this.cullList.push({ o: c, z0: box.min.z, z1: box.max.z });
    }
  }
  /** 주인공보다 아주 멀리 앞(안개 속)이거나 카메라보다 뒤에 있는 덩어리는 안 그린다 */
  cull(pz) {
    for (const c of this.cullList) c.o.visible = c.z0 < pz + 40 && c.z1 > pz - 190;
  }

  /* ---------------- 9. 무너지는 섬: 타일 격자 (인스턴스) ---------------- */
  buildCollapse(y, z0, rows, { x0 = 0, armed = true } = {}) {
    const cols = 3;
    const tw = 1.6;
    const tl = 1.6;
    // 윗면: 거의 붙어 있는 흙 · 풀 덩어리 (칸마다 색이 조금씩 달라 바둑판처럼 보이지 않게)
    const topGeo = planarUV(shadeVerts(roundedBox(tw - 0.01, 0.5, tl - 0.01, 0.06), { bottom: 0.75 }), 0.3);
    // 아랫면: 울퉁불퉁한 바위 덩어리 (섬 아래쪽처럼)
    const rk = islandGeo(tw * 0.62, 2.6, { seed: 5, lumpy: 0.5, seg: 10 }).rock;
    rk.translate(0, 0.45, 0);
    scaleUV(rk, 2, 0.6);
    const rockGeo = shadeVerts(rk, { bottom: 0.45 });
    const n = rows * cols;
    this.tileTop = new THREE.InstancedMesh(topGeo, this.extra.tileTop, n);
    this.tileRock = new THREE.InstancedMesh(rockGeo, this.M.rock, n);
    const rndT = seeded(404);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const k = 0.86 + rndT() * 0.22;
      col.setRGB(k * (0.95 + rndT() * 0.1), k, k * (0.85 + rndT() * 0.15));
      this.tileTop.setColorAt(i, col);
    }
    // 금 간 무늬 (흔들리기 시작하면 보임)
    this.crackMat = new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.crackGeo = new THREE.PlaneGeometry(tw * 0.95, tl * 0.95);
    this.crackGeo.rotateX(-Math.PI / 2);
    for (const im of [this.tileTop, this.tileRock]) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      this.root.add(im);
    }
    this.tiles = [];
    const holeRows = new Set([6, 12, 18]);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + (c - 1) * tw;
        const z = z0 - tl / 2 - r * tl;
        const solid = this.box(x - tw / 2, x + tw / 2, y - 0.5, y, z - tl / 2, z + tl / 2, { tile: true });
        const crack = new THREE.Mesh(this.crackGeo, this.crackMat);
        crack.visible = false;
        crack.position.set(x, y + 0.012, z);
        crack.rotation.y = ((r * 3 + c) % 4) * (Math.PI / 2);
        this.root.add(crack);
        this.tiles.push({ x, y, z, r, c, solid, crack, state: "idle", t: 0, pos: V(x, y, z), rot: V(), spin: V(), vy: 0, hole: holeRows.has(r), idx: this.tiles.length, ry: ((r * 7 + c * 3) % 5) * 0.6 });
      }
    }
    // 무너지는 섬 옆 금 간 돌기둥 (무너짐이 지나가면 바깥으로 쓰러져 떨어짐)
    this.pillars = [];
    for (let i = 0; i < 7; i++) {
      const z = z0 - 3 - i * 5.6;
      const side = i % 2 ? 1 : -1;
      const h = 1.6 + (i % 3) * 0.6;
      const g = new THREE.Group();
      g.position.set(x0 + side * 3.1, y - 0.4, z);
      const m = new THREE.Mesh(shadeVerts(roundedBox(0.7, h, 0.7, 0.08), { bottom: 0.6 }), this.M.stone);
      m.position.y = h / 2 + 0.4;
      m.castShadow = true;
      g.add(m);
      const base = new THREE.Mesh(this.tileRock.geometry, this.M.rock);
      base.scale.setScalar(0.8);
      base.position.y = -0.3;
      g.add(base);
      const top = new THREE.Mesh(planarUV(shadeVerts(roundedBox(1.2, 0.4, 1.2, 0.1), { bottom: 0.75 }), 0.3), this.extra.tileTop);
      top.position.y = 0.2;
      g.add(top);
      g.rotation.y = i;
      this.root.add(g);
      this.pillars.push({ g, side, z, home: g.position.clone(), t: -1, v: 0 });
    }
    this.collapse = { on: false, front: z0 + 2, speed: 4.2, z0, rows, tl, y, started: 0, x0, armed, armed0: armed };
    this.syncTiles(true);
  }
  syncTiles(all = false) {
    const o = new THREE.Object3D();
    for (const t of this.tiles) {
      if (!all && t.state === "idle") continue;
      if (t.state === "gone") {
        o.scale.setScalar(0);
      } else {
        o.scale.setScalar(1);
      }
      o.position.set(t.pos.x, t.pos.y - 0.25, t.pos.z);
      o.rotation.set(t.rot.x, t.ry * 0 + t.rot.y, t.rot.z);
      if (t.state === "shake") {
        o.position.x += Math.sin(this.t * 60 + t.idx) * 0.04;
        o.position.y += Math.sin(this.t * 47 + t.idx) * 0.02;
      }
      o.updateMatrix();
      this.tileTop.setMatrixAt(t.idx, o.matrix);
      // 금 간 무늬도 같이 움직임
      t.crack.visible = t.state === "shake" || t.state === "fall";
      if (t.crack.visible) {
        t.crack.position.set(o.position.x, o.position.y + 0.262, o.position.z);
        t.crack.rotation.set(t.rot.x, t.crack.rotation.y, t.rot.z);
      }
      o.position.y -= 0.25;
      o.rotation.y += t.ry;
      o.updateMatrix();
      this.tileRock.setMatrixAt(t.idx, o.matrix);
    }
    this.tileTop.instanceMatrix.needsUpdate = true;
    this.tileRock.instanceMatrix.needsUpdate = true;
  }

  /* ---------------- 에너지 구슬 (인스턴스 2개: 빛나는 알맹이 + 투명 껍질) ---------------- */
  buildOrbs() {
    const n = this.orbs.length;
    this.orbCore = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 2), this.extra.orb, n);
    this.orbShell = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.36, 2), this.extra.orbShell, n);
    this.orbCore.frustumCulled = this.orbShell.frustumCulled = false;
    this.root.add(this.orbCore, this.orbShell);
    // 큰 구슬은 따로 (금빛)
    this.bigOrbs = [];
    for (const o of this.orbs) {
      if (!o.big) continue;
      const g = new THREE.Group();
      g.position.copy(o.p);
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), this.extra.big);
      g.add(core);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffd27a", transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(2.6);
      g.add(glow);
      this.root.add(g);
      o.g = g;
      this.bigOrbs.push(o);
    }
    this.syncOrbs(0);
  }
  syncOrbs(t, cam) {
    const o = new THREE.Object3D();
    let i = 0;
    for (const orb of this.orbs) {
      if (orb.big) {
        orb.g.visible = !orb.taken;
        orb.g.position.y = orb.p.y + Math.sin(t * 2 + orb.ph) * 0.12;
        orb.g.rotation.y = t * 1.5;
        o.scale.setScalar(0);
      } else {
        o.position.set(orb.p.x, orb.p.y + Math.sin(t * 2.4 + orb.ph) * 0.1, orb.p.z);
        o.rotation.set(t * 1.3 + orb.ph, t * 0.9, 0);
        const near = cam && (cam.x - orb.p.x) ** 2 + (cam.y - orb.p.y) ** 2 + (cam.z - orb.p.z) ** 2 < 2.6;
        o.scale.setScalar(orb.taken || near ? 0 : 1 + Math.sin(t * 5 + orb.ph) * 0.06);
      }
      o.updateMatrix();
      this.orbCore.setMatrixAt(i, o.matrix);
      this.orbShell.setMatrixAt(i, o.matrix);
      i++;
    }
    this.orbCore.instanceMatrix.needsUpdate = true;
    this.orbShell.instanceMatrix.needsUpdate = true;
  }

  /* ================================================================
   * 매 프레임: 움직이는 것 · 위험 · 수집 → 일어난 일 목록
   * ============================================================== */
  update(dt, P, playing, cam) {
    this.t += dt;
    const t = this.t;
    const ev = [];
    for (const f of this.anim) f(dt, t);
    for (const f of this.flags) f.update(dt, 1);
    // 움직이는 발판
    for (const m of this.movers) {
      this.placeMover(m, t);
      if (m.look === "boat") {
        for (const pr of m.core.children) pr.rotation.x += dt * 14;
        m.g.rotation.z = Math.sin(t * 1.3 + m.phase * 6) * 0.04;
      } else m.core.rotation.y += dt * 2;
    }
    // 무너지는 돌다리
    for (const c of this.crumbles) {
      const on = P && P.onGround && P.groundSolid === c.solid;
      if (c.state === "idle" && on) {
        c.state = "shake";
        c.t = 0;
        ev.push({ type: "crack", p: c.home });
      }
      if (c.state === "shake") {
        c.t += dt;
        c.crack.material.opacity = Math.min(1, c.t / 0.3);
        c.g.position.set(c.home.x + Math.sin(t * 70) * 0.05, c.home.y + Math.sin(t * 53) * 0.02, c.home.z);
        if (c.t > 0.62) {
          c.state = "fall";
          c.t = 0;
          c.solid.active = false;
          c.vy = 0;
          ev.push({ type: "crumble", p: c.home.clone() });
          this.fx.debris(c.home, 5, { color: "#a89aa8" });
          this.fx.puff(c.home.x, c.home.y - 0.3, c.home.z, 0.8, 4);
        }
      } else if (c.state === "fall") {
        c.t += dt;
        c.vy -= 22 * dt;
        c.g.position.y += c.vy * dt;
        c.g.rotation.x += c.spin.x * dt;
        c.g.rotation.z += c.spin.z * dt;
        if (c.t > 2.2) {
          c.state = "gone";
          c.g.visible = false;
          c.t = 0;
        }
      } else if (c.state === "gone") {
        c.t += dt;
        if (c.t > 2.6) this.resetCrumble(c);
      }
    }
    // 구름 발판
    for (const c of this.clouds) {
      const on = P && P.onGround && P.groundSolid === c.solid;
      if (c.state === "idle" && on) {
        c.state = "soft";
        c.t = 0;
        ev.push({ type: "cloud", p: c.home });
      }
      if (c.state === "soft") {
        c.t += dt;
        const k = c.t / 0.55;
        c.g.position.y = c.home.y - Math.sin(Math.min(1, k) * Math.PI * 0.5) * 0.12;
        c.m.scale.set(c.r * 0.95 * (1 + Math.sin(c.t * 20) * 0.02), c.r * 0.55, c.r * 0.95);
        c.solid.dy = 0;
        if (c.t > 0.55) {
          c.state = "sink";
          c.t = 0;
          this.fx.puff(c.home.x, c.home.y - 0.3, c.home.z, 1.2, 5, "#ffffff");
        }
      } else if (c.state === "sink") {
        c.t += dt;
        const k = Math.min(1, c.t / 0.8);
        const ny = c.home.y - 0.12 - k * 1.8;
        c.solid.dy = ny - c.solid.y1;
        c.solid.y1 = ny;
        c.solid.y0 = ny - 1.2;
        c.g.position.y = ny;
        c.m.material.opacity = 1 - k;
        if (k > 0.45 && c.solid.active) c.solid.active = false;
        if (k >= 1) {
          c.state = "gone";
          c.t = 0;
          c.g.visible = false;
        }
      } else if (c.state === "gone") {
        c.t += dt;
        if (c.t > 2.8) this.resetCloud(c);
      }
    }
    // 회전 나무 기둥
    for (const s of this.sweepers) {
      s.ang += s.speed * dt;
      s.arm.rotation.y = s.ang;
      if (P && playing && P.stunT <= 0 && P.dashT <= 0) {
        // 팔 선분 (기둥 → 끝)과 주인공 사이 거리
        const ex = s.x + Math.cos(s.ang) * s.len;
        const ez = s.z - Math.sin(s.ang) * s.len;
        const ax = ex - s.x;
        const az = ez - s.z;
        const L2 = ax * ax + az * az;
        const u = clamp(((P.pos.x - s.x) * ax + (P.pos.z - s.z) * az) / L2, 0.12, 1);
        const cx = s.x + ax * u;
        const cz = s.z + az * u;
        const d = Math.hypot(P.pos.x - cx, P.pos.z - cz);
        const armY = s.y + s.h;
        const overlapY = P.pos.y < armY + s.r - 0.02 && P.pos.y + 1.0 > armY - s.r;
        if (d < 0.32 + s.r && overlapY) {
          // 팔이 도는 방향으로 밀어낸다
          const tx = -Math.sin(s.ang) * Math.sign(s.speed);
          const tz = -Math.cos(s.ang) * Math.sign(s.speed);
          const from = V(P.pos.x - tx, P.pos.y, P.pos.z - tz);
          ev.push({ type: "knock", from, p: V(cx, armY, cz) });
        }
      }
    }
    // 옆바람 장치
    for (const f of this.fans) {
      f.t += dt;
      const cyc = f.on + f.off;
      const k = ((f.t % cyc) + cyc) % cyc;
      let st;
      if (k < f.off - f.warn) st = "off";
      else if (k < f.off) st = "warn";
      else st = "on";
      if (st !== f.state) {
        if (st === "warn") ev.push({ type: "gustWarn", p: V(f.x, f.y, f.z) });
        if (st === "on") ev.push({ type: "gust", p: V(f.x, f.y, f.z) });
        f.state = st;
      }
      const target = st === "on" ? 1 : 0;
      f.power += (target - f.power) * Math.min(1, dt * 6);
      f.hub.rotation.z += dt * (2 + f.power * 26 + (st === "warn" ? 8 : 0));
      for (const [i, s] of f.streaks.entries()) {
        s.material.opacity = f.power * 0.5 + (st === "warn" ? 0.12 + Math.sin(t * 20) * 0.06 : 0);
        s.material.map.offset.y -= dt * (0.6 + f.power * 2.2) * (i % 2 ? 1 : 1.3);
      }
      if (f.power > 0.5 && Math.random() < dt * 30) {
        const z = f.zone;
        this.fx.windMote(z.x0 + Math.random() * 0.5, z.y0 + 0.3 + Math.random() * 2, z.z0 + Math.random() * (z.z1 - z.z0), f.dir.x * 9, 0, f.dir.z * 9);
      }
    }
    // 상승기류
    for (const v of this.vents) {
      v.col.material.map.offset.y -= dt * 1.4;
      v.col.rotation.y += dt * 2.2;
      v.col2.rotation.y -= dt * 3.1;
      if (Math.random() < dt * 14) {
        const a = Math.random() * TAU;
        const r = Math.random() * v.r * 0.8;
        this.fx.leaf(v.x + Math.cos(a) * r, v.y + 0.3, v.z + Math.sin(a) * r, -Math.sin(a) * 1.5, 6 + Math.random() * 3, Math.cos(a) * 1.5);
      }
    }
    // 바람 고리: 지나가면 날려 보냄
    for (const b of this.rings) {
      b.ring.rotation.z += dt * 1.5;
      b.inner.material.opacity = 0.45 + Math.sin(t * 5) * 0.15;
      b.arrows.forEach((a, i) => (a.material.emissiveIntensity = 1 + Math.sin(t * 8 - i) * 0.6));
      if (P && playing && !b.cool) {
        const dz = P.pos.z - b.z;
        const d = Math.hypot(P.pos.x - b.x, P.pos.y + 0.55 - b.y);
        if (Math.abs(dz) < 0.6 && d < b.r + 0.2 && !P.onGround) {
          b.cool = 1;
          ev.push({ type: "ring", ring: b });
        }
      }
      if (b.cool) {
        b.cool -= dt;
        if (b.cool <= 0) b.cool = 0;
      }
    }
    // 점프대 (밟으면 통!)
    for (const p of this.pads) {
      p.t += dt;
      const k = Math.min(1, p.t / 0.35);
      const sq = p.t < 0.35 ? 1 - Math.sin(k * Math.PI) * 0.35 : 1;
      p.capG.scale.set(2 - sq, sq, 2 - sq);
      p.ring.material.opacity = 0.5 + Math.sin(t * 4) * 0.2;
      if (P && playing && P.onGround && P.groundSolid === p.solid) {
        p.t = 0;
        ev.push({ type: "pad", pad: p });
      }
    }
    // 무너지는 섬
    this.updateCollapse(dt, P, ev, playing);
    // 구슬
    this.syncOrbs(t, cam);
    if (P && playing) {
      const cx = P.pos.x;
      const cy = P.pos.y + 0.55;
      const cz = P.pos.z;
      for (const o of this.orbs) {
        if (o.taken) continue;
        const r = o.big ? 1.0 : 0.8;
        if (Math.abs(o.p.z - cz) > 2) continue;
        if ((o.p.x - cx) ** 2 + (o.p.y - cy) ** 2 + (o.p.z - cz) ** 2 < r * r) {
          o.taken = true;
          ev.push({ type: "orb", orb: o });
        }
      }
      // 체크포인트
      for (const c of this.checkpoints) {
        if (c.active) continue;
        if (P.onGround && Math.hypot(P.pos.x - c.p.x, P.pos.z - c.p.z) < 3.0 && Math.abs(P.pos.y - c.p.y) < 0.6) {
          this.activateCheckpoint(c);
          ev.push({ type: "checkpoint", cp: c });
        }
      }
      for (const p of this.passes) {
        if (!p.done && P.onGround && P.pos.z < p.z) {
          p.done = true;
          ev.push({ type: "pass", name: p.name, p: P.pos.clone() });
        }
      }
      // 결승: 비행선 갑판에 섰다
      if (this.deck && P.onGround && P.groundSolid === this.deck) ev.push({ type: "goal" });
    }
    for (const c of this.checkpoints) {
      c.gem.rotation.y += dt * (c.active ? 3 : 1);
      if (c.active) c.halo.material.opacity = 0.5 + Math.sin(t * 4) * 0.2;
    }
    // 비행선
    // 새 장치들 (mechs.js)
    for (const m of this.mechs) m.update(dt, P, ev, playing);
    if (this.ship) {
      this.ship.update(dt);
      const sy = this.ship.inner.position.y;
      const deckTop = this.ship.group.position.y + this.ship.deckY + sy;
      this.deck.dy = deckTop - this.deck.y1;
      this.deck.y1 = deckTop;
      this.deck.y0 = deckTop - 0.3;
    }
    return ev;
  }

  updateCollapse(dt, P, ev, playing) {
    const C = this.collapse;
    if (!C) return;
    if (!C.on && C.armed && P && playing && P.pos.z < C.z0 - 8 && P.pos.z > C.z0 - 40 && Math.abs(P.pos.x - C.x0) < 4 && P.onGround) {
      C.on = true;
      C.started = this.t;
      C.front = C.z0 + 0.6;
      ev.push({ type: "collapse" });
    }
    let dirty = false;
    if (C.on) {
      const el = this.t - C.started;
      C.speed = Math.min(5.6, 4.0 + el * 0.12);
      // 무너지는 끝은 자기 속도로 쫓아오고, 주인공이 빨리 달려도 바로 뒤(3m)까지는 따라붙는다 (늘 화면에 보이게)
      C.front = Math.min(C.front - C.speed * (this.cine ? 2.2 : 1) * dt, P ? P.pos.z + 3.2 : C.front);
      if (this.cine && P) C.front = Math.max(C.front, P.pos.z + 3.5);
      // 바로 앞 '구멍 줄'은 미리 무너져 점프하게 만든다
      for (const tl of this.tiles) {
        if (tl.state !== "idle") continue;
        const pre = tl.hole && P && P.pos.z - tl.z < 9.5 && P.pos.z > tl.z;
        if (tl.z > C.front || pre) {
          tl.state = "shake";
          tl.t = pre ? 0.15 : Math.random() * 0.15;
          dirty = true;
          if (tl.c === 1 || pre) {
            this.fx.puff(tl.x, tl.y + 0.1, tl.z, 0.6, 2, "#d8c4b8");
            this.fx.debris(V(tl.x, tl.y + 0.1, tl.z), 2, { color: "#9a8a8a", up: 3, spread: 1.2, size: 0.6 });
          }
        }
      }
      if (Math.random() < dt * 3) ev.push({ type: "rumble" });
      // 배경 큰 바위 하나씩 떨어짐
      for (const [i, g] of this.bigRocks.entries()) {
        if (el > 0.6 + i * 1.05) {
          g.userData.v += 9 * dt;
          g.position.y -= g.userData.v * dt;
          g.rotation.x += g.userData.spin.x * dt;
          g.rotation.z += g.userData.spin.z * dt;
          if (!g.userData.dusted) {
            g.userData.dusted = true;
            this.fx.puff(g.position.x, g.position.y, g.position.z, 3, 6, "#e0ccd8");
            ev.push({ type: "bigFall", p: g.position.clone() });
          }
        }
      }
      // 돌기둥: 무너짐이 지나가면 바깥으로 기울며 떨어짐
      for (const pl of this.pillars) {
        if (pl.t < 0 && C.front < pl.z + 1) {
          pl.t = 0;
          this.fx.puff(pl.home.x, pl.home.y + 0.5, pl.home.z, 1.2, 4);
        }
        if (pl.t >= 0) {
          pl.t += dt;
          pl.g.rotation.z = -pl.side * Math.min(1.4, pl.t * pl.t * 2.2);
          if (pl.t > 0.4) {
            pl.v += 16 * dt;
            pl.g.position.y -= pl.v * dt;
            pl.g.position.x += pl.side * dt * 1.5;
          }
        }
      }
      // 떠다니는 바위 조각: 무너짐이 다가오거나 밟으면 가라앉기 시작
      for (const d of this.debris) {
        const on = P && P.onGround && P.groundSolid === d.solid;
        if (d.sink === 0 && (on || C.front < d.home.z + 2)) d.sink = 1;
        if (d.sink) {
          d.v = Math.min(d === this.lastRock ? 0.6 : 1.1, d.v + dt * 0.8);
          const ny = d.solid.y1 - d.v * dt;
          d.solid.dy = ny - d.solid.y1;
          d.solid.y1 = ny;
          d.solid.y0 = ny - 1.2;
          d.g.position.y = ny;
          if (Math.random() < dt * 4) this.fx.debris(V(d.solid.cx, ny - 0.8, d.solid.cz), 1, { color: "#9a8a9a", up: 0.2, spread: 1 });
        }
      }
    }
    for (const tl of this.tiles) {
      if (tl.state === "shake") {
        tl.t += dt;
        dirty = true;
        if (tl.t > 0.55) {
          tl.state = "fall";
          tl.t = 0;
          tl.solid.active = false;
          tl.vy = 0;
          tl.spin.set((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2.4);
          if (Math.random() < 0.6) {
            this.fx.puff(tl.x, tl.y - 0.3, tl.z, 1.0, 3);
            this.fx.debris(V(tl.x, tl.y - 0.4, tl.z), 3, { color: "#a08a90" });
          }
          if (tl.c === 1) ev.push({ type: "tileFall", p: V(tl.x, tl.y, tl.z) });
        }
      } else if (tl.state === "fall") {
        tl.t += dt;
        dirty = true;
        // 처음엔 한쪽으로 기울고, 그다음 떨어진다
        const tilt = Math.min(1, tl.t / 0.35);
        tl.rot.set(tl.spin.x * tilt * 0.35 + tl.spin.x * Math.max(0, tl.t - 0.35), tl.spin.y * tl.t, tl.spin.z * tilt * 0.35 + tl.spin.z * Math.max(0, tl.t - 0.35));
        if (tl.t > 0.2) tl.vy -= 20 * dt;
        tl.pos.y += tl.vy * dt;
        if (tl.t > 2.6) tl.state = "gone";
      }
    }
    if (dirty) this.syncTiles();
  }

  activateCheckpoint(c) {
    c.active = true;
    c.gem.material = this.extra.cpOn;
    c.halo.material.opacity = 0.6;
    c.ring.material.color.set("#9affc4");
    c.ring.material.opacity = 0.8;
    this.fx.sparkle(c.g.position.clone().setY(c.p.y + 2.7), 30, ["#9affc4", "#ffffff", "#ffe27a"], 4);
  }
  resetCrumble(c) {
    c.state = "idle";
    c.t = 0;
    c.solid.active = true;
    c.g.visible = true;
    c.g.position.copy(c.home);
    c.g.rotation.set(0, 0, 0);
    c.crack.material.opacity = 0;
  }
  resetCloud(c) {
    c.state = "idle";
    c.t = 0;
    c.solid.active = true;
    c.solid.y1 = c.home.y;
    c.solid.y0 = c.home.y - 1.2;
    c.solid.dy = 0;
    c.g.visible = true;
    c.g.position.copy(c.home);
    c.m.material.opacity = 1;
  }
  /**
   * 다시 시작할 때 장애물 되돌리기
   * @param fromZ 이 z 보다 앞(-z 쪽)에 있는 것만 (체크포인트 뒤쪽에서 무너진 건 그대로 둬도 됨)
   */
  resetObstacles() {
    this.cine = false;
    for (const c of this.crumbles) this.resetCrumble(c);
    for (const c of this.clouds) this.resetCloud(c);
    for (const b of this.rings) b.cool = 0;
    for (const m of this.mechs) m.reset && m.reset();
    // 무너지는 섬 전체 복구
    const C = this.collapse;
    if (C) {
      C.on = false;
      C.front = C.z0 + 2;
      // 보스를 아직 안 쓰러뜨렸으면 무너짐도 잠가 둔다
      C.armed = C.armed0 || !!(this.boss && this.boss.dead);
    }
    for (const tl of this.tiles) {
      tl.state = "idle";
      tl.t = 0;
      tl.solid.active = true;
      tl.pos.set(tl.x, tl.y, tl.z);
      tl.rot.set(0, 0, 0);
      tl.vy = 0;
      tl.crack.visible = false;
    }
    if (this.tiles.length) this.syncTiles(true);
    for (const d of this.debris) {
      d.sink = 0;
      d.v = 0;
      d.solid.y1 = d.home.y;
      d.solid.y0 = d.home.y - 1.2;
      d.solid.dy = 0;
      d.g.position.y = d.home.y;
    }
    for (const pl of this.pillars) {
      pl.t = -1;
      pl.v = 0;
      pl.g.position.copy(pl.home);
      pl.g.rotation.z = 0;
    }
    for (const g of this.bigRocks) {
      g.position.copy(g.userData.home);
      g.userData.v = 0;
      g.userData.dusted = false;
      g.rotation.set(0, 0, 0);
    }
  }
  /** 구슬 상태 저장 · 되돌리기 (체크포인트 이후에 먹은 구슬은 다시 나타남) */
  orbState() {
    return this.orbs.map((o) => o.taken);
  }
  restoreOrbs(state) {
    this.orbs.forEach((o, i) => (o.taken = state[i]));
  }
  passState() {
    return this.passes.map((p) => p.done);
  }
  restorePasses(s) {
    this.passes.forEach((p, i) => (p.done = s[i]));
  }
  resetAll() {
    this.resetObstacles();
    // 처음부터: 보스도 처음 상태로 (숨어 있음 · 체력 가득 · 문 닫힘 · 무너짐 잠금)
    if (this.boss) this.boss.reset(true);
    if (this.collapse) this.collapse.armed = this.collapse.armed0;
    if (this.ship) this.ship.group.position.copy(this.shipHome);
    for (const o of this.orbs) o.taken = false;
    for (const p of this.passes) p.done = false;
    for (const c of this.checkpoints) {
      c.active = false;
      c.gem.material = this.extra.cpOff;
      c.halo.material.opacity = 0;
      c.ring.material.color.set("#9af4ff");
      c.ring.material.opacity = 0.35;
    }
  }
  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of this.mechs) m.dispose && m.dispose();
    for (const m of this.ownMats) m.dispose();
    if (this.mm) for (const m of Object.values(this.mm)) if (m !== this.M.brass) m.dispose();
    if (this.world.stageM === this.M) this.world.stageM = null;
  }
}
