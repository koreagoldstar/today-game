/*
 * 용암 서핑 · 화면 글자 · 버튼 (HUD · 메뉴 · 스테이지 선택 · 결과 · 엔딩)
 *  실제로 되는 기능만 버튼으로 보여 준다.
 */
import { STAGES, ENDLESS, WORLDS, stageLabel } from "./stages.js?v=2";
import { THEMES } from "./themes.js?v=2";
import { STAGE_COUNT, ENDLESS_UNLOCK } from "./save.js?v=2";

const $ = (id) => document.getElementById(id);
const num = (n) => Math.round(n || 0).toLocaleString("ko-KR");
export const fmtTime = (s) => {
  if (!s && s !== 0) return "-";
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? "0" : ""}${r.toFixed(1)}`;
};
const stars = (n, max = 3) => "★".repeat(n) + "☆".repeat(Math.max(0, max - n));
const NEW = ' <i class="new">NEW</i>';
const ICON = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.3a4.4 4.4 0 018 2.6c0 5.7-8 10.6-8 10.6z" fill="#ff5a5a" stroke="#4a1a22" stroke-width="1.6"/><ellipse cx="8.4" cy="10" rx="1.6" ry="1.1" fill="#fff" opacity=".8"/></svg>',
  heartEmpty: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.3a4.4 4.4 0 018 2.6c0 5.7-8 10.6-8 10.6z" fill="rgba(255,255,255,.25)" stroke="rgba(74,26,34,.55)" stroke-width="1.6" stroke-dasharray="2.4 2"/></svg>',
};

export class UI {
  constructor(game) {
    this.g = game;
    this.body = document.body;
    this.screens = ["title", "howto", "sound", "pause", "result", "over", "stages", "ending", "endless"];
    this.current = null;
    this.bind();
  }
  bind() {
    const g = this.g;
    const on = (id, fn) => {
      const el = $(id);
      if (el)
        el.addEventListener("click", (e) => {
          e.preventDefault();
          g.audio.unlock();
          g.audio.play("tap");
          fn(e);
        });
    };
    on("start-btn", () => g.startFromTitle());
    on("stages-btn", () => this.openPanel("stages", "title"));
    on("endless-btn", () => {
      if (g.save.endlessOpen()) g.startStage(ENDLESS.id);
      else {
        g.audio.play("fail");
        this.toast(`STAGE ${String(ENDLESS_UNLOCK).padStart(2, "0")} 을 깨면 열려요!`, "bad", 1.6);
      }
    });
    on("howto-btn", () => this.openPanel("howto", "title"));
    on("sound-btn", () => this.openPanel("sound", "title"));
    on("pause-btn", () => g.pause());
    on("pause-resume", () => g.resume());
    on("pause-cp", () => g.retryCheckpoint());
    on("pause-restart", () => g.restart());
    on("pause-select", () => {
      g.paused = false;
      g.toStages();
    });
    on("pause-howto", () => this.openPanel("howto", "pause"));
    on("pause-sound", () => this.openPanel("sound", "pause"));
    on("pause-title", () => g.toTitle());
    on("res-next", () => (this.lastResult && this.lastResult.ending ? this.ending() : g.nextStage()));
    on("res-again", () => g.restart());
    on("res-select", () => g.toStages());
    on("end-select", () => g.toStages());
    on("end-endless", () => g.startStage(ENDLESS.id));
    on("eres-again", () => g.startStage(ENDLESS.id));
    on("eres-select", () => g.toStages());
    on("over-again", () => g.restart());
    on("over-cp", () => g.continueCheckpoint());
    on("over-select", () => g.toStages());
    document.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        g.audio.play("tap");
        this.show(this.backTo || "title");
      })
    );
    for (const k of ["musicVol", "sfxVol"]) {
      const el = $("vol-" + k);
      el.addEventListener("input", () => {
        g.audio.unlock();
        g.setSetting(k, Number(el.value) / 100);
        if (k === "sfxVol") g.audio.play("orb", { n: 4 });
        this.paintSound();
      });
    }
    $("mute-all").addEventListener("change", () => {
      if (window.TodayAudio) {
        const want = $("mute-all").checked;
        if (TodayAudio.isMuted() !== want) TodayAudio.toggle();
      }
    });
    document.querySelectorAll("[data-q]").forEach((b) =>
      b.addEventListener("click", () => {
        g.setSetting("quality", b.dataset.q);
        this.paintSound();
      })
    );
  }
  openPanel(id, back) {
    this.backTo = back;
    if (id === "sound") this.paintSound();
    if (id === "stages") this.paintStages();
    if (id === "howto") $("howto").classList.toggle("is-touch", this.body.classList.contains("touch"));
    this.show(id);
  }
  show(id) {
    this.current = id;
    for (const s of this.screens) {
      const el = $(s);
      if (el) el.hidden = s !== id;
    }
    this.body.classList.toggle("is-title", id === "title" || (["howto", "sound", "stages"].includes(id) && this.backTo === "title"));
  }
  loading(k, text) {
    $("load-bar").style.width = `${Math.round(k * 100)}%`;
    if (text) $("load-t").textContent = text;
  }
  /** 스테이지를 바꿀 때 잠깐 보이는 불러오기 화면 */
  showLoading(text) {
    const el = $("loading");
    clearTimeout(this.loadTimer);
    el.hidden = false;
    el.classList.remove("done");
    this.loading(0.4, text);
  }
  hideLoading() {
    $("loading").classList.add("done");
    clearTimeout(this.loadTimer);
    this.loadTimer = setTimeout(() => ($("loading").hidden = true), 500);
  }

  /* ---------------- HUD ---------------- */
  hud(on) {
    $("hud").hidden = !on;
    $("meter").hidden = !on;
    this.body.classList.toggle("is-play", on);
    if (!on) this.danger(0);
  }
  setStage(def) {
    $("hud-stage").textContent = `${stageLabel(def)} · ${def.name}`;
    $("hud-dist").hidden = !def.endless;
  }
  setHearts(n, max = 3) {
    const el = $("hearts");
    let h = "";
    for (let i = 0; i < max; i++) h += `<i class="${i < n ? "full" : "empty"}">${i < n ? ICON.heart : ICON.heartEmpty}</i>`;
    el.innerHTML = h;
    el.setAttribute("aria-label", `하트 ${n}개`);
  }
  setOrbs(n) {
    $("hud-orbs").textContent = n;
  }
  setScore(n) {
    $("hud-score").textContent = num(n);
  }
  setDist(m) {
    $("hud-dist").textContent = `${Math.round(m)}m`;
  }
  /** 용암과의 거리 막대: 0m(따라잡힘) ~ 90m(아주 멂) */
  setChase(d) {
    const k = Math.max(0, Math.min(1, d / 90));
    $("chase-fill").style.width = `${Math.round(k * 100)}%`;
    $("chase-me").style.left = `calc(${Math.round(8 + k * 90)}% - 2px)`;
    const t = $("chase-t");
    t.textContent = d > 0 ? `용암까지 ${Math.max(0, Math.round(d))}m` : "따라잡혔어요!";
    t.classList.toggle("near", d < 22);
  }
  /** 용암이 쫓아오지 않는 구간(보스전 싸움)에서는 거리 막대를 숨김 */
  chaseVisible(on) {
    $("chase").hidden = !on;
    $("chase-t").hidden = !on;
  }
  /** 보스 체력 막대 (null 이면 숨김) */
  bossBar(o) {
    const el = $("boss-bar");
    if (!o) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    $("boss-name").textContent = o.name;
    $("boss-fill").style.width = `${Math.round((Math.max(0, o.hp) / o.max) * 100)}%`;
    const pips = $("boss-pips");
    if (pips.childElementCount !== o.max) pips.innerHTML = "<i></i>".repeat(o.max);
    el.setAttribute("aria-label", `${o.name} 체력 ${Math.max(0, o.hp)} / ${o.max}`);
    if (o.hit) {
      el.classList.remove("hit");
      void el.offsetWidth;
      el.classList.add("hit");
    }
  }
  setSpeed(ms) {
    $("speed").textContent = Math.round(ms * 3.6);
  }
  setBoost(ready, k) {
    $("boost-fill").style.width = `${Math.round(k * 100)}%`;
    $("boost-wrap").classList.toggle("ready", ready);
    $("boost-t").textContent = ready ? "부스터 준비!" : "부스터 충전 중";
    const b = $("btn-boost");
    b.style.setProperty("--cd", `${Math.round(k * 100)}%`);
  }
  danger(k) {
    const el = $("danger");
    el.style.opacity = String(k);
    el.classList.toggle("on", k > 0.45);
  }
  combo(n, label) {
    const el = $("combo");
    if (!n || n < 3) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    $("combo-n").textContent = `x${n}`;
    $("combo-t").textContent = label || "콤보";
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }
  toast(text, kind = "", dur = 1.6) {
    const el = $("toast");
    el.textContent = text;
    el.className = "toast " + kind;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (el.hidden = true), dur * 1000);
  }
  prompt(text, dur = 3) {
    const el = $("prompt");
    if (!text) {
      el.hidden = true;
      return;
    }
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    clearTimeout(this.promptTimer);
    this.promptTimer = setTimeout(() => (el.hidden = true), dur * 1000);
  }
  banner(k, h, t, dur = 2, kind = "") {
    const el = $("banner");
    $("banner-k").textContent = k || "";
    $("banner-h").textContent = h || "";
    $("banner-t").textContent = t || "";
    el.className = "banner " + kind;
    el.hidden = false;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => (el.hidden = true), dur * 1000);
  }
  hideBanner() {
    $("banner").hidden = true;
  }
  floatAt(x, y, text, kind = "") {
    const el = document.createElement("span");
    el.className = "floater " + kind;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $("floaters").appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  fade(on) {
    $("fade").classList.toggle("on", on);
  }
  flash(kind = "bad") {
    const el = $("flash");
    el.className = "flash " + kind;
    void el.offsetWidth;
    el.classList.add("on");
  }

  /* ---------------- 타이틀 · 스테이지 선택 ---------------- */
  paintTitle(save) {
    const cleared = save.clearedCount();
    const g = this.g;
    const id = g.continueStageId();
    const def = g.defById(id);
    $("start-btn").textContent = cleared ? `이어서 하기 · ${stageLabel(def)}` : "게임 시작";
    const eb = $("endless-btn");
    const open = save.endlessOpen();
    eb.textContent = open ? "무한 도전" : "무한 도전 🔒";
    eb.classList.toggle("locked", !open);
    const E = save.data.endless;
    $("title-best").innerHTML = cleared
      ? `깬 스테이지 <b>${cleared}/${STAGE_COUNT}</b> · 별 <b>${save.totalStars()}/${STAGE_COUNT * 3}</b>${E.dist ? ` · 무한 최고 <b>${Math.round(E.dist)}m</b>` : ""}`
      : "아직 아무도 탈출하지 못했어요!";
  }
  paintStages() {
    const save = this.g.save;
    const unlocked = save.unlocked;
    $("stages-sum").innerHTML = `별 <b>${save.totalStars()} / ${STAGE_COUNT * 3}</b> · 최고 점수 합계 <b>${num(save.totalBest())}</b>점`;
    const tile = (def) => {
      const th = THEMES[def.theme] || THEMES.basalt;
      const locked = def.endless ? !save.endlessOpen() : def.id > unlocked;
      const b = def.endless ? null : save.stageBest(def.id);
      const E = save.data.endless;
      const cls = ["stage-tile", locked && "locked", def.boss && "boss", b && "done", def.endless && "endless"].filter(Boolean).join(" ");
      const rec = def.endless ? (E.best ? `최고 ${num(E.best)}점 · ${Math.round(E.dist)}m` : "아직 기록 없음") : b ? `${num(b.score)}점 · ${fmtTime(b.time)}` : "아직 기록 없음";
      return `<button type="button" class="${cls}" data-stage="${def.id}" style="--c1:${th.sky[2]};--c2:${th.sky[1]}" aria-label="${stageLabel(def)} ${def.name}${locked ? " (잠김)" : ""}">
        <span class="st-k">${stageLabel(def)}</span>
        <b class="st-n">${def.name}</b>
        ${def.endless ? "" : `<span class="st-stars">${stars(b ? b.stars : 0)}</span>`}
        <small class="st-rec">${locked ? (def.endless ? `STAGE ${String(ENDLESS_UNLOCK).padStart(2, "0")} 을 깨면 열려요` : "앞 스테이지를 깨면 열려요") : rec}</small>
        ${locked ? '<i class="st-lock" aria-hidden="true">🔒</i>' : ""}
      </button>`;
    };
    let h = "";
    for (const w of WORLDS) {
      const list = STAGES.filter((d) => d.world === w.id);
      h += `<section class="world"><h3 class="world-h"><span>WORLD ${w.id}</span>${w.name}</h3><div class="stage-grid">${list.map(tile).join("")}</div></section>`;
    }
    h += `<section class="world"><h3 class="world-h"><span>BONUS</span>끝없는 화산</h3><div class="stage-grid one">${tile(ENDLESS)}</div></section>`;
    const box = $("worlds");
    box.innerHTML = h;
    box.querySelectorAll("[data-stage]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const g = this.g;
        g.audio.unlock();
        if (el.classList.contains("locked")) {
          g.audio.play("fail");
          this.toast("아직 잠겨 있어요 · 앞 스테이지를 먼저 깨요!", "bad", 1.6);
          return;
        }
        g.audio.play("tap");
        g.startStage(Number(el.dataset.stage));
      })
    );
  }
  paintSound() {
    const s = this.g.save.data.settings;
    for (const k of ["musicVol", "sfxVol"]) {
      $("vol-" + k).value = Math.round(s[k] * 100);
      $("vol-" + k + "-v").textContent = s[k] <= 0 ? "끔" : `${Math.round(s[k] * 100)}`;
    }
    $("mute-all").checked = !!(window.TodayAudio && TodayAudio.isMuted());
    document.querySelectorAll("[data-q]").forEach((b) => {
      const on = b.dataset.q === s.quality;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
  }
  pauseCard(hasCp) {
    $("pause-cp").hidden = !hasCp || !!this.g.boss;
  }

  /* ---------------- 결과 ---------------- */
  /** 스테이지 탈출 성공 */
  result(o) {
    this.lastResult = o;
    const def = o.stage;
    $("res-k").textContent = `${stageLabel(def)} · ${def.name}`;
    $("res-h").textContent = def.boss ? `${def.name} 격파!` : "탈출 성공!";
    const st = $("res-stars");
    st.textContent = stars(o.stars || 1);
    st.setAttribute("aria-label", `별 ${o.stars || 1}개`);
    const rows = [
      ["이동 거리", `${Math.round(o.dist)} m`, o.pts.dist],
      ["생존 시간", fmtTime(o.time), o.pts.time],
      ["에너지 구슬 · 보석", `${o.orbs + o.bigs} / ${o.total}개 · 큰 보석 ${o.bigs}`, o.pts.orbs],
      ["스턴트 · 완벽한 착지", `회전 ${o.spins}번 · 완벽 ${o.perfects}번`, o.pts.stunt],
      ["연속 콤보", `최고 콤보 x${o.bestCombo}`, o.pts.combo],
      ["부스터", `부스터 ${o.boosts}번`, o.pts.boost],
    ];
    if (def.boss) rows.push(["보스 공격", `명중 · 격파`, o.pts.boss]);
    rows.push(["탈출 성공 보너스", "", o.pts.clear]);
    $("res-rows").innerHTML = rows.map(([a, b, p]) => `<li><span>${a}</span><small>${b}</small><b>+${num(p)}</b></li>`).join("");
    $("res-score").textContent = num(o.score);
    const b = o.best || { score: o.score, time: o.time, stars: o.stars };
    $("res-records").innerHTML = `
      <p><small>이 스테이지 최고 점수</small><b>${num(b.score)}${o.rec && o.rec.newBest ? NEW : ""}</b></p>
      <p><small>가장 빠른 탈출</small><b>${fmtTime(b.time)}${o.rec && o.rec.newTime ? NEW : ""}</b></p>
      <p><small>모은 별</small><b>${stars(b.stars)}</b></p>`;
    const un = $("res-unlock");
    const msgs = [];
    if (o.rec && o.rec.unlockedNext && o.next) msgs.push(`${stageLabel(o.next)} · ${o.next.name} 이(가) 열렸어요!`);
    if (o.rec && o.rec.unlockedEndless) msgs.push("무한 도전이 열렸어요!");
    un.hidden = !msgs.length;
    un.textContent = msgs.join(" ");
    $("res-next").textContent = o.ending ? "엔딩 보기" : o.next ? `다음: ${stageLabel(o.next)}` : "스테이지 선택";
    this.show("result");
  }
  /** 고대 용까지 깨면: 최종 클리어 화면 + 전체 기록 랭킹 */
  ending() {
    const save = this.g.save;
    const total = save.totalBest();
    $("end-total").textContent = num(total);
    $("end-stars").textContent = `★ ${save.totalStars()} / ${STAGE_COUNT * 3}`;
    $("end-list").innerHTML = STAGES.map((d) => {
      const b = save.stageBest(d.id);
      const tag = d.boss ? `B${stageLabel(d).slice(-1)}` : String(d.no).padStart(2, "0");
      return `<li class="${d.boss ? "boss" : ""}"><small>${tag}</small><span>${d.name}</span><b>${b ? num(b.score) : "-"}</b><i>${stars(b ? b.stars : 0)}</i></li>`;
    }).join("");
    this.show("ending");
    this.mountRank("end-rank", "lava-surfers", "용암 서핑", total, `18 스테이지 합계 ${num(total)}점`);
  }
  /** 무한 도전 결과 */
  endlessResult(o) {
    $("eres-h").textContent = o.clear ? "끝까지 내려왔어요! 전설!" : o.caught ? "용암에 따라잡혔어요" : "하트를 모두 잃었어요";
    $("eres-score").textContent = num(o.score);
    $("eres-records").innerHTML = `
      <p><small>간 거리</small><b>${Math.round(o.dist)}m${o.rec && o.rec.newDist ? NEW : ""}</b></p>
      <p><small>버틴 시간</small><b>${fmtTime(o.time)}</b></p>
      <p><small>구슬 · 보석</small><b>${o.orbs}</b></p>
      <p><small>무한 도전 최고 점수</small><b>${num(o.best)}${o.rec && o.rec.newBest ? NEW : ""}</b></p>
      <p><small>가장 멀리</small><b>${Math.round(o.bestDist || 0)}m</b></p>`;
    this.show("endless");
    this.mountRank("eres-rank", "lava-endless", "용암 서핑 무한 도전", o.score, `${Math.round(o.dist)}m · ${num(o.score)}점`);
  }
  mountRank(slotId, gameId, title, score, label) {
    const slot = $(slotId);
    slot.innerHTML = "";
    if (!window.TodayGameRank || !(score > 0)) return;
    try {
      TodayGameRank.mount({ gameId, gameTitle: title, formParent: slot });
      TodayGameRank.open(Math.round(score), { label });
    } catch (e) {
      console.warn("랭킹 연결 실패", e);
    }
  }
  over(o) {
    const def = o.stage;
    $("over-k").textContent = `GAME OVER · ${stageLabel(def)}`;
    $("over-h").textContent = o.boss ? `${def.name}에게 졌어요` : o.caught ? "용암에 따라잡혔어요" : "하트를 모두 잃었어요";
    $("over-stats").innerHTML = `
      <p><small>간 거리</small><b>${Math.round(o.dist)}m</b></p>
      <p><small>구슬</small><b>${o.orbs}</b></p>
      <p><small>점수</small><b>${num(o.score)}</b></p>`;
    const b = this.g.save.stageBest(def.id);
    $("over-best").textContent = b ? `이 스테이지 최고 점수 ${num(b.score)} · ${stars(b.stars)}` : "아직 이 스테이지를 깬 적이 없어요 · 다시 도전!";
    const cp = $("over-cp");
    cp.hidden = !o.hasCp;
    cp.textContent = o.boss ? "보스전 다시 도전" : "체크포인트에서 다시";
    this.show("over");
  }
}
