"use strict";
/*
 * Source "challenge" (C6 오늘의 챌린지): 운영 사이트 /api/challenge 를 **읽기 전용 GET** — 오늘의 실제 챌린지 게임.
 * 참여 수 · 1위 기록은 있을 때만 사실로 쓴다 (없으면 넣지 않음).
 */
const { readCatalog } = require("./game");

const SITE = "https://www.todaygame.co.kr";

module.exports = {
  async collect({ fetchImpl = fetch }) {
    const res = await fetchImpl(`${SITE}/api/challenge`, { headers: { accept: "application/json" } });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || !j.game || !j.game.id) throw Object.assign(new Error("오늘의 챌린지를 읽지 못했습니다."), { code: "NO_DATA" });
    const g = readCatalog().find((x) => x.id === j.game.id) || {};
    const facts = { title: "오늘의 챌린지", day: j.day, game: j.game.title || g.title, gameId: j.game.id, url: j.game.href || g.href, tag: g.tag || "" };
    if (Number(j.participants) > 0) facts.participants = Number(j.participants);
    return { sourceType: "challenge", sourceId: `challenge-${j.day}`, facts, assets: {} };
  },
};
