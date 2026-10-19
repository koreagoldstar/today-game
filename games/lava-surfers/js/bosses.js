/*
 * 용암 서핑 · 보스 3
 *
 *  공통: 체력 6 (3단계: 6·5 → 4·3 → 2·1), 공격은 항상 미리 보여 준다 (자세 · 빛 · 바닥 경고).
 *        단계가 바뀌면 배너 · 울음 · 공격이 빨라지고 섞인다. 보스 공격에 맞으면 하트 -1 (game 이 처리).
 *        하트 0 → '보스전 다시 도전' 은 지금 단계 처음 체력부터. 쓰러뜨리면 화산이 깨어나 안전지대로 탈출.
 *
 *  BOSS 1 화산 골렘   : 앞길을 막고 뒤로 걸어감 — 내려찍기(충격파 줄 → 점프) · 바위 던지기(붉은 원) · 바위 비 줄(빈 칸)
 *                       공격 뒤 무릎을 꿇으면 가슴 용암 핵이 드러남 → 부스터로 돌진해 명중
 *  BOSS 2 불꽃 와이번 : 하늘에서 앞서 날며 — 불덩이 연발(붉은 원) · 불꽃 벽(빈틈 · 낮으면 점프) · 급강하(빛나는 줄을 피함)
 *                       공격 뒤 길에 얼음 수정이 나타남 → 모으면 얼음 화살이 날아가 명중
 *  BOSS 3 고대 용     : 길 오른쪽에서 나란히 달리며 — 불 뿜기(길 한쪽이 불바다) · 꼬리 쓸기(점프) · 떨어지는 바위
 *                       지치면 다음 점프대 위로 내려와 가슴 보석을 드러냄 → 점프대로 날아올라 명중. 단계마다 하늘이 바뀜
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { fbm3, shadeVerts, roundedBox, mergeByMaterial } from "./geo.js?v=2";
import { cliffTex, slopeGlowTex, dotTex, ringTex } from "./tex.js?v=2";
import { THEMES } from "./themes.js?v=2";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
const rand = (a, b) => a + Math.random() * (b - a);

function lumpy(r, seed = 1, detail = 1, amt = 0.4) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (fbm3((x / r) * 1.4 + seed, (y / r) * 1.4, (z / r) * 1.4, 3) - 0.5) * amt;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}
function mesh(geo, mat, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}
function glowSprite(color, size, op = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}
/** 끝이 가늘어지는 관 (꼬리 · 목) */
function taper(pts, r0, r1, seg = 24, rad = 9) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const p = g.getAttribute("position");
  const tmp = V();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      tmp.set(p.getX(k), p.getY(k), p.getZ(k)).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, tmp.x, tmp.y, tmp.z);
    }
  }
  g.computeVertexNormals();
  return g;
}
/** 날개 막 (부채꼴 다각형) — 로컬 x 바깥쪽, z 앞뒤 */
function wingGeo(pts) {
  const P = [0, 0, 0];
  for (const [x, z] of pts) P.push(x, 0, z);
  const I = [];
  for (let i = 1; i < pts.length; i++) I.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

/* ================================================================
 * 공통
 * ============================================================== */
class Boss {
  constructor(game, { maxHp = 6 } = {}) {
    this.g = game;
    this.T = game.track;
    this.items = game.items;
    this.scene = game.scene;
    this.fx = game.fx;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.phaseHp = maxHp;
    this.t = 0;
    this.queue = [];
    this.ev = [];
    this.state = "idle";
    this.told = new Set();
    this.mats = [];
  }
  mat(m) {
    this.mats.push(m);
    return m;
  }
  get P() {
    return this.g.player;
  }
  phaseOf(hp) {
    return hp > 4 ? 1 : hp > 2 ? 2 : 3;
  }
  get phase() {
    return this.phaseOf(this.hp);
  }
  emit(e) {
    this.ev.push(e);
  }
  tell(key, text, dur = 2.4) {
    if (this.told.has(key)) return;
    this.told.add(key);
    this.emit({ type: "prompt", text, dur });
  }
  after(sec, fn) {
    this.queue.push({ at: this.t + sec, fn, gen: this.gen });
  }
  clearQueue() {
    this.queue = [];
    this.gen = (this.gen || 0) + 1;
  }
  /** 길 위 (s,u) 바닥에서 h 위 세계 좌표 */
  wp(s, u, h = 0, out = V()) {
    const T = this.T;
    const f = T.frame(s, this._f || (this._f = {}));
    const y = T.surfaceY(s, clamp(u, -T.halfWidth(s), T.halfWidth(s))) ?? f.y + T.rampAdd(s);
    return out.set(f.x + f.rx * u, y + h, f.z + f.rz * u);
  }
  /** 주인공 쪽(코스 뒤)을 보는 방향 */
  yawBack(s) {
    const f = this.T.frame(s, this._f2 || (this._f2 = {}));
    return Math.atan2(-f.tx, -f.tz);
  }
  yawFwd(s) {
    const f = this.T.frame(s, this._f2 || (this._f2 = {}));
    return Math.atan2(f.tx, f.tz);
  }
  hw(s) {
    return this.T.halfWidth(s);
  }
  /** 주인공이 sec 초 뒤 있을 s */
  aheadS(sec) {
    return this.P.s + Math.max(14, this.P.speed) * sec;
  }
  damage(at) {
    if (this.hp <= 0) return;
    const before = this.phase;
    this.hp--;
    this.emit({ type: "bossHit", hp: this.hp, at });
    if (this.hp <= 0) {
      this.clearQueue();
      this.items.clearDynamic();
      this.die();
      return;
    }
    if (this.phase > before) {
      this.phaseHp = this.hp;
      this.onPhase(this.phase);
    }
  }
  onPhase() {}
  start() {
    this.state = "fight";
    this.clearQueue();
    this.after(1.6, () => this.cycle());
  }
  /** '보스전 다시 도전': 지금 단계 처음 체력부터 */
  retryPhase() {
    this.hp = Math.max(this.phaseHp, this.hp);
    this.clearQueue();
    this.items.clearDynamic();
    this.state = "fight";
    this.placeNear();
    this.after(2.0, () => this.cycle());
  }
  reset() {
    this.hp = this.maxHp;
    this.phaseHp = this.maxHp;
    this.clearQueue();
    this.state = "idle";
    this.told.clear();
    this.placeNear(true);
  }
  placeNear() {}
  update(dt, playing) {
    this.ev = [];
    this.t += dt;
    if (playing && this.state !== "dead") {
      const due = this.queue.filter((q) => q.at <= this.t && q.gen === this.gen);
      this.queue = this.queue.filter((q) => q.at > this.t && q.gen === this.gen);
      for (const q of due) q.fn();
    }
    this.tick(dt, playing);
    return this.ev;
  }
  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}

/* ================================================================
 * BOSS 1 · 화산 골렘
 * ============================================================== */
export class Golem extends Boss {
  constructor(game) {
    super(game, { maxHp: 6 });
    this.build();
    this.D = 32; // 주인공 앞 거리
    this.reset();
  }
  build() {
    const rock = this.mat(new THREE.MeshStandardMaterial({ map: cliffTex(), color: "#a8968e", emissiveMap: slopeGlowTex(), emissive: "#ff6a2a", emissiveIntensity: 1.1, roughness: 0.9, vertexColors: true }));
    const dark = this.mat(new THREE.MeshStandardMaterial({ map: cliffTex(), color: "#5a4c4c", roughness: 0.95, vertexColors: true }));
    this.coreMat = this.mat(new THREE.MeshBasicMaterial({ color: "#ffb04a" }));
    const eye = this.mat(new THREE.MeshBasicMaterial({ color: "#ffe27a" }));
    const sh = (g) => shadeVerts(g, { bottom: 0.55 });
    const G = new THREE.Group();
    const body = new THREE.Group();
    G.add(body);
    body.add(mesh(sh(lumpy(1, 3, 2)), rock, [0, 4.4, 0], [2.5, 2.2, 1.8]));
    body.add(mesh(sh(lumpy(1, 5, 1)), dark, [0, 2.7, 0], [1.7, 1.0, 1.3]));
    const head = new THREE.Group();
    head.position.set(0, 6.8, 0.4);
    head.add(mesh(sh(lumpy(1, 7, 1)), rock, [0, 0, 0], [1.1, 0.95, 1.05]));
    head.add(mesh(sh(lumpy(1, 9, 1)), dark, [0, 0.55, 0.55], [1.2, 0.35, 0.6]));
    for (const k of [-1, 1]) {
      head.add(mesh(new THREE.SphereGeometry(0.2, 10, 8), eye, [k * 0.42, 0.12, 1.0]));
      const eg = glowSprite("#ffd04a", 1.2, 0.8);
      eg.position.set(k * 0.42, 0.12, 1.1);
      head.add(eg);
    }
    body.add(head);
    this.head = head;
    // 가슴 용암 핵 (약점)
    this.core = mesh(new THREE.SphereGeometry(0.75, 18, 14), this.coreMat, [0, 4.5, 1.75]);
    body.add(this.core);
    this.coreGlow = glowSprite("#ff8a2a", 4, 0.6);
    this.coreGlow.position.set(0, 4.5, 2.1);
    body.add(this.coreGlow);
    // 팔 (어깨에서 돎)
    this.arms = [];
    for (const k of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(k * 2.7, 5.6, 0);
      arm.add(mesh(sh(lumpy(1, 11 + k, 1)), rock, [k * 0.4, -0.2, 0], [1.1, 1.0, 1.0]));
      arm.add(mesh(sh(lumpy(1, 13 + k, 1)), dark, [k * 0.35, -1.4, 0], [0.8, 1.2, 0.8]));
      arm.add(mesh(sh(lumpy(1, 15 + k, 1)), dark, [k * 0.45, -2.8, 0.2], [0.75, 1.1, 0.75]));
      const fist = mesh(sh(lumpy(1, 17 + k, 2)), rock, [k * 0.5, -4.0, 0.4], [1.15, 1.05, 1.15]);
      arm.add(fist);
      arm.userData.fist = fist;
      body.add(arm);
      this.arms.push(arm);
    }
    // 다리
    this.legs = [];
    for (const k of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(k * 1.25, 2.4, 0);
      leg.add(mesh(sh(lumpy(1, 21 + k, 1)), dark, [0, -0.7, 0], [0.85, 1.0, 0.85]));
      leg.add(mesh(sh(lumpy(1, 23 + k, 1)), rock, [0, -1.8, 0.2], [0.95, 0.65, 1.2]));
      G.add(leg);
      this.legs.push(leg);
    }
    this.body = body;
    this.G = G;
    G.scale.setScalar(1.35); // 멀리서도 크게 보이게
    this.root.add(G);
    // 바닥 그림자
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(4.4, 24), this.mat(new THREE.MeshBasicMaterial({ color: "#1a0a0a", transparent: true, opacity: 0.4, depthWrite: false })));
    this.shadow.rotation.x = -Math.PI / 2;
    this.root.add(this.shadow);
    this.parts = [];
    body.traverse((o) => o.isMesh && this.parts.push(o));
  }
  placeNear(full) {
    const P = this.P;
    this.gs = (P ? P.s : 60) + (full ? 40 : this.D);
    this.gu = 0;
    this.pose = "walk";
    this.armUp = 0;
    this.kneel = 0;
    this.G.visible = true;
    this.dieT = 0;
    for (const m of this.parts) {
      if (m.userData.home) {
        m.position.copy(m.userData.home);
        m.rotation.copy(m.userData.rot);
      }
    }
  }
  camHint() {
    if (this.state === "dead" || this.gs - this.P.s > 70) return null;
    return this.wp(this.gs, this.gu, 4);
  }
  cycle() {
    if (this.state !== "fight") return;
    const ph = this.phase;
    const list = ph === 1 ? ["slam", "throw", "slam", "expose"] : ph === 2 ? ["slam2", "throw3", "row", "expose"] : ["row", "slamThrow", "slam2", "throw3", "expose"];
    this.plan = list;
    this.pi = 0;
    this.nextMove();
  }
  nextMove() {
    if (this.state !== "fight") return;
    const m = this.plan[this.pi++];
    if (!m) return this.cycle();
    const sp = this.phase === 3 ? 0.8 : this.phase === 2 ? 0.9 : 1;
    const done = (sec) => this.after(sec * sp, () => this.nextMove());
    if (m === "slam") {
      this.slam();
      done(2.0);
    } else if (m === "slam2") {
      this.slam();
      this.after(1.2 * sp, () => this.slam());
      done(3.0);
    } else if (m === "throw") {
      this.throwRocks(2);
      done(2.0);
    } else if (m === "throw3") {
      this.throwRocks(3);
      done(2.2);
    } else if (m === "row") {
      this.rockRow();
      done(2.4);
    } else if (m === "slamThrow") {
      this.slam();
      this.after(0.9, () => this.throwRocks(2));
      done(2.6);
    } else if (m === "expose") this.expose();
  }
  slam() {
    this.pose = "raise";
    this.emit({ type: "sfx", name: "rumble" });
    this.tell("slam", "골렘이 팔을 들면 → 충격파! 점프로 넘어요", 2.6);
    this.after(0.85, () => {
      if (this.state !== "fight") return;
      this.pose = "slam";
      this.slamT = 0;
      this.emit({ type: "sfx", name: "stomp" });
      this.emit({ type: "shake", k: 0.35 });
      this.items.spawnWave({ s: this.gs - 3, dir: -1, speed: 16, h: 0.8, life: 4 });
      const p = this.wp(this.gs - 2, this.gu, 0.2);
      this.fx.land(p.x, p.y, p.z, 1);
      this.fx.debris(p.x, p.y + 0.5, p.z, 6);
      this.after(0.5, () => this.pose === "slam" && (this.pose = "walk"));
    });
  }
  throwRocks(n) {
    this.pose = "wind";
    this.tell("throw", "바위가 날아와요 · 바닥의 붉은 원을 피해요!", 2.4);
    for (let i = 0; i < n; i++) {
      this.after(0.55 + i * 0.28, () => {
        if (this.state !== "fight") return;
        this.pose = "throw";
        const P = this.P;
        const hw = this.hw(P.s + 30) - 1.2;
        const s = this.aheadS(1.25) + rand(-3, 3);
        const u = clamp(P.u + rand(-1.6, 1.6) + (i - (n - 1) / 2) * 2.2, -hw, hw);
        const origin = V();
        this.arms[i % 2].userData.fist.getWorldPosition(origin);
        this.items.spawnBomb({ s, u, r: 1.9, kind: "rock", origin, flight: 1.25 });
        this.emit({ type: "sfx", name: "throw" });
      });
    }
    this.after(0.6 + n * 0.28 + 0.3, () => this.pose !== "kneel" && (this.pose = "walk"));
  }
  rockRow() {
    this.pose = "raise";
    this.tell("row", "바위 비! 빈 칸으로 피해요", 2.2);
    this.after(0.7, () => {
      if (this.state !== "fight") return;
      this.pose = "slam";
      this.emit({ type: "sfx", name: "stomp" });
      this.emit({ type: "shake", k: 0.3 });
      const s = this.aheadS(1.5);
      const hw = this.hw(s) - 0.8;
      const gap = rand(-hw + 2, hw - 2);
      for (let u = -hw; u <= hw + 0.01; u += 2.6) if (Math.abs(u - gap) > 2.0) this.items.spawnBomb({ s: s + rand(-1, 1), u, r: 1.55, kind: "rock", from: "sky", flight: 1.4 });
      this.after(0.6, () => this.pose === "slam" && (this.pose = "walk"));
    });
  }
  expose() {
    this.state = "exposed";
    this.pose = "kneel";
    this.exposeT = 0;
    this.exposeDur = this.phase === 3 ? 3.4 : 4.2;
    this.emit({ type: "sfx", name: "expose" });
    this.emit({ type: "prompt", text: this.g.input.touchMode ? "지금! 부스터 버튼으로 돌진해 가슴의 핵을 쳐요!" : "지금! Shift 부스터로 돌진해 가슴의 핵을 쳐요!", dur: 2.6 });
    this.P.boostCD = 0; // 부스터를 바로 쓸 수 있게
  }
  recover(hit) {
    this.state = "fight";
    this.pose = "walk";
    if (!hit) this.emit({ type: "sfx", name: "roar" });
    this.after(hit ? 1.4 : 1.0, () => this.cycle());
  }
  onPhase(ph) {
    this.emit({ type: "bossPhase", k: `단계 ${ph}`, h: ph === 2 ? "골렘이 화났어요!" : "골렘이 분노했어요!", t: ph === 2 ? "공격이 빨라져요 · 바위 비 조심!" : "모든 공격이 섞여요!" });
  }
  die() {
    this.state = "dead";
    this.pose = "dead";
    this.dieT = 0;
    for (const m of this.parts) {
      m.userData.home = m.userData.home || m.position.clone();
      m.userData.rot = m.userData.rot || m.rotation.clone();
      m.userData.v = V(rand(-4, 4), rand(2, 7), rand(-4, 4));
      m.userData.spin = V(rand(-3, 3), rand(-3, 3), rand(-3, 3));
    }
    const p = this.core.getWorldPosition(V());
    this.fx.burst(p.x, p.y, p.z, 80);
    this.fx.splash(p.x, p.y, p.z);
    this.emit({ type: "bossDown", h: "화산 골렘 격파!", t: "화산이 깨어났어요 · 안전지대로 탈출!" });
  }
  tick(dt, playing) {
    const P = this.P;
    const t = this.t;
    if (this.state === "idle") {
      this.gs = Math.max(this.gs, P.s + 30);
    } else if (this.state === "fight") {
      const want = P.s + this.D;
      const v = P.speed + clamp((want - this.gs) * 1.4, -10, 16);
      this.gs += Math.max(0, v) * dt;
      // 너무 가까워지면 (부스터로 그냥 달려들면) 밀쳐냄
      if (playing && this.gs - P.s < 3.2 && Math.abs(P.u - this.gu) < 3.4 && P.y < this.wp(this.gs, this.gu).y + 7) {
        this.emit({ type: "hit", u: this.gu });
        this.gs = P.s + 14;
      }
    } else if (this.state === "exposed") {
      this.exposeT += dt;
      this.gs += 6.5 * dt;
      if (playing) {
        const near = this.gs - P.s < 3.4 && Math.abs(P.u - this.gu) < 3.4 && P.y < this.wp(this.gs, this.gu).y + 7;
        if (near) {
          if (P.boostT > 0 || P.speed > 26) {
            const at = this.core.getWorldPosition(V());
            this.fx.burst(at.x, at.y, at.z, 60, ["#fff0a0", "#ff8a2a", "#ffffff"]);
            this.fx.debris(at.x, at.y, at.z, 8);
            this.gs = P.s + 18;
            this.damage(at);
            if (this.state !== "dead") this.recover(true);
          } else {
            this.emit({ type: "hit", u: this.gu });
            this.emit({ type: "prompt", text: "부스터를 켜고 부딪혀야 해요!", dur: 1.8 });
            this.gs = P.s + 12;
          }
        }
      }
      if (this.state === "exposed" && this.exposeT > this.exposeDur) {
        this.emit({ type: "prompt", text: "골렘이 일어났어요 · 다시 기회를 노려요!", dur: 1.8 });
        this.recover(false);
      }
    }
    // 좌우로 어슬렁 (경고 중에는 주인공 쪽으로)
    if (this.state === "fight" || this.state === "idle") {
      const hw = this.hw(this.gs) - 3;
      this.gu = damp(this.gu, clamp(Math.sin(t * 0.45) * hw * 0.6, -hw, hw), 1.5, dt);
    }
    this.place(dt);
  }
  place(dt) {
    const t = this.t;
    const G = this.G;
    if (this.state === "dead") {
      this.dieT += dt;
      for (const m of this.parts) {
        const v = m.userData.v;
        v.y -= 18 * dt;
        m.position.addScaledVector(v, dt);
        if (m.position.y < -2) {
          m.position.y = -2;
          v.multiplyScalar(0.3);
        }
        m.rotation.x += m.userData.spin.x * dt;
        m.rotation.y += m.userData.spin.y * dt;
      }
      this.coreMat.color.set("#3a2a2a");
      this.coreGlow.material.opacity = Math.max(0, 0.6 - this.dieT);
      if (this.dieT > 8) G.visible = false;
      return;
    }
    const p = this.wp(this.gs, this.gu, 0);
    G.position.copy(p);
    G.rotation.y = this.yawBack(this.gs);
    this.shadow.position.set(p.x, p.y + 0.06, p.z);
    // 자세
    const kneelT = this.pose === "kneel" ? 1 : 0;
    this.kneel = damp(this.kneel, kneelT, 5, dt);
    const up = this.pose === "raise" || this.pose === "wind" ? 1 : 0;
    this.armUp = damp(this.armUp, up, this.pose === "slam" ? 30 : 6, dt);
    this.body.position.y = -this.kneel * 1.6 + Math.sin(t * 6) * 0.06;
    this.body.rotation.x = this.kneel * 0.4;
    const walk = this.pose === "kneel" ? 0 : 1;
    this.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 7 + i * Math.PI) * 0.35 * walk));
    this.arms.forEach((a, i) => {
      const swing = Math.sin(t * 7 + i * Math.PI + 1) * 0.25 * walk;
      let rx = swing - this.armUp * 2.5;
      if (this.pose === "slam") rx = 0.5;
      if (this.pose === "throw" && i === 0) rx = -1.2;
      if (this.pose === "kneel") rx = 0.6;
      a.rotation.x = damp(a.rotation.x, rx, 12, dt);
      a.rotation.z = (i ? -1 : 1) * (0.15 + this.armUp * 0.2);
    });
    this.head.rotation.x = this.kneel * 0.3;
    // 핵: 드러났을 때 크게 빛남
    const ex = this.state === "exposed";
    const pulse = ex ? 0.8 + Math.sin(t * 12) * 0.2 : 0.35;
    this.coreMat.color.set(ex ? "#fff0b0" : "#ff8a2a");
    this.coreGlow.material.opacity = pulse;
    this.coreGlow.scale.setScalar(ex ? 7 : 4);
    this.core.scale.setScalar(ex ? 1.25 : 1);
  }
}

/* ================================================================
 * BOSS 2 · 불꽃 와이번
 * ============================================================== */
export class Wyvern extends Boss {
  constructor(game) {
    super(game, { maxHp: 6 });
    this.build();
    this.crystals = [];
    this.bolts = [];
    this.reset();
  }
  build() {
    const scale = this.mat(new THREE.MeshStandardMaterial({ color: "#a8301e", roughness: 0.55, metalness: 0.15, vertexColors: true }));
    const dark = this.mat(new THREE.MeshStandardMaterial({ color: "#4a1414", roughness: 0.6, vertexColors: true }));
    const belly = this.mat(new THREE.MeshStandardMaterial({ color: "#ffb05a", emissive: "#ff6a1a", emissiveIntensity: 0.9, roughness: 0.5 }));
    const horn = this.mat(new THREE.MeshStandardMaterial({ color: "#f0e0c0", roughness: 0.5 }));
    const memb = this.mat(new THREE.MeshStandardMaterial({ color: "#7a1a14", emissive: "#3a0804", emissiveIntensity: 0.6, roughness: 0.7, side: THREE.DoubleSide }));
    const eye = this.mat(new THREE.MeshBasicMaterial({ color: "#ffe27a" }));
    const sh = (g) => shadeVerts(g, { bottom: 0.6 });
    const G = new THREE.Group();
    const body = new THREE.Group();
    G.add(body);
    body.add(mesh(sh(new THREE.SphereGeometry(1, 20, 14)), scale, [0, 0, 0], [1.25, 1.1, 2.6]));
    body.add(mesh(new THREE.SphereGeometry(1, 16, 12), belly, [0, -0.45, 0.3], [0.95, 0.75, 2.1]));
    // 목 · 머리 (로컬 +z = 앞)
    body.add(mesh(sh(taper([V(0, 0.4, 2.0), V(0, 1.2, 3.2), V(0, 1.7, 4.4)], 0.75, 0.5, 12, 8)), scale));
    const head = new THREE.Group();
    head.position.set(0, 1.8, 4.7);
    head.add(mesh(sh(roundedBox(1.2, 0.95, 1.5, 0.35)), scale));
    head.add(mesh(sh(new THREE.ConeGeometry(0.5, 1.4, 8)), scale, [0, -0.1, 1.2], [1, 1, 0.8], [Math.PI / 2, 0, 0]));
    this.jaw = mesh(sh(roundedBox(0.9, 0.3, 1.5, 0.12)), dark, [0, -0.5, 0.75]);
    head.add(this.jaw);
    for (const k of [-1, 1]) {
      head.add(mesh(new THREE.ConeGeometry(0.16, 1.2, 6), horn, [k * 0.4, 0.55, -0.55], [1, 1, 1], [-1.0, 0, k * 0.35]));
      head.add(mesh(new THREE.SphereGeometry(0.13, 8, 6), eye, [k * 0.42, 0.15, 0.55]));
    }
    this.mouthGlow = glowSprite("#ff8a2a", 2.4, 0);
    this.mouthGlow.position.set(0, -0.2, 1.9);
    head.add(this.mouthGlow);
    body.add(head);
    this.head = head;
    // 꼬리
    body.add(mesh(sh(taper([V(0, 0, -2.2), V(0, -0.2, -4.4), V(0, 0.3, -6.6), V(0, 0.9, -8.2)], 0.7, 0.08, 20, 8)), scale));
    body.add(mesh(new THREE.ConeGeometry(0.5, 0.9, 4), dark, [0, 0.95, -8.4], [1, 1, 0.3], [-Math.PI / 2, 0, 0]));
    // 날개
    this.wings = [];
    for (const k of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(k * 0.9, 0.7, 0.6);
      const pts = [
        [6.5, 1.2],
        [9.5, -0.6],
        [8.2, -2.6],
        [5.6, -2.4],
        [3.4, -3.0],
        [1.2, -2.0],
      ].map(([x, z]) => [k * x, z]);
      const g = wingGeo(k > 0 ? pts : pts.slice().reverse());
      w.add(new THREE.Mesh(g, memb));
      for (const [x, z] of [pts[0], pts[1], pts[3]]) {
        const len = Math.hypot(x, z);
        const bone = mesh(new THREE.CylinderGeometry(0.09, 0.14, len, 6), dark, [x / 2, 0.05, z / 2]);
        bone.quaternion.setFromUnitVectors(V(0, 1, 0), V(x, 0, z).normalize());
        w.add(bone);
      }
      body.add(w);
      this.wings.push(w);
    }
    // 다리 (접은)
    for (const k of [-1, 1]) body.add(mesh(sh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8)), dark, [k * 0.7, -1.1, -0.4], [1, 1, 1], [0.9, 0, 0]));
    this.G = G;
    this.body = body;
    G.scale.setScalar(1.4);
    this.root.add(G);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), this.mat(new THREE.MeshBasicMaterial({ color: "#1a0a0a", transparent: true, opacity: 0.3, depthWrite: false })));
    this.shadow.rotation.x = -Math.PI / 2;
    this.root.add(this.shadow);
    // 급강하 경고 줄
    this.lane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat(new THREE.MeshBasicMaterial({ color: "#ff3a1a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })));
    this.lane.frustumCulled = false;
    this.root.add(this.lane);
    this.crystalMat = this.mat(new THREE.MeshStandardMaterial({ color: "#bff6ff", emissive: "#4ad8ff", emissiveIntensity: 1.6, roughness: 0.1, metalness: 0.2, flatShading: true }));
    this.boltMat = this.mat(new THREE.MeshBasicMaterial({ color: "#c8f4ff" }));
  }
  placeNear(full) {
    const P = this.P;
    this.ws = (P ? P.s : 60) + 45;
    this.wu = 0;
    this.wh = 10;
    this.mode = "fly";
    this.G.visible = true;
    this.G.rotation.set(0, 0, 0);
    this.lane.material.opacity = 0;
    this.clearCrystals();
    if (full) this.dieT = 0;
  }
  clearCrystals() {
    for (const c of this.crystals) this.root.remove(c.g);
    this.crystals = [];
    for (const b of this.bolts) this.root.remove(b.m);
    this.bolts = [];
  }
  camHint() {
    if (this.state === "dead") return null;
    return this.wp(this.ws, this.wu, this.wh * 0.6);
  }
  cycle() {
    if (this.state !== "fight") return;
    const ph = this.phase;
    this.plan = ph === 1 ? ["volley3", "wallGap", "crystals"] : ph === 2 ? ["volley5", "wallLow", "wallGap", "crystals"] : ["dive", "volley5", "wallDouble", "dive", "crystals"];
    this.pi = 0;
    this.nextMove();
  }
  nextMove() {
    if (this.state !== "fight") return;
    const m = this.plan[this.pi++];
    if (!m) return this.cycle();
    const sp = this.phase === 3 ? 0.8 : this.phase === 2 ? 0.9 : 1;
    const done = (sec) => this.after(sec * sp, () => this.nextMove());
    if (m === "volley3") {
      this.volley(3);
      done(2.4);
    } else if (m === "volley5") {
      this.volley(5);
      done(2.8);
    } else if (m === "wallGap") {
      this.wall("gap");
      done(3.0);
    } else if (m === "wallLow") {
      this.wall("low");
      done(2.8);
    } else if (m === "wallDouble") {
      this.wall("gap");
      this.after(1.1, () => this.wall("low"));
      done(3.6);
    } else if (m === "dive") {
      this.dive();
      done(4.0);
    } else if (m === "crystals") {
      this.spawnCrystals();
      done(4.2);
    }
  }
  breathe(sec) {
    this.breathT = sec;
    this.emit({ type: "sfx", name: "flame" });
  }
  volley(n) {
    this.charge = 0.7;
    this.tell("volley", "불덩이가 날아와요 · 바닥의 붉은 원을 피해요!", 2.4);
    for (let i = 0; i < n; i++) {
      this.after(0.7 + i * 0.24, () => {
        if (this.state !== "fight") return;
        const P = this.P;
        const s = this.aheadS(1.3) + rand(-4, 5);
        const hw = this.hw(s) - 1;
        const u = i === 0 ? clamp(P.u, -hw, hw) : rand(-hw, hw);
        const origin = this.mouthGlow.getWorldPosition(V());
        this.items.spawnBomb({ s, u, r: 1.8, kind: "fire", origin, flight: 1.3 });
        this.emit({ type: "sfx", name: "whistle" });
      });
    }
  }
  wall(type) {
    this.charge = 0.6;
    if (type === "gap") this.tell("wallGap", "불꽃 벽! 빈틈으로 지나가요", 2.2);
    else this.tell("wallLow", "낮은 불꽃 벽은 점프로 넘어요!", 2.2);
    this.after(0.6, () => {
      if (this.state !== "fight") return;
      this.breathe(1.0);
      const s = this.aheadS(1.55);
      const hw = this.hw(s) + 0.4;
      if (type === "gap") {
        const g = rand(-hw + 2.6, hw - 2.6);
        this.items.spawnFlames({ s0: s, s1: s + 1.4, u0: -hw, u1: g - 1.8, h: 3.4, life: 2.6 });
        this.items.spawnFlames({ s0: s, s1: s + 1.4, u0: g + 1.8, u1: hw, h: 3.4, life: 2.6 });
      } else this.items.spawnFlames({ s0: s, s1: s + 1.2, u0: -hw, u1: hw, h: 0.85, life: 2.6 });
    });
  }
  dive() {
    const P = this.P;
    const hw = this.hw(P.s + 40) - 1.8;
    const lu = clamp(P.u + rand(-1, 1), -hw, hw);
    this.diveU = lu;
    this.mode = "diveWarn";
    this.modeT = 0;
    this.tell("dive", "와이번이 내리꽂혀요! 빛나는 줄에서 비켜요", 2.4);
    this.emit({ type: "sfx", name: "roar" });
  }
  spawnCrystals() {
    this.tell("crystal", "파란 얼음 수정을 모으면 와이번에게 얼음 화살이 날아가요!", 3.0);
    const P = this.P;
    for (const [d, du] of [
      [42, rand(-3, -0.5)],
      [62, rand(0.5, 3)],
    ]) {
      const s = P.s + d;
      const hw = this.hw(s) - 1.4;
      const u = clamp(du, -hw, hw);
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), this.crystalMat);
      m.scale.set(0.8, 1.4, 0.8);
      g.add(m);
      g.add(glowSprite("#7ae8ff", 3.4, 0.85));
      g.position.copy(this.wp(s, u, 1.3));
      this.root.add(g);
      this.crystals.push({ s, u, g, m });
    }
  }
  fireBolt() {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 6), this.boltMat);
    m.add(glowSprite("#9af0ff", 2.2, 0.9));
    const p = this.g.playerWorld().setY(this.P.y + 1.2);
    m.position.copy(p);
    this.root.add(m);
    this.bolts.push({ m, t: 0, from: p.clone() });
    this.emit({ type: "sfx", name: "iceShot" });
  }
  onPhase(ph) {
    this.emit({ type: "bossPhase", k: `단계 ${ph}`, h: ph === 2 ? "와이번이 화났어요!" : "와이번이 분노했어요!", t: ph === 2 ? "불덩이가 많아지고 불꽃 벽이 낮아져요" : "급강하 공격을 조심!" });
    this.emit({ type: "theme", theme: ph === 2 ? THEMES.final : THEMES.dragon });
  }
  die() {
    this.state = "dead";
    this.dieT = 0;
    this.lane.material.opacity = 0;
    this.clearCrystals();
    this.fallSide = this.wu >= 0 ? 1 : -1;
    this.emit({ type: "bossDown", h: "불꽃 와이번 격파!", t: "와이번이 용암에 떨어졌어요 · 탈출!" });
  }
  tick(dt, playing) {
    const P = this.P;
    const t = this.t;
    // 얼음 수정 줍기 · 얼음 화살
    if (playing) {
      for (const c of this.crystals) {
        if (c.taken) continue;
        c.m.rotation.y += dt * 2;
        c.g.position.y = this.wp(c.s, c.u, 1.3 + Math.sin(t * 3) * 0.15).y;
        if (Math.abs(P.s - c.s) < 1.6 && Math.abs(P.u - c.u) < 1.8 && P.y < this.wp(c.s, c.u).y + 3) {
          c.taken = true;
          this.root.remove(c.g);
          this.emit({ type: "sfx", name: "crystal" });
          this.fx.orb(c.g.position.x, c.g.position.y, c.g.position.z, true);
          this.fireBolt();
        }
      }
      this.crystals = this.crystals.filter((c) => !c.taken && c.s > P.s - 10);
    }
    for (const b of this.bolts) {
      b.t += dt;
      const target = this.body.getWorldPosition(V());
      const k = Math.min(1, b.t / 0.6);
      b.m.position.lerpVectors(b.from, target, k);
      b.m.position.y += Math.sin(k * Math.PI) * 4;
      b.m.lookAt(target);
      b.m.rotateX(Math.PI / 2);
      if (k >= 1) {
        b.done = true;
        this.root.remove(b.m);
        this.fx.burst(target.x, target.y, target.z, 50, ["#c8f4ff", "#7ae8ff", "#ffffff"]);
        if (this.state === "fight") this.damage(target);
      }
    }
    this.bolts = this.bolts.filter((b) => !b.done);
    if (this.state === "dead") {
      this.dieT += dt;
      this.wu += this.fallSide * 12 * dt;
      this.wh -= (4 + this.dieT * 10) * dt;
      this.ws += P.speed * 0.6 * dt;
      this.G.rotation.z += this.fallSide * dt * 2;
      const p = this.wp(this.ws, this.wu, this.wh);
      this.G.position.copy(p);
      if (p.y < this.T.lavaY(this.ws) && !this.splashed) {
        this.splashed = true;
        this.fx.splash(p.x, this.T.lavaY(this.ws) + 0.5, p.z);
        this.fx.burst(p.x, this.T.lavaY(this.ws) + 2, p.z, 60);
      }
      if (this.dieT > 4) this.G.visible = false;
      return;
    }
    // 비행
    let wantS = P.s + 34;
    let wantU = Math.sin(t * 0.5) * (this.hw(P.s + 34) - 2) * 0.7;
    let wantH = 9 + Math.sin(t * 1.3) * 1.2;
    if (this.mode === "diveWarn") {
      this.modeT += dt;
      wantS = P.s + 62;
      wantU = this.diveU;
      wantH = 13;
      const a = P.s + 12;
      const b = P.s + 70;
      const f = this.T.frame((a + b) / 2, {});
      this.lane.position.copy(this.wp((a + b) / 2, this.diveU, 0.1));
      this.lane.rotation.set(-Math.PI / 2, 0, -Math.atan2(f.tx, f.tz) + Math.PI);
      this.lane.scale.set(3.6, b - a, 1);
      this.lane.material.opacity = 0.3 + Math.sin(t * 16) * 0.15;
      if (this.modeT > 1.3) {
        this.mode = "dive";
        this.modeT = 0;
        this.diveS = this.ws;
        this.emit({ type: "sfx", name: "flap" });
      }
    } else if (this.mode === "dive") {
      this.modeT += dt;
      this.lane.material.opacity = 0.35;
      // 주인공 쪽으로 낮게 휙 (상대 속도 40m/s)
      this.ws -= 18 * dt;
      wantS = this.ws;
      wantU = this.diveU;
      wantH = 1.6;
      if (playing && Math.abs(P.s - this.ws) < 2.6 && Math.abs(P.u - this.diveU) < 2.1 && P.y < this.wp(P.s, P.u).y + 3.2) this.emit({ type: "hit", u: this.diveU });
      if (this.phase === 3 && Math.random() < dt * 8) this.items.spawnFlames({ s0: this.ws - 1, s1: this.ws + 1, u0: this.diveU - 1.6, u1: this.diveU + 1.6, h: 1.2, life: 1.2 });
      if (this.ws < P.s - 12) {
        this.mode = "return";
        this.modeT = 0;
        this.lane.material.opacity = 0;
      }
    } else if (this.mode === "return") {
      this.modeT += dt;
      wantH = 24;
      if (this.modeT > 1.6) this.mode = "fly";
    }
    if (this.mode === "dive") {
      this.wu = damp(this.wu, wantU, 8, dt);
      this.wh = damp(this.wh, wantH, 6, dt);
    } else {
      const rate = this.mode === "return" ? 1.8 : 2.2;
      this.ws = damp(this.ws, wantS, rate, dt) + (this.mode === "return" ? P.speed * dt * 1.6 : P.speed * dt * 0.9);
      if (this.mode === "fly" && this.ws > P.s + 44) this.ws = P.s + 44;
      this.wu = damp(this.wu, wantU, 1.6, dt);
      this.wh = damp(this.wh, wantH, 2, dt);
    }
    const p = this.wp(this.ws, this.wu, this.wh);
    this.G.position.copy(p);
    const yaw = this.mode === "return" ? this.yawFwd(this.ws) : this.yawBack(this.ws);
    this.G.rotation.y = yaw;
    this.G.rotation.x = this.mode === "dive" ? 0.25 : Math.sin(t * 1.3) * 0.05;
    const flap = this.mode === "dive" ? 0.15 : 0.7;
    this.wings.forEach((w, i) => {
      w.rotation.z = (i ? -1 : 1) * (Math.sin(t * (this.mode === "return" ? 9 : 5.5)) * flap * 1.3 + 0.35);
      w.rotation.x = -0.25;
    });
    if (Math.sin(t * 5.5) > 0.98) this.emit({ type: "sfx", name: "flap" });
    this.charge = Math.max(0, (this.charge || 0) - dt);
    this.breathT = Math.max(0, (this.breathT || 0) - dt);
    this.mouthGlow.material.opacity = this.charge > 0 ? 0.9 : this.breathT > 0 ? 1 : 0;
    this.jaw.rotation.x = this.charge > 0 || this.breathT > 0 ? 0.45 : 0.05;
    const g = this.wp(this.ws, this.wu, 0.06);
    this.shadow.position.copy(g);
    this.shadow.material.opacity = clamp(0.4 - this.wh * 0.015, 0.08, 0.4);
  }
}

/* ================================================================
 * BOSS 3 · 고대 용 (최종)
 * ============================================================== */
export class Dragon extends Boss {
  constructor(game) {
    super(game, { maxHp: 6 });
    this.build();
    this.reset();
  }
  build() {
    const scale = this.mat(new THREE.MeshStandardMaterial({ map: cliffTex(), color: "#4a3a44", emissiveMap: slopeGlowTex(), emissive: "#ff5a1a", emissiveIntensity: 1.3, roughness: 0.55, metalness: 0.2, vertexColors: true }));
    const dark = this.mat(new THREE.MeshStandardMaterial({ color: "#241a22", roughness: 0.5, metalness: 0.3, vertexColors: true }));
    const horn = this.mat(new THREE.MeshStandardMaterial({ color: "#e8dcc4", roughness: 0.45 }));
    const memb = this.mat(new THREE.MeshStandardMaterial({ color: "#3a1418", emissive: "#5a0a04", emissiveIntensity: 0.7, roughness: 0.7, side: THREE.DoubleSide }));
    const eye = this.mat(new THREE.MeshBasicMaterial({ color: "#ffd04a" }));
    this.gemMat = this.mat(new THREE.MeshStandardMaterial({ color: "#d0f8ff", emissive: "#6ae0ff", emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.3, flatShading: true }));
    const sh = (g) => shadeVerts(g, { bottom: 0.55 });
    const S = 2.0;
    const G = new THREE.Group();
    const body = new THREE.Group();
    body.scale.setScalar(S);
    G.add(body);
    body.add(mesh(sh(lumpy(1, 31, 2, 0.25)), scale, [0, 0, 0], [1.6, 1.4, 3.4]));
    // 가슴 보석 (약점) — 가슴 앞 아래
    this.gem = mesh(new THREE.OctahedronGeometry(0.75, 0), this.gemMat, [0, -0.7, 2.6], [1, 1.3, 1]);
    body.add(this.gem);
    this.gemGlow = glowSprite("#7ae8ff", 3.6, 0.5);
    this.gemGlow.position.set(0, -0.7, 2.9);
    body.add(this.gemGlow);
    // 목 · 머리
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.7, 2.9);
    this.neck.add(mesh(sh(taper([V(0, 0, 0), V(0, 0.8, 1.3), V(0, 1.4, 2.7)], 0.85, 0.55, 12, 9)), scale));
    const head = new THREE.Group();
    head.position.set(0, 1.6, 3.2);
    head.add(mesh(sh(roundedBox(1.5, 1.1, 1.9, 0.4)), scale));
    head.add(mesh(sh(new THREE.ConeGeometry(0.6, 1.8, 8)), scale, [0, -0.15, 1.5], [1, 1, 0.75], [Math.PI / 2, 0, 0]));
    this.jaw = mesh(sh(roundedBox(1.1, 0.35, 1.9, 0.15)), dark, [0, -0.62, 0.95]);
    head.add(this.jaw);
    for (const k of [-1, 1]) {
      head.add(mesh(new THREE.ConeGeometry(0.22, 2.0, 7), horn, [k * 0.55, 0.75, -0.75], [1, 1, 1], [-1.1, 0, k * 0.4]));
      head.add(mesh(new THREE.ConeGeometry(0.12, 0.9, 6), horn, [k * 0.7, 0.2, -0.5], [1, 1, 1], [-1.3, 0, k * 1.0]));
      head.add(mesh(new THREE.SphereGeometry(0.15, 8, 6), eye, [k * 0.52, 0.2, 0.7]));
      const eg = glowSprite("#ffb04a", 0.9, 0.8);
      eg.position.set(k * 0.52, 0.2, 0.8);
      head.add(eg);
    }
    this.mouthGlow = glowSprite("#ff7a2a", 3, 0);
    this.mouthGlow.position.set(0, -0.3, 2.4);
    head.add(this.mouthGlow);
    this.neck.add(head);
    this.head = head;
    body.add(this.neck);
    // 꼬리
    this.tail = mesh(sh(taper([V(0, 0, -3.0), V(0, -0.2, -5.5), V(0, 0.2, -8), V(0, 0.8, -10.5)], 0.95, 0.1, 24, 9)), scale);
    body.add(this.tail);
    // 다리 4
    this.legs = [];
    for (const [x, z] of [
      [-1.2, 1.8],
      [1.2, 1.8],
      [-1.2, -1.8],
      [1.2, -1.8],
    ]) {
      const leg = new THREE.Group();
      leg.position.set(x, -0.6, z);
      leg.add(mesh(sh(new THREE.CapsuleGeometry(0.4, 1.2, 4, 8)), dark, [0, -0.8, 0]));
      leg.add(mesh(sh(roundedBox(0.8, 0.35, 1.1, 0.15)), dark, [0, -1.65, 0.25]));
      body.add(leg);
      this.legs.push(leg);
    }
    // 날개
    this.wings = [];
    for (const k of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(k * 1.2, 0.9, 1.0);
      const pts = [
        [5.5, 1.8],
        [9.5, 0.2],
        [10.5, -2.5],
        [7.5, -3.4],
        [4.5, -4.2],
        [1.5, -3.0],
      ].map(([x, z]) => [k * x, z]);
      w.add(new THREE.Mesh(wingGeo(k > 0 ? pts : pts.slice().reverse()), memb));
      body.add(w);
      this.wings.push(w);
    }
    this.G = G;
    this.body = body;
    this.root.add(G);
    // 불 뿜기 줄기 (입 → 바닥)
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 2.2, 1, 12, 1, true).translate(0, -0.5, 0), this.mat(new THREE.MeshBasicMaterial({ color: "#ffb04a", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    this.beam.frustumCulled = false;
    this.root.add(this.beam);
    // 꼬리 쓸기: 길을 가로질러 미끄러지는 꼬리 + 바닥 경고 줄
    this.sweep = new THREE.Group();
    const st = mesh(sh(taper([V(-7, 0.5, 0), V(-2, 0.6, 0.3), V(3, 0.5, -0.2), V(8, 0.45, 0)], 0.55, 0.25, 20, 8)), scale);
    this.sweep.add(st);
    for (let i = 0; i < 8; i++) this.sweep.add(mesh(new THREE.ConeGeometry(0.2, 0.7, 5), horn, [-6 + i * 1.8, 1.0, 0]));
    this.sweep.visible = false;
    this.root.add(this.sweep);
    this.warnStrip = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.2), this.mat(new THREE.MeshBasicMaterial({ color: "#ff3a1a", transparent: true, opacity: 0, depthWrite: false })));
    this.warnStrip.frustumCulled = false;
    this.root.add(this.warnStrip);
  }
  placeNear(full) {
    const P = this.P;
    this.ds = (P ? P.s : 60) + 8;
    this.du = this.hw(this.ds) + 13;
    this.dh = 2;
    this.mode = "run";
    this.G.visible = true;
    this.G.rotation.set(0, 0, 0);
    this.beam.material.opacity = 0;
    this.sweep.visible = false;
    this.warnStrip.material.opacity = 0;
    if (full) {
      this.dieT = 0;
      this.splashed = false;
    }
  }
  camHint() {
    if (this.state === "dead") return null;
    if (this.mode === "expose" || this.mode === "toRamp") return this.gem.getWorldPosition(V());
    return this.wp(this.ds + 6, Math.min(this.du, this.hw(this.ds) + 6), 6);
  }
  cycle() {
    if (this.state !== "fight") return;
    const ph = this.phase;
    this.plan = ph === 1 ? ["breath", "rocks", "expose"] : ph === 2 ? ["tail", "breath", "expose"] : ["tail", "rocks", "breath", "expose"];
    this.pi = 0;
    this.nextMove();
  }
  nextMove() {
    if (this.state !== "fight") return;
    const m = this.plan[this.pi++];
    if (!m) return this.cycle();
    const sp = this.phase === 3 ? 0.8 : this.phase === 2 ? 0.9 : 1;
    const done = (sec) => this.after(sec * sp, () => this.nextMove());
    if (m === "breath") {
      this.breath();
      done(3.4);
    } else if (m === "rocks") {
      this.rocks(this.phase === 1 ? 3 : 4);
      done(2.4);
    } else if (m === "tail") {
      this.tailSweep();
      done(3.0);
    } else if (m === "expose") this.expose();
  }
  breath() {
    this.charge = 1.0;
    this.emit({ type: "sfx", name: "roar" });
    this.tell("breath", "입이 빛나면 불 뿜기! 길의 다른 쪽으로 피해요", 2.6);
    this.after(1.0, () => {
      if (this.state !== "fight") return;
      const s0 = this.aheadS(0.9);
      const hw = this.hw(s0) + 0.4;
      // 길의 왼쪽 · 오른쪽 · 가운데 중 한 곳만 비워 둠
      const safe = Math.floor(Math.random() * 3);
      const parts = [
        [-hw, -hw / 3],
        [-hw / 3, hw / 3],
        [hw / 3, hw],
      ];
      parts.forEach(([a, b], i) => {
        if (i !== safe) this.items.spawnFlames({ s0, s1: s0 + 22, u0: a - (i ? 0 : 0.5), u1: b + (i === 2 ? 0.5 : 0), h: 3.2, life: 2.2, grow: 0.3 });
      });
      this.breathT = 1.8;
      this.breathAt = { s: s0 + 8, u: (parts[(safe + 1) % 3][0] + parts[(safe + 1) % 3][1]) / 2 };
      this.emit({ type: "sfx", name: "flame" });
      this.emit({ type: "shake", k: 0.3 });
    });
  }
  rocks(n) {
    this.emit({ type: "sfx", name: "roar" });
    this.tell("rocks", "하늘에서 바위가 떨어져요 · 붉은 원을 피해요!", 2.2);
    for (let i = 0; i < n; i++) {
      this.after(0.3 + i * 0.3, () => {
        if (this.state !== "fight") return;
        const s = this.aheadS(1.3) + rand(-5, 5);
        const hw = this.hw(s) - 1;
        const u = i === 0 ? clamp(this.P.u, -hw, hw) : rand(-hw, hw);
        this.items.spawnBomb({ s, u, r: 1.9, kind: "rock", from: "sky", flight: 1.4 });
      });
    }
  }
  tailSweep() {
    const P = this.P;
    this.tell("tail", "꼬리가 길을 쓸어요! 붉은 줄에서 점프!", 2.4);
    // 주인공이 sweepS 에 닿을 때쯤 꼬리가 지나가도록
    const lead = 1.5;
    this.sweepS = this.aheadS(lead);
    this.sweepT = -lead + 0.35; // 0 일 때 꼬리가 길 가운데
    this.sweepOn = true;
    this.sweep.visible = true;
    this.emit({ type: "sfx", name: "rumble" });
  }
  expose() {
    // 다음 점프대 (60m 넘게 남은 것) 위로 내려와 가슴 보석을 드러냄
    const P = this.P;
    const R = this.T.ramps.find(([a]) => a - P.s > 45);
    if (!R) return this.after(1, () => this.cycle());
    this.ramp = R;
    this.mode = "toRamp";
    this.state = "exposed";
    this.emit({ type: "sfx", name: "expose" });
    this.emit({ type: "prompt", text: "용이 지쳤어요! 점프대에서 날아올라 가슴의 보석을 쳐요!", dur: 3 });
  }
  onPhase(ph) {
    this.emit({ type: "bossPhase", k: `단계 ${ph}`, h: ph === 2 ? "고대 용이 분노했어요!" : "화산이 폭발해요!", t: ph === 2 ? "꼬리 쓸기가 시작돼요 · 붉은 줄에서 점프!" : "모든 공격이 섞여요 · 끝까지!" });
    this.emit({ type: "theme", theme: ph === 2 ? THEMES.final : THEMES.chase });
    this.emit({ type: "flash", k: 1 });
  }
  die() {
    this.state = "dead";
    this.mode = "dead";
    this.dieT = 0;
    this.beam.material.opacity = 0;
    this.sweep.visible = false;
    this.warnStrip.material.opacity = 0;
    this.emit({ type: "bossDown", h: "고대 용 격파!", t: "화산이 무너져요 · 마지막 탈출!" });
  }
  tick(dt, playing) {
    const P = this.P;
    const t = this.t;
    const hw0 = this.hw(P.s + 8);
    if (this.state === "dead") {
      this.dieT += dt;
      this.du += 6 * dt;
      this.dh -= (2 + this.dieT * 8) * dt;
      this.G.rotation.z += dt * 0.8;
      const p = this.wp(this.ds, this.du, this.dh);
      this.G.position.copy(p);
      if (p.y < this.T.lavaY(this.ds) + 2 && !this.splashed) {
        this.splashed = true;
        this.fx.splash(p.x, this.T.lavaY(this.ds) + 0.5, p.z);
        this.fx.burst(p.x, this.T.lavaY(this.ds) + 3, p.z, 90);
        this.emit({ type: "sfx", name: "boom" });
      }
      if (this.dieT > 5) this.G.visible = false;
      return;
    }
    let wantS = P.s + 8;
    let wantU = hw0 + 13;
    let wantH = 2 + Math.sin(t * 2.2) * 0.5;
    let yaw = this.yawFwd(this.ds);
    let headTurn = 0.9; // 길 쪽(왼쪽)으로 고개
    if (this.mode === "toRamp" || this.mode === "expose") {
      const [a, b] = this.ramp;
      const gemS = b + 11;
      // 길을 가로질러 떠서, 가슴 보석이 착지 구역 위 5.5m 에 오게
      wantS = gemS;
      wantU = 0;
      wantH = 5.5;
      yaw = this.yawFwd(gemS) - Math.PI / 2; // 머리가 왼쪽
      headTurn = 0;
      if (this.mode === "toRamp" && P.s > a - 40) this.mode = "expose";
      if (playing && this.mode === "expose") {
        const gp = this.gem.getWorldPosition(V());
        const me = this.g.playerWorld().setY(P.y + 0.7);
        const dS = P.s - gemS;
        if (Math.abs(dS) < 3.2 && Math.abs(P.u) < 2.8 && me.y > gp.y - 3.4 && me.y < gp.y + 3.6) {
          this.fx.burst(gp.x, gp.y, gp.z, 80, ["#c8f4ff", "#7ae8ff", "#ffffff", "#ffb04a"]);
          this.mode = "run";
          this.state = "fight";
          this.damage(gp);
          if (this.state !== "dead") {
            this.emit({ type: "sfx", name: "roar" });
            this.after(1.6, () => this.cycle());
          }
        } else if (P.s > gemS + 8) {
          this.emit({ type: "prompt", text: "아깝다! 다음 기회를 노려요", dur: 1.8 });
          this.mode = "run";
          this.state = "fight";
          this.after(1.0, () => this.cycle());
        }
      }
    }
    // 이동 (가로질러 오갈 때는 빠르게)
    const rate = this.mode === "run" ? 2.4 : 3.2;
    this.ds = damp(this.ds, wantS, rate, dt);
    this.du = damp(this.du, wantU, this.mode === "run" ? 1.6 : 2.6, dt);
    this.dh = damp(this.dh, wantH, 2.2, dt);
    const S = 2.0;
    // 몸 중심 → 가슴 보석이 목표에 오도록 (로컬 보석 위치 (0,-0.7,2.6)*S)
    let pos;
    if (this.mode === "toRamp" || this.mode === "expose") {
      const g = this.wp(this.ds, this.du, this.dh);
      const off = V(0, -0.7 * S, 2.6 * S).applyAxisAngle(V(0, 1, 0), yaw);
      pos = g.sub(off);
    } else pos = this.wp(this.ds, this.du, this.dh);
    this.G.position.copy(pos);
    this.G.rotation.y = damp(this.G.rotation.y, yaw, 4, dt);
    this.neck.rotation.y = damp(this.neck.rotation.y, headTurn, 3, dt);
    const run = this.mode === "run" ? 1 : 0;
    this.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 8 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.5 * run));
    this.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (run ? Math.sin(t * 3) * 0.25 + 0.2 : Math.sin(t * 5) * 0.6)));
    this.tail.rotation.y = Math.sin(t * 2.5) * 0.25;
    // 불 뿜기
    this.charge = Math.max(0, (this.charge || 0) - dt);
    this.breathT = Math.max(0, (this.breathT || 0) - dt);
    this.mouthGlow.material.opacity = this.charge > 0 ? 0.6 + Math.sin(t * 30) * 0.3 : this.breathT > 0 ? 1 : 0;
    this.jaw.rotation.x = this.charge > 0 || this.breathT > 0 ? 0.5 : 0.05;
    if (this.breathT > 0 && this.breathAt) {
      const from = this.mouthGlow.getWorldPosition(V());
      const to = this.wp(this.breathAt.s, this.breathAt.u, 0);
      const d = from.distanceTo(to);
      this.beam.position.copy(from);
      this.beam.lookAt(to);
      this.beam.rotateX(-Math.PI / 2);
      this.beam.scale.set(1 + Math.sin(t * 40) * 0.1, d, 1 + Math.cos(t * 37) * 0.1);
      this.beam.material.opacity = 0.75;
    } else this.beam.material.opacity = 0;
    // 꼬리 쓸기
    if (this.sweepOn) {
      this.sweepT += dt;
      const s = this.sweepS;
      const hw = this.hw(s) + 1;
      const f = this.T.frame(s, {});
      this.warnStrip.position.copy(this.wp(s, 0, 0.08));
      this.warnStrip.rotation.set(-Math.PI / 2, 0, -Math.atan2(f.tx, f.tz) + Math.PI / 2);
      this.warnStrip.scale.set(hw * 2, 1, 1);
      this.warnStrip.material.opacity = this.sweepT < 0.4 ? 0.3 + Math.sin(t * 18) * 0.15 : 0.15;
      // 꼬리 위치: 오른쪽 밖(+hw+9)에서 왼쪽 밖으로 (속도 26m/s)
      const cu = hw + 9 - (this.sweepT + 0.55) * 26;
      this.sweep.position.copy(this.wp(s, clamp(cu, -hw - 10, hw + 10), 0));
      this.sweep.rotation.y = Math.atan2(f.tx, f.tz) + Math.PI / 2;
      // 꼬리가 몸통 크기(16m)라 cu 주변 ±7m 가 위험
      if (playing && Math.abs(P.s - s) < 1.3 && Math.abs(P.u - cu) < 7.5 && P.y < this.wp(P.s, P.u).y + 1.05) this.emit({ type: "hit", u: cu });
      if (cu < -hw - 9) {
        this.sweepOn = false;
        this.sweep.visible = false;
        this.warnStrip.material.opacity = 0;
      }
    }
    // 보석: 드러났을 때 크게 빛남
    const ex = this.mode === "expose" || this.mode === "toRamp";
    this.gemGlow.material.opacity = ex ? 0.8 + Math.sin(t * 10) * 0.2 : 0.35;
    this.gemGlow.scale.setScalar(ex ? 7 : 3.6);
    this.gem.rotation.y += dt * 2;
  }
}

export const BOSSES = { golem: Golem, wyvern: Wyvern, dragon: Dragon };
