"use strict";
/* PHASE 5 — 텔레그램 승인 (가짜 텔레그램 서버로): 승인 · 반려 · 문구 수정 후 재승인 · 승인 없으면 게시 안 됨 · 중복 · 72시간 만료 · 허용 안 된 대화방 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeCtx, PLAN } = require("./helpers");
const { produce, runQueued } = require("../core/pipeline");
const { publishDue } = require("../core/publisher");
const { createTelegram } = require("../approval/telegram");

const ADMIN = 5551234;
const H = 3600 * 1000;

function fakeTelegram() {
  const calls = [];
  const updates = [];
  let mid = 100;
  let uid = 1;
  async function fetchImpl(url, init) {
    const method = url.split("/").pop();
    let params = {};
    if (init.body instanceof FormData) for (const [k, v] of init.body.entries()) params[k] = typeof v === "string" ? v : "[파일]";
    else params = JSON.parse(init.body);
    let result = true;
    if (method === "getUpdates") result = updates.filter((u) => u.update_id >= (params.offset || 0));
    if (method === "sendMessage" || method === "sendVideo") result = { message_id: ++mid, chat: { id: Number(params.chat_id) } };
    calls.push({ method, params, result });
    return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
  }
  const press = (data, { chat = ADMIN, messageId = 1 } = {}) => {
    const id = uid++;
    updates.push({ update_id: id, callback_query: { id: `cq-${id}`, from: { id: 1, username: "admin" }, data, message: { message_id: messageId, chat: { id: chat } } } });
    return `cq-${id}`;
  };
  const repeat = (cqId) => {
    const u = updates.find((x) => x.callback_query && x.callback_query.id === cqId);
    updates.push({ ...u, update_id: uid++ });
  };
  const reply = (text, toMessageId, { chat = ADMIN } = {}) => updates.push({ update_id: uid++, message: { message_id: ++mid, chat: { id: chat }, from: { id: 1, username: "admin" }, text, reply_to_message: { message_id: toMessageId } } });
  const approvals = () => calls.filter((c) => c.method === "sendMessage" && c.params.reply_markup && c.params.reply_markup.inline_keyboard && c.params.reply_markup.inline_keyboard.length);
  const lastApproval = () => approvals().pop();
  const button = (msg, prefix) => msg.params.reply_markup.inline_keyboard.flat().find((b) => b.callback_data.startsWith(prefix)).callback_data;
  const texts = () => calls.filter((c) => c.method === "sendMessage").map((c) => c.params.text);
  return { fetchImpl, calls, press, repeat, reply, approvals, lastApproval, button, texts };
}

function setup(opts) {
  const base = makeCtx(opts);
  const tg = fakeTelegram();
  const telegram = createTelegram({ store: base.store, approval: base.approval, settings: base.settings, token: "123:TEST-TOKEN", chatId: ADMIN, fetchImpl: tg.fetchImpl, logger: base.ctx.logger, now: base.clock.now });
  base.registry.register("notifier", "default", telegram.notifier);
  return { ...base, tg, telegram };
}

test("승인 요청: 영상 + 문구 + 예정 시각 + 검수 + UTM + 버튼 (버튼 데이터 64바이트 이하)", async () => {
  const { ctx, tg } = setup();
  const doc = await produce(ctx, PLAN);
  assert.equal(doc.status, "READY_FOR_APPROVAL");
  const video = tg.calls.find((c) => c.method === "sendVideo");
  assert.ok(video && video.params.video === "[파일]" && String(video.params.chat_id) === String(ADMIN));
  const m = tg.lastApproval();
  assert.match(m.params.text, /승인 요청/);
  assert.match(m.params.text, /게시 예정: 11-09 19:00 \(서울\)/);
  assert.match(m.params.text, /검수: 통과/);
  assert.match(m.params.text, /utm_source=instagram/);
  const data = m.params.reply_markup.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(data.length >= 9);
  for (const d of data) assert.ok(Buffer.byteLength(d) <= 64, d);
});

test("승인 버튼 → 예약 · 같은 버튼 두 번 → 한 번만 · 다른 대화방 → 무시 · 시각이 지나면 Mock 게시 + 완료 알림", async () => {
  const { ctx, tg, telegram, store, clock, instagram } = setup();
  const doc = await produce(ctx, PLAN);
  await publishDue(ctx);
  assert.equal(instagram.published, 0, "승인 전에는 게시 안 함");
  const ok = tg.button(tg.lastApproval(), "ok|");
  tg.press(ok, { chat: 999 }); // 남의 대화방
  const cq = tg.press(ok);
  tg.repeat(cq); // 같은 버튼이 다시 들어옴
  const r = await telegram.processUpdates();
  assert.deepEqual(r, { callbacks: 1, messages: 0, ignored: 1 });
  let d = await store.getContent(doc.id);
  assert.equal(d.status, "SCHEDULED");
  assert.equal(d.approval.by, "telegram:admin");
  assert.ok(tg.calls.some((c) => c.method === "answerCallbackQuery"));
  assert.deepEqual(await telegram.processUpdates(), { callbacks: 0, messages: 0, ignored: 0 }, "offset 덕분에 다시 처리 안 함");
  clock.set("2026-11-09T19:20:00+09:00");
  await publishDue(ctx);
  d = await store.getContent(doc.id);
  assert.equal(d.status, "PUBLISHED");
  assert.equal(instagram.published, 1);
  assert.ok(tg.texts().some((t) => /게시 완료/.test(t) && /\(모의\)/.test(t)));
});

test("답장으로 문구 수정 → 버전 2 · 승인 무효 · 새 승인 요청 · 옛 버튼은 거부 · 새 버튼으로 승인", async () => {
  const { ctx, tg, telegram, store } = setup();
  const doc = await produce(ctx, PLAN);
  const first = tg.lastApproval();
  tg.press(tg.button(first, "ok|"));
  await telegram.processUpdates();
  assert.equal((await store.getContent(doc.id)).status, "SCHEDULED");
  tg.reply("새로 쓴 문구예요 🎮\n프로필 링크에서 플레이!\n#오늘의게임 #무료게임 #웹게임 #미니게임 #반응속도", first.result.message_id);
  await telegram.processUpdates();
  let d = await store.getContent(doc.id);
  assert.equal(d.status, "READY_FOR_APPROVAL");
  assert.equal(d.version, 2);
  assert.equal(d.approval, null);
  assert.equal(d.copy.instagram.caption, "새로 쓴 문구예요 🎮\n프로필 링크에서 플레이!");
  assert.deepEqual(d.copy.instagram.hashtags, ["#오늘의게임", "#무료게임", "#웹게임", "#미니게임", "#반응속도"]);
  const second = tg.lastApproval();
  assert.notEqual(second, first);
  tg.press(tg.button(first, "ok|")); // 옛 버전 버튼
  await telegram.processUpdates();
  assert.equal((await store.getContent(doc.id)).status, "READY_FOR_APPROVAL");
  assert.ok(tg.texts().some((t) => /처리 못 함: 그사이 내용이 바뀌었습니다/.test(t)));
  tg.press(tg.button(second, "ok|"));
  await telegram.processUpdates();
  d = await store.getContent(doc.id);
  assert.equal(d.status, "SCHEDULED");
  assert.equal(d.approval.version, 2);
});

test("반려 → 사유를 답장으로 → REJECTED · 게시 안 됨", async () => {
  const { ctx, tg, telegram, store, clock, instagram } = setup();
  const doc = await produce(ctx, PLAN);
  tg.press(tg.button(tg.lastApproval(), "no|"));
  await telegram.processUpdates();
  const ask = tg.calls.filter((c) => c.method === "sendMessage" && c.params.reply_markup && c.params.reply_markup.force_reply).pop();
  assert.ok(ask, "반려 사유를 묻는 답장 창");
  tg.reply("게임 화면이 너무 어두워요", ask.result.message_id);
  await telegram.processUpdates();
  const d = await store.getContent(doc.id);
  assert.equal(d.status, "REJECTED");
  assert.equal(d.rejection.reason, "게임 화면이 너무 어두워요");
  clock.add(48 * H);
  await publishDue(ctx);
  assert.equal(instagram.published, 0);
});

test("게시 취소 · 문구 다시 만들기(작업 서버가 이어서 → 새 승인 요청) · 채널 고르기", async () => {
  const { ctx, tg, telegram, store } = setup();
  const a = await produce(ctx, PLAN);
  tg.press(tg.button(tg.lastApproval(), "x|"));
  await telegram.processUpdates();
  assert.equal((await store.getContent(a.id)).status, "CANCELLED");

  const b = await produce(ctx, PLAN);
  const before = tg.approvals().length;
  tg.press(tg.button(tg.lastApproval(), "cp|"));
  await telegram.processUpdates();
  assert.equal((await store.getContent(b.id)).status, "COPYWRITING");
  await runQueued(ctx);
  assert.equal((await store.getContent(b.id)).status, "READY_FOR_APPROVAL");
  assert.equal(tg.approvals().length, before + 1, "다시 만든 뒤 새 승인 요청");

  tg.press(tg.button(tg.lastApproval(), `ch|${b.id}|`).replace(/\|[a-z]+$/, "|threads"));
  await telegram.processUpdates();
  const d = await store.getContent(b.id);
  assert.deepEqual(d.channels, ["instagram", "threads"]);
  assert.match(tg.lastApproval().params.text, /Threads 문구/);
});

test("승인 대기 72시간이 지나면 EXPIRED + 알림, 게시 안 됨", async () => {
  const { ctx, tg, store, clock, instagram } = setup();
  const doc = await produce(ctx, PLAN);
  clock.add(73 * H);
  await publishDue(ctx);
  assert.equal((await store.getContent(doc.id)).status, "EXPIRED");
  assert.ok(tg.texts().some((t) => /승인 기한\(72시간\)이 지나/.test(t)));
  assert.equal(instagram.published, 0);
});

test("제작 실패는 실패 사유만 알림", async () => {
  const { ctx, tg } = setup({ sameBytes: true });
  await produce(ctx, PLAN);
  const bad = await produce(ctx, PLAN);
  assert.equal(bad.status, "FAILED");
  assert.ok(tg.texts().some((t) => /제작 실패/.test(t) && /같은 파일/.test(t)));
});

test("열쇠 · 대화방 id 가 없거나 틀리면 만들지 않음 · 토큰은 오류 문구에 안 나옴", async () => {
  const { store, approval, settings } = makeCtx();
  assert.throws(() => createTelegram({ store, approval, settings, token: "", chatId: ADMIN }), /TG_BOT_TOKEN/);
  assert.throws(() => createTelegram({ store, approval, settings, token: "1:x", chatId: "abc" }), /숫자/);
  const t = createTelegram({ store, approval, settings, token: "999:SECRET-VALUE", chatId: ADMIN, fetchImpl: async () => { throw new Error("connect ECONNREFUSED https://api.telegram.org/bot999:SECRET-VALUE/getUpdates"); } });
  await assert.rejects(() => t.processUpdates(), (e) => !/SECRET-VALUE/.test(e.message));
});
