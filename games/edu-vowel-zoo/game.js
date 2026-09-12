(() => {
  "use strict";

  const ROUNDS = 5;
  const { ASSET, VOWELS, shuffle } = window.TodayEduWords;
  const speak = (t) => window.speakSoftly && speakSoftly(t);
  const ding = () => window.TodayEduSpeak && TodayEduSpeak.ding();

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    jamo: document.getElementById("jamo"),
    choices: document.getElementById("choices"),
    progress: document.getElementById("progress-pill"),
    learned: document.getElementById("learned"),
    startBtn: document.getElementById("start-btn"),
    againBtn: document.getElementById("again-btn"),
    speakBtn: document.getElementById("speak-btn"),
  };

  let roundIndex = 0;
  let misses = 0;
  let locked = false;
  let current = null;
  const usedIds = [];

  function showOverlay(name) {
    els.title.classList.toggle("hidden", name !== "title");
    els.done.classList.toggle("hidden", name !== "done");
  }

  function pickQuestion() {
    const pool = VOWELS.filter((item) => !usedIds.includes(item.id));
    const vowel = (pool.length ? pool : VOWELS)[Math.floor(Math.random() * (pool.length || VOWELS.length))];
    const answer = vowel.items[Math.floor(Math.random() * vowel.items.length)];
    const others = VOWELS.filter((item) => item.id !== vowel.id).flatMap((item) =>
      item.items.map((pic) => ({ ...pic, vowel: item.id }))
    );
    const distractors = shuffle(others).slice(0, 2);
    const choices = shuffle([
      { ...answer, vowel: vowel.id, correct: true },
      ...distractors.map((pic) => ({ ...pic, correct: false })),
    ]);
    return { vowel, answer, choices };
  }

  function speakPrompt() {
    if (!current) return;
    speak(`${current.vowel.name}. ${current.vowel.name} 로 시작하는 걸 찾아볼까?`);
  }

  function renderChoices() {
    els.choices.innerHTML = "";
    current.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.dataset.correct = choice.correct ? "1" : "0";
      btn.setAttribute("aria-label", choice.word);
      btn.innerHTML = `<img src="${ASSET}${choice.file}" alt="" width="78" height="78" /><span class="word">${choice.word}</span>`;
      btn.addEventListener("click", () => onPick(btn, choice));
      els.choices.appendChild(btn);
    });
  }

  function startRound() {
    locked = false;
    misses = 0;
    current = pickQuestion();
    usedIds.push(current.vowel.id);
    els.jamo.textContent = current.vowel.name;
    els.progress.textContent = `${roundIndex + 1} / ${ROUNDS}`;
    renderChoices();
    speakPrompt();
  }

  function hintCorrect() {
    const btn = els.choices.querySelector('[data-correct="1"]');
    if (btn) btn.classList.add("hint");
  }

  function onPick(btn, choice) {
    if (locked || !current) return;
    if (choice.correct) {
      locked = true;
      btn.classList.add("correct");
      ding();
      speak(choice.word);
      if (window.TodayEdu) TodayEdu.recordResult("level1", current.vowel.id, true);
      window.setTimeout(nextRound, 1100);
      return;
    }
    btn.classList.remove("shake");
    void btn.offsetWidth;
    btn.classList.add("shake");
    misses += 1;
    if (window.TodayEdu) TodayEdu.recordResult("level1", current.vowel.id, false);
    speak("다시 들어볼까?");
    window.setTimeout(speakPrompt, 700);
    if (misses >= 3) hintCorrect();
  }

  function nextRound() {
    roundIndex += 1;
    if (roundIndex >= ROUNDS) {
      finish();
      return;
    }
    startRound();
  }

  function finish() {
    if (window.TodayEdu) TodayEdu.completeAttempt("level1");
    const data = window.TodayEdu ? TodayEdu.load() : null;
    els.learned.textContent =
      data && data.todayLearned && data.todayLearned.length ? data.todayLearned.join("  ") : usedIds.join("  ");
    showOverlay("done");
    speak(window.TodayEdu ? TodayEdu.todaySummary(data) || "잘했어요" : "잘했어요");
  }

  function startGame() {
    if (window.TodayEduSpeak) TodayEduSpeak.unlock();
    roundIndex = 0;
    usedIds.length = 0;
    showOverlay(null);
    startRound();
  }

  els.startBtn.addEventListener("click", startGame);
  els.againBtn.addEventListener("click", startGame);
  els.speakBtn.addEventListener("click", speakPrompt);
})();
