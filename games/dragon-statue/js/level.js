/*
 * 드래곤 석상 대작전 · 모험 레벨 (데이터 → 3D 장면 + 충돌 세계 + 움직이는 것들)
 *
 *  - 데이터는 levels.js 가 만든다 (지역마다 발판 · 장애물 · 수집품 · 체크포인트 · 보스 경기장).
 *  - 보이는 모양(장식)과 실제 충돌 모양은 따로다: 충돌은 상자 · 경사로뿐, 장식은 묶어서 구운 메시.
 *  - 움직이는 발판 · 무너지는 발판 · 상자 · 스위치 · 문 · 불기둥 · 굴러오는 바위 · 떨어지는 통나무 · 바람 · 수정 · 하트 · 체크포인트 · 결승
 *  - update(dt, player) 는 일어난 일(events)을 돌려준다 → adventure.js 가 처리
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { part, bake, taperTube, slab } from "./geo.js?v=1";
import { stoneTex, stoneBump, grassTex, woodTex, dotTex, waterfallTex, flagstoneTex, lavaCrackTex, seeded } from "./tex.js?v=1";
import { jungleTree, roundTree, pineTree, bush, flowers, rock, pillar, crystalCluster, iceSpike, tower, arch, rubble } from "./world.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sph = (d = 1) => new THREE.IcosahedronGeometry(1, d);
const CHUNK = 28; // 장식을 몇 m 단위로 묶어 구울지 (화면 밖은 통째로 안 그린다)

/* ================================================================
 * 재질 (지역마다 색)
 * ============================================================== */
const PALETTE = {
  jungle: { top: "grass", side: "dirt", grass: "#6abf4e", dirt: "#8a6a48", stone: "#c4c0ac", wood: "#a8743e", accent: "#ffd36a", under: "roots" },
  falls: { top: "grass", side: "rock", grass: "#5ab45a", dirt: "#7a6a52", stone: "#b8c0b4", wood: "#9a6a3e", accent: "#8ae8ff", under: "moss" },
  crystal: { top: "cave", side: "darkrock", grass: "#6a6aa0", dirt: "#4a4668", stone: "#9a98c4", wood: "#6a5a7a", accent: "#7fe8ff", under: "crystals" },
  volcano: { top: "basalt", side: "lavarock", grass: "#5a4a44", dirt: "#3a2e2a", stone: "#8a7a72", wood: "#5a3a2a", accent: "#ff8a2a", under: "embers" },
  ice: { top: "snow", side: "ice", grass: "#eef6ff", dirt: "#9ab8d4", stone: "#d4e2ee", wood: "#8a7a6a", accent: "#9ae8ff", under: "icicles" },
  master: { top: "temple", side: "templewall", grass: "#7ab04a", dirt: "#9a7a5a", stone: "#e2cfa8", wood: "#8a5a3a", accent: "#ffd23f", under: "gold" },
};

function levelMaterials(T) {
  const P = PALETTE[T.id] || PALETTE.jungle;
  const own = (t, rep = 1) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rep, rep);
    c.userData.own = true;
    return c;
  };
  const M = {};
  M.grass = new THREE.MeshStandardMaterial({ color: "#ffffff", map: own(grassTex({ id: T.id + "lv", grass: P.grass })), roughness: 1, vertexColors: true });
  M.dirt = new THREE.MeshStandardMaterial({ color: P.dirt, map: own(stoneTex(21)), bumpMap: stoneBump(21), bumpScale: 1.5, roughness: 0.95, vertexColors: true });
  M.rock = new THREE.MeshStandardMaterial({ color: T.rock, map: own(stoneTex(22)), bumpMap: stoneBump(22), bumpScale: 2, roughness: 0.95, vertexColors: true });
  M.stone = new THREE.MeshStandardMaterial({ color: P.stone, map: own(stoneTex(23)), bumpMap: stoneBump(23), bumpScale: 1.2, roughness: 0.9, vertexColors: true });
  M.paving = new THREE.MeshStandardMaterial({ color: "#ffffff", map: own(flagstoneTex(T)), roughness: 0.92, vertexColors: true });
  M.wood = new THREE.MeshStandardMaterial({ color: P.wood, map: own(woodTex(P.wood)), roughness: 0.85, vertexColors: true });
  M.leaf = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, vertexColors: true, flatShading: T.id !== "jungle" && T.id !== "falls" });
  M.trunk = new THREE.MeshStandardMaterial({ color: T.trunk, map: own(woodTex(T.trunk)), roughness: 0.9, vertexColors: true });
  M.flower = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, vertexColors: true });
  M.crystal = new THREE.MeshStandardMaterial({ color: T.crystal, emissive: T.crystal, emissiveIntensity: 0.65, roughness: 0.1, metalness: 0.1, vertexColors: true, transparent: true, opacity: 0.92, flatShading: true });
  M.crystal2 = new THREE.MeshStandardMaterial({ color: "#c48aff", emissive: "#9a5aff", emissiveIntensity: 0.65, roughness: 0.1, vertexColors: true, transparent: true, opacity: 0.92, flatShading: true });
  M.ice = new THREE.MeshStandardMaterial({ color: "#cfefff", map: own(stoneTex(24)), roughness: 0.15, metalness: 0.05, emissive: "#3a7ab0", emissiveIntensity: 0.15, vertexColors: true });
  M.snow = new THREE.MeshStandardMaterial({ color: "#ffffff", map: own(stoneTex(25)), roughness: 0.9, vertexColors: true });
  M.cave = new THREE.MeshStandardMaterial({ color: "#7a78a8", map: own(stoneTex(26)), bumpMap: stoneBump(26), bumpScale: 1.4, roughness: 0.85, vertexColors: true });
  M.darkrock = new THREE.MeshStandardMaterial({ color: "#3e3a5e", map: own(stoneTex(27)), bumpMap: stoneBump(27), bumpScale: 2, roughness: 0.95, vertexColors: true });
  M.basalt = new THREE.MeshStandardMaterial({ color: "#5a4c48", map: own(stoneTex(28)), bumpMap: stoneBump(28), bumpScale: 1.8, roughness: 0.9, vertexColors: true });
  M.lavarock = new THREE.MeshStandardMaterial({ color: "#2e2422", map: own(stoneTex(29)), roughness: 0.95, emissive: "#ff5a10", emissiveMap: own(lavaCrackTex()), emissiveIntensity: 1.1, vertexColors: true });
  M.temple = new THREE.MeshStandardMaterial({ color: "#ffffff", map: own(flagstoneTex({ ...T, id: T.id + "tp", ground: "#d8c49a", groundGap: "#a07a3a" })), roughness: 0.85, vertexColors: true });
  M.templewall = new THREE.MeshStandardMaterial({ color: "#d8c4a0", map: own(stoneTex(30)), bumpMap: stoneBump(30), bumpScale: 1.2, roughness: 0.9, vertexColors: true });
  M.gold = new THREE.MeshStandardMaterial({ color: "#f0c050", metalness: 0.9, roughness: 0.3, vertexColors: true });
  M.rope = new THREE.MeshStandardMaterial({ color: "#c8a878", roughness: 0.9, vertexColors: true });
  M.rune = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: P.accent, emissiveIntensity: 1.2, roughness: 0.4, vertexColors: true });
  M.glow = new THREE.MeshBasicMaterial({ color: P.accent, vertexColors: true, transparent: true, opacity: 0.9 });
  return { M, P };
}

/* ================================================================
 * 레벨
 * ============================================================== */
export class Level {
  constructor(scene, fx, data, T, { quality = 1 } = {}) {
    this.scene = scene;
    this.fx = fx;
    this.data = data;
    this.T = T;
    this.quality = quality;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.solids = [];
    this.dyn = []; // 움직이는 것들
    this.crystals = []; // { p, taken, idx, big }
    this.hearts = [];
    this.checkpoints = [];
    this.breakables = [];
    this.switches = [];
    this.gates = {};
    this.hazards = [];
    this.tuts = [];
    this.goal = null;
    this.arena = null;
    this.enemiesData = [];
    this.t = 0;
    this.killY = data.killY;
    this.path = data.path.map(([x, y, z]) => V(x, y, z));
    this.pathLen = [0];
    for (let i = 1; i < this.path.length; i++) this.pathLen.push(this.pathLen[i - 1] + this.path[i].distanceTo(this.path[i - 1]));
    const { M, P } = levelMaterials(T);
    this.M = M;
    this.P = P;
    // 굽지 않은 메시(움직이는 발판 · 체크포인트 · 스위치 …)는 정점 색이 없으니 그 재질 복사본을 쓴다
    this.MS = {};
    this.solo = (name) => {
      if (!this.MS[name]) {
        const m = (this.M[name] || this.M.stone).clone();
        m.vertexColors = false;
        this.MS[name] = m;
      }
      return this.MS[name];
    };
    this.rnd = seeded(data.seed || 7);
    this.decoChunks = new Map(); // 청크 번호 → Group (굽기 전)
    this.build();
  }

  /* ---------------- 짓기 ---------------- */
  chunkOf(x, z) {
    // 길에서 가장 가까운 점의 누적 거리로 청크를 정한다
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < this.path.length; i++) {
      const p = this.path[i];
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return Math.floor(this.pathLen[best] / CHUNK);
  }
  deco(x, z) {
    const k = this.chunkOf(x, z);
    if (!this.decoChunks.has(k)) this.decoChunks.set(k, new THREE.Group());
    return this.decoChunks.get(k);
  }
  addSolid(s) {
    const solid = { type: "box", active: true, dx: 0, dy: 0, dz: 0, ...s };
    this.solids.push(solid);
    return solid;
  }

  build() {
    for (const pc of this.data.pieces) {
      const fn = this["b_" + pc.t];
      if (fn) fn.call(this, pc);
    }
    // 장식 굽기 (청크마다 재질별 한 덩어리)
    for (const g of this.decoChunks.values()) {
      const geos = bake(g, { ao: 0.45, height: 6, base: -2, cover: this.T.cover, coverAmount: this.T.coverAmount * 0.5, worldUV: 0.32, seed: 5 });
      for (const [mat, geo] of Object.entries(geos)) {
        const m = new THREE.Mesh(geo, this.M[mat] || this.M.stone);
        m.castShadow = !["flower", "glow", "rune"].includes(mat);
        m.receiveShadow = true;
        this.root.add(m);
      }
    }
    this.decoChunks.clear();
    // 수정 (하나의 인스턴스 메시)
    this.buildCrystals();
    // 아래 바닥 (물 · 용암 · 깊은 골짜기)
    this.buildUnder();
  }

  /** 발판 상자 (윗면 · 옆면 재질 따로, 난간 · 가장자리 장식) */
  b_box(pc) {
    const { x0, x1, y0, y1, z0, z1 } = pc;
    const top = pc.top || this.P.top;
    const side = pc.side || this.P.side;
    const g = this.deco((x0 + x1) / 2, (z0 + z1) / 2);
    const w = x1 - x0;
    const d = z1 - z0;
    const h = y1 - y0;
    g.add(part(new THREE.BoxGeometry(w, h - 0.12, d), side, { pos: [(x0 + x1) / 2, y0 + (h - 0.12) / 2, (z0 + z1) / 2] }));
    g.add(part(new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), top === "grass" ? "grass" : top === "temple" ? "temple" : top, { pos: [(x0 + x1) / 2, y1 - 0.08, (z0 + z1) / 2] }));
    this.addSolid({ x0, x1, y0, y1, z0, z1, slip: !!pc.slip, mat: top });
    if (pc.under !== false) this.underDeco(pc);
    if (pc.rails) this.rails(pc);
    if (pc.deco !== false) this.edgeDeco(pc);
  }
  /** 난간: 보이지 않는 벽 + 보이는 덤불 · 바위 · 울타리 */
  rails(pc) {
    const { x0, x1, y1, z0, z1 } = pc;
    const along = pc.axis || (x1 - x0 > z1 - z0 ? "x" : "z");
    const inset = pc.edge || 0;
    const H = 1.6;
    const lines = along === "z" ? [x0 + inset, x1 - inset] : [z0 + inset, z1 - inset];
    for (const [k, L] of lines.entries()) {
      const outer = k === 0 ? -1 : 1;
      if (pc.openSide === (k === 0 ? "min" : "max")) continue;
      if (along === "z") this.addSolid({ x0: L - 0.3 + (outer < 0 ? -0.3 : 0), x1: L + 0.3 + (outer > 0 ? 0.3 : 0), y0: y1, y1: y1 + H, z0, z1, rail: true });
      else this.addSolid({ x0, x1, y0: y1, y1: y1 + H, z0: L - 0.3 + (outer < 0 ? -0.3 : 0), z1: L + 0.3 + (outer > 0 ? 0.3 : 0), rail: true });
      // 보이는 울타리
      const len = along === "z" ? z1 - z0 : x1 - x0;
      const n = Math.max(1, Math.floor(len / 1.6));
      for (let i = 0; i <= n; i++) {
        const u = (along === "z" ? z0 : x0) + (i / n) * len;
        const x = along === "z" ? L + outer * 0.15 : u;
        const z = along === "z" ? u : L + outer * 0.15;
        this.railItem(this.deco(x, z), x, y1, z, i);
      }
    }
  }
  railItem(g, x, y, z, i) {
    const r = this.rnd;
    const T = this.T;
    const kind = pcKind(T.id);
    if (kind === "bush") {
      if (i % 3 === 2) rockAt(g, x, y, z, 0.55 + r() * 0.3, r);
      else bushAt(g, x, y, z, 0.62 + r() * 0.25, r, T);
    } else if (kind === "crystal") {
      if (i % 2) crystalAt(g, x, y, z, 0.42 + r() * 0.3, r, r() < 0.5 ? "crystal" : "crystal2");
      else rockAt(g, x, y, z, 0.5 + r() * 0.3, r, "darkrock");
    } else if (kind === "lava") {
      rockAt(g, x, y, z, 0.55 + r() * 0.35, r, "basalt");
    } else if (kind === "ice") {
      if (i % 2) iceAt(g, x, y, z, 0.4 + r() * 0.3, r);
      else rockAt(g, x, y, z, 0.5 + r() * 0.3, r, "snow");
    } else {
      // 신전: 돌 난간 기둥 + 금 장식
      g.add(part(new THREE.BoxGeometry(0.42, 0.9, 0.42), "templewall", { pos: [x, y + 0.45, z] }));
      g.add(part(new THREE.SphereGeometry(0.16, 10, 8), "gold", { pos: [x, y + 1.0, z] }));
    }
  }
  /** 가장자리 장식: 넓은 발판이면 나무 · 꽃 · 바위 (걷는 곳 바깥 띠에만) */
  edgeDeco(pc) {
    const { x0, x1, y1, z0, z1 } = pc;
    const inset = pc.edge || 0;
    if (inset < 1) {
      // 좁은 길: 풀포기 · 작은 돌만 가장자리에 조금
      const along = x1 - x0 > z1 - z0 ? "x" : "z";
      const len = along === "z" ? z1 - z0 : x1 - x0;
      const n = Math.floor(len / 3);
      for (let i = 0; i < n; i++) {
        const u = (along === "z" ? z0 : x0) + (i + this.rnd()) * (len / n);
        const side = this.rnd() < 0.5 ? 0 : 1;
        const x = along === "z" ? (side ? x1 - 0.2 : x0 + 0.2) : u;
        const z = along === "z" ? u : side ? z1 - 0.2 : z0 + 0.2;
        this.smallDeco(this.deco(x, z), x, y1, z);
      }
      return;
    }
    const along = pc.axis || (x1 - x0 > z1 - z0 ? "x" : "z");
    const len = along === "z" ? z1 - z0 : x1 - x0;
    const n = Math.max(1, Math.floor(len / 3.2));
    for (const side of [0, 1]) {
      if (pc.openSide === (side ? "max" : "min")) continue;
      for (let i = 0; i < n; i++) {
        const u = (along === "z" ? z0 : x0) + (i + 0.5 + (this.rnd() - 0.5) * 0.6) * (len / n);
        const o = inset * (0.35 + this.rnd() * 0.4);
        const x = along === "z" ? (side ? x1 - o : x0 + o) : u;
        const z = along === "z" ? u : side ? z1 - o : z0 + o;
        this.bigDeco(this.deco(x, z), x, y1, z, i, inset);
      }
    }
  }
  smallDeco(g, x, y, z) {
    const r = this.rnd;
    const T = this.T;
    const kind = pcKind(T.id);
    if (kind === "bush") {
      if (r() < 0.5) grassTuft(g, x, y, z, r, T);
      else flowerAt(g, x, y, z, r, T);
    } else if (kind === "crystal") crystalAt(g, x, y, z, 0.25 + r() * 0.2, r, r() < 0.5 ? "crystal" : "crystal2");
    else if (kind === "ice") iceAt(g, x, y, z, 0.22 + r() * 0.15, r);
    else rockAt(g, x, y, z, 0.25 + r() * 0.2, r, kind === "lava" ? "basalt" : "templewall");
  }
  bigDeco(g, x, y, z, i, inset) {
    const r = this.rnd;
    const T = this.T;
    const kind = pcKind(T.id);
    const s = Math.min(1.2, inset / 2.4);
    if (kind === "bush") {
      const roll = r();
      if (roll < 0.35 && inset >= 1.8) jungleTreeAt(g, x, y, z, (0.65 + r() * 0.35) * s, r, T);
      else if (roll < 0.6) bushAt(g, x, y, z, 0.8 + r() * 0.5, r, T);
      else if (roll < 0.8) flowerAt(g, x, y, z, r, T, 5);
      else rockAt(g, x, y, z, 0.6 + r() * 0.5, r);
    } else if (kind === "crystal") {
      if (r() < 0.6) crystalAt(g, x, y, z, 0.7 + r() * 0.7, r, r() < 0.5 ? "crystal" : "crystal2");
      else rockAt(g, x, y, z, 0.7 + r() * 0.6, r, "darkrock");
    } else if (kind === "lava") {
      if (r() < 0.25) deadTreeAt(g, x, y, z, r);
      else rockAt(g, x, y, z, 0.7 + r() * 0.7, r, "basalt");
    } else if (kind === "ice") {
      if (r() < 0.45 && inset >= 1.8) pineAt(g, x, y, z, (0.6 + r() * 0.3) * s, r, T);
      else iceAt(g, x, y, z, 0.6 + r() * 0.5, r);
    } else {
      if (i % 2 === 0 && inset >= 1.8) {
        g.add(part(new THREE.CylinderGeometry(0.32, 0.36, 3.2, 10), "templewall", { pos: [x, y + 1.6, z] }));
        g.add(part(new THREE.BoxGeometry(0.9, 0.24, 0.9), "templewall", { pos: [x, y + 3.3, z] }));
        g.add(part(new THREE.OctahedronGeometry(0.3, 0), "gold", { pos: [x, y + 3.75, z] }));
      } else flowerAt(g, x, y, z, r, T, 4);
    }
  }
  /** 발판 아래: 뿌리 · 이끼 · 수정 · 고드름 (떠 있는 섬 느낌) */
  underDeco(pc) {
    const { x0, x1, y0, z0, z1 } = pc;
    const r = this.rnd;
    const g = this.deco((x0 + x1) / 2, (z0 + z1) / 2);
    const kind = this.P.under;
    const area = (x1 - x0) * (z1 - z0);
    const n = Math.min(10, Math.floor(area / 10));
    // 아래로 좁아지는 바위 덩어리
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const rw = (x1 - x0) * 0.42;
    const rd = (z1 - z0) * 0.42;
    const cone = new THREE.ConeGeometry(1, 1, 7);
    cone.rotateX(Math.PI);
    g.add(part(cone, this.P.side === "ice" ? "ice" : this.P.side, { pos: [cx, y0 - 1.1, cz], scale: [rw, 2.2, rd], rot: [0, r() * 3, 0] }));
    for (let i = 0; i < n; i++) {
      const x = x0 + 0.4 + r() * (x1 - x0 - 0.8);
      const z = z0 + 0.4 + r() * (z1 - z0 - 0.8);
      if (kind === "roots" || kind === "moss") {
        const len = 0.8 + r() * 1.6;
        g.add(part(taperTube([V(0, 0, 0), V((r() - 0.5) * 0.3, -len * 0.5, (r() - 0.5) * 0.3), V((r() - 0.5) * 0.4, -len, (r() - 0.5) * 0.4)], (t) => 0.06 * (1 - t * 0.8), 5, 5), kind === "roots" ? "trunk" : "leaf", { pos: [x, y0, z], tint: kind === "moss" ? this.T.leaf[2] : 1 }));
      } else if (kind === "crystals") {
        const c = new THREE.ConeGeometry(0.14, 0.9, 5);
        c.rotateX(Math.PI);
        g.add(part(c, r() < 0.5 ? "crystal" : "crystal2", { pos: [x, y0 - 0.4, z], scale: 0.6 + r(), rot: [(r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4] }));
      } else if (kind === "icicles") {
        const c = new THREE.ConeGeometry(0.12, 1, 6);
        c.rotateX(Math.PI);
        g.add(part(c, "ice", { pos: [x, y0 - 0.5, z], scale: [1, 0.6 + r() * 1.2, 1] }));
      } else if (kind === "embers") {
        const c = new THREE.ConeGeometry(0.2, 0.8, 5);
        c.rotateX(Math.PI);
        g.add(part(c, "lavarock", { pos: [x, y0 - 0.4, z], scale: 0.8 + r() }));
      } else if (kind === "gold") {
        g.add(part(new THREE.BoxGeometry(0.5, 0.3, 0.5), "gold", { pos: [x, y0 - 0.1, z] }));
      }
    }
  }

  /** 경사로 */
  b_ramp(pc) {
    const { x0, x1, z0, z1, h0, h1, axis } = pc;
    const top = pc.top || this.P.top;
    const side = pc.side || this.P.side;
    const g = this.deco((x0 + x1) / 2, (z0 + z1) / 2);
    const len = axis === "z" ? z1 - z0 : x1 - x0;
    const wid = axis === "z" ? x1 - x0 : z1 - z0;
    const ang = Math.atan2(h1 - h0, len);
    const slope = Math.hypot(len, h1 - h0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const midY = (h0 + h1) / 2;
    // 윗판 (기울어진 판) + 아래 받침 상자
    const plate = new THREE.BoxGeometry(axis === "z" ? wid : slope, 0.3, axis === "z" ? slope : wid);
    const rot = axis === "z" ? [ang * (pc.dirSign || 1), 0, 0] : [0, 0, -ang * (pc.dirSign || 1)];
    g.add(part(plate, top, { pos: [cx, midY - 0.15, cz], rot }));
    const lowTop = Math.min(h0, h1);
    g.add(part(new THREE.BoxGeometry(x1 - x0, 3, z1 - z0), side, { pos: [cx, lowTop - 1.6, cz] }));
    this.addSolid({ type: "ramp", x0, x1, z0, z1, y0: lowTop - 3, y1: Math.max(h0, h1), axis, h0, h1, start: pc.start, end: pc.end, mat: top });
    if (pc.rails) this.rails({ x0, x1, y1: Math.max(h0, h1), z0, z1, axis, edge: pc.edge || 0 });
  }

  /** 나무 다리 (판자 · 밧줄 · 기둥) — 출렁 다리면 살짝 오르내린다 */
  b_bridge(pc) {
    const { x0, x1, y, z0, z1, axis } = pc;
    const along = axis || (x1 - x0 > z1 - z0 ? "x" : "z");
    const len = along === "z" ? z1 - z0 : x1 - x0;
    const wid = along === "z" ? x1 - x0 : z1 - z0;
    const grp = new THREE.Group();
    const n = Math.floor(len / 0.5);
    const planks = [];
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) * (len / n);
      const geo = new THREE.BoxGeometry(along === "z" ? wid : 0.42, 0.12, along === "z" ? 0.42 : wid);
      const m = new THREE.Mesh(geo, this.solo("wood"));
      const lx = along === "z" ? (x0 + x1) / 2 : x0 + u;
      const lz = along === "z" ? z0 + u : (z0 + z1) / 2;
      m.position.set(lx, y - 0.06, lz);
      m.rotation.set(0, (this.rnd() - 0.5) * 0.06, 0);
      m.castShadow = m.receiveShadow = true;
      grp.add(m);
      planks.push({ m, u: u / len, base: y - 0.06 });
    }
    // 밧줄 난간 + 기둥
    const ropes = [];
    for (const sd of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const sag = Math.sin(u * Math.PI) * 0.25;
        pts.push(along === "z" ? V((sd < 0 ? x0 : x1), y + 1.0 - sag, z0 + u * len) : V(x0 + u * len, y + 1.0 - sag, sd < 0 ? z0 : z1));
      }
      const rope = new THREE.Mesh(taperTube(pts, () => 0.035, 20, 5), this.solo("rope"));
      grp.add(rope);
      ropes.push(rope);
      for (const u of [0, 1]) {
        const px = along === "z" ? (sd < 0 ? x0 : x1) : x0 + u * len;
        const pz = along === "z" ? z0 + u * len : sd < 0 ? z0 : z1;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 8), this.solo("wood"));
        post.position.set(px, y + 0.5, pz);
        post.castShadow = true;
        grp.add(post);
      }
    }
    this.root.add(grp);
    const solid = this.addSolid({ x0, x1, y0: y - 0.3, y1: y, z0, z1, mat: "wood" });
    if (pc.rails) {
      // 밧줄 난간은 막아 준다 (떨어지지 않게)
      if (along === "z") {
        this.addSolid({ x0: x0 - 0.6, x1: x0, y0: y, y1: y + 1.4, z0, z1, rail: true });
        this.addSolid({ x0: x1, x1: x1 + 0.6, y0: y, y1: y + 1.4, z0, z1, rail: true });
      } else {
        this.addSolid({ x0, x1, y0: y, y1: y + 1.4, z0: z0 - 0.6, z1: z0, rail: true });
        this.addSolid({ x0, x1, y0: y, y1: y + 1.4, z0: z1, z1: z1 + 0.6, rail: true });
      }
    }
    if (pc.sway) this.dyn.push({ kind: "sway", planks, t0: this.rnd() * 5, amp: pc.sway, solid, y });
  }

  /** 낮은 통나무 (점프로 넘기) · 막는 바위 */
  b_log(pc) {
    const { x, y, z, len = 4, axis = "x", r = 0.32 } = pc;
    const g = this.deco(x, z);
    const geo = new THREE.CylinderGeometry(r, r * 1.05, len, 12);
    geo.rotateZ(Math.PI / 2);
    g.add(part(geo, "trunk", { pos: [x, y + r, z], rot: [0, axis === "x" ? 0 : Math.PI / 2, 0] }));
    for (const s of [-1, 1]) g.add(part(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.05, 12), "wood", { pos: axis === "x" ? [x + (s * len) / 2, y + r, z] : [x, y + r, z + (s * len) / 2], rot: axis === "x" ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], tint: 1.3 }));
    // 이끼 · 버섯 한두 개
    g.add(part(sph(1), "leaf", { pos: [x + (axis === "x" ? 0.6 : 0), y + r * 1.8, z + (axis === "x" ? 0 : 0.6)], scale: [0.35, 0.12, 0.25], tint: this.T.leaf[0] }));
    const hx = axis === "x" ? len / 2 : r;
    const hz = axis === "x" ? r : len / 2;
    this.addSolid({ x0: x - hx, x1: x + hx, y0: y, y1: y + r * 2, z0: z - hz, z1: z + hz, obstacle: true });
  }
  b_rock(pc) {
    const { x, y, z, s = 1.2 } = pc;
    const g = this.deco(x, z);
    const kind = pcKind(this.T.id);
    const mat = kind === "crystal" ? "darkrock" : kind === "lava" ? "basalt" : kind === "ice" ? "ice" : "rock";
    rockAt(g, x, y, z, s, this.rnd, mat);
    this.addSolid({ x0: x - s * 0.85, x1: x + s * 0.85, y0: y, y1: y + s * 1.1, z0: z - s * 0.85, z1: z + s * 0.85, obstacle: true });
  }
  /** 장식만 (충돌 없음) */
  b_deco(pc) {
    const { x, y, z, s = 1, kind } = pc;
    const g = this.deco(x, z);
    const r = this.rnd;
    const T = this.T;
    if (kind === "jtree") jungleTreeAt(g, x, y, z, s, r, T);
    else if (kind === "tree") {
      const t = new THREE.Group();
      roundTree(t, 0, 0, s, r, T);
      t.position.set(x, y, z);
      g.add(t);
    } else if (kind === "pine") pineAt(g, x, y, z, s, r, T);
    else if (kind === "bush") bushAt(g, x, y, z, s, r, T);
    else if (kind === "flowers") flowerAt(g, x, y, z, r, T, 6);
    else if (kind === "rock") rockAt(g, x, y, z, s, r, pc.mat || "rock");
    else if (kind === "crystals") crystalAt(g, x, y, z, s, r, pc.mat || "crystal");
    else if (kind === "ice") iceAt(g, x, y, z, s, r);
    else if (kind === "pillar") {
      const t = new THREE.Group();
      pillar(t, 0, 0, pc.h || 4, 0.4 * s, { broken: !!pc.broken, rnd: r });
      t.position.set(x, y, z);
      retag(t, "stone", pc.mat || (T.id === "master" ? "templewall" : "stone"));
      g.add(t);
    } else if (kind === "arch") {
      const t = new THREE.Group();
      arch(t, 0, 0, s, pc.rot || 0, r);
      t.position.set(x, y, z);
      retag(t, "stone", T.id === "master" ? "templewall" : "stone");
      g.add(t);
    } else if (kind === "temple") templeAt(g, x, y, z, s, pc.rot || 0, T);
    else if (kind === "cliff") cliffAt(g, x, y, z, pc, r, this);
    else if (kind === "tower") {
      const t = new THREE.Group();
      tower(t, 0, 0, s, r, "ice");
      t.position.set(x, y, z);
      retag(t, "stone", "snow");
      retag(t, "glowwin", "glow");
      g.add(t);
    } else if (kind === "volcano") volcanoAt(g, x, y, z, s);
    else if (kind === "statue") {
      // 거대한 드래곤 조각상 (배경) — 석상 모듈 없이 간단한 실루엣
      bigStatueAt(g, x, y, z, s, pc.rot || 0, T);
    } else if (kind === "rubble") {
      const t = new THREE.Group();
      rubble(t, 0, 0, s, r);
      t.position.set(x, y, z);
      g.add(t);
    }
  }
  /** 폭포 (흐르는 물줄기 + 물안개) */
  b_falls(pc) {
    const { x, y, z, w = 4, h = 12, rot = 0 } = pc;
    const tex = waterfallTex().clone();
    tex.needsUpdate = true;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, h / 6);
    tex.userData.own = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: "#e8fbff", side: THREE.DoubleSide }));
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rot;
    this.root.add(m);
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffffff", transparent: true, opacity: 0.5, depthWrite: false }));
    mist.position.set(x, y + 0.6, z);
    mist.scale.set(w * 1.8, 2.4, 1);
    this.root.add(mist);
    // 뒤 절벽
    const g = this.deco(x, z);
    g.add(part(new THREE.BoxGeometry(w + 3, h + 2, 2.2), "rock", { pos: [x - Math.sin(rot) * 1.3, y + h / 2 - 1, z - Math.cos(rot) * 1.3], rot: [0, rot, 0] }));
    g.add(part(new THREE.BoxGeometry(w + 4, 0.8, 2.6), "grass", { pos: [x - Math.sin(rot) * 1.3, y + h + 0.1, z - Math.cos(rot) * 1.3], rot: [0, rot, 0] }));
    this.dyn.push({ kind: "falls", tex, mist, speed: pc.speed || 1.3 });
  }

  /* ---------------- 움직이는 발판 · 무너지는 발판 ---------------- */
  platformMesh(w, d, h = 0.6, top = null) {
    const grp = new THREE.Group();
    const side = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.12, d), this.solo(this.P.side));
    side.position.y = -h / 2 - 0.06;
    const tp = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.14, d + 0.1), this.solo(top || this.P.top));
    tp.position.y = -0.07;
    side.castShadow = tp.castShadow = true;
    side.receiveShadow = tp.receiveShadow = true;
    grp.add(side, tp);
    // 빛나는 룬 테두리 (움직이는 발판 표시)
    const rune = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.06, d + 0.16), this.solo("glow"));
    rune.position.y = -0.17;
    grp.add(rune);
    return grp;
  }
  b_mover(pc) {
    const { a, b, w = 2.6, d = 2.6, period = 4, phase = 0 } = pc;
    const mesh = this.platformMesh(w, d, 0.6, pc.top);
    this.root.add(mesh);
    const solid = this.addSolid({ x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0, mover: true, mat: pc.top || this.P.top });
    const o = { kind: "mover", a: V(...a), b: V(...b), w, d, period, phase, mesh, solid, pos: V(...a), prev: V(...a) };
    this.placeMover(o, 0);
    o.prev.copy(o.pos);
    this.dyn.push(o);
  }
  placeMover(o, t) {
    const k = 0.5 - 0.5 * Math.cos(TAU * (t / o.period + o.phase));
    o.pos.lerpVectors(o.a, o.b, k);
    o.mesh.position.copy(o.pos);
    const s = o.solid;
    s.x0 = o.pos.x - o.w / 2;
    s.x1 = o.pos.x + o.w / 2;
    s.z0 = o.pos.z - o.d / 2;
    s.z1 = o.pos.z + o.d / 2;
    s.y1 = o.pos.y;
    s.y0 = o.pos.y - 0.6;
  }
  b_crumble(pc) {
    const { x, y, z, w = 2.2, d = 2.2 } = pc;
    const mesh = this.platformMesh(w, d, 0.5, pc.top);
    // 금 간 무늬
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, d * 0.9), new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, depthWrite: false, opacity: 0.85 }));
    crack.rotation.x = -Math.PI / 2;
    crack.position.y = 0.005;
    mesh.add(crack);
    mesh.position.set(x, y, z);
    this.root.add(mesh);
    const solid = this.addSolid({ x0: x - w / 2, x1: x + w / 2, y0: y - 0.5, y1: y, z0: z - d / 2, z1: z + d / 2, crumble: true, mat: pc.top || this.P.top });
    this.dyn.push({ kind: "crumble", mesh, solid, home: V(x, y, z), state: "idle", t: 0 });
  }

  /* ---------------- 부술 수 있는 것 · 스위치 · 문 ---------------- */
  b_crate(pc) {
    const { x, y, z, s = 1.1, loot = "crystals" } = pc;
    const grp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: "#c8925a", map: woodTex("#c8925a"), roughness: 0.8 }));
    box.castShadow = box.receiveShadow = true;
    grp.add(box);
    // 나무 띠
    const band = new THREE.MeshStandardMaterial({ color: "#7a4a2a", roughness: 0.7 });
    for (const yy of [-0.32, 0.32]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(s + 0.04, 0.1, s + 0.04), band);
      b.position.y = yy * s;
      grp.add(b);
    }
    // 무늬: 수정 상자는 빛나는 표시, 하트 상자는 하트
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.5, s * 0.5), new THREE.MeshBasicMaterial({ map: lootTex(loot), transparent: true }));
    mark.position.set(0, 0, s / 2 + 0.03);
    grp.add(mark);
    const mark2 = mark.clone();
    mark2.position.set(0, 0, -s / 2 - 0.03);
    mark2.rotation.y = Math.PI;
    grp.add(mark2);
    grp.position.set(x, y + s / 2, z);
    grp.rotation.y = pc.rot || 0;
    this.root.add(grp);
    const solid = this.addSolid({ x0: x - s / 2, x1: x + s / 2, y0: y, y1: y + s, z0: z - s / 2, z1: z + s / 2, breakable: true });
    this.breakables.push({ kind: "crate", p: V(x, y + s / 2, z), r: s * 0.75, mesh: grp, solid, loot, hp: 1, broken: false, color: "#c8925a" });
  }
  /** 막아선 나무 울타리 (방망이로 부숴야 지나간다) */
  b_fence(pc) {
    const { x0, x1, y, z0, z1 } = pc;
    const grp = new THREE.Group();
    const along = x1 - x0 > z1 - z0 ? "x" : "z";
    const len = along === "x" ? x1 - x0 : z1 - z0;
    const n = Math.max(3, Math.round(len / 0.45));
    const wood = new THREE.MeshStandardMaterial({ color: "#b07a42", map: woodTex("#b07a42"), roughness: 0.85 });
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const h = 1.3 + (i % 2) * 0.15;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.18), wood);
      if (along === "x") m.position.set(x0 + u * len, y + h / 2, (z0 + z1) / 2);
      else m.position.set((x0 + x1) / 2, y + h / 2, z0 + u * len);
      if (along === "z") m.rotation.y = Math.PI / 2;
      m.castShadow = true;
      grp.add(m);
    }
    for (const hh of [0.4, 0.95]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(along === "x" ? len : 0.14, 0.14, along === "x" ? 0.14 : len), wood);
      bar.position.set((x0 + x1) / 2, y + hh, (z0 + z1) / 2 + (along === "x" ? 0.14 : 0));
      if (along === "z") bar.position.x += 0.14;
      grp.add(bar);
    }
    this.root.add(grp);
    const solid = this.addSolid({ x0, x1, y0: y, y1: y + 1.45, z0, z1, breakable: true });
    this.breakables.push({ kind: "fence", p: V((x0 + x1) / 2, y + 0.7, (z0 + z1) / 2), r: Math.max(x1 - x0, z1 - z0) / 2 + 0.3, mesh: grp, solid, loot: "crystals", hp: 1, broken: false, color: "#b07a42", wide: true, box: { x0, x1, z0, z1 } });
  }
  b_switch(pc) {
    const { x, y, z, gate } = pc;
    const grp = new THREE.Group();
    const stone = this.solo(this.T.id === "master" ? "templewall" : "stone");
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 8), stone);
    base.position.y = 0.45;
    base.castShadow = true;
    const orbM = new THREE.MeshStandardMaterial({ color: "#ff8a6a", emissive: "#ff5a3a", emissiveIntensity: 1.2, roughness: 0.2 });
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), orbM);
    orb.position.y = 1.25;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff8a6a", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.6);
    orb.add(halo);
    grp.add(base, orb);
    grp.position.set(x, y, z);
    this.root.add(grp);
    this.addSolid({ x0: x - 0.5, x1: x + 0.5, y0: y, y1: y + 0.9, z0: z - 0.5, z1: z + 0.5, obstacle: true });
    this.switches.push({ p: V(x, y + 1.2, z), r: 0.9, orb, orbM, halo, gate, on: false });
  }
  b_gate(pc) {
    const { id, x0, x1, y, z0, z1 } = pc;
    const grp = new THREE.Group();
    const along = x1 - x0 > z1 - z0 ? "x" : "z";
    const len = along === "x" ? x1 - x0 : z1 - z0;
    const bars = Math.max(3, Math.round(len / 0.6));
    const metal = new THREE.MeshStandardMaterial({ color: "#8a7a6a", metalness: 0.6, roughness: 0.4 });
    for (let i = 0; i < bars; i++) {
      const u = (i + 0.5) / bars;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), metal);
      if (along === "x") m.position.set(x0 + u * len, y + 1.3, (z0 + z1) / 2);
      else m.position.set((x0 + x1) / 2, y + 1.3, z0 + u * len);
      m.castShadow = true;
      grp.add(m);
    }
    for (const hh of [0.3, 2.4]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(along === "x" ? len : 0.2, 0.2, along === "x" ? 0.2 : len), metal);
      b.position.set((x0 + x1) / 2, y + hh, (z0 + z1) / 2);
      grp.add(b);
    }
    // 빛나는 자물쇠 룬
    const lock = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: "#ff8a6a" }));
    lock.position.set((x0 + x1) / 2, y + 1.5, (z0 + z1) / 2 + (along === "x" ? 0.12 : 0));
    if (along === "z") {
      lock.rotation.y = Math.PI / 2;
      lock.position.x += 0.12;
    }
    grp.add(lock);
    this.root.add(grp);
    const solid = this.addSolid({ x0, x1, y0: y, y1: y + 2.6, z0, z1, gate: true });
    this.gates[id] = { grp, solid, open: false, t: 0, lock };
  }

  /* ---------------- 위험한 것들 (모두 미리 알려 준다) ---------------- */
  /** 불기둥 · 물기둥: 쉬고 → 예고(빛 · 연기 · 소리) → 뿜기 */
  b_jet(pc) {
    const { x, y, z, kind = "fire", period = 3.2, phase = 0, r = 0.75, h = 3.2 } = pc;
    const grp = new THREE.Group();
    const ventM = new THREE.MeshStandardMaterial({ color: kind === "fire" ? "#3a2a26" : "#6a7a7a", roughness: 0.9 });
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 1.15, 0.22, 12), ventM);
    vent.position.y = 0.06;
    vent.receiveShadow = true;
    const glowM = new THREE.MeshBasicMaterial({ color: kind === "fire" ? "#ff7a2a" : "#bff4ff", transparent: true, opacity: 0, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.4, 24), glowM);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.19;
    const colM = new THREE.MeshBasicMaterial({ color: kind === "fire" ? "#ffb04a" : "#e0faff", transparent: true, opacity: 0.85, depthWrite: false, blending: kind === "fire" ? THREE.AdditiveBlending : THREE.NormalBlending });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.85, h, 12, 1, true), colM);
    col.position.y = h / 2;
    col.visible = false;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.45, h * 0.9, 10, 1, true), new THREE.MeshBasicMaterial({ color: kind === "fire" ? "#fff2b0" : "#ffffff", transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    core.position.y = h * 0.45;
    col.add(core);
    grp.add(vent, glow, col);
    grp.position.set(x, y, z);
    this.root.add(grp);
    this.hazards.push({ kind: "jet", sub: kind, p: V(x, y, z), r, h, period, phase, grp, col, colM, glowM, state: "rest", warnFired: false });
  }
  /** 굴러오는 바위: a → b 로 굴러가고, 다시 a 에서 (출발 전 흙먼지 · 소리) */
  b_boulder(pc) {
    const { a, b, r = 0.7, speed = 5, pause = 1.2, phase = 0 } = pc;
    const kind = pcKind(this.T.id);
    const mat = this.solo(kind === "crystal" ? "cave" : kind === "lava" ? "basalt" : kind === "ice" ? "ice" : "rock");
    const geo = new THREE.DodecahedronGeometry(r, 1);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    this.root.add(m);
    const A = V(...a);
    const B = V(...b);
    const len = A.distanceTo(B);
    this.hazards.push({ kind: "boulder", A, B, r, len, dur: len / speed, pause, t: -phase * (len / speed + pause), mesh: m, p: A.clone(), warned: false });
    m.position.copy(A).setY(A.y + r);
  }
  /** 떨어지는 통나무 · 고드름 · 돌: 바닥 표시가 커지고 → 떨어짐 (떨어지는 순간에만 아프다) */
  b_drop(pc) {
    const { x, y, z, kind = "log", period = 3.6, phase = 0, r = 1.1 } = pc;
    let m;
    if (kind === "log") {
      const geo = new THREE.CylinderGeometry(0.42, 0.45, 2.6, 12);
      geo.rotateZ(Math.PI / 2);
      m = new THREE.Mesh(geo, this.solo("trunk").clone());
    } else if (kind === "icicle") {
      const geo = new THREE.ConeGeometry(0.45, 2.2, 7);
      geo.rotateX(Math.PI);
      m = new THREE.Mesh(geo, this.solo("ice").clone());
    } else {
      m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 1), this.solo(kind === "crystal" ? "crystal" : "rock").clone());
    }
    m.castShadow = true;
    m.visible = false;
    this.root.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: 0, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.04, z);
    const shade = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0, depthWrite: false }));
    shade.rotation.x = -Math.PI / 2;
    shade.position.set(x, y + 0.03, z);
    this.root.add(ring, shade);
    this.hazards.push({ kind: "drop", sub: kind, p: V(x, y, z), r, period, phase, mesh: m, ring, shade, state: "rest", hitDone: false });
  }
  /** 바람: 눈발 줄무늬가 먼저 보이고 → 옆으로 민다 */
  b_wind(pc) {
    const { x0, x1, z0, z1, y, dir, force = 4, period = 5, phase = 0 } = pc;
    const n = 26;
    const streaks = [];
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.05), mat);
      s.position.set(x0 + this.rnd() * (x1 - x0), y + 0.3 + this.rnd() * 2.2, z0 + this.rnd() * (z1 - z0));
      s.rotation.y = Math.atan2(-dir[1], dir[0]);
      this.root.add(s);
      streaks.push(s);
    }
    this.hazards.push({ kind: "wind", x0, x1, z0, z1, y, dir: new THREE.Vector2(...dir).normalize(), force, period, phase, streaks, mat, state: "calm" });
  }

  /* ---------------- 수집품 · 체크포인트 · 결승 ---------------- */
  b_cr(pc) {
    this.crystals.push({ p: V(pc.x, pc.y + 0.9, pc.z), taken: false, big: false, bonus: !!pc.bonus });
  }
  b_big(pc) {
    this.crystals.push({ p: V(pc.x, pc.y + 1.1, pc.z), taken: false, big: true, bonus: true });
  }
  b_heart(pc) {
    const m = new THREE.Mesh(heartGeo(), new THREE.MeshStandardMaterial({ color: "#ff5a7a", emissive: "#ff2a5a", emissiveIntensity: 0.5, roughness: 0.35 }));
    m.position.set(pc.x, pc.y + 0.9, pc.z);
    m.scale.setScalar(0.42);
    m.castShadow = true;
    this.root.add(m);
    this.hearts.push({ p: m.position.clone(), mesh: m, taken: false });
  }
  b_cp(pc) {
    const { x, y, z, yaw = 0 } = pc;
    const grp = new THREE.Group();
    const stone = this.solo(this.T.id === "master" ? "templewall" : "stone");
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.45), stone);
    st.position.y = 0.75;
    st.castShadow = true;
    grp.add(st);
    const runeM = new THREE.MeshStandardMaterial({ color: "#6a6a6a", emissive: "#000000", roughness: 0.6 });
    const rune = new THREE.Mesh(new THREE.CircleGeometry(0.22, 6), runeM);
    rune.position.set(0, 0.95, 0.231);
    grp.add(rune);
    // 깃발
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 6), new THREE.MeshStandardMaterial({ color: "#7a5a3a" }));
    pole.position.set(0.55, 1.1, 0);
    const flagM = new THREE.MeshStandardMaterial({ color: "#9a9a9a", side: THREE.DoubleSide, roughness: 0.7 });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45, 6, 1), flagM);
    flag.position.set(0.9, 1.95, 0);
    grp.add(pole, flag);
    grp.position.set(x, y, z);
    grp.rotation.y = yaw;
    this.root.add(grp);
    this.checkpoints.push({ p: V(x, y, z), yaw, active: false, runeM, flagM, flag, idx: this.checkpoints.length });
  }
  b_goal(pc) {
    const { x, y, z, yaw = 0, boss = false } = pc;
    const grp = new THREE.Group();
    const stone = this.solo(this.T.id === "master" ? "templewall" : "stone");
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.6, 0.8), stone);
      p.position.set(s * 2.1, 2.3, 0);
      p.castShadow = true;
      grp.add(p);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.8, 1.0), stone);
    top.position.y = 4.9;
    top.castShadow = true;
    grp.add(top);
    const portalM = new THREE.MeshBasicMaterial({ color: boss ? "#ff9a6a" : "#bff4ff", transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.4), portalM);
    portal.position.y = 2.2;
    grp.add(portal);
    const runeM = new THREE.MeshBasicMaterial({ color: this.P.accent });
    const rune = new THREE.Mesh(new THREE.CircleGeometry(0.35, 8), runeM);
    rune.position.set(0, 4.9, 0.51);
    grp.add(rune);
    grp.position.set(x, y, z);
    grp.rotation.y = yaw;
    this.root.add(grp);
    this.goal = { p: V(x, y, z), r: 2.0, boss, portalM, grp };
  }
  b_tut(pc) {
    this.tuts.push({ ...pc, done: false });
  }
  b_en(pc) {
    this.enemiesData.push(pc);
  }
  /** 보스 경기장: 둥근 바닥 + 둘레 벽 + 기둥 */
  b_arena(pc) {
    const { x, y, z, r = 13 } = pc;
    const g = this.deco(x, z);
    const top = this.P.top === "grass" ? "paving" : this.P.top;
    g.add(part(new THREE.CylinderGeometry(r, r * 0.92, 3, 40), this.P.side, { pos: [x, y - 1.5 - 0.1, z] }));
    g.add(part(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.2, 40), top === "temple" ? "temple" : top, { pos: [x, y - 0.1, z] }));
    // 바닥 무늬 (빛나는 룬 고리)
    g.add(part(new THREE.TorusGeometry(r * 0.55, 0.06, 6, 60), "rune", { pos: [x, y + 0.01, z], rot: [Math.PI / 2, 0, 0] }));
    // 둘레 벽 (낮은 돌담) + 기둥
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const px = x + Math.cos(a) * (r + 0.4);
      const pz = z + Math.sin(a) * (r + 0.4);
      const seg = new THREE.BoxGeometry(0.8, 1.2, (TAU * (r + 0.4)) / n + 0.1);
      g.add(part(seg, this.P.side === "ice" ? "ice" : "stone", { pos: [px, y + 0.6, pz], rot: [0, -a, 0] }));
      if (i % 4 === 0) {
        const t = new THREE.Group();
        pillar(t, 0, 0, 4.2, 0.45, { broken: i % 8 === 4, rnd: this.rnd });
        t.position.set(x + Math.cos(a) * (r + 1.6), y, z + Math.sin(a) * (r + 1.6));
        retag(t, "stone", this.T.id === "master" ? "templewall" : "stone");
        g.add(t);
      }
    }
    // 충돌: 둘레는 진짜 원 벽 (틈 없이 · 밖으로 떨어지지 않게)
    this.addSolid({ type: "ring", cx: x, cz: z, rad: r - 0.1, x0: x - r - 1, x1: x + r + 1, z0: z - r - 1, z1: z + r + 1, y0: y - 1, y1: y + 6, rail: true });
    this.addSolid({ type: "disc", cx: x, cz: z, rad: r, x0: x - r, x1: x + r, z0: z - r, z1: z + r, y0: y - 3, y1: y, mat: top });
    this.arena = { c: V(x, y, z), r, entry: pc.entry ? V(...pc.entry) : null, bossKind: pc.boss };
  }
  b_water(pc) {
    this.waterKind = pc.kind;
    this.waterY = pc.y;
  }

  /* ---------------- 수정 (인스턴스) ---------------- */
  buildCrystals() {
    const n = this.crystals.length;
    if (!n) return;
    const geo = new THREE.OctahedronGeometry(0.26, 0);
    geo.scale(0.8, 1.25, 0.8);
    const cc = GEM_COLOR[this.T.id] || "#36c8ff";
    this.gemColor = cc;
    const mat = new THREE.MeshStandardMaterial({ color: cc, emissive: cc, emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.25, flatShading: true });
    this.crMesh = new THREE.InstancedMesh(geo, mat, n);
    this.crMesh.castShadow = true;
    this.crMesh.frustumCulled = false;
    this.root.add(this.crMesh);
    this.crystals.forEach((c, i) => (c.idx = i));
    // 큰 수정 반짝이 (스프라이트)
    for (const c of this.crystals) {
      if (!c.big) continue;
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: cc, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      h.scale.setScalar(2.2);
      h.position.copy(c.p);
      this.root.add(h);
      c.halo = h;
    }
    this.updateCrystals(0);
  }
  updateCrystals(t) {
    if (!this.crMesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (const c of this.crystals) {
      if (c.taken) {
        s.setScalar(0);
      } else s.setScalar(c.big ? 2.3 : 1);
      p.copy(c.p);
      p.y += Math.sin(t * 2.5 + c.idx) * 0.12;
      q.setFromEuler(e.set(0, t * 2 + c.idx, 0));
      m.compose(p, q, s);
      this.crMesh.setMatrixAt(c.idx, m);
    }
    this.crMesh.instanceMatrix.needsUpdate = true;
  }

  /** 아래: 물 · 용암 · 깊은 숲 바닥 (주인공을 따라 움직이는 큰 판) */
  buildUnder() {
    const kind = this.data.under || "valley";
    let mat;
    if (kind === "water") {
      const t = waterTex();
      mat = new THREE.MeshStandardMaterial({ color: "#5ac0e0", map: t, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 });
      this.underTex = t;
    } else if (kind === "lava") {
      const t = lavaCrackTex().clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(10, 10);
      mat = new THREE.MeshStandardMaterial({ color: "#3a1a10", emissive: "#ff5a10", emissiveMap: t, emissiveIntensity: 1.6, roughness: 0.6 });
      this.underTex = t;
    } else if (kind === "abyss") {
      mat = new THREE.MeshBasicMaterial({ color: this.T.fog });
    } else if (kind === "icewater") {
      mat = new THREE.MeshStandardMaterial({ color: "#7ab8d8", roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 });
    } else {
      const t = grassTex({ id: this.T.id + "under", grass: "#3a6a34" }).clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(30, 30);
      mat = new THREE.MeshStandardMaterial({ color: "#ffffff", map: t, roughness: 1 });
    }
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = this.data.underY != null ? this.data.underY : this.killY - 6;
    plane.receiveShadow = kind === "valley";
    this.root.add(plane);
    this.under = plane;
  }

  /* ================================================================
   * 충돌 세계
   * ============================================================== */
  /** 이 지점의 윗면 높이 (경사로 · 원판 포함) */
  topAt(s, x, z) {
    if (s.type === "ramp") {
      const t = s.axis === "z" ? (z - s.start) / (s.end - s.start) : (x - s.start) / (s.end - s.start);
      return s.h0 + (s.h1 - s.h0) * clamp(t, 0, 1);
    }
    return s.y1;
  }
  /** 발밑 땅: (x,z) 에서 maxTop 이하인 가장 높은 윗면 */
  ground(x, z, r, maxTop) {
    let best = -Infinity;
    let bs = null;
    const e = r * 0.5;
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
  /** 벽에서 밀어내기 (원 ↔ 상자). 반환: 부딪힌 상자 목록 */
  walls(pos, r, feetY, height, step, hits = null) {
    for (const s of this.solids) {
      if (!s.active || s.type === "disc") continue;
      if (s.type === "ring") {
        // 원 안에 가두기
        if (feetY > s.y1 || feetY + height < s.y0) continue;
        const dx = pos.x - s.cx;
        const dz = pos.z - s.cz;
        const d = Math.hypot(dx, dz);
        const lim = s.rad - r;
        if (d > lim && d < s.rad + 3) {
          pos.x = s.cx + (dx / d) * lim;
          pos.z = s.cz + (dz / d) * lim;
          if (hits) hits.push(s);
        }
        continue;
      }
      if (s.y0 >= feetY + height) continue;
      if (pos.x < s.x0 - r || pos.x > s.x1 + r || pos.z < s.z0 - r || pos.z > s.z1 + r) continue;
      const top = this.topAt(s, clamp(pos.x, s.x0, s.x1), clamp(pos.z, s.z0, s.z1));
      if (top <= feetY + step) continue;
      const cx = clamp(pos.x, s.x0, s.x1);
      const cz = clamp(pos.z, s.z0, s.z1);
      let dx = pos.x - cx;
      let dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x += (dx / d) * (r - d);
        pos.z += (dz / d) * (r - d);
      } else {
        // 상자 안에 들어와 있으면 가장 가까운 면으로
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
      if (hits) hits.push(s);
    }
  }
  /** 머리 위 천장 (점프하다 부딪힘) */
  ceiling(x, z, r, headY, newHeadY) {
    let low = Infinity;
    const e = r * 0.4;
    for (const s of this.solids) {
      if (!s.active || s.rail || s.type !== "box") continue;
      if (x < s.x0 + e || x > s.x1 - e || z < s.z0 + e || z > s.z1 - e) continue;
      if (s.y0 >= headY - 0.01 && s.y0 <= newHeadY) low = Math.min(low, s.y0);
    }
    return low === Infinity ? null : low;
  }
  /** 광선 ↔ 상자 (카메라가 벽에 파묻히지 않게) → 처음 닿는 거리 */
  ray(o, dir, maxD) {
    let best = maxD;
    for (const s of this.solids) {
      if (!s.active || s.rail || s.type === "ring") continue;
      // 경사로 · 원판은 감싸는 상자로
      let tmin = 0;
      let tmax = best;
      let ok = true;
      for (const [oo, dd, a, b] of [
        [o.x, dir.x, s.x0, s.x1],
        [o.y, dir.y, s.y0, s.y1],
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
      if (ok && tmin < best && tmin > 0.05) best = tmin;
    }
    return best;
  }
  /** 길 위 진행률 (0~1) + 그 지점의 앞 방향 */
  progress(pos, out = {}) {
    let best = 0;
    let bd = Infinity;
    let bu = 0;
    for (let i = 0; i < this.path.length - 1; i++) {
      const a = this.path[i];
      const b = this.path[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const L2 = abx * abx + abz * abz || 1;
      const u = clamp(((pos.x - a.x) * abx + (pos.z - a.z) * abz) / L2, 0, 1);
      const px = a.x + abx * u;
      const pz = a.z + abz * u;
      const d = (pos.x - px) ** 2 + (pos.z - pz) ** 2 + ((pos.y - (a.y + (b.y - a.y) * u)) * 0.5) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
        bu = u;
      }
    }
    const a = this.path[best];
    const b = this.path[Math.min(this.path.length - 1, best + 1)];
    const total = this.pathLen[this.pathLen.length - 1] || 1;
    const along = this.pathLen[best] + (this.pathLen[best + 1] - this.pathLen[best] || 0) * bu;
    out.k = along / total;
    out.seg = best;
    out.dx = b.x - a.x;
    out.dz = b.z - a.z;
    const l = Math.hypot(out.dx, out.dz) || 1;
    out.dx /= l;
    out.dz /= l;
    // 앞쪽 몇 m 의 방향 (커브 미리 보기)
    const ahead = Math.min(this.path.length - 1, best + 2);
    const c = this.path[ahead];
    out.ax = c.x - pos.x;
    out.az = c.z - pos.z;
    return out;
  }

  /* ================================================================
   * 매 프레임: 움직이는 것들 · 위험 · 수집 → 일어난 일(events)
   * ============================================================== */
  update(dt, P) {
    this.t += dt;
    const t = this.t;
    const ev = [];
    // 움직이는 발판 (밟고 있으면 같이 움직인다)
    for (const o of this.dyn) {
      if (o.kind === "mover") {
        o.prev.copy(o.pos);
        this.placeMover(o, t);
        o.solid.dx = o.pos.x - o.prev.x;
        o.solid.dy = o.pos.y - o.prev.y;
        o.solid.dz = o.pos.z - o.prev.z;
      } else if (o.kind === "crumble") {
        if (o.state === "idle") {
          if (P && P.groundSolid === o.solid) {
            o.state = "shake";
            o.t = 0;
            ev.push({ type: "crumble", p: o.home });
          }
        } else if (o.state === "shake") {
          o.t += dt;
          o.mesh.position.set(o.home.x + Math.sin(t * 60) * 0.05, o.home.y, o.home.z + Math.cos(t * 53) * 0.04);
          if (o.t > 0.75) {
            o.state = "fall";
            o.t = 0;
            o.solid.active = false;
            this.fx.puff(o.home.x, o.home.y - 0.3, o.home.z, 1.2, 3);
          }
        } else if (o.state === "fall") {
          o.t += dt;
          o.mesh.position.y = o.home.y - 0.5 * 14 * o.t * o.t;
          o.mesh.rotation.x = o.t * 0.8;
          if (o.t > 1.1) {
            o.state = "gone";
            o.t = 0;
            o.mesh.visible = false;
          }
        } else if (o.state === "gone") {
          o.t += dt;
          if (o.t > 2.2 && !(P && Math.abs(P.pos.x - o.home.x) < 1.6 && Math.abs(P.pos.z - o.home.z) < 1.6)) {
            o.state = "idle";
            o.mesh.visible = true;
            o.mesh.position.copy(o.home);
            o.mesh.rotation.set(0, 0, 0);
            o.solid.active = true;
            this.fx.sparkle(o.home.clone().setY(o.home.y + 0.3), 10);
          }
        }
      } else if (o.kind === "sway") {
        const s = Math.sin(t * 2.2 + o.t0);
        for (const pl of o.planks) {
          const k = Math.sin(pl.u * Math.PI);
          pl.m.position.y = pl.base + s * o.amp * k;
          pl.m.rotation.z = s * 0.04 * k;
        }
        // 충돌은 가운데 높이만 살짝 (밟은 느낌)
        const prev = o.solid.y1;
        o.solid.y1 = o.y + s * o.amp * 0.6;
        o.solid.y0 = o.solid.y1 - 0.3;
        o.solid.dy = o.solid.y1 - prev;
      } else if (o.kind === "falls") {
        o.tex.offset.y += dt * o.speed;
        o.mist.material.opacity = 0.42 + Math.sin(t * 5) * 0.1;
      }
    }
    // 문 열림
    for (const g of Object.values(this.gates)) {
      if (g.open && g.t < 1) {
        g.t = Math.min(1, g.t + dt * 0.9);
        g.grp.position.y = -2.7 * g.t;
        if (g.t >= 1) g.grp.visible = false;
      }
    }
    // 위험
    for (const h of this.hazards) this.updateHazard(h, dt, t, P, ev);
    // 물 · 용암 흐름
    if (this.underTex) this.underTex.offset.x += dt * (this.data.under === "lava" ? 0.01 : 0.02);
    if (this.under && P) {
      this.under.position.x = P.pos.x;
      this.under.position.z = P.pos.z;
      if (this.underTex) {
        // 판이 따라가도 무늬는 제자리에 있게
        const rep = this.underTex.repeat.x;
        this.underTex.offset.set((P.pos.x / 300) * rep, (-P.pos.z / 300) * rep);
      }
    }
    // 수정
    this.updateCrystals(t);
    for (const c of this.crystals) if (c.halo) c.halo.visible = !c.taken;
    if (P) {
      const cx = P.pos.x;
      const cy = P.pos.y + 0.55;
      const cz = P.pos.z;
      for (const c of this.crystals) {
        if (c.taken) continue;
        const r = c.big ? 1.2 : 0.85;
        if ((c.p.x - cx) ** 2 + (c.p.y - cy) ** 2 * 0.6 + (c.p.z - cz) ** 2 < r * r) {
          c.taken = true;
          ev.push({ type: "crystal", c });
        }
      }
      for (const hh of this.hearts) {
        if (hh.taken) continue;
        hh.mesh.rotation.y = t * 2;
        hh.mesh.position.y = hh.p.y + Math.sin(t * 3) * 0.1;
        if (hh.p.distanceTo(P.pos.clone().setY(P.pos.y + 0.6)) < 1.0) {
          hh.taken = true;
          hh.mesh.visible = false;
          ev.push({ type: "heart", p: hh.p });
        }
      }
      // 체크포인트
      for (const cp of this.checkpoints) {
        cp.flag.rotation.y = Math.sin(t * 3 + cp.idx) * 0.25;
        if (!cp.active && Math.hypot(cp.p.x - P.pos.x, cp.p.z - P.pos.z) < 1.6 && Math.abs(cp.p.y - P.pos.y) < 2) {
          cp.active = true;
          cp.runeM.emissive.set(this.P.accent);
          cp.runeM.emissiveIntensity = 1.4;
          cp.flagM.color.set("#ff5a5a");
          ev.push({ type: "checkpoint", cp });
        }
      }
      // 연습 구역
      for (const tz of this.tuts) {
        if (tz.done) continue;
        if (P.pos.x > tz.x0 && P.pos.x < tz.x1 && P.pos.z > tz.z0 && P.pos.z < tz.z1) {
          tz.done = true;
          ev.push({ type: "tut", step: tz.step });
        }
      }
      // 결승
      if (this.goal && !this.goal.reached && this.goal.p.distanceTo(P.pos) < this.goal.r + 0.6) {
        this.goal.reached = true;
        ev.push({ type: "goal", boss: this.goal.boss });
      }
      if (this.goal) this.goal.portalM.opacity = 0.4 + Math.sin(t * 3) * 0.15;
    }
    for (const s of this.switches) {
      if (!s.on) s.orb.rotation.y += dt;
      s.halo.material.opacity = 0.45 + Math.sin(t * 4) * 0.2;
    }
    return ev;
  }

  updateHazard(h, dt, t, P, ev) {
    if (h.kind === "jet") {
      const k = (((t / h.period + h.phase) % 1) + 1) % 1;
      const st = k < 0.45 ? "rest" : k < 0.72 ? "warn" : "active";
      if (st !== h.state) {
        h.state = st;
        if (st === "warn") ev.push({ type: "warn", sub: h.sub, p: h.p });
        if (st === "active") ev.push({ type: "jetFire", sub: h.sub, p: h.p });
      }
      h.glowM.opacity = st === "warn" ? 0.35 + Math.sin(t * 22) * 0.25 : st === "active" ? 0.7 : 0;
      h.col.visible = st === "active";
      if (st === "active") {
        const life = (k - 0.72) / 0.28;
        h.col.scale.set(1 + Math.sin(t * 30) * 0.06, Math.min(1, life * 6), 1 + Math.cos(t * 27) * 0.06);
        h.col.position.y = (h.h * Math.min(1, life * 6)) / 2;
        if (Math.random() < 0.5) this.fx.trail(h.p.clone().setY(h.p.y + Math.random() * h.h), h.sub === "fire" ? "#ffb04a" : "#ffffff");
      } else if (st === "warn" && Math.random() < 0.3) this.fx.trail(h.p.clone().setY(h.p.y + 0.3), h.sub === "fire" ? "#ff7a3a" : "#e0faff");
      h.hurting = st === "active" && (k - 0.72) / 0.28 > 0.08;
      if (h.hurting && P) {
        if (Math.hypot(P.pos.x - h.p.x, P.pos.z - h.p.z) < h.r + 0.25 && P.pos.y < h.p.y + h.h && P.pos.y + 0.9 > h.p.y) ev.push({ type: "hurt", src: h, from: h.p });
      }
    } else if (h.kind === "boulder") {
      h.t += dt;
      const cyc = h.dur + h.pause;
      const k = ((h.t % cyc) + cyc) % cyc;
      if (k < h.pause) {
        h.mesh.visible = false;
        h.active = false;
        if (k > h.pause - 0.7 && !h.warned) {
          h.warned = true;
          this.fx.puff(h.A.x, h.A.y, h.A.z, 1.2, 4);
          ev.push({ type: "warn", sub: "boulder", p: h.A });
        }
      } else {
        h.warned = false;
        h.mesh.visible = true;
        h.active = true;
        const u = (k - h.pause) / h.dur;
        h.p.lerpVectors(h.A, h.B, u);
        h.mesh.position.set(h.p.x, h.p.y + h.r, h.p.z);
        const dir = new THREE.Vector3().subVectors(h.B, h.A).normalize();
        const axis = new THREE.Vector3(dir.z, 0, -dir.x);
        h.mesh.rotateOnWorldAxis(axis, ((h.len / h.dur) * dt) / h.r);
        if (P && h.mesh.position.distanceTo(P.pos.clone().setY(P.pos.y + 0.5)) < h.r + 0.45) ev.push({ type: "hurt", src: h, from: h.mesh.position.clone() });
      }
    } else if (h.kind === "drop") {
      const k = (((t / h.period + h.phase) % 1) + 1) % 1;
      // 0~0.5 쉼 · 0.5~0.78 예고(바닥 표시 커짐) · 0.78~0.86 떨어짐 · 0.86~1 바닥에 놓였다 사라짐
      const st = k < 0.5 ? "rest" : k < 0.78 ? "warn" : k < 0.86 ? "fall" : "lie";
      if (st !== h.state) {
        if (st === "warn") ev.push({ type: "warn", sub: "drop", p: h.p });
        if (st === "lie") {
          this.fx.puff(h.p.x, h.p.y, h.p.z, 1.3, 5);
          ev.push({ type: "thud", p: h.p });
        }
        if (st === "rest") h.hitDone = false;
        h.state = st;
      }
      const wk = st === "warn" ? (k - 0.5) / 0.28 : 0;
      h.ring.material.opacity = st === "warn" ? 0.5 + Math.sin(t * 20) * 0.3 : st === "fall" ? 0.8 : 0;
      h.ring.scale.setScalar(st === "warn" ? 0.4 + wk * (h.r / 1) * 0.8 : h.r);
      h.shade.material.opacity = st === "warn" ? wk * 0.35 : st === "fall" ? 0.4 : 0;
      h.shade.scale.setScalar(h.r * (0.4 + wk * 0.6));
      if (st === "fall" || st === "lie") {
        h.mesh.visible = true;
        const fk = st === "fall" ? (k - 0.78) / 0.08 : 1;
        h.mesh.position.set(h.p.x, h.p.y + (h.sub === "icicle" ? 1.1 : 0.45) + (1 - fk) * 9, h.p.z);
        if (h.sub === "log") h.mesh.rotation.y = 0.4;
        h.mesh.material.transparent = st === "lie";
        h.mesh.material.opacity = st === "lie" ? Math.max(0, 1 - (k - 0.86) / 0.14) : 1;
        // 닿는 순간만 아프다
        if (!h.hitDone && fk > 0.75 && P) {
          if (Math.hypot(P.pos.x - h.p.x, P.pos.z - h.p.z) < h.r && P.pos.y < h.p.y + 1.8) {
            h.hitDone = true;
            ev.push({ type: "hurt", src: h, from: h.p });
          }
        }
      } else h.mesh.visible = false;
    } else if (h.kind === "wind") {
      const k = (((t / h.period + h.phase) % 1) + 1) % 1;
      const st = k < 0.45 ? "calm" : k < 0.6 ? "warn" : k < 0.92 ? "gust" : "calm";
      if (st !== h.state) {
        if (st === "warn") ev.push({ type: "warn", sub: "wind", p: V((h.x0 + h.x1) / 2, h.y, (h.z0 + h.z1) / 2) });
        h.state = st;
      }
      h.mat.opacity = st === "warn" ? 0.25 : st === "gust" ? 0.6 : 0;
      if (st !== "calm") {
        const sp = st === "gust" ? 14 : 5;
        for (const s of h.streaks) {
          s.position.x += h.dir.x * sp * dt;
          s.position.z += h.dir.y * sp * dt;
          if (s.position.x > h.x1 + 1) s.position.x = h.x0 - 1;
          if (s.position.x < h.x0 - 1) s.position.x = h.x1 + 1;
          if (s.position.z > h.z1 + 1) s.position.z = h.z0 - 1;
          if (s.position.z < h.z0 - 1) s.position.z = h.z1 + 1;
        }
      }
      h.active = st === "gust";
    }
  }
  /** 바람에 밀리는 힘 (주인공 위치에서) */
  windAt(pos) {
    let fx = 0;
    let fz = 0;
    for (const h of this.hazards) {
      if (h.kind !== "wind" || !h.active) continue;
      if (pos.x > h.x0 && pos.x < h.x1 && pos.z > h.z0 && pos.z < h.z1 && pos.y < h.y + 4) {
        fx += h.dir.x * h.force;
        fz += h.dir.y * h.force;
      }
    }
    return { x: fx, z: fz };
  }

  /* ---------------- 방망이에 맞은 것들 ---------------- */
  /** 부술 수 있는 것 · 스위치를 방망이로 쳤는지 (앞쪽 부채꼴) */
  hitTest(origin, fwd, reach) {
    const out = [];
    for (const b of this.breakables) {
      if (b.broken) continue;
      let px = b.p.x;
      let pz = b.p.z;
      if (b.wide) {
        px = clamp(origin.x, b.box.x0, b.box.x1);
        pz = clamp(origin.z, b.box.z0, b.box.z1);
      }
      if (inCone(origin, fwd, px, b.p.y, pz, reach + (b.wide ? 0.3 : b.r * 0.6))) out.push({ kind: "break", b });
    }
    for (const s of this.switches) {
      if (s.on) continue;
      if (inCone(origin, fwd, s.p.x, s.p.y - 0.4, s.p.z, reach + 0.4)) out.push({ kind: "switch", s });
    }
    return out;
  }
  breakIt(b) {
    b.broken = true;
    b.solid.active = false;
    b.mesh.visible = false;
    this.fx.splinter(b.p, b.wide ? 1.6 : 1, b.color);
  }
  pressSwitch(s) {
    s.on = true;
    s.orbM.color.set("#7aff9a");
    s.orbM.emissive.set("#3aff6a");
    s.halo.material.color.set("#7aff9a");
    const g = this.gates[s.gate];
    if (g) {
      g.open = true;
      g.solid.active = false;
      g.lock.material.color.set("#7aff9a");
    }
    return g;
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          if (m.map && m.map.userData && m.map.userData.own) m.map.dispose();
          if (m.emissiveMap && m.emissiveMap.userData && m.emissiveMap.userData.own) m.emissiveMap.dispose();
          m.dispose();
        }
      }
    });
    for (const m of Object.values(this.M)) m.dispose();
  }
}

/* ================================================================
 * 도우미
 * ============================================================== */
function inCone(o, fwd, x, y, z, reach) {
  const dx = x - o.x;
  const dz = z - o.z;
  const d = Math.hypot(dx, dz);
  if (d > reach) return false;
  if (Math.abs(y - (o.y + 0.5)) > 1.6) return false;
  if (d < 0.6) return true;
  const dot = (dx * fwd.x + dz * fwd.z) / d;
  return dot > 0.35; // 앞쪽 약 140°
}
/** 수집 수정 색: 지역 배경과 반대 느낌으로 또렷하게 */
const GEM_COLOR = { jungle: "#2fb8ff", falls: "#ff5ab4", crystal: "#ffcf3a", volcano: "#3ae0ff", ice: "#ff5ab4", master: "#2fb8ff" };
function pcKind(id) {
  return id === "crystal" ? "crystal" : id === "volcano" ? "lava" : id === "ice" ? "ice" : id === "master" ? "temple" : "bush";
}
function retag(g, from, to) {
  g.traverse((o) => {
    if (o.isMesh && o.userData.mat === from) o.userData.mat = to;
  });
}
function rockAt(g, x, y, z, s, r, mat = "rock") {
  const t = new THREE.Group();
  rock(t, 0, 0, s, r, mat);
  t.position.set(x, y - s * 0.12, z);
  g.add(t);
}
function bushAt(g, x, y, z, s, r, T) {
  const t = new THREE.Group();
  bush(t, 0, 0, s, r, T);
  t.position.set(x, y, z);
  g.add(t);
}
function flowerAt(g, x, y, z, r, T, n = 4) {
  const t = new THREE.Group();
  flowers(t, 0, 0, r, T, n);
  t.position.set(x, y, z);
  t.scale.setScalar(0.8);
  g.add(t);
}
function grassTuft(g, x, y, z, r, T) {
  for (let i = 0; i < 5; i++) {
    const c = new THREE.ConeGeometry(0.04, 0.3 + r() * 0.25, 4);
    g.add(part(c, "leaf", { pos: [x + (r() - 0.5) * 0.3, y + 0.15, z + (r() - 0.5) * 0.3], rot: [(r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6], tint: T.leaf[i % T.leaf.length] }));
  }
}
function jungleTreeAt(g, x, y, z, s, r, T) {
  const t = new THREE.Group();
  jungleTree(t, 0, 0, s, r, T);
  t.position.set(x, y, z);
  g.add(t);
}
function pineAt(g, x, y, z, s, r, T) {
  const t = new THREE.Group();
  pineTree(t, 0, 0, s, r, T, true);
  t.position.set(x, y, z);
  g.add(t);
}
function crystalAt(g, x, y, z, s, r, mat) {
  const t = new THREE.Group();
  crystalCluster(t, 0, 0, s, r, mat);
  t.position.set(x, y, z);
  g.add(t);
}
function iceAt(g, x, y, z, s, r) {
  const t = new THREE.Group();
  iceSpike(t, 0, 0, s, r);
  t.position.set(x, y, z);
  g.add(t);
}
function deadTreeAt(g, x, y, z, r) {
  const pts = [V(0, 0, 0), V(0.3, 1.4, 0), V(-0.2, 2.6, 0.1)];
  g.add(part(taperTube(pts, (t) => 0.18 - t * 0.12, 8, 6, { capStart: false }), "trunk", { pos: [x, y, z], tint: 0.6 }));
  g.add(part(taperTube([V(0, 0, 0), V(0.5, 0.4, 0), V(0.9, 0.5, 0.1)], (t) => 0.07 - t * 0.05, 6, 5), "trunk", { pos: [x + 0.25, y + 1.6, z], tint: 0.6 }));
}
/** 멀리 보이는 계단 신전 */
function templeAt(g, x, y, z, s, rot, T) {
  const mat = T.id === "master" ? "templewall" : "stone";
  for (let i = 0; i < 5; i++) g.add(part(new THREE.BoxGeometry((10 - i * 1.8) * s, 1.4 * s, (10 - i * 1.8) * s), mat, { pos: [x, y + (0.7 + i * 1.4) * s, z], rot: [0, rot, 0], tint: 0.9 + i * 0.03 }));
  g.add(part(new THREE.BoxGeometry(2 * s, 2.2 * s, 2 * s), mat, { pos: [x, y + 8.1 * s, z], rot: [0, rot, 0] }));
  g.add(part(new THREE.OctahedronGeometry(0.6 * s, 0), T.id === "master" ? "gold" : "crystal", { pos: [x, y + 10 * s, z] }));
}
/** 길 옆 절벽 기둥 (아래 깊은 곳까지) — 위에 나무 */
function cliffAt(g, x, y, z, pc, r, L) {
  const w = pc.w || 6;
  const d = pc.d || 6;
  const h = pc.h || 14;
  const side = L.P.side === "ice" ? "ice" : L.P.side;
  g.add(part(new THREE.BoxGeometry(w, h, d), side, { pos: [x, y - h / 2, z], rot: [0, pc.rot || 0, 0] }));
  const topMat = L.P.top === "grass" ? "grass" : L.P.top;
  g.add(part(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), topMat, { pos: [x, y + 0.05, z], rot: [0, pc.rot || 0, 0] }));
  const kind = pcKind(L.T.id);
  for (let i = 0; i < (pc.trees ?? 2); i++) {
    const tx = x + (r() - 0.5) * w * 0.6;
    const tz = z + (r() - 0.5) * d * 0.6;
    if (kind === "bush") jungleTreeAt(g, tx, y, tz, 0.8 + r() * 0.5, r, L.T);
    else if (kind === "ice") pineAt(g, tx, y, tz, 0.9 + r() * 0.4, r, L.T);
    else if (kind === "crystal") crystalAt(g, tx, y, tz, 1 + r(), r, r() < 0.5 ? "crystal" : "crystal2");
    else if (kind === "lava") rockAt(g, tx, y, tz, 1 + r(), r, "basalt");
    else {
      g.add(part(new THREE.CylinderGeometry(0.35, 0.4, 3.4, 10), "templewall", { pos: [tx, y + 1.7, tz] }));
    }
  }
}
function volcanoAt(g, x, y, z, s) {
  g.add(part(new THREE.CylinderGeometry(6 * s, 22 * s, 26 * s, 14, 1, true), "basalt", { pos: [x, y + 13 * s, z] }));
  g.add(part(new THREE.CylinderGeometry(6.2 * s, 6.2 * s, 0.6 * s, 14), "lavarock", { pos: [x, y + 26 * s, z] }));
}
/** 고대 성의 거대한 드래곤 조각 (배경) */
function bigStatueAt(g, x, y, z, s, rot, T) {
  const mat = T.id === "master" ? "templewall" : "stone";
  const grp = new THREE.Group();
  grp.add(part(new THREE.BoxGeometry(5, 2, 5), mat, { pos: [0, 1, 0] }));
  grp.add(part(sph(1), mat, { pos: [0, 4.2, 0], scale: [2, 2.4, 2.4] }));
  grp.add(part(sph(1), mat, { pos: [0, 7, 1.2], scale: [1.4, 1.2, 1.8] }));
  for (const sd of [-1, 1]) {
    grp.add(part(new THREE.ConeGeometry(0.35, 2.2, 8), mat, { pos: [sd * 0.8, 8.4, 0.6], rot: [-0.5, 0, -sd * 0.3] }));
    const wing = new THREE.Shape();
    wing.moveTo(0, 0);
    wing.lineTo(4, 3);
    wing.lineTo(3.4, 0.6);
    wing.lineTo(4.2, -0.6);
    wing.lineTo(0, -1);
    grp.add(part(slab(wing, 0.3, 0.05), mat, { pos: [sd * 1.6, 5, -0.8], rot: [0, sd * 0.5, 0], scale: [sd, 1, 1] }));
  }
  grp.add(part(sph(1), "gold", { pos: [0, 7.3, 2.9], scale: 0.22 }));
  grp.position.set(x, y, z);
  grp.rotation.y = rot;
  grp.scale.setScalar(s);
  g.add(grp);
}
/* 작은 텍스처들 */
let _crack = null;
function crackTex() {
  if (_crack) return _crack;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.strokeStyle = "rgba(30,20,10,0.75)";
  x.lineWidth = 3;
  const r = seeded(9);
  for (let i = 0; i < 7; i++) {
    let px = 64;
    let py = 64;
    let a = (i / 7) * TAU + r();
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 6; k++) {
      a += (r() - 0.5) * 0.9;
      px += Math.cos(a) * 10;
      py += Math.sin(a) * 10;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  _crack = new THREE.CanvasTexture(c);
  return _crack;
}
const _loot = {};
function lootTex(kind) {
  if (_loot[kind]) return _loot[kind];
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  if (kind === "heart") {
    x.fillStyle = "#ff5a7a";
    x.beginPath();
    x.moveTo(32, 54);
    x.bezierCurveTo(4, 34, 10, 8, 32, 22);
    x.bezierCurveTo(54, 8, 60, 34, 32, 54);
    x.fill();
  } else {
    x.fillStyle = "#7ff0ff";
    x.beginPath();
    x.moveTo(32, 6);
    x.lineTo(50, 32);
    x.lineTo(32, 58);
    x.lineTo(14, 32);
    x.closePath();
    x.fill();
  }
  x.strokeStyle = "#3a2412";
  x.lineWidth = 4;
  x.stroke();
  _loot[kind] = new THREE.CanvasTexture(c);
  _loot[kind].colorSpace = THREE.SRGBColorSpace;
  return _loot[kind];
}
let _water = null;
function waterTex() {
  if (_water) return _water;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#9ad8f0";
  x.fillRect(0, 0, 128, 128);
  const r = seeded(11);
  for (let i = 0; i < 60; i++) {
    x.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.35})`;
    x.lineWidth = 1 + r() * 2;
    const px = r() * 128;
    const py = r() * 128;
    x.beginPath();
    x.arc(px, py, 4 + r() * 12, r() * 3, r() * 3 + 1.5);
    x.stroke();
  }
  _water = new THREE.CanvasTexture(c);
  _water.wrapS = _water.wrapT = THREE.RepeatWrapping;
  _water.repeat.set(30, 30);
  _water.colorSpace = THREE.SRGBColorSpace;
  return _water;
}
let _heart = null;
function heartGeo() {
  if (_heart) return _heart;
  const s = new THREE.Shape();
  s.moveTo(0, -0.9);
  s.bezierCurveTo(-1.6, 0.1, -0.9, 1.3, 0, 0.55);
  s.bezierCurveTo(0.9, 1.3, 1.6, 0.1, 0, -0.9);
  _heart = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 3 });
  _heart.translate(0, 0, -0.2);
  return _heart;
}
