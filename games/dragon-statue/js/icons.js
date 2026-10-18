/*
 * 드래곤 석상 대작전 · 아이콘 (SVG, 이모지 대신)
 * <span data-icon="이름"></span> 에 paintIcons(root) 로 채운다.
 */
const S = (body, vb = "0 0 24 24") => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const INK = "#3a2412";

export const ICONS = {
  heart: S(`<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.3a4.4 4.4 0 018 2.6c0 5.7-8 10.6-8 10.6z" fill="#ff5a7a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="8.4" cy="10" rx="1.6" ry="1.1" fill="#fff" opacity=".8"/>`),
  heartEmpty: S(`<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.3a4.4 4.4 0 018 2.6c0 5.7-8 10.6-8 10.6z" fill="rgba(255,255,255,.25)" stroke="rgba(58,36,18,.55)" stroke-width="1.6" stroke-linejoin="round" stroke-dasharray="2.4 2"/>`),
  star: S(`<path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z" fill="#ffd23f" stroke="#8a5a00" stroke-width="1.6" stroke-linejoin="round"/>`),
  starEmpty: S(`<path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z" fill="rgba(255,255,255,.3)" stroke="rgba(138,90,0,.6)" stroke-width="1.6" stroke-linejoin="round"/>`),
  pause: S('<rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#fff"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#fff"/>'),
  play: S('<path d="M8 5l11 7-11 7z" fill="currentColor"/>'),
  sound: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff"/><path d="M15 8.5a5 5 0 010 7M17.6 6a8.6 8.6 0 010 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  mute: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'),
  settings: S('<circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.8v3M12 18.2v3M21.2 12h-3M5.8 12h-3M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1M18.5 18.5l-2.1-2.1M7.6 7.6L5.5 5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  back: S('<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  next: S('<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  retry: S('<path d="M5 12a7 7 0 107-7H9" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M10.5 2.5L7.5 5l3 2.6" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  home: S('<path d="M3.5 11.5L12 4l8.5 7.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9.5h4.5v-5h3v5H18V10" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linejoin="round"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  hint: S(`<circle cx="10.5" cy="10.5" r="6" fill="#dff6ff" stroke="${INK}" stroke-width="2"/><path d="M15 15l5 5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M8 9.5a3 3 0 012.5-2.5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>`),
  calendar: S(`<rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="#fff" stroke="${INK}" stroke-width="1.6"/><rect x="3.5" y="5" width="17" height="5" rx="2.4" fill="#ff7a5a" stroke="${INK}" stroke-width="1.6"/><path d="M8 3v4M16 3v4" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M12 12.2l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z" fill="#ffd23f" stroke="#8a5a00" stroke-width="1"/>`),
  book: S(`<path d="M4 5.5A2.5 2.5 0 016.5 3H19v15H6.5A2.5 2.5 0 004 20.5z" fill="#8ad86a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 20.5A2.5 2.5 0 016.5 18H19v3H6.5A2.5 2.5 0 014 20.5z" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="12" cy="10" r="3.2" fill="#ffd23f"/><circle cx="11" cy="9.4" r=".9" fill="${INK}"/>`),
  bat: S(`<path d="M5 20.5l1.6-1.6" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M6.4 19.2L16.6 6.4a2.6 2.6 0 014 3.3L8.6 20.7z" fill="#e0a868" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M5.6 20l1.4-1.6" stroke="#d8463a" stroke-width="2.4" stroke-linecap="round"/>`),
  paw: S(`<ellipse cx="12" cy="15.5" rx="4.6" ry="3.8" fill="#ffb87a" stroke="${INK}" stroke-width="1.6"/><circle cx="6.5" cy="10.5" r="2" fill="#ffb87a" stroke="${INK}" stroke-width="1.4"/><circle cx="10" cy="7" r="2" fill="#ffb87a" stroke="${INK}" stroke-width="1.4"/><circle cx="14" cy="7" r="2" fill="#ffb87a" stroke="${INK}" stroke-width="1.4"/><circle cx="17.5" cy="10.5" r="2" fill="#ffb87a" stroke="${INK}" stroke-width="1.4"/>`),
  dragon: S(`<path d="M5 15c0-5 3-8.5 7-8.5s7 3.5 7 8.5c0 2.6-3 4.5-7 4.5S5 17.6 5 15z" fill="#8ad86a" stroke="${INK}" stroke-width="1.6"/><path d="M8 7.5L7 3.5l3 2.8M16 7.5l1-4-3 2.8" fill="#ffd23f" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="9.5" cy="12.5" r="1.4" fill="${INK}"/><circle cx="14.5" cy="12.5" r="1.4" fill="${INK}"/><circle cx="9.1" cy="12" r=".45" fill="#fff"/><circle cx="14.1" cy="12" r=".45" fill="#fff"/><path d="M10.5 15.8q1.5 1 3 0" stroke="${INK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`),
  trophy: S(`<path d="M7 4h10v5a5 5 0 01-10 0z" fill="#ffd23f" stroke="${INK}" stroke-width="1.6"/><path d="M7 6H4.5v1.5A3 3 0 007.6 10.5M17 6h2.5v1.5a3 3 0 01-3.1 3" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M12 14v3.5M8.5 20.5h7l-.8-3h-5.4z" fill="#ffb03a" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`),
  lock: S(`<rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="#ffd23f" stroke="${INK}" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="12" cy="15.5" r="1.6" fill="${INK}"/>`),
  crown: S(`<path d="M4 18l1.5-10 4.5 5 2-7 2 7 4.5-5L20 18z" fill="#ffd23f" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="15" r="1.4" fill="#ff5a7a"/>`),
  bolt: S(`<path d="M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z" fill="#ffd23f" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`),
  map: S(`<path d="M3 6.5l5.5-2.5 7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z" fill="#fff6c0" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" stroke="${INK}" stroke-width="1.5"/><path d="M11 10.5l1.6 1.6M12.6 10.5L11 12.1" stroke="#ff4a3a" stroke-width="1.7" stroke-linecap="round"/>`),
  timer: S(`<circle cx="12" cy="13" r="7.5" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M12 13V8.5M12 13l3 2" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M10 2.8h4" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`),
};

export function paintIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const k = el.getAttribute("data-icon");
    if (el.dataset.painted === k) return;
    if (ICONS[k]) {
      el.innerHTML = ICONS[k];
      el.dataset.painted = k;
    }
  });
}
