/* 홈 '오늘의 기록 챌린지' 카드: 오늘 1위 기록 + 내 최고 기록 채우기 (카드 자체는 index.html 정적 HTML) */
(() => {
  "use strict";

  const cards = document.querySelectorAll("[data-rec]");
  if (!cards.length) return;

  const fmt = (id, n) =>
    window.TodayRankMeta && TodayRankMeta.formatScore ? TodayRankMeta.formatScore(id, n) : `${Number(n).toLocaleString("ko-KR")}점`;

  function myBest(id) {
    try {
      const d = JSON.parse(localStorage.getItem(`today-record-${id}`) || "{}");
      return d && d.best != null ? d.best : null;
    } catch (_) {
      return null;
    }
  }

  cards.forEach(async (card) => {
    const id = card.dataset.rec;
    const el = card.querySelector("[data-rec-top]");
    const mine = myBest(id);
    const mineText = mine != null ? ` · 내 최고 ${fmt(id, mine)}` : "";
    if (!window.TodayScores) {
      el.textContent = mine != null ? `내 최고 ${fmt(id, mine)}` : "지금 첫 기록에 도전!";
      return;
    }
    const res = await window.TodayScores.fetchScores(id, 1, "day");
    const top = res.ok && res.scores[0];
    el.textContent = top ? `🥇 오늘 1위 ${fmt(id, top.score)}${mineText}` : `오늘 1위 자리가 비어 있어요${mineText}`;
  });
})();
