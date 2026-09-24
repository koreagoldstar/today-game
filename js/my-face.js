/*
 * 내 얼굴로 플레이 — 아이 사진을 동그랗게 잘라 캐릭터 머리에 씌워요.
 * 사진은 이 기기(localStorage)에만 저장하고, 서버·랭킹·공유 카드로 절대 보내지 않아요.
 *
 * 게임에서 쓰는 법:
 *   <body data-face="1"> 이면 시작 화면(#title)에 "내 얼굴" 버튼이 자동으로 붙어요.
 *   그리기: TodayFace.drawHead(ctx, cx, cy, r) — 얼굴이 켜져 있으면 그리고 true 를 돌려줘요.
 */
(() => {
  "use strict";

  if (window.TodayFace) return;

  const KEY = "todaygame.face.v1";
  const OUT = 256;
  const STYLE_ID = "today-face-style";

  let data = load();
  let faceImg = null;
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && typeof d.img === "string" && d.img.startsWith("data:image/") ? d : null;
    } catch (_) {
      return null;
    }
  }

  function save(next) {
    data = next;
    faceImg = null;
    try {
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch (_) {
      /* 저장 공간이 없어도 이번 판에는 쓸 수 있어요 */
    }
    buildImg();
    emit();
  }

  function buildImg() {
    if (!data) {
      faceImg = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      faceImg = img;
      emit();
    };
    img.src = data.img;
  }

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn(api.active());
      } catch (_) {}
    });
    paintChips();
  }

  /* ---------- 그리기 ---------- */

  function drawHead(ctx, cx, cy, r, opts) {
    if (!api.active() || !faceImg || !ctx || !(r > 0)) return false;
    const o = opts || {};
    const ring = o.ring == null ? Math.max(1.5, r * 0.12) : o.ring;
    ctx.save();
    if (o.rotate) {
      ctx.translate(cx, cy);
      ctx.rotate(o.rotate);
      ctx.translate(-cx, -cy);
    }
    if (ring > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + ring, 0, Math.PI * 2);
      ctx.fillStyle = o.ringColor || "#ffd23f";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (o.flipX) {
      ctx.translate(cx * 2, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(faceImg, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return true;
  }

  // 스프라이트 상자(x, y, w, h) 안의 머리 위치를 비율 [가로, 세로, 반지름(w 기준)] 으로 받아 그려요.
  function drawOnSprite(ctx, x, y, w, h, head, opts) {
    if (!head) return false;
    const o = opts || {};
    const fx = o.flipX ? 1 - head[0] : head[0];
    return drawHead(ctx, x + w * fx, y + h * head[1], w * head[2], o);
  }

  /* ---------- 스타일 ---------- */

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
.today-face-chip{appearance:none;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;
  margin:6px auto 10px;padding:5px 14px 5px 5px;border-radius:999px;background:#fff;color:#3d2a36;
  font:16px "Jua",system-ui,sans-serif;box-shadow:0 4px 0 rgba(61,42,54,.18);-webkit-tap-highlight-color:transparent}
.today-face-chip:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(61,42,54,.18)}
.today-face-chip .tf-thumb{width:34px;height:34px;border-radius:50%;background:#ffe27a center/cover no-repeat;
  display:grid;place-items:center;font-size:20px;box-shadow:0 0 0 3px #ffd23f}
.today-face-chip .tf-state{font-size:12px;padding:2px 7px;border-radius:999px;background:#eee;color:#777}
.today-face-chip.is-on .tf-state{background:#2fbf8a;color:#fff}
.tf-back{position:fixed;inset:0;z-index:9999;background:rgba(20,14,30,.62);display:grid;place-items:center;
  padding:16px;font-family:"Jua",system-ui,sans-serif}
.tf-card{width:min(360px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#fffaf0;border-radius:24px;
  padding:18px 18px 16px;color:#3d2a36;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.tf-card h2{margin:0 0 4px;font-size:22px;font-weight:400}
.tf-card p{margin:0 0 10px;font-size:14px;line-height:1.45;color:#6b5563}
.tf-view{position:relative;width:240px;height:240px;margin:6px auto 10px;border-radius:50%;overflow:hidden;
  background:#ffe27a;box-shadow:0 0 0 6px #ffd23f;touch-action:none;cursor:grab}
.tf-view canvas{width:100%;height:100%;display:block}
.tf-view .tf-empty{position:absolute;inset:0;display:grid;place-items:center;font-size:84px}
.tf-view .tf-empty[hidden]{display:none}
.tf-zoom{width:220px;margin:4px auto 12px;display:block;accent-color:#ff4f8b}
.tf-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px}
.tf-btn{appearance:none;border:none;cursor:pointer;font:16px "Jua",system-ui,sans-serif;padding:10px 16px;
  border-radius:999px;background:#ff4f8b;color:#fff;box-shadow:0 4px 0 #c92f67}
.tf-btn.soft{background:#fff;color:#3d2a36;box-shadow:0 4px 0 rgba(61,42,54,.18)}
.tf-btn.warn{background:#fff;color:#d6334e;box-shadow:0 4px 0 rgba(214,51,78,.25)}
.tf-btn:disabled{opacity:.45;cursor:default}
.tf-toggle{display:flex;align-items:center;justify-content:center;gap:8px;margin:10px 0 2px;font-size:15px}
.tf-toggle input{width:20px;height:20px;accent-color:#2fbf8a}
.tf-safe{margin-top:12px!important;padding:10px 12px;border-radius:14px;background:#eef8f3;color:#2d6b52!important;
  font-size:13px!important;text-align:left}
`;
    document.head.appendChild(s);
  }

  /* ---------- 사진 고르기 창 ---------- */

  function openPicker() {
    ensureStyle();
    if (document.querySelector(".tf-back")) return;

    const back = document.createElement("div");
    back.className = "tf-back";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.setAttribute("aria-label", "내 얼굴 캐릭터 만들기");
    back.innerHTML = `
      <div class="tf-card">
        <h2>내 얼굴로 플레이</h2>
        <p>사진을 고르고, 얼굴이 동그라미 안에 오도록<br />끌어서 옮기고 크기를 맞춰요.</p>
        <div class="tf-view"><canvas width="${OUT}" height="${OUT}"></canvas><div class="tf-empty">🐤</div></div>
        <input class="tf-zoom" type="range" min="1" max="4" step="0.01" value="1" aria-label="확대" disabled />
        <input class="tf-file" type="file" accept="image/*" hidden />
        <div class="tf-row">
          <button type="button" class="tf-btn soft tf-pick">📷 사진 고르기</button>
          <button type="button" class="tf-btn tf-save" disabled>저장</button>
        </div>
        <label class="tf-toggle"><input type="checkbox" class="tf-on" /> 게임에서 내 얼굴 쓰기</label>
        <div class="tf-row">
          <button type="button" class="tf-btn warn tf-del">사진 지우기</button>
          <button type="button" class="tf-btn soft tf-close">닫기</button>
        </div>
        <p class="tf-safe">🔒 사진은 <b>이 기기에만</b> 저장돼요. 인터넷으로 보내지 않고, 랭킹이나 공유 그림에도 나오지 않아요.<br />👨‍👩‍👧 어린이는 보호자와 함께 사용해 주세요.</p>
      </div>`;
    document.body.appendChild(back);

    const q = (s) => back.querySelector(s);
    const canvas = q("canvas");
    const cx = canvas.getContext("2d");
    const view = q(".tf-view");
    const empty = q(".tf-empty");
    const zoom = q(".tf-zoom");
    const file = q(".tf-file");
    const saveBtn = q(".tf-save");
    const delBtn = q(".tf-del");
    const onBox = q(".tf-on");

    let src = null;
    let scale = 1;
    let base = 1;
    let ox = 0;
    let oy = 0;

    onBox.checked = api.active();
    onBox.disabled = !data;
    delBtn.disabled = !data;

    if (data) {
      const cur = new Image();
      cur.onload = () => {
        empty.hidden = true;
        cx.clearRect(0, 0, OUT, OUT);
        cx.drawImage(cur, 0, 0, OUT, OUT);
      };
      cur.src = data.img;
    }

    function clampOffset() {
      const w = src.width * base * scale;
      const h = src.height * base * scale;
      ox = Math.min(0, Math.max(OUT - w, ox));
      oy = Math.min(0, Math.max(OUT - h, oy));
    }

    function render() {
      if (!src) return;
      clampOffset();
      cx.fillStyle = "#ffe27a";
      cx.fillRect(0, 0, OUT, OUT);
      cx.drawImage(src, ox, oy, src.width * base * scale, src.height * base * scale);
    }

    function setZoom(next, fx, fy) {
      if (!src) return;
      const px = fx == null ? OUT / 2 : fx;
      const py = fy == null ? OUT / 2 : fy;
      const prev = scale;
      scale = Math.max(1, Math.min(4, next));
      ox = px - ((px - ox) * scale) / prev;
      oy = py - ((py - oy) * scale) / prev;
      zoom.value = String(scale);
      render();
    }

    function useImage(img) {
      src = img;
      base = OUT / Math.min(img.width, img.height);
      scale = 1;
      ox = (OUT - img.width * base) / 2;
      oy = (OUT - img.height * base) / 2;
      zoom.disabled = false;
      zoom.value = "1";
      saveBtn.disabled = false;
      empty.hidden = true;
      render();
    }

    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      file.value = "";
      if (!f || !/^image\//.test(f.type)) return;
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        useImage(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        alert("이 사진은 열 수 없어요. 다른 사진을 골라 주세요.");
      };
      img.src = url;
    });

    q(".tf-pick").addEventListener("click", () => file.click());
    zoom.addEventListener("input", () => setZoom(Number(zoom.value)));

    // 끌어서 옮기기 + 두 손가락 확대
    const pts = new Map();
    let pinch0 = 0;
    let scale0 = 1;
    const toCanvas = (e) => {
      const b = view.getBoundingClientRect();
      return { x: ((e.clientX - b.left) / b.width) * OUT, y: ((e.clientY - b.top) / b.height) * OUT };
    };
    view.addEventListener("pointerdown", (e) => {
      if (!src) return;
      view.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, toCanvas(e));
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
        scale0 = scale;
      }
    });
    view.addEventListener("pointermove", (e) => {
      if (!src || !pts.has(e.pointerId)) return;
      const p = toCanvas(e);
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, p);
      if (pts.size === 1) {
        ox += p.x - prev.x;
        oy += p.y - prev.y;
        render();
      } else if (pts.size === 2 && pinch0 > 0) {
        const [a, b] = [...pts.values()];
        setZoom(scale0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch0), (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      pinch0 = 0;
    };
    view.addEventListener("pointerup", up);
    view.addEventListener("pointercancel", up);
    view.addEventListener(
      "wheel",
      (e) => {
        if (!src) return;
        e.preventDefault();
        const p = toCanvas(e);
        setZoom(scale * (e.deltaY < 0 ? 1.1 : 0.9), p.x, p.y);
      },
      { passive: false }
    );

    function close() {
      document.removeEventListener("keydown", onEsc, true);
      back.remove();
    }
    function onEsc(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    }
    document.addEventListener("keydown", onEsc, true);
    // 창 안의 키·터치가 뒤에 있는 게임으로 새지 않게
    ["keydown", "keyup", "pointerdown", "touchstart"].forEach((t) =>
      back.addEventListener(t, (e) => e.stopPropagation())
    );
    back.addEventListener("click", (e) => {
      if (e.target === back) close();
    });
    q(".tf-close").addEventListener("click", close);

    saveBtn.addEventListener("click", () => {
      if (!src) return;
      save({ img: canvas.toDataURL("image/jpeg", 0.85), on: true });
      close();
    });
    onBox.addEventListener("change", () => {
      if (data) save({ ...data, on: onBox.checked });
    });
    delBtn.addEventListener("click", () => {
      if (!data) return;
      if (!confirm("저장한 얼굴 사진을 지울까요?")) return;
      save(null);
      close();
    });
  }

  /* ---------- 시작 화면 버튼 ---------- */

  const chips = new Set();

  function paintChips() {
    chips.forEach((chip) => {
      const on = api.active();
      const thumb = chip.querySelector(".tf-thumb");
      if (data) {
        thumb.style.backgroundImage = `url("${data.img}")`;
        thumb.textContent = "";
      } else {
        thumb.style.backgroundImage = "";
        thumb.textContent = "🙂";
      }
      chip.classList.toggle("is-on", on);
      chip.querySelector(".tf-label").textContent = data ? "내 얼굴로 플레이" : "내 얼굴 캐릭터 만들기";
      chip.querySelector(".tf-state").textContent = on ? "ON" : "OFF";
    });
  }

  function mountChip(host, before) {
    if (!host) return null;
    ensureStyle();
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "today-face-chip";
    chip.innerHTML = `<span class="tf-thumb" aria-hidden="true"></span><span class="tf-label"></span><span class="tf-state"></span>`;
    chip.addEventListener("pointerdown", (e) => e.stopPropagation());
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPicker();
    });
    if (before && before.parentNode === host) host.insertBefore(chip, before);
    else host.appendChild(chip);
    chips.add(chip);
    paintChips();
    return chip;
  }

  function autoMount() {
    if (!document.body || document.body.dataset.face !== "1") return;
    const title = document.getElementById("title");
    if (!title || title.querySelector(".today-face-chip")) return;
    mountChip(title, document.getElementById("start-btn"));
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    data = load();
    buildImg();
    emit();
  });

  const api = {
    has: () => Boolean(data),
    active: () => Boolean(data && data.on !== false),
    ready: () => Boolean(api.active() && faceImg),
    // 화면 안 <img> 에만 쓰세요. 서버·공유용으로 보내면 안 돼요.
    dataUrl: () => (api.active() ? data.img : null),
    drawHead,
    drawOnSprite,
    open: openPicker,
    mountChip,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  window.TodayFace = api;

  buildImg();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount);
  else autoMount();
})();
