"use strict";
/*
 * 텔레그램 승인 (PHASE 5, 결정 3: 폴링 — 사이트에 함수를 배포하지 않음. 게시 작업이 30분마다 getUpdates)
 *  알림: 승인 요청(영상 + 문구 + 예정 시각 + 검수 + UTM + 버튼) · 실패 사유 · 게시 완료 · 게시 실패 · 기한 지남
 *  버튼: 승인 · 반려(사유를 답장으로) · 문구 다시 만들기 · 다시 제작 · 게시 취소 · 채널 고르기
 *  답장: 승인 요청 메시지에 답장으로 보낸 글 = 인스타 문구 직접 수정 (버전 +1, 기존 승인 무효)
 *  안전: 허용한 chat_id 외에는 무시 · 같은 버튼은 한 번만(tg:done) · 화면에서 본 버전이 다르면 거부(approval.js)
 * 공식 문서(2026-11-09 확인): callback_data 1~64바이트 · 영상 업로드 50MB · 본문 4096자 · 캡션 1024자 · 업데이트 24시간 보관 · 웹훅 있으면 getUpdates 안 됨
 */
const fs = require("fs");
const path = require("path");
const { KO } = require("../core/state");

const ACT = { ok: "승인", no: "반려", cp: "문구 다시 만들기", re: "다시 제작", x: "게시 취소", ch: "채널" };
const CHANNELS = ["instagram", "threads", "facebook", "youtube"];
const CH_KO = { instagram: "인스타", threads: "Threads", facebook: "페이스북", youtube: "유튜브" };
const kst = (iso) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(5, 16).replace("T", " ") + " (서울)";

function cb(act, doc, extra = "") {
  const data = [act, doc.id, doc.version, extra].filter((x) => x !== "").join("|");
  if (Buffer.byteLength(data) > 64) throw new Error(`버튼 데이터가 64바이트를 넘음: ${data}`);
  return { text: ACT[act] && act !== "ch" ? ACT[act] : extra, callback_data: data };
}

function keyboard(doc) {
  const rows = [[{ ...cb("ok", doc), text: "✅ 승인" }], [{ ...cb("no", doc), text: "❌ 반려" }, { ...cb("x", doc), text: "🗑 게시 취소" }], [{ ...cb("cp", doc), text: "✍️ 문구 다시 만들기" }, { ...cb("re", doc), text: "🎬 다시 제작" }]];
  rows.push(CHANNELS.map((ch) => ({ ...cb("ch", doc, ch), text: `${doc.channels.includes(ch) ? "☑" : "☐"} ${CH_KO[ch]}` })));
  return { inline_keyboard: rows };
}

function approvalText(doc, nextAt) {
  const ig = doc.copy && doc.copy.instagram;
  const fails = ((doc.qc && doc.qc.checks) || []).filter((c) => !c.ok);
  const lines = [
    `🎮 승인 요청 — ${(doc.render && doc.render.meta.title) || doc.plan.sourceId}`,
    `콘텐츠 ${doc.id} · 버전 ${doc.version} · ${doc.render ? doc.render.kind : ""} ${doc.render && doc.render.meta.durationSec ? `${doc.render.meta.durationSec}초` : ""}`,
    `채널: ${doc.channels.map((c) => CH_KO[c] || c).join(", ")}`,
    `게시 예정: ${nextAt ? kst(nextAt) : "승인하면 다음 빈 자리"}`,
    `검수: ${doc.qc ? (doc.qc.passed ? `통과 (${doc.qc.checks.length}항목)` : `불합격 ${fails.map((c) => c.reason).join(" / ")}`) : "-"}`,
    "",
  ];
  for (const ch of doc.channels) {
    const c = doc.copy && doc.copy[ch];
    if (!c) continue;
    lines.push(`── ${CH_KO[ch] || ch} 문구 (${c.source || "-"}) ──`, c.title ? `제목: ${c.title}` : "", c.caption, (c.hashtags || []).join(" "), `링크: ${c.link || "-"}`, "");
  }
  if (doc.render && doc.render.meta.comment) lines.push("── 게시 뒤 첫 댓글 ──", doc.render.meta.comment, "");
  if (doc.render && doc.render.kind === "story") lines.push("ℹ️ 스토리는 문구가 게시되지 않습니다 (그림만).", "");
  lines.push("✍️ 인스타 문구를 고치려면 이 메시지에 답장으로 새 문구를 보내 주세요. 해시태그는 #으로 시작하는 마지막 줄에.");
  const text = lines.filter((l) => l !== "").join("\n");
  return text.length > 4000 ? text.slice(0, 3990) + "\n…(줄임)" : text;
}

function createTelegramClient({ token, fetchImpl = fetch }) {
  if (!token) throw new Error("TG_BOT_TOKEN 이 없습니다.");
  const base = `https://api.telegram.org/bot${token}`;
  async function call(method, params = {}, form = null) {
    let res;
    try {
      res = await fetchImpl(`${base}/${method}`, form ? { method: "POST", body: form } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
    } catch (e) {
      throw new Error(`텔레그램 연결 실패 (${method}): ${String(e.message).split(token).join("***")}`);
    }
    const data = await res.json().catch(() => null);
    if (!data || !data.ok) throw Object.assign(new Error(`텔레그램 ${method} 실패: ${(data && data.description) || res.status}`), { tg: data });
    return data.result;
  }
  /** files: { 필드이름: 파일경로 } — sendVideo · sendPhoto · sendMediaGroup(attach://필드이름) */
  async function sendFiles(method, files, params) {
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.append(k, typeof v === "string" ? v : JSON.stringify(v));
    for (const [field, file] of Object.entries(files)) form.append(field, await fs.openAsBlob(file), path.basename(file));
    return call(method, null, form);
  }
  const sendFile = (method, field, file, params) => sendFiles(method, { [field]: file }, params);
  return { call, sendFile, sendFiles };
}

/**
 * @param {{ store, approval, settings, token, chatId, fetchImpl?, logger?, onRedo? }} o
 *   approval: core/approval.js 의 createApproval 결과 (텔레그램 · 웹 공용)
 */
function createTelegram({ store, approval, settings, token, chatId, fetchImpl, logger, now = () => Date.now() }) {
  const tg = createTelegramClient({ token, fetchImpl });
  const chat = String(chatId || "");
  if (!/^-?\d+$/.test(chat)) throw new Error("TG_ADMIN_CHAT_ID 가 숫자가 아닙니다.");
  const send = (text, extra = {}) => tg.call("sendMessage", { chat_id: chat, text: text.slice(0, 4096), ...extra });
  const remember = (messageId, value) => store.setJson(`tg:msg:${messageId}`, value, { ex: 8 * 86400 });

  async function requestApproval(doc) {
    const files = (doc.render && doc.render.files) || [];
    const cap = `${doc.render && doc.render.meta.title} · ${doc.id} · 버전 ${doc.version}`.slice(0, 1024);
    const video = files.find((f) => f.role === "video");
    const pics = files.filter((f) => (f.role === "slide" || f.role === "image") && f.path && fs.existsSync(f.path)).slice(0, 10); // 앨범은 10장까지
    if (video && video.path && fs.existsSync(video.path) && fs.statSync(video.path).size <= 50 * 1024 * 1024) {
      await tg.sendFile("sendVideo", "video", video.path, { chat_id: chat, caption: cap, supports_streaming: "true" });
    } else if (video && video.url) {
      await send(`영상: ${video.url}`);
    } else if (pics.length === 1) {
      await tg.sendFile("sendPhoto", "photo", pics[0].path, { chat_id: chat, caption: cap });
    } else if (pics.length > 1) {
      await tg.sendFiles("sendMediaGroup", Object.fromEntries(pics.map((p, i) => [`p${i}`, p.path])), { chat_id: chat, media: pics.map((p, i) => ({ type: "photo", media: `attach://p${i}`, ...(i === 0 ? { caption: cap } : {}) })) });
    }
    const { nextSlot, slotCounts } = require("../core/approval");
    let nextAt = null;
    try {
      nextAt = nextSlot(settings, doc, slotCounts(await store.listContents(200), doc.slot, doc.id), now());
    } catch (_) {}
    const m = await send(approvalText(doc, nextAt), { reply_markup: keyboard(doc) });
    await remember(m.message_id, { kind: "approval", id: doc.id, version: doc.version });
    return m;
  }

  /** 알림 플러그인 (registry 의 notifier) */
  const notifier = {
    async notify(event, doc, extra = {}) {
      if (!doc) return;
      if (event === "weekly") return send(extra.text);
      if (event === "token_expired") return send(`🔑 인스타그램 토큰이 만료되었습니다 (@${extra.username}). Meta 앱에서 새 토큰을 받아 다시 연결해 주세요. 그때까지 게시는 멈춥니다.`);
      if (event === "token_refresh_failed") return send(`🔑 인스타그램 토큰 갱신 실패 (@${extra.username}, ${extra.daysLeft}일 남음)\n${extra.error}\n만료 전에 다시 연결해 주세요.`);
      const title = (doc.render && doc.render.meta.title) || (doc.plan && doc.plan.sourceId) || doc.id;
      if (event === "ready") return requestApproval(doc);
      if (event === "failed") return send(`⚠️ 제작 실패 — ${title}\n${doc.id}\n단계: ${(doc.failure && doc.failure.stage) || "-"}\n사유: ${(doc.failure && doc.failure.reason) || "-"}\n게시 후보에서 뺐습니다.`);
      if (event === "publish_failed") return send(`⚠️ 게시 실패 — ${title} (${extra.channel})\n${doc.id}\n${extra.error ? `${extra.error.kind}: ${extra.error.message}` : ""}`);
      if (event === "expired") return send(`⌛ 승인 기한(${settings.approvalExpiryHours}시간)이 지나 게시하지 않습니다 — ${title}\n${doc.id}`);
      if (event === "published") {
        const posts = doc.channels.map((ch) => `${CH_KO[ch] || ch}: ${doc.posts[ch].status}${doc.posts[ch].mock ? " (모의)" : ""}${doc.posts[ch].permalink ? ` ${doc.posts[ch].permalink}` : ""}`);
        return send(`📣 게시 완료 — ${title}\n${posts.join("\n")}`);
      }
    },
  };

  async function onCallback(q) {
    const [act, id, version, extra] = String(q.data || "").split("|");
    const who = { by: String(q.from && (q.from.username || q.from.id)), via: "telegram" };
    let reply = "";
    try {
      if (act === "ok") {
        const d = await approval.approve(id, { version: Number(version), ...who });
        reply = `✅ 승인 — ${kst(d.scheduledAt)} 게시 예정`;
      } else if (act === "no") {
        const m = await send(`반려 사유를 이 메시지에 답장으로 보내 주세요. (${id} · 버전 ${version})`, { reply_markup: { force_reply: true } });
        await remember(m.message_id, { kind: "reject", id, version: Number(version) });
        reply = "반려 사유를 답장으로 보내 주세요";
      } else if (act === "x") {
        await approval.cancel(id, { version: Number(version), ...who });
        reply = "🗑 게시 취소";
      } else if (act === "cp" || act === "re") {
        await approval.redo(id, { version: Number(version), stage: act === "re" ? "render" : "copy", ...who });
        reply = act === "re" ? "🎬 다시 제작 요청 — 다음 작업 때 만듭니다" : "✍️ 문구 다시 만들기 요청 — 다음 작업 때 만듭니다";
      } else if (act === "ch") {
        const doc = await store.getContent(id);
        const next = doc.channels.includes(extra) ? doc.channels.filter((c) => c !== extra) : [...doc.channels, extra];
        const d = await approval.setChannels(id, { version: Number(version), channels: next, ...who });
        await requestApproval(d);
        reply = `채널: ${d.channels.join(", ")} — 새 승인 요청을 보냈습니다`;
      } else reply = "모르는 버튼";
    } catch (e) {
      reply = `처리 못 함: ${e.message}`;
    }
    await tg.call("answerCallbackQuery", { callback_query_id: q.id, text: reply.slice(0, 190) }).catch(() => {}); // 오래된 버튼은 답이 안 됨 (폴링 지연)
    if (q.message && !reply.startsWith("처리 못 함") && act !== "no") await tg.call("editMessageReplyMarkup", { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    await send(`${reply}\n(${id} · 버전 ${version})`);
    return reply;
  }

  async function onMessage(msg) {
    const ref = msg.reply_to_message && (await store.getJson(`tg:msg:${msg.reply_to_message.message_id}`));
    if (!ref) return null; // 답장이 아닌 글은 무시
    const who = { by: String(msg.from && (msg.from.username || msg.from.id)), via: "telegram" };
    try {
      if (ref.kind === "reject") {
        await approval.reject(ref.id, { version: ref.version, reason: msg.text || "", ...who });
        return send(`❌ 반려 — ${ref.id}\n사유: ${msg.text}`);
      }
      if (ref.kind === "approval") {
        const lines = String(msg.text || "").trim().split("\n");
        const tagLine = /^\s*#/.test(lines[lines.length - 1] || "") ? lines.pop() : null;
        const d = await approval.editCopy(ref.id, { version: ref.version, channel: "instagram", caption: lines.join("\n"), hashtags: tagLine ? tagLine.trim().split(/\s+/) : null, ...who });
        await send(`✍️ 문구를 바꿨습니다 (버전 ${d.version}). 다시 승인해 주세요.`);
        return requestApproval(d);
      }
    } catch (e) {
      return send(`처리 못 함: ${e.message}`);
    }
    return null;
  }

  /** 쌓인 업데이트 처리 — 허용한 대화방만, 같은 버튼은 한 번만 */
  async function processUpdates() {
    const offset = Number((await store.getJson("tg:offset")) || 0);
    const updates = await tg.call("getUpdates", { offset, timeout: 0, allowed_updates: ["message", "callback_query"] });
    const done = { callbacks: 0, messages: 0, ignored: 0 };
    for (const u of updates) {
      await store.setJson("tg:offset", u.update_id + 1);
      const q = u.callback_query;
      const m = u.message;
      const from = q ? q.message && q.message.chat && String(q.message.chat.id) : m && m.chat && String(m.chat.id);
      if (from !== chat) {
        done.ignored++;
        if (logger) await logger.warn(`허용하지 않은 대화방의 텔레그램 요청을 무시했습니다 (${from})`);
        continue;
      }
      if (q) {
        if (!(await store.setJson(`tg:done:${q.id}`, { at: new Date().toISOString() }, { nx: true, ex: 7 * 86400 }))) continue;
        await onCallback(q);
        done.callbacks++;
      } else if (m) {
        if (await onMessage(m)) done.messages++;
      }
    }
    return done;
  }

  return { notifier, processUpdates, requestApproval, keyboard, approvalText };
}

/** 열쇠가 없을 때: 콘솔에만 알림 (공개 저장소 로그라 문구 · 주소는 찍지 않음) */
const consoleNotifier = {
  async notify(event, doc) {
    console.log(`[알림 · 텔레그램 미연결] ${event} ${doc ? `${doc.id} ${KO[doc.status] || doc.status || ""}` : ""}`);
  },
};

module.exports = { createTelegram, createTelegramClient, consoleNotifier, keyboard, approvalText, CHANNELS };
