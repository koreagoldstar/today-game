"use strict";
/* PHASE 2 — 부품 단위 시험: 상태 전환 · 저장소 앞머리 · 로그 가림 · 설정 · 채널 모드 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { transition, canTransition, invalidate, isExpired, TransitionError, STATES } = require("../core/state");
const { createStore } = require("../core/store");
const { mask } = require("../core/logger");
const { DEFAULTS, merge, validate } = require("../core/settings");
const { createRegistry } = require("../core/registry");
const { registerChannels } = require("../channels");
const { utmLink } = require("../core/links");
const { createFakeUpstash } = require("./fake-upstash");

const doc = (status) => ({ id: "t-1", status, version: 1, history: [] });

test("정상 순서의 상태 전환은 모두 된다", () => {
  const d = doc("PLANNED");
  for (const s of ["COLLECTING", "RENDERING", "COPYWRITING", "QC", "READY_FOR_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED"]) transition(d, s);
  assert.equal(d.status, "PUBLISHED");
  assert.equal(d.history.length, 9);
});

test("허용되지 않은 전환은 거부된다", () => {
  const bad = [
    ["PLANNED", "READY_FOR_APPROVAL"], // 단계 건너뛰기
    ["READY_FOR_APPROVAL", "PUBLISHING"], // 승인 없이 게시
    ["READY_FOR_APPROVAL", "SCHEDULED"],
    ["QC", "APPROVED"],
    ["PUBLISHING", "CANCELLED"], // 게시 중 취소
    ["PUBLISHED", "SCHEDULED"],
    ["REJECTED", "APPROVED"],
    ["EXPIRED", "APPROVED"],
    ["SCHEDULED", "FAILED"],
  ];
  for (const [from, to] of bad) {
    assert.equal(canTransition(from, to), false, `${from} → ${to}`);
    assert.throws(() => transition(doc(from), to), TransitionError, `${from} → ${to}`);
  }
  assert.throws(() => transition(doc("PLANNED"), "NOPE"), TransitionError);
  // 끝난 상태에서는 어디로도 못 감
  for (const end of ["PUBLISHED", "REJECTED", "FAILED", "CANCELLED", "EXPIRED"]) for (const to of STATES) if (!(end === "FAILED" && to === "FAILED")) assert.equal(canTransition(end, to), false, `${end} → ${to}`);
});

test("승인 뒤 바뀌면 버전이 오르고 승인이 무효가 된다", () => {
  const d = { ...doc("SCHEDULED"), approval: { version: 1 } };
  invalidate(d, { note: "문구 수정" });
  assert.equal(d.version, 2);
  assert.equal(d.approval, null);
  assert.equal(d.status, "READY_FOR_APPROVAL");
});

test("승인 대기 72시간이 지나면 만료 대상", () => {
  const d = { status: "READY_FOR_APPROVAL", readyAt: "2026-11-01T00:00:00Z" };
  assert.equal(isExpired(d, Date.parse("2026-11-03T23:59:00Z"), 72), false);
  assert.equal(isExpired(d, Date.parse("2026-11-04T00:01:00Z"), 72), true);
});

test("저장소는 todaygame:mkt: 키만 쓰고, 이상한 키 이름은 거부한다", async () => {
  const fake = createFakeUpstash();
  const store = createStore({ url: fake.url, token: fake.token, fetchImpl: fake.fetchImpl });
  await store.setJson("settings", { a: 1 });
  await store.saveContent({ id: "2026-11-09-feed-aaaaaa", createdAt: new Date().toISOString(), status: "PLANNED" });
  await store.withLock("x", 5, async () => {});
  await assert.rejects(() => store.withLock("x", 5, () => store.withLock("x", 5, async () => {})), { code: "BUSY" });
  assert.throws(() => store.key("../todaygame:scores:flappy"));
  await assert.rejects(() => store.run("GET", "a b"));
  assert.ok([...fake.keysSeen].length > 0);
  for (const k of fake.keysSeen) assert.ok(k.startsWith("todaygame:mkt:"), k);
  assert.throws(() => createStore({ url: "", token: "" }));
});

test("로그에서 토큰 · 키가 가려진다", () => {
  const env = { TG_BOT_TOKEN: "123456:ABCdefGHIjklMNO", LLM_API_KEY: "sk-test-abcdefgh", HOME: "/home/x" };
  const s = mask("봇 123456:ABCdefGHIjklMNO 키 sk-test-abcdefgh url=https://x?access_token=EAAbcd1234&a=1 Authorization: Bearer abcdefghijkl home /home/x", env);
  assert.ok(!s.includes("ABCdefGHI"), s);
  assert.ok(!s.includes("sk-test-abcdefgh"), s);
  assert.ok(!s.includes("EAAbcd1234"), s);
  assert.ok(!s.includes("abcdefghijkl"), s);
  assert.ok(s.includes("/home/x")); // 비밀이 아닌 값은 그대로
  assert.ok(mask({ token: "zzzzzzzzzz" }).includes('"token":"***"'));
});

test("설정: 기본값 통과, 잘못된 값 거부", () => {
  assert.ok(validate(merge(DEFAULTS, {})));
  assert.throws(() => validate(merge(DEFAULTS, { postTimes: { feed: "25:00" } })), { code: "BAD_SETTINGS" });
  assert.throws(() => validate(merge(DEFAULTS, { channels: [] })), { code: "BAD_SETTINGS" });
  assert.throws(() => validate(merge(DEFAULTS, { qc: { maxRedo: 5 } })), { code: "BAD_SETTINGS" });
  assert.deepEqual(merge(DEFAULTS, { allow: { audio: ["a.mp3"] } }).allow, { audio: ["a.mp3"], fonts: ["Pretendard"] });
});

test("채널: 기본 mock, live 인데 어댑터가 없으면 멈춘다", () => {
  const r = createRegistry();
  const modes = registerChannels(r, {});
  assert.deepEqual(Object.values(modes), ["mock", "mock", "mock", "mock"]);
  assert.equal(r.get("channel", "instagram").mock, true);
  assert.throws(() => registerChannels(createRegistry(), { CHANNEL_MODE_INSTAGRAM: "live" }), /아직 구현되지 않았습니다/);
  assert.throws(() => registerChannels(createRegistry(), { CHANNEL_MODE_THREADS: "on" }), /mock 또는 live/);
});

test("플러그인 등록: 필요한 함수가 없으면 거부", () => {
  const r = createRegistry();
  assert.throws(() => r.register("channel", "x", { publish() {} }), /capabilities/);
  assert.throws(() => r.register("renderer", "x", { render() {} }), /kinds/);
  assert.throws(() => r.get("source", "nope"), { code: "NO_PLUGIN" });
});

test("UTM 링크 형식 · 사이트 밖 주소 거부", () => {
  assert.equal(
    utmLink("/games/reaction/", { channel: "instagram", kind: "reel", sourceId: "reaction" }),
    "https://www.todaygame.co.kr/games/reaction/?utm_source=instagram&utm_medium=organic&utm_campaign=todaygame_reel&utm_content=reaction"
  );
  assert.throws(() => utmLink("https://evil.example/", { channel: "instagram", kind: "reel", sourceId: "x" }));
});
