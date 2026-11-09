"use strict";
/* 설정 — 편성표 · 게시 시각 · 채널별 하루 상한 · 검수 기준. 저장소 `settings` 에 덮어쓸 값만 둔다. */

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const FEED_TYPES = ["reel", "new-game", "quiz", "ranking"]; // 편성표에 쓸 수 있는 이름 (core/planner.js TYPES)
const STORY_TYPES = ["fortune", "challenge", "recycle"];
const CHANNELS = ["instagram", "threads", "facebook", "youtube"];

const DEFAULTS = {
  // 요일별 피드 편성 (지시서 §8). 데이터가 모자라면 뒤의 유형으로
  schedule: {
    mon: ["ranking", "reel"],
    tue: ["reel"],
    wed: ["quiz"],
    thu: ["reel"],
    fri: ["new-game", "reel"],
    sat: ["reel"],
    sun: ["quiz"],
  },
  story: ["fortune", "challenge", "recycle"], // 매일 아침 스토리 — 날마다 하나씩 돌아가며 (자료가 없으면 다음 것)
  postTimes: { feed: "19:00", story: "08:30" }, // 서울 시각
  dailyCaps: { instagram: { feed: 1, story: 1 }, threads: { feed: 1 }, facebook: { feed: 1 }, youtube: { feed: 1 } },
  channels: ["instagram"], // 기본으로 고르는 채널
  approvalExpiryHours: 72,
  maxPending: 3, // 승인 대기가 이만큼 쌓이면 새로 만들지 않음 (비용 · 혼동 방지)
  repeatDays: 14, // 이 기간 안에 홍보한 게임은 뒤로
  excludeGames: [], // 홍보하지 않을 게임 id (웹 관리자 "게임별 설정")
  publish: { maxAttempts: 3, backoffMinutes: 15 },
  // minMotion: 게임 영역이 움직인 장면 비율 하한 (반응 게임처럼 기다리는 화면이 게임인 경우가 있어 낮게 — 완전히 멈춘 2초는 freezeSec 이 잡는다)
  qc: { maxRedo: 2, reelSec: [15, 20], blackSec: 1, freezeSec: 2, minMotion: 0.2 },
  ranking: { minEntriesPerGame: 5, maskNames: true },
  // 허용 목록 — 관리자가 정한 것만 (지시서 §0). 비어 있으면 음원을 쓰는 결과물은 검수 불합격
  allow: { audio: [], fonts: ["Pretendard"] },
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function merge(base, over) {
  if (!over || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = base && typeof base[k] === "object" && !Array.isArray(base[k]) ? merge(base[k], v) : v;
  return out;
}

/** 값 확인 — 틀리면 사람이 읽을 수 있는 이유로 throw */
function validate(s) {
  const bad = (m) => {
    throw Object.assign(new Error(m), { code: "BAD_SETTINGS" });
  };
  for (const d of DAYS) {
    if (!Array.isArray(s.schedule[d]) || !s.schedule[d].length) bad(`편성표 ${d} 가 비어 있습니다.`);
    for (const t of s.schedule[d]) if (!FEED_TYPES.includes(t)) bad(`편성표 ${d} 의 "${t}" 는 없는 유형입니다 (${FEED_TYPES.join(" · ")}).`);
  }
  if (!Array.isArray(s.story) || !s.story.length || s.story.some((t) => !STORY_TYPES.includes(t))) bad(`스토리 유형은 ${STORY_TYPES.join(" · ")} 중에서 하나 이상입니다.`);
  if (!Array.isArray(s.excludeGames) || s.excludeGames.some((g) => !/^[\w-]{1,60}$/.test(g))) bad("홍보 제외 게임 목록이 올바르지 않습니다.");
  for (const [k, v] of Object.entries(s.postTimes)) if (!HHMM.test(v)) bad(`게시 시각 ${k} 는 HH:MM 형식이어야 합니다.`);
  for (const [ch, caps] of Object.entries(s.dailyCaps)) for (const [slot, n] of Object.entries(caps)) if (!Number.isInteger(n) || n < 0 || n > 10) bad(`${ch} ${slot} 하루 상한은 0~10 입니다.`);
  if (!Array.isArray(s.channels) || !s.channels.length || s.channels.some((c) => !CHANNELS.includes(c))) bad("채널을 하나 이상 골라야 합니다 (instagram · threads · facebook · youtube).");
  if (!(s.approvalExpiryHours >= 1 && s.approvalExpiryHours <= 24 * 14)) bad("승인 기한은 1시간~14일 입니다.");
  if (!(Number.isInteger(s.maxPending) && s.maxPending >= 1 && s.maxPending <= 14)) bad("승인 대기 상한은 1~14 입니다.");
  if (!(Number.isInteger(s.repeatDays) && s.repeatDays >= 0 && s.repeatDays <= 90)) bad("같은 게임 다시 홍보 간격은 0~90일 입니다.");
  if (!(s.qc.maxRedo >= 0 && s.qc.maxRedo <= 2)) bad("다시 만들기는 0~2회 입니다.");
  if (!(s.qc.minMotion >= 0.05 && s.qc.minMotion <= 0.9)) bad("움직임 하한은 0.05~0.9 입니다.");
  if (!(s.qc.reelSec[0] >= 3 && s.qc.reelSec[0] <= s.qc.reelSec[1] && s.qc.reelSec[1] <= 90)) bad("릴스 길이 범위가 올바르지 않습니다.");
  return s;
}

async function loadSettings(store) {
  return validate(merge(DEFAULTS, (store && (await store.getJson("settings"))) || {}));
}

/** 관리자가 바꾼 값만 저장한다 (전체를 저장하면 나중에 기본값을 고쳐도 반영되지 않음) */
async function saveSettings(store, patch) {
  const over = merge((await store.getJson("settings")) || {}, patch);
  const next = validate(merge(DEFAULTS, over));
  await store.setJson("settings", over);
  return next;
}

/** 서울 날짜 · 요일 */
const KST = 9 * 3600 * 1000;
const seoulDay = (t = Date.now()) => new Date(new Date(t).getTime() + KST).toISOString().slice(0, 10);
const seoulWeekday = (t = Date.now()) => DAYS[new Date(new Date(t).getTime() + KST).getUTCDay()];
const atSeoul = (day, hhmm) => new Date(`${day}T${hhmm}:00+09:00`).getTime();

module.exports = { DEFAULTS, DAYS, FEED_TYPES, STORY_TYPES, CHANNELS, merge, validate, loadSettings, saveSettings, seoulDay, seoulWeekday, atSeoul };
