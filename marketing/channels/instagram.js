"use strict";
/*
 * Instagram 실제 게시 (CHANNEL_MODE_INSTAGRAM=live) — 공식 Instagram API (Instagram 로그인, graph.instagram.com)
 *  문서 (2026-11-08 확인, docs/API_RESEARCH.md §1): 컨테이너 POST /{ig-user}/media → GET /{container}?fields=status_code
 *  (1분에 한 번씩 최대 5분 권장) → POST /{ig-user}/media_publish → 게시물을 다시 조회해 permalink.
 *  권한: instagram_business_basic · instagram_business_content_publish · instagram_business_manage_insights
 *  토큰: Redis channel:instagram 에 암호문(core/secret.js), 만료 7일 전부터 refresh_access_token, 실패하면 알림.
 *  오류 구분: TOKEN · PERMISSION · RATE_LIMIT · MEDIA · NETWORK · INVALID · UNKNOWN
 *  비공식 API · 비밀번호 로그인 · 브라우저 매크로는 쓰지 않는다.
 */
const { CAPS } = require("./caps");
const { encrypt, decrypt } = require("../core/secret");

const HOST = "https://graph.instagram.com";
const DAY = 86400000;
const METRICS = ["views", "reach", "likes", "comments", "saved", "shares", "total_interactions"];

function classify(status, err) {
  const code = err && Number(err.code);
  const sub = err && Number(err.error_subcode);
  const msg = (err && (err.error_user_msg || err.message)) || `HTTP ${status}`;
  let kind = "UNKNOWN";
  if ([190, 102, 463, 467].includes(code)) kind = "TOKEN";
  else if (code === 10 || code === 3 || (code >= 200 && code <= 299)) kind = "PERMISSION";
  else if ([4, 17, 32, 613, 80002].includes(code) || status === 429) kind = "RATE_LIMIT";
  else if (code === 9004 || code === 352 || code === 36003 || (sub >= 2207000 && sub < 2208000)) kind = "MEDIA";
  else if (code === 100) kind = "INVALID";
  return Object.assign(new Error(msg), { kind, code, subcode: sub, status, retryable: ["RATE_LIMIT", "NETWORK", "UNKNOWN"].includes(kind) });
}

function api({ token, fetchImpl = fetch, version = process.env.INSTAGRAM_API_VERSION || "v27.0" }) {
  return async function call(method, path, params = {}) {
    const qs = new URLSearchParams({ ...params, access_token: token });
    const url = path.startsWith("/refresh_access_token") || path.startsWith("/access_token") ? `${HOST}${path}?${qs}` : method === "GET" ? `${HOST}/${version}${path}?${qs}` : `${HOST}/${version}${path}`;
    let res;
    try {
      res = await fetchImpl(url, method === "GET" ? {} : { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs.toString() });
    } catch (e) {
      throw Object.assign(new Error(`Meta 서버에 연결하지 못했습니다: ${String(e.message).split(token).join("***")}`), { kind: "NETWORK", retryable: true });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) throw classify(res.status, data && data.error);
    return data;
  };
}

/* ---------------- 토큰 (연결 · 상태 · 갱신) ---------------- */

/** 관리자가 Meta 앱 대시보드에서 받은 토큰을 확인해 암호화 저장. 비즈니스 · 크리에이터 계정만 */
async function connectInstagram(store, token, { env = process.env, fetchImpl, now = Date.now() } = {}) {
  let tok = String(token || "").trim();
  if (!tok) throw new Error("토큰이 비어 있습니다.");
  let expiresIn = null;
  if (env.INSTAGRAM_APP_SECRET) {
    // 짧은 토큰(1시간)이면 장기 토큰(60일)으로 바꾼다. 이미 장기 토큰이면 실패하므로 그대로 쓴다
    try {
      const r = await api({ token: tok, fetchImpl })("GET", "/access_token", { grant_type: "ig_exchange_token", client_secret: env.INSTAGRAM_APP_SECRET });
      if (r.access_token) [tok, expiresIn] = [r.access_token, r.expires_in];
    } catch (_) {}
  }
  const me = await api({ token: tok, fetchImpl })("GET", "/me", { fields: "user_id,username,account_type" });
  const type = String(me.account_type || "").toUpperCase();
  if (!["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(type)) throw new Error(`프로페셔널(비즈니스 · 크리에이터) 계정이 아닙니다: ${me.account_type || "알 수 없음"}`);
  const rec = {
    userId: String(me.user_id || me.id),
    username: me.username,
    accountType: type,
    tokenEnc: encrypt(tok, env),
    connectedAt: new Date(now).toISOString(),
    refreshedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + (expiresIn ? expiresIn * 1000 : 60 * DAY)).toISOString(),
    expiresEstimated: !expiresIn, // 대시보드 토큰은 만료 시각을 알려 주지 않아 60일로 추정 (첫 갱신 때 정확해짐)
    status: "ok",
    error: null,
  };
  await store.setJson("channel:instagram", rec);
  return { ...rec, tokenEnc: undefined };
}

async function instagramStatus(store, now = Date.now()) {
  const r = await store.getJson("channel:instagram");
  if (!r) return { connected: false };
  return { connected: true, username: r.username, accountType: r.accountType, expiresAt: r.expiresAt, expiresEstimated: r.expiresEstimated, daysLeft: Math.floor((Date.parse(r.expiresAt) - now) / DAY), status: r.status, error: r.error, refreshedAt: r.refreshedAt };
}

/** 만료 7일 전부터 갱신 (발급 24시간 뒤부터 가능). 결과 { action: none|refreshed|failed|expired } */
async function refreshInstagram(store, { env = process.env, fetchImpl, now = Date.now(), notify = async () => {} } = {}) {
  const r = await store.getJson("channel:instagram");
  if (!r) return { action: "none", reason: "연결 안 됨" };
  const left = Date.parse(r.expiresAt) - now;
  if (left <= 0) {
    await store.setJson("channel:instagram", { ...r, status: "expired", error: "토큰 만료" });
    await notify("token_expired", { username: r.username });
    return { action: "expired" };
  }
  if (left > 7 * DAY) return { action: "none", daysLeft: Math.floor(left / DAY) };
  if (now - Date.parse(r.refreshedAt) < DAY) return { action: "none", reason: "발급 24시간 전이라 아직 갱신 불가" };
  try {
    const out = await api({ token: decrypt(r.tokenEnc, env), fetchImpl })("GET", "/refresh_access_token", { grant_type: "ig_refresh_token" });
    const rec = { ...r, tokenEnc: encrypt(out.access_token, env), refreshedAt: new Date(now).toISOString(), expiresAt: new Date(now + Number(out.expires_in || 60 * 86400) * 1000).toISOString(), expiresEstimated: !out.expires_in, status: "ok", error: null };
    await store.setJson("channel:instagram", rec);
    return { action: "refreshed", expiresAt: rec.expiresAt };
  } catch (e) {
    await store.setJson("channel:instagram", { ...r, status: "error", error: `${e.kind || "UNKNOWN"}: ${e.message}` });
    await notify("token_refresh_failed", { username: r.username, error: e.message, daysLeft: Math.floor(left / DAY) });
    return { action: "failed", error: e.message };
  }
}

/* ---------------- 채널 ---------------- */

const finalCaption = (copy) => [String(copy.caption || "").trim(), (copy.hashtags || []).join(" ")].filter(Boolean).join("\n\n");
const fileOf = (item, role) => (item.files || []).find((f) => f.role === role);

function create({ env = process.env, store, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pollMs = 30000, pollMax = 10 } = {}) {
  if (!store) throw new Error("instagram live 에는 저장소가 필요합니다.");
  async function session() {
    const r = await store.getJson("channel:instagram");
    if (!r) throw Object.assign(new Error("인스타그램 계정이 연결되지 않았습니다 (node marketing/run.js ig-connect)."), { kind: "TOKEN", retryable: false });
    if (r.status === "expired" || Date.parse(r.expiresAt) <= Date.now()) throw Object.assign(new Error("인스타그램 토큰이 만료되었습니다. 다시 연결해 주세요."), { kind: "TOKEN", retryable: false });
    return { call: api({ token: decrypt(r.tokenEnc, env), fetchImpl }), uid: r.userId };
  }

  async function waitFinished(call, id) {
    for (let i = 0; i < pollMax; i++) {
      const s = await call("GET", `/${id}`, { fields: "status_code,status" });
      if (s.status_code === "FINISHED") return "FINISHED";
      if (s.status_code === "PUBLISHED") return "PUBLISHED";
      if (s.status_code === "ERROR") throw Object.assign(new Error(`Meta 가 미디어를 처리하지 못함: ${s.status || "ERROR"}`), { kind: "MEDIA", retryable: false });
      if (s.status_code === "EXPIRED") throw Object.assign(new Error("컨테이너가 만료됨 (24시간)"), { kind: "MEDIA", retryable: true, expired: true });
      await sleep(pollMs);
    }
    throw Object.assign(new Error("Meta 미디어 처리 시간이 길어 다음 실행에서 이어서 확인"), { kind: "UNKNOWN", retryable: true });
  }

  async function container(call, uid, item) {
    const caption = finalCaption(item.copy);
    const https = (f, what) => {
      if (!f || !/^https:\/\//.test(f.url || "")) throw Object.assign(new Error(`${what} 공개 주소(https)가 없습니다 (Blob 업로드 확인).`), { kind: "INVALID", retryable: false });
      return f.url;
    };
    if (item.kind === "reel") {
      const cover = fileOf(item, "cover");
      return (await call("POST", `/${uid}/media`, { media_type: "REELS", video_url: https(fileOf(item, "video"), "영상"), caption, share_to_feed: "true", ...(cover && cover.url ? { cover_url: cover.url } : {}) })).id;
    }
    if (item.kind === "image") return (await call("POST", `/${uid}/media`, { image_url: https(fileOf(item, "image"), "이미지"), caption })).id;
    if (item.kind === "story") {
      const v = fileOf(item, "video");
      return (await call("POST", `/${uid}/media`, v ? { media_type: "STORIES", video_url: https(v, "영상") } : { media_type: "STORIES", image_url: https(fileOf(item, "image"), "이미지") })).id;
    }
    if (item.kind === "carousel") {
      const slides = item.files.filter((f) => f.role === "slide");
      if (slides.length < 2 || slides.length > CAPS.instagram.carousel.maxItems) throw Object.assign(new Error(`캐러셀은 2~${CAPS.instagram.carousel.maxItems}장입니다.`), { kind: "INVALID", retryable: false });
      const children = [];
      for (const s of slides) children.push((await call("POST", `/${uid}/media`, { image_url: https(s, "슬라이드"), is_carousel_item: "true" })).id);
      for (const c of children) await waitFinished(call, c);
      return (await call("POST", `/${uid}/media`, { media_type: "CAROUSEL", children: children.join(","), caption })).id;
    }
    throw Object.assign(new Error(`인스타그램이 받지 않는 형식: ${item.kind}`), { kind: "INVALID", retryable: false });
  }

  /** 게시 한도(24시간)를 먼저 확인 */
  async function quotaOk(call, uid) {
    try {
      const q = await call("GET", `/${uid}/content_publishing_limit`, { fields: "quota_usage,config" });
      const d = (q.data && q.data[0]) || {};
      if (d.config && Number(d.quota_usage) >= Number(d.config.quota_total)) throw Object.assign(new Error(`게시 한도 도달 (${d.quota_usage}/${d.config.quota_total}, 24시간)`), { kind: "RATE_LIMIT", retryable: true });
    } catch (e) {
      if (e.kind === "RATE_LIMIT" || e.kind === "TOKEN") throw e; // 한도 조회 자체가 안 되는 건 게시를 막지 않음
    }
  }

  async function findPublished(call, uid, item) {
    const first = finalCaption(item.copy).split("\n")[0];
    const recent = (await call("GET", `/${uid}/media`, { fields: "id,caption,timestamp", limit: "10" })).data || [];
    const hit = recent.find((m) => String(m.caption || "").split("\n")[0] === first);
    return hit ? { postId: hit.id } : null;
  }

  return {
    name: "instagram",
    mock: false,
    capabilities: () => CAPS.instagram,
    async publish(item, { save } = {}) {
      const { call, uid } = await session();
      await quotaOk(call, uid);
      const containerId = await container(call, uid, item);
      if (save) await save({ containerId });
      const st = await waitFinished(call, containerId);
      if (st === "PUBLISHED") return (await findPublished(call, uid, item)) || { postId: containerId };
      const mediaId = (await call("POST", `/${uid}/media_publish`, { creation_id: containerId })).id;
      if (save) await save({ platformId: mediaId });
      return { postId: mediaId };
    },
    /** 중간에 멈춘 게시 이어가기: 게시 id 가 있으면 끝난 것 · 컨테이너만 있으면 상태를 다시 물어 이어서 게시 */
    async resume(post, item) {
      if (post.platformId) return { postId: post.platformId };
      if (!post.containerId) return null;
      const { call, uid } = await session();
      let st;
      try {
        st = await waitFinished(call, post.containerId);
      } catch (e) {
        if (e.expired || e.kind === "MEDIA") return null; // 새 컨테이너로 다시
        throw e;
      }
      if (st === "PUBLISHED") return item ? findPublished(call, uid, item) : null;
      return { postId: (await call("POST", `/${uid}/media_publish`, { creation_id: post.containerId })).id };
    },
    async verify(postId) {
      const { call } = await session();
      const m = await call("GET", `/${postId}`, { fields: "id,permalink,media_product_type,timestamp" });
      return { ok: String(m.id) === String(postId), permalink: m.permalink || null, productType: m.media_product_type };
    },
    /** 게시물에 첫 댓글 (퀴즈 정답) — 권한 instagram_business_manage_comments */
    async comment(postId, text) {
      const { call } = await session();
      return { id: (await call("POST", `/${postId}/comments`, { message: String(text).slice(0, 2200) })).id };
    },
    /** 실제로 주는 지표만. 하나라도 지원 안 되면 요청 전체가 오류일 수 있어 지표별로 다시 묻는다 */
    async insights(postId) {
      const { call } = await session();
      const parse = (r) => (r.data || []).map((x) => ({ metric: x.name, value: x.values ? x.values[0].value : x.total_value ? x.total_value.value : null })).filter((x) => x.value != null);
      try {
        return parse(await call("GET", `/${postId}/insights`, { metric: METRICS.join(",") }));
      } catch (e) {
        if (e.kind !== "INVALID") throw e;
        const out = [];
        for (const m of METRICS) out.push(...(await call("GET", `/${postId}/insights`, { metric: m }).then(parse).catch(() => [])));
        return out;
      }
    },
    async health() {
      const st = await instagramStatus(store);
      if (!st.connected) return { ok: false, mode: "live", reason: "계정 연결 안 됨" };
      try {
        const { call } = await session();
        const me = await call("GET", "/me", { fields: "user_id,username,account_type,followers_count" });
        return { ok: true, mode: "live", username: me.username, accountType: me.account_type, followers: me.followers_count, daysLeft: st.daysLeft };
      } catch (e) {
        return { ok: false, mode: "live", reason: `${e.kind}: ${e.message}`, daysLeft: st.daysLeft };
      }
    },
  };
}

module.exports = { create, classify, connectInstagram, refreshInstagram, instagramStatus, finalCaption, METRICS };
