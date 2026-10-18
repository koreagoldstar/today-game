/*
 * 하늘섬 대탈출 · 화면 글자 · 버튼 (HUD · 메뉴 · 결과)
 *  실제로 되는 기능만 버튼으로 보여 준다.
 */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const fmtTime = (s) => {
  if (!s && s !== 0) return "-";
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? "0" : ""}${r.toFixed(1)}`;
};

const ICON = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.3a4.4 4.4 0 018 2.6c0 5.7-8 10.6-8 10.6z" fill="#ff5a7a" stroke="#4a2a3a" stroke-width="1.6"/><ellipse cx="8.4" cy="10" rx="1.6" ry="1.1" fill="#fff" opacity=".8"/></svg>',
  heartEmpty: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.3a4.4 4.4 0 018 2.6c0 5.7-8 10.6-8 10.6z" fill="rgba(255,255,255,.25)" stroke="rgba(74,42,58,.55)" stroke-width="1.6" stroke-dasharray="2.4 2"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#fff"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#fff"/></svg>',
};

/** 받침이 있으면 a, 없으면 b (예: 협곡이 / 항구가) */
function josa(word, a, b) {
  const c = (word || "").trim().slice(-1).charCodeAt(0);
  if (c < 0xac00 || c > 0xd7a3) return b;
  return (c - 0xac00) % 28 ? a : b;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.body = document.body;
    this.screens = ["title", "howto", "sound", "pause", "result", "over", "stages", "ending"];
    this.current = null;
    this.toastT = 0;
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
    on("start-btn", () => g.continueGame());
    on("stages-btn", () => this.openPanel("stages", "title"));
    on("pause-select", () => g.toStages());
    on("res-next", () => g.nextStage());
    on("res-select", () => g.toStages());
    on("over-select", () => g.toStages());
    on("end-select", () => g.toStages());
    on("end-title", () => g.toTitle());
    on("howto-btn", () => this.openPanel("howto", "title"));
    on("sound-btn", () => this.openPanel("sound", "title"));
    on("pause-btn", () => g.pause());
    on("pause-resume", () => g.resume());
    on("pause-cp", () => g.retryCheckpoint());
    on("pause-restart", () => g.restart());
    on("pause-howto", () => this.openPanel("howto", "pause"));
    on("pause-sound", () => this.openPanel("sound", "pause"));
    on("pause-title", () => g.toTitle());
    on("res-again", () => g.restart());
    on("over-again", () => g.restart());
    on("over-cp", () => g.continueCheckpoint());
    document.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        g.audio.play("tap");
        this.show(this.backTo || "title");
      })
    );
    // 사운드 설정
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
    if (id === "howto") this.paintHowto();
    if (id === "stages") this.paintStages();
    this.show(id);
  }
  show(id) {
    this.current = id;
    for (const s of this.screens) {
      const el = $(s);
      if (el) el.hidden = s !== id;
    }
    this.body.classList.toggle("is-title", id === "title" || ((id === "howto" || id === "sound" || id === "stages") && this.backTo === "title"));
  }

  /* ---------------- 불러오기 ---------------- */
  loading(k, text) {
    $("load-bar").style.width = `${Math.round(k * 100)}%`;
    if (text) $("load-t").textContent = text;
  }
  hideLoading() {
    $("loading").classList.add("done");
    setTimeout(() => ($("loading").hidden = true), 500);
  }

  /* ---------------- HUD ---------------- */
  hud(on) {
    $("hud").hidden = !on;
    this.body.classList.toggle("is-play", on);
  }
  setHearts(n, max = 3) {
    const el = $("hearts");
    let h = "";
    for (let i = 0; i < max; i++) h += `<i class="${i < n ? "full" : "empty"}">${i < n ? ICON.heart : ICON.heartEmpty}</i>`;
    el.innerHTML = h;
    el.setAttribute("aria-label", `하트 ${n}개`);
  }
  setOrbs(n, total) {
    $("hud-orbs").textContent = n;
    $("hud-orbs-total").textContent = `/ ${total}`;
  }
  setScore(n) {
    $("hud-score").textContent = Math.round(n).toLocaleString("ko-KR");
  }
  setTime(s) {
    $("hud-time").textContent = fmtTime(s);
  }
  setProg(k) {
    $("prog").style.width = `${Math.round(Math.min(1, k) * 100)}%`;
    $("prog-pin").style.left = `${Math.round(Math.min(1, k) * 100)}%`;
  }
  setStage(def) {
    $("hud-stage").textContent = `${def.id} · ${def.name}`;
  }
  bossBar(o) {
    const el = $("boss-bar");
    if (!o) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    $("boss-name").textContent = o.name;
    let h = "";
    for (let i = 0; i < o.max; i++) h += `<i class="${i < o.hp ? "" : "off"}"></i>`;
    $("boss-hp").innerHTML = h;
  }
  setDash(ready, k) {
    const b = $("btn-dash");
    b.classList.toggle("cool", !ready);
    b.style.setProperty("--cd", `${Math.round(k * 100)}%`);
    $("dash-pc").classList.toggle("cool", !ready);
    $("dash-pc").style.setProperty("--cd", `${Math.round(k * 100)}%`);
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
  /** 점수 떠오르기 (화면 좌표) */
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

  /* ---------------- 패널 ---------------- */
  paintTitle(save) {
    const d = save.data;
    const cleared = Object.keys(d.stages.best).length;
    if (d.ending.count) $("title-best").innerHTML = `엔딩 ${d.ending.count}번 · 별 <b>${save.totalStars()}</b>/18 · 최고 합계 <b>${save.totalBest().toLocaleString("ko-KR")}</b>`;
    else if (cleared) $("title-best").innerHTML = `스테이지 <b>${save.unlocked}</b>까지 열림 · 별 <b>${save.totalStars()}</b>/18 · 최고 합계 <b>${save.totalBest().toLocaleString("ko-KR")}</b>`;
    else $("title-best").textContent = "6개의 하늘섬 · 마지막엔 고대 기계 용이 기다려요!";
    $("start-btn").textContent = cleared && save.unlocked > 1 ? `이어서 하기 · 스테이지 ${this.g.continueStageId()}` : "게임 시작";
  }
  /** 스테이지 선택 (잠김 · 별 · 최고 기록) */
  paintStages() {
    const g = this.g;
    const save = g.save;
    const list = g.stageList();
    $("stages-sum").innerHTML = `별 <b>${save.totalStars()}</b> / 18 · 최고 합계 <b>${save.totalBest().toLocaleString("ko-KR")}</b>점`;
    $("stage-grid").innerHTML = list
      .map((d, i) => {
        const open = d.id <= save.unlocked;
        const b = save.best(d.id);
        const stars = b ? b.stars : 0;
        return `<button type="button" class="stage-tile${open ? "" : " locked"}" data-stage="${i}" style="--c1:${d.colors[0]};--c2:${d.colors[1]}" ${open ? "" : 'aria-disabled="true"'}>
          <span class="no">${d.id}</span><span class="nm">${esc(d.name)}</span><span class="en">${d.en}</span>
          ${d.boss ? '<span class="boss">최종 보스</span>' : ""}
          <span class="st">${[0, 1, 2].map((k) => `<i class="${k < stars ? "on" : ""}">★</i>`).join("")}</span>
          <span class="rec">${b ? `최고 ${b.score.toLocaleString("ko-KR")} · ${fmtTime(b.time)}` : open ? "도전해 보세요!" : `스테이지 ${d.id - 1} 클리어하면 열려요`}</span>
        </button>`;
      })
      .join("");
    $("stage-grid").querySelectorAll("[data-stage]").forEach((b) =>
      b.addEventListener("click", () => {
        g.audio.unlock();
        g.audio.play("tap");
        const i = Number(b.dataset.stage);
        if (list[i].id > save.unlocked) return this.toast(`스테이지 ${list[i].id - 1}부터 클리어해요`, "", 1.4);
        g.startStage(i);
      })
    );
  }
  paintHowto() {
    const touch = document.body.classList.contains("touch");
    $("howto").classList.toggle("is-touch", touch);
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
  hideAll() {
    this.show(null);
  }
  pauseCard(hasCp) {
    $("pause-cp").hidden = !hasCp;
  }

  /* ---------------- 결과 ---------------- */
  result(o) {
    $("res-k").textContent = `STAGE ${o.stage.id} · ${o.stage.name}`;
    $("res-h").textContent = o.stage.id === 6 ? "용의 성 탈출!" : "탈출 성공!";
    $("res-stars").innerHTML = [0, 1, 2].map((k) => `<i class="${k < o.stars ? "" : "off"}">★</i>`).join("");
    $("star-rules").innerHTML = [
      ["클리어", true],
      [`구슬 70% 이상 (${o.orbs}/${o.orbTotal})`, o.starOrbs],
      [`실수 1번 이하 (${o.falls + o.hits}번)`, o.starClean],
    ]
      .map(([t, ok]) => `<li class="${ok ? "ok" : ""}">${ok ? "★" : "☆"} ${esc(t)}</li>`)
      .join("");
    const un = $("res-unlock");
    un.hidden = !o.unlockedNext;
    if (o.unlockedNext) un.textContent = `스테이지 ${o.stage.id + 1} · ${o.nextName}${josa(o.nextName, "이", "가")} 열렸어요!`;
    $("res-next").hidden = !o.hasNext;
    const rows = [
      ["이동 거리", `${Math.round(o.dist)} m`, o.pts.dist],
      ["에너지 구슬", `${o.orbs} / ${o.orbTotal}${o.bigs ? ` · 큰 구슬 ${o.bigs}` : ""}`, o.pts.orbs],
      ["장애물 통과", `${o.passes}곳`, o.pts.pass],
      ["연속 점프 · 콤보", `최고 ${o.bestChain}연속 · 콤보 x${o.bestCombo}`, o.pts.chain],
      ["대시 점프", `${o.dashJumps}번`, o.pts.dash],
      ["탈출 시간 보너스", fmtTime(o.time), o.pts.time],
    ];
    $("res-rows").innerHTML = rows.map(([k, v, p]) => `<li><span>${k}</span><em>${esc(v)}</em><b>+${Math.round(p).toLocaleString("ko-KR")}</b></li>`).join("");
    $("res-score").textContent = Math.round(o.score).toLocaleString("ko-KR");
    $("res-falls").textContent = o.falls || o.hits ? `떨어짐 ${o.falls}번 · 맞음 ${o.hits}번` : "한 번도 안 떨어지고 안 맞았어요!";
    const r = o.rec;
    $("res-records").innerHTML = `
      <p><small>최고 점수</small><b>${o.best.toLocaleString("ko-KR")}${r.newBest ? '<i class="new">NEW</i>' : ""}</b></p>
      <p><small>가장 빠른 탈출</small><b>${fmtTime(o.bestTime)}${r.newTime ? '<i class="new">NEW</i>' : ""}</b></p>
      <p><small>클리어 횟수</small><b>${o.clears}번</b></p>`;
    this.show("result");
  }
  /** 엔딩: 모든 스테이지 기록 + 랭킹 (모든 스테이지 최고 점수 합) */
  ending(o) {
    $("end-total").textContent = o.total.toLocaleString("ko-KR");
    $("end-list").innerHTML = o.stages.map((d) => `<li><span>${d.id}. ${esc(d.name)} ${"★".repeat(d.stars)}${"☆".repeat(3 - d.stars)}</span><b>${d.score.toLocaleString("ko-KR")}</b></li>`).join("");
    $("end-records").innerHTML = `
      <p><small>모은 별</small><b>${o.stars} / 18</b></p>
      <p><small>이번 마지막 판</small><b>${fmtTime(o.lastTime)}</b></p>
      <p><small>엔딩 본 횟수</small><b>${o.count}번</b></p>`;
    this.show("ending");
    const slot = $("end-rank");
    slot.innerHTML = "";
    if (window.TodayGameRank) {
      try {
        TodayGameRank.mount({ gameId: "sky-island", gameTitle: "하늘섬 대탈출", formParent: slot });
        TodayGameRank.open(Math.round(o.total), { label: `${Math.round(o.total).toLocaleString("ko-KR")}점 (6스테이지 합)` });
      } catch (e) {
        console.warn("랭킹 연결 실패", e);
      }
    }
  }
  over(o) {
    $("over-stats").innerHTML = `
      <p><small>도착한 거리</small><b>${Math.round(o.dist)} m</b></p>
      <p><small>모은 구슬</small><b>${o.orbs}개</b></p>
      <p><small>점수</small><b>${Math.round(o.score).toLocaleString("ko-KR")}</b></p>`;
    $("over-cp").hidden = !o.hasCp;
    $("over-cp").textContent = o.boss ? "보스전 다시 도전" : "체크포인트에서 이어하기";
    this.show("over");
  }
}
