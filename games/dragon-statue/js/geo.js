/*
 * 드래곤 석상 대작전 · 도형 도우미
 *  가늘어지는 관(목 · 꼬리 · 뿔) · 그룹 굽기(재질별로 한 덩어리로 합쳐 그리기 횟수 줄이기)
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

/**
 * 곡선을 따라 굵기가 변하는 관.
 * @param {THREE.Vector3[]} pts 조절점 (CatmullRom)
 * @param {(t:number)=>number} radius t(0~1) → 반지름
 * @param {number} seg 길이 방향 마디 · @param {number} rad 둘레 마디
 * @param {boolean} capEnd 끝을 둥글게 막기
 */
export function taperTube(pts, radius, seg = 20, rad = 12, { capStart = true, capEnd = true, flat = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, P);
    const r = Math.max(0.0005, radius(t));
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      const cx = Math.cos(a);
      const sy = Math.sin(a) * flat;
      const nx = cx * N.x + Math.sin(a) * B.x;
      const ny = cx * N.y + Math.sin(a) * B.y;
      const nz = cx * N.z + Math.sin(a) * B.z;
      pos.push(P.x + r * (cx * N.x + sy * B.x), P.y + r * (cx * N.y + sy * B.y), P.z + r * (cx * N.z + sy * B.z));
      const l = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / l, ny / l, nz / l);
      uv.push(j / rad, t * 2);
    }
  }
  const row = rad + 1;
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rad; j++) {
      const a = i * row + j;
      const b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const addCap = (i, dir) => {
    const t = i / seg;
    curve.getPointAt(t, P);
    const T = curve.getTangentAt(t).multiplyScalar(dir);
    const c = pos.length / 3;
    pos.push(P.x + T.x * radius(t) * 0.6, P.y + T.y * radius(t) * 0.6, P.z + T.z * radius(t) * 0.6);
    nor.push(T.x, T.y, T.z);
    uv.push(0.5, t * 2);
    for (let j = 0; j < rad; j++) {
      const a = i * row + j;
      if (dir > 0) idx.push(a, a + 1, c);
      else idx.push(a + 1, a, c);
    }
  };
  if (capStart) addCap(0, -1);
  if (capEnd) addCap(seg, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** 얇은 판 모양(날개 막 · 지느러미)을 두께 있게 */
export function slab(shape, depth = 0.04, bevel = 0.012, curveSeg = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curveSeg });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** 메시 하나 만들기 (재질 이름표 · 색 곱하기) */
export function part(geo, mat, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], tint = 1 } = {}) {
  const m = new THREE.Mesh(geo);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (typeof scale === "number") m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.userData.mat = mat;
  m.userData.tint = tint;
  return m;
}

/**
 * 그룹 굽기: 그룹 안 메시를 재질 이름별로 하나의 BufferGeometry 로 합친다 (그룹 기준 좌표).
 * 정점 색 = tint × 아래쪽 어둡게(AO) × (위를 향한 면에 이끼 · 눈 등 덮개)
 * @returns {{ [mat:string]: THREE.BufferGeometry }}
 */
export function bake(group, { ao = 0.42, cover = null, coverAmount = 0, height = 1, seed = 1, base = 0, worldUV = 0 } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = {};
  const M = new THREE.Matrix4();
  const N = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  let k = seed * 13.7;
  const coverC = cover ? new THREE.Color(cover) : null;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.userData.mat || "stone";
    M.multiplyMatrices(inv, o.matrixWorld);
    N.getNormalMatrix(M);
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const p = g.getAttribute("position");
    const no = g.getAttribute("normal");
    const uvA = g.getAttribute("uv");
    const cnt = p.count;
    const out = buckets[mat] || (buckets[mat] = { pos: [], nor: [], uv: [], col: [] });
    const tint = o.userData.tint == null ? 1 : o.userData.tint;
    const tintC = typeof tint === "number" ? new THREE.Color(tint, tint, tint) : new THREE.Color(tint);
    for (let i = 0; i < cnt; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(M);
      n.fromBufferAttribute(no, i).applyMatrix3(N).normalize();
      out.pos.push(v.x, v.y, v.z);
      out.nor.push(n.x, n.y, n.z);
      if (worldUV > 0) {
        // 세계 좌표로 텍스처 펴기 (긴 발판도 무늬가 늘어나지 않게)
        const ax = Math.abs(n.x);
        const ay = Math.abs(n.y);
        const az = Math.abs(n.z);
        if (ay >= ax && ay >= az) out.uv.push(v.x * worldUV, v.z * worldUV);
        else if (ax >= az) out.uv.push(v.z * worldUV, v.y * worldUV);
        else out.uv.push(v.x * worldUV, v.y * worldUV);
      } else if (uvA) out.uv.push(uvA.getX(i), uvA.getY(i));
      else out.uv.push(0, 0);
      // 아래쪽 · 안쪽은 어둡게 (간단한 그늘)
      const h = Math.max(0, Math.min(1, (v.y - base) / height));
      const shade = 1 - ao * (1 - h) * (1 - h) - (n.y < -0.3 ? 0.12 : 0);
      let r = tintC.r * shade;
      let gg = tintC.g * shade;
      let b = tintC.b * shade;
      // 위를 향한 면에 이끼 · 눈 덮개 (조금 얼룩지게)
      if (coverC && n.y > 0.45 && (mat === "stone" || mat === "skin" || mat === "base")) {
        const wob = Math.sin(v.x * 23 + k) * Math.sin(v.z * 19 + v.y * 7) * 0.5 + 0.5;
        const c = Math.min(1, (n.y - 0.45) * 2.2) * coverAmount * (0.45 + wob * 0.55);
        r += (coverC.r - r) * c;
        gg += (coverC.g - gg) * c;
        b += (coverC.b - b) * c;
      }
      out.col.push(r, gg, b);
    }
    g.dispose();
  });
  const res = {};
  for (const [mat, d] of Object.entries(buckets)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(d.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(d.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(d.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(d.col, 3));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    res[mat] = g;
  }
  return res;
}

/** 굽은 뿔 · 발톱: 끝으로 갈수록 가늘어지는 휜 관 */
export function horn(len, r0, curl = 0.6, twist = 0, seg = 12) {
  const pts = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const a = t * curl;
    pts.push(new THREE.Vector3(Math.sin(t * twist) * len * 0.15, Math.sin(a) * len * 0.9 * t + t * len * 0.35, -(1 - Math.cos(a)) * len * 0.8 * t));
  }
  return taperTube(pts, (t) => r0 * (1 - t * 0.92), seg, 10, { capStart: true, capEnd: true });
}
