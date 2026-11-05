/*
 * 승부차기 히어로
 *  - 내 차례: 화면을 밀면 선수가 달려 나가고, 손을 떼는 순간 찹니다 (밀어 올린 곳으로 · 빠르게 밀수록 강슛 · 휘어 밀면 감아차기)
 *  - 상대 차례: 내가 골키퍼. 공이 올 곳을 눌러 몸을 날립니다
 *  - 공 물리 · 골대 · 키퍼 손 · 그물이 모두 실제로 부딪힙니다. 결과를 미리 정하지 않습니다.
 *  - 5번씩 차고 동점이면 서든데스. 대회 3개 · 경기 9개
 */
import { THREE, clamp, lerp, std } from "../../oneshot-elite/js/kit.js";
import { Engine, ATMOS } from "../../oneshot-elite/js/engine.js";
import { Sfx } from "../../oneshot-elite/js/sfx.js";
import { Particles, Trail, ArcDots } from "../../minigolf/js/props.js";
import { buildStadium, buildGoal, Net, ballTexture, GOAL, SPOT, BALL_R } from "./scene.js";
import { makePlayer, setPose, blendPose, runPose, aimArm, makeColliders, updateColliders, POSE, KITS } from "./people.js?v=2";

const $ = (id) => document.getElementById(id);
const G = 9.8;
const DRAG = 0.0105;
const SAVE_KEY = "penalty-hero-v2";
const RUN_TIME = 0.46;
const SPOT_Y = BALL_R;

ATMOS.pkNight = { top: "#040a22", hor: "#1b2f63", low: "#0a1022", sun: "#fff8ec", sunI: 3.1, sunEl: 58, sunAz: 158, hemiSky: "#c9d8ff", hemiGround: "#54704a", hemiI: 0.85, env: 0.6, fog: "#1a2748", fogD: 0.0115, exp: 1.08, clouds: 0, cloudDark: 0, mtn: "#0a0f1c", grade: "night", stars: true };

const TEAMS = [
  { name: "토끼 FC", kit: { shirt: 0xff8fb4, trim: 0xffffff, shorts: 0xffffff, socks: 0xff8fb4, shoes: 0xffffff, number: "#ffffff" } },
  { name: "여우 유나이티드", kit: { shirt: 0xf08a2c, trim: 0xffffff, shorts: 0x5a3214, socks: 0xf08a2c, shoes: 0x222222, number: "#ffffff" } },
  { name: "곰돌이 시티", kit: { shirt: 0x8d5a34, trim: 0xf4d9a8, shorts: 0xf4d9a8, socks: 0x8d5a34, shoes: 0x222222, number: "#f4d9a8" } },
  { name: "펭귄 로버스", kit: { shirt: 0x20232e, trim: 0xf7c52c, shorts: 0xf4f4f4, socks: 0x20232e, shoes: 0xf7c52c, number: "#f7c52c" } },
  { name: "호랑이 FC", kit: { shirt: 0xf7b51d, trim: 0x20232e, shorts: 0x20232e, socks: 0xf7b51d, shoes: 0x20232e, number: "#20232e" } },
  { name: "늑대 유나이티드", kit: { shirt: 0x54708f, trim: 0xe7edf3, shorts: 0x2f3f52, socks: 0x54708f, shoes: 0xe7edf3, number: "#e7edf3" } },
  { name: "독수리 시티", kit: { shirt: 0x1d8a5e, trim: 0xffffff, shorts: 0xffffff, socks: 0x1d8a5e, shoes: 0x20232e, number: "#ffffff" } },
  { name: "드래곤 FC", kit: { shirt: 0xc4232f, trim: 0xf7c52c, shorts: 0x20232e, socks: 0xc4232f, shoes: 0xf7c52c, number: "#f7c52c" } },
  { name: "전설의 올스타", kit: { shirt: 0x5a2fa6, trim: 0xf7c52c, shorts: 0xf7c52c, socks: 0x5a2fa6, shoes: 0xf7c52c, number: "#f7c52c" } },
];
const GK_KITS = [
  { shirt: 0x2fa86a, trim: 0xffffff, shorts: 0x14563a, socks: 0x2fa86a, shoes: 0x222222, number: "#ffffff", gloves: 0xf4f6f4, long: true },
  { shirt: 0x8d3fc4, trim: 0xffffff, shorts: 0x3f1a63, socks: 0x8d3fc4, shoes: 0x222222, number: "#ffffff", gloves: 0xf4f6f4, long: true },
  { shirt: 0x24b1d6, trim: 0x123c60, shorts: 0x123c60, socks: 0x24b1d6, shoes: 0x222222, number: "#ffffff", gloves: 0xf4f6f4, long: true },
];
const CUPS = ["동네 리그", "전국 대회", "세계 챔피언스컵"];
const STAGE_NAME = ["8강", "4강", "결승"];
const OUR_NUMBERS = [10, 7, 9, 11, 19, 14, 8];

function pickQuality() {
  const q = new URLSearchParams(location.search).get("q");
  if (q === "high" || q === "mid" || q === "low") return q;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (coarse) return cores >= 6 && mem >= 4 ? "mid" : "low";
  return mem >= 6 && cores >= 6 ? "high" : "mid";
}

/* ---------- 소리 ---------- */
class Sound extends Sfx {
  crowdOn() {
    if (!this.ctx || this.crowd) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 720;
    f.Q.value = 0.5;
    const g = c.createGain();
    g.gain.value = 0;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start();
    this.crowd = { g, f };
  }
  crowdLevel(v, tone = 720, time = 0.5) {
    if (!this.crowd) return;
    const t = this.ctx.currentTime;
    this.crowd.g.gain.setTargetAtTime(v, t, time);
    this.crowd.f.frequency.setTargetAtTime(tone, t, time);
  }
  whistle() {
    if (!this.ctx) return;
    for (let i = 0; i < 2; i += 1) {
      this.tone(2300, 0.16, "sine", 0.1, 1, i * 0.18);
      this.tone(2480, 0.16, "sine", 0.07, 1, i * 0.18);
    }
  }
  kick(power) {
    this.tone(150, 0.14, "sine", 0.5 + power * 0.3, 0.45);
    this.noise(0.05, 2400, "bandpass", 1.1, 0.4 + power * 0.3);
  }
  step() {
    this.noise(0.05, 500, "lowpass", 0.7, 0.14);
  }
  netHit() {
    this.noise(0.32, 3400, "highpass", 0.5, 0.38, 0.01);
    this.noise(0.22, 1200, "bandpass", 1, 0.2);
  }
  post() {
    this.tone(1680, 0.5, "triangle", 0.3, 0.97);
    this.tone(2910, 0.35, "sine", 0.15, 0.98);
    this.tone(210, 0.12, "sine", 0.3, 0.6);
  }
  glove() {
    this.noise(0.09, 1300, "bandpass", 0.9, 0.7);
    this.tone(240, 0.09, "sine", 0.35, 0.6);
  }
  roar() {
    this.crowdLevel(0.4, 1250, 0.12);
    this.noise(1.9, 1600, "bandpass", 0.5, 0.2, 0.3);
    setTimeout(() => this.crowdLevel(0.1, 760, 1.4), 1500);
  }
  groan() {
    this.crowdLevel(0.16, 480, 0.2);
    setTimeout(() => this.crowdLevel(0.07, 720, 1), 900);
  }
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.16, 1, i * 0.11));
  }
  sad() {
    this.tone(330, 0.3, "triangle", 0.12, 0.8);
    this.tone(262, 0.42, "triangle", 0.12, 0.8, 0.22);
  }
}

class Game {
  constructor(canvasEl, quality) {
    this.quality = quality;
    const E = new Engine(canvasEl, { quality });
    this.E = E;
    E.vmVisible = false;
    const { scene } = E;
    this.stadium = buildStadium(scene, quality);
    // 카메라 쪽에서 비추는 빛: 플레이어가 보는 선수의 등이 어둡지 않게
    const fill = new THREE.DirectionalLight(0xfff4e6, 1.15);
    fill.position.set(3, 7, 30);
    fill.target.position.set(0, 1, 6);
    scene.add(fill, fill.target);
    buildGoal(scene);
    this.net = new Net(scene);
    this.sfx = new Sound();

    // 공
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 20), std({ map: ballTexture(quality === "low" ? 256 : 512), roughness: 0.42 }));
    this.ballMesh.castShadow = true;
    scene.add(this.ballMesh);
    this.ball = { x: SPOT.x, y: SPOT_Y, z: SPOT.z, vx: 0, vy: 0, vz: 0, ax: 0, on: false, spin: 0 };
    // 공 그림자 (위치 파악을 도움)
    const shadowCv = document.createElement("canvas");
    shadowCv.width = shadowCv.height = 64;
    const sg = shadowCv.getContext("2d");
    const gr = sg.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,0.6)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    sg.fillStyle = gr;
    sg.fillRect(0, 0, 64, 64);
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCv), transparent: true, depthWrite: false, fog: false }));
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);

    // 선수
    this.kicker = makePlayer(KITS.korea, { number: 10 });
    this.keeper = makePlayer(KITS.keeper, { number: 1 });
    scene.add(this.kicker.root);
    scene.add(this.keeper.root);
    this.colliders = makeColliders();

    // 조준 표시
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 40), ringMat);
    this.ring.renderOrder = 9;
    this.ringDot = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), ringMat);
    this.ringDot.renderOrder = 9;
    this.ring.visible = false;
    this.ringDot.visible = false;
    scene.add(this.ring);
    scene.add(this.ringDot);

    this.particles = new Particles(scene, 320);
    this.trail = new Trail(scene);
    this.arc = new ArcDots(scene);

    this.state = "title";
    this.paused = false;
    this.time = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.camPos = new THREE.Vector3(10, 4, 26);
    this.camLook = new THREE.Vector3(0, 1.2, 0);
    this.camGoal = this.camPos.clone();
    this.lookGoal = this.camLook.clone();
    this.camRate = 3;
    this.shake = 0;
    this.save = this.loadSave();
    this.lv = this.save.lv;
    this.score = this.save.score;
    this.match = null;
    this.turn = null;
    this.hintShots = 0;

    E.setAtmos("pkNight", { shadowCenter: new THREE.Vector3(0, 0, 8), shadowSize: 22, seed: 5, mountains: false, smoke: [] });
    const C = E.compU;
    if (C) {
      C.sat.value = 1.12;
      C.contrast.value = 1.08;
      C.vig.value = 0.32;
      C.grain.value = 0.006;
      C.lift.value.set(0.004, 0.006, 0.012);
    }
    this.resetField("korea");
    setPose(this.kicker, POSE.stand);
    this.keeperIdle();
    this.bindInput();
    this.renderTitle();
    E.resize();
    this.fitCamera();
    addEventListener("resize", () => {
      E.resize();
      this.fitCamera();
    });
    if (window.visualViewport) visualViewport.addEventListener("resize", () => {
      E.resize();
      this.fitCamera();
    });
    this.last = performance.now();
    this.frame = this.frame.bind(this);
  }

  /* ---------- 저장 ---------- */
  loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return { lv: clamp(Number(d.lv) || 0, 0, 8), score: Number(d.score) || 0, best: Number(d.best) || 0 };
    } catch (_) {
      return { lv: 0, score: 0, best: 0 };
    }
  }
  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch (_) {
      /* 저장이 막혀 있어도 게임은 계속 */
    }
  }
  matchName(lv) {
    return `${CUPS[Math.floor(lv / 3)]} ${STAGE_NAME[lv % 3]}`;
  }
  renderTitle() {
    const { lv, best } = this.save;
    $("start-btn").textContent = lv > 0 ? `이어서 · ${this.matchName(lv)}` : "경기 시작";
    $("restart-btn").classList.toggle("hidden", lv === 0);
    $("title-best").textContent = `최고 ${best.toLocaleString("ko-KR")}점`;
  }
  /* 어려움 값 (lv: 0~8) */
  aiParams() {
    const t = this.lv / 8;
    return {
      react: lerp(0.17, 0.08, t),
      guess: lerp(0.32, 0.6, t),
      diveSpeed: lerp(6.8, 8.5, t),
      noise: lerp(0.4, 0.14, t),
      shotSpeed: lerp(19.5, 27, t),
      corner: lerp(0.35, 0.85, t),
      miss: lerp(0.12, 0.03, t),
      honest: lerp(0.8, 0.42, t),
    };
  }

  /* ---------- 경기 ---------- */
  startMatch(lv) {
    this.sfx.unlock();
    this.sfx.crowdOn();
    this.sfx.crowdLevel(0.09, 760, 0.6);
    this.lv = lv;
    this.scoreAtStart = this.score;
    const team = TEAMS[lv];
    this.match = { team, gkKit: GK_KITS[lv % GK_KITS.length], us: [], them: [], first: lv === 0 || Math.random() < 0.5 ? "us" : "them", kicks: 0, sudden: false, pattern: [] };
    this.state = "intro";
    this.introT = 0;
    this.showOverlay(null);
    document.body.classList.add("in-match");
    $("sb-us").textContent = "대한민국";
    $("sb-them").textContent = team.name;
    this.paintBoard();
    const b = $("banner");
    b.querySelector(".b-cup").textContent = this.matchName(lv);
    b.querySelector(".b-vs").textContent = `대한민국 VS ${team.name}`;
    b.classList.add("show");
    this.resetField("korea");
    setPose(this.kicker, POSE.stand);
    this.camGoal.set(0, 3.2, 21);
    this.lookGoal.set(0, 1.3, 0);
    this.camRate = 1.6;
    this.sfx.whistle();
  }
  paintBoard() {
    const m = this.match;
    if (!m) return;
    const usGoals = m.us.filter(Boolean).length;
    const themGoals = m.them.filter(Boolean).length;
    $("sb-score").textContent = `${usGoals} : ${themGoals}`;
    const dots = (list, el) => {
      const shown = list.length > 5 ? list.slice(-5) : list;
      let html = "";
      for (let i = 0; i < 5; i += 1) html += `<i class="${shown[i] === true ? "g" : shown[i] === false ? "x" : ""}"></i>`;
      el.innerHTML = html;
    };
    dots(m.us, $("sb-dots-us"));
    dots(m.them, $("sb-dots-them"));
    $("hud-score").textContent = this.score.toLocaleString("ko-KR");
    $("sb-round").textContent = m.sudden ? "서든데스" : `${Math.min(5, Math.floor(m.kicks / 2) + 1)}번째`;
  }
  nextTurnType() {
    const m = this.match;
    const firstTurn = m.kicks % 2 === 0;
    return (m.first === "us") === firstTurn ? "shoot" : "keep";
  }
  beginTurn() {
    const type = this.nextTurnType();
    const m = this.match;
    const ai = this.aiParams();
    this.turn = { type, t: 0, done: false, touched: false, touchT: 0, posted: false, dove: false, result: null };
    this.shot = null;
    this.trail.clear();
    this.arc.clear();
    this.ring.visible = false;
    this.ringDot.visible = false;
    this.slowT = 0;
    this.timeScale = 1;
    this.resetField(type === "shoot" ? "korea" : "them");
    $("shout").classList.remove("show");
    this.paintBoard();
    if (type === "shoot") {
      this.state = "aim";
      $("hint").textContent = "화면을 위로 밀었다가 떼면 슛!";
      $("hint").classList.remove("hidden");
      $("finger").classList.toggle("hidden", this.hintShots >= 3);
      $("keep-pad").classList.add("hidden");
    } else {
      this.state = "keepWait";
      this.turn.wait = 0.95;
      this.turn.plan = this.aiPickShot(ai);
      $("hint").textContent = "공이 올 곳을 누르세요!";
      $("hint").classList.remove("hidden");
      $("finger").classList.add("hidden");
      $("keep-pad").classList.remove("hidden");
      document.querySelectorAll("#keep-pad button").forEach((x) => x.classList.remove("on"));
    }
    this.sfx.crowdLevel(0.05, 640, 0.5);
    this.stadium.setCheer(0.06);
    void m;
  }
  /** 선수 · 공을 제자리로 */
  resetField(side) {
    const b = this.ball;
    Object.assign(b, { x: SPOT.x, y: SPOT_Y, z: SPOT.z, vx: 0, vy: 0, vz: 0, ax: 0, on: false, spin: 0 });
    this.ballMesh.visible = true;
    this.ballMesh.position.set(b.x, b.y, b.z);
    const m = this.match;
    const K = this.kicker;
    const GKp = this.keeper;
    if (side === "korea") {
      K.setKit(KITS.korea, OUR_NUMBERS[(m ? m.us.length : 0) % OUR_NUMBERS.length]);
      K.setFace(true);
      GKp.setKit(m ? m.gkKit : GK_KITS[0], 1);
      GKp.setFace(false);
    } else {
      K.setKit(m.team.kit, 7 + (m.them.length % 5) * 2);
      K.setFace(false);
      GKp.setKit(KITS.keeper, 1);
      GKp.setFace(true);
    }
    this.kick = { state: "idle", t: 0, phase: 0, sx: this.E.camera.aspect < 1 ? -0.85 : -1.7, sz: SPOT.z + (this.E.camera.aspect < 1 ? 1.6 : 1.75), px: SPOT.x - 0.17, pz: SPOT.z + 0.62, release: false };
    K.root.position.set(this.kick.sx, K.hipY, this.kick.sz);
    K.root.rotation.set(0, Math.atan2(this.kick.px - this.kick.sx, this.kick.pz - this.kick.sz), 0);
    setPose(K, POSE.stand);
    GKp.root.position.set(0, 0.74, 0.34);
    GKp.root.rotation.set(0, 0, 0);
    setPose(GKp, POSE.keeperReady);
    this.dive = null;
    this.gkAnim = { state: "ready", t: 0, side: 0 };
    this.caught = false;
    this.net.active = 2;
  }
  keeperIdle() {
    this.gkAnim = { state: "ready", t: 0, side: 0 };
  }

  /* ---------- 공 ---------- */
  /** 목표(x, y)에 골라인(z=0)에서 닿도록 처음 속도를 찾음 */
  solveShot(tx, ty, speed, curve) {
    const dz = SPOT.z;
    const ax = -Math.sign(curve) * Math.abs(curve) * 26;
    let t = dz / speed;
    let vx = (tx - SPOT.x) / t;
    let vy = (ty - SPOT_Y + 0.5 * G * t * t) / t;
    let vz = -speed;
    for (let it = 0; it < 6; it += 1) {
      const r = this.simToLine(vx, vy, vz, ax);
      t = r.t;
      vx += (tx - r.x) / t;
      vy += (ty - r.y) / t;
    }
    return { vx, vy, vz, ax, t };
  }
  simToLine(vx, vy, vz, ax, points) {
    let x = SPOT.x;
    let y = SPOT_Y;
    let z = SPOT.z;
    const dt = 1 / 120;
    let t = 0;
    let n = 0;
    while (z > 0 && t < 3) {
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      vx += (ax - DRAG * sp * vx) * dt;
      vy += (-G - DRAG * sp * vy) * dt;
      vz += -DRAG * sp * vz * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      if (y < BALL_R) {
        y = BALL_R;
        vy = Math.abs(vy) * 0.55;
      }
      t += dt;
      n += 1;
      if (points && n % 6 === 0) points.push(x, y, z);
    }
    return { x, y, t };
  }
  launch(tx, ty, speed, curve) {
    const b = this.ball;
    const s = this.solveShot(tx, ty, speed, curve);
    b.vx = s.vx;
    b.vy = s.vy;
    b.vz = s.vz;
    b.ax = s.ax;
    b.on = true;
    b.t = 0;
    b.spin = 12 + speed * 0.4;
    this.shot = { tx, ty, speed, curve, arrive: s.t, startedAt: this.time };
    this.turn.kicked = true;
    this.sfx.kick(clamp((speed - 18) / 12, 0, 1));
    this.particles.burst(b.x, 0.08, b.z + 0.05, 14, "#7fb85a", 1.8, 2.6, 0.5);
    this.shake = 0.06;
    this.stadium.setCheer(0.16);
    this.sfx.crowdLevel(0.16, 980, 0.1);
    this.net.active = 3;
  }
  stepBall(dtFrame) {
    const b = this.ball;
    if (!b.on) return;
    const steps = Math.max(1, Math.ceil(dtFrame / (1 / 240)));
    const dt = dtFrame / steps;
    updateColliders(this.keeper, this.colliders);
    for (let i = 0; i < steps; i += 1) {
      if (this.caught) break;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
      const curveOn = b.y > BALL_R + 0.02 && !this.turn.touched && !this.turn.posted;
      b.vx += ((curveOn ? b.ax : 0) - DRAG * sp * b.vx) * dt;
      b.vy += (-G - DRAG * sp * b.vy) * dt;
      b.vz += -DRAG * sp * b.vz * dt;
      const pz = b.z;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.t += dt;
      if (b.y < BALL_R) {
        b.y = BALL_R;
        if (b.vy < -1.2) {
          b.vy = -b.vy * 0.56;
          if (Math.abs(b.z) < 12) this.particles.burst(b.x, 0.05, b.z, 4, "#7fb85a", 0.8, 1.2, 0.4);
        } else b.vy = 0;
        b.vx *= 1 - 1.2 * dt;
        b.vz *= 1 - 1.2 * dt;
      }
      this.collidePosts(b);
      if (!this.turn.touched || b.t - this.turn.touchT > 0.05) this.collideKeeper(b);
      // 골라인 통과 판정
      if (!this.turn.done && pz > -BALL_R && b.z <= -BALL_R) {
        if (Math.abs(b.x) < GOAL.hw - 0.02 && b.y < GOAL.h - 0.02) {
          this.resolve("goal");
        } else {
          this.resolve(this.turn.posted ? "post" : b.y >= GOAL.h ? "over" : "wide");
        }
      }
      // 그물 안: 천에 걸려 속도가 죽고 떨어짐
      if (b.z < -0.05 && Math.abs(b.x) < GOAL.hw && b.y < GOAL.h + 0.1 && this.turn.result === "goal") {
        const backZ = -GOAL.depth * 0.5 - (1 - b.y / GOAL.h) * GOAL.depth * 0.48;
        if (b.z < backZ) {
          if (!this.turn.netSound) {
            this.turn.netSound = true;
            this.sfx.netHit();
            this.net.poke(b.x, b.y, b.z, 0.5, -0.16);
          }
          b.vz = Math.max(b.vz * (1 - 11 * dt), b.vz + 26 * dt);
          b.vx *= 1 - 7 * dt;
          b.vy *= 1 - 3 * dt;
          if (b.z < backZ - 0.55) {
            b.z = backZ - 0.55;
            b.vz = Math.abs(b.vz) * 0.1;
          }
        }
        if (Math.abs(b.x) > GOAL.hw - 0.1) b.vx *= -0.3;
      }
    }
    if (this.caught) {
      const hL = new THREE.Vector3();
      this.keeper.j.handL.getWorldPosition(hL);
      const hR = new THREE.Vector3();
      this.keeper.j.handR.getWorldPosition(hR);
      hL.add(hR).multiplyScalar(0.5);
      b.x = hL.x;
      b.y = Math.max(BALL_R, hL.y);
      b.z = hL.z + 0.06;
    }
    this.ballMesh.position.set(b.x, b.y, b.z);
    const roll = (b.spin || 0) * dtFrame;
    this.ballMesh.rotation.x -= roll;
    this.ballMesh.rotation.z += b.ax * 0.012 * dtFrame * 8;
    b.spin *= 1 - 0.3 * dtFrame;
    if (b.z > -3) this.trail.push(b.x, b.y, b.z);
    this.trail.update(this.E.camera.position);
    // 공 그림자
    this.blob.position.set(b.x, 0.015, b.z);
    const s = 1 + b.y * 0.5;
    this.blob.scale.set(s, s, 1);
    this.blob.material.opacity = clamp(1 - b.y * 0.22, 0.2, 0.85);
  }
  collidePosts(b) {
    const hit = (dx, dy, dz) => {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4;
      if (d > BALL_R + GOAL.postR) return;
      const nx = dx / d;
      const ny = dy / d;
      const nz = dz / d;
      const vn = b.vx * nx + b.vy * ny + b.vz * nz;
      if (vn >= 0) return;
      b.vx -= 1.62 * vn * nx;
      b.vy -= 1.62 * vn * ny;
      b.vz -= 1.62 * vn * nz;
      const push = BALL_R + GOAL.postR - d;
      b.x += nx * push;
      b.y += ny * push;
      b.z += nz * push;
      if (!this.turn.posted) {
        this.turn.posted = true;
        this.turn.postT = b.t;
        this.sfx.post();
        this.shake = Math.max(this.shake, 0.08);
      }
    };
    if (b.y < GOAL.h + 0.2) {
      hit(b.x - GOAL.hw, 0, b.z);
      hit(b.x + GOAL.hw, 0, b.z);
    }
    if (Math.abs(b.x) < GOAL.hw) hit(0, b.y - GOAL.h, b.z);
  }
  collideKeeper(b) {
    for (const c of this.colliders) {
      const dx = b.x - c.pos.x;
      const dy = b.y - c.pos.y;
      const dz = b.z - c.pos.z;
      const rr = c.r + BALL_R;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > rr * rr) continue;
      const d = Math.sqrt(d2) || 1e-4;
      const nx = dx / d;
      const ny = dy / d;
      const nz = dz / d;
      const vn = b.vx * nx + b.vy * ny + b.vz * nz;
      if (vn >= 0) continue;
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      // 정면으로 느리게 오는 공은 잡음
      if (c.kind === "glove" && sp < 17 && Math.abs(b.y - 1) < 1.2 && !this.dive?.far && !this.turn.posted) {
        this.caught = true;
        b.vx = 0;
        b.vy = 0;
        b.vz = 0;
        b.on = true;
        this.onTouch(true, b);
        return;
      }
      const e = c.kind === "glove" ? 0.34 : 0.5;
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;
      b.vz -= (1 + e) * vn * nz;
      // 손에 맞으면 옆으로 쳐냄
      if (c.kind === "glove") {
        const side = Math.sign(b.x || 1);
        b.vx += side * 2.2;
        b.vy += 1.5;
      }
      b.spin = 18;
      this.onTouch(false, b);
      return;
    }
  }
  onTouch(catchIt, b) {
    if (!this.turn.touched) {
      this.turn.touched = true;
      this.turn.touchT = b.t;
      this.sfx.glove();
      this.particles.burst(b.x, b.y, b.z, 14, "#fffbe0", 1.8, 1.6, 0.45, 0.4);
      this.shake = Math.max(this.shake, 0.1);
      this.slowT = 0.42;
    }
    if (catchIt) this.resolve("catch");
  }

  /* ---------- 결과 ---------- */
  resolve(kind) {
    const t = this.turn;
    if (t.done) return;
    t.done = true;
    t.result = kind;
    t.resT = 0;
    const goal = kind === "goal";
    const m = this.match;
    const mine = t.type === "shoot";
    const s = $("shout");
    const b = this.ball;
    let word = "";
    let sub = "";
    let cls = "";
    if (mine) m.us.push(goal);
    else m.them.push(goal);
    m.kicks += 1;
    const cornerShot = Math.abs(b.x) > 2.6;
    if (goal) {
      this.net.poke(b.x, b.y, b.z - 0.1, 0.55, -0.1);
      if (mine) {
        let pts = 300 + Math.round((this.shot.speed - 20) * 14);
        const bits = [];
        if (cornerShot) {
          pts += 150;
          bits.push("구석");
        }
        if (Math.abs(this.shot.curve) > 0.35) {
          pts += 100;
          bits.push("감아차기");
        }
        if (this.shot.speed > 28) bits.push("강슛");
        this.score += pts;
        word = "GOAL!";
        sub = `${bits.join(" · ")}${bits.length ? " · " : ""}+${pts}`;
        cls = "good";
        this.goalFx(b);
        this.sfx.roar();
        this.stadium.setCheer(0.62);
        this.kick.state = "celebrate";
        this.kick.t = 0;
        t.dur = 2.6;
      } else {
        word = "실점";
        sub = cornerShot ? "구석으로 들어갔어요" : "다음엔 막아 봐요";
        cls = "bad";
        this.sfx.groan();
        this.stadium.setCheer(0.14);
        this.kick.state = "celebrate";
        this.kick.t = 0;
        t.dur = 1.9;
      }
    } else {
      const saved = kind === "catch" || t.touched;
      if (mine) {
        word = kind === "post" || (t.posted && !saved) ? "골대!" : saved ? "막혔어요!" : "빗나갔어요";
        sub = "";
        cls = "bad";
        this.kick.state = "sad";
        this.kick.t = 0;
        this.sfx.groan();
        this.stadium.setCheer(0.1);
        t.dur = 1.8;
      } else if (saved || t.posted) {
        const pts = saved ? 500 : 150;
        this.score += pts;
        word = saved ? "슈퍼 세이브!" : "골대 도움!";
        sub = `+${pts}`;
        cls = "good";
        this.goalFx(b, true);
        this.sfx.roar();
        this.stadium.setCheer(0.56);
        this.kick.state = "sad";
        this.kick.t = 0;
        this.turn.gkCheer = saved;
        t.dur = 2.3;
      } else {
        const pts = 150;
        this.score += pts;
        word = "상대 실축!";
        sub = `+${pts}`;
        cls = "good";
        this.sfx.roar();
        this.stadium.setCheer(0.42);
        this.kick.state = "sad";
        this.kick.t = 0;
        t.dur = 1.9;
      }
    }
    if (goal && mine) this.slowT = Math.max(this.slowT, 0.5);
    this.state = "result";
    s.querySelector("b").textContent = word;
    s.querySelector("small").textContent = sub;
    s.className = `shout show ${cls}`;
    this.paintBoard();
    $("hint").classList.add("hidden");
    $("keep-pad").classList.add("hidden");
    this.arc.clear();
    this.ring.visible = false;
    this.ringDot.visible = false;
    if (mine) m.pattern.push(Math.sign(Math.round(b.x / 1.4)));
  }
  goalFx(b, keeperSide = false) {
    const cols = ["#ffd24a", "#ff5a6e", "#5fd0ff", "#ffffff", "#8ff07a"];
    const x = keeperSide ? this.keeper.root.position.x : clamp(b.x, -3.4, 3.4);
    for (const c of cols) this.particles.burst(x, keeperSide ? 1.4 : 1.2, 0.1, 30, c, 4.4, 8.5, 1.8, 0.55);
    this.shake = Math.max(this.shake, 0.14);
  }
  afterResult() {
    const m = this.match;
    const us = m.us.filter(Boolean).length;
    const them = m.them.filter(Boolean).length;
    const kickedUs = m.us.length;
    const kickedThem = m.them.length;
    let over = false;
    if (kickedUs <= 5 && kickedThem <= 5 && !m.sudden) {
      const leftUs = 5 - kickedUs;
      const leftThem = 5 - kickedThem;
      if (us > them + leftThem || them > us + leftUs) over = true;
      if (kickedUs === 5 && kickedThem === 5) {
        if (us !== them) over = true;
        else m.sudden = true;
      }
    } else if (kickedUs === kickedThem && us !== them) {
      over = true;
    }
    this.paintBoard();
    if (over) this.endMatch(us > them);
    else this.beginTurn();
  }
  endMatch(won) {
    const m = this.match;
    const us = m.us.filter(Boolean).length;
    const them = m.them.filter(Boolean).length;
    document.body.classList.remove("in-match");
    this.state = "matchEnd";
    $("shout").classList.remove("show");
    $("hint").classList.add("hidden");
    if (won) {
      const bonus = 1000 + this.lv * 250;
      this.score += bonus;
      const lastOfCup = this.lv % 3 === 2;
      const allDone = this.lv >= 8;
      this.save.best = Math.max(this.save.best, this.score);
      this.save.lv = allDone ? 0 : this.lv + 1;
      this.save.score = allDone ? 0 : this.score;
      this.persist();
      this.sfx.fanfare();
      this.stadium.setCheer(0.7);
      const title = allDone ? "세계 챔피언!" : lastOfCup ? `${CUPS[Math.floor(this.lv / 3)]} 우승!` : "승리!";
      $("win-title").textContent = title;
      $("win-detail").innerHTML = `${us} : ${them} · 승리 보너스 <b>+${bonus.toLocaleString("ko-KR")}</b><br />총 <b>${this.score.toLocaleString("ko-KR")}점</b>`;
      $("win-trophy").classList.toggle("hidden", !lastOfCup);
      $("win-next").textContent = allDone ? "처음부터 다시" : `다음 경기 · ${this.matchName(this.lv + 1)}`;
      $("win-rank").classList.toggle("hidden", !lastOfCup);
      this.showOverlay("win");
      if (lastOfCup && window.TodayGameRank) {
        window.TodayGameRank.mount({ gameId: "penalty-kick", gameTitle: "승부차기 히어로", formParent: $("win-rank") });
        window.TodayGameRank.open(Math.max(1, this.score), { label: `${this.matchName(this.lv)} · ${this.score.toLocaleString("ko-KR")}점` });
      }
      this.wonAll = allDone;
    } else {
      this.save.best = Math.max(this.save.best, this.score);
      this.persist();
      this.sfx.sad();
      this.stadium.setCheer(0.08);
      $("lose-detail").innerHTML = `${this.matchName(this.lv)} · ${us} : ${them}<br />총 <b>${this.score.toLocaleString("ko-KR")}점</b>`;
      this.showOverlay("lose");
      if (window.TodayGameRank) {
        window.TodayGameRank.mount({ gameId: "penalty-kick", gameTitle: "승부차기 히어로", formParent: $("lose-rank") });
        window.TodayGameRank.open(Math.max(1, this.score), { label: `${this.matchName(this.lv)} · ${this.score.toLocaleString("ko-KR")}점` });
      }
    }
  }
  showOverlay(name) {
    for (const k of ["title", "win", "lose"]) $(k).classList.toggle("hidden", k !== name);
  }

  /* ---------- AI ---------- */
  aiPickShot(ai) {
    const corner = Math.random() < ai.corner;
    const side = Math.random() < 0.5 ? -1 : 1;
    let tx;
    let ty;
    if (Math.random() < 0.12) {
      tx = (Math.random() - 0.5) * 1.6;
      ty = 0.4 + Math.random() * 1.3;
    } else if (corner) {
      tx = side * (2.5 + Math.random() * 0.85);
      ty = Math.random() < 0.5 ? 0.3 + Math.random() * 0.4 : 1.55 + Math.random() * 0.6;
    } else {
      tx = side * (1 + Math.random() * 1.7);
      ty = 0.35 + Math.random() * 1.4;
    }
    if (Math.random() < ai.miss) {
      // 실축: 밖으로
      if (Math.random() < 0.5) tx = side * (GOAL.hw + 0.4 + Math.random() * 0.8);
      else ty = GOAL.h + 0.3 + Math.random() * 0.6;
    }
    return { tx, ty, speed: ai.shotSpeed * (0.92 + Math.random() * 0.14), curve: Math.random() < 0.3 ? (Math.random() - 0.5) * 1.2 : 0 };
  }
  /** 상대 키퍼: 공이 차인 뒤 조금 늦게 움직임 */
  aiKeeperPlan() {
    const ai = this.aiParams();
    const { tx, ty } = this.shot;
    const pat = this.match.pattern;
    const shotSide = Math.sign(Math.round(tx / 1.4));
    // 약하게 찬 공 · 가운데 공은 읽기 쉽고, 빠른 구석 공은 어려움
    const slowBonus = clamp((26 - this.shot.speed) * 0.05, 0, 0.3);
    const midBonus = Math.abs(tx) < 1.1 ? 0.22 : 0;
    let guessRight = Math.random() < ai.guess + slowBonus + midBonus;
    // 같은 쪽으로 자주 차면 읽힘
    if (pat.length >= 2 && pat.filter((p) => p === shotSide).length / pat.length > 0.6) guessRight = guessRight || Math.random() < 0.35;
    let gx;
    let gy;
    if (guessRight) {
      gx = tx + (Math.random() - 0.5) * ai.noise;
      gy = ty + (Math.random() - 0.5) * ai.noise;
    } else {
      const sides = [-1, 0, 1].filter((v) => v !== shotSide);
      const pick = sides[Math.floor(Math.random() * sides.length)];
      gx = pick * (1.6 + Math.random() * 1.6);
      gy = 0.4 + Math.random() * 1.5;
    }
    const curved = Math.abs(this.shot.curve) > 0.35 ? 0.05 : 0;
    this.gkAnim.plan = { delay: ai.react + curved, gx: clamp(gx, -3.5, 3.5), gy: clamp(gy, 0.2, 2.4), speed: ai.diveSpeed };
  }

  /* ---------- 키퍼 움직임 ---------- */
  startDive(tx, ty, speed) {
    if (this.dive) return;
    const R = this.keeper.root;
    const side = Math.abs(tx) < 0.75 ? 0 : Math.sign(tx);
    this.dive = { t: 0, tx, ty, side, speed, x0: R.position.x, y0: R.position.y, far: Math.abs(tx) > 2.2 };
    this.gkAnim.state = "dive";
    this.sfx.step();
  }
  updateKeeper(dt) {
    const K = this.keeper;
    const R = K.root;
    const A = this.gkAnim;
    A.t += dt;
    if (A.state === "ready") {
      const sway = Math.sin(this.time * 2.1);
      R.position.x = sway * 0.16;
      R.position.y = 0.74 + Math.abs(Math.cos(this.time * 2.1)) * 0.02;
      R.rotation.set(0, 0, 0);
      setPose(K, POSE.keeperReady);
      K.j.armL.rotation.z += Math.sin(this.time * 3.3) * 0.12;
      K.j.armR.rotation.z -= Math.sin(this.time * 3.3) * 0.12;
      K.j.spine.rotation.z = -sway * 0.06;
      if (A.plan && this.shot) {
        A.plan.delay -= dt;
        if (A.plan.delay <= 0) this.startDive(A.plan.gx, A.plan.gy, A.plan.speed);
      }
      return;
    }
    if (A.state === "dive" && this.dive) {
      this.applyDive(dt);
      return;
    }
    if (A.state === "cheer") {
      R.position.y = lerp(R.position.y, K.hipY + Math.abs(Math.sin(A.t * 7)) * 0.32, Math.min(1, dt * 10));
      R.rotation.z *= 1 - Math.min(1, dt * 8);
      blendPose(K, POSE.stand, POSE.armsUp, Math.min(1, A.t * 3));
      K.j.armR.rotation.z += Math.sin(A.t * 9) * 0.2;
      return;
    }
    if (A.state === "downcast") {
      R.position.y = lerp(R.position.y, 0.56, Math.min(1, dt * 5));
      R.rotation.z *= 1 - Math.min(1, dt * 6);
      setPose(K, POSE.kneesDown);
    }
  }
  applyDive(dt) {
    const K = this.keeper;
    const R = K.root;
    const d = this.dive;
    d.t += dt;
    const pre = 0.05;
    const j = K.j;
    if (d.side) {
      const high = clamp((d.ty - 0.4) / 1.8, 0, 1);
      const roll = lerp(1.3, 0.92, high);
      const dirX = Math.sin(roll) * d.side;
      const dirY = Math.cos(roll);
      const hx = d.tx - dirX * 0.98;
      const hy = Math.max(0.3, d.ty - dirY * 0.98);
      const dist = Math.hypot(hx - d.x0, hy - d.y0);
      const T = Math.max(0.16, dist / d.speed);
      const u = clamp((d.t - pre) / T, 0, 1);
      const e = u * (2 - u);
      if (d.t < pre) {
        R.position.y = d.y0 - (d.t / pre) * 0.05;
        setPose(K, POSE.keeperReady);
        return;
      }
      R.position.x = lerp(d.x0, hx, e);
      const after = Math.max(0, d.t - pre - T);
      let y = lerp(d.y0, hy, e) + Math.sin(Math.PI * u) * 0.1;
      if (after > 0) y = Math.max(0.2, hy - 4.9 * after * after);
      R.position.y = y;
      const landed = y <= 0.21;
      R.rotation.set(0, 0, -d.side * lerp(roll * Math.min(1, u * 1.7), 1.5, landed ? 1 : after > 0 ? Math.min(1, after * 2) : 0));
      if (landed && !d.thud) {
        d.thud = true;
        this.sfx.step();
        this.particles.burst(R.position.x, 0.1, R.position.z, 10, "#7fb85a", 1.4, 1.3, 0.5);
      }
      // 몸통은 곧게 · 다리는 뒤로 흔들림
      blendPose(K, POSE.keeperReady, DIVE_BODY, Math.min(1, u * 2));
      j.legL.rotation.x += Math.sin(d.t * 14) * 0.08;
      j.legR.rotation.x -= Math.sin(d.t * 14) * 0.08;
      if (!landed) {
        const b = this.ball;
        const aimAt = TMP.set(b.on && !this.turn.done && b.z < 7 ? b.x * 0.4 + d.tx * 0.6 : d.tx, b.on && !this.turn.done && b.z < 7 ? b.y * 0.4 + d.ty * 0.6 : d.ty, 0.34);
        const k = clamp(u * 2.2, 0, 1);
        K.root.updateMatrixWorld(true);
        aimArm(K, "L", aimAt, k);
        aimArm(K, "R", aimAt, k);
      }
    } else {
      const up = d.ty > 1.25;
      const u = clamp((d.t - pre) / 0.2, 0, 1);
      if (up) {
        const peak = clamp(d.ty - 0.82, 0.74, 1.6);
        const fall = Math.max(0, d.t - pre - 0.22);
        R.position.y = Math.max(0.93, lerp(d.y0, peak, u * (2 - u)) - 4.9 * fall * fall);
        R.position.x = lerp(d.x0, d.tx * 0.75, u);
        R.rotation.z = -d.tx * 0.12;
        blendPose(K, POSE.keeperReady, POSE.armsUp, u);
      } else {
        R.position.y = lerp(d.y0, 0.6, u);
        R.position.x = lerp(d.x0, d.tx * 0.8, u);
        blendPose(K, POSE.keeperReady, SCOOP, u);
      }
      K.root.updateMatrixWorld(true);
      const aim = TMP.set(d.tx, d.ty, 0.5);
      aimArm(K, "L", aim, u);
      aimArm(K, "R", aim, u);
    }
    // 내 키퍼가 잡거나 막은 뒤 환호
    if (this.state === "result" && this.turn.result && this.turn.type === "keep" && this.turn.resT > 0.75 && this.turn.gkCheer) {
      this.gkAnim.state = "cheer";
      this.gkAnim.t = 0;
    }
  }

  /* ---------- 차는 선수 ---------- */
  startRun() {
    this.kick.state = "run";
    this.kick.t = 0;
    this.sfx.step();
  }
  updateKicker(dt) {
    const K = this.kicker;
    const R = K.root;
    const S = this.kick;
    S.t += dt;
    if (S.state === "idle") {
      setPose(K, POSE.stand);
      R.position.y = K.hipY + Math.sin(this.time * 2.4) * 0.006;
      K.j.chest.rotation.x = Math.sin(this.time * 2.4) * 0.018;
      return;
    }
    if (S.state === "run") {
      const speedUp = S.release ? 1.7 : 1;
      S.u = Math.min(1, (S.u || 0) + (dt * speedUp) / (this.turn.type === "keep" ? 0.72 : RUN_TIME));
      const u = S.u;
      const e = u * (0.72 + 0.28 * u);
      R.position.x = lerp(S.sx, S.px, e);
      R.position.z = lerp(S.sz, S.pz, e);
      S.phase += dt * speedUp * (this.turn.type === "keep" ? 10.5 : 15);
      runPose(K, S.phase);
      R.position.y = K.hipY - 0.03 + Math.abs(Math.sin(S.phase)) * 0.05;
      // 공 쪽을 보다가 찰 방향으로
      R.rotation.y = lerp(Math.atan2(S.px - S.sx, S.pz - S.sz), Math.PI + 0.12, u);
      if (Math.floor(S.phase / Math.PI) !== Math.floor((S.phase - dt * 15) / Math.PI)) this.sfx.step();
      if (u >= 1) {
        S.state = S.release || this.turn.type === "keep" ? "strike" : "hold";
        S.t = 0;
      }
      return;
    }
    if (S.state === "hold") {
      // 디딤발을 딛고 기다림 (손을 떼면 찬다)
      const k = Math.min(1, S.t * 9);
      blendPose(K, POSE.stand, POSE.kickBack, k);
      R.position.y = K.hipY - 0.07 - Math.sin(this.time * 6) * 0.004;
      R.rotation.y = Math.PI + 0.12;
      if (S.release) {
        S.state = "strike";
        S.t = 0;
      }
      return;
    }
    if (S.state === "strike") {
      const D = 0.1;
      const u = Math.min(1, S.t / D);
      blendPose(K, POSE.kickBack, POSE.kickHit, u * u);
      R.position.y = K.hipY - 0.07;
      R.rotation.y = Math.PI + 0.12 - u * 0.22;
      if (u >= 1) {
        S.state = "follow";
        S.t = 0;
        this.strikeBall();
      }
      return;
    }
    if (S.state === "follow") {
      const a = Math.min(1, S.t / 0.2);
      const b = clamp((S.t - 0.26) / 0.55, 0, 1);
      if (b <= 0) blendPose(K, POSE.kickHit, POSE.kickFollow, a * (2 - a));
      else blendPose(K, POSE.kickFollow, POSE.stand, b * b * (3 - 2 * b));
      R.position.y = K.hipY - 0.04 + (b <= 0 ? Math.sin(a * Math.PI) * 0.12 : 0);
      R.position.z -= (1 - Math.min(1, S.t * 2)) * 1.4 * dt;
      return;
    }
    if (S.state === "celebrate") {
      // 카메라 쪽으로 달려 나오며 양팔 벌림
      if (S.t < 0.18) {
        blendPose(K, POSE.stand, POSE.kickFollow, 1 - S.t / 0.18);
        return;
      }
      if (this.turn.type === "shoot" || S.t > 0) {
        R.rotation.y += (0.32 - R.rotation.y) * Math.min(1, dt * 6);
        const sp = 3.8;
        R.position.z += Math.cos(R.rotation.y) * sp * dt;
        R.position.x += Math.sin(R.rotation.y) * sp * dt;
        S.phase += dt * 11;
        runPose(K, S.phase, 0.82, true);
        R.position.y = K.hipY - 0.03 + Math.abs(Math.sin(S.phase)) * 0.06;
      }
      return;
    }
    if (S.state === "sad") {
      blendPose(K, POSE.stand, POSE.handsHead, Math.min(1, S.t * 3));
      R.position.y = lerp(R.position.y, K.hipY - 0.01, Math.min(1, dt * 4));
    }
  }
  strikeBall() {
    const t = this.turn;
    if (t.type === "shoot") {
      const p = this.pending;
      this.launch(p.x, p.y, p.speed, p.curve);
      this.aiKeeperPlan();
      this.hintShots += 1;
    } else {
      const plan = t.plan;
      // 일찍 몸을 날리면 반대쪽으로 찰 수 있음
      if (t.dove && t.diveAt < this.time - 0.2 && Math.random() < 0.34 + this.lv * 0.05) {
        plan.tx = -Math.sign(t.diveX || 1) * (1.6 + Math.random() * 1.7);
      }
      this.launch(plan.tx, plan.ty, plan.speed, plan.curve);
      // 낮은 단계에선 공이 올 곳을 잠깐 알려 줌
      if (this.lv < 3) this.flashTarget(plan.tx, plan.ty, 0);
      else if (this.lv < 6) this.flashTarget(plan.tx, plan.ty, 0.14);
    }
  }
  flashTarget(x, y, delay) {
    this.flashAt = this.time + delay;
    this.flashPos = { x: clamp(x, -GOAL.hw, GOAL.hw), y: clamp(y, 0.1, GOAL.h) };
  }

  /* ---------- 입력 ---------- */
  bindInput() {
    const cv = $("game");
    cv.addEventListener("pointerdown", (e) => this.onDown(e));
    addEventListener("pointermove", (e) => this.onMove(e));
    addEventListener("pointerup", (e) => this.onUp(e));
    addEventListener("pointercancel", () => this.cancelDrag());
    document.querySelectorAll("#keep-pad button").forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.sfx.unlock();
        btn.classList.add("on");
        this.keeperGo(Number(btn.dataset.x), Number(btn.dataset.y));
      });
    });
    $("start-btn").addEventListener("click", () => {
      if (window.TodayGameRank) window.TodayGameRank.reset();
      this.score = this.save.score;
      this.startMatch(this.save.lv);
    });
    $("restart-btn").addEventListener("click", () => {
      if (window.TodayGameRank) window.TodayGameRank.reset();
      this.save.lv = 0;
      this.save.score = 0;
      this.persist();
      this.renderTitle();
      this.score = 0;
      this.startMatch(0);
    });
    $("win-btn").addEventListener("click", () => {
      if (window.TodayGameRank) window.TodayGameRank.reset();
      if (this.wonAll) this.score = 0;
      this.startMatch(this.save.lv);
    });
    $("lose-btn").addEventListener("click", () => {
      if (window.TodayGameRank) window.TodayGameRank.reset();
      this.score = this.scoreAtStart;
      this.startMatch(this.lv);
    });
    $("skip").addEventListener("click", () => this.skip());
    const KEY = { KeyQ: [-2.5, 1.8], KeyW: [0, 1.9], KeyE: [2.5, 1.8], KeyA: [-2.5, 0.55], KeyS: [0, 0.6], KeyD: [2.5, 0.55], ArrowLeft: [-2.5, 1], ArrowRight: [2.5, 1], ArrowUp: [0, 1.9], ArrowDown: [0, 0.6] };
    addEventListener("keydown", (e) => {
      if (e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
      if (this.state === "keepWait" || this.state === "keepRun" || this.state === "keepFlight") {
        const k = KEY[e.code];
        if (k) {
          e.preventDefault();
          this.keeperGo(k[0], k[1]);
        }
      } else if (this.state === "aim" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        // 키보드: 조금 빗겨 낮게 찬다
        this.fireAt((Math.random() - 0.5) * 5.4, 0.5 + Math.random() * 1.4, 25, 0);
      } else if (this.state === "result" && e.code === "Space") {
        this.skip();
      }
    });
  }
  skip() {
    if (this.state === "result" && this.turn && this.turn.resT > 0.5) this.turn.resT = 99;
    if (this.state === "intro") this.introT = 99;
  }
  onDown(e) {
    this.sfx.unlock();
    this.sfx.crowdOn();
    if (this.state === "intro" || this.state === "result") {
      this.skip();
      return;
    }
    if (this.state === "keepWait" || this.state === "keepRun" || this.state === "keepFlight") {
      const g = this.screenToGoal(e.clientX, e.clientY);
      this.keeperGo(g.x, g.y);
      return;
    }
    if (this.state !== "aim") return;
    if (e.cancelable) e.preventDefault();
    this.state = "charge";
    this.drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }], tx: 0, ty: 0.9, curve: 0 };
    $("hint").textContent = "손을 떼면 슛!";
    $("finger").classList.add("hidden");
    this.startRun();
    this.updateAim();
  }
  onMove(e) {
    if (this.state !== "charge" || !this.drag) return;
    const d = this.drag;
    d.x = e.clientX;
    d.y = e.clientY;
    d.pts.push({ x: d.x, y: d.y, t: performance.now() });
    if (d.pts.length > 60) d.pts.shift();
    this.updateAim();
  }
  updateAim() {
    const d = this.drag;
    const W = this.E.canvas.clientWidth;
    const H = this.E.canvas.clientHeight;
    const dx = d.x - d.x0;
    const dy = d.y - d.y0;
    d.tx = (dx / (W * 0.32)) * GOAL.hw;
    d.ty = 0.32 + ((-dy) / (H * 0.3)) * GOAL.h;
    // 휘어 민 정도
    const n = d.pts.length;
    const len = Math.hypot(dx, dy);
    let bulge = 0;
    if (len > H * 0.06) {
      const ux = dx / len;
      const uy = dy / len;
      let best = 0;
      for (let i = 0; i < n; i += 1) {
        const px = d.pts[i].x - d.x0;
        const py = d.pts[i].y - d.y0;
        const side = px * -uy + py * ux; // 진행 방향 기준 왼쪽 + (화면 좌표)
        if (Math.abs(side) > Math.abs(best)) best = side;
      }
      bulge = best / len;
    }
    d.curve = clamp(bulge * 3.2, -1, 1);
    if (Math.abs(d.curve) < 0.2) d.curve = 0;
    const inGoal = Math.abs(d.tx) < GOAL.hw - 0.1 && d.ty < GOAL.h - 0.1 && d.ty > 0;
    const edge = Math.abs(d.tx) > GOAL.hw - 0.75 || d.ty > GOAL.h - 0.55;
    const color = !inGoal ? 0xff5a4e : edge ? 0xffd34e : 0xffffff;
    this.ring.material.color.set(color).multiplyScalar(1.7);
    const rx = clamp(d.tx, -GOAL.hw - 2.2, GOAL.hw + 2.2);
    const ry = clamp(d.ty, 0.08, GOAL.h + 1.8);
    this.ring.position.set(rx, ry, 0.03);
    this.ringDot.position.set(rx, ry, 0.03);
    this.ring.visible = true;
    this.ringDot.visible = true;
    // 예상 궤적
    if (len > 12) {
      const s = this.solveShot(clamp(d.tx, -7, 7), clamp(d.ty, 0.1, 5), 25, d.curve);
      const pts = [];
      this.simToLine(s.vx, s.vy, s.vz, s.ax, pts);
      this.arc.set(pts, inGoal ? [1.8, 1.8, 1.4] : [1.8, 0.7, 0.6]);
    }
    $("curve-tag").classList.toggle("hidden", !d.curve);
  }
  onUp() {
    if (this.state !== "charge" || !this.drag) return;
    const d = this.drag;
    const H = this.E.canvas.clientHeight;
    const dx = d.x - d.x0;
    const dy = d.y - d.y0;
    if (Math.hypot(dx, dy) < H * 0.035) {
      this.cancelDrag();
      return;
    }
    // 마지막 0.09초의 손 빠르기 = 슛 세기
    const now = performance.now();
    const pts = d.pts;
    let i = pts.length - 1;
    while (i > 0 && now - pts[i].t < 90) i -= 1;
    const a = pts[i];
    const dtMs = Math.max(16, now - a.t);
    const flick = Math.hypot(d.x - a.x, d.y - a.y) / dtMs / H; // 화면 높이 / ms
    const pw = clamp((flick - 0.0006) / 0.0028, 0, 1);
    this.fireAt(d.tx, d.ty, lerp(23, 31, pw), d.curve);
  }
  /** 조준이 끝나고 슛 예약 (도움닫기가 끝나면 찬다) */
  fireAt(tx, ty, speed, curve) {
    const scatter = 0.05 + 0.2 * ((speed - 23) / 8) ** 2 + (Math.abs(tx) > 2.7 ? 0.06 : 0);
    const nx = tx + (Math.random() - 0.5) * 2 * scatter;
    const ny = ty + (Math.random() - 0.5) * 2 * scatter * 0.7;
    this.pending = { x: clamp(nx, -9, 9), y: clamp(ny, 0.08, 6), speed, curve };
    this.state = "strike";
    if (this.kick.state === "idle") this.startRun();
    this.kick.release = true;
    this.drag = null;
    this.ring.visible = false;
    this.ringDot.visible = false;
    this.arc.clear();
    $("hint").classList.add("hidden");
    $("finger").classList.add("hidden");
    $("curve-tag").classList.add("hidden");
  }
  cancelDrag() {
    if (this.state !== "charge") return;
    this.drag = null;
    this.state = "aim";
    this.ring.visible = false;
    this.ringDot.visible = false;
    this.arc.clear();
    this.resetField("korea");
    $("hint").textContent = "짧게 눌렀어요. 위로 쭉 밀었다가 떼 보세요!";
    $("curve-tag").classList.add("hidden");
  }
  /** 화면 좌표 → 골 면 좌표 */
  screenToGoal(cx, cy) {
    const rect = this.E.canvas.getBoundingClientRect();
    const v = new THREE.Vector3(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1, 0.5);
    const cam = this.E.camera;
    v.unproject(cam);
    v.sub(cam.position).normalize();
    const t = -cam.position.z / v.z;
    const p = cam.position.clone().addScaledVector(v, t);
    return { x: clamp(p.x, -GOAL.hw + 0.2, GOAL.hw - 0.2), y: clamp(p.y, 0.2, GOAL.h - 0.1) };
  }
  keeperGo(x, y) {
    if (this.state !== "keepWait" && this.state !== "keepRun" && this.state !== "keepFlight") return;
    const t = this.turn;
    if (t.dove) return;
    t.dove = true;
    t.diveAt = this.time;
    t.diveX = x;
    let tx = x;
    let ty = y;
    // 같은 쪽을 골랐으면 공 쪽으로 손을 맞춰 줌 (아이도 막을 수 있게)
    const plan = t.plan;
    if (this.shot && Math.sign(Math.round(plan.tx / 1.4)) === Math.sign(Math.round(x / 1.4))) {
      tx = plan.tx;
      ty = plan.ty;
    }
    this.startDive(clamp(tx, -3.5, 3.5), clamp(ty, 0.2, 2.4), lerp(10, 8.1, this.lv / 8));
    $("keep-pad").classList.add("used");
  }

  /* ---------- 카메라 ---------- */
  fitCamera() {
    const cam = this.E.camera;
    const dist = 17.6;
    const want = (2 * Math.atan((GOAL.hw * 1.16) / dist / cam.aspect) * 180) / Math.PI;
    this.baseFov = clamp(want, 34, 66);
    cam.fov = this.baseFov;
    cam.updateProjectionMatrix();
  }
  updateCamera(dt) {
    const S = this.state;
    const b = this.ball;
    const K = this.kicker.root.position;
    const GK = this.keeper.root.position;
    const portrait = this.E.camera.aspect < 1;
    if (S === "title") {
      const a = 0.42 + Math.sin(this.time * 0.1) * 0.3;
      this.camGoal.set(Math.sin(a) * 15, 2.1 + Math.sin(this.time * 0.17) * 0.3, 4 + Math.cos(a) * 14);
      this.lookGoal.set(0, 1.25, 1.6);
      this.camRate = 2;
    } else if (S === "aim" || S === "charge" || S === "strike" || S === "keepWait" || S === "keepRun") {
      // 가로 화면: 낮게 잡아 차는 선수의 온몸과 공, 골대가 함께 보인다
      this.camGoal.set(portrait ? 0 : 0.45, portrait ? 2.5 : 1.75, 17.6);
      this.lookGoal.set(0, portrait ? 2.55 : 0.9, 0);
      this.camRate = 3.2;
    } else if (S === "flight" || S === "keepFlight") {
      // 공을 따라 조금 밀고 들어감
      const z = Math.max(14.8, b.z + 5);
      // 가로 화면은 조금 높게: 찬 선수의 머리가 앞을 가리지 않게
      this.camGoal.set(b.x * 0.16 + 0.3, portrait ? 2.3 : 3, z);
      this.lookGoal.set(b.x * 0.35, 1.4 + b.y * 0.2, Math.min(b.z, 0));
      this.camRate = 2.2;
    } else if (S === "result") {
      const t = this.turn;
      if (t.result === "goal" && t.type === "shoot" && t.resT > 0.72) {
        // 달려오는 선수 앞에서 찍기 (몸 전체가 나오게)
        const yaw = this.kicker.root.rotation.y;
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        const back = portrait ? 6.6 : 4.6;
        this.camGoal.set(K.x + fx * back + 0.5, 1.5, K.z + fz * back);
        // 얼굴이 GOAL 글자에 가리지 않게 선수를 화면 아래쪽으로
        this.lookGoal.set(K.x, portrait ? 1.75 : 1.2, K.z);
        this.camRate = 5.5;
      } else if (t.type === "keep" && (t.touched || t.result === "catch") && t.resT > 0.55) {
        this.camGoal.set(GK.x * 0.65 + 0.6, 1.5, 5.4);
        this.lookGoal.set(GK.x * 0.9, 1, 0.4);
        this.camRate = 2.6;
      } else if (t.result !== "goal" && t.type === "shoot" && t.resT > 0.65) {
        this.camGoal.set(K.x + 1.8, 1.6, K.z - (portrait ? 5.4 : 3.8));
        this.lookGoal.set(K.x, 1.05, K.z);
        this.camRate = 2.4;
      } else {
        const z = Math.max(9, b.z + 6.5);
        this.camGoal.set(b.x * 0.3, 1.9, Math.min(13, z));
        this.lookGoal.set(clamp(b.x, -3.4, 3.4), 1.25, 0);
        this.camRate = 3;
      }
    } else if (S === "intro" || S === "matchEnd") {
      this.camRate = 1.6;
    }
    this.camPos.lerp(this.camGoal, 1 - Math.exp(-dt * this.camRate));
    this.camLook.lerp(this.lookGoal, 1 - Math.exp(-dt * (this.camRate + 2)));
    const cam = this.E.camera;
    cam.position.copy(this.camPos);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
    }
    cam.lookAt(this.camLook);
    this.E.sky.position.copy(cam.position);
    this.shake = Math.max(0, this.shake - dt * 0.5);
  }

  /* ---------- 진행 ---------- */
  update(dtReal) {
    this.time += dtReal;
    if (this.slowT > 0) this.slowT -= dtReal;
    const target = this.slowT > 0 ? 0.26 : 1;
    this.timeScale += (target - this.timeScale) * Math.min(1, dtReal * 12);
    const dt = dtReal * this.timeScale;
    this.stadium.tick(dtReal, this.time);
    this.particles.tick(dt);
    this.net.tick(dt, this.ball);
    const S = this.state;
    if (S === "intro") {
      this.introT += dtReal;
      this.updateKeeper(dt);
      if (this.introT > 2.2) {
        $("banner").classList.remove("show");
        this.sfx.whistle();
        this.beginTurn();
      }
    } else if (S === "aim" || S === "charge" || S === "strike") {
      this.updateKicker(dt);
      this.updateKeeper(dt);
      if (this.turn.kicked) this.state = "flight";
    } else if (S === "keepWait") {
      this.turn.wait -= dt;
      this.updateKicker(dt);
      this.updateKeeper(dt);
      if (this.turn.wait <= 0) {
        this.state = "keepRun";
        this.startRun();
        this.kick.release = false;
      }
    } else if (S === "keepRun") {
      this.updateKicker(dt);
      this.updateKeeper(dt);
      if (this.turn.kicked) this.state = "keepFlight";
    } else if (S === "flight" || S === "keepFlight") {
      this.updateKicker(dt);
      this.updateKeeper(dt);
      this.stepBall(dt);
      this.checkEnd();
      this.checkSlow();
    } else if (S === "result") {
      const t = this.turn;
      t.resT += dtReal;
      this.updateKicker(dt);
      this.updateKeeper(dt);
      if (t.type === "keep" && t.resT > 0.75 && !t.gkDone) {
        t.gkDone = true;
        if (t.result === "goal") this.gkAnim = { state: "downcast", t: 0 };
        else this.gkAnim = { state: "cheer", t: 0 };
      }
      if (t.type === "shoot" && t.resT > 0.9 && !t.gkDone) {
        t.gkDone = true;
        if (t.result === "goal") this.gkAnim = { state: "downcast", t: 0 };
        else if (t.touched) this.gkAnim = { state: "cheer", t: 0 };
      }
      this.stepBall(dt);
      if (t.resT > t.dur) {
        $("shout").classList.remove("show");
        this.afterResult();
      }
    } else if (S === "title" || S === "matchEnd") {
      this.updateKicker(dt);
      this.updateKeeper(dt);
    }
    // 공이 올 곳 깜빡임
    if (this.flashPos && this.time >= this.flashAt) {
      const live = this.time - this.flashAt < 0.5 && !this.turn.done;
      this.ring.visible = live;
      this.ringDot.visible = live;
      if (live) {
        this.ring.material.color.set(0xffd34e).multiplyScalar(1.7);
        this.ring.position.set(this.flashPos.x, this.flashPos.y, 0.03);
        this.ringDot.position.set(this.flashPos.x, this.flashPos.y, 0.03);
        const k = 1 + Math.sin(this.time * 24) * 0.16;
        this.ring.scale.set(k, k, 1);
      } else {
        this.flashPos = null;
        this.ring.scale.set(1, 1, 1);
      }
    }
    this.flagTick();
    this.updateCamera(dtReal);
  }
  flagTick() {
    // 조준 고리는 카메라를 봄
    if (this.ring.visible) {
      this.ring.quaternion.copy(this.E.camera.quaternion);
      this.ringDot.quaternion.copy(this.E.camera.quaternion);
    }
  }
  checkSlow() {
    const b = this.ball;
    const t = this.turn;
    if (t.slowDone || b.z > 2.3) return;
    t.slowDone = true;
    const near = Math.hypot(b.x - this.keeper.root.position.x, b.y - this.keeper.root.position.y) < 2.1;
    if ((near && this.dive) || Math.abs(this.shot.tx) > 2.9) this.slowT = Math.max(this.slowT, 0.34);
  }
  checkEnd() {
    const t = this.turn;
    if (t.done) return;
    const b = this.ball;
    if (t.touched && (b.t - t.touchT > 0.9 || (b.z > 1 && b.vz > 0.5))) {
      this.resolve("saved");
      return;
    }
    if (t.posted && (b.t - t.postT > 0.8 || b.vz > 1)) {
      this.resolve("post");
      return;
    }
    if (b.t > 3) this.resolve(t.touched ? "saved" : "wide");
  }
  frame(now) {
    requestAnimationFrame(this.frame);
    const dt = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.fpsAcc = (this.fpsAcc || 0) + dt;
    this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc > 1) {
      this.fps = this.fpsN / this.fpsAcc;
      if (this.fps < 27) {
        this.slowSec = (this.slowSec || 0) + 1;
        const E = this.E;
        if (this.slowSec >= 2 && (E.scale || 1) > 0.56) {
          E.scale = (E.scale || 1) * 0.82;
          E.resize();
          this.slowSec = 0;
        }
      } else this.slowSec = 0;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    if (!this.paused) {
      this.update(dt);
      this.E.tick(dt);
    }
    this.E.render();
  }
}

/* 다이빙 때 몸 자세 */
const DIVE_BODY = { spine: [0, 0, 0], chest: [0, 0, 0], armL: [-2.6, 0, 0.3], armR: [-2.6, 0, -0.3], foreL: [-0.1, 0, 0], foreR: [-0.1, 0, 0], legL: [-0.15, 0, 0.14], legR: [0.25, 0, -0.1], shinL: [0.5, 0, 0], shinR: [0.2, 0, 0], footL: [0.3, 0, 0], footR: [0.3, 0, 0], neck: [-0.15, 0, 0], head: [-0.1, 0, 0] };
const SCOOP = { spine: [0.75, 0, 0], chest: [0.2, 0, 0], armL: [-1, 0, 0.2], armR: [-1, 0, -0.2], foreL: [-0.2, 0, 0], foreR: [-0.2, 0, 0], legL: [-1, 0, 0.3], legR: [-1, 0, -0.3], shinL: [1.5, 0, 0], shinR: [1.5, 0, 0], footL: [-0.5, 0, 0], footR: [-0.5, 0, 0], neck: [-0.4, 0, 0], head: [-0.2, 0, 0] };
const TMP = new THREE.Vector3();

export function startApp({ progress }) {
  progress(0.4, "잔디를 깎는 중…");
  const game = new Game($("game"), pickQuality());
  progress(0.8, "관중이 입장하는 중…");
  if (window.TodayFace && window.TodayFace.mountChip) {
    const old = document.querySelector(".today-face-chip");
    const s = $("start-btn");
    if (old) s.parentNode.insertBefore(old, s);
    else window.TodayFace.mountChip(s.parentNode, s);
    if (window.TodayFace.onChange) {
      window.TodayFace.onChange(() => {
        const side = game.turn && game.turn.type === "keep" ? "them" : "korea";
        game.kicker.setFace(side === "korea");
        game.keeper.setFace(side === "them");
      });
    }
  }
  if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: "penalty-kick", gameTitle: "승부차기 히어로", formParent: $("lose-rank") });
  if (window.TodayPause) {
    const canPause = () => ["aim", "charge", "strike", "flight", "keepWait", "keepRun", "keepFlight", "result"].includes(game.state);
    window.TodayPause.mount({
      canPause,
      isPaused: () => game.paused,
      pause() {
        if (!canPause()) return false;
        game.paused = true;
        return true;
      },
      resume() {
        game.paused = false;
        game.last = performance.now();
        return true;
      },
    });
  }
  game.update(0.016);
  game.camPos.copy(game.camGoal);
  requestAnimationFrame(game.frame);
  window.PenaltyHero = game;
  progress(1);
}
