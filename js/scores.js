(() => {
  "use strict";

  const ENDPOINT = "/api/scores";

  /**
   * @param {"flappy"|"tetris"|"doodle"|"jump-run"|"ninja-dodge"} game
   * @param {number} [limit]
   * @param {"day"|"week"} [period]
   */
  async function fetchScores(game, limit = 20, period = "day") {
    try {
      const q = new URLSearchParams({
        game,
        limit: String(limit),
        period,
      });
      const res = await fetch(`${ENDPOINT}?${q}`, { cache: "no-store" });
      const data = await res.json();
      return {
        ok: res.ok,
        configured: Boolean(data.configured),
        scores: Array.isArray(data.scores) ? data.scores : [],
        period: data.period || period,
        periodId: data.periodId || null,
        day: data.day || null,
        week: data.week || null,
        error: data.error || null,
      };
    } catch (err) {
      return {
        ok: false,
        configured: false,
        scores: [],
        period,
        periodId: null,
        day: null,
        week: null,
        error: "network",
      };
    }
  }

  /**
   * @param {"flappy"|"tetris"|"doodle"|"jump-run"|"ninja-dodge"} game
   * @param {string} name
   * @param {number} score
   */
  async function submitScore(game, name, score) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, name, score }),
      });
      const data = await res.json();
      return {
        ok: Boolean(data.ok),
        configured: data.configured !== false,
        rank: data.rankDay || data.rank || null,
        rankDay: data.rankDay || data.rank || null,
        rankWeek: data.rankWeek || null,
        scores: Array.isArray(data.scores) ? data.scores : [],
        error: data.error || (res.ok ? null : "submit failed"),
      };
    } catch (err) {
      return {
        ok: false,
        configured: false,
        rank: null,
        rankDay: null,
        rankWeek: null,
        scores: [],
        error: "network",
      };
    }
  }

  function formatScoreRow(entry, index) {
    const rank = index + 1;
    const name = String(entry.name || "???").slice(0, 8);
    const score = Number(entry.score) || 0;
    return { rank, name, score };
  }

  function formatRankMessage(res) {
    if (!res || !res.ok) return "등록 실패 · 다시 시도해 주세요";
    const day = res.rankDay || res.rank;
    const week = res.rankWeek;
    if (day && week) return `오늘 ${day}위 · 이번주 ${week}위!`;
    if (day) return `오늘 ${day}위에 등록됐어요!`;
    return "등록 완료!";
  }

  window.TodayScores = {
    fetchScores,
    submitScore,
    formatScoreRow,
    formatRankMessage,
  };
})();
