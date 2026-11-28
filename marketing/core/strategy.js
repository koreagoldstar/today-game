"use strict";
/*
 * 콘텐츠 유형 (성장 최적화 3장): 도전형 · 실패/반전형 · 기록 경쟁형 · 게임 발견형.
 * 만든 결과물에서 실제로 보이는 것만 근거로 정한다 (지어내지 않음). 승인 대기로 넘어갈 때 doc.strategy 에 남겨
 * 나중에 유형별 성과를 비교한다. 비율(40/25/25/10)로 편성하는 것은 다음 단계.
 */
const TYPES = {
  challenge: "도전형",
  fail: "실패·반전형",
  record: "기록 경쟁형",
  discover: "게임 발견형",
};
const RECORD_WORDS = /기록|몇\s*(ms|타|점|초|단계)|타수|점수|랭킹|TOP/i;

/** @returns {{ type, label, hook, durationSec, reason }} */
function classify(doc) {
  const st = doc.source && doc.source.sourceType;
  const meta = (doc.render && doc.render.meta) || {};
  const hook = meta.hook || (doc.copy && doc.copy.instagram && String(doc.copy.instagram.caption || "").split("\n")[0]) || "";
  const pick = (type, reason) => ({ type, label: TYPES[type], hook, durationSec: meta.durationSec || null, reason });
  if (st === "spotlight" || st === "new-game" || st === "fortune") return pick("discover", "아직 안 해 본 게임 · 사이트 기능 소개");
  if (st === "quiz") return pick("challenge", "몇 개 맞힐 수 있는지 도전");
  if (st === "ranking" || st === "challenge") return pick("record", "실제 기록 · 순위로 겨루기");
  if (st === "game") {
    const caps = meta.captions || [];
    if (caps.some((c) => c.type === "fail")) return pick("fail", `영상 속 실패 장면 (${caps.filter((c) => c.type === "fail").map((c) => c.text).join(", ")})`);
    if (RECORD_WORDS.test(hook)) return pick("record", `첫 문구가 기록을 겨룸 ("${hook}")`);
    return pick("challenge", `첫 문구가 도전을 권함 ("${hook}")`);
  }
  return pick("discover", "기타");
}

module.exports = { classify, TYPES };
