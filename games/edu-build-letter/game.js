(() => {
  "use strict";

  const ROUNDS = 5;
  const { ASSET, SYLLABLES, BATCHIM, shuffle } = window.TodayEduWords;
  const speak = (t) => window.speakSoftly && speakSoftly(t);
  const ding = () => window.TodayEduSpeak && TodayEduSpeak.ding();

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    pad: document.getElementById("pad"),
    blocks: document.getElementById("blocks"),
    hint: document.getElementById("hint"),
    assoc: document.getElementById("assoc"),
    assocImg: document.getElementById("assoc-img"),
    assocWord: document.getElementById("assoc-word"),
    progress: document.getElementById("progress-pill"),
    learned: document.getElementById("learned"),
    startBtn: document.getElementById("start-btn"),
    againBtn: document.getElementById("again-btn"),
    speakBtn: document.getElementById("speak-btn"),
  };

  let roundIndex = 0;
  let locked = false;
  let current = null;
  let placed = {};
  let dragging = null;
  const used = [];

  function showOverlay(name) {
    els.title.classList.toggle("hidden", name !== "title");
    els.done.classList.toggle("hidden", name !== "done");
  }

  function pool() {
    const data = window.TodayEdu ? TodayEdu.load() : null;
    const withBatchim = data && (data.level2.attemptsCompleted || 0) >= 3;
    return withBatchim ? SYLLABLES.concat(BATCHIM) : SYLLABLES;
  }

  function pick() {
    const list = pool().filter((s) => !used.includes(s.text));
    const src = list.length ? list : pool();
    return src[Math.floor(Math.random() * src.length)];
  }

  function speakPrompt() {
    if (!current) return;
    if (current.jong) {
      speak(`${current.cho}, ${current.jung}, ${current.jong}. 붙여볼까?`);
    } else {
      speak(`${current.cho} 하고 ${current.jung} 를 붙여볼까?`);
    }
  }

  function needed() {
    return current && current.jong ? 3 : 2;
  }

  function updatePad() {
    const parts = [placed.cho, placed.jung, placed.jong].filter(Boolean);
    els.pad.textContent = parts.join(" ");
  }

  function tryMerge() {
    if (!current) return;
    if (!placed.cho || !placed.jung) return;
    if (current.jong && !placed.jong) return;
    locked = true;
    els.pad.classList.add("ready");
    els.pad.textContent = current.text;
    els.assocImg.src = `${ASSET}${current.file}`;
    els.assocWord.textContent = current.word;
    els.assoc.classList.add("show");
    ding();
    speak(`${current.text}. ${current.word}`);
    if (window.TodayEdu) TodayEdu.recordResult("level2", current.text, true);
    window.setTimeout(nextRound, 1200);
  }

  function place(role, glyph, el) {
    if (locked || placed[role]) return;
    placed[role] = glyph;
    el.classList.add("ghost");
    updatePad();
    tryMerge();
  }

  function bindDrag(el, role, glyph) {
    el.addEventListener("pointerdown", (e) => {
      if (locked || placed[role]) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      dragging = { el, role, glyph, x: e.clientX, y: e.clientY };
      el.classList.add("dragging");
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging || dragging.el !== el) return;
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
    });
    el.addEventListener("pointerup", (e) => {
      if (!dragging || dragging.el !== el) return;
      const pad = els.pad.getBoundingClientRect();
      const hit =
        e.clientX >= pad.left && e.clientX <= pad.right && e.clientY >= pad.top && e.clientY <= pad.bottom;
      const moved = Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y);
      el.classList.remove("dragging");
      el.style.left = "";
      el.style.top = "";
      dragging = null;
      if (hit || moved < 14) place(role, glyph, el);
    });
    el.addEventListener("click", () => {
      if (locked || placed[role]) return;
      place(role, glyph, el);
    });
    el.addEventListener("pointercancel", () => {
      if (!dragging || dragging.el !== el) return;
      el.classList.remove("dragging");
      el.style.left = "";
      el.style.top = "";
      dragging = null;
    });
  }

  function renderBlocks() {
    els.blocks.innerHTML = "";
    const cho = document.createElement("div");
    cho.className = "block";
    cho.textContent = current.cho;
    bindDrag(cho, "cho", current.cho);
    const jung = document.createElement("div");
    jung.className = "block jung";
    jung.textContent = current.jung;
    bindDrag(jung, "jung", current.jung);
    els.blocks.appendChild(cho);
    els.blocks.appendChild(jung);
    if (current.jong) {
      const jong = document.createElement("div");
      jong.className = "block jong";
      jong.textContent = current.jong;
      bindDrag(jong, "jong", current.jong);
      els.blocks.appendChild(jong);
    }
  }

  function startRound() {
    locked = false;
    placed = {};
    current = pick();
    used.push(current.text);
    els.pad.classList.remove("ready");
    els.pad.textContent = "";
    els.assoc.classList.remove("show");
    els.progress.textContent = `${roundIndex + 1} / ${ROUNDS}`;
    els.hint.textContent = current.jong
      ? `${current.cho}  ${current.jung}  ${current.jong} 를 가운데로`
      : `${current.cho} 하고 ${current.jung} 를 가운데로`;
    renderBlocks();
    speakPrompt();
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
    if (window.TodayEdu) TodayEdu.completeAttempt("level2");
    const data = window.TodayEdu ? TodayEdu.load() : null;
    els.learned.textContent =
      data && data.todayLearned && data.todayLearned.length ? data.todayLearned.join("  ") : used.join("  ");
    showOverlay("done");
    speak(window.TodayEdu ? TodayEdu.todaySummary(data) || "잘했어요" : "잘했어요");
  }

  function startGame() {
    if (window.TodayEduSpeak) TodayEduSpeak.unlock();
    roundIndex = 0;
    used.length = 0;
    showOverlay(null);
    startRound();
  }

  els.startBtn.addEventListener("click", startGame);
  els.againBtn.addEventListener("click", startGame);
  els.speakBtn.addEventListener("click", speakPrompt);
})();
