(() => {
  "use strict";

  /**
   * 오늘의 게임 공통 일시정지
   * 사용: game.js 끝에서 TodayPause.mount({ canPause, isPaused, pause, resume })
   * mount 없이 pause.js만 로드된 게임은 자동으로 기본 일시정지/홈을 제공합니다.
   */
  const STYLE_ID = "today-pause-style";
  let cfg = null;
  let btn = null;
  let overlay = null;
  let autoPaused = false;
  let mountedExplicit = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.today-pause-btn{
  position:absolute;top:52px;left:10px;right:auto;z-index:8;
  appearance:none;border:none;min-width:44px;min-height:36px;padding:0 12px;
  border-radius:999px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;
  color:#3d2a45;background:rgba(255,255,255,.92);
  box-shadow:0 4px 0 rgba(61,42,69,.18);pointer-events:auto;
}
.today-pause-btn:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(61,42,69,.18)}
.today-pause-btn[hidden]{display:none!important}
.today-pause-overlay{
  position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;
  background:rgba(20,18,28,.62);backdrop-filter:blur(8px);color:#fff;
}
.today-pause-overlay[hidden]{display:none!important}
.today-pause-overlay h2{
  margin:0;font-family:"Bagel Fat One","Jua",cursive;font-weight:400;font-size:34px;
  text-shadow:0 3px 0 rgba(0,0,0,.2);
}
.today-pause-overlay p{margin:0;font-size:15px;opacity:.92}
.today-pause-actions{display:flex;flex-direction:column;gap:10px;align-items:center;margin-top:4px;width:min(240px,80%)}
.today-pause-overlay .today-pause-resume,
.today-pause-overlay .today-pause-home{
  appearance:none;border:none;width:100%;min-height:48px;padding:0 22px;
  border-radius:999px;font:inherit;font-size:17px;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;text-decoration:none;
  box-sizing:border-box;
}
.today-pause-overlay .today-pause-resume{
  color:#fff;background:linear-gradient(180deg,#ff8ab5,#ff4f8b);box-shadow:0 5px 0 #d93f74;
}
.today-pause-overlay .today-pause-resume:active{transform:translateY(2px);box-shadow:0 3px 0 #d93f74}
.today-pause-overlay .today-pause-home{
  color:#243048;background:rgba(255,255,255,.94);box-shadow:0 4px 0 rgba(20,24,40,.18);font-weight:700;
}
.today-pause-overlay .today-pause-home:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(20,24,40,.18)}
.today-pause-overlay .today-pause-hint{margin-top:2px;font-size:12px;opacity:.7}
`;
    document.head.appendChild(style);
  }

  function stageRoot() {
    return document.querySelector(".stage") || document.body;
  }

  function goHome(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    window.location.href = "/";
  }

  function ensureDom() {
    ensureStyles();
    const root = stageRoot();
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "today-pause-btn";
      btn.id = "today-pause-btn";
      btn.setAttribute("aria-label", "잠시 멈춤");
      btn.textContent = "일시정지";
      btn.hidden = true;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
      root.appendChild(btn);
    }
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "today-pause-overlay";
      overlay.id = "today-pause-overlay";
      overlay.hidden = true;
      overlay.innerHTML = `
        <h2>잠깐 멈춤</h2>
        <p>쉬었다가 이어하거나 홈으로 나갈 수 있어요</p>
        <div class="today-pause-actions">
          <button type="button" class="today-pause-resume" id="today-pause-resume">계속하기</button>
          <a class="today-pause-home" id="today-pause-home" href="/">홈으로</a>
        </div>
        <p class="today-pause-hint">Esc / P · 일시정지</p>
      `;
      overlay.querySelector("#today-pause-resume").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        resume();
      });
      overlay.querySelector("#today-pause-home").addEventListener("click", goHome);
      root.appendChild(overlay);
    }
  }

  function syncUi() {
    if (!cfg) return;
    ensureDom();
    const paused = Boolean(cfg.isPaused && cfg.isPaused());
    const canShow = Boolean(cfg.canPause && cfg.canPause()) || paused;
    btn.hidden = !canShow;
    btn.textContent = paused ? "계속" : "일시정지";
    overlay.hidden = !paused;
  }

  function pause() {
    if (!cfg || !cfg.pause) return false;
    if (cfg.isPaused && cfg.isPaused()) return true;
    if (cfg.canPause && !cfg.canPause()) return false;
    const ok = cfg.pause();
    if (ok === false) return false;
    try {
      if (window.TodayBGM && TodayBGM.stop) TodayBGM.stop();
    } catch (_) {}
    syncUi();
    return true;
  }

  function resume() {
    if (!cfg || !cfg.resume) return false;
    if (cfg.isPaused && !cfg.isPaused()) return false;
    const ok = cfg.resume();
    if (ok === false) return false;
    try {
      if (window.TodayBGM && TodayBGM.start) {
        const id = document.body && document.body.getAttribute("data-bgm");
        if (id) TodayBGM.start(id);
      }
    } catch (_) {}
    syncUi();
    return true;
  }

  function toggle() {
    if (cfg && cfg.isPaused && cfg.isPaused()) resume();
    else pause();
  }

  function onKey(e) {
    if (!cfg) return;
    if (e.code === "KeyH" && cfg.isPaused && cfg.isPaused()) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      goHome();
      return;
    }
    if (e.code !== "Escape" && e.code !== "KeyP") return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault();
    toggle();
  }

  function onVisibility() {
    if (document.hidden) pause();
  }

  function ensureAdBoards() {
    if (window.__todayAdBoardsLoading) return;
    const run = () => {
      try {
        if (window.TodayAdBoards && TodayAdBoards.autoMount) TodayAdBoards.autoMount();
      } catch (_) {}
    };
    if (window.TodayAdBoards) {
      run();
      return;
    }
    window.__todayAdBoardsLoading = true;
    const s = document.createElement("script");
    s.src = "/js/ad-boards.js";
    s.async = true;
    s.onload = () => {
      window.__todayAdBoardsLoading = false;
      run();
    };
    s.onerror = () => {
      window.__todayAdBoardsLoading = false;
    };
    document.head.appendChild(s);
  }

  function defaultCanPause() {
    const path = location.pathname || "";
    if (!path.includes("/games/")) return false;
    const blockers = ["#title", "#game-over", "#over", "#result"];
    for (const sel of blockers) {
      const el = document.querySelector(sel);
      if (el && !el.classList.contains("hidden") && el.offsetParent !== null) return false;
    }
    return Boolean(document.querySelector(".stage"));
  }

  function autoMount() {
    if (cfg) return;
    if (!document.querySelector(".stage")) return;
    if (!(location.pathname || "").includes("/games/")) return;
    window.TodayPause.mount({
      canPause: defaultCanPause,
      isPaused: () => autoPaused,
      pause() {
        autoPaused = true;
        window.__todayGamePaused = true;
        return true;
      },
      resume() {
        autoPaused = false;
        window.__todayGamePaused = false;
        return true;
      },
    });
  }

  window.TodayPause = {
    mount(options) {
      cfg = options || null;
      mountedExplicit = true;
      autoPaused = false;
      ensureDom();
      syncUi();
      ensureAdBoards();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      window.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onVisibility);
      if (!window.__todayPauseTick) {
        window.__todayPauseTick = setInterval(() => {
          if (cfg) syncUi();
          try {
            if (window.TodayAdBoards && TodayAdBoards.syncVisibility) {
              TodayAdBoards.syncVisibility();
            }
          } catch (_) {}
        }, 250);
      }
    },
    pause,
    resume,
    toggle,
    sync: syncUi,
  };

  function boot() {
    ensureAdBoards();
    // Give game scripts a moment to mount explicitly, then fall back.
    setTimeout(autoMount, 120);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
