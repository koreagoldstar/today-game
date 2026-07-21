(() => {
  "use strict";

  /**
   * 오늘의 게임 공통 일시정지
   * 사용: game.js 끝에서 TodayPause.mount({ canPause, isPaused, pause, resume })
   */
  const STYLE_ID = "today-pause-style";
  let cfg = null;
  let btn = null;
  let overlay = null;

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
  align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;
  background:rgba(40,30,50,.55);backdrop-filter:blur(6px);color:#fff;
}
.today-pause-overlay[hidden]{display:none!important}
.today-pause-overlay h2{
  margin:0;font-family:"Bagel Fat One","Jua",cursive;font-weight:400;font-size:34px;
  text-shadow:0 3px 0 rgba(0,0,0,.2);
}
.today-pause-overlay p{margin:0;font-size:15px;opacity:.92}
.today-pause-overlay .today-pause-resume{
  appearance:none;border:none;min-width:160px;min-height:48px;margin-top:6px;
  padding:0 22px;border-radius:999px;font:inherit;font-size:18px;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,#ff8ab5,#ff4f8b);box-shadow:0 5px 0 #d93f74;
}
.today-pause-overlay .today-pause-resume:active{transform:translateY(2px);box-shadow:0 3px 0 #d93f74}
.today-pause-overlay a{color:#fff;opacity:.9;text-decoration:none;font-size:14px;margin-top:4px}
`;
    document.head.appendChild(style);
  }

  function stageRoot() {
    return document.querySelector(".stage") || document.body;
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
        <p>쉬었다가 다시 달려요</p>
        <button type="button" class="today-pause-resume" id="today-pause-resume">계속하기</button>
        <a href="/">← 홈</a>
      `;
      overlay.querySelector("#today-pause-resume").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        resume();
      });
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
    if (e.code !== "Escape" && e.code !== "KeyP") return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    e.preventDefault();
    toggle();
  }

  function onVisibility() {
    if (document.hidden) pause();
  }

  window.TodayPause = {
    mount(options) {
      cfg = options || null;
      ensureDom();
      syncUi();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      window.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onVisibility);
      // HUD 상태 동기화
      if (!window.__todayPauseTick) {
        window.__todayPauseTick = setInterval(() => {
          if (cfg) syncUi();
        }, 250);
      }
    },
    pause,
    resume,
    toggle,
    sync: syncUi,
  };
})();
