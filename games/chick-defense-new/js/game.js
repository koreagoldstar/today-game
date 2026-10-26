/*
 * NEW 둥지디펜스 · 게임 진행 (시뮬레이션 · 3D 장면 · 화면 · 소리 · 입력 · 저장을 잇는 곳)
 *  고정 걸음(1/60초)으로만 전투가 흐름: 배속 = 한 프레임에 여러 걸음 · 멈춤 = 걸음 없음
 *  탭이 숨었다 돌아와도 한 프레임 최대 0.1초만 진행 (적이 순간이동하거나 타워가 몰아 쏘지 않음)
 */
import { Sim, DT } from "./sim/sim.js";
import { statsOf } from "./sim/towers.js";
import { TOWERS, TOWER_ORDER } from "./data/towers.js";
import { worldById, WORLDS } from "./data/worlds.js";
import { BOSSES, ENEMIES } from "./data/enemies.js";
import { newEnemiesAt } from "./data/waves.js";
import { Stage } from "./render/stage.js";
import { Field } from "./render/field.js";
import { View } from "./render/view.js";
import { NestAudio } from "./audio.js";
import { Save } from "./save.js";
import { UI } from "./ui.js";

export class Game {
  constructor({ canvas, field, onProgress }) {
    this.canvas = canvas;
    this.fieldEl = field;
    this.save = new Save();
    const st = this.save.data.settings;
    this.audio = new NestAudio({ music: st.musicVol > 0, sfx: st.sfxVol > 0, musicVol: st.musicVol, sfxVol: st.sfxVol });
    this.quality = st.quality === "auto" ? autoQuality() : st.quality;
    onProgress && onProgress(0.3, "전장을 그리는 중…");
    this.stage = new Stage(canvas, this.quality);
    this.view = new View(this.stage, document.getElementById("nums"), { dmgNums: st.dmgNums !== false });
    this.ui = new UI(this);
    this.sim = null;
    this.mode = "title";
    this.speed = 1;
    this.paused = false;
    this.sel = null;
    this.placing = null;
    this.pending = null;
    this.acc = 0;
    this.t = 0;
    this.fieldObj = null;
    this.worldId = 0;
    this.fps = { ema: 60, t: 0, frames: 0, dropT: 0 };
    this.bindInput();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(field);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.mode === "play" && this.sim && this.sim.phase === "wave" && !this.paused) this.ui.openPause();
    });
    onProgress && onProgress(0.7, "병아리 수호대 준비 중…");
    this.startTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ---------------- 판 ---------------- */
  setWorld(id) {
    if (this.worldId === id && this.fieldObj) return;
    if (this.fieldObj) this.fieldObj.dispose();
    const w = worldById(id);
    this.worldId = id;
    this.stage.setTheme(w.theme, w.key);
    this.mapForField = this.sim ? this.sim.map : null;
  }
  buildField(sim) {
    if (this.fieldObj) this.fieldObj.dispose();
    this.fieldObj = new Field(this.stage.scene, sim.world, sim.map, this.stage.qKey);
    this.stage.setTheme(sim.world.theme, sim.world.key);
    this.worldId = sim.world.id;
  }
  startTitle() {
    this.mode = "title";
    this.paused = false;
    this.speed = 1;
    this.demo = this.makeDemo();
    this.sim = this.demo;
    this.view.clear();
    this.buildField(this.sim);
    this.view.setGrid(this.sim.map);
    this.ui.showTitle();
    this.audio.setMood("title");
    this.audio.ambience("meadow");
    this.resize();
  }
  /** 첫 화면 뒤에서 도는 구경용 판 (기록 · 저장 없음) */
  makeDemo() {
    const sim = new Sim({ world: 1, seed: (Date.now() & 0xffff) + 1, startCoins: 2000 });
    for (const [type, x, z] of [["archer", 4, 4], ["bomb", 8, 4], ["ice", 4, 9], ["lightning", 13, 9], ["cannon", 13, 6], ["archer", 15, 6], ["healer", 14, 3]]) {
      const t = sim.place(type, x, z);
      if (t && type !== "healer") sim.upgrade(t.id);
    }
    sim.startWave();
    return sim;
  }
  /**
   * 판 시작: { world, mode:"campaign"|"endless", difficulty, snapshot }
   */
  startRun(o) {
    this.mode = "play";
    this.paused = false;
    this.speed = 1;
    this.sel = null;
    this.placing = null;
    this.pending = null;
    this.acc = 0;
    this.runOpt = o;
    this.sim = new Sim({ world: o.world, mode: o.mode || "campaign", difficulty: o.difficulty, seed: o.seed ?? ((Date.now() % 100000) + 7), snapshot: o.snapshot || null });
    this.view.clear();
    this.buildField(this.sim);
    this.view.setGrid(this.sim.map);
    this.bossId = null;
    this.ui.enterPlay();
    this.audio.setMood(this.sim.world.music);
    this.audio.ambience(this.sim.world.key);
    this.resize();
    this.saveRun();
    this.ui.beforeWave();
  }
  restartRun() {
    const o = { ...this.runOpt, snapshot: null };
    this.startRun(o);
  }
  saveRun() {
    const s = this.sim;
    if (!s || s.mode !== "campaign" || this.mode !== "play") return;
    const snap = s.snapshot();
    if (snap) this.save.saveRun(snap, s.diffKey);
  }
  toTitle() {
    this.ui.closeAll();
    this.startTitle();
  }

  /* ---------------- 행동 ---------------- */
  chooseTower(type) {
    if (this.mode !== "play" || !this.sim) return;
    if (this.placing === type) return this.cancelPlace();
    this.placing = type;
    this.sel = null;
    this.pending = null;
    this.ui.panel(null);
    this.ui.placeOk(null);
    this.audio.play("click");
    this.ui.towerBar();
    this.ui.coach("pick");
  }
  cancelPlace() {
    this.placing = null;
    this.pending = null;
    this.view.setGhost(null);
    this.ui.placeOk(null);
    this.ui.towerBar();
  }
  tryPlace(cx, cz) {
    const s = this.sim;
    const type = this.placing;
    const t = s.place(type, cx, cz);
    if (!t) {
      this.audio.play("placeFail");
      return false;
    }
    this.audio.play("place");
    this.placing = null;
    this.pending = null;
    this.view.setGhost(null);
    this.ui.placeOk(null);
    this.ui.towerBar();
    this.ui.coach("placed");
    this.saveRun();
    return true;
  }
  select(id) {
    this.sel = id;
    this.ui.panel(id);
  }
  upgrade() {
    if (this.sel == null || !this.sim.upgrade(this.sel)) return false;
    this.audio.play("upgrade");
    this.ui.panel(this.sel);
    this.ui.coach("upgraded");
    this.saveRun();
    return true;
  }
  evolve(key) {
    if (this.sel == null || !this.sim.evolve(this.sel, key)) return false;
    this.audio.play("evolve");
    this.ui.panel(this.sel);
    this.saveRun();
    return true;
  }
  sell() {
    if (this.sel == null) return 0;
    const v = this.sim.sell(this.sel);
    this.audio.play("sell");
    this.sel = null;
    this.ui.panel(null);
    this.saveRun();
    return v;
  }
  startWave() {
    const s = this.sim;
    if (this.mode !== "play" || !s || s.phase !== "build") return false;
    if (!s.startWave()) return false;
    this.audio.play("waveStart");
    this.ui.coach("started");
    return true;
  }
  pickCard(i) {
    if (!this.sim.pickCard(i)) return;
    this.audio.play("card");
    this.saveRun();
    this.ui.beforeWave();
  }
  cycleSpeed() {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1;
    this.ui.hud(true);
  }
  setPaused(p) {
    this.paused = p;
  }

  /* ---------------- 입력 ---------------- */
  bindInput() {
    const cv = this.canvas;
    let down = null;
    cv.addEventListener("pointerdown", (e) => {
      this.audio.unlock();
      down = { x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType, button: e.button };
    });
    cv.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" && this.placing && !this.pending) this.hover(e.clientX, e.clientY);
    });
    cv.addEventListener("pointerup", (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const dt = performance.now() - down.t;
      const d = down;
      down = null;
      if (moved > 14 || dt > 700) return;
      if (d.button === 2) {
        this.cancelPlace();
        this.select(null);
        return;
      }
      this.tap(e.clientX, e.clientY, d.type);
    });
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => {
      if (this.mode !== "play" || !this.sim) return;
      if (this.ui.modal()) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT") return;
      if (e.key >= "1" && e.key <= "6") {
        this.chooseTower(TOWER_ORDER[+e.key - 1]);
        e.preventDefault();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (this.placing) this.cancelPlace();
        else if (this.sel != null) this.select(null);
        else this.ui.openPause();
      } else if (e.code === "Space") {
        e.preventDefault();
        this.startWave();
      } else if (e.key === "f" || e.key === "F") this.cycleSpeed();
      else if (e.key === "u" || e.key === "U") this.upgrade();
      else if (e.key === "p" || e.key === "P") this.ui.openPause();
      else if ((e.key === "Delete" || e.key === "Backspace") && this.sel != null) this.ui.confirmSell();
    });
  }
  cellAt(clientX, clientY) {
    const p = this.stage.pick(clientX, clientY);
    if (!p) return null;
    const cx = Math.floor(p.x);
    const cz = Math.floor(p.z);
    if (!this.sim.map.inside(cx, cz)) return null;
    return { cx, cz };
  }
  hover(x, y) {
    const c = this.cellAt(x, y);
    if (!c) return this.view.setGhost(this.placing, null, null, false, 0, this.sim.map);
    const ok = !this.sim.canPlace(this.placing, c.cx, c.cz);
    this.view.setGhost(this.placing, c.cx, c.cz, ok, TOWERS[this.placing].levels[0].range * this.sim.mods.range, this.sim.map);
  }
  tap(x, y, ptype) {
    if (this.mode !== "play" || !this.sim) return;
    const c = this.cellAt(x, y);
    if (this.placing) {
      if (!c) return this.cancelPlace();
      const why = this.sim.canPlace(this.placing, c.cx, c.cz);
      const range = TOWERS[this.placing].levels[0].range * this.sim.mods.range;
      this.view.setGhost(this.placing, c.cx, c.cz, !why, range, this.sim.map);
      if (why) {
        this.ui.toast(why);
        this.audio.play("placeFail");
        this.pending = null;
        this.ui.placeOk(null);
        return;
      }
      if (ptype === "mouse") return this.tryPlace(c.cx, c.cz);
      // 손가락: 미리 보기 → '여기에 세우기'
      if (this.pending && this.pending.cx === c.cx && this.pending.cz === c.cz) return this.tryPlace(c.cx, c.cz);
      this.pending = c;
      const s = this.stage.project(c.cx + 0.5, 1.4, c.cz + 0.5);
      this.ui.placeOk(s);
      return;
    }
    const t = c ? this.sim.towerAt(c.cx, c.cz) : null;
    if (t) {
      this.audio.play("click");
      this.select(t.id);
    } else this.select(null);
  }

  /* ---------------- 시뮬레이션 일 → 소리 · 화면 ---------------- */
  handleEvents() {
    const s = this.sim;
    const evs = s.drainEvents();
    const play = this.mode === "play";
    for (const ev of evs) {
      this.view.handle(ev, s);
      if (!play) continue;
      switch (ev.type) {
        case "fire":
          this.audio.play({ arrow: "arrow", pierceArrow: "arrow", bomb: "bomb", iceShard: "ice", frostLob: "bomb", chain: "zap", bolt: "zap", shell: "cannon", scatter: "cannon" }[ev.attack] || "arrow");
          break;
        case "hit":
          this.audio.play(ev.kind === "ice" ? "hitIce" : "hitArrow");
          break;
        case "boom":
          this.audio.play("boom", { big: ["slam", "quake", "magma", "siege"].includes(ev.look) });
          break;
        case "coin":
          this.audio.play("coin");
          break;
        case "spawn":
          if (ev.boss) this.onBoss(ev);
          break;
        case "phase":
          this.audio.play("phase");
          this.ui.toast(ev.phase >= 3 ? "보스가 마지막 힘을 끌어올려요!" : "보스가 화났어요! 패턴이 바뀌어요");
          break;
        case "finalPhase":
          this.ui.banner("FINAL", "최종 페이즈!", "그림자 폭풍이 몰아쳐요. 끝까지 버텨요!", 2.2);
          break;
        case "interrupt":
          this.ui.toast("둥지 공격을 끊었어요! 지금이 기회!");
          break;
        case "nestStrike":
          this.ui.toast("마왕이 둥지를 공격했어요!");
          break;
        case "nestHit":
          this.audio.play("nestHit");
          this.ui.nestHurt();
          if (this.fieldObj) this.fieldObj.nest.hitT = 0.4;
          break;
        case "nestBlock":
          this.audio.play("shield");
          break;
        case "steal":
          this.ui.toast(`박쥐 도적이 코인 ${ev.n}개를 훔쳐 갔어요!`);
          break;
        case "kamikaze":
          this.ui.toast("화염 폭탄병이 터졌어요! 심지가 탈 때 처치해요");
          break;
        case "towerStun":
          this.audio.play("stun");
          break;
        case "blizzard":
          this.ui.flash("snow");
          this.ui.toast("눈보라! 모든 타워가 잠깐 느려져요");
          break;
        case "shieldBreak":
          this.audio.play("shatter");
          break;
        case "heal":
          this.audio.play("heal");
          break;
        case "summon":
        case "clones":
          this.audio.play("summon");
          break;
        case "placeFail":
          this.ui.toast(ev.why);
          break;
        case "state":
          if (ev.state === "arming") this.ui.toast("💣 자폭 준비! 빨리 처치해요");
          break;
        case "waveClear":
          this.audio.play("waveClear");
          this.onWaveClear(ev);
          break;
        case "worldClear":
          this.onWorldClear();
          break;
        case "lost":
          this.onLost();
          break;
      }
    }
  }
  onBoss(ev) {
    const s = this.sim;
    const e = s.byIdMap.get(ev.id);
    const d = BOSSES[ev.etype];
    this.bossId = ev.id;
    this.audio.play("bossIn");
    this.audio.setMood("boss");
    this.ui.banner(e && e.awakened ? "AWAKENED BOSS" : "BOSS", `${d.name} 등장!`, d.desc, 2.6, true);
    if (e && this.save.data.settings.shake !== false) this.stage.focus = { x: e.x, z: e.z, t: 0, dur: 2.2 };
  }
  skipIntro() {
    this.stage.focus = null;
    this.ui.banner(null);
  }
  onWaveClear(ev) {
    const s = this.sim;
    if (s.mode === "campaign") this.save.waveReached(s.world.id, ev.n);
    if (ev.boss) this.audio.setMood(s.world.music);
    this.bossId = null;
    // 웨이브를 막으면 둥지 위로 축하 불꽃 (보스 웨이브는 더 길게)
    if (this.mode === "play") this.view.celebrate(s.world.nest.x, s.world.nest.z, ev.boss ? 1.6 : 0.6);
    if (s.phase === "cards") this.ui.showCards(ev);
    else if (s.phase === "build") {
      this.saveRun();
      this.ui.beforeWave();
    }
  }
  onWorldClear() {
    const s = this.sim;
    this.audio.play("win");
    this.audio.setMood("victory");
    const first = this.save.worldClear(s.world.id, s.score, s.nest.hp);
    const n = s.world.nest;
    const final = s.world.id === 5;
    // 축하: 둥지 위 불꽃 · 카메라가 둥지로 · 알림 (마지막 월드는 엔딩)
    this.view.celebrate(n.x, n.z, final ? 4 : 2);
    if (this.save.data.settings.shake !== false) this.stage.focus = { x: n.x, z: n.z, t: 0, dur: final ? 4 : 2.2 };
    if (final) this.ui.banner("ENDING", "황금 둥지에 평화가 왔어요!", "그림자 까마귀 마왕이 사라지고, 병아리 왕국에 햇살이 돌아왔어요", 3.8);
    else this.ui.banner("WORLD CLEAR", `${s.world.name} 클리어!`, "몬스터 군단을 모두 막아 냈어요", 2);
    setTimeout(() => this.ui.result("win", { first }), final ? 4200 : 2200);
  }
  onLost() {
    const s = this.sim;
    this.audio.play("lose");
    let rec = null;
    if (s.mode === "endless") rec = this.save.endlessResult(s.local - 1, s.score);
    setTimeout(() => this.ui.result("lose", { rec }), 900);
  }

  /* ---------------- 그리기 ---------------- */
  resize() {
    const r = this.fieldEl.getBoundingClientRect();
    const ins = this.ui.insets();
    this.stage.resize(Math.max(1, r.width), Math.max(1, r.height), ins);
  }
  setQuality(k) {
    this.save.setting("quality", k);
    this.quality = k === "auto" ? autoQuality() : k;
    this.stage.setQuality(this.quality);
    if (this.sim) this.buildField(this.sim);
  }
  loop(ts) {
    requestAnimationFrame((t) => this.loop(t));
    const real = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    this.t += real;
    this.measure(real);
    const s = this.sim;
    if (s) {
      const running = s.phase === "wave" && !this.paused && !(this.mode === "play" && this.ui.modal());
      if (running) {
        this.acc += real * (this.mode === "title" ? 1 : this.speed);
        let n = 0;
        const maxSteps = 8 * this.speed;
        while (this.acc >= DT && n < maxSteps) {
          s.step(DT);
          this.handleEvents();
          this.acc -= DT;
          n++;
          if (s.phase !== "wave") break;
        }
        if (n >= maxSteps) this.acc = 0;
      } else {
        this.acc = 0;
        this.handleEvents();
      }
      // 구경용 판: 끝나면 다시
      if (this.mode === "title") {
        if (s.phase === "cards") s.pickCard(0);
        if (s.phase === "build") s.startWave();
        if (s.phase === "won" || s.phase === "lost" || s.local > 4) {
          this.demo = this.makeDemo();
          this.sim = this.demo;
          this.view.clear();
        }
      }
      const vdt = this.paused || (this.mode === "play" && this.ui.modal() && s.phase === "wave") ? 0 : real * (s.phase === "wave" && this.mode === "play" ? Math.min(this.speed, 2) : 1);
      this.view.update(this.sim, vdt, this.sel);
      if (this.fieldObj) this.fieldObj.update(this.t, real, this.sim);
      if (this.mode === "play") this.ui.hud();
    }
    this.stage.update(real, this.save.data.settings.shake !== false);
    if (this.mode === "title") {
      // 첫 화면: 카메라가 천천히 돈다
      const c = this.stage.camera;
      void c;
    }
    this.stage.render();
  }
  /** 성능: 평균 FPS · '자동' 그래픽이면 느릴 때 한 단계 낮춤 */
  measure(dt) {
    const f = this.fps;
    if (dt > 0) f.ema = f.ema * 0.95 + (1 / dt) * 0.05;
    if (this.save.data.settings.quality !== "auto" || this.mode !== "play") return;
    if (f.ema < 34) f.dropT += dt;
    else f.dropT = Math.max(0, f.dropT - dt);
    if (f.dropT > 4 && this.quality !== "low") {
      this.quality = this.quality === "high" ? "medium" : "low";
      this.stage.setQuality(this.quality);
      f.dropT = 0;
      this.ui.toast(`화면이 느려 그래픽을 '${this.quality === "low" ? "낮음" : "보통"}'으로 바꿨어요`);
    }
  }
  /** 점검용 요약 */
  probe() {
    const s = this.sim;
    return {
      mode: this.mode,
      phase: s ? s.phase : null,
      world: s ? s.world.id : 0,
      local: s ? s.local : 0,
      coins: s ? s.coins : 0,
      nest: s ? { ...s.nest } : null,
      towers: s ? s.towers.length : 0,
      enemies: s ? s.enemies.length : 0,
      t: s ? s.t : 0,
      speed: this.speed,
      paused: this.paused,
      placing: this.placing,
      sel: this.sel,
      quality: this.quality,
      fps: Math.round(this.fps.ema),
      view: this.view.stats(),
      stack: this.ui.stack.slice(),
    };
  }
}

function autoQuality() {
  const touch = window.matchMedia && matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 500;
  // 휴대폰도 처음엔 '보통'(윤곽선 있음) — 느리면 measure() 가 4초 뒤 '낮음'으로 내림
  if (touch && small) return "medium";
  if (touch) return "medium";
  return "high";
}
export { TOWERS, TOWER_ORDER, WORLDS, ENEMIES, BOSSES, statsOf, newEnemiesAt };
