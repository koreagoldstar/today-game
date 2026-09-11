(() => {
  "use strict";

  const DAILY_COUNT = 5;
  const BANK = window.WISDOM_QUIZ_BANK || [];
  const todayKey = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  const STORAGE_RESULT = `tg_quiz_result_${todayKey}`;
  const STORAGE_BEST = "tg_quiz_best";

  function seedFromDate(key) {
    return Number(key.replace(/-/g, "")) || 1;
  }

  function mulberry32(seed) {
    return function rand() {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickDaily(bank, count, seed) {
    const rand = mulberry32(seed);
    const idx = bank.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx.slice(0, count).map((i) => {
      const item = bank[i];
      const optRand = mulberry32(seed + i * 7 + 3);
      const order = item.a.map((_, k) => k);
      for (let k = order.length - 1; k > 0; k -= 1) {
        const j = Math.floor(optRand() * (k + 1));
        [order[k], order[j]] = [order[j], order[k]];
      }
      return {
        q: item.q,
        a: order.map((k) => item.a[k]),
        c: order.indexOf(item.c),
      };
    });
  }

  const questions = pickDaily(BANK, DAILY_COUNT, seedFromDate(todayKey));
  const els = {
    quiz: document.getElementById("quiz-view"),
    result: document.getElementById("result-view"),
    dots: document.getElementById("dots"),
    qnum: document.getElementById("qnum"),
    qtext: document.getElementById("qtext"),
    opts: document.getElementById("opts"),
    feedback: document.getElementById("feedback"),
    next: document.getElementById("next-btn"),
    score: document.getElementById("score-text"),
    msg: document.getElementById("msg-text"),
    best: document.getElementById("best-badge"),
    timer: document.getElementById("timer-text"),
    share: document.getElementById("share-btn"),
    rank: document.getElementById("rank-slot"),
    day: document.getElementById("day-pill"),
  };

  let cur = 0;
  let score = 0;
  let answered = false;

  els.day.textContent = `${todayKey.slice(5).replace("-", "/")} · ${BANK.length}문항`;

  questions.forEach((_, i) => {
    const d = document.createElement("div");
    d.className = "dot" + (i === 0 ? " cur" : "");
    d.innerHTML = "<i></i>";
    els.dots.appendChild(d);
  });

  function nextResetTime() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number((parts.find((p) => p.type === "hour") || {}).value);
    const minute = Number((parts.find((p) => p.type === "minute") || {}).value);
    const remain = (23 - hour) * 60 + (60 - minute);
    const h = Math.floor(remain / 60);
    const m = remain % 60;
    return `${h}시간 ${m}분`;
  }

  function renderQuestion() {
    const item = questions[cur];
    els.qnum.textContent = `${cur + 1} / ${questions.length}`;
    els.qtext.textContent = item.q;
    els.opts.innerHTML = "";
    answered = false;
    els.feedback.textContent = "";
    els.next.classList.remove("show");
    [...els.dots.children].forEach((d, i) => {
      d.className = "dot" + (i < cur ? " done" : i === cur ? " cur" : "");
    });
    item.a.forEach((text, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opt";
      btn.textContent = text;
      btn.addEventListener("click", () => selectAnswer(i));
      els.opts.appendChild(btn);
    });
  }

  function selectAnswer(i) {
    if (answered) return;
    answered = true;
    const item = questions[cur];
    [...els.opts.children].forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === item.c) btn.classList.add("correct");
      else if (idx === i) btn.classList.add("wrong");
    });
    if (i === item.c) {
      score += 1;
      els.feedback.textContent = "정답이에요!";
    } else {
      els.feedback.textContent = `정답은 "${item.a[item.c]}" 였어요.`;
    }
    els.next.classList.add("show");
    els.next.textContent = cur === questions.length - 1 ? "결과 보기" : "다음 문제";
  }

  function finishQuiz(savedScore) {
    const finalScore = savedScore == null ? score : savedScore;
    let best = Number(localStorage.getItem(STORAGE_BEST) || "0");
    if (savedScore == null) {
      if (finalScore > best) {
        best = finalScore;
        localStorage.setItem(STORAGE_BEST, String(best));
      }
      localStorage.setItem(STORAGE_RESULT, String(finalScore));
    }
    els.quiz.classList.add("hide");
    els.result.classList.add("show");
    els.score.innerHTML = `${finalScore}<small>/${questions.length}</small>`;
    els.best.textContent = `최고기록 ${best}/${questions.length}`;
    els.msg.textContent =
      savedScore != null
        ? "오늘은 이미 풀었어요. 내일 또 만나요!"
        : finalScore === questions.length
          ? "완벽해요! 오늘의 상식왕"
          : finalScore >= 3
            ? "꽤 잘했어요! 내일도 도전해 봐요"
            : "괜찮아요, 내일 다시 도전해 봐요";
    els.timer.textContent = `다음 문제는 ${nextResetTime()} 후에 열려요`;
    if (window.TodayGameRank) {
      TodayGameRank.mount({
        gameId: "wisdom-quiz",
        gameTitle: "오늘의 상식퀴즈",
        formParent: els.rank,
      });
      if (savedScore == null) TodayGameRank.open(finalScore, { label: `${finalScore}/${questions.length}` });
    }
  }

  if (!BANK.length || !questions.length) {
    els.qtext.textContent = "문항을 불러오지 못했어요. 새로고침해 주세요.";
    return;
  }

  els.next.addEventListener("click", () => {
    cur += 1;
    if (cur >= questions.length) finishQuiz();
    else renderQuestion();
  });

  els.share.addEventListener("click", () => {
    const text = `오늘의 상식퀴즈 결과: ${els.score.textContent.replace("/", " / ")}\nhttps://www.todaygame.co.kr/games/wisdom-quiz/`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      els.share.textContent = "복사됐어요!";
      window.setTimeout(() => {
        els.share.textContent = "공유";
      }, 1400);
    }
  });

  const saved = localStorage.getItem(STORAGE_RESULT);
  if (saved !== null) finishQuiz(Number(saved));
  else renderQuestion();
})();
