"use strict";
/* PHASE 4 — 문구: 사실만 · 틀 문구 규칙 · AI 결과 검사(지어낸 숫자/주장 거부) · 같은 입력은 다시 부르지 않음 · 실패하면 틀 문구 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { createCopywriter, templateCopy, factProblems, checkAi } = require("../copy/copywriter");
const { createFakeUpstash } = require("../core/memory-redis");
const { createStore } = require("../core/store");
const { gameFacts } = require("../sources/game");

const facts = gameFacts("reaction");
const source = { sourceType: "game", sourceId: "reaction", facts };
const render = { kind: "reel", meta: { hook: "초록불에 바로 탭!" } };
const CH = ["instagram", "threads", "facebook", "youtube"];

test("게임 사실 정보는 사이트 카탈로그 · 설명에서", () => {
  assert.equal(facts.title, "번쩍 반응");
  assert.equal(facts.url, "/games/reaction/");
  assert.ok(facts.intro.length > 10);
  assert.throws(() => gameFacts("donkey-kong"), /홍보 대상이 아닌/);
  assert.throws(() => gameFacts("no-such-game"), /카탈로그에 없는/);
});

test("틀 문구: 채널별 형식 · 인스타 규칙 통과 · 최근 첫 문장 피함", () => {
  const out = templateCopy({ source, render, channels: CH, recent: [] });
  assert.deepEqual(checkAi(out, { source, channels: CH, recent: [] }), []);
  assert.equal(out.instagram.caption.split("\n")[0], "초록불에 바로 탭! 🎮");
  assert.match(out.instagram.caption, /프로필 링크에서 플레이/);
  assert.ok(!/https?:/.test(out.instagram.caption), "인스타 캡션에 주소 없음");
  assert.ok(out.instagram.hashtags.includes("#오늘의게임") && out.instagram.hashtags.length >= 5 && out.instagram.hashtags.length <= 10);
  assert.match(out.facebook.caption, /utm_source=facebook/);
  assert.match(out.instagram.link, /utm_source=instagram&utm_medium=organic&utm_campaign=todaygame_reel&utm_content=reaction/);
  assert.ok(out.youtube.title.length <= 100);
  const again = templateCopy({ source, render, channels: ["instagram"], recent: ["초록불에 바로 탭! 🎮"] });
  assert.notEqual(again.instagram.caption.split("\n")[0], "초록불에 바로 탭! 🎮");
});

test("사실 검사: 원본에 없는 숫자 · 순위 주장 잡아냄", () => {
  assert.deepEqual(factProblems("번쩍 반응 해 보세요", facts), []);
  assert.ok(factProblems("벌써 10만 명이 플레이!", facts).length >= 1);
  assert.ok(factProblems("인기 1위 게임", facts).some((x) => /주장|숫자/.test(x)));
});

function stubClient(replies) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (req) => {
          calls.push(req);
          const r = replies.shift();
          if (r instanceof Error) throw r;
          return r;
        },
      },
    },
  };
}
const reply = (obj, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "text", text: JSON.stringify(obj) }] });
const goodAi = {
  instagram: { caption: "신호가 뜨면 바로 탭! ⚡\n반응 속도를 재는 게임이에요.\n친구랑 겨뤄 보세요.\n프로필 링크에서 플레이!", hashtags: ["#오늘의게임", "#무료게임", "#반응속도", "#미니게임", "#웹게임"] },
};

test("AI 문구: 규칙에 맞으면 쓰고, 같은 입력은 저장된 결과로 (두 번 부르지 않음)", async () => {
  const mem = createFakeUpstash({ jitter: false });
  const store = createStore({ url: mem.url, token: mem.token, fetchImpl: mem.fetchImpl });
  const client = stubClient([reply(goodAi)]);
  const cw = createCopywriter({ store, client, env: {} });
  const a = await cw.write({ source, render, channels: ["instagram"], recent: [] });
  assert.equal(a.instagram.source, "ai");
  assert.match(a.instagram.link, /utm_source=instagram/);
  const req = client.calls[0];
  assert.equal(req.model, "claude-opus-5-5");
  assert.equal(req.fallbacks, "default");
  assert.equal(req.output_config.format.type, "json_schema");
  assert.match(req.messages[0].content, /번쩍 반응/);
  const b = await cw.write({ source, render, channels: ["instagram"], recent: [] });
  assert.equal(b.instagram.source, "ai-cache");
  assert.equal(client.calls.length, 1);
});

test("AI 문구가 숫자를 지어내거나 · 거절하거나 · 오류면 틀 문구로", async () => {
  const invented = { instagram: { ...goodAi.instagram, caption: "벌써 10만 명이 즐긴 게임!\n프로필 링크에서 플레이!" } };
  for (const r of [reply(invented), reply({}, "refusal"), new Error("network down"), { stop_reason: "end_turn", content: [{ type: "text", text: "{not json" }] }]) {
    const cw = createCopywriter({ client: stubClient([r]), env: {} });
    const out = await cw.write({ source, render, channels: ["instagram"], recent: [] });
    assert.equal(out.instagram.source, "template");
    assert.ok(out.instagram.note.length > 0);
  }
});

test("AI 열쇠가 없으면 부르지 않고 틀 문구", async () => {
  const cw = createCopywriter({ env: {} });
  assert.equal(cw.model, null);
  const out = await cw.write({ source, render, channels: ["instagram"], recent: [] });
  assert.equal(out.instagram.source, "template");
});
