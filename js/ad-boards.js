(() => {
  "use strict";

  /**
   * 공통 광고/간판 설정
   * 나중에 문구·색·이미지만 바꾸면 pause.js 쓰는 전 게임에 반영됩니다.
   * image: null → 문구 간판 / image: "/assets/ads/foo.png" → 이미지 간판
   *
   * 표시 규칙: 게임 플레이 영역을 절대 가리지 않음.
   * - 스테이지 옆 여백(≥110px)이 있을 때만 옆에 표시
   * - 모바일처럼 화면을 꽉 채우면 숨김
   */
  const DEFAULT_CONFIG = {
    enabled: true,
    items: [
      {
        id: "love-1",
        text: "오늘의 게임",
        subtext: "TODAY",
        bg: "#FFE4EC",
        accent: "#FF6B9D",
        textColor: "#5A3A4A",
        image: null,
      },
      {
        id: "love-2",
        text: "오늘의 게임",
        subtext: "TODAY",
        bg: "#E8F6FF",
        accent: "#5B9FFF",
        textColor: "#2A4A6A",
        image: null,
      },
      {
        id: "love-3",
        text: "오늘의 게임",
        subtext: "TODAY",
        bg: "#FFF3D6",
        accent: "#FFB347",
        textColor: "#6A4A20",
        image: null,
      },
      {
        id: "love-4",
        text: "오늘의 게임",
        subtext: "TODAY",
        bg: "#EDE6FF",
        accent: "#9B7EDE",
        textColor: "#3A2A5A",
        image: null,
      },
    ],
  };

  const STYLE_ID = "today-ad-boards-style";
  const ROOT_ID = "today-ad-boards";
  const MIN_SIDE_GAP = 110;
  const imageCache = Object.create(null);
  let mounted = false;
  let rotateTimer = 0;
  let rotateIndex = 0;
  let placeRaf = 0;

  function config() {
    const user = window.TODAY_AD_BOARDS;
    if (!user || typeof user !== "object") return DEFAULT_CONFIG;
    return {
      enabled: user.enabled !== false,
      items: Array.isArray(user.items) && user.items.length ? user.items : DEFAULT_CONFIG.items,
    };
  }

  function getItems() {
    const cfg = config();
    return cfg.enabled ? cfg.items.slice() : [];
  }

  function getItem(index) {
    const items = getItems();
    if (!items.length) return null;
    const i = ((index % items.length) + items.length) % items.length;
    return items[i];
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${ROOT_ID}{
  position:fixed;inset:0;z-index:2;pointer-events:none;overflow:visible;
}
#${ROOT_ID}[hidden]{display:none!important}
#${ROOT_ID} .today-ad-board{
  position:fixed;width:102px;min-height:56px;padding:8px 6px 10px;
  border-radius:12px;border:3px solid #ff6b9d;box-sizing:border-box;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;box-shadow:0 4px 0 rgba(61,42,69,.12);opacity:.94;
  font-family:"Jua","Nunito",sans-serif;line-height:1.15;
  left:auto;right:auto;top:auto;bottom:auto;
}
#${ROOT_ID} .today-ad-board::after{
  content:"";position:absolute;left:14px;bottom:-18px;width:6px;height:18px;
  background:#c9b8a0;border-radius:2px;
}
#${ROOT_ID} .today-ad-board.right::after{left:auto;right:14px}
#${ROOT_ID} .today-ad-board .ad-text{
  font-size:12px;font-weight:700;letter-spacing:-0.04em;
}
#${ROOT_ID} .today-ad-board .ad-sub{
  margin-top:2px;font-size:9px;opacity:.75;font-family:Nunito,sans-serif;font-weight:700;
}
#${ROOT_ID} .today-ad-board img{
  display:block;width:100%;height:100%;object-fit:contain;border-radius:6px;
}
`;
    document.head.appendChild(style);
  }

  function stageRoot() {
    return document.querySelector("#app .stage") || document.querySelector(".stage") || null;
  }

  function preloadImages() {
    getItems().forEach((ad) => {
      if (!ad || !ad.image || imageCache[ad.id]) return;
      const img = new Image();
      img.decoding = "async";
      img.src = ad.image;
      imageCache[ad.id] = img;
    });
  }

  function getImage(ad) {
    if (!ad || !ad.image) return null;
    if (imageCache[ad.id] && imageCache[ad.id].complete && imageCache[ad.id].naturalWidth) {
      return imageCache[ad.id];
    }
    return null;
  }

  function roundRect(ctx, x, y, w, h, rr) {
    const r = Math.min(rr, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(ctx, ad, x, y, w, h, opts) {
    if (!ctx || !ad) return;
    const o = opts || {};
    const side = o.side || "left";
    const img =
      (o.images && (o.images[`ad:${ad.id}`] || o.images[ad.id])) || getImage(ad);

    if (o.pole !== false) {
      ctx.fillStyle = "#c9b8a0";
      const poleX = side === "left" ? x + 16 : x + w - 22;
      ctx.fillRect(poleX, y + h - 4, 6, 40);
    }

    ctx.fillStyle = ad.bg || "#fff";
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = ad.accent || "#ff6b9d";
    ctx.lineWidth = 3;
    ctx.stroke();

    if (img) {
      const pad = 8;
      ctx.drawImage(img, x + pad, y + pad, w - pad * 2, h - pad * 2);
    } else {
      ctx.fillStyle = ad.textColor || "#4a3545";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = 'bold 14px "Jua", sans-serif';
      ctx.fillText(ad.text || "AD", x + w / 2, y + h / 2 - (ad.subtext ? 4 : 0));
      if (ad.subtext) {
        ctx.font = '11px "Nunito", sans-serif';
        ctx.globalAlpha = 0.75;
        ctx.fillText(ad.subtext, x + w / 2, y + h / 2 + 14);
        ctx.globalAlpha = 1;
      }
    }

    ctx.fillStyle = ad.accent || "#ff6b9d";
    ctx.beginPath();
    ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function buildBoardEl(ad) {
    const el = document.createElement("div");
    el.className = "today-ad-board";
    el.style.background = ad.bg || "#FFE4EC";
    el.style.borderColor = ad.accent || "#FF6B9D";
    el.style.color = ad.textColor || "#5A3A4A";
    el.dataset.adId = ad.id || "ad";

    if (ad.image) {
      const img = document.createElement("img");
      img.alt = ad.text || "ad";
      img.src = ad.image;
      img.loading = "lazy";
      el.appendChild(img);
    } else {
      const t = document.createElement("div");
      t.className = "ad-text";
      t.textContent = ad.text || "오늘의 게임";
      el.appendChild(t);
      if (ad.subtext) {
        const s = document.createElement("div");
        s.className = "ad-sub";
        s.textContent = ad.subtext;
        el.appendChild(s);
      }
    }
    return el;
  }

  function renderOneBoard(wrap) {
    const items = getItems();
    if (!items.length || !wrap) return;
    rotateIndex = rotateIndex % items.length;
    const ad = items[rotateIndex];
    wrap.innerHTML = "";
    wrap.appendChild(buildBoardEl(ad));
    placeBesideStage();
  }

  /** Place board in the side margin next to .stage — never over the playfield. */
  function placeBesideStage() {
    const wrap = document.getElementById(ROOT_ID);
    const board = wrap && wrap.querySelector(".today-ad-board");
    const stage = stageRoot();
    if (!wrap || !board) return;

    if (!stage) {
      wrap.hidden = true;
      return;
    }

    const sr = stage.getBoundingClientRect();
    const leftGap = sr.left;
    const rightGap = window.innerWidth - sr.right;
    const useLeft = leftGap >= MIN_SIDE_GAP && leftGap >= rightGap;
    const useRight = rightGap >= MIN_SIDE_GAP && rightGap > leftGap;

    if (!useLeft && !useRight) {
      // Mobile / full-bleed stage: hide so gameplay is never covered
      wrap.hidden = true;
      return;
    }

    wrap.hidden = false;
    const bw = board.offsetWidth || 102;
    const bh = board.offsetHeight || 56;
    const top = Math.max(12, Math.min(window.innerHeight - bh - 24, sr.top + sr.height * 0.35));

    board.classList.toggle("right", useRight);
    board.style.top = `${Math.round(top)}px`;
    board.style.bottom = "auto";

    if (useLeft) {
      const left = Math.max(8, Math.round(sr.left - bw - 12));
      board.style.left = `${left}px`;
      board.style.right = "auto";
    } else {
      const left = Math.min(window.innerWidth - bw - 8, Math.round(sr.right + 12));
      board.style.left = `${left}px`;
      board.style.right = "auto";
    }
  }

  function schedulePlace() {
    if (placeRaf) cancelAnimationFrame(placeRaf);
    placeRaf = requestAnimationFrame(() => {
      placeRaf = 0;
      placeBesideStage();
    });
  }

  function syncVisibility() {
    placeBesideStage();
  }

  function autoMount() {
    const cfg = config();
    if (!cfg.enabled) return false;
    if (document.body && document.body.getAttribute("data-ad-overlay") === "off") {
      preloadImages();
      return false;
    }

    ensureStyles();
    preloadImages();

    let wrap = document.getElementById(ROOT_ID);
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = ROOT_ID;
      wrap.setAttribute("aria-hidden", "true");
      document.body.appendChild(wrap);
    } else if (wrap.parentElement !== document.body) {
      // migrate off .stage so it never covers gameplay
      document.body.appendChild(wrap);
    }

    renderOneBoard(wrap);
    if (rotateTimer) clearInterval(rotateTimer);
    rotateTimer = setInterval(() => {
      rotateIndex += 1;
      const el = document.getElementById(ROOT_ID);
      if (el) renderOneBoard(el);
    }, 9000);

    window.removeEventListener("resize", schedulePlace);
    window.addEventListener("resize", schedulePlace);
    window.removeEventListener("orientationchange", schedulePlace);
    window.addEventListener("orientationchange", schedulePlace);

    mounted = true;
    schedulePlace();
    return true;
  }

  function unmount() {
    if (rotateTimer) {
      clearInterval(rotateTimer);
      rotateTimer = 0;
    }
    window.removeEventListener("resize", schedulePlace);
    window.removeEventListener("orientationchange", schedulePlace);
    const wrap = document.getElementById(ROOT_ID);
    if (wrap) wrap.remove();
    mounted = false;
  }

  window.TodayAdBoards = {
    getItems,
    getItem,
    getImage,
    preloadImages,
    draw,
    autoMount,
    unmount,
    syncVisibility,
    placeBesideStage,
    isMounted: () => mounted,
  };

  if (!window.TODAY_AD_BOARDS) {
    window.TODAY_AD_BOARDS = {
      enabled: DEFAULT_CONFIG.enabled,
      items: DEFAULT_CONFIG.items.map((x) => Object.assign({}, x)),
    };
  }
})();
