/*
 * 적 · 보스 3D 모델 (모두 코드로 조립 — 외부 파일 없음)
 *  MODELS[종류](root) → anim(o) : 매 프레임 o = { t, dt, e(시뮬 적), v(속도), state, k(걸음 위상) }
 *  모델은 키가 약 1 이 되도록 만들고, 그리는 쪽에서 적 크기(size)만큼 키운다. 앞쪽은 +z.
 *  월드마다 실루엣 · 재질 · 걸음 · 공격(능력) 동작이 다르게.
 */
import { part, group, eyes, mat, mouth, cheeks } from "./kit.js";

const S = Math.sin;
const C = Math.cos;
const lerp = (a, b, k) => a + (b - a) * k;

/* ---------- 공통 동작 ---------- */
function legsSwing(legs, k, amp = 0.6) {
  legs.forEach((l, i) => (l.rotation.x = S(k + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * amp));
}
function flap(wings, t, rate = 14, amp = 0.9, base = 0.2) {
  const a = S(t * rate) * amp;
  wings[0].rotation.z = base + a;
  wings[1].rotation.z = -base - a;
}
function wingPair(parent, color, { y = 0.5, x = 0.12, size = 0.7, o = {} } = {}) {
  const L = group(parent, { p: [-x, y, 0] });
  const R = group(parent, { p: [x, y, 0] });
  part(L, "wing", [], color, { s: [-size, size, size], r: [-Math.PI / 2, 0, 0], o: { side: true, ...o } });
  part(R, "wing", [], color, { s: [size, size, size], r: [-Math.PI / 2, 0, 0], o: { side: true, ...o } });
  return [L, R];
}
const quadLegs = (parent, color, w = 0.18, l = 0.22, h = 0.28, r = 0.06) =>
  [
    [-w, l],
    [w, l],
    [-w, -l],
    [w, -l],
  ].map(([x, z]) => {
    const g = group(parent, { p: [x, h, z] });
    part(g, "capsule", [r, h * 0.7], color, { p: [0, -h * 0.5, 0] });
    return g;
  });

export const MODELS = {
  /* =================== 공통 =================== */
  slime(root) {
    const body = group(root);
    // 윤기 나는 젤리 몸 (아래가 살짝 퍼짐) + 꼭지 + 바닥 웅덩이
    part(body, "sphere", [0.5, 24, 18], 0x52d064, { p: [0, 0.4, 0], s: [1.06, 0.82, 1.06], o: { rough: 0.16 } });
    part(body, "sphere", [0.15, 12, 10], 0x52d064, { p: [0.06, 0.84, -0.06], s: [0.9, 1.25, 0.9], r: [0, 0, -0.35], o: { rough: 0.16 } });
    part(body, "cyl", [0.5, 0.58, 0.07, 24], 0x3fb456, { p: [0, 0.04, 0], o: { rough: 0.2 }, outline: false });
    part(body, "sphere", [0.15, 10, 8], 0xffffff, { p: [-0.22, 0.6, 0.26], s: [1, 0.7, 0.5], r: [0, 0, 0.5], o: { flat: true, opacity: 0.75 }, shadow: false });
    part(body, "sphere", [0.05, 8, 6], 0xffffff, { p: [-0.08, 0.72, 0.32], o: { flat: true, opacity: 0.85 }, shadow: false });
    eyes(body, { y: 0.47, z: 0.47, x: 0.16, r: 0.085 });
    mouth(body, { y: 0.32, z: 0.52, w: 0.06 });
    cheeks(body, { x: 0.29, y: 0.35, z: 0.45, r: 0.065 });
    return (o) => {
      const b = Math.abs(S(o.k * 1.2));
      body.scale.set(1 + b * 0.12, 1 - b * 0.18, 1 + b * 0.12);
      body.position.y = b * 0.14;
    };
  },
  fox(root) {
    const O = 0xff8a3a;
    const W = 0xfff4e6;
    const body = group(root, { p: [0, 0.36, 0] });
    part(body, "capsule", [0.19, 0.3], O, { r: [Math.PI / 2, 0, 0] });
    part(body, "sphere", [0.16, 12, 10], W, { p: [0, -0.06, 0.16], s: [0.85, 0.8, 1.1] });
    const head = group(body, { p: [0, 0.2, 0.34] });
    part(head, "sphere", [0.24, 18, 14], O, { s: [1.06, 0.95, 1] });
    part(head, "sphere", [0.15, 12, 10], W, { p: [0, -0.09, 0.11], s: [1.35, 0.8, 1] });
    part(head, "cone", [0.1, 0.2, 12], O, { p: [0, -0.05, 0.25], r: [Math.PI / 2, 0, 0] });
    part(head, "sphere", [0.045, 8, 6], 0x2a1a12, { p: [0, -0.04, 0.35] });
    for (const sx of [-1, 1]) {
      const ear = group(head, { p: [sx * 0.13, 0.2, -0.02], r: [0, 0, -sx * 0.22] });
      part(ear, "cone", [0.095, 0.26, 10], O, { p: [0, 0.11, 0] });
      part(ear, "cone", [0.05, 0.16, 8], 0x3a2418, { p: [0, 0.08, 0.035] });
    }
    eyes(head, { y: 0.05, z: 0.19, x: 0.1, r: 0.055 });
    const tail = group(body, { p: [0, 0.06, -0.36] });
    part(tail, "sphere", [0.17, 14, 10], O, { p: [0, 0.06, -0.2], s: [0.8, 0.8, 1.6], r: [-0.35, 0, 0] });
    part(tail, "sphere", [0.12, 12, 8], W, { p: [0, 0.16, -0.42], s: [0.85, 0.85, 1.2], r: [-0.35, 0, 0] });
    const legs = quadLegs(root, 0x5a2a18, 0.12, 0.2, 0.27, 0.055);
    return (o) => {
      legsSwing(legs, o.k * 1.6, 0.9);
      body.position.y = 0.36 + Math.abs(S(o.k * 1.6)) * 0.05;
      tail.rotation.y = S(o.t * 6) * 0.4;
      head.rotation.x = S(o.k * 1.6) * 0.06;
    };
  },
  beetle(root) {
    const body = group(root, { p: [0, 0.3, 0] });
    part(body, "sphere", [0.4, 16, 10], 0x3a4a9e, { s: [1, 0.65, 1.15], name: "shell" });
    part(body, "box", [0.03, 0.2, 0.8], 0x1c2560, { p: [0, 0.22, 0] });
    part(body, "sphere", [0.2, 12, 8], 0x22284a, { p: [0, -0.02, 0.4] });
    part(body, "cone", [0.06, 0.3, 6], 0xcfd6ff, { p: [0, 0.12, 0.6], r: [1.1, 0, 0] });
    eyes(body, { y: 0.05, z: 0.55, x: 0.08, r: 0.045 });
    const legs = [];
    for (const sx of [-1, 1])
      for (const z of [-0.2, 0.05, 0.3]) {
        const g = group(root, { p: [sx * 0.32, 0.2, z] });
        part(g, "capsule", [0.035, 0.22], 0x1c2246, { r: [0, 0, sx * 1.0] });
        legs.push(g);
      }
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 2 + i) * 0.5));
      body.position.y = 0.3 + S(o.k * 2) * 0.02;
    };
  },

  /* =================== 월드 1 · 햇살 초원 =================== */
  turtle(root) {
    const shell = group(root, { p: [0, 0.3, 0] });
    // 바위 등딱지: 둥근 등 + 각진 돌판 + 이끼
    part(shell, "hemi", [0.46, 20], 0x8f8578, { s: [1.05, 0.95, 1.12], o: { rough: 0.8 } });
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + 0.3;
      part(shell, "dodeca", [0.13, 0], i % 2 ? 0xa59b8b : 0xb3a998, { p: [Math.cos(a) * 0.25, 0.27, Math.sin(a) * 0.27], s: [1, 0.42, 1], r: [0, a, 0], o: { rough: 0.85 } });
    }
    part(shell, "dodeca", [0.16, 0], 0xbcb2a0, { p: [0, 0.41, 0], s: [1, 0.5, 1], o: { rough: 0.85 } });
    part(shell, "sphere", [0.1, 8, 6], 0x86c257, { p: [-0.2, 0.33, 0.12], s: [1, 0.45, 1] });
    part(shell, "sphere", [0.08, 8, 6], 0x9ad46a, { p: [0.18, 0.36, -0.15], s: [1, 0.45, 1] });
    part(shell, "torus", [0.47, 0.06, 8, 28], 0x6a6054, { r: [Math.PI / 2, 0, 0], s: [1.05, 1.12, 1] });
    part(shell, "cyl", [0.44, 0.4, 0.08, 22], 0xdcca8e, { p: [0, -0.06, 0], s: [1.05, 1, 1.12] });
    const head = group(root, { p: [0, 0.32, 0.46] });
    part(head, "sphere", [0.19, 16, 12], 0x7cc95a, { s: [1, 0.92, 1.05] });
    eyes(head, { y: 0.05, z: 0.14, x: 0.085, r: 0.045 });
    mouth(head, { y: -0.05, z: 0.17, w: 0.04 });
    cheeks(head, { x: 0.12, y: -0.02, z: 0.12, r: 0.035 });
    const legs = quadLegs(root, 0x6db04d, 0.28, 0.25, 0.2, 0.085);
    return (o) => {
      const hide = o.state === "defend" ? 1 : 0;
      o.m.hide = lerp(o.m.hide || 0, hide, Math.min(1, o.dt * 10));
      const h = 1 - o.m.hide;
      head.scale.setScalar(Math.max(0.01, h));
      head.position.z = 0.29 + 0.17 * h;
      head.position.y = 0.32 + S(o.k * 2) * 0.015;
      legs.forEach((l) => l.scale.setScalar(Math.max(0.01, h)));
      shell.position.y = 0.3 - 0.12 * o.m.hide;
      legsSwing(legs, o.k, 0.35 * h);
      shell.rotation.z = S(o.k) * 0.05 * h;
    };
  },
  mole(root) {
    const body = group(root, { p: [0, 0.3, 0] });
    part(body, "sphere", [0.34, 18, 14], 0x7a5038, { s: [1, 0.95, 1.1] });
    part(body, "sphere", [0.22, 14, 10], 0xdcb896, { p: [0, -0.07, 0.2], s: [1, 0.85, 0.8] });
    part(body, "sphere", [0.075, 10, 8], 0xff8aa8, { p: [0, 0.05, 0.4] });
    // 광부 고글 + 안전모 (불빛)
    for (const sx of [-1, 1]) {
      part(body, "torus", [0.075, 0.026, 6, 16], 0x3a3a48, { p: [sx * 0.105, 0.17, 0.3], r: [0, sx * 0.3, 0] });
      part(body, "sphere", [0.066, 10, 8], 0x8fd8ff, { p: [sx * 0.105, 0.17, 0.3], s: [1, 1, 0.45], r: [0, sx * 0.3, 0], o: { rough: 0.1 } });
      part(body, "sphere", [0.02, 6, 4], 0xffffff, { p: [sx * 0.105 + 0.02, 0.19, 0.33], o: { flat: true }, shadow: false });
    }
    part(body, "hemi", [0.23, 16], 0xffc83a, { p: [0, 0.26, 0.0], o: { rough: 0.35 } });
    part(body, "cyl", [0.27, 0.27, 0.035, 18], 0xf2b02a, { p: [0, 0.265, 0.03] });
    part(body, "sphere", [0.055, 8, 6], 0xfff6c0, { p: [0, 0.38, 0.19], o: { emissive: 0xffe080, ei: 1.2 }, shadow: false });
    mouth(body, { y: -0.03, z: 0.37, w: 0.045, teeth: true });
    const claws = [-1, 1].map((sx) => {
      const g = group(body, { p: [sx * 0.3, -0.12, 0.22] });
      part(g, "sphere", [0.08, 10, 8], 0xdcb896, { s: [1, 0.7, 1] });
      for (let i = -1; i <= 1; i++) part(g, "cone", [0.03, 0.15, 6], 0xfff4e0, { p: [i * 0.045, 0, 0.07], r: [1.3, 0, 0] });
      return g;
    });
    const mound = group(root);
    part(mound, "hemi", [0.46, 16], 0x9a7a52, { s: [1, 0.55, 1], o: { rough: 0.9 } });
    for (let i = 0; i < 6; i++) part(mound, "dodeca", [0.08, 0], 0x7a5e3e, { p: [S(i * 1.1) * 0.38, 0.05, C(i * 1.1) * 0.38] });
    mound.visible = false;
    return (o) => {
      const st = o.state;
      const under = st === "burrow";
      mound.visible = st === "burrowWarn" || under || st === "emerge";
      mound.scale.setScalar(st === "burrowWarn" ? 0.6 + 0.4 * Math.abs(S(o.t * 20)) : 1);
      body.visible = !under;
      body.position.y = st === "emerge" ? 0.1 + 0.2 * Math.abs(S(o.t * 10)) : st === "burrowWarn" ? 0.18 : 0.3 + Math.abs(S(o.k * 1.4)) * 0.04;
      claws.forEach((c, i) => (c.rotation.x = S(o.k * 1.4 + i * Math.PI) * 0.5 + (st === "burrowWarn" ? S(o.t * 30) * 0.6 : 0)));
    };
  },
  bat(root) {
    const body = group(root, { p: [0, 0.5, 0] });
    part(body, "sphere", [0.24, 16, 12], 0x6a4a9e, { s: [1, 1.08, 0.95] });
    part(body, "sphere", [0.15, 12, 10], 0xb89ad8, { p: [0, -0.07, 0.13], s: [1, 1, 0.6] });
    part(body, "box", [0.47, 0.09, 0.06], 0x1c1430, { p: [0, 0.08, 0.2] });
    eyes(body, { y: 0.08, z: 0.22, x: 0.085, r: 0.045, angry: true });
    mouth(body, { y: -0.05, z: 0.22, w: 0.045, teeth: true });
    for (const sx of [-1, 1]) {
      const ear = group(body, { p: [sx * 0.12, 0.22, 0], r: [0, 0, -sx * 0.35] });
      part(ear, "cone", [0.085, 0.24, 8], 0x6a4a9e, { p: [0, 0.1, 0] });
      part(ear, "cone", [0.045, 0.15, 6], 0xff9ac8, { p: [0, 0.08, 0.03] });
    }
    const bag = part(body, "sphere", [0.11, 12, 10], 0xd8b65a, { p: [0, -0.28, 0.05] });
    part(bag, "torus", [0.055, 0.016, 6, 12], 0x8a6a2a, { p: [0, 0.08, 0], r: [Math.PI / 2, 0, 0] });
    part(bag, "cyl", [0.04, 0.04, 0.012, 10], 0xffd34d, { p: [0.02, 0.1, 0.03], r: [0.6, 0, 0.3], o: { emissive: 0xffb03a, ei: 0.5 } });
    const wings = wingPair(body, 0x3a2460, { y: 0.04, x: 0.16, size: 0.72 });
    return (o) => {
      flap(wings, o.t, 18, 0.9);
      body.position.y = 0.5 + S(o.t * 9) * 0.06;
      body.rotation.z = S(o.k * 0.8) * 0.2;
    };
  },
  shroomSplit(root) {
    const g = group(root);
    part(g, "cyl", [0.2, 0.25, 0.42, 16], 0xfff1dc, { p: [0, 0.21, 0] });
    const cap = group(g, { p: [0, 0.5, 0] });
    part(cap, "sphere", [0.4, 20, 14], 0xe5453a, { s: [1, 0.6, 1], o: { rough: 0.35 } });
    part(cap, "cyl", [0.36, 0.3, 0.06, 18], 0xffe6d0, { p: [0, -0.02, 0] });
    for (const [x, y, z, r] of [[0.15, 0.2, 0.15, 0.075], [-0.2, 0.15, 0.05, 0.085], [0.05, 0.24, -0.18, 0.065], [0.25, 0.08, -0.12, 0.055], [-0.1, 0.12, 0.28, 0.055], [-0.22, 0.06, -0.2, 0.05]]) part(cap, "sphere", [r, 10, 8], 0xffffff, { p: [x, y, z], s: [1, 0.5, 1], shadow: false });
    eyes(g, { y: 0.26, z: 0.22, x: 0.085, r: 0.05 });
    mouth(g, { y: 0.15, z: 0.24, w: 0.045 });
    cheeks(g, { x: 0.15, y: 0.18, z: 0.2, r: 0.04 });
    return (o) => {
      const b = Math.abs(S(o.k * 1.3));
      g.scale.set(1 + b * 0.06, 1 - b * 0.08, 1 + b * 0.06);
      cap.rotation.z = S(o.k * 1.3) * 0.12;
    };
  },
  sprout(root) {
    const g = group(root);
    part(g, "cyl", [0.13, 0.16, 0.26, 12], 0xfff1dc, { p: [0, 0.13, 0] });
    part(g, "sphere", [0.26, 16, 12], 0xff7a5a, { p: [0, 0.34, 0], s: [1, 0.62, 1], o: { rough: 0.35 } });
    for (let i = 0; i < 4; i++) part(g, "sphere", [0.04, 8, 6], 0xffffff, { p: [Math.cos(i * 1.6) * 0.14, 0.43, Math.sin(i * 1.6) * 0.14], s: [1, 0.5, 1], shadow: false });
    part(g, "leaf", [], 0x6fcf4a, { p: [0, 0.46, 0], s: 0.3, r: [0, 0, -0.4], o: { side: true } });
    eyes(g, { y: 0.17, z: 0.14, x: 0.06, r: 0.035 });
    cheeks(g, { x: 0.1, y: 0.12, z: 0.13, r: 0.03 });
    return (o) => {
      g.position.y = Math.abs(S(o.k * 2)) * 0.08;
    };
  },
  boar(root) {
    const body = group(root, { p: [0, 0.4, 0] });
    const ARM = { rough: 0.32, metal: 0.55 };
    part(body, "sphere", [0.38, 20, 14], 0x8a5a3a, { s: [0.95, 0.88, 1.25] });
    for (let i = 0; i < 3; i++) {
      part(body, "hemi", [0.3, 18], 0xa8b0c4, { p: [0, 0.18, -0.24 + i * 0.22], s: [1.18, 0.6, 0.64], o: ARM });
      for (const sx of [-1, 1]) part(body, "sphere", [0.025, 6, 4], 0xe6e8f0, { p: [sx * 0.3, 0.2, -0.24 + i * 0.22], o: ARM, shadow: false });
    }
    for (let i = 0; i < 5; i++) part(body, "cone", [0.045, 0.17, 5], 0x4a2a18, { p: [0, 0.44, -0.36 + i * 0.15], r: [-0.35, 0, 0] });
    const head = group(body, { p: [0, 0.04, 0.46] });
    part(head, "sphere", [0.26, 18, 14], 0x8a5a3a);
    part(head, "hemi", [0.25, 16], 0xa8b0c4, { p: [0, 0.07, -0.03], s: [1.06, 0.62, 1], o: ARM });
    part(head, "cyl", [0.11, 0.13, 0.13, 16], 0xe8a08a, { p: [0, -0.05, 0.25], r: [Math.PI / 2, 0, 0] });
    for (const sx of [-1, 1]) {
      part(head, "sphere", [0.024, 6, 4], 0x5a2a22, { p: [sx * 0.04, -0.05, 0.32], shadow: false });
      part(head, "cone", [0.036, 0.21, 6], 0xfff8e8, { p: [sx * 0.11, -0.08, 0.24], r: [-0.9, 0, sx * 0.35] });
      part(head, "cone", [0.06, 0.13, 6], 0x8a5a3a, { p: [sx * 0.17, 0.19, -0.05], r: [0, 0, -sx * 0.5] });
    }
    eyes(head, { y: 0.06, z: 0.19, x: 0.1, r: 0.045, angry: true });
    const legs = quadLegs(root, 0x5a3a22, 0.19, 0.25, 0.27, 0.08);
    return (o) => {
      const st = o.state;
      const r = st === "charge" ? 2.4 : 1.2;
      legsSwing(legs, o.k * r, st === "charge" ? 1 : 0.6);
      body.rotation.x = st === "charge" ? 0.25 : st === "chargeWarn" ? -0.15 : 0;
      if (st === "chargeWarn") {
        legs[0].rotation.x = S(o.t * 30) * 0.8;
        body.position.x = S(o.t * 40) * 0.03;
      } else body.position.x = 0;
    };
  },
  featherHealer(root) {
    const body = group(root, { p: [0, 0.32, 0] });
    part(body, "sphere", [0.3, 18, 14], 0xf6f2ea, { s: [1, 1.05, 1] });
    part(body, "sphere", [0.18, 12, 10], 0xfff8ee, { p: [0, -0.06, 0.16], s: [1, 1, 0.6] });
    part(body, "cone", [0.06, 0.13, 8], 0xffb03a, { p: [0, 0.1, 0.31], r: [Math.PI / 2, 0, 0] });
    eyes(body, { y: 0.19, z: 0.24, x: 0.1, r: 0.05 });
    cheeks(body, { x: 0.18, y: 0.08, z: 0.22, r: 0.045 });
    part(body, "leaf", [], 0x7ad1e8, { p: [0, 0.3, -0.02], s: 0.45, r: [0, 0, 0.3], o: { side: true } });
    part(body, "leaf", [], 0xffd34d, { p: [0.04, 0.3, -0.04], s: 0.35, r: [0, 0, -0.2], o: { side: true } });
    part(body, "torus", [0.12, 0.02, 6, 16], 0x5aff8a, { p: [0, 0.42, 0], r: [Math.PI / 2, 0, 0], o: { emissive: 0x2aff6a, ei: 0.8 }, shadow: false });
    const staff = group(body, { p: [0.3, -0.05, 0.1] });
    part(staff, "cyl", [0.025, 0.025, 0.6, 6], 0x8a6a3a, { p: [0, 0.15, 0] });
    const orb = part(staff, "sphere", [0.09, 12, 10], 0x8affb0, { p: [0, 0.48, 0], o: { emissive: 0x4aff8a, ei: 1.2 } });
    const wings = [-1, 1].map((sx) => part(body, "sphere", [0.14, 10, 8], 0xe6ddd0, { p: [sx * 0.27, 0, -0.04], s: [0.4, 0.8, 1] }));
    return (o) => {
      body.position.y = 0.32 + Math.abs(S(o.k * 1.5)) * 0.05;
      wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (0.2 + Math.abs(S(o.t * 6)) * 0.3)));
      const glow = o.m.healT > 0 ? 1 : 0;
      orb.scale.setScalar(1 + glow * 0.6 + S(o.t * 5) * 0.08);
      staff.rotation.z = glow ? -0.5 : 0;
    };
  },

  /* =================== 월드 2 · 버섯 숲 =================== */
  poisonSpore(root) {
    const g = group(root);
    part(g, "cyl", [0.15, 0.2, 0.32, 10], 0xd8d0f0, { p: [0, 0.16, 0] });
    const cap = group(g, { p: [0, 0.42, 0] });
    part(cap, "sphere", [0.38, 14, 10], 0x8a3ac8, { s: [1, 0.55, 1] });
    for (let i = 0; i < 7; i++) part(cap, "sphere", [0.05, 6, 4], 0x9cff5a, { p: [S(i * 0.9) * 0.27, 0.13, C(i * 0.9) * 0.27], o: { emissive: 0x6aff2a, ei: 0.8 }, shadow: false });
    eyes(g, { y: 0.24, z: 0.17, x: 0.07, r: 0.045, angry: true });
    const puffs = [0, 1, 2].map(() => part(g, "sphere", [0.07, 8, 6], 0xb4ff6a, { o: { opacity: 0.6 }, shadow: false }));
    return (o) => {
      puffs.forEach((p, i) => {
        const a = o.t * 1.5 + i * 2.1;
        p.position.set(S(a) * 0.45, 0.4 + ((o.t * 0.4 + i * 0.33) % 1) * 0.5, C(a) * 0.45);
      });
      g.position.y = Math.abs(S(o.k)) * 0.05;
    };
  },
  sporeBomb(root) {
    const g = group(root);
    const sac = part(g, "sphere", [0.34, 14, 10], 0xff9a3a, { p: [0, 0.36, 0], s: [1, 0.9, 1] });
    for (let i = 0; i < 5; i++) part(sac, "sphere", [0.08, 6, 4], 0xb4ff6a, { p: [S(i * 1.25) * 0.3, C(i * 2) * 0.1, C(i * 1.25) * 0.3], o: { emissive: 0x6aff2a, ei: 0.6 }, shadow: false });
    part(g, "cyl", [0.03, 0.05, 0.2, 6], 0x6a4a2a, { p: [0, 0.72, 0] });
    eyes(g, { y: 0.4, z: 0.28, x: 0.1, r: 0.06 });
    const legs = [0, 1, 2, 3].map((i) => {
      const l = group(g, { p: [S(i * 1.57 + 0.8) * 0.2, 0.08, C(i * 1.57 + 0.8) * 0.2] });
      part(l, "sphere", [0.06, 6, 4], 0xd86a26);
      return l;
    });
    return (o) => {
      sac.scale.setScalar(1 + S(o.t * 4) * 0.05);
      legs.forEach((l, i) => (l.position.y = 0.08 + Math.max(0, S(o.k * 2 + i * 1.6)) * 0.06));
    };
  },
  vineCrawler(root) {
    const segs = [];
    for (let i = 0; i < 5; i++) segs.push(part(root, "sphere", [0.17 - i * 0.015, 12, 8], i % 2 ? 0x5fb04a : 0x7cc95a, { p: [0, 0.17, 0.25 - i * 0.18] }));
    const head = segs[0];
    eyes(head, { y: 0.05, z: 0.12, x: 0.07, r: 0.045 });
    part(head, "leaf", [], 0x3d8a2c, { p: [0, 0.12, 0], s: 0.35, r: [0, 0, 0], o: { side: true } });
    const vine = group(root, { p: [0, 0.3, -0.1] });
    for (let i = 0; i < 3; i++) part(vine, "torus", [0.12 + i * 0.03, 0.02, 5, 12, Math.PI * 1.3], 0x3d8a2c, { r: [0, i * 1.2, 0.5], p: [0, i * 0.06, 0] });
    return (o) => {
      segs.forEach((s, i) => {
        s.position.y = 0.17 + Math.max(0, S(o.k * 1.6 - i * 0.8)) * 0.08;
        s.position.x = S(o.k * 0.8 - i * 0.6) * 0.04;
      });
      vine.rotation.y = o.t * (o.m.vineT > 0 ? 6 : 1);
      vine.scale.setScalar(o.m.vineT > 0 ? 1.6 : 1);
    };
  },
  cloner(root) {
    const g = group(root);
    part(g, "cyl", [0.2, 0.28, 0.5, 12], 0x4a6ad8, { p: [0, 0.25, 0] });
    const cap = group(g, { p: [0, 0.6, 0] });
    part(cap, "sphere", [0.34, 14, 10], 0x2ab8e8, { s: [1, 0.5, 1] });
    part(cap, "cone", [0.18, 0.4, 10], 0x2a3a9e, { p: [0, 0.3, 0] });
    part(cap, "sphere", [0.05, 6, 4], 0xffe36a, { p: [0, 0.52, 0], o: { emissive: 0xffd34d, ei: 1 } });
    eyes(g, { y: 0.44, z: 0.2, x: 0.08, r: 0.05 });
    const staff = group(g, { p: [0.28, 0.3, 0.1] });
    part(staff, "cyl", [0.02, 0.02, 0.6, 6], 0x6a4a2a);
    const gem = part(staff, "octa", [0.07, 0], 0x9fe9ff, { p: [0, 0.34, 0], o: { emissive: 0x4ad8ff, ei: 1 } });
    return (o) => {
      gem.rotation.y = o.t * 3;
      const cast = o.m.castT > 0 ? 1 : 0;
      staff.rotation.z = -0.3 * cast;
      gem.scale.setScalar(1 + cast * 0.8);
      g.position.y = Math.abs(S(o.k)) * 0.03;
    };
  },
  miniShroom(root) {
    const g = group(root);
    part(g, "cyl", [0.1, 0.13, 0.2, 8], 0xe8e0ff, { p: [0, 0.1, 0] });
    part(g, "sphere", [0.2, 10, 8], 0xa03ad8, { p: [0, 0.25, 0], s: [1, 0.55, 1] });
    eyes(g, { y: 0.14, z: 0.11, x: 0.05, r: 0.03 });
    return (o) => {
      g.position.y = Math.abs(S(o.k * 2.2)) * 0.07;
    };
  },
  beeHealer(root) {
    const body = group(root, { p: [0, 0.5, 0] });
    part(body, "sphere", [0.22, 12, 10], 0xffd34d, { s: [0.9, 0.9, 1.15] });
    for (const z of [-0.08, 0.06]) part(body, "torus", [0.2, 0.035, 6, 16], 0x2a2a2a, { p: [0, 0, z], s: [0.95, 0.95, 1] });
    part(body, "cone", [0.05, 0.12, 6], 0x2a2a2a, { p: [0, 0, -0.28], r: [-Math.PI / 2, 0, 0] });
    eyes(body, { y: 0.05, z: 0.2, x: 0.08, r: 0.05 });
    for (const sx of [-1, 1]) part(body, "cyl", [0.008, 0.008, 0.14, 4], 0x2a2a2a, { p: [sx * 0.06, 0.24, 0.12], r: [0.5, 0, sx * 0.3] });
    const honey = part(body, "sphere", [0.07, 8, 6], 0xffb03a, { p: [0, -0.2, 0.1], o: { emissive: 0xff9a1a, ei: 0.6, opacity: 0.9 } });
    const wings = wingPair(body, 0xdff6ff, { y: 0.16, x: 0.05, size: 0.4, o: { opacity: 0.6 } });
    return (o) => {
      flap(wings, o.t, 40, 0.6, 0.6);
      body.position.y = 0.5 + S(o.t * 7) * 0.05;
      honey.scale.setScalar(o.m.healT > 0 ? 1.8 : 1);
    };
  },
  shroomKnight(root) {
    const body = group(root, { p: [0, 0.3, 0] });
    part(body, "cyl", [0.3, 0.36, 0.55, 12], 0x7a6a5a, { p: [0, 0.05, 0] });
    part(body, "cyl", [0.33, 0.33, 0.12, 12], 0x9aa3b8, { p: [0, 0.18, 0] });
    const cap = group(body, { p: [0, 0.48, 0] });
    part(cap, "sphere", [0.5, 16, 10], 0x8a5a2a, { s: [1, 0.5, 1] });
    part(cap, "torus", [0.46, 0.05, 6, 22], 0x9aa3b8, { r: [Math.PI / 2, 0, 0], p: [0, -0.02, 0] });
    eyes(body, { y: 0.32, z: 0.3, x: 0.1, r: 0.05, glow: 0xffd34d });
    const shield = group(body, { p: [0.36, 0.02, 0.18] });
    part(shield, "cyl", [0.22, 0.22, 0.06, 12], 0x6a5aa8, { r: [Math.PI / 2, 0, 0.2] });
    part(shield, "sphere", [0.06, 6, 4], 0xffd34d, { p: [0, 0, 0.04] });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.15, 0.2, 0] });
      part(l, "capsule", [0.09, 0.12], 0x5a4a3a, { p: [0, -0.1, 0] });
      return l;
    });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 0.9 + i * Math.PI) * 0.4));
      body.rotation.z = S(o.k * 0.9) * 0.06;
      body.position.y = 0.3 + Math.abs(S(o.k * 0.9)) * 0.03;
    };
  },

  /* =================== 월드 3 · 얼음 계곡 =================== */
  iceWolf(root) {
    const body = group(root, { p: [0, 0.4, 0] });
    part(body, "sphere", [0.28, 14, 10], 0xe8f4ff, { s: [0.8, 0.8, 1.4] });
    for (let i = 0; i < 4; i++) part(body, "octa", [0.07, 0], 0x8fe8ff, { p: [0, 0.22, -0.2 + i * 0.13], s: [0.6, 1.4, 0.6], o: { emissive: 0x4ad8ff, ei: 0.4 } });
    const head = group(body, { p: [0, 0.14, 0.4] });
    part(head, "sphere", [0.2, 12, 10], 0xe8f4ff);
    part(head, "box", [0.14, 0.12, 0.22], 0xd0e6f7, { p: [0, -0.05, 0.16] });
    part(head, "sphere", [0.035, 6, 4], 0x1a2a3a, { p: [0, -0.01, 0.28] });
    for (const sx of [-1, 1]) part(head, "cone", [0.06, 0.18, 4], 0xd0e6f7, { p: [sx * 0.1, 0.2, -0.04] });
    eyes(head, { y: 0.06, z: 0.14, x: 0.08, r: 0.04, glow: 0x5ad8ff });
    const tail = part(body, "cone", [0.08, 0.36, 6], 0xe8f4ff, { p: [0, 0.1, -0.42], r: [-1.2, 0, 0] });
    const legs = quadLegs(root, 0xc8dcf0, 0.13, 0.22, 0.3, 0.055);
    return (o) => {
      const st = o.state;
      const run = st === "charge" ? 2.6 : 1.7;
      legsSwing(legs, o.k * run, st === "charge" ? 1.1 : 0.8);
      body.position.y = st === "chargeWarn" ? 0.28 : 0.4 + Math.abs(S(o.k * run)) * 0.05;
      body.rotation.x = st === "chargeWarn" ? 0.15 : st === "charge" ? 0.12 : 0;
      tail.rotation.y = S(o.t * 8) * 0.3;
    };
  },
  frostBat(root) {
    const body = group(root, { p: [0, 0.45, 0] });
    part(body, "sphere", [0.2, 12, 10], 0x9fd8ff, { s: [1, 1.05, 1] });
    part(body, "cone", [0.05, 0.22, 5], 0xdff6ff, { p: [0, -0.24, 0], r: [Math.PI, 0, 0], o: { emissive: 0x8fe8ff, ei: 0.5 } });
    eyes(body, { y: 0.06, z: 0.18, x: 0.07, r: 0.04, glow: 0xffffff });
    for (const sx of [-1, 1]) part(body, "cone", [0.05, 0.14, 5], 0x9fd8ff, { p: [sx * 0.09, 0.22, 0], r: [0, 0, -sx * 0.3] });
    const wings = wingPair(body, 0x6fb4e8, { y: 0.02, x: 0.12, size: 0.5 });
    return (o) => {
      const flying = o.e.flying;
      if (flying) flap(wings, o.t, 16, 0.8);
      else {
        wings[0].rotation.z = 1.3;
        wings[1].rotation.z = -1.3;
      }
      body.position.y = flying ? 0.45 + S(o.t * 8) * 0.05 : 0.22;
    };
  },
  frostGolem(root) {
    const body = group(root, { p: [0, 0.45, 0] });
    part(body, "box", [0.55, 0.5, 0.42], 0xa8e0ff, { o: { opacity: 0.92, depthWrite: true } });
    part(body, "box", [0.32, 0.28, 0.3], 0xcff2ff, { p: [0, 0.38, 0.02] });
    eyes(body, { y: 0.4, z: 0.16, x: 0.08, r: 0.04, glow: 0x2ad8ff });
    part(body, "octa", [0.14, 0], 0x6fd0ff, { p: [0.28, 0.25, 0], o: { emissive: 0x2ab8ff, ei: 0.5 } });
    part(body, "octa", [0.1, 0], 0x6fd0ff, { p: [-0.25, 0.3, -0.05], o: { emissive: 0x2ab8ff, ei: 0.5 } });
    const arms = [-1, 1].map((sx) => {
      const a = group(body, { p: [sx * 0.36, 0.1, 0] });
      part(a, "box", [0.16, 0.42, 0.18], 0x8fd0f0, { p: [0, -0.18, 0] });
      return a;
    });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.15, 0.22, 0] });
      part(l, "box", [0.17, 0.24, 0.2], 0x8fd0f0, { p: [0, -0.1, 0] });
      return l;
    });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 0.8 + i * Math.PI) * 0.35));
      arms.forEach((a, i) => (a.rotation.x = S(o.k * 0.8 + i * Math.PI + Math.PI) * 0.3));
      body.rotation.z = o.state === "stagger" ? S(o.t * 30) * 0.15 : S(o.k * 0.8) * 0.04;
    };
  },
  blizzardSpirit(root) {
    const body = group(root, { p: [0, 0.6, 0] });
    for (const [x, y, z, r] of [[0, 0, 0, 0.24], [0.15, 0.1, 0, 0.16], [-0.16, 0.08, 0.02, 0.15], [0, 0.18, -0.06, 0.15]]) part(body, "sphere", [r, 12, 8], 0xf4fbff, { p: [x, y, z], o: { opacity: 0.92, depthWrite: true } });
    eyes(body, { y: 0.06, z: 0.22, x: 0.08, r: 0.045 });
    const rings = [0, 1].map((i) => part(body, "torus", [0.38 + i * 0.1, 0.02, 6, 28], 0xbfe8ff, { r: [Math.PI / 2 + i * 0.4, 0, 0], o: { opacity: 0.7 }, shadow: false }));
    const flakes = [0, 1, 2, 3, 4].map(() => part(body, "octa", [0.04, 0], 0xffffff, { o: { emissive: 0xbfe8ff, ei: 0.8 }, shadow: false }));
    return (o) => {
      body.position.y = 0.6 + S(o.t * 2.4) * 0.08;
      rings.forEach((r, i) => (r.rotation.z = o.t * (i ? -2 : 1.5)));
      flakes.forEach((f, i) => {
        const a = o.t * 1.8 + i * 1.26;
        f.position.set(S(a) * 0.45, S(a * 2) * 0.15, C(a) * 0.45);
      });
      const pulse = o.m.pulseT > 0 ? 1 + o.m.pulseT : 1;
      body.scale.setScalar(pulse > 1 ? 1 + 0.3 * Math.min(1, o.m.pulseT * 2) : 1);
    };
  },
  crystalBug(root) {
    const body = group(root, { p: [0, 0.26, 0] });
    part(body, "sphere", [0.3, 14, 10], 0x5a7ab8, { s: [1, 0.6, 1.2] });
    for (const [x, z, h] of [[0, 0, 0.3], [0.13, -0.12, 0.22], [-0.13, -0.1, 0.24], [0.08, 0.15, 0.18], [-0.1, 0.12, 0.2]])
      part(body, "octa", [0.09, 0], 0x9ff2ff, { p: [x, 0.18 + h * 0.3, z], s: [0.6, h * 5, 0.6], o: { emissive: 0x4ae8ff, ei: 0.7, opacity: 0.85, depthWrite: true } });
    eyes(body, { y: 0.04, z: 0.34, x: 0.08, r: 0.04 });
    const legs = [];
    for (const sx of [-1, 1])
      for (const z of [-0.15, 0.15]) {
        const g = group(root, { p: [sx * 0.25, 0.16, z] });
        part(g, "capsule", [0.03, 0.16], 0x3a4a7a, { r: [0, 0, sx * 1.1] });
        legs.push(g);
      }
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 2 + i * 1.5) * 0.5));
      body.rotation.y = o.m.castT > 0 ? o.t * 10 : 0;
    };
  },
  snowShade(root) {
    const body = group(root, { p: [0, 0.36, 0] });
    part(body, "sphere", [0.26, 12, 10], 0x3a4a8a, { s: [0.85, 0.85, 1.3], o: { opacity: 0.85, depthWrite: true } });
    const head = group(body, { p: [0, 0.14, 0.34] });
    part(head, "sphere", [0.18, 12, 8], 0x3a4a8a, { o: { opacity: 0.85, depthWrite: true } });
    for (const sx of [-1, 1]) part(head, "cone", [0.05, 0.18, 4], 0x2a3a6a, { p: [sx * 0.09, 0.18, -0.02] });
    eyes(head, { y: 0.03, z: 0.13, x: 0.07, r: 0.035, glow: 0xbfe8ff });
    const scarf = part(body, "torus", [0.17, 0.05, 6, 14], 0xe8f4ff, { p: [0, 0.12, 0.24], r: [1.2, 0, 0] });
    const tailS = part(body, "box", [0.08, 0.02, 0.4], 0xe8f4ff, { p: [0.08, 0.14, 0.02], r: [0, 0.2, 0] });
    const legs = quadLegs(root, 0x2a3a6a, 0.12, 0.2, 0.26, 0.045);
    return (o) => {
      legsSwing(legs, o.k * 1.6, 0.8);
      tailS.rotation.x = S(o.t * 10) * 0.2;
      const blink = o.state === "blink";
      root.children.forEach((c) => (c.visible = !blink || S(o.t * 60) > 0));
      scarf.rotation.z = S(o.t * 5) * 0.2;
    };
  },

  /* =================== 월드 4 · 용암 협곡 =================== */
  lavaLizard(root) {
    const body = group(root, { p: [0, 0.2, 0] });
    part(body, "sphere", [0.22, 12, 10], 0xc8452a, { s: [0.9, 0.6, 1.6] });
    for (let i = 0; i < 4; i++) part(body, "sphere", [0.05, 6, 4], 0xffb03a, { p: [0, 0.12, -0.2 + i * 0.13], o: { emissive: 0xff7a1a, ei: 1.2 }, shadow: false });
    const head = group(body, { p: [0, 0.04, 0.4] });
    part(head, "sphere", [0.14, 12, 8], 0xc8452a, { s: [1, 0.7, 1.3] });
    eyes(head, { y: 0.07, z: 0.08, x: 0.09, r: 0.04 });
    const tail = group(body, { p: [0, 0, -0.34] });
    part(tail, "cone", [0.1, 0.5, 8], 0xa8351a, { p: [0, 0, -0.22], r: [-Math.PI / 2, 0, 0] });
    part(tail, "sphere", [0.05, 6, 4], 0xffd34d, { p: [0, 0.02, -0.45], o: { emissive: 0xff8a1a, ei: 1.5 }, shadow: false });
    const legs = [
      [-0.2, 0.18],
      [0.2, 0.18],
      [-0.2, -0.16],
      [0.2, -0.16],
    ].map(([x, z]) => {
      const g = group(root, { p: [x, 0.12, z] });
      part(g, "capsule", [0.04, 0.12], 0xa8351a, { r: [0, 0, x > 0 ? -1.1 : 1.1] });
      return g;
    });
    return (o) => {
      legsSwing(legs, o.k * 2, 0.7);
      tail.rotation.y = S(o.k * 2) * 0.4;
      body.rotation.y = S(o.k * 2) * 0.12;
    };
  },
  emberBat(root) {
    const body = group(root, { p: [0, 0.5, 0] });
    part(body, "sphere", [0.2, 12, 10], 0x6a1a1a);
    eyes(body, { y: 0.06, z: 0.17, x: 0.07, r: 0.04, glow: 0xffb03a });
    const wings = wingPair(body, 0x9a2a1a, { y: 0.02, x: 0.12, size: 0.52 });
    const flames = [0, 1, 2].map((i) => part(body, "cone", [0.06 - i * 0.012, 0.26, 6], i ? 0xffb03a : 0xff5a1a, { p: [0, 0, -0.2 - i * 0.12], r: [-Math.PI / 2, 0, 0], o: { emissive: 0xff5a1a, ei: 1.2, opacity: 0.85 }, shadow: false }));
    return (o) => {
      flap(wings, o.t, 18, 0.9);
      body.position.y = 0.5 + S(o.t * 9) * 0.05;
      flames.forEach((f, i) => f.scale.set(1, 1 + S(o.t * 20 + i) * 0.3, 1));
    };
  },
  magmaGolem(root) {
    const body = group(root, { p: [0, 0.5, 0] });
    const core = part(body, "sphere", [0.2, 12, 10], 0xffb03a, { o: { emissive: 0xff6a1a, ei: 1.4 } });
    const rocks = [];
    for (const [x, y, z, r] of [[0, 0.05, 0.18, 0.26], [0.22, 0.1, -0.05, 0.22], [-0.22, 0.08, -0.03, 0.22], [0, 0.32, 0, 0.2], [0, -0.18, -0.05, 0.25]]) rocks.push(part(body, "dodeca", [r, 0], 0x3a2a2a, { p: [x, y, z] }));
    eyes(body, { y: 0.32, z: 0.17, x: 0.08, r: 0.045, glow: 0xffd34d });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.18, 0.28, 0] });
      part(l, "dodeca", [0.14, 0], 0x2a2020, { p: [0, -0.14, 0] });
      return l;
    });
    return (o) => {
      const st = o.state;
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 0.8 + i * Math.PI) * 0.35));
      const hard = st === "absorb";
      const warn = st === "burstWarn";
      core.scale.setScalar(warn ? 1.4 + S(o.t * 25) * 0.25 : hard ? 0.7 : 1 + S(o.t * 4) * 0.1);
      rocks.forEach((r, i) => r.position.multiplyScalar(1).setLength(hard ? 0.16 + i * 0.01 : warn ? 0.3 : 0.24 + (i === 4 ? -0.05 : 0)));
      body.position.x = warn ? S(o.t * 40) * 0.03 : 0;
    };
  },
  fireBomber(root) {
    const body = group(root, { p: [0, 0.3, 0] });
    part(body, "sphere", [0.22, 12, 10], 0x8a3a2a, { s: [1, 1.1, 1] });
    part(body, "cone", [0.15, 0.2, 8], 0x5a2a1a, { p: [0, 0.3, 0], r: [0, 0, 0] });
    eyes(body, { y: 0.1, z: 0.18, x: 0.08, r: 0.045, angry: true });
    const bomb = part(body, "sphere", [0.2, 12, 10], 0x2a2a2a, { p: [0, 0.05, -0.26] });
    part(bomb, "cyl", [0.03, 0.03, 0.12, 6], 0x8a6a3a, { p: [0, 0.22, 0] });
    const spark = part(bomb, "sphere", [0.05, 6, 4], 0xffd34d, { p: [0, 0.3, 0], o: { emissive: 0xffb03a, ei: 2 }, shadow: false });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.1, 0.16, 0] });
      part(l, "capsule", [0.05, 0.1], 0x5a2a1a, { p: [0, -0.08, 0] });
      return l;
    });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 2 + i * Math.PI) * 0.7));
      const arm = o.state === "arming";
      spark.scale.setScalar(arm ? 1.6 + S(o.t * 40) * 0.8 : 0.8 + S(o.t * 20) * 0.3);
      bomb.scale.setScalar(arm ? 1 + Math.abs(S(o.t * 12)) * 0.15 : 1);
    };
  },
  fireBoar(root) {
    const body = group(root, { p: [0, 0.4, 0] });
    part(body, "sphere", [0.36, 14, 10], 0x5a3a2a, { s: [0.95, 0.85, 1.25] });
    part(body, "box", [0.5, 0.14, 0.6], 0x3a3a4a, { p: [0, 0.28, 0] });
    const mane = [0, 1, 2, 3].map((i) => part(body, "cone", [0.08, 0.3, 6], i % 2 ? 0xffb03a : 0xff5a1a, { p: [0, 0.4, -0.24 + i * 0.16], o: { emissive: 0xff5a1a, ei: 1.1 }, shadow: false }));
    const head = group(body, { p: [0, 0.05, 0.45] });
    part(head, "sphere", [0.24, 12, 10], 0x5a3a2a);
    part(head, "box", [0.36, 0.1, 0.28], 0x3a3a4a, { p: [0, 0.16, -0.02] });
    for (const sx of [-1, 1]) part(head, "cone", [0.03, 0.18, 6], 0xfff8e8, { p: [sx * 0.1, -0.08, 0.22], r: [-0.8, 0, sx * 0.3] });
    eyes(head, { y: 0.06, z: 0.18, x: 0.1, r: 0.045, glow: 0xffd34d });
    const bubble = part(root, "sphere", [0.7, 16, 12], 0xff8a3a, { p: [0, 0.45, 0.05], o: { opacity: 0.22, emissive: 0xff6a1a, ei: 0.5 }, shadow: false });
    const legs = quadLegs(root, 0x3a2a1a, 0.18, 0.24, 0.27, 0.07);
    return (o) => {
      const st = o.state;
      legsSwing(legs, o.k * (st === "charge" ? 2.4 : 1.2), st === "charge" ? 1 : 0.6);
      body.rotation.x = st === "charge" ? 0.25 : st === "chargeWarn" ? -0.15 : 0;
      bubble.visible = o.e.shield > 0;
      bubble.scale.setScalar(1 + S(o.t * 4) * 0.03);
      mane.forEach((m, i) => m.scale.set(1, 0.8 + Math.abs(S(o.t * 14 + i)) * 0.5, 1));
    };
  },
  ashShaman(root) {
    const body = group(root);
    part(body, "cone", [0.3, 0.7, 10], 0x6a6a72, { p: [0, 0.35, 0] });
    part(body, "sphere", [0.17, 12, 8], 0xe8e0d0, { p: [0, 0.76, 0.02] });
    part(body, "box", [0.22, 0.05, 0.04], 0x2a1a1a, { p: [0, 0.8, 0.16] });
    eyes(body, { y: 0.77, z: 0.15, x: 0.06, r: 0.03, glow: 0xff5a1a });
    part(body, "cone", [0.22, 0.25, 10], 0x4a4a52, { p: [0, 0.95, 0] });
    const staff = group(body, { p: [0.27, 0.4, 0.08] });
    part(staff, "cyl", [0.02, 0.02, 0.8, 6], 0x3a2a1a);
    const ember = part(staff, "sphere", [0.08, 8, 6], 0xff7a1a, { p: [0, 0.45, 0], o: { emissive: 0xff5a1a, ei: 1.6 } });
    return (o) => {
      body.position.y = Math.abs(S(o.k)) * 0.03;
      body.rotation.z = S(o.k) * 0.05;
      ember.scale.setScalar(1 + S(o.t * 9) * 0.2 + (o.m.pulseT > 0 ? 0.8 : 0));
      staff.rotation.z = o.m.pulseT > 0 ? -0.6 : 0;
    };
  },

  /* =================== 월드 5 · 어둠의 성채 =================== */
  shadowKnight(root) {
    const body = group(root, { p: [0, 0.4, 0] });
    part(body, "box", [0.42, 0.5, 0.32], 0x2a2a3e, { p: [0, 0.05, 0] });
    part(body, "box", [0.5, 0.12, 0.36], 0x4a4a6a, { p: [0, 0.28, 0] });
    const head = group(body, { p: [0, 0.48, 0] });
    part(head, "sphere", [0.2, 12, 10], 0x3a3a52, { s: [1, 1.1, 1] });
    part(head, "box", [0.24, 0.04, 0.05], 0xb48cff, { p: [0, 0.02, 0.18], o: { emissive: 0xb48cff, ei: 1.6 } });
    part(head, "cone", [0.05, 0.22, 6], 0x6a4aa8, { p: [0, 0.26, -0.02] });
    const shield = group(body, { p: [0, 0.05, 0.3] });
    part(shield, "box", [0.5, 0.6, 0.06], 0x3a3a58);
    part(shield, "box", [0.42, 0.5, 0.07], 0x5a4a8a, { p: [0, 0, 0.005] });
    part(shield, "octa", [0.08, 0], 0xb48cff, { p: [0, 0.05, 0.05], o: { emissive: 0x9a6aff, ei: 1 } });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.12, 0.2, 0] });
      part(l, "box", [0.13, 0.24, 0.15], 0x22222e, { p: [0, -0.1, 0] });
      return l;
    });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k + i * Math.PI) * 0.4));
      body.position.y = 0.4 + Math.abs(S(o.k)) * 0.03;
      shield.position.z = 0.3 + (o.m.blockT > 0 ? 0.08 : 0);
      shield.rotation.x = o.m.blockT > 0 ? -0.2 : 0;
    };
  },
  illusionCrow(root, opts = {}) {
    const ghost = opts.ghost;
    const mo = ghost ? { opacity: 0.45, emissive: 0x9a6aff, ei: 0.6 } : {};
    const body = group(root, { p: [0, 0.5, 0] });
    part(body, "sphere", [0.22, 12, 10], ghost ? 0x9a7aff : 0x1e1a2a, { s: [0.9, 0.9, 1.2], o: mo, shadow: !ghost });
    const head = group(body, { p: [0, 0.12, 0.2] });
    part(head, "sphere", [0.14, 10, 8], ghost ? 0x9a7aff : 0x1e1a2a, { o: mo, shadow: !ghost });
    part(head, "cone", [0.05, 0.16, 6], 0xffd34d, { p: [0, -0.02, 0.15], r: [Math.PI / 2, 0, 0], o: mo, shadow: !ghost });
    eyes(head, { y: 0.03, z: 0.1, x: 0.06, r: 0.035, glow: 0xd08aff });
    const wings = wingPair(body, ghost ? 0xb49aff : 0x2a2440, { y: 0.04, x: 0.12, size: 0.55, o: mo });
    if (!ghost) part(body, "torus", [0.1, 0.02, 6, 12], 0xb48cff, { p: [0, 0.3, 0.1], r: [Math.PI / 2, 0, 0], o: { emissive: 0x9a6aff, ei: 1 }, shadow: false });
    return (o) => {
      flap(wings, o.t, 13, 0.8);
      body.position.y = 0.5 + S(o.t * 6 + (ghost ? 1.5 : 0)) * 0.06;
      if (ghost) body.visible = S(o.t * 22) > -0.6;
    };
  },
  crowClone(root) {
    return MODELS.illusionCrow(root, { ghost: true });
  },
  soulReaper(root) {
    const body = group(root);
    part(body, "cone", [0.32, 0.8, 10], 0x2a2440, { p: [0, 0.42, 0] });
    const hood = part(body, "sphere", [0.2, 12, 10], 0x1e1a2a, { p: [0, 0.82, 0] });
    eyes(body, { y: 0.8, z: 0.14, x: 0.06, r: 0.035, glow: 0x6affd8 });
    const scythe = group(body, { p: [0.3, 0.5, 0.05] });
    part(scythe, "cyl", [0.02, 0.02, 0.9, 6], 0x5a4a3a, { r: [0, 0, 0.15] });
    part(scythe, "torus", [0.22, 0.03, 4, 12, Math.PI * 0.7], 0xcfd6ff, { p: [-0.05, 0.42, 0], r: [0, 0, 0.6] });
    const souls = [0, 1, 2].map(() => part(body, "sphere", [0.07, 8, 6], 0x6affd8, { o: { emissive: 0x2affc8, ei: 1.4, opacity: 0.8 }, shadow: false }));
    return (o) => {
      body.position.y = 0.05 + S(o.t * 2.5) * 0.04;
      scythe.rotation.z = S(o.k) * 0.15;
      const n = (o.e.ab.soulFeed && o.e.ab.soulFeed.stacks) || 0;
      souls.forEach((s, i) => {
        s.visible = i < n;
        const a = o.t * 3 + i * 2.09;
        s.position.set(S(a) * 0.4, 0.6 + S(a * 2) * 0.1, C(a) * 0.4);
      });
      hood.scale.setScalar(1 + n * 0.08);
    };
  },
  darkSummoner(root) {
    const body = group(root);
    part(body, "cone", [0.32, 0.75, 10], 0x4a2a7a, { p: [0, 0.38, 0] });
    part(body, "sphere", [0.17, 12, 8], 0x6a4a9a, { p: [0, 0.78, 0] });
    eyes(body, { y: 0.78, z: 0.15, x: 0.06, r: 0.035, glow: 0xff6ad8 });
    part(body, "cone", [0.2, 0.35, 10], 0x2a1a4a, { p: [0, 0.98, 0], r: [-0.2, 0, 0] });
    const book = group(body, { p: [0, 0.5, 0.36] });
    part(book, "box", [0.26, 0.04, 0.18], 0x8a3a3a);
    part(book, "box", [0.24, 0.045, 0.16], 0xfff1dc, { p: [0, 0.01, 0] });
    const circle = part(root, "ring", [0.5, 0.58, 32], 0xc86aff, { p: [0, 0.03, 0], o: { flat: true, opacity: 0.7 }, shadow: false });
    return (o) => {
      book.position.y = 0.5 + S(o.t * 3) * 0.05;
      book.rotation.y = S(o.t * 2) * 0.3;
      const cast = o.m.castT > 0;
      circle.visible = cast;
      circle.rotation.y = o.t * 2;
      circle.scale.setScalar(cast ? 1 + (1 - o.m.castT) * 0.6 : 1);
      body.position.y = Math.abs(S(o.k)) * 0.02;
    };
  },
  curseCaster(root) {
    const body = group(root);
    part(body, "cone", [0.3, 0.65, 10], 0x3a1a4a, { p: [0, 0.33, 0] });
    part(body, "sphere", [0.17, 12, 8], 0x9ad89a, { p: [0, 0.72, 0] });
    eyes(body, { y: 0.74, z: 0.15, x: 0.06, r: 0.035, angry: true });
    const hat = group(body, { p: [0, 0.86, 0] });
    part(hat, "cyl", [0.28, 0.28, 0.03, 14], 0x1e1a2a);
    part(hat, "cone", [0.16, 0.45, 10], 0x1e1a2a, { p: [0, 0.22, 0], r: [-0.25, 0, 0] });
    const orb = part(body, "sphere", [0.1, 10, 8], 0xb46bff, { p: [0.25, 0.45, 0.15], o: { emissive: 0x9a3aff, ei: 1.4 } });
    return (o) => {
      orb.position.y = 0.45 + S(o.t * 4) * 0.06;
      orb.scale.setScalar(1 + (o.m.pulseT > 0 ? 1 : 0) + S(o.t * 6) * 0.1);
      hat.rotation.z = S(o.k) * 0.08;
      body.position.y = Math.abs(S(o.k)) * 0.03;
    };
  },
  voidEater(root) {
    const body = group(root, { p: [0, 0.4, 0] });
    part(body, "sphere", [0.4, 16, 12], 0x2a1a3a, { s: [1, 0.9, 1] });
    const mouth = part(body, "sphere", [0.24, 12, 8], 0xff3a6a, { p: [0, -0.05, 0.25], s: [1, 0.55, 0.5], o: { emissive: 0xff2a5a, ei: 0.8 } });
    for (let i = -2; i <= 2; i++) part(body, "cone", [0.03, 0.08, 4], 0xffffff, { p: [i * 0.07, 0.05, 0.36], r: [Math.PI, 0, 0], shadow: false });
    eyes(body, { y: 0.2, z: 0.3, x: 0.14, r: 0.06, glow: 0xff6a8a });
    const spikes = [];
    for (let i = 0; i < 6; i++) spikes.push(part(body, "cone", [0.06, 0.25, 5], 0xff3a6a, { p: [S(i * 1.05) * 0.3, 0.25, C(i * 1.05) * 0.3 - 0.05], r: [C(i * 1.05) * -0.6, 0, S(i * 1.05) * 0.6], o: { emissive: 0xff2a5a, ei: 1 } }));
    return (o) => {
      const fr = o.e.ab.frenzy && o.e.ab.frenzy.on;
      const warn = o.state === "frenzyWarn";
      spikes.forEach((s) => (s.visible = fr || warn));
      body.position.x = warn ? S(o.t * 45) * 0.05 : 0;
      const b = Math.abs(S(o.k * (fr ? 2.2 : 1)));
      body.scale.set(1 + b * 0.06, 1 - b * 0.08, 1 + b * 0.06);
      mouth.scale.y = 0.55 + Math.abs(S(o.t * (fr ? 12 : 3))) * 0.3;
    };
  },

  /* =================== 보스 =================== */
  crownSlime(root) {
    const body = group(root);
    part(body, "sphere", [0.55, 26, 20], 0x48c85c, { p: [0, 0.48, 0], s: [1.06, 0.85, 1.06], o: { rough: 0.16 } });
    part(body, "cyl", [0.55, 0.64, 0.08, 26], 0x36aa4c, { p: [0, 0.05, 0], o: { rough: 0.2 }, outline: false });
    part(body, "sphere", [0.17, 10, 8], 0xffffff, { p: [-0.25, 0.7, 0.3], s: [1, 0.7, 0.5], r: [0, 0, 0.5], o: { flat: true, opacity: 0.75 }, shadow: false });
    eyes(body, { y: 0.57, z: 0.52, x: 0.18, r: 0.1, angry: true });
    mouth(body, { y: 0.38, z: 0.57, w: 0.09, open: true, teeth: true });
    cheeks(body, { x: 0.32, y: 0.43, z: 0.5, r: 0.07 });
    const crown = group(body, { p: [0, 0.95, 0] });
    part(crown, "cyl", [0.24, 0.26, 0.14, 14], 0xffd34d, { o: { emissive: 0xffb03a, ei: 0.3 } });
    for (let i = 0; i < 5; i++) part(crown, "cone", [0.05, 0.16, 5], 0xffd34d, { p: [S(i * 1.257) * 0.22, 0.13, C(i * 1.257) * 0.22] });
    for (let i = 0; i < 5; i++) part(crown, "sphere", [0.035, 6, 4], [0xff5a6a, 0x5ad8ff, 0x9a6aff, 0x5aff8a, 0xffffff][i], { p: [S(i * 1.257 + 0.6) * 0.25, 0.02, C(i * 1.257 + 0.6) * 0.25], shadow: false });
    return (o) => {
      const st = o.state;
      if (st === "jumpWarn") {
        body.scale.set(1.15, 0.75, 1.15);
        body.position.y = 0;
      } else if (st === "air") {
        body.scale.set(0.9, 1.2, 0.9);
        body.position.y = 1.4;
      } else {
        const b = Math.abs(S(o.k * 1.1));
        body.scale.set(1 + b * 0.08, 1 - b * 0.12, 1 + b * 0.08);
        body.position.y = b * 0.1;
      }
      crown.rotation.y = S(o.t * 2) * 0.1;
    };
  },
  ironBoarChief(root) {
    const inner = group(root, { s: 1.1 });
    const anim = MODELS.boar(inner);
    const flag = group(root, { p: [0, 0.85, -0.25] });
    part(flag, "cyl", [0.02, 0.02, 0.7, 6], 0x5a3a22, { p: [0, 0.2, 0] });
    const cloth = part(flag, "box", [0.32, 0.22, 0.01], 0xc83a3a, { p: [0.16, 0.45, 0] });
    part(root, "box", [0.75, 0.16, 0.8], 0x6a7388, { p: [0, 0.72, -0.02] });
    for (const sx of [-1, 1]) part(root, "cone", [0.07, 0.4, 6], 0xfff1d0, { p: [sx * 0.2, 0.62, 0.72], r: [-1.1, 0, sx * 0.3] });
    const glow = part(root, "sphere", [0.85, 16, 12], 0x9aa3b8, { p: [0, 0.5, 0], o: { opacity: 0.18, emissive: 0xdfe6ff, ei: 0.6 }, shadow: false });
    return (o) => {
      anim(o);
      cloth.rotation.y = S(o.t * 6) * 0.3;
      glow.visible = o.state === "armorUp";
      inner.rotation.z = o.state === "tired" ? 0.25 : 0;
    };
  },
  sporeQueen(root) {
    const body = group(root);
    part(body, "cone", [0.45, 0.8, 14], 0xd8a0ff, { p: [0, 0.4, 0] });
    part(body, "torus", [0.42, 0.06, 6, 24], 0xffffff, { p: [0, 0.12, 0], r: [Math.PI / 2, 0, 0] });
    part(body, "sphere", [0.2, 12, 10], 0xf4e0ff, { p: [0, 0.88, 0] });
    eyes(body, { y: 0.9, z: 0.17, x: 0.07, r: 0.045 });
    const cap = group(body, { p: [0, 1.1, 0] });
    part(cap, "sphere", [0.5, 18, 10], 0xa03ad8, { s: [1, 0.4, 1] });
    for (let i = 0; i < 8; i++) part(cap, "sphere", [0.06, 6, 4], 0xffe36a, { p: [S(i * 0.785) * 0.4, 0.08, C(i * 0.785) * 0.4], o: { emissive: 0xffd34d, ei: 0.7 }, shadow: false });
    for (let i = 0; i < 5; i++) part(cap, "cone", [0.05, 0.16, 5], 0xffd34d, { p: [S(i * 1.257) * 0.12, 0.2, C(i * 1.257) * 0.12] });
    const spores = [0, 1, 2, 3, 4, 5].map(() => part(body, "sphere", [0.06, 6, 4], 0xb4ff6a, { o: { opacity: 0.6, emissive: 0x6aff2a, ei: 0.5 }, shadow: false }));
    return (o) => {
      spores.forEach((s, i) => {
        const a = o.t * 0.8 + i * 1.05;
        s.position.set(S(a) * 0.8, 0.4 + ((o.t * 0.3 + i / 6) % 1) * 1.2, C(a) * 0.8);
      });
      body.rotation.z = S(o.k * 0.6) * 0.05;
      cap.rotation.y = o.t * 0.4;
    };
  },
  mushroomColossus(root) {
    const body = group(root);
    part(body, "cyl", [0.35, 0.45, 0.9, 14], 0xc8b496, { p: [0, 0.55, 0] });
    part(body, "sphere", [0.12, 8, 6], 0x6fae4a, { p: [0.3, 0.6, 0.2] });
    part(body, "sphere", [0.1, 8, 6], 0x6fae4a, { p: [-0.32, 0.4, 0.1] });
    eyes(body, { y: 0.8, z: 0.34, x: 0.12, r: 0.06, glow: 0xffe36a });
    const cap = group(body, { p: [0, 1.1, 0] });
    part(cap, "sphere", [0.75, 18, 12], 0x8a4a2a, { s: [1, 0.45, 1] });
    for (let i = 0; i < 6; i++) part(cap, "sphere", [0.12, 8, 6], 0xfff1dc, { p: [S(i * 1.05) * 0.5, 0.2, C(i * 1.05) * 0.5], shadow: false });
    const arms = [-1, 1].map((sx) => {
      const a = group(body, { p: [sx * 0.45, 0.85, 0] });
      part(a, "capsule", [0.12, 0.5], 0xb8a486, { p: [0, -0.35, 0] });
      part(a, "sphere", [0.16, 10, 8], 0x8a6a4a, { p: [0, -0.72, 0] });
      return a;
    });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.22, 0.25, 0] });
      part(l, "cyl", [0.13, 0.16, 0.3, 10], 0x9a8466, { p: [0, -0.1, 0] });
      return l;
    });
    const shell = part(root, "sphere", [1.05, 18, 14], 0xffe36a, { p: [0, 0.8, 0], o: { opacity: 0.2, emissive: 0xffd34d, ei: 0.5 }, shadow: false });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 0.6 + i * Math.PI) * 0.3));
      const slam = o.state === "slamWarn";
      arms.forEach((a) => (a.rotation.x = slam ? -2.4 : S(o.k * 0.6) * 0.2));
      shell.visible = o.e.shield > 0;
      body.rotation.z = o.state === "exposed" ? S(o.t * 20) * 0.08 : 0;
    };
  },
  glacierGuardian(root) {
    const body = group(root);
    part(body, "octa", [0.55, 0], 0x9fe0ff, { p: [0, 0.75, 0], s: [1, 1.3, 0.8], o: { opacity: 0.92, depthWrite: true } });
    part(body, "octa", [0.25, 0], 0xdff6ff, { p: [0, 1.45, 0], o: { emissive: 0x8fe8ff, ei: 0.5 } });
    eyes(body, { y: 1.42, z: 0.16, x: 0.08, r: 0.05, glow: 0x2ad8ff });
    for (const sx of [-1, 1]) part(body, "octa", [0.22, 0], 0x6fd0ff, { p: [sx * 0.6, 1.05, 0], s: [0.8, 1.4, 0.8] });
    const arms = [-1, 1].map((sx) => {
      const a = group(body, { p: [sx * 0.6, 0.95, 0] });
      part(a, "box", [0.24, 0.6, 0.24], 0x8fd0f0, { p: [0, -0.35, 0] });
      return a;
    });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.25, 0.3, 0] });
      part(l, "box", [0.24, 0.34, 0.26], 0x7ac0e0, { p: [0, -0.12, 0] });
      return l;
    });
    const shell = part(root, "ico", [1.05, 1], 0xbfefff, { p: [0, 0.85, 0], o: { opacity: 0.28, emissive: 0x8fe8ff, ei: 0.6 }, shadow: false });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 0.6 + i * Math.PI) * 0.3));
      arms.forEach((a, i) => (a.rotation.x = S(o.k * 0.6 + i * Math.PI + Math.PI) * 0.25));
      shell.visible = o.e.shield > 0;
      shell.rotation.y = o.t * 0.5;
      body.rotation.z = o.state === "exposed" ? S(o.t * 18) * 0.08 : 0;
    };
  },
  blizzardQueen(root) {
    const body = group(root, { p: [0, 0.3, 0] });
    part(body, "cone", [0.5, 1.0, 14], 0x8fd0ff, { p: [0, 0.5, 0], o: { opacity: 0.9, depthWrite: true } });
    part(body, "sphere", [0.22, 14, 10], 0xf4fbff, { p: [0, 1.1, 0] });
    eyes(body, { y: 1.12, z: 0.18, x: 0.08, r: 0.05, glow: 0x4ad8ff });
    const crown = group(body, { p: [0, 1.32, 0] });
    for (let i = 0; i < 7; i++) part(crown, "octa", [0.06, 0], 0xdff6ff, { p: [S(i * 0.9 - 2.7) * 0.18, 0, C(i * 0.9 - 2.7) * 0.18 - 0.02], s: [0.6, 1.8 + (i === 3 ? 0.8 : 0), 0.6], o: { emissive: 0x8fe8ff, ei: 0.8 } });
    const cape = part(body, "cone", [0.6, 1.1, 14, 1], 0x4a8ad8, { p: [0, 0.55, -0.12], s: [1, 1, 0.5], o: { side: true, opacity: 0.85 } });
    const shards = [0, 1, 2, 3, 4, 5].map(() => part(body, "octa", [0.08, 0], 0xdff6ff, { s: [0.5, 1.6, 0.5], o: { emissive: 0x8fe8ff, ei: 1 }, shadow: false }));
    return (o) => {
      body.position.y = 0.3 + S(o.t * 1.8) * 0.08;
      shards.forEach((s, i) => {
        const a = o.t * (o.e.b && o.e.b.phase >= 2 ? 2.5 : 1.4) + i * 1.05;
        s.position.set(S(a) * 0.85, 0.8 + S(a * 1.5) * 0.2, C(a) * 0.85);
        s.rotation.z = a;
      });
      cape.rotation.y = S(o.t * 1.5) * 0.1;
    };
  },
  magmaColossus(root) {
    const body = group(root);
    const core = part(body, "sphere", [0.35, 16, 12], 0xffb03a, { p: [0, 0.9, 0.05], o: { emissive: 0xff6a1a, ei: 1.5 } });
    for (const [x, y, z, r] of [[0, 0.9, 0.3, 0.36], [0.4, 1.0, -0.05, 0.34], [-0.4, 1.0, -0.05, 0.34], [0, 1.35, 0, 0.3], [0, 0.55, -0.05, 0.4], [0.25, 0.6, 0.25, 0.22], [-0.25, 0.62, 0.25, 0.22]]) part(body, "dodeca", [r, 0], 0x2a2020, { p: [x, y, z] });
    eyes(body, { y: 1.35, z: 0.27, x: 0.1, r: 0.06, glow: 0xffd34d });
    const arms = [-1, 1].map((sx) => {
      const a = group(body, { p: [sx * 0.7, 1.1, 0] });
      part(a, "dodeca", [0.24, 0], 0x3a2a2a, { p: [0, -0.3, 0] });
      part(a, "dodeca", [0.28, 0], 0x2a2020, { p: [0, -0.7, 0.05] });
      part(a, "sphere", [0.1, 8, 6], 0xff8a3a, { p: [0, -0.5, 0.15], o: { emissive: 0xff5a1a, ei: 1.3 }, shadow: false });
      return a;
    });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.3, 0.32, 0] });
      part(l, "dodeca", [0.26, 0], 0x2a2020, { p: [0, -0.1, 0] });
      return l;
    });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 0.5 + i * Math.PI) * 0.3));
      arms.forEach((a, i) => (a.rotation.x = o.state === "guard" ? -1.4 : S(o.k * 0.5 + i * Math.PI) * 0.25));
      core.scale.setScalar(o.state === "weak" ? 1.4 + S(o.t * 20) * 0.15 : o.state === "guard" ? 0.6 : 1 + S(o.t * 3) * 0.08);
    };
  },
  ignis(root) {
    const body = group(root);
    part(body, "sphere", [0.45, 16, 12], 0xc83a1a, { p: [0, 0.7, 0], s: [1, 1.1, 1.1] });
    part(body, "sphere", [0.28, 12, 10], 0xffb03a, { p: [0, 0.62, 0.3], s: [1, 1.1, 0.6], o: { emissive: 0xff6a1a, ei: 0.5 } });
    const head = group(body, { p: [0, 1.25, 0.15] });
    part(head, "sphere", [0.3, 14, 10], 0xc83a1a);
    part(head, "box", [0.28, 0.16, 0.3], 0xa8301a, { p: [0, -0.08, 0.25] });
    for (const sx of [-1, 1]) part(head, "cone", [0.06, 0.4, 6], 0x3a2020, { p: [sx * 0.2, 0.3, -0.1], r: [-0.5, 0, sx * 0.4] });
    eyes(head, { y: 0.05, z: 0.25, x: 0.12, r: 0.06, glow: 0xffd34d });
    const crown = group(head, { p: [0, 0.3, 0] });
    for (let i = 0; i < 5; i++) part(crown, "cone", [0.05, 0.2, 5], 0xffd34d, { p: [S(i * 1.257) * 0.15, 0, C(i * 1.257) * 0.15], o: { emissive: 0xffb03a, ei: 0.6 } });
    const wings = [-1, 1].map((sx) => {
      const w = group(body, { p: [sx * 0.35, 1.0, -0.25] });
      for (let i = 0; i < 3; i++) part(w, "cone", [0.12, 0.7 - i * 0.12, 6], i ? 0xffb03a : 0xff5a1a, { p: [sx * (0.25 + i * 0.12), 0.1 - i * 0.12, 0], r: [0, 0, sx * (-1.2 + i * 0.3)], o: { emissive: 0xff5a1a, ei: 1, opacity: 0.9 }, shadow: false });
      return w;
    });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.25, 0.35, 0] });
      part(l, "capsule", [0.12, 0.22], 0xa8301a, { p: [0, -0.15, 0] });
      return l;
    });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * (o.state === "charge" ? 1.8 : 0.8) + i * Math.PI) * 0.4));
      wings.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.3 + S(o.t * 4) * 0.25)));
      body.rotation.x = o.state === "charge" ? 0.25 : o.state === "chargeWarn" ? -0.2 : 0;
    };
  },
  darkLord(root) {
    const body = group(root, { p: [0, 0.2, 0] });
    part(body, "box", [0.65, 0.8, 0.45], 0x2a2440, { p: [0, 0.6, 0] });
    part(body, "box", [0.85, 0.16, 0.5], 0x4a3a6a, { p: [0, 0.98, 0] });
    for (const sx of [-1, 1]) part(body, "cone", [0.1, 0.3, 6], 0x6a4aa8, { p: [sx * 0.42, 1.15, 0] });
    const head = group(body, { p: [0, 1.25, 0] });
    part(head, "sphere", [0.24, 14, 10], 0x1e1a2a);
    part(head, "box", [0.28, 0.05, 0.05], 0xff4a8a, { p: [0, 0.02, 0.22], o: { emissive: 0xff2a6a, ei: 1.8 } });
    for (const sx of [-1, 1]) part(head, "cone", [0.05, 0.3, 6], 0x9a6aff, { p: [sx * 0.15, 0.25, 0], r: [0, 0, -sx * 0.4] });
    const cape = part(body, "box", [0.8, 1.1, 0.04], 0x5a1a3a, { p: [0, 0.55, -0.26], o: { side: true } });
    const sword = group(body, { p: [0.5, 0.75, 0.15] });
    part(sword, "box", [0.08, 1.0, 0.04], 0xcfd6ff, { p: [0, 0.45, 0], o: { emissive: 0x9a6aff, ei: 0.3 } });
    part(sword, "box", [0.3, 0.06, 0.08], 0x4a3a6a, { p: [0, -0.05, 0] });
    const shield = part(body, "box", [0.5, 0.7, 0.08], 0x3a3058, { p: [-0.45, 0.65, 0.2] });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.18, 0.35, 0] });
      part(l, "box", [0.2, 0.36, 0.22], 0x1e1a2a, { p: [0, -0.12, 0] });
      return l;
    });
    return (o) => {
      legs.forEach((l, i) => (l.rotation.x = S(o.k * 0.7 + i * Math.PI) * 0.35));
      const guard = o.state === "guard";
      shield.position.set(guard ? 0 : -0.45, 0.65, guard ? 0.35 : 0.2);
      sword.rotation.x = guard ? 0 : S(o.t * 3) * 0.4 - 0.4;
      cape.rotation.x = S(o.t * 2) * 0.08;
    };
  },
  ravenKing(root) {
    const body = group(root, { p: [0, 0.4, 0] });
    part(body, "sphere", [0.5, 18, 14], 0x1a1626, { s: [0.9, 1, 1.25], p: [0, 0.4, 0] });
    part(body, "sphere", [0.3, 12, 10], 0x3a2a5a, { p: [0, 0.3, 0.35], s: [1, 1, 0.5] });
    const head = group(body, { p: [0, 0.95, 0.3] });
    part(head, "sphere", [0.3, 14, 10], 0x1a1626);
    part(head, "cone", [0.1, 0.36, 6], 0xffd34d, { p: [0, -0.04, 0.33], r: [Math.PI / 2, 0, 0] });
    eyes(head, { y: 0.06, z: 0.22, x: 0.12, r: 0.06, glow: 0xff4ad8 });
    const crown = group(head, { p: [0, 0.3, 0] });
    for (let i = 0; i < 6; i++) part(crown, "cone", [0.05, 0.22, 5], 0x9a6aff, { p: [S(i * 1.05) * 0.16, 0, C(i * 1.05) * 0.16], o: { emissive: 0x9a6aff, ei: 0.9 } });
    const wings = wingPair(body, 0x2a2440, { y: 0.6, x: 0.35, size: 1.3, o: { emissive: 0x3a1a6a, ei: 0.4 } });
    const legs = [-1, 1].map((sx) => {
      const l = group(root, { p: [sx * 0.2, 0.45, 0.05] });
      part(l, "cyl", [0.04, 0.04, 0.4, 6], 0xffd34d, { p: [0, -0.2, 0] });
      return l;
    });
    const aura = part(root, "ring", [0.9, 1.05, 40], 0xff4ad8, { p: [0, 0.05, 0], o: { flat: true, opacity: 0.6 }, shadow: false });
    return (o) => {
      const fly = o.e.flying;
      flap(wings, o.t, fly ? 8 : 2, fly ? 0.8 : 0.15, fly ? 0.3 : 1.2);
      body.position.y = fly ? 0.8 + S(o.t * 3) * 0.1 : 0.4;
      legs.forEach((l) => (l.visible = !fly));
      aura.visible = o.state === "strikeWarn";
      aura.scale.setScalar(1 + S(o.t * 10) * 0.1);
      body.rotation.x = o.state === "strikeWarn" ? -0.3 : 0;
    };
  },
};

/** 모델이 있는 종류 (점검용) */
export const MODEL_KEYS = Object.keys(MODELS);
