(() => {
  "use strict";

  const ROUNDS = 5;
  const { ASSET, SENTENCES, shuffle } = window.TodayEduWords;
  const speak = (t) => window.speakSoftly && speakSoftly(t);
  const ding = () => window.TodayEduSpeak && TodayEduSpeak.ding();

  const els = {
    title: document.getElementById("title"),
    done: document.getElementById("done"),
    hint: document.getElementById("hint"),
    hero: document.getElementById("hero"),
    sentence: document.getElementById("sentence"),
    slots: document.getElementById("slots"),
    chunks: document.getElementById("chunks"),
    progress: document.getElementById("progress-pill"),
    learned: document.getElementById("learned"),
    startBtn: document.getElementById("start-btn"),
    againBtn: document.getElementById("again-btn"),
    speakBtn: document.getElementById("speak-btn"),
  };

  let roundIndex = 0;
  let locked = false;
  let current = null;
  let pieces = [];
  let queue = [];
  let placed = [null, null, null];
  let dragging = null;
  const used = [];

  function showOverlay(name) {
    els.title.classList.toggle("hidden", name !== "title");
    els.done.classList.toggle("hidden", name !== "done");
  }

  function partHtml(part) {
    const img = part.file ? `<img src="${ASSET}${part.file}" alt="" width="48" height="48" />` : "";
    return `${img}<span class="word">${part.text}</span>`;
  }

  function firstEmpty() {
    return placed.findIndex((item) => !item);
  }

  function renderSlots() {
    els.slots.innerHTML = "";
    for (let i = 0; i < 3; i += 1) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "sent-slot" + (placed[i] ? " filled" : "");
      slot.dataset.slot = String(i);
      slot.setAttribute("aria-label", placed[i] ? placed[i].text : `${i + 1}번 자리`);
      if (placed[i]) slot.innerHTML = partHtml(placed[i]);
      slot.addEventListener("click", () => {
        if (locked || !placed[i]) return;
        placed[i] = null;
        renderAll();
      });
      els.slots.appendChild(slot);
    }
  }

  function placePart(part, slotIndex) {
    if (locked || placed[slotIndex]) return false;
    placed[slotIndex] = part;
    renderAll();
    tryComplete();
    return true;
  }

  function bindDrag(el, part) {
    el.addEventListener("pointerdown", (e) => {
      if (locked || placed.some((item) => item && item.order === part.order)) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      dragging = { el, part, x: e.clientX, y: e.clientY };
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
      const moved = Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y);
      const hit = [...els.slots.children].findIndex((slot) => {
        const box = slot.getBoundingClientRect();
        return e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
      });
      el.classList.remove("dragging");
      el.style.left = "";
      el.style.top = "";
      dragging = null;
      if (hit >= 0) {
        placePart(part, hit);
        return;
      }
      if (moved < 14) {
        const empty = firstEmpty();
        if (empty >= 0) placePart(part, empty);
      }
    });
    el.addEventListener("click", () => {
      if (locked || dragging) return;
      if (placed.some((item) => item && item.order === part.order)) return;
      const empty = firstEmpty();
      if (empty >= 0) placePart(part, empty);
    });
    el.addEventListener("pointercancel", () => {
      if (!dragging || dragging.el !== el) return;
      el.classList.remove("dragging");
      el.style.left = "";
      el.style.top = "";
      dragging = null;
    });
  }

  function renderChunks() {
    els.chunks.innerHTML = "";
    pieces.forEach((part) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sent-chunk";
      if (placed.some((item) => item && item.order === part.order)) btn.classList.add("ghost");
      btn.innerHTML = partHtml(part);
      btn.setAttribute("aria-label", part.text);
      bindDrag(btn, part);
      els.chunks.appendChild(btn);
    });
  }

  function renderAll() {
    renderSlots();
    renderChunks();
  }

  function tryComplete() {
    if (placed.some((item) => !item) || locked) return;
    const ok = placed.every((item, i) => item.order === i);
    if (!ok) {
      locked = true;
      [...els.slots.children].forEach((slot) => slot.classList.add("shake"));
      speak("다시 해볼까?");
      window.setTimeout(() => {
        placed = [null, null, null];
        locked = false;
        renderAll();
      }, 750);
      return;
    }
    locked = true;
    [...els.slots.children].forEach((slot) => slot.classList.add("ready"));
    els.sentence.textContent = current.sentence;
    const heroFile = current.parts[0] && current.parts[0].file;
    if (heroFile) {
      els.hero.hidden = false;
      els.hero.src = `${ASSET}${heroFile}`;
      els.hero.classList.remove("bounce");
      void els.hero.offsetWidth;
      els.hero.classList.add("bounce");
    }
    ding();
    speak(current.sentence);
    used.push(current.sentence);
    if (window.TodayEdu) TodayEdu.recordResult("level4", current.sentence, true);
    window.setTimeout(nextRound, 1600);
  }

  function startRound() {
    locked = false;
    placed = [null, null, null];
    current = queue[roundIndex];
    pieces = shuffle(current.parts.map((part, order) => ({ ...part, order })));
    els.sentence.textContent = "";
    els.hero.hidden = true;
    els.hero.classList.remove("bounce");
    els.progress.textContent = `${roundIndex + 1} / ${ROUNDS}`;
    els.hint.textContent = "조각을 순서대로 놓아 문장을 만들어요";
    renderAll();
    speak("조각을 순서대로 놓아볼까?");
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
    if (window.TodayEdu) TodayEdu.completeAttempt("level4");
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
    queue = shuffle(SENTENCES).slice(0, ROUNDS);
    showOverlay(null);
    startRound();
  }

  els.startBtn.addEventListener("click", startGame);
  els.againBtn.addEventListener("click", startGame);
  els.speakBtn.addEventListener("click", () => {
    if (els.sentence.textContent) speak(els.sentence.textContent);
    else speak("조각을 순서대로 놓아볼까?");
  });
})();
