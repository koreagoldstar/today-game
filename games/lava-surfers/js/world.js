/*
 * 용암 서핑 · 배경 세계
 *  연기 낀 붉은 하늘 · 먼 화산(분화구 빛 · 연기 기둥 · 가끔 분출) · 먼 산 능선 · 빛 · 화산재 · 불티
 *  빛: 위에서 연기에 가린 해 + 아래에서 올라오는 용암 빛 (바위 아랫면이 주황으로)
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { shadeVerts, fbm3 } from "./geo.js?v=2";
import { dotTex, puffTex, cliffTex, seeded } from "./tex.js?v=2";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

export const PAL = {
  skyTop: "#2c1832",
  skyMid: "#6e2a36",
  skyLow: "#d0542e",
  horizon: "#ff9a4a",
  fog: "#6a3032",
  sun: "#ffc890",
};

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PAL.skyTop) },
      mid: { value: new THREE.Color(PAL.skyMid) },
      low: { value: new THREE.Color(PAL.skyLow) },
      hor: { value: new THREE.Color(PAL.horizon) },
      sunD: { value: V(0.35, 0.22, -0.9).normalize() },
      t: { value: 0 },
    },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `
      uniform vec3 top, mid, low, hor, sunD; uniform float t; varying vec3 vP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 c = h > 0.3 ? mix(mid, top, smoothstep(0.3, 0.9, h)) : h > 0.04 ? mix(low, mid, smoothstep(0.04, 0.3, h)) : mix(hor, low, smoothstep(-0.1, 0.04, h));
        // 연기 띠 (천천히 흐름)
        vec2 q = vec2(atan(d.x, d.z) * 3.0 + t * 0.01, h * 6.0);
        float sm = n2(q * 2.0) * 0.6 + n2(q * 5.0) * 0.4;
        c = mix(c, c * 0.55, smoothstep(0.45, 0.8, sm) * smoothstep(0.05, 0.5, h));
        float s = max(0.0, dot(d, normalize(sunD)));
        c += vec3(1.0, 0.7, 0.45) * (pow(s, 8.0) * 0.25 + pow(s, 90.0) * 0.5);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

export class World {
  constructor(renderer, scene, { quality = 1 } = {}) {
    this.r = renderer;
    this.scene = scene;
    this.q = quality;
    this.t = 0;
    this.anim = [];
    this.stageAnim = [];
    this.stageRoot = new THREE.Group();
    scene.add(this.stageRoot);
    this.build();
  }
  build() {
    const scene = this.scene;
    scene.fog = new THREE.Fog(PAL.fog, 70, 420);
    this.hemi = new THREE.HemisphereLight("#ffc0a0", "#4a2020", 1.1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(PAL.sun, 2.5);
    this.sun.castShadow = true;
    const sz = this.q >= 0.95 ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    Object.assign(this.sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sunDir = V(0.35, 0.75, 0.45).normalize();
    scene.add(this.sun, this.sun.target);
    // 아래에서 올라오는 용암 빛
    this.lavaLight = new THREE.DirectionalLight("#ff6a2a", 1.3);
    this.lavaLight.position.set(0, -1, 0.2);
    scene.add(this.lavaLight, this.lavaLight.target);
    this.rim = new THREE.DirectionalLight("#ff9a6a", 0.6);
    this.rim.position.set(-20, 10, -40);
    scene.add(this.rim);
    // 카메라를 따라가는 먼 배경
    this.far = new THREE.Group();
    scene.add(this.far);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(520, 40, 20), skyMaterial());
    this.sky.renderOrder = -10;
    this.far.add(this.sky);
    // 먼 산 능선 (어두운 실루엣 · 세 겹)
    for (let k = 0; k < 3; k++) {
      const n = 120;
      const pos = [];
      const idx = [];
      const R = 380 - k * 60;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU;
        const h = 30 + k * 10 + fbm3(Math.cos(a) * 3 + k * 7, Math.sin(a) * 3, k, 4) * (70 - k * 12);
        pos.push(Math.cos(a) * R, -60, Math.sin(a) * R, Math.cos(a) * R, h - 60, Math.sin(a) * R);
        if (i < n) {
          const b = i * 2;
          idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const col = ["#2a1418", "#3a1a1e", "#4e2224"][k];
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, fog: false, side: THREE.DoubleSide }));
      this.far.add(m);
    }
    // 화산재 (내려옴) · 불티 (올라감)
    this.ash = this.makePoints(this.q >= 0.95 ? 700 : 380, "#c8b8b0", 0.12, 0.7);
    this.embers = this.makePoints(this.q >= 0.95 ? 220 : 120, "#ffb05a", 0.16, 0.9, true);
    this.flash = 0;
    this.bolt = 0;
    this.hemiBase = 1.1;
    // 번개 (폭풍 스테이지): 먼 하늘에 지그재그 빛줄기
    this.boltLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: "#e8f0ff", transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.boltLine.frustumCulled = false;
    this.far.add(this.boltLine);
  }
  /** 스테이지 분위기 바꾸기 (하늘 · 안개 · 빛 · 재 · 불티) — 스테이지 꾸밈(화산 등)은 비움 */
  applyTheme(th) {
    this.th = th;
    const u = this.sky.material.uniforms;
    u.top.value.set(th.sky[0]);
    u.mid.value.set(th.sky[1]);
    u.low.value.set(th.sky[2]);
    u.hor.value.set(th.sky[3]);
    const fog = this.scene.fog;
    fog.color.set(th.fog[0]);
    fog.near = th.fog[1];
    fog.far = th.fog[2];
    this.fogBase = [th.fog[1], th.fog[2]];
    this.hemi.color.set(th.hemi[0]);
    this.hemi.groundColor.set(th.hemi[1]);
    this.hemiBase = th.hemi[2];
    this.sun.color.set(th.sun[0]);
    this.sun.intensity = th.sun[1];
    this.lavaLight.color.set(th.lavaLight[0]);
    this.lavaLight.intensity = th.lavaLight[1];
    this.ash.material.opacity = 0.7 * Math.min(1.4, th.ash);
    this.ash.visible = th.ash > 0;
    this.embers.material.opacity = 0.9 * Math.min(1.2, th.embers);
    this.embers.visible = th.embers > 0;
    this.storm = !!th.storm;
    this.boltT = 2;
    this.tintTo = null;
    this.clearStage();
  }
  /** 하늘 · 안개 · 빛을 다른 분위기로 천천히 바꾸기 (보스 체력 단계 등) */
  tint(th) {
    if (!th) return;
    this.tintTo = th;
    this.tintK = 0;
    const u = this.sky.material.uniforms;
    this.tintFrom = {
      sky: [u.top.value.clone(), u.mid.value.clone(), u.low.value.clone(), u.hor.value.clone()],
      fog: this.scene.fog.color.clone(),
      hemi: [this.hemi.color.clone(), this.hemi.groundColor.clone()],
      lava: this.lavaLight.color.clone(),
    };
  }
  updateTint(dt) {
    if (!this.tintTo) return;
    this.tintK = Math.min(1, this.tintK + dt / 2.5);
    const k = this.tintK;
    const th = this.tintTo;
    const F = this.tintFrom;
    const u = this.sky.material.uniforms;
    const c = new THREE.Color();
    ["top", "mid", "low", "hor"].forEach((key, i) => u[key].value.copy(F.sky[i]).lerp(c.set(th.sky[i]), k));
    this.scene.fog.color.copy(F.fog).lerp(c.set(th.fog[0]), k);
    this.hemi.color.copy(F.hemi[0]).lerp(c.set(th.hemi[0]), k);
    this.hemi.groundColor.copy(F.hemi[1]).lerp(c.set(th.hemi[1]), k);
    this.lavaLight.color.copy(F.lava).lerp(c.set(th.lavaLight[0]), k);
    if (k >= 1) this.tintTo = null;
  }
  clearStage() {
    this.scene.remove(this.stageRoot);
    this.stageRoot.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.stageRoot = new THREE.Group();
    this.scene.add(this.stageRoot);
    this.stageAnim = [];
  }
  /** 번개 한 번 (폭풍): 먼 하늘 지그재그 + 화면 번쩍 */
  strike() {
    const a = Math.random() * Math.PI * 2;
    const R = 300 + Math.random() * 120;
    const x0 = Math.cos(a) * R;
    const z0 = Math.sin(a) * R;
    const pts = [];
    let x = x0;
    let z = z0;
    for (let y = 260; y > -40; y -= 22) {
      pts.push([x, y, z]);
      x += (Math.random() - 0.5) * 30;
      z += (Math.random() - 0.5) * 30;
    }
    const P = [];
    const I = [];
    pts.forEach(([px, py, pz], i) => {
      const w = 2.2 - (i / pts.length) * 1.4;
      // 가운데(카메라)를 바라보도록 폭 방향 = 반지름에 수직
      const wx = (-z0 / R) * w;
      const wz = (x0 / R) * w;
      P.push(px - wx, py, pz - wz, px + wx, py, pz + wz);
      if (i) I.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
    });
    const g = this.boltLine.geometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setIndex(I);
    this.bolt = 1;
    this.thunder = true;
  }
  makePoints(n, color, size, op, additive = false) {
    const pos = new Float32Array(n * 3);
    const rnd = seeded(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 70;
      pos[i * 3 + 1] = (rnd() - 0.3) * 30;
      pos[i * 3 + 2] = (rnd() - 0.5) * 70;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex(), color, size, transparent: true, opacity: op, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    return pts;
  }
  /**
   * 먼 화산 (코스 쪽에서 보이는 큰 원뿔 + 분화구 빛 + 연기 기둥) — 세계 좌표에 고정
   */
  volcano(x, y, z, R = 160, H = 190) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const prof = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const r = R * (1 - t) + R * 0.16 * t;
      prof.push(new THREE.Vector2(r * (1 + Math.sin(t * 9) * 0.02), t * H));
    }
    prof.push(new THREE.Vector2(R * 0.12, H * 0.96));
    prof.push(new THREE.Vector2(R * 0.02, H * 0.9));
    const geo = new THREE.LatheGeometry(prof, 64);
    const p = geo.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i);
      const vy = p.getY(i);
      const vz = p.getZ(i);
      const n = fbm3(vx * 0.02, vy * 0.02, vz * 0.02, 4) - 0.5;
      const k = 1 + n * 0.22;
      p.setXYZ(i, vx * k, vy + n * 10, vz * k);
    }
    geo.computeVertexNormals();
    shadeVerts(geo, { top: 0.6, bottom: 1 });
    const tex = cliffTex().clone();
    tex.needsUpdate = true;
    tex.repeat.set(10, 4);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.95 }));
    g.add(m);
    // 흘러내리는 용암 줄기 (빛나는 띠)
    const lm = new THREE.MeshBasicMaterial({ color: "#ff7a2a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 5; i++) {
      const a = 0.5 + i * 0.35 + (i % 2) * 0.2;
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const r = R * 0.15 + (R - R * 0.15) * t;
        const yy = H * 0.95 * (1 - t);
        pts.push(V(Math.sin(a + Math.sin(t * 6 + i) * 0.04) * r * 1.01, yy, Math.cos(a + Math.sin(t * 6 + i) * 0.04) * r * 1.01));
      }
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 1.6 + (i % 3), 5, false);
      g.add(new THREE.Mesh(tube, lm));
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ff7a3a", transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.position.y = H * 1.0;
    glow.scale.setScalar(R * 1.1);
    g.add(glow);
    // 연기 기둥 (여러 장의 연기 스프라이트가 위로 올라가며 커짐)
    const smoke = [];
    const sm = new THREE.SpriteMaterial({ map: puffTex(), color: "#3a2a2e", transparent: true, opacity: 0.75, depthWrite: false, fog: false });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(sm.clone());
      s.userData.k = i / 14;
      g.add(s);
      smoke.push(s);
    }
    this.stageRoot.add(g);
    this.stageAnim.push((dt, t) => {
      glow.material.opacity = 0.75 + Math.sin(t * 1.7) * 0.15 + this.flash * 0.3;
      for (const s of smoke) {
        const k = (s.userData.k + t * 0.02) % 1;
        s.position.set(Math.sin(k * 5 + t * 0.1) * 20 * k + k * 60, H + k * 260, Math.cos(k * 3) * 10 * k);
        s.scale.setScalar(40 + k * 180);
        s.material.opacity = 0.7 * Math.sin(k * Math.PI);
        s.material.rotation = k * 2;
      }
    });
    return g;
  }
  update(dt, cam, focus) {
    this.t += dt;
    const t = this.t;
    this.far.position.set(cam.x, 0, cam.z);
    this.sky.material.uniforms.t.value = t;
    for (const f of this.anim) f(dt, t);
    for (const f of this.stageAnim) f(dt, t);
    this.updateTint(dt);
    if (this.storm) {
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = 3 + Math.random() * 5;
        this.strike();
      }
    }
    if (this.bolt > 0) {
      this.bolt = Math.max(0, this.bolt - dt * 3);
      this.boltLine.material.opacity = this.bolt > 0.6 || (this.bolt > 0.25 && this.bolt < 0.4) ? 1 : 0;
    }
    if (focus) {
      this.sun.target.position.copy(focus);
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 70);
      this.sun.target.updateMatrixWorld();
      this.lavaLight.target.position.copy(focus);
      this.lavaLight.position.copy(focus).add(V(0, -30, 6));
      this.lavaLight.target.updateMatrixWorld();
      // 재 · 불티: 카메라 둘레에서 흐름
      for (const [pts, vy] of [
        [this.ash, -1.2],
        [this.embers, 2.4],
      ]) {
        const p = pts.geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) + vy * dt;
          if (y < -10) y += 30;
          if (y > 20) y -= 30;
          p.setY(i, y);
          p.setX(i, p.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.6);
        }
        p.needsUpdate = true;
        pts.position.set(cam.x, cam.y - 4, cam.z);
      }
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.5);
    this.hemi.intensity = this.hemiBase + this.flash * 0.6 + (this.bolt > 0.5 ? 1.4 : 0);
  }
  dispose() {}
}
