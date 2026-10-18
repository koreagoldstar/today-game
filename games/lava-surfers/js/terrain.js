/*
 * 용암 서핑 · 지형 모양 만들기 (보이는 것)
 *  트랙 모델(track.js)의 표면 높이를 그대로 써서 메시를 만든다 → 보이는 땅 = 부딪히는 땅
 *   - 경사면 (그릇 모양 · 점프대 포함 · 틈은 비움) : 화산재 덮인 검은 바위 + 빛나는 틈
 *   - 가장자리: 벽이 있는 곳은 솟은 바위벽, 없는 곳은 용암까지 떨어지는 절벽
 *   - 틈(용암 강 · 절벽)의 앞뒤 낭떠러지 면
 *   - 아래 골짜기를 채운 용암 (흐름)
 *   - 꾸밈: 바깥 바위 · 흑요석 기둥 · 떠 있는 바위 · 용암 폭포 · 체크포인트 아치 · 출발 · 안전지대
 *  80m 구역으로 나눠 화면 밖은 그리지 않는다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { fbm3, shadeVerts, roundedBox, mergeByMaterial } from "./geo.js?v=1";
import { slopeTex, slopeGlowTex, cliffTex, lavaTex, dotTex, chevronTex, seeded } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const CHUNK = 80;

export class Terrain {
  constructor(track, scene, { quality = 1 } = {}) {
    this.track = track;
    this.scene = scene;
    this.q = quality;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.anim = [];
    const gt = slopeTex();
    this.mats = {
      ground: new THREE.MeshStandardMaterial({ map: gt, emissiveMap: slopeGlowTex(), emissive: "#ffffff", emissiveIntensity: 0.85, roughness: 0.9 }),
      cliff: new THREE.MeshStandardMaterial({ map: cliffTex(), roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }),
      lava: new THREE.MeshBasicMaterial({ map: (() => {
        const t = lavaTex().clone();
        t.needsUpdate = true;
        return t;
      })(), color: "#ffffff" }),
      obsidian: new THREE.MeshStandardMaterial({ color: "#2a2230", roughness: 0.18, metalness: 0.35, vertexColors: true, flatShading: true }),
      rock: new THREE.MeshStandardMaterial({ map: cliffTex(), roughness: 0.95, vertexColors: true }),
      edge: new THREE.MeshStandardMaterial({ color: "#3a3038", roughness: 0.4, metalness: 0.5 }),
      chevron: new THREE.MeshBasicMaterial({ map: (() => {
        const t = chevronTex().clone();
        t.needsUpdate = true;
        return t;
      })(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      stone: new THREE.MeshStandardMaterial({ color: "#5a4a50", roughness: 0.85, vertexColors: true }),
      banner: new THREE.MeshStandardMaterial({ color: "#ffcf4a", roughness: 0.8, side: THREE.DoubleSide }),
      fire: new THREE.MeshBasicMaterial({ color: "#ffb04a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      cloth: new THREE.MeshStandardMaterial({ color: "#f4e6d0", roughness: 0.85, side: THREE.DoubleSide }),
    };
    this.build();
  }
  build() {
    const T = this.track;
    for (let s0 = -20; s0 < T.len; s0 += CHUNK) this.buildChunk(s0, Math.min(T.len, s0 + CHUNK));
    this.buildGapFaces();
    this.buildRamps();
    this.buildDecor();
  }

  /* ---------------- 구역 하나: 경사면 · 가장자리 · 용암 바닥 ---------------- */
  buildChunk(s0, s1) {
    const T = this.track;
    const f = {};
    const step = 1;
    const COLS = 18;
    // 1) 경사면 (틈 구간은 건너뜀)
    const pos = [];
    const uv = [];
    const idx = [];
    let rowStart = -1;
    let prevOk = false;
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
      return base;
    };
    for (let s = s0; s <= s1 + 0.001; s += step) {
      const ok = !T.inGap(s) && s >= 0;
      if (ok) {
        const b = pushRow(s);
        if (prevOk && rowStart >= 0) {
          for (let j = 0; j < COLS; j++) {
            const a = rowStart + j;
            const c = b + j;
            idx.push(a, a + 1, c, a + 1, c + 1, c);
          }
        }
        rowStart = b;
      }
      prevOk = ok;
    }
    if (idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, this.mats.ground);
      m.receiveShadow = true;
      this.root.add(m);
    }
    // 2) 가장자리 (양쪽): 바위벽 또는 용암까지 떨어지는 절벽
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
        const n = (k) => fbm3(f.x * 0.15 + k, f.z * 0.15, s * 0.05 + side * 3, 3) - 0.5;
        if (wall) {
          const h = 1.5 + n(1) * 1.6;
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
      const cols = [-140, -60, -25, 0, 25, 60, 140];
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
        const top = (u) => f.y + T.bowl(s, Math.max(-hw, Math.min(hw, u))) + T.rampAdd(s - dir * 0.01);
        const bot = T.lavaY(s) - 1;
        for (let j = 0; j <= N; j++) {
          const u = -hw + (2 * hw * j) / N;
          const n = fbm3(u * 0.4, s * 0.1, 3, 3) - 0.5;
          const y0 = top(u);
          for (let k = 0; k <= 4; k++) {
            const t = k / 4;
            const y = y0 + (bot - y0) * t;
            const back = dir * (t * t * 2.5 + n * t * 1.5); // 아래로 갈수록 안쪽으로 파임
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
      glow.scale.setScalar((g1 - g0) * 2.2);
      this.root.add(glow);
    }
  }

  /* ---------------- 점프대: 빛나는 화살표 + 끝 모서리 ---------------- */
  buildRamps() {
    const T = this.track;
    const f = {};
    for (const [s0, s1] of T.ramps) {
      const hw = T.halfWidth(s1);
      // 화살표 띠 (경사면 위에 얹음)
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
      // 끝 모서리 (쇠 테두리)
      T.frame(s1 - 0.15, f);
      const lip = new THREE.Mesh(roundedBox(hw * 2 + 0.6, 0.18, 0.3, 0.06), this.mats.edge);
      lip.position.set(f.x, f.y + T.rampAdd(s1 - 0.15) - 0.06, f.z);
      lip.rotation.y = Math.atan2(f.tx, f.tz);
      lip.castShadow = true;
      this.root.add(lip);
    }
  }

  /* ---------------- 꾸밈 ---------------- */
  buildDecor() {
    const T = this.track;
    const f = {};
    const rnd = seeded(77);
    // 바깥 바위 · 흑요석 기둥 (인스턴스)
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
    const rocks = [];
    const spires = [];
    for (let s = 0; s < T.len; s += 3.2) {
      const hw = T.halfWidth(s);
      for (const side of [-1, 1]) {
        if (rnd() < 0.55) {
          const wall = T.wall(s, side);
          const u = side * (hw + (wall ? 2.5 + rnd() * 3 : 4 + rnd() * 6));
          T.frame(s, f);
          const y = wall ? f.y + 1.5 + rnd() * 2 : T.lavaY(s) + 0.5;
          rocks.push([f.x + f.rx * u, y, f.z + f.rz * u, 0.6 + rnd() * 1.6, rnd() * TAU]);
        }
        if (rnd() < 0.18) {
          const u = side * (hw + 6 + rnd() * 14);
          T.frame(s, f);
          spires.push([f.x + f.rx * u, T.lavaY(s) - 1, f.z + f.rz * u, 3 + rnd() * 12, rnd() * TAU]);
        }
      }
    }
    const o = new THREE.Object3D();
    const ri = new THREE.InstancedMesh(rockGeo, this.mats.rock, rocks.length);
    rocks.forEach(([x, y, z, s, r], i) => {
      o.position.set(x, y, z);
      o.rotation.set(r * 0.3, r, 0);
      o.scale.set(s, s, s);
      o.updateMatrix();
      ri.setMatrixAt(i, o.matrix);
    });
    ri.castShadow = true;
    ri.receiveShadow = true;
    this.root.add(ri);
    const si = new THREE.InstancedMesh(spireGeo, this.mats.obsidian, spires.length);
    spires.forEach(([x, y, z, h, r], i) => {
      o.position.set(x, y, z);
      o.rotation.set((r % 1) * 0.2 - 0.1, r, 0);
      o.scale.set(1 + h * 0.08, h, 1 + h * 0.08);
      o.updateMatrix();
      si.setMatrixAt(i, o.matrix);
    });
    si.castShadow = true;
    this.root.add(si);
    // 떠 있는 바위 (머리 위 · 옆) — 천천히 출렁
    const floats = [];
    for (let i = 0; i < (this.q >= 0.9 ? 36 : 20); i++) {
      const s = 80 + rnd() * (T.len - 200);
      const side = rnd() < 0.5 ? -1 : 1;
      T.frame(s, f);
      const u = side * (T.halfWidth(s) + 8 + rnd() * 22);
      floats.push({ x: f.x + f.rx * u, y: f.y + 8 + rnd() * 18, z: f.z + f.rz * u, s: 1.5 + rnd() * 3.5, r: rnd() * TAU, ph: rnd() * TAU });
    }
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
    // 용암 폭포 (옆 절벽에서 골짜기로)
    for (const s of [180, 430, 690, 960, 1180, 1400]) {
      const side = Math.round(s / 10) % 2 ? 1 : -1;
      T.frame(s, f);
      const u = side * (T.halfWidth(s) + 9);
      this.lavaFall(f.x + f.rx * u, f.y + 6, f.z + f.rz * u, 4, f.y + 6 - T.lavaY(s), Math.atan2(-f.rx * side, -f.rz * side));
    }
    // 흐르는 용암 무늬
    const lt = this.mats.lava.map;
    this.anim.push((dt) => {
      lt.offset.x += dt * 0.01;
      lt.offset.y += dt * 0.025;
    });
    const ct = this.mats.chevron.map;
    this.anim.push((dt) => (ct.offset.y -= dt * 1.2));
  }
  lavaFall(x, y, z, w, h, ry) {
    const t = lavaTex().clone();
    t.needsUpdate = true;
    t.repeat.set(w / 5, h / 9);
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
  arch(s, label = "") {
    const T = this.track;
    const f = T.frame(s, {});
    const hw = T.halfWidth(s);
    const g = new THREE.Group();
    g.position.set(f.x, f.y, f.z);
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
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(hw * 1.2, 1.1), this.mats.banner);
    banner.position.set(0, 4.0, 0.46);
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
    // 천막 두 개
    for (const [x, z] of [
      [-6.5, 4],
      [6.8, 8],
    ]) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.8, 4, 1, true), this.mats.cloth);
      tent.position.set(x, 1.4, z);
      tent.rotation.y = Math.PI / 4;
      d.add(tent);
    }
    // 구조 열기구 (바구니 + 풍선)
    const basket = new THREE.Mesh(shadeVerts(roundedBox(2.2, 1.2, 2.2, 0.2), { bottom: 0.6 }), this.mats.stone);
    basket.position.set(0, 0.6, 16);
    d.add(basket);
    const merged = mergeByMaterial(d);
    g.add(merged);
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
    // 깃발 줄 · 'SAFE' 기둥
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
    this.root.traverse((o) => o.geometry && o.geometry.dispose());
    for (const m of Object.values(this.mats)) m.dispose();
  }
}
