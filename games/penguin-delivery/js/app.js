/*
 * 펭귄 택배 대작전 — 화면 · 입력 · 저장 · 진행
 */
import { makeCourse, WORLDS, worldStages, stageId, STAGE_COUNT } from "./stages.js";
import { Sim, BOX } from "./sim.js";
import { Bot } from "./bot.js";
import { Penguin, COSTUMES } from "./penguin.js";
import { Stage3D } from "./world.js";
import { GameView, Showcase } from "./view.js";
import { Sound } from "./sfx.js";

const SAVE_KEY = "penguin-delivery-v1";
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = (n) => Math.round(n).toLocaleString("ko-KR");

const NEW_SAVE = () => ({
  best: {},
  fish: 0,
  owned: ["courier"],
  wear: "courier",
  music: 0.6,
  sfx: 0.85,
  soundOn: true,
  quality: "auto",
  stats: { plays: 0, delivered: 0, drops: 0, catches: 0, nice: 0, plops: 0, dunks: 0, snow: 0, thief: 0, stars: 0, fishTotal: 0 },
  lastW: 0,
  seenTip: {},
});
/** 저장이 없거나 망가졌으면 안전하게 기본값 */
function loadSave() {
  const base = NEW_SAVE();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return base;
    const best = {};
    if (d.best && typeof d.best === "object") {
      for (const k of Object.keys(d.best)) {
        const id = Number(k);
        const v = d.best[k];
        if (Number.isInteger(id) && id >= 0 && id < STAGE_COUNT && v && typeof v === "object" && Number.isFinite(v.stars) && Number.isFinite(v.score)) {
          best[id] = { stars: clamp(Math.round(v.stars), 1, 3), score: Math.max(0, v.score), time: Number(v.time) || 0, cond: Number(v.cond) || 0 };
        }
      }
    }
    const ok = new Set(COSTUMES.map((c) => c.id));
    const owned = Array.isArray(d.owned) ? d.owned.filter((x) => ok.has(x)) : [];
    if (!owned.includes("courier")) owned.push("courier");
    const stats = { ...base.stats };
    if (d.stats && typeof d.stats === "object") for (const k of Object.keys(stats)) if (Number.isFinite(d.stats[k])) stats[k] = Math.max(0, d.stats[k]);
    return {
      ...base,
      best,
      fish: Number.isFinite(d.fish) ? Math.max(0, Math.floor(d.fish)) : 0,
      owned,
      wear: owned.includes(d.wear) ? d.wear : "courier",
      music: Number.isFinite(d.music) ? clamp(d.music, 0, 1) : base.music,
      sfx: Number.isFinite(d.sfx) ? clamp(d.sfx, 0, 1) : base.sfx,
      soundOn: d.soundOn !== false,
      quality: ["auto", "high", "mid", "low"].includes(d.quality) ? d.quality : "auto",
      stats,
      lastW: Number.isInteger(d.lastW) ? clamp(d.lastW, 0, WORLDS.length - 1) : 0,
      seenTip: d.seenTip && typeof d.seenTip === "object" ? d.seenTip : {},
    };
  } catch (_) {
    return base;
  }
}

const ICON = {
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3h1.5v10h-13V11zm2.5 0h5V8a2.5 2.5 0 0 0-5 0z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17l-6 3.4 1.3-6.7-5-4.6 6.8-.8z" fill="currentColor"/></svg>',
};

class App {
  constructor(opts) {
    this.save = loadSave();
    const params = new URLSearchParams(location.search);
    this.params = params;
    let q = params.get("q") || this.save.quality;
    if (q === "auto") q = this.detectQuality();
    this.autoQ = (params.get("q") || this.save.quality) === "auto";
    this.stage = new Stage3D($("game"), q);
    this.penguin = new Penguin(q);
    this.penguin.setCostume(this.save.wear);
    this.show = new Showcase(this.stage, this.penguin);
    this.sound = new Sound();
    this.sound.setVolumes(this.save.music, this.save.sfx, this.save.soundOn);
    this.screen = "boot";
    this.sim = null;
    this.view = null;
    this.paused = false;
    this.last = performance.now();
    this.input = { x: 0, y: 0, keys: new Set(), latch: new Set(), tJump: false, tDash: false, tGrab: false };
    this.curW = this.highestWorld();
    this.fishChain = 0;
    this.chainT = 0;
    this.hudT = 0;
    this.fpsT = 0;
    this.fpsN = 0;
    this.bot = null;
    this.bindUi();
    this.bindInput();
    this.mountPause();
    this.mountRank();
    opts.progress(0.7, "펭귄이 모자를 고쳐 쓰는 중…");
    this.show.setWorld(this.curW);
    this.show.update(0.016);
    this.stage.render();
    opts.progress(1, "준비 끝!");
    this.showScreen("title");
    addEventListener("resize", () => this.onResize());
    if (window.visualViewport) window.visualViewport.addEventListener("resize", () => this.onResize());
    this.onResize();
    requestAnimationFrame((t) => this.frame(t));
    const dbg = params.get("stage");
    if (dbg) {
      const [a, b] = dbg.split("-").map((v) => Number(v) - 1);
      this.startStage(a, b);
    }
    if (params.get("bot")) this.botOn = true;
  }
  detectQuality() {
    const coarse = matchMedia("(pointer: coarse)").matches;
    const w = Math.max(innerWidth, innerHeight);
    const mem = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    if (!coarse && w >= 1000) return mem >= 4 ? "high" : "mid";
    if (mem <= 2 || cores <= 4) return "low";
    return "mid";
  }
  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch (_) {
      /* 저장이 막혀 있어도 게임은 계속 */
    }
  }
  totalStars() {
    return Object.values(this.save.best).reduce((a, b) => a + b.stars, 0);
  }
  totalScore() {
    return Object.values(this.save.best).reduce((a, b) => a + b.score, 0);
  }
  worldStars(w) {
    let n = 0;
    worldStages(w).forEach((_, s) => {
      const b = this.save.best[stageId(w, s)];
      if (b) n += b.stars;
    });
    return n;
  }
  worldCleared(w) {
    return worldStages(w).every((_, s) => this.save.best[stageId(w, s)]);
  }
  worldOpen(w) {
    if (w === 0) return true;
    return this.worldCleared(w - 1) && this.totalStars() >= WORLDS[w].need;
  }
  stageOpen(w, s) {
    if (!this.worldOpen(w)) return false;
    return s === 0 || Boolean(this.save.best[stageId(w, s - 1)]);
  }
  highestWorld() {
    let w = 0;
    for (let i = 0; i < WORLDS.length; i += 1) if (this.worldOpen(i)) w = i;
    return w;
  }
  nextStage() {
    for (let w = 0; w < WORLDS.length; w += 1) {
      if (!this.worldOpen(w)) break;
      const list = worldStages(w);
      for (let s = 0; s < list.length; s += 1) if (!this.save.best[stageId(w, s)]) return { w, s };
    }
    return { w: this.curW, s: 0 };
  }

  /* ---------- 화면 ---------- */
  showScreen(name) {
    const prev = this.screen;
    this.screen = name;
    for (const id of ["title", "worlds", "costume", "records", "result", "fail"]) $(id).classList.toggle("hidden", id !== name);
    const inPlay = name === "play" || name === "result" || name === "fail";
    document.body.classList.toggle("in-play", name === "play");
    document.body.classList.toggle("in-game", inPlay);
    if (name === "title") this.renderTitle();
    if (name === "worlds") this.renderWorlds();
    if (name === "costume") this.renderCostume();
    if (name === "records") this.renderRecords();
    if (!inPlay) {
      if (this.view) this.leaveStage();
      this.show.mode = name === "costume" ? "costume" : name === "worlds" ? "worlds" : "title";
      this.show.setWorld(name === "worlds" ? this.curW : name === "costume" ? this.show.wi >= 0 ? this.show.wi : 0 : this.highestWorld());
      this.penguin.setCostume(this.save.wear);
    }
    if (prev !== name && name === "title") this.sound.playSong("title");
    this.syncPause();
  }
  renderTitle() {
    const st = this.totalStars();
    const n = Object.keys(this.save.best).length;
    $("title-prog").innerHTML = n ? `${ICON.star}<b>${st}</b><small>/ ${STAGE_COUNT * 3}</small><i class="fish-i"></i><b>${fmt(this.save.fish)}</b>` : `<small>5개 월드 · ${STAGE_COUNT}개 스테이지</small>`;
    const ns = this.nextStage();
    const allDone = n >= STAGE_COUNT;
    $("start-label").textContent = n === 0 ? "PLAY" : allDone ? "PLAY" : `${ns.w + 1}-${ns.s + 1} PLAY`;
  }
  renderWorlds() {
    const w = this.curW;
    const W = WORLDS[w];
    const open = this.worldOpen(w);
    $("world-name").textContent = W.name;
    $("world-sub").textContent = open ? W.sub : w > 0 && !this.worldCleared(w - 1) ? `${WORLDS[w - 1].name}을 끝까지 깨면 열려요` : `별 ${W.need}개를 모으면 열려요 (지금 ${this.totalStars()}개)`;
    $("world-stars").innerHTML = `${ICON.star}<b>${this.worldStars(w)}</b><small>/ ${worldStages(w).length * 3}</small>`;
    $("world-prev").disabled = w === 0;
    $("world-next").disabled = w === WORLDS.length - 1;
    $("worlds").classList.toggle("locked", !open);
    $("world-dots").innerHTML = WORLDS.map((_, i) => `<i class="${i === w ? "on" : ""} ${this.worldOpen(i) ? "" : "off"}"></i>`).join("");
    const grid = $("stage-grid");
    grid.innerHTML = "";
    worldStages(w).forEach((d, s) => {
      const id = stageId(w, s);
      const best = this.save.best[id];
      const can = this.stageOpen(w, s);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `st ${best ? "done" : ""} ${can ? "" : "lock"} ${s === worldStages(w).length - 1 ? "boss" : ""}`;
      b.disabled = !can;
      b.setAttribute("aria-label", `${w + 1}-${s + 1} ${d.name}${can ? "" : " (잠김)"}`);
      b.innerHTML = can ? `<b>${s + 1}</b><span class="st-name">${d.name}</span><span class="mini">${[0, 1, 2].map((k) => `<i class="${best && best.stars > k ? "on" : ""}">${ICON.star}</i>`).join("")}</span>` : `<span class="st-lock">${ICON.lock}</span><b>${s + 1}</b>`;
      if (can) {
        b.addEventListener("click", () => {
          this.sound.unlock();
          this.sound.ui();
          this.startStage(w, s);
        });
      }
      grid.appendChild(b);
    });
  }
  moveWorld(d) {
    const n = clamp(this.curW + d, 0, WORLDS.length - 1);
    if (n === this.curW) return;
    this.curW = n;
    this.save.lastW = n;
    this.sound.ui();
    this.show.setWorld(n);
    this.renderWorlds();
  }
  renderCostume() {
    const list = $("costume-list");
    $("costume-fish").innerHTML = `<i class="fish-i"></i><b>${fmt(this.save.fish)}</b>`;
    list.innerHTML = "";
    for (const c of COSTUMES) {
      const own = this.save.owned.includes(c.id);
      const on = this.save.wear === c.id;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `cos ${on ? "on" : ""} ${own ? "own" : ""}`;
      b.dataset.id = c.id;
      b.innerHTML = `<b>${c.name}</b><small>${c.desc}</small><span class="price">${on ? "입는 중" : own ? "입기" : `<i class="fish-i"></i>${c.price}`}</span>`;
      b.addEventListener("click", () => this.pickCostume(c));
      b.addEventListener("pointerenter", () => {
        if (!matchMedia("(pointer: coarse)").matches) this.penguin.setCostume(c.id);
      });
      b.addEventListener("pointerleave", () => this.penguin.setCostume(this.save.wear));
      list.appendChild(b);
    }
  }
  pickCostume(c) {
    this.sound.unlock();
    if (this.save.owned.includes(c.id)) {
      this.save.wear = c.id;
      this.penguin.setCostume(c.id);
      this.penguin.trigger("wave", 1.2);
      this.sound.ui();
    } else if (this.save.fish >= c.price) {
      this.save.fish -= c.price;
      this.save.owned.push(c.id);
      this.save.wear = c.id;
      this.penguin.setCostume(c.id);
      this.penguin.trigger("wave", 1.6);
      this.sound.star();
    } else {
      this.penguin.setCostume(c.id);
      this.toast(`금빛 생선 ${c.price - this.save.fish}마리가 더 필요해요`);
      this.sound.tone(200, 0.15, "sawtooth", 0.08, 0.7);
      return;
    }
    this.persist();
    this.renderCostume();
  }
  renderRecords() {
    const S = this.save.stats;
    const stars = this.totalStars();
    const pct = Math.round((Object.keys(this.save.best).length / STAGE_COUNT) * 100);
    $("rec-total").innerHTML = `<div><small>전체 진행률</small><b>${pct}%</b></div><div><small>모은 별</small><b>${stars} / ${STAGE_COUNT * 3}</b></div><div><small>총점</small><b>${fmt(this.totalScore())}</b></div>`;
    $("rec-bar").style.width = `${pct}%`;
    $("rec-worlds").innerHTML = WORLDS.map((W, i) => {
      const n = worldStages(i).filter((_, s) => this.save.best[stageId(i, s)]).length;
      const all = worldStages(i).length;
      return `<div class="rw ${this.worldOpen(i) ? "" : "off"}"><span>${W.name}</span><div class="bar"><i style="width:${(n / all) * 100}%"></i></div><small>${n}/${all} · 별 ${this.worldStars(i)}</small></div>`;
    }).join("");
    const rows = [
      ["배달 성공", S.delivered, "번"],
      ["금빛 생선", S.fishTotal, "마리"],
      ["떨어뜨린 택배", S.drops, "번"],
      ["구해 낸 택배", S.catches, "번"],
      ["나이스 캐치", S.nice, "번"],
      ["엉덩방아", S.plops, "번"],
      ["풍덩!", S.dunks, "번"],
      ["눈사람 변신", S.snow, "번"],
      ["도둑맞은 택배", S.thief, "번"],
    ];
    $("rec-fun").innerHTML = rows.map(([a, b, c]) => `<div><small>${a}</small><b>${fmt(b)}<em>${c}</em></b></div>`).join("");
    $("rec-rank-btn").disabled = this.totalScore() <= 0;
    $("rec-rank").classList.add("hidden");
  }
  toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.classList.add("on");
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => el.classList.remove("on"), 1900);
  }

  /* ---------- 스테이지 ---------- */
  startStage(w, s, retry = false) {
    this.veil(() => {
      this.leaveStage();
      this.show.clear();
      const course = makeCourse(w, s);
      this.w = w;
      this.s = s;
      this.curW = w;
      this.save.lastW = w;
      const seen = this.params.get("intro") === "0";
      this.sim = new Sim(course, { intro: seen ? 0.05 : retry ? 0.55 : 1.25, seed: Math.floor(Math.random() * 1e6) });
      this.penguin.setCostume(this.save.wear);
      this.penguin.danceT = 0;
      this.view = new GameView(this.stage, this.sim, this.penguin);
      this.bot = this.botOn ? new Bot(this.sim) : null;
      this.fishChain = 0;
      this.save.stats.plays += 1;
      this.paused = false;
      this.prevPhase = this.penguin.phase;
      this.showScreen("play");
      this.initHud();
      this.banner(course, retry);
      this.sound.unlock();
      this.sound.suspend(false);
      this.sound.playSong(course.world.key);
      if (window.TodayGameRank) window.TodayGameRank.reset();
      this.stage.compiled = true;
      this.persist();
    });
  }
  leaveStage() {
    if (this.view) {
      this.view.dispose();
      this.view = null;
    }
    this.sim = null;
    this.bot = null;
    this.sound.suspend(false);
    if (this.sound.ctx) {
      this.sound.setLoop("wind", 0);
      this.sound.setLoop("ice", 0);
      this.sound.setLoop("roll", 0);
    }
  }
  /** 흰 화면으로 잠깐 덮고 바꿈 (무대를 짓는 동안 멈춘 것처럼 보이지 않게) */
  veil(fn) {
    const v = $("veil");
    v.classList.add("on");
    setTimeout(() => {
      fn();
      requestAnimationFrame(() => requestAnimationFrame(() => v.classList.remove("on")));
    }, 170);
  }
  banner(course, retry) {
    const el = $("banner");
    $("banner-stage").textContent = `${course.label}`;
    $("banner-name").textContent = course.name;
    const kinds = [...new Set(course.packs)].map((k) => BOX[k].name).join(" · ");
    $("banner-goal").textContent = course.goalText;
    $("banner-box").textContent = kinds;
    el.classList.remove("on");
    void el.offsetWidth;
    if (!retry) el.classList.add("on");
  }
  initHud() {
    const c = this.sim.c;
    $("hud-stage").textContent = c.label;
    $("hud-dots").innerHTML = c.checks.map((k) => `<i style="left:${(k.s / Math.max(1, c.goal.s)) * 100}%"></i>`).join("");
    $("hud").classList.toggle("express", c.express);
    this.tip(null);
    $("hud-boxes").innerHTML = this.sim.boxes.map(() => '<span class="pk"><i></i></span>').join("");
    this.hudT = 0;
  }
  syncHud() {
    const sim = this.sim;
    if (!sim) return;
    const p = sim.p;
    $("hud-fill").style.width = `${(p.progress || 0) * 100}%`;
    $("hud-peng").style.left = `${(p.progress || 0) * 100}%`;
    const left = Math.max(0, sim.limit - sim.clock);
    const el = $("hud-time");
    const mm = Math.floor(left / 60);
    const ss = Math.floor(left % 60);
    el.textContent = `${mm}:${String(ss).padStart(2, "0")}`;
    el.classList.toggle("low", left < 15);
    $("hud-time-box").classList.toggle("par", sim.clock <= sim.par);
    $("hud-fish").textContent = sim.fish;
    $("hud-stars").textContent = sim.stars;
    const packs = $("hud-boxes").children;
    sim.boxes.forEach((b, i) => {
      const el2 = packs[i];
      if (!el2) return;
      el2.firstChild.style.width = `${b.hp}%`;
      el2.classList.toggle("bad", b.hp < 60);
      el2.classList.toggle("lost", b.state === "free" || b.state === "stolen" || b.state === "rescue");
    });
    const items = $("hud-power");
    const act = [];
    if (p.boost > 0) act.push(`<span class="pw b">부스터 ${Math.ceil(p.boost)}</span>`);
    if (p.magnet > 0) act.push(`<span class="pw m">자석 ${Math.ceil(p.magnet)}</span>`);
    if (p.shield > 0) act.push(`<span class="pw s">보호막</span>`);
    if (p.bubble > 0) act.push(`<span class="pw w">뽁뽁이</span>`);
    const html = act.join("");
    if (items.dataset.h !== html) {
      items.dataset.h = html;
      items.innerHTML = html;
    }
    const tilt = Math.hypot(p.w.x, p.w.z);
    $("wobble").classList.toggle("on", tilt > 0.3 && p.stack.length > 0);
    // 잡기 버튼
    let near = false;
    for (const b of sim.boxes) if (b.state === "free" && Math.hypot(b.x - p.x, b.z - p.z) < 3) near = true;
    $("tc-grab").classList.toggle("show", near);
  }
  tip(text, key = "") {
    const el = $("tip");
    clearTimeout(this.tipT);
    for (const id of ["tc-jump", "tc-dash"]) $(id).classList.remove("pulse");
    $("joy").classList.remove("hint");
    if (!text) {
      el.classList.remove("on");
      return;
    }
    const touch = document.body.classList.contains("touch");
    const keys = { move: touch ? "" : "방향키 / WASD", jump: touch ? "" : "Space", dash: touch ? "" : "Shift", grab: touch ? "" : "E" }[key] || "";
    el.innerHTML = `<span>${text}</span>${keys ? `<kbd>${keys}</kbd>` : ""}`;
    el.classList.add("on");
    if (key === "jump") $("tc-jump").classList.add("pulse");
    if (key === "dash") $("tc-dash").classList.add("pulse");
    if (key === "move") $("joy").classList.add("hint");
    this.tipT = setTimeout(() => this.tip(null), 3600);
  }
  /** 화면 위 글자 */
  float(text, x, y, z, cls = "") {
    const v = this.tmpV || (this.tmpV = { x: 0, y: 0 });
    const cam = this.stage.camera;
    const P = this._prj || (this._prj = new (cam.position.constructor)());
    P.set(x, y, z).project(cam);
    v.x = (P.x * 0.5 + 0.5) * this.stage.w;
    v.y = (-P.y * 0.5 + 0.5) * this.stage.h;
    const el = document.createElement("div");
    el.className = `float ${cls}`;
    el.textContent = text;
    el.style.left = `${clamp(v.x, 60, this.stage.w - 60)}px`;
    el.style.top = `${clamp(v.y, 90, this.stage.h - 40)}px`;
    $("floats").appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }
  handleEvents() {
    const sim = this.sim;
    const ev = sim.events;
    if (!ev.length) return;
    const S = this.sound;
    for (const e of ev) {
      this.view.onEvent(e);
      switch (e.t) {
        case "tip":
          this.tip(e.text, e.key);
          break;
        case "jump":
          S.jump();
          break;
        case "airdash":
          S.dash();
          this.float("빙글!", e.x, e.y + 1.6, e.z, "sm");
          break;
        case "slide":
          S.dash();
          break;
        case "land":
          S.land(e.k);
          break;
        case "drop":
          S.drop();
          this.float(e.why === "tip" ? "휘청… 앗!" : "앗! 택배가!", e.x, e.y + 0.6, e.z, "bad big");
          if (!this.save.seenTip.drop) {
            this.save.seenTip.drop = 1;
            this.tip("택배가 굴러가요! 쫓아가서 부딪히면 잡아요", "dash");
          }
          break;
        case "catch":
          S.catch_(e.nice);
          this.float(e.nice ? "나이스 캐치!" : "잡았다!", e.x, e.y + 0.8, e.z, e.nice ? "good big" : "good");
          break;
        case "boxbump":
          S.boxHit(e.k);
          break;
        case "boxhop":
          S.boxHop();
          break;
        case "plop":
          S.plop();
          this.float("엉덩방아!", e.x, e.y + 1.9, e.z, "sm");
          break;
        case "bump":
          S.boxHit(e.k);
          break;
        case "hit":
          S.hit();
          break;
        case "snowed":
          S.snowed();
          this.float("눈사람이 됐어요!", e.x, e.y + 2.2, e.z);
          if (!this.save.seenTip.snow) {
            this.save.seenTip.snow = 1;
            this.tip("마구 움직이면 빨리 빠져나와요", "");
          }
          break;
        case "snowoff":
          S.boxHit(0.7);
          break;
        case "fall":
          S.splash();
          this.float(e.water ? "풍덩!" : "으아아~", e.x, e.y + 1.4, e.z, "bad");
          break;
        case "respawn":
          S.land(0.6);
          break;
        case "boxsplash":
          S.splash();
          break;
        case "rescue":
          S.gull();
          this.float("갈매기가 찾아다 줘요", e.x, e.y + 1.2, e.z, "sm");
          break;
        case "stolen":
          if (e.by === "fox") S.fox();
          else S.seal();
          this.float(e.by === "fox" ? "여우가 훔쳐 갔어요!" : "바다표범이 물어 갔어요!", e.x, e.y + 1.9, e.z, "bad");
          if (!this.save.seenTip.thief) {
            this.save.seenTip.thief = 1;
            this.tip("쫓아가서 부딪히면 돌려줘요!", "dash");
          }
          break;
        case "spit":
          S.boxHit(0.5);
          if (e.bumped) this.float("돌려줘!", e.x, e.y + 1.6, e.z, "good");
          break;
        case "foxpeek":
          S.fox();
          this.float("!", e.x, e.y + 1.7, e.z, "bad big");
          break;
        case "item":
          if (e.kind === "fish") {
            this.fishChain = this.chainT > 0 ? this.fishChain + 1 : 0;
            this.chainT = 1.1;
            S.fish(this.fishChain);
          } else if (e.kind === "star") {
            S.star();
            this.float("반짝 별!", e.x, e.y + 0.6, e.z, "good");
          } else {
            S.power();
            const name = { boost: "부스터!", magnet: "자석!", shield: "보호막!", bubble: "택배 뽁뽁이!" }[e.kind];
            this.float(name, e.x, e.y + 0.6, e.z, "good");
          }
          break;
        case "spring":
        case "launched":
          S.spring();
          break;
        case "vent":
          S.whoosh();
          this.float("둥실~", e.x, e.y + 1.8, e.z, "sm");
          break;
        case "crack":
          S.crack();
          break;
        case "crumble":
          S.crumble();
          break;
        case "icewarn":
          S.iceWarn();
          break;
        case "iceshatter":
          S.iceBreak();
          break;
        case "snowman":
          S.boxHit(e.k);
          this.float("퍽!", e.x, e.y + 1.9, e.z, "sm");
          break;
        case "avalanche":
          S.rumble(1.3);
          break;
        case "chaser":
          S.rumble(2);
          this.tip("거대한 눈덩이다! 달려요!", "dash");
          break;
        case "tunnelgo":
          S.rumble(1.6);
          this.tip("터널이 무너져요! 달려요!", "dash");
          break;
        case "ballspawn":
          S.rumble(0.5);
          break;
        case "geyser": {
          const p = sim.p;
          if (Math.hypot(p.x - e.x, p.z - e.z) < 16) S.geyser();
          break;
        }
        case "check":
          S.check();
          this.float("체크포인트", e.x, e.y + 2.3, e.z, "sm good");
          break;
        case "needmore":
          this.tip(`택배 ${e.left}개를 더 찾아와요!`, "");
          break;
        case "shieldoff":
        case "bubbleoff":
          S.boxHit(0.8);
          this.float(e.t === "shieldoff" ? "보호막이 막았어요" : "뽁뽁이가 막았어요", e.x, e.y + 1.8, e.z, "sm");
          break;
        case "broken":
          S.crumble();
          break;
        case "deliver":
          S.win();
          this.tip(null);
          this.onDelivered();
          break;
        case "fail":
          S.lose();
          this.tip(e.why === "time" ? "시간이 다 됐어요…" : "택배가 깨졌어요…", "");
          this.addStats(sim);
          break;
        case "won":
          this.showResult();
          break;
        case "lost":
          this.showFail();
          break;
        default:
          break;
      }
    }
    ev.length = 0;
  }
  addStats(sim) {
    const S = this.save.stats;
    const r = sim.stats;
    S.drops += r.drops;
    S.catches += r.catches;
    S.nice += r.nice;
    S.plops += r.plops;
    S.dunks += r.dunks;
    S.snow += r.snow;
    S.thief += r.thief;
    // 실패해도 주운 생선은 절반 보상
    if (!sim.result || !sim.result.won) {
      const half = Math.floor(sim.fish * 0.5);
      this.save.fish += half;
      S.fishTotal += half;
    }
    this.persist();
  }
  onDelivered() {
    const sim = this.sim;
    const r = sim.result;
    const id = stageId(this.w, this.s);
    const prev = this.save.best[id];
    this.addStats(sim);
    // 첫 클리어 보너스 생선
    const bonus = prev ? 0 : 10 + this.w * 5;
    const starBonus = Math.max(0, r.stars - (prev ? prev.stars : 0)) * 8;
    r.bonusFish = bonus + starBonus;
    const got = sim.fish + r.bonusFish;
    this.save.fish += got;
    this.save.stats.fishTotal += got;
    this.save.stats.delivered += 1;
    this.save.best[id] = {
      stars: Math.max(r.stars, prev ? prev.stars : 0),
      score: Math.max(r.score, prev ? prev.score : 0),
      time: prev && prev.time ? Math.min(prev.time, r.time) : r.time,
      cond: Math.max(r.cond, prev ? prev.cond : 0),
    };
    r.newBest = !prev || r.score > prev.score;
    r.unlocked = this.s === worldStages(this.w).length - 1 && this.w + 1 < WORLDS.length && this.worldOpen(this.w + 1) && !this.worldStars(this.w + 1);
    this.persist();
  }
  showResult() {
    const r = this.sim.result;
    const last = this.s === worldStages(this.w).length - 1;
    const final = last && this.w === WORLDS.length - 1;
    $("res-title").textContent = final ? "왕국에 도착했어요!" : "배달 완료!";
    $("res-stage").textContent = `${this.sim.c.label} ${this.sim.c.name}`;
    $("res-score").textContent = fmt(r.score);
    $("res-new").classList.toggle("hidden", !r.newBest);
    $("res-time").textContent = `${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, "0")}`;
    $("res-time-tag").textContent = r.time <= this.sim.par ? "목표 달성" : `목표 ${Math.floor(this.sim.par / 60)}:${String(this.sim.par % 60).padStart(2, "0")}`;
    $("res-time-tag").classList.toggle("ok", r.time <= this.sim.par);
    $("res-cond").textContent = `${r.cond}%`;
    $("res-cond-tag").textContent = r.cond >= 90 ? "완벽해요" : r.cond >= 60 ? "무사해요" : "찌그러졌어요";
    $("res-cond-tag").classList.toggle("ok", r.cond >= 60);
    $("res-fish").textContent = `+${r.fish + r.bonusFish}`;
    $("res-star-item").textContent = `${r.starItems}개`;
    const reasons = [];
    if (r.cond < 60) reasons.push("택배 상태 60% 이상이면 별 하나 더");
    if (r.time > this.sim.par) reasons.push("목표 시간 안에 오면 별 하나 더");
    $("res-hint").textContent = reasons.join(" · ");
    $("res-next").classList.toggle("hidden", final);
    $("res-unlock").classList.toggle("hidden", !r.unlocked);
    if (r.unlocked) $("res-unlock").textContent = `새 월드 열림: ${WORLDS[this.w + 1].name}!`;
    const needStars = last && !final && this.worldCleared(this.w) && !this.worldOpen(this.w + 1);
    if (needStars) {
      $("res-unlock").classList.remove("hidden");
      $("res-unlock").textContent = `다음 월드는 별 ${WORLDS[this.w + 1].need}개부터 열려요 (지금 ${this.totalStars()}개)`;
    }
    const nextBtnOk = !last || this.worldOpen(this.w + 1);
    $("res-next").disabled = !nextBtnOk;
    this.showScreen("result");
    document.querySelectorAll("#res-stars i").forEach((el, i) => {
      el.classList.remove("on");
      if (i < r.stars) setTimeout(() => {
        el.classList.add("on");
        this.sound.starPop(i);
      }, 320 + i * 280);
    });
    // 월드를 끝내면 랭킹 등록
    const wrap = $("res-rank");
    wrap.classList.toggle("hidden", !last);
    if (last && window.TodayGameRank) {
      window.TodayGameRank.mount({ gameId: "penguin-delivery", gameTitle: "펭귄 택배 대작전", formParent: wrap });
      window.TodayGameRank.open(Math.max(1, this.totalScore()), { label: `${WORLDS[this.w].name}까지 · 총점 ${fmt(this.totalScore())}` });
    }
  }
  showFail() {
    const r = this.sim.result;
    $("fail-title").textContent = r.why === "broken" ? "택배가 깨졌어요…" : "시간이 다 됐어요…";
    $("fail-detail").textContent = r.why === "broken" ? "다음엔 뽁뽁이를 챙기고 살살 달려 볼까요?" : this.sim.c.express ? "특급은 대시와 내리막으로 시간을 벌어요" : `남은 거리 ${Math.round((1 - (this.sim.p.progress || 0)) * 100)}% · 조금만 더 빨리!`;
    this.showScreen("fail");
  }

  /* ---------- 입력 ---------- */
  bindInput() {
    const I = this.input;
    const mapKey = (code) => ({ KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", Space: "jump", ShiftLeft: "dash", ShiftRight: "dash", KeyE: "grab" }[code]);
    addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = mapKey(e.code);
      if (!k) {
        if (e.code === "Enter" && this.screen === "title") this.onPlay();
        return;
      }
      if (this.screen === "play") e.preventDefault();
      I.keys.add(k);
      if (!e.repeat && (k === "jump" || k === "dash" || k === "grab")) I.latch.add(k);
      this.sound.unlock();
    });
    addEventListener("keyup", (e) => {
      const k = mapKey(e.code);
      if (k) I.keys.delete(k);
    });
    addEventListener("blur", () => I.keys.clear());
    // 터치
    const joyZone = $("joy-zone");
    const joy = $("joy");
    const knob = $("joy-knob");
    let joyId = null;
    let jx = 0;
    let jy = 0;
    const R = 52;
    const setKnob = (dx, dy) => {
      const d = Math.hypot(dx, dy);
      const k = d > R ? R / d : 1;
      knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
      const m = Math.min(1, d / R);
      const dead = 0.12;
      if (m < dead) {
        I.x = 0;
        I.y = 0;
      } else {
        const nm = (m - dead) / (1 - dead);
        I.x = (dx / (d || 1)) * nm;
        I.y = (-dy / (d || 1)) * nm;
      }
    };
    joyZone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      document.body.classList.add("touch");
      this.sound.unlock();
      joyId = e.pointerId;
      joyZone.setPointerCapture(e.pointerId);
      const r = joyZone.getBoundingClientRect();
      jx = e.clientX;
      jy = e.clientY;
      joy.style.left = `${e.clientX - r.left}px`;
      joy.style.top = `${e.clientY - r.top}px`;
      joy.classList.add("active");
      setKnob(0, 0);
    });
    joyZone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== joyId) return;
      e.preventDefault();
      setKnob(e.clientX - jx, e.clientY - jy);
    });
    const joyEnd = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      I.x = 0;
      I.y = 0;
      joy.classList.remove("active");
      joy.style.left = "";
      joy.style.top = "";
      knob.style.transform = "";
    };
    joyZone.addEventListener("pointerup", joyEnd);
    joyZone.addEventListener("pointercancel", joyEnd);
    const hold = (id, key) => {
      const el = $(id);
      const on = (e) => {
        e.preventDefault();
        document.body.classList.add("touch");
        this.sound.unlock();
        I[key] = true;
        I.latch.add({ tJump: "jump", tDash: "dash", tGrab: "grab" }[key]);
        el.classList.add("down");
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {
          /* 무시 */
        }
      };
      const off = () => {
        I[key] = false;
        el.classList.remove("down");
      };
      el.addEventListener("pointerdown", on);
      el.addEventListener("pointerup", off);
      el.addEventListener("pointercancel", off);
      el.addEventListener("lostpointercapture", off);
    };
    hold("tc-jump", "tJump");
    hold("tc-dash", "tDash");
    hold("tc-grab", "tGrab");
    if (matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) document.body.classList.add("touch");
    addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "touch") document.body.classList.add("touch");
        this.sound.unlock();
      },
      { passive: true }
    );
    // 꾸미기: 끌어서 돌리기
    let drag = null;
    $("costume-drag").addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, r: this.show.dragRot || 0 };
    });
    addEventListener("pointermove", (e) => {
      if (drag) this.show.dragRot = drag.r + (e.clientX - drag.x) * 0.012;
    });
    addEventListener("pointerup", () => {
      drag = null;
    });
  }
  applyInput() {
    const sim = this.sim;
    const v = this.view;
    if (!sim || !v) return;
    if (this.bot) {
      this.bot.update();
      return;
    }
    const I = this.input;
    let sx = I.x;
    let sy = I.y;
    if (I.keys.has("left")) sx -= 1;
    if (I.keys.has("right")) sx += 1;
    if (I.keys.has("up")) sy += 1;
    if (I.keys.has("down")) sy -= 1;
    const m = Math.hypot(sx, sy);
    if (m > 1) {
      sx /= m;
      sy /= m;
    }
    const dx = v.camDirX === undefined ? sim.c.P[0].dx : v.camDirX;
    const dz = v.camDirZ === undefined ? sim.c.P[0].dz : v.camDirZ;
    const rx = v.camRightX === undefined ? sim.c.P[0].rx : v.camRightX;
    const rz = v.camRightZ === undefined ? sim.c.P[0].rz : v.camRightZ;
    sim.input.x = dx * sy + rx * sx;
    sim.input.z = dz * sy + rz * sx;
    // 눌렀다 바로 떼어도 한 번은 전달
    sim.input.jump = I.keys.has("jump") || I.tJump || I.latch.has("jump");
    sim.input.dash = I.keys.has("dash") || I.tDash || I.latch.has("dash");
    sim.input.grab = I.keys.has("grab") || I.tGrab || I.latch.has("grab");
    I.latch.clear();
  }

  /* ---------- 일시정지 · 랭킹 ---------- */
  mountPause() {
    if (!window.TodayPause) return;
    window.TodayPause.mount({
      canPause: () => this.screen === "play" && this.sim && (this.sim.state === "play" || this.sim.state === "intro"),
      isPaused: () => this.paused,
      pause: () => {
        if (this.screen !== "play") return false;
        this.paused = true;
        this.sound.suspend(true);
        return true;
      },
      resume: () => {
        this.paused = false;
        this.last = performance.now();
        this.sound.suspend(false);
        return true;
      },
    });
    const ov = document.getElementById("today-pause-overlay");
    const box = ov && ov.querySelector(".today-pause-actions");
    if (box) {
      const add = (label, id, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "today-pause-home pd-pause";
        b.id = id;
        b.textContent = label;
        b.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.sound.ui();
          fn();
        });
        box.insertBefore(b, box.querySelector("#today-pause-home"));
      };
      add("스테이지 재시작", "pause-restart", () => {
        this.unpauseSilently();
        this.startStage(this.w, this.s, true);
      });
      add("사운드 설정", "pause-sound", () => this.openSound());
      add("월드 선택", "pause-worlds", () => {
        this.unpauseSilently();
        this.veil(() => this.showScreen("worlds"));
      });
      const home = box.querySelector("#today-pause-home");
      if (home) home.textContent = "게임 나가기";
    }
  }
  unpauseSilently() {
    this.paused = false;
    this.sound.suspend(false);
    const ov = document.getElementById("today-pause-overlay");
    if (ov) ov.hidden = true;
  }
  syncPause() {
    const btn = document.getElementById("today-pause-btn");
    if (btn) btn.hidden = !(this.screen === "play");
  }
  mountRank() {
    if (window.TodayGameRank) window.TodayGameRank.mount({ gameId: "penguin-delivery", gameTitle: "펭귄 택배 대작전", formParent: $("rec-rank") });
  }

  /* ---------- 단추 ---------- */
  onPlay() {
    this.sound.unlock();
    this.sound.ui();
    const n = this.nextStage();
    this.startStage(n.w, n.s);
  }
  openSound() {
    const s = this.save;
    $("snd-music").value = Math.round(s.music * 100);
    $("snd-sfx").value = Math.round(s.sfx * 100);
    $("snd-on").checked = s.soundOn;
    $("snd-q").value = s.quality;
    $("sound").classList.remove("hidden");
  }
  bindUi() {
    const go = (id, fn) => $(id).addEventListener("click", (e) => {
      e.preventDefault();
      this.sound.unlock();
      this.sound.ui();
      fn();
    });
    $("start-btn").addEventListener("click", () => this.onPlay());
    go("btn-worlds", () => {
      this.curW = this.highestWorld();
      this.veil(() => this.showScreen("worlds"));
    });
    go("btn-costume", () => this.showScreen("costume"));
    go("btn-records", () => this.showScreen("records"));
    go("btn-sound", () => this.openSound());
    go("worlds-back", () => this.veil(() => this.showScreen("title")));
    go("costume-back", () => this.showScreen("title"));
    go("records-back", () => this.showScreen("title"));
    go("world-prev", () => this.moveWorld(-1));
    go("world-next", () => this.moveWorld(1));
    go("res-next", () => {
      const list = worldStages(this.w);
      if (this.s + 1 < list.length) this.startStage(this.w, this.s + 1);
      else this.startStage(this.w + 1, 0);
    });
    go("res-retry", () => this.startStage(this.w, this.s, true));
    go("res-worlds", () => this.veil(() => this.showScreen("worlds")));
    go("fail-retry", () => this.startStage(this.w, this.s, true));
    go("fail-worlds", () => this.veil(() => this.showScreen("worlds")));
    go("snd-close", () => {
      $("sound").classList.add("hidden");
      this.persist();
    });
    const apply = () => {
      const s = this.save;
      s.music = Number($("snd-music").value) / 100;
      s.sfx = Number($("snd-sfx").value) / 100;
      s.soundOn = $("snd-on").checked;
      this.sound.setVolumes(s.music, s.sfx, s.soundOn);
      this.persist();
    };
    $("snd-music").addEventListener("input", apply);
    $("snd-sfx").addEventListener("input", apply);
    $("snd-on").addEventListener("change", apply);
    $("snd-q").addEventListener("change", () => {
      this.save.quality = $("snd-q").value;
      this.persist();
      if (this.screen === "play") this.toast("다음에 게임을 열면 바뀌어요");
      else location.reload();
    });
    $("rec-rank-btn").addEventListener("click", () => {
      $("rec-rank").classList.remove("hidden");
      if (window.TodayGameRank) {
        window.TodayGameRank.reset();
        window.TodayGameRank.mount({ gameId: "penguin-delivery", gameTitle: "펭귄 택배 대작전", formParent: $("rec-rank") });
        window.TodayGameRank.open(Math.max(1, this.totalScore()), { label: `총점 ${fmt(this.totalScore())}` });
      }
    });
    // 저장 지우기 없이 공유 카드 없음: 사진 · 개인 정보는 다루지 않음
  }
  onResize() {
    this.stage.resize();
  }

  /* ---------- 매 프레임 ---------- */
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const raw = (now - this.last) / 1000;
    const dt = clamp(raw, 0, 0.05);
    this.last = now;
    if (document.hidden) return;
    if (this.view && this.sim) {
      if (!this.paused) {
        this.applyInput();
        this.sim.update(dt);
        document.body.classList.toggle("ending", this.sim.state !== "play" && this.sim.state !== "intro");
        this.handleEvents();
        if (!this.view) return;
        this.chainT -= dt;
        this.hudT -= dt;
        if (this.hudT <= 0) {
          this.hudT = 0.07;
          this.syncHud();
        }
        this.view.update(this.sim.scale < 1 ? dt * Math.max(this.sim.scale, 0.5) : dt);
        this.syncSounds(dt);
      }
    } else {
      this.show.update(dt);
    }
    this.stage.render();
    this.autoQuality(raw);
  }
  syncSounds() {
    const sim = this.sim;
    const p = sim.p;
    const S = this.sound;
    if (!S.ctx) return;
    const sp = Math.hypot(p.vx, p.vz);
    S.setLoop("ice", p.grounded && p.surf === "ice" ? Math.min(0.3, (p.slip * 0.55 + sp * 0.012) * (p.mode === "slide" ? 1.6 : 1)) : p.grounded && p.mode === "slide" ? 0.12 : 0, 3000 + sp * 120);
    const w = sim.windNow;
    S.setLoop("wind", w.k ? Math.min(0.42, (Math.abs(w.x) + Math.abs(w.z)) * 0.045 + sim.fog * 0.2) : 0, 500 + (Math.abs(w.x) + Math.abs(w.z)) * 40);
    // 굴러오는 눈덩이
    let roll = 0;
    for (const o of sim.c.objs) {
      if (o.type === "balls") {
        for (const b of o.list) if (b.on) roll = Math.max(roll, 1 - Math.hypot(b.x - p.x, b.z - p.z) / 22);
      } else if (o.type === "chaser" && o.active) {
        roll = Math.max(roll, 1 - Math.hypot(o.x - p.x, o.z - p.z) / 30);
      }
    }
    S.setLoop("roll", roll > 0 ? roll * 0.65 : 0);
    // 발소리
    const ph = this.penguin.phase;
    if (p.grounded && sp > 0.4 && p.mode === "run" && Math.floor(ph / Math.PI) !== Math.floor((this.prevPhase || 0) / Math.PI)) S.step_();
    this.prevPhase = ph;
  }
  autoQuality(raw) {
    if (!this.autoQ || !this.view) return;
    this.fpsT += raw;
    this.fpsN += 1;
    if (this.fpsT < 2.5) return;
    const fps = this.fpsN / this.fpsT;
    this.fpsT = 0;
    this.fpsN = 0;
    const st = this.stage;
    if (fps < 34) {
      const d = st.renderer.getPixelRatio();
      if (d > 1) st.setDPR(Math.max(1, d - 0.35));
      else if (st.sun.castShadow) {
        st.sun.castShadow = false;
      }
    }
  }
}

export function startApp(opts) {
  const app = new App(opts);
  window.PenguinDelivery = app;
  return app;
}
