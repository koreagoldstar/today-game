/*
 * 바다괴물 탐험대 · 화면 (메뉴 · 지도 · 도감 · 장비 · 오늘의 도전 · 설정 · 소개 · HUD · 결과)
 */
import { W, H, clamp, fmtSec, dayKey } from "./view.js?v=1";
import { STAGES } from "./stages.js?v=1";
import { MONSTERS, BOSSES, MONSTER_BY_ID, GRADES, EQUIP, levelFor } from "./data.js?v=1";
import { ART, drawMonster, drawSilhouette } from "../art/registry.js?v=1";
import { drawDiverPortrait } from "../art/diver.js?v=1";
import { paintIcons } from "./icons.js?v=1";

const $ = (id) => document.getElementById(id);
const STAGE_COLORS = [
  ["#2bb6e0", "#0d6fb0"],
  ["#2fbf8a", "#0b6a5a"],
  ["#c98a4a", "#5a3a20"],
  ["#4a5a8a", "#1a2244"],
  ["#b066ff", "#3a1a7a"],
  ["#ff6a3d", "#6a1a10"],
  ["#8fd8ff", "#2a5a8a"],
  ["#1a4a8a", "#06142e"],
  ["#c9b45a", "#3a3a2a"],
  ["#ff5a8a", "#4a1030"],
  ["#4a8aaa", "#0a2a3a"],
  ["#3a2a6a", "#05040f"],
];

/** 괴물 그림 (발견 전이면 실루엣) 을 캔버스에 */
function monsterCanvas(id, w, h, known, opt = {}) {
  const c = document.createElement("canvas");
  const k = 2;
  c.width = w * k;
  c.height = h * k;
  const x = c.getContext("2d");
  x.scale(k, k);
  const p = { card: true, t: opt.t || 0.6, face: 1, s: opt.s || 0.7, camo: 0, peek: 1, look: { x: 0.4, y: 0.1 }, hit: 0, wind: 0, inflate: 0, open: 0.8, out: 0.75, walk: 0.5, squish: 0, bite: 0 };
  const has = !!ART[id];
  x.translate(w / 2 - (id === "reefEel" ? w * 0.28 : 0), h / 2 + (opt.dy || 4));
  if (!has) {
    // 아직 그림이 없는 괴물: 물음표 실루엣
    x.fillStyle = known ? "#3fdcff" : "rgba(11,42,74,0.85)";
    x.beginPath();
    x.ellipse(0, 0, w * 0.3, h * 0.34, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "rgba(255,255,255,0.5)";
    x.font = `${Math.round(h * 0.42)}px "Bagel Fat One", sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("?", 0, 2);
    return c;
  }
  if (known) drawMonster(x, id, p);
  else drawSilhouette(x, id, p, w, h, "rgba(8,34,64,0.9)");
  return c;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.huntEls = [];
    this.lastScore = -1;
    this.hintT = 0;
    this.toastT = 0;
    this.comboShown = 0;
    this.bind();
    paintIcons();
  }

  bind() {
    const g = this.g;
    const on = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("pointerdown", (e) => e.stopPropagation());
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        g.audio.unlock();
        g.audio.play("click");
        fn(e);
      });
    };
    on("start-btn", () => this.showMap());
    on("menu-codex", () => this.showCodex());
    on("menu-gear", () => this.showGear());
    on("menu-daily", () => this.showDaily());
    on("menu-settings", () => this.showSettings());
    document.querySelectorAll("[data-back]").forEach((b) => {
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        g.audio.play("click");
        this.showMenu();
      });
    });
    on("brief-back", () => this.showMap());
    on("brief-go", () => g.startStage(this.briefIndex));
    on("pause-btn", () => g.pause());
    on("pause-resume", () => g.resume());
    on("pause-retry", () => g.retry());
    on("pause-quit", () => g.quit());
    on("sound-btn", () => this.toggleSound());
    on("sonar-btn", () => g.sonar());
    on("res-retry", () => g.startStage(g.stageIndex));
    on("res-map", () => {
      g.startMenu();
      this.showMap();
    });
    on("res-next", () => {
      const n = g.stageIndex + 1;
      if (STAGES[n] && !STAGES[n].soon && n < g.save.data.unlocked) {
        g.startMenu();
        this.showBrief(n);
      } else {
        g.startMenu();
        this.showMap();
      }
    });
    on("tutor-ok", () => {
      $("tutor").hidden = true;
      g.save.data.tutorial = true;
      g.save.save();
      if (g.state === "paused") g.resume();
    });
    const det = $("codex-detail");
    det.addEventListener("click", () => (det.hidden = true));
  }

  onResize() {}

  hideScreens() {
    for (const id of ["title", "map", "codex", "gear", "daily", "settings", "brief", "result", "pause", "tutor"]) $(id).hidden = true;
  }
  show(id) {
    this.hideScreens();
    $(id).hidden = false;
    document.body.classList.toggle("is-menu", id !== null);
    paintIcons($(id));
  }

  /* ================================================================
   * 메뉴
   * ============================================================== */
  showMenu() {
    const tt = $("title");
    if (tt) tt.scrollTop = 0;
    this.show("title");
    this.hideHUD();
    const d = this.g.save.data;
    const lv = levelFor(d.xp);
    $("chip-lv").querySelector("b").textContent = `Lv.${lv.lv}`;
    $("xp-fill").style.width = `${Math.round((lv.cur / lv.need) * 100)}%`;
    $("coin-n").textContent = d.coins.toLocaleString("ko-KR");
    const next = Math.min(d.unlocked, STAGES.filter((s) => !s.soon).length) - 1;
    const st = STAGES[Math.max(0, next)];
    $("start-label").textContent = `${String(st.no).padStart(2, "0")} · ${st.name}`;
    $("codex-badge").hidden = !Object.keys(d.fresh || {}).length;
    const daily = this.g.daily;
    $("daily-badge").hidden = !(daily && daily.done && !daily.claimed);
  }

  /* ---------------- 지도 ---------------- */
  showMap() {
    this.show("map");
    const d = this.g.save.data;
    const list = $("map-list");
    list.innerHTML = "";
    const total = this.g.save.totalStars();
    $("map-stars").innerHTML = `<span data-icon="star"></span><b>${total}</b>/36`;
    STAGES.forEach((s, i) => {
      const rec = this.g.save.stage(s.id);
      const open = !s.soon && s.no <= d.unlocked;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "map-card" + (open ? "" : " locked");
      const [c1, c2] = STAGE_COLORS[i];
      b.style.setProperty("--c1", c1);
      b.style.setProperty("--c2", c2);
      const stars = [1, 2, 3].map((k) => `<span data-icon="star" class="${rec.stars >= k ? "" : "off"}"></span>`).join("");
      const boss = s.boss ? `<span class="boss-tag"><span data-icon="boss"></span>BOSS</span>` : "";
      b.innerHTML = `<span class="no">${String(s.no).padStart(2, "0")}</span>
        <span><h3>${s.name}${boss}</h3><p class="en">${s.en}</p></span>
        ${open ? `<span class="stars">${stars}</span>` : `<span class="lock" data-icon="lock"></span>`}
        <span class="depth">${s.soon ? "준비 중" : `수심 ${(i + 1) * 40}m${rec.best ? ` · 최고 ${rec.best.toLocaleString("ko-KR")}` : ""}`}</span>`;
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.g.audio.play("click");
        if (!open) {
          this.toastText(s.soon ? "곧 열리는 바다예요!" : "앞 지역을 탐험하면 열려요");
          return;
        }
        this.showBrief(i);
      });
      list.appendChild(b);
    });
    paintIcons(list);
    paintIcons($("map"));
  }

  /* ---------------- 출발 전 소개 ---------------- */
  showBrief(i) {
    const s = STAGES[i];
    this.briefIndex = i;
    this.show("brief");
    $("brief-no").textContent = `STAGE ${String(s.no).padStart(2, "0")}`;
    $("brief-h").textContent = s.name;
    $("brief-en").textContent = s.en;
    const mons = $("brief-mons");
    mons.innerHTML = "";
    for (const id of s.hunt.pool) {
      const def = MONSTER_BY_ID[id];
      const known = !!this.g.save.codex(id);
      const f = document.createElement("figure");
      f.appendChild(monsterCanvas(id, 70, 58, known, { s: 0.55 }));
      const cap = document.createElement("figcaption");
      cap.textContent = known ? def.name : "???";
      f.appendChild(cap);
      mons.appendChild(f);
    }
    const rec = this.g.save.stage(s.id);
    const eq = this.g.save.data.equip;
    const o2 = s.oxygen + EQUIP[3].levels[eq.tank];
    $("brief-info").innerHTML = `<p>🔎 ${s.tip}</p><p>산소 ${fmtSec(o2)} · 3별 목표: 모두 포획 + ${fmtSec(s.par)} 안에 + 피해 1번 이하${rec.best ? ` · 최고 ${rec.best.toLocaleString("ko-KR")}점` : ""}</p>`;
  }

  /* ---------------- 도감 ---------------- */
  showCodex() {
    this.show("codex");
    const save = this.g.save;
    const grid = $("codex-grid");
    grid.innerHTML = "";
    const seenN = MONSTERS.filter((m) => save.codex(m.id)).length;
    $("codex-count").innerHTML = `<b>${seenN}</b>/${MONSTERS.length}`;
    let lastStage = 0;
    for (const m of MONSTERS) {
      if (m.stage !== lastStage) {
        lastStage = m.stage;
        const h = document.createElement("p");
        h.className = "codex-sec";
        h.textContent = `${String(m.stage).padStart(2, "0")} ${STAGES[m.stage - 1].name}`;
        grid.appendChild(h);
      }
      const c = save.codex(m.id);
      const known = !!c;
      const gr = GRADES[m.grade];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cx-card" + (known ? "" : " unknown");
      b.style.setProperty("--gc", known ? gr.color : "rgba(255,255,255,0.15)");
      b.appendChild(monsterCanvas(m.id, 120, 100, known));
      b.insertAdjacentHTML("beforeend", `<span class="no">${String(m.no).padStart(2, "0")}</span><b>${known ? m.name : "???"}</b><small>${known ? gr.label : "?"}</small>${c && c.caught ? `<span class="cnt">×${c.caught}</span>` : ""}${save.data.fresh[m.id] ? '<i class="new">NEW</i>' : ""}`);
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.g.audio.play("click");
        this.codexDetail(m);
      });
      grid.appendChild(b);
    }
    const h = document.createElement("p");
    h.className = "codex-sec";
    h.textContent = "BOSS";
    grid.appendChild(h);
    for (const bo of BOSSES) {
      const c = save.codex(bo.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cx-card" + (c ? "" : " unknown");
      b.style.setProperty("--gc", c ? GRADES.BOSS.color : "rgba(255,255,255,0.15)");
      b.appendChild(monsterCanvas(bo.id, 120, 100, !!c));
      b.insertAdjacentHTML("beforeend", `<b>${c ? bo.name : "???"}</b><small>BOSS</small>${c && c.caught ? `<span class="cnt">×${c.caught}</span>` : ""}`);
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.g.audio.play("click");
        this.codexDetail({ ...bo, grade: "BOSS", boss: true, how: c ? "모든 괴물을 잡으면 나타나요" : "이 바다의 괴물을 모두 잡으면 나타나요" });
      });
      grid.appendChild(b);
    }
  }
  codexDetail(m) {
    const save = this.g.save;
    const c = save.codex(m.id);
    const gr = GRADES[m.grade];
    const det = $("codex-detail");
    det.innerHTML = "";
    const card = document.createElement("div");
    card.className = "cd-card";
    card.style.setProperty("--gc", c ? gr.color : "rgba(255,255,255,0.3)");
    card.appendChild(monsterCanvas(m.id, 260, 200, !!c, { s: 1.2, dy: 10 }));
    if (c) {
      card.insertAdjacentHTML(
        "beforeend",
        `<h3>${m.name}</h3><span class="cd-grade">${gr.label} · ${gr.kr}</span>
        <div class="cd-rows"><p><em>발견 지역</em>${String(m.stage).padStart(2, "0")} ${STAGES[m.stage - 1].name}</p>
        <p><em>특징</em>${m.desc}</p><p><em>${m.boss ? "나타나는 때" : "찾는 법"}</em>${m.how}</p>
        <p><em>기록</em>${c.caught ? `포획 ${c.caught}번` : "아직 못 잡았어요"} · 처음 만난 날 ${c.first || "-"}</p></div>`
      );
      delete save.data.fresh[m.id];
      save.save();
    } else {
      card.insertAdjacentHTML("beforeend", `<h3>???</h3><div class="cd-rows"><p><em>발견 지역</em>${String(m.stage).padStart(2, "0")} ${STAGES[m.stage - 1].name}</p><p><em>힌트</em>${m.how}</p></div>`);
    }
    card.insertAdjacentHTML("beforeend", `<button type="button" class="btn-res primary" style="width:100%"><span data-icon="check"></span>닫기</button>`);
    det.appendChild(card);
    paintIcons(det);
    det.hidden = false;
  }

  /* ---------------- 장비 ---------------- */
  showGear() {
    this.show("gear");
    this.renderGear();
  }
  renderGear() {
    const d = this.g.save.data;
    $("gear-coins").textContent = d.coins.toLocaleString("ko-KR");
    const list = $("gear-list");
    list.innerHTML = "";
    for (const e of EQUIP) {
      const lv = d.equip[e.id];
      const max = lv >= e.levels.length - 1;
      const cost = max ? 0 : e.cost[lv + 1];
      const row = document.createElement("div");
      row.className = "gear-card";
      row.innerHTML = `<span class="gi" data-icon="${e.icon === "radar" ? "radar" : e.icon === "tank" ? "tank" : e.icon}"></span>
        <div><h3>${e.name} <small>Lv.${lv + 1}</small></h3><p>${e.desc} ${e.unit(e.levels[lv])}${max ? "" : ` → <b>${e.unit(e.levels[lv + 1])}</b>`}</p>
        <span class="pips">${e.levels.map((_, k) => `<i class="${k <= lv ? "on" : ""}"></i>`).join("")}</span></div>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-res" + (max ? "" : " primary");
      btn.innerHTML = max ? "MAX" : `<span data-icon="coin"></span>${cost}`;
      btn.disabled = max || d.coins < cost;
      btn.addEventListener("pointerdown", (ev) => ev.stopPropagation());
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (this.g.buyEquip(e.id)) {
          this.renderGear();
          this.toastText(`${e.name} 업그레이드!`);
        }
      });
      row.appendChild(btn);
      list.appendChild(row);
    }
    paintIcons(list);
  }

  /* ---------------- 오늘의 도전 ---------------- */
  showDaily() {
    this.show("daily");
    const card = $("daily-card");
    card.innerHTML = "";
    const d = this.g.daily;
    if (!d) {
      card.innerHTML = "<p>바다를 탐험하면 오늘의 바다괴물이 정해져요!</p>";
      return;
    }
    const def = MONSTER_BY_ID[d.monster];
    const known = !!this.g.save.codex(def.id);
    card.insertAdjacentHTML("beforeend", `<p class="kick">${dayKey()} · 오늘의 바다괴물</p>`);
    card.appendChild(monsterCanvas(def.id, 240, 180, known, { s: 1.1, dy: 8 }));
    card.insertAdjacentHTML("beforeend", `<h3>${known ? def.name : "???"}</h3><p class="kick">${def.how}</p>`);
    const goals = [
      ["3번 발견하기", d.found, 3],
      ["10번 명중하기", d.hits, 10],
      ["PERFECT 1번", d.perfect, 1],
    ];
    for (const [label, v, max] of goals) {
      const ok = v >= max;
      card.insertAdjacentHTML("beforeend", `<div class="goal${ok ? " done" : ""}"><span>${ok ? "✔ " : ""}${label}</span><b>${Math.min(v, max)}/${max}</b><i><b style="width:${Math.min(100, (v / max) * 100)}%"></b></i></div>`);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-res primary";
    btn.innerHTML = d.claimed ? "오늘 보상 받았어요!" : d.done ? `<span data-icon="gift"></span>보상 받기 (코인 150)` : `<span data-icon="dive"></span>탐험하러 가기`;
    btn.disabled = d.claimed;
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (d.done && !d.claimed) {
        const c = this.g.claimDaily();
        if (c) {
          this.g.audio.play("bonus");
          this.toastText(`코인 +${c}!`);
          this.showDaily();
        }
      } else this.showMap();
    });
    card.appendChild(btn);
    paintIcons(card);
  }

  /* ---------------- 설정 ---------------- */
  showSettings() {
    this.show("settings");
    const list = $("set-list");
    list.innerHTML = "";
    const s = this.g.save.data.settings;
    const rows = [
      ["music", "배경음악"],
      ["sfx", "효과음"],
      ["vibrate", "진동"],
    ];
    for (const [k, label] of rows) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "set-row";
      b.innerHTML = `<span>${label}</span><i class="toggle${s[k] ? " on" : ""}"></i>`;
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = !this.g.save.data.settings[k];
        this.g.save.setSetting(k, v);
        if (k === "music") this.g.audio.setMusic(v);
        if (k === "sfx") this.g.audio.setSfx(v);
        b.querySelector(".toggle").classList.toggle("on", v);
      });
      list.appendChild(b);
    }
    const t = document.createElement("button");
    t.type = "button";
    t.className = "set-row";
    t.innerHTML = "<span>탐험 방법 다시 보기</span><span>›</span>";
    t.addEventListener("pointerdown", (e) => e.stopPropagation());
    t.addEventListener("click", (e) => {
      e.stopPropagation();
      this.g.save.data.tutorial = false;
      this.g.save.save();
      this.toastText("다음 탐험에서 다시 알려 줄게요");
    });
    list.appendChild(t);
  }

  toggleSound() {
    const s = this.g.save.data.settings;
    const v = !(s.sfx || s.music);
    this.g.save.setSetting("sfx", v);
    this.g.save.setSetting("music", v);
    this.g.audio.setSfx(v);
    this.g.audio.setMusic(v);
    const ic = $("sound-btn").querySelector("[data-icon]");
    ic.setAttribute("data-icon", v ? "sound" : "mute");
    ic.dataset.painted = "";
    paintIcons($("sound-btn"));
  }

  /* ================================================================
   * 탐험 HUD
   * ============================================================== */
  showHUD(stage, n) {
    this.hideScreens();
    document.body.classList.remove("is-menu");
    for (const id of ["hud", "radar", "sonar-btn"]) $(id).hidden = false;
    $("hud-stage").textContent = `${String(stage.no).padStart(2, "0")} · ${stage.name}`;
    const hunt = $("hunt");
    hunt.innerHTML = "";
    this.huntEls = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement("i");
      hunt.appendChild(el);
      this.huntEls.push(el);
    }
    this.huntN = 0;
    this.lastScore = -1;
    $("combo").hidden = true;
    const s = this.g.save.data.settings;
    const ic = $("sound-btn").querySelector("[data-icon]");
    ic.setAttribute("data-icon", s.sfx || s.music ? "sound" : "mute");
    ic.dataset.painted = "";
    paintIcons($("hud"));
    paintIcons($("sonar-btn"));
    paintIcons($("radar"));
  }
  hideHUD() {
    for (const id of ["hud", "radar", "sonar-btn", "combo", "hint", "toast", "bossbar"]) $(id).hidden = true;
  }
  showBoss(def) {
    $("boss-name").textContent = def.name;
    $("boss-rage").hidden = true;
    $("boss-fill").style.transform = "scaleX(1)";
    $("bossbar").hidden = false;
    paintIcons($("bossbar"));
  }
  bossHP(k, rage) {
    $("boss-fill").style.transform = `scaleX(${Math.max(0, k).toFixed(3)})`;
    $("boss-rage").hidden = !rage;
    $("bossbar").classList.toggle("rage", !!rage);
  }
  hideBoss() {
    $("bossbar").hidden = true;
  }

  updateHUD(r) {
    const k = clamp(r.o2 / r.o2Max, 0, 1);
    $("o2-fill").style.transform = `scaleX(${k.toFixed(3)})`;
    $("o2-t").textContent = fmtSec(Math.ceil(r.o2));
    $("o2").classList.toggle("low", r.o2 < 15);
    if (r.score !== this.lastScore) {
      this.lastScore = r.score;
      $("score").textContent = r.score.toLocaleString("ko-KR");
    }
    // 레이더 점
    const dots = $("radar-dots").children;
    for (let i = 0; i < 5; i++) dots[i].classList.toggle("on", i < r.radarLv);
    $("radar-dots").classList.toggle("hot", r.radarLv >= 4);
    // 콤보
    const cb = $("combo");
    if (r.combo >= 2) {
      cb.hidden = false;
      if (this.comboShown !== r.combo) {
        this.comboShown = r.combo;
        $("combo-n").textContent = r.combo;
        cb.classList.remove("bump");
        void cb.offsetWidth;
        cb.classList.add("bump");
      }
      $("combo-fill").style.transform = `scaleX(${clamp(r.comboT / 1.15, 0, 1).toFixed(3)})`;
    } else if (!cb.hidden) {
      cb.hidden = true;
      this.comboShown = 0;
    }
    // 소나 쿨다운
    const sk = clamp(1 - r.sonarCd / r.sonarMax, 0, 1);
    $("sonar-arc").style.strokeDasharray = `${(sk * 100).toFixed(1)} 100`;
    $("sonar-btn").classList.toggle("cool", r.sonarCd > 0);
    // 힌트 · 토스트 시간
    const dt = 1 / 60;
    if (this.hintT > 0) {
      this.hintT -= dt;
      if (this.hintT <= 0) $("hint").hidden = true;
    }
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) $("toast").hidden = true;
    }
  }

  radarPing(lv) {
    const p = $("radar-pulse");
    p.classList.remove("go");
    void p.offsetWidth;
    if (lv >= 3) p.classList.add("go");
  }
  sonarUsed() {}
  o2Hit() {
    const o = $("o2");
    o.classList.remove("hit");
    void o.offsetWidth;
    o.classList.add("hit");
  }
  /** 동전이 날아갈 화면 자리 (점수 칸) */
  coinTarget() {
    return { x: W / 2 - 40, y: 26 };
  }

  hint(text, sec = 3) {
    const h = $("hint");
    h.textContent = text;
    h.hidden = false;
    this.hintT = sec;
  }
  toastText(text) {
    const t = $("toast");
    t.innerHTML = `<b style="padding-left:calc(var(--k)*10px)">${text}</b>`;
    t.style.setProperty("--gc", "rgba(160,235,255,0.5)");
    t.hidden = false;
    t.style.animation = "none";
    void t.offsetWidth;
    t.style.animation = "";
    this.toastT = 1.8;
  }
  discovered(def, fresh) {
    const t = $("toast");
    const gr = GRADES[def.grade];
    t.innerHTML = "";
    t.appendChild(monsterCanvas(def.id, 52, 44, true, { s: 0.42 }));
    t.insertAdjacentHTML("beforeend", `<span><b>${fresh ? "NEW! " : ""}${def.name}</b><small>${gr.label}</small></span>`);
    t.style.setProperty("--gc", gr.color);
    t.hidden = false;
    t.style.animation = "none";
    void t.offsetWidth;
    t.style.animation = "";
    this.toastT = 2.2;
    // 사냥 칸: 발견 표시
    const el = this.huntEls.find((e) => !e.classList.contains("found") && !e.classList.contains("got"));
    if (el) {
      el.classList.add("found");
      el.dataset.id = def.id;
      el.innerHTML = "";
      el.appendChild(monsterCanvas(def.id, 38, 38, false, { s: 0.3, dy: 2 }));
    }
  }
  captured(def, first) {
    let el = this.huntEls.find((e) => e.dataset.id === def.id && !e.classList.contains("got"));
    if (!el) el = this.huntEls.find((e) => !e.classList.contains("got"));
    if (el) {
      el.classList.remove("found");
      el.classList.add("got");
      el.dataset.id = def.id;
      el.innerHTML = "";
      el.appendChild(monsterCanvas(def.id, 38, 38, true, { s: 0.3, dy: 2 }));
    }
    if (first) {
      const t = $("toast");
      const gr = GRADES[def.grade];
      t.innerHTML = "";
      t.appendChild(monsterCanvas(def.id, 52, 44, true, { s: 0.42 }));
      t.insertAdjacentHTML("beforeend", `<span><b>NEW CARD! ${def.name}</b><small>도감에 등록됐어요</small></span>`);
      t.style.setProperty("--gc", gr.color);
      t.hidden = false;
      this.toastT = 2.4;
    }
  }

  tutorial() {
    $("tutor").hidden = false;
    paintIcons($("tutor"));
    this.g.pauseForTutor = true;
    if (this.g.state === "play") {
      this.g.resumeState = "play";
      this.g.state = "paused";
    }
  }

  showPause(on) {
    $("pause").hidden = !on;
    if (on) paintIcons($("pause"));
  }

  /* ================================================================
   * 결과
   * ============================================================== */
  showResult(r, rec) {
    this.show("result");
    const s = r.stage;
    const body = $("result-body");
    const d = this.g.save.data;
    const lv = levelFor(d.xp);
    const goals = [
      [r.clear, `바다괴물 ${r.total}마리 모두 포획`],
      [r.clear && r.time <= s.par, `${fmtSec(s.par)} 안에 탐험 (${fmtSec(r.time)})`],
      [r.clear && r.hurtN <= 1, `피해 1번 이하 (${r.hurtN}번)`],
    ];
    const stars = [1, 2, 3].map((k, i) => `<span data-icon="star" class="${r.stars >= k ? "" : "off"}" style="animation-delay:${0.25 + i * 0.22}s"></span>`).join("");
    body.innerHTML = `
      ${r.final ? '<p class="res-hero">🏆 바다의 영웅 · 모든 바다 탐험 완료!</p>' : ""}
      <p class="res-title">${r.final ? "THE ABYSSAL 포획!" : r.clear ? "탐험 성공!" : "산소 부족!"}</p>
      <p class="res-sub">${String(s.no).padStart(2, "0")} ${s.name} · 잡은 괴물 ${r.captured.filter((id) => MONSTER_BY_ID[id]).length}/${r.total}${s.boss ? (r.bossDone ? " · 보스 포획!" : " · 보스 남음") : ""}</p>
      <div class="res-stars">${stars}</div>
      <div class="res-goals">${goals.map(([ok, t]) => `<p class="${ok ? "ok" : ""}"><i>${ok ? "✔" : ""}</i>${t}</p>`).join("")}</div>
      <p class="res-score">${r.score.toLocaleString("ko-KR")}${rec.newBest ? '<span class="res-best">최고 기록!</span>' : ""}</p>
      <div class="res-stats">
        <div><b>${r.found}</b><small>발견</small></div>
        <div><b>${Math.round(r.acc * 100)}%</b><small>명중률</small></div>
        <div><b>${r.maxCombo}</b><small>최고 콤보</small></div>
        <div><b>${r.perfects}</b><small>PERFECT</small></div>
      </div>
      <div class="res-cards" id="res-cards"></div>
      <div class="res-reward"><p><span data-icon="coin"></span>+${r.coins}</p><p>⭐ XP +${r.xp}</p><p>Lv.${lv.lv}</p></div>
      ${r.dailyDone ? '<p class="res-sub">🎁 오늘의 도전 완료! 메뉴에서 보상을 받으세요</p>' : ""}`;
    const cards = $("res-cards");
    r.captured.forEach((id, i) => {
      const def = MONSTER_BY_ID[id] || { name: (BOSSES.find((b) => b.id === id) || {}).name || id, grade: "BOSS" };
      const f = document.createElement("figure");
      f.style.setProperty("--gc", GRADES[def.grade].color);
      f.style.animationDelay = `${0.6 + i * 0.12}s`;
      f.appendChild(monsterCanvas(id, 76, 62, true, { s: 0.55 }));
      f.insertAdjacentHTML("beforeend", `<figcaption>${def.name}</figcaption>${r.newCards.includes(id) ? '<i class="new">NEW</i>' : ""}`);
      cards.appendChild(f);
    });
    const next = STAGES[this.g.stageIndex + 1];
    $("res-next").disabled = !(next && !next.soon && this.g.stageIndex + 1 < d.unlocked);
    paintIcons($("result"));
  }
}
