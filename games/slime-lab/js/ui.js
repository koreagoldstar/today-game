/*
 * 말랑팡! 슬라임 연구소 · 화면 글자 · 버튼 (HUD · 메뉴 · 미션 목록 · 도감 · 결과)
 *  실제로 되는 기능만 버튼으로 보여 준다.
 */
import { LEVELS, MAX_LV } from "./config.js?v=1";
import { MISSIONS, TIERS, title as mTitle, detail as mDetail, tierOpen } from "./missions.js?v=1";
import { makeSprite, makeSilhouette } from "./art.js?v=1";

const $ = (id) => document.getElementById(id);
const num = (n) => Math.round(n || 0).toLocaleString("ko-KR");
const starsText = (n) => "★".repeat(n) + "☆".repeat(3 - n);

export class UI {
  constructor(game) {
    this.g = game;
    this.screens = ["title", "missions", "dex", "howto", "settings", "pause", "over", "mresult"];
    this.current = null;
    this.backTo = "title";
    this.bind();
  }
  bind() {
    const g = this.g;
    const on = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("click", (e) => {
        e.preventDefault();
        g.audio.unlock();
        g.audio.play("tap");
        fn(e);
      });
    };
    on("classic-btn", () => g.start("classic"));
    on("mission-btn", () => this.open("missions", "title"));
    on("dex-btn", () => this.open("dex", "title"));
    on("howto-btn", () => this.open("howto", "title"));
    on("settings-btn", () => this.open("settings", "title"));
    on("pause-btn", () => g.pause());
    on("sound-btn", () => g.setSound(!g.save.data.settings.sound));
    on("pause-resume", () => g.resume());
    on("pause-restart", () => g.restart());
    on("pause-menu", () => g.toTitle());
    on("pause-howto", () => this.open("howto", "pause"));
    on("pause-settings", () => this.open("settings", "pause"));
    on("over-again", () => g.restart());
    on("over-menu", () => g.toTitle());
    on("mres-again", () => g.restart());
    on("mres-list", () => {
      g.toTitle();
      this.open("missions", "title");
    });
    on("mres-next", () => {
      const n = g.nextMission();
      if (n) g.start("mission", n);
      else {
        g.toTitle();
        this.open("missions", "title");
      }
    });
    document.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault();
        g.audio.play("tap");
        this.show(this.backTo || "title");
      })
    );
    $("set-sound").addEventListener("change", (e) => g.setSound(e.target.checked));
    $("set-reduced").addEventListener("change", (e) => g.setReduced(e.target.checked));
  }
  open(id, back) {
    this.backTo = back;
    if (id === "missions") this.paintMissions();
    if (id === "dex") this.paintDex();
    if (id === "settings") this.paintSettings();
    this.show(id);
  }
  show(id) {
    this.current = id;
    for (const s of this.screens) {
      const el = $(s);
      if (el) el.hidden = s !== id;
    }
    document.body.classList.toggle("is-title", id === "title" || (["missions", "dex", "howto", "settings"].includes(id) && this.backTo === "title"));
  }
  hud(on, mission = null) {
    $("hud").hidden = !on;
    $("hud-bottom").hidden = !on;
    $("mission-bar").hidden = !on || !mission;
    document.body.classList.toggle("is-play", on);
    document.body.classList.toggle("is-mission", !!(on && mission));
    if (!on) {
      this.warn(false);
      $("combo").hidden = true;
    }
  }
  setScore(score, best, mission) {
    $("hud-score").textContent = num(score);
    $("hud-best-k").textContent = mission ? "목표" : "최고";
    $("hud-best").textContent = mission ? "" : num(best);
    $("hud-best-box").hidden = !!mission;
  }
  setMission(m, progText, left) {
    $("mission-goal").textContent = mTitle(m);
    $("mission-prog").textContent = progText;
    const d = $("mission-drops");
    d.textContent = `남은 슬라임 ${left}`;
    d.classList.toggle("low", left <= 5);
  }
  setSound(on) {
    const b = $("sound-btn");
    b.innerHTML = `<span aria-hidden="true">${on ? "🔊" : "🔈"}</span>`;
    b.setAttribute("aria-label", on ? "소리 끄기" : "소리 켜기");
    b.classList.toggle("off", !on);
  }
  setHint(touch) {
    $("hint").textContent = touch ? "손가락으로 옮기고 떼면 떨어져요" : "마우스로 옮기고 클릭 · ←→ 와 Space 도 돼요";
  }
  combo(text, big = false) {
    const el = $("combo");
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle("big", big);
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    clearTimeout(this.comboT);
    this.comboT = setTimeout(() => (el.hidden = true), 1100);
  }
  warn(on) {
    const el = $("warn");
    if (el.hidden !== !on) el.hidden = !on;
    document.body.classList.toggle("danger", on);
  }
  toast(text, dur = 2.2) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => (el.hidden = true), dur * 1000);
  }
  /** 다음 슬라임 미리보기 */
  drawNext(level) {
    const cv = $("next");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const css = cv.clientWidth || 56;
    if (cv.width !== Math.round(css * dpr)) cv.width = cv.height = Math.round(css * dpr);
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!level) return;
    const px = (cv.width * 0.3) / LEVELS[level].r;
    const s = makeSprite(level, px);
    ctx.drawImage(s.cv, cv.width / 2 - s.half, cv.height / 2 - s.half + cv.height * 0.06);
    cv.setAttribute("aria-label", `다음 슬라임: ${LEVELS[level].name}`);
  }
  /** 진화 순서표 (못 찾은 것은 실루엣 + ?) */
  drawEvo(save) {
    const cv = $("evo");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = cv.clientWidth || 320;
    const ch = cv.clientHeight || 40;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
    }
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const n = MAX_LV;
    // 세로로 긴 칸(가로 휴대폰의 오른쪽 줄)이면 위에서 아래로
    const vert = cv.height > cv.width * 1.5;
    const step = (vert ? cv.height : cv.width) / n;
    const size = vert ? Math.min(step * 0.42, cv.width * 0.36) : Math.min(step * 0.42, cv.height * 0.36);
    for (let lv = 1; lv <= n; lv++) {
      const x = vert ? cv.width * 0.5 : step * (lv - 0.5);
      const y = vert ? step * (lv - 0.5) : cv.height * 0.55;
      const px = (size * (0.62 + lv * 0.05)) / LEVELS[lv].r;
      const found = save.found(lv);
      const s = found ? makeSprite(lv, px) : makeSilhouette(lv, px);
      ctx.drawImage(s.cv, x - s.half, y - s.half);
      if (!found) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${Math.round(size * 0.9)}px Jua, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", x, y);
      }
      if (lv < n) {
        ctx.fillStyle = "rgba(140,110,190,0.6)";
        ctx.beginPath();
        if (vert) {
          const ay = step * lv;
          ctx.moveTo(x - size * 0.18, ay - step * 0.06);
          ctx.lineTo(x, ay + step * 0.06);
          ctx.lineTo(x + size * 0.18, ay - step * 0.06);
        } else {
          const ax = step * lv;
          ctx.moveTo(ax - step * 0.06, y - size * 0.18);
          ctx.lineTo(ax + step * 0.06, y);
          ctx.lineTo(ax - step * 0.06, y + size * 0.18);
        }
        ctx.fill();
      }
    }
    cv.setAttribute("aria-label", `진화 순서 · 찾은 슬라임 ${save.foundCount()}/${n}`);
  }

  /* ---------------- 메뉴 ---------------- */
  paintTitle(save) {
    const d = save.data;
    $("title-best").innerHTML = d.games
      ? `클래식 최고 <b>${num(d.best)}</b>점 · 도감 <b>${save.foundCount()}/${MAX_LV}</b> · 미션 별 <b>${save.missionStars()}/${MISSIONS.length * 3}</b>`
      : `도감 <b>${save.foundCount()}/${MAX_LV}</b> · 첫 실험을 시작해 볼까요?`;
  }
  paintMissions() {
    const save = this.g.save;
    const st = save.data.missions;
    $("missions-sum").textContent = `모은 별 ${save.missionStars()} / ${MISSIONS.length * 3}`;
    let h = "";
    TIERS.forEach((t, ti) => {
      const open = tierOpen(ti, st);
      const list = MISSIONS.filter((m) => m.tier === ti);
      h += `<section class="tier${open ? "" : " locked"}"><h3><span>${t.name}</span>${open ? "" : `<small>앞 난이도 미션 ${t.need}개를 깨면 열려요</small>`}</h3><div class="m-grid">`;
      for (const m of list) {
        const s = st[m.id] || 0;
        h += `<button type="button" class="m-tile${s ? " done" : ""}" data-m="${m.id}" ${open ? "" : 'aria-disabled="true"'}>
          <span class="m-no">${m.id}</span>
          <b>${mTitle(m)}</b>
          <small>${mDetail(m)}</small>
          <span class="m-stars" aria-label="별 ${s}개">${starsText(s)}</span>
          ${open ? "" : '<i class="lock" aria-hidden="true">🔒</i>'}
        </button>`;
      }
      h += "</div></section>";
    });
    const box = $("tiers");
    box.innerHTML = h;
    box.querySelectorAll("[data-m]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const g = this.g;
        g.audio.unlock();
        if (el.getAttribute("aria-disabled") === "true") {
          g.audio.play("fail");
          this.toast("아직 잠겨 있어요 · 앞 난이도 미션을 먼저 깨요!", 1.8);
          return;
        }
        g.audio.play("tap");
        g.start("mission", MISSIONS.find((m) => m.id === Number(el.dataset.m)));
      })
    );
  }
  paintDex() {
    const save = this.g.save;
    $("dex-sum").textContent = `찾은 슬라임 ${save.foundCount()} / ${MAX_LV}`;
    const grid = $("dex-grid");
    grid.innerHTML = "";
    for (let lv = 1; lv <= MAX_LV; lv++) {
      const L = LEVELS[lv];
      const found = save.found(lv);
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `dex-tile${found ? "" : " unknown"}`;
      btn.dataset.lv = lv;
      const cv = document.createElement("canvas");
      cv.width = cv.height = 120;
      const px = 38 / L.r;
      const s = found ? makeSprite(lv, px) : makeSilhouette(lv, px);
      cv.getContext("2d").drawImage(s.cv, 60 - s.half, 64 - s.half);
      btn.appendChild(cv);
      const cap = document.createElement("span");
      cap.innerHTML = `<small>${lv}단계</small><b>${found ? L.name : "???"}</b>`;
      btn.appendChild(cap);
      btn.setAttribute("aria-label", found ? `${lv}단계 ${L.name}` : `${lv}단계 · 아직 못 찾았어요`);
      btn.addEventListener("click", () => {
        this.g.audio.play("tap");
        this.dexDetail(lv);
      });
      li.appendChild(btn);
      grid.appendChild(li);
    }
    $("dex-detail").hidden = true;
  }
  dexDetail(lv) {
    const save = this.g.save;
    const L = LEVELS[lv];
    const rec = save.data.dex[lv];
    const el = $("dex-detail");
    el.hidden = false;
    el.innerHTML = rec
      ? `<b>${lv}단계 · ${L.name}</b><p>${L.desc}</p><small>처음 발견 ${rec.first} · 만든 횟수 ${num(rec.count)}번</small>`
      : `<b>${lv}단계 · ???</b><p>아직 발견하지 못했어요. ${lv > 1 ? `${LEVELS[lv - 1].name} 두 개를 합쳐 보세요!` : ""}</p>`;
  }
  paintSettings() {
    const s = this.g.save.data.settings;
    $("set-sound").checked = !!s.sound;
    $("set-reduced").checked = !!this.g.reduced;
    $("save-note").textContent = this.g.save.ok ? "기록은 이 기기의 브라우저에만 저장돼요. (다른 기기와 연결되지 않아요)" : "이 브라우저는 기록을 저장할 수 없어요 · 이번 방문 동안만 기억해요.";
  }

  /* ---------------- 결과 ---------------- */
  over(o) {
    $("over-score").textContent = num(o.score);
    $("over-new").hidden = !o.newBest;
    $("over-h").textContent = o.newBest ? "최고 기록이에요!" : "용기가 넘쳤어요!";
    $("over-stats").innerHTML = `
      <p><small>최고 점수</small><b>${num(o.best)}</b></p>
      <p><small>합체</small><b>${num(o.merges)}번</b></p>
      <p><small>최대 콤보</small><b>${o.maxCombo}</b></p>
      <p><small>최대 연쇄</small><b>${o.maxChain}</b></p>
      <p class="wide"><small>가장 큰 슬라임</small><b>${o.maxLevel ? LEVELS[o.maxLevel].name : "-"}</b></p>`;
    this.show("over");
    const slot = $("over-rank");
    slot.innerHTML = "";
    if (window.TodayGameRank && o.score > 0) {
      try {
        TodayGameRank.mount({ gameId: "slime-lab", gameTitle: "말랑팡! 슬라임 연구소", formParent: slot });
        TodayGameRank.open(Math.round(o.score), { label: `${num(o.score)}점` });
      } catch (e) {
        console.warn("랭킹 연결 실패", e);
      }
    }
  }
  missionResult(o) {
    const m = o.m;
    $("mres-k").textContent = `MISSION ${m.id}`;
    $("mres-h").textContent = o.ok ? "미션 성공!" : o.overflow ? "용기가 넘쳤어요" : "아쉬워요!";
    const st = $("mres-stars");
    st.textContent = o.ok ? starsText(o.stars) : "☆☆☆";
    st.setAttribute("aria-label", `별 ${o.ok ? o.stars : 0}개`);
    $("mres-goal").textContent = `${mTitle(m)} · ${o.ok ? `슬라임 ${o.used}개로 성공` : o.overflow ? "다시 도전해 봐요" : `슬라임 ${m.drops}개를 다 썼어요`}`;
    $("mres-stats").innerHTML = `
      <p><small>점수</small><b>${num(o.score)}</b></p>
      <p><small>합체</small><b>${num(o.merges)}번</b></p>
      <p><small>최대 연쇄</small><b>${o.maxChain}</b></p>
      <p><small>${o.ok ? "별 기준" : "진행"}</small><b>${o.ok ? `★★★ ${m.stars[2]}개 이하` : o.prog}</b></p>`;
    const un = $("mres-unlock");
    un.hidden = !o.unlock;
    un.textContent = o.unlock || "";
    const next = $("mres-next");
    next.hidden = !o.ok || !o.next;
    next.textContent = o.next ? `다음: ${mTitle(o.next)}` : "다음 미션";
    this.show("mresult");
  }
}
