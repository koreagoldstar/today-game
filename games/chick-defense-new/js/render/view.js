/*
 * 시뮬레이션 상태 → 3D 장면 맞추기 (적 · 타워 · 투사체 · 구역 · 미리 표시 · 체력 막대 · 효과 · 피해 숫자)
 *  모든 임시 물체는 다시 쓰는 통(pool)에서 꺼내 쓰고 돌려놓는다 → 오래 해도 쌓이지 않음.
 *  공격 결과와 효과가 맞도록 시뮬레이션이 낸 일(events)로만 효과를 만든다.
 */
import { THREE, part, group, mat, geo, disposeOwn, mergeStatic } from "./kit.js";
import { Effects } from "./fx.js";
import { ringTex, discTex } from "./fxtex.js";
import { MODELS } from "./enemyModels.js";
import { buildTower } from "./towerModels.js";
import { tierOf } from "../sim/towers.js";
import { statsOf } from "../sim/towers.js";

const S = Math.sin;
const SIZE_K = 2.05; // 적 크기(size) → 모델 배율 (멀리서도 잘 보이게)
const TOWER_K = 1.14; // 타워 모델 배율

const ZONE_COL = { poison: 0x9cff5a, fire: 0xff6a1a, frost: 0xbfefff, spore: 0xd6a2ff, curse: 0xb46bff };
// 모델 합치기 전 시험 동작에 쓰는 상태들 (모델이 쓰는 상태 이름 전부)
const M_STATES = ["move", "absorb", "air", "arming", "armorUp", "blink", "burrow", "burrowWarn", "burstWarn", "charge", "chargeWarn", "defend", "emerge", "exposed", "frenzyWarn", "guard", "jumpWarn", "slamWarn", "stagger", "strikeWarn", "tired", "weak"];
const probeEnemy = (st, i) => ({ id: -1, x: 0, z: 0, y: 0, dx: 0, dz: 1, v: 1, size: 0.5, hp: 50, maxHp: 100, shield: i % 3 === 0 ? 5 : 0, flying: i % 4 === 1, hover: false, boss: false, elite: false, illusion: false, state: st, st: { slow: 1, zoneSlow: 1, frozenT: 0, stunT: 0, burnT: 0, onFire: false, vuln: 1 }, ab: { frenzy: i % 2 === 1, soulFeed: i % 3 }, b: { phase: 1 + (i % 3) }, mods: {}, def: {} });
// 맞았을 때 아주 잠깐 하얗게 (모든 적이 같이 씀)
const FLASH = new THREE.MeshBasicMaterial({ color: 0xfff6e8 });
const FIRE_COL = { arrow: 0xfff6dc, pierceArrow: 0xffe36a, iceShard: 0x8fe8ff, frostLob: 0xdff6ff, bomb: 0xffb03a, shell: 0xffd08a, scatter: 0xffd08a, chain: 0xfff27a, bolt: 0xfff27a };
const LOOK_COL = { spore: 0xb4ff6a, magma: 0xff6a1a, slam: 0xffd34d, quake: 0xffb35a, ice: 0x8fe8ff, frost: 0xbfefff, bomb: 0xffb03a, fire: 0xff5a1a, shock: 0xfff27a, shell: 0xd8c8b0, siege: 0xffe0a0, vent: 0xff6a1a, meteor: 0xff8a3a, rage: 0xff5a3a, snow: 0xdff6ff, curse: 0xb46bff };

export class View {
  constructor(stage, dom, settings) {
    this.st = stage;
    this.scene = stage.scene;
    this.dom = dom; // 피해 숫자 넣을 곳
    this.settings = settings;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.ens = new Map();
    this.pool = {};
    this.dying = [];
    this.tws = new Map();
    this.projM = new Map();
    this.projPool = {};
    this.zoneM = new Map();
    this.zonePool = [];
    this.markM = new Map();
    this.markPool = { ring: [], line: [] };
    this.lines = [];
    this.waves = [];
    this.t = 0;
    this.buildBars();
    this.buildParticles(Math.round(stage.q.particles * 0.35));
    this.fx = new Effects(this.root, stage.q.particles);
    this.buildHelpers();
    this.nums = [];
    this.numPool = [];
  }

  /* ---------------- 준비 ---------------- */
  buildBars() {
    const g = new THREE.PlaneGeometry(1, 1);
    const mk = (color, n, order) => {
      const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }), n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.renderOrder = order;
      m.count = 0;
      this.root.add(m);
      return m;
    };
    this.barBg = mk(0x1b1b2a, 220, 10);
    this.barFg = mk(0xffffff, 220, 11);
    this.barSh = mk(0x7fe3ff, 220, 12);
    this.barFg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(220 * 3), 3);
  }
  buildParticles(n) {
    this.pN = n;
    const m = new THREE.InstancedMesh(geo("ico", 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    m.frustumCulled = false;
    m.count = 0;
    this.root.add(m);
    this.pMesh = m;
    this.parts = [];
  }
  buildHelpers() {
    // 선택한 타워 사거리 · 설치 미리 보기
    this.rangeRing = part(this.root, "ring", [0.97, 1, 64], 0xffffff, { o: { flat: true, opacity: 0.85 }, shadow: false });
    this.rangeFill = part(this.root, "disc", [1, 64], 0xffffff, { o: { flat: true, opacity: 0.12 }, shadow: false });
    this.rangeRing.visible = this.rangeFill.visible = false;
    this.cellHi = part(this.root, "box", [0.96, 0.04, 0.96], 0x5aff8a, { o: { flat: true, opacity: 0.55 }, shadow: false });
    this.cellHi.visible = false;
    this.selRing = part(this.root, "ring", [0.5, 0.6, 32], 0xffd34d, { o: { flat: true, opacity: 0.9 }, shadow: false });
    this.selRing.visible = false;
    this.ghost = null;
    this.ghostKey = "";
    // 설치 칸 격자
    this.gridMesh = null;
  }
  setGrid(map) {
    if (this.gridMesh) {
      this.root.remove(this.gridMesh);
      this.gridMesh.dispose();
    }
    const cells = [];
    for (let z = 0; z < map.d; z++) for (let x = 0; x < map.w; x++) if (map.buildable(x, z)) cells.push([x, z]);
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }), cells.length);
    const M = new THREE.Matrix4();
    cells.forEach(([x, z], i) => {
      M.makeTranslation(x + 0.5, 0.04 + map.height(x, z), z + 0.5);
      m.setMatrixAt(i, M);
    });
    m.visible = false;
    this.root.add(m);
    this.gridMesh = m;
  }

  /* ---------------- 적 ---------------- */
  acquire(type) {
    const list = this.pool[type] || (this.pool[type] = []);
    if (list.length) return list.pop();
    const root = new THREE.Group();
    const inner = new THREE.Group();
    root.add(inner);
    const anim = (MODELS[type] || MODELS.slime)(inner);
    // 움직이지 않는 부품은 묶음마다 한 덩어리로 (그리기 횟수 크게 줄임 · 동작은 그대로)
    mergeStatic(inner, (i) => {
      const st = M_STATES[i % M_STATES.length];
      const on = i % 2 === 1;
      const t = 0.11 + i * 0.37;
      anim({ t, dt: 0.016, e: probeEnemy(st, i), state: st, k: t * 2.3, m: { healT: on ? 0.3 : 0, castT: on ? 0.5 : 0, pulseT: on ? 0.4 : 0, vineT: on ? 0.5 : 0, blockT: on ? 0.2 : 0 } });
    }, M_STATES.length * 3);
    try {
      anim({ t: 0, dt: 0.016, e: probeEnemy("move", 0), state: "move", k: 0, m: {} });
    } catch (_) {
      /* 기본 자세로 못 돌려도 다음 프레임에 실제 상태로 맞춰짐 */
    }
    // 땅 그림자 (날면 작게) · 엘리트 고리 · 상태 표시
    const blob = part(root, "disc", [0.42, 20], 0x101018, { p: [0, 0.03, 0], o: { flat: true, opacity: 0.28 }, shadow: false });
    const elite = part(root, "ring", [0.46, 0.56, 28], 0xffd34d, { p: [0, 0.05, 0], o: { flat: true, opacity: 0.9 }, shadow: false });
    const slow = part(root, "ring", [0.34, 0.42, 24], 0x8fe8ff, { p: [0, 0.06, 0], o: { flat: true, opacity: 0.8 }, shadow: false });
    const ice = part(root, "box", [0.9, 0.9, 0.9], 0xbfefff, { p: [0, 0.45, 0], o: { opacity: 0.45, emissive: 0x8fe8ff, ei: 0.4 }, shadow: false });
    const stun = group(root, { p: [0, 1.25, 0] });
    for (let i = 0; i < 3; i++) part(stun, "octa", [0.07, 0], 0xffe36a, { p: [S(i * 2.1) * 0.22, 0, Math.cos(i * 2.1) * 0.22], o: { flat: true }, shadow: false });
    const burn = part(root, "cone", [0.14, 0.4, 6], 0xff7a1a, { p: [0.18, 0.75, 0], o: { emissive: 0xff5a1a, ei: 1.4, opacity: 0.85 }, shadow: false });
    const shield = part(root, "sphere", [0.62, 16, 12], 0x7fe3ff, { p: [0, 0.5, 0], o: { opacity: 0.22, emissive: 0x7fe3ff, ei: 0.6 }, shadow: false });
    // 맞았을 때 하얗게 바꿀 부품 (윤곽선 · 반투명은 빼고)
    const meshes = [];
    inner.traverse((o) => {
      if (o.isMesh && o.name !== "outline" && !(o.material.transparent && o.material.opacity < 0.7)) {
        o.userData.m0 = o.material;
        meshes.push(o);
      }
    });
    return { type, root, inner, anim, blob, elite, slow, ice, stun, burn, shield, meshes, m: {} };
  }
  setFlash(v, on) {
    if (v.flashOn === on) return;
    v.flashOn = on;
    for (const o of v.meshes) o.material = on ? FLASH : o.userData.m0;
  }
  release(v) {
    this.root.remove(v.root);
    this.setFlash(v, false);
    v.flashT = 0;
    v.knock = 0;
    v.inner.rotation.set(0, 0, 0);
    v.inner.position.set(0, 0, 0);
    v.ry = null;
    v.lean = 0;
    v.leak = false;
    v.m = {};
    (this.pool[v.type] || (this.pool[v.type] = [])).push(v);
  }
  syncEnemies(sim, dt) {
    const seen = new Set();
    let n = 0;
    const camQ = this.st.camera.quaternion;
    const M = new THREE.Matrix4();
    const P = new THREE.Vector3();
    const Sc = new THREE.Vector3();
    const col = new THREE.Color();
    for (const e of sim.enemies) {
      seen.add(e.id);
      let v = this.ens.get(e.id);
      if (!v) {
        v = this.acquire(e.type);
        v.m = { born: 0 };
        this.root.add(v.root);
        this.ens.set(e.id, v);
        v.k = Math.random() * 6;
      }
      const sc = e.size * SIZE_K;
      v.m.born = Math.min(1, (v.m.born || 0) + dt * 4);
      v.inner.scale.setScalar(sc * (0.4 + 0.6 * v.m.born));
      v.root.position.set(e.x, (e.boss && e.flying ? 0.6 : 0) + (e.hover ? 0.3 : 0), e.z);
      if (e.flying && !e.boss && e.type !== "frostBat") v.inner.position.y = 0.55;
      else v.inner.position.y = e.flying && e.type === "frostBat" ? 0.4 : 0;
      // 꺾이는 곳에서 몸이 확 돌지 않고 부드럽게 돌아감
      const yaw = Math.atan2(e.dx, e.dz);
      v.ry = v.ry == null || v.m.born < 0.3 ? yaw : v.ry + angDiff(v.ry, yaw) * Math.min(1, dt * 9);
      v.root.rotation.y = v.ry;
      v.k += (e.v || 0) * dt * 5.2 / Math.max(0.35, sc);
      for (const k of ["healT", "castT", "pulseT", "vineT", "blockT"]) if (v.m[k] > 0) v.m[k] -= dt;
      v.anim({ t: this.t, dt, e, state: e.state, k: v.k, m: v.m });
      // 맞으면: 아주 잠깐 하얗게 · 살짝 눌렸다 펴짐 · 뒤로 젖혀짐
      if (v.flashT > 0) v.flashT -= dt;
      this.setFlash(v, v.flashT > 0);
      if (e.hitT > 0) {
        const h = e.hitT * 0.9;
        v.inner.scale.set(v.inner.scale.x * (1 + h), v.inner.scale.y * (1 - h * 0.6), v.inner.scale.z * (1 + h));
      }
      v.knock = Math.max(0, (v.knock || 0) - dt * 6);
      v.inner.rotation.x = -v.knock * 0.32;
      // 걷는 몸이 진행 방향 바뀔 때 안쪽으로 살짝 기울기
      const turn = angDiff(v.ry, yaw);
      v.lean = (v.lean || 0) * 0.85 + Math.max(-0.22, Math.min(0.22, turn * 0.35)) * 0.15;
      v.inner.rotation.z = e.flying ? -v.lean * 1.5 : -v.lean;
      v.blob.scale.setScalar(sc * (e.flying ? 0.6 : 1));
      v.blob.visible = !e.illusion;
      v.elite.visible = e.elite;
      v.elite.scale.setScalar(sc * 0.9);
      v.elite.rotation.y = this.t * 2;
      const slowed = e.st.slow < 0.99 || e.st.zoneSlow < 0.99;
      v.slow.visible = slowed && !e.st.onFire;
      v.slow.scale.setScalar(sc);
      v.ice.visible = e.st.frozenT > 0 && !e.st.onFire;
      v.ice.scale.setScalar(sc * 0.95);
      v.stun.visible = e.st.stunT > 0;
      v.stun.rotation.y = this.t * 6;
      v.stun.position.y = sc * 0.95;
      v.burn.visible = e.st.burnT > 0;
      v.burn.scale.set(sc, sc * (0.8 + Math.abs(S(this.t * 20)) * 0.4), sc);
      const ownBubble = e.type === "fireBoar" || e.boss;
      v.shield.visible = e.shield > 0 && !ownBubble;
      v.shield.scale.setScalar(sc * 0.9);
      v.root.visible = !(e.mods.untargetable && e.type === "snowShade" && S(this.t * 60) < 0);
      // 체력 막대 (다치거나 보호막 · 엘리트일 때) — 보스는 화면 위 큰 막대
      if (!e.boss && !e.illusion && (e.hp < e.maxHp || e.shield > 0 || e.elite) && n < 220 && !(e.state === "burrow")) {
        const y = (e.flying ? 1.55 : 0.25) + sc * 1.05;
        const w = Math.max(0.45, sc * 0.75);
        P.set(e.x, y, e.z);
        Sc.set(w + 0.06, 0.11, 1);
        M.compose(P, camQ, Sc);
        this.barBg.setMatrixAt(n, M);
        const f = Math.max(0, e.hp / e.maxHp);
        // 왼쪽 정렬: 카메라 기준 오른쪽 방향으로 밀기
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
        P.addScaledVector(right, -(w * (1 - f)) / 2);
        Sc.set(w * f, 0.07, 1);
        M.compose(P, camQ, Sc);
        this.barFg.setMatrixAt(n, M);
        col.setHSL(0.33 * f, 0.85, 0.5);
        this.barFg.setColorAt(n, col);
        const sf = Math.min(1, e.shield / e.maxHp);
        P.set(e.x, y + 0.1, e.z).addScaledVector(right, -(w * (1 - sf)) / 2);
        Sc.set(w * sf, sf > 0 ? 0.05 : 0.0001, 1);
        M.compose(P, camQ, Sc);
        this.barSh.setMatrixAt(n, M);
        n++;
      }
    }
    this.barBg.count = this.barFg.count = this.barSh.count = n;
    this.barBg.instanceMatrix.needsUpdate = this.barFg.instanceMatrix.needsUpdate = this.barSh.instanceMatrix.needsUpdate = true;
    if (this.barFg.instanceColor) this.barFg.instanceColor.needsUpdate = true;
    // 사라진 적: 쓰러짐 연출 뒤 통으로
    for (const [id, v] of this.ens) {
      if (seen.has(id)) continue;
      this.ens.delete(id);
      v.dieT = 0;
      v.s0 = v.inner.scale.x;
      this.setFlash(v, !v.leak);
      this.dying.push(v);
    }
    // 쓰러짐: 납작하게 눌렸다가 연기와 함께 사라짐 (둥지에 닿은 적은 작아지며 가라앉음)
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const v = this.dying[i];
      v.dieT += dt;
      const k = Math.min(1, v.dieT / 0.24);
      if (v.leak) {
        v.inner.scale.setScalar(v.s0 * (1 - k));
        v.inner.position.y -= dt * 1.2;
      } else {
        if (v.dieT > 0.05) this.setFlash(v, false);
        const e = k < 0.45 ? k / 0.45 : 1;
        const sq = k < 0.45 ? 1 : Math.max(0.01, 1 - (k - 0.45) / 0.55);
        v.inner.scale.set(v.s0 * (1 + e * 0.45) * sq, v.s0 * (1 - e * 0.6) * sq, v.s0 * (1 + e * 0.45) * sq);
        v.inner.rotation.x = -e * 0.4;
      }
      if (k >= 1) {
        this.dying.splice(i, 1);
        this.release(v);
      }
    }
  }

  /* ---------------- 타워 ---------------- */
  syncTowers(sim, dt, selId) {
    const seen = new Set();
    for (const t of sim.towers) {
      seen.add(t.id);
      const tier = tierOf(t);
      const key = `${t.type}|${tier}|${t.evo || ""}`;
      let v = this.tws.get(t.id);
      if (!v || v.key !== key) {
        if (v) {
          this.root.remove(v.root);
          disposeOwn(v.root);
        }
        const root = new THREE.Group();
        const m = buildTower(root, t.type, tier, t.evo);
        // 움직이지 않는 부품 합치기 (쏠 때 · 기절 · 겨누기를 미리 돌려 보고 움직이는 부품은 남김)
        mergeStatic(root, (i) => m.anim({ t: 0.1 + i * 0.29, dt: 0.016, since: [0, 0.05, 0.1, 0.2, 0.4, 9][i % 6], yaw: i * 0.7, stun: i % 5 === 4 }), 30);
        m.anim({ t: 0, dt: 0.016, since: 9, yaw: 0, stun: false });
        root.position.set(t.x, t.y, t.z);
        this.root.add(root);
        const icons = group(root, { p: [0, 1.45, 0] });
        const ic = {};
        ic.stun = group(icons);
        for (let i = 0; i < 3; i++) part(ic.stun, "octa", [0.08, 0], 0xffe36a, { p: [S(i * 2.1) * 0.25, 0, Math.cos(i * 2.1) * 0.25], o: { flat: true }, shadow: false });
        ic.vine = part(icons, "torus", [0.3, 0.05, 6, 16], 0x3d8a2c, { r: [Math.PI / 2, 0, 0], p: [0, -0.9, 0], shadow: false });
        ic.frost = part(icons, "octa", [0.12, 0], 0x8fe8ff, { p: [0.28, 0, 0], o: { emissive: 0x4ad8ff, ei: 1 }, shadow: false });
        ic.curse = part(icons, "sphere", [0.1, 8, 6], 0xb46bff, { p: [-0.28, 0, 0], o: { emissive: 0x9a3aff, ei: 1.3 }, shadow: false });
        ic.heat = part(icons, "cone", [0.08, 0.22, 6], 0xff6a1a, { p: [0, 0.05, 0.28], o: { emissive: 0xff4a1a, ei: 1.4 }, shadow: false });
        ic.buff = part(root, "ring", [0.46, 0.52, 28], 0x5aff8a, { p: [0, 0.28, 0], o: { flat: true, opacity: 0.6 }, shadow: false });
        const old = v;
        v = { root, anim: m.anim, key, icons: ic, appear: old ? 0.01 : 0.01 };
        this.tws.set(t.id, v);
        if (old) this.burst(t.x, 0.8, t.z, 26, 0xffe36a, 3, 0.09, 4);
      }
      v.appear = Math.min(1, v.appear + dt * 3.5);
      const a = v.appear;
      v.root.scale.setScalar(TOWER_K * (a < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - a, 3)) + S(a * Math.PI) * 0.15 : 1));
      const yaw = Math.atan2(t.aimX - t.x, t.aimZ - t.z);
      v.yaw = v.yaw == null ? yaw : v.yaw + angDiff(v.yaw, yaw) * Math.min(1, dt * 12);
      v.anim({ t: this.t, dt, since: sim.t - t.fireT, yaw: v.yaw, stun: t.stunT > 0 });
      const ic = v.icons;
      ic.stun.visible = t.stunT > 0;
      ic.stun.rotation.y = this.t * 6;
      ic.vine.visible = !!t.deb.vine;
      ic.vine.rotation.z = this.t * 3;
      ic.frost.visible = !!t.deb.frost;
      ic.curse.visible = !!t.deb.curse || t.zoneDmg < 1;
      ic.heat.visible = !!t.deb.heat || t.zoneRate < 1;
      ic.buff.visible = t.buffRate > 0;
      ic.buff.rotation.y = this.t;
    }
    for (const [id, v] of this.tws) {
      if (seen.has(id)) continue;
      this.root.remove(v.root);
      disposeOwn(v.root);
      this.tws.delete(id);
    }
    // 선택 표시 · 사거리
    const sel = selId != null ? sim.tower(selId) : null;
    if (sel) {
      const s = statsOf(sim, sel);
      this.showRange(sel.x, sel.z, s.range, sel.type === "healer" ? 0x5aff8a : 0xffffff);
      this.selRing.visible = true;
      this.selRing.position.set(sel.x, 0.3 + sel.y, sel.z);
      this.selRing.scale.setScalar(1 + S(this.t * 5) * 0.06);
    } else if (!this.ghostOn) {
      this.rangeRing.visible = this.rangeFill.visible = false;
      this.selRing.visible = false;
    } else this.selRing.visible = false;
  }
  showRange(x, z, r, color) {
    this.rangeRing.visible = this.rangeFill.visible = true;
    this.rangeRing.position.set(x, 0.06, z);
    this.rangeFill.position.set(x, 0.05, z);
    this.rangeRing.scale.setScalar(r);
    this.rangeFill.scale.setScalar(r);
    this.rangeRing.material = mat(color, { flat: true, opacity: 0.85 });
  }
  /** 설치 미리 보기 (칸 · 유령 타워 · 사거리) */
  setGhost(type, cx, cz, ok, range, map) {
    this.ghostOn = !!type;
    if (this.gridMesh) this.gridMesh.visible = !!type;
    if (!type || cx == null) {
      this.cellHi.visible = false;
      if (this.ghost) this.ghost.visible = false;
      if (!type) this.rangeRing.visible = this.rangeFill.visible = false;
      return;
    }
    const y = map.height(cx, cz);
    this.cellHi.visible = true;
    this.cellHi.position.set(cx + 0.5, 0.05 + y, cz + 0.5);
    this.cellHi.material = mat(ok ? 0x5aff8a : 0xff5a6a, { flat: true, opacity: 0.55 });
    if (this.ghostKey !== type) {
      if (this.ghost) {
        this.root.remove(this.ghost);
        disposeOwn(this.ghost);
      }
      this.ghost = new THREE.Group();
      buildTower(this.ghost, type, 0, null);
      this.ghost.scale.setScalar(TOWER_K);
      this.ghost.traverse((o) => {
        if (o.name === "outline") o.visible = false;
        if (o.isMesh) {
          o.material = mat(0xffffff, { opacity: 0.45, emissive: 0xffffff, ei: 0.2 });
          o.castShadow = false;
        }
      });
      this.root.add(this.ghost);
      this.ghostKey = type;
    }
    this.ghost.visible = true;
    this.ghost.position.set(cx + 0.5, y, cz + 0.5);
    this.showRange(cx + 0.5, cz + 0.5, range, ok ? 0xffffff : 0xff5a6a);
  }

  /* ---------------- 투사체 ---------------- */
  projMesh(kind) {
    const list = this.projPool[kind] || (this.projPool[kind] = []);
    if (list.length) return list.pop();
    const g = new THREE.Group();
    switch (kind) {
      case "arrow":
        part(g, "cyl", [0.018, 0.018, 0.4, 5], 0xfff1dc, { r: [Math.PI / 2, 0, 0], shadow: false });
        part(g, "cone", [0.04, 0.1, 5], 0x9aa3b8, { p: [0, 0, 0.22], r: [Math.PI / 2, 0, 0], shadow: false });
        break;
      case "pierceArrow":
        part(g, "cyl", [0.03, 0.03, 0.7, 6], 0xffe36a, { r: [Math.PI / 2, 0, 0], o: { emissive: 0xffb03a, ei: 1 }, shadow: false });
        part(g, "cone", [0.08, 0.2, 6], 0xffffff, { p: [0, 0, 0.42], r: [Math.PI / 2, 0, 0], o: { emissive: 0xffe36a, ei: 1 }, shadow: false });
        break;
      case "iceShard":
        part(g, "octa", [0.1, 0], 0xbfefff, { s: [0.6, 0.6, 1.6], o: { emissive: 0x4ad8ff, ei: 1.2 }, shadow: false });
        break;
      case "bomb":
        part(g, "sphere", [0.14, 10, 8], 0x2a2a2a, { shadow: false });
        part(g, "sphere", [0.05, 6, 4], 0xffd34d, { p: [0, 0.15, 0], o: { emissive: 0xffb03a, ei: 2 }, shadow: false });
        break;
      case "shell":
        part(g, "sphere", [0.13, 10, 8], 0x3a3a4a, { shadow: false });
        break;
      case "frostLob":
        part(g, "sphere", [0.16, 10, 8], 0xf4fbff, { o: { emissive: 0xbfefff, ei: 0.5 }, shadow: false });
        break;
    }
    return g;
  }
  syncProjectiles(sim) {
    const seen = new Set();
    for (const p of sim.projs) {
      seen.add(p.id);
      let m = this.projM.get(p.id);
      if (!m) {
        m = this.projMesh(p.kind);
        m.userData.kind = p.kind;
        this.root.add(m);
        this.projM.set(p.id, m);
        m.position.set(p.x, p.y, p.z);
      }
      const dx = p.x - m.position.x;
      const dy = p.y - m.position.y;
      const dz = p.z - m.position.z;
      if (dx * dx + dy * dy + dz * dz > 1e-6) m.lookAt(m.position.x + dx * 10, m.position.y + dy * 10, m.position.z + dz * 10);
      m.position.set(p.x, p.y, p.z);
      if (p.kind === "bomb" || p.kind === "shell") m.rotation.x += 0.3;
      // 날아가는 꼬리 (2프레임마다)
      const tr = (m.userData.tr = (m.userData.tr || 0) + 1);
      if (tr % 2 === 0) {
        const k = p.kind;
        if (k === "bomb" || k === "shell") {
          this.fx.trail(p.x, p.y, p.z, 0xeae4da, 0.3, 0.5, true);
          if (k === "bomb") this.fx.trail(p.x, p.y + 0.12, p.z, 0xffb03a, 0.16, 0.15);
        } else if (k === "iceShard") this.fx.trail(p.x, p.y, p.z, 0x8fe8ff, 0.22, 0.22);
        else if (k === "frostLob") this.fx.trail(p.x, p.y, p.z, 0xe6f8ff, 0.3, 0.35, true);
        else if (k === "pierceArrow") this.fx.trail(p.x, p.y, p.z, 0xffe36a, 0.24, 0.2);
        else this.fx.trail(p.x, p.y, p.z, 0xfff6dc, 0.1, 0.12);
      }
    }
    for (const [id, m] of this.projM) {
      if (seen.has(id)) continue;
      this.root.remove(m);
      this.projM.delete(id);
      (this.projPool[m.userData.kind] || (this.projPool[m.userData.kind] = [])).push(m);
    }
  }

  /* ---------------- 구역 · 미리 표시 ---------------- */
  syncZones(sim) {
    const seen = new Set();
    for (const z of sim.zones) {
      seen.add(z.id);
      let v = this.zoneM.get(z.id);
      if (!v) {
        v = this.zonePool.pop() || { disc: part(this.root, "disc", [1, 36], 0xffffff, { o: { flat: true, opacity: 0.35 }, shadow: false }), ring: part(this.root, "ring", [0.92, 1, 36], 0xffffff, { o: { flat: true, opacity: 0.8 }, shadow: false }) };
        this.root.add(v.disc, v.ring);
        this.zoneM.set(z.id, v);
      }
      const c = ZONE_COL[z.kind] || 0xffffff;
      const life = z.t / z.dur;
      const fade = Math.min(1, z.t * 4) * Math.min(1, (1 - life) * 4);
      v.disc.material = mat(c, { flat: true, opacity: Math.round(fade * 6) / 20 });
      v.ring.material = mat(c, { flat: true, opacity: Math.round(fade * 8) / 10 });
      v.disc.position.set(z.x, 0.045 + (z.kind === "frost" ? 0.002 : 0), z.z);
      v.ring.position.set(z.x, 0.05, z.z);
      const pulse = 1 + S(this.t * 4 + z.id) * 0.04;
      v.disc.scale.setScalar(z.r * pulse);
      v.ring.scale.setScalar(z.r * pulse);
      if (Math.random() < 0.06 && this.pCount() < this.pN * 0.7) this.burst(z.x + (Math.random() - 0.5) * z.r, 0.1, z.z + (Math.random() - 0.5) * z.r, 1, c, 0.6, 0.07, -1.2);
    }
    for (const [id, v] of this.zoneM) {
      if (seen.has(id)) continue;
      this.root.remove(v.disc, v.ring);
      this.zoneM.delete(id);
      this.zonePool.push(v);
    }
  }
  syncMarkers(sim) {
    const seen = new Set();
    for (const m of sim.markers) {
      if (m.kind === "bloom" || m.kind === "vent") continue;
      seen.add(m.id);
      let v = this.markM.get(m.id);
      const kind = m.kind === "line" ? "line" : "ring";
      if (!v) {
        v = this.markPool[kind].pop();
        if (!v) {
          if (kind === "line") v = { kind, bar: part(this.root, "box", [1, 0.03, 1], 0xffffff, { o: { flat: true, opacity: 0.5 }, shadow: false }), fill: part(this.root, "box", [1, 0.035, 1], 0xffffff, { o: { flat: true, opacity: 0.7 }, shadow: false }) };
          else v = { kind, ring: softPlane(ringTex(), 2.2), fill: softPlane(discTex(), 2) };
        }
        for (const o of Object.values(v)) if (o && o.isObject3D) this.root.add(o);
        this.markM.set(m.id, v);
      }
      const k = Math.min(1, m.t / m.dur);
      const blink = 0.55 + Math.abs(S(this.t * (6 + k * 14))) * 0.45;
      if (kind === "line") {
        const dx = m.x2 - m.x;
        const dz = m.z2 - m.z;
        const L = Math.hypot(dx, dz) || 0.01;
        const yaw = Math.atan2(dx, dz);
        v.bar.position.set((m.x + m.x2) / 2, 0.06, (m.z + m.z2) / 2);
        v.bar.rotation.set(0, yaw, 0);
        v.bar.scale.set(m.r * 2, 1, L);
        v.bar.material = mat(m.color, { flat: true, opacity: Math.round(blink * 5) / 10 });
        v.fill.position.set(m.x + (dx * k) / 2, 0.065, m.z + (dz * k) / 2);
        v.fill.rotation.set(0, yaw, 0);
        v.fill.scale.set(m.r * 2, 1, Math.max(0.01, L * k));
        v.fill.material = mat(m.color, { flat: true, opacity: 0.7 });
      } else {
        const r = m.kind === "storm" ? 2.6 : m.kind === "bolt" ? m.r : m.r;
        v.ring.position.set(m.x, 0.07, m.z);
        v.ring.scale.setScalar(r);
        v.ring.material.color.set(m.color);
        v.ring.material.opacity = blink;
        v.fill.position.set(m.x, 0.065, m.z);
        v.fill.scale.setScalar(Math.max(0.01, r * k));
        v.fill.material.color.set(m.color);
        v.fill.material.opacity = 0.22 + k * 0.25;
      }
    }
    for (const [id, v] of this.markM) {
      if (seen.has(id)) continue;
      for (const o of Object.values(v)) if (o && o.isObject3D) this.root.remove(o);
      this.markM.delete(id);
      this.markPool[v.kind].push(v);
    }
  }

  /* ---------------- 효과 ---------------- */
  pCount() {
    return this.parts.length;
  }
  burst(x, y, z, n, color, speed = 2, size = 0.08, g = 6) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= this.pN) break;
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = speed * (0.4 + Math.random() * 0.8);
      const r = Math.sqrt(1 - u * u);
      this.parts.push({ x, y, z, vx: Math.cos(a) * r * s, vy: Math.abs(u) * s + speed * 0.3, vz: Math.sin(a) * r * s, t: 0, life: 0.45 + Math.random() * 0.4, size: size * (0.6 + Math.random() * 0.8), c, g });
    }
  }
  shockwave(x, z, r, color) {
    this.fx.ring(x, z, r, color);
  }
  lightning(pts, color = 0x9ad8ff, width = 0.13) {
    this.fx.bolt(pts, color, width);
  }
  /** 피해 숫자 (HTML · 통에서 꺼내 씀 · 최대 개수 제한) */
  number(x, y, z, text, cls) {
    if (!this.settings.dmgNums || this.nums.length > 28) return;
    const el = this.numPool.pop() || document.createElement("span");
    el.className = "dmg " + (cls || "");
    el.textContent = text;
    this.dom.appendChild(el);
    this.nums.push({ el, x, y, z, t: 0, life: 0.8, dx: (Math.random() - 0.5) * 0.3 });
  }
  updateFx(dt) {
    const r = this.st.renderer;
    this.fx.setView(this.st.camera, r.domElement.height || 600);
    this.fx.update(dt, this.st.camera);
    // 알갱이 (부서지는 조각)
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const P = new THREE.Vector3();
    const Sc = new THREE.Vector3();
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.03, p.y + p.vy * dt);
      p.z += p.vz * dt;
      const k = 1 - p.t / p.life;
      P.set(p.x, p.y, p.z);
      Sc.setScalar(p.size * (0.4 + 0.6 * k));
      M.compose(P, Q, Sc);
      this.pMesh.setMatrixAt(n, M);
      this.pMesh.setColorAt(n, p.c);
      n++;
    }
    this.pMesh.count = n;
    this.pMesh.instanceMatrix.needsUpdate = true;
    if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
    for (const w of this.waves) {
      if (!w.on) continue;
      w.t += dt;
      const k = w.t / 0.45;
      if (k >= 1) {
        w.on = false;
        w.m.visible = false;
        continue;
      }
      w.m.scale.setScalar(Math.max(0.05, w.r * (0.2 + 0.8 * k)));
      w.m.material = mat(w.color, { flat: true, opacity: Math.round((1 - k) * 10) / 10 });
    }
    for (const L of this.lines) {
      if (!L.on) continue;
      L.t += dt;
      if (L.t > 0.16) {
        L.on = false;
        L.line.visible = L.glow.visible = false;
      }
    }
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const q = this.nums[i];
      q.t += dt;
      if (q.t >= q.life) {
        q.el.remove();
        this.numPool.push(q.el);
        this.nums.splice(i, 1);
        continue;
      }
      const s = this.st.project(q.x + q.dx * q.t, q.y + q.t * 0.9, q.z);
      q.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.25 - q.t) * 2})`;
      q.el.style.opacity = String(Math.min(1, (q.life - q.t) * 4));
    }
  }

  /**
   * 시뮬레이션이 낸 일 → 효과 (공격 결과와 같은 자리 · 같은 순간)
   *  타격 순간: 하얀 번쩍 · 튀는 빛 · 눌림 / 처치: 납작 → 연기 · 별 · 금화 / 폭발: 빛 덩이 · 충격파 · 연기 · 그을음
   */
  handle(ev, sim) {
    const fx = this.fx;
    const E = (id) => sim.byIdMap.get(id) || null;
    const T = (id) => sim.tower(id);
    switch (ev.type) {
      case "hit": {
        const e = E(ev.id);
        const v = this.ens.get(ev.id);
        if (v) {
          v.flashT = 0.07;
          v.knock = Math.min(1, (v.knock || 0) + 0.6);
        }
        if (e) {
          const y = (e.flying ? 1.0 : 0.35) + e.size * 0.9;
          const ice = ev.kind === "ice";
          fx.flash(e.x, y, e.z, ice ? 0x8fe8ff : 0xfff2c8, 0.7 + e.size, 0.12);
          fx.sparks(e.x, y, e.z, ice ? 6 : 4, ice ? 0xaef0ff : 0xffe6a0, 2.4, 0.16, 0.3, 3);
          if (ice) fx.smoke(e.x, y, e.z, 2, 0xe6f8ff, 0.35, 0.6, 0.5, 0.6, 0.2);
        }
        return;
      }
      case "dmg": {
        if (!ev.dot) {
          const v = this.ens.get(ev.id);
          if (v) v.flashT = Math.max(v.flashT || 0, 0.06);
        }
        break;
      }
      case "death": {
        const big = ev.boss;
        const col = ev.illusion ? 0xb49aff : big ? 0xffd34d : 0xffffff;
        fx.smoke(ev.x, 0.45, ev.z, big ? 18 : ev.illusion ? 4 : 8, ev.illusion ? 0xd8c8ff : 0xffffff, big ? 1.4 : 0.6, big ? 2.6 : 1.4, 0.8, 0.85, 0.8);
        fx.stars(ev.x, 0.7, ev.z, big ? 16 : 5, ev.illusion ? 0xd8c8ff : 0xfff2a0, big ? 4 : 2, big ? 0.6 : 0.36);
        fx.sparks(ev.x, 0.5, ev.z, big ? 40 : 8, col, big ? 6 : 2.6, big ? 0.32 : 0.18, 0.6);
        fx.ring(ev.x, ev.z, big ? 4 : 1.1, ev.illusion ? 0xb49aff : 0xffffff, big ? 0.7 : 0.35);
        if (big) {
          fx.flash(ev.x, 1.2, ev.z, 0xffe6a0, 7, 0.45);
          this.burst(ev.x, 0.8, ev.z, 40, 0xffd34d, 5, 0.14, 6);
          this.st.shake = Math.max(this.st.shake, 1);
        } else if (!ev.illusion) this.burst(ev.x, 0.4, ev.z, 5, 0xfff1dc, 2.2, 0.07, 7);
        const v = this.ens.get(ev.id);
        if (v) v.leak = false;
        return;
      }
      case "coin":
        fx.coin(ev.x, ev.z, ev.n >= 60 ? 6 : ev.n >= 10 ? 2 : 1);
        fx.sparks(ev.x, 0.8, ev.z, 4, 0xffd34d, 1.6, 0.18, 0.5, 2);
        return;
      case "spawn": {
        const e = E(ev.id);
        if (e) {
          fx.smoke(e.x, 0.4, e.z, ev.boss ? 14 : 4, ev.illusion ? 0xd8c8ff : 0xe6dcff, ev.boss ? 1.2 : 0.5, 1, 0.6, 0.7);
          if (ev.elite) fx.stars(e.x, 0.8, e.z, 6, 0xffd34d, 1.5, 0.4);
          if (ev.boss) this.bossIntro(e.x, e.z);
        }
        return;
      }
      case "fire": {
        const t = T(ev.tower);
        const e = E(ev.target);
        if (!t) return;
        const a = e ? Math.atan2(e.x - t.x, e.z - t.z) : 0;
        const ox = Math.sin(a) * 0.42;
        const oz = Math.cos(a) * 0.42;
        const y = (t.y || 0) + 0.85;
        const col = FIRE_COL[ev.attack] || 0xfff6dc;
        if (ev.attack === "shell" || ev.attack === "scatter") {
          fx.flash(t.x + ox * 1.5, y, t.z + oz * 1.5, 0xffd08a, 1.4, 0.12);
          fx.smoke(t.x + ox * 1.6, y, t.z + oz * 1.6, 4, 0xf0ece4, 0.45, 1.2, 0.6, 0.7, 0.5);
        } else if (ev.attack === "chain" || ev.attack === "bolt") {
          fx.flash(t.x, y + 0.7, t.z, 0xfff27a, 1.0, 0.12);
          fx.sparks(t.x, y + 0.7, t.z, 5, 0xfff27a, 2, 0.16, 0.3, 0);
        } else if (ev.attack === "iceShard" || ev.attack === "frostLob") {
          fx.sparks(t.x + ox, y + 0.2, t.z + oz, 4, 0xaef0ff, 1.2, 0.18, 0.4, -0.5);
        } else if (ev.attack === "bomb") {
          fx.smoke(t.x + ox, y, t.z + oz, 2, 0xf0ece4, 0.3, 0.6, 0.4, 0.5, 0.3);
        } else fx.sparks(t.x + ox, y + 0.1, t.z + oz, 2, col, 1, 0.12, 0.2, 0);
        return;
      }
      case "boom":
        this.boom(ev);
        return;
      case "chain": {
        this.lightning(ev.pts, 0x9ad8ff, 0.12);
        for (let i = 1; i < ev.pts.length; i++) {
          const p = ev.pts[i];
          fx.sparks(p.x, p.y, p.z, 5, 0xfff27a, 2.4, 0.18, 0.3, 2);
          fx.flash(p.x, p.y, p.z, 0xbfe6ff, 0.9, 0.12);
        }
        return;
      }
      case "boltHit":
        this.lightning([{ x: ev.x + 0.3, y: 8, z: ev.z - 0.2 }, { x: ev.x - 0.2, y: 4, z: ev.z + 0.1 }, { x: ev.x, y: 0.15, z: ev.z }], 0xfff27a, 0.22);
        fx.flash(ev.x, 0.6, ev.z, 0xfff6b0, 3.2, 0.22);
        fx.ring(ev.x, ev.z, ev.r, 0xfff27a, 0.4);
        fx.sparks(ev.x, 0.3, ev.z, 18, 0xfff27a, 4, 0.2, 0.45);
        fx.scorch(ev.x, ev.z, Math.max(0.8, ev.r * 0.6), 0x3a3020, 1.6);
        return;
      case "heal": {
        const b = E(ev.to);
        if (b) fx.rise(b.x, b.y + 0.5, b.z, 8, ev.look === "honey" ? 0xffc04a : 0x8affb0, 0.24, 0.35);
        break;
      }
      case "place": {
        const t = T(ev.tower);
        if (t) {
          fx.dustRing(t.x, t.z, 0.8, 10, 0xf2e6cc, 0.5);
          fx.stars(t.x, 0.9, t.z, 6, 0xffe36a, 1.6, 0.4);
          fx.ring(t.x, t.z, 1.2, 0xffe36a, 0.4);
        }
        return;
      }
      case "upgrade":
      case "evolve": {
        const t = T(ev.tower);
        if (t) {
          fx.rise(t.x, (t.y || 0) + 0.3, t.z, ev.type === "evolve" ? 22 : 12, ev.type === "evolve" ? 0xb48cff : 0xffe36a, 0.3, 0.45);
          fx.ring(t.x, t.z, ev.type === "evolve" ? 2 : 1.3, ev.type === "evolve" ? 0xb48cff : 0xffe36a, 0.5);
          fx.stars(t.x, 1.2, t.z, ev.type === "evolve" ? 10 : 5, 0xffffff, 2, 0.45);
        }
        return;
      }
      case "sell":
        fx.coin(ev.x, ev.z, 3);
        fx.smoke(ev.x, 0.3, ev.z, 6, 0xf2e6cc, 0.5, 1.2, 0.6, 0.7);
        return;
      case "nestHit": {
        const n = sim.world.nest;
        fx.flash(n.x, 1, n.z, 0xff5a5a, 3, 0.25);
        fx.sparks(n.x, 0.9, n.z, 10, 0xff8a8a, 3, 0.2, 0.5);
        this.burst(n.x, 0.9, n.z, 8, 0xfff6e8, 2.5, 0.08, 5);
        break;
      }
      case "shieldBreak": {
        const e = E(ev.id);
        if (e) {
          fx.sparks(e.x, 0.6, e.z, 18, 0xaef0ff, 3.5, 0.2, 0.5);
          fx.flash(e.x, 0.6, e.z, 0x8fe8ff, 2, 0.2);
        }
        break;
      }
      case "kamikaze":
        this.boom({ x: ev.x, z: ev.z, r: 2, look: "fire" });
        this.st.shake = Math.max(this.st.shake, 0.9);
        return;
    }
    this.handleOld(ev, sim);
  }
  /** 폭발 모양 (종류마다 색 · 연기 · 조각이 다름) */
  boom(ev) {
    const fx = this.fx;
    const { x, z } = ev;
    const r = ev.r || 1;
    const L = ev.look || "bomb";
    const col = LOOK_COL[L] || 0xffb03a;
    if (L === "ice" || L === "frost" || L === "snow") {
      fx.ring(x, z, r, 0x8fe8ff, 0.5);
      fx.smoke(x, 0.3, z, 8, 0xeef9ff, 0.7 * Math.min(2, r), 1.6, 0.8, 0.8, 0.3);
      fx.sparks(x, 0.4, z, 12, 0xaef0ff, 3, 0.2, 0.5);
      fx.stars(x, 0.6, z, 4, 0xffffff, 2, 0.35);
      return;
    }
    if (L === "spore" || L === "curse" || L === "rage") {
      fx.ring(x, z, r, col, 0.55);
      fx.smoke(x, 0.3, z, 8, col, 0.7, 1.4, 0.9, 0.6, 0.4);
      fx.sparks(x, 0.4, z, 8, col, 2, 0.2, 0.6, 0);
      return;
    }
    const heavy = ["slam", "quake", "magma", "meteor", "siege", "vent"].includes(L);
    const fire = L === "fire" || L === "magma" || L === "meteor" || L === "vent";
    fx.flash(x, 0.5, z, fire ? 0xffa040 : L === "shock" ? 0xfff6b0 : 0xffe0a0, 1.6 + r * 1.3, 0.2);
    fx.ring(x, z, r, col, 0.45);
    fx.sparks(x, 0.4, z, heavy ? 20 : 12, fire ? 0xff8a3a : col, 3.4, 0.22, 0.5);
    fx.smoke(x, 0.35, z, heavy ? 10 : 6, fire ? 0x6a5a52 : L === "shock" ? 0xe8e4ff : 0xd8d2c8, 0.55 + r * 0.35, 1.8, 0.9, 0.75, 0.7);
    if (fire) fx.rise(x, 0.4, z, 8, 0xffb03a, 0.22, r * 0.5);
    if (L === "shock")
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random();
        this.lightning([{ x, y: 0.4, z }, { x: x + Math.cos(a) * r * 0.9, y: 0.25, z: z + Math.sin(a) * r * 0.9 }], 0xfff27a, 0.07);
      }
    if (heavy) {
      fx.dustRing(x, z, r, 12, 0xe6d8b8, 0.6);
      this.burst(x, 0.3, z, 10, L === "magma" ? 0xff7a2a : 0x9a8a78, 3.5, 0.1, 9);
      this.st.shake = Math.max(this.st.shake, L === "siege" ? 0.35 : 0.8);
    }
    fx.scorch(x, z, Math.max(0.6, r * 0.75), fire ? 0x2a1208 : 0x3a3228, heavy ? 2.6 : 1.8);
  }
  /** 보스 등장: 땅이 울리는 먼지 고리 · 빛 · 충격파 */
  bossIntro(x, z) {
    const fx = this.fx;
    fx.ring(x, z, 4.5, 0xffd34d, 0.9);
    fx.ring(x, z, 3, 0xffffff, 0.6);
    fx.dustRing(x, z, 2.2, 22, 0xe8dcc0, 0.9);
    fx.flash(x, 1.2, z, 0xffe6a0, 6, 0.5);
    fx.stars(x, 1.4, z, 10, 0xffd34d, 3, 0.6);
    this.st.shake = Math.max(this.st.shake, 1.1);
  }
  handleOld(ev, sim) {
    const E = (id) => sim.byIdMap.get(id) || null;
    const T = (id) => sim.tower(id);
    switch (ev.type) {
      case "death": {
        const v = this.ens.get(ev.id);
        const col = ev.illusion ? 0xb49aff : ev.boss ? 0xffd34d : 0xffffff;
        this.burst(ev.x, 0.5, ev.z, ev.boss ? 60 : ev.illusion ? 8 : 14, col, ev.boss ? 5 : 2.4, ev.boss ? 0.16 : 0.09);
        if (v) v.leak = false;
        break;
      }
      case "leak": {
        const v = this.ens.get(ev.id);
        if (v) v.leak = true;
        break;
      }
      case "coin":
        this.burst(ev.x, 0.6, ev.z, 4, 0xffd34d, 1.6, 0.08, 5);
        break;
      case "dmg": {
        const e = E(ev.id);
        if (!e || ev.n < 1) break;
        const cls = ev.crit ? "crit" : ev.dot ? "dot" : ev.kind;
        this.number(e.x, e.y + e.size * 1.9, e.z, ev.crit ? `${ev.n}!` : String(ev.n), cls);
        break;
      }
      case "hit": {
        const e = E(ev.id);
        if (e) this.burst(e.x, e.y + 0.4, e.z, 3, ev.kind === "ice" ? 0x8fe8ff : 0xfff1dc, 1.4, 0.05, 3);
        break;
      }
      case "boom":
        this.shockwave(ev.x, ev.z, ev.r, LOOK_COL[ev.look] || 0xffb03a);
        this.burst(ev.x, 0.3, ev.z, ev.look === "shell" ? 10 : 18, LOOK_COL[ev.look] || 0xffb03a, 3, 0.1);
        if (["slam", "quake", "magma", "meteor", "siege"].includes(ev.look)) this.st.shake = Math.max(this.st.shake, ev.look === "siege" ? 0.35 : 0.8);
        break;
      case "chain":
        this.lightning(ev.pts);
        break;
      case "boltHit":
        this.lightning([
          { x: ev.x, y: 7, z: ev.z },
          { x: ev.x + 0.2, y: 3, z: ev.z - 0.1 },
          { x: ev.x, y: 0.2, z: ev.z },
        ]);
        this.shockwave(ev.x, ev.z, ev.r, 0xfff27a);
        this.burst(ev.x, 0.3, ev.z, 14, 0xfff27a, 3, 0.08);
        break;
      case "heal": {
        const a = E(ev.from);
        const b = E(ev.to);
        const va = this.ens.get(ev.from);
        if (va) va.m.healT = 0.5;
        if (b) {
          this.burst(b.x, b.y + 0.6, b.z, 8, ev.look === "honey" ? 0xffb03a : 0x8affb0, 1.2, 0.08, -1);
          this.number(b.x, b.y + b.size * 2, b.z, `+${ev.n}`, "heal");
        }
        if (a && b) this.lightning([{ x: a.x, y: a.y + 0.8, z: a.z }, { x: b.x, y: b.y + 0.6, z: b.z }]);
        break;
      }
      case "summon":
      case "clones":
      case "split": {
        const v = this.ens.get(ev.id);
        if (v) v.m.castT = 0.8;
        const e = E(ev.id);
        if (e) this.burst(e.x, 0.4, e.z, 12, ev.type === "clones" ? 0xb49aff : 0xd6a2ff, 2, 0.08);
        break;
      }
      case "pulse": {
        const e = E(ev.id);
        const v = this.ens.get(ev.id);
        if (v) v.m.pulseT = 0.6;
        if (e) this.shockwave(e.x, e.z, ev.r, LOOK_COL[ev.look] || 0xffffff);
        break;
      }
      case "vine": {
        const v = this.ens.get(ev.from);
        if (v) v.m.vineT = 0.8;
        const t = T(ev.tower);
        if (t) this.burst(t.x, 0.6, t.z, 8, 0x3d8a2c, 1.4, 0.07);
        break;
      }
      case "frostBite": {
        const t = T(ev.tower);
        if (t) this.burst(t.x, 0.8, t.z, 10, 0xbfefff, 1.4, 0.07);
        break;
      }
      case "block": {
        const v = this.ens.get(ev.id);
        if (v) v.m.blockT = 0.3;
        break;
      }
      case "dodge": {
        const e = E(ev.id);
        if (e) this.burst(e.x, 0.4, e.z, 10, 0xbfe8ff, 2, 0.07);
        break;
      }
      case "shieldBreak": {
        const e = E(ev.id);
        if (e) {
          this.burst(e.x, 0.6, e.z, 22, 0x8fe8ff, 3, 0.1);
          this.shockwave(e.x, e.z, 1 + e.size, 0x8fe8ff);
        }
        break;
      }
      case "shieldUp":
      case "shieldGive":
      case "freeze": {
        const e = E(ev.id || ev.from);
        if (e) this.burst(e.x, 0.5, e.z, 8, 0x7fe3ff, 1.4, 0.07, -1);
        break;
      }
      case "towerStun": {
        const t = T(ev.tower);
        if (t) this.burst(t.x, 1, t.z, 6, LOOK_COL[ev.look] || 0xffe36a, 1.2, 0.07);
        break;
      }
      case "soul": {
        const a = E(ev.to);
        if (a) this.burst(a.x, 0.9, a.z, 6, 0x6affd8, 1, 0.08, -1);
        break;
      }
      case "kamikaze":
        this.shockwave(ev.x, ev.z, 2, 0xff5a1a);
        this.burst(ev.x, 0.4, ev.z, 30, 0xff6a1a, 4, 0.12);
        this.st.shake = Math.max(this.st.shake, 0.9);
        break;
      case "nestHit":
        this.nestHit = 0.5;
        this.st.shake = Math.max(this.st.shake, ev.boss ? 1 : 0.4);
        break;
      case "place": {
        const t = T(ev.tower);
        if (t) {
          this.shockwave(t.x, t.z, 0.9, 0xffe36a);
          this.burst(t.x, 0.3, t.z, 18, 0xffe36a, 2.4, 0.08, 4);
        }
        break;
      }
      case "sell":
        this.burst(ev.x, 0.5, ev.z, 14, 0xffd34d, 2, 0.08);
        break;
      case "cleanse":
      case "nestShield": {
        const t = T(ev.tower);
        if (t) this.shockwave(t.x, t.z, 1.4, 0x5aff8a);
        break;
      }
      case "crown":
        this.burst(ev.x, 1.5, ev.z, 40, 0xffd34d, 4, 0.14, 3);
        break;
      case "finalDefeat":
        this.burst(ev.x, 1, ev.z, 120, 0xb46bff, 6, 0.16, 2);
        this.st.shake = 1.2;
        break;
    }
  }

  /** 둥지 위 축하 불꽃 (dur 초 동안) */
  celebrate(x, z, dur = 2) {
    this.cele = { x, z, t: 0, dur, next: 0 };
  }
  updateCele(dt) {
    const c = this.cele;
    if (!c) return;
    c.t += dt;
    c.next -= dt;
    if (c.next <= 0) {
      c.next = 0.18;
      const cols = [0xffd34d, 0xff7aa8, 0x7fe3ff, 0x9cff5a, 0xb48cff, 0xffffff];
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 2.5;
      this.burst(c.x + Math.cos(a) * r, 2.2 + Math.random() * 2, c.z + Math.sin(a) * r, 26, cols[Math.floor(Math.random() * cols.length)], 3.2, 0.1, 2.5);
    }
    if (c.t >= c.dur) this.cele = null;
  }
  update(sim, dt, selId) {
    this.t += dt;
    this.updateCele(dt);
    if (!sim) return;
    this.syncEnemies(sim, dt);
    this.syncTowers(sim, dt, selId);
    this.syncProjectiles(sim);
    this.syncZones(sim);
    this.syncMarkers(sim);
    this.updateFx(dt);
  }
  /** 판을 바꿀 때 모두 치우기 (통은 남김) */
  clear() {
    for (const v of this.ens.values()) this.release(v);
    this.ens.clear();
    for (const v of this.dying) this.release(v);
    this.dying = [];
    for (const v of this.tws.values()) {
      this.root.remove(v.root);
      disposeOwn(v.root);
    }
    this.tws.clear();
    for (const [id, m] of this.projM) {
      this.root.remove(m);
      (this.projPool[m.userData.kind] || (this.projPool[m.userData.kind] = [])).push(m);
    }
    this.projM.clear();
    for (const v of this.zoneM.values()) {
      this.root.remove(v.disc, v.ring);
      this.zonePool.push(v);
    }
    this.zoneM.clear();
    for (const v of this.markM.values()) {
      for (const o of Object.values(v)) if (o && o.isObject3D) this.root.remove(o);
      this.markPool[v.kind].push(v);
    }
    this.markM.clear();
    this.parts = [];
    this.fx.clear();
    for (const q of this.nums) q.el.remove();
    this.nums = [];
    this.setGhost(null);
  }
  /** 점검용: 통 · 쓰는 물체 수 */
  stats() {
    let pooled = 0;
    for (const l of Object.values(this.pool)) pooled += l.length;
    return { enemies: this.ens.size, dying: this.dying.length, towers: this.tws.size, proj: this.projM.size, zones: this.zoneM.size, markers: this.markM.size, parts: this.parts.length + this.fx.count(), nums: this.nums.length, pooled, sceneChildren: this.root.children.length };
  }
}

function softPlane(map, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }));
  m.renderOrder = 4;
  return m;
}
function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
