/*
 * 용암 서핑 · 게임 진행
 *  상태: loading → title(출발선을 비추는 카메라) → ready(준비 · 출발!) → play ⇄ pause
 *        → fall(용암에 빠짐 → 체크포인트) · over(따라잡힘 / 하트 0) · clear(안전지대 도착 → 결과)
 *  스테이지: 15 정규 + 보스 3 + 무한 도전. 스테이지를 바꾸면 코스 · 지형 · 장애물 · 용암 · 보스를 새로 만들고
 *  하늘 · 빛 · 주인공 · 효과는 그대로 쓴다. 게임 루프는 하나만 돈다.
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { World } from "./world.js?v=2";
import { Track } from "./track.js?v=2";
import { Terrain } from "./terrain.js?v=2";
import { STAGES, ENDLESS, START_S, stageLabel } from "./stages.js?v=2";
import { THEMES } from "./themes.js?v=2";
import { Items } from "./obstacles.js?v=2";
import { LavaChase } from "./lava.js?v=2";
import { Rider } from "./rider.js?v=2";
import { Player, PH } from "./player.js?v=2";
import { Input } from "./input.js?v=2";
import { FX } from "./fx.js?v=2";
import { LavaAudio, MUSIC } from "./audio.js?v=2";
import { Save, STAGE_COUNT } from "./save.js?v=2";
import { UI } from "./ui.js?v=2";
import { BOSSES } from "./bosses.js?v=2";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const CP_LAVA_GAP = 40; // 체크포인트에서 다시 시작할 때 용암 거리

export class Game {
  constructor({ canvas, field }) {
    this.canvas = canvas;
    this.field = field;
    this.save = new Save();
    const st = this.save.data.settings;
    this.audio = new LavaAudio({ musicVol: st.musicVol, sfxVol: st.sfxVol });
    this.ui = new UI(this);
    this.mobile = matchMedia("(pointer:coarse)").matches;
    this.level = this.qualityLevel();
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) throw new Error("no webgl");
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.level !== "low", powerPreference: "high-performance" });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(62, 1, 0.1, 1100);
    this.state = "loading";
    this.paused = false;
    this.shake = 0;
    this.t = 0;
    this.last = performance.now();
    this.camPos = V(0, 0, 0);
    this.camLook = V(0, 0, 0);
    this.frames = 0;
    this.slowT = 0;
    this.tmp = V();
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
   * 불러오기
   * ============================================================== */
  async init() {
    const ui = this.ui;
    const q = this.level === "low" ? 0.5 : this.level === "mid" ? 0.8 : 1;
    this.q = q;
    ui.loading(0.08, "하늘에 화산재를 뿌리는 중…");
    await nextFrame();
    this.world = new World(this.renderer, this.scene, { quality: q });
    this.fx = new FX(this.scene, { quality: q });
    this.fx.setFog(this.scene.fog);
    ui.loading(0.3, "피코가 보드에 올라타는 중…");
    await nextFrame();
    this.rider = new Rider();
    this.scene.add(this.rider.group);
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ color: "#1a0a0e", transparent: true, opacity: 0.4, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 2;
    this.scene.add(this.blob);
    this.input = new Input({
      left: document.getElementById("btn-left"),
      right: document.getElementById("btn-right"),
      jump: document.getElementById("btn-jump"),
      boost: document.getElementById("btn-boost"),
      pad: document.getElementById("steer-pad"),
    });
    this.bindKeys();
    ui.loading(0.5, "화산 경사면을 깎는 중…");
    await nextFrame();
    await this.loadStage(this.defById(this.save.unlocked > STAGE_COUNT ? STAGE_COUNT : this.save.unlocked), { first: true });
    this.toTitle(true);
    ui.loading(1, "준비 끝!");
    await nextFrame();
    this.render();
    ui.hideLoading();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }
  defById(id) {
    if (id === ENDLESS.id) return ENDLESS;
    return STAGES.find((d) => d.id === id) || STAGES[0];
  }
  /** 스테이지 하나 만들기 (지난 스테이지 것은 치움) */
  async loadStage(def, { first = false } = {}) {
    const ui = this.ui;
    this.loadingStage = true;
    if (!first) {
      ui.showLoading(`${stageLabel(def)} · ${def.name} 만드는 중…`);
      await nextFrame();
      await nextFrame();
    }
    this.unloadStage();
    const theme = THEMES[def.theme] || THEMES.basalt;
    this.theme = theme;
    this.world.applyTheme(theme);
    this.fx.setFog(this.scene.fog);
    ui.loading(0.6, "코스를 만드는 중…");
    const built = def.endless ? def.build(this.endlessSeed || 1) : def.build();
    this.stage = def;
    this.course = built.course;
    this.sections = built.sections;
    this.track = new Track(this.course);
    this.terrain = new Terrain(this.track, this.scene, { quality: this.q, theme });
    ui.loading(0.75, "장애물을 놓는 중…");
    if (!first) await nextFrame();
    this.items = new Items(this.track, this.scene, built.items, this.course, this.fx);
    this.cps = this.course.checkpoints.map((s, i) => ({ s, i, arch: this.terrain.arch(s), on: false }));
    this.terrain.safeZone(this.course.finish);
    this.startArch = this.terrain.arch(START_S + 4);
    this.lava = new LavaChase(this.track, this.scene, this.course, { quality: this.q, scale: theme.bigWave || 1 });
    // 먼 화산: 출발점 뒤(용암이 흘러나오는 곳) · 코스 끝 옆
    const f0 = this.track.frame(0, {});
    const fe = this.track.frame(this.track.len, {});
    this.world.volcano(f0.x - f0.tx * 250, f0.y - 140, f0.z - f0.tz * 250, 230, 290);
    this.world.volcano(fe.x + fe.rx * 280 + fe.tx * 120, fe.y - 70, fe.z + fe.rz * 280 + fe.tz * 120, 150, 170);
    if (!this.player) this.player = new Player(this.track);
    this.player.track = this.track;
    this.player.reset(START_S, 0);
    this.lava.reset(START_S - 62);
    this.boss = def.boss && BOSSES[def.boss] ? new BOSSES[def.boss](this) : null;
    // 보스전: 탈출 안전지대를 미리 만들어 숨겨 둠 (격파 순간 끊김 없게)
    this.escapeZone = null;
    if (this.boss) {
      this.escapeZone = this.terrain.safeZone(this.course.finish - 400);
      this.escapeZone.visible = false;
    }
    this.finishS = this.course.finish;
    this.escape = false;
    this.camFwd = null;
    this.camY = undefined;
    ui.loading(0.9, "용암을 데우는 중…");
    this.renderer.compile(this.scene, this.cam);
    this.loadingStage = false;
    if (!first) ui.hideLoading();
  }
  unloadStage() {
    for (const k of ["terrain", "items", "lava", "boss"]) {
      if (this[k]) {
        try {
          this[k].dispose();
        } catch (e) {
          console.warn(e);
        }
        this[k] = null;
      }
    }
  }
  bindKeys() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.paused) this.resume();
        else if (this.state === "play" || this.state === "ready") this.pause();
        else if (["howto", "sound", "stages"].includes(this.ui.current)) this.ui.show(this.ui.backTo || "title");
      }
      if ((e.key === "Enter" || e.code === "Space") && this.state === "title" && this.ui.current === "title" && !e.repeat) {
        e.preventDefault();
        this.audio.unlock();
        this.startFromTitle();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && (this.state === "play" || this.state === "ready")) this.pause();
    });
  }
  resize() {
    const w = this.field.clientWidth || window.innerWidth;
    const h = this.field.clientHeight || window.innerHeight;
    this.W = w;
    this.H = h;
    this.aspect = w / h;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
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
    }
  }
  music() {
    if (this.stage.boss) return MUSIC.boss;
    if (this.stage.endless) return MUSIC.endless;
    return MUSIC[this.theme.music] || MUSIC.play;
  }

  /* ================================================================
   * 타이틀 · 시작
   * ============================================================== */
  toTitle(first = false) {
    this.state = "title";
    this.paused = false;
    this.input.setEnabled(false);
    this.ui.hud(false);
    this.ui.prompt(null);
    this.ui.hideBanner();
    this.ui.combo(0);
    this.ui.fade(false);
    this.ui.bossBar(null);
    if (!first) {
      this.items.reset();
      this.items.resetOrbs();
      this.fx.reset();
      if (this.boss) this.boss.reset(true);
    }
    this.player.reset(START_S, 0);
    this.player.frozen = false;
    this.lava.reset(START_S - 62);
    this.rider.play("ready");
    this.titleT = 0;
    this.ui.paintTitle(this.save);
    this.ui.show("title");
    this.audio.playMusic(MUSIC.title);
  }
  /** 타이틀의 '게임 시작': 다음에 할 스테이지 (지금 불러온 것과 다르면 새로 만듦) */
  async startFromTitle() {
    const id = this.continueStageId();
    if (this.stage.id !== id) await this.loadStage(this.defById(id));
    this.startRun();
  }
  continueStageId() {
    const best = this.save.data.stages.best;
    for (let i = 1; i <= Math.min(this.save.unlocked, STAGE_COUNT); i++) if (!best[i]) return i;
    return Math.min(this.save.unlocked, STAGE_COUNT);
  }
  async startStage(id) {
    if (this.busy) return;
    this.busy = true;
    try {
      const def = this.defById(id);
      if (def.endless) this.endlessSeed = (Date.now() % 9973) + 1;
      if (this.stage.id !== id || def.endless) await this.loadStage(def);
      else {
        this.items.reset();
        this.items.resetOrbs();
        if (this.boss) this.boss.reset(true);
      }
      this.state = "title";
      this.startRun();
    } finally {
      this.busy = false;
    }
  }
  async nextStage() {
    const id = this.stage.id + 1;
    if (id > STAGE_COUNT) return this.toStages();
    await this.startStage(id);
  }
  toStages() {
    if (this.state !== "title") this.toTitle();
    this.ui.openPanel("stages", "title");
  }
  newRun() {
    this.run = {
      pts: { dist: 0, time: 0, orbs: 0, stunt: 0, combo: 0, boost: 0, boss: 0, clear: 0 },
      orbs: 0,
      bigs: 0,
      spins: 0,
      perfects: 0,
      boosts: 0,
      combo: 0,
      comboT: 0,
      bestCombo: 0,
      hearts: 3,
      hits: 0,
      falls: 0,
      heartsLost: 0,
      pendStunt: 0,
      pendSpins: 0,
      failedStunts: 0,
      time: 0,
      maxS: START_S,
      cp: null,
      hints: new Set(),
      lavaKey: 0,
      snap: null,
    };
    this.run.snap = this.snapshot();
  }
  snapshot() {
    const r = this.run;
    return { pts: { ...r.pts }, orbs: r.orbs, bigs: r.bigs, spins: r.spins, perfects: r.perfects, boosts: r.boosts, orbState: this.items.orbState() };
  }
  startRun() {
    if (this.state !== "title") return;
    this.audio.unlock();
    this.save.recordPlay();
    this.items.reset();
    this.items.resetOrbs();
    this.fx.reset();
    this.newRun();
    this.player.reset(START_S, 0);
    this.player.frozen = false;
    this.lava.reset(START_S - this.course.lava[0].gap);
    this.lava.off = !!this.course.noLava;
    this.lava.boost = 0;
    this.escape = false;
    this.finishS = this.course.finish;
    if (this.escapeZone) this.escapeZone.visible = false;
    this.resultShown = false;
    if (this.boss) this.boss.reset(true);
    for (const c of this.cps) {
      c.on = false;
      c.arch.banner.material.color.set("#ffcf4a");
    }
    this.ui.show(null);
    this.ui.hud(true);
    this.ui.setStage(this.stage);
    this.ui.setHearts(3);
    this.ui.bossBar(this.boss ? { name: this.stage.name, hp: this.boss.hp, max: this.boss.maxHp } : null);
    this.ui.chaseVisible(!this.lava.off);
    this.state = "ready";
    this.readyT = 0;
    this.rider.play("ready");
    this.ui.banner(stageLabel(this.stage), this.stage.name, this.stage.intro || "준비…", 1.6);
    this.audio.play("ready");
    this.audio.playMusic(this.music());
    this.paintHud(true);
  }
  go() {
    this.state = "play";
    this.input.setEnabled(true);
    this.player.speed = 12;
    this.rider.play("ride");
    this.ui.banner("", "출발!", this.boss ? "보스를 쓰러뜨리고 탈출해요!" : "용암보다 빨리 내려가요!", 1.1);
    this.audio.play("go");
    if (this.boss) this.boss.start();
  }
  restart() {
    this.paused = false;
    this.state = "title";
    this.ui.show(null);
    this.startRun();
  }
  pause() {
    if (this.paused || !(this.state === "play" || this.state === "ready" || this.state === "fall")) return;
    this.paused = true;
    this.input.setEnabled(false);
    this.ui.pauseCard(!!(this.run && this.run.cp));
    this.ui.backTo = "pause";
    this.ui.show("pause");
    this.audio.setLoops(0, false, 0, false);
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
   * 용암에 빠짐 · 따라잡힘 · 다시
   * ============================================================== */
  fellInLava() {
    if (this.state !== "play") return;
    const r = this.run;
    r.pendStunt = 0;
    r.falls++;
    r.hearts--;
    r.heartsLost++;
    this.state = "fall";
    this.fallT = 0;
    this.input.setEnabled(false);
    this.endCombo();
    const p = this.playerWorld();
    this.fx.splash(p.x, this.track.lavaY(this.player.s) + 0.5, p.z);
    this.audio.play("splash");
    this.shake = 0.6;
    this.rider.play("lose");
    this.ui.setHearts(Math.max(0, r.hearts));
    this.ui.flash("bad");
    this.ui.toast(r.hearts > 0 ? "앗 뜨거! 용암에 빠졌어요" : "하트를 모두 잃었어요", "bad", 1.4);
  }
  caught() {
    if (this.state !== "play") return;
    this.state = "over";
    this.input.setEnabled(false);
    this.endCombo();
    this.player.frozen = true;
    this.rider.play("lose");
    this.audio.play("caught");
    this.audio.stopMusic();
    this.ui.flash("bad");
    this.shake = 1;
    this.overT = 0;
    this.overCaught = true;
  }
  /** 보스전에서 하트를 모두 잃음 */
  bossOver() {
    if (this.state !== "play") return;
    this.state = "over";
    this.input.setEnabled(false);
    this.endCombo();
    this.player.frozen = true;
    this.rider.play("lose");
    this.audio.play("over");
    this.audio.stopMusic();
    this.overT = 0.4;
    this.overCaught = false;
  }
  showOver(caught) {
    this.ui.hud(false);
    this.ui.prompt(null);
    this.audio.setLoops(0, false, 0, false);
    const r = this.run;
    const dist = Math.max(0, r.maxS - START_S);
    if (this.stage.endless) {
      const rec = this.save.recordEndless({ score: this.score(), dist });
      const E = this.save.data.endless;
      this.ui.endlessResult({ caught, dist, orbs: r.orbs + r.bigs, score: this.score(), time: r.time, rec, best: E.best, bestDist: E.dist });
      return;
    }
    this.ui.over({ caught, boss: !!this.boss, stage: this.stage, dist, orbs: r.orbs + r.bigs, score: this.score(), hasCp: !!r.cp || !!this.boss });
  }
  /** 체크포인트(없으면 출발점 · 보스전은 조금 뒤)에서 다시 · 용암은 뒤로 물림 · 그 뒤 장애물 · 구슬 되돌림 */
  respawn() {
    const r = this.run;
    const snap = r.snap;
    r.pts = { ...snap.pts };
    Object.assign(r, { orbs: snap.orbs, bigs: snap.bigs, spins: snap.spins, perfects: snap.perfects, boosts: snap.boosts });
    this.items.restoreOrbs(snap.orbState);
    r.pendStunt = 0;
    r.pendSpins = 0;
    const s = this.boss ? Math.max(START_S, this.player.s - 30) : r.cp ? r.cp.s : START_S;
    this.items.reset(s - 5);
    this.fx.reset();
    this.player.reset(s, 15);
    this.player.frozen = false;
    if (!this.lava.off) this.lava.reset(s - CP_LAVA_GAP);
    this.lava.boost = 0;
    r.maxS = Math.max(s, Math.min(r.maxS, s));
    this.state = "play";
    this.input.setEnabled(true);
    this.rider.play("ride");
    this.ui.fade(false);
    this.ui.toast(this.boss ? "보스전 다시 도전!" : r.cp ? "체크포인트에서 다시!" : "처음부터 다시!", "", 1.4);
    this.audio.playMusic(this.music());
    this.player.invulnT = 1.5;
    this.camFwd = null;
    this.camY = undefined;
    this.paintHud(true);
  }
  /** 게임 오버 → 체크포인트(보스전은 지금 단계)에서 (하트를 다시 채움) */
  continueCheckpoint() {
    this.ui.show(null);
    this.ui.hud(true);
    this.run.hearts = 3;
    this.ui.setHearts(3);
    if (this.boss) this.boss.retryPhase();
    this.respawn();
    if (this.boss) this.ui.bossBar({ name: this.stage.name, hp: this.boss.hp, max: this.boss.maxHp });
  }

  /* ================================================================
   * 점수 · 콤보
   * ============================================================== */
  score() {
    const p = this.run.pts;
    return p.dist + p.time + p.orbs + p.stunt + p.combo + p.boost + p.boss + p.clear;
  }
  mult() {
    const c = this.run.combo;
    return c >= 15 ? 2 : c >= 10 ? 1.5 : c >= 5 ? 1.2 : 1;
  }
  bumpCombo(label) {
    const r = this.run;
    r.combo++;
    r.comboT = 3.2;
    r.bestCombo = Math.max(r.bestCombo, r.combo);
    if (r.combo >= 3) {
      r.pts.combo += r.combo * 2;
      this.ui.combo(r.combo, label || (r.combo >= 15 ? "점수 x2!" : r.combo >= 10 ? "점수 x1.5!" : r.combo >= 5 ? "점수 x1.2!" : "콤보"));
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
  playerWorld(out = V()) {
    return this.track.toWorld(this.player.s, this.player.u, this.player.y, out);
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0.0001, (now - this.last) / 1000));
    this.last = now;
    if (this.loadingStage) return;
    if (!this.paused && this.track) this.step(dt);
    this.render();
    this.watchPerf(dt);
  }
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
    this.track.t += dt;
    const P = this.player;
    const playing = this.state === "play";
    const f = this.input.consume();
    let pev = {};
    if (playing) pev = P.update(dt, { steer: this.input.steer(), jump: f.jump, boost: f.boost });
    else if (this.state === "clear") {
      P.speed = damp(P.speed, 0, 2, dt);
      P.update(dt, { steer: 0 });
    }
    if (playing) this.onPlayer(pev, dt);
    // 장애물 · 수집물
    const iev = this.items.update(dt, P, playing);
    for (const e of iev) this.onItem(e);
    // 보스
    if (this.boss && this.state !== "title") {
      const bev = this.boss.update(dt, playing);
      for (const e of bev) this.onBoss(e);
    }
    // 용암 추격
    const ch = this.lava.update(dt, P, playing);
    if (playing && ch.caught) this.caught();
    // 진행
    if (this.run && (playing || this.state === "fall")) {
      const r = this.run;
      if (playing) {
        r.time += dt;
        r.pts.time = Math.round(r.time * 4);
        if (P.s > r.maxS) {
          r.maxS = P.s;
          r.pts.dist = Math.round(r.maxS - START_S);
        }
        if (r.comboT > 0) {
          r.comboT -= dt;
          if (r.comboT <= 0) this.endCombo();
        }
        this.checkSections();
        this.checkCheckpoints();
        if (P.s >= this.finishS && P.onGround && (!this.boss || this.escape)) this.clear();
      }
      this.paintHud();
    }
    // 상태별
    if (this.state === "ready") {
      this.readyT += dt;
      if (this.readyT > 1.4) this.go();
    } else if (this.state === "fall") {
      this.fallT += dt;
      if (this.fallT > 0.9 && !this.fallFade) {
        this.fallFade = true;
        this.ui.fade(true);
      }
      if (this.fallT > 1.3) {
        this.fallFade = false;
        if (this.run.hearts <= 0) {
          this.ui.fade(false);
          this.state = "over";
          this.overT = 1;
          this.overCaught = false;
        } else this.respawn();
      }
    } else if (this.state === "over") {
      this.overT += dt;
      if (this.overT > 1.4 && !["over", "endless"].includes(this.ui.current)) this.showOver(this.overCaught);
    } else if (this.state === "clear") this.updateClear(dt);
    else if (this.state === "title") this.titleT += dt;
    this.placeRider(dt);
    this.audio.setLoops(clamp(P.speed / 32, 0, 1), P.onGround, ch.danger, playing || this.state === "ready");
    if (playing) this.ui.danger(ch.danger * 0.9);
    if (playing && ch.danger > 0.5 && Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.audio.play("warn");
    // 배경 분출 (가끔) · 폭풍 천둥
    this.eruptT = (this.eruptT ?? 6) - dt;
    if (this.eruptT <= 0) {
      this.eruptT = (this.theme.erupt ? 4 : 7) + Math.random() * 8;
      this.world.flash = 0.6;
      if (this.state !== "title") this.audio.play("erupt");
    }
    if (this.world.thunder) {
      this.world.thunder = false;
      if (this.state !== "title") this.audio.play("thunder");
    }
    this.updateFog(dt);
    this.terrain.update(dt, this.t);
    this.camera(dt);
    this.world.update(dt, this.cam.position, this.focus || this.camLook);
    this.fx.update(dt);
  }
  /** 연기 구간: 앞이 덜 보이게 (부드럽게) */
  updateFog(dt) {
    const fogs = this.course.fogs;
    const base = this.world.fogBase;
    let near = base[0];
    let far = base[1];
    if (fogs) {
      const s = this.player.s;
      for (const z of fogs) {
        const k = clamp(Math.min(s - z.s0, z.s1 - s) / 25 + 0.5, 0, 1);
        if (k > 0) {
          near = near + (z.near - near) * k;
          far = far + (z.far - far) * k;
        }
      }
    }
    const fog = this.scene.fog;
    const nn = damp(fog.near, near, 2, dt);
    const ff = damp(fog.far, far, 2, dt);
    if (Math.abs(nn - fog.near) > 0.05 || Math.abs(ff - fog.far) > 0.05) {
      fog.near = nn;
      fog.far = ff;
      this.fx.setFog(fog);
    }
  }

  /* ---------------- 보드 일 ---------------- */
  onPlayer(ev) {
    const P = this.player;
    const r = this.run;
    const w = this.playerWorld();
    if (ev.jump) {
      this.audio.play("jump");
      this.rider.play("jump", { restart: true });
      this.fx.land(w.x, P.y, w.z, 0.4);
    }
    if (ev.launch) {
      this.audio.play("launch");
      this.rider.play("air", { restart: true });
    }
    if (ev.spinStart) this.audio.play("spin");
    if (ev.spinDone) {
      // 회전 점수는 '깨끗하게 착지해야' 들어온다 (공중에서는 쌓아 두기만)
      r.pendSpins = ev.spinDone;
      r.pendStunt = (r.pendStunt || 0) + Math.round(150 * this.mult());
      this.popAt(w.clone().setY(P.y + 2.4), `회전 x${ev.spinDone}!`, "chain");
      this.audio.play("spin");
    }
    if (ev.boost) {
      r.boosts++;
      r.pts.boost += 25;
      this.audio.play("boost");
      this.rider.play("boost");
      this.shake = Math.max(this.shake, 0.15);
    }
    if (ev.wall) this.audio.play("scrape");
    if (ev.land) {
      const L = ev.land;
      const k = clamp(L.impact / 18, 0.2, 1);
      this.audio.play("land", { k });
      this.fx.land(w.x, P.y, w.z, k);
      if (L.impact > 14) this.shake = Math.max(this.shake, 0.25 * k);
      if (L.failed) {
        r.pendStunt = 0;
        r.pendSpins = 0;
        r.failedStunts++;
        this.rider.play("crash", { restart: true });
        this.audio.play("fail");
        this.ui.toast("회전 실패! 균형을 잃었어요", "bad", 1.2);
        this.endCombo();
      } else {
        if (r.pendStunt > 0) {
          r.spins += r.pendSpins;
          r.pts.stunt += r.pendStunt;
          this.popAt(w.clone().setY(P.y + 2.2), `스턴트 성공! +${r.pendStunt}`, "big");
          this.audio.play("trick");
          this.bumpCombo("스턴트!");
          r.pendStunt = 0;
          r.pendSpins = 0;
        }
        this.rider.play("land", { k });
        if (L.air > 0.45) {
          this.bumpCombo();
          if (L.perfect) {
            r.perfects++;
            const pts = Math.round(60 * this.mult());
            r.pts.stunt += pts;
            this.popAt(w.clone().setY(P.y + 1.8), `완벽한 착지 +${pts}`, "dash");
          }
        }
      }
    }
    if (ev.lava) this.fellInLava();
    const R = this.rider;
    if (!P.onGround && !["jump", "air", "crash"].includes(R.state)) R.play("air");
    if (P.onGround && R.state === "air") R.play("land");
    if (P.onGround && P.boostT > 0 && R.state === "ride") R.play("boost");
    if (P.onGround && P.boostT <= 0 && R.state === "boost") R.play("ride");
    if (P.crashT > 0 && R.state !== "crash" && P.onGround && P.crashT > PH.crashTime - 0.05) R.play("crash", { restart: true });
    if (P.onGround && Math.random() < 0.016 * (10 + P.speed)) this.fx.trail(w.x, P.y, w.z, this.camFwd ? this.camFwd.x * P.speed : 0, this.camFwd ? this.camFwd.z * P.speed : 0, 0.8);
    if (P.boostT > 0) {
      const back = this.camFwd || V(0, 0, -1);
      this.fx.boostFire(w.x - back.x * 0.9, P.y + 0.1, w.z - back.z * 0.9, back.x * P.speed, back.z * P.speed);
    }
  }
  /** 부딪힘 (장애물 · 보스 공격): 보스전에서는 하트도 줄어듦 */
  playerHurt(e) {
    const r = this.run;
    if (!r) return;
    r.hits++;
    const P = this.player;
    const w = this.playerWorld();
    this.fx.hit(w.x, P.y, w.z);
    this.audio.play(e.kind === "zap" ? "zap" : "hit");
    this.ui.flash("bad");
    this.shake = Math.max(this.shake, 0.55);
    this.rider.play("crash", { restart: true });
    this.endCombo();
    if (this.boss && !this.escape) {
      r.hearts--;
      r.heartsLost++;
      this.ui.setHearts(Math.max(0, r.hearts));
      this.ui.toast(r.hearts > 0 ? "아야! 하트가 줄었어요" : "하트를 모두 잃었어요", "bad", 1.1);
      if (r.hearts <= 0) this.bossOver();
      return;
    }
    const msg = e.kind === "zap" ? "찌릿! 전기에 맞아 느려졌어요" : e.fire ? "앗 뜨거! 불에 데었어요" : "쿵! 부딪혀서 느려졌어요";
    this.ui.toast(msg, "bad", 1.1);
  }
  onItem(e) {
    const P = this.player;
    const r = this.run;
    switch (e.type) {
      case "hit":
        this.playerHurt(e);
        break;
      case "pad":
        if (!r) break;
        P.boost(PH.padBoost + 0.4, true);
        r.boosts++;
        r.pts.boost += 25;
        this.audio.play("pad");
        this.bumpCombo("부스터!");
        this.shake = Math.max(this.shake, 0.12);
        this.rider.play("boost");
        break;
      case "orb": {
        if (!r) break;
        const o = e.orb;
        if (o.big) {
          r.bigs++;
          r.pts.orbs += 150;
          this.audio.play("bigOrb");
          this.fx.orb(o.p.x, o.p.y, o.p.z, true);
          this.popAt(o.p, "+150 큰 보석!", "big");
          P.boostCD = Math.max(0, P.boostCD - 2);
        } else {
          r.orbs++;
          const pts = Math.round(20 * this.mult());
          r.pts.orbs += pts;
          this.audio.play("orb", { n: r.combo });
          this.fx.orb(o.p.x, o.p.y, o.p.z);
          this.popAt(o.p, `+${pts}`, "orb");
          P.boostCD = Math.max(0, P.boostCD - 0.3);
        }
        this.bumpCombo();
        break;
      }
      case "rumble":
      case "eruptWarn":
        this.audio.play("rumble");
        this.shake = Math.max(this.shake, 0.15);
        break;
      case "rollStart":
        this.audio.play("rollStart");
        this.shake = Math.max(this.shake, 0.25);
        break;
      case "erupt":
        this.audio.play("erupt");
        this.shake = Math.max(this.shake, 0.45);
        this.world.flash = 0.8;
        break;
      case "bombWarn":
        this.audio.play(e.kind === "bolt" ? "charge" : "whistle");
        break;
      case "bombHit":
        if (e.near) {
          this.audio.play(e.kind === "bolt" ? "thunder" : "boom");
          this.shake = Math.max(this.shake, e.kind === "bolt" ? 0.3 : 0.2);
          if (e.kind === "bolt") this.world.bolt = 0.7;
        }
        break;
      case "fireWarn":
      case "fireOn":
      case "crack":
      case "collapse":
      case "laserOn":
      case "gateOpen":
      case "gateClose":
      case "switch":
      case "sinkStart":
      case "fallOn":
        this.audio.play(e.type);
        if (e.type === "collapse") this.shake = Math.max(this.shake, 0.3);
        if (e.type === "switch") this.ui.toast("딸깍! 문이 열려요", "good", 1.0);
        break;
    }
  }
  onBoss(e) {
    const r = this.run;
    switch (e.type) {
      case "hit":
        if (this.state === "play" && this.player.crash()) {
          this.player.vu = (Math.sign(this.player.u - (e.u ?? 0)) || 1) * 5;
          this.playerHurt(e);
        }
        break;
      case "bossHit":
        if (!r) break;
        r.pts.boss += 500;
        this.ui.bossBar({ name: this.stage.name, hp: e.hp, max: this.boss.maxHp, hit: true });
        this.popAt(e.at || this.playerWorld().setY(this.player.y + 3), "명중! +500", "big");
        this.audio.play("bossHit");
        this.shake = Math.max(this.shake, 0.6);
        this.ui.flash("good");
        this.bumpCombo("명중!");
        // 명중하면 하트 하나 회복 (아이들도 끝까지 갈 수 있게)
        if (r.hearts < 3 && e.hp > 0) {
          r.hearts++;
          this.ui.setHearts(r.hearts);
          this.ui.toast("명중! 하트 하나 회복", "good", 1.2);
        }
        break;
      case "bossPhase":
        this.ui.banner(e.k || "", e.h, e.t || "", 2.0, "danger");
        this.audio.play("roar");
        this.shake = Math.max(this.shake, 0.4);
        break;
      case "bossDown":
        if (!r) break;
        r.pts.boss += 2000;
        this.ui.bossBar({ name: this.stage.name, hp: 0, max: this.boss.maxHp });
        this.ui.banner("격파!", e.h || `${this.stage.name} 격파!`, e.t || "화산이 터져요 · 안전지대로 탈출!", 2.6, "win");
        this.audio.play("bossDown");
        this.shake = 1;
        this.world.flash = 1;
        this.startEscape();
        break;
      case "prompt":
        this.ui.prompt(e.text, e.dur || 2.2);
        break;
      case "sfx":
        this.audio.play(e.name, e.opt || {});
        break;
      case "shake":
        this.shake = Math.max(this.shake, e.k);
        break;
      case "flash":
        this.world.flash = Math.max(this.world.flash, e.k || 0.6);
        break;
      case "theme":
        // 보스 체력 단계에 따라 하늘 · 빛이 바뀜
        this.world.tint(e.theme);
        break;
    }
  }
  /** 보스를 쓰러뜨린 뒤: 용암이 깨어나 쫓아오고, 앞쪽 안전지대까지 탈출 */
  startEscape() {
    this.escape = true;
    const P = this.player;
    const fin = Math.min(this.track.len - 170, P.s + 330);
    this.finishS = fin;
    if (this.escapeZone) {
      const f = this.track.frame(fin + 12, {});
      this.escapeZone.position.set(f.x, f.y, f.z);
      this.escapeZone.rotation.y = Math.atan2(f.tx, f.tz);
      this.escapeZone.visible = true;
    }
    this.course.lava = [{ s: 0, gap: 30, k: 1.06 }];
    this.course.lavaStop = fin - 6;
    this.lava.off = false;
    this.lava.reset(P.s - 46);
    this.ui.chaseVisible(true);
    this.audio.playMusic(MUSIC.surge);
  }
  checkSections() {
    const r = this.run;
    const P = this.player;
    for (const [i, sec] of this.sections.entries()) {
      if (!r.hints.has(i) && P.s >= sec.s - 4 && P.s < sec.s + 40) {
        r.hints.add(i);
        this.ui.prompt(this.input.touchMode && sec.touch ? sec.touch : sec.hint, 3.2);
      }
    }
    // 용암이 빨라지는 구간
    const keys = this.course.lava;
    let ki = 0;
    for (let i = 0; i < keys.length; i++) if (P.s >= keys[i].s) ki = i;
    if (ki > r.lavaKey) {
      const prev = keys[r.lavaKey];
      r.lavaKey = ki;
      if (!this.lava.off && keys[ki].k > prev.k + 0.02) {
        this.ui.banner("경고!", "용암 파도가 빨라졌어요!", "부스터로 거리를 벌려요", 2.0, "danger");
        this.audio.playMusic(MUSIC.surge);
        this.rider.play("scared");
        setTimeout(() => this.state === "play" && this.rider.state === "scared" && this.rider.play("ride"), 700);
      }
    }
  }
  checkCheckpoints() {
    const r = this.run;
    for (const c of this.cps) {
      if (r.cp && r.cp.s >= c.s) continue;
      if (this.player.s >= c.s && this.player.onGround) {
        r.cp = c;
        r.snap = this.snapshot();
        c.on = true;
        c.arch.banner.material.color.set("#7aff9a");
        this.audio.play("checkpoint");
        this.ui.toast("체크포인트!", "good", 1.4);
      }
    }
  }

  /* ---------------- 도착 ---------------- */
  clear() {
    if (this.state !== "play") return;
    const r = this.run;
    this.state = "clear";
    this.clearT = 0;
    this.input.setEnabled(false);
    this.endCombo();
    r.maxS = this.finishS;
    r.pts.dist = Math.round(this.finishS - START_S);
    const par = this.stage.par || 60;
    r.pts.clear = (this.stage.boss ? 3000 : 2000) + Math.max(0, Math.round((par + 50 - r.time) * 20));
    this.rider.play("win");
    this.audio.stopMusic();
    this.audio.play("clear");
    this.ui.banner("SAFE!", this.stage.endless ? "끝까지 왔어요!" : "탈출 성공!", "용암이 절벽 아래로 쏟아져요", 2.6, "win");
    this.ui.danger(0);
    const w = this.playerWorld();
    this.fx.burst(w.x, this.player.y + 2, w.z, 60);
    const total = this.items.orbs.length;
    const got = r.orbs + r.bigs;
    const stars = this.stage.boss ? 1 + (r.heartsLost <= 1 ? 1 : 0) + (r.time <= par ? 1 : 0) : 1 + (total === 0 || got >= total * 0.6 ? 1 : 0) + (r.hits <= 1 && r.falls === 0 ? 1 : 0);
    r.stars = stars;
    if (this.stage.endless) this.clearRec = this.save.recordEndless({ score: this.score(), dist: r.maxS - START_S });
    else this.clearRec = this.save.recordStage(this.stage.id, { score: this.score(), time: r.time, stars });
    if (this.stage.id === STAGE_COUNT) this.save.recordEnding();
  }
  updateClear(dt) {
    this.clearT += dt;
    const P = this.player;
    if (this.clearT < 3 && Math.random() < dt * 4) {
      const w = this.playerWorld();
      this.fx.burst(w.x + (Math.random() - 0.5) * 10, P.y + 6 + Math.random() * 4, w.z - 8, 30, ["#ffe27a", "#7af4ff", "#ff9ad0", "#ffffff"]);
    }
    if (this.clearT > 3.4 && !this.resultShown) {
      this.resultShown = true;
      const r = this.run;
      this.ui.hud(false);
      this.audio.playMusic(this.stage.id === STAGE_COUNT ? MUSIC.ending : MUSIC.clear);
      if (this.stage.endless) {
        const E = this.save.data.endless;
        this.ui.endlessResult({ clear: true, dist: r.maxS - START_S, orbs: r.orbs + r.bigs, score: this.score(), time: r.time, rec: this.clearRec, best: E.best, bestDist: E.dist });
        return;
      }
      const b = this.save.stageBest(this.stage.id);
      const next = STAGES.find((d) => d.id === this.stage.id + 1);
      this.ui.result({ ...r, stage: this.stage, dist: r.maxS - START_S, score: this.score(), rec: this.clearRec, best: b, next, total: this.items.orbs.length, ending: this.stage.id === STAGE_COUNT });
    }
  }

  /* ================================================================
   * 보드 · 주인공 놓기 + 카메라
   * ============================================================== */
  placeRider(dt) {
    const P = this.player;
    const T = this.track;
    const f = T.frame(P.s, (this._rf = this._rf || {}));
    const w = this.playerWorld();
    const R = this.rider;
    R.group.position.copy(w);
    const sp = Math.max(1, P.speed);
    const hx = f.tx + f.rx * (P.vu / sp);
    const hz = f.tz + f.rz * (P.vu / sp);
    const yaw = Math.atan2(hx, hz);
    const slope = T.slope(P.s);
    const pitchT = P.onGround ? Math.atan(slope) : clamp(-P.vy / sp, -0.6, 0.6) * 0.8;
    this.rpitch = damp(this.rpitch ?? pitchT, pitchT, P.onGround ? 14 : 4, dt);
    this.rlean = damp(this.rlean ?? 0, this.input.steer(), 8, dt);
    R.group.rotation.set(this.rpitch, yaw, -this.rlean * 0.18, "YXZ");
    R.lean = this.rlean;
    R.speed01 = clamp(P.speed / 30, 0, 1);
    R.boost = damp(R.boost, P.boostT > 0 ? 1 : 0, 10, dt);
    R.spin = P.spinAng;
    R.update(dt);
    R.group.visible = P.invulnT <= 0 || this.state !== "play" || Math.floor(P.invulnT * 12) % 2 === 0;
    const g = T.surfaceY(P.s, P.u);
    if (g != null && this.state !== "title") {
      const h = P.y - g;
      this.blob.visible = true;
      this.blob.position.set(w.x, g + 0.04, w.z);
      this.blob.scale.setScalar(Math.max(0.45, 1.15 - h * 0.06));
      this.blob.material.opacity = Math.max(0.1, 0.45 - h * 0.03);
    } else this.blob.visible = false;
    this.focus = w;
  }
  camera(dt) {
    const cam = this.cam;
    const P = this.player;
    const T = this.track;
    const w = this.playerWorld();
    if (this.state === "title") {
      // 출발선 앞(내리막 쪽)에서 피코를 올려다봄: 얼굴 · 보드 · 뒤로 솟은 화산과 연기
      const f = T.frame(P.s, {});
      const sway = Math.sin(this.titleT * 0.25) * 1.2;
      const port = this.aspect < 0.8;
      const R = port ? 7.5 : 4.6;
      const side = port ? 2.4 : 1.6 + sway * 0.5;
      const off = port ? 0 : 2.6;
      cam.position.set(w.x + f.tx * R + f.rx * side, w.y + 1.0 + Math.sin(this.titleT * 0.3) * 0.2, w.z + f.tz * R + f.rz * side);
      cam.lookAt(w.x - f.tx * 6 + f.rx * off, w.y + (port ? 4.2 : 2.6), w.z - f.tz * 6 + f.rz * off);
      cam.fov = damp(cam.fov, 55, 4, dt);
      cam.updateProjectionMatrix();
      this.camPos.copy(cam.position);
      this.camLook.set(w.x, w.y + 1, w.z);
      return;
    }
    if (this.state === "over" && this.overCaught) {
      const f = T.frame(P.s, {});
      const want = V(w.x + f.rx * 8 + f.tx * 4, w.y + 4, w.z + f.rz * 8 + f.tz * 4);
      this.camPos.lerp(want, 1 - Math.exp(-dt * 2));
      cam.position.copy(this.camPos);
      cam.lookAt(w.x, w.y + 1, w.z);
      return;
    }
    if (this.state === "clear") {
      const a = 0.8 + this.clearT * 0.35;
      const want = V(w.x + Math.sin(a) * 7, w.y + 2.4 + this.clearT * 0.3, w.z + Math.cos(a) * 7);
      this.camPos.lerp(want, 1 - Math.exp(-dt * 3));
      cam.position.copy(this.camPos);
      cam.lookAt(w.x, w.y + 1.2, w.z);
      return;
    }
    // 3인칭 뒤 카메라: 트랙 방향을 부드럽게 따라감 · 빠를수록 시야 넓게
    const f = T.frame(P.s + 6, {});
    const fl = Math.hypot(f.tx, f.tz) || 1;
    const fx = f.tx / fl;
    const fz = f.tz / fl;
    this.camFwd = this.camFwd || V(fx, 0, fz);
    this.camFwd.x = damp(this.camFwd.x, fx, 3, dt);
    this.camFwd.z = damp(this.camFwd.z, fz, 3, dt);
    this.camFwd.normalize();
    const portrait = this.aspect < 0.8;
    const dist = (portrait ? 5.6 : 4.3) + (P.boostT > 0 ? 0.7 : 0);
    const gy0 = T.surfaceY(P.s, P.u);
    const air = P.onGround ? 0 : clamp(P.y - (gy0 ?? P.y), 0, 8);
    let hgt = (portrait ? 2.6 : 2.0) + air * 0.35;
    this.camY = this.state === "fall" ? this.camY : damp(this.camY ?? w.y, w.y, P.onGround ? 8 : 2.5, dt);
    // 터널 안: 천장에 닿지 않게
    const tun = T.tunnelAt(P.s) || T.tunnelAt(P.s - dist);
    if (tun) hgt = Math.min(hgt, tun[2] - 2.6);
    const cu = clamp(P.u * 0.7, -T.halfWidth(P.s) + 1, T.halfWidth(P.s) - 1);
    const base = T.toWorld(P.s, cu, this.camY);
    const want = V(base.x - this.camFwd.x * dist, this.camY + hgt, base.z - this.camFwd.z * dist);
    const sb = P.s - dist;
    const gy = T.surfaceY(sb, clamp(cu, -T.halfWidth(sb) + 0.5, T.halfWidth(sb) - 0.5));
    if (gy != null) want.y = Math.max(want.y, gy + 1.6);
    const look = V(w.x + this.camFwd.x * 5, this.camY + 0.9 - air * 0.15, w.z + this.camFwd.z * 5);
    // 보스 쪽을 살짝 바라봄 (보스가 화면에 들어오게)
    if (this.boss && this.boss.camHint) {
      const h = this.boss.camHint();
      if (h) look.lerp(h, 0.18);
    }
    if (this.state === "fall") {
      look.copy(w);
      want.copy(this.camPos);
    }
    this.camPos.lerp(want, 1 - Math.exp(-dt * 9));
    this.camLook.lerp(look, 1 - Math.exp(-dt * 12));
    cam.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8);
      const s = this.shake * this.shake * 0.4;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }
    cam.lookAt(this.camLook);
    const fov = 62 + clamp((P.speed - 14) / 18, 0, 1) * 10 + (P.boostT > 0 ? 5 : 0);
    cam.fov = damp(cam.fov, fov, 3, dt);
    cam.updateProjectionMatrix();
  }

  /* ---------------- HUD ---------------- */
  paintHud(force = false) {
    const r = this.run;
    if (!r) return;
    const P = this.player;
    const ui = this.ui;
    const d = this.lava.d ?? 60;
    const key = `${r.hearts}|${r.orbs + r.bigs}|${Math.round(this.score())}|${Math.round(d)}|${Math.round(P.speed)}|${Math.round((1 - P.boostCD / PH.boostCD) * 20)}|${P.boostReady}|${Math.round(r.maxS / 10)}`;
    if (!force && key === this.hudKey) return;
    this.hudKey = key;
    ui.setHearts(Math.max(0, r.hearts));
    ui.setOrbs(r.orbs + r.bigs);
    ui.setScore(this.score());
    if (!this.lava.off) ui.setChase(d);
    ui.setSpeed(P.speed);
    ui.setBoost(P.boostReady, P.boostT > 0 ? 1 : 1 - P.boostCD / PH.boostCD);
    if (this.stage.endless) ui.setDist(r.maxS - START_S);
  }
  dispose() {
    this.audio.stopMusic();
    this.audio.destroy && this.audio.destroy();
    this.unloadStage();
    this.rider.dispose();
    this.fx.dispose();
    this.renderer.dispose();
  }
}
