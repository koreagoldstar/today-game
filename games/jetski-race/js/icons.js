/*
 * 제트스키 썬더 레이스 · UI 아이콘 (SVG — 이모지 대신)
 * 모두 24x24 보기 상자, currentColor 로 색을 받는다. 굵고 둥근 캐주얼 게임 선.
 */
const S = (body, extra = "") => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  bolt: S('<path d="M13.5 2 5 13.2h5.6L9.4 22 19 9.8h-5.7z" fill="currentColor" stroke="rgba(0,0,0,.25)" stroke-width="1" stroke-linejoin="round"/>'),
  flag: S('<path d="M5 21V3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 3.5h12.5l-2.6 4 2.6 4H6z" fill="currentColor"/><path d="M8.5 3.5v8M11.6 3.5v8M14.7 3.5v8" stroke="rgba(255,255,255,.55)" stroke-width="1.6"/>'),
  trophy: S('<path d="M7 3h10v5.5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H3.8a3.4 3.4 0 0 0 4 4.6M17 5h3.2a3.4 3.4 0 0 1-4 4.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.4 13.6h3.2l.6 3.6H9.8z" fill="currentColor"/><rect x="7" y="17.6" width="10" height="3.4" rx="1.4" fill="currentColor"/>'),
  medal: S('<path d="M7 2h4l2 6H9zM13 2h4l-2 6h-4z" fill="currentColor" opacity=".7"/><circle cx="12" cy="15" r="6.4" fill="currentColor"/><circle cx="12" cy="15" r="4" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6"/>'),
  watch: S('<circle cx="12" cy="13.5" r="7.6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 13.5V9.2M12 13.5l3 2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><rect x="9.6" y="2" width="4.8" height="2.6" rx="1" fill="currentColor"/>'),
  play: S('<path d="M8 4.8v14.4L19.4 12z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'),
  retry: S('<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M19.6 3.6v4.8h-4.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  next: S('<path d="M5 12h12M12.5 6.5 18 12l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  back: S('<path d="M19 12H7M11.5 6.5 6 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  grid: S('<rect x="3.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="3.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/><rect x="13.5" y="13.5" width="7" height="7" rx="2" fill="currentColor"/>'),
  help: S('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M9.4 9.4a2.7 2.7 0 1 1 3.6 2.5c-.8.4-1 .9-1 1.9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.4" fill="currentColor"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="10.5" rx="2.6" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="15.4" r="1.6" fill="rgba(0,0,0,.35)"/>'),
  star: S('<path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" fill="currentColor" stroke="rgba(0,0,0,.2)" stroke-width="1" stroke-linejoin="round"/>'),
  pause: S('<rect x="6" y="4.5" width="4.2" height="15" rx="1.6" fill="currentColor"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.6" fill="currentColor"/>'),
  sound: S('<path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z" fill="currentColor"/><path d="M15.6 8.6a5 5 0 0 1 0 6.8M18.2 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  mute: S('<path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z" fill="currentColor"/><path d="m16 9.4 5 5.2M21 9.4l-5 5.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'),
  music: S('<path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.6" cy="18" r="2.6" fill="currentColor"/><circle cx="16.6" cy="16" r="2.6" fill="currentColor"/>'),
  vibrate: S('<rect x="8" y="3.5" width="8" height="17" rx="2.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4.4 8v8M19.6 8v8M2 10v4M22 10v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  close: S('<path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>'),
  wave: S('<path d="M2 15c2.5 0 2.5-2.4 5-2.4s2.5 2.4 5 2.4 2.5-2.4 5-2.4 2.5 2.4 5 2.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M2 19.5c2.5 0 2.5-2.4 5-2.4s2.5 2.4 5 2.4 2.5-2.4 5-2.4 2.5 2.4 5 2.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity=".55"/><path d="M8 10.5c1-4 5-6.5 9-5.5-2 .8-3.2 2.4-3.4 4.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  jetski: S('<path d="M2.5 15.6h15.6c1.6 0 3-.9 3.6-2.4l.3-.8H15l-2.4-2.6H8.4l1.4 2.6H4.6z" fill="currentColor"/><path d="M8.6 9.8 10.8 6h2.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M2 19c2 0 2-1.6 4-1.6S8 19 10 19s2-1.6 4-1.6 2 1.6 4 1.6 2-1.6 4-1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>'),
  user: S('<circle cx="12" cy="8" r="4.2" fill="currentColor"/><path d="M4 20.5c.8-4 4-6 8-6s7.2 2 8 6z" fill="currentColor"/>'),
  crown: S('<path d="M3 8.5 7.4 12 12 5l4.6 7L21 8.5 19.2 18H4.8z" fill="currentColor" stroke="rgba(0,0,0,.2)" stroke-width="1" stroke-linejoin="round"/><rect x="4.8" y="18.6" width="14.4" height="2.4" rx="1" fill="currentColor"/>'),
  ramp: S('<path d="M3 18h18L8 8.5z" fill="currentColor"/><path d="M14 6.5c2-1.6 4.4-1.8 6.4-.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  fork: S('<path d="M12 21v-6.5M12 14.5 6 8M12 14.5 18 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M4 4.5h5L6 9zM20 4.5h-5l3 4.5z" fill="currentColor"/>'),
  finger: S('<path d="M9 11V4.8a1.8 1.8 0 0 1 3.6 0V10l4.2.8a2.6 2.6 0 0 1 2.1 2.9l-.6 4.4A3.4 3.4 0 0 1 15 21h-3.4a3.6 3.6 0 0 1-2.9-1.5L5.4 15a1.7 1.7 0 0 1 2.6-2.2L9 13.8z" fill="currentColor" stroke="rgba(0,0,0,.25)" stroke-width="1" stroke-linejoin="round"/>'),
};

/** [data-icon="이름"] 요소에 아이콘을 채운다 */
export function paintIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.getAttribute("data-icon");
    if (ICONS[name] && el.dataset.painted !== name) {
      el.innerHTML = ICONS[name];
      el.dataset.painted = name;
    }
  });
}
