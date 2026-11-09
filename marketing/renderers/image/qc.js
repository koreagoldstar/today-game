"use strict";
/*
 * 이미지 검수: 장마다 JPEG · 크기(피드 1080x1350, 스토리 1080x1920) · 8MB 이하 · 빈 그림 아님, 캐러셀 장수, 글자 넘침 없음
 */
const fs = require("fs");
const { probe } = require("../reel/encode");
const { imageSpread } = require("../reel/qc");
const { CAPS } = require("../../channels/caps");

function checkImages(render) {
  const checks = [];
  const add = (id, name, ok, reason) => checks.push({ id, name, ok: !!ok, reason: ok ? "" : reason });
  const files = render.files || [];
  if (render.kind === "carousel") add("i:count", "캐러셀 2~20장", files.length >= 2 && files.length <= CAPS.instagram.carousel.maxItems, `${files.length}장`);
  files.forEach((f, i) => {
    const n = `i${i + 1}`;
    const info = fs.existsSync(f.path) ? probe(f.path) : null;
    add(`${n}:open`, `${i + 1}번 그림 열림`, !!(info && info.width), "그림이 없거나 열 수 없음");
    if (!info || !info.width) return;
    add(`${n}:size`, `${i + 1}번 ${f.w}x${f.h} JPEG`, info.width === f.w && info.height === f.h && info.vcodec === "mjpeg", `${info.width}x${info.height} ${info.vcodec}`);
    const bytes = fs.statSync(f.path).size;
    add(`${n}:bytes`, `${i + 1}번 8MB 이하`, bytes <= CAPS.instagram.image.maxBytes, `${bytes} 바이트`);
    const spread = imageSpread(f.path);
    add(`${n}:blank`, `${i + 1}번 빈 그림 아님`, spread > 8, `밝기 차이 ${spread.toFixed(1)} (거의 한 색)`);
  });
  const over = (render.meta && render.meta.textOverflow) || [];
  add("text:overflow", "글자가 칸을 넘지 않음", !over.length, `넘친 문구: ${over.join(" / ")}`);
  return checks;
}

module.exports = { checkImages };
