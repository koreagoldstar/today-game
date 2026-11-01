/*
 * 홀인원 골프 — 게임 진행
 *  티샷 전 코스 비행 → 조준 → 3번 탭 스윙(시작 · 힘 · 임팩트) → 공 비행 카메라 → 다음 샷 → 홀아웃 → 스코어카드
 */
import { THREE, clamp, lerp, std, canvas } from "../../oneshot-elite/js/kit.js";
import { Engine, ATMOS } from "../../oneshot-elite/js/engine.js";
import { setTexQuality } from "../../oneshot-elite/js/textures.js";
import { HOLES, buildHole } from "./course.js";
import { CLUBS, GROUND, PUTT_RANGES, BALL_R, calibrateClubs, launchBall, puttBall, previewFlight, advance, runToRest, flightStep } from "./golf.js";
import { makeGolfer } from "./golfer.js";
import { Tufts, Particles, Trail, LandMark, ArcDots, PuttGrid } from "./props.js";
import { GolfSfx } from "./sfx.js";

const $ = (id) => document.getElementById(id);

/* 시간대: 벌판이 밝게 보이도록 안개는 옅게 */
ATMOS.gMorning = { top: "#2f77cc", hor: "#e8e3d4", low: "#9aa08a", sun: "#ffe7c6", sunI: 2.9, sunEl: 27, sunAz: 128, hemiSky: "#d9e6f6", hemiGround: "#6f7d4c", hemiI: 0.5, env: 0.55, fog: "#d8dfdc", fogD: 0.00085, exp: 1, clouds: 0.46, cloudDark: 0.22, mtn: "#7f97ad", grade: "cine" };
ATMOS.gDay = { top: "#2672cf", hor: "#d3e4f0", low: "#9aa98e", sun: "#fff3e2", sunI: 3.1, sunEl: 48, sunAz: -128, hemiSky: "#d6e5f6", hemiGround: "#6d7c4c", hemiI: 0.55, env: 0.5, fog: "#cfe0ec", fogD: 0.0008, exp: 1, clouds: 0.52, cloudDark: 0.3, mtn: "#7d9ab5", grade: "cine" };
ATMOS.gGolden = { top: "#3a62a6", hor: "#f6c08a", low: "#8f7a58", sun: "#ffc98c", sunI: 3.1, sunEl: 19, sunAz: -118, hemiSky: "#f0dcc6", hemiGround: "#6a6340", hemiI: 0.5, env: 0.6, fog: "#e6bd98", fogD: 0.001, exp: 1.02, clouds: 0.5, cloudDark: 0.35, mtn: "#7c7a90", grade: "warm" };
const ATMOS_KEY = { morning: "gMorning", day: "gDay", golden: "gGolden" };

const SAVE_KEY = "minigolf-round-v1";
const LEVELS = { am: { name: "아마추어", wind: 0.6, err: 0.62, perfect: 0.034, ret: 1, limit: 10 }, pro: { name: "프로", wind: 1, err: 1, perfect: 0.02, ret: 1.28, limit: 12, bonus: 1.2 } };
const MODES = { 18: { name: "18홀", list: HOLES.map((_, i) => i) }, front: { name: "전반 9홀", list: HOLES.slice(0, 9).map((_, i) => i) }, back: { name: "후반 9홀", list: HOLES.slice(9).map((_, i) => i + 9) } };
const SLOP = 0.12; // 임팩트 선을 지나 더 갈 수 있는 길이 (힘 1 = 게이지 전체)
const IMPACT = 11; // 게이지에서 임팩트 선 위치 (%)
const IN_PLAY = new Set(["aim", "power", "impact", "swing", "fly", "after", "intro"]);

const scoreName = (s, par) => {
  if (s === 1) return "홀인원";
  const d = s - par;
  return { "-4": "콘도르", "-3": "알바트로스", "-2": "이글", "-1": "버디", 0: "파", 1: "보기", 2: "더블 보기", 3: "트리플 보기" }[d] ?? `${d > 0 ? "+" : ""}${d}`;
};
const scorePoints = (s, par) => {
  if (s === 1) return 1500;
  const d = s - par;
  return d <= -3 ? 1200 : d === -2 ? 900 : d === -1 ? 600 : d === 0 ? 400 : d === 1 ? 250 : d === 2 ? 120 : 50;
};
const toParText = (n) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

function pickQuality() {
  const q = new URLSearchParams(location.search).get("q");
  if (q === "high" || q === "mid" || q === "low") return q;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (coarse) return cores >= 6 && mem >= 4 ? "mid" : "low";
  return mem >= 6 && cores >= 6 ? "high" : "mid";
}

class Golf {
  constructor(canvasEl, quality) {
    this.quality = quality;
    const E = new Engine(canvasEl, { quality });
    this.E = E;
    E.vmVisible = false;
    E.camera.fov = 52;
    E.camera.far = 6000;
    this.state = "title";
    this.paused = false;
    this.level = "am";
    this.round = null;
    this.hole = null;
    this.grid = null;
    this.time = 0;
    this.wind = { x: 0, z: 0, speed: 0 };
    this.yaw = 0;
    this.clubList = CLUBS.filter((c) => !c.putter).map((c) => ({ club: c, range: 0 })).concat([...PUTT_RANGES].reverse().map((r) => ({ club: CLUBS[CLUBS.length - 1], range: r })));
    this.sel = 3;
    this.pos = new THREE.Vector3();
    this.camPos = new THREE.Vector3(0, 10, 30);
    this.camLook = new THREE.Vector3();
    this.camGoal = new THREE.Vector3();
    this.lookGoal = new THREE.Vector3();
    this.landing = null;
    this.overview = false;
    this.gauge = 0;
    this.power = 0;
    this.plan = null;
    this.flying = null;
    this.lastLand = null;
    this.rand = Math.random;
    this.sfx = new GolfSfx();
    this.tutLeft = 5;
    this.buildScene();
    this.bindInput();
    this.save = this.loadSave();
    this.renderTitle();
    E.resize();
    this.onResize = () => E.resize();
    addEventListener("resize", this.onResize);
    if (window.visualViewport) visualViewport.addEventListener("resize", this.onResize);
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    if (window.TodayFace && window.TodayFace.onChange) window.TodayFace.onChange(() => this.golfer.refreshFace());
  }

  buildScene() {
    const { scene } = this.E;
    this.golfer = makeGolfer();
    this.golfer.root.visible = false;
    scene.add(this.golfer.root);
    this.golfer.refreshFace();
    // 공 · 티 · 공 그림자
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 20, 14), std({ color: 0xffffff, roughness: 0.35, emissive: 0x888888, emissiveIntensity: 0.5 }));
    ball.castShadow = true;
    ball.visible = false;
    scene.add(ball);
    this.ball = ball;
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.008, 0.1, 8), std({ color: 0xf0cf3e, roughness: 0.5 }));
    peg.visible = false;
    scene.add(peg);
    this.peg = peg;
    const c = canvas(64, 64);
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(0,0,0,0.75)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const blobTex = new THREE.CanvasTexture(c);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.visible = false;
    scene.add(blob);
    this.blob = blob;
    this.tufts = new Tufts(scene, this.quality === "high" ? 2400 : this.quality === "mid" ? 1200 : 0);
    this.particles = new Particles(scene);
    this.trail = new Trail(scene);
    this.mark = new LandMark(scene);
    this.arc = new ArcDots(scene);
  }

  /* ---------- 저장 ---------- */
  loadSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      if (d.level === "pro") this.level = "pro";
      return { level: this.level, best: d.best || {}, round: d.round || null, shots: d.shots || 0 };
    } catch (_) {
      return { level: this.level, best: {}, round: null, shots: 0 };
    }
  }
  persist() {
    try {
      this.save.level = this.level;
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch (_) {
      /* 저장 공간이 막혀 있어도 게임은 계속 */
    }
  }

  /* ---------- 첫 화면 ---------- */
  renderTitle() {
    const R = this.save.round;
    const cont = $("btn-continue");
    if (R && R.i < R.list.length) {
      cont.hidden = false;
      const played = R.scores.reduce((a, s) => a + s.strokes, 0);
      const par = R.scores.reduce((a, s) => a + s.par, 0);
      $("continue-note").textContent = `${MODES[R.mode].name} · ${HOLES[R.list[R.i]].n}번 홀부터 (${R.scores.length ? toParText(played - par) : "E"})`;
    } else cont.hidden = true;
    const b = this.save.best[18];
    $("title-best").textContent = b ? `18홀 최고 ${b.strokes}타 (${toParText(b.toPar)})` : "PAR 72 · 6,246m";
    for (const el of document.querySelectorAll("[data-level]")) el.classList.toggle("on", el.dataset.level === this.level);
    $("level-note").textContent = this.level === "pro" ? "바람이 세고 임팩트가 어려워요 · 점수 1.2배" : "바람이 약하고 빗맞아도 덜 휘어요 · 짧은 퍼트는 컨시드";
  }
  showTitle() {
    this.state = "title";
    this.setScreen("title");
    document.body.classList.add("is-title");
    $("hud").hidden = true;
    $("shot").hidden = true;
    this.renderTitle();
    this.golfer.root.visible = false;
    this.ball.visible = false;
    this.peg.visible = false;
    this.mark.hide();
    this.arc.clear();
    if (!this.hole || this.hole.def.n !== 15) this.loadScenery(14);
  }
  /** 첫 화면 뒤 풍경: 15번 연못 앞 그린 */
  loadScenery(i) {
    this.swapHole(i);
    this.titleT = 0;
  }
  setScreen(id) {
    for (const s of ["title", "card", "result"]) $(s).hidden = s !== id;
  }

  /* ---------- 라운드 ---------- */
  startRound(mode) {
    this.sfx.unlock();
    this.round = { mode, list: MODES[mode].list, i: 0, scores: [], level: this.level, points: 0 };
    this.save.round = this.round;
    this.persist();
    if (window.TodayGameRank) window.TodayGameRank.reset();
    this.loadCurrent();
  }
  continueRound() {
    this.sfx.unlock();
    this.round = this.save.round;
    this.level = this.round.level || this.level;
    if (window.TodayGameRank) window.TodayGameRank.reset();
    this.loadCurrent();
  }
  loadCurrent() {
    const R = this.round;
    const def = HOLES[R.list[R.i]];
    document.body.classList.remove("is-title");
    this.setScreen(null);
    this.state = "load";
    this.showBanner(def, true);
    $("fade").classList.add("on");
    $("hud").hidden = true;
    $("shot").hidden = true;
    setTimeout(() => {
      this.swapHole(R.list[R.i]);
      this.setupHole();
    }, 240);
  }
  swapHole(i) {
    const old = this.hole;
    if (old) {
      this.E.scene.remove(old.root);
      old.dispose();
      this.grid.dispose();
    }
    const def = HOLES[i];
    const hole = buildHole(def, this.quality);
    this.E.scene.add(hole.root);
    this.hole = hole;
    this.grid = new PuttGrid(this.E.scene, hole);
    this.E.setAtmos(ATMOS_KEY[def.time], { shadowCenter: hole.tee, shadowSize: this.quality === "high" ? 130 : 110, seed: def.n * 7 + 3, mountains: true, smoke: [] });
    this.applyGrade();
    this.shadowFocus = null;
    this.buildMini();
  }
  /** 저격 게임과 달리 잔디가 싱싱하게 보이도록 색 보정 */
  applyGrade() {
    const C = this.E.compU;
    if (!C) return;
    C.sat.value = 1.02;
    C.contrast.value = 1.06;
    C.vig.value = 0.26;
    C.grain.value = 0.006;
    C.lift.value.set(0.006, 0.008, 0.012);
  }
  setupHole() {
    const { def } = this.hole;
    const L = LEVELS[this.level];
    const a = Math.random() * Math.PI * 2;
    const speed = (def.wind[0] + Math.random() * (def.wind[1] - def.wind[0])) * L.wind;
    this.wind = { x: Math.sin(a) * speed, z: Math.cos(a) * speed, speed };
    this.strokes = 0;
    this.pos.copy(this.hole.tee);
    this.pos.y = this.hole.tee.y;
    this.lastSpot = this.pos.clone();
    this.onTee = true;
    this.ball.visible = true;
    this.peg.visible = true;
    this.blob.visible = false;
    this.flying = null;
    this.trail.clear();
    this.golfer.root.visible = true;
    this.golfer.refreshFace();
    this.tufts.relocate(this.hole, this.pos.x, this.pos.z);
    this.placeBall();
    this.prepareShot();
    this.updateHud();
    this.sfx.outdoors(this.wind.speed);
    this.startIntro();
    $("fade").classList.remove("on");
  }

  /* ---------- 코스 비행 ---------- */
  startIntro() {
    this.state = "intro";
    this.introT = 0;
    this.introLen = 2.4 + this.hole.length / 170;
    this.showBanner(this.hole.def, true);
    $("skip").hidden = false;
    this.mark.hide();
    this.arc.clear();
  }
  endIntro() {
    if (this.state !== "intro") return;
    $("skip").hidden = true;
    this.showBanner(null);
    $("fade").classList.add("on");
    this.state = "load";
    setTimeout(() => {
      this.beginAim(true);
      $("fade").classList.remove("on");
    }, 200);
  }

  /* ---------- 샷 준비 ---------- */
  surface() {
    if (this.onTee) return "tee";
    return this.hole.surface(this.pos.x, this.pos.z);
  }
  distToPin() {
    return Math.hypot(this.pos.x - this.hole.pin.x, this.pos.z - this.hole.pin.z);
  }
  yawTo(x, z) {
    return Math.atan2(x - this.pos.x, -(z - this.pos.z));
  }
  /** 땅 · 거리에 맞는 채 고르기 */
  pickClub() {
    const d = this.distToPin();
    const surf = this.surface();
    const list = this.clubList;
    const puttIndex = () => {
      const want = d * 1.18;
      const r = PUTT_RANGES.find((x) => x >= want) || PUTT_RANGES[PUTT_RANGES.length - 1];
      return list.findIndex((o) => o.range === r);
    };
    if (surf === "green" || (surf === "fringe" && d < 16) || d < 3) return puttIndex();
    const lie = GROUND[surf].lie;
    let found = -1;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const o = list[i];
      if (o.club.putter) continue;
      if (o.club.id === "DR" && !this.onTee) continue;
      if (o.club.carry * lie >= d * 0.97) {
        found = i;
        break;
      }
    }
    if (found < 0) found = this.onTee ? 0 : 1;
    if (surf === "sand" && d < 60) found = list.findIndex((o) => o.club.id === "SW");
    return found;
  }
  defaultYaw() {
    const { hole } = this;
    const { club } = this.clubList[this.sel];
    const d = this.distToPin();
    if (club.putter) return this.yawTo(hole.pin.x, hole.pin.z);
    const reach = club.carry * GROUND[this.surface()].lie * 1.06;
    if (d <= reach) return this.yawTo(hole.pin.x, hole.pin.z);
    const from = hole.locate(this.pos.x, this.pos.z).t;
    for (let t = 1; t > from; t -= 0.01) {
      const q = hole.atT(t);
      if (Math.hypot(q.x - this.pos.x, q.z - this.pos.z) <= reach) return this.yawTo(q.x, q.z);
    }
    return this.yawTo(hole.pin.x, hole.pin.z);
  }
  prepareShot() {
    this.sel = this.pickClub();
    this.yaw = this.defaultYaw();
    this.golfer.setClub(this.clubList[this.sel].club);
    this.placeGolfer();
    this.refreshPreview();
  }
  beginAim(snap = false) {
    this.state = "aim";
    this.trail.clear();
    this.overview = false;
    this.power = 0;
    this.gauge = 0;
    this.prepareShot();
    this.golfer.setSwing(0, 0);
    this.swingPose = { theta: 0, phi: 0 };
    this.updateHud();
    this.updateGauge();
    this.setHint();
    $("hud").hidden = false;
    $("shot").hidden = false;
    $("shot").classList.remove("locked");
    this.setSwingLabel();
    this.grid.show(this.clubList[this.sel].club.putter === true);
    this.aimCamera();
    if (snap) {
      this.camPos.copy(this.camGoal);
      this.camLook.copy(this.lookGoal);
    }
    this.dirtyMini = true;
  }
  placeBall() {
    const { pos } = this;
    const lift = this.onTee ? 0.05 : 0;
    this.ball.position.set(pos.x, pos.y + BALL_R + lift, pos.z);
    this.peg.position.set(pos.x, pos.y + 0.02, pos.z);
    this.peg.visible = this.onTee;
  }
  placeGolfer() {
    const { pos, yaw } = this;
    this.golfer.place(pos.x, Math.min(pos.y, this.hole.height(pos.x - Math.cos(yaw) * 0.8, pos.z - Math.sin(yaw) * 0.8)), pos.z, yaw);
  }
  changeClub(delta) {
    if (this.state !== "aim") return;
    const n = this.clubList.length;
    this.sel = (this.sel + delta + n) % n;
    const { club } = this.clubList[this.sel];
    this.golfer.setClub(club);
    this.golfer.setSwing(0, 0);
    this.placeGolfer();
    this.grid.show(club.putter === true);
    this.yaw = this.defaultYaw();
    this.placeGolfer();
    this.sfx.ui();
    this.refreshPreview();
    this.updateHud();
    this.dirtyMini = true;
  }
  resetAim() {
    if (this.state !== "aim") return;
    this.yaw = this.yawTo(this.hole.pin.x, this.hole.pin.z);
    this.placeGolfer();
    this.refreshPreview();
    this.sfx.ui();
    this.dirtyMini = true;
  }
  toggleOverview() {
    if (this.state !== "aim") return;
    this.overview = !this.overview;
    $("view-btn").classList.toggle("on", this.overview);
    this.sfx.ui();
  }

  /** 낙하 지점 · 궤적 · 게이지의 핀 표시를 새로 계산 */
  refreshPreview(power = 1) {
    const { hole, pos, yaw } = this;
    const { club, range } = this.clubList[this.sel];
    const surf = this.surface();
    if (club.putter) {
      const d = this.distToPin();
      const up = hole.pin.y - pos.y;
      this.pinPower = clamp((d + (up * 8) / GROUND.green.roll) / range, 0.02, 1.3);
      const p = this.state === "power" || this.state === "impact" ? power : Math.min(1, this.pinPower);
      const pts = [];
      const b = puttBall(pos.x, pos.y, pos.z, yaw, range, p, 0, GROUND[surf].roll);
      let guard = 0;
      while (b.mode !== "rest" && guard < 720 && pts.length < 400) {
        advance(b, hole, null, 1 / 24, this.rand);
        pts.push(b.x, b.y + 0.05, b.z);
        guard += 1;
      }
      this.arc.set(pts, [1.8, 1.8, 1.4], this.level === "pro" ? 0.3 : 0.62);
      this.landing = { x: b.x, y: b.y, z: b.z, surf: "green" };
      this.mark.hide();
      this.landDist = Math.hypot(b.x - pos.x, b.z - pos.z);
      return;
    }
    const lie = GROUND[surf].lie * (club.id === "SW" && surf === "sand" ? 1.35 : 1);
    this.lieK = lie;
    const pts = [];
    const b = launchBall(pos.x, pos.y + (this.onTee ? 0.05 : 0), pos.z, yaw, club, power, lie, 0, 0);
    const land = previewFlight(hole, b, null, pts);
    this.arc.set(pts, [1.7, 1.7, 1.6]);
    const ls = hole.surface(land.x, land.z);
    this.landing = { ...land, surf: ls };
    const color = ls === "water" || ls === "ob" ? 0xff5a4e : ls === "sand" ? 0xffd34e : ls === "green" ? 0x9dff72 : 0xffffff;
    this.mark.set(land.x, land.y, land.z, 2.2 + club.carry * 0.018 * GROUND[surf].err, color);
    this.landDist = Math.hypot(land.x - pos.x, land.z - pos.z);
    // 핀까지 필요한 힘 (바람 없을 때)
    const d = this.distToPin();
    let lo = 0.02;
    let hi = 1.3;
    for (let i = 0; i < 12; i += 1) {
      const m = (lo + hi) / 2;
      const t = launchBall(pos.x, pos.y, pos.z, yaw, club, m, lie, 0, 0);
      const q = previewFlight(hole, t, null);
      if (Math.hypot(q.x - pos.x, q.z - pos.z) < d) lo = m;
      else hi = m;
    }
    this.pinPower = (lo + hi) / 2;
  }

  /* ---------- 스윙 ---------- */
  tap() {
    if (this.paused) return;
    const { state } = this;
    if (state === "intro") {
      this.endIntro();
      return;
    }
    if (state === "aim") {
      this.sfx.unlock();
      this.overview = false;
      $("view-btn").classList.remove("on");
      this.state = "power";
      this.gauge = 0;
      this.hold = 0;
      this.sfx.gauge();
      this.setHint();
      $("shot").classList.add("locked");
      this.setSwingLabel();
      return;
    }
    if (state === "power") {
      this.setPower();
      return;
    }
    if (state === "impact") {
      this.strike(this.gauge);
    }
  }
  setPower() {
    this.power = clamp(this.gauge, 0.02, 1);
    this.state = "impact";
    const L = LEVELS[this.level];
    this.returnRate = (this.power + SLOP) / ((0.42 + 0.46 * this.power) / L.ret);
    this.sfx.gauge();
    this.setHint();
    this.setSwingLabel();
    this.updateGauge();
  }
  /** at: 임팩트 때 눈금 위치 (0 이 정타 · + 는 이름 · - 는 늦음) */
  strike(at) {
    const L = LEVELS[this.level];
    const { club } = this.clubList[this.sel];
    const surf = this.surface();
    const perfect = Math.abs(at) <= L.perfect;
    let e = perfect ? 0 : clamp(at / SLOP, -1.4, 1.4);
    // 빗맞음은 끝으로 갈수록 크게
    e = Math.sign(e) * Math.abs(e) ** 1.3;
    const err = GROUND[surf].err * L.err;
    const shortK = club.putter ? 0.4 : 1;
    const late = e < 0;
    this.plan = {
      power: perfect ? Math.min(1.03, this.power * 1.02) : this.power * (1 - Math.abs(e) * 0.1),
      e,
      perfect,
      pushDeg: club.putter ? -e * 2.6 * L.err : -e * 4.2 * err,
      side: club.putter ? 0 : -e * 0.0009 * err,
      word: perfect ? "PERFECT" : Math.abs(e) < 0.28 ? "NICE" : club.putter ? (late ? "오른쪽으로 밀림" : "왼쪽으로 당김") : late ? "슬라이스" : "훅",
    };
    void shortK;
    this.state = "swing";
    this.swingT = 0;
    this.swingFrom = { ...this.swingPose };
    this.sfx.whoosh(this.power);
    this.flashWord(this.plan.word, perfect ? "perfect" : Math.abs(e) < 0.28 ? "nice" : "bad");
    if (perfect) this.sfx.perfect();
    this.setHint();
    this.updateGauge();
  }
  launch() {
    const { hole, pos, yaw, plan } = this;
    const { club, range } = this.clubList[this.sel];
    const surf = this.surface();
    this.strokes += 1;
    this.save.shots = (this.save.shots || 0) + 1;
    this.lastSpot = pos.clone();
    let b;
    if (club.putter) {
      b = puttBall(pos.x, pos.y, pos.z, yaw, range, plan.power, plan.pushDeg, GROUND[surf].roll);
    } else {
      const lie = this.lieK;
      b = launchBall(pos.x, pos.y + (this.onTee ? 0.05 : 0), pos.z, yaw, club, plan.power, lie, plan.pushDeg, plan.side);
      if (surf === "sand") this.particles.burst(pos.x, pos.y + 0.1, pos.z, 44, "#efe2b8", 2.6, 4.2, 0.9);
      else if (!this.onTee) this.particles.burst(pos.x, pos.y + 0.05, pos.z, 16, "#5e8f3e", 2.4, 3.6, 0.7);
    }
    this.sfx.strike(club, plan.power, plan.perfect);
    this.onTee = false;
    this.peg.visible = false;
    this.flying = b;
    this.startPos = pos.clone();
    this.flyDir = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    this.flyT = 0;
    this.event = { tree: false };
    this.trail.clear();
    this.mark.hide();
    this.arc.clear();
    this.grid.show(false);
    this.state = "fly";
    $("shot").hidden = true;
    this.lastLand = null;
    this.landed = false;
    this.updateHud();
    void hole;
  }

  ballEvent(name, v) {
    const b = this.flying;
    if (!b) return;
    if (name === "land") {
      this.landed = true;
      this.lastLand = b.firstHit;
      if (v === "sand") {
        this.sfx.land("sand", 3);
        this.particles.burst(b.x, b.y, b.z, 40, "#efe2b8", 2.2, 3.6, 0.9);
      } else if (v === "water") {
        this.sfx.splash();
        this.particles.burst(b.x, this.hole.waters[0] ? b.y : b.y, b.z, 70, "#d9eefa", 2.6, 8, 1.1);
      } else {
        this.sfx.land(v, 3);
        this.particles.burst(b.x, b.y, b.z, 8, v === "green" ? "#a2dc7e" : "#7aa858", 1.2, 2, 0.5);
      }
    } else if (name === "bounce") {
      this.sfx.land(v.surf, v.v);
    } else if (name === "pole") {
      this.sfx.pole();
      this.flashWord("깃대에 맞았어요!", "nice");
    } else if (name === "lip") {
      this.sfx.lip();
    }
  }

  finishShot() {
    const b = this.flying;
    const { hole, pos, round } = this;
    this.flying = null;
    const carried = Math.hypot(b.x - this.startPos.x, b.z - this.startPos.z);
    pos.set(b.x, hole.height(b.x, b.z), b.z);
    const limit = LEVELS[this.level].limit;
    if (b.result === "holed") {
      pos.copy(hole.pin);
      this.onHoled();
      return;
    }
    let delay = 1.25;
    if (b.result === "water") {
      this.strokes += 1;
      this.sfx.sad();
      const p = this.dropFromWater(b.x, b.z);
      pos.copy(p);
      this.toast(`물에 빠졌어요 · 1벌타`, "bad");
      delay = 1.8;
    } else if (b.result === "ob") {
      this.strokes += 1;
      this.sfx.sad();
      pos.copy(this.lastSpot);
      this.toast(`OB · 1벌타, 친 자리에서 다시`, "bad");
      delay = 1.8;
    } else {
      const surf = hole.surface(b.x, b.z);
      const left = Math.round(this.distToPin() * 10) / 10;
      if (b.tree && surf !== "green") this.toast(`나무에 맞았어요 · 남은 거리 ${Math.round(left)}m`, "bad");
      else if (surf === "green") this.toast(`그린 온! 남은 거리 ${left.toFixed(1)}m`, "good");
      else if (surf === "sand") this.toast(`벙커 · 남은 거리 ${Math.round(left)}m`, "bad");
      else if (surf === "fairway") this.toast(`페어웨이 · ${Math.round(carried)}m`, "good");
      else this.toast(`${GROUND[surf].name} · 남은 거리 ${Math.round(left)}m`, "");
      if (left < 0.65 && this.level === "am" && this.strokes < limit) {
        // 아주 짧은 퍼트는 컨시드
        this.strokes += 1;
        this.toast("컨시드! 한 타로 칩니다", "good");
        pos.copy(hole.pin);
        this.state = "after";
        this.afterT = 0.7;
        this.afterFn = () => this.onHoled();
        this.placeBall();
        return;
      }
    }
    if (this.strokes >= limit) {
      this.state = "after";
      this.afterT = 1.5;
      this.toast(`이번 홀은 여기까지 · ${limit}타`, "bad");
      this.afterFn = () => this.endHole();
      this.updateHud();
      return;
    }
    this.placeBall();
    this.state = "after";
    this.afterT = delay;
    this.afterFn = () => {
      this.ball.visible = true;
      this.tufts.relocate(hole, pos.x, pos.z);
      this.beginAim();
    };
    this.updateHud();
    void round;
  }
  /** 친 자리에서 공이 간 쪽으로 가다 처음 물을 만나는 곳, 그 앞에 드롭 (섬 그린으로 넘어가는 꼼수 막음) */
  dropFromWater(x, z) {
    const { hole, lastSpot } = this;
    const dx = x - lastSpot.x;
    const dz = z - lastSpot.z;
    const len = Math.hypot(dx, dz) || 1;
    for (let d = 2; d <= len; d += 2) {
      if (hole.surface(lastSpot.x + (dx / len) * d, lastSpot.z + (dz / len) * d) !== "water") continue;
      const back = Math.max(0, d - 6);
      const qx = lastSpot.x + (dx / len) * back;
      const qz = lastSpot.z + (dz / len) * back;
      return new THREE.Vector3(qx, hole.height(qx, qz), qz);
    }
    return lastSpot.clone();
  }

  /* ---------- 홀아웃 ---------- */
  onHoled() {
    const { hole } = this;
    const s = this.strokes;
    const d = s - hole.def.par;
    this.state = "holed";
    this.holedT = 0;
    this.mark.hide();
    this.arc.clear();
    this.grid.show(false);
    this.ball.visible = false;
    this.blob.visible = false;
    this.sfx.cup();
    const k = s === 1 ? 1 : d <= -2 ? 0.95 : d === -1 ? 0.7 : d === 0 ? 0.35 : 0.14;
    setTimeout(() => {
      this.sfx.cheer(k);
      if (d <= -1) this.sfx.fanfare(k);
    }, 350);
    if (d <= -1) {
      const col = ["#ffd34e", "#ff5a4e", "#6ad7ff", "#ffffff", "#9dff72"];
      for (let i = 0; i < 5; i += 1) this.particles.burst(hole.pin.x, hole.pin.y + 0.4, hole.pin.z, s === 1 ? 44 : 24, col[i], 3.2, 8.5, 1.8, 0.6);
    }
    this.showResultWord(scoreName(s, hole.def.par), d);
    this.updateHud();
    $("shot").hidden = true;
  }
  endHole() {
    const R = this.round;
    const { def } = this.hole;
    const pts = scorePoints(this.strokes, def.par);
    const K = LEVELS[this.level].bonus || 1;
    const got = Math.round(pts * K);
    R.scores.push({ n: def.n, par: def.par, strokes: this.strokes, pts: got });
    R.points += got;
    R.i += 1;
    this.save.round = R.i < R.list.length ? R : null;
    this.persist();
    this.hideResultWord();
    this.showCard();
  }
  showCard() {
    const R = this.round;
    const last = R.scores[R.scores.length - 1];
    const done = R.i >= R.list.length;
    this.state = "card";
    $("hud").hidden = true;
    this.setScreen("card");
    $("card-title").textContent = `${last.n}번 홀 · ${scoreName(last.strokes, last.par)}`;
    $("card-sub").textContent = `${last.strokes}타 (파 ${last.par}) · +${last.pts}점`;
    this.renderCardTable($("card-table"));
    $("btn-next").textContent = done ? "최종 결과 보기" : `${HOLES[R.list[R.i]].n}번 홀로`;
  }
  renderCardTable(host) {
    const R = this.round;
    const byN = new Map(R.scores.map((s) => [s.n, s]));
    const block = (from, label) => {
      const holes = HOLES.slice(from, from + 9);
      const cells = (fn) => holes.map(fn).join("");
      const cls = (h) => {
        const s = byN.get(h.n);
        if (!s) return "";
        const d = s.strokes - h.par;
        return s.strokes === 1 ? "ace" : d <= -2 ? "eagle" : d === -1 ? "birdie" : d === 0 ? "par" : d === 1 ? "bogey" : "dbl";
      };
      const sumPar = holes.reduce((a, h) => a + h.par, 0);
      const mine = holes.map((h) => byN.get(h.n)).filter(Boolean);
      const sum = mine.reduce((a, s) => a + s.strokes, 0);
      return `<table class="sc"><tr class="r-no"><th>홀</th>${cells((h) => `<td>${h.n}</td>`)}<th>${label}</th></tr><tr class="r-par"><th>파</th>${cells((h) => `<td>${h.par}</td>`)}<th>${sumPar}</th></tr><tr class="r-me"><th>나</th>${cells((h) => `<td class="${cls(h)}"><span>${byN.get(h.n) ? byN.get(h.n).strokes : ""}</span></td>`)}<th>${mine.length ? sum : ""}</th></tr></table>`;
    };
    const total = R.scores.reduce((a, s) => a + s.strokes, 0);
    const par = R.scores.reduce((a, s) => a + s.par, 0);
    host.innerHTML = `${block(0, "OUT")}${block(9, "IN")}<p class="sc-total"><span>합계</span><b>${total}타</b><em>${toParText(total - par)}</em><span class="sc-pts">${R.points.toLocaleString("ko-KR")}점</span></p>`;
  }
  nextFromCard() {
    this.sfx.ui();
    const R = this.round;
    if (R.i < R.list.length) this.loadCurrent();
    else this.showResult();
  }
  showResult() {
    const R = this.round;
    const total = R.scores.reduce((a, s) => a + s.strokes, 0);
    const par = R.scores.reduce((a, s) => a + s.par, 0);
    this.state = "result";
    this.setScreen("result");
    document.body.classList.add("is-title");
    const key = R.mode;
    const prev = this.save.best[key];
    const isBest = !prev || total < prev.strokes;
    if (isBest) this.save.best[key] = { strokes: total, toPar: total - par };
    this.save.round = null;
    this.persist();
    const counts = { ace: 0, eagle: 0, birdie: 0, par: 0, over: 0 };
    for (const s of R.scores) {
      const d = s.strokes - s.par;
      if (s.strokes === 1) counts.ace += 1;
      else if (d <= -2) counts.eagle += 1;
      else if (d === -1) counts.birdie += 1;
      else if (d === 0) counts.par += 1;
      else counts.over += 1;
    }
    $("res-mode").textContent = `${MODES[key].name} · ${LEVELS[R.level].name}`;
    $("res-total").textContent = `${total}타`;
    $("res-par").textContent = toParText(total - par);
    $("res-best").hidden = !isBest;
    $("res-points").textContent = `${R.points.toLocaleString("ko-KR")}점`;
    $("res-stats").innerHTML = [counts.ace ? `홀인원 ${counts.ace}` : "", counts.eagle ? `이글 ${counts.eagle}` : "", `버디 ${counts.birdie}`, `파 ${counts.par}`, `보기 이상 ${counts.over}`].filter(Boolean).map((t) => `<span>${t}</span>`).join("");
    this.renderCardTable($("res-table"));
    if (window.TodayGameRank) window.TodayGameRank.open(R.points, { label: `${MODES[key].name} ${total}타 (${toParText(total - par)})` });
    this.sfx.fanfare(0.6);
  }

  /* ---------- HUD ---------- */
  updateHud() {
    if (!this.hole) return;
    const { def } = this.hole;
    const R = this.round;
    $("h-no").textContent = def.n;
    $("h-par").textContent = def.par;
    $("h-len").textContent = `${Math.round(this.hole.length)}m`;
    $("h-stroke").textContent = this.state === "fly" || this.state === "holed" ? `${this.strokes}타` : `${this.strokes + 1}타째`;
    if (R) {
      const done = R.scores.reduce((a, s) => a + s.strokes - s.par, 0);
      $("h-total").textContent = toParText(done);
    }
    const { club, range } = this.clubList[this.sel];
    $("club-short").textContent = club.short;
    $("club-name").textContent = club.name;
    $("club-carry").textContent = club.putter ? `${range}m` : `${Math.round(club.carry * (this.lieK || 1))}m`;
    const surf = this.surface();
    $("lie-name").textContent = GROUND[surf].name;
    const k = GROUND[surf].lie;
    $("lie-pow").textContent = club.putter || k === 1 ? "" : `힘 ${Math.round(k * 100)}%`;
    $("wind-speed").textContent = this.wind.speed.toFixed(1);
  }
  setHint() {
    const el = $("g-hint");
    const left = this.tutLeft > 0;
    if (this.state === "aim") {
      el.textContent = left ? "화면을 좌우로 밀어 방향을 정하고 스윙을 누르세요" : "";
    } else if (this.state === "power") {
      el.textContent = this.pinPower <= 1 ? "깃발 표시까지 차오르면 한 번 더 누르세요" : "원하는 힘에서 한 번 더 누르세요";
    } else if (this.state === "impact") {
      el.textContent = "돌아오는 눈금이 흰 선에 닿을 때 누르세요";
    } else el.textContent = "";
    el.hidden = !el.textContent;
    if (this.state === "impact") this.tutLeft -= 1;
  }
  setSwingLabel() {
    $("swing").textContent = this.state === "aim" ? "스윙" : this.state === "power" ? "힘 멈춤" : this.state === "impact" ? "임팩트" : "스윙";
    $("swing").className = `swing-btn s-${this.state}`;
  }
  updateGauge() {
    const span = 100 - IMPACT;
    const p = this.state === "power" || this.state === "impact" ? this.gauge : 0;
    const x = IMPACT + p * span;
    $("g-mark").style.left = `${x}%`;
    const powerShown = this.state === "power" ? p : this.power;
    $("g-fill").style.width = `${Math.max(0, powerShown) * span}%`;
    const pin = this.pinPower;
    const pinEl = $("g-pin");
    if (pin > 0 && pin <= 1.02 && this.state !== "fly") {
      pinEl.hidden = false;
      pinEl.style.left = `${IMPACT + Math.min(1, pin) * span}%`;
    } else pinEl.hidden = true;
    $("g-text").textContent = this.state === "power" || (this.state === "impact" && this.power) || this.state === "swing" ? `${Math.round(powerShown * 100)}%` : "";
  }
  toast(text, kind) {
    const el = $("toast");
    el.textContent = text;
    el.className = `toast show ${kind || ""}`;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => el.classList.remove("show"), 2300);
  }
  flashWord(text, kind) {
    const el = $("word");
    el.textContent = text;
    el.className = `word ${kind}`;
    void el.offsetWidth;
    el.classList.add("show");
  }
  showResultWord(text, d) {
    const el = $("score-word");
    el.querySelector("b").textContent = text;
    el.querySelector("small").textContent = `${this.strokes}타 · 파 ${this.hole.def.par}`;
    el.className = `score-word show ${this.strokes === 1 ? "ace" : d <= -2 ? "eagle" : d === -1 ? "birdie" : d === 0 ? "par" : "over"}`;
    el.hidden = false;
  }
  hideResultWord() {
    $("score-word").hidden = true;
  }
  showBanner(def, on = false) {
    const el = $("banner");
    if (!def || !on) {
      el.classList.remove("show");
      return;
    }
    const len = this.hole && this.hole.def === def ? `${Math.round(this.hole.length)}m` : "";
    el.querySelector(".b-no").textContent = `HOLE ${def.n}`;
    el.querySelector(".b-par").textContent = `PAR ${def.par}${len ? ` · ${len}` : ""}`;
    el.querySelector(".b-name").textContent = def.name;
    el.classList.add("show");
  }

  /* ---------- 미니맵 ---------- */
  buildMini() {
    const { hole } = this;
    const { bbox, mapCanvas } = hole;
    const crop = 46;
    const vw = bbox.Bw - crop * 2;
    const vh = bbox.Bh - crop * 2;
    const boxW = 78;
    const boxH = 186;
    const k = Math.min(boxW / vw, boxH / vh);
    const W = Math.round(vw * k);
    const H = Math.round(vh * k);
    const dpr = 2;
    const off = canvas(W * dpr, H * dpr);
    const sc = mapCanvas.width / bbox.Bw;
    off.getContext("2d").drawImage(mapCanvas, crop * sc, crop * sc, vw * sc, vh * sc, 0, 0, W * dpr, H * dpr);
    this.mini = { off, k: k * dpr, crop, W: W * dpr, H: H * dpr };
    const el = $("mini");
    el.width = W * dpr;
    el.height = H * dpr;
    el.style.width = `${W}px`;
    el.style.height = `${H}px`;
    this.dirtyMini = true;
  }
  drawMini() {
    if (!this.mini || !this.hole) return;
    const { off, k, crop, W, H } = this.mini;
    const { bbox, pin } = this.hole;
    const g = $("mini").getContext("2d");
    const X = (x) => (x - bbox.minX - crop) * k;
    const Y = (z) => (z - bbox.minZ - crop) * k;
    g.clearRect(0, 0, W, H);
    g.drawImage(off, 0, 0);
    const b = this.flying || this.pos;
    if (this.landing && this.state !== "fly" && this.state !== "after") {
      g.strokeStyle = "rgba(255,255,255,.85)";
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.beginPath();
      g.moveTo(X(this.pos.x), Y(this.pos.z));
      g.lineTo(X(this.landing.x), Y(this.landing.z));
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.arc(X(this.landing.x), Y(this.landing.z), 5, 0, Math.PI * 2);
      g.stroke();
    }
    // 핀
    const px = X(pin.x);
    const py = Y(pin.z);
    g.fillStyle = "#fff";
    g.fillRect(px - 1, py - 14, 2, 14);
    g.fillStyle = "#e5352e";
    g.beginPath();
    g.moveTo(px + 1, py - 14);
    g.lineTo(px + 11, py - 10);
    g.lineTo(px + 1, py - 6);
    g.fill();
    // 공
    g.fillStyle = "#fff";
    g.strokeStyle = "#111";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(X(b.x), Y(b.z), 4.6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  /* ---------- 입력 ---------- */
  bindInput() {
    const stage = $("stage");
    const cv = $("game");
    let drag = null;
    cv.addEventListener("pointerdown", (e) => {
      this.sfx.unlock();
      if (this.state === "aim") {
        drag = { x: e.clientX, id: e.pointerId };
        try {
          cv.setPointerCapture(e.pointerId);
        } catch (_) {
          /* 무시 */
        }
      } else this.tap();
    });
    cv.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id || this.state !== "aim") return;
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      const { club } = this.clubList[this.sel];
      const sens = this.overview ? 0.0016 : club.putter ? 0.0014 : 0.0024;
      this.yaw += dx * sens;
      this.placeGolfer();
      this.previewDirty = true;
      this.dirtyMini = true;
    });
    const end = () => {
      drag = null;
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    $("swing").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.tap();
    });
    // 화면 어디를 눌러도 스윙 단계는 진행 (단추 빼고)
    stage.addEventListener("pointerdown", (e) => {
      if ((this.state === "power" || this.state === "impact") && !e.target.closest("button, a") && e.target !== cv) this.tap();
    });
    $("club-prev").addEventListener("click", () => this.changeClub(-1));
    $("club-next").addEventListener("click", () => this.changeClub(1));
    $("view-btn").addEventListener("click", () => this.toggleOverview());
    $("aim-btn").addEventListener("click", () => this.resetAim());
    $("card-btn").addEventListener("click", () => this.peekCard());
    $("skip").addEventListener("click", () => this.endIntro());
    $("btn-next").addEventListener("click", () => this.nextFromCard());
    $("btn-card-close").addEventListener("click", () => this.closePeek());
    $("btn-18").addEventListener("click", () => this.startRound(18));
    $("btn-front").addEventListener("click", () => this.startRound("front"));
    $("btn-back").addEventListener("click", () => this.startRound("back"));
    $("btn-continue").addEventListener("click", () => this.continueRound());
    $("btn-again").addEventListener("click", () => this.startRound(this.round.mode));
    $("btn-home").addEventListener("click", () => this.showTitle());
    for (const el of document.querySelectorAll("[data-level]")) {
      el.addEventListener("click", () => {
        this.level = el.dataset.level;
        this.sfx.unlock();
        this.sfx.ui();
        this.persist();
        this.renderTitle();
      });
    }
    this.keys = {};
    addEventListener("keydown", (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      this.keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Enter") {
        if (IN_PLAY.has(this.state)) {
          e.preventDefault();
          this.tap();
        }
      } else if (e.code === "ArrowUp") this.changeClub(-1);
      else if (e.code === "ArrowDown") this.changeClub(1);
      else if (e.code === "KeyV") this.toggleOverview();
      else if (e.code === "KeyP") this.resetAim();
    });
    addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
  }
  peekCard() {
    if (this.state !== "aim") return;
    this.state = "peek";
    this.setScreen("card");
    this.renderCardTable($("card-table"));
    $("card-title").textContent = "스코어카드";
    $("card-sub").textContent = `${this.hole.def.n}번 홀 진행 중 · ${this.strokes}타`;
    $("btn-next").hidden = true;
    $("btn-card-close").hidden = false;
  }
  closePeek() {
    this.setScreen(null);
    $("btn-next").hidden = false;
    $("btn-card-close").hidden = true;
    this.state = "aim";
  }

  /* ---------- 카메라 ---------- */
  aimCamera() {
    const { hole, pos, yaw } = this;
    const { club } = this.clubList[this.sel];
    const fx = Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const d = this.distToPin();
    if (this.overview && this.landing) {
      const mx = (pos.x + this.landing.x) / 2;
      const mz = (pos.z + this.landing.z) / 2;
      const span = Math.hypot(this.landing.x - pos.x, this.landing.z - pos.z);
      const aspect = this.E.camera.aspect;
      const up = Math.max(30, (span * 0.95) / Math.min(1, aspect + 0.2));
      this.camGoal.set(mx - fx * up * 0.35, hole.height(mx, mz) + up, mz - fz * up * 0.35);
      this.lookGoal.set(mx, hole.height(mx, mz), mz);
      return;
    }
    let back;
    let up;
    let ahead;
    let lift;
    if (club.putter) {
      back = 4.4 + Math.min(d * 0.14, 2.6);
      up = 1.75 + Math.min(d * 0.08, 1.6);
      ahead = Math.min(d * 0.72, 7);
      lift = -0.75;
    } else {
      back = 7.4;
      up = 2.5;
      ahead = 42;
      lift = -3.2;
    }
    // 나무 속으로 카메라가 들어가지 않도록 가까이 당김
    let bk = back;
    for (let i = 0; i < 5; i += 1) {
      const cx = pos.x - fx * bk;
      const cz = pos.z - fz * bk;
      if (!hole.trees.some((t) => Math.hypot(t.x - cx, t.z - cz) < t.r * 1.15)) break;
      bk *= 0.74;
    }
    // 골퍼가 왼쪽에 서므로 카메라도 왼쪽으로 조금
    const side = club.putter ? 0.3 : 0.42;
    const cx = pos.x - fx * bk + fz * side;
    const cz = pos.z - fz * bk - fx * side;
    const cy = Math.max(pos.y + up, hole.height(cx, cz) + 1);
    this.camGoal.set(cx, cy, cz);
    const ax = pos.x + fx * ahead;
    const az = pos.z + fz * ahead;
    const ty = club.putter ? pos.y + lift : lerp(pos.y, hole.height(ax, az), 0.5) + lift;
    this.lookGoal.set(ax, ty, az);
  }
  flyCamera(dt) {
    const b = this.flying;
    const { hole } = this;
    if (!b) return;
    const sp = Math.hypot(b.vx, b.vz);
    let dx = this.flyDir.x;
    let dz = this.flyDir.z;
    if (sp > 1) {
      const k = 1 - Math.exp(-dt * 1.3);
      dx = lerp(dx, b.vx / sp, k);
      dz = lerp(dz, b.vz / sp, k);
      const l = Math.hypot(dx, dz) || 1;
      this.flyDir.x = dx / l;
      this.flyDir.z = dz / l;
    }
    const putt = this.clubList[this.sel].club.putter;
    const back = putt ? 2.8 : this.landed ? 7 : 8 + sp * 0.22;
    const up = putt ? 1.15 : this.landed ? 2.4 : 2.6 + sp * 0.03;
    const gx = b.x - this.flyDir.x * back;
    const gz = b.z - this.flyDir.z * back;
    const gy = Math.max(b.y + up, hole.height(gx, gz) + 1.2);
    this.camGoal.set(gx, gy, gz);
    this.lookGoal.set(b.x, b.y + 0.2, b.z);
  }
  applyCamera(dt, posRate = 3.4, lookRate = 7) {
    const cam = this.E.camera;
    this.camPos.lerp(this.camGoal, 1 - Math.exp(-dt * posRate));
    this.camLook.lerp(this.lookGoal, 1 - Math.exp(-dt * lookRate));
    if (this.hole) {
      const min = this.hole.height(this.camPos.x, this.camPos.z) + 0.8;
      if (this.camPos.y < min) this.camPos.y = min;
    }
    cam.position.copy(this.camPos);
    cam.lookAt(this.camLook);
    this.E.sky.position.copy(cam.position);
  }

  /* ---------- 표지 ---------- */
  placeLabel(el, x, y, z, on) {
    if (!on) {
      el.hidden = true;
      return;
    }
    const v = this.tmpV || (this.tmpV = new THREE.Vector3());
    v.set(x, y, z).project(this.E.camera);
    if (v.z > 1) {
      el.hidden = true;
      return;
    }
    const w = this.E.canvas.clientWidth;
    const h = this.E.canvas.clientHeight;
    el.hidden = false;
    el.style.transform = `translate(${clamp((v.x * 0.5 + 0.5) * w, 30, w - 30)}px, ${clamp((-v.y * 0.5 + 0.5) * h, 90, h - 30)}px)`;
  }
  updateLabels() {
    const on = this.state === "aim" || this.state === "power" || this.state === "impact";
    const { hole } = this;
    if (!hole) return;
    const d = this.distToPin();
    $("m-pin-d").textContent = d < 10 ? `${d.toFixed(1)}m` : `${Math.round(d)}m`;
    this.placeLabel($("m-pin"), hole.pin.x, hole.pin.y + 2.6, hole.pin.z, on);
    if (this.landing && !this.clubList[this.sel].club.putter) {
      $("m-land").textContent = `${Math.round(this.landDist)}m`;
      this.placeLabel($("m-land"), this.landing.x, this.landing.y + 0.6, this.landing.z, on);
    } else $("m-land").hidden = true;
    // 바람 화살표 (화면 위쪽 = 내가 보는 방향)
    const cam = this.E.camera;
    const dir = this.camDir || (this.camDir = new THREE.Vector3());
    cam.getWorldDirection(dir);
    const heading = Math.atan2(dir.x, -dir.z);
    const windTo = Math.atan2(this.wind.x, -this.wind.z);
    $("wind-arrow").style.transform = `rotate(${windTo - heading}rad)`;
  }

  /* ---------- 한 프레임 ---------- */
  frame(now) {
    requestAnimationFrame(this.frame);
    const raw = clamp((now - this.last) / 1000, 0, 0.05);
    this.last = now;
    this.autoRes(raw);
    if (this.paused) {
      this.E.render();
      return;
    }
    this.update(raw);
    this.E.tick(raw);
    this.E.render();
  }
  autoRes(raw) {
    this.fpsAcc = (this.fpsAcc || 0) + raw;
    this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsAcc <= 1) return;
    this.fps = this.fpsN / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsN = 0;
    if (this.fps < 27) {
      this.slowSec = (this.slowSec || 0) + 1;
      const E = this.E;
      if (this.slowSec >= 2 && (E.scale || 1) > 0.56) {
        E.scale = (E.scale || 1) * 0.82;
        E.resize();
        this.slowSec = 0;
      }
    } else this.slowSec = 0;
  }
  update(dt) {
    this.time += dt;
    const { hole, state } = this;
    if (!hole) return;
    hole.waveFlag(this.time, this.wind.speed);
    hole.tickWater(this.time);
    hole.flag.rotation.y = Math.atan2(-this.wind.z, this.wind.x);
    this.tufts.tick(this.time);
    this.particles.tick(dt);
    this.grid.tick(this.time);

    if (state === "title") {
      this.titleT = (this.titleT || 0) + dt;
      const a = Math.sin(this.titleT * 0.07) * 0.3;
      const { pin } = hole;
      this.camPos.set(pin.x + Math.sin(a) * 72, pin.y + 13 + Math.sin(this.titleT * 0.13) * 1.2, pin.z + Math.cos(a) * 72);
      this.camGoal.copy(this.camPos);
      this.camLook.set(pin.x, pin.y + 9, pin.z);
      this.lookGoal.copy(this.camLook);
      this.applyCamera(1);
    } else if (state === "intro") {
      this.introT += dt;
      const u = clamp(this.introT / this.introLen, 0, 1);
      const eased = u * u * (3 - 2 * u);
      const q = hole.atT(Math.max(0, eased * 0.95));
      const q2 = hole.atT(Math.min(1, eased * 0.95 + 0.14));
      const alt = 26 + hole.length * 0.02;
      const gx = q.x - q.dx * 8;
      const gz = q.z - q.dz * 8;
      this.camGoal.set(gx, hole.height(gx, gz) + alt * (1 - eased * 0.45), gz);
      this.lookGoal.set(q2.x, hole.height(q2.x, q2.z) + 1, q2.z);
      if (this.introT < 0.02) {
        this.camPos.copy(this.camGoal);
        this.camLook.copy(this.lookGoal);
      }
      this.applyCamera(dt, 5, 3.6);
      if (u >= 1) this.endIntro();
    } else if (state === "aim") {
      const k = this.keys;
      const rate = (k.ShiftLeft || k.ShiftRight ? 0.08 : 0.32) * (this.clubList[this.sel].club.putter ? 0.5 : 1);
      if (k.ArrowLeft || k.KeyA) {
        this.yaw -= rate * dt;
        this.previewDirty = true;
      }
      if (k.ArrowRight || k.KeyD) {
        this.yaw += rate * dt;
        this.previewDirty = true;
      }
      if (this.previewDirty) {
        this.previewDirty = false;
        this.placeGolfer();
        this.refreshPreview();
        this.dirtyMini = true;
      }
      this.updateGauge();
      this.aimCamera();
      this.applyCamera(dt, this.overview ? 2.6 : 5, 7);
    } else if (state === "power") {
      this.gauge += dt / 1.05;
      if (this.gauge >= 1) {
        this.gauge = 1;
        this.hold += dt;
        if (this.hold > 0.14) this.setPower();
      }
      this.poseBack(this.gauge);
      this.refreshPreview(Math.max(0.02, this.gauge));
      this.dirtyMini = true;
      this.updateGauge();
      this.aimCamera();
      this.applyCamera(dt, 5, 7);
    } else if (state === "impact") {
      this.gauge -= dt * this.returnRate;
      if (this.gauge < -SLOP) this.strike(-SLOP * 1.05);
      this.updateGauge();
      this.applyCamera(dt, 5, 7);
    } else if (state === "swing") {
      this.swingT += dt;
      const dur = this.clubList[this.sel].club.putter ? 0.26 : 0.14;
      const u = clamp(this.swingT / dur, 0, 1);
      const e = u * u * u;
      this.golfer.setSwing(this.swingFrom.theta * (1 - e), this.swingFrom.phi * (1 - e));
      if (u >= 1) {
        this.swingPose = { theta: 0, phi: 0 };
        this.followT = 0;
        this.launch();
      }
      this.updateGauge();
      this.applyCamera(dt, 5, 7);
    } else if (state === "fly") {
      this.updateFly(dt);
    } else if (state === "after") {
      this.followPose(dt);
      this.afterT -= dt;
      if (this.flying) this.updateFly(dt);
      this.applyCamera(dt, 2.4, 5);
      if (this.afterT <= 0) {
        const fn = this.afterFn;
        this.afterFn = null;
        fn();
      }
    } else if (state === "holed") {
      this.holedT += dt;
      const { pin } = hole;
      const a = this.time * 0.25;
      this.camGoal.set(pin.x + Math.sin(a) * 4.2, pin.y + 1.6, pin.z + Math.cos(a) * 4.2);
      this.lookGoal.set(pin.x, pin.y + 0.5, pin.z);
      this.applyCamera(dt, 2.2, 4);
      if (this.holedT > 2.5) this.endHole();
    } else if (state === "card" || state === "peek" || state === "result" || state === "load") {
      this.applyCamera(dt);
    }

    // 공 크기 (멀어져도 보이도록) · 공 그림자
    const camD = this.E.camera.position.distanceTo(this.ball.position);
    this.ball.scale.setScalar(Math.max(1, camD * 0.038));
    this.mark.tick(dt, camD);
    if (this.flying) {
      const b = this.flying;
      const gy = hole.height(b.x, b.z);
      const alt = b.y - gy;
      this.blob.visible = alt > 0.2;
      if (this.blob.visible) {
        this.blob.position.set(b.x, gy + 0.08, b.z);
        const s = 0.5 + Math.max(1, camD * 0.038) * 0.32;
        this.blob.scale.set(s, s, 1);
        this.blob.material.opacity = clamp(1 - alt / 70, 0.2, 0.9);
      }
    } else this.blob.visible = false;

    // 그림자 범위를 공 쪽으로 (스냅해서 그림자가 떨리지 않게)
    const fx = this.flying ? this.flying.x : this.pos.x;
    const fz = this.flying ? this.flying.z : this.pos.z;
    const snap = 12;
    const sx = Math.round(fx / snap) * snap;
    const sz = Math.round(fz / snap) * snap;
    if (!this.shadowFocus || this.shadowFocus.x !== sx || this.shadowFocus.z !== sz) {
      this.shadowFocus = { x: sx, z: sz };
      const E = this.E;
      E.sun.target.position.set(sx, hole.height(sx, sz), sz);
      E.sun.position.copy(E.sun.target.position).addScaledVector(E.sunDir, 700);
    }
    this.updateLabels();
    if (this.dirtyMini || state === "fly") {
      this.dirtyMini = false;
      this.drawMini();
    }
  }
  poseBack(p) {
    const { club } = this.clubList[this.sel];
    const k = Math.max(0, p);
    const theta = club.putter ? -0.42 * k : -2.15 * k ** 0.8;
    const phi = club.putter ? 0 : -1.5 * k ** 0.7;
    this.swingPose = { theta, phi };
    this.golfer.setSwing(theta, phi);
  }
  followPose(dt) {
    if (this.followT == null || this.followT >= 1) return;
    this.followT = Math.min(1, this.followT + dt / (this.lastPutt ? 0.3 : 0.48));
    const u = 1 - (1 - this.followT) ** 3;
    const { club } = this.clubList[this.sel];
    const k = club.putter ? 0.5 * Math.min(1, this.power + 0.2) : 2.5 * (0.45 + 0.55 * this.power);
    this.golfer.setSwing(k * u, club.putter ? 0 : 1.35 * u * (0.5 + 0.5 * this.power));
  }
  updateFly(dt) {
    const b = this.flying;
    const { hole } = this;
    if (!b) return;
    this.followPose(dt);
    this.flyT += dt;
    const before = b.mode;
    advance(b, hole, { x: this.wind.x, z: this.wind.z }, dt * (before === "fly" ? 1.18 : 1), this.rand, (n, v) => this.ballEvent(n, v));
    if (b.leaf && !this.leafHit) {
      this.leafHit = true;
      this.sfx.leaves();
      this.particles.burst(b.x, b.y, b.z, 24, "#4d7a33", 2, 2, 1.1, 0.5);
    }
    this.ball.position.set(b.x, b.y, b.z);
    this.ball.visible = true;
    this.trail.push(b.x, b.y, b.z);
    this.trail.update(this.E.camera.position);
    this.flyCamera(dt);
    const rate = this.landed ? 2.2 : 3.6;
    this.applyCamera(dt, rate, 9);
    if (b.mode === "rest") {
      this.leafHit = false;
      this.finishShot();
    }
  }

  /* ---------- 일시정지 ---------- */
  mountPause() {
    if (!window.TodayPause) return;
    window.TodayPause.mount({
      canPause: () => IN_PLAY.has(this.state) && this.state !== "intro",
      isPaused: () => this.paused,
      pause: () => {
        if (!IN_PLAY.has(this.state)) return false;
        this.paused = true;
        return true;
      },
      resume: () => {
        if (!this.paused) return false;
        this.paused = false;
        this.last = performance.now();
        return true;
      },
    });
  }
}

export function startApp({ progress }) {
  calibrateClubs();
  progress(0.3, "코스를 깎는 중…");
  const quality = pickQuality();
  setTexQuality(quality);
  const game = new Golf($("game"), quality);
  progress(0.7, "깃발을 꽂는 중…");
  game.loadScenery(14);
  game.camPos.set(0, 40, 0);
  if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: "minigolf", gameTitle: "홀인원 골프", formParent: $("rank-slot") });
  game.mountPause();
  // 공용 '내 얼굴' 버튼은 메뉴 맨 위에 (자동으로 달면 긴 화면 맨 아래로 내려감)
  if (window.TodayFace && window.TodayFace.mountChip) {
    const old = document.querySelector(".today-face-chip");
    const menu = document.querySelector(".t-menu");
    if (old) menu.insertBefore(old, menu.firstChild);
    else window.TodayFace.mountChip(menu, menu.firstChild);
  }
  game.setScreen("title");
  game.update(0.016);
  requestAnimationFrame(game.frame);
  // 점검용
  window.GolfGame = game;
  game.lib = { CLUBS, GROUND, PUTT_RANGES, launchBall, puttBall, runToRest, HOLES, step: (b, dt) => flightStep(b, null, dt) };
  progress(1);
}
