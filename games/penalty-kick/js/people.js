/*
 * 선수: 실제 체형 단면으로 빚은 3D 모델 (앞이 +z · 왼쪽이 +x)
 *  관절로 움직이는 구조는 그대로: 엉덩이가 기준점이고 다리 · 팔 · 몸통을 각도로 움직인다.
 *  x 회전: 다리 · 팔은 음수면 앞으로, 무릎은 양수면 굽음, 몸통은 양수면 앞으로 숙임
 *  얼굴은 예전 그림(assets/face.webp), 유니폼 무늬는 캔버스로 그린다.
 */
import { THREE, std, canvas, tex, merge, rng } from "../../oneshot-elite/js/kit.js";

const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const v1 = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

/* ---------- 도형 빚기 ---------- */
const spow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
const cat = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);

/**
 * 단면을 이어 매끈한 몸통 · 팔다리를 만든다.
 * sec: [{ y, rx, rz, x, z, p }] 위아래 순서. p 가 크면 네모에 가깝다.
 * uvFn(x, y, z, a, t): 없으면 u = 둘레(0 왼쪽 → 0.25 뒤 → 0.5 오른쪽 → 0.75 앞), v = 길이 0~1
 */
function loft(sec, { radial = 18, sub = 4, cap = 0, uvFn, axis = "y" } = {}) {
  const pts = [];
  const key = (o, k, d) => (o[k] === undefined ? d : o[k]);
  const n = sec.length;
  for (let i = 0; i < n - 1; i += 1) {
    const A = sec[Math.max(0, i - 1)];
    const B = sec[i];
    const C = sec[i + 1];
    const D = sec[Math.min(n - 1, i + 2)];
    for (let k = 0; k < sub; k += 1) {
      const t = k / sub;
      const m = (nm, d = 0) => cat(key(A, nm, d), key(B, nm, d), key(C, nm, d), key(D, nm, d), t);
      pts.push({ y: m("y"), rx: Math.max(0.001, m("rx")), rz: Math.max(0.001, m("rz")), x: m("x"), z: m("z"), p: m("p", 2) });
    }
  }
  const last = sec[n - 1];
  pts.push({ y: last.y, rx: last.rx, rz: last.rz, x: last.x || 0, z: last.z || 0, p: last.p || 2 });
  const rings = pts.length;
  const pos = [];
  const uv = [];
  const y0 = pts[0].y;
  const y1 = pts[rings - 1].y;
  for (let i = 0; i < rings; i += 1) {
    const r = pts[i];
    const e = 2 / r.p;
    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2;
      const px = r.x + r.rx * spow(Math.cos(a), e);
      const pz = r.z + r.rz * spow(Math.sin(a), e);
      if (axis === "z") pos.push(px, pz, r.y);
      else pos.push(px, r.y, pz);
      const t = (r.y - y0) / (y1 - y0 || 1);
      const around = 1 - j / radial;
      if (uvFn) {
        const q = uvFn(px, r.y, pz, around, t);
        uv.push(q[0], q[1]);
      } else uv.push(around, t);
    }
  }
  const idx = [];
  const up = axis === "z" ? y1 < y0 : y1 > y0;
  const w = radial + 1;
  for (let i = 0; i < rings - 1; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * w + j;
      const b = (i + 1) * w + j;
      const c = i * w + j + 1;
      const d = (i + 1) * w + j + 1;
      if (up) idx.push(a, b, c, c, b, d);
      else idx.push(a, c, b, c, d, b);
    }
  }
  // 끝 막기
  const addCap = (ring, flip) => {
    const c = pos.length / 3;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let j = 0; j < radial; j += 1) {
      cx += pos[(ring * w + j) * 3];
      cy += pos[(ring * w + j) * 3 + 1];
      cz += pos[(ring * w + j) * 3 + 2];
    }
    pos.push(cx / radial, cy / radial, cz / radial);
    uv.push(uv[(ring * w) * 2], uv[(ring * w) * 2 + 1]);
    for (let j = 0; j < radial; j += 1) {
      const a = ring * w + j;
      const b = ring * w + j + 1;
      if (flip) idx.push(c, b, a);
      else idx.push(c, a, b);
    }
  };
  if (cap & 1) addCap(0, up);
  if (cap & 2) addCap(rings - 1, !up);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 이음매 법선을 맞춘다
  const nor = g.attributes.normal;
  for (let i = 0; i < rings; i += 1) {
    const a = i * w;
    const b = a + radial;
    const nx = nor.getX(a) + nor.getX(b);
    const ny = nor.getY(a) + nor.getY(b);
    const nz = nor.getZ(a) + nor.getZ(b);
    const L = Math.hypot(nx, ny, nz) || 1;
    nor.setXYZ(a, nx / L, ny / L, nz / L);
    nor.setXYZ(b, nx / L, ny / L, nz / L);
  }
  return g.toNonIndexed();
}
function ball(rx, ry, rz, x = 0, y = 0, z = 0, seg = 12) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 3));
  g.scale(rx, ry, rz);
  g.translate(x, y, z);
  return g.toNonIndexed();
}
function tube(r0, r1, h, x = 0, y = 0, z = 0, seg = 10) {
  const g = new THREE.CylinderGeometry(r0, r1, h, seg);
  g.translate(x, y - h / 2, z);
  return g.toNonIndexed();
}
function plainUv(g, u = 0.5, v = 0.5) {
  const a = g.attributes.uv;
  for (let i = 0; i < a.count; i += 1) a.setXY(i, u, v);
  return g;
}

/* ---------- 유니폼 무늬 ---------- */
const css = (hex) => `#${new THREE.Color(hex).getHexString()}`;
function folds(g, W, H, seed, n = 26, a = 0.075, x0 = 0, x1 = W) {
  const r = rng(seed);
  g.lineCap = "round";
  for (let i = 0; i < n; i += 1) {
    const x = x0 + r() * (x1 - x0);
    const y = r() * H;
    const dark = r() < 0.62;
    g.strokeStyle = dark ? `rgba(20,24,40,${a * (0.4 + r())})` : `rgba(255,255,255,${a * (0.3 + r() * 0.8)})`;
    g.lineWidth = 3 + r() * 11;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (r() - 0.5) * 60, y + 16 + r() * 44, x + (r() - 0.5) * 90, y + 40 + r() * 80);
    g.stroke();
  }
}
/** 둘레 그림자: 옆구리가 어두워야 입체로 보인다 */
function sideShade(g, W, H, amount = 0.16) {
  const grad = g.createLinearGradient(0, 0, W, 0);
  for (const [t, k] of [[0, 1], [0.12, 0.25], [0.25, 0], [0.38, 0.25], [0.5, 1], [0.62, 0.25], [0.75, 0], [0.88, 0.25], [1, 1]]) grad.addColorStop(t, `rgba(10,14,30,${amount * k})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}
function paintShirt(g, W, H, kit, number) {
  const sh = css(kit.shirt);
  const tr = css(kit.trim);
  g.fillStyle = sh;
  g.fillRect(0, 0, W, H);
  // 어깨 쪽 절개선 · 옆줄 (예전 그림의 빨간 옆줄)
  folds(g, W, H, 11, 44, 0.07);
  // 옆구리 띠
  for (const cx of [0, W / 2, W]) {
    g.fillStyle = tr;
    g.fillRect(cx - 7, H * 0.26, 14, H * 0.64);
  }
  // 어깨 절개선
  g.strokeStyle = `rgba(15,20,40,.22)`;
  g.lineWidth = 3;
  for (const cx of [W * 0.25, W * 0.75]) {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 40, 0);
      g.quadraticCurveTo(cx + s * 110, H * 0.1, cx + s * 150, H * 0.26);
      g.stroke();
    }
  }
  // 깃: 앞은 V자, 뒤는 둥글게
  const fx = W * 0.75;
  g.fillStyle = tr;
  g.beginPath();
  g.moveTo(fx - 62, 0);
  g.lineTo(fx, H * 0.1);
  g.lineTo(fx + 62, 0);
  g.lineTo(fx + 40, 0);
  g.lineTo(fx, H * 0.065);
  g.lineTo(fx - 40, 0);
  g.closePath();
  g.fill();
  g.fillRect(W * 0.25 - 70, 0, 140, H * 0.022);
  // 등번호
  const bx = W * 0.25;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 ${Math.round(H * 0.4)}px Impact, "Arial Black", sans-serif`;
  g.lineJoin = "round";
  g.lineWidth = 7;
  g.strokeStyle = "rgba(255,255,255,.28)";
  g.strokeText(String(number), bx, H * 0.42);
  g.fillStyle = kit.number;
  g.fillText(String(number), bx, H * 0.42);
  // 앞: 가슴 번호 + 엠블럼
  g.font = `900 ${Math.round(H * 0.1)}px Impact, "Arial Black", sans-serif`;
  g.fillStyle = kit.number;
  g.fillText(String(number), fx + 64, H * 0.24);
  g.beginPath();
  g.arc(fx - 64, H * 0.235, H * 0.042, 0, 6.3);
  g.fillStyle = tr;
  g.fill();
  g.beginPath();
  g.arc(fx - 64, H * 0.235, H * 0.024, 0, 6.3);
  g.fillStyle = sh;
  g.fill();
  sideShade(g, W, H, 0.2);
  // 아래쪽은 살짝 어둡게 (바지 그림자)
  const bot = g.createLinearGradient(0, H * 0.82, 0, H);
  bot.addColorStop(0, "rgba(10,14,30,0)");
  bot.addColorStop(1, "rgba(10,14,30,.26)");
  g.fillStyle = bot;
  g.fillRect(0, H * 0.82, W, H * 0.18);
}
function paintSleeve(g, W, H, kit) {
  g.fillStyle = css(kit.shirt);
  g.fillRect(0, 0, W, H);
  folds(g, W, H, 23, 12, 0.08);
  g.fillStyle = css(kit.trim);
  g.fillRect(0, H * 0.9, W, H * 0.1);
  sideShade(g, W, H, 0.14);
}
function paintShorts(g, W, H, kit) {
  g.fillStyle = css(kit.shorts);
  g.fillRect(0, 0, W, H);
  folds(g, W, H, 37, 22, 0.1);
  const tr = css(kit.trim);
  for (const cx of [0, W / 2, W]) {
    g.fillStyle = tr;
    g.fillRect(cx - 5, 0, 10, H);
  }
  g.fillStyle = "rgba(0,0,0,.24)";
  g.fillRect(0, H * 0.97, W, H * 0.03);
  sideShade(g, W, H, 0.22);
}
function paintSocks(g, W, H, kit) {
  g.fillStyle = css(kit.socks);
  g.fillRect(0, 0, W, H);
  folds(g, W, H, 53, 10, 0.05);
  const tr = css(kit.trim === kit.socks ? kit.shorts : kit.trim);
  g.fillStyle = tr;
  g.fillRect(0, H * 0.075, W, H * 0.05);
  g.fillRect(0, H * 0.16, W, H * 0.032);
  const fold = g.createLinearGradient(0, 0, 0, H * 0.06);
  fold.addColorStop(0, "rgba(0,0,0,.2)");
  fold.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fold;
  g.fillRect(0, 0, W, H * 0.06);
  sideShade(g, W, H, 0.14);
}
function paintBoot(g, W, H, kit) {
  g.fillStyle = css(kit.shoes);
  g.fillRect(0, 0, W, H);
  // 위쪽 광택 · 옆줄 · 앞코
  const shine = g.createLinearGradient(0, 0, 0, H);
  shine.addColorStop(0, "rgba(0,0,0,.28)");
  shine.addColorStop(0.45, "rgba(255,255,255,.14)");
  shine.addColorStop(1, "rgba(0,0,0,.05)");
  g.fillStyle = shine;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.82)";
  for (const u of [0.04, 0.46]) {
    g.save();
    g.translate(W * u, H * 0.42);
    g.rotate(-0.25);
    g.fillRect(0, -H * 0.04, W * 0.14, H * 0.08);
    g.restore();
  }
  // 끈
  g.fillStyle = "rgba(255,255,255,.75)";
  for (let i = 0; i < 4; i += 1) g.fillRect(W * 0.2, H * (0.36 + i * 0.1), W * 0.1, H * 0.022);
}

/* ---------- 얼굴 ---------- */
const FACE = { x: 0.1, y0: -0.02, y1: 0.28 };
const faceUv = (x, y) => [0.5 + x / (2 * FACE.x), (y - FACE.y0) / (FACE.y1 - FACE.y0)];
let faceImg = null;
const faceWait = [];
function loadFace(fn) {
  if (faceImg) {
    fn(faceImg);
    return;
  }
  faceWait.push(fn);
  if (faceWait.length > 1) return;
  const im = new Image();
  im.onload = () => {
    faceImg = im;
    faceWait.splice(0).forEach((f) => f(im));
  };
  im.src = new URL("../assets/face.webp?v=1", import.meta.url).href;
}
function paintFace(g, W, H, skin, im) {
  g.fillStyle = skin;
  g.fillRect(0, 0, W, H);
  if (!im) {
    // 그림을 받기 전: 단순한 이목구비
    const cx = W / 2;
    const ey = H * (1 - (0.13 - FACE.y0) / (FACE.y1 - FACE.y0));
    g.fillStyle = "#20222c";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * W * 0.15, ey, W * 0.035, W * 0.018, 0, 0, 6.3);
      g.fill();
    }
    return;
  }
  // 그림에서 얼굴 너비 ≈ 0.138m (귀 안쪽), 그림 세로는 턱 아래부터 머리카락까지
  const pxPerM = W / (2 * FACE.x);
  const fw = 0.158 * pxPerM;
  const fh = fw * (im.height / im.width);
  const chinInImage = 0.905; // 그림 높이에서 턱 위치
  const chinY = H * (1 - (0.012 - FACE.y0) / (FACE.y1 - FACE.y0));
  const top = chinY - fh * chinInImage;
  const left = W / 2 - fw / 2;
  // 가장자리를 피부로 녹인다
  const c = canvas(W, H);
  const x = c.getContext("2d");
  x.filter = "brightness(1.12) saturate(0.92)";
  x.drawImage(im, left, top, fw, fh);
  x.filter = "none";
  x.globalCompositeOperation = "destination-in";
  const mask = canvas(W, H);
  const m = mask.getContext("2d");
  const cx = W / 2;
  const cy = top + fh * 0.5;
  m.translate(cx, cy);
  m.scale(fw / 2, (fh / 2) * 1.02);
  const r = m.createRadialGradient(0, 0, 0.72, 0, 0, 1);
  r.addColorStop(0, "rgba(0,0,0,1)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  m.fillStyle = r;
  m.fillRect(-2, -2, 4, 4);
  x.drawImage(mask, 0, 0);
  g.drawImage(c, 0, 0);
}

/* ---------- 부위별 도형 (한 번만 만들고 같이 쓴다) ---------- */
const HIP2V = (y) => (y + 0.09) / 0.645; // 몸통 무늬 세로 위치
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const S = {};
  const shirtUv = (offsetY) => (x, y, z, u) => [u, HIP2V(y + offsetY)];
  // 배 (spine 기준 · 엉덩이에서 +0.05)
  S.belly = loft(
    [
      { y: -0.14, rx: 0.172, rz: 0.122, p: 2.3 },
      { y: -0.04, rx: 0.164, rz: 0.116, p: 2.3 },
      { y: 0.07, rx: 0.152, rz: 0.106, p: 2.3 },
      { y: 0.16, rx: 0.16, rz: 0.112, p: 2.4 },
      { y: 0.235, rx: 0.172, rz: 0.12, p: 2.4 },
    ],
    { radial: 24, sub: 3, uvFn: shirtUv(0.05) }
  );
  // 가슴 · 어깨 (chest 기준 · 엉덩이에서 +0.25)
  S.chest = loft(
    [
      { y: -0.04, rx: 0.17, rz: 0.118, p: 2.4 },
      { y: 0.07, rx: 0.186, rz: 0.13, z: 0.004, p: 2.5 },
      { y: 0.16, rx: 0.19, rz: 0.134, z: 0.006, p: 2.6 },
      { y: 0.225, rx: 0.186, rz: 0.116, p: 2.6 },
      { y: 0.262, rx: 0.146, rz: 0.092, p: 2.4 },
      { y: 0.29, rx: 0.082, rz: 0.076, p: 2 },
      { y: 0.3, rx: 0.066, rz: 0.066, p: 2 },
    ],
    { radial: 24, sub: 3, uvFn: shirtUv(0.25), cap: 2 }
  );
  // 깃
  S.collar = new THREE.TorusGeometry(0.066, 0.011, 8, 22).rotateX(Math.PI / 2).translate(0, 0.297, 0).toNonIndexed();
  // 어깨 근육
  S.delt = plainUv(ball(0.06, 0.066, 0.062, -0.002, -0.008, 0, 14), 0.5, 0.6);
  // 소매
  S.sleeve = loft(
    [
      { y: -0.17, rx: 0.058, rz: 0.06 },
      { y: -0.1, rx: 0.058, rz: 0.062 },
      { y: -0.04, rx: 0.058, rz: 0.062 },
      { y: 0.0, rx: 0.05, rz: 0.052 },
    ],
    { radial: 14, sub: 2, cap: 1 }
  );
  S.upper = loft(
    [
      { y: -0.28, rx: 0.04, rz: 0.042 },
      { y: -0.2, rx: 0.046, rz: 0.05, z: 0.004 },
      { y: -0.12, rx: 0.051, rz: 0.056, z: 0.006 },
      { y: -0.05, rx: 0.052, rz: 0.054 },
    ],
    { radial: 14, sub: 2 }
  );
  S.upperLong = loft(
    [
      { y: -0.285, rx: 0.046, rz: 0.048 },
      { y: -0.2, rx: 0.05, rz: 0.054, z: 0.004 },
      { y: -0.1, rx: 0.056, rz: 0.06, z: 0.005 },
      { y: 0.02, rx: 0.056, rz: 0.058 },
    ],
    { radial: 14, sub: 2, uvFn: (x, y, z, u) => [u, 0.5] }
  );
  S.fore = loft(
    [
      { y: -0.262, rx: 0.03, rz: 0.024 },
      { y: -0.19, rx: 0.033, rz: 0.03 },
      { y: -0.09, rx: 0.043, rz: 0.04 },
      { y: -0.03, rx: 0.045, rz: 0.043 },
      { y: 0.02, rx: 0.04, rz: 0.04 },
    ],
    { radial: 14, sub: 2, cap: 3 }
  );
  S.foreLong = loft(
    [
      { y: -0.255, rx: 0.036, rz: 0.03 },
      { y: -0.19, rx: 0.038, rz: 0.034 },
      { y: -0.09, rx: 0.047, rz: 0.044 },
      { y: 0.02, rx: 0.046, rz: 0.046 },
    ],
    { radial: 14, sub: 2, cap: 3 }
  );
  // 손 (살)
  const fingers = (r, L, spread, palmH) => {
    const out = [];
    for (let i = 0; i < 4; i += 1) {
      const x = (i - 1.5) * spread;
      const f = new THREE.CapsuleGeometry(r, L * (i === 0 || i === 3 ? 0.82 : 1), 2, 6);
      f.rotateX(0.32);
      f.translate(x, -palmH - L * 0.42, 0.012);
      out.push(f.toNonIndexed());
    }
    const th = new THREE.CapsuleGeometry(r * 1.1, L * 0.62, 2, 6);
    th.rotateZ(0.7);
    th.translate(0.044, -palmH * 0.55, 0.012);
    out.push(th.toNonIndexed());
    return out;
  };
  S.hand = merge([ball(0.037, 0.046, 0.02, 0, -0.04, 0, 10), ...fingers(0.0088, 0.04, 0.017, 0.07)]);
  // 장갑: 크고 두툼하다
  S.glove = merge([ball(0.056, 0.062, 0.03, 0, -0.05, 0, 10), ...fingers(0.0145, 0.05, 0.025, 0.088)]);
  S.gloveCuff = tube(0.04, 0.044, 0.05, 0, 0.018, 0, 12);
  // 바지: 골반 + 다리 통
  S.pelvis = loft(
    [
      { y: -0.09, rx: 0.17, rz: 0.118, p: 2.3 },
      { y: 0.0, rx: 0.176, rz: 0.13, p: 2.4 },
      { y: 0.07, rx: 0.17, rz: 0.122, p: 2.4 },
      { y: 0.115, rx: 0.164, rz: 0.116, p: 2.3 },
    ],
    { radial: 24, sub: 2, cap: 2 }
  );
  S.crotch = plainUv(ball(0.135, 0.055, 0.1, 0, -0.085, 0, 12), 0.25, 0.5);
  S.shortLeg = loft(
    [
      { y: -0.255, rx: 0.106, rz: 0.114 },
      { y: -0.17, rx: 0.102, rz: 0.11 },
      { y: -0.06, rx: 0.098, rz: 0.106 },
      { y: 0.05, rx: 0.09, rz: 0.1 },
    ],
    { radial: 18, sub: 2 }
  );
  // 허벅지 (앞이 볼록)
  S.thigh = loft(
    [
      { y: -0.44, rx: 0.052, rz: 0.054 },
      { y: -0.38, rx: 0.06, rz: 0.066, z: 0.006 },
      { y: -0.28, rx: 0.074, rz: 0.08, z: 0.01 },
      { y: -0.16, rx: 0.084, rz: 0.09, z: 0.008 },
    ],
    { radial: 16, sub: 2 }
  );
  S.knee = ball(0.054, 0.056, 0.058, 0, 0.002, 0.004, 12);
  // 정강이 + 종아리 (뒤가 볼록) = 양말
  S.shin = loft(
    [
      { y: -0.405, rx: 0.034, rz: 0.036 },
      { y: -0.34, rx: 0.036, rz: 0.04 },
      { y: -0.22, rx: 0.05, rz: 0.056, z: -0.008 },
      { y: -0.12, rx: 0.057, rz: 0.064, z: -0.014 },
      { y: -0.055, rx: 0.052, rz: 0.056, z: -0.006 },
      { y: -0.03, rx: 0.053, rz: 0.054, z: 0 },
    ],
    { radial: 16, sub: 2 }
  );
  S.shinTop = loft(
    [
      { y: -0.06, rx: 0.048, rz: 0.05 },
      { y: 0.01, rx: 0.05, rz: 0.052 },
    ],
    { radial: 12, sub: 1 }
  );
  // 축구화
  const bootUv = (x, y, z, u, t) => [u, 0.15 + t * 0.7];
  S.boot = loft(
    [
      { y: -0.075, rx: 0.026, rz: 0.03, z: -0.03 },
      { y: -0.052, rx: 0.042, rz: 0.054, z: -0.024 },
      { y: 0.0, rx: 0.045, rz: 0.054, z: -0.026 },
      { y: 0.06, rx: 0.046, rz: 0.042, z: -0.036 },
      { y: 0.12, rx: 0.052, rz: 0.03, z: -0.046 },
      { y: 0.175, rx: 0.042, rz: 0.02, z: -0.052 },
      { y: 0.205, rx: 0.016, rz: 0.012, z: -0.056 },
    ],
    { radial: 16, sub: 3, cap: 3, axis: "z", uvFn: bootUv }
  );
  S.ankle = tube(0.037, 0.043, 0.05, 0, 0.012, -0.004, 12);
  const soleParts = [];
  const sole = new THREE.BoxGeometry(0.086, 0.012, 0.262);
  sole.translate(0, -0.082, 0.064);
  soleParts.push(sole.toNonIndexed());
  for (const [x, z] of [[-0.024, -0.03], [0.024, -0.03], [-0.03, 0.06], [0.03, 0.06], [-0.026, 0.13], [0.026, 0.13]]) {
    soleParts.push(tube(0.007, 0.005, 0.012, x, -0.086, z, 6));
  }
  S.sole = merge(soleParts);
  // 목
  S.neck = loft(
    [
      { y: -0.03, rx: 0.056, rz: 0.058, z: 0.002 },
      { y: 0.04, rx: 0.05, rz: 0.052, z: 0.006 },
      { y: 0.09, rx: 0.048, rz: 0.05, z: 0.012 },
    ],
    { radial: 14, sub: 2 }
  );
  // 머리: 얼굴 그림을 앞에서 비춘다
  const fUv = (x, y) => faceUv(x, y);
  S.head = loft(
    [
      { y: 0.0, rx: 0.016, rz: 0.016, z: 0.052 },
      { y: 0.016, rx: 0.038, rz: 0.042, z: 0.04 },
      { y: 0.045, rx: 0.058, rz: 0.066, z: 0.018 },
      { y: 0.085, rx: 0.07, rz: 0.084, z: 0.008 },
      { y: 0.13, rx: 0.076, rz: 0.094, z: 0.002 },
      { y: 0.175, rx: 0.078, rz: 0.098, z: -0.002 },
      { y: 0.215, rx: 0.068, rz: 0.09, z: -0.006 },
      { y: 0.245, rx: 0.044, rz: 0.064, z: -0.008 },
      { y: 0.258, rx: 0.012, rz: 0.016, z: -0.008 },
    ],
    { radial: 26, sub: 3, cap: 3, uvFn: fUv }
  );
  // 코 · 입술 · 눈두덩: 같은 그림을 비춰 살짝 입체로
  const faceBump = (g) => {
    const p = g.attributes.position;
    const u = g.attributes.uv;
    for (let i = 0; i < p.count; i += 1) {
      const q = faceUv(p.getX(i), p.getY(i));
      u.setXY(i, q[0], q[1]);
    }
    return g;
  };
  S.nose = faceBump(ball(0.0125, 0.024, 0.013, 0, 0.088, 0.091, 10));
  S.brow = faceBump(ball(0.052, 0.012, 0.012, 0, 0.143, 0.083, 10));
  S.lips = faceBump(ball(0.02, 0.0065, 0.0065, 0, 0.05, 0.085, 8));
  S.ear = merge([ball(0.009, 0.026, 0.017, 0.079, 0.122, -0.006, 8), ball(0.009, 0.026, 0.017, -0.079, 0.122, -0.006, 8)]);
  // 머리카락: 뒤통수 덩어리 + 뾰족한 머리 뭉치
  const r = rng(77);
  const hair = [];
  const cap = new THREE.SphereGeometry(1, 22, 16).toNonIndexed();
  {
    const p = cap.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i) * 0.086;
      const y = p.getY(i) * 0.104;
      const z = p.getZ(i) * 0.106;
      const az = Math.abs(Math.atan2(x, z)) / Math.PI; // 0 앞 ~ 1 뒤
      const line = 0.03 + 0.02 * Math.cos(az * 3.14) + (az < 0.3 ? 0.012 : az < 0.42 ? -0.036 : -0.106 * Math.min(1, (az - 0.42) * 2.2));
      // 머리선 아래는 안으로 넣어 숨긴다
      const k = y < line ? 0.72 : 1;
      p.setXYZ(i, x * k, y * (y < line ? 0.8 : 1) + 0.158, z * k - 0.006);
    }
    cap.computeVertexNormals();
  }
  hair.push(cap);
  const addTuft = (x, y, z, dx, dy, dz, L, w) => {
    const c = new THREE.ConeGeometry(w, L, 5, 1);
    c.translate(0, L / 2, 0);
    c.scale(1, 1, 0.7);
    const d = new THREE.Vector3(dx, dy, dz).normalize();
    const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    c.applyQuaternion(qq);
    c.translate(x, y, z);
    hair.push(c.toNonIndexed());
  };
  const crown = new THREE.Vector3(0.012, 0.25, -0.03);
  for (let i = 0; i < 210; i += 1) {
    const a = r() * Math.PI * 2;
    const h = 0.04 + r() * 0.96;
    const R = Math.sqrt(1 - h * h);
    const nv = new THREE.Vector3(Math.sin(a) * R, h, Math.cos(a) * R);
    const az = Math.abs(a > Math.PI ? a - 2 * Math.PI : a) / Math.PI;
    const low = az < 0.24 ? 0.42 : az < 0.42 ? 0.2 : -0.02;
    if (nv.y < low) continue;
    const pp = new THREE.Vector3(nv.x * 0.082, 0.158 + nv.y * 0.098, nv.z * 0.1 - 0.006);
    // 가마에서 바깥쪽으로 흐른다
    const t = pp.clone().sub(crown);
    t.addScaledVector(nv, -t.dot(nv));
    if (t.lengthSq() < 1e-6) t.set(r() - 0.5, 0, r() - 0.5);
    t.normalize();
    const front = az < 0.3;
    const lift = front ? 0.22 : 0.3;
    const d = t.multiplyScalar(1).addScaledVector(nv, lift);
    d.x += (r() - 0.5) * 0.34;
    d.z += (r() - 0.5) * 0.34;
    const L = front ? 0.052 + r() * 0.026 : 0.05 + r() * 0.03;
    const w = 0.024 + r() * 0.008;
    addTuft(pp.x, pp.y, pp.z, d.x, d.y, d.z, L, w);
  }
  S.hair = merge(hair);
  SHAPES = S;
  return S;
}

function numberCanvas() {
  return canvas(1024, 512);
}

export const KITS = {
  korea: { shirt: 0xf4f6f4, trim: 0xd23a35, shorts: 0x1f2f55, socks: 0xf4f6f4, shoes: 0xe5352e, number: "#1f2f55" },
  keeper: { shirt: 0xf7cf2a, trim: 0x2a3f7c, shorts: 0x1f2f55, socks: 0xf2f2ec, shoes: 0x1f2f55, number: "#1f2f55", gloves: 0xf4f6f4, long: true },
};

export function makePlayer(kit, look = {}) {
  const skinHex = look.skin || 0xe8ad84;
  const hairHex = look.hair || 0x14141a;
  const S = shapes();
  const paint = (w, h) => {
    const c = canvas(w, h);
    return { c, g: c.getContext("2d"), t: tex(c, { repeat: false }) };
  };
  const shirtP = { c: numberCanvas() };
  shirtP.g = shirtP.c.getContext("2d");
  shirtP.t = tex(shirtP.c, { repeat: false });
  const sleeveP = paint(128, 128);
  const shortsP = paint(256, 256);
  const socksP = paint(128, 256);
  const bootP = paint(128, 128);
  const faceP = paint(384, 576);
  const skinCss = `#${new THREE.Color(skinHex).getHexString()}`;
  paintFace(faceP.g, 384, 576, skinCss, null);
  faceP.t.needsUpdate = true;
  loadFace((im) => {
    paintFace(faceP.g, 384, 576, skinCss, im);
    faceP.t.needsUpdate = true;
  });
  const M = {
    shirt: std({ map: shirtP.t, roughness: 0.72 }),
    sleeve: std({ map: sleeveP.t, roughness: 0.72 }),
    trim: std({ color: kit.trim, roughness: 0.7 }),
    shorts: std({ map: shortsP.t, roughness: 0.74 }),
    socks: std({ map: socksP.t, roughness: 0.82 }),
    shoes: std({ map: bootP.t, roughness: 0.35, metalness: 0.08 }),
    sole: std({ color: 0x1a1b20, roughness: 0.6 }),
    skin: std({ color: skinHex, roughness: 0.6 }),
    face: std({ map: faceP.t, roughness: 0.6 }),
    hair: std({ color: hairHex, roughness: 0.42, metalness: 0.05 }),
    glove: std({ color: kit.gloves || skinHex, roughness: 0.55 }),
    cuff: std({ color: kit.trim, roughness: 0.55 }),
  };
  const mesh = (geo, mat, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const joint = (parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const root = new THREE.Group();
  const j = {};
  j.spine = joint(root, 0, 0.05, 0);
  j.chest = joint(j.spine, 0, 0.2, 0);
  j.neck = joint(j.chest, 0, 0.285, 0);
  j.head = joint(j.neck, 0, 0.055, 0);

  // 바지 · 배 · 가슴
  mesh(S.pelvis, M.shorts, root);
  mesh(S.crotch, M.shorts, root);
  mesh(S.belly, M.shirt, j.spine);
  mesh(S.chest, M.shirt, j.chest);
  mesh(S.collar, M.trim, j.chest);
  mesh(S.neck, M.skin, j.neck);

  // 머리
  const headMesh = mesh(S.head, M.face, j.head);
  mesh(S.nose, M.face, j.head);
  mesh(S.brow, M.face, j.head);
  mesh(S.lips, M.face, j.head);
  mesh(S.ear, M.skin, j.head);
  mesh(S.hair, M.hair, j.head);

  // 팔 · 다리 (character 왼쪽이 +x)
  const longParts = [];
  const shortParts = [];
  for (const [s, side] of [
    ["L", 1],
    ["R", -1],
  ]) {
    const arm = joint(j.chest, side * 0.186, 0.222, 0);
    mesh(S.delt, M.sleeve, arm);
    shortParts.push(mesh(S.sleeve, M.sleeve, arm), mesh(S.upper, M.skin, arm));
    longParts.push(mesh(S.upperLong, M.sleeve, arm));
    const fore = joint(arm, 0, -0.27, 0);
    shortParts.push(mesh(S.fore, M.skin, fore));
    longParts.push(mesh(S.foreLong, M.sleeve, fore));
    const hand = joint(fore, 0, -0.25, 0);
    shortParts.push(mesh(S.hand, M.skin, hand));
    const gl = mesh(S.glove, M.glove, hand);
    const cf = mesh(S.gloveCuff, M.cuff, hand);
    if (side < 0) {
      gl.scale.x = -1;
    } else {
      // 왼손은 엄지 방향이 그대로
    }
    longParts.push(gl, cf);
    j[`arm${s}`] = arm;
    j[`fore${s}`] = fore;
    j[`hand${s}`] = hand;

    const leg = joint(root, side * 0.09, -0.04, 0);
    mesh(S.shortLeg, M.shorts, leg);
    mesh(S.thigh, M.skin, leg);
    const shin = joint(leg, 0, -0.43, 0);
    mesh(S.knee, M.skin, shin);
    mesh(S.shinTop, M.skin, shin);
    mesh(S.shin, M.socks, shin);
    const foot = joint(shin, 0, -0.42, 0);
    mesh(S.ankle, M.socks, foot);
    mesh(S.boot, M.shoes, foot);
    mesh(S.sole, M.sole, foot);
    j[`leg${s}`] = leg;
    j[`shin${s}`] = shin;
    j[`foot${s}`] = foot;
  }

  // 내 얼굴 카드 (사진은 기기 안 캔버스에서만 씀)
  const fc = canvas(128, 128);
  const fTex = tex(fc, { repeat: false });
  const faceCard = new THREE.Sprite(new THREE.SpriteMaterial({ map: fTex, transparent: true, depthWrite: false, fog: false }));
  faceCard.scale.set(0.36, 0.36, 1);
  faceCard.position.set(0, 0.13, 0);
  faceCard.visible = false;
  j.head.add(faceCard);

  const hipY = 0.93;
  root.position.y = hipY;
  const pl = {
    root,
    j,
    M,
    kit,
    headMesh,
    hipY,
    number: look.number || 10,
    /** 유니폼을 다시 그린다 (같으면 건너뜀) */
    repaint() {
      const k = this.kit;
      const key = `${k.shirt}|${k.trim}|${k.shorts}|${k.socks}|${k.shoes}|${k.number}|${k.long ? 1 : 0}|${this.number}`;
      if (key === this.paintKey) return;
      this.paintKey = key;
      paintShirt(shirtP.g, 1024, 512, k, this.number);
      paintSleeve(sleeveP.g, 128, 128, k);
      paintShorts(shortsP.g, 256, 256, k);
      paintSocks(socksP.g, 128, 256, k);
      paintBoot(bootP.g, 128, 128, k);
      for (const P of [shirtP, sleeveP, shortsP, socksP, bootP]) P.t.needsUpdate = true;
      M.trim.color.set(k.trim);
      M.cuff.color.set(k.trim);
      if (k.gloves) M.glove.color.set(k.gloves);
      for (const o of shortParts) o.visible = !k.long;
      for (const o of longParts) o.visible = !!k.long;
    },
    setKit(k, n) {
      this.kit = k;
      if (n != null) this.number = n;
      this.repaint();
    },
    setNumber(n, color) {
      this.number = n;
      if (color) this.kit = { ...this.kit, number: color };
      this.repaint();
    },
    /** 내 얼굴을 켰으면 우리 팀 선수 머리에 얼굴 카드 */
    setFace(on) {
      faceCard.visible = false;
      if (!on || !window.TodayFace || !window.TodayFace.ready || !window.TodayFace.ready()) return;
      const g = fc.getContext("2d");
      g.clearRect(0, 0, 128, 128);
      if (window.TodayFace.drawHead(g, 64, 64, 54, { ring: 6, ringColor: "#fff" })) {
        fTex.needsUpdate = true;
        faceCard.visible = true;
      }
    },
  };
  pl.repaint();
  return pl;
}

/* ---------- 자세 ---------- */
const P = (o) => o;
export const POSE = {
  stand: P({ spine: [0.04, 0, 0], chest: [0.02, 0, 0], armL: [0.05, 0, 0.14], armR: [0.05, 0, -0.14], foreL: [-0.28, 0, 0], foreR: [-0.28, 0, 0], legL: [0, 0, 0.06], legR: [0, 0, -0.06], shinL: [0.06, 0, 0], shinR: [0.06, 0, 0], footL: [-0.03, 0, 0], footR: [-0.03, 0, 0], neck: [0, 0, 0], head: [0, 0, 0] }),
  keeperReady: P({ spine: [0.42, 0, 0], chest: [0.16, 0, 0], armL: [-0.65, 0, 0.62], armR: [-0.65, 0, -0.62], foreL: [-0.55, 0, 0], foreR: [-0.55, 0, 0], legL: [-0.72, 0, 0.26], legR: [-0.72, 0, -0.26], shinL: [1.1, 0, 0], shinR: [1.1, 0, 0], footL: [-0.34, 0, -0.1], footR: [-0.34, 0, 0.1], neck: [-0.3, 0, 0], head: [-0.2, 0, 0] }),
  // 찰 준비: 왼발 디딤 · 오른 다리 뒤로
  kickBack: P({ spine: [-0.1, 0.25, -0.1], chest: [0.05, 0.4, 0], armL: [-0.9, 0, 0.9], armR: [0.7, 0, -0.45], foreL: [-0.5, 0, 0], foreR: [-0.5, 0, 0], legL: [-0.28, 0, 0.1], legR: [0.95, 0, -0.03], shinL: [0.35, 0, 0], shinR: [1.5, 0, 0], footL: [0, 0, 0], footR: [0.4, 0, 0], neck: [0.25, -0.2, 0], head: [0.2, 0, 0] }),
  kickHit: P({ spine: [-0.16, -0.1, 0.08], chest: [0.02, -0.28, 0], armL: [0.45, 0, 0.75], armR: [-0.7, 0, -0.6], foreL: [-0.4, 0, 0], foreR: [-0.4, 0, 0], legL: [-0.1, 0, 0.1], legR: [-0.82, 0, 0], shinL: [0.25, 0, 0], shinR: [0.2, 0, 0], footL: [0, 0, 0], footR: [0.45, 0, 0], neck: [0.25, 0, 0], head: [0.1, 0, 0] }),
  kickFollow: P({ spine: [-0.34, -0.25, 0.1], chest: [-0.05, -0.4, 0], armL: [0.7, 0, 0.95], armR: [-1.05, 0, -0.5], foreL: [-0.4, 0, 0], foreR: [-0.5, 0, 0], legL: [0.05, 0, 0.08], legR: [-1.55, 0, 0.05], shinL: [0.18, 0, 0], shinR: [0.08, 0, 0], footL: [-0.1, 0, 0], footR: [0.55, 0, 0], neck: [0.3, 0, 0], head: [-0.05, 0, 0] }),
  armsUp: P({ spine: [-0.1, 0, 0], chest: [-0.1, 0, 0], armL: [-2.75, 0, 0.45], armR: [-2.75, 0, -0.45], foreL: [-0.25, 0, 0], foreR: [-0.25, 0, 0], legL: [-0.1, 0, 0.1], legR: [0.05, 0, -0.1], shinL: [0.2, 0, 0], shinR: [0.2, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0], neck: [-0.2, 0, 0], head: [-0.2, 0, 0] }),
  plane: P({ spine: [0.3, 0, 0.1], chest: [0.05, 0, 0.1], armL: [0, 0, 1.45], armR: [0, 0, -1.45], foreL: [0, 0, 0], foreR: [0, 0, 0], legL: [0, 0, 0], legR: [0, 0, 0], shinL: [0.6, 0, 0], shinR: [0.6, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0], neck: [-0.35, 0, 0], head: [-0.15, 0, 0] }),
  fist: P({ spine: [0.08, 0, 0], chest: [-0.05, 0.1, 0], armL: [-0.4, 0, 0.3], armR: [-2.6, 0, -0.2], foreL: [-1.6, 0, 0], foreR: [-1.2, 0, 0], legL: [-0.35, 0, 0.14], legR: [0.2, 0, -0.14], shinL: [0.55, 0, 0], shinR: [0.35, 0, 0], footL: [-0.1, 0, 0], footR: [0, 0, 0], neck: [-0.15, 0, 0], head: [-0.1, 0, 0] }),
  handsHead: P({ spine: [0.2, 0, 0], chest: [0.1, 0, 0], armL: [-2.5, 0, 0.75], armR: [-2.5, 0, -0.75], foreL: [-2.1, 0, 0], foreR: [-2.1, 0, 0], legL: [0, 0, 0.08], legR: [0, 0, -0.08], shinL: [0.08, 0, 0], shinR: [0.08, 0, 0], footL: [0, 0, 0], footR: [0, 0, 0], neck: [0.35, 0, 0], head: [0.2, 0, 0] }),
  kneesDown: P({ spine: [0.42, 0, 0], chest: [0.2, 0, 0], armL: [0.1, 0, 0.1], armR: [0.1, 0, -0.1], foreL: [-0.3, 0, 0], foreR: [-0.3, 0, 0], legL: [-1.5, 0, 0.14], legR: [-1.5, 0, -0.14], shinL: [2.35, 0, 0], shinR: [2.35, 0, 0], footL: [0.5, 0, 0], footR: [0.5, 0, 0], neck: [0.55, 0, 0], head: [0.3, 0, 0] }),
};
const JOINT_KEYS = Object.keys(POSE.stand);

/** 두 자세 사이 (t: 0~1) */
export function blendPose(pl, a, b, t) {
  for (const k of JOINT_KEYS) {
    const A = a[k] || POSE.stand[k];
    const B = b[k] || POSE.stand[k];
    pl.j[k].rotation.set(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
}
export function setPose(pl, a) {
  blendPose(pl, a, a, 0);
}
/** 달리기: phase 는 걸음 위상 (라디안) */
export function runPose(pl, phase, amt = 1, armsOut = false) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const j = pl.j;
  j.spine.rotation.set(0.2 * amt, 0, 0);
  j.chest.rotation.set(0.06, s * 0.14 * amt, 0);
  j.neck.rotation.set(-0.15 * amt, 0, 0);
  j.head.rotation.set(0, 0, 0);
  j.legL.rotation.set(-s * 0.95 * amt - 0.08, 0, 0.03);
  j.legR.rotation.set(s * 0.95 * amt - 0.08, 0, -0.03);
  j.shinL.rotation.set((0.55 + Math.max(0, -c) * 1.25) * amt, 0, 0);
  j.shinR.rotation.set((0.55 + Math.max(0, c) * 1.25) * amt, 0, 0);
  j.footL.rotation.set(0.1, 0, 0);
  j.footR.rotation.set(0.1, 0, 0);
  if (armsOut) {
    j.armL.rotation.set(s * 0.12, 0, 1.4);
    j.armR.rotation.set(-s * 0.12, 0, -1.4);
    j.foreL.rotation.set(0, 0, 0);
    j.foreR.rotation.set(0, 0, 0);
  } else {
    j.armL.rotation.set(s * 0.85 * amt, 0, 0.12);
    j.armR.rotation.set(-s * 0.85 * amt, 0, -0.12);
    j.foreL.rotation.set(-1.25 * amt, 0, 0);
    j.foreR.rotation.set(-1.25 * amt, 0, 0);
  }
}

/** 팔을 세계 좌표 target 쪽으로 곧게 뻗음 (amt 만큼) */
export function aimArm(pl, side, target, amt = 1) {
  const arm = pl.j[`arm${side}`];
  const fore = pl.j[`fore${side}`];
  arm.parent.getWorldQuaternion(q1);
  arm.getWorldPosition(v1);
  const dir = new THREE.Vector3().subVectors(target, v1).normalize().applyQuaternion(q1.invert());
  q2.setFromUnitVectors(DOWN, dir);
  arm.quaternion.slerp(q2, amt);
  fore.rotation.x *= 1 - amt;
}

/** 부딪힘 구: 공과의 충돌에 씀 [이름, 위치, 반지름] */
const COLLIDER_DEF = [
  ["handL", 0.17, "glove"],
  ["handR", 0.17, "glove"],
  ["foreL", 0.1, "arm"],
  ["foreR", 0.1, "arm"],
  ["head", 0.15, "body"],
  ["chest", 0.2, "body"],
  ["spine", 0.19, "body"],
  ["legL", 0.13, "body"],
  ["legR", 0.13, "body"],
  ["shinL", 0.11, "leg"],
  ["shinR", 0.11, "leg"],
  ["footL", 0.09, "leg"],
  ["footR", 0.09, "leg"],
];
export function makeColliders() {
  return COLLIDER_DEF.map(([name, r, kind]) => ({ name, r, kind, pos: new THREE.Vector3() }));
}
const OFFSET = { handL: new THREE.Vector3(0, -0.05, 0), handR: new THREE.Vector3(0, -0.05, 0), foreL: new THREE.Vector3(0, -0.14, 0), foreR: new THREE.Vector3(0, -0.14, 0), head: new THREE.Vector3(0, 0.13, 0), chest: new THREE.Vector3(0, 0.12, 0), spine: new THREE.Vector3(0, 0.1, 0), legL: new THREE.Vector3(0, -0.2, 0), legR: new THREE.Vector3(0, -0.2, 0), shinL: new THREE.Vector3(0, -0.2, 0), shinR: new THREE.Vector3(0, -0.2, 0), footL: new THREE.Vector3(0, -0.03, 0.05), footR: new THREE.Vector3(0, -0.03, 0.05) };
export function updateColliders(pl, list) {
  pl.root.updateMatrixWorld(true);
  for (const c of list) {
    c.pos.copy(OFFSET[c.name]).applyMatrix4(pl.j[c.name].matrixWorld);
  }
}
