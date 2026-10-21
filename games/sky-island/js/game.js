/*
 * 하늘섬 대탈출 · 게임 진행
 *  상태: loading → title → intro(짧은 연출) → play ⇄ (pause) → respawn(떨어짐 → 체크포인트) → over | clear
 *  게임 루프는 하나만 돈다 (다시 시작해도 requestAnimationFrame 을 새로 만들지 않음).
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { World, Airship } from "./world.js?v=1";
import { Course } from "./course.js?v=1";
import { Hero } from "./hero.js?v=1";
import { Player, PHYS } from "./player.js?v=2";
import { Input } from "./input.js?v=1";
import { FX } from "./fx.js?v=1";
import { SkyAudio, MUSIC } from "./audio.js?v=1";
import { Save } from "./save.js?v=1";
import { UI } from "./ui.js?v=1";
import { STAGES } from "./stages.js?v=1";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* 안내 문구 · 테마 · 음악은 스테이지마다 stages.js 에 있다 */

export class Game {
  constructor({ canvas, field }) {
    this.canvas = canvas;
    this.field = field;
    this.save = new Save();
    const st = this.save.data.settings;
    this.audio = new SkyAudio({ musicVol: st.musicVol, sfxVol: st.sfxVol });
    this.ui = new UI(this);
    this.mobile = matchMedia("(pointer:coarse)").matches;
    this.level = this.qualityLevel();
    // WebGL (없으면 main.js 가 안내 화면을 띄운다)
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) throw new Error("no webgl");
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.level !== "low", powerPreference: "high-performance" });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.08;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
    this.state = "loading";
    this.paused = false;
    this.shake = 0;
    this.t = 0;
    this.last = performance.now();
    this.camPos = V(0, 4, 12);
    this.camLook = V(0, 1, 0);
    this.camDir = V(0, 0, -1);
    this.camY = 0;
    this.pr = {};
    this.tmp = V();
    this.slowT = 0;
    this.frames = 0;
    this.stageIdx = 0;
    this.resize();
    this.init().catch((e) => {
      console.error(e);
      document.getElementById("loading").hidden = true;
      document.getElementById("fallback").hidden = false;
    });
  }
  qualityLevel() {
    const q = this.save.data.settings.quality;
    if (q === "high" || q === "low") return q;
    return this.mobile ? "mid" : "high";
  }
  pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const cap = this.level === "low" ? 1 : this.level === "mid" ? 1.5 : 1.75;
    return Math.min(dpr, cap) * (this.slow || 1);
  }

  /* ================================================================
   * 불러오기 (단계마다 화면에 진행 표시)
   * ============================================================== */
  async init() {
    const ui = this.ui;
    const q = this.level === "low" ? 0.5 : this.level === "mid" ? 0.8 : 1;
    ui.loading(0.08, "하늘을 칠하는 중…");
    await nextFrame();
    this.q = q;
    this.world = new World(this.renderer, this.scene, { quality: q });
    this.world.setTheme(STAGES[0].theme);
    this.world.onThunder = () => {
      if (this.state !== "title") setTimeout(() => this.audio.play("thunder"), 250 + Math.random() * 500);
    };
    this.fx = new FX(this.scene, { quality: q });
    this.fx.setFog(this.scene.fog);
    ui.loading(0.3, "구름 마을을 띄우는 중…");
    await nextFrame();
    this.course = new Course(this.scene, this.world, this.fx, { quality: q, stage: STAGES[0] });
    ui.loading(0.62, "토리가 모자를 쓰는 중…");
    await nextFrame();
    this.hero = new Hero();
    this.scene.add(this.hero.group);
    this.hero.onStep = (v) => {
      if (this.state === "play" && this.player && this.player.onGround) {
        this.audio.play("step", { k: v });
        if (Math.random() < 0.5) this.fx.step(this.hero.pos.x, this.hero.pos.y, this.hero.pos.z);
      }
    };
    this.player = new Player(this.hero, this.course);
    // 발밑 그림자 (점프할 때 어디에 떨어질지 보이게)
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: "#2a1a3a", transparent: true, opacity: 0.3, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 2;
    this.scene.add(this.blob);
    // 마을 옆에 정박한 큰 비행선 (배경 · 움직임)
    this.dock = new Airship(this.world.M, { scale: 1.3, color: "#e6c39a", deck: false });
    this.dock.group.position.set(-17, 5.5, -44);
    this.dock.group.rotation.y = 0.9;
    this.scene.add(this.dock.group);
    this.input = new Input({
      zone: document.getElementById("joy-zone"),
      base: document.getElementById("joy-base"),
      knob: document.getElementById("joy-knob"),
      jump: document.getElementById("btn-jump"),
      dash: document.getElementById("btn-dash"),
    });
    ui.loading(0.8, "빛을 맞추는 중…");
    await nextFrame();
    this.bindKeys();
    this.toTitle(true);
    // 셰이더 미리 준비 (처음 장면에서 멈칫하지 않게)
    this.renderer.compile(this.scene, this.cam);
    ui.loading(1, "준비 끝!");
    await nextFrame();
    this.render();
    ui.hideLoading();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  bindKeys() {
    window.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (this.state === "play" || this.state === "respawn" || this.state === "intro" || this.state === "cine") {
          e.preventDefault();
          this.paused ? this.resume() : this.pause();
        } else if (this.ui.current === "howto" || this.ui.current === "sound" || this.ui.current === "stages") this.ui.show(this.ui.backTo || "title");
      }
      if ((e.key === "Enter" || e.code === "Space") && this.state === "title" && this.ui.current === "title" && !e.repeat) {
        e.preventDefault();
        this.audio.unlock();
        this.continueGame();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && (this.state === "play" || this.state === "respawn") && !this.paused) this.pause();
    });
    window.addEventListener("blur", () => {
      if ((this.state === "play" || this.state === "respawn") && !this.paused) this.pause();
    });
  }
  resize() {
    const w = this.field.clientWidth || window.innerWidth;
    const h = this.field.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.fov = w / h < 0.8 ? 66 : 55;
    this.cam.updateProjectionMatrix();
    this.aspect = w / h;
    this.W = w;
    this.H = h;
    if (this.fx) this.fx.setScale(h * this.renderer.getPixelRatio());
  }
  setSetting(k, v) {
    const s = this.save.data.settings;
    s[k] = v;
    this.save.save();
    if (k === "musicVol" || k === "sfxVol") this.audio.setVolumes(s.musicVol, s.sfxVol);
    if (k === "quality") {
      this.level = this.qualityLevel();
      this.slow = 1;
      this.resize();
      this.ui.toast(v === "low" ? "가볍게: 화면이 조금 덜 선명해요" : v === "high" ? "좋게: 선명하게 그려요" : "자동: 기기에 맞춰요");
    }
  }

  /* ================================================================
   * 타이틀 · 시작 · 다시
   * ============================================================== */
  get def() {
    return STAGES[this.stageIdx];
  }
  stageList() {
    return STAGES;
  }
  /** 이어서 할 스테이지: 아직 못 깬 스테이지 중 가장 앞, 다 깼으면 마지막 */
  continueStageId() {
    const sv = this.save;
    for (let id = 1; id <= sv.unlocked; id++) if (!sv.best(id)) return id;
    return sv.unlocked;
  }
  continueGame() {
    this.startStage(this.continueStageId() - 1);
  }
  /**
   * 스테이지 불러오기: 코스 · 배경 · 테마를 바꾼다 (잠깐 불러오기 카드를 보여 준다)
   */
  async loadStage(i) {
    if (this.course && this.stageIdx === i && !this.stageDirty) return;
    const def = STAGES[i];
    const ld = document.getElementById("loading");
    ld.hidden = false;
    ld.classList.remove("done");
    this.ui.loading(0.2, `스테이지 ${def.id} · ${def.name} 준비 중…`);
    this.loadingStage = true;
    await nextFrame();
    await nextFrame();
    this.course.dispose();
    this.world.clearScenery();
    this.world.setTheme(def.theme);
    this.fx.reset();
    this.fx.setFog(this.scene.fog);
    this.ui.loading(0.55);
    await nextFrame();
    this.stageIdx = i;
    this.course = new Course(this.scene, this.world, this.fx, { quality: this.q, stage: def });
    this.player.course = this.course;
    this.dock.group.visible = i === 0;
    this.stageDirty = false;
    this.ui.loading(0.9);
    await nextFrame();
    this.renderer.compile(this.scene, this.cam);
    this.ui.loading(1);
    this.loadingStage = false;
    this.ui.hideLoading();
  }
  /** 스테이지 고르기 → 바로 시작 */
  async startStage(i) {
    this.paused = false;
    this.ui.show(null);
    this.ui.bossBar(null);
    await this.loadStage(i);
    this.state = "title";
    this.startRun();
  }
  nextStage() {
    if (this.stageIdx + 1 < STAGES.length) this.startStage(this.stageIdx + 1);
  }
  /** 스테이지 선택 화면 (타이틀 위에) */
  async toStages() {
    await this.toTitle();
    this.ui.openPanel("stages", "title");
  }
  async toTitle(first = false) {
    this.paused = false;
    this.ui.bossBar(null);
    if (!first && this.stageIdx !== 0) {
      this.state = "loading";
      this.ui.show(null);
      this.ui.hud(false);
      await this.loadStage(0);
    }
    this.state = "title";
    this.paused = false;
    this.input.setEnabled(false);
    this.ui.hud(false);
    this.ui.prompt(null);
    this.ui.hideBanner();
    this.ui.combo(0);
    this.ui.fade(false);
    if (!first) {
      this.course.resetAll();
      this.fx.reset();
    }
    // 마을 앞 절벽 끝에서 노을 진 하늘섬들을 바라보는 토리
    this.titleSpot = V(-6.7, 0, -7.9);
    this.titleYaw = Math.atan2(-0.62, -0.78);
    this.player.spawn(this.titleSpot.clone(), this.titleYaw);
    this.player.frozen = true;
    this.hero.group.visible = true;
    this.hero.play("look");
    this.titleT = 0;
    this.ui.paintTitle(this.save);
    this.ui.show("title");
    this.audio.playMusic(MUSIC.title);
  }
  newRun() {
    this.run = {
      pts: { dist: 0, orbs: 0, pass: 0, chain: 0, dash: 0, time: 0, boss: 0 },
      orbs: 0,
      bigs: 0,
      passes: 0,
      chain: 0,
      chainT: 0,
      bestChain: 0,
      combo: 0,
      comboT: 0,
      bestCombo: 0,
      dashJumps: 0,
      airDash: false,
      falls: 0,
      hits: 0,
      hearts: 3,
      time: 0,
      maxDist: 0,
      cp: null,
      hints: new Set(),
      snap: null,
    };
    this.run.snap = this.snapshot();
  }
  snapshot() {
    const r = this.run;
    return { pts: { ...r.pts }, orbs: r.orbs, bigs: r.bigs, passes: r.passes, maxDist: r.maxDist, orbState: this.course.orbState(), passState: this.course.passState() };
  }
  startRun() {
    if (this.state !== "title") return;
    this.audio.unlock();
    this.audio.play("start");
    this.save.recordPlay();
    this.course.resetAll();
    this.fx.reset();
    this.newRun();
    this.resultShown = false;
    this.ui.show(null);
    this.ui.fade(true);
    this.state = "intro";
    this.introT = 0;
    setTimeout(() => {
      // 출발 지점으로
      const s = this.course.start;
      this.player.spawn(s.p, s.yaw);
      this.player.frozen = true;
      this.hero.play("wave");
      this.camDir.set(0, 0, -1);
      this.camY = s.p.y;
      this.placeCamera(1, true);
      this.camPos.y += 3;
      this.ui.fade(false);
      this.ui.hud(true);
      this.ui.setStage(this.def);
      this.paintHud(true);
      this.ui.banner(`STAGE ${this.def.id}`, this.def.name, this.def.intro, 1.8);
      this.audio.playMusic(MUSIC[this.def.music] || MUSIC.play);
    }, 280);
  }
  beginPlay() {
    this.state = "play";
    this.player.frozen = false;
    this.input.setEnabled(true);
    this.hero.play("idle");
  }
  restart() {
    this.paused = false;
    this.state = "title";
    this.ui.show(null);
    this.ui.bossBar(null);
    this.startRun();
  }
  /** 디버그 · 점검용: 스테이지 안 원하는 체크포인트로 바로 (테스트 스크립트가 쓴다) */
  warpTo(cpIdx) {
    const cp = this.course.checkpoints[cpIdx];
    if (!cp || !this.run) return false;
    this.course.activateCheckpoint(cp);
    this.run.cp = cp;
    this.run.snap = this.snapshot();
    this.respawn(false);
    return true;
  }

  /* ================================================================
   * 일시정지
   * ============================================================== */
  pause() {
    if (this.paused) return;
    if (!(this.state === "play" || this.state === "respawn" || this.state === "intro" || this.state === "cine")) return;
    this.paused = true;
    this.input.setEnabled(false);
    this.ui.pauseCard(!!(this.run && this.run.cp));
    this.backTo = "pause";
    this.ui.backTo = "pause";
    this.ui.show("pause");
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.ui.show(null);
    this.last = performance.now();
    if (this.state === "play") this.input.setEnabled(true);
  }
  retryCheckpoint() {
    this.resume();
    if (this.state === "play") this.respawn(false);
  }

  /* ================================================================
   * 떨어짐 → 체크포인트 · 게임 오버
   * ============================================================== */
  fell() {
    if (this.state !== "play") return;
    const r = this.run;
    r.falls++;
    r.hearts--;
    this.state = "respawn";
    this.respT = 0;
    this.input.setEnabled(false);
    this.endCombo();
    this.audio.play("fall");
    this.hero.play("fall");
    this.ui.setHearts(Math.max(0, r.hearts));
    setTimeout(() => this.audio.play("heart"), 200);
  }
  respawn(fromFall = true) {
    const r = this.run;
    const snap = r.snap;
    // 체크포인트 때 상태로 (그 뒤에 얻은 점수 · 구슬은 되돌린다)
    r.pts = { ...snap.pts };
    r.orbs = snap.orbs;
    r.bigs = snap.bigs;
    r.passes = snap.passes;
    r.maxDist = snap.maxDist;
    this.course.restoreOrbs(snap.orbState);
    this.course.restorePasses(snap.passState);
    this.course.resetObstacles();
    this.fx.reset();
    const p = r.cp ? r.cp.p.clone() : this.course.start.p.clone();
    this.player.spawn(p, Math.PI);
    this.player.frozen = false;
    this.camDir.set(0, 0, -1);
    this.camY = p.y;
    this.placeCamera(1, true);
    this.ui.fade(false);
    this.audio.play("respawn");
    this.audio.playMusic(this.stageMusic());
    const boss = this.course.boss;
    this.ui.bossBar(boss ? boss.barInfo() : null);
    this.fx.sparkle(p.clone().setY(p.y + 0.8), 24, ["#9af4ff", "#ffffff"], 3);
    this.ui.toast(r.cp ? "체크포인트에서 다시!" : "처음부터 다시!", "", 1.4);
    this.state = "play";
    this.input.setEnabled(true);
    this.paintHud(true);
  }
  /** 지금 들려줄 음악 (보스전 중이면 보스 음악) */
  stageMusic() {
    const b = this.course.boss;
    if (b && b.fighting) return MUSIC.boss;
    if (b && b.dead) return MUSIC.escape;
    return MUSIC[this.def.music] || MUSIC.play;
  }
  gameOver() {
    this.state = "over";
    this.input.setEnabled(false);
    this.audio.stopMusic();
    this.audio.play("over");
    // 마지막으로 서 있던 곳에서 털썩 주저앉은 토리 (카드 뒤로 보임)
    const p = this.run.cp ? this.run.cp.p.clone() : this.course.start.p.clone();
    this.player.spawn(p, 0.35);
    this.player.frozen = true;
    this.hero.play("defeat", { restart: true });
    this.camDir.set(0, 0, -1);
    this.camY = p.y;
    this.placeCamera(1, true);
    this.ui.hud(false);
    this.ui.prompt(null);
    this.ui.bossBar(null);
    this.ui.over({ dist: this.run.maxDist, orbs: this.run.orbs, score: this.score(), hasCp: !!this.run.cp, boss: !!(this.course.boss && this.course.boss.started) });
  }
  /** 게임 오버 → 하트를 채워 마지막 체크포인트에서 이어하기 */
  continueCheckpoint() {
    this.ui.show(null);
    this.player.frozen = false;
    this.hero.play("idle");
    this.run.hearts = 3;
    this.ui.hud(true);
    this.respawn();
  }

  /* ================================================================
   * 점수 · 콤보
   * ============================================================== */
  score() {
    const p = this.run.pts;
    return p.dist + p.orbs + p.pass + p.chain + p.dash + p.time + (p.boss || 0);
  }
  mult() {
    const c = this.run.combo;
    return c >= 15 ? 2 : c >= 10 ? 1.5 : c >= 5 ? 1.2 : 1;
  }
  bumpCombo() {
    const r = this.run;
    r.combo++;
    r.comboT = 2.6;
    r.bestCombo = Math.max(r.bestCombo, r.combo);
    if (r.combo >= 3) {
      this.ui.combo(r.combo, r.combo >= 15 ? "점수 x2!" : r.combo >= 10 ? "점수 x1.5!" : r.combo >= 5 ? "점수 x1.2!" : "콤보");
      if (r.combo % 5 === 0) this.audio.play("combo", { n: r.combo / 5 });
    }
  }
  endCombo() {
    const r = this.run;
    if (!r) return;
    r.combo = 0;
    r.comboT = 0;
    this.ui.combo(0);
  }
  popAt(p, text, kind = "") {
    const v = this.tmp.copy(p).project(this.cam);
    if (v.z > 1) return;
    this.ui.floatAt(((v.x + 1) / 2) * this.W, ((1 - v.y) / 2) * this.H, text, kind);
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.0001, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) this.step(dt);
    this.render();
    this.watchPerf(dt);
  }
  /** 느린 기기: 자동으로 화질(픽셀 수)을 낮춘다 */
  watchPerf(dt) {
    if (this.save.data.settings.quality !== "auto" || this.state !== "play") return;
    this.frames++;
    this.slowT += dt;
    if (this.slowT > 4) {
      const fps = this.frames / this.slowT;
      if (fps < 40 && (this.slow || 1) > 0.6) {
        this.slow = (this.slow || 1) * 0.8;
        this.resize();
      }
      this.frames = 0;
      this.slowT = 0;
    }
  }
  render() {
    this.renderer.render(this.scene, this.cam);
  }
  step(dt) {
    this.t += dt;
    const P = this.player;
    const playing = this.state === "play";
    // 입력 → 카메라 기준 방향
    let wish = { x: 0, z: 0, mag: 0 };
    let f = {};
    if (playing) {
      const m = this.input.move();
      const fx = this.camDir.x;
      const fz = this.camDir.z;
      const fl = Math.hypot(fx, fz) || 1;
      const ux = fx / fl;
      const uz = fz / fl;
      wish.x = ux * m.y + -uz * m.x;
      wish.z = uz * m.y + ux * m.x;
      wish.mag = Math.min(1, Math.hypot(wish.x, wish.z));
      f = this.input.consume();
    } else this.input.consume();
    const pev = P.update(dt, wish, f, this.input.jumpHeld);
    if (playing) this.onPlayer(pev, dt);
    // 코스 (움직이는 것 · 위험 · 수집)
    const evs = this.course.update(dt, this.state === "title" ? null : P, playing, this.cam.position);
    for (const e of evs) this.onCourse(e);
    // 진행
    if (this.state === "play" || this.state === "respawn" || this.state === "cine") {
      const r = this.run;
      this.course.progress(P.pos, this.pr);
      if (playing) {
        r.time += dt;
        if (this.pr.dist > r.maxDist && P.onGround) {
          r.maxDist = this.pr.dist;
          r.pts.dist = Math.round(r.maxDist * 2);
        }
        if (r.comboT > 0) {
          r.comboT -= dt;
          if (r.comboT <= 0) this.endCombo();
        }
        // 안내
        for (const [i, h] of (this.def.hints || []).entries()) {
          if (!r.hints.has(i) && P.pos.z < h.z && P.pos.z > h.z - 8) {
            r.hints.add(i);
            this.ui.prompt(this.input.touchMode ? h.touch : h.key, 3.2);
          }
        }
        if (P.dashT > 0) this.fx.dashTrail(P.pos.x, P.pos.y, P.pos.z);
      }
      this.paintHud();
    }
    // 상태별
    if (this.state === "intro") {
      this.introT += dt;
      if (this.introT > 1.5) this.beginPlay();
    } else if (this.state === "respawn") {
      this.respT += dt;
      if (this.respT > 0.75 && !this.respFade) {
        this.respFade = true;
        this.ui.fade(true);
      }
      if (this.respT > 1.15) {
        this.respFade = false;
        if (this.run.hearts <= 0) {
          this.ui.fade(false);
          this.gameOver();
        } else this.respawn();
      }
    } else if (this.state === "clear") this.updateClear(dt);
    else if (this.state === "cine") this.updateCine(dt);
    else if (this.state === "title") this.titleT += dt;
    // 발밑 그림자
    const g = this.course.ground(P.pos.x, P.pos.z, 0.1, P.pos.y + 0.05);
    if (g && this.hero.group.visible) {
      const h = P.pos.y - g.h;
      this.blob.visible = true;
      this.blob.position.set(P.pos.x, g.h + 0.02, P.pos.z);
      this.blob.scale.setScalar(Math.max(0.35, 1 - h * 0.1));
      this.blob.material.opacity = Math.max(0.08, 0.32 - h * 0.035);
    } else this.blob.visible = false;
    this.dock.update(dt);
    if ((this.cullT = (this.cullT || 0) - dt) <= 0) {
      this.cullT = 0.2;
      this.course.cull(this.state === "title" ? -30 : P.pos.z);
    }
    this.camera(dt);
    this.world.update(dt, this.cam.position, P.pos);
    this.fx.update(dt);
  }

  /* ---------------- 주인공 일 ---------------- */
  onPlayer(ev, dt) {
    const P = this.player;
    const r = this.run;
    if (ev.jump) {
      this.audio.play("jump");
      this.fx.landDust(P.pos.x, P.pos.y, P.pos.z, 0.25);
    }
    if (ev.dash) {
      this.audio.play("dash");
      if (!P.onGround) r.airDash = true;
    }
    if (ev.land) {
      this.audio.play("land", { k: ev.land });
      this.fx.landDust(P.pos.x, P.pos.y, P.pos.z, ev.land);
      if (ev.land > 0.75) this.shake = Math.max(this.shake, 0.2);
      // 다른 발판으로 건너뛰었나 (연속 점프)
      const hop = ev.landSolid && P.lastSolid && ev.landSolid !== P.lastSolid && !ev.landSolid.deck;
      if (hop) {
        r.chain = r.chainT > 0 ? r.chain + 1 : 1;
        r.chainT = 2.2;
        r.bestChain = Math.max(r.bestChain, r.chain);
        if (r.chain >= 2) {
          const pts = Math.round(10 * r.chain * this.mult());
          r.pts.chain += pts;
          this.popAt(P.pos.clone().setY(P.pos.y + 1.6), `연속 점프 x${r.chain} +${pts}`, "chain");
        }
        this.bumpCombo();
        if (r.airDash) {
          r.dashJumps++;
          r.pts.dash += 20;
          this.popAt(P.pos.clone().setY(P.pos.y + 2.1), "대시 점프 +20", "dash");
        }
      }
      r.airDash = false;
    }
    if (r.chainT > 0) r.chainT -= dt;
    if (ev.fall) this.fell();
  }

  /* ---------------- 코스 일 ---------------- */
  onCourse(e) {
    const P = this.player;
    const r = this.run;
    const near = (p, d = 18) => p && P.pos.distanceTo(p) < d;
    switch (e.type) {
      case "orb": {
        if (!r) break;
        const o = e.orb;
        if (o.big) {
          r.bigs++;
          r.pts.orbs += 100;
          this.audio.play("bigOrb");
          this.fx.sparkle(o.p, 40, ["#ffe27a", "#ffffff", "#ffb83a"], 5);
          this.popAt(o.p, "+100 큰 구슬!", "big");
          this.ui.toast("반짝반짝 큰 에너지 구슬!", "good", 1.4);
        } else {
          r.orbs++;
          const pts = Math.round(10 * this.mult());
          r.pts.orbs += pts;
          this.audio.play("orb", { n: r.combo });
          this.fx.orbBurst(o.p);
          this.popAt(o.p, `+${pts}`, "orb");
        }
        this.bumpCombo();
        break;
      }
      case "checkpoint":
        if (!r) break;
        r.cp = e.cp;
        r.snap = this.snapshot();
        this.audio.play("checkpoint");
        this.ui.toast("체크포인트 저장!", "good", 1.5);
        if (P.onGround && Math.hypot(P.vel.x, P.vel.z) < 2) this.hero.play("checkpoint");
        break;
      case "pass":
        if (!r) break;
        r.passes++;
        r.pts.pass += 50;
        this.audio.play("pass");
        this.popAt(e.p.clone().setY(e.p.y + 2.2), `${e.name} 통과 +50`, "pass");
        this.bumpCombo();
        break;
      case "crack":
        this.audio.play("crack");
        break;
      case "crumble":
        if (near(e.p)) this.audio.play("crumble");
        break;
      case "tileFall":
        if (near(e.p, 14)) this.audio.play("tileFall");
        break;
      case "cloud":
        this.audio.play("cloud");
        break;
      case "hurt":
        // 연출 중(멈춰 있을 때)에는 다치지 않는다
        if (this.state !== "play") break;
        if (P.hurt(e.from, e.power || 6)) {
          r.hits++;
          r.hearts--;
          this.audio.play("hurt");
          this.ui.flash("bad");
          this.shake = Math.max(this.shake, 0.45);
          this.endCombo();
          this.ui.setHearts(Math.max(0, r.hearts));
          if (e.p) this.fx.sparkle(e.p, 14, ["#ffffff", "#ffb07a"], 3);
          if (r.hearts <= 0) {
            this.state = "respawn";
            this.respT = 0.4;
            this.input.setEnabled(false);
            this.hero.play("defeat");
          }
        }
        break;
      case "sfx":
        if (!e.p || P.pos.distanceTo(e.p) < (e.range || 20)) this.audio.play(e.name, e.opt || {});
        break;
      case "shake":
        this.shake = Math.max(this.shake, e.k || 0.3);
        break;
      case "banner":
        this.ui.banner(e.k || "", e.h || "", e.t || "", e.dur || 1.8, e.kind || "");
        break;
      case "toast":
        this.ui.toast(e.text, e.kind || "", e.dur || 1.5);
        break;
      case "knock":
        if (this.state !== "play") break;
        if (P.knock(e.from, 7.5)) {
          this.audio.play("knock");
          this.shake = Math.max(this.shake, 0.35);
          this.ui.flash("bad");
          this.fx.sparkle(e.p, 12, ["#ffffff", "#ffe27a"], 3);
          this.endCombo();
        }
        break;
      case "pad":
        if (this.state !== "play") break;
        P.launch(e.pad.v.x, e.pad.v.y, e.pad.v.z);
        this.hero.play("jump", { restart: true });
        this.audio.play("pad");
        this.fx.sparkle(P.pos.clone().setY(P.pos.y + 0.3), 16, ["#ff9ad0", "#ffffff"], 4);
        break;
      case "ring":
        if (this.state !== "play") break;
        P.launch(e.ring.v.x, e.ring.v.y, e.ring.v.z);
        this.hero.play("dash", { restart: true });
        this.audio.play("ring");
        this.fx.sparkle(V(e.ring.x, e.ring.y, e.ring.z), 30, ["#9af4ff", "#ffffff"], 6);
        this.shake = Math.max(this.shake, 0.2);
        break;
      case "gustWarn":
        if (near(e.p, 22)) this.audio.play("gustWarn");
        break;
      case "gust":
        if (near(e.p, 22)) this.audio.play("gust");
        break;
      case "collapse":
        this.audio.play("collapse");
        this.audio.playMusic(MUSIC.escape);
        this.shake = Math.max(this.shake, 0.7);
        this.startCine();
        break;
      case "rumble":
        this.shake = Math.max(this.shake, 0.18);
        this.audio.play("rumble");
        break;
      case "bigFall":
        this.audio.play("bigFall");
        break;
      case "goal":
        if (this.state === "play") this.clear();
        break;
      /* ---- 최종 보스 ---- */
      case "bossIntro":
        this.audio.playMusic(MUSIC.boss);
        this.startCine("boss");
        this.ui.banner("최종 보스", this.course.boss.name, "약점이 빛날 때 대시로 부딪히거나 밟아요!", 3.0, "danger");
        break;
      case "bossHp":
        this.ui.bossBar(e.info);
        break;
      case "bossTired":
        if (!r) break;
        if (!r.tiredHint) {
          r.tiredHint = true;
          this.ui.prompt(this.input.touchMode ? "약점이 열렸어요! 머리로 달려가 대시 버튼!" : "약점이 열렸어요! 머리로 달려가 Shift 대시! (위에서 밟아도 돼요)", 3.4);
        }
        break;
      case "bossHit":
        if (!r) break;
        r.pts.boss += 500;
        this.popAt(e.p, e.stomp ? "밟기 명중! +500" : "약점 명중! +500", "big");
        this.ui.flash("good");
        this.hero.play("jump", { restart: true });
        break;
      case "bossPhase":
        this.ui.banner(`${e.phase}단계`, e.phase === 3 ? "용이 화가 잔뜩 났어요!" : "용이 화가 났어요!", e.phase === 3 ? "불덩이가 하늘에서 떨어져요 · 원 밖으로!" : "발톱 내려찍기 · 충격파는 점프로!", 2.4, "danger");
        break;
      case "bossDown":
        if (!r) break;
        r.pts.boss += 2000;
        this.ui.bossBar(null);
        this.audio.play("bossDown");
        this.startCine("bossDown");
        break;
      case "bossGone":
        this.audio.playMusic(MUSIC.escape);
        this.ui.banner("승리!", "고대 기계 용을 쓰러뜨렸어요!", "성문이 열렸어요 · 성이 무너지기 전에 비행선으로!", 2.8, "win");
        break;
    }
  }

  /* ---------------- 무너짐 시작: 짧게 뒤를 돌아보는 연출 (1.5초) ---------------- */
  startCine(kind = "collapse") {
    if (this.state !== "play") return;
    const P = this.player;
    this.state = "cine";
    this.cineKind = kind;
    this.cineT = 0;
    this.course.cine = kind === "collapse";
    this.input.setEnabled(false);
    P.frozen = true;
    P.vel.set(0, P.vel.y, 0);
    this.ui.prompt(null);
    this.cineFrom = this.camPos.clone();
    this.cineLook = this.camLook.clone();
    if (kind === "collapse") {
      this.hero.faceTo = 0;
      this.hero.play("surprise", { restart: true });
      this.ui.banner("경고!", this.def.collapseText || "섬이 무너진다!", "", 1.4, "danger");
    } else {
      // 보스 쪽을 바라봄
      const f = this.course.boss.focus();
      this.hero.faceTo = Math.atan2(f.x - P.pos.x, f.z - P.pos.z);
      P.yaw = this.hero.faceTo;
      this.hero.play(kind === "boss" ? "surprise" : "celebrate", { restart: true });
    }
  }
  get cineDur() {
    return this.cineKind === "boss" ? 3.8 : this.cineKind === "bossDown" ? 4.4 : 1.5;
  }
  updateCine(dt) {
    this.cineT += dt;
    if (this.cineT > this.cineDur) {
      const kind = this.cineKind;
      this.state = "play";
      this.course.cine = false;
      this.player.frozen = false;
      this.input.setEnabled(true);
      this.last = performance.now();
      if (kind === "collapse") {
        this.hero.faceTo = Math.PI;
        this.player.yaw = Math.PI;
        this.hero.play("startRun");
        this.ui.banner("", "달려!", "비행선까지 멈추지 마요!", 1.3, "danger");
      } else this.hero.play("idle");
    }
  }

  /* ================================================================
   * 탈출 성공
   * ============================================================== */
  clear() {
    const r = this.run;
    const P = this.player;
    this.state = "clear";
    this.clearT = 0;
    this.input.setEnabled(false);
    P.frozen = true;
    P.vel.set(0, 0, 0);
    this.hero.faceTo = 0;
    this.hero.play("celebrate", { restart: true });
    this.ui.prompt(null);
    this.endCombo();
    r.maxDist = this.course.total;
    r.pts.dist = Math.round(r.maxDist * 2);
    r.pts.time = Math.max(0, Math.round(((this.def.par || 240) - r.time) * 5));
    this.audio.stopMusic();
    this.audio.play("clear");
    this.fx.confetti(P.pos.clone().setY(P.pos.y + 1.5), 90);
    this.ui.bossBar(null);
    const last = this.def.id === STAGES.length;
    this.ui.banner("CLEAR", last ? "용의 성 탈출!" : "탈출 성공!", last ? "토리와 비행선이 마지막 하늘섬을 떠나요" : "비행선이 하늘섬을 떠나요", 2.6, "win");
    const orbTotal = this.course.orbs.filter((o) => !o.big).length;
    r.starOrbs = r.orbs >= Math.ceil(orbTotal * 0.7);
    r.starClean = r.falls + r.hits <= 1;
    r.stars = 1 + (r.starOrbs ? 1 : 0) + (r.starClean ? 1 : 0);
    this.clearRec = this.save.recordClear(this.def.id, { score: this.score(), time: r.time, orbs: r.orbs, stars: r.stars });
    if (last) this.save.recordEnding(r.time);
    this.shipStart = this.course.ship.group.position.clone();
    this.heroOff = P.pos.clone().sub(this.shipStart);
  }
  updateClear(dt) {
    this.clearT += dt;
    const t = this.clearT;
    const ship = this.course.ship;
    const P = this.player;
    if (t > 1.4) {
      // 비행선이 떠오르며 멀어진다 (주인공도 갑판 위에)
      const k = t - 1.4;
      ship.group.position.set(this.shipStart.x, this.shipStart.y + k * k * 0.8, this.shipStart.z - k * k * 2.2);
      if (Math.floor(t * 2) !== Math.floor((t - dt) * 2) && t < 3) this.audio.play("ship");
    }
    P.pos.copy(ship.group.position).add(this.heroOff).add(V(0, ship.inner.position.y, 0));
    this.hero.pos.copy(P.pos);
    if (t > 0.6 && t < 3 && Math.random() < dt * 3) this.fx.confetti(P.pos.clone().setY(P.pos.y + 2), 20);
    if (t > 3.6 && !this.resultShown) {
      this.resultShown = true;
      const r = this.run;
      const d = this.save.data;
      this.audio.playMusic(MUSIC.clear);
      this.ui.hud(false);
      if (this.def.id === STAGES.length) {
        // 마지막 스테이지: 엔딩 화면
        this.ui.ending({
          total: this.save.totalBest(),
          stars: this.save.totalStars(),
          lastTime: r.time,
          count: this.save.data.ending.count,
          stages: STAGES.map((d) => ({ id: d.id, name: d.name, score: (this.save.best(d.id) || {}).score || 0, stars: (this.save.best(d.id) || {}).stars || 0 })),
        });
        return;
      }
      this.ui.result({
        stage: this.def,
        stars: r.stars,
        starOrbs: r.starOrbs,
        starClean: r.starClean,
        hits: r.hits,
        hasNext: this.def.id < STAGES.length,
        unlockedNext: this.clearRec.unlocked,
        nextName: (STAGES[this.stageIdx + 1] || {}).name,
        dist: r.maxDist,
        orbs: r.orbs,
        bigs: r.bigs,
        orbTotal: this.course.orbs.filter((o) => !o.big).length,
        passes: r.passes,
        bestChain: r.bestChain,
        bestCombo: r.bestCombo,
        dashJumps: r.dashJumps,
        time: r.time,
        falls: r.falls,
        pts: r.pts,
        score: this.score(),
        rec: this.clearRec,
        best: this.save.best(this.def.id).score,
        bestTime: this.save.best(this.def.id).time,
        clears: this.save.best(this.def.id).clears,
      });
    }
  }

  /* ================================================================
   * 카메라
   * ============================================================== */
  camera(dt) {
    const cam = this.cam;
    const P = this.player;
    if (this.state === "title" || (this.state === "intro" && this.introT < 0.01 && !this.run)) {
      // 타이틀 카메라: 토리 뒤 오른쪽에서, 토리가 바라보는 노을 쪽을 함께 (토리는 화면 왼쪽 1/3 · 가운데 아래는 버튼 자리)
      const portrait = this.aspect < 0.8;
      const T = window.__titleCam || (portrait ? { b: 5.6, s: 0.9, u: 2.6, ls: 1.2, lu: 1.0, ld: 10, sw: 0.3 } : {});
      const s = this.titleSpot;
      const fx = Math.sin(this.titleYaw);
      const fz = Math.cos(this.titleYaw);
      const rx = -fz;
      const rz = fx;
      const sway = Math.sin(this.titleT * 0.12) * (T.sw ?? 0.6);
      const back = T.b ?? 3.6;
      const side = (T.s ?? 1.8) + sway;
      cam.position.set(s.x - fx * back + rx * side, s.y + (T.u ?? 1.45) + Math.sin(this.titleT * 0.17) * 0.1, s.z - fz * back + rz * side);
      const ld = T.ld ?? 10;
      const ls = (T.ls ?? 2.6) + sway * 0.5;
      cam.lookAt(s.x + fx * ld + rx * ls, s.y + (T.lu ?? 2.35), s.z + fz * ld + rz * ls);
      this.camPos.copy(cam.position);
      return;
    }
    if (this.state === "cine" && this.cineKind !== "collapse") {
      // 보스 등장 · 쓰러짐: 주인공 뒤 옆에서 용을 올려다봄
      const b = this.course.boss;
      const f = b.focus();
      const c = P.pos;
      const dx = f.x - c.x;
      const dz = f.z - c.z;
      const l = Math.hypot(dx, dz) || 1;
      const end = this.cineT > this.cineDur - 0.5 ? (this.cineT - (this.cineDur - 0.5)) / 0.5 : 0;
      const want = V(c.x - (dx / l) * 6.5 + (dz / l) * 3.2, c.y + 2.6, c.z - (dz / l) * 6.5 - (dx / l) * 3.2);
      const look = V(c.x + dx * 0.6, Math.max(c.y + 1.5, f.y * 0.75 + c.y * 0.25), c.z + dz * 0.6);
      const k = 1 - Math.exp(-dt * 3);
      this.camPos.lerp(want, k);
      this.camLook.lerp(look, k);
      if (end > 0) {
        this.placeCamera(dt, false);
        return;
      }
      cam.position.copy(this.camPos);
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 1.8);
        const s = this.shake * this.shake * 0.35;
        cam.position.x += (Math.random() - 0.5) * s;
        cam.position.y += (Math.random() - 0.5) * s;
      }
      cam.lookAt(this.camLook);
      return;
    }
    if (this.state === "cine") {
      // 앞쪽 위에서 주인공과, 그 뒤로 무너지는 섬을 함께
      const t = Math.min(1, this.cineT / 0.45);
      const e = t * t * (3 - 2 * t);
      const c = P.pos;
      const want = V(c.x + 3.2, c.y + 2.6, c.z - 5.2);
      const look = V(c.x, c.y + 0.6, c.z + 6);
      if (this.cineT > 1.1) {
        // 다시 뒤쪽 카메라로 돌아감
        const k = Math.min(1, (this.cineT - 1.1) / 0.4);
        this.placeCamera(dt, false);
        cam.position.lerpVectors(want, this.camPos, k);
        cam.lookAt(look.lerp(this.camLook, k));
        return;
      }
      cam.position.lerpVectors(this.cineFrom, want, e);
      cam.lookAt(this.cineLook.clone().lerp(look, e));
      return;
    }
    if (this.state === "over") {
      // 털썩 주저앉은 토리를 앞에서 (카드 위쪽에 보이게)
      const c = P.pos;
      const portrait = this.aspect < 0.8;
      const want = V(c.x + 0.9, c.y + (portrait ? 2.2 : 1.4), c.z + (portrait ? 4.4 : 3.6));
      this.camPos.lerp(want, 1 - Math.exp(-dt * 3));
      cam.position.copy(this.camPos);
      cam.lookAt(c.x, c.y - (portrait ? 1.6 : 0.95), c.z);
      return;
    }
    if (this.state === "clear") {
      // 비행선을 돌며 축하
      const t = this.clearT;
      const c = P.pos;
      const a = 0.6 + t * 0.35;
      const r = 6 + t * 1.8;
      const want = V(c.x + Math.sin(a) * r, c.y + 2.2 + t * 0.7, c.z + Math.cos(a) * r);
      this.camPos.lerp(want, 1 - Math.exp(-dt * 4));
      cam.position.copy(this.camPos);
      cam.lookAt(c.x, c.y + 1.2, c.z);
      return;
    }
    this.placeCamera(dt, false);
  }
  /** 3인칭 뒤쪽 카메라: 길 방향을 따라가고 · 섬에 파묻히지 않고 · 점프해도 화면 안에 */
  placeCamera(dt, snap) {
    const cam = this.cam;
    const P = this.player;
    const portrait = this.aspect < 0.8;
    // 길 방향 (조금 앞을 내다봄)
    this.course.progress(P.pos, this.pr);
    let tx = this.pr.dx;
    let tz = this.pr.dz;
    const hint = this.course.camHint ? this.course.camHint(P) : null;
    if (hint) {
      tx = hint.dx;
      tz = hint.dz;
    }
    this.hintK = damp(this.hintK || 0, hint ? 1 : 0, 2, dt);
    const k = snap ? 1 : 1 - Math.exp(-dt * 2.2);
    this.camDir.x += (tx - this.camDir.x) * k;
    this.camDir.z += (tz - this.camDir.z) * k;
    this.camDir.y = 0;
    this.camDir.normalize();
    // 높이: 땅에 서 있을 땐 따라가고, 점프 중엔 조금 늦게 (화면이 덜 흔들리게)
    const falling = this.state === "respawn";
    const ty = falling ? Math.max(this.camY - dt * 3, this.course.killY + 12) : P.pos.y;
    const rate = falling ? 1 : P.onGround ? 5 : Math.abs(P.pos.y - this.camY) > 2.2 ? 4 : 1.6;
    this.camY = snap ? ty : damp(this.camY, ty, rate, dt);
    // 무너지는 섬에서는 조금 높고 멀리서 (뒤에서 무너지는 모습이 화면 아래에 보이게)
    const cz = this.course.collapse;
    const k2 = cz && cz.on && P.pos.z < cz.z0 && P.pos.z > cz.z0 - 42 ? 1 : 0;
    this.collapseCam = damp(this.collapseCam || 0, k2, 2.5, dt);
    const dist = (portrait ? 8.4 : 6.6) + this.collapseCam * 1.6 + this.hintK * 2.6;
    const hgt = (portrait ? 3.9 : 3.1) + this.collapseCam * 1.6 + this.hintK * 1.8;
    const lx = this.hintK > 0.01 ? P.pos.x : P.pos.x * 0.85 + this.laneX() * 0.15;
    const focus = V(lx, this.camY + 1.0, P.pos.z);
    let want = focus.clone().addScaledVector(this.camDir, -dist);
    want.y += hgt;
    // 섬 · 다리에 카메라가 파묻히지 않게
    const dir = want.clone().sub(focus);
    const len = dir.length();
    dir.divideScalar(len);
    const hit = this.course.ray(focus, dir, len);
    if (hit < len) want = focus.clone().addScaledVector(dir, Math.max(1.6, hit - 0.35));
    const look = focus.clone().addScaledVector(this.camDir, 3.2);
    look.y += 0.2;
    if (falling) {
      look.copy(P.pos);
      look.y += 0.5;
    }
    const kp = snap ? 1 : 1 - Math.exp(-dt * 8);
    this.camPos.lerp(want, kp);
    this.camLook.lerp(look, snap ? 1 : 1 - Math.exp(-dt * 10));
    cam.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8);
      const s = this.shake * this.shake * 0.35;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }
    cam.lookAt(this.camLook);
  }
  laneX() {
    return this.course.laneX(this.player.pos.z);
  }

  /** 페이지를 떠날 때 정리 */
  dispose() {
    this.audio.stopMusic();
    this.audio.destroy && this.audio.destroy();
    this.course.dispose();
    this.world.dispose();
    this.hero.dispose();
    this.renderer.dispose();
  }

  /* ---------------- HUD ---------------- */
  paintHud(force = false) {
    const r = this.run;
    if (!r) return;
    const ui = this.ui;
    const sc = this.score();
    const total = this.course.orbs.filter((o) => !o.big).length;
    const key = `${r.hearts}|${r.orbs}|${sc}|${Math.floor(r.time * 10)}|${Math.round((this.pr.k || 0) * 200)}`;
    if (force || key !== this.hudKey) {
      this.hudKey = key;
      ui.setHearts(Math.max(0, r.hearts));
      ui.setOrbs(r.orbs, total);
      ui.setScore(sc);
      ui.setTime(r.time);
      ui.setProg(r.maxDist / this.course.total);
    }
    const P = this.player;
    const ready = P.dashReady;
    const cd = 1 - P.dashCD / PHYS.dashCD;
    const dk = `${ready}|${Math.round(cd * 20)}`;
    if (force || dk !== this.dashKey) {
      this.dashKey = dk;
      ui.setDash(ready, cd);
    }
  }
}
