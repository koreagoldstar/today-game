/**
 * 교육 · 한글 진행 기록 (localStorage only)
 * key: todaygame_edu_progress
 */
(() => {
  "use strict";

  const KEY = "todaygame_edu_progress";

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function empty() {
    return {
      level1: { attemptsCompleted: 0, mastered: [], streaks: {} },
      level2: { attemptsCompleted: 0, mastered: [], streaks: {} },
      level3: { attemptsCompleted: 0, mastered: [], streaks: {} },
      todayLearned: [],
      lastPlayedDate: "",
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return empty();
      const base = empty();
      const mergeLevel = (src) => ({
        attemptsCompleted: Number(src && src.attemptsCompleted) || 0,
        mastered: Array.isArray(src && src.mastered) ? src.mastered.slice() : [],
        streaks: src && src.streaks && typeof src.streaks === "object" ? { ...src.streaks } : {},
      });
      const data = {
        ...base,
        level1: mergeLevel(parsed.level1),
        level2: mergeLevel(parsed.level2),
        level3: mergeLevel(parsed.level3),
        todayLearned: Array.isArray(parsed.todayLearned) ? parsed.todayLearned.slice() : [],
        lastPlayedDate: typeof parsed.lastPlayedDate === "string" ? parsed.lastPlayedDate : "",
      };
      const today = todayKey();
      if (data.lastPlayedDate !== today) data.todayLearned = [];
      return data;
    } catch (_) {
      return empty();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (_) {
      /* ignore */
    }
  }

  function touchDate(data) {
    const today = todayKey();
    if (data.lastPlayedDate !== today) {
      data.todayLearned = [];
      data.lastPlayedDate = today;
    }
    return data;
  }

  function recordResult(levelKey, itemId, correct) {
    const data = touchDate(load());
    const level = data[levelKey] || data.level1;
    const streaks = level.streaks || {};
    if (correct) {
      streaks[itemId] = (Number(streaks[itemId]) || 0) + 1;
      if (streaks[itemId] >= 2 && !level.mastered.includes(itemId)) {
        level.mastered.push(itemId);
      }
      if (streaks[itemId] >= 2 && !data.todayLearned.includes(itemId)) {
        data.todayLearned.push(itemId);
      }
    } else {
      streaks[itemId] = 0;
    }
    level.streaks = streaks;
    data[levelKey] = level;
    save(data);
    return data;
  }

  function completeAttempt(levelKey) {
    const data = touchDate(load());
    const level = data[levelKey] || data.level1;
    level.attemptsCompleted = (Number(level.attemptsCompleted) || 0) + 1;
    data[levelKey] = level;
    save(data);
    return data;
  }

  function level2Unlocked(data) {
    const d = data || load();
    return (d.level1.mastered || []).length >= 7 || (d.level1.attemptsCompleted || 0) >= 10;
  }

  function level3Unlocked(data) {
    const d = data || load();
    if (!level2Unlocked(d)) return false;
    return (d.level2.mastered || []).length >= 5 || (d.level2.attemptsCompleted || 0) >= 8;
  }

  function todaySummary(data) {
    const d = data || load();
    const today = todayKey();
    if (d.lastPlayedDate !== today || !d.todayLearned.length) return "";
    return `오늘 ${d.todayLearned.join(", ")} 을 배웠어요`;
  }

  function unlockHint(data) {
    const d = data || load();
    if (!level2Unlocked(d)) {
      return "자물쇠는 다음 단계예요. 자음 동물원이랑 글자 찾기를 하면 열려요.";
    }
    if (!level3Unlocked(d)) {
      return "자물쇠는 다음 단계예요. 짝짓기랑 글자 조립을 하면 열려요.";
    }
    return "";
  }

  window.TodayEdu = {
    KEY,
    todayKey,
    load,
    save,
    recordResult,
    completeAttempt,
    level2Unlocked,
    level3Unlocked,
    todaySummary,
    unlockHint,
  };
  // 호환 별칭
  TodayEdu.level2Unlocked = level2Unlocked;
  TodayEdu.level3Unlocked = level3Unlocked;
  TodayEdu.todaySummary = todaySummary;
  TodayEdu.completeAttempt = completeAttempt;
})();
