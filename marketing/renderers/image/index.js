"use strict";
/*
 * Renderer "image": Source 의 사실(facts)로 인스타 이미지 · 캐러셀 · 스토리 JPEG 를 그린다 (Pretendard, 크롬 스크린샷).
 *  quiz → carousel(1080x1350 여러 장) · ranking → image(1080x1350) · fortune · challenge · recycle → story(1080x1920)
 *  퀴즈 정답은 이미지에 넣지 않고 meta.comment 로 남긴다 (게시 뒤 첫 댓글).
 */
const fs = require("fs");
const path = require("path");
const { launch } = require("../reel/browser");
const { createPainter, FONTS } = require("../reel/overlays");
const T = require("./templates");
const { checkImages } = require("./qc");

const ROOT = path.resolve(__dirname, "../../..");
const KIND = { quiz: "carousel", ranking: "image", fortune: "story", challenge: "story", recycle: "story" };

async function dataUrlOf(url, fetchImpl = fetch) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`커버를 내려받지 못함 (HTTP ${res.status})`);
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
}

/** 각 형식의 그림(html) 목록 · 역할 · 크기 · 메타 */
async function pagesFor(source, ctx) {
  const f = source.facts;
  switch (source.sourceType) {
    case "quiz":
      return {
        pages: T.quizSlides(f).map((html) => ({ html, role: "slide", size: T.FEED })),
        meta: { comment: `정답 ✅\n${f.questions.map((x, i) => `Q${i + 1}. ${x.c + 1}번 ${x.answer}`).join("\n")}\n\n더 많은 문제는 오늘의 게임 상식퀴즈에서!` },
      };
    case "ranking":
      return { pages: [{ html: T.rankingImage(f), role: "image", size: T.FEED }], meta: {} };
    case "fortune":
      return { pages: [{ html: T.fortuneStory(f), role: "image", size: T.STORY }], meta: {} };
    case "challenge":
      return { pages: [{ html: T.challengeStory(f), role: "image", size: T.STORY }], meta: {} };
    case "recycle":
      return { pages: [{ html: T.recycleStory(f, await dataUrlOf(f.coverUrl, ctx.fetchImpl)), role: "image", size: T.STORY }], meta: { feedId: f.feedId } };
    default:
      throw new Error(`이미지로 그릴 수 없는 종류: ${source.sourceType}`);
  }
}

module.exports = {
  kinds: ["image", "carousel", "story"],
  KIND,

  async render(source, _template, ctx) {
    const { doc } = ctx;
    const { pages, meta } = await pagesFor(source, ctx);
    const dir = path.join(ROOT, "marketing", "out", "images", `${doc.id}-v${doc.version}-r${doc.redoCount || 0}`);
    fs.mkdirSync(dir, { recursive: true });
    const browser = await launch({ render: "cpu", scale: 1 });
    let painter;
    try {
      painter = await createPainter(browser);
      const files = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const file = await painter.jpg(p.html, path.join(dir, `${p.role}-${String(i + 1).padStart(2, "0")}.jpg`), p.size);
        files.push({ role: p.role, path: file, contentType: "image/jpeg", w: p.size.w, h: p.size.h });
      }
      return {
        kind: KIND[source.sourceType],
        files,
        meta: { title: source.facts.title, sourceType: source.sourceType, fonts: FONTS, audio: [], textOverflow: [...painter.overflow], ...meta },
      };
    } finally {
      if (painter) await painter.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  },

  qc: (render) => checkImages(render),
};
