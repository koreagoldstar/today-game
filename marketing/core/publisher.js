"use strict";
/*
 * 게시 — "승인됨 + 게시 시각 지남 + 미게시" 만. 채널마다 따로 상태를 가진다.
 *  게시 직전 확인: 승인 버전 = 지금 버전 · 그 채널 오늘 상한 · idempotency 키(contentId + 채널 + 버전)로 이미 게시된 적 없음
 *  플랫폼이 준 id 는 받는 즉시 저장 → 중간에 멈춰도 다음 실행이 이어서 확인 (두 번 올리지 않음)
 *  재시도: 횟수 제한 + 지수 백오프. 한 채널 실패가 다른 채널을 막지 않는다.
 * 같은 실행에서 할 일: 승인 기한 지남(EXPIRED) 정리 · 중간에 멈춘 제작 FAILED 정리
 */
const { transition, approvalValid, isExpired, MAKING } = require("./state");
const { seoulDay } = require("./settings");
const { LockError } = require("./store");

const STALE_MAKING_MS = 3 * 3600 * 1000;

async function notify(ctx, event, doc, extra) {
  if (!ctx.registry.has("notifier", "default")) return;
  await ctx.registry
    .get("notifier", "default")
    .notify(event, doc, extra)
    .catch((e) => ctx.logger && ctx.logger.warn(`알림 실패: ${e.message}`));
}

const due = (doc, now) =>
  (doc.status === "SCHEDULED" || doc.status === "PUBLISHING") && approvalValid(doc) && !!doc.scheduledAt && Date.parse(doc.scheduledAt) <= now;

function item(doc, ch) {
  return { contentId: doc.id, version: doc.version, kind: doc.render.kind, files: doc.render.files, copy: doc.copy[ch], slot: doc.slot };
}

async function publishChannel(ctx, id, ch, now) {
  const { store, registry, settings } = ctx;
  let doc = await store.getContent(id);
  let post = doc.posts[ch];
  if (!post || post.status === "PUBLISHED" || post.status === "FAILED") return;
  if (post.nextTryAt && Date.parse(post.nextTryAt) > now) return;
  const channel = registry.get("channel", ch);
  const idem = `idem:${doc.id}:${ch}:v${doc.version}`;
  const capKey = `day:${ch}:${doc.slot}:${seoulDay(now)}`;
  const savePost = (patch) =>
    store.updateContent(id, (d) => {
      Object.assign(d.posts[ch], patch);
    });

  // 이미 게시된 적 있으면 (기록만 늦은 경우) 그대로 완료 처리
  const prior = await store.getJson(idem);
  if (prior && prior.platformId) {
    await savePost({ status: "PUBLISHED", platformId: prior.platformId, permalink: prior.permalink || null, publishedAt: prior.at, error: null });
    return;
  }

  const resuming = post.status === "PUBLISHING";
  if (!resuming) {
    const cap = (settings.dailyCaps[ch] || {})[doc.slot] || 0;
    const used = (await store.run("SMEMBERS", capKey)) || [];
    if (!used.includes(doc.id) && used.length >= cap) {
      await savePost({ note: `오늘 ${ch} ${doc.slot} 상한(${cap}) 도달 — 다음 실행에서 다시` });
      if (ctx.logger) await ctx.logger.info(`${id} ${ch}: 오늘 상한 도달, 미룸`);
      return;
    }
    await store.batch([
      ["SADD", capKey, doc.id],
      ["EXPIRE", capKey, 3 * 86400],
    ]);
    doc = await savePost({ status: "PUBLISHING", idemKey: idem, startedAt: new Date(now).toISOString(), attempts: (post.attempts || 0) + 1, error: null });
    post = doc.posts[ch];
  }

  // 플랫폼 id 를 받으면 바로 콘텐츠와 idempotency 키 둘 다에 남긴다
  const save = async (patch) => {
    await savePost(patch);
    if (patch.platformId) await store.setJson(idem, { platformId: patch.platformId, at: new Date().toISOString() }, { ex: 60 * 86400 });
  };

  try {
    let res = resuming && channel.resume ? await channel.resume(post, item(doc, ch)) : null;
    if (!res) res = await channel.publish(item(doc, ch), { save });
    const v = await channel.verify(res.postId);
    if (!v || !v.ok) throw Object.assign(new Error("게시 뒤 다시 조회했지만 게시물을 찾지 못했습니다."), { kind: "VERIFY", retryable: true });
    await save({ status: "PUBLISHED", platformId: res.postId, permalink: v.permalink || null, publishedAt: new Date().toISOString(), mock: !!res.mock, error: null, nextTryAt: null });
    await store.setJson(idem, { platformId: res.postId, permalink: v.permalink || null, at: new Date().toISOString() }, { ex: 60 * 86400 });
  } catch (e) {
    const { maxAttempts, backoffMinutes } = settings.publish;
    const attempts = post.attempts || 1;
    const retry = e.retryable !== false && attempts < maxAttempts;
    const error = { kind: e.kind || "UNKNOWN", code: e.code || null, message: String(e.message || e).slice(0, 300), at: new Date().toISOString() };
    await savePost({
      status: retry ? "PENDING" : "FAILED",
      error,
      nextTryAt: retry ? new Date(now + backoffMinutes * 60000 * 2 ** (attempts - 1)).toISOString() : null,
    });
    if (!retry) await store.run("SREM", capKey, id);
    if (ctx.logger) await ctx.logger.error(`${id} ${ch} 게시 실패 (${error.kind}, ${attempts}회째${retry ? ", 다시 시도 예정" : ""}): ${error.message}`);
    if (!retry) await notify(ctx, "publish_failed", await store.getContent(id), { channel: ch, error });
  }
}

async function publishContent(ctx, id, now) {
  const { store } = ctx;
  let claimed = false;
  const doc = await store.updateContent(id, (d) => {
    if (!due(d, now)) return false; // 다시 읽어 보니 조건이 안 맞음 (그사이 수정 · 취소)
    claimed = true;
    if (d.status === "SCHEDULED") transition(d, "PUBLISHING", { by: "publisher" });
    for (const ch of d.channels) d.posts[ch] = d.posts[ch] || { status: "PENDING", attempts: 0 };
  });
  if (!claimed) return null;
  for (const ch of doc.channels) await publishChannel(ctx, id, ch, now);

  const after = await store.updateContent(id, (d) => {
    const st = d.channels.map((ch) => d.posts[ch].status);
    if (st.every((s) => s === "PUBLISHED" || s === "FAILED")) {
      if (st.includes("PUBLISHED")) transition(d, "PUBLISHED", { by: "publisher", note: st.includes("FAILED") ? "일부 채널 실패" : "" });
      else {
        d.failure = { stage: "PUBLISH", reason: d.channels.map((ch) => `${ch}: ${(d.posts[ch].error || {}).message}`).join(" / ") };
        transition(d, "FAILED", { by: "publisher" });
      }
    } else if (d.status === "PUBLISHING") transition(d, "SCHEDULED", { by: "publisher", note: "남은 채널은 다음 실행에서" });
  });
  if (after.status === "PUBLISHED") await notify(ctx, "published", after);
  return after;
}

/** 30분마다 실행: 만료 정리 · 멈춘 제작 정리 · 게시. 동시에 두 개가 돌지 않게 잠근다 */
async function publishDue(ctx) {
  const { store, settings } = ctx;
  const now = ctx.now ? ctx.now() : Date.now();
  try {
    return await store.withLock("publish", 25 * 60, async () => {
      const out = { expired: [], interrupted: [], published: [], pending: [], failed: [] };
      for (const d of await store.listContents(200)) {
        if (isExpired(d, now, settings.approvalExpiryHours)) {
          await store.updateContent(d.id, (x) => (isExpired(x, now, settings.approvalExpiryHours) ? void transition(x, "EXPIRED", { by: "publisher", note: `승인 대기 ${settings.approvalExpiryHours}시간 지남` }) : false));
          out.expired.push(d.id);
          await notify(ctx, "expired", d);
        } else if (MAKING.includes(d.status) && !d.redo && now - Date.parse(d.updatedAt) > STALE_MAKING_MS) {
          await store.updateContent(d.id, (x) => {
            if (!MAKING.includes(x.status) || x.redo) return false;
            x.failure = { stage: x.status, reason: "작업 서버가 중간에 멈춤" };
            transition(x, "FAILED", { by: "publisher", note: "작업 중단" });
          });
          out.interrupted.push(d.id);
        } else if (due(d, now)) {
          const r = await publishContent(ctx, d.id, now);
          if (!r) continue;
          (r.status === "PUBLISHED" ? out.published : r.status === "FAILED" ? out.failed : out.pending).push(d.id);
        }
      }
      return out;
    });
  } catch (e) {
    if (e instanceof LockError) return { skipped: "다른 게시 작업이 실행 중" };
    throw e;
  }
}

module.exports = { publishDue, publishContent, due };
