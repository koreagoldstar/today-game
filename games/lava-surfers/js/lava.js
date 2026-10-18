/*
 * 용암 서핑 · 용암 추격
 *
 *  규칙 (실제 게임 상태):
 *   - 용암 앞머리 위치 lavaS (트랙 s 좌표). 거리 d = 주인공 s - lavaS
 *   - 용암 빠르기 = 이 구간을 깨끗하게 타는 보통 속도 × k
 *       · 거리가 기본 간격(D0)보다 멀면 조금 더 빨리 따라오고 (그래도 부스터 · 점프로 벌린 거리는 한동안 유지)
 *       · 가까우면 조금 느려진다(만회할 틈) → 그래도 장애물에 연달아 부딪히면 따라잡힌다
 *   - d < 22m 이면 위험 표시 · d ≤ 0 이면 따라잡힘 = 게임 오버
 *   - 마지막 절벽(lavaStop)에서는 용암이 절벽 아래로 쏟아져 더 오지 못한다
 *
 *  모양: 길을 가로지르는 거대한 용암 파도(앞이 말려 올라감 · 출렁) + 그 뒤로 길을 덮은 용암 + 연기 · 불티 · 빛
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { lavaTex, dotTex, puffTex } from "./tex.js?v=1";
import { PH } from "./player.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function keyed(list, s) {
  let cur = list[0];
  for (const k of list) if (s >= k.s) cur = k;
  return cur;
}

export class LavaChase {
  constructor(track, scene, course, { quality = 1 } = {}) {
    this.T = track;
    this.scene = scene;
    this.course = course;
    this.q = quality;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.lavaS = 0;
    this.v = 0;
    this.t = 0;
    this.buildFill();
    this.buildWave();
    this.reset(0);
  }
  /** 이 s 를 깨끗하게 탈 때의 보통 속도 (부스터 없이) */
  refSpeed(s) {
    return clamp(PH.base + PH.slopeK * this.T.slope(s), PH.minSpeed, PH.maxSpeed);
  }
  reset(lavaS) {
    this.lavaS = lavaS;
    this.v = this.refSpeed(Math.max(0, lavaS));
  }
  /** @returns {d, danger(0~1), caught} */
  update(dt, player, playing) {
    this.t += dt;
    const c = this.course;
    if (playing) {
      const ps = player.s;
      const L = keyed(c.lava, ps);
      const d = ps - this.lavaS;
      const ref = this.refSpeed(ps) * L.k;
      let v = d > L.gap ? ref + 0.15 * Math.min(40, d - L.gap) : ref - 0.06 * (L.gap - d);
      v = Math.max(8, v);
      this.v += (v - this.v) * Math.min(1, dt * 2);
      this.lavaS = Math.min(c.lavaStop, this.lavaS + this.v * dt);
    }
    const d = player.s - this.lavaS;
    this.d = d;
    this.updateVisual(dt);
    return { d, danger: clamp(1 - d / 22, 0, 1), caught: playing && d <= 0.3 && player.s < c.lavaStop };
  }

  /* ---------------- 길을 덮은 용암 (lavaS 까지만 보임) ---------------- */
  buildFill() {
    const T = this.T;
    const f = {};
    const P = [];
    const S = [];
    const U = [];
    const I = [];
    const COLS = 10;
    let r = 0;
    let prev = false;
    for (let s = 0; s <= T.len; s += 1.5) {
      const ok = !T.inGap(s);
      T.frame(s, f);
      const hw = T.halfWidth(s) + 0.4;
      for (let j = 0; j <= COLS; j++) {
        const u = -hw + (2 * hw * j) / COLS;
        const y = (ok ? f.y + T.bowl(s, u) + T.rampAdd(s) : T.lavaY(s)) + 0.45;
        P.push(f.x + f.rx * u, y, f.z + f.rz * u);
        S.push(s);
        U.push(u / 6, s / 6);
      }
      if (r > 0 && ok && prev) {
        const a = (r - 1) * (COLS + 1);
        const b = r * (COLS + 1);
        for (let j = 0; j < COLS; j++) I.push(a + j, a + j + 1, b + j, a + j + 1, b + j + 1, b + j);
      }
      prev = ok;
      r++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("aS", new THREE.Float32BufferAttribute(S, 1));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    const tex = lavaTex().clone();
    tex.needsUpdate = true;
    this.fillTex = tex;
    const front = (this.uFront = { value: 0 });
    const m = new THREE.MeshBasicMaterial({ map: tex, color: "#ffd0a0" });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFront = front;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aS; varying float vS;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvS = aS;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uFront; varying float vS;").replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vS > uFront) discard;");
    };
    // 같은 종류 재질과 셰이더를 나눠 쓰지 않게 (잘라내는 코드가 빠지지 않도록)
    m.customProgramCacheKey = () => "lava-fill-cut";
    this.fill = new THREE.Mesh(g, m);
    this.fill.frustumCulled = false;
    this.root.add(this.fill);
  }

  /* ---------------- 용암 파도 (길을 가로지르는 앞머리) ---------------- */
  buildWave() {
    // 단면 (앞뒤 거리, 높이, 밝기): 뒤쪽 완만한 등 → 마루 → 앞으로 말린 입술 → 입술 아래 오목한 앞면 → 앞 바닥(=lavaS)
    this.PROF = [
      [-14, 0, 0.35],
      [-10.5, 1.4, 0.4],
      [-7.5, 2.8, 0.5],
      [-5, 4.0, 0.62],
      [-3, 5.0, 0.75],
      [-1.4, 5.7, 0.88],
      [0.2, 6.0, 1],
      [1.6, 5.6, 1.1],
      [2.5, 4.7, 1.2],
      [2.3, 3.9, 1.05],
      [1.4, 3.7, 0.8],
      [0.6, 3.0, 0.75],
      [0.3, 1.9, 0.85],
      [0.5, 0.9, 0.95],
      [1.0, 0.1, 1.05],
    ];
    this.ROWS = this.PROF.length - 1;
    this.TIP = 8;
    this.COLS = this.q >= 0.9 ? 36 : 22;
    const n = (this.COLS + 1) * (this.ROWS + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const uv = [];
    const col = [];
    const I = [];
    const dark = new THREE.Color("#5a1c12");
    const mid = new THREE.Color("#ff7a2a");
    const hot = new THREE.Color("#fff2b0");
    const c = new THREE.Color();
    for (let j = 0; j <= this.COLS; j++) {
      let acc = 0;
      for (let i = 0; i <= this.ROWS; i++) {
        if (i > 0) acc += Math.hypot(this.PROF[i][0] - this.PROF[i - 1][0], this.PROF[i][1] - this.PROF[i - 1][1]);
        uv.push(j / 2.6, acc / 3.6);
        const k = this.PROF[i][2];
        if (k < 0.75) c.copy(dark).lerp(mid, (k - 0.35) / 0.4);
        else c.copy(mid).lerp(hot, clamp((k - 0.75) / 0.45, 0, 1));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < this.COLS; j++)
      for (let i = 0; i < this.ROWS; i++) {
        const a = j * (this.ROWS + 1) + i;
        const b = (j + 1) * (this.ROWS + 1) + i;
        I.push(a, b, a + 1, a + 1, b, b + 1);
      }
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(I);
    const tex = lavaTex().clone();
    tex.needsUpdate = true;
    this.waveTex = tex;
    this.wave = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, side: THREE.DoubleSide }));
    this.wave.frustumCulled = false;
    this.root.add(this.wave);
    // 입술 끝의 밝은 거품 줄
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((this.COLS + 1) * 2 * 3), 3));
    const ci = [];
    for (let j = 0; j < this.COLS; j++) ci.push(j * 2, j * 2 + 2, j * 2 + 1, j * 2 + 1, j * 2 + 2, j * 2 + 3);
    cg.setIndex(ci);
    this.crest = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: "#ffe9a0", transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.crest.frustumCulled = false;
    this.root.add(this.crest);
    // 빛 · 연기
    this.light = new THREE.PointLight("#ff6a2a", 70, 52, 1.6);
    this.root.add(this.light);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.scale.setScalar(40);
    this.root.add(this.glow);
    this.smoke = [];
    for (let i = 0; i < (this.q >= 0.9 ? 16 : 9); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: "#2a1a1e", transparent: true, opacity: 0.6, depthWrite: false }));
      s.userData.k = i / 16;
      s.userData.u = (Math.random() - 0.5) * 2;
      this.root.add(s);
      this.smoke.push(s);
    }
    // 마루에서 튀는 용암 방울
    const NB = this.q >= 0.9 ? 48 : 24;
    // 녹은 방울: 용암 무늬가 스스로 빛나고 조명에 둥글게 음영 (납작한 원판처럼 보이지 않게)
    const bt = lavaTex().clone();
    bt.needsUpdate = true;
    bt.repeat.set(0.5, 0.5);
    this.blobs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.22, 2), new THREE.MeshStandardMaterial({ color: "#5a1a0e", roughness: 0.35, emissive: "#ffffff", emissiveMap: bt, emissiveIntensity: 1.3 }), NB);
    this.blobs.frustumCulled = false;
    this.blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.blobs);
    this.blobP = [];
    for (let i = 0; i < NB; i++) this.blobP.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1 });
    this.m4 = new THREE.Matrix4();
  }
  updateVisual(dt) {
    const T = this.T;
    const t = this.t;
    const s0 = Math.max(0, this.lavaS);
    this.uFront.value = s0 - 3;
    this.fillTex.offset.y += dt * 0.12;
    this.fillTex.offset.x += dt * 0.02;
    this.waveTex.offset.y -= dt * 0.3;
    const f = {};
    T.frame(s0, f);
    const hw = T.halfWidth(s0) + 7;
    const p = this.wave.geometry.getAttribute("position");
    const cp = this.crest.geometry.getAttribute("position");
    const R = this.ROWS;
    for (let j = 0; j <= this.COLS; j++) {
      const u = -hw + (2 * hw * j) / this.COLS;
      const e = Math.abs(u) / hw;
      // 가운데가 조금 앞서고 가장자리는 벽을 타고 높게 · 출렁
      const lead = (1 - e * e) * 1.2;
      const wob = Math.sin(t * 2.2 + j * 0.7) * 0.5 + Math.sin(t * 3.7 - j * 1.3) * 0.3;
      const swell = 1 + Math.sin(t * 1.3 + j * 0.45) * 0.08 + e * 0.25;
      for (let i = 0; i <= R; i++) {
        const [dz, h] = this.PROF[i];
        const k = i / R;
        const s = s0 + dz + lead - 2.2 + wob * Math.min(1, h / 5) * 0.6;
        T.frame(Math.max(0, s), f);
        const surf = T.surfaceY(s, clamp(u, -T.halfWidth(s), T.halfWidth(s)));
        const base = surf == null ? T.lavaY(s) : surf;
        const y = base + h * swell + e * 1.2 + (k > 0.3 ? wob * 0.15 : 0);
        p.setXYZ(j * (R + 1) + i, f.x + f.rx * u, y, f.z + f.rz * u);
        if (i === this.TIP) {
          cp.setXYZ(j * 2, f.x + f.rx * u + f.tx * 0.15, y + 0.12, f.z + f.rz * u + f.tz * 0.15);
          cp.setXYZ(j * 2 + 1, f.x + f.rx * u - f.tx * 1.4, y + 1.0, f.z + f.rz * u - f.tz * 1.4);
        }
      }
    }
    p.needsUpdate = true;
    cp.needsUpdate = true;
    T.frame(s0, f);
    const top = (T.surfaceY(s0, 0) ?? T.lavaY(s0)) + 4;
    this.light.position.set(f.x + f.tx * 3, top, f.z + f.tz * 3);
    this.glow.position.set(f.x, top, f.z);
    for (const sm of this.smoke) {
      const k = (sm.userData.k + t * 0.25) % 1;
      sm.position.set(f.x + f.rx * sm.userData.u * hw * 0.8 - f.tx * 5 * k, top + 2 + k * 14, f.z + f.rz * sm.userData.u * hw * 0.8 - f.tz * 5 * k);
      sm.scale.setScalar(4 + k * 12);
      sm.material.opacity = 0.65 * Math.sin(k * Math.PI);
    }
    // 용암 방울: 입술에서 앞으로 튀어 떨어짐
    let spawn = dt * (this.q >= 0.9 ? 40 : 20);
    for (const b of this.blobP) {
      if (b.life <= 0) {
        if (spawn-- < Math.random()) continue;
        const u = (Math.random() * 2 - 1) * (hw - 6);
        b.x = f.x + f.rx * u + f.tx * 1.8;
        b.z = f.z + f.rz * u + f.tz * 1.8;
        b.y = top + 0.8 + Math.random();
        // 반은 파도보다 빨리 앞으로 날아감 (가까이 오면 주인공 머리 위로 튀는 게 보임)
        const fw = Math.random() < 0.5 ? this.v + 3 + Math.random() * 8 : 2 + Math.random() * 5;
        b.vx = f.tx * fw + (Math.random() - 0.5) * 2;
        b.vz = f.tz * fw + (Math.random() - 0.5) * 2;
        b.vy = 3 + Math.random() * 6;
        b.r = 0.5 + Math.random() * 1.1;
        b.floor = top - 6;
        b.life = 1.4;
      }
      b.life -= dt;
      b.vy -= 22 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      if (b.y < b.floor) b.life = 0;
    }
    for (let i = 0; i < this.blobP.length; i++) {
      const b = this.blobP[i];
      const sc = b.life > 0 ? b.r * Math.min(1, b.life * 2) : 0;
      this.m4.makeScale(sc, sc * 1.3, sc).setPosition(b.x, b.y, b.z);
      this.blobs.setMatrixAt(i, this.m4);
    }
    this.blobs.instanceMatrix.needsUpdate = true;
  }
  /** 파도 마루 가운데 (카메라 · 불티용) */
  crestPos(out = V()) {
    const f = this.T.frame(Math.max(0, this.lavaS), {});
    return out.set(f.x, (this.T.surfaceY(this.lavaS, 0) ?? this.T.lavaY(this.lavaS)) + 5, f.z);
  }
  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
