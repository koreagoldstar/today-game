/*
 * 골퍼: 공을 기준으로 선다 (공 = 원점 · 목표 = -z · 몸은 +x 쪽을 봄)
 *  팔과 채는 두 각도로 움직인다: theta(어깨 회전) · phi(손목 꺾임). 음수가 백스윙, 0 이 임팩트.
 */
import { THREE, std, canvas, tex } from "../../oneshot-elite/js/kit.js";

const UNIT_Y = new THREE.Vector3(0, 1, 0);
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const q1 = new THREE.Quaternion();

/** 두 점 사이에 놓이는 길쭉한 도형 (원래 높이 1 · 가운데 원점) */
function between(mesh, a, b, thick = 1) {
  v1.subVectors(b, a);
  const len = v1.length() || 1e-3;
  mesh.position.copy(a).addScaledVector(v1, 0.5);
  mesh.quaternion.setFromUnitVectors(UNIT_Y, v1.divideScalar(len));
  mesh.scale.set(thick, len, thick);
}

export function makeGolfer() {
  const root = new THREE.Group();
  const shirt = std({ color: 0xf4f5f2, roughness: 0.78 });
  const sleeve = std({ color: 0xc8352f, roughness: 0.78 });
  const pants = std({ color: 0x2b3a55, roughness: 0.85 });
  const skin = std({ color: 0xe0ac86, roughness: 0.68 });
  const shoe = std({ color: 0xf0efe9, roughness: 0.55 });
  const capM = std({ color: 0x18325c, roughness: 0.7 });
  const glove = std({ color: 0xfafafa, roughness: 0.7 });
  const steel = std({ color: 0xc9ced4, roughness: 0.28, metalness: 0.95 });
  const headM = std({ color: 0x2b2e33, roughness: 0.35, metalness: 0.75 });
  const ironM = std({ color: 0xd8dde2, roughness: 0.3, metalness: 0.95 });
  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    root.add(m);
    return m;
  };
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  const cap = new THREE.CapsuleGeometry(1, 1, 5, 12);
  const sphere = new THREE.SphereGeometry(1, 16, 12);
  // 다리 · 신발
  const thighL = add(new THREE.CylinderGeometry(0.095, 0.07, 1, 12), pants);
  const thighR = add(new THREE.CylinderGeometry(0.095, 0.07, 1, 12), pants);
  const shinL = add(new THREE.CylinderGeometry(0.07, 0.05, 1, 12), pants);
  const shinR = add(new THREE.CylinderGeometry(0.07, 0.05, 1, 12), pants);
  const shoeGeo = new THREE.SphereGeometry(1, 12, 8);
  const shoeL = add(shoeGeo, shoe);
  const shoeR = add(shoeGeo, shoe);
  const hips = add(sphere, pants);
  // 몸통
  const torso = add(new THREE.CapsuleGeometry(1, 1, 6, 14), shirt);
  const collar = add(cyl, shirt);
  const neck = add(cyl, skin);
  const head = add(sphere, skin);
  const capTop = add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), capM);
  const brim = add(new THREE.CylinderGeometry(1, 1, 0.1, 18, 1, false, -0.9, 1.8), capM);
  // 팔 (양쪽 소매 + 아래팔)
  const upperL = add(cap, sleeve);
  const upperR = add(cap, sleeve);
  const armL = add(cap, skin);
  const armR = add(cap, skin);
  const handL = add(sphere, glove);
  const handR = add(sphere, skin);
  // 채
  const shaft = add(cyl, steel);
  const grip = add(cyl, std({ color: 0x151515, roughness: 0.9 }));
  const heads = {
    wood: add(new THREE.SphereGeometry(1, 14, 10), headM),
    iron: add(new THREE.BoxGeometry(1, 1, 1), ironM),
    putter: add(new THREE.BoxGeometry(1, 1, 1), headM),
  };
  heads.wood.scale.set(0.075, 0.042, 0.056);
  heads.iron.scale.set(0.012, 0.05, 0.085);
  heads.putter.scale.set(0.05, 0.025, 0.105);
  // 내 얼굴 (머리 위 카드 — 기기 안에서만 그림)
  const fc = canvas(128, 128);
  const faceTex = tex(fc, { repeat: false });
  const faceSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: faceTex, transparent: true, depthWrite: false, fog: false }));
  faceSprite.scale.set(0.42, 0.42, 1);
  faceSprite.visible = false;
  root.add(faceSprite);

  const P = {
    feetX: -0.9,
    hip: new THREE.Vector3(),
    sh: new THREE.Vector3(),
    hand: new THREE.Vector3(),
    axis: new THREE.Vector3(),
    spine: new THREE.Vector3(),
    tilt: 0.56,
  };
  const pt = (x, y, z) => new THREE.Vector3(x, y, z);
  let kind = "iron";

  function setClub(club) {
    kind = club.putter ? "putter" : club.id === "DR" || club.id === "3W" ? "wood" : "iron";
    const reach = club.putter ? 0.52 : { DR: 1.0, "3W": 0.96, "5I": 0.88, "7I": 0.84, "9I": 0.8, PW: 0.76, SW: 0.74 }[club.id];
    P.feetX = -reach;
    P.tilt = club.putter ? 0.78 : kind === "wood" ? 0.5 : 0.62;
    const knee = club.putter ? 0.05 : 0.08;
    const hipY = 0.9 - knee;
    P.hip.set(-reach - 0.1, hipY, 0);
    P.spine.set(Math.sin(P.tilt), Math.cos(P.tilt), 0);
    P.sh.copy(P.hip).addScaledVector(P.spine, 0.54);
    // 손은 어깨에서 공 쪽으로 팔 길이만큼
    const toBall = v1.copy(P.sh).negate().normalize();
    P.hand.copy(P.sh).addScaledVector(toBall, club.putter ? 0.58 : 0.62);
    // 스윙 면: 어깨 · 공 · 목표선을 지남
    P.axis.copy(P.sh).cross(v2.set(0, 0, 1)).normalize();
    // 다리
    for (const [thigh, shin, foot, z] of [
      [thighL, shinL, shoeL, -0.2],
      [thighR, shinR, shoeR, 0.2],
    ]) {
      const h = pt(P.hip.x, hipY, z * 0.55);
      const f = pt(-reach - 0.08, 0.07, z);
      const k = pt((h.x + f.x) / 2 + knee + 0.07, (h.y + f.y) / 2, (h.z + f.z) / 2);
      between(thigh, h, k);
      between(shin, k, f);
      foot.position.set(f.x + 0.06, 0.05, z);
      foot.scale.set(0.15, 0.055, 0.058);
    }
    hips.position.copy(P.hip);
    hips.scale.set(0.16, 0.14, 0.2);
    Object.values(heads).forEach((m) => (m.visible = false));
    heads[kind].visible = true;
    setSwing(0, 0);
  }

  const shL = new THREE.Vector3();
  const shR = new THREE.Vector3();
  const hL = new THREE.Vector3();
  const hR = new THREE.Vector3();
  const clubEnd = new THREE.Vector3();
  const qTheta = new THREE.Quaternion();
  const qPhi = new THREE.Quaternion();

  /** 음수 = 백스윙 · 0 = 임팩트 · 양수 = 팔로스루 */
  function setSwing(theta, phi) {
    const twist = theta * 0.62;
    const mid = pt(0, 0, 0).copy(P.hip).addScaledVector(P.spine, 0.28);
    // 몸통 (어깨가 돌아가도록 납작하게)
    torso.position.copy(mid);
    torso.quaternion.setFromUnitVectors(UNIT_Y, P.spine);
    q1.setFromAxisAngle(P.spine, twist);
    torso.quaternion.premultiply(q1);
    torso.scale.set(0.135, 0.17, 0.2);
    // 어깨 · 손
    shL.set(0, 0, -0.205).applyQuaternion(q1).add(P.sh);
    shR.set(0, 0, 0.205).applyQuaternion(q1).add(P.sh);
    qTheta.setFromAxisAngle(P.axis, theta);
    v1.subVectors(P.hand, P.sh).applyQuaternion(qTheta).add(P.sh);
    const hand = v2.copy(v1);
    qPhi.setFromAxisAngle(P.axis, theta + phi);
    clubEnd.copy(P.hand).negate().applyQuaternion(qPhi).add(hand);
    v1.subVectors(clubEnd, hand).normalize();
    hL.copy(hand).addScaledVector(v1, -0.02);
    hR.copy(hand).addScaledVector(v1, 0.07);
    // 팔꿈치까지 소매 · 그 아래 맨팔
    const elbow = (s, h, out) => out.copy(s).lerp(h, 0.44);
    const eL = elbow(shL, hL, pt(0, 0, 0));
    const eR = elbow(shR, hR, pt(0, 0, 0));
    between(upperL, shL, eL, 0.05);
    between(upperR, shR, eR, 0.05);
    upperL.scale.y *= 0.5;
    upperR.scale.y *= 0.5;
    between(armL, eL, hL, 0.04);
    between(armR, eR, hR, 0.04);
    armL.scale.y *= 0.5;
    armR.scale.y *= 0.5;
    handL.position.copy(hL);
    handL.scale.setScalar(0.048);
    handR.position.copy(hR);
    handR.scale.setScalar(0.048);
    // 채
    const g0 = pt(0, 0, 0).copy(hand).addScaledVector(v1, -0.04);
    const g1 = pt(0, 0, 0).copy(hand).addScaledVector(v1, 0.2);
    between(shaft, g0, clubEnd, 0.0065);
    between(grip, g0, g1, 0.012);
    // 헤드 (면이 공 뒤에 오게)
    const hd = heads[kind];
    hd.position.copy(clubEnd);
    hd.quaternion.setFromAxisAngle(P.axis, theta + phi);
    if (kind === "wood") hd.position.x -= 0.0;
    if (kind === "putter") hd.position.y += 0.012;
    else hd.position.y += 0.02;
    // 목 · 머리 (공을 내려다봄)
    const top = pt(0, 0, 0).copy(P.sh).addScaledVector(P.spine, 0.045);
    const nk = pt(0, 0, 0).copy(top).addScaledVector(P.spine, 0.1);
    between(neck, top, nk, 0.052);
    between(collar, top, pt(0, 0, 0).copy(top).addScaledVector(P.spine, 0.03), 0.082);
    const look = 0.42 + P.tilt * 0.5;
    const hd2 = pt(Math.sin(look), Math.cos(look), 0);
    const hc = pt(0, 0, 0).copy(nk).addScaledVector(hd2, 0.11);
    if (theta > 0.8) hc.z -= Math.min(0.05, (theta - 0.8) * 0.05);
    head.position.copy(hc);
    head.scale.set(0.105, 0.118, 0.1);
    capTop.position.copy(hc);
    capTop.quaternion.setFromUnitVectors(UNIT_Y, hd2);
    capTop.scale.set(0.111, 0.115, 0.107);
    brim.position.copy(hc).addScaledVector(hd2, 0.018);
    brim.position.x += 0.052;
    brim.quaternion.setFromUnitVectors(UNIT_Y, hd2);
    brim.rotateY(Math.PI / 2);
    brim.scale.set(0.135, 0.09, 0.135);
    faceSprite.position.copy(hc);
    faceSprite.position.y += 0.03;
  }

  /** 내 얼굴을 켜면 머리 위치에 얼굴 카드 (사진은 기기 안 캔버스에서만 쓰임) */
  function refreshFace() {
    const on = Boolean(window.TodayFace && window.TodayFace.ready && window.TodayFace.ready());
    faceSprite.visible = false;
    if (!on) return;
    const g = fc.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    if (window.TodayFace.drawHead(g, 64, 64, 54, { ring: 6, ringColor: "#fff" })) {
      faceTex.needsUpdate = true;
      faceSprite.visible = true;
    }
  }

  setClub({ id: "7I" });
  return {
    root,
    setClub,
    setSwing,
    refreshFace,
    place(x, y, z, yaw) {
      root.position.set(x, y, z);
      root.rotation.y = -yaw;
    },
  };
}
