/*
 * 물총 대작전 엔진 · UISystem
 * 시작 화면 · 항해 지도 · 도감 · 설정 · 결과 · 일시정지 · HUD (DOM + SVG 아이콘)
 * 글자 · 이름은 content(texts · 데이터)에서 가져오므로 테마가 바뀌어도 그대로 쓴다.
 */
import { ICONS, paintIcons } from "./icons.js?v=3";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
const two = (n) => String(n).padStart(2, "0");

export class BlasterUI {
  constructor(game, content) {
    this.g = game;
    this.c = content;
    this.t = content.texts || {};
    this.screens = ["title", "map", "book", "settings", "result", "pause"];
    this.current = "title";
    this.hudPrev = {};
    this.toastQ = [];
    this.toastBusy = false;
    this.bookTab = "friends";
    this.lastResult = null;
    this.scoreShown = 0;
    this.scoreTarget = 0;
    this.faceMood = "happy";
    paintIcons();
    this.bind();
    this.refreshMenu();
    this.paintSound();
    this.show("title");
  }

  click() {
    this.g.audio.unlock();
    this.g.audio.play("click");
  }

  bind() {
    const on = (id, fn) => {
      const el = $(id);
      if (el)
        el.addEventListener("click", (e) => {
          e.preventDefault();
          this.click();
          fn(e);
        });
    };
    on("start-btn", () => this.g.startStage(this.nextStageIndex()));
    on("menu-map", () => this.openMap());
    on("menu-book", () => this.openBook());
    on("menu-settings", () => this.openSettings());
    document.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        this.click();
        this.backToMenu();
      })
    );
    on("pause-btn", () => this.g.pause());
    on("pause-resume", () => this.g.resume());
    on("pause-retry", () => {
      this.showPause(false);
      this.retry();
    });
    on("pause-map", () => {
      this.showPause(false);
      this.g.toMenu();
      this.openMap();
    });
    on("res-retry", () => this.retry());
    on("res-next", () => {
      const r = this.lastResult;
      if (!r) return;
      if (r.kind === "stage" && r.cleared && r.index + 1 < this.c.stages.length) this.g.startStage(r.index + 1);
      else if (r.kind === "bonus") this.g.startStage(this.nextStageIndex());
      else this.retry();
    });
    on("res-map", () => {
      this.g.toMenu();
      this.openMap();
    });
    on("book-close", () => $("book-detail").setAttribute("hidden", ""));
    const toggleSound = () => {
      this.g.audio.unlock();
      if (window.TodayAudio) TodayAudio.toggle();
      this.paintSound();
    };
    on("sound-btn", toggleSound);
    on("menu-sound", toggleSound);
    document.querySelectorAll("[data-book-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        this.click();
        this.bookTab = b.dataset.bookTab;
        this.renderBook();
      })
    );
    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" || e.code === "KeyP") {
        if (this.g.state === "play") this.g.pause();
        else if (this.g.state === "paused") this.g.resume();
      }
      if (e.code === "KeyM") setTimeout(() => this.paintSound(), 0);
    });
    if (window.TodayFace && TodayFace.onChange) TodayFace.onChange(() => this.paintAvatar(true));
  }

  paintSound() {
    const muted = Boolean(window.TodayAudio && TodayAudio.isMuted());
    for (const id of ["sound-btn", "menu-sound"]) {
      const b = $(id);
      if (!b) continue;
      b.classList.toggle("is-muted", muted);
      b.setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
      b.innerHTML = `<span class="ic">${muted ? ICONS.mute : ICONS.sound}</span>`;
    }
  }

  retry() {
    const r = this.lastResult || (this.g.run && { kind: this.g.run.kind, index: this.g.run.index, data: this.g.run.data });
    if (!r) return;
    if (r.kind === "bonus") this.g.startBonus(r.data.id);
    else this.g.startStage(r.index);
  }

  nextStageIndex() {
    const s = this.g.save.data;
    return Math.max(0, Math.min(this.c.stages.length - 1, s.unlocked - 1));
  }

  show(name) {
    this.current = name;
    for (const s of this.screens) {
      const el = $(s);
      if (!el) continue;
      if (s === name) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
      el.classList.toggle("hidden", s !== name);
    }
    document.body.classList.toggle("is-title", name === "title");
    document.body.classList.toggle("is-menu", name !== null && name !== "result" && name !== "pause");
  }

  backToMenu() {
    if (this.g.state !== "menu") this.g.toMenu();
    this.refreshMenu();
    this.show("title");
  }

  stageLabel(i) {
    const st = this.c.stages[i];
    return `STAGE ${two(i + 1)} · ${st.name}`;
  }

  /* ---------------- 시작 화면 ---------------- */
  refreshMenu() {
    const i = this.nextStageIndex();
    const lab = $("start-label");
    if (lab) lab.textContent = this.stageLabel(i);
    const nb = $("menu-book-new");
    if (nb) {
      const n = this.g.save.freshCount;
      nb.textContent = n > 0 ? `NEW ${n}` : "";
      nb.hidden = n <= 0;
    }
    const prog = $("menu-progress");
    if (prog) {
      const found = this.bookIds().filter((id) => this.g.save.isSeen(id)).length;
      const clears = this.c.stages.filter((s) => (this.g.save.stage(s.id) || {}).clears > 0).length;
      prog.innerHTML = `<span class="ic">${ICONS.wheel}</span>항해 ${clears}/${this.c.stages.length}<span class="dot"></span><span class="ic">${ICONS.book}</span>도감 ${found}/${this.bookIds().length}`;
    }
  }

  /* ---------------- 항해 지도 ---------------- */
  openMap() {
    this.renderMap();
    this.show("map");
  }

  renderMap() {
    const save = this.g.save;
    const host = $("map-grid");
    if (!host) return;
    host.innerHTML = this.c.stages
      .map((s, i) => {
        const open = i < save.data.unlocked;
        const rec = save.stage(s.id);
        const grade = rec && rec.grade;
        const boss = s.boss ? this.c.bosses[s.boss] : null;
        const cur = i === save.data.unlocked - 1;
        return `<button type="button" class="route-node${open ? "" : " locked"}${cur ? " current" : ""}${boss ? " boss" : ""} ${i % 2 ? "right" : "left"}" data-stage="${i}" ${open ? "" : "disabled"} style="--tint:${esc(s.tint || "#4fc3f7")}">
          <span class="rn-pic"><canvas width="132" height="132" data-scene="${esc(s.scene)}"></canvas>${open ? "" : `<span class="rn-lock">${ICONS.lock}</span>`}<span class="rn-num">${two(i + 1)}</span>${boss ? `<span class="rn-crown">${ICONS.crown}</span>` : ""}</span>
          <span class="rn-text">
            <small>${esc(s.en || "")}</small>
            <b>${esc(s.name)}</b>
            ${boss ? `<em>BOSS · ${esc(boss.name)}</em>` : ""}
            <span class="rn-meta">${rec && rec.best ? `<span class="ic">${ICONS.pearl}</span>${fmt(rec.best)}` : open ? (cur ? "지금 도전!" : "도전!") : "잠김"}</span>
          </span>
          ${grade ? `<span class="grade-medal g-${grade}">${grade}</span>` : ""}
        </button>`;
      })
      .join("");
    if (this.c.scenes && this.c.scenes.preview) {
      host.querySelectorAll("canvas[data-scene]").forEach((cv) => {
        const pic = this.c.scenes.preview(cv.dataset.scene, cv.width, cv.height);
        cv.getContext("2d").drawImage(pic, 0, 0);
      });
    }
    host.querySelectorAll("[data-stage]").forEach((b) =>
      b.addEventListener("click", () => {
        this.click();
        this.g.startStage(Number(b.dataset.stage));
      })
    );
    const bh = $("map-bonus");
    if (bh) {
      bh.innerHTML = (this.c.bonus || [])
        .map((bn) => {
          const open = this.g.isBonusOpen(bn);
          const rec = save.data.bonus[bn.id];
          return `<button type="button" class="bonus-card${open ? "" : " locked"}" data-bonus="${esc(bn.id)}" ${open ? "" : "disabled"}>
            <span class="bc-ic">${open ? ICONS[bn.icon || "chest"] || ICONS.chest : ICONS.lock}</span>
            <span class="bc-name">${esc(bn.name)}</span>
            <span class="bc-meta">${open ? (rec && rec.best ? `최고 ${fmt(rec.best)}` : esc(bn.desc)) : `STAGE ${two(bn.unlockAfter)} 클리어하면 열려요`}</span>
          </button>`;
        })
        .join("");
      bh.querySelectorAll("[data-bonus]").forEach((b) =>
        b.addEventListener("click", () => {
          this.click();
          this.g.startBonus(b.dataset.bonus);
        })
      );
    }
    const sum = $("map-summary");
    if (sum) {
      const best = this.c.stages.reduce((s, st) => s + ((save.stage(st.id) || {}).best || 0), 0);
      sum.innerHTML = `<span class="ic">${ICONS.pearl}</span>총 점수 ${fmt(best)} · 최고 콤보 ${save.data.bestCombo} · 적신 친구 ${fmt(save.data.totalSoaked)}`;
    }
    requestAnimationFrame(() => {
      const cur = host.querySelector(".route-node.current");
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "center" });
    });
  }

  /* ---------------- 도감 ---------------- */
  bookIds() {
    return this.c.book.filter((b) => b.group !== "item").map((b) => b.id);
  }

  openBook() {
    this.renderBook();
    this.show("book");
  }

  renderBook() {
    const save = this.g.save;
    document.querySelectorAll("[data-book-tab]").forEach((b) => b.classList.toggle("on", b.dataset.bookTab === this.bookTab));
    const host = $("book-grid");
    const head = $("book-count");
    if (!host) return;
    const countBar = (label, n, total) => `<span class="bc-label">${label}</span><b>${n}</b><span class="bc-total">/ ${total} 발견</span><span class="bc-bar"><i style="width:${total ? Math.round((n / total) * 100) : 0}%"></i></span>`;
    if (this.bookTab === "boats") {
      const boats = this.c.boats || [];
      if (head) head.innerHTML = countBar("보트", boats.filter((b) => save.data.boats[b.id]).length, boats.length);
      host.innerHTML = boats
        .map((b) => {
          const have = save.data.boats[b.id];
          const on = save.data.boat === b.id;
          return `<button type="button" class="book-card boat-card${have ? "" : " unknown"}${on ? " equipped" : ""}" data-boat="${esc(b.id)}">
            <canvas width="240" height="180" data-boat-art="${esc(b.id)}"></canvas>
            <span class="bk-name">${have ? esc(b.name) : "???"}</span>
            <span class="bk-sub">${on ? "타는 중" : have ? "눌러서 타기" : esc(b.hint)}</span>
            ${have ? "" : `<span class="bk-lock">${ICONS.lock}</span>`}
          </button>`;
        })
        .join("");
      host.querySelectorAll("[data-boat-art]").forEach((cv) => this.c.art.boatPortrait(cv, cv.dataset.boatArt, Boolean(save.data.boats[cv.dataset.boatArt])));
      host.querySelectorAll("[data-boat]").forEach((b) =>
        b.addEventListener("click", () => {
          this.click();
          if (!save.data.boats[b.dataset.boat]) return;
          save.setBoat(b.dataset.boat);
          this.renderBook();
        })
      );
      return;
    }
    const list = this.c.book.filter((b) => (this.bookTab === "items" ? b.group === "item" : b.group !== "item"));
    const found = list.filter((b) => save.isSeen(b.id)).length;
    if (head) head.innerHTML = countBar(this.bookTab === "items" ? "아이템" : this.t.friends || "친구들", found, list.length);
    host.innerHTML = list
      .map((b) => {
        const seen = save.isSeen(b.id);
        const fresh = save.data.fresh[b.id];
        return `<button type="button" class="book-card${seen ? "" : " unknown"} kind-${esc(b.group)}" data-book="${esc(b.id)}">
          ${fresh ? `<span class="new-badge">NEW!</span>` : ""}
          <canvas width="180" height="180" data-art="${esc(b.id)}"></canvas>
          <span class="bk-name">${seen ? esc(b.name) : b.group === "hidden" ? "숨은 친구" : "???"}</span>
          <span class="bk-sub">${esc(b.groupLabel || "")}</span>
        </button>`;
      })
      .join("");
    host.querySelectorAll("[data-art]").forEach((cv) => this.c.art.portrait(cv, cv.dataset.art, save.isSeen(cv.dataset.art)));
    host.querySelectorAll("[data-book]").forEach((b) =>
      b.addEventListener("click", () => {
        this.click();
        this.openDetail(b.dataset.book);
      })
    );
  }

  openDetail(id) {
    const save = this.g.save;
    const b = this.c.book.find((x) => x.id === id);
    if (!b) return;
    const seen = save.isSeen(id);
    const box = $("book-detail");
    const body = $("book-detail-body");
    const stars = Array.from({ length: 5 }, (_, i) => `<span class="ic ${i < (b.difficulty || 1) ? "on" : "off"}">${ICONS.star}</span>`).join("");
    body.innerHTML = seen
      ? `<div class="bd-pic kind-${esc(b.group)}"><canvas width="320" height="320" id="detail-art"></canvas></div>
        <p class="bd-group">${esc(b.groupLabel)}</p>
        <h3>${esc(b.name)}</h3>
        <p class="bd-tags"><span>${esc(b.stageLabel || "")}</span><span class="stars" aria-label="난이도 ${b.difficulty || 1}">${stars}</span></p>
        <p class="bd-trait">${esc(b.trait || "")}</p>
        <p class="bd-fun">${esc(b.fun || "")}</p>
        ${b.tip ? `<p class="bd-tip">${esc(b.tip)}</p>` : ""}`
      : `<div class="bd-pic"><canvas width="320" height="320" id="detail-art"></canvas></div>
        <h3>???</h3>
        <p class="bd-fun">${esc(b.hint || "아직 만나지 못했어요. 물총으로 흠뻑 적시면 도감에 기록돼요!")}</p>`;
    this.c.art.portrait($("detail-art"), id, seen);
    box.removeAttribute("hidden");
    if (seen) {
      save.clearFresh(id);
      const card = document.querySelector(`[data-book="${CSS.escape(id)}"] .new-badge`);
      if (card) card.remove();
    }
  }

  /* ---------------- 설정 ---------------- */
  openSettings() {
    this.renderSettings();
    this.show("settings");
  }

  renderSettings() {
    const s = this.g.save.settings;
    const host = $("settings-list");
    if (!host) return;
    const row = (k, icon, label, desc, on) => `<label class="set-row">
        <span class="set-icon">${ICONS[icon]}</span>
        <span class="set-text"><b>${label}</b><small>${desc}</small></span>
        <input type="checkbox" data-set="${k}" ${on ? "checked" : ""} />
        <i class="switch" aria-hidden="true"></i>
      </label>`;
    host.innerHTML =
      row("music", "music", "배경 음악", "해역마다 다른 음악", s.music) +
      row("sfx", "drop", "효과음", "물총 · 첨벙 소리", s.sfx) +
      row("vibrate", "vibrate", "진동", "맞힐 때 톡 (안드로이드)", s.vibrate) +
      row("assist", "target", "조준 도우미", "가까운 친구 쪽으로 물이 휘어요", s.assist) +
      row("effects", "sparkle", "화려한 효과", "끄면 오래된 폰에서 더 부드러워요", s.effects !== "low") +
      `<button type="button" class="set-reset" id="set-reset"><span class="ic">${ICONS.trash}</span>기록 지우기</button>
       <p class="set-note">기록은 이 기기에만 저장돼요. 서버로 보내지 않아요.</p>`;
    host.querySelectorAll("[data-set]").forEach((inp) =>
      inp.addEventListener("change", () => {
        const k = inp.dataset.set;
        const v = inp.checked;
        this.g.audio.unlock();
        if (k === "effects") {
          this.g.save.setSetting("effects", v ? "high" : "low");
          this.g.fx.quality = v ? 1 : 0.5;
        } else this.g.save.setSetting(k, v);
        if (k === "music") this.g.audio.setMusic(v);
        if (k === "sfx") this.g.audio.setSfx(v);
        this.g.audio.play("click");
      })
    );
    const rs = $("set-reset");
    if (rs)
      rs.addEventListener("click", () => {
        if (!window.confirm("모든 해역 기록과 도감을 지울까요?")) return;
        this.g.save.reset();
        this.g.audio.setMusic(true);
        this.g.audio.setSfx(true);
        this.renderSettings();
        this.refreshMenu();
      });
  }

  /* ---------------- 플레이 화면 ---------------- */
  enterPlay(run) {
    this.show(null);
    document.body.classList.add("is-play");
    document.body.classList.remove("is-menu");
    $("hud").removeAttribute("hidden");
    const bonus = run.kind === "bonus";
    $("hud-stage-no").textContent = bonus ? `BONUS · ${run.data.name}` : this.stageLabel(run.index);
    $("hud-stage").textContent = bonus ? run.data.en || "BONUS ROUND" : run.data.en || run.data.name;
    document.body.classList.toggle("is-bonus", bonus);
    this.hudPrev = {};
    this.scoreShown = 0;
    this.scoreTarget = 0;
    $("hud-score").textContent = "0";
    this.bossBar(null);
    this.paintAvatar(true);
    this.paintSound();
    const res = $("result");
    if (res) res.setAttribute("hidden", "");
  }

  paintAvatar(force, mood = "happy") {
    const cv = $("hud-face");
    if (!cv || !this.c.art.heroPortrait) return;
    if (!force && this.faceMood === mood) return;
    this.faceMood = mood;
    this.c.art.heroPortrait(cv, { t: 0.3, mood });
  }

  hud(v) {
    const p = this.hudPrev;
    // 점수: 숫자가 '촤라락' 올라간다
    if (v.score !== this.scoreTarget) {
      const gain = v.score - this.scoreTarget;
      this.scoreTarget = v.score;
      if (gain > 0) {
        const g = $("hud-gain");
        g.textContent = `+${fmt(gain)}`;
        g.classList.remove("show");
        void g.offsetWidth;
        g.classList.add("show");
        const card = g.parentNode;
        card.classList.remove("bump");
        void card.offsetWidth;
        card.classList.add("bump");
      }
    }
    if (this.scoreShown !== this.scoreTarget) {
      const d = this.scoreTarget - this.scoreShown;
      this.scoreShown = Math.abs(d) < 2 ? this.scoreTarget : this.scoreShown + d * 0.18;
      $("hud-score").textContent = fmt(this.scoreShown);
    }
    if (p.hearts !== v.hearts || p.bonus !== v.bonus) {
      const h = $("hud-hearts");
      h.innerHTML = v.bonus ? "" : Array.from({ length: v.maxHearts }, (_, i) => `<i class="buoy ${i < v.hearts ? "on" : "off"}">${ICONS.buoy}</i>`).join("");
      if (p.hearts != null && v.hearts < p.hearts) {
        const lost = h.children[v.hearts];
        if (lost) lost.classList.add("pop");
        const card = h.closest(".hcard");
        card.classList.remove("ouch");
        void card.offsetWidth;
        card.classList.add("ouch");
        this.paintAvatar(true, "wet");
        clearTimeout(this.faceTimer);
        this.faceTimer = setTimeout(() => this.paintAvatar(true, "happy"), 1500);
      }
      p.hearts = v.hearts;
      p.bonus = v.bonus;
    }
    const prog = Math.round(v.progress * 1000) / 10;
    if (p.prog !== prog) {
      $("hud-prog").style.width = `${prog}%`;
      $("hud-boat").style.left = `${prog}%`;
      p.prog = prog;
    }
    if (p.time !== v.timeLeft) {
      const tl = $("hud-time");
      if (tl) {
        tl.hidden = v.timeLeft == null;
        tl.textContent = v.timeLeft == null ? "" : `${v.timeLeft}초`;
        tl.classList.toggle("hurry", v.timeLeft != null && v.timeLeft <= 5);
      }
      p.time = v.timeLeft;
    }
    const bossPct = v.boss == null ? -1 : Math.round(v.boss * 1000) / 10;
    if (p.boss !== bossPct) {
      const f = $("boss-fill");
      const lag = $("boss-lag");
      if (f && bossPct >= 0) {
        f.style.width = `${bossPct}%`;
        if (lag) lag.style.width = `${bossPct}%`;
        const bb = $("bossbar");
        if (p.boss > bossPct) {
          bb.classList.remove("hit");
          void bb.offsetWidth;
          bb.classList.add("hit");
        }
      }
      p.boss = bossPct;
    }
    if (p.bossPhase !== v.bossPhase) {
      const bb = $("bossbar");
      if (bb) bb.dataset.phase = String(v.bossPhase);
      p.bossPhase = v.bossPhase;
    }
    const pw = v.power ? `${v.power.id}:${Math.ceil(v.power.k * 20)}` : "";
    if (p.power !== pw) {
      const el = $("power");
      if (v.power) {
        const it = this.c.items[Object.keys(this.c.items).find((k) => this.c.items[k].effect === v.power.id)] || {};
        el.hidden = false;
        el.dataset.kind = v.power.id;
        el.innerHTML = `<span class="pw-name">${esc(it.name || "")}</span><i style="width:${Math.round(v.power.k * 100)}%"></i>`;
      } else el.hidden = true;
      p.power = pw;
    }
  }

  bossBar(bd) {
    const bb = $("bossbar");
    if (!bb) return;
    document.body.classList.toggle("has-boss", Boolean(bd));
    if (!bd) {
      bb.setAttribute("hidden", "");
      return;
    }
    $("boss-name").textContent = `${bd.title || ""} · ${bd.name}`;
    $("boss-fill").style.width = "100%";
    $("boss-lag").style.width = "100%";
    bb.removeAttribute("hidden");
  }

  comboBroke() {
    /* 콤보가 끊겨도 아이를 혼내지 않는다 — 조용히 0 으로 */
  }

  toast(msg) {
    this.toastQ.push(msg);
    if (!this.toastBusy) this.nextToast();
  }

  nextToast() {
    const el = $("toast");
    const msg = this.toastQ.shift();
    if (!el || !msg) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    el.innerHTML = `<span class="ic">${ICONS.book}</span>${esc(msg)}`;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => this.nextToast(), 250);
    }, 1700);
  }

  showPause(on) {
    const el = $("pause");
    if (!el) return;
    if (on) {
      el.removeAttribute("hidden");
      el.classList.remove("hidden");
    } else {
      el.setAttribute("hidden", "");
      el.classList.add("hidden");
    }
  }

  /* ---------------- 결과 ---------------- */
  showResult(r) {
    this.lastResult = r;
    const el = $("result");
    document.body.classList.remove("is-play");
    $("hud").setAttribute("hidden", "");
    this.bossBar(null);
    $("power").hidden = true;
    const box = $("result-body");
    const isBonus = r.kind === "bonus";
    const head = r.failed ? "긴급 탈출!" : isBonus ? "BONUS CLEAR!" : "STAGE CLEAR!";
    const sub = r.failed ? "괜찮아! 지혁이랑 다시 출항하자" : isBonus ? r.data.name : this.stageLabel(r.index);
    const disc = (r.discovered || [])
      .map((id) => this.c.book.find((b) => b.id === id))
      .filter(Boolean)
      .map((b) => `<span class="chip">${esc(b.name)}</span>`)
      .join("");
    const boats = (r.newBoats || []).map((b) => `<span class="chip gold"><span class="ic">${ICONS.boat}</span>${esc(b.name)}</span>`).join("");
    const bonus = (r.bonusUnlocked || []).map((b) => `<span class="chip gold"><span class="ic">${ICONS.chest}</span>${esc(b.name)} 열림!</span>`).join("");
    const stat = (icon, label, value) => `<div><span class="ic">${ICONS[icon]}</span><dt>${label}</dt><dd>${value}</dd></div>`;
    box.innerHTML = `
      <div class="res-ribbon${r.failed ? " fail" : ""}"><span>${esc(head)}</span></div>
      <p class="res-kicker">${esc(sub)}</p>
      ${
        r.failed
          ? `<div class="res-escape" aria-hidden="true"><span class="ic">${ICONS.buoy}</span></div>`
          : `<div class="res-medal g-${r.grade}" aria-label="등급 ${r.grade}"><span class="rm-tail l"></span><span class="rm-tail r"></span><span class="rm-face"><b>${r.grade}</b><small>RANK</small></span></div>`
      }
      ${r.newBest && !r.failed ? `<p class="res-new"><span class="ic">${ICONS.star}</span>NEW RECORD!</p>` : ""}
      <dl class="res-stats">
        ${stat("pearl", "점수", fmt(r.score))}
        ${stat("target", "명중률", `${Math.round((r.accuracy || 0) * 100)}%`)}
        ${stat("sparkle", "최고 콤보", r.maxCombo)}
        ${stat("star", "PERFECT", r.perfects)}
      </dl>
      ${!isBonus && !r.failed ? `<p class="res-soak">흠뻑 적신 친구 <b>${r.soaked}</b> / ${r.total}</p>` : ""}
      <p class="res-best">내 최고 기록 ${fmt(r.best || 0)}</p>
      ${disc ? `<div class="res-row"><b><span class="ic">${ICONS.book}</span>도감에 새로 기록</b><div class="chips">${disc}</div></div>` : ""}
      ${boats || bonus ? `<div class="res-row"><b><span class="ic">${ICONS.chest}</span>새로 열렸어요</b><div class="chips">${boats}${bonus}</div></div>` : ""}
      ${r.unlockedNext ? `<p class="res-unlock"><span class="ic">${ICONS.map}</span>STAGE ${two(r.index + 2)} 해역이 열렸어요!</p>` : ""}
    `;
    const retryBtn = $("res-retry");
    if (retryBtn) retryBtn.hidden = Boolean(r.failed);
    const next = $("res-next");
    if (next) {
      const hasNext = r.kind === "stage" && r.cleared && r.index + 1 < this.c.stages.length;
      next.innerHTML = `${hasNext ? "다음 해역" : r.kind === "bonus" ? "모험 계속" : r.cleared ? "한 번 더" : "다시 출항"}<span class="ic">${ICONS.next}</span>`;
    }
    this.show("result");
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    if (!r.failed) setTimeout(() => this.g.audio.play("stamp"), 450);
    this.refreshMenu();
  }
}
