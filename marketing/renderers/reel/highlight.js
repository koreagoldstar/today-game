"use strict";
/*
 * 원본 40~60초에서 가장 재미있는 15~20초를 고른다 (tools/game-reels/lib/highlight.js 에서 가져옴).
 * 점수: 게임 안 사건(점수 · 획득 · 아슬아슬 · 클리어) + 화면 움직임. 첫 문구 · 마지막 엔딩에 가려지는 순간은 덜 쳐준다.
 * 바꾼 점: 프레임 목록 대신 움직임 함수 motion(시작, 끝) → 0~1 을 받는다 (원본 MP4 에서 잰 값).
 */

const HOOK_S = 2.2; // 첫 문구가 떠 있는 시간
const CTA_S = 2.2; // 마지막 엔딩 시간

/** avoid: 같은 게임에서 최근에 쓴 구간 [[시작, 끝]…] — 봇 · 게임이 결정적이라 다시 녹화해도 장면이 같아서, 겹치면 감점 */
function pickHighlight({ events, duration }, motion, { min = 15, max = 20, target = 18, avoid = [] } = {}) {
  const startEv = events.find((e) => e.type === "start");
  const playFrom = startEv ? Math.max(0, startEv.t - 0.3) : 0;
  if (duration - playFrom < min) return null;
  const scored = events.filter((e) => e.weight > 0);
  const len = Math.max(min, Math.min(max, target, duration - playFrom - 0.2));

  let best = null;
  for (let s = playFrom; s + len <= duration - 0.1; s += 0.25) {
    let score = 0;
    for (const e of scored) {
      const r = e.t - s;
      if (r < 0 || r > len) continue;
      const hidden = r < 0.6 || r > len - CTA_S + 0.3;
      score += e.weight * (hidden ? 0.35 : 1);
    }
    // 엔딩 바로 앞에 큰 장면이 있으면 여운이 좋다
    score += scored.filter((e) => e.t - s > len - CTA_S - 2.5 && e.t - s <= len - CTA_S + 0.3).reduce((a, e) => a + e.weight * 0.25, 0);
    const m = motion(s, s + len);
    score += Math.min(1.5, m * 3);
    if (s - playFrom < 1.5) score += 0.3; // 시작하자마자 움직임이 보이게
    for (const [a, b] of avoid) score -= 6 * (Math.max(0, Math.min(b, s + len) - Math.max(a, s)) / len);
    if (!best || score > best.score) best = { start: +s.toFixed(2), end: +(s + len).toFixed(2), score: +score.toFixed(2), motion: +m.toFixed(3) };
  }
  if (!best) return null;
  best.events = scored.filter((e) => e.t >= best.start && e.t <= best.end).map((e) => ({ ...e, rel: +(e.t - best.start).toFixed(2) }));
  return best;
}

/** 중간 자막: 가운데 부분의 큰 사건 1~3개 (서로 2.6초 이상 떨어지게) */
function pickCaptionMoments(hl) {
  const len = hl.end - hl.start;
  const chosen = [];
  for (const e of hl.events.filter((x) => x.rel > HOOK_S + 0.2 && x.rel < len - CTA_S - 0.6 && x.type !== "start").sort((a, b) => b.weight - a.weight)) {
    if (chosen.length >= 3) break;
    if (chosen.every((c) => Math.abs(c.rel - e.rel) >= 2.6)) chosen.push(e);
  }
  return chosen.sort((a, b) => a.rel - b.rel);
}

module.exports = { pickHighlight, pickCaptionMoments, HOOK_S, CTA_S };
