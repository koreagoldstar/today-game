/* 몬스터 트럭 3D 모델. 앞 = +Z, 위 = +Y, 좌우 = ±X. 8종은 색만 다른 것이 아니라 실루엣과 부품이 다르다.
 * 몸통은 옆모습을 그려 뽑아내고(Extrude) 모서리를 둥글린다. 바퀴는 돌기 있는 타이어 + 휠 + 볼트.
 * 서스펜션 팔 · 쇼크 업소버는 매 프레임 바퀴 위치에 맞춰 늘고 줄어든다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

const texCache = {};
function canvasTex(key, w, h, draw) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache[key] = t;
  return t;
}

const mats = {};
export function mat(color, metal = 0.25, rough = 0.42, extra = {}) {
  const key = `${color}|${metal}|${rough}|${JSON.stringify(extra)}`;
  if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...extra });
  return mats[key];
}
const RUBBER = () => mat("#1a1b1f", 0.05, 0.86);
const STEEL = () => mat("#aeb4bd", 0.9, 0.28);
const DARK = () => mat("#23262c", 0.6, 0.45);
const GLASS = () => mat("#10202c", 0.9, 0.08, { envMapIntensity: 1.6 });

export function roundedBox(w, h, d, r = 0.1, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position;
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  const hz = d / 2 - r;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 1) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    v.sub(c);
    if (v.lengthSq() > 1e-8) v.normalize().multiplyScalar(r);
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function mesh(geo, material, x = 0, y = 0, z = 0, parent = null, opts = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = false;
  if (parent) parent.add(m);
  return m;
}
function box(w, h, d, material, x, y, z, parent, r = 0.06) {
  return mesh(roundedBox(w, h, d, Math.min(r, w / 2.01, h / 2.01, d / 2.01), 2), material, x, y, z, parent);
}
function cyl(r0, r1, h, material, x, y, z, parent, seg = 14) {
  return mesh(new THREE.CylinderGeometry(r0, r1, h, seg), material, x, y, z, parent);
}
/** 두 점을 잇는 관 */
function tube(points, r, material, parent, seg = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, "catmullrom", 0.2);
  return mesh(new THREE.TubeGeometry(curve, Math.max(6, points.length * 5), r, seg, false), material, 0, 0, 0, parent);
}

/** 옆모습(z, y) → 폭 width 로 뽑아낸 몸통 */
function profile(points, width, material, parent, { bevel = 0.1, x = 0 } = {}) {
  const shape = new THREE.Shape();
  points.forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(-Math.PI / 2);
  // rotateY(-90°): shape 의 x(앞뒤) → z, 깊이 → x
  return mesh(geo, material, x, 0, 0, parent);
}

/* ---------- 타이어 ---------- */
const tireCache = {};
function tireGeometry(R, W, kind) {
  const key = `${R.toFixed(2)}|${W.toFixed(2)}|${kind}`;
  if (tireCache[key]) return tireCache[key];
  // 옆면까지 둥근 몸통
  const pts = [];
  const r0 = R * 0.56;
  const shoulder = R * 0.86;
  const prof = [
    [r0, W * 0.5],
    [r0 + (shoulder - r0) * 0.55, W * 0.53],
    [shoulder, W * 0.5],
    [R * 0.95, W * 0.43],
    [R * 0.95, -W * 0.43],
    [shoulder, -W * 0.5],
    [r0 + (shoulder - r0) * 0.55, -W * 0.53],
    [r0, -W * 0.5],
  ];
  for (const p of prof.slice().reverse()) pts.push(new THREE.Vector2(p[0], p[1]));
  const carcass = new THREE.LatheGeometry(pts, 30);
  carcass.rotateZ(Math.PI / 2);
  const parts = [carcass];
  // 굵은 돌기: V 자로 번갈아
  const lugs = 16;
  for (let i = 0; i < lugs; i += 1) {
    for (const side of [-1, 1]) {
      const a = (i / lugs) * Math.PI * 2 + (side > 0 ? 0 : Math.PI / lugs);
      const g = new THREE.BoxGeometry(W * 0.5, R * 0.14, R * 0.26);
      g.rotateX(side * 0);
      g.rotateY(side * 0.5);
      g.translate(side * W * 0.27, R * 0.96, 0);
      g.rotateX(a);
      parts.push(g);
    }
  }
  if (kind === "spike") {
    for (let i = 0; i < 26; i += 1) {
      const a = (i / 26) * Math.PI * 2;
      const g = new THREE.ConeGeometry(R * 0.035, R * 0.12, 5);
      g.translate((i % 3 - 1) * W * 0.3, R * 1.08, 0);
      g.rotateX(a);
      parts.push(g);
    }
  }
  const merged = mergeGeos(parts);
  tireCache[key] = merged;
  return merged;
}

export function mergeGeos(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const hasColor = geos.some((g) => g.attributes.color);
  const col = hasColor ? new Float32Array(total * 3) : null;
  let o = 0;
  for (const g of geos) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col) {
      if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
      else col.fill(1, o * 3, (o + n) * 3);
    }
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return out;
}

function buildWheel(def, look) {
  const R = def.wheelR;
  const W = R * 0.92;
  const pivot = new THREE.Group(); // 조향
  const spin = new THREE.Group(); // 회전
  pivot.add(spin);
  mesh(tireGeometry(R, W, look.tire || "lug"), RUBBER(), 0, 0, 0, spin);
  // 휠: 안쪽으로 파인 접시 + 볼트
  const rimMat = mat(look.rim, look.rimMetal == null ? 0.85 : look.rimMetal, 0.28);
  const rimPts = [
    [R * 0.03, -W * 0.02],
    [R * 0.2, 0.02],
    [R * 0.28, -W * 0.14],
    [R * 0.5, -W * 0.22],
    [R * 0.58, -W * 0.5],
  ].map((p) => new THREE.Vector2(p[0], p[1]));
  for (const side of [-1, 1]) {
    const dish = new THREE.LatheGeometry(rimPts, 22);
    dish.rotateZ(side > 0 ? -Math.PI / 2 : Math.PI / 2);
    dish.translate(side * W * 0.5, 0, 0);
    mesh(dish, rimMat, 0, 0, 0, spin);
    const hub = cyl(R * 0.17, R * 0.21, W * 0.14, mat(look.hub || "#2b2e34", 0.7, 0.4), side * W * 0.44, 0, 0, spin, 12);
    hub.rotation.z = (Math.PI / 2) * side;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const b = cyl(R * 0.028, R * 0.028, W * 0.06, STEEL(), side * W * 0.47, Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36, spin, 6);
      b.rotation.z = Math.PI / 2;
      b.castShadow = false;
    }
    if (look.tire === "beadlock") {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.56, R * 0.03, 6, 24), rimMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.x = side * W * 0.5;
      spin.add(ring);
    }
  }
  return { pivot, spin };
}

/* ---------- 몸통 그림 ---------- */
function decalTexture(id, painter) {
  return canvasTex(`decal-${id}`, 512, 256, painter);
}
function sidePlane(tex, w, h, x, y, z, parent) {
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, metalness: 0.2, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.rotation.y = (side * Math.PI) / 2;
    p.position.set(side * x, y, z);
    parent.add(p);
  }
}
function bolt(ctx, x, y, s, color, stroke) {
  ctx.fillStyle = color;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y - s);
  ctx.lineTo(x - s * 0.5, y + s * 0.1);
  ctx.lineTo(x, y + s * 0.1);
  ctx.lineTo(x - s * 0.3, y + s);
  ctx.lineTo(x + s * 0.55, y - s * 0.2);
  ctx.lineTo(x + s * 0.05, y - s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
function flames(ctx, w, h, c1, c2) {
  for (const [col, k] of [
    [c1, 1],
    [c2, 0.72],
  ]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(w, h * 0.18);
    for (let i = 0; i < 5; i += 1) {
      const y = h * (0.2 + i * 0.16);
      const x0 = w * (0.5 - k * 0.36 + (i % 2) * 0.1);
      ctx.quadraticCurveTo(w * 0.72, y - h * 0.08, x0, y);
      ctx.quadraticCurveTo(w * 0.7, y + h * 0.02, w * 0.84, y + h * 0.08);
    }
    ctx.lineTo(w, h * 0.92);
    ctx.closePath();
    ctx.fill();
  }
}

/** 공통: 프레임 · 축 · 서스펜션 */
function chassisCommon(root, def, look) {
  const tw = def.tw;
  const wb = def.wb;
  const frame = mat(look.frame, 0.6, 0.38);
  // 사다리 프레임
  for (const x of [-0.62, 0.62]) box(0.2, 0.26, wb + 1.5, frame, x, -0.5, 0, root, 0.04);
  for (const z of [wb / 2, 0, -wb / 2]) box(1.4, 0.2, 0.22, frame, 0, -0.5, z, root, 0.04);
  // 가운데 구동계
  cyl(0.11, 0.11, wb * 0.9, DARK(), 0, -0.62, 0, root).rotation.x = Math.PI / 2;
  box(0.72, 0.5, 0.9, DARK(), 0, -0.56, 0.1, root, 0.1);
  // 엔진 아래 사각
  box(1.1, 0.12, 2.0, DARK(), 0, -0.68, 0.7, root, 0.04);
}

function headLights(parent, y, z, x, color = "#fff6d8") {
  const lamp = mat(color, 0.1, 0.2, { emissive: color, emissiveIntensity: 1.4 });
  for (const s of [-1, 1]) {
    const g = new THREE.SphereGeometry(0.15, 12, 10);
    const m = mesh(g, lamp, s * x, y, z, parent, { shadow: false });
    m.scale.z = 0.5;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 14), STEEL());
    rim.position.set(s * x, y, z);
    parent.add(rim);
  }
}
function lightBar(parent, y, z, n = 4, span = 1.3) {
  box(span + 0.2, 0.06, 0.08, DARK(), 0, y - 0.1, z, parent, 0.02);
  const lamp = mat("#fff6d8", 0.1, 0.2, { emissive: "#fff2c0", emissiveIntensity: 1.6 });
  for (let i = 0; i < n; i += 1) {
    const x = (i - (n - 1) / 2) * (span / (n - 1));
    const c = cyl(0.11, 0.09, 0.1, DARK(), x, y, z, parent, 10);
    c.rotation.x = Math.PI / 2;
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), lamp);
    f.position.set(x, y, z + 0.052);
    parent.add(f);
  }
}
function exhaustStacks(parent, x, y, z, h, color = "#c9ced6") {
  for (const s of [-1, 1]) {
    const c = cyl(0.11, 0.13, h, mat(color, 0.95, 0.22), s * x, y + h / 2, z, parent, 12);
    c.rotation.x = -0.12;
  }
  return [
    new THREE.Vector3(-x, y + h, z - h * 0.06),
    new THREE.Vector3(x, y + h, z - h * 0.06),
  ];
}
function rollBar(parent, w, y0, y1, z, material, r = 0.07) {
  tube(
    [
      [-w, y0, z],
      [-w * 0.95, y1 * 0.92 + y0 * 0.08, z],
      [-w * 0.6, y1, z],
      [w * 0.6, y1, z],
      [w * 0.95, y1 * 0.92 + y0 * 0.08, z],
      [w, y0, z],
    ],
    r,
    material,
    parent
  );
}
function blower(parent, y, z, color, scoop = "#d8dde4") {
  // 슈퍼차저 + 흡입구
  box(0.62, 0.34, 0.84, mat(scoop, 0.9, 0.3), 0, y, z, parent, 0.05);
  for (let i = 0; i < 5; i += 1) box(0.68, 0.03, 0.05, DARK(), 0, y + 0.1, z - 0.3 + i * 0.15, parent, 0.01);
  box(0.74, 0.3, 0.3, mat(color, 0.4, 0.3), 0, y + 0.3, z + 0.12, parent, 0.07);
  for (const s of [-1, 1]) {
    const m = cyl(0.13, 0.13, 0.32, DARK(), s * 0.18, y + 0.3, z + 0.3, parent, 12);
    m.rotation.x = Math.PI / 2;
  }
}

/* ---------- 트럭별 ---------- */
const BUILD = {
  thunder(root, def, out) {
    const paint = mat("#0f6dff", 0.45, 0.24);
    const dark = mat("#0a3fa8", 0.5, 0.32);
    const yellow = mat("#ffd21f", 0.3, 0.35);
    // 픽업 옆모습 (z, y)
    const P = [
      [-2.75, 0.02], [-2.82, 0.56], [-1.05, 0.62], [-0.88, 1.5], [0.3, 1.52], [1.02, 0.74], [2.62, 0.62], [2.84, 0.16], [2.72, -0.08], [-2.6, -0.08],
    ];
    profile(P, 2.5, paint, root, { bevel: 0.14 });
    // 짐칸 안쪽
    box(2.0, 0.34, 1.42, dark, 0, 0.5, -1.92, root, 0.04);
    // 창
    profile([[-0.72, 0.8], [-0.66, 1.34], [0.2, 1.36], [0.74, 0.8]], 2.56, GLASS(), root, { bevel: 0.02 });
    box(1.92, 0.06, 0.1, dark, 0, 0.82, 0.8, root, 0.02);
    // 보닛 줄무늬 + 흡입구
    box(0.5, 0.03, 1.5, yellow, 0, 0.72, 1.72, root, 0.01);
    blower(root, 0.9, 1.58, "#ffd21f");
    // 공격적인 앞 범퍼
    box(2.8, 0.24, 0.26, DARK(), 0, 0.06, 2.92, root, 0.08);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(roundedBox(0.7, 0.5, 0.2, 0.06, 2), yellow);
      w.position.set(s * 1.05, 0.08, 3.05);
      w.rotation.y = s * -0.55;
      w.castShadow = true;
      root.add(w);
    }
    tube([[-1.2, 0.2, 2.95], [-0.8, 0.72, 3.02], [0.8, 0.72, 3.02], [1.2, 0.2, 2.95]], 0.07, DARK(), root);
    box(1.5, 0.3, 0.05, DARK(), 0, 0.42, 2.84, root, 0.02);
    for (let i = 0; i < 6; i += 1) box(0.14, 0.26, 0.04, mat("#d8dde4", 0.9, 0.3), (i - 2.5) * 0.24, 0.42, 2.87, root, 0.01);
    headLights(root, 0.46, 2.8, 1.02);
    lightBar(root, 1.62, 0.1, 4, 1.4);
    // 지붕 롤바
    rollBar(root, 1.15, 0.6, 1.92, -0.98, yellow);
    // 뒤 범퍼 · 배기
    box(2.6, 0.2, 0.2, DARK(), 0, 0.1, -2.92, root, 0.05);
    out.exhaust = exhaustStacks(root, 0.86, 0.6, -0.86, 1.05);
    // 번개 그림
    const tex = decalTexture("thunder", (c, w, h) => {
      c.clearRect(0, 0, w, h);
      bolt(c, w * 0.55, h * 0.5, h * 0.46, "#ffe23a", "#b37400");
      c.strokeStyle = "#ffe23a";
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(w * 0.05, h * 0.62);
      c.lineTo(w * 0.34, h * 0.62);
      c.moveTo(w * 0.72, h * 0.34);
      c.lineTo(w * 0.97, h * 0.34);
      c.stroke();
      c.fillStyle = "#fff";
      c.font = "900 44px Arial Black, sans-serif";
      c.fillText("BEAST", w * 0.62, h * 0.9);
    });
    sidePlane(tex, 2.6, 1.0, 1.262, 0.28, 0.5, root);
  },
  iron(root, def, out) {
    const paint = mat("#5c636e", 0.85, 0.34);
    const red = mat("#b0231d", 0.5, 0.3);
    const steel = STEEL();
    const P = [
      [-2.9, 0.0], [-2.92, 0.62], [-1.2, 0.72], [-1.05, 1.42], [0.05, 1.46], [0.55, 0.92], [2.3, 0.86], [2.82, 0.46], [2.9, -0.08], [-2.8, -0.08],
    ];
    profile(P, 2.8, paint, root, { bevel: 0.1 });
    profile([[-0.86, 0.94], [-0.8, 1.28], [-0.06, 1.3], [0.28, 0.94]], 2.86, GLASS(), root, { bevel: 0.02 });
    // 장갑판 + 리벳
    box(2.9, 0.3, 4.6, red, 0, 0.02, 0, root, 0.06);
    for (let i = 0; i < 8; i += 1) {
      for (const s of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), steel);
        r.position.set(s * 1.46, 0.05, -2 + i * 0.58);
        root.add(r);
      }
    }
    // 들이받는 판 + 황소 뿔
    const ram = box(3.1, 0.92, 0.24, DARK(), 0, 0.3, 3.12, root, 0.08);
    ram.rotation.x = -0.18;
    for (let i = 0; i < 7; i += 1) box(0.2, 0.84, 0.06, steel, (i - 3) * 0.42, 0.3, 3.26, root, 0.02).rotation.x = -0.18;
    for (const s of [-1, 1]) {
      tube([[s * 1.15, 0.85, 3.0], [s * 1.75, 1.1, 3.0], [s * 2.2, 1.6, 3.25], [s * 2.25, 2.1, 3.62]], 0.13, mat("#efe6cf", 0.1, 0.45), root);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 10), mat("#2a2a2a", 0.3, 0.5));
      tip.position.set(s * 2.27, 2.26, 3.72);
      tip.rotation.x = 0.5;
      root.add(tip);
    }
    // 코뚜레 · 눈
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 18), mat("#d9a925", 0.9, 0.25));
    ring.position.set(0, 0.15, 3.32);
    root.add(ring);
    headLights(root, 0.68, 2.76, 0.86, "#ff5c34");
    // 천장 철망 · 박스
    rollBar(root, 1.28, 0.9, 1.78, -0.9, steel, 0.08);
    rollBar(root, 1.28, 0.9, 1.78, 0.32, steel, 0.08);
    box(2.2, 0.5, 1.5, DARK(), 0, 0.92, -2.0, root, 0.06);
    out.exhaust = exhaustStacks(root, 1.05, 0.7, -1.28, 1.25, "#7a7f88");
  },
  rocket(root, def, out) {
    const paint = mat("#ff4f8b", 0.4, 0.22);
    const orange = mat("#ffa21f", 0.4, 0.28);
    // 낮고 날렵한 핫로드
    const P = [
      [-2.5, 0.1], [-2.62, 0.4], [-1.25, 0.56], [-0.86, 1.22], [-0.06, 1.24], [0.34, 0.66], [2.4, 0.42], [2.68, 0.2], [2.5, -0.02], [-2.3, -0.02],
    ];
    profile(P, 2.2, paint, root, { bevel: 0.15 });
    profile([[-0.68, 0.72], [-0.62, 1.08], [-0.12, 1.1], [0.14, 0.72]], 2.26, GLASS(), root, { bevel: 0.02 });
    // 드러난 엔진
    blower(root, 0.68, 1.1, "#ffa21f");
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i += 1) {
        tube([[s * 0.42, 0.62, 0.8 + i * 0.24], [s * 1.02, 0.4, 0.84 + i * 0.24], [s * 1.2, 0.1, 0.5 + i * 0.1]], 0.05, mat("#d8dde4", 0.95, 0.2), root, 6);
      }
    }
    // 로켓 두 개
    for (const s of [-1, 1]) {
      const body = cyl(0.3, 0.3, 1.9, mat("#e9edf3", 0.8, 0.25), s * 0.72, 0.84, -1.75, root, 16);
      body.rotation.x = Math.PI / 2;
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 16), orange);
      nose.rotation.x = Math.PI / 2;
      nose.position.set(s * 0.72, 0.84, -0.5);
      nose.castShadow = true;
      root.add(nose);
      const noz = cyl(0.3, 0.22, 0.3, DARK(), s * 0.72, 0.84, -2.82, root, 14);
      noz.rotation.x = Math.PI / 2;
      for (const k of [0, 1]) {
        const fin = new THREE.Mesh(roundedBox(0.04, 0.42, 0.5, 0.015, 1), orange);
        fin.position.set(s * 0.72, 0.84 + (k ? 0.36 : -0.36), -2.42);
        root.add(fin);
      }
    }
    out.rockets = [new THREE.Vector3(-0.72, 0.84, -3), new THREE.Vector3(0.72, 0.84, -3)];
    // 뒤 날개
    box(2.5, 0.05, 0.56, orange, 0, 1.48, -2.1, root, 0.02);
    for (const s of [-1, 1]) box(0.05, 0.42, 0.5, paint, s * 1.25, 1.36, -2.1, root, 0.02);
    box(2.5, 0.2, 0.2, DARK(), 0, 0.06, 2.72, root, 0.06);
    headLights(root, 0.3, 2.62, 0.82);
    out.exhaust = [new THREE.Vector3(-1.2, 0.1, 0.2), new THREE.Vector3(1.2, 0.1, 0.2)];
    const tex = decalTexture("rocket", (c, w, h) => flames(c, w, h, "#ffa21f", "#ffe65c"));
    sidePlane(tex, 2.5, 0.72, 1.112, 0.26, 0.9, root);
  },
  frost(root, def, out) {
    const paint = mat("#e8f4fb", 0.25, 0.3);
    const blue = mat("#29a8e6", 0.5, 0.25);
    const P = [
      [-2.7, 0.0], [-2.78, 0.7], [-1.05, 0.74], [-0.9, 1.62], [0.36, 1.64], [0.96, 0.86], [2.5, 0.72], [2.76, 0.3], [2.7, -0.08], [-2.6, -0.08],
    ];
    profile(P, 2.6, paint, root, { bevel: 0.12 });
    profile([[-0.74, 0.92], [-0.68, 1.46], [0.26, 1.48], [0.72, 0.92]], 2.66, mat("#22506e", 0.9, 0.08), root, { bevel: 0.02 });
    box(2.66, 0.2, 5.3, blue, 0, 0.3, 0, root, 0.05);
    // 제설판
    const plowPts = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      plowPts.push([(t - 0.5) * 3.6, 0.5 + Math.cos((t - 0.5) * 2.2) * 0]);
    }
    const plow = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 3.5, 22, 1, true, -0.55, 1.1), mat("#ffb31f", 0.45, 0.35, { side: THREE.DoubleSide }));
    plow.rotation.z = Math.PI / 2;
    plow.rotation.x = 0;
    plow.position.set(0, 0.25, 1.86);
    plow.castShadow = true;
    root.add(plow);
    box(3.6, 0.12, 0.14, DARK(), 0, -0.34, 3.1, root, 0.04);
    for (const s of [-1, 1]) tube([[s * 0.9, 0.0, 2.3], [s * 0.9, 0.2, 2.9]], 0.07, DARK(), root);
    // 지붕 고드름 · 눈
    const ice = mat("#b8ecff", 0.3, 0.12, { transparent: true, opacity: 0.86 });
    for (let i = 0; i < 9; i += 1) {
      const k = new THREE.Mesh(new THREE.ConeGeometry(0.07 + (i % 3) * 0.02, 0.32 + (i % 3) * 0.14, 6), ice);
      k.position.set(-1.1 + i * 0.28, 0.88 - (i % 3) * 0.04, 2.62);
      k.rotation.x = Math.PI;
      root.add(k);
    }
    const snow = new THREE.Mesh(roundedBox(2.1, 0.18, 1.2, 0.08, 2), mat("#ffffff", 0, 0.9));
    snow.position.set(0, 1.72, -0.28);
    root.add(snow);
    for (const s of [-1, 1]) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), ice);
      crystal.position.set(s * 1.0, 1.92, -1.0);
      crystal.scale.y = 1.8;
      root.add(crystal);
    }
    lightBar(root, 1.8, 0.5, 4, 1.5);
    box(2.1, 0.5, 1.4, blue, 0, 0.9, -1.94, root, 0.08);
    out.exhaust = exhaustStacks(root, 0.92, 0.7, -0.92, 1.1);
  },
  flame(root, def, out) {
    const paint = mat("#d81a10", 0.5, 0.2);
    const black = mat("#17181c", 0.5, 0.32);
    const P = [
      [-2.7, 0.04], [-2.74, 0.58], [-1.0, 0.64], [-0.74, 1.36], [0.22, 1.38], [0.86, 0.72], [2.46, 0.62], [2.8, 0.2], [2.6, -0.1], [-2.5, -0.1],
    ];
    profile(P, 2.4, paint, root, { bevel: 0.14 });
    profile([[-0.58, 0.8], [-0.52, 1.2], [0.14, 1.22], [0.6, 0.8]], 2.46, GLASS(), root, { bevel: 0.02 });
    // 상어 입
    const mouth = new THREE.Mesh(roundedBox(2.5, 0.54, 0.5, 0.1, 2), black);
    mouth.position.set(0, 0.22, 2.62);
    root.add(mouth);
    const tooth = mat("#f7f5ec", 0.1, 0.4);
    for (let i = 0; i < 11; i += 1) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 4), tooth);
      t.position.set(-1.1 + i * 0.22, 0.38, 2.9);
      t.rotation.x = Math.PI;
      root.add(t);
      if (i % 2) {
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 4), tooth);
        b.position.set(-1.1 + i * 0.22, 0.04, 2.9);
        root.add(b);
      }
    }
    // 화난 눈
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mat("#ffd21f", 0.2, 0.3, { emissive: "#ff7a10", emissiveIntensity: 0.9 }));
      e.position.set(s * 0.8, 0.72, 2.3);
      e.scale.set(1.2, 0.6, 0.5);
      root.add(e);
    }
    blower(root, 0.92, 1.4, "#ffae1f", "#d8dde4");
    // 옆 배기관에서 불꽃
    for (const s of [-1, 1]) {
      const p = cyl(0.14, 0.14, 3.4, mat("#c9ced6", 0.95, 0.2), s * 1.42, -0.04, 0.2, root, 12);
      p.rotation.x = Math.PI / 2;
    }
    out.exhaust = [new THREE.Vector3(-1.42, -0.04, -1.5), new THREE.Vector3(1.42, -0.04, -1.5)];
    box(2.5, 0.2, 0.2, black, 0, 0.1, -2.84, root, 0.05);
    rollBar(root, 1.06, 0.6, 1.7, -0.84, black);
    const tex = decalTexture("flame", (c, w, h) => flames(c, w, h, "#ff9a1f", "#ffe65c"));
    sidePlane(tex, 2.9, 0.8, 1.212, 0.28, 0.6, root);
    headLights(root, 0.56, 2.62, 1.0, "#ffd21f");
  },
  toxic(root, def, out) {
    const frame = mat("#16181c", 0.65, 0.35);
    const neon = mat("#6cf03a", 0.3, 0.3, { emissive: "#34b410", emissiveIntensity: 0.35 });
    // 버기: 몸통 대신 관 프레임
    const bottom = [
      [-1.05, 0.06, -2.4], [-1.05, 0.06, 2.1], [1.05, 0.06, 2.1], [1.05, 0.06, -2.4],
    ];
    tube([bottom[0], bottom[1]], 0.09, frame, root);
    tube([bottom[2], bottom[3]], 0.09, frame, root);
    tube([bottom[1], bottom[2]], 0.09, frame, root);
    tube([bottom[0], bottom[3]], 0.09, frame, root);
    for (const s of [-1, 1]) {
      tube([[s * 1.05, 0.06, 1.9], [s * 0.9, 1.0, 0.8], [s * 0.72, 1.74, 0.02], [s * 0.72, 1.74, -1.1], [s * 0.96, 0.82, -1.9], [s * 1.05, 0.06, -2.4]], 0.08, frame, root);
      tube([[s * 1.05, 0.06, 0.5], [s * 0.9, 1.0, 0.8]], 0.06, neon, root);
      tube([[s * 1.05, 0.06, -1.1], [s * 0.72, 1.74, -1.1]], 0.06, neon, root);
    }
    tube([[-0.72, 1.74, 0.02], [0.72, 1.74, 0.02]], 0.08, frame, root);
    tube([[-0.72, 1.74, -1.1], [0.72, 1.74, -1.1]], 0.08, frame, root);
    // 앞 덮개 + 지붕판
    profile([[0.6, 0.12], [0.86, 0.72], [2.1, 0.5], [2.46, 0.16], [2.3, 0.0], [0.6, 0.0]], 1.9, neon, root, { bevel: 0.08 });
    box(1.5, 0.05, 1.1, neon, 0, 1.8, -0.54, root, 0.02);
    // 좌석 · 운전대
    box(1.0, 0.8, 0.14, DARK(), 0, 0.72, -0.62, root, 0.05);
    box(1.0, 0.14, 0.8, DARK(), 0, 0.36, -0.22, root, 0.05);
    // 독극물 통
    const tank = cyl(0.56, 0.56, 1.35, mat("#ffcf1f", 0.5, 0.3), 0, 0.72, -1.68, root, 18);
    tank.rotation.z = Math.PI / 2;
    const label = canvasTex("toxic-label", 128, 128, (c, w, h) => {
      c.fillStyle = "#ffcf1f";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#16181c";
      c.font = "900 96px Arial Black";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("☣", w / 2, h / 2 + 6);
    });
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CircleGeometry(0.56, 18), new THREE.MeshStandardMaterial({ map: label, metalness: 0.2, roughness: 0.45 }));
      cap.position.set(s * 0.68, 0.72, -1.68);
      cap.rotation.y = (s * Math.PI) / 2;
      root.add(cap);
    }
    // 엔진 · 흘러내리는 초록
    box(0.9, 0.6, 0.7, DARK(), 0, 0.42, 1.0, root, 0.08);
    box(2.4, 0.16, 0.16, frame, 0, 0.0, 2.54, root, 0.05);
    lightBar(root, 1.98, 0.02, 4, 1.2);
    headLights(root, 0.3, 2.44, 0.7, "#c8ff7a");
    out.exhaust = exhaustStacks(root, 0.42, 0.6, 0.72, 0.8, "#6cf03a");
  },
  mega(root, def, out) {
    const skin = mat("#4a7a2e", 0.2, 0.46);
    const belly = mat("#c9b56a", 0.15, 0.55);
    const dark = mat("#2a4a1c", 0.2, 0.55);
    // 공룡 몸통
    const P = [
      [-3.1, 0.1], [-3.2, 0.86], [-1.6, 1.3], [-0.7, 2.0], [0.7, 2.06], [1.5, 1.42], [3.0, 1.2], [3.5, 0.7], [3.42, 0.02], [-2.9, -0.12],
    ];
    profile(P, 3.1, skin, root, { bevel: 0.2 });
    profile([[-0.34, 1.26], [-0.26, 1.82], [0.5, 1.84], [1.0, 1.26]], 3.16, mat("#e8c21a", 0.5, 0.12, { emissive: "#7a5a00", emissiveIntensity: 0.25 }), root, { bevel: 0.02 });
    box(3.1, 0.34, 5.8, belly, 0, 0.16, 0, root, 0.1);
    // 윗턱 · 아래턱 · 이빨
    const upper = new THREE.Mesh(roundedBox(2.7, 0.56, 1.25, 0.2, 2), skin);
    upper.position.set(0, 1.05, 3.5);
    upper.rotation.x = 0.08;
    upper.castShadow = true;
    root.add(upper);
    const lower = new THREE.Mesh(roundedBox(2.45, 0.32, 1.2, 0.14, 2), dark);
    lower.position.set(0, 0.28, 3.58);
    lower.rotation.x = -0.22;
    lower.castShadow = true;
    root.add(lower);
    box(2.3, 0.5, 0.9, mat("#7a1414", 0.1, 0.8), 0, 0.72, 3.4, root, 0.1);
    const tooth = mat("#f7f3e0", 0.05, 0.45);
    for (let i = 0; i < 12; i += 1) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.44, 5), tooth);
      t.position.set(-1.2 + i * 0.218, 0.66, 4.02);
      t.rotation.x = Math.PI;
      root.add(t);
      if (i % 2) {
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 5), tooth);
        b.position.set(-1.2 + i * 0.218, 0.5, 4.04);
        root.add(b);
      }
    }
    // 눈 · 콧구멍
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), mat("#ffe23a", 0.1, 0.25, { emissive: "#ff8a10", emissiveIntensity: 0.7 }));
      eye.position.set(s * 1.25, 1.42, 2.82);
      root.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), mat("#111", 0, 0.3));
      pupil.position.set(s * 1.38, 1.42, 2.98);
      pupil.scale.y = 1.6;
      root.add(pupil);
      const brow = new THREE.Mesh(roundedBox(0.7, 0.12, 0.5, 0.05, 1), dark);
      brow.position.set(s * 1.12, 1.68, 2.82);
      brow.rotation.z = s * 0.3;
      root.add(brow);
    }
    // 등 가시
    const spike = mat("#d8d0b0", 0.1, 0.5);
    for (let i = 0; i < 10; i += 1) {
      const z = 1.6 - i * 0.52;
      const h = 0.5 + Math.sin((i / 9) * Math.PI) * 0.5;
      const k = new THREE.Mesh(new THREE.ConeGeometry(0.22, h, 5), spike);
      const y = i < 3 ? 2.15 : 2.1 - (i - 3) * 0.17;
      k.position.set(0, y + h / 2, z);
      k.castShadow = true;
      root.add(k);
    }
    // 꼬리
    tube([[0, 0.8, -3.1], [0, 1.05, -3.9], [0, 1.35, -4.5], [0, 1.85, -4.85]], 0.26, skin, root);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.8, 10), skin);
    tail.position.set(0, 2.2, -5.05);
    tail.rotation.x = -0.6;
    root.add(tail);
    // 무늬
    for (let i = 0; i < 7; i += 1) {
      for (const s of [-1, 1]) {
        const stripe = new THREE.Mesh(roundedBox(0.04, 0.7, 0.26, 0.015, 1), dark);
        stripe.position.set(s * 1.56, 1.0, -2.4 + i * 0.7);
        stripe.rotation.x = 0.2;
        root.add(stripe);
      }
    }
    out.exhaust = exhaustStacks(root, 1.0, 1.0, -1.7, 1.15, "#8a8f98");
  },
  golden(root, def, out) {
    const gold = mat("#f2b91e", 1, 0.2);
    const black = mat("#141518", 0.8, 0.25);
    const P = [
      [-2.85, 0.0], [-2.9, 0.66], [-1.1, 0.72], [-0.82, 1.58], [0.42, 1.6], [1.1, 0.84], [2.68, 0.74], [3.0, 0.28], [2.88, -0.08], [-2.7, -0.08],
    ];
    profile(P, 2.7, gold, root, { bevel: 0.15 });
    profile([[-0.64, 0.92], [-0.58, 1.42], [0.32, 1.44], [0.86, 0.92]], 2.76, black, root, { bevel: 0.02 });
    box(2.76, 0.14, 5.6, black, 0, 0.56, 0, root, 0.04);
    box(0.62, 0.03, 1.7, black, 0, 0.84, 1.82, root, 0.01);
    blower(root, 1.02, 1.62, "#141518", "#f7e08a");
    // 왕관
    const crown = new THREE.Group();
    crown.position.set(0, 1.7, -0.2);
    root.add(crown);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.8, 0.26, 16, 1, true), mat("#ffd24a", 1, 0.15, { side: THREE.DoubleSide }));
    base.position.y = 0.13;
    crown.add(base);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 5), mat("#ffd24a", 1, 0.15));
      t.position.set(Math.cos(a) * 0.72, 0.5, Math.sin(a) * 0.72);
      crown.add(t);
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat(i % 2 ? "#ff2a50" : "#2ad4ff", 0.3, 0.1, { emissive: i % 2 ? "#a00020" : "#0080b0", emissiveIntensity: 0.7 }));
      gem.position.set(Math.cos(a) * 0.74, 0.8, Math.sin(a) * 0.74);
      crown.add(gem);
    }
    // 크롬 범퍼
    const chrome = mat("#f4f6fa", 1, 0.08);
    box(3.0, 0.3, 0.3, chrome, 0, 0.1, 3.08, root, 0.1);
    box(2.7, 0.2, 0.2, chrome, 0, 0.14, -2.96, root, 0.06);
    tube([[-1.3, 0.25, 3.08], [-0.9, 0.86, 3.12], [0.9, 0.86, 3.12], [1.3, 0.25, 3.08]], 0.075, chrome, root);
    for (let i = 0; i < 7; i += 1) box(0.14, 0.3, 0.04, chrome, (i - 3) * 0.24, 0.5, 3.02, root, 0.01);
    headLights(root, 0.54, 2.98, 1.08);
    lightBar(root, 1.7, 0.42, 6, 1.7);
    rollBar(root, 1.24, 0.72, 2.0, -0.98, chrome);
    out.exhaust = exhaustStacks(root, 0.96, 0.72, -0.96, 1.2, "#f4f6fa");
    const tex = decalTexture("golden", (c, w, h) => {
      c.fillStyle = "#141518";
      c.font = "900 66px Arial Black, sans-serif";
      c.textAlign = "center";
      c.fillText("CRUSHER", w / 2, h * 0.62);
      c.fillRect(w * 0.05, h * 0.76, w * 0.9, 8);
    });
    sidePlane(tex, 2.7, 1.1, 1.362, 0.24, 0.55, root);
  },
};

const LOOKS = {
  thunder: { frame: "#141820", rim: "#ffd21f", arm: "#20252d", shock: "#ffd21f", spring: "#ffd21f" },
  iron: { frame: "#2b2f36", rim: "#b0231d", arm: "#3a3f47", shock: "#c9ced6", spring: "#b0231d" },
  rocket: { frame: "#2a1c28", rim: "#ff4f8b", arm: "#3b2a38", shock: "#ffa21f", spring: "#ffa21f", tire: "beadlock" },
  frost: { frame: "#20303c", rim: "#29a8e6", arm: "#2b4150", shock: "#b8ecff", spring: "#29a8e6", tire: "spike" },
  flame: { frame: "#17181c", rim: "#ffae1f", arm: "#26282e", shock: "#ff5a1f", spring: "#ff9a1f" },
  toxic: { frame: "#16181c", rim: "#6cf03a", arm: "#16181c", shock: "#ffcf1f", spring: "#6cf03a", tire: "beadlock" },
  mega: { frame: "#20301a", rim: "#c9b56a", rimMetal: 0.4, arm: "#2a3a20", shock: "#d8d0b0", spring: "#c9b56a" },
  golden: { frame: "#141518", rim: "#ffd24a", arm: "#141518", shock: "#f4f6fa", spring: "#ffd24a" },
};

export class TruckModel {
  constructor(def) {
    this.def = def;
    this.group = new THREE.Group(); // 위치 · 자세
    const body = new THREE.Group();
    this.body = body;
    this.group.add(body);
    const look = LOOKS[def.id] || LOOKS.thunder;
    this.look = look;
    const big = def.wb / 3.7;
    this.big = big;
    this.bodyHolder = new THREE.Group();
    body.add(this.bodyHolder);
    this.bodyHolder.scale.setScalar(def.id === "mega" ? 1 : 1);
    chassisCommon(this.bodyHolder, def, look);
    this.out = { exhaust: [] };
    const up = new THREE.Group();
    this.shell = up;
    up.position.y = 0.32;
    this.bodyHolder.add(up);
    (BUILD[def.id] || BUILD.thunder)(up, def, this.out);
    // 부품 위치는 shell 기준 → 본체 좌표로
    this.buildRear(up, def);
    this.exhaust = (this.out.exhaust || []).map((v) => v.clone().add(up.position));
    this.rockets = (this.out.rockets || []).map((v) => v.clone().add(up.position));

    // 바퀴 · 축 · 쇼크
    const armMat = mat(look.arm, 0.6, 0.4);
    const shockMat = mat(look.shock, 0.7, 0.3);
    const springMat = mat(look.spring, 0.5, 0.35);
    this.wheels = [];
    const wx = def.tw / 2;
    const wz = def.wb / 2;
    const layout = [
      [-wx, wz, true],
      [wx, wz, true],
      [-wx, -wz, false],
      [wx, -wz, false],
    ];
    for (const [x, z, front] of layout) {
      const w = buildWheel(def, look);
      this.group.add(w.pivot);
      w.pivot.position.set(x, -1, z);
      const arm1 = mesh(new THREE.CylinderGeometry(0.065, 0.065, 1, 8), armMat, 0, 0, 0, this.group);
      const arm2 = mesh(new THREE.CylinderGeometry(0.065, 0.065, 1, 8), armMat, 0, 0, 0, this.group);
      const rod = mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 8), STEEL(), 0, 0, 0, this.group);
      const can = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 10), shockMat, 0, 0, 0, this.group);
      const coil = mesh(new THREE.CylinderGeometry(0.17, 0.17, 1, 10, 1, true), springMat, 0, 0, 0, this.group);
      coil.material = springMat;
      this.wheels.push({ ...w, x, z, front, arm1, arm2, rod, can, coil });
    }
    this.axle = [
      mesh(new THREE.CylinderGeometry(0.13, 0.13, 1, 10), armMat, 0, 0, 0, this.group),
      mesh(new THREE.CylinderGeometry(0.13, 0.13, 1, 10), armMat, 0, 0, 0, this.group),
    ];
    this.diff = [mesh(new THREE.SphereGeometry(0.34, 12, 10), DARK(), 0, 0, 0, this.group), mesh(new THREE.SphereGeometry(0.34, 12, 10), DARK(), 0, 0, 0, this.group)];
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this.damageLevel = 0;
    this.buildDamage();
    this.idleT = 0;
    this.setSuspension([0.7, 0.7, 0.7, 0.7], 0, [0, 0, 0, 0]);
  }

  /** 플레이어가 가장 오래 보는 뒷모습: 차체 뒷면을 찾아 후미등과 이름판을 붙인다 */
  buildRear(up, def) {
    this.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const dir = new THREE.Vector3(0, 0, 1);
    const hitZ = (x, y) => {
      ray.set(new THREE.Vector3(x, y + up.position.y, -12), dir);
      const list = ray.intersectObject(up, true);
      return list.length ? list[0].point.z : null;
    };
    this.tailMat = new THREE.MeshStandardMaterial({ color: "#ff2a18", emissive: "#ff1a0a", emissiveIntensity: 0.85, roughness: 0.3 });
    for (const s of [-1, 1]) {
      for (const y of [0.34, 0.2, 0.46, 0.08]) {
        const z = hitZ(s * 0.86, y);
        if (z == null || z > -0.4) continue;
        const lamp = new THREE.Mesh(roundedBox(0.46, 0.18, 0.06, 0.03, 1), this.tailMat);
        lamp.position.set(s * 0.86, y, z - 0.02);
        up.add(lamp);
        break;
      }
    }
    for (const y of [0.3, 0.16, 0.42, 0.05]) {
      const z = hitZ(0, y);
      if (z == null || z > -0.4) continue;
      const word = def.name.split(" ")[0];
      const tex = decalTexture(`rear-${def.id}`, (c, w, h) => {
        c.clearRect(0, 0, w, h);
        c.fillStyle = "rgba(10,12,18,.88)";
        c.fillRect(0, h * 0.14, w, h * 0.72);
        c.fillStyle = "#ffd21f";
        c.font = "900 54px Arial Black, Impact, sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(word, w / 2, h / 2 + 2, w * 0.92);
      });
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.32), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }));
      plate.position.set(0, y, z - 0.015);
      plate.rotation.y = Math.PI;
      up.add(plate);
      break;
    }
  }

  setBrake(on) {
    if (this.tailMat) this.tailMat.emissiveIntensity = on ? 3.4 : 0.85;
  }

  buildDamage() {
    // 금 간 유리 · 그을음 (피해가 쌓이면 보인다)
    const big = this.big;
    const tex = canvasTex("crack", 256, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = "rgba(240,250,255,0.9)";
      c.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        c.beginPath();
        c.moveTo(w * 0.5, h * 0.5);
        const a = i * 1.05;
        let x = w * 0.5;
        let y = h * 0.5;
        for (let k = 0; k < 5; k += 1) {
          x += Math.cos(a + k * 0.3) * 26;
          y += Math.sin(a - k * 0.2) * 16;
          c.lineTo(x, y);
        }
        c.stroke();
      }
    });
    const soot = canvasTex("soot", 256, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 26; i += 1) {
        const x = ((i * 67) % w);
        const y = ((i * 41) % h);
        const r = 10 + (i % 5) * 7;
        const g = c.createRadialGradient(x, y, 1, x, y, r);
        g.addColorStop(0, "rgba(10,8,6,0.7)");
        g.addColorStop(1, "rgba(10,8,6,0)");
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, 7);
        c.fill();
      }
      c.strokeStyle = "rgba(200,200,205,0.75)";
      c.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        c.beginPath();
        c.moveTo((i * 41) % w, (i * 19) % h);
        c.lineTo(((i * 41) % w) + 40, ((i * 19) % h) + 14);
        c.stroke();
      }
    });
    this.crack = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    this.crack.position.set(0, 1.45 * big, 0.92 * big);
    this.crack.rotation.x = -0.82;
    this.shell.add(this.crack);
    this.soots = [];
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6 * big, 1.1 * big), new THREE.MeshBasicMaterial({ map: soot, transparent: true, opacity: 0, depthWrite: false }));
      m.position.set(s * (this.def.id === "toxic" ? 1.1 : this.def.id === "mega" ? 1.6 : this.def.id === "iron" ? 1.47 : this.def.id === "rocket" ? 1.16 : 1.33), 0.32, 0);
      m.rotation.y = (s * Math.PI) / 2;
      this.shell.add(m);
      this.soots.push(m);
    }
  }

  setDamage(pct) {
    this.crack.material.opacity = pct > 30 ? Math.min(1, (pct - 30) / 30) : 0;
    const o = pct > 15 ? Math.min(0.95, (pct - 15) / 70) : 0;
    for (const m of this.soots) m.material.opacity = o;
    this.shell.rotation.z = pct > 70 ? 0.02 : 0;
  }

  link(m, a, b, thick = 1) {
    this._a.copy(b).sub(a);
    const len = this._a.length();
    m.position.copy(a).addScaledVector(this._a, 0.5);
    m.scale.set(thick, len, thick);
    m.quaternion.setFromUnitVectors(UP, this._a.normalize());
  }

  /** lens: 바퀴별 서스펜션 길이, steer: 조향각, spins: 바퀴 회전 */
  setSuspension(lens, steer, spins) {
    const def = this.def;
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const attachY = -0.35;
    this.wheels.forEach((w, i) => {
      const y = attachY - lens[i];
      w.pivot.position.set(w.x, y, w.z);
      w.pivot.rotation.y = w.front ? -steer : steer * 0.2;
      w.spin.rotation.x = spins[i];
      const s = Math.sign(w.x);
      const inner = 0.68;
      // 아래 · 위 팔
      A.set(s * inner, -0.6, w.z + 0.34);
      B.set(w.x - s * def.wheelR * 0.42, y, w.z);
      this.link(w.arm1, A, B);
      A.set(s * inner, -0.6, w.z - 0.34);
      this.link(w.arm2, A, B);
      // 쇼크: 몸통 위쪽 → 바퀴 축
      A.set(s * 0.72, 0.28, w.z);
      B.set(w.x - s * def.wheelR * 0.5, y + 0.05, w.z);
      this.link(w.rod, A, B);
      const k = 0.55;
      const C = A.clone().lerp(B, k);
      this.link(w.can, A, C);
      this.link(w.coil, A.clone().lerp(B, 0.14), A.clone().lerp(B, 0.8));
    });
    // 축
    for (let i = 0; i < 2; i += 1) {
      const L = this.wheels[i * 2];
      const R = this.wheels[i * 2 + 1];
      A.copy(L.pivot.position);
      B.copy(R.pivot.position);
      this.link(this.axle[i], A, B);
      this.diff[i].position.copy(A).lerp(B, 0.5);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    });
  }
}
const UP = new THREE.Vector3(0, 1, 0);
