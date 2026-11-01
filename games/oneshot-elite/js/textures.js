/*
 * 캔버스로 그리는 실사풍 텍스처 (외부 그림 파일 없음)
 *  외벽 한 장 = 창 4칸 × 4층 (1칸 3.2 m · 1층 3.4 m) — 창문 자리 · 크기는 모든 외벽이 같아서
 *  건물에 '열린 창'(진짜 구멍)을 낼 때 그림 속 창과 정확히 겹친다.
 *  외벽마다 색 · 거칠기/금속(유리는 매끈해서 하늘을 비춤) · 노멀(창틀 · 벽돌이 도드라짐) · 밤 불빛을 함께 만든다.
 */
import { canvas, tex, rng, pick, grime, speckle, normalFrom } from "./kit.js";

export const BAY = 3.2;
export const FLOOR = 3.4;
export const GROUND = 4.4;
export const WIN_W = 1.3;
export const WIN_H = 1.9;
export const WIN_Y = 0.95;
export const TILE_W = BAY * 4;
export const TILE_H = FLOOR * 4;
let PX = 64; // 1 m = 64 px
export function setTexQuality(q) {
  PX = q === "high" ? 64 : q === "mid" ? 44 : 30;
}

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/* ---------- 공용 붓 ---------- */
/** 얼룩 층: 작은 잡음을 부드럽게 늘려 덮음 */
function blotch(g, W, H, r, cells, alpha, op = "overlay") {
  const cw = Math.max(2, cells);
  const ch = Math.max(2, Math.round((cells * H) / W));
  const sc = canvas(cw, ch);
  const sg = sc.getContext("2d");
  const im = sg.createImageData(cw, ch);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = r() * 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 255;
  }
  sg.putImageData(im, 0, 0);
  g.save();
  g.globalCompositeOperation = op;
  g.globalAlpha = alpha;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(sc, 0, 0, W, H);
  g.restore();
}
/** 화소 하나하나 잔 무늬 */
function fineNoise(g, W, H, r, amt) {
  const im = g.getImageData(0, 0, W, H);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(im, 0, 0);
}
/** 비 자국 (위에서 아래로 흘러내린 때) */
function streak(g, x, y, w, h, a, col = "28,24,20") {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, `rgba(${col},${a})`);
  gr.addColorStop(0.5, `rgba(${col},${a * 0.45})`);
  gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
}
const GRAY = (v) => `rgb(${v},${v},${v})`;
/** 거칠기 · 금속 (G · B 채널) */
const ORM = (rough, metal) => `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;

/* ---------- 외벽 스타일 ---------- */
export const FACADES = {
  paris: { wall: "#b9b1a0", dark: "#8f8878", frame: "#cdc8bb", trim: "#c4bdac", rail: "#17191b", glass: "#3a434b", kind: "stone" },
  brick: { wall: "#6e4235", dark: "#4f2f26", frame: "#b5ac9c", trim: "#9f978a", rail: null, glass: "#353f47", kind: "brick" },
  stucco: { wall: "#a8987e", dark: "#7f735f", frame: "#bcb4a2", trim: "#a39a86", rail: "#1c1d1e", glass: "#3a454d", kind: "plaster", shutter: "#3f4a42" },
  sand: { wall: "#a39880", dark: "#7c735f", frame: "#a8a08e", trim: "#8f8772", rail: null, glass: "#384249", kind: "concrete" },
  modern: { wall: "#3b444b", dark: "#262c31", frame: "#23282c", trim: "#4a5359", rail: null, glass: "#4d5b66", kind: "curtain" },
  office: { wall: "#8c8b86", dark: "#62625d", frame: "#2d3134", trim: "#9b9a94", rail: null, glass: "#414d57", kind: "ribbon" },
  adobe: { wall: "#8f7554", dark: "#6f583d", frame: "#3a2d20", trim: "#7f6849", rail: null, glass: "#1f1b17", kind: "plaster" },
  brutal: { wall: "#7f7e79", dark: "#55554f", frame: "#2c2e30", trim: "#8f8e88", rail: null, glass: "#3b4650", kind: "brutal" },
};

function drawWall(g, h, W, H, s, r) {
  g.fillStyle = s.wall;
  g.fillRect(0, 0, W, H);
  h.fillStyle = GRAY(150);
  h.fillRect(0, 0, W, H);
  const m = (v) => v * PX;
  if (s.kind === "brick") {
    const bh = Math.max(3, m(0.085));
    const bw = Math.max(9, m(0.25));
    let row = 0;
    for (let y = 0; y < H; y += bh, row++) {
      const off = row % 2 ? 0 : bw / 2;
      for (let x = -off; x < W; x += bw) {
        const k = r();
        g.fillStyle = k < 0.45 ? s.wall : k < 0.8 ? s.dark : "#7c4e3e";
        g.fillRect(x + 1, y + 1, bw - 1.5, bh - 1.5);
        h.fillStyle = GRAY(150 + r() * 40);
        h.fillRect(x + 1, y + 1, bw - 1.5, bh - 1.5);
      }
      g.fillStyle = "rgba(150,140,125,0.55)";
      g.fillRect(0, y, W, 1);
      h.fillStyle = GRAY(90);
      h.fillRect(0, y, W, 1);
    }
  } else if (s.kind === "stone") {
    // 돌 쌓기: 켜 · 세로 이음
    const ch = m(0.56);
    let row = 0;
    for (let y = 0; y < H; y += ch, row++) {
      const off = row % 2 ? 0 : m(0.6);
      g.fillStyle = "rgba(50,44,36,0.4)";
      g.fillRect(0, y, W, Math.max(1, m(0.022)));
      h.fillStyle = GRAY(85);
      h.fillRect(0, y, W, Math.max(1, m(0.03)));
      for (let x = off; x < W; x += m(1.2)) {
        g.fillStyle = "rgba(50,44,36,0.32)";
        g.fillRect(x, y, Math.max(1, m(0.018)), ch);
        h.fillStyle = GRAY(95);
        h.fillRect(x, y, Math.max(1, m(0.025)), ch);
        g.fillStyle = `rgba(${r() < 0.5 ? "255,250,235" : "40,36,30"},${r() * 0.1})`;
        g.fillRect(x, y, m(1.2), ch);
      }
    }
  } else if (s.kind === "plaster") {
    // 벗겨진 회벽 · 금
    for (let i = 0; i < 16; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = m(0.3 + r() * 1.1);
      g.fillStyle = `rgba(${pick(r, ["120,108,90", "160,150,130", "95,85,72"])},0.35)`;
      h.fillStyle = GRAY(120);
      for (const t of [g, h]) {
        t.beginPath();
        for (let a = 0; a < 9; a++) {
          const ang = (a / 9) * Math.PI * 2;
          const rr = rad * (0.55 + r() * 0.6);
          const px = x + Math.cos(ang) * rr * 1.5;
          const py = y + Math.sin(ang) * rr;
          if (a) t.lineTo(px, py);
          else t.moveTo(px, py);
        }
        t.closePath();
        t.fill();
      }
    }
    g.strokeStyle = "rgba(30,26,22,0.4)";
    h.strokeStyle = GRAY(70);
    for (let i = 0; i < 22; i++) {
      let x = r() * W;
      let y = r() * H;
      g.beginPath();
      h.beginPath();
      g.moveTo(x, y);
      h.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        x += (r() - 0.5) * m(0.5);
        y += r() * m(0.4);
        g.lineTo(x, y);
        h.lineTo(x, y);
      }
      g.lineWidth = 1;
      h.lineWidth = 1.5;
      g.stroke();
      h.stroke();
    }
  } else {
    // 콘크리트: 거푸집 이음 · 작은 구멍
    const pw = m(1.6);
    const ph = m(1.13);
    for (let y = 0; y < H; y += ph) {
      g.fillStyle = "rgba(25,25,22,0.32)";
      g.fillRect(0, y, W, 1.5);
      h.fillStyle = GRAY(100);
      h.fillRect(0, y, W, 2);
    }
    for (let x = 0; x < W; x += pw) {
      g.fillStyle = "rgba(25,25,22,0.26)";
      g.fillRect(x, 0, 1.5, H);
      h.fillStyle = GRAY(105);
      h.fillRect(x, 0, 2, H);
      for (let y = ph / 2; y < H; y += ph) {
        g.fillStyle = "rgba(15,15,13,0.55)";
        g.fillRect(x + pw / 2 - 1.5, y - 1.5, 3, 3);
      }
    }
  }
  blotch(g, W, H, r, 7, 0.34);
  blotch(g, W, H, r, 26, 0.22);
  blotch(g, W, H, r, 90, 0.14);
  blotch(h, W, H, r, 60, 0.12);
}

/** 창 하나: 들어간 턱(그림자) · 틀 · 유리 · 커튼/블라인드 · 창턱 */
function drawWindow(g, h, o, e, x, y, w, ht, s, r, night) {
  const m = (v) => v * PX;
  const reveal = m(0.13);
  const fr = m(0.05);
  // 벽에 파인 턱 (위는 어둡고 옆은 중간)
  g.fillStyle = "rgba(14,13,12,0.82)";
  g.fillRect(x - reveal * 0.5, y - reveal * 0.5, w + reveal, ht + reveal);
  h.fillStyle = GRAY(48);
  h.fillRect(x - reveal * 0.5, y - reveal * 0.5, w + reveal, ht + reveal);
  // 유리 (실내 어두움 · 유리 색이 하늘 반사를 물들임)
  const roll = r();
  const gr = g.createLinearGradient(x, y, x, y + ht);
  gr.addColorStop(0, night ? "#0b0e14" : s.glass);
  gr.addColorStop(1, night ? "#0b0e14" : s.glass);
  g.fillStyle = gr;
  g.fillRect(x, y, w, ht);
  o.fillStyle = ORM(0.05 + r() * 0.05, 0.92);
  o.fillRect(x, y, w, ht);
  h.fillStyle = GRAY(58 + r() * 8);
  h.fillRect(x, y, w, ht);
  // 창틀 안쪽 그림자 (위 턱이 유리에 드리움)
  const sh = g.createLinearGradient(0, y, 0, y + m(0.3));
  sh.addColorStop(0, "rgba(0,0,0,0.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sh;
  g.fillRect(x, y, w, m(0.3));
  if (!night) {
    if (roll < 0.28) {
      // 커튼 양쪽 (매트)
      const cc = pick(r, ["#a59a84", "#8f8675", "#6f6a60", "#7a6256"]);
      for (const [cx, cw] of [
        [x, w * 0.27],
        [x + w * 0.73, w * 0.27],
      ]) {
        g.fillStyle = cc;
        g.fillRect(cx, y, cw, ht);
        o.fillStyle = ORM(0.92, 0);
        o.fillRect(cx, y, cw, ht);
        for (let fx = cx; fx < cx + cw; fx += m(0.06)) {
          g.fillStyle = "rgba(0,0,0,0.14)";
          g.fillRect(fx, y, 1.2, ht);
        }
      }
    } else if (roll < 0.46) {
      // 블라인드 (위쪽 일부)
      const bh = ht * (0.2 + r() * 0.55);
      g.fillStyle = "#9f9b90";
      g.fillRect(x, y, w, bh);
      o.fillStyle = ORM(0.85, 0);
      o.fillRect(x, y, w, bh);
      g.fillStyle = "rgba(0,0,0,0.2)";
      for (let yy = y; yy < y + bh; yy += m(0.05)) g.fillRect(x, yy, w, 1);
    } else if (roll < 0.56) {
      // 불 꺼진 안쪽이 비치는 창 (덜 반사)
      o.fillStyle = ORM(0.12, 0.5);
      o.fillRect(x, y, w, ht);
      g.fillStyle = "rgba(0,0,0,0.5)";
      g.fillRect(x, y, w, ht);
    }
  }
  // 틀
  const fc = s.frame;
  g.fillStyle = fc;
  o.fillStyle = ORM(0.6, 0.15);
  h.fillStyle = GRAY(130);
  const bars = [
    [x - fr, y - fr, w + fr * 2, fr],
    [x - fr, y + ht, w + fr * 2, fr],
    [x - fr, y - fr, fr, ht + fr * 2],
    [x + w, y - fr, fr, ht + fr * 2],
    [x + w / 2 - fr * 0.45, y, fr * 0.9, ht],
    [x, y + ht * 0.4, w, fr * 0.7],
  ];
  for (const [a, b, c, d] of bars) {
    g.fillRect(a, b, c, d);
    o.fillRect(a, b, c, d);
    h.fillRect(a, b, c, d);
  }
  // 창턱 + 아래로 흐른 때
  const sill = m(0.08);
  g.fillStyle = s.trim;
  g.fillRect(x - m(0.12), y + ht + fr, w + m(0.24), sill);
  h.fillStyle = GRAY(215);
  h.fillRect(x - m(0.12), y + ht + fr, w + m(0.24), sill);
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.fillRect(x - m(0.12), y + ht + fr, w + m(0.24), 1.5);
  g.fillStyle = "rgba(0,0,0,0.4)";
  g.fillRect(x - m(0.12), y + ht + fr + sill, w + m(0.24), 2);
  streak(g, x - m(0.06), y + ht + fr + sill, m(0.16), m(0.6 + r() * 0.9), 0.3);
  streak(g, x + w - m(0.1), y + ht + fr + sill, m(0.16), m(0.6 + r() * 0.9), 0.3);
  // 위 인방 돌 (돌 · 벽돌 벽)
  if (s.kind === "stone" || s.kind === "brick" || s.kind === "plaster") {
    g.fillStyle = s.trim;
    g.fillRect(x - m(0.14), y - fr - m(0.16), w + m(0.28), m(0.16));
    h.fillStyle = GRAY(205);
    h.fillRect(x - m(0.14), y - fr - m(0.16), w + m(0.28), m(0.16));
    g.fillStyle = "rgba(0,0,0,0.32)";
    g.fillRect(x - m(0.14), y - fr, w + m(0.28), 2);
  }
  // 밤: 켜진 창
  if (e && r() < 0.36) {
    const warm = r() < 0.8;
    const eg = e.createLinearGradient(x, y, x, y + ht);
    eg.addColorStop(0, warm ? "#ffd493" : "#cfe2ff");
    eg.addColorStop(1, warm ? "#e29a4c" : "#86aee0");
    e.fillStyle = eg;
    e.fillRect(x, y, w, ht);
    e.fillStyle = "rgba(0,0,0,0.6)";
    if (r() < 0.55) {
      e.fillRect(x, y, w * 0.26, ht);
      e.fillRect(x + w * 0.74, y, w * 0.26, ht);
    }
    e.fillRect(x + w / 2 - fr * 0.45, y, fr * 0.9, ht);
    e.fillRect(x, y + ht * 0.4, w, fr * 0.7);
    g.fillStyle = warm ? "rgba(255,190,110,0.5)" : "rgba(170,200,255,0.4)";
    g.fillRect(x, y, w, ht);
  }
}

/** 외벽 텍스처 (낮 · 밤) */
export function facade(style, seed = 1, night = false) {
  return cached(`f-${style}-${seed}-${night}-${PX}`, () => {
    const s = FACADES[style];
    const r = rng(seed * 31 + style.length);
    const m = (v) => v * PX;
    const W = Math.round(TILE_W * PX);
    const H = Math.round(TILE_H * PX);
    const c = canvas(W, H);
    const g = c.getContext("2d");
    const hc = canvas(W, H);
    const h = hc.getContext("2d");
    const oc = canvas(W, H);
    const o = oc.getContext("2d");
    drawWall(g, h, W, H, s, r);
    o.fillStyle = ORM(s.kind === "curtain" ? 0.5 : 0.92, s.kind === "curtain" ? 0.4 : 0);
    o.fillRect(0, 0, W, H);
    const ec = night ? canvas(W, H) : null;
    const e = ec ? ec.getContext("2d") : null;
    if (e) {
      e.fillStyle = "#000";
      e.fillRect(0, 0, W, H);
    }
    for (let j = 0; j < 4; j++) {
      const floorY = H - j * FLOOR * PX;
      for (let i = 0; i < 4; i++) {
        const bx = i * BAY * PX;
        const x = (i * BAY + (BAY - WIN_W) / 2) * PX;
        const y = floorY - (WIN_Y + WIN_H) * PX;
        const w = WIN_W * PX;
        const ht = WIN_H * PX;
        if (s.kind === "curtain") {
          // 유리 커튼월: 판마다 살짝 기울어 반사가 어긋남
          const px = bx + m(0.05);
          const pw = BAY * PX - m(0.1);
          const py = floorY - FLOOR * PX + m(0.3);
          const pht = FLOOR * PX - m(0.42);
          g.fillStyle = s.glass;
          g.fillRect(px, py, pw, pht);
          g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.22})`;
          g.fillRect(px, py, pw, pht);
          o.fillStyle = ORM(0.05 + r() * 0.05, 0.95);
          o.fillRect(px, py, pw, pht);
          const tilt = h.createLinearGradient(px, py, px + pw * (0.4 + r()), py + pht * r());
          const v = 120 + r() * 30;
          tilt.addColorStop(0, GRAY(Math.round(v - 8 - r() * 8)));
          tilt.addColorStop(1, GRAY(Math.round(v + 8 + r() * 8)));
          h.fillStyle = tilt;
          h.fillRect(px, py, pw, pht);
          g.fillStyle = "#14171a";
          g.fillRect(bx + BAY * PX / 2 - 1, py, 2, pht);
          h.fillStyle = GRAY(170);
          h.fillRect(bx + BAY * PX / 2 - 1, py, 2, pht);
          if (e && r() < 0.34) {
            e.fillStyle = r() < 0.7 ? "#e8c896" : "#bcd4ee";
            e.fillRect(px, py, pw, pht);
            e.fillStyle = "rgba(0,0,0,0.45)";
            for (let yy = py; yy < py + pht; yy += m(0.2)) e.fillRect(px, yy, pw, 2);
          }
          continue;
        }
        if (s.kind === "ribbon") {
          // 길게 이어진 띠창 (구멍 자리와 같은 높이)
          const py = y - m(0.06);
          const pht = ht + m(0.12);
          g.fillStyle = "rgba(10,10,10,0.9)";
          g.fillRect(bx, py - m(0.08), BAY * PX, pht + m(0.16));
          g.fillStyle = s.glass;
          g.fillRect(bx, py, BAY * PX, pht);
          o.fillStyle = ORM(0.06 + r() * 0.04, 0.92);
          o.fillRect(bx, py, BAY * PX, pht);
          h.fillStyle = GRAY(55);
          h.fillRect(bx, py - m(0.08), BAY * PX, pht + m(0.16));
          g.fillStyle = s.frame;
          h.fillStyle = GRAY(120);
          o.fillStyle = ORM(0.55, 0.3);
          // 판마다 반사가 조금씩 다름
          for (let q = 0; q < 4; q++) {
            g.fillStyle = `rgba(0,0,0,${r() * 0.3})`;
            g.fillRect(bx + (q * BAY * PX) / 4, py, (BAY * PX) / 4, pht);
            g.fillStyle = s.frame;
          }
          for (const fx of [bx, bx + (BAY * PX) / 4, bx + (BAY * PX) / 2 - m(0.02), bx + (BAY * PX * 3) / 4, bx + ((BAY - WIN_W) / 2) * PX - m(0.04), x + w]) {
            g.fillRect(fx, py, m(0.05), pht);
            h.fillRect(fx, py, m(0.05), pht);
            o.fillRect(fx, py, m(0.05), pht);
          }
          streak(g, bx + r() * BAY * PX, py + pht + m(0.08), m(0.2), m(0.9), 0.28);
          if (e && r() < 0.34) {
            e.fillStyle = r() < 0.7 ? "#f0c98c" : "#c5dcf5";
            e.fillRect(bx + m(0.06), py, BAY * PX - m(0.1), pht);
          }
          continue;
        }
        if (s.kind === "brutal") {
          // 깊이 파인 칸 + 세로 지느러미
          const px = bx + m(0.45);
          const pw = BAY * PX - m(0.9);
          const py = floorY - FLOOR * PX + m(0.3);
          const pht = FLOOR * PX - m(0.75);
          g.fillStyle = "rgba(20,20,18,0.72)";
          g.fillRect(px, py, pw, pht);
          h.fillStyle = GRAY(45);
          h.fillRect(px, py, pw, pht);
          streak(g, px, py + pht, m(0.22), m(1.6), 0.34);
          streak(g, px + pw - m(0.22), py + pht, m(0.22), m(1.6), 0.34);
          streak(g, bx + m(0.1), floorY - FLOOR * PX, m(0.2), m(1.8), 0.2, "60,40,25");
        }
        if (s.shutter) {
          g.fillStyle = s.shutter;
          h.fillStyle = GRAY(190);
          for (const sx of [x - m(0.42), x + w + m(0.14)]) {
            g.fillRect(sx, y, m(0.28), ht);
            h.fillRect(sx, y, m(0.28), ht);
            g.fillStyle = s.shutter;
            for (let yy = y; yy < y + ht; yy += m(0.07)) {
              g.fillStyle = "rgba(0,0,0,0.3)";
              g.fillRect(sx, yy, m(0.28), 1.2);
              g.fillStyle = s.shutter;
            }
          }
        }
        drawWindow(g, h, o, e, x, y, w, ht, s, r, night);
        // 철제 난간
        if (s.rail && (j === 1 || j === 3)) {
          const ry = y + ht * 0.58;
          g.strokeStyle = s.rail;
          g.lineWidth = Math.max(1, m(0.022));
          g.strokeRect(x - m(0.05), ry, w + m(0.1), y + ht - ry);
          for (let xx = x; xx < x + w; xx += m(0.11)) {
            g.beginPath();
            g.moveTo(xx, ry);
            g.lineTo(xx, y + ht);
            g.stroke();
          }
        }
      }
      // 층 띠 · 처마 (밝은 위 · 그림자 아래)
      const bandY = floorY - m(0.14);
      if (s.kind !== "curtain") {
        g.fillStyle = s.trim;
        g.fillRect(0, bandY, W, m(0.14));
        h.fillStyle = GRAY(205);
        h.fillRect(0, bandY, W, m(0.14));
        g.fillStyle = "rgba(0,0,0,0.42)";
        g.fillRect(0, floorY, W, m(0.03));
        for (let i = 0; i < 7; i++) streak(g, r() * W, floorY, m(0.1 + r() * 0.3), m(0.5 + r() * 1.5), 0.18);
      } else {
        g.fillStyle = "#1a1e22";
        g.fillRect(0, floorY - m(0.15), W, m(0.28));
        h.fillStyle = GRAY(175);
        h.fillRect(0, floorY - m(0.15), W, m(0.28));
      }
    }
    // 큰 비 자국
    if (s.kind !== "curtain") for (let i = 0; i < 18; i++) streak(g, r() * W, r() * H * 0.6, m(0.1 + r() * 0.6), m(1.5 + r() * 5), 0.11);
    fineNoise(g, W, H, r, 10);
    fineNoise(h, W, H, r, 8);
    return { map: tex(c), orm: tex(oc, { srgb: false }), normal: normalFrom(hc, 2.6), emissive: ec ? tex(ec) : null };
  });
}

const SHOP_NAMES = ["CAFÉ", "BAKERY", "BOOKS", "FLOWERS", "PHARMACY", "BISTRO", "HOTEL", "MARKET", "GALLERY", "TAILOR", "WINE", "DELI", "BANK", "OPTIC"];
const AWN = ["#5c2a28", "#27394f", "#2a4238", "#6b4e27", "#3b2e45", "#232323", "#5f3540"];

/** 1층 가게 줄 (4칸 × 4.4 m) */
export function shopfront(seed = 1, night = false) {
  return cached(`s-${seed}-${night}-${PX}`, () => {
    const r = rng(seed * 97 + 5);
    const m = (v) => v * PX;
    const W = Math.round(TILE_W * PX);
    const H = Math.round(GROUND * PX);
    const c = canvas(W, H);
    const g = c.getContext("2d");
    const hc = canvas(W, H);
    const h = hc.getContext("2d");
    const oc = canvas(W, H);
    const o = oc.getContext("2d");
    const ec = night ? canvas(W, H) : null;
    const e = ec ? ec.getContext("2d") : null;
    if (e) {
      e.fillStyle = "#000";
      e.fillRect(0, 0, W, H);
    }
    g.fillStyle = "#3b3936";
    g.fillRect(0, 0, W, H);
    h.fillStyle = GRAY(170);
    h.fillRect(0, 0, W, H);
    o.fillStyle = ORM(0.85, 0);
    o.fillRect(0, 0, W, H);
    blotch(g, W, H, r, 18, 0.3);
    for (let i = 0; i < 4; i++) {
      const x0 = i * BAY * PX;
      const bw = BAY * PX;
      const awn = pick(r, AWN);
      // 간판
      g.fillStyle = "#23221f";
      g.fillRect(x0 + m(0.1), m(0.16), bw - m(0.2), m(0.42));
      g.fillStyle = "#b8ad97";
      g.font = `bold ${Math.round(m(0.27))}px Georgia, serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(pick(r, SHOP_NAMES), x0 + bw / 2, m(0.38));
      // 진열창 (반사)
      const gy = m(0.95);
      const gh = H - gy - m(0.28);
      g.fillStyle = "#4a5a66";
      g.fillRect(x0 + m(0.12), gy, bw - m(0.24), gh);
      o.fillStyle = ORM(0.07, 0.9);
      o.fillRect(x0 + m(0.12), gy, bw - m(0.24), gh);
      h.fillStyle = GRAY(70);
      h.fillRect(x0 + m(0.12), gy, bw - m(0.24), gh);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = `hsla(${Math.floor(r() * 360)},18%,${28 + r() * 18}%,0.8)`;
        g.fillRect(x0 + m(0.22) + r() * (bw - m(0.65)), gy + gh * 0.55 + r() * gh * 0.3, m(0.13 + r() * 0.2), m(0.13 + r() * 0.3));
      }
      // 문
      if (r() < 0.5) {
        g.fillStyle = "#1c1815";
        g.fillRect(x0 + bw - m(0.75), gy + m(0.08), m(0.55), gh - m(0.08));
        o.fillStyle = ORM(0.5, 0.1);
        o.fillRect(x0 + bw - m(0.75), gy + m(0.08), m(0.55), gh - m(0.08));
        g.fillStyle = "#9a8552";
        g.fillRect(x0 + bw - m(0.28), gy + gh * 0.55, 3, m(0.16));
      }
      // 차양
      g.fillStyle = awn;
      g.fillRect(x0 + m(0.06), m(0.62), bw - m(0.12), m(0.28));
      h.fillStyle = GRAY(215);
      h.fillRect(x0 + m(0.06), m(0.62), bw - m(0.12), m(0.28));
      g.fillStyle = "rgba(255,255,255,0.1)";
      for (let xx = x0 + m(0.06); xx < x0 + bw - m(0.06); xx += m(0.26)) g.fillRect(xx, m(0.62), m(0.13), m(0.28));
      const sh = g.createLinearGradient(0, gy, 0, gy + m(0.5));
      sh.addColorStop(0, "rgba(0,0,0,0.6)");
      sh.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sh;
      g.fillRect(x0 + m(0.12), gy, bw - m(0.24), m(0.5));
      if (e) {
        const gg = e.createLinearGradient(0, gy, 0, gy + gh);
        gg.addColorStop(0, "#ffe7bd");
        gg.addColorStop(1, "#d99a52");
        e.fillStyle = gg;
        e.fillRect(x0 + m(0.12), gy, bw - m(0.24), gh);
        e.fillStyle = "#c9b48c";
        e.fillRect(x0 + m(0.1), m(0.16), bw - m(0.2), m(0.42));
      }
    }
    fineNoise(g, W, H, r, 8);
    return { map: tex(c), orm: tex(oc, { srgb: false }), normal: normalFrom(hc, 2), emissive: ec ? tex(ec) : null };
  });
}

/* ---------- 바닥 · 재료 ---------- */
function pbr(key, size, base, fn, strength = 2) {
  return cached(key, () => {
    const c = canvas(size, size);
    const g = c.getContext("2d");
    const hc = canvas(size, size);
    const h = hc.getContext("2d");
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    h.fillStyle = GRAY(128);
    h.fillRect(0, 0, size, size);
    const r = rng(key.length * 77 + size);
    fn(g, h, size, r);
    return { map: tex(c), normal: normalFrom(hc, strength) };
  });
}

export const roofPBR = () =>
  pbr("roof", 512, "#55534e", (g, h, s, r) => {
    blotch(g, s, s, r, 5, 0.4);
    blotch(g, s, s, r, 24, 0.3);
    // 방수 시트 이음
    for (let y = 0; y < s; y += 128) {
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.fillRect(0, y, s, 2);
      h.fillStyle = GRAY(190);
      h.fillRect(0, y - 2, s, 5);
    }
    // 때움 자국
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(20,20,20,${0.15 + r() * 0.25})`;
      g.fillRect(r() * s, r() * s, 20 + r() * 80, 12 + r() * 50);
    }
    grime(g, s, s, r, 16, 0.22);
    fineNoise(g, s, s, r, 26);
    fineNoise(h, s, s, r, 40);
  });

export const asphaltPBR = () =>
  pbr("asphalt", 1024, "#2d2e30", (g, h, s, r) => {
    blotch(g, s, s, r, 6, 0.32);
    blotch(g, s, s, r, 30, 0.2);
    fineNoise(g, s, s, r, 34);
    fineNoise(h, s, s, r, 70);
    // 금 · 때움
    g.lineWidth = 1.5;
    h.lineWidth = 2.5;
    g.strokeStyle = "rgba(0,0,0,0.5)";
    h.strokeStyle = GRAY(40);
    for (let i = 0; i < 26; i++) {
      let x = r() * s;
      let y = r() * s;
      g.beginPath();
      h.beginPath();
      g.moveTo(x, y);
      h.moveTo(x, y);
      for (let k = 0; k < 10; k++) {
        x += (r() - 0.5) * 60;
        y += (r() - 0.5) * 60;
        g.lineTo(x, y);
        h.lineTo(x, y);
      }
      g.stroke();
      h.stroke();
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = `rgba(14,14,15,${0.2 + r() * 0.3})`;
      g.fillRect(r() * s, r() * s, 30 + r() * 160, 20 + r() * 90);
    }
  });

/** 광장 · 보도: 돌판 */
export const pavePBR = () =>
  pbr("pave", 1024, "#7b766c", (g, h, s, r) => {
    const n = 12;
    const c = s / n;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const off = j % 2 ? c / 2 : 0;
        const x = i * c + off;
        const y = j * c;
        const v = 92 + r() * 34;
        for (const px of [x, x - s]) {
          g.fillStyle = `rgb(${v + 6},${v + 2},${v - 6})`;
          g.fillRect(px + 1.5, y + 1.5, c - 3, c - 3);
          h.fillStyle = GRAY(Math.round(140 + r() * 30));
          h.fillRect(px + 1.5, y + 1.5, c - 3, c - 3);
        }
      }
    blotch(g, s, s, r, 5, 0.14);
    blotch(g, s, s, r, 24, 0.12);
    grime(g, s, s, r, 30, 0.12);
    fineNoise(g, s, s, r, 16);
    fineNoise(h, s, s, r, 30);
  });

export const grassPBR = () =>
  pbr("grass", 512, "#3d4a2b", (g, h, s, r) => {
    blotch(g, s, s, r, 6, 0.3);
    blotch(g, s, s, r, 30, 0.35);
    for (let i = 0; i < 16000; i++) {
      g.fillStyle = pick(r, ["rgba(90,110,50,0.5)", "rgba(40,55,25,0.5)", "rgba(120,125,65,0.3)"]);
      const x = r() * s;
      const y = r() * s;
      g.fillRect(x, y, 1 + r(), 2 + r() * 3);
      h.fillStyle = GRAY(Math.round(100 + r() * 80));
      h.fillRect(x, y, 1, 3);
    }
  });

export const concretePBR = () =>
  pbr(
    "concrete",
    1024,
    "#6f6e69",
    (g, h, s, r) => {
      blotch(g, s, s, r, 5, 0.3);
      blotch(g, s, s, r, 20, 0.2);
      blotch(g, s, s, r, 80, 0.14);
      blotch(h, s, s, r, 40, 0.5, "source-over");
      blotch(h, s, s, r, 140, 0.35);
      // 패임 · 금 · 얼룩
      for (let i = 0; i < 700; i++) {
        const x = r() * s;
        const y = r() * s;
        const rad = 0.7 + r() * r() * 7;
        g.fillStyle = `rgba(20,20,18,${0.2 + r() * 0.4})`;
        h.fillStyle = GRAY(Math.round(25 + r() * 50));
        for (const t of [g, h]) {
          t.beginPath();
          t.ellipse(x, y, rad, rad * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2);
          t.fill();
        }
      }
      g.strokeStyle = "rgba(15,15,13,0.55)";
      h.strokeStyle = GRAY(30);
      for (let i = 0; i < 14; i++) {
        let x = r() * s;
        let y = r() * s;
        g.beginPath();
        h.beginPath();
        g.moveTo(x, y);
        h.moveTo(x, y);
        const a0 = r() * 6.28;
        for (let k = 0; k < 16; k++) {
          const a = a0 + (r() - 0.5) * 1.6;
          x += Math.cos(a) * 18;
          y += Math.sin(a) * 18;
          g.lineTo(x, y);
          h.lineTo(x, y);
        }
        g.lineWidth = 1 + r();
        h.lineWidth = 2;
        g.stroke();
        h.stroke();
      }
      grime(g, s, s, r, 50, 0.14);
      grime(g, s, s, r, 18, 0.09, "90,60,35");
      fineNoise(g, s, s, r, 22);
      fineNoise(h, s, s, r, 26);
    },
    3
  );

/** 컨테이너 골판 (흰 바탕 → 꼭짓점 색으로 물들임) */
export const containerPBR = () =>
  pbr(
    "container",
    512,
    "#d8d8d8",
    (g, h, s, r) => {
      const n = 16;
      const c = s / n;
      for (let i = 0; i < n; i++) {
        const gr = g.createLinearGradient(i * c, 0, (i + 1) * c, 0);
        gr.addColorStop(0, "#a2a2a2");
        gr.addColorStop(0.5, "#ffffff");
        gr.addColorStop(1, "#a2a2a2");
        g.fillStyle = gr;
        g.fillRect(i * c, 0, c, s);
        const hg = h.createLinearGradient(i * c, 0, (i + 1) * c, 0);
        hg.addColorStop(0, GRAY(70));
        hg.addColorStop(0.25, GRAY(190));
        hg.addColorStop(0.75, GRAY(190));
        hg.addColorStop(1, GRAY(70));
        h.fillStyle = hg;
        h.fillRect(i * c, 0, c, s);
      }
      // 녹 · 때 · 페인트 벗겨짐
      grime(g, s, s, r, 60, 0.3, "85,45,20");
      for (let i = 0; i < 30; i++) streak(g, r() * s, r() * s * 0.4, 3 + r() * 14, s * (0.2 + r() * 0.6), 0.2, "70,40,20");
      blotch(g, s, s, r, 14, 0.25);
      fineNoise(g, s, s, r, 16);
      g.fillStyle = "rgba(20,14,10,0.55)";
      g.fillRect(0, 0, s, 12);
      g.fillRect(0, s - 12, s, 12);
    },
    3
  );

export const sandPBR = () =>
  pbr(
    "sand",
    1024,
    "#a58a60",
    (g, h, s, r) => {
      blotch(g, s, s, r, 5, 0.32);
      blotch(g, s, s, r, 22, 0.22);
      // 바람 물결
      for (let i = 0; i < 190; i++) {
        const y = r() * s;
        const ph = r() * 6;
        const amp = 3 + r() * 7;
        g.strokeStyle = `rgba(90,62,30,${0.05 + r() * 0.1})`;
        h.strokeStyle = GRAY(r() < 0.5 ? 170 : 92);
        g.lineWidth = h.lineWidth = 2 + r() * 3;
        g.beginPath();
        h.beginPath();
        for (let x = 0; x <= s; x += 24) {
          const yy = y + Math.sin((x / s) * 12.566 + ph) * amp;
          if (x) {
            g.lineTo(x, yy);
            h.lineTo(x, yy);
          } else {
            g.moveTo(x, yy);
            h.moveTo(x, yy);
          }
        }
        g.stroke();
        h.stroke();
      }
      fineNoise(g, s, s, r, 24);
      fineNoise(h, s, s, r, 30);
    },
    2.2
  );

/** 흙벽 (사막 건물 바깥) */
export const mudPBR = () =>
  pbr(
    "mud",
    512,
    "#a88a62",
    (g, h, s, r) => {
      blotch(g, s, s, r, 5, 0.42);
      blotch(g, s, s, r, 20, 0.3);
      blotch(h, s, s, r, 16, 0.55, "source-over");
      for (let i = 0; i < 36; i++) {
        let x = r() * s;
        let y = r() * s;
        g.strokeStyle = "rgba(55,38,22,0.4)";
        h.strokeStyle = GRAY(45);
        g.beginPath();
        h.beginPath();
        g.moveTo(x, y);
        h.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (r() - 0.5) * 42;
          y += (r() - 0.5) * 42;
          g.lineTo(x, y);
          h.lineTo(x, y);
        }
        g.lineWidth = h.lineWidth = 1.2;
        g.stroke();
        h.stroke();
      }
      grime(g, s, s, r, 26, 0.24);
      fineNoise(g, s, s, r, 20);
      fineNoise(h, s, s, r, 26);
    },
    3
  );

export const metalPBR = () =>
  pbr(
    "metal",
    512,
    "#7d8287",
    (g, h, s, r) => {
      blotch(g, s, s, r, 8, 0.3);
      for (let y = 0; y < s; y++) {
        g.fillStyle = `rgba(255,255,255,${r() * 0.04})`;
        g.fillRect(0, y, s, 1);
      }
      grime(g, s, s, r, 34, 0.26, "80,45,20");
      for (let i = 0; i < 26; i++) streak(g, r() * s, r() * s * 0.5, 2 + r() * 8, s * 0.2 + r() * s * 0.4, 0.2, "70,42,22");
      // 판 이음 · 리벳
      for (let k = 0; k < s; k += 128) {
        g.fillStyle = "rgba(0,0,0,0.42)";
        g.fillRect(0, k, s, 2);
        g.fillRect(k, 0, 2, s);
        h.fillStyle = GRAY(50);
        h.fillRect(0, k, s, 3);
        h.fillRect(k, 0, 3, s);
        for (let j = 12; j < s; j += 32) {
          h.fillStyle = GRAY(235);
          h.fillRect(k + 7, j, 4, 4);
          h.fillRect(j, k + 7, 4, 4);
        }
      }
      fineNoise(g, s, s, r, 12);
    },
    3
  );

export const tarpPBR = () =>
  pbr(
    "tarp",
    256,
    "#5d5c45",
    (g, h, s, r) => {
      blotch(g, s, s, r, 6, 0.4);
      for (let i = 0; i < s; i += 32) {
        g.fillStyle = "rgba(0,0,0,0.2)";
        g.fillRect(i, 0, 1.5, s);
        h.fillStyle = GRAY(70);
        h.fillRect(i, 0, 2, s);
      }
      blotch(h, s, s, r, 8, 0.6, "source-over");
      grime(g, s, s, r, 16, 0.2);
      fineNoise(g, s, s, r, 16);
    },
    4
  );

/** 나뭇잎 덩어리 (구멍이 숭숭 → 윤곽이 들쭉날쭉) */
export const leafTex = () =>
  cached("leaf", () => {
    const S = 512;
    const c = canvas(S, S);
    const g = c.getContext("2d");
    const r = rng(23);
    const cols = ["#3f4f2c", "#4c5c32", "#5a6a3a", "#6c7a45", "#37472a", "#7f8a50"];
    for (let i = 0; i < 1500; i++) {
      const x = r() * S;
      const y = r() * S;
      const len = 4 + r() * 8;
      g.fillStyle = pick(r, cols);
      g.save();
      g.translate(x, y);
      g.rotate(r() * 6.28);
      g.beginPath();
      g.ellipse(0, 0, len, len * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    const t = tex(c);
    return t;
  });

/** 야자 잎 (길쭉한 깃털 모양 · 구멍) */
export const frondTex = () =>
  cached("frond", () => {
    const c = canvas(64, 256);
    const g = c.getContext("2d");
    const r = rng(31);
    g.strokeStyle = "#4b5a2c";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(32, 256);
    g.stroke();
    for (let y = 4; y < 252; y += 5) {
      const w = 30 * Math.sin((y / 256) * Math.PI) ** 0.6;
      g.strokeStyle = pick(r, ["#55682f", "#667a38", "#47582a", "#7a8a45"]);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(32, y);
      g.lineTo(32 - w, y + 12);
      g.moveTo(32, y);
      g.lineTo(32 + w, y + 12);
      g.stroke();
    }
    return tex(c, { repeat: false });
  });

export const barkTex = () =>
  cached("bark", () => {
    const c = canvas(128, 128);
    const g = c.getContext("2d");
    const r = rng(8);
    g.fillStyle = "#4c3d2f";
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? "20,15,10" : "120,100,80"},${0.1 + r() * 0.3})`;
      g.fillRect(r() * 128, r() * 128, 1 + r() * 3, 8 + r() * 40);
    }
    return tex(c);
  });

/** 실내 벽 (열린 창 안쪽 방) */
export const interiorTex = (night = false) =>
  cached(`int-${night}`, () => {
    const c = canvas(256, 256);
    const g = c.getContext("2d");
    const r = rng(night ? 7 : 3);
    g.fillStyle = night ? "#6a543f" : "#7a7267";
    g.fillRect(0, 0, 256, 256);
    blotch(g, 256, 256, r, 6, 0.32);
    // 벽지 줄 · 걸레받이
    g.fillStyle = "rgba(0,0,0,0.05)";
    for (let x = 0; x < 256; x += 22) g.fillRect(x, 0, 10, 256);
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(0, 238, 256, 18);
    // 액자 · 전등 빛
    g.fillStyle = "#2f251d";
    g.fillRect(84, 70, 84, 62);
    g.fillStyle = `hsl(${Math.floor(r() * 360)},18%,38%)`;
    g.fillRect(92, 78, 68, 46);
    const gr = g.createRadialGradient(128, 0, 8, 128, 0, 190);
    gr.addColorStop(0, night ? "rgba(255,200,130,0.5)" : "rgba(255,245,225,0.16)");
    gr.addColorStop(1, "rgba(0,0,0,0.25)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return tex(c);
  });

/** 네온 간판 (밤) */
export function neonTex(text, color) {
  return cached(`neon-${text}-${color}`, () => {
    const c = canvas(256, 96);
    const g = c.getContext("2d");
    g.fillStyle = "#07080c";
    g.fillRect(0, 0, 256, 96);
    g.font = "bold 54px Arial Black, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, 128, 50);
    g.shadowBlur = 0;
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.font = "bold 50px Arial Black, Arial, sans-serif";
    g.fillText(text, 128, 50);
    return tex(c, { repeat: false });
  });
}

/** 물: 색 · 잔물결 노멀 (시간 따라 흐름) */
export const waterPBR = () =>
  pbr(
    "water",
    1024,
    "#1f3f53",
    (g, h, s, r) => {
      blotch(g, s, s, r, 6, 0.35);
      for (let i = 0; i < 5200; i++) {
        const x = r() * s;
        const y = r() * s;
        const w = 8 + r() * 40;
        const v = r() < 0.5;
        g.strokeStyle = `rgba(${v ? "150,190,210" : "10,30,45"},${0.05 + r() * 0.12})`;
        h.strokeStyle = GRAY(v ? 210 : 50);
        g.lineWidth = 1 + r() * 1.4;
        h.lineWidth = 1 + r() * 2.4;
        g.beginPath();
        h.beginPath();
        g.moveTo(x, y);
        h.moveTo(x, y);
        g.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
        h.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
        g.stroke();
        h.stroke();
      }
    },
    2.4
  );
