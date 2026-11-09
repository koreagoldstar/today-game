"use strict";
/*
 * 사이트 주소 + UTM — utm_source={채널}&utm_medium=organic&utm_campaign=todaygame_{kind}&utm_content={sourceId}
 * track(설정 trackClicks)이 켜져 있으면 /api/mkt-go 를 거쳐 콘텐츠 · 채널별 클릭을 센 뒤 같은 주소로 보낸다.
 * (api/mkt-go.js 가 운영에 배포된 뒤에만 켤 것 — 배포 전에 켜면 링크가 404)
 */

const SITE = "https://www.todaygame.co.kr";

function utmLink(path, { channel, kind, sourceId, track = false, contentId = null }) {
  const u = new URL(path || "/", SITE);
  if (u.origin !== SITE) throw new Error(`사이트 밖 주소는 쓸 수 없습니다: ${path}`);
  u.searchParams.set("utm_source", channel);
  u.searchParams.set("utm_medium", "organic");
  u.searchParams.set("utm_campaign", `todaygame_${kind}`);
  u.searchParams.set("utm_content", sourceId);
  if (track && contentId) return `${SITE}/api/mkt-go?${new URLSearchParams({ c: contentId, ch: channel, to: `${u.pathname}${u.search}` })}`;
  return u.toString();
}

module.exports = { SITE, utmLink };
