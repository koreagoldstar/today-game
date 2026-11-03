/*
 * 움직이는 그림: 물리 상태를 읽어 펭귄 · 택배 · 장애물 · 효과 · 카메라를 맞춘다.
 *  게임 규칙은 여기 없다 (sim.js 만 규칙을 정한다).
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { clamp, lerp, TAU, rng, Builder, DS } from "./course.js";
import { WORLDS } from "./stages.js";
import { toyMat, roundBox } from "./penguin.js";
import { ball, lathe, mesh, makeBox, makeSnowman, makeCrate, makePillar, makeRotor, makeSpring, makeVent, makeIcicle, makeSeal, makeFox, makeGeyser, makeWindmill, makeHole, makeFlag, fishGeo, makeItem, makeHouse, makeNpc, makeDepot, makeGoalRing, iceMat } from "./toys.js";
import { buildCourseWorld, SnowFall, LOOK } from "./world.js";

const softTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 32, 1, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.5, "rgba(255,255,255,.55)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

/** 효과 입자 묶음 */
class Particles {
  constructor(n, blending) {
    this.n = n;
    this.i = 0;
    this.p = new Float32Array(n * 3);
    this.c = new Float32Array(n * 3);
    this.s = new Float32Array(n);
    this.a = new Float32Array(n);
    this.v = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.g = new Float32Array(n);
    this.grow = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.c, 3));
    geo.setAttribute("aS", new THREE.BufferAttribute(this.s, 1));
    geo.setAttribute("aA", new THREE.BufferAttribute(this.a, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softTex() }, scale: { value: 500 } },
      transparent: true,
      depthWrite: false,
      blending,
      vertexShader: `attribute float aS;attribute float aA;attribute vec3 color;varying vec3 vC;varying float vA;uniform float scale;
      void main(){vC=color;vA=aA;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aS*scale/max(.5,-mv.z);}`,
      fragmentShader: `uniform sampler2D map;varying vec3 vC;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);float a=t.a*vA;if(a<.01)discard;gl_FragColor=vec4(vC,a);}`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }
  add(x, y, z, vx, vy, vz, size, life, col, gravity = 0, grow = 0) {
    const i = this.i;
    this.i = (i + 1) % this.n;
    this.p[i * 3] = x;
    this.p[i * 3 + 1] = y;
    this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx;
    this.v[i * 3 + 1] = vy;
    this.v[i * 3 + 2] = vz;
    this.s[i] = size;
    this.life[i] = life;
    this.max[i] = life;
    this.g[i] = gravity;
    this.grow[i] = grow;
    this.c[i * 3] = col.r;
    this.c[i * 3 + 1] = col.g;
    this.c[i * 3 + 2] = col.b;
  }
  update(dt) {
    for (let i = 0; i < this.n; i += 1) {
      if (this.life[i] <= 0) {
        this.a[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.v[i * 3 + 1] -= this.g[i] * dt;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      this.s[i] += this.grow[i] * dt;
      const k = this.life[i] / this.max[i];
      this.a[i] = Math.min(1, k * 2.2);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aS.needsUpdate = true;
    g.attributes.aA.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}

const COL = {
  white: new THREE.Color(0xffffff),
  snow: new THREE.Color(0xe9f4ff),
  ice: new THREE.Color(0xbdeaff),
  water: new THREE.Color(0x8fdcff),
  gold: new THREE.Color(0xffd84a),
  pink: new THREE.Color(0xff8fb7),
  red: new THREE.Color(0xff5a5f),
  green: new THREE.Color(0x7ce88a),
  blue: new THREE.Color(0x62b8ff),
  purple: new THREE.Color(0xc58bff),
  wood: new THREE.Color(0xc99458),
};
const CONFETTI = [COL.gold, COL.pink, COL.red, COL.green, COL.blue, COL.purple, COL.white];

function makeGull(q) {
  const G = new THREE.Group();
  const w = toyMat({ color: 0xffffff, rough: 0.55, coat: 0.25 }, q);
  mesh(ball(0.28, 0.9, 0.85, 1.5, 12), w, 0, 0, 0, G);
  mesh(ball(0.2, 1, 1, 1.05, 12), w, 0, 0.14, 0.34, G);
  const beak = new THREE.ConeGeometry(0.07, 0.24, 8);
  beak.rotateX(Math.PI / 2);
  mesh(beak, toyMat({ color: 0xffa52a, rough: 0.4, coat: 0.5 }, q), 0, 0.12, 0.58, G, false);
  for (const s of [-1, 1]) mesh(ball(0.038, 1, 1, 0.6, 6), new THREE.MeshBasicMaterial({ color: 0x14121c }), s * 0.11, 0.2, 0.48, G, false);
  const wings = [];
  for (const s of [-1, 1]) {
    const j = new THREE.Group();
    j.position.set(s * 0.2, 0.08, 0);
    const wg = ball(0.2, 2.5, 0.2, 1, 10);
    wg.translate(s * 0.46, 0, 0);
    mesh(wg, toyMat({ color: 0xd9e2ee, rough: 0.55, coat: 0.2 }, q), 0, 0, 0, j);
    G.add(j);
    wings.push({ j, s });
  }
  G.userData.wings = wings;
  return G;
}

function padMesh(p, course, q) {
  const key = course.world.key;
  const G = new THREE.Group();
  const isSea = course.world.sea;
  const snowTop = p.surf !== "ice";
  if (p.kind === "crate") {
    G.add(makeCrate(p.hw, p.y - p.base, q));
    return G;
  }
  if (p.kind === "plank") {
    const w = roundBox(new THREE.BoxGeometry(p.hw * 2, 0.22, p.hd * 2 - 0.07, 3, 2, 2), p.hw * 2, 0.22, p.hd * 2 - 0.07, 0.07);
    const m = mesh(w, toyMat({ color: key === "aurora" ? 0xa8b6ff : key === "peaks" ? 0x9a7248 : 0xbd8c55, rough: 0.66, coat: 0.15 }, q), 0, -0.11, 0, G);
    m.receiveShadow = true;
    const cap = roundBox(new THREE.BoxGeometry(p.hw * 1.96, 0.1, p.hd * 1.6, 2, 2, 2), p.hw * 1.96, 0.1, p.hd * 1.6, 0.04);
    mesh(cap, toyMat({ color: 0xffffff, rough: 0.86, coat: 0 }, q), 0, -0.01, 0, G, false).receiveShadow = true;
    return G;
  }
  const topC = p.kind === "vanish" ? 0x9fe7ff : p.kind === "magic" ? 0xb8a8ff : p.kind === "crumble" ? 0xd9f2ff : snowTop ? 0xfcfeff : 0xa8e2f8;
  const sideC = key === "aurora" ? 0x6a58e0 : isSea ? 0x7fd4f2 : 0x94c8ea;
  const depth = isSea ? 2.4 : p.kind === "magic" || p.kind === "vanish" ? 0.5 : 1.4;
  const transparent = p.kind === "vanish";
  const topMat = transparent
    ? iceMat(q === "low" ? "low" : "high", topC, { emissive: 0x3fa0d8, emissiveIntensity: 0.45 })
    : toyMat({ color: topC, rough: snowTop ? 0.86 : 0.16, coat: snowTop ? 0 : 0.8, emissive: p.kind === "magic" ? 0x5a40e0 : 0, emissiveIntensity: p.kind === "magic" ? 0.5 : 0 }, q);
  const sideMat = transparent ? topMat : toyMat({ color: sideC, rough: 0.28, coat: 0.6, emissive: p.kind === "magic" ? 0x3a2ad8 : 0, emissiveIntensity: p.kind === "magic" ? 0.6 : 0 }, q);
  if (p.shape === "disc") {
    const r = p.r;
    const geoT = lathe([[0.001, 0], [r - 0.16, 0], [r - 0.03, -0.05], [r + 0.03, -0.17]], q === "low" ? 18 : 30, 8);
    const t = mesh(geoT, topMat, 0, 0, 0, G);
    t.receiveShadow = true;
    const low = lathe([[r + 0.03, -0.17], [r + 0.02, -0.5], [r * 0.82, -depth * 0.8], [r * 0.5, -depth], [0.001, -depth - 0.1]], q === "low" ? 18 : 28, 10);
    mesh(low, sideMat, 0, 0, 0, G);
  } else {
    const w = p.hw * 2;
    const d = p.hd * 2;
    const geo = roundBox(new THREE.BoxGeometry(w, 0.34, d, 5, 2, 5), w, 0.34, d, 0.13);
    const t = mesh(geo, topMat, 0, -0.17, 0, G);
    t.receiveShadow = true;
    if (depth > 0.6) {
      const bl = roundBox(new THREE.BoxGeometry(w * 0.9, depth, d * 0.9, 3, 3, 3), w * 0.9, depth, d * 0.9, 0.3);
      mesh(bl, sideMat, 0, -depth / 2 - 0.2, 0, G);
    } else {
      const bl = lathe([[Math.min(w, d) * 0.45, 0], [Math.min(w, d) * 0.3, -0.45], [0.001, -0.95]], 6, 4);
      mesh(bl, sideMat, 0, -0.32, 0, G);
    }
  }
  // 금 간 무늬
  if (p.kind === "crumble") {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.strokeStyle = "rgba(30,90,140,.62)";
    g.lineWidth = 3.4;
    const R = rng(Math.floor(p.s * 10) + 3);
    for (let i = 0; i < 7; i += 1) {
      g.beginPath();
      let x = 64;
      let y = 64;
      const a = (i / 7) * TAU + R();
      g.moveTo(x, y);
      for (let k = 1; k < 5; k += 1) {
        x = 64 + Math.cos(a + (R() - 0.5) * 0.7) * k * 15;
        y = 64 + Math.sin(a + (R() - 0.5) * 0.7) * k * 15;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    const R2 = p.shape === "disc" ? p.r * 2 : Math.min(p.hw, p.hd) * 2;
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(R2 * 0.92, R2 * 0.92), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    dec.rotation.x = -Math.PI / 2;
    dec.position.y = 0.02;
    G.add(dec);
  }
  if (p.kind === "magic" || p.kind === "vanish") {
    const R = p.shape === "disc" ? p.r : Math.max(p.hw, p.hd);
    const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.45, R * 0.56, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.kind === "magic" ? 0xe0d4ff : 0xd9f8ff, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.position.y = 0.03;
    G.add(ring);
    G.userData.ring = ring;
  }
  G.userData.topMat = topMat;
  return G;
}

export class GameView {
  constructor(stage, sim, penguin) {
    this.stage = stage;
    this.sim = sim;
    this.q = stage.quality;
    this.course = sim.c;
    this.penguin = penguin;
    this.root = new THREE.Group();
    stage.scene.add(this.root);
    stage.setLook(this.course.world.key);
    const W = buildCourseWorld(this.course, stage);
    this.world = W;
    this.root.add(W.group);
    this.root.add(penguin.group);
    this.fx = new Particles(this.q === "low" ? 220 : 520, THREE.NormalBlending);
    this.glow = new Particles(this.q === "low" ? 120 : 260, THREE.AdditiveBlending);
    this.root.add(this.fx.points, this.glow.points);
    this.snow = new SnowFall(this.q === "low" ? 260 : this.q === "mid" ? 620 : 1100);
    this.root.add(this.snow.points);
    if (this.course.world.key === "aurora") this.snow.u.color.value.set(0xcfd8ff);
    this.t = 0;
    this.shake = 0;
    this.cam = { yaw: this.course.P[0].h, x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, dist: 1, ready: false, fov: 50 };
    this.dyn = [];
    this.buildPads();
    this.buildObjs();
    this.buildItems();
    this.buildBoxes();
    this.buildGoal();
    this.buildMarkers();
    stage.setLook(this.course.world.key);
    this.smokeT = 0;
    this.dustT = 0;
    this.windT = 0;
    this.ctl = { dropT: 0 };
  }
  dispose() {
    this.root.remove(this.penguin.group);
    this.stage.scene.remove(this.root);
    const seen = new Set();
    this.root.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (!seen.has(m)) {
          seen.add(m);
          m.dispose();
        }
      }
    });
  }
  buildPads() {
    for (const p of this.course.pads) {
      const m = padMesh(p, this.course, this.q);
      m.position.set(p.x, p.y, p.z);
      if (p.shape === "rect") m.rotation.y = -p.rot;
      this.root.add(m);
      p.view = m;
    }
  }
  buildObjs() {
    const q = this.q;
    for (const o of this.course.objs) {
      let m = null;
      switch (o.type) {
        case "snowman":
          m = makeSnowman(q);
          m.rotation.y = -o.h0 + (o.lat || 0) * 0.1;
          break;
        case "pillar":
          m = makePillar(o.r, o.h, q);
          break;
        case "rotor":
          m = makeRotor(o, q);
          break;
        case "spring":
          m = makeSpring(o, q);
          break;
        case "vent":
          m = makeVent(o, q);
          break;
        case "icicle":
          m = makeIcicle(o, 3, q);
          break;
        case "seal":
          m = makeSeal(q);
          break;
        case "fox":
          m = makeFox(q);
          break;
        case "geyser":
          m = makeGeyser(o, q);
          break;
        case "windmill": {
          const P = this.course.P;
          const s = P[this.course.nearest(o.x, o.z)];
          m = makeWindmill(o, s.hw, q);
          m.rotation.y = -s.h;
          break;
        }
        case "bump": {
          const P = this.course.P;
          const s = P[o.i];
          const ridge = new THREE.CapsuleGeometry(0.28, s.hw * 2 - 0.5, 6, 14);
          ridge.rotateZ(Math.PI / 2);
          ridge.scale(1, 0.72, 1);
          m = new THREE.Group();
          const r = mesh(ridge, toyMat({ color: 0xffffff, rough: 0.86, coat: 0 }, q), 0, 0.07, 0, m);
          r.receiveShadow = true;
          m.rotation.y = -s.h;
          break;
        }
        case "avalanche": {
          m = this.makeAvalanche(o);
          break;
        }
        case "balls":
          o.pool = [];
          for (let i = 0; i < 6; i += 1) {
            const g = new THREE.Group();
            const b = mesh(ball(1, 1, 1, 1, 18), toyMat({ color: 0xffffff, rough: 0.88, coat: 0 }, q), 0, 0, 0, g);
            b.receiveShadow = true;
            const lumpM = toyMat({ color: 0xeaf4ff, rough: 0.9, coat: 0 }, q);
            for (let k = 0; k < 5; k += 1) {
              const a = (k / 5) * TAU;
              mesh(ball(0.22, 1, 1, 1, 8), lumpM, Math.cos(a) * 0.86, Math.sin(a * 2) * 0.3, Math.sin(a) * 0.86, g, false);
            }
            g.visible = false;
            this.root.add(g);
            o.pool.push(g);
          }
          break;
        case "chaser": {
          m = new THREE.Group();
          mesh(ball(o.r, 1, 1, 1, 26), toyMat({ color: 0xffffff, rough: 0.88, coat: 0 }, q), 0, 0, 0, m);
          const lumpM = toyMat({ color: 0xe6f2ff, rough: 0.9, coat: 0 }, q);
          const R = rng(5);
          for (let k = 0; k < 9; k += 1) {
            const a = R() * TAU;
            const b = R() * Math.PI;
            mesh(ball(o.r * 0.22, 1, 1, 1, 8), lumpM, Math.sin(b) * Math.cos(a) * o.r * 0.9, Math.cos(b) * o.r * 0.9, Math.sin(b) * Math.sin(a) * o.r * 0.9, m, false);
          }
          m.visible = false;
          break;
        }
        case "tunnel":
          this.buildTunnel(o);
          break;
        default:
          break;
      }
      if (m) {
        if (o.type !== "chaser" && o.x !== undefined) m.position.set(o.x, o.y, o.z);
        this.root.add(m);
        o.view = m;
      }
    }
    // 얼음 구멍
    for (const h of this.course.holes) {
      const m = makeHole(h.r, q);
      m.position.set(h.x, h.y, h.z);
      this.root.add(m);
    }
    // 체크포인트 깃발
    this.flags = [];
    for (const k of this.course.checks) {
      const f = makeFlag(q);
      const P = this.course.P;
      const s = P[k.i];
      f.position.set(k.x + s.rx * (k.hw - 0.2), k.y, k.z + s.rz * (k.hw - 0.2));
      f.rotation.y = -s.h;
      this.root.add(f);
      this.flags.push({ f, k });
    }
  }
  makeAvalanche(o) {
    const G = new THREE.Group();
    const P = this.course.P;
    const s = P[o.i];
    G.rotation.y = -s.h;
    const w = (o.hw + 0.6) * 2;
    // 경고 줄무늬
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#ff5a4a";
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = "#fff0a8";
    for (let i = -2; i < 12; i += 2) {
      g.beginPath();
      g.moveTo(i * 24, 64);
      g.lineTo(i * 24 + 24, 64);
      g.lineTo(i * 24 + 48, 0);
      g.lineTo(i * 24 + 24, 0);
      g.closePath();
      g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(w / 5, 1);
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(w, o.band), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    warn.rotation.x = -Math.PI / 2;
    warn.position.y = 0.05;
    G.add(warn);
    // 쏟아지는 눈 파도
    const wave = new THREE.Group();
    const q = this.q;
    const sm = toyMat({ color: 0xffffff, rough: 0.9, coat: 0 }, q);
    const R = rng(o.i);
    for (let i = 0; i < 12; i += 1) {
      const r = 0.7 + R() * 0.9;
      mesh(ball(r, 1, 0.9, 1, 12), sm, (R() - 0.7) * 3, r * 0.6 + R() * 1.1, (i / 11 - 0.5) * o.band, wave, this.q === "high");
    }
    wave.visible = false;
    G.add(wave);
    G.userData = { warn, wave };
    return G;
  }
  buildTunnel(o) {
    const P = this.course.P;
    const q = this.q;
    o.rings = [];
    const mat = toyMat({ color: 0xf6fbff, rough: 0.84, coat: 0, transparent: true, opacity: 1 }, q);
    o.ringMat = mat;
    const inner = toyMat({ color: 0xbfe0f6, rough: 0.5, coat: 0.2, transparent: true, opacity: 1 }, q);
    o.ringInner = inner;
    for (let i = o.i0 + 2; i < o.i1; i += 6) {
      const s = P[i];
      const r = s.hw + 0.5;
      const geo = new THREE.TorusGeometry(r, 0.42, 8, 20, Math.PI);
      geo.scale(1, 0.92, 1.9);
      const g = new THREE.Group();
      g.position.set(s.x, s.y + 0.05, s.z);
      g.rotation.y = -s.h;
      const m = mesh(geo, i % 12 < 6 ? mat : inner, 0, 0, 0, g, q === "high");
      m.receiveShadow = false;
      this.root.add(g);
      o.rings.push({ g, s: s.s, vy: 0, down: false, y0: s.y + 0.05 });
    }
  }
  buildItems() {
    const list = this.course.items;
    const fish = list.filter((i) => i.type === "fish");
    this.fishList = fish;
    if (fish.length) {
      const m = toyMat({ color: 0xffa800, rough: 0.2, coat: 1, emissive: 0xff7a00, emissiveIntensity: 0.2, metalness: 0.2 }, this.q);
      this.fish = new THREE.InstancedMesh(fishGeo(), m, fish.length);
      this.fish.castShadow = this.q !== "low";
      this.fish.frustumCulled = false;
      this.root.add(this.fish);
    }
    this.others = [];
    for (const it of list) {
      if (it.type === "fish") continue;
      const m = makeItem(it.type, this.q);
      m.position.set(it.x, it.y, it.z);
      this.root.add(m);
      this.others.push({ it, m });
    }
    this._d = new THREE.Object3D();
  }
  buildBoxes() {
    this.boxViews = this.sim.boxes.map((b) => {
      const m = makeBox(b.kind, b.d.size, this.q);
      this.root.add(m);
      const sh = this.blob(b.d.size * 1.35);
      return { b, m, sh, rot: new THREE.Euler() };
    });
    this.pShadow = this.blob(1.25);
  }
  blob(size) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: softTex(), color: 0x1d3a66, transparent: true, opacity: 0.36, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    this.root.add(m);
    return m;
  }
  buildGoal() {
    const g = this.course.goal;
    const P = this.course.P;
    const key = this.course.world.key;
    const s = P[g.i];
    const G = new THREE.Group();
    this.ring = makeGoalRing(g.r);
    this.ring.position.set(g.x, g.y, g.z);
    this.root.add(this.ring);
    const hx = g.x + s.dx * 7.2;
    const hz = g.z + s.dz * 7.2;
    // 받침
    const base = lathe([[0.001, 0.03], [6.2, 0.02], [6.8, -0.3], [6.7, -2], [4.5, -6], [0.001, -8]], this.q === "low" ? 18 : 30, 12);
    const bm = mesh(base, toyMat({ color: 0xf6fbff, rough: 0.86, coat: 0 }, this.q), hx, g.y, hz, G);
    bm.receiveShadow = true;
    const h = makeHouse(key, this.q === "high" ? "mid" : this.q);
    h.position.set(hx, g.y, hz);
    h.rotation.y = -s.h;
    h.scale.setScalar(1.12);
    G.add(h);
    this.chimney = new THREE.Vector3(1.25, 5.8, -0.55).multiplyScalar(1.12);
    this.chimney.applyAxisAngle(new THREE.Vector3(0, 1, 0), -s.h);
    this.chimney.add(new THREE.Vector3(hx, g.y, hz));
    if (key === "sea") {
      // 등대
      const lx = hx - s.rx * 6;
      const lz = hz - s.rz * 6;
      const tower = new THREE.CylinderGeometry(1, 1.5, 9, 18, 6);
      const col = [];
      const pa = tower.attributes.position;
      for (let i = 0; i < pa.count; i += 1) {
        const band = Math.floor((pa.getY(i) + 4.5) / 2.25) % 2;
        const c = new THREE.Color(band ? 0xe9463c : 0xffffff);
        col.push(c.r, c.g, c.b);
      }
      tower.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      mesh(tower, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), lx, g.y + 4.5, lz, G);
      mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffc640, emissiveIntensity: 1.2 }), lx, g.y + 9.6, lz, G);
      mesh(new THREE.ConeGeometry(1.25, 1.2, 12), toyMat({ color: 0xe9463c, rough: 0.4, coat: 0.5 }, this.q), lx, g.y + 10.8, lz, G);
    }
    if (key === "aurora") {
      // 얼음 성
      const cm = new THREE.MeshPhysicalMaterial({ color: 0xcfe0ff, roughness: 0.16, clearcoat: 1, emissive: 0x3a3ad0, emissiveIntensity: 0.3 });
      const roof = toyMat({ color: 0x7a5cff, rough: 0.2, coat: 1, emissive: 0x4a30e0, emissiveIntensity: 0.4 }, this.q);
      for (const [lat, fwd, r, ht] of [[-9, 8, 2.2, 13], [9, 8, 2.2, 13], [-4.6, 13, 2, 18], [4.6, 13, 2, 18], [0, 16, 3, 24]]) {
        const x = hx + s.rx * lat + s.dx * fwd;
        const z = hz + s.rz * lat + s.dz * fwd;
        mesh(new THREE.CylinderGeometry(r * 0.86, r, ht, 12), cm, x, g.y - 2 + ht / 2, z, G);
        mesh(new THREE.ConeGeometry(r * 1.2, r * 2.4, 12), roof, x, g.y - 2 + ht + r * 1.2, z, G);
      }
      const wall = roundBox(new THREE.BoxGeometry(22, 8, 3, 6, 3, 2), 22, 8, 3, 0.5);
      const wm = mesh(wall, cm, hx + s.dx * 10, g.y + 2, hz + s.dz * 10, G);
      wm.rotation.y = -s.h;
    }
    // 손님
    this.npc = makeNpc(this.q);
    const nx = g.x + s.dx * 3.7 + s.rx * 1.9;
    const nz = g.z + s.dz * 3.7 + s.rz * 1.9;
    this.npc.position.set(nx, g.y, nz);
    this.npc.rotation.y = -s.h;
    this.npc.scale.setScalar(1.05);
    G.add(this.npc);
    // 시작 표지
    const st = P[Math.min(10, P.length - 1)];
    const depot = makeDepot(this.q);
    const at = P[0];
    depot.position.set(at.x + at.rx * (at.hw + 3.4) + at.dx * 4, at.y, at.z + at.rz * (at.hw + 3.4) + at.dz * 4);
    depot.rotation.y = -at.h - Math.PI / 2 + 0.5;
    void st;
    G.add(depot);
    this.root.add(G);
  }
  buildMarkers() {
    const q = this.q;
    this.gull = makeGull(q);
    this.gull.visible = false;
    this.root.add(this.gull);
    // 떨어진 택배 머리 위 화살표
    const a = new THREE.Group();
    const cone = new THREE.ConeGeometry(0.32, 0.56, 12);
    cone.rotateX(Math.PI);
    mesh(cone, new THREE.MeshStandardMaterial({ color: 0xff4d5a, emissive: 0xff2a3a, emissiveIntensity: 0.55, roughness: 0.3 }), 0, 0, 0, a, false);
    a.visible = false;
    this.root.add(a);
    this.pin = a;
    // 펭귄 옆 바닥 화살표: 택배가 있는 쪽
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.62);
    shape.lineTo(0.42, 0.06);
    shape.lineTo(0.16, 0.06);
    shape.lineTo(0.16, -0.4);
    shape.lineTo(-0.16, -0.4);
    shape.lineTo(-0.16, 0.06);
    shape.lineTo(-0.42, 0.06);
    shape.closePath();
    const ag = new THREE.ShapeGeometry(shape);
    ag.rotateX(-Math.PI / 2);
    this.arrow = new THREE.Mesh(ag, new THREE.MeshBasicMaterial({ color: 0xff4d5a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    this.arrow.visible = false;
    this.root.add(this.arrow);
    // 보호 효과
    this.shieldM = new THREE.Mesh(ball(0.92, 1, 1.05, 1, 22), new THREE.MeshPhysicalMaterial({ color: 0x62c4ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.2, depthWrite: false, emissive: 0x2a86e0, emissiveIntensity: 0.3 }));
    this.shieldM.visible = false;
    this.root.add(this.shieldM);
    this.wrapM = new THREE.MeshPhysicalMaterial({ color: 0xbef1ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.45, depthWrite: false });
    this.wraps = this.sim.boxes.map((b) => {
      const m = new THREE.Mesh(roundBox(new THREE.BoxGeometry(b.d.size * 1.2, b.d.size * 1.2, b.d.size * 1.2, 3, 3, 3), b.d.size * 1.2, b.d.size * 1.2, b.d.size * 1.2, b.d.size * 0.2), this.wrapM);
      m.visible = false;
      this.root.add(m);
      return m;
    });
    // 수레바퀴처럼 쌓이는 눈 흔적은 입자로 처리
  }

  /* ---------- 사건 효과 ---------- */
  puff(x, y, z, n, size, col = COL.snow, speed = 2.4, up = 1.6, life = 0.5) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = speed * (0.3 + Math.random());
      this.fx.add(x, y, z, Math.cos(a) * v, up * Math.random(), Math.sin(a) * v, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.8), col, 3, size * 0.9);
    }
  }
  sparkle(x, y, z, n, col = COL.gold, speed = 3.2, size = 0.3) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const v = speed * (0.5 + Math.random());
      this.glow.add(x, y, z, Math.cos(a) * Math.cos(b) * v, Math.abs(Math.sin(b)) * v + 0.5, Math.sin(a) * Math.cos(b) * v, size * (0.5 + Math.random()), 0.45 + Math.random() * 0.4, col, 5);
    }
  }
  confetti(x, y, z, n) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const v = 2 + Math.random() * 5;
      this.fx.add(x, y + 1.5, z, Math.cos(a) * v, 5 + Math.random() * 7, Math.sin(a) * v, 0.16 + Math.random() * 0.14, 1.2 + Math.random() * 1, CONFETTI[i % CONFETTI.length], 10);
    }
  }
  onEvent(e) {
    const P = this.penguin;
    switch (e.t) {
      case "drop":
        P.trigger("drop", 0.55);
        this.shake = Math.max(this.shake, 0.22);
        this.puff(e.x, e.y - 0.3, e.z, 8, 0.4);
        break;
      case "catch":
        if (e.nice) {
          P.trigger("catch", 0.42);
          this.sparkle(e.x, e.y, e.z, 26, COL.gold, 4.6, 0.36);
        } else {
          P.trigger("pick", 0.42);
          this.sparkle(e.x, e.y, e.z, 10, COL.gold, 3);
        }
        break;
      case "land":
        P.trigger("land", 0.22);
        P.landK = e.k;
        this.puff(e.x, e.y + 0.08, e.z, Math.round(4 + e.k * 12), 0.34 + e.k * 0.3, e.surf === "ice" ? COL.ice : COL.snow, 2.2 + e.k * 2);
        if (e.k > 0.55) this.shake = Math.max(this.shake, e.k * 0.2);
        break;
      case "bump":
        this.puff(e.x, e.y + 0.6, e.z, 8, 0.32, COL.snow, 3);
        this.shake = Math.max(this.shake, 0.14 * e.k + 0.05);
        break;
      case "hit":
      case "plop":
        this.puff(e.x, e.y + 0.3, e.z, 12, 0.42, COL.snow, 3.4);
        this.shake = Math.max(this.shake, 0.26);
        break;
      case "snowed":
        this.puff(e.x, e.y + 0.8, e.z, 26, 0.62, COL.white, 5, 3);
        this.shake = Math.max(this.shake, 0.32);
        break;
      case "snowoff":
        this.puff(e.x, e.y + 0.8, e.z, 22, 0.5, COL.white, 4.4, 3.2);
        break;
      case "fall":
        if (e.water) {
          for (let i = 0; i < 26; i += 1) {
            const a = Math.random() * TAU;
            const v = 1 + Math.random() * 3;
            this.fx.add(e.x, e.y + 0.1, e.z, Math.cos(a) * v, 3 + Math.random() * 5, Math.sin(a) * v, 0.25 + Math.random() * 0.3, 0.75, COL.water, 12);
          }
        }
        break;
      case "respawn":
        this.puff(e.x, e.y + 0.1, e.z, 10, 0.5, COL.white, 2.4);
        break;
      case "boxbump":
        this.puff(e.x, e.y - 0.25, e.z, Math.round(3 + e.k * 7), 0.28, COL.snow, 1.8);
        break;
      case "boxsplash":
        for (let i = 0; i < 14; i += 1) {
          const a = Math.random() * TAU;
          this.fx.add(e.x, e.y + 0.1, e.z, Math.cos(a) * 1.6, 2 + Math.random() * 3, Math.sin(a) * 1.6, 0.26, 0.7, COL.water, 10);
        }
        break;
      case "item":
        this.sparkle(e.x, e.y, e.z, e.kind === "fish" ? 5 : 18, e.kind === "star" ? COL.gold : e.kind === "fish" ? COL.gold : COL.blue, 2.6, 0.26);
        break;
      case "spring":
      case "launched":
        this.puff(e.x, e.y + 0.3, e.z, 10, 0.4, COL.white, 3);
        this.shake = Math.max(this.shake, 0.08);
        break;
      case "crack":
        this.puff(e.x, e.y + 0.05, e.z, 5, 0.26, COL.ice, 1.5);
        break;
      case "crumble":
        for (let i = 0; i < 14; i += 1) {
          const a = Math.random() * TAU;
          this.fx.add(e.x + Math.cos(a), e.y, e.z + Math.sin(a), Math.cos(a) * 1.4, Math.random() * 1.5, Math.sin(a) * 1.4, 0.26 + Math.random() * 0.22, 0.75, e.kind === "plank" ? COL.wood : COL.ice, 12);
        }
        break;
      case "iceshatter":
        for (let i = 0; i < 18; i += 1) {
          const a = Math.random() * TAU;
          const v = 1 + Math.random() * 4;
          this.fx.add(e.x, e.y + 0.3, e.z, Math.cos(a) * v, 2 + Math.random() * 4, Math.sin(a) * v, 0.22, 0.7, COL.ice, 14);
        }
        this.shake = Math.max(this.shake, 0.12);
        break;
      case "snowman":
        this.puff(e.x, e.y + 1.1, e.z, 16, 0.55, COL.white, 3.2, 3);
        break;
      case "ballbreak":
        this.puff(e.x, e.y, e.z, e.big ? 40 : 14, e.big ? 1 : 0.6, COL.white, e.big ? 6 : 3.4, 4);
        break;
      case "deliver": {
        this.confetti(e.x, e.y, e.z, 90);
        this.sparkle(e.x, e.y + 1, e.z, 30, COL.gold, 5, 0.4);
        // 택배가 통통 튀어 손님에게 날아감
        const n = this.npc.position;
        this.flying = this.boxViews
          .filter((v) => e.boxes.includes(v.b))
          .map((v, i) => ({ v, t: -i * 0.14, from: v.m.position.clone(), to: new THREE.Vector3(n.x + (i - 0.5) * 0.5, n.y + 0.45, n.z) }));
        break;
      }
      case "shieldoff":
      case "bubbleoff":
        this.sparkle(e.x, e.y + 0.8, e.z, 16, COL.blue, 4, 0.34);
        this.shake = Math.max(this.shake, 0.12);
        break;
      case "avalanche":
        this.shake = Math.max(this.shake, 0.2);
        break;
      case "check":
        this.sparkle(e.x, e.y + 1.8, e.z, 14, COL.green, 3, 0.3);
        break;
      default:
        break;
    }
  }

  /* ---------- 매 프레임 ---------- */
  update(dt) {
    const sim = this.sim;
    const p = sim.p;
    this.t += dt;
    const T = this.t;
    this.syncPenguin(dt);
    this.syncPads(dt, T);
    this.syncObjs(dt, T);
    this.syncItems(dt, T);
    this.syncBoxes(dt, T);
    this.syncCamera(dt);
    this.syncFx(dt, T);
    this.stage.followShadow(p.x, p.y, p.z);
    this.stage.time += dt;
  }
  syncPenguin(dt) {
    const sim = this.sim;
    const p = sim.p;
    const P = this.penguin;
    const ry = Math.PI - p.face;
    const g = P.group;
    // 경사를 따라 살짝 숙임
    let slopeP = 0;
    if (p.grounded && !p.pad && p.slope && p.gdx !== undefined) {
      const fx = Math.sin(p.face);
      const fz = -Math.cos(p.face);
      slopeP = -Math.atan(p.slope * (fx * p.gdx + fz * p.gdz)) * 0.7;
    }
    this.slopeP = lerp(this.slopeP || 0, slopeP, Math.min(1, dt * 10));
    g.position.set(p.x, p.y, p.z);
    g.rotation.set(this.slopeP, ry, 0, "YXZ");
    const cos = Math.cos(ry);
    const sin = Math.sin(ry);
    const wx = p.w.x;
    const wz = p.w.z;
    const lost = sim.boxes.find((b) => b.state === "free" || b.state === "stolen");
    let lookBox;
    if (lost) {
      const a = Math.atan2(lost.x - p.x, -(lost.z - p.z));
      let da = a - p.face;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      lookBox = -da * 0.8;
    }
    const S = {
      mode: p.mode === "splash" ? "splash" : p.mode,
      speed: Math.hypot(p.vx, p.vz),
      grounded: p.grounded,
      vy: p.vy,
      slip: p.slip,
      slipA: p.slipA,
      carrying: p.stack.length,
      tiltX: wx * cos - wz * sin,
      tiltZ: wx * sin + wz * cos,
      lost: Boolean(lost),
      lookBox,
      spin: p.spin,
      wiggle: p.wiggle,
      landK: P.landK,
      surf: p.surf,
    };
    P.update(dt, S);
    g.visible = !(p.mode === "splash" && !p.water ? p.modeT < 0.75 : p.mode === "splash" && p.modeT < 0.9);
    if (p.mode === "splash" && p.water) g.position.y = lerp(this.course.seaY === null ? p.y : this.course.seaY - 0.8, g.position.y, 0);
    // 무적 깜빡임
    if (p.inv > 0 && p.mode === "run" && Math.floor(this.t * 14) % 2 === 0) g.visible = false;
    // 그림자
    const sh = this.pShadow;
    const gr = sim.ground(p.x, p.z, p.y + 0.3, 0.3);
    if (gr && p.mode !== "splash") {
      const h = Math.max(0, p.y - gr.y);
      sh.visible = true;
      sh.position.set(p.x, gr.y + 0.035, p.z);
      const k = clamp(1 - h / 6, 0.25, 1);
      sh.material.opacity = 0.4 * k;
      sh.scale.setScalar(lerp(0.7, 1.05, k));
    } else sh.visible = false;
    // 보호막
    this.shieldM.visible = p.shield > 0;
    if (p.shield > 0) {
      this.shieldM.position.set(p.x, p.y + 0.66, p.z);
      this.shieldM.scale.setScalar(1 + Math.sin(this.t * 6) * 0.02);
      this.shieldM.material.opacity = p.shield < 2.5 && Math.floor(this.t * 10) % 2 ? 0.05 : 0.2;
    }
  }
  syncPads(dt, T) {
    for (const p of this.course.pads) {
      const v = p.view;
      if (!v) continue;
      v.position.set(p.x, p.y, p.z);
      if (p.bob) {
        const on = this.sim.p.pad === p;
        const lx = on ? (this.sim.p.x - p.x) * 0.035 : 0;
        const lz = on ? (this.sim.p.z - p.z) * 0.035 : 0;
        v.rotation.z += (-lx + Math.sin(T * 1.1 + p.x0) * 0.012 - v.rotation.z) * Math.min(1, dt * 5);
        v.rotation.x += (lz + Math.cos(T * 1.3 + p.z0) * 0.012 - v.rotation.x) * Math.min(1, dt * 5);
      }
      if (p.kind === "crumble" || p.kind === "plank") {
        if (p.state === 1) {
          v.position.x += Math.sin(T * 60) * 0.03;
          v.position.z += Math.cos(T * 53) * 0.03;
        }
        if (p.state === 2) {
          v.rotation.x += dt * 1.4;
          v.rotation.z += dt * 0.9;
          v.visible = p.t < 1.4;
        } else {
          v.visible = true;
          if (p.state === 0 && p.kind !== "plank") {
            v.rotation.x *= 0.8;
            v.rotation.z *= 0.8;
          } else if (p.state === 0) {
            v.rotation.x = 0;
            v.rotation.z = 0;
          }
        }
      }
      if (p.kind === "vanish") {
        const mat = v.userData.topMat;
        const on = p.solid;
        const flick = p.warn ? 0.5 + 0.5 * Math.sin(T * 26) : 1;
        v.visible = true;
        const target = on ? 0.86 * flick + 0.1 : 0.1;
        mat.opacity += (target - mat.opacity) * Math.min(1, dt * 14);
        v.scale.setScalar(on ? 1 : 0.94);
        if (v.userData.ring) v.userData.ring.material.opacity = on ? 0.8 * flick : 0.14;
      }
      if (p.kind === "magic" && v.userData.ring) {
        v.userData.ring.rotation.y = T * 0.8;
        v.userData.ring.material.opacity = 0.55 + Math.sin(T * 3) * 0.25;
      }
    }
  }
  syncObjs(dt, T) {
    const sim = this.sim;
    const P = this.course.P;
    for (const o of this.course.objs) {
      const v = o.view;
      switch (o.type) {
        case "snowman":
          if (o.down) {
            const u = clamp((sim.t - o.downT) / 0.5, 0, 1);
            const head = v.userData.head;
            head.position.y = Math.max(0.3, 1.8 - u * u * 1.6);
            head.position.x = u * 1.1;
            head.position.z = u * 0.7;
            head.rotation.z = -u * 2.6;
            v.userData.mid.position.y = 1.22 - u * 0.75;
            v.userData.mid.position.x = -u * 0.5;
            v.userData.mid.scale.y = 1 - u * 0.2;
            v.userData.low.scale.y = 1 - u * 0.45;
            for (const c of v.children) {
              if (c !== head && c !== v.userData.mid && c !== v.userData.low) c.visible = u < 0.15;
            }
          } else {
            v.rotation.z = Math.sin(T * 2.1 + o.x) * 0.018;
          }
          break;
        case "rotor":
          v.userData.arm.rotation.y = -o.ang;
          break;
        case "spring": {
          const k = o.kick > 0 ? Math.sin((o.kick / 0.4) * Math.PI) : 0;
          v.userData.pad.position.y = 0.5 + k * 0.5;
          v.userData.coil.scale.y = 1 + k * 1.4;
          break;
        }
        case "vent":
          v.userData.fan.rotation.y += dt * (o.on ? 16 : o.warn ? 5 : 1);
          {
            const m = v.userData.column.material;
            m.uniforms.t.value = T;
            const tk = o.on ? 1 : o.warn ? 0.25 : 0;
            m.uniforms.k.value += (tk - m.uniforms.k.value) * Math.min(1, dt * 8);
          }
          break;
        case "icicle": {
          v.userData.cloud.position.y = o.top - o.y + 0.6;
          const sp = v.userData.spike;
          sp.visible = o.state !== "gone";
          sp.position.y = o.fy - o.y + 0.25;
          if (o.state === "warn") {
            sp.position.x = Math.sin(T * 44) * 0.05;
          } else sp.position.x = 0;
          this.iceWarn(o);
          break;
        }
        case "seal": {
          v.position.set(o.x, o.y, o.z);
          v.rotation.y = Math.PI - o.dir;
          const hop = o.state === "dizzy" ? 0 : Math.abs(Math.sin(T * 5.5 + o.x0)) * 0.14;
          v.position.y += hop;
          v.rotation.z = Math.sin(T * 5.5) * 0.08;
          v.userData.head.rotation.x = o.state === "carry" ? -0.2 : Math.sin(T * 2) * 0.1;
          v.userData.head.rotation.z = o.state === "dizzy" ? Math.sin(T * 9) * 0.4 : 0;
          break;
        }
        case "fox": {
          v.position.set(o.x, o.y, o.z);
          const hide = o.state === "hide";
          const gone = o.state === "gone";
          v.visible = !gone;
          let scale = 1;
          if (hide) {
            v.position.y -= 0.42 + Math.sin(T * 1.8) * 0.05;
            scale = 0.95;
          } else if (o.state === "leave") {
            scale = clamp(1 - o.t, 0.01, 1);
          }
          v.scale.setScalar(scale);
          const near = Math.atan2(sim.p.x - o.x, -(sim.p.z - o.z));
          v.rotation.y = Math.PI - (o.state === "flee" || o.state === "dash" ? o.dir : near);
          const run = o.state === "dash" || o.state === "flee";
          v.userData.tail.rotation.x = Math.sin(T * (run ? 14 : 4)) * 0.3;
          v.userData.legs.forEach((l, i) => {
            l.position.y = 0.11 + (run ? Math.max(0, Math.sin(T * 18 + (i % 2) * Math.PI)) * 0.14 : 0);
          });
          v.userData.head.rotation.z = o.state === "dizzy" ? Math.sin(T * 8) * 0.4 : 0;
          v.position.y += run ? Math.abs(Math.sin(T * 9)) * 0.1 : 0;
          break;
        }
        case "geyser": {
          const col = v.userData.col;
          v.userData.colM.uniforms.t.value = T;
          const ht = o.state === 2 ? 5.8 : o.state === 1 ? 0.5 + Math.sin(T * 22) * 0.2 : 0.001;
          col.scale.y += (ht - col.scale.y) * Math.min(1, dt * (o.state === 2 ? 16 : 7));
          col.visible = col.scale.y > 0.02;
          if (o.state === 1 && Math.random() < 0.3) this.fx.add(o.x + (Math.random() - 0.5) * o.r, o.y + 0.2, o.z + (Math.random() - 0.5) * o.r, 0, 1.6, 0, 0.18, 0.4, COL.water, 2);
          if (o.state === 2 && Math.random() < 0.7) {
            const a = Math.random() * TAU;
            this.fx.add(o.x, o.y + 5, o.z, Math.cos(a) * 2.2, 2, Math.sin(a) * 2.2, 0.32, 0.8, COL.water, 12);
          }
          break;
        }
        case "windmill":
          v.userData.rotor.rotation.z = o.ang;
          break;
        case "avalanche": {
          const { warn, wave } = v.userData;
          warn.material.opacity = o.state === 1 ? 0.45 + Math.sin(T * 18) * 0.3 : 0;
          warn.material.map.offset.x = -T * 0.8;
          wave.visible = o.state === 2;
          if (o.state === 2) {
            wave.position.x = -o.hw - 2 + o.k * (o.hw * 2 + 4);
            wave.rotation.z = -Math.sin(o.k * 30) * 0.03;
            if (Math.random() < 0.8) {
              const s = P[o.i];
              const lat = wave.position.x;
              this.puff(o.x + s.rx * lat + s.dx * (Math.random() - 0.5) * o.band, o.y + 0.4, o.z + s.rz * lat + s.dz * (Math.random() - 0.5) * o.band, 1, 0.8, COL.white, 3, 2, 0.5);
            }
          }
          break;
        }
        case "balls": {
          let n = 0;
          for (const b of o.list) {
            if (!b.on || n >= o.pool.length) continue;
            const g = o.pool[n];
            g.visible = true;
            g.position.set(b.x, b.y, b.z);
            g.scale.setScalar(b.r);
            const s = P[clamp(Math.round(b.s / DS), 0, P.length - 1)];
            g.rotation.set(0, -s.h, 0);
            g.rotateX(-b.rot);
            if (Math.random() < 0.25) this.fx.add(b.x, b.y - b.r * 0.85, b.z, (Math.random() - 0.5) * 1.5, 0.8, (Math.random() - 0.5) * 1.5, 0.3, 0.4, COL.snow, 2);
            n += 1;
          }
          for (let i = n; i < o.pool.length; i += 1) o.pool[i].visible = false;
          break;
        }
        case "chaser":
          v.visible = o.active;
          if (o.active) {
            v.position.set(o.x, o.y, o.z);
            const s = P[clamp(Math.round(o.sNow / DS), 0, P.length - 1)];
            v.rotation.set(0, -s.h, 0);
            v.rotateX(-(o.rot || 0));
            if (Math.random() < 0.7) this.puff(o.x, o.y - o.r * 0.8, o.z, 1, 0.6, COL.white, 2.6, 2, 0.5);
            this.shake = Math.max(this.shake, 0.05);
          }
          break;
        case "tunnel": {
          const inside = sim.c.P[clamp(sim.p.idx, 0, P.length - 1)].s;
          const near = inside > o.s0 - 3 && inside < o.s1 + 4;
          const op = near ? 0.34 : 1;
          o.ringMat.opacity += (op - o.ringMat.opacity) * Math.min(1, dt * 6);
          o.ringInner.opacity = o.ringMat.opacity;
          for (const r of o.rings) {
            if (!r.down && o.front >= r.s && (o.active || o.done)) {
              r.down = true;
              r.vy = 0;
              this.puff(r.g.position.x, r.y0 + 2, r.g.position.z, 12, 0.7, COL.white, 3.4, 2);
              this.shake = Math.max(this.shake, 0.09);
            }
            if (r.down && r.g.visible) {
              r.vy -= 22 * dt;
              r.g.position.y += r.vy * dt;
              r.g.scale.multiplyScalar(1 - dt * 1.1);
              if (r.g.position.y < r.y0 - 3) r.g.visible = false;
            }
          }
          break;
        }
        default:
          break;
      }
    }
    // 깃발
    for (const { f, k } of this.flags) {
      const fl = f.userData.flag;
      fl.rotation.y = Math.sin(T * 5 + k.x) * 0.18;
      if (k.on) {
        fl.position.y += (2.2 - fl.position.y) * Math.min(1, dt * 5);
        fl.material.color.lerp(COL.green, Math.min(1, dt * 5));
      }
    }
    // 손님
    if (this.npc) {
      const n = this.npc.userData;
      const excited = sim.state === "delivering" || sim.state === "won";
      n.arm.rotation.z = -2.3 + Math.sin(T * (excited ? 16 : 7)) * 0.42;
      this.npc.position.y = this.course.goal.y + (excited ? Math.abs(Math.sin(T * 7)) * 0.4 : Math.abs(Math.sin(T * 3)) * 0.04);
    }
    const ring = this.ring;
    ring.userData.beamM.uniforms.t.value = T;
    ring.userData.ring.scale.setScalar(1 + Math.sin(T * 3) * 0.02);
    ring.visible = sim.state === "play" || sim.state === "intro";
  }
  iceWarn(o) {
    if (!o.warnM) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(o.r + 0.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4d5a, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
      m.position.set(o.x, o.y + 0.05, o.z);
      this.root.add(m);
      o.warnM = m;
    }
    const active = o.state === "warn" || o.state === "fall";
    o.warnM.material.opacity = active ? 0.34 + Math.sin(this.t * 22) * 0.16 : 0;
    o.warnM.scale.setScalar(active ? (o.state === "warn" ? 0.5 + (o.t / 0.8) * 0.5 : 1) : 1);
  }
  syncItems(dt, T) {
    if (this.fish) {
      const d = this._d;
      this.fishList.forEach((it, i) => {
        if (!it.on) {
          d.scale.setScalar(0);
          d.position.set(0, -999, 0);
        } else {
          d.position.set(it.x, it.y + Math.sin(T * 2.6 + i) * 0.09, it.z);
          d.rotation.set(0, T * 2.3 + i * 0.6, 0);
          d.scale.setScalar(1);
        }
        d.updateMatrix();
        this.fish.setMatrixAt(i, d.matrix);
      });
      this.fish.instanceMatrix.needsUpdate = true;
    }
    for (const a of this.others) {
      a.m.visible = a.it.on;
      if (a.it.on) {
        a.m.position.y = a.it.y + Math.sin(T * 2.4) * 0.12;
        a.m.rotation.y = T * 1.7;
      }
    }
  }
  syncBoxes(dt, T) {
    const sim = this.sim;
    const p = sim.p;
    const pg = this.penguin;
    const headW = this._hw || (this._hw = new THREE.Vector3());
    pg.group.updateMatrixWorld(true);
    pg.head.getWorldPosition(headW);
    const sliding = p.mode === "slide";
    const up = sliding ? 0.46 : 0.31;
    this.slideK = lerp(this.slideK || 0, sliding ? 1 : 0, Math.min(1, dt * 14));
    let free = null;
    for (let vi = 0; vi < this.boxViews.length; vi += 1) {
      const v = this.boxViews[vi];
      const b = v.b;
      const m = v.m;
      const fly = this.flying && this.flying.find((f) => f.v === v);
      if (fly) {
        fly.t += dt / 0.72;
        const u = clamp(fly.t, 0, 1);
        m.visible = u < 1;
        m.position.lerpVectors(fly.from, fly.to, u);
        m.position.y += Math.sin(u * Math.PI) * 2.2;
        m.rotation.x += dt * 7;
        m.rotation.z += dt * 4;
        const k = u > 0.85 ? (1 - u) / 0.15 : 1;
        m.scale.setScalar(Math.max(0.01, k));
        v.sh.visible = false;
        this.wraps[vi].visible = false;
        if (u >= 1 && !fly.popped) {
          fly.popped = true;
          this.sparkle(fly.to.x, fly.to.y + 0.4, fly.to.z, 22, COL.gold, 4, 0.34);
        }
        continue;
      }
      m.visible = b.state !== "done" && b.state !== "broken";
      if (!m.visible) {
        v.sh.visible = false;
        continue;
      }
      if (b.state === "held") {
        const i = p.stack.indexOf(b);
        let y = 0;
        for (let k = 0; k < i; k += 1) y += p.stack[k].d.size;
        const h = y + b.d.size / 2;
        const wob = 1 + h * 0.9;
        const sway = (kk) => kk * wob * 0.9;
        const hx = lerp(headW.x, p.x, this.slideK);
        const hz = lerp(headW.z, p.z, this.slideK);
        const hy = lerp(headW.y + up, p.y + 0.98, this.slideK);
        const introK = sim.state === "intro" ? Math.max(0, 1 - (sim.stateT / sim.introLen) * 1.5) : 0;
        m.position.set(hx + sway(p.w.x), hy + h + introK * introK * 5 + Math.abs(Math.sin(introK * 18)) * 0.05, hz + sway(p.w.z));
        m.rotation.set(p.w.z * wob * 0.9, Math.PI - p.face, -p.w.x * wob * 0.9, "YXZ");
        v.sh.visible = false;
      } else {
        m.position.set(b.x, b.y, b.z);
        m.rotation.set(b.rx, Math.PI - p.face * 0 + vi, b.rz, "XYZ");
        // 그림자
        const gr = sim.ground(b.x, b.z, b.y, 0.2);
        if (gr && b.state === "free") {
          v.sh.visible = true;
          v.sh.position.set(b.x, gr.y + 0.03, b.z);
          v.sh.material.opacity = 0.34 * clamp(1 - (b.y - gr.y) / 6, 0.2, 1);
        } else v.sh.visible = false;
        if (b.state === "free" && !free) free = b;
        if (b.state === "stolen" && !free) free = b;
      }
      // 표정
      const ud = m.userData;
      const tilt = Math.hypot(p.w.x, p.w.z);
      const show = b.face > 0 || (b.state === "held" && tilt > 0.28);
      ud.faces.visible = show;
      if (show) ud.faceMat.map.offset.x = b.face > 0 ? 0 : 0.5;
      // 충격에 말랑하게 찌그러짐
      const sq = b.face > 1 ? (b.face - 1) * 0.5 : 0;
      m.scale.set(1 + sq * 0.3, 1 - sq * 0.35, 1 + sq * 0.3);
      if (ud.balloon) ud.balloon.position.y = b.d.size * 1.15 + Math.sin(T * 3) * 0.06;
      const wrap = this.wraps[vi];
      wrap.visible = p.bubble > 0 && b.state === "held";
      if (wrap.visible) {
        wrap.position.copy(m.position);
        wrap.rotation.copy(m.rotation);
      }
    }
    // 잃어버린 택배 표시
    this.pin.visible = Boolean(free);
    this.arrow.visible = Boolean(free) && p.mode !== "splash";
    if (free) {
      this.pin.position.set(free.x, free.y + free.d.size * 0.5 + 0.62 + Math.abs(Math.sin(T * 5)) * 0.32, free.z);
      this.pin.rotation.y = T * 3;
      const a = Math.atan2(free.x - p.x, -(free.z - p.z));
      this.arrow.position.set(p.x + Math.sin(a) * 1.25, p.y + 0.09, p.z - Math.cos(a) * 1.25);
      this.arrow.rotation.y = -a;
      this.arrow.material.opacity = 0.65 + Math.sin(T * 9) * 0.3;
    }
    // 갈매기
    const rescuing = sim.boxes.find((b) => b.state === "rescue");
    this.gull.visible = Boolean(rescuing);
    if (rescuing) {
      this.gull.position.set(rescuing.x, rescuing.y + rescuing.d.size * 0.5 + 0.34, rescuing.z);
      const T2 = rescuing.from;
      this.gull.rotation.y = Math.atan2(rescuing.x - T2.x, rescuing.z - T2.z);
      for (const w of this.gull.userData.wings) w.j.rotation.z = w.s * (Math.sin(T * 18) * 0.65);
    }
  }
  syncCamera(dt) {
    const sim = this.sim;
    const p = sim.p;
    const P = this.course.P;
    const C = this.cam;
    const stage = this.stage;
    const cam = stage.camera;
    const portrait = stage.h > stage.w * 1.05;
    const lookIdx = clamp(p.idx + 18, 0, P.length - 1);
    const look = P[lookIdx];
    // 길 방향을 따라 천천히 돎
    let want = look.h;
    let da = want - C.yaw;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    C.yaw += da * Math.min(1, dt * 1.5);
    // 목표: 펭귄 + 앞쪽 조금 + 떨어진 택배 쪽
    const dx = Math.sin(C.yaw);
    const dz = -Math.cos(C.yaw);
    let tx = p.x + dx * 2.1;
    let ty = p.y + 0.95;
    let tz = p.z + dz * 2.1;
    const sp = Math.hypot(p.vx, p.vz);
    let distK = 1 + clamp((sp - 6) / 14, 0, 0.3);
    const free = sim.boxes.find((b) => b.state === "free" || b.state === "stolen");
    if (free) {
      const fd = Math.hypot(free.x - p.x, free.z - p.z);
      const w = clamp(fd / 22, 0.2, 0.45);
      tx = lerp(tx, free.x, w);
      tz = lerp(tz, free.z, w);
      ty = lerp(ty, free.y, w * 0.5);
      distK += clamp(fd / 28, 0, 0.42);
    }
    if (p.stack.some((b) => b.kind === "big")) distK += 0.1;
    if (sim.state === "delivering" || sim.state === "won" || sim.state === "failing" || sim.state === "lost") {
      this.syncResultCamera(dt);
      return;
    }
    const k = Math.min(1, dt * 5.5);
    const kY = Math.min(1, dt * 3.6);
    if (!C.ready) {
      C.ready = true;
      C.tx = tx;
      C.ty = ty;
      C.tz = tz;
      C.dist = distK;
    }
    C.tx += (tx - C.tx) * k;
    C.tz += (tz - C.tz) * k;
    C.ty += (ty - C.ty) * kY;
    C.dist += (distK - C.dist) * Math.min(1, dt * 2.2);
    const back = (portrait ? 9.3 : 8) * C.dist;
    const up = (portrait ? 6.9 : 5.4) * C.dist;
    // 시작할 때 살짝 내려옴
    const intro = sim.state === "intro" ? 1 - clamp(sim.stateT / sim.introLen, 0, 1) : 0;
    const iK = intro * intro;
    cam.position.set(C.tx - dx * back * (1 + iK * 0.3), C.ty + up * (1 + iK * 0.6), C.tz - dz * back * (1 + iK * 0.3));
    if (this.shake > 0) {
      const s = this.shake;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 1.1);
    }
    cam.lookAt(C.tx, C.ty, C.tz);
    const fovW = (portrait ? 54 : 47) + clamp((sp - 7) / 8, 0, 1) * 7;
    C.fov += (fovW - C.fov) * Math.min(1, dt * 3);
    if (Math.abs(cam.fov - C.fov) > 0.01) {
      cam.fov = C.fov;
      cam.updateProjectionMatrix();
    }
    // 카메라가 입력 방향 기준 (화면 위 = 앞)
    this.camDirX = dx;
    this.camDirZ = dz;
    this.camRightX = -dz;
    this.camRightZ = dx;
  }
  /** 결과 화면: 펭귄 앞으로 돌아옴 */
  syncResultCamera(dt) {
    const sim = this.sim;
    const p = sim.p;
    const cam = this.stage.camera;
    const C = this.cam;
    const portrait = this.stage.h > this.stage.w * 1.05;
    if (C.resT === undefined) {
      C.resT = 0;
      C.a = C.yaw + Math.PI * 0.82;
      C.px = cam.position.x;
      C.py = cam.position.y;
      C.pz = cam.position.z;
      // 카메라 쪽을 바라보게
      C.face = Math.atan2(Math.sin(C.a), Math.cos(C.a));
    }
    C.resT += dt;
    p.face += ((C.face - p.face + Math.PI * 3) % TAU - Math.PI) * Math.min(1, dt * 5);
    C.a += dt * 0.12;
    const dist = portrait ? 5.6 : 4.6;
    const yUp = portrait ? 2.3 : 1.7;
    // 결과 카드가 아래를 덮으므로 펭귄을 화면 위쪽에 둠
    const lookY = p.y + (portrait ? -0.1 : 0.55);
    const tx = p.x + Math.sin(C.a) * dist;
    const tz = p.z - Math.cos(C.a) * dist;
    const ty = p.y + yUp;
    const k = Math.min(1, dt * 3);
    C.px += (tx - C.px) * k;
    C.py += (ty - C.py) * k;
    C.pz += (tz - C.pz) * k;
    cam.position.set(C.px, C.py, C.pz);
    C.lx = C.lx === undefined ? C.tx : lerp(C.lx, p.x, k);
    C.ly = C.ly === undefined ? C.ty : lerp(C.ly, lookY, k);
    C.lz = C.lz === undefined ? C.tz : lerp(C.lz, p.z, k);
    cam.lookAt(C.lx, C.ly, C.lz);
    if (Math.abs(cam.fov - 46) > 0.2) {
      cam.fov += (46 - cam.fov) * k;
      cam.updateProjectionMatrix();
    }
  }
  syncFx(dt, T) {
    const sim = this.sim;
    const p = sim.p;
    const stage = this.stage;
    const L = LOOK[this.course.world.key];
    this.fx.update(dt);
    this.glow.update(dt);
    const cam = stage.camera;
    const wind = sim.windNow;
    this.snow.update(dt, cam.position, L.snow + sim.fog * 0.9 + (wind.k ? 0.2 : 0), wind.x * wind.k * 1.3, wind.z * wind.k * 1.3);
    // 눈보라: 안개가 짙어짐
    const f = sim.fog;
    const fog = stage.scene.fog;
    fog.near = lerp(stage.baseFog.near, 3, f);
    fog.far = lerp(stage.baseFog.far, 24, f);
    if (this.world.sea) {
      const u = this.world.sea.userData.u;
      u.t.value = T;
      u.cam.value.copy(cam.position);
    }
    if (this.world.below) {
      const u = this.world.below.userData.u;
      u.t.value = T;
      u.cam.value.copy(cam.position);
    }
    // 굴뚝 연기
    this.smokeT -= dt;
    if (this.smokeT <= 0 && this.chimney) {
      this.smokeT = 0.22;
      const c = this.chimney;
      this.fx.add(c.x, c.y, c.z, 0.2 + Math.random() * 0.3, 1 + Math.random() * 0.4, 0.1, 0.5, 2.2, COL.white, -0.1, 0.6);
    }
    // 달릴 때 눈가루 · 얼음 긁힘
    const sp = Math.hypot(p.vx, p.vz);
    if (p.grounded && sp > 2 && p.mode !== "splash") {
      this.dustT -= dt * (0.6 + sp * 0.35);
      if (this.dustT <= 0) {
        this.dustT = p.slip > 0.3 || p.mode === "slide" ? 0.12 : 0.34;
        const col = p.surf === "ice" ? COL.ice : COL.white;
        const size = p.mode === "slide" ? 0.46 : p.slip > 0.3 ? 0.38 : 0.22;
        this.fx.add(p.x + (Math.random() - 0.5) * 0.4, p.y + 0.06, p.z + (Math.random() - 0.5) * 0.4, -p.vx * 0.1 + (Math.random() - 0.5), 0.6 + Math.random(), -p.vz * 0.1 + (Math.random() - 0.5), size, 0.42, col, 3, size);
      }
    }
    // 부스터 불꽃
    if (p.boost > 0 && Math.random() < 0.6) this.glow.add(p.x, p.y + 0.5, p.z, -p.vx * 0.2, 0.6, -p.vz * 0.2, 0.4, 0.4, COL.gold, 0);
    if (p.magnet > 0 && Math.random() < 0.2) this.glow.add(p.x + (Math.random() - 0.5) * 3, p.y + 0.5, p.z + (Math.random() - 0.5) * 3, 0, 0.6, 0, 0.2, 0.5, COL.red, 0);
    // 바람 줄무늬
    if (wind.k > 0 && (Math.abs(wind.x) + Math.abs(wind.z)) > 2) {
      this.windT -= dt;
      if (this.windT <= 0) {
        this.windT = 0.03;
        const R = 12;
        this.fx.add(p.x - wind.x * 1.4 + (Math.random() - 0.5) * R, p.y + 0.5 + Math.random() * 3, p.z - wind.z * 1.4 + (Math.random() - 0.5) * R, wind.x * 2.4, 0, wind.z * 2.4, 0.2, 0.55, COL.white, 0);
      }
    }
  }
}

/** 첫 화면 · 월드 선택 · 꾸미기에서 쓰는 작은 무대 */
export class Showcase {
  constructor(stage, penguin) {
    this.stage = stage;
    this.penguin = penguin;
    this.root = null;
    this.wi = -1;
    this.t = 0;
    this.mode = "title";
    this.spin = 0;
  }
  setWorld(wi) {
    if (this.wi === wi && this.root) return;
    this.clear();
    this.wi = wi;
    const w = WORLDS[wi];
    const b = new Builder(w);
    const road = { w: 11, bank: false, surf: wi === 2 || wi === 4 ? "ice" : "snow" };
    b.c.h = -0.55;
    b.road(10, road);
    b.road(16, { ...road, turn: 40 });
    b.road(14, { ...road, turn: 30 });
    b.goal = { x: 0, y: 0, z: 0, r: 2, h: 0, s: 0, i: 0 };
    const course = b.finish({ name: "show", packs: [], worldIndex: wi, stageIndex: 3, par: 1, limit: 1 });
    this.course = course;
    const stage = this.stage;
    stage.setLook(w.key);
    this.root = new THREE.Group();
    stage.scene.add(this.root);
    const W = buildCourseWorld(course, stage);
    this.world = W;
    this.root.add(W.group);
    const q = stage.quality;
    const mid = course.P[Math.floor(course.P.length * 0.5)];
    this.at = mid;
    this.root.add(this.penguin.group);
    this.penguin.group.position.set(mid.x, mid.y, mid.z);
    this.penguin.group.rotation.set(0, 0, 0);
    this.boxes = [];
    const kinds = ["normal", "big", "light", "express", "fragile"];
    [[-1.7, 0.36, 0.6, 0.72, 0], [1.75, 0.36, 0.4, 0.72, 2], [1.85, 0.42, -0.65, 0.84, 1]].forEach(([x, y, z, s, k]) => {
      const m = makeBox(kinds[k], s, q);
      m.position.set(mid.x + x, mid.y + y, mid.z + z);
      m.rotation.y = x * 0.6;
      this.root.add(m);
      this.boxes.push(m);
    });
    // 집 또는 월드 상징
    const house = makeHouse(w.key, q === "high" ? "mid" : q);
    house.position.set(mid.x + 3.4, mid.y, mid.z - 8.2);
    house.rotation.y = -0.34;
    this.root.add(house);
    const sm = makeSnowman(q);
    sm.position.set(mid.x - 5.4, mid.y, mid.z - 3.8);
    sm.rotation.y = 0.5;
    sm.scale.setScalar(1.1);
    this.root.add(sm);
    if (w.key === "canyon") {
      const pi = makePillar(0.9, 5.5, q);
      pi.position.set(mid.x - 5, mid.y, mid.z - 7);
      this.root.add(pi);
    } else if (w.key === "sea") {
      const se = makeSeal(q);
      se.position.set(mid.x - 3.8, mid.y, mid.z - 1.2);
      se.rotation.y = 0.8;
      this.root.add(se);
    } else if (w.key === "peaks") {
      const fx = makeFox(q);
      fx.position.set(mid.x - 3.2, mid.y, mid.z - 0.9);
      fx.rotation.y = 0.7;
      fx.scale.setScalar(1.2);
      this.root.add(fx);
    } else if (w.key === "aurora") {
      const star = makeItem("star", q);
      star.position.set(mid.x - 2.4, mid.y + 1.6, mid.z - 0.8);
      this.root.add(star);
      this.star = star;
    }
    this.fx = new Particles(120, THREE.NormalBlending);
    this.root.add(this.fx.points);
    this.snow = new SnowFall(stage.quality === "low" ? 160 : 500);
    this.root.add(this.snow.points);
    stage.setLook(w.key);
    this.stage.followShadow(mid.x, mid.y, mid.z);
  }
  clear() {
    if (!this.root) return;
    this.root.remove(this.penguin.group);
    this.stage.scene.remove(this.root);
    const seen = new Set();
    this.root.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry);
        o.geometry.dispose();
      }
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (!seen.has(m)) {
          seen.add(m);
          m.dispose();
        }
      }
    });
    this.root = null;
    this.wi = -1;
  }
  update(dt) {
    if (!this.root) return;
    this.t += dt;
    this.stage.time += dt;
    const T = this.t;
    const P = this.penguin;
    const mid = this.at;
    const cam = this.stage.camera;
    const portrait = this.stage.h > this.stage.w * 1.05;
    let a;
    let dist;
    let up;
    let ly;
    let fov;
    if (this.mode === "costume") {
      // 아래 판이 덮으므로 펭귄을 화면 위쪽에 둠
      this.spin += dt * 0.65;
      a = 0;
      const wide = this.stage.w > this.stage.h * 1.5 && this.stage.h < 560;
      dist = portrait ? 5.4 : wide ? 4.2 : 5;
      up = 1.05;
      ly = portrait ? -0.18 : wide ? 0.7 : 0.05;
      fov = 40;
      P.group.rotation.set(0, Math.sin(this.spin) * 0.8 + (this.dragRot || 0), 0);
    } else if (this.mode === "worlds") {
      a = Math.sin(T * 0.12) * 0.08;
      dist = portrait ? 11.5 : 9;
      up = portrait ? 3.3 : 2.3;
      ly = portrait ? -1 : 0.2;
      fov = portrait ? 46 : 38;
      P.group.rotation.set(0, Math.sin(T * 0.35) * 0.1 + 0.05, 0);
    } else {
      a = Math.sin(T * 0.12) * 0.08;
      dist = portrait ? 8.2 : 7;
      up = portrait ? 2.5 : 1.8;
      ly = portrait ? 1.35 : 1.12;
      fov = portrait ? 46 : 38;
      P.group.rotation.set(0, Math.sin(T * 0.35) * 0.1 + 0.05, 0);
    }
    const tx = mid.x + Math.sin(a) * dist;
    const tz = mid.z + Math.cos(a) * dist;
    const ty = mid.y + up;
    const k = Math.min(1, dt * 4);
    this.cx = this.cx === undefined ? tx : lerp(this.cx, tx, k);
    this.cy = this.cy === undefined ? ty : lerp(this.cy, ty, k);
    this.cz = this.cz === undefined ? tz : lerp(this.cz, tz, k);
    this.ly = this.ly === undefined ? ly : lerp(this.ly, ly, k);
    cam.position.set(this.cx, this.cy, this.cz);
    cam.lookAt(mid.x, mid.y + this.ly, mid.z);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = lerp(cam.fov, fov, k);
      cam.updateProjectionMatrix();
    }
    P.group.position.set(mid.x, mid.y, mid.z);
    // 대기 동작: 가끔 손을 흔듦
    this.waveT = (this.waveT === undefined ? 2.2 : this.waveT) - dt;
    if (this.waveT <= 0) {
      this.waveT = 5 + Math.random() * 4;
      P.trigger("wave", 1.6);
    }
    P.update(dt, { mode: "run", speed: 0, grounded: true, carrying: 0, vy: 0, slip: 0 });
    this.snow.update(dt, cam.position, LOOK[WORLDS[this.wi].key].snow * 0.8 + 0.1, 0.2, 0);
    if (this.fx) this.fx.update(dt);
    if (this.world.sea) {
      this.world.sea.userData.u.t.value = T;
      this.world.sea.userData.u.cam.value.copy(cam.position);
    }
    if (this.world.below) {
      this.world.below.userData.u.t.value = T;
      this.world.below.userData.u.cam.value.copy(cam.position);
    }
    if (this.star) this.star.rotation.y = T * 1.4;
    this.boxes.forEach((b, i) => {
      b.rotation.z = Math.sin(T * 1.6 + i) * 0.02;
    });
  }
}
