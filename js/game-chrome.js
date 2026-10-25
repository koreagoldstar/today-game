(() => {
  "use strict";

  if (window.TodayChrome) return;

  const STYLE_HREF = "/css/game-chrome.css?v=5";
  const FONT_HREF = "https://fonts.googleapis.com/css2?family=Bagel+Fat+One&family=Jua&family=Noto+Sans+KR:wght@500;700;900&display=swap";
  const HOME_LABEL = "홈으로 가기 (오늘의 게임)";
  /** 아이들도 바로 알아보는 집 모양 홈 버튼 (분홍 지붕 · 굴뚝 · '홈' 글자) */
  const HOUSE_SVG = `<svg class="today-house" viewBox="0 0 64 60" aria-hidden="true" focusable="false">
    <rect x="42" y="8" width="8.5" height="16" rx="2" fill="#ff8fb6" stroke="#4a2f63" stroke-width="3"/>
    <rect x="10.5" y="25" width="43" height="32" rx="6.5" fill="#fff7e6" stroke="#4a2f63" stroke-width="3"/>
    <path d="M32 4 L59.6 27.4 Q62 30.6 58.2 31 H5.8 Q2 30.6 4.4 27.4 Z" fill="#ff6f9e" stroke="#4a2f63" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14.5 25 L31 11" stroke="#ffffff" stroke-opacity="0.75" stroke-width="3" stroke-linecap="round" fill="none"/>
    <text x="32" y="51.4" text-anchor="middle" font-size="18.5" fill="#4a2f63">홈</text>
  </svg>`;
  /** 글자 옆에 붙는 작은 집 (문 달린 집) */
  const HOUSE_MINI = `<svg class="today-house-mini" viewBox="0 0 64 60" aria-hidden="true" focusable="false">
    <rect x="10.5" y="25" width="43" height="32" rx="6.5" fill="#fff7e6" stroke="#4a2f63" stroke-width="4"/>
    <path d="M32 4 L59.6 27.4 Q62 30.6 58.2 31 H5.8 Q2 30.6 4.4 27.4 Z" fill="#ff6f9e" stroke="#4a2f63" stroke-width="4" stroke-linejoin="round"/>
    <rect x="25" y="37" width="14" height="20" rx="4" fill="#ffb547" stroke="#4a2f63" stroke-width="3.5"/>
  </svg>`;
  const HOME_LINKS = 'a[href="/"], a[href="../../"], a[href="/index.html"]';

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

  /** 이 줄(점수 줄 등)의 왼쪽이 다른 화면에 덮여 있나 */
  function covered(row) {
    const r = row.getBoundingClientRect();
    if (!r.width || !r.height) return true;
    const t = document.elementFromPoint(r.left + Math.min(30, r.width / 2), r.top + r.height / 2);
    return !t || (!row.contains(t) && !(brand && brand.contains(t)));
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
      home.style.display = "none";
      home.setAttribute("aria-hidden", "true");
      // 첫 화면이 점수 줄을 덮고 있으면 (그대로 두면 집 버튼이 안 보임) 첫 화면 위로
      const title = document.querySelector("#title");
      if (title && titleOpen() && covered(home.parentNode)) {
        if (brand.parentNode !== title) title.insertBefore(brand, title.firstChild);
        return;
      }
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
      brand.setAttribute("aria-label", HOME_LABEL);
      brand.title = "홈으로";
      brand.innerHTML = HOUSE_SVG;
      brand.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
      brand.addEventListener("click", (e) => e.stopPropagation());
    }

    placeMute();
    placeBrand();
    placePanelHomes();
    decorateHomeLinks();
    paintMute();
  }

  /** 스테이지 지도 · 목록 같은 화면: data-today-home 이 붙은 화면 왼쪽 위에도 집 버튼 */
  function placePanelHomes() {
    if (!isGamePage()) return;
    for (const el of document.querySelectorAll("[data-today-home]:not(a)")) {
      if (el.querySelector(":scope > .today-home-btn, :scope > * > .today-home-btn")) continue;
      const a = document.createElement("a");
      a.className = "today-home-btn";
      a.href = "/";
      a.setAttribute("aria-label", HOME_LABEL);
      a.title = "홈으로";
      a.innerHTML = HOUSE_SVG;
      a.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
      a.addEventListener("click", (e) => e.stopPropagation());
      // 화면 머리줄에 '뒤로' 버튼이 있으면 그 바로 옆에 (겹치지 않게), 없으면 화면 왼쪽 위
      const head = el.querySelector(":scope > .panel-head, :scope > header");
      const back = head && head.querySelector(":scope > [data-back], :scope > .btn-back");
      if (back) {
        a.classList.add("is-inline");
        back.insertAdjacentElement("afterend", a);
        continue;
      }
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.insertBefore(a, el.firstChild);
    }
  }

  /** 게임 안의 '← 홈' · '← 오늘의 게임' · 🏠 같은 홈 링크도 집 모양으로 (한 번만) */
  function decorateHomeLinks() {
    if (!isGamePage()) return;
    for (const a of document.querySelectorAll(HOME_LINKS)) {
      if (a === brand || a.classList.contains("today-home-btn") || a.dataset.todayHomeDone) continue;
      a.dataset.todayHomeDone = "1";
      if (!a.getAttribute("aria-label")) a.setAttribute("aria-label", HOME_LABEL);
      const text = (a.textContent || "").trim();
      if (/^🏠$/u.test(text)) {
        // 아이콘만 있던 버튼: 같은 크기로 집 버튼 그림
        a.classList.add("today-home-icon");
        a.innerHTML = HOUSE_SVG;
        continue;
      }
      if (a.querySelector("img, svg")) continue;
      const label = /오늘의\s*게임|홈으로|사이트/.test(text) ? "홈으로" : /홈/.test(text) ? "홈" : text.replace(/^[←‹<\s]+/, "") || "홈으로";
      a.classList.add("today-home-link");
      a.innerHTML = `${HOUSE_MINI}<span>${label}</span>`;
    }
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
        placePanelHomes();
        decorateHomeLinks();
        paintMute();
      }, 800);
    }
  }

  /** 게임 페이지로 바로 들어온 방문자도 센다 (홈과 같은 표시: 같은 브라우저는 하루 한 번) */
  function countVisit() {
    if (!isGamePage()) return; // 홈은 js/main.js 가 센다
    try {
      const day = new Date().toLocaleString("en-CA", { timeZone: "Asia/Seoul" }).slice(0, 10);
      const flag = `today-game-visit-${day}`;
      if (localStorage.getItem(flag)) return;
      localStorage.setItem(flag, "1");
      fetch("/api/visits?count=1", { cache: "no-store", keepalive: true }).catch(() => {});
    } catch (_) {
      /* 저장소를 못 쓰는 환경 — 세지 않음 */
    }
  }

  window.TodayChrome = { mount, sync: paintMute };

  function boot() {
    mount();
    countVisit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
