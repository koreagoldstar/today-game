"use strict";
/*
 * 콘텐츠 상태 머신 — 허용 표에 없는 전환은 거부한다.
 *   PLANNED → COLLECTING → RENDERING → COPYWRITING → QC → READY_FOR_APPROVAL → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED
 *   끝 · 예외: REJECTED · FAILED · CANCELLED · EXPIRED(승인 대기 72시간 초과)
 * 채널별 게시 상태는 doc.posts[채널].status 에 따로 (PENDING → PUBLISHING → PUBLISHED | FAILED).
 */

const STATES = [
  "PLANNED", "COLLECTING", "RENDERING", "COPYWRITING", "QC",
  "READY_FOR_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED",
  "REJECTED", "FAILED", "CANCELLED", "EXPIRED",
];
const MAKING = ["PLANNED", "COLLECTING", "RENDERING", "COPYWRITING", "QC"];
const TERMINAL = ["PUBLISHED", "REJECTED", "FAILED", "CANCELLED", "EXPIRED"];
const NEXT = {
  PLANNED: ["COLLECTING"],
  COLLECTING: ["RENDERING"],
  RENDERING: ["COPYWRITING"],
  COPYWRITING: ["QC"],
  QC: ["READY_FOR_APPROVAL", "RENDERING"], // RENDERING: 검수 불합격 뒤 다시 만들기
  READY_FOR_APPROVAL: ["APPROVED", "REJECTED", "EXPIRED", "COPYWRITING", "RENDERING"], // 문구 다시 만들기 · 다시 제작
  APPROVED: ["SCHEDULED", "READY_FOR_APPROVAL"], // READY: 바뀌어서 승인 무효
  SCHEDULED: ["PUBLISHING", "READY_FOR_APPROVAL"],
  PUBLISHING: ["PUBLISHED", "SCHEDULED", "FAILED"], // SCHEDULED: 일부 채널 재시도 대기
};

const KO = {
  PLANNED: "편성됨", COLLECTING: "자료 모으는 중", RENDERING: "만드는 중", COPYWRITING: "문구 쓰는 중", QC: "검수 중",
  READY_FOR_APPROVAL: "승인 대기", APPROVED: "승인됨", SCHEDULED: "게시 예약", PUBLISHING: "게시 중", PUBLISHED: "게시 완료",
  REJECTED: "반려", FAILED: "실패", CANCELLED: "취소", EXPIRED: "기한 지남",
};

class TransitionError extends Error {
  constructor(from, to) {
    super(`${KO[from] || from} 상태에서는 ${KO[to] || to}(으)로 바꿀 수 없습니다.`);
    this.code = "BAD_TRANSITION";
    this.from = from;
    this.to = to;
  }
}

function canTransition(from, to) {
  if (!STATES.includes(to)) return false;
  if (to === "FAILED") return MAKING.includes(from) || from === "PUBLISHING";
  // 게시 중에는 이미 플랫폼에 보냈을 수 있어 취소하지 않는다
  if (to === "CANCELLED") return !TERMINAL.includes(from) && from !== "PUBLISHING";
  return (NEXT[from] || []).includes(to);
}

function transition(doc, to, { by = "system", note = "", now = Date.now() } = {}) {
  if (!canTransition(doc.status, to)) throw new TransitionError(doc.status, to);
  const at = new Date(now).toISOString();
  doc.history = (doc.history || []).concat({ from: doc.status, to, at, by, note }).slice(-100);
  doc.status = to;
  doc.updatedAt = at;
  if (to === "READY_FOR_APPROVAL") doc.readyAt = at; // 72시간 만료는 여기서부터
  return doc;
}

const approvalValid = (doc) => !!(doc.approval && doc.approval.version === doc.version);

/** 문구 · 파일 · 채널 · 게시 시각이 바뀜 → 버전 +1, 승인 무효, 승인된 상태였으면 승인 대기로 */
function invalidate(doc, { by = "system", note = "변경", now = Date.now() } = {}) {
  doc.version = (doc.version || 1) + 1;
  doc.approval = null;
  if (doc.status === "APPROVED" || doc.status === "SCHEDULED") {
    transition(doc, "READY_FOR_APPROVAL", { by, note: `${note} — 승인 무효, 다시 승인 필요`, now });
  } else {
    doc.history = (doc.history || []).concat({ from: doc.status, to: doc.status, at: new Date(now).toISOString(), by, note }).slice(-100);
  }
  return doc;
}

function isExpired(doc, now = Date.now(), hours = 72) {
  return doc.status === "READY_FOR_APPROVAL" && !!doc.readyAt && now - Date.parse(doc.readyAt) > hours * 3600 * 1000;
}

module.exports = { STATES, MAKING, TERMINAL, NEXT, KO, TransitionError, canTransition, transition, approvalValid, invalidate, isExpired };
