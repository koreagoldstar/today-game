"use strict";
/*
 * Source "spotlight" (게임 소개 이미지): 아직 인스타에 올리지 않은 게임 하나를 실제 썸네일(포스터) + 사이트 설명으로 소개한다.
 * 어떤 게임인지는 planner(pickSpotlight)가 정한다. 녹화가 필요 없어 매일 만들 수 있다.
 */
const { gameFacts } = require("./game");
const { thumbOf } = require("./new-game");

const DAY = 86400000;

module.exports = {
  async collect({ plan, now = () => Date.now() }) {
    const id = plan && plan.sourceId;
    if (!/^[\w-]+$/.test(String(id || ""))) throw new Error("어떤 게임인지(plan.sourceId)가 없습니다.");
    const thumb = thumbOf(id);
    if (!thumb) throw Object.assign(new Error(`${id}: 썸네일이 없어 게임 소개 이미지를 만들 수 없습니다.`), { code: "NO_DATA" });
    const f = gameFacts(id);
    const t = typeof now === "function" ? now() : now;
    return { sourceType: "spotlight", sourceId: id, facts: { ...f, isNew: !!f.added && t - Date.parse(f.added) <= 30 * DAY }, assets: { thumb } };
  },
};
