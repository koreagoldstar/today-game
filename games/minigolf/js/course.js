/*
 * 코스: 18홀 (파 72)
 *  홀 하나 = 중심선 + 페어웨이 폭 + 그린 + 벙커 + 호수 + 나무 + 언덕
 *  높이는 격자에 구워 두고(공 물리 · 지형 메쉬가 같은 값), 땅 무늬는 캔버스에 그려 덮는다.
 *  좌표: 티가 (0, 0), 앞쪽이 -z. 단위 m.
 */
import { THREE, Batch, merge, rng, range, std, canvas, tex, noise2, fbm, mat4, clamp, lerp, TAU } from "../../oneshot-elite/js/kit.js";
import { barkTex, leafTex, waterPBR } from "../../oneshot-elite/js/textures.js";

/* pts: 중심선 · w: 페어웨이 폭 · r: 그린 반지름 · rise: 티에서 그린까지 높이 차 · hills: 언덕 크기
   start: 페어웨이가 시작되는 비율 · bunkers: 길 기준 {t, off, r} 또는 그린 기준 {ga(도), gd(거리), r}
   water: {t, off, rx, rz} 또는 그린 기준 {ga, gd, rx, rz} · pin: 그린 안 핀 위치(비율) · slope: 그린 경사 [방향(도), 세기] */
export const HOLES = [
  { n: 1, par: 4, name: "첫 티샷", pts: [[0, 0], [0, -120], [-6, -230], [4, -322]], w: 40, r: 16, rise: 2, hills: 3, start: 0.26, time: "morning", wind: [0.5, 2.5], pin: [0.2, -0.2], slope: [40, 0.012], bunkers: [{ ga: 40, gd: 21, r: 6 }, { ga: -50, gd: 21, r: 5 }, { t: 0.64, off: 26, r: 8 }] },
  { n: 2, par: 3, name: "물을 넘겨라", pts: [[0, 0], [2, -80], [8, -152]], w: 26, r: 15, rise: -3, hills: 2.5, start: 0.72, time: "morning", wind: [1, 3], pin: [-0.25, 0.1], slope: [120, 0.016], water: [{ t: 0.54, off: 8, rx: 30, rz: 18 }], bunkers: [{ ga: 110, gd: 20, r: 5 }] },
  { n: 3, par: 4, name: "오른쪽으로 굽은 길", pts: [[0, 0], [0, -120], [12, -212], [58, -292], [112, -336]], w: 34, r: 15, rise: 4, hills: 4, start: 0.24, time: "morning", wind: [1, 3.5], pin: [0.3, 0.1], slope: [200, 0.018], bunkers: [{ t: 0.52, off: -24, r: 9 }, { t: 0.46, off: 26, r: 7 }, { ga: 60, gd: 20, r: 6 }] },
  { n: 4, par: 5, name: "긴 물결", pts: [[0, 0], [-6, -140], [24, -270], [-8, -390], [8, -490]], w: 38, r: 17, rise: 6, hills: 5, start: 0.18, time: "morning", wind: [1.5, 4], pin: [-0.2, -0.3], slope: [300, 0.014], bunkers: [{ t: 0.33, off: 22, r: 8 }, { t: 0.55, off: -24, r: 9 }, { t: 0.76, off: 24, r: 8 }, { ga: -40, gd: 22, r: 6 }, { ga: 45, gd: 22, r: 6 }] },
  { n: 5, par: 4, name: "내리막 페어웨이", pts: [[0, 0], [8, -130], [-4, -250], [-16, -350]], w: 36, r: 15, rise: -14, hills: 3, start: 0.24, time: "morning", wind: [0.5, 3], pin: [0.1, 0.3], slope: [90, 0.02], bunkers: [{ t: 0.7, off: -22, r: 8 }, { ga: 20, gd: 20, r: 6 }], water: [{ t: 0.62, off: 42, rx: 20, rz: 42 }] },
  { n: 6, par: 3, name: "호수 앞 그린", pts: [[0, 0], [-4, -90], [-14, -172]], w: 24, r: 14, rise: 2, hills: 2, start: 0.8, time: "morning", wind: [1.5, 4], pin: [0.3, -0.2], slope: [260, 0.016], water: [{ t: 0.62, off: -2, rx: 34, rz: 22 }], bunkers: [{ ga: 150, gd: 19, r: 5 }, { ga: -150, gd: 19, r: 5 }] },
  { n: 7, par: 4, name: "왼쪽 호수", pts: [[0, 0], [2, -130], [-14, -240], [-60, -340], [-82, -386]], w: 32, r: 15, rise: 3, hills: 3, start: 0.22, time: "day", wind: [1, 4], pin: [0, 0.3], slope: [20, 0.018], water: [{ t: 0.62, off: -46, rx: 30, rz: 60 }], bunkers: [{ t: 0.55, off: 24, r: 9 }, { ga: 70, gd: 20, r: 6 }] },
  { n: 8, par: 5, name: "오르막 긴 홀", pts: [[0, 0], [10, -160], [-10, -320], [6, -500]], w: 40, r: 18, rise: 22, hills: 4, start: 0.16, time: "day", wind: [1, 3.5], pin: [0.2, 0.2], slope: [180, 0.022], bunkers: [{ t: 0.4, off: -26, r: 9 }, { t: 0.62, off: 26, r: 10 }, { t: 0.86, off: 0, r: 7 }, { ga: 50, gd: 23, r: 6 }] },
  { n: 9, par: 4, name: "쌍둥이 벙커", pts: [[0, 0], [0, -140], [8, -260], [2, -352]], w: 30, r: 16, rise: 1, hills: 3.5, start: 0.25, time: "day", wind: [1, 3], pin: [-0.3, 0], slope: [330, 0.018], bunkers: [{ t: 0.6, off: -19, r: 8 }, { t: 0.6, off: 19, r: 8 }, { ga: 35, gd: 21, r: 7 }, { ga: -35, gd: 21, r: 7 }] },
  { n: 10, par: 4, name: "왼쪽으로 굽은 숲길", pts: [[0, 0], [2, -120], [-14, -216], [-66, -282], [-112, -316]], w: 32, r: 15, rise: 5, hills: 4, start: 0.24, time: "day", wind: [0.5, 2.5], dense: 1.5, pin: [0.2, -0.1], slope: [100, 0.018], bunkers: [{ t: 0.5, off: 24, r: 8 }, { ga: -60, gd: 20, r: 6 }] },
  { n: 11, par: 3, name: "높은 티", pts: [[0, 0], [0, -70], [6, -132]], w: 22, r: 13, rise: -16, hills: 2, start: 0.8, time: "day", wind: [1.5, 4.5], pin: [0.2, 0.2], slope: [50, 0.018], water: [{ t: 0.66, off: -22, rx: 22, rz: 22 }], bunkers: [{ ga: -100, gd: 18, r: 5 }, { ga: 100, gd: 18, r: 5 }] },
  { n: 12, par: 5, name: "개울 건너기", pts: [[0, 0], [-8, -150], [8, -300], [-4, -472]], w: 38, r: 16, rise: 5, hills: 4, start: 0.14, time: "day", wind: [1.5, 4.5], pin: [-0.2, 0.2], slope: [230, 0.016], water: [{ t: 0.56, off: 0, rx: 62, rz: 14 }], bunkers: [{ t: 0.82, off: 24, r: 8 }, { ga: 30, gd: 21, r: 6 }] },
  { n: 13, par: 4, name: "좁은 숲 터널", pts: [[0, 0], [6, -130], [-6, -260], [4, -388]], w: 26, r: 15, rise: 4, hills: 3, start: 0.22, time: "golden", wind: [0.5, 2], dense: 1.8, pin: [0.3, 0.3], slope: [10, 0.02], bunkers: [{ t: 0.66, off: 18, r: 7 }, { ga: -30, gd: 20, r: 7 }] },
  { n: 14, par: 4, name: "언덕 너머", pts: [[0, 0], [14, -120], [26, -240], [12, -362]], w: 34, r: 15, rise: 10, hills: 7, start: 0.22, time: "golden", wind: [1.5, 4], pin: [-0.2, -0.2], slope: [150, 0.02], bunkers: [{ t: 0.6, off: -24, r: 9 }, { ga: 60, gd: 20, r: 6 }] },
  { n: 15, par: 4, name: "그린 앞 연못", pts: [[0, 0], [-4, -120], [4, -220], [0, -304]], w: 36, r: 14, rise: 0, hills: 2.5, start: 0.24, time: "golden", wind: [1, 3.5], pin: [0, 0.3], slope: [0, 0.018], water: [{ t: 0.83, off: 0, rx: 42, rz: 15 }], bunkers: [{ ga: 140, gd: 19, r: 5 }, { ga: -140, gd: 19, r: 5 }] },
  { n: 16, par: 5, name: "뱀길", pts: [[0, 0], [28, -130], [-20, -260], [26, -390], [2, -512]], w: 36, r: 17, rise: 8, hills: 5, start: 0.17, time: "golden", wind: [1, 4], pin: [0.2, -0.3], slope: [280, 0.016], bunkers: [{ t: 0.3, off: -22, r: 8 }, { t: 0.52, off: 24, r: 9 }, { t: 0.72, off: -24, r: 8 }, { ga: 0, gd: 24, r: 6 }], water: [{ t: 0.44, off: 52, rx: 22, rz: 34 }] },
  { n: 17, par: 3, name: "물 위의 그린", pts: [[0, 0], [0, -80], [0, -146]], w: 20, r: 14, rise: 0, hills: 1.5, start: 0.9, time: "golden", wind: [2, 5], island: true, pin: [0.2, 0.1], slope: [70, 0.016], water: [{ t: 0.92, off: 0, rx: 44, rz: 40 }] },
  { n: 18, par: 4, name: "마지막 승부", pts: [[0, 0], [2, -140], [20, -280], [14, -402]], w: 32, r: 17, rise: 6, hills: 3.5, start: 0.22, time: "golden", wind: [1.5, 4], pin: [-0.25, 0.25], slope: [210, 0.022], water: [{ t: 0.74, off: 44, rx: 24, rz: 62 }], bunkers: [{ t: 0.66, off: -24, r: 9 }, { ga: -50, gd: 22, r: 7 }, { ga: 50, gd: 22, r: 6 }] },
];

const GRID = 2.5; // 지형 격자 (m)
const MARGIN = 92;
export const OB_DIST = 74; // 중심선에서 이만큼 벗어나면 OB

/* ---------- 나무 모양 (인스턴스 한 번에 그림) ----------
 *  잎은 잎 뭉치 그림 카드를 덩어리 모양으로 많이 겹치고, 노멀은 나무 중심에서 밖으로 향하게 해서
 *  해 쪽은 밝고 반대쪽은 어두운 둥근 나무로 보이게 한다.
 */
let TREE_GEO = null;
/** 양면 카드의 뒷면도 바깥 노멀 그대로 쓰게 */
function outwardNormals(m) {
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", "float faceDirection = 1.0;\nvec3 normal = normalize(vNormal);\nvec3 nonPerturbedNormal = normal;");
  };
  return m;
}
function leafCardTex() {
  const c = canvas(256, 256);
  const g = c.getContext("2d");
  const r = rng(101);
  const cols = ["#3f6f2c", "#4f8234", "#5f943c", "#35602a", "#6ea544", "#2c5226"];
  for (let i = 0; i < 620; i += 1) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 118;
    const x = 128 + Math.cos(a) * d;
    const y = 128 + Math.sin(a) * d;
    g.save();
    g.translate(x, y);
    g.rotate(r() * TAU);
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.beginPath();
    g.ellipse(0, 0, 3 + r() * 4.5, 8 + r() * 7, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  return tex(c, { repeat: false });
}
function pineTex() {
  const c = canvas(256, 256);
  const g = c.getContext("2d");
  const r = rng(103);
  g.fillStyle = "#1d3b27";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i += 1) {
    const x = r() * 256;
    const y = r() * 240;
    const k = 0.7 + r() * 0.8;
    g.strokeStyle = `rgb(${38 * k},${84 * k},${50 * k})`;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 7, y + 11 + r() * 12);
    g.stroke();
  }
  // 아래쪽은 뾰족뾰족 뚫음
  g.globalCompositeOperation = "destination-out";
  g.beginPath();
  g.moveTo(0, 256);
  for (let i = 0; i <= 14; i += 1) {
    const x = (i / 14) * 256;
    g.lineTo(x, 218 + r() * 18);
    g.lineTo(x + 256 / 28, 252);
  }
  g.lineTo(256, 256);
  g.closePath();
  g.fill();
  return tex(c);
}
function canopyGeometry() {
  const r = rng(7);
  const pos = [];
  const nor = [];
  const uvs = [];
  const col = [];
  const idx = [];
  const cy = 7.5;
  // 큰 덩어리 여러 개 → 카드 많이
  const clumps = [];
  for (let i = 0; i < 11; i += 1) {
    const a = r() * TAU;
    const u = i === 0 ? 1 : 1 - 1.5 * r();
    const q = Math.sqrt(Math.max(0, 1 - u * u));
    clumps.push([Math.cos(a) * q * 2.35, u * 2.15, Math.sin(a) * q * 2.35, 1.35 + r() * 0.5]);
  }
  for (const [ox, oy, oz, cr] of clumps) {
    for (let i = 0; i < 9; i += 1) {
      const a = r() * TAU;
      const u = r() * 2 - 1;
      const q = Math.sqrt(1 - u * u);
      const px = ox + Math.cos(a) * q * cr;
      const py = oy + u * cr * 0.85;
      const pz = oz + Math.sin(a) * q * cr;
      const size = 1.05 + r() * 0.65;
      // 바깥쪽을 대충 보는 면
      const n = new THREE.Vector3(px + (r() - 0.5) * 3, py + (r() - 0.5) * 3, pz + (r() - 0.5) * 3).normalize();
      const ux = new THREE.Vector3().crossVectors(n, Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      const uy = new THREE.Vector3().crossVectors(ux, n);
      const base = pos.length / 3;
      for (const [sx, sy, tu, tv] of [
        [-1, -1, 0, 0],
        [1, -1, 1, 0],
        [1, 1, 1, 1],
        [-1, 1, 0, 1],
      ]) {
        const x = px + (ux.x * sx + uy.x * sy) * size;
        const y = py + (ux.y * sx + uy.y * sy) * size;
        const z = pz + (ux.z * sx + uy.z * sy) * size;
        pos.push(x, y + cy, z);
        const m = new THREE.Vector3(x, y * 1.15, z).normalize();
        nor.push(m.x, m.y, m.z);
        uvs.push(tu, tv);
        const k = clamp(0.6 + ((y + 3) / 6.5) * 0.55, 0.55, 1.12);
        col.push(k, k, k);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
function pineGeometry() {
  const list = [];
  for (let i = 0; i < 6; i += 1) {
    const t = i / 5;
    const c = new THREE.ConeGeometry(3.05 * (1 - t * 0.78), 3.1 - t * 0.5, 14, 1, true).toNonIndexed();
    const uv = c.attributes.uv;
    for (let k = 0; k < uv.count; k += 1) uv.setX(k, uv.getX(k) * 3);
    c.translate(0, 3.4 + i * 1.62, 0);
    c.rotateY(i * 1.1);
    const shade = 0.72 + t * 0.42;
    const col = new Float32Array(c.attributes.position.count * 3).fill(shade);
    c.setAttribute("color", new THREE.BufferAttribute(col, 3));
    list.push(c);
  }
  return merge(list);
}
function treeGeometries() {
  if (TREE_GEO) return TREE_GEO;
  const mLeaf = outwardNormals(std({ map: leafCardTex(), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.92, vertexColors: true }));
  const leafMesh = new THREE.Mesh(canopyGeometry(), mLeaf);
  const mCore = std({ color: 0x223a1b, roughness: 1 });
  const coreGeo = new THREE.IcosahedronGeometry(1, 1);
  coreGeo.scale(2.25, 1.95, 2.25);
  coreGeo.translate(0, 7.3, 0);
  const coreMesh = new THREE.Mesh(coreGeo, mCore);
  const mBark = std({ map: barkTex(), roughness: 0.95 });
  const barkGeo = new THREE.CylinderGeometry(0.2, 0.38, 6.6, 9);
  barkGeo.translate(0, 3.3, 0);
  const barkMesh = new THREE.Mesh(barkGeo, mBark);
  const mPine = outwardNormals(std({ map: pineTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, vertexColors: true }));
  const pineMesh = new THREE.Mesh(pineGeometry(), mPine);
  const pineBark = new THREE.CylinderGeometry(0.1, 0.3, 11, 7);
  pineBark.translate(0, 5.5, 0);
  const pineBarkMesh = new THREE.Mesh(pineBark, mBark);
  TREE_GEO = { leafMesh, coreMesh, barkMesh, pineMesh, pineBarkMesh };
  return TREE_GEO;
}

/* 잔디 결 (가까이서 보이는 무늬) */
let DETAIL = null;
function detailTex() {
  if (DETAIL) return DETAIL;
  const c = canvas(256, 256);
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  const r = rng(13);
  for (let i = 0; i < 5200; i += 1) {
    const v = 90 + r() * 90;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 1.2, 2 + r() * 4);
  }
  // 넓게 쓸 때 보이는 부드러운 얼룩
  g.globalAlpha = 0.5;
  for (let i = 0; i < 90; i += 1) {
    const x = r() * 256;
    const y = r() * 256;
    const rad = 14 + r() * 42;
    const v = r() < 0.5 ? 60 : 200;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.55)`);
      gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr;
      g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  g.globalAlpha = 1;
  DETAIL = tex(c);
  return DETAIL;
}

/* ---------- 홀 만들기 ---------- */
export function buildHole(def, quality = "high") {
  const seed = def.n * 137 + 11;
  const r = rng(seed);
  const n1 = noise2(seed);
  const n2 = noise2(seed + 3);

  /* 중심선 (Catmull-Rom) */
  const C = def.pts;
  const S = [];
  for (let i = 0; i < C.length - 1; i += 1) {
    const p0 = C[Math.max(0, i - 1)];
    const p1 = C[i];
    const p2 = C[i + 1];
    const p3 = C[Math.min(C.length - 1, i + 2)];
    const steps = Math.max(4, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 6));
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      const q = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
      S.push({ x: q(p0[0], p1[0], p2[0], p3[0]), z: q(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  S.push({ x: C[C.length - 1][0], z: C[C.length - 1][1] });
  let L = 0;
  S[0].s = 0;
  for (let i = 1; i < S.length; i += 1) {
    L += Math.hypot(S[i].x - S[i - 1].x, S[i].z - S[i - 1].z);
    S[i].s = L;
  }
  const atT = (t) => {
    const want = clamp(t, 0, 1) * L;
    for (let i = 1; i < S.length; i += 1) {
      if (S[i].s >= want) {
        const a = S[i - 1];
        const b = S[i];
        const k = (want - a.s) / (b.s - a.s || 1);
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        return { x: a.x + dx * k, z: a.z + dz * k, dx: dx / len, dz: dz / len };
      }
    }
    return { x: S[S.length - 1].x, z: S[S.length - 1].z, dx: 0, dz: -1 };
  };
  /** 중심선 기준 위치: d(왼쪽이 -) · t(0~1) */
  const locate = (x, z) => {
    let best = Infinity;
    let bt = 0;
    let bs = 1;
    for (let i = 1; i < S.length; i += 1) {
      const a = S[i - 1];
      const b = S[i];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const l2 = ex * ex + ez * ez || 1;
      const u = clamp(((x - a.x) * ex + (z - a.z) * ez) / l2, 0, 1);
      const px = a.x + ex * u - x;
      const pz = a.z + ez * u - z;
      const dd = px * px + pz * pz;
      if (dd < best) {
        best = dd;
        bt = (a.s + (b.s - a.s) * u) / L;
        bs = ex * (z - a.z) - ez * (x - a.x);
      }
    }
    return { d: Math.sqrt(best) * (bs >= 0 ? -1 : 1), abs: Math.sqrt(best), t: bt };
  };
  const end = atT(1);
  const GC = { x: end.x, z: end.z };
  const approach = Math.atan2(end.dx, end.dz);
  const fromGreen = (gaDeg, gd) => {
    const a = approach + Math.PI + (gaDeg * Math.PI) / 180; // 0 도 = 그린 앞쪽(티 방향)
    return { x: GC.x + Math.sin(a) * gd, z: GC.z + Math.cos(a) * gd };
  };

  /* 폭 · 그린 · 벙커 · 물 모양 */
  const fairHalf = (t) => {
    const f0 = def.start || 0.2;
    if (t < f0 || t > 0.985) return 0;
    const edge = Math.min(1, (t - f0) / 0.035, (0.985 - t) / 0.05);
    return (def.w / 2) * Math.min(1, edge) * (1 + 0.14 * Math.sin(t * 13 + seed) + 0.08 * Math.sin(t * 31 + seed * 2));
  };
  const blobR = (a, ph) => 1 + 0.15 * Math.sin(2 * a + ph) + 0.09 * Math.sin(3 * a + ph * 2.1) + 0.05 * Math.sin(5 * a + ph * 0.7);
  const greenPh = seed * 0.37;
  const greenK = (x, z) => {
    const dx = x - GC.x;
    const dz = z - GC.z;
    return Math.hypot(dx, dz) / (def.r * blobR(Math.atan2(dx, dz), greenPh));
  };
  const bunkers = (def.bunkers || []).map((b, i) => {
    let c;
    if (b.ga != null) c = fromGreen(b.ga, b.gd);
    else {
      const q = atT(b.t);
      c = { x: q.x - q.dz * b.off, z: q.z + q.dx * b.off };
    }
    return { x: c.x, z: c.z, r: b.r, ph: i * 2.3 + seed * 0.1 };
  });
  const bunkerK = (b, x, z) => {
    const dx = x - b.x;
    const dz = z - b.z;
    return Math.hypot(dx, dz) / (b.r * blobR(Math.atan2(dx, dz), b.ph));
  };
  const waters = (def.water || []).map((w, i) => {
    let c;
    if (w.ga != null) c = fromGreen(w.ga, w.gd);
    else {
      const q = atT(w.t);
      c = { x: q.x - q.dz * w.off, z: q.z + q.dx * w.off };
    }
    return { x: c.x, z: c.z, rx: w.rx, rz: w.rz, ph: i * 1.7 + seed * 0.2, level: 0 };
  });
  const waterK = (w, x, z) => {
    const dx = (x - w.x) / w.rx;
    const dz = (z - w.z) / w.rz;
    return Math.hypot(dx, dz) / blobR(Math.atan2(dx, dz), w.ph);
  };

  /* 티 · 핀 */
  const start = atT(0);
  const tee = new THREE.Vector3(start.x, 0, start.z);
  const pinX = GC.x + (def.pin ? def.pin[0] : 0) * def.r;
  const pinZ = GC.z + (def.pin ? def.pin[1] : 0) * def.r;

  /* 높이 */
  const smooth = (a, b, x) => {
    const u = clamp((x - a) / (b - a), 0, 1);
    return u * u * (3 - 2 * u);
  };
  const slopeA = ((def.slope ? def.slope[0] : 0) * Math.PI) / 180;
  const slopeAmt = def.slope ? def.slope[1] : 0.012;
  const trend = (t) => (def.rise || 0) * (t * t * (3 - 2 * t));
  const rawH = (x, z, loc) => {
    const edge = smooth(30, 82, loc.abs);
    let h = trend(loc.t);
    h += (fbm(n1, x * 0.011 + 3, z * 0.011 + 7, 3) - 0.5) * def.hills * 2.2;
    h += (fbm(n2, x * 0.04, z * 0.04, 2) - 0.5) * 1.2;
    // 페어웨이 밖은 둔덕 · 먼 곳은 언덕
    h += edge * (fbm(n2, x * 0.016 + 11, z * 0.016 + 3, 3) * 15 + 2);
    return h;
  };
  const greenBase = rawH(GC.x, GC.z, { abs: 0, t: 1 }) + 0.7;
  const teeBase = rawH(tee.x, tee.z, { abs: 0, t: 0 }) + 0.7;
  for (const w of waters) {
    w.base = rawH(w.x, w.z, { abs: 0, t: locate(w.x, w.z).t });
    if (def.island) w.base = Math.min(w.base, greenBase - 0.5);
    w.level = w.base - 1.3;
  }
  const heightAt = (x, z) => {
    const loc = locate(x, z);
    let h = rawH(x, z, loc);
    // 티 평지
    const td = Math.hypot(x - tee.x, z - tee.z);
    h = lerp(teeBase, h, smooth(7, 24, td));
    // 그린: 살짝 높고 기운 판 + 잔잔한 굴곡
    const gk = greenK(x, z);
    const gdx = x - GC.x;
    const gdz = z - GC.z;
    const plane = greenBase + (gdx * Math.sin(slopeA) + gdz * Math.cos(slopeA)) * slopeAmt + (fbm(n2, x * 0.09 + 4, z * 0.09 + 2, 2) - 0.5) * 0.42;
    h = lerp(plane, h, smooth(1.05, 2.1, gk));
    // 벙커: 움푹
    for (const b of bunkers) {
      const k = bunkerK(b, x, z);
      if (k < 1.5) h -= (1 - smooth(0.55, 1.45, k)) * 0.72;
    }
    // 호수: 움푹 파고 · 둘레 둑은 수면보다 높게 (물이 넘치지 않음)
    for (const w of waters) {
      const k = waterK(w, x, z);
      if (k >= 2.2) continue;
      const bank = lerp(Math.max(h, w.base + 0.35), h, smooth(1.5, 2.2, k));
      const carved = lerp(w.base - 2.8, bank, smooth(0.72, 1.45, k));
      h = def.island ? lerp(h, carved, smooth(1.22, 1.7, gk)) : carved;
    }
    return h;
  };

  /* 격자에 굽기 */
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of S) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minZ = Math.min(minZ, s.z);
    maxZ = Math.max(maxZ, s.z);
  }
  minX -= MARGIN;
  maxX += MARGIN;
  minZ -= MARGIN;
  maxZ += MARGIN;
  const nx = Math.ceil((maxX - minX) / GRID) + 1;
  const nz = Math.ceil((maxZ - minZ) / GRID) + 1;
  const hgrid = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) hgrid[j * nx + i] = heightAt(minX + i * GRID, minZ + j * GRID);
  }
  const height = (x, z) => {
    const fx = clamp((x - minX) / GRID, 0, nx - 1.001);
    const fz = clamp((z - minZ) / GRID, 0, nz - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = hgrid[j * nx + i];
    const b = hgrid[j * nx + i + 1];
    const c2 = hgrid[(j + 1) * nx + i];
    const d = hgrid[(j + 1) * nx + i + 1];
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
  };
  /** 기울기 (dh/dx, dh/dz) */
  const grad = (x, z) => {
    const e = 0.6;
    return { x: (height(x + e, z) - height(x - e, z)) / (2 * e), z: (height(x, z + e) - height(x, z - e)) / (2 * e) };
  };
  tee.y = height(tee.x, tee.z);
  const pin = new THREE.Vector3(pinX, height(pinX, pinZ), pinZ);

  /* 땅 종류 */
  const surface = (x, z) => {
    const y = height(x, z);
    for (const w of waters) if (waterK(w, x, z) < 1.2 && y < w.level) return "water";
    const gk = greenK(x, z);
    if (gk < 1) return "green";
    for (const b of bunkers) if (bunkerK(b, x, z) < 1) return "sand";
    if (gk < 1.2) return "fringe";
    if (Math.hypot(x - tee.x, z - tee.z) < 6.5) return "tee";
    const loc = locate(x, z);
    if (loc.abs > OB_DIST) return "ob";
    const hw = fairHalf(loc.t);
    if (loc.abs < hw) return "fairway";
    if (loc.abs < hw + 3.5 && hw > 0) return "first";
    return loc.abs < 46 ? "rough" : "deep";
  };

  /* 나무 자리 */
  const trees = [];
  const free = (x, z, room) => {
    if (greenK(x, z) < 1.7) return false;
    if (Math.hypot(x - tee.x, z - tee.z) < 22) return false;
    for (const b of bunkers) if (bunkerK(b, x, z) < 1.6) return false;
    for (const w of waters) if (waterK(w, x, z) < 1.35) return false;
    for (const q of trees) if (Math.hypot(q.x - x, q.z - z) < room) return false;
    return true;
  };
  const dense = def.dense || 1;
  const count = Math.round((L / 500) * 90 * dense);
  for (let i = 0; i < count; i += 1) {
    const t = 0.02 + r() * 0.96;
    const q = atT(t);
    const hw = Math.max(fairHalf(t), def.w * 0.32);
    const side = r() < 0.5 ? -1 : 1;
    const off = hw + 15 + r() * r() * (48 / dense + 6);
    const x = q.x - q.dz * off * side + (r() - 0.5) * 6;
    const z = q.z + q.dx * off * side + (r() - 0.5) * 6;
    if (!free(x, z, 7)) continue;
    const s = range(r, 0.85, 1.45);
    trees.push({ x, z, s, y: height(x, z), pine: r() < 0.32, r: 2.6 * s, h: 11.4 * s, hit: true, tint: range(r, 0.82, 1.14) });
  }
  // 코스 바깥 숲 (경계를 가림 · 공과는 안 부딪힘)
  const outer = quality === "low" ? 60 : 130;
  for (let i = 0; i < outer; i += 1) {
    const t = r();
    const q = atT(t);
    const side = r() < 0.5 ? -1 : 1;
    const off = OB_DIST + 2 + r() * 34;
    const x = q.x - q.dz * off * side;
    const z = q.z + q.dx * off * side;
    const s = range(r, 1.05, 1.8);
    trees.push({ x, z, s, y: height(x, z), pine: r() < 0.45, r: 2.6 * s, h: 11 * s, hit: false, tint: range(r, 0.72, 1.05) });
  }
  // 그린 · 티 뒤쪽 숲
  for (let i = 0; i < 26; i += 1) {
    const a = approach + (r() - 0.5) * 2.6;
    const d = def.r + 34 + r() * 40;
    const x = GC.x + Math.sin(a) * d;
    const z = GC.z + Math.cos(a) * d;
    const s = range(r, 1.05, 1.7);
    trees.push({ x, z, s, y: height(x, z), pine: r() < 0.4, r: 2.6 * s, h: 11 * s, hit: false, tint: range(r, 0.78, 1.08) });
  }

  /* 땅 그림 */
  const Bw = maxX - minX;
  const Bh = maxZ - minZ;
  const maxPx = quality === "high" ? 2048 : quality === "mid" ? 1536 : 1024;
  const scale = Math.min(maxPx / Math.max(Bw, Bh), 5);
  const c = canvas(Math.round(Bw * scale), Math.round(Bh * scale));
  const g = c.getContext("2d");
  const toX = (x) => (x - minX) * scale;
  const toY = (z) => (z - minZ) * scale;
  paintGround(g, c, { scale, toX, toY, S, L, fairHalf, atT, def, bunkers, bunkerK, waters, trees, tee, GC, greenPh, blobR, seed, approach, r, Bw, Bh });

  /* 메쉬 */
  const root = new THREE.Group();
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(nx * nz * 3);
  const uvs = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const k = j * nx + i;
      pos.set([minX + i * GRID, hgrid[k], minZ + j * GRID], k * 3);
      uvs.set([i / (nx - 1), 1 - j / (nz - 1)], k * 2);
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let q = 0;
  for (let j = 0; j < nz - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const a = j * nx + i;
      const b = a + 1;
      const c2 = a + nx;
      const d = c2 + 1;
      idx[q++] = a;
      idx[q++] = c2;
      idx[q++] = b;
      idx[q++] = b;
      idx[q++] = c2;
      idx[q++] = d;
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const groundTex = tex(c, { repeat: false });
  const mat = std({ map: groundTex, roughness: 0.96 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.detailMap = { value: detailTex() };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWPos;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D detailMap;\nvarying vec3 vWPos;")
      .replace("#include <map_fragment>", "#include <map_fragment>\nfloat dA = texture2D(detailMap, vWPos.xz * 0.42).r;\nfloat dB = texture2D(detailMap, vWPos.xz * 0.09).r;\nfloat dC = texture2D(detailMap, vWPos.xz * 0.013 + 0.3).r;\nfloat dD = texture2D(detailMap, vWPos.zx * 0.0041).r;\ndiffuseColor.rgb *= (0.66 + 0.42 * dA + 0.26 * dB) * (0.62 + 0.76 * dC) * (0.8 + 0.4 * dD);\ndiffuseColor.r *= 0.94 + 0.2 * dD;");
  };
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  root.add(ground);

  // 코스 바깥 큰 땅 (안개로 사라짐)
  const farMat = std({ color: 0x3f6330, roughness: 1 });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), farMat);
  far.rotation.x = -Math.PI / 2;
  let lowest = Infinity;
  for (let i = 0; i < hgrid.length; i += 1) lowest = Math.min(lowest, hgrid[i]);
  far.position.set((minX + maxX) / 2, lowest - 5, (minZ + maxZ) / 2);
  root.add(far);

  // 먼 산 (코스 끝이 안 보이게 겹겹이 두름)
  const ringCx = (minX + maxX) / 2;
  const ringCz = (minZ + maxZ) / 2;
  const baseY = lowest;
  const ringR = Math.hypot(Bw, Bh) / 2;
  [[ringR + 170, 34, 0x35592c, 0.5], [ringR + 420, 76, 0x3d6240, 1.3], [ringR + 820, 140, 0x4a6c56, 2.4]].forEach(([R, H, color, ph]) => {
    const seg = 90;
    const rp = [];
    const ri = [];
    const rc = [];
    const c0 = new THREE.Color(color);
    for (let i = 0; i <= seg; i += 1) {
      const a = (i / seg) * TAU;
      const top = H * (0.32 + 0.68 * fbm(n1, Math.cos(a) * 3.2 + ph + 30, Math.sin(a) * 3.2 + ph + 30, 3));
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      rp.push(ringCx + cx * (R - 120), baseY - 12, ringCz + cz * (R - 120));
      rp.push(ringCx + cx * R, baseY + top, ringCz + cz * R);
      rc.push(c0.r * 0.75, c0.g * 0.75, c0.b * 0.75, c0.r, c0.g, c0.b);
      if (i < seg) {
        const k = i * 2;
        ri.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3));
    rg.setAttribute("color", new THREE.Float32BufferAttribute(rc, 3));
    rg.setIndex(ri);
    rg.computeVertexNormals();
    root.add(new THREE.Mesh(rg, std({ vertexColors: true, roughness: 1, side: THREE.DoubleSide })));
  });

  // 물
  const WT = waterPBR();
  for (const w of waters) {
    const wg = new THREE.CircleGeometry(1, 56);
    const wp = wg.attributes.position;
    const wu = wg.attributes.uv;
    const sx = w.rx * 1.9;
    const sz = w.rz * 1.9;
    for (let i = 0; i < wp.count; i += 1) {
      wu.setXY(i, (wp.getX(i) * sx) / 26, (wp.getY(i) * sz) / 26);
      wp.setXY(i, wp.getX(i) * sx, wp.getY(i) * sz);
    }
    const wm = new THREE.Mesh(wg, std({ color: 0x2f7391, normalMap: WT.normal, normalScale: new THREE.Vector2(0.18, 0.18), roughness: 0.07, metalness: 0, transparent: true, opacity: 0.86 }));
    wm.material.userData.envK = 2.4;
    wm.rotation.x = -Math.PI / 2;
    wm.position.set(w.x, w.level, w.z);
    wm.receiveShadow = true;
    root.add(wm);
  }

  // 나무 (인스턴스)
  const T = treeGeometries();
  const broad = trees.filter((t) => !t.pine);
  const pines = trees.filter((t) => t.pine);
  const inst = (mesh, list, tint, yScale = 1) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
    const col = new THREE.Color();
    list.forEach((t, i) => {
      im.setMatrixAt(i, mat4(t.x, t.y - 0.1, t.z, 0, (t.x * 7 + t.z) % 6, 0, t.s, t.s * yScale, t.s));
      if (tint) im.setColorAt(i, col.setRGB(t.tint, t.tint, t.tint * 0.96));
    });
    im.castShadow = true;
    im.frustumCulled = false;
    root.add(im);
    return im;
  };
  inst(T.leafMesh, broad, true);
  inst(T.coreMesh, broad, false);
  inst(T.barkMesh, broad, false);
  inst(T.pineMesh, pines, true);
  inst(T.pineBarkMesh, pines, false);

  // 깃대 · 깃발 · 컵
  const pinG = new THREE.Group();
  pinG.position.copy(pin);
  const cup = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshBasicMaterial({ color: 0x07090a }));
  cup.rotation.x = -Math.PI / 2;
  cup.position.y = 0.035;
  const cupRim = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.2, 24), std({ color: 0xf2f2ea, roughness: 0.5 }));
  cupRim.rotation.x = -Math.PI / 2;
  cupRim.position.y = 0.04;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), std({ color: 0xf5f3ea, roughness: 0.4 }));
  pole.position.y = 1.3;
  pole.castShadow = true;
  const flagGeo = new THREE.PlaneGeometry(0.72, 0.44, 10, 3);
  flagGeo.translate(0.36, 0, 0);
  const flag = new THREE.Mesh(flagGeo, std({ color: 0xe5352e, roughness: 0.7, side: THREE.DoubleSide }));
  flag.position.y = 2.36;
  flag.castShadow = true;
  pinG.add(cup, cupRim, pole, flag);
  root.add(pinG);

  // 티 마커
  const marks = new Batch();
  const mPaint = std({ roughness: 0.4, metalness: 0.2 });
  const tp = atT(0.012);
  for (const k of [-1, 1]) marks.add(mPaint, new THREE.CylinderGeometry(0.05, 0.075, 0.26, 10), mat4(tee.x - tp.dz * k * 3.2 + tp.dx * 1.4, tee.y + 0.13, tee.z + tp.dx * k * 3.2 + tp.dz * 1.4), def.par === 3 ? 0xf2c230 : 0xd83a32);
  marks.build(root, {});

  const tickWater = (time) => {
    if (WT.normal) {
      WT.normal.offset.x = time * 0.012;
      WT.normal.offset.y = time * 0.008;
    }
  };
  const waveFlag = (time, wind) => {
    const p = flagGeo.attributes.position;
    const flow = 0.6 + wind * 0.28;
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i);
      p.setZ(i, Math.sin(x * 5.5 - time * (4 + wind)) * 0.09 * (x + 0.1) * flow);
    }
    p.needsUpdate = true;
  };

  return {
    def,
    root,
    length: L,
    tee,
    pin,
    trees,
    bunkers,
    waters,
    height,
    grad,
    surface,
    locate,
    atT,
    greenK,
    flag,
    pinGroup: pinG,
    waveFlag,
    tickWater,
    mapCanvas: c,
    bbox: { minX, maxX, minZ, maxZ, Bw, Bh },
    greenCenter: new THREE.Vector3(GC.x, height(GC.x, GC.z), GC.z),
    dispose() {
      root.traverse((o) => {
        if (o.geometry && !o.isInstancedMesh) o.geometry.dispose();
        if (o.material && !o.isInstancedMesh) o.material.dispose();
      });
      groundTex.dispose();
    },
  };
}

/* ---------- 땅 그림 ---------- */
function paintGround(g, c, o) {
  const { scale, toX, toY, S, L, fairHalf, atT, def, bunkers, waters, trees, tee, GC, greenPh, blobR, seed, approach, r } = o;
  const W = c.width;
  const H = c.height;
  // 깊은 러프
  g.fillStyle = "#2c5324";
  g.fillRect(0, 0, W, H);
  blotch(g, W, H, r, 12, 0.32);
  blotch(g, W, H, r, 46, 0.24);
  // 코스 쪽으로 갈수록 밝은 러프 (부드러운 경계)
  const line = () => {
    g.beginPath();
    S.forEach((s, i) => (i ? g.lineTo(toX(s.x), toY(s.z)) : g.moveTo(toX(s.x), toY(s.z))));
  };
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let i = 0; i < 7; i += 1) {
    g.strokeStyle = `rgba(66,112,44,${0.13 + i * 0.02})`;
    g.lineWidth = (92 - i * 8) * scale;
    line();
    g.stroke();
  }
  blotch(g, W, H, r, 80, 0.12);
  // 얼룩 러프 잎 무늬
  for (let i = 0; i < W * H * 0.0012; i += 1) {
    g.fillStyle = r() < 0.5 ? "rgba(30,60,22,0.25)" : "rgba(130,170,80,0.16)";
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 2 + r() * 4);
  }
  // 티에서 페어웨이까지 낮게 깎은 길
  const f0 = def.start || 0.2;
  g.strokeStyle = "#3f7230";
  g.lineWidth = def.w * 0.62 * scale;
  g.beginPath();
  for (let i = 0; i <= 24; i += 1) {
    const q = atT((i / 24) * (f0 + 0.03));
    if (i) g.lineTo(toX(q.x), toY(q.z));
    else g.moveTo(toX(q.x), toY(q.z));
  }
  g.stroke();
  // 페어웨이 윤곽
  const polyOf = (extra) => {
    const left = [];
    const right = [];
    for (let i = 0; i <= 160; i += 1) {
      const t = i / 160;
      const hw = fairHalf(t);
      if (hw <= 0) continue;
      const q = atT(t);
      left.push([q.x - q.dz * (hw + extra), q.z + q.dx * (hw + extra)]);
      right.push([q.x + q.dz * (hw + extra), q.z - q.dx * (hw + extra)]);
    }
    return left.concat(right.reverse());
  };
  const fillPoly = (pts) => {
    if (!pts.length) return false;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(toX(p[0]), toY(p[1])) : g.moveTo(toX(p[0]), toY(p[1]))));
    g.closePath();
    return true;
  };
  if (fillPoly(polyOf(3.5))) {
    g.fillStyle = "#4d8537";
    g.fill();
  }
  if (fillPoly(polyOf(0))) {
    g.save();
    g.clip();
    g.fillStyle = "#5a9740";
    g.fillRect(0, 0, W, H);
    // 깎은 자국 (바둑판)
    const ang = Math.atan2(GC.x - tee.x, -(GC.z - tee.z));
    g.translate(toX(GC.x), toY(GC.z));
    g.rotate(ang);
    const st = 7 * scale;
    for (let i = -80; i < 80; i += 1) {
      for (let j = -120; j < 120; j += 1) {
        if ((i + j) % 2 === 0) continue;
        g.fillStyle = "rgba(255,255,255,0.055)";
        g.fillRect(i * st, j * st, st, st);
      }
    }
    g.restore();
  }
  // 카트 길
  const side = seed % 2 ? 1 : -1;
  g.strokeStyle = "rgba(196,180,146,0.9)";
  g.lineWidth = 2.1 * scale;
  g.beginPath();
  for (let i = 0; i <= 80; i += 1) {
    const t = 0.02 + (i / 80) * 0.94;
    const q = atT(t);
    const off = Math.max(fairHalf(t), def.w * 0.4) + 9 + Math.sin(t * 11) * 2;
    const x = q.x - q.dz * off * side;
    const z = q.z + q.dx * off * side;
    if (i) g.lineTo(toX(x), toY(z));
    else g.moveTo(toX(x), toY(z));
  }
  g.stroke();
  // 호수 (페어웨이 위 · 그린 아래)
  const lakePath = (w, k) => {
    g.beginPath();
    for (let i = 0; i <= 72; i += 1) {
      const a = (i / 72) * Math.PI * 2;
      const d = blobR(a, w.ph) * k;
      const x = w.x + Math.sin(a) * d * w.rx;
      const z = w.z + Math.cos(a) * d * w.rz;
      if (i) g.lineTo(toX(x), toY(z));
      else g.moveTo(toX(x), toY(z));
    }
    g.closePath();
  };
  for (const w of waters) {
    lakePath(w, 1.3);
    g.fillStyle = "#4d6b35";
    g.fill();
    lakePath(w, 1.14);
    g.fillStyle = "#8c8a5c";
    g.fill();
    lakePath(w, 1.04);
    g.fillStyle = "#2c6480";
    g.fill();
  }
  // 티
  const tp = atT(0.012);
  g.save();
  g.translate(toX(tee.x), toY(tee.z));
  g.rotate(Math.atan2(tp.dx, -tp.dz));
  g.fillStyle = "#619f46";
  g.fillRect(-5.5 * scale, -9 * scale, 11 * scale, 18 * scale);
  g.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 6; i += 2) g.fillRect(-5.5 * scale, (-9 + i * 3) * scale, 11 * scale, 3 * scale);
  g.restore();
  // 그린 (둘레 · 판)
  const blobPath = (cx, cz, R, ph, k = 1) => {
    g.beginPath();
    for (let i = 0; i <= 64; i += 1) {
      const a = (i / 64) * Math.PI * 2;
      const d = R * blobR(a, ph) * k;
      const x = cx + Math.sin(a) * d;
      const z = cz + Math.cos(a) * d;
      if (i) g.lineTo(toX(x), toY(z));
      else g.moveTo(toX(x), toY(z));
    }
    g.closePath();
  };
  blobPath(GC.x, GC.z, def.r, greenPh, 1.2);
  g.fillStyle = "#55923d";
  g.fill();
  blobPath(GC.x, GC.z, def.r, greenPh);
  g.save();
  g.clip();
  g.fillStyle = "#7dbf5c";
  g.fillRect(0, 0, W, H);
  g.translate(toX(GC.x), toY(GC.z));
  g.rotate(approach + 0.6);
  const st = 1.7 * scale;
  for (let i = -30; i < 30; i += 1) {
    if (i % 2 === 0) continue;
    g.fillStyle = "rgba(255,255,255,0.075)";
    g.fillRect(i * st, -60 * scale, st, 120 * scale);
  }
  g.restore();
  // 벙커
  for (const b of bunkers) {
    blobPath(b.x, b.z, b.r, b.ph, 1.16);
    g.fillStyle = "rgba(40,60,28,0.75)";
    g.fill();
    blobPath(b.x, b.z, b.r, b.ph);
    g.fillStyle = "#e9dcae";
    g.fill();
    blobPath(b.x, b.z, b.r, b.ph, 0.84);
    g.fillStyle = "#f4ebc8";
    g.fill();
    g.save();
    blobPath(b.x, b.z, b.r, b.ph, 0.96);
    g.clip();
    g.strokeStyle = "rgba(170,150,105,0.32)";
    g.lineWidth = 0.14 * scale;
    for (let k = 1; k < 8; k += 1) {
      g.beginPath();
      g.arc(toX(b.x), toY(b.z), (k / 8) * b.r * scale * 1.1, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }
  // 나무 그늘
  for (const t of trees) {
    const x = toX(t.x);
    const y = toY(t.z);
    const rad = t.r * scale * 1.45;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(10,28,10,0.5)");
    gr.addColorStop(1, "rgba(10,28,10,0)");
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  void L;
}
function blotch(g, W, H, r, cells, alpha) {
  const cw = Math.max(2, cells);
  const ch = Math.max(2, Math.round((cells * H) / W));
  const sc = canvas(cw, ch);
  const sg = sc.getContext("2d");
  const im = sg.createImageData(cw, ch);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = r() * 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 255;
  }
  sg.putImageData(im, 0, 0);
  g.save();
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = true;
  g.drawImage(sc, 0, 0, W, H);
  g.restore();
}
