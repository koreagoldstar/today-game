"use strict";
/* 사이트 주소 + UTM — utm_source={채널}&utm_medium=organic&utm_campaign=todaygame_{kind}&utm_content={sourceId} */

const SITE = "https://www.todaygame.co.kr";

function utmLink(path, { channel, kind, sourceId }) {
  const u = new URL(path || "/", SITE);
  if (u.origin !== SITE) throw new Error(`사이트 밖 주소는 쓸 수 없습니다: ${path}`);
  u.searchParams.set("utm_source", channel);
  u.searchParams.set("utm_medium", "organic");
  u.searchParams.set("utm_campaign", `todaygame_${kind}`);
  u.searchParams.set("utm_content", sourceId);
  return u.toString();
}

module.exports = { SITE, utmLink };
