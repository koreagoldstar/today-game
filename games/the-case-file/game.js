/* 오늘의 사건파일 — 게임 화면 (6단계: 개요 · 현장 · 증거 · 심문 · 보고서 · 결과)
 * 사건 데이터는 cases/case-XXX.js (화면 코드와 분리) · 기록은 store.js · 그림은 art.js · 소리는 sfx.js
 * ?test=1 : 모든 사건 열림 · window.__cfTest · ?today=YYYY-MM-DD 로 날짜 바꾸기
 */
(() => {
  "use strict";
  const A = window.CFArt;
  const S = window.CFStore;
  const X = window.CFSfx;
  const CAT = window.CF_CATALOG;
  const esc = A.esc;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const TEST = params.get("test") === "1";
  const TODAY = TEST && /^\d{4}-\d{2}-\d{2}$/.test(params.get("today") || "") ? params.get("today") : S.seoulDay();
  const GAME_ID = "the-case-file";
  const WEEK_ID = "the-case-file-week";
  const STEP_NAMES = ["사건 개요", "현장 조사", "증거 분석", "용의자 심문", "최종 추리", "사건 해결"];
  const TYPE_LABEL = { physical: "물리적 증거", cctv: "CCTV · 영상", call: "통화 기록", access: "출입 기록", document: "문서", witness: "진술", digital: "디지털 기록", time: "시간 분석" };
  const DIFF_LABEL = { NORMAL: "NORMAL", HARD: "HARD", EXPERT: "EXPERT" };
  const HINT_COST = [40, 60, 100];
  const GRADE_NAME = { SSS: "전설의 명탐정", SS: "천재 탐정", S: "베테랑 탐정", A: "유능한 탐정", B: "수습 탐정", C: "초보 탐정" };

  /* ---------- 사건 불러오기 (지연 로딩) ---------- */
  const REG = {};
  window.CaseFile = { register: (c) => (REG[c.id] = c) };
  function loadCase(id) {
    if (REG[id]) return Promise.resolve(REG[id]);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `cases/case-${id.slice(1)}.js?v=1`;
      s.onload = () => (REG[id] ? resolve(REG[id]) : reject(new Error("no case")));
      s.onerror = () => reject(new Error("load fail"));
      document.head.appendChild(s);
    });
  }
  const todayIndex = S.caseIndexFor(TODAY, CAT.length);
  const todayMeta = CAT[todayIndex];
  const daysSinceEpoch = S.dayNum(TODAY) - S.dayNum(S.EPOCH);
  const isReleased = (i) => TEST || daysSinceEpoch >= CAT.length || i <= daysSinceEpoch;

  /* ---------- 공용 UI ---------- */
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), 2400);
  }
  function flash(kind) {
    const f = $("flash");
    f.className = `cf-flash ${kind}`;
    void f.offsetWidth;
    f.classList.add("on");
  }
  let modalOnClose = null;
  function openModal(html, onClose) {
    $("modal-body").innerHTML = html;
    $("modal").hidden = false;
    document.body.classList.add("cf-noscroll");
    modalOnClose = onClose || null;
    const box = $("modal").querySelector(".cf-modal-box");
    box.scrollTop = 0;
    setTimeout(() => $("modal-x").focus(), 30);
  }
  function closeModal() {
    if ($("modal").hidden) return;
    $("modal").hidden = true;
    document.body.classList.remove("cf-noscroll");
    const cb = modalOnClose;
    modalOnClose = null;
    if (cb) cb();
  }
  $("modal-x").addEventListener("click", closeModal);
  $("modal").addEventListener("click", (e) => {
    if (e.target === $("modal")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  function show(screen) {
    for (const id of ["home", "archive", "records", "game"]) $(id).hidden = id !== screen;
    window.scrollTo(0, 0);
  }
  for (const b of document.querySelectorAll("[data-go]")) b.addEventListener("click", () => goHome());
  const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  const fmtDay = (d) => {
    const [y, m, dd] = d.split("-").map(Number);
    const w = "일월화수목금토"[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
    return `${y}. ${m}. ${dd}. (${w})`;
  };

  /* ---------- 설정 ---------- */
  function applySettings() {
    const st = S.load();
    X.setOn(st.sound !== false);
    document.body.classList.toggle("cf-calm", !!st.calm || matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  applySettings();
  $("settings-btn").addEventListener("click", () => {
    const st = S.load();
    openModal(`<h2 class="cf-modal-h" id="modal-h">설정</h2>
      <label class="cf-toggle"><input type="checkbox" id="set-sound" ${st.sound !== false ? "checked" : ""}/> 효과음</label>
      <label class="cf-toggle"><input type="checkbox" id="set-calm" ${st.calm ? "checked" : ""}/> 움직임 줄이기 (저사양 기기용)</label>
      <p class="cf-muted">사이트 전체 소리는 화면 위 소리 버튼으로도 끌 수 있어요.</p>
      <button type="button" class="cf-btn" id="set-tutorial">조사 방법 다시 보기</button>`);
    $("set-sound").addEventListener("change", (e) => {
      S.set("sound", e.target.checked);
      applySettings();
      X.play("tap");
    });
    $("set-calm").addEventListener("change", (e) => {
      S.set("calm", e.target.checked);
      applySettings();
    });
    $("set-tutorial").addEventListener("click", () => {
      S.set("tutorial", false);
      toast("다음 현장 조사 때 조사 방법을 다시 보여 드려요");
    });
  });

  /* ---------- 메인 ---------- */
  function renderHome() {
    const st = S.load();
    const stat = S.stats();
    $("home-date").textContent = fmtDay(TODAY);
    $("home-rank").textContent = `${S.rank(stat.total)} · 누적 ${stat.total.toLocaleString()}점`;
    const done = st.daily[TODAY];
    const prog = st.progress && st.progress.day === TODAY && st.progress.caseId === todayMeta.id && st.progress.mode === "daily";
    $("home-status").textContent = done ? `오늘의 사건 해결 · ${done.grade}` : prog ? "오늘의 사건 조사 중" : "오늘의 사건 미해결";
    $("home-status").classList.toggle("is-done", !!done);
    $("today-code").textContent = todayMeta.code;
    $("today-title").textContent = todayMeta.title;
    $("today-place").textContent = todayMeta.place;
    $("today-diff").textContent = DIFF_LABEL[todayMeta.difficulty];
    $("today-diff").className = `cf-diff cf-diff-${todayMeta.difficulty.toLowerCase()}`;
    $("today-min").textContent = `${todayMeta.minutes}분`;
    $("today-teaser").textContent = `"${todayMeta.teaser}"`;
    $("start-btn").textContent = done ? "다시 조사하기 (기록 갱신)" : prog ? "이어서 조사하기" : "사건 조사 시작";
    const rec = st.cases;
    const best = Object.values(rec).reduce((m, c) => Math.max(m, c.best || 0), 0);
    const bestCase = Object.entries(rec).find(([, c]) => c.best === best && best > 0);
    $("dash-best").textContent = best ? `${best}점 · ${bestCase ? rec[bestCase[0]].bestGrade : ""}` : "아직 없음";
    $("dash-streak").textContent = `${S.streakNow(TODAY)}일 (최고 ${st.streak.best}일)`;
    $("dash-week").textContent = `${S.weekTotal(TODAY).toLocaleString()}점`;
    loadCase(todayMeta.id)
      .then((c) => ($("today-art").innerHTML = A.scene(c.scene)))
      .catch(() => ($("today-art").innerHTML = ""));
    loadBoards();
  }
  async function loadBoards() {
    if (!window.TodayScores) return;
    const [day, week] = await Promise.all([TodayScores.fetchScores(GAME_ID, 50, "day"), TodayScores.fetchScores(WEEK_ID, 5, "week")]);
    $("dash-today").textContent = day.ok ? (day.scores.length ? `${day.scores.length}명 등록 · 최고 ${day.scores[0].score}점` : "아직 등록 없음") : "랭킹을 불러오지 못했어요";
    const ol = $("weekly-board");
    ol.innerHTML = "";
    if (!week.ok || !week.scores.length) {
      ol.innerHTML = `<li class="cf-muted">${week.ok ? "이번 주 첫 추리왕이 되어 보세요. 오늘의 사건을 풀고 이름을 남기면 이번 주 점수가 합산돼요." : "랭킹을 불러오지 못했어요."}</li>`;
      return;
    }
    week.scores.slice(0, 5).forEach((r, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="cf-board-rank">${i + 1}</span><span class="cf-board-name">${esc(r.name)}</span><span class="cf-board-score">${Number(r.score).toLocaleString()}점</span>`;
      ol.appendChild(li);
    });
  }
  function goHome() {
    closeModal();
    stopTimer();
    show("home");
    renderHome();
  }
  $("start-btn").addEventListener("click", () => {
    const st = S.load();
    const prog = st.progress;
    if (prog && prog.caseId === todayMeta.id && prog.day === TODAY) return startCase(todayMeta.id, prog.mode, prog);
    startCase(todayMeta.id, st.daily[TODAY] ? "replay" : "daily");
  });
  $("archive-btn").addEventListener("click", renderArchive);
  $("records-btn").addEventListener("click", renderRecords);

  /* ---------- 보관함 · 기록 ---------- */
  function renderArchive() {
    const st = S.load();
    const ul = $("archive-list");
    ul.innerHTML = "";
    CAT.forEach((m, i) => {
      const rec = st.cases[m.id];
      const open = isReleased(i);
      const li = document.createElement("li");
      li.className = `cf-arch${open ? "" : " is-locked"}${rec && rec.solvedDay ? " is-solved" : ""}`;
      const until = S.dayNum(S.releaseDay(i)) - S.dayNum(TODAY);
      li.innerHTML = `<div class="cf-arch-head"><span class="cf-arch-code">${m.code}</span><span class="cf-diff cf-diff-${m.difficulty.toLowerCase()}">${m.difficulty}</span></div>
        <h3 class="cf-arch-title">${open ? esc(m.title) : "봉인된 사건"}</h3>
        <p class="cf-arch-meta">${open ? esc(m.place) : `${until}일 뒤 공개`}</p>
        <p class="cf-arch-rec">${rec ? `${rec.solvedDay ? `해결 ${rec.solvedDay}` : "미해결"} · 최고 ${rec.best}점 · ${rec.bestGrade || "-"}` : open ? "아직 조사하지 않음" : ""}</p>
        ${open ? `<button type="button" class="cf-btn cf-btn-small" data-case="${m.id}">${rec ? "다시 조사" : "조사 시작"}</button>` : ""}`;
      ul.appendChild(li);
    });
    for (const b of ul.querySelectorAll("[data-case]")) {
      b.addEventListener("click", () => {
        const id = b.dataset.case;
        const st2 = S.load();
        const isToday = id === todayMeta.id && !st2.daily[TODAY];
        const prog = st2.progress && st2.progress.caseId === id && st2.progress.day === TODAY ? st2.progress : null;
        startCase(id, isToday ? "daily" : "replay", prog);
      });
    }
    show("archive");
  }
  function renderRecords() {
    const st = S.load();
    const s = S.stats();
    $("records-dash").innerHTML = [
      ["탐정 칭호", S.rank(s.total)],
      ["해결한 사건", `${s.solved} / ${CAT.length}`],
      ["오늘의 사건 평균", s.days ? `${s.avg}점` : "-"],
      ["최고 점수", s.best ? `${s.best}점` : "-"],
      ["연속 참여", `${S.streakNow(TODAY)}일`],
      ["최장 연속", `${st.streak.best}일`],
    ]
      .map(([a, b]) => `<div class="cf-stat"><p class="cf-stat-label">${a}</p><p class="cf-stat-value">${esc(b)}</p></div>`)
      .join("");
    const days = Object.entries(st.daily).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14);
    $("records-days").innerHTML = days.length
      ? days
          .map(([d, r]) => {
            const m = CAT.find((c) => c.id === r.caseId) || { code: "", title: "" };
            return `<li><span>${esc(d)}</span><span>${esc(m.code)} ${esc(m.title)}</span><b>${r.score}점 · ${esc(r.grade)}</b></li>`;
          })
          .join("")
      : `<li class="cf-muted">아직 기록이 없어요. 오늘의 사건부터 풀어 보세요.</li>`;
    show("records");
  }

  /* ---------- 게임 상태 ---------- */
  let D = null; // 사건 데이터
  let G = null; // 진행 상태
  let timerId = 0;
  const ev = (id) => D.evidence.find((e) => e.id === id);
  const sus = (id) => D.suspects.find((s) => s.id === id);
  const elapsed = () => Math.floor((G.elapsed || 0) + (G.resumeAt ? (Date.now() - G.resumeAt) / 1000 : 0));
  function save() {
    if (!G || G.submitted) return;
    const snap = { ...G, elapsed: elapsed(), resumeAt: 0 };
    S.setProgress(snap);
  }
  function startTimer() {
    stopTimer();
    G.resumeAt = Date.now();
    const tick = () => ($("g-timer").textContent = mmss(elapsed()));
    tick();
    timerId = setInterval(tick, 1000);
  }
  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = 0;
    if (G && G.resumeAt) {
      G.elapsed = elapsed();
      G.resumeAt = 0;
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (!G || G.submitted || $("game").hidden) return;
    if (document.hidden) {
      stopTimer();
      save();
    } else startTimer();
  });

  async function startCase(id, mode, prog) {
    closeModal();
    try {
      D = await loadCase(id);
    } catch (_) {
      toast("사건 파일을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
      return;
    }
    const valid = prog && prog.caseId === id && Array.isArray(prog.collected);
    G = valid
      ? { ...prog, resumeAt: 0 }
      : { caseId: id, mode, day: TODAY, step: 1, maxStep: 1, collected: [], examined: [], links: [], contras: [], talk: {}, hints: 0, report: {}, elapsed: 0, submitted: false, active: D.suspects[0].id };
    G.talk = G.talk || {};
    G.report = G.report || {};
    if (G.mode === "daily" && S.load().daily[TODAY]) G.mode = "replay";
    $("g-code").textContent = D.code;
    $("g-title").textContent = D.title;
    show("game");
    if (!valid) X.play("open");
    startTimer();
    go(G.step || 1, true);
    save();
    if (G.mode === "replay" && !valid) toast("다시 조사하기: 최고 기록만 갱신되고 처음 기록은 그대로예요");
  }
  $("leave-btn").addEventListener("click", () => {
    if (G && !G.submitted) {
      save();
      toast("조사 내용을 저장했어요. 이어서 할 수 있어요.");
    }
    goHome();
  });

  /* ---------- 단계 ---------- */
  function renderSteps() {
    const nav = $("steps");
    nav.innerHTML = STEP_NAMES.map((n, i) => {
      const k = i + 1;
      const can = G.submitted ? k === 6 : k <= G.maxStep && k <= 5;
      return `<button type="button" class="cf-step${k === G.step ? " is-on" : ""}${k < G.maxStep || G.submitted ? " is-done" : ""}" data-step="${k}" ${can ? "" : "disabled"} aria-current="${k === G.step ? "step" : "false"}"><span class="cf-step-n">${k}</span><span class="cf-step-t">${n}</span></button>`;
    }).join("");
    for (const b of nav.querySelectorAll("[data-step]")) b.addEventListener("click", () => go(Number(b.dataset.step)));
  }
  function go(step, silent) {
    G.step = step;
    G.maxStep = Math.max(G.maxStep || 1, step);
    renderSteps();
    const v = $("view");
    v.className = `cf-view cf-view-${step}`;
    v.innerHTML = "";
    [null, viewBrief, viewScene, viewEvidence, viewInterrogate, viewReport, viewResult][step]();
    if (!silent) X.play("page");
    window.scrollTo(0, 0);
    $("hint-btn").hidden = !!G.submitted;
    save();
  }
  const hasEv = (id) => G.collected.includes(id);
  function collect(ids, quiet) {
    const got = [];
    for (const id of ids) {
      if (!hasEv(id)) {
        G.collected.push(id);
        got.push(id);
      }
    }
    if (got.length && !quiet) {
      const key = got.some((id) => ev(id).key || ev(id).derived);
      X.play(key ? "key" : "found");
      toast(`증거함에 추가: ${got.map((id) => ev(id).name).join(", ")}`);
    }
    save();
    return got;
  }

  /* STEP 1 개요 */
  function viewBrief() {
    const v = $("view");
    v.innerHTML = `<article class="cf-file">
      <div class="cf-file-tab">${esc(D.code)} · 사건 개요</div>
      <div class="cf-file-inner">
        <p class="cf-stamp-small">CONFIDENTIAL</p>
        <h2 class="cf-file-title">${esc(D.title)}</h2>
        <dl class="cf-meta cf-meta-file"><div><dt>장소</dt><dd>${esc(D.place)}</dd></div><div><dt>일시</dt><dd>${esc(D.when)}</dd></div><div><dt>난이도</dt><dd><span class="cf-diff cf-diff-${D.difficulty.toLowerCase()}">${D.difficulty}</span> · 약 ${D.minutes}분</dd></div></dl>
        <div class="cf-story">${D.brief.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        <h3 class="cf-sub">주요 인물</h3>
        <ul class="cf-people">${D.suspects.map((s) => `<li class="cf-person"><div class="cf-person-pic">${A.portrait(s.look)}</div><div><b>${esc(s.name)}</b> <span class="cf-muted">${s.age}세</span><p>${esc(s.job)}</p><p class="cf-muted">${esc(s.rel)}</p></div></li>`).join("")}</ul>
        <div class="cf-problem"><span>핵심 문제</span><p>${esc(D.problem)}</p></div>
        <button type="button" class="cf-btn cf-btn-gold cf-btn-wide" id="to-scene">현장 조사 시작</button>
      </div></article>`;
    $("to-scene").addEventListener("click", () => go(2));
  }

  /* STEP 2 현장 조사 */
  const keyEvidence = () => D.evidence.filter((e) => e.key && !e.derived);
  function viewScene() {
    const v = $("view");
    const keys = keyEvidence();
    const gotKeys = keys.filter((e) => hasEv(e.id)).length;
    v.innerHTML = `<div class="cf-scene-wrap"><div class="cf-scene" id="scene">${A.scene(D.scene)}${D.scene.points
      .map((p) => {
        const done = G.examined.includes(p.id) && (!p.deeper || G.examined.includes(`${p.id}+`));
        return `<button type="button" class="cf-spot${done ? " is-done" : G.examined.includes(p.id) ? " is-part" : ""}" style="left:${p.x}%;top:${p.y}%" data-point="${p.id}" aria-label="${esc(p.name)} 조사"><span class="cf-spot-ring"></span></button>`;
      })
      .join("")}</div><p class="cf-scene-cap">${esc(D.scene.title)} · 빛나는 곳을 눌러 조사하세요</p></div>
      <div class="cf-scene-side">
        <div class="cf-progress"><span>핵심 증거</span><b>${gotKeys} / ${keys.length}</b><div class="cf-bar"><i style="width:${(gotKeys / keys.length) * 100}%"></i></div></div>
        <ul class="cf-pointlist">${D.scene.points
          .map((p) => {
            const done = G.examined.includes(p.id) && (!p.deeper || G.examined.includes(`${p.id}+`));
            return `<li><button type="button" class="cf-pointrow${done ? " is-done" : ""}" data-point="${p.id}"><span class="cf-check">${done ? "✓" : G.examined.includes(p.id) ? "…" : ""}</span>${esc(p.name)}</button></li>`;
          })
          .join("")}</ul>
        <button type="button" class="cf-btn cf-btn-gold cf-btn-wide" id="to-ev" ${gotKeys < keys.length ? "disabled" : ""}>${gotKeys < keys.length ? `핵심 증거가 ${keys.length - gotKeys}개 더 남았어요` : "증거 분석으로"}</button>
        <p class="cf-muted cf-small">모든 곳을 조사하지 않아도 핵심 증거만 모이면 다음으로 갈 수 있어요. 나중에 현장으로 돌아올 수도 있어요.</p>
      </div>`;
    for (const b of v.querySelectorAll("[data-point]")) b.addEventListener("click", () => openPoint(b.dataset.point));
    $("to-ev").addEventListener("click", () => go(3));
    if (!S.load().tutorial) {
      S.set("tutorial", true);
      openModal(`<h2 class="cf-modal-h" id="modal-h">조사 방법</h2><ol class="cf-howto"><li><b>현장 조사</b> 빛나는 지점을 눌러 살펴보고, 증거를 수집하세요. '자세히' 조사할 수 있는 곳도 있어요.</li><li><b>증거 분석</b> 증거 두 개를 골라 연결하면 새로운 사실이 드러나기도 해요.</li><li><b>용의자 심문</b> 질문하고, 증거를 제시해 진술의 모순을 찾으세요.</li><li><b>최종 추리</b> 범인 · 동기 · 결정적 증거 · 시간 · 거짓 진술을 골라 보고서를 내세요. 한 번 내면 바꿀 수 없어요.</li></ol><p class="cf-muted">정확도가 점수의 대부분이에요. 힌트를 쓰면 점수가 깎여요.</p><button type="button" class="cf-btn cf-btn-gold cf-btn-wide" id="howto-ok">조사 시작</button>`);
      $("howto-ok").addEventListener("click", closeModal);
    }
  }
  function evMini(id) {
    const e = ev(id);
    return `<div class="cf-evmini${e.key ? " is-key" : ""}"><span class="cf-type">${TYPE_LABEL[e.type] || "증거"}</span><b>${esc(e.name)}</b><span class="cf-muted">${esc(e.desc)}</span></div>`;
  }
  function openPoint(pid) {
    const p = D.scene.points.find((x) => x.id === pid);
    X.play("tap");
    if (!G.examined.includes(pid)) G.examined.push(pid);
    const render = () => {
      const deeperOpen = G.examined.includes(`${pid}+`);
      const gives = (p.gives || []).map((id) => (hasEv(id) ? `${evMini(id)}<p class="cf-got">증거함에 있음</p>` : `${evMini(id)}<button type="button" class="cf-btn cf-btn-gold cf-btn-small" data-take="${id}">증거 수집</button>`)).join("");
      const dGives = p.deeper && deeperOpen ? (p.deeper.gives || []).map((id) => (hasEv(id) ? `${evMini(id)}<p class="cf-got">증거함에 있음</p>` : `${evMini(id)}<button type="button" class="cf-btn cf-btn-gold cf-btn-small" data-take="${id}">증거 수집</button>`)).join("") : "";
      openModal(`<div class="cf-inspect"><div class="cf-inspect-art">${A.prop(p.prop)}</div><div class="cf-inspect-body"><p class="cf-type">조사 대상</p><h2 class="cf-modal-h" id="modal-h">${esc(p.name)}</h2><p>${esc(p.desc)}</p><p class="cf-fact"><span>발견한 사실</span>${esc(p.fact)}</p>${gives}${!(p.gives || []).length && !p.deeper ? `<p class="cf-muted">이곳에서는 수집할 증거가 없다.</p>` : ""}
        ${p.deeper ? (deeperOpen ? `<div class="cf-deeper"><p class="cf-type">자세히 조사</p><p>${esc(p.deeper.desc)}</p><p class="cf-fact"><span>발견한 사실</span>${esc(p.deeper.fact)}</p>${dGives}</div>` : `<button type="button" class="cf-btn cf-btn-wide" id="deeper-btn">${esc(p.deeper.label)}</button>`) : ""}</div></div>`, () => {
        if (G.step === 2) go(2, true);
      });
      for (const b of $("modal-body").querySelectorAll("[data-take]")) {
        b.addEventListener("click", () => {
          collect([b.dataset.take]);
          render();
        });
      }
      const db = $("deeper-btn");
      if (db) {
        db.addEventListener("click", () => {
          G.examined.push(`${pid}+`);
          X.play("page");
          save();
          render();
        });
      }
    };
    render();
    save();
  }

  /* STEP 3 증거 분석 */
  let pick = [];
  function viewEvidence() {
    const v = $("view");
    pick = [];
    const found = G.links.map((k) => D.links[k]).filter(Boolean);
    v.innerHTML = `<div class="cf-evhead"><h2 class="cf-view-h">증거함 <span class="cf-muted">${G.collected.length}개</span></h2><p class="cf-muted">카드를 눌러 자세히 보세요. 두 장을 골라 <b>단서 연결</b>을 하면 새로운 사실이 드러날 수 있어요.</p></div>
      <div class="cf-linkbar" id="linkbar"><span id="link-state">연결할 증거 두 개를 고르세요</span><button type="button" class="cf-btn cf-btn-gold cf-btn-small" id="link-btn" disabled>단서 연결</button></div>
      <div class="cf-evgrid" id="evgrid">${G.collected.map((id) => evCard(id)).join("")}</div>
      <section class="cf-panel"><h3 class="cf-panel-h">연결로 밝혀낸 사실 <span class="cf-muted">${found.length}개</span></h3>${found.length ? `<ul class="cf-linklist">${found.map((l) => `<li><b>${esc(l.title)}</b><p>${esc(l.text)}</p></li>`).join("")}</ul>` : `<p class="cf-muted">아직 없어요. 시간 · 장소 · 사람이 겹치는 증거끼리 이어 보세요.</p>`}</section>
      <div class="cf-navrow"><button type="button" class="cf-btn" id="back-scene">현장으로</button><button type="button" class="cf-btn cf-btn-gold" id="to-int">용의자 심문으로</button></div>`;
    for (const c of v.querySelectorAll(".cf-evcard")) {
      c.querySelector(".cf-evcard-open").addEventListener("click", () => openEvidence(c.dataset.ev));
      c.querySelector(".cf-evcard-pick").addEventListener("click", () => togglePick(c.dataset.ev));
    }
    $("link-btn").addEventListener("click", tryLink);
    $("back-scene").addEventListener("click", () => go(2));
    $("to-int").addEventListener("click", () => go(4));
  }
  function evCard(id) {
    const e = ev(id);
    return `<div class="cf-evcard${e.derived ? " is-derived" : ""}" data-ev="${id}"><button type="button" class="cf-evcard-open" aria-label="${esc(e.name)} 자세히"><div class="cf-evcard-art">${A.doc(e.art)}</div><span class="cf-type">${TYPE_LABEL[e.type] || "증거"}</span><b>${esc(e.name)}</b><span class="cf-muted cf-small">${esc(e.where)} · ${esc(e.time)}</span></button><button type="button" class="cf-evcard-pick" aria-pressed="false">연결 선택</button></div>`;
  }
  function togglePick(id) {
    X.play("tap");
    if (pick.includes(id)) pick = pick.filter((x) => x !== id);
    else {
      if (pick.length >= 2) pick.shift();
      pick.push(id);
    }
    for (const c of document.querySelectorAll(".cf-evcard")) {
      const on = pick.includes(c.dataset.ev);
      c.classList.toggle("is-picked", on);
      c.querySelector(".cf-evcard-pick").setAttribute("aria-pressed", on ? "true" : "false");
      c.querySelector(".cf-evcard-pick").textContent = on ? "선택됨" : "연결 선택";
    }
    $("link-state").textContent = pick.length === 2 ? `${ev(pick[0]).name} + ${ev(pick[1]).name}` : pick.length === 1 ? `${ev(pick[0]).name} + ?` : "연결할 증거 두 개를 고르세요";
    $("link-btn").disabled = pick.length !== 2;
  }
  function linkIndex(a, b) {
    return D.links.findIndex((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  }
  function tryLink() {
    if (pick.length !== 2) return;
    const i = linkIndex(pick[0], pick[1]);
    if (i < 0) {
      X.play("miss");
      flash("dim");
      toast("두 증거 사이에 뚜렷한 연결점이 보이지 않는다");
      return;
    }
    const l = D.links[i];
    if (G.links.includes(i)) {
      toast("이미 연결한 단서예요");
      return;
    }
    const unmet = (l.needs || []).filter((n) => !G.links.includes(D.links.findIndex((x) => x.id === n)));
    if (unmet.length) {
      X.play("miss");
      toast("아직 이 둘을 잇기엔 근거가 부족하다. 다른 단서부터 맞춰 보자.");
      return;
    }
    G.links.push(i);
    X.play("link");
    flash("gold");
    const got = l.gives ? collect([l.gives], true) : [];
    save();
    openModal(`<div class="cf-linkshow"><p class="cf-type">단서 연결 성공</p><h2 class="cf-modal-h" id="modal-h">${esc(l.title)}</h2><div class="cf-linkpair"><span>${esc(ev(l.a).name)}</span><i>+</i><span>${esc(ev(l.b).name)}</span></div><p>${esc(l.text)}</p>${got.length ? `<div class="cf-newev"><p class="cf-type">새 증거 확보</p>${evMini(got[0])}</div>` : ""}</div>`, () => go(3, true));
  }
  function openEvidence(id) {
    const e = ev(id);
    X.play("page");
    openModal(`<div class="cf-evdetail"><div class="cf-evdetail-art" id="zoom-art" title="눌러서 확대">${A.doc(e.art)}</div><div><p class="cf-type">${TYPE_LABEL[e.type] || "증거"}${e.derived ? " · 분석으로 확보" : ""}</p><h2 class="cf-modal-h" id="modal-h">${esc(e.name)}</h2><dl class="cf-meta"><div><dt>발견 장소</dt><dd>${esc(e.where)}</dd></div><div><dt>시각</dt><dd>${esc(e.time)}</dd></div>${e.rel && e.rel.length ? `<div><dt>관련 인물</dt><dd>${e.rel.map((s) => esc(sus(s).name)).join(", ")}</dd></div>` : ""}</dl><p>${esc(e.desc)}</p><p class="cf-fact"><span>이 증거가 말하는 것</span>${esc(e.meaning)}</p></div></div>`);
    $("zoom-art").addEventListener("click", () => $("zoom-art").classList.toggle("is-zoom"));
  }

  /* STEP 4 심문 */
  function viewInterrogate() {
    const v = $("view");
    const s = sus(G.active) || D.suspects[0];
    G.active = s.id;
    const log = G.talk[s.id] || [];
    const asked = new Set(log.filter((m) => m.q).map((m) => m.qid));
    const lastMood = (log.slice().reverse().find((m) => m.mood) || {}).mood || "calm";
    const qs = s.qs.filter((q) => !q.need || hasEv(q.need));
    const myContras = D.contras.filter((c) => G.contras.includes(c.id));
    v.innerHTML = `<div class="cf-sustabs" role="tablist">${D.suspects.map((x) => `<button type="button" role="tab" class="cf-sustab${x.id === s.id ? " is-on" : ""}" data-sus="${x.id}" aria-selected="${x.id === s.id}"><span class="cf-sustab-pic">${A.portrait(x.look)}</span><span>${esc(x.name)}</span>${D.contras.some((c) => c.s === x.id && G.contras.includes(c.id)) ? '<i class="cf-dot"></i>' : ""}</button>`).join("")}</div>
      <div class="cf-int">
        <aside class="cf-int-profile"><div class="cf-int-pic" id="int-pic">${A.portrait(s.look, lastMood)}</div><h2 class="cf-int-name">${esc(s.name)} <span class="cf-muted">${s.age}세</span></h2><p class="cf-int-job">${esc(s.job)}</p><dl class="cf-meta cf-meta-col"><div><dt>사건과의 관계</dt><dd>${esc(s.rel)}</dd></div><div><dt>성격</dt><dd>${esc(s.trait)}</dd></div><div><dt>주장하는 알리바이</dt><dd>${esc(s.alibi)}</dd></div></dl></aside>
        <div class="cf-int-main"><div class="cf-chat" id="chat"><div class="cf-msg cf-msg-them"><b>${esc(s.name)}</b><p>${esc(s.intro)}</p></div>${log.map(msgHtml).join("")}</div>
          <div class="cf-qs">${qs.map((q) => `<button type="button" class="cf-q${asked.has(q.id) ? " is-asked" : ""}" data-q="${q.id}">${esc(q.q)}</button>`).join("")}</div>
          <button type="button" class="cf-btn cf-btn-red cf-btn-wide" id="present-btn">증거 제시하기</button></div>
      </div>
      <section class="cf-panel"><h3 class="cf-panel-h">수첩 · 발견한 모순 <span class="cf-muted">${G.contras.length}개</span></h3>${myContras.length ? `<ul class="cf-linklist">${myContras.map((c) => `<li class="is-contra"><b>${esc(sus(c.s).name)} — ${esc(c.title)}</b><p>${esc(c.text)}</p></li>`).join("")}</ul>` : `<p class="cf-muted">진술과 증거가 어긋나는 곳을 찾으면 여기에 적혀요.</p>`}</section>
      <div class="cf-navrow"><button type="button" class="cf-btn" id="back-ev">증거 분석으로</button><button type="button" class="cf-btn cf-btn-gold" id="to-rep">최종 추리 보고서</button></div>`;
    for (const b of v.querySelectorAll("[data-sus]")) {
      b.addEventListener("click", () => {
        G.active = b.dataset.sus;
        X.play("tap");
        go(4, true);
      });
    }
    for (const b of v.querySelectorAll("[data-q]")) b.addEventListener("click", () => ask(s, s.qs.find((q) => q.id === b.dataset.q)));
    $("present-btn").addEventListener("click", () => presentPicker(s));
    $("back-ev").addEventListener("click", () => go(3));
    $("to-rep").addEventListener("click", () => go(5));
    const chat = $("chat");
    chat.scrollTop = chat.scrollHeight;
  }
  function msgHtml(m) {
    if (m.q) return `<div class="cf-msg cf-msg-me"><p>${esc(m.q)}</p></div><div class="cf-msg cf-msg-them${m.contra ? " is-contra" : ""}"><p>${esc(m.a)}</p>${m.contra ? `<span class="cf-contra-tag">모순 발견</span>` : ""}${m.gave ? `<span class="cf-gave-tag">증거 확보: ${esc(m.gave)}</span>` : ""}</div>`;
    return "";
  }
  function pushTalk(s, entry) {
    (G.talk[s.id] = G.talk[s.id] || []).push(entry);
    if (G.talk[s.id].length > 40) G.talk[s.id].shift();
  }
  function typeAnswer() {
    const msgs = $("chat").querySelectorAll(".cf-msg-them");
    const last = msgs[msgs.length - 1];
    if (!last || document.body.classList.contains("cf-calm")) return;
    last.classList.add("is-typing");
    let n = 0;
    const iv = setInterval(() => {
      X.play("talk");
      if (++n > 5) {
        clearInterval(iv);
        last.classList.remove("is-typing");
      }
    }, 70);
  }
  function ask(s, q) {
    if (!q) return;
    let gave = "";
    if (q.gives && !hasEv(q.gives)) {
      collect([q.gives], true);
      gave = ev(q.gives).name;
      X.play("found");
    }
    pushTalk(s, { qid: q.id, q: q.q, a: q.a, mood: q.mood || "calm", gave });
    save();
    go(4, true);
    typeAnswer();
    if (gave) toast(`증거함에 추가: ${gave}`);
  }
  function presentPicker(s) {
    openModal(`<h2 class="cf-modal-h" id="modal-h">${esc(s.name)}에게 무엇을 보여 줄까?</h2><div class="cf-pickgrid">${G.collected.map((id) => `<button type="button" class="cf-pickev" data-show="${id}"><span class="cf-type">${TYPE_LABEL[ev(id).type] || "증거"}</span><b>${esc(ev(id).name)}</b></button>`).join("")}</div>`);
    for (const b of $("modal-body").querySelectorAll("[data-show]")) {
      b.addEventListener("click", () => {
        closeModal();
        present(s, b.dataset.show);
      });
    }
  }
  function present(s, eid) {
    const e = ev(eid);
    const r = (s.show && s.show[eid]) || { a: s.dflt, mood: "calm" };
    const isNew = r.contra && !G.contras.includes(r.contra);
    if (isNew) G.contras.push(r.contra);
    pushTalk(s, { qid: `show:${eid}`, q: `(증거 제시) ${e.name}`, a: r.a, mood: r.mood || "calm", contra: !!r.contra });
    save();
    go(4, true);
    typeAnswer();
    if (isNew) {
      X.play("contra");
      flash("red");
      const c = D.contras.find((x) => x.id === r.contra);
      setTimeout(() => {
        openModal(`<div class="cf-contrashow"><p class="cf-bigstamp">모순 발견</p><h2 class="cf-modal-h" id="modal-h">${esc(c.title)}</h2><p>${esc(c.text)}</p></div>`);
      }, document.body.classList.contains("cf-calm") ? 0 : 450);
    } else if (r.contra) toast("이미 찾아낸 모순이에요");
  }

  /* STEP 5 최종 추리 */
  function viewReport() {
    const v = $("view");
    const R = D.report;
    const rep = G.report;
    const opt = (key, list) => list.map((t, i) => `<label class="cf-opt"><input type="radio" name="${key}" value="${i}" ${String(rep[key]) === String(i) ? "checked" : ""}/><span>${esc(t)}</span></label>`).join("");
    v.innerHTML = `<form class="cf-report" id="report-form" novalidate>
      <div class="cf-report-head"><p class="cf-stamp-small">REPORT</p><h2 class="cf-view-h">최종 추리 보고서</h2><p class="cf-muted">다섯 항목을 모두 고르고 제출하세요. 제출하면 바꿀 수 없어요.</p></div>
      <fieldset><legend>1. 범인은 누구인가?</legend><div class="cf-culprits">${D.suspects.map((s) => `<label class="cf-culprit"><input type="radio" name="culprit" value="${s.id}" ${rep.culprit === s.id ? "checked" : ""}/><span class="cf-culprit-pic">${A.portrait(s.look)}</span><b>${esc(s.name)}</b><span class="cf-muted cf-small">${esc(s.job)}</span></label>`).join("")}</div></fieldset>
      <fieldset><legend>2. 범행 동기는 무엇인가?</legend>${opt("motive", R.motive.options)}</fieldset>
      <fieldset><legend>3. 결정적인 증거는 무엇인가?</legend><p class="cf-muted cf-small">내 증거함에 있는 증거 중에서 고르세요.</p>${G.collected.map((id) => `<label class="cf-opt"><input type="radio" name="decisive" value="${id}" ${rep.decisive === id ? "checked" : ""}/><span>${esc(ev(id).name)}</span></label>`).join("")}</fieldset>
      <fieldset><legend>4. 범행이 가능했던 시간은?</legend>${opt("time", R.time.options)}</fieldset>
      <fieldset><legend>5. 거짓이었던 진술은?</legend>${opt("lie", R.lie.options)}</fieldset>
      <p class="cf-error" id="rep-err" role="alert"></p>
      <div class="cf-navrow"><button type="button" class="cf-btn" id="back-int">심문으로</button><button type="submit" class="cf-btn cf-btn-gold">보고서 검토</button></div></form>`;
    const form = $("report-form");
    form.addEventListener("change", (e) => {
      if (e.target.name) {
        G.report[e.target.name] = e.target.value;
        $("rep-err").textContent = "";
        X.play("tap");
        save();
      }
    });
    $("back-int").addEventListener("click", () => go(4));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const miss = ["culprit", "motive", "decisive", "time", "lie"].filter((k) => G.report[k] == null || G.report[k] === "");
      if (miss.length) {
        $("rep-err").textContent = `아직 고르지 않은 항목이 있어요 (${miss.length}개)`;
        return;
      }
      reviewReport();
    });
  }
  function reportLines() {
    const R = D.report;
    const r = G.report;
    return [
      ["범인", sus(r.culprit).name],
      ["동기", R.motive.options[r.motive]],
      ["결정적 증거", ev(r.decisive).name],
      ["범행 시간", R.time.options[r.time]],
      ["거짓 진술", R.lie.options[r.lie]],
    ];
  }
  function reviewReport() {
    openModal(`<h2 class="cf-modal-h" id="modal-h">보고서를 제출할까요?</h2><dl class="cf-review">${reportLines().map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl><p class="cf-muted">제출한 뒤에는 바꿀 수 없어요.</p><div class="cf-navrow"><button type="button" class="cf-btn" id="rev-no">다시 생각하기</button><button type="button" class="cf-btn cf-btn-red" id="rev-yes">제출</button></div>`);
    $("rev-no").addEventListener("click", closeModal);
    $("rev-yes").addEventListener("click", submitReport);
  }

  /* ---------- 점수 ---------- */
  function computeScore(data, st, seconds) {
    const R = data.report;
    const r = st.report;
    const ok = {
      culprit: r.culprit === R.culprit,
      motive: Number(r.motive) === R.motive.answer,
      decisive: r.decisive === R.decisive,
      time: Number(r.time) === R.time.answer,
      lie: Number(r.lie) === R.lie.answer,
    };
    const W = { culprit: 350, motive: 150, decisive: 150, time: 100, lie: 100 };
    const accuracy = Object.keys(W).reduce((a, k) => a + (ok[k] ? W[k] : 0), 0);
    const evRatio = st.collected.length / data.evidence.length;
    const coRatio = data.contras.length ? st.contras.length / data.contras.length : 1;
    const investigation = Math.round(evRatio * 60 + coRatio * 40);
    const target = data.minutes * 60;
    const limit = target * 3;
    const speed = ok.culprit ? Math.round(seconds <= target ? 50 : 50 * Math.max(0, (limit - seconds) / (limit - target))) : 0;
    const hintPenalty = HINT_COST.slice(0, st.hints).reduce((a, b) => a + b, 0);
    const total = Math.max(0, Math.min(1000, accuracy + investigation + speed - hintPenalty));
    const all = Object.values(ok).every(Boolean);
    let grade = total >= 950 && all && st.hints === 0 ? "SSS" : total >= 870 ? "SS" : total >= 760 ? "S" : total >= 600 ? "A" : total >= 400 ? "B" : "C";
    if (grade === "SSS" && !all) grade = "SS";
    if (!ok.culprit) grade = "C";
    return { ok, accuracy, investigation, speed, hintPenalty, total, grade, solved: ok.culprit };
  }
  window.CFScore = { compute: computeScore, HINT_COST };

  let lastResult = null;
  function submitReport() {
    closeModal();
    stopTimer();
    const seconds = elapsed();
    const res = computeScore(D, G, seconds);
    G.submitted = true;
    G.seconds = seconds;
    G.result = res;
    const out = S.recordResult({ caseId: D.id, mode: G.mode, day: G.day, score: res.total, grade: res.grade, solved: res.solved, hints: G.hints, seconds, evidence: G.collected.length });
    lastResult = { ...res, dailyNew: out.dailyNew, seconds };
    X.play("stamp");
    go(6, true);
  }

  /* STEP 6 결과 */
  function viewResult() {
    const v = $("view");
    const res = lastResult || G.result;
    const T = D.truth;
    const R = D.report;
    const ok = res.ok;
    const missedEv = D.evidence.filter((e) => !G.collected.includes(e.id));
    const missedCo = D.contras.filter((c) => !G.contras.includes(c.id));
    const missedLinks = D.links.filter((l, i) => !G.links.includes(i));
    const row = (label, good, mine, right) => `<li class="${good ? "is-ok" : "is-ng"}"><span class="cf-res-mark">${good ? "정답" : "오답"}</span><b>${label}</b><span>${esc(mine)}${good ? "" : `<em>정답: ${esc(right)}</em>`}</span></li>`;
    v.innerHTML = `<article class="cf-result">
      <div class="cf-result-head ${res.solved ? "is-solved" : "is-failed"}"><p class="cf-bigstamp ${res.solved ? "" : "is-fail"}">${res.solved ? "사건 종결" : "미제 사건"}</p><h2 class="cf-view-h">${esc(D.code)} ${esc(D.title)}</h2></div>
      <div class="cf-grade" id="grade-box"><span class="cf-grade-letter">${res.grade}</span><span class="cf-grade-name">${GRADE_NAME[res.grade]}</span><span class="cf-grade-score"><b id="score-num">0</b> / 1000점</span></div>
      <ul class="cf-res-rows">${row("범인", ok.culprit, sus(G.report.culprit).name, sus(R.culprit).name)}${row("범행 동기", ok.motive, R.motive.options[G.report.motive], R.motive.options[R.motive.answer])}${row("결정적 증거", ok.decisive, ev(G.report.decisive).name, ev(R.decisive).name)}${row("범행 시간", ok.time, R.time.options[G.report.time], R.time.options[R.time.answer])}${row("거짓 진술", ok.lie, R.lie.options[G.report.lie], R.lie.options[R.lie.answer])}</ul>
      <div class="cf-dash cf-dash-4"><div class="cf-stat"><p class="cf-stat-label">소요 시간</p><p class="cf-stat-value">${mmss(res.seconds || G.seconds || 0)}</p></div><div class="cf-stat"><p class="cf-stat-label">힌트 사용</p><p class="cf-stat-value">${G.hints}회 (−${res.hintPenalty})</p></div><div class="cf-stat"><p class="cf-stat-label">수집 증거</p><p class="cf-stat-value">${G.collected.length} / ${D.evidence.length}</p></div><div class="cf-stat"><p class="cf-stat-label">찾은 모순</p><p class="cf-stat-value">${G.contras.length} / ${D.contras.length}</p></div></div>
      <p class="cf-muted cf-center cf-small">정확도 ${res.accuracy} + 조사 ${res.investigation} + 속도 ${res.speed} − 힌트 ${res.hintPenalty}${G.mode === "replay" ? " · 다시 조사 (최고 기록만 갱신)" : ""}</p>
      ${res.dailyNew ? `<section class="cf-panel cf-rankform"><h3 class="cf-panel-h">오늘의 랭킹에 이름 남기기</h3><form id="rank-form" class="cf-rankrow"><input id="rank-name" maxlength="8" placeholder="이름 2~8자" autocomplete="nickname" value="${esc(S.load().name || "")}"/><button type="submit" class="cf-btn cf-btn-gold cf-btn-small">등록</button></form><p class="cf-muted cf-small" id="rank-msg">오늘 점수와 이번 주 합계(${S.weekTotal(TODAY)}점)가 등록돼요.</p></section>` : ""}
      <section class="cf-truth"><h3 class="cf-truth-h">사건의 전말</h3><p class="cf-truth-lead">${esc(T.headline)}</p>
        <h4>왜 그랬나</h4><p>${esc(T.motive)}</p>
        <h4>범행은 이렇게 이루어졌다</h4><ol class="cf-timeline">${T.steps.map(([t, s]) => `<li><time>${esc(t)}</time><p>${esc(s)}</p></li>`).join("")}</ol>
        <h4>결정적 증거</h4><p>${esc(T.decisive)}</p>
        <h4>거짓 진술</h4><p>${esc(T.lie)}</p>
        <h4>반전</h4><p>${esc(T.twist)}</p>
        <h4>놓친 단서</h4>${missedEv.length + missedCo.length + missedLinks.length ? `<ul class="cf-missed">${missedEv.map((e) => `<li><span class="cf-type">증거</span>${esc(e.name)} — ${esc(e.meaning)}</li>`).join("")}${missedCo.map((c) => `<li><span class="cf-type">모순</span>${esc(sus(c.s).name)}: ${esc(c.title)}</li>`).join("")}${missedLinks.map((l) => `<li><span class="cf-type">연결</span>${esc(l.title)}</li>`).join("")}</ul>` : `<p>놓친 단서가 하나도 없어요. 완벽한 수사였습니다.</p>`}
      </section>
      <div class="cf-navrow"><button type="button" class="cf-btn" id="res-archive">사건 보관함</button><button type="button" class="cf-btn cf-btn-gold" id="res-home">사건파일 메인</button></div></article>`;
    $("res-archive").addEventListener("click", () => {
      G = null;
      renderArchive();
    });
    $("res-home").addEventListener("click", () => {
      G = null;
      goHome();
    });
    const form = $("rank-form");
    if (form) form.addEventListener("submit", (e) => submitRank(e, res));
    // 점수 세기 · 등급 발표
    const target = res.total;
    const el = $("score-num");
    const box = $("grade-box");
    if (document.body.classList.contains("cf-calm")) {
      el.textContent = target;
      box.classList.add("is-on");
      return;
    }
    X.play(res.solved ? "solved" : "fail");
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1200);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
      else {
        box.classList.add("is-on");
        X.play("grade");
      }
    };
    requestAnimationFrame(step);
  }
  async function submitRank(e, res) {
    e.preventDefault();
    const name = $("rank-name").value.trim();
    const msg = $("rank-msg");
    if (name.length < 2 || name.length > 8) {
      msg.textContent = "이름은 2~8자로 적어 주세요";
      return;
    }
    S.set("name", name);
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    msg.textContent = "등록 중…";
    if (!window.TodayScores) {
      msg.textContent = "랭킹 모듈을 불러오지 못했어요";
      btn.disabled = false;
      return;
    }
    const [d, w] = await Promise.all([TodayScores.submitScore(GAME_ID, name, res.total), TodayScores.submitScore(WEEK_ID, name, S.weekTotal(TODAY))]);
    if (d.ok) {
      msg.textContent = `등록 완료! 오늘 ${d.rankDay || d.rank || "-"}위${w.ok && w.rankWeek ? ` · 이번 주 ${w.rankWeek}위` : ""}`;
      $("rank-form").remove();
    } else {
      msg.textContent = "등록하지 못했어요. 잠시 뒤 다시 시도해 주세요.";
      btn.disabled = false;
    }
  }

  /* ---------- 힌트 ---------- */
  $("hint-btn").addEventListener("click", () => {
    if (!G || G.submitted) return;
    const used = D.hints.slice(0, G.hints);
    const next = G.hints < 3 ? HINT_COST[G.hints] : 0;
    openModal(`<h2 class="cf-modal-h" id="modal-h">힌트</h2>${used.length ? `<ol class="cf-hints">${used.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>` : `<p class="cf-muted">힌트는 3단계예요. 정답이 아니라 생각할 방향을 알려 줘요.</p>`}${G.hints < 3 ? `<button type="button" class="cf-btn cf-btn-red cf-btn-wide" id="hint-more">${G.hints + 1}단계 힌트 보기 (−${next}점)</button>` : `<p class="cf-muted">힌트를 모두 봤어요.</p>`}`);
    const b = $("hint-more");
    if (b) {
      b.addEventListener("click", () => {
        G.hints += 1;
        X.play("page");
        save();
        closeModal();
        $("hint-btn").click();
      });
    }
  });

  /* ---------- 시작 ---------- */
  if (TEST) {
    window.__cfTest = {
      get state() {
        return G;
      },
      get data() {
        return D;
      },
      today: TODAY,
      todayMeta,
      loadCase,
      startCase,
      computeScore,
      go: (n) => go(n),
    };
  }
  renderHome();
})();
