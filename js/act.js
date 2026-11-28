/* 오늘의 게임 — 이용자 행동 측정 (익명 · 비동기 · 실패해도 게임에 영향 없음)
 *
 * 이벤트: site_visit · game_view · game_start · game_complete · game_replay ·
 *         challenge_start · challenge_complete · score_submit · share_click
 * 보내는 값: 이벤트 이름 · 게임 id · 경로 · 시각 · 익명 세션 id · 익명 브라우저 id ·
 *           기기 종류 · 들어온 사이트(도메인만) · 유입 경로 · 첫 방문 날짜
 *   이름 · 이메일 · IP · 점수 이름 같은 개인정보는 보내지 않는다. (IP 는 서버도 저장하지 않음)
 *
 * 게임이 직접 알릴 수도 있다: TodayAct.start() · TodayAct.complete({ ms }) — 없으면 아래 자동 감지
 *   시작: 시작 · 다시 하기 같은 버튼을 누를 때 (처음 = game_start, 완료 뒤 = game_replay)
 *   완료: 공용 결과 창(TodayGameRank.open) · 점수 등록 · TodayAct.complete()
 * ?act=off 이면 아무것도 보내지 않음 (운영자 점검용)
 */
(() => {
  "use strict";
  if (window.TodayAct) return;
  const ENDPOINT = "/api/act";
  const SESSION_IDLE = 30 * 60 * 1000; // 30분 동안 아무 일 없으면 새 세션
  const off = /[?&]act=off\b/.test(location.search);

  const store = (() => {
    try {
      const k = "__tg_act_t";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return localStorage;
    } catch (_) {
      return null;
    }
  })();
  const get = (k) => {
    try {
      return store ? store.getItem(k) : null;
    } catch (_) {
      return null;
    }
  };
  const set = (k, v) => {
    try {
      if (store) store.setItem(k, v);
    } catch (_) {}
  };
  const rid = () => {
    try {
      const a = new Uint8Array(12);
      crypto.getRandomValues(a);
      return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
      return (Date.now().toString(16) + Math.random().toString(16).slice(2, 14)).slice(0, 24);
    }
  };
  function seoulDay(d = new Date()) {
    try {
      return d.toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
    } catch (_) {
      return new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
    }
  }

  /* ---------- 익명 브라우저 · 세션 ---------- */
  const today = seoulDay();
  let uid = get("tg-act-uid");
  let firstDay = get("tg-act-first");
  if (!uid || !/^[a-f0-9]{16,32}$/.test(uid)) {
    uid = rid();
    set("tg-act-uid", uid);
  }
  if (!firstDay || !/^\d{4}-\d{2}-\d{2}$/.test(firstDay) || firstDay > today) {
    firstDay = today;
    set("tg-act-first", firstDay);
  }
  const prevLast = get("tg-act-last") || "";
  set("tg-act-last", today);

  function device() {
    const ua = navigator.userAgent || "";
    if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "tablet";
    if (/Mobi|iPhone|Android/i.test(ua)) return "mobile";
    return "desktop";
  }
  function refHost() {
    try {
      if (!document.referrer) return "";
      return new URL(document.referrer).hostname.replace(/^www\./, "").slice(0, 60);
    } catch (_) {
      return "";
    }
  }
  function source(ref) {
    const q = new URLSearchParams(location.search);
    const utm = (q.get("utm_source") || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 30);
    if (utm) return utm;
    if (!ref) return "direct";
    if (/todaygame\.co\.kr$/.test(ref) || ref === location.hostname.replace(/^www\./, "")) return "internal";
    if (/naver\./.test(ref)) return "naver";
    if (/google\./.test(ref)) return "google";
    if (/daum\.|kakao/.test(ref)) return /kakao/.test(ref) ? "kakao" : "daum";
    if (/instagram|facebook|fb\.|threads/.test(ref)) return "sns";
    if (/youtube|youtu\.be/.test(ref)) return "youtube";
    if (/bing\./.test(ref)) return "bing";
    return "other";
  }
  // 세션: 30분 넘게 쉬었거나 날짜가 바뀌면 새 세션 (같은 탭 새로고침은 같은 세션)
  let sess = null;
  try {
    sess = JSON.parse(get("tg-act-sess") || "null");
  } catch (_) {
    sess = null;
  }
  const now = Date.now();
  const ref = refHost();
  let newSession = false;
  if (!sess || !sess.id || now - (sess.at || 0) > SESSION_IDLE || sess.day !== today) {
    sess = { id: rid(), at: now, day: today, src: source(ref), views: {} };
    newSession = true;
  } else if (ref && source(ref) !== "internal" && sess.src === "direct") sess.src = source(ref);
  const touch = () => {
    sess.at = Date.now();
    set("tg-act-sess", JSON.stringify(sess));
  };
  touch();

  const m = location.pathname.match(/^\/games\/([a-z0-9-]+)\//);
  const gameId = m ? m[1] : "";
  const challenge = /[?&]challenge=1\b/.test(location.search);

  /* ---------- 보내기 (모아서 · 비동기 · 실패 무시) ---------- */
  const queue = [];
  let timer = 0;
  function send(name, extra) {
    if (off) return;
    const ev = {
      id: rid(),
      e: name,
      g: extra && extra.g != null ? extra.g : gameId,
      p: location.pathname.slice(0, 80),
      t: Date.now(),
      sid: sess.id,
      uid,
      dev: device(),
      ref,
      src: sess.src,
      fd: firstDay,
    };
    if (extra && extra.ms != null) ev.ms = Math.max(0, Math.min(7200000, Math.round(extra.ms)));
    queue.push(ev);
    touch();
    clearTimeout(timer);
    timer = setTimeout(flush, 1500);
  }
  function flush() {
    clearTimeout(timer);
    if (!queue.length) return;
    const body = JSON.stringify({ v: 1, events: queue.splice(0, 20) });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }))) {
        if (queue.length) flush();
        return;
      }
    } catch (_) {}
    try {
      fetch(ENDPOINT, { method: "POST", body, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(() => {});
    } catch (_) {}
    if (queue.length) flush();
  }
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());

  /* ---------- 방문 · 게임 조회 (세션당 한 번) ---------- */
  if (newSession) send("site_visit", { g: "" });
  if (gameId && !sess.views[gameId]) {
    sess.views[gameId] = 1;
    touch();
    send("game_view");
  }

  /* ---------- 게임 시작 · 완료 · 재플레이 ---------- */
  let state = "idle"; // idle → playing → done → (replay) playing
  let startAt = 0;
  let runs = 0;
  let doneAt = 0;
  function start() {
    if (!gameId || state === "playing") return false;
    const replay = state === "done";
    state = "playing";
    startAt = Date.now();
    runs++;
    send(replay ? "game_replay" : "game_start");
    if (challenge && runs === 1) send("challenge_start");
    return true;
  }
  function complete(o) {
    if (!gameId) return false;
    // 시작 버튼을 못 잡은 게임: 완료 때 시작(두 번째부터는 재플레이)도 함께 세고, 플레이 시간은 모르므로 보내지 않음
    if (state === "done" && Date.now() - doneAt < 3000) return false; // 같은 결과를 두 번 알리는 경우
    const known = state === "playing";
    if (!known) start();
    state = "done";
    doneAt = Date.now();
    send("game_complete", known || (o && o.ms != null) ? { ms: o && o.ms != null ? o.ms : Date.now() - startAt } : null);
    return true;
  }

  // 시작 · 다시 하기 버튼 (공용 단추 · 홈 · 소리 · 공유 · 랭킹 입력 · 소개 글은 제외)
  const START_TEXT = /^(▶\s*)?(게임\s*)?(시작|플레이|play|start|다시|재도전|한\s*판\s*더|한\s*번\s*더|도전|이어\s*하기|다음\s*(판|단계|스테이지|경기)|retry|again|restart|replay)/i;
  const START_ID = /(^|[-_])(start|play|retry|again|restart|replay|go|begin|next)([-_]|btn|$)/i;
  const SKIP = ".today-home, .today-mute-btn, .today-face-chip, .seo-about, #today-rank-form, [data-today-home], .today-duel, #tduel-invite, .today-pause, [data-act-skip]";
  document.addEventListener(
    "click",
    (e) => {
      if (!gameId) return;
      const el = e.target && e.target.closest && e.target.closest("button, [role=button], a.btn, a.button, input[type=button]");
      if (!el || el.closest(SKIP)) return;
      if (el.matches("a[href]") && !/^#|^javascript/.test(el.getAttribute("href") || "")) return;
      const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 30);
      if (/공유|share|카카오|랭킹|순위|규칙|도움|설정|소리|메뉴|나가기|그만|홈/i.test(text)) return;
      if (START_TEXT.test(text) || START_ID.test(el.id || "")) start();
    },
    true,
  );

  // 공유 버튼
  document.addEventListener(
    "click",
    (e) => {
      const el = e.target && e.target.closest && e.target.closest("button, a, [role=button]");
      if (!el) return;
      const label = `${el.id || ""} ${el.className || ""} ${(el.innerText || "").slice(0, 20)}`;
      if (/share|공유|kakao/i.test(label)) send("share_click");
    },
    true,
  );

  // 결과 화면이 나타나면 완료 (공용 결과 창이 없는 게임용: id 가 over · result · gameover · win · clear · end 같은 덮개)
  const RESULT_ID = /^(over|game-?over|gameover-?screen|result|results|result-?screen|win|clear|stage-?clear|all-?clear|end|ending|finish|r-?modal|lose|fail|done)$/i;
  const shown = (el) => {
    if (!el || el.hidden) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && !el.classList.contains("hidden") && Number(cs.opacity) > 0.01;
  };
  const seen = new WeakSet();
  if (gameId && window.MutationObserver) {
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target;
        if (!el || el.nodeType !== 1 || !RESULT_ID.test(el.id || "")) continue;
        if (shown(el)) {
          if (!seen.has(el)) {
            seen.add(el);
            complete();
          }
        } else seen.delete(el);
      }
    });
    const go = () => mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
    if (document.body) go();
    else document.addEventListener("DOMContentLoaded", go);
  }

  // 공용 모듈 감싸기 (늦게 불러와져도 붙도록 여러 번 시도)
  function wrap() {
    const R = window.TodayGameRank;
    if (R && !R.__act) {
      R.__act = true;
      const open = R.open;
      if (typeof open === "function")
        R.open = function () {
          complete();
          return open.apply(this, arguments);
        };
      const after = R.afterSubmit;
      if (typeof after === "function")
        R.afterSubmit = function () {
          if (challenge) send("challenge_complete");
          return after.apply(this, arguments);
        };
    }
    const S = window.TodayScores;
    if (S && !S.__act) {
      S.__act = true;
      const sub = S.submitScore;
      if (typeof sub === "function")
        S.submitScore = function (game) {
          // 점수 등록 = 판이 끝난 것 (결과 창 없이 바로 등록하는 게임)
          if (state === "playing") complete();
          send("score_submit", { g: gameId || String(game || "").replace(/-(daily|week)$/, "").slice(0, 40) });
          return sub.apply(this, arguments);
        };
    }
    return !!(R && S) || document.readyState === "complete";
  }
  if (!wrap()) {
    document.addEventListener("DOMContentLoaded", wrap);
    addEventListener("load", wrap);
  }

  window.TodayAct = {
    start,
    complete,
    send: (name) => /^(share_click)$/.test(name) && send(name),
    flush,
    info: () => ({ uid, sid: sess.id, firstDay, prevLast, src: sess.src, state, gameId }),
  };
})();
