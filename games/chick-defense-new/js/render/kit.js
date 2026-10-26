/*
 * 3D 모델 도구: 카툰(툰) 재질 · 모양(도형) 캐시 · 부품을 붙이는 작은 함수
 *  같은 색 · 같은 모양은 한 번만 만들어 모든 적 · 타워가 같이 씀 (메모리 · 불러오기 시간 절약)
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

export { THREE };

let gradient = null;
function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

/*
 * 카툰 느낌 공통 설정
 *  outline: 바깥 윤곽선 (뒷면을 노멀 방향으로 조금 부풀린 껍데기 — '인버티드 헐') · 낮은 그래픽에선 끔
 *  rim: 가장자리 빛 (툰 재질에 붙여 캐릭터가 배경에서 또렷하게)
 *  time: 풀 흔들림 같은 셰이더 애니메이션 시간
 */
export const FX = { outline: true, rim: { value: 0.24 }, time: { value: 0 }, outlineW: { value: 0.016 }, envK: 0.6 };
const rimPatch = (shader) => {
  shader.uniforms.uRim = FX.rim;
  shader.fragmentShader = shader.fragmentShader
    .replace("void main() {", "uniform float uRim;\nvoid main() {")
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      {
        vec3 vdir = normalize(vViewPosition);
        float rim = pow(1.0 - clamp(abs(dot(normal, vdir)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += diffuseColor.rgb * rim * uRim + vec3(rim * uRim * 0.18);
      }`
    );
};
let outlineMat = null;
export function getOutlineMat() {
  if (outlineMat) return outlineMat;
  // 윤곽선: 검정 대신 짙은 보라 갈색 (만화 같지만 덜 딱딱하게)
  outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a1f30, side: THREE.BackSide });
  outlineMat.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = FX.outlineW;
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "uniform float uOutline;\nvoid main() {")
      .replace("#include <begin_vertex>", "vec3 transformed = vec3( position ) + normalize( normal ) * uOutline;");
  };
  outlineMat.customProgramCacheKey = () => "cdn-outline";
  return outlineMat;
}
const NO_OUTLINE = new Set(["wing", "leaf", "ring", "disc"]);

/** 캔버스로 그린 무늬 → 반복 질감 */
export function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const MATS = new Map();
/**
 * 재질: color(숫자) · o: { emissive, ei(세기), opacity, flat(빛 안 받음), rough(거칠기), metal(금속), side }
 *  부드러운 물리 재질(하늘 반사광 · 둥근 하이라이트) + 가장자리 빛 → 말랑한 장난감 같은 입체감
 */
export function mat(color, o = {}) {
  const key = `${color}|${o.emissive || 0}|${o.ei || 0}|${o.opacity ?? 1}|${o.flat ? 1 : 0}|${o.side || 0}|${o.depthWrite ?? 1}|${o.noRim ? 1 : 0}|${o.rough ?? ""}|${o.metal ?? ""}`;
  let m = MATS.get(key);
  if (m) return m;
  if (o.flat) m = new THREE.MeshBasicMaterial({ color });
  else {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.52, metalness: o.metal ?? 0 });
    m.envMapIntensity = 0.7;
    if (!o.noRim) {
      m.onBeforeCompile = rimPatch;
      m.customProgramCacheKey = () => "cdn-rim";
    }
  }
  if (o.emissive != null && !o.flat) {
    m.emissive = new THREE.Color(o.emissive);
    m.emissiveIntensity = o.ei ?? 1;
  }
  if (o.opacity != null && o.opacity < 1) {
    m.transparent = true;
    m.opacity = o.opacity;
    m.depthWrite = o.depthWrite ?? false;
  }
  if (o.side) m.side = THREE.DoubleSide;
  MATS.set(key, m);
  return m;
}
/** 한 개만 쓰는 재질 (색 · 투명도를 따로 바꿔야 할 때 — 맞았을 때 번쩍 등) */
export function ownMat(color, o = {}) {
  const m = mat(color, o).clone();
  return m;
}

const GEOS = new Map();
export function geo(kind, ...a) {
  const key = kind + a.join(",");
  let g = GEOS.get(key);
  if (g) return g;
  switch (kind) {
    case "sphere":
      g = new THREE.SphereGeometry(a[0] ?? 0.5, a[1] ?? 16, a[2] ?? 12);
      break;
    case "hemi":
      g = new THREE.SphereGeometry(a[0] ?? 0.5, a[1] ?? 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      break;
    case "box":
      g = new THREE.BoxGeometry(a[0] ?? 1, a[1] ?? 1, a[2] ?? 1);
      break;
    case "cyl":
      g = new THREE.CylinderGeometry(a[0] ?? 0.5, a[1] ?? 0.5, a[2] ?? 1, a[3] ?? 14);
      break;
    case "cone":
      g = new THREE.ConeGeometry(a[0] ?? 0.5, a[1] ?? 1, a[2] ?? 12);
      break;
    case "torus":
      g = new THREE.TorusGeometry(a[0] ?? 0.5, a[1] ?? 0.12, a[2] ?? 8, a[3] ?? 20, a[4] ?? Math.PI * 2);
      break;
    case "ico":
      g = new THREE.IcosahedronGeometry(a[0] ?? 0.5, a[1] ?? 0);
      break;
    case "dodeca":
      g = new THREE.DodecahedronGeometry(a[0] ?? 0.5, a[1] ?? 0);
      break;
    case "octa":
      g = new THREE.OctahedronGeometry(a[0] ?? 0.5, a[1] ?? 0);
      break;
    case "capsule":
      g = new THREE.CapsuleGeometry(a[0] ?? 0.3, a[1] ?? 0.6, 6, 12);
      break;
    case "ring":
      g = new THREE.RingGeometry(a[0] ?? 0.8, a[1] ?? 1, a[2] ?? 40);
      g.rotateX(-Math.PI / 2);
      break;
    case "disc":
      g = new THREE.CircleGeometry(a[0] ?? 1, a[1] ?? 40);
      g.rotateX(-Math.PI / 2);
      break;
    case "wing": {
      // 얇은 날개 (삼각형 셋)
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(1, 0.35);
      s.lineTo(0.85, -0.1);
      s.lineTo(0.62, 0.05);
      s.lineTo(0.48, -0.22);
      s.lineTo(0.28, -0.02);
      s.lineTo(0, -0.2);
      g = new THREE.ShapeGeometry(s);
      break;
    }
    case "leaf": {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.quadraticCurveTo(0.3, 0.25, 0, 0.8);
      s.quadraticCurveTo(-0.3, 0.25, 0, 0);
      g = new THREE.ShapeGeometry(s);
      break;
    }
    default:
      throw new Error("모양 없음 " + kind);
  }
  GEOS.set(key, g);
  return g;
}

/**
 * 부품 하나 붙이기
 *  part(parent, "sphere", [r], color, { p:[x,y,z], s:[x,y,z]|n, r:[x,y,z], name, o: 재질옵션, shadow })
 */
export function part(parent, kind, args, color, opt = {}) {
  const m = new THREE.Mesh(geo(kind, ...(args || [])), opt.material || mat(color, opt.o || {}));
  if (opt.p) m.position.set(opt.p[0], opt.p[1], opt.p[2]);
  if (opt.s != null) {
    if (typeof opt.s === "number") m.scale.setScalar(opt.s);
    else m.scale.set(opt.s[0], opt.s[1], opt.s[2]);
  }
  if (opt.r) m.rotation.set(opt.r[0], opt.r[1], opt.r[2]);
  // 아주 작은 부품은 그림자를 만들지 않음 (그림자 그리기 횟수 줄이기 · 보이는 차이 없음)
  const gg = m.geometry;
  if (!gg.boundingSphere) gg.computeBoundingSphere();
  const sc0 = opt.s == null ? 1 : typeof opt.s === "number" ? opt.s : Math.max(opt.s[0], opt.s[1], opt.s[2]);
  m.castShadow = opt.shadow !== false && gg.boundingSphere.radius * sc0 > 0.09;
  m.receiveShadow = false;
  if (opt.name) m.name = opt.name;
  parent.add(m);
  // 윤곽선: 반투명 · 빛 안 받는 것 · 납작한 모양 · 아주 작은 부품은 빼고
  const oo = opt.o || {};
  if (FX.outline && opt.outline !== false && !oo.flat && !(oo.opacity < 1) && !opt.material && !NO_OUTLINE.has(kind)) {
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const sc = opt.s == null ? 1 : typeof opt.s === "number" ? opt.s : Math.max(opt.s[0], opt.s[1], opt.s[2]);
    if (g.boundingSphere.radius * sc > 0.06) {
      const ol = new THREE.Mesh(g, getOutlineMat());
      ol.castShadow = false;
      ol.name = "outline";
      m.add(ol);
    }
  }
  return m;
}
export function group(parent, opt = {}) {
  const g = new THREE.Group();
  if (opt.p) g.position.set(opt.p[0], opt.p[1], opt.p[2]);
  if (opt.r) g.rotation.set(opt.r[0], opt.r[1], opt.r[2]);
  if (opt.s != null) {
    if (typeof opt.s === "number") g.scale.setScalar(opt.s);
    else g.scale.set(opt.s[0], opt.s[1], opt.s[2]);
  }
  if (parent) parent.add(g);
  return g;
}

const VC = new Map();
function vcMat(rough) {
  if (VC.has(rough)) return VC.get(rough);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0 });
  m.envMapIntensity = 0.7;
  m.onBeforeCompile = rimPatch;
  m.customProgramCacheKey = () => "cdn-rim";
  VC.set(rough, m);
  return m;
}
/**
 * 움직이지 않는 부품을 한 덩어리로 합치기 (그리기 횟수를 크게 줄임 · 모양 · 색은 그대로)
 *  keep: 움직이는 부품(또는 그 묶음) — 그것과 그 아래는 그대로 둠
 *  빛나는 것 · 반투명 · 빛 안 받는 것 · 금속 재질도 그대로 둠
 *  합친 모양은 이 물체만의 것 → 치울 때 disposeOwn() 으로 지움
 */
export function flatten(root, keep = []) {
  const keepSet = new Set(keep.filter(Boolean));
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const ok = (o) => {
    for (let p = o; p && p !== root; p = p.parent) if (keepSet.has(p)) return false;
    const m = o.material;
    if (!m || !m.isMeshStandardMaterial || m.vertexColors || m.transparent || m.metalness > 0.2) return false;
    if (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return false;
    return true;
  };
  const victims = [];
  root.traverse((o) => {
    if (o.isMesh && o.name !== "outline" && !o.isInstancedMesh && ok(o)) victims.push(o);
  });
  if (victims.length < 2) return null;
  const byRough = new Map();
  const tm = new THREE.Matrix4();
  for (const o of victims) {
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    tm.multiplyMatrices(inv, o.matrixWorld);
    g.applyMatrix4(tm);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = o.material.color;
    for (let i = 0; i < n; i++) {
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const r = Math.round(o.material.roughness * 10) / 10;
    if (!byRough.has(r)) byRough.set(r, []);
    byRough.get(r).push({ g, shadow: o.castShadow, outline: o.children.some((ch) => ch.name === "outline") });
  }
  for (const o of victims) o.parent.remove(o);
  const out = [];
  for (const [r, list] of byRough) {
    for (const outlined of [true, false]) {
      const part = list.filter((q) => q.outline === outlined);
      if (!part.length) continue;
      let total = 0;
      for (const q of part) total += q.g.attributes.position.count;
      const pos = new Float32Array(total * 3);
      const nrm = new Float32Array(total * 3);
      const col = new Float32Array(total * 3);
      let off = 0;
      for (const q of part) {
        pos.set(q.g.attributes.position.array, off * 3);
        nrm.set(q.g.attributes.normal.array, off * 3);
        col.set(q.g.attributes.color.array, off * 3);
        off += q.g.attributes.position.count;
        q.g.dispose();
      }
      const geo2 = new THREE.BufferGeometry();
      geo2.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo2.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      geo2.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo2.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo2, vcMat(r));
      mesh.castShadow = part.some((q) => q.shadow);
      mesh.userData.own = true;
      mesh.name = "flat";
      if (outlined && FX.outline) {
        const ol = new THREE.Mesh(geo2, getOutlineMat());
        ol.name = "outline";
        mesh.add(ol);
      }
      root.add(mesh);
      out.push(mesh);
    }
  }
  return out;
}
/**
 * 캐릭터용 자동 합치기: 동작 함수를 여러 상태로 미리 돌려 보아 '실제로 움직이거나 바뀌는 부품'을 찾고,
 *  그 밖의 부품만 같은 묶음(그룹) 안에서 한 덩어리로 합친다 → 묶음 단위 동작(걷기 · 날개 등)은 그대로.
 *  tick(i): i 번째 시험 동작 (상태 · 시간을 바꿔 가며). 시험 중 오류가 나면 합치지 않음(안전).
 */
export function mergeStatic(root, tick, n = 48) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && o.name !== "outline") meshes.push(o);
  });
  if (meshes.length < 6) return false;
  const key = (o) => `${o.position.x.toFixed(4)},${o.position.y.toFixed(4)},${o.position.z.toFixed(4)},${o.rotation.x.toFixed(4)},${o.rotation.y.toFixed(4)},${o.rotation.z.toFixed(4)},${o.scale.x.toFixed(4)},${o.scale.y.toFixed(4)},${o.scale.z.toFixed(4)},${o.visible},${o.material.uuid}`;
  const base = meshes.map(key);
  const moved = new Set();
  try {
    for (let i = 0; i < n; i++) {
      tick(i);
      meshes.forEach((o, j) => {
        if (key(o) !== base[j]) moved.add(o);
      });
    }
  } catch (_) {
    return false;
  }
  const groups = [];
  root.traverse((o) => {
    if (!o.isMesh) groups.push(o);
  });
  const tm = new THREE.Matrix4();
  for (const G of groups) {
    const kids = G.children.filter((o) => {
      if (!o.isMesh || o.name === "outline" || moved.has(o)) return false;
      if (o.children.some((ch) => ch.name !== "outline")) return false;
      const m = o.material;
      if (!m || !m.isMeshStandardMaterial || m.vertexColors || m.transparent || m.metalness > 0.2) return false;
      if (m.emissive && m.emissive.getHex() !== 0 && m.emissiveIntensity > 0) return false;
      return true;
    });
    if (kids.length < 2) continue;
    const byKey = new Map();
    for (const o of kids) {
      o.updateMatrix();
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
      g.applyMatrix4(tm.copy(o.matrix));
      const cnt = g.attributes.position.count;
      const col = new Float32Array(cnt * 3);
      const c = o.material.color;
      for (let i = 0; i < cnt; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const ol = o.children.some((ch) => ch.name === "outline");
      const k = `${Math.round(o.material.roughness * 10) / 10}|${ol}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push({ g, shadow: o.castShadow });
      G.remove(o);
    }
    for (const [k, list] of byKey) {
      const [r, ol] = k.split("|");
      let total = 0;
      for (const q of list) total += q.g.attributes.position.count;
      const pos = new Float32Array(total * 3);
      const nrm = new Float32Array(total * 3);
      const col = new Float32Array(total * 3);
      let off = 0;
      for (const q of list) {
        pos.set(q.g.attributes.position.array, off * 3);
        nrm.set(q.g.attributes.normal.array, off * 3);
        col.set(q.g.attributes.color.array, off * 3);
        off += q.g.attributes.position.count;
        q.g.dispose();
      }
      const geo2 = new THREE.BufferGeometry();
      geo2.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo2.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      geo2.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo2.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo2, vcMat(+r));
      mesh.castShadow = list.some((q) => q.shadow);
      mesh.name = "flat";
      if (ol === "true" && FX.outline) {
        const o2 = new THREE.Mesh(geo2, getOutlineMat());
        o2.name = "outline";
        mesh.add(o2);
      }
      G.add(mesh);
    }
  }
  return true;
}
/** flatten 등으로 만든 이 물체만의 모양 지우기 */
export function disposeOwn(root) {
  root.traverse((o) => {
    if (o.name === "flat" && o.geometry) o.geometry.dispose();
  });
}
/**
 * 눈 한 쌍 — 귀여움의 핵심
 *  세로로 조금 긴 흰자 · 큰 눈동자 · 반짝 두 개(큰 것 · 작은 것) · 화난 눈은 눈썹 + 윗눈꺼풀
 */
export function eyes(parent, { x = 0.12, y = 0, z = 0.3, r = 0.08, pupil = 0x1b1b2a, white = 0xffffff, look = 1, angry = false, glow = null, lid = null } = {}) {
  const g = group(parent, { p: [0, y, z] });
  r *= 1.18;
  for (const sx of [-1, 1]) {
    if (glow != null) {
      part(g, "sphere", [r, 12, 10], glow, { p: [sx * x, 0, 0], s: [1, 1.15, 0.8], o: { emissive: glow, ei: 1.4 }, shadow: false });
      continue;
    }
    part(g, "sphere", [r, 14, 12], white, { p: [sx * x, 0, 0], s: [1, 1.14, 0.78], o: { rough: 0.25 }, shadow: false });
    part(g, "sphere", [r * 0.66, 12, 10], pupil, { p: [sx * x, -r * 0.06, r * 0.42 * look], s: [1, 1.12, 0.7], o: { rough: 0.15 }, shadow: false });
    part(g, "sphere", [r * 0.26, 8, 6], 0xffffff, { p: [sx * x + r * 0.24, r * 0.32, r * 0.78], o: { flat: true }, shadow: false });
    part(g, "sphere", [r * 0.12, 6, 4], 0xffffff, { p: [sx * x - r * 0.22, -r * 0.3, r * 0.76], o: { flat: true }, shadow: false });
    if (angry || lid != null) part(g, "hemi", [r * 1.05, 14], lid ?? 0x2a1a22, { p: [sx * x, r * 0.1, 0.002], s: [1, 0.6, 0.82], r: [0.3, 0, -sx * (angry ? 0.42 : 0.08)], shadow: false, outline: false });
    if (angry) part(g, "box", [r * 1.7, r * 0.34, r * 0.32], 0x2a1a22, { p: [sx * x, r * 1.12, r * 0.35], r: [0, 0, -sx * 0.5], shadow: false });
  }
  return g;
}
/** 입: 웃는 입(호) · 벌린 입(검은 입 + 분홍 혀) · 이빨 */
export function mouth(parent, { y = 0, z = 0.3, w = 0.08, open = false, color = 0x3a1a22, teeth = false, frown = false } = {}) {
  const g = group(parent, { p: [0, y, z] });
  if (open) {
    part(g, "sphere", [w, 12, 8], color, { s: [1, 0.75, 0.45], shadow: false });
    part(g, "sphere", [w * 0.6, 10, 6], 0xff8aa8, { p: [0, -w * 0.32, w * 0.12], s: [1, 0.5, 0.5], shadow: false, outline: false });
  } else part(g, "torus", [w, w * 0.2, 6, 14, Math.PI], color, { r: [0, 0, frown ? 0 : Math.PI], shadow: false, outline: false });
  if (teeth) for (const sx of [-1, 1]) part(g, "cone", [w * 0.22, w * 0.55, 5], 0xfffbf0, { p: [sx * w * 0.45, open ? w * 0.42 : -w * 0.1, w * 0.18], r: [Math.PI, 0, 0], shadow: false, outline: false });
  return g;
}
/** 볼 터치 (분홍 동그라미) */
export function cheeks(parent, { x = 0.15, y = 0, z = 0.25, r = 0.05, color = 0xff8fa8 } = {}) {
  for (const sx of [-1, 1]) part(parent, "sphere", [r, 10, 6], color, { p: [sx * x, y, z], s: [1, 0.6, 0.35], o: { flat: true, opacity: 0.55 }, shadow: false });
}
