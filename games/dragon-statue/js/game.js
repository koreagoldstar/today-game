/*
 * 🐉 꼬마 동물단: 드래곤 석상 대작전! — 게임 진행
 *
 *  흐름: 타이틀 → 캐릭터 선택 → 등장 → 규칙 카드(첫 판 · 특별 판) → 3·2·1 → 찾기(aim) → 깡충 · 휘두르기(act) → 판정
 *        정답: 석상이 깨지고 요정이 나온다 → 다음 판   오답: 하트 -1 (보너스 판은 시간 -2초)   시간 초과: 하트 -1, 정답 보여 주고 다시
 *  상태 하나(phase)로만 입력을 받는다 → 두 번 눌러도 한 번만 친다. 늦게 할 일은 모두 this.after() (일시정지하면 같이 멈춘다).
 */
import * as THREE from "/js/vendor/three-0.160.1.module.min.js";
import { World, THEMES } from "./world.js?v=1";
import { Character, CHARACTERS, CHAR_BY_ID, BATS, makeBat } from "./characters.js?v=1";
import * as L from "./layout.js?v=1";
import { FX } from "./fx.js?v=1";
import { FAIRIES, FAIRY_BY_ID, FAIRY_OF_THEME, makeFairy, animateFairy } from "./fairies.js?v=1";
import { DragonAudio } from "./audio.js?v=1";
import { Save } from "./save.js?v=1";
import { UI } from "./ui.js?v=1";
import { StageView, typeInfo } from "./stageview.js?v=1";
import { makeStatue, PED_R } from "./statues.js?v=1";
import { dotTex } from "./tex.js?v=1";
import { Adventure } from "./adventure.js?v=1";
import { REGIONS } from "./levels.js?v=1";
import { BOSSES } from "./boss.js?v=1";
import { HATS, DECOS, makeHat } from "./characters.js?v=1";
import { allUnlocked, EGGS } from "./cosmetics.js?v=1";

const BUDGET = { high: 2.6e6, mid: 1.7e6, low: 1.0e6 };
const FAIRY_AT = { 3: "forest", 7: "sea", 12: "star", 17: "fire", 24: "ice", 30: "gold" };
const COMBO_MSG = { 2: "좋아요!", 3: "멋져요!", 4: "잘하고 있어요!", 5: "대단해요!", 7: "최고예요!", 10: "드래곤 마스터 콤보!" };
const lerp = (a, b, k) => a + (b - a) * k;

export class Game {
  constructor({ canvas, field }) {
    this.canvas = canvas;
    this.field = field;
    this.save = new Save();
    const s = this.save.data.settings;
    this.audio = new DragonAudio({ music: s.music, sfx: s.sfx, musicVol: s.musicVol, sfxVol: s.sfxVol });
    this.portraits = { chars: {}, fairies: {}, bats: {} };
    this.jobs = [];
    this.paused = false;
    this.lost = false;
    this.mode = "boot";
    this.phase = "";
    this.time = 0;
    this.run = null;
    this.round = null;
    this.fairyActs = [];
    this.rewardQ = [];
    this.freshCollection = false;
    this.calm = s.calm || matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.ui = new UI(this);
    if (!this.initGL()) {
      this.ui.loading(false);
      this.ui.show("fallback");
      return;
    }
    try {
      this.initScene();
      this.CharacterClass = Character;
      this.adv = new Adventure(this);
      this.makePortraits();
    } catch (e) {
      console.error(e);
      this.ui.loading(false);
      this.ui.show("fallback");
      return;
    }
    this.bindInput();
    this.resize();
    this.openTitle();
    this.last = performance.now();
    this.loopF = (t) => this.loop(t);
    requestAnimationFrame(this.loopF);
  }

  /* ================================================================
   * 그래픽 준비
   * ============================================================== */
  qualityLevel() {
    const q = this.save.data.settings.quality;
    if (q === "high" || q === "low") return q;
    const coarse = matchMedia("(pointer:coarse)").matches;
    const small = Math.min(screen.width, screen.height) < 820;
    return coarse || small ? "mid" : "high";
  }
  initGL() {
    try {
      const test = document.createElement("canvas");
      if (!(test.getContext("webgl2") || test.getContext("webgl"))) return false;
      this.level = this.qualityLevel();
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.level !== "low", alpha: true, powerPreference: "high-performance" });
    } catch (e) {
      console.warn("WebGL 없음", e);
      return false;
    }
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = this.level === "low" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
      if (this.isPlaying()) this.pause();
    });
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.lost = false;
      this.ui.toast("그래픽이 다시 켜졌어요");
    });
    return true;
  }
  initScene() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.5, 420);
    this.world = new World(this.renderer, this.scene, { quality: this.level === "low" ? 0.5 : 1 });
    if (this.level !== "high") this.world.sun.shadow.mapSize.set(1024, 1024);
    this.fx = new FX(this.scene, { quality: this.level === "low" ? 0.6 : 1, reduced: this.calm });
    this.view = new StageView(this.scene, this.fx);
    this.hero = new Character(this.save.data.char, this.save.data.bat);
    this.scene.add(this.hero.group);
    this.cast = null;
    this.camCur = { pos: new THREE.Vector3(0, 8, 20), tgt: new THREE.Vector3(0, 1, -1) };
    this.camGoal = { pos: this.camCur.pos.clone(), tgt: this.camCur.tgt.clone() };
    this.camMode = "goal";
    this.camSpeed = 3;
    this.shake = 0;
    this.cursor = -1;
    this.setTheme("forest");
  }
  setTheme(id) {
    const T = this.world.setTheme(id);
    this.theme = T;
    this.fx.setTheme(T);
    this.view.setTheme(T);
    return T;
  }

  /** 캐릭터 · 요정 · 방망이 그림 (선택 카드 · 도감 · 결과에 쓴다) */
  makePortraits() {
    const r = this.renderer;
    const cssW = Math.max(200, this.canvas.clientWidth || 360);
    const cssH = Math.max(200, this.canvas.clientHeight || 640);
    r.setPixelRatio(1);
    r.setSize(cssW, cssH, false);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight("#ffffff", "#8a7a6a", 1.6));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.4);
    sun.position.set(2, 4, 5);
    sc.add(sun);
    sc.environment = this.scene.environment;
    const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
    const S = 192;
    const out = document.createElement("canvas");
    out.width = out.height = S;
    const ctx = out.getContext("2d");
    const shot = (obj, camPos, look) => {
      sc.add(obj);
      cam.position.copy(camPos);
      cam.lookAt(look);
      r.setScissorTest(true);
      r.setViewport(0, 0, S, S);
      r.setScissor(0, 0, S, S);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(sc, cam);
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(this.canvas, 0, this.canvas.height - S, S, S, 0, 0, S, S);
      sc.remove(obj);
      return out.toDataURL("image/png");
    };
    for (const c of CHARACTERS) {
      const ch = new Character(c.id, "wood");
      ch.faceTo = ch.face = 0.35;
      ch.play("idle");
      ch.blinkT = 99;
      ch.update(0.4);
      this.portraits.chars[c.id] = shot(ch.group, new THREE.Vector3(0, 0.7, 3.1), new THREE.Vector3(0, 0.55, 0));
    }
    for (const f of FAIRIES) {
      const g = makeFairy(f.id);
      g.rotation.y = 0.4;
      animateFairy(g, 0.3);
      this.portraits.fairies[f.id] = shot(g, new THREE.Vector3(0, 0.2, 1.6), new THREE.Vector3(0, 0.12, 0));
    }
    for (const b of BATS) {
      const g = makeBat(b.id === "wood" ? "star" : null, b.id);
      g.rotation.set(0, 0.3, -0.75);
      this.portraits.bats[b.id] = shot(g, new THREE.Vector3(0.0, 0.32, 1.25), new THREE.Vector3(0.1, 0.3, 0));
    }
    // 모자 · 장식 · 드래곤 알
    this.portraits.hats = {};
    this.portraits.decos = {};
    this.portraits.eggs = {};
    for (const h of HATS) {
      if (h.id === "none") continue;
      const g = makeHat(h.id);
      g.rotation.set(0.35, 0.5, 0);
      this.portraits.hats[h.id] = shot(g, new THREE.Vector3(0, 0.3, 1.25), new THREE.Vector3(0, 0.1, 0));
    }
    for (const d of DECOS) {
      if (d.id === "none") continue;
      const ch = new Character("chick", "wood");
      ch.setOutfit({ hat: "none", deco: d.id });
      ch.faceTo = ch.face = d.id === "cape" || d.id === "wings" ? 2.5 : 0.35;
      ch.play("idle");
      ch.blinkT = 99;
      ch.update(0.4);
      this.portraits.decos[d.id] = shot(ch.group, new THREE.Vector3(0, 0.7, 3.1), new THREE.Vector3(0, 0.55, 0));
      ch.dispose();
    }
    for (const e of EGGS) {
      const g = new THREE.Group();
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 20), new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.35 }));
      egg.scale.set(1, 1.3, 1);
      g.add(egg);
      const sm = new THREE.MeshStandardMaterial({ color: e.spot, roughness: 0.4 });
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const yy = -0.4 + (i / 9) * 0.9;
        const rr = Math.sqrt(Math.max(0, 1 - (yy / 0.65) ** 2)) * 0.5;
        const sp = new THREE.Mesh(new THREE.SphereGeometry(0.08 + (i % 3) * 0.03, 10, 8), sm);
        sp.position.set(Math.cos(a) * rr * 0.98, yy, Math.sin(a) * rr * 0.98);
        sp.scale.set(1, 1, 0.4);
        sp.lookAt(0, yy, 0);
        g.add(sp);
      }
      this.portraits.eggs[e.id] = shot(g, new THREE.Vector3(0, 0.15, 2.1), new THREE.Vector3(0, 0, 0));
    }
    r.setScissorTest(false);
    r.setClearColor(0x000000, 0);
  }

  resize() {
    if (!this.renderer) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const budget = BUDGET[this.level] * (this.slow || 1);
    const dpr = Math.max(0.75, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(budget / (w * h))));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.renderer.setViewport(0, 0, w, h);
    this.w = w;
    this.h = h;
    this.aspect = w / h;
    this.cam.aspect = this.aspect;
    this.cam.updateProjectionMatrix();
    if (this.round && this.round.layout) this.refit();
    else if (this.mode === "select") this.frameSelect();
  }

  /* ================================================================
   * 입력
   * ============================================================== */
  bindInput() {
    window.addEventListener(
      "pointerdown",
      () => {
        const first = !this.audio.ctx;
        this.audio.unlock();
        if (first && this.audio.ctx && !this.audio.music) this.playModeMusic();
      },
      { capture: true, passive: true }
    );
    this.canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const r = this.canvas.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.tapAt(nx, ny);
    });
    window.addEventListener("keydown", (e) => this.onKey(e));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.isPlaying() && !this.paused) this.pause();
    });
    window.addEventListener("blur", () => {
      if (this.isPlaying() && !this.paused && (this.phase === "aim" || this.mode === "adv")) this.pause();
    });
  }
  isPlaying() {
    if (this.mode === "adv") return ["STATUE_PUZZLE", "STAGE_INTRO", "PLAYING", "CHECKPOINT", "BOSS_INTRO", "BOSS_BATTLE"].includes(this.adv.state);
    return this.mode === "play" && this.phase !== "over";
  }
  onKey(e) {
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.repeat) return;
    if (this.mode === "adv") {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        this.paused ? this.resume() : this.pause();
        return;
      }
      if (this.paused || this.adv.state !== "STATUE_PUZZLE") return;
    }
    if (this.mode === "play" || this.mode === "adv") {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        this.paused ? this.resume() : this.pause();
        return;
      }
      if (this.paused) return;
      if ((e.key === "h" || e.key === "H") && this.mode === "play") return this.useHint();
      const sts = this.view.statues.filter((s) => !s.gone);
      if (!sts.length || (this.phase !== "aim" && this.phase !== "tutorial")) return;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        this.moveCursor(e.key);
      } else if ((e.key === "Enter" || e.key === " ") && this.cursor >= 0) {
        e.preventDefault();
        this.pick(this.cursor);
      }
    }
  }
  /** 키보드 커서: 화면에서 가장 가까운 석상으로 */
  moveCursor(key) {
    const list = this.view.statues;
    const pos = list.map((s) => new THREE.Vector3(s.x, s.y + s.scale * 0.5, s.z).project(this.cam));
    let cur = this.cursor;
    if (cur < 0 || !list[cur] || list[cur].gone) {
      cur = list.findIndex((s) => !s.gone);
      this.setCursor(cur);
      return;
    }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[key];
    let best = -1;
    let bs = Infinity;
    list.forEach((s, i) => {
      if (i === cur || s.gone) return;
      const dx = pos[i].x - pos[cur].x;
      const dy = pos[i].y - pos[cur].y;
      const along = dx * d[0] + dy * d[1];
      if (along <= 0.01) return;
      const side = Math.abs(dx * d[1]) + Math.abs(dy * d[0]);
      const sc = along + side * 2.5;
      if (sc < bs) {
        bs = sc;
        best = i;
      }
    });
    if (best >= 0) this.setCursor(best);
  }
  /** 석상 받침 둘레 고리 (키보드 커서: 노랑 · 방금 고른 석상: 흰색) */
  ringAt(s, color) {
    if (!this.cursorMesh) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: "#ffe14a", transparent: true, opacity: 0.95, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 12;
      this.scene.add(m);
      this.cursorMesh = m;
    }
    this.cursorMesh.visible = !!s;
    if (s) {
      this.cursorMesh.position.set(s.x, s.y + 0.03, s.z);
      this.cursorMesh.scale.setScalar(PED_R * s.scale * 1.35);
      this.cursorMesh.material.color.set(color);
    }
  }
  setCursor(i) {
    this.cursor = i;
    const s = this.view.statues[i];
    this.ringAt(s, "#ffe14a");
    if (s) this.audio.play("tap");
  }
  tapAt(nx, ny) {
    if (this.paused) return;
    if (this.mode !== "play" && !(this.mode === "adv" && this.adv.state === "STATUE_PUZZLE")) return;
    if (this.phase !== "aim" && this.phase !== "tutorial") return;
    const i = L.pickAt(this.cam, this.view.statues, nx, ny, { loose: 0.05 });
    if (i < 0) return;
    this.pick(i);
  }

  /* ================================================================
   * 예약 (일시정지하면 같이 멈춘다)
   * ============================================================== */
  after(sec, fn) {
    const j = { t: sec, fn };
    this.jobs.push(j);
    return j;
  }
  clearJobs() {
    this.jobs = [];
  }

  /* ================================================================
   * 화면: 타이틀 · 선택 · 도감 · 설정 · 오늘의 도전
   * ============================================================== */
  openTitle() {
    if (this.adv && this.mode === "adv") this.adv.leave();
    this.mode = "title";
    this.phase = "";
    this.paused = false;
    this.clearJobs();
    this.run = null;
    this.round = null;
    this.fx.reset();
    this.ui.hud(false);
    this.ui.count(null);
    this.ui.tutor(null);
    this.ui.pointer(null);
    this.ui.hideBanner();
    this.removeCast();
    this.clearFairies();
    if (this.cursorMesh) this.cursorMesh.visible = false;
    if (this.theme.id !== "forest") this.setTheme("forest");
    // 타이틀 장면: 석상 다섯이 반원으로 · 주인공이 앞에서 손 흔들기
    this.view.clear();
    const deco = ["spread", "crystal", "ancient", "gold", "bighorn"].map((typeId, i) => {
      const a = (i - 2) * 0.42;
      return { typeId, x: Math.sin(a) * 4.2, z: -3.4 + (1 - Math.cos(a)) * 3 - 0.5, y: L.FLOOR, yaw: -a * 0.8, scale: i === 2 ? 2.3 : 1.75, halfW: 0.4 };
    });
    this.view.placeStatues(deco);
    this.view.rise(0.12);
    this.hero.setBat(this.save.data.bat);
    this.swapHero(this.save.data.char);
    this.hero.setOutfit({ hat: this.save.data.hat, deco: this.save.data.deco });
    this.hero.pos.set(0, L.FLOOR, 1.6);
    this.hero.faceTo = this.hero.face = 0.15;
    this.hero.play("wave");
    this.hero.group.visible = true;
    this.camMode = "title";
    this.ui.paintTitle(this.save, this.dailyNew());
    this.ui.show("title");
    this.ui.loading(false);
    this.audio.playMusic({ ...THEMES.forest.music, bpm: 92, drums: "none", pad: true });
  }
  playModeMusic() {
    if ((this.mode === "play" || this.mode === "adv") && this.theme) this.audio.playMusic(this.theme.music);
    else this.audio.playMusic({ ...THEMES.forest.music, bpm: 92, drums: "none", pad: true });
  }
  dailyNew() {
    const plan = L.dailyPlan();
    return !this.save.daily(plan.day).plays;
  }
  back() {
    const cur = this.ui.current;
    if (cur === "select" && this.selectFrom === "daily") return this.openDaily();
    if (cur === "select" && this.selectFrom === "challenge") return this.openChallenge();
    if (cur === "daily") return this.openChallenge();
    this.removeCast();
    this.openTitle();
  }
  openCollection() {
    this.freshCollection = false;
    this.ui.paintCollection(this.save);
    this.ui.show("collection");
  }
  openSettings() {
    this.ui.paintSettings(this.save);
    this.ui.show("settings");
  }
  /** 지역 지도 (모험) */
  openRegions() {
    this.removeCast();
    if (this.mode !== "title") this.openTitle();
    this.ui.paintRegions(this.save);
    this.ui.show("regions");
  }
  startRegion(i) {
    const a = this.save.data.adv;
    if (i + 1 > a.unlocked) return this.ui.toast("앞 지역을 먼저 깨면 열려요");
    this.audio.unlock();
    this.adv.start(i);
  }
  /** 석상 챌린지 (예전 30단계 석상 찾기 · 오늘의 도전) */
  openChallenge() {
    this.removeCast();
    if (this.mode !== "title") this.openTitle();
    this.ui.paintChallenge(this.save, this.dailyNew());
    this.ui.show("challenge");
  }
  openDaily() {
    this.removeCast();
    const plan = L.dailyPlan();
    this.ui.paintDaily(plan, this.save.daily(plan.day));
    this.ui.show("daily");
    this.selectFrom = null;
  }
  setSetting(k, v) {
    const s = this.save.data.settings;
    s[k] = v;
    this.save.save();
    if (k === "music") this.audio.setMusic(v);
    if (k === "sfx") this.audio.setSfx(v);
    if (k === "musicVol" || k === "sfxVol") this.audio.setVolumes(s.musicVol, s.sfxVol);
    if (k === "calm") {
      this.calm = v || matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.fx.reduced = this.calm;
    }
    if (k === "quality") {
      this.level = this.qualityLevel();
      this.slow = 1;
      this.resize();
      this.ui.toast(v === "low" ? "가볍게: 화면이 조금 덜 선명해요" : v === "high" ? "좋게: 선명하게 그려요" : "자동: 기기에 맞춰요");
    }
  }

  /** 캐릭터 선택: 넷이 광장 앞에 줄 서고, 고른 친구가 손을 흔든다 */
  openSelect(mode) {
    if (this.adv && this.mode === "adv") this.adv.leave();
    if (this.adv && mode === "adv") this.adv.setState("CHARACTER_SELECT");
    this.selectFrom = mode === "daily" ? "daily" : mode === "normal" ? "challenge" : null;
    this.selectMode = mode;
    this.mode = "select";
    this.clearJobs();
    this.ui.hud(false);
    this.ui.tutor(null);
    this.ui.pointer(null);
    this.ui.count(null);
    if (this.run) this.endRunQuiet();
    this.view.clear();
    this.fx.reset();
    if (this.theme.id !== "forest") this.setTheme("forest");
    this.hero.group.visible = false;
    this.makeCast();
    this.frameSelect();
    this.ui.paintSelect(this.save, mode, this.portraits);
    this.ui.show("select");
    this.pickChar(this.save.data.char, true);
  }
  makeCast() {
    if (this.cast) return;
    this.cast = CHARACTERS.map((c, i) => {
      const ch = new Character(c.id, this.save.data.bat);
      ch.setOutfit({ hat: this.save.data.hat, deco: this.save.data.deco });
      ch.pos.set((i - 1.5) * 1.25, L.FLOOR, 2.6);
      ch.faceTo = ch.face = -(i - 1.5) * 0.12;
      ch.play("idle");
      this.scene.add(ch.group);
      return ch;
    });
    // 뒤에 석상 셋
    this.view.placeStatues(
      [
        ["folded", -2.6],
        ["ancient", 0],
        ["spread", 2.6],
      ].map(([typeId, x], i) => ({ typeId, x, z: -0.8, y: L.FLOOR, yaw: -x * 0.12, scale: i === 1 ? 2.2 : 1.7, halfW: 0.4 }))
    );
    this.view.rise(0.1);
  }
  removeCast() {
    if (!this.cast) return;
    for (const c of this.cast) {
      this.scene.remove(c.group);
      c.dispose();
    }
    this.cast = null;
  }
  frameSelect() {
    const pts = [new THREE.Vector3(-2.6, L.FLOOR, 3.1), new THREE.Vector3(2.6, L.FLOOR, 3.1), new THREE.Vector3(0, L.FLOOR + 1.25, 2.4)];
    const portrait = this.aspect < 0.8;
    const fit = L.fitCamera(new THREE.PerspectiveCamera(), pts, { aspect: this.aspect, fov: L.fovFor(this.aspect), pitch: 0.2, safe: portrait ? { l: 0.04, r: 0.04, t: 0.15, b: 0.5 } : { l: 0.26, r: 0.26, t: 0.16, b: 0.45 } });
    this.camGoal.pos.copy(fit.target).addScaledVector(fit.dir, fit.dist);
    this.camGoal.tgt.copy(fit.target);
    this.camMode = "goal";
    this.camFov = L.fovFor(this.aspect);
  }
  pickChar(id, quiet) {
    this.save.data.char = id;
    this.save.save();
    this.ui.paintSelInfo(id);
    if (!quiet) this.audio.play("select");
    if (this.cast)
      this.cast.forEach((c) => {
        if (c.def.id === id) c.play("happy", { dur: 0.85 }), (c.onDone = () => c.play("wave"));
        else c.play("idle");
      });
  }
  pickHat(id) {
    if (!allUnlocked(this.save).hat.includes(id)) return;
    this.save.data.hat = id;
    this.save.save();
    this.ui.paintOutfitSel("hat", id);
    this.audio.play("select");
    if (this.cast) this.cast.forEach((c) => c.setOutfit({ hat: id, deco: this.save.data.deco }));
  }
  pickDeco(id) {
    if (!allUnlocked(this.save).deco.includes(id)) return;
    this.save.data.deco = id;
    this.save.save();
    this.ui.paintOutfitSel("deco", id);
    this.audio.play("select");
    if (this.cast) this.cast.forEach((c) => c.setOutfit({ hat: this.save.data.hat, deco: id }));
  }
  pickBat(id) {
    if (!this.save.batUnlocked(id)) return;
    this.save.data.bat = id;
    this.save.save();
    this.ui.paintBatSel(id);
    this.audio.play("select");
    if (this.cast) this.cast.forEach((c) => c.setBat(id));
  }
  swapHero(id) {
    if (this.hero.def.id === id) {
      this.hero.setBat(this.save.data.bat);
      return;
    }
    this.scene.remove(this.hero.group);
    this.hero.dispose();
    this.hero = new Character(id, this.save.data.bat);
    this.hero.setOutfit({ hat: this.save.data.hat, deco: this.save.data.deco });
    this.scene.add(this.hero.group);
  }

  /* ================================================================
   * 모험 시작
   * ============================================================== */
  startFromSelect() {
    if (this.selectMode === "adv") {
      // 처음이면 바로 첫 지역, 아니면 지역 지도
      if (this.save.data.adv.unlocked <= 1) return this.startRegion(0);
      return this.openRegions();
    }
    this.startRun(this.selectMode || "normal");
  }
  startRun(mode) {
    this.audio.unlock();
    this.removeCast();
    this.clearJobs();
    this.clearFairies();
    this.fx.reset();
    this.mode = "play";
    this.paused = false;
    const daily = mode === "daily";
    const plan = daily ? L.dailyPlan() : null;
    this.run = {
      mode,
      daily,
      plan,
      idx: 0,
      stage: daily ? plan.stages[0] : 1,
      hearts: 3,
      score: 0,
      combo: 0,
      bestCombo: 0,
      hits: 0,
      correct: 0,
      stars: 0,
      cleared: 0,
      hints: 3,
      unlocks: [],
      rnd: L.seeded(daily ? plan.seed : (Math.random() * 1e9) | 0),
      avoid: [],
      won: false,
    };
    if (window.TodayGameRank && TodayGameRank.reset) TodayGameRank.reset();
    this.save.data.stats.runs++;
    if (daily) {
      const rec = this.save.daily(plan.day);
      rec.plays = (rec.plays || 0) + 1;
      this.save.setDaily(plan.day, rec);
    }
    this.save.save();
    this.swapHero(this.save.data.char);
    this.hero.group.visible = true;
    this.ui.show(null);
    this.ui.hud(true);
    this.ui.setHearts(3);
    this.ui.setScore(0);
    this.ui.combo(0);
    if (!this.save.data.tutorial) this.startTutorial();
    else this.startStage(true);
  }
  /** 일시정지에서 '처음부터' · 결과에서 '다시 하기' */
  restartRun() {
    if (this.mode === "adv") {
      this.adv.pauseOff();
      this.paused = false;
      this.ui.overlay("pause", false);
      const puzzle = this.adv.state === "STATUE_PUZZLE";
      return this.adv.start(this.adv.run ? this.adv.run.idx : 0, { retry: !puzzle, keepRun: true });
    }
    const mode = this.run ? this.run.mode : "normal";
    this.paused = false;
    this.ui.overlay("pause", false);
    this.endRunQuiet();
    this.startRun(mode);
  }
  endRunQuiet() {
    this.clearJobs();
    this.round = null;
    this.view.clear();
    this.fx.reset();
    this.clearFairies();
    this.ui.hud(false);
    this.ui.count(null);
    this.ui.tutor(null);
    this.ui.pointer(null);
    this.ui.hideBanner();
    if (this.cursorMesh) this.cursorMesh.visible = false;
  }
  quitToTitle() {
    if (this.mode === "adv") this.adv.leave();
    this.paused = false;
    this.ui.overlay("pause", false);
    this.endRunQuiet();
    this.run = null;
    this.openTitle();
  }

  /* ---------------- 튜토리얼 (처음 한 번 · 진짜 석상으로) ---------------- */
  startTutorial() {
    this.phase = "busy";
    if (this.theme.id !== "forest") this.setTheme("forest");
    const spec = { n: 0, kind: "normal", theme: "forest", count: 3, diff: 0.5, dir: 1, types: ["folded"], time: 99, odds: 1, rounds: 1, scale: 1, safe: true, mix: 1 };
    this.round = { spec, tutorial: true, oddLeft: 1, idx: 0, mistakes: 0, timeLeft: 99, timeMax: 99, timerOn: false };
    this.layoutRound(spec, { avoid: [] });
    this.ui.setStage("연습", "햇살 숲");
    this.ui.setGoal("");
    this.ui.setTimer(1, 1, false);
    this.ui.setHints(this.run.hints, false);
    this.heroEnter();
    this.view.rise(0.15);
    this.audio.play("rise");
    this.after(1.2, () => {
      this.phase = "tutorial";
      this.ui.tutor("석상 셋 중에 하나만 크기가 달라요. 그 석상을 눌러 봐요!");
    });
  }
  skipTutorial() {
    this.save.data.tutorial = true;
    this.save.save();
    this.ui.tutor(null);
    this.ui.pointer(null);
    if (this.mode !== "play") return;
    this.clearJobs();
    this.phase = "busy";
    this.view.sink();
    this.after(0.45, () => this.startStage(true));
  }

  /* ================================================================
   * 스테이지
   * ============================================================== */
  stageLabel() {
    const r = this.run;
    return r.daily ? `도전 ${r.idx + 1}/10` : `STAGE ${r.stage}`;
  }
  startStage(first = false) {
    const run = this.run;
    this.phase = "busy";
    this.fx.clearMarks();
    // 바로 전 판과 같은 종류가 나오지 않게 (가능하면)
    let spec = L.stageSpec(run.stage, run.rnd);
    for (let k = 0; k < 4 && run.lastTypes && spec.kind === "normal" && spec.types.join() === run.lastTypes; k++) spec = L.stageSpec(run.stage, run.rnd);
    run.lastTypes = spec.types.join();
    this.round = { spec, idx: 0, mistakes: 0, hint: false, oddLeft: spec.odds, timeLeft: spec.time, timeMax: spec.time, timerOn: false, t0: this.time, sealsBroken: 0 };
    const themeChange = spec.theme !== this.theme.id;
    const go = () => {
      const T = THEMES[spec.theme];
      this.ui.setStage(this.stageLabel(), spec.kind === "normal" ? T.name : L.KIND_INFO[spec.kind].title.replace(/^.*· /, ""));
      this.ui.setGoal(spec.kind === "multi" ? "크기가 다른 석상 2개를 찾아요!" : spec.kind === "boss" ? "봉인을 지키는 석상 중 크기가 다른 것을 찾아요!" : "크기가 다른 석상 1개를 찾아요!");
      this.ui.setTimer(spec.time, spec.time, false);
      this.ui.setHints(run.hints, false);
      this.ui.seals(spec.kind === "boss" ? 3 : 0, 0);
      this.layoutRound(spec, { avoid: run.avoid });
      if (first) this.heroEnter();
      else this.heroHome();
      // 석상이 솟아오른다
      this.view.rise(this.calm ? 0.03 : 0.07);
      this.audio.play("rise");
      if (spec.kind === "boss") this.after(0.6, () => this.audio.play("roar"));
      const needRule = spec.kind !== "normal" || (first && run.stage === 1 && !run.daily) || (first && run.daily);
      this.ui.banner(this.stageLabel(), spec.kind === "normal" ? T.name : L.KIND_INFO[spec.kind].title, spec.kind === "normal" ? T.en : "", 1.3, spec.kind);
      this.after(first ? 1.5 : 1.0, () => {
        if (needRule) {
          this.phase = "rule";
          this.ui.showRule(spec, this.stageLabel());
        } else this.countIn(first);
      });
    };
    if (themeChange) {
      this.ui.fade(true);
      this.after(0.45, () => {
        this.view.clear();
        this.setTheme(spec.theme);
        this.audio.playMusic(this.theme.music);
        this.ui.fade(false);
        go();
      });
    } else {
      if (first || !this.audio.music) this.audio.playMusic(this.theme.music);
      go();
    }
  }
  ruleDone() {
    if (this.phase !== "rule") return;
    this.ui.show(null);
    this.countIn(this.run && this.run.cleared === 0);
  }
  /** 3 · 2 · 1 (첫 판) 또는 '시작!' 만 */
  countIn(full) {
    this.phase = "count";
    const seq = full && !this.calm ? ["3", "2", "1", "시작!"] : ["시작!"];
    seq.forEach((t, i) =>
      this.after(i * 0.62, () => {
        this.ui.count(t);
        this.audio.play(i === seq.length - 1 ? "go" : "count");
      })
    );
    this.after(seq.length * 0.62 - 0.1, () => {
      this.ui.count(null);
      this.beginAim();
    });
  }
  beginAim() {
    this.phase = "aim";
    this.round.timerOn = true;
    const cs = this.cursor >= 0 ? this.view.statues[this.cursor] : null;
    if (cs && !cs.gone) this.ringAt(cs, "#ffe14a");
    else if (this.cursorMesh) this.cursorMesh.visible = false;
    this.lastTick = Math.ceil(this.round.timeLeft);
    if (this.run) this.ui.setHints(this.run.hints, !this.round.hint);
  }

  /** 한 판 배치 → 석상 · 계단 · 카메라 */
  layoutRound(spec, { avoid }) {
    const run = this.run;
    const rnd = run ? run.rnd : Math.random;
    const res = L.buildRound(spec, { aspect: this.aspect, cam: new THREE.PerspectiveCamera(), rnd, avoid, typeInfo, boss: spec.kind === "boss", safe: this.hudSafe() });
    this.round.layout = res;
    this.camFov = L.fovFor(this.aspect);
    this.setCamGoalFrom(res.fit);
    this.view.clear();
    this.view.buildTerraces(res.terraces);
    if (res.boss) {
      this.view.buildGuardian(res.boss);
      this.round.sealsBroken = this.round.sealsBroken || 0;
    }
    this.view.placeStatues(res.statues);
    this.round.oddLeft = res.statues.filter((s) => s.odd).length;
    if (run) {
      run.avoid = res.statues.filter((s) => s.odd).map((s) => ({ row: s.row, col: s.col }));
    }
    this.cursor = -1;
    if (this.cursorMesh) this.cursorMesh.visible = false;
    // 검증 결과는 개발자 확인용으로 남긴다
    this.lastCheck = res.check;
    return res;
  }
  /** 다음 라운드 (보스 · 거인): 계단 · 수호자는 그대로, 석상만 바꾼다 */
  relayoutStatues(spec) {
    const res = L.buildRound(spec, { aspect: this.aspect, cam: new THREE.PerspectiveCamera(), rnd: this.run.rnd, avoid: this.run.avoid, typeInfo, boss: spec.kind === "boss", safe: this.hudSafe() });
    this.round.layout = { ...res, boss: this.round.layout.boss };
    this.setCamGoalFrom(res.fit);
    this.view.clearStatues();
    this.view.placeStatues(res.statues);
    this.round.oddLeft = res.statues.filter((s) => s.odd).length;
    this.run.avoid = res.statues.filter((s) => s.odd).map((s) => ({ row: s.row, col: s.col }));
    this.lastCheck = res.check;
    this.cursor = -1;
    if (this.cursorMesh) this.cursorMesh.visible = false;
  }
  /** 석상이 HUD(위) · 안내 문구(아래)에 가리지 않게 화면 안전 구역을 실제 크기로 잰다 */
  hudSafe() {
    const H = this.h || innerHeight;
    const side = this.aspect < 0.8 ? 0.03 : 0.05;
    let t = 0.17;
    let b = 0.06;
    const tm = document.getElementById("timer").getBoundingClientRect();
    if (tm.height > 0) t = (tm.bottom + 10) / H;
    const goal = document.getElementById("hud-goal").getBoundingClientRect();
    if (goal.height > 0) b = (H - goal.top + 8) / H;
    if (this.round && this.round.tutorial) b = Math.max(b, 0.24);
    return { l: side, r: side, t: Math.min(0.42, Math.max(0.1, t)), b: Math.min(0.32, Math.max(0.04, b)) };
  }
  setCamGoalFrom(fit) {
    this.camGoal.pos.copy(fit.target).addScaledVector(fit.dir, fit.dist);
    this.camGoal.tgt.copy(fit.target);
    this.camMode = "goal";
    this.playCam = { pos: this.camGoal.pos.clone(), tgt: this.camGoal.tgt.clone() };
  }
  /** 화면 비율이 바뀌면: 카메라 다시 맞추고 원근 보정 크기도 다시 계산 */
  refit() {
    const R = this.round;
    if (!R || !R.layout || !this.view.statues.length) return;
    const tmp = new THREE.PerspectiveCamera();
    const spec = R.spec;
    const SN = L.S0 * spec.scale;
    const pts = [];
    for (const s of this.view.statues) {
      pts.push(new THREE.Vector3(s.x - 0.68 * SN, s.y, s.z + 0.45 * SN), new THREE.Vector3(s.x + 0.68 * SN, s.y, s.z + 0.45 * SN), new THREE.Vector3(s.x, s.y + SN * 1.32, s.z - 0.3));
    }
    const cs = R.layout.charStart;
    pts.push(new THREE.Vector3(cs.x - 0.6, L.FLOOR, cs.z + 0.6), new THREE.Vector3(cs.x + 0.6, L.FLOOR + 1.1, cs.z));
    const b = R.layout.boss;
    if (b) pts.push(new THREE.Vector3(-2, b.y, b.z), new THREE.Vector3(2, b.y, b.z), new THREE.Vector3(0, b.y + b.scale, b.z));
    const fit = L.fitCamera(tmp, pts, { aspect: this.aspect, fov: L.fovFor(this.aspect), safe: this.hudSafe() });
    const hs = this.view.statues.map((s) => L.screenHeight(tmp, s.x, s.y, s.z, SN));
    const ref = Math.max(...hs.filter((_, i) => this.view.statues[i].row === 0));
    this.view.statues.forEach((s, i) => {
      s.scale = SN * (ref / hs[i]) * (s.odd ? 1 + spec.dir * spec.diff : 1);
      s.mesh.scale.setScalar(s.scale);
    });
    this.lastCheck = L.validate(tmp, this.view.statues, spec);
    this.camFov = L.fovFor(this.aspect);
    this.setCamGoalFrom(fit);
    this.camCur.pos.copy(this.camGoal.pos);
    this.camCur.tgt.copy(this.camGoal.tgt);
  }

  /* ---------------- 주인공 이동 ---------------- */
  heroEnter() {
    const cs = this.round.layout.charStart;
    const h = this.hero;
    h.pos.set(cs.x - 5, cs.y, cs.z + 1.2);
    h.faceTo = Math.PI / 2;
    h.play("enter", { to: cs.clone() });
    h.onDone = () => (h.faceTo = 0.35);
    this.audio.play("enter");
    this.after(0.7, () => (h.faceTo = 0.35));
  }
  heroHome() {
    const cs = this.round.layout.charStart;
    const h = this.hero;
    const d = h.pos.distanceTo(cs);
    if (d < 0.05) {
      h.faceTo = 0.35;
      return;
    }
    h.faceTo = Math.atan2(cs.x - h.pos.x, cs.z - h.pos.z);
    h.onDone = () => (h.faceTo = 0.35);
    h.play("hop", { to: cs.clone(), dur: Math.min(0.55, 0.25 + d * 0.04), next: "idle" });
  }

  /* ================================================================
   * 고르기 → 깡충 → 휘두르기 → 판정
   * ============================================================== */
  pick(i) {
    const s = this.view.statues[i];
    if (!s || s.gone || s.state !== "idle") return;
    if (s.wrong) {
      this.ui.toast("이미 아니었던 석상이에요. 다른 석상을 봐요!");
      return;
    }
    if (s.hinted) {
      this.ui.toast("힌트로 지운 석상이에요");
      return;
    }
    const tut = this.phase === "tutorial";
    this.phase = "act";
    this.round.timerOn = false;
    if (this.run) this.ui.setHints(this.run.hints, false);
    // 고른 석상을 바로 표시 (흰 고리 + 살짝 통통)
    this.ringAt(s, "#ffffff");
    s.pop = 1;
    const h = this.hero;
    // 석상 앞 (카메라 쪽) 비스듬히 선다
    // 옆쪽에 서서 휘두른다 (석상을 가리지 않게)
    const side = h.pos.x <= s.x ? -1 : 1;
    const dir = new THREE.Vector2(side * 1, 0.5).normalize();
    const R = PED_R * s.scale + 0.42;
    const to = new THREE.Vector3(s.x + dir.x * R, s.y, s.z + dir.y * R);
    const dist = h.pos.distanceTo(to);
    h.faceTo = Math.atan2(s.x - to.x, s.z - to.z);
    const doSwing = () => {
      h.faceTo = Math.atan2(s.x - h.pos.x, s.z - h.pos.z);
      this.audio.play("swing");
      h.play("swing", { onHit: () => this.judge(s, tut) });
    };
    if (dist < 0.08) doSwing();
    else {
      this.audio.play("hop");
      h.onDone = doSwing;
      h.play("hop", { to, dur: Math.min(0.42, 0.2 + dist * 0.035), next: "idle" });
    }
  }

  judge(s, tut) {
    if (this.mode === "adv") return this.adv.onPuzzleJudge(s);
    const R = this.round;
    const run = this.run;
    if (!tut) {
      run.hits++;
      this.save.data.stats.hits++;
    }
    if (s.odd) {
      if (!tut) {
        run.correct++;
        this.save.data.stats.correct++;
      }
      this.onCorrect(s, tut);
    } else this.onWrong(s, tut);
  }

  onCorrect(s, tut) {
    const R = this.round;
    const run = this.run;
    const spec = R.spec;
    this.fx.crack(s, s.scale);
    this.audio.play("hit");
    this.addShake(0.35);
    this.vibrate(30);
    this.after(0.13, () => {
      this.view.breakStatue(s);
      if (this.cursorMesh) this.cursorMesh.visible = false;
      // 3콤보부터 타격 효과가 더 커진다
      const power = !tut && this.run.combo >= 3 ? 1.5 : 1;
      this.fx.shatter(s, s.scale, { gold: s.typeId === "gold", power });
      this.ui.flash("good");
      this.audio.play("success");
      this.spawnFairy(s);
    });
    this.after(0.22, () => this.hero.play("happy", { dur: 0.95 }));
    R.oddLeft--;
    if (tut) {
      this.ui.tutor("잘했어요! 이렇게 크기가 다른 석상을 찾으면 돼요");
      this.ui.pointer(null);
      this.save.data.tutorial = true;
      this.save.save();
      this.phase = "busy";
      this.after(2.0, () => {
        this.ui.tutor(null);
        this.view.sink();
        this.after(0.45, () => this.startStage(true));
      });
      return;
    }
    // 점수 · 콤보
    run.combo++;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    const timeBonus = Math.round(60 * Math.max(0, R.timeLeft / R.timeMax));
    const comboBonus = run.combo >= 2 ? 15 * Math.min(10, run.combo) : 0;
    let pts = (100 + timeBonus + comboBonus) * (spec.kind === "gold" ? 2 : 1);
    if (spec.kind === "boss") pts += 50;
    run.score += pts;
    this.ui.setScore(run.score);
    this.floatAt(s, `+${pts}`, "good");
    if (run.combo % 5 === 0) {
      // 긴 콤보: 별 보너스
      run.stars++;
      this.pushBatRewards(this.save.addStars(1));
      this.save.save();
      this.after(0.7, () => this.ui.toast(`${run.combo}콤보 보너스! 별 +1`, "good"));
    }
    if (run.combo >= 2) {
      const msg = COMBO_MSG[run.combo] || (run.combo % 5 === 0 ? "멈추지 않아요!" : "콤보!");
      this.ui.combo(run.combo, msg);
      this.after(0.35, () => this.audio.play("combo", { n: run.combo }));
      if (run.combo >= 5) {
        this.after(0.4, () => this.fx.sparkle(this.hero.pos.clone().setY(this.hero.pos.y + 1.4), 50));
      }
    }
    if (R.oddLeft > 0) {
      // 두 개 찾기: 하나 더
      this.ui.toast("하나 더 있어요!", "good");
      this.after(0.7, () => this.beginAim());
      return;
    }
    // 라운드 끝
    if (spec.kind === "boss") return this.bossHit(s);
    if (spec.kind === "giant" && R.idx < spec.rounds - 1) {
      this.ui.toast(`거인 석상 ${R.idx + 1}/3 성공!`, "good");
      return this.nextRound(1.1);
    }
    this.phase = "busy";
    this.after(1.15, () => this.stageClear());
  }

  onWrong(s, tut) {
    const R = this.round;
    const run = this.run;
    this.fx.bonk(s, s.scale);
    this.view.wobble(s);
    this.audio.play("bonk");
    this.addShake(0.12);
    this.vibrate([40, 40, 40]);
    this.after(0.12, () => this.hero.play("oops"));
    s.wrong = true;
    this.fx.mark(s, s.scale, "x");
    this.ui.flash("bad");
    if (tut) {
      this.ui.tutor("그 석상은 다른 석상들과 크기가 같아요. 혼자 큰 석상을 찾아요!");
      this.phase = "busy";
      this.after(0.95, () => (this.phase = "tutorial"));
      return;
    }
    run.combo = 0;
    this.ui.combo(0);
    R.mistakes++;
    if (R.spec.safe) {
      R.timeLeft = Math.max(0.5, R.timeLeft - 2);
      this.floatAt(s, "-2초", "bad");
      this.ui.toast("아니에요! 크기를 다시 봐요 (보너스라 하트는 그대로)", "bad");
      this.after(0.95, () => this.beginAim());
      return;
    }
    this.loseHeart();
    if (run.hearts <= 0) {
      this.phase = "over";
      this.after(1.1, () => this.gameOver());
      return;
    }
    this.ui.toast(R.mistakes === 1 ? "앗, 아니에요! 모양 말고 크기를 봐요" : "괜찮아요, 다시 찾아봐요!", "bad");
    this.after(0.95, () => this.beginAim());
  }
  loseHeart() {
    const run = this.run;
    run.hearts = Math.max(0, run.hearts - 1);
    this.ui.setHearts(run.hearts, 3, run.hearts);
    this.after(0.15, () => this.audio.play("heart"));
  }

  /** 시간 초과: 정답을 보여 주고 (보통 판은 하트 -1) 같은 단계를 새 배치로 다시 */
  timeout() {
    const R = this.round;
    const run = this.run;
    this.phase = "busy";
    R.timerOn = false;
    this.audio.play("timeout");
    run.combo = 0;
    this.ui.combo(0);
    const odd = this.view.statues.find((s) => s.odd && !s.gone);
    if (odd) {
      this.fx.pointAt(odd, odd.scale);
      this.fx.sparkle(new THREE.Vector3(odd.x, odd.y + odd.scale, odd.z), 30, ["#ffe14a", "#ffffff"]);
    }
    this.hero.play("sad");
    if (R.spec.safe) {
      this.ui.banner("보너스 끝!", "시간이 다 됐어요", "정답은 노란 화살표 석상이었어요", 1.8);
      this.after(2.2, () => {
        this.hero.play("idle");
        this.nextStage(false);
      });
      return;
    }
    this.loseHeart();
    this.ui.banner("시간 초과!", "정답은 여기 있었어요", "", 1.8, "bad");
    this.after(2.3, () => {
      this.hero.play("idle");
      if (run.hearts <= 0) return this.gameOver();
      this.fx.clearMarks();
      this.view.sink();
      this.after(0.45, () => this.startStage(false));
    });
  }

  /** 보스: 봉인 하나 깨기 → 3개면 통과 */
  bossHit(s) {
    const R = this.round;
    this.phase = "busy";
    const G = this.view.guardian;
    const k = R.sealsBroken;
    R.sealsBroken++;
    this.ui.seals(3, R.sealsBroken);
    if (G) {
      const a = new THREE.Vector3(s.x, s.y + s.scale * 0.6, s.z);
      const b = this.view.sealPos(k);
      this.after(0.25, () => {
        this.view.beam(a, b, this.theme.crystal);
        this.audio.play("seal");
      });
      this.after(0.55, () => {
        G.seals[k].gone = true;
        G.seals[k].m.visible = false;
        this.fx.shatter(b, 0.8);
        G.shake = 1;
        this.addShake(0.4);
        this.audio.play("roar");
      });
    }
    if (R.sealsBroken < 3) {
      this.after(1.0, () => this.ui.toast(`봉인 ${R.sealsBroken}/3 깨짐!`, "good"));
      this.nextRound(1.6);
      return;
    }
    // 수호자가 무너진다
    this.after(1.2, () => {
      if (G) {
        G.gone = true;
        G.statue.visible = false;
        const p = G.g.position.clone();
        this.fx.shatter(p, G.b.scale * 0.8, { gold: true });
        this.fx.shatter(p.clone().setY(p.y + 1.5), G.b.scale * 0.6);
        this.addShake(0.8);
        this.audio.play("hit");
        this.spawnFairy({ x: p.x, y: p.y + 1, z: p.z, scale: 3.2 }, 2.4);
      }
      this.audio.play("win");
      this.run.hearts = Math.min(3, this.run.hearts + 1);
      this.ui.setHearts(this.run.hearts);
      this.run.score += 500;
      this.ui.setScore(this.run.score);
      this.ui.banner("보스 통과!", "봉인이 모두 풀렸어요", "하트 +1 · 보너스 500점", 1.8, "boss");
      this.hero.play("win", { dur: 1.6 });
    });
    this.after(3.0, () => this.stageClear());
  }
  /** 같은 단계의 다음 라운드 (보스 · 거인) */
  nextRound(delay) {
    const R = this.round;
    this.phase = "busy";
    this.after(delay, () => {
      this.fx.clearMarks();
      this.view.sink();
      this.after(0.45, () => {
        R.idx++;
        R.timeLeft = R.timeMax;
        R.hint = false;
        this.ui.setTimer(R.timeLeft, R.timeMax, false);
        this.relayoutStatues(R.spec);
        this.heroHome();
        this.view.rise(0.05);
        this.audio.play("rise");
        this.after(0.75, () => this.countIn(false));
      });
    });
  }

  stageClear() {
    const run = this.run;
    const R = this.round;
    const spec = R.spec;
    run.cleared++;
    // 별: 실수 없고 빠르면 3개
    let st = 3;
    if (R.mistakes > 0 || R.hint) st--;
    if (R.mistakes > 1) st--;
    if (R.timeLeft / R.timeMax < 0.25) st--;
    st = Math.max(1, st);
    run.stars += st;
    const newBats = this.save.addStars(st);
    run.score += 50 * st;
    this.ui.setScore(run.score);
    this.audio.play("clear");
    this.ui.banner(this.stageLabel() + " 통과!", "★".repeat(st) + "☆".repeat(3 - st), st === 3 ? "완벽해요!" : st === 2 ? "잘했어요!" : "통과!", 1.4, "clear");
    // 보상: 요정 · 방망이
    const day = L.dayKey();
    const fid = !run.daily && FAIRY_AT[spec.n];
    if (fid && this.save.addFairy(fid, day)) {
      const F = FAIRY_BY_ID[fid];
      this.rewardQ.push({ kicker: "새 친구!", title: F.name, text: "친구 도감에 들어왔어요", img: this.portraits.fairies[fid] });
      run.unlocks.push({ name: F.name, img: this.portraits.fairies[fid] });
      this.freshCollection = true;
    }
    this.pushBatRewards(newBats);
    this.save.save();
    this.after(1.5, () => this.showRewards(() => this.nextStage(true)));
  }
  pushBatRewards(ids) {
    for (const id of ids) {
      const B = BATS.find((b) => b.id === id);
      this.rewardQ.push({ kicker: "새 방망이!", title: B.name, text: "캐릭터 선택에서 바꿀 수 있어요 (모양만 달라요)", img: this.portraits.bats[id] });
      this.run.unlocks.push({ name: B.name, img: this.portraits.bats[id] });
    }
  }
  showRewards(done) {
    if (!this.rewardQ.length) return done();
    this.phase = "reward";
    this.rewardDoneCb = done;
    this.audio.play("reward");
    this.ui.showReward(this.rewardQ.shift());
  }
  rewardDone() {
    this.ui.show(null);
    const cb = this.rewardDoneCb;
    if (this.rewardQ.length) {
      this.audio.play("reward");
      this.ui.showReward(this.rewardQ.shift());
      return;
    }
    this.rewardDoneCb = null;
    if (cb) cb();
  }
  nextStage(cleared) {
    const run = this.run;
    const R = this.round;
    // 마지막 단계
    if (run.daily) {
      run.idx++;
      if (run.idx >= run.plan.stages.length) return this.finishDaily();
      run.stage = run.plan.stages[run.idx];
    } else {
      if (cleared && R.spec.n === L.FINAL_STAGE && !run.won) return this.victory();
      run.stage++;
    }
    this.fx.clearMarks();
    this.view.sink();
    this.after(0.5, () => this.startStage(false));
  }

  /* ---------------- 힌트 ---------------- */
  useHint() {
    const R = this.round;
    const run = this.run;
    if (!R || !run || this.phase !== "aim" || this.paused) return;
    if (R.hint) return this.ui.toast("힌트는 한 판에 한 번만 쓸 수 있어요");
    if (run.hints <= 0) return this.ui.toast("힌트를 다 썼어요");
    run.hints--;
    R.hint = true;
    this.audio.play("hint");
    const cand = this.view.statues.filter((s) => !s.odd && !s.gone && !s.wrong && !s.hinted);
    const n = Math.floor(cand.length / 2);
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    cand.slice(0, n).forEach((s, k) =>
      this.after(k * 0.08, () => {
        s.hinted = true;
        this.fx.mark(s, s.scale, "h");
        this.fx.rise(s, s.scale * 0.6);
      })
    );
    this.ui.setHints(run.hints, false);
    this.ui.toast(n ? `석상 ${n}개를 지웠어요. 남은 석상 중에서 찾아요!` : "남은 석상을 잘 봐요!");
  }

  /* ================================================================
   * 끝
   * ============================================================== */
  gameOver() {
    const run = this.run;
    this.phase = "over";
    this.audio.stopMusic();
    this.audio.play("over");
    this.hero.play("sad");
    this.after(1.4, () => this.showResult(false));
  }
  victory() {
    const run = this.run;
    run.won = true;
    this.phase = "over";
    this.save.data.cleared30 = true;
    this.audio.play("win");
    this.hero.play("win", { dur: 3 });
    this.fx.sparkle(this.hero.pos.clone().setY(this.hero.pos.y + 1.5), 90, ["#ffe27a", "#ffd23f", "#ffffff"]);
    this.ui.banner("VICTORY", "드래곤 마스터 달성!", "모든 지역의 석상을 지나왔어요", 2.2, "boss");
    this.after(2.6, () => this.showResult(true));
  }
  continueAfterWin() {
    const run = this.run;
    if (!run) return;
    this.ui.show(null);
    this.ui.hud(true);
    this.mode = "play";
    run.stage++;
    this.view.sink();
    this.audio.playMusic(this.theme.music);
    this.after(0.5, () => this.startStage(false));
  }
  finishDaily() {
    const run = this.run;
    run.dailyDone = true;
    this.phase = "over";
    this.audio.play("win");
    this.hero.play("win", { dur: 2.5 });
    this.ui.banner("오늘의 도전", "완주!", `${run.score.toLocaleString("ko-KR")}점`, 2, "boss");
    this.after(2.4, () => this.showResult(false));
  }
  showResult(won) {
    const run = this.run;
    const d = this.save.data;
    const R = this.round;
    const reached = run.daily ? run.idx + (run.dailyDone ? 0 : 1) : run.stage;
    let newBest = false;
    if (run.daily) {
      const plan = run.plan;
      const rec = this.save.daily(plan.day);
      newBest = run.score > (rec.best || 0);
      rec.best = Math.max(rec.best || 0, run.score);
      rec.stage = Math.max(rec.stage || 0, run.cleared);
      rec.done = rec.done || !!run.dailyDone;
      rec.hits = (rec.hits || 0) + run.hits;
      rec.correct = (rec.correct || 0) + run.correct;
      rec.combo = Math.max(rec.combo || 0, run.bestCombo);
      this.save.setDaily(plan.day, rec);
    } else {
      newBest = run.score > d.best;
      d.best = Math.max(d.best, run.score);
      d.bestStage = Math.max(d.bestStage, run.cleared);
    }
    d.bestCombo = Math.max(d.bestCombo, run.bestCombo);
    this.save.save();
    const acc = run.hits ? Math.round((run.correct / run.hits) * 100) : 0;
    const c = run.cleared;
    const rec = run.daily ? this.save.daily(run.plan.day) : null;
    const bestLine = run.daily ? `${(rec.best || 0).toLocaleString("ko-KR")}점 · ${rec.stage || 0}/10판` : `${d.best.toLocaleString("ko-KR")}점 · ${d.bestStage}단계`;
    const grade = run.daily ? (run.dailyDone ? 3 : c >= 6 ? 2 : c >= 3 ? 1 : 0) : c >= 13 ? 3 : c >= 8 ? 2 : c >= 3 ? 1 : 0;
    this.ui.hud(false);
    this.ui.hideBanner();
    this.ui.showResult({
      kicker: won ? "VICTORY" : run.dailyDone ? "오늘의 도전 완주" : run.daily ? "오늘의 도전" : "GAME OVER",
      title: won ? "드래곤 마스터 달성!" : run.dailyDone ? "10판을 모두 깼어요!" : c >= 8 ? "정말 대단한 모험이었어요!" : c >= 3 ? "멋진 모험이었어요!" : "좋은 출발이에요!",
      char: this.hero.def.id,
      grade,
      daily: run.daily,
      stageLabel: run.daily ? `${run.cleared} / 10` : `${c}단계 통과`,
      score: run.score,
      newBest,
      bestCombo: run.bestCombo,
      hits: run.hits,
      acc,
      stars: run.stars,
      unlocks: run.unlocks,
      best: bestLine,
      canContinue: won,
    });
    this.mountRank(run);
  }
  mountRank(run) {
    const slot = document.getElementById("rank-slot");
    if (!window.TodayGameRank || !slot) return;
    try {
      TodayGameRank.mount({ gameId: run.daily ? "dragon-daily" : "dragon-statue", gameTitle: run.daily ? "드래곤 석상 대작전 · 오늘의 도전" : "드래곤 석상 대작전", formParent: slot });
      TodayGameRank.open(run.score, { label: `${run.score.toLocaleString("ko-KR")}점` });
    } catch (e) {
      console.warn("랭킹 연결 실패", e);
    }
  }

  /* ================================================================
   * 모험 기록 · 보상
   * ============================================================== */
  /** 지역 완료 저장 → 새로 얻은 것 목록 */
  saveRegionClear(region, rs, res, run) {
    const d = this.save.data;
    const a = d.adv;
    const before = allUnlocked(this.save);
    const prev = a.regions[region.id] || { stars: 0, crystals: 0, bestTime: 0, bestScore: 0, clears: 0 };
    const rec = {
      stars: Math.max(prev.stars, res.stars),
      crystals: Math.max(prev.crystals, rs.crystals),
      bestTime: prev.bestTime ? Math.min(prev.bestTime, Math.round(rs.time)) : Math.round(rs.time),
      bestScore: Math.max(prev.bestScore, rs.score),
      clears: prev.clears + 1,
      newBest: rs.score > prev.bestScore,
      newTime: !prev.bestTime || rs.time < prev.bestTime,
    };
    a.regions[region.id] = rec;
    a.unlocked = Math.max(a.unlocked, Math.min(REGIONS.length, region.no + 1));
    a.totalCrystals += rs.crystals;
    a.bestCombo = Math.max(a.bestCombo || 0, rs.bestCombo);
    const out = [];
    if (!a.badges[region.id + "-clear"]) {
      a.badges[region.id + "-clear"] = this.today();
      out.push({ kind: "badge", name: `${region.name} 완주 배지`, img: null, badge: region.id });
    }
    if (res.stars === 3 && !a.badges[region.id + "-star"]) {
      a.badges[region.id + "-star"] = this.today();
      out.push({ kind: "badge", name: `${region.name} 별 3개 배지`, img: null, badge: region.id, gold: true });
    }
    if (rs.boss) {
      const egg = (BOSSES[region.boss] || {}).egg;
      if (egg && !a.eggs[egg]) {
        a.eggs[egg] = this.today();
        const E = EGGS.find((e) => e.id === egg);
        out.push({ kind: "egg", name: E ? E.name : "드래곤 알", img: this.portraits.eggs[egg] });
      }
    }
    this.save.save();
    const after = allUnlocked(this.save);
    for (const t of ["hat", "deco", "bat"]) {
      for (const id of after[t]) {
        if (before[t].includes(id)) continue;
        const list = t === "hat" ? HATS : t === "deco" ? DECOS : BATS;
        const it = list.find((x) => x.id === id);
        out.push({ kind: t, name: it ? it.name : id, img: (this.portraits[t + "s"] || {})[id] });
      }
    }
    return out;
  }
  saveRunEnd(run, won) {
    const a = this.save.data.adv;
    a.runs = (a.runs || 0) + 1;
    a.bestRun = Math.max(a.bestRun || 0, run.score);
    if (won) a.clearedAll = true;
    this.save.save();
    return [];
  }
  today() {
    return L.dayKey();
  }
  /** 결과 화면 버튼 */
  advNext() {
    const i = this.adv.run ? this.adv.run.idx + 1 : 0;
    this.ui.show(null);
    if (i >= REGIONS.length) return this.openRegions();
    this.adv.start(i, { keepRun: true });
  }
  advRetry() {
    this.ui.show(null);
    this.adv.start(this.adv.run ? this.adv.run.idx : 0, { retry: true, keepRun: false });
  }
  advMap() {
    this.adv.leave();
    this.openRegions();
  }
  advChar() {
    this.adv.leave();
    this.openSelect("adv");
  }

  /* ================================================================
   * 일시정지
   * ============================================================== */
  pause() {
    if (this.paused) return;
    if (this.mode === "adv") {
      if (!this.isPlaying()) return;
      this.adv.pauseOn();
    } else if (this.mode !== "play" || this.phase === "over") return;
    this.paused = true;
    this.ui.overlay("pause", true);
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.ui.overlay("pause", false);
    this.last = performance.now();
    if (this.mode === "adv") this.adv.pauseOff();
  }

  /* ================================================================
   * 요정 · 효과 도우미
   * ============================================================== */
  spawnFairy(s, size = 1) {
    const id = FAIRY_OF_THEME[this.theme.id] || "forest";
    const g = makeFairy(id);
    const k = Math.max(1.4, (s.scale || 1.7) * 0.75) * size;
    g.scale.setScalar(0.01);
    g.position.set(s.x, s.y + (s.scale || 1.7) * 0.5, s.z);
    this.scene.add(g);
    this.fairyActs.push({ g, t: 0, k, from: g.position.clone(), seed: Math.random() * 6, col: FAIRY_BY_ID[id].wing });
    this.after(0.12, () => this.audio.play("fairy"));
  }
  clearFairies() {
    for (const f of this.fairyActs) this.scene.remove(f.g);
    this.fairyActs = [];
  }
  updateFairies(dt) {
    for (let i = this.fairyActs.length - 1; i >= 0; i--) {
      const f = this.fairyActs[i];
      f.t += dt;
      const t = f.t;
      const g = f.g;
      animateFairy(g, this.time * 1.0 + f.seed);
      // 0~0.3 퐁 커짐 · 0.3~1.5 빙글 돌며 위로 · 1.5~ 화면 위로 날아감
      const pop = Math.min(1, t / 0.3);
      const sc = f.k * (pop < 1 ? 1.25 * Math.sin(pop * Math.PI * 0.5) : 1);
      g.scale.setScalar(sc);
      const a = t * 4 + f.seed;
      const up = Math.min(1.6, t * 1.2);
      g.position.set(f.from.x + Math.cos(a) * 0.6 * Math.min(1, t), f.from.y + up + (t > 1.5 ? (t - 1.5) * (t - 1.5) * 9 : 0), f.from.z + Math.sin(a) * 0.6 * Math.min(1, t));
      g.rotation.y = -a + Math.PI / 2;
      if (Math.random() < 0.6) this.fx.trail(g.position, f.col);
      if (t > 2.6) {
        this.scene.remove(g);
        this.fairyActs.splice(i, 1);
      }
    }
  }
  floatAt(s, text, cls) {
    const p = new THREE.Vector3(s.x, s.y + s.scale * 1.05, s.z).project(this.cam);
    this.ui.floater(text, ((p.x + 1) / 2) * this.w, ((1 - p.y) / 2) * this.h, cls);
  }
  addShake(a) {
    if (this.calm) return;
    this.shake = Math.min(1, this.shake + a);
  }
  vibrate(p) {
    if (!this.save.data.settings.vibrate || !navigator.vibrate) return;
    try {
      navigator.vibrate(p);
    } catch (_) {}
  }

  /* ================================================================
   * 매 프레임
   * ============================================================== */
  loop(now) {
    requestAnimationFrame(this.loopF);
    const raw = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const dt = Math.min(1 / 20, raw);
    if (!this.lost) {
      try {
        if (!this.paused) this.step(dt);
        this.updateCamera(this.paused ? 0 : dt);
        this.renderer.render(this.scene, this.cam);
      } catch (e) {
        // 한 프레임의 오류가 게임 전체를 멈추지 않게
        if (!this.errLogged) console.error(e);
        this.errLogged = true;
      }
    }
    this.watchSpeed(raw);
  }
  step(dt) {
    this.time += dt;
    // 예약된 일
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
    const advLevel = this.mode === "adv" && this.adv.player;
    this.world.update(dt, advLevel ? this.adv.player.pos : null);
    this.fx.update(dt);
    this.view.update(dt, this.time);
    // 모험 길에서는 주인공 동작을 물리(player.js)가 정한다 → 한 번만 움직이게
    if (!advLevel) this.hero.update(dt);
    if (this.mode === "adv") this.adv.update(dt);
    if (this.cast) this.cast.forEach((c) => c.update(dt));
    this.updateFairies(dt);
    if (this.ui.toastT > 0) {
      this.ui.toastT -= dt;
      if (this.ui.toastT <= 0) document.getElementById("toast").hidden = true;
    }
    if (this.ui.bannerT > 0) {
      this.ui.bannerT -= dt;
      if (this.ui.bannerT <= 0) this.ui.hideBanner();
    }
    // 시간
    const R = this.round;
    if ((this.mode === "play" || this.mode === "adv") && R && R.timerOn && this.phase === "aim") {
      R.timeLeft -= dt;
      this.ui.setTimer(R.timeLeft, R.timeMax);
      const sec = Math.ceil(R.timeLeft);
      if (sec !== this.lastTick) {
        this.lastTick = sec;
        if (sec <= 5 && sec > 0) this.audio.play("tick");
      }
      if (R.timeLeft <= 0) this.mode === "adv" ? this.adv.puzzleTimeout() : this.timeout();
    }
    // 튜토리얼 손가락
    if (this.phase === "tutorial") {
      const odd = this.view.statues.find((s) => s.odd && !s.gone);
      if (odd) {
        const p = new THREE.Vector3(odd.x, odd.y + odd.scale * 0.55, odd.z).project(this.cam);
        this.ui.pointer(((p.x + 1) / 2) * this.w, ((1 - p.y) / 2) * this.h);
        this.pointerOn = true;
      }
    } else if (this.pointerOn) {
      this.pointerOn = false;
      this.ui.pointer(null);
    }
    // 콤보 효과: 2콤보부터 방망이에서 별 · 5콤보부터 빛나는 오라
    const combo = this.mode === "play" && this.run && this.phase !== "over" ? this.run.combo : 0;
    if (combo >= 2 && this.hero.state === "swing" && this.hero.bat) {
      if (!this.tip) this.tip = new THREE.Vector3();
      this.tip.set(0, 0.6, 0);
      this.hero.bat.localToWorld(this.tip);
      this.fx.trail(this.tip, combo >= 5 ? "#ffe14a" : "#ffffff");
      this.fx.trail(this.tip, "#fff6a0");
    }
    this.updateAura(combo >= 5, dt);
    for (const s of this.view.statues) {
      if (s.pop > 0) {
        s.pop = Math.max(0, s.pop - dt * 4);
        s.mesh.scale.setScalar(s.scale * (1 + Math.sin((1 - s.pop) * Math.PI) * 0.05));
      }
    }
    // 커서 링 반짝
    if (this.cursorMesh && this.cursorMesh.visible) this.cursorMesh.material.opacity = 0.6 + Math.sin(this.time * 8) * 0.35;
  }
  updateAura(on, dt) {
    if (!this.aura) {
      if (!on) return;
      const g = new THREE.Group();
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color: "#ffd84a", transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.y = 0.55;
      glow.scale.setScalar(2.2);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), new THREE.MeshBasicMaterial({ color: "#ffe14a", transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      g.add(glow, ring);
      this.scene.add(g);
      this.aura = { g, glow, ring, k: 0 };
    }
    const A = this.aura;
    A.k = Math.max(0, Math.min(1, A.k + (on ? dt * 3 : -dt * 3)));
    A.g.visible = A.k > 0.01;
    if (!A.g.visible) return;
    A.g.position.copy(this.hero.pos);
    A.g.position.y += Math.max(0, this.hero.rig.body.position.y);
    const p = 1 + Math.sin(this.time * 6) * 0.08;
    A.glow.scale.setScalar(2.2 * p * A.k);
    A.ring.scale.setScalar(p * A.k);
    A.ring.rotation.z += dt * 2;
    if (Math.random() < 0.25) this.fx.trail(new THREE.Vector3(this.hero.pos.x + (Math.random() - 0.5) * 0.9, this.hero.pos.y + Math.random() * 1.1, this.hero.pos.z + (Math.random() - 0.5) * 0.9), "#ffe14a");
  }
  updateCamera(dt) {
    // 모험 길 · 연출 중에는 모험 진행기가 카메라를 직접 놓는다
    if (this.camMode === "adv" || this.camMode === "cine") return;
    const cur = this.camCur;
    if (this.camMode === "title") {
      // 광장을 천천히 돌아보는 카메라
      const a = Math.sin(this.time * 0.12) * 0.42;
      const portrait = this.aspect < 0.8;
      const dist = portrait ? 17 : 12.5;
      this.camGoal.tgt.set(0, portrait ? 2.6 : 1.9, -1.4);
      this.camGoal.pos.set(Math.sin(a) * dist, portrait ? 4.2 : 3.4, -1.4 + Math.cos(a) * dist);
      this.camFov = portrait ? 40 : 34;
    }
    const k = dt ? 1 - Math.exp(-dt * (this.camMode === "title" ? 1.5 : this.camSpeed)) : 0;
    cur.pos.lerp(this.camGoal.pos, k);
    cur.tgt.lerp(this.camGoal.tgt, k);
    if (this.camFov && Math.abs(this.cam.fov - this.camFov) > 0.01) {
      this.cam.fov = lerp(this.cam.fov, this.camFov, k || 1);
      this.cam.updateProjectionMatrix();
    }
    this.cam.position.copy(cur.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.12;
      this.cam.position.x += (Math.random() - 0.5) * s;
      this.cam.position.y += (Math.random() - 0.5) * s;
    }
    this.cam.lookAt(cur.tgt);
  }
  /** 느린 기기: 2초 넘게 프레임이 늦으면 그리는 크기를 줄인다 */
  watchSpeed(raw) {
    if (!raw || raw > 0.2) return;
    this.ema = this.ema == null ? raw : this.ema * 0.95 + raw * 0.05;
    if (this.mode !== "play" || this.paused) {
      this.slowT = 0;
      return;
    }
    if (this.ema > 1 / 38) {
      this.slowT = (this.slowT || 0) + raw;
      if (this.slowT > 2 && (this.slow || 1) > 0.45) {
        this.slow = (this.slow || 1) * 0.7;
        this.slowT = 0;
        this.ema = 1 / 60;
        this.resize();
      }
    } else this.slowT = 0;
  }
}
