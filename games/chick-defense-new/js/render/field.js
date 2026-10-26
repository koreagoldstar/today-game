/*
 * 전장 그리기: 지형(높낮이 · 길 · 물) · 풀 · 장식 · 울타리 · 다리 · 포탈 · 랜드마크 · 먼 산 · 구름 · 환경 기믹 · 황금 둥지
 *  - 지형 · 물은 terrain.js, 장식 모양은 props.js, 색 · 조명 규칙은 look.js (월드마다)
 *  - 장식은 같은 종류를 한 번에 그림(인스턴싱) → 많아도 가벼움
 *  - 전장 안에는 장식 칸(decor)에만 장식 · 설치 칸 가운데는 풀도 비움 → 타워 자리 · 길이 잘 보임
 *  - 전장 밖 가까운 곳은 낮은 덤불 · 꽃 · 바위, 먼 곳은 숲(나무 무리) → 깊이감
 */
import { THREE, part, group, mat, geo, FX, flatten } from "./kit.js";
import { CELL } from "../sim/map.js";
import { Terrain } from "./terrain.js";
import { lookOf } from "./look.js";
import { baked, propMat, propGlowMat, Baker, cyl, cone, box, sph, blob, rockGeo } from "./props.js";
import { glowTex, swirlTex } from "./fxtex.js";
import { rngOf, noise2, smooth } from "./noise.js";

const S = Math.sin;

export class Field {
  constructor(scene, world, map, quality) {
    this.scene = scene;
    this.world = world;
    this.map = map;
    this.q = quality;
    this.L = lookOf(world);
    this.root = new THREE.Group();
    scene.add(this.root);
    this.clouds = [];
    this.anims = [];
    this.build();
  }
  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry && o.userData.own) o.geometry.dispose();
      if (o.userData.tex) o.userData.tex.dispose();
      if (o.material && o.userData.ownMat) {
        const m = o.material;
        if (m.uniforms && m.uniforms.uMask) m.uniforms.uMask.value.dispose();
        m.dispose();
      }
    });
  }
  build() {
    const W = this.world;
    const map = this.map;
    const R = this.root;
    const rnd = rngOf(W.id * 977);
    this.T = new Terrain(W, map, this.L, this.q);
    R.add(this.T.build());
    this.water = this.T.buildWater();
    if (this.water) R.add(this.water);
    this.grass(rnd);
    this.placeProps(rnd);
    this.border(rnd);
    for (const [x, z] of W.bridges || []) this.bridge(x + 0.5, z + 0.5);
    for (const p of map.paths) this.portal(p);
    this.landmarks();
    this.backdrop(rnd);
    this.gimmick();
    this.nest = this.buildNest();
  }

  /* ---------------- 인스턴스 장식 ---------------- */
  /** list: [x, z, 크기, 회전, 변형, 먼 것(면 적게)] */
  inst(kind, list, opt = {}) {
    if (!list.length) return;
    const byV = new Map();
    for (const it of list) {
      const v = `${it[4] || 0}|${it[5] ? 1 : 0}`;
      if (!byV.has(v)) byV.set(v, []);
      byV.get(v).push(it);
    }
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const P = new THREE.Vector3();
    const Sc = new THREE.Vector3();
    for (const [vk, items] of byV) {
      const [v, lod] = vk.split("|").map(Number);
      const b = baked(this.L, this.world.key, kind, v, lod);
      if (!b) continue;
      const mk = (g, m, shadow) => {
        if (!g) return;
        const im = new THREE.InstancedMesh(g, m, items.length);
        items.forEach(([x, z, s, r], i) => {
          const y = opt.y != null ? opt.y : this.T.height(x, z) - 0.02;
          M.compose(P.set(x, y, z), Q.setFromAxisAngle(up, r), Sc.set(s, s * (opt.sy || 1), s));
          im.setMatrixAt(i, M);
        });
        im.castShadow = shadow && this.q !== "low";
        im.receiveShadow = this.q !== "low";
        this.root.add(im);
      };
      mk(b.body, propMat(kind), opt.shadow !== false && !lod);
      mk(b.glow, propGlowMat(), false);
    }
  }
  placeProps(rnd) {
    const W = this.world;
    const L = this.L;
    const map = this.map;
    const T = this.T;
    const pick = (arr) => {
      let tot = 0;
      for (const [, w] of arr) tot += w;
      let r = rnd() * tot;
      for (const [k, w] of arr) if ((r -= w) <= 0) return k;
      return arr[0][0];
    };
    const lists = new Map();
    const put = (kind, x, z, s, r, v = Math.floor(rnd() * 3)) => {
      if (!lists.has(kind)) lists.set(kind, []);
      lists.get(kind).push([x, z, s, r, v, T.outside(x, z) > 6.5 ? 1 : 0]);
    };
    // 전장 안 장식 칸
    for (const [x, z, kind] of W.decor || []) {
      const opts = L.decorMap[kind] || [kind];
      const k = opts[Math.floor(rnd() * opts.length)];
      const tall = /Tree|pine|Pine|spire|bigShroom/.test(k);
      put(k, x + 0.5 + (rnd() - 0.5) * 0.15, z + 0.5 + (rnd() - 0.5) * 0.15, (tall ? 0.62 : 0.85) + rnd() * 0.18, rnd() * 6);
    }
    // 전장 밖: 흔들린 격자 위에 잡음으로 무리 지어
    this.keep = this.keepOut();
    const far = this.q === "low" ? 2.6 : 1.9;
    for (let gz = -18; gz < map.d + 18; gz += far)
      for (let gx = -20; gx < map.w + 20; gx += far) {
        const x = gx + (rnd() - 0.5) * far * 0.9;
        const z = gz + (rnd() - 0.5) * far * 0.9;
        const out = T.outside(x, z);
        if (out < 0.9 || out > 17) continue;
        if (T.pathDist(x, z) < 1.7 + (out > 4.5 ? 1.0 : 0)) continue;
        if (this.keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
        if (T.waterMask(x, z) > 0.05) continue;
        const grove = noise2(x * 0.16, z * 0.16, W.id * 31);
        if (out < 4.5) {
          if (rnd() < 0.5) put(pick(L.near), x, z, 0.7 + rnd() * 0.5, rnd() * 6);
        } else {
          const dense = smooth(0.4, 0.62, grove);
          if (rnd() < 0.12 + dense * 0.62) put(pick(L.far), x, z, (0.95 + rnd() * 0.7) * (1 + Math.min(1, out / 20) * 0.45), rnd() * 6);
          else if (rnd() < 0.15) put(pick(L.near), x, z, 0.9 + rnd() * 0.6, rnd() * 6);
        }
      }
    for (const [kind, list] of lists) this.inst(kind, list);
  }
  /** 장식을 두지 않을 곳 (랜드마크 · 포탈 앞) */
  keepOut() {
    const out = [];
    for (const lm of this.landmarkSpots()) out.push([lm.x, lm.z, lm.r]);
    for (const p of this.map.paths) {
      const a = p.at(Math.max(0, p.entryS() - 0.6));
      out.push([a.x, a.z, 2.4]);
    }
    return out;
  }

  /** 풀숲 (바람에 흔들림) — 땅 색에 맞춰, 길가 · 울타리 둘레 · 바깥에 많이 */
  grass(rnd) {
    const W = this.world;
    const map = this.map;
    const T = this.T;
    const sparse = W.key === "lava" || W.key === "castle";
    const n = Math.round((this.q === "low" ? 420 : this.q === "medium" ? 1000 : 1500) * (sparse ? 0.4 : 1));
    const blade = new THREE.BufferGeometry();
    const v = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.4;
      const ox = Math.cos(a) * 0.045;
      const oz = Math.sin(a) * 0.045;
      const px = -Math.sin(a) * 0.05;
      const pz = Math.cos(a) * 0.05;
      const h = 0.15 + (i % 3) * 0.05;
      v.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox * 3.4, h, oz * 3.4);
    }
    blade.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    blade.computeVertexNormals();
    // 잎을 위쪽으로 향한 노멀로 (뒷면도 밝게 · 땅과 같은 밝기)
    const nn = blade.attributes.normal;
    for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
    const gmat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9 });
    gmat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = FX.time;
      sh.vertexShader = sh.vertexShader.replace("void main() {", "uniform float uTime;\nvoid main() {").replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4;
          transformed.x += sin(uTime * 1.8 + ph) * position.y * 0.3;
          transformed.z += cos(uTime * 1.3 + ph) * position.y * 0.15;
        #endif`
      );
    };
    gmat.customProgramCacheKey = () => "cdn-grass2";
    const m = new THREE.InstancedMesh(blade, gmat, n);
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let i = 0;
    let guard = 0;
    while (i < n && guard++ < n * 10) {
      const zone = rnd();
      let x;
      let z;
      if (zone < 0.38) {
        x = rnd() * map.w;
        z = rnd() * map.d;
      } else if (zone < 0.72) {
        x = -4 + rnd() * (map.w + 8);
        z = -4 + rnd() * (map.d + 8);
      } else {
        x = -16 + rnd() * (map.w + 32);
        z = -12 + rnd() * (map.d + 24);
      }
      const dp = T.pathDist(x, z);
      if (dp < 0.9) continue;
      if (T.waterMask(x, z) > 0.02) continue;
      if (x >= 0 && z >= 0 && x < map.w && z < map.d) {
        const cell = map.cell(Math.floor(x), Math.floor(z));
        if (cell === CELL.NEST || cell === CELL.VENT) continue;
        // 칸 가운데는 비움 · 길가 · 가장자리에 더 많이
        const fx = x - Math.floor(x);
        const fz = z - Math.floor(z);
        const center = fx > 0.22 && fx < 0.78 && fz > 0.22 && fz < 0.78;
        if (center && cell === CELL.OPEN) continue;
        if (dp > 1.6 && rnd() < 0.72) continue;
      }
      const k = 0.6 + rnd() * 0.6;
      Q.setFromAxisAngle(up, rnd() * 6);
      M.compose(new THREE.Vector3(x, T.height(x, z, dp) - 0.01, z), Q, new THREE.Vector3(k, k * (0.75 + rnd() * 0.6), k));
      m.setMatrixAt(i, M);
      const c = T.grassColor(x, z).multiplyScalar(0.96 + rnd() * 0.12);
      m.setColorAt(i, c);
      i++;
    }
    m.count = i;
    m.receiveShadow = this.q !== "low";
    m.userData.own = true;
    this.root.add(m);
  }

  /* ---------------- 울타리 (월드마다 다른 모양) ---------------- */
  border(rnd) {
    const W = this.world;
    const map = this.map;
    const T = this.T;
    const kind = this.L.border;
    const posts = [];
    const add = (x, z) => {
      if (T.pathDist(x, z) < 1.25) return;
      if (T.waterMask(x, z) > 0.1) return;
      posts.push([x, z, 0.85 + rnd() * 0.25, (rnd() - 0.5) * 0.5, Math.floor(rnd() * 2)]);
    };
    for (let x = -0.45; x <= map.w + 0.45; x += 1) {
      add(x, -0.45);
      add(x, map.d + 0.45);
    }
    for (let z = 0.55; z <= map.d - 0.45; z += 1) {
      add(-0.45, z);
      add(map.w + 0.45, z);
    }
    const L = this.L;
    const b = new Baker(W.id + 400);
    if (kind === "fence") {
      b.add(cyl(0.06, 0.075, 0.62, 7), 0xb98652, { p: [0, 0.31, 0], under: 0.35, jit: 0.2 });
      b.add(cone(0.08, 0.12, 7), 0xa87442, { p: [0, 0.68, 0] });
    } else if (kind === "shroomPost") {
      b.add(cyl(0.07, 0.1, 0.42, 8), 0xf4ead8, { p: [0, 0.21, 0], under: 0.3 });
      b.add(sph(0.17, 12, 8), 0xd04a3a, { p: [0, 0.46, 0], s: [1, 0.55, 1], under: 0.4 });
      for (let i = 0; i < 3; i++) b.add(sph(0.03, 6, 4), 0xffffff, { p: [Math.cos(i * 2.1) * 0.1, 0.53, Math.sin(i * 2.1) * 0.1] });
    } else if (kind === "iceSpike") {
      b.add(rockGeo(0.2, 9), 0xd8eeff, { p: [0, 0.32, 0], s: [0.7, 1.9, 0.7], flat: true, top: 0xffffff, topK: 0.4 });
    } else if (kind === "basalt") {
      b.add(cyl(0.16, 0.19, 0.6, 6), L.rock[0], { p: [0, 0.3, 0], flat: true, top: 0x6a5a56, topK: 0.8 });
    } else {
      b.add(cyl(0.035, 0.05, 0.62, 6), 0x2a2438, { p: [0, 0.31, 0] });
      b.add(cone(0.07, 0.2, 6), 0x5a4a7a, { p: [0, 0.72, 0] });
    }
    const bk = b.bake({ ao: 0.3 });
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const P = new THREE.Vector3();
    const Sc = new THREE.Vector3();
    const im = new THREE.InstancedMesh(bk.body, propMat("post"), posts.length);
    posts.forEach(([x, z, k, r], i) => {
      im.setMatrixAt(i, M.compose(P.set(x, T.height(x, z) - 0.02, z), Q.setFromAxisAngle(up, r), Sc.set(1, k, 1)));
    });
    im.castShadow = this.q !== "low";
    im.receiveShadow = true;
    im.userData.own = true;
    this.root.add(im);
    if (kind === "fence") {
      const rails = [];
      for (const [a, c] of [
        [[-0.45, -0.45], [map.w + 0.45, -0.45]],
        [[-0.45, map.d + 0.45], [map.w + 0.45, map.d + 0.45]],
        [[-0.45, -0.45], [-0.45, map.d + 0.45]],
        [[map.w + 0.45, -0.45], [map.w + 0.45, map.d + 0.45]],
      ]) {
        const Ln = Math.hypot(c[0] - a[0], c[1] - a[1]);
        for (let s = 0; s < Ln - 0.5; s += 1) {
          const x = a[0] + ((c[0] - a[0]) / Ln) * (s + 0.5);
          const z = a[1] + ((c[1] - a[1]) / Ln) * (s + 0.5);
          if (T.pathDist(x, z) < 1.25 || T.waterMask(x, z) > 0.1) continue;
          rails.push([x, z, Math.atan2(c[0] - a[0], c[1] - a[1])]);
        }
      }
      const rb = new Baker(7).add(box(0.05, 0.075, 1.02), 0xd29a62, { jit: 0.25 }).bake({ ao: 0 });
      const rm = new THREE.InstancedMesh(rb.body, propMat("post"), Math.max(1, rails.length * 2));
      rails.forEach(([x, z, yaw], i) => {
        for (let k = 0; k < 2; k++) rm.setMatrixAt(i * 2 + k, M.compose(P.set(x, 0.24 + k * 0.2 + S(x * 3 + z) * 0.015, z), Q.setFromAxisAngle(up, yaw + S(x * 7 + z * 3) * 0.03), Sc.set(1, 1, 1)));
      });
      rm.count = rails.length * 2;
      rm.castShadow = this.q !== "low";
      rm.receiveShadow = true;
      rm.userData.own = true;
      this.root.add(rm);
    }
  }

  /** 나무다리 (길 방향으로 · 가운데가 살짝 솟음) */
  bridge(x, z) {
    let best = null;
    for (const p of this.map.paths) {
      const n = p.nearest(x, z);
      if (!best || n.d < best.d) best = { ...n, p };
    }
    const a = best ? best.p.at(best.s) : { dx: 1, dz: 0 };
    const g = group(this.root, { p: [x, 0, z], r: [0, Math.atan2(a.dx, a.dz), 0] });
    const N = 7;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1) - 0.5;
      const y = 0.06 + (1 - (t * 2) ** 2) * 0.1;
      part(g, "box", [1.28, 0.06, 0.24], i % 2 ? 0xb07a48 : 0xc48a54, { p: [0, y, t * 1.62], r: [-t * 0.25, 0, S(i * 3) * 0.02], outline: false });
    }
    for (const sx of [-1, 1]) {
      part(g, "box", [0.08, 0.1, 1.8], 0x8a5a32, { p: [sx * 0.6, 0.09, 0], outline: false });
      for (const tz of [-0.78, 0, 0.78]) part(g, "cyl", [0.045, 0.055, 0.5, 6], 0x8a5a32, { p: [sx * 0.62, 0.3 + (tz === 0 ? 0.08 : 0), tz] });
      part(g, "box", [0.05, 0.05, 1.62], 0xc48a54, { p: [sx * 0.62, 0.5, 0], r: [0, 0, 0], outline: false });
    }
    flatten(g);
  }

  /** 몬스터가 나오는 돌 문 (길 입구) — 돌기둥 · 아치 · 소용돌이 · 바닥 빛 */
  portal(p) {
    const s0 = p.entryS();
    const a = p.at(Math.max(0, s0 - 0.7));
    const W = this.world;
    const col = { meadow: 0x9a6aff, forest: 0xb4ff6a, ice: 0x8fe8ff, lava: 0xff6a1a, castle: 0xff4ad8 }[W.key] || 0x9a6aff;
    const g = group(this.root, { p: [a.x, this.T.height(a.x, a.z) + 0.04, a.z], r: [0, Math.atan2(a.dx, a.dz), 0] });
    const stone = { meadow: 0x9a92a8, forest: 0x7a7090, ice: 0xbcd4ec, lava: 0x4a3c3a, castle: 0x4a4268 }[W.key] || 0x9a92a8;
    for (const sx of [-1, 1]) {
      part(g, "cyl", [0.24, 0.32, 0.3, 8], shadeHex(stone, 0.8), { p: [sx * 1.0, 0.15, 0] });
      part(g, "cyl", [0.18, 0.22, 1.7, 8], stone, { p: [sx * 1.0, 1.1, 0] });
      part(g, "box", [0.44, 0.16, 0.44], shadeHex(stone, 0.85), { p: [sx * 1.0, 1.98, 0] });
      part(g, "octa", [0.16, 0], col, { p: [sx * 1.0, 2.24, 0], o: { emissive: col, ei: 1.4 } });
    }
    part(g, "torus", [1.0, 0.13, 8, 24, Math.PI], stone, { p: [0, 1.95, 0], r: [0, 0, 0] });
    part(g, "octa", [0.2, 0], col, { p: [0, 2.98, 0], o: { emissive: col, ei: 1.6 } });
    flatten(g);
    const vortex = new THREE.Mesh(new THREE.CircleGeometry(0.92, 32), new THREE.MeshBasicMaterial({ map: swirlTex(), color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    vortex.position.set(0, 1.1, 0);
    vortex.userData.own = true;
    vortex.userData.ownMat = true;
    g.add(vortex);
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.95, 32), new THREE.MeshBasicMaterial({ color: shadeHex(col, 0.35), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    back.position.set(0, 1.1, -0.02);
    back.userData.own = true;
    back.userData.ownMat = true;
    g.add(back);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.position.set(a.x, this.T.height(a.x, a.z) + 0.05, a.z);
    glow.userData.own = true;
    glow.userData.ownMat = true;
    this.root.add(glow);
    this.anims.push((t) => {
      vortex.rotation.z = -t * 2.2;
      vortex.scale.setScalar(1 + S(t * 3) * 0.05);
      glow.scale.setScalar(1 + S(t * 2) * 0.08);
      glow.material.opacity = 0.45 + S(t * 2.5) * 0.12;
    });
  }

  /** 월드의 랜드마크 자리 (장식을 비워 둠) */
  landmarkSpots() {
    const m = this.map;
    const k = this.world.key;
    if (k === "meadow")
      return [
        { kind: "windmill", x: m.w + 3.6, z: -3.2, r: 3.2 },
        { kind: "oak", x: -4.2, z: -3.8, r: 3.4 },
      ];
    if (k === "forest") return [{ kind: "giantShroom", x: m.w * 0.5, z: -7, r: 4 }, { kind: "giantShroom", x: m.w + 7.5, z: m.d * 0.5, r: 4 }];
    if (k === "ice") return [{ kind: "iceSpire", x: m.w * 0.5, z: -7.5, r: 3.5 }, { kind: "iceSpire", x: m.w + 7.5, z: m.d * 0.5, r: 3.5 }];
    if (k === "lava") return [{ kind: "volcano", x: m.w * 0.5, z: -10, r: 6 }, { kind: "volcano", x: m.w + 10, z: m.d * 0.5, r: 6 }];
    if (k === "castle") return [{ kind: "keep", x: m.w * 0.5, z: -8.5, r: 5 }, { kind: "keep", x: m.w + 8.5, z: m.d * 0.5, r: 5 }];
    return [];
  }
  landmarks() {
    for (const lm of this.landmarkSpots()) {
      const y = this.T.height(lm.x, lm.z) - 0.05;
      const g = group(this.root, { p: [lm.x, y, lm.z] });
      const fn = LANDMARK[lm.kind];
      if (fn) {
        const anim = fn(g, this.L, this);
        flatten(g, anim ? [g.userData.keep] : []);
        if (anim) this.anims.push(anim);
      }
    }
  }

  /** 먼 배경: 둘레의 큰 산 · 구름 */
  backdrop(rnd) {
    const m = this.map;
    const cx = m.w / 2;
    const cz = m.d / 2;
    const list = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.2;
      const r = 54 + rnd() * 12;
      list.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r * 0.85, 9 + rnd() * 7, rnd() * 6, i % 3]);
    }
    this.inst("mountain", list.map(([x, z, s, r, v]) => [x, z, s, r, v]), { y: -1.5, shadow: false, sy: 0.9 });
    const clouds = [];
    const cn = this.q === "low" ? 5 : 9;
    for (let i = 0; i < cn; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = 30 + rnd() * 16;
      clouds.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr * 0.8, 1.1 + rnd() * 0.9, rnd() * 6, i % 2]);
    }
    if (this.world.key !== "castle" && this.world.key !== "lava") {
      for (const [x, z, s, r, v] of clouds) {
        const b = baked(this.L, this.world.key, "cloud", v);
        const cm = new THREE.Mesh(b.body, cloudMat());
        cm.position.set(x, 9 + rnd() * 5, z);
        cm.scale.setScalar(s);
        cm.rotation.y = r;
        this.root.add(cm);
        this.clouds.push({ c: cm, v: 0.3 + rnd() * 0.4, y0: cm.position.y });
      }
    }
  }

  /** 환경 기믹 표시 (규칙과 같은 자리 · 크기) */
  gimmick() {
    const g = this.world.gimmick;
    this.gim = [];
    if (!g) return;
    const R = this.root;
    if (g.kind === "sporeBloom")
      for (const s of g.spots) {
        const gr = group(R, { p: [s.x, 0, s.z] });
        const ring = part(gr, "ring", [s.r - 0.12, s.r, 40], 0xd6a2ff, { p: [0, 0.035, 0], o: { flat: true, opacity: 0.5 }, shadow: false });
        for (let i = 0; i < 6; i++) {
          const m = group(gr, { p: [Math.cos(i) * (s.r - 0.25), 0, S(i) * (s.r - 0.25)], s: 0.5 });
          for (const [x, z, k, c] of [[0, 0, 1, 0xe0453a], [0.25, 0.15, 0.7, 0xff9a3a]]) {
            part(m, "cyl", [0.05 * k, 0.07 * k, 0.3 * k, 8], 0xfff1dc, { p: [x, 0.15 * k, z] });
            part(m, "sphere", [0.16 * k, 10, 8], c, { p: [x, 0.32 * k, z], s: [1, 0.6, 1] });
          }
        }
        this.gim.push({ ring, kind: "spore", s });
      }
    if (g.kind === "icePatch")
      for (const s of g.spots) {
        const m = part(R, "disc", [s.r, 32], 0xdff6ff, { p: [s.x, 0.03, s.z], o: { opacity: 0.55, emissive: 0xbfefff, ei: 0.4 }, shadow: false });
        this.gim.push({ m, kind: "ice" });
      }
    if (g.kind === "lavaVent")
      for (const s of g.vents) {
        const v = group(R, { p: [s.x, 0, s.z] });
        part(v, "cyl", [0.42, 0.5, 0.35, 8], 0x2a2020, { p: [0, 0.17, 0] });
        const glow = part(v, "cyl", [0.25, 0.25, 0.05, 10], 0xff6a1a, { p: [0, 0.36, 0], o: { emissive: 0xff4a1a, ei: 1.5 }, shadow: false });
        const ring = part(R, "ring", [s.r - 0.1, s.r, 40], 0xff6a1a, { p: [s.x, 0.035, s.z], o: { flat: true, opacity: 0.25 }, shadow: false });
        this.gim.push({ glow, ring, kind: "vent", s });
      }
    if (g.kind === "shadow")
      for (const s of g.spots) {
        const m = part(R, "disc", [s.r, 36], 0x120e22, { p: [s.x, 0.04, s.z], o: { opacity: 0.55 }, shadow: false });
        const ring = part(R, "ring", [s.r - 0.08, s.r, 40], 0x9a6aff, { p: [s.x, 0.045, s.z], o: { flat: true, opacity: 0.6 }, shadow: false });
        const wisps = [0, 1, 2].map(() => part(R, "sphere", [0.5, 10, 8], 0x2a2048, { p: [s.x, 0.3, s.z], o: { opacity: 0.35 }, shadow: false }));
        this.gim.push({ m, ring, wisps, kind: "shadow", s });
      }
  }

  buildNest() {
    const n = this.world.nest;
    const g = group(this.root, { p: [n.x, 0, n.z] });
    // 돌 받침 (둥근 돌 테두리) + 금테
    part(g, "cyl", [1.38, 1.52, 0.22, 24], 0xa8a2b6, { p: [0, 0.11, 0] });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      part(g, "dodeca", [0.17, 0], i % 2 ? 0xb8b2c4 : 0x9a94a8, { p: [Math.cos(a) * 1.45, 0.14, Math.sin(a) * 1.45], s: [1.2, 0.8, 1] });
    }
    part(g, "torus", [1.3, 0.05, 6, 40], 0xffd34d, { p: [0, 0.24, 0], r: [Math.PI / 2, 0, 0], o: { emissive: 0xffb03a, ei: 0.5 } });
    const body = group(g, { p: [0, 0.22, 0] });
    // 나뭇가지 둥지 (엮인 고리 여러 겹 · 삐죽한 가지)
    part(body, "cyl", [1.0, 0.76, 0.5, 22], 0x8a5a32, { p: [0, 0.25, 0] });
    const twig = [0x9a6a3a, 0xb07a48, 0x8a5a32, 0xc48a54, 0x7a4a26];
    for (let i = 0; i < 5; i++) part(body, "torus", [0.98 - i * 0.035, 0.12 - i * 0.008, 7, 30], twig[i], { p: [0, 0.28 + i * 0.075, 0], r: [Math.PI / 2 + S(i * 2.1) * 0.06, S(i * 1.3) * 0.05, i * 0.7] });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      part(body, "cyl", [0.022, 0.032, 0.62, 5], 0x7a4a26, { p: [Math.cos(a) * 1.0, 0.5, Math.sin(a) * 1.0], r: [S(a * 3) * 0.6, a, Math.cos(a * 2) * 0.7], shadow: false });
    }
    part(body, "cyl", [0.82, 0.82, 0.06, 22], 0xd8b878, { p: [0, 0.6, 0] });
    // 알 (가운데 황금 알)
    for (const [x, z, c, k] of [[-0.36, -0.12, 0xfff6e8, 1], [0.34, -0.18, 0xfff0d0, 0.95], [0.02, 0.3, 0xffd34d, 1.15], [-0.1, -0.38, 0xffe8f0, 0.85]])
      part(body, "sphere", [0.24 * k, 18, 14], c, { p: [x, 0.78, z], s: [0.86, 1.08, 0.86], o: c === 0xffd34d ? { emissive: 0xffb03a, ei: 0.55 } : {} });
    // 떠 있는 보석 + 빛 고리
    const gem = part(body, "octa", [0.24, 0], 0xffe36a, { p: [0, 1.5, 0], o: { emissive: 0xffd34d, ei: 1.4 } });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffd34d, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(0, 0.05, 0);
    halo.userData.own = true;
    halo.userData.ownMat = true;
    g.add(halo);
    const sparks = [0, 1, 2, 3, 4].map(() => part(g, "octa", [0.06, 0], 0xfff6c0, { o: { flat: true }, shadow: false }));
    const shield = part(g, "sphere", [1.7, 24, 16], 0x8fe8ff, { p: [0, 0.7, 0], o: { opacity: 0.2, emissive: 0x5ad8ff, ei: 0.6 }, shadow: false });
    shield.visible = false;
    // 깃발
    const flag = group(g, { p: [1.15, 0.22, -0.75] });
    part(flag, "cyl", [0.035, 0.035, 1.9, 6], 0x8a5a2a, { p: [0, 0.95, 0] });
    part(flag, "sphere", [0.07, 8, 6], 0xffd34d, { p: [0, 1.92, 0] });
    const cloth = part(flag, "box", [0.6, 0.38, 0.03], 0xff5a6a, { p: [0.3, 1.6, 0] });
    part(cloth, "octa", [0.09, 0], 0xffd34d, { p: [0, 0, 0.03], shadow: false });
    flatten(body, [gem]);
    flatten(g, [body, cloth, shield]);
    this.anims.push((t) => {
      halo.material.opacity = 0.38 + S(t * 2) * 0.08;
      sparks.forEach((sp, i) => {
        const a = t * 0.9 + i * 1.256;
        sp.position.set(Math.cos(a) * 1.1, 1.2 + Math.sin(t * 2 + i) * 0.35, Math.sin(a) * 1.1);
        sp.rotation.y = t * 3;
      });
    });
    return { g, body, gem, shield, cloth, hitT: 0 };
  }

  update(t, dt, sim) {
    FX.time.value = t;
    if (this.T.waterMat) this.T.waterMat.uniforms.uTime.value = t;
    for (const c of this.clouds) {
      c.c.position.y = c.y0 + Math.sin(t * 0.3 + c.v * 10) * 0.3;
      c.c.rotation.y += dt * 0.01 * c.v;
    }
    for (const a of this.anims) a(t);
    const N = this.nest;
    N.gem.rotation.y = t * 1.2;
    N.gem.position.y = 1.5 + S(t * 2) * 0.1;
    N.cloth.rotation.y = S(t * 3) * 0.3;
    if (N.hitT > 0) {
      N.hitT -= dt;
      N.body.position.x = S(t * 60) * 0.06 * N.hitT * 3;
    } else N.body.position.x = 0;
    if (sim) {
      N.shield.visible = sim.nest.shield > 0;
      N.shield.scale.setScalar(0.92 + Math.min(1, sim.nest.shield / 10) * 0.18 + S(t * 3) * 0.02);
    }
    // 기믹 표시: 미리 표시 · 작동 중 빛
    for (const q of this.gim) {
      if (q.kind === "spore") {
        const on = sim && sim.zones.some((z) => z.kind === "spore" && Math.hypot(z.x - q.s.x, z.z - q.s.z) < 0.2);
        const warn = sim && sim.markers.some((m) => m.kind === "bloom" && Math.hypot(m.x - q.s.x, m.z - q.s.z) < 0.2);
        q.ring.material = mat(on ? 0xb4ff6a : 0xd6a2ff, { flat: true, opacity: on ? 0.9 : warn ? 0.4 + Math.abs(S(t * 8)) * 0.5 : 0.35 });
      }
      if (q.kind === "vent") {
        const warn = sim && sim.markers.some((m) => m.kind === "vent" && Math.hypot(m.x - q.s.x, m.z - q.s.z) < 0.2);
        q.glow.scale.setScalar(warn ? 1.5 + Math.abs(S(t * 12)) * 0.8 : 1 + S(t * 2) * 0.1);
        q.ring.material = mat(0xff6a1a, { flat: true, opacity: warn ? 0.4 + Math.abs(S(t * 10)) * 0.4 : 0.22 });
      }
      if (q.kind === "shadow") q.wisps.forEach((w, i) => w.position.set(q.s.x + S(t * 0.6 + i * 2) * q.s.r * 0.5, 0.35 + S(t + i) * 0.1, q.s.z + Math.cos(t * 0.5 + i * 2) * q.s.r * 0.5));
    }
  }
}

const shadeHex = (n, k) => new THREE.Color(n).multiplyScalar(k).getHex();

let cMat = null;
function cloudMat() {
  if (!cMat) {
    cMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35 });
    cMat.fog = true;
  }
  return cMat;
}

/* ---------------- 랜드마크 (월드의 상징 · 멀리서도 보이게 크게) ---------------- */
const LANDMARK = {
  /** 언덕 위 풍차 (날개가 천천히 돎) */
  windmill(g) {
    part(g, "cyl", [1.25, 1.6, 4.4, 12], 0xf4e6cc, { p: [0, 2.2, 0] });
    for (let i = 0; i < 3; i++) part(g, "torus", [1.42 - i * 0.12, 0.06, 6, 24], 0xc89a62, { p: [0, 0.9 + i * 1.3, 0], r: [Math.PI / 2, 0, 0] });
    part(g, "cone", [1.55, 1.7, 12], 0xe0605a, { p: [0, 5.25, 0] });
    part(g, "sphere", [0.16, 8, 6], 0xffd34d, { p: [0, 6.15, 0] });
    part(g, "box", [0.7, 1.0, 0.1], 0x8a5a32, { p: [0, 0.5, 1.5] });
    for (const [x, y] of [[0.55, 2.4], [-0.5, 3.4]]) part(g, "box", [0.42, 0.42, 0.1], 0x6ab8e8, { p: [x, y, 1.3], o: { emissive: 0x9ad8ff, ei: 0.2 } });
    const hub = group(g, { p: [0, 4.2, 1.45] });
    g.userData.keep = hub;
    part(hub, "cyl", [0.22, 0.22, 0.4, 10], 0x8a5a32, { r: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 4; i++) {
      const arm = group(hub, { r: [0, 0, (i * Math.PI) / 2] });
      part(arm, "box", [0.12, 2.6, 0.08], 0x9a6a3a, { p: [0, 1.4, 0.08] });
      part(arm, "box", [0.62, 2.1, 0.04], 0xfff8ec, { p: [0.36, 1.55, 0.1] });
    }
    return (t) => (hub.rotation.z = t * 0.55);
  },
  /** 큰 참나무 + 나무집 */
  oak(g, L) {
    part(g, "cyl", [0.42, 0.75, 3.2, 10], L.trunk, { p: [0, 1.6, 0] });
    for (const [a, l] of [[0.9, 1.6], [-1.0, 1.4], [2.6, 1.3]]) part(g, "cyl", [0.12, 0.24, l, 7], L.trunk, { p: [Math.sin(a) * 0.5, 2.9, Math.cos(a) * 0.5], r: [Math.cos(a) * 0.8, 0, -Math.sin(a) * 0.8] });
    for (const [x, y, z, r, c] of [[0, 4.6, 0, 2.0, 0], [1.6, 4.0, 0.6, 1.4, 1], [-1.5, 4.1, -0.4, 1.4, 2], [0.4, 3.9, 1.6, 1.2, 1], [-0.4, 5.6, -0.3, 1.2, 0]]) {
      const m = new THREE.Mesh(blob(r, 16, 0.28, 300 + x * 10), mat(L.foliage[c]));
      m.position.set(x, y, z);
      m.scale.set(1, 0.85, 1);
      m.castShadow = true;
      g.add(m);
    }
    const house = group(g, { p: [0.2, 2.9, 0.95] });
    part(house, "box", [1.1, 0.8, 0.9], 0xf0d8a8, { p: [0, 0.4, 0] });
    part(house, "cone", [0.9, 0.6, 4], 0xe0605a, { p: [0, 1.1, 0], r: [0, Math.PI / 4, 0] });
    part(house, "box", [0.32, 0.46, 0.05], 0x8a5a32, { p: [0, 0.25, 0.46] });
    part(house, "box", [1.4, 0.06, 1.2], 0x9a6a3a, { p: [0, -0.02, 0.1] });
    part(g, "box", [0.08, 2.9, 0.08], 0x9a6a3a, { p: [0.95, 1.45, 1.55] });
    for (let i = 0; i < 6; i++) part(g, "box", [0.36, 0.05, 0.06], 0xb07a48, { p: [0.95, 0.3 + i * 0.45, 1.6] });
    return null;
  },
  giantShroom(g) {
    part(g, "cyl", [0.7, 1.1, 5, 14], 0xf2e6d8, { p: [0, 2.5, 0] });
    part(g, "sphere", [3.2, 24, 14], 0x9a4ad8, { p: [0, 5.2, 0], s: [1, 0.48, 1] });
    for (let i = 0; i < 12; i++) part(g, "sphere", [0.26, 8, 6], 0xe8ff9a, { p: [Math.cos(i * 2.4) * (1 + (i % 3) * 0.6), 6.2 - (i % 3) * 0.25, Math.sin(i * 2.4) * (1 + (i % 3) * 0.6)], o: { emissive: 0xc8ff6a, ei: 1.2 }, shadow: false });
    return null;
  },
  iceSpire(g) {
    for (const [x, z, h, r] of [[0, 0, 7, 0.9], [1.2, 0.5, 4.5, 0.6], [-1.1, 0.3, 4, 0.55], [0.3, -1, 3.2, 0.5]]) part(g, "octa", [r, 0], 0xbfeaff, { p: [x, h * 0.45, z], s: [1, h * 0.9, 1], o: { emissive: 0x6ad8ff, ei: 0.35 } });
    return null;
  },
  volcano(g) {
    part(g, "cone", [5, 6, 14], 0x4a3432, { p: [0, 3, 0] });
    part(g, "cyl", [1.2, 1.4, 0.4, 12], 0xff6a1a, { p: [0, 5.85, 0], o: { emissive: 0xff4a1a, ei: 2 }, shadow: false });
    return null;
  },
  keep(g) {
    part(g, "box", [5, 7, 3.4], 0x2e2848, { p: [0, 3.5, 0] });
    for (const x of [-2.6, 2.6]) {
      part(g, "cyl", [1, 1.1, 10, 10], 0x2a2440, { p: [x, 5, 0] });
      part(g, "cone", [1.3, 2.4, 10], 0x5a3a7a, { p: [x, 11.2, 0] });
    }
    part(g, "box", [1.1, 1.5, 0.1], 0xff4ad8, { p: [0, 4.4, 1.75], o: { emissive: 0xff2ad8, ei: 1.4 } });
    return null;
  },
};
void geo;
void sph;
