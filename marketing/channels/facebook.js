"use strict";
/*
 * Facebook 페이지 릴스 실제 게시 (CHANNEL_MODE_FACEBOOK=live) — 공식 Graph API Reels Publishing
 *  문서 (2026-11-10 확인, docs/API_RESEARCH.md §3):
 *   1) POST graph.facebook.com/{ver}/{page-id}/video_reels upload_phase=start → { video_id }
 *   2) POST rupload.facebook.com/video-upload/{ver}/{video_id}  Authorization: OAuth {페이지 토큰}, file_url: {공개 주소}
 *   3) POST …/video_reels upload_phase=finish, video_id, video_state=PUBLISHED, description
 *   상태: GET /{video_id}?fields=status (video_status · publishing_phase.status)
 *  권한 pages_show_list · pages_read_engagement · pages_manage_posts. 3~90초, 24시간 30건.
 *  토큰: 페이지 장기 토큰 (만료 없음) → GitHub Secret FACEBOOK_PAGE_TOKEN, 페이지 id FACEBOOK_PAGE_ID
 */
const { CAPS } = require("./caps");
const { classify } = require("./instagram");

const GRAPH = "https://graph.facebook.com";
const RUPLOAD = "https://rupload.facebook.com/video-upload";

function create({ env = process.env, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pollMs = 15000, pollMax = 12 } = {}) {
  const ver = env.FACEBOOK_API_VERSION || "v27.0";
  const page = String(env.FACEBOOK_PAGE_ID || "");
  const token = env.FACEBOOK_PAGE_TOKEN || "";
  const need = () => {
    if (!/^\d+$/.test(page) || !token) throw Object.assign(new Error("Facebook 페이지가 연결되지 않았습니다 (FACEBOOK_PAGE_ID · FACEBOOK_PAGE_TOKEN)."), { kind: "TOKEN", retryable: false });
  };
  async function req(url, init) {
    let res;
    try {
      res = await fetchImpl(url, init);
    } catch (e) {
      throw Object.assign(new Error(`Facebook 서버에 연결하지 못했습니다: ${String(e.message).split(token).join("***")}`), { kind: "NETWORK", retryable: true });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.error) throw classify(res.status, data && data.error);
    return data;
  }
  const graph = (method, path, params = {}) => {
    const qs = new URLSearchParams({ ...params, access_token: token });
    return method === "GET" ? req(`${GRAPH}/${ver}${path}?${qs}`, {}) : req(`${GRAPH}/${ver}${path}`, { method, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: qs.toString() });
  };
  async function waitPublished(videoId) {
    for (let i = 0; i < pollMax; i++) {
      const s = ((await graph("GET", `/${videoId}`, { fields: "status" })).status) || {};
      const pub = s.publishing_phase || {};
      if (pub.status === "completed" || pub.publish_status === "published") return true;
      if (["error", "upload_failed", "expired"].includes(s.video_status) || pub.status === "error") throw Object.assign(new Error(`Facebook 이 영상을 처리하지 못함: ${s.video_status || pub.status}`), { kind: "MEDIA", retryable: false });
      await sleep(pollMs);
    }
    throw Object.assign(new Error("Facebook 영상 처리 시간이 길어 다음 실행에서 이어서 확인"), { kind: "UNKNOWN", retryable: true });
  }
  const description = (copy) => [String(copy.caption || "").trim(), (copy.hashtags || []).join(" ")].filter(Boolean).join("\n\n");

  return {
    name: "facebook",
    mock: false,
    capabilities: () => CAPS.facebook,
    async publish(item, { save } = {}) {
      need();
      if (item.kind !== "reel") throw Object.assign(new Error(`Facebook 은 지금 릴스만 올립니다 (${item.kind})`), { kind: "INVALID", retryable: false });
      const video = (item.files || []).find((f) => f.role === "video");
      if (!video || !/^https:\/\//.test(video.url || "")) throw Object.assign(new Error("영상 공개 주소(https)가 없습니다."), { kind: "INVALID", retryable: false });
      const { video_id: videoId } = await graph("POST", `/${page}/video_reels`, { upload_phase: "start" });
      if (save) await save({ containerId: videoId });
      const up = await req(`${RUPLOAD}/${ver}/${videoId}`, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: video.url } });
      if (!up.success) throw Object.assign(new Error("Facebook 영상 올리기 실패"), { kind: "MEDIA", retryable: true });
      await graph("POST", `/${page}/video_reels`, { upload_phase: "finish", video_id: videoId, video_state: "PUBLISHED", description: description(item.copy) });
      await waitPublished(videoId);
      if (save) await save({ platformId: videoId });
      return { postId: videoId };
    },
    /** 영상 id 가 있으면 상태를 다시 물어 끝났으면 그대로 완료 (다시 올리지 않음) */
    async resume(post) {
      if (post.platformId) return { postId: post.platformId };
      if (!post.containerId) return null;
      need();
      try {
        await waitPublished(post.containerId);
        return { postId: post.containerId };
      } catch (e) {
        if (e.kind === "MEDIA") return null;
        throw e;
      }
    },
    async verify(postId) {
      need();
      const m = await graph("GET", `/${postId}`, { fields: "id,permalink_url" });
      const link = m.permalink_url ? (String(m.permalink_url).startsWith("http") ? m.permalink_url : `https://www.facebook.com${m.permalink_url}`) : null;
      return { ok: String(m.id) === String(postId), permalink: link };
    },
    /** 영상 지표: API 가 돌려주는 것만 (이름 그대로) */
    async insights(postId) {
      need();
      const r = await graph("GET", `/${postId}/video_insights`, {});
      return (r.data || []).map((x) => ({ metric: x.name, value: x.values && x.values[0] ? x.values[0].value : null })).filter((x) => typeof x.value === "number");
    },
    async followers() {
      need();
      return Number((await graph("GET", `/${page}`, { fields: "followers_count" })).followers_count);
    },
    async health() {
      if (!/^\d+$/.test(page) || !token) return { ok: false, mode: "live", reason: "페이지 연결 안 됨" };
      try {
        const p = await graph("GET", `/${page}`, { fields: "id,name" });
        return { ok: true, mode: "live", page: p.name };
      } catch (e) {
        return { ok: false, mode: "live", reason: `${e.kind}: ${e.message}` };
      }
    },
  };
}

module.exports = { create };
