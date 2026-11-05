/*
 * 캐릭터 인형: 이미지 없이 캔버스로 그린다.
 *  관절 + 말랑한 몸(출렁임 · 눌림 · 패임) + 표정. 같은 얼굴 · 체형이 모든 동작에서 유지된다.
 *  왼쪽 아래가 아니라 발 가운데가 원점이고 위가 -y. 기본은 오른쪽을 본다.
 */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- 캐릭터별 생김새 ---------- */
export const SPECIES = {
  bear: {
    body: { rx: 74, ry: 62, top: 0.92 },
    head: { rx: 62, ry: 54 },
    c: { main: "#c28a52", dark: "#94602f", light: "#e6b582", belly: "#f6dfba", line: "#4f2e16", inner: "#efb7a0", paw: "#94602f", nose: "#3b2214", cheek: "#ff9d86", eye: "#2a170d" },
    ears: "round",
    earR: 21,
    tail: "stub",
    muzzle: { rx: 27, ry: 20, c: "#f8e6c8" },
    mouthY: 0.46,
    foot: "paw",
    bellyK: 1,
  },
  bunny: {
    body: { rx: 62, ry: 55, top: 0.95 },
    head: { rx: 60, ry: 53 },
    c: { main: "#ffb6cf", dark: "#ee85aa", light: "#ffdbe7", belly: "#fff3f6", line: "#8c2e57", inner: "#ff8db2", paw: "#f596b8", nose: "#ff5f93", cheek: "#ff7fa6", eye: "#3a1426" },
    ears: "long",
    earR: 22,
    tail: "pom",
    cheeks: 1,
    teeth: true,
    mouthY: 0.4,
    foot: "long",
    bellyK: 0.9,
  },
  panda: {
    body: { rx: 76, ry: 62, top: 0.9 },
    head: { rx: 64, ry: 55 },
    c: { main: "#f8f7f2", dark: "#d5d3cb", light: "#ffffff", belly: "#ffffff", line: "#26262c", inner: "#55555e", paw: "#2f2f37", nose: "#1f1f26", cheek: "#ffb1a6", eye: "#111116", limb: "#34343d", limbL: "#54545f" },
    ears: "round",
    earR: 20,
    earC: "#2f2f37",
    patches: true,
    tail: "stub",
    muzzle: { rx: 20, ry: 15, c: "#ffffff" },
    mouthY: 0.44,
    foot: "paw",
    bellyK: 0.85,
    shoulder: "#34343d",
  },
  pig: {
    body: { rx: 76, ry: 60, top: 0.88 },
    head: { rx: 63, ry: 52 },
    c: { main: "#ffa8bd", dark: "#e97e9a", light: "#ffd3dd", belly: "#ffd9e2", line: "#8a3350", inner: "#f77f9c", paw: "#d96d8b", nose: "#ff8ba7", cheek: "#ff6f90", eye: "#34121e" },
    ears: "flop",
    earR: 22,
    tail: "curl",
    snout: true,
    mouthY: 0.58,
    foot: "hoof",
    bellyK: 1,
  },
  duck: {
    body: { rx: 66, ry: 58, top: 0.98 },
    head: { rx: 54, ry: 50 },
    c: { main: "#ffd84a", dark: "#f0b01f", light: "#fff0a0", belly: "#fff3b4", line: "#8a5a0a", inner: "#ffb72e", paw: "#ff9326", nose: "#ff9326", cheek: "#ffa04d", eye: "#1f1408" },
    ears: "tuft",
    earR: 0,
    tail: "feather",
    bill: "duck",
    wings: true,
    mouthY: 0.34,
    foot: "web",
    bellyK: 0.9,
  },
  cat: {
    body: { rx: 66, ry: 58, top: 0.94 },
    head: { rx: 60, ry: 51 },
    c: { main: "#a9b4c9", dark: "#7d89a3", light: "#d2d9e6", belly: "#f6f7fb", line: "#333c55", inner: "#ffb0bd", paw: "#f6f7fb", nose: "#ff8fa3", cheek: "#ff9fb4", eye: "#1d2a3a", iris: "#4fb4a8" },
    ears: "point",
    earR: 24,
    tail: "long",
    whiskers: true,
    catFace: true,
    mouthY: 0.38,
    foot: "paw",
    bellyK: 0.85,
    marks: "tabby",
  },
  tiger: {
    body: { rx: 70, ry: 60, top: 0.92 },
    head: { rx: 63, ry: 53 },
    c: { main: "#ff9f3a", dark: "#dd7415", light: "#ffc77a", belly: "#fff1d9", line: "#5a2c0c", inner: "#ffd0a0", paw: "#fff1d9", nose: "#3f2211", cheek: "#ff7a4a", eye: "#2a1408", stripe: "#3a2110" },
    ears: "round",
    earR: 19,
    earC: "#ff9f3a",
    tail: "stripe",
    muzzle: { rx: 28, ry: 19, c: "#fff5e6" },
    mouthY: 0.46,
    foot: "paw",
    bellyK: 0.95,
    marks: "tiger",
    fierce: true,
  },
  penguin: {
    body: { rx: 66, ry: 66, top: 1.02 },
    head: { rx: 56, ry: 50 },
    c: { main: "#2f3a55", dark: "#1c2438", light: "#566487", belly: "#fbfcff", line: "#111726", inner: "#ffb0bd", paw: "#2f3a55", nose: "#ff9d2e", cheek: "#ff9db0", eye: "#0f1420" },
    ears: "none",
    earR: 0,
    tail: "feather",
    bill: "peng",
    wings: true,
    faceMask: true,
    mouthY: 0.34,
    foot: "web",
    bellyK: 1.05,
  },
};

const GOLD = { main: "#f2c24a", dark: "#c98f1c", light: "#ffe89a", belly: "#fff3c2", line: "#6a4406", inner: "#ffd674", paw: "#c98f1c", limb: "#c98f1c", limbL: "#e8b53a" };

/* ---------- 그리기 도구 ---------- */
function polarBlob(g, cx, cy, fn, n = 22) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU;
    const q = fn(a);
    pts.push([cx + q[0], cy + q[1]]);
  }
  g.beginPath();
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    if (i === 0) {
      const z = pts[n - 1];
      g.moveTo((z[0] + p[0]) / 2, (z[1] + p[1]) / 2);
    }
    g.quadraticCurveTo(p[0], p[1], mx, my);
  }
  g.closePath();
}
function shade(g, x, y, r, c0, c1, c2, ox = -0.34, oy = -0.42) {
  const gr = g.createRadialGradient(x + r * ox, y + r * oy, r * 0.08, x, y, r * 1.18);
  gr.addColorStop(0, c0);
  gr.addColorStop(0.55, c1);
  gr.addColorStop(1, c2);
  return gr;
}
function oval(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
/** 굵은 관절선: 윤곽 → 안쪽 순서로 두 번 긋는다 */
function limb(g, x0, y0, cx, cy, x1, y1, w, col, line, lw) {
  g.lineCap = "round";
  g.lineJoin = "round";
  g.strokeStyle = line;
  g.lineWidth = w + lw * 2;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo(cx, cy, x1, y1);
  g.stroke();
  g.strokeStyle = col;
  g.lineWidth = w;
  g.stroke();
}

/* ---------- 인형 ---------- */
const BASE_POSE = {
  lean: 0, rot: 0, lift: 0, sx: 1, sy: 1,
  armF: 0.25, armB: 0.2, armFx: 0, armBx: 0, reachF: 1, reachB: 1,
  fFx: 0, fFy: 0, fBx: 0, fBy: 0, fRot: 0,
  headX: 0, headY: 0, headRot: 0, ear: 0, tail: 0, brow: 0, belly: 0, mouthOpen: 0,
};

export class Puppet {
  constructor(id, { size = 1, cos = {}, belt = "#d43a30" } = {}) {
    this.id = id;
    this.sp = SPECIES[id];
    this.size = size;
    this.cos = cos;
    this.belt = belt;
    this.P = { ...BASE_POSE };
    this.T = { ...BASE_POSE };
    this.t = Math.random() * 10;
    this.state = "idle";
    this.stateT = 0;
    this.eye = "open";
    this.mouth = "smile";
    this.blink = 0;
    this.nextBlink = 1 + Math.random() * 3;
    this.faceK = 1;
    this.face = 1;
    // 스프링: 눌림 · 흔들림 · 머리 · 귀
    this.sq = 0;
    this.sqV = 0;
    this.wob = 0;
    this.wobV = 0;
    this.wobP = 0;
    this.dent = 0;
    this.dentA = 0;
    this.headS = 0;
    this.headV = 0;
    this.earS = 0;
    this.earV = 0;
    this.prevVx = 0;
    this.walkP = 0;
    this.vx = 0;
    this.spin = 0;
    this.lift = 0;
    this.charge = 0;
    this.bal = 100;
    this.teeter = false;
    this.locked = false;
    this.skill = "";
    this.starsT = 0;
    this.tearT = 0;
    this.victoryPose = cos.pose || "jump";
    this.hitEyeT = 0;
    this.sweat = 0;
  }

  /** 맞았을 때: 눌렸다 튀어 오른다. dirX 는 맞은 힘의 방향(세계 좌표) */
  impact(power, dirX) {
    const p = clamp(power, 0, 1.2);
    this.sqV -= 5 + p * 15;
    this.wobV += 10 + p * 26;
    this.dent = Math.max(this.dent, 0.12 + p * 0.3);
    // 힘이 오는 쪽(자기 기준)
    this.dentA = dirX * this.face > 0 ? Math.PI : 0;
    this.headV += dirX * this.face * (120 + p * 480);
    this.earV += (2 + p * 9) * (dirX * this.face > 0 ? 1 : -1);
    this.hitEyeT = 0.24 + p * 0.3;
  }

  /** src: 시뮬레이션 선수 또는 같은 모양의 값 */
  sync(src, dt) {
    if (src.state !== this.state) {
      this.state = src.state;
      this.stateT = 0;
    } else this.stateT = src.stateT !== undefined ? src.stateT : this.stateT + dt;
    this.vx = src.vx || 0;
    this.lift = src.y || 0;
    this.charge = src.charge || 0;
    this.bal = src.bal === undefined ? 100 : src.bal;
    this.teeter = !!src.teeter;
    this.locked = !!src.locked;
    this.spin = src.spinA || 0;
    this.skill = (src.def && src.def.skill && src.def.skill.id) || this.skill;
    if (src.face) this.face = src.face;
    this.edgeDir = src.x > 0 ? 1 : -1;
    this.moveAmt = src.moveAmt === undefined ? 0 : src.moveAmt;
    this.dashPow = src.dashPow || 0;
  }

  setState(s) {
    if (s !== this.state) {
      this.state = s;
      this.stateT = 0;
    }
  }

  update(dt) {
    this.t += dt;
    const T = { ...BASE_POSE };
    this.pose(T, dt);
    const rate = this.state === "dash" || this.state === "hit" || this.state === "push" ? 32 : this.state === "knockback" ? 26 : 16;
    const k = 1 - Math.exp(-rate * dt);
    for (const key of Object.keys(T)) this.P[key] += (T[key] - this.P[key]) * k;
    // 눌림: 스프링
    this.sqV += (-this.sq * 190 - this.sqV * 11) * dt;
    this.sq = clamp(this.sq + this.sqV * dt, -0.3, 0.3);
    this.wobV += (-this.wob * 240 - this.wobV * 7) * dt;
    this.wob += this.wobV * dt * 0.05;
    this.wobP += dt * 15;
    this.dent *= Math.exp(-dt * 8);
    this.headV += (-this.headS * 260 - this.headV * 16) * dt;
    this.headS += this.headV * dt;
    const acc = clamp((this.vx - this.prevVx) * 0.012, -6, 6);
    this.prevVx = this.vx;
    this.earV += (-this.earS * 110 - this.earV * 8) * dt + acc * this.face * 1.3;
    this.earS += this.earV * dt;
    this.hitEyeT -= dt;
    // 몸을 돌릴 때 납작하게 스쳐 지나간다
    this.faceK += (this.face - this.faceK) * (1 - Math.exp(-dt * 24));
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blink = 0.13;
      this.nextBlink = 1.4 + Math.random() * 3.4;
    }
    this.blink -= dt;
    this.sweat = Math.max(0, this.sweat - dt);
  }

  /** 상태별 자세와 표정 (15가지 동작) */
  pose(T, dt) {
    const t = this.t;
    const u = this.stateT;
    const mv = this.moveAmt;
    let eye = "open";
    let mouth = "smile";
    const breath = Math.sin(t * 2.6);
    T.sy = 1 + breath * 0.016;
    T.sx = 1 - breath * 0.012;
    T.armF = 0.12 + breath * 0.04;
    T.armB = 0.26 - breath * 0.04;
    T.ear = breath * 0.03;
    T.tail = Math.sin(t * 3.4) * 0.2;
    const wobble = this.bal < 30 ? Math.sin(t * 9) * 0.07 * (1 - this.bal / 30) : 0;
    T.lean = wobble;
    if (this.sp.fierce) T.brow = 0.34;
    const speedDir = this.vx * this.face >= 0 ? 1 : -1;
    switch (this.state) {
      case "walk":
      case "run": {
        const run = this.state === "run";
        this.walkP += dt * (9 + mv * 12);
        const s = Math.sin(this.walkP);
        const c = Math.cos(this.walkP);
        const st = run ? 20 : 13;
        T.fFx = c * st;
        T.fFy = Math.max(0, s) * (run ? 13 : 8);
        T.fBx = -c * st;
        T.fBy = Math.max(0, -s) * (run ? 13 : 8);
        T.lean = (run ? 0.17 : 0.08) * speedDir + wobble;
        T.lift = Math.abs(s) * (run ? 6 : 3);
        T.sy = 1 + Math.abs(c) * 0.03;
        T.armF = 0.14 + s * (run ? 0.75 : 0.42);
        T.armB = 0.5 - s * (run ? 0.75 : 0.42);
        T.ear = (run ? -0.3 : -0.14) * speedDir;
        if (run) {
          mouth = "open";
          T.mouthOpen = 0.5;
        }
        break;
      }
      case "push": {
        const k = clamp(u / 0.07, 0, 1);
        const after = clamp((u - 0.07) / 0.17, 0, 1);
        if (k < 1) {
          T.lean = -0.2;
          T.armF = -0.4;
          T.armB = -0.3;
          T.sx = 0.92;
          T.sy = 1.05;
        } else {
          T.lean = lerp(0.42, 0.12, after);
          T.armF = 1.55;
          T.armB = 1.45;
          T.reachF = 1.34;
          T.reachB = 1.28;
          T.sx = lerp(1.14, 1.02, after);
          T.sy = lerp(0.9, 0.98, after);
          T.fFx = 12;
          T.fBx = -16;
          T.headX = 8;
        }
        eye = "angry";
        mouth = "shout";
        T.brow = 0.5;
        break;
      }
      case "charge": {
        const c = this.charge;
        const shake = Math.sin(t * 60) * c * 2;
        T.lean = -0.14 - c * 0.2;
        T.sy = 0.96 - c * 0.2;
        T.sx = 1.03 + c * 0.14;
        T.armF = -0.5 - c * 0.5;
        T.armB = -0.3 - c * 0.5;
        T.fFx = 15 + shake;
        T.fBx = -19 + shake;
        T.headX = shake;
        T.ear = 0.1 + c * 0.2;
        eye = "angry";
        mouth = "teeth";
        T.brow = 0.55 + c * 0.25;
        break;
      }
      case "dash": {
        T.lean = 0.5;
        T.sx = 1.22;
        T.sy = 0.84;
        T.armF = 1.65;
        T.armB = 1.5;
        T.reachF = 1.2;
        T.reachB = 1.1;
        T.headX = 11;
        T.ear = -1;
        this.walkP += dt * 34;
        T.fFx = Math.cos(this.walkP) * 22 - 7;
        T.fFy = Math.max(0, Math.sin(this.walkP)) * 12;
        T.fBx = -Math.cos(this.walkP) * 22 - 7;
        T.fBy = Math.max(0, -Math.sin(this.walkP)) * 12;
        eye = "angry";
        mouth = "shout";
        T.brow = 0.7;
        T.tail = -0.8;
        break;
      }
      case "hit": {
        T.lean = -0.32;
        T.sx = 1.1;
        T.sy = 0.9;
        T.armF = -2.3;
        T.armB = 2.1;
        T.headX = -8;
        T.ear = 0.9;
        eye = "shut";
        mouth = "o";
        T.mouthOpen = 0.9;
        break;
      }
      case "knockback": {
        // 뒤로 밀리며 발 버둥 · 팔 휘젓기
        this.walkP += dt * 36;
        const s = Math.sin(this.walkP);
        const c = Math.cos(this.walkP);
        T.lean = -0.36 + Math.sin(t * 20) * 0.05;
        T.fFx = c * 16 + 14;
        T.fFy = Math.max(0, s) * 11;
        T.fBx = -c * 16 + 14;
        T.fBy = Math.max(0, -s) * 11;
        T.armF = -2.3 + Math.sin(t * 28) * 0.8;
        T.armB = 2.1 - Math.sin(t * 28) * 0.9;
        T.headX = -5;
        T.ear = 1;
        T.tail = 0.8;
        eye = "wide";
        mouth = "wavy";
        break;
      }
      case "guard": {
        T.lean = 0.14;
        T.sy = 0.86;
        T.sx = 1.12;
        T.armF = 1.2;
        T.armB = 1.05;
        T.reachF = 0.8;
        T.reachB = 0.75;
        T.fFx = 17;
        T.fBx = -21;
        T.headY = 5;
        T.brow = 0.45;
        eye = "angry";
        mouth = "teeth";
        break;
      }
      case "dodge": {
        const k = clamp(u / 0.3, 0, 1);
        T.lean = lerp(-0.5, 0, k);
        T.sx = lerp(0.84, 1, k);
        T.sy = lerp(1.2, 1, k);
        T.armF = -2.2;
        T.armB = 2.2;
        T.fFy = 12;
        T.fBy = 7;
        T.ear = -0.8;
        eye = "happy";
        mouth = "open";
        T.mouthOpen = 0.4;
        break;
      }
      case "stumble": {
        this.walkP += dt * 20;
        T.lean = 0.42 + Math.sin(t * 14) * 0.16;
        T.armF = -2 + Math.sin(t * 22) * 0.8;
        T.armB = 1.8 - Math.sin(t * 22) * 0.8;
        T.fFx = Math.cos(this.walkP) * 12 + 8;
        T.fFy = Math.max(0, Math.sin(this.walkP)) * 7;
        T.fBx = -Math.cos(this.walkP) * 12 + 8;
        T.fBy = Math.max(0, -Math.sin(this.walkP)) * 7;
        eye = "wide";
        mouth = "wavy";
        break;
      }
      case "fall": {
        // 벌러덩: 등으로 넘어져 발이 위로
        const k = clamp(u / 0.2, 0, 1);
        T.rot = -1.42 * k;
        T.lift = Math.sin(k * Math.PI) * 18;
        T.armF = -2.5;
        T.armB = 2.7;
        T.fFx = 10;
        T.fBx = -6;
        T.fFy = 16;
        T.fBy = 11;
        T.sy = 0.96;
        eye = "dizzy";
        mouth = "wavy";
        break;
      }
      case "recover": {
        const k = clamp(u / 0.34, 0, 1);
        T.rot = -1.42 * (1 - k) * (1 - k);
        T.sy = lerp(0.82, 1, k);
        T.sx = lerp(1.14, 1, k);
        T.armF = 1 - k;
        T.armB = 1 - k;
        T.headRot = Math.sin(t * 22) * 0.16 * (1 - k);
        eye = k < 0.6 ? "dizzy" : "open";
        mouth = "small";
        break;
      }
      case "victory": {
        const pose = this.victoryPose;
        if (pose === "dance") {
          const s = Math.sin(t * 8);
          T.lean = s * 0.2;
          T.lift = Math.abs(Math.cos(t * 8)) * 14;
          T.armF = -2.5 + s * 0.5;
          T.armB = 2.5 - s * 0.5;
          T.fFy = Math.max(0, s) * 13;
          T.fBy = Math.max(0, -s) * 13;
          T.sx = 1 + s * 0.04;
        } else if (pose === "flex") {
          const s = Math.sin(t * 5);
          T.armF = -2.5;
          T.armB = 2.5;
          T.reachF = 0.72;
          T.reachB = 0.72;
          T.sx = 1.06 + s * 0.05;
          T.sy = 0.96 - s * 0.03;
          T.headRot = -0.14;
          T.lift = 0;
        } else {
          const j = Math.abs(Math.sin(t * 6));
          T.lift = j * 44;
          T.sy = 1 + (j - 0.5) * 0.16;
          T.sx = 1 - (j - 0.5) * 0.12;
          T.armF = -2.5 + Math.sin(t * 12) * 0.2;
          T.armB = 2.75 - Math.sin(t * 12) * 0.2;
          T.fFy = j * 8;
          T.fBy = j * 8;
          T.ear = -0.4 * Math.cos(t * 6);
        }
        eye = "happy";
        mouth = "open";
        T.mouthOpen = 1;
        break;
      }
      case "defeat": {
        // 엉덩방아 + 빙글빙글 눈 + 눈물
        const k = clamp(u / 0.3, 0, 1);
        T.lift = Math.sin(k * Math.PI) * 26;
        T.sy = lerp(1, 0.82, k);
        T.sx = lerp(1, 1.16, k);
        T.lean = -0.16;
        T.fFx = 26;
        T.fBx = -2;
        T.fFy = 15;
        T.fBy = 12;
        T.armF = 0.5 + Math.sin(t * 7) * 0.1;
        T.armB = 0.9 - Math.sin(t * 7) * 0.1;
        T.headRot = Math.sin(t * 4) * 0.07;
        T.headY = 6;
        T.ear = 0.7;
        eye = u > 1.1 ? "cry" : "dizzy";
        mouth = "sad";
        break;
      }
      case "out": {
        T.armF = -2.5 + Math.sin(t * 28) * 0.5;
        T.armB = 2.3 - Math.sin(t * 28) * 0.5;
        T.fFy = 14;
        T.fBy = 10;
        T.ear = 1;
        eye = "wide";
        mouth = "o";
        T.mouthOpen = 1;
        break;
      }
      case "special":
        this.poseSpecial(T, u, t);
        eye = this.eye2 || "angry";
        mouth = this.mouth2 || "shout";
        break;
      default:
    }
    if (this.locked && (this.state === "walk" || this.state === "run" || this.state === "idle")) {
      // 몸을 맞대고 힘겨루기
      T.lean = 0.3 + Math.sin(t * 30) * 0.015;
      T.sx = 1.08;
      T.sy = 0.93;
      T.armF = 1.5;
      T.armB = 1.4;
      T.reachF = 1.12;
      T.reachB = 1.08;
      T.fFx = 13;
      T.fBx = -21;
      T.brow = 0.6;
      eye = "angry";
      mouth = "teeth";
    }
    if (this.teeter && this.state !== "knockback" && this.state !== "out" && this.state !== "fall") {
      // 끝에서 아슬아슬: 팔을 휘저으며 앞뒤로 기우뚱
      const out = this.edgeDir * this.face; // 1 이면 바라보는 쪽이 바깥
      const s = Math.sin(t * 13);
      T.lean = out * 0.26 + s * 0.14;
      T.armF = -2.2 + Math.sin(t * 26) * 0.9;
      T.armB = 2.4 - Math.sin(t * 26) * 0.9;
      T.fBy = Math.max(0, s) * 5;
      T.sy = 1.02;
      T.ear = -s * 0.3;
      eye = "wide";
      mouth = "wavy";
    }
    if (this.hitEyeT > 0 && this.state !== "victory") {
      eye = this.hitEyeT > 0.14 ? "shut" : "wide";
      mouth = "o";
      T.mouthOpen = 0.8;
    }
    this.eye = eye;
    this.mouth = mouth;
    T.tail += Math.abs(this.vx) * 0.0007;
  }

  poseSpecial(T, u, t) {
    const skill = this.skill;
    this.eye2 = "angry";
    this.mouth2 = "shout";
    T.brow = 0.7;
    if (skill === "belly") {
      const k = clamp(u / 0.24, 0, 1);
      if (u < 0.24) {
        T.lean = -0.5 * k;
        T.sx = 1 + k * 0.1;
        T.sy = 1 - k * 0.08;
        T.armF = -0.8;
        T.armB = -0.7;
      } else {
        T.lean = -0.2;
        T.sx = 1.34;
        T.sy = 0.9;
        T.belly = 1;
        T.armF = -0.9;
        T.armB = -0.8;
        T.headX = -6;
      }
    } else if (skill === "hop") {
      T.armF = -2.5;
      T.armB = 2.5;
      T.fFy = 10;
      T.fBy = 10;
      T.ear = this.lift > 0 ? 0.8 : -0.4;
      T.sy = this.lift > 0 ? 1.1 : 0.84;
      T.sx = this.lift > 0 ? 0.92 : 1.14;
      this.eye2 = "happy";
    } else if (skill === "iron") {
      T.sx = 1.18;
      T.sy = 0.88;
      T.armF = 1.3;
      T.armB = 1.2;
      T.reachF = 0.7;
      T.reachB = 0.7;
      T.fFx = 22;
      T.fBx = -26;
      this.mouth2 = "teeth";
    } else if (skill === "nose") {
      if (u < 0.42) {
        T.lean = -0.4;
        T.sy = 0.8;
        T.sx = 1.14;
        T.fFx = Math.sin(t * 40) * 3 + 15;
        T.fBx = -20;
        T.armF = -0.8;
        T.armB = -0.8;
        this.mouth2 = "teeth";
      } else {
        T.lean = 0.72;
        T.sx = 1.26;
        T.sy = 0.8;
        T.armF = 0.2;
        T.armB = 0.2;
        T.headX = 18;
        T.ear = -1;
        T.tail = -1;
      }
    } else if (skill === "spin") {
      T.armF = 1.6;
      T.armB = 1.6;
      T.reachF = 1.34;
      T.reachB = 1.34;
      this.eye2 = "dizzy";
      this.mouth2 = "open";
      T.lift = 8;
    } else if (skill === "roll") {
      T.sx = 0.78;
      T.sy = 0.78;
      T.armF = 1;
      T.armB = 1;
      T.fFy = 16;
      T.fBy = 16;
      this.eye2 = "shut";
      if (u > 0.44) {
        T.sx = 1.12;
        T.sy = 0.96;
        T.lean = 0.45;
        T.armF = 1.55;
        T.armB = 1.5;
        T.reachF = 1.3;
        this.eye2 = "angry";
      }
    } else if (skill === "roar") {
      if (u < 0.34) {
        T.lean = -0.3;
        T.sx = 1.12;
        T.sy = 1.1;
        T.armF = -2.2;
        T.armB = 2.2;
        T.headY = -6;
        T.mouthOpen = 1;
        T.headX = Math.sin(t * 60) * 2;
      } else {
        T.lean = 0.52;
        T.sx = 1.2;
        T.sy = 0.86;
        T.armF = 1.65;
        T.armB = 1.5;
        T.reachF = 1.24;
        T.ear = -1;
      }
    } else if (skill === "slide") {
      // 배로 눕는다
      T.rot = 1.36;
      T.lift = -8;
      T.armF = -2.9;
      T.armB = 2.9;
      T.fFy = 6;
      T.fBy = 6;
      this.eye2 = "happy";
      this.mouth2 = "open";
    }
  }

  /** 그림자 (경기장 위) */
  drawShadow(g, x, y, s) {
    const a = clamp(1 - this.lift / 300, 0.3, 1);
    g.save();
    g.translate(x, y);
    const rx = this.sp.body.rx * 1.05 * s * this.size;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(30,20,30,${0.42 * a})`);
    gr.addColorStop(0.72, `rgba(30,20,30,${0.26 * a})`);
    gr.addColorStop(1, "rgba(30,20,30,0)");
    g.fillStyle = gr;
    g.scale(1, 0.32);
    g.beginPath();
    g.arc(0, 0, rx, 0, TAU);
    g.fill();
    g.restore();
  }

  /** x, y: 발 위치 (화면), s: 배율 */
  draw(g, x, y, s) {
    const sp = this.sp;
    const P = this.P;
    const C = this.cos.tint === "gold" ? { ...sp.c, ...GOLD } : sp.c;
    const lw = 3.6;
    g.save();
    g.translate(x, y - (P.lift + this.lift) * s);
    const sc = s * this.size;
    g.scale(sc * (Math.abs(this.faceK) < 0.55 ? 0.55 * Math.sign(this.faceK || 1) : this.faceK), sc);
    const spin = this.spin;
    if (P.rot || spin) {
      g.translate(0, -66);
      g.rotate(P.rot + spin);
      g.translate(0, 66);
    }
    const sx = P.sx * (1 - this.sq * 0.5);
    const sy = P.sy * (1 + this.sq * 0.9);
    const bR = sp.body;
    const rx = bR.rx * sx;
    const ry = bR.ry * sy;
    const hipY = 14;
    const lean = P.lean;
    const cosL = Math.cos(lean);
    const sinL = Math.sin(lean);
    const toW = (lx, ly) => [lx * cosL - ly * sinL, -hipY + lx * sinL + ly * cosL];
    const bodyC = toW(0, -ry * 0.92);
    const bx = bodyC[0];
    const by = bodyC[1];
    // 머리 위치
    const hrx = sp.head.rx * (1 + (sx - 1) * 0.35);
    const hry = sp.head.ry * (1 + (sy - 1) * 0.35);
    const hLocal = toW(P.headX + this.headS * 0.08 + 2, -ry * (0.92 + bR.top * 0.74) - hry * 0.56 + P.headY);
    const hx = hLocal[0];
    const hy = hLocal[1];
    const headRot = P.headRot + lean * 0.42 + this.headS * 0.0011;

    this.drawTail(g, C, bx, by, rx, ry, lean, lw);
    if (this.cos.body === "cape") this.drawCape(g, bx, by, rx, ry, lean);

    // 다리 (뒤쪽)
    this.drawLeg(g, C, -1, toW, ry, lw);
    // 뒤쪽 팔
    this.drawArm(g, C, -1, toW, rx, ry, lw);
    // 몸통
    this.drawBody(g, C, bx, by, rx, ry, lean, lw);
    // 다리 (앞쪽)
    this.drawLeg(g, C, 1, toW, ry, lw);
    // 앞쪽 팔 (머리 아래: 팔이 얼굴을 가리지 않는다)
    this.drawArm(g, C, 1, toW, rx, ry, lw);
    // 머리
    this.drawHead(g, C, hx, hy, hrx, hry, headRot, lw);
    g.restore();
  }

  drawTail(g, C, bx, by, rx, ry, lean, lw) {
    const P = this.P;
    const sp = this.sp;
    const tx = bx - rx * 0.92;
    const ty = by + ry * 0.42;
    const a = P.tail;
    g.lineCap = "round";
    if (sp.tail === "stub") {
      oval(g, tx, ty, 13, 12);
      g.fillStyle = shade(g, tx, ty, 13, C.light, C.main, C.dark);
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = lw;
      g.stroke();
    } else if (sp.tail === "pom") {
      polarBlob(g, tx - 4, ty, (t) => {
        const r = 19 + Math.sin(t * 6) * 1.8;
        return [Math.cos(t) * r, Math.sin(t) * r];
      }, 16);
      g.fillStyle = shade(g, tx - 4, ty, 19, "#fff", "#fff3f6", "#ffd2e0");
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = lw;
      g.stroke();
    } else if (sp.tail === "curl") {
      g.strokeStyle = C.line;
      g.lineWidth = 11 + lw * 1.2;
      const draw = () => {
        g.beginPath();
        g.moveTo(tx + 8, ty);
        g.bezierCurveTo(tx - 22, ty + 2, tx - 26 + a * 8, ty - 26, tx - 12, ty - 22);
        g.bezierCurveTo(tx - 3, ty - 19, tx - 10, ty - 7, tx - 17, ty - 12);
        g.stroke();
      };
      draw();
      g.strokeStyle = C.main;
      g.lineWidth = 8.5;
      draw();
    } else if (sp.tail === "long" || sp.tail === "stripe") {
      const ex = tx - 34 + a * 10;
      const ey = ty - 56 + a * 20;
      const cx = tx - 44;
      const cy = ty + 6;
      limb(g, tx + 10, ty + 2, cx, cy, ex, ey, 15, C.main, C.line, lw);
      if (sp.tail === "stripe") {
        g.strokeStyle = C.stripe;
        g.lineWidth = 5;
        g.setLineDash([5, 11]);
        g.lineCap = "butt";
        g.lineWidth = 15;
        g.beginPath();
        g.moveTo(tx - 6, ty + 2);
        g.quadraticCurveTo(cx, cy, ex, ey);
        g.stroke();
        g.setLineDash([]);
        g.lineCap = "round";
      } else {
        // 꼬리 끝 흰색
        oval(g, ex, ey, 7.5, 7.5);
        g.fillStyle = C.belly;
        g.fill();
      }
    } else if (sp.tail === "feather") {
      g.fillStyle = C.main === "#2f3a55" ? C.dark : C.dark;
      g.strokeStyle = C.line;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(tx + 12, ty - 14);
      g.quadraticCurveTo(tx - 24, ty - 34 + a * 12, tx - 28, ty - 22 + a * 12);
      g.quadraticCurveTo(tx - 14, ty - 4, tx + 8, ty + 12);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }

  drawCape(g, bx, by, rx, ry, lean) {
    const t = this.t;
    const flow = clamp(Math.abs(this.vx) * 0.04, 0, 22);
    g.fillStyle = "#c93042";
    g.strokeStyle = "#5e0f20";
    g.lineWidth = 3.4;
    g.beginPath();
    g.moveTo(bx - rx * 0.1, by - ry * 0.9);
    g.quadraticCurveTo(bx - rx * 1.2 - flow, by - ry * 0.2, bx - rx * 1.25 - flow * 1.4 + Math.sin(t * 7) * 4, by + ry * 1.02);
    g.quadraticCurveTo(bx - rx * 0.6, by + ry * 1.14 + Math.sin(t * 9) * 3, bx + rx * 0.2, by + ry * 0.7);
    g.closePath();
    g.fill();
    g.stroke();
    void lean;
  }

  drawLeg(g, C, side, toW, ry, lw) {
    const P = this.P;
    const sp = this.sp;
    const isF = side > 0;
    const fx = (isF ? 26 : -24) + (isF ? P.fFx : P.fBx);
    const fy = -(isF ? P.fFy : P.fBy);
    const hip = toW(isF ? 24 : -22, -8);
    const col = C.limb || C.dark;
    const shoeLine = C.line;
    limb(g, hip[0], hip[1], (hip[0] + fx) / 2, (hip[1] + fy) / 2 + 2, fx, fy - 6, sp.foot === "web" ? 10 : 26, sp.foot === "web" ? C.paw === C.main ? "#ff9d2e" : C.paw : col, shoeLine, lw);
    // 발
    g.save();
    g.translate(fx + 8, fy - 6);
    const rot = fy < -3 ? -0.3 : 0;
    g.rotate(rot);
    if (sp.foot === "web") {
      g.fillStyle = "#ff9d2e";
      g.strokeStyle = "#a9520c";
      g.lineWidth = lw * 0.9;
      g.beginPath();
      g.moveTo(-16, 4);
      g.quadraticCurveTo(-6, -9, 6, -8);
      g.lineTo(24, 2);
      g.quadraticCurveTo(21, 6, 16, 3);
      g.quadraticCurveTo(14, 8, 8, 4);
      g.quadraticCurveTo(4, 9, -2, 5);
      g.quadraticCurveTo(-10, 8, -16, 4);
      g.closePath();
      g.fill();
      g.stroke();
    } else if (sp.foot === "long") {
      oval(g, 6, 0, 28, 13);
      g.fillStyle = shade(g, 6, 0, 28, C.light, C.main, C.dark);
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = lw;
      g.stroke();
      oval(g, 14, 2, 10, 6);
      g.fillStyle = C.inner;
      g.fill();
    } else if (sp.foot === "hoof") {
      oval(g, 3, -1, 22, 13);
      g.fillStyle = shade(g, 3, 0, 22, C.main, C.dark, C.dark);
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = lw;
      g.stroke();
      g.beginPath();
      g.moveTo(15, -10);
      g.quadraticCurveTo(10, -2, 15, 8);
      g.strokeStyle = C.line;
      g.lineWidth = 2.6;
      g.stroke();
    } else {
      oval(g, 4, 0, 24, 14);
      const pc = C.limb || C.main;
      g.fillStyle = shade(g, 4, 0, 24, C.limbL || C.light, pc, C.limb || C.dark);
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = lw;
      g.stroke();
      // 발바닥 젤리
      g.fillStyle = C.inner;
      oval(g, 16, 2, 6, 7);
      g.fill();
    }
    g.restore();
  }

  drawArm(g, C, side, toW, rx, ry, lw) {
    const P = this.P;
    const sp = this.sp;
    const isF = side > 0;
    const sh = toW((isF ? (sp.wings ? -0.5 : -0.34) : 0.62) * rx, -ry * 1.02);
    const a = isF ? P.armF : P.armB;
    const reach = (isF ? P.reachF : P.reachB) * (sp.wings ? 44 : 46);
    // a: 0 아래 · π/2 앞 · π 위
    const ang = a + P.lean;
    const ex = sh[0] + Math.sin(ang) * reach;
    const ey = sh[1] + Math.cos(ang) * reach;
    const cx = sh[0] + Math.sin(ang - 0.3) * reach * 0.55;
    const cy = sh[1] + Math.cos(ang - 0.3) * reach * 0.55 + 3;
    const col = C.limb || (sp.id === "panda" ? C.paw : C.main);
    if (sp.wings) {
      const w = sp.tail === "feather" && C.main === "#2f3a55" ? C.main : C.dark;
      g.save();
      g.translate(sh[0], sh[1]);
      g.rotate(-ang);
      g.beginPath();
      g.moveTo(-11, -4);
      g.quadraticCurveTo(-17, reach * 0.6, 0, reach + 9);
      g.quadraticCurveTo(15, reach * 0.55, 11, -4);
      g.closePath();
      g.fillStyle = w;
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = lw;
      g.stroke();
      g.restore();
      return;
    }
    const line = C.line;
    limb(g, sh[0], sh[1], cx, cy, ex, ey, 25, col, line, lw);
    // 손 (둥근 앞발)
    oval(g, ex, ey, 16, 15);
    const pawC = C.limb || (sp.c.paw === C.belly ? C.belly : C.main);
    g.fillStyle = shade(g, ex, ey, 16, C.limbL || C.light, pawC, C.limb || C.dark);
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = lw;
    g.stroke();
    // 윗부분 윤곽 지우기 (몸과 이어져 보이게)
    if (isF) {
      g.strokeStyle = col;
      g.lineWidth = 22;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(sh[0], sh[1]);
      g.quadraticCurveTo(cx, cy, cx + (ex - cx) * 0.3, cy + (ey - cy) * 0.3);
      g.stroke();
    }
  }

  drawBody(g, C, bx, by, rx, ry, lean, lw) {
    const sp = this.sp;
    const P = this.P;
    const wob = this.wob;
    const wp = this.wobP;
    const dent = this.dent;
    const dA = this.dentA;
    const shapeFn = (t) => {
      const c = Math.cos(t);
      const s = Math.sin(t);
      const k = s < 0 ? sp.body.top : 1;
      let r = 1 + wob * 0.05 * Math.sin(2 * t + wp) + wob * 0.03 * Math.sin(3 * t - wp * 1.3);
      if (dent > 0.002) {
        let d = t - dA;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        r -= dent * Math.exp(-(d * d) / 0.5);
      }
      // 배 내밀기
      r += P.belly * 0.2 * Math.exp(-((t - 0.25) * (t - 0.25)) / 0.7);
      return [c * rx * r, s * ry * k * r];
    };
    g.save();
    g.translate(bx, by);
    g.rotate(lean * 0.9);
    polarBlob(g, 0, 0, shapeFn, 24);
    g.fillStyle = shade(g, 0, 0, Math.max(rx, ry), C.light, C.main, C.dark);
    g.fill();
    g.save();
    g.clip();
    // 배 무늬
    const bo = rx * 0.22 + P.belly * 6;
    const bellyW = rx * 0.68 * sp.bellyK;
    const bellyH = ry * 0.78 * sp.bellyK;
    oval(g, bo + wob * Math.sin(wp) * 1.4, ry * 0.22 + wob * Math.cos(wp) * 1.1, bellyW, bellyH);
    g.fillStyle = shade(g, bo, ry * 0.22, bellyW, "#fff", C.belly, C.belly);
    g.fill();
    if (sp.shoulder) {
      // 판다: 어깨 띠
      g.fillStyle = sp.shoulder;
      oval(g, 0, -ry * 1.04, rx * 1.2, ry * 0.52);
      g.fill();
    }
    if (sp.marks === "tiger") {
      g.strokeStyle = C.stripe;
      g.lineWidth = 7;
      g.lineCap = "round";
      for (const [x0, y0, x1, y1] of [[-rx * 0.86, -ry * 0.3, -rx * 0.42, -ry * 0.16], [-rx * 0.94, ry * 0.12, -rx * 0.5, ry * 0.2], [-rx * 0.8, ry * 0.52, -rx * 0.42, ry * 0.46], [rx * 0.86, -ry * 0.4, rx * 0.56, -ry * 0.34]]) {
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }
    if (sp.marks === "tabby") {
      g.strokeStyle = C.dark;
      g.lineWidth = 7;
      g.lineCap = "round";
      for (const [x0, y0, x1, y1] of [[-rx * 0.84, -ry * 0.24, -rx * 0.46, -ry * 0.14], [-rx * 0.9, ry * 0.2, -rx * 0.52, ry * 0.24]]) {
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }
    // 그림자 초승달 (아래쪽) · 왼쪽 반사광
    const sh = g.createLinearGradient(0, ry * 0.2, 0, ry * 1.04);
    sh.addColorStop(0, "rgba(40,20,30,0)");
    sh.addColorStop(1, "rgba(40,20,30,.22)");
    g.fillStyle = sh;
    g.fillRect(-rx * 1.3, -ry * 1.2, rx * 2.6, ry * 2.4);
    // 씨름 띠 (마와시)
    const beltC = this.belt;
    const by0 = ry * 0.46;
    g.fillStyle = beltC;
    g.beginPath();
    g.moveTo(-rx * 1.3, by0 - ry * 0.05);
    g.quadraticCurveTo(0, by0 + ry * 0.3, rx * 1.3, by0 - ry * 0.05);
    g.lineTo(rx * 1.3, by0 + ry * 0.26);
    g.quadraticCurveTo(0, by0 + ry * 0.6, -rx * 1.3, by0 + ry * 0.26);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(0,0,0,.28)";
    g.lineWidth = 2.5;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,.28)";
    g.beginPath();
    g.moveTo(-rx * 1.3, by0 - ry * 0.02);
    g.quadraticCurveTo(0, by0 + ry * 0.33, rx * 1.3, by0 - ry * 0.02);
    g.lineTo(rx * 1.3, by0 + ry * 0.05);
    g.quadraticCurveTo(0, by0 + ry * 0.4, -rx * 1.3, by0 + ry * 0.05);
    g.closePath();
    g.fill();
    if (this.cos.body === "happi") {
      g.fillStyle = "#2f62d6";
      g.beginPath();
      g.moveTo(-rx * 1.3, -ry * 1.2);
      g.lineTo(rx * 0.05, -ry * 1.2);
      g.lineTo(rx * 0.5, by0 - ry * 0.02);
      g.lineTo(-rx * 1.3, by0);
      g.closePath();
      g.fill();
      g.strokeStyle = "#fff";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(rx * 0.05, -ry * 1.1);
      g.lineTo(rx * 0.5, by0 - ry * 0.02);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,.9)";
      for (const [x, y] of [[-rx * 0.5, -ry * 0.3], [-rx * 0.1, ry * 0.05], [-rx * 0.8, ry * 0.1]]) {
        oval(g, x, y, 6, 6);
        g.fill();
      }
    }
    g.restore();
    polarBlob(g, 0, 0, shapeFn, 24);
    g.strokeStyle = C.line;
    g.lineWidth = lw;
    g.lineJoin = "round";
    g.stroke();
    g.restore();
    void lean;
  }

  drawEars(g, C, rx, ry, front) {
    const sp = this.sp;
    const lag = clamp(this.P.ear + this.earS, -1.5, 1.5);
    const lw = 3.6;
    const ec = C.earC || C.main;
    if (sp.ears === "round") {
      for (const [x, y, s] of front ? [[rx * 0.5, -ry * 0.84, 1]] : [[-rx * 0.56, -ry * 0.82, 0.96]]) {
        const R = sp.earR * s;
        const ey = y + Math.abs(lag) * 2;
        oval(g, x, ey, R, R);
        g.fillStyle = shade(g, x, ey, R, sp.earC ? C.limbL || ec : C.light, ec, sp.earC ? ec : C.dark);
        g.fill();
        g.strokeStyle = C.line;
        g.lineWidth = lw;
        g.stroke();
        if (!sp.earC || sp.id === "tiger") {
          oval(g, x + 1.5, ey + 2, R * 0.56, R * 0.56);
          g.fillStyle = C.inner;
          g.fill();
        }
      }
    } else if (sp.ears === "long") {
      // 긴 귀: 두 마디로 휘어지고 힘에 젖혀진다
      const list = front ? [[rx * 0.2, 1, 0.06]] : [[-rx * 0.28, 0.94, -0.14]];
      for (const [x, s, a0] of list) {
        const L = 96 * s;
        const bend = lag * 0.62;
        const a1 = a0 - bend * 0.6;
        const a2 = a1 - bend * 1.05;
        const bx0 = x;
        const by0 = -ry * 0.72;
        const mx = bx0 + Math.sin(a1) * L * 0.55;
        const my = by0 - Math.cos(a1) * L * 0.55;
        const tx = mx + Math.sin(a2) * L * 0.5;
        const ty = my - Math.cos(a2) * L * 0.5;
        const W = 21 * s;
        const nx = Math.cos(a1);
        const ny = Math.sin(a1);
        const nx2 = Math.cos(a2);
        const ny2 = Math.sin(a2);
        g.beginPath();
        g.moveTo(bx0 - nx * W * 0.72, by0 - ny * W * 0.72);
        g.quadraticCurveTo(mx - nx * W, my - ny * W, tx - nx2 * W * 0.56, ty - ny2 * W * 0.56);
        g.quadraticCurveTo(tx + Math.sin(a2) * W * 0.8, ty - Math.cos(a2) * W * 0.8, tx + nx2 * W * 0.56, ty + ny2 * W * 0.56);
        g.quadraticCurveTo(mx + nx * W, my + ny * W, bx0 + nx * W * 0.72, by0 + ny * W * 0.72);
        g.closePath();
        g.fillStyle = shade(g, mx, my, L * 0.6, C.light, C.main, C.dark);
        g.fill();
        g.strokeStyle = C.line;
        g.lineWidth = lw;
        g.lineJoin = "round";
        g.stroke();
        // 귀 안쪽
        const w2 = W * 0.48;
        g.beginPath();
        g.moveTo(bx0 - nx * w2 * 0.6, by0 - ny * w2 * 0.6);
        g.quadraticCurveTo(mx - nx * w2, my - ny * w2, tx - nx2 * w2 * 0.5 - Math.sin(a2) * 6, ty - ny2 * w2 * 0.5 + Math.cos(a2) * 6);
        g.quadraticCurveTo(tx + Math.sin(a2) * 2, ty - Math.cos(a2) * 2 + 8, tx + nx2 * w2 * 0.5 - Math.sin(a2) * 6, ty + ny2 * w2 * 0.5 + Math.cos(a2) * 6);
        g.quadraticCurveTo(mx + nx * w2, my + ny * w2, bx0 + nx * w2 * 0.6, by0 + ny * w2 * 0.6);
        g.closePath();
        g.fillStyle = C.inner;
        g.fill();
      }
    } else if (sp.ears === "flop") {
      for (const [x, s] of front ? [[rx * 0.52, 1]] : [[-rx * 0.5, -1]]) {
        const y = -ry * 0.74;
        const f = lag * 10;
        g.beginPath();
        g.moveTo(x - 17, y + 6);
        g.quadraticCurveTo(x + s * 6 - f, y - 28, x + s * 30 - f, y - 18 + Math.abs(f) * 0.4);
        g.quadraticCurveTo(x + s * 26 - f, y + 8, x + 15, y + 12);
        g.closePath();
        g.fillStyle = shade(g, x + 8, y - 6, 26, C.light, C.main, C.dark);
        g.fill();
        g.strokeStyle = C.line;
        g.lineWidth = lw;
        g.stroke();
      }
    } else if (sp.ears === "point") {
      for (const [x, s] of front ? [[rx * 0.5, 1]] : [[-rx * 0.5, -1]]) {
        const y = -ry * 0.68;
        const f = lag * 5;
        g.beginPath();
        g.moveTo(x - s * 24, y + 10);
        g.quadraticCurveTo(x + s * 6 - f, y - 28, x + s * 12 - f, y - 42);
        g.quadraticCurveTo(x + s * 22, y - 14, x + s * 24, y + 12);
        g.closePath();
        g.fillStyle = shade(g, x, y - 10, 30, C.light, C.main, C.dark);
        g.fill();
        g.strokeStyle = C.line;
        g.lineWidth = lw;
        g.lineJoin = "round";
        g.stroke();
        g.beginPath();
        g.moveTo(x - s * 11, y + 6);
        g.quadraticCurveTo(x + s * 7 - f, y - 16, x + s * 10 - f, y - 25);
        g.quadraticCurveTo(x + s * 15, y - 8, x + s * 12, y + 8);
        g.closePath();
        g.fillStyle = C.inner;
        g.fill();
      }
    } else if (sp.ears === "tuft" && front) {
      g.fillStyle = C.main;
      g.strokeStyle = C.line;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(-14, -ry * 0.9);
      g.quadraticCurveTo(-12 - lag * 6, -ry * 1.3, 2 - lag * 10, -ry * 1.5);
      g.quadraticCurveTo(0, -ry * 1.24, 8, -ry * 1.2);
      g.quadraticCurveTo(12 - lag * 6, -ry * 1.38, 24 - lag * 8, -ry * 1.42);
      g.quadraticCurveTo(22, -ry * 1.12, 20, -ry * 0.9);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }

  drawHead(g, C, hx, hy, rx, ry, rot, lw) {
    const sp = this.sp;
    g.save();
    g.translate(hx, hy);
    g.rotate(rot);
    this.drawEars(g, C, rx, ry, false);
    if (sp.ears !== "long") this.drawEars(g, C, rx, ry, true);
    else this.drawEars(g, C, rx, ry, true);
    const cheek = sp.cheeks ? 0.1 : 0.03;
    const headFn = (t) => {
      const c = Math.cos(t);
      const s = Math.sin(t);
      const bot = s > 0 ? 1 + cheek * s : 1;
      return [c * rx * (1 + cheek * Math.max(0, s) * 0.8), s * ry * bot];
    };
    polarBlob(g, 0, 0, headFn, 22);
    g.fillStyle = shade(g, 0, 0, Math.max(rx, ry), C.light, C.main, C.dark);
    g.fill();
    g.save();
    g.clip();
    this.drawHeadMarks(g, C, rx, ry);
    // 아래 그림자
    const sh = g.createLinearGradient(0, ry * 0.35, 0, ry * 1.05);
    sh.addColorStop(0, "rgba(40,20,30,0)");
    sh.addColorStop(1, "rgba(40,20,30,.14)");
    g.fillStyle = sh;
    g.fillRect(-rx * 1.2, -ry, rx * 2.4, ry * 2.2);
    // 위쪽 반짝임
    g.globalAlpha = 0.5;
    oval(g, -rx * 0.28, -ry * 0.62, rx * 0.36, ry * 0.16, -0.22);
    g.fillStyle = "#fff";
    g.fill();
    g.globalAlpha = 1;
    g.restore();
    polarBlob(g, 0, 0, headFn, 22);
    g.strokeStyle = C.line;
    g.lineWidth = lw;
    g.stroke();
    this.drawFace(g, C, rx, ry);
    if (this.cos.head || this.cos.face) this.drawHeadwear(g, rx, ry);
    g.restore();
  }

  drawHeadMarks(g, C, rx, ry) {
    const sp = this.sp;
    const fo = rx * 0.14;
    if (sp.faceMask) {
      // 펭귄: 흰 얼굴
      g.fillStyle = C.belly;
      g.beginPath();
      g.moveTo(fo, -ry * 0.28);
      g.bezierCurveTo(fo - rx * 0.44, -ry * 0.82, fo - rx * 1, -ry * 0.28, fo - rx * 0.72, ry * 0.5);
      g.bezierCurveTo(fo - rx * 0.5, ry * 1.1, fo + rx * 0.6, ry * 1.1, fo + rx * 0.76, ry * 0.5);
      g.bezierCurveTo(fo + rx * 1.02, -ry * 0.28, fo + rx * 0.44, -ry * 0.82, fo, -ry * 0.28);
      g.fill();
    }
    if (sp.patches) {
      g.fillStyle = "#2f2f37";
      oval(g, fo - rx * 0.42, -ry * 0.02, rx * 0.26, ry * 0.3, 0.42);
      g.fill();
      oval(g, fo + rx * 0.38, -ry * 0.02, rx * 0.24, ry * 0.3, -0.42);
      g.fill();
    }
    if (sp.marks === "tiger") {
      g.strokeStyle = C.stripe;
      g.lineCap = "round";
      g.lineWidth = 6.5;
      // 이마의 왕(王) 무늬
      for (const [dy, w] of [[-0.82, 0.22], [-0.66, 0.26], [-0.5, 0.2]]) {
        g.beginPath();
        g.moveTo(fo - rx * w, ry * dy);
        g.lineTo(fo + rx * w, ry * dy);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(fo, -ry * 0.86);
      g.lineTo(fo, -ry * 0.46);
      g.stroke();
      g.lineWidth = 6;
      for (const s of [-1, 1]) {
        for (const dy of [-0.08, 0.18]) {
          g.beginPath();
          g.moveTo(s * rx * 0.98 + fo * 0.3, ry * dy);
          g.lineTo(s * rx * 0.68 + fo * 0.3, ry * (dy + 0.04));
          g.stroke();
        }
      }
    }
    if (sp.marks === "tabby") {
      g.strokeStyle = C.dark;
      g.lineCap = "round";
      g.lineWidth = 6;
      for (const dx of [-0.22, 0, 0.22]) {
        g.beginPath();
        g.moveTo(fo + rx * dx, -ry * 0.92);
        g.lineTo(fo + rx * dx * 0.84, -ry * 0.56);
        g.stroke();
      }
      // 흰 코 주변
      g.fillStyle = C.belly;
      oval(g, fo + rx * 0.02, ry * 0.46, rx * 0.5, ry * 0.42);
      g.fill();
    }
  }

  drawFace(g, C, rx, ry) {
    const sp = this.sp;
    const P = this.P;
    const fo = rx * 0.14;
    // 볼
    for (const [x, a] of [[fo - rx * 0.62, 0.6], [fo + rx * 0.58, 0.72]]) {
      const cy = ry * 0.28;
      const gr = g.createRadialGradient(x, cy, 0, x, cy, rx * 0.26);
      gr.addColorStop(0, C.cheek);
      gr.addColorStop(1, `${C.cheek}00`);
      g.globalAlpha = a;
      g.fillStyle = gr;
      oval(g, x, cy, rx * 0.26, ry * 0.2);
      g.fill();
      g.globalAlpha = 1;
    }
    // 코 · 주둥이
    const my = ry * sp.mouthY;
    if (sp.muzzle) {
      oval(g, fo + 1, ry * 0.32, sp.muzzle.rx, sp.muzzle.ry);
      g.fillStyle = shade(g, fo + 1, ry * 0.32, sp.muzzle.rx, "#fff", sp.muzzle.c, sp.muzzle.c);
      g.fill();
    }
    // 눈
    this.drawEyes(g, C, fo, rx, ry);
    // 눈썹
    if (P.brow > 0.05 || this.eye === "wide") {
      const up = this.eye === "wide" ? -5 : 0;
      const a = this.eye === "wide" ? -0.2 : P.brow * 0.62;
      g.strokeStyle = sp.patches ? "#fff" : C.line;
      g.lineWidth = 4.6;
      g.lineCap = "round";
      for (const [x, s] of [[fo - rx * 0.4, 1], [fo + rx * 0.38, -1]]) {
        g.beginPath();
        const y0 = -ry * 0.31 + up;
        g.moveTo(x - 12 * s - s * 1, y0 - s * 0 - Math.sin(a) * 9);
        g.quadraticCurveTo(x, y0 - 2, x + 11 * s, y0 + Math.sin(a) * 9);
        g.stroke();
      }
    }
    if (sp.snout) {
      const open = this.mouth === "shout" || this.mouth === "o" ? 3 : 0;
      oval(g, fo + 3, ry * 0.26 - open, rx * 0.36, ry * 0.31);
      g.fillStyle = shade(g, fo + 3, ry * 0.26, rx * 0.36, "#ffd3dd", C.nose, "#ee6f8e");
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = C.line;
      oval(g, fo - 5, ry * 0.25 - open, 3.8, 6);
      g.fill();
      oval(g, fo + 11, ry * 0.25 - open, 3.8, 6);
      g.fill();
    } else if (sp.bill) {
      this.drawBill(g, C, fo, rx, ry);
      return;
    } else if (sp.catFace || sp.teeth) {
      g.beginPath();
      g.moveTo(fo - 5.5, ry * 0.2);
      g.lineTo(fo + 5.5, ry * 0.2);
      g.quadraticCurveTo(fo + 3, ry * 0.3, fo, ry * 0.32);
      g.quadraticCurveTo(fo - 3, ry * 0.3, fo - 5.5, ry * 0.2);
      g.fillStyle = C.nose;
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = 1.8;
      g.stroke();
    } else {
      oval(g, fo + 1, ry * 0.17, 10, 7.2);
      g.fillStyle = shade(g, fo + 1, ry * 0.17, 10, "#7a5a48", C.nose, C.nose);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.7)";
      oval(g, fo - 2, ry * 0.13, 3, 1.8);
      g.fill();
    }
    if (sp.whiskers) {
      g.strokeStyle = C.line;
      g.lineWidth = 2;
      for (const s of [-1, 1]) {
        for (const d of [-0.05, 0.08]) {
          g.beginPath();
          g.moveTo(fo + s * rx * 0.46, ry * (0.34 + d));
          g.lineTo(fo + s * rx * 0.9, ry * (0.3 + d * 2.1));
          g.stroke();
        }
      }
    }
    this.drawMouth(g, C, fo, my, rx, ry);
  }

  drawEyes(g, C, fo, rx, ry) {
    const sp = this.sp;
    const e = this.eye;
    const ex = rx * 0.4;
    const ey = -ry * 0.04;
    const R = rx * 0.2;
    const blink = this.blink > 0 && (e === "open" || e === "angry");
    for (const [x, k] of [[fo - ex, 0.94], [fo + ex * 0.94, 1]]) {
      const r = R * k;
      g.lineCap = "round";
      const strokeC = sp.patches ? "#ffffff" : C.line;
      if (blink || e === "closed") {
        g.strokeStyle = strokeC;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(x - r, ey);
        g.quadraticCurveTo(x, ey + r * 0.55, x + r, ey);
        g.stroke();
      } else if (e === "happy") {
        g.strokeStyle = strokeC;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x - r, ey + r * 0.3);
        g.quadraticCurveTo(x, ey - r * 0.95, x + r, ey + r * 0.3);
        g.stroke();
      } else if (e === "shut") {
        // > < 꽉 감은 눈
        const s = x < fo ? 1 : -1;
        g.strokeStyle = strokeC;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(x - s * r * 0.8, ey - r * 0.7);
        g.lineTo(x + s * r * 0.75, ey);
        g.lineTo(x - s * r * 0.8, ey + r * 0.7);
        g.stroke();
      } else if (e === "dizzy") {
        g.strokeStyle = strokeC;
        g.lineWidth = 3.2;
        g.beginPath();
        const st = this.t * 9;
        for (let i = 0; i <= 26; i += 1) {
          const a = st + i * 0.55;
          const q = (i / 26) * r * 1.08;
          const px = x + Math.cos(a) * q;
          const py = ey + Math.sin(a) * q;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.stroke();
      } else if (e === "wide") {
        // 커다란 흰자 + 작은 눈동자
        oval(g, x, ey, r * 1.16, r * 1.3);
        g.fillStyle = "#fff";
        g.fill();
        g.strokeStyle = C.line;
        g.lineWidth = 3;
        g.stroke();
        const jitter = Math.sin(this.t * 40) * 0.8;
        oval(g, x + jitter, ey + 1, r * 0.34, r * 0.4);
        g.fillStyle = C.eye;
        g.fill();
      } else {
        // 기본: 반짝이는 큰 눈
        const sq = e === "cry" ? 0.85 : 1;
        oval(g, x, ey, r * 0.98, r * 1.2 * sq);
        const ig = g.createLinearGradient(x, ey - r * 1.2, x, ey + r * 1.2);
        ig.addColorStop(0, C.eye);
        ig.addColorStop(0.62, C.eye);
        ig.addColorStop(1, C.iris || "#6b3f2a");
        g.fillStyle = ig;
        g.fill();
        if (sp.patches) {
          g.strokeStyle = "rgba(255,255,255,.28)";
          g.lineWidth = 1.5;
          g.stroke();
        }
        g.fillStyle = "#fff";
        oval(g, x + r * 0.26, ey - r * 0.46, r * 0.36, r * 0.42);
        g.fill();
        oval(g, x - r * 0.34, ey + r * 0.46, r * 0.17, r * 0.2);
        g.fill();
        if (e === "angry") {
          // 위 눈꺼풀이 비스듬히 내려온다
          const s = x < fo ? 1 : -1;
          const skin = sp.patches ? "#2f2f37" : sp.faceMask ? C.belly : C.main;
          g.save();
          oval(g, x, ey, r * 1.2, r * 1.24); // 눈 안만 덮어 머리 음영에 네모가 비치지 않게
          g.clip();
          g.fillStyle = skin;
          g.beginPath();
          g.moveTo(x - r * 1.3, ey - r * 1.5);
          g.lineTo(x + r * 1.3, ey - r * 1.5);
          g.lineTo(x + r * 1.3, ey - r * (s > 0 ? 0.28 : 0.86));
          g.lineTo(x - r * 1.3, ey - r * (s > 0 ? 0.86 : 0.28));
          g.closePath();
          g.fill();
          g.restore();
          g.strokeStyle = strokeC;
          g.lineWidth = 3.6;
          g.beginPath();
          g.moveTo(x + r * 1.04, ey - r * (s > 0 ? 0.34 : 0.8));
          g.lineTo(x - r * 1.04, ey - r * (s > 0 ? 0.8 : 0.34));
          g.stroke();
        }
        if (e === "cry") {
          const drop = (this.t * 1.6 + (x < fo ? 0.4 : 0)) % 1;
          g.fillStyle = "#7fd0ff";
          g.beginPath();
          const dy = ey + r + drop * 26;
          g.moveTo(x, dy - 7);
          g.quadraticCurveTo(x + 6, dy + 2, x, dy + 6);
          g.quadraticCurveTo(x - 6, dy + 2, x, dy - 7);
          g.fill();
        }
      }
    }
  }

  drawMouth(g, C, fo, my, rx, ry) {
    const m = this.mouth;
    const sp = this.sp;
    const line = sp.patches ? C.line : C.line;
    g.strokeStyle = line;
    g.lineCap = "round";
    g.lineJoin = "round";
    const x = fo + 1;
    const teeth = sp.teeth;
    if (m === "smile" || m === "small") {
      g.lineWidth = 3.2;
      g.beginPath();
      if (sp.catFace || sp.teeth) {
        g.moveTo(x - 10, my);
        g.quadraticCurveTo(x - 5, my + 7, x, my);
        g.quadraticCurveTo(x + 5, my + 7, x + 10, my);
      } else {
        g.moveTo(x - 9, my);
        g.quadraticCurveTo(x, my + 8, x + 9, my);
      }
      g.stroke();
      if (teeth) {
        g.fillStyle = "#fff";
        g.beginPath();
        g.roundRect(x - 5, my + 3.5, 10, 7, 2);
        g.fill();
        g.lineWidth = 1.8;
        g.stroke();
        g.beginPath();
        g.moveTo(x, my + 3.5);
        g.lineTo(x, my + 10.5);
        g.stroke();
      }
    } else if (m === "o") {
      const r = 6 + this.P.mouthOpen * 5;
      oval(g, x, my + 3, r * 0.82, r);
      g.fillStyle = "#6b1f2b";
      g.fill();
      g.lineWidth = 3;
      g.stroke();
    } else if (m === "open" || m === "shout") {
      const w = m === "shout" ? 19 : 16;
      const h = m === "shout" ? 18 : 10 + this.P.mouthOpen * 8;
      g.beginPath();
      g.moveTo(x - w, my - 2);
      g.quadraticCurveTo(x, my + 2, x + w, my - 2);
      g.quadraticCurveTo(x + w * 0.9, my + h, x, my + h);
      g.quadraticCurveTo(x - w * 0.9, my + h, x - w, my - 2);
      g.closePath();
      g.fillStyle = "#6b1f2b";
      g.fill();
      g.save();
      g.clip();
      oval(g, x, my + h, w * 0.66, h * 0.5);
      g.fillStyle = "#ff7d8e";
      g.fill();
      g.fillStyle = "#fff";
      g.fillRect(x - w, my - 3, w * 2, 5);
      g.restore();
      g.lineWidth = 3;
      g.stroke();
    } else if (m === "teeth") {
      g.fillStyle = "#fff";
      g.beginPath();
      g.roundRect(x - 15, my, 30, 13, 5);
      g.fill();
      g.lineWidth = 3;
      g.stroke();
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(x - 15, my + 6.5);
      g.lineTo(x + 15, my + 6.5);
      for (const d of [-7.5, 0, 7.5]) {
        g.moveTo(x + d, my);
        g.lineTo(x + d, my + 13);
      }
      g.stroke();
    } else if (m === "wavy") {
      g.lineWidth = 3.4;
      g.beginPath();
      g.moveTo(x - 15, my + 5);
      for (let i = 1; i <= 6; i += 1) g.quadraticCurveTo(x - 15 + (i - 0.5) * 5, my + 5 + (i % 2 ? -7 : 7), x - 15 + i * 5, my + 5);
      g.stroke();
    } else if (m === "sad") {
      g.lineWidth = 3.4;
      g.beginPath();
      g.moveTo(x - 10, my + 8);
      g.quadraticCurveTo(x, my - 2, x + 10, my + 8);
      g.stroke();
    }
  }

  drawBill(g, C, fo, rx, ry) {
    const sp = this.sp;
    const m = this.mouth;
    const open = m === "shout" ? 12 : m === "open" ? 9 : m === "o" ? 7 : m === "teeth" ? 2 : m === "wavy" ? 3 : 0;
    const by = ry * 0.28;
    const bc = "#ff9d2e";
    const dc = "#d9690c";
    const W = sp.bill === "duck" ? 30 : 21;
    const L = sp.bill === "duck" ? 22 : 18;
    const y2 = by + 3 + open;
    // 아래 부리
    g.beginPath();
    g.moveTo(fo - W * 0.76, by + 4);
    g.quadraticCurveTo(fo - W * 0.3, y2 + 9, fo + L, y2 + 2);
    g.quadraticCurveTo(fo + W * 0.6, by + 4 + open * 0.4, fo - W * 0.76, by + 4);
    g.fillStyle = dc;
    g.fill();
    g.strokeStyle = "#7a3a08";
    g.lineWidth = 3;
    g.stroke();
    if (open > 2) {
      g.beginPath();
      g.moveTo(fo - W * 0.5, by + 6);
      g.quadraticCurveTo(fo + 2, y2 + 2, fo + L * 0.7, y2);
      g.lineTo(fo + L * 0.5, by + 5);
      g.closePath();
      g.fillStyle = "#6b1f2b";
      g.fill();
    }
    // 위 부리
    g.beginPath();
    g.moveTo(fo - W * 0.86, by + 2);
    g.bezierCurveTo(fo - W * 0.6, by - 16, fo + W * 0.5, by - 15, fo + L + 7, by + 3);
    g.quadraticCurveTo(fo + W * 0.2, by + 11, fo - W * 0.86, by + 2);
    g.closePath();
    g.fillStyle = shade(g, fo, by - 4, W, "#ffc66e", bc, dc);
    g.fill();
    g.strokeStyle = "#7a3a08";
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = "rgba(122,58,8,.7)";
    oval(g, fo + 3, by - 5, 2.2, 1.6);
    g.fill();
    void C;
  }

  drawHeadwear(g, rx, ry) {
    const h = this.cos.head;
    if (h === "crown") {
      g.save();
      g.translate(2, -ry * 0.96);
      g.fillStyle = "#ffd23f";
      g.strokeStyle = "#8a5a06";
      g.lineWidth = 3.2;
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(-27, 10);
      g.lineTo(-31, -15);
      g.lineTo(-14, -3);
      g.lineTo(0, -21);
      g.lineTo(14, -3);
      g.lineTo(31, -15);
      g.lineTo(27, 10);
      g.quadraticCurveTo(0, 16, -27, 10);
      g.closePath();
      g.fill();
      g.stroke();
      for (const [x, y, c] of [[0, 3, "#e0344a"], [-15, 5, "#3a8cf0"], [15, 5, "#3a8cf0"]]) {
        oval(g, x, y, 3.8, 3.8);
        g.fillStyle = c;
        g.fill();
      }
      g.restore();
    } else if (h === "headband") {
      g.save();
      g.beginPath();
      g.moveTo(-rx * 0.98, -ry * 0.38);
      g.quadraticCurveTo(0, -ry * 0.62, rx * 0.98, -ry * 0.38);
      g.lineTo(rx * 0.96, -ry * 0.18);
      g.quadraticCurveTo(0, -ry * 0.42, -rx * 0.96, -ry * 0.18);
      g.closePath();
      g.fillStyle = "#fff";
      g.fill();
      g.strokeStyle = "#333";
      g.lineWidth = 2.8;
      g.stroke();
      oval(g, rx * 0.14, -ry * 0.44, 7, 7);
      g.fillStyle = "#e0344a";
      g.fill();
      // 뒤로 날리는 끈
      g.strokeStyle = "#fff";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(-rx * 0.94, -ry * 0.28);
      g.quadraticCurveTo(-rx * 1.3, -ry * 0.32 + Math.sin(this.t * 9) * 5, -rx * 1.56, -ry * 0.1 + Math.sin(this.t * 7) * 7);
      g.stroke();
      g.restore();
    } else if (h === "cheer") {
      g.save();
      g.translate(0, -ry * 0.72);
      g.beginPath();
      g.moveTo(-rx * 0.66, 12);
      g.quadraticCurveTo(0, -46, rx * 0.66, 12);
      g.closePath();
      g.fillStyle = "#2f8fe3";
      g.fill();
      g.strokeStyle = "#123a66";
      g.lineWidth = 3;
      g.stroke();
      g.fillStyle = "#fff";
      g.beginPath();
      g.moveTo(-rx * 0.66, 12);
      g.quadraticCurveTo(0, 2, rx * 0.66, 12);
      g.quadraticCurveTo(rx * 0.96, 18, rx * 1, 26);
      g.quadraticCurveTo(0, 12, -rx * 0.42, 22);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
    if (this.cos.face === "sunglasses") {
      const fo = rx * 0.14;
      g.fillStyle = "#16161e";
      g.strokeStyle = "#16161e";
      g.lineWidth = 3;
      for (const x of [fo - rx * 0.4, fo + rx * 0.38]) {
        g.beginPath();
        g.roundRect(x - rx * 0.27, -ry * 0.2, rx * 0.54, ry * 0.36, 7);
        g.fill();
      }
      g.beginPath();
      g.moveTo(fo - rx * 0.16, -ry * 0.1);
      g.lineTo(fo + rx * 0.14, -ry * 0.1);
      g.stroke();
      g.fillStyle = "rgba(255,255,255,.3)";
      g.beginPath();
      g.moveTo(fo - rx * 0.58, -ry * 0.16);
      g.lineTo(fo - rx * 0.42, -ry * 0.16);
      g.lineTo(fo - rx * 0.54, ry * 0.08);
      g.lineTo(fo - rx * 0.62, ry * 0.08);
      g.closePath();
      g.fill();
    }
  }
}
