(() => {
  "use strict";

  const ROWS = 6;
  const COLS = 5;
  const KEYS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ];

  const { VALID, seoulDay, getPuzzle, DAILY_LIMIT } = window.WordleWords;
  const day = seoulDay();
  const PROGRESS_KEY = `today-wordle-v2-${day}`;

  const boardEl = document.getElementById("board");
  const msgEl = document.getElementById("msg");
  const keyboardEl = document.getElementById("keyboard");
  const help = document.getElementById("help");
  const result = document.getElementById("result");
  const hintText = document.getElementById("hint-text");
  const hintMore = document.getElementById("hint-more");
  const hintExtra = document.getElementById("hint-extra");
  const nextBtn = document.getElementById("next-btn");
  const shareBtn = document.getElementById("share-btn");

  let puzzleIndex = 0;
  let wins = 0;
  let played = 0;
  /** @type {string} */
  let ANSWER = "";
  /** @type {string} */
  let HINT = "";
  let puzzleNo = 1;
  let total = DAILY_LIMIT;

  /** @type {string[][]} */
  let rows = emptyRows();
  /** @type {(null|"correct"|"present"|"absent")[][]} */
  let grades = emptyGrades();
  let row = 0;
  let col = 0;
  let done = false;
  let won = false;
  let paused = false;
  /** @type {Record<string, "correct"|"present"|"absent">} */
  let keyState = {};
  let letterHints = 0;

  function emptyRows() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(""));
  }

  function emptyGrades() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.day !== day) return;
      puzzleIndex = Math.max(0, Number(data.puzzleIndex) || 0);
      wins = Math.max(0, Number(data.wins) || 0);
      played = Math.max(0, Number(data.played) || 0);
      const cur = data.current;
      if (cur && cur.answer) {
        rows = cur.rows || emptyRows();
        grades = cur.grades || emptyGrades();
        row = cur.row || 0;
        col = cur.col || 0;
        done = Boolean(cur.done);
        won = Boolean(cur.won);
        keyState = cur.keyState || {};
        letterHints = Math.min(3, Number(cur.letterHints) || 0);
      }
    } catch (_) {
      /* ignore */
    }
  }

  function saveProgress() {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        day,
        puzzleIndex,
        wins,
        played,
        current: {
          answer: ANSWER,
          rows,
          grades,
          row,
          col,
          done,
          won,
          keyState,
          letterHints,
        },
      })
    );
  }

  function applyPuzzleMeta() {
    const p = getPuzzle(day, puzzleIndex);
    total = p.total;
    puzzleNo = p.index;
    ANSWER = p.word;
    HINT = p.hint;
    hintText.textContent = HINT;
    document.getElementById("day-pill").textContent = `${puzzleNo}/${total}`;
    document.getElementById("sub").textContent = `오늘 ${played}/${total} · 힌트 보고 맞춰요`;
  }

  function resetBoardState() {
    rows = emptyRows();
    grades = emptyGrades();
    row = 0;
    col = 0;
    done = false;
    won = false;
    paused = false;
    keyState = {};
    letterHints = 0;
  }

  function showMsg(text, ms = 1400) {
    msgEl.textContent = text;
    if (ms) {
      clearTimeout(showMsg._t);
      showMsg._t = setTimeout(() => {
        if (msgEl.textContent === text) msgEl.textContent = "";
      }, ms);
    }
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r += 1) {
      const rowEl = document.createElement("div");
      rowEl.className = "row";
      for (let c = 0; c < COLS; c += 1) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.id = `t-${r}-${c}`;
        rowEl.appendChild(tile);
      }
      boardEl.appendChild(rowEl);
    }
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    KEYS.forEach((line) => {
      const rowEl = document.createElement("div");
      rowEl.className = "key-row";
      line.forEach((k) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "key" + (k === "ENTER" || k === "⌫" ? " wide" : "");
        btn.dataset.key = k;
        btn.textContent = k === "ENTER" ? "입력" : k === "⌫" ? "지움" : k;
        btn.addEventListener("click", () => onKey(k));
        rowEl.appendChild(btn);
      });
      keyboardEl.appendChild(rowEl);
    });
  }

  function paint() {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const tile = document.getElementById(`t-${r}-${c}`);
        const ch = rows[r][c];
        const grade = grades[r][c];
        tile.textContent = ch;
        tile.className = "tile";
        tile.style.animationDelay = "";
        if (grade) {
          tile.classList.add(grade, "locked");
        } else if (ch) {
          tile.classList.add("filled");
          if (!done && r === row && c < letterHints) tile.classList.add("hinted");
        }
      }
    }
    keyboardEl.querySelectorAll(".key").forEach((btn) => {
      const k = btn.dataset.key;
      btn.classList.remove("correct", "present", "absent", "ready");
      if (k && keyState[k]) btn.classList.add(keyState[k]);
    });
    const enterBtn = keyboardEl.querySelector('.key[data-key="ENTER"]');
    if (enterBtn) {
      const ready = !done && col >= COLS && rows[row] && rows[row].every(Boolean);
      enterBtn.classList.toggle("ready", ready);
    }
  }

  function fillHintLetters() {
    if (done || letterHints <= 0) return;
    for (let i = 0; i < letterHints; i += 1) {
      rows[row][i] = ANSWER[i];
    }
    if (col < letterHints) col = letterHints;
  }

  function gradeWord(guess) {
    const res = Array(COLS).fill("absent");
    const ans = ANSWER.split("");
    const used = Array(COLS).fill(false);
    for (let i = 0; i < COLS; i += 1) {
      if (guess[i] === ans[i]) {
        res[i] = "correct";
        used[i] = true;
      }
    }
    for (let i = 0; i < COLS; i += 1) {
      if (res[i] === "correct") continue;
      for (let j = 0; j < COLS; j += 1) {
        if (!used[j] && guess[i] === ans[j]) {
          res[i] = "present";
          used[j] = true;
          break;
        }
      }
    }
    return res;
  }

  function rankKey(letter, grade) {
    const order = { correct: 3, present: 2, absent: 1 };
    const prev = keyState[letter];
    if (!prev || order[grade] > order[prev]) keyState[letter] = grade;
  }

  function shareText() {
    const lines = [];
    lines.push(`오늘의 워들 ${puzzleNo}/${total} ${won ? row + 1 : "X"}/${ROWS}`);
    lines.push(`오늘 클리어 ${wins} · 진행 ${played}/${total}`);
    lines.push("");
    for (let r = 0; r <= (won ? row : ROWS - 1); r += 1) {
      if (!grades[r] || !grades[r][0]) break;
      lines.push(
        grades[r]
          .map((g) => (g === "correct" ? "🟩" : g === "present" ? "🟨" : "⬜"))
          .join("")
      );
    }
    lines.push("");
    lines.push("https://www.todaygame.co.kr/games/wordle/");
    return lines.join("\n");
  }

  function openResult() {
    const finishedAll = puzzleIndex >= total - 1 && done;
    document.getElementById("result-badge").textContent = won ? "CLEAR" : "FAIL";
    document.getElementById("result-title").textContent = won ? "맞췄어요!" : "아쉬워요";
    document.getElementById("result-detail").textContent = won
      ? `${row + 1}번 만에 맞춤 · ${ANSWER}`
      : `정답은 ${ANSWER}`;
    document.getElementById("share-grid").textContent = shareText();
    document.getElementById("result-progress").textContent = `오늘 ${played}/${total} · 클리어 ${wins}`;

    if (finishedAll || puzzleIndex >= total - 1) {
      nextBtn.textContent = "오늘 문제 끝!";
      nextBtn.disabled = true;
      document.getElementById("result-next").textContent = "내일 0시에 다시 열려요";
    } else {
      nextBtn.textContent = `다음 문제 (${puzzleIndex + 2}/${total})`;
      nextBtn.disabled = false;
      document.getElementById("result-next").textContent = `남은 문제 ${total - puzzleIndex - 1}개`;
    }
    result.classList.remove("hidden");
    const leftover = won ? Math.max(0, 5 - row) : 0;
    const rankScore = Math.max(1, wins * 100 + leftover * 15);
    if (window.TodayGameRank) {
      TodayGameRank.mount({ gameId: "wordle", gameTitle: "오늘의 워들", formParent: result });
      TodayGameRank.open(rankScore);
    }
  }

  function closeResult() {
    result.classList.add("hidden");
  }

  function goNextPuzzle() {
    if (puzzleIndex >= total - 1) return;
    puzzleIndex += 1;
    resetBoardState();
    applyPuzzleMeta();
    // 저장된 current가 다음 문제와 안 맞게 남지 않도록 초기 저장
    saveProgress();
    fillHintLetters();
    paint();
    renderLetterHints();
    closeResult();
    showMsg(`문제 ${puzzleNo}/${total}`, 1200);
  }

  function finishPuzzle(didWin) {
    done = true;
    won = didWin;
    played += 1;
    if (didWin) wins += 1;
    saveProgress();
    renderLetterHints();
    applyPuzzleMeta();
    setTimeout(() => openResult(), 350);
  }

  function submit() {
    if (done) return;
    if (col < COLS) {
      showMsg("5글자를 모두 입력해요");
      return;
    }
    const guess = rows[row].join("");
    if (!VALID.has(guess)) {
      showMsg("목록에 없는 단어예요");
      const rowEl = boardEl.children[row];
      if (rowEl) {
        rowEl.classList.remove("shake");
        void rowEl.offsetWidth;
        rowEl.classList.add("shake");
      }
      return;
    }

    const g = gradeWord(guess);
    grades[row] = g;
    for (let i = 0; i < COLS; i += 1) {
      rankKey(guess[i], g[i]);
    }

    paint();
    for (let i = 0; i < COLS; i += 1) {
      const tile = document.getElementById(`t-${row}-${i}`);
      tile.classList.remove("pop");
      void tile.offsetWidth;
      tile.classList.add("pop");
      tile.style.animationDelay = `${i * 0.05}s`;
    }

    if (guess === ANSWER) {
      finishPuzzle(true);
      return;
    }
    if (row >= ROWS - 1) {
      finishPuzzle(false);
      return;
    }

    row += 1;
    col = 0;
    fillHintLetters();
    saveProgress();
    paint();
    showMsg("초록=자리 OK · 노랑=글자만 OK", 1400);
  }

  function onKey(k) {
    if (paused) return;
    if (done) {
      openResult();
      return;
    }
    if (k === "ENTER") {
      submit();
      return;
    }
    if (k === "⌫" || k === "BACKSPACE") {
      if (col > letterHints) {
        col -= 1;
        rows[row][col] = "";
        paint();
        saveProgress();
      } else if (col > 0 && col <= letterHints) {
        showMsg("힌트 글자는 고정이에요", 1000);
      }
      return;
    }
    if (/^[A-Z]$/.test(k) && col < COLS) {
      if (col < letterHints) col = letterHints;
      if (col >= COLS) return;
      rows[row][col] = k;
      col += 1;
      paint();
      saveProgress();
      if (col >= COLS) showMsg("「입력」을 누르세요!", 1600);
    }
  }

  function renderLetterHints() {
    if (letterHints <= 0) {
      hintExtra.hidden = true;
      hintExtra.textContent = "";
    } else {
      const shown = ANSWER.slice(0, letterHints)
        .split("")
        .join(" ")
        .concat(letterHints < COLS ? " · · ·" : "");
      hintExtra.hidden = false;
      hintExtra.textContent = `앞글자: ${shown}`;
    }
    if (done || letterHints >= 3) {
      hintMore.disabled = true;
      hintMore.textContent = letterHints >= 3 ? "글자 힌트 끝" : "끝났어요";
    } else {
      hintMore.disabled = false;
      hintMore.textContent = `글자 힌트 받기 (${letterHints}/3)`;
    }
  }

  function giveLetterHint() {
    if (paused) return;
    if (done || letterHints >= 3) return;
    letterHints += 1;
    fillHintLetters();
    renderLetterHints();
    paint();
    saveProgress();
    showMsg(`${letterHints}번째 글자 ${ANSWER[letterHints - 1]} 넣었어요!`, 1600);
  }

  hintMore.addEventListener("click", giveLetterHint);
  nextBtn.addEventListener("click", goNextPuzzle);

  document.getElementById("help-btn").addEventListener("click", () => help.classList.remove("hidden"));
  document.getElementById("help-close").addEventListener("click", () => {
    help.classList.add("hidden");
    localStorage.setItem("today-wordle-helped", "1");
  });

  shareBtn.addEventListener("click", async () => {
    const text = shareText();
    try {
      await navigator.clipboard.writeText(text);
      showMsg("결과 복사됨!", 1200);
    } catch (_) {
      showMsg("복사에 실패했어요", 1200);
    }
  });

  result.addEventListener("click", (e) => {
    if (e.target === result) closeResult();
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (paused) return;
    if (!result.classList.contains("hidden")) {
      if (e.key === "Enter" && !nextBtn.disabled) {
        e.preventDefault();
        goNextPuzzle();
      }
      return;
    }
    if (e.key === "Enter") onKey("ENTER");
    else if (e.key === "Backspace") onKey("⌫");
    else if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toUpperCase());
  });

  buildBoard();
  buildKeyboard();
  loadProgress();

  // 하루 100문제 모두 끝낸 경우
  if (puzzleIndex >= getPuzzle(day, 0).total) {
    puzzleIndex = getPuzzle(day, 0).total - 1;
  }

  applyPuzzleMeta();

  // 저장된 답이 현재 문제와 다르면(구버전/큐 변경) 보드 초기화
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && data.current && data.current.answer && data.current.answer !== ANSWER) {
      resetBoardState();
      saveProgress();
    }
  } catch (_) {
    /* ignore */
  }

  fillHintLetters();
  paint();
  renderLetterHints();

  if (!localStorage.getItem("today-wordle-helped")) {
    help.classList.remove("hidden");
  } else {
    help.classList.add("hidden");
  }

  if (done) {
    setTimeout(() => openResult(), 200);
  }

  if (seoulDay() !== day) {
    showMsg("날짜가 바뀌었어요. 새로고침!", 0);
  }

  if (window.TodayGameRank) {
    TodayGameRank.mount({
      gameId: "wordle",
      gameTitle: "오늘의 워들",
      formParent: result || document.body,
    });
  }

  if (window.TodayPause) {
    TodayPause.mount({
      canPause: () => !done && result.classList.contains("hidden") && help.classList.contains("hidden"),
      isPaused: () => paused,
      pause() {
        if (done || paused) return false;
        if (!result.classList.contains("hidden") || !help.classList.contains("hidden")) return false;
        paused = true;
        return true;
      },
      resume() {
        if (!paused) return false;
        paused = false;
        return true;
      },
    });
  }
})();
