(() => {
  "use strict";

  const FALLBACK = [
    { id: "flappy", title: "펄럭 병아리" },
    { id: "doodle", title: "폴짝 하늘" },
    { id: "tetris", title: "블록 팡팡" },
    { id: "jump-run", title: "콩콩 점프" },
    { id: "ninja-dodge", title: "닌자 표창 피하기" },
    { id: "stork-stride", title: "서빙왕" },
  ];

  const GAMES =
    window.TodayRankMeta && Array.isArray(TodayRankMeta.RANKABLE) && TodayRankMeta.RANKABLE.length
      ? TodayRankMeta.RANKABLE
      : FALLBACK;

  let period = "day";
  const statusEl = document.getElementById("fame-status");
  const gridEl = document.getElementById("fame-grid");
  const cache = { day: null, week: null };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function mapPool(items, limit, fn) {
    const out = new Array(items.length);
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }
    const n = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: n }, () => worker()));
    return out;
  }

  async function loadChampions(p) {
    if (!window.TodayScores) return [];
    return mapPool(GAMES, 6, async (g) => {
      const data = await window.TodayScores.fetchScores(g.id, 1, p);
      const top = data.scores && data.scores[0] ? data.scores[0] : null;
      return {
        id: g.id,
        title: g.title,
        name: top ? String(top.name || "???").slice(0, 8) : null,
        score: top ? Number(top.score) || 0 : null,
      };
    });
  }

  function render(list) {
    if (!gridEl) return;
    const crowned = list.filter((x) => x.name);
    if (statusEl) {
      statusEl.textContent =
        period === "week"
          ? `이번주 1등 ${crowned.length}명`
          : `오늘 1등 ${crowned.length}명`;
    }
    gridEl.innerHTML = list
      .map((row) => {
        if (!row.name) {
          return `<div class="fame-card empty" aria-label="${escapeHtml(row.title)}">
            <span class="fame-card-crown" aria-hidden="true">·</span>
            <p class="fame-card-game">${escapeHtml(row.title)}</p>
            <p class="fame-card-name">아직 없음</p>
            <p class="fame-card-score">첫 1등에 도전!</p>
          </div>`;
        }
        return `<a class="fame-card" href="/games/${escapeHtml(row.id)}/" aria-label="${escapeHtml(row.title)} 1등 ${escapeHtml(row.name)}">
          <span class="fame-card-crown" aria-hidden="true">👑</span>
          <p class="fame-card-game">${escapeHtml(row.title)}</p>
          <p class="fame-card-name">${escapeHtml(row.name)}</p>
          <p class="fame-card-score">${row.score.toLocaleString("ko-KR")}점</p>
        </a>`;
      })
      .join("");
  }

  async function show() {
    if (statusEl) statusEl.textContent = "불러오는 중…";
    if (gridEl) gridEl.innerHTML = "";
    if (!cache[period]) {
      cache[period] = await loadChampions(period);
    }
    render(cache[period]);
  }

  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".period-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      period = btn.dataset.period || "day";
      show();
    });
  });

  show();
})();
