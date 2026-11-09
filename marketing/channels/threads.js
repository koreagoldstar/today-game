"use strict";
/*
 * Threads 실제 게시 (CHANNEL_MODE_THREADS=live) — 공식 Threads API (graph.threads.com/v1.0)
 *  문서 (2026-11-10 확인, docs/API_RESEARCH.md §2): POST /{user}/threads (media_type TEXT · IMAGE · VIDEO · CAROUSEL)
 *  → 처리 상태 GET /{container}?fields=status,error_message (FINISHED 까지, 평균 30초) → POST /{user}/threads_publish
 *  권한 threads_basic · threads_content_publish (성과 threads_manage_insights). 24시간 250건. 글 500자, 주제 태그 1개.
 *  토큰: 60일 — Redis channel:threads 에 암호문, 만료 7일 전부터 th_refresh_token 으로 갱신. 연결: run.js threads-connect
 */
const { CAPS } = require("./caps");
const { encrypt, decrypt } = require("../core/secret");
const { classify } = require("./instagram");

const HOST = "https://graph.threads.com";
const DAY = 86400000;
const KEY = "channel:threads";
const METRICS = ["views", "likes", "replies", "reposts", "quotes", "shares"];

function api({ token, fetchImpl = fetch, version = process.env.THREADS_API_VERSION || "v1.0" }) {
  return async function call(method, path, params = {}) {
    const qs = new URLSearchParams({ ...params, access_token: token });
    const url = path.startsWith("/refresh_access_token") ? `${HOST}${path}?${qs}` : method === "GET" ? `${HOST}/${version}${path}?${qs}` : `${HOST}/${version}${path}`;
    let res;
    try {
      res = await fetchImpl(url, method === "GET" ? {} : { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs.toString() });
    } catch (e) {
      throw Object.assign(new Error(`Threads 서버에 연결하지 못했습니다: ${String(e.message).split(token).join("***")}`), { kind: "NETWORK", retryable: true });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) throw classify(res.status, data && data.error);
    return data;
  };
}

/** 관리자가 받은 장기 토큰(60일)을 확인해 암호화 저장 */
async function connectThreads(store, token, { env = process.env, fetchImpl, now = Date.now() } = {}) {
  const tok = String(token || "").trim();
  if (!tok) throw new Error("토큰이 비어 있습니다.");
  const me = await api({ token: tok, fetchImpl })("GET", "/me", { fields: "id,username" });
  const rec = { userId: String(me.id), username: me.username, tokenEnc: encrypt(tok, env), connectedAt: new Date(now).toISOString(), refreshedAt: new Date(now).toISOString(), expiresAt: new Date(now + 60 * DAY).toISOString(), expiresEstimated: true, status: "ok", error: null };
  await store.setJson(KEY, rec);
  return { username: rec.username, expiresAt: rec.expiresAt };
}

async function refreshThreads(store, { env = process.env, fetchImpl, now = Date.now(), notify = async () => {} } = {}) {
  const r = await store.getJson(KEY);
  if (!r) return { action: "none", reason: "연결 안 됨" };
  const left = Date.parse(r.expiresAt) - now;
  if (left <= 0) {
    await store.setJson(KEY, { ...r, status: "expired", error: "토큰 만료" });
    await notify("token_expired", { username: `${r.username} (Threads)` });
    return { action: "expired" };
  }
  if (left > 7 * DAY || now - Date.parse(r.refreshedAt) < DAY) return { action: "none", daysLeft: Math.floor(left / DAY) };
  try {
    const out = await api({ token: decrypt(r.tokenEnc, env), fetchImpl })("GET", "/refresh_access_token", { grant_type: "th_refresh_token" });
    const rec = { ...r, tokenEnc: encrypt(out.access_token, env), refreshedAt: new Date(now).toISOString(), expiresAt: new Date(now + Number(out.expires_in || 60 * 86400) * 1000).toISOString(), expiresEstimated: !out.expires_in, status: "ok", error: null };
    await store.setJson(KEY, rec);
    return { action: "refreshed", expiresAt: rec.expiresAt };
  } catch (e) {
    await store.setJson(KEY, { ...r, status: "error", error: `${e.kind || "UNKNOWN"}: ${e.message}` });
    await notify("token_refresh_failed", { username: `${r.username} (Threads)`, error: e.message, daysLeft: Math.floor(left / DAY) });
    return { action: "failed", error: e.message };
  }
}

/** 글: 문구 + 사이트 주소 (500자). 해시태그 대신 주제 태그 1개 */
function textOf(copy) {
  const link = copy.link ? `\n${copy.link}` : "";
  return (String(copy.caption || "").trim().slice(0, 500 - link.length) + link).trim();
}
const topicOf = (copy) => {
  const t = String((copy.hashtags || [])[0] || "").replace(/^#/, "").replace(/[.&]/g, "").slice(0, 50);
  return t || null;
};

function create({ env = process.env, store, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pollMs = 15000, pollMax = 12 } = {}) {
  if (!store) throw new Error("threads live 에는 저장소가 필요합니다.");
  async function session() {
    const r = await store.getJson(KEY);
    if (!r) throw Object.assign(new Error("Threads 계정이 연결되지 않았습니다 (node marketing/run.js threads-connect)."), { kind: "TOKEN", retryable: false });
    if (r.status === "expired" || Date.parse(r.expiresAt) <= Date.now()) throw Object.assign(new Error("Threads 토큰이 만료되었습니다. 다시 연결해 주세요."), { kind: "TOKEN", retryable: false });
    return { call: api({ token: decrypt(r.tokenEnc, env), fetchImpl }), uid: r.userId };
  }
  async function waitFinished(call, id) {
    for (let i = 0; i < pollMax; i++) {
      const s = await call("GET", `/${id}`, { fields: "status,error_message" });
      if (s.status === "FINISHED" || s.status === "PUBLISHED") return s.status;
      if (s.status === "ERROR") throw Object.assign(new Error(`Threads 가 미디어를 처리하지 못함: ${s.error_message || "ERROR"}`), { kind: "MEDIA", retryable: false });
      if (s.status === "EXPIRED") throw Object.assign(new Error("컨테이너가 만료됨"), { kind: "MEDIA", retryable: true, expired: true });
      await sleep(pollMs);
    }
    throw Object.assign(new Error("Threads 미디어 처리 시간이 길어 다음 실행에서 이어서 확인"), { kind: "UNKNOWN", retryable: true });
  }
  const https = (f, what) => {
    if (!f || !/^https:\/\//.test(f.url || "")) throw Object.assign(new Error(`${what} 공개 주소(https)가 없습니다.`), { kind: "INVALID", retryable: false });
    return f.url;
  };
  async function container(call, uid, item) {
    const text = textOf(item.copy);
    const topic = topicOf(item.copy);
    const base = { text, ...(topic ? { topic_tag: topic } : {}) };
    const files = item.files || [];
    if (item.kind === "reel") return (await call("POST", `/${uid}/threads`, { ...base, media_type: "VIDEO", video_url: https(files.find((f) => f.role === "video"), "영상") })).id;
    if (item.kind === "image") return (await call("POST", `/${uid}/threads`, { ...base, media_type: "IMAGE", image_url: https(files.find((f) => f.role === "image" || f.role === "cover"), "이미지") })).id;
    if (item.kind === "text") return (await call("POST", `/${uid}/threads`, { text: String(item.copy.caption || "").slice(0, 500), media_type: "TEXT", ...(item.copy.link ? { link_attachment: item.copy.link } : {}), ...(topic ? { topic_tag: topic } : {}) })).id;
    if (item.kind === "carousel") {
      const slides = files.filter((f) => f.role === "slide");
      if (slides.length < 2 || slides.length > CAPS.threads.carousel.maxItems) throw Object.assign(new Error(`캐러셀은 2~${CAPS.threads.carousel.maxItems}장입니다.`), { kind: "INVALID", retryable: false });
      const children = [];
      for (const s of slides) children.push((await call("POST", `/${uid}/threads`, { media_type: "IMAGE", image_url: https(s, "슬라이드"), is_carousel_item: "true" })).id);
      for (const c of children) await waitFinished(call, c);
      return (await call("POST", `/${uid}/threads`, { text, media_type: "CAROUSEL", children: children.join(",") })).id;
    }
    throw Object.assign(new Error(`Threads 가 받지 않는 형식: ${item.kind}`), { kind: "INVALID", retryable: false });
  }

  return {
    name: "threads",
    mock: false,
    capabilities: () => CAPS.threads,
    async publish(item, { save } = {}) {
      const { call, uid } = await session();
      const q = await call("GET", `/${uid}/threads_publishing_limit`, { fields: "quota_usage,config" }).catch(() => null);
      const d = q && q.data && q.data[0];
      if (d && d.config && Number(d.quota_usage) >= Number(d.config.quota_total)) throw Object.assign(new Error(`Threads 게시 한도 도달 (${d.quota_usage}/${d.config.quota_total})`), { kind: "RATE_LIMIT", retryable: true });
      const containerId = await container(call, uid, item);
      if (save) await save({ containerId });
      await waitFinished(call, containerId);
      const mediaId = (await call("POST", `/${uid}/threads_publish`, { creation_id: containerId })).id;
      if (save) await save({ platformId: mediaId });
      return { postId: mediaId };
    },
    async resume(post, item) {
      if (post.platformId) return { postId: post.platformId };
      if (!post.containerId) return null;
      const { call, uid } = await session();
      try {
        if ((await waitFinished(call, post.containerId)) === "PUBLISHED") {
          // 이미 올라갔는데 게시 id 기록만 놓친 경우: 최근 글에서 같은 첫 줄을 찾는다 (다시 올려 중복되지 않게)
          const first = textOf(item.copy).split("\n")[0];
          const hit = ((await call("GET", `/${uid}/threads`, { fields: "id,text,timestamp", limit: "10" })).data || []).find((m) => String(m.text || "").split("\n")[0] === first);
          if (hit) return { postId: hit.id };
          throw Object.assign(new Error("Threads 에 이미 게시됐지만 게시물을 찾지 못함 — 관리자 확인 필요"), { kind: "VERIFY", retryable: false });
        }
      } catch (e) {
        if (e.expired || e.kind === "MEDIA") return null;
        throw e;
      }
      return { postId: (await call("POST", `/${uid}/threads_publish`, { creation_id: post.containerId })).id };
    },
    async verify(postId) {
      const { call } = await session();
      const m = await call("GET", `/${postId}`, { fields: "id,permalink,media_type,timestamp" });
      return { ok: String(m.id) === String(postId), permalink: m.permalink || null };
    },
    /** 팔로워 수 (threads_manage_insights 가 있을 때) */
    async followers() {
      const { call, uid } = await session();
      const r = await call("GET", `/${uid}/threads_insights`, { metric: "followers_count" });
      const x = (r.data || [])[0];
      return Number(x && (x.total_value ? x.total_value.value : x.values && x.values[0] && x.values[0].value));
    },
    async insights(postId) {
      const { call } = await session();
      const r = await call("GET", `/${postId}/insights`, { metric: METRICS.join(",") });
      return (r.data || []).map((x) => ({ metric: x.name, value: x.values ? x.values[0].value : x.total_value ? x.total_value.value : null })).filter((x) => x.value != null);
    },
    async health() {
      const r = await store.getJson(KEY);
      if (!r) return { ok: false, mode: "live", reason: "계정 연결 안 됨" };
      return { ok: r.status === "ok" && Date.parse(r.expiresAt) > Date.now(), mode: "live", username: r.username, daysLeft: Math.floor((Date.parse(r.expiresAt) - Date.now()) / DAY), error: r.error };
    },
  };
}

module.exports = { create, connectThreads, refreshThreads, textOf, topicOf };
