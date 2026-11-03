/*
 * 택배 · 장애물 · 아이템 · 집: 전부 말랑한 3D 장난감으로 코드에서 만든다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { toyMat, roundBox, starGeo } from "./penguin.js";

const TAU = Math.PI * 2;

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export const ball = (r, sx = 1, sy = 1, sz = 1, seg = 18) => {
  const g = new THREE.SphereGeometry(r, seg, Math.max(8, seg - 4));
  g.scale(sx, sy, sz);
  return g;
};
export const lathe = (pts, seg = 20, n = 14) => {
  const up = pts[0][1] <= pts[pts.length - 1][1] ? pts : pts.slice().reverse();
  return new THREE.LatheGeometry(new THREE.SplineCurve(up.map((a) => new THREE.Vector2(a[0], a[1]))).getPoints(n), seg);
};
const rbox = (w, h, d, r, n = 4) => roundBox(new THREE.BoxGeometry(w, h, d, n, n, n), w, h, d, r);

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  if (parent) parent.add(m);
  return m;
}

/* ---------- 택배 ---------- */
const BOX_LOOK = {
  normal: { base: "#d8a765", dark: "#b98545", tape: "#f2e1b8", bow: 0xe9463c, sticker: "#ffffff", mark: "📦" },
  heavy: { base: "#7f8a9c", dark: "#5e6878", tape: "#3f4757", bow: 0x384152, sticker: "#ffd24a", mark: "⚖" },
  light: { base: "#a9e2ff", dark: "#7cc6ea", tape: "#ffffff", bow: 0xff7fb4, sticker: "#ffffff", mark: "🎈" },
  fragile: { base: "#ffc0d4", dark: "#ee95b4", tape: "#ffe6ef", bow: 0xd9345f, sticker: "#ffffff", mark: "!" },
  express: { base: "#ff6a4d", dark: "#dc4630", tape: "#ffd24a", bow: 0xffd24a, sticker: "#fff7d6", mark: "⚡" },
  big: { base: "#ffc95c", dark: "#e6a53a", tape: "#ffefc4", bow: 0x46b3e8, sticker: "#ffffff", mark: "★" },
};
const boxTexCache = new Map();
function boxTexture(kind) {
  if (boxTexCache.has(kind)) return boxTexCache.get(kind);
  const L = BOX_LOOK[kind] || BOX_LOOK.normal;
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = L.base;
  g.fillRect(0, 0, S, S);
  // 골판지 결
  g.strokeStyle = "rgba(0,0,0,.05)";
  g.lineWidth = 2;
  for (let y = 6; y < S; y += 10) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(S, y);
    g.stroke();
  }
  // 테이프
  g.fillStyle = L.tape;
  g.fillRect(S * 0.42, 0, S * 0.16, S);
  g.fillStyle = "rgba(0,0,0,.08)";
  g.fillRect(S * 0.42, 0, 3, S);
  g.fillRect(S * 0.58 - 3, 0, 3, S);
  // 스티커
  g.save();
  g.translate(S * 0.2, S * 0.74);
  g.rotate(-0.12);
  g.fillStyle = L.sticker;
  g.beginPath();
  g.roundRect(-34, -24, 68, 48, 8);
  g.fill();
  g.fillStyle = kind === "fragile" ? "#d9345f" : "#2b3350";
  if (kind === "fragile") {
    // 깨지기 쉬움 잔 표시
    g.lineWidth = 5;
    g.strokeStyle = "#d9345f";
    g.beginPath();
    g.moveTo(-10, -14);
    g.quadraticCurveTo(0, 8, 10, -14);
    g.moveTo(0, 2);
    g.lineTo(0, 15);
    g.moveTo(-8, 16);
    g.lineTo(8, 16);
    g.stroke();
  } else if (kind === "express") {
    g.beginPath();
    g.moveTo(4, -18);
    g.lineTo(-12, 3);
    g.lineTo(-1, 3);
    g.lineTo(-5, 18);
    g.lineTo(12, -4);
    g.lineTo(1, -4);
    g.closePath();
    g.fill();
  } else {
    for (let i = 0; i < 4; i += 1) g.fillRect(-26, -16 + i * 9, 52 - (i % 2) * 18, 4);
  }
  g.restore();
  // 무거운 택배 쇠띠
  if (kind === "heavy") {
    g.fillStyle = "#4d5566";
    g.fillRect(0, S * 0.08, S, 16);
    g.fillRect(0, S * 0.84, S, 16);
    g.fillStyle = "#c7ced9";
    for (let x = 16; x < S; x += 44) {
      g.beginPath();
      g.arc(x, S * 0.08 + 8, 4, 0, TAU);
      g.arc(x, S * 0.84 + 8, 4, 0, TAU);
      g.fill();
    }
  }
  if (kind === "light") {
    g.fillStyle = "rgba(255,255,255,.75)";
    for (let i = 0; i < 12; i += 1) {
      g.beginPath();
      g.arc((i * 83) % S, (i * 47 + 30) % S, 8 + (i % 3) * 3, 0, TAU);
      g.fill();
    }
  }
  const t = tex(c);
  boxTexCache.set(kind, t);
  return t;
}
let faceTex = null;
function faceTexture() {
  if (faceTex) return faceTex;
  const [c, g] = canvas(256, 128);
  const draw = (x, kind) => {
    g.strokeStyle = "#1b1626";
    g.fillStyle = "#1b1626";
    g.lineWidth = 10;
    g.lineCap = "round";
    if (kind === 0) {
      // > _ <
      for (const [ex, s] of [[x + 36, 1], [x + 92, -1]]) {
        g.beginPath();
        g.moveTo(ex - 14 * s, 36);
        g.lineTo(ex + 14 * s, 50);
        g.lineTo(ex - 14 * s, 64);
        g.stroke();
      }
      g.beginPath();
      g.ellipse(x + 64, 92, 15, 12, 0, 0, TAU);
      g.fill();
    } else {
      // o_o 흔들림
      for (const ex of [x + 36, x + 92]) {
        g.beginPath();
        g.arc(ex, 50, 16, 0, TAU);
        g.fill();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(ex - 5, 44, 6, 0, TAU);
        g.fill();
        g.fillStyle = "#1b1626";
      }
      g.beginPath();
      g.moveTo(x + 50, 94);
      g.quadraticCurveTo(x + 64, 84, x + 78, 94);
      g.stroke();
    }
    g.fillStyle = "rgba(255,110,120,.6)";
    g.beginPath();
    g.ellipse(x + 15, 76, 11, 7, 0, 0, TAU);
    g.ellipse(x + 113, 76, 11, 7, 0, 0, TAU);
    g.fill();
  };
  draw(0, 0);
  draw(128, 1);
  faceTex = tex(c);
  return faceTex;
}

export function makeBox(kind, size, q) {
  const G = new THREE.Group();
  const L = BOX_LOOK[kind] || BOX_LOOK.normal;
  const r = size * 0.14;
  const geo = rbox(size, size, size, r, 5);
  const mat = toyMat({ map: boxTexture(kind), rough: 0.58, coat: 0.25 }, q);
  const b = mesh(geo, mat, 0, 0, 0, G);
  b.receiveShadow = true;
  // 리본
  const bowM = toyMat({ color: L.bow, rough: 0.38, coat: 0.6 }, q);
  const top = size / 2;
  const band = rbox(size * 1.02, size * 1.02, size * 0.16, r * 0.8, 3);
  mesh(band, bowM, 0, 0, 0, G, false);
  const bandB = rbox(size * 0.16, size * 1.02, size * 1.02, r * 0.8, 3);
  mesh(bandB, bowM, 0, 0, 0, G, false);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(size * 0.13, size * 0.045, 8, 14), bowM);
    loop.scale.set(1.25, 0.8, 1);
    loop.position.set(s * size * 0.15, top + size * 0.09, 0);
    loop.rotation.z = s * 0.45;
    loop.castShadow = true;
    G.add(loop);
  }
  mesh(ball(size * 0.065, 1, 1, 1, 10), bowM, 0, top + size * 0.05, 0, G, false);
  if (kind === "light") {
    // 작은 풍선이 달려 있음
    const b2 = mesh(ball(size * 0.3, 1, 1.15, 1, 14), toyMat({ color: 0xff7fb4, rough: 0.22, coat: 1 }, q), size * 0.3, size * 1.15, 0, G);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, size * 0.62, 5), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    st.position.set(size * 0.16, size * 0.74, 0);
    st.rotation.z = 0.25;
    G.add(st);
    G.userData.balloon = b2;
  }
  // 충격 표정
  const fm = new THREE.MeshBasicMaterial({ map: faceTexture().clone(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  fm.map.repeat.set(0.5, 1);
  fm.map.needsUpdate = true;
  const fg = new THREE.PlaneGeometry(size * 0.74, size * 0.74);
  const fA = new THREE.Mesh(fg, fm);
  fA.position.z = size / 2 + 0.004;
  const fB = new THREE.Mesh(fg, fm);
  fB.position.z = -size / 2 - 0.004;
  fB.rotation.y = Math.PI;
  const fC = new THREE.Mesh(fg, fm);
  fC.position.x = size / 2 + 0.004;
  fC.rotation.y = Math.PI / 2;
  const fD = new THREE.Mesh(fg, fm);
  fD.position.x = -size / 2 - 0.004;
  fD.rotation.y = -Math.PI / 2;
  const faces = new THREE.Group();
  faces.add(fA, fB, fC, fD);
  faces.visible = false;
  G.add(faces);
  G.userData.faces = faces;
  G.userData.faceMat = fm;
  return G;
}

/* ---------- 장애물 ---------- */
export function makeSnowman(q) {
  const G = new THREE.Group();
  const w = toyMat({ color: 0xffffff, rough: 0.82, coat: 0.05 }, q);
  const low = mesh(ball(0.62, 1, 0.9, 1, 20), w, 0, 0.55, 0, G);
  const mid = mesh(ball(0.46, 1, 0.92, 1, 18), w, 0, 1.22, 0, G);
  const head = new THREE.Group();
  head.position.set(0, 1.8, 0);
  G.add(head);
  mesh(ball(0.36, 1, 0.96, 1, 18), w, 0, 0, 0, head);
  const coal = new THREE.MeshStandardMaterial({ color: 0x1b1a24, roughness: 0.35 });
  for (const s of [-1, 1]) mesh(ball(0.05, 1, 1.1, 0.5, 8), coal, s * 0.13, 0.08, 0.32, head, false);
  const carrot = new THREE.ConeGeometry(0.05, 0.3, 8);
  carrot.rotateX(Math.PI / 2);
  mesh(carrot, toyMat({ color: 0xff8a1f, rough: 0.5, coat: 0.3 }, q), 0, -0.02, 0.45, head, false);
  for (let i = 0; i < 3; i += 1) mesh(ball(0.04, 1, 1, 0.5, 6), coal, 0, 1.38 - i * 0.2, 0.43 - Math.abs(i - 1) * 0.02, G, false);
  const hatM = new THREE.MeshStandardMaterial({ color: 0x2c2c3c, roughness: 0.5 });
  mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 16), hatM, 0, 0.42, 0, head);
  mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 18), hatM, 0, 0.28, 0, head);
  const scarf = new THREE.TorusGeometry(0.33, 0.07, 8, 20);
  scarf.rotateX(Math.PI / 2);
  mesh(scarf, toyMat({ color: 0xe9463c, rough: 0.7, coat: 0.1 }, q), 0, 1.53, 0, G);
  const twig = new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.62, 6), twig);
    a.position.set(s * 0.62, 1.35, 0);
    a.rotation.z = -s * 1.05;
    a.castShadow = true;
    G.add(a);
  }
  G.userData = { head, low, mid };
  return G;
}

let woodTex = null;
function woodTexture() {
  if (woodTex) return woodTex;
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#c98f4f";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i += 1) {
    g.fillStyle = i % 2 ? "#bd8344" : "#d39a5a";
    g.fillRect(0, i * 64, 256, 62);
    g.strokeStyle = "rgba(90,50,20,.22)";
    g.lineWidth = 2;
    for (let k = 0; k < 4; k += 1) {
      g.beginPath();
      g.moveTo(0, i * 64 + 10 + k * 13);
      g.bezierCurveTo(80, i * 64 + 4 + k * 13, 170, i * 64 + 18 + k * 13, 256, i * 64 + 9 + k * 13);
      g.stroke();
    }
  }
  g.strokeStyle = "#7a4a22";
  g.lineWidth = 16;
  g.strokeRect(8, 8, 240, 240);
  g.beginPath();
  g.moveTo(10, 10);
  g.lineTo(246, 246);
  g.stroke();
  woodTex = tex(c);
  return woodTex;
}
export function makeCrate(size, h, q) {
  const G = new THREE.Group();
  const w = size * 2;
  const geo = rbox(w, h, w, 0.14, 4);
  const b = mesh(geo, toyMat({ map: woodTexture(), rough: 0.62, coat: 0.2 }, q), 0, -h / 2, 0, G);
  b.receiveShadow = true;
  const cap = rbox(w * 0.96, 0.12, w * 0.96, 0.05, 2);
  mesh(cap, toyMat({ color: 0xffffff, rough: 0.85, coat: 0.05 }, q), 0, 0.02, 0, G);
  return G;
}

export function iceMat(q, color = 0x9fe2ff, extra = {}) {
  if (q === "low") return new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.88, ...extra });
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.86, ...extra });
}
export function makePillar(r, h, q) {
  const G = new THREE.Group();
  const geo = new THREE.CylinderGeometry(r * 0.72, r, h, 6, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const y = p.getY(i) / h;
    const a = Math.sin(y * 7 + Math.atan2(p.getZ(i), p.getX(i)) * 2) * 0.05;
    p.setX(i, p.getX(i) * (1 + a));
    p.setZ(i, p.getZ(i) * (1 + a));
  }
  geo.computeVertexNormals();
  const m = iceMat(q);
  mesh(geo, m, 0, h / 2, 0, G);
  const tip = new THREE.ConeGeometry(r * 0.72, r * 1.1, 6);
  mesh(tip, m, 0, h + r * 0.54, 0, G);
  const base = lathe([[r * 1.45, 0.02], [r * 1.25, 0.2], [r * 0.9, 0.36], [r * 0.2, 0.44]], 12, 8);
  mesh(base, toyMat({ color: 0xffffff, rough: 0.85, coat: 0 }, q), 0, 0, 0, G);
  return G;
}
export function makeRotor(o, q) {
  const G = new THREE.Group();
  G.add(makePillar(o.r, o.h, q));
  const arm = new THREE.Group();
  arm.position.y = o.armH * 0.72;
  G.add(arm);
  const stripeC = (() => {
    const [c, g] = canvas(128, 32);
    for (let i = 0; i < 8; i += 1) {
      g.fillStyle = i % 2 ? "#ff5a5f" : "#ffffff";
      g.fillRect(i * 16, 0, 16, 32);
    }
    return tex(c);
  })();
  const mat = toyMat({ map: stripeC, rough: 0.34, coat: 0.8 }, q);
  for (let k = 0; k < o.arms; k += 1) {
    const a = (k / o.arms) * TAU;
    const geo = new THREE.CapsuleGeometry(0.2, o.len - 0.2, 6, 14);
    geo.rotateZ(Math.PI / 2);
    geo.translate(o.len / 2, 0, 0);
    const m = new THREE.Mesh(geo, mat);
    // 회전 기준: 판정 ang 은 x→z 방향이므로 -a
    m.rotation.y = -a;
    m.castShadow = true;
    arm.add(m);
    const knob = new THREE.Mesh(ball(0.26, 1, 1, 1, 12), toyMat({ color: 0xffd84a, rough: 0.3, coat: 0.8 }, q));
    knob.position.set(Math.cos(a) * o.len, 0, Math.sin(a) * o.len);
    knob.castShadow = true;
    arm.add(knob);
  }
  G.userData.arm = arm;
  return G;
}
export function makeSpring(o, q) {
  const G = new THREE.Group();
  const coil = new THREE.Group();
  G.add(coil);
  const metal = toyMat({ color: 0xcfd8e6, rough: 0.28, coat: 0.5, metalness: 0.5 }, q);
  const n = 3;
  for (let i = 0; i < n; i += 1) {
    const t = new THREE.TorusGeometry(0.55 - i * 0.05, 0.075, 8, 22);
    t.rotateX(Math.PI / 2);
    mesh(t, metal, 0, 0.1 + i * 0.13, 0, coil);
  }
  const top = lathe([[0.001, 0.2], [0.55, 0.18], [0.84, 0.1], [0.88, 0.0], [0.8, -0.07], [0.001, -0.08]], 22, 12);
  const pad = mesh(top, toyMat({ color: 0xff5a7a, rough: 0.28, coat: 0.9 }, q), 0, 0.5, 0, G);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU;
    mesh(ball(0.1, 1, 0.35, 1, 8), toyMat({ color: 0xffffff, rough: 0.4, coat: 0.4 }, q), Math.cos(a) * 0.52, 0.69, Math.sin(a) * 0.52, G, false);
  }
  G.userData.pad = pad;
  G.userData.coil = coil;
  return G;
}
export function makeVent(o, q) {
  const G = new THREE.Group();
  const rim = new THREE.TorusGeometry(o.r, 0.13, 10, 28);
  rim.rotateX(Math.PI / 2);
  mesh(rim, toyMat({ color: 0x6d7ea0, rough: 0.34, coat: 0.5, metalness: 0.2 }, q), 0, 0.09, 0, G);
  const hole = new THREE.CircleGeometry(o.r, 28);
  hole.rotateX(-Math.PI / 2);
  mesh(hole, new THREE.MeshStandardMaterial({ color: 0x22304a, roughness: 0.9 }), 0, 0.03, 0, G, false);
  const fan = new THREE.Group();
  fan.position.y = 0.09;
  G.add(fan);
  const blade = toyMat({ color: 0xbfd2e8, rough: 0.3, coat: 0.5 }, q);
  for (let i = 0; i < 4; i += 1) {
    const b = new THREE.Mesh(ball(o.r * 0.42, 1.8, 0.08, 0.6, 10), blade);
    const a = (i / 4) * TAU;
    b.position.set(Math.cos(a) * o.r * 0.48, 0, Math.sin(a) * o.r * 0.48);
    b.rotation.y = -a;
    b.rotation.x = 0.3;
    fan.add(b);
  }
  G.userData.fan = fan;
  // 바람 기둥
  const col = new THREE.CylinderGeometry(o.r * 0.92, o.r * 0.7, o.height, 24, 1, true);
  col.translate(0, o.height / 2, 0);
  const cm = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { t: { value: 0 }, k: { value: 0 } },
    vertexShader: "varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 vU;uniform float t;uniform float k;void main(){
      float s=sin((vU.x*18.+vU.y*5.)+t*-9.)*.5+.5;
      s=smoothstep(.55,.95,s);
      float a=s*(1.-vU.y)*(smoothstep(0.,.12,vU.y))*.62*k;
      gl_FragColor=vec4(.9,.97,1.,a);}`,
  });
  G.userData.column = new THREE.Mesh(col, cm);
  G.add(G.userData.column);
  return G;
}
export function makeIcicle(o, hw, q) {
  // 길 가장자리에서 나온 얼음 가지와 고드름
  const G = new THREE.Group();
  const m = iceMat(q, 0xbdeaff);
  const spike = new THREE.Group();
  const cone = new THREE.ConeGeometry(0.34, 1.5, 7, 3);
  cone.rotateX(Math.PI);
  mesh(cone, m, 0, -0.75, 0, spike);
  for (const [x, z, s] of [[-0.3, 0.1, 0.55], [0.28, -0.14, 0.62], [0.05, 0.3, 0.45]]) {
    const c = new THREE.ConeGeometry(0.2, 1.1 * s, 6);
    c.rotateX(Math.PI);
    mesh(c, m, x, -0.5 * s, z, spike);
  }
  G.add(spike);
  G.userData.spike = spike;
  // 위 눈 덩어리 (구름)
  const cloudM = toyMat({ color: 0xffffff, rough: 0.9, coat: 0 }, q);
  const cloud = new THREE.Group();
  for (const [x, y, z, r] of [[0, 0.1, 0, 0.72], [-0.6, 0, 0.1, 0.5], [0.6, 0, -0.1, 0.56], [0.15, 0.32, -0.2, 0.5]]) mesh(ball(r, 1, 0.72, 1, 12), cloudM, x, y, z, cloud);
  G.add(cloud);
  G.userData.cloud = cloud;
  void hw;
  return G;
}
export function makeSeal(q) {
  const G = new THREE.Group();
  const skin = toyMat({ color: 0xd8dfea, rough: 0.46, coat: 0.5 }, q);
  const dark = toyMat({ color: 0x9aa7bc, rough: 0.5, coat: 0.4 }, q);
  const body = mesh(lathe([[0.001, -0.8], [0.3, -0.62], [0.46, -0.2], [0.5, 0.15], [0.44, 0.5], [0.3, 0.72], [0.001, 0.82]], 18, 14), skin, 0, 0.5, -0.1, G);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1, 1, 0.9);
  const tail = mesh(ball(0.28, 1.5, 0.3, 0.7, 10), dark, 0, 0.14, -1, G);
  tail.rotation.x = 0.1;
  for (const s of [-1, 1]) {
    const f = mesh(ball(0.2, 0.6, 0.25, 1.2, 10), dark, s * 0.5, 0.18, 0.15, G);
    f.rotation.z = s * 0.5;
  }
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.52);
  G.add(head);
  mesh(ball(0.38, 1.05, 0.96, 1, 18), skin, 0, 0, 0, head);
  mesh(ball(0.17, 1.15, 0.72, 0.8, 12), toyMat({ color: 0xffffff, rough: 0.5, coat: 0.3 }, q), 0, -0.08, 0.3, head, false);
  mesh(ball(0.055, 1.2, 0.8, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x1b1626, roughness: 0.3 }), 0, -0.01, 0.43, head, false);
  for (const s of [-1, 1]) {
    mesh(ball(0.075, 1, 1.12, 0.6, 10), new THREE.MeshPhysicalMaterial({ color: 0x14121c, roughness: 0.1, clearcoat: 1 }), s * 0.17, 0.08, 0.32, head, false);
    mesh(ball(0.024, 1, 1, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), s * 0.15, 0.11, 0.37, head, false);
    for (const d of [-0.04, 0.03]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 4), new THREE.MeshBasicMaterial({ color: 0x4a4a55 }));
      wh.position.set(s * 0.2, -0.08 + d, 0.34);
      wh.rotation.z = Math.PI / 2 + d * s * 3;
      head.add(wh);
    }
  }
  G.userData.head = head;
  return G;
}
export function makeFox(q) {
  const G = new THREE.Group();
  const orange = toyMat({ color: 0xf58a2a, rough: 0.5, coat: 0.35 }, q);
  const white = toyMat({ color: 0xfff8ec, rough: 0.6, coat: 0.2 }, q);
  const dark = toyMat({ color: 0x3a2a26, rough: 0.5, coat: 0.3 }, q);
  mesh(ball(0.34, 0.95, 0.9, 1.25, 14), orange, 0, 0.42, -0.05, G);
  mesh(ball(0.2, 0.9, 1, 0.8, 10), white, 0, 0.36, 0.22, G, false);
  const head = new THREE.Group();
  head.position.set(0, 0.76, 0.32);
  G.add(head);
  mesh(ball(0.3, 1.1, 0.92, 1, 16), orange, 0, 0, 0, head);
  const muzzle = ball(0.15, 1, 0.75, 1.2, 10);
  mesh(muzzle, white, 0, -0.07, 0.24, head, false);
  mesh(ball(0.04, 1.1, 0.85, 0.8, 8), dark, 0, -0.04, 0.42, head, false);
  for (const s of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.12, 0.3, 8);
    mesh(ear, orange, s * 0.19, 0.3, -0.02, head);
    const inner = new THREE.ConeGeometry(0.06, 0.2, 6);
    mesh(inner, white, s * 0.19, 0.27, 0.05, head, false);
    mesh(ball(0.06, 0.9, 1.05, 0.6, 8), new THREE.MeshPhysicalMaterial({ color: 0x17121a, roughness: 0.1, clearcoat: 1 }), s * 0.13, 0.05, 0.25, head, false);
    mesh(ball(0.02, 1, 1, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), s * 0.115, 0.08, 0.29, head, false);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.02), dark);
    brow.position.set(s * 0.135, 0.13, 0.26);
    brow.rotation.z = -s * 0.42;
    head.add(brow);
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.45, -0.4);
  G.add(tail);
  mesh(ball(0.2, 0.85, 0.85, 1.7, 12), orange, 0, 0.1, -0.26, tail);
  mesh(ball(0.14, 0.9, 0.9, 1.1, 10), white, 0, 0.2, -0.56, tail, false);
  const legs = [];
  for (const [x, z] of [[-0.17, 0.2], [0.17, 0.2], [-0.17, -0.25], [0.17, -0.25]]) {
    const l = mesh(ball(0.075, 1, 1.6, 1, 8), dark, x, 0.11, z, G);
    legs.push(l);
  }
  G.userData = { head, tail, legs };
  return G;
}
export function makeGeyser(o, q) {
  const G = new THREE.Group();
  const ring = lathe([[o.r * 1.25, 0.0], [o.r * 1.18, 0.16], [o.r * 0.96, 0.2], [o.r * 0.88, 0.1]], 22, 10);
  mesh(ring, toyMat({ color: 0xc8ecff, rough: 0.18, coat: 1 }, q), 0, 0, 0, G);
  const pool = new THREE.CircleGeometry(o.r * 0.92, 22);
  pool.rotateX(-Math.PI / 2);
  const poolM = new THREE.MeshStandardMaterial({ color: 0x1b9ad6, roughness: 0.15, emissive: 0x0a5a88, emissiveIntensity: 0.25 });
  mesh(pool, poolM, 0, 0.12, 0, G, false);
  G.userData.pool = poolM;
  const colG = new THREE.CylinderGeometry(o.r * 0.42, o.r * 0.82, 1, 18, 8, true);
  colG.translate(0, 0.5, 0);
  const colM = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { t: { value: 0 } },
    vertexShader: "varying vec2 vU;uniform float t;void main(){vU=uv;vec3 p=position;float w=sin(p.y*8.+t*14.+atan(p.z,p.x)*3.)*.09*p.y;p.xz*=1.+w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}",
    fragmentShader: `varying vec2 vU;uniform float t;void main(){float s=sin(vU.x*30.+vU.y*14.-t*12.)*.5+.5;vec3 c=mix(vec3(.28,.74,.98),vec3(.92,.99,1.),smoothstep(.35,1.,s));gl_FragColor=vec4(c,.9*smoothstep(1.,.74,vU.y));}`,
  });
  const col = new THREE.Mesh(colG, colM);
  col.scale.y = 0.001;
  G.add(col);
  G.userData.col = col;
  G.userData.colM = colM;
  return G;
}
export function makeWindmill(o, hw, q) {
  const G = new THREE.Group();
  // 길을 가로지르는 나무 문 + 날개
  const wood = toyMat({ color: 0x9a6a3c, rough: 0.66, coat: 0.15 }, q);
  const postH = o.hub + 0.75;
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.45);
    const p = new THREE.CylinderGeometry(0.18, 0.26, postH, 10);
    mesh(p, wood, x, postH / 2, 0, G);
    mesh(ball(0.3, 1, 0.5, 1, 10), toyMat({ color: 0xffffff, rough: 0.9, coat: 0 }, q), x, postH + 0.05, 0, G);
  }
  const beam = new THREE.CylinderGeometry(0.14, 0.14, hw * 2 + 0.9, 10);
  beam.rotateZ(Math.PI / 2);
  mesh(beam, wood, 0, postH - 0.08, 0, G);
  const strut = new THREE.CylinderGeometry(0.1, 0.1, 0.75, 8);
  mesh(strut, wood, 0, o.hub + 0.38, -0.2, G);
  const rotor = new THREE.Group();
  rotor.position.set(0, o.hub, 0.05);
  G.add(rotor);
  mesh(ball(0.26, 1, 1, 0.7, 14), toyMat({ color: 0xff5a5f, rough: 0.3, coat: 0.8 }, q), 0, 0, 0.02, rotor);
  const cloth = toyMat({ color: 0xfff4dc, rough: 0.6, coat: 0.1, side: THREE.DoubleSide }, q);
  for (let k = 0; k < o.blades; k += 1) {
    const b = new THREE.Group();
    const stick = new THREE.CylinderGeometry(0.05, 0.06, o.blade, 6);
    stick.rotateZ(Math.PI / 2);
    stick.translate(o.blade / 2, 0, 0);
    mesh(stick, wood, 0, 0, 0, b);
    const sail = new THREE.BoxGeometry(o.blade * 0.82, 0.62, 0.05, 4, 2, 1);
    roundBox(sail, o.blade * 0.82, 0.62, 0.05, 0.02);
    sail.translate(o.blade * 0.56, 0.2, 0);
    mesh(sail, k % 2 ? toyMat({ color: 0xff8a7a, rough: 0.6, coat: 0.1 }, q) : cloth, 0, 0, 0, b);
    b.rotation.z = (k / o.blades) * TAU;
    rotor.add(b);
  }
  G.userData.rotor = rotor;
  return G;
}
export function makeHole(r, q) {
  const G = new THREE.Group();
  const water = new THREE.CircleGeometry(r, 24);
  water.rotateX(-Math.PI / 2);
  mesh(water, new THREE.MeshStandardMaterial({ color: 0x0d4c78, roughness: 0.12, emissive: 0x062e4d, emissiveIntensity: 0.4 }), 0, 0.012, 0, G, false);
  const rim = new THREE.TorusGeometry(r, 0.09, 8, 28);
  rim.rotateX(Math.PI / 2);
  rim.scale(1, 0.55, 1);
  mesh(rim, toyMat({ color: 0xffffff, rough: 0.7, coat: 0.1 }, q), 0, 0.03, 0, G, false);
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * TAU + 0.3;
    const c = new THREE.Mesh(new THREE.TetrahedronGeometry(0.13 + (i % 3) * 0.04), toyMat({ color: 0xc8ecff, rough: 0.2, coat: 0.8 }, q));
    c.position.set(Math.cos(a) * (r + 0.05), 0.05, Math.sin(a) * (r + 0.05));
    c.rotation.set(i, i * 2, 0);
    G.add(c);
  }
  return G;
}
export function makeFlag(q) {
  const G = new THREE.Group();
  const pole = new THREE.CylinderGeometry(0.05, 0.065, 2.7, 8);
  mesh(pole, toyMat({ color: 0xf2f5fb, rough: 0.3, coat: 0.5 }, q), 0, 1.35, 0, G);
  mesh(ball(0.1, 1, 1, 1, 10), toyMat({ color: 0xffd24a, rough: 0.3, coat: 0.8 }, q), 0, 2.75, 0, G);
  mesh(lathe([[0.42, 0.0], [0.3, 0.12], [0.08, 0.22]], 12, 6), toyMat({ color: 0xffffff, rough: 0.9, coat: 0 }, q), 0, 0, 0, G);
  const shape = new THREE.PlaneGeometry(0.85, 0.56, 8, 4);
  shape.translate(0.43, 0, 0);
  const flag = new THREE.Mesh(shape, toyMat({ color: 0xb9c3d3, rough: 0.6, coat: 0.1, side: THREE.DoubleSide }, q));
  flag.position.y = 1.55;
  flag.castShadow = true;
  G.add(flag);
  G.userData.flag = flag;
  return G;
}

/* ---------- 아이템 ---------- */
export function fishGeo() {
  const sh = new THREE.Shape();
  sh.moveTo(-0.32, 0);
  sh.bezierCurveTo(-0.16, 0.2, 0.14, 0.2, 0.27, 0.03);
  sh.lineTo(0.42, 0.16);
  sh.quadraticCurveTo(0.38, 0, 0.42, -0.16);
  sh.lineTo(0.27, -0.03);
  sh.bezierCurveTo(0.14, -0.2, -0.16, -0.2, -0.32, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -0.025);
  g.computeVertexNormals();
  return g;
}
export function makeItem(kind, q) {
  const G = new THREE.Group();
  const bubble = (col) => {
    const b = new THREE.Mesh(ball(0.62, 1, 1, 1, 18), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.22, depthWrite: false }));
    G.add(b);
  };
  if (kind === "star") {
    const m = toyMat({ color: 0xffd338, rough: 0.2, coat: 1, emissive: 0xffa800, emissiveIntensity: 0.42 }, q);
    mesh(starGeo(0.46, 0.22, 0.14), m, 0, 0, 0, G);
  } else if (kind === "boost") {
    bubble(0xffd24a);
    const sh = new THREE.Shape();
    sh.moveTo(0.05, 0.38);
    sh.lineTo(-0.22, -0.04);
    sh.lineTo(-0.02, -0.04);
    sh.lineTo(-0.07, -0.38);
    sh.lineTo(0.24, 0.08);
    sh.lineTo(0.04, 0.08);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    g.translate(0, 0, -0.04);
    mesh(g, toyMat({ color: 0xffb21a, rough: 0.2, coat: 1, emissive: 0xff7a00, emissiveIntensity: 0.4 }, q), 0, 0, 0, G);
  } else if (kind === "magnet") {
    bubble(0xff6a6a);
    const t = new THREE.TorusGeometry(0.22, 0.09, 10, 18, Math.PI);
    const red = toyMat({ color: 0xe9383f, rough: 0.28, coat: 0.8 }, q);
    mesh(t, red, 0, 0.04, 0, G);
    const silver = toyMat({ color: 0xe5ebf5, rough: 0.2, coat: 0.8 }, q);
    for (const s of [-1, 1]) {
      const leg = new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10);
      mesh(leg, silver, s * 0.22, -0.08, 0, G);
    }
  } else if (kind === "shield") {
    bubble(0x62c4ff);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.34);
    sh.bezierCurveTo(0.14, 0.27, 0.26, 0.26, 0.3, 0.24);
    sh.bezierCurveTo(0.32, -0.02, 0.2, -0.22, 0, -0.36);
    sh.bezierCurveTo(-0.2, -0.22, -0.32, -0.02, -0.3, 0.24);
    sh.bezierCurveTo(-0.26, 0.26, -0.14, 0.27, 0, 0.34);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -0.035);
    mesh(g, toyMat({ color: 0x3aa5f5, rough: 0.2, coat: 1 }, q), 0, 0, 0, G);
    mesh(starGeo(0.13, 0.06, 0.03), toyMat({ color: 0xffffff, rough: 0.3, coat: 0.5 }, q), 0, 0, 0.09, G, false);
  } else if (kind === "bubble") {
    bubble(0xbef1ff);
    const pack = rbox(0.46, 0.46, 0.3, 0.1, 3);
    mesh(pack, toyMat({ color: 0xd9f6ff, rough: 0.15, coat: 1, transparent: true, opacity: 0.85 }, q), 0, 0, 0, G);
    for (let i = 0; i < 9; i += 1) {
      mesh(ball(0.05, 1, 1, 0.5, 8), toyMat({ color: 0xffffff, rough: 0.1, coat: 1 }, q), -0.13 + (i % 3) * 0.13, -0.13 + Math.floor(i / 3) * 0.13, 0.16, G, false);
    }
  }
  return G;
}

/* ---------- 마을 건물 ---------- */
export function makeHouse(style, q) {
  const G = new THREE.Group();
  const palette = {
    village: { wall: 0xffd9a8, roof: 0xe05a50, trim: 0x8d5a2e },
    canyon: { wall: 0xc9d7e6, roof: 0x4d8fd1, trim: 0x546a85 },
    sea: { wall: 0xffffff, roof: 0xe9463c, trim: 0x3a6c98 },
    peaks: { wall: 0xb88a5c, roof: 0x6a7a55, trim: 0x5a3c22 },
    aurora: { wall: 0xdcd2ff, roof: 0x7a5cff, trim: 0x4b38b5 },
  }[style] || { wall: 0xffd9a8, roof: 0xe05a50, trim: 0x8d5a2e };
  const wall = toyMat({ color: palette.wall, rough: 0.62, coat: 0.15 }, q);
  const trim = toyMat({ color: palette.trim, rough: 0.55, coat: 0.2 }, q);
  const body = rbox(4.2, 3, 3.6, 0.3, 4);
  const b = mesh(body, wall, 0, 1.5, 0, G);
  b.receiveShadow = true;
  // 지붕: 둥글게 부푼 삼각
  const roofG = new THREE.CylinderGeometry(0.01, 3.1, 2.3, 4, 3);
  roofG.rotateY(Math.PI / 4);
  roofG.scale(1.1, 1, 0.98);
  const p = roofG.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const k = 1 + Math.sin(((p.getY(i) + 1.15) / 2.3) * Math.PI) * 0.06;
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  roofG.computeVertexNormals();
  mesh(roofG, toyMat({ color: palette.roof, rough: 0.4, coat: 0.5 }, q), 0, 4.1, 0, G);
  // 지붕 위 눈
  const snowM = toyMat({ color: 0xffffff, rough: 0.86, coat: 0 }, q);
  mesh(ball(2.02, 1.18, 0.34, 1, 16), snowM, 0, 4.72, 0, G);
  mesh(ball(1.05, 1.1, 0.5, 1, 12), snowM, 0, 5.1, 0, G);
  // 문
  const door = rbox(1.06, 1.85, 0.2, 0.2, 3);
  mesh(door, toyMat({ color: 0xc2583e, rough: 0.5, coat: 0.35 }, q), 0, 0.98, 1.8, G);
  mesh(ball(0.07, 1, 1, 1, 8), toyMat({ color: 0xffd24a, rough: 0.2, coat: 1 }, q), 0.32, 0.95, 1.94, G, false);
  // 창문: 따뜻한 불빛
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffaa33, emissiveIntensity: 1.1, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const f = rbox(0.86, 0.86, 0.14, 0.1, 2);
    mesh(f, trim, s * 1.44, 1.86, 1.78, G, false);
    mesh(rbox(0.66, 0.66, 0.1, 0.08, 2), glow, s * 1.44, 1.86, 1.84, G, false);
  }
  // 굴뚝
  const chim = rbox(0.6, 1.3, 0.6, 0.12, 2);
  mesh(chim, toyMat({ color: 0xb45c48, rough: 0.7, coat: 0.05 }, q), 1.25, 5, -0.55, G);
  mesh(ball(0.42, 1.1, 0.45, 1.1, 10), snowM, 1.25, 5.68, -0.55, G);
  G.userData.chimney = new THREE.Vector3(1.25, 5.8, -0.55);
  // 우체통
  const box = rbox(0.74, 0.54, 0.54, 0.14, 3);
  mesh(box, toyMat({ color: 0xe9463c, rough: 0.34, coat: 0.7 }, q), 2.75, 1.34, 2.2, G);
  mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 8), trim, 2.75, 0.55, 2.2, G);
  mesh(ball(0.42, 1, 0.4, 0.8, 8), snowM, 2.75, 1.66, 2.2, G, false);
  return G;
}
/** 도착지에서 기다리는 손님 (손을 흔드는 작은 곰) */
export function makeNpc(q) {
  const G = new THREE.Group();
  const fur = toyMat({ color: 0xf7f2e8, rough: 0.62, coat: 0.2 }, q);
  const low = lathe([[0.001, 0.03], [0.26, 0.05], [0.36, 0.22], [0.34, 0.46], [0.22, 0.62], [0.001, 0.66]], 16, 12);
  mesh(low, fur, 0, 0, 0, G);
  const head = new THREE.Group();
  head.position.y = 0.88;
  G.add(head);
  mesh(ball(0.36, 1.05, 0.95, 1, 16), fur, 0, 0, 0, head);
  for (const s of [-1, 1]) {
    mesh(ball(0.12, 1, 1, 0.7, 10), fur, s * 0.28, 0.27, -0.02, head);
    mesh(ball(0.05, 1, 1.1, 0.5, 8), new THREE.MeshPhysicalMaterial({ color: 0x14121c, roughness: 0.08, clearcoat: 1 }), s * 0.14, 0.05, 0.32, head, false);
    mesh(ball(0.018, 1, 1, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), s * 0.125, 0.075, 0.355, head, false);
  }
  mesh(ball(0.12, 1.1, 0.78, 0.8, 10), toyMat({ color: 0xffffff, rough: 0.5, coat: 0.3 }, q), 0, -0.07, 0.3, head, false);
  mesh(ball(0.038, 1.1, 0.85, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x1b1626, roughness: 0.3 }), 0, -0.04, 0.39, head, false);
  const scarf = new THREE.TorusGeometry(0.24, 0.06, 8, 18);
  scarf.rotateX(Math.PI / 2);
  mesh(scarf, toyMat({ color: 0x46b3e8, rough: 0.7, coat: 0.1 }, q), 0, 0.64, 0, G);
  const arm = new THREE.Group();
  arm.position.set(0.3, 0.5, 0);
  G.add(arm);
  const ag = ball(0.09, 1, 2, 1, 10);
  ag.translate(0, 0.16, 0);
  mesh(ag, fur, 0, 0, 0, arm);
  G.userData = { arm, head };
  return G;
}
/** 시작 지점: 택배 보관대 */
export function makeDepot(q) {
  const G = new THREE.Group();
  const wood = toyMat({ color: 0x9a6a3c, rough: 0.66, coat: 0.12 }, q);
  for (const [x, z] of [[-1.5, 0], [1.5, 0]]) mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 8), wood, x, 1.4, z, G);
  const sign = rbox(3.5, 0.92, 0.2, 0.14, 3);
  const [c, g] = canvas(512, 136);
  g.fillStyle = "#e9463c";
  g.fillRect(0, 0, 512, 136);
  g.fillStyle = "#fff";
  g.font = '700 74px "Jua","Noto Sans KR",sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("펭귄 택배", 256, 72);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.86), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.5 }));
  face.position.set(0, 2.55, 0.115);
  const b = mesh(sign, toyMat({ color: 0xc23b33, rough: 0.5, coat: 0.3 }, q), 0, 2.55, 0, G);
  void b;
  G.add(face);
  mesh(ball(1.9, 1, 0.14, 0.34, 12), toyMat({ color: 0xffffff, rough: 0.9, coat: 0 }, q), 0, 3.06, 0, G);
  const kinds = ["normal", "big", "light", "express"];
  [[-2.3, 0.35, 0.8, 0], [-3, 0.35, 0.8, 1], [-2.6, 1.05, 0.62, 2], [2.4, 0.3, 0.7, 3], [3.1, 0.3, 0.7, 0]].forEach(([x, y, s, i]) => {
    const bx = makeBox(kinds[i], s, q);
    bx.position.set(x, y, -0.2);
    bx.rotation.y = i * 0.7;
    G.add(bx);
  });
  return G;
}
/** 도착 표시: 바닥 고리와 위로 올라오는 빛 */
export function makeGoalRing(r) {
  const G = new THREE.Group();
  const ringG = new THREE.RingGeometry(r * 0.86, r, 48);
  ringG.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.92, depthWrite: false }));
  ring.position.y = 0.04;
  G.add(ring);
  const inner = new THREE.CircleGeometry(r * 0.86, 40);
  inner.rotateX(-Math.PI / 2);
  const innerM = new THREE.Mesh(inner, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.28, depthWrite: false }));
  innerM.position.y = 0.03;
  G.add(innerM);
  const col = new THREE.CylinderGeometry(r, r, 3.4, 40, 1, true);
  col.translate(0, 1.7, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { t: { value: 0 } },
    vertexShader: "varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 vU;uniform float t;void main(){float a=pow(1.-vU.y,2.2)*(.55+.2*sin(vU.y*14.-t*4.));gl_FragColor=vec4(1.,.86,.36,a);}`,
  });
  const beam = new THREE.Mesh(col, m);
  G.add(beam);
  G.userData.beamM = m;
  G.userData.ring = ring;
  return G;
}
