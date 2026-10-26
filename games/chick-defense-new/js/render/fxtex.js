/*
 * 효과용 부드러운 그림 (캔버스로 한 번 그려 다시 씀)
 *  glow: 가운데가 밝고 가장자리로 사라지는 원 · ring: 고리 · puff: 연기 뭉치 · spark: 반짝 별 · streak: 빛 줄기
 */
import { THREE } from "./kit.js";

const cache = new Map();
function make(key, size, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
export const glowTex = () =>
  make("glow", 128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.75)");
    g.addColorStop(0.6, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
export const ringTex = () =>
  make("ring", 256, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.62, "rgba(255,255,255,0.25)");
    g.addColorStop(0.86, "rgba(255,255,255,1)");
    g.addColorStop(0.93, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
export const puffTex = () =>
  make("puff", 128, (c, s) => {
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      const r = s * (0.18 + (i % 3) * 0.04);
      const x = s / 2 + Math.cos(a) * s * 0.14;
      const y = s / 2 + Math.sin(a) * s * 0.12;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(0.7, "rgba(255,255,255,0.3)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }
  });
export const sparkTex = () =>
  make("spark", 128, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, 0, m, m, m * 0.5);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    c.fillStyle = "rgba(255,255,255,0.9)";
    for (const [w, h] of [[s * 0.06, s * 0.92], [s * 0.92, s * 0.06]]) {
      const lg = c.createLinearGradient(m - w / 2, m - h / 2, m + w / 2, m + h / 2);
      c.beginPath();
      c.ellipse(m, m, w / 2, h / 2, 0, 0, Math.PI * 2);
      c.fill();
      void lg;
    }
  });
/** 둥근 원 (가장자리만 살짝 부드럽게) — 땅 표시 */
export const discTex = () =>
  make("disc", 128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, s * 0.36, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.8, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
/** 소용돌이 (포탈) */
export const swirlTex = () =>
  make("swirl", 256, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineCap = "round";
    for (let arm = 0; arm < 4; arm++) {
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const a = arm * (Math.PI / 2) + t * 4.2;
        const r = t * m * 0.95;
        c.lineWidth = 2 + (1 - t) * 8;
        const x = m + Math.cos(a) * r;
        const y = m + Math.sin(a) * r;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  });
