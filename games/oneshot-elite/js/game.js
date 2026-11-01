/*
 * 미션 진행: 맵 불러오기 · 표적 배치(실제로 보이는 자리만) · 조준 · 흔들림 · 숨참기 · 사격 · 명중 부위 · 경계 · 슬로모션 · 점수 · 별
 *  화면(UI)은 app.js 가 맡고, 여기서는 this.hud 값과 이벤트(on)로만 알려 준다.
 */
import { THREE, clamp, lerp, rng, pick, range, glow, canvas, tex } from "./kit.js";
import { Engine } from "./engine.js";
import { Actor, look as makeLook, walkPath, peek } from "./actors.js";
import { Viewmodel } from "./viewmodel.js";
import { buildEnv } from "./env/index.js";
import { LOOKS, DECOYS, missionById } from "./missions.js";

const V = () => new THREE.Vector3();
const ZONE = {
  head: { en: "HEADSHOT", ko: "헤드샷", pts: 1000 },
  chest: { en: "ACCURATE HIT", ko: "정확히 명중", pts: 600 },
  legs: { en: "LIMB HIT", ko: "다리 명중", pts: 350 },
  board: { en: "BULLSEYE", ko: "과녁 명중", pts: 500 },
};
const BASE_FOV = 55;
export const ZOOM_MIN = 3;
export const ZOOM_MAX = 16;
const BOLT_TIME = 1.15;

/* ---------- 보너스 과녁 ---------- */
let BOARD_TEX = null;
function boardTex() {
  if (BOARD_TEX) return BOARD_TEX;
  const c = canvas(256, 256);
  const g = c.getContext("2d");
  const rings = ["#d9a93a", "#f2efe6", "#c8322b", "#f2efe6", "#c8322b", "#f6c945"];
  rings.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(128, 128, 126 - i * 21, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 2;
    g.stroke();
  });
  BOARD_TEX = tex(c, { repeat: false });
  return BOARD_TEX;
}
class Board {
  constructor(night) {
    this.target = true;
    this.isBoard = true;
    this.alive = true;
    this.gone = false;
    this.root = new THREE.Group();
    this.R = 0.46;
    const mat = new THREE.MeshStandardMaterial({ map: boardTex(), roughness: 0.55, metalness: 0.25, emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? boardTex() : null, emissiveIntensity: night ? 0.75 : 0 });
    this.disc = new THREE.Group();
    this.disc.position.y = 1.4;
    this.root.add(this.disc);
    const face = new THREE.Mesh(new THREE.CircleGeometry(this.R, 40), mat);
    face.position.z = 0.03;
    face.castShadow = true;
    face.userData.block = false;
    this.disc.add(face);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(this.R, this.R, 0.05, 40), new THREE.MeshStandardMaterial({ color: 0x3a342a, roughness: 0.8 }));
    back.rotation.x = Math.PI / 2;
    back.userData.block = false;
    this.disc.add(back);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x4a4f54, roughness: 0.5, metalness: 0.6 }));
    post.position.y = 0.55;
    post.userData.block = false;
    this.root.add(post);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(this.R * 1.02, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.scale.z = 0.2;
    hit.userData.hitbox = { actor: this, part: "board" };
    this.disc.add(hit);
    this.hitMesh = hit;
    this.hit = { head: hit, chest: hit };
    if (night) {
      const g = glow(0xffd680, 2.2, 0.55);
      g.position.set(0, 0, 0.15);
      this.disc.add(g);
    }
    this.t = 0;
    this.flip = -1;
  }
  place(pos, yaw) {
    this.root.position.copy(pos);
    this.root.rotation.y = yaw;
  }
  down() {
    if (!this.alive) return;
    this.alive = false;
    this.flip = 0;
  }
  update(dt) {
    if (this.flip >= 0 && this.flip < 1) {
      this.flip = Math.min(1, this.flip + dt * 2.4);
      this.disc.rotation.x = this.flip * 1.5;
    }
  }
  headPos(v = V()) {
    return this.hitMesh.getWorldPosition(v);
  }
  chestPos(v = V()) {
    return this.hitMesh.getWorldPosition(v);
  }
}

/* ---------- 표적 움직임 (actors.js 와 같은 모양) ---------- */
/** 잠깐 나타났다 숨기: t0 부터 dur 동안 창가 · 문가에 */
function popup(inPos, outPos, t0, dur, game) {
  let f = 0;
  return (a, dt) => {
    const t = game.elapsed;
    const on = t >= t0 && t < t0 + dur;
    f = clamp(f + (on ? dt * 2.4 : -dt * 2.4), 0, 1);
    const e = f * f * (3 - 2 * f);
    a.root.position.lerpVectors(inPos, outPos, e);
    a.root.visible = f > 0.01;
    a.exposed = e > 0.5;
    a.speed = f > 0 && f < 1 ? 0.6 : 0;
    if (t >= t0 + dur && f <= 0.01 && !a.gone && a.alive) a.escape = true;
  };
}
/** 엄폐물 뒤: 고개 들었다 숙이기 */
function coverMove(base, { up = 3.2, down = 3.4, phase = 0 } = {}) {
  let t = phase;
  return (a, dt) => {
    t += dt;
    const k = t % (up + down + 1.2);
    let f;
    if (k < 0.6) f = k / 0.6;
    else if (k < 0.6 + up) f = 1;
    else if (k < 1.2 + up) f = 1 - (k - 0.6 - up) / 0.6;
    else f = 0;
    const e = f * f * (3 - 2 * f);
    a.root.position.y = base.y - 0.95 * (1 - e);
    a.exposed = e > 0.6;
    a.speed = 0;
  };
}

/* ---------- 게임 ---------- */
export class Game {
  constructor({ canvas: canvasEl, quality = "high", onProgress }) {
    this.engine = new Engine(canvasEl, { quality });
    this.vm = new Viewmodel(this.engine);
    this.listeners = {};
    this.state = "menu";
    this.env = null;
    this.envKey = "";
    this.actors = [];
    this.fxItems = [];
    this.pending = [];
    this.mission = null;
    this.input = { breath: false };
    this.yaw = 0;
    this.pitch = -0.1;
    this.scoped = false;
    this.ads = 0;
    this.zoom = 6;
    this.fov = BASE_FOV;
    this.t = 0;
    this.noSway = false;
    this.settings = { sens: 1, invert: false, swayScale: 1, assist: false };
    this.hud = {};
    this.look = { dx: 0, dy: 0 };
    this.slow = 0;
    this.timeScale = 1;
    this.frameT = 0;
    this.fxRoot = new THREE.Group();
    this.engine.scene.add(this.fxRoot);
    this.tracer = this.makeTracer();
    this.onProgress = onProgress;
    this.last = performance.now();
    this.running = false;
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.fps = 60;
    this.engine.resize();
  }

  on(name, fn) {
    (this.listeners[name] = this.listeners[name] || []).push(fn);
    return this;
  }
  emit(name, data) {
    for (const f of this.listeners[name] || []) f(data);
  }

  /* ---------- 맵 ---------- */
  async useEnv(spec) {
    const key = `${spec.map}|${spec.seed}|${spec.vantage}|${!!spec.night}`;
    if (this.envKey !== key) {
      this.disposeEnv();
      // 불러오는 글자가 그려질 틈
      await new Promise((r) => setTimeout(r, 30));
      this.env = buildEnv(spec);
      this.envKey = key;
      this.engine.scene.add(this.env.root);
      this.colliders = [];
      this.env.root.traverse((o) => {
        if (o.isMesh && o.userData.block !== false) this.colliders.push(o);
      });
    }
    const E = this.engine;
    E.nest.copy(this.env.nest.pos);
    E.setAtmos(spec.atmos || "day", { shadowCenter: this.env.shadowCenter, shadowSize: this.env.shadowSize, seed: spec.seed, mountains: this.env.mountains !== false, smoke: this.env.smoke || [], wind: this.env.wind || [6, 0, -2] });
    E.renderer.shadowMap.needsUpdate = true;
    E.resize();
  }

  disposeEnv() {
    if (!this.env) return;
    this.engine.scene.remove(this.env.root);
    this.env.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    });
    this.env = null;
    this.envKey = "";
  }

  /** 첫 화면 배경 (저격 위치에서 도시를 천천히 둘러봄) */
  async backdrop() {
    this.clearActors();
    this.mission = null;
    await this.useEnv({ map: "city", seed: 3, vantage: "plaza", atmos: "day" });
    this.state = "menu";
    this.scoped = false;
    this.ads = 0;
    this.engine.vmVisible = true;
    this.engine.nv = 0;
  }

  clearActors() {
    for (const a of this.actors) this.engine.scene.remove(a.root);
    this.actors = [];
    for (const f of this.fxItems) this.fxRoot.remove(f.obj);
    this.fxItems = [];
    this.pending = [];
    this.tracer.visible = false;
  }

  /* ---------- 표적 세우기 ---------- */
  /** 저격 위치에서 그 점까지 막힘이 없나 (건물 · 나무) */
  clearLine(to) {
    const from = this.engine.nest;
    const dir = V().copy(to).sub(from);
    const d = dir.length();
    dir.normalize();
    const R = this.engine.ray;
    R.set(from, dir);
    R.far = d - 0.25;
    if (R.intersectObjects(this.colliders, false).length) return false;
    for (const t of this.env.treeSpheres || []) {
      const c = V().set(t.x, t.y, t.z).sub(from);
      const along = c.dot(dir);
      if (along < 0 || along > d) continue;
      if (c.lengthSq() - along * along < t.r * t.r) return false;
    }
    return true;
  }
  /** 저격 위치에서 고개 돌려 볼 수 있는 범위인가 */
  inView(p) {
    const n = this.env.nest;
    const dx = p.x - this.engine.nest.x;
    const dz = p.z - this.engine.nest.z;
    const dy = p.y - this.engine.nest.y;
    const yaw = Math.atan2(-dx, -dz);
    const rel = Math.atan2(Math.sin(yaw - n.yaw), Math.cos(yaw - n.yaw));
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    return Math.abs(rel) < n.range - 0.04 && pitch > n.pitchMin + 0.02 && pitch < n.pitchMax - 0.02;
  }
  distTo(p) {
    return p.distanceTo(this.engine.nest);
  }

  /** 자리 고르기: 종류 · 거리 · 보임 · 겹치지 않음 */
  chooseSpot(types, dist, r, used, opts = {}) {
    const all = [];
    for (const t of types) for (const s of this.env.spots[t] || []) all.push(s);
    // 씨앗으로 섞기
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const tries = [dist, [dist[0] * 0.8, dist[1] * 1.25], [20, 420]];
    for (const [d0, d1] of tries)
      for (const sp of all) {
        if (used.has(sp)) continue;
        if (sp.path) {
          if (this.pathScore(sp.path, d0, d1) < 0.55) continue;
          used.add(sp);
          return sp;
        }
        const p = (sp.out || sp.pos).clone();
        const d = this.distTo(p);
        if (d < d0 || d > d1) continue;
        const heights = opts.heights || [1.62, 1.25];
        const top = p.clone();
        top.y += heights[0];
        if (!this.inView(top)) continue;
        if (!heights.every((h) => this.clearLine(p.clone().setY(p.y + h)))) continue;
        if (opts.near && sp.pos.distanceTo(opts.near) > opts.nearR) continue;
        let close = false;
        for (const u of used) {
          const q = u.pos || (u.path && u.path[0]);
          if (q && q.distanceTo(sp.pos) < 2.2) close = true;
        }
        if (close) continue;
        used.add(sp);
        return sp;
      }
    return null;
  }
  pathScore(path, d0, d1) {
    let ok = 0;
    let n = 0;
    for (let i = 0; i < path.length - 1; i++) {
      for (let k = 0; k < 5; k++) {
        const p = V().lerpVectors(path[i], path[i + 1], (k + 0.5) / 5);
        p.y += 1.5;
        n++;
        const d = this.distTo(p);
        if (d >= d0 && d <= d1 && this.inView(p) && this.clearLine(p)) ok++;
      }
    }
    return n ? ok / n : 0;
  }

  /** 스펙으로 사람 한 명 세우기 */
  spawn(L, sp, spec, role, r) {
    const a = new Actor(L, { target: role === "target", civilian: role !== "target", id: this.actors.length, pose: spec.pose || "stand" });
    a.role = role;
    a.spec = spec;
    a.spot = sp;
    a.optional = !!spec.optional;
    a.vest = !!spec.vest;
    a.moving = false;
    const move = spec.move || "stand";
    if (sp.path) {
      const pts = sp.fixed || r() < 0.5 ? sp.path : [...sp.path].reverse();
      const start = pts[0].clone();
      a.place(start, Math.atan2(pts[1].x - start.x, pts[1].z - start.z));
      a.moving = true;
      a.baseSpeed = spec.speed || 1.25;
      const once = !!spec.once;
      a.walkPts = pts;
      a.behavior = walkPath(pts, {
        speed: a.baseSpeed,
        loop: !once,
        pause: spec.pause ?? 1.2,
        onEnd: once
          ? (act) => {
              act.escape = true;
            }
          : null,
      });
    } else if (move === "peek" && sp.in) {
      a.place(sp.in, sp.yaw);
      a.behavior = peek(sp.in, sp.out, { show: spec.show || 4, hide: spec.hide || 3, phase: r() * 3 });
    } else if (move === "popup") {
      const inP = sp.in || sp.pos.clone().add(new THREE.Vector3(0, -1.8, 0));
      const outP = sp.out || sp.pos;
      a.place(inP, sp.yaw);
      a.root.visible = false;
      const [t0, dur] = spec.appear;
      a.behavior = popup(inP, outP, t0, dur, this);
    } else if (move === "cover") {
      a.place(sp.pos, sp.yaw);
      a.behavior = coverMove(sp.pos, { phase: r() * 3 });
    } else if (move === "pace" && (sp.along || sp.type === "ground")) {
      const al = sp.along ? new THREE.Vector3(sp.along[0], 0, sp.along[2]) : new THREE.Vector3(1, 0, 0);
      const len = sp.len ?? 3.5;
      // 벽 · 난간을 넘지 않게 이동 폭을 재서 둘 다 보이는 끝점으로
      const p0 = sp.pos.clone().addScaledVector(al, -len);
      const p1 = sp.pos.clone().addScaledVector(al, len);
      const seeA = (q) => this.clearLine(q.clone().setY(q.y + 1.6));
      const pts = [seeA(p0) ? p0 : sp.pos.clone(), seeA(p1) ? p1 : sp.pos.clone()];
      if (pts[0].distanceTo(pts[1]) < 0.5) pts[1] = sp.pos.clone().addScaledVector(al, 0.6);
      a.place(pts[0], sp.yaw);
      a.moving = true;
      a.baseSpeed = 0.95;
      a.walkPts = pts;
      a.behavior = walkPath(pts, { speed: 0.95, loop: true, pause: 2.2 });
    } else {
      a.place(sp.out || sp.pos, sp.yaw);
    }
    this.engine.scene.add(a.root);
    a.root.updateMatrixWorld(true);
    this.actors.push(a);
    return a;
  }

  placeActors(m) {
    const r = rng(m.env.seed * 977 + m.n * 13 + m.w * 7);
    const used = new Set();
    const groups = {};
    // 표적
    for (const spec of m.targets || []) {
      const def = LOOKS[spec.look];
      const L = makeLook(def.kind, m.n * 3 + 5, { ...(def.over || {}), ...(spec.vest ? { vest: "#2f3424" } : {}) });
      let sp = null;
      const leader = spec.group ? groups[spec.group] : null;
      if (leader && leader.walkPts) {
        // 같은 무리: 대장 옆에서 같은 길을 나란히 걸음
        const off = new THREE.Vector3(1.1, 0, 1.3);
        sp = { type: "street", path: leader.walkPts.map((q) => q.clone().add(off)), fixed: true };
      } else if (leader) sp = this.chooseSpot(spec.at, spec.dist, r, used, { near: leader.spot.pos, nearR: 14 });
      // 엄폐물 뒤 표적은 일어섰을 때 머리만 보이면 됨
      if (!sp) sp = this.chooseSpot(spec.at, spec.dist, r, used, spec.move === "cover" ? { heights: [1.62] } : {});
      if (!sp) {
        console.warn("표적 자리 없음", m.id, spec);
        continue;
      }
      const act = this.spawn(L, sp, spec, "target", r);
      if (spec.group && !leader) groups[spec.group] = act;
    }
    // 미끼 (한 군데만 다름)
    if (m.decoys) {
      const key = m.targets[0].look;
      const def = LOOKS[key];
      const vars = DECOYS[key] || [{}];
      for (let i = 0; i < m.decoys; i++) {
        const L = makeLook(def.kind, 40 + i * 3, { ...(def.over || {}), ...vars[i % vars.length] });
        const sp = this.chooseSpot(m.decoyAt || m.targets[0].at, m.targets[0].dist, r, used);
        if (sp) this.spawn(L, sp, { move: "stand" }, "decoy", r);
      }
    }
    // 과녁
    this.boards = [];
    if (m.boards) {
      const night = !!m.env.night;
      const types = m.boardAt;
      let tries = 0;
      while (this.boards.length < m.boards && tries++ < 40) {
        const t = types[tries % types.length];
        // 과녁판 위 · 가운데 · 아래가 모두 보이는 자리만
        const sp = this.chooseSpot([t], [50, 240], r, used, { heights: [1.86, 1.4, 0.98] });
        if (!sp || sp.path) continue;
        const b = new Board(night);
        const base = (sp.out || sp.pos).clone();
        b.place(base, sp.yaw);
        b.role = "target";
        b.spot = sp;
        b.exposed = true;
        this.engine.scene.add(b.root);
        b.root.updateMatrixWorld(true);
        this.actors.push(b);
        this.boards.push(b);
      }
    }
    // 민간인 · 일꾼
    const civAt = m.civAt || {};
    let suits = m.civSuit || 0;
    let n = 0;
    for (const [type, cnt] of Object.entries(civAt)) {
      for (let i = 0; i < cnt; i++) {
        const kind = m.civKind || "civ";
        let L;
        if (suits > 0) {
          // 비슷하게 차려입은 민간인 (넥타이 · 안경이 다름)
          L = makeLook("agent", 60 + n, { tie: pick(r, ["#2f5fb0", "#3e7a4a", null]), glasses: null, jacket: pick(r, ["#1e2026", "#2a2d33", "#33363d"]) });
          suits--;
        } else L = makeLook(kind, 100 + n * 7 + m.n);
        n++;
        const sp = this.chooseSpot([type], [25, 260], r, used);
        if (!sp) continue;
        const walk = !!sp.path;
        const move = walk ? "walk" : type === "window" && r() < 0.5 ? "peek" : (type === "ground" || type === "deck" || type === "container") && r() < 0.5 ? "pace" : "stand";
        const a = this.spawn(L, sp, { move, speed: range(r, 1.0, 1.5), show: 5, hide: 5, pose: !walk && r() < 0.25 ? "phone" : "stand" }, "civ", r);
        a.exposedAlways = false;
      }
    }
    this.required = this.actors.filter((a) => a.role === "target" && !a.optional);
    this.need = m.boards ? this.boards.length : m.need ?? this.required.length;
    this.totalTargets = this.actors.filter((a) => a.role === "target").length;
  }

  /* ---------- 미션 시작 ---------- */
  async start(id) {
    const m = missionById(id);
    this.mission = m;
    this.state = "loading";
    this.clearActors();
    await this.useEnv(m.env);
    this.placeActors(m);
    const n = this.env.nest;
    this.yaw = n.yaw;
    this.pitch = -0.08;
    this.scoped = false;
    this.ads = 0;
    this.zoom = 6;
    this.fov = BASE_FOV;
    this.ammo = m.ammo;
    this.shots = 0;
    this.hits = 0;
    this.heads = 0;
    this.kills = 0;
    this.score = 0;
    this.timeLeft = m.time;
    this.elapsed = 0;
    this.cool = 0;
    this.breath = 1;
    this.breathCool = 0;
    this.holding = false;
    this.alertT = -1;
    this.alerted = false;
    this.endT = -1;
    this.ended = false;
    this.endInfo = null;
    this.usedHint = false;
    this.longest = 0;
    this.slow = 0;
    this.timeScale = 1;
    this.lastKillT = -9;
    this.recoil = 0;
    this.recoilX = 0;
    this.marks = new Set();
    this.engine.nv = 0;
    this.nvOn = false;
    this.engine.vmVisible = true;
    this.engine.renderer.shadowMap.needsUpdate = true;
    this.state = "ready";
    this.emit("ready", m);
  }
  begin() {
    if (this.state !== "ready") return;
    this.state = "play";
    this.emit("begin", this.mission);
  }
  pause(on) {
    if (on && this.state === "play") {
      this.state = "pause";
      this.input.breath = false;
    } else if (!on && this.state === "pause") this.state = "play";
  }

  /* ---------- 입력 ---------- */
  /** 화면 위 끌기 / 마우스 움직임 (px) */
  lookBy(dx, dy, kind = "mouse") {
    if (this.state !== "play") return;
    const fovR = (this.fov * Math.PI) / 180;
    const H = this.engine.canvas.clientHeight || 720;
    const per = kind === "touch" ? (fovR / H) * 1.25 : (fovR / 720) * 0.75;
    const s = per * this.settings.sens;
    const a = -dx * s;
    const b = -dy * s * (this.settings.invert ? -1 : 1);
    this.yaw += a;
    this.pitch += b;
    this.look.dx += a;
    this.look.dy += b;
    this.clampView();
  }
  clampView() {
    const n = this.env.nest;
    this.yaw = clamp(this.yaw, n.yaw - n.range, n.yaw + n.range);
    this.pitch = clamp(this.pitch, n.pitchMin, n.pitchMax);
  }
  setScoped(on) {
    if (this.state !== "play") return;
    if (this.scoped === on) return;
    this.scoped = on;
    this.emit("scope", on);
  }
  toggleScope() {
    this.setScoped(!this.scoped);
  }
  zoomBy(k) {
    this.zoom = clamp(this.zoom * k, ZOOM_MIN, ZOOM_MAX);
  }
  setZoom(z) {
    this.zoom = clamp(z, ZOOM_MIN, ZOOM_MAX);
  }
  toggleNV() {
    if (!this.mission || !this.mission.env.night) return false;
    this.nvOn = !this.nvOn;
    this.emit("nv", this.nvOn);
    return true;
  }
  /** 조준점 근처 사람을 표시 (또는 해제) */
  spot() {
    if (this.state !== "play") return null;
    const a = this.actorAtCenter();
    if (!a) {
      this.emit("toast", "조준점을 사람에게 가까이 대고 표시해요");
      return null;
    }
    if (this.marks.has(a)) this.marks.delete(a);
    else this.marks.add(a);
    this.emit("spot", a);
    return a;
  }
  actorAtCenter() {
    const cam = this.engine.camera;
    let best = null;
    let bestD = 0.09;
    const p = V();
    for (const a of this.actors) {
      if (!a.alive || a.gone || !a.root.visible) continue;
      p.copy(a.headPos(p)).project(cam);
      if (p.z > 1) continue;
      const d = Math.hypot(p.x, p.y);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }
  hint() {
    if (this.state !== "play") return;
    this.usedHint = true;
    const left = this.actors.filter((a) => a.role === "target" && a.alive && !a.gone);
    if (left.length) this.emit("hint", left[0]);
  }

  /* ---------- 사격 ---------- */
  canFire() {
    return this.state === "play" && this.cool <= 0 && this.ammo > 0 && !this.ended;
  }
  fire() {
    if (!this.canFire()) {
      if (this.state === "play" && this.ammo <= 0) this.emit("dry");
      return false;
    }
    this.ammo--;
    this.shots++;
    this.cool = BOLT_TIME;
    this.recoil = 1;
    this.recoilX = (Math.random() - 0.5) * 0.4;
    const E = this.engine;
    this.vm.fire();
    E.flash = this.scoped ? 0.1 : 0.22;
    this.emit("fire");
    setTimeout(() => {
      if (this.state === "play" || this.state === "slow") {
        this.vm.cycle();
        this.emit("bolt");
      }
    }, 420);
    // 판정
    E.camera.updateMatrixWorld();
    const targets = [...this.colliders];
    for (const a of this.actors) {
      if (!a.alive || a.gone || !a.root.visible) continue;
      if (a.isBoard) targets.push(a.hitMesh);
      else targets.push(a.hit.head, a.hit.chest, a.hit.legs);
    }
    const from = E.camera.position.clone();
    E.ray.setFromCamera({ x: 0, y: 0 }, E.camera);
    E.ray.far = 2500;
    const dir = E.ray.ray.direction.clone();
    const hits = E.ray.intersectObjects(targets, false);
    const h = hits[0] || null;
    const d = h ? h.distance : 800;
    const point = h ? h.point.clone() : from.clone().addScaledVector(dir, 800);
    const hb = h && h.object.userData.hitbox;
    const shot = { t: d / 820, d, point, hb, dir, normal: h && h.face ? h.face.normal.clone() : null };
    if (hb) this.resolvePreview(shot);
    this.shootTracer(from, point, dir, shot.t);
    this.pending.push(shot);
    // 총소리 → 경계
    if (this.alertT < 0) {
      this.alertT = this.mission.alert;
      this.alerted = true;
      this.alarm();
    }
    return true;
  }
  /** 이 총알이 끝내기 한 발인지 미리 판단 → 슬로모션 */
  resolvePreview(shot) {
    const a = shot.hb.actor;
    if (a.role !== "target" || (a.vest && shot.hb.part !== "head")) return;
    const left = this.needLeft();
    const killsAll = left <= 1 && this.required.filter((x) => x.alive && x !== a).length === 0;
    if (killsAll || (shot.hb.part === "head" && shot.d > 120)) {
      this.slow = killsAll ? 1.5 : 0.75;
      this.emit("slow", { d: shot.d, final: killsAll });
    }
  }
  needLeft() {
    const done = this.actors.filter((a) => a.role === "target" && !a.alive).length;
    return Math.max(0, this.need - done);
  }
  alarm() {
    for (const a of this.actors) {
      if (a.isBoard || !a.alive) continue;
      if (a.role !== "target") {
        // 민간인: 걸음이 빨라지거나 안으로 숨음
        if (a.moving && a.walkPts) a.behavior = walkPath(a.walkPts, { speed: 3.1, loop: true, pause: 0.3 });
        else if (a.spot && a.spot.in) a.behavior = peek(a.root.position.clone(), a.spot.in, { show: 999, hide: 0, phase: 0 });
      }
    }
    this.emit("alarm");
  }
  /** 달아나기 시작 / 끝 */
  fleeAll() {
    for (const a of this.actors) {
      if (a.role !== "target" || a.isBoard || !a.alive || a.gone) continue;
      if (a.spec && a.spec.move === "popup") continue;
      a.escape = true;
    }
  }

  applyHit(shot) {
    const hb = shot.hb;
    if (!hb) {
      this.impact(shot.point, shot.dir, false);
      this.emit("miss", { point: shot.point });
      return;
    }
    const a = hb.actor;
    const part = hb.part;
    if (!a.alive || a.gone) {
      this.impact(shot.point, shot.dir, false);
      return;
    }
    if (a.role === "target") {
      if (a.vest && part !== "head") {
        this.impact(shot.point, shot.dir, true);
        this.emit("feed", { en: "ARMOR BLOCK", ko: "조끼에 막혔어요! 머리를 노려요", pts: 0, bad: true });
        this.emit("armor");
        return;
      }
      this.hits++;
      this.longest = Math.max(this.longest || 0, shot.d);
      if (part === "head") this.heads++;
      this.kills++;
      a.down(part);
      const z = ZONE[part] || ZONE.chest;
      let pts = z.pts;
      const tags = [];
      if (a.isBoard) {
        // 가운데일수록 점수 큼
        const c = a.hitMesh.getWorldPosition(V());
        const off = c.distanceTo(shot.point) / a.R;
        pts = Math.round(lerp(1000, 300, clamp(off, 0, 1)));
      }
      if (shot.d > 150) {
        const b = Math.round(shot.d * 2);
        pts += b;
        tags.push(`LONG SHOT +${b}`);
      }
      if (a.moving && !a.isBoard) {
        pts += 200;
        tags.push("MOVING +200");
      }
      if (this.elapsed - this.lastKillT < 2.2) {
        pts += 300;
        tags.push("DOUBLE +300");
      }
      this.lastKillT = this.elapsed;
      this.score += pts;
      this.impact(shot.point, shot.dir, true);
      this.emit("feed", { en: z.en, ko: z.ko, pts, tags, part, d: Math.round(shot.d) });
      this.emit("hit", { part, actor: a });
      this.marks.delete(a);
      this.checkEnd();
    } else {
      this.impact(shot.point, shot.dir, true);
      a.down(part);
      this.emit("feed", { en: a.role === "decoy" ? "WRONG TARGET" : "CIVILIAN HIT", ko: a.role === "decoy" ? "미끼를 맞혔어요" : "민간인을 맞혔어요", pts: 0, bad: true });
      this.finish(false, a.role === "decoy" ? "진짜 표적이 아니었어요. 표적이 달아났어요." : "엉뚱한 사람을 맞혔어요. 브리핑의 특징을 다시 확인해요.");
    }
  }

  checkEnd() {
    if (this.ended) return;
    const ts = this.actors.filter((a) => a.role === "target");
    const done = ts.filter((a) => !a.alive).length;
    const reqAlive = this.required.filter((a) => a.alive && !a.gone).length;
    const reqGone = this.required.filter((a) => a.gone && a.alive).length;
    const hasOpt = ts.some((a) => a.optional);
    if (hasOpt) {
      // 필수 표적을 맞힌 뒤에도 달아나기 전까지 남은 표적을 더 맞힐 수 있음
      if (reqAlive === 0 && reqGone === 0) {
        const active = ts.filter((a) => a.alive && !a.gone).length;
        if (active === 0) this.finish(true);
      } else if (reqGone > 0) this.finish(false, "표적이 달아났어요.");
      return;
    }
    if (done >= this.need) {
      this.finish(true);
      return;
    }
    // 남은 표적으로 목표를 못 채움
    const reachable = ts.filter((a) => a.alive && !a.gone).length;
    if (done + reachable < this.need) this.finish(false, "표적이 달아났어요.");
  }

  finish(ok, reason = "") {
    if (this.ended) return;
    this.ended = true;
    this.endInfo = { ok, reason };
    this.endT = ok ? 1.5 : 1.1;
    this.input.breath = false;
  }

  stars(ok) {
    const m = this.mission;
    if (!ok) return [false, false, false];
    const ts = this.actors.filter((a) => a.role === "target");
    const s2 = { nomiss: this.shots === this.hits, head: this.heads >= ts.filter((a) => !a.alive).length && this.heads > 0, all: ts.every((a) => !a.alive) }[m.star2 || "nomiss"];
    const s3 = this.elapsed <= m.par && !this.usedHint;
    return [true, m.t === "bonus" ? this.shots === this.hits : !!s2, s3];
  }

  makeResult() {
    const { ok, reason } = this.endInfo;
    const m = this.mission;
    const st = this.stars(ok);
    const n = st.filter(Boolean).length;
    const timeBonus = ok ? Math.round(this.timeLeft * 5) : 0;
    const ammoBonus = ok ? this.ammo * 100 : 0;
    const acc = this.shots ? this.hits / this.shots : 0;
    const accBonus = ok ? Math.round(acc * 500) : 0;
    const starBonus = n * 500;
    const total = this.score + timeBonus + ammoBonus + accBonus + (ok ? starBonus : 0);
    return { id: m.id, mission: m, ok, reason, stars: st, starCount: n, score: ok ? total : this.score, breakdown: { kills: this.score, time: timeBonus, ammo: ammoBonus, acc: accBonus, stars: starBonus }, accuracy: Math.round(acc * 100), time: this.elapsed, shots: this.shots, hits: this.hits, heads: this.heads, usedHint: this.usedHint, bestD: Math.round(this.longest || 0) };
  }

  /* ---------- 효과 ---------- */
  makeTracer() {
    const g = glow(0xfff0c8, 1, 0);
    g.scale.set(0.5, 0.5, 1);
    g.visible = false;
    this.fxRootAdd = g;
    this.fxRoot.add(g);
    return g;
  }
  shootTracer(from, to, dir, t) {
    const T = this.tracer;
    T.visible = true;
    T.material.opacity = 0.9;
    T.userData = { from: from.clone().addScaledVector(dir, 2), to: to.clone(), t: 0, dur: Math.max(0.04, t) };
  }
  impact(point, dir, soft) {
    const col = soft ? 0xe8d6b0 : 0xbdb6a6;
    for (let i = 0; i < 5; i++) {
      const s = glow(col, 0.2, 0.5);
      s.material.blending = THREE.NormalBlending;
      s.position.copy(point);
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.8, (Math.random() - 0.5) * 1.5).addScaledVector(dir, -1.4);
      this.fxRoot.add(s);
      this.fxItems.push({ obj: s, v, t: 0, life: 0.5 + Math.random() * 0.4, s0: 0.15 + Math.random() * 0.15, s1: 0.7 + Math.random() * 0.8, op: 0.5 });
    }
    const spark = glow(0xffe0a0, 0.6, 1);
    spark.position.copy(point);
    this.fxRoot.add(spark);
    this.fxItems.push({ obj: spark, v: new THREE.Vector3(), t: 0, life: 0.09, s0: 0.5, s1: 0.2, op: 1 });
  }

  /* ---------- 테스트 ---------- */
  aimAt(a, part = "head") {
    const p = (part === "head" ? a.headPos(V()) : a.chestPos(V())).sub(this.engine.nest);
    this.yaw = Math.atan2(-p.x, -p.z);
    this.pitch = Math.atan2(p.y, Math.hypot(p.x, p.z));
    this.engine.look(this.yaw, this.pitch, this.fov, 0, 0);
    this.engine.camera.updateMatrixWorld();
  }

  /* ---------- 흔들림 ---------- */
  sway(t) {
    if (this.noSway) return [0, 0];
    const held = this.holding ? 0.1 : 1;
    const tired = this.breathCool > 0 ? 2.1 : 1;
    const atm = this.mission && this.mission.env.atmos === "storm" ? 1.45 : 1;
    const amp = 0.0042 * held * tired * atm * this.settings.swayScale;
    const k = this.scoped ? 1 : 0.2;
    return [(Math.sin(t * 0.83) + 0.55 * Math.sin(t * 1.71 + 1.2) + 0.2 * Math.sin(t * 4.1)) * amp * k, (Math.cos(t * 1.13) * 0.8 + 0.45 * Math.sin(t * 2.07) + 0.15 * Math.cos(t * 3.7)) * amp * k];
  }

  /* ---------- 한 프레임 ---------- */
  frame(now) {
    // 오래 걸린 불러오기 직후엔 이번 프레임 시각이 앞설 수 있음 (음수 막기)
    const raw = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.fpsAcc += raw;
    this.fpsN++;
    if (this.fpsAcc > 1) {
      this.fps = this.fpsN / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsN = 0;
      // 느리면 해상도를 조금씩 낮춤 (두 번 연속 느릴 때)
      if (this.fps < 27 && (this.state === "play" || this.state === "menu")) {
        this.slowSec = (this.slowSec || 0) + 1;
        const E = this.engine;
        if (this.slowSec >= 2 && (E.scale || 1) > 0.56) {
          E.scale = (E.scale || 1) * 0.82;
          E.resize();
          this.slowSec = 0;
        }
      } else this.slowSec = 0;
    }
    // 슬로모션
    let scale = 1;
    if (this.slow > 0) {
      this.slow -= raw;
      scale = 0.14;
    }
    this.timeScale = scale;
    const dt = raw * scale;
    this.t += raw;
    const E = this.engine;
    if (!this.env) return;
    if (this.state === "menu") {
      // 첫 화면: 천천히 둘러보기
      const n = this.env.nest;
      const u = Math.sin(this.t * 0.07);
      const yaw = n.yaw + u * 0.22;
      const pitch = -0.085 + Math.sin(this.t * 0.11) * 0.012;
      this.env.update(raw);
      E.look(yaw, pitch, BASE_FOV);
      E.tick(raw);
      this.vm.update(raw, { dx: u * 0.002, dy: 0 }, 0);
      E.render();
      return;
    }
    if (this.state === "loading") return;
    const paused = this.state === "pause";
    if (!paused) {
      this.env.update(dt);
      for (const a of this.actors) {
        a.update(dt);
        if (a.escape && !a.gone && a.alive) {
          a.gone = true;
          a.root.visible = false;
          if (this.state === "play") this.checkEnd();
        }
      }
    }
    if (this.state === "play" || this.state === "ready") this.updatePlay(dt, raw);
    // 총알 도착
    if (!paused) {
      for (const s of this.pending) {
        s.t -= dt;
        if (s.t <= 0 && !s.done) {
          s.done = true;
          this.applyHit(s);
        }
      }
      this.pending = this.pending.filter((s) => !s.done);
      // 예광 · 먼지
      const T = this.tracer;
      if (T.visible) {
        const u = T.userData;
        u.t += dt;
        const k = clamp(u.t / u.dur, 0, 1);
        T.position.lerpVectors(u.from, u.to, k);
        const sz = lerp(0.35, 0.5 + u.from.distanceTo(u.to) * 0.012, k);
        T.scale.set(sz, sz, 1);
        if (k >= 1) T.visible = false;
      }
      for (const f of this.fxItems) {
        f.t += dt;
        const k = f.t / f.life;
        f.obj.position.addScaledVector(f.v, dt);
        f.v.y -= dt * 0.8;
        const s = lerp(f.s0, f.s1, Math.min(1, k));
        f.obj.scale.set(s, s, 1);
        f.obj.material.opacity = f.op * (1 - Math.min(1, k));
        if (k >= 1) {
          this.fxRoot.remove(f.obj);
          f.dead = true;
        }
      }
      this.fxItems = this.fxItems.filter((f) => !f.dead);
    }
    // 끝
    if (this.ended && !paused && this.state === "play") {
      this.endT -= raw;
      if (this.endT <= 0 && this.slow <= 0) {
        this.state = "end";
        this.setScopedForce(false);
        this.emit("end", this.makeResult());
      }
    }
    // 카메라
    const target = this.scoped ? BASE_FOV / this.zoom : BASE_FOV;
    const killZoom = this.slow > 0 && this.scoped ? 0.8 : 1;
    this.fov = lerp(this.fov, target * killZoom, Math.min(1, raw * (this.scoped ? 14 : 12)));
    this.ads = clamp(this.ads + (this.scoped ? raw : -raw) * 6, 0, 1);
    this.recoil = Math.max(0, this.recoil - raw * 3.4);
    const rk = this.recoil * this.recoil;
    const [sx, sy] = this.sway(this.t);
    const scopeKick = (this.fov / BASE_FOV) * 0.09;
    E.look(this.yaw, this.pitch, this.fov, sx + rk * this.recoilX * scopeKick, sy + rk * scopeKick);
    // 야간 투시 켜고 끄기
    E.nv = lerp(E.nv, this.nvOn ? 1 : 0, Math.min(1, raw * 9));
    E.vmVisible = this.ads < 0.97;
    E.tick(dt > 0 ? raw : 0);
    this.vm.update(raw, this.look, this.ads);
    this.look.dx = 0;
    this.look.dy = 0;
    E.render();
    this.updateHud(raw);
  }
  setScopedForce(v) {
    if (this.scoped !== v) {
      this.scoped = v;
      this.emit("scope", v);
    }
  }

  updatePlay(dt, raw) {
    if (this.state !== "play") return;
    this.elapsed += dt;
    if (!this.ended) {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0) this.finish(false, "시간이 다 됐어요.");
    }
    this.cool = Math.max(0, this.cool - dt);
    // 숨참기
    const want = this.input.breath && this.scoped;
    if (this.breathCool > 0) {
      this.breathCool = Math.max(0, this.breathCool - dt);
      this.holding = false;
    } else if (want && this.breath > 0) {
      if (!this.holding) this.emit("breath", true);
      this.holding = true;
      this.breath = Math.max(0, this.breath - dt / 4);
      if (this.breath <= 0) {
        this.holding = false;
        this.breathCool = 2.4;
        this.emit("gasp");
      }
    } else {
      if (this.holding) this.emit("breath", false);
      this.holding = false;
    }
    if (!this.holding) this.breath = Math.min(1, this.breath + dt / (this.breathCool > 0 ? 8 : 3));
    // 경계 시간
    if (this.alertT > 0) {
      this.alertT -= dt;
      if (this.alertT <= 0) {
        this.alertT = 0;
        this.fleeAll();
        this.checkEnd();
      }
    }
    // 총알 다 씀
    if (!this.ended && this.ammo <= 0 && !this.pending.length && this.cool < BOLT_TIME - 0.3) {
      const need = this.needLeft();
      const opt = this.actors.some((a) => a.role === "target" && a.optional);
      if (need > 0 && !(opt && this.required.every((a) => !a.alive))) this.finish(false, "총알이 떨어졌어요.");
      else if (opt && this.required.every((a) => !a.alive)) this.finish(true);
    }
  }

  updateHud(raw) {
    const m = this.mission;
    if (!m) return;
    const E = this.engine;
    const H = this.hud;
    H.ammo = this.ammo;
    H.ammoMax = m.ammo;
    H.time = this.timeLeft;
    H.need = this.need;
    H.done = this.actors.filter((a) => a.role === "target" && !a.alive).length;
    H.total = this.totalTargets;
    H.zoom = this.zoom;
    H.scoped = this.scoped;
    H.ads = this.ads;
    H.breath = this.breath;
    H.breathCool = this.breathCool;
    H.holding = this.holding;
    H.cool = this.cool / BOLT_TIME;
    H.score = this.score;
    H.alert = this.alertT > 0 ? this.alertT : 0;
    H.alertMax = m.alert;
    // 거리 재기 (다섯 프레임에 한 번)
    this.rangeTick = (this.rangeTick || 0) + 1;
    if (this.scoped && this.rangeTick % 5 === 0) {
      E.ray.setFromCamera({ x: 0, y: 0 }, E.camera);
      E.ray.far = 1500;
      const h = E.ray.intersectObjects(this.colliders, false)[0];
      H.range = h ? Math.round(h.distance) : null;
    }
    // 표시한 사람 화면 위치
    const W = E.canvas.clientWidth;
    const Ht = E.canvas.clientHeight;
    H.marks = [];
    const p = V();
    for (const a of this.marks) {
      if (!a.alive || a.gone) {
        this.marks.delete(a);
        continue;
      }
      a.headPos(p);
      const d = this.distTo(p);
      p.y += 0.42;
      p.project(E.camera);
      const on = p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
      H.marks.push({ x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * Ht, on, dx: p.z < 1 ? p.x : -p.x, dy: p.z < 1 ? p.y : -p.y, d: Math.round(d), role: a.role });
    }
  }

  loop() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const step = (t) => {
      if (!this.running) return;
      this.frame(t);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
