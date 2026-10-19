/*
 * 용암 서핑 · 장애물 · 수집물 (트랙 좌표에 놓고, 보이는 모양과 같은 크기로 판정)
 *
 *  spire    높은 기둥 (피해야 함)  — look: obsidian · redrock · bone · crystal · basalt · pipe
 *  rock     낮은 바위 (점프로 넘음) — look: rock · barrel · bone
 *  roll     굴러오는 큰 바위 (바닥에 붉은 줄 → 옆 절벽에서 굴러 길을 가로지름)
 *  fire     불기둥 (땅이 붉게 빛남 → 솟음)            crumble 무너지는 땅 · 다리 (금이 빛남 → 꺼짐)
 *  slider   좌우로 미끄러지는 것 — look: obsidian 벽 · boulder 큰 바위 · claw 발톱 · tail 꼬리(낮음) · fence 에너지 벽
 *  bomb     하늘 · 옆 · 앞에서 날아와 떨어지는 것 (바닥에 붉은 원 경고) — kind: rock · lava · fire · bolt(번개)
 *  erupt    분화구 분출: 경고 → 충격파 고리(점프로 넘음) + 바위 파편
 *  laser    낮은 레이저 빔 (켜졌다 꺼졌다 · 점프로 넘음)   gate 열리고 닫히는 문 (발판 스위치로 여는 문도)
 *  rotor    터널의 도는 날개 (빈틈으로 지나감)            sweeper 바닥을 쓸며 도는 낮은 팔 (점프)
 *  wheel    좌우로 굴러다니는 불꽃 톱니 바퀴              lavafall 위에서 쏟아지는 용암 커튼 (틈으로 지나감)
 *  bar      낮은 가로 막대 (점프)                        발판 (용암 위 바위 · 가라앉는 바위 · 오르내리는 바위)
 *  flames   불꽃 구역 (보스 불 뿜기 · 불꽃 벽)            돌풍 구역 (바람 줄기 · 바닥 화살표)
 *  boost    부스터 발판 · orb 에너지 구슬
 *  부딪힘은 ev 로 알린다 (game 이 넘어짐 · 점수 · 소리 처리). 멀리 있는 것은 그리지 않는다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { fbm3, shadeVerts, roundedBox, mergeByMaterial } from "./geo.js?v=2";
import { dotTex, chevronTex, slopeGlowTex, cliffTex, ringTex, lavaTex, stripeTex } from "./tex.js?v=2";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R_PLAYER = 0.45;
const VIEW_AHEAD = 260;
const VIEW_BEHIND = 40;
const cyc = (t, period, phase) => ((((t / period + phase) % 1) + 1) % 1) * period;

function lumpyRock(r, seed = 1, detail = 2) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (fbm3((x / r) * 1.3 + seed, (y / r) * 1.3, (z / r) * 1.3, 3) - 0.5) * 0.45;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}
/** 선분(ax,ay)-(bx,by) 와 점(px,py) 거리 */
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

export class Items {
  constructor(track, scene, items, course, fx) {
    this.T = track;
    this.scene = scene;
    this.fx = fx;
    this.course = course;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.t = 0;
    const chev = chevronTex().clone();
    chev.needsUpdate = true;
    const lavaFallMap = lavaTex().clone();
    lavaFallMap.needsUpdate = true;
    lavaFallMap.repeat.set(1, 2);
    this.ownTex = [chev, lavaFallMap];
    this.M = {
      obsidian: new THREE.MeshStandardMaterial({ color: "#2c2434", roughness: 0.15, metalness: 0.4, flatShading: true, vertexColors: true }),
      rock: new THREE.MeshStandardMaterial({ map: cliffTex(), roughness: 0.9, vertexColors: true }),
      redrock: new THREE.MeshStandardMaterial({ map: cliffTex(), color: "#e89070", roughness: 0.9, vertexColors: true }),
      boulder: new THREE.MeshStandardMaterial({ map: cliffTex(), emissiveMap: slopeGlowTex(), emissive: "#ffffff", emissiveIntensity: 1.2, roughness: 0.85 }),
      warn: new THREE.MeshBasicMaterial({ color: "#ff3a1a", transparent: true, opacity: 0, depthWrite: false }),
      fire: new THREE.MeshBasicMaterial({ color: "#ffb04a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      fireCore: new THREE.MeshBasicMaterial({ color: "#fff0b0", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      crack: new THREE.MeshStandardMaterial({ color: "#3a2a2e", roughness: 0.9, emissiveMap: slopeGlowTex(), emissive: "#ffffff", emissiveIntensity: 0.2, vertexColors: true }),
      chevron: new THREE.MeshBasicMaterial({ map: chev, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      orb: new THREE.MeshStandardMaterial({ color: "#ffe27a", emissive: "#ff9a2a", emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.3, flatShading: true }),
      big: new THREE.MeshStandardMaterial({ color: "#9af4ff", emissive: "#3ad0ff", emissiveIntensity: 2.0, roughness: 0.15, flatShading: true }),
      vent: new THREE.MeshStandardMaterial({ color: "#3a2e34", roughness: 0.9, vertexColors: true }),
      ring: new THREE.MeshBasicMaterial({ map: ringTex(), color: "#ff4a1a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      metal: new THREE.MeshStandardMaterial({ color: "#7a7680", roughness: 0.4, metalness: 0.8, vertexColors: true }),
      darkMetal: new THREE.MeshStandardMaterial({ color: "#3a3640", roughness: 0.5, metalness: 0.7, vertexColors: true }),
      stripe: new THREE.MeshStandardMaterial({ map: stripeTex(), roughness: 0.6, metalness: 0.3 }),
      bone: new THREE.MeshStandardMaterial({ color: "#eadfc8", roughness: 0.55, vertexColors: true }),
      crystal: new THREE.MeshStandardMaterial({ color: "#8aeaff", emissive: "#2aa8ff", emissiveIntensity: 1.1, roughness: 0.12, metalness: 0.2, flatShading: true }),
      basalt: new THREE.MeshStandardMaterial({ color: "#4a4652", roughness: 0.7, metalness: 0.1, flatShading: true, vertexColors: true }),
      laser: new THREE.MeshBasicMaterial({ color: "#ff2a4a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      laserCore: new THREE.MeshBasicMaterial({ color: "#ffe0e8", transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      energy: new THREE.MeshBasicMaterial({ color: "#5af0ff", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      green: new THREE.MeshBasicMaterial({ color: "#5aff7a" }),
      red: new THREE.MeshBasicMaterial({ color: "#ff3a3a" }),
      glowOrange: new THREE.MeshBasicMaterial({ color: "#ffb04a" }),
      lavaFall: new THREE.MeshBasicMaterial({ map: lavaFallMap, color: "#ffd0a0", transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false }),
      lavaBlob: new THREE.MeshBasicMaterial({ color: "#ffa040" }),
      padTop: new THREE.MeshStandardMaterial({ map: cliffTex(), color: "#8a7a80", roughness: 0.9, vertexColors: true, emissiveMap: slopeGlowTex(), emissive: "#ffffff", emissiveIntensity: 0.25 }),
      wind: new THREE.MeshBasicMaterial({ color: "#c8e8ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      bolt: new THREE.MeshBasicMaterial({ color: "#e0eaff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      wave: new THREE.MeshBasicMaterial({ color: "#ffb04a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    };
    this.G = {}; // 같이 쓰는 도형
    this.obs = items.obs.map((o) => ({ ...o }));
    this.orbs = items.orbs.map((o, i) => ({ ...o, i, taken: false }));
    this.boosts = items.boosts.map((b) => ({ ...b, used: 0 }));
    this.dyn = []; // 실행 중에 생기는 것 (보스 공격 · 분출 파편 · 충격파 · 불꽃)
    for (const o of this.obs) this.make(o);
    this.makeOrbs();
    for (const b of this.boosts) this.makeBoost(b);
    this.makePads();
    this.makeWinds();
  }
  /** (s,u) 바닥 높이 (없으면 중심선) */
  floor(s, u) {
    const y = this.T.surfaceY(s, u);
    return y == null ? this.T.frame(s, {}).y + this.T.rampAdd(s) : y;
  }
  place(obj, s, u, yOff = 0, face = true) {
    const f = this.T.frame(s, {});
    obj.position.set(f.x + f.rx * u, this.floor(s, u) + yOff, f.z + f.rz * u);
    if (face) obj.rotation.y = Math.atan2(f.tx, f.tz);
    return f;
  }
  /** 가로지르는 물건 놓기: 로컬 +x = 오른쪽(+u) · +z = 주인공 쪽(뒤) · 높이는 그 자리 바닥 */
  across(obj, s, u = 0, yOff = 0) {
    const f = this.T.frame(s, {});
    obj.position.set(f.x + f.rx * u, this.floor(s, u) + yOff, f.z + f.rz * u);
    obj.rotation.y = Math.atan2(f.tx, f.tz) + Math.PI;
    return f;
  }
  geo(key, make) {
    if (!this.G[key]) this.G[key] = make();
    return this.G[key];
  }

  /* ================================================================
   * 만들기
   * ============================================================== */
  make(o) {
    const fn = this["make_" + o.type];
    if (fn) fn.call(this, o);
  }
  make_spire(o) {
    const M = this.M;
    const look = o.look || "obsidian";
    const g = new THREE.Group();
    if (look === "obsidian" || look === "crystal") {
      const mat = look === "crystal" ? M.crystal : M.obsidian;
      const main = new THREE.CylinderGeometry(o.r * 0.55, o.r, o.h * 0.85, 6);
      main.translate(0, o.h * 0.425, 0);
      shadeVerts(main, { bottom: 0.5, top: 1.15 });
      const tip = new THREE.ConeGeometry(o.r * 0.55, o.h * 0.15, 6);
      tip.translate(0, o.h * 0.925, 0);
      shadeVerts(tip, { bottom: 0.9, top: 1.2 });
      g.add(new THREE.Mesh(main, mat), new THREE.Mesh(tip, mat));
      for (let i = 0; i < 3; i++) {
        const sh = new THREE.ConeGeometry(o.r * 0.3, o.h * 0.35, 5);
        sh.translate(0, o.h * 0.17, 0);
        shadeVerts(sh, { bottom: 0.5 });
        const m = new THREE.Mesh(sh, mat);
        const a = (i / 3) * TAU + o.s;
        m.position.set(Math.cos(a) * o.r * 0.9, 0, Math.sin(a) * o.r * 0.9);
        m.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
        g.add(m);
      }
      if (look === "crystal") {
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#5ad8ff", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
        gl.position.y = o.h * 0.5;
        gl.scale.setScalar(o.h * 0.9);
        g.add(gl);
      }
    } else if (look === "redrock") {
      const geo = new THREE.CylinderGeometry(o.r * 0.75, o.r * 1.05, o.h, 9, 6);
      geo.translate(0, o.h / 2, 0);
      const p = geo.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 1 + (fbm3(x * 1.2 + o.s, y * 0.9, z * 1.2, 3) - 0.5) * 0.4 + Math.sin(y * 2.4) * 0.05;
        p.setXYZ(i, x * k, y, z * k);
      }
      geo.computeVertexNormals();
      shadeVerts(geo, { bottom: 0.55, top: 1.1 });
      g.add(new THREE.Mesh(geo, M.redrock));
      const cap = new THREE.Mesh(shadeVerts(lumpyRock(o.r * 1.05, o.s, 1), { bottom: 0.7 }), M.redrock);
      cap.scale.set(1.15, 0.4, 1.15);
      cap.position.y = o.h;
      g.add(cap);
    } else if (look === "bone") {
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        pts.push(V(Math.sin(t * 1.4) * o.r * 0.9, t * o.h, 0));
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, o.r * 0.55, 8);
      const p = tube.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = 1 - (y / o.h) * 0.85;
        const cx = Math.sin((y / o.h) * 1.4) * o.r * 0.9;
        p.setX(i, cx + (p.getX(i) - cx) * k);
        p.setZ(i, p.getZ(i) * k);
      }
      tube.computeVertexNormals();
      shadeVerts(tube, { bottom: 0.6 });
      const m = new THREE.Mesh(tube, M.bone);
      m.rotation.y = o.u > 0 ? Math.PI : 0;
      g.add(m);
      const base = new THREE.Mesh(shadeVerts(lumpyRock(o.r * 0.9, o.s, 1), { bottom: 0.6 }), M.rock);
      base.scale.y = 0.45;
      g.add(base);
    } else if (look === "basalt") {
      const geo = new THREE.CylinderGeometry(0.42, 0.44, 1, 6);
      geo.translate(0, 0.5, 0);
      shadeVerts(geo, { bottom: 0.45, top: 1.15 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const m = new THREE.Mesh(geo, M.basalt);
        const rr = i ? o.r * 0.55 : 0;
        m.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
        m.scale.set(o.r * 1.1, o.h * (0.75 + ((i * 37) % 10) / 40), o.r * 1.1);
        g.add(m);
      }
    } else if (look === "pipe") {
      const geo = new THREE.CylinderGeometry(o.r * 0.7, o.r * 0.8, o.h, 14);
      geo.translate(0, o.h / 2, 0);
      shadeVerts(geo, { bottom: 0.5 });
      g.add(new THREE.Mesh(geo, M.metal));
      for (let k = 1; k <= 3; k++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(o.r * 0.78, 0.1, 6, 16), M.glowOrange);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = (o.h * k) / 4;
        g.add(ring);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.9, o.r * 0.9, 0.3, 14), M.stripe);
      cap.position.y = o.h;
      g.add(cap);
    }
    const mg = mergeByMaterial(g);
    mg.traverse((x) => x.isMesh && ((x.castShadow = true), (x.receiveShadow = true)));
    this.place(mg, o.s, o.u, -0.2);
    this.root.add(mg);
    o.g = mg;
  }
  make_rock(o) {
    const M = this.M;
    let m;
    if (o.look === "barrel") {
      const g = new THREE.Group();
      const geo = new THREE.CylinderGeometry(o.r * 0.8, o.r * 0.8, o.h, 14);
      geo.translate(0, o.h / 2, 0);
      shadeVerts(geo, { bottom: 0.55 });
      g.add(new THREE.Mesh(geo, M.metal));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.82, o.r * 0.82, o.h * 0.3, 14), M.stripe);
      band.position.y = o.h / 2;
      g.add(band);
      m = mergeByMaterial(g);
    } else {
      const geo = lumpyRock(o.r, o.s, 1);
      geo.scale(1, o.h / (o.r * 1.6), 1);
      geo.translate(0, o.h * 0.42, 0);
      shadeVerts(geo, { bottom: 0.55 });
      m = new THREE.Mesh(geo, o.look === "bone" ? M.bone : M.rock);
    }
    m.traverse((x) => x.isMesh && ((x.castShadow = true), (x.receiveShadow = true)));
    this.place(m, o.s, o.u, -0.05);
    this.root.add(m);
    o.g = m;
  }
  make_roll(o) {
    const T = this.T;
    const M = this.M;
    const hw = T.halfWidth(o.s);
    o.u0 = o.side * (hw + 5);
    o.u1 = -o.side * (hw + 6);
    const m = new THREE.Mesh(lumpyRock(o.r, o.s * 3, 2), M.boulder);
    m.castShadow = true;
    this.root.add(m);
    o.g = m;
    o.selfVis = true;
    // 바닥 경고: 바위가 지나갈 길 (붉은 줄 + 굴러갈 방향 화살표)
    const holder = new THREE.Group();
    this.across(holder, o.s, 0, 0.08);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 1, o.r * 2), M.warn.clone());
    strip.rotation.x = -Math.PI / 2;
    holder.add(strip);
    const arrows = new THREE.Mesh(new THREE.PlaneGeometry(o.r * 1.6, hw * 2), M.chevron.clone());
    arrows.material.map = M.chevron.map.clone();
    arrows.material.map.needsUpdate = true;
    this.ownTex.push(arrows.material.map);
    arrows.material.map.repeat.set(1, hw / 2);
    arrows.material.opacity = 0;
    arrows.rotation.set(-Math.PI / 2, 0, o.side * (Math.PI / 2));
    arrows.position.y = 0.01;
    holder.add(arrows);
    this.root.add(holder);
    o.strip = strip;
    o.arrows = arrows;
    o.state = "idle";
  }
  make_fire(o) {
    const M = this.M;
    const g = new THREE.Group();
    const H = o.big ? 8 : 5;
    const d = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      const r = new THREE.Mesh(shadeVerts(lumpyRock(0.32, i + o.s, 0), { bottom: 0.5 }), M.vent);
      r.position.set(Math.cos(a) * o.r * 0.95, 0.1, Math.sin(a) * o.r * 0.95);
      d.add(r);
    }
    g.add(mergeByMaterial(d));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(o.r * 1.15, 32), M.ring.clone());
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.06;
    g.add(disc);
    const col = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.5, o.r * 0.95, H, 18, 1, true).translate(0, H / 2, 0), M.fire.clone());
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.2, o.r * 0.5, H * 0.8, 14, 1, true).translate(0, H * 0.4, 0), M.fireCore.clone());
    col.add(outer, inner);
    col.visible = false;
    g.add(col);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.y = 1.5;
    gl.scale.setScalar(7);
    g.add(gl);
    this.place(g, o.s, o.u, 0);
    this.root.add(g);
    Object.assign(o, { g, disc, col, outer, inner, gl, state: "off", H });
  }
  make_crumble(o) {
    const M = this.M;
    const g = new THREE.Group();
    const pieces = [];
    const ns = Math.max(1, Math.round((o.s1 - o.s0) / 3));
    const nu = Math.max(1, Math.round((o.u1 - o.u0) / 3.2));
    for (let i = 0; i < ns; i++)
      for (let k = 0; k < nu; k++) {
        const s = o.s0 + ((o.s1 - o.s0) * (i + 0.5)) / ns;
        const u = o.u0 + ((o.u1 - o.u0) * (k + 0.5)) / nu;
        const geo = shadeVerts(roundedBox(((o.u1 - o.u0) / nu) * 0.96, 0.35, ((o.s1 - o.s0) / ns) * 0.96, 0.05), { bottom: 0.5 });
        const m = new THREE.Mesh(geo, M.crack);
        m.castShadow = m.receiveShadow = true;
        this.place(m, s, u, -0.15);
        m.userData.home = m.position.clone();
        m.userData.rot = m.rotation.clone();
        m.userData.v = 0;
        m.userData.spin = V((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
        g.add(m);
        pieces.push(m);
      }
    this.root.add(g);
    Object.assign(o, { g, pieces, state: "solid", mat: M.crack.clone() });
    for (const m of pieces) m.material = o.mat;
  }
  make_slider(o) {
    const M = this.M;
    const look = o.look || "obsidian";
    let m;
    if (look === "boulder") {
      o.w = o.h;
      m = new THREE.Group();
      const b = new THREE.Mesh(lumpyRock(o.h / 2, o.s, 2), M.boulder);
      b.position.y = o.h / 2;
      b.castShadow = true;
      m.add(b);
      o.spinner = b;
    } else if (look === "claw") {
      m = new THREE.Group();
      const g = new THREE.Group();
      for (let k = -1; k <= 1; k++) {
        const pts = [];
        for (let j = 0; j <= 8; j++) {
          const t = j / 8;
          pts.push(V(k * 0.7, o.h * (1 - t) * 0.95 + 0.1, -Math.sin(t * 1.6) * 1.4));
        }
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.32, 7);
        const p = tube.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i);
          const kk = 0.25 + (y / o.h) * 0.9;
          const cx = k * 0.7;
          p.setX(i, cx + (p.getX(i) - cx) * kk);
        }
        tube.computeVertexNormals();
        shadeVerts(tube, { bottom: 0.7 });
        g.add(new THREE.Mesh(tube, M.bone));
      }
      const palm = new THREE.Mesh(shadeVerts(roundedBox(2.4, 1.2, 1.4, 0.4), { bottom: 0.6 }), M.obsidian);
      palm.position.y = o.h + 0.3;
      g.add(palm);
      const arm = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.7, 0.9, 8, 10), { bottom: 0.6 }), M.obsidian);
      arm.position.y = o.h + 4.4;
      g.add(arm);
      const mg = mergeByMaterial(g);
      mg.traverse((x) => x.isMesh && (x.castShadow = true));
      m.add(mg);
      o.w = 2.4;
    } else if (look === "tail") {
      o.w = o.w || 2.2;
      m = new THREE.Group();
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const t = j / 10;
        pts.push(V(0, o.h * 0.5, (t - 0.5) * o.w * 2.4));
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, o.h * 0.5, 9);
      shadeVerts(tube, { bottom: 0.6 });
      const tm = new THREE.Mesh(tube, M.obsidian);
      tm.castShadow = true;
      m.add(tm);
      for (let j = 0; j < 6; j++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 5), M.bone);
        sp.position.set(0, o.h + 0.2, (j / 5 - 0.5) * o.w * 2);
        m.add(sp);
      }
      o.d = o.w * 2.4;
    } else if (look === "fence") {
      o.w = o.w || 2.4;
      m = new THREE.Group();
      for (const y of [0.1, o.h]) {
        const bar = new THREE.Mesh(roundedBox(o.w, 0.2, 0.3, 0.06), M.darkMetal);
        bar.position.y = y;
        m.add(bar);
      }
      for (const x of [-o.w / 2, o.w / 2]) {
        const post = new THREE.Mesh(roundedBox(0.25, o.h, 0.3, 0.06), M.metal);
        post.position.set(x, o.h / 2, 0);
        m.add(post);
      }
      const film = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h - 0.2), M.energy);
      film.position.y = o.h / 2 + 0.05;
      m.add(film);
    } else {
      o.w = o.w || 2.6;
      const geo = shadeVerts(roundedBox(o.w, o.h, 1.2, 0.12), { bottom: 0.5, top: 1.1 });
      geo.translate(0, o.h / 2, 0);
      m = new THREE.Mesh(geo, M.obsidian);
      m.castShadow = true;
    }
    this.root.add(m);
    // 레일 (어디로 움직이는지 보이게)
    const hw = this.T.halfWidth(o.s);
    const lo = Math.max(-hw, Math.min(o.u0, o.u1));
    const hi = Math.min(hw, Math.max(o.u0, o.u1));
    const fence = look === "fence";
    const rail = new THREE.Mesh(roundedBox(Math.max(0.5, hi - lo + o.w), 0.08, 0.3, 0.03), new THREE.MeshStandardMaterial({ color: fence ? "#5ad8ff" : "#c8a05a", metalness: 0.8, roughness: 0.3, emissive: fence ? "#2a90c0" : "#000000" }));
    this.place(rail, o.s, (lo + hi) / 2, 0.04);
    this.root.add(rail);
    o.rail = rail;
    o.g = m;
    o.d = o.d || (look === "claw" ? 1.6 : look === "boulder" ? o.h * 0.8 : 1.2);
  }
  /* ---------- 날아와 떨어지는 것 ---------- */
  make_bomb(o) {
    const M = this.M;
    const kind = o.kind || "rock";
    let body;
    if (kind === "bolt") {
      body = new THREE.Mesh(new THREE.BufferGeometry(), M.bolt.clone());
      body.frustumCulled = false;
    } else if (kind === "rock") {
      body = new THREE.Mesh(this.geo("bombRock", () => lumpyRock(0.75, 7, 1)), M.boulder);
      body.castShadow = true;
    } else {
      body = new THREE.Group();
      const core = new THREE.Mesh(this.geo("bombBall", () => new THREE.IcosahedronGeometry(0.6, 2)), kind === "fire" ? M.fireCore : M.lavaBlob);
      body.add(core);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: kind === "fire" ? "#ff8a2a" : "#ff5a1a", transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.scale.setScalar(kind === "fire" ? 3.4 : 2.4);
      body.add(gl);
    }
    body.visible = false;
    this.root.add(body);
    const mark = new THREE.Mesh(this.geo("markRing", () => new THREE.CircleGeometry(1, 32)), M.ring.clone());
    mark.rotation.x = -Math.PI / 2;
    mark.visible = false;
    this.root.add(mark);
    Object.assign(o, { body, mark, state: "idle", selfVis: true, g: null });
  }
  /* ---------- 분화구 분출 ---------- */
  make_erupt(o) {
    const M = this.M;
    const g = new THREE.Group();
    const d = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const r = new THREE.Mesh(shadeVerts(lumpyRock(0.55, i + o.s, 0), { bottom: 0.5 }), M.vent);
      r.position.set(Math.cos(a) * 1.9, 0.2, Math.sin(a) * 1.9);
      r.scale.y = 0.8 + (i % 3) * 0.25;
      d.add(r);
    }
    g.add(mergeByMaterial(d));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32), M.ring.clone());
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.08;
    g.add(disc);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.8, 12, 16, 1, true).translate(0, 6, 0), M.fire.clone());
    col.visible = false;
    g.add(col);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.y = 2;
    gl.scale.setScalar(10);
    g.add(gl);
    this.place(g, o.s, o.u, 0);
    this.root.add(g);
    Object.assign(o, { g, disc, col, gl, state: "off", baseY: g.position.y });
  }
  /* ---------- 레이저 ---------- */
  make_laser(o) {
    const M = this.M;
    const hw = this.T.halfWidth(o.s);
    o.u0 = o.u0 ?? -hw - 0.3;
    o.u1 = o.u1 ?? hw + 0.3;
    const g = new THREE.Group();
    this.across(g, o.s, 0, 0);
    for (const u of [o.u0 - 0.35, o.u1 + 0.35]) {
      const post = new THREE.Mesh(shadeVerts(roundedBox(0.5, o.h + 0.9, 0.5, 0.08), { bottom: 0.6 }), M.darkMetal);
      post.position.set(u, (o.h + 0.9) / 2 - 0.1, 0);
      post.castShadow = true;
      g.add(post);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.laser);
      eye.position.set(u - Math.sign(u) * 0.27, o.h, 0);
      g.add(eye);
      const band = new THREE.Mesh(roundedBox(0.52, 0.18, 0.52, 0.04), M.stripe);
      band.position.set(u, o.h + 0.5, 0);
      g.add(band);
    }
    const L = o.u1 - o.u0;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, L, 8), M.laser.clone());
    beam.rotation.z = Math.PI / 2;
    beam.position.set((o.u0 + o.u1) / 2, o.h, 0);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, L, 6), M.laserCore.clone());
    core.rotation.z = Math.PI / 2;
    core.position.copy(beam.position);
    g.add(beam, core);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff3a5a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.copy(beam.position);
    gl.scale.set(L * 1.1, 1.4, 1);
    g.add(gl);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.5), M.warn.clone());
    strip.rotation.x = -Math.PI / 2;
    strip.position.set((o.u0 + o.u1) / 2, 0.06, 0);
    g.add(strip);
    this.root.add(g);
    Object.assign(o, { g, beam, core, gl, strip, state: "off" });
  }
  /* ---------- 문 ---------- */
  make_gate(o) {
    const M = this.M;
    const hw = this.T.halfWidth(o.s);
    const g = new THREE.Group();
    this.across(g, o.s, 0, 0);
    const H = 4.2;
    const wall = (a, b) => {
      if (b - a < 0.05) return;
      const w = new THREE.Mesh(shadeVerts(roundedBox(b - a, H, 0.7, 0.08), { bottom: 0.55 }), M.darkMetal);
      w.position.set((a + b) / 2, H / 2, 0);
      w.castShadow = true;
      g.add(w);
      const st = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 0.5), M.stripe);
      st.position.set((a + b) / 2, H - 0.4, 0.36);
      g.add(st);
    };
    wall(-hw - 1.2, o.u0);
    wall(o.u1, hw + 1.2);
    const top = new THREE.Mesh(shadeVerts(roundedBox(o.u1 - o.u0 + 0.4, 0.6, 0.8, 0.08), { bottom: 0.6 }), M.metal);
    top.position.set((o.u0 + o.u1) / 2, H + 0.3, 0);
    g.add(top);
    const door = new THREE.Group();
    const panel = new THREE.Mesh(roundedBox(o.u1 - o.u0 - 0.1, H - 0.1, 0.35, 0.06), M.stripe);
    panel.position.y = (H - 0.1) / 2;
    door.add(panel);
    door.position.set((o.u0 + o.u1) / 2, 0, 0);
    g.add(door);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), M.red.clone());
    lamp.position.set((o.u0 + o.u1) / 2, H + 0.85, 0.2);
    g.add(lamp);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff3a3a", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.copy(lamp.position);
    gl.scale.setScalar(2.2);
    g.add(gl);
    this.root.add(g);
    if (o.sw) {
      const sg = new THREE.Group();
      this.across(sg, o.sw.s, o.sw.u, 0.02);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.18, 20), M.darkMetal);
      base.position.y = 0.09;
      sg.add(base);
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.2, 20), M.green.clone());
      btn.position.y = 0.24;
      sg.add(btn);
      const sgl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#5aff7a", transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      sgl.position.y = 0.6;
      sgl.scale.setScalar(3.6);
      sg.add(sgl);
      this.root.add(sg);
      o.swg = sg;
      o.btn = btn;
    }
    Object.assign(o, { g, door, lamp, lampGl: gl, H, openK: 0, state: "closed", pressed: false });
  }
  /* ---------- 터널의 도는 날개 (부채꼴 날개가 길 단면을 쓸고 지나감 · 빈틈으로 통과) ---------- */
  make_rotor(o) {
    const M = this.M;
    const hw = this.T.halfWidth(o.s);
    const g = new THREE.Group();
    this.across(g, o.s, 0, 0);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, hw * 2 + 2.4, 12), M.darkMetal);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, o.cy, -0.5);
    g.add(axle);
    const rot = new THREE.Group();
    rot.position.y = o.cy;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.7, 18), M.metal);
    hub.rotation.x = Math.PI / 2;
    rot.add(hub);
    const bladeMat = new THREE.MeshStandardMaterial({ color: "#3a2e38", roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide, emissive: "#3a0a04", emissiveIntensity: 0.6 });
    for (let k = 0; k < o.arms; k++) {
      const c = (k / o.arms) * TAU;
      const blade = new THREE.Mesh(new THREE.CircleGeometry(o.L, 14, c - o.blade / 2, o.blade), bladeMat);
      rot.add(blade);
      const edge = new THREE.Mesh(new THREE.RingGeometry(o.L - 0.3, o.L, 14, 1, c - o.blade / 2, o.blade), M.fireCore);
      edge.position.z = 0.02;
      rot.add(edge);
    }
    g.add(rot);
    // 바닥 홈 (날개가 바닥 아래로 지나가는 곳)
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 0.6, 0.9), new THREE.MeshBasicMaterial({ color: "#ff6a2a", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    slot.rotation.x = -Math.PI / 2;
    slot.position.y = 0.05;
    g.add(slot);
    this.root.add(g);
    Object.assign(o, { g, rot, bladeMat });
  }
  /* ---------- 바닥을 쓰는 낮은 팔 ---------- */
  make_sweeper(o) {
    const M = this.M;
    const g = new THREE.Group();
    this.place(g, o.s, o.u, 0, false);
    const post = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.45, 0.6, 1.3, 10), { bottom: 0.5 }), M.darkMetal);
    post.position.y = 0.65;
    g.add(post);
    const rot = new THREE.Group();
    rot.position.y = o.h - 0.21;
    const bar = new THREE.Mesh(shadeVerts(roundedBox(o.L, 0.42, 0.42, 0.1), { bottom: 0.6 }), M.boulder);
    bar.position.x = o.L / 2;
    bar.castShadow = true;
    rot.add(bar);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), M.fireCore);
    tip.position.x = o.L;
    rot.add(tip);
    g.add(rot);
    const disc = new THREE.Mesh(new THREE.RingGeometry(o.L - 0.35, o.L + 0.1, 40), M.warn.clone());
    disc.material.opacity = 0.18;
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.05;
    g.add(disc);
    this.root.add(g);
    Object.assign(o, { g, rot });
  }
  /* ---------- 불꽃 톱니 바퀴 ---------- */
  make_wheel(o) {
    const M = this.M;
    const g = new THREE.Group();
    const w = new THREE.Group();
    w.position.y = o.R;
    w.add(new THREE.Mesh(new THREE.TorusGeometry(o.R * 0.85, 0.2, 8, 28), M.darkMetal));
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), M.metal);
      tooth.position.set(Math.cos(a) * o.R, Math.sin(a) * o.R, 0);
      tooth.rotation.z = a - Math.PI / 2;
      w.add(tooth);
    }
    for (let k = 0; k < 4; k++) {
      const sp = new THREE.Mesh(roundedBox(o.R * 1.7, 0.16, 0.16, 0.04), M.darkMetal);
      sp.rotation.z = (k / 4) * Math.PI;
      w.add(sp);
    }
    w.add(new THREE.Mesh(new THREE.TorusGeometry(o.R * 0.9, 0.35, 8, 28), M.fire));
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff7a2a", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.scale.setScalar(o.R * 4.5);
    w.add(gl);
    g.add(w);
    this.root.add(g);
    const hw = this.T.halfWidth(o.s);
    const lo = Math.max(-hw, Math.min(o.u0, o.u1));
    const hi = Math.min(hw, Math.max(o.u0, o.u1));
    const rail = new THREE.Mesh(roundedBox(hi - lo + 1, 0.08, 0.3, 0.03), new THREE.MeshStandardMaterial({ color: "#ff8a3a", emissive: "#a03a10", metalness: 0.6, roughness: 0.4 }));
    this.place(rail, o.s, (lo + hi) / 2, 0.04);
    this.root.add(rail);
    o.rail = rail;
    Object.assign(o, { g, wheel: w });
  }
  /* ---------- 위에서 쏟아지는 용암 커튼 ---------- */
  make_lavafall(o) {
    const M = this.M;
    const g = new THREE.Group();
    this.across(g, o.s, 0, 0);
    const W = o.u1 - o.u0;
    const H = 13;
    const cx = (o.u0 + o.u1) / 2;
    const lip = new THREE.Mesh(shadeVerts(lumpyRock(1, o.s, 1), { bottom: 0.45 }), M.rock);
    lip.scale.set(W * 0.75 + 1.5, 1.2, 2.4);
    lip.position.set(cx, H + 0.6, 0);
    g.add(lip);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(W, H, 1, 1), M.lavaFall);
    fall.position.set(cx, H / 2, 0);
    g.add(fall);
    const fall2 = fall.clone();
    fall2.position.z = 0.35;
    fall2.scale.x = 0.92;
    g.add(fall2);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff7a2a", transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.set(cx, 0.8, 0);
    gl.scale.set(W * 1.6, 3, 1);
    g.add(gl);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.8, 1.6), new THREE.MeshBasicMaterial({ color: "#ff8a3a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(cx, 0.05, 0);
    g.add(pool);
    this.root.add(g);
    Object.assign(o, { g, fall, fall2, gl, pool, state: "on" });
  }
  /* ---------- 낮은 가로 막대 ---------- */
  make_bar(o) {
    const M = this.M;
    const g = new THREE.Group();
    this.across(g, o.s, 0, 0);
    const W = o.u1 - o.u0;
    const cx = (o.u0 + o.u1) / 2;
    const r = Math.min(0.35, o.h * 0.45);
    if (o.look === "bone") {
      const bar = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(r, r, W, 10), { bottom: 0.6 }), M.bone);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(cx, o.h - r, 0);
      g.add(bar);
      for (const k of [-1, 1]) {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(r * 1.6, 10, 8), M.bone);
        knob.position.set(cx + (k * W) / 2, o.h - r, 0);
        g.add(knob);
      }
    } else if (o.look === "log") {
      const bar = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(r, r * 1.1, W, 10), { bottom: 0.6 }), M.boulder);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(cx, o.h - r, 0);
      g.add(bar);
    } else {
      const bar = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(r, r, W, 14), { bottom: 0.6 }), M.metal);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(cx, o.h - r, 0);
      g.add(bar);
      for (let k = 0; k <= Math.floor(W / 2.5); k++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.04, 0.06, 6, 14), M.glowOrange);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(o.u0 + 0.6 + k * 2.5, o.h - r, 0);
        g.add(ring);
      }
      for (const u of [o.u0, o.u1]) {
        const leg = new THREE.Mesh(roundedBox(0.3, o.h, 0.3, 0.05), M.darkMetal);
        leg.position.set(u, o.h / 2, 0);
        g.add(leg);
      }
    }
    g.traverse((x) => x.isMesh && (x.castShadow = true));
    this.root.add(g);
    o.g = g;
  }

  /* ---------- 발판 (용암 위 바위 · 가라앉는 · 오르내리는) ---------- */
  makePads() {
    const M = this.M;
    for (const p of this.T.pads) {
      const g = new THREE.Group();
      const top = lumpyRock(1, p.s * 0.37, 2);
      // 윗면은 평평하게 (밟는 높이 = 판정 높이)
      const pp = top.getAttribute("position");
      for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0.15) pp.setY(i, 0.15 + (pp.getY(i) - 0.15) * 0.05);
      top.computeVertexNormals();
      shadeVerts(top, { bottom: 0.4, top: 1 });
      const m = new THREE.Mesh(top, p.look === "metal" ? M.metal : M.padTop);
      // 바닥이 용암에 잠기도록 깊이에 맞춰 늘림 (윗면 = 판정 높이)
      const sy = (Math.max(0, p.h0) + (this.T.def.lavaDepth || 9) + 0.8) / 1.15;
      m.scale.set(p.r * 1.02, sy, p.l * 1.02);
      m.position.y = -0.15 * sy;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      if (p.lift) {
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffb04a", transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
        gl.position.y = -2.4;
        gl.scale.setScalar(p.r * 3);
        g.add(gl);
      }
      if (p.sink) {
        const mn = Math.min(p.r, p.l);
        const ring = new THREE.Mesh(new THREE.RingGeometry(mn * 0.55, mn * 0.7, 28), M.warn.clone());
        ring.material.opacity = 0;
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        ring.scale.set(p.r / mn, p.l / mn, 1);
        g.add(ring);
        p.ring = ring;
      }
      const f = this.T.frame(p.s, {});
      g.position.set(f.x + f.rx * p.u, f.y + p.h, f.z + f.rz * p.u);
      g.rotation.y = Math.atan2(f.tx, f.tz);
      this.root.add(g);
      p.g = g;
      p.baseY = f.y;
      p.state = "solid";
      p.st = 0;
    }
  }
  /* ---------- 돌풍 구역: 공중 바람 줄기 + 바닥 화살표 ---------- */
  makeWinds() {
    this.windVis = [];
    for (const w of this.T.winds) {
      const g = new THREE.Group();
      const streaks = [];
      const mat = this.M.wind.clone();
      const geo = this.geo("streak", () => new THREE.PlaneGeometry(3.2, 0.08));
      for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.userData = { k: Math.random(), s: w.s0 + Math.random() * (w.s1 - w.s0), h: 0.5 + Math.random() * 4.5 };
        g.add(m);
        streaks.push(m);
      }
      const arrows = [];
      for (let s = w.s0 + 6; s < w.s1; s += 18) {
        const hw = this.T.halfWidth(s);
        const a = new THREE.Mesh(new THREE.PlaneGeometry(2, hw * 1.4), this.M.chevron.clone());
        a.material.color.set("#9ad8ff");
        a.material.opacity = 0;
        const holder = new THREE.Group();
        this.across(holder, s, 0, 0.07);
        a.rotation.set(-Math.PI / 2, 0, Math.sign(w.force) * (-Math.PI / 2));
        holder.add(a);
        this.root.add(holder);
        arrows.push(a);
      }
      this.root.add(g);
      this.windVis.push({ w, g, streaks, mat, arrows });
    }
  }
  makeOrbs() {
    const n = this.orbs.length;
    const geo = new THREE.OctahedronGeometry(0.32, 0);
    this.orbMesh = new THREE.InstancedMesh(geo, this.M.orb, Math.max(1, n));
    this.orbMesh.frustumCulled = false;
    this.root.add(this.orbMesh);
    for (const o of this.orbs) {
      o.p = new THREE.Vector3();
      const f = this.T.frame(o.s, {});
      const fy = o.air ? f.y + this.T.rampAdd(o.s) : this.floor(o.s, o.u);
      o.p.set(f.x + f.rx * o.u, fy + o.h, f.z + f.rz * o.u);
      if (o.big) {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 1), this.M.big);
        m.position.copy(o.p);
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#7af4ff", transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
        gl.scale.setScalar(3);
        m.add(gl);
        this.root.add(m);
        o.g = m;
      }
    }
    if (!n) this.orbMesh.count = 0;
    this.syncOrbs(0, 0);
  }
  syncOrbs(t, ps) {
    const o3 = this._o3 || (this._o3 = new THREE.Object3D());
    this.orbs.forEach((o, i) => {
      const near = o.s - ps > -20 && o.s - ps < VIEW_AHEAD;
      o3.position.copy(o.p);
      o3.position.y += Math.sin(t * 3 + i) * 0.12;
      o3.rotation.set(0, t * 2 + i, 0.3);
      o3.scale.setScalar(o.taken || o.big || !near ? 0 : 1);
      o3.updateMatrix();
      this.orbMesh.setMatrixAt(i, o3.matrix);
      if (o.g) {
        o.g.visible = !o.taken && near;
        o.g.rotation.y = t * 1.5;
        o.g.position.y = o.p.y + Math.sin(t * 2) * 0.2;
      }
    });
    this.orbMesh.instanceMatrix.needsUpdate = true;
  }
  makeBoost(b) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.l), this.M.chevron);
    m.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group();
    this.place(holder, b.s, b.u, 0.06);
    holder.add(m);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffb04a", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.y = 0.4;
    gl.scale.set(b.w * 1.6, 1.2, 1);
    holder.add(gl);
    this.root.add(holder);
    b.g = holder;
  }

  /* ================================================================
   * 실행 중에 생기는 것 (보스 공격 · 분출 파편 · 충격파 · 불꽃)
   * ============================================================== */
  /** 떨어지는 것 하나 바로 날리기: {s,u,r,kind,from,flight,origin} */
  spawnBomb(opt) {
    const kind = opt.kind || "rock";
    let o = this.dyn.find((d) => d.type === "bomb" && d.state === "done" && d.kind === kind);
    if (!o) {
      o = { type: "bomb", kind, dynamic: true };
      this.make_bomb(o);
      this.dyn.push(o);
    }
    Object.assign(o, { r: 1.8, from: "sky", flight: 1.2, origin: null, side: 0, ...opt, kind, trigger: 0 });
    this.launchBomb(o);
    return o;
  }
  /** 퍼지는 충격파 고리 (점프로 넘음): {s,u,speed,max,h} */
  spawnRing(opt) {
    let o = this.dyn.find((d) => d.type === "ringwave" && d.state === "done");
    if (!o) {
      o = { type: "ringwave", dynamic: true };
      const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64), this.M.wave.clone());
      m.rotation.x = -Math.PI / 2;
      m.frustumCulled = false;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 64, 1, true), this.M.wave.clone());
      wall.frustumCulled = false;
      this.root.add(m, wall);
      Object.assign(o, { m, wall });
      this.dyn.push(o);
    }
    Object.assign(o, { speed: 14, max: 22, h: 0.75, ...opt, R: 0.5, state: "on", hitDone: false });
    const f = this.T.frame(o.s, {});
    o.cx = f.x + f.rx * o.u;
    o.cz = f.z + f.rz * o.u;
    o.cy = this.floor(o.s, o.u) + 0.12;
    o.m.visible = o.wall.visible = true;
    return o;
  }
  /** 길을 가로질러 다가오는 충격파 줄 (점프로 넘음): {s, dir(-1 주인공 쪽), speed, h, life} */
  spawnWave(opt) {
    let o = this.dyn.find((d) => d.type === "linewave" && d.state === "done");
    if (!o) {
      o = { type: "linewave", dynamic: true };
      const g = new THREE.Group();
      const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1), this.M.wave.clone());
      ridge.rotation.z = Math.PI / 2;
      g.add(ridge);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff8a2a", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(gl);
      this.root.add(g);
      Object.assign(o, { g, ridge, gl });
      this.dyn.push(o);
    }
    Object.assign(o, { dir: -1, speed: 16, h: 0.75, life: 5, ...opt, t0: this.t, state: "on", hitDone: false });
    o.sw = o.s;
    o.g.visible = true;
    return o;
  }
  /** 불꽃 구역 (보스 불 뿜기 · 불꽃 벽): s0~s1 × u0~u1 를 h 높이까지 태움 — 낮으면 점프로 넘고, 높으면 피해야 함 */
  spawnFlames(opt) {
    let o = this.dyn.find((d) => d.type === "flames" && d.state === "done");
    if (!o) {
      o = { type: "flames", dynamic: true, cones: [] };
      const g = new THREE.Group();
      const geo = this.geo("flameCone", () => new THREE.ConeGeometry(0.55, 1, 8, 1, true).translate(0, 0.5, 0));
      for (let i = 0; i < 48; i++) {
        const m = new THREE.Mesh(geo, i % 3 ? this.M.fire : this.M.fireCore);
        m.visible = false;
        g.add(m);
        o.cones.push(m);
      }
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(gl);
      o.gl = gl;
      this.root.add(g);
      o.g = g;
      this.dyn.push(o);
    }
    Object.assign(o, { h: 3, life: 2, grow: 0.35, ...opt, t: 0, state: "on" });
    o.g.visible = true;
    // 구역 안에 불꽃 원뿔을 고르게 (최대 48개)
    const ls = Math.max(0.5, o.s1 - o.s0);
    const lu = Math.max(0.5, o.u1 - o.u0);
    const ns = Math.max(1, Math.min(12, Math.round(ls / 1.8)));
    const nu = Math.max(1, Math.min(Math.floor(48 / ns), Math.round(lu / 1.4)));
    let k = 0;
    const f = {};
    for (let i = 0; i < ns; i++)
      for (let j = 0; j < nu; j++) {
        const m = o.cones[k++];
        const s = o.s0 + (ls * (i + 0.5)) / ns;
        const u = o.u0 + (lu * (j + 0.5)) / nu;
        this.T.frame(s, f);
        m.position.set(f.x + f.rx * u, this.floor(s, u), f.z + f.rz * u);
        m.userData.ph = Math.random() * 6;
        m.userData.w = 0.8 + Math.random() * 0.5;
        m.visible = true;
      }
    for (; k < o.cones.length; k++) o.cones[k].visible = false;
    const sm = (o.s0 + o.s1) / 2;
    const um = (o.u0 + o.u1) / 2;
    this.T.frame(sm, f);
    o.gl.position.set(f.x + f.rx * um, this.floor(sm, um) + o.h * 0.4, f.z + f.rz * um);
    o.gl.scale.set(Math.max(ls, lu) * 1.4, o.h * 1.6, 1);
    return o;
  }
  upd_flames(o, ahead, { P, playing, ev, t, dt }) {
    o.t += dt;
    const grow = Math.min(1, o.t / o.grow);
    const fade = Math.max(0, Math.min(1, (o.life - o.t) / 0.3));
    const k = grow * fade;
    for (const m of o.cones) {
      if (!m.visible) continue;
      const fl = 1 + Math.sin(t * 22 + m.userData.ph) * 0.15;
      m.scale.set(m.userData.w * (0.6 + k * 0.4), Math.max(0.01, o.h * k * fl), m.userData.w * (0.6 + k * 0.4));
    }
    o.gl.material.opacity = 0.7 * k;
    if (playing && grow > 0.6 && fade > 0.2 && P.s > o.s0 - 0.4 && P.s < o.s1 + 0.4 && P.u > o.u0 - 0.35 && P.u < o.u1 + 0.35 && P.y < this.floor(P.s, P.u) + o.h * k * 0.92) this.hit(o, P, ev, true);
    if (o.t >= o.life) {
      o.state = "done";
      o.g.visible = false;
    }
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  update(dt, P, playing) {
    this.t += dt;
    const t = this.t;
    const ev = [];
    const ps = P.s;
    const pu = P.u;
    this.lastP = P;
    this.M.chevron.map.offset.y -= dt * 1.5;
    this.M.lavaFall.map.offset.y += dt * 1.6;
    const ctx = { ev, ps, pu, P, playing, t, dt };
    for (const o of this.obs) {
      const ahead = (o.s0 ?? o.s) - ps;
      if (!o.selfVis && o.g) {
        const vis = ahead > -VIEW_BEHIND && ahead < (o.type === "crumble" ? 150 : VIEW_AHEAD);
        o.g.visible = vis;
        if (o.rail) o.rail.visible = vis;
        if (o.swg) o.swg.visible = vis;
        // 아주 먼 것은 움직임 계산도 건너뜀 (시간으로 도는 것은 상태만 계속)
        if (!vis && !(o.type === "fire" || o.type === "gate" || o.type === "laser" || o.type === "lavafall" || o.type === "erupt")) continue;
      }
      const fn = this["upd_" + o.type];
      if (fn) fn.call(this, o, ahead, ctx);
    }
    for (const o of this.dyn) {
      if (o.state === "done") continue;
      const fn = this["upd_" + o.type];
      if (fn) fn.call(this, o, (o.s ?? ps) - ps, ctx);
    }
    this.updPads(ctx);
    this.updWinds(ctx);
    // 부스터 발판
    if (playing && P.onGround)
      for (const b of this.boosts) {
        if (Math.abs(b.s - ps) < b.l / 2 && Math.abs(b.u - pu) < b.w / 2 && t - b.used > 1) {
          b.used = t;
          ev.push({ type: "pad", b });
        }
      }
    // 구슬
    if (playing) {
      const f = this.T.frame(ps, this._pf || (this._pf = {}));
      const px = f.x + f.rx * pu;
      const pz = f.z + f.rz * pu;
      for (const o of this.orbs) {
        if (o.taken || Math.abs(o.s - ps) > 1.6) continue;
        if ((o.p.x - px) ** 2 + (o.p.y - (P.y + 0.7)) ** 2 + (o.p.z - pz) ** 2 < (o.big ? 2.2 : 1.5) ** 2) {
          o.taken = true;
          ev.push({ type: "orb", orb: o });
        }
      }
    }
    this.syncOrbs(t, ps);
    return ev;
  }
  upd_spire(o, ahead, { P, pu, playing, ev }) {
    if (!playing || Math.abs(ahead) > o.r + 1) return;
    const base = this.floor(o.s, o.u);
    if (Math.hypot(ahead, o.u - pu) < o.r + R_PLAYER && P.y < base + o.h) this.hit(o, P, ev);
  }
  upd_rock(o, ahead, { P, pu, playing, ev }) {
    if (!playing || Math.abs(ahead) > o.r + 1) return;
    const base = this.floor(o.s, o.u);
    if (Math.hypot(ahead, o.u - pu) < o.r + R_PLAYER && P.y < base + o.h * 0.9) this.hit(o, P, ev);
  }
  upd_roll(o, ahead, { P, pu, playing, ev, t, dt }) {
    const T = this.T;
    if (o.state === "idle" && ahead < o.trigger + 28 && ahead > 0) {
      o.state = "warn";
      ev.push({ type: "rumble", s: o.s });
    }
    if (o.state === "warn" && ahead < o.trigger) {
      o.state = "roll";
      o.ru = o.u0;
      ev.push({ type: "rollStart", s: o.s });
    }
    const near = ahead > -VIEW_BEHIND && ahead < VIEW_AHEAD;
    const showWarn = o.state === "warn" || o.state === "roll";
    o.strip.material.opacity = showWarn ? 0.22 + Math.sin(t * 10) * 0.08 : 0;
    o.arrows.material.opacity = showWarn ? 0.7 : 0;
    if (o.state === "roll") {
      o.ru += -o.side * o.speed * dt;
      if ((o.side > 0 && o.ru < o.u1) || (o.side < 0 && o.ru > o.u1)) o.state = "gone";
      const hw = T.halfWidth(o.s);
      const onTrack = Math.abs(o.ru) < hw + 0.5;
      const fl = onTrack ? this.floor(o.s, o.ru) : T.lavaY(o.s) + o.r;
      const f = T.frame(o.s, {});
      o.g.position.set(f.x + f.rx * o.ru, fl + o.r * 0.85, f.z + f.rz * o.ru);
      o.g.rotation.z += (o.side * o.speed * dt) / o.r;
      o.g.visible = near;
      if (playing && Math.hypot(ahead, o.ru - pu) < o.r + R_PLAYER && P.y < fl + o.r * 1.7) this.hit(o, P, ev);
      if (near && Math.random() < dt * 20) this.fx && this.fx.dust(o.g.position.x, fl, o.g.position.z, 1.2);
    } else if (o.state === "idle" || o.state === "warn") {
      const f = T.frame(o.s, {});
      const fl = this.floor(o.s, Math.sign(o.u0) * (T.halfWidth(o.s) - 0.2)) + 1.6;
      o.g.position.set(f.x + f.rx * o.u0 + (o.state === "warn" ? Math.sin(t * 40) * 0.08 : 0), fl + o.r * 0.6, f.z + f.rz * o.u0);
      o.g.visible = near;
    } else o.g.visible = false;
  }
  upd_fire(o, ahead, { P, pu, playing, ev, t, dt }) {
    const k = cyc(t, o.period, o.phase);
    const offT = o.period - o.warn - o.on;
    let st = "off";
    if (k > offT && k < offT + o.warn) st = "warn";
    else if (k >= offT + o.warn) st = "on";
    const wk = st === "warn" ? (k - offT) / o.warn : st === "on" ? 1 : 0;
    if (o.g.visible) {
      o.disc.material.opacity = st === "off" ? 0.05 : 0.25 + wk * 0.55 + Math.sin(t * 25) * 0.05;
      o.gl.material.opacity = st === "on" ? 0.8 : wk * 0.4;
      o.col.visible = st === "on";
      if (st === "on") {
        const e = Math.min(1, (k - offT - o.warn) / 0.15);
        o.col.scale.set(1 + Math.sin(t * 30) * 0.06, e, 1 + Math.cos(t * 27) * 0.06);
        o.outer.material.opacity = 0.75 + Math.sin(t * 40) * 0.1;
        if (Math.random() < dt * 30) this.fx && this.fx.ember(o.g.position.x, o.g.position.y + 1, o.g.position.z, 3);
      }
    }
    if (st !== o.state) {
      if (st === "warn" && Math.abs(ahead) < 60) ev.push({ type: "fireWarn", s: o.s });
      if (st === "on" && Math.abs(ahead) < 60) ev.push({ type: "fireOn", s: o.s });
      o.state = st;
    }
    if (playing && st === "on" && Math.abs(ahead) < o.r + 0.6 && Math.hypot(ahead, o.u - pu) < o.r + 0.35 && P.y < this.floor(o.s, o.u) + o.H - 0.5) this.hit(o, P, ev, true);
  }
  upd_crumble(o, ahead, { ev, t, dt, ps }) {
    const T = this.T;
    const pre = o.s0 - ps;
    if (o.state === "solid" && pre < (o.trigger || 34) && pre > -5) {
      o.state = "crack";
      o.ct = 0;
      ev.push({ type: "crack", s: o.s0 });
    }
    if (o.state === "crack") {
      o.ct += dt;
      const kk = o.delay != null ? o.ct / o.delay : 1 - Math.max(0, pre - 13) / 21;
      o.mat.emissiveIntensity = 0.4 + Math.min(1, Math.max(o.ct, kk)) * 1.6 + Math.sin(t * 20) * 0.2;
      const sh = o.delay != null ? 0.02 + Math.min(1, kk) * 0.06 : 0.03;
      for (const m of o.pieces) m.position.x = m.userData.home.x + Math.sin(t * 50 + m.id) * sh;
      if (o.delay != null ? o.ct >= o.delay : pre < 13) {
        o.state = "fall";
        T.holes.push((o.hole = { s0: o.s0, s1: o.s1, u0: o.u0, u1: o.u1 }));
        ev.push({ type: "collapse", s: o.s0 });
      }
    } else if (o.state === "fall") {
      for (const m of o.pieces) {
        m.userData.v += 18 * dt;
        m.position.y -= m.userData.v * dt;
        m.rotation.x += m.userData.spin.x * dt;
        m.rotation.z += m.userData.spin.z * dt;
      }
    }
  }
  sliderU(o, t) {
    const k = 0.5 - 0.5 * Math.cos((TAU * t) / o.period + (o.phase || 0) * TAU);
    return o.u0 + (o.u1 - o.u0) * k;
  }
  upd_slider(o, ahead, { P, pu, playing, ev, t }) {
    const u = this.sliderU(o, t);
    const prev = o.cu ?? u;
    o.cu = u;
    const fl = this.floor(o.s, u);
    this.place(o.g, o.s, u, -0.02);
    if (o.spinner) o.spinner.rotation.z -= (u - prev) / (o.h / 2);
    if (o.look === "claw") o.g.rotation.z = Math.sin((TAU * t) / o.period) * 0.12;
    if (playing && Math.abs(ahead) < o.d / 2 + R_PLAYER && Math.abs(u - pu) < o.w / 2 + R_PLAYER && P.y < fl + o.h) this.hit(o, P, ev);
  }
  /* ---------- 떨어지는 것 ---------- */
  launchBomb(o) {
    const T = this.T;
    const f = T.frame(o.s, {});
    const tx = f.x + f.rx * o.u;
    const tz = f.z + f.rz * o.u;
    const ty = this.floor(o.s, o.u);
    o.target = V(tx, ty, tz);
    if (o.from === "side") {
      const side = o.side || (o.u >= 0 ? 1 : -1);
      const hw = T.halfWidth(o.s);
      o.start = V(f.x + f.rx * side * (hw + 16), ty + 4, f.z + f.rz * side * (hw + 16));
      o.apex = 9;
    } else if (o.from === "front") {
      const g = T.frame(o.s + 55, {});
      o.start = V(g.x + g.rx * o.u * 0.5, (T.surfaceY(o.s + 55, 0) ?? g.y) + 10, g.z + g.rz * o.u * 0.5);
      o.apex = 3;
    } else if (o.origin) {
      o.start = o.origin.clone();
      o.apex = 6;
    } else {
      o.start = V(tx - f.tx * 10, ty + 34, tz - f.tz * 10);
      o.apex = 0;
    }
    o.state = "fly";
    o.ft = 0;
    o.mark.visible = true;
    o.mark.position.set(tx, ty + 0.07, tz);
    o.mark.scale.setScalar(o.r * 1.15);
    o.mark.material.opacity = 0;
    o.body.visible = o.kind !== "bolt";
    if (o.kind === "bolt") this.boltGeo(o);
  }
  boltGeo(o) {
    const P = [];
    const I = [];
    let x = 0;
    let z = 0;
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const y = 40 * (1 - i / n);
      const w = 0.5 - (i / n) * 0.25;
      P.push(o.target.x + x - w, o.target.y + y, o.target.z + z, o.target.x + x + w, o.target.y + y, o.target.z + z);
      if (i) I.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
      x += (Math.random() - 0.5) * 3;
      z += (Math.random() - 0.5) * 3;
      if (i === n - 1) {
        x *= 0.3;
        z *= 0.3;
      }
    }
    const g = o.body.geometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(I);
    g.computeBoundingSphere();
  }
  upd_bomb(o, ahead, { P, pu, playing, ev, t, dt }) {
    if (o.state === "idle") {
      if (playing && !o.dynamic && ahead < o.trigger && ahead > 4) {
        this.launchBomb(o);
        ev.push({ type: "bombWarn", kind: o.kind, s: o.s });
      }
      return;
    }
    if (o.state === "fly") {
      o.ft += dt;
      const k = Math.min(1, o.ft / o.flight);
      o.mark.material.opacity = 0.25 + k * 0.6 + Math.sin(t * 22) * 0.1 * k;
      o.mark.scale.setScalar(o.r * (1.6 - k * 0.45));
      if (o.kind === "bolt") {
        o.body.visible = k > 0.85;
        o.body.material.opacity = k > 0.85 ? 0.5 : 0;
      } else {
        const p = o.body.position;
        p.lerpVectors(o.start, o.target, k);
        p.y += Math.sin(k * Math.PI) * o.apex + (o.kind === "rock" ? 0.75 : 0.6);
        o.body.rotation.x += dt * 4;
        o.body.rotation.z += dt * 3;
        if (Math.random() < dt * 30 && this.fx) (o.kind === "rock" ? this.fx.dust(p.x, p.y, p.z, 0.6) : this.fx.ember(p.x, p.y, p.z, 1));
      }
      if (k >= 1) {
        o.state = "impact";
        o.it = 0;
        ev.push({ type: "bombHit", kind: o.kind, s: o.s, near: Math.abs(o.s - P.s) < 50 });
        const q = o.target;
        if (this.fx) {
          if (o.kind === "rock") {
            this.fx.debris(q.x, q.y + 0.5, q.z, 5);
            this.fx.land(q.x, q.y, q.z, 1);
          } else if (o.kind === "bolt") this.fx.burst(q.x, q.y + 0.5, q.z, 30, ["#e0eaff", "#9ad0ff", "#ffffff"]);
          else this.fx.splash(q.x, q.y + 0.3, q.z);
        }
        if (o.kind === "bolt") o.body.material.opacity = 1;
      }
    }
    if (o.state === "impact") {
      o.it += dt;
      // 떨어진 자리 잠깐 위험 (불 · 바위 조각)
      const live = o.it < (o.kind === "bolt" ? 0.25 : 0.45);
      if (playing && live && Math.hypot(o.s - P.s, o.u - pu) < o.r + R_PLAYER && P.y < o.target.y + 1.8) this.hit(o, P, ev, o.kind !== "rock", o.kind === "bolt" ? "zap" : null);
      o.mark.material.opacity = Math.max(0, 0.8 - o.it * 1.6);
      if (o.kind === "bolt") o.body.material.opacity = Math.max(0, 1 - o.it * 4);
      else {
        o.body.position.y = o.target.y + 0.3 - o.it * 1.2;
        o.body.scale.setScalar(Math.max(0.01, 1 - o.it * 1.2));
      }
      if (o.it > 0.9) {
        o.state = o.dynamic ? "done" : "spent";
        o.body.visible = false;
        o.body.scale.setScalar(1);
        o.mark.visible = false;
      }
    }
  }
  /* ---------- 분출 ---------- */
  upd_erupt(o, ahead, { P, pu, playing, ev, t, ps }) {
    const k = cyc(t, o.period, o.phase);
    const offT = o.period - o.warn - 0.8;
    let st = "off";
    if (k > offT && k < offT + o.warn) st = "warn";
    else if (k >= offT + o.warn) st = "on";
    const wk = st === "warn" ? (k - offT) / o.warn : st === "on" ? 1 : 0;
    const near = ahead > -30 && ahead < 140;
    if (o.g.visible) {
      o.disc.material.opacity = st === "off" ? 0.08 : 0.3 + wk * 0.6 + Math.sin(t * 30) * 0.08;
      o.gl.material.opacity = st === "on" ? 0.9 : wk * 0.5;
      o.col.visible = st === "on";
      if (st === "on") {
        const e = Math.min(1, (k - offT - o.warn) / 0.12);
        o.col.scale.set(1 + Math.sin(t * 30) * 0.08, Math.max(0.01, e * (1 - Math.max(0, (k - offT - o.warn - 0.5) / 0.3))), 1);
      }
      o.g.position.y = o.baseY + (st === "warn" ? Math.sin(t * 60) * 0.05 : 0);
    }
    if (st !== o.state) {
      if (st === "warn" && near) ev.push({ type: "eruptWarn", s: o.s });
      if (st === "on" && near && playing) {
        ev.push({ type: "erupt", s: o.s });
        if (o.ring) this.spawnRing({ s: o.s, u: o.u, speed: 13, max: o.ring, h: 0.8 });
        const hw = this.T.halfWidth(o.s);
        for (let i = 0; i < o.debris; i++) {
          const s = Math.max(o.s + 4, ps + 16 + Math.random() * 22);
          const u = (Math.random() * 2 - 1) * (hw - 1.5);
          this.spawnBomb({ s, u, r: 1.6, kind: "rock", origin: o.g.position.clone().setY(o.g.position.y + 4), flight: 1.0 + Math.random() * 0.4 });
        }
        this.fx && this.fx.burst(o.g.position.x, o.g.position.y + 2, o.g.position.z, 40);
      }
      o.state = st;
    }
    if (playing && st === "on" && Math.hypot(ahead, o.u - pu) < 2.0 + R_PLAYER && P.y < this.floor(o.s, o.u) + 8) this.hit(o, P, ev, true);
  }
  upd_ringwave(o, ahead, { P, playing, ev, dt }) {
    o.R += o.speed * dt;
    const k = o.R / o.max;
    o.m.position.set(o.cx, o.cy, o.cz);
    o.m.scale.setScalar(o.R);
    o.m.material.opacity = 0.85 * (1 - k * 0.6);
    o.wall.position.set(o.cx, o.cy + o.h / 2, o.cz);
    o.wall.scale.set(o.R, o.h, o.R);
    o.wall.material.opacity = 0.35 * (1 - k);
    if (playing && !o.hitDone) {
      const d = Math.hypot(P.s - o.s, P.u - o.u);
      if (Math.abs(d - o.R) < 0.6 && P.y < this.floor(P.s, P.u) + o.h) {
        o.hitDone = true;
        this.hit(o, P, ev);
      }
    }
    if (o.R >= o.max) {
      o.state = "done";
      o.m.visible = o.wall.visible = false;
    }
  }
  upd_linewave(o, ahead, { P, playing, ev, dt }) {
    o.sw += o.dir * o.speed * dt;
    const T = this.T;
    const f = T.frame(o.sw, {});
    const hw = T.halfWidth(o.sw) + 0.5;
    o.g.position.set(f.x, this.floor(o.sw, 0) + o.h * 0.4, f.z);
    o.g.rotation.y = Math.atan2(f.tx, f.tz) + Math.PI;
    o.ridge.scale.set(o.h * 0.9, hw * 2, o.h * 0.9);
    o.gl.scale.set(hw * 2.4, 2, 1);
    if (Math.random() < dt * 40 && this.fx) {
      const u = (Math.random() * 2 - 1) * hw;
      this.fx.ember(f.x + f.rx * u, this.floor(o.sw, u) + 0.3, f.z + f.rz * u, 1);
    }
    if (playing && !o.hitDone && Math.abs(P.s - o.sw) < 0.7 && P.y < this.floor(P.s, P.u) + o.h) {
      o.hitDone = true;
      this.hit(o, P, ev);
    }
    if (this.t - o.t0 > o.life || (o.dir < 0 && o.sw < P.s - 30)) {
      o.state = "done";
      o.g.visible = false;
    }
  }
  /* ---------- 레이저 ---------- */
  upd_laser(o, ahead, { P, pu, playing, ev, t }) {
    const k = cyc(t, o.period, o.phase);
    const offT = o.period - o.warn - o.on;
    let st = "off";
    if (k > offT && k < offT + o.warn) st = "warn";
    else if (k >= offT + o.warn) st = "on";
    if (o.g.visible) {
      o.beam.visible = st !== "off";
      o.core.visible = st === "on";
      o.beam.material.opacity = st === "warn" ? (Math.sin(t * 40) > 0 ? 0.35 : 0.1) : 0.9;
      o.beam.scale.set(st === "on" ? 1.6 : 0.5, 1, st === "on" ? 1.6 : 0.5);
      o.gl.material.opacity = st === "on" ? 0.55 : st === "warn" ? 0.12 : 0;
      o.strip.material.opacity = st === "off" ? 0.06 : st === "warn" ? 0.25 : 0.4;
    }
    if (st !== o.state) {
      if (st === "on" && Math.abs(ahead) < 50) ev.push({ type: "laserOn", s: o.s });
      o.state = st;
    }
    if (playing && st === "on" && Math.abs(ahead) < 0.45 && pu > o.u0 - 0.3 && pu < o.u1 + 0.3 && P.y < this.floor(o.s, pu) + o.h + 0.3) this.hit(o, P, ev, false, "zap");
  }
  /* ---------- 문 ---------- */
  upd_gate(o, ahead, { P, pu, playing, ev, t, dt }) {
    let open;
    if (o.sw) {
      if (!o.pressed && playing && Math.abs(P.s - o.sw.s) < 1.3 && Math.abs(pu - o.sw.u) < 1.3 && P.onGround) {
        o.pressed = true;
        ev.push({ type: "switch", s: o.s });
        if (o.btn) o.btn.position.y = 0.12;
      }
      open = o.pressed;
    } else {
      open = cyc(t, o.period, o.phase) < o.period * o.open;
    }
    const prevK = o.openK;
    o.openK += clamp((open ? 1 : 0) - o.openK, -dt * 2.8, dt * 2.8);
    if (prevK < 0.5 && o.openK >= 0.5 && Math.abs(ahead) < 60) ev.push({ type: "gateOpen", s: o.s });
    if (prevK >= 0.5 && o.openK < 0.5 && Math.abs(ahead) < 60) ev.push({ type: "gateClose", s: o.s });
    if (o.g.visible) {
      o.door.position.y = o.openK * (o.H - 0.6);
      const green = o.openK > 0.85;
      o.lamp.material.color.set(green ? "#5aff7a" : o.openK > 0.05 ? "#ffd23a" : "#ff3a3a");
      o.lampGl.material.color.set(green ? "#5aff7a" : "#ff3a3a");
    }
    if (playing && Math.abs(ahead) < 0.6 + R_PLAYER) {
      const inDoor = pu > o.u0 + 0.25 && pu < o.u1 - 0.25;
      const doorBottom = o.openK * (o.H - 0.6);
      const y = P.y - this.floor(o.s, pu);
      if (!inDoor || doorBottom < y + 1.4) this.hit(o, P, ev);
    }
  }
  /* ---------- 터널 날개 ---------- */
  rotorAngle(o, t) {
    return o.phase * TAU + t * o.speed;
  }
  /** 날개가 (u, 바닥 위 높이 h) 를 막고 있나 */
  rotorBlocks(o, a, u, h) {
    const dx = u;
    const dy = h - o.cy;
    const r = Math.hypot(dx, dy);
    if (r > o.L + 0.25) return false;
    const th = Math.atan2(dy, dx);
    const pad = Math.asin(Math.min(1, 0.5 / Math.max(0.6, r)));
    for (let k = 0; k < o.arms; k++) {
      let d = th - (a + (k / o.arms) * TAU);
      d = ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      if (Math.abs(d) < o.blade / 2 + pad) return true;
    }
    return false;
  }
  upd_rotor(o, ahead, { P, pu, playing, ev, t }) {
    const a = this.rotorAngle(o, t);
    o.rot.rotation.z = a;
    if (!playing || Math.abs(ahead) > 0.7) return;
    const h = P.y - this.floor(o.s, 0);
    if (this.rotorBlocks(o, a, pu, h + 0.5) || this.rotorBlocks(o, a, pu, h + 1.3)) this.hit(o, P, ev);
  }
  sweeperArm(o, t) {
    const a = o.phase * TAU + t * o.speed;
    const f = this.T.frame(o.s, this._sf || (this._sf = {}));
    const yaw = Math.atan2(f.tx, f.tz) + a;
    const wx = Math.cos(yaw);
    const wz = -Math.sin(yaw);
    return { a, ds: wx * f.tx + wz * f.tz, du: wx * f.rx + wz * f.rz };
  }
  upd_sweeper(o, ahead, { P, pu, playing, ev, t }) {
    const A = this.sweeperArm(o, t);
    o.rot.rotation.y = A.a;
    if (!playing || Math.abs(ahead) > o.L + 1) return;
    const y = P.y - this.floor(o.s, o.u);
    if (Math.hypot(ahead, pu - o.u) < 0.6 + R_PLAYER && y < 1.2) return this.hit(o, P, ev);
    if (y > o.h + 0.25) return;
    if (segDist(-ahead, pu - o.u, 0, 0, A.ds * o.L, A.du * o.L) < 0.25 + R_PLAYER) this.hit(o, P, ev);
  }
  wheelU(o, t) {
    const k = 0.5 - 0.5 * Math.cos((TAU * t) / o.period + o.phase * TAU);
    return o.u0 + (o.u1 - o.u0) * k;
  }
  upd_wheel(o, ahead, { P, pu, playing, ev, t, dt }) {
    const u = this.wheelU(o, t);
    const prev = o.cu ?? u;
    o.cu = u;
    this.across(o.g, o.s, u, 0);
    o.wheel.rotation.z += (u - prev) / o.R + dt * 2;
    if (playing && Math.abs(ahead) < 0.35 + R_PLAYER && Math.abs(u - pu) < o.R * 0.9 + R_PLAYER * 0.5 && P.y < this.floor(o.s, u) + o.R * 2) this.hit(o, P, ev, true);
  }
  lavafallState(o, t) {
    if (!o.period) return { st: "on", wk: 1 };
    const k = cyc(t, o.period, o.phase);
    const offT = o.period - o.warn - o.on;
    const st = k < offT ? "off" : k < offT + o.warn ? "warn" : "on";
    return { st, wk: st === "warn" ? (k - offT) / o.warn : st === "on" ? 1 : 0 };
  }
  upd_lavafall(o, ahead, { P, pu, playing, ev, t }) {
    const { st, wk } = this.lavafallState(o, t);
    if (o.g.visible) {
      const thin = st === "off" ? 0.06 : st === "warn" ? 0.12 + wk * 0.15 : 1;
      o.fall.scale.x = thin;
      o.fall2.scale.x = thin * 0.92;
      o.gl.material.opacity = st === "on" ? 0.8 : 0.15 + wk * 0.4;
      o.pool.material.opacity = st === "on" ? 0.85 : 0.3 + wk * 0.3;
    }
    if (st !== o.state) {
      if (st === "on" && Math.abs(ahead) < 60) ev.push({ type: "fallOn", s: o.s });
      o.state = st;
    }
    if (playing && st === "on" && Math.abs(ahead) < 0.9 && pu > o.u0 - 0.35 && pu < o.u1 + 0.35 && P.y < this.floor(o.s, pu) + 6) this.hit(o, P, ev, true);
  }
  upd_bar(o, ahead, { P, pu, playing, ev }) {
    if (!playing || Math.abs(ahead) > 0.6) return;
    if (pu > o.u0 - 0.3 && pu < o.u1 + 0.3 && P.y < this.floor(o.s, pu) + o.h) this.hit(o, P, ev);
  }
  /* ---------- 발판 ---------- */
  updPads({ P, playing, ev, t, dt }) {
    const T = this.T;
    const onPad = P.onGround ? T.padAt(P.s, P.u) : null;
    for (const p of T.pads) {
      const near = p.s - P.s > -VIEW_BEHIND && p.s - P.s < VIEW_AHEAD;
      p.g.visible = near;
      if (p.lift) {
        const L = p.lift;
        p.h = p.h0 + Math.sin((TAU * t) / L.period + (L.phase || 0) * TAU) * L.amp;
      }
      if (p.sink) {
        if (p.state === "solid" && playing && onPad === p) {
          p.state = "sink";
          p.st = 0;
          ev.push({ type: "sinkStart", s: p.s });
        }
        if (p.state === "sink") {
          p.st += dt;
          if (p.st > 0.35) p.h -= dt * 1.4;
          if (p.ring) p.ring.material.opacity = 0.5 + Math.sin(t * 20) * 0.3;
          if (near && Math.random() < dt * 25 && this.fx) this.fx.ember(p.g.position.x + (Math.random() - 0.5) * p.r, T.lavaY(p.s) + 0.5, p.g.position.z + (Math.random() - 0.5) * p.l, 1);
          if (p.h < -14) p.state = "gone";
        }
        if (p.ring && p.state === "solid") p.ring.material.opacity = 0.18;
      }
      if (near) p.g.position.y = p.baseY + p.h;
    }
  }
  updWinds({ P, t }) {
    const T = this.T;
    for (const W of this.windVis) {
      const w = W.w;
      const inf = T.windInfo(w);
      const near = P.s > w.s0 - 80 && P.s < w.s1 + 20;
      W.g.visible = near;
      W.mat.opacity = inf.on ? 0.55 : inf.warn * 0.25;
      for (const a of W.arrows) {
        a.material.opacity = inf.on ? 0.55 : inf.warn > 0 ? (Math.sin(t * 18) > 0 ? 0.45 : 0.1) : 0.08;
        a.material.map.offset.y -= 0.03;
      }
      if (!near) continue;
      const dir = Math.sign(w.force);
      const f = this._wf || (this._wf = {});
      for (const m of W.streaks) {
        const d = m.userData;
        d.k = (d.k + 0.02 * (inf.on ? 1.6 : 0.4)) % 1;
        const hw = T.halfWidth(d.s) + 4;
        const u = -dir * hw + dir * d.k * hw * 2;
        T.frame(d.s, f);
        m.position.set(f.x + f.rx * u, (T.surfaceY(d.s, 0) ?? f.y) + d.h, f.z + f.rz * u);
        m.rotation.y = Math.atan2(f.rx, f.rz) + Math.PI / 2;
      }
    }
  }
  hit(o, P, ev, fire = false, kind = null) {
    if (P.invulnerable) return;
    const away = Math.sign(P.u - (o.cu ?? o.ru ?? o.u ?? 0)) || 1;
    if (P.crash()) {
      P.vu = away * 5;
      ev.push({ type: "hit", o, fire, kind: kind || o.type });
    }
  }
  /** 다시 시작: fromS 뒤의 장애물만 처음 상태로 (무너진 땅 복구 · 굴러간 바위 · 떨어진 것 · 가라앉은 발판) */
  reset(fromS = -1e9) {
    const T = this.T;
    for (const o of this.obs) {
      if (o.type === "roll" && o.s > fromS) {
        o.state = "idle";
        o.strip.material.opacity = 0;
        o.arrows.material.opacity = 0;
      }
      if (o.type === "crumble" && o.s0 > fromS) {
        if (o.hole) T.holes.splice(T.holes.indexOf(o.hole), 1);
        o.hole = null;
        o.state = "solid";
        o.mat.emissiveIntensity = 0.2;
        for (const m of o.pieces) {
          m.position.copy(m.userData.home);
          m.rotation.copy(m.userData.rot);
          m.userData.v = 0;
        }
      }
      if (o.type === "bomb" && o.s > fromS) {
        o.state = "idle";
        o.body.visible = false;
        o.body.scale.setScalar(1);
        o.mark.visible = false;
      }
      if (o.type === "gate" && o.s > fromS && o.sw) {
        o.pressed = false;
        o.openK = 0;
        if (o.btn) o.btn.position.y = 0.24;
      }
    }
    for (const p of T.pads) {
      if (p.s > fromS && p.sink) {
        p.state = "solid";
        p.h = p.h0;
        p.st = 0;
      }
    }
    this.clearDynamic();
  }
  clearDynamic() {
    for (const o of this.dyn) {
      o.state = "done";
      if (o.body) o.body.visible = false;
      if (o.mark) o.mark.visible = false;
      if (o.m) o.m.visible = false;
      if (o.wall) o.wall.visible = false;
      if (o.g) o.g.visible = false;
    }
  }
  resetOrbs(fromS = -1e9) {
    for (const o of this.orbs) if (o.s > fromS) o.taken = false;
  }
  orbState() {
    return this.orbs.map((o) => o.taken);
  }
  restoreOrbs(st) {
    this.orbs.forEach((o, i) => (o.taken = st[i]));
  }
  dispose() {
    this.scene.remove(this.root);
    const mats = new Set(Object.values(this.M));
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
    });
    for (const m of mats) m.dispose();
    for (const t of this.ownTex) t.dispose();
  }
}
