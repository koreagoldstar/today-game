/*
 * 자석 대소동 · 화면 (HTML 버튼 · 창 · 위쪽 정보 · 화면 버튼 · 안내)
 */
import { STAGES } from "./levels.js?v=1";
import { specialText, MAT, starsOf, cond } from "./sim.js?v=1";
import { SKINS, drawObject, drawRobot } from "./render.js?v=1";
import { seoulDate } from "./save.js?v=1";
import { dailyFor } from "./game.js?v=1";

const $ = (id) => document.getElementById(id);
const sec = (t) => `${t.toFixed(1)}초`;
const starsText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const dateLabel = (d) => {
  const [, m, dd] = d.split("-");
  return `${Number(m)}월 ${Number(dd)}일`;
};

export class UI {
  constructor(game) {
    this.g = game;
    this.stack = [];
    this.tipIdx = -1;
    this.bind();
  }
  bind() {
    const g = this.g;
    const on = (id, fn) =>
      $(id).addEventListener("click", (e) => {
        g.audio.unlock();
        g.audio.play("tap");
        fn(e);
      });
    on("play-btn", () => {
      const next = STAGES.find((s) => !g.save.stars(s.id)) || STAGES[STAGES.length - 1];
      this.closeAll();
      this.openIntro(next);
    });
    on("stages-btn", () => this.show("stages"));
    on("daily-btn", () => this.openDaily());
    on("skins-btn", () => this.show("skins"));
    on("help-btn", () => this.show("help"));
    on("settings-btn", () => this.show("settings"));
    on("intro-go", () => {
      const def = this.introDef;
      this.closeAll();
      if (def && def.daily) g.startDaily(this.introDate);
      else if (def) g.startStage(def.id);
    });
    on("intro-back", () => this.back());
    on("daily-go", () => {
      this.closeAll();
      g.startDaily(this.dailyDate);
    });
    on("pause-btn", () => this.togglePause());
    on("p-resume", () => this.togglePause());
    on("p-restart", () => {
      this.closeAll();
      g.restart();
    });
    on("p-stages", () => this.toMenu("stages"));
    on("p-menu", () => this.toMenu());
    on("p-help", () => this.show("help"));
    on("p-settings", () => this.show("settings"));
    on("c-yes", () => {
      this.closeAll();
      g.restart();
    });
    on("c-no", () => this.back());
    on("r-retry", () => {
      this.closeAll();
      g.restart();
    });
    on("r-next", () => this.resNext());
    on("r-stages", () => this.toMenu(this.resKind === "daily" ? null : "stages"));
    on("r-share", () => this.share());
    on("r-copy", () => this.copyResult());
    on("view-btn", () => {
      g.view.fit = !g.view.fit;
      g.resize();
    });
    on("tip-close", () => ($("tip").hidden = true));
    $("set-sound").addEventListener("change", (e) => {
      g.audio.setOn(e.target.checked);
      g.save.setSetting("sound", e.target.checked);
      this.paintSound();
    });
    $("set-reduced").addEventListener("change", (e) => {
      g.save.setSetting("reduced", e.target.checked);
      g.applyReduced();
    });
    on("sound-btn", () => {
      const v = !g.audio.on;
      g.audio.setOn(v);
      g.save.setSetting("sound", v);
      this.paintSound();
    });
    for (const b of document.querySelectorAll("[data-back]")) b.addEventListener("click", () => this.back());
    for (const b of document.querySelectorAll(".pad [data-act]")) g.input.bindButton(b, b.dataset.act);
    window.addEventListener("keydown", (e) => {
      if (!this.stack.length) return;
      const top = this.stack[this.stack.length - 1];
      if (e.key === "Escape" && top !== "result") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.back();
      }
    });
    // 첫 터치가 있으면 화면 버튼을 보임
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "touch" && !document.body.classList.contains("touch")) {
          document.body.classList.add("touch");
          this.g.resize();
        }
      },
      { passive: true }
    );
    if (window.matchMedia && matchMedia("(pointer: coarse)").matches) document.body.classList.add("touch");
    this.paintSound();
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
    const g = this.g;
    if (g.mode === "play" && g.G && !g.G.won && !g.G.failed) g.setPaused(true);
    g.input.enabled = false;
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
      this.g.input.enabled = !(this.g.G && (this.g.G.won || this.g.G.failed));
    } else this.showTitle();
  }
  closeAll() {
    for (const id of this.stack) $(id).hidden = true;
    this.stack = [];
    if (this.g.mode === "play") {
      this.g.setPaused(false);
      this.g.input.enabled = true;
    }
  }
  toMenu(open = null) {
    this.closeAll();
    this.g.toMenu();
    this.showTitle();
    if (open) this.show(open);
  }
  onShow(id) {
    if (id === "stages") this.renderStages();
    else if (id === "skins") this.renderSkins();
    else if (id === "help") this.renderHelp();
    else if (id === "settings") this.renderSettings();
  }

  /* ---------------- 첫 화면 ---------------- */
  showTitle() {
    document.body.classList.add("is-title");
    document.body.classList.remove("is-play");
    for (const id of ["hud", "pad", "tip", "keys", "view-btn"]) $(id).hidden = true;
    $("title").hidden = false;
    const s = this.g.save;
    const date = seoulDate();
    const d = s.dailyOf(date);
    const cleared = STAGES.filter((st) => s.stars(st.id)).length;
    $("title-best").textContent = `별 ${s.totalStars()} / ${STAGES.length * 3} · 숨은 기어 ${s.gears()} / ${STAGES.length} · 오늘의 실험 ${d && d.stars ? `완료 ${sec(d.best)}` : "아직"}`;
    $("play-btn").textContent = cleared === 0 ? "플레이" : cleared >= STAGES.length ? "다시 플레이" : `이어서 · ${STAGES.find((st) => !s.stars(st.id)).id}번`;
  }
  titleHole() {
    const t = $("title");
    if (t.hidden) return null;
    const f = this.g.field.getBoundingClientRect();
    const a = t.querySelector(".logo").getBoundingClientRect();
    const b = t.querySelector(".menu").getBoundingClientRect();
    if (b.top - a.bottom < 90) return null;
    return { top: a.bottom - f.top, bottom: b.top - f.top, x: (b.left + b.right) / 2 - f.left };
  }

  /* ---------------- 게임 중 ---------------- */
  enterPlay() {
    const g = this.g;
    const def = g.def;
    document.body.classList.remove("is-title");
    document.body.classList.add("is-play");
    $("title").hidden = true;
    $("hud").hidden = false;
    $("pad").hidden = false;
    $("keys").hidden = false;
    $("hud-k").textContent = g.kind === "daily" ? `오늘의 실험 · ${dateLabel(g.extra.date)}` : `STAGE ${def.id}`;
    $("hud-name").textContent = def.name;
    $("hud-goal").textContent = def.goal;
    $("hud-energy").hidden = !def.energy;
    $("hud-use").hidden = !(def.levers && def.levers.length);
    this.tipIdx = -1;
    this.tipT = 0;
    $("tip").hidden = true;
    this.lastHud = "";
    g.resize();
    this.hud();
  }
  /** 화면 버튼 · 보드 자리 */
  insets() {
    const f = this.g.field.getBoundingClientRect();
    const out = { top: 6, bottom: 6, left: 0, right: 0 };
    const hud = $("hud");
    if (!hud.hidden) out.top = hud.getBoundingClientRect().bottom - f.top + 4;
    const pad = $("pad");
    if (!pad.hidden && getComputedStyle(pad).display !== "none") out.bottom = f.bottom - pad.getBoundingClientRect().top + 4;
    else if (!$("keys").hidden) out.bottom = f.bottom - $("keys").getBoundingClientRect().top + 2;
    return out;
  }
  layoutPads() {
    const v = this.g.view;
    $("view-btn").hidden = !(this.g.mode === "play" && v.canFollow);
    $("view-btn").textContent = v.fit ? "🔍 크게 보기" : "🗺️ 전체 보기";
    document.body.classList.toggle("has-view", !$("view-btn").hidden);
    // 안내 말풍선 · 알림이 위 칸 · 화면 버튼과 겹치지 않게
    const f = this.g.field.getBoundingClientRect();
    const hud = $("hud");
    const pad = $("pad");
    document.body.style.setProperty("--hud-h", `${hud.hidden ? 8 : Math.round(hud.getBoundingClientRect().bottom - f.top)}px`);
    const padOn = !pad.hidden && getComputedStyle(pad).display !== "none";
    document.body.style.setProperty("--pad-h", `${padOn ? Math.round(f.bottom - pad.getBoundingClientRect().top) : 40}px`);
  }
  hud() {
    const g = this.g;
    const G = g.G;
    if (!G) return;
    const mag = G.mag;
    const key = `${mag.on}|${mag.pole}|${Math.floor(G.t * 10)}|${G.energy == null ? "" : Math.round(G.energy)}|${G.gearGot}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    const m = $("hud-mag");
    m.classList.toggle("on", mag.on);
    $("hud-mag-t").textContent = mag.on ? "자석 켜짐" : "자석 꺼짐";
    const p = $("hud-pole");
    p.textContent = mag.pole;
    p.className = `chip pole ${mag.pole}`;
    p.setAttribute("aria-label", `지금 극 ${mag.pole}`);
    $("hud-time").textContent = sec(G.winT != null ? G.winT : G.t);
    if (G.energy != null) {
      const pct = Math.max(0, Math.min(100, (G.energy / g.def.energy.max) * 100));
      $("hud-energy-fill").style.width = `${pct}%`;
      $("hud-energy").classList.toggle("low", pct < 25);
      $("hud-energy-n").textContent = `${Math.round(pct)}%`;
    }
    // 화면 버튼 표시: 자석 · 극
    const mb = document.querySelector('.pad [data-act="mag"]');
    mb.classList.toggle("lit", mag.on);
    document.querySelector('.pad [data-act="pole"] b').textContent = mag.pole;
    document.querySelector('.pad [data-act="pole"]').dataset.pole = mag.pole;
    this.tips(G);
  }
  /** 필요한 때 짧게 안내 (순서대로) */
  tips(G) {
    const tips = this.g.def.tips || [];
    const next = tips[this.tipIdx + 1];
    if (next && this.cond(G, next.when)) {
      this.tipIdx++;
      const el = $("tip");
      $("tip-t").textContent = next.text;
      el.hidden = false;
      el.classList.remove("show");
      void el.offsetWidth;
      el.classList.add("show");
      this.tipT = G.t;
    } else if (!next && !$("tip").hidden && G.t - this.tipT > 6) $("tip").hidden = true;
  }
  cond(G, w) {
    return cond(G, w);
  }

  toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => (el.hidden = true), 2200);
  }
  togglePause() {
    const g = this.g;
    if (g.mode !== "play" || !g.G || g.G.won || g.G.failed) return;
    if (this.stack.length) {
      if (this.stack[this.stack.length - 1] === "pause") this.back();
      return;
    }
    this.show("pause");
  }
  openPause() {
    if (!this.stack.length) this.togglePause();
  }
  askRestart() {
    const g = this.g;
    if (!g.G || g.G.won || g.G.failed) return;
    if (g.G.t < 2) {
      g.restart();
      return;
    }
    if (!this.stack.length) this.show("confirm");
  }
  paintSound() {
    const on = this.g.audio.on;
    const b = $("sound-btn");
    b.textContent = on ? "🔊" : "🔇";
    b.setAttribute("aria-label", on ? "효과음 끄기" : "효과음 켜기");
    b.setAttribute("aria-pressed", on ? "true" : "false");
  }

  /* ---------------- 스테이지 ---------------- */
  unlocked(id) {
    return id === 1 || this.g.save.stars(id - 1) > 0 || this.g.save.stars(id) > 0;
  }
  renderStages() {
    const s = this.g.save;
    $("stages-sum").textContent = `별 ${s.totalStars()} / ${STAGES.length * 3} · 숨은 기어 ${s.gears()} / ${STAGES.length}`;
    const box = $("stage-grid");
    box.textContent = "";
    for (const d of STAGES) {
      const open = this.unlocked(d.id);
      const rec = s.stage(d.id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "stage-card" + (rec && rec.stars ? " cleared" : "") + (open ? "" : " locked");
      b.disabled = !open;
      b.dataset.id = d.id;
      b.innerHTML = `<span class="no">${d.id}</span><span class="nm"></span><span class="st">${open ? starsText((rec && rec.stars) || 0) : "🔒"}</span><span class="bt"></span>`;
      b.querySelector(".nm").textContent = d.name;
      b.querySelector(".bt").textContent = rec && rec.best ? `${sec(rec.best)}${rec.gear ? " · ⚙" : ""}` : d.energy ? "에너지 제한" : "";
      b.setAttribute("aria-label", `${d.id}번 ${d.name} ${open ? `별 ${(rec && rec.stars) || 0}개` : "잠김"}`);
      b.addEventListener("click", () => {
        this.closeAll();
        this.openIntro(d);
      });
      box.appendChild(b);
    }
  }
  openIntro(def, date) {
    this.introDef = def;
    this.introDate = date;
    $("intro-k").textContent = def.daily ? `오늘의 자석 실험 · ${dateLabel(date)}` : `STAGE ${def.id}`;
    $("intro-h").textContent = def.name;
    $("intro-goal").textContent = def.goal;
    const rules = [`★ 깨기`, `★★ ${def.stars.time}초 안에`, `★★★ ${specialText(def)}`];
    $("intro-stars").innerHTML = rules.map((r) => `<li>${r}</li>`).join("");
    const e = def.energy;
    $("intro-energy").hidden = !e;
    if (e) $("intro-energy").textContent = e.regen ? "⚡ 에너지: 자석을 켜 두면 줄고, 끄면 다시 차요" : "⚡ 에너지: 자석을 켜 두면 줄고, 다시 차지 않아요! 아껴 써요";
    const rec = def.daily ? this.g.save.dailyOf(date) : this.g.save.stage(def.id);
    $("intro-best").textContent = rec && rec.best ? `내 기록 ${sec(rec.best)} · ${starsText(rec.stars || 0)}` : "";
    this.show("intro");
  }
  resNext() {
    const g = this.g;
    if (this.resKind === "daily") return this.toMenu();
    const nx = STAGES.find((s) => s.id === g.def.id + 1);
    if (!nx) {
      // 다 깼으면 오늘의 실험을 권함
      this.toMenu();
      this.openDaily();
      return;
    }
    this.closeAll();
    this.openIntro(nx);
  }

  /* ---------------- 결과 ---------------- */
  result({ ok, st, rec, why }) {
    const g = this.g;
    const G = g.G;
    const def = g.def;
    const daily = g.kind === "daily";
    this.resKind = g.kind;
    $("r-k").textContent = daily ? `오늘의 자석 실험 · ${dateLabel(g.extra.date)}` : `STAGE ${def.id} · ${def.name}`;
    const final = !daily && def.id === STAGES.length && ok;
    $("r-h").textContent = ok ? (final ? "거대 자석 장치 가동!" : "실험 성공!") : why === "energy" ? "에너지가 바닥났어요" : "아쉬워요";
    const sEl = $("r-stars");
    sEl.hidden = !ok;
    if (ok) {
      sEl.textContent = starsText(st.n);
      sEl.setAttribute("aria-label", `별 ${st.n}개`);
    }
    const t = G.winT != null ? G.winT : G.t;
    const best = daily ? rec && rec.best : rec && g.save.stage(def.id).best;
    const newBest = ok && rec && rec.newBest;
    $("r-new").hidden = !newBest;
    $("r-stats").innerHTML = "";
    const add = (k, v, done) => {
      const p = document.createElement("p");
      if (done != null) p.className = done ? "done" : "miss";
      const a = document.createElement("small");
      a.textContent = k;
      const b = document.createElement("b");
      b.textContent = v;
      p.append(a, b);
      $("r-stats").appendChild(p);
    };
    add("걸린 시간", sec(t), ok ? st.got[1] : null);
    add("최고 기록", best ? sec(best) : "–");
    add("자석 켠 횟수", `${G.uses}번`);
    add("극 바꾼 횟수", `${G.poleSwitches}번`);
    if (G.energy != null) add("남은 에너지", `${Math.round((G.energy / def.energy.max) * 100)}%`);
    add(specialText(def), ok ? (st.got[2] ? "성공" : "아직") : "–", ok ? st.got[2] : null);
    if (final) {
      // 특별 승리: 공장 전체 성적표
      add("모은 별 (전체)", `${g.save.totalStars()} / ${STAGES.length * 3}`);
      add("숨은 기어 (전체)", `${g.save.gears()} / ${STAGES.length}`);
    }
    $("result").classList.toggle("finale", final);
    $("r-rules").textContent = `★★ ${def.stars.time}초 안에 · ★★★ ${specialText(def)}`;
    const next = $("r-next");
    next.hidden = !ok;
    next.textContent = daily ? "메뉴로" : def.id === STAGES.length ? "오늘의 실험 하러 가기" : "다음 스테이지";
    $("r-stages").textContent = daily ? "메뉴로" : "스테이지 선택";
    $("r-stages").hidden = daily && ok;
    // 오늘의 실험: 공유 카드 · 오늘 순위(직접 올릴 때만)
    $("r-share-box").hidden = !(daily && ok);
    $("r-rank").innerHTML = "";
    if (daily && ok) {
      this.drawCard(t, st.n);
      if (window.TodayGameRank) {
        try {
          TodayGameRank.mount({ gameId: "magnet-daily", gameTitle: "자석 대소동 · 오늘의 자석 실험", formParent: $("r-rank") });
          TodayGameRank.open(Math.round(t * 1000), { label: sec(t) });
        } catch (e) {
          console.warn("랭킹 연결 실패", e);
        }
      }
    }
    // 12번을 처음 다 깼으면 오늘의 실험 권하기
    $("r-daily-hint").hidden = !final;
    this.show("result");
  }
  /** 결과 공유 카드 (캔버스) */
  drawCard(t, stars) {
    const cv = $("r-card");
    const ctx = cv.getContext("2d");
    const W = cv.width;
    const H = cv.height;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#2a3a6e");
    g.addColorStop(1, "#1d8f84");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff6e6";
    ctx.font = '700 30px "Bagel Fat One", Jua, sans-serif';
    ctx.textAlign = "left";
    ctx.fillText("자석 대소동", 28, 52);
    ctx.font = "20px Jua, sans-serif";
    ctx.fillStyle = "#ffd84d";
    ctx.fillText(`오늘의 자석 실험 · ${dateLabel(this.g.extra.date)}`, 28, 84);
    ctx.fillStyle = "#fff";
    ctx.font = '700 54px "Bagel Fat One", Jua, sans-serif';
    ctx.fillText(sec(t), 28, 156);
    ctx.font = "34px Jua, sans-serif";
    ctx.fillStyle = "#ffd84d";
    ctx.fillText(starsText(stars), 28, 204);
    ctx.font = "16px Jua, sans-serif";
    ctx.fillStyle = "rgba(255,246,230,0.85)";
    ctx.fillText("todaygame.co.kr/games/magnet-mayhem", 28, H - 22);
    // 마그
    ctx.save();
    ctx.translate(W - 90, H - 40);
    ctx.scale(2.2, 2.2);
    drawRobot(ctx, { robot: { x: 0, bottom: 0, y: -21 }, facing: -1, mag: { on: true, pole: "N" } }, { hop: 0, sx: 1, sy: 1, spin: 0, face: "happy" }, 0, this.g.skin());
    ctx.restore();
  }
  shareText() {
    const G = this.g.G;
    const t = G.winT != null ? G.winT : G.t;
    const st = starsOf(G);
    return `자석 대소동 · 오늘의 자석 실험 ${dateLabel(this.g.extra.date)} ${starsText(st.n)} ${sec(t)}`;
  }
  async share() {
    const url = "https://www.todaygame.co.kr/games/magnet-mayhem/";
    const text = this.shareText();
    try {
      const cv = $("r-card");
      const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
      const file = blob ? new File([blob], "magnet-mayhem.png", { type: "image/png" }) : null;
      if (navigator.share && file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ title: "자석 대소동", text, url, files: [file] });
      else if (navigator.share) await navigator.share({ title: "자석 대소동", text, url });
      else await this.copyResult();
    } catch (_) {
      /* 공유 창을 닫음 */
    }
  }
  async copyResult() {
    const text = `${this.shareText()}\nhttps://www.todaygame.co.kr/games/magnet-mayhem/`;
    try {
      await navigator.clipboard.writeText(text);
      this.toast("결과를 복사했어요");
    } catch (_) {
      this.toast("복사할 수 없어요");
    }
  }

  /* ---------------- 오늘의 자석 실험 ---------------- */
  openDaily() {
    const date = seoulDate();
    this.dailyDate = date;
    const def = dailyFor(date);
    const rec = this.g.save.dailyOf(date);
    $("daily-date").textContent = `${dateLabel(date)}의 실험`;
    $("daily-name").textContent = def.name;
    $("daily-goal").textContent = def.goal;
    $("daily-status").textContent = rec && rec.stars ? `오늘 성공! 최고 ${sec(rec.best)} · ${starsText(rec.stars)} (다시 해서 기록을 줄여 봐요)` : rec ? `오늘 ${rec.tries}번 도전했어요` : "아직 도전하지 않았어요";
    $("daily-hint").hidden = STAGES.every((s) => this.g.save.stars(s.id));
    this.show("daily");
  }

  /* ---------------- 마그 꾸미기 ---------------- */
  renderSkins() {
    const s = this.g.save;
    const gears = s.gears();
    $("skins-sum").textContent = `모은 숨은 기어 ${gears} / ${STAGES.length} · 겉모습만 바뀌고 능력은 같아요`;
    const box = $("skin-grid");
    box.textContent = "";
    for (const sk of SKINS) {
      const open = gears >= sk.need;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "skin" + (s.data.skin === sk.id ? " picked" : "") + (open ? "" : " locked");
      b.disabled = !open;
      const cv = document.createElement("canvas");
      cv.width = cv.height = 96;
      const c = cv.getContext("2d");
      c.translate(48, 86);
      c.scale(1.6, 1.6);
      drawRobot(c, { robot: { x: 0, bottom: 0, y: -21 }, facing: 1, mag: { on: false, pole: "S" } }, { hop: 0, sx: 1, sy: 1, spin: 0, face: open ? "happy" : "blink" }, 0, sk);
      if (!open) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.fillStyle = "rgba(20,26,46,0.55)";
        c.fillRect(0, 0, 96, 96);
      }
      const n = document.createElement("b");
      n.textContent = sk.name;
      const k = document.createElement("small");
      k.textContent = open ? (s.data.skin === sk.id ? "쓰는 중" : "고르기") : `기어 ${sk.need}개`;
      b.append(cv, n, k);
      b.addEventListener("click", () => {
        s.set("skin", sk.id);
        this.renderSkins();
      });
      box.appendChild(b);
    }
  }

  /* ---------------- 도움말 · 설정 ---------------- */
  renderHelp() {
    if (this.helpDone) return;
    this.helpDone = true;
    const icon = (mat, shape) => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 56;
      const c = cv.getContext("2d");
      const b = { id: "x", x: 28, y: 28, hw: shape === "ball" ? 14 : 18, hh: shape === "ball" ? 14 : 18, r: 14, shape: shape === "ball" ? "circle" : "box", mat, angle: 0, type: "dynamic", bottom: 46, data: { obj: true } };
      drawObject(c, b, { held: new Set(), mag: { pole: "S" } }, 0);
      return cv;
    };
    const rows = [
      ["iron", "ball", "철", "N · S 어느 극이든 세게 끌려와요"],
      ["alloy", "crate", "합금", "끌려오긴 하지만 힘이 약해요"],
      ["wood", "crate", "나무", "자석이 안 통해요 · 몸으로 밀어요"],
      ["rubber", "ball", "고무", "자석이 안 통하고 통통 잘 튀어요"],
      ["magN", "crate", "자석 블록 N", "마그가 N 이면 밀려나고, S 면 끌려와요"],
      ["magS", "ball", "자석 블록 S", "마그가 S 면 밀려나고, N 이면 끌려와요"],
    ];
    const ul = $("help-mats");
    ul.textContent = "";
    for (const [mat, shape, name, desc] of rows) {
      const li = document.createElement("li");
      li.appendChild(icon(mat, shape));
      const p = document.createElement("p");
      const b = document.createElement("b");
      b.textContent = name;
      p.append(b, document.createTextNode(" " + desc));
      li.appendChild(p);
      ul.appendChild(li);
    }
    void MAT;
  }
  renderSettings() {
    const g = this.g;
    $("set-sound").checked = g.audio.on;
    $("set-reduced").checked = g.reduced;
    $("save-note").textContent = g.save.ok ? "기록(별 · 최고 기록 · 기어 · 꾸미기 · 오늘의 실험)은 이 기기의 브라우저에만 저장돼요. 다른 기기와 연결되지 않아요." : "이 브라우저는 기록을 저장할 수 없어요 · 이번 방문 동안만 기억해요.";
  }
}
