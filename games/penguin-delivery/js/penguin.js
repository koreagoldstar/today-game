/*
 * 아기 펭귄 택배 기사: 몸 전체가 이음매 없이 휘는 말랑한 고무 장난감.
 *  몸통 + 머리는 한 덩어리 메시이고 정점 셰이더로 구부린다 (관절 없음).
 *  모든 동작은 목표 자세를 정하면 스프링이 따라가므로 동작끼리 자연스럽게 이어진다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export function toyMat(opts = {}, quality = "high") {
  const { color = 0xffffff, rough = 0.42, coat = 0.55, map = null, sheen = 0, ...rest } = opts;
  if (quality === "high") {
    return new THREE.MeshPhysicalMaterial({ color, map, roughness: rough, clearcoat: coat, clearcoatRoughness: 0.38, sheen, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff), ...rest });
  }
  return new THREE.MeshStandardMaterial({ color, map, roughness: rough * 0.9, ...rest });
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

/** 몸통 무늬: 짙은 남색 등, 크림색 배, 하트 모양 얼굴, 볼터치 (u=0.5 가 앞) */
function bodyTexture() {
  const [c, g] = canvas(1024, 1024);
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#35528f");
  grad.addColorStop(0.55, "#2c4579");
  grad.addColorStop(1, "#223660");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  const soft = (fn, col) => {
    g.save();
    g.fillStyle = col;
    if ("filter" in g) g.filter = "blur(5px)";
    fn();
    g.restore();
  };
  // v: 0(아래)~1(위) 를 그림 y 로 (flipY)
  const Y = (v) => (1 - v) * 1024;
  // 배
  soft(() => {
    g.beginPath();
    g.ellipse(512, Y(0.3), 182, 262, 0, 0, TAU);
    g.fill();
  }, "#fff6e6");
  // 얼굴: 두 눈 위가 볼록한 하트 모양
  soft(() => {
    g.beginPath();
    g.ellipse(430, Y(0.745), 112, 100, 0.12, 0, TAU);
    g.ellipse(594, Y(0.745), 112, 100, -0.12, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(512, Y(0.67), 170, 92, 0, 0, TAU);
    g.fill();
  }, "#fff9ef");
  // 볼터치
  for (const x of [372, 652]) {
    const r = g.createRadialGradient(x, Y(0.655), 2, x, Y(0.655), 52);
    r.addColorStop(0, "rgba(255,125,135,.8)");
    r.addColorStop(1, "rgba(255,125,135,0)");
    g.fillStyle = r;
    g.fillRect(x - 60, Y(0.655) - 60, 120, 120);
  }
  // 배 아래 그림자, 윗머리 빛
  const b = g.createLinearGradient(0, Y(0.2), 0, Y(0.02));
  b.addColorStop(0, "rgba(30,40,80,0)");
  b.addColorStop(1, "rgba(30,40,80,.28)");
  g.fillStyle = b;
  g.fillRect(0, Y(0.2), 1024, 1024 - Y(0.2));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 눈 표정 묶음: 4×2 칸 */
const EYES = { normal: 0, closed: 1, happy: 2, dizzy: 3, wow: 4, sad: 5, sharp: 6, blink: 1 };
function eyeTexture() {
  const S = 256;
  const [c, g] = canvas(S * 4, S * 2);
  const cell = (i) => [(i % 4) * S, Math.floor(i / 4) * S];
  const skin = "#fff9ef";
  const ink = "#1b1626";
  const pupil = (x, y, rx, ry) => {
    const grd = g.createRadialGradient(x, y + ry * 0.55, 8, x, y, Math.max(rx, ry));
    grd.addColorStop(0, "#6b4331");
    grd.addColorStop(0.42, "#2a1a23");
    grd.addColorStop(1, "#0c0a14");
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
  };
  const shine = (x, y, r, a = 1) => {
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };
  // 0: 큰 반짝 눈
  {
    const [x, y] = cell(0);
    g.fillStyle = skin;
    g.fillRect(x, y, S, S);
    pupil(x + 128, y + 128, 112, 122);
    shine(x + 92, y + 78, 40);
    shine(x + 166, y + 170, 19, 0.9);
    shine(x + 118, y + 196, 9, 0.75);
  }
  // 1: 감은 눈
  {
    const [x, y] = cell(1);
    g.fillStyle = skin;
    g.fillRect(x, y, S, S);
    g.strokeStyle = ink;
    g.lineWidth = 20;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x + 40, y + 130);
    g.quadraticCurveTo(x + 128, y + 180, x + 216, y + 130);
    g.stroke();
  }
  // 2: 웃는 눈 ^ ^
  {
    const [x, y] = cell(2);
    g.fillStyle = skin;
    g.fillRect(x, y, S, S);
    g.strokeStyle = ink;
    g.lineWidth = 26;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x + 36, y + 158);
    g.quadraticCurveTo(x + 128, y + 44, x + 220, y + 158);
    g.stroke();
  }
  // 3: 어지러운 눈 (소용돌이)
  {
    const [x, y] = cell(3);
    g.fillStyle = skin;
    g.fillRect(x, y, S, S);
    g.strokeStyle = ink;
    g.lineWidth = 15;
    g.lineCap = "round";
    g.beginPath();
    for (let a = 0; a < TAU * 2.5; a += 0.15) {
      const r = 6 + a * 6.2;
      const px = x + 128 + Math.cos(a) * r;
      const py = y + 128 + Math.sin(a) * r;
      if (a === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }
  // 4: 깜짝 놀란 눈
  {
    const [x, y] = cell(4);
    g.fillStyle = "#ffffff";
    g.fillRect(x, y, S, S);
    pupil(x + 128, y + 128, 62, 68);
    shine(x + 106, y + 98, 24);
    shine(x + 150, y + 156, 10, 0.85);
    g.strokeStyle = "rgba(30,30,60,.3)";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(x + 128, y + 128, 118, 0, TAU);
    g.stroke();
  }
  // 5: 시무룩한 눈
  {
    const [x, y] = cell(5);
    g.fillStyle = skin;
    g.fillRect(x, y, S, S);
    pupil(x + 128, y + 148, 100, 100);
    shine(x + 96, y + 118, 30);
    shine(x + 160, y + 190, 15, 0.9);
    g.fillStyle = skin;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + S, y);
    g.lineTo(x + S, y + 92);
    g.lineTo(x, y + 44);
    g.closePath();
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(x + 18, y + 48);
    g.lineTo(x + 238, y + 92);
    g.stroke();
  }
  // 6: 씩씩한 눈 (달릴 때)
  {
    const [x, y] = cell(6);
    g.fillStyle = skin;
    g.fillRect(x, y, S, S);
    pupil(x + 128, y + 138, 106, 108);
    shine(x + 96, y + 104, 34);
    shine(x + 164, y + 176, 15, 0.9);
    g.fillStyle = skin;
    g.fillRect(x, y, S, 44);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 스프링 값 */
class Spring {
  constructor(v = 0, k = 170, d = 17) {
    this.x = v;
    this.v = 0;
    this.t = v;
    this.k = k;
    this.d = d;
  }
  step(dt) {
    const a = (this.t - this.x) * this.k - this.v * this.d;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

const bendPatch = (mat, uniforms, extra = "") => {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace(
      "#include <common>",
      `#include <common>
      uniform vec3 uBend;
      uniform float uTwist;
      vec3 pdDeform(vec3 p){
        float a = uTwist * smoothstep(0.6, 0.88, p.y);
        float c = cos(a), s = sin(a);
        p.xz = mat2(c, -s, s, c) * p.xz;
        float h = max(0.0, p.y - 0.12) / 1.1;
        p.x += uBend.x * h * h;
        p.z += uBend.z * h * h;
        return p;
      }`
    );
    sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n transformed = pdDeform(transformed);${extra}`);
  };
  return mat;
};

function ball(r, sx = 1, sy = 1, sz = 1, seg = 24) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(10, seg - 6));
  g.scale(sx, sy, sz);
  return g;
}

/** 꾸미기 목록: 값은 금빛 생선 */
export const COSTUMES = [
  { id: "courier", name: "택배 기사", price: 0, desc: "기본 모자와 가방" },
  { id: "bunny", name: "토끼 귀", price: 40, desc: "쫑긋쫑긋 흔들려요" },
  { id: "shades", name: "선글라스", price: 60, desc: "멋진 펭귄" },
  { id: "chef", name: "셰프", price: 90, desc: "높은 모자와 빨간 스카프" },
  { id: "santa", name: "산타", price: 120, desc: "오늘의 택배는 선물이에요" },
  { id: "explorer", name: "탐험가", price: 160, desc: "사파리 모자와 고글" },
  { id: "pirate", name: "해적", price: 220, desc: "삼각 모자와 안대" },
  { id: "space", name: "우주", price: 300, desc: "둥근 헬멧과 안테나" },
  { id: "crown", name: "왕관", price: 450, desc: "오로라 왕국의 왕관" },
];

export class Penguin {
  constructor(quality = "high") {
    this.q = quality;
    this.group = new THREE.Group(); // 땅 위치 · 방향
    this.pivot = new THREE.Group(); // 앞뒤로 눕고 도는 축
    this.group.add(this.pivot);
    this.body = new THREE.Group();
    this.pivot.add(this.body);
    this.pivot.position.y = 0.48;
    this.body.position.y = -0.48;
    this.u = { uBend: { value: new THREE.Vector3() }, uTwist: { value: 0 } };
    this.costume = "courier";
    this.expr = "normal";
    this.exprT = 0;
    this.blinkT = 2;
    this.lookT = 2;
    this.phase = 0;
    this.t = 0;
    this.gaze = { x: 0, y: 0, tx: 0, ty: 0 };
    this.danceT = 0;
    this.once = { drop: 0, catch: 0, pick: 0, land: 0, wave: 0 };
    this.buildSprings();
    this.buildBody();
    this.setCostume("courier");
  }
  buildSprings() {
    const S = (v, k, d) => new Spring(v, k, d);
    this.s = {
      hop: S(0, 260, 20),
      squash: S(0, 240, 13),
      pitch: S(0, 120, 14),
      roll: S(0, 150, 13),
      bendX: S(0, 130, 10),
      bendZ: S(0, 130, 10),
      twist: S(0, 110, 12),
      nod: S(0, 120, 11),
      headRoll: S(0, 110, 10),
      lift: S(0, 240, 20),
      flipLr: S(0.3, 190, 14),
      flipRr: S(0.3, 190, 14),
      flipLs: S(0, 170, 13),
      flipRs: S(0, 170, 13),
      curlL: S(0, 140, 10),
      curlR: S(0, 140, 10),
      footLy: S(0, 340, 24),
      footRy: S(0, 340, 24),
      footLz: S(0, 340, 24),
      footRz: S(0, 340, 24),
      footLp: S(0, 280, 20),
      footRp: S(0, 280, 20),
      mouth: S(0, 280, 18),
      snow: S(0, 160, 15),
      spinAdd: S(0, 300, 30),
    };
  }
  buildBody() {
    const q = this.q;
    // 머리 + 몸통 한 덩어리
    const prof = [
      [0.001, 0.07],
      [0.2, 0.08],
      [0.36, 0.17],
      [0.445, 0.31],
      [0.465, 0.46],
      [0.425, 0.6],
      [0.385, 0.695],
      [0.395, 0.76],
      [0.442, 0.86],
      [0.462, 0.97],
      [0.44, 1.08],
      [0.36, 1.18],
      [0.22, 1.25],
      [0.001, 1.28],
    ].map((a) => new THREE.Vector2(a[0], a[1]));
    const spline = new THREE.SplineCurve(prof);
    const pts = spline.getPoints(q === "low" ? 26 : 44);
    const geo = new THREE.LatheGeometry(pts, q === "low" ? 28 : 48, Math.PI);
    geo.computeVertexNormals();
    // 텍스처 v 를 실제 높이에 맞춤
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i += 1) uv.setY(i, clamp((pos.getY(i) - 0.07) / 1.21, 0, 1));
    this.bodyTex = bodyTexture();
    const skin = bendPatch(toyMat({ map: this.bodyTex, rough: 0.46, coat: 0.42 }, q), this.u);
    this.skin = new THREE.Mesh(geo, skin);
    this.skin.castShadow = true;
    this.skin.customDepthMaterial = bendPatch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), this.u);
    this.body.add(this.skin);
    // 꼬리
    const tail = new THREE.Mesh(ball(0.13, 0.9, 0.55, 1.3, 14), toyMat({ color: 0x2a4274, rough: 0.5 }, q));
    tail.position.set(0, 0.2, -0.42);
    tail.rotation.x = -0.5;
    tail.castShadow = true;
    this.body.add(tail);
    this.tail = tail;
    // 머리 묶음 (셰이더와 같은 식으로 따라감)
    this.head = new THREE.Group();
    this.head.position.y = 0.94;
    this.body.add(this.head);
    // 눈: 평면 투영 UV 의 납작한 공
    this.eyeTex = eyeTexture();
    const eyeGeo = new THREE.SphereGeometry(0.128, 24, 18);
    eyeGeo.scale(1, 1.14, 0.56);
    const eUv = eyeGeo.attributes.uv;
    const ep = eyeGeo.attributes.position;
    for (let i = 0; i < eUv.count; i += 1) eUv.setXY(i, ep.getX(i) / 0.256 + 0.5, ep.getY(i) / (0.256 * 1.14) + 0.5);
    this.eyes = [];
    for (const side of [-1, 1]) {
      const tex = this.eyeTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(0.25, 0.5);
      tex.offset.set(0, 0.5);
      const m = toyMat({ map: tex, rough: 0.12, coat: 1 }, q);
      m.emissive = new THREE.Color(0xffffff);
      m.emissiveMap = tex;
      m.emissiveIntensity = 0.16;
      const e = new THREE.Mesh(eyeGeo, m);
      e.position.set(side * 0.178, 0.015, 0.378);
      e.rotation.y = side * 0.42;
      e.rotation.order = "YXZ";
      e.userData = { side, tex };
      this.head.add(e);
      this.eyes.push(e);
    }
    // 부리
    const orange = toyMat({ color: 0xff9d24, rough: 0.34, coat: 0.7 }, q);
    const beakUp = new THREE.Mesh(ball(0.1, 1.18, 0.62, 1.12, 18), orange);
    beakUp.position.set(0, -0.085, 0.44);
    beakUp.castShadow = true;
    this.head.add(beakUp);
    this.beakLow = new THREE.Group();
    this.beakLow.position.set(0, -0.115, 0.4);
    const low = new THREE.Mesh(ball(0.08, 1.12, 0.45, 1.08, 14), toyMat({ color: 0xf58512, rough: 0.4, coat: 0.5 }, q));
    low.position.z = 0.04;
    this.beakLow.add(low);
    const inner = new THREE.Mesh(ball(0.06, 1.1, 0.4, 1, 12), new THREE.MeshStandardMaterial({ color: 0xa8324a, roughness: 0.6 }));
    inner.position.set(0, 0.012, 0.03);
    this.beakLow.add(inner);
    this.head.add(this.beakLow);
    // 눈물
    this.tear = new THREE.Mesh(ball(0.035, 0.85, 1.25, 0.7, 10), new THREE.MeshPhysicalMaterial({ color: 0x8fd8ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9 }));
    this.tear.visible = false;
    this.head.add(this.tear);

    // 날개: 끝으로 갈수록 부드럽게 휜다
    this.flips = [];
    const flipGeo = new THREE.SphereGeometry(0.1, 16, 20);
    flipGeo.scale(0.72, 2.75, 1.32);
    flipGeo.translate(0, -0.24, 0);
    for (const side of [-1, 1]) {
      const uu = { uCurl: { value: 0 } };
      const mat = toyMat({ color: 0x2c4579, rough: 0.46, coat: 0.45 }, q);
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uu);
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uCurl;");
        sh.vertexShader = sh.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float tt = clamp(-transformed.y / 0.5, 0.0, 1.0);
          transformed.x += uCurl * tt * tt * 0.5;
          transformed.y *= 1.0 - abs(uCurl) * tt * 0.16;`
        );
      };
      const m = new THREE.Mesh(flipGeo, mat);
      m.castShadow = true;
      const j = new THREE.Group();
      j.position.set(side * 0.405, 0.665, 0.01);
      j.add(m);
      j.rotation.order = "ZXY";
      this.body.add(j);
      this.flips.push({ j, m, uu, side });
    }

    // 발
    const footMat = toyMat({ color: 0xff9620, rough: 0.38, coat: 0.65 }, q);
    const footGeo = (() => {
      const main = ball(0.115, 1.08, 0.46, 1.42, 14);
      main.translate(0, 0.045, 0.06);
      return main;
    })();
    this.feet = [];
    for (const side of [-1, 1]) {
      const f = new THREE.Group();
      const m = new THREE.Mesh(footGeo, footMat);
      m.castShadow = true;
      f.add(m);
      for (const a of [-1, 0, 1]) {
        const toe = new THREE.Mesh(ball(0.052, 1, 0.7, 1.3, 10), footMat);
        toe.position.set(a * 0.073, 0.033, 0.195 - Math.abs(a) * 0.022);
        toe.rotation.y = a * 0.35;
        f.add(toe);
      }
      const stub = new THREE.Mesh(ball(0.075, 1, 1.25, 1, 10), footMat);
      stub.position.set(0, 0.1, -0.02);
      f.add(stub);
      f.position.set(side * 0.19, 0, 0.03);
      f.rotation.y = side * 0.14;
      this.body.add(f);
      this.feet.push({ f, side });
    }

    // 눈덩이 옷 (눈덩이에 맞았을 때)
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    this.snowBody = new THREE.Mesh(ball(0.66, 1, 0.92, 1, 20), snowMat);
    this.snowBody.position.y = 0.46;
    this.snowHead = new THREE.Mesh(ball(0.54, 1, 0.95, 1, 18), snowMat);
    this.snowHead.position.y = 1.08;
    this.snowHead.castShadow = this.snowBody.castShadow = true;
    this.body.add(this.snowBody, this.snowHead);
    this.snowBody.visible = this.snowHead.visible = false;
    // 어지러운 별
    this.stars = new THREE.Group();
    const starM = new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0xffb000, emissiveIntensity: 0.55, roughness: 0.4 });
    const starG = starGeo(0.085, 0.04, 0.03);
    for (let i = 0; i < 4; i += 1) {
      const s = new THREE.Mesh(starG, starM);
      this.stars.add(s);
    }
    this.stars.visible = false;
    this.group.add(this.stars);
    // 옷 자리
    this.wear = new THREE.Group();
    this.head.add(this.wear);
    this.bodyWear = new THREE.Group();
    this.body.add(this.bodyWear);
  }
  /** 몸 휘는 식과 같은 위치 (머리 · 어깨가 함께 움직이게) */
  bendAt(y, out) {
    const h = Math.max(0, y - 0.12) / 1.1;
    const b = this.u.uBend.value;
    out.x = b.x * h * h;
    out.z = b.z * h * h;
    out.sx = (2 * h * b.x) / 1.1;
    out.sz = (2 * h * b.z) / 1.1;
    return out;
  }
  setExpr(name, hold = 0) {
    this.expr = name;
    this.exprT = hold;
    this.applyEye(name);
  }
  applyEye(name) {
    const i = EYES[name] === undefined ? 0 : EYES[name];
    for (const e of this.eyes) {
      e.userData.tex.offset.set((i % 4) * 0.25, i < 4 ? 0.5 : 0);
    }
  }
  trigger(name, t = 0.5) {
    this.once[name] = t;
  }
  setCostume(id) {
    this.costume = id;
    for (const g of [this.wear, this.bodyWear]) {
      while (g.children.length) {
        const c = g.children.pop();
        c.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
        });
      }
    }
    const q = this.q;
    const M = (color, rough = 0.42, coat = 0.5, extra = {}) => toyMat({ color, rough, coat, ...extra }, q);
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = this.wear) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const lathe = (pts, seg = 28) => {
      const up = pts[0][1] <= pts[pts.length - 1][1] ? pts : pts.slice().reverse();
      return new THREE.LatheGeometry(new THREE.SplineCurve(up.map((a) => new THREE.Vector2(a[0], a[1]))).getPoints(20), seg);
    };
    const scarf = (col, col2) => {
      const t = new THREE.TorusGeometry(0.385, 0.085, 12, 34);
      t.rotateX(Math.PI / 2);
      const mat = bendPatch(M(col, 0.72, 0.1), this.u);
      add(t, mat, 0, 0.69, 0.005, 0, 0, 0, this.bodyWear);
      add(ball(0.11, 0.9, 1.5, 0.45, 12), bendPatch(M(col2 || col, 0.72, 0.1), this.u), 0.2, 0.47, 0.37, 0.25, 0, 0.18, this.bodyWear);
    };
    const bag = (color = 0xf0b23a) => {
      // 뒤에서도 잘 보이는 작은 택배 배낭
      const Bm = (c, r = 0.5, co = 0.35) => bendPatch(M(c, r, co), this.u);
      const box = new THREE.BoxGeometry(0.5, 0.46, 0.2, 4, 4, 3);
      roundBox(box, 0.5, 0.46, 0.2, 0.08);
      add(box, Bm(color), 0, 0.42, -0.45, -0.06, 0, 0, this.bodyWear);
      const lid = new THREE.BoxGeometry(0.52, 0.17, 0.23, 3, 2, 2);
      roundBox(lid, 0.52, 0.17, 0.23, 0.07);
      add(lid, Bm(0xe9463c), 0, 0.59, -0.45, -0.06, 0, 0, this.bodyWear);
      const pocket = new THREE.BoxGeometry(0.3, 0.17, 0.07, 2, 2, 1);
      roundBox(pocket, 0.3, 0.17, 0.07, 0.03);
      add(pocket, Bm(0xfff6dc), 0, 0.36, -0.57, -0.06, 0, 0, this.bodyWear);
      for (const sx of [-1, 1]) {
        // 어깨 끈: 등에서 어깨까지만 보임
        const st = new THREE.TorusGeometry(0.47, 0.03, 8, 22, 2.5);
        st.rotateZ(-0.5);
        st.rotateY(Math.PI / 2);
        add(st, Bm(0xc97f26, 0.6, 0.2), sx * 0.2, 0.5, 0, 0, 0, sx * 0.05, this.bodyWear);
      }
    };
    const courierCap = () => {
      const r = M(0xdb3028, 0.46, 0.3);
      add(lathe([[0.001, 0.25], [0.17, 0.24], [0.29, 0.17], [0.365, 0.07], [0.375, 0.0]]), r, 0, 0.255, -0.03, -0.1);
      add(new THREE.TorusGeometry(0.372, 0.032, 10, 40).rotateX(Math.PI / 2), M(0xffffff, 0.5, 0.3), 0, 0.262, -0.03, -0.1);
      const visor = ball(0.23, 1.06, 0.15, 0.88, 20);
      const v = add(visor, M(0xb9261f, 0.42, 0.4), 0, 0.262, 0.335, 0.16);
      v.castShadow = true;
      // 작은 상자 표시
      const em = new THREE.BoxGeometry(0.13, 0.11, 0.04, 2, 2, 1);
      roundBox(em, 0.13, 0.11, 0.04, 0.016);
      add(em, M(0xffc62e, 0.4, 0.5), 0, 0.4, 0.255, -0.5);
    };
    switch (id) {
      case "bunny": {
        courierCap();
        const white = M(0xfffbf4, 0.6, 0.2);
        const pink = M(0xffa9c0, 0.6, 0.2);
        this.ears = [];
        for (const side of [-1, 1]) {
          const j = new THREE.Group();
          j.position.set(side * 0.17, 0.4, -0.07);
          j.rotation.z = -side * 0.14;
          add(ball(0.09, 0.8, 2.6, 0.5, 14), white, 0, 0.21, 0);
          const a = this.wear.children[this.wear.children.length - 1];
          this.wear.remove(a);
          j.add(a);
          const b = new THREE.Mesh(ball(0.055, 0.8, 2.6, 0.3, 12), pink);
          b.position.set(0, 0.21, 0.03);
          j.add(b);
          this.wear.add(j);
          this.ears.push({ j, side });
        }
        bag();
        break;
      }
      case "shades": {
        courierCap();
        const black = M(0x12121c, 0.12, 1);
        for (const side of [-1, 1]) {
          add(ball(0.135, 1.15, 0.86, 0.3, 18), black, side * 0.178, 0.025, 0.44, 0, side * 0.34, 0);
          add(ball(0.04, 1, 0.6, 0.2, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), side * 0.14, 0.07, 0.49, 0, side * 0.34, 0);
        }
        add(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 6).rotateZ(Math.PI / 2), black, 0, 0.05, 0.445);
        bag(0x6d82e8);
        break;
      }
      case "chef": {
        const white = M(0xffffff, 0.68, 0.15);
        add(new THREE.CylinderGeometry(0.29, 0.31, 0.2, 26, 1, true), white, 0, 0.32, -0.02, -0.08);
        const top = lathe([[0.001, 0.26], [0.2, 0.25], [0.36, 0.14], [0.37, 0.03], [0.28, -0.04]]);
        add(top, white, 0, 0.42, -0.04, -0.08);
        add(new THREE.TorusGeometry(0.305, 0.03, 10, 30).rotateX(Math.PI / 2), M(0xf2f2f2, 0.7, 0.1), 0, 0.235, -0.02, -0.08);
        scarf(0xe63a44, 0xc92a3a);
        break;
      }
      case "santa": {
        const red = M(0xd92b34, 0.72, 0.15);
        const white = M(0xffffff, 0.92, 0);
        const cone = new THREE.ConeGeometry(0.32, 0.56, 22, 8);
        cone.translate(0, 0.28, 0);
        const p = cone.attributes.position;
        for (let i = 0; i < p.count; i += 1) {
          const y = p.getY(i);
          const k = (y / 0.56) ** 2;
          p.setX(i, p.getX(i) + k * 0.26);
          p.setY(i, y - k * 0.14);
        }
        cone.computeVertexNormals();
        add(cone, red, 0, 0.26, -0.02, -0.08);
        add(new THREE.TorusGeometry(0.32, 0.075, 12, 30).rotateX(Math.PI / 2), white, 0, 0.25, -0.02, -0.08);
        add(ball(0.09, 1, 1, 1, 12), white, 0.27, 0.68, -0.05);
        scarf(0x28a35a, 0xd92b34);
        break;
      }
      case "explorer": {
        const tan = M(0xc7a26a, 0.72, 0.1);
        add(lathe([[0.001, 0.2], [0.17, 0.19], [0.28, 0.11], [0.32, 0.01]]), tan, 0, 0.25, -0.02, -0.1);
        add(ball(0.5, 1, 0.07, 1, 28), tan, 0, 0.25, -0.02, -0.1);
        add(new THREE.TorusGeometry(0.318, 0.028, 8, 30).rotateX(Math.PI / 2), M(0x6b4a24, 0.55, 0.2), 0, 0.28, -0.02, -0.1);
        for (const side of [-1, 1]) {
          add(new THREE.TorusGeometry(0.075, 0.024, 8, 18), M(0x7a5a30, 0.4, 0.5), side * 0.1, 0.37, 0.25, -0.5);
          add(ball(0.068, 1, 1, 0.3, 12), new THREE.MeshPhysicalMaterial({ color: 0x8fdcff, roughness: 0.1, clearcoat: 1 }), side * 0.1, 0.37, 0.25, -0.5);
        }
        bag(0x8a7a42);
        break;
      }
      case "pirate": {
        const black = M(0x20202c, 0.55, 0.3);
        const hat = lathe([[0.001, 0.22], [0.18, 0.21], [0.29, 0.12], [0.32, 0.01]]);
        add(hat, black, 0, 0.25, -0.02, -0.08);
        const brim = ball(0.5, 1.05, 0.2, 0.7, 24);
        const bp = brim.attributes.position;
        for (let i = 0; i < bp.count; i += 1) {
          const x = bp.getX(i);
          const z = bp.getZ(i);
          bp.setY(i, bp.getY(i) + (x * x) * 0.75 + (z < 0 ? -z * 0.25 : z * 0.1));
        }
        brim.computeVertexNormals();
        add(brim, black, 0, 0.27, 0, -0.06);
        const skull = new THREE.Mesh(ball(0.07, 1, 0.95, 0.35, 12), M(0xfffbf0, 0.6, 0.2));
        skull.position.set(0, 0.37, 0.3);
        skull.rotation.x = -0.3;
        this.wear.add(skull);
        add(ball(0.13, 1, 1.05, 0.26, 16), M(0x14141e, 0.6, 0.2), 0.18, 0.03, 0.44, 0, 0.36, 0);
        const strap = new THREE.TorusGeometry(0.44, 0.012, 6, 40);
        strap.rotateX(Math.PI / 2 + 0.08);
        strap.rotateZ(-0.12);
        add(strap, M(0x14141e, 0.6, 0.2), 0, 0.08, -0.01);
        scarf(0xc8352e, 0x8a241f);
        break;
      }
      case "space": {
        const dome = new THREE.Mesh(ball(0.6, 1, 0.94, 1, 28), new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.04, transmission: q === "high" ? 0.0 : 0, transparent: true, opacity: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, metalness: 0.0, depthWrite: false }));
        dome.position.set(0, 0.035, 0);
        this.wear.add(dome);
        add(new THREE.TorusGeometry(0.44, 0.075, 12, 34).rotateX(Math.PI / 2), M(0xf2f6ff, 0.35, 0.7), 0, -0.26, 0, 0.0);
        add(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8), M(0xdfe5f0, 0.3, 0.6), 0.24, 0.62, 0);
        add(ball(0.055, 1, 1, 1, 12), new THREE.MeshStandardMaterial({ color: 0xff5d5d, emissive: 0xff2d2d, emissiveIntensity: 0.9 }), 0.24, 0.76, 0);
        const pack = new THREE.BoxGeometry(0.46, 0.5, 0.2, 3, 3, 3);
        roundBox(pack, 0.46, 0.5, 0.2, 0.07);
        add(pack, bendPatch(M(0xf0f4fb, 0.38, 0.6), this.u), 0, 0.47, -0.47, 0, 0, 0, this.bodyWear);
        break;
      }
      case "crown": {
        const gold = toyMat({ color: 0xffc62e, rough: 0.2, coat: 1, metalness: 0.65 }, q);
        const c = new THREE.CylinderGeometry(0.285, 0.25, 0.25, 8, 3, true);
        const p = c.attributes.position;
        for (let i = 0; i < p.count; i += 1) {
          if (p.getY(i) > 0.1) {
            const a = Math.atan2(p.getZ(i), p.getX(i));
            p.setY(i, p.getY(i) + Math.cos(a * 4) * 0.075);
          }
        }
        c.computeVertexNormals();
        const crown = add(c, gold, 0, 0.38, -0.02, -0.08);
        crown.material.side = THREE.DoubleSide;
        for (let i = 0; i < 4; i += 1) {
          const a = (i / 4) * TAU;
          add(ball(0.045, 1, 1, 1, 10), toyMat({ color: [0xff3d6e, 0x41c6ff, 0x62e07a, 0xc77dff][i], rough: 0.1, coat: 1 }, q), Math.sin(a) * 0.275, 0.37, Math.cos(a) * 0.275 - 0.02);
        }
        // 망토
        const capeG = new THREE.PlaneGeometry(0.9, 0.86, 8, 8);
        const cp = capeG.attributes.position;
        for (let i = 0; i < cp.count; i += 1) {
          const x = cp.getX(i);
          cp.setZ(i, -Math.abs(x) * Math.abs(x) * 0.5 + Math.sin(x * 9) * 0.015);
          cp.setX(i, x * (1 + (0.43 - cp.getY(i)) * 0.3));
        }
        capeG.computeVertexNormals();
        const cape = add(capeG, bendPatch(toyMat({ color: 0xc4213f, rough: 0.5, coat: 0.25, side: THREE.DoubleSide }, q), this.u), 0, 0.33, -0.43, 0.09, 0, 0, this.bodyWear);
        cape.renderOrder = 1;
        scarf(0xf5efe0, 0xf5efe0);
        break;
      }
      default:
        courierCap();
        bag();
        break;
    }
  }
  /**
   * 한 프레임 동작. S: 상태 값
   *  mode, speed(m/s), run(0~1), grounded, vy, air, slip, slipA, carrying, tiltX/Z(몸 기준), surf, lost(택배 없음), danger
   */
  update(dt, S) {
    this.t += dt;
    const T = this.t;
    const s = this.s;
    const once = this.once;
    for (const k of Object.keys(once)) if (once[k] > 0) once[k] -= dt;
    const run = clamp(S.speed / 6, 0, 1.6);
    const carrying = S.carrying > 0;
    const moving = S.speed > 0.35 && S.grounded;
    // 걸음 주기
    const stepRate = lerp(5, 15, clamp(S.speed / 8, 0, 1));
    if (moving) this.phase += dt * stepRate * (S.slip > 0.45 ? 1.8 : 1);
    const ph = this.phase;
    const sL = Math.sin(ph);
    const sR = Math.sin(ph + Math.PI);
    // 기본값 (대기)
    const br = Math.sin(T * 2.1);
    let t = {
      hop: 0,
      squash: br * 0.018,
      pitch: 0,
      roll: Math.sin(T * 1.1) * 0.02,
      bendX: Math.sin(T * 0.9) * 0.015,
      bendZ: 0.02,
      twist: 0,
      nod: Math.sin(T * 1.6) * 0.012,
      headRoll: Math.sin(T * 1.3) * 0.02,
      lift: 0,
      flipLr: 0.22 + br * 0.03,
      flipRr: 0.22 - br * 0.03,
      flipLs: 0,
      flipRs: 0,
      curlL: 0.2,
      curlR: -0.2,
      footLy: 0,
      footRy: 0,
      footLz: 0,
      footRz: 0,
      footLp: 0,
      footRp: 0,
      mouth: 0,
    };
    let expr = "normal";
    // 대기 중 두리번
    this.lookT -= dt;
    if (this.lookT <= 0) {
      this.lookT = 1.4 + Math.random() * 2.6;
      const on = Math.random();
      this.gaze.tx = on < 0.55 ? (Math.random() - 0.5) * 0.9 : 0;
      this.gaze.ty = on < 0.55 ? (Math.random() - 0.4) * 0.3 : 0;
    }
    if (S.mode === "run" || S.mode === "slide") {
      if (S.grounded) {
        if (moving) {
          // 뒤뚱뒤뚱 걷기 → 빠르게 달리기
          const lift = lerp(0.1, 0.17, clamp(run, 0, 1));
          t.footLy = Math.max(0, sL) * lift;
          t.footRy = Math.max(0, sR) * lift;
          t.footLz = Math.cos(ph) * lerp(0.09, 0.2, clamp(run, 0, 1));
          t.footRz = -Math.cos(ph) * lerp(0.09, 0.2, clamp(run, 0, 1));
          t.footLp = -Math.cos(ph) * 0.4;
          t.footRp = Math.cos(ph) * 0.4;
          t.roll = sL * lerp(0.14, 0.09, clamp(run, 0, 1));
          t.bendX = -sL * 0.06;
          t.hop = Math.abs(Math.cos(ph)) * lerp(0.035, 0.07, clamp(run, 0, 1));
          t.squash = -Math.abs(Math.cos(ph)) * 0.03 + 0.012;
          t.pitch = lerp(0.04, 0.2, clamp(run, 0, 1));
          t.bendZ = lerp(0.04, 0.2, clamp(run, 0, 1));
          t.headRoll = -sL * 0.05;
          t.nod = -t.pitch * 0.7 + Math.cos(ph * 2) * 0.015;
          t.flipLr = 0.5 + run * 0.34 + sR * 0.14;
          t.flipRr = 0.5 + run * 0.34 + sL * 0.14;
          t.flipLs = sL * 0.55;
          t.flipRs = sR * 0.55;
          t.curlL = 0.25 + run * 0.4;
          t.curlR = -0.25 - run * 0.4;
          expr = run > 0.9 ? "sharp" : "normal";
        }
        if (S.slip > 0.08) {
          // 미끄러짐: 몸이 기울고 발이 허우적
          const k = S.slip;
          const side = Math.sin(S.slipA || 0);
          const fwd = Math.cos(S.slipA || 0);
          t.roll += -side * 0.42 * k;
          t.bendX += side * 0.24 * k;
          t.pitch += -fwd * 0.26 * k;
          t.bendZ += -fwd * 0.16 * k;
          const q = T * 26;
          t.footLy += Math.max(0, Math.sin(q)) * 0.15 * k;
          t.footRy += Math.max(0, Math.sin(q + Math.PI)) * 0.15 * k;
          t.footLz += Math.cos(q) * 0.2 * k;
          t.footRz += -Math.cos(q) * 0.2 * k;
          t.flipLr += 0.8 * k + Math.sin(T * 31) * 0.26 * k;
          t.flipRr += 0.8 * k + Math.sin(T * 27 + 1) * 0.26 * k;
          t.mouth = Math.max(t.mouth, 0.55 * k);
          if (k > 0.4) expr = "wow";
        }
        if (S.mode === "slide") {
          // 배로 슝
          t.pitch = 1.42;
          t.bendZ = -0.12;
          t.nod = -1;
          t.hop = -0.03;
          t.flipLr = 0.5;
          t.flipRr = 0.5;
          t.flipLs = -1.5;
          t.flipRs = -1.5;
          t.curlL = 0.4;
          t.curlR = -0.4;
          t.footLy = 0.32 + Math.sin(T * 22) * 0.04;
          t.footRy = 0.32 + Math.sin(T * 22 + 2) * 0.04;
          t.footLz = -0.04;
          t.footRz = -0.04;
          t.footLp = -1.1;
          t.footRp = -1.1;
          t.roll = (S.turn || 0) * 0.2;
          expr = "happy";
          t.mouth = 0.7;
        }
      } else {
        // 공중
        const up = S.vy > 0.8;
        t.pitch = up ? -0.08 : 0.12;
        t.bendZ = up ? -0.06 : 0.04;
        t.flipLr = up ? 1.15 : 1.75;
        t.flipRr = up ? 1.15 : 1.75;
        t.flipLs = up ? -0.45 : 0.28;
        t.flipRs = up ? -0.45 : 0.28;
        t.curlL = 0.55;
        t.curlR = -0.55;
        t.squash = up ? 0.08 : -0.03;
        t.footLy = up ? 0.2 : 0.06;
        t.footRy = up ? 0.12 : 0.1;
        t.footLz = up ? 0.12 : -0.1;
        t.footRz = up ? -0.12 : 0.1;
        t.footLp = up ? -0.5 : 0.4;
        t.footRp = up ? 0.3 : 0.4;
        if (!up && S.vy < -5) {
          t.mouth = 0.5;
          expr = "wow";
          t.flipLr += Math.sin(T * 30) * 0.3;
          t.flipRr += Math.sin(T * 30 + 1) * 0.3;
        }
      }
      // 택배를 머리에 이고 양 날개로 받침
      if (carrying && S.mode !== "slide") {
        const k = S.grounded ? 1 : 0.45;
        t.flipLr = lerp(t.flipLr, 2.72, k);
        t.flipRr = lerp(t.flipRr, 2.72, k);
        t.flipLs = lerp(t.flipLs, 0.02 + (moving ? sL * 0.04 : 0), k);
        t.flipRs = lerp(t.flipRs, 0.02 + (moving ? sR * 0.04 : 0), k);
        t.curlL = lerp(t.curlL, 0.55, k);
        t.curlR = lerp(t.curlR, -0.55, k);
        // 흔들리면 반대쪽으로 버팀
        t.bendX += -(S.tiltX || 0) * 0.55;
        t.bendZ += -(S.tiltZ || 0) * 0.55;
        t.headRoll += (S.tiltX || 0) * 0.4;
        const danger = Math.hypot(S.tiltX || 0, S.tiltZ || 0);
        if (danger > 0.3) {
          expr = "wow";
          t.mouth = Math.max(t.mouth, 0.5);
          t.flipLr += Math.sin(T * 29) * 0.2;
          t.flipRr += Math.sin(T * 25) * 0.2;
        }
      } else if (!carrying && S.lost && S.mode === "run") {
        // 택배를 쫓아가는 중: 앞으로 손을 뻗음
        t.flipLr = 1.5;
        t.flipRr = 1.5;
        t.flipLs = -1.1 + sL * 0.2;
        t.flipRs = -1.1 + sR * 0.2;
        t.mouth = Math.max(t.mouth, 0.45);
        expr = S.grounded ? "wow" : expr;
      }
      if (S.lookBox !== undefined && S.lost) {
        t.twist = clamp(S.lookBox, -0.9, 0.9);
      } else {
        t.twist = this.gaze.tx * (moving ? 0.25 : 0.7);
        t.nod += this.gaze.ty * (moving ? 0.2 : 0.5);
      }
    } else if (S.mode === "stun") {
      // 엉덩방아
      t.pitch = -0.72;
      t.hop = -0.18;
      t.bendZ = 0.1;
      t.nod = 0.42;
      t.headRoll = Math.sin(T * 8) * 0.2;
      t.flipLr = 0.95 + Math.sin(T * 13) * 0.1;
      t.flipRr = 0.95 - Math.sin(T * 13) * 0.1;
      t.curlL = 0.3;
      t.curlR = -0.3;
      t.footLy = 0.34;
      t.footRy = 0.34;
      t.footLz = 0.26;
      t.footRz = 0.26;
      t.footLp = -0.8 + Math.sin(T * 17) * 0.3;
      t.footRp = -0.8 - Math.sin(T * 17) * 0.3;
      expr = "dizzy";
      t.mouth = 0.3;
    } else if (S.mode === "snow") {
      t.roll = Math.sin(T * 22) * 0.1 * (S.wiggle > 0.05 ? 1.6 : 0.5);
      t.squash = Math.sin(T * 14) * 0.02;
      expr = "dizzy";
      t.flipLr = 0;
      t.flipRr = 0;
    } else if (S.mode === "blown") {
      t.pitch = Math.sin(T * 9) * 0.5;
      t.roll = Math.cos(T * 7) * 0.4;
      t.flipLr = 2.1 + Math.sin(T * 30) * 0.4;
      t.flipRr = 2.1 + Math.sin(T * 26) * 0.4;
      expr = "wow";
      t.mouth = 0.8;
    } else if (S.mode === "dance") {
      // 배달 성공 춤
      this.danceT += dt;
      const d = this.danceT * 6.4;
      const hop = Math.max(0, Math.sin(d));
      t.hop = hop * 0.34;
      t.squash = (hop > 0.05 ? 0.06 : -0.08) + Math.sin(d * 2) * 0.02;
      t.roll = Math.sin(d * 0.5) * 0.22;
      t.bendX = Math.sin(d * 0.5) * 0.2;
      t.bendZ = 0.02;
      t.twist = Math.sin(d * 0.5) * 0.3;
      t.headRoll = Math.sin(d * 0.5 + 1) * 0.24;
      t.flipLr = 2.45 + Math.sin(d * 1) * 0.28;
      t.flipRr = 2.45 - Math.sin(d * 1) * 0.28;
      t.flipLs = Math.sin(d * 0.5) * 0.3;
      t.flipRs = -Math.sin(d * 0.5) * 0.3;
      t.curlL = 0.6;
      t.curlR = -0.6;
      t.footLy = Math.max(0, Math.sin(d * 0.5)) * 0.2;
      t.footRy = Math.max(0, -Math.sin(d * 0.5)) * 0.2;
      expr = "happy";
      t.mouth = 0.8;
    } else if (S.mode === "sad") {
      // 실망: 어깨가 축 처지고 고개를 떨굼
      t.pitch = 0.12;
      t.bendZ = 0.2;
      t.nod = 0.42 + Math.sin(T * 1.4) * 0.02;
      t.squash = -0.06 + Math.sin(T * 1.6) * 0.012;
      t.flipLr = 0.06;
      t.flipRr = 0.06;
      t.flipLs = 0.2;
      t.flipRs = 0.2;
      t.curlL = -0.2;
      t.curlR = 0.2;
      expr = "sad";
      t.headRoll = Math.sin(T * 0.9) * 0.05;
    } else if (S.mode === "splash") {
      t.flipLr = 2.4 + Math.sin(T * 26) * 0.4;
      t.flipRr = 2.4 + Math.sin(T * 24) * 0.4;
      t.mouth = 0.9;
      expr = "wow";
    }
    // 한 번짜리 동작
    if (once.drop > 0) {
      const k = clamp(once.drop / 0.5, 0, 1);
      t.flipLr = lerp(t.flipLr, 2.2, k);
      t.flipRr = lerp(t.flipRr, 2.2, k);
      t.flipLs = lerp(t.flipLs, -0.9, k);
      t.flipRs = lerp(t.flipRs, -0.9, k);
      t.squash += 0.1 * k;
      t.mouth = 1;
      expr = "wow";
      t.nod -= 0.2 * k;
    }
    if (once.catch > 0) {
      const u = once.catch / 0.42;
      t.squash += Math.sin(u * Math.PI) * -0.1;
      t.nod += Math.sin(u * Math.PI) * 0.3;
      t.flipLr = lerp(t.flipLr, 2.7, 0.6);
      t.flipRr = lerp(t.flipRr, 2.7, 0.6);
      expr = "happy";
      t.mouth = 0.6;
    }
    if (once.pick > 0) {
      const u = Math.sin((once.pick / 0.42) * Math.PI);
      t.pitch += u * 0.8;
      t.bendZ += u * 0.28;
      t.nod += u * 0.3;
      t.flipLs = lerp(t.flipLs, -1.4, u);
      t.flipRs = lerp(t.flipRs, -1.4, u);
      t.flipLr = lerp(t.flipLr, 0.9, u);
      t.flipRr = lerp(t.flipRr, 0.9, u);
    }
    if (once.land > 0) {
      const u = once.land / 0.22;
      t.squash += -0.2 * u * (S.landK || 0.5);
      t.bendZ += 0.1 * u;
    }
    if (once.wave > 0) {
      t.flipRr = 2.8 + Math.sin(T * 14) * 0.3;
      t.flipRs = 0;
      expr = "happy";
      t.mouth = 0.7;
      t.headRoll += 0.1;
    }
    if (this.force) t = Object.assign(t, this.force);
    // 스프링 적용
    for (const k of Object.keys(t)) s[k].t = t[k];
    s.snow.t = S.mode === "snow" ? 1 : 0;
    const sub = Math.min(2, Math.ceil(dt / 0.012));
    for (let n = 0; n < sub; n += 1) for (const k of Object.keys(s)) s[k].step(dt / sub);

    // 뼈대에 반영
    const sq = 1 + s.squash.x;
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.pivot.position.y = 0.48 + s.hop.x;
    this.pivot.rotation.x = s.pitch.x + (S.spin ? S.spin * TAU : 0);
    this.pivot.rotation.z = s.roll.x;
    const bend = this.u.uBend.value;
    bend.x = s.bendX.x;
    bend.z = s.bendZ.x;
    this.u.uTwist.value = s.twist.x;
    // 머리 따라가기
    const o = this._o || (this._o = {});
    this.bendAt(0.94, o);
    this.head.position.set(o.x, 0.94, o.z);
    this.head.rotation.set(o.sz + s.nod.x, s.twist.x, -o.sx + s.headRoll.x, "YXZ");
    // 날개
    for (const fl of this.flips) {
      const L = fl.side < 0;
      this.bendAt(0.665, o);
      fl.j.position.set(fl.side * 0.405 + o.x, 0.665, 0.01 + o.z);
      fl.j.rotation.z = fl.side * (L ? s.flipLr.x : s.flipRr.x);
      fl.j.rotation.x = L ? s.flipLs.x : s.flipRs.x;
      fl.uu.uCurl.value = (L ? s.curlL.x : s.curlR.x) * -1;
    }
    // 발
    for (const ft of this.feet) {
      const L = ft.side < 0;
      ft.f.position.y = Math.max(0, L ? s.footLy.x : s.footRy.x);
      ft.f.position.z = 0.03 + (L ? s.footLz.x : s.footRz.x);
      ft.f.rotation.x = L ? s.footLp.x : s.footRp.x;
    }
    this.tail.rotation.z = Math.sin(T * 7) * (moving ? 0.25 : 0.06);
    this.beakLow.rotation.x = s.mouth.x * 0.55;
    // 토끼 귀 흔들림
    if (this.costume === "bunny" && this.ears) {
      for (const e of this.ears) {
        e.j.rotation.x = -s.pitch.x * 0.8 + Math.sin(T * 5 + e.side) * 0.05 - (S.speed || 0) * 0.04 + s.squash.x * -2;
      }
    }
    // 눈덩이 옷
    const snowK = clamp(s.snow.x, 0, 1.2);
    const showSnow = snowK > 0.02;
    this.snowBody.visible = this.snowHead.visible = showSnow;
    if (showSnow) {
      this.snowBody.scale.setScalar(snowK);
      this.snowHead.scale.setScalar(snowK);
      this.snowHead.position.set(o.x * 0.7, 1.08, o.z * 0.7);
    }
    // 눈과 부리가 눈덩이 밖으로 빠져나옴
    this.head.scale.setScalar(1 + snowK * 0.06);
    for (const e of this.eyes) e.position.z = 0.378 + snowK * 0.13;
    // 어지러운 별
    const dizzy = S.mode === "stun" || S.mode === "snow";
    this.stars.visible = dizzy;
    if (dizzy) {
      this.stars.position.y = S.mode === "stun" ? 1.05 : 1.65;
      this.stars.rotation.y = T * 5;
      this.stars.children.forEach((c, i) => {
        const a = (i / 4) * TAU;
        c.position.set(Math.cos(a) * 0.48, Math.sin(a * 2 + T * 4) * 0.05, Math.sin(a) * 0.48);
        c.rotation.y = T * 6;
      });
    }
    // 표정 · 깜빡임
    this.blinkT -= dt;
    if (this.exprT > 0) {
      this.exprT -= dt;
    } else {
      if (this.expr !== expr) this.setExpr(expr);
      if (expr === "normal" || expr === "sharp") {
        if (this.blinkT <= 0 && this.blinkT > -0.11) this.applyEye("closed");
        else if (this.blinkT <= -0.11) {
          this.blinkT = 1.6 + Math.random() * 3;
          this.applyEye(expr);
        }
      }
    }
    // 눈동자 살짝 굴리기
    this.gaze.x += (this.gaze.tx - this.gaze.x) * Math.min(1, dt * 7);
    this.gaze.y += (this.gaze.ty - this.gaze.y) * Math.min(1, dt * 7);
    for (const e of this.eyes) {
      e.rotation.y = e.userData.side * 0.42 + this.gaze.x * 0.28;
      e.rotation.x = -this.gaze.y * 0.28;
    }
    // 눈물
    const crying = S.mode === "sad";
    this.tear.visible = crying;
    if (crying) {
      const u = (T * 0.8) % 1;
      this.tear.position.set(0.24, 0.0 - u * 0.28, 0.42 - u * 0.05);
      this.tear.scale.setScalar(0.6 + u * 0.8);
      this.tear.material.opacity = u < 0.8 ? 0.95 : (1 - u) * 5;
    }
  }
}

export function starGeo(R = 0.1, r = 0.05, depth = 0.04, points = 5) {
  const sh = new THREE.Shape();
  for (let i = 0; i < points * 2; i += 1) {
    const a = (i / (points * 2)) * TAU + Math.PI / 2;
    const m = i % 2 ? r : R;
    const x = Math.cos(a) * m;
    const y = Math.sin(a) * m;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * 0.5, bevelSize: depth * 0.5, bevelSegments: 2, curveSegments: 2 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

/** 상자 모서리를 둥글게: 격자 있는 BoxGeometry 를 안쪽 상자 + 둥근 껍질로 */
export function roundBox(geo, w, h, d, r) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 1) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -w / 2 + r, w / 2 - r), clamp(v.y, -h / 2 + r, h / 2 - r), clamp(v.z, -d / 2 + r, d / 2 - r));
    v.sub(c);
    if (v.lengthSq() > 1e-9) v.normalize().multiplyScalar(r);
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
