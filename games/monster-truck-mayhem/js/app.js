/* 화면 · 저장 · 입력 · 보상. 게임 규칙은 sim, 그림은 view 에 있다 */
import { MODES, TRUCKS, UPGRADES, UPGRADE_MAX, WORLDS, truckById, truckStats, upgradeCost } from "./data.js";
import { LEVELS, levelsOf, missionText } from "./stages.js";
import { Bot } from "./bot.js";
import { Sfx } from "./sfx.js";
import { GameView } from "./view.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
const clock = (t) => {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};
const clock2 = (t) => `${clock(t)}.${String(Math.floor((Math.max(0, t) % 1) * 10))}`;
const SAVE_KEY = "monster-truck-mayhem-v1";
const WORLD_COLOR = ["#ffc81e", "#ff8a5a", "#ff4a24", "#6fd0ff", "#b58cff"];

/* ---------- 저장 ---------- */
export function defaultSave() {
  return {
    v: 1,
    coins: 0,
    world: 0,
    stars: {},
    best: {},
    trucks: { thunder: true },
    selected: "thunder",
    upgrades: {},
    settings: { quality: "auto", sfx: true, music: true, shake: true },
    total: { destroyed: 0, bestCombo: 0, bestStunt: 0 },
    seenHelp: false,
  };
}
/** 깨진 값이 있어도 게임이 망가지지 않게 하나씩 검사해서 읽는다 */
export function sanitizeSave(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const num = (v, min, max, f) => (typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : f);
  d.coins = Math.floor(num(raw.coins, 0, 1e9, 0));
  d.world = Math.floor(num(raw.world, 0, WORLDS.length - 1, 0));
  const ids = new Set(LEVELS.map((l) => l.id));
  if (raw.stars && typeof raw.stars === "object") {
    for (const [k, v] of Object.entries(raw.stars)) if (ids.has(k)) d.stars[k] = Math.floor(num(v, 0, 3, 0));
  }
  if (raw.best && typeof raw.best === "object") {
    for (const [k, v] of Object.entries(raw.best)) {
      if (!ids.has(k) || !v || typeof v !== "object") continue;
      d.best[k] = { score: num(v.score, 0, 1e9, 0), combo: num(v.combo, 0, 1e6, 0), stunt: num(v.stunt, 0, 1e9, 0), time: num(v.time, 0, 1e5, 0), destroyed: num(v.destroyed, 0, 1e6, 0) };
    }
  }
  if (raw.trucks && typeof raw.trucks === "object") {
    for (const t of TRUCKS) if (raw.trucks[t.id] === true) d.trucks[t.id] = true;
  }
  d.trucks.thunder = true;
  if (typeof raw.selected === "string" && d.trucks[raw.selected]) d.selected = raw.selected;
  if (raw.upgrades && typeof raw.upgrades === "object") {
    for (const t of TRUCKS) {
      const u = raw.upgrades[t.id];
      if (!u || typeof u !== "object") continue;
      d.upgrades[t.id] = {};
      for (const x of UPGRADES) d.upgrades[t.id][x.id] = Math.floor(num(u[x.id], 0, UPGRADE_MAX, 0));
    }
  }
  if (raw.settings && typeof raw.settings === "object") {
    if (["auto", "high", "mid", "low"].includes(raw.settings.quality)) d.settings.quality = raw.settings.quality;
    for (const k of ["sfx", "music", "shake"]) if (typeof raw.settings[k] === "boolean") d.settings[k] = raw.settings[k];
  }
  if (raw.total && typeof raw.total === "object") {
    d.total.destroyed = num(raw.total.destroyed, 0, 1e9, 0);
    d.total.bestCombo = num(raw.total.bestCombo, 0, 1e6, 0);
    d.total.bestStunt = num(raw.total.bestStunt, 0, 1e9, 0);
  }
  d.seenHelp = raw.seenHelp === true;
  return d;
}
function loadSave() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return sanitizeSave(s ? JSON.parse(s) : null);
  } catch (_) {
    return defaultSave();
  }
}

/* ---------- 보상 계산 ---------- */
export function reward(def, res, firstClear) {
  if (!res.ok) return { coins: Math.round(res.score / 120) + 10, note: "도전 보상" };
  const base = 60 + def.world * 25;
  const stars = res.stars * 50;
  const scoreB = Math.round(res.score / 40);
  const destr = Math.min(250, res.stats.destroyed * 3);
  const stunt = Math.min(250, Math.round(res.stats.stuntScore / 30));
  const first = firstClear ? 150 : 0;
  const worldDone = firstClear && def.mode === "boss" ? 1000 : 0;
  const coins = base + stars + scoreB + destr + stunt + first + worldDone;
  const note = [firstClear ? "첫 클리어" : "", destr ? "파괴" : "", stunt ? "스턴트" : "", worldDone ? "월드 완주" : ""].filter(Boolean).join(" · ");
  return { coins, note: note ? `${note} 보너스 포함` : "" };
}

/* ---------- 앱 ---------- */
class App {
  constructor() {
    this.save = loadSave();
    this.sfx = new Sfx();
    this.sfx.setSfx(this.save.settings.sfx);
    this.sfx.setMusic(this.save.settings.music);
    this.screen = "title";
    this.paused = false;
    this.input = { up: false, down: false, left: false, right: false, jump: false, boost: false, touchSteer: null, gas: false, brake: false };
    this.steer = 0;
    this.touchOn = window.matchMedia && matchMedia("(pointer: coarse)").matches;
    if (/[?&]touch=1/.test(location.search)) this.touchOn = true;
    const ui = {
      speedLines: (k) => {
        const v = Math.round(k * 20) / 20;
        if (v !== this.lineK) {
          this.lineK = v;
          $("speedlines").style.opacity = String(Math.min(0.75, v * 0.75));
        }
      },
      big: (w, t) => this.showWord(w, t),
      stunt: (l, s, b) => this.showStunt(l, s, b),
      pop: (x, y, t, b) => this.addPop(x, y, t, b),
      tip: (m, i) => this.showTip(m, i ? 1300 : 1600),
      chain: (n) => this.showTip(`연쇄 폭발 ×${n}!`, 900),
      flash: (a) => this.doFlash(a),
      finish: () => {},
      ended: (ok) => this.onEnded(ok),
    };
    this.view = new GameView($("game"), this.sfx, ui);
    this.applyQuality();
    this.bindInput();
    this.bindMenus();
    this.mountPause();
    window.addEventListener("resize", () => this.view.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.view.resize(), 200));
    this.goTitle();
    this.last = performance.now();
    this.badFrames = 0;
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch (_) {
      /* 저장 못 해도 게임은 계속 */
    }
  }

  applyQuality() {
    const q = this.save.settings.quality;
    if (q === "auto") {
      const coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
      this.view.setQuality(this.autoQ || (coarse ? "mid" : "high"));
    } else this.view.setQuality(q);
  }

  selectedDef() {
    return truckById(this.save.selected);
  }

  upgradesOf(id) {
    return this.save.upgrades[id] || {};
  }

  /* ---------- 화면 전환 ---------- */
  show(id) {
    for (const s of ["title", "stages", "garage", "settings", "result"]) $(s).classList.toggle("hidden", s !== id);
    this.screen = id;
    const play = id === "play";
    $("hud").classList.toggle("hidden", !play);
    $("touch").classList.toggle("hidden", !(play && this.touchOn));
    if (!play) {
      $("combo").classList.add("hidden");
      $("keyhelp").classList.add("hidden");
      $("speedlines").style.opacity = "0";
      this.lineK = 0;
    }
    this.syncPause();
  }

  goTitle() {
    this.stopPlay();
    this.view.showTitle(this.selectedDef());
    this.show("title");
    this.refreshTitle();
    if (this.sfx.ctx) this.sfx.stopMusic();
  }

  refreshTitle() {
    $("title-coins").textContent = fmt(this.save.coins);
    const next = this.nextTourStage();
    $("start-sub").textContent = next ? `${next.world + 1}-${next.n} ${next.name}` : "모든 스테이지 클리어!";
  }

  /** 아직 안 깬 다음 투어 판 */
  nextTourStage() {
    for (const l of levelsOf("tour")) {
      if (!this.save.stars[l.id] && this.levelOpen(l)) return l;
    }
    for (const l of levelsOf("boss")) {
      if (!this.save.stars[l.id] && this.levelOpen(l)) return l;
    }
    return levelsOf("tour")[0];
  }

  levelOpen(def) {
    if (def.world > this.save.world) return false;
    if (def.mode === "tour") {
      if (def.n === 1) return true;
      const prev = levelsOf("tour", def.world)[def.n - 2];
      return !!(prev && this.save.stars[prev.id]);
    }
    if (def.mode === "boss") {
      const list = levelsOf("tour", def.world);
      return !!this.save.stars[list[list.length - 1].id];
    }
    return true;
  }

  /* ---------- 스테이지 고르기 ---------- */
  openStages(mode, world) {
    this.sfx.unlock();
    this.stageMode = mode;
    this.stageWorld = world == null ? Math.min(this.save.world, WORLDS.length - 1) : world;
    const m = MODES[mode];
    $("stages-title").textContent = m.name;
    $("stages-sub").textContent = `${m.ko} · ${m.sub}`;
    $("stages-coins").textContent = fmt(this.save.coins);
    const tabs = $("world-tabs");
    const worldCard = $("world-card");
    const grid = $("stage-grid");
    tabs.innerHTML = "";
    grid.innerHTML = "";
    if (mode === "tour") {
      tabs.classList.remove("hidden");
      worldCard.classList.remove("hidden");
      WORLDS.forEach((w, i) => {
        const b = document.createElement("button");
        b.type = "button";
        const list = levelsOf("tour", i);
        const got = list.reduce((a, l) => a + (this.save.stars[l.id] || 0), 0);
        b.className = `world-tab${i === this.stageWorld ? " on" : ""}${i > this.save.world ? " locked" : ""}`;
        b.innerHTML = `${w.name}<small>${i > this.save.world ? "잠김" : `★ ${got}/${list.length * 3}`}</small>`;
        b.addEventListener("click", () => {
          if (i > this.save.world) {
            this.showTip("앞 월드의 마지막 스테이지를 깨면 열려요", 1400);
            return;
          }
          this.sfx.click();
          this.openStages("tour", i);
        });
        tabs.appendChild(b);
      });
      const w = WORLDS[this.stageWorld];
      worldCard.style.setProperty("--wc", WORLD_COLOR[this.stageWorld]);
      worldCard.innerHTML = `<b>${w.ko}</b><span>${w.sub}</span>`;
      for (const l of levelsOf("tour", this.stageWorld)) grid.appendChild(this.stageCard(l, `${this.stageWorld + 1}-${l.n}`));
      for (const l of levelsOf("boss", this.stageWorld)) grid.appendChild(this.stageCard(l, "BOSS"));
    } else {
      tabs.classList.add("hidden");
      worldCard.classList.add("hidden");
      for (const l of levelsOf(mode)) grid.appendChild(this.stageCard(l, WORLDS[l.world].name));
    }
    this.show("stages");
    $("stages").scrollTop = 0;
  }

  stageCard(l, label) {
    const b = document.createElement("button");
    b.type = "button";
    const open = this.levelOpen(l);
    b.className = `stage-card${l.mode === "boss" ? " boss" : ""}${open ? "" : " locked"}`;
    b.dataset.id = l.id;
    const s = this.save.stars[l.id] || 0;
    const best = this.save.best[l.id];
    const stars = `<span class="st">${[0, 1, 2].map((i) => (i < s ? "<i>★</i>" : "★")).join("")}</span>`;
    const bestTxt = best ? (l.mode === "time" ? `BEST ${clock2(best.time)}` : `BEST ${fmt(best.score)}`) : "";
    b.innerHTML = `<span class="no">${label}</span><b>${l.name}</b><span class="goal">${missionText(l.main)}</span>${stars}<span class="bst">${bestTxt}</span>`;
    b.addEventListener("click", () => {
      if (!open) {
        this.showTip(l.mode === "boss" ? "이 월드의 스테이지를 모두 깨면 열려요" : "앞 스테이지를 먼저 깨 주세요", 1400);
        return;
      }
      this.sfx.click();
      this.startLevel(l);
    });
    return b;
  }

  /* ---------- 차고 ---------- */
  openGarage() {
    this.sfx.unlock();
    this.stopPlay();
    this.garageId = this.save.selected;
    this.view.showGarage(truckById(this.garageId));
    this.show("garage");
    this.renderGarage();
  }

  renderGarage() {
    const def = truckById(this.garageId);
    const owned = !!this.save.trucks[def.id];
    const up = this.upgradesOf(def.id);
    $("garage-coins").textContent = fmt(this.save.coins);
    $("truck-grade").textContent = def.grade;
    $("truck-name").textContent = def.name;
    $("truck-ko").textContent = def.ko;
    $("truck-desc").textContent = def.desc;
    // 성능표: 같은 자로 잰다. 회색 = 기본, 노랑 = 업그레이드
    const baseS = truckStats(def, {});
    const nowS = truckStats(def, up);
    const maxOf = (k) => Math.max(...TRUCKS.map((t) => truckStats(t, { engine: UPGRADE_MAX, tire: UPGRADE_MAX, susp: UPGRADE_MAX, body: UPGRADE_MAX, boost: UPGRADE_MAX })[k]));
    const rows = [["속도", "top"], ["가속", "accel"], ["파괴력", "power"], ["접지력", "grip"], ["점프", "jump"], ["내구도", "armor"], ["부스터", "boost"]];
    $("stat-list").innerHTML = rows
      .map(([n, k]) => {
        const mx = maxOf(k) || 1;
        return `<div class="stat" data-k="${k}"><span>${n}</span><i><u style="width:${Math.min(100, (nowS[k] / mx) * 100).toFixed(1)}%"></u><u class="base" style="width:${Math.min(100, (baseS[k] / mx) * 100).toFixed(1)}%"></u></i></div>`;
      })
      .join("");
    const list = $("up-list");
    list.innerHTML = "";
    if (owned) {
      for (const u of UPGRADES) {
        const lv = up[u.id] || 0;
        const cost = upgradeCost(def, lv);
        const row = document.createElement("div");
        row.className = "up-row";
        row.innerHTML = `<div><b>${u.name}</b><span class="up-dots">${Array.from({ length: UPGRADE_MAX }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("")}</span><small>${u.desc}</small></div>`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "up-btn";
        btn.dataset.up = u.id;
        btn.textContent = lv >= UPGRADE_MAX ? "MAX" : `${fmt(cost)}`;
        btn.disabled = lv >= UPGRADE_MAX || this.save.coins < cost;
        btn.addEventListener("click", () => this.buyUpgrade(def, u.id));
        row.appendChild(btn);
        list.appendChild(row);
      }
    }
    const action = $("truck-action");
    action.className = "btn-pick";
    action.disabled = false;
    if (owned) {
      if (this.save.selected === def.id) {
        action.textContent = "지금 타는 트럭";
        action.classList.add("using");
      } else action.textContent = "이 트럭으로 달리기";
    } else if (def.unlock === "final") {
      action.textContent = "메가 스타디움 보스를 깨면 열려요";
      action.disabled = true;
    } else {
      action.textContent = `구매 ${fmt(def.price)}`;
      action.classList.add("buy");
      action.disabled = this.save.coins < def.price;
    }
    const row = $("truck-row");
    row.innerHTML = "";
    const CHIP = { thunder: "#1f8cff", iron: "#8d6a4a", rocket: "#e8321f", frost: "#6fd0ff", flame: "#ff7a18", toxic: "#7be06a", mega: "#7a4fc8", golden: "#ffc81e" };
    for (const t of TRUCKS) {
      const c = document.createElement("button");
      c.type = "button";
      c.className = `truck-chip${t.id === def.id ? " on" : ""}${this.save.trucks[t.id] ? "" : " lock"}`;
      c.style.setProperty("--c", CHIP[t.id]);
      c.dataset.truck = t.id;
      c.innerHTML = `${t.name}<small>${this.save.trucks[t.id] ? (this.save.selected === t.id ? "탑승 중" : "보유") : t.unlock ? "잠김" : fmt(t.price)}</small>`;
      c.addEventListener("click", () => {
        this.sfx.click();
        this.garageId = t.id;
        this.view.showGarage(t);
        this.renderGarage();
      });
      row.appendChild(c);
    }
  }

  buyUpgrade(def, k) {
    const up = this.save.upgrades[def.id] || (this.save.upgrades[def.id] = {});
    const lv = up[k] || 0;
    const cost = upgradeCost(def, lv);
    if (lv >= UPGRADE_MAX || this.save.coins < cost) return;
    this.save.coins -= cost;
    up[k] = lv + 1;
    this.persist();
    this.sfx.buy();
    this.renderGarage();
  }

  truckAction() {
    const def = truckById(this.garageId);
    if (this.save.trucks[def.id]) {
      this.save.selected = def.id;
      this.persist();
      this.sfx.click();
      this.renderGarage();
      return;
    }
    if (def.unlock || this.save.coins < def.price) return;
    this.save.coins -= def.price;
    this.save.trucks[def.id] = true;
    this.save.selected = def.id;
    this.persist();
    this.sfx.buy();
    this.renderGarage();
  }

  /* ---------- 설정 ---------- */
  openSettings() {
    this.show("settings");
    this.renderSettings();
  }

  renderSettings() {
    const seg = (id, opts, cur, fn) => {
      const el = $(id);
      el.innerHTML = "";
      for (const [v, label] of opts) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.className = v === cur ? "on" : "";
        b.dataset.v = String(v);
        b.addEventListener("click", () => {
          this.sfx.unlock();
          this.sfx.click();
          fn(v);
          this.persist();
          this.renderSettings();
        });
        el.appendChild(b);
      }
    };
    const st = this.save.settings;
    seg("set-quality", [["auto", "자동"], ["high", "높음"], ["mid", "보통"], ["low", "낮음"]], st.quality, (v) => {
      st.quality = v;
      this.applyQuality();
    });
    seg("set-sfx", [[true, "켜기"], [false, "끄기"]], st.sfx, (v) => {
      st.sfx = v;
      this.sfx.setSfx(v);
    });
    seg("set-music", [[true, "켜기"], [false, "끄기"]], st.music, (v) => {
      st.music = v;
      this.sfx.setMusic(v);
    });
    seg("set-shake", [[true, "켜기"], [false, "끄기"]], st.shake, (v) => {
      st.shake = v;
    });
  }

  resetAll() {
    if (!window.confirm("별, 코인, 트럭, 업그레이드가 모두 지워져요. 정말 지울까요?")) return;
    this.save = defaultSave();
    this.persist();
    this.sfx.setSfx(true);
    this.sfx.setMusic(true);
    this.applyQuality();
    this.view.showTitle(this.selectedDef());
    this.renderSettings();
    this.refreshTitle();
  }

  /* ---------- 플레이 ---------- */
  startLevel(def) {
    this.sfx.unlock();
    this.stopPlay();
    $("veil").classList.remove("hidden");
    setTimeout(() => {
      try {
        this.beginLevel(def);
      } finally {
        $("veil").classList.add("hidden");
      }
    }, 20);
  }

  beginLevel(def) {
    this.def = def;
    this.paused = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const truck = this.selectedDef();
    this.sim = this.view.startLevel(def, truck, this.upgradesOf(truck.id));
    this.view.ended = false;
    this.bot = /[?&]bot=1/.test(location.search) ? new Bot(this.sim) : null;
    this.show("play");
    $("combo").classList.add("hidden");
    $("pops").innerHTML = "";
    const modeName = def.mode === "boss" ? "BOSS CHALLENGE" : MODES[def.mode].name;
    $("hud-mode").textContent = modeName;
    $("hud-stage").textContent = def.mode === "tour" ? `${def.world + 1}-${def.n} ${def.name}` : def.name;
    this.buildMissions();
    $("banner-mode").textContent = modeName;
    $("banner-name").textContent = def.name;
    $("banner-goal").textContent = def.desc || missionText(def.main);
    $("banner").classList.remove("hidden");
    this.sfx.engineStart(truck);
    this.sfx.startMusic(def.world);
    // 3 · 2 · 1
    this.countT = 2.4;
    this.countN = 4;
    this.endTimer = 0;
    const showKeys = !this.touchOn && !this.save.seenHelp;
    $("keyhelp").classList.toggle("hidden", !showKeys);
    if (showKeys) {
      this.save.seenHelp = true;
      this.persist();
      setTimeout(() => $("keyhelp").classList.add("hidden"), 9000);
    }
    this.hudT = 0;
    this.lastCombo = 0;
  }

  stopPlay() {
    if (this.endTimer) clearTimeout(this.endTimer);
    this.endTimer = 0;
    this.sim = null;
    this.sfx.engineStop();
    $("banner").classList.add("hidden");
    $("count").classList.add("hidden");
    this.paused = false;
    this.clearPauseOverlay();
  }

  clearPauseOverlay() {
    const ov = document.getElementById("today-pause-overlay");
    if (ov) ov.hidden = true;
  }

  buildMissions() {
    const list = [{ m: this.def.main, cls: "main" }, ...(this.def.bonus || []).map((m) => ({ m, cls: "bonus" }))];
    const ul = $("hud-missions");
    ul.innerHTML = "";
    this.missionEls = list.map(({ m, cls }) => {
      const li = document.createElement("li");
      li.className = cls;
      li.innerHTML = `<span>${missionText(m)}</span><em></em>`;
      ul.appendChild(li);
      return { li, em: li.querySelector("em"), m };
    });
  }

  updateHud() {
    const s = this.sim;
    $("hud-score").textContent = fmt(s.score);
    $("hud-speed").textContent = Math.round(s.speed * 4);
    $("hud-boost").style.transform = `scaleX(${s.boost.toFixed(3)})`;
    $("hud-boost").parentElement.parentElement.classList.toggle("on", s.boosting);
    $("hud-body").style.transform = `scaleX(${(1 - s.damage / 100).toFixed(3)})`;
    $("hud-body").parentElement.parentElement.classList.toggle("low", s.damage > 70);
    const tb = $("tb-boost");
    if (tb) tb.classList.toggle("ready", s.boost > 0.25);
    const t = $("hud-time");
    if (this.def.mode === "time") {
      t.textContent = clock2(s.time);
      t.classList.remove("warn");
    } else {
      const left = Math.max(0, (s.limit || 0) - s.time);
      t.textContent = clock(Math.ceil(left));
      t.classList.toggle("warn", left <= 10 && s.state === "play");
    }
    // 콤보
    const comboEl = $("combo");
    if (s.combo >= 2) {
      comboEl.classList.remove("hidden");
      $("combo-n").textContent = s.combo;
      $("combo-bar").style.transform = `scaleX(${Math.min(1, (s.comboT || 0) / 3).toFixed(3)})`;
      if (s.combo !== this.lastCombo) {
        comboEl.classList.remove("hit");
        void comboEl.offsetWidth;
        comboEl.classList.add("hit");
      }
    } else comboEl.classList.add("hidden");
    this.lastCombo = s.combo;
    this.hudT -= 1;
    if (this.hudT > 0) return;
    this.hudT = 8;
    for (const e of this.missionEls) {
      const q = s.missionState(e.m);
      e.li.classList.toggle("done", !!q.done);
      e.li.classList.toggle("failed", !!q.failed);
      let txt = "";
      if (!q.done && q.max && !["time", "damage", "air"].includes(e.m.k)) txt = `${fmt(q.cur)}/${fmt(q.max)}`;
      if (e.m.k === "damage") txt = `${Math.round(q.cur)}%`;
      if (e.m.k === "air" && !q.done) txt = `${q.cur.toFixed(1)}초`;
      if (q.done) txt = "✓";
      if (e.em.textContent !== txt) e.em.textContent = txt;
    }
  }

  readInput(dt) {
    const s = this.sim;
    const I = this.input;
    const want = (I.right ? 1 : 0) - (I.left ? 1 : 0);
    if (I.touchSteer != null) {
      this.steer = I.touchSteer;
    } else {
      // 키보드는 살짝 부드럽게
      const rate = want === 0 ? 9 : Math.sign(want) !== Math.sign(this.steer) ? 11 : 5.5;
      this.steer += Math.max(-rate * dt, Math.min(rate * dt, want - this.steer));
    }
    s.input.steer = this.steer;
    s.input.throttle = I.up || I.gas ? 1 : 0;
    s.input.brake = I.down || I.brake ? 1 : 0;
    s.input.boost = I.boost;
    s.input.jump = I.jump;
  }

  onEnded(ok) {
    if (ok) this.sfx.success();
    else this.sfx.fail();
    this.endTimer = setTimeout(() => this.showResult(), ok ? 1500 : 1100);
    $("hud-time").classList.remove("warn");
  }

  showResult() {
    const def = this.def;
    const s = this.sim;
    if (!s || !s.result) return;
    const r = s.result;
    this.sfx.stopMusic();
    this.sfx.engineStop();
    const prevStars = this.save.stars[def.id] || 0;
    const firstClear = r.ok && prevStars === 0;
    const prev = this.save.best[def.id];
    const isBest = r.ok && (def.mode === "time" ? !prev || !prev.time || r.time < prev.time : !prev || r.score > prev.score);
    const rw = reward(def, r, firstClear);
    this.save.coins += rw.coins;
    this.save.total.destroyed += r.stats.destroyed;
    this.save.total.bestCombo = Math.max(this.save.total.bestCombo, r.stats.bestCombo);
    this.save.total.bestStunt = Math.max(this.save.total.bestStunt, r.stats.stuntScore);
    const unlocks = [];
    if (r.ok) {
      this.save.stars[def.id] = Math.max(prevStars, r.stars);
      const b = prev || { score: 0, combo: 0, stunt: 0, time: 0, destroyed: 0 };
      this.save.best[def.id] = {
        score: Math.max(b.score, r.score),
        combo: Math.max(b.combo, r.stats.bestCombo),
        stunt: Math.max(b.stunt, r.stats.stuntScore),
        time: b.time ? Math.min(b.time, r.time) : r.time,
        destroyed: Math.max(b.destroyed, r.stats.destroyed),
      };
      if (def.mode === "tour") {
        const list = levelsOf("tour", def.world);
        if (def.n === list.length && this.save.world === def.world && def.world < WORLDS.length - 1) {
          this.save.world = def.world + 1;
          unlocks.push(`새 월드 ${WORLDS[def.world + 1].name} 열림!`);
        }
        if (def.n === list.length && firstClear) unlocks.push("보스 챌린지 열림!");
      }
      if (def.id === "boss-5-B" && !this.save.trucks.golden) {
        this.save.trucks.golden = true;
        unlocks.push("챔피언 트럭 GOLDEN CRUSHER 획득!");
      }
    }
    this.persist();
    this.show("result");
    $("result").scrollTop = 0;
    const card = document.querySelector(".res-card");
    card.classList.toggle("fail", !r.ok);
    $("res-mode").textContent = `${def.mode === "boss" ? "BOSS CHALLENGE" : MODES[def.mode].name} · ${def.name}`;
    $("res-title").textContent = r.ok ? (def.mode === "boss" ? "CHALLENGE CLEAR!" : "STAGE CLEAR!") : "TRY AGAIN!";
    $("res-why").textContent = r.ok ? "" : r.why || "조금만 더!";
    $("res-why").classList.toggle("hidden", r.ok);
    const stars = $("res-stars").children;
    for (let i = 0; i < 3; i += 1) {
      stars[i].classList.remove("on");
      if (i < r.stars) {
        setTimeout(() => {
          if (stars[i]) stars[i].classList.add("on");
          this.sfx.tone({ dur: 0.2, freq: 660 + i * 220, type: "square", gain: 0.1 });
        }, 220 + i * 240);
      }
    }
    $("res-score").textContent = fmt(r.score);
    $("res-best").classList.toggle("hidden", !isBest);
    $("res-destroyed").textContent = fmt(r.stats.destroyed);
    $("res-combo").textContent = fmt(r.stats.bestCombo);
    $("res-stunt").textContent = fmt(r.stats.stuntScore);
    $("res-time").textContent = def.mode === "time" ? clock2(r.time) : clock(r.time);
    $("res-coins").textContent = `+${fmt(rw.coins)}`;
    $("res-coin-note").textContent = rw.note;
    $("res-missions").innerHTML = r.results.map((q) => `<li class="${q.done ? "ok" : ""}">${missionText(q.m)}</li>`).join("");
    const un = $("res-unlock");
    un.textContent = unlocks.join(" · ");
    un.classList.toggle("hidden", !unlocks.length);
    const nx = this.nextOf(def);
    const nextBtn = $("res-next");
    nextBtn.textContent = r.ok ? (nx ? "NEXT" : "목록으로") : "RETRY";
    this.resNext = r.ok ? nx : def;
    // 랭킹: 전체 최고 점수의 합
    const wrap = $("res-rank");
    const total = this.totalScore();
    const canRank = r.ok && isBest && !this.bot && window.TodayGameRank;
    wrap.classList.toggle("hidden", !canRank);
    if (canRank) {
      try {
        window.TodayGameRank.reset();
        window.TodayGameRank.mount({ gameId: "monster-truck-mayhem", gameTitle: "몬스터 트럭 대소동", formParent: wrap });
        window.TodayGameRank.open(Math.max(1, total), { label: `총점 ${fmt(total)}` });
      } catch (_) {
        wrap.classList.add("hidden");
      }
    }
  }

  totalScore() {
    return Object.values(this.save.best).reduce((a, b) => a + (b.score || 0), 0);
  }

  nextOf(def) {
    if (def.mode === "tour") {
      const list = levelsOf("tour", def.world);
      if (def.n < list.length) return list[def.n];
      const boss = levelsOf("boss", def.world)[0];
      if (boss && !this.save.stars[boss.id]) return boss;
      return levelsOf("tour", def.world + 1)[0] || boss || null;
    }
    if (def.mode === "boss") return levelsOf("tour", def.world + 1)[0] || null;
    const list = levelsOf(def.mode);
    const i = list.indexOf(def);
    const n = list[i + 1];
    return n && this.levelOpen(n) ? n : null;
  }

  /* ---------- 화면 글자 ---------- */
  showWord(w, t) {
    const el = $("bigword");
    el.textContent = w;
    el.className = `bigword t${t}`;
    void el.offsetWidth;
    el.classList.add("show");
  }

  showStunt(label, score, bad) {
    const el = $("stuntword");
    el.innerHTML = `<b>${label}</b>${score ? `<small>+${fmt(score)}</small>` : ""}`;
    el.className = `stuntword${bad ? " bad" : ""}`;
    void el.offsetWidth;
    el.classList.add("show");
  }

  addPop(x, y, t, big) {
    const box = $("pops");
    if (box.childElementCount > 14) box.firstChild.remove();
    const el = document.createElement("span");
    el.className = `pop${big ? " big" : ""}`;
    el.textContent = t;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.addEventListener("animationend", () => el.remove());
    box.appendChild(el);
  }

  showTip(m, ms = 1400) {
    const el = $("tip");
    el.textContent = m;
    el.classList.add("show");
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => el.classList.remove("show"), ms);
  }

  doFlash(a) {
    const el = $("flash");
    el.style.transition = "none";
    el.style.opacity = String(a);
    void el.offsetWidth;
    el.style.transition = "opacity .26s";
    el.style.opacity = "0";
  }

  /* ---------- 입력 ---------- */
  bindInput() {
    const I = this.input;
    const map = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", Space: "jump", ShiftLeft: "boost", ShiftRight: "boost" };
    window.addEventListener("keydown", (e) => {
      const k = map[e.code];
      if (k) {
        if (this.screen === "play") e.preventDefault();
        I[k] = true;
      }
      if (e.code === "KeyR" && this.screen === "play" && this.sim && this.sim.state === "play" && !this.paused) this.sim.recover("다시 세웠어요");
    });
    window.addEventListener("keyup", (e) => {
      const k = map[e.code];
      if (k) I[k] = false;
    });
    window.addEventListener("blur", () => {
      for (const k of ["up", "down", "left", "right", "jump", "boost", "gas", "brake"]) I[k] = false;
    });
    const hold = (id, k) => {
      const el = $(id);
      const ids = new Set();
      const on = (e) => {
        e.preventDefault();
        ids.add(e.pointerId);
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {
          /* 무시 */
        }
        I[k] = true;
        el.classList.add("on");
      };
      const off = (e) => {
        ids.delete(e.pointerId);
        if (!ids.size) {
          I[k] = false;
          el.classList.remove("on");
        }
      };
      el.addEventListener("pointerdown", on);
      el.addEventListener("pointerup", off);
      el.addEventListener("pointercancel", off);
      el.addEventListener("lostpointercapture", off);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    };
    hold("tb-gas", "gas");
    hold("tb-brake", "brake");
    hold("tb-jump", "jump");
    hold("tb-boost", "boost");
    $("tb-reset").addEventListener("click", () => {
      if (this.sim && this.sim.state === "play") this.sim.recover("다시 세웠어요");
    });
    // 운전대: 가운데를 기준으로 돌리는 각도
    const zone = $("wheel-zone");
    const wheel = $("wheel");
    let wid = null;
    let a0 = 0;
    let base = 0;
    const center = () => {
      const r = wheel.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const angleOf = (e) => {
      const [cx, cy] = center();
      return Math.atan2(e.clientX - cx, cy - e.clientY);
    };
    const MAX = 1.5;
    const setW = (rad) => {
      wheel.style.transform = `rotate(${rad}rad)`;
      I.touchSteer = Math.max(-1, Math.min(1, rad / MAX));
    };
    let cur = 0;
    zone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (wid != null) return;
      wid = e.pointerId;
      try {
        zone.setPointerCapture(wid);
      } catch (_) {
        /* 무시 */
      }
      a0 = angleOf(e);
      base = cur;
      this.wheelSpring = false;
      wheel.style.transition = "none";
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== wid) return;
      let d = angleOf(e) - a0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // 가운데에 너무 가까우면 각도가 튀지 않게
      const [cx, cy] = center();
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < 14) return;
      cur = Math.max(-MAX, Math.min(MAX, base + d * 1.25));
      setW(cur);
    });
    const release = (e) => {
      if (e.pointerId !== wid) return;
      wid = null;
      cur = 0;
      wheel.style.transition = "transform .16s ease-out";
      setW(0);
      I.touchSteer = null;
      this.steer = 0;
    };
    zone.addEventListener("pointerup", release);
    zone.addEventListener("pointercancel", release);
    zone.addEventListener("lostpointercapture", release);
    // 터치가 처음 들어오면 터치 조작을 켠다
    window.addEventListener(
      "touchstart",
      () => {
        if (!this.touchOn) {
          this.touchOn = true;
          if (this.screen === "play") {
            $("touch").classList.remove("hidden");
            $("keyhelp").classList.add("hidden");
          }
        }
      },
      { passive: true }
    );
    // 효과 없는 첫 입력에서 소리를 연다
    window.addEventListener("pointerdown", () => this.sfx.unlock(), { passive: true });
    window.addEventListener("keydown", () => this.sfx.unlock());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (this.screen === "play" && !this.paused && window.TodayPause && window.TodayPause.pause) window.TodayPause.pause();
        this.sfx.suspend(true);
      } else if (!this.paused) this.sfx.suspend(false);
      this.last = performance.now();
    });
  }

  bindMenus() {
    $("start-btn").addEventListener("click", () => {
      this.sfx.unlock();
      this.sfx.click();
      this.startLevel(this.nextTourStage());
    });
    $("btn-garage").addEventListener("click", () => {
      this.sfx.unlock();
      this.sfx.click();
      this.openGarage();
    });
    for (const b of document.querySelectorAll("[data-mode]")) {
      b.addEventListener("click", () => {
        this.sfx.unlock();
        this.sfx.click();
        this.openStages(b.dataset.mode);
      });
    }
    $("btn-settings").addEventListener("click", () => {
      this.sfx.unlock();
      this.sfx.click();
      this.openSettings();
    });
    for (const b of document.querySelectorAll("[data-back]")) {
      b.addEventListener("click", () => {
        this.sfx.click();
        if (this.screen === "garage" || this.view.mode !== "title") this.goTitle();
        else {
          this.show("title");
          this.refreshTitle();
        }
      });
    }
    $("truck-action").addEventListener("click", () => this.truckAction());
    $("set-reset").addEventListener("click", () => this.resetAll());
    $("res-next").addEventListener("click", () => {
      this.sfx.click();
      if (this.resNext) this.startLevel(this.resNext);
      else this.leaveToList();
    });
    $("res-retry").addEventListener("click", () => {
      this.sfx.click();
      this.startLevel(this.def);
    });
    $("res-garage").addEventListener("click", () => {
      this.sfx.click();
      this.openGarage();
    });
    $("res-list").addEventListener("click", () => {
      this.sfx.click();
      this.leaveToList();
    });
  }

  leaveToList() {
    const mode = this.def.mode === "boss" ? "tour" : this.def.mode;
    const w = this.def.world;
    this.stopPlay();
    this.view.showTitle(this.selectedDef());
    this.openStages(mode, mode === "tour" ? w : null);
  }

  /* ---------- 일시정지 ---------- */
  mountPause() {
    if (!window.TodayPause) return;
    window.TodayPause.mount({
      canPause: () => this.screen === "play" && !!this.sim && this.sim.state !== "done",
      isPaused: () => this.paused,
      pause: () => {
        if (this.screen !== "play") return false;
        this.paused = true;
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
    const ov = document.getElementById("today-pause-overlay");
    const box = ov && ov.querySelector(".today-pause-actions");
    if (box) {
      const add = (label, id, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "today-pause-home";
        b.id = id;
        b.textContent = label;
        b.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.paused = false;
          this.sfx.suspend(false);
          ov.hidden = true;
          fn();
        });
        box.insertBefore(b, box.querySelector("#today-pause-home"));
      };
      add("다시 시작", "pause-restart", () => this.startLevel(this.def));
      add("스테이지 목록", "pause-list", () => this.leaveToList());
      add("차고", "pause-garage", () => this.openGarage());
      const home = box.querySelector("#today-pause-home");
      if (home) home.textContent = "게임 나가기";
    }
    this.syncPause();
  }

  syncPause() {
    const btn = document.getElementById("today-pause-btn");
    if (btn) btn.hidden = this.screen !== "play";
  }

  /* ---------- 고리 ---------- */
  tick(now) {
    requestAnimationFrame(this.tick);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt < 0) dt = 0;
    if (dt > 0.1) dt = 0.1;
    if (this.paused) return;
    this.view.shakeOn = this.save.settings.shake;
    if (this.screen === "play" && this.sim) this.playTick(dt);
    if (!this.save.settings.shake) this.view.shakeA = 0;
    this.view.frame(dt);
    this.autoQuality(dt);
  }

  playTick(dt) {
    const s = this.sim;
    if (this.countT > 0) {
      this.countT -= dt;
      const n = Math.ceil(this.countT / 0.6);
      if (this.countT <= 1.8 && n !== this.countN) {
        this.countN = n;
        const el = $("count");
        el.classList.remove("hidden");
        el.classList.toggle("go", n <= 0);
        el.innerHTML = `<i>${n > 0 ? n : "GO!"}</i>`;
        this.sfx.count(n <= 0);
      }
      if (this.countT <= 0) {
        s.begin();
        $("banner").classList.add("hidden");
        const el = $("count");
        el.classList.add("go");
        el.innerHTML = "<i>GO!</i>";
        this.sfx.count(true);
        setTimeout(() => el.classList.add("hidden"), 520);
        if (this.def.id === "tour-1-1") this.showTip(this.touchOn ? "DRIVE 를 누르고 상자를 들이받아요!" : "W 또는 ↑ 를 누르고 상자를 들이받아요!", 3000);
      }
    }
    if (s.state === "play") {
      if (this.bot) this.bot.drive(dt);
      else this.readInput(dt);
    } else if (s.state === "done") {
      s.input.throttle = 0;
      s.input.brake = 0.4;
      s.input.steer = 0;
      s.input.boost = false;
    }
    this.updateHud();
  }

  autoQuality(dt) {
    if (this.save.settings.quality !== "auto" || this.screen !== "play") return;
    if (dt > 0.04) this.badFrames += dt;
    else this.badFrames = Math.max(0, this.badFrames - dt * 0.5);
    if (this.badFrames > 4) {
      this.badFrames = 0;
      const now = this.view.qualityName;
      if (now !== "low") {
        this.autoQ = now === "high" ? "mid" : "low";
        this.view.setQuality(this.autoQ);
      }
    }
  }
}

export function startApp({ progress } = {}) {
  if (progress) progress(0.85, "관중 입장시키는 중…");
  const app = new App();
  window.MonsterTruck = {
    app,
    LEVELS,
    Bot,
    get sim() {
      return app.sim;
    },
    get view() {
      return app.view;
    },
    start: (id) => app.beginLevel(LEVELS.find((l) => l.id === id)),
    sanitizeSave,
    defaultSave,
    reward,
  };
  return app;
}
