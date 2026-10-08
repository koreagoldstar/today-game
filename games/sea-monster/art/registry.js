/*
 * 바다괴물 탐험대 — 괴물 그림 목록
 * monsters1.js … 가 ART[id] = draw(ctx, p) 로 채운다.
 */
export const ART = {};

/** 괴물 그리기 (없으면 물음표 동그라미) */
export function drawMonster(ctx, id, p) {
  const fn = ART[id];
  if (fn) fn(ctx, p);
  else {
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#6a7a9a";
    ctx.fill();
  }
}

/** 도감용 실루엣: 한 번 그린 뒤 그 모양만 단색으로 */
export function drawSilhouette(ctx, id, p, w, h, color = "#0b2a4a") {
  const c = document.createElement("canvas");
  const k = 2;
  c.width = w * k;
  c.height = h * k;
  const x = c.getContext("2d");
  x.scale(k, k);
  x.translate(w / 2, h / 2);
  drawMonster(x, id, p);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(-w, -h, w * 2, h * 2);
  ctx.drawImage(c, -w / 2, -h / 2, w, h);
}
