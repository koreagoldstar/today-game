/*
 * 🐉 드래곤 석상 대작전 · 3D 모험 진행 (3인칭 아케이드)
 *
 *  상태 (하나만 켜진다 · 바뀔 때 이전 상태의 예약 · 입력 · 공격이 남지 않게 정리):
 *   STATUE_PUZZLE → (정답) 봉인 해제 연출 → STAGE_INTRO → PLAYING ⇄ CHECKPOINT → (결승)
 *     → 보스 지역: BOSS_INTRO → BOSS_BATTLE → STAGE_CLEAR (마지막 지역은 VICTORY)
 *   하트 0 → GAME_OVER
 *   일시정지: PAUSED (멈추기 전 상태를 기억 → 풀리면 그대로 이어감 · game.paused 로 전체를 멈춘다)
 *
 *  석상 퍼즐은 짧은 입장 관문: 크기가 다른 석상 1개 (오답 · 시간 초과 = 하트 -1)
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { REGIONS, levelData } from "./levels.js?v=1";
import { Level } from "./level.js?v=1";
import { Player, PHYS } from "./player.js?v=1";
import { Enemy, Projectiles, ENEMY } from "./enemies.js?v=1";
import { Boss, BOSSES } from "./boss.js?v=1";
import { Input } from "./input.js?v=1";
import { THEMES, PLAZA } from "./world.js?v=1";
import { dotTex } from "./tex.js?v=1";
import * as L from "./layout.js?v=1";

export const STATES = ["TITLE", "CHARACTER_SELECT", "STATUE_PUZZLE", "STAGE_INTRO", "PLAYING", "PAUSED", "CHECKPOINT", "STAGE_CLEAR", "BOSS_INTRO", "BOSS_BATTLE", "GAME_OVER", "VICTORY"];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const REACH = 1.6; // 방망이가 닿는 거리

const TUT = {
  move: { key: "W A S D 또는 방향키로 달려요", touch: "왼쪽 화면을 누르고 밀어서 달려요" },
  jump: { key: "Space 로 점프! 통나무를 넘어요", touch: "점프 버튼으로 통나무를 넘어요" },
  dash: { key: "Shift 로 빠르게 대시! (대시 중엔 안 아파요)", touch: "대시 버튼으로 휙! (대시 중엔 안 아파요)" },
  attack: { key: "J 또는 마우스 클릭으로 방망이! 울타리를 부숴요", touch: "방망이 버튼으로 울타리를 부숴요" },
  enemy: { key: "빨간 표시가 보이면 피했다가, 어질어질할 때 콩!", touch: "빨간 표시가 보이면 피했다가, 어질어질할 때 콩!" },
};

export class Adventure {
  constructor(game) {
    this.g = game;
    this.state = "TITLE";
    this.st = 0;
    this.jobs = [];
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.proj = null;
    this.boss = null;
    this.run = null;
    this.rs = null;
    this.camDir = V(0, 0, -1);
    this.camPos = V(0, 5, 10);
    this.camLook = V(0, 1, 0);
    this.focusY = 0;
    this.shake = 0;
    this.prog = {};
    this.tmp = V();
    this.input = new Input({
      canvas: game.canvas,
      zone: document.getElementById("joy-zone"),
      base: document.getElementById("joy-base"),
      knob: document.getElementById("joy-knob"),
      jump: document.getElementById("btn-jump"),
      attack: document.getElementById("btn-attack"),
      dash: document.getElementById("btn-dash"),
    });
    // 발밑 그림자 (점프할 때 어디에 떨어질지 보이게)
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.32, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 2;
    this.blob.visible = false;
    game.scene.add(this.blob);
  }

  /* ================================================================
   * 상태 · 예약
   * ============================================================== */
  setState(s) {
    this.state = s;
    this.st = 0;
    this.jobs = [];
    this.input.setEnabled(s === "PLAYING" || s === "CHECKPOINT" || s === "BOSS_BATTLE");
    document.body.classList.toggle("adv-play", s === "PLAYING" || s === "CHECKPOINT" || s === "BOSS_BATTLE" || s === "BOSS_INTRO" || s === "STAGE_INTRO");
    this.g.ui.advState(s);
  }
  after(sec, fn) {
    this.jobs.push({ t: sec, fn });
  }
  /** 일시정지 (PAUSED): 지금 상태를 기억했다가 풀리면 그대로 이어간다 (예약된 일도 멈춘 채 남는다) */
  pauseOn() {
    if (this.state === "PAUSED") return;
    this.pausedFrom = this.state;
    this.state = "PAUSED";
    this.input.setEnabled(false);
    this.g.ui.advState("PAUSED");
  }
  pauseOff() {
    if (this.state !== "PAUSED") return;
    this.state = this.pausedFrom;
    this.pausedFrom = null;
    this.input.setEnabled(this.state === "PLAYING" || this.state === "CHECKPOINT" || this.state === "BOSS_BATTLE");
    this.g.ui.advState(this.state);
  }
  get region() {
    return REGIONS[this.run.idx];
  }

  /* ================================================================
   * 시작 · 정리
   * ============================================================== */
  /** 지역 시작 (석상 퍼즐부터). retry 면 퍼즐 없이 바로 모험 길 */
  start(idx, { retry = false, keepRun = false } = {}) {
    const g = this.g;
    this.cleanup();
    if (!keepRun || !this.run) this.run = { idx, score: 0, stars: 0, crystals: 0, regionsCleared: 0, start: performance.now(), unlocks: [] };
    this.run.idx = idx;
    this.rs = { crystals: 0, bigs: 0, enemies: 0, hits: 0, falls: 0, time: 0, combo: 0, comboT: 0, bestCombo: 0, score: 0, boss: false, cp: null, tutStep: null };
    this.hearts = 3;
    g.mode = "adv";
    g.ui.show(null);
    g.removeCast();
    g.swapHero(g.save.data.char);
    g.hero.setOutfit({ hat: g.save.data.hat || "none", deco: g.save.data.deco || "none" });
    g.hero.group.visible = true;
    if (retry) this.enterLevel(true);
    else this.startPuzzle();
  }
  cleanup() {
    const g = this.g;
    this.jobs = [];
    this.input.setEnabled(false);
    if (this.level) {
      this.level.dispose();
      this.level = null;
    }
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    if (this.proj) this.proj.clear();
    this.proj = null;
    if (this.boss) {
      this.boss.dispose();
      this.boss = null;
    }
    if (this.door) {
      g.scene.remove(this.door.g);
      this.door = null;
    }
    if (this.reward) {
      g.scene.remove(this.reward);
      this.reward = null;
    }
    if (this.pals) {
      for (const c of this.pals) {
        g.scene.remove(c.group);
        c.dispose();
      }
      this.pals = null;
    }
    this.blob.visible = false;
    this.player = null;
    g.view.clear();
    g.fx.reset();
    g.clearFairies();
    g.ui.advHud(false);
    g.ui.hud(false);
    g.ui.prompt(null);
    g.ui.bossBar(null);
    g.ui.combo(0);
    if (g.cursorMesh) g.cursorMesh.visible = false;
    g.hero.group.visible = true;
    g.hero.group.rotation.x = 0;
  }
  /** 모험을 떠남 (타이틀 · 캐릭터 선택으로) */
  leave() {
    this.cleanup();
    this.run = null;
    this.pausedFrom = null;
    this.state = "TITLE";
    document.body.classList.remove("adv-play");
    this.g.ui.advState("TITLE");
  }

  /* ================================================================
   * 1) 석상 퍼즐 (지역 입구의 봉인)
   * ============================================================== */
  startPuzzle() {
    const g = this.g;
    const R = this.region;
    this.setState("STATUE_PUZZLE");
    g.setTheme(R.theme);
    g.mode = "adv";
    g.phase = "busy";
    const rnd = Math.random;
    const spec = { n: 0, kind: "normal", theme: R.theme, count: R.puzzle.count, diff: R.puzzle.diff, dir: rnd() < 0.5 ? 1 : -1, types: R.puzzle.types.slice(0, R.puzzle.mix), time: R.puzzle.time, odds: 1, rounds: 1, scale: 1, safe: false, mix: R.puzzle.mix };
    g.round = { spec, idx: 0, mistakes: 0, hint: true, oddLeft: 1, timeLeft: spec.time, timeMax: spec.time, timerOn: false, adv: true };
    g.ui.hud(true);
    g.ui.setStage(`${R.no} · ${R.name}`, "봉인된 문");
    g.ui.setHearts(this.hearts);
    g.ui.setScore(this.run.score);
    g.ui.setGoal("크기가 다른 석상을 쳐서 봉인을 풀어요!");
    g.ui.setTimer(spec.time, spec.time, false);
    g.ui.setHints(0, false);
    g.layoutRound(spec, { avoid: [] });
    this.buildDoor();
    g.heroEnter();
    g.view.rise(0.07);
    g.audio.play("rise");
    g.audio.playMusic({ ...THEMES[R.theme].music, bpm: (THEMES[R.theme].music.bpm || 100) - 6, drums: "soft" });
    g.ui.banner(`지역 ${R.no}`, R.name, "봉인을 풀려면 크기가 다른 석상을 찾아요", 1.6);
    const first = !g.save.data.adv.puzzleSeen;
    this.after(1.6, () => {
      if (first) {
        g.save.data.adv.puzzleSeen = true;
        g.save.save();
        g.phase = "rule";
        g.ui.showRule(spec, `지역 ${R.no} · 봉인`);
      } else g.countIn(false);
    });
  }
  /** 퍼즐 판정 (game.judge 가 넘겨준다) */
  onPuzzleJudge(s) {
    const g = this.g;
    if (s.odd) {
      g.fx.crack(s, s.scale);
      g.audio.play("hit");
      g.addShake(0.35);
      g.vibrate(30);
      g.phase = "busy";
      g.round.timerOn = false;
      g.after(0.13, () => {
        g.view.breakStatue(s);
        if (g.cursorMesh) g.cursorMesh.visible = false;
        g.fx.shatter(s, s.scale, { power: 1.3 });
        g.ui.flash("good");
        g.audio.play("success");
        g.spawnFairy(s);
      });
      g.after(0.25, () => g.hero.play("happy", { dur: 0.9 }));
      this.run.score += 100 + Math.round((g.round.timeLeft / g.round.timeMax) * 60);
      g.ui.setScore(this.run.score);
      g.floatAt(s, "봉인 해제!", "good");
      g.after(1.1, () => this.sealCinematic());
    } else {
      g.fx.bonk(s, s.scale);
      g.view.wobble(s);
      g.audio.play("bonk");
      g.addShake(0.12);
      g.vibrate([40, 40, 40]);
      g.after(0.12, () => g.hero.play("oops"));
      s.wrong = true;
      g.fx.mark(s, s.scale, "x");
      g.ui.flash("bad");
      this.loseHeart("puzzle");
      if (this.hearts <= 0) {
        g.phase = "over";
        g.after(1.1, () => this.gameOver());
        return;
      }
      g.ui.toast("앗, 아니에요! 크기를 다시 봐요", "bad");
      g.after(0.95, () => g.beginAim());
    }
  }
  puzzleTimeout() {
    const g = this.g;
    g.phase = "busy";
    g.round.timerOn = false;
    g.audio.play("timeout");
    const odd = g.view.statues.find((s) => s.odd && !s.gone);
    if (odd) g.fx.pointAt(odd, odd.scale);
    g.hero.play("sad");
    this.loseHeart("puzzle");
    g.ui.banner("시간 초과!", "정답은 여기 있었어요", "", 1.6, "bad");
    g.after(2.2, () => {
      if (this.hearts <= 0) return this.gameOver();
      g.hero.play("idle");
      g.fx.clearMarks();
      g.view.sink();
      g.after(0.45, () => {
        const spec = { ...g.round.spec, dir: Math.random() < 0.5 ? 1 : -1 };
        g.round = { ...g.round, spec, mistakes: 0, timeLeft: spec.time, timeMax: spec.time, timerOn: false };
        g.ui.setTimer(spec.time, spec.time, false);
        g.layoutRound(spec, { avoid: [] });
        this.buildDoor();
        g.heroHome();
        g.view.rise(0.06);
        g.after(0.8, () => g.countIn(false));
      });
    });
  }
  /** 광장 뒤 커다란 봉인 문 (룬이 하나씩 켜지고 열린다) */
  buildDoor() {
    const g = this.g;
    if (this.door) g.scene.remove(this.door.g);
    const T = g.theme;
    const grp = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: T.stone, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: T.base, roughness: 0.95 });
    const z = PLAZA.cz - PLAZA.d / 2 - 1.4;
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 1.4), dark);
      p.position.set(s * 4.2, 4, 0);
      p.castShadow = true;
      grp.add(p);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(10, 1.4, 1.6), dark);
    top.position.set(0, 8.4, 0);
    grp.add(top);
    // 문 두 짝 (경첩을 기준으로 열린다)
    const leaves = [];
    const runeMats = [];
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(s * 3.5, 0, 0);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.5, 7.6, 0.5), stone);
      leaf.position.set(-s * 1.75, 3.8, 0);
      leaf.castShadow = true;
      hinge.add(leaf);
      // 룬 (반쪽 원 + 점들)
      for (let i = 0; i < 3; i++) {
        const m = new THREE.MeshBasicMaterial({ color: "#3a3a3a" });
        const r = new THREE.Mesh(new THREE.CircleGeometry(0.28, 6), m);
        r.position.set(-s * (1.0 + (i % 2) * 0.9), 2.2 + i * 1.6, 0.27);
        hinge.add(r);
        runeMats.push(m);
      }
      grp.add(hinge);
      leaves.push({ hinge, s });
    }
    const ringM = new THREE.MeshBasicMaterial({ color: "#3a3a3a" });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 8, 40), ringM);
    ring.position.set(0, 4.2, 0.3);
    grp.add(ring);
    runeMats.push(ringM);
    // 문 안쪽 빛
    const lightM = new THREE.MeshBasicMaterial({ color: "#fff6d0", transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const light = new THREE.Mesh(new THREE.PlaneGeometry(7, 7.6), lightM);
    light.position.set(0, 3.8, -0.4);
    grp.add(light);
    grp.position.set(0, 0.1, z);
    g.scene.add(grp);
    this.door = { g: grp, leaves, runeMats, lightM, z, open: 0 };
  }
  /** 봉인 해제: 룬이 켜짐 → 문이 열림 → 카메라가 문 안으로 → 하얗게 → 모험 길 */
  sealCinematic() {
    const g = this.g;
    const D = this.door;
    g.phase = "busy";
    g.ui.hud(false);
    g.camMode = "cine";
    const accent = g.theme.crystal;
    D.runeMats.forEach((m, i) =>
      this.after(0.12 * i, () => {
        m.color.set(accent);
        g.audio.play("tap");
      })
    );
    this.after(0.9, () => {
      g.audio.play("seal");
      g.audio.play("rise");
      D.opening = true;
    });
    this.after(2.3, () => g.ui.fade(true));
    this.after(2.8, () => this.enterLevel(false));
    this.cine = { t: 0, from: g.camCur.pos.clone(), fromT: g.camCur.tgt.clone() };
  }

  /* ================================================================
   * 2) 모험 길
   * ============================================================== */
  enterLevel(retry) {
    const g = this.g;
    const R = this.region;
    this.cleanupLevelOnly();
    g.view.clear();
    g.fx.reset();
    g.ui.hud(false);
    g.round = null;
    g.phase = "";
    const T = g.world.setTheme(R.theme, "level");
    g.theme = T;
    g.fx.setTheme(T);
    const data = levelData(R);
    this.level = new Level(g.scene, g.fx, data, T, { quality: g.level === "low" ? 0.6 : 1 });
    this.enemies = this.level.enemiesData.map((d) => new Enemy(d.kind, d, this.level, this.level.root));
    this.proj = new Projectiles(this.level.root, g.fx);
    this.player = new Player(g.hero, this.level);
    const st = data.start;
    this.spawn = { p: V(st.x, st.y, st.z), yaw: st.yaw };
    this.player.spawn(this.spawn.p, st.yaw);
    this.player.frozen = true;
    this.blob.visible = true;
    this.rs.cp = null;
    this.rs.time = 0;
    // 카메라: 주인공 뒤에서 시작
    this.camDir.set(Math.sin(st.yaw), 0, Math.cos(st.yaw));
    this.focusY = st.y;
    this.placeCamera(1, true);
    g.camMode = "adv";
    g.audio.playMusic(T.music);
    g.ui.fade(false);
    g.ui.advHud(true);
    g.ui.advSet({ region: `${R.no} · ${R.name}`, hearts: this.hearts, gems: 0, gemTotal: this.level.crystals.filter((c) => !c.big).length, prog: 0 });
    this.setState("STAGE_INTRO");
    const goal = Math.ceil(this.level.crystals.filter((c) => !c.big).length * R.crystalGoal);
    this.gemGoal = goal;
    g.ui.stageIntro({ no: R.no, name: R.name, en: R.en, intro: R.intro, tier: R.tier, goals: [`결승까지 가기`, `수정 ${goal}개 모으기`, `실수(맞기 · 떨어지기) ${R.misses}번 이하`], boss: BOSSES[R.boss] ? BOSSES[R.boss].name : null });
    g.audio.play("enter");
    this.after(retry ? 1.6 : 2.6, () => this.beginPlay());
  }
  cleanupLevelOnly() {
    if (this.level) {
      this.level.dispose();
      this.level = null;
    }
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    if (this.boss) {
      this.boss.dispose();
      this.boss = null;
    }
    if (this.door) {
      this.g.scene.remove(this.door.g);
      this.door = null;
    }
  }
  beginPlay() {
    const g = this.g;
    if (this.state !== "STAGE_INTRO") return;
    g.ui.stageIntro(null);
    this.player.frozen = false;
    this.setState("PLAYING");
    g.ui.toast("출발!", "good", 1.2);
    // 처음이면 연습 안내 (지역 1)
    if (this.run.idx === 0 && !g.save.data.adv.tutorial) {
      this.tutorial = { on: true, step: null, moved: 0, done: {} };
      this.tutShow("move"); // 출발하자마자 '이동'부터 (구역에 들어가기 전에도 보이게)
    } else this.tutorial = null;
  }
  /** 주인공이 맞음 */
  hurtPlayer(from) {
    if (!this.player || this.player.dead) return;
    if (!this.player.hurt(from)) return;
    this.rs.hits++;
    this.g.audio.play("hurt");
    this.g.ui.flash("bad");
    this.g.vibrate([60]);
    this.shake = Math.max(this.shake, 0.35);
    this.endCombo();
    this.loseHeart("hit");
    if (this.hearts <= 0) this.gameOver();
  }
  loseHeart(why) {
    this.hearts = Math.max(0, this.hearts - 1);
    this.g.ui.setHearts(this.hearts, 3, this.hearts);
    this.g.ui.advSet({ hearts: this.hearts, broke: this.hearts });
    this.g.after(0.12, () => this.g.audio.play("heart"));
  }
  /** 떨어짐: 낙하 → 가까운 체크포인트로 (하트 -1) */
  fell() {
    const g = this.g;
    const P = this.player;
    if (P.dead || (this.state === "CHECKPOINT" && this.respawning)) return;
    // 보스를 이긴 뒤 · 결과 연출 중에는 떨어져도 조용히 제자리로 (하트 · 상태 그대로)
    if (this.rs.boss || !["PLAYING", "CHECKPOINT", "BOSS_BATTLE"].includes(this.state)) {
      const A = this.level.arena;
      if (A) P.spawn(A.c.clone(), P.yaw);
      return;
    }
    this.respawning = true;
    this.rs.falls++;
    P.frozen = true;
    g.audio.play(this.level.data.under === "water" || this.level.data.under === "icewater" ? "splash" : "fall");
    this.endCombo();
    this.loseHeart("fall");
    if (this.hearts <= 0) {
      this.respawning = false;
      return this.gameOver();
    }
    g.ui.fade(true);
    this.setState("CHECKPOINT");
    this.after(0.45, () => {
      const cp = this.rs.cp;
      const p = cp ? cp.p.clone() : this.spawn.p.clone();
      const yaw = cp ? cp.yaw : this.spawn.yaw;
      P.spawn(p, yaw);
      P.hurtT = 1.4;
      this.camDir.set(Math.sin(yaw), 0, Math.cos(yaw));
      this.focusY = p.y;
      this.placeCamera(1, true);
      g.ui.fade(false);
      g.ui.toast("체크포인트에서 다시 출발!", "", 1.4);
    });
    this.after(0.7, () => {
      P.frozen = false;
      this.respawning = false;
      P.char.play("checkpoint");
    });
    this.after(1.1, () => {
      if (this.state === "CHECKPOINT") this.setState(this.boss ? "BOSS_BATTLE" : "PLAYING");
    });
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  update(dt) {
    const g = this.g;
    this.st += dt;
    if (this.jobs.length) {
      const due = [];
      for (const j of this.jobs) {
        j.t -= dt;
        if (j.t <= 0) due.push(j);
      }
      if (due.length) {
        this.jobs = this.jobs.filter((j) => j.t > 0);
        for (const j of due) j.fn();
      }
    }
    const s = this.state;
    if (s === "STATUE_PUZZLE") {
      this.updateDoor(dt);
      return;
    }
    if (!this.player || !this.level) return;
    const P = this.player;
    const active = s === "PLAYING" || s === "CHECKPOINT" || s === "BOSS_BATTLE";
    // 입력 → 카메라 기준 방향
    let wish = { x: 0, z: 0, mag: 0 };
    let f = {};
    if (active && !P.dead) {
      const m = this.input.move();
      const fx = this.camDir.x;
      const fz = this.camDir.z;
      const fl = Math.hypot(fx, fz) || 1;
      const ux = fx / fl;
      const uz = fz / fl;
      // 오른쪽 = (-uz, ux)
      wish.x = ux * m.y + -uz * m.x;
      wish.z = uz * m.y + ux * m.x;
      wish.mag = Math.min(1, Math.hypot(wish.x, wish.z));
      f = this.input.consume();
    } else this.input.consume();
    const pev = P.update(dt, wish, f, this.input.jumpHeld);
    if (active) {
      if (s !== "CHECKPOINT" || !this.respawning) {
        if (pev.jump) {
          g.audio.play("jump");
          this.tutDone("jump");
        }
        if (pev.land) {
          g.fx.landDust(P.pos.x, P.pos.y, P.pos.z, 0.6 + pev.land);
          g.audio.play("land", { k: pev.land });
        }
        if (pev.dash) {
          g.audio.play("dash");
          g.fx.puff(P.pos.x, P.pos.y + 0.1, P.pos.z, 0.6, 2);
          this.tutDone("dash");
        }
        if (pev.attack) {
          g.audio.play("swing");
          this.tutDone("attackSwing");
        }
        if (pev.fall) this.fell();
      }
      if (this.tutorial && this.tutorial.step === "move" && wish.mag > 0.3) {
        this.tutorial.moved += dt;
        if (this.tutorial.moved > 0.8) this.tutDone("move");
      }
    }
    // 방망이 판정 (모션의 '맞는 순간'에만)
    if (P.char.attackActive) this.attackHits();
    // 레벨 (움직이는 것 · 수집 · 위험)
    const lev = this.level.update(dt, P.dead ? null : P);
    for (const e of lev) this.onLevelEvent(e);
    // 적 · 날아오는 것
    for (const en of this.enemies) {
      if (!en.alive && en.state === "gone") continue;
      // 멀리 있는 적은 잠깐 쉰다 (성능)
      if (Math.abs(en.pos.z - P.pos.z) + Math.abs(en.pos.x - P.pos.x) > 45) continue;
      const evs = en.update(dt, P);
      for (const e of evs) {
        if (e.type === "hurt" && active) this.hurtPlayer(e.from);
        else if (e.type === "bump" && active) P.push(e.from, 2.5);
        else if (e.type === "shoot") {
          this.proj.spawn(e.kind, e.from, e.to);
          g.audio.play(e.kind === "bubble" ? "bubble" : "fireball");
        } else if (e.type === "warn") g.audio.play("warn");
        else if (e.type === "impact") {
          g.fx.puff(e.p.x, e.p.y, e.p.z, 1, 4);
          g.audio.play("thud");
        }
      }
    }
    const ph = this.proj.update(dt, P, this.level);
    if (active) for (const h of ph) this.hurtPlayer(h.from);
    // 보스
    if (this.boss) this.updateBoss(dt);
    // 콤보 시간
    if (this.rs.comboT > 0) {
      this.rs.comboT -= dt;
      if (this.rs.comboT <= 0) this.endCombo();
    }
    // 시간 · 진행
    if (s === "PLAYING" || s === "BOSS_BATTLE" || s === "CHECKPOINT") this.rs.time += dt;
    this.level.progress(P.pos, this.prog);
    if (!this.boss) g.ui.advSet({ prog: this.prog.k });
    // 발밑 그림자
    const gr = this.level.ground(P.pos.x, P.pos.z, 0.2, P.pos.y + 0.05);
    if (gr) {
      const hgt = P.pos.y - gr.h;
      this.blob.position.set(P.pos.x, gr.h + 0.03, P.pos.z);
      this.blob.scale.setScalar(Math.max(0.4, 1 - hgt * 0.12));
      this.blob.material.opacity = Math.max(0.08, 0.34 - hgt * 0.05);
      this.blob.visible = !P.dead;
    } else this.blob.visible = false;
    // 체크포인트 상태는 잠깐
    if (s === "CHECKPOINT" && !this.respawning && this.st > 0.9) this.setState(this.boss ? "BOSS_BATTLE" : "PLAYING");
    // 카메라
    if (g.camMode === "adv") this.placeCamera(dt, false);
    // 먼 배경 · 그림자가 따라온다
    g.world.update(0, P.pos);
    // 보상 수정 빙글
    if (this.reward) {
      this.reward.rotation.y += dt * 1.5;
      this.reward.position.y = this.reward.userData.y + Math.sin(performance.now() / 400) * 0.2;
    }
    if (this.pals) for (const c of this.pals) c.update(dt);
  }
  updateDoor(dt) {
    const D = this.door;
    const g = this.g;
    if (!D) return;
    if (D.opening && D.open < 1) {
      D.open = Math.min(1, D.open + dt * 0.75);
      const k = ease(D.open);
      for (const l of D.leaves) l.hinge.rotation.y = l.s * k * 1.7;
      D.lightM.opacity = k * 0.85;
      g.addShake(0.02);
    }
    if (this.cine) {
      this.cine.t += dt;
      const k = ease(Math.min(1, this.cine.t / 2.6));
      const doorC = V(0, 4, D.z);
      const camEnd = V(0, 3.4, D.z + 7);
      g.camCur.pos.lerpVectors(this.cine.from, camEnd, k);
      g.camCur.tgt.lerpVectors(this.cine.fromT, doorC, k);
      g.cam.position.copy(g.camCur.pos);
      g.cam.lookAt(g.camCur.tgt);
    }
  }

  /** 3인칭 카메라: 길 방향을 따라 부드럽게 · 벽에 파묻히지 않게 · 점프해도 화면 안에 */
  placeCamera(dt, snap) {
    const g = this.g;
    const P = this.player;
    const portrait = g.aspect < 0.8;
    const cam = g.cam;
    let dist = portrait ? 8.6 : 6.8;
    let height = portrait ? 4.2 : 3.2;
    const fov = portrait ? 64 : 55;
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const want = V();
    if (this.boss && this.boss.state !== "dead" && (this.state === "BOSS_BATTLE" || this.state === "CHECKPOINT")) {
      // 보스전: 주인공 뒤에서 보스 쪽을 본다
      want.set(this.boss.pos.x - P.pos.x, 0, this.boss.pos.z - P.pos.z);
      const sep = want.length();
      want.normalize();
      dist += clamp(sep - 6, 0, 8) * 0.35 + 1.4;
      height += 1.4;
    } else {
      // 길 방향 + 앞쪽 몇 m (커브를 미리 보여 준다)
      const pr = this.prog;
      if (pr.dx !== undefined) {
        const al = Math.hypot(pr.ax, pr.az) || 1;
        want.set(pr.dx * 0.55 + (pr.ax / al) * 0.45, 0, pr.dz * 0.55 + (pr.az / al) * 0.45);
        if (want.lengthSq() < 0.01) want.copy(this.camDir);
        want.normalize();
      } else want.copy(this.camDir);
    }
    const k = snap ? 1 : 1 - Math.exp(-dt * 2.6);
    this.camDir.lerp(want, k).normalize();
    // 높이: 점프할 때는 천천히, 너무 벗어나면 따라간다
    const fyRate = P.onGround ? 5 : 1.6;
    this.focusY = snap ? P.pos.y : lerp(this.focusY, P.pos.y, 1 - Math.exp(-dt * fyRate));
    this.focusY = clamp(this.focusY, P.pos.y - 1.6, P.pos.y + 1.2);
    const focus = V(P.pos.x, this.focusY + 1.0, P.pos.z);
    const back = V(-this.camDir.x * dist, height, -this.camDir.z * dist);
    const dir = back.clone().normalize();
    const len = back.length();
    const hit = this.level.ray(focus, dir, len);
    const d = Math.max(1.6, hit < len ? hit - 0.35 : len);
    const pos = focus.clone().addScaledVector(dir, d);
    // 보스 경기장: 카메라가 둘레 벽 · 기둥 밖으로 나가지 않게
    const A = this.level.arena;
    if (A && this.boss && Math.hypot(P.pos.x - A.c.x, P.pos.z - A.c.z) < A.r + 1) {
      const ox = pos.x - A.c.x;
      const oz = pos.z - A.c.z;
      const r = Math.hypot(ox, oz);
      const lim = A.r + 1.5;
      if (r > lim) {
        pos.x = A.c.x + (ox / r) * lim;
        pos.z = A.c.z + (oz / r) * lim;
        pos.y += (r - lim) * 0.5;
      }
    }
    let look = focus.clone().addScaledVector(this.camDir, 2.4);
    if (this.boss && this.boss.state !== "dead" && this.state === "BOSS_BATTLE") look = focus.clone().lerp(this.boss.focus(), 0.35);
    const kp = snap ? 1 : 1 - Math.exp(-dt * 7);
    this.camPos.lerp(pos, kp);
    this.camLook.lerp(look, snap ? 1 : 1 - Math.exp(-dt * 9));
    cam.position.copy(this.camPos);
    if (this.shake > 0 && !g.calm) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.3;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    } else this.shake = 0;
    cam.lookAt(this.camLook);
  }

  /* ---------------- 방망이 판정 ---------------- */
  attackHits() {
    const g = this.g;
    const P = this.player;
    const set = P.char.atkHit;
    const o = P.pos;
    const fwd = P.fwd;
    // 적
    for (const e of this.enemies) {
      if (!e.hittable || set.has(e)) continue;
      const c = e.center(this.tmp);
      const dx = c.x - o.x;
      const dz = c.z - o.z;
      const d = Math.hypot(dx, dz);
      if (d > REACH + e.S.radius * 0.6 || Math.abs(c.y - (o.y + 0.6)) > 1.5) continue;
      if (d > 0.6 && (dx * fwd.x + dz * fwd.z) / d < 0.3) continue;
      set.add(e);
      const r = e.hit(o);
      if (!r) continue;
      g.fx.hitSpark(c.clone());
      g.audio.play(r === "defeat" ? "defeat" : "enemyHit");
      this.shake = Math.max(this.shake, 0.15);
      if (r === "defeat") {
        this.rs.enemies++;
        this.addScore(e.S.score, c);
        this.bumpCombo(c);
        g.fx.sparkle(c.clone(), 24);
        this.tutDone("enemy");
      }
    }
    // 부서지는 것 · 스위치
    for (const h of this.level.hitTest(o, fwd, REACH)) {
      if (set.has(h.b || h.s)) continue;
      set.add(h.b || h.s);
      if (h.kind === "break") {
        this.level.breakIt(h.b);
        g.audio.play("break");
        this.addScore(20, h.b.p);
        if (h.b.loot === "heart") {
          if (this.hearts < 3) {
            this.hearts++;
            g.ui.advSet({ hearts: this.hearts });
            g.audio.play("reward");
            g.floatAt({ x: h.b.p.x, y: h.b.p.y, z: h.b.p.z, scale: 1 }, "하트 +1", "good");
          } else this.addScore(50, h.b.p);
        } else {
          // 상자 안 수정: 주인공에게 날아와 바로 모인다
          this.gainGems(3, h.b.p);
        }
        this.tutDone("attack");
      } else if (h.kind === "switch") {
        this.level.pressSwitch(h.s);
        g.audio.play("seal");
        g.ui.toast("철컥! 문이 열렸어요", "good", 1.4);
        g.fx.sparkle(h.s.p.clone(), 20, ["#7aff9a", "#ffffff"]);
      }
    }
    // 날아오는 것 받아치기
    if (this.proj.batHit(o, fwd, REACH)) {
      g.audio.play("enemyHit");
      this.addScore(15, o);
      this.bumpCombo(o.clone().setY(o.y + 1));
    }
    // 보스 약점
    if (this.boss && !set.has(this.boss) && this.boss.tryHit(P, fwd)) {
      set.add(this.boss);
      g.audio.play("bossHit");
      this.shake = Math.max(this.shake, 0.5);
      g.vibrate([40]);
      this.addScore(100, this.boss.weakPos());
      g.ui.bossBar({ name: this.boss.B.name, hp: this.boss.hp, max: this.boss.maxHp });
      if (this.boss.state === "dying") this.bossDefeated();
      else g.ui.toast(this.boss.tiredHits >= 2 ? "다시 일어나요! 조심!" : "콩! 한 번 더!", "good", 1);
    }
  }

  /* ---------------- 레벨 일 ---------------- */
  onLevelEvent(e) {
    const g = this.g;
    const P = this.player;
    switch (e.type) {
      case "crystal": {
        const c = e.c;
        if (c.big) {
          this.rs.bigs++;
          this.addScore(100, c.p);
          g.audio.play("bigGem");
          g.fx.sparkle(c.p.clone(), 40, [this.level.gemColor, "#ffffff", "#ffe27a"]);
          g.ui.toast("큰 수정 발견!", "good", 1.2);
        } else {
          this.rs.crystals++;
          this.run.crystals++;
          this.addScore(10, null);
          this.bumpCombo(c.p);
          g.audio.play("gem", { n: this.rs.combo });
          g.fx.sparkle(c.p.clone(), 10, [this.level.gemColor, "#ffffff"]);
        }
        g.ui.advSet({ gems: this.rs.crystals });
        break;
      }
      case "heart":
        if (this.hearts < 3) {
          this.hearts++;
          g.ui.advSet({ hearts: this.hearts });
          g.audio.play("reward");
        } else this.addScore(50, e.p);
        g.fx.sparkle(e.p.clone(), 20, ["#ff5a7a", "#ffffff"]);
        break;
      case "checkpoint": {
        this.rs.cp = e.cp;
        g.audio.play("checkpoint");
        g.fx.sparkle(e.cp.p.clone().setY(e.cp.p.y + 1.5), 30, [this.level.P.accent, "#ffffff"]);
        g.ui.toast("체크포인트!", "good", 1.3);
        if (P.onGround && Math.hypot(P.vel.x, P.vel.z) < 2) P.char.play("checkpoint");
        if (this.state === "PLAYING") this.setState("CHECKPOINT");
        if (this.tutorial) this.finishTutorial();
        break;
      }
      case "tut":
        this.tutShow(e.step);
        break;
      case "goal":
        if (e.boss && this.level.arena) this.bossIntro();
        else this.stageClear();
        break;
      case "hurt":
        if (this.state === "PLAYING" || this.state === "CHECKPOINT" || this.state === "BOSS_BATTLE") this.hurtPlayer(e.from);
        break;
      case "warn":
        if (P && e.p && P.pos.distanceTo(e.p) < 16) g.audio.play(e.sub === "fire" ? "fireWarn" : e.sub === "wind" ? "wind" : "warn");
        break;
      case "jetFire":
        if (P && P.pos.distanceTo(e.p) < 14) g.audio.play(e.sub === "fire" ? "flame" : "geyser");
        break;
      case "crumble":
        g.audio.play("crumble");
        break;
      case "thud":
        if (P && P.pos.distanceTo(e.p) < 14) g.audio.play("thud");
        break;
    }
  }
  addScore(n, p) {
    this.rs.score += n;
    this.run.score += n;
    this.g.ui.setScore(this.run.score);
    if (p && n >= 20) this.g.floatAt({ x: p.x, y: p.y, z: p.z, scale: 0.6 }, `+${n}`, "good");
  }
  /** 상자 · 적에서 나온 수정 (바로 모인다) */
  gainGems(n, p) {
    for (let i = 0; i < n; i++) {
      this.after(i * 0.08, () => {
        this.rs.crystals++;
        this.run.crystals++;
        this.addScore(10, null);
        this.bumpCombo(p);
        this.g.audio.play("gem", { n: this.rs.combo });
        this.g.ui.advSet({ gems: this.rs.crystals });
      });
    }
    this.g.fx.sparkle(p.clone(), 20, [this.level.gemColor, "#ffffff"]);
  }
  bumpCombo(p) {
    const r = this.rs;
    r.combo++;
    r.comboT = 2.2;
    r.bestCombo = Math.max(r.bestCombo, r.combo);
    if (r.combo >= 3) {
      this.g.ui.combo(r.combo, r.combo >= 10 ? "최고예요!" : r.combo >= 5 ? "대단해요!" : "좋아요!");
      if (r.combo % 5 === 0) {
        this.g.audio.play("combo", { n: r.combo });
        this.g.fx.sparkle(this.player.pos.clone().setY(this.player.pos.y + 1.2), 24);
      }
    }
  }
  endCombo() {
    const r = this.rs;
    if (!r) return;
    if (r.combo >= 3) {
      const bonus = r.combo * 5;
      this.addScore(bonus, null);
      this.g.ui.toast(`콤보 ${r.combo} 끝! +${bonus}점`, "", 1.2);
    }
    r.combo = 0;
    r.comboT = 0;
    this.g.ui.combo(0);
  }

  /* ---------------- 연습 안내 (처음 한 번 · 실제로 해 보며) ---------------- */
  tutShow(step) {
    if (!this.tutorial) return;
    if (this.tutorial.done[step]) return;
    this.tutorial.step = step;
    const touch = this.input.touchMode;
    this.g.ui.prompt(TUT[step][touch ? "touch" : "key"], step);
  }
  tutDone(what) {
    const T = this.tutorial;
    if (!T || !T.step) return;
    const map = { move: "move", jump: "jump", dash: "dash", attack: "attack", enemy: "enemy" };
    if (map[what] !== T.step) return;
    T.done[T.step] = true;
    T.step = null;
    this.g.ui.prompt(null);
    this.g.audio.play("checkpoint");
    this.g.ui.toast("잘했어요!", "good", 0.9);
    if (T.done.move && T.done.jump && T.done.dash && T.done.attack && T.done.enemy) this.finishTutorial();
  }
  /** 연습 끝 (다섯 가지를 다 했거나, 첫 체크포인트까지 왔으면) → 다음부터는 안내 없음 */
  finishTutorial() {
    this.g.save.data.adv.tutorial = true;
    this.g.save.save();
    this.tutorial = null;
    this.g.ui.prompt(null);
  }

  /* ================================================================
   * 3) 보스
   * ============================================================== */
  bossIntro() {
    const g = this.g;
    const A = this.level.arena;
    const P = this.player;
    this.setState("BOSS_INTRO");
    P.frozen = true;
    // 경기장 입구 안쪽으로 (문은 뒤에서 닫힌다)
    const entry = A.entry || A.c.clone();
    const toC = V(A.c.x - entry.x, 0, A.c.z - entry.z).normalize();
    const start = V(A.c.x - toC.x * (A.r - 3), A.c.y, A.c.z - toC.z * (A.r - 3));
    g.ui.fade(true);
    this.after(0.4, () => {
      // 결승 문은 이제 필요 없다 (카메라를 가리지 않게)
      if (this.level.goal) this.level.goal.grp.visible = false;
      P.spawn(start, Math.atan2(toC.x, toC.z));
      P.frozen = true;
      this.boss = new Boss(A.bossKind || this.region.boss, A, g.scene, g.fx, { calm: g.calm });
      this.boss.pos.set(A.c.x + toC.x * 3, A.c.y, A.c.z + toC.z * 3);
      this.boss.yaw = Math.atan2(-toC.x, -toC.z);
      this.rs.cp = { p: start.clone(), yaw: P.yaw };
      // 다른 적 · 날아오는 것 정리
      for (const e of this.enemies) e.state === "gone" || (e.state = "gone", (e.mesh.visible = false));
      this.proj.clear();
      g.ui.fade(false);
      g.camMode = "cine";
      g.audio.stopMusic();
    });
    this.after(1.0, () => {
      this.boss.wake();
      g.audio.play("rumble");
    });
    this.after(2.3, () => {
      g.ui.banner("BOSS", this.boss.B.name, "지치면 이마의 수정이 빛나요. 그때 방망이로 콩!", 2.4, "boss");
      g.audio.playMusic({ ...g.theme.music, drums: "boss", bpm: (g.theme.music.bpm || 100) + 14, prog: "boss" });
    });
    this.after(4.4, () => {
      P.frozen = false;
      g.camMode = "adv";
      this.camDir.set(this.boss.pos.x - P.pos.x, 0, this.boss.pos.z - P.pos.z).normalize();
      this.placeCamera(1, true);
      this.setState("BOSS_BATTLE");
      g.ui.bossBar({ name: this.boss.B.name, hp: this.boss.hp, max: this.boss.maxHp });
    });
    this.bossCine = { t: 0 };
  }
  updateBoss(dt) {
    const g = this.g;
    const B = this.boss;
    const P = this.player;
    // 보스 등장 연출 카메라
    if (this.state === "BOSS_INTRO" && g.camMode === "cine" && this.bossCine) {
      this.bossCine.t += dt;
      const k = ease(Math.min(1, this.bossCine.t / 3.2));
      const head = B.focus();
      const side = V(Math.cos(B.yaw), 0, -Math.sin(B.yaw));
      const fwd = V(Math.sin(B.yaw), 0, Math.cos(B.yaw));
      const camA = head.clone().addScaledVector(fwd, 9).addScaledVector(side, 4).add(V(0, 1.5, 0));
      const camB = head.clone().addScaledVector(fwd, 12).addScaledVector(side, -2).add(V(0, 3, 0));
      g.cam.position.lerpVectors(camA, camB, k);
      g.cam.lookAt(head.clone().add(V(0, 1.2 - k * 0.6, 0)));
      this.camPos.copy(g.cam.position);
    }
    const evs = B.update(dt, P);
    const fighting = this.state === "BOSS_BATTLE" || this.state === "CHECKPOINT";
    for (const e of evs) {
      if (e.type === "hurt" && fighting) this.hurtPlayer(e.from);
      else if (e.type === "bump" && fighting) P.push(e.from, e.strength || 3);
      else if (e.type === "warn") g.audio.play(e.p === "charge" ? "bossCharge" : "bossWarn");
      else if (e.type === "slam") {
        g.audio.play("slam");
        this.shake = Math.max(this.shake, 0.6);
      } else if (e.type === "crash") {
        g.audio.play("crash");
        this.shake = Math.max(this.shake, 0.7);
        g.ui.toast("어질어질! 이마 수정을 콩!", "good", 1.6);
      } else if (e.type === "tired") g.ui.toast("지쳤어요! 이마 수정을 콩!", "good", 1.6);
      else if (e.type === "roar") g.audio.play("roar");
      else if (e.type === "swoosh") g.audio.play("swing");
      else if (e.type === "thud") g.audio.play("thud");
      else if (e.type === "wake") g.audio.play("hit");
      else if (e.type === "dead") this.bossDead(e.p);
    }
  }
  bossDefeated() {
    const g = this.g;
    g.audio.stopMusic();
    g.audio.play("roar");
    this.player.frozen = true;
    this.rs.boss = true;
    g.ui.bossBar(null);
    g.ui.toast("해냈어요!", "good", 1.6);
  }
  bossDead(p) {
    const g = this.g;
    const P = this.player;
    g.audio.play("bossDown");
    this.shake = 0.9;
    // 거대한 수정 보상 + 드래곤 알
    const grp = new THREE.Group();
    const gemM = new THREE.MeshStandardMaterial({ color: this.level.gemColor, emissive: this.level.gemColor, emissiveIntensity: 0.8, roughness: 0.05, metalness: 0.3, flatShading: true });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), gemM);
    gem.scale.set(1, 1.5, 1);
    grp.add(gem);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: this.level.gemColor, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(5);
    grp.add(halo);
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), new THREE.MeshStandardMaterial({ color: this.boss.B.accent, roughness: 0.35, emissive: this.boss.B.accent, emissiveIntensity: 0.25 }));
    egg.scale.set(1, 1.3, 1);
    egg.position.set(1.8, -1.2, 0);
    grp.add(egg);
    grp.position.set(p.x, p.y + 1.5, p.z);
    grp.userData.y = p.y + 1.5;
    g.scene.add(grp);
    this.reward = grp;
    g.fx.sparkle(p.clone(), 80, [this.level.gemColor, "#ffffff", "#ffe27a"]);
    // 주인공 축하
    this.after(0.8, () => {
      P.char.faceTo = Math.atan2(p.x - P.pos.x, p.z - P.pos.z);
      P.char.play("celebrate", { dur: 99 });
      g.audio.play("win");
    });
    const last = this.run.idx === REGIONS.length - 1;
    this.after(3.4, () => (last ? this.victory() : this.stageClear()));
  }

  /* ================================================================
   * 4) 지역 완료 · 게임 오버 · 승리
   * ============================================================== */
  computeResult() {
    const R = this.region;
    const rs = this.rs;
    const misses = rs.hits + rs.falls;
    const gemOk = rs.crystals >= this.gemGoal;
    const missOk = misses <= R.misses;
    const stars = 1 + (gemOk ? 1 : 0) + (missOk ? 1 : 0);
    const par = 60 + this.level.pathLen[this.level.pathLen.length - 1] * 0.35;
    const timeBonus = Math.max(0, Math.round((par - rs.time) * 4));
    return { stars, gemOk, missOk, misses, timeBonus };
  }
  stageClear() {
    const g = this.g;
    if (this.state === "STAGE_CLEAR") return;
    const P = this.player;
    this.setState("STAGE_CLEAR");
    P.frozen = true;
    P.char.play("celebrate", { dur: 99 });
    g.audio.stopMusic();
    g.audio.play("clear");
    g.ui.bossBar(null);
    g.ui.prompt(null);
    this.endCombo();
    const res = this.computeResult();
    this.addScore(res.timeBonus + res.stars * 100, null);
    this.run.stars += res.stars;
    this.run.regionsCleared++;
    const rewards = this.g.saveRegionClear(this.region, this.rs, res, this.run);
    this.after(1.6, () =>
      g.ui.advResult({
        kind: "clear",
        region: this.region,
        res,
        rs: this.rs,
        run: this.run,
        gemGoal: this.gemGoal,
        gemTotal: this.level.crystals.filter((c) => !c.big).length,
        best: g.save.data.adv.regions[this.region.id],
        rewards,
        hasNext: this.run.idx < REGIONS.length - 1,
      })
    );
  }
  gameOver() {
    const g = this.g;
    if (this.state === "GAME_OVER") return;
    this.setState("GAME_OVER");
    g.audio.stopMusic();
    g.audio.play("over");
    g.ui.prompt(null);
    g.ui.bossBar(null);
    this.endCombo();
    if (this.player) {
      this.player.frozen = true;
      this.player.dead = true;
      this.player.char.play("defeat");
    } else g.hero.play("sad");
    const rewards = g.saveRunEnd(this.run, false);
    this.after(1.8, () =>
      g.ui.advResult({
        kind: "over",
        region: this.region,
        rs: this.rs,
        run: this.run,
        gemTotal: this.level ? this.level.crystals.filter((c) => !c.big).length : 0,
        best: g.save.data.adv.regions[this.region.id],
        rewards,
      })
    );
  }
  victory() {
    const g = this.g;
    this.stageClearSave = true;
    const res = this.computeResult();
    this.addScore(res.timeBonus + res.stars * 100 + 1000, null);
    this.run.stars += res.stars;
    this.run.regionsCleared++;
    const rewards = g.saveRegionClear(this.region, this.rs, res, this.run);
    rewards.push(...g.saveRunEnd(this.run, true));
    this.setState("VICTORY");
    g.audio.play("win");
    // 친구들이 모두 와서 축하
    const P = this.player;
    this.pals = [];
    const others = ["chick", "bear", "bunny", "otter"].filter((id) => id !== g.hero.def.id);
    others.forEach((id, i) => {
      const c = new g.CharacterClass(id, "wood");
      const a = P.yaw + Math.PI + (i - 1) * 0.6;
      c.pos.set(P.pos.x + Math.sin(a) * 2.2, P.pos.y, P.pos.z + Math.cos(a) * 2.2);
      c.faceTo = c.face = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z);
      c.play("celebrate", { dur: 99 });
      g.scene.add(c.group);
      this.pals.push(c);
    });
    g.ui.banner("VICTORY", "드래곤 마스터!", "모든 지역의 봉인을 풀었어요", 3, "boss");
    this.after(3.4, () =>
      g.ui.advResult({
        kind: "victory",
        region: this.region,
        res,
        rs: this.rs,
        run: this.run,
        gemGoal: this.gemGoal,
        gemTotal: this.level.crystals.filter((c) => !c.big).length,
        best: g.save.data.adv.regions[this.region.id],
        rewards,
      })
    );
  }
}
