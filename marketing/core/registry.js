"use strict";
/*
 * 플러그인 등록 — 새 콘텐츠 유형 · 채널은 파일 하나 + register 한 줄로 붙는다.
 *   source     collect(ctx) → { sourceType, sourceId, facts, assets }
 *   renderer   kinds[] · render(source, template, ctx) → { kind, files[], meta } · (선택) qc(render, ctx) → checks[]
 *   copywriter write({ source, render, channels, recent, ctx }) → { [채널]: { caption, hashtags, link, title? } }
 *   channel    capabilities() · publish(item, { save }) · verify(postId) · insights(postId) · health() · (선택) resume(post)
 *   media      put(file, { contentId }) → { url, key }  (Meta 가 가져갈 공개 주소)
 *   notifier   notify(event, doc)  (승인 요청 · 실패 알림)
 */

const SHAPE = {
  source: ["collect"],
  renderer: ["render"],
  copywriter: ["write"],
  channel: ["capabilities", "publish", "verify", "insights", "health"],
  media: ["put"],
  notifier: ["notify"],
};

function createRegistry() {
  const maps = Object.fromEntries(Object.keys(SHAPE).map((t) => [t, new Map()]));

  function register(type, name, impl) {
    if (!SHAPE[type]) throw new Error(`모르는 플러그인 종류: ${type}`);
    const missing = SHAPE[type].filter((fn) => typeof (impl && impl[fn]) !== "function");
    if (missing.length) throw new Error(`${type} "${name}" 에 ${missing.join(", ")} 가 없습니다.`);
    if (type === "renderer" && !(Array.isArray(impl.kinds) && impl.kinds.length)) throw new Error(`renderer "${name}" 에 kinds 가 없습니다.`);
    maps[type].set(name, impl);
    return impl;
  }

  function get(type, name) {
    const impl = maps[type] && maps[type].get(name);
    if (!impl) throw Object.assign(new Error(`${type} "${name}" 가 등록되어 있지 않습니다.`), { code: "NO_PLUGIN" });
    return impl;
  }

  const has = (type, name) => !!(maps[type] && maps[type].has(name));
  const names = (type) => [...maps[type].keys()];

  return { register, get, has, names };
}

module.exports = { createRegistry, SHAPE };
