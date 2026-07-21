(() => {
  "use strict";

  const ENDPOINT = "/api/scores";

  /**
   * @param {string} game
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
   * @param {string} game
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

  function buildShareText({ gameTitle, name, score, scoreLabel, rankDay, rankWeek, url }) {
    const scoreLine = scoreLabel || `${Number(score).toLocaleString("ko-KR")}점`;
    const lines = [`오늘의 게임 · ${gameTitle}`, `${name} · ${scoreLine}`];
    if (rankDay) lines.push(`오늘 ${rankDay}위`);
    if (rankWeek) lines.push(`이번주 ${rankWeek}위`);
    lines.push("");
    lines.push(url || "https://www.todaygame.co.kr/");
    return lines.join("\n");
  }

  const KAKAO_JS_KEY = "5c663a08f5da3d805bb8a99f998b2996";
  const SHARE_IMAGE = "https://www.todaygame.co.kr/assets/og-share.png";
  const SITE_URL = "https://www.todaygame.co.kr/";
  let kakaoReady = null;

  function ensureKakao() {
    if (kakaoReady) return kakaoReady;
    kakaoReady = new Promise((resolve) => {
      const boot = () => {
        try {
          if (!window.Kakao) return resolve(false);
          if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);
          resolve(Boolean(Kakao.isInitialized && Kakao.isInitialized()));
        } catch (_) {
          resolve(false);
        }
      };
      if (window.Kakao) {
        boot();
        return;
      }
      const existing = document.querySelector('script[data-kakao-sdk="1"]');
      if (existing) {
        existing.addEventListener("load", boot);
        existing.addEventListener("error", () => resolve(false));
        return;
      }
      const s = document.createElement("script");
      s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
      s.async = true;
      s.dataset.kakaoSdk = "1";
      s.onload = boot;
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return kakaoReady;
  }

  /** 카카오·인스타 등 인앱 브라우저는 Web Share API를 막는 경우가 많음 */
  function isInAppBrowser() {
    const ua = navigator.userAgent || "";
    return /KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(ua);
  }

  function isKakaoInApp() {
    return /KAKAOTALK/i.test(navigator.userAgent || "");
  }

  /**
   * 공유 결과 안내 문구
   * @param {{ ok: boolean, mode: string, error?: string, inApp?: boolean }} result
   */
  function formatShareResult(result) {
    if (!result) return "공유에 실패했어요";
    if (result.mode === "kakao") return "카카오톡 공유 창을 열었어요";
    if (result.mode === "share") return "공유 창을 열었어요";
    if (result.error === "cancel") return "공유를 취소했어요";
    if (result.mode === "copy") {
      if (result.inApp || isKakaoInApp()) {
        return "텍스트는 복사됐어요 — 채팅창에 붙여넣기 하세요";
      }
      return "복사됨! 카톡·SNS에 붙여넣기 하세요";
    }
    if (result.error === "kakao") return "카카오톡 공유를 열지 못했어요";
    return "공유에 실패했어요";
  }

  /**
   * 카카오톡 피드 공유 (로그인 불필요 · 메시지 공유만)
   */
  async function shareToKakao(opts) {
    const ok = await ensureKakao();
    if (!ok || !window.Kakao || !Kakao.Share) {
      return { ok: false, mode: "fail", error: "kakao" };
    }
    const gameTitle = opts.gameTitle || "오늘의 챌린지";
    const name = opts.name || "나";
    const score = Number(opts.score) || 0;
    const scoreLabel = opts.scoreLabel || `${score.toLocaleString("ko-KR")}점`;
    const rank = opts.rankDay || opts.rank;
    const url = opts.url || SITE_URL;
    const title = rank
      ? `오늘의 챌린지 결과: ${rank}위!`
      : `오늘의 게임 · ${gameTitle}`;
    const description = rank
      ? `${name} · ${scoreLabel} · ${rank}위 달성! 너도 도전해봐`
      : `${name} · ${scoreLabel}! 너도 도전해봐`;

    try {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title,
          description,
          imageUrl: SHARE_IMAGE,
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
        buttons: [
          {
            title: "나도 도전하기",
            link: {
              mobileWebUrl: url,
              webUrl: url,
            },
          },
        ],
      });
      return { ok: true, mode: "kakao" };
    } catch (_) {
      return { ok: false, mode: "fail", error: "kakao" };
    }
  }

  /**
   * 카톡/SNS 공유 (휴대폰: 시스템 공유 시트 → 앱 선택, PC·인앱: 클립보드 복사)
   * @returns {Promise<{ ok: boolean, mode: "share"|"copy"|"fail", error?: string, inApp?: boolean }>}
   */
  async function shareRank(opts) {
    const text = buildShareText(opts);
    const title = `오늘의 게임 · ${opts.gameTitle || "랭킹"}`;
    const url = opts.url || SITE_URL;
    const inApp = isInAppBrowser();

    // 카카오 등 인앱은 share가 있어도 깨지거나 바로 실패하는 경우가 많아 복사 우선
    if (!inApp && typeof navigator.share === "function") {
      const tryShare = async (data) => {
        if (navigator.canShare && !navigator.canShare(data)) return false;
        await navigator.share(data);
        return true;
      };
      try {
        const candidates = [{ title, text, url }, { text }, { text, url }, { title, text }];
        for (const data of candidates) {
          try {
            if (await tryShare(data)) return { ok: true, mode: "share" };
          } catch (err) {
            if (err && err.name === "AbortError") {
              return { ok: false, mode: "fail", error: "cancel" };
            }
          }
        }
      } catch (err) {
        if (err && err.name === "AbortError") {
          return { ok: false, mode: "fail", error: "cancel" };
        }
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, mode: "copy", inApp };
    } catch (_) {
      return { ok: false, mode: "fail", error: "clipboard", inApp };
    }
  }

  window.TodayScores = {
    fetchScores,
    submitScore,
    formatScoreRow,
    formatRankMessage,
    formatShareResult,
    buildShareText,
    shareRank,
    shareToKakao,
    isInAppBrowser,
    isKakaoInApp,
  };

  /** 게임 페이지 오픈 카운트 (세션당 1회, bgm.js와 공유 플래그) */
  try {
    const path = String(location.pathname || "");
    const m = path.match(/\/games\/([^/]+)\//);
    const game = m ? m[1] : "";
    if (game && game !== "hidden") {
      const flag = `today-game-play-hit-${game}`;
      if (!sessionStorage.getItem(flag)) {
        sessionStorage.setItem(flag, "1");
        const body = JSON.stringify({ game });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/plays", new Blob([body], { type: "application/json" }));
        } else {
          fetch("/api/plays", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      }
    }
  } catch (_) {
    /* ignore */
  }
})();
