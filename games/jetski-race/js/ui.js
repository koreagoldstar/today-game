/*
 * 제트스키 썬더 레이스 · 화면(UI)
 *  메뉴 · 코스 선택 · 오늘의 기록 · 하는 법 · 출발 전 소개 · HUD · 결과 · 일시정지
 *  랭킹은 사이트 공용 /api/scores (TodayScores) 를 쓴다 — 코스마다 'jetski-01' ~ 'jetski-12' 보드, 기록(ms)이 낮을수록 위.
 *  얼굴 사진은 결과 초상에만 그리고, 서버로 보내는 것은 닉네임과 기록(숫자)뿐이다.
 */
import { W, clamp, fmtTime } from "./view.js?v=2";
import { ICONS, paintIcons } from "./icons.js?v=2";
import { COURSES, RACERS, RIVAL_ORDER, BONUS, THEMES } from "./data.js?v=2";
import { Save } from "./save.js?v=2";
import { drawPortrait, drawRacer } from "../art/jetski.js?v=2";
import * as P from "../art/props.js?v=2";

const NAME_KEY = "today-game-name";
const $ = (id) => document.getElementById(id);
const two = (n) => String(n).padStart(2, "0");
export const rankId = (c) => `jetski-${two(c.no)}`;

const MEDAL_COL = [
  ["#3a4d68", "#24344c", "#5a6f8e"],
  ["#f0a066", "#b0602e", "#ffd2b0"],
  ["#eef3fa", "#8e9db4", "#ffffff"],
  ["#ffd84a", "#c98a00", "#fff6c0"],
];

export function medalSVG(level, cls = "medal-ic") {
  const [c, d, h] = MEDAL_COL[level || 0];
  const ribbon = level ? `<path d="M18 4h10l6 18H24zM46 4H36l-6 18h10z" fill="${level === 3 ? "#ff4f6d" : level === 2 ? "#3f8cff" : "#13b5a8"}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>` : "";
  const star = level ? `<path d="m32 30 3.2 6.4 7 1-5.1 5 1.2 7L32 46.1l-6.3 3.3 1.2-7-5.1-5 7-1z" fill="${h}" stroke="${d}" stroke-width="1.6" stroke-linejoin="round"/>` : `<text x="32" y="45" text-anchor="middle" font-size="16" fill="#8aa0bf" font-family="Bagel Fat One">?</text>`;
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">${ribbon}<circle cx="32" cy="40" r="19" fill="${d}"/><circle cx="32" cy="38.5" r="17.5" fill="${c}" stroke="${d}" stroke-width="2"/><circle cx="32" cy="38.5" r="13" fill="none" stroke="${h}" stroke-opacity=".55" stroke-width="2"/>${star}</svg>`;
}

function starsHTML(n) {
  let s = "";
  for (let i = 0; i < 5; i++) s += `<span data-icon="star" class="${i < n ? "on" : ""}"></span>`;
  if (n > 5) s += `<span class="plus">+</span>`;
  return `<span class="stars">${s}</span>`;
}

export class UI {
  constructor(game) {
    this.g = game;
    this.body = document.body;
    this.screens = ["title", "courses", "records", "howto", "brief", "result", "pause"];
    this.hudEl = $("hud");
    this.lastHud = {};
    this.hintT = 0;
    this.previews = new Map();
    paintIcons(document);
    this.bind();
    this.updateMenu();
    this.paintSound();
    this.buildBoostRing();
  }

  /* ---------------- 공통 ---------------- */
  show(id) {
    for (const s of this.screens) {
      const el = $(s);
      if (el) el.hidden = s !== id;
    }
    this.body.classList.toggle("is-menu", id === "title");
  }

  click() {
    this.g.audio.unlock();
    this.g.audio.play("click");
  }

  bind() {
    const g = this.g;
    $("start-btn").addEventListener("click", () => {
      this.click();
      this.openBrief(g.courseIndex);
    });
    $("menu-courses").addEventListener("click", () => {
      this.click();
      this.openCourses();
    });
    $("menu-records").addEventListener("click", () => {
      this.click();
      this.openRecords(g.courseIndex);
    });
    $("menu-howto").addEventListener("click", () => {
      this.click();
      this.openHowto();
    });
    document.querySelectorAll("[data-back]").forEach((b) =>
      b.addEventListener("click", () => {
        this.click();
        this.toTitle();
      })
    );
    $("brief-back").addEventListener("click", () => {
      this.click();
      this.openCourses();
    });
    $("brief-go").addEventListener("click", () => {
      this.click();
      this.g.startRace(this.briefIndex);
    });
    $("res-retry").addEventListener("click", () => {
      this.click();
      this.g.retry();
    });
    $("res-courses").addEventListener("click", () => {
      this.click();
      this.g.toMenu();
      this.openCourses();
    });
    $("res-next").addEventListener("click", () => {
      this.click();
      const n = this.g.courseIndex + 1;
      if (this.g.isUnlocked(n)) this.openBrief(n);
    });
    $("pause-btn").addEventListener("click", () => {
      this.click();
      this.g.pause();
    });
    $("pause-resume").addEventListener("click", () => {
      this.click();
      this.g.resume();
    });
    $("pause-retry").addEventListener("click", () => {
      this.click();
      this.showPause(false);
      this.g.retry();
    });
    $("pause-quit").addEventListener("click", () => {
      this.click();
      this.showPause(false);
      this.g.toMenu();
      this.openCourses();
    });
    $("sound-btn").addEventListener("click", () => {
      this.click();
      if (window.TodayAudio) TodayAudio.toggle();
      this.paintSound();
    });
    window.addEventListener("todaygame-mute", () => this.paintSound());
    // BOOST 버튼: 누르는 순간 바로 (pointerdown)
    const bb = $("boost-btn");
    const fire = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.g.audio.unlock();
      this.g.input.pressBoost();
      bb.classList.add("press");
      setTimeout(() => bb.classList.remove("press"), 120);
    };
    bb.addEventListener("pointerdown", fire);
    bb.addEventListener("click", (e) => e.preventDefault());
  }

  paintSound() {
    const muted = Boolean(window.TodayAudio && TodayAudio.isMuted && TodayAudio.isMuted());
    const b = $("sound-btn");
    if (!b) return;
    b.classList.toggle("is-muted", muted);
    const ic = b.querySelector("[data-icon]");
    ic.setAttribute("data-icon", muted ? "mute" : "sound");
    paintIcons(b);
  }

  toTitle() {
    this.updateMenu();
    this.show("title");
  }

  /* ---------------- 메뉴 ---------------- */
  updateMenu() {
    const g = this.g;
    const c = COURSES[g.courseIndex];
    $("start-label").textContent = `COURSE ${two(c.no)} · ${c.en}`;
    const sv = g.save;
    let golds = 0;
    let silvers = 0;
    let bronzes = 0;
    for (const k of COURSES) {
      const m = (sv.course(k.id) || {}).medal || 0;
      if (m === 3) golds++;
      else if (m === 2) silvers++;
      else if (m === 1) bronzes++;
    }
    const gm = sv.data.grandMaster ? `<span class="mp" style="color:#ffd23f"><span data-icon="crown"></span>GRAND MASTER</span>` : "";
    $("menu-progress").innerHTML = `<span class="mp">${medalSVG(3, "mp-m")}${golds}</span><span class="mp">${medalSVG(2, "mp-m")}${silvers}</span><span class="mp">${medalSVG(1, "mp-m")}${bronzes}</span><span class="mp"><span data-icon="flag"></span>${Math.min(sv.data.unlocked, COURSES.length)}/12</span>${gm}`;
    $("menu-progress").querySelectorAll(".mp-m").forEach((m) => {
      m.style.width = "1.3em";
      m.style.height = "1.3em";
    });
    paintIcons($("menu-progress"));
  }

  /* ---------------- 코스 선택 ---------------- */
  openCourses() {
    this.show("courses");
    const g = this.g;
    const grid = $("course-grid");
    grid.innerHTML = "";
    const sv = g.save;
    $("courses-medals").innerHTML = `<span>${medalSVG(3, "pm")}${sv.golds(COURSES)}</span><span>${medalSVG(0, "pm")}${sv.medalCount(COURSES)}/36</span>`;
    $("courses-medals").querySelectorAll(".pm").forEach((m) => {
      m.style.width = "1.4em";
      m.style.height = "1.4em";
    });
    COURSES.forEach((c, i) => {
      const unlocked = g.isUnlocked(i);
      const rec = sv.course(c.id) || {};
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ccard${unlocked ? "" : " locked"}${i === g.courseIndex ? " current" : ""}`;
      btn.innerHTML = `
        <div class="cc-img"></div>
        <span class="cc-no">${two(c.no)}</span>
        ${unlocked ? `<span class="cc-medal-wrap">${medalSVG(rec.medal || 0, "cc-medal")}</span>` : ""}
        <div class="cc-meta">
          <p class="cc-en">${c.en}</p>
          <p class="cc-kr">${c.name}</p>
          <div class="cc-row">${starsHTML(c.stars)}<span class="cc-best">${rec.best ? fmtTime(rec.best) : "--:--.--"}</span></div>
        </div>
        ${unlocked ? "" : `<div class="cc-lock"><span data-icon="lock"></span>${c.soon ? "곧 열려요" : `COURSE ${two(c.no - 1)} 완주하면 열려요`}</div>`}`;
      btn.addEventListener("click", () => {
        this.click();
        if (unlocked) this.openBrief(i);
        else {
          btn.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 260 });
        }
      });
      grid.appendChild(btn);
      // 코스 미리보기 (실제 렌더러로 그린 장면)
      const img = btn.querySelector(".cc-img");
      const prev = this.preview(c);
      if (prev) img.appendChild(prev);
    });
    paintIcons(grid);
  }

  /** 코스 미리보기: 렌더러로 한 장면을 그려 캐시 */
  preview(c) {
    if (c.soon) {
      const t = THEMES[c.theme];
      const cv = document.createElement("canvas");
      cv.width = 320;
      cv.height = 200;
      const x = cv.getContext("2d");
      const g = x.createLinearGradient(0, 0, 0, 200);
      const sky = t ? t.sky : ["#2a5f9e", "#89c2ea"];
      g.addColorStop(0, sky[0]);
      g.addColorStop(0.55, sky[sky.length - 1]);
      g.addColorStop(0.56, t ? t.water.mid : "#1aa0d8");
      g.addColorStop(1, t ? t.water.near : "#0b5c9c");
      x.fillStyle = g;
      x.fillRect(0, 0, 320, 200);
      return cv;
    }
    let url = this.previews.get(c.id);
    if (!url) {
      url = this.g.renderPreview(c);
      this.previews.set(c.id, url);
    }
    const img = document.createElement("img");
    img.alt = "";
    img.src = url;
    return img;
  }

  /* ---------------- 출발 전 소개 ---------------- */
  openBrief(i) {
    const c = COURSES[i];
    if (!c || c.soon) return;
    this.briefIndex = i;
    this.show("brief");
    $("brief-no").textContent = `COURSE ${two(c.no)}`;
    $("brief-h").textContent = c.en;
    $("brief-kr").textContent = c.name;
    $("brief-stars").innerHTML = starsHTML(c.stars);
    const rec = this.g.save.course(c.id) || {};
    const m = c.medals;
    $("brief-medals").innerHTML = [
      [1, "BRONZE", m.bronze],
      [2, "SILVER", m.silver],
      [3, "GOLD", m.gold],
    ]
      .map(([lv, nm, sec]) => `<div class="bm${(rec.medal || 0) >= lv ? " got" : ""}">${medalSVG(lv)}<p>${nm}</p><b>${fmtTime(sec * 1000)}</b></div>`)
      .join("");
    $("brief-tip").textContent = c.tip || "";
    $("brief-best").textContent = rec.best ? `내 최고 기록 ${fmtTime(rec.best)}` : "첫 레이스! 결승선을 통과하면 다음 코스가 열려요.";
    paintIcons($("brief"));
  }

  /* ---------------- 레이스 HUD ---------------- */
  enterRace(course) {
    this.show(null);
    this.body.classList.remove("is-menu");
    this.hudEl.hidden = false;
    $("hud-tools").hidden = false;
    $("boost-btn").hidden = false;
    $("hud-bonus").hidden = false;
    $("result").hidden = true;
    $("pause").hidden = true;
    this.lastHud = {};
    // 진행 막대의 레이서 점
    const track = $("hud-track");
    track.querySelectorAll(".trk-dot").forEach((d) => d.remove());
    this.dots = {};
    for (const id of ["jihyeok", ...RIVAL_ORDER]) {
      const d = document.createElement("span");
      d.className = `trk-dot${id === "jihyeok" ? " me" : ""}`;
      if (id === "jihyeok") d.innerHTML = ICONS.jetski;
      else d.style.background = RACERS[id].body;
      track.appendChild(d);
      this.dots[id] = d;
    }
    $("pos-t").textContent = "5";
  }

  exitRace() {
    this.hudEl.hidden = true;
    $("hud-tools").hidden = true;
    $("boost-btn").hidden = true;
    $("hud-bonus").hidden = true;
    $("steer-hint").hidden = true;
    $("start-hint").hidden = true;
  }

  startHint(on) {
    $("start-hint").hidden = !on || this.g.save.data.races > 6;
    paintIcons($("start-hint"));
  }

  steerHint() {
    const sv = this.g.save;
    if (sv.data.races >= 3) return;
    const el = $("steer-hint");
    el.hidden = false;
    paintIcons(el);
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => (el.hidden = true), 3200);
  }

  hud(race) {
    const p = race.player;
    const L = race.track.length;
    const h = this.lastHud;
    // 순위
    const place = race.playerPlace;
    if (place !== h.place) {
      $("pos-n").textContent = String(place);
      $("hud-pos").classList.toggle("p1", place === 1);
      h.place = place;
    }
    // 진행
    const prog = clamp(p.z / L, 0, 1);
    const pk = Math.round(prog * 400);
    if (pk !== h.prog) {
      $("trk-fill").style.width = `${prog * 100}%`;
      h.prog = pk;
    }
    for (const r of race.racers) {
      const d = this.dots[r.id];
      if (d) d.style.left = `${clamp(r.z / L, 0, 1) * 100}%`;
    }
    // 시간
    const tt = race.state === "race" || race.state === "finish" ? (p.finished ? p.finishTime : race.t) : 0;
    const ts = fmtTime(tt * 1000);
    if (ts !== h.time) {
      $("hud-time").textContent = ts;
      h.time = ts;
    }
    // 속도 (km/h, 보기 좋게 조금 과장)
    const kmh = Math.round(p.v * 3.6 * 1.12);
    if (kmh !== h.kmh) {
      $("spd-n").textContent = String(kmh);
      $("spd-arc").style.strokeDasharray = `${clamp((kmh / 190) * 100, 0, 100)} 100`;
      h.kmh = kmh;
    }
    const boosting = p.boostT > 0;
    if (boosting !== h.boost) {
      document.querySelector(".hud-speed").classList.toggle("boost", boosting);
      $("boost-btn").classList.toggle("firing", boosting);
      h.boost = boosting;
    }
    // 게이지
    const gq = Math.round(p.gauge * 20);
    if (gq !== h.gauge) {
      h.gauge = gq;
      const full = Math.floor(p.gauge + 1e-6);
      for (let i = 0; i < 3; i++) {
        const seg = $(`bseg${i}`);
        seg.classList.toggle("on", i < full);
        seg.classList.toggle("part", i === full && p.gauge - full > 0.05);
      }
      $("boost-count").textContent = String(full);
      $("boost-btn").classList.toggle("ready", full >= 1);
    }
    // 보너스
    if (race.bonus !== h.bonus) {
      $("bonus-n").textContent = race.bonus.toLocaleString("ko-KR");
      h.bonus = race.bonus;
    }
  }

  buildBoostRing() {
    // 3칸짜리 고리 (위에서 시계 방향)
    const cx = 60;
    const cy = 60;
    const r = 52;
    for (let i = 0; i < 3; i++) {
      const a0 = -Math.PI / 2 + (i / 3) * Math.PI * 2 + 0.12;
      const a1 = -Math.PI / 2 + ((i + 1) / 3) * Math.PI * 2 - 0.12;
      const d = `M${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r} A${r} ${r} 0 0 1 ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}`;
      $(`bseg${i}`).setAttribute("d", d);
    }
  }

  posBump() {
    const el = $("hud-pos");
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  bonusBump() {
    const el = $("hud-bonus");
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  gaugeBump() {
    const el = $("boost-count");
    el.animate([{ transform: "scale(1)" }, { transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: 320 });
  }

  boostFired() {
    $("boost-btn").animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 260 });
  }

  finishFlash() {
    $("boost-btn").hidden = true;
    $("steer-hint").hidden = true;
  }

  showPause(on) {
    $("pause").hidden = !on;
    if (on) {
      const s = this.g.save.settings;
      const tg = $("pause-toggles");
      tg.innerHTML = `
        <button type="button" class="tog${s.music ? " on" : ""}" data-t="music"><span data-icon="music"></span>음악</button>
        <button type="button" class="tog${s.sfx ? " on" : ""}" data-t="sfx"><span data-icon="sound"></span>효과음</button>
        <button type="button" class="tog${s.vibrate ? " on" : ""}" data-t="vibrate"><span data-icon="vibrate"></span>진동</button>`;
      tg.querySelectorAll(".tog").forEach((b) =>
        b.addEventListener("click", () => {
          const k = b.dataset.t;
          s[k] = !s[k];
          this.g.save.save();
          if (k === "music") this.g.audio.setMusic(s.music);
          if (k === "sfx") this.g.audio.setSfx(s.sfx);
          b.classList.toggle("on", s[k]);
          this.click();
        })
      );
      paintIcons($("pause"));
    }
  }

  /* ---------------- 결과 ---------------- */
  showResult(d) {
    this.exitRace();
    const { course: c, time, place, results, rec } = d;
    this.lastResult = d;
    const sec = time / 1000;
    const m = c.medals;
    const medal = rec.medal;
    const ord = ["", "ST", "ND", "RD", "TH", "TH"][place] || "TH";
    // 다음 메달까지
    let push = "";
    if (medal === 0) push = `브론즈까지 <b>${(sec - m.bronze).toFixed(2)}초!</b><small>부스터를 모아서 직선에서 써 보세요</small>`;
    else if (medal === 1) push = `실버까지 <b>${(sec - m.silver).toFixed(2)}초!</b><small>점프대는 가운데로 → PERFECT 착지 부스트</small>`;
    else if (medal === 2) push = `골드까지 <b>${(sec - m.gold).toFixed(2)}초!</b><small>지름길과 부스터 연속(체인)을 노려 보세요</small>`;
    else push = `GOLD 달성!<small>오늘의 랭킹 1위에 도전!</small>`;
    const bestLine = rec.newBest && rec.prevBest ? `<span class="res-new">NEW RECORD!</span>` : rec.newBest ? `<span class="res-new">FIRST CLEAR!</span>` : "";
    const best = this.g.save.course(c.id).best;
    const st = d.stats;
    const chips = [
      [st.perfectStart, "PERFECT START", `+${BONUS.perfectStart}`],
      [st.overtakes > 0, `OVERTAKE ×${st.overtakes}`, ""],
      [st.perfectLandings > 0, `PERFECT LANDING ×${st.perfectLandings}`, ""],
      [st.boostChains > 0, `BOOST CHAIN ×${st.boostChains}`, ""],
      [st.crashes === 0, "NO CRASH", `+${BONUS.noCrash}`],
    ];
    const podium = results
      .map((r) => `<div class="pod${r.isPlayer ? " me" : ""}"><i style="background:${r.def.body}"></i><b>${r.place}</b>${r.isPlayer ? "나" : r.def.name}</div>`)
      .join("");
    const next = COURSES[d.index + 1];
    const unlock = rec.unlockedNext && next ? `<p class="res-unlock">새 코스 열림! <b>COURSE ${two(next.no)} ${next.en}</b>${next.soon ? " (곧 공개)" : ""}</p>` : "";
    const grand = d.grand ? `<p class="res-unlock" style="background:rgba(255,210,63,.3)">12개 코스 모두 GOLD — GRAND MASTER!</p>` : "";
    $("result-body").innerHTML = `
      <div class="res-head">
        <div class="res-portrait"><canvas width="224" height="224" id="res-face"></canvas></div>
        <div>
          <p class="res-place${place === 1 ? " p1" : ""}">${place}<sup>${ord}</sup> <span style="font-size:.42em">/ 5</span></p>
          <p class="res-course">COURSE ${two(c.no)} · ${c.en}</p>
        </div>
      </div>
      <div class="res-time">${medalSVG(medal)}<div><b>${fmtTime(time)}</b>${bestLine}<small>${medal ? ["", "BRONZE", "SILVER", "GOLD"][medal] + " MEDAL" : "완주!"} · BEST ${fmtTime(best)}</small></div></div>
      <p class="res-push">${push}</p>
      <div class="res-podium">${podium}</div>
      <div class="res-board" id="res-board">
        <p class="rb-title"><span data-icon="trophy"></span>TODAY BEST</p>
        <div id="rb-rows"><p class="rb-note">오늘의 기록을 불러오는 중…</p></div>
        <div id="rb-form"></div>
      </div>
      <div class="res-bonus">${chips.map(([on, t, v]) => `<span class="${on ? "" : "off"}">${t} <b>${v}</b></span>`).join("")}<span>BONUS <b>${d.bonus.toLocaleString("ko-KR")}</b></span></div>
      ${unlock}${grand}`;
    const canNext = this.g.isUnlocked(d.index + 1);
    $("res-next").disabled = !canNext;
    this.show("result");
    paintIcons($("result"));
    this.drawResultFace(place);
    this.loadBoard(c, time);
  }

  drawResultFace(place) {
    const cv = $("res-face");
    if (!cv) return;
    const x = cv.getContext("2d");
    x.clearRect(0, 0, 224, 224);
    x.save();
    x.translate(112, 236);
    x.scale(0.82, 0.82);
    drawPortrait(x, RACERS.jihyeok, { t: 0.4, mood: place === 1 ? "win" : place <= 3 ? "happy" : "focus" });
    x.restore();
  }

  /** 오늘의 랭킹: 상위 기록 + 내 예상 순위 + 앞 사람과 차이 */
  async loadBoard(c, time) {
    const rows = $("rb-rows");
    const form = $("rb-form");
    const TS = window.TodayScores;
    const myTime = Math.round(time);
    let list = [];
    let ok = false;
    if (TS && TS.fetchScores) {
      const res = await TS.fetchScores(rankId(c), 50, "day");
      ok = res.ok;
      list = (res.scores || []).map((e) => ({ name: e.name, score: Number(e.score) })).sort((a, b) => a.score - b.score);
    }
    if (!rows.isConnected) return;
    this.renderBoard(rows, list, myTime, ok);
    // 등록
    const saved = (() => {
      try {
        return localStorage.getItem(NAME_KEY) || "";
      } catch (_) {
        return "";
      }
    })();
    form.innerHTML = `<div class="rb-form"><input id="rb-name" maxlength="8" placeholder="랭킹 이름 (2~8자)" value="${saved.replace(/"/g, "")}" autocomplete="nickname" /><button type="button" class="btn-res primary" id="rb-send"><span data-icon="trophy"></span>기록 등록</button></div>`;
    paintIcons(form);
    $("rb-send").addEventListener("click", async () => {
      const name = $("rb-name").value.trim();
      if (name.length < 2) {
        $("rb-name").focus();
        return;
      }
      try {
        localStorage.setItem(NAME_KEY, name);
      } catch (_) {}
      $("rb-send").disabled = true;
      const r = TS ? await TS.submitScore(rankId(c), name, myTime) : { ok: false };
      if (r.ok) {
        const l2 = (r.scores || []).map((e) => ({ name: e.name, score: Number(e.score) })).sort((a, b) => a.score - b.score);
        this.renderBoard(rows, l2.length ? l2 : list, myTime, true, name);
        form.innerHTML = `<p class="rb-note">오늘 <b>${r.rankDay || "?"}위</b>로 등록됐어요!${r.rankWeek ? ` · 이번 주 ${r.rankWeek}위` : ""}</p>`;
        this.g.audio.play("medal");
      } else {
        $("rb-send").disabled = false;
        form.insertAdjacentHTML("beforeend", `<p class="rb-note">등록하지 못했어요. 잠시 뒤 다시 눌러 주세요.</p>`);
      }
    });
  }

  renderBoard(rows, list, myTime, ok, myName) {
    const better = list.filter((e) => e.score < myTime).length;
    const rank = better + 1;
    const top = list.slice(0, 3);
    let html = "";
    top.forEach((e, i) => {
      const me = myName && e.name === myName;
      html += `<div class="rb-row${me ? " me" : ""}"><span class="rk">${medalSVG(3 - i, "rk-m")}</span><span>${escapeHtml(e.name)}</span><span class="tm">${fmtTime(e.score)}</span></div>`;
    });
    html += `<div class="rb-row me"><span class="rk">${rank}</span><span>내 기록</span><span class="tm">${fmtTime(myTime)}</span></div>`;
    let note = "";
    if (!ok) note = "지금은 랭킹을 불러오지 못했어요. 기록은 이 기기에 저장됐어요.";
    else if (!list.length) note = "오늘 첫 기록이에요! 등록하면 1위!";
    else if (rank === 1) note = `현재 <b>1위</b>! 오늘의 최고 기록이에요.`;
    else {
      const ahead = list[rank - 2];
      note = `현재 <b>${rank}위</b>! ${rank - 1}위보다 <b>${((myTime - ahead.score) / 1000).toFixed(2)}초</b> 느립니다. 한 번 더 달려 보세요!`;
    }
    rows.innerHTML = html + `<p class="rb-note">${note}</p>`;
    rows.querySelectorAll(".rk-m").forEach((m) => {
      m.style.width = "1.6em";
      m.style.height = "1.6em";
    });
  }

  /* ---------------- 오늘의 기록 ---------------- */
  openRecords(i) {
    this.show("records");
    const tabs = $("rec-tabs");
    tabs.innerHTML = "";
    COURSES.forEach((c, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = two(c.no);
      b.disabled = Boolean(c.soon);
      if (k === i) b.classList.add("on");
      b.addEventListener("click", () => {
        this.click();
        tabs.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        this.loadRecords(k);
      });
      tabs.appendChild(b);
    });
    this.loadRecords(COURSES[i].soon ? 0 : i);
  }

  async loadRecords(i) {
    const c = COURSES[i];
    const board = $("rec-board");
    const mine = this.g.save.course(c.id) || {};
    board.innerHTML = `<h3>${c.en} <small style="font-size:.6em;color:#bfe9ff">${c.name}</small></h3>
      <p class="rec-my">내 최고 기록 <b>${mine.best ? fmtTime(mine.best) : "--:--.--"}</b> ${medalSVG(mine.medal || 0, "rm")}</p>
      <div id="rec-list"><p class="rec-empty">불러오는 중…</p></div>`;
    board.querySelectorAll(".rm").forEach((m) => {
      m.style.width = "1.6em";
      m.style.height = "1.6em";
      m.style.verticalAlign = "-0.45em";
    });
    const TS = window.TodayScores;
    const res = TS ? await TS.fetchScores(rankId(c), 20, "day") : { ok: false, scores: [] };
    const el = $("rec-list");
    if (!el) return;
    const list = (res.scores || []).map((e) => ({ name: e.name, score: Number(e.score) })).sort((a, b) => a.score - b.score);
    if (!res.ok) {
      el.innerHTML = `<p class="rec-empty">지금은 랭킹을 불러오지 못했어요.</p>`;
      return;
    }
    if (!list.length) {
      el.innerHTML = `<p class="rec-empty">오늘은 아직 기록이 없어요.<br />첫 번째 주인공이 되어 보세요!</p>`;
      return;
    }
    el.innerHTML = list
      .slice(0, 20)
      .map((e, k) => `<div class="rb-row"><span class="rk">${k < 3 ? medalSVG(3 - k, "rk-m") : k + 1}</span><span>${escapeHtml(e.name)}</span><span class="tm">${fmtTime(e.score)}</span></div>`)
      .join("");
    el.querySelectorAll(".rk-m").forEach((m) => {
      m.style.width = "1.6em";
      m.style.height = "1.6em";
    });
  }

  /* ---------------- 하는 법 ---------------- */
  openHowto() {
    this.show("howto");
    const list = $("how-list");
    if (list.dataset.built) return;
    list.dataset.built = "1";
    const cards = [
      ["steer", "방향 전환", "화면을 누른 쪽으로 제트스키가 꺾여요. 가운데에서 멀리 누를수록 세게! 컴퓨터는 ← → 키."],
      ["boost", "BOOST", "번개 구슬을 먹으면 게이지가 차요. 오른쪽 아래 BOOST 를 누르면 슝! 노란 부스터 판은 밟기만 하면 돼요."],
      ["jump", "점프 · PERFECT 착지", "점프대는 노란 화살표 가운데로! 한 바퀴 돌고 착지하면 PERFECT LANDING 부스트."],
      ["short", "지름길", "SHORTCUT 표지판 쪽은 물살이 빨라 기록이 줄지만 바위가 있어요. 안전한 길과 골라 보세요."],
      ["overtake", "추월 · 보너스", "앞 레이서를 제치면 OVERTAKE! 연속으로 제치면 COMBO. GO! 에 맞춰 톡 하면 퍼펙트 스타트."],
      ["medal", "메달 · 랭킹", "코스마다 브론즈 · 실버 · 골드 기록이 있어요. 오늘의 랭킹에 이름을 올려 보세요!"],
    ];
    for (const [k, h, p] of cards) {
      const card = document.createElement("div");
      card.className = "how-card";
      const cv = document.createElement("canvas");
      cv.width = 220;
      cv.height = 220;
      card.appendChild(cv);
      const txt = document.createElement("div");
      txt.innerHTML = `<h3>${h}</h3><p>${p}</p>`;
      card.appendChild(txt);
      list.appendChild(card);
      drawHow(cv.getContext("2d"), k);
    }
    // 게임 소개(SEO) 글은 하는 법 맨 아래
    const about = document.querySelector(".seo-about");
    if (about) list.parentNode.appendChild(about);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** 하는 법 그림 (220x220) */
function drawHow(x, k) {
  const g = x.createLinearGradient(0, 0, 0, 220);
  g.addColorStop(0, "#9edcff");
  g.addColorStop(0.42, "#e2f7ff");
  g.addColorStop(0.43, "#3cc3e6");
  g.addColorStop(1, "#0b7fc0");
  x.fillStyle = g;
  x.fillRect(0, 0, 220, 220);
  x.strokeStyle = "rgba(255,255,255,0.45)";
  x.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.moveTo(20 + i * 30, 110 + i * 14);
    x.quadraticCurveTo(34 + i * 30, 106 + i * 14, 48 + i * 30, 110 + i * 14);
    x.stroke();
  }
  const R = RACERS.jihyeok;
  const pose = (o) => ({ t: 0.5, yaw: 0, roll: 0, lean: 0, crouch: 0, boost: 0, spin: 0, speed: 0.8, air: false, ...o });
  const racer = (cx, cy, s, o) => {
    x.save();
    x.translate(cx, cy);
    x.scale(s, s);
    drawRacer(x, R, pose(o));
    x.restore();
  };
  const arrow = (cx, cy, dir, c = "#ffd23f") => {
    x.save();
    x.translate(cx, cy);
    x.scale(dir, 1);
    x.beginPath();
    x.moveTo(-18, -12);
    x.lineTo(8, -12);
    x.lineTo(8, -24);
    x.lineTo(28, 0);
    x.lineTo(8, 24);
    x.lineTo(8, 12);
    x.lineTo(-18, 12);
    x.closePath();
    x.fillStyle = c;
    x.fill();
    x.lineWidth = 3;
    x.strokeStyle = "#7a2f00";
    x.stroke();
    x.restore();
  };
  const label = (t, y, c = "#fff") => {
    x.font = '24px "Bagel Fat One", sans-serif';
    x.textAlign = "center";
    x.lineWidth = 6;
    x.strokeStyle = "#0a2f5c";
    x.strokeText(t, 110, y);
    x.fillStyle = c;
    x.fillText(t, 110, y);
  };
  if (k === "steer") {
    racer(110, 196, 0.62, { yaw: 0.7, roll: 0.15, lean: 0.1 });
    arrow(186, 120, 1);
    arrow(34, 120, -1, "rgba(255,255,255,0.7)");
  } else if (k === "boost") {
    x.save();
    x.translate(60, 180);
    x.scale(0.62, 0.62);
    P.orb(x);
    x.restore();
    x.beginPath();
    x.arc(160, 150, 44, 0, Math.PI * 2);
    const bg = x.createRadialGradient(150, 136, 4, 160, 150, 46);
    bg.addColorStop(0, "#fff6b0");
    bg.addColorStop(0.5, "#ffd23f");
    bg.addColorStop(1, "#ff8a1a");
    x.fillStyle = bg;
    x.fill();
    x.lineWidth = 5;
    x.strokeStyle = "#ffffff";
    x.stroke();
    label("BOOST", 160, "#fff");
    x.font = '18px "Bagel Fat One", sans-serif';
    label("슝!", 60, "#fff36b");
  } else if (k === "jump") {
    x.save();
    x.translate(110, 214);
    x.scale(0.3, 0.3);
    P.ramp(x);
    x.restore();
    racer(110, 120, 0.42, { roll: 0.6, air: true, crouch: 0.6 });
    label("PERFECT!", 46, "#fff36b");
  } else if (k === "short") {
    x.fillStyle = "#f4dc9b";
    x.beginPath();
    x.moveTo(96, 220);
    x.lineTo(108, 100);
    x.lineTo(112, 100);
    x.lineTo(124, 220);
    x.fill();
    x.save();
    x.translate(110, 120);
    x.scale(0.22, 0.22);
    P.signShort(x);
    x.restore();
    arrow(60, 170, -1, "rgba(255,255,255,0.75)");
    arrow(160, 170, 1);
  } else if (k === "overtake") {
    const r2 = RACERS.sharky;
    x.save();
    x.translate(140, 150);
    x.scale(0.38, 0.38);
    drawRacer(x, r2, pose({}));
    x.restore();
    racer(80, 205, 0.55, { yaw: 0.5, roll: 0.12, boost: 1 });
    label("OVERTAKE!", 48, "#fff");
  } else if (k === "medal") {
    const tmp = document.createElement("div");
    tmp.innerHTML = medalSVG(3);
    const svg = tmp.firstChild;
    const img = new Image();
    img.onload = () => x.drawImage(img, 40, 40, 140, 140);
    let xml = new XMLSerializer().serializeToString(svg);
    if (!/xmlns=/.test(xml)) xml = xml.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    xml = xml.replace("<svg", '<svg width="64" height="64"');
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    label("GOLD!", 206, "#ffd23f");
  }
}

void Save;
