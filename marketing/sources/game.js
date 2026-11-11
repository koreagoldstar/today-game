"use strict";
/*
 * Source "game": 사이트의 실제 게임 정보 — 홈 카탈로그(js/main.js 의 GAMES) + 설명(scripts/game-seo-data.js).
 * facts 만 문구 근거로 쓴다. 하드코딩한 게임 목록 없음.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

function readCatalog(root = ROOT) {
  const src = fs.readFileSync(path.join(root, "js/main.js"), "utf8");
  const m = src.match(/const GAMES = (\[[\s\S]*?\n  \]);/);
  if (!m) throw new Error("js/main.js 에서 GAMES 배열을 찾지 못했습니다.");
  // 카탈로그는 순수 데이터 리터럴 (tools/game-reels/lib/discover.js 와 같은 방식)
  return Function(`"use strict"; return (${m[1]});`)();
}

function readSeo(root = ROOT) {
  const file = path.join(root, "scripts/game-seo-data.js");
  delete require.cache[require.resolve(file)];
  return require(file);
}

/** 게임 하나의 사실 정보 */
function gameFacts(id, root = ROOT) {
  const g = readCatalog(root).find((x) => x.id === id);
  if (!g) throw new Error(`사이트 카탈로그에 없는 게임: ${id}`);
  if (g.category === "archive" || !/^\/games\/[\w-]+\/$/.test(g.href)) throw new Error(`홍보 대상이 아닌 게임(외부 고전 등): ${id}`);
  const seo = readSeo(root).find((x) => x.id === id) || {};
  return { id, title: g.title, tag: g.tag || "", category: g.category, url: g.href, added: g.added || null, intro: seo.intro || "", how: seo.how || "" };
}

module.exports = {
  readCatalog,
  gameFacts,
  async collect({ plan }) {
    const id = plan.sourceId;
    if (!/^[\w-]+$/.test(String(id || ""))) throw new Error("어떤 게임인지(plan.sourceId)가 없습니다.");
    const facts = gameFacts(id);
    if (!fs.existsSync(path.join(ROOT, "marketing", "profiles", `${id}.json`))) throw new Error(`녹화 프로필이 없는 게임: ${id}`);
    return { sourceType: "game", sourceId: id, facts, assets: { profile: id } };
  },
};
