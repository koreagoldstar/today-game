/**
 * 비로그인 리텐션: 연속 방문 스트릭 + 어제 대비 점수 비교.
 * localStorage only — no server, no account.
 */
(() => {
  "use strict";

  const KEY = "todaygame_visit";
  const SKIP_COMPARE = new Set(["omok"]);
  const LOWER_IS_BETTER = new Set(["minesweeper", "wordle", "reaction"]);

  function localDayKey(date) {
    const d = date ? new Date(date) : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDayKey(d);
  }

  function emptyStore() {
    return { lastVisitDate: "", streakCount: 0, scoresByGame: {} };
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyStore();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return emptyStore();
      return {
        lastVisitDate: typeof parsed.lastVisitDate === "string" ? parsed.lastVisitDate : "",
        streakCount: Number(parsed.streakCount) || 0,
        scoresByGame:
          parsed.scoresByGame && typeof parsed.scoresByGame === "object" ? parsed.scoresByGame : {},
      };
    } catch (_) {
      return emptyStore();
    }
  }

  function writeStore(store) {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (_) {
      /* private mode / quota */
    }
  }

  function ensureStyles() {
    if (document.getElementById("today-retention-style")) return;
    const style = document.createElement("style");
    style.id = "today-retention-style";
    style.textContent = `
.yesterday-feedback{margin:8px 0 4px;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.45;text-align:center;background:rgba(255,255,255,.88);color:#3d2a36;border:1px solid rgba(255,107,157,.28)}
.yesterday-feedback[hidden]{display:none}
.yesterday-feedback[data-type="up"]{background:linear-gradient(180deg,#fff8e8,#ffe9c4);border-color:rgba(255,176,60,.45)}
.yesterday-feedback[data-type="down"]{background:rgba(255,255,255,.9)}
.yesterday-feedback[data-type="same"]{background:rgba(255,255,255,.9)}
`;
    document.head.appendChild(style);
  }

  function formatStreakText(streakCount) {
    const n = Number(streakCount) || 0;
    if (n >= 10) return `👑 ${n}일 연속 방문중`;
    if (n >= 5) return `🔥🔥 ${n}일 연속! 대단해요`;
    if (n >= 2) return `🔥 ${n}일 연속 도전중`;
    return "";
  }

  function formatFeedback(feedback) {
    if (!feedback) return "";
    if (feedback.type === "up") {
      return `어제보다 ${Number(feedback.diff).toLocaleString("ko-KR")}점 올랐어요 📈`;
    }
    if (feedback.type === "down") {
      return `어제보다 ${Number(feedback.diff).toLocaleString("ko-KR")}점 아쉬웠어요. 다시 도전해보세요`;
    }
    return "어제랑 똑같은 기록이에요";
  }

  function ensureFeedbackEl(parent) {
    if (!parent) return null;
    ensureStyles();
    let el = parent.querySelector(":scope > .yesterday-feedback");
    if (!el) {
      el = document.createElement("p");
      el.className = "yesterday-feedback";
      el.setAttribute("role", "status");
      el.hidden = true;
      const form = parent.querySelector("#today-rank-form, .rank-form, .today-rank-form, #rank-panel");
      const detail = parent.querySelector(
        "#over-detail, #win-detail, #result-detail, #all-detail, #clear-detail, #result-note, #result-ms"
      );
      if (form) parent.insertBefore(el, form);
      else if (detail && detail.nextSibling) parent.insertBefore(el, detail.nextSibling);
      else parent.appendChild(el);
    }
    return el;
  }

  function showFeedback(parent, feedback) {
    const el = ensureFeedbackEl(parent);
    if (!el) return;
    if (!feedback) {
      el.hidden = true;
      el.textContent = "";
      el.removeAttribute("data-type");
      return;
    }
    el.hidden = false;
    el.dataset.type = feedback.type;
    el.textContent = formatFeedback(feedback);
  }

  function updateStreak() {
    const today = localDayKey();
    const stored = readStore();
    const yStr = yesterdayKey();
    let streakCount = stored.streakCount || 0;

    if (stored.lastVisitDate === today) {
      /* already counted today */
    } else if (stored.lastVisitDate === yStr) {
      streakCount += 1;
    } else {
      streakCount = 1;
    }

    const updated = { ...stored, lastVisitDate: today, streakCount };
    writeStore(updated);
    return { streakCount, isFirstVisitToday: stored.lastVisitDate !== today };
  }

  function renderStreakBadge(el, streakCount) {
    if (!el) return;
    const n = Number(streakCount) || 0;
    if (n < 2) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = formatStreakText(n);
  }

  function compareWithYesterday(gameSlug, todayScore, higherIsBetter) {
    if (!gameSlug) return null;
    const score = Number(todayScore);
    if (!Number.isFinite(score)) return null;

    const stored = readStore();
    const scores = stored.scoresByGame || {};
    const prev = scores[gameSlug];
    const today = localDayKey();
    const yStr = yesterdayKey();
    const better = higherIsBetter !== false;

    let feedback = null;
    if (prev && prev.date === yStr && Number.isFinite(Number(prev.score))) {
      const diff = better ? score - Number(prev.score) : Number(prev.score) - score;
      if (diff > 0) feedback = { type: "up", diff: Math.abs(diff) };
      else if (diff < 0) feedback = { type: "down", diff: Math.abs(diff) };
      else feedback = { type: "same" };
    }

    scores[gameSlug] = { date: today, score };
    writeStore({ ...stored, scoresByGame: scores });
    return feedback;
  }

  function compareAndShow(gameSlug, todayScore, higherIsBetter, parent) {
    if (SKIP_COMPARE.has(gameSlug)) return null;
    const feedback = compareWithYesterday(gameSlug, todayScore, higherIsBetter);
    if (parent) showFeedback(parent, feedback);
    return feedback;
  }

  function higherIsBetter(gameSlug) {
    return !LOWER_IS_BETTER.has(gameSlug);
  }

  window.TodayVisit = {
    KEY,
    localDayKey,
    updateStreak,
    renderStreakBadge,
    compareWithYesterday,
    compareAndShow,
    formatFeedback,
    formatStreakText,
    higherIsBetter,
    skipCompare(id) {
      return SKIP_COMPARE.has(id);
    },
  };
})();
