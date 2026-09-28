(() => {
  "use strict";

  const GAME_ID = "10-second";
  const TARGET = 10000; // ms
  const VISIBLE_MS = 3000; // 처음 3초만 시계를 보여준다
  const MAX_MS = 20000; // 이 이상은 자동 종료
  const GUARD_MS = 300; // START 를 두 번 눌러 바로 멈추는 실수 방지

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };
  const clock = $("clock");
  const playTop = $("play-top");

  let state = "title";
  let t0 = 0;
  let raf = 0;
  let blind = false;

  const GRADES = [
    { max: 10, name: "PERFECT", cls: "g-perfect", lines: ["완벽 그 자체! 인간 스톱워치 등장", "이건 기계도 어렵습니다", "오늘의 1등, 노려볼 만해요"] },
    { max: 50, name: "AMAZING", cls: "", lines: ["거의 완벽해요!", "조금만 더 하면 PERFECT", "감각이 살아 있네요"] },
    { max: 100, name: "GREAT", cls: "", lines: ["꽤 정확해요! 한 번 더?", "0.1초 안! 대단해요", "조금만 더 하면 완벽합니다"] },
    { max: 250, name: "GOOD", cls: "g-good", lines: ["나쁘지 않아요, 다시 도전해서 줄여보세요", "리듬을 조금만 조절하면 돼요", "다음엔 AMAZING 가능!"] },
    { max: Infinity, name: "TRY AGAIN", cls: "g-try", lines: ["아직 몸이 10초를 몰라요. 한 번 더!", "천천히, 하나… 둘… 세어 보세요", "다시 도전해서 기록을 줄여보세요"] },
  ];

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const sec3 = (ms) => (ms / 1000).toFixed(3);
  const fmtErr = (ms) => `${sec3(ms)}초`;

  /* ---------- 소리 (사이트 음소거 버튼을 따름) ---------- */
  let ac = null;
  function beep(freq, dur = 0.08, type = "sine", vol = 0.06, delay = 0) {
    try {
      if (window.TodayAudio && TodayAudio.isMuted && TodayAudio.isMuted()) return;
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      const t = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (_) {
      /* 소리는 없어도 게임은 된다 */
    }
  }

  /* ---------- 화면 ---------- */
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    document.body.classList.toggle("is-play", name === "play");
    document.body.classList.toggle("is-title", name === "title");
    state = name;
  }

  function pad(ms) {
    const s = Math.floor(ms / 1000);
    return `${String(s).padStart(2, "0")}.${String(Math.floor(ms % 1000)).padStart(3, "0")}`;
  }

  function tick(now) {
    if (state !== "play") return;
    const el = now - t0;
    if (el < VISIBLE_MS) {
      clock.textContent = pad(el);
    } else if (!blind) {
      blind = true;
      clock.textContent = "??.???";
      clock.classList.add("blind");
      playTop.textContent = "여기부터는 감으로!";
      playTop.classList.add("blind");
    }
    if (el >= MAX_MS) {
      stop(t0 + MAX_MS, true);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function start(e) {
    if (state === "play") return;
    if (e) e.preventDefault();
    blind = false;
    clock.classList.remove("blind");
    playTop.classList.remove("blind");
    playTop.textContent = "10초를 머릿속으로 세세요";
    clock.textContent = "00.000";
    show("play");
    // 누른 순간(이벤트 시각)부터 잰다
    t0 = e && e.timeStamp ? e.timeStamp : performance.now();
    beep(880, 0.12, "sine", 0.07);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function onStop(e) {
    if (state !== "play") return;
    const at = e && e.timeStamp ? e.timeStamp : performance.now();
    if (at - t0 < GUARD_MS) return;
    if (e) e.preventDefault();
    stop(at, false);
  }

  function stop(at, timeout) {
    cancelAnimationFrame(raf);
    const elapsed = Math.max(0, at - t0);
    const err = Math.round(Math.abs(elapsed - TARGET));
    showResult(elapsed, err, timeout);
  }

  function showResult(elapsed, err, timeout) {
    const g = GRADES.find((x) => err <= x.max);
    const gradeEl = $("grade");
    gradeEl.textContent = timeout ? "TIME OVER" : g.name;
    gradeEl.className = `grade ${timeout ? "g-try" : g.cls}`;
    $("result-time").textContent = sec3(elapsed);
    const sign = elapsed >= TARGET ? "+" : "−";
    $("result-diff").textContent = err === 0 ? "오차 0.000초 · PERFECT!" : `오차 ${fmtErr(err)} (${sign}${sec3(err)})`;
    $("result-line").textContent = timeout ? "20초가 지나서 멈췄어요. 10초에서 STOP!" : pick(g.lines);
    show("over");
    window.scrollTo(0, 0);

    if (err <= 10) {
      [880, 1175, 1568].forEach((f, i) => beep(f, 0.16, "triangle", 0.07, i * 0.09));
    } else if (err <= 100) {
      beep(1046, 0.14, "triangle", 0.06);
    } else {
      beep(220, 0.18, "sawtooth", 0.04);
      screens.over.classList.remove("shake");
      void screens.over.offsetWidth;
      screens.over.classList.add("shake");
    }

    const res = rc.finish(err, { label: fmtErr(err) });
    $("newbest").classList.toggle("hidden", !(res.newBest && res.prevBest != null));
  }

  /* ---------- 기록 패널 ---------- */
  const rc = window.TodayRecord.init({
    gameId: GAME_ID,
    gameTitle: "10초 정확히 맞추기",
    lowerIsBetter: true,
    format: fmtErr,
    gap: (better, mine) => fmtErr(Math.max(1, mine - better)),
    panel: $("record-panel"),
    share: (err) =>
      err === 0
        ? "Today Game에서 정확히 10.000초 PERFECT! 당신은 가능?"
        : `Today Game에서 10초를 ${fmtErr(err)} 차이로 맞췄습니다. 당신은 가능?`,
    // 다시 도전 = 바로 다음 판 시작 (시작 화면을 다시 거치지 않음)
    onRetry: (e) => {
      window.scrollTo(0, 0);
      start(e);
    },
  });

  async function paintTitle() {
    const el = $("title-stat");
    const mine = rc.summary();
    const board = await rc.refresh();
    const parts = [];
    if (board && board.length) parts.push(`오늘 1위 <b>${fmtErr(Number(board[0].score))}</b>`);
    if (mine.best != null) parts.push(`내 최고 <b>${fmtErr(mine.best)}</b>`);
    el.innerHTML = parts.length ? parts.join(" · ") : "오늘 첫 기록의 주인공이 되어 보세요";
  }

  /* ---------- 입력 ---------- */
  $("start-btn").addEventListener("pointerdown", start);
  screens.play.addEventListener("pointerdown", onStop);
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code !== "Space" && e.code !== "Enter") return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (state === "title") start(e);
    else if (state === "play") onStop(e);
  });
  show("title");
  paintTitle();
})();
