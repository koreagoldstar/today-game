/**
 * 게임 오버 화면에 붙이는 공용 랭킹 등록 UI
 * 사용:
 *   TodayGameRank.mount({ gameId, gameTitle, formParent });
 *   TodayGameRank.open(score, { label: "52초" });
 */
(() => {
  "use strict";

  const NAME_KEY = "today-game-name";
  let cfg = null;
  let lastScore = 0;
  let lastLabel = "";
  let submitted = false;
  let lastRank = { rankDay: null, rankWeek: null };

  function seoulDayKey() {
    return new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
  }

  function isChallengeMode() {
    try {
      return new URLSearchParams(window.location.search).has("challenge");
    } catch (_) {
      return false;
    }
  }

  function challengeLocalKey(gameId) {
    return `today-game-challenge-result-${seoulDayKey()}-${gameId}`;
  }

  function saveChallengeLocal(payload) {
    try {
      localStorage.setItem(challengeLocalKey(payload.gameId), JSON.stringify(payload));
    } catch (_) {
      /* ignore */
    }
  }

  function loadChallengeLocal(gameId) {
    try {
      const raw = localStorage.getItem(challengeLocalKey(gameId));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function ensureStyles() {
    if (document.getElementById("today-rank-style")) return;
    const style = document.createElement("style");
    style.id = "today-rank-style";
    style.textContent = `
.today-rank-form{width:min(280px,100%);display:flex;flex-direction:column;gap:8px;margin-top:10px}
.today-rank-form label{font-size:13px;opacity:.75}
.today-rank-form input{appearance:none;border:2px solid rgba(255,255,255,.9);border-radius:14px;padding:12px 14px;font:inherit;font-size:16px;text-align:center;background:rgba(255,255,255,.88);color:#3d2a36}
.today-rank-form .rank-msg{min-height:1.2em;margin:0;font-size:13px;color:#2f7a45}
.today-rank-form .btn.soft{color:#fff;background:linear-gradient(180deg,#ff9ec4,#ff6b9d);box-shadow:0 6px 0 #d93f74}
.today-rank-form .btn.soft:active{box-shadow:0 3px 0 #d93f74;transform:translateY(2px)}
.today-rank-share-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:min(300px,100%);margin-top:4px}
.today-rank-share-row[hidden]{display:none}
.today-rank-form .btn.kakao{color:#191919;background:linear-gradient(180deg,#fee500,#f5d800);box-shadow:0 6px 0 #c4a800}
.today-rank-form .btn.kakao:active{box-shadow:0 3px 0 #c4a800;transform:translateY(2px)}
.challenge-done{width:min(300px,100%);margin:10px 0 4px;padding:14px 16px;border-radius:16px;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,240,248,.9));border:2px solid rgba(255,79,139,.35);text-align:center;color:#3d2a36}
.challenge-done-title{margin:0 0 8px;font-size:18px;font-weight:700;color:#ff4f8b}
.challenge-done-row{margin:4px 0;font-size:15px}
.challenge-done-row b{font-variant-numeric:tabular-nums}
`;
    document.head.appendChild(style);
  }

  function ensureDoneBanner(parent) {
    let el = document.getElementById("challenge-done");
    if (el) {
      if (parent && el.parentElement !== parent) parent.insertBefore(el, parent.firstChild);
      return el;
    }
    el = document.createElement("div");
    el.id = "challenge-done";
    el.className = "challenge-done";
    el.hidden = true;
    el.innerHTML = `
      <p class="challenge-done-title">✅ 오늘의 챌린지 완료</p>
      <p class="challenge-done-row">기록: <b id="challenge-done-score">—</b></p>
      <p class="challenge-done-row">현재 순위: <b id="challenge-done-rank">—</b></p>
    `;
    if (parent) parent.insertBefore(el, parent.firstChild);
    return el;
  }

  function showChallengeDone({ label, rank, total }) {
    if (!isChallengeMode()) return;
    const parent =
      (cfg && cfg.formParent) ||
      document.getElementById("over") ||
      document.getElementById("win") ||
      document.body;
    const banner = ensureDoneBanner(parent);
    const scoreEl = document.getElementById("challenge-done-score");
    const rankEl = document.getElementById("challenge-done-rank");
    if (scoreEl) scoreEl.textContent = label || `${lastScore.toLocaleString("ko-KR")}점`;
    if (rankEl) {
      if (rank != null && total != null) rankEl.textContent = `${rank}위 / ${total}명`;
      else if (rank != null) rankEl.textContent = `${rank}위`;
      else rankEl.textContent = "—";
    }
    banner.hidden = false;
  }

  async function postChallengeBest(name, score) {
    try {
      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "best",
          game: cfg.gameId,
          value: score,
          name,
        }),
      });
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  function ensureDom(parent) {
    ensureStyles();
    let form = document.getElementById("today-rank-form");
    if (form) {
      if (parent && form.parentElement !== parent) parent.appendChild(form);
      return form;
    }
    if (!parent) return null;
    form = document.createElement("form");
    form.id = "today-rank-form";
    form.className = "rank-form today-rank-form";
    form.innerHTML = `
      <label for="today-rank-name">랭킹 이름 (2~8자)</label>
      <input id="today-rank-name" name="name" maxlength="8" minlength="2" autocomplete="nickname" placeholder="닉네임" required />
      <button type="submit" class="btn" id="today-rank-submit">랭킹 등록</button>
      <p class="rank-msg" id="today-rank-msg"></p>
      <div class="today-rank-share-row" id="today-rank-share-row" hidden>
        <button type="button" class="btn kakao" id="today-rank-kakao">카카오톡 공유</button>
        <button type="button" class="btn soft" id="today-rank-share">다른 앱으로</button>
      </div>
    `;
    parent.appendChild(form);
    if (isChallengeMode()) ensureDoneBanner(parent);

    const nameInput = form.querySelector("#today-rank-name");
    nameInput.value = localStorage.getItem(NAME_KEY) || "";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (submitted || !cfg) return;
      const name = String(nameInput.value || "").trim();
      if (name.length < 2 || name.length > 8) {
        form.querySelector("#today-rank-msg").textContent = "이름은 2~8자로 적어 주세요";
        return;
      }
      localStorage.setItem(NAME_KEY, name);
      const btn = form.querySelector("#today-rank-submit");
      btn.disabled = true;
      form.querySelector("#today-rank-msg").textContent = "등록 중…";
      if (!window.TodayScores) {
        form.querySelector("#today-rank-msg").textContent = "랭킹 모듈을 불러오지 못했어요";
        btn.disabled = false;
        return;
      }
      const res = await window.TodayScores.submitScore(cfg.gameId, name, lastScore);
      if (res.ok) {
        submitted = true;
        lastRank = { rankDay: res.rankDay || res.rank, rankWeek: res.rankWeek };
        form.querySelector("#today-rank-msg").textContent = window.TodayScores.formatRankMessage
          ? window.TodayScores.formatRankMessage(res)
          : res.rank
            ? `오늘 ${res.rank}위에 등록됐어요!`
            : "등록 완료!";
        const shareRow = form.querySelector("#today-rank-share-row");
        if (shareRow) shareRow.hidden = false;

        let challengeRank = lastRank.rankDay;
        let challengeTotal = null;
        if (isChallengeMode()) {
          const ch = await postChallengeBest(name, lastScore);
          if (ch && ch.ok && !ch.skipped) {
            if (ch.rank != null) challengeRank = ch.rank;
            if (ch.total != null) challengeTotal = ch.total;
          }
          const label = lastLabel || `${lastScore.toLocaleString("ko-KR")}점`;
          saveChallengeLocal({
            gameId: cfg.gameId,
            score: lastScore,
            label,
            rank: challengeRank,
            total: challengeTotal,
            name,
            at: Date.now(),
          });
          showChallengeDone({
            label,
            rank: challengeRank,
            total: challengeTotal,
          });
        }
      } else {
        form.querySelector("#today-rank-msg").textContent = "등록 실패 · 다시 시도해 주세요";
        btn.disabled = false;
      }
    });

    const sharePayload = () => ({
      gameTitle: isChallengeMode() ? `오늘의 챌린지 · ${cfg.gameTitle}` : cfg.gameTitle,
      name: String(nameInput.value || "").trim() || "나",
      score: lastScore,
      scoreLabel: lastLabel || undefined,
      rankDay: lastRank.rankDay,
      rankWeek: lastRank.rankWeek,
      url: isChallengeMode()
        ? "https://www.todaygame.co.kr/"
        : `https://www.todaygame.co.kr/games/${cfg.gameId}/`,
    });

    const shareBtn = form.querySelector("#today-rank-share");
    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        if (!window.TodayScores || !window.TodayScores.shareRank) return;
        const result = await window.TodayScores.shareRank(sharePayload());
        const msg = form.querySelector("#today-rank-msg");
        if (window.TodayScores.formatShareResult) {
          msg.textContent = window.TodayScores.formatShareResult(result);
          if (result.mode === "share") msg.textContent = "";
        }
      });
    }
    const kakaoBtn = form.querySelector("#today-rank-kakao");
    if (kakaoBtn) {
      kakaoBtn.addEventListener("click", async () => {
        if (!window.TodayScores || !window.TodayScores.shareToKakao) return;
        const result = await window.TodayScores.shareToKakao(sharePayload());
        const msg = form.querySelector("#today-rank-msg");
        if (window.TodayScores.formatShareResult) {
          msg.textContent = window.TodayScores.formatShareResult(result);
        }
      });
    }
    return form;
  }

  window.TodayGameRank = {
    isChallenge: isChallengeMode,
    loadLocal: loadChallengeLocal,
    mount(options) {
      cfg = options;
      ensureDom(options.formParent || document.getElementById("over") || document.body);
    },
    open(score, opts) {
      lastScore = Math.max(0, Math.floor(Number(score) || 0));
      lastLabel = (opts && opts.label) || `${lastScore.toLocaleString("ko-KR")}점`;
      submitted = false;
      lastRank = { rankDay: null, rankWeek: null };
      const form = ensureDom(cfg && cfg.formParent);
      if (!form) return;
      form.hidden = false;
      const btn = form.querySelector("#today-rank-submit");
      if (btn) btn.disabled = false;
      const msg = form.querySelector("#today-rank-msg");
      if (msg) msg.textContent = "";
      const shareRow = form.querySelector("#today-rank-share-row");
      if (shareRow) shareRow.hidden = true;
      const done = document.getElementById("challenge-done");
      if (done) done.hidden = true;
    },
    /** 기존 게임(플래피 등) 랭킹 등록 후 호출 */
    async afterSubmit({ gameId, gameTitle, name, score, rankDay, label }) {
      cfg = {
        gameId: gameId || (cfg && cfg.gameId),
        gameTitle: gameTitle || (cfg && cfg.gameTitle),
        formParent:
          (cfg && cfg.formParent) ||
          document.getElementById("over") ||
          document.getElementById("win") ||
          document.getElementById("all") ||
          document.body,
      };
      lastScore = Math.max(0, Math.floor(Number(score) || 0));
      lastLabel = label || `${lastScore.toLocaleString("ko-KR")}점`;
      lastRank = { rankDay: rankDay || null, rankWeek: null };
      let challengeRank = rankDay || null;
      let challengeTotal = null;
      if (isChallengeMode()) {
        ensureStyles();
        const ch = await postChallengeBest(name, lastScore);
        if (ch && ch.ok && !ch.skipped) {
          if (ch.rank != null) challengeRank = ch.rank;
          if (ch.total != null) challengeTotal = ch.total;
        }
        saveChallengeLocal({
          gameId: cfg.gameId,
          score: lastScore,
          label: lastLabel,
          rank: challengeRank,
          total: challengeTotal,
          name,
          at: Date.now(),
        });
        showChallengeDone({
          label: lastLabel,
          rank: challengeRank,
          total: challengeTotal,
        });
      }
      return { rank: challengeRank, total: challengeTotal };
    },
    reset() {
      submitted = false;
      const form = document.getElementById("today-rank-form");
      if (form) {
        const btn = form.querySelector("#today-rank-submit");
        if (btn) btn.disabled = false;
        const msg = form.querySelector("#today-rank-msg");
        if (msg) msg.textContent = "";
        const shareRow = form.querySelector("#today-rank-share-row");
        if (shareRow) shareRow.hidden = true;
      }
      const done = document.getElementById("challenge-done");
      if (done) done.hidden = true;
    },
  };
})();
