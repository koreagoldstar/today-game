(() => {
  "use strict";

  const FALLBACK = [
    { id: "flappy", title: "펄럭 병아리" },
    { id: "doodle", title: "폴짝 하늘" },
    { id: "tetris", title: "블록 팡팡" },
    { id: "jump-run", title: "콩콩 점프" },
    { id: "ninja-dodge", title: "닌자 표창" },
    { id: "stork-stride", title: "서빙왕" },
  ];

  const GAMES =
    window.TodayRankMeta && Array.isArray(TodayRankMeta.RANKABLE) && TodayRankMeta.RANKABLE.length
      ? TodayRankMeta.RANKABLE
      : FALLBACK;

  let period = "day";
  let game = GAMES[0] ? GAMES[0].id : "flappy";

  const noteEl = document.getElementById("rankings-note");
  const listEl = document.getElementById("rankings-list");
  const tabsEl = document.getElementById("rankings-tabs");

  function titleOf(id) {
    if (window.TodayRankMeta && TodayRankMeta.titleOf) return TodayRankMeta.titleOf(id);
    const hit = GAMES.find((g) => g.id === id);
    return hit ? hit.title : id;
  }

  function buildTabs() {
    if (!tabsEl) return;
    tabsEl.innerHTML = "";
    GAMES.forEach((g, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "score-tab" + (i === 0 ? " on" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
      btn.dataset.game = g.id;
      btn.textContent = g.title;
      btn.addEventListener("click", () => {
        tabsEl.querySelectorAll(".score-tab").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("on", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        game = btn.dataset.game || GAMES[0].id;
        renderBoard();
      });
      tabsEl.appendChild(btn);
    });
  }

  async function renderBoard() {
    if (!listEl) return;
    listEl.innerHTML = `<li class="score-empty">불러오는 중…</li>`;
    const gName = titleOf(game);
    if (noteEl) {
      noteEl.textContent = period === "week" ? `이번주 ${gName}` : `오늘의 ${gName}`;
    }
    if (!window.TodayScores) {
      listEl.innerHTML = `<li class="score-empty">랭킹 모듈을 불러오지 못했어요</li>`;
      return;
    }
    const data = await window.TodayScores.fetchScores(game, 50, period);
    if (!data.configured) {
      listEl.innerHTML = `<li class="score-empty">랭킹을 불러오지 못했어요</li>`;
      return;
    }
    if (!data.scores.length) {
      listEl.innerHTML =
        period === "week"
          ? `<li class="score-empty">이번주 기록이 아직 없어요<br />첫 랭커가 되어 보세요!</li>`
          : `<li class="score-empty">오늘 기록이 아직 없어요<br />오늘의 1등에 도전!</li>`;
      return;
    }
    listEl.innerHTML = data.scores
      .map((entry, i) => {
        const row = window.TodayScores.formatScoreRow(entry, i);
        const pts = game === "reaction" ? `${row.score.toLocaleString("ko-KR")}ms` : row.score.toLocaleString("ko-KR");
        return `<li><span class="rank">${row.rank}</span><span class="name">${row.name}</span><span class="pts">${pts}</span></li>`;
      })
      .join("");
  }

  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".period-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      period = btn.dataset.period || "day";
      renderBoard();
    });
  });

  buildTabs();
  renderBoard();
})();
