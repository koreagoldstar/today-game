"use strict";
/*
 * Mock 채널 — 실제 채널과 같은 순서(컨테이너 → 게시 → 다시 조회)를 밟되 플랫폼에는 아무것도 보내지 않는다.
 * CHANNEL_MODE_{채널} 이 live 가 아니면 이것이 쓰인다. 결과에는 mock: true.
 *   failWith: 시험용 — { kind, retryable, times } 만큼 실패시킨다
 */
const crypto = require("crypto");
const { CAPS } = require("./caps");

const rid = (p) => `${p}-${crypto.randomBytes(5).toString("hex")}`;

function createMockChannel(name, { caps = CAPS[name], failWith = null } = {}) {
  if (!caps) throw new Error(`채널 규격이 없습니다: ${name}`);
  let failsLeft = failWith ? failWith.times || Infinity : 0;
  const posted = new Map(); // postId → item (이번 실행 안에서 다시 조회용)

  return {
    name,
    mock: true,
    capabilities: () => caps,
    async publish(item, { save } = {}) {
      if (!item || !item.copy || !item.copy.caption) throw Object.assign(new Error("문구가 없습니다."), { kind: "INVALID", retryable: false });
      if (failsLeft > 0) {
        failsLeft--;
        throw Object.assign(new Error(`모의 실패 (${failWith.kind})`), { kind: failWith.kind, retryable: !!failWith.retryable });
      }
      const containerId = rid("mock-container");
      if (save) await save({ containerId });
      const postId = rid("mock-post");
      posted.set(postId, item);
      if (save) await save({ platformId: postId });
      return { postId, mock: true };
    },
    /** 중간에 멈춘 게시 이어가기: 게시 id 가 있으면 이미 올라간 것 */
    async resume(post) {
      return post && post.platformId ? { postId: post.platformId, mock: true } : null;
    },
    async verify(postId) {
      return { ok: String(postId).startsWith("mock-post-"), permalink: null, mock: true };
    },
    async comment(postId, text) {
      if (!posted.has(postId) || !String(text || "").trim()) throw Object.assign(new Error("모의 댓글 실패"), { kind: "INVALID" });
      return { id: rid("mock-comment"), mock: true };
    },
    async insights() {
      return []; // 모의 게시에는 지표가 없다 (지어내지 않음)
    },
    async health() {
      return { ok: true, mode: "mock" };
    },
  };
}

module.exports = { createMockChannel };
