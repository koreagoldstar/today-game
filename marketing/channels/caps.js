"use strict";
/*
 * 채널별 규격 · 한도 — 2026-11-08 공식 문서로 확인한 값 (docs/API_RESEARCH.md). 실제 어댑터와 Mock 이 같이 쓴다.
 * 값이 문서와 달라지면 여기만 고친다.
 */

const CAPS = {
  instagram: {
    kinds: ["reel", "image", "carousel", "story"],
    caption: { maxChars: 2200, maxHashtags: 30 },
    video: { minSec: 3, maxSec: 900, maxBytes: 300 * 1024 * 1024, codecs: ["h264", "hevc"], audio: "aac", fps: [23, 60] },
    image: { formats: ["jpeg"], maxBytes: 8 * 1024 * 1024 },
    carousel: { maxItems: 20 },
    dailyLimit: 100, // 24시간 이동 창 (문서 안에서 50 이라고도 적혀 있어 실제 남은 수는 API 로 확인)
  },
  threads: {
    kinds: ["text", "image", "reel", "carousel"],
    caption: { maxChars: 500, maxHashtags: 1 }, // 글자 수 · 태그 수는 미확인 — PHASE 8 에서 문서 확인
    video: { minSec: 0, maxSec: 300, maxBytes: 1024 * 1024 * 1024, codecs: ["h264", "hevc"], audio: "aac", fps: [23, 60] },
    image: { formats: ["jpeg", "png"], maxBytes: 8 * 1024 * 1024 },
    carousel: { maxItems: 20 },
    dailyLimit: 250,
  },
  facebook: {
    kinds: ["reel"],
    caption: { maxChars: 2200, maxHashtags: 30 }, // 미확인
    video: { minSec: 3, maxSec: 90, maxBytes: 300 * 1024 * 1024, codecs: ["h264"], audio: "aac", fps: [24, 60] },
    dailyLimit: 30,
  },
  youtube: {
    kinds: ["reel"],
    caption: { maxChars: 5000, maxHashtags: 15 }, // 미확인
    video: { minSec: 1, maxSec: 180, maxBytes: 256 * 1024 * 1024 * 1024, codecs: ["h264"], audio: "aac", fps: [24, 60] },
    dailyLimit: 100,
  },
};

module.exports = { CAPS };
