/*
 * 하늘섬 대탈출 · 스테이지 2~6 장치
 *  모든 장치는 같은 모양: update(dt, P, ev, playing) · reset()  (course.mechs 에 들어가 매 프레임 돈다)
 *  위험한 것은 반드시 미리 알려 준다 (빛 · 소리 · 바닥 표시) → 보고 피할 수 있게.
 *  ev 에 넣는 일: hurt(다침, 하트 -1) · knock(튕김) · sfx · shake
 *
 *  Turntable  빙글빙글 도는 원판 (올라타면 같이 돈다)
 *  Windmill   길을 가로질러 도는 풍차 날개 (닿으면 튕김)
 *  Conveyor   짐 나르는 띠 (밟으면 밀려감 · 방향이 바뀌기도)
 *  Swing      크레인 · 쇠사슬에 매달려 흔들리는 발판
 *  Cannon     포탄 (쏘기 전에 바닥에 빨간 줄)
 *  Drawbridge 올라갔다 내려오는 도개교 (종 · 빨간 불 → 들림)
 *  PhasePad   나타났다 사라지는 수정 발판 (사라지기 전에 깜빡)
 *  Dropper    떨어지는 고드름 수정 · 낙석 (흔들림 + 바닥 그림자)
 *  Beam       돌아가는 수정 빛줄기 (닿으면 다침 · 뛰어넘기)
 *  Lightning  번개 (바닥 원이 차오르면 꽝)
 *  Spikes     튀어나오는 가시 (덜컥 소리 + 끝이 살짝 보임)
 *  WindZone   앞에서 · 옆에서 부는 바람 구역 (켜지기 전에 바람 소리 · 먼지)
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { roundedBox, taperTube, ropeGeo, shadeVerts, mergeByMaterial } from "./geo.js?v=1";
import { dotTex, beltTex, hazardTex, windTex } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** 장치들이 같이 쓰는 재질 (코스마다 한 번) */
export function mechMats(c) {
  if (c.mm) return c.mm;
  c.mm = {
    iron: new THREE.MeshStandardMaterial({ color: "#5c5866", metalness: 0.75, roughness: 0.38, vertexColors: true }),
    ironDk: new THREE.MeshStandardMaterial({ color: "#3a3640", metalness: 0.7, roughness: 0.45, vertexColors: true }),
    brass: c.M.brass,
    red: new THREE.MeshStandardMaterial({ color: "#d8443a", roughness: 0.5, vertexColors: true }),
    sail: new THREE.MeshStandardMaterial({ color: "#f3e6cc", roughness: 0.9, side: THREE.DoubleSide, vertexColors: true }),
    lampOff: new THREE.MeshStandardMaterial({ color: "#552222", roughness: 0.4 }),
    lampRed: new THREE.MeshStandardMaterial({ color: "#ff5a4a", emissive: "#ff2a1a", emissiveIntensity: 2.2, roughness: 0.4 }),
    lampGreen: new THREE.MeshStandardMaterial({ color: "#7aff9a", emissive: "#2aff6a", emissiveIntensity: 1.6, roughness: 0.4 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.6 }),
    belt: (() => {
      const t = beltTex().clone();
      t.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
    })(),
  };
  return c.mm;
}
function glow(color, s, op = 0.8) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.setScalar(s);
  return sp;
}
/** 바닥 경고 원: 바깥 고리 + 안쪽이 차오름 (k=0~1) */
function warnDisc(r, color = "#ff4a3a") {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.88, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
  ring.rotation.x = fill.rotation.x = -Math.PI / 2;
  ring.renderOrder = fill.renderOrder = 3;
  g.add(fill, ring);
  g.set = (k, on = true) => {
    ring.material.opacity = on ? 0.85 : 0;
    fill.material.opacity = on ? 0.18 + k * 0.32 : 0;
    fill.scale.setScalar(on ? Math.max(0.05, k) : 0.01);
  };
  g.set(0, false);
  return g;
}
/** 점 p 와 선분 ab 사이 거리 */
function segDist(p, a, b) {
  tmpA.subVectors(b, a);
  const L2 = tmpA.lengthSq() || 1;
  const u = clamp(tmpB.subVectors(p, a).dot(tmpA) / L2, 0, 1);
  return tmpB.copy(a).addScaledVector(tmpA, u).distanceTo(p);
}
const center = (P) => tmpA.set(P.pos.x, P.pos.y + 0.6, P.pos.z).clone();
function shadowAll(g, cast = true) {
  g.traverse((o) => o.isMesh && ((o.castShadow = cast), (o.receiveShadow = true)));
  return g;
}

/* ================================================================
 * 빙글빙글 도는 원판 (톱니바퀴 · 나무 원판)
 * ============================================================== */
export class Turntable {
  constructor(c, x, y, z, r, speed, { look = "gear" } = {}) {
    this.kind = "turn";
    const mm = mechMats(c);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const top = look === "gear" ? mm.iron : c.M.wood;
    const body = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(r, r * 0.96, 0.5, 48), { bottom: 0.6 }), top);
    body.position.y = -0.25;
    g.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.06, 0.07, 8, 64), mm.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.0;
    g.add(rim);
    if (look === "gear") {
      const n = Math.round(r * 7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const t = new THREE.Mesh(shadeVerts(roundedBox(0.36, 0.42, 0.34, 0.05), { bottom: 0.6 }), mm.ironDk);
        t.position.set(Math.cos(a) * (r + 0.12), -0.24, Math.sin(a) * (r + 0.12));
        t.rotation.y = -a;
        g.add(t);
      }
      // 바큇살 무늬 (살짝 튀어나온 판)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const s = new THREE.Mesh(shadeVerts(roundedBox(r * 0.82, 0.04, 0.22, 0.02)), mm.brass);
        s.position.set(Math.cos(a) * r * 0.45, 0.01, Math.sin(a) * r * 0.45);
        s.rotation.y = -a;
        g.add(s);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(shadeVerts(roundedBox(r * 1.9, 0.03, 0.12, 0.01)), c.M.woodDark);
        s.position.y = 0.012;
        s.rotation.y = (i / 4) * Math.PI;
        g.add(s);
      }
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 20), mm.brass);
    hub.position.y = 0.04;
    g.add(hub);
    // 아래 굴대 + 받침 톱니
    const axle = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.35, 0.45, 3.2, 14), { bottom: 0.4 }), mm.ironDk);
    axle.position.y = -2.0;
    g.add(axle);
    const merged = mergeByMaterial(g);
    this.g = shadowAll(merged);
    c.root.add(this.g);
    this.solid = c.disc(x, z, r, y, { turn: true });
    this.speed = speed;
    this.x = x;
    this.y = y;
    this.z = z;
    this.r = r;
    this.c = c;
    this.gearT = 0;
    c.mechs.push(this);
  }
  update(dt, P, ev) {
    const a = this.speed * dt;
    this.g.rotation.y += a;
    this.solid.rot = a;
    this.gearT -= dt;
    if (P && this.gearT <= 0 && P.pos.distanceTo(this.g.position) < 9) {
      this.gearT = 0.9;
      ev.push({ type: "sfx", name: "gear" });
    }
  }
  reset() {}
}

/* ================================================================
 * 풍차 날개: 길 위를 세로로 가로지르며 돈다 (날개가 내려올 때를 피해 지나가기)
 * ============================================================== */
export class Windmill {
  constructor(c, x, y, z, { len = 4.0, speed = 1.1, n = 4, h = 4.6, side = 1, phase = 0 } = {}) {
    this.kind = "blade";
    const mm = mechMats(c);
    const M = c.M;
    // 탑: 길 옆 바위 기둥 위 (길을 막지 않게)
    const tx = x + side * 3.4;
    const tower = new THREE.Group();
    tower.position.set(tx, y, z - 1.0);
    const tg = shadeVerts(new THREE.CylinderGeometry(0.75, 1.15, h + 1.2, 8), { bottom: 0.55 });
    const tm = new THREE.Mesh(tg, M.stone);
    tm.position.y = (h + 1.2) / 2 - 0.6;
    tower.add(tm);
    const roof = new THREE.Mesh(shadeVerts(new THREE.ConeGeometry(1.05, 1.3, 8), { bottom: 0.7 }), M.roof);
    roof.position.y = h + 1.2;
    tower.add(roof);
    // 굴대 집 (탑 → 길 위 가운데)
    const beam = new THREE.Mesh(shadeVerts(roundedBox(Math.abs(tx - x) + 0.6, 0.5, 0.6, 0.12), { bottom: 0.7 }), M.woodDark);
    beam.position.set((x - tx) / 2, h, 0.0);
    tower.add(beam);
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), M.window);
      w.position.set(Math.cos(i * 2.1) * 0.8, 1.2 + i * 1.1, Math.sin(i * 2.1) * 0.8);
      w.lookAt(w.position.clone().multiplyScalar(2).setY(w.position.y));
      tower.add(w);
    }
    const tmg = mergeByMaterial(tower);
    shadowAll(tmg);
    c.root.add(tmg);
    // 탑 받침 섬
    c.island(tx, y - 0.02, z - 1.0, 1.7, { depth: 3, seed: Math.round(-z), deco: "none", flowers: 0.2, rim: false });
    c.box(tx - 0.8, tx + 0.8, y, y + h + 1, z - 1.8, z - 0.2, { noCam: true });
    // 날개 (돛천 + 나무 살)
    const rotor = new THREE.Group();
    rotor.position.set(x, y + h, z);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mm.brass);
    rotor.add(hub);
    for (let i = 0; i < n; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i / n) * TAU;
      const spar = new THREE.Mesh(shadeVerts(roundedBox(0.16, len, 0.16, 0.04)), M.woodDark);
      spar.position.y = len / 2;
      arm.add(spar);
      const sail = new THREE.Mesh(shadeVerts(new THREE.PlaneGeometry(0.9, len * 0.78, 1, 4), { bottom: 0.85 }), mm.sail);
      sail.position.set(0.5, len * 0.58, 0.02);
      arm.add(sail);
      for (let k = 0; k < 4; k++) {
        const rung = new THREE.Mesh(shadeVerts(roundedBox(1.0, 0.06, 0.06, 0.02)), M.woodDark);
        rung.position.set(0.5, len * 0.25 + k * len * 0.22, 0.04);
        arm.add(rung);
      }
      const tip = new THREE.Mesh(shadeVerts(roundedBox(0.2, 0.34, 0.2, 0.05)), mm.red);
      tip.position.y = len - 0.1;
      arm.add(tip);
      rotor.add(arm);
    }
    const rm = mergeByMaterial(rotor);
    shadowAll(rm);
    rm.userData.keep = true;
    c.root.add(rm);
    this.rotor = rm;
    this.hub = V(x, y + h, z);
    this.x = x;
    this.y = y;
    this.z = z;
    this.n = n;
    this.len = len;
    this.speed = speed;
    this.ang = phase;
    this.phase = phase;
    c.mechs.push(this);
  }
  /** 날개 i 의 끝 (세계 좌표) */
  tip(i, ang = this.ang) {
    const a = ang + (i / this.n) * TAU;
    return V(this.hub.x - Math.sin(a) * this.len, this.hub.y + Math.cos(a) * this.len, this.z);
  }
  /** 길(x)을 지나가는 날개가 가장 낮은 높이 (봇 · 판정용): 길 위 0~2m 를 막고 있나 */
  blocking(ang = this.ang, px = this.x) {
    for (let i = 0; i < this.n; i++) {
      const tp = this.tip(i, ang);
      // 날개 선분이 x=px 를 지나는 높이
      const dx = tp.x - this.hub.x;
      if (Math.abs(dx) < 1e-3) {
        if (tp.y < this.hub.y && tp.y < this.y + 2.2) return true;
        continue;
      }
      const u = (px - this.hub.x) / dx;
      if (u < 0 || u > 1) continue;
      const yy = this.hub.y + (tp.y - this.hub.y) * u;
      if (yy < this.y + 2.3) return true;
    }
    return false;
  }
  update(dt, P, ev, playing) {
    this.ang += this.speed * dt;
    this.rotor.rotation.z = this.ang;
    if (!P || !playing || P.stunT > 0 || P.dashT > 0) return;
    if (Math.abs(P.pos.z - this.z) > 0.75) return;
    const pc = center(P);
    for (let i = 0; i < this.n; i++) {
      const d = segDist(pc, this.hub, this.tip(i));
      if (d < 0.62) {
        const from = V(P.pos.x, P.pos.y, P.pos.z + (P.pos.z > this.z ? -1 : 1));
        ev.push({ type: "knock", from, p: pc });
        break;
      }
    }
  }
  reset() {}
}

/* ================================================================
 * 짐 나르는 띠 (컨베이어): 밟으면 띠 방향으로 밀려간다. flip>0 이면 경고 뒤 방향이 바뀐다.
 * ============================================================== */
export class Conveyor {
  constructor(c, x, y, z, sx, sz, push, { flip = 0, warn = 1.2 } = {}) {
    this.kind = "belt";
    const mm = mechMats(c);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const frame = new THREE.Mesh(shadeVerts(roundedBox(sx + 0.3, 0.5, sz + 0.3, 0.08), { bottom: 0.5 }), mm.ironDk);
    frame.position.y = -0.3;
    g.add(frame);
    // 띠 윗면 (무늬가 흘러감)
    const along = Math.abs(push.x) > Math.abs(push.z) ? "x" : "z";
    const mat = mm.belt.clone();
    mat.map = mm.belt.map.clone();
    mat.map.needsUpdate = true;
    const len = along === "z" ? sz : sx;
    const wid = along === "z" ? sx : sz;
    mat.map.repeat.set(Math.max(1, Math.round(wid / 1.2)), len / 1.6);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(wid, len), mat);
    top.rotation.x = -Math.PI / 2;
    // 텍스처 위쪽(v+) = 밀리는 방향
    top.rotation.z = Math.atan2(push.x, push.z) + Math.PI;
    top.position.y = 0.012;
    top.receiveShadow = true;
    g.add(top);
    // 양끝 굴림대
    for (const s of [-1, 1]) {
      const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, wid + 0.2, 16), mm.brass);
      if (along === "z") {
        rl.rotation.z = Math.PI / 2;
        rl.position.set(0, -0.18, (s * sz) / 2);
      } else {
        rl.rotation.x = Math.PI / 2;
        rl.position.set((s * sx) / 2, -0.18, 0);
      }
      g.add(rl);
    }
    // 방향 등 (바뀌기 전에 깜빡)
    this.lamps = [];
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8)), mm.ironDk);
      const px = along === "z" ? (s * (sx + 0.5)) / 2 : 0;
      const pz = along === "z" ? 0 : (s * (sz + 0.5)) / 2;
      post.position.set(px, 0.45, pz);
      g.add(post);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), mm.lampGreen);
      lamp.position.set(px, 0.95, pz);
      g.add(lamp);
      this.lamps.push(lamp);
    }
    shadowAll(g);
    c.root.add(g);
    this.top = top;
    this.solid = c.box(x - sx / 2, x + sx / 2, y - 0.5, y, z - sz / 2, z + sz / 2, { push: { x: push.x, z: push.z } });
    this.push0 = { x: push.x, z: push.z };
    this.dir = 1;
    this.flip = flip;
    this.warn = warn;
    this.t = 0;
    this.speed = Math.hypot(push.x, push.z);
    this.mm = mm;
    this.p = V(x, y, z);
    c.mechs.push(this);
  }
  get warning() {
    return this.flip > 0 && this.t % this.flip > this.flip - this.warn;
  }
  update(dt, P, ev) {
    this.t += dt;
    if (this.flip > 0) {
      const k = Math.floor(this.t / this.flip);
      const nd = k % 2 ? -1 : 1;
      if (nd !== this.dir) {
        this.dir = nd;
        this.solid.push = { x: this.push0.x * nd, z: this.push0.z * nd };
        if (P && P.pos.distanceTo(this.p) < 14) ev.push({ type: "sfx", name: "gear" });
      }
      const w = this.warning;
      for (const l of this.lamps) l.material = w ? (Math.floor(this.t * 8) % 2 ? this.mm.lampRed : this.mm.lampOff) : this.mm.lampGreen;
      if (w && P && P.pos.distanceTo(this.p) < 12 && Math.floor(this.t * 4) !== Math.floor((this.t - dt) * 4)) ev.push({ type: "sfx", name: "warn" });
    }
    this.top.material.map.offset.y -= dt * this.speed * this.dir * 0.62;
  }
  reset() {}
}

/* ================================================================
 * 흔들리는 발판 (크레인 · 쇠사슬)
 *  axis "x": 길을 가로질러 좌우로, "z": 길 방향으로 앞뒤로
 * ============================================================== */
export class Swing {
  constructor(c, px, py, pz, len, { axis = "x", amp = 0.6, period = 3.6, phase = 0, w = 2.2, l = 2.2, look = "crate", crane = true, side = 1 } = {}) {
    this.kind = "swing";
    const mm = mechMats(c);
    const M = c.M;
    this.pivot = V(px, py, pz);
    Object.assign(this, { len, axis, amp, period, phase, w, l, t: 0 });
    // 매다는 구조물
    if (crane) {
      const s = new THREE.Group();
      const mx = px + side * 4.2;
      const mh = len + 6;
      const mast = new THREE.Mesh(shadeVerts(roundedBox(0.5, mh, 0.5, 0.06), { bottom: 0.5 }), look === "cage" ? mm.ironDk : M.woodDark);
      mast.position.set(mx, py - mh / 2 + 0.3, pz);
      s.add(mast);
      const jib = new THREE.Mesh(shadeVerts(roundedBox(Math.abs(mx - px) + 1.2, 0.42, 0.42, 0.06), { bottom: 0.7 }), look === "cage" ? mm.ironDk : M.woodDark);
      jib.position.set((mx + px) / 2, py + 0.25, pz);
      s.add(jib);
      const cap = new THREE.Mesh(shadeVerts(roundedBox(0.9, 0.7, 0.9, 0.1)), mm.red);
      cap.position.set(mx, py + 0.5, pz);
      s.add(cap);
      // 버팀줄
      s.add(new THREE.Mesh(ropeGeo(V(mx, py + 0.8, pz), V(px, py + 0.4, pz), 0.3, 0.035, 10), M.rope));
      const base = mergeByMaterial(s);
      shadowAll(base);
      c.root.add(base);
      c.box(mx - 0.3, mx + 0.3, py - mh, py + 0.6, pz - 0.3, pz + 0.3, { noCam: true });
    }
    // 흔들리는 줄 (피벗에서 돈다)
    this.arm = new THREE.Group();
    this.arm.position.copy(this.pivot);
    const chain = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.05, 0.05, len, 6)), look === "cage" ? mm.ironDk : M.rope);
    chain.position.y = -len / 2;
    this.arm.add(chain);
    for (const s of [-1, 1]) {
      const sl = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5)), look === "cage" ? mm.ironDk : M.rope);
      sl.position.set(s * w * 0.3, -len + 0.7, 0);
      sl.rotation.z = s * 0.45;
      this.arm.add(sl);
    }
    c.root.add(this.arm);
    // 발판
    const pf = new THREE.Group();
    if (look === "cage") {
      const floor = new THREE.Mesh(shadeVerts(roundedBox(w, 0.24, l, 0.05), { bottom: 0.5 }), mm.iron);
      floor.position.y = -0.12;
      pf.add(floor);
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6), mm.ironDk);
        bar.position.set((sx * w) / 2 - sx * 0.06, 0.45, (sz * l) / 2 - sz * 0.06);
        pf.add(bar);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 6, 12), mm.ironDk);
      ring.position.y = 0.9;
      pf.add(ring);
    } else {
      // 나무 짐 받침 + 상자 테두리
      const floor = new THREE.Mesh(shadeVerts(roundedBox(w, 0.26, l, 0.05), { bottom: 0.6 }), M.wood);
      floor.position.y = -0.13;
      pf.add(floor);
      for (const s of [-1, 1]) {
        const lip = new THREE.Mesh(shadeVerts(roundedBox(w, 0.1, 0.14, 0.03)), mm.hazard);
        lip.position.set(0, 0.0, (s * (l - 0.14)) / 2);
        pf.add(lip);
      }
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12, Math.PI * 1.4), mm.brass);
      hook.position.y = 0.95;
      pf.add(hook);
    }
    shadowAll(pf);
    this.pf = mergeByMaterial(pf);
    shadowAll(this.pf);
    c.root.add(this.pf);
    this.solid = c.box(0, 0, 0, 0, 0, 0, { mover: true, noCam: true });
    this.solid.predict = (ahead) => this.posAt(this.t + ahead);
    this.solid.swing = this;
    this.pos = this.posAt(0);
    this.place(0, true);
    c.mechs.push(this);
  }
  angAt(t) {
    return this.amp * Math.sin(TAU * (t / this.period + this.phase));
  }
  posAt(t) {
    const a = this.angAt(t);
    const p = this.pivot;
    if (this.axis === "x") return V(p.x + Math.sin(a) * this.len, p.y - Math.cos(a) * this.len, p.z);
    return V(p.x, p.y - Math.cos(a) * this.len, p.z + Math.sin(a) * this.len);
  }
  place(t, first = false) {
    const a = this.angAt(t);
    const np = this.posAt(t);
    const s = this.solid;
    s.dx = first ? 0 : np.x - this.pos.x;
    s.dy = first ? 0 : np.y - this.pos.y;
    s.dz = first ? 0 : np.z - this.pos.z;
    this.pos.copy(np);
    s.x0 = np.x - this.w / 2;
    s.x1 = np.x + this.w / 2;
    s.z0 = np.z - this.l / 2;
    s.z1 = np.z + this.l / 2;
    s.y1 = np.y;
    s.y0 = np.y - 0.3;
    s.cx = np.x;
    s.cz = np.z;
    this.pf.position.copy(np);
    if (this.axis === "x") this.arm.rotation.set(0, 0, a);
    else this.arm.rotation.set(-a, 0, 0);
  }
  update(dt, P, ev) {
    const prev = this.angAt(this.t);
    this.t += dt;
    this.place(this.t);
    const now = this.angAt(this.t);
    if (P && Math.sign(prev) !== Math.sign(now) && P.pos.distanceTo(this.pos) < 10) ev.push({ type: "sfx", name: "chain" });
  }
  reset() {}
}

/* ================================================================
 * 대포 (항구 포대 · 용머리 포탑): 쏘기 1초 전부터 바닥에 빨간 줄 + 포구가 빛남
 * ============================================================== */
export class Cannon {
  constructor(c, x, y, z, dir, { period = 3.2, phase = 0, speed = 11, range = 14, h = 0.75, warn = 1.0, floorY = null, look = "harbor", base = true } = {}) {
    this.kind = "cannon";
    const mm = mechMats(c);
    const M = c.M;
    this.c = c;
    this.dir = dir.clone().setY(0).normalize();
    Object.assign(this, { period, phase, speed, range, h, warn, look });
    this.floorY = floorY ?? y;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    if (look === "dragon") {
      // 용머리 포탑 (현무암 + 금 장식 + 빛나는 눈)
      const head = new THREE.Mesh(shadeVerts(roundedBox(1.2, 1.0, 1.7, 0.3), { bottom: 0.5 }), M.stone);
      head.position.set(0, h + 0.1, 0.2);
      g.add(head);
      const snout = new THREE.Mesh(shadeVerts(roundedBox(0.9, 0.6, 0.9, 0.2), { bottom: 0.6 }), M.stone);
      snout.position.set(0, h - 0.05, 1.1);
      g.add(snout);
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(shadeVerts(new THREE.ConeGeometry(0.14, 0.9, 8), { bottom: 0.7 }), mm.brass);
        horn.position.set(s * 0.42, h + 0.75, -0.3);
        horn.rotation.x = -0.7;
        g.add(horn);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mm.lampRed);
        eye.position.set(s * 0.36, h + 0.3, 0.98);
        g.add(eye);
      }
      const ped = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.55, 0.75, h, 10), { bottom: 0.5 }), M.stone);
      ped.position.y = h / 2 - 0.2;
      g.add(ped);
    } else {
      const barrel = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.3, 0.38, 1.7, 18), { bottom: 0.6 }), mm.ironDk);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, h, 0.35);
      g.add(barrel);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.08, 8, 18), mm.brass);
      lip.position.set(0, h, 1.2);
      g.add(lip);
      const back = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mm.ironDk);
      back.position.set(0, h, -0.5);
      g.add(back);
      const cart = new THREE.Mesh(shadeVerts(roundedBox(1.0, 0.5, 1.4, 0.08), { bottom: 0.6 }), M.woodDark);
      cart.position.set(0, h - 0.5, 0);
      g.add(cart);
      for (const s of [-1, 1])
        for (const zz of [-0.45, 0.45]) {
          const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 14), M.wood);
          wh.rotation.z = Math.PI / 2;
          wh.position.set(s * 0.56, h - 0.62, zz);
          g.add(wh);
        }
    }
    const mg = mergeByMaterial(g);
    shadowAll(mg);
    c.root.add(mg);
    this.g = mg;
    if (base) c.island(x, y - 0.02, z, 1.5, { depth: 2.6, seed: Math.round(x * 7 - z), deco: "none", flowers: 0.1, rim: false });
    c.box(x - 0.6, x + 0.6, y, y + h + 0.5, z - 0.6, z + 0.6, { noCam: true });
    this.muzzle = V(x, y + h, z).addScaledVector(this.dir, 1.3);
    this.muzzleGlow = glow(look === "dragon" ? "#ff7a3a" : "#ffb04a", 0.1, 0.9);
    this.muzzleGlow.position.copy(this.muzzle);
    c.root.add(this.muzzleGlow);
    // 바닥 경고 줄 (포탄이 지나갈 길)
    const stripLen = range - 1.4;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.0, stripLen), new THREE.MeshBasicMaterial({ color: "#ff3a2a", transparent: true, opacity: 0, depthWrite: false }));
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = Math.atan2(this.dir.x, this.dir.z) + Math.PI;
    const mid = this.muzzle.clone().addScaledVector(this.dir, stripLen / 2);
    strip.position.set(mid.x, this.floorY + 0.03, mid.z);
    strip.renderOrder = 3;
    c.root.add(strip);
    this.strip = strip;
    // 포탄 (재사용)
    this.balls = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      const core = new THREE.Mesh(shadeVerts(new THREE.SphereGeometry(0.36, 16, 12), { bottom: 0.7 }), look === "dragon" ? new THREE.MeshStandardMaterial({ color: "#ffb05a", emissive: "#ff5a1a", emissiveIntensity: 2.2 }) : mm.ironDk);
      core.castShadow = true;
      b.add(core);
      b.add(glow(look === "dragon" ? "#ff6a2a" : "#ffd27a", look === "dragon" ? 2.2 : 0.9, look === "dragon" ? 0.8 : 0.35));
      b.visible = false;
      b.userData.noCull = true;
      c.root.add(b);
      this.balls.push({ g: b, on: false, p: V(), d: 0 });
    }
    this.t = 0;
    this.fired = false;
    c.mechs.push(this);
  }
  /** 다음 발사까지 남은 시간 */
  get untilFire() {
    const k = (((this.t + this.phase * this.period) % this.period) + this.period) % this.period;
    return this.period - k;
  }
  update(dt, P, ev, playing) {
    const before = this.untilFire;
    this.t += dt;
    const left = this.untilFire;
    const near = P && P.pos.distanceTo(this.muzzle) < 26;
    const warning = left < this.warn;
    const k = warning ? 1 - left / this.warn : 0;
    this.strip.material.opacity = warning ? 0.16 + k * 0.3 + Math.sin(this.t * 30) * 0.06 : 0;
    this.muzzleGlow.scale.setScalar(warning ? 0.4 + k * 1.6 : 0.1);
    if (before >= this.warn && left < this.warn && near) ev.push({ type: "sfx", name: "fuse" });
    if (left > before) {
      // 발사!
      const b = this.balls.find((q) => !q.on) || this.balls[0];
      b.on = true;
      b.d = 0;
      b.p.copy(this.muzzle);
      b.g.visible = true;
      b.g.position.copy(b.p);
      if (near) {
        ev.push({ type: "sfx", name: this.look === "dragon" ? "fire" : "cannon" });
        if (P.pos.distanceTo(this.muzzle) < 10) ev.push({ type: "shake", k: 0.2 });
      }
      this.c.fx.puff(this.muzzle.x, this.muzzle.y, this.muzzle.z, 0.9, 5, this.look === "dragon" ? "#ffb07a" : "#e8e0e8");
    }
    for (const b of this.balls) {
      if (!b.on) continue;
      const step = this.speed * dt;
      b.p.addScaledVector(this.dir, step);
      b.d += step;
      b.g.position.copy(b.p);
      if (Math.random() < dt * 20) this.c.fx.puff(b.p.x, b.p.y, b.p.z, 0.25, 1, this.look === "dragon" ? "#ff9a5a" : "#d8d0d8");
      let hit = false;
      if (P && playing) {
        const pc = center(P);
        if (pc.distanceTo(b.p) < 0.36 + 0.42 && !P.invulnerable) {
          hit = true;
          ev.push({ type: "hurt", from: b.p.clone().addScaledVector(this.dir, -1), power: 7, p: b.p.clone() });
        }
      }
      if (hit || b.d > this.range) {
        b.on = false;
        b.g.visible = false;
        this.c.fx.puff(b.p.x, b.p.y, b.p.z, 0.9, 4, this.look === "dragon" ? "#ff8a4a" : "#d8d0d8");
        if (P && P.pos.distanceTo(b.p) < 14) ev.push({ type: "sfx", name: "boom" });
      }
    }
  }
  reset() {
    for (const b of this.balls) {
      b.on = false;
      b.g.visible = false;
    }
  }
}

/* ================================================================
 * 도개교: 내려와 있음(초록불) → 종 + 빨간불 깜빡 → 들림 → 다시 내려옴
 * ============================================================== */
export class Drawbridge {
  constructor(c, x, y, zA, zB, { w = 2.6, down = 3.4, warn = 1.1, up = 1.6, move = 0.6, phase = 0 } = {}) {
    this.kind = "draw";
    const mm = mechMats(c);
    const M = c.M;
    Object.assign(this, { x, y, zA, zB, w, down, warn, up, move });
    this.cyc = down + warn + up + move * 2;
    this.t = phase * this.cyc;
    const mid = (zA + zB) / 2;
    const half = Math.abs(zA - zB) / 2;
    this.leaves = [];
    for (const [hz, sgn] of [
      [zA, -1],
      [zB, 1],
    ]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, hz);
      const leaf = new THREE.Group();
      const n = Math.round(half / 0.5);
      for (let i = 0; i < n; i++) {
        const pl = new THREE.Mesh(shadeVerts(roundedBox(w, 0.2, (half / n) * 0.92, 0.03), { bottom: 0.6 }), M.wood);
        pl.position.set(0, -0.1, sgn * (half / n) * (i + 0.5));
        leaf.add(pl);
      }
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(shadeVerts(roundedBox(0.12, 0.16, half, 0.03)), mm.ironDk);
        rail.position.set((s * (w - 0.1)) / 2, -0.22, (sgn * half) / 2);
        leaf.add(rail);
      }
      const edge = new THREE.Mesh(shadeVerts(roundedBox(w, 0.06, 0.24, 0.02)), mm.hazard);
      edge.position.set(0, 0.0, sgn * (half - 0.12));
      leaf.add(edge);
      const lm = mergeByMaterial(leaf);
      shadowAll(lm);
      pivot.add(lm);
      c.root.add(pivot);
      const solid = c.box(x - w / 2, x + w / 2, y - 0.25, y, Math.min(hz, mid), Math.max(hz, mid));
      this.leaves.push({ pivot, solid, sgn });
      // 기둥 · 등 · 쇠사슬
      const post = new THREE.Group();
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(shadeVerts(roundedBox(0.4, 2.8, 0.4, 0.06), { bottom: 0.5 }), M.stone);
        p.position.set(x + (s * (w + 0.5)) / 2, y + 1.4, hz);
        post.add(p);
        const cap = new THREE.Mesh(shadeVerts(new THREE.ConeGeometry(0.34, 0.5, 4), { bottom: 0.7 }), M.roof);
        cap.position.set(x + (s * (w + 0.5)) / 2, y + 3.05, hz);
        cap.rotation.y = Math.PI / 4;
        post.add(cap);
      }
      const pm = mergeByMaterial(post);
      shadowAll(pm);
      c.root.add(pm);
      for (const s of [-1, 1]) c.box(x + (s * (w + 0.5)) / 2 - 0.2, x + (s * (w + 0.5)) / 2 + 0.2, y, y + 2.8, hz - 0.2, hz + 0.2, { noCam: true });
    }
    this.lamps = [];
    for (const [hz] of [[zA], [zB]]) {
      for (const s of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mm.lampGreen);
        l.position.set(x + (s * (w + 0.5)) / 2, y + 2.45, hz + (hz === zA ? -0.22 : 0.22));
        c.root.add(l);
        this.lamps.push(l);
      }
    }
    this.mm = mm;
    this.p = V(x, y, mid);
    this.state = "down";
    this.ang = 0;
    c.mechs.push(this);
  }
  phaseAt(t) {
    const k = ((t % this.cyc) + this.cyc) % this.cyc;
    const { down, warn, up, move } = this;
    if (k < down) return { s: "down", left: down - k };
    if (k < down + warn) return { s: "warn", left: down + warn - k };
    if (k < down + warn + move) return { s: "rise", k: (k - down - warn) / move };
    if (k < down + warn + move + up) return { s: "up", left: down + warn + move + up - k };
    return { s: "lower", k: (k - down - warn - move - up) / move };
  }
  /** 지금부터 건널 수 있는 시간 (봇용) */
  get safeFor() {
    const ph = this.phaseAt(this.t);
    return ph.s === "down" ? ph.left : 0;
  }
  update(dt, P, ev) {
    this.t += dt;
    const ph = this.phaseAt(this.t);
    let ang = 0;
    if (ph.s === "rise") ang = ph.k;
    else if (ph.s === "up") ang = 1;
    else if (ph.s === "lower") ang = 1 - ph.k;
    ang = ang * ang * (3 - 2 * ang) * 1.25;
    this.ang = ang;
    const near = P && P.pos.distanceTo(this.p) < 18;
    if (ph.s !== this.state) {
      if (ph.s === "warn" && near) ev.push({ type: "sfx", name: "bell" });
      if ((ph.s === "rise" || ph.s === "lower") && near) ev.push({ type: "sfx", name: "bridge" });
      this.state = ph.s;
    }
    for (const lf of this.leaves) {
      lf.pivot.rotation.x = -lf.sgn * ang;
      lf.solid.active = ang < 0.12;
    }
    const blink = ph.s === "warn" ? Math.floor(this.t * 8) % 2 === 0 : false;
    for (const l of this.lamps) l.material = ph.s === "down" ? this.mm.lampGreen : ph.s === "warn" ? (blink ? this.mm.lampRed : this.mm.lampOff) : this.mm.lampRed;
  }
  reset() {}
}

/* ================================================================
 * 나타났다 사라지는 수정 발판: 켜짐 → (마지막 0.8초 깜빡) → 사라짐 → 다시 나타남
 * ============================================================== */
export class PhasePad {
  constructor(c, x, y, z, r = 1.3, { on = 2.6, off = 1.6, flicker = 0.8, phase = 0, color = "#7af4ff" } = {}) {
    this.kind = "phase";
    Object.assign(this, { on, off, flicker });
    this.cyc = on + off;
    this.t = phase * this.cyc;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.86, 0.32, 6), this.mat);
    top.position.y = -0.16;
    g.add(top);
    for (let i = 0; i < 4; i++) {
      const sh = new THREE.Mesh(new THREE.ConeGeometry(r * 0.22, 1.1 + (i % 2) * 0.6, 6), this.mat);
      const a = (i / 4) * TAU + 0.4;
      sh.position.set(Math.cos(a) * r * 0.4, -0.75 - (i % 2) * 0.3, Math.sin(a) * r * 0.4);
      sh.rotation.x = Math.PI;
      g.add(sh);
    }
    const halo = glow(color, r * 3.2, 0.35);
    halo.position.y = -0.4;
    g.add(halo);
    this.halo = halo;
    c.root.add(g);
    this.g = g;
    this.solid = c.disc(x, z, r, y, { noCam: true, phase: this });
    this.p = V(x, y, z);
    this.state = "on";
    c.mechs.push(this);
  }
  /** 켜져 있으면 남은 시간(+), 꺼져 있으면 다시 켜질 때까지(-) */
  remain(t = this.t) {
    const k = ((t % this.cyc) + this.cyc) % this.cyc;
    return k < this.on ? this.on - k : -(this.cyc - k);
  }
  update(dt, P, ev) {
    this.t += dt;
    const rem = this.remain();
    const on = rem > 0;
    const k = ((this.t % this.cyc) + this.cyc) % this.cyc;
    let op = 0;
    if (on) {
      op = Math.min(1, k / 0.25);
      if (rem < this.flicker) op *= Math.floor(this.t * 12) % 2 ? 0.25 : 0.9;
    }
    this.mat.opacity = 0.12 + op * 0.75;
    this.mat.emissiveIntensity = 0.3 + op * 0.8;
    this.halo.material.opacity = op * 0.35;
    this.g.scale.setScalar(on ? 1 : 0.92);
    this.solid.active = on;
    const st = on ? "on" : "off";
    if (st !== this.state) {
      this.state = st;
      if (P && P.pos.distanceTo(this.p) < 9) ev.push({ type: "sfx", name: "phase" });
    }
  }
  reset() {}
}

/* ================================================================
 * 떨어지는 것: 수정 고드름(가까이 가면) · 낙석(주기적으로)
 *  흔들림 + 바닥에 차오르는 그림자 원으로 미리 알림
 * ============================================================== */
export class Dropper {
  constructor(c, x, y, z, { h = 7, mode = "trigger", period = 3.4, phase = 0, trigger = 5.5, look = "crystal", r = 0.75, warn = 0.85 } = {}) {
    this.kind = "drop";
    Object.assign(this, { x, y, z, h, mode, period, trigger, look, r, warn });
    this.c = c;
    const M = c.M;
    const g = new THREE.Group();
    if (look === "crystal") {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(r * 0.75, 2.2, 6), M.crystal2);
      sp.rotation.x = Math.PI;
      sp.position.y = -1.1;
      g.add(sp);
      for (let i = 0; i < 3; i++) {
        const s2 = new THREE.Mesh(new THREE.ConeGeometry(r * 0.3, 1.0, 5), M.crystal);
        s2.rotation.set(Math.PI + (i - 1) * 0.4, 0, (i - 1) * 0.3);
        s2.position.set((i - 1) * r * 0.5, -0.4, 0);
        g.add(s2);
      }
    } else {
      const geo = new THREE.DodecahedronGeometry(r, 1);
      const p = geo.getAttribute("position");
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 3.1) * 0.12), p.getY(i) * 0.85, p.getZ(i) * (1 + Math.cos(i * 2.3) * 0.12));
      geo.computeVertexNormals();
      shadeVerts(geo, { bottom: 0.6 });
      const rk = new THREE.Mesh(geo, M.rock);
      g.add(rk);
    }
    shadowAll(g);
    g.userData.noCull = true;
    c.root.add(g);
    this.g = g;
    // 매달린 곳 (동굴 천장 바위)
    if (look === "crystal") {
      const anchor = new THREE.Mesh(shadeVerts(new THREE.DodecahedronGeometry(1.0, 1), { bottom: 0.5 }), M.rock);
      anchor.scale.set(1.3, 0.6, 1.3);
      anchor.position.set(x, y + h + 0.4, z);
      c.root.add(anchor);
    }
    this.disc = warnDisc(r + 0.35, look === "crystal" ? "#ff4ad8" : "#ff4a3a");
    this.disc.position.set(x, y + 0.04, z);
    c.root.add(this.disc);
    this.t = -phase * period;
    this.reset();
    c.mechs.push(this);
  }
  reset() {
    this.state = this.mode === "timer" ? "wait" : "idle";
    this.st = 0;
    this.vy = 0;
    this.py = this.y + this.h;
    this.g.position.set(this.x, this.py, this.z);
    this.g.visible = this.mode !== "timer";
    this.g.scale.setScalar(1);
    this.disc.set(0, false);
  }
  /** 지금 이 자리가 위험한가 (봇용): 경고 중이거나 떨어지는 중 */
  get danger() {
    return this.state === "warn" || this.state === "fall";
  }
  update(dt, P, ev, playing) {
    this.st += dt;
    const near = P && P.pos.distanceTo(V(this.x, this.y, this.z)) < 20;
    if (this.state === "idle") {
      this.g.position.set(this.x, this.py, this.z);
      if (P && playing && Math.hypot(P.pos.x - this.x, P.pos.z - this.z) < this.trigger && P.pos.y > this.y - 2) this.go("warn", ev, near);
    } else if (this.state === "wait") {
      this.t += dt;
      const k = ((this.t % this.period) + this.period) % this.period;
      if (k > this.period - this.warn - 0.05) this.go("warn", ev, near);
    } else if (this.state === "warn") {
      const k = this.st / this.warn;
      this.g.visible = true;
      this.g.position.set(this.x + Math.sin(this.st * 60) * 0.06, this.py, this.z + Math.cos(this.st * 47) * 0.05);
      this.disc.set(Math.min(1, k));
      if (this.mode === "timer" && Math.random() < dt * 12) this.c.fx.debris(V(this.x, this.py + 0.4, this.z), 1, { color: "#a08070", up: 0, spread: 0.6, size: 0.5 });
      if (this.st >= this.warn) this.go("fall", ev, near);
    } else if (this.state === "fall") {
      this.vy -= 30 * dt;
      const ny = this.g.position.y + this.vy * dt;
      this.g.position.set(this.x, ny, this.z);
      this.disc.set(1);
      if (P && playing && !P.invulnerable) {
        const dh = Math.hypot(P.pos.x - this.x, P.pos.z - this.z);
        if (dh < this.r + 0.3 && ny < P.pos.y + 1.3 && ny + (this.look === "crystal" ? 2.2 : this.r) > P.pos.y) {
          ev.push({ type: "hurt", from: V(this.x, P.pos.y, this.z + 0.01), power: 5, p: V(P.pos.x, P.pos.y + 1, P.pos.z) });
        }
      }
      if (ny <= this.y) this.go("smash", ev, near);
    } else if (this.state === "smash") {
      if (this.st > (this.mode === "timer" ? 0.2 : 3.5)) this.go(this.mode === "timer" ? "wait" : "regrow", ev, near);
    } else if (this.state === "regrow") {
      const k = Math.min(1, this.st / 0.8);
      this.g.visible = true;
      this.g.position.set(this.x, this.py, this.z);
      this.g.scale.setScalar(Math.max(0.01, k));
      if (k >= 1 && (!P || Math.hypot(P.pos.x - this.x, P.pos.z - this.z) > this.trigger + 1)) this.go("idle", ev, near);
    }
  }
  go(s, ev, near) {
    this.state = s;
    this.st = 0;
    if (s === "warn" && near) ev.push({ type: "sfx", name: this.look === "crystal" ? "crack" : "rumble" });
    if (s === "fall") this.vy = -2;
    if (s === "smash") {
      this.g.visible = false;
      this.disc.set(0, false);
      const p = V(this.x, this.y + 0.3, this.z);
      if (this.look === "crystal") this.c.fx.sparkle(p, 22, ["#9af4ff", "#e0a0ff", "#ffffff"], 4);
      this.c.fx.debris(p, 6, { color: this.look === "crystal" ? "#8ae0ff" : "#9a7060", up: 4, spread: 1.4 });
      this.c.fx.puff(p.x, p.y, p.z, 1.0, 4, this.look === "crystal" ? "#c8b8ff" : "#d8b8a0");
      if (near) ev.push({ type: "sfx", name: this.look === "crystal" ? "shatter" : "rockFall" });
    }
    if (s === "wait") {
      this.py = this.y + this.h;
      this.g.visible = false;
      this.g.scale.setScalar(1);
    }
    if (s === "regrow") {
      this.py = this.y + this.h;
      this.g.scale.setScalar(0.01);
    }
  }
}

/* ================================================================
 * 돌아가는 수정 빛줄기 (낮게 돌아가므로 뛰어넘기 · 닿으면 다침)
 * ============================================================== */
export class Beam {
  constructor(c, x, y, z, { len = 3.2, speed = 1.4, h = 0.5, arms = 1, phase = 0, color = "#ff5ad8" } = {}) {
    this.kind = "beam";
    const M = c.M;
    Object.assign(this, { x, y, z, len, speed, h, arms });
    this.ang = phase;
    const ped = new THREE.Group();
    const base = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(0.5, 0.65, 0.35, 6), { bottom: 0.5 }), M.stone);
    base.position.y = 0.17;
    ped.add(base);
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.5, 6), M.crystal);
    cr.position.y = 1.0;
    ped.add(cr);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), M.crystal);
    tip.position.y = 2.0;
    ped.add(tip);
    ped.position.set(x, y, z);
    const pm = mergeByMaterial(ped);
    shadowAll(pm);
    c.root.add(pm);
    c.box(x - 0.3, x + 0.3, y, y + 2.2, z - 0.3, z + 0.3);
    this.rot = new THREE.Group();
    this.rot.position.set(x, y + h, z);
    const bm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < arms; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i / arms) * TAU;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 8), bm);
      beam.rotation.z = Math.PI / 2;
      beam.position.x = len / 2;
      arm.add(beam);
      const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, len, 10), bm.clone());
      outer.material.opacity = 0.25;
      outer.rotation.z = Math.PI / 2;
      outer.position.x = len / 2;
      arm.add(outer);
      const end = glow(color, 1.1, 0.9);
      end.position.x = len;
      arm.add(end);
      this.rot.add(arm);
    }
    const coreGlow = glow(color, 1.6, 0.7);
    this.rot.add(coreGlow);
    c.root.add(this.rot);
    this.p = V(x, y, z);
    c.mechs.push(this);
  }
  /** 팔 i 의 끝 */
  end(i, ang = this.ang) {
    const a = ang + (i / this.arms) * TAU;
    return V(this.x + Math.cos(a) * this.len, this.y + this.h, this.z - Math.sin(a) * this.len);
  }
  /** 주인공이 팔에서 얼마나 떨어져 있나 (가로) */
  dist(P, ang = this.ang) {
    let best = 99;
    for (let i = 0; i < this.arms; i++) {
      const e = this.end(i, ang);
      const d = segDist(V(P.pos.x, 0, P.pos.z), V(this.x, 0, this.z), V(e.x, 0, e.z));
      best = Math.min(best, d);
    }
    return best;
  }
  update(dt, P, ev, playing) {
    this.ang += this.speed * dt;
    this.rot.rotation.y = this.ang;
    if (!P || !playing || P.invulnerable) return;
    const by = this.y + this.h;
    if (P.pos.y > by + 0.12 || P.pos.y + 1.0 < by - 0.12) return;
    if (this.dist(P) < 0.42) {
      const tx = -Math.sin(this.ang) * Math.sign(this.speed);
      const tz = -Math.cos(this.ang) * Math.sign(this.speed);
      ev.push({ type: "hurt", from: V(P.pos.x - tx, P.pos.y, P.pos.z - tz), power: 5, p: V(P.pos.x, by, P.pos.z) });
    }
  }
  reset() {}
}

/* ================================================================
 * 번개: 바닥 원이 노랗게 차오르면 꽝 (원 밖으로 피하기)
 * ============================================================== */
export class Lightning {
  constructor(c, spots, { r = 1.5, period = 2.8, warn = 1.15, offsets = null } = {}) {
    this.kind = "bolt";
    this.c = c;
    Object.assign(this, { r, period, warn });
    this.t = 0;
    this.spots = spots.map(([x, y, z], i) => {
      const disc = warnDisc(r, "#ffe24a");
      disc.position.set(x, y + 0.05, z);
      c.root.add(disc);
      // 번개 줄기 (지그재그 관)
      const pts = [];
      let px = 0;
      let pz = 0;
      for (let k = 0; k <= 9; k++) {
        pts.push(V(px, 22 - k * (22 / 9), pz));
        px = (Math.random() - 0.5) * 1.6;
        pz = (Math.random() - 0.5) * 1.6;
      }
      pts[pts.length - 1].set(0, 0, 0);
      const bolt = new THREE.Mesh(taperTube(pts, (t) => 0.1 + t * 0.06, 40, 5), new THREE.MeshBasicMaterial({ color: "#f4f8ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      bolt.position.set(x, y, z);
      c.root.add(bolt);
      const fl = glow("#cfe0ff", 7, 0);
      fl.position.set(x, y + 1, z);
      c.root.add(fl);
      return { x, y, z, disc, bolt, fl, off: offsets ? offsets[i] : i / spots.length, hot: 0 };
    });
    c.mechs.push(this);
  }
  left(s, t = this.t) {
    const k = (((t / this.period + s.off) % 1) + 1) % 1;
    return (1 - k) * this.period;
  }
  /** 이 지점이 곧 위험한가 (봇용) */
  dangerAt(x, z, ahead = 0) {
    for (const s of this.spots) {
      if (Math.hypot(x - s.x, z - s.z) > this.r + 0.5) continue;
      const l = this.left(s);
      if (l < this.warn + ahead || s.hot > 0) return true;
    }
    return false;
  }
  update(dt, P, ev, playing) {
    const prevT = this.t;
    this.t += dt;
    for (const s of this.spots) {
      const before = this.left(s, prevT);
      const l = this.left(s);
      const near = P && Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 22;
      if (l < this.warn) s.disc.set(1 - l / this.warn);
      else if (s.hot <= 0) s.disc.set(0, false);
      if (before < this.warn * 0.5 && l > before) {
        // 꽝!
        s.hot = 0.18;
        s.bolt.material.opacity = 1;
        s.bolt.rotation.y = Math.random() * TAU;
        s.fl.material.opacity = 0.9;
        if (near) {
          ev.push({ type: "sfx", name: "zap" });
          ev.push({ type: "shake", k: 0.25 });
        }
        this.c.fx.sparkle(V(s.x, s.y + 0.3, s.z), 26, ["#ffffff", "#ffe24a", "#9ad8ff"], 6);
        this.c.fx.puff(s.x, s.y + 0.2, s.z, 1.0, 3, "#c8d0e0");
        if (this.c.world) this.c.world.flash = Math.max(this.c.world.flash || 0, 0.5);
      }
      if (s.hot > 0) {
        s.hot -= dt;
        s.disc.set(1);
        if (P && playing && !P.invulnerable && Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < this.r && P.pos.y < s.y + 3 && P.pos.y > s.y - 0.6) {
          ev.push({ type: "hurt", from: V(s.x, P.pos.y, s.z + 0.01), power: 6, p: V(P.pos.x, P.pos.y + 1, P.pos.z) });
        }
      } else {
        s.bolt.material.opacity = Math.max(0, s.bolt.material.opacity - dt * 8);
      }
      s.fl.material.opacity = Math.max(0, s.fl.material.opacity - dt * 3);
    }
  }
  reset() {
    for (const s of this.spots) s.hot = 0;
  }
}

/* ================================================================
 * 튀어나오는 가시: 내려감 → 덜컥(끝이 살짝 보임) → 솟음 → 들어감
 * ============================================================== */
export class Spikes {
  constructor(c, x, y, z, w, l, { up = 1.1, down = 1.9, warn = 0.6, phase = 0 } = {}) {
    this.kind = "spike";
    const mm = mechMats(c);
    Object.assign(this, { x, y, z, w, l, up, down, warn });
    this.cyc = up + down + warn;
    this.t = phase * this.cyc;
    const plate = new THREE.Mesh(shadeVerts(roundedBox(w, 0.08, l, 0.02)), mm.iron);
    plate.position.set(x, y - 0.03, z);
    plate.receiveShadow = true;
    c.root.add(plate);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.04, l + 0.16), mm.hazard);
    rim.position.set(x, y - 0.05, z);
    c.root.add(rim);
    // 가시들 (한 덩어리)
    const sg = new THREE.Group();
    const nx = Math.max(2, Math.round(w / 0.42));
    const nz = Math.max(2, Math.round(l / 0.42));
    for (let i = 0; i < nx; i++)
      for (let k = 0; k < nz; k++) {
        const cone = new THREE.Mesh(shadeVerts(new THREE.ConeGeometry(0.11, 0.6, 6), { bottom: 0.6 }), mm.iron);
        cone.position.set(-w / 2 + (i + 0.5) * (w / nx), 0.3, -l / 2 + (k + 0.5) * (l / nz));
        sg.add(cone);
      }
    const spikes = mergeByMaterial(sg);
    spikes.position.set(x, y - 0.62, z);
    shadowAll(spikes);
    c.root.add(spikes);
    this.spikes = spikes;
    this.p = V(x, y, z);
    this.state = "down";
    c.mechs.push(this);
  }
  phaseAt(t) {
    const k = ((t % this.cyc) + this.cyc) % this.cyc;
    if (k < this.down) return { s: "down", left: this.down - k };
    if (k < this.down + this.warn) return { s: "warn", left: this.down + this.warn - k };
    return { s: "up", left: this.cyc - k };
  }
  /** 지금부터 안전한 시간 (봇용) */
  get safeFor() {
    const ph = this.phaseAt(this.t);
    return ph.s === "down" ? ph.left : 0;
  }
  inside(P, pad = 0) {
    return Math.abs(P.pos.x - this.x) < this.w / 2 + pad && Math.abs(P.pos.z - this.z) < this.l / 2 + pad;
  }
  update(dt, P, ev, playing) {
    this.t += dt;
    const ph = this.phaseAt(this.t);
    let hgt = -0.62;
    if (ph.s === "warn") hgt = -0.45 + Math.sin(this.t * 40) * 0.02;
    else if (ph.s === "up") {
      const into = this.up - ph.left;
      hgt = into < 0.1 ? -0.45 + (into / 0.1) * 0.45 : ph.left < 0.2 ? -0.62 * (1 - ph.left / 0.2) : 0;
    }
    this.spikes.position.y = this.y + hgt;
    const near = P && P.pos.distanceTo(this.p) < 14;
    if (ph.s !== this.state) {
      if (ph.s === "warn" && near) ev.push({ type: "sfx", name: "chain" });
      if (ph.s === "up" && near) ev.push({ type: "sfx", name: "spike" });
      this.state = ph.s;
    }
    if (ph.s === "up" && hgt > -0.3 && P && playing && !P.invulnerable && this.inside(P, 0.1) && P.pos.y < this.y + 0.55 && P.pos.y > this.y - 0.4) {
      ev.push({ type: "hurt", from: V(P.pos.x, P.pos.y, P.pos.z + 1), power: 4, p: V(P.pos.x, this.y + 0.4, P.pos.z) });
    }
  }
  reset() {}
}

/* ================================================================
 * 바람 구역 (앞바람 · 번갈아 부는 옆바람): course.winds 에 들어가 windAt 에서 더해진다
 * ============================================================== */
export class WindZone {
  constructor(c, zone, dir, { strength = 3, on = 2.2, off = 1.6, warn = 0.8, phase = 0, always = false } = {}) {
    this.kind = "wind";
    this.c = c;
    this.zone = zone;
    this.dir = dir.clone().setY(0).normalize();
    Object.assign(this, { strength, on, off, warn, always });
    this.cyc = on + off;
    this.t = phase * this.cyc;
    this.power = always ? 1 : 0;
    // 바람 줄무늬 (바닥 가까이 흐르는 투명 띠 2장)
    const g = new THREE.Group();
    g.position.set((zone.x0 + zone.x1) / 2, zone.y0 + 0.4, (zone.z0 + zone.z1) / 2);
    g.rotation.y = Math.atan2(this.dir.x, this.dir.z);
    const along = Math.abs(this.dir.x) > Math.abs(this.dir.z) ? zone.x1 - zone.x0 : zone.z1 - zone.z0;
    const across = Math.abs(this.dir.x) > Math.abs(this.dir.z) ? zone.z1 - zone.z0 : zone.x1 - zone.x0;
    this.streaks = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({ map: windTex().clone(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      m.map.needsUpdate = true;
      m.map.repeat.set(1, along / 8);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(across * 0.9, along), m);
      pl.rotation.x = -Math.PI / 2;
      pl.position.y = i * 0.7;
      g.add(pl);
      this.streaks.push(pl);
    }
    c.root.add(g);
    this.state = "off";
    c.winds.push(this);
    c.mechs.push(this);
  }
  /** 지금 상태 + 남은 시간 */
  phaseAt(t = this.t) {
    if (this.always) return { s: "on", left: 99 };
    const k = ((t % this.cyc) + this.cyc) % this.cyc;
    if (k < this.off - this.warn) return { s: "off", left: this.off - this.warn - k };
    if (k < this.off) return { s: "warn", left: this.off - k };
    return { s: "on", left: this.cyc - k };
  }
  update(dt, P, ev) {
    this.t += dt;
    const ph = this.phaseAt();
    const near = P && P.pos.x > this.zone.x0 - 10 && P.pos.x < this.zone.x1 + 10 && P.pos.z > this.zone.z0 - 14 && P.pos.z < this.zone.z1 + 14;
    if (ph.s !== this.state) {
      if (ph.s === "warn" && near) ev.push({ type: "sfx", name: "gustWarn" });
      if (ph.s === "on" && near && !this.always) ev.push({ type: "sfx", name: "gust" });
      this.state = ph.s;
    }
    const target = ph.s === "on" ? 1 : 0;
    this.power += (target - this.power) * Math.min(1, dt * 6);
    for (const [i, s] of this.streaks.entries()) {
      s.material.opacity = this.power * 0.4 + (ph.s === "warn" ? 0.1 + Math.sin(this.t * 20) * 0.05 : 0);
      s.material.map.offset.y += dt * (0.5 + this.power * 2.4) * (i % 2 ? 1 : 1.3);
    }
    if (this.power > 0.5 && Math.random() < dt * 24) {
      const z = this.zone;
      const x = z.x0 + Math.random() * (z.x1 - z.x0);
      const zz = z.z0 + Math.random() * (z.z1 - z.z0);
      this.c.fx.windMote(x, z.y0 + 0.3 + Math.random() * 2, zz, this.dir.x * 9, 0, this.dir.z * 9);
    }
  }
  reset() {}
}
