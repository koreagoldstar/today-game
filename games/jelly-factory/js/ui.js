/*
 * 말랑콩떡! 젤리 공장 · 화면 (HTML 버튼 · 창)
 *  창은 쌓아 두고(stack) 닫으면 바로 앞 화면으로 돌아간다. 판 위에 창이 열려 있으면 판은 멈춘다.
 */
import { STAGES } from "./levels.js?v=1";
import { JELLIES, SPECIALS } from "./art.js?v=1";
import { seoulDate } from "./save.js?v=1";
import { dailyDef } from "./game.js?v=1";
import * as E from "./engine.js?v=1";

const $ = (id) => document.getElementById(id);
const num = (n) => Math.round(n).toLocaleString("ko-KR");
const COLOR_NAMES = ["분홍", "노랑", "하늘", "초록", "보라", "주황"];
const TIER_NAMES = ["", "1공장 · 기초 다지기", "2공장 · 장치와 방해물", "3공장 · 달인의 공장"];
const TIER_DESC = ["", "밀기 · 잇기 · 특수 젤리 만들기", "상자 · 꽁꽁 젤리 · 파이프 · 튕김 패드", "여러 목표 · 빠듯한 이동 · 특수 젤리 활용"];
const starsText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const KIND_NAMES = { bolt: "번개 젤리", star: "별 젤리", fluffy: "폭신 젤리", rainbow: "무지개 젤리", any: "특수 젤리" };

/** 도감 목록 */
export const DEX = [
  ...JELLIES.map((J, c) => ({ key: "c" + c, name: J.name, sub: `${COLOR_NAMES[c]} 젤리`, desc: J.desc })),
  { key: "bolt", name: "번개 젤리", sub: "특수 젤리", desc: SPECIALS.bolt.desc },
  { key: "star", name: "별 젤리", sub: "특수 젤리", desc: SPECIALS.star.desc },
  { key: "fluffy", name: "폭신 젤리", sub: "특수 젤리", desc: SPECIALS.fluffy.desc },
  { key: "rainbow", name: "무지개 젤리", sub: "특수 젤리", desc: SPECIALS.rainbow.desc },
  { key: "crate", name: "쿠키 상자", sub: "방해물", desc: "옆에서 젤리를 이으면 깨져요. 쇠 띠를 두른 단단한 상자는 두 번 이어야 해요." },
  { key: "frozen", name: "꽁꽁 젤리", sub: "방해물", desc: "얼음에 갇혀 쿨쿨 자는 젤리. 못 움직이지만 같은 색과 이어지거나 옆에서 이으면 녹아요." },
];

/** 목표 한 줄 */
export function goalLabel(g) {
  switch (g.type) {
    case "score":
      return { icon: "star", short: "점수", long: `점수 ${num(g.n)}점 모으기` };
    case "color":
      return { icon: "c" + g.color, short: `${COLOR_NAMES[g.color]}`, long: `${COLOR_NAMES[g.color]} 젤리 ${g.n}개 없애기` };
    case "crates":
      return { icon: "crate", short: "상자", long: "쿠키 상자 모두 깨기" };
    case "frozen":
      return { icon: "frozen", short: "구출", long: "꽁꽁 젤리 모두 녹이기" };
    case "clear":
      return { icon: "all", short: "모두", long: "색 젤리 모두 없애기", all: true };
    case "special":
      return { icon: g.kind && g.kind !== "any" ? g.kind : "rainbow", short: "만들기", long: `${KIND_NAMES[g.kind || "any"]} ${g.n}개 만들기` };
    case "use":
      return { icon: "bolt", short: "터뜨리기", long: `특수 젤리 ${g.n}번 터뜨리기` };
  }
  return { icon: "c0", short: "?", long: "?" };
}

export class UI {
  constructor(game) {
    this.g = game;
    this.stack = [];
    this.toastQ = [];
    this.lastScore = -1;
    this.bind();
  }
  bind() {
    const g = this.g;
    const on = (id, fn) => $(id).addEventListener("click", (e) => {
      g.audio.unlock();
      fn(e);
    });
    // 첫 화면
    on("stage-btn", () => this.show("stages"));
    on("score-btn", () => {
      this.closeAll();
      g.startScore();
    });
    on("daily-btn", () => this.openDaily());
    on("dex-btn", () => this.show("dex"));
    on("howto-btn", () => this.show("help"));
    on("settings-btn", () => this.show("settings"));
    // 판 아래 버튼
    on("help-btn", () => this.show("help"));
    on("restart-btn", () => this.askRestart());
    on("sound-btn", () => this.toggleSound());
    on("pause-btn", () => this.openPause());
    // 일시정지
    on("pause-resume", () => this.back());
    on("pause-restart", () => {
      this.closeAll();
      g.restart();
    });
    on("pause-menu", () => this.toMenu());
    on("pause-help", () => this.show("help"));
    on("pause-settings", () => this.show("settings"));
    // 다시 하기 확인
    on("confirm-yes", () => {
      this.closeAll();
      g.restart();
    });
    on("confirm-no", () => this.back());
    // 시작 안내
    on("intro-go", () => this.back());
    on("intro-list", () => this.toMenu("stages"));
    // 오늘의 퍼즐 안내
    on("daily-go", () => {
      this.closeAll();
      g.startDaily();
    });
    // 결과
    on("res-next", () => this.resNext());
    on("res-retry", () => {
      this.closeAll();
      g.restart();
    });
    on("res-list", () => this.toMenu(this.resKind === "stage" ? "stages" : null));
    // 설정
    $("set-sound").addEventListener("change", (e) => {
      g.audio.setOn(e.target.checked);
      g.save.setSetting("sound", e.target.checked);
      this.paintSound();
    });
    $("set-reduced").addEventListener("change", (e) => {
      g.save.setSetting("reduced", e.target.checked);
      g.applyReduced();
    });
    for (const b of document.querySelectorAll("[data-back]")) b.addEventListener("click", () => this.back());
    window.addEventListener("keydown", (e) => {
      if (!this.stack.length) return;
      const top = this.stack[this.stack.length - 1];
      if (e.key === "Escape" && top !== "result") {
        // 창만 닫고 끝 (같은 Esc 로 게임의 '멈춤' 이 또 열리지 않게)
        e.preventDefault();
        e.stopImmediatePropagation();
        this.back();
      }
    });
    this.paintSound();
  }

  /* ---------------- 창 쌓기 ---------------- */
  modalOpen() {
    return this.stack.length > 0;
  }
  show(id) {
    const top = this.stack[this.stack.length - 1];
    if (top) $(top).hidden = true;
    $("title").hidden = true;
    this.stack.push(id);
    const el = $(id);
    el.hidden = false;
    this.onShow(id);
    const g = this.g;
    if (g.mode === "play" && g.run && !g.run.over) g.paused = true;
    const f = el.querySelector(".btn-main, button");
    if (f && this.g.keyMode) f.focus({ preventScroll: true });
  }
  back() {
    const id = this.stack.pop();
    if (id) $(id).hidden = true;
    const top = this.stack[this.stack.length - 1];
    if (top) {
      $(top).hidden = false;
      this.onShow(top);
    } else if (this.g.mode === "play") this.g.paused = false;
    else this.showTitle();
  }
  closeAll() {
    for (const id of this.stack) $(id).hidden = true;
    this.stack = [];
    if (this.g.mode === "play") this.g.paused = false;
  }
  toMenu(open = null) {
    this.closeAll();
    this.g.toMenu();
    this.showTitle();
    if (open) this.show(open);
  }
  onShow(id) {
    if (id === "stages") this.renderStages();
    else if (id === "dex") this.renderDex();
    else if (id === "settings") this.renderSettings();
    else if (id === "help") this.renderHelp();
  }

  /* ---------------- 첫 화면 ---------------- */
  showTitle() {
    document.body.classList.add("is-title");
    document.body.classList.remove("is-play");
    $("hud").hidden = true;
    $("bar").hidden = true;
    $("title").hidden = false;
    const s = this.g.save;
    const total = STAGES.length * 3;
    const today = s.dailyOf(seoulDate());
    const parts = [`별 ${s.totalStars()} / ${total}`];
    if (s.data.score.best) parts.push(`점수 도전 최고 ${num(s.data.score.best)}점`);
    parts.push(today && today.stars ? "오늘의 퍼즐 완료 ✓" : "오늘의 퍼즐 아직");
    $("title-best").textContent = parts.join(" · ");
  }
  /** 첫 화면에서 로고와 메뉴 사이 빈 자리 (캔버스에 큰 젤리를 그림) */
  titleGap() {
    const t = $("title");
    if (t.hidden) return null;
    const f = this.g.field.getBoundingClientRect();
    const a = t.querySelector(".logo").getBoundingClientRect();
    const b = t.querySelector(".menu").getBoundingClientRect();
    return { top: a.bottom - f.top, bottom: b.top - f.top, x: (b.left + b.right) / 2 - f.left };
  }
  enterPlay() {
    const g = this.g;
    const run = g.run;
    document.body.classList.remove("is-title");
    document.body.classList.add("is-play");
    $("title").hidden = true;
    $("hud").hidden = false;
    $("bar").hidden = false;
    this.lastScore = -1;
    const k = run.kind;
    $("hud-mode").textContent = k === "stage" ? "STAGE" : k === "daily" ? "오늘" : "점수 도전";
    $("hud-stage").textContent = k === "stage" ? String(run.def.id) : k === "daily" ? run.dailyKey.slice(5).replace("-", "/") : "∞";
    this.hud();
    g.relayout();
    const skip = g.skipIntro;
    g.skipIntro = false;
    if (k !== "score" && !skip) this.openIntro();
    else if (k === "score" && !skip) this.toast(`이동 ${run.limit}번 동안 최고 점수에 도전! 움직일 때마다 새 젤리가 1~2개씩 와요`, 3200);
  }
  /** 위쪽 칸: 목표 · 점수 · 남은 이동 */
  hud(movesOnly = false) {
    const g = this.g;
    const run = g.run;
    if (!run) return;
    const s = run.state;
    const left = Math.max(0, run.limit - s.moves);
    $("hud-moves").textContent = String(left);
    $("hud-moves-box").classList.toggle("warn", left <= 2 && !run.over);
    if (movesOnly) return; // 목표는 연출이 끝난 뒤에
    const box = $("hud-goals");
    if (run.kind === "score") {
      const best = g.save.data.score.best;
      box.innerHTML = `<span class="goal wide"><small>최고</small><b>${num(best)}</b></span><span class="goal wide"><small>최대 무리</small><b>${s.maxGroup}</b></span><span class="goal wide"><small>최대 콤보</small><b>${s.maxCombo}</b></span>`;
      return;
    }
    const html = run.def.goals
      .map((goal) => {
        const lb = goalLabel(goal);
        const p = E.goalProgress(s, goal, run.start);
        const done = p.v >= p.n;
        const val = goal.type === "score" ? `${num(Math.min(p.v, p.n))}/${num(p.n)}` : `${Math.min(p.v, p.n)}/${p.n}`;
        return `<span class="goal${done ? " done" : ""}" title="${lb.long}" aria-label="${lb.long} ${val}${done ? " 완료" : ""}"><img src="${g.icon(lb.icon)}" alt="" />${lb.all ? '<i class="all">모두</i>' : ""}<b>${done ? "✓" : val}</b></span>`;
      })
      .join("");
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  paintScore(n) {
    if (n === this.lastScore) return;
    this.lastScore = n;
    $("hud-score").textContent = num(n);
  }
  /** 보드가 들어갈 자리 (위 · 아래 · 옆 칸을 뺀 나머지) */
  insets() {
    const f = this.g.field.getBoundingClientRect();
    const out = { top: 8, bottom: 8, left: 0, right: 0 };
    const hud = $("hud");
    const bar = $("bar");
    if (!hud.hidden) {
      const r = hud.getBoundingClientRect();
      if (r.width < f.width * 0.5) out.left = r.right - f.left;
      else out.top = r.bottom - f.top;
    }
    if (!bar.hidden) {
      const r = bar.getBoundingClientRect();
      if (r.height > r.width) out.right = f.right - r.left;
      else out.bottom = f.bottom - r.top;
    }
    return out;
  }

  /* ---------------- 알림 ---------------- */
  toast(text, ms = 2200) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => {
      el.hidden = true;
    }, ms);
  }
  flash(text) {
    const el = $("flash");
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => {
      el.hidden = true;
    }, 1300);
  }
  combo(n) {
    const el = $("combo");
    el.textContent = `콤보 ×${n}`;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(this.comboT);
    this.comboT = setTimeout(() => {
      el.hidden = true;
    }, 900);
  }
  discovered(key) {
    const d = DEX.find((x) => x.key === key);
    if (!d) return;
    this.g.audio.play("discover");
    // 처음 들어간 판에서 여러 친구를 만나면 한 번에
    this.toastQ.push(d.name);
    clearTimeout(this.discT);
    this.discT = setTimeout(() => {
      const names = this.toastQ.splice(0);
      if (names.length) this.toast(`도감에 새 친구! ${names.join(" · ")}`, 2600);
    }, 60);
  }

  /* ---------------- 소리 ---------------- */
  toggleSound() {
    const g = this.g;
    const on = !g.audio.on;
    g.audio.setOn(on);
    g.save.setSetting("sound", on);
    this.paintSound();
    if (on) g.audio.play("select");
  }
  paintSound() {
    const on = this.g.audio.on;
    const b = $("sound-btn");
    b.querySelector(".ic").textContent = on ? "🔊" : "🔇";
    b.querySelector("small").textContent = on ? "소리 켬" : "소리 끔";
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("aria-label", on ? "효과음 끄기" : "효과음 켜기");
  }

  /* ---------------- 멈춤 · 다시 하기 ---------------- */
  openPause() {
    const g = this.g;
    if (g.mode !== "play" || !g.run || g.run.over) return;
    if (this.stack.length) return;
    this.show("pause");
  }
  askRestart() {
    const g = this.g;
    if (!g.run) return;
    if (g.run.over) return;
    if (g.run.state.moves === 0 && g.run.kind !== "score") {
      g.skipIntro = true;
      g.restart();
      return;
    }
    if (this.stack.length && this.stack[this.stack.length - 1] === "confirm") return;
    $("confirm-text").textContent = g.run.kind === "score" ? "지금 점수는 기록되지 않아요." : "지금까지 쓴 이동은 없어지고 처음 판으로 돌아가요.";
    this.show("confirm");
  }

  /* ---------------- 스테이지 목록 ---------------- */
  renderStages() {
    const s = this.g.save;
    $("stages-sum").textContent = `모은 별 ${s.totalStars()} / ${STAGES.length * 3}`;
    const box = $("tiers");
    box.innerHTML = "";
    for (const tier of [1, 2, 3]) {
      const sec = document.createElement("section");
      sec.className = "tier t" + tier;
      const list = STAGES.filter((d) => d.tier === tier);
      const got = list.reduce((a, d) => a + s.stars(d.id), 0);
      sec.innerHTML = `<h3>${TIER_NAMES[tier]} <small>★ ${got}/${list.length * 3}</small></h3><p class="tier-desc">${TIER_DESC[tier]}</p>`;
      const grid = document.createElement("div");
      grid.className = "stage-grid";
      for (const d of list) {
        const open = this.unlocked(d.id);
        const st = s.stars(d.id);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "stage-btn" + (st ? " cleared" : "") + (open ? "" : " locked");
        b.disabled = !open;
        b.dataset.id = d.id;
        b.setAttribute("aria-label", `${d.id}번 ${d.name}${open ? (st ? ` 별 ${st}개` : " 아직 안 깸") : " 잠김"}`);
        b.innerHTML = `<b>${d.id}</b><small>${open ? starsText(st) : "🔒"}</small>`;
        b.addEventListener("click", () => {
          this.closeAll();
          this.g.startStage(d.id);
        });
        grid.appendChild(b);
      }
      sec.appendChild(grid);
      box.appendChild(sec);
    }
  }
  unlocked(id) {
    return id === 1 || this.g.save.cleared(id - 1) || this.g.save.cleared(id);
  }

  /* ---------------- 시작 안내 ---------------- */
  goalsHtml(def) {
    return def.goals.map((goal) => {
      const lb = goalLabel(goal);
      return `<li><img src="${this.g.icon(lb.icon)}" alt="" />${lb.long}</li>`;
    }).join("");
  }
  starRule(def) {
    const slack = Math.max(1, def.moves - def.par);
    const s3 = def.par + Math.floor(slack / 3);
    const s2 = def.par + Math.floor((2 * slack) / 3);
    const parts = [`★★★ ${s3}번 이하`];
    if (s2 > s3) parts.push(`★★ ${s2}번 이하`);
    if (def.moves > s2) parts.push(`★ ${def.moves}번 이하`);
    return parts.join(" · ");
  }
  openIntro() {
    const run = this.g.run;
    const def = run.def;
    const daily = run.kind === "daily";
    $("intro-k").textContent = daily ? `오늘의 퍼즐 · ${dateLabel(run.dailyKey)}` : `STAGE ${def.id} · ${TIER_NAMES[def.tier].split(" · ")[0]}`;
    $("intro-h").textContent = def.name;
    $("intro-goals").innerHTML = this.goalsHtml(def);
    $("intro-moves").textContent = `이동 ${def.moves}번 안에`;
    $("intro-stars").textContent = this.starRule(def);
    const tip = $("intro-tip");
    tip.hidden = !def.tip;
    tip.innerHTML = def.tip ? `<b>공장 메모</b> ${def.tip}` : "";
    $("intro-list").hidden = daily;
    const best = daily ? this.g.save.dailyOf(run.dailyKey) : this.g.save.stage(def.id);
    $("intro-best").textContent = best && best.stars ? `내 기록 ${starsText(best.stars)} · 이동 ${best.moves}번` : "";
    this.show("intro");
  }
  openDaily() {
    const g = this.g;
    const date = seoulDate();
    const def = dailyDef(date);
    const rec = g.save.dailyOf(date);
    $("daily-date").textContent = `${dateLabel(date)}의 퍼즐`;
    $("daily-name").textContent = `${def.dailyNo}번 판 · ${def.name}`;
    $("daily-goals").innerHTML = this.goalsHtml(def);
    $("daily-moves").textContent = `이동 ${def.moves}번 안에 · ${this.starRule(def)}`;
    $("daily-status").textContent = rec && rec.stars ? `오늘 성공! ${starsText(rec.stars)} · 이동 ${rec.moves}번 (다시 해서 별을 더 모을 수 있어요)` : rec ? `오늘 ${rec.tries}번 도전했어요` : "아직 도전하지 않았어요";
    const streak = g.save.dailyStreak(date);
    $("daily-streak").textContent = streak ? `연속 성공 ${streak}일째` : "";
    this.show("daily");
  }

  /* ---------------- 결과 ---------------- */
  result({ ok, run, stars, rec, reason }) {
    const s = run.state;
    const def = run.def;
    this.resKind = run.kind;
    this.resRun = run;
    const daily = run.kind === "daily";
    $("res-k").textContent = daily ? `오늘의 퍼즐 · ${dateLabel(run.dailyKey)}` : `STAGE ${def.id} · ${def.name}`;
    $("res-h").textContent = ok ? "공장 가동 성공!" : reason === "stuck" ? "더 움직일 젤리가 없어요" : reason === "hopeless" ? "더는 이을 수 없어요" : "이동을 다 썼어요";
    const st = $("res-stars");
    st.hidden = !ok;
    st.textContent = ok ? starsText(stars) : "";
    st.setAttribute("aria-label", ok ? `별 ${stars}개` : "");
    $("res-score").textContent = num(s.score);
    const goals = def.goals
      .map((goal) => {
        const lb = goalLabel(goal);
        const p = E.goalProgress(s, goal, run.start);
        return `<p class="${p.v >= p.n ? "done" : ""}"><small>${lb.long}</small><b>${p.v >= p.n ? "✓" : `${Math.min(p.v, p.n)}/${p.n}`}</b></p>`;
      })
      .join("");
    $("res-stats").innerHTML = `${goals}<p><small>쓴 이동</small><b>${s.moves} / ${def.moves}</b></p><p><small>최대 콤보</small><b>${s.maxCombo}</b></p>`;
    let note = "";
    if (ok) note = this.starRule(def);
    else if (reason === "hopeless") note = "남은 젤리가 3개가 안 되는 색이 있고, 특수 젤리도 더 만들 수 없어요. 다시 해 봐요!";
    else note = "젤리가 어디서 멈출지 미리 보기를 보며 순서를 바꿔 봐요.";
    if (daily && run.dailyKey !== seoulDate()) note += ` · 자정이 지났지만 이 판은 ${dateLabel(run.dailyKey)} 퍼즐로 기록돼요.`;
    if (ok && rec && rec.moreStars && !rec.first) note = "별 기록을 새로 세웠어요! · " + note;
    $("res-note").textContent = note;
    $("res-rank").innerHTML = "";
    const next = $("res-next");
    if (ok && run.kind === "stage") {
      const nx = STAGES.find((d) => d.id === def.id + 1);
      next.hidden = false;
      next.textContent = nx ? "다음 스테이지" : "공장 목록으로";
    } else next.hidden = true;
    $("res-retry").textContent = "다시 하기";
    $("res-retry").classList.toggle("btn-main", !ok || daily);
    $("res-retry").classList.toggle("btn-sub", ok && !daily);
    $("res-list").textContent = run.kind === "stage" ? "스테이지 목록" : "메뉴로";
    this.show("result");
  }
  resNext() {
    const run = this.resRun;
    if (!run) return;
    const nx = STAGES.find((d) => d.id === run.def.id + 1);
    if (!nx) return this.toMenu("stages");
    this.closeAll();
    this.g.startStage(nx.id);
  }
  scoreResult({ run, newBest, reason }) {
    const s = run.state;
    const best = this.g.save.data.score;
    this.resKind = "score";
    this.resRun = run;
    $("res-k").textContent = "점수 도전";
    $("res-h").textContent = newBest ? "최고 기록이에요!" : reason === "stuck" ? "젤리가 꽉 찼어요" : "이동을 다 썼어요";
    $("res-stars").hidden = true;
    $("res-score").textContent = num(s.score);
    $("res-stats").innerHTML = `<p><small>최고 점수</small><b>${num(best.best)}</b></p><p><small>가장 큰 무리</small><b>${s.maxGroup}개</b></p><p><small>최대 콤보</small><b>${s.maxCombo}</b></p><p><small>만든 특수 젤리</small><b>${s.made.all}개</b></p><p><small>합체</small><b>${s.merges}번</b></p><p><small>쓴 이동</small><b>${s.moves}</b></p>`;
    $("res-note").textContent = "기록은 이 기기의 브라우저에만 저장돼요.";
    $("res-next").hidden = true;
    $("res-retry").textContent = "다시 도전";
    $("res-retry").classList.add("btn-main");
    $("res-retry").classList.remove("btn-sub");
    $("res-list").textContent = "메뉴로";
    this.show("result");
    const slot = $("res-rank");
    slot.innerHTML = "";
    if (window.TodayGameRank && s.score > 0) {
      try {
        TodayGameRank.mount({ gameId: "jelly-factory", gameTitle: "말랑콩떡! 젤리 공장", formParent: slot });
        TodayGameRank.open(Math.round(s.score), { label: `${num(s.score)}점` });
      } catch (e) {
        console.warn("랭킹 연결 실패", e);
      }
    }
  }

  /* ---------------- 도감 ---------------- */
  renderDex() {
    const s = this.g.save;
    const grid = $("dex-grid");
    const found = DEX.filter((d) => s.found(d.key)).length;
    $("dex-sum").textContent = `만난 친구 ${found} / ${DEX.length}`;
    grid.innerHTML = "";
    const detail = $("dex-detail");
    detail.hidden = true;
    for (const d of DEX) {
      const when = s.found(d.key);
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dex-item" + (when ? "" : " unknown");
      b.innerHTML = `<img src="${this.g.icon(d.key)}" alt="" /><b>${when ? d.name : "???"}</b>`;
      b.setAttribute("aria-label", when ? d.name : "아직 못 만난 친구");
      b.addEventListener("click", () => {
        detail.hidden = false;
        detail.innerHTML = when
          ? `<img src="${this.g.icon(d.key)}" alt="" /><div><h3>${d.name} <small>${d.sub}</small></h3><p>${d.desc}</p><p class="when">처음 만난 날 ${when}</p></div>`
          : `<div><h3>??? <small>${d.sub}</small></h3><p>아직 못 만났어요. 공장을 더 돌려 보세요!</p></div>`;
      });
      li.appendChild(b);
      grid.appendChild(li);
    }
  }

  /* ---------------- 도움말 ---------------- */
  renderHelp() {
    if (this.helpDone) return;
    this.helpDone = true;
    const ic = (k) => `<img src="${this.g.icon(k)}" alt="" />`;
    $("help-body").innerHTML = `
      <h3>움직이기</h3>
      <ul class="how">
        <li><b>누르고 밀기</b> 젤리를 손가락(마우스)으로 누른 채 위 · 아래 · 왼쪽 · 오른쪽으로 밀어요.</li>
        <li><b>눌러서 고르기</b> 젤리를 톡 누르면 네 방향으로 <b>어디서 멈출지</b>(점 · 흐린 젤리 · 몇 칸) 보여요. 가고 싶은 쪽 칸을 누르면 움직여요.</li>
        <li><b>키보드</b> <kbd>←↑→↓</kbd> 로 칸 고르기 → <kbd>Enter</kbd> 로 젤리 고르기 → 방향키로 밀기 · <kbd>Esc</kbd> 취소 · <kbd>P</kbd> 멈춤 · <kbd>R</kbd> 다시 하기</li>
      </ul>
      <h3>규칙</h3>
      <ul class="tips">
        <li>젤리는 <b>벽 · 보드 끝 · 다른 것에 닿을 때까지 쭉 미끄러져요</b>. 한 칸도 못 가는 쪽으로는 움직이지 않고 이동 수도 그대로예요.</li>
        <li>멈춘 젤리와 <b>같은 색이 위아래 양옆으로 3개 이상</b> 이어지면 하나로 합쳐지며 사라져요.</li>
        <li>한 번 움직일 때마다 무언가를 없애면 <b>콤보</b>가 올라 점수가 커져요(최대 2.5배). 못 없애면 콤보는 0으로.</li>
        <li>정해진 <b>이동 수 안에 목표</b>를 모두 이루면 성공! 적은 이동으로 깰수록 별을 더 받아요.</li>
      </ul>
      <h3>특수 젤리 <small>(만든 뒤 밀면 멈춘 자리에서 터져요)</small></h3>
      <ul class="icons">
        <li>${ic("bolt")}<p><b>번개</b> 4개를 <b>한 줄</b>로 이으면. 가로 줄이면 가로, 세로 줄이면 세로 한 줄을 모두 없애요.</p></li>
        <li>${ic("star")}<p><b>별</b> 4개를 <b>T자</b>로 이으면. 멈춘 자리 둘레 3×3 을 없애요.</p></li>
        <li>${ic("fluffy")}<p><b>폭신</b> 4개를 <b>ㄱ자 · S자</b>로 이으면. 둘레 5×5 의 쿠키 상자를 부수고 꽁꽁 젤리를 녹여요(젤리는 그대로).</p></li>
        <li>${ic("rainbow")}<p><b>무지개</b> <b>5개 이상</b> 이으면. 밀어서 부딪힌 젤리와 같은 색을 모두 없애요. 다른 효과에 맞으면 가장 많은 색을 없애요.</p></li>
      </ul>
      <p class="note">특수 젤리가 다른 특수 젤리를 맞히면 그것도 터져요(연쇄). 한 번 움직일 때 같은 특수 젤리는 한 번만 터져서 끝없이 이어지지 않아요.</p>
      <h3>공장 장치</h3>
      <ul class="icons">
        <li>${ic("wall")}<p><b>기계 블록</b> 못 지나가요. 젤리를 멈추게 해 줘요.</p></li>
        <li>${ic("sticky")}<p><b>끈적판</b> 들어오면 그 자리에 딱 멈춰요.</p></li>
        <li>${ic("pad")}<p><b>튕김 패드</b> 밟으면 화살표 쪽으로 방향이 꺾여요.</p></li>
        <li>${ic("pipe")}<p><b>파이프</b> 같은 숫자 파이프로 쏙 나와 같은 방향으로 계속 가요. 나오는 곳이 막혀 있으면 들어가는 파이프 위에 멈춰요.</p></li>
      </ul>
      <h3>방해물</h3>
      <ul class="icons">
        <li>${ic("crate")}<p><b>쿠키 상자</b> 못 움직여요. 바로 옆에서 젤리를 이으면 깨져요.</p></li>
        <li>${ic("crate2")}<p><b>단단한 상자</b> 두 번 이어야 깨져요(한 번 이으면 보통 상자가 돼요).</p></li>
        <li>${ic("frozen")}<p><b>꽁꽁 젤리</b> 못 움직여요. 같은 색끼리 이을 때 함께 이어지고, 바로 옆에서 이으면 녹아서 움직일 수 있게 돼요.</p></li>
      </ul>`;
  }

  /* ---------------- 설정 ---------------- */
  renderSettings() {
    const g = this.g;
    $("set-sound").checked = g.audio.on;
    $("set-reduced").checked = g.reduced;
    $("save-note").textContent = g.save.ok ? "기록(별 · 최고 점수 · 도감 · 오늘의 퍼즐)은 이 기기의 브라우저에만 저장돼요. 다른 기기와 연결되지 않아요." : "이 브라우저는 기록을 저장할 수 없어요 · 이번 방문 동안만 기억해요.";
  }
}

function dateLabel(date) {
  const [, m, d] = date.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}
