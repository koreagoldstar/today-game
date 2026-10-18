/*
 * 용암 서핑 · 도형 도우미
 *  둥근 상자 · 떠 있는 섬(윗면은 충돌 원판과 같은 크기) · 밧줄 · 가늘어지는 관 · 재질별 굽기(그리기 횟수 줄이기)
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

/* ---------------- 3D 값 노이즈 (섬 바위 울퉁불퉁) ---------------- */
function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}
export function noise3(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fy = y - yi;
  const fz = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(fx);
  const v = s(fy);
  const w = s(fz);
  const c = (a, b, cc) => hash3(xi + a, yi + b, zi + cc);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export function fbm3(x, y, z, oct = 3) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  let t = 0;
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x * f, y * f, z * f);
    t += a;
    a *= 0.5;
    f *= 2.03;
  }
  return v / t;
}

/** 모서리가 둥근 상자 (w,h,d 전체 크기 · r 둥근 반지름) */
export function roundedBox(w, h, d, r = 0.05, seg = 3) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = new THREE.BoxGeometry(w, h, d, seg * 2 + 1, seg * 2 + 1, seg * 2 + 1);
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const v = new THREE.Vector3();
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  const hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const cx = Math.max(-hw, Math.min(hw, v.x));
    const cy = Math.max(-hh, Math.min(hh, v.y));
    const cz = Math.max(-hd, Math.min(hd, v.z));
    const dx = v.x - cx;
    const dy = v.y - cy;
    const dz = v.z - cz;
    const l = Math.hypot(dx, dy, dz) || 1;
    p.setXYZ(i, cx + (dx / l) * r, cy + (dy / l) * r, cz + (dz / l) * r);
    n.setXYZ(i, dx / l, dy / l, dz / l);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * 곡선을 따라 굵기가 변하는 관 (머리카락 · 뿌리 · 끈 · 목도리)
 * @param {THREE.Vector3[]} pts 조절점 · radius(t) 반지름 · flat 납작하게(1 = 둥글게)
 */
export function taperTube(pts, radius, seg = 20, rad = 10, { capStart = true, capEnd = true, flat = 1 } = {}) {
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
    const r = Math.max(0.0004, radius(t));
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      const cx = Math.cos(a);
      const sy = Math.sin(a) * flat;
      pos.push(P.x + r * (cx * N.x + sy * B.x), P.y + r * (cx * N.y + sy * B.y), P.z + r * (cx * N.z + sy * B.z));
      const nx = cx * N.x + Math.sin(a) * B.x;
      const ny = cx * N.y + Math.sin(a) * B.y;
      const nz = cx * N.z + Math.sin(a) * B.z;
      const l = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / l, ny / l, nz / l);
      uv.push(j / rad, t);
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
    const r = radius(t);
    pos.push(P.x + T.x * r * 0.6, P.y + T.y * r * 0.6, P.z + T.z * r * 0.6);
    nor.push(T.x, T.y, T.z);
    uv.push(0.5, t);
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

/** 두 점 사이로 늘어진 밧줄 (출렁다리 난간) */
export function ropeGeo(a, b, sag = 0.4, r = 0.03, seg = 16) {
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  return taperTube(pts, () => r, seg, 6, { capStart: false, capEnd: false });
}

/**
 * 떠 있는 섬 (원형)
 *  - 윗면: 반지름 R 원판 (충돌 원판과 똑같이) + 가장자리 풀 언덕이 살짝 둥글게 내려감
 *  - 아랫면: 거꾸로 선 울퉁불퉁한 바위 원뿔 (깊이 depth)
 * @returns {{ top: BufferGeometry, rock: BufferGeometry }}
 */
export function islandGeo(R, depth = R * 1.4, { seed = 1, lumpy = 0.35, seg = 48 } = {}) {
  // 윗면: 가운데는 평평 (충돌 높이 0), 가장자리 0.25m 만 둥글게 내려간다
  const top = [];
  top.push(new THREE.Vector2(0, 0));
  top.push(new THREE.Vector2(R * 0.5, 0));
  top.push(new THREE.Vector2(R - 0.25, 0));
  top.push(new THREE.Vector2(R - 0.08, -0.04));
  top.push(new THREE.Vector2(R + 0.04, -0.16));
  top.push(new THREE.Vector2(R + 0.1, -0.34));
  top.push(new THREE.Vector2(R + 0.06, -0.5));
  const topGeo = new THREE.LatheGeometry(top.reverse(), seg);
  topGeo.rotateY(seed);
  // 아랫면 (바위)
  const prof = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // 위는 넓고 아래로 갈수록 뾰족 (중간에 한 번 불룩)
    const r = (R + 0.06) * (1 - Math.pow(t, 1.35)) * (1 + Math.sin(t * Math.PI) * 0.12) + (t === 1 ? 0 : 0.02);
    prof.push(new THREE.Vector2(Math.max(0.001, r), -0.45 - t * depth));
  }
  const rock = new THREE.LatheGeometry(prof, seg, 0, Math.PI * 2);
  const p = rock.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const y = v.y;
    const t = Math.min(1, (-y - 0.45) / depth);
    const rr = Math.hypot(v.x, v.z);
    if (rr < 1e-4) continue;
    // 위쪽 테두리는 거의 그대로 (풀 언덕과 이어지게), 아래로 갈수록 울퉁불퉁
    const k = Math.min(1, t * 3);
    const n = fbm3(v.x * 0.55 + seed * 7, y * 0.7, v.z * 0.55 - seed * 3, 3) - 0.5;
    const ledge = Math.sin(y * 2.4 + seed) * 0.08; // 층층 턱
    const s = 1 + (n * lumpy * 2 + ledge) * k;
    p.setX(i, v.x * s);
    p.setZ(i, v.z * s);
    p.setY(i, y + (n * 0.4 * k));
  }
  rock.computeVertexNormals();
  return { top: topGeo, rock };
}

/** 메시 하나 (재질 이름표 · 색 곱하기) */
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
 * 정점 색 = tint × 아래쪽 어둡게(AO)
 */
export function bake(group, { ao = 0.4, height = 1, base = 0, worldUV = 0 } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = {};
  const M = new THREE.Matrix4();
  const N = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.userData.mat || "stone";
    M.multiplyMatrices(inv, o.matrixWorld);
    N.getNormalMatrix(M);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const p = g.getAttribute("position");
    const no = g.getAttribute("normal");
    const uvA = g.getAttribute("uv");
    const colA = g.getAttribute("color");
    const out = buckets[mat] || (buckets[mat] = { pos: [], nor: [], uv: [], col: [] });
    const tint = o.userData.tint == null ? 1 : o.userData.tint;
    const tintC = typeof tint === "number" ? new THREE.Color(tint, tint, tint) : new THREE.Color(tint);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(M);
      n.fromBufferAttribute(no, i).applyMatrix3(N).normalize();
      out.pos.push(v.x, v.y, v.z);
      out.nor.push(n.x, n.y, n.z);
      if (worldUV > 0) {
        const ax = Math.abs(n.x);
        const ay = Math.abs(n.y);
        const az = Math.abs(n.z);
        if (ay >= ax && ay >= az) out.uv.push(v.x * worldUV, v.z * worldUV);
        else if (ax >= az) out.uv.push(v.z * worldUV, v.y * worldUV);
        else out.uv.push(v.x * worldUV, v.y * worldUV);
      } else if (uvA) out.uv.push(uvA.getX(i), uvA.getY(i));
      else out.uv.push(0, 0);
      const h = Math.max(0, Math.min(1, (v.y - base) / height));
      const shade = 1 - ao * (1 - h) * (1 - h);
      let r = tintC.r * shade;
      let gg = tintC.g * shade;
      let b = tintC.b * shade;
      if (colA) {
        r *= colA.getX(i);
        gg *= colA.getY(i);
        b *= colA.getZ(i);
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

/** 정점 색 채우기 (굽지 않는 메시에 아래쪽 그늘 넣기) */
export function shadeVerts(geo, { top = 1, bottom = 0.55, y0 = null, y1 = null, color = "#ffffff" } = {}) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const a = y0 ?? bb.min.y;
  const b = y1 ?? bb.max.y;
  const p = geo.getAttribute("position");
  const c = new THREE.Color(color);
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, (p.getY(i) - a) / (b - a || 1)));
    const k = bottom + (top - bottom) * t;
    col[i * 3] = c.r * k;
    col[i * 3 + 1] = c.g * k;
    col[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/**
 * 같은 재질을 쓰는 메시들을 하나로 합친다 (그리기 횟수 줄이기).
 *  userData.keep 이 있는 그룹(돌아가는 프로펠러 · 펄럭이는 깃발 · 폭포 등)과 스프라이트는 그대로 둔다.
 * @returns 합쳐진 메시들이 들어 있는 새 그룹 (원래 그룹 자리에 그대로 쓰면 된다)
 */
export function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const keep = [];
  const M = new THREE.Matrix4();
  const N = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const walk = (o) => {
    for (const c of [...o.children]) {
      if (c.userData.keep || c.isSprite || c.isPoints || c.isInstancedMesh || (c.isMesh && (c.material.transparent || Array.isArray(c.material)))) {
        keep.push(c);
        continue;
      }
      if (c.isMesh) {
        const key = c.material;
        if (!buckets.has(key)) buckets.set(key, { pos: [], nor: [], uv: [], col: [], cast: false, recv: false });
        const b = buckets.get(key);
        b.cast = b.cast || c.castShadow;
        b.recv = b.recv || c.receiveShadow;
        M.multiplyMatrices(inv, c.matrixWorld);
        N.getNormalMatrix(M);
        const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry;
        const p = g.getAttribute("position");
        const no = g.getAttribute("normal");
        const uv = g.getAttribute("uv");
        const col = g.getAttribute("color");
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(M);
          b.pos.push(v.x, v.y, v.z);
          if (no) {
            n.fromBufferAttribute(no, i).applyMatrix3(N).normalize();
            b.nor.push(n.x, n.y, n.z);
          } else b.nor.push(0, 1, 0);
          if (uv) b.uv.push(uv.getX(i), uv.getY(i));
          else b.uv.push(0, 0);
          if (col) b.col.push(col.getX(i), col.getY(i), col.getZ(i));
          else b.col.push(1, 1, 1);
        }
        if (g !== c.geometry) g.dispose();
      }
      walk(c);
    }
  };
  walk(group);
  const out = new THREE.Group();
  out.position.copy(group.position);
  out.quaternion.copy(group.quaternion);
  out.scale.copy(group.scale);
  for (const [mat, b] of buckets) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = b.cast;
    m.receiveShadow = b.recv;
    out.add(m);
  }
  // 남겨 둔 것들은 세계 좌표를 유지한 채 새 그룹으로 옮긴다
  for (const k of keep) {
    const wm = k.matrixWorld.clone();
    const local = new THREE.Matrix4().multiplyMatrices(inv, wm);
    k.parent.remove(k);
    local.decompose(k.position, k.quaternion, k.scale);
    out.add(k);
  }
  return out;
}
