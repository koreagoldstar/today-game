/*
 * 타워 3D 모델: 받침(단계마다 나무 → 돌 → 금테) + 동물 수호자 + 무기
 *  진화하면 무기 · 모자 · 색이 바뀜. anim(o): o = { t, dt, since(쏜 뒤 초), yaw(겨눈 방향), stun, tier }
 */
import { THREE, part, group, eyes, cheeks, flatten } from "./kit.js";

const S = Math.sin;

function base(root, tier) {
  // 단계마다 받침이 바뀜: 나무 그루터기 → 쇠테 두른 나무 → 돌 받침(이끼) → 대리석 + 금테
  part(root, "disc", [0.56, 24], 0x101018, { p: [0, 0.012, 0], o: { flat: true, opacity: 0.28 }, shadow: false });
  if (tier < 2) {
    part(root, "cyl", [0.42, 0.47, 0.16, 18], 0x8a5a36, { p: [0, 0.08, 0], o: { rough: 0.85 } });
    part(root, "cyl", [0.4, 0.4, 0.035, 18], 0xdcae72, { p: [0, 0.168, 0], o: { rough: 0.8 } });
    for (const r of [0.14, 0.27]) part(root, "torus", [r, 0.012, 4, 24], 0xb8864e, { p: [0, 0.188, 0], r: [Math.PI / 2, 0, 0], shadow: false, outline: false });
    for (let i = 0; i < 5; i++) part(root, "cyl", [0.05, 0.07, 0.1, 6], 0x7a4e2e, { p: [Math.cos(i * 1.257) * 0.44, 0.04, Math.sin(i * 1.257) * 0.44], r: [Math.sin(i * 1.257) * 0.5, 0, -Math.cos(i * 1.257) * 0.5], shadow: false });
    if (tier === 1) part(root, "torus", [0.44, 0.03, 6, 28], 0x8a93a8, { p: [0, 0.11, 0], r: [Math.PI / 2, 0, 0], o: { rough: 0.3, metal: 0.6 } });
  } else if (tier < 3) {
    part(root, "cyl", [0.44, 0.5, 0.2, 10], 0x9ca2b2, { p: [0, 0.1, 0], o: { rough: 0.8 } });
    part(root, "cyl", [0.42, 0.44, 0.06, 10], 0xc8ccd8, { p: [0, 0.225, 0], o: { rough: 0.7 } });
    for (let i = 0; i < 3; i++) part(root, "sphere", [0.06, 8, 6], 0x86c257, { p: [Math.cos(i * 2.2 + 0.4) * 0.45, 0.13, Math.sin(i * 2.2 + 0.4) * 0.45], s: [1.3, 0.5, 1], shadow: false });
  } else {
    part(root, "cyl", [0.44, 0.5, 0.2, 24], 0xf2ece0, { p: [0, 0.1, 0], o: { rough: 0.35 } });
    part(root, "cyl", [0.42, 0.44, 0.06, 24], 0xfff8ec, { p: [0, 0.225, 0], o: { rough: 0.3 } });
    for (const y of [0.05, 0.255]) part(root, "torus", [y < 0.1 ? 0.49 : 0.43, 0.028, 6, 32], 0xffd34d, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], o: { rough: 0.25, metal: 0.7, emissive: 0xffb03a, ei: 0.2 } });
  }
  // 단계 별 (1~5) — 받침 앞에 금빛 별
  const top = tier < 2 ? 0.2 : 0.27;
  for (let i = 0; i <= tier; i++) {
    const a = (i - tier / 2) * 0.32;
    part(root, "octa", [0.055, 0], 0xffd34d, { p: [Math.sin(a) * 0.45, top - 0.06, Math.cos(a) * 0.45], s: [1, 1, 0.5], r: [0, a, 0], o: { emissive: 0xffb03a, ei: 0.9 }, shadow: false, outline: false });
  }
}

/** 병아리 몸 (궁수 · 폭탄) — 둥근 몸 · 배 · 날개 · 발 · 머리 깃털 · 볼 */
function chick(parent, color = 0xffd84d) {
  const b = group(parent, { p: [0, 0.3, 0] });
  const belly = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45).getHex();
  part(b, "sphere", [0.27, 20, 16], color, { p: [0, 0.24, 0], s: [1, 0.95, 1] });
  part(b, "sphere", [0.18, 14, 12], belly, { p: [0, 0.18, 0.12], s: [1, 1, 0.7] });
  part(b, "sphere", [0.19, 18, 14], color, { p: [0, 0.53, 0.02] });
  for (let i = 0; i < 3; i++) part(b, "cone", [0.03, 0.12, 6], color, { p: [(i - 1) * 0.035, 0.74, -0.01], r: [-0.25, 0, (i - 1) * 0.4] });
  part(b, "cone", [0.055, 0.1, 8], 0xff8a3a, { p: [0, 0.52, 0.21], r: [Math.PI / 2, 0, 0] });
  part(b, "cone", [0.04, 0.06, 8], 0xe0702a, { p: [0, 0.48, 0.19], r: [Math.PI / 2 + 0.3, 0, 0], outline: false });
  eyes(b, { y: 0.58, z: 0.14, x: 0.075, r: 0.04 });
  cheeks(b, { x: 0.13, y: 0.5, z: 0.13, r: 0.04 });
  for (const sx of [-1, 1]) {
    part(b, "sphere", [0.1, 10, 8], color, { p: [sx * 0.25, 0.24, -0.02], s: [0.42, 0.85, 1], r: [0, 0, sx * 0.25] });
    part(b, "cone", [0.04, 0.1, 6], 0xff9a3a, { p: [sx * 0.1, 0.0, 0.12], r: [Math.PI / 2, 0, 0], s: [1.3, 1, 0.6] });
  }
  return b;
}

export function buildTower(root, type, tier, evo) {
  base(root, tier);
  flatten(root); // 받침은 움직이지 않으니 한 덩어리로
  const rig = group(root, { p: [0, tier < 2 ? -0.16 : -0.1, 0], s: 1.28 }); // 겨누는 쪽으로 도는 부분 (동물은 크게)
  let anim = () => {};
  switch (type) {
    case "archer": {
      const b = chick(rig);
      const bow = group(b, { p: [0.22, 0.3, 0.16] });
      const big = evo === "pierce";
      part(bow, "torus", [big ? 0.2 : 0.16, 0.025, 6, 14, Math.PI], evo === "rapid" ? 0xd83a3a : 0x8a5a2a, { r: [0, Math.PI / 2, Math.PI / 2] });
      if (big) part(bow, "box", [0.06, 0.06, 0.5], 0x5a3a22, { p: [0, 0, 0.05] });
      const arrow = part(bow, "cyl", [0.012, 0.012, 0.36, 4], 0xfff1dc, { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.08] });
      part(b, "cyl", [0.06, 0.06, 0.28, 8], 0x8a5a2a, { p: [-0.12, 0.32, -0.2], r: [0.4, 0, 0] });
      if (evo === "rapid") {
        part(b, "torus", [0.17, 0.03, 6, 16], 0xd83a3a, { p: [0, 0.6, 0], r: [Math.PI / 2, 0, 0] });
        const bow2 = group(b, { p: [-0.22, 0.3, 0.16] });
        part(bow2, "torus", [0.14, 0.022, 6, 12, Math.PI], 0xd83a3a, { r: [0, Math.PI / 2, Math.PI / 2] });
      }
      if (evo === "pierce") {
        part(b, "cone", [0.2, 0.22, 10], 0x3a7a3a, { p: [0, 0.75, 0] });
        part(b, "leaf", [], 0xd83a3a, { p: [0.06, 0.82, 0], s: 0.25, r: [0, 0, -0.6], o: { side: true } });
      }
      if (tier >= 1 && !evo) part(b, "cone", [0.16, 0.16, 10], 0x3a8a4a, { p: [0, 0.74, 0] });
      anim = (o) => {
        const k = Math.max(0, 1 - o.since * 6);
        arrow.position.z = 0.08 - k * 0.12;
        b.position.y = 0.3 + Math.abs(S(o.t * 2.5)) * 0.02 + k * 0.03;
      };
      break;
    }
    case "bomb": {
      const b = chick(rig, evo === "fire" ? 0xffb03a : evo === "shock" ? 0xffe36a : 0xffd84d);
      part(b, "hemi", [0.2, 14], evo === "fire" ? 0xc83a1a : evo === "shock" ? 0x3a6ad8 : 0x6a7a5a, { p: [0, 0.6, 0] });
      if (evo === "shock") for (const sx of [-1, 1]) part(b, "torus", [0.05, 0.015, 6, 12], 0x2a2a2a, { p: [sx * 0.07, 0.58, 0.15], r: [0, 0, 0] });
      const bomb = part(b, "sphere", [evo === "shock" ? 0.16 : 0.13, 12, 10], 0x2a2a2a, { p: [0, 0.26, 0.28] });
      const spark = part(bomb, "sphere", [0.04, 6, 4], evo === "fire" ? 0xff5a1a : 0xffd34d, { p: [0, 0.16, 0], o: { emissive: 0xffb03a, ei: 2 }, shadow: false });
      if (evo === "fire") for (let i = 0; i < 3; i++) part(b, "cone", [0.05, 0.18, 6], 0xff7a1a, { p: [-0.08 + i * 0.08, 0.78, -0.02], o: { emissive: 0xff5a1a, ei: 1.2, opacity: 0.85 }, shadow: false });
      anim = (o) => {
        const k = Math.max(0, 1 - o.since * 3);
        bomb.visible = o.since > 0.25;
        b.rotation.x = -k * 0.4;
        spark.scale.setScalar(0.8 + S(o.t * 20) * 0.3);
      };
      break;
    }
    case "ice": {
      const b = group(rig, { p: [0, 0.27, 0] });
      part(b, "sphere", [0.24, 16, 12], 0xffffff, { p: [0, 0.22, 0], s: [1, 1, 1] });
      part(b, "sphere", [0.17, 14, 10], 0xffffff, { p: [0, 0.5, 0.02] });
      for (const sx of [-1, 1]) {
        const ear = group(b, { p: [sx * 0.08, 0.62, -0.02], r: [0, 0, -sx * 0.15] });
        part(ear, "capsule", [0.045, 0.28], 0xffffff, { p: [0, 0.16, 0] });
        part(ear, "capsule", [0.022, 0.22], 0xffb0c8, { p: [0, 0.16, 0.025] });
      }
      eyes(b, { y: 0.52, z: 0.14, x: 0.07, r: 0.04, pupil: 0xd83a6a });
      part(b, "sphere", [0.03, 6, 4], 0xff9aa8, { p: [0, 0.47, 0.17] });
      const wand = group(b, { p: [0.22, 0.26, 0.12] });
      part(wand, "cyl", [0.015, 0.015, 0.34, 6], 0xb8e8ff, { p: [0, 0.12, 0] });
      const gem = part(wand, "octa", [evo === "freezer" ? 0.09 : 0.065, 0], 0x8fe8ff, { p: [0, 0.32, 0], o: { emissive: 0x4ad8ff, ei: 1.2 } });
      if (evo === "freezer") for (let i = 0; i < 5; i++) part(b, "octa", [0.035, 0], 0xdff6ff, { p: [S(i * 1.257) * 0.12, 0.72, Math.cos(i * 1.257) * 0.12], s: [0.6, 1.6, 0.6], o: { emissive: 0x8fe8ff, ei: 0.8 } });
      if (evo === "frostField") {
        part(b, "cyl", [0.08, 0.12, 0.3, 10], 0x6fb4e8, { p: [-0.2, 0.3, 0.05], r: [-0.9, 0, 0] });
        part(b, "sphere", [0.12, 10, 8], 0xf4fbff, { p: [-0.2, 0.06, -0.12] });
      }
      if (tier >= 1 && !evo) part(b, "torus", [0.14, 0.03, 6, 14], 0x8fd0ff, { p: [0, 0.62, 0], r: [Math.PI / 2, 0, 0] });
      anim = (o) => {
        gem.rotation.y = o.t * 2;
        const k = Math.max(0, 1 - o.since * 5);
        wand.rotation.x = -k * 0.8;
        gem.scale.setScalar(1 + k * 0.6);
      };
      break;
    }
    case "lightning": {
      const b = group(rig, { p: [0, 0.27, 0] });
      part(b, "sphere", [0.22, 14, 10], 0xb87a4a, { p: [0, 0.2, 0], s: [1, 1.1, 1] });
      part(b, "sphere", [0.16, 12, 10], 0xb87a4a, { p: [0, 0.48, 0.03] });
      part(b, "sphere", [0.12, 10, 8], 0xf4e0c8, { p: [0, 0.18, 0.13], s: [1, 1.2, 0.6] });
      for (const sx of [-1, 1]) part(b, "cone", [0.05, 0.12, 6], 0xb87a4a, { p: [sx * 0.1, 0.64, 0] });
      eyes(b, { y: 0.5, z: 0.13, x: 0.065, r: 0.038 });
      const tail = group(b, { p: [0, 0.2, -0.22] });
      part(tail, "sphere", [0.2, 12, 10], 0xa86a3a, { p: [0, 0.25, -0.08], s: [0.7, 1.4, 0.7] });
      const rod = group(b, { p: [0.2, 0.25, 0.08] });
      part(rod, "cyl", [0.02, 0.02, 0.5, 6], 0x9aa3b8, { p: [0, 0.2, 0] });
      const tip = part(rod, evo === "storm" ? "torus" : "sphere", evo === "storm" ? [0.08, 0.025, 6, 12] : [0.06, 8, 6], 0xfff27a, { p: [0, 0.48, 0], o: { emissive: 0xffe36a, ei: 1.5 } });
      let cloud = null;
      if (evo === "thunder") {
        cloud = group(rig, { p: [0, 1.4, 0] });
        for (const [x, z, r] of [[0, 0, 0.2], [0.18, 0.04, 0.15], [-0.17, 0.02, 0.15]]) part(cloud, "sphere", [r, 10, 8], 0x6a6a8a, { p: [x, 0, z] });
      }
      anim = (o) => {
        tail.rotation.x = S(o.t * 3) * 0.15;
        const k = Math.max(0, 1 - o.since * 4);
        tip.scale.setScalar(1 + k * 1.2 + S(o.t * 15) * 0.1);
        if (cloud) cloud.position.y = 1.4 + S(o.t * 2) * 0.05;
      };
      break;
    }
    case "cannon": {
      const b = group(rig, { p: [0, 0.27, 0] });
      part(b, "sphere", [0.3, 16, 12], 0x8a5a3a, { p: [0, 0.24, -0.05] });
      part(b, "sphere", [0.2, 14, 10], 0x8a5a3a, { p: [0, 0.56, -0.05] });
      part(b, "sphere", [0.1, 10, 8], 0xd8b08a, { p: [0, 0.52, 0.12], s: [1, 0.8, 0.7] });
      part(b, "sphere", [0.035, 6, 4], 0x2a1a12, { p: [0, 0.55, 0.18] });
      for (const sx of [-1, 1]) part(b, "sphere", [0.07, 8, 6], 0x8a5a3a, { p: [sx * 0.15, 0.72, -0.05] });
      eyes(b, { y: 0.62, z: 0.1, x: 0.07, r: 0.035 });
      const barrels = [];
      const n = evo === "scatter" ? 3 : 1;
      const big = evo === "siege";
      for (let i = 0; i < n; i++) {
        const g = group(b, { p: [(i - (n - 1) / 2) * 0.16, 0.3, 0.2], r: [-0.25, (i - (n - 1) / 2) * -0.2, 0] });
        part(g, "cyl", [big ? 0.12 : 0.08, big ? 0.15 : 0.1, big ? 0.6 : 0.45, 12], big ? 0x3a3a4a : 0x4a4a5a, { p: [0, 0, 0.15], r: [Math.PI / 2, 0, 0] });
        part(g, "torus", [big ? 0.13 : 0.09, 0.025, 6, 14], 0xffd34d, { p: [0, 0, 0.42], r: [0, 0, 0] });
        barrels.push(g);
      }
      if (big) part(b, "box", [0.4, 0.06, 0.3], 0x5a3a22, { p: [0, 0.82, -0.05] });
      anim = (o) => {
        const k = Math.max(0, 1 - o.since * 4);
        barrels.forEach((g) => (g.position.z = 0.2 - k * 0.12));
        b.position.y = 0.27 - k * 0.04;
      };
      break;
    }
    case "healer": {
      const b = group(rig, { p: [0, 0.27, 0] });
      part(b, "sphere", [0.26, 16, 12], 0x8a7a5a, { p: [0, 0.25, 0], s: [1, 1.1, 1] });
      part(b, "sphere", [0.2, 14, 10], 0xf4e8d0, { p: [0, 0.27, 0.1], s: [1, 1.1, 0.6] });
      part(b, "sphere", [0.2, 14, 10], 0x8a7a5a, { p: [0, 0.6, 0] });
      for (const sx of [-1, 1]) part(b, "cone", [0.06, 0.14, 6], 0x6a5a3a, { p: [sx * 0.12, 0.78, 0], r: [0, 0, -sx * 0.3] });
      for (const sx of [-1, 1]) {
        part(b, "sphere", [0.075, 10, 8], 0xffffff, { p: [sx * 0.08, 0.62, 0.16] });
        part(b, "sphere", [0.045, 8, 6], 0x2a2a1a, { p: [sx * 0.08, 0.62, 0.2] });
      }
      part(b, "cone", [0.035, 0.08, 5], 0xffb03a, { p: [0, 0.55, 0.2], r: [Math.PI / 2, 0, 0] });
      const staff = group(b, { p: [0.25, 0.25, 0.1] });
      part(staff, "cyl", [0.02, 0.02, 0.6, 6], 0x6a4a2a, { p: [0, 0.2, 0] });
      const leaf = part(staff, "leaf", [], evo === "guardian" ? 0x5ad8ff : 0x5aff8a, { p: [0, 0.48, 0], s: 0.35, o: { side: true, emissive: evo === "guardian" ? 0x2ab8ff : 0x2aff6a, ei: 0.8 } });
      if (evo === "cheer") for (const sx of [-1, 1]) part(b, "sphere", [0.09, 8, 6], 0xff6ab8, { p: [sx * 0.28, 0.35, 0.1] });
      if (evo === "guardian") part(b, "cyl", [0.16, 0.16, 0.04, 6], 0x5ad8ff, { p: [-0.27, 0.3, 0.1], r: [Math.PI / 2, 0, 0], o: { emissive: 0x2ab8ff, ei: 0.5 } });
      const halo = part(root, "ring", [0.46, 0.52, 32], evo === "guardian" ? 0x5ad8ff : 0x5aff8a, { p: [0, 0.19, 0], o: { flat: true, opacity: 0.55 }, shadow: false });
      anim = (o) => {
        b.position.y = 0.27 + S(o.t * 2) * 0.02;
        leaf.rotation.z = S(o.t * 3) * 0.3;
        halo.rotation.y = o.t;
        halo.scale.setScalar(1 + S(o.t * 2) * 0.06);
      };
      break;
    }
  }
  return {
    rig,
    anim(o) {
      rig.rotation.y = o.yaw;
      anim(o);
      rig.rotation.z = o.stun ? S(o.t * 25) * 0.12 : 0;
    },
  };
}
