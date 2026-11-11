"use strict";
/*
 * YouTube Shorts 실제 게시 (CHANNEL_MODE_YOUTUBE=live) — 공식 YouTube Data API v3 videos.insert (이어 올리기)
 *  문서 (2026-11-10 확인, docs/API_RESEARCH.md §4):
 *   토큰: POST oauth2.googleapis.com/token (grant_type=refresh_token) — 범위 youtube.upload (+ 조회용 youtube.readonly)
 *   올리기: POST www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status (메타데이터 JSON)
 *          → Location 주소로 PUT 영상 바이트 → 영상 리소스 { id }
 *   할당량: Video Uploads 묶음 하루 100회. Shorts 는 따로 된 API 없음 (세로 짧은 영상).
 *  열쇠: GitHub Secrets YOUTUBE_CLIENT_ID · YOUTUBE_CLIENT_SECRET · YOUTUBE_REFRESH_TOKEN (로그 · 저장소에 남기지 않음)
 */
const { CAPS } = require("./caps");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const API = "https://www.googleapis.com/youtube/v3";

function classifyGoogle(status, body) {
  const err = (body && body.error) || {};
  const reason = (err.errors && err.errors[0] && err.errors[0].reason) || (typeof err === "string" ? err : "") || "";
  const msg = err.message || (body && body.error_description) || reason || `HTTP ${status}`;
  let kind = "UNKNOWN";
  if (status === 401 || reason === "invalid_grant" || reason === "authError") kind = "TOKEN";
  else if (/quotaExceeded|rateLimitExceeded|uploadLimitExceeded|userRateLimitExceeded/.test(reason) || status === 429) kind = "RATE_LIMIT";
  else if (status === 403) kind = "PERMISSION";
  else if (status === 400) kind = "INVALID";
  else if (status >= 500) kind = "NETWORK";
  return Object.assign(new Error(`YouTube: ${msg}`), { kind, status, reason, retryable: ["RATE_LIMIT", "NETWORK", "UNKNOWN"].includes(kind) });
}

function create({ env = process.env, fetchImpl = fetch } = {}) {
  const id = env.YOUTUBE_CLIENT_ID;
  const secret = env.YOUTUBE_CLIENT_SECRET;
  const refresh = env.YOUTUBE_REFRESH_TOKEN;
  const hide = (s) => [secret, refresh].filter(Boolean).reduce((t, x) => t.split(x).join("***"), String(s));
  async function req(url, init) {
    try {
      return await fetchImpl(url, init);
    } catch (e) {
      throw Object.assign(new Error(`YouTube 서버에 연결하지 못했습니다: ${hide(e.message)}`), { kind: "NETWORK", retryable: true });
    }
  }
  let cached = null;
  async function accessToken() {
    if (!id || !secret || !refresh) throw Object.assign(new Error("YouTube 가 연결되지 않았습니다 (YOUTUBE_CLIENT_ID · YOUTUBE_CLIENT_SECRET · YOUTUBE_REFRESH_TOKEN)."), { kind: "TOKEN", retryable: false });
    if (cached && cached.until > Date.now() + 60000) return cached.token;
    const res = await req(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }).toString() });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.access_token) throw classifyGoogle(res.status, data);
    cached = { token: data.access_token, until: Date.now() + Number(data.expires_in || 3600) * 1000 };
    return cached.token;
  }
  async function get(path, params) {
    const res = await req(`${API}${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw classifyGoogle(res.status, data);
    return data;
  }
  /** 영상 파일: 로컬에 있으면 그것, 없으면(Actions 의 게시 단계) Blob 공개 주소에서 받는다 */
  async function videoBytes(item) {
    const v = (item.files || []).find((f) => f.role === "video");
    if (!v) throw Object.assign(new Error("영상이 없습니다."), { kind: "INVALID", retryable: false });
    const fs = require("fs");
    if (v.path && fs.existsSync(v.path)) return fs.readFileSync(v.path);
    if (!/^https:\/\//.test(v.url || "")) throw Object.assign(new Error("영상 파일 · 공개 주소가 없습니다."), { kind: "INVALID", retryable: false });
    const res = await req(v.url, {});
    if (!res.ok) throw Object.assign(new Error(`영상을 내려받지 못함 (HTTP ${res.status})`), { kind: "NETWORK", retryable: true });
    return Buffer.from(await res.arrayBuffer());
  }

  return {
    name: "youtube",
    mock: false,
    capabilities: () => CAPS.youtube,
    async publish(item, { save } = {}) {
      if (item.kind !== "reel") throw Object.assign(new Error(`YouTube 는 영상만 올립니다 (${item.kind})`), { kind: "INVALID", retryable: false });
      const bytes = await videoBytes(item);
      const c = item.copy;
      const meta = {
        snippet: { title: String(c.title || c.caption.split("\n")[0]).slice(0, 100), description: [c.caption, (c.hashtags || []).join(" ")].filter(Boolean).join("\n\n").slice(0, 5000), tags: (c.hashtags || []).map((t) => t.replace(/^#/, "")).slice(0, 15), categoryId: "20" }, // 20 = 게임
        status: { privacyStatus: env.YOUTUBE_PRIVACY || "public", selfDeclaredMadeForKids: false },
      };
      const token = await accessToken();
      const init = await req(UPLOAD_URL, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(bytes.length), "X-Upload-Content-Type": "video/mp4" }, body: JSON.stringify(meta) });
      const location = init.headers && init.headers.get && init.headers.get("location");
      if (!init.ok || !location) throw classifyGoogle(init.status, await init.json().catch(() => null));
      const up = await req(location, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4", "Content-Length": String(bytes.length) }, body: bytes });
      const video = await up.json().catch(() => null);
      if (!up.ok || !video || !video.id) throw classifyGoogle(up.status, video);
      if (save) await save({ platformId: video.id });
      return { postId: video.id };
    },
    async resume(post) {
      return post.platformId ? { postId: post.platformId } : null; // 올리기 도중 끊기면 처음부터 (영상 id 를 받기 전에는 올라간 것이 없음)
    },
    async verify(postId) {
      const r = await get("/videos", { part: "id,status", id: postId });
      const v = (r.items || [])[0];
      return { ok: !!v && v.id === postId && v.status.uploadStatus !== "rejected" && v.status.uploadStatus !== "failed", permalink: v ? `https://www.youtube.com/shorts/${v.id}` : null, privacy: v && v.status.privacyStatus };
    },
    /** 공개 통계만 (조회 · 좋아요 · 댓글). Analytics API 는 쓰지 않음 */
    async insights(postId) {
      const r = await get("/videos", { part: "statistics", id: postId });
      const s = ((r.items || [])[0] || {}).statistics || {};
      return [["views", s.viewCount], ["likes", s.likeCount], ["comments", s.commentCount]].filter(([, v]) => v != null).map(([metric, v]) => ({ metric, value: Number(v) }));
    },
    /** 구독자 수 (채널이 숨겼으면 없음) */
    async followers() {
      const r = await get("/channels", { part: "statistics", mine: "true" });
      const s = ((r.items || [])[0] || {}).statistics || {};
      return s.hiddenSubscriberCount ? NaN : Number(s.subscriberCount);
    },
    async health() {
      try {
        const r = await get("/channels", { part: "snippet", mine: "true" });
        const ch = (r.items || [])[0];
        return ch ? { ok: true, mode: "live", channel: ch.snippet.title } : { ok: false, mode: "live", reason: "채널 없음" };
      } catch (e) {
        return { ok: false, mode: "live", reason: `${e.kind}: ${e.message}` };
      }
    },
  };
}

module.exports = { create, classifyGoogle };
