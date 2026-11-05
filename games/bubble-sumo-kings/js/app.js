/*
 * 통통 동물 씨름왕 — 게임 본체
 *  화면 전환 · 모드 · 입력 · 저장 · 보상 · 그리기를 묶는다. 물리는 sim.js, 상대는 ai.js, 그림은 rig.js / arena.js.
 */
import { FIGHTERS, fighterById, WORLDS, CAMPAIGN, COSMETICS, DAILY_POOL, ACHIEVEMENTS, AI_STYLES } from "./data.js?v=1";
import { Bout, STEP, press } from "./sim.js?v=1";
import { BoutAI } from "./ai.js?v=1";
import { Puppet } from "./rig.js?v=1";
import { Stage, TILT } from "./arena.js?v=1";
import { FX } from "./fx.js?v=1";
import { Sfx } from "./sfx.js?v=1";

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
const SAVE_KEY = "bubble-sumo-kings-v1";
const GAME_ID = "bubble-sumo-kings";
const GROUND = -46; // 경기장 밖 땅 높이 (판 옆면 높이와 같다)
const SECTIONS = ["title", "select", "camp", "practice", "book", "settings", "result"];
const STYLE_IDS = Object.keys(AI_STYLES);
const LV_KO = ["초급", "중급", "고급"];
const LOSE_TIPS = [
  "끝에 몰리면 안쪽 방향키를 꾹! 줄에 발이 걸려 버틸 수 있어요.",
  "돌진은 빗나가면 내가 휘청여요. 가까이 와서 쓰면 잘 맞아요.",
  "상대가 힘을 모으면 피하기! 지나가면 등 뒤에서 밀어 줘요.",
  "맞기 직전에 버티기를 누르면 튕겨 내요. 상대가 휘청입니다.",
  "기술 게이지가 다 차면 빛나요. 끝에 몰렸을 때 역전 기회예요.",
];
const seoulDay = () => new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);

/* ---------- 저장 ---------- */
function freshSave() {
  return {
    v: 1,
    coins: 0,
    owned: ["bear"],
    sel: "bear",
    cosOwned: [],
    equip: {},
    camp: [],
    scores: {},
    best: { survival: 0, survivalScore: 0, ta: 0, taKo: 0 },
    stats: { plays: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, sec: 0, byChar: {}, comebacks: 0, specialWins: 0, parries: 0 },
    ach: [],
    daily: { date: "", prog: {}, done: [] },
    sound: { sfx: true, music: true, vol: 0.8 },
    low: false,
    tutorial: false,
  };
}
/** 망가진 저장값은 그 칸만 처음 값으로 되돌린다 */
export function sanitizeSave(raw) {
  const d = freshSave();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const num = (v, def = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(v, 1e10)) : def);
  const ids = FIGHTERS.map((f) => f.id);
  const list = (v, ok) => (Array.isArray(v) ? [...new Set(v.filter(ok))] : []);
  d.coins = Math.floor(num(raw.coins));
  d.owned = [...new Set(["bear", ...list(raw.owned, (i) => ids.includes(i))])];
  if (d.owned.includes(raw.sel)) d.sel = raw.sel;
  d.cosOwned = list(raw.cosOwned, (i) => COSMETICS.some((c) => c.id === i));
  if (raw.equip && typeof raw.equip === "object") {
    for (const c of COSMETICS) if (raw.equip[c.kind] === c.id && d.cosOwned.includes(c.id)) d.equip[c.kind] = c.id;
  }
  d.camp = list(raw.camp, (i) => CAMPAIGN.some((s) => s.id === i));
  if (raw.scores && typeof raw.scores === "object") {
    for (const s of CAMPAIGN) if (num(raw.scores[s.id])) d.scores[s.id] = num(raw.scores[s.id]);
  }
  if (raw.best && typeof raw.best === "object") for (const k of Object.keys(d.best)) d.best[k] = num(raw.best[k]);
  if (raw.stats && typeof raw.stats === "object") {
    for (const k of Object.keys(d.stats)) if (k !== "byChar") d.stats[k] = num(raw.stats[k]);
    if (raw.stats.byChar && typeof raw.stats.byChar === "object") for (const i of ids) if (num(raw.stats.byChar[i])) d.stats.byChar[i] = num(raw.stats.byChar[i]);
  }
  d.ach = list(raw.ach, (i) => ACHIEVEMENTS.some((a) => a.id === i));
  if (raw.daily && typeof raw.daily === "object" && typeof raw.daily.date === "string") {
    d.daily.date = raw.daily.date;
    if (raw.daily.prog && typeof raw.daily.prog === "object") for (const p of DAILY_POOL) if (num(raw.daily.prog[p.id])) d.daily.prog[p.id] = num(raw.daily.prog[p.id]);
    d.daily.done = list(raw.daily.done, (i) => DAILY_POOL.some((p) => p.id === i));
  }
  if (raw.sound && typeof raw.sound === "object") {
    d.sound.sfx = raw.sound.sfx !== false;
    d.sound.music = raw.sound.music !== false;
    d.sound.vol = clamp(num(raw.sound.vol, 0.8), 0, 1);
  }
  d.low = raw.low === true;
  d.tutorial = raw.tutorial === true;
  return d;
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? sanitizeSave(JSON.parse(raw)) : freshSave();
  } catch (_) {
    return freshSave();
  }
}

/* ---------- 얼굴 그림 (목록 · HUD 공용) ---------- */
const FACES = {};
function faceOf(id) {
  if (FACES[id]) return FACES[id];
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const p = new Puppet(id);
  p.nextBlink = 99;
  p.update(1 / 60);
  const s = size / 212;
  p.draw(c.getContext("2d"), size / 2, size / 2 + 152 * s, s);
  FACES[id] = c.toDataURL();
  return FACES[id];
}

/* ---------- 튜토리얼 ---------- */
const TUT = [
  { pc: "A · D (또는 ← →) 로 상대에게 다가가요", mo: "왼쪽 화살표로 상대에게 다가가요" },
  { pc: "Space 로 3번 밀어요", mo: "밀기 버튼으로 3번 밀어요" },
  { pc: "Shift 를 꾹 눌렀다 떼면 돌진! 가까이서 써요", mo: "돌진을 꾹 눌렀다 떼면 돌진! 가까이서 써요" },
  { pc: "상대가 밀어요! S 를 눌러 버텨요", mo: "상대가 밀어요! 버티기를 눌러요" },
  { pc: "기술 게이지가 찼어요. E 를 눌러요!", mo: "기술 게이지가 찼어요. 기술 버튼!" },
  { pc: "이제 밖으로 밀어내면 이겨요!", mo: "이제 밖으로 밀어내면 이겨요!" },
];

/* ---------- 게임 ---------- */
class App {
  constructor() {
    this.cv = $("game");
    this.g = this.cv.getContext("2d", { alpha: false });
    this.save = loadSave();
    this.stage = new Stage();
    this.fx = new FX();
    this.sfx = new Sfx();
    this.screen = "title";
    this.t = 0;
    this.last = performance.now();
    this.acc = 0;
    this.paused = false;
    this.bout = null;
    this.ais = [];
    this.pp = [];
    this.m = { mode: "demo" };
    this.shake = 0;
    this.zoom = 0;
    this.camX = 0;
    this.slowT = 0;
    this.demoN = 0;
    this.keys = { left: false, right: false, dash: false, guard: false };
    this.touch = { mx: 0, dash: false, guard: false };
    this.hudV = {};
    this.touchOn = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);
    this.perfT = 0;
    this.perfN = 0;
    this.lowAuto = false;
    this.campWorld = 0;
    this.pr = { level: 0, opp: "bunny", world: 0 };
    this.bookTab = "daily";
    this.selView = this.save.sel;
    this.applySound();
    this.applyLow();
    this.bindUi();
    this.bindKeys();
    this.bindTouch();
    this.mountPause();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 120));
    document.addEventListener("visibilitychange", () => {
      this.last = performance.now();
      this.clearInput();
      if (document.hidden) this.sfx.suspend(true);
      else if (!this.paused) this.sfx.suspend(false);
    });
    const unlock = () => {
      const first = !this.sfx.ctx;
      this.sfx.unlock();
      if (first && this.sfx.ctx && !this.sfx.music) this.sfx.startMusic(this.screen === "fight" ? this.m.worldI || 0 : 0);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    this.resize();
    this.toTitle();
    this.loopFn = (n) => this.loop(n);
    requestAnimationFrame(this.loopFn);
    try {
      document.fonts.load('20px "Bagel Fat One"');
      document.fonts.load('20px "Jua"');
    } catch (_) {}
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch (_) {}
  }

  applySound() {
    this.sfx.set({ sfx: this.save.sound.sfx, music: this.save.sound.music, vol: this.save.sound.vol });
  }

  applyLow() {
    const low = this.save.low || this.lowAuto;
    this.stage.quality = low ? 0.5 : 1;
    this.fx.q = low ? 0.5 : 1;
    this.dprMax = low ? 1.25 : 2;
  }

  resize() {
    const r = $("stage").getBoundingClientRect();
    const W = Math.max(2, Math.round(r.width));
    const H = Math.max(2, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprMax);
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.cv.width = Math.round(W * dpr);
    this.cv.height = Math.round(H * dpr);
    this.stage.layout(W, H, dpr);
  }

  /* ---------- 화면 전환 ---------- */
  show(id) {
    for (const s of SECTIONS) $(s).classList.toggle("hidden", s !== id);
    this.screen = id;
    const fight = id === "fight";
    $("hud").classList.toggle("hidden", !fight);
    const mine = fight && this.m.mode !== "demo";
    $("touch").classList.toggle("hidden", !(mine && this.touchOn));
    $("keys").classList.toggle("hidden", !(mine && !this.touchOn && this.W > 760));
    $("quit-chip").classList.toggle("hidden", !(fight && this.m.mode === "practice"));
    $("coach").classList.toggle("hidden", !(fight && this.m.mode === "tutorial"));
    $("danger").style.opacity = 0;
    this.clearInput();
    try {
      if (window.TodayPause && window.TodayPause.sync) window.TodayPause.sync();
    } catch (_) {}
  }

  toTitle() {
    this.newDemo();
    this.show("title");
    this.refreshCoins();
    const nx = this.nextStage();
    $("play-sub").textContent = !this.save.tutorial ? "조작을 배우고 첫 경기!" : nx ? `챔피언십 ${nx.id} · ${nx.name}` : "모든 챔피언십 완료! 무대를 골라요";
    const undone = this.dailyList().some((d) => !this.save.daily.done.includes(d.id));
    $("book-dot").classList.toggle("hidden", !undone);
    if (this.sfx.ctx) this.sfx.startMusic(0);
    this.persist();
  }

  refreshCoins() {
    for (const id of ["title-coin", "sel-coin", "camp-coin", "book-coin"]) $(id).textContent = fmt(this.save.coins);
  }

  nextStage() {
    return CAMPAIGN.find((s) => !this.save.camp.includes(s.id)) || null;
  }

  stageOpen(s) {
    const i = CAMPAIGN.indexOf(s);
    return i === 0 || this.save.camp.includes(CAMPAIGN[i - 1].id) || this.save.camp.includes(s.id);
  }

  worldOpen(w) {
    return this.stageOpen(CAMPAIGN.find((s) => s.world === w));
  }

  /* ---------- 대전 시작 ---------- */
  cosOf() {
    const e = this.save.equip;
    return { head: e.head, face: e.face, body: e.body, tint: e.tint, pose: e.pose };
  }

  setBout(bout, m, ais, worldI) {
    this.bout = bout;
    this.cerOn = false;
    this.m = { worldI, saves: 0, parries: 0, hits: 0, dodgeDash: 0, sec: 0, edge: false, dropped: [false, false], ...m };
    this.ais = ais;
    this.acc = 0;
    this.slowT = 0;
    this.stage.setWorld(WORLDS[worldI].id);
    this.stage.refPose = 0;
    this.stage.refDir = 0;
    this.fx = Object.assign(new FX(), { q: this.fx.q });
    this.pp = bout.f.map((f, i) => this.makePuppet(f, i));
    this.hudV = {};
  }

  makePuppet(f, i) {
    const p = new Puppet(f.def.id, { size: f.size, belt: i === 0 ? "#d43a30" : "#2f62d6", cos: i === 0 && this.m.mode !== "demo" ? this.cosOf() : {} });
    p.face = f.face;
    p.faceK = f.face;
    p.moveAmt = 0;
    return p;
  }

  newDemo() {
    const pairs = [["bear", "bunny"], ["panda", "duck"], ["pig", "cat"], ["tiger", "penguin"]];
    const n = this.demoN;
    this.demoN += 1;
    const [a, b] = pairs[n % pairs.length];
    const worldI = n % WORLDS.length;
    const bout = new Bout({ a: fighterById(a), b: fighterById(b), world: WORLDS[worldI], need: 1 });
    this.setBout(bout, { mode: "demo" }, [new BoutAI(bout, 0, { level: 1, style: "fury" }), new BoutAI(bout, 1, { level: 1, style: "swift" })], worldI);
  }

  enterFight(bout, m, ais, worldI) {
    this.setBout(bout, m, ais, worldI);
    this.show("fight");
    this.sfx.unlock();
    this.sfx.startMusic(worldI);
    $("hf0").src = faceOf(bout.f[0].def.id);
    $("hf1").src = faceOf(bout.f[1].def.id);
    $("hn0").textContent = bout.f[0].def.ko;
    $("hscore").classList.toggle("hidden", m.mode !== "survival" && m.mode !== "ta");
    this.setOppName(m.oppName || bout.f[1].def.ko);
    const st = this.save.stats;
    st.byChar[this.save.sel] = (st.byChar[this.save.sel] || 0) + 1;
  }

  setOppName(s) {
    $("hn1").textContent = s;
  }

  startDuel(stage) {
    const w = WORLDS[stage.world];
    const bout = new Bout({ a: fighterById(this.save.sel), b: fighterById(stage.opp), world: w, need: stage.need, bOpt: { size: stage.size || 1, bonus: stage.bonus || 0 } });
    this.enterFight(bout, { mode: "duel", stage, oppName: stage.name }, [new BoutAI(bout, 1, { level: stage.L, style: stage.style })], stage.world);
  }

  survivalFoe(n) {
    const pool = FIGHTERS.filter((f) => f.id !== this.save.sel);
    const def = pool[Math.floor(Math.random() * pool.length)];
    return { def, opt: { size: 1 + Math.min(0.18, Math.floor(n / 5) * 0.06), bonus: n >= 10 ? 1 : 0 }, level: n < 3 ? 0 : n < 7 ? 1 : 2, style: STYLE_IDS[n % STYLE_IDS.length] };
  }

  startSurvival() {
    const fo = this.survivalFoe(0);
    const worldI = this.campWorld;
    const bout = new Bout({ a: fighterById(this.save.sel), b: fo.def, world: WORLDS[worldI], need: 99, time: 26, bOpt: fo.opt, endless: true });
    this.enterFight(bout, { mode: "survival", streak: 0, score: 0 }, [new BoutAI(bout, 1, { level: fo.level, style: fo.style })], worldI);
  }

  nextSurvival() {
    const m = this.m;
    const b = this.bout;
    m.streak += 1;
    m.score += 300 + m.streak * 60 + Math.round(b.f[0].bal) * 2;
    const bal = b.f[0].bal;
    const fo = this.survivalFoe(m.streak);
    b.setOpponent(fo.def, fo.opt);
    b.wins = [0, 0];
    b.startRound(true);
    b.f[0].bal = Math.min(100, bal + 35);
    b.phaseT = 1.1;
    this.ais = [new BoutAI(b, 1, { level: fo.level, style: fo.style })];
    this.pp[1] = this.makePuppet(b.f[1], 1);
    $("hf1").src = faceOf(fo.def.id);
    this.setOppName(fo.def.ko);
    this.sfx.coin();
    this.fx.text(this.W / 2, this.stage.gy - 140 * this.stage.S, `${m.streak}연승!`, 40 * Math.max(0.7, this.stage.S), "#ffd23f");
  }

  startTa() {
    const def = this.survivalFoe(0).def;
    const worldI = this.campWorld;
    const bout = new Bout({ a: fighterById(this.save.sel), b: def, world: WORLDS[worldI], need: 99, time: 20, endless: true });
    bout.f[1].bal = 75;
    this.enterFight(bout, { mode: "ta", left: 75, ko: 0, streak: 0, bestRun: 0, score: 0 }, [new BoutAI(bout, 1, { level: 0, style: "rush" })], worldI);
  }

  nextTa() {
    const m = this.m;
    const b = this.bout;
    const won = b.roundWinner === 0;
    const def = won ? this.survivalFoe(m.ko).def : b.f[1].def;
    const level = m.ko < 5 ? 0 : m.ko < 12 ? 1 : 2;
    if (won) {
      b.setOpponent(def);
      this.pp[1] = this.makePuppet(b.f[1], 1);
      $("hf1").src = faceOf(def.id);
      this.setOppName(def.ko);
    }
    const bal = b.f[0].bal;
    b.wins = [0, 0];
    b.startRound(true);
    b.f[0].bal = Math.min(100, bal + 40);
    b.f[1].bal = 75;
    b.phaseT = 1.5;
    this.ais = [new BoutAI(b, 1, { level, style: STYLE_IDS[m.ko % STYLE_IDS.length] })];
  }

  startPractice() {
    const { level, opp, world } = this.pr;
    const bout = new Bout({ a: fighterById(this.save.sel), b: fighterById(opp), world: WORLDS[world], need: 99, time: 0, endless: true });
    const ais = level > 0 ? [new BoutAI(bout, 1, { level: level - 1, style: "smart" })] : [];
    this.enterFight(bout, { mode: "practice" }, ais, world);
  }

  startTutorial(after) {
    const bout = new Bout({ a: fighterById(this.save.sel), b: fighterById("bunny"), world: WORLDS[0], need: 99, time: 0, endless: true });
    bout.phaseT = 1.2;
    this.enterFight(bout, { mode: "tutorial", step: 0, n: 0, after, pushT: 0, stepT: 0 }, [], 0);
    this.tutText();
  }

  tutText() {
    const m = this.m;
    $("coach-n").textContent = `${m.step + 1} / ${TUT.length}`;
    $("coach-t").textContent = this.touchOn ? TUT[m.step].mo : TUT[m.step].pc;
  }

  tutNext() {
    const m = this.m;
    m.step += 1;
    m.n = 0;
    m.stepT = 0;
    this.sfx.coin();
    if (m.step >= TUT.length) {
      this.endTutorial(true);
      return;
    }
    if (m.step === 4) this.bout.f[0].spec = 100;
    this.tutText();
  }

  endTutorial(done) {
    const after = this.m.after;
    if (!this.save.tutorial && done) {
      this.save.coins += 100;
      this.toast("튜토리얼 완료! 100 코인");
    }
    this.save.tutorial = true;
    this.persist();
    if (after === "play") this.startDuel(CAMPAIGN[0]);
    else this.toTitle();
  }

  tutTick(dt) {
    const m = this.m;
    const b = this.bout;
    m.stepT += dt;
    const [me, op] = b.f;
    if (b.phase === "roundEnd" && b.phaseT > 0.9) {
      if (m.step === TUT.length - 1 && b.roundWinner === 0) {
        this.tutNext();
        return;
      }
      b.startRound();
      b.phaseT = 1.5;
      if (m.step === 4) b.f[0].spec = 100;
    }
    if (b.phase !== "fight") return;
    if (m.step === 0 && Math.abs(me.x - op.x) < 170) this.tutNext();
    if (m.step === 3) {
      // 상대가 다가와 밀기만 한다
      const inp = b.input[1];
      inp.mx = op.x > me.x ? -1 : 1;
      m.pushT -= dt;
      if (m.pushT <= 0 && Math.abs(me.x - op.x) < 170) {
        press(inp, "push");
        m.pushT = 1.2;
      }
      me.bal = Math.max(me.bal, 45);
    } else b.input[1].mx = 0;
    if (m.step === 4) me.spec = Math.max(me.spec, me.state === "special" ? 0 : 100);
    if (m.step >= 3 && m.step !== 3) op.bal = Math.max(op.bal, 30);
  }

  /* ---------- 결과 ---------- */
  dailyList() {
    const key = seoulDay();
    if (this.save.daily.date !== key) this.save.daily = { date: key, prog: {}, done: [] };
    let s = Number(key.replace(/-/g, "")) % 233280;
    const pool = [...DAILY_POOL];
    const out = [];
    for (let i = 0; i < 3; i += 1) {
      s = (s * 9301 + 49297) % 233280;
      out.push(pool.splice(s % pool.length, 1)[0]);
    }
    return out;
  }

  dailyBump(k, v, who, news) {
    const D = this.save.daily;
    for (const d of this.dailyList()) {
      if (d.k !== k || (d.who && d.who !== who) || D.done.includes(d.id)) continue;
      D.prog[d.id] = k === "streak" ? Math.max(D.prog[d.id] || 0, v) : (D.prog[d.id] || 0) + v;
      if (D.prog[d.id] >= d.n) {
        D.done.push(d.id);
        this.save.coins += d.coin;
        const msg = `오늘의 도전 완료: ${d.ko} (+${d.coin})`;
        if (news) news.push(msg);
        else this.toast(msg);
      }
    }
  }

  checkAch(news) {
    const S = this.save;
    const st = S.stats;
    const val = { wins: st.wins, bestStreak: st.bestStreak, chars: S.owned.length, campaign: S.camp.length, bestSurvival: S.best.survival, comebacks: st.comebacks, specialWins: st.specialWins, parries: st.parries, bestTaKo: S.best.taKo };
    for (const a of ACHIEVEMENTS) {
      if (!S.ach.includes(a.id) && val[a.k] >= a.n) {
        S.ach.push(a.id);
        S.coins += a.coin;
        news.push(`업적 달성: ${a.ko} (+${a.coin})`);
      }
    }
  }

  /** 승패 공통 기록 */
  record(won, news) {
    const S = this.save;
    const st = S.stats;
    const m = this.m;
    const ko = this.bout.lastKo || {};
    st.plays += 1;
    st.sec += m.sec;
    st.parries += m.parries;
    this.dailyBump("parry", m.parries, null, news);
    this.dailyBump("dodgeDash", m.dodgeDash, null, news);
    if (won) {
      st.wins += 1;
      st.streak += 1;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
      if (m.saves > 0) st.comebacks += 1;
      if (ko.by === "special") {
        st.specialWins += 1;
        this.dailyBump("specialWin", 1, null, news);
      }
      if (ko.by === "dash") this.dailyBump("dashWin", 1, null, news);
      if (m.sec < 30) this.dailyBump("fastWin", 1, null, news);
      if (!m.edge) this.dailyBump("noEdge", 1, null, news);
      this.dailyBump("charWin", 1, S.sel, news);
      this.dailyBump("streak", st.streak, null, news);
    } else {
      st.losses += 1;
      st.streak = 0;
    }
  }

  finishDuel() {
    const m = this.m;
    const b = this.bout;
    m.done = true;
    const won = b.winner === 0;
    const stage = m.stage;
    const secs = Math.round(m.sec);
    const news = [];
    const S = this.save;
    let score = 0;
    let coins = 8;
    if (won) {
      score = 1000 + b.wins[0] * 200 - b.wins[1] * 100 + Math.max(0, 60 - secs) * 12 + Math.round(b.f[0].bal) * 4 + m.saves * 120 + m.parries * 40;
      coins = 30 + stage.world * 10 + (stage.champ ? 40 : 0);
    } else score = b.wins[0] * 150 + m.hits * 10;
    this.record(won, news);
    const firstClear = won && !S.camp.includes(stage.id);
    if (firstClear) {
      S.camp.push(stage.id);
      coins += 40 + stage.n * 10 + stage.world * 15;
      for (const f of FIGHTERS) {
        if (f.unlock === stage.id && !S.owned.includes(f.id)) {
          S.owned.push(f.id);
          news.push(`새 친구 합류: ${f.ko}!`);
        }
      }
      if (stage.champ && stage.world < WORLDS.length - 1) news.push(`새 경기장 열림: ${WORLDS[stage.world + 1].ko}`);
    }
    if (won) coins += Math.min(10, S.stats.streak) * 3;
    S.coins += coins;
    if (won && score > (S.scores[stage.id] || 0)) S.scores[stage.id] = score;
    this.checkAch(news);
    this.persist();
    const next = CAMPAIGN[CAMPAIGN.indexOf(stage) + 1];
    this.showResult({
      won,
      tag: `챔피언십 ${stage.id} · ${stage.name}`,
      title: won ? (stage.boss ? "씨름왕 탄생!" : stage.champ ? "월드 챔피언!" : "승리!") : "아까워요!",
      sub: won ? (m.saves > 0 ? "끝에서 버텨 낸 멋진 역전이었어요!" : "상대를 멋지게 밀어냈어요!") : LOSE_TIPS[Math.floor(Math.random() * LOSE_TIPS.length)],
      rows: [["점수", fmt(score)], ["시간", `${secs}초`], ["코인", `+${coins}`], ["연승", `${S.stats.streak}`]],
      news,
      nextLabel: won ? (next ? "다음 경기" : "챔피언십 목록") : "다시 도전!",
      onNext: won ? () => (next ? this.startDuel(next) : this.openCamp()) : () => this.startDuel(stage),
      onRetry: () => this.startDuel(stage),
      hideRetry: !won,
    });
  }

  finishSurvival() {
    const m = this.m;
    const b = this.bout;
    m.done = true;
    b.setState(b.f[1], "victory");
    const S = this.save;
    const news = [];
    const coins = 10 + m.streak * 18;
    this.record(m.streak > 0, news);
    S.stats.streak = 0;
    const isBest = m.streak > S.best.survival;
    S.best.survival = Math.max(S.best.survival, m.streak);
    const newScore = m.score > S.best.survivalScore;
    S.best.survivalScore = Math.max(S.best.survivalScore, m.score);
    S.coins += coins;
    if (isBest) news.push("서바이벌 최고 기록!");
    this.checkAch(news);
    this.persist();
    this.showResult({
      won: m.streak >= 3,
      forceLose: m.streak < 3,
      tag: "서바이벌",
      title: `${m.streak}연승`,
      sub: m.streak ? "균형 관리가 오래 버티는 비결이에요." : "버티기와 피하기로 균형을 아껴 봐요.",
      rows: [["점수", fmt(m.score)], ["최고", `${S.best.survival}연승`], ["코인", `+${coins}`], ["시간", `${Math.round(m.sec)}초`]],
      news,
      nextLabel: "다시 도전!",
      onNext: () => this.startSurvival(),
      hideRetry: true,
      rank: newScore && m.score > 0 ? { score: m.score, label: `${m.streak}연승` } : null,
    });
  }

  finishTa() {
    const m = this.m;
    m.done = true;
    const b = this.bout;
    if (b.phase === "fight") {
      b.phase = "over";
      b.setState(b.f[0], "victory");
    }
    const S = this.save;
    const news = [];
    const coins = 10 + m.ko * 12;
    this.record(m.ko >= 3, news);
    const isBest = m.score > S.best.ta;
    S.best.ta = Math.max(S.best.ta, m.score);
    S.best.taKo = Math.max(S.best.taKo, m.ko);
    S.coins += coins;
    if (isBest) news.push("타임어택 최고 점수!");
    this.checkAch(news);
    this.persist();
    this.showResult({
      won: m.ko >= 3,
      forceLose: m.ko < 3,
      tag: "타임어택",
      title: `${m.ko}번 밀어냄`,
      sub: "빨리 이기고 연속으로 밀어내면 점수가 크게 올라요.",
      rows: [["점수", fmt(m.score)], ["최고", fmt(S.best.ta)], ["최고 연속", `${m.bestRun}`], ["코인", `+${coins}`]],
      news,
      nextLabel: "다시 도전!",
      onNext: () => this.startTa(),
      hideRetry: true,
      rank: isBest && m.score > 0 ? { score: m.score, label: `${m.ko}번 밀어냄` } : null,
    });
  }

  showResult(r) {
    this.lastResult = r;
    $("res-tag").textContent = r.tag;
    $("res-title").textContent = r.title;
    $("res-sub").textContent = r.sub;
    $("res-rows").innerHTML = r.rows.map(([k, v]) => `<li>${k}<b>${v}</b></li>`).join("");
    $("res-news").innerHTML = r.news.map((n) => `<p>${n}</p>`).join("");
    $("res-next").textContent = r.nextLabel;
    $("res-retry").classList.toggle("hidden", !!r.hideRetry);
    document.querySelector(".res-card").classList.toggle("lose", !r.won);
    document.querySelector(".res-btns").style.gridTemplateColumns = r.hideRetry ? "2fr 1fr" : "";
    const box = $("res-rank");
    box.classList.add("hidden");
    box.innerHTML = "";
    if (r.rank && window.TodayGameRank) {
      try {
        box.classList.remove("hidden");
        window.TodayGameRank.reset();
        window.TodayGameRank.mount({ gameId: GAME_ID, gameTitle: "통통 동물 씨름왕", formParent: box });
        window.TodayGameRank.open(Math.max(1, Math.round(r.rank.score)), { label: r.rank.label });
      } catch (e) {
        console.warn(e);
      }
    }
    this.ceremony();
    this.show("result");
    this.refreshCoins();
    this.sfx.stopMusic();
    if (r.won) {
      this.sfx.win();
      this.fx.confetti(this.W, Math.max(0.6, this.stage.S), 80);
    } else this.sfx.lose();
  }

  /** 결과 화면 연출: 승자는 만세, 패자는 엉덩방아. 카드에 안 가리는 자리로 옮겨 세운다 */
  ceremony() {
    const b = this.bout;
    const wide = this.W / this.H > 1.2;
    let wi = b.f[0].state === "out" ? 1 : b.f[1].state === "out" ? 0 : b.winner;
    if (wi < 0) wi = 0;
    const li = 1 - wi;
    const wx = wide ? -250 : -95;
    const lx = wide ? -40 : 105;
    this.cerX = wide ? (this.W * 0.06) / this.stage.S : 0; // 넓은 화면은 카드 반대쪽으로 비킨다
    const P = this.pp;
    b.setState(b.f[wi], "victory");
    Object.assign(P[wi], { landed: { x: wx, z: 0 }, lift: 0, spin: 0, face: 1, faceK: 1, teeter: false, locked: false, vx: 0 });
    Object.assign(P[li], { landed: { x: lx, z: 24 }, lift: 0, spin: 0, face: -1, faceK: -1, teeter: false, locked: false, vx: 0 });
    P[wi].setState("victory");
    P[li].setState("defeat");
    P[li].stateT = 0.3;
    P[wi].hitEyeT = 0;
    P[li].hitEyeT = 0;
    this.stage.refDir = wx > 0 ? 1 : -1;
    this.stage.refPose = 1;
    this.cerOn = true;
    const fl = $("flash");
    fl.classList.remove("go");
    void fl.offsetWidth;
    fl.classList.add("go");
  }

  toast(msg) {
    const p = document.createElement("p");
    p.textContent = msg;
    $("toasts").appendChild(p);
    setTimeout(() => p.remove(), 2700);
  }

  /* ---------- 메뉴 화면 ---------- */
  bindUi() {
    $("btn-play").addEventListener("click", () => this.onPlay());
    document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => this.go(b.dataset.go)));
    document.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", () => {
        this.sfx.click();
        this.toTitle();
      })
    );
    $("res-next").addEventListener("click", () => this.lastResult.onNext());
    $("res-retry").addEventListener("click", () => this.lastResult.onRetry());
    $("res-menu").addEventListener("click", () => this.toTitle());
    $("quit-chip").addEventListener("click", () => this.toTitle());
    $("coach-skip").addEventListener("click", () => this.endTutorial(false));
    $("pr-go").addEventListener("click", () => this.startPractice());
    $("pr-tut").addEventListener("click", () => this.startTutorial("title"));
    $("set-tut").addEventListener("click", () => this.startTutorial("title"));
    $("sel-go").addEventListener("click", () => this.selAction());
    $("book-tabs").addEventListener("click", (e) => {
      const t = e.target.closest("[data-tab]");
      if (t) {
        this.bookTab = t.dataset.tab;
        this.sfx.click();
        this.renderBook();
      }
    });
    const sync = () => {
      this.save.sound.sfx = $("set-sfx").checked;
      this.save.sound.music = $("set-music").checked;
      this.save.sound.vol = Number($("set-vol").value) / 100;
      this.save.low = $("set-low").checked;
      this.applySound();
      this.applyLow();
      this.resize();
      this.persist();
    };
    for (const id of ["set-sfx", "set-music", "set-vol", "set-low"]) $(id).addEventListener("change", sync);
    $("set-vol").addEventListener("input", sync);
    $("set-reset").addEventListener("click", () => {
      if (!window.confirm("코인, 캐릭터, 기록을 모두 지울까요? 되돌릴 수 없어요.")) return;
      this.save = freshSave();
      this.applySound();
      this.persist();
      this.toTitle();
    });
  }

  onPlay() {
    this.sfx.unlock();
    this.sfx.click();
    if (!this.save.tutorial) {
      this.startTutorial("play");
      return;
    }
    const nx = this.nextStage();
    if (nx) this.startDuel(nx);
    else this.openCamp();
  }

  go(name) {
    this.sfx.unlock();
    this.sfx.click();
    if (name === "camp") this.openCamp();
    else if (name === "survival") this.startSurvival();
    else if (name === "ta") this.startTa();
    else if (name === "practice") this.openPractice();
    else if (name === "select") this.openSelect();
    else if (name === "book") {
      this.renderBook();
      this.show("book");
    } else if (name === "settings") {
      const s = this.save.sound;
      $("set-sfx").checked = s.sfx;
      $("set-music").checked = s.music;
      $("set-vol").value = Math.round(s.vol * 100);
      $("set-low").checked = this.save.low;
      this.show("settings");
    }
    this.refreshCoins();
  }

  /* 캐릭터 선택 */
  openSelect() {
    this.selView = this.save.sel;
    this.renderSelect();
    this.selEnter(this.selView);
    this.show("select");
  }

  selEnter(id) {
    this.selP = new Puppet(id, { cos: id === this.save.sel ? this.cosOf() : {} });
    this.selP.moveAmt = 0;
    this.selP.skill = fighterById(id).skill.id;
    this.selT = 0;
    this.selLanded = false;
  }

  renderSelect() {
    const S = this.save;
    const f = fighterById(this.selView);
    $("sel-role").textContent = f.role;
    $("sel-name").textContent = f.ko;
    $("sel-en").textContent = f.en;
    $("sel-desc").textContent = f.desc;
    const COL = { POWER: "#ef5b3b", DEFENSE: "#2f8fd8", SPEED: "#3cae5a", BALANCE: "#a06be0", SPECIAL: "#ffb31f" };
    $("sel-stats").innerHTML = [["POWER", f.power], ["DEFENSE", f.defense], ["SPEED", f.speed], ["BALANCE", f.balance], ["SPECIAL", f.special]]
      .map(([k, v]) => `<li>${k}<i><u style="width:${v * 10}%;background:${COL[k]}"></u></i></li>`)
      .join("");
    $("sel-skill").innerHTML = `<b>${f.skill.ko}</b><br />${f.skill.desc}`;
    const own = S.owned.includes(f.id);
    const go = $("sel-go");
    const lock = $("sel-lock");
    go.disabled = false;
    if (own) {
      go.textContent = S.sel === f.id ? "선택됨 · 이 친구로 씨름해요" : "이 친구로 선택";
      lock.textContent = "";
    } else {
      go.textContent = `${fmt(f.price)} 코인으로 데려오기`;
      go.disabled = S.coins < f.price;
      lock.textContent = `또는 챔피언십 ${f.unlock} 을 깨면 합류해요`;
    }
    $("sel-list").innerHTML = FIGHTERS.map((x) => {
      const has = S.owned.includes(x.id);
      return `<button type="button" data-id="${x.id}" class="${x.id === this.selView ? "on" : ""} ${has ? "" : "locked"}" aria-label="${x.ko}${has ? "" : " (잠김)"}"><img src="${faceOf(x.id)}" alt="" />${x.ko.split(" ").pop()}${S.sel === x.id ? '<span class="cur">선택</span>' : ""}</button>`;
    }).join("");
    $("sel-list").onclick = (e) => {
      const b = e.target.closest("[data-id]");
      if (!b) return;
      this.sfx.click();
      this.selView = b.dataset.id;
      this.renderSelect();
      this.selEnter(this.selView);
    };
    $("cos-list").innerHTML = COSMETICS.map((c) => {
      const has = S.cosOwned.includes(c.id);
      const on = S.equip[c.kind] === c.id;
      return `<button type="button" data-c="${c.id}" class="${on ? "on" : ""}">${c.ko}${has ? "" : `<small>${fmt(c.price)}</small>`}</button>`;
    }).join("");
    $("cos-list").onclick = (e) => {
      const b = e.target.closest("[data-c]");
      if (!b) return;
      const c = COSMETICS.find((x) => x.id === b.dataset.c);
      if (!S.cosOwned.includes(c.id)) {
        if (S.coins < c.price) {
          this.toast("코인이 조금 모자라요");
          return;
        }
        S.coins -= c.price;
        S.cosOwned.push(c.id);
        this.sfx.coin();
      }
      if (S.equip[c.kind] === c.id) delete S.equip[c.kind];
      else S.equip[c.kind] = c.id;
      this.persist();
      this.refreshCoins();
      this.renderSelect();
      if (this.selView === S.sel) this.selEnter(S.sel);
    };
  }

  selAction() {
    const S = this.save;
    const f = fighterById(this.selView);
    if (!S.owned.includes(f.id)) {
      if (S.coins < f.price) return;
      S.coins -= f.price;
      S.owned.push(f.id);
      this.sfx.coin();
      this.toast(`${f.ko} 합류!`);
      const news = [];
      this.checkAch(news);
      news.forEach((n) => this.toast(n));
    }
    S.sel = f.id;
    this.sfx.click();
    this.persist();
    this.refreshCoins();
    this.renderSelect();
    this.selEnter(f.id);
  }

  drawSelect(dt) {
    const cv = $("sel-cv");
    const r = cv.getBoundingClientRect();
    if (r.width < 2) return;
    const dpr = this.dpr;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const g = cv.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    const p = this.selP;
    if (!p) return;
    this.selT += dt;
    const t = this.selT;
    // 캐릭터마다 다른 등장: 떨어져 내려와 자기 기술을 보여 주고 만세
    if (t < 0.42) {
      const q = 0.42 - t;
      p.lift = q * q * 3400;
      p.setState("idle");
    } else if (!this.selLanded) {
      this.selLanded = true;
      p.lift = 0;
      p.impact(0.9, 0);
      this.sfx.thump(0.45);
    }
    if (t > 0.6 && t < 1.75) {
      p.setState("special");
      p.stateT = t - 0.6;
      if (p.skill === "spin" || p.skill === "roll") p.spin = (t - 0.6) * 12;
      if (p.skill === "hop") p.lift = Math.abs(Math.sin((t - 0.6) * 6)) * 60;
    } else if (t >= 1.75 && t < 2.7) {
      p.spin = 0;
      p.lift = 0;
      p.setState("victory");
    } else if (t >= 2.7) p.setState("idle");
    p.update(dt);
    const s = Math.min(r.width / 280, (r.height * 0.82) / 300);
    p.drawShadow(g, r.width / 2, r.height * 0.88, s);
    p.draw(g, r.width / 2, r.height * 0.88, s);
  }

  /* 챔피언십 */
  openCamp() {
    const nx = this.nextStage();
    this.campWorld = nx ? nx.world : this.campWorld;
    this.renderCamp();
    this.show("camp");
    this.refreshCoins();
  }

  renderCamp() {
    const S = this.save;
    $("world-tabs").innerHTML = WORLDS.map((w, i) => `<button type="button" data-w="${i}" class="${i === this.campWorld ? "on" : ""}" ${this.worldOpen(i) ? "" : "disabled"}>${i + 1}. ${w.ko.split(" ")[0]}</button>`).join("");
    $("world-tabs").onclick = (e) => {
      const b = e.target.closest("[data-w]");
      if (!b || b.disabled) return;
      this.sfx.click();
      this.campWorld = Number(b.dataset.w);
      this.renderCamp();
    };
    const w = WORLDS[this.campWorld];
    $("world-sub").textContent = `${w.ko} — ${w.sub}`;
    const list = CAMPAIGN.filter((s) => s.world === this.campWorld);
    $("stage-list").innerHTML = list
      .map((s) => {
        const open = this.stageOpen(s);
        const done = S.camp.includes(s.id);
        const best = S.scores[s.id];
        return `<button type="button" class="stage-card ${s.champ ? "champ" : ""} ${s.boss ? "boss" : ""}" data-s="${s.id}" ${open ? "" : "disabled"}>
          <span class="n">${s.id}</span><img src="${faceOf(s.opp)}" alt="" />
          <span><b>${s.name}${s.boss ? " · 최종 보스" : s.champ ? " · 월드 챔피언" : ""}</b><small>${AI_STYLES[s.style].ko} · ${LV_KO[s.L]} · ${s.need === 1 ? "단판" : "3판 2선승"}</small></span>
          <span class="st">${open ? (done ? `완료${best ? `<br />${fmt(best)}점` : ""}` : "도전") : "잠김"}</span></button>`;
      })
      .join("");
    $("stage-list").onclick = (e) => {
      const b = e.target.closest("[data-s]");
      if (!b || b.disabled) return;
      this.startDuel(CAMPAIGN.find((s) => s.id === b.dataset.s));
    };
  }

  /* 연습 */
  openPractice() {
    this.renderPractice();
    this.show("practice");
  }

  renderPractice() {
    const pr = this.pr;
    const chip = (id, html, on) => `<button type="button" data-v="${id}" class="${on ? "on" : ""}">${html}</button>`;
    $("pr-level").innerHTML = ["허수아비", "초급", "중급", "고급"].map((t, i) => chip(i, t, pr.level === i)).join("");
    $("pr-opp").innerHTML = FIGHTERS.map((f) => chip(f.id, `<img src="${faceOf(f.id)}" alt="${f.ko}" />`, pr.opp === f.id)).join("");
    $("pr-world").innerHTML = WORLDS.map((w, i) => (this.worldOpen(i) ? chip(i, w.ko.split(" ")[0], pr.world === i) : "")).join("");
    const bind = (id, k, cast) => {
      $(id).onclick = (e) => {
        const b = e.target.closest("[data-v]");
        if (!b) return;
        this.sfx.click();
        pr[k] = cast(b.dataset.v);
        this.renderPractice();
      };
    };
    bind("pr-level", "level", Number);
    bind("pr-opp", "opp", String);
    bind("pr-world", "world", Number);
  }

  /* 도감 · 업적 */
  renderBook() {
    const S = this.save;
    document.querySelectorAll("#book-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === this.bookTab));
    const body = $("book-body");
    if (this.bookTab === "daily") {
      const D = S.daily;
      body.innerHTML = this.dailyList()
        .map((d) => {
          const done = D.done.includes(d.id);
          return `<div class="bk-row ${done ? "done" : ""}"><span><b>${d.ko}</b><small>${done ? "오늘 완료!" : `${Math.min(D.prog[d.id] || 0, d.n)} / ${d.n}`}</small></span><em>${done ? "완료" : `+${d.coin}`}</em></div>`;
        })
        .join("");
    } else if (this.bookTab === "dex") {
      body.innerHTML = `<div class="dex">${FIGHTERS.map((f) => {
        const has = S.owned.includes(f.id);
        return `<div class="${has ? "" : "off"}"><img src="${faceOf(f.id)}" alt="" /><b>${has ? f.ko : "???"}</b><small>${f.role}<br />${has ? `특기: ${f.skill.ko}` : `챔피언십 ${f.unlock} 또는 ${fmt(f.price)} 코인`}</small></div>`;
      }).join("")}</div>`;
    } else if (this.bookTab === "ach") {
      body.innerHTML = ACHIEVEMENTS.map((a) => {
        const done = S.ach.includes(a.id);
        return `<div class="bk-row ${done ? "done" : ""}"><span><b>${a.ko}</b><small>${a.desc}</small></span><em>${done ? "달성" : `+${a.coin}`}</em></div>`;
      }).join("");
    } else {
      const st = S.stats;
      const most = Object.entries(st.byChar).sort((a, b) => b[1] - a[1])[0];
      const rate = st.plays ? Math.round((st.wins / st.plays) * 100) : 0;
      const min = Math.round(st.sec / 60);
      const rows = [
        ["총 경기", `${fmt(st.plays)}판`],
        ["승리", `${fmt(st.wins)}승 (승률 ${rate}%)`],
        ["최고 연승", `${st.bestStreak}연승`],
        ["서바이벌 최고", `${S.best.survival}연승`],
        ["타임어택 최고", `${fmt(S.best.ta)}점 · ${S.best.taKo}번`],
        ["가장 많이 쓴 친구", most ? fighterById(most[0]).ko : "아직 없어요"],
        ["총 플레이 시간", min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`],
      ];
      body.innerHTML = rows.map(([k, v]) => `<div class="bk-row"><span><b>${k}</b></span><em>${v}</em></div>`).join("");
    }
    this.refreshCoins();
  }

  /* ---------- 입력 ---------- */
  clearInput() {
    this.keys.left = this.keys.right = this.keys.dash = this.keys.guard = false;
    this.touch.mx = 0;
    this.touch.dash = this.touch.guard = false;
    document.querySelectorAll(".tb.on, .pad span.on").forEach((e) => e.classList.remove("on"));
  }

  mine() {
    return this.screen === "fight" && !this.paused && this.bout && this.m.mode !== "demo" ? this.bout.input[0] : null;
  }

  bindKeys() {
    const HOLD = { KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", ShiftLeft: "dash", ShiftRight: "dash", KeyS: "guard", ArrowDown: "guard" };
    const TAP = { Space: "push", KeyE: "special", KeyW: "dodge", ArrowUp: "dodge" };
    window.addEventListener("keydown", (e) => {
      if (this.screen !== "fight" || e.target.closest?.("input")) return;
      const h = HOLD[e.code];
      const t = TAP[e.code];
      if (!h && !t) return;
      e.preventDefault();
      if (e.repeat) return; // 꾹 눌러도 한 번만
      if (h) this.keys[h] = true;
      const inp = this.mine();
      if (t && inp) press(inp, t);
    });
    window.addEventListener("keyup", (e) => {
      const h = HOLD[e.code];
      if (h) this.keys[h] = false;
    });
    window.addEventListener("blur", () => this.clearInput());
  }

  bindTouch() {
    const pad = $("pad");
    let padId = null;
    const setPad = (e) => {
      const r = pad.getBoundingClientRect();
      const mx = e.clientX < r.left + r.width / 2 ? -1 : 1;
      this.touch.mx = mx;
      $("pad-l").classList.toggle("on", mx < 0);
      $("pad-r").classList.toggle("on", mx > 0);
    };
    const padOff = (e) => {
      if (e.pointerId !== padId) return;
      padId = null;
      this.touch.mx = 0;
      $("pad-l").classList.remove("on");
      $("pad-r").classList.remove("on");
    };
    pad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      padId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      setPad(e);
    });
    pad.addEventListener("pointermove", (e) => {
      if (e.pointerId === padId) setPad(e);
    });
    for (const n of ["pointerup", "pointercancel", "lostpointercapture"]) pad.addEventListener(n, padOff);
    const hook = (id, down, up) => {
      const b = $(id);
      let pid = null;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (pid !== null) return; // 같은 버튼 중복 입력 막기
        pid = e.pointerId;
        b.setPointerCapture(e.pointerId);
        b.classList.add("on");
        down();
      });
      const off = (e) => {
        if (e.pointerId !== pid) return;
        pid = null;
        b.classList.remove("on");
        up();
      };
      for (const n of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(n, off);
      // 키보드로 버튼을 누른 경우
      b.addEventListener("click", (e) => {
        if (e.detail === 0) {
          down();
          setTimeout(up, 120);
        }
      });
    };
    const tap = (key) => () => {
      const inp = this.mine();
      if (inp) press(inp, key);
    };
    const nop = () => {};
    hook("tb-push", tap("push"), nop);
    hook("tb-dodge", tap("dodge"), nop);
    hook("tb-spec", tap("special"), nop);
    hook("tb-dash", () => (this.touch.dash = true), () => (this.touch.dash = false));
    hook("tb-guard", () => (this.touch.guard = true), () => (this.touch.guard = false));
    $("touch").addEventListener("contextmenu", (e) => e.preventDefault());
  }

  feedInput() {
    const inp = this.mine();
    if (!inp) return;
    const k = this.keys;
    const t = this.touch;
    inp.mx = (k.right ? 1 : 0) - (k.left ? 1 : 0) || t.mx;
    inp.dash = k.dash || t.dash;
    inp.guard = k.guard || t.guard;
  }

  mountPause() {
    if (!window.TodayPause) return;
    window.TodayPause.mount({
      canPause: () => this.screen === "fight" && this.m.mode !== "demo" && !this.m.done,
      isPaused: () => this.paused,
      pause: () => {
        if (this.screen !== "fight") return false;
        this.paused = true;
        this.clearInput();
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
    const ov = $("today-pause-overlay");
    const box = ov && ov.querySelector(".today-pause-actions");
    if (box && box.firstElementChild) {
      const b = document.createElement("button");
      b.type = "button";
      b.id = "bs-pause-menu";
      b.className = box.firstElementChild.className;
      b.textContent = "경기 그만두고 메뉴로";
      b.addEventListener("click", () => {
        window.TodayPause.resume();
        this.toTitle();
      });
      box.appendChild(b);
    }
  }

  /* ---------- 경기 사건 → 효과 · 소리 ---------- */
  handleEvents() {
    const b = this.bout;
    const st = this.stage;
    const S = st.S;
    const quiet = this.m.mode === "demo";
    const sfx = quiet ? null : this.sfx;
    const fx = this.fx;
    const m = this.m;
    const fs = Math.max(0.62, S);
    for (const e of b.events) {
      switch (e.t) {
        case "round": {
          this.pp.forEach((p) => (p.landed = null));
          m.dropped = [false, false];
          st.refPose = 0;
          if (m.mode === "duel") fx.text(this.W / 2, st.gy - 150 * S, b.need > 1 ? `${e.n}판` : "단판 승부", 46 * fs, "#fff", "#7a2a10", 1.5);
          if (sfx) sfx.drum(false);
          break;
        }
        case "fight":
          if (!quiet) fx.text(this.W / 2, st.gy - 150 * S, "시작!", 58 * fs, "#ffd23f", "#7a2a10", 0.8);
          if (sfx) {
            sfx.drum(true);
            sfx.crowd(0.9);
          }
          st.cheer = 0.7;
          break;
        case "shrink":
          fx.text(this.W / 2, st.gy - 150 * S, "판이 좁아져요!", 34 * fs, "#ff8d6a", "#5a1208", 1.2);
          if (sfx) sfx.crowd(0.9);
          break;
        case "special": {
          const f = b.f[e.i];
          const [x, y] = st.map(f.x, f.z);
          fx.ring(x, y, 170, S, "#ffd23f", 0.45);
          fx.text(x, y - 250 * S, f.def.skill.ko, 27 * fs, "#fff", "#a0307a", 1);
          if (m.mode === "tutorial" && m.step === 4 && e.i === 0) this.tutNext();
          this.shake = Math.max(this.shake, 6);
          if (sfx) sfx.special();
          st.cheer = 1;
          break;
        }
        case "dodge": {
          const f = b.f[e.i];
          const [x, y] = st.map(f.x, f.z);
          fx.dust(x, y, 5, S);
          if (sfx) sfx.dodge();
          break;
        }
        case "guard":
          if (sfx) sfx.guard();
          break;
        case "whoosh":
          if (sfx) sfx.whoosh();
          break;
        case "dash": {
          const f = b.f[e.i];
          const [x, y] = st.map(f.x, f.z);
          fx.dust(x, y, 7, S, -f.face);
          if (sfx) sfx.dash(e.pow);
          break;
        }
        case "whiff": {
          const f = b.f[e.i];
          const [x, y] = st.map(f.x, f.z);
          fx.text(x, y - 230 * S, "빗나감!", 24 * fs, "#cfe8ff", "#23425f", 0.7);
          if (sfx) sfx.whiff();
          if (e.i === 1) m.dodgeDash += 1;
          break;
        }
        case "land": {
          const f = b.f[e.i];
          const [x, y] = st.map(f.x, f.z);
          fx.dust(x, y, 4 + Math.round(e.power * 5), S);
          this.pp[e.i].impact(e.power * 0.6, 0);
          if (sfx) sfx.thump(0.5 + e.power * 0.4);
          break;
        }
        case "save": {
          const f = b.f[e.i];
          const [x, y] = st.map(f.x, f.z);
          fx.text(x, y - 235 * S, "버텼다!", 30 * fs, "#9dff8a", "#1d5a2a", 0.9);
          fx.stars(x, y - 40 * S, 4, S, 0.5);
          st.cheer = 1;
          if (sfx) sfx.crowd(1.1);
          if (e.i === 0) m.saves += 1;
          break;
        }
        case "clang": {
          const [x, y] = st.map(e.x, e.z, 90);
          fx.stars(x, y, 12, S, 1);
          fx.ring(x, y + 80 * S, 120, S, "#fff");
          this.pp.forEach((p, i) => p.impact(0.9, i === 0 ? -1 : 1));
          this.shake = Math.max(this.shake, 12);
          if (sfx) {
            sfx.thump(1);
            sfx.boing(1);
          }
          break;
        }
        case "parry": {
          const [x, y] = st.map(e.x, e.z, 90);
          fx.ring(x, y + 80 * S, 110, S, "#7cf0ff", 0.4);
          fx.stars(x, y, 6, S, 0.7);
          fx.text(x, y - 90 * S, "튕겨 냄!", 30 * fs, "#7cf0ff", "#123f5f", 0.8);
          this.shake = Math.max(this.shake, 6);
          if (sfx) sfx.parry();
          if (e.i === 0) m.parries += 1;
          break;
        }
        case "block": {
          const [x, y] = st.map(e.x, e.z, 70);
          fx.dust(x, y + 70 * S, 3, S);
          this.pp[e.i]?.impact(e.power * 0.4, 0);
          if (sfx) sfx.block();
          if (m.mode === "tutorial" && m.step === 3 && e.i === 0) this.tutNext();
          break;
        }
        case "hit": {
          const [x, y] = st.map(e.x, e.z, e.y);
          const big = e.kind !== "push" || e.power > 0.62;
          this.pp[e.vic].impact(e.power, e.nx);
          this.pp[e.att].impact(e.power * 0.35, -e.nx);
          this.pp[e.att].hitEyeT = 0; // 때린 쪽은 표정이 안 무너진다
          fx.stars(x, y, big ? 13 : 5, S, big ? 1 : 0.6, e.nx);
          const v = b.f[e.vic];
          const [vx, vy] = st.map(v.x, v.z);
          fx.dust(vx, vy, big ? 9 : 3, S, e.nx);
          if (big) {
            fx.ring(x, vy, 150, S, "#fff");
            fx.text(x, y - 74 * S, e.power > 0.8 ? "쾅!" : "쿵!", (e.power > 0.8 ? 50 : 38) * fs, "#fff", "#c23a12", 0.55, e.nx * 0.14);
            this.shake = Math.max(this.shake, 6 + e.power * 11);
          } else this.shake = Math.max(this.shake, 2.5);
          st.cheer = Math.min(1, st.cheer + e.power * 0.5);
          if (sfx) {
            if (big) sfx.thump(0.7 + e.power * 0.3);
            sfx.boing(0.35 + e.power * 0.65);
            if (e.power > 0.5) sfx.crowd(e.power);
          }
          if (e.att === 0) m.hits += 1;
          if (m.mode === "tutorial" && e.att === 0) {
            if (m.step === 1 && e.kind === "push") {
              m.n += 1;
              if (m.n >= 3) this.tutNext();
            } else if (m.step === 2 && e.kind !== "push") this.tutNext();
          }
          break;
        }
        case "break": {
          const [x, y] = st.map(e.x, e.z);
          fx.text(x, y - 235 * S, "휘청!", 34 * fs, "#ffd23f", "#7a2a10", 0.8);
          fx.ring(x, y, 130, S, "#ffd23f");
          if (sfx) sfx.fall();
          break;
        }
        case "roar": {
          const f = b.f[e.i];
          const [x, y] = st.map(f.x, f.z);
          fx.ring(x, y, 280, S, "#ff9d2e", 0.5);
          this.shake = Math.max(this.shake, 10);
          if (sfx) sfx.roar();
          break;
        }
        case "bump": {
          const [x, y] = st.map(e.x, e.z);
          this.pp[0].impact(e.power * 0.75, -e.nx);
          this.pp[1].impact(e.power * 0.75, e.nx);
          if (e.power < 0.5) this.pp[0].hitEyeT = this.pp[1].hitEyeT = 0;
          if (e.power > 0.25) {
            fx.dust(x, y, 2 + Math.round(e.power * 5), S);
            fx.stars(x, y - 90 * S, 2 + Math.round(e.power * 4), S, 0.6);
            this.shake = Math.max(this.shake, e.power * 5);
          }
          if (sfx) sfx.boing(e.power);
          break;
        }
        case "ringout": {
          const [x, y] = st.map(e.x, e.z);
          const winner = 1 - e.i;
          fx.ring(x, y, 220, S, "#fff", 0.5);
          fx.stars(x, y - 60 * S, 16, S, 1.2);
          fx.dust(x, y, 10, S);
          if (!quiet) fx.text(this.W / 2, st.gy - 150 * S, "아웃!", 64 * fs, "#ff6a4a", "#fff", 1.1);
          this.shake = 16;
          this.slowT = 0.42;
          st.refDir = b.f[winner].x >= 0 ? 1 : -1;
          st.refPose = 1;
          st.cheer = 1;
          if (sfx) {
            sfx.ringOut();
            sfx.crowd(1.5);
          }
          if (m.mode === "ta") {
            if (e.i === 1) {
              m.ko += 1;
              m.streak += 1;
              m.bestRun = Math.max(m.bestRun, m.streak);
              const gain = 500 + m.streak * 100 + Math.round(Math.max(0, 15 - b.time) * 20);
              m.score += gain;
              m.left += 3;
              fx.text(this.W / 2, st.gy - 90 * S, `+${gain} · +3초`, 26 * fs, "#ffe27a", "#5a2f10", 1.1);
            } else {
              m.streak = 0;
              m.left -= 6;
              fx.text(this.W / 2, st.gy - 90 * S, "-6초", 30 * fs, "#ff8d6a", "#5a1208", 1.1);
            }
          }
          break;
        }
        default:
      }
    }
    b.events.length = 0;
  }

  /* ---------- 모드별 진행 ---------- */
  modeTick(dt) {
    const m = this.m;
    const b = this.bout;
    if (m.done) return;
    if (b.phase === "fight") {
      m.sec += dt;
      if (m.mode !== "demo" && b.f[0].edge > 0.55) m.edge = true;
    }
    switch (m.mode) {
      case "demo":
        if (b.phase === "over" && b.phaseT > 1.7) this.newDemo();
        break;
      case "duel":
        if (b.phase === "over" && b.phaseT > 1.15) this.finishDuel();
        break;
      case "survival":
        if (b.phase === "roundEnd" && b.phaseT > 1.15) {
          if (b.roundWinner === 0) this.nextSurvival();
          else this.finishSurvival();
        }
        break;
      case "ta":
        if (b.phase === "fight") m.left -= dt;
        if (m.left <= 0) {
          m.left = 0;
          this.finishTa();
        } else if (b.phase === "roundEnd" && b.phaseT > 0.85) this.nextTa();
        break;
      case "practice":
        if (b.phase === "roundEnd" && b.phaseT > 1) {
          b.startRound();
          b.phaseT = 1.3;
        }
        break;
      case "tutorial":
        this.tutTick(dt);
        break;
      default:
    }
  }

  /* ---------- 틀 ---------- */
  loop(now) {
    requestAnimationFrame(this.loopFn);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.t += dt;
    if (this.paused) return;
    this.perf(dt);
    this.update(dt);
    if (this.screen === "select") this.drawSelect(dt);
    else if (SECTIONS.includes(this.screen) && this.screen !== "title" && this.screen !== "result") return; // 판넬 뒤는 안 그린다
    else this.render(dt);
  }

  /** 3초 평균이 너무 느리면 효과를 줄인다 */
  perf(dt) {
    this.perfT += dt;
    this.perfN += 1;
    if (this.perfT < 3) return;
    const fps = this.perfN / this.perfT;
    this.fpsNow = fps;
    this.perfT = 0;
    this.perfN = 0;
    if (!this.lowAuto && !this.save.low && fps < 34 && !document.hidden) {
      this.lowAuto = true;
      this.applyLow();
      this.resize();
    }
  }

  update(dt) {
    const b = this.bout;
    if (!b) return;
    if (this.screen === "select" || this.screen === "camp" || this.screen === "practice" || this.screen === "book" || this.screen === "settings") return;
    this.slowT -= dt;
    this.acc += dt * (this.slowT > 0 ? 0.32 : 1);
    let n = 0;
    while (this.acc >= STEP && n < 40) {
      this.feedInput();
      for (const ai of this.ais) ai.update(STEP);
      b.step(STEP);
      this.acc -= STEP;
      n += 1;
    }
    if (n >= 40) this.acc = 0;
    this.handleEvents();
    this.modeTick(dt);
    // handleEvents 안에서 다음 경기로 넘어갔을 수 있어 다시 읽는다
    this.syncPuppets(dt);
    this.liveFx(dt);
    this.fx.update(dt);
    this.stage.cheer = Math.max(0, this.stage.cheer - dt * 0.55);
    if (this.stage.refPose > 0 && this.bout.phase === "fight") this.stage.refPose = 0;
    this.updateCam(dt);
    if (this.screen === "fight") this.updateHud();
    else if (this.screen === "result" && this.lastResult && this.lastResult.won) {
      this.fwT = (this.fwT || 0) - dt;
      if (this.fwT <= 0) {
        this.fwT = 0.55;
        const S = Math.max(0.6, this.stage.S);
        this.fx.firework(this.W * (0.15 + Math.random() * 0.7), this.H * (0.1 + Math.random() * 0.26), S);
      }
    }
  }

  syncPuppets(dt) {
    const b = this.bout;
    const st = this.stage;
    const quiet = this.m.mode === "demo";
    b.f.forEach((f, i) => {
      const p = this.pp[i];
      if (p.landed) {
        p.stateT += dt;
        p.update(dt);
        return;
      }
      p.sync(f, dt);
      if (f.state === "out" && f.y < GROUND) {
        const lim = this.W / 2 / st.S - 34;
        p.landed = { x: clamp(f.x, -lim, lim), z: f.z };
        p.lift = GROUND;
        p.spin = 0;
        p.setState("defeat");
        p.impact(1, 0);
        const [x, y] = st.map(p.landed.x, p.landed.z);
        this.fx.dust(x, y + 46 * st.S, 12, st.S);
        this.shake = Math.max(this.shake, 9);
        if (!quiet) this.sfx.splash();
      } else if (f.state === "out") p.lift = Math.max(GROUND, f.y);
      // 경기 시작: 하늘에서 쿵
      if (b.phase === "intro") {
        const T = 0.46 + i * 0.12;
        if (b.phaseT < T) {
          const q = T - b.phaseT;
          p.lift += q * q * 2800;
        } else if (!this.m.dropped[i] && b.phaseT < T + 0.25) {
          this.m.dropped[i] = true;
          p.impact(0.85, 0);
          const [x, y] = st.map(f.x, f.z);
          this.fx.dust(x, y, 7, st.S);
          this.shake = Math.max(this.shake, 6);
          if (!quiet) this.sfx.thump(0.8);
        }
      }
      p.update(dt);
    });
  }

  /** 계속 나오는 효과: 돌진 선 · 먼지 · 땀 · 기 모으기 소리 */
  liveFx(dt) {
    const b = this.bout;
    const st = this.stage;
    const S = st.S;
    const fx = this.fx;
    this.liveT = (this.liveT || 0) - dt;
    const tick = this.liveT <= 0;
    if (tick) this.liveT = 0.045;
    const quiet = this.m.mode === "demo";
    b.f.forEach((f, i) => {
      if (f.state === "out" || this.pp[i].landed) return;
      const [x, y] = st.map(f.x, f.z);
      if (!tick) return;
      if (f.state === "dash" || (f.state === "special" && Math.abs(f.vx) > 300)) {
        fx.speedLine(x, y, S, f.vx >= 0 ? 1 : -1);
        fx.speedLine(x, y, S, f.vx >= 0 ? 1 : -1);
        fx.dust(x, y, 1, S, f.vx >= 0 ? -1 : 1);
      } else if (f.state === "knockback" || (f.state === "stumble" && Math.random() < 0.5)) {
        fx.dust(x - Math.sign(f.vx) * 20 * S, y, 1, S, Math.sign(f.vx));
      } else if (f.locked && Math.random() < 0.5) {
        fx.dust(x, y, 1, S, f.x > b.f[1 - i].x ? 1 : -1);
      }
      if (f.teeter && Math.random() < 0.34) fx.sweat(x, y - 200 * S, S, -Math.sign(f.x || 1));
      if (f.state === "charge" && !quiet && i === 0) this.sfx.charge(f.charge);
      if ((f.state === "walk" || f.state === "run") && !quiet && i === 0 && Math.random() < 0.2) this.sfx.step();
    });
  }

  updateCam(dt) {
    const b = this.bout;
    const S = this.stage.S;
    let zt = 0;
    let ct = 0;
    if (this.cerOn) {
      zt = 0.14;
      ct = this.cerX * S;
    } else if (b.phase === "fight" && this.m.mode !== "demo") {
      const i = b.f[0].edge > b.f[1].edge ? 0 : 1;
      const e = b.f[i].edge;
      if (e > 0.3) {
        zt = (e - 0.3) * 0.11;
        ct = b.f[i].x * S * 0.14;
      }
    }
    const k = 1 - Math.exp(-dt * 3.6);
    this.zoom += (zt - this.zoom) * k;
    this.camX += (ct - this.camX) * k;
    this.shake *= Math.exp(-dt * 8.5);
    if (this.shake < 0.2) this.shake = 0;
    const my = b.f[0];
    const dangerO = this.screen === "fight" && this.m.mode !== "demo" ? clamp((my.edge - 0.45) * 1.5, 0, 0.85) : 0;
    if (Math.abs(dangerO - (this.dangerO || 0)) > 0.02) {
      this.dangerO = dangerO;
      $("danger").style.opacity = dangerO.toFixed(2);
    }
  }

  updateHud() {
    const b = this.bout;
    const m = this.m;
    const V = this.hudV;
    const set = (k, v, fn) => {
      if (V[k] !== v) {
        V[k] = v;
        fn(v);
      }
    };
    b.f.forEach((f, i) => {
      set(`b${i}`, Math.round(f.bal), (v) => {
        const u = $(`hb${i}`);
        u.style.transform = `scaleX(${v / 100})`;
        u.parentElement.classList.toggle("low", v < 30);
      });
      set(`s${i}`, Math.round(f.spec), (v) => {
        const u = $(`hs${i}`);
        u.style.transform = `scaleX(${v / 100})`;
        u.parentElement.classList.toggle("full", v >= 100);
      });
      const showPips = m.mode === "duel" && b.need > 1;
      set(`p${i}`, showPips ? b.wins[i] : -1, (v) => {
        $(`hp${i}`).innerHTML = v < 0 ? "" : Array.from({ length: b.need }, (_, n) => `<i class="${n < v ? "on" : ""}"></i>`).join("");
      });
    });
    const me = b.f[0];
    set("spec", me.spec >= 100, (v) => $("tb-spec").classList.toggle("ready", v));
    set("specF", Math.round(me.spec / 5), (v) => ($("tb-spec-fill").style.height = `${v * 5}%`));
    set("chg", Math.round(me.charge * 20), (v) => ($("tb-dash-fill").style.height = `${v * 5}%`));
    let time = "";
    let info = "";
    let hot = false;
    if (m.mode === "duel") {
      const left = Math.max(0, Math.ceil(b.limit - b.time));
      time = String(left);
      hot = left <= 8;
      info = `${m.stage.id} · ${AI_STYLES[m.stage.style].ko}`;
    } else if (m.mode === "survival") {
      const left = Math.max(0, Math.ceil(b.limit - b.time));
      time = String(left);
      hot = left <= 8;
      info = `${m.streak}연승 중`;
      set("score", m.score, (v) => ($("hscore").textContent = fmt(v)));
    } else if (m.mode === "ta") {
      time = String(Math.ceil(m.left));
      hot = m.left <= 10;
      info = `${m.ko}번 밀어냄`;
      set("score", m.score, (v) => ($("hscore").textContent = fmt(v)));
    } else if (m.mode === "practice") {
      time = "연습";
      info = this.pr.level ? LV_KO[this.pr.level - 1] : "허수아비";
    } else {
      time = "배움";
    }
    set("time", time, (v) => ($("htime").textContent = v));
    set("info", info, (v) => ($("hinfo").textContent = v));
    set("hot", hot, (v) => document.querySelector(".mid").classList.toggle("hot", v));
  }

  /* ---------- 그리기 ---------- */
  render(dt) {
    const g = this.g;
    const st = this.stage;
    const { W, H, dpr } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sk = this.shake;
    const zoom = 1 + this.zoom + (sk > 0 ? (sk * 2.4) / Math.min(W, H) : 0);
    const lim = (W / 2) * (1 - 1 / zoom);
    const camX = clamp(this.camX, -lim, lim);
    const sx = sk ? (Math.random() - 0.5) * sk : 0;
    const sy = sk ? (Math.random() - 0.5) * sk : 0;
    g.save();
    g.translate(W / 2 + sx, st.gy + sy);
    g.scale(zoom, zoom);
    g.translate(-W / 2 - camX, -st.gy);
    st.drawBack(g, this.t);
    const b = this.bout;
    if (b) {
      st.drawDanger(g, b.f, b.R, this.t);
      this.drawFighters(g);
    }
    this.fx.draw(g);
    st.drawFront(g, this.t, dt);
    g.restore();
  }

  drawFighters(g) {
    const b = this.bout;
    const st = this.stage;
    const order = b.f[0].z <= b.f[1].z ? [0, 1] : [1, 0];
    const pos = b.f.map((f, i) => {
      const L = this.pp[i].landed;
      const x = L ? L.x : f.x;
      const z = L ? L.z : f.z;
      const [px, py] = st.map(x, z);
      return { px, py, s: st.S * 0.88 * (1 + z * 0.00035), out: !this.cerOn && (!!L || f.state === "out") };
    });
    for (const i of order) {
      const q = pos[i];
      if (q.out) this.pp[i].drawShadow(g, q.px, q.py + 46 * st.S, q.s);
      else this.pp[i].drawShadow(g, q.px, q.py, q.s);
    }
    for (const i of order) {
      const f = b.f[i];
      const q = pos[i];
      this.auraBack(g, f, q);
      this.pp[i].draw(g, q.px, q.py, q.s);
      this.auraFront(g, f, q, i);
    }
  }

  auraBack(g, f, { px, py, s }) {
    const t = this.t;
    if (f.state === "charge") {
      const c = f.charge;
      const R = (72 + c * 54 + Math.sin(t * 40) * 3) * s * f.size;
      g.strokeStyle = c >= 0.98 ? `rgba(255,70,40,${0.6 + Math.sin(t * 30) * 0.3})` : `rgba(255,190,60,${0.35 + c * 0.45})`;
      g.lineWidth = (5 + c * 6) * s;
      g.beginPath();
      g.ellipse(px, py, R, R * TILT, 0, 0, Math.PI * 2);
      g.stroke();
      const gl = g.createRadialGradient(px, py - 80 * s, 0, px, py - 80 * s, 150 * s * f.size);
      gl.addColorStop(0, `rgba(255,190,70,${c * 0.45})`);
      gl.addColorStop(1, "rgba(255,190,70,0)");
      g.fillStyle = gl;
      g.fillRect(px - 150 * s, py - 230 * s, 300 * s, 300 * s);
    } else if (f.state === "special") {
      const gl = g.createRadialGradient(px, py - 90 * s, 10 * s, px, py - 90 * s, 170 * s * f.size);
      const h = (t * 500) % 360;
      gl.addColorStop(0, `hsla(${h},100%,70%,.5)`);
      gl.addColorStop(1, `hsla(${h},100%,70%,0)`);
      g.fillStyle = gl;
      g.fillRect(px - 180 * s, py - 270 * s, 360 * s, 360 * s);
    }
  }

  auraFront(g, f, { px, py, s }, i) {
    const t = this.t;
    if (f.state === "guard") {
      // 앞을 막는 방패 빛
      const perfect = f.stateT < 0.2;
      const x = px + f.face * 86 * s * f.size;
      const y = py - 84 * s * f.size;
      g.strokeStyle = perfect ? "rgba(140,240,255,.95)" : "rgba(160,215,255,.6)";
      g.lineWidth = (perfect ? 9 : 6) * s;
      g.lineCap = "round";
      g.beginPath();
      g.ellipse(x, y, 20 * s, 74 * s * f.size, 0, f.face > 0 ? -1.2 : Math.PI - 1.2, f.face > 0 ? 1.2 : Math.PI + 1.2);
      g.stroke();
    }
    const dizzy = f.state === "fall" || f.state === "recover" || (f.bal < 24 && f.state !== "out") || (this.cerOn && this.pp[i].state === "defeat");
    if (dizzy && (!this.pp[i].landed || this.cerOn)) {
      const y = py - 232 * s * f.size - this.pp[i].lift * s;
      for (let n = 0; n < 3; n += 1) {
        const a = t * 6 + (n * Math.PI * 2) / 3;
        const sx = px + Math.cos(a) * 42 * s;
        const sy = y + Math.sin(a) * 11 * s;
        g.fillStyle = "#ffe14a";
        g.strokeStyle = "#a9650a";
        g.lineWidth = 1.2;
        g.beginPath();
        for (let k = 0; k < 10; k += 1) {
          const q = (k / 10) * Math.PI * 2 - 1.57;
          const R = (k % 2 ? 3.5 : 8) * Math.max(0.7, s * 1.3);
          if (k === 0) g.moveTo(sx + Math.cos(q) * R, sy + Math.sin(q) * R);
          else g.lineTo(sx + Math.cos(q) * R, sy + Math.sin(q) * R);
        }
        g.closePath();
        g.fill();
        g.stroke();
      }
    }
    if (i === 0 && this.m.mode !== "demo" && this.screen === "fight") {
      // 내 캐릭터 표시
      const y = py - (this.bout.f[0].def.id === "bunny" ? 322 : 262) * s * f.size - this.pp[0].lift * s + Math.sin(t * 4) * 3;
      g.fillStyle = "#ffd23f";
      g.strokeStyle = "#7a3a10";
      g.lineWidth = 2;
      g.lineJoin = "round";
      g.beginPath();
      const k = Math.max(0.8, s * 1.8);
      g.moveTo(px, y + 9 * k);
      g.lineTo(px - 8 * k, y - 3 * k);
      g.lineTo(px + 8 * k, y - 3 * k);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
}

export function startApp() {
  const app = new App();
  window.BubbleSumo = app;
  return Promise.resolve(app);
}
