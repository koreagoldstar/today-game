/*
 * 용암 서핑 · 화면 글자 · 버튼 (HUD · 메뉴 · 결과)
 *  실제로 되는 기능만 버튼으로 보여 준다.
 */
const $ = (id) => document.getElementById(id);
export const fmtTime = (s) => {
  if (!s && s !== 0) return "-";
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? "0" : ""}${r.toFixed(1)}`;
};
const ICON = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.3a4.4 4.4 0 018 2.6c0 5.7-8 10.6-8 10.6z" fill="#ff5a5a" stroke="#4a1a22" stroke-width="1.6"/><ellipse cx="8.4" cy="10" rx="1.6" ry="1.1" fill="#fff" opacity=".8"/></svg>',
  heartEmpty: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.3a4.4 4.4 0 018 2.6c0 5.7-8 10.6-8 10.6z" fill="rgba(255,255,255,.25)" stroke="rgba(74,26,34,.55)" stroke-width="1.6" stroke-dasharray="2.4 2"/></svg>',
};

export class UI {
  constructor(game) {
    this.g = game;
    this.body = document.body;
    this.screens = ["title", "howto", "sound", "pause", "result", "over"];
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
    on("start-btn", () => g.startRun());
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
    if (id === "howto") $("howto").classList.toggle("is-touch", this.body.classList.contains("touch"));
    this.show(id);
  }
  show(id) {
    this.current = id;
    for (const s of this.screens) {
      const el = $(s);
      if (el) el.hidden = s !== id;
    }
    this.body.classList.toggle("is-title", id === "title" || ((id === "howto" || id === "sound") && this.backTo === "title"));
  }
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
    $("meter").hidden = !on;
    this.body.classList.toggle("is-play", on);
    if (!on) this.danger(0);
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
    $("hud-score").textContent = Math.round(n).toLocaleString("ko-KR");
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

  /* ---------------- 패널 ---------------- */
  paintTitle(save) {
    const d = save.data;
    $("title-best").innerHTML = d.clears
      ? `최고 점수 <b>${d.best.toLocaleString("ko-KR")}</b> · 가장 빠른 탈출 <b>${fmtTime(d.bestTime)}</b>`
      : d.best
        ? `최고 점수 <b>${d.best.toLocaleString("ko-KR")}</b> · 가장 멀리 <b>${Math.round(d.bestDist)}m</b>`
        : "아직 아무도 탈출하지 못했어요!";
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
    $("pause-cp").hidden = !hasCp;
  }
  /** 탈출 성공 */
  result(o) {
    const rows = [
      ["이동 거리", `${Math.round(o.dist)} m`, o.pts.dist],
      ["생존 시간", fmtTime(o.time), o.pts.time],
      ["에너지 구슬", `${o.orbs}개 · 큰 구슬 ${o.bigs}`, o.pts.orbs],
      ["스턴트 · 완벽한 착지", `회전 ${o.spins}번 · 완벽 ${o.perfects}번`, o.pts.stunt],
      ["연속 점프 · 콤보", `최고 콤보 x${o.bestCombo}`, o.pts.combo],
      ["부스터 · 지름길", `부스터 ${o.boosts}번${o.shortcut ? " · 지름길 통과!" : ""}`, o.pts.boost],
      ["탈출 성공 보너스", "", o.pts.clear],
    ];
    $("res-rows").innerHTML = rows.map(([a, b, p]) => `<li><span>${a}</span><small>${b}</small><b>+${Math.round(p).toLocaleString("ko-KR")}</b></li>`).join("");
    $("res-score").textContent = Math.round(o.score).toLocaleString("ko-KR");
    $("res-records").innerHTML = `
      <p><small>최고 점수</small><b>${o.best.toLocaleString("ko-KR")}${o.rec.newBest ? ' <i class="new">NEW</i>' : ""}</b></p>
      <p><small>가장 빠른 탈출</small><b>${fmtTime(o.bestTime)}${o.rec.newTime ? ' <i class="new">NEW</i>' : ""}</b></p>
      <p><small>탈출 횟수</small><b>${o.clears}번</b></p>`;
    this.show("result");
    const slot = $("res-rank");
    slot.innerHTML = "";
    if (window.TodayGameRank) {
      try {
        TodayGameRank.mount({ gameId: "lava-surfers", gameTitle: "용암 서핑", formParent: slot });
        TodayGameRank.open(Math.round(o.score), { label: `${Math.round(o.score).toLocaleString("ko-KR")}점` });
      } catch (e) {
        console.warn("랭킹 연결 실패", e);
      }
    }
  }
  over(o) {
    $("over-h").textContent = o.caught ? "용암에 따라잡혔어요" : "하트를 모두 잃었어요";
    $("over-stats").innerHTML = `
      <p><small>간 거리</small><b>${Math.round(o.dist)}m${o.rec && o.rec.newDist ? ' <i class="new">NEW</i>' : ""}</b></p>
      <p><small>구슬</small><b>${o.orbs}</b></p>
      <p><small>점수</small><b>${Math.round(o.score).toLocaleString("ko-KR")}${o.rec && o.rec.newBest ? ' <i class="new">NEW</i>' : ""}</b></p>`;
    $("over-best").textContent = `내 최고 점수 ${Math.round(o.best || 0).toLocaleString("ko-KR")} · 가장 멀리 ${Math.round(o.bestDist || 0)}m`;
    $("over-cp").hidden = !o.hasCp;
    this.show("over");
  }
}
