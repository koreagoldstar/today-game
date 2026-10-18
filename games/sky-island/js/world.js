/*
 * 하늘섬 대탈출 · 배경 세계
 *  노을 하늘(그라데이션 · 해 · 달) · 구름 바다(뭉게구름 인스턴스) · 멀리 떠 있는 섬 · 성 · 폭포 · 비행선 · 깃발 · 빛
 *  카메라를 따라 움직이는 '먼 배경'과, 코스 옆에 고정된 '가까운 배경'으로 나눈다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { islandGeo, roundedBox, taperTube, ropeGeo, fbm3, shadeVerts, mergeByMaterial } from "./geo.js?v=1";
import { grassTex, rockTex, plankTex, waterfallTex, dotTex, puffTex, flagTex, cloudFloorTex, seeded } from "./tex.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

/* ---------------- 색 ---------------- */
export const PAL = {
  skyTop: "#4f63c4",
  skyMid: "#a99be2",
  skyLow: "#ffb6b0",
  horizon: "#ffd9a8",
  fog: "#e9c6d4",
  sun: "#ffe6c4",
  hemiSky: "#f4e4ff",
  hemiGround: "#8a7a8e",
  cloudLit: "#fff4ee",
  cloudShade: "#b8a6d6",
};

/* ---------------- 스테이지 테마 (하늘 · 빛 · 안개 · 구름 · 날씨) ---------------- */
export const THEMES = {
  // 1 구름 마을: 노을
  sunset: { skyTop: "#4f63c4", skyMid: "#a99be2", skyLow: "#ffb6b0", horizon: "#ffd9a8", sun: "#ffe6c4", sunDir: [-0.55, 0.32, -0.75], fog: "#e9c6d4", fogNear: 70, fogFar: 420, hemiSky: "#f4e4ff", hemiGround: "#8a7a8e", hemiI: 1.05, sunI: 2.7, fill: "#b8a8ff", fillI: 0.55, rim: "#ffc8e0", rimI: 0.8, cloud: "#ffffff", cloudE: "#ffd8e8", cloudEI: 0.18, floor: "#f2e2f0", motes: "#fff2c8", exposure: 1.08, moon: true },
  // 2 바람 협곡: 맑은 낮 하늘 · 붉은 바위
  canyon: { skyTop: "#3a7ee0", skyMid: "#79b8ee", skyLow: "#cfe6f6", horizon: "#fff0d8", sun: "#fff3d6", sunDir: [0.4, 0.62, -0.67], fog: "#d6e2ec", fogNear: 80, fogFar: 460, hemiSky: "#eaf4ff", hemiGround: "#c08a64", hemiI: 1.1, sunI: 3.0, fill: "#a8c8ff", fillI: 0.5, rim: "#ffe2c0", rimI: 0.7, cloud: "#ffffff", cloudE: "#fff4e8", cloudEI: 0.1, floor: "#f4f6fa", motes: "#fff6d8", exposure: 1.0, moon: false },
  // 3 공중 항구: 황금빛 늦은 오후
  harbor: { skyTop: "#4f6ec8", skyMid: "#e8b08e", skyLow: "#ffd1a0", horizon: "#ffe6a8", sun: "#ffd89a", sunDir: [0.62, 0.24, -0.74], fog: "#f2ceb2", fogNear: 70, fogFar: 430, hemiSky: "#fff0e0", hemiGround: "#9c7868", hemiI: 1.05, sunI: 2.9, fill: "#c0a8ff", fillI: 0.5, rim: "#ffd0a0", rimI: 0.9, cloud: "#fff6ec", cloudE: "#ffd2a8", cloudEI: 0.18, floor: "#f6e6da", motes: "#ffe8b8", exposure: 1.05, moon: false },
  // 4 수정 구름 동굴: 어두운 보랏빛 · 빛나는 수정
  cave: { skyTop: "#120a28", skyMid: "#25174a", skyLow: "#3a2a6c", horizon: "#4c3c86", sun: "#c8a8ff", sunDir: [0.15, 0.85, -0.3], fog: "#2a2052", fogNear: 28, fogFar: 175, hemiSky: "#9a8ae8", hemiGround: "#2a1a3c", hemiI: 1.0, sunI: 1.3, fill: "#5ae0ff", fillI: 0.7, rim: "#ff7ad8", rimI: 0.9, cloud: "#8070c0", cloudE: "#5a3aa8", cloudEI: 0.35, floor: "#3a2a5c", motes: "#9af4ff", exposure: 1.18, moon: false, stars: true },
  // 5 폭풍의 하늘성: 밤 · 비 · 번개
  storm: { skyTop: "#121828", skyMid: "#262c44", skyLow: "#363c54", horizon: "#54566c", sun: "#b0c0e8", sunDir: [-0.3, 0.62, -0.72], fog: "#2c3244", fogNear: 40, fogFar: 230, hemiSky: "#7080a8", hemiGround: "#2a2a34", hemiI: 1.0, sunI: 1.5, fill: "#7a8ab8", fillI: 0.55, rim: "#c8d8ff", rimI: 0.8, cloud: "#5c6280", cloudE: "#1e2438", cloudEI: 0.2, floor: "#3a3e50", motes: "#c8d8ff", exposure: 1.15, moon: false, rain: true, lightning: true },
  // 6 고대 용의 성: 붉은 저녁 · 극적인 빛
  dragon: { skyTop: "#281848", skyMid: "#863a68", skyLow: "#e45e48", horizon: "#ff9c5c", sun: "#ffa060", sunDir: [0.08, 0.2, -1], fog: "#743a58", fogNear: 60, fogFar: 330, hemiSky: "#ffb4a4", hemiGround: "#4a2a3a", hemiI: 0.95, sunI: 2.7, fill: "#8a6aff", fillI: 0.55, rim: "#ff6a4a", rimI: 1.0, cloud: "#e6a6b6", cloudE: "#ff6a5a", cloudEI: 0.22, floor: "#c08090", motes: "#ffb07a", exposure: 1.05, moon: false },
};

/* ---------------- 공용 재질 ---------------- */
export function makeMaterials() {
  const tex = (t, r = 1) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(r, r);
    return c;
  };
  return {
    grass: new THREE.MeshStandardMaterial({ map: tex(grassTex(), 1), roughness: 0.95, vertexColors: true }),
    rock: new THREE.MeshStandardMaterial({ map: rockTex(), roughness: 0.95, vertexColors: true }),
    wood: new THREE.MeshStandardMaterial({ map: plankTex(), roughness: 0.8, vertexColors: true }),
    woodDark: new THREE.MeshStandardMaterial({ color: "#6a4630", roughness: 0.85, vertexColors: true }),
    rope: new THREE.MeshStandardMaterial({ color: "#c8a878", roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#7ac25a", roughness: 0.85, vertexColors: true, flatShading: false }),
    leafDk: new THREE.MeshStandardMaterial({ color: "#4f9a48", roughness: 0.85, vertexColors: true }),
    trunk: new THREE.MeshStandardMaterial({ color: "#8a5e40", roughness: 0.9, vertexColors: true }),
    cap: new THREE.MeshStandardMaterial({ color: "#d8643e", roughness: 0.55, vertexColors: true }),
    capSpot: new THREE.MeshStandardMaterial({ color: "#fff3df", roughness: 0.6 }),
    stem: new THREE.MeshStandardMaterial({ color: "#f3e3c6", roughness: 0.8, vertexColors: true }),
    window: new THREE.MeshStandardMaterial({ color: "#ffd27a", emissive: "#ffb24a", emissiveIntensity: 1.2, roughness: 0.4 }),
    stone: new THREE.MeshStandardMaterial({ color: "#c2b2a8", roughness: 0.9, vertexColors: true }),
    roof: new THREE.MeshStandardMaterial({ color: "#5a6ac8", roughness: 0.6, vertexColors: true }),
    castle: new THREE.MeshStandardMaterial({ color: "#d9cfe6", roughness: 0.85, vertexColors: true }),
    cloth: new THREE.MeshStandardMaterial({ color: "#f3ead8", roughness: 0.9, vertexColors: true }),
    brass: new THREE.MeshStandardMaterial({ color: "#d9b35e", roughness: 0.3, metalness: 0.85 }),
    crystal: new THREE.MeshStandardMaterial({ color: "#c07aff", emissive: "#9a4aff", emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, flatShading: true }),
    crystal2: new THREE.MeshStandardMaterial({ color: "#5ae0ff", emissive: "#1ab0e0", emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, flatShading: true }),
    mushPink: new THREE.MeshStandardMaterial({ color: "#ff7ab8", emissive: "#ff4a9a", emissiveIntensity: 0.25, roughness: 0.5 }),
    flower: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.7, vertexColors: true }),
    lantern: new THREE.MeshStandardMaterial({ color: "#ffe0a0", emissive: "#ffb040", emissiveIntensity: 1.6, roughness: 0.4 }),
  };
}

/* ---------------- 하늘 (셰이더 돔) ---------------- */
function skyMaterial(sunDir, T = THEMES.sunset) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(T.skyTop) },
      mid: { value: new THREE.Color(T.skyMid) },
      low: { value: new THREE.Color(T.skyLow) },
      hor: { value: new THREE.Color(T.horizon) },
      sunC: { value: new THREE.Color(T.sun) },
      sunD: { value: sunDir.clone() },
    },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `
      uniform vec3 top, mid, low, hor, sunC, sunD; varying vec3 vP;
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 c = h > 0.32 ? mix(mid, top, smoothstep(0.32, 0.95, h)) : h > 0.06 ? mix(low, mid, smoothstep(0.06, 0.32, h)) : mix(hor, low, smoothstep(-0.12, 0.06, h));
        if (h < -0.12) c = mix(hor, vec3(0.93,0.84,0.9), smoothstep(-0.12, -0.5, h));
        float s = max(0.0, dot(d, normalize(sunD)));
        c += sunC * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

/* ---------------- 뭉게구름 덩어리 (공 여러 개를 합쳐 울퉁불퉁) ---------------- */
function cloudGeo(seed, n = 7, detail = 2) {
  const rnd = seeded(seed);
  const parts = [];
  const lit = new THREE.Color(PAL.cloudLit);
  const shade = new THREE.Color(PAL.cloudShade);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const r = 0.5 + rnd() * 0.6;
    const t = (i / (n - 1)) * 2 - 1;
    g.scale(r * 1.15, r * (0.8 + rnd() * 0.2), r);
    g.translate(t * 1.4 + (rnd() - 0.5) * 0.4, (1 - Math.abs(t)) * 0.45 + rnd() * 0.15, (rnd() - 0.5) * 0.7);
    parts.push(g);
  }
  // 합치기 + 부풀기 + 정점 색(위는 밝게, 아래는 보라 그늘)
  let total = 0;
  for (const g of parts) total += g.getAttribute("position").count;
  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  const v = V(0, 0, 0);
  for (const g of parts) {
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = fbm3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6, 2);
      v.multiplyScalar(1 + (n - 0.5) * 0.18);
      pos[o * 3] = v.x;
      pos[o * 3 + 1] = v.y;
      pos[o * 3 + 2] = v.z;
      const k = Math.max(0, Math.min(1, (v.y + 0.6) / 1.4));
      const c = shade.clone().lerp(lit, Math.pow(k, 0.8));
      col[o * 3] = c.r;
      col[o * 3 + 1] = c.g;
      col[o * 3 + 2] = c.b;
      o++;
    }
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/* ---------------- 나무 · 꽃 · 버섯 (섬 위 장식) ---------------- */
export function roundTree(M, h = 3, seed = 1) {
  const g = new THREE.Group();
  const rnd = seeded(seed);
  const trunk = new THREE.Mesh(taperTube([V(0, 0, 0), V(0.1, h * 0.4, 0), V(-0.05, h * 0.75, 0.05)], (t) => 0.22 * h * 0.12 * (1.4 - t * 0.6), 10, 8), M.trunk);
  shadeVerts(trunk.geometry, { bottom: 0.6 });
  g.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = h * 0.82;
  g.add(crown);
  for (let i = 0; i < 5; i++) {
    const r = h * (0.28 + rnd() * 0.12);
    const geo = new THREE.IcosahedronGeometry(r, 2);
    shadeVerts(geo, { bottom: 0.55, top: 1.1 });
    const m = new THREE.Mesh(geo, i % 2 ? M.leafDk : M.leaf);
    const a = (i / 5) * TAU + rnd();
    m.position.set(Math.cos(a) * h * 0.2, (rnd() - 0.3) * h * 0.25, Math.sin(a) * h * 0.2);
    crown.add(m);
  }
  const top = new THREE.Mesh(shadeVerts(new THREE.IcosahedronGeometry(h * 0.32, 2), { bottom: 0.6, top: 1.15 }), M.leaf);
  top.position.y = h * 0.2;
  crown.add(top);
  g.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
  return g;
}
export function mushroomHouse(M, s = 1, seed = 1) {
  const g = new THREE.Group();
  const stemGeo = new THREE.LatheGeometry(
    [
      [0, 0],
      [1.25, 0],
      [1.35, 0.4],
      [1.3, 1.6],
      [1.1, 2.4],
      [0, 2.45],
    ].map(([r, y]) => new THREE.Vector2(r * s, y * s)),
    28
  );
  shadeVerts(stemGeo, { bottom: 0.7 });
  const stem = new THREE.Mesh(stemGeo, M.stem);
  g.add(stem);
  const capGeo = new THREE.LatheGeometry(
    [
      [0, 3.9],
      [0.9, 3.75],
      [1.7, 3.3],
      [2.3, 2.6],
      [2.45, 2.15],
      [2.2, 2.05],
      [1.2, 2.3],
      [0, 2.35],
    ].map(([r, y]) => new THREE.Vector2(r * s, y * s)),
    32
  );
  shadeVerts(capGeo, { bottom: 0.65, top: 1.1 });
  const cap = new THREE.Mesh(capGeo, M.cap);
  g.add(cap);
  const rnd = seeded(seed);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU;
    const t = 0.25 + rnd() * 0.6;
    const r = (0.3 + t * 2.0) * s;
    const y = (3.9 - t * 1.6) * s;
    const spot = new THREE.Mesh(new THREE.SphereGeometry((0.18 + rnd() * 0.16) * s, 12, 8), M.capSpot);
    spot.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    spot.scale.set(1, 0.35, 1);
    spot.lookAt(spot.position.clone().multiplyScalar(2).setY(y + 2 * s));
    g.add(spot);
  }
  // 문 · 창문 (따뜻한 불빛)
  const door = new THREE.Mesh(roundedBox(0.75 * s, 1.15 * s, 0.2 * s, 0.3 * s), M.woodDark);
  door.position.set(0, 0.57 * s, 1.27 * s);
  g.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 8, 6), M.brass);
  knob.position.set(0.22 * s, 0.6 * s, 1.38 * s);
  g.add(knob);
  for (const a of [0.9, -0.95]) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.26 * s, 18), M.window);
    w.position.set(Math.sin(a) * 1.33 * s, 1.55 * s, Math.cos(a) * 1.33 * s);
    w.rotation.y = a;
    g.add(w);
    const fr = new THREE.Mesh(new THREE.TorusGeometry(0.27 * s, 0.05 * s, 6, 18), M.woodDark);
    fr.position.copy(w.position);
    fr.rotation.y = a;
    g.add(fr);
  }
  // 굴뚝
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.22 * s, 0.9 * s, 10), M.stone);
  ch.position.set(1.0 * s, 3.4 * s, -0.5 * s);
  g.add(ch);
  g.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
  return g;
}
export function flowers(M, n, R, seed = 1) {
  const g = new THREE.Group();
  const rnd = seeded(seed);
  const cols = ["#ffffff", "#ffd2e8", "#fff08a", "#c8b8ff", "#ff9a9a"];
  const geo = new THREE.IcosahedronGeometry(0.09, 0);
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const r = Math.sqrt(rnd()) * R;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.7 }));
    m.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
    m.scale.setScalar(0.7 + rnd() * 0.6);
    g.add(m);
  }
  return g;
}

/* ---------------- 폭포 (섬 가장자리에서 아래로) ---------------- */
export class Waterfall {
  constructor(w = 2, h = 14, { foam = true } = {}) {
    this.group = new THREE.Group();
    const t = waterfallTex().clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.2, h / 6);
    this.tex = t;
    const mat = new THREE.MeshStandardMaterial({ map: t, transparent: true, opacity: 0.88, roughness: 0.2, emissive: "#8ad8ff", emissiveIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    // 위는 앞으로 살짝 굽고 아래로 떨어지는 띠
    const geo = new THREE.PlaneGeometry(w, h, 4, 16);
    const p = geo.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const k = (h / 2 - y) / h; // 0(위) → 1(아래)
      p.setZ(i, Math.sqrt(Math.max(0, k)) * 1.4 + Math.sin(k * 6) * 0.05);
      p.setX(i, p.getX(i) * (1 + k * 0.5));
    }
    geo.translate(0, -h / 2, 0);
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 1;
    this.group.add(this.mesh);
    // 물안개
    if (foam) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: "#ffffff", transparent: true, opacity: 0.55, depthWrite: false }));
      sp.position.set(0, -h + 0.5, 1.6);
      sp.scale.set(w * 2.6, w * 1.6, 1);
      this.group.add(sp);
      const top = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: "#ffffff", transparent: true, opacity: 0.45, depthWrite: false }));
      top.position.set(0, -0.2, 0.3);
      top.scale.set(w * 1.4, 0.8, 1);
      this.group.add(top);
    }
  }
  update(dt) {
    this.tex.offset.y += dt * 0.9;
  }
}

/* ---------------- 깃발 (펄럭이는 천) ---------------- */
export class Flag {
  constructor(color = "#ff7a6a", w = 1.2, h = 0.8, pole = 3) {
    this.group = new THREE.Group();
    const poleM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, pole, 8), new THREE.MeshStandardMaterial({ color: "#7a5236", roughness: 0.8 }));
    poleM.position.y = pole / 2;
    poleM.castShadow = true;
    this.group.add(poleM);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: "#e8c060", metalness: 0.7, roughness: 0.3 }));
    ball.position.y = pole + 0.05;
    this.group.add(ball);
    this.geo = new THREE.PlaneGeometry(w, h, 14, 6);
    this.geo.translate(w / 2, 0, 0);
    this.base = this.geo.getAttribute("position").array.slice();
    const m = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ map: flagTex(color), side: THREE.DoubleSide, roughness: 0.85 }));
    m.position.y = pole - h / 2 - 0.05;
    m.castShadow = true;
    this.cloth = m;
    this.group.add(m);
    this.w = w;
    this.t = Math.random() * 10;
  }
  update(dt, wind = 1) {
    this.t += dt * (3 + wind * 2);
    const p = this.geo.getAttribute("position");
    const b = this.base;
    for (let i = 0; i < p.count; i++) {
      const x = b[i * 3];
      const k = x / this.w;
      p.setZ(i, Math.sin(this.t * 2.2 - x * 3.2) * 0.16 * k * wind + Math.sin(this.t * 1.3 - x * 1.5 + b[i * 3 + 1] * 2) * 0.06 * k);
      p.setY(i, b[i * 3 + 1] - k * k * 0.06);
    }
    p.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

/* ---------------- 비행선 ---------------- */
export class Airship {
  constructor(M, { scale = 1, color = "#e9c99a", deck = true } = {}) {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.scale = scale;
    this.props = [];
    this.flags = [];
    const g = this.inner;
    const s = scale;
    // 기구 (큰 풍선) + 갈빗대 띠 + 꼬리 날개
    const envM = new THREE.MeshStandardMaterial({ color, roughness: 0.75, vertexColors: true });
    const env = new THREE.Mesh(shadeVerts(new THREE.SphereGeometry(1, 48, 24), { bottom: 0.68, top: 1.05 }), envM);
    env.scale.set(3.4 * s, 3.4 * s, 9.5 * s);
    env.position.y = 7.2 * s;
    g.add(env);
    const ribM = new THREE.MeshStandardMaterial({ color: "#a8784a", roughness: 0.7 });
    for (let i = -3; i <= 3; i++) {
      const z = i * 2.4 * s;
      const r = 3.4 * s * Math.sqrt(Math.max(0, 1 - (z / (9.5 * s)) ** 2));
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.07 * s, 6, 40), ribM);
      rib.position.set(0, 7.2 * s, z);
      g.add(rib);
    }
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(3.42 * s, 0.12 * s, 6, 60), new THREE.MeshStandardMaterial({ color: "#c8544a", roughness: 0.7 }));
    stripe.scale.set(1, 1, 9.5 / 3.4);
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 7.2 * s;
    g.add(stripe);
    const finM = new THREE.MeshStandardMaterial({ color: "#c8544a", roughness: 0.7, side: THREE.DoubleSide });
    for (const [rx, rz] of [
      [0, 0],
      [0, Math.PI / 2],
    ]) {
      const fin = new THREE.Mesh(roundedBox(0.2 * s, 3.2 * s, 2.6 * s, 0.08 * s), finM);
      fin.position.set(0, 7.2 * s, -8.6 * s);
      fin.rotation.set(rx, 0, rz);
      g.add(fin);
    }
    // 배 (선체)
    const hullGeo = new THREE.LatheGeometry(
      [
        [0.01, -1.2],
        [0.9, -1.0],
        [1.5, -0.4],
        [1.7, 0.4],
        [1.75, 0.6],
      ].map(([r, y]) => new THREE.Vector2(r * s, y * s)),
      24
    );
    hullGeo.scale(1, 1, 3.2);
    shadeVerts(hullGeo, { bottom: 0.55 });
    const hull = new THREE.Mesh(hullGeo, M.wood);
    hull.position.y = 1.2 * s;
    g.add(hull);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(1.72 * s, 0.09 * s, 6, 40), M.woodDark);
    rail.scale.set(1, 3.2, 1);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 1.85 * s;
    g.add(rail);
    // 갑판 (평평한 판) — 착지 지점
    if (deck) {
      const d = new THREE.Mesh(roundedBox(3.1 * s, 0.2 * s, 9.6 * s, 0.1 * s), M.wood);
      d.position.y = 1.7 * s;
      g.add(d);
      this.deckY = 1.8 * s;
      this.deckHalf = { x: 1.45 * s, z: 4.6 * s };
    }
    // 선실 + 창문 + 지붕
    const cabin = new THREE.Mesh(roundedBox(2.2 * s, 1.5 * s, 2.6 * s, 0.15 * s), M.cloth);
    cabin.position.set(0, 2.5 * s, -2.8 * s);
    g.add(cabin);
    const roof = new THREE.Mesh(roundedBox(2.5 * s, 0.3 * s, 2.9 * s, 0.12 * s), M.roof);
    roof.position.set(0, 3.35 * s, -2.8 * s);
    g.add(roof);
    for (const x of [-1.11, 1.11]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.28 * s, 16), M.window);
      w.position.set(x * s, 2.6 * s, -2.8 * s);
      w.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(w);
    }
    // 밧줄 (기구 ↔ 배)
    for (const x of [-1.5, 1.5]) {
      for (const z of [-3.5, 0, 3.5]) {
        g.add(new THREE.Mesh(ropeGeo(V(x * s, 1.9 * s, z * s), V(x * 1.6 * s, 4.6 * s, z * 1.2 * s), 0.02 * s, 0.03 * s, 6), M.rope));
      }
    }
    // 프로펠러 (양옆 + 뒤)
    const blade = roundedBox(0.16 * s, 1.5 * s, 0.05 * s, 0.05 * s);
    for (const [x, y, z] of [
      [-2.2, 2.2, -4.0],
      [2.2, 2.2, -4.0],
    ]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 1.2 * s, 8), M.brass);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(x * 0.75 * s, y * s, z * s);
      g.add(arm);
      const hub = new THREE.Group();
      hub.position.set(x * s, y * s, (z - 0.2) * s);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(blade, M.woodDark);
        b.rotation.z = (i / 3) * TAU;
        b.position.set(Math.sin((i / 3) * TAU) * 0.7 * s, Math.cos((i / 3) * TAU) * 0.7 * s, 0);
        b.rotation.z = -(i / 3) * TAU;
        hub.add(b);
      }
      hub.add(new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 10, 8), M.brass));
      hub.userData.keep = true;
      g.add(hub);
      this.props.push(hub);
    }
    // 돛대 + 깃발
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.09 * s, 3.2 * s, 8), M.woodDark);
    mast.position.set(0, 3.3 * s, 2.6 * s);
    g.add(mast);
    const fl = new Flag("#ff7a6a", 1.1 * s, 0.7 * s, 0.1);
    fl.group.position.set(0, 4.85 * s, 2.6 * s);
    fl.group.rotation.y = Math.PI / 2;
    fl.group.userData.keep = true;
    g.add(fl.group);
    this.flags.push(fl);
    // 등불
    for (const z of [3.8, -0.6]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 12, 10), M.lantern);
      l.position.set(1.6 * s, 2.2 * s, z * s);
      g.add(l);
    }
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const merged = mergeByMaterial(g);
    this.group.remove(g);
    this.inner = merged;
    this.group.add(merged);
    this.t = Math.random() * 10;
  }
  update(dt) {
    this.t += dt;
    for (const p of this.props) p.rotation.z += dt * 9;
    for (const f of this.flags) f.update(dt, 1.2);
    this.inner.position.y = Math.sin(this.t * 0.8) * 0.12 * this.scale;
    this.inner.rotation.z = Math.sin(this.t * 0.6) * 0.015;
  }
}

/* ================================================================
 * 세계
 * ============================================================== */
export class World {
  constructor(renderer, scene, { quality = 1 } = {}) {
    this.r = renderer;
    this.scene = scene;
    this.quality = quality;
    this.M = makeMaterials();
    this.anim = [];
    this.sceneryAnim = [];
    this.t = 0;
    this.T = THEMES.sunset;
    this.sunDir = V(-0.55, 0.32, -0.75).normalize();
    this.build();
  }
  build() {
    const scene = this.scene;
    scene.fog = new THREE.Fog(PAL.fog, 70, 420);
    // 빛
    this.hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.05);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(PAL.sun, 2.7);
    this.sun.castShadow = true;
    const sz = this.quality >= 0.95 ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    const sc = this.sun.shadow.camera;
    Object.assign(sc, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.fill = new THREE.DirectionalLight("#b8a8ff", 0.55);
    this.fill.position.set(30, 20, 30);
    scene.add(this.fill);
    this.rim = new THREE.DirectionalLight("#ffc8e0", 0.8);
    this.rim.position.set(-20, 15, 40);
    scene.add(this.rim);
    // 먼 배경 묶음 (카메라를 따라감)
    this.far = new THREE.Group();
    scene.add(this.far);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), skyMaterial(this.sunDir));
    sky.renderOrder = -10;
    this.far.add(sky);
    this.sky = sky;
    // 해 · 달
    const sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#fff2d8", transparent: true, opacity: 0.85, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    sunSp.position.copy(this.sunDir).multiplyScalar(460);
    sunSp.scale.setScalar(70);
    this.far.add(sunSp);
    this.sunSp = sunSp;
    const moon = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshBasicMaterial({ color: "#fdf6ff", fog: false, transparent: true, opacity: 0.92 }));
    const md = V(0.35, 0.55, -0.76).normalize();
    moon.position.copy(md).multiplyScalar(450);
    moon.lookAt(0, 0, 0);
    this.far.add(moon);
    const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    moonGlow.position.copy(moon.position);
    moonGlow.scale.setScalar(70);
    this.far.add(moonGlow);
    this.moon = [moon, moonGlow];
    // 밤하늘 별 (동굴 · 폭풍)
    {
      const n = 600;
      const pos = new Float32Array(n * 3);
      const rr = seeded(77);
      for (let i = 0; i < n; i++) {
        const a = rr() * TAU;
        const e = 0.15 + rr() * 0.85;
        pos[i * 3] = Math.cos(a) * Math.cos(e) * 440;
        pos[i * 3 + 1] = Math.sin(e) * 440;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 440;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
      this.stars.visible = false;
      this.far.add(this.stars);
    }
    // 아주 먼 구름 바닥 (틈을 메운다)
    const floorTex = cloudFloorTex().clone();
    floorTex.needsUpdate = true;
    floorTex.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(520, 48), new THREE.MeshStandardMaterial({ map: floorTex, color: "#f2e2f0", roughness: 1, emissive: "#c8a8d8", emissiveIntensity: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -70;
    this.far.add(floor);
    this.cloudFloor = floorTex;
    this.floorMesh = floor;
    // 구름 바다 (인스턴스 뭉게구름)
    this.cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: "#ffd8e8", emissiveIntensity: 0.18 });
    // 가까이 쓰는 구름(코스 옆 · 구름 발판)은 곱게, 아주 먼 구름 바다는 간단하게
    this.cloudGeos = [cloudGeo(3, 7), cloudGeo(8, 9), cloudGeo(15, 6)];
    const seaGeos = [cloudGeo(3, 7, 1), cloudGeo(8, 9, 1), cloudGeo(15, 6, 1)];
    this.cloudSea = [];
    const rnd = seeded(21);
    const n = this.quality >= 0.95 ? 70 : this.quality >= 0.7 ? 54 : 36;
    for (let k = 0; k < this.cloudGeos.length; k++) {
      const im = new THREE.InstancedMesh(seaGeos[k], this.cloudMat, Math.ceil(n / 3));
      const items = [];
      for (let i = 0; i < im.count; i++) {
        const a = rnd() * TAU;
        const r = 40 + Math.pow(rnd(), 0.7) * 300;
        items.push({ x: Math.cos(a) * r, y: -38 - rnd() * 22, z: Math.sin(a) * r, s: 9 + rnd() * 16, ry: rnd() * TAU, v: 0.4 + rnd() * 0.6 });
      }
      im.userData.items = items;
      im.frustumCulled = false;
      this.far.add(im);
      this.cloudSea.push(im);
    }
    this.placeClouds(0);
    // 가까이 떠다니는 구름 (코스 사이 · 섬 아래) — 따라오지 않음
    this.midClouds = new THREE.Group();
    scene.add(this.midClouds);
    // 스테이지마다 바뀌는 먼 배경 (먼 섬 · 성 · 탑 …)
    this.scenery = new THREE.Group();
    scene.add(this.scenery);
    // 비 (폭풍 스테이지)
    this.rain = this.makeRain();
    // 반짝이는 먼지 (빛 알갱이)
    this.motes = this.makeMotes();
    // 환경광 (반사)
    this.makeEnv();
  }
  placeClouds(t) {
    const o = new THREE.Object3D();
    for (const im of this.cloudSea) {
      const items = im.userData.items;
      for (let i = 0; i < items.length; i++) {
        const c = items[i];
        const x = c.x + Math.sin(t * 0.02 * c.v + i) * 6;
        o.position.set(x, c.y + Math.sin(t * 0.15 + i) * 0.6, c.z);
        o.rotation.set(0, c.ry, 0);
        o.scale.set(c.s, c.s * 0.75, c.s);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
  /** 코스 근처에 떠 있는 뭉게구름 하나 */
  addCloud(x, y, z, s = 4, seed = 1) {
    const m = new THREE.Mesh(this.cloudGeos[seed % 3], this.cloudMat);
    m.position.set(x, y, z);
    m.scale.set(s, s * 0.7, s);
    m.rotation.y = seed;
    m.userData.base = m.position.clone();
    m.userData.seed = seed;
    this.midClouds.add(m);
    return m;
  }
  makeMotes() {
    const n = this.quality >= 1 ? 160 : 80;
    const pos = new Float32Array(n * 3);
    const rnd = seeded(5);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rnd() - 0.5) * 60;
      pos[i * 3 + 1] = (rnd() - 0.3) * 25;
      pos[i * 3 + 2] = (rnd() - 0.5) * 60;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex(), color: "#fff2c8", size: 0.22, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    return pts;
  }
  makeEnv() {
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial(this.sunDir, this.T)));
    const pm = new THREE.PMREMGenerator(this.r);
    if (this.envRT) this.envRT.dispose();
    this.envRT = pm.fromScene(es, 0.04);
    this.scene.environment = this.envRT.texture;
    es.children[0].geometry.dispose();
    es.children[0].material.dispose();
    pm.dispose();
  }

  makeRain() {
    const n = this.quality >= 0.95 ? 700 : 400;
    const pos = new Float32Array(n * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#b8c8ee", transparent: true, opacity: 0.45, depthWrite: false }));
    lines.frustumCulled = false;
    lines.visible = false;
    this.scene.add(lines);
    const drops = [];
    for (let i = 0; i < n; i++) drops.push({ x: (Math.random() - 0.5) * 50, y: Math.random() * 30, z: (Math.random() - 0.5) * 50, v: 26 + Math.random() * 10 });
    return { lines, drops, pos };
  }
  /**
   * 스테이지 테마 적용: 하늘 · 해 · 안개 · 빛 · 구름 · 바닥 · 반사광 · 날씨
   */
  setTheme(id) {
    const T = THEMES[id] || THEMES.sunset;
    this.T = T;
    this.themeId = id;
    this.sunDir = V(...T.sunDir).normalize();
    const u = this.sky.material.uniforms;
    u.top.value.set(T.skyTop);
    u.mid.value.set(T.skyMid);
    u.low.value.set(T.skyLow);
    u.hor.value.set(T.horizon);
    u.sunC.value.set(T.sun);
    u.sunD.value.copy(this.sunDir);
    this.sunSp.position.copy(this.sunDir).multiplyScalar(460);
    this.sunSp.material.color.set(T.sun);
    this.sunSp.visible = id !== "cave";
    for (const m of this.moon) m.visible = !!T.moon;
    this.stars.visible = !!(T.stars || T.rain);
    this.stars.material.opacity = T.rain ? 0.35 : 0.85;
    const f = this.scene.fog;
    f.color.set(T.fog);
    f.near = T.fogNear;
    f.far = T.fogFar;
    this.hemi.color.set(T.hemiSky);
    this.hemi.groundColor.set(T.hemiGround);
    this.hemi.intensity = T.hemiI;
    this.baseHemi = T.hemiI;
    this.sun.color.set(T.sun);
    this.sun.intensity = T.sunI;
    this.fill.color.set(T.fill);
    this.fill.intensity = T.fillI;
    this.rim.color.set(T.rim);
    this.rim.intensity = T.rimI;
    this.cloudMat.color.set(T.cloud);
    this.cloudMat.emissive.set(T.cloudE);
    this.cloudMat.emissiveIntensity = T.cloudEI;
    this.floorMesh.material.color.set(T.floor);
    this.floorMesh.material.emissive.set(T.cloudE);
    this.motes.material.color.set(T.motes);
    this.r.toneMappingExposure = T.exposure;
    this.rain.lines.visible = !!T.rain;
    this.lightning = !!T.lightning;
    this.flashT = 4 + Math.random() * 4;
    this.flash = 0;
    this.makeEnv();
  }
  /** 스테이지가 바뀔 때 먼 배경 지우기 */
  clearScenery() {
    for (const c of [...this.scenery.children]) {
      this.scenery.remove(c);
      c.traverse((o) => o.geometry && o.geometry.dispose());
    }
    for (const c of [...this.midClouds.children]) this.midClouds.remove(c);
    this.sceneryAnim = [];
  }

  /* ---------------- 먼 섬 · 성 (배경) ---------------- */
  farIsland(x, y, z, R, { trees = 3, castle = false, falls = 1, seed = 1, depth } = {}) {
    // 스테이지 재질이 있으면 그걸로 (협곡 붉은 바위 · 동굴 보랏빛 바위 …)
    const M = this.stageM || this.M;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const { top, rock } = islandGeo(R, depth || R * 1.5, { seed, lumpy: 0.4, seg: 40 });
    shadeVerts(rock, { top: 1.0, bottom: 0.5 });
    shadeVerts(top, { top: 1, bottom: 0.9 });
    g.add(new THREE.Mesh(top, M.grass));
    g.add(new THREE.Mesh(rock, M.rock));
    const rnd = seeded(seed * 7);
    for (let i = 0; i < trees; i++) {
      const a = rnd() * TAU;
      const r = rnd() * R * 0.7;
      const t = roundTree(M, 2.5 + rnd() * 2.5, seed + i);
      t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      g.add(t);
    }
    if (castle) g.add(this.castle(R * 0.55, seed));
    for (let i = 0; i < falls; i++) {
      const a = rnd() * TAU;
      const wf = new Waterfall(R * 0.18 + 0.8, R * 3, { foam: true });
      wf.group.userData.keep = true;
      wf.group.position.set(Math.cos(a) * (R + 0.05), -0.1, Math.sin(a) * (R + 0.05));
      wf.group.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
      g.add(wf.group);
      this.sceneryAnim.push((dt) => wf.update(dt));
    }
    const merged = mergeByMaterial(g);
    this.scenery.add(merged);
    this.sceneryAnim.push((dt, t) => {
      merged.position.y = y + Math.sin(t * 0.25 + seed) * 0.6;
    });
    return merged;
  }
  castle(size, seed = 1) {
    const g = new THREE.Group();
    const M = this.stageM || this.M;
    const tower = (x, z, r, h) => {
      const body = new THREE.Mesh(shadeVerts(new THREE.CylinderGeometry(r, r * 1.08, h, 16), { bottom: 0.65 }), M.castle);
      body.position.set(x, h / 2, z);
      g.add(body);
      const roof = new THREE.Mesh(shadeVerts(new THREE.ConeGeometry(r * 1.35, h * 0.55, 16), { bottom: 0.7 }), M.roof);
      roof.position.set(x, h + h * 0.27, z);
      g.add(roof);
      for (let i = 0; i < 3; i++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.35, r * 0.55), M.window);
        const a = i * 2.1;
        w.position.set(x + Math.sin(a) * r * 1.01, h * (0.45 + i * 0.15), z + Math.cos(a) * r * 1.01);
        w.rotation.y = a;
        g.add(w);
      }
    };
    const s = size;
    tower(0, 0, s * 0.32, s * 2.4);
    tower(-s * 0.6, s * 0.3, s * 0.22, s * 1.6);
    tower(s * 0.65, s * 0.15, s * 0.24, s * 1.8);
    tower(s * 0.2, -s * 0.6, s * 0.2, s * 1.4);
    const wall = new THREE.Mesh(shadeVerts(roundedBox(s * 1.6, s * 0.7, s * 1.0, s * 0.05), { bottom: 0.7 }), M.castle);
    wall.position.set(0, s * 0.35, s * 0.1);
    g.add(wall);
    return g;
  }

  /* ---------------- 매 프레임 ---------------- */
  update(dt, cam, focus) {
    this.t += dt;
    const t = this.t;
    this.far.position.set(cam.x, 0, cam.z);
    for (const f of this.anim) f(dt, t);
    for (const f of this.sceneryAnim) f(dt, t);
    // 비: 카메라 둘레에 떨어지는 빗줄기
    if (this.rain.lines.visible) {
      const R = this.rain;
      for (let i = 0; i < R.drops.length; i++) {
        const d = R.drops[i];
        d.y -= d.v * dt;
        if (d.y < -8) {
          d.y = 22 + Math.random() * 6;
          d.x = (Math.random() - 0.5) * 50;
          d.z = (Math.random() - 0.5) * 50;
        }
        const x = cam.x + d.x;
        const y = cam.y + d.y;
        const z = cam.z + d.z;
        R.pos[i * 6] = x;
        R.pos[i * 6 + 1] = y;
        R.pos[i * 6 + 2] = z;
        R.pos[i * 6 + 3] = x - 0.15;
        R.pos[i * 6 + 4] = y + 0.9;
        R.pos[i * 6 + 5] = z;
      }
      R.lines.geometry.getAttribute("position").needsUpdate = true;
    }
    // 번개: 가끔 하늘이 번쩍
    if (this.lightning) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.flashT = 5 + Math.random() * 6;
        this.flash = 1;
        if (this.onThunder) this.onThunder();
      }
      if (this.flash > 0) {
        this.flash = Math.max(0, this.flash - dt * 3.2);
        const k = this.flash > 0.6 || (this.flash > 0.2 && this.flash < 0.35) ? 1 : 0.2;
        this.hemi.intensity = this.baseHemi + this.flash * 2.4 * k;
        this.sky.material.uniforms.sunC.value.set(this.T.sun).multiplyScalar(1 + this.flash * 2 * k);
      } else this.hemi.intensity = this.baseHemi;
    }
    if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) this.placeClouds(t);
    this.cloudFloor.offset.x = t * 0.002;
    for (const c of this.midClouds.children) {
      const b = c.userData.base;
      if (focus) c.visible = b.z < focus.z + 50 && b.z > focus.z - 200;
      c.position.x = b.x + Math.sin(t * 0.1 + c.userData.seed) * 1.2;
      c.position.y = b.y + Math.sin(t * 0.3 + c.userData.seed * 2) * 0.3;
    }
    // 빛 알갱이: 주인공 주변을 맴돈다
    if (focus) {
      this.motes.position.set(focus.x, focus.y, focus.z);
      this.motes.rotation.y = t * 0.02;
      // 그림자 카메라가 주인공을 따라감
      this.sun.target.position.copy(focus);
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 60);
      this.sun.position.y = focus.y + 45;
      this.sun.target.updateMatrixWorld();
    }
  }
  dispose() {
    if (this.envRT) this.envRT.dispose();
  }
}
