/*
 * 앞 화면: 저격총 + 장갑 낀 두 손 (따로 그리는 장면 · 카메라에 붙음)
 *  - 총: 옆모습을 깎아 만든 개머리판 · 손잡이(위장 도색 + 벗겨진 쇠) · 팔각 총열덮개 · 홈 파인 총열 · 소염기
 *        레일 · 스코프(깎은 몸통 · 다이얼 · 링) · 노리쇠 · 탄창 · 접힌 양각대
 *  - 스코프 접안렌즈에는 실제 확대 화면이 비침 (높음 품질)
 *  - 움직임: 숨 쉬기 · 고개 돌릴 때 따라옴 · 반동 · 노리쇠 당기기 · 조준(스코프에 눈 대기)
 */
import { THREE, canvas, tex, rng, clamp, lerp, glow, normalFrom, noise2, fbm } from "./kit.js";

/* ---------- 텍스처 ---------- */
/** 전장에서 닳은 도색: 짙은 회색 바탕 + 모래색 얼룩 · 벗겨져 드러난 쇠 · 긁힘 → 색 · 거칠기/금속 · 노멀 */
function cerakote(seed, base, patch, patch2) {
  const S = 512;
  const r = rng(seed);
  const n = noise2(seed * 3 + 1);
  const n2 = noise2(seed * 5 + 2);
  const col = canvas(S, S);
  const orm = canvas(S, S);
  const hgt = canvas(S, S);
  const g = col.getContext("2d");
  const o = orm.getContext("2d");
  const hh = hgt.getContext("2d");
  const ci = g.createImageData(S, S);
  const oi = o.createImageData(S, S);
  const hi = hh.createImageData(S, S);
  const A = new THREE.Color(base);
  const B = new THREE.Color(patch);
  const C = new THREE.Color(patch2);
  const toS = (c) => [c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2) * 255);
  const a = toS(A);
  const b = toS(B);
  const c = toS(C);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const big = fbm(n, x * 0.011 + 3, y * 0.016 + 7, 4);
      const fine = fbm(n2, x * 0.09, y * 0.09, 3);
      const v = big + (fine - 0.45) * 0.11;
      const big2 = fbm(n2, x * 0.014 + 40, y * 0.01 + 9, 3) + (fine - 0.45) * 0.08;
      let rgb = a;
      let rough = 0.62;
      let metal = 0.12;
      let h = 128 + (fine - 0.45) * 40;
      if (big2 > 0.53) rgb = c;
      if (v > 0.5) {
        rgb = b;
        h += 8;
      }
      // 얼룩 가장자리는 벗겨져 쇠가 보임
      const edge = Math.min(Math.abs(v - 0.5), Math.abs(big2 - 0.53));
      const worn = fine > 0.5 && edge < 0.012;
      const speck = r() < 0.0035;
      if (worn || speck) {
        const m = 150 + r() * 50;
        rgb = [m, m, m - 4];
        rough = 0.32;
        metal = 0.95;
        h -= 30;
      }
      const j = (r() - 0.5) * 12;
      ci.data[i] = rgb[0] + j;
      ci.data[i + 1] = rgb[1] + j;
      ci.data[i + 2] = rgb[2] + j;
      ci.data[i + 3] = 255;
      oi.data[i] = 0;
      oi.data[i + 1] = rough * 255;
      oi.data[i + 2] = metal * 255;
      oi.data[i + 3] = 255;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = h;
      hi.data[i + 3] = 255;
    }
  g.putImageData(ci, 0, 0);
  o.putImageData(oi, 0, 0);
  hh.putImageData(hi, 0, 0);
  // 긁힘
  for (let i = 0; i < 170; i++) {
    const x = r() * S;
    const y = r() * S;
    const len = 6 + r() * 50;
    const ang = r() * Math.PI;
    const w = 0.5 + r() * 1.3;
    for (const [t, st] of [
      [g, `rgba(${150 + r() * 50},${150 + r() * 50},${150 + r() * 40},${0.35 + r() * 0.45})`],
      [o, "rgb(0,80,235)"],
      [hh, "#585858"],
    ]) {
      t.strokeStyle = st;
      t.lineWidth = w;
      t.beginPath();
      t.moveTo(x, y);
      t.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      t.stroke();
    }
  }
  // 때
  for (let i = 0; i < 40; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 10 + r() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(20,17,13,0.28)");
    gr.addColorStop(1, "rgba(20,17,13,0)");
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return { map: tex(col), orm: tex(orm, { srgb: false }), normal: normalFrom(hgt, 2.5) };
}

/** 검은 쇠 (스코프 · 총열) */
function anodized(seed, base = "#33363a") {
  const S = 256;
  const r = rng(seed);
  const col = canvas(S, S);
  const g = col.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
    g.fillRect(0, y, S, 1);
  }
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = `rgba(170,170,170,${0.1 + r() * 0.3})`;
    g.lineWidth = 0.5 + r();
    const x = r() * S;
    const y = r() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 8);
    g.stroke();
  }
  return tex(col);
}

/** 오돌토돌 (다이얼 손잡이) */
function knurlNormal() {
  const S = 128;
  const c = canvas(S, S);
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 8) {
    const gr = g.createLinearGradient(x, 0, x + 8, 0);
    gr.addColorStop(0, "#202020");
    gr.addColorStop(0.5, "#ffffff");
    gr.addColorStop(1, "#202020");
    g.fillStyle = gr;
    g.fillRect(x, 0, 8, S);
  }
  return normalFrom(c, 4);
}

/** 장갑 · 소매 천 (짜임 + 박음질) */
function fabric(seed, base, pad) {
  const S = 256;
  const r = rng(seed);
  const col = canvas(S, S);
  const hgt = canvas(S, S);
  const g = col.getContext("2d");
  const h = hgt.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  h.fillStyle = "#808080";
  h.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 3)
    for (let x = 0; x < S; x += 3) {
      const v = ((x / 3 + y / 3) % 2 ? 150 : 100) + r() * 30;
      h.fillStyle = `rgb(${v},${v},${v})`;
      h.fillRect(x, y, 3, 3);
      g.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
      g.fillRect(x, y, 3, 3);
    }
  if (pad) {
    // 손등 보호대 줄
    for (let i = 0; i < 3; i++) {
      g.fillStyle = pad;
      g.fillRect(30 + i * 70, 40, 52, 70);
      h.fillStyle = "#c8c8c8";
      h.fillRect(30 + i * 70, 40, 52, 70);
      h.fillStyle = "#404040";
      h.fillRect(30 + i * 70, 40, 52, 3);
      h.fillRect(30 + i * 70, 107, 52, 3);
    }
  }
  // 박음질 · 주름
  g.strokeStyle = "rgba(0,0,0,0.35)";
  h.strokeStyle = "#303030";
  for (let i = 0; i < 9; i++) {
    const y = r() * S;
    g.beginPath();
    h.beginPath();
    g.moveTo(0, y);
    h.moveTo(0, y);
    for (let x = 0; x <= S; x += 16) {
      const yy = y + Math.sin(x * 0.05 + i) * 6;
      g.lineTo(x, yy);
      h.lineTo(x, yy);
    }
    g.lineWidth = 1;
    h.lineWidth = 2.5;
    g.stroke();
    h.stroke();
  }
  const out = { map: tex(col), normal: normalFrom(hgt, 1.6) };
  out.map.repeat.set(3, 3);
  out.normal.repeat.set(3, 3);
  return out;
}

/* ---------- 도형 ---------- */
/** 모서리가 둥근 상자 */
export function roundBox(w, h, d, rad, seg = 3) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position;
  const hx = w / 2 - rad;
  const hy = h / 2 - rad;
  const hz = d / 2 - rad;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    v.sub(c);
    if (v.lengthSq() > 0) v.normalize().multiplyScalar(rad);
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
/** 앞(-Z)으로 놓인 깎은 몸통: pts = [[반지름, 뒤에서부터 거리] …] */
function latheZ(pts, seg = 40) {
  const g = new THREE.LatheGeometry(
    pts.map(([rr, t]) => new THREE.Vector2(rr, t)),
    seg
  );
  g.rotateX(-Math.PI / 2); // +Y → -Z
  return g;
}

export class Viewmodel {
  constructor(engine) {
    this.e = engine;
    const root = new THREE.Group();
    this.root = root;
    this.gun = new THREE.Group();
    root.add(this.gun);
    engine.vmScene.add(root);
    engine.vmScene.add(engine.vmCamera);
    this.build();
    this.kick = 0;
    this.bolt = 0;
    this.ads = 0;
    this.t = 0;
    this.lagX = 0;
    this.lagY = 0;
    this.flashT = 0;
  }

  build() {
    const G = this.gun;
    const camo = cerakote(7, "#3b3c39", "#8f8166", "#5c5e5a");
    const mCamo = new THREE.MeshStandardMaterial({ map: camo.map, roughnessMap: camo.orm, metalnessMap: camo.orm, normalMap: camo.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 1 });
    const worn = cerakote(9, "#2b2c2c", "#3d3e3b", "#333432");
    const mWorn = new THREE.MeshStandardMaterial({ map: worn.map, roughnessMap: worn.orm, metalnessMap: worn.orm, normalMap: worn.normal, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1, metalness: 1 });
    const blk = anodized(3);
    const mBlack = new THREE.MeshStandardMaterial({ map: blk, color: 0xffffff, roughness: 0.36, metalness: 0.62 });
    mBlack.userData.envK = 1.7;
    const mBlackRough = new THREE.MeshStandardMaterial({ map: blk, color: 0xbdbdbd, roughness: 0.62, metalness: 0.4 });
    const mKnurl = new THREE.MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.42, metalness: 0.75, normalMap: knurlNormal(), normalScale: new THREE.Vector2(1.2, 1.2) });
    const mSteel = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.28, metalness: 1 });
    const mPoly = new THREE.MeshStandardMaterial({ color: 0x232425, roughness: 0.8, metalness: 0 });
    const mRubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, metalness: 0 });
    const mLens = new THREE.MeshStandardMaterial({ color: 0x0c1830, roughness: 0.04, metalness: 1, emissive: 0x000000 });
    mLens.userData.envK = 2.2;
    const mesh = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      G.add(m);
      return m;
    };
    // 개머리판 · 손잡이 (옆모습을 X 쪽으로 밀어 냄)
    const s = new THREE.Shape();
    const P = [
      [-0.47, -0.135],
      [-0.47, 0.036],
      [-0.41, 0.048],
      [-0.165, 0.048],
      [-0.135, 0.02],
      [-0.1, 0.0],
      [0.06, 0.0],
      [0.06, -0.045],
      [-0.045, -0.045],
      [-0.075, -0.058],
      [-0.098, -0.172],
      [-0.152, -0.178],
      [-0.138, -0.062],
      [-0.175, -0.05],
      [-0.43, -0.142],
    ];
    s.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.38, -0.095);
    hole.lineTo(-0.215, -0.058);
    hole.quadraticCurveTo(-0.2, -0.05, -0.205, -0.035);
    hole.lineTo(-0.215, 0.012);
    hole.quadraticCurveTo(-0.22, 0.02, -0.235, 0.02);
    hole.lineTo(-0.37, 0.02);
    hole.quadraticCurveTo(-0.385, 0.02, -0.385, 0.005);
    hole.closePath();
    s.holes.push(hole);
    const stockG = new THREE.ExtrudeGeometry(s, { depth: 0.044, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.006, bevelSegments: 3, curveSegments: 6 });
    stockG.translate(0, 0, -0.022);
    stockG.rotateY(Math.PI / 2);
    // 텍스처 크기 맞춤 (UV 가 미터 단위 → 크게)
    const uv = stockG.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
    mesh(stockG, mCamo, 0, -0.012, 0);
    // 옆판 · 나사 (오른쪽 · 왼쪽)
    for (const sd of [-1, 1]) {
      mesh(roundBox(0.004, 0.03, 0.2, 0.0015), mBlackRough, sd * 0.031, -0.022, 0.0);
      for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.003, 10), mSteel, sd * 0.0335, -0.022, -0.07 + k * 0.05, 0, 0, Math.PI / 2);
      mesh(roundBox(0.004, 0.024, 0.09, 0.0015), mBlackRough, sd * 0.031, 0.03, 0.285);
    }
    // 개머리 고무 패드
    mesh(roundBox(0.06, 0.175, 0.025, 0.008), mRubber, 0, -0.06, 0.475);
    // 몸통 (리시버)
    const recv = roundBox(0.056, 0.058, 0.27, 0.008);
    const ruv = recv.attributes.uv;
    for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) * 0.7, ruv.getY(i) * 0.25);
    mesh(recv, mWorn, 0, 0.004, 0.0);
    mesh(roundBox(0.012, 0.02, 0.1, 0.002), mPoly, -0.0285, 0.014, 0.03); // 탄피 구멍 자리
    mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.2, 20), mSteel, 0.012, 0.012, 0.02, Math.PI / 2, 0, 0); // 노리쇠 몸
    // 총열덮개 (팔각 · 구멍)
    const hg = new THREE.CylinderGeometry(0.033, 0.033, 0.4, 8, 1, false);
    hg.rotateX(Math.PI / 2);
    hg.rotateZ(Math.PI / 8);
    const fore = mesh(hg, mCamo, 0, -0.004, -0.33);
    const fuv = fore.geometry.attributes.uv;
    for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 0.8, fuv.getY(i) * 1.4);
    for (const side of [-1, 1])
      for (let k = 0; k < 5; k++) mesh(roundBox(0.004, 0.012, 0.045, 0.002), mPoly, side * 0.031, -0.004, -0.19 - k * 0.062);
    // 총열 · 홈 · 소염기
    mesh(latheZ([[0.0001, 0], [0.0135, 0], [0.0135, 0.02], [0.0118, 0.06], [0.0112, 0.36], [0.0001, 0.36]], 28), mBlack, 0, 0.0, -0.52);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      mesh(new THREE.BoxGeometry(0.003, 0.003, 0.22), mPoly, Math.cos(a) * 0.0112, Math.sin(a) * 0.0112, -0.73, 0, 0, a);
    }
    mesh(latheZ([[0.0001, 0], [0.019, 0], [0.0195, 0.006], [0.0195, 0.075], [0.016, 0.082], [0.0001, 0.082]], 24), mBlackRough, 0, 0, -0.875);
    for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) mesh(roundBox(0.006, 0.02, 0.011, 0.003), mRubber, sd * 0.0175, 0, -0.895 - k * 0.019);
    // 위 레일 (이빨)
    mesh(new THREE.BoxGeometry(0.022, 0.007, 0.62), mBlack, 0, 0.0365, -0.16);
    const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, 0.0045, 0.0052), mBlack, 60);
    const mt = new THREE.Matrix4();
    for (let i = 0; i < 60; i++) {
      mt.makeTranslation(0, 0.042, 0.14 - i * 0.01);
      teeth.setMatrixAt(i, mt);
    }
    G.add(teeth);
    // 스코프
    const SY = 0.084;
    const scope = latheZ(
      [
        [0.0001, 0],
        [0.0205, 0],
        [0.0222, 0.004],
        [0.0222, 0.02],
        [0.0212, 0.024],
        [0.0215, 0.07],
        [0.0158, 0.095],
        [0.0152, 0.1],
        [0.0152, 0.3],
        [0.0158, 0.31],
        [0.0262, 0.37],
        [0.0268, 0.405],
        [0.0278, 0.41],
        [0.0278, 0.425],
        [0.0238, 0.425],
        [0.0238, 0.415],
        [0.0001, 0.415],
      ],
      48
    );
    mesh(scope, mBlack, 0, SY, 0.15);
    mesh(latheZ([[0.0198, 0], [0.0225, 0], [0.0228, 0.016], [0.0198, 0.016], [0.0198, 0]], 48), mRubber, 0, SY, 0.158); // 눈받침 고무 (가운데는 뚫림)
    // 다이얼 (위 · 오른쪽 · 왼쪽)
    const tz = 0.15 - 0.2;
    mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 0.012, 32), mBlack, 0, SY + 0.018, tz);
    mesh(new THREE.CylinderGeometry(0.0148, 0.0148, 0.022, 40), mKnurl, 0, SY + 0.033, tz);
    mesh(new THREE.CylinderGeometry(0.0128, 0.0128, 0.004, 32), mSteel, 0, SY + 0.045, tz);
    mesh(new THREE.CylinderGeometry(0.0132, 0.0132, 0.018, 36), mKnurl, 0.027, SY, tz, 0, 0, Math.PI / 2);
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.012, 32), mBlack, 0.016, SY, tz, 0, 0, Math.PI / 2);
    mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 36), mKnurl, -0.027, SY, tz, 0, 0, Math.PI / 2);
    mesh(roundBox(0.036, 0.022, 0.05, 0.006), mBlack, 0, SY + 0.004, tz);
    // 배율 링 (눈 쪽)
    mesh(latheZ([[0.0228, 0], [0.0228, 0.03], [0.0001, 0.03]], 40), mKnurl, 0, SY, 0.12);
    // 스코프 링 · 받침
    for (const rz of [0.03, -0.12]) {
      mesh(new THREE.CylinderGeometry(0.0182, 0.0182, 0.017, 32), mBlack, 0, SY, rz, Math.PI / 2, 0, 0);
      mesh(roundBox(0.03, 0.044, 0.017, 0.004), mBlack, 0, SY - 0.026, rz);
      for (const sd of [-1, 1]) mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.006, 10), mSteel, sd * 0.017, SY + 0.012, rz, 0, 0, Math.PI / 2);
      mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.01, 12), mBlackRough, 0.019, SY - 0.032, rz, 0, 0, Math.PI / 2);
    }
    // 렌즈 (앞 · 눈 쪽)
    const lensF = mesh(new THREE.CircleGeometry(0.0236, 40), mLens, 0, SY, 0.15 - 0.415);
    lensF.rotation.y = Math.PI;
    this.mEye = new THREE.MeshBasicMaterial({ color: 0x0a0f18 });
    this.lensTint = 0x9a9a9a;
    this.eye = mesh(new THREE.CircleGeometry(0.0196, 40), this.mEye, 0, SY, 0.1505);
    // 렌즈 위 조준선 · 눈금 (청록빛)
    const rc = canvas(256, 256);
    const rg = rc.getContext("2d");
    rg.strokeStyle = "rgba(10,12,14,0.9)";
    rg.lineWidth = 1.6;
    rg.beginPath();
    rg.moveTo(0, 128);
    rg.lineTo(256, 128);
    rg.moveTo(128, 0);
    rg.lineTo(128, 256);
    rg.stroke();
    rg.strokeStyle = "rgba(90,240,225,0.9)";
    rg.lineWidth = 3;
    for (const [a0, a1] of [
      [-0.5, 0.5],
      [Math.PI - 0.5, Math.PI + 0.5],
    ]) {
      rg.beginPath();
      rg.arc(128, 128, 112, a0, a1);
      rg.stroke();
    }
    // 렌즈 가장자리 어둡게
    const rv = rg.createRadialGradient(128, 128, 70, 128, 128, 128);
    rv.addColorStop(0, "rgba(0,0,0,0)");
    rv.addColorStop(1, "rgba(0,0,0,0.85)");
    rg.fillStyle = rv;
    rg.fillRect(0, 0, 256, 256);
    const ov = mesh(new THREE.CircleGeometry(0.0196, 40), new THREE.MeshBasicMaterial({ map: tex(rc, { repeat: false }), transparent: true, depthWrite: false }), 0, SY, 0.1508);
    ov.renderOrder = 1;
    const glint = mesh(new THREE.CircleGeometry(0.0196, 40), new THREE.MeshStandardMaterial({ color: 0x8fa6bb, roughness: 0.03, metalness: 1, transparent: true, opacity: 0.22, depthWrite: false }), 0, SY, 0.1511);
    glint.renderOrder = 2;
    glint.material.userData.envK = 2;
    // 노리쇠 손잡이 (오른쪽 뒤)
    this.boltG = new THREE.Group();
    this.boltG.position.set(0.028, 0.012, 0.085);
    G.add(this.boltG);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.06, 12), mSteel);
    arm.rotation.z = Math.PI / 2 + 0.55;
    arm.position.set(0.024, -0.016, 0);
    this.boltG.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 20, 14), mBlackRough);
    knob.position.set(0.05, -0.034, 0);
    knob.scale.set(1, 1, 1.25);
    this.boltG.add(knob);
    // 탄창 · 방아쇠울
    mesh(roundBox(0.042, 0.085, 0.09, 0.006), mPoly, 0, -0.07, -0.02);
    mesh(roundBox(0.048, 0.012, 0.1, 0.004), mBlackRough, 0, -0.114, -0.02);
    const tg = new THREE.TorusGeometry(0.026, 0.004, 8, 20, Math.PI);
    mesh(tg, mBlackRough, 0, -0.045, 0.075, 0, Math.PI / 2, Math.PI);
    mesh(new THREE.BoxGeometry(0.006, 0.026, 0.006), mSteel, 0, -0.056, 0.075, 0.25, 0, 0);
    // 접힌 양각대
    mesh(roundBox(0.03, 0.02, 0.04, 0.005), mBlack, 0, -0.045, -0.47);
    for (const sd of [-1, 1]) mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.24, 10), mBlackRough, sd * 0.012, -0.052, -0.35, Math.PI / 2, 0, 0);

    /* 손 · 팔 */
    const glove = fabric(11, "#2b2c2a", "#5a5242");
    const sleeve = fabric(13, "#44473f", null);
    const mGlove = new THREE.MeshStandardMaterial({ map: glove.map, normalMap: glove.normal, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.85, metalness: 0 });
    const mSleeve = new THREE.MeshStandardMaterial({ map: sleeve.map, normalMap: sleeve.normal, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.95, metalness: 0 });
    const mCuff = new THREE.MeshStandardMaterial({ color: 0x2a2b28, roughness: 0.75 });
    const cap = (len, rad) => new THREE.CapsuleGeometry(rad, len, 4, 12);
    // 오른손: 손잡이를 감쌈 (손등이 보임)
    const RH = new THREE.Group();
    RH.position.set(0.0, -0.12, 0.122);
    RH.rotation.set(-0.38, 0, 0);
    G.add(RH);
    const palm = new THREE.Mesh(roundBox(0.03, 0.092, 0.082, 0.014), mGlove);
    palm.position.set(0.04, 0.0, 0.012);
    RH.add(palm);
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Group();
      f.position.set(0.035, 0.032 - k * 0.022, -0.026);
      RH.add(f);
      const a = new THREE.Mesh(cap(0.026, 0.0105), mGlove);
      a.rotation.set(0, 0, Math.PI / 2);
      a.position.set(-0.012, 0, -0.012);
      a.rotation.y = 0.9;
      f.add(a);
      const b = new THREE.Mesh(cap(0.024, 0.0098), mGlove);
      b.rotation.set(0, 0, Math.PI / 2);
      b.position.set(-0.038, 0, -0.03);
      b.rotation.y = -0.15;
      f.add(b);
    }
    const thumb = new THREE.Mesh(cap(0.05, 0.0115), mGlove);
    thumb.position.set(-0.02, 0.055, 0.0);
    thumb.rotation.set(0.3, 0, 1.25);
    RH.add(thumb);
    const knuck = new THREE.Mesh(roundBox(0.018, 0.08, 0.034, 0.008), new THREE.MeshStandardMaterial({ color: 0x4a4337, roughness: 0.7 }));
    knuck.position.set(0.054, -0.006, -0.012);
    RH.add(knuck);
    const cuffR = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.05, 20), mCuff);
    cuffR.position.set(0.05, -0.02, 0.07);
    cuffR.rotation.set(Math.PI / 2 - 0.35, 0, -0.35);
    RH.add(cuffR);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.42, 22), mSleeve);
    armR.position.set(0.12, -0.1, 0.26);
    armR.rotation.set(Math.PI / 2 - 0.42, 0, -0.42);
    RH.add(armR);
    // 왼손: 총열덮개 아래를 받침 (손바닥 아래 · 엄지 왼쪽 · 손가락 오른쪽)
    const LH = new THREE.Group();
    LH.position.set(0.0, -0.047, -0.29);
    G.add(LH);
    const mPad = new THREE.MeshStandardMaterial({ color: 0x4d4739, roughness: 0.72 });
    const lpalm = new THREE.Mesh(roundBox(0.09, 0.032, 0.096, 0.014), mGlove);
    lpalm.position.set(-0.004, -0.006, 0.004);
    LH.add(lpalm);
    const lk = new THREE.Mesh(roundBox(0.066, 0.012, 0.074, 0.005), mPad);
    lk.position.set(-0.006, -0.024, 0.004);
    LH.add(lk);
    for (let k = 0; k < 3; k++) {
      const pad = new THREE.Mesh(roundBox(0.018, 0.008, 0.02, 0.003), mPad);
      pad.position.set(-0.028 + k * 0.024, -0.031, -0.012);
      LH.add(pad);
    }
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(cap(0.034, 0.0102), mGlove);
      f.position.set(0.044, 0.018, 0.034 - k * 0.0225);
      f.rotation.set(0, 0, -0.4);
      LH.add(f);
      const tip = new THREE.Mesh(cap(0.016, 0.0098), mGlove);
      tip.position.set(0.04, 0.05, 0.034 - k * 0.0225);
      tip.rotation.set(0, 0, 0.5);
      LH.add(tip);
    }
    const lthumb = new THREE.Mesh(cap(0.05, 0.0118), mGlove);
    lthumb.position.set(-0.041, 0.018, -0.006);
    lthumb.rotation.set(0.55, 0, 0.25);
    LH.add(lthumb);
    const thb = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 12), mGlove);
    thb.position.set(-0.042, -0.006, 0.03);
    thb.scale.set(0.9, 1, 1.3);
    LH.add(thb);
    // 손목 끈 · 소매 (점 두 개를 이어 만든 팔)
    const limb = (ax, ay, az, bx, by, bz, ra, rb, mat) => {
      const A = new THREE.Vector3(ax, ay, az);
      const Bv = new THREE.Vector3(bx, by, bz);
      const len = A.distanceTo(Bv);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(ra, rb, len, 24, 6), mat);
      m.position.copy(A).add(Bv).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), A.clone().sub(Bv).normalize());
      // 주름: 굵기를 들쭉날쭉
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 1 + Math.sin(p.getY(i) * 46 + Math.atan2(p.getX(i), p.getZ(i)) * 2) * 0.035;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
      }
      m.geometry.computeVertexNormals();
      LH.add(m);
      return m;
    };
    limb(-0.016, -0.03, 0.05, -0.05, -0.05, 0.1, 0.034, 0.04, mCuff); // 장갑 손목
    limb(-0.05, -0.05, 0.1, -0.062, -0.059, 0.112, 0.0415, 0.0425, mPad); // 끈
    limb(-0.062, -0.059, 0.112, -0.42, -0.14, 0.32, 0.043, 0.058, mSleeve); // 아래팔
    limb(-0.42, -0.14, 0.32, -0.78, -0.2, 0.46, 0.058, 0.07, mSleeve);
    // 오른손 팔은 화면 밖 (손잡이 쪽만)

    // 총구 불꽃
    this.flash = glow(0xffc070, 0.45, 0);
    this.flash.position.set(0, 0, -0.98);
    G.add(this.flash);
    this.flash2 = glow(0xfff0c0, 0.22, 0);
    this.flash2.position.set(0, 0, -0.93);
    G.add(this.flash2);
    G.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    this.SY = SY;
  }

  /** 접안렌즈에 확대 화면 비추기 */
  setLens(texture) {
    if (texture) {
      this.mEye.map = texture;
      this.mEye.color.set(this.lensTint);
    } else {
      this.mEye.map = null;
      this.mEye.color.set(0x0a0f18);
    }
    this.mEye.needsUpdate = true;
  }

  fire() {
    this.kick = 1;
    this.flashT = 0.06;
  }
  cycle() {
    this.bolt = 1;
  }

  /** look: 이번 프레임 고개 돌린 양(라디안) · ads: 0 → 1 (스코프에 눈 대기) */
  update(dt, look = { dx: 0, dy: 0 }, ads = 0, breath = 1) {
    this.t += dt;
    this.ads = ads;
    this.e.vmAds = ads;
    if (this.e.lensOn && !this.mEye.map) this.setLens(this.e.rtLens.texture);
    // 고개 돌릴 때 총이 살짝 늦게 따라옴
    this.lagX = lerp(this.lagX, clamp(-look.dx * 2.2, -0.08, 0.08), Math.min(1, dt * 10));
    this.lagY = lerp(this.lagY, clamp(look.dy * 2.2, -0.08, 0.08), Math.min(1, dt * 10));
    this.kick = Math.max(0, this.kick - dt * 3.2);
    this.bolt = Math.max(0, this.bolt - dt * 1.0);
    this.flashT = Math.max(0, this.flashT - dt);
    const k = this.kick * this.kick;
    const bob = Math.sin(this.t * 1.7) * 0.0035 * breath;
    const bob2 = Math.sin(this.t * 0.9 + 1) * 0.0025 * breath;
    // 쉬는 자세 (오른쪽 아래 · 총구가 화면 가운데 왼쪽을 향함)
    const rest = { x: 0.215, y: -0.158, z: -0.6, ry: 0.42, rx: 0.075, rz: -0.09 };
    // 조준 자세 (눈이 접안렌즈에)
    const aim = { x: 0, y: -this.SY, z: -0.22, ry: 0, rx: 0, rz: 0 };
    const a = ads * ads * (3 - 2 * ads);
    const R = this.root;
    R.position.set(lerp(rest.x, aim.x, a) + this.lagX * 0.6 + bob2, lerp(rest.y, aim.y, a) + bob + this.lagY * 0.4 + k * 0.012, lerp(rest.z, aim.z, a) + k * 0.07);
    R.rotation.set(lerp(rest.rx, aim.rx, a) + k * 0.16 + this.lagY, lerp(rest.ry, aim.ry, a) + this.lagX, lerp(rest.rz, aim.rz, a) - k * 0.03);
    // 노리쇠: 들고 → 당기고 → 밀고 → 내림
    const b = this.bolt;
    const up = b > 0.75 ? (1 - b) / 0.25 : b > 0.25 ? 1 : b / 0.25;
    const back = b > 0.6 && b < 0.85 ? 1 - Math.abs(b - 0.725) / 0.125 : 0;
    this.boltG.rotation.z = up * 1.1;
    this.boltG.position.z = 0.085 + back * 0.09;
    // 불꽃
    const f = this.flashT > 0 ? 1 : 0;
    this.flash.material.opacity = f * 0.95;
    this.flash2.material.opacity = f;
    this.flash.material.rotation = Math.random() * 6;
  }
}
