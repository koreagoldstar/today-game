(() => {
  "use strict";

  const GAME_ID = "color-reaction";
  const ROUNDS = 10;
  const PENALTY = 500; // 오답·너무 빠른 입력 한 번에 +0.5초
  const TIMEOUT = 3000; // 색이 뜬 뒤 3초 안에 못 누르면 그 라운드는 오답
  const COLORS = [
    { id: "red", name: "빨강", cls: "c-red" },
    { id: "blue", name: "파랑", cls: "c-blue" },
    { id: "green", name: "초록", cls: "c-green" },
    { id: "yellow", name: "노랑", cls: "c-yellow" },
  ];
  const KEYS = [
    ["Digit1", "KeyA"],
    ["Digit2", "KeyS"],
    ["Digit3", "KeyD"],
    ["Digit4", "KeyF"],
  ];

  const $ = (id) => document.getElementById(id);
  const screens = { title: $("title"), play: $("play"), over: $("over") };
  const blob = $("blob");
  const word = $("blob-word");
  const rule = $("rule");
  const pads = $("pads");
  const dotsEl = $("dots");
  const floatEl = $("float");

  let state = "title";
  let round = 0;
  let order = COLORS.slice();
  let target = null;
  let phase = "idle"; // wait | decoy | show | done
  let shownAt = 0;
  let penalty = 0;
  let firstTry = true;
  let timers = [];
  let results = []; // { rt, firstTry }
  let wrongs = 0;
  let prevTarget = null;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const later = (fn, ms) => timers.push(window.setTimeout(fn, ms));
  const clearTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };
  const shuffle = (a) => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const fmtScore = (n) => `${Number(n).toLocaleString("ko-KR")}점`;
  const sec3 = (ms) => (ms / 1000).toFixed(3);

  /* ---------- 소리 ---------- */
  let ac = null;
  function beep(freq, dur = 0.07, type = "sine", vol = 0.05, delay = 0) {
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
    } catch (_) {}
  }

  /* ---------- 화면 ---------- */
  function show(name) {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
    document.body.classList.toggle("is-play", name === "play");
    document.body.classList.toggle("is-title", name === "title");
    state = name;
  }

  function renderPads() {
    pads.innerHTML = "";
    order.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `pad ${c.cls}`;
      b.dataset.color = c.id;
      b.innerHTML = `<kbd>${i + 1}</kbd>${c.name}`;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        choose(c.id, b, e.timeStamp);
      });
      pads.appendChild(b);
    });
  }

  function renderDots() {
    dotsEl.innerHTML = "";
    for (let i = 0; i < ROUNDS; i++) {
      const d = document.createElement("i");
      const r = results[i];
      if (r) d.className = r.firstTry ? "ok" : "bad";
      else if (i === round) d.className = "now";
      dotsEl.appendChild(d);
    }
  }

  function setBlob(color, cls = "") {
    blob.className = `blob ${cls}`;
    blob.style.background = color ? getComputedStyle(document.documentElement).getPropertyValue(`--${color.id}`) : "";
  }

  function flash(text, good) {
    floatEl.textContent = text;
    floatEl.className = `float ${good ? "good" : "bad"}`;
    void floatEl.offsetWidth;
    floatEl.classList.add("show");
  }

  /* ---------- 라운드 ---------- */
  const RULES = {
    0: ["같은 색을 누르세요", false],
    3: ["색이 금방 사라져요! 잘 봐 두세요", true],
    4: ["글자 말고 색을 보세요!", true],
    6: ["버튼 위치가 바뀌어요!", true],
    8: ["가짜 색에 속지 마세요!", true],
  };

  function startRound() {
    clearTimers();
    penalty = 0;
    firstTry = true;
    $("round-no").textContent = String(round + 1);
    if (RULES[round]) {
      rule.textContent = RULES[round][0];
      rule.classList.toggle("alert", RULES[round][1]);
    }
    // 7라운드부터 버튼 자리가 섞인다
    if (round >= 6) {
      order = shuffle(COLORS);
      renderPads();
    }
    target = pick(COLORS.filter((c) => c !== prevTarget));
    prevTarget = target;
    renderDots();
    word.textContent = "";
    setBlob(null, "wait");
    phase = "wait";
    // 언제 뜰지 모르게 (예측 방지)
    later(showColor, rand(round < 3 ? 550 : 420, round < 3 ? 1100 : 950));
  }

  function showColor() {
    const decoys = round >= 8 ? shuffle(COLORS.filter((c) => c !== target)).slice(0, round === 9 ? 2 : 1) : [];
    let t = 0;
    decoys.forEach((d) => {
      later(() => {
        phase = "decoy";
        setBlob(d);
      }, t);
      t += round === 9 ? 150 : 180;
    });
    later(() => {
      phase = "show";
      setBlob(target);
      // 5라운드부터 다른 색 이름을 써서 헷갈리게 (스트룹)
      word.textContent = round >= 4 ? pick(COLORS.filter((c) => c !== target)).name : "";
      requestAnimationFrame((ts) => {
        shownAt = ts || performance.now();
      });
      shownAt = performance.now();
      // 4~6라운드: 잠깐 보여주고 사라짐 (9~10 라운드도 짧게)
      if (round >= 3 && round <= 5) later(() => phase === "show" && blob.classList.add("fade"), 700);
      later(() => {
        if (phase === "show") {
          wrongs += 1;
          record(TIMEOUT + penalty, false);
          flash("시간 초과!", false);
          beep(180, 0.2, "sawtooth", 0.04);
        }
      }, TIMEOUT);
    }, t);
  }

  function choose(colorId, btn, at) {
    if (state !== "play" || phase === "done") return;
    const now = at || performance.now();
    if (phase === "wait" || phase === "decoy") {
      // 너무 빨리 / 가짜 색에 반응
      penalty += PENALTY;
      firstTry = false;
      wrongs += 1;
      flash(phase === "wait" ? "너무 빨라요! +0.5초" : "가짜 색! +0.5초", false);
      shakePad(btn);
      beep(200, 0.12, "square", 0.035);
      return;
    }
    if (colorId === target.id) {
      const rt = Math.max(0, now - shownAt) + penalty;
      record(rt, firstTry);
      flash(firstTry ? `${sec3(rt)}초` : `${sec3(rt)}초`, true);
      blob.classList.remove("fade");
      blob.classList.add("hit");
      beep(firstTry ? 988 : 660, 0.08, "triangle", 0.06);
      return;
    }
    penalty += PENALTY;
    firstTry = false;
    wrongs += 1;
    flash("오답! +0.5초", false);
    shakePad(btn);
    blob.classList.remove("miss");
    void blob.offsetWidth;
    blob.classList.add("miss");
    beep(200, 0.12, "square", 0.035);
  }

  function shakePad(btn) {
    if (!btn) return;
    btn.classList.remove("wrong");
    void btn.offsetWidth;
    btn.classList.add("wrong");
  }

  function record(rt, ok) {
    phase = "done";
    clearTimers();
    results[round] = { rt, firstTry: ok };
    round += 1;
    renderDots();
    if (round >= ROUNDS) {
      later(finish, 380);
      return;
    }
    later(startRound, 260); // 즉시 다음 문제 (로딩 없음)
  }

  function start() {
    clearTimers();
    round = 0;
    results = [];
    wrongs = 0;
    prevTarget = null;
    order = COLORS.slice();
    renderPads();
    rule.classList.remove("alert");
    show("play");
    beep(660, 0.08, "sine", 0.05);
    startRound();
  }

  /* ---------- 결과 ---------- */
  function finish() {
    const rts = results.map((r) => r.rt);
    const avg = rts.reduce((a, b) => a + b, 0) / rts.length;
    const correct = results.filter((r) => r.firstTry).length;
    const score = Math.round(results.reduce((a, r) => a + Math.max(0, 1500 - r.rt), 0) + correct * 100);

    $("result-avg").textContent = sec3(avg);
    $("result-correct").textContent = `${correct} / ${ROUNDS}`;
    $("result-wrong").textContent = String(wrongs);
    $("result-score").textContent = score.toLocaleString("ko-KR");
    $("result-line").textContent =
      avg < 350 ? "번개 같은 반응! 오늘의 TOP 10에 도전하세요" : avg < 480 ? "빠르다! 0.05초만 줄이면 더 높은 순위!" : "집중하면 더 빨라져요. 다시 도전!";
    show("over");
    window.scrollTo(0, 0);
    [784, 988, 1175].forEach((f, i) => beep(f, 0.12, "triangle", 0.05, i * 0.08));

    lastAvg = avg;
    const res = rc.finish(score, { label: `${fmtScore(score)} · 평균 ${sec3(avg)}초` });
    $("newbest").classList.toggle("hidden", !(res.newBest && res.prevBest != null));
  }

  let lastAvg = 0;
  const rc = window.TodayRecord.init({
    gameId: GAME_ID,
    gameTitle: "색깔 반응 테스트",
    lowerIsBetter: false,
    format: fmtScore,
    gap: (better, mine) => fmtScore(Math.max(1, better - mine)),
    panel: $("record-panel"),
    share: () => `내 반응속도 ${sec3(lastAvg)}초. 이 기록 깰 수 있어? (Today Game 색깔 반응 테스트)`,
    onRetry: () => {
      window.scrollTo(0, 0);
      start();
    },
  });

  async function paintTitle() {
    const el = $("title-stat");
    const mine = rc.summary();
    const board = await rc.refresh();
    const parts = [];
    if (board && board.length) parts.push(`오늘 1위 <b>${fmtScore(Number(board[0].score))}</b>`);
    if (mine.best != null) parts.push(`내 최고 <b>${fmtScore(mine.best)}</b>`);
    el.innerHTML = parts.length ? parts.join(" · ") : "오늘 첫 기록의 주인공이 되어 보세요";
  }

  /* ---------- 입력 ---------- */
  $("start-btn").addEventListener("click", start);
  window.addEventListener("keydown", (e) => {
    if (e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
    if (state === "title" && (e.code === "Space" || e.code === "Enter")) {
      e.preventDefault();
      start();
      return;
    }
    if (state !== "play") return;
    const idx = KEYS.findIndex((k) => k.includes(e.code));
    if (idx < 0) return;
    e.preventDefault();
    const btn = pads.children[idx];
    if (btn) {
      btn.classList.add("down");
      window.setTimeout(() => btn.classList.remove("down"), 90);
    }
    choose(order[idx].id, btn, e.timeStamp);
  });

  show("title");
  paintTitle();
})();
