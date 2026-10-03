/**
 * 기록 챌린지 공용 결과 패널 (10초 맞추기 · 색깔 반응 · 폭탄 피하기)
 *
 *   const rc = TodayRecord.init({
 *     gameId, gameTitle, lowerIsBetter, format: (score) => "0.037초", gap: (a, b) => "0.02초",
 *     panel: document.getElementById("record-panel"),   // 기록·TOP10·버튼이 들어갈 곳
 *     share: (score, label) => "공유 문구", onRetry: () => {},
 *   });
 *   rc.finish(score, { label });   // 게임이 끝나면
 *
 * - 내 최고 기록 / 오늘 기록: localStorage (로그인 없음)
 * - 오늘의 TOP 10: 기존 /api/scores 일간 보드 (TodayScores.fetchScores)
 * - 랭킹 등록·카카오 공유: 기존 TodayGameRank 폼 재사용
 * - 기록 공유: Web Share API, 안 되면 문구 복사
 */
(() => {
  "use strict";

  const SITE = "https://www.todaygame.co.kr";

  function seoulDay() {
    return new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function init(cfg) {
    const KEY = `today-record-${cfg.gameId}`;
    const better = (a, b) => (b == null ? true : cfg.lowerIsBetter ? a < b : a > b);

    function load() {
      let d;
      try {
        d = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
      } catch (_) {
        d = {};
      }
      if (d.day !== seoulDay()) {
        d.day = seoulDay();
        d.today = null;
        d.todayTries = 0;
      }
      return d;
    }

    function save(d) {
      try {
        localStorage.setItem(KEY, JSON.stringify(d));
      } catch (_) {
        /* 사생활 보호 모드 등 */
      }
    }

    const panel = cfg.panel;
    panel.classList.add("rc");
    panel.innerHTML = `
      <div class="rc-mine">
        <div class="rc-cell"><span>내 최고</span><b data-rc="best">—</b></div>
        <div class="rc-cell"><span>오늘 최고</span><b data-rc="today">—</b></div>
        <div class="rc-cell"><span>오늘 도전</span><b data-rc="tries">0</b></div>
      </div>
      <p class="rc-push" data-rc="push"></p>
      <div class="rc-actions">
        <button type="button" class="rc-btn rc-retry" data-rc="retry">다시 도전</button>
        <button type="button" class="rc-btn rc-top" data-rc="top">오늘의 TOP 10</button>
        <button type="button" class="rc-btn rc-share" data-rc="share">친구에게 자랑하기</button>
      </div>
      <p class="rc-msg" data-rc="msg" role="status"></p>
      <div class="rc-rank" data-rc="rank-slot"></div>
      <section class="rc-board" data-rc="board" aria-label="오늘의 TOP 10">
        <h3>🔥 오늘의 챌린지 TOP 10</h3>
        <ol data-rc="list"><li class="rc-empty">불러오는 중…</li></ol>
      </section>
    `;
    const $ = (k) => panel.querySelector(`[data-rc="${k}"]`);

    let lastScore = null;
    let lastLabel = "";
    let board = [];
    let lockTimer = 0;

    function paintMine() {
      const d = load();
      $("best").textContent = d.best == null ? "—" : cfg.format(d.best);
      $("today").textContent = d.today == null ? "—" : cfg.format(d.today);
      $("tries").textContent = String(d.todayTries || 0);
    }

    async function loadBoard() {
      const list = $("list");
      if (!window.TodayScores) {
        list.innerHTML = `<li class="rc-empty">랭킹을 불러오지 못했어요</li>`;
        return board;
      }
      const res = await window.TodayScores.fetchScores(cfg.gameId, 10, "day");
      if (!res.ok) {
        board = [];
        list.innerHTML = `<li class="rc-empty">랭킹을 불러오지 못했어요</li>`;
        return board;
      }
      board = res.scores.slice(0, 10);
      if (!board.length) {
        list.innerHTML = `<li class="rc-empty">오늘 기록이 아직 없어요<br />첫 1등이 되어 보세요!</li>`;
      } else {
        const medal = ["🥇", "🥈", "🥉"];
        list.innerHTML = board
          .map(
            (e, i) =>
              `<li><span class="rc-r">${medal[i] || i + 1}</span><span class="rc-n">${esc(String(e.name).slice(0, 8))}</span><span class="rc-s">${esc(
                cfg.format(Number(e.score))
              )}</span></li>`
          )
          .join("");
      }
      paintPush();
      return board;
    }

    /* 경쟁심 문구: 오늘 TOP 10 과 내 기록 차이 */
    function paintPush() {
      const el = $("push");
      if (lastScore == null) {
        el.textContent = "";
        return;
      }
      if (!board.length) {
        el.textContent = "오늘 첫 1등이 될 수 있어요! 이름을 남겨 보세요";
        return;
      }
      const scores = board.map((e) => Number(e.score));
      const ahead = scores.filter((s) => (cfg.lowerIsBetter ? s < lastScore : s > lastScore));
      const rankIfNow = ahead.length + 1;
      if (rankIfNow === 1) {
        el.textContent = "🏆 지금 기록이면 오늘 1등! 랭킹에 이름을 남기세요";
      } else if (rankIfNow <= 10) {
        el.textContent = `지금 기록이면 오늘 ${rankIfNow}위! ${cfg.gap(ahead[ahead.length - 1], lastScore)}만 줄이면 ${rankIfNow - 1}위`;
      } else if (scores.length < 10) {
        el.textContent = "지금 등록하면 오늘의 TOP 10 안에 들어가요!";
      } else {
        el.textContent = `TOP 10까지 ${cfg.gap(scores[scores.length - 1], lastScore)}! 다시 도전해 보세요`;
      }
    }

    /* 랭킹 등록 폼 (기존 공용 UI) — 등록하면 TOP 10 새로고침 */
    function mountRank() {
      if (!window.TodayGameRank) return;
      TodayGameRank.mount({ gameId: cfg.gameId, gameTitle: cfg.gameTitle, formParent: $("rank-slot") });
      const form = document.getElementById("today-rank-form");
      if (form && !form.__rcBound) {
        form.__rcBound = true;
        form.addEventListener("submit", () => window.setTimeout(loadBoard, 1600));
      }
    }

    async function share() {
      if (lastScore == null) return;
      const text = cfg.share(lastScore, lastLabel);
      const url = `${SITE}/games/${cfg.gameId}/`;
      const msg = $("msg");
      const inApp = window.TodayScores && TodayScores.isInAppBrowser && TodayScores.isInAppBrowser();
      if (!inApp && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: `${cfg.gameTitle} | Today Game`, text, url });
          msg.textContent = "";
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        msg.textContent = "기록 문구를 복사했어요! 친구에게 붙여넣어 보내세요";
      } catch (_) {
        msg.textContent = `${text} ${url}`;
      }
    }

    $("retry").addEventListener("click", (e) => cfg.onRetry && cfg.onRetry(e));
    $("top").addEventListener("click", () => $("board").scrollIntoView({ behavior: "smooth", block: "start" }));
    $("share").addEventListener("click", share);

    paintMine();
    mountRank();

    return {
      /** 오늘 TOP 10 불러오기 (시작 화면 미리보기용으로도 사용) */
      refresh: loadBoard,
      /** 내 기록 요약 */
      summary() {
        const d = load();
        return { best: d.best == null ? null : d.best, today: d.today == null ? null : d.today, tries: d.todayTries || 0 };
      },
      /**
       * @param {number} score 랭킹에 쓰는 정수 (lowerIsBetter 면 작을수록 좋음)
       * @returns {{ newBest: boolean, newToday: boolean, prevBest: number|null }}
       */
      finish(score, opts = {}) {
        // 휴대폰에서 STOP 같은 마지막 탭의 뒤늦은 클릭(또는 두 번 탭)이 결과 화면의
        // '다시 도전' 에 그대로 꽂혀 결과를 보기도 전에 다음 판이 시작되던 문제 방지:
        // 결과 화면은 처음 0.7초 동안 터치를 받지 않는다.
        document.body.classList.add("rc-lock");
        window.clearTimeout(lockTimer);
        lockTimer = window.setTimeout(() => document.body.classList.remove("rc-lock"), 700);
        lastScore = score;
        lastLabel = opts.label || cfg.format(score);
        const d = load();
        const prevBest = d.best == null ? null : d.best;
        const newBest = better(score, d.best);
        const newToday = better(score, d.today);
        if (newBest) d.best = score;
        if (newToday) d.today = score;
        d.todayTries = (d.todayTries || 0) + 1;
        save(d);
        paintMine();
        $("msg").textContent = "";
        if (window.TodayGameRank) TodayGameRank.open(score, { label: lastLabel, higherIsBetter: !cfg.lowerIsBetter });
        paintPush();
        loadBoard();
        return { newBest, newToday, prevBest };
      },
    };
  }

  window.TodayRecord = { init };
})();
