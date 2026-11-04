/* 렌더러 · 카메라 · 시뮬레이션 동기화 · 이벤트 → 이펙트 · 소리 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { Builder, MAT } from "./level.js";
import { Sim, STEP, geyserOn } from "./sim.js";
import { THEMES, buildLevel } from "./stages.js";
import { TruckModel } from "./truckmodel.js";
import { Debris, PropBatch } from "./props.js";
import { FX } from "./fx.js";
import { LOOKS, WorldView, themeEnv } from "./worldview.js";

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
};

const DUST = {
  [MAT.DIRT]: [0.74, 0.61, 0.44],
  [MAT.ASPHALT]: [0.44, 0.44, 0.47],
  [MAT.SNOW]: [0.96, 0.98, 1],
  [MAT.ICE]: [0.84, 0.94, 1],
  [MAT.ROCK]: [0.36, 0.3, 0.29],
  [MAT.LAVA]: [0.3, 0.2, 0.17],
  [MAT.GRASS]: [0.5, 0.56, 0.32],
  [MAT.VOID]: [0.3, 0.3, 0.3],
};

export const QUALITY = {
  high: { k: 1, pr: 2, label: "높음" },
  mid: { k: 0.7, pr: 1.5, label: "보통" },
  low: { k: 0.42, pr: 1, label: "낮음" },
};

export class GameView {
  constructor(canvas, sfx, ui) {
    this.canvas = canvas;
    this.sfx = sfx;
    this.ui = ui;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1400);
    this.qualityName = "high";
    this.q = QUALITY.high;
    this.mode = "none";
    this.time = 0;
    this.shakeA = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.acc = 0;
    this.cine = null;
    this.camYaw = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.fov = 62;
    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
    this.fps = 60;
    this.resize();
  }

  setQuality(name) {
    this.qualityName = name;
    this.q = QUALITY[name] || QUALITY.high;
    this.resize();
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width));
    const h = Math.max(2, Math.round(r.height));
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pr));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.fx) this.fx.setScale(this.pointScale());
  }

  pointScale() {
    return (this.renderer.domElement.height * 0.5) / Math.tan((this.camera.fov * Math.PI) / 360);
  }

  /* ---------- 판 불러오기 ---------- */
  clearScene() {
    if (this.world) this.world.dispose();
    if (this.props) this.props.dispose();
    if (this.debris) this.debris.dispose();
    if (this.fx) this.fx.dispose();
    if (this.truck) this.truck.dispose();
    this.world = null;
    this.props = null;
    this.debris = null;
    this.fx = null;
    this.truck = null;
    this.sim = null;
    this.scene = null;
    this.cine = null;
  }

  startLevel(def, truckDef, upgrades) {
    this.clearScene();
    const level = buildLevel(def);
    const sim = new Sim(level, truckDef, upgrades, { time: def.time, main: def.main, bonus: def.bonus, endless: def.endless, extra: def.extra, id: def.id });
    this.buildScene(level, sim, truckDef, { theme: def.theme, seed: def.index + 1 });
    this.def = def;
    this.mode = "play";
    this.timeScale = 1;
    this.slowT = 0;
    this.acc = 0;
    this.shakeA = 0;
    this.renderer.toneMappingExposure = LOOKS[def.theme].exposure;
    // 처음 자리에 트럭을 앉힌다
    for (let i = 0; i < 90; i += 1) sim.step(STEP);
    sim.events.length = 0;
    this.camYaw = Math.atan2(sim.fwd[0], sim.fwd[2]);
    this.syncTruck(0);
    this.updateCamera(1, true);
    if (def.mode === "boss") {
      const list = sim.objects.filter((o) => o.tag === "boss" || o.tag === "dumper");
      const z0 = level.zones[0];
      const n = list.length;
      const cx = n ? list.reduce((a, o) => a + o.x, 0) / n : z0 ? z0.x : 0;
      const cz = n ? list.reduce((a, o) => a + o.z, 0) / n : z0 ? z0.z : 0;
      this.cine = { t: 1.8, x: cx, y: level.height(cx, cz) + 3, z: cz };
    }
    return sim;
  }

  buildScene(level, sim, truckDef, opts) {
    const q = this.q.k;
    this.scene = new THREE.Scene();
    this.sim = sim;
    this.world = new WorldView(this.renderer, this.scene, level, { quality: q, ...opts });
    this.props = new PropBatch(this.scene, sim, q);
    this.debris = new Debris(this.scene, level, Math.round(280 * q));
    this.fx = new FX(this.scene, level, q);
    this.fx.setScale(this.pointScale());
    this.truck = new TruckModel(truckDef);
    this.truck.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    this.scene.add(this.truck.group);
    this.fill = new THREE.DirectionalLight("#ffffff", opts.theme === "volcano" ? 1 : 0.75);
    this.scene.add(this.fill, this.fill.target);
    this.exhaustT = 0;
  }

  /** 첫 화면: 고철 경기장 */
  showTitle(truckDef) {
    this.clearScene();
    const b = new Builder(THEMES.scrap, {});
    b.arena(62, 54, { r: 18 });
    b.rampAt(-22, 12, 0.5, { h: 3.6, l: 14, w: 11 });
    b.rampAt(26, -6, -0.6, { h: 2.8, l: 12, w: 9 });
    b.humpAt(4, 26, 0.3, { h: 2.4, l: 12, w: 18 });
    const cars = [[13, 8, 0.4], [16.5, 9.4, 0.2], [20, 10.6, 0.7], [-10, -7, 1.2], [-13, -5, 1.0]];
    for (const [x, z, yaw] of cars) b.putAt("wreck", x, z, { yaw });
    b.putAt("wreck", 16, 9, { yaw: 0.8, on: 1 });
    for (const [x, z] of [[-18, -2], [-21, 1], [8, 18], [11, 20]]) b.putAt("tires", x, z);
    for (const [x, z] of [[4, 11], [6, 12.6], [2.4, 13], [4.4, 14]]) b.putAt("crate", x, z);
    b.putAt("crate", 5, 12.4, { on: 12 });
    for (const [x, z] of [[-6, 16], [-4.6, 17.2]]) b.putAt("boom", x, z);
    for (const [x, z] of [[-7.4, 17], [12, 2.5], [13.4, 1.6]]) b.putAt("drum", x, z);
    b.putAt("fence", 28, 24, { yaw: 0.6 });
    b.putAt("container", -34, 28, { yaw: 0.4 });
    b.putAt("concrete", 30, 12, { yaw: 1.2 });
    b.zones = [];
    const level = b.bake();
    const sim = new Sim(level, truckDef, {}, {});
    sim.pos[0] = 0;
    sim.pos[2] = 0;
    this.buildScene(level, sim, truckDef, { theme: "scrap", stands: true, noFinish: true, seed: 5 });
    this.renderer.toneMappingExposure = LOOKS.scrap.exposure;
    this.mode = "title";
    const y = level.height(0, 0);
    const R = truckDef.wheelR;
    this.titleBase = new THREE.Vector3(0, y + R + 0.35 + 0.62, 0);
    this.truck.group.position.copy(this.titleBase);
    this.truck.group.rotation.y = 0.5;
    this.truck.setSuspension([0.62, 0.62, 0.62, 0.62], 0, [0, 0, 0, 0]);
    this.titleT = 0;
    this.fx.setScale(this.pointScale());
    this.renderer.compile(this.scene, this.camera);
  }

  /** 차고: 어두운 전시장 + 회전판 */
  showGarage(truckDef) {
    if (this.mode !== "garage") {
      this.clearScene();
      this.buildGarage();
      this.mode = "garage";
    }
    this.setShowTruck(truckDef);
  }

  buildGarage() {
    const s = new THREE.Scene();
    this.scene = s;
    s.background = new THREE.Color("#0c0f18");
    s.fog = new THREE.Fog("#0c0f18", 22, 60);
    s.environment = themeEnv(this.renderer, "scrap");
    s.add(new THREE.HemisphereLight("#c4d4f4", "#2a2622", 1.1));
    const key = new THREE.SpotLight("#fff4e0", 620, 44, 0.42, 0.55, 1.6);
    key.position.set(7, 15, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.bias = -0.0005;
    s.add(key, key.target);
    const rim = new THREE.SpotLight("#5ac8ff", 420, 44, 0.6, 0.6, 1.6);
    rim.position.set(-11, 9, -9);
    s.add(rim, rim.target);
    const rim2 = new THREE.SpotLight("#ff7a3a", 340, 40, 0.6, 0.6, 1.6);
    rim2.position.set(11, 7, -9);
    s.add(rim2, rim2.target);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#1c2029", roughness: 0.35, metalness: 0.55 }));
    floor.receiveShadow = true;
    s.add(floor);
    const table = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.9, 0.36, 56), new THREE.MeshStandardMaterial({ color: "#2c313d", roughness: 0.42, metalness: 0.7 }));
    disc.position.y = 0.18;
    disc.receiveShadow = true;
    table.add(disc);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(6.74, 0.05, 8, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#ffb91e", toneMapped: false }));
    glow.position.y = 0.37;
    table.add(glow);
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 1.4), new THREE.MeshStandardMaterial({ color: i % 2 ? "#ffc81e" : "#1b1b1f", roughness: 0.5 }));
      st.position.set(Math.sin(a) * 5.9, 0.37, Math.cos(a) * 5.9);
      st.rotation.y = a;
      table.add(st);
    }
    s.add(table);
    this.table = table;
    // 뒤쪽 벽 · 타이어 선반
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 18, 36, 1, true, Math.PI * 0.62, Math.PI * 0.76), new THREE.MeshStandardMaterial({ color: "#232732", roughness: 0.8, side: THREE.BackSide }));
    wall.position.y = 9;
    wall.rotation.y = Math.PI;
    s.add(wall);
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 8 - 0.5) * 2.1 + Math.PI;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: i % 2 ? "#6fd0ff" : "#ffb91e", toneMapped: false }));
      lamp.position.set(Math.sin(a) * 23.4, 9 + (i % 2) * 2, Math.cos(a) * 23.4);
      lamp.rotation.y = a;
      s.add(lamp);
    }
    const tire = new THREE.TorusGeometry(1.15, 0.5, 8, 16);
    const tm = new THREE.MeshStandardMaterial({ color: "#17181c", roughness: 0.85 });
    for (const [x, z] of [[-14, -9], [14, -9], [-16, -3], [16, -3]]) {
      for (let k = 0; k < 4; k += 1) {
        const t = new THREE.Mesh(tire, tm);
        t.rotation.x = Math.PI / 2;
        t.position.set(x, 0.5 + k * 1, z);
        s.add(t);
      }
    }
    this.renderer.toneMappingExposure = 1.15;
    this.garageYaw = 0.7;
  }

  setShowTruck(def) {
    if (this.truck) {
      this.truck.dispose();
      this.table.remove(this.truck.group);
    }
    const t = new TruckModel(def);
    t.group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    t.setSuspension([0.62, 0.62, 0.62, 0.62], 0, [0, 0, 0, 0]);
    t.group.position.y = 0.36 + def.wheelR + 0.35 + 0.62;
    this.table.add(t.group);
    this.truck = t;
    const scale = Math.max(def.wb, 3.7) / 3.7;
    this.showDist = 13.5 * scale;
    this.showDef = def;
  }

  /* ---------- 프레임 ---------- */
  frame(dt) {
    this.time += dt;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.04;
    if (this.mode === "play") this.framePlay(dt);
    else if (this.mode === "title") this.frameTitle(dt);
    else if (this.mode === "garage") this.frameGarage(dt);
    else return;
    if (this.scene) this.renderer.render(this.scene, this.camera);
  }

  frameTitle(dt) {
    this.titleT += dt;
    const t = this.titleT;
    const g = this.truck.group;
    // 시동 건 트럭: 부르르 떤다
    g.position.y = this.titleBase.y + Math.sin(t * 34) * 0.012 + Math.sin(t * 1.9) * 0.008;
    g.rotation.z = Math.sin(t * 27) * 0.003;
    const narrow = this.w / this.h < 1;
    const a = 0.72 + Math.sin(t * 0.14) * 0.3;
    const d = narrow ? 18.5 : 15.4;
    const cx = this.titleBase.x + Math.sin(a + 0.5) * d;
    const cz = this.titleBase.z + Math.cos(a + 0.5) * d;
    this.camera.position.set(cx, this.titleBase.y + (narrow ? 1.7 : 0.7), cz);
    this.camera.fov = narrow ? 58 : 44;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.titleBase.x, this.titleBase.y + (narrow ? 0.9 : -0.2), this.titleBase.z);
    this.exhaustT -= dt;
    if (this.exhaustT <= 0) {
      this.exhaustT = 0.16;
      this.puffExhaust(0.46, 0.8);
    }
    if (Math.random() < dt * 3) {
      const x = (Math.random() - 0.5) * 60;
      const z = (Math.random() - 0.5) * 50;
      this.fx.dust(x, this.world.level.height(x, z) + 0.2, z, 1, 0.8, [0.76, 0.64, 0.48], 1.8);
    }
    this.world.update(dt, this.time, this.camera, this.titleBase, this.fx);
    this.fx.update(dt);
    this.debris.update(dt);
  }

  frameGarage(dt) {
    this.garageYaw += dt * 0.38;
    if (this.table) this.table.rotation.y = this.garageYaw;
    const narrow = this.w / this.h < 1;
    const d = (this.showDist || 13.5) * (narrow ? 2.05 : 1);
    this.camera.position.set(narrow ? 0 : -3.6, narrow ? 2.6 : 3.3, d);
    this.camera.fov = 40;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(narrow ? 0 : -3.6, narrow ? -2.8 : 2.1, 0);
  }

  puffExhaust(dark = 0.3, size = 1.4) {
    const t = this.truck;
    if (!t || !this.fx) return;
    for (const v of t.exhaust) {
      this.tmpV.copy(v);
      t.group.localToWorld(this.tmpV);
      this.fx.smoke(this.tmpV.x, this.tmpV.y + 0.1, this.tmpV.z, 1, dark, size);
    }
  }

  framePlay(dt) {
    const sim = this.sim;
    if (this.slowT > 0) {
      this.slowT -= dt;
      this.timeScale += (0.32 - this.timeScale) * Math.min(1, dt * 12);
    } else this.timeScale += (1 - this.timeScale) * Math.min(1, dt * 5);
    this.acc += dt;
    let n = 0;
    const simDt = STEP * this.timeScale;
    while (this.acc >= STEP && n < 14) {
      sim.step(simDt);
      this.acc -= STEP;
      n += 1;
    }
    if (n === 14) this.acc = 0;
    this.drainEvents();
    this.syncTruck(dt);
    this.continuousFx(dt);
    this.props.update(this.time);
    this.debris.update(dt * this.timeScale);
    this.fx.update(dt * this.timeScale);
    this.updateCamera(dt, false);
    this.fill.position.copy(this.camera.position);
    this.fill.target.position.copy(this.truck.group.position);
    this.world.update(dt, this.time, this.camera, this.truck.group.position, this.fx);
    const sK = clamp(sim.speed / (sim.def.top || 25), 0, 1.3);
    this.sfx.engineUpdate(dt, { speedK: sK, throttle: sim.state === "play" ? Math.max(sim.input.throttle, sim.input.brake * 0.6) : 0, boost: sim.boosting, slip: sim.contacts ? Math.min(1, Math.max(0, sim.slip) / 7) : 0, air: !!sim.air, idle: sim.state === "ready" });
    const line = sim.boosting ? 1 : clamp((sK - 0.86) * 3, 0, 0.8) + (sim.air && sim.speed > 12 ? 0.3 : 0);
    this.ui.speedLines(sim.state === "play" ? line : 0);
  }

  syncTruck(dt) {
    const s = this.sim;
    const t = this.truck;
    const ex = this.acc * this.timeScale;
    t.group.position.set(s.pos[0] + s.vel[0] * ex, s.pos[1] + s.vel[1] * ex, s.pos[2] + s.vel[2] * ex);
    t.group.quaternion.set(s.q[0], s.q[1], s.q[2], s.q[3]);
    const lens = this.lens || (this.lens = [0, 0, 0, 0]);
    const spins = this.spins || (this.spins = [0, 0, 0, 0]);
    for (let i = 0; i < 4; i += 1) {
      lens[i] = s.wheels[i].len;
      spins[i] = s.wheels[i].spin;
    }
    t.setSuspension(lens, s.steerVis, spins);
    t.setDamage(s.damage);
    t.setBrake(s.input.brake > 0.1 && s.vf > 1);
    void dt;
  }

  continuousFx(dt) {
    const s = this.sim;
    const fx = this.fx;
    const k = this.q.k;
    const sp = s.speed;
    for (let i = 0; i < 4; i += 1) {
      const w = s.wheels[i];
      if (!w.contact) {
        fx.skidBreak(i);
        continue;
      }
      const col = DUST[w.mat] || DUST[MAT.DIRT];
      const soft = w.mat === MAT.DIRT || w.mat === MAT.SNOW || w.mat === MAT.GRASS || w.mat === MAT.ROCK;
      const slipK = Math.min(1, (s.slip || 0) / 6);
      if (soft && sp > 4 && Math.random() < dt * (3 + sp * 0.7 + slipK * 26) * k) {
        fx.dust(w.wx, w.wy + 0.25, w.wz, 1, 1.2 + slipK * 2, col, 0.8 + slipK * 0.6);
      }
      if (!soft && slipK > 0.3 && Math.random() < dt * 24 * k) {
        if (w.mat === MAT.ICE) fx.dust(w.wx, w.wy + 0.2, w.wz, 1, 1.4, col, 0.8);
        else fx.smoke(w.wx, w.wy + 0.2, w.wz, 1, 0.62, 2.2);
      }
      if (slipK > 0.28 || (w.mat !== MAT.ASPHALT && w.mat !== MAT.ICE && sp > 2)) {
        fx.skid(i, w.wx, w.wy + 0.1, w.wz, this.truck.def.wheelR * 0.82, slipK > 0.28 ? 0.46 : 0.17);
      } else fx.skidBreak(i);
    }
    // 배기 · 부스터
    this.exhaustT -= dt;
    if (this.exhaustT <= 0) {
      this.exhaustT = s.input.throttle > 0.3 ? 0.1 : 0.2;
      this.puffExhaust(s.input.throttle > 0.3 ? 0.3 : 0.42, 0.78);
    }
    if (s.boosting) {
      const list = this.truck.rockets.length ? this.truck.rockets : this.truck.exhaust;
      const back = this.tmpV2.set(0, 0, -1).applyQuaternion(this.truck.group.quaternion);
      for (const v of list) {
        this.tmpV.copy(v);
        this.truck.group.localToWorld(this.tmpV);
        for (let i = 0; i < 2; i += 1) {
          fx.hot.add(this.tmpV.x + back.x * 0.5, this.tmpV.y, this.tmpV.z + back.z * 0.5, s.vel[0] + back.x * (6 + Math.random() * 6), s.vel[1] + back.y * 6 + (Math.random() - 0.5), s.vel[2] + back.z * (6 + Math.random() * 6), 0.1 + Math.random() * 0.1, 0.95, 0.25, 0.3 + Math.random() * 0.2, 0.55 + Math.random() * 0.2, 1, 0.75, 0, 0.2);
        }
      }
    }
    if (s.damage > 62 && Math.random() < dt * 12 * k) {
      this.tmpV.set(0, 1.1, 1.4);
      this.truck.group.localToWorld(this.tmpV);
      fx.smoke(this.tmpV.x, this.tmpV.y, this.tmpV.z, 1, 0.12, 2.2);
    }
    // 불기둥
    for (const g of s.level.geysers) {
      const d = Math.hypot(g.x - s.pos[0], g.z - s.pos[2]);
      if (d > 110) continue;
      const y = s.level.height(g.x, g.z);
      if (geyserOn(g, s.time)) {
        for (let i = 0; i < 4 * k + 1; i += 1) fx.flame(g.x, y + 0.3, g.z, 11);
        if (Math.random() < dt * 30 * k) fx.smoke(g.x, y + 5, g.z, 1, 0.16, 4);
      } else if (Math.random() < dt * 8) fx.ember(g.x, y + 0.3, g.z);
    }
    // 불붙은 드럼통
    for (const o of s.objects) {
      if (o.fuse > 0 && o.state !== 2 && Math.random() < dt * 40) fx.sparks(o.x, o.y + o.h[1], o.z, 2, 4);
    }
  }

  drainEvents() {
    const s = this.sim;
    if (!s.events.length) return;
    for (const e of s.events) this.handle(e);
    s.events.length = 0;
  }

  /** 멀리서 난 소리는 작게 */
  near(e, range = 90) {
    if (e.x == null) return 1;
    return clamp(1 - Math.hypot(e.x - this.sim.pos[0], e.z - this.sim.pos[2]) / range, 0.1, 1);
  }

  shake(p) {
    this.shakeA = Math.min(1.1, Math.max(this.shakeA, p));
  }

  projected(x, y, z) {
    this.tmpV.set(x, y, z).project(this.camera);
    if (this.tmpV.z > 1) return null;
    return { x: (this.tmpV.x * 0.5 + 0.5) * 100, y: (0.5 - this.tmpV.y * 0.5) * 100 };
  }

  handle(e) {
    const { fx, debris, sfx, ui, sim } = this;
    const groundY = (x, z) => sim.level.height(x, z);
    switch (e.t) {
      case "jump":
        sfx.jump();
        fx.dust(e.x, groundY(e.x, e.z) + 0.2, e.z, 10 * fx.k + 2, 5, DUST[sim.level.mat(e.x, e.z)] || DUST[0], 1.1);
        fx.ring(e.x, groundY(e.x, e.z), e.z, 5, 0.36, "#fff0d0", 0.5);
        break;
      case "sparks":
        fx.sparks(e.x, e.y, e.z, e.n || 3, 7);
        break;
      case "bang":
        sfx.wall(e.power);
        this.shake(e.power * 0.5);
        fx.sparks(e.x, e.y, e.z, 6, 8);
        break;
      case "land": {
        const p = clamp((e.impact || 5) / 22, 0.1, 1);
        sfx.land(p);
        this.shake(p * 0.72);
        const q = sim;
        const col = DUST[sim.level.mat(q.pos[0], q.pos[2])] || DUST[0];
        const y = groundY(q.pos[0], q.pos[2]);
        const n = Math.round((10 + p * 34) * fx.k);
        for (let i = 0; i < n; i += 1) {
          const a = (i / n) * 6.283;
          const sp = 5 + p * 11;
          fx.soft.add(q.pos[0] + Math.cos(a) * 1.8, y + 0.3, q.pos[2] + Math.sin(a) * 1.8, Math.cos(a) * sp, 0.6 + Math.random() * 1.4, Math.sin(a) * sp, 0.55 + Math.random() * 0.5, 1.6, 5, col[0], col[1], col[2], 0.58, 0, 2.6);
        }
        if (p > 0.35) fx.ring(q.pos[0], y, q.pos[2], 8 + p * 8, 0.45, "#fff2d0", 0.6);
        break;
      }
      case "stunt":
        sfx.stunt(e.bad);
        ui.stunt(e.label, e.score, e.bad);
        break;
      case "shock":
        fx.ring(e.x, groundY(e.x, e.z), e.z, e.r, 0.42, "#ffe6b0", 0.7);
        break;
      case "crush": {
        const v = this.near(e);
        sfx.crush(v);
        this.shake(0.26 * v);
        fx.sparks(e.x, e.y + 0.4, e.z, 10 * fx.k + 2, 8);
        debris.spawn("car", e.x, e.y + 0.3, e.z, sim.vel[0] * 0.5, 3, sim.vel[2] * 0.5, 6, 1);
        fx.dust(e.x, e.y, e.z, 4, 3, DUST[0], 1);
        break;
      }
      case "wall":
        sfx.wall(e.power);
        this.shake(e.power * 0.5);
        fx.sparks(e.x, e.y, e.z, 8, 8);
        break;
      case "impact":
        sfx.material(e.mat, e.power, this.near(e));
        this.shake(Math.min(0.4, e.power * 0.42));
        break;
      case "fuse":
        sfx.fuse();
        fx.sparks(e.x, e.y + 0.4, e.z, 8, 5);
        break;
      case "dent":
        sfx.material(e.mat, 0.6, this.near(e));
        if (e.mat === "metal" || e.mat === "car") fx.sparks(e.x, e.y, e.z, 14 * fx.k + 3, 10);
        else fx.dust(e.x, e.y, e.z, 5, 3, DUST[e.mat === "stone" ? 1 : 0], 0.9);
        break;
      case "break": {
        const v = this.near(e);
        const pw = clamp((e.energy || 8) / 22, 0.3, 1);
        sfx.material(e.mat, pw, v);
        const big = sim.objects && e.type && { container: 2, girder: 2.2, timber: 1.7, wreck: 1.3, sign: 1.3, pillar: 1.6, beam: 1.3, tirewall: 1.4, fence: 1.1 }[e.type];
        debris.spawn(e.mat, e.x, e.y, e.z, e.vx || 0, e.vy || 0, e.vz || 0, e.energy || 8, e.partial ? 0.6 : big || 1, e.color);
        if (e.mat === "metal" || e.mat === "car") fx.sparks(e.x, e.y, e.z, 16 * fx.k + 4, 12);
        if (e.mat === "glass" || e.mat === "ice") fx.sparks(e.x, e.y, e.z, 12 * fx.k, 9, [0.75, 0.92, 1]);
        if (e.mat === "snow") fx.dust(e.x, e.y, e.z, 12 * fx.k + 3, 6, DUST[MAT.SNOW], 1.4);
        else if (e.mat !== "glass") fx.dust(e.x, e.y - 0.3, e.z, 6 * fx.k + 2, 4, e.mat === "stone" ? [0.66, 0.65, 0.62] : DUST[0], 1.1);
        this.shake(Math.min(0.38, pw * 0.4) * v);
        break;
      }
      case "slowmo":
        this.slowT = Math.max(this.slowT, e.dur || 0.5);
        break;
      case "collapse": {
        // 큰 구조물이 무너지면 잠깐 위에서 바라본다
        this.shake(1);
        const tagged = sim.objects.filter((o) => o.tag === "boss");
        let cx = sim.pos[0];
        let cz = sim.pos[2];
        if (tagged.length) {
          cx = tagged.reduce((a, o) => a + o.x, 0) / tagged.length;
          cz = tagged.reduce((a, o) => a + o.z, 0) / tagged.length;
        }
        this.cine = { t: 1.8, x: cx, y: sim.level.height(cx, cz) + 3, z: cz };
        ui.big("TOTAL DESTRUCTION!", 4);
        sfx.explosion(1);
        for (let i = 0; i < 28 * fx.k; i += 1) fx.dust(cx + (Math.random() - 0.5) * 18, sim.level.height(cx, cz) + 0.5, cz + (Math.random() - 0.5) * 18, 1, 6, DUST[0], 2.4);
        break;
      }
      case "boom": {
        const v = this.near(e, 120);
        sfx.explosion(v);
        fx.explosion(e.x, e.y, e.z, e.r || 11);
        debris.spawn("boom", e.x, e.y, e.z, 0, 4, 0, 18, 1.2);
        this.shake(0.95 * v);
        ui.flash(0.26 * v);
        break;
      }
      case "chain":
        ui.chain(e.n);
        break;
      case "thud": {
        const v = this.near(e, 70);
        if (e.power > 0.2) {
          sfx.material(e.mat, e.power * 0.7, v);
          this.shake(e.power * 0.4 * v);
        }
        fx.dust(e.x, e.y + 0.1, e.z, 4 * fx.k + 1, 3 + e.power * 4, e.mat === "snow" ? DUST[MAT.SNOW] : DUST[0], 0.9 + e.power);
        break;
      }
      case "creak":
        sfx.creak();
        break;
      case "word":
        ui.big(e.word, e.tier);
        sfx.combo(e.tier);
        break;
      case "score": {
        const q = this.projected(e.x, e.y, e.z);
        if (q) ui.pop(q.x, q.y, `+${Math.round(e.gain).toLocaleString("ko-KR")}`, e.big);
        break;
      }
      case "recover":
        ui.tip(e.msg, e.info);
        if (!e.info) {
          fx.ring(sim.pos[0], groundY(sim.pos[0], sim.pos[2]), sim.pos[2], 7, 0.5, "#7fd8ff", 0.7);
          this.camYaw = Math.atan2(sim.fwd[0], sim.fwd[2]);
        }
        break;
      case "pad":
        sfx.boostKick();
        this.shake(0.2);
        this.fovKick = 10;
        break;
      case "burn":
        fx.flame(e.x, e.y, e.z, 6);
        fx.flame(e.x, e.y, e.z, 7);
        sfx.material("rubber", 0.4);
        this.shake(0.2);
        break;
      case "zone":
        ui.big("PERFECT LANDING!", 3);
        this.slowT = Math.max(this.slowT, 0.7);
        fx.ring(e.x, groundY(e.x, e.z), e.z, 14, 0.7, "#ffd21f", 1);
        break;
      case "lava":
        for (let i = 0; i < 18; i += 1) fx.flame(e.x, e.y, e.z, 12);
        sfx.explosion(0.4);
        this.shake(0.5);
        break;
      case "shake":
        this.shake(e.power);
        break;
      case "finish":
        ui.finish();
        break;
      case "end":
        this.ended = true;
        if (e.ok) {
          const p = sim.pos;
          for (let i = 0; i < 40 * fx.k; i += 1) {
            const a = Math.random() * 6.28;
            const col = [[1, 0.3, 0.3], [1, 0.84, 0.15], [0.3, 0.8, 1], [0.5, 1, 0.45]][i % 4];
            fx.hot.add(p[0], p[1] + 3, p[2], Math.cos(a) * (2 + Math.random() * 6), 7 + Math.random() * 9, Math.sin(a) * (2 + Math.random() * 6), 1 + Math.random() * 1.1, 0.9, 0.3, col[0], col[1], col[2], 1, 9, 0.2);
          }
        }
        ui.ended(e.ok);
        break;
      default:
    }
  }

  updateCamera(dt, snap) {
    const s = this.sim;
    const pos = this.truck.group.position;
    const heading = Math.atan2(s.fwd[0], s.fwd[2]);
    const velH = Math.atan2(s.vel[0], s.vel[2]);
    const narrow = this.w / this.h < 1;
    const sK = clamp(s.speed / (s.def.top || 25), 0, 1.3);
    let want = heading;
    let rate = 3.4;
    if (s.vf > 3) want = heading + wrap(velH - heading) * 0.4;
    if (s.air) {
      // 공중에서는 돌아도 카메라는 진행 방향을 지킨다
      want = s.speed > 4 ? velH : this.camYaw;
      rate = 0.9;
    }
    if (s.state === "done") {
      want = this.camYaw + dt * 0.5;
      rate = 8;
    }
    this.camYaw = snap ? want : this.camYaw + wrap(want - this.camYaw) * Math.min(1, dt * rate);
    const big = (s.def.wb || 3.7) / 3.7;
    const air = s.air ? Math.min(1, s.airT * 1.2) : 0;
    const dist = (lerp(8.6, 11, Math.min(1, sK)) + air * 2) * big * (narrow ? 1.16 : 1);
    const hi = (4 + sK * 0.5 + air * 2.2) * big * (narrow ? 1.14 : 1);
    const yaw = this.camYaw - s.steerVis * 0.26;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const px = pos.x - fx * dist;
    const pz = pos.z - fz * dist;
    let py = pos.y + hi;
    const ground = s.level.height(px, pz) + 1.8;
    if (py < ground) py = ground;
    const k = snap ? 1 : Math.min(1, dt * 7.5);
    this.camPos.x += (px - this.camPos.x) * (snap ? 1 : Math.min(1, dt * 11));
    this.camPos.z += (pz - this.camPos.z) * (snap ? 1 : Math.min(1, dt * 11));
    this.camPos.y += (py - this.camPos.y) * k;
    const ahead = narrow ? 7 : 6;
    const lx = pos.x + Math.sin(this.camYaw) * ahead;
    const lz = pos.z + Math.cos(this.camYaw) * ahead;
    const ly = pos.y + 1.2 - air * 0.5;
    this.camLook.x += (lx - this.camLook.x) * (snap ? 1 : Math.min(1, dt * 10));
    this.camLook.y += (ly - this.camLook.y) * (snap ? 1 : Math.min(1, dt * 8));
    this.camLook.z += (lz - this.camLook.z) * (snap ? 1 : Math.min(1, dt * 10));
    let cx = this.camPos.x;
    let cy = this.camPos.y;
    let cz = this.camPos.z;
    let tx = this.camLook.x;
    let ty = this.camLook.y;
    let tz = this.camLook.z;
    // 무너지는 장면: 뒤로 높이 물러나 구조물을 본다
    if (this.cine) {
      this.cine.t -= dt;
      const m = clamp(Math.min(this.cine.t, 1.8 - this.cine.t) * 2.4, 0, 1);
      const dx = this.cine.x - pos.x;
      const dz = this.cine.z - pos.z;
      const L = Math.hypot(dx, dz) || 1;
      cx = lerp(cx, pos.x - (dx / L) * 13, m);
      cz = lerp(cz, pos.z - (dz / L) * 13, m);
      cy = lerp(cy, Math.max(pos.y, this.cine.y) + 9, m);
      tx = lerp(tx, this.cine.x, m);
      ty = lerp(ty, this.cine.y, m);
      tz = lerp(tz, this.cine.z, m);
      if (this.cine.t <= 0) this.cine = null;
    }
    // 흔들림
    if (this.shakeA > 0.002) {
      const a = this.shakeA * this.shakeA * 0.8;
      const t = this.time * 42;
      cx += Math.sin(t) * a;
      cy += Math.sin(t * 1.3 + 2) * a * 0.8;
      cz += Math.cos(t * 0.8) * a;
      this.shakeA *= Math.exp(-dt * 5.2);
    }
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(tx, ty, tz);
    this.fovKick = (this.fovKick || 0) * Math.exp(-dt * 3);
    const wantFov = (narrow ? 72 : 60) + Math.min(1, sK) * 13 + (s.boosting ? 7 : 0) + this.fovKick + air * 3 + (this.cine ? 6 : 0);
    this.fov += (wantFov - this.fov) * (snap ? 1 : Math.min(1, dt * 4));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      this.fx.setScale(this.pointScale());
    }
  }

  dispose() {
    this.clearScene();
    this.renderer.dispose();
  }
}
