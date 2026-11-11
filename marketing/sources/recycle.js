"use strict";
/*
 * Source "recycle" (C7 스토리 재활용): 최근 48시간 안에 게시된 피드의 실제 커버로 아침 스토리를 만든다 ("새 영상 · 새 게시물").
 * 스티커 · 투표 같은 API 미지원 기능은 쓰지 않는다. 재활용할 피드가 없으면 만들지 않는다 (NO_DATA → 다음 유형).
 */
const DAY = 86400000;
/** 그 피드가 실제로 게시된 마지막 시각 (채널별 publishedAt 중 가장 늦은 것) */
const lastPublished = (d) => Math.max(0, ...Object.values(d.posts || {}).map((p) => Date.parse((p && p.publishedAt) || "") || 0));

module.exports = {
  async collect({ store, now = () => Date.now() }) {
    const t = typeof now === "function" ? now() : now;
    const list = await store.listContents(60);
    const done = new Set(list.filter((d) => d.source && d.source.sourceType === "recycle" && !["FAILED", "CANCELLED"].includes(d.status)).map((d) => d.source.facts.feedId));
    const feed = list.find((d) => d.slot === "feed" && d.status === "PUBLISHED" && d.render && !done.has(d.id) && t - lastPublished(d) <= 2 * DAY);
    const cover = feed && feed.render.files.find((f) => f.role === "cover" || f.role === "image" || f.role === "slide");
    if (!feed || !cover || !cover.url) throw Object.assign(new Error("최근 48시간 안에 게시된 피드가 없어 스토리 재활용을 하지 않습니다."), { code: "NO_DATA" });
    return {
      sourceType: "recycle",
      sourceId: `recycle-${feed.id}`,
      facts: { title: feed.render.meta.title, kind: feed.render.kind, url: (feed.source && feed.source.facts && feed.source.facts.url) || "/", feedId: feed.id, coverUrl: cover.url },
      assets: {},
    };
  },
};
