/* 교통지옥 — 화면 · 조작 · 기록 · 효과음 (규칙 · 점수는 sim.js 에서만)
 * ?test=1 : window.__thTest · ?today=YYYY-MM-DD 로 날짜 바꾸기
 */
(() => {
  "use strict";
  const TH = window.TH;
  const LV = window.THL;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const TEST = params.get("test") === "1";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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
  const today = () => (TEST && /^\d{4}-\d{2}-\d{2}$/.test(params.get("today") || "") ? params.get("today") : seoulDay());
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

  /* ---------- 저장 ---------- */
  const KEY = "tg-traffichell";
  const blank = () => ({ v: 1, stages: {}, missions: {}, endless: { best: 0, time: 0, passed: 0, cong: 0, plays: 0 }, daily: {}, streak: { last: "", count: 0, best: 0 }, week: { id: "", sum: 0, days: 0 }, totals: { passed: 0, acc: 0, plays: 0, em: 0 }, recent: [], dm: {}, tutorial: false, sound: true, name: "" });
  let DB = null;
  function db() {
    if (DB) return DB;
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || "null");
      DB = o && o.v === 1 ? { ...blank(), ...o } : blank();
      for (const k of ["stages", "missions", "daily", "dm"]) if (!DB[k] || typeof DB[k] !== "object" || Array.isArray(DB[k])) DB[k] = {};
      for (const k of ["endless", "streak", "week", "totals"]) if (!DB[k] || typeof DB[k] !== "object") DB[k] = blank()[k];
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

  /* ---------- 효과음 (Web Audio · 과하지 않게) ---------- */
  let AC = null;
  const muted = () => db().sound === false || (window.TodayAudio && TodayAudio.isMuted && TodayAudio.isMuted());
  function ac() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === "suspended") AC.resume();
      return AC;
    } catch (_) {
      return null;
    }
  }
  function tone(f, at, dur, type = "sine", vol = 0.08, slide = 0) {
    if (muted()) return;
    const A = ac();
    if (!A) return;
    const t = A.currentTime + at;
    const o = A.createOscillator();
    const g = A.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(A.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq) {
    if (muted()) return;
    const A = ac();
    if (!A) return;
    const n = Math.floor(A.sampleRate * dur);
    const buf = A.createBuffer(1, n, A.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = A.createBufferSource();
    s.buffer = buf;
    const f = A.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = A.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(A.destination);
    s.start();
  }
  let sirenNode = null;
  function siren(on) {
    if (on && !muted() && !sirenNode) {
      const A = ac();
      if (!A) return;
      const o = A.createOscillator();
      const lfo = A.createOscillator();
      const lg = A.createGain();
      const g = A.createGain();
      o.type = "triangle";
      o.frequency.value = 760;
      lfo.frequency.value = 1.6;
      lg.gain.value = 180;
      lfo.connect(lg).connect(o.frequency);
      g.gain.value = 0.025;
      o.connect(g).connect(A.destination);
      o.start();
      lfo.start();
      sirenNode = { o, lfo, g };
    } else if ((!on || muted()) && sirenNode) {
      try {
        sirenNode.o.stop();
        sirenNode.lfo.stop();
      } catch (_) {}
      sirenNode = null;
    }
  }
  let lastHorn = 0;
  const SFX = {
    tick: () => tone(1180, 0, 0.05, "square", 0.025),
    green: () => tone(660, 0, 0.08, "sine", 0.04),
    horn: () => {
      const n = performance.now();
      if (n - lastHorn < 2500) return;
      lastHorn = n;
      tone(415, 0, 0.22, "square", 0.03);
      tone(523, 0, 0.22, "square", 0.022);
    },
    skid: () => noise(0.35, 0.05, 2400),
    crash: () => {
      noise(0.6, 0.22, 500);
      tone(90, 0, 0.35, "sawtooth", 0.08, -50);
    },
    warn: () => [0, 0.16].forEach((t) => tone(880, t, 0.1, "square", 0.03)),
    pass: () => tone(988, 0, 0.06, "sine", 0.015),
    emPass: () => [0, 0.08, 0.16].forEach((t, i) => tone(660 + i * 220, t, 0.12, "sine", 0.05)),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.25, "triangle", 0.07)),
    fail: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, "triangle", 0.06)),
    record: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.08, 0.22, "sine", 0.07)),
  };

  /* ---------- 오늘의 미션 (날짜로 3개) ---------- */
  const DM = [
    { id: "pass150", text: "오늘 차량 150대 통과시키기 (모든 모드 합계)", goal: 150, key: "passed" },
    { id: "cleanStage", text: "사고 없이 스테이지 1개 클리어", goal: 1, key: "cleanStage" },
    { id: "em3", text: "긴급 차량 3대를 골든타임 안에 통과", goal: 3, key: "emOk" },
    { id: "endless180", text: "무한 교통지옥에서 3분 버티기", goal: 180, key: "endlessT" },
    { id: "daily", text: "오늘의 교통지옥 한 판 완주", goal: 1, key: "dailyDone" },
    { id: "star3", text: "스테이지 1개를 별 3개로 클리어", goal: 1, key: "star3" },
    { id: "mission1", text: "긴급 상황 미션 1개 성공", goal: 1, key: "mission" },
    { id: "wait10", text: "평균 대기 10초 이하로 스테이지 클리어", goal: 1, key: "lowWait" },
  ];
  function dailyMissions(key) {
    const r = TH.mulberry32(TH.hashStr("th-dm-" + key));
    const pool = DM.slice();
    const out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }
  function dmState() {
    const d = db();
    const k = today();
    if (!d.dm[k]) d.dm[k] = { passed: 0, cleanStage: 0, emOk: 0, endlessT: 0, dailyDone: 0, star3: 0, mission: 0, lowWait: 0 };
    for (const old of Object.keys(d.dm)) if (old < addDays(k, -7)) delete d.dm[old];
    return d.dm[k];
  }

  /* ---------- 화면 전환 ---------- */
  const SCREENS = ["menu", "pick", "game"];
  function show(id) {
    for (const s of SCREENS) $(s).hidden = s !== id;
    // 공용 소리 버튼을 지금 보이는 화면의 머리줄로 옮긴다 (게임 중에도 음소거 가능)
    const mb = document.getElementById("today-mute-btn");
    const slot = $(id).querySelector("[data-mute-slot]");
    if (mb && slot && mb.parentNode !== slot) slot.appendChild(mb);
    window.scrollTo(0, 0);
  }
  function toast(msg, ms = 2200) {
    const t = $("toast");
    t.innerHTML = msg;
    t.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("on"), ms);
  }
  function modal(html, onClose) {
    $("modal-body").innerHTML = html;
    $("modal").hidden = false;
    modal._close = onClose;
    const f = $("modal-body").querySelector("button, input");
    if (f) setTimeout(() => f.focus(), 30);
  }
  function closeModal() {
    $("modal").hidden = true;
    const f = modal._close;
    modal._close = null;
    if (f) f();
  }
  $("modal-x").addEventListener("click", closeModal);

  /* ---------- 메뉴 ---------- */
  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  function stars(n) {
    return `<span class="th-stars">${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}">★</i>`).join("")}</span>`;
  }
  function stageStars(L, st) {
    if (st.status !== "win") return 0;
    const p = L.goal.pass || 20;
    const sc = st.score;
    let n = 1;
    if (sc >= 600 + p * 8) n = 2;
    if (sc >= 900 + p * 10 && st.acc === 0) n = 3;
    return n;
  }
  function renderMenu() {
    const d = db();
    const k = today();
    $("menu-date").textContent = k.replace(/-/g, ".");
    const cleared = LV.STAGES.filter((s) => d.stages[s.id] && d.stages[s.id].cleared).length;
    const starSum = LV.STAGES.reduce((a, s) => a + ((d.stages[s.id] && d.stages[s.id].stars) || 0), 0);
    const mDone = LV.MISSIONS.filter((s) => d.missions[s.id] && d.missions[s.id].cleared).length;
    const dd = d.daily[k];
    $("modes").innerHTML = `
      <button type="button" class="th-mode th-mode-daily" data-mode="daily"><b>오늘의 교통지옥</b><span>모두 같은 도로 · 같은 차량 · 4분 점수 경쟁</span><em>${dd ? `오늘 최고 ${dd.best.toLocaleString()}점` : "오늘 아직 안 함"}</em></button>
      <button type="button" class="th-mode" data-mode="stage"><b>스테이지</b><span>기본 교차로부터 다중 교차로까지 20개</span><em>${cleared}/20 클리어 · ★${starSum}</em></button>
      <button type="button" class="th-mode" data-mode="endless"><b>무한 교통지옥</b><span>점점 늘어나는 차량 · 얼마나 버틸까</span><em>${d.endless.best ? `최고 ${d.endless.best.toLocaleString()}점 · ${fmtT(d.endless.time)}` : "기록 없음"}</em></button>
      <button type="button" class="th-mode" data-mode="mission"><b>긴급 상황</b><span>골든타임 · 사고 수습 · 교통대란 · 우회 통제</span><em>${mDone}/6 성공</em></button>`;
    $("modes")
      .querySelectorAll("[data-mode]")
      .forEach((b) =>
        b.addEventListener("click", () => {
          const m = b.dataset.mode;
          if (m === "stage") openPick("stage");
          else if (m === "mission") openPick("mission");
          else if (m === "endless") brief(LV.ENDLESS, "endless");
          else brief(LV.daily(today()), "daily");
        }),
      );
    // 오늘의 미션
    const ms = dailyMissions(k);
    const st = dmState();
    let done = 0;
    $("missions").innerHTML = ms
      .map((m) => {
        const v = Math.min(m.goal, st[m.key] || 0);
        const ok = v >= m.goal;
        if (ok) done++;
        return `<li class="${ok ? "ok" : ""}"><span>${ok ? "✔" : "○"}</span><p>${esc(m.text)}</p><em>${m.goal > 1 ? `${Math.floor(v)}/${m.goal}` : ok ? "완료" : ""}</em></li>`;
      })
      .join("");
    $("mis-count").textContent = `${done}/3`;
    // 기록
    const wk = weekId(k);
    const week = d.week.id === wk ? d.week : { sum: 0, days: 0 };
    $("stats").innerHTML = [
      ["통과시킨 차", d.totals.passed.toLocaleString() + "대"],
      ["연속 참여", `${d.streak.count}일 (최고 ${d.streak.best})`],
      ["이번 주 오늘의 점수 합", `${week.sum.toLocaleString()}점 · ${week.days}일`],
      ["무한 최고 생존", d.endless.time ? fmtT(d.endless.time) : "-"],
      ["무한 최다 통과", d.endless.passed ? d.endless.passed + "대" : "-"],
      ["긴급 차량 통과", d.totals.em + "대"],
      ["사고", d.totals.acc + "건"],
      ["플레이", d.totals.plays + "판"],
    ]
      .map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`)
      .join("");
    $("recent").innerHTML = d.recent.length
      ? d.recent
          .slice(0, 6)
          .map((r) => `<li><span>${esc(r.name)}</span><em class="${r.win ? "w" : "l"}">${r.win ? "성공" : "실패"}</em><b>${r.score.toLocaleString()}</b><small>${r.date.slice(5).replace("-", ".")}</small></li>`)
          .join("")
      : `<li class="th-muted">아직 기록이 없어요.</li>`;
    loadRank();
  }
  async function loadRank() {
    const ol = $("rank-list");
    if (!window.TodayScores) return (ol.innerHTML = `<li class="th-muted">순위를 불러오지 못했어요.</li>`);
    try {
      const r = await TodayScores.fetchScores("traffic-hell-daily", 5, "day");
      if (!r.ok) throw new Error("rank");
      const list = r.scores;
      ol.innerHTML = list.length ? list.map((e, i) => `<li><b>${i + 1}</b><span>${esc(e.name)}</span><em>${Number(e.score).toLocaleString()}</em></li>`).join("") : `<li class="th-muted">아직 오늘 등록된 기록이 없어요. 첫 번째가 되어 보세요!</li>`;
    } catch (_) {
      ol.innerHTML = `<li class="th-muted">순위를 불러오지 못했어요.</li>`;
    }
  }

  /* ---------- 스테이지 · 미션 고르기 ---------- */
  const CHAPTERS = [
    [1, 5, "기본 교차로"],
    [6, 10, "차량 증가 · 좌회전"],
    [11, 15, "복잡한 교차로 · 긴급 차량"],
    [16, 20, "다중 교차로 · 고난도"],
  ];
  let pickKind = "stage";
  function openPick(kind) {
    pickKind = kind;
    const d = db();
    const list = kind === "stage" ? LV.STAGES : LV.MISSIONS;
    const rec = kind === "stage" ? d.stages : d.missions;
    $("pick-h").textContent = kind === "stage" ? "스테이지" : "긴급 상황 미션";
    const unlocked = (i) => TEST || kind === "mission" || i === 0 || (rec[list[i - 1].id] && rec[list[i - 1].id].cleared);
    const card = (L, i) => {
      const r = rec[L.id] || {};
      const lock = !unlocked(i);
      const th = LV.THEMES[L.theme];
      return `<button type="button" class="th-card ${lock ? "lock" : ""} ${r.cleared ? "done" : ""}" data-i="${i}" ${lock ? "disabled" : ""}>
        <span class="th-card-n">${kind === "stage" ? L.n : "M" + L.n}</span>
        <b>${esc(L.name)}</b>
        <small>${esc(th.name)}</small>
        ${kind === "stage" ? stars(r.stars || 0) : `<small class="th-card-goal">${esc(L.goalText || "")}</small>`}
        ${r.best ? `<em>${r.best.toLocaleString()}점</em>` : lock ? "<em>🔒</em>" : ""}
      </button>`;
    };
    if (kind === "stage") {
      $("pick-list").innerHTML = CHAPTERS.map(([a, b, name]) => `<h3 class="th-chap">${a}~${b} · ${name}</h3><div class="th-cards">${list.slice(a - 1, b).map((L, j) => card(L, a - 1 + j)).join("")}</div>`).join("");
      const sum = list.reduce((a, L) => a + ((rec[L.id] && rec[L.id].stars) || 0), 0);
      $("pick-sum").textContent = `★ ${sum}/60`;
    } else {
      $("pick-list").innerHTML = `<div class="th-cards">${list.map(card).join("")}</div>`;
      $("pick-sum").textContent = `${list.filter((L) => rec[L.id] && rec[L.id].cleared).length}/6`;
    }
    $("pick-list")
      .querySelectorAll(".th-card[data-i]")
      .forEach((b) => b.addEventListener("click", () => brief(list[+b.dataset.i], kind)));
    show("pick");
  }
  $("pick-back").addEventListener("click", () => {
    show("menu");
    renderMenu();
  });

  /* ---------- 시작 전 안내 ---------- */
  const TYPE_ICON = { car: "🚗", taxi: "🚕", bus: "🚌", truck: "🚚", moto: "🏍", ambulance: "🚑", fire: "🚒", police: "🚓" };
  function goalLine(L) {
    const g = L.goal;
    const a = [];
    if (g.endless) a.push("사고 3번 · 도시 마비가 오기 전까지 버티기");
    else {
      if (g.pass && g.pass > 1) a.push(`${g.time}초 안에 ${g.pass}대 통과`);
      else if (g.fullTime) a.push(`${g.time / 60}분 동안 최고 점수`);
      else if (!g.pass) a.push(`${g.time}초 버티기`);
      if (g.maxCong) a.push(`정체 지수 ${g.maxCong} 미만`);
      if (g.emFail) a.push(`긴급 차량 ${g.emLimit}초 안에 통과`);
      if (g.clearWreck) a.push("사고 차 견인");
      a.push(`사고 ${g.maxAcc}건까지`);
    }
    return a.join(" · ");
  }
  function brief(L, mode) {
    const th = LV.THEMES[L.theme];
    const specials = [];
    if (L.peds) specials.push("🚶 보행자 횡단보도");
    if (L.busStops && L.busStops.length) specials.push("🚏 버스 정류장");
    if (L.taxiZones && L.taxiZones.length) specials.push("🚕 택시 승하차");
    if ((L.work && L.work.length) || (L.closed && L.closed.length)) specials.push("🚧 공사 · 통제");
    if ((L.events || []).some((e) => e.kind === "emergency") || (L.proc && L.proc.em)) specials.push("🚨 긴급 차량");
    if ((L.events || []).some((e) => e.kind === "breakdown" || e.kind === "wreck") || (L.proc && L.proc.br)) specials.push("⚠ 고장 · 사고 차");
    if (L.waves && L.waves.length) specials.push("📈 교통량 급증");
    if (L.inters.some((i) => i.permLeft)) specials.push("↰ 비보호 좌회전");
    if (L.inters.length > 1) specials.push(`✚ 교차로 ${L.inters.length}곳`);
    modal(
      `<p class="th-kicker">${mode === "stage" ? `STAGE ${L.n}` : mode === "mission" ? `MISSION ${L.n}` : mode === "daily" ? today().replace(/-/g, ".") : "ENDLESS"} · ${esc(th.name)}</p>
      <h2 id="modal-h">${esc(L.name)}</h2>
      <p>${esc(L.brief)}</p>
      <p class="th-goal">🎯 ${esc(goalLine(L))}</p>
      ${specials.length ? `<p class="th-chips">${specials.map((s) => `<span>${s}</span>`).join("")}</p>` : ""}
      ${L.tips ? `<ul class="th-tips">${L.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <p class="th-muted th-small">${esc(th.desc)}</p>
      <div class="th-row"><button type="button" class="th-btn th-btn-hot" id="go-btn">시작</button></div>`,
      () => {},
    );
    $("go-btn").addEventListener("click", () => {
      $("modal").hidden = true;
      modal._close = null;
      startLevel(L, mode);
    });
  }

  /* ---------- 게임 진행 ---------- */
  let G = null; // { sim, R, L, mode, speed, paused, acc, raf, tut }
  function startLevel(L, mode, extra = {}) {
    stopLoop();
    const sim = TH.create(L, { seed: L.seed || L.id });
    const theme = LV.THEMES[L.theme] || LV.THEMES.downtown;
    show("game");
    $("hud-mode").innerHTML = `<b>${esc(L.name)}</b><small>${esc(goalLine(L))}</small>`;
    const R = THRender.makeRenderer($("cv"), sim, theme);
    G = { sim, R, L, mode, speed: 1, paused: false, acc: 0, last: performance.now(), sel: 0, tut: extra.tut || null, ended: false, emOn: false };
    $("speed-btn").textContent = "×1";
    $("paused").hidden = true;
    renderDock();
    bindCanvas();
    // 정보 줄 · 버튼 줄 높이가 바뀌면 캔버스 크기도 다시 맞춘다 (안 그러면 누른 곳과 그림이 어긋남)
    if (window.ResizeObserver) {
      G.ro = new ResizeObserver(() => G && G.R === R && R.resize());
      G.ro.observe($("stage"));
    }
    if (G.tut) tutStep(0);
    else $("coach").hidden = true;
    loop();
    if (TEST) window.__thTest.sim = sim;
  }
  function stopLoop() {
    if (G && G.raf) cancelAnimationFrame(G.raf);
    if (G && G.ro) G.ro.disconnect();
    siren(false);
    if (G) G.raf = 0;
  }
  function loop() {
    const step = () => {
      if (!G) return;
      const now = performance.now();
      let dt = Math.min(0.25, (now - G.last) / 1000);
      G.last = now;
      if (!G.paused && !G.ended) {
        G.acc += dt * G.speed;
        let n = 0;
        while (G.acc >= TH.DT && n < 30) {
          G.sim.step();
          G.acc -= TH.DT;
          n++;
          if (G.sim.status !== "play") break;
        }
        drain();
      }
      G.R.sel = G.sel;
      G.R.draw(G.paused ? 1 : Math.min(1, G.acc / TH.DT));
      updateHud();
      if (G.sim.status !== "play" && !G.ended) onEnd();
      G.raf = requestAnimationFrame(step);
    };
    G.raf = requestAnimationFrame(step);
  }
  function stepN(n) {
    // 테스트용: 화면과 상관없이 시뮬레이션만 진행
    for (let i = 0; i < n && G.sim.status === "play"; i++) G.sim.step();
    drain();
    if (G.sim.status !== "play" && !G.ended) onEnd();
  }

  const CAUSE = {
    clearing: (e) => `💥 사고! ${e.clearType ? TH.TYPES[e.clearType].name + "가" : "차가"} 교차로를 다 빠져나가기 전에 신호가 바뀌어 급히 출발한 차와 부딪혔어요. 큰 차가 지나는 중엔 신호를 조금 기다렸다 바꾸세요.`,
    conflict: () => "💥 사고! 서로 다른 방향 차가 교차로에서 동시에 만났어요. 신호를 너무 빨리 바꾸면 위험해요.",
    merge: () => "💥 합류 사고! 같은 차로로 들어가는 두 차가 부딪혔어요.",
    em: () => "💥 빨간불에 천천히 지나던 긴급 차량과 부딪혔어요. 긴급 차량 방향에 초록불을 주세요.",
  };
  const YIELD = {
    clearing: "⚠ 교차로 안에 아직 빠져나가는 차가 있어 기다려요",
    crash: "⚠ 사고 차가 교차로를 막고 있어요. 눌러서 견인하세요",
    broken: "⚠ 고장 차가 길을 막고 있어요. 눌러서 견인하세요",
  };
  function drain() {
    const sim = G.sim;
    const ev = sim.events;
    if (!ev.length) {
      if (G.tut) tutCheck();
      return;
    }
    sim.events = [];
    const st = dmState();
    for (const e of ev) {
      switch (e.k) {
        case "signal":
          SFX.tick();
          break;
        case "green":
          SFX.green();
          break;
        case "quick":
          toast("⏱ 신호를 너무 빨리 바꿨어요 (−25점). 초록불은 5초 이상 주세요.");
          break;
        case "crash":
          G.R.crashFx(e.x, e.y);
          SFX.crash();
          toast((CAUSE[e.cause] || CAUSE.conflict)(e), 5200);
          G.R.text(e.x, e.y, "−350", "#ff6a5a");
          break;
        case "pedHit":
          G.R.crashFx(e.x, e.y);
          SFX.crash();
          toast("💥 보행자 사고! (−500점) 사람이 건너는 동안엔 신호를 바꾸지 마세요.", 5200);
          break;
        case "brake":
          SFX.skid();
          if (Math.random() < 0.5) SFX.horn();
          break;
        case "yield":
          if (YIELD[e.cause]) toast(YIELD[e.cause]);
          SFX.horn();
          break;
        case "redrun":
          break;
        case "emIn":
          G.R.warnEntry = G.R.warnEntry.filter((w) => w.until > sim.t);
          SFX.warn();
          break;
        case "emWarn":
          G.R.warnEntry.push({ entry: e.entry, until: sim.t + 6, icon: TYPE_ICON[e.type] });
          toast(`🚨 ${TH.TYPES[e.type].name} 접근 중!`);
          SFX.warn();
          break;
        case "warn":
          if (e.at) G.R.warnEntry.push({ entry: e.at, until: sim.t + 5, icon: e.text.includes("구급") ? "🚑" : e.text.includes("소방") ? "🚒" : e.text.includes("경찰") ? "🚓" : "⚠" });
          banner(e.text);
          SFX.warn();
          break;
        case "emPass":
          SFX.emPass();
          G.R.text(e.x, e.y, `${e.bonus >= 0 ? "+" : ""}${e.bonus}`, e.bonus >= 60 ? "#7dff9b" : "#ffd24a");
          toast(`${TYPE_ICON[e.type]} ${TH.TYPES[e.type].name} 통과! 지체 ${e.delay.toFixed(1)}초`);
          if (e.delay <= 18) st.emOk++;
          db().totals.em++;
          break;
        case "emLate":
          toast(`🚨 ${TH.TYPES[e.type].name} 골든타임 초과! (−120점)`, 3000);
          SFX.fail();
          break;
        case "pass":
          st.passed++;
          if (Math.random() < 0.25) SFX.pass();
          break;
        case "broken":
          toast("⚠ 차가 고장 났어요! 눌러서 견인차를 부르세요.", 3000);
          SFX.warn();
          break;
        case "wreck":
          toast("💥 사고 차가 길을 막고 있어요. 눌러서 견인하세요.", 3500);
          break;
        case "closed":
          banner("🚧 공사로 길이 막혔어요! 차들이 우회합니다");
          break;
        case "tow":
          SFX.tick();
          break;
      }
    }
    G.emOn = sim.vehicles.some((v) => v.em);
    siren(G.emOn && !G.paused);
    if (G.tut) tutCheck();
  }
  function banner(text) {
    const b = $("banner");
    b.textContent = text;
    b.classList.remove("on");
    void b.offsetWidth;
    b.classList.add("on");
  }

  /* HUD: 실시간 교통 지표 */
  let hudT = 0;
  function updateHud() {
    const now = performance.now();
    if (now - hudT < 200) return;
    hudT = now;
    const s = G.sim.stats();
    const g = G.L.goal;
    const left = g.endless ? null : Math.max(0, g.time - s.t);
    const cong = Math.round(s.cong);
    const cls = cong >= 75 ? "bad" : cong >= 50 ? "warn" : "ok";
    const em = G.sim.vehicles.filter((v) => v.em);
    $("bar").innerHTML = `
      <div><span>${g.endless ? "생존" : "남은 시간"}</span><b>${fmtT(g.endless ? s.t : left)}</b></div>
      <div><span>통과</span><b>${s.passed}${g.pass > 1 ? `<small>/${g.pass}</small>` : ""}</b></div>
      <div><span>대기</span><b>${s.waiting}<small>대</small></b></div>
      <div><span>평균 대기</span><b>${s.avgWait.toFixed(1)}<small>초</small></b></div>
      <div class="th-cong ${cls}"><span>정체 지수</span><b>${cong}</b><i style="width:${Math.min(100, cong)}%"></i></div>
      <div class="${s.acc ? "bad" : ""}"><span>사고</span><b>${s.acc}<small>/${g.maxAcc != null ? g.maxAcc : 2}</small></b></div>
      <div class="${em.length ? "em" : ""}"><span>긴급</span><b>${em.length ? `🚨${Math.max(...em.map((v) => v.delay)).toFixed(0)}s` : s.emPassed ? `✔${s.emPassed}` : "-"}</b></div>
      <div class="th-score"><span>점수</span><b>${s.score.toLocaleString()}</b></div>`;
    // 선택 교차로 신호 상태 갱신
    const I = G.sim.net.inters[G.sel];
    $("dock")
      .querySelectorAll("[data-ph]")
      .forEach((b) => {
        const k = +b.dataset.ph;
        b.classList.toggle("cur", I.cur === k && I.state === "G");
        b.classList.toggle("next", I.state === "Y" && I.next === k);
      });
    const gt = $("dock").querySelector(".th-dock-t");
    if (gt) {
      const big = I.state === "G" ? G.sim.bigInBox(G.sel) : null;
      gt.textContent = I.state === "Y" ? "노란불…" : big ? `⚠ ${big.T.name} 통과 중 · 잠깐!` : `초록 ${I.greenT.toFixed(0)}초`;
      gt.classList.toggle("warn", !!big);
    }
  }

  /* 아래 신호 버튼 */
  function phaseIcon(pid) {
    const P = TH.PHASES[pid];
    const arrows = P.prot.concat(P.perm && G.sim.net.inters[G.sel].permLeft ? P.perm : []);
    // 작은 교차로 그림 + 화살표
    const A = { N: 0, E: 90, S: 180, W: 270 };
    let svg = `<svg viewBox="-12 -12 24 24" aria-hidden="true"><rect x="-3.6" y="-12" width="7.2" height="24" fill="#3a404a"/><rect x="-12" y="-3.6" width="24" height="7.2" fill="#3a404a"/>`;
    for (const m of arrows) {
      const rot = A[m[0]];
      const perm = P.perm && P.perm.includes(m);
      const col = perm ? "#b7e86a" : "#38e07f";
      const path = m[1] === "S" ? "M1.8 11 L1.8 -9" : m[1] === "R" ? "M1.8 11 L1.8 5 Q1.8 2.2 5 2.2 L10 2.2" : "M1.8 11 L1.8 3 Q1.8 -1.8 -3 -1.8 L-10 -1.8";
      svg += `<path d="${path}" transform="rotate(${rot})" stroke="${col}" stroke-width="1.6" fill="none" stroke-linecap="round" ${perm ? 'stroke-dasharray="2 1.4"' : ""} marker-end="url(#ah)"/>`;
    }
    svg += `<defs><marker id="ah" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="3.2" markerHeight="3.2" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="#38e07f"/></marker></defs></svg>`;
    return svg;
  }
  function renderDock() {
    const net = G.sim.net;
    const I = net.inters[G.sel];
    const multi = net.inters.length > 1;
    $("dock").innerHTML = `
      <div class="th-dock-head">${multi ? `<div class="th-isel">${net.inters.map((J, i) => `<button type="button" data-is="${i}" class="${i === G.sel ? "on" : ""}" aria-label="교차로 ${J.id} 고르기">${J.id}</button>`).join("")}</div>` : `<b>신호</b>`}<span class="th-dock-t"></span></div>
      <div class="th-phases">${I.phases.map((p, k) => `<button type="button" class="th-ph" data-ph="${k}" aria-label="${esc(p.name)} 신호"><span class="ic">${phaseIcon(p.id)}</span><span class="nm">${esc(p.name)}</span><kbd>${k + 1}</kbd></button>`).join("")}</div>`;
    $("dock")
      .querySelectorAll("[data-ph]")
      .forEach((b) => b.addEventListener("click", () => choosePhase(+b.dataset.ph)));
    $("dock")
      .querySelectorAll("[data-is]")
      .forEach((b) =>
        b.addEventListener("click", () => {
          G.sel = +b.dataset.is;
          renderDock();
        }),
      );
    hudT = 0;
  }
  function choosePhase(k) {
    if (!G || G.paused) return;
    G.sim.setPhase(G.sel, k);
    drain();
    hudT = 0;
    updateHud();
  }

  /* 화면 누르기: 고장 · 사고 차 = 견인, 교차로 = 선택 + 다음 신호 */
  function bindCanvas() {
    const cv = $("cv");
    cv.onpointerdown = (e) => {
      if (!G || G.paused || G.ended) return;
      e.preventDefault();
      const [wx, wy] = G.R.toWorld(e.clientX, e.clientY);
      const k = G.R.cssK;
      // 견인 대상: 아이콘(차 위쪽)이나 차 근처
      let best = null;
      let bd = 1e9;
      for (const v of G.sim.vehicles) {
        if (!(v.crashed || v.broken) || v.towing) continue;
        const d1 = Math.hypot(v.x - wx, v.y - wy);
        const d2 = Math.hypot(v.x - wx, v.y - 16 / k - wy);
        const d = Math.min(d1, d2);
        if (d < bd) {
          bd = d;
          best = v;
        }
      }
      if (best && bd < Math.max(5, 26 / k)) {
        G.sim.tow(best.id);
        drain();
        return;
      }
      let bi = -1;
      let bdi = 1e9;
      G.sim.net.inters.forEach((I, i) => {
        const d = Math.max(Math.abs(I.x - wx), Math.abs(I.y - wy)) - I.H;
        if (d < bdi) {
          bdi = d;
          bi = i;
        }
      });
      if (bi >= 0 && bdi < Math.max(9, 30 / k)) {
        if (G.sel !== bi) {
          G.sel = bi;
          renderDock();
        }
        G.sim.cyclePhase(bi);
        drain();
        hudT = 0;
      }
    };
  }
  window.addEventListener("resize", () => G && G.R && !$("game").hidden && G.R.resize());

  /* 키보드: 1~8 신호 · Tab/[ ] 교차로 · Space 다음 신호 · P 일시정지 · F 속도 · T 견인 */
  document.addEventListener("keydown", (e) => {
    if (!G || $("game").hidden || !$("modal").hidden) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const n = G.sim.net.inters.length;
    if (/^[1-8]$/.test(e.key)) {
      choosePhase(+e.key - 1);
      e.preventDefault();
    } else if (e.key === " ") {
      if (!G.paused) G.sim.cyclePhase(G.sel);
      drain();
      e.preventDefault();
    } else if (e.key === "]" || (e.key === "Tab" && !e.shiftKey && n > 1)) {
      G.sel = (G.sel + 1) % n;
      renderDock();
      e.preventDefault();
    } else if (e.key === "[" || (e.key === "Tab" && e.shiftKey && n > 1)) {
      G.sel = (G.sel + n - 1) % n;
      renderDock();
      e.preventDefault();
    } else if (e.key === "p" || e.key === "P") togglePause();
    else if (e.key === "f" || e.key === "F") toggleSpeed();
    else if (e.key === "t" || e.key === "T") {
      const v = G.sim.vehicles.find((o) => (o.crashed || o.broken) && !o.towing);
      if (v) G.sim.tow(v.id);
      drain();
    }
  });
  function togglePause() {
    if (!G || G.ended) return;
    G.paused = !G.paused;
    $("paused").hidden = !G.paused;
    $("pause-btn").textContent = G.paused ? "▶" : "Ⅱ";
    siren(G.emOn && !G.paused);
    G.last = performance.now();
  }
  function toggleSpeed() {
    if (!G) return;
    G.speed = G.speed === 1 ? 2 : 1;
    $("speed-btn").textContent = "×" + G.speed;
  }
  $("pause-btn").addEventListener("click", togglePause);
  $("resume-btn").addEventListener("click", togglePause);
  $("speed-btn").addEventListener("click", toggleSpeed);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && G && !G.paused && !G.ended && !$("game").hidden) togglePause();
  });
  $("quit-btn").addEventListener("click", () => {
    stopLoop();
    G = null;
    show("menu");
    renderMenu();
  });

  /* ---------- 끝 ---------- */
  const REASON = {
    pass: "목표 달성!",
    clear: "사고 수습 완료!",
    time: "시간 종료",
    acc: "사고가 너무 많이 났어요",
    grid: "도시 마비 — 차들이 꼼짝도 못 해요",
    cong: "정체 지수가 너무 오래 높았어요",
    em: "긴급 차량이 골든타임을 놓쳤어요",
    quit: "그만두었어요",
  };
  function onEnd() {
    G.ended = true;
    siren(false);
    const sim = G.sim;
    const L = G.L;
    const s = sim.stats();
    const win = sim.status === "win";
    const score = sim.total();
    const d = db();
    const st = dmState();
    const k = today();
    if (G.tut) {
      d.tutorial = true;
      save();
      modal(`<h2 id="modal-h">튜토리얼 완료!</h2><p>신호 바꾸기 · 노란불 · 안전한 전환까지 익혔어요. 이제 스테이지 1 부터 도시를 지켜 주세요.</p><div class="th-row"><button type="button" class="th-btn" id="t-menu">메뉴</button><button type="button" class="th-btn th-btn-hot" id="t-s1">스테이지 1 시작</button></div>`, () => {});
      $("t-menu").addEventListener("click", () => {
        $("modal").hidden = true;
        stopLoop();
        G = null;
        show("menu");
        renderMenu();
      });
      $("t-s1").addEventListener("click", () => {
        $("modal").hidden = true;
        brief(LV.STAGES[0], "stage");
      });
      return;
    }
    // 기록
    d.totals.plays++;
    d.totals.passed += s.passed;
    d.totals.acc += s.acc;
    // 연속 참여
    if (d.streak.last !== k) {
      d.streak.count = d.streak.last === addDays(k, -1) ? d.streak.count + 1 : 1;
      d.streak.last = k;
      d.streak.best = Math.max(d.streak.best, d.streak.count);
    }
    let newBest = false;
    let starsN = 0;
    if (G.mode === "stage" || G.mode === "mission") {
      const rec = G.mode === "stage" ? d.stages : d.missions;
      const r = rec[L.id] || { cleared: false, best: 0, stars: 0, plays: 0 };
      r.plays++;
      if (win) {
        starsN = G.mode === "stage" ? stageStars(L, { status: "win", score, acc: s.acc }) : 3;
        r.cleared = true;
        r.stars = Math.max(r.stars, starsN);
        if (score > r.best) {
          newBest = r.best > 0;
          r.best = score;
        }
        if (G.mode === "stage") {
          if (s.acc === 0) st.cleanStage = 1;
          if (starsN === 3) st.star3 = 1;
          if (s.avgWait <= 10) st.lowWait = 1;
        } else st.mission = 1;
      }
      rec[L.id] = r;
    } else if (G.mode === "endless") {
      const e = d.endless;
      e.plays++;
      st.endlessT = Math.max(st.endlessT, s.t);
      if (score > e.best) {
        newBest = e.best > 0;
        e.best = score;
      }
      e.time = Math.max(e.time, s.t);
      e.passed = Math.max(e.passed, s.passed);
      e.cong = Math.max(e.cong, s.maxCong);
    } else if (G.mode === "daily") {
      st.dailyDone = 1;
      const dd = d.daily[k] || { best: 0, plays: 0, first: score, passed: 0, acc: 0 };
      dd.plays++;
      if (score > dd.best) {
        newBest = dd.best > 0;
        dd.best = score;
        dd.passed = s.passed;
        dd.acc = s.acc;
      }
      d.daily[k] = dd;
      // 주간 합계 = 이번 주 날짜별 오늘의 최고 점수 합
      const wk = weekId(k);
      let sum = 0;
      let days = 0;
      for (const key of Object.keys(d.daily)) {
        if (weekId(key) === wk) {
          sum += d.daily[key].best;
          days++;
        }
        if (key < addDays(k, -40)) delete d.daily[key];
      }
      d.week = { id: wk, sum, days };
    }
    d.recent.unshift({ name: L.name, mode: G.mode, score, win: win || G.mode === "endless" || G.mode === "daily", date: k });
    d.recent = d.recent.slice(0, 12);
    save();
    if (newBest) SFX.record();
    else if (win || G.mode === "daily") SFX.win();
    else SFX.fail();

    const sc = sim.score;
    const rows = [
      ["차량 통과", sc.pass],
      ["대기 감점", sc.wait],
      ["사고 · 견인", sc.acc],
      ["긴급 차량", sc.em],
      ["보행자", sc.ped],
      ["신호 급변경", sc.sw],
      ["보너스", sc.bonus],
    ].filter((r) => Math.round(r[1]) !== 0);
    const title = G.mode === "endless" ? "교통지옥 종료" : G.mode === "daily" ? "오늘의 교통지옥 완주" : win ? "성공!" : "실패";
    const rankable = G.mode === "daily" || G.mode === "endless";
    const idx = G.mode === "stage" ? LV.STAGES.indexOf(LV.STAGES.find((x) => x.id === L.id)) : -1;
    const next = idx >= 0 && win && idx < LV.STAGES.length - 1 ? LV.STAGES[idx + 1] : null;
    modal(
      `<p class="th-kicker">${esc(L.name)}</p>
      <h2 id="modal-h" class="${win || G.mode === "daily" ? "w" : "l"}">${title}</h2>
      <p class="th-reason">${esc(REASON[sim.reason] || "")}</p>
      ${starsN ? `<p class="th-bigstars">${stars(starsN)}</p>` : ""}
      <p class="th-final">${score.toLocaleString()}<small>점</small>${newBest ? ' <em class="th-new">NEW BEST</em>' : ""}</p>
      <div class="th-res-grid">
        <div><span>통과</span><b>${s.passed}대</b></div>
        <div><span>평균 대기</span><b>${s.avgWait.toFixed(1)}초</b></div>
        <div><span>최고 정체</span><b>${Math.round(s.maxCong)}</b></div>
        <div><span>사고</span><b>${s.acc}건</b></div>
        <div><span>긴급 통과</span><b>${s.emPassed}대${s.emPassed ? ` · 최대 ${s.emMax.toFixed(1)}초` : ""}</b></div>
        <div><span>${G.mode === "endless" ? "생존" : "걸린 시간"}</span><b>${fmtT(s.t)}</b></div>
      </div>
      <table class="th-break">${rows.map(([a, b]) => `<tr><td>${a}</td><td class="${b < 0 ? "neg" : ""}">${b > 0 ? "+" : ""}${Math.round(b).toLocaleString()}</td></tr>`).join("")}</table>
      ${rankable ? `<form class="th-rankform" id="rank-form"><input id="rank-name" maxlength="8" placeholder="이름 2~8자" value="${esc(d.name || "")}" autocomplete="nickname"/><button type="submit" class="th-btn th-btn-hot">${G.mode === "daily" ? "오늘의 순위 등록" : "무한 랭킹 등록"}</button></form><p class="th-muted th-small" id="rank-msg"></p>` : ""}
      <div class="th-row"><button type="button" class="th-btn" id="r-menu">메뉴</button><button type="button" class="th-btn" id="r-again">다시</button>${next ? `<button type="button" class="th-btn th-btn-hot" id="r-next">다음 스테이지</button>` : ""}</div>`,
      () => {},
    );
    $("r-menu").addEventListener("click", () => {
      $("modal").hidden = true;
      stopLoop();
      G = null;
      show("menu");
      renderMenu();
    });
    $("r-again").addEventListener("click", () => {
      $("modal").hidden = true;
      startLevel(L, G.mode);
    });
    if (next) $("r-next").addEventListener("click", () => brief(next, "stage"));
    const form = $("rank-form");
    if (form) {
      const mode = G.mode;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = $("rank-name").value.trim();
        const msg = $("rank-msg");
        if (name.length < 2 || name.length > 8) return (msg.textContent = "이름은 2~8자로 적어 주세요");
        d.name = name;
        save();
        if (!window.TodayScores) return (msg.textContent = "랭킹 모듈을 불러오지 못했어요");
        msg.textContent = "등록 중…";
        const res = await TodayScores.submitScore(mode === "daily" ? "traffic-hell-daily" : "traffic-hell", name, score);
        if (res && res.ok) {
          msg.textContent = `등록 완료! 오늘 ${res.rankDay || res.rank || "-"}위${res.rankWeek ? ` · 이번 주 ${res.rankWeek}위` : ""}`;
          form.remove();
        } else msg.textContent = "등록하지 못했어요. 잠시 뒤 다시 해 주세요.";
      });
    }
  }

  /* ---------- 튜토리얼 (실제 교차로에서 직접) ---------- */
  const TUT = [
    { text: "<b>1/4</b> 북쪽 · 남쪽에 차가 줄을 섰어요. <b>교차로를 눌러</b> 신호를 바꿔 보세요.", done: (s) => s.net.inters[0].state === "Y" || s.net.inters[0].cur === 0 },
    { text: "<b>2/4</b> 노란불 2.5초 뒤 초록불! 차는 앞차와 거리를 두고 차례로 출발해요. 줄이 빠지는 걸 지켜보세요.", wait: 7 },
    { text: "<b>3/4</b> 이번엔 동쪽 · 서쪽이 기다려요. 아래 <b>'동서 직진'</b> 버튼으로도 바꿀 수 있어요.", done: (s) => s.net.inters[0].next === 1 || s.net.inters[0].cur === 1 },
    { text: "<b>4/4</b> 신호를 5초 안에 또 바꾸면 감점, 큰 차가 지나는 중에 바꾸면 사고 위험! 줄이 긴 쪽을 번갈아 보내 <b>12대</b>를 통과시키세요.", done: (s) => s.st.passed >= 12 },
  ];
  function tutStep(i) {
    G.tut.i = i;
    G.tut.t0 = G.sim.t;
    const c = $("coach");
    c.hidden = false;
    c.innerHTML = TUT[i].text;
  }
  function tutCheck() {
    const t = G.tut;
    const S = TUT[t.i];
    if (!S) return;
    const ok = S.done ? S.done(G.sim) : G.sim.t - t.t0 >= S.wait;
    if (ok && t.i < TUT.length - 1) tutStep(t.i + 1);
  }
  function startTutorial() {
    startLevel(LV.TUTORIAL, "tutorial", { tut: { i: 0 } });
  }
  $("tut-btn").addEventListener("click", startTutorial);

  /* ---------- 시작 ---------- */
  renderMenu();
  show("menu");
  if (!db().tutorial && !TEST) setTimeout(startTutorial, 300);

  if (TEST) {
    window.__thTest = {
      get G() {
        return G;
      },
      sim: null,
      startLevel: (kind, id) => {
        const L = kind === "stage" ? LV.STAGES.find((s) => s.id === id) : kind === "mission" ? LV.MISSIONS.find((s) => s.id === id) : kind === "endless" ? LV.ENDLESS : kind === "daily" ? LV.daily(today()) : LV.TUTORIAL;
        startLevel(L, kind === "tutorial" ? "tutorial" : kind, kind === "tutorial" ? { tut: { i: 0 } } : {});
        return G.sim;
      },
      stepN,
      bot: () => TH.bot(G.sim),
      today,
      db,
    };
  }
})();
