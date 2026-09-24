(() => {
  "use strict";

  if (window.TodayChrome) return;

  const STYLE_HREF = "/css/game-chrome.css?v=4";
  const FONT_HREF = "https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap";
  const CHICK_SRC = "/assets/edu/edu_chick.svg";

  let muteBtn = null;
  let brand = null;
  let mounted = false;

  function isGamePage() {
    return /\/games\//.test(location.pathname || "");
  }

  function stageRoot() {
    return document.querySelector(".stage") || document.querySelector(".app") || document.body;
  }

  function ensureFont() {
    if (document.querySelector('link[data-today-font="1"]')) return;
    const has = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((n) =>
      /family=Jua/.test(n.href || "")
    );
    if (has) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_HREF;
    link.setAttribute("data-today-font", "1");
    document.head.appendChild(link);
  }

  function ensureCss() {
    if (document.querySelector('link[data-today-chrome="1"], link[href*="game-chrome.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_HREF;
    link.setAttribute("data-today-chrome", "1");
    document.head.appendChild(link);
  }

  function mutedNow() {
    return Boolean(window.TodayAudio && TodayAudio.isMuted());
  }

  function paintMute() {
    if (!muteBtn) return;
    const on = mutedNow();
    muteBtn.textContent = on ? "🔇" : "🔊";
    muteBtn.classList.toggle("is-muted", on);
    muteBtn.setAttribute("aria-label", on ? "소리 켜기" : "소리 끄기");
    muteBtn.setAttribute("title", on ? "소리 켜기" : "소리 끄기");
    muteBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function stopChromeEvent(e) {
    if (!e) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  function onMuteToggle(e) {
    stopChromeEvent(e);
    if (window.TodayAudio) TodayAudio.toggle();
    else if (window.TodayBGM && TodayBGM.setMuted) TodayBGM.setMuted(true);
    paintMute();
  }

  function titleOpen() {
    const title = document.querySelector("#title");
    return Boolean(title && !title.classList.contains("hidden") && title.offsetParent !== null);
  }

  function placeMute() {
    if (!muteBtn) return;
    muteBtn.style.top = "";
    const speak = document.getElementById("speak-btn");
    if (speak && speak.parentNode) {
      if (muteBtn.parentNode !== speak.parentNode) speak.parentNode.insertBefore(muteBtn, speak);
      return;
    }
    const heroTop = document.querySelector(".hero-top");
    if (heroTop && !isGamePage()) {
      if (muteBtn.parentNode !== heroTop) heroTop.appendChild(muteBtn);
      return;
    }
    const simpleHud = document.querySelector(".stage header.hud");
    if (simpleHud && !simpleHud.querySelector(".versus")) {
      if (muteBtn.parentNode !== simpleHud) simpleHud.appendChild(muteBtn);
      return;
    }
    const root = stageRoot();
    if (muteBtn.parentNode !== root) root.appendChild(muteBtn);
    const hud = root.querySelector(".hud");
    if (!titleOpen() && hud && hud.offsetParent) {
      const hudBox = hud.getBoundingClientRect();
      const rootBox = root.getBoundingClientRect();
      if (hudBox.top - rootBox.top < 64 && hudBox.width > rootBox.width * 0.6) {
        muteBtn.style.top = `${Math.max(10, Math.round(hudBox.bottom - rootBox.top + 6))}px`;
      }
    }
  }

  function placeBrand() {
    if (!brand || !isGamePage()) return;
    if (document.getElementById("speak-btn")) {
      brand.hidden = true;
      return;
    }
    brand.hidden = false;
    const home = document.querySelector(".stage header.hud .home, .stage .hud > a.home, .app .home");
    if (home && home.parentNode) {
      home.hidden = true;
      home.setAttribute("aria-hidden", "true");
      if (brand.parentNode !== home.parentNode) home.parentNode.insertBefore(brand, home);
      return;
    }
    const host =
      document.querySelector("#title") ||
      document.querySelector(".overlay") ||
      stageRoot();
    if (brand.parentNode !== host) {
      host.insertBefore(brand, host.firstChild);
    }
  }

  function ensureDom() {
    ensureFont();
    ensureCss();
    const root = stageRoot();

    if (!muteBtn) {
      muteBtn = document.createElement("button");
      muteBtn.type = "button";
      muteBtn.className = "today-mute-btn";
      muteBtn.id = "today-mute-btn";
      muteBtn.addEventListener("pointerdown", stopChromeEvent, true);
      muteBtn.addEventListener("click", onMuteToggle, true);
      root.appendChild(muteBtn);
    }

    if (!brand && isGamePage()) {
      brand = document.createElement("a");
      brand.className = "today-brand";
      brand.id = "today-brand";
      brand.href = "/";
      brand.setAttribute("aria-label", "오늘의 게임 홈");
      brand.innerHTML = `<img src="${CHICK_SRC}" alt="" width="28" height="28" /><span>오늘의게임</span>`;
      brand.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
      brand.addEventListener("click", (e) => e.stopPropagation());
    }

    placeMute();
    placeBrand();
    paintMute();
  }

  function onKey(e) {
    if (!e || (e.code !== "KeyM" && e.key !== "m" && e.key !== "M")) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
    e.preventDefault();
    if (window.TodayAudio) TodayAudio.toggle();
    paintMute();
  }

  function mount() {
    if (mounted) {
      ensureDom();
      return;
    }
    mounted = true;
    ensureDom();
    window.addEventListener("todaygame-mute", paintMute);
    window.addEventListener("keydown", onKey);
    if (!window.__todayChromeTick) {
      window.__todayChromeTick = setInterval(() => {
        placeMute();
        placeBrand();
        paintMute();
      }, 800);
    }
  }

  window.TodayChrome = { mount, sync: paintMute };

  function boot() {
    mount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
