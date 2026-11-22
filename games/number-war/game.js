/* 숫자전쟁 : NUMBER WAR — 화면 · 조작 · 기록 (규칙 · 점수는 engine.js 하나에서만 계산)
 * ?test=1 : window.__nwTest · ?today=YYYY-MM-DD 로 날짜 바꾸기
 */
(() => {
  "use strict";
  const E = window.NW;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const TEST = params.get("test") === "1";

  /* ---------- 날짜 (서울) ---------- */
  function seoulDay(d = new Date()) {
    try {
      const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
      const g = (t) => p.find((x) => x.type === t).value;
      return `${g("year")}-${g("month")}-${g("day")}`;
    } catch (_) {
      return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    }
  }
  const TODAY = TEST && /^\d{4}-\d{2}-\d{2}$/.test(params.get("today") || "") ? params.get("today") : seoulDay();
  const dayNum = (k) => Math.floor(Date.UTC(...k.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))) / 86400000);
  const addDays = (k, n) => new Date((dayNum(k) + n) * 86400000).toISOString().slice(0, 10);
  function weekId(key) {
    const [y, m, d] = key.split("-").map(Number);
    const u = new Date(Date.UTC(y, m - 1, d));
    const dn = u.getUTCDay() || 7;
    u.setUTCDate(u.getUTCDate() + 4 - dn);
    const ys = new Date(Date.UTC(u.getUTCFullYear(), 0, 1));
    return `${u.getUTCFullYear()}-W${String(Math.ceil(((u - ys) / 86400000 + 1) / 7)).padStart(2, "0")}`;
  }

  /* ---------- 저장 (버전 · 깨진 값 복구) ---------- */
  const KEY = "tg-numberwar";
  const blank = () => ({ v: 1, best: {}, plays: 0, maxCombo: 0, recent: [], daily: {}, streak: { last: "", count: 0, best: 0 }, vs: {}, tutorial: false, sound: true, name: "", progress: null });
  let DB = null;
  function db() {
    if (DB) return DB;
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || "null");
      DB = o && o.v === 1 ? { ...blank(), ...o } : blank();
      for (const k of ["best", "daily", "vs"]) if (!DB[k] || typeof DB[k] !== "object") DB[k] = {};
      if (!Array.isArray(DB.recent)) DB.recent = [];
    } catch (_) {
      DB = blank();
    }
    return DB;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db()));
    } catch (_) {}
  }

  /* ---------- 효과음 (Web Audio · 누르기 전엔 소리 없음) ---------- */
  let AC = null;
  function tone(f, at, dur, type = "sine", vol = 0.1, slide = 0) {
    if (db().sound === false) return;
    if (window.TodayAudio && TodayAudio.isMuted && TodayAudio.isMuted()) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      const t = AC.currentTime + at;
      const o = AC.createOscillator();
      const g = AC.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(AC.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (_) {}
  }
  const SFX = {
    select: () => tone(660, 0, 0.07, "triangle", 0.07),
    move: () => tone(330, 0, 0.1, "triangle", 0.06, -80),
    combine: (c) => [0, 1, 2].forEach((k) => tone(523 * Math.pow(1.122, k + Math.min(c, 6)), k * 0.05, 0.18, "sine", 0.08)),
    combo: () => [784, 988, 1175, 1568].forEach((f, k) => tone(f, k * 0.05, 0.22, "triangle", 0.06)),
    special: () => { tone(220, 0, 0.3, "sawtooth", 0.05, 400); tone(880, 0.08, 0.3, "sine", 0.07); },
    bomb: () => { tone(90, 0, 0.5, "sawtooth", 0.12, -40); tone(60, 0.05, 0.6, "sine", 0.15); },
    deny: () => tone(200, 0, 0.12, "square", 0.04, -40),
    over: () => [523, 440, 349].forEach((f, k) => tone(f, k * 0.14, 0.4, "triangle", 0.07)),
    best: () => [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, k * 0.09, 0.4, "triangle", 0.08)),
    tick: () => tone(1200, 0, 0.04, "square", 0.03),
  };

  /* ---------- 공용 UI ---------- */
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  let onModalClose = null;
  function openModal(html, onClose) {
    $("modal-body").innerHTML = html;
    $("modal").hidden = false;
    onModalClose = onClose || null;
    setTimeout(() => $("modal-x").focus(), 30);
  }
  function closeModal() {
    if ($("modal").hidden) return;
    $("modal").hidden = true;
    const cb = onModalClose;
    onModalClose = null;
    if (cb) cb();
  }
  $("modal-x").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => e.target === $("modal") && closeModal());
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmt = (n) => Number(n || 0).toLocaleString();

  /* ---------- 타일 그림 ---------- */
  const ICON = {
    wild: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 L24.5 15.5 L37 20 L24.5 24.5 L20 37 L15.5 24.5 L3 20 L15.5 15.5Z" fill="currentColor"/></svg>`,
    bomb: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="18" cy="23" r="12" fill="currentColor"/><path d="M26 13 Q30 6 35 8" stroke="currentColor" stroke-width="3" fill="none"/><circle cx="35" cy="7" r="3" fill="#ffcf5a"/><circle cx="14" cy="19" r="3" fill="#fff" opacity=".35"/></svg>`,
    lock: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="18" width="22" height="17" rx="3" fill="currentColor"/><path d="M13 18 V13 a7 7 0 0 1 14 0 V18" stroke="currentColor" stroke-width="3.6" fill="none"/></svg>`,
    chain: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="14" width="17" height="12" rx="6" stroke="currentColor" stroke-width="3.4" fill="none"/><rect x="18" y="14" width="17" height="12" rx="6" stroke="currentColor" stroke-width="3.4" fill="none"/></svg>`,
  };
  const SPECIAL_NAME = { wild: "와일드", bomb: "폭탄", double: "더블", chain: "연쇄" };
  function tileHtml(t) {
    if (!t) return "";
    const cls = ["nw-tile", t.s ? `sp-${t.s}` : `v${t.v}`, t.lock ? "is-lock" : ""].join(" ");
    let inner;
    if (t.s === "wild") inner = `<span class="nw-ico">${ICON.wild}</span><small>와일드</small>`;
    else if (t.s === "bomb") inner = `<span class="nw-ico">${ICON.bomb}</span><small>폭탄</small>`;
    else inner = `<b>${t.v}</b>${t.s === "double" ? `<em class="nw-badge">×2</em>` : t.s === "chain" ? `<em class="nw-badge nw-badge-chain">${ICON.chain}</em>` : ""}`;
    return `<div class="${cls} ${t.s === "double" || t.s === "chain" ? `v${t.v} has-${t.s}` : ""}">${inner}${t.lock ? `<span class="nw-lock">${ICON.lock}</span>` : ""}</div>`;
  }

  /* ---------- 상태 ---------- */
  let G = null;
  let MODE = "";
  let sel = -1;
  let busy = false;
  let vsLevel = "normal";
  let timer = 0;
  let endAt = 0;
  let lastComboAt = 0;
  let tut = null;
  let focusI = 12;

  /* ---------- 메뉴 ---------- */
  const MODE_CARDS = [
    { id: "daily", title: "오늘의 숫자전쟁", desc: "모두가 같은 판 · 30턴 · 오늘의 순위", tag: "DAILY" },
    { id: "classic", title: "클래식", desc: "5×5 · 30턴 · 최고 점수 도전", tag: "기본" },
    { id: "time", title: "시간 제한", desc: "120초 · 빠른 판단 보너스", tag: "TIME" },
    { id: "strategy", title: "고난도 전략", desc: "18턴 · 새 타일 1개 · 잠금 3개 · ×1.25", tag: "HARD" },
    { id: "vs", title: "AI 대결", desc: "한 판을 번갈아 두고 점수로 승부", tag: "VS" },
  ];
  function renderMenu() {
    const d = db();
    $("menu-date").textContent = TODAY;
    const prog = d.progress;
    $("modes").innerHTML = MODE_CARDS.map((m) => {
      const best = d.best[m.id];
      const cont = prog && prog.mode === m.id && (m.id !== "daily" || prog.day === TODAY);
      const daily = m.id === "daily" ? d.daily[TODAY] : null;
      return `<div class="nw-mode nw-mode-${m.id}"><button type="button" class="nw-mode-main" data-mode="${m.id}"><span class="nw-mode-tag">${m.tag}</span><b>${m.title}</b><span class="nw-mode-desc">${m.desc}</span><span class="nw-mode-best">${m.id === "vs" ? vsRecord() : best ? `최고 ${fmt(best)}점` : "기록 없음"}${daily ? ` · 오늘 ${fmt(daily.score)}점` : ""}</span>${cont ? `<span class="nw-mode-cont">이어하기</span>` : ""}</button>${m.id === "vs" ? `<div class="nw-levels" role="radiogroup" aria-label="AI 난이도">${["easy", "normal", "hard"].map((l) => `<button type="button" class="nw-level${vsLevel === l ? " is-on" : ""}" data-level="${l}" role="radio" aria-checked="${vsLevel === l}">${l.toUpperCase()}</button>`).join("")}</div>` : ""}</div>`;
    }).join("");
    for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => startMode(b.dataset.mode));
    for (const b of document.querySelectorAll("[data-level]")) {
      b.addEventListener("click", () => {
        vsLevel = b.dataset.level;
        renderMenu();
      });
    }
    // 미션
    const ms = E.dailyMissions(TODAY);
    const done = (d.daily[TODAY] && d.daily[TODAY].missions) || [];
    $("mis-count").textContent = `${done.length} / 3`;
    $("missions").innerHTML = ms.map((m) => `<li class="${done.includes(m.id) ? "is-done" : ""}"><span class="nw-check">${done.includes(m.id) ? "✓" : ""}</span>${esc(m.text)}</li>`).join("");
    // 기록
    const streak = d.streak.last === TODAY || d.streak.last === addDays(TODAY, -1) ? d.streak.count : 0;
    const wk = weekId(TODAY);
    const week = Object.entries(d.daily).reduce((s, [k, r]) => (weekId(k) === wk ? s + (r.score || 0) : s), 0);
    $("stats").innerHTML = [
      ["플레이", `${d.plays}판`],
      ["최고 콤보", `${d.maxCombo}연속`],
      ["연속 참여", `${streak}일 (최고 ${d.streak.best}일)`],
      ["이번 주 누적", `${fmt(week)}점`],
    ]
      .map(([a, b]) => `<div class="nw-stat"><span>${a}</span><b>${b}</b></div>`)
      .join("");
    $("recent").innerHTML = d.recent.length
      ? d.recent.slice(0, 6).map((r) => `<li><span>${esc(r.day)}</span><span>${esc(E.MODES[r.mode] ? E.MODES[r.mode].name : r.mode)}</span><b>${fmt(r.score)}점</b></li>`).join("")
      : `<li class="nw-muted">아직 기록이 없어요.</li>`;
    loadRank();
  }
  function vsRecord() {
    const r = db().vs[vsLevel] || { w: 0, l: 0, d: 0 };
    return `${vsLevel.toUpperCase()} ${r.w}승 ${r.l}패${r.d ? ` ${r.d}무` : ""}`;
  }
  async function loadRank() {
    const ol = $("rank-list");
    if (!window.TodayScores) return;
    const r = await TodayScores.fetchScores("number-war-daily", 5, "day");
    if (!r.ok) {
      ol.innerHTML = `<li class="nw-muted">순위를 불러오지 못했어요.</li>`;
      return;
    }
    ol.innerHTML = r.scores.length
      ? r.scores.map((s, i) => `<li><span class="nw-rank">${i + 1}</span><span class="nw-rank-name">${esc(s.name)}</span><b>${fmt(s.score)}점</b></li>`).join("")
      : `<li class="nw-muted">아직 오늘 등록된 기록이 없어요. 첫 번째가 되어 보세요!</li>`;
  }

  /* ---------- 게임 시작 ---------- */
  function startMode(mode, opts = {}) {
    closeModal();
    const d = db();
    if (!d.tutorial && !opts.skipTut) return startTutorial(mode);
    const prog = d.progress;
    MODE = mode;
    sel = -1;
    busy = false;
    lastComboAt = 0;
    if (!opts.fresh && prog && prog.mode === mode && (mode !== "daily" || prog.day === TODAY) && mode !== "time") {
      G = E.clone(prog.g);
      vsLevel = prog.vsLevel || vsLevel;
      toast("이어서 해요");
    } else {
      const seed = mode === "daily" ? TODAY : `${Date.now()}-${Math.random()}`;
      G = E.newGame(mode, seed, { vs: mode === "vs" });
    }
    showGame();
    if (mode === "time") startTimer();
    persist();
    if (mode === "vs" && G.current === 1) aiTurn();
  }
  function showGame() {
    $("menu").hidden = true;
    $("game").hidden = false;
    $("hud-mode").innerHTML = `<b>${esc(E.MODES[MODE].name)}</b>${MODE === "vs" ? `<span>AI ${vsLevel.toUpperCase()}</span>` : MODE === "daily" ? `<span>${TODAY}</span>` : ""}`;
    $("timebar").hidden = MODE !== "time";
    $("legend").innerHTML = `<span><i class="lg-ten"></i>텐 합 10</span><span><i class="lg-twin"></i>쌍둥이 같은 수</span><span><i class="lg-step"></i>계단 ±1</span><span><i class="lg-mult"></i>배수</span>`;
    render();
    window.scrollTo(0, 0);
  }
  function persist() {
    const d = db();
    if (G && !G.over && MODE !== "time" && !tut) d.progress = { mode: MODE, day: TODAY, g: E.clone(G), vsLevel };
    else if (G && G.over && d.progress && d.progress.mode === MODE) d.progress = null;
    save();
  }
  function backToMenu() {
    clearInterval(timer);
    timer = 0;
    tut = null;
    G = null;
    closeModal();
    $("game").hidden = true;
    $("menu").hidden = false;
    renderMenu();
    window.scrollTo(0, 0);
  }
  $("quit-btn").addEventListener("click", () => {
    if (tut) return backToMenu();
    if (G && !G.over && MODE === "time") {
      openModal(`<h2 class="nw-modal-h" id="modal-h">그만할까요?</h2><p>시간 제한 모드는 이어 할 수 없어요. 지금까지의 점수로 끝냅니다.</p><div class="nw-row"><button type="button" class="nw-btn" id="q-no">계속</button><button type="button" class="nw-btn nw-btn-gold" id="q-yes">끝내기</button></div>`);
      $("q-no").addEventListener("click", closeModal);
      $("q-yes").addEventListener("click", () => {
        closeModal();
        E.finish(G, "quit");
        endGame();
      });
      return;
    }
    persist();
    if (G && !G.over) toast("저장했어요. 메뉴에서 이어할 수 있어요.");
    backToMenu();
  });

  /* ---------- 판 그리기 ---------- */
  function render(marks = {}) {
    const b = $("board");
    const hadFocus = b.contains(document.activeElement);
    const acts = sel >= 0 ? E.actionsFrom(G, sel) : [];
    const myTurn = !(MODE === "vs" && G.current === 1) && !busy && !G.over;
    let html = "";
    for (let i = 0; i < 25; i += 1) {
      const t = G.cells[i];
      const a = acts.find((x) => x.to === i && x.type !== "bomb");
      const usable = t && E.actionsFrom(G, i).length > 0;
      const cls = ["nw-cell"];
      if (i === sel) cls.push("is-sel");
      if (a && a.type === "combine") cls.push("is-target", `r-${a.rule}`);
      if (a && a.type === "move") cls.push("is-move");
      if (t && sel < 0 && !usable) cls.push("is-dead");
      if (marks.pop && marks.pop.includes(i)) cls.push("pop");
      if (marks.spawn && marks.spawn.includes(i)) cls.push("spawn");
      if (tut && tut.need && (i === tut.need.from || (sel === tut.need.from && i === tut.need.to))) cls.push("is-guide");
      let label = "";
      if (a && a.type === "combine") {
        const p = E.preview(G, a);
        label = `<span class="nw-tag">${E.RULE_NAME[p.rule]} +${p.points}</span>`;
      } else if (a && a.type === "move") label = `<span class="nw-tag nw-tag-move">이동</span>`;
      else if (i === sel && t && t.s === "bomb") label = `<span class="nw-tag nw-tag-bomb">한 번 더 누르면 폭발</span>`;
      const name = t ? (t.s === "wild" || t.s === "bomb" ? SPECIAL_NAME[t.s] : `${t.v}${t.s ? ` ${SPECIAL_NAME[t.s]}` : ""}${t.lock ? " 잠김" : ""}`) : "빈칸";
      html += `<button type="button" class="${cls.join(" ")}" data-i="${i}" tabindex="${i === focusI ? 0 : -1}" aria-label="${Math.floor(i / 5) + 1}행 ${(i % 5) + 1}열 ${name}" ${myTurn ? "" : "aria-disabled=\"true\""}>${tileHtml(t)}${label}</button>`;
    }
    b.innerHTML = html;
    if (hadFocus) b.querySelector(`[data-i="${focusI}"]`).focus(); // 키보드로 두는 중이면 초점 유지
    b.classList.toggle("is-wait", !myTurn);
    renderScore();
    if (!tut) renderHint(acts);
  }
  function renderScore() {
    const tl = MODE === "time" ? `<div class="nw-sb"><span>남은 시간</span><b id="time-left">${Math.max(0, Math.ceil((endAt - Date.now()) / 1000))}초</b></div>` : `<div class="nw-sb"><span>턴</span><b>${G.players ? Math.min(G.turn, G.maxTurns) : G.turn} / ${G.maxTurns}</b></div>`;
    if (G.players) {
      const [p, a] = G.players;
      $("scorebar").innerHTML = `<div class="nw-sb nw-sb-me${G.current === 0 ? " is-turn" : ""}"><span>나</span><b>${fmt(p.score)}</b><small>콤보 ${p.combo}</small></div>${tl}<div class="nw-sb nw-sb-ai${G.current === 1 ? " is-turn" : ""}"><span>AI ${vsLevel.toUpperCase()}</span><b>${fmt(a.score)}</b><small>콤보 ${a.combo}</small></div>`;
    } else {
      $("scorebar").innerHTML = `<div class="nw-sb nw-sb-score"><span>점수</span><b id="score-num">${fmt(G.score)}</b></div>${tl}<div class="nw-sb"><span>콤보</span><b class="${G.combo >= 2 ? "is-hot" : ""}">${G.combo}연속 ×${E.comboMult(Math.max(1, G.combo))}</b></div>`;
    }
  }
  function renderHint(acts) {
    const h = $("hint");
    if (G.over) return (h.textContent = "게임이 끝났어요");
    if (MODE === "vs" && G.current === 1) return (h.textContent = "AI 가 생각하는 중…");
    if (sel < 0) {
      const n = E.allActions(G).filter((a) => a.type !== "move").length;
      h.innerHTML = `타일을 고르세요 · 지금 가능한 조합 <b>${n}</b>개${G.combo || (G.players && G.players[0].combo) ? " · 이동하면 콤보가 끊겨요" : ""}`;
      return;
    }
    const c = acts.filter((a) => a.type === "combine").length;
    const t = G.cells[sel];
    h.innerHTML = t.s === "bomb" ? "다시 누르면 둘레 8칸을 터뜨려요 · 빈칸으로 옮길 수도 있어요" : c ? `금색 칸과 조합할 수 있어요 (${c}곳) · 파란 칸은 이동` : "붙어 있는 조합 상대가 없어요 · 빈칸으로 옮길 수 있어요";
  }

  /* ---------- 조작 ---------- */
  $("board").addEventListener("click", (e) => {
    const cell = e.target.closest(".nw-cell");
    if (!cell) return;
    tap(Number(cell.dataset.i));
  });
  $("board").addEventListener("keydown", (e) => {
    const k = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -5, ArrowDown: 5 }[e.key];
    if (k) {
      e.preventDefault();
      const n = focusI + k;
      if (n < 0 || n > 24 || (Math.abs(k) === 1 && Math.floor(n / 5) !== Math.floor(focusI / 5))) return;
      focusI = n;
      render();
      $("board").querySelector(`[data-i="${focusI}"]`).focus();
    } else if (e.key === "Escape") {
      sel = -1;
      render();
    }
  });
  function tap(i) {
    if (!G || G.over || busy) return;
    if (MODE === "vs" && G.current === 1) return;
    focusI = i;
    const t = G.cells[i];
    if (sel >= 0) {
      if (i === sel) {
        if (t && t.s === "bomb") return act({ type: "bomb", from: i, to: i });
        sel = -1;
        return render();
      }
      const a = E.actionsFrom(G, sel).find((x) => x.to === i && x.type !== "bomb");
      if (a) return act(a);
    }
    if (!t) {
      sel = -1;
      return render();
    }
    if (tut && tut.need && i !== tut.need.from) {
      SFX.deny();
      return toast("빛나는 타일을 눌러 보세요");
    }
    if (!E.actionsFrom(G, i).length) {
      SFX.deny();
      toast(t.lock ? "잠긴 타일이에요. 옆칸에서 조합하면 풀려요" : "이 타일은 지금 쓸 수 없어요");
      return;
    }
    sel = i;
    SFX.select();
    render();
  }
  function act(a) {
    if (tut && tut.need && (a.from !== tut.need.from || a.to !== tut.need.to)) {
      SFX.deny();
      return toast("빛나는 타일끼리 조합해 보세요");
    }
    const before = G.cells.map((c) => !!c);
    const target = a.to;
    const r = E.apply(G, a, { noSpawn: !!tut });
    if (!r.ok) {
      SFX.deny();
      return;
    }
    sel = -1;
    let extra = 0;
    if (a.type !== "move") {
      if (MODE === "time" && lastComboAt && Date.now() - lastComboAt < 3000) extra = E.quick(G);
      lastComboAt = Date.now();
    }
    // 효과
    const cleared = r.changed.filter((j) => before[j] && !G.cells[j]);
    if (a.type === "move") SFX.move();
    else if (a.type === "bomb") SFX.bomb();
    else {
      SFX.combine(r.combo);
      if (r.dbl > 1 || r.rule === "nova") SFX.special();
    }
    if (r.combo >= 3 && a.type !== "move") setTimeout(SFX.combo, 120);
    render({ pop: G.cells[target] ? [target] : [], spawn: r.spawned });
    for (const j of cleared) burst(j, a.type === "bomb" ? "bomb" : r.rule);
    if (r.points) floatText(target, `+${r.points}${extra ? ` +${extra}` : ""}`, r.dbl > 1);
    if (a.type !== "move" && r.combo >= 2) comboBanner(r.combo, r.mult);
    if (r.unlocked.length) toast("잠금 타일이 풀렸어요");
    persist();
    if (tut) return tutNext();
    if (G.over) return setTimeout(endGame, 650);
    if (MODE === "vs" && G.current === 1) aiTurn();
  }

  /* ---------- 효과 ---------- */
  function cellRect(i) {
    const c = $("board").querySelector(`[data-i="${i}"]`);
    const w = $("fx").getBoundingClientRect();
    const r = c.getBoundingClientRect();
    return { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height / 2, w: r.width };
  }
  function floatText(i, text, gold) {
    const p = cellRect(i);
    const el = document.createElement("span");
    el.className = `nw-float${gold ? " is-gold" : ""}`;
    el.textContent = text;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    $("fx").appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
  function burst(i, kind) {
    const p = cellRect(i);
    const el = document.createElement("span");
    el.className = `nw-burst k-${kind}`;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.width = el.style.height = `${p.w}px`;
    $("fx").appendChild(el);
    setTimeout(() => el.remove(), 600);
  }
  function comboBanner(c, m) {
    const el = $("combo");
    el.innerHTML = `<b>${c} COMBO</b><span>×${m}</span>`;
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
  }

  /* ---------- 시간 제한 ---------- */
  function startTimer() {
    endAt = Date.now() + E.MODES.time.seconds * 1000;
    clearInterval(timer);
    let lastSec = 999;
    timer = setInterval(() => {
      if (!G || G.over) return clearInterval(timer);
      const left = Math.max(0, endAt - Date.now());
      const sec = Math.ceil(left / 1000);
      const f = $("timefill");
      f.style.width = `${(left / (E.MODES.time.seconds * 1000)) * 100}%`;
      $("timebar").classList.toggle("is-low", sec <= 20);
      const tl = $("time-left");
      if (tl) tl.textContent = `${sec}초`;
      if (sec !== lastSec && sec <= 10 && sec > 0) SFX.tick();
      lastSec = sec;
      if (left <= 0) {
        clearInterval(timer);
        E.finish(G, "time");
        sel = -1;
        endGame();
      }
    }, 100);
  }

  /* ---------- AI ---------- */
  function aiTurn() {
    busy = true;
    render();
    const wait = (ms) => new Promise((r) => setTimeout(r, TEST ? 20 : ms));
    (async () => {
      await wait(450);
      const a = E.aiChoose(G, vsLevel);
      if (!a) {
        busy = false;
        return;
      }
      sel = a.from;
      busy = false;
      render();
      busy = true;
      await wait(420);
      busy = false;
      act(a);
    })();
  }

  /* ---------- 끝 ---------- */
  function endGame() {
    clearInterval(timer);
    const d = db();
    d.progress = null;
    const isVs = !!G.players;
    const score = isVs ? G.players[0].score : G.final;
    const prevBest = d.best[MODE] || 0;
    const newBest = !isVs && score > prevBest;
    if (!isVs && newBest) d.best[MODE] = score;
    d.plays += 1;
    d.maxCombo = Math.max(d.maxCombo, isVs ? G.players[0].maxCombo : G.maxCombo);
    d.recent.unshift({ day: TODAY, mode: MODE, score });
    d.recent = d.recent.slice(0, 10);
    let vsText = "";
    if (isVs) {
      const [p, a] = G.players;
      const r = (d.vs[vsLevel] = d.vs[vsLevel] || { w: 0, l: 0, d: 0 });
      if (p.score > a.score) r.w += 1;
      else if (p.score < a.score) r.l += 1;
      else r.d += 1;
      vsText = p.score > a.score ? "승리!" : p.score < a.score ? "패배" : "무승부";
    }
    // 오늘의 숫자전쟁: 미션 · 최고 점수 · 연속 참여
    let missionHtml = "";
    if (MODE === "daily") {
      const rec = (d.daily[TODAY] = d.daily[TODAY] || { score: 0, missions: [], plays: 0 });
      rec.plays += 1;
      rec.score = Math.max(rec.score, score);
      const ms = E.dailyMissions(TODAY);
      for (const m of ms) if (m.test(G) && !rec.missions.includes(m.id)) rec.missions.push(m.id);
      missionHtml = `<h3 class="nw-sub">오늘의 미션</h3><ul class="nw-missions">${ms.map((m) => `<li class="${rec.missions.includes(m.id) ? "is-done" : ""}"><span class="nw-check">${rec.missions.includes(m.id) ? "✓" : ""}</span>${esc(m.text)}</li>`).join("")}</ul>`;
      const st = d.streak;
      if (st.last !== TODAY) {
        st.count = st.last === addDays(TODAY, -1) ? st.count + 1 : 1;
        st.last = TODAY;
        st.best = Math.max(st.best, st.count);
      }
    }
    save();
    if (newBest || (isVs && vsText === "승리!")) SFX.best();
    else SFX.over();
    const b = G.bonus || { board: 0, clear: 0, diff: 0 };
    const reason = { turns: "턴을 모두 썼어요", stuck: "더 둘 곳이 없어요", time: "시간 종료", quit: "그만두었어요" }[G.reason] || "";
    const rankable = MODE === "daily" || MODE === "classic";
    openModal(
      `<div class="nw-result"><p class="nw-result-reason">${reason}</p><h2 class="nw-modal-h" id="modal-h">${isVs ? vsText : newBest ? "최고 기록!" : "게임 종료"}</h2>
      ${isVs ? `<div class="nw-vs-final"><div><span>나</span><b>${fmt(G.players[0].score)}</b></div><i>VS</i><div><span>AI ${vsLevel.toUpperCase()}</span><b>${fmt(G.players[1].score)}</b></div></div>` : `<p class="nw-final"><b id="final-num">${fmt(score)}</b>점</p>
      <dl class="nw-break"><div><dt>조합 점수</dt><dd>${fmt(G.score)}</dd></div><div><dt>보드 정리 (빈칸 ×8)</dt><dd>+${fmt(b.board)}</dd></div>${b.clear ? `<div><dt>완전 정리 (남은 턴 ×30)</dt><dd>+${fmt(b.clear)}</dd></div>` : ""}${b.diff ? `<div><dt>난이도 보너스 ×1.25</dt><dd>+${fmt(b.diff)}</dd></div>` : ""}${G.stats.quick ? `<div><dt>빠른 판단 (${G.stats.quick}회, 포함)</dt><dd>+${fmt(G.stats.quick * E.QUICK_BONUS)}</dd></div>` : ""}<div><dt>최고 콤보</dt><dd>${G.maxCombo}연속</dd></div><div><dt>내 최고 기록</dt><dd>${fmt(Math.max(prevBest, score))}</dd></div></dl>`}
      <p class="nw-tally">텐 ${G.stats.ten} · 쌍둥이 ${G.stats.twin} · 계단 ${G.stats.step} · 배수 ${G.stats.mult} · 노바 ${G.stats.nova} · 폭탄 ${G.stats.bomb} · 이동 ${G.stats.moves}</p>
      ${missionHtml}
      ${rankable ? `<form class="nw-rankform" id="rank-form"><input id="rank-name" maxlength="8" placeholder="이름 2~8자" value="${esc(d.name || "")}" autocomplete="nickname"/><button type="submit" class="nw-btn nw-btn-gold">${MODE === "daily" ? "오늘의 순위 등록" : "랭킹 등록"}</button></form><p class="nw-muted nw-small" id="rank-msg"></p>` : ""}
      <div class="nw-row"><button type="button" class="nw-btn" id="r-menu">메뉴</button><button type="button" class="nw-btn nw-btn-gold" id="r-again">${MODE === "daily" ? "다시 도전" : "한 판 더"}</button></div></div>`,
      () => {},
    );
    $("r-menu").addEventListener("click", backToMenu);
    $("r-again").addEventListener("click", () => startMode(MODE, { fresh: true, skipTut: true }));
    const form = $("rank-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = $("rank-name").value.trim();
        const msg = $("rank-msg");
        if (name.length < 2 || name.length > 8) return (msg.textContent = "이름은 2~8자로 적어 주세요");
        d.name = name;
        save();
        if (!window.TodayScores) return (msg.textContent = "랭킹 모듈을 불러오지 못했어요");
        msg.textContent = "등록 중…";
        const res = await TodayScores.submitScore(MODE === "daily" ? "number-war-daily" : "number-war", name, score);
        if (res.ok) {
          msg.textContent = `등록 완료! 오늘 ${res.rankDay || res.rank || "-"}위${res.rankWeek ? ` · 이번 주 ${res.rankWeek}위` : ""}`;
          form.remove();
        } else msg.textContent = "등록하지 못했어요. 잠시 뒤 다시 해 주세요.";
      });
    }
  }

  /* ---------- 튜토리얼 (실제 판에서 직접) ---------- */
  const TUT = [
    { need: { from: 11, to: 12 }, text: "<b>텐</b> · 3 을 누르고 옆의 7 을 누르세요. 합이 10 이면 둘 다 사라져요." },
    { need: { from: 6, to: 7 }, text: "<b>쌍둥이</b> · 4 와 4 처럼 같은 수는 하나로 합쳐져 한 단계 커져요(→5). 연달아 조합하면 콤보!" },
    { need: { from: 16, to: 17 }, text: "<b>계단</b> · 5 와 6 처럼 이어진 수는 고른 타일만 사라지고 상대는 남아요. 3연속 콤보면 ×1.5!" },
    { need: { from: 18, to: 17 }, text: "<b>배수</b> · 3 을 골라 6 에 붙이면 6÷3 = 2 가 남아요. 큰 수를 작게 만들어 다음 조합을 준비할 수 있어요." },
  ];
  function startTutorial(after) {
    tut = { step: 0, after };
    MODE = "classic";
    G = E.newGame("classic", "tutorial");
    G.cells = new Array(25).fill(null);
    const put = { 11: 3, 12: 7, 6: 4, 7: 4, 16: 5, 17: 6, 18: 3, 0: 8, 24: 1, 20: 2 };
    for (const [i, v] of Object.entries(put)) G.cells[i] = { v, s: null };
    G.maxTurns = 99;
    sel = -1;
    showGame();
    $("hud-mode").innerHTML = "<b>튜토리얼</b><span>1분이면 충분해요</span>";
    tutShow();
  }
  function tutShow() {
    const s = TUT[tut.step];
    tut.need = s.need;
    render();
    $("hint").innerHTML = `<span class="nw-step">${tut.step + 1} / ${TUT.length}</span> ${s.text}`;
  }
  function tutNext() {
    tut.step += 1;
    if (tut.step < TUT.length) return setTimeout(tutShow, 350);
    tut.need = null;
    db().tutorial = true;
    save();
    render();
    $("hint").innerHTML = "<b>4연속 콤보 ×2!</b> 조합 없이 이동만 하면 콤보가 끊겨요.";
    setTimeout(() => {
      openModal(`<h2 class="nw-modal-h" id="modal-h">준비 완료!</h2><p>네 가지 조합과 콤보를 익혔어요. 특수 타일은 판에서 만나면 이렇게 쓰세요.</p>${specialsHtml()}<button type="button" class="nw-btn nw-btn-gold nw-wide" id="tut-go">${esc(E.MODES[tut.after].name)} 시작</button>`);
      $("tut-go").addEventListener("click", () => {
        const m = tut.after;
        tut = null;
        startMode(m, { skipTut: true, fresh: true });
      });
    }, 700);
  }
  function specialsHtml() {
    return `<ul class="nw-sp-list"><li>${tileHtml({ v: 0, s: "wild" })}<p><b>와일드</b> 붙어 있는 아무 숫자와 쌍둥이가 돼요.</p></li><li>${tileHtml({ v: 0, s: "bomb" })}<p><b>폭탄</b> 두 번 누르면 둘레 8칸을 지워요. 5×지운 숫자 합 + 20점.</p></li><li>${tileHtml({ v: 6, s: "double" })}<p><b>더블</b> 이 타일이 들어간 조합은 점수 ×2.</p></li><li>${tileHtml({ v: 4, s: "chain" })}<p><b>연쇄</b> 이 타일로 조합하면 콤보가 한 단계 더 올라요.</p></li><li>${tileHtml({ v: 7, s: null, lock: true })}<p><b>잠금</b> 쓸 수 없어요. 바로 옆칸에서 조합이 일어나면 풀려요.</p></li></ul>`;
  }

  /* ---------- 규칙 ---------- */
  function showRules() {
    openModal(`<h2 class="nw-modal-h" id="modal-h">규칙</h2>
      <p>타일을 고르고 <b>상하좌우로 붙은</b> 타일을 고르면 조합돼요. 겹치면 위쪽 규칙이 먼저예요.</p>
      <table class="nw-rules"><tr><th>텐</th><td>합이 10 (3·7, 5·5)</td><td>둘 다 사라짐</td><td>40 + 3×큰 수</td></tr><tr><th>쌍둥이</th><td>같은 수 (4·4)</td><td>한 단계 커짐 → 5</td><td>10×수</td></tr><tr><th>노바</th><td>9·9</td><td>둘 다 사라짐</td><td>150</td></tr><tr><th>계단</th><td>±1 (5·6)</td><td>고른 타일만 사라짐</td><td>4×합</td></tr><tr><th>배수</th><td>2 이상, 배수 (3·9)</td><td>몫이 남음 → 3</td><td>6×큰 수</td></tr></table>
      <p><b>이동</b> 빈칸으로 옮기기 · 점수 없음 · 콤보가 끊겨요.<br/><b>콤보</b> 연달아 조합한 턴 수: 2연속 ×1.2, 3연속 ×1.5, 4연속 ×2, 그 뒤 +0.25 (최대 ×3).<br/><b>새 타일</b> 매 턴 빈칸에 새 타일이 생겨요. 판이 가득 차고 조합도 없으면 끝나요.<br/><b>끝 보너스</b> 빈칸 ×8점, 판을 다 비우면 남은 턴 ×30점.</p>
      ${specialsHtml()}
      <button type="button" class="nw-btn nw-wide" id="rules-tut">튜토리얼 다시 하기</button>`);
    $("rules-tut").addEventListener("click", () => {
      closeModal();
      startTutorial(MODE || "classic");
    });
  }
  $("rules-btn").addEventListener("click", showRules);
  $("rules-btn2").addEventListener("click", showRules);

  if (TEST) {
    window.__nwTest = {
      get g() {
        return G;
      },
      set g(v) {
        G = v;
      },
      get mode() {
        return MODE;
      },
      today: TODAY,
      tap,
      startMode,
      render: () => render(),
      endNow: () => {
        E.finish(G, "turns");
        endGame();
      },
      setEnd: (ms) => (endAt = Date.now() + ms),
    };
  }
  renderMenu();
})();
