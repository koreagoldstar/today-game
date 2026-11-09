"use strict";
/*
 * Source "new-game" (C4 신작 출시): 사이트 카탈로그(js/main.js GAMES) 중 games/ 폴더가 있는 홍보 대상 게임을
 * 지난번에 저장한 목록(todaygame:mkt:seen:games)과 비교해 새로 생긴 id 를 찾는다.
 *  - 처음 실행: 지금 목록을 기준으로 저장만 하고 아무것도 만들지 않는다 (기존 게임 전부가 신작으로 잡히지 않게).
 *  - 이미 알린 신작(승인 대기 이후 · 반려 · 기한 지남)은 다시 알리지 않고 기준 목록으로 옮긴다. 제작 실패 · 취소는 다시 시도.
 *  - 녹화 프로필이 있으면 릴스, 없으면 실제 썸네일 + 사이트 설명으로 이미지 게시물 (planner 가 고른다).
 */
const fs = require("fs");
const path = require("path");
const { readCatalog, gameFacts } = require("./game");

const ROOT = path.resolve(__dirname, "../..");
const ANNOUNCED = ["READY_FOR_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED", "REJECTED", "EXPIRED"];

/** 홍보할 수 있는 게임 id (외부 고전 · 보관 게임 제외, 실제 폴더가 있는 것만) */
function promotable(root = ROOT) {
  return readCatalog(root)
    .filter((g) => g.category !== "archive" && /^\/games\/[\w-]+\/$/.test(g.href) && fs.existsSync(path.join(root, g.href)))
    .map((g) => g.id);
}

/** 게임 썸네일: 원본(assets/thumbs/{id}.png|svg) → 카탈로그의 작은 그림 순서 */
function thumbOf(id, root = ROOT) {
  const g = readCatalog(root).find((x) => x.id === id) || {};
  const list = [`assets/thumbs/${id}.png`, `assets/thumbs/${id}.svg`, String(g.thumb || "").replace(/^\//, "").replace(/\?.*$/, "")];
  const hit = list.find((p) => p && fs.existsSync(path.join(root, p)));
  return hit ? path.join(root, hit) : null;
}

async function detect({ store, root = ROOT }) {
  const ids = promotable(root);
  const base = (await store.run("SMEMBERS", "seen:games")) || [];
  if (!base.length) {
    await store.run("SADD", "seen:games", ...ids);
    return { initialized: true, fresh: [], total: ids.length };
  }
  const announced = new Set((await store.listContents(200)).filter((d) => d.source && d.source.sourceType === "new-game" && ANNOUNCED.includes(d.status)).map((d) => d.source.facts.id));
  const settle = [...announced].filter((id) => !base.includes(id));
  if (settle.length) await store.run("SADD", "seen:games", ...settle);
  return { initialized: false, fresh: ids.filter((id) => !base.includes(id) && !announced.has(id)), total: ids.length };
}

module.exports = {
  promotable,
  thumbOf,
  detect,
  async collect({ store, plan, root = ROOT }) {
    const id = plan && plan.sourceId;
    const { fresh } = await detect({ store, root });
    if (!fresh.includes(id)) throw Object.assign(new Error(`${id} 는 새로 감지된 게임이 아니거나 이미 알렸습니다.`), { code: "NO_DATA" });
    const facts = { ...gameFacts(id, root), isNew: true };
    return { sourceType: "new-game", sourceId: id, facts, assets: { thumb: thumbOf(id, root) } };
  },
};
