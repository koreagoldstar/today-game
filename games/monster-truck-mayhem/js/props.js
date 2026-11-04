/* 부서지는 물체 모델 · 인스턴스 묶음 · 파편.
 * 종류마다 InstancedMesh 하나: 수백 개를 그려도 가볍다. 색은 꼭짓점 색 + 인스턴스 색.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { mergeGeos, roundedBox } from "./truckmodel.js";

function tint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    a[i * 3] = c.r;
    a[i * 3 + 1] = c.g;
    a[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
const moved = (g, x, y, z, rx = 0, ry = 0, rz = 0) => {
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
};
const B = (w, h, d, color, x = 0, y = 0, z = 0, r = 0, rot = [0, 0, 0]) => moved(tint(r > 0 ? roundedBox(w, h, d, r, 1) : new THREE.BoxGeometry(w, h, d), color), x, y, z, ...rot);
const C = (r0, r1, h, color, x = 0, y = 0, z = 0, seg = 12, rot = [0, 0, 0]) => moved(tint(new THREE.CylinderGeometry(r0, r1, h, seg), color), x, y, z, ...rot);

function ringTire(R, w, color = "#232327") {
  return tint(new THREE.TorusGeometry(R, w, 8, 16).rotateX(Math.PI / 2), color);
}

/* 차 한 대: 옆모습을 뽑아낸 작은 승용차 */
function carGeometry(hx, hy, hz) {
  const shape = new THREE.Shape();
  const P = [
    [-hz, -hy * 0.15], [-hz * 0.98, hy * 0.2], [-hz * 0.5, hy * 0.28], [-hz * 0.3, hy * 0.98], [hz * 0.25, hy], [hz * 0.5, hy * 0.28], [hz * 0.97, hy * 0.12], [hz, -hy * 0.15], [hz, -hy * 0.5], [-hz, -hy * 0.5],
  ];
  P.forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
  shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: hx * 2 - 0.16, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  body.translate(0, 0, -(hx * 2 - 0.16) / 2);
  body.rotateY(-Math.PI / 2);
  const parts = [tint(body, "#ffffff")];
  // 창
  const glass = "#1a2733";
  parts.push(B(hx * 2 + 0.02, hy * 0.5, hz * 0.62, glass, 0, hy * 0.62, -hz * 0.02));
  parts.push(B(hx * 1.8, hy * 0.5, 0.08, glass, 0, hy * 0.6, hz * 0.36, 0, [0.7, 0, 0]));
  parts.push(B(hx * 1.8, hy * 0.5, 0.08, glass, 0, hy * 0.62, -hz * 0.4, 0, [-0.7, 0, 0]));
  // 찌그러진 자국 · 녹
  parts.push(B(hx * 1.3, 0.05, hz * 0.34, "#8a5a34", 0, hy * 0.34, hz * 0.7));
  // 앞뒤 범퍼
  parts.push(B(hx * 2 + 0.1, 0.16, 0.14, "#55585e", 0, -hy * 0.32, hz + 0.02));
  parts.push(B(hx * 2 + 0.1, 0.16, 0.14, "#55585e", 0, -hy * 0.32, -hz - 0.02));
  // 바퀴
  for (const s of [-1, 1]) {
    for (const k of [-1, 1]) {
      parts.push(C(0.34, 0.34, 0.24, "#17181b", s * (hx - 0.05), -hy * 0.56, k * hz * 0.62, 12, [0, 0, Math.PI / 2]));
      parts.push(C(0.15, 0.15, 0.26, "#9a9da3", s * (hx - 0.05), -hy * 0.56, k * hz * 0.62, 8, [0, 0, Math.PI / 2]));
    }
  }
  return mergeGeos(parts);
}

/* 종류별 모델. 원점은 물체 가운데 */
const GEO = {
  crate() {
    const c = "#c08a4a";
    const d = "#8c5e2c";
    const parts = [B(1.5, 1.5, 1.5, c)];
    for (const s of [-1, 1]) {
      parts.push(B(1.62, 0.2, 0.1, d, 0, s * 0.68, 0.78), B(1.62, 0.2, 0.1, d, 0, s * 0.68, -0.78));
      parts.push(B(0.1, 0.2, 1.62, d, 0.78, s * 0.68, 0), B(0.1, 0.2, 1.62, d, -0.78, s * 0.68, 0));
      parts.push(B(0.2, 1.3, 0.1, d, s * 0.68, 0, 0.78), B(0.2, 1.3, 0.1, d, s * 0.68, 0, -0.78));
      parts.push(B(0.1, 1.3, 0.2, d, 0.78, 0, s * 0.68), B(0.1, 1.3, 0.2, d, -0.78, 0, s * 0.68));
    }
    parts.push(B(1.9, 0.18, 0.06, "#a87438", 0, 0, 0.8, 0, [0, 0, 0.78]), B(1.9, 0.18, 0.06, "#a87438", 0, 0, -0.8, 0, [0, 0, -0.78]));
    parts.push(B(0.06, 0.18, 1.9, "#a87438", 0.8, 0, 0, 0, [0.78, 0, 0]), B(0.06, 0.18, 1.9, "#a87438", -0.8, 0, 0, 0, [-0.78, 0, 0]));
    return parts;
  },
  fence() {
    const parts = [];
    for (let i = 0; i < 5; i += 1) parts.push(B(0.34, 1.86, 0.12, i % 2 ? "#a8743e" : "#b98549", -2 + i, 0, 0));
    parts.push(B(5, 0.18, 0.08, "#8c5e2c", 0, 0.52, 0.08), B(5, 0.18, 0.08, "#8c5e2c", 0, -0.48, 0.08));
    parts.push(B(5.2, 0.16, 0.08, "#8c5e2c", 0, 0.02, 0.1, 0, [0, 0, 0.2]));
    return parts;
  },
  concrete() {
    return [
      B(2.9, 1.6, 1.5, "#a9a69e", 0, 0, 0, 0.12),
      B(2.92, 0.14, 1.52, "#8c8982", 0, 0.45, 0),
      B(0.3, 0.14, 0.14, "#5d5a54", -0.9, 0.84, 0.3, 0, [0, 0, 0.3]),
      C(0.04, 0.04, 0.5, "#6a4a36", 0.6, 0.95, 0.3, 5, [0.3, 0, 0.2]),
      C(0.04, 0.04, 0.5, "#6a4a36", 0.2, 0.95, -0.3, 5, [-0.3, 0, -0.1]),
    ];
  },
  tires() {
    return [moved(ringTire(0.62, 0.3), 0, -0.45, 0), moved(ringTire(0.6, 0.3), 0.06, 0.02, -0.05), moved(ringTire(0.56, 0.28), -0.05, 0.47, 0.05, 0.08, 0, 0.06)];
  },
  wreck(h) {
    return [carGeometry(h[0], h[1], h[2])];
  },
  drum() {
    return [C(0.46, 0.46, 1.3, "#5b7f95", 0, 0, 0, 14), C(0.48, 0.48, 0.06, "#3f5a6b", 0, 0.32, 0, 14), C(0.48, 0.48, 0.06, "#3f5a6b", 0, -0.32, 0, 14), C(0.47, 0.47, 0.04, "#3f5a6b", 0, 0.64, 0, 14), C(0.47, 0.47, 0.04, "#3f5a6b", 0, -0.64, 0, 14)];
  },
  boom() {
    const parts = [C(0.5, 0.5, 1.42, "#e0261c", 0, 0, 0, 16), C(0.51, 0.51, 0.3, "#ffd21f", 0, 0.1, 0, 16), C(0.52, 0.52, 0.06, "#8e1410", 0, 0.68, 0, 16), C(0.52, 0.52, 0.06, "#8e1410", 0, -0.68, 0, 16), C(0.1, 0.1, 0.12, "#333", 0.2, 0.76, 0.1, 8)];
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      parts.push(B(0.36, 0.22, 0.03, "#1b1b1b", Math.sin(a) * 0.51, 0.1, Math.cos(a) * 0.51, 0, [0, a, 0]));
    }
    return parts;
  },
  barrier() {
    return [B(3, 0.6, 0.62, "#f04b3c", 0, -0.22, 0, 0.1), B(2.8, 0.5, 0.36, "#ffffff", 0, 0.28, 0, 0.08), B(0.7, 0.12, 0.4, "#f04b3c", -0.9, 0.32, 0), B(0.7, 0.12, 0.4, "#f04b3c", 0.9, 0.32, 0)];
  },
  timber() {
    const parts = [];
    const c = "#b57f42";
    const d = "#8a5c2a";
    for (const x of [-2, 2]) for (const z of [-2, 2]) parts.push(B(0.36, 4.4, 0.36, d, x, 0, z));
    for (const y of [-0.9, 1.0, 2]) {
      for (const s of [-2, 2]) {
        parts.push(B(4.4, 0.26, 0.26, c, 0, y, s), B(0.26, 0.26, 4.4, c, s, y, 0));
      }
    }
    parts.push(B(5.5, 0.22, 0.2, c, 0, 0, 2.1, 0, [0, 0, 0.8]), B(5.5, 0.22, 0.2, c, 0, 0, -2.1, 0, [0, 0, -0.8]));
    parts.push(B(0.2, 0.22, 5.5, c, 2.1, 0, 0, 0, [0.8, 0, 0]), B(0.2, 0.22, 5.5, c, -2.1, 0, 0, 0, [-0.8, 0, 0]));
    for (let i = 0; i < 6; i += 1) parts.push(B(4.2, 0.08, 0.6, "#c8955a", 0, 2.14, -1.8 + i * 0.72));
    return parts;
  },
  container() {
    const parts = [B(2.6, 2.7, 6.6, "#ffffff")];
    for (let i = 0; i < 16; i += 1) {
      const z = -3 + i * 0.4;
      for (const s of [-1, 1]) parts.push(B(0.06, 2.5, 0.2, "#d9d9d9", s * 1.32, 0, z));
    }
    for (const s of [-1, 1]) {
      parts.push(B(2.7, 0.14, 6.7, "#bdbdbd", 0, s * 1.31, 0));
      parts.push(B(2.7, 2.72, 0.12, "#bdbdbd", 0, 0, s * 3.27));
    }
    for (let i = 0; i < 4; i += 1) parts.push(C(0.03, 0.03, 2.4, "#777", -0.8 + i * 0.5, 0, -3.36, 6));
    return parts;
  },
  tirewall() {
    const parts = [];
    for (let i = 0; i < 6; i += 1) {
      const c = i % 2 ? "#232327" : "#f2f2f2";
      parts.push(moved(tint(new THREE.TorusGeometry(0.4, 0.2, 8, 14), "#232327"), -2.5 + i, -0.5, 0, Math.PI / 2));
      parts.push(moved(tint(new THREE.TorusGeometry(0.4, 0.2, 8, 14), c), -2.5 + i, -0.05, 0, Math.PI / 2));
      parts.push(moved(tint(new THREE.TorusGeometry(0.4, 0.2, 8, 14), "#232327"), -2.5 + i, 0.4, 0, Math.PI / 2));
    }
    return parts;
  },
  girder() {
    const y = "#f0b71f";
    const d = "#a97b10";
    const parts = [];
    for (const x of [-2.8, 2.8]) for (const z of [-2.8, 2.8]) parts.push(B(0.34, 6.2, 0.34, y, x, 0, z));
    for (const h of [-2.9, 0, 2.9]) {
      for (const s of [-2.8, 2.8]) {
        parts.push(B(5.8, 0.28, 0.28, d, 0, h, s), B(0.28, 0.28, 5.8, d, s, h, 0));
      }
    }
    for (const s of [-2.8, 2.8]) {
      parts.push(B(4.2, 0.16, 0.16, y, 0, -1.45, s, 0, [0, 0, 0.45]), B(4.2, 0.16, 0.16, y, 0, 1.45, s, 0, [0, 0, -0.45]));
      parts.push(B(0.16, 0.16, 4.2, y, s, -1.45, 0, 0, [0.45, 0, 0]), B(0.16, 0.16, 4.2, y, s, 1.45, 0, 0, [-0.45, 0, 0]));
    }
    return parts;
  },
  cone() {
    return [C(0.05, 0.3, 0.74, "#ff7a1f", 0, 0.03, 0, 12), C(0.15, 0.2, 0.16, "#ffffff", 0, 0.08, 0, 12), B(0.64, 0.08, 0.64, "#d15a10", 0, -0.4, 0)];
  },
  sign() {
    const parts = [C(0.12, 0.14, 4.8, "#6d7077", -2.2, 0, 0, 8), C(0.12, 0.14, 4.8, "#6d7077", 2.2, 0, 0, 8), B(5.8, 2.4, 0.16, "#ffcf1f", 0, 1.1, 0), B(5.9, 0.14, 0.2, "#2a2a2a", 0, 2.3, 0), B(5.9, 0.14, 0.2, "#2a2a2a", 0, -0.1, 0)];
    for (let i = 0; i < 4; i += 1) parts.push(B(0.9, 1.6, 0.05, i % 2 ? "#e0261c" : "#2a2a2a", -1.95 + i * 1.3, 1.1, 0.1));
    return parts;
  },
  rock() {
    const g = new THREE.IcosahedronGeometry(1.5, 1);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 1) {
      const n = Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.2) * 0.2 + Math.cos(p.getY(i) * 2.6) * 0.14;
      const k = 1 + n;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k);
      const hot = n > 0.2;
      cols[i * 3] = hot ? 1 : 0.2;
      cols[i * 3 + 1] = hot ? 0.34 : 0.17;
      cols[i * 3 + 2] = hot ? 0.08 : 0.16;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return [g];
  },
  iceblock() {
    return [B(2.9, 2.7, 2.9, "#a8e4ff", 0, 0, 0, 0.14), B(1.6, 0.05, 2.92, "#e6f8ff", -0.3, 0.4, 0, 0, [0, 0, 0.4]), B(2.92, 0.05, 1.1, "#e6f8ff", 0, -0.5, 0.2, 0, [0.5, 0, 0])];
  },
  snowman() {
    const parts = [moved(tint(new THREE.SphereGeometry(0.8, 12, 10), "#ffffff"), 0, -0.45, 0), moved(tint(new THREE.SphereGeometry(0.56, 12, 10), "#ffffff"), 0, 0.5, 0), moved(tint(new THREE.ConeGeometry(0.1, 0.5, 8), "#ff7a1f"), 0, 0.55, 0.65, Math.PI / 2)];
    for (const s of [-1, 1]) parts.push(moved(tint(new THREE.SphereGeometry(0.07, 6, 6), "#18181b"), s * 0.2, 0.72, 0.48));
    parts.push(C(0.34, 0.34, 0.34, "#22232a", 0, 1.1, 0, 12), C(0.5, 0.5, 0.05, "#22232a", 0, 0.93, 0, 12));
    return parts;
  },
  snowpile() {
    const parts = [];
    const pts = [[0, -0.4, 0, 1.3], [-1, -0.5, 0.3, 0.9], [1, -0.55, -0.3, 0.85], [0.3, -0.2, 0.7, 0.7], [-0.4, 0, -0.5, 0.7]];
    for (const q of pts) {
      const g = new THREE.SphereGeometry(q[3], 10, 8);
      g.scale(1.1, 0.72, 1);
      parts.push(moved(tint(g, "#f4fbff"), q[0], q[1], q[2]));
    }
    return parts;
  },
  snowball() {
    const g = new THREE.IcosahedronGeometry(1.9, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const k = 1 + Math.sin(p.getX(i) * 4 + p.getY(i) * 3) * 0.05;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return [tint(g, "#ffffff")];
  },
  plank() {
    const parts = [];
    for (let i = 0; i < 6; i += 1) parts.push(B(5.6, 0.28, 0.38, i % 2 ? "#b57f42" : "#a06d36", 0, 0, -1 + i * 0.4));
    parts.push(B(0.2, 0.34, 2.4, "#6b4722", -2.4, -0.1, 0), B(0.2, 0.34, 2.4, "#6b4722", 2.4, -0.1, 0));
    return parts;
  },
  pillar() {
    const parts = [B(1.8, 7.2, 1.8, "#d8392b", 0, 0, 0, 0.1)];
    for (let i = 0; i < 6; i += 1) parts.push(B(1.9, 0.18, 1.9, "#ffffff", 0, -3 + i * 1.2, 0));
    parts.push(B(2.4, 0.3, 2.4, "#5d6068", 0, -3.45, 0));
    return parts;
  },
  beam() {
    const parts = [B(8, 1.2, 0.2, "#f0b71f", 0, 0, 0), B(8, 0.16, 1.2, "#c8920f", 0, 0.52, 0), B(8, 0.16, 1.2, "#c8920f", 0, -0.52, 0)];
    return parts;
  },
  dumper(h) {
    const [hx, hy, hz] = h;
    const parts = [];
    // 짐칸
    parts.push(B(hx * 2, hy * 0.9, hz * 1.25, "#f0b71f", 0, hy * 0.42, -hz * 0.3, 0.2));
    parts.push(B(hx * 2 + 0.1, 0.3, hz * 1.26, "#c8920f", 0, hy * 0.82, -hz * 0.3));
    // 운전석
    parts.push(B(hx * 1.3, hy * 0.72, hz * 0.5, "#e2a716", -hx * 0.3, hy * 0.3, hz * 0.68, 0.2));
    parts.push(B(hx * 1.32, hy * 0.28, hz * 0.34, "#1a2733", -hx * 0.3, hy * 0.42, hz * 0.8));
    parts.push(B(hx * 2, hy * 0.2, hz * 0.3, "#3a3d44", 0, -hy * 0.2, hz * 0.95));
    // 큰 바퀴
    for (const s of [-1, 1]) {
      for (const z of [-0.62, 0.62]) {
        parts.push(C(hy * 0.5, hy * 0.5, hx * 0.5, "#1a1b1f", s * hx * 0.84, -hy * 0.5, z * hz, 18, [0, 0, Math.PI / 2]));
        parts.push(C(hy * 0.22, hy * 0.22, hx * 0.54, "#c8920f", s * hx * 0.84, -hy * 0.5, z * hz, 10, [0, 0, Math.PI / 2]));
      }
    }
    return parts;
  },
};

const GLASSY = new Set(["glass", "iceblock"]);

/** 장면에 물체 묶음을 만든다 */
export class PropBatch {
  constructor(scene, sim, quality) {
    this.scene = scene;
    this.sim = sim;
    this.groups = new Map();
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
    const by = new Map();
    for (const o of sim.objects) {
      const key = o.type + (o.big !== 1 ? `:${o.big}` : "");
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(o);
    }
    const CAR_COLORS = ["#c75a4a", "#5a8fbd", "#d8b23e", "#6a9a5c", "#c8c8cc", "#8a6fb5", "#e08a3a", "#4a4f5c"];
    for (const [key, list] of by) {
      const type = list[0].type;
      const h = list[0].h;
      let inst;
      if (type === "glass") {
        // 틀(불투명) + 유리(투명)
        const frame = mergeGeos([B(4, 0.14, 0.14, "#6d7077", 0, 1.45, 0), B(4, 0.14, 0.14, "#6d7077", 0, -1.45, 0), B(0.14, 3, 0.14, "#6d7077", -1.95, 0, 0), B(0.14, 3, 0.14, "#6d7077", 1.95, 0, 0), B(0.1, 3, 0.1, "#6d7077", 0, 0, 0)]);
        const fm = new THREE.InstancedMesh(frame, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }), list.length);
        const pane = new THREE.InstancedMesh(new THREE.BoxGeometry(3.8, 2.8, 0.05), new THREE.MeshStandardMaterial({ color: "#bfe8ff", transparent: true, opacity: 0.42, roughness: 0.03, metalness: 0.5, envMapIntensity: 2 }), list.length);
        fm.frustumCulled = false;
        pane.frustumCulled = false;
        fm.castShadow = true;
        scene.add(fm, pane);
        inst = [fm, pane];
      } else {
        const geo = mergeGeos(GEO[type](h).map((g) => (g.attributes.color ? g : tint(g, "#ffffff"))));
        const matOpts = { vertexColors: true, roughness: 0.72, metalness: 0.08 };
        if (type === "iceblock") Object.assign(matOpts, { transparent: true, opacity: 0.86, roughness: 0.08, metalness: 0.15, envMapIntensity: 1.8 });
        if (type === "wreck" || type === "container" || type === "drum" || type === "boom" || type === "girder" || type === "dumper") Object.assign(matOpts, { roughness: 0.48, metalness: 0.32 });
        if (type === "rock") Object.assign(matOpts, { roughness: 0.92, emissive: "#ff3a10", emissiveIntensity: 0.12 });
        if (type === "snowman" || type === "snowpile" || type === "snowball") Object.assign(matOpts, { roughness: 0.95 });
        const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial(matOpts), list.length);
        m.frustumCulled = false;
        m.castShadow = !GLASSY.has(type);
        m.receiveShadow = true;
        scene.add(m);
        inst = [m];
      }
      const colors = type === "wreck" ? CAR_COLORS : type === "container" ? ["#c7402f", "#2e6fb5", "#3e9a5a", "#e0a020", "#7a4fa8"] : null;
      if (colors) {
        list.forEach((o, i) => {
          inst[0].setColorAt(i, this.c.set(colors[(o.i * 7 + 3) % colors.length]));
        });
      } else if (inst[0].instanceColor === null) {
        // 색 버퍼를 미리 만들어 둔다 (손상 표시용)
        list.forEach((o, i) => inst[0].setColorAt(i, this.c.set("#ffffff")));
      }
      inst[0].instanceColor.needsUpdate = true;
      this.groups.set(key, { list, inst, colors, type });
      list.forEach((o, i) => {
        o.slot = i;
        o.moved = true;
      });
    }
    this.update(0);
  }

  update(time) {
    const { m, q, p, s, c } = this;
    for (const g of this.groups.values()) {
      let dirty = false;
      let colorDirty = false;
      for (const o of g.list) {
        const flash = o.fuse > 0;
        if (!o.moved && !flash && !o.wasFlash) continue;
        dirty = true;
        o.moved = false;
        if (o.state === 2) {
          m.makeScale(0, 0, 0);
        } else {
          q.set(o.q[0], o.q[1], o.q[2], o.q[3]);
          p.set(o.x, o.y, o.z);
          const sy = o.def.ride && !o.def.plank ? o.squash : 1;
          const dent = o.dmg > 0 ? 1 - Math.min(0.2, o.dmg * 0.08) : 1;
          const sx = o.span ? o.span / (o.h[0] * 2) : 1;
          s.set(o.big * dent * sx, o.big * sy * dent, o.big);
          if (sy < 1) p.y -= (o.h[1] * (1 - sy)) * 0.62;
          m.compose(p, q, s);
        }
        for (const inst of g.inst) inst.setMatrixAt(o.slot, m);
        // 손상 · 불붙음 색
        const base = g.colors ? g.colors[(o.i * 7 + 3) % g.colors.length] : "#ffffff";
        c.set(base);
        if (o.dmg > 0) c.multiplyScalar(1 - Math.min(0.45, o.dmg * 0.16));
        if (o.squash < 1) c.multiplyScalar(0.7);
        if (flash) {
          const b = Math.sin(time * 40) > 0;
          c.setRGB(b ? 3 : 1, b ? 2.4 : 0.6, b ? 1 : 0.3);
        }
        o.wasFlash = flash;
        g.inst[0].setColorAt(o.slot, c);
        colorDirty = true;
      }
      if (dirty) for (const inst of g.inst) inst.instanceMatrix.needsUpdate = true;
      if (colorDirty && g.inst[0].instanceColor) g.inst[0].instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    for (const g of this.groups.values()) {
      for (const inst of g.inst) {
        this.scene.remove(inst);
        inst.geometry.dispose();
        inst.material.dispose();
        inst.dispose();
      }
    }
    this.groups.clear();
  }
}

/* ---------- 파편 ---------- */
const DEBRIS_KINDS = {
  wood: { geo: () => new THREE.BoxGeometry(0.9, 0.12, 0.26), color: "#b98549", rough: 0.85 },
  metal: { geo: () => new THREE.BoxGeometry(0.5, 0.05, 0.4), color: "#9aa0a8", rough: 0.35, metal: 0.8 },
  glass: { geo: () => new THREE.TetrahedronGeometry(0.2), color: "#d8f2ff", rough: 0.05, metal: 0.5 },
  stone: { geo: () => new THREE.DodecahedronGeometry(0.3), color: "#9b988f", rough: 0.95 },
  rubber: { geo: () => new THREE.TorusGeometry(0.34, 0.16, 6, 10), color: "#232327", rough: 0.9 },
  plastic: { geo: () => new THREE.BoxGeometry(0.7, 0.3, 0.1), color: "#f04b3c", rough: 0.5 },
  ice: { geo: () => new THREE.TetrahedronGeometry(0.42), color: "#c8eeff", rough: 0.05, metal: 0.2 },
  snow: { geo: () => new THREE.IcosahedronGeometry(0.34, 0), color: "#ffffff", rough: 0.95 },
  wheel: { geo: () => new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10).rotateZ(Math.PI / 2), color: "#1a1b1f", rough: 0.85 },
};
const MAT_MIX = {
  wood: [["wood", 1]],
  metal: [["metal", 1]],
  glass: [["glass", 1]],
  stone: [["stone", 1]],
  rubber: [["rubber", 1]],
  plastic: [["plastic", 1]],
  ice: [["ice", 1]],
  snow: [["snow", 1]],
  car: [["metal", 0.6], ["glass", 0.25], ["wheel", 0.15]],
  boom: [["metal", 1]],
};
const MAT_COUNT = { wood: 13, metal: 10, glass: 16, stone: 11, rubber: 6, plastic: 8, ice: 14, snow: 12, car: 9, boom: 8 };

export class Debris {
  constructor(scene, level, max = 240) {
    this.level = level;
    this.items = [];
    this.meshes = {};
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.e = new THREE.Euler();
    const per = Math.ceil(max / 5);
    for (const [k, d] of Object.entries(DEBRIS_KINDS)) {
      const inst = new THREE.InstancedMesh(d.geo(), new THREE.MeshStandardMaterial({ color: d.color, roughness: d.rough, metalness: d.metal || 0 }), per);
      inst.frustumCulled = false;
      inst.castShadow = true;
      inst.count = 0;
      scene.add(inst);
      this.meshes[k] = { inst, list: [], max: per };
    }
    this.scene = scene;
  }

  spawn(mat, x, y, z, vx, vy, vz, energy, scale = 1, color) {
    const mix = MAT_MIX[mat] || MAT_MIX.wood;
    const n = Math.round((MAT_COUNT[mat] || 8) * Math.min(1.5, 0.7 + energy * 0.03) * Math.min(1.8, scale));
    for (let i = 0; i < n; i += 1) {
      let r = Math.random();
      let kind = mix[0][0];
      for (const [k, w] of mix) {
        r -= w;
        if (r <= 0) {
          kind = k;
          break;
        }
      }
      const pool = this.meshes[kind];
      const a = Math.random() * 6.283;
      const sp = 3 + Math.random() * (4 + energy * 0.34);
      const item = {
        x: x + (Math.random() - 0.5) * scale,
        y: y + (Math.random() - 0.5) * scale,
        z: z + (Math.random() - 0.5) * scale,
        vx: vx * 0.55 + Math.cos(a) * sp,
        vy: vy * 0.55 + 2 + Math.random() * (5 + energy * 0.24),
        vz: vz * 0.55 + Math.sin(a) * sp,
        rx: Math.random() * 6,
        ry: Math.random() * 6,
        rz: Math.random() * 6,
        wx: (Math.random() - 0.5) * 14,
        wy: (Math.random() - 0.5) * 14,
        wz: (Math.random() - 0.5) * 14,
        life: 1.6 + Math.random() * 1.5,
        size: (0.6 + Math.random() * 0.9) * Math.min(1.6, scale),
      };
      if (pool.list.length >= pool.max) pool.list.shift();
      pool.list.push(item);
    }
  }

  update(dt) {
    const { m, q, p, s, e } = this;
    for (const pool of Object.values(this.meshes)) {
      const list = pool.list;
      let w = 0;
      for (let i = 0; i < list.length; i += 1) {
        const d = list[i];
        d.life -= dt;
        if (d.life <= 0) continue;
        d.vy -= 22 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        d.rx += d.wx * dt;
        d.ry += d.wy * dt;
        d.rz += d.wz * dt;
        const g = this.level.height(d.x, d.z) + 0.08;
        if (d.y < g) {
          d.y = g;
          d.vy = Math.abs(d.vy) > 2 ? -d.vy * 0.34 : 0;
          d.vx *= 0.62;
          d.vz *= 0.62;
          d.wx *= 0.55;
          d.wz *= 0.55;
        }
        const k = Math.min(1, d.life * 2.4) * d.size;
        e.set(d.rx, d.ry, d.rz);
        q.setFromEuler(e);
        p.set(d.x, d.y, d.z);
        s.set(k, k, k);
        m.compose(p, q, s);
        pool.inst.setMatrixAt(w, m);
        list[w] = d;
        w += 1;
      }
      list.length = w;
      pool.inst.count = w;
      pool.inst.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const pool of Object.values(this.meshes)) {
      this.scene.remove(pool.inst);
      pool.inst.geometry.dispose();
      pool.inst.material.dispose();
      pool.inst.dispose();
    }
  }
}
export { GEO, tint, B, C, moved };
