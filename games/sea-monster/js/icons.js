/*
 * 바다괴물 탐험대 · 아이콘 (SVG, 이모지 대신)
 * <span data-icon="이름"></span> 에 paintIcons(root) 로 채운다.
 */
const S = (body, vb = "0 0 24 24") => `<svg viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  tank: S('<rect x="7" y="5" width="10" height="16" rx="5" fill="#dff4ff" stroke="#0b2a4a" stroke-width="1.8"/><rect x="7" y="10" width="10" height="2.6" fill="#ff7a1a"/><rect x="10" y="2" width="4" height="3.4" rx="1" fill="#9aa7bd" stroke="#0b2a4a" stroke-width="1.4"/>'),
  star: S('<path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z" fill="#ffd23f" stroke="#8a5a00" stroke-width="1.6" stroke-linejoin="round"/>'),
  pause: S('<rect x="6" y="5" width="4.2" height="14" rx="1.6" fill="#fff"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6" fill="#fff"/>'),
  sound: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff"/><path d="M15 8.5a5 5 0 010 7M17.6 6a8.6 8.6 0 010 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  mute: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff"/><path d="M15.5 9.5l5 5M20.5 9.5l-5 5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'),
  sonar: S('<circle cx="12" cy="12" r="2.8" fill="#8ff6ff"/><path d="M7 12a5 5 0 015-5M17 12a5 5 0 01-5 5M3.5 12A8.5 8.5 0 0112 3.5M20.5 12a8.5 8.5 0 01-8.5 8.5" stroke="#8ff6ff" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  radar: S('<circle cx="12" cy="12" r="9" fill="#0b3a5c" stroke="#8ff6ff" stroke-width="1.8"/><circle cx="12" cy="12" r="5" fill="none" stroke="#8ff6ff" stroke-width="1.2" opacity=".6"/><path d="M12 12L19 7" stroke="#8ff6ff" stroke-width="2" stroke-linecap="round"/><circle cx="15.5" cy="14.5" r="1.6" fill="#ffd23f"/>'),
  dive: S('<path d="M12 3c-3.3 3.6-5 6.6-5 9a5 5 0 0010 0c0-2.4-1.7-5.4-5-9z" fill="#8ff6ff" stroke="#0b2a4a" stroke-width="1.6"/><circle cx="10" cy="12" r="1.4" fill="#fff"/>'),
  book: S('<path d="M4 5.5A2.5 2.5 0 016.5 3H19v15H6.5A2.5 2.5 0 004 20.5z" fill="#ffd23f" stroke="#0b2a4a" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 20.5A2.5 2.5 0 016.5 18H19v3H6.5A2.5 2.5 0 014 20.5z" fill="#fff" stroke="#0b2a4a" stroke-width="1.6"/><circle cx="12" cy="10" r="3.2" fill="#ff7aa2"/><circle cx="11" cy="9.4" r=".9" fill="#0b2a4a"/>'),
  gear: S('<rect x="8" y="3" width="8" height="18" rx="4" fill="#dff4ff" stroke="#0b2a4a" stroke-width="1.6"/><rect x="8" y="9" width="8" height="2.6" fill="#ff7a1a"/><path d="M4 14h4M16 14h4" stroke="#0b2a4a" stroke-width="2" stroke-linecap="round"/>'),
  gift: S('<rect x="3.5" y="9" width="17" height="11.5" rx="2" fill="#ff7aa2" stroke="#0b2a4a" stroke-width="1.6"/><rect x="2.5" y="6.5" width="19" height="4" rx="1.4" fill="#ffd23f" stroke="#0b2a4a" stroke-width="1.6"/><path d="M12 6.5v14" stroke="#0b2a4a" stroke-width="1.6"/><path d="M12 6.5c-2-3.5-5.5-3-4.5-.6S12 6.5 12 6.5s3.6 1.4 4.6-.9-2.6-2.6-4.6.9z" fill="#ffd23f" stroke="#0b2a4a" stroke-width="1.4"/>'),
  settings: S('<circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 2.8v3M12 18.2v3M21.2 12h-3M5.8 12h-3M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1M18.5 18.5l-2.1-2.1M7.6 7.6L5.5 5.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'),
  back: S('<path d="M15 5l-7 7 7 7" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  next: S('<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  retry: S('<path d="M5 12a7 7 0 107-7H9" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M10.5 2.5L7.5 5l3 2.6" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  map: S('<path d="M3 6l6-2.5 6 2.5 6-2.5v14.5L15 20.5 9 18 3 20.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2"/>'),
  play: S('<path d="M8 5l11 7-11 7z" fill="currentColor"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  move: S('<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/><circle cx="14.5" cy="9.5" r="3.6" fill="#8ff6ff"/>'),
  aim: S('<circle cx="12" cy="12" r="7" fill="none" stroke="#ffb03a" stroke-width="2.2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#ffb03a" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.8" fill="#fff"/>'),
  coin: S('<circle cx="12" cy="12" r="8.5" fill="#ffd23f" stroke="#a06a00" stroke-width="1.8"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff6c0" stroke-width="1.6"/><path d="M12 9v6" stroke="#a06a00" stroke-width="2" stroke-linecap="round"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="#ffd23f" stroke="#0b2a4a" stroke-width="1.6"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="#0b2a4a" stroke-width="2"/><circle cx="12" cy="15.5" r="1.6" fill="#0b2a4a"/>'),
  gun: S('<rect x="3" y="9" width="14" height="6" rx="3" fill="#3fd3ff" stroke="#0b2a4a" stroke-width="1.6"/><rect x="16" y="10" width="5" height="4" rx="1.4" fill="#ff8a2a" stroke="#0b2a4a" stroke-width="1.4"/><rect x="5" y="14" width="4" height="6" rx="1.6" fill="#2a7de1" stroke="#0b2a4a" stroke-width="1.4"/><rect x="6" y="5.5" width="8" height="4" rx="2" fill="#e9fbff" stroke="#0b2a4a" stroke-width="1.4"/>'),
  suit: S('<path d="M7 4h10l3 5-3 2v9H7v-9L4 9z" fill="#2d4f9e" stroke="#0b2a4a" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 4v16" stroke="#ff7a1a" stroke-width="2.4"/>'),
  boss: S('<path d="M4 18l2-10 4 5 2-7 2 7 4-5 2 10z" fill="#ffd23f" stroke="#7a3a00" stroke-width="1.6" stroke-linejoin="round"/>'),
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
