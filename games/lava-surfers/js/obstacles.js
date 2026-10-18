/*
 * 용암 서핑 · 장애물 · 수집물 (트랙 좌표에 놓고, 보이는 모양과 같은 크기로 판정)
 *  spire  흑요석 기둥 (높음 · 피해야 함)          rock   낮은 바위 (점프로 넘을 수 있음)
 *  roll   굴러오는 큰 바위 (바닥에 그림자 줄 → 옆 절벽에서 굴러 길을 가로지름)
 *  fire   불기둥 (땅이 붉게 빛남 → 솟음)          crumble 무너지는 땅 (금이 빛남 → 꺼져서 용암)
 *  slider 좌우로 미끄러지는 흑요석 벽            boost  부스터 발판      orb  에너지 구슬
 *  부딪힘은 ev 로 알린다 (game 이 넘어짐 · 점수 · 소리 처리).
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { fbm3, shadeVerts, roundedBox, mergeByMaterial } from "./geo.js?v=1";
import { dotTex, chevronTex, slopeGlowTex, cliffTex, ringTex } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R_PLAYER = 0.45;

function lumpyRock(r, seed = 1, detail = 2) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (fbm3(x / r * 1.3 + seed, y / r * 1.3, z / r * 1.3, 3) - 0.5) * 0.45;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
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
    this.M = {
      obsidian: new THREE.MeshStandardMaterial({ color: "#2c2434", roughness: 0.15, metalness: 0.4, flatShading: true, vertexColors: true }),
      rock: new THREE.MeshStandardMaterial({ map: cliffTex(), roughness: 0.9, vertexColors: true }),
      boulder: new THREE.MeshStandardMaterial({ map: cliffTex(), emissiveMap: slopeGlowTex(), emissive: "#ffffff", emissiveIntensity: 1.2, roughness: 0.85 }),
      warn: new THREE.MeshBasicMaterial({ color: "#ff3a1a", transparent: true, opacity: 0, depthWrite: false }),
      fire: new THREE.MeshBasicMaterial({ color: "#ffb04a", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      fireCore: new THREE.MeshBasicMaterial({ color: "#fff0b0", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      crack: new THREE.MeshStandardMaterial({ color: "#3a2a2e", roughness: 0.9, emissiveMap: slopeGlowTex(), emissive: "#ffffff", emissiveIntensity: 0.2, vertexColors: true }),
      chevron: (() => {
        const t = chevronTex().clone();
        t.needsUpdate = true;
        return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      })(),
      orb: new THREE.MeshStandardMaterial({ color: "#ffe27a", emissive: "#ff9a2a", emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.3, flatShading: true }),
      big: new THREE.MeshStandardMaterial({ color: "#9af4ff", emissive: "#3ad0ff", emissiveIntensity: 2.0, roughness: 0.15, flatShading: true }),
      vent: new THREE.MeshStandardMaterial({ color: "#3a2e34", roughness: 0.9, vertexColors: true }),
      ring: new THREE.MeshBasicMaterial({ map: ringTex(), color: "#ff4a1a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
    this.obs = items.obs.map((o) => ({ ...o }));
    this.orbs = items.orbs.map((o, i) => ({ ...o, i, taken: false }));
    this.boosts = items.boosts.map((b) => ({ ...b, used: 0 }));
    for (const o of this.obs) this.make(o);
    this.makeOrbs();
    for (const b of this.boosts) this.makeBoost(b);
  }
  /** (s,u) 바닥 높이 (없으면 중심선) */
  floor(s, u) {
    const y = this.T.surfaceY(s, u);
    return y == null ? this.T.frame(s, {}).y : y;
  }
  place(obj, s, u, yOff = 0, face = true) {
    const f = this.T.frame(s, {});
    obj.position.set(f.x + f.rx * u, this.floor(s, u) + yOff, f.z + f.rz * u);
    if (face) obj.rotation.y = Math.atan2(f.tx, f.tz);
    return f;
  }

  /* ---------------- 만들기 ---------------- */
  make(o) {
    const T = this.T;
    const M = this.M;
    if (o.type === "spire") {
      // 흑요석 기둥: 큰 결정 + 옆 작은 결정
      const g = new THREE.Group();
      const main = new THREE.CylinderGeometry(o.r * 0.55, o.r, o.h * 0.85, 6);
      main.translate(0, o.h * 0.425, 0);
      shadeVerts(main, { bottom: 0.5, top: 1.15 });
      const tip = new THREE.ConeGeometry(o.r * 0.55, o.h * 0.15, 6);
      tip.translate(0, o.h * 0.925, 0);
      shadeVerts(tip, { bottom: 0.9, top: 1.2 });
      g.add(new THREE.Mesh(main, M.obsidian), new THREE.Mesh(tip, M.obsidian));
      for (let i = 0; i < 3; i++) {
        const sh = new THREE.ConeGeometry(o.r * 0.3, o.h * 0.35, 5);
        sh.translate(0, o.h * 0.17, 0);
        shadeVerts(sh, { bottom: 0.5 });
        const m = new THREE.Mesh(sh, M.obsidian);
        const a = (i / 3) * TAU + o.s;
        m.position.set(Math.cos(a) * o.r * 0.9, 0, Math.sin(a) * o.r * 0.9);
        m.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
        g.add(m);
      }
      const mg = mergeByMaterial(g);
      mg.traverse((x) => x.isMesh && ((x.castShadow = true), (x.receiveShadow = true)));
      this.place(mg, o.s, o.u, -0.2);
      this.root.add(mg);
      o.g = mg;
    } else if (o.type === "rock") {
      const geo = lumpyRock(o.r, o.s, 1);
      geo.scale(1, o.h / (o.r * 1.6), 1);
      geo.translate(0, o.h * 0.42, 0);
      shadeVerts(geo, { bottom: 0.55 });
      const m = new THREE.Mesh(geo, M.rock);
      m.castShadow = m.receiveShadow = true;
      this.place(m, o.s, o.u, -0.05);
      this.root.add(m);
      o.g = m;
    } else if (o.type === "roll") {
      const hw = T.halfWidth(o.s);
      o.u0 = o.side * (hw + 5);
      o.u1 = -o.side * (hw + 6);
      const m = new THREE.Mesh(lumpyRock(o.r, o.s * 3, 2), M.boulder);
      m.castShadow = true;
      m.userData.noCull = true;
      this.root.add(m);
      o.g = m;
      // 바닥 경고: 바위가 지나갈 길 (붉은 줄 + 굴러갈 방향 화살표)
      const f = T.frame(o.s, {});
      const holder = new THREE.Group();
      holder.position.set(f.x, this.floor(o.s, 0) + 0.08, f.z);
      holder.rotation.y = Math.atan2(f.tx, f.tz) - Math.PI; // 안쪽 +x = 오른쪽(+u)
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 1, o.r * 2), M.warn.clone());
      strip.rotation.x = -Math.PI / 2;
      holder.add(strip);
      const arrows = new THREE.Mesh(new THREE.PlaneGeometry(o.r * 1.6, hw * 2), M.chevron.clone());
      arrows.material.map = M.chevron.map.clone();
      arrows.material.map.needsUpdate = true;
      arrows.material.map.repeat.set(1, hw / 2);
      arrows.material.opacity = 0;
      // 화살표(텍스처 위쪽)가 바위가 굴러가는 쪽(-side · u)을 가리키게
      arrows.rotation.set(-Math.PI / 2, 0, o.side * (Math.PI / 2));
      arrows.position.y = 0.01;
      holder.add(arrows);
      this.root.add(holder);
      o.strip = strip;
      o.arrows = arrows;
      o.state = "idle";
    } else if (o.type === "fire") {
      const g = new THREE.Group();
      // 분화구 둘레 돌
      const d = new THREE.Group();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        const r = new THREE.Mesh(shadeVerts(lumpyRock(0.32, i + o.s, 0), { bottom: 0.5 }), M.vent);
        r.position.set(Math.cos(a) * o.r * 0.95, 0.1, Math.sin(a) * o.r * 0.95);
        d.add(r);
      }
      const ring = mergeByMaterial(d);
      g.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(o.r * 1.15, 32), M.ring.clone());
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.06;
      g.add(disc);
      const col = new THREE.Group();
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.5, o.r * 0.95, 5, 18, 1, true).translate(0, 2.5, 0), M.fire.clone());
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.2, o.r * 0.5, 4, 14, 1, true).translate(0, 2, 0), M.fireCore.clone());
      col.add(outer, inner);
      col.visible = false;
      g.add(col);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff6a2a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      gl.position.y = 1.5;
      gl.scale.setScalar(7);
      g.add(gl);
      this.place(g, o.s, o.u, 0);
      this.root.add(g);
      Object.assign(o, { g, disc, col, outer, inner, gl, state: "off" });
    } else if (o.type === "crumble") {
      // 금 간 판들 (무너지면 떨어짐)
      const g = new THREE.Group();
      const pieces = [];
      const ns = Math.max(2, Math.round((o.s1 - o.s0) / 2.4));
      const nu = Math.max(2, Math.round((o.u1 - o.u0) / 2.4));
      for (let i = 0; i < ns; i++)
        for (let k = 0; k < nu; k++) {
          const s = o.s0 + ((o.s1 - o.s0) * (i + 0.5)) / ns;
          const u = o.u0 + ((o.u1 - o.u0) * (k + 0.5)) / nu;
          const geo = shadeVerts(roundedBox(((o.u1 - o.u0) / nu) * 0.96, 0.35, ((o.s1 - o.s0) / ns) * 0.96, 0.05), { bottom: 0.5 });
          const m = new THREE.Mesh(geo, M.crack);
          m.castShadow = m.receiveShadow = true;
          m.userData.noCull = true;
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
    } else if (o.type === "slider") {
      const w = 2.6;
      const geo = shadeVerts(roundedBox(w, o.h, 1.2, 0.12), { bottom: 0.5, top: 1.1 });
      geo.translate(0, o.h / 2, 0);
      const m = new THREE.Mesh(geo, M.obsidian);
      m.castShadow = true;
      m.userData.noCull = true;
      this.root.add(m);
      // 레일
      const hw = T.halfWidth(o.s);
      const rail = new THREE.Mesh(roundedBox(hw * 2, 0.08, 0.3, 0.03), new THREE.MeshStandardMaterial({ color: "#c8a05a", metalness: 0.8, roughness: 0.3 }));
      this.place(rail, o.s, 0, 0.04);
      this.root.add(rail);
      Object.assign(o, { g: m, w, d: 1.2 });
    }
  }
  makeOrbs() {
    const n = this.orbs.length;
    const geo = new THREE.OctahedronGeometry(0.32, 0);
    this.orbMesh = new THREE.InstancedMesh(geo, this.M.orb, n);
    this.orbMesh.frustumCulled = false;
    this.root.add(this.orbMesh);
    this.bigMesh = [];
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
        m.userData.noCull = true;
        this.root.add(m);
        o.g = m;
      }
    }
    this.syncOrbs(0);
  }
  syncOrbs(t) {
    const o3 = new THREE.Object3D();
    this.orbs.forEach((o, i) => {
      o3.position.copy(o.p);
      o3.position.y += Math.sin(t * 3 + i) * 0.12;
      o3.rotation.set(0, t * 2 + i, 0.3);
      o3.scale.setScalar(o.taken || o.big ? 0 : 1);
      o3.updateMatrix();
      this.orbMesh.setMatrixAt(i, o3.matrix);
      if (o.g) {
        o.g.visible = !o.taken;
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

  /* ---------------- 매 프레임 ---------------- */
  update(dt, P, playing, cam) {
    this.t += dt;
    const t = this.t;
    const ev = [];
    const ps = P.s;
    const pu = P.u;
    const T = this.T;
    this.M.chevron.map.offset.y -= dt * 1.5;
    for (const o of this.obs) {
      const ahead = o.s - ps; // 앞에 남은 거리
      if (o.type === "spire" || o.type === "rock") {
        if (!playing || Math.abs(ahead) > o.r + 1) continue;
        const base = this.floor(o.s, o.u);
        const tall = o.type === "spire" ? o.h : o.h * 0.9;
        if (Math.hypot(ahead, o.u - pu) < o.r + R_PLAYER && P.y < base + tall) this.hit(o, P, ev);
      } else if (o.type === "roll") {
        if (o.state === "idle" && ahead < o.trigger + 28 && ahead > 0) {
          o.state = "warn";
          ev.push({ type: "rumble", s: o.s });
        }
        if (o.state === "warn" && ahead < o.trigger) {
          o.state = "roll";
          o.ru = o.u0;
          ev.push({ type: "rollStart", s: o.s });
        }
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
          o.g.visible = true;
          if (playing && Math.hypot(ahead, o.ru - pu) < o.r + R_PLAYER && P.y < fl + o.r * 1.7) this.hit(o, P, ev);
          if (Math.random() < dt * 20) this.fx && this.fx.dust(o.g.position.x, fl, o.g.position.z, 1.2);
        } else if (o.state === "idle" || o.state === "warn") {
          // 절벽 위에서 흔들리며 대기
          const f = T.frame(o.s, {});
          const fl = this.floor(o.s, Math.sign(o.u0) * (T.halfWidth(o.s) - 0.2)) + 1.6;
          o.g.position.set(f.x + f.rx * o.u0 + (o.state === "warn" ? Math.sin(t * 40) * 0.08 : 0), fl + o.r * 0.6, f.z + f.rz * o.u0);
          o.g.visible = true;
        } else o.g.visible = false;
      } else if (o.type === "fire") {
        const cyc = o.period;
        const k = (((t / cyc + o.phase) % 1) + 1) % 1 * cyc;
        const offT = cyc - o.warn - o.on;
        let st = "off";
        if (k > offT && k < offT + o.warn) st = "warn";
        else if (k >= offT + o.warn) st = "on";
        const wk = st === "warn" ? (k - offT) / o.warn : st === "on" ? 1 : 0;
        o.disc.material.opacity = st === "off" ? 0.05 : 0.25 + wk * 0.55 + Math.sin(t * 25) * 0.05;
        o.gl.material.opacity = st === "on" ? 0.8 : wk * 0.4;
        o.col.visible = st === "on";
        if (st === "on") {
          const e = Math.min(1, (k - offT - o.warn) / 0.15);
          o.col.scale.set(1 + Math.sin(t * 30) * 0.06, e, 1 + Math.cos(t * 27) * 0.06);
          o.outer.material.opacity = 0.75 + Math.sin(t * 40) * 0.1;
        }
        if (st !== o.state) {
          if (st === "warn" && Math.abs(ahead) < 60) ev.push({ type: "fireWarn", s: o.s });
          if (st === "on" && Math.abs(ahead) < 60) ev.push({ type: "fireOn", s: o.s });
          o.state = st;
        }
        if (playing && st === "on" && Math.abs(ahead) < o.r + 0.6 && Math.abs(o.u - pu) < o.r + 0.3 && Math.hypot(ahead, o.u - pu) < o.r + 0.35 && P.y < this.floor(o.s, o.u) + 4.5) this.hit(o, P, ev, true);
        if (st === "on" && Math.random() < dt * 30) this.fx && this.fx.ember(o.g.position.x, o.g.position.y + 1, o.g.position.z, 3);
      } else if (o.type === "crumble") {
        const pre = o.s0 - ps;
        if (o.state === "solid" && pre < 34 && pre > -5) {
          o.state = "crack";
          o.ct = 0;
          ev.push({ type: "crack", s: o.s0 });
        }
        if (o.state === "crack") {
          o.ct += dt;
          o.mat.emissiveIntensity = 0.4 + Math.min(1, o.ct) * 1.6 + Math.sin(t * 20) * 0.2;
          for (const m of o.pieces) m.position.x = m.userData.home.x + Math.sin(t * 50 + m.id) * 0.03;
          if (pre < 13) {
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
      } else if (o.type === "slider") {
        const k = 0.5 - 0.5 * Math.cos((TAU * t) / o.period);
        const u = o.u0 + (o.u1 - o.u0) * k;
        o.cu = u;
        const fl = this.floor(o.s, u);
        this.place(o.g, o.s, u, -0.02);
        if (playing && Math.abs(ahead) < o.d / 2 + R_PLAYER && Math.abs(u - pu) < o.w / 2 + R_PLAYER && P.y < fl + o.h) this.hit(o, P, ev);
      }
    }
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
      for (const o of this.orbs) {
        if (o.taken || Math.abs(o.s - ps) > 1.6) continue;
        const f = T.frame(ps, {});
        const px = f.x + f.rx * pu;
        const pz = f.z + f.rz * pu;
        if ((o.p.x - px) ** 2 + (o.p.y - (P.y + 0.7)) ** 2 + (o.p.z - pz) ** 2 < (o.big ? 2.2 : 1.5) ** 2) {
          o.taken = true;
          ev.push({ type: "orb", orb: o });
        }
      }
    }
    this.syncOrbs(t);
    return ev;
  }
  hit(o, P, ev, fire = false) {
    if (P.invulnerable) return;
    // 부딪힌 쪽 반대로 살짝 밀어냄 (장애물 속에 끼지 않게)
    const away = Math.sign(P.u - (o.cu ?? o.ru ?? o.u ?? 0)) || 1;
    if (P.crash()) {
      P.vu = away * 5;
      ev.push({ type: "hit", o, fire });
    }
  }
  /** 다시 시작: fromS 뒤의 장애물만 처음 상태로 (무너진 땅 복구 · 굴러간 바위 다시) */
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
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of Object.values(this.M)) m.dispose();
  }
}
