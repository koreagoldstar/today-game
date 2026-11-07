/*
 * 인형뽑기 마스터 — 게임 본체: 화면 · 조작 · 모드 · 보상 · 저장
 *  물리는 sim.js, 기계 그림은 render.js, 인형 그림은 plush.js
 */
import { DOLLS, dollById, RARITY, MACHINES, UPGRADES, SKINS, DAILY } from "./data.js?v=1";
import { Claw, STEP, CHUTE, PHASE_KO } from "./sim.js?v=1";
import { View } from "./render.js?v=1";
import { plushIcon } from "./plush.js?v=1";
import { FX } from "./fx.js?v=1";
import { Sfx } from "./sfx.js?v=1";

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
const SAVE_KEY = "claw-master-v1";
const GAME_ID = "claw-master";
const TURN_TIME = 25;
const TA_TIME = 90;
const RARE_COST = 6;
const RARE_TRIES = 5;
const REFILL = 15;
const REFILL_WAIT = 3 * 60 * 1000;
const PTS = [10, 20, 40, 80, 120];
const SCREENS = ["title", "col", "up", "set", "mode", "result"];
const seoulDay = () => new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
const daySeed = () => Number(seoulDay().replace(/-/g, ""));

/* ---------- 저장 ---------- */
function fresh() {
  return {
    v: 1,
    coins: 40,
    col: {},
    up: { power: 0, stable: 0, speed: 0, aim: 0 },
    skin: "silver",
    skins: ["silver"],
    stats: { plays: 0, wins: 0, streak: 0, bestStreak: 0, taBest: 0, sec: 0 },
    daily: { date: "", done: false, tried: false },
    sound: { sfx: true, music: true, sfxVol: 0.8, musicVol: 0.5, vib: true },
    tutorial: false,
    freeAt: 0,
    lastDay: "",
  };
}
/** 망가진 칸만 처음 값으로 */
export function sanitize(raw) {
  const d = fresh();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const num = (v, def, max = 1e9) => (typeof v === "number" && Number.isFinite(v) ? clamp(v, 0, max) : def);
  d.coins = Math.floor(num(raw.coins, d.coins));
  if (raw.col && typeof raw.col === "object") for (const x of DOLLS) if (num(raw.col[x.id], 0) > 0) d.col[x.id] = Math.floor(num(raw.col[x.id], 0));
  if (raw.up && typeof raw.up === "object") for (const u of UPGRADES) d.up[u.id] = Math.floor(num(raw.up[u.id], 0, u.vals.length - 1));
  if (Array.isArray(raw.skins)) d.skins = [...new Set(["silver", ...raw.skins.filter((s) => SKINS.some((k) => k.id === s))])];
  if (d.skins.includes(raw.skin)) d.skin = raw.skin;
  if (raw.stats && typeof raw.stats === "object") for (const k of Object.keys(d.stats)) d.stats[k] = num(raw.stats[k], 0);
  if (raw.daily && typeof raw.daily === "object") {
    d.daily.date = typeof raw.daily.date === "string" ? raw.daily.date : "";
    d.daily.done = raw.daily.done === true;
    d.daily.tried = raw.daily.tried === true;
  }
  if (raw.sound && typeof raw.sound === "object") {
    d.sound.sfx = raw.sound.sfx !== false;
    d.sound.music = raw.sound.music !== false;
    d.sound.vib = raw.sound.vib !== false;
    d.sound.sfxVol = num(raw.sound.sfxVol, 0.8, 1);
    d.sound.musicVol = num(raw.sound.musicVol, 0.5, 1);
  }
  d.tutorial = raw.tutorial === true;
  d.freeAt = num(raw.freeAt, 0, 1e15);
  d.lastDay = typeof raw.lastDay === "string" ? raw.lastDay : "";
  return d;
}
function load() {
  try {
    const r = localStorage.getItem(SAVE_KEY);
    return r ? sanitize(JSON.parse(r)) : fresh();
  } catch (_) {
    return fresh();
  }
}

class App {
  constructor() {
    this.cv = $("game");
    this.g = this.cv.getContext("2d");
    this.save = load();
    this.view = new View();
    this.fx = new FX();
    this.sfx = new Sfx();
    this.sfx.set({ sfxOn: this.save.sound.sfx, musicOn: this.save.sound.music, sfxVol: this.save.sound.sfxVol, musicVol: this.save.sound.musicVol });
    this.machine = MACHINES[0];
    this.screen = "title";
    this.mode = "free";
    this.faces = new Map();
    this.keys = { l: 0, r: 0, u: 0, d: 0 };
    this.pad = { l: 0, r: 0, u: 0, d: 0 };
    this.mouse = null;
    this.t = 0;
    this.acc = 0;
    this.last = performance.now();
    this.paused = false;
    this.reveals = [];
    this.zoom = 0;
    this.guide = 0;
    // 개발자 전용 물리 디버그: 주소에 ?debug=1 일 때만 (서비스 화면엔 안 보임). ` 키로 숨기기
    this.debug = new URLSearchParams(location.search).has("debug");
    if (this.debug) {
      this.dbg = document.createElement("pre");
      this.dbg.id = "cm-debug";
      this.dbg.style.cssText = "position:absolute;left:8px;bottom:8px;z-index:70;max-width:min(560px,94vw);max-height:46vh;overflow:auto;margin:0;padding:8px 10px;border-radius:10px;background:rgba(20,16,30,.82);color:#e8f0ff;font:11px/1.45 monospace;white-space:pre-wrap;pointer-events:none";
      document.getElementById("stage").appendChild(this.dbg);
      addEventListener("keydown", (e) => {
        if (e.key === "`") this.dbg.hidden = !this.dbg.hidden;
      });
    }
    this.got = [];
    this.earned = 0;
    this.colTab = -1;
    // 하루 첫 방문 보너스
    const today = seoulDay();
    if (this.save.lastDay !== today) {
      if (this.save.lastDay) {
        this.save.coins += 20;
        this.welcome = true;
      }
      this.save.lastDay = today;
    }
    this.newMachine(1 + Math.floor(Math.random() * 1e6));
    this.bindUi();
    this.bindKeys();
    this.bindPad();
    this.bindMouse();
    this.mountPause();
    addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      this.last = performance.now();
      this.clearInput();
      if (document.hidden) {
        this.sfx.motor(false);
        this.sfx.suspend(true);
      } else if (!this.paused) this.sfx.suspend(false);
    });
    const unlock = () => {
      const first = !this.sfx.ctx;
      this.sfx.unlock();
      if (first && this.sfx.ctx) this.sfx.startMusic();
    };
    addEventListener("pointerdown", unlock, true);
    addEventListener("keydown", unlock, true);
    this.resize();
    this.toTitle();
    if (this.welcome) this.toast("오늘 첫 방문 선물! 코인 +20");
    this.persist();
    this.loopFn = (n) => this.loop(n);
    requestAnimationFrame(this.loopFn);
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch (_) {}
  }
  upVal(id) {
    const u = UPGRADES.find((x) => x.id === id);
    return u.vals[this.save.up[id] || 0];
  }
  skinDef() {
    return SKINS.find((s) => s.id === this.save.skin) || SKINS[0];
  }
  vib(p) {
    if (!this.save.sound.vib) return;
    try {
      if (navigator.vibrate) navigator.vibrate(p);
    } catch (_) {}
  }

  newMachine(seed, force = []) {
    this.sim = new Claw({ seed, machine: this.machine, power: this.upVal("power"), stable: this.upVal("stable"), speed: this.upVal("speed"), force });
    this.faces = new Map();
  }

  /* ---------- 배치 ---------- */
  resize() {
    const r = $("stage").getBoundingClientRect();
    this.W = Math.max(2, r.width);
    this.H = Math.max(2, r.height);
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.layoutView();
  }
  layoutView() {
    const W = this.W;
    const H = this.H;
    const wide = W > H * 1.05;
    const play = this.screen === "play";
    let box;
    if (wide) {
      const side = play ? Math.min(230, W * 0.2) : 0;
      box = { x: side, y: 6, w: W - side * 2, h: H - 12 };
    } else {
      const top = play ? 92 : 6;
      const bot = play ? 186 : 6;
      // 세로: 기계를 위에 붙이고 남는 자리는 조작 쪽으로
      const S = Math.min((W - 8) / 118, (H - top - bot) / 142);
      box = { x: 4, y: top, w: W - 8, h: play ? 142 * S : H - top - bot };
    }
    this.view.layout(W, H, this.dpr, box, this.machine.theme, this.skinDef());
  }

  /* ---------- 화면 ---------- */
  show(id) {
    for (const s of SCREENS) $(s).classList.toggle("hidden", s !== id);
    const was = this.screen;
    this.screen = id;
    const play = id === "play";
    for (const el of ["hud", "hud-goal", "ctrl", "turn"]) $(el).classList.toggle("hidden", !play);
    $("keys").classList.toggle("hidden", !play || matchMedia("(pointer: coarse)").matches || this.W < 760);
    if ((was === "play") !== play) this.layoutView();
    if (!play && this.coach != null) {
      this.coach = null;
      $("coach").classList.add("hidden");
    }
    this.refreshCoins();
    this.clearInput();
    try {
      if (window.TodayPause && window.TodayPause.sync) window.TodayPause.sync();
    } catch (_) {}
  }
  refreshCoins() {
    $("t-coin").textContent = fmt(this.save.coins);
    $("hud-coin").textContent = fmt(this.save.coins);
    document.querySelectorAll(".coin-n").forEach((e) => (e.textContent = fmt(this.save.coins)));
  }
  toTitle() {
    // 하던 판이 남아 있어도 끝까지 물리는 돌고, 뽑힌 인형은 그대로 받는다
    this.mode = "free";
    this.goal = null;
    this.ta = null;
    this.endTurnLock = false;
    this.show("title");
    const own = DOLLS.filter((d) => this.save.col[d.id]).length;
    $("col-pct").textContent = `${Math.round((own / DOLLS.length) * 100)}%`;
    $("play-s").textContent = `코인 ${this.machine.cost}개로 한 번`;
    $("daily-dot").classList.toggle("hidden", this.save.daily.date === seoulDay() && this.save.daily.done);
    $("machines").innerHTML = MACHINES.map((m) => `<span class="${m.open ? "on" : ""}">${m.ko}${m.open ? "" : " · 준비 중"}</span>`).join("");
    if (!this.heroDone) {
      this.heroDone = true;
      const hero = $("hero");
      for (const [k, i] of [["bunny", 0], ["bear", 1], ["duck", 2]]) {
        const c = plushIcon(k, i === 1 ? 130 : 96);
        c.className = `h${i}`;
        hero.appendChild(c);
      }
    }
    this.persist();
  }
  toast(msg) {
    const p = document.createElement("p");
    p.textContent = msg;
    $("toasts").appendChild(p);
    setTimeout(() => p.remove(), 2600);
  }

  /* ---------- 모드 ---------- */
  startFree() {
    this.mode = "free";
    this.got = [];
    this.earned = 0;
    this.ta = null;
    this.goal = null;
    if (!this.sim || this.sim.dolls.length < 8) this.newMachine(1 + Math.floor(Math.random() * 1e6));
    this.enterPlay();
    $("hud-goal").textContent = this.machine.ko;
    if (!this.save.tutorial) this.coachStart();
  }
  enterPlay() {
    this.sim.power = this.upVal("power");
    this.sim.stable = this.upVal("stable");
    this.sim.speed = this.upVal("speed");
    this.show("play");
    this.updateAct();
    $("hud-got").textContent = "0";
  }
  dailyDef() {
    return DAILY[daySeed() % DAILY.length];
  }
  openMode(kind) {
    this.pendingMode = kind;
    const k = $("mode-k");
    const art = $("mode-art");
    art.innerHTML = "";
    if (kind === "daily") {
      const d = this.dailyDef();
      k.textContent = `오늘의 도전 · ${seoulDay()}`;
      $("mode-t").textContent = d.ko;
      const today = this.save.daily.date === seoulDay();
      const again = today && this.save.daily.tried ? ` 다시 도전은 한 번에 코인 ${this.machine.cost}개.` : " 오늘 첫 도전은 무료!";
      $("mode-d").textContent = `${d.tries}번 안에 해내면 코인 ${d.coin}개! 인형 배치는 하루 동안 같아요.${today && this.save.daily.done ? " (오늘 보상은 이미 받았어요)" : again}`;
      const pics = d.who ? [d.who] : d.k === "rarity" ? ["tiger", "koala"] : d.k === "rarity2" ? ["panda", "fox"] : ["bear", "bunny", "duck"];
      for (const kk of pics) art.appendChild(plushIcon(kk, pics.length > 1 ? 86 : 110));
    } else if (kind === "ta") {
      k.textContent = "타임어택";
      $("mode-t").textContent = `${TA_TIME}초 동안 최대한 많이!`;
      $("mode-d").textContent = `코인 없이 계속 뽑아요 (코인 보상도 없어요). 뽑은 인형은 컬렉션에 들어가요. 등급이 높을수록 점수가 커요 (일반 ${PTS[0]} · 희귀 ${PTS[1]} · 에픽 ${PTS[2]} · 전설 ${PTS[3]} · 스페셜 ${PTS[4]}). 최고 기록 ${fmt(this.save.stats.taBest)}점`;
      for (const kk of ["panda", "fox"]) art.appendChild(plushIcon(kk, 90));
    } else {
      const pool = DOLLS.filter((d) => d.rarity >= 1);
      const miss = pool.filter((d) => !this.save.col[d.id]);
      const pick = (miss.length ? miss : pool)[Math.floor(Math.random() * (miss.length || pool.length))];
      this.rareTarget = pick.id;
      k.textContent = `희귀 인형 도전 · 코인 ${RARE_COST}개`;
      $("mode-t").textContent = `${pick.ko} 를 뽑아라!`;
      $("mode-d").textContent = `${RARE_TRIES}번 기회 안에 ${pick.ko}(${RARITY[pick.rarity].ko})를 뽑으면 보상 두 배 + 코인 30개!`;
      art.appendChild(plushIcon(pick.id, 120));
    }
    this.show("mode");
  }
  startMode() {
    const kind = this.pendingMode;
    this.got = [];
    this.earned = 0;
    if (kind === "daily") {
      const d = this.dailyDef();
      this.mode = "daily";
      const force = d.who ? [d.who, d.who] : d.k === "rarity" ? ["penguin", "tiger"] : d.k === "rarity2" ? ["panda", "fox"] : [];
      const S = this.save;
      const today = seoulDay();
      const free = !(S.daily.date === today && S.daily.tried);
      S.daily = { date: today, done: S.daily.date === today && S.daily.done, tried: true };
      this.persist();
      this.newMachine(daySeed(), force);
      this.goal = { def: d, tries: d.tries, used: 0, prog: 0, streak: 0, kinds: new Set(), free };
      this.enterPlay();
      this.goalText();
    } else if (kind === "ta") {
      this.mode = "ta";
      this.newMachine(1 + Math.floor(Math.random() * 1e6));
      this.ta = { left: TA_TIME, score: 0, started: false, n: 0 };
      this.enterPlay();
      $("hud-goal").textContent = "타임어택 0점";
    } else {
      if (this.save.coins < RARE_COST) {
        this.openRefill();
        return;
      }
      this.save.coins -= RARE_COST;
      this.persist();
      this.mode = "rare";
      this.newMachine(1 + Math.floor(Math.random() * 1e6), [this.rareTarget]);
      this.goal = { tries: RARE_TRIES, used: 0, target: this.rareTarget };
      this.enterPlay();
      this.goalText();
    }
  }
  goalText() {
    const G = this.goal;
    if (this.mode === "daily") $("hud-goal").textContent = `${G.def.ko} · 남은 ${G.tries - G.used}번`;
    else if (this.mode === "rare") $("hud-goal").textContent = `${dollById(G.target).ko} 노리기 · 남은 ${G.tries - G.used}번`;
  }

  /* ---------- 한 판 (동전 → 이동 → 내리기) ---------- */
  /** 한 번 뽑는 값: 자유 뽑기 · 다시 하는 오늘의 도전만 코인 (타임어택 · 희귀 도전은 입장 때 정산) */
  cost() {
    if (this.mode === "free") return this.machine.cost;
    if (this.mode === "daily") return this.goal.free ? 0 : this.machine.cost;
    return 0;
  }
  updateAct() {
    const ph = this.sim.phase;
    const t = $("act-t");
    const s = $("act-s");
    const act = $("act");
    act.classList.toggle("drop", ph === "moving");
    act.disabled = !(ph === "idle" || ph === "moving");
    if (ph === "moving") {
      t.textContent = "내리기!";
      s.textContent = "Space";
    } else if (ph === "idle") {
      t.textContent = this.cost() ? "동전 넣기" : "시작";
      s.textContent = this.cost() ? `코인 ${this.cost()}` : this.mode === "ta" ? "무료" : "도전";
    } else {
      t.textContent = "집게 작동 중";
      s.textContent = "";
    }
    this.actPhase = ph;
  }
  act() {
    if (this.screen !== "play" || this.paused || this.revealing()) return;
    const sim = this.sim;
    if (sim.phase === "idle") {
      if (this.mode === "ta" && this.ta.left <= 0) return;
      if ((this.mode === "daily" || this.mode === "rare") && this.goal.used >= this.goal.tries) return;
      const c = this.cost();
      if (this.save.coins < c) {
        this.openRefill();
        return;
      }
      this.save.coins -= c;
      if (c) this.sfx.coin();
      else this.sfx.click();
      this.refreshCoins();
      sim.begin();
      this.turnLeft = TURN_TIME + 2 * (this.save.up.aim || 0);
      this.turnPrize = 0;
      this.save.stats.plays += 1;
      if (this.goal) {
        this.goal.used += 1;
        this.goalText();
      }
      if (this.ta) this.ta.started = true;
      this.persist();
      if (this.coach != null) this.coachStep(1);
    } else if (sim.phase === "moving") {
      sim.drop();
      this.sfx.drop();
      this.vib(15);
      if (this.coach != null) this.coachDone();
    }
    this.updateAct();
  }

  /* ---------- 획득 ---------- */
  onPrize(kind) {
    const def = dollById(kind);
    const r = def.rarity;
    const S = this.save;
    const isNew = !S.col[kind];
    S.col[kind] = (S.col[kind] || 0) + 1;
    let coins = RARITY[r].reward + (isNew ? 0 : RARITY[r].dup);
    if (this.mode === "rare" && this.goal && kind === this.goal.target) coins = coins * 2 + 30;
    if (this.mode === "ta") {
      const p = PTS[r];
      this.ta.score += p;
      this.ta.n += 1;
      coins = 0; // 공짜 판이라 코인은 없음 (무한 코인 방지)
      $("hud-goal").textContent = `타임어택 ${fmt(this.ta.score)}점`;
    }
    S.coins += coins;
    this.earned += coins;
    S.stats.wins += 1;
    this.turnPrize += 1;
    this.got.push(kind);
    $("hud-got").textContent = String(this.got.length);
    this.persist();
    this.refreshCoins();
    if (this.screen !== "play") {
      this.toast(`${def.ko} 획득! 코인 +${coins}`);
      return;
    }
    // 배출구 위치에서 반짝
    const v = this.view;
    const px = v.X((CHUTE.x0 + CHUTE.x1) / 2, 6);
    const py = v.Y(4, 6);
    this.fx.stars(px, py, 14 + r * 6, v.S * 0.4, r >= 3 ? ["#ffe14a", "#fff6b0", "#ffc531"] : undefined);
    this.fx.text(px, py - 30 * v.S * 0.4, this.mode === "ta" ? `+${PTS[r]}점` : `+${coins}`, 22 + r * 3, "#ffe14a", "#a8326b", 1.2);
    this.sfx.prize(r);
    this.vib(r >= 3 ? [40, 60, 40, 60, 120] : [30, 40, 30]);
    if (this.mode === "ta") {
      // 시간 싸움이라 창을 띄우지 않고 이름만
      this.toast(`${def.ko} ${isNew ? "NEW! " : ""}+${PTS[r]}점`);
      if (r >= 3) this.fx.confetti(this.W, this.H, 80, r === 4);
    } else {
      this.reveals.push({ kind, isNew, coins });
      if (!this.revealing()) this.nextReveal();
      this.flyCoins(Math.min(8, 2 + Math.round(coins / 6)), px, py);
    }
    // 도전 진행
    if (this.goal && this.mode === "daily") this.dailyCheck(kind);
    if (this.goal && this.mode === "rare" && kind === this.goal.target) this.goal.win = true;
  }
  /** 코인이 배출구에서 위 코인 칸으로 날아가는 그림 (DOM, 1초 뒤 지움) */
  flyCoins(n, x, y) {
    const to = $("hud-coin").getBoundingClientRect();
    const st = $("stage").getBoundingClientRect();
    const tx = to.left - st.left + 8;
    const ty = to.top - st.top + to.height / 2;
    for (let i = 0; i < n; i += 1) {
      const c = document.createElement("i");
      c.className = "coin-i fly";
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      $("stage").appendChild(c);
      const dx = (Math.random() - 0.5) * 60;
      c.animate(
        [
          { transform: "translate(-50%,-50%) scale(.6)", opacity: 0 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% - 50px)) scale(1.2)`, opacity: 1, offset: 0.3 },
          { transform: `translate(calc(-50% + ${tx - x}px), calc(-50% + ${ty - y}px)) scale(.8)`, opacity: 0.9 },
        ],
        { duration: 900 + i * 70, easing: "cubic-bezier(.3,.6,.4,1)" }
      ).onfinish = () => c.remove();
    }
  }

  revealing() {
    return !$("reveal").classList.contains("hidden");
  }
  nextReveal() {
    const it = this.reveals.shift();
    if (!it) {
      $("reveal").classList.add("hidden");
      this.afterReveals();
      return;
    }
    const def = dollById(it.kind);
    const R = RARITY[def.rarity];
    const box = $("reveal");
    box.dataset.r = String(def.rarity);
    $("rv-art").innerHTML = "";
    $("rv-art").appendChild(plushIcon(it.kind, 180, { eye: "happy", mouth: "smile" }));
    $("rv-r").textContent = `${R.ko} · ${R.en}`;
    $("rv-r").style.background = R.c;
    $("rv-name").textContent = def.ko;
    $("rv-coin").textContent = `코인 +${it.coins}${it.isNew ? "" : " (중복 보너스 포함)"}`;
    $("rv-new").classList.toggle("hidden", !it.isNew);
    box.classList.remove("hidden");
    box.classList.remove("go");
    void box.offsetWidth;
    box.classList.add("go");
    if (def.rarity >= 3) {
      const fl = $("flash");
      fl.classList.remove("go");
      void fl.offsetWidth;
      fl.classList.add("go");
      this.fx.confetti(this.W, this.H, 110, def.rarity === 4);
    }
    this.revealAt = performance.now();
  }
  afterReveals() {
    if (this.pendingEnd) {
      const f = this.pendingEnd;
      this.pendingEnd = null;
      f();
    }
  }

  dailyCheck(kind) {
    const G = this.goal;
    const d = G.def;
    const r = dollById(kind).rarity;
    G.kinds.add(kind);
    if (d.k === "doll" && kind === d.who) G.win = true;
    if (d.k === "rarity" && r >= d.min) G.win = true;
    if (d.k === "kinds" && G.kinds.size >= d.n) G.win = true;
    if (d.k === "count" && kind === d.who) G.prog += 1;
    if (d.k === "count" && G.prog >= d.n) G.win = true;
    if (d.k === "rarity2" && r >= d.min) G.prog += 1;
    if (d.k === "rarity2" && G.prog >= d.n) G.win = true;
  }

  onTurnEnd() {
    const S = this.save;
    if (this.turnPrize > 0) {
      S.stats.streak += 1;
      S.stats.bestStreak = Math.max(S.stats.bestStreak, S.stats.streak);
    } else S.stats.streak = 0;
    if (this.goal && this.mode === "daily") {
      const G = this.goal;
      G.streak = this.turnPrize > 0 ? G.streak + 1 : 0;
      if (G.def.k === "streak" && G.streak >= G.def.n) G.win = true;
    }
    this.persist();
    // 인형이 줄면 위에서 새로 떨어진다
    if (this.sim.dolls.length < 10) {
      this.sim.refill(13);
      this.toast("새 인형이 들어왔어요!");
    }
    const end = this.checkEnd();
    if (end) {
      if (this.revealing() || this.reveals.length) this.pendingEnd = end;
      else end();
    }
    this.updateAct();
  }
  checkEnd() {
    if (this.mode === "daily" || this.mode === "rare") {
      const G = this.goal;
      if (G.win) return () => this.finishGoal(true);
      if (G.used >= G.tries) return () => this.finishGoal(false);
    }
    if (this.mode === "ta" && this.ta.left <= 0) return () => this.finishTa();
    return null;
  }
  finishGoal(win) {
    const S = this.save;
    let coins = 0;
    if (this.mode === "daily") {
      const d = this.goal.def;
      const first = !(S.daily.date === seoulDay() && S.daily.done);
      if (win && first) {
        coins = d.coin;
        S.coins += coins;
        S.daily = { date: seoulDay(), done: true, tried: true };
      }
      this.result(win ? "도전 성공!" : "아쉬워요!", `오늘의 도전 · ${d.ko}`, [["쓴 기회", `${this.goal.used}/${this.goal.tries}`], ["보너스 코인", win ? (first ? `+${coins}` : "오늘 이미 받음") : "-"]], win);
    } else {
      const t = dollById(this.goal.target);
      this.result(win ? `${t.ko} 획득!` : "아쉬워요!", `희귀 인형 도전 · ${t.ko}`, [["쓴 기회", `${this.goal.used}/${this.goal.tries}`], ["결과", win ? "보상 두 배 + 30" : "다음에 다시!"]], win);
    }
    this.persist();
  }
  finishTa() {
    const S = this.save;
    const best = this.ta.score > S.stats.taBest;
    S.stats.taBest = Math.max(S.stats.taBest, this.ta.score);
    this.persist();
    this.result(`${fmt(this.ta.score)}점`, "타임어택", [["뽑은 인형", `${this.ta.n}개`], ["최고 기록", `${fmt(S.stats.taBest)}점${best ? " · 새 기록!" : ""}`]], this.ta.n > 0, best && this.ta.score > 0 ? this.ta.score : 0);
  }
  result(title, k, rows, win, rankScore = 0) {
    $("res-k").textContent = k;
    $("res-t").textContent = title;
    if (this.mode !== "ta") rows.push(["인형으로 받은 코인", `+${fmt(this.earned)}`]);
    $("res-rows").innerHTML = rows.map(([a, b]) => `<li>${a}<b>${b}</b></li>`).join("");
    const got = $("res-got");
    got.innerHTML = "";
    for (const kind of this.got.slice(0, 12)) got.appendChild(plushIcon(kind, 54));
    if (!this.got.length) got.innerHTML = "<p>이번에는 못 뽑았어요. 그림자를 머리 위에 딱 맞춰 봐요!</p>";
    const box = $("res-rank");
    box.innerHTML = "";
    box.classList.add("hidden");
    if (rankScore > 0 && window.TodayGameRank) {
      try {
        box.classList.remove("hidden");
        TodayGameRank.reset();
        TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "인형뽑기 마스터", formParent: box });
        TodayGameRank.open(rankScore, { label: `${fmt(rankScore)}점` });
      } catch (e) {
        console.warn(e);
      }
    }
    $("result").querySelector(".card").classList.toggle("lose", !win);
    this.sim.setInput(0, 0);
    this.sfx.motor(false);
    if (win) this.fx.confetti(this.W, this.H, 80);
    else this.sfx.fail();
    this.show("result");
  }

  /* ---------- 코인 충전 ---------- */
  openRefill() {
    const left = this.save.freeAt - Date.now();
    $("rf-d").textContent = left > 0 ? `무료 코인은 ${Math.ceil(left / 1000)}초 뒤에 다시 받을 수 있어요. 컬렉션 중복 인형도 코인이 돼요!` : `무료 코인 ${REFILL}개를 받을 수 있어요. (${REFILL_WAIT / 60000}분마다)`;
    $("rf-get").disabled = left > 0;
    $("refill").classList.remove("hidden");
    clearInterval(this.rfTimer);
    if (left > 0) this.rfTimer = setInterval(() => (this.screen === "play" || this.screen === "mode" ? this.openRefill() : clearInterval(this.rfTimer)), 1000);
  }

  /* ---------- 조작 안내 ---------- */
  coachStart() {
    this.coach = 0;
    this.coachStep(0);
  }
  coachStep(n) {
    this.coach = n;
    const touch = matchMedia("(pointer: coarse)").matches;
    const T = [
      touch ? "오른쪽 큰 버튼으로 동전을 넣어요" : "Space 나 오른쪽 버튼으로 동전을 넣어요",
      touch ? "방향 버튼으로 그림자를 인형 머리 위에 맞춰요" : "A D W S 로 그림자를 인형 머리 위에 맞춰요",
    ];
    if (n >= T.length) return;
    $("coach-t").textContent = n === 1 ? `${T[1]} → 다 맞추면 내리기!` : T[0];
    $("coach").classList.remove("hidden");
  }
  coachDone() {
    this.coach = null;
    this.save.tutorial = true;
    this.persist();
    $("coach").classList.add("hidden");
  }

  /* ---------- 입력 ---------- */
  clearInput() {
    this.keys = { l: 0, r: 0, u: 0, d: 0 };
    this.pad = { l: 0, r: 0, u: 0, d: 0 };
    this.mouse = null;
    if (this.sim) this.sim.setInput(0, 0);
    document.querySelectorAll(".pb.on").forEach((b) => b.classList.remove("on"));
  }
  bindKeys() {
    const M = { KeyA: "l", ArrowLeft: "l", KeyD: "r", ArrowRight: "r", KeyW: "u", ArrowUp: "u", KeyS: "d", ArrowDown: "d" };
    addEventListener("keydown", (e) => {
      if (this.screen !== "play" || e.target.closest?.("input")) return;
      if (M[e.code]) {
        e.preventDefault();
        this.keys[M[e.code]] = 1;
      } else if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (this.revealing()) this.closeReveal();
        else if (!e.repeat) this.act();
      }
    });
    addEventListener("keyup", (e) => {
      if (M[e.code]) this.keys[M[e.code]] = 0;
    });
    addEventListener("blur", () => this.clearInput());
  }
  bindPad() {
    const D = { up: "u", down: "d", left: "l", right: "r" };
    document.querySelectorAll(".pb").forEach((b) => {
      const k = D[b.dataset.d];
      let pid = null;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (pid !== null) return;
        pid = e.pointerId;
        try {
          b.setPointerCapture(e.pointerId);
        } catch (_) {}
        this.pad[k] = 1;
        b.classList.add("on");
      });
      const off = (e) => {
        if (e.pointerId !== pid) return;
        pid = null;
        this.pad[k] = 0;
        b.classList.remove("on");
      };
      for (const n of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(n, off);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    });
    $("act").addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.act();
    });
    $("act").addEventListener("click", (e) => {
      if (e.detail === 0) this.act(); // 키보드로 누른 경우
    });
  }
  /** 마우스 · 손가락으로 기계 안을 끌면 집게가 그쪽으로 */
  bindMouse() {
    const at = (e) => {
      const r = this.cv.getBoundingClientRect();
      return this.view.toFloor(e.clientX - r.left, e.clientY - r.top);
    };
    this.cv.addEventListener("pointerdown", (e) => {
      if (this.screen !== "play") return;
      const w = this.view.win;
      const r = this.cv.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (!w || x < w.x || x > w.x + w.w || y < w.y || y > w.y + w.h) return;
      this.mouse = { id: e.pointerId, ...at(e) };
      try {
        this.cv.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    this.cv.addEventListener("pointermove", (e) => {
      if (this.mouse && e.pointerId === this.mouse.id) Object.assign(this.mouse, at(e));
    });
    const off = (e) => {
      if (this.mouse && e.pointerId === this.mouse.id) this.mouse = null;
    };
    for (const n of ["pointerup", "pointercancel", "lostpointercapture"]) this.cv.addEventListener(n, off);
    this.cv.addEventListener("dblclick", () => {
      if (this.sim.phase === "moving") this.act();
    });
  }
  feed() {
    const k = this.keys;
    const p = this.pad;
    let x = (k.r || p.r ? 1 : 0) - (k.l || p.l ? 1 : 0);
    let z = (k.u || p.u ? 1 : 0) - (k.d || p.d ? 1 : 0);
    if (this.mouse && !x && !z) {
      // 끌어 놓은 곳까지: 가까울수록 천천히 (정밀도 업그레이드는 더 부드럽게 멈춘다)
      const soft = 6 + this.save.up.aim * 2;
      x = clamp((this.mouse.x - this.sim.cx) / soft, -1, 1);
      z = clamp((this.mouse.z - this.sim.cz) / soft, -1, 1);
    }
    this.sim.setInput(x, z);
    return Math.abs(x) + Math.abs(z) > 0;
  }

  mountPause() {
    if (!window.TodayPause) return;
    TodayPause.mount({
      canPause: () => this.screen === "play",
      isPaused: () => this.paused,
      pause: () => {
        if (this.screen !== "play") return false;
        this.paused = true;
        this.clearInput();
        this.sfx.motor(false);
        this.sfx.suspend(true);
        return true;
      },
      resume: () => {
        this.paused = false;
        this.last = performance.now();
        this.sfx.suspend(false);
        return true;
      },
    });
    // 멈춤 화면에 '메뉴로' 버튼 (다른 게임과 같은 방식)
    const box = $("today-pause-overlay")?.querySelector(".today-pause-actions");
    if (box && box.firstElementChild) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = box.firstElementChild.className;
      b.textContent = "그만두고 메뉴로";
      b.addEventListener("click", () => {
        TodayPause.resume();
        this.toTitle();
      });
      box.appendChild(b);
    }
  }

  /* ---------- 메뉴 ---------- */
  bindUi() {
    $("play-btn").addEventListener("click", () => {
      this.sfx.click();
      this.startFree();
    });
    document.querySelectorAll("[data-go]").forEach((b) =>
      b.addEventListener("click", () => {
        this.sfx.click();
        const g = b.dataset.go;
        if (g === "col") this.openCol();
        else if (g === "up") this.openUp();
        else if (g === "set") this.openSet();
        else this.openMode(g);
      })
    );
    document.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", () => {
        this.sfx.click();
        this.toTitle();
      })
    );
    $("mode-go").addEventListener("click", () => this.startMode());
    $("res-again").addEventListener("click", () => {
      if (this.mode === "free") this.startFree();
      else {
        if (this.mode === "rare") {
          this.openMode("rare");
          return;
        }
        this.pendingMode = this.mode;
        this.startMode();
      }
    });
    $("res-col").addEventListener("click", () => this.openCol());
    $("reveal").addEventListener("pointerdown", () => this.closeReveal());
    $("md-close").addEventListener("click", () => $("detail").classList.add("hidden"));
    $("detail").addEventListener("click", (e) => {
      if (e.target.id === "detail") $("detail").classList.add("hidden");
    });
    $("rf-close").addEventListener("click", () => {
      clearInterval(this.rfTimer);
      $("refill").classList.add("hidden");
    });
    $("rf-get").addEventListener("click", () => {
      if (Date.now() < this.save.freeAt) return;
      this.save.coins += REFILL;
      this.save.freeAt = Date.now() + REFILL_WAIT;
      this.persist();
      this.refreshCoins();
      this.sfx.coin();
      $("refill").classList.add("hidden");
      this.toast(`무료 코인 +${REFILL}`);
    });
    $("coach-skip").addEventListener("click", () => this.coachDone());
    const sync = () => {
      const s = this.save.sound;
      s.sfx = $("set-sfx").checked;
      s.music = $("set-music").checked;
      s.vib = $("set-vib").checked;
      s.sfxVol = Number($("set-sfxv").value) / 100;
      s.musicVol = Number($("set-musicv").value) / 100;
      this.sfx.set({ sfxOn: s.sfx, musicOn: s.music, sfxVol: s.sfxVol, musicVol: s.musicVol });
      this.persist();
    };
    for (const id of ["set-sfx", "set-music", "set-vib", "set-sfxv", "set-musicv"]) $(id).addEventListener("input", sync);
    $("set-tut").addEventListener("click", () => {
      this.save.tutorial = false;
      this.persist();
      this.toast("다음 자유 뽑기에서 안내가 나와요");
    });
    $("set-reset").addEventListener("click", () => {
      if (!confirm("코인 · 인형 · 업그레이드를 모두 지울까요? 되돌릴 수 없어요.")) return;
      this.save = fresh();
      this.save.lastDay = seoulDay();
      this.persist();
      this.toTitle();
    });
  }
  closeReveal() {
    if (!this.revealing()) return;
    if (performance.now() - this.revealAt < 450) return;
    this.sfx.click();
    this.nextReveal();
  }

  openCol() {
    this.renderCol();
    this.show("col");
  }
  renderCol() {
    const S = this.save;
    const own = DOLLS.filter((d) => S.col[d.id]).length;
    $("col-n").textContent = `${own} / ${DOLLS.length}`;
    $("col-bar").style.width = `${(own / DOLLS.length) * 100}%`;
    const st = S.stats;
    $("col-stats").textContent = `뽑은 횟수 ${fmt(st.plays)} · 성공 ${fmt(st.wins)} · 최고 연속 ${st.bestStreak} · 타임어택 최고 ${fmt(st.taBest)}점`;
    $("col-tabs").innerHTML = ["전체", ...RARITY.map((r) => r.ko)].map((t, i) => `<button type="button" data-i="${i - 1}" class="${this.colTab === i - 1 ? "on" : ""}">${t}</button>`).join("");
    $("col-tabs").onclick = (e) => {
      const b = e.target.closest("[data-i]");
      if (!b) return;
      this.colTab = Number(b.dataset.i);
      this.sfx.click();
      this.renderCol();
    };
    const grid = $("col-grid");
    grid.innerHTML = "";
    for (const d of DOLLS) {
      if (this.colTab >= 0 && d.rarity !== this.colTab) continue;
      const n = S.col[d.id] || 0;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `cell r${d.rarity} ${n ? "" : "no"}`;
      b.appendChild(plushIcon(d.id, 92, n ? {} : { silhouette: "#d5c2cf" }));
      const p = document.createElement("p");
      p.innerHTML = `<b>${n ? d.ko : "???"}</b><small style="background:${RARITY[d.rarity].c}">${RARITY[d.rarity].ko}</small>${n ? `<em>×${n}</em>` : ""}`;
      b.appendChild(p);
      b.addEventListener("click", () => this.openDetail(d, n));
      grid.appendChild(b);
    }
    this.refreshCoins();
  }
  openDetail(d, n) {
    this.sfx.click();
    $("md-art").innerHTML = "";
    $("md-art").appendChild(plushIcon(d.id, 170, n ? { eye: "happy" } : { silhouette: "#cbb5c5" }));
    $("md-r").textContent = RARITY[d.rarity].ko;
    $("md-r").style.background = RARITY[d.rarity].c;
    $("md-name").textContent = n ? d.ko : "아직 못 만난 인형";
    $("md-d").textContent = n ? d.desc : "기계에서 뽑으면 도감에 등록돼요.";
    $("md-n").textContent = n ? `${n}번 뽑았어요` : "";
    $("detail").classList.remove("hidden");
  }

  openUp() {
    this.renderUp();
    this.show("up");
  }
  renderUp() {
    const S = this.save;
    $("ups").innerHTML = UPGRADES.map((u) => {
      const lv = S.up[u.id] || 0;
      const max = lv >= u.vals.length - 1;
      const cost = max ? 0 : u.cost[lv + 1];
      return `<div class="up-row"><span><b>${u.ko}</b><small>${u.desc}</small><i class="pips">${u.vals.map((_, i) => `<u class="${i <= lv ? "on" : ""}"></u>`).join("")}</i></span><button type="button" class="btn ${max ? "ghost" : "buy"}" data-u="${u.id}" ${max || S.coins < cost ? "disabled" : ""}>${max ? "최고 단계" : `코인 ${cost}`}</button></div>`;
    }).join("");
    $("ups").onclick = (e) => {
      const b = e.target.closest("[data-u]");
      if (!b || b.disabled) return;
      const u = UPGRADES.find((x) => x.id === b.dataset.u);
      const lv = S.up[u.id] || 0;
      const cost = u.cost[lv + 1];
      if (S.coins < cost) return;
      S.coins -= cost;
      S.up[u.id] = lv + 1;
      this.persist();
      this.sfx.coin();
      this.toast(`${u.ko} ${lv + 2}단계!`);
      this.renderUp();
    };
    $("skins").innerHTML = SKINS.map((k) => {
      const has = S.skins.includes(k.id);
      const on = S.skin === k.id;
      return `<button type="button" class="skin ${on ? "on" : ""}" data-k="${k.id}"><i style="background:linear-gradient(135deg, ${k.c[0]}, ${k.c[1]} 50%, ${k.c[2]})"></i><b>${k.ko}</b><small>${on ? "사용 중" : has ? "쓰기" : `코인 ${k.price}`}</small></button>`;
    }).join("");
    $("skins").onclick = (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      const k = SKINS.find((x) => x.id === b.dataset.k);
      if (!S.skins.includes(k.id)) {
        if (S.coins < k.price) {
          this.toast("코인이 조금 모자라요");
          return;
        }
        S.coins -= k.price;
        S.skins.push(k.id);
        this.sfx.coin();
      }
      S.skin = k.id;
      this.persist();
      this.layoutView();
      this.renderUp();
    };
    this.refreshCoins();
  }
  openSet() {
    const s = this.save.sound;
    $("set-sfx").checked = s.sfx;
    $("set-music").checked = s.music;
    $("set-vib").checked = s.vib;
    $("set-sfxv").value = Math.round(s.sfxVol * 100);
    $("set-musicv").value = Math.round(s.musicVol * 100);
    this.show("set");
  }

  /* ---------- 틀 ---------- */
  loop(now) {
    requestAnimationFrame(this.loopFn);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.t += dt;
    if (!this.paused) this.update(dt);
    this.render(dt);
  }

  update(dt) {
    const sim = this.sim;
    const play = this.screen === "play";
    const moving = play && sim.phase === "moving" && this.feed();
    if (!play || sim.phase !== "moving") sim.setInput(0, 0);
    this.sfx.motor(moving || (play && sim.phase === "carrying"), 1);
    this.sfx.winch(play ? Math.min(1, Math.abs(sim.Lrate) / 30) : 0);
    // 매달린 인형이 크게 흔들리면 케이블이 삐걱
    if (play && sim.dolls.some((d) => d.held) && Math.hypot(sim.hvx - sim.cvx, sim.hvz - sim.cvz) > 22) this.sfx.creak();
    // 물리: 고정 걸음
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 40) {
      sim.step(STEP, !play);
      this.acc -= STEP;
      n += 1;
    }
    if (n >= 40) this.acc = 0;
    if (play) {
      if (sim.phase === "moving") {
        this.turnLeft -= dt;
        if (this.turnLeft <= 0) {
          sim.drop();
          this.sfx.drop();
        }
      }
      if (this.ta && this.ta.started && this.ta.left > 0) {
        this.ta.left -= dt;
        if (this.ta.left <= 0) {
          this.ta.left = 0;
          if (sim.phase === "moving") sim.drop();
          else if (sim.phase === "idle") this.finishTa();
        }
      }
      this.events();
      if (sim.phase !== this.actPhase) this.updateAct();
      const tl = $("turn-t");
      if (this.ta) {
        tl.textContent = String(Math.ceil(this.ta.left));
        $("turn-u").textContent = "초 남음";
      } else if (sim.phase === "moving") {
        tl.textContent = String(Math.ceil(this.turnLeft));
        $("turn-u").textContent = "초";
      }
      $("turn").classList.toggle("off", !this.ta && sim.phase !== "moving");
    } else this.events();
    this.faceUpdate(dt);
    this.fx.update(dt);
    // 카메라: 내려갈 때 집게 쪽으로 다가가고 (잡는 순간이 잘 보이게), 옮길 때 물러난다
    const ph = sim.phase;
    const held = sim.dolls.some((d) => d.held);
    let want = 0;
    if (play) {
      if (ph === "descending") want = 0.24 * Math.min(1, sim.phaseT / 0.7);
      else if ((ph === "contact" || ph === "closing" || ph === "gripping")) want = 0.34;
      else if (ph === "lifting") want = held ? 0.3 : 0.16;
      else if (ph === "carrying" && held) want = 0.1;
    }
    const kz = 1 - Math.exp(-dt * 2.6);
    this.zoom += (want - this.zoom) * kz;
    const v = this.view;
    const hd = sim.dolls.find((d) => d.held);
    let fx = v.X(sim.hx, sim.hz);
    let fy = v.Y(Math.max(0, sim.hy - 14), sim.hz);
    if (hd && (ph === "lifting" || ph === "carrying")) {
      fx = (fx + v.X(hd.x, hd.z)) / 2;
      fy = (v.Y(sim.hy, sim.hz) + v.Y(hd.y, hd.z)) / 2;
    }
    const kc = 1 - Math.exp(-dt * 5);
    this.camX = this.camX == null ? fx : this.camX + (fx - this.camX) * kc;
    this.camY = this.camY == null ? fy : this.camY + (fy - this.camY) * kc;
    this.shake = Math.max(0, (this.shake || 0) - dt);
    this.guide += ((play && ph === "moving" ? 1 : 0) - (this.guide || 0)) * (1 - Math.exp(-dt * 8));
    // 자동 저장: 플레이 시간
    this.save.stats.sec += play ? dt : 0;
  }

  events() {
    const sim = this.sim;
    const v = this.view;
    const quiet = this.screen !== "play";
    for (const e of sim.events) {
      if (quiet && e.t !== "prize" && e.t !== "turnEnd") continue;
      if (e.t === "contact") this.sfx.contact(e.power);
      else if (e.t === "clack") {
        this.shake = 0.16;
        this.sfx.clack();
        this.vib(10);
      } else if (e.t === "touch") this.sfx.squish(e.n);
      else if (e.t === "squeeze") {
        this.sfx.squeeze();
        this.vib(18);
      } else if (e.t === "lift") this.sfx.lift();
      else if (e.t === "grab") {
        const d = sim.dolls.find((x) => x.id === e.id);
        this.sfx.grab();
        this.vib(25);
        if (d) {
          this.fx.stars(v.X(d.x, d.z), v.Y(d.y + 6, d.z), 8, v.S * 0.35);
          this.fx.text(v.X(d.x, d.z) + 14 * v.sc(d.z), v.Y(d.y + 10, d.z), "쏙!", 13 + v.S * 2.4, "#fff", "#e2477f", 0.8);
          d.impact = Math.max(d.impact, 0.6);
        }
      } else if (e.t === "slip") {
        this.sfx.slip();
        this.vib(40);
        const d = sim.dolls.find((x) => x.id === e.id);
        if (d) this.fx.text(v.X(d.x, d.z), v.Y(d.y + 14, d.z), "아앗!", 20, "#fff", "#5a3a8a", 0.9);
      } else if (e.t === "land") {
        this.sfx.land(e.power);
        const d = sim.dolls.find((x) => x.id === e.id);
        if (d && e.power > 0.3) this.fx.puff(v.X(d.x, d.z), v.Y(d.y - 5, d.z), 4, v.S * 0.4);
      } else if (e.t === "prize") {
        this.view.pop(e.kind);
        this.sfx.chute();
        this.onPrize(e.kind);
      }
      else if (e.t === "turnEnd") this.onTurnEnd();
    }
    sim.events.length = 0;
  }

  /** 인형 표정: 잡히면 놀람, 떨어지면 깜짝, 가끔 깜빡 */
  faceUpdate(dt) {
    for (const d of this.sim.dolls) {
      let f = this.faces.get(d.id);
      if (!f) {
        f = { eye: "open", mouth: "smile", blink: 1 + Math.random() * 4 };
        this.faces.set(d.id, f);
      }
      f.blink -= dt;
      const scared = d.held || d.vy < -110 || d.prongN > 0;
      if (scared) {
        f.eye = "wide";
        f.mouth = "o";
      } else if (f.blink < 0) {
        f.eye = "blink";
        f.mouth = "smile";
        if (f.blink < -0.13) f.blink = 1.5 + Math.random() * 4;
      } else {
        f.eye = "open";
        f.mouth = "smile";
      }
    }
  }

  /** 집게 아래에서 가장 높은 곳 (그림자 자리) */
  groundUnder() {
    const u = this.sim.surfaceBelow(this.sim.hx, this.sim.hz);
    return { gy: u.y, target: u.id };
  }

  /** 디버그 글자 판: 지금 상태 · 발 힘 · 집게 둘레 인형 · 이번 판 기록 */
  debugText() {
    const s = this.sim;
    const deg = (a) => Math.round((a * 180) / Math.PI);
    const near = s.dolls
      .filter((d) => Math.hypot(d.x - s.hx, d.z - s.hz) < 26)
      .map((d) => {
        const m = d.prongMask;
        return `  ${d.def.ko.padEnd(5)} ${String(Math.round(d.m * 10)).padStart(3)}g  v ${Math.hypot(d.vx, d.vy, d.vz).toFixed(1).padStart(5)}  w ${d.w.toFixed(2).padStart(5)}  z ${d.z.toFixed(1).padStart(4)}  발 ${[0, 1, 2].map((i) => (m & (1 << i) ? i + 1 : "·")).join("")}${d.held ? "  잡힘" : ""}${d.sleep ? "  잠" : ""}`;
      });
    return [
      `상태 ${PHASE_KO[s.phase] || s.phase} (${s.phase}) ${s.phaseT.toFixed(2)}초 · 케이블 ${s.L.toFixed(1)}cm ${s.Lrate.toFixed(1)}cm/s · 장력 ${((s.ropeT || 0) * 1e-4).toFixed(2)}N`,
      `집게 머리 (${s.hx.toFixed(1)}, ${s.hy.toFixed(1)}, ${s.hz.toFixed(1)}) · 수레 (${s.cx.toFixed(1)}, ${s.cz.toFixed(1)}) · 힘 x${s.power} 안정 ${s.stable} 속도 x${s.speed}`,
      `발 각도 ${s.prongs.map((p) => deg(p.a) + "°").join(" / ")} · 발 힘 ${s.prongF.map((f) => (f * 1e-4).toFixed(2) + "N").join(" / ")}`,
      `집게 둘레 인형:`,
      ...(near.length ? near : ["  (없음)"]),
      `이번 판 기록:`,
      ...s.log.slice(-12).map((l) => "  " + l),
    ].join("\n");
  }

  render(dt) {
    const g = this.g;
    const { W, H, dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = this.view;
    const sim = this.sim;
    const under = this.groundUnder();
    const aim = this.save.up.aim || 0;
    const moving = this.screen === "play" && sim.phase === "moving";
    const st = {
      t: this.t,
      faces: this.faces,
      groundY: under.gy,
      groundOn: under.target,
      guide: this.guide,
      moving,
      party: this.reveals.length > 0 || this.revealing(),
      // 노리는 인형은 늘 빛나고, 정밀도를 올릴수록 진하게
      target: this.mode === "rare" && this.goal ? this.sim.dolls.find((d) => d.kind === this.goal.target)?.id : moving ? under.target : null,
      targetK: this.mode === "rare" ? 1 : aim / 5,
      dt,
      debug: this.debug,
    };
    if (this.dbg && !this.dbg.hidden && (this.dbgT = (this.dbgT || 0) + dt) > 0.15) {
      this.dbgT = 0;
      this.dbg.textContent = this.debugText();
    }
    // 다가가는 카메라 + 닫힐 때 흔들림
    const z = this.zoom;
    if (z > 0.001) {
      g.translate(this.camX, this.camY);
      g.scale(1 + z, 1 + z);
      g.translate(-this.camX, -this.camY);
    }
    if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake * v.S * 6, (Math.random() - 0.5) * this.shake * v.S * 4);
    v.draw(g, sim, st);
    this.fx.draw(g);
    void dt;
  }
}

export function startApp() {
  const app = new App();
  window.ClawMaster = app;
  return Promise.resolve(app);
}
