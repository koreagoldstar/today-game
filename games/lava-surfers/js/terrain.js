/*
 * 용암 서핑 · 지형 모양 만들기 (보이는 것)
 *  트랙 모델(track.js)의 표면 높이를 그대로 써서 메시를 만든다 → 보이는 땅 = 부딪히는 땅
 *   - 경사면 (그릇 모양 · 점프대 포함 · 틈 · 바닥 구멍은 비움) : 스테이지 테마 바닥 + 구간별 바닥(돌다리 · 쇠판 · 현무암 · 뼈)
 *   - 가장자리: 벽이 있는 곳은 솟은 바위벽(테마 높이), 없는 곳은 용암까지 떨어지는 절벽, 돌다리는 얇은 다리 몸통
 *   - 틈 · 바닥 구멍의 낭떠러지 면 · 길을 나누는 현무암 기둥 벽 · 터널 천장
 *   - 아래 골짜기를 채운 용암 (흐름)
 *   - 꾸밈: 테마별 (바위 · 흑요석 기둥 · 떠 있는 바위 · 용암 폭포 · 메사 · 현무암 기둥 · 수정 · 뼈 · 파이프 …)
 *  80m 구역으로 나눠 화면 밖은 그리지 않는다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { fbm3, shadeVerts, roundedBox, mergeByMaterial } from "./geo.js?v=2";
import { groundTex, cliffTex, lavaTex, dotTex, puffTex, chevronTex, signTex, bannerTex, seeded } from "./tex.js?v=2";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const CHUNK = 80;
const STYLE_GROUND = { bridge: "slabs", metal: "plates", hex: "hex", bone: "bone", ash: "ashfield", red: "redrock", obsidian: "obsidian", scorched: "scorched" };

export class Terrain {
  constructor(track, scene, { quality = 1, theme } = {}) {
    this.track = track;
    this.scene = scene;
    this.q = quality;
    this.th = theme;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.anim = [];
    this.groundMats = new Map();
    this.ownTex = [];
    const lavaMap = lavaTex().clone();
    lavaMap.needsUpdate = true;
    const chevMap = chevronTex().clone();
    chevMap.needsUpdate = true;
    this.ownTex.push(lavaMap, chevMap);
    this.mats = {
      cliff: new THREE.MeshStandardMaterial({ map: cliffTex(), color: theme.cliff, roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }),
      lava: new THREE.MeshBasicMaterial({ map: lavaMap, color: theme.lava }),
      obsidian: new THREE.MeshStandardMaterial({ color: "#2a2230", roughness: 0.18, metalness: 0.35, vertexColors: true, flatShading: true }),
      rock: new THREE.MeshStandardMaterial({ map: cliffTex(), color: theme.cliff, roughness: 0.95, vertexColors: true }),
      edge: new THREE.MeshStandardMaterial({ color: "#3a3038", roughness: 0.4, metalness: 0.5 }),
      chevron: new THREE.MeshBasicMaterial({ map: chevMap, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      stone: new THREE.MeshStandardMaterial({ color: "#5a4a50", roughness: 0.85, vertexColors: true }),
      banner: new THREE.MeshStandardMaterial({ map: bannerTex(), color: "#ffcf4a", roughness: 0.8, side: THREE.DoubleSide }),
      fire: new THREE.MeshBasicMaterial({ color: "#ffb04a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      cloth: new THREE.MeshStandardMaterial({ color: "#f4e6d0", roughness: 0.85, side: THREE.DoubleSide }),
      basalt: new THREE.MeshStandardMaterial({ color: "#4a4652", roughness: 0.7, metalness: 0.1, flatShading: true, vertexColors: true }),
      bone: new THREE.MeshStandardMaterial({ color: "#e8dcc4", roughness: 0.6, vertexColors: true }),
      crystal: new THREE.MeshStandardMaterial({ color: "#7ae8ff", emissive: "#2ab0ff", emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.2, flatShading: true }),
      crystal2: new THREE.MeshStandardMaterial({ color: "#d890ff", emissive: "#a040ff", emissiveIntensity: 1.1, roughness: 0.15, metalness: 0.2, flatShading: true }),
      metal: new THREE.MeshStandardMaterial({ color: "#6a6670", roughness: 0.45, metalness: 0.75, vertexColors: true }),
      pipeGlow: new THREE.MeshBasicMaterial({ color: "#ffb04a" }),
    };
    this.build();
  }
  groundMat(kind) {
    if (!this.groundMats.has(kind)) {
      const t = groundTex(kind);
      const metal = kind === "plates";
      this.groundMats.set(kind, new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.glow, emissive: "#ffffff", emissiveIntensity: kind === "bone" ? 1.0 : metal ? 0.55 : 0.85, roughness: metal ? 0.5 : 0.9, metalness: metal ? 0.45 : 0 }));
    }
    return this.groundMats.get(kind);
  }
  build() {
    const T = this.track;
    for (let s0 = -20; s0 < T.len; s0 += CHUNK) this.buildChunk(s0, Math.min(T.len, s0 + CHUNK));
    this.buildGapFaces();
    this.buildHoles();
    this.buildRamps();
    this.buildDividers();
    this.buildTunnels();
    this.buildDecor();
    this.buildCourseDecor();
    this.buildSigns();
  }

  /* ---------------- 구역 하나: 경사면 · 가장자리 · 용암 바닥 ---------------- */
  buildChunk(s0, s1) {
    const T = this.track;
    const f = {};
    const step = 1;
    const COLS = 18;
    const baseKind = this.th.ground;
    // 1) 경사면 (틈 구간 · 바닥 구멍은 건너뜀) — 구간별 바닥은 재질 묶음(group)으로
    const pos = [];
    const uv = [];
    const byKind = new Map();
    let prevRow = -1;
    let prevOk = false;
    let prevS = 0;
    const pushRow = (s) => {
      T.frame(s, f);
      const hw = T.halfWidth(s);
      const W = hw + 0.35;
      const base = pos.length / 3;
      for (let j = 0; j <= COLS; j++) {
        const u = -W + (2 * W * j) / COLS;
        const y = f.y + T.bowl(s, Math.max(-hw - 0.2, Math.min(hw + 0.2, u))) + T.rampAdd(s);
        pos.push(f.x + f.rx * u, y, f.z + f.rz * u);
        uv.push(u / 4.5, s / 4.5);
      }
      return { base, W };
    };
    for (let s = s0; s <= s1 + 0.001; s += step) {
      const ok = !T.inGap(s) && s >= 0;
      if (ok) {
        const row = pushRow(s);
        if (prevOk && prevRow >= 0) {
          const sm = (s + prevS) / 2;
          const st = T.styleAt(sm);
          const kind = (st && STYLE_GROUND[st]) || baseKind;
          if (!byKind.has(kind)) byKind.set(kind, []);
          const idx = byKind.get(kind);
          for (let j = 0; j < COLS; j++) {
            const um = -row.W + (2 * row.W * (j + 0.5)) / COLS;
            if (T.staticHoles.length && this.staticHole(sm, um)) continue;
            const a = prevRow + j;
            const c = row.base + j;
            idx.push(a, a + 1, c, a + 1, c + 1, c);
          }
        }
        prevRow = row.base;
        prevS = s;
      }
      prevOk = ok;
    }
    if (byKind.size) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      const all = [];
      const mats = [];
      for (const [kind, idx] of byKind) {
        if (!idx.length) continue;
        g.addGroup(all.length, idx.length, mats.length);
        mats.push(this.groundMat(kind));
        for (const v of idx) all.push(v);
      }
      if (all.length) {
        g.setIndex(all);
        g.computeVertexNormals();
        if (mats.length === 1) g.clearGroups();
        const m = new THREE.Mesh(g, mats.length === 1 ? mats[0] : mats);
        m.receiveShadow = true;
        this.root.add(m);
      }
    }
    // 2) 가장자리 (양쪽): 바위벽 · 용암까지 떨어지는 절벽 · 돌다리 몸통 (모두 점 6개)
    const wallH = this.th.wallH || 1;
    for (const side of [-1, 1]) {
      const P = [];
      const C = [];
      const I = [];
      const U = [];
      const prof = (s) => {
        T.frame(s, f);
        const hw = T.halfWidth(s);
        const surf = f.y + T.bowl(s, side * hw) + T.rampAdd(s);
        const lavaY = T.lavaY(s);
        const wall = T.wall(s, side);
        const st = T.styleAt(s);
        const n = (k) => fbm3(f.x * 0.15 + k, f.z * 0.15, s * 0.05 + side * 3, 3) - 0.5;
        if (st === "bridge" && !wall) {
          // 돌다리: 낮은 난간돌 + 두께 1.8m 몸통 (아래는 비어 용암이 보임)
          return [
            [hw + 0.3, surf - 0.05],
            [hw + 0.45, surf + 0.3],
            [hw + 0.7, surf + 0.3],
            [hw + 0.75, surf - 1.2],
            [hw * 0.55, surf - 1.8],
            [0, surf - 2.0],
          ];
        }
        if (wall) {
          const h = (1.5 + n(1) * 1.6) * wallH;
          if (wallH > 1.6) {
            return [
              [hw + 0.3, surf - 0.05],
              [hw + 0.6 + n(2) * 0.3, surf + h * 0.4],
              [hw + 1.0 + n(3) * 0.6, surf + h * 0.85],
              [hw + 2.6 + n(6), surf + h + n(4) * 1.5],
              [hw + 8, surf + h * 0.8 + n(5) * 3],
              [hw + 14, lavaY + 0.5],
            ];
          }
          return [
            [hw + 0.3, surf - 0.05],
            [hw + 0.75 + n(2) * 0.3, surf + h * 0.55],
            [hw + 1.5 + n(3) * 0.5, surf + h],
            [hw + 3.4, surf + h * 0.75 + n(4)],
            [hw + 7, surf - 2 + n(5) * 2],
            [hw + 12, lavaY + 0.5],
          ];
        }
        return [
          [hw + 0.3, surf - 0.05],
          [hw + 0.6, surf - 0.7 + n(2) * 0.3],
          [hw + 1.0 + n(3) * 0.4, surf - 3],
          [hw + 1.6 + n(4) * 0.6, lavaY + 3],
          [hw + 3.2, lavaY + 0.3],
          [hw + 8, lavaY - 0.4],
        ];
      };
      const rows = [];
      for (let s = s0; s <= s1 + 0.001; s += 2) {
        if (s < 0) continue;
        rows.push(s);
      }
      rows.forEach((s, r) => {
        const pr = prof(s);
        T.frame(s, f);
        for (const [k, [uu, y]] of pr.entries()) {
          const u = side * uu;
          P.push(f.x + f.rx * u, y, f.z + f.rz * u);
          U.push(k / 5, s / 9);
          const sh = 0.55 + 0.45 * Math.min(1, Math.max(0, (y - T.lavaY(s)) / 12));
          C.push(sh, sh * 0.92, sh * 0.9);
        }
        if (r > 0) {
          const a = (r - 1) * pr.length;
          const b = r * pr.length;
          for (let k = 0; k < pr.length - 1; k++) {
            if (side > 0) I.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
            else I.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
          }
        }
      });
      if (I.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
        g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
        g.setIndex(I);
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, this.mats.cliff);
        m.receiveShadow = true;
        m.castShadow = true;
        this.root.add(m);
      }
    }
    // 3) 용암 골짜기 바닥 (넓게)
    {
      const P = [];
      const U = [];
      const I = [];
      const cols = [-160, -70, -28, 0, 28, 70, 160];
      let r = 0;
      for (let s = s0; s <= s1 + 0.001; s += 8) {
        T.frame(s, f);
        const y = T.lavaY(s) - 0.5;
        for (const u of cols) {
          P.push(f.x + f.rx * u, y + (Math.abs(u) > 40 ? -2 : 0), f.z + f.rz * u);
          U.push((f.x + f.rx * u) / 18, (f.z + f.rz * u) / 18);
        }
        if (r > 0) {
          const a = (r - 1) * cols.length;
          const b = r * cols.length;
          for (let k = 0; k < cols.length - 1; k++) I.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
        }
        r++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      g.computeVertexNormals();
      this.root.add(new THREE.Mesh(g, this.mats.lava));
    }
  }
  staticHole(s, u) {
    for (const h of this.track.staticHoles) if (s > h.s0 && s < h.s1 && u > h.u0 && u < h.u1) return true;
    return false;
  }

  /* ---------------- 틈 앞뒤 낭떠러지 면 ---------------- */
  buildGapFaces() {
    const T = this.track;
    const f = {};
    for (const [g0, g1] of T.gaps) {
      for (const [s, dir] of [
        [g0, 1],
        [g1, -1],
      ]) {
        const P = [];
        const I = [];
        const C = [];
        const hw = T.halfWidth(s) + 0.35;
        const N = 12;
        T.frame(s, f);
        const bridge = T.styleAt(s - dir * 0.6) === "bridge" && !T.wall(s - dir * 0.6, 1);
        const top = (u) => f.y + T.bowl(s, Math.max(-hw, Math.min(hw, u))) + T.rampAdd(s - dir * 0.01);
        const bot = T.lavaY(s) - 1;
        for (let j = 0; j <= N; j++) {
          const u = -hw + (2 * hw * j) / N;
          const n = fbm3(u * 0.4, s * 0.1, 3, 3) - 0.5;
          const y0 = top(u);
          // 돌다리가 끊긴 곳: 깨진 몸통(두께 2m, 들쭉날쭉) · 땅: 용암까지 낭떠러지
          const yb = bridge ? y0 - 1.8 - Math.abs(n) * 1.4 : bot;
          for (let k = 0; k <= 4; k++) {
            const t = k / 4;
            const y = y0 + (yb - y0) * t;
            const back = bridge ? dir * (t * 0.4 + n * t * 0.8) : dir * (t * t * 2.5 + n * t * 1.5);
            P.push(f.x + f.rx * u - f.tx * back, y, f.z + f.rz * u - f.tz * back);
            const sh = 0.95 - t * 0.4;
            C.push(sh, sh * 0.9, sh * 0.88);
          }
        }
        for (let j = 0; j < N; j++) {
          for (let k = 0; k < 4; k++) {
            const a = j * 5 + k;
            const b = (j + 1) * 5 + k;
            if (dir > 0) I.push(a, b, a + 1, a + 1, b, b + 1);
            else I.push(a, a + 1, b, a + 1, b + 1, b);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
        g.setIndex(I);
        g.computeVertexNormals();
        const uvs = [];
        for (let i = 0; i < P.length / 3; i++) uvs.push(P[i * 3] / 6, P[i * 3 + 1] / 6);
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        const m = new THREE.Mesh(g, this.mats.cliff);
        m.castShadow = true;
        this.root.add(m);
      }
      // 틈 아래 용암에서 올라오는 빛
      T.frame((g0 + g1) / 2, f);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.set(f.x, T.lavaY((g0 + g1) / 2) + 2, f.z);
      glow.scale.setScalar(Math.min(60, (g1 - g0) * 2.2));
      this.root.add(glow);
    }
  }
  /* ---------------- 바닥 구멍: 네 벽 + 아래 용암 빛 ---------------- */
  buildHoles() {
    const T = this.track;
    if (!T.staticHoles.length) return;
    const f = {};
    const P = [];
    const C = [];
    const I = [];
    const quad = (a, b, c, d) => {
      const i = P.length / 3;
      for (const p of [a, b, c, d]) {
        P.push(p[0], p[1], p[2]);
        C.push(p[3], p[3] * 0.9, p[3] * 0.88);
      }
      I.push(i, i + 1, i + 2, i, i + 2, i + 3);
    };
    const pt = (s, u, top) => {
      T.frame(s, f);
      const y = top ? f.y + T.bowl(s, u) + T.rampAdd(s) - 0.02 : T.lavaY(s) - 0.5;
      return [f.x + f.rx * u, y, f.z + f.rz * u, top ? 0.9 : 0.45];
    };
    for (const h of T.staticHoles) {
      const hw = T.halfWidth((h.s0 + h.s1) / 2) + 0.35;
      const u0 = Math.max(h.u0, -hw);
      const u1 = Math.min(h.u1, hw);
      for (let s = h.s0; s < h.s1 - 0.01; s += 2) {
        const sb = Math.min(h.s1, s + 2);
        if (h.u0 > -hw) quad(pt(s, u0, true), pt(sb, u0, true), pt(sb, u0, false), pt(s, u0, false));
        if (h.u1 < hw) quad(pt(sb, u1, true), pt(s, u1, true), pt(s, u1, false), pt(sb, u1, false));
      }
      for (const [s, d] of [
        [h.s0, 1],
        [h.s1, -1],
      ]) {
        for (let u = u0; u < u1 - 0.01; u += 1.5) {
          const ub = Math.min(u1, u + 1.5);
          if (d > 0) quad(pt(s, ub, true), pt(s, u, true), pt(s, u, false), pt(s, ub, false));
          else quad(pt(s, u, true), pt(s, ub, true), pt(s, ub, false), pt(s, u, false));
        }
      }
      T.frame((h.s0 + h.s1) / 2, f);
      const um = (u0 + u1) / 2;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.set(f.x + f.rx * um, T.lavaY((h.s0 + h.s1) / 2) + 2.5, f.z + f.rz * um);
      glow.scale.setScalar(Math.min(30, Math.max(h.s1 - h.s0, u1 - u0) * 1.8));
      this.root.add(glow);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    g.setIndex(I);
    g.computeVertexNormals();
    const uvs = [];
    for (let i = 0; i < P.length / 3; i++) uvs.push((P[i * 3] + P[i * 3 + 2]) / 6, P[i * 3 + 1] / 6);
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    this.root.add(new THREE.Mesh(g, this.mats.cliff));
  }

  /* ---------------- 점프대: 빛나는 화살표 + 끝 모서리 ---------------- */
  buildRamps() {
    const T = this.track;
    const f = {};
    for (const [s0, s1] of T.ramps) {
      const hw = T.halfWidth(s1);
      const P = [];
      const U = [];
      const I = [];
      const n = Math.round((s1 - s0) / 0.5);
      for (let i = 0; i <= n; i++) {
        const s = s0 + ((s1 - s0) * i) / n;
        T.frame(s, f);
        for (const u of [-1.6, 1.6]) {
          P.push(f.x + f.rx * u, f.y + T.rampAdd(s) + 0.04, f.z + f.rz * u);
          U.push(u > 0 ? 1 : 0, (s - s0) / 3);
        }
        if (i > 0) {
          const a = (i - 1) * 2;
          I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      const m = new THREE.Mesh(g, this.mats.chevron);
      m.renderOrder = 2;
      this.root.add(m);
      T.frame(s1 - 0.15, f);
      const lip = new THREE.Mesh(roundedBox(hw * 2 + 0.6, 0.18, 0.3, 0.06), this.mats.edge);
      lip.position.set(f.x, f.y + T.rampAdd(s1 - 0.15) - 0.06, f.z);
      lip.rotation.y = Math.atan2(f.tx, f.tz);
      lip.castShadow = true;
      this.root.add(lip);
    }
  }

  /* ---------------- 길을 나누는 현무암 기둥 벽 ---------------- */
  buildDividers() {
    const T = this.track;
    if (!T.dividers.length) return;
    const f = {};
    const geo = new THREE.CylinderGeometry(0.34, 0.36, 1, 6);
    geo.translate(0, 0.5, 0);
    shadeVerts(geo, { bottom: 0.45, top: 1.15 });
    const cols = [];
    for (const d of T.dividers) {
      for (let s = d.s0; s <= d.s1; s += 0.62) {
        T.frame(s, f);
        const base = f.y + T.bowl(s, d.u) + T.rampAdd(s) - 0.3;
        // 앞 끝은 계단처럼 낮게 (보고 피할 수 있게)
        const ramp = Math.min(1, (s - d.s0) / 4 + 0.35);
        for (const du of [-0.32, 0.32]) {
          const n = fbm3(s * 0.4, du * 3 + d.u, 1.7, 2);
          cols.push([f.x + f.rx * (d.u + du), base, f.z + f.rz * (d.u + du), (d.h * 0.75 + n * d.h * 0.5) * ramp, s + du]);
        }
      }
    }
    const im = new THREE.InstancedMesh(geo, this.mats.basalt, cols.length);
    const o = new THREE.Object3D();
    cols.forEach(([x, y, z, h, r], i) => {
      o.position.set(x, y, z);
      o.rotation.set(0, r * 1.7, 0);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    this.root.add(im);
  }

  /* ---------------- 터널 천장 ---------------- */
  buildTunnels() {
    const T = this.track;
    const f = {};
    for (const [t0, t1, H] of T.tunnels) {
      const P = [];
      const C = [];
      const U = [];
      const I = [];
      const N = 14;
      let r = 0;
      for (let s = t0; s <= t1 + 0.01; s += 2) {
        T.frame(s, f);
        const hw = T.halfWidth(s) + 1.2;
        for (let j = 0; j <= N; j++) {
          const a = (j / N) * Math.PI;
          const n = fbm3(s * 0.12, j * 0.5, 4.2, 3) - 0.5;
          const u = Math.cos(a) * (hw + n * 1.2);
          const y = f.y + 1.2 + Math.sin(a) * (H - 1.2) + n * 1.4;
          P.push(f.x + f.rx * u, y, f.z + f.rz * u);
          U.push(j / 3, s / 6);
          const sh = 0.35 + Math.sin(a) * 0.25;
          C.push(sh, sh * 0.85, sh * 0.85);
        }
        if (r > 0) {
          const a = (r - 1) * (N + 1);
          const b = r * (N + 1);
          for (let j = 0; j < N; j++) I.push(a + j, b + j, a + j + 1, a + j + 1, b + j, b + j + 1);
        }
        r++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      g.computeVertexNormals();
      this.root.add(new THREE.Mesh(g, this.mats.cliff));
      // 천장의 빛나는 용암 줄기
      const vein = new THREE.MeshBasicMaterial({ color: "#ff7a2a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let k = 0; k < Math.floor((t1 - t0) / 22); k++) {
        const s = t0 + 10 + k * 22;
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const a = 0.35 + (j / 8) * 2.4;
          T.frame(s + Math.sin(j + k) * 2, f);
          const hw = T.halfWidth(s) + 1.0;
          const u = Math.cos(a) * hw;
          pts.push(V(f.x + f.rx * u, f.y + 1.2 + Math.sin(a) * (H - 1.4), f.z + f.rz * u));
        }
        this.root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.12, 4), vein));
      }
      // 입구 · 출구 바위 테두리
      for (const s of [t0, t1]) {
        T.frame(s, f);
        const R = T.halfWidth(s) + 1.6;
        const ring = new THREE.Mesh(shadeVerts(new THREE.TorusGeometry(R, 1.0, 6, 18, Math.PI), { bottom: 0.6 }), this.mats.rock);
        ring.position.set(f.x, f.y + 1.2, f.z);
        ring.rotation.y = Math.atan2(f.tx, f.tz);
        ring.scale.set(1, (H - 1.2) / R, 1);
        this.root.add(ring);
      }
    }
  }

  /* ---------------- 테마 꾸밈 ---------------- */
  buildDecor() {
    const T = this.track;
    const D = this.th.decor || {};
    const f = {};
    const rnd = seeded(77 + Math.round(T.len));
    const rockGeo = (() => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 1 + (fbm3(x * 1.5, y * 1.5, z * 1.5, 2) - 0.5) * 0.6;
        p.setXYZ(i, x * k, y * k * 0.75, z * k);
      }
      g.computeVertexNormals();
      shadeVerts(g, { bottom: 0.5 });
      return g;
    })();
    const spireGeo = (() => {
      const g = new THREE.ConeGeometry(0.5, 1, 6);
      g.translate(0, 0.5, 0);
      shadeVerts(g, { bottom: 0.6, top: 1.1 });
      return g;
    })();
    const o = new THREE.Object3D();
    const inst = (geo, mat, list, setter) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        setter(o, it);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      });
      im.castShadow = true;
      im.receiveShadow = true;
      this.root.add(im);
      return im;
    };
    const rocks = [];
    const spires = [];
    const kr = D.rocks ?? 1;
    const ks = D.spires ?? 1;
    const wallH = this.th.wallH || 1;
    for (let s = 0; s < T.len; s += 3.2) {
      const hw = T.halfWidth(s);
      for (const side of [-1, 1]) {
        const wall = T.wall(s, side);
        if (rnd() < 0.55 * kr) {
          const tallWall = wall && wallH > 1.6;
          const u = side * (hw + (wall ? (tallWall ? 4 + rnd() * 6 : 2.5 + rnd() * 3) : 4 + rnd() * 6));
          T.frame(s, f);
          const y = wall ? f.y + (tallWall ? wallH * 2.5 : 1.5) + rnd() * 2 : T.lavaY(s) + 0.5;
          rocks.push([f.x + f.rx * u, y, f.z + f.rz * u, 0.6 + rnd() * 1.6, rnd() * TAU]);
        }
        if (rnd() < 0.18 * ks) {
          const u = side * (hw + 6 + rnd() * 14);
          T.frame(s, f);
          spires.push([f.x + f.rx * u, T.lavaY(s) - 1, f.z + f.rz * u, 3 + rnd() * 12, rnd() * TAU]);
        }
      }
    }
    inst(rockGeo, this.mats.rock, rocks, (o, [x, y, z, s, r]) => {
      o.position.set(x, y, z);
      o.rotation.set(r * 0.3, r, 0);
      o.scale.set(s, s, s);
    });
    inst(spireGeo, this.mats.obsidian, spires, (o, [x, y, z, h, r]) => {
      o.position.set(x, y, z);
      o.rotation.set((r % 1) * 0.2 - 0.1, r, 0);
      o.scale.set(1 + h * 0.08, h, 1 + h * 0.08);
    });
    // 떠 있는 바위 (머리 위 · 옆) — 천천히 출렁
    const floats = [];
    const nf = Math.round((this.q >= 0.9 ? 36 : 20) * (D.floats ?? 1) * Math.min(2, T.len / 1500));
    for (let i = 0; i < nf; i++) {
      const s = 80 + rnd() * Math.max(10, T.len - 200);
      const side = rnd() < 0.5 ? -1 : 1;
      T.frame(s, f);
      const u = side * (T.halfWidth(s) + 8 + rnd() * 22);
      floats.push({ x: f.x + f.rx * u, y: f.y + 8 + rnd() * 18, z: f.z + f.rz * u, s: 1.5 + rnd() * 3.5, r: rnd() * TAU, ph: rnd() * TAU });
    }
    if (floats.length) {
      const fi = new THREE.InstancedMesh(rockGeo, this.mats.rock, floats.length);
      fi.castShadow = true;
      this.root.add(fi);
      this.anim.push((dt, t) => {
        floats.forEach((q, i) => {
          o.position.set(q.x, q.y + Math.sin(t * 0.6 + q.ph) * 0.8, q.z);
          o.rotation.set(0.3, q.r + t * 0.05, 0.2);
          o.scale.set(q.s, q.s * 1.3, q.s);
          o.updateMatrix();
          fi.setMatrixAt(i, o.matrix);
        });
        fi.instanceMatrix.needsUpdate = true;
      });
    }
    // 용암 폭포 (옆 절벽에서 골짜기로)
    const nFalls = Math.round(D.falls ?? 6);
    for (let i = 0; i < nFalls; i++) {
      const s = 120 + ((T.len - 240) * (i + 0.5)) / nFalls;
      const side = i % 2 ? 1 : -1;
      T.frame(s, f);
      const tall = wallH > 1.6;
      const u = side * (T.halfWidth(s) + (tall ? 6 : 9));
      const top = f.y + (tall ? wallH * 3 : 6);
      this.lavaFall(f.x + f.rx * u, top, f.z + f.rz * u, 3 + (i % 3), top - T.lavaY(s), Math.atan2(-f.rx * side, -f.rz * side));
    }
    // 메사 (협곡 바깥 큰 바위 탑)
    if (D.mesas) {
      const list = [];
      for (let s = 40; s < T.len; s += 26) {
        for (const side of [-1, 1]) {
          if (rnd() > 0.7 * D.mesas) continue;
          T.frame(s, f);
          const u = side * (T.halfWidth(s) + 18 + rnd() * 50);
          list.push([f.x + f.rx * u, T.lavaY(s) - 2, f.z + f.rz * u, 6 + rnd() * 10, 18 + rnd() * 45, rnd() * TAU]);
        }
      }
      const g = new THREE.CylinderGeometry(0.8, 1, 1, 9, 4);
      g.translate(0, 0.5, 0);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 1 + (fbm3(x * 2, y * 3, z * 2, 3) - 0.5) * 0.35;
        p.setXYZ(i, x * k, y, z * k);
      }
      g.computeVertexNormals();
      shadeVerts(g, { bottom: 0.55, top: 1.1 });
      inst(g, this.mats.rock, list, (o, [x, y, z, r, h, a]) => {
        o.position.set(x, y, z);
        o.rotation.set(0, a, 0);
        o.scale.set(r, h, r);
      });
    }
    // 용암 호수의 바위섬
    if (D.lakeRocks) {
      const list = [];
      for (let s = 0; s < T.len; s += 9) {
        for (const side of [-1, 1]) {
          if (rnd() > 0.5 * D.lakeRocks) continue;
          T.frame(s, f);
          const u = side * (T.halfWidth(s) + 10 + rnd() * 70);
          list.push([f.x + f.rx * u, T.lavaY(s) - 0.4, f.z + f.rz * u, 2 + rnd() * 6, rnd() * TAU]);
        }
      }
      inst(rockGeo, this.mats.obsidian, list, (o, [x, y, z, r, a]) => {
        o.position.set(x, y, z);
        o.rotation.set(0, a, 0);
        o.scale.set(r, r * 0.45, r * 0.8);
      });
    }
    // 현무암 기둥 무리 (바깥)
    if (D.columns) {
      const geo = new THREE.CylinderGeometry(0.9, 0.95, 1, 6);
      geo.translate(0, 0.5, 0);
      shadeVerts(geo, { bottom: 0.45, top: 1.2 });
      const list = [];
      for (let s = 0; s < T.len; s += 6) {
        for (const side of [-1, 1]) {
          if (rnd() > 0.55 * D.columns) continue;
          const cu = side * (T.halfWidth(s) + 5 + rnd() * 30);
          const ch = 4 + rnd() * 16;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * TAU + rnd();
            const u = cu + Math.cos(a) * 1.6;
            T.frame(s + Math.sin(a) * 1.6, f);
            list.push([f.x + f.rx * u, T.lavaY(s) - 1, f.z + f.rz * u, ch * (0.7 + rnd() * 0.5), a]);
          }
        }
      }
      inst(geo, this.mats.basalt, list, (o, [x, y, z, h, a]) => {
        o.position.set(x, y, z);
        o.rotation.set(0, a, 0);
        o.scale.set(1, h + 10, 1);
      });
    }
    // 빛나는 수정 무리
    if (D.crystals) {
      const geo = new THREE.OctahedronGeometry(1, 0);
      geo.scale(0.45, 1.6, 0.45);
      const a1 = [];
      const a2 = [];
      for (let s = 30; s < T.len; s += 7) {
        for (const side of [-1, 1]) {
          if (rnd() > 0.35 * D.crystals) continue;
          T.frame(s, f);
          const hw = T.halfWidth(s);
          const u = side * (hw + 1.6 + rnd() * 6);
          const y = T.wall(s, side) ? f.y + 0.6 + rnd() * 2 : T.lavaY(s) + 2 + rnd() * 3;
          const list = rnd() < 0.5 ? a1 : a2;
          for (let k = 0; k < 3; k++) list.push([f.x + f.rx * (u + (rnd() - 0.5) * 1.5), y, f.z + f.rz * (u + (rnd() - 0.5) * 1.5), 0.6 + rnd() * 1.3, rnd() * TAU, (rnd() - 0.5) * 0.8]);
        }
      }
      const set = (o, [x, y, z, sc, a, tilt]) => {
        o.position.set(x, y, z);
        o.rotation.set(tilt, a, tilt * 0.5);
        o.scale.setScalar(sc);
      };
      inst(geo, this.mats.crystal, a1, set);
      inst(geo, this.mats.crystal2, a2, set);
    }
    // 거대한 뼈 (바깥 갈비뼈)
    if (D.bones) {
      const g = new THREE.Group();
      for (let s = 50; s < T.len; s += 70 / D.bones) {
        const side = rnd() < 0.5 ? -1 : 1;
        T.frame(s, f);
        const u = side * (T.halfWidth(s) + 8 + rnd() * 20);
        const by = T.lavaY(s) - 1;
        const H = 10 + rnd() * 14;
        for (let k = 0; k < 4; k++) {
          T.frame(s + (k - 1.5) * 4.5, f);
          const bx = f.x + f.rx * u;
          const bz = f.z + f.rz * u;
          const pts = [];
          for (let j = 0; j <= 8; j++) {
            const t = j / 8;
            pts.push(V(bx - f.rx * side * Math.sin(t * 2.2) * H * 0.55, by + Math.sin(t * Math.PI * 0.8) * H, bz - f.rz * side * Math.sin(t * 2.2) * H * 0.55));
          }
          const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.55 - k * 0.04, 6);
          shadeVerts(tube, { bottom: 0.6 });
          g.add(new THREE.Mesh(tube, this.mats.bone));
        }
      }
      const merged = mergeByMaterial(g);
      merged.traverse((x) => x.isMesh && (x.castShadow = true));
      this.root.add(merged);
    }
    // 파이프 (마그마 발전소)
    if (D.pipes) {
      const g = new THREE.Group();
      for (const side of [-1, 1]) {
        for (let s0 = 20; s0 < T.len - 40; s0 += 160) {
          const pts = [];
          for (let s = s0; s <= Math.min(T.len - 10, s0 + 150); s += 6) {
            T.frame(s, f);
            const u = side * (T.halfWidth(s) + 2.6);
            pts.push(V(f.x + f.rx * u, f.y + 1.6 + (T.wall(s, side) ? 1.2 : 0), f.z + f.rz * u));
          }
          if (pts.length < 3) continue;
          const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, 0.55, 10);
          shadeVerts(tube, { bottom: 0.6 });
          g.add(new THREE.Mesh(tube, this.mats.metal));
          for (let k = 0; k < pts.length; k += 3) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.12, 6, 14), this.mats.pipeGlow);
            ring.position.copy(pts[k]);
            ring.lookAt(pts[Math.min(pts.length - 1, k + 1)]);
            g.add(ring);
          }
        }
      }
      this.root.add(mergeByMaterial(g));
    }
    // 굴뚝 + 연기
    if (D.chimneys) {
      const list = [];
      for (let s = 60; s < T.len; s += 90) {
        const side = rnd() < 0.5 ? -1 : 1;
        T.frame(s, f);
        const u = side * (T.halfWidth(s) + 20 + rnd() * 30);
        list.push([f.x + f.rx * u, T.lavaY(s) - 2, f.z + f.rz * u, 30 + rnd() * 30]);
      }
      const geo = new THREE.CylinderGeometry(2.2, 3.2, 1, 12, 1);
      geo.translate(0, 0.5, 0);
      shadeVerts(geo, { bottom: 0.5 });
      inst(geo, this.mats.metal, list, (o, [x, y, z, h]) => {
        o.position.set(x, y, z);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, h, 1);
      });
      const sm = new THREE.SpriteMaterial({ map: puffTex(), color: "#4a4248", transparent: true, opacity: 0.5, depthWrite: false });
      const puffs = [];
      for (const [x, y, z, h] of list) {
        for (let k = 0; k < 4; k++) {
          const sp = new THREE.Sprite(sm);
          sp.userData = { x, y: y + h, z, k: k / 4 };
          this.root.add(sp);
          puffs.push(sp);
        }
      }
      this.anim.push((dt, t) => {
        for (const sp of puffs) {
          const k = (sp.userData.k + t * 0.08) % 1;
          sp.position.set(sp.userData.x + k * 6, sp.userData.y + k * 22, sp.userData.z);
          sp.scale.setScalar(5 + k * 16);
        }
      });
    }
    // 빛나는 분기공
    if (D.vents) {
      const gm = new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
      for (let s = 40; s < T.len; s += 45) {
        const side = rnd() < 0.5 ? -1 : 1;
        T.frame(s, f);
        const u = side * (T.halfWidth(s) + 7 + rnd() * 12);
        const gl = new THREE.Sprite(gm);
        gl.position.set(f.x + f.rx * u, T.lavaY(s) + 1.5, f.z + f.rz * u);
        gl.scale.setScalar(9);
        this.root.add(gl);
      }
    }
    // 흐르는 용암 무늬 · 점프대 화살표
    const lt = this.mats.lava.map;
    this.anim.push((dt) => {
      lt.offset.x += dt * 0.01;
      lt.offset.y += dt * 0.025;
    });
    const ct = this.mats.chevron.map;
    this.anim.push((dt) => (ct.offset.y -= dt * 1.2));
  }
  /* ---------------- 코스가 정한 꾸밈 (갈비뼈 아치 · 다리 기둥 · 파이프 틀 · 용의 문) ---------------- */
  buildCourseDecor() {
    const T = this.track;
    const f = {};
    const g = new THREE.Group();
    for (const d of T.def.decor || []) {
      T.frame(d.s, f);
      const hw = T.halfWidth(d.s);
      const holder = new THREE.Group();
      holder.position.set(f.x, f.y, f.z);
      holder.rotation.y = Math.atan2(f.tx, f.tz);
      if (d.type === "rib") {
        const W = hw + 2.5;
        const H = d.h || 9;
        const pts = [];
        for (let j = 0; j <= 10; j++) {
          const a = (j / 10) * Math.PI;
          pts.push(V(Math.cos(a) * W, Math.sin(a) * H - 0.5, Math.sin(a * 2) * 0.6));
        }
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.55, 7);
        shadeVerts(tube, { bottom: 0.65 });
        holder.add(new THREE.Mesh(tube, this.mats.bone));
      } else if (d.type === "pillar") {
        const depth = f.y - T.lavaY(d.s) + 1;
        const p = new THREE.Mesh(shadeVerts(roundedBox(hw * 1.4, depth, 2.2, 0.3), { bottom: 0.5, top: 1 }), this.mats.rock);
        p.position.y = -1.8 - depth / 2;
        holder.add(p);
      } else if (d.type === "pipeArch") {
        const W = hw + 1.4;
        for (const k of [-1, 1]) {
          const post = new THREE.Mesh(shadeVerts(roundedBox(0.7, 6.2, 0.7, 0.1), { bottom: 0.6 }), this.mats.metal);
          post.position.set(k * W, 3.1, 0);
          holder.add(post);
        }
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, W * 2 + 1, 12), this.mats.metal);
        beam.rotation.z = Math.PI / 2;
        beam.position.y = 6.2;
        holder.add(beam);
        for (let k = -2; k <= 2; k++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.1, 6, 12), this.mats.pipeGlow);
          ring.position.set((k * W) / 2.5, 6.2, 0);
          ring.rotation.y = Math.PI / 2;
          holder.add(ring);
        }
      } else if (d.type === "dragonGate") {
        // 용의 영역 입구: 거대한 뿔 두 개 + 바위 아치 + 붉은 눈
        const W = hw + 3;
        for (const k of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(1.8, 16, 8), this.mats.bone);
          horn.position.set(k * W, 7, 0);
          horn.rotation.z = -k * 0.35;
          holder.add(horn);
        }
        const arch = new THREE.Mesh(shadeVerts(new THREE.TorusGeometry(W, 1.6, 8, 24, Math.PI), { bottom: 0.5 }), this.mats.rock);
        holder.add(arch);
        for (const k of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), new THREE.MeshBasicMaterial({ color: "#ff5a1a" }));
          eye.position.set(k * 3, W * 0.85, 0.8);
          holder.add(eye);
        }
      }
      g.add(holder);
    }
    if (g.children.length) {
      g.traverse((x) => x.isMesh && (x.castShadow = true));
      this.root.add(g);
    }
  }
  /* ---------------- 표지판 ---------------- */
  buildSigns() {
    const T = this.track;
    const f = {};
    const glowCol = { stop: "#ff3a3a", go: "#4aff7a", short: "#ffd23a", wind: "#7ad0ff" };
    for (const sg of T.def.signs || []) {
      T.frame(sg.s, f);
      const y = T.surfaceY(sg.s, sg.u) ?? f.y;
      const holder = new THREE.Group();
      holder.position.set(f.x + f.rx * sg.u, y, f.z + f.rz * sg.u);
      holder.rotation.y = Math.atan2(f.tx, f.tz) + Math.PI;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), this.mats.edge);
      post.position.y = 1.3;
      holder.add(post);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: signTex(sg.kind), transparent: true, side: THREE.DoubleSide }));
      board.position.set(0, 2.9, 0);
      holder.add(board);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: glowCol[sg.kind] || "#ffb02a", transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.position.set(0, 2.9, -0.1);
      gl.scale.setScalar(3.2);
      holder.add(gl);
      this.root.add(holder);
    }
  }
  lavaFall(x, y, z, w, h, ry) {
    const t = lavaTex().clone();
    t.needsUpdate = true;
    t.repeat.set(w / 5, h / 9);
    this.ownTex.push(t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: "#ffc080", side: THREE.DoubleSide }));
    m.position.set(x, y - h / 2, z);
    m.rotation.y = ry;
    this.root.add(m);
    this.anim.push((dt) => (t.offset.y += dt * 0.5));
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff7a2a", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.position.set(x, y - h + 1, z);
    g.scale.setScalar(w * 4);
    this.root.add(g);
  }
  /** 체크포인트 아치 (돌 기둥 두 개 + 깃발 + 불 그릇) */
  arch(s) {
    const T = this.track;
    const f = T.frame(s, {});
    const hw = T.halfWidth(s);
    const g = new THREE.Group();
    g.position.set(f.x, T.surfaceY(s, 0) ?? f.y, f.z);
    g.rotation.y = Math.atan2(f.tx, f.tz);
    const d = new THREE.Group();
    for (const k of [-1, 1]) {
      const p = new THREE.Mesh(shadeVerts(roundedBox(1.0, 5.2, 1.0, 0.15), { bottom: 0.6 }), this.mats.stone);
      p.position.set(k * (hw + 0.9), 2.6, 0);
      d.add(p);
      const bowl = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.55, 0.3, 0.35, 12), { bottom: 0.7 }), this.mats.stone);
      bowl.position.set(k * (hw + 0.9), 5.4, 0);
      d.add(bowl);
    }
    const beam = new THREE.Mesh(shadeVerts(roundedBox(hw * 2 + 2.6, 0.7, 0.9, 0.12), { bottom: 0.7 }), this.mats.stone);
    beam.position.y = 5.0;
    d.add(beam);
    const merged = mergeByMaterial(d);
    merged.traverse((o) => o.isMesh && (o.castShadow = true));
    g.add(merged);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(hw * 1.2, 1.1), this.mats.banner.clone());
    // 다가오는 주인공 쪽(코스 뒤)을 보게 (글자가 뒤집히지 않게)
    banner.position.set(0, 4.0, -0.46);
    banner.rotation.y = Math.PI;
    g.add(banner);
    const fires = [];
    for (const k of [-1, 1]) {
      const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 10), this.mats.fire);
      fire.position.set(k * (hw + 0.9), 6.0, 0);
      g.add(fire);
      fires.push(fire);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff9a3a", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.position.copy(fire.position);
      gl.scale.setScalar(3);
      g.add(gl);
    }
    this.root.add(g);
    this.anim.push((dt, t) => fires.forEach((fi, i) => fi.scale.set(1 + Math.sin(t * 14 + i) * 0.12, 1 + Math.sin(t * 19 + i) * 0.2, 1)));
    return { g, banner };
  }
  /** 안전지대 (식은 바위 고원 + 구조 기지: 천막 · 깃발 · 구조 열기구) */
  safeZone(s) {
    const T = this.track;
    const f = T.frame(s + 12, {});
    const g = new THREE.Group();
    g.position.set(f.x, f.y, f.z);
    g.rotation.y = Math.atan2(f.tx, f.tz);
    const d = new THREE.Group();
    for (const [x, z] of [
      [-6.5, 4],
      [6.8, 8],
    ]) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.8, 4, 1, true), this.mats.cloth);
      tent.position.set(x, 1.4, z);
      tent.rotation.y = Math.PI / 4;
      d.add(tent);
    }
    const basket = new THREE.Mesh(shadeVerts(roundedBox(2.2, 1.2, 2.2, 0.2), { bottom: 0.6 }), this.mats.stone);
    basket.position.set(0, 0.6, 16);
    d.add(basket);
    g.add(mergeByMaterial(d));
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 28, 20), new THREE.MeshStandardMaterial({ color: "#ff8a5a", roughness: 0.7 }));
    balloon.scale.set(1, 1.2, 1);
    balloon.position.set(0, 9.5, 16);
    g.add(balloon);
    for (const k of [-1, 1])
      for (const k2 of [-1, 1]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.6, 4), this.mats.stone);
        rope.position.set(k * 0.95, 3.8, 16 + k2 * 0.95);
        rope.rotation.set(k2 * 0.18, 0, -k * 0.18);
        g.add(rope);
      }
    const flagM = new THREE.MeshStandardMaterial({ color: "#7aff9a", roughness: 0.7, side: THREE.DoubleSide });
    for (const k of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8), this.mats.stone);
      pole.position.set(k * 5, 2.25, -2);
      g.add(pole);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), flagM);
      fl.position.set(k * 5 + 0.85, 3.9, -2);
      g.add(fl);
      this.anim.push((dt, t) => (fl.rotation.y = Math.sin(t * 3 + k) * 0.3));
    }
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    this.root.add(g);
    this.anim.push((dt, t) => (balloon.position.y = 9.5 + Math.sin(t * 0.8) * 0.3));
    return g;
  }
  update(dt, t) {
    for (const f of this.anim) f(dt, t);
  }
  dispose() {
    this.scene.remove(this.root);
    const mats = new Set([...Object.values(this.mats), ...this.groundMats.values()]);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
    });
    for (const m of mats) m.dispose();
    for (const t of this.ownTex) t.dispose();
  }
}
