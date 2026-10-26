/*
 * NEW 둥지디펜스 · 화면 (HTML): 위 칸 · 타워 칸 · 타워 정보 · 카드 · 새 적 안내 · 결과 · 월드 · 설정 · 도움말 · 튜토리얼
 *  창은 쌓아서(stack) 열고 닫는다. 창이 열려 있는 동안 전투는 멈춘다 (game.loop 가 확인).
 *  화면에 보이는 타워 수치는 sim 의 statsOf 결과 그대로.
 */
import { TOWERS, TOWER_ORDER, TARGET_MODES } from "./data/towers.js";
import { WORLDS, worldById } from "./data/worlds.js";
import { ENEMIES, BOSSES, specialsOf, bossesOf } from "./data/enemies.js";
import { CARDS, cardById } from "./data/cards.js";
import { newEnemiesAt, WAVES_PER_WORLD } from "./data/waves.js";
import { statsOf, nextSteps, tierOf, baseStats } from "./sim/towers.js";
import { DIFFICULTY } from "./sim/sim.js";
import { THREE, group } from "./render/kit.js";
import { MODELS } from "./render/enemyModels.js";
import { buildTower } from "./render/towerModels.js";

const $ = (id) => document.getElementById(id);
// 전술 카드 종류 (색 · 띠 글자)
const CARD_CAT = { power: "atk", blast: "atk", boss: "atk", elite: "atk", double: "atk", chain: "atk", dot: "atk", crit: "atk", swift: "tac", eagle: "tac", frost: "tac", bounty: "eco", interest: "eco", discount: "eco", refund: "eco", shieldUp: "nest", repair: "nest" };
const CAT_NAME = { atk: "공격", tac: "전술", eco: "경제", nest: "둥지" };
const fmt = (n) => (Math.round(n * 10) / 10).toString();

export class UI {
  constructor(game) {
    this.g = game;
    this.stack = [];
    this.last = {};
    this.coachStep = null;
    this.bind();
  }

  /* ---------------- 연결 ---------------- */
  bind() {
    const g = this.g;
    const on = (id, fn) =>
      $(id).addEventListener("click", (e) => {
        g.audio.unlock();
        g.audio.play("click");
        fn(e);
      });
    on("go-campaign", () => this.show("worlds"));
    on("go-endless", () => {
      if (!g.save.campaignDone) return this.toast("150 웨이브 캠페인을 모두 깨면 열려요!");
      this.show("endless");
    });
    on("go-help", () => this.show("help"));
    on("go-settings", () => this.show("settings"));
    on("speed-btn", () => g.cycleSpeed());
    on("pause-btn", () => this.openPause());
    on("next-btn", () => g.startWave());
    on("p-resume", () => this.back());
    on("p-restart", () => this.confirm("이 월드를 처음부터 다시 할까요?", "지금까지 세운 타워와 카드가 없어져요.", () => {
      this.closeAll();
      g.restartRun();
    }));
    on("p-help", () => this.show("help"));
    on("p-settings", () => this.show("settings"));
    on("p-menu", () => this.confirm("메뉴로 갈까요?", g.sim && g.sim.mode === "campaign" ? "정비 시간까지의 진행은 저장돼 있어 '이어서 하기'로 돌아올 수 있어요." : "무한 생존 기록은 지금 웨이브까지로 남지 않아요.", () => g.toTitle()));
    on("tp-close", () => g.select(null));
    on("place-yes", () => g.pending && g.tryPlace(g.pending.cx, g.pending.cz));
    on("place-no", () => g.cancelPlace());
    on("nf-ok", () => this.back());
    on("banner-skip", () => g.skipIntro());
    on("tip-x", () => ($("tip").hidden = true));
    on("c-yes", () => {
      const fn = this.confirmFn;
      this.confirmFn = null;
      this.back();
      fn && fn();
    });
    on("c-no", () => this.back());
    on("r-retry", () => {
      const s = g.sim;
      this.closeAll();
      g.restartRun();
      void s;
    });
    on("r-menu", () => g.toTitle());
    on("r-next", () => this.resultNext());
    on("run-go", () => {
      const run = g.save.data.campaign.run;
      if (!run) return;
      this.closeAll();
      g.startRun({ world: run.world, mode: "campaign", difficulty: run.difficulty, snapshot: run });
    });
    on("run-drop", () =>
      this.confirm("저장된 판을 지울까요?", "처음부터 다시 시작해요.", () => {
        g.save.saveRun(null);
        this.renderWorlds();
      })
    );
    for (const b of document.querySelectorAll("[data-back]")) b.addEventListener("click", () => (g.audio.play("click"), this.back()));
    for (const b of document.querySelectorAll("#help-tabs button")) b.addEventListener("click", () => this.helpTab(b.dataset.tab));
    // 설정
    const st = g.save.data.settings;
    $("set-music").addEventListener("input", (e) => {
      const v = +e.target.value / 100;
      g.save.setting("musicVol", v);
      g.audio.unlock();
      g.audio.setMusic(v > 0);
      g.audio.setVolumes(v, g.save.data.settings.sfxVol);
    });
    $("set-sfx").addEventListener("input", (e) => {
      const v = +e.target.value / 100;
      g.save.setting("sfxVol", v);
      g.audio.unlock();
      g.audio.setSfx(v > 0);
      g.audio.setVolumes(g.save.data.settings.musicVol, v);
      g.audio.play("coin");
    });
    $("set-shake").addEventListener("change", (e) => g.save.setting("shake", e.target.checked));
    $("set-nums").addEventListener("change", (e) => {
      g.save.setting("dmgNums", e.target.checked);
      g.view.settings.dmgNums = e.target.checked;
    });
    void st;
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !this.stack.length) return;
      const top = this.stack[this.stack.length - 1];
      if (top === "cards" || top === "result") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.back();
    });
  }

  /* ---------------- 창 쌓기 ---------------- */
  modal() {
    return this.stack.length > 0;
  }
  show(id) {
    const top = this.stack[this.stack.length - 1];
    if (top) $(top).hidden = true;
    $("title").hidden = true;
    this.stack.push(id);
    $(id).hidden = false;
    this.onShow(id);
    if (this.g.mode === "play") this.g.setPaused(true);
  }
  back() {
    const id = this.stack.pop();
    if (id) $(id).hidden = true;
    const top = this.stack[this.stack.length - 1];
    if (top) {
      $(top).hidden = false;
      this.onShow(top);
    } else if (this.g.mode === "play") {
      this.g.setPaused(false);
      if (id === "newfoe" || id === "cards") this.afterModal();
    } else this.showTitle();
  }
  closeAll() {
    for (const id of this.stack) $(id).hidden = true;
    this.stack = [];
    if (this.g.mode === "play") this.g.setPaused(false);
  }
  onShow(id) {
    if (id === "worlds") this.renderWorlds();
    else if (id === "endless") this.renderEndless();
    else if (id === "settings") this.renderSettings();
    else if (id === "help") this.helpTab(this.helpOn || "how");
  }
  openPause() {
    if (this.g.mode !== "play" || this.stack.length) return;
    const s = this.g.sim;
    $("p-note").textContent = s.mode === "campaign" ? `${s.world.name} · 웨이브 ${s.local} / 30 · ${s.diff.name}` : `무한 생존 · 웨이브 ${s.local}`;
    this.show("pause");
  }
  confirm(h, t, fn) {
    $("c-h").textContent = h;
    $("c-t").textContent = t;
    this.confirmFn = fn;
    this.show("confirm");
  }
  confirmSell() {
    const s = this.g.sim;
    const t = s.tower(this.g.sel);
    if (!t) return;
    this.confirm("팔까요?", `${baseStats(t.type, t.level, t.evo, t.elevel).name} → 코인 ${s.sellValue(t)}`, () => this.g.sell());
  }

  /* ---------------- 화면 자리 (카메라가 이 안에 전장을 맞춤) ---------------- */
  insets() {
    const f = this.g.fieldEl.getBoundingClientRect();
    const out = { top: 8, bottom: 8, left: 8, right: 8 };
    if (this.g.mode !== "play") return { top: 0, bottom: 0, left: 0, right: 0 };
    const hud = $("hud");
    if (!hud.hidden) out.top = hud.getBoundingClientRect().bottom - f.top + 4;
    const bar = $("tbar");
    if (!bar.hidden) out.bottom = f.bottom - bar.getBoundingClientRect().top + 2;
    document.body.style.setProperty("--hud-h", `${Math.round(out.top)}px`);
    document.body.style.setProperty("--bar-h", `${Math.round(out.bottom)}px`);
    return out;
  }

  /* ---------------- 첫 화면 ---------------- */
  showTitle() {
    document.body.classList.add("is-title");
    document.body.classList.remove("is-play");
    for (const id of ["hud", "tbar", "tpanel", "bossbar", "banner", "tip", "place-ok"]) $(id).hidden = true;
    $("title").hidden = false;
    const d = this.g.save.data;
    const cleared = WORLDS.filter((w) => this.g.save.world(w.id).cleared).length;
    const best = Math.max(0, ...WORLDS.map((w) => (w.id - 1) * 30 + (this.g.save.world(w.id).best || 0)).filter((v, i) => this.g.save.world(i + 1).best));
    $("title-rec").textContent = `클리어한 월드 ${cleared} / 5 · 최고 ${best ? `${best}번째 웨이브` : "아직"}${d.endless.bestWave ? ` · 무한 생존 ${d.endless.bestWave} 웨이브` : ""}`;
    $("go-endless").textContent = this.g.save.campaignDone ? "무한 생존" : "무한 생존 🔒 (캠페인을 깨면)";
  }

  /* ---------------- 게임 중 ---------------- */
  enterPlay() {
    document.body.classList.remove("is-title");
    document.body.classList.add("is-play");
    $("title").hidden = true;
    $("hud").hidden = false;
    $("tbar").hidden = false;
    $("bossbar").hidden = true;
    $("banner").hidden = true;
    $("tip").hidden = true;
    this.last = {};
    this.buildTowerBar();
    this.panel(null);
    this.placeOk(null);
    this.hud(true);
    const s = this.g.sim;
    if (s.world.id === 1 && s.mode === "campaign" && !this.g.save.data.tutorial.done && s.local === 1 && !s.towers.length) this.coachStep = "pick";
    else this.coachStep = null;
  }
  buildTowerBar() {
    const box = $("tower-list");
    box.textContent = "";
    TOWER_ORDER.forEach((k, i) => {
      const T = TOWERS[k];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tw";
      b.dataset.type = k;
      b.setAttribute("aria-label", `${T.name} ${T.cost} 코인`);
      b.innerHTML = `<span class="key">${i + 1}</span><span class="ic">${T.icon}</span><small></small><b><i class="ico coin"></i><span></span></b>`;
      b.querySelector("small").textContent = T.short;
      towerPreview(k).then((url) => {
        if (!url) return;
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        img.className = "pic";
        b.querySelector(".ic").replaceWith(img);
      });
      b.addEventListener("click", () => {
        this.g.audio.unlock();
        this.g.chooseTower(k);
      });
      box.appendChild(b);
    });
    this.towerBar();
  }
  towerBar() {
    const s = this.g.sim;
    if (!s) return;
    for (const b of document.querySelectorAll("#tower-list .tw")) {
      const k = b.dataset.type;
      const cost = s.costOf(k);
      b.querySelector("b span").textContent = cost;
      b.classList.toggle("poor", s.coins < cost);
      b.classList.toggle("on", this.g.placing === k);
    }
  }
  hud(force) {
    const g = this.g;
    const s = g.sim;
    if (!s) return;
    const L = this.last;
    const set = (id, v) => {
      if (L[id] !== v || force) {
        L[id] = v;
        $(id).textContent = v;
        return true;
      }
      return false;
    };
    set("hud-world", s.mode === "campaign" ? `${s.world.name} · ${s.diff.name}` : `무한 생존 · ${s.world.name}`);
    set("hud-wave", s.mode === "campaign" ? `웨이브 ${s.local} / ${WAVES_PER_WORLD}` : `웨이브 ${s.local}`);
    set("hud-left", s.phase === "wave" ? `남은 적 ${s.remaining()}` : s.phase === "build" ? "정비 시간 · 타워를 세우고 강화해요" : "");
    const prevCoins = +L["hud-coins"] || 0;
    if (set("hud-coins", String(s.coins))) {
      if (s.coins > prevCoins && !force) {
        const chip = $("hud-coins").parentElement;
        chip.classList.remove("bump");
        void chip.offsetWidth;
        chip.classList.add("bump");
      }
      this.towerBar();
      if (g.sel != null) this.panel(g.sel, true);
    }
    set("hud-nest", String(s.nest.hp));
    const sh = s.nest.shield > 0 ? `🛡${s.nest.shield}` : "";
    if (set("hud-shield", sh)) $("hud-shield").hidden = !sh;
    if (set("speed-btn", `×${g.speed}`)) $("speed-btn").classList.toggle("on", g.speed > 1);
    // 다음 웨이브 버튼 · 미리 보기
    const nb = $("next-btn");
    const st = `${s.phase}|${s.local}`;
    if (L.nb !== st || force) {
      L.nb = st;
      nb.disabled = s.phase !== "build";
      nb.textContent = s.phase === "build" ? `▶ 웨이브 ${s.local} 시작` : s.phase === "wave" ? "전투 중…" : "…";
      this.peek();
    }
    // 보스 막대
    const boss = s.enemies.find((e) => e.boss && !e.dead);
    const bb = $("bossbar");
    if (boss) {
      bb.hidden = false;
      set("boss-name", `${boss.def.name}${boss.awakened ? " (각성)" : ""}`);
      $("boss-fill").style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
      $("boss-shield").style.width = `${Math.min(100, (boss.shield / boss.maxHp) * 100)}%`;
      const b = boss.b || {};
      const vul = boss.st.vuln > 1 ? " · 약점 노출! 지금 공격해요" : boss.flying ? " · 하늘 위 (궁수 · 얼음 · 번개만)" : "";
      set("boss-phase", `페이즈 ${b.phase || 1}${vul}`);
    } else bb.hidden = true;
    // 튜토리얼 '웨이브 시작' 단계
    if (this.coachStep === "start" && s.phase !== "build") this.coach("started");
  }
  peek() {
    const s = this.g.sim;
    const box = $("peek");
    box.textContent = "";
    if (s.phase !== "build") return;
    const w = s.makeWave(s.local);
    const by = new Map();
    for (const gr of w.groups) {
      const k = (gr.boss ? "B:" : gr.elite ? "!" : "") + gr.type;
      by.set(k, (by.get(k) || 0) + gr.count);
    }
    for (const [k, n] of by) {
      const boss = k.startsWith("B:");
      const type = k.replace(/^B:|^!/, "");
      const d = boss ? BOSSES[type] : ENEMIES[type];
      const el = document.createElement("span");
      el.className = boss ? "boss" : d.flying ? "air" : "";
      el.textContent = `${boss ? "👑" : k.startsWith("!") ? "★" : d.flying ? "🕊️" : ""}${d.name}${boss ? "" : ` ×${n}`}`;
      box.appendChild(el);
    }
  }
  nestHurt() {
    const c = $("hud-nest").parentElement;
    c.classList.remove("hurt");
    void c.offsetWidth;
    c.classList.add("hurt");
    this.flash("hurt");
  }
  flash(kind) {
    const f = $("flash");
    f.hidden = false;
    f.className = "flash" + (kind === "snow" ? " snow" : "");
    void f.offsetWidth;
    f.style.animation = "none";
    void f.offsetWidth;
    f.style.animation = "";
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => (f.hidden = true), 520);
  }
  toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => (el.hidden = true), 2400);
  }
  banner(k, h, sub, dur = 2.2, skippable = false) {
    const el = $("banner");
    if (!k) {
      el.hidden = true;
      return;
    }
    $("banner-k").textContent = k;
    $("banner-h").textContent = h;
    $("banner-s").textContent = sub || "";
    el.classList.toggle("info", !skippable);
    el.hidden = false;
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => (el.hidden = true), dur * 1000);
  }
  tip(text, coach) {
    const el = $("tip");
    $("tip-t").textContent = text;
    el.classList.toggle("coach", !!coach);
    el.hidden = false;
    clearTimeout(this.tipT);
    if (!coach) this.tipT = setTimeout(() => (el.hidden = true), 7000);
  }
  placeOk(pos) {
    const el = $("place-ok");
    if (!pos) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const f = this.g.fieldEl.getBoundingClientRect();
    const x = Math.max(80, Math.min(f.width - 80, pos.x));
    const y = Math.max(120, pos.y - 10);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  /* ---------------- 타워 정보 ---------------- */
  panel(id, soft) {
    const el = $("tpanel");
    const s = this.g.sim;
    const t = id != null && s ? s.tower(id) : null;
    if (!t) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const T = TOWERS[t.type];
    const st = statsOf(s, t);
    const b = baseStats(t.type, t.level, t.evo, t.elevel);
    const tier = tierOf(t);
    $("tp-kind").textContent = T.name + (t.evo ? " · 진화" : "");
    if (this.picType !== t.type) {
      this.picType = t.type;
      towerPreview(t.type).then((url) => url && this.picType === t.type && ($("tp-pic").src = url));
    }
    $("tp-name").textContent = b.name;
    $("tp-tier").textContent = "★".repeat(tier + 1) + "☆".repeat(4 - tier);
    // 수치 (실제 전투 값) + 다음 단계 미리 보기
    const n = nextSteps(s, t);
    const up = n.up ? n.up.stats : null;
    const rows = [];
    const row = (k, v, nv, unit = "") => rows.push(`<p><small>${k}</small><span>${v}${unit}${nv != null && nv !== v ? ` <em class="${+nv > +v ? "up" : "down"}">→ ${nv}${unit}</em>` : ""}</span></p>`);
    if (T.support) {
      row("응원 범위", fmt(b.range * s.mods.range), up && fmt(up.range * s.mods.range), "칸");
      row("공격속도 응원", `+${Math.round(b.buff * 100)}`, up && `+${Math.round(up.buff * 100)}`, "%");
      if (b.rangeBuff) row("사거리 응원", `+${Math.round(b.rangeBuff * 100)}`, up && `+${Math.round(up.rangeBuff * 100)}`, "%");
      if (b.cleanse) row("나쁜 효과 풀기", `${b.cleanse}초마다`);
      if (b.shieldEvery) row("둥지 방어막", `${b.shieldEvery}초마다 +1 (최대 ${b.shieldMax})`);
    } else {
      const k = (x) => (st[x] || 0) / (b[x] || 1);
      row("공격력", fmt(st.dmg), up && fmt(up.dmg * k("dmg")));
      row("공격속도", `${fmt(st.rate)}`, up && fmt(up.rate * k("rate")), "회/초");
      row("사거리", fmt(st.range), up && fmt(up.range * k("range")), "칸");
      if (st.splash) row("폭발 범위", fmt(st.splash), up && up.splash && fmt(up.splash * s.mods.splash), "칸");
      if (st.slow) row("감속", `${Math.round(st.slow * 100)}`, up && up.slow && `${Math.round(up.slow * 100)}`, "%");
      if (st.freeze) row("빙결 확률", `${Math.round(st.freeze * 100)}`, null, "%");
      if (st.chain) row("연쇄", `${st.chain}`, up && up.chain && `${up.chain + s.mods.chain}`, "마리");
      if (st.pierce) row("관통", `${st.pierce}`, up && up.pierce, "마리");
      if (st.burn) row("화상", `${fmt(st.burn)}`, null, "/초");
      if (st.stun) row("기절", `${st.stun}`, null, "초");
      if (st.shots) row("포탄", `${st.shots}`, null, "발");
      if (st.ap) row("갑옷 관통", `${Math.round(st.ap * 100)}`, null, "%");
      row("하늘 공격", st.air ? "가능" : "못 함");
      row("처치", `${t.kills}`);
    }
    const deb = [];
    if (t.stunT > 0) deb.push("기절!");
    if (t.deb.vine) deb.push("덩굴");
    if (t.deb.frost) deb.push("서리");
    if (t.deb.curse || t.zoneDmg < 1) deb.push("저주");
    if (t.deb.heat || t.zoneRate < 1) deb.push("과열 · 독");
    if (t.buffRate > 0) deb.push(`응원 +${Math.round(t.buffRate * 100)}%`);
    if (deb.length) rows.push(`<p style="grid-column:1/-1"><small>지금</small><span>${deb.join(" · ")}</span></p>`);
    $("tp-stats").innerHTML = rows.join("");
    $("tp-desc").textContent = t.evo ? T.evos[t.evo].desc : T.desc;
    // 표적
    const tg = $("tp-target");
    if (!soft) {
      tg.textContent = "";
      if (!T.support)
        for (const m of TARGET_MODES) {
          const bt = document.createElement("button");
          bt.type = "button";
          bt.textContent = m.name;
          bt.className = t.target === m.id ? "on" : "";
          bt.addEventListener("click", () => {
            s.setTarget(t.id, m.id);
            this.panel(t.id);
          });
          tg.appendChild(bt);
        }
    }
    // 강화 · 진화 · 판매
    const box = $("tp-actions");
    box.textContent = "";
    const act = (cls, label, sub, cost, fn) => {
      const bt = document.createElement("button");
      bt.type = "button";
      bt.className = "act " + cls;
      bt.innerHTML = `<span>${label}<small></small></span><b></b>`;
      bt.querySelector("small").textContent = sub || "";
      bt.querySelector("b").textContent = cost;
      if (typeof cost === "number" && s.coins < cost) bt.disabled = true;
      bt.addEventListener("click", () => {
        this.g.audio.unlock();
        fn();
      });
      box.appendChild(bt);
    };
    if (n.up) act("", `강화 → ★${tier + 2}`, "", n.up.cost, () => this.g.upgrade());
    for (const e of n.evos) act("evo", `진화: ${e.name}`, e.desc, e.cost, () => this.g.evolve(e.key));
    if (!n.up && !n.evos.length) rows.length && box.insertAdjacentHTML("beforeend", `<p class="note">최고 단계예요!</p>`);
    act("sell", "팔기", "쓴 코인의 일부를 돌려받아요", `+${s.sellValue(t)}`, () => this.g.sell());
    this.coach("selected");
  }

  /* ---------------- 카드 · 새 적 · 정비 ---------------- */
  showCards(ev) {
    const s = this.g.sim;
    $("cards-k").textContent = `웨이브 ${ev.n} 클리어! 보너스 코인 +${ev.bonus}`;
    const row = $("card-row");
    row.textContent = "";
    s.offer.forEach((id, i) => {
      const c = cardById(id);
      const b = document.createElement("button");
      b.type = "button";
      const cat = CARD_CAT[c.id] || "tac";
      b.className = `tcard cat-${cat}`;
      const have = s.cards[id] || 0;
      b.innerHTML = `<span class="tc-ribbon"></span><span class="tc-ic" aria-hidden="true">${c.icon}</span><b class="tc-name"></b><span class="tc-eff"></span><em class="tc-count"></em>`;
      b.querySelector(".tc-ribbon").textContent = CAT_NAME[cat];
      b.querySelector(".tc-name").textContent = c.name;
      // 효과 숫자(+8%, 2배, -8% …)는 굵게 강조
      const eff = b.querySelector(".tc-eff");
      for (const piece of c.desc.split(/([+-]?\d+(?:\.\d+)?%?(?:배)?)/)) {
        if (!piece) continue;
        if (/\d/.test(piece)) {
          const st = document.createElement("strong");
          st.textContent = piece;
          eff.appendChild(st);
        } else eff.appendChild(document.createTextNode(piece));
      }
      b.querySelector(".tc-count").textContent = c.instant ? "바로 효과" : `${have} / ${c.max} 장`;
      b.addEventListener("click", () => {
        this.g.audio.unlock();
        this.closeAll();
        this.g.pickCard(i);
      });
      row.appendChild(b);
    });
    this.show("cards");
  }
  /** 정비 시간이 시작될 때: 새 적 안내 · 웨이브 한마디 · 튜토리얼 */
  beforeWave() {
    const g = this.g;
    const s = g.sim;
    if (!s || s.phase !== "build") return;
    this.hud(true);
    const w = s.makeWave(s.local);
    if (s.mode === "campaign") {
      const fresh = newEnemiesAt(s.world.id, s.local).filter((t) => (ENEMIES[t] && ENEMIES[t].world > 0) || BOSSES[t]);
      const unseen = fresh.filter((t) => !g.save.data.seen.includes(t));
      if (unseen.length) {
        for (const t of unseen) g.save.markSeen(t);
        this.newFoes(unseen);
        this.pendingNote = w.note;
        return;
      }
    }
    if (w.note) this.tip(w.note);
    this.afterModal();
  }
  afterModal() {
    if (this.pendingNote) {
      this.tip(this.pendingNote);
      this.pendingNote = null;
    }
    if (this.coachStep) this.coach(null);
  }
  newFoes(list) {
    const box = $("nf-list");
    box.textContent = "";
    for (const t of list) box.appendChild(this.foeCard(t, true));
    this.show("newfoe");
  }
  foeCard(type, known) {
    const d = ENEMIES[type] || BOSSES[type];
    const el = document.createElement("div");
    el.className = "foe" + (known ? "" : " unknown");
    const img = document.createElement("img");
    img.alt = "";
    img.width = 72;
    img.height = 72;
    if (known) preview(type).then((url) => url && (img.src = url));
    const body = document.createElement("div");
    const tags = [];
    if (BOSSES[type]) tags.push("보스");
    if (d.flying || d.hover) tags.push(d.hover ? "공중 · 모두 공격 가능" : "하늘");
    if ((d.armor || 0) >= 0.3) tags.push("단단함");
    body.innerHTML = `<b></b>${tags.map((x) => `<span class="tag">${x}</span>`).join("")}<p></p>${d.tip ? '<p class="tip2"></p>' : ""}`;
    body.querySelector("b").textContent = known ? d.name : "???";
    body.querySelector("p").textContent = known ? d.desc : "아직 만나지 않았어요";
    if (d.tip) body.querySelector(".tip2").textContent = known ? "💡 " + d.tip : "";
    if (known) el.append(img, body);
    else {
      const no = document.createElement("span");
      no.className = "noimg";
      no.textContent = "?";
      el.append(no, body);
    }
    return el;
  }

  /* ---------------- 튜토리얼 (햇살 초원 처음 한 번) ---------------- */
  coach(ev) {
    const g = this.g;
    if (!this.coachStep) return;
    const step = this.coachStep;
    const say = (t) => this.tip(t, true);
    if (step === "pick") {
      if (ev === "pick" && g.placing) {
        this.coachStep = "place";
        say("길 옆 초록 칸을 눌러 궁수를 세워요. (휴대폰은 한 번 더 '여기에 세우기')");
      } else say("👇 아래에서 🏹 병아리 궁수를 골라요");
    } else if (step === "place") {
      if (ev === "placed") {
        this.coachStep = g.sim.coins >= g.sim.costOf("archer") ? "more" : "start";
        say(this.coachStep === "more" ? "좋아요! 궁수를 하나 더 세우면 더 든든해요. 그다음 ▶ 웨이브 시작!" : "좋아요! 이제 ▶ 웨이브 시작을 눌러요");
      }
    } else if (step === "more") {
      if (ev === "placed" || ev === "started") {
        this.coachStep = ev === "started" ? "upgrade" : "start";
        if (ev === "placed") say("이제 ▶ 웨이브 시작을 눌러요");
      }
    } else if (step === "start") {
      if (ev === "started") {
        this.coachStep = "upgrade";
        say("몬스터가 와요! 타워가 알아서 공격해요. 웨이브가 끝나면 카드를 골라요");
      }
    } else if (step === "upgrade") {
      if (ev === "selected") say("코인이 있으면 '강화'를 눌러 더 세게! 3단계가 되면 진화할 수 있어요");
      else if (ev === "upgraded" || (g.sim && g.sim.local >= 4)) {
        this.coachStep = null;
        g.save.data.tutorial.done = true;
        g.save.write();
        say("멋져요! 이제 혼자서도 둥지를 지킬 수 있어요 🐣");
      } else if (ev == null && g.sim.phase === "build" && g.sim.local >= 2) say("타워를 눌러 보세요. 강화 · 진화 · 판매를 할 수 있어요");
    }
  }

  /* ---------------- 결과 ---------------- */
  result(kind, info = {}) {
    const g = this.g;
    const s = g.sim;
    this.resKind = kind;
    const card = $("result").querySelector(".card");
    const final = kind === "win" && s.mode === "campaign" && s.world.id === 5;
    card.classList.toggle("ending", final);
    $("r-k").textContent = s.mode === "campaign" ? `${s.world.name} · ${s.diff.name}` : `무한 생존 · ${s.world.name}`;
    const stars = kind === "win" ? (s.nest.hp >= 18 ? 3 : s.nest.hp >= 10 ? 2 : 1) : 0;
    if (kind === "win") $("r-h").textContent = final ? "황금 둥지를 지켰어요! 캠페인 클리어!" : "월드 클리어!";
    else $("r-h").textContent = s.mode === "endless" ? `무한 생존 · 웨이브 ${s.local - 1} 버팀` : "둥지가 무너졌어요…";
    $("r-stars").textContent = kind === "win" ? "★".repeat(stars) + "☆".repeat(3 - stars) : "";
    const add = (k, v) => `<p><small>${k}</small><b>${v}</b></p>`;
    $("r-stats").innerHTML = [
      add("점수", s.score.toLocaleString("ko-KR")),
      add(s.mode === "endless" ? "버틴 웨이브" : "웨이브", s.mode === "endless" ? s.local - 1 : `${kind === "win" ? 30 : s.local} / 30`),
      add("둥지 체력", `${s.nest.hp} / ${s.nest.maxHp}`),
      add("처치", s.stats.kills),
      add("세운 타워", s.stats.towersBuilt),
      add("고른 카드", Object.values(s.cards).reduce((a, b) => a + b, 0)),
    ].join("");
    let note = "";
    if (final) note = "그림자 까마귀 마왕을 물리쳤어요! 병아리 왕국에 평화가 찾아왔어요. 이제 '무한 생존'이 열렸어요!";
    else if (kind === "win" && s.world.id < 5) {
      const nm = worldById(s.world.id + 1).name;
      const last = nm.charCodeAt(nm.length - 1) - 0xac00;
      note = info.first ? `다음 월드 '${nm}'${last >= 0 && last % 28 ? "이" : "가"} 열렸어요!` : "";
    }
    else if (kind === "lose" && s.mode === "campaign") note = g.save.data.campaign.run ? "'이 웨이브 다시'를 누르면 이번 웨이브 정비 시간부터 다시 해요." : "";
    else if (info.rec) note = info.rec.newWave ? "🎉 무한 생존 최고 기록!" : `최고 기록: ${g.save.data.endless.bestWave} 웨이브`;
    $("r-note").textContent = note;
    const next = $("r-next");
    const retry = $("r-retry");
    retry.textContent = "처음부터 다시";
    if (kind === "win") {
      next.hidden = false;
      next.textContent = final ? "무한 생존 하러 가기" : s.world.id < 5 ? "다음 월드" : "메뉴로";
    } else if (s.mode === "campaign" && g.save.data.campaign.run && g.save.data.campaign.run.world === s.world.id) {
      next.hidden = false;
      next.textContent = "이 웨이브 다시";
    } else next.hidden = true;
    // 무한 생존: 점수 순위 (직접 이름을 적어 올릴 때만)
    $("r-rank").innerHTML = "";
    if (s.mode === "endless" && window.TodayGameRank) {
      try {
        TodayGameRank.mount({ gameId: "chick-defense-new", gameTitle: "NEW 둥지디펜스 · 무한 생존", formParent: $("r-rank") });
        TodayGameRank.open(s.score, { label: `${s.score.toLocaleString("ko-KR")}점 (웨이브 ${s.local - 1})` });
      } catch (e) {
        console.warn("랭킹 연결 실패", e);
      }
    }
    this.closeAll();
    this.show("result");
  }
  resultNext() {
    const g = this.g;
    const s = g.sim;
    if (this.resKind === "win") {
      if (s.world.id < 5) {
        this.closeAll();
        g.startRun({ world: s.world.id + 1, mode: "campaign", difficulty: s.diffKey });
      } else {
        g.toTitle();
        this.show("endless");
      }
      return;
    }
    const run = g.save.data.campaign.run;
    if (run) {
      this.closeAll();
      g.startRun({ world: run.world, mode: "campaign", difficulty: run.difficulty, snapshot: run });
    }
  }

  /* ---------------- 월드 · 무한 생존 ---------------- */
  renderWorlds() {
    const g = this.g;
    const d = g.save.data;
    const diff = $("diff");
    diff.textContent = "";
    for (const [k, v] of Object.entries(DIFFICULTY)) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = v.name;
      b.className = (d.settings.difficulty || "normal") === k ? "on" : "";
      b.setAttribute("aria-pressed", b.className === "on");
      b.addEventListener("click", () => {
        g.save.setting("difficulty", k);
        this.renderWorlds();
      });
      diff.appendChild(b);
    }
    const grid = $("world-grid");
    grid.textContent = "";
    for (const w of WORLDS) {
      const open = w.id <= d.campaign.unlocked;
      const rec = g.save.world(w.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `wcard w${w.id}` + (open ? "" : " locked");
      b.disabled = !open;
      b.innerHTML = `<span class="wk"></span><b></b><small></small><span class="prog"></span>`;
      b.querySelector(".wk").textContent = `WORLD ${w.id} · 웨이브 ${w.waves[0]}~${w.waves[1]}`;
      b.querySelector("b").textContent = w.name;
      b.querySelector("small").textContent = w.desc;
      b.querySelector(".prog").textContent = rec.cleared ? `✔ 클리어 · 최고 ${rec.score.toLocaleString("ko-KR")}점` : rec.best ? `최고 ${rec.best} / 30 웨이브` : open ? "도전!" : "앞 월드를 깨면 열려요";
      b.addEventListener("click", () => {
        g.audio.unlock();
        const run = d.campaign.run;
        const go = () => {
          g.save.saveRun(null);
          this.closeAll();
          g.startRun({ world: w.id, mode: "campaign", difficulty: d.settings.difficulty || "normal" });
        };
        if (run && run.world === w.id) this.confirm("처음부터 할까요?", `저장된 판 (웨이브 ${run.local})이 있어요. '이어서 하기'로 계속할 수도 있어요.`, go);
        else go();
      });
      grid.appendChild(b);
    }
    const run = d.campaign.run;
    $("run-box").hidden = !run;
    if (run) $("run-t").textContent = `저장된 판: ${worldById(run.world).name} · 웨이브 ${run.local} · 둥지 ${run.nest.hp} · ${DIFFICULTY[run.difficulty] ? DIFFICULTY[run.difficulty].name : "보통"}`;
  }
  renderEndless() {
    const g = this.g;
    const e = g.save.data.endless;
    $("endless-sub").textContent = `끝없이 몰려오는 몬스터를 얼마나 버틸까요? 5웨이브마다 엘리트, 10웨이브마다 보스! 최고 ${e.bestWave} 웨이브 · ${e.bestScore.toLocaleString("ko-KR")}점`;
    const grid = $("endless-grid");
    grid.textContent = "";
    for (const w of WORLDS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `wcard w${w.id}`;
      b.innerHTML = `<span class="wk">MAP</span><b></b>`;
      b.querySelector("b").textContent = w.name;
      b.addEventListener("click", () => {
        this.closeAll();
        g.startRun({ world: w.id, mode: "endless", difficulty: "normal" });
      });
      grid.appendChild(b);
    }
  }

  /* ---------------- 설정 · 도움말 ---------------- */
  renderSettings() {
    const g = this.g;
    const st = g.save.data.settings;
    $("set-music").value = Math.round((st.musicVol ?? 0.6) * 100);
    $("set-sfx").value = Math.round((st.sfxVol ?? 0.85) * 100);
    $("set-shake").checked = st.shake !== false;
    $("set-nums").checked = st.dmgNums !== false;
    const seg = $("set-quality");
    seg.textContent = "";
    for (const [k, n] of [["auto", "자동"], ["high", "높음"], ["medium", "보통"], ["low", "낮음"]]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = n;
      b.className = (st.quality || "auto") === k ? "on" : "";
      b.addEventListener("click", () => {
        g.setQuality(k);
        this.renderSettings();
      });
      seg.appendChild(b);
    }
    $("save-note").textContent = g.save.ok ? `기록 · 설정은 이 기기의 브라우저에만 저장돼요. 지금 그래픽: ${{ high: "높음", medium: "보통", low: "낮음" }[g.quality]} (${g.fps.ema.toFixed(0)} FPS)` : "이 브라우저는 저장을 할 수 없어요 · 이번 방문 동안만 기억해요.";
  }
  helpTab(tab) {
    this.helpOn = tab;
    for (const b of document.querySelectorAll("#help-tabs button")) b.classList.toggle("on", b.dataset.tab === tab);
    for (const t of ["how", "towers", "foes"]) $(`tab-${t}`).hidden = t !== tab;
    if (tab === "towers") this.renderTowersHelp();
    if (tab === "foes") this.renderFoes();
  }
  renderTowersHelp() {
    const box = $("tab-towers");
    if (box.dataset.done) return;
    box.dataset.done = "1";
    const grid = document.createElement("div");
    grid.className = "foe-grid cols";
    for (const k of TOWER_ORDER) {
      const T = TOWERS[k];
      const el = document.createElement("div");
      el.className = "foe";
      const img = document.createElement("img");
      img.alt = "";
      towerPreview(k).then((u) => u && (img.src = u));
      const b = document.createElement("div");
      const L = T.levels[0];
      const evo = Object.values(T.evos).map((e) => `${e.name}: ${e.desc}`).join(" / ");
      b.innerHTML = `<b></b><span class="tag"></span><p></p><p class="tip2"></p>`;
      b.querySelector("b").textContent = `${T.icon} ${T.name}`;
      b.querySelector(".tag").textContent = `${T.cost} 코인`;
      b.querySelector("p").textContent = `${T.desc}${T.support ? "" : ` (공격력 ${L.dmg} · ${L.rate}회/초 · 사거리 ${L.range})`}`;
      b.querySelector(".tip2").textContent = "진화 → " + evo;
      el.append(img, b);
      grid.appendChild(el);
    }
    box.appendChild(grid);
  }
  renderFoes() {
    const box = $("tab-foes");
    box.textContent = "";
    const seen = new Set(this.g.save.data.seen);
    const commons = ["slime", "fox", "beetle"];
    const sec = (title, list) => {
      const h = document.createElement("p");
      h.className = "wtitle";
      h.textContent = title;
      box.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "foe-grid cols";
      for (const t of list) grid.appendChild(this.foeCard(t, seen.has(t) || commons.includes(t)));
      box.appendChild(grid);
    };
    sec("공통 몬스터", commons);
    for (const w of WORLDS) sec(`${w.name} · 몬스터 ${specialsOf(w.id).length} · 보스 ${bossesOf(w.id).length}`, [...specialsOf(w.id), ...bossesOf(w.id)]);
  }
}

/* ---------------- 3D 모델 미리 보기 그림 (한 번 그려 두고 다시 씀) ---------------- */
let pv = null;
const pvCache = new Map();
function pvRenderer() {
  if (pv) return pv;
  try {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(144, 144);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7290, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    pv = { r, scene, cam };
  } catch (_) {
    pv = false;
  }
  return pv;
}
function snap(key, build, h = 1) {
  if (pvCache.has(key)) return Promise.resolve(pvCache.get(key));
  const P = pvRenderer();
  if (!P) return Promise.resolve(null);
  const root = group(P.scene);
  const anim = build(root);
  root.rotation.y = 0.6;
  if (anim)
    try {
      anim({ t: 0.3, dt: 0, e: { flying: true, ab: {}, shield: 0, st: {}, b: { phase: 1 } }, state: "move", k: 0.5, m: {} });
    } catch (_) {}
  P.cam.position.set(0, h * 0.9, h * 3.1);
  P.cam.lookAt(0, h * 0.45, 0);
  P.r.render(P.scene, P.cam);
  const url = P.r.domElement.toDataURL("image/png");
  P.scene.remove(root);
  pvCache.set(key, url);
  return Promise.resolve(url);
}
export function preview(type) {
  const boss = !!BOSSES[type];
  return snap("e:" + type, (root) => (MODELS[type] || MODELS.slime)(root), boss ? 1.6 : 1);
}
function towerPreview(type) {
  return snap("t:" + type, (root) => {
    buildTower(root, type, 2, null);
    return null;
  }, 1.1);
}
