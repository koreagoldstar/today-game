/*
 * 선수: 관절로 움직이는 3D 인형 (앞이 +z · 왼쪽이 +x)
 *  엉덩이가 기준점이고, 다리 · 팔 · 몸통을 관절 각도로 움직인다.
 *  x 회전: 다리 · 팔은 음수면 앞으로, 무릎은 양수면 굽음, 몸통은 양수면 앞으로 숙임
 */
import { THREE, std, canvas, tex } from "../../oneshot-elite/js/kit.js";

const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const v1 = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

const CYL = new Map();
function cyl(rt, rb, h, seg = 10) {
  const key = `${rt}:${rb}:${h}`;
  if (!CYL.has(key)) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    g.translate(0, -h / 2, 0);
    CYL.set(key, g);
  }
  return CYL.get(key);
}
const SPH = new THREE.SphereGeometry(1, 16, 12);

function faceTexture(skin, hair, cheek) {
  const c = canvas(256, 128);
  const g = c.getContext("2d");
  g.fillStyle = skin;
  g.fillRect(0, 0, 256, 128);
  // 구의 앞쪽이 그림 가운데쯤 오도록 (u=0.25 가 +z 쪽)
  const cx = 64;
  g.fillStyle = cheek;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.ellipse(cx - 21, 74, 7, 4, 0, 0, 6.3);
  g.ellipse(cx + 21, 74, 7, 4, 0, 0, 6.3);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = "#20222c";
  g.beginPath();
  g.ellipse(cx - 13, 60, 4, 5.5, 0, 0, 6.3);
  g.ellipse(cx + 13, 60, 4, 5.5, 0, 0, 6.3);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(cx - 11.6, 58, 1.5, 0, 6.3);
  g.arc(cx + 14.4, 58, 1.5, 0, 6.3);
  g.fill();
  g.strokeStyle = hair;
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx - 20, 49);
  g.lineTo(cx - 8, 50);
  g.moveTo(cx + 8, 50);
  g.lineTo(cx + 20, 49);
  g.stroke();
  g.strokeStyle = "#9c4c3c";
  g.lineWidth = 2.4;
  g.beginPath();
  g.arc(cx, 76, 7, 0.2, Math.PI - 0.2);
  g.stroke();
  return tex(c, { repeat: false });
}
function numberTexture(n, color) {
  const c = canvas(128, 128);
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = color;
  g.font = "900 96px Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), 64, 70);
  return tex(c, { repeat: false });
}

export const KITS = {
  korea: { shirt: 0xf4f6f4, trim: 0xd23a35, shorts: 0x1f2f55, socks: 0xf4f6f4, shoes: 0xe5352e, number: "#1f2f55" },
  keeper: { shirt: 0xf7cf2a, trim: 0x2a3f7c, shorts: 0x1f2f55, socks: 0xf2f2ec, shoes: 0x1f2f55, number: "#1f2f55", gloves: 0xf4f6f4, long: true },
};

export function makePlayer(kit, look = {}) {
  const skinHex = look.skin || 0xe5b48f;
  const hairHex = look.hair || 0x17151a;
  const M = {
    shirt: std({ color: kit.shirt, roughness: 0.75 }),
    trim: std({ color: kit.trim, roughness: 0.75 }),
    shorts: std({ color: kit.shorts, roughness: 0.8 }),
    socks: std({ color: kit.socks, roughness: 0.8 }),
    shoes: std({ color: kit.shoes, roughness: 0.45 }),
    skin: std({ color: skinHex, roughness: 0.65 }),
    hair: std({ color: hairHex, roughness: 0.7 }),
    glove: std({ color: kit.gloves || skinHex, roughness: 0.6 }),
  };
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
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

  // 엉덩이 · 배 · 가슴
  mesh(SPH, M.shorts, root, 0, 0.01, 0, 0.175, 0.14, 0.13);
  mesh(cyl(0.158, 0.165, 0.05, 18), M.shorts, root, 0, 0.12, 0, 1, 1, 0.72);
  mesh(cyl(0.175, 0.15, 0.25), M.shirt, j.chest, 0, 0.24, 0, 1, 1, 0.68);
  mesh(SPH, M.shirt, j.chest, 0, 0.235, 0, 0.2, 0.075, 0.125);
  mesh(cyl(0.15, 0.15, 0.24), M.shirt, j.spine, 0, 0.21, 0, 1, 1, 0.68);
  mesh(cyl(0.05, 0.055, 0.08), M.skin, j.neck, 0, 0.07, 0);
  mesh(cyl(0.068, 0.075, 0.03, 12), M.trim, j.chest, 0, 0.3, 0);

  // 머리
  const faceTex = faceTexture(`#${M.skin.color.getHexString()}`, `#${M.hair.color.getHexString()}`, "#ef7f6f");
  const headMesh = mesh(SPH, new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.65 }), j.head, 0, 0.13, 0.002, 0.118, 0.135, 0.125);
  mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), M.hair, j.head, 0, 0.158, -0.012, 0.127, 0.128, 0.132);
  mesh(SPH, M.hair, j.head, 0, 0.13, -0.055, 0.116, 0.118, 0.09);
  mesh(SPH, M.skin, j.head, 0.118, 0.125, 0, 0.018, 0.03, 0.02);
  mesh(SPH, M.skin, j.head, -0.118, 0.125, 0, 0.018, 0.03, 0.02);

  // 팔 (character 왼쪽이 +x)
  for (const [s, side] of [
    ["L", 1],
    ["R", -1],
  ]) {
    const arm = joint(j.chest, side * 0.2, 0.225, 0);
    mesh(SPH, M.shirt, arm, 0, 0, 0, 0.068, 0.068, 0.068);
    mesh(cyl(0.055, 0.045, 0.27), M.shirt, arm, 0, 0, 0);
    if (!kit.long) mesh(cyl(0.05, 0.049, 0.018), M.trim, arm, 0, -0.15, 0);
    const fore = joint(arm, 0, -0.27, 0);
    mesh(SPH, kit.long ? M.shirt : M.skin, fore, 0, 0, 0, 0.046, 0.046, 0.046);
    mesh(cyl(0.044, 0.034, 0.24), kit.long ? M.shirt : M.skin, fore, 0, 0, 0);
    const hand = joint(fore, 0, -0.25, 0);
    if (kit.gloves) {
      mesh(SPH, M.glove, hand, 0, -0.045, 0, 0.066, 0.085, 0.042);
      mesh(cyl(0.04, 0.044, 0.04), new THREE.MeshStandardMaterial({ color: kit.trim, roughness: 0.6 }), hand, 0, 0.015, 0);
    } else {
      mesh(SPH, M.skin, hand, 0, -0.03, 0, 0.04, 0.052, 0.03);
    }
    j[`arm${s}`] = arm;
    j[`fore${s}`] = fore;
    j[`hand${s}`] = hand;

    const leg = joint(root, side * 0.09, -0.04, 0);
    mesh(cyl(0.1, 0.095, 0.27), M.shorts, leg, 0, 0, 0);
    mesh(cyl(0.07, 0.06, 0.2), M.skin, leg, 0, -0.25, 0);
    const shin = joint(leg, 0, -0.43, 0);
    mesh(SPH, M.skin, shin, 0, 0, 0, 0.062, 0.062, 0.062);
    mesh(cyl(0.06, 0.042, 0.37), M.socks, shin, 0, -0.02, 0);
    mesh(cyl(0.061, 0.058, 0.03), M.trim, shin, 0, -0.06, 0);
    const foot = joint(shin, 0, -0.42, 0);
    mesh(SPH, M.shoes, foot, 0, -0.022, 0.05, 0.052, 0.038, 0.125);
    j[`leg${s}`] = leg;
    j[`shin${s}`] = shin;
    j[`foot${s}`] = foot;
  }

  // 등번호 (등에 붙임)
  let numTex = numberTexture(look.number || 10, kit.number);
  const numMat = new THREE.MeshStandardMaterial({ map: numTex, transparent: true, roughness: 0.8, depthWrite: false });
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), numMat);
  num.position.set(0, 0.11, -0.112);
  num.rotation.y = Math.PI;
  j.chest.add(num);

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
  return {
    root,
    j,
    M,
    kit,
    headMesh,
    hipY,
    setKit(k, n) {
      this.kit = k;
      M.shirt.color.set(k.shirt);
      M.trim.color.set(k.trim);
      M.shorts.color.set(k.shorts);
      M.socks.color.set(k.socks);
      M.shoes.color.set(k.shoes);
      if (k.gloves) M.glove.color.set(k.gloves);
      if (n != null) this.setNumber(n, k.number);
    },
    setNumber(n, color) {
      numTex.dispose();
      numTex = numberTexture(n, color || this.kit.number);
      numMat.map = numTex;
      numMat.needsUpdate = true;
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
