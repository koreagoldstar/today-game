/*
 * 경기장: 테마별 배경은 한 번 그려 두고, 움직이는 것만 매 프레임 그린다.
 *  관중 · 깃발 · 등불 · 대나무 · 눈 · 오로라 · 열기구 · 별 · 심판.
 */
import { RING_R } from "./sim.js?v=1";

const TAU = Math.PI * 2;
export const TILT = 0.36;
const rngOf = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
const THEMES = {
  village: {
    sky: ["#7ec8f0", "#bfe6f5", "#fdeec4"], hill: ["#9ed18a", "#74b86b"], ground: ["#8ccb72", "#66ab5a"],
    clay: ["#f6dcae", "#e8c083", "#cfa162"], wall: ["#b5763f", "#8c5427"], rope: ["#f2d27f", "#a97c2d"], line: "#fff6dd", floor: "rgba(255,240,205,.55)",
    stand: ["#c9894d", "#a66c38"], text: "#7a4a1c",
  },
  bamboo: {
    sky: ["#a7dcc0", "#d3efd4", "#f3f8d6"], hill: ["#7fbf88", "#5da06f"], ground: ["#6fae66", "#4b8c53"],
    clay: ["#d9e8a4", "#bfd67f", "#9dbb5d"], wall: ["#7d9c4a", "#587534"], rope: ["#e5dfa2", "#8c8a3b"], line: "#f8fbdc", floor: "rgba(245,250,205,.5)",
    stand: ["#8f6b3f", "#6f5230"], text: "#3f5a22",
  },
  ice: {
    sky: ["#28437e", "#5f8fc8", "#cbe4f5"], hill: ["#dfeef8", "#b8d4ea"], ground: ["#eaf5fc", "#c7dff0"],
    clay: ["#e8f8ff", "#bfe6f7", "#8ecbe8"], wall: ["#8fc2e0", "#5e93b8"], rope: ["#ffffff", "#7fb3d4"], line: "#ffffff", floor: "rgba(255,255,255,.65)",
    stand: ["#7a9bc2", "#5d7ea8"], text: "#1f3e66",
  },
  desert: {
    sky: ["#f79a56", "#fbc37d", "#fde9b4"], hill: ["#e8b366", "#cf9248"], ground: ["#efc988", "#d8a763"],
    clay: ["#ffe2a8", "#f3c67c", "#d8a255"], wall: ["#c47a35", "#955421"], rope: ["#d9423a", "#8c1f1a"], line: "#fff3cf", floor: "rgba(255,240,200,.5)",
    stand: ["#b3693a", "#8f4f27"], text: "#7a3a12",
  },
  star: {
    sky: ["#120a38", "#2b1a6e", "#7a3fb2"], hill: ["#34237e", "#22165c"], ground: ["#2a1c68", "#1a1148"],
    clay: ["#6d57d8", "#4e3ab8", "#33248a"], wall: ["#2a1e78", "#180f50"], rope: ["#7ff3ff", "#2e9ec8"], line: "#c8f6ff", floor: "rgba(200,245,255,.28)",
    stand: ["#3f2d8f", "#2c1f70"], text: "#d9e8ff",
  },
};
const CROWD_C = ["#c28a52", "#ffb6cf", "#f8f7f2", "#ffa8bd", "#ffd84a", "#a9b4c9", "#ff9f3a", "#2f3a55", "#8fd3a8", "#b9a3ec"];

export class Stage {
  constructor() {
    this.world = "village";
    this.W = 2;
    this.H = 2;
    this.dpr = 1;
    this.cheer = 0;
    this.t = 0;
    this.quality = 1;
    this.bg = document.createElement("canvas");
    this.heads = [];
    this.parts = [];
    this.refPose = 0;
    this.refDir = 0;
  }

  layout(W, H, dpr) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    const portrait = W / H < 0.95;
    this.S = portrait ? W / (2 * RING_R + 96) : Math.min(W / (2 * RING_R + 170), H / 650);
    this.cx = W / 2;
    this.gy = portrait ? H * 0.5 : H * 0.615;
    this.rx = RING_R * this.S;
    this.ry = this.rx * TILT;
    this.platH = 46 * this.S;
    this.build();
  }

  setWorld(id) {
    if (id === this.world && this.bg.width > 2) return;
    this.world = id;
    if (this.W > 2) this.build();
  }

  map(x, z = 0, y = 0) {
    return [this.cx + x * this.S, this.gy + z * TILT * this.S - y * this.S];
  }

  /** 한 번만 그리는 배경 */
  build() {
    const { W, H, dpr, S } = this;
    const c = this.bg;
    c.width = Math.ceil(W * dpr);
    c.height = Math.ceil(H * dpr);
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const th = THEMES[this.world];
    this.th = th;
    const horizon = this.gy - this.ry - 150 * S;
    const sky = g.createLinearGradient(0, 0, 0, horizon + 50 * S);
    sky.addColorStop(0, th.sky[0]);
    sky.addColorStop(0.62, th.sky[1]);
    sky.addColorStop(1, th.sky[2]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const r = rngOf(this.world.length * 971 + 7);
    this.scenery(g, r, horizon);
    // 땅
    const gr = g.createLinearGradient(0, horizon, 0, H);
    gr.addColorStop(0, th.ground[0]);
    gr.addColorStop(1, th.ground[1]);
    g.fillStyle = gr;
    g.fillRect(0, horizon + 40 * S, W, H);
    this.groundDetail(g, r, horizon);
    this.stands(g);
    this.ring(g);
    this.frontDecor(g, r);
    this.makeCrowd(r);
    this.parts = [];
  }

  scenery(g, r, hz) {
    const { W, S, world, th } = this;
    const hills = (col, base, amp, n, seed) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, base + 300 * S);
      const rr = rngOf(seed);
      const ph = rr() * 6;
      for (let x = 0; x <= W; x += 8) {
        const q = Math.sin((x / W) * n + ph) * 0.6 + Math.sin((x / W) * n * 2.3 + ph * 2) * 0.3;
        g.lineTo(x, base - (q * 0.5 + 0.5) * amp);
      }
      g.lineTo(W, base + 300 * S);
      g.closePath();
      g.fill();
    };
    const cloud = (x, y, k, a = 1) => {
      g.save();
      g.globalAlpha = a;
      g.fillStyle = "rgba(255,255,255,.92)";
      for (const [dx, dy, R] of [[-40, 6, 26], [-12, -8, 34], [24, -2, 30], [52, 8, 20], [-6, 12, 32]]) {
        g.beginPath();
        g.arc(x + dx * k, y + dy * k, R * k, 0, TAU);
        g.fill();
      }
      g.restore();
    };
    if (world === "village") {
      for (let i = 0; i < 5; i += 1) cloud(r() * W, 30 + r() * (hz * 0.5), (0.7 + r() * 0.7) * S * 1.2, 0.95);
      hills(th.hill[0], hz + 30 * S, 90 * S, 5, 3);
      hills(th.hill[1], hz + 52 * S, 60 * S, 8, 9);
      // 마을 집 + 축제 천막
      const roofs = ["#e8604a", "#f0a03c", "#4f95d8", "#d9587f"];
      for (let i = 0; i < 9; i += 1) {
        const x = (i + 0.5) * (W / 9) + (r() - 0.5) * 40 * S;
        const w = (46 + r() * 30) * S;
        const h = (34 + r() * 26) * S;
        const y = hz + 46 * S;
        g.fillStyle = "#fff4dc";
        g.fillRect(x - w / 2, y - h, w, h);
        g.fillStyle = "#c9a26c";
        g.fillRect(x - w / 2, y - 5 * S, w, 5 * S);
        g.fillStyle = "#6a8fb8";
        g.fillRect(x - w * 0.2, y - h * 0.72, w * 0.4, h * 0.34);
        g.fillStyle = roofs[i % 4];
        g.beginPath();
        g.moveTo(x - w * 0.62, y - h);
        g.lineTo(x, y - h - w * 0.44);
        g.lineTo(x + w * 0.62, y - h);
        g.closePath();
        g.fill();
      }
    } else if (world === "bamboo") {
      hills(th.hill[0], hz + 20 * S, 110 * S, 4, 5);
      hills(th.hill[1], hz + 44 * S, 70 * S, 7, 8);
      // 먼 대나무 숲
      for (let i = 0; i < 46; i += 1) {
        const x = r() * W;
        const w = (6 + r() * 7) * S;
        g.fillStyle = `rgba(${70 + r() * 30},${150 + r() * 40},${90 + r() * 20},.75)`;
        g.fillRect(x, 0, w, hz + 60 * S);
        g.fillStyle = "rgba(20,70,40,.3)";
        for (let y = r() * 50 * S; y < hz + 60 * S; y += 54 * S) g.fillRect(x - 1, y, w + 2, 2.6 * S);
      }
      // 정자
      const x = W * 0.16;
      const y = hz + 56 * S;
      g.fillStyle = "#8c5a33";
      g.fillRect(x - 46 * S, y - 58 * S, 7 * S, 58 * S);
      g.fillRect(x + 39 * S, y - 58 * S, 7 * S, 58 * S);
      g.fillStyle = "#b5503c";
      g.beginPath();
      g.moveTo(x - 72 * S, y - 56 * S);
      g.quadraticCurveTo(x, y - 110 * S, x + 72 * S, y - 56 * S);
      g.quadraticCurveTo(x, y - 72 * S, x - 72 * S, y - 56 * S);
      g.fill();
    } else if (world === "ice") {
      // 별 + 눈 덮인 산
      for (let i = 0; i < 60; i += 1) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
        g.fillRect(r() * W, r() * hz * 0.55, 1.6, 1.6);
      }
      for (const [px, h, w] of [[0.14, 170, 220], [0.36, 120, 190], [0.6, 190, 260], [0.86, 140, 210]]) {
        const x = W * px;
        const base = hz + 56 * S;
        g.fillStyle = "#7fa6cf";
        g.beginPath();
        g.moveTo(x - w * S, base);
        g.lineTo(x, base - h * S);
        g.lineTo(x + w * S, base);
        g.closePath();
        g.fill();
        g.fillStyle = "#f4fbff";
        g.beginPath();
        g.moveTo(x - w * S * 0.36, base - h * S * 0.64);
        g.lineTo(x, base - h * S);
        g.lineTo(x + w * S * 0.36, base - h * S * 0.64);
        g.lineTo(x + w * S * 0.14, base - h * S * 0.56);
        g.lineTo(x - w * S * 0.04, base - h * S * 0.66);
        g.lineTo(x - w * S * 0.18, base - h * S * 0.55);
        g.closePath();
        g.fill();
      }
      hills(th.hill[1], hz + 46 * S, 40 * S, 6, 4);
      for (let i = 0; i < 12; i += 1) {
        const x = r() * W;
        const y = hz + (30 + r() * 20) * S;
        const k = (0.7 + r() * 0.5) * S;
        for (let j = 0; j < 3; j += 1) {
          g.fillStyle = j === 2 ? "#eef8ff" : "#4f8a86";
          g.beginPath();
          g.moveTo(x - (26 - j * 6) * k, y - j * 16 * k);
          g.lineTo(x, y - (34 + j * 16) * k);
          g.lineTo(x + (26 - j * 6) * k, y - j * 16 * k);
          g.closePath();
          g.fill();
        }
      }
    } else if (world === "desert") {
      // 해 + 메사 + 천막
      const sx = W * 0.72;
      const sy = hz * 0.55;
      const sun = g.createRadialGradient(sx, sy, 0, sx, sy, 150 * S);
      sun.addColorStop(0, "rgba(255,246,200,1)");
      sun.addColorStop(0.3, "rgba(255,226,140,.9)");
      sun.addColorStop(1, "rgba(255,200,120,0)");
      g.fillStyle = sun;
      g.fillRect(sx - 150 * S, sy - 150 * S, 300 * S, 300 * S);
      for (const [px, w, h] of [[0.1, 170, 110], [0.32, 110, 70], [0.88, 190, 130]]) {
        const x = W * px;
        const base = hz + 48 * S;
        g.fillStyle = "#c97b45";
        g.beginPath();
        g.moveTo(x - w * S, base);
        g.lineTo(x - w * S * 0.66, base - h * S);
        g.lineTo(x + w * S * 0.66, base - h * S);
        g.lineTo(x + w * S, base);
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(255,220,160,.35)";
        g.fillRect(x - w * S * 0.66, base - h * S, w * S * 1.32, 8 * S);
      }
      hills(th.hill[0], hz + 40 * S, 50 * S, 4, 2);
      hills(th.hill[1], hz + 56 * S, 34 * S, 6, 12);
      const col = ["#d9423a", "#2f8fc8", "#f0c040"];
      for (let i = 0; i < 6; i += 1) {
        const x = W * (0.08 + i * 0.17) + (r() - 0.5) * 30 * S;
        const y = hz + 56 * S;
        const w = (38 + r() * 14) * S;
        for (let j = 0; j < 6; j += 1) {
          g.fillStyle = j % 2 ? "#fff3d8" : col[i % 3];
          g.beginPath();
          g.moveTo(x, y - w * 1.2);
          g.lineTo(x - w + (j * w) / 3, y);
          g.lineTo(x - w + ((j + 1) * w) / 3, y);
          g.closePath();
          g.fill();
        }
      }
    } else {
      // 별빛: 별 · 행성 · 떠다니는 섬
      for (let i = 0; i < 180; i += 1) {
        g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.8})`;
        const s = r() < 0.1 ? 2.4 : 1.2;
        g.fillRect(r() * W, r() * (hz + 30), s, s);
      }
      const planet = (x, y, R, c0, c1, ring) => {
        const p = g.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
        p.addColorStop(0, c0);
        p.addColorStop(1, c1);
        g.fillStyle = p;
        g.beginPath();
        g.arc(x, y, R, 0, TAU);
        g.fill();
        if (ring) {
          g.strokeStyle = "rgba(255,230,180,.7)";
          g.lineWidth = 4 * S;
          g.beginPath();
          g.ellipse(x, y, R * 1.6, R * 0.42, -0.3, 0, TAU);
          g.stroke();
        }
      };
      planet(W * 0.14, hz * 0.42, 54 * S, "#ffb3d9", "#8a3fb2", false);
      planet(W * 0.82, hz * 0.5, 40 * S, "#ffe2a8", "#d9743a", true);
      hills(th.hill[0], hz + 30 * S, 60 * S, 5, 6);
      hills(th.hill[1], hz + 52 * S, 34 * S, 7, 16);
    }
  }

  groundDetail(g, r, hz) {
    const { W, H, S, world } = this;
    const n = 60;
    for (let i = 0; i < n; i += 1) {
      const x = r() * W;
      const y = hz + 60 * S + r() * (H - hz);
      const k = S * (0.6 + r());
      if (world === "village" || world === "bamboo") {
        g.strokeStyle = "rgba(40,110,60,.5)";
        g.lineWidth = 2 * k;
        for (const d of [-4, 0, 4]) {
          g.beginPath();
          g.moveTo(x + d * k, y);
          g.quadraticCurveTo(x + d * k * 1.3, y - 6 * k, x + d * k * 1.9, y - 10 * k);
          g.stroke();
        }
      } else if (world === "desert") {
        g.fillStyle = "rgba(150,90,40,.28)";
        g.beginPath();
        g.ellipse(x, y, 10 * k, 2.6 * k, 0, 0, TAU);
        g.fill();
      } else if (world === "ice") {
        g.fillStyle = "rgba(255,255,255,.7)";
        g.beginPath();
        g.ellipse(x, y, 11 * k, 3 * k, 0, 0, TAU);
        g.fill();
      } else {
        g.fillStyle = `rgba(190,220,255,${0.2 + r() * 0.5})`;
        g.fillRect(x, y, 2 * k, 2 * k);
      }
    }
  }

  /** 관중석 */
  stands(g) {
    const { cx, gy, rx, ry, S, th } = this;
    const top = gy - ry;
    const rows = 4;
    this.rowY = [];
    for (let i = rows - 1; i >= 0; i -= 1) {
      const y = top - (10 + i * 37) * S;
      const w = rx * (1.52 - i * 0.03);
      const h = 40 * S;
      const gr = g.createLinearGradient(0, y - h, 0, y + 4 * S);
      gr.addColorStop(0, i % 2 ? th.stand[0] : th.stand[1]);
      gr.addColorStop(1, i % 2 ? th.stand[1] : th.stand[0]);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(cx - w, y + 18 * S);
      g.quadraticCurveTo(cx, y - h * 0.82, cx + w, y + 18 * S);
      g.lineTo(cx + w, y + 42 * S);
      g.quadraticCurveTo(cx, y, cx - w, y + 42 * S);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(0,0,0,.14)";
      g.lineWidth = 2 * S;
      g.stroke();
      this.rowY[i] = y;
    }
  }

  ring(g) {
    const { cx, gy, rx, ry, platH, S, th } = this;
    const P = 1.09; // 짚 바깥 여유
    // 그림자
    g.fillStyle = "rgba(20,10,20,.2)";
    g.beginPath();
    g.ellipse(cx, gy + platH + 10 * S, rx * P * 1.03, ry * P * 1.03, 0, 0, TAU);
    g.fill();
    // 옆면
    const side = g.createLinearGradient(cx - rx, 0, cx + rx, 0);
    side.addColorStop(0, th.wall[1]);
    side.addColorStop(0.35, th.wall[0]);
    side.addColorStop(0.7, th.wall[0]);
    side.addColorStop(1, th.wall[1]);
    g.fillStyle = side;
    g.beginPath();
    g.ellipse(cx, gy + platH, rx * P, ry * P, 0, 0, TAU);
    g.fill();
    g.fillRect(cx - rx * P, gy, rx * P * 2, platH);
    // 옆면 장식: 쌓은 흙 무늬
    g.strokeStyle = "rgba(0,0,0,.14)";
    g.lineWidth = 2 * S;
    for (let i = 1; i <= 2; i += 1) {
      const dy = (platH / 3) * i;
      g.beginPath();
      g.ellipse(cx, gy + dy, rx * P, ry * P, 0, 0, Math.PI);
      g.stroke();
    }
    // 윗면
    const top = g.createRadialGradient(cx - rx * 0.2, gy - ry * 0.35, rx * 0.1, cx, gy, rx * P);
    top.addColorStop(0, th.clay[0]);
    top.addColorStop(0.6, th.clay[1]);
    top.addColorStop(1, th.clay[2]);
    g.fillStyle = top;
    g.beginPath();
    g.ellipse(cx, gy, rx * P, ry * P, 0, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,.2)";
    g.lineWidth = 2.5 * S;
    g.stroke();
    // 바닥 무늬
    g.save();
    g.beginPath();
    g.ellipse(cx, gy, rx, ry, 0, 0, TAU);
    g.clip();
    const r = rngOf(this.world.length * 31 + 3);
    if (this.world === "bamboo") {
      // 다다미
      g.strokeStyle = "rgba(90,120,40,.32)";
      g.lineWidth = 2 * S;
      for (let i = -6; i <= 6; i += 1) {
        g.beginPath();
        g.moveTo(cx + i * 70 * S, gy - ry);
        g.lineTo(cx + i * 70 * S, gy + ry);
        g.stroke();
      }
    } else if (this.world === "ice") {
      // 빙판 반사 + 금
      const sh = g.createLinearGradient(cx - rx, gy - ry, cx + rx, gy + ry);
      sh.addColorStop(0.25, "rgba(255,255,255,0)");
      sh.addColorStop(0.42, "rgba(255,255,255,.55)");
      sh.addColorStop(0.55, "rgba(255,255,255,0)");
      g.fillStyle = sh;
      g.fillRect(cx - rx, gy - ry, rx * 2, ry * 2);
      g.strokeStyle = "rgba(255,255,255,.7)";
      g.lineWidth = 1.5 * S;
      for (let i = 0; i < 14; i += 1) {
        let x = cx + (r() - 0.5) * rx * 2;
        let y = gy + (r() - 0.5) * ry * 2;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 3; k += 1) {
          x += (r() - 0.5) * 46 * S;
          y += (r() - 0.5) * 14 * S;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    } else if (this.world === "star") {
      for (let i = 0; i < 70; i += 1) {
        g.fillStyle = `rgba(190,240,255,${0.2 + r() * 0.6})`;
        const s = (1 + r() * 2.4) * S;
        g.fillRect(cx + (r() - 0.5) * rx * 2, gy + (r() - 0.5) * ry * 2, s, s * 0.6);
      }
    } else {
      for (let i = 0; i < 90; i += 1) {
        g.fillStyle = r() < 0.5 ? "rgba(120,80,40,.1)" : "rgba(255,255,255,.14)";
        g.beginPath();
        g.ellipse(cx + (r() - 0.5) * rx * 2, gy + (r() - 0.5) * ry * 2, (4 + r() * 12) * S, (1.2 + r() * 2.2) * S, 0, 0, TAU);
        g.fill();
      }
    }
    // 가운데 원 + 출발선
    g.strokeStyle = th.floor;
    g.lineWidth = 4 * S;
    g.beginPath();
    g.ellipse(cx, gy, rx * 0.55, ry * 0.55, 0, 0, TAU);
    g.stroke();
    g.strokeStyle = th.line;
    g.lineWidth = 7 * S;
    g.lineCap = "round";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + s * 42 * S, gy - 17 * S);
      g.lineTo(cx + s * 42 * S, gy + 17 * S);
      g.stroke();
    }
    g.restore();
    // 짚 테두리 (타와라)
    this.rope(g, 1);
  }

  /** 경계 줄: k 는 원래 반지름 대비 비율 */
  rope(g, k) {
    const { cx, gy, rx, ry, S, th } = this;
    g.lineCap = "butt";
    g.strokeStyle = th.rope[1];
    g.lineWidth = 15 * S * Math.max(0.6, k);
    g.beginPath();
    g.ellipse(cx, gy + 1.5 * S, rx * k, ry * k, 0, 0, TAU);
    g.stroke();
    g.strokeStyle = th.rope[0];
    g.lineWidth = 11 * S * Math.max(0.6, k);
    g.beginPath();
    g.ellipse(cx, gy, rx * k, ry * k, 0, 0, TAU);
    g.stroke();
    g.setLineDash([3 * S, 13 * S]);
    g.strokeStyle = th.rope[1];
    g.lineWidth = 9 * S * Math.max(0.6, k);
    g.stroke();
    g.setLineDash([]);
  }

  frontDecor(g, r) {
    const { W, H, S, gy, ry, world, platH } = this;
    const y0 = gy + ry + platH;
    if (y0 + 30 * S > H) return;
    if (world === "village" || world === "desert") {
      // 앞쪽 짚더미
      for (const x of [W * 0.05, W * 0.95]) {
        const y = Math.min(H - 16 * S, y0 + 34 * S);
        g.fillStyle = world === "village" ? "#e6c364" : "#c98f4a";
        g.beginPath();
        g.ellipse(x, y, 66 * S, 30 * S, 0, 0, TAU);
        g.fill();
        g.strokeStyle = "rgba(120,80,20,.5)";
        g.lineWidth = 2.4 * S;
        for (let i = 0; i < 10; i += 1) {
          const a = r() * TAU;
          g.beginPath();
          g.moveTo(x + Math.cos(a) * 40 * S, y + Math.sin(a) * 16 * S);
          g.lineTo(x + Math.cos(a) * 56 * S, y + Math.sin(a) * 24 * S);
          g.stroke();
        }
      }
    }
  }

  /** 움직이는 관중: 얼굴 그림을 한 번 만들어 재사용 */
  makeCrowd(r) {
    const { S, cx, rx } = this;
    const R = Math.max(8, 13.5 * S);
    const size = Math.ceil(R * 3.1);
    this.faceSheet = CROWD_C.map((col, i) => {
      const c = document.createElement("canvas");
      c.width = size * this.dpr;
      c.height = size * this.dpr;
      const g = c.getContext("2d");
      g.scale(this.dpr, this.dpr);
      const x = size / 2;
      const y = size * 0.58;
      // 귀
      g.fillStyle = col;
      g.strokeStyle = "rgba(40,20,20,.55)";
      g.lineWidth = 1.6;
      const earKind = i % 4;
      for (const s of [-1, 1]) {
        g.beginPath();
        if (earKind === 1) g.ellipse(x + s * R * 0.42, y - R * 1.1, R * 0.24, R * 0.62, s * 0.15, 0, TAU);
        else if (earKind === 2) {
          g.moveTo(x + s * R * 0.9, y - R * 0.3);
          g.lineTo(x + s * R * 0.72, y - R * 1.2);
          g.lineTo(x + s * R * 0.12, y - R * 0.84);
        } else g.arc(x + s * R * 0.72, y - R * 0.72, R * 0.36, 0, TAU);
        g.closePath();
        g.fill();
        g.stroke();
      }
      const gr = g.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.1, x, y, R * 1.1);
      gr.addColorStop(0, "#fff");
      gr.addColorStop(0.3, col);
      gr.addColorStop(1, col);
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, R, R * 0.92, 0, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = "#231a1a";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(x + s * R * 0.36, y - R * 0.05, R * 0.15, R * 0.2, 0, 0, TAU);
        g.fill();
      }
      g.fillStyle = "#fff";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(x + s * R * 0.36 + R * 0.05, y - R * 0.12, R * 0.055, 0, TAU);
        g.fill();
      }
      g.strokeStyle = "#5a2a2a";
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x, y + R * 0.2, R * 0.22, 0.2, Math.PI - 0.2);
      g.stroke();
      return c;
    });
    this.faceSize = size;
    this.heads = [];
    for (let row = 0; row < this.rowY.length; row += 1) {
      const y = this.rowY[row];
      const w = rx * (1.46 - row * 0.03);
      const step = R * 2.9;
      const n = Math.floor((w * 2) / step);
      const curve = 0.82;
      for (let i = 0; i <= n; i += 1) {
        if (r() < 0.14) continue;
        const px = -w + (i + (row % 2 ? 0.5 : 0)) * step + (r() - 0.5) * R * 0.3;
        const k = px / w;
        // 관중석 곡선을 따라
        const yy = y + 2 * this.S - (1 - k * k) * curve * 19 * this.S + 26 * this.S * k * k;
        this.heads.push({ x: cx + px, y: yy - R * 1.2, c: Math.floor(r() * CROWD_C.length), p: r() * TAU, sp: 2 + r() * 2.5 });
      }
    }
  }

  /** 뒤쪽 움직임 (관중 · 깃발 · 배경) */
  drawBack(g, t) {
    this.t = t;
    g.drawImage(this.bg, 0, 0, this.W, this.H);
    const { S, world, W, cx, gy, rx, ry } = this;
    const hz = gy - ry - 150 * S;
    if (world === "ice") {
      // 오로라
      g.save();
      g.globalCompositeOperation = "screen";
      for (let i = 0; i < 3; i += 1) {
        const y = hz * (0.18 + i * 0.13);
        const a = 0.14 + Math.sin(t * 0.7 + i) * 0.06;
        g.fillStyle = i === 1 ? `rgba(120,255,200,${a})` : `rgba(120,200,255,${a})`;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= W; x += W / 10) g.lineTo(x, y + Math.sin(x * 0.01 + t * 0.5 + i) * 26 * S);
        for (let x = W; x >= 0; x -= W / 10) g.lineTo(x, y + 62 * S + Math.sin(x * 0.012 + t * 0.4 + i * 2) * 26 * S);
        g.closePath();
        g.fill();
      }
      g.restore();
    } else if (world === "desert") {
      // 열기구
      for (let i = 0; i < 3; i += 1) {
        const x = ((W * (0.2 + i * 0.3) + t * (5 + i * 2.2) * S) % (W + 140 * S)) - 70 * S;
        const y = hz * (0.26 + i * 0.16) + Math.sin(t * 0.6 + i) * 7 * S;
        const k = S * (0.8 - i * 0.12);
        const col = ["#e8483a", "#2f8fc8", "#f0b030"][i];
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(x, y, 25 * k, 30 * k, 0, 0, TAU);
        g.fill();
        g.fillStyle = "rgba(255,255,255,.75)";
        g.beginPath();
        g.ellipse(x, y, 9 * k, 30 * k, 0, 0, TAU);
        g.fill();
        g.fillStyle = "#6a4426";
        g.fillRect(x - 6 * k, y + 37 * k, 12 * k, 8 * k);
        g.strokeStyle = "#6a4426";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x - 14 * k, y + 22 * k);
        g.lineTo(x - 5 * k, y + 37 * k);
        g.moveTo(x + 14 * k, y + 22 * k);
        g.lineTo(x + 5 * k, y + 37 * k);
        g.stroke();
      }
    } else if (world === "star") {
      // 반짝이는 별 + 별똥별
      const n = Math.floor(t * 0.28);
      const r = rngOf(n + 5);
      const u = t * 0.28 - n;
      if (u < 0.3) {
        const sx = r() * W;
        const sy = r() * hz * 0.5;
        const q = u / 0.3;
        const x = sx + q * 170 * S;
        const y = sy + q * 70 * S;
        const gr = g.createLinearGradient(x - 70 * S, y - 28 * S, x, y);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(1, "rgba(255,255,255,.95)");
        g.strokeStyle = gr;
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(x - 70 * S, y - 28 * S);
        g.lineTo(x, y);
        g.stroke();
      }
      for (let i = 0; i < 16; i += 1) {
        const rr = rngOf(i * 77 + 9);
        const x = rr() * W;
        const y = rr() * hz * 0.8;
        const a = 0.5 + Math.sin(t * (1 + rr() * 2) + i) * 0.5;
        g.fillStyle = `rgba(255,255,255,${a})`;
        const s = 2 + rr() * 2.4;
        g.fillRect(x - s, y - 0.7, s * 2, 1.4);
        g.fillRect(x - 0.7, y - s, 1.4, s * 2);
      }
    }
    // 관중
    const sheet = this.faceSheet;
    if (sheet) {
      const size = this.faceSize;
      const amp = (2 + this.cheer * 15) * S;
      const list = this.heads;
      const lim = this.quality < 0.6 ? 2 : 1;
      g.globalAlpha = 0.9; // 주인공보다 튀지 않게
      for (let i = 0; i < list.length; i += lim) {
        const h = list[i];
        const bob = Math.abs(Math.sin(t * h.sp * (1 + this.cheer) + h.p)) * amp;
        g.drawImage(sheet[h.c], h.x - size / 2, h.y - bob, size, size);
      }
      g.globalAlpha = 1;
    }
    this.bunting(g, t);
    this.referee(g, cx + rx * 0.02, gy - ry - 8 * S, S * 0.62, t);
  }

  bunting(g, t) {
    const { W, S, gy, ry, world } = this;
    const y0 = gy - ry - 172 * S;
    const col = world === "star" ? ["#7ff3ff", "#ffb3f0", "#ffe27a"] : world === "ice" ? ["#fff", "#8fd3f3", "#3f7fc8"] : ["#e8483a", "#ffd23f", "#2f8fc8", "#4fc26a"];
    const span = W / 2;
    for (const side of [0, 1]) {
      const x0 = side * span;
      const n = 8;
      for (let i = 0; i < n; i += 1) {
        const u = (i + 0.5) / n;
        const x = x0 + u * span;
        const sag = Math.sin(u * Math.PI) * 26 * S;
        const y = y0 + sag;
        const sway = Math.sin(t * 2.2 + i) * 3.5 * S;
        g.fillStyle = col[i % col.length];
        g.beginPath();
        g.moveTo(x - 12 * S, y);
        g.lineTo(x + 12 * S, y);
        g.lineTo(x + sway, y + 25 * S);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = "rgba(60,40,30,.55)";
      g.lineWidth = 2 * S;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + span / 2, y0 + 52 * S, x0 + span, y0);
      g.stroke();
    }
    // 등불 (마을 · 대나무 · 사막)
    if (world !== "ice" && world !== "star") {
      for (let i = 0; i < 5; i += 1) {
        const x = (i + 0.5) * (W / 5);
        const y = gy - ry - 214 * S;
        const a = Math.sin(t * 1.5 + i * 2) * 0.09;
        g.save();
        g.translate(x, Math.max(14, y));
        g.rotate(a);
        g.strokeStyle = "rgba(60,30,20,.6)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(0, -30 * S);
        g.lineTo(0, 0);
        g.stroke();
        const gl = g.createRadialGradient(0, 16 * S, 0, 0, 16 * S, 26 * S);
        gl.addColorStop(0, "#fff0b0");
        gl.addColorStop(0.5, "#ff9a4a");
        gl.addColorStop(1, "#d8432e");
        g.fillStyle = gl;
        g.beginPath();
        g.ellipse(0, 16 * S, 16 * S, 20 * S, 0, 0, TAU);
        g.fill();
        g.restore();
      }
    }
  }

  /** 심판 올빼미: 군배를 들고 있다 */
  referee(g, x, y, s, t) {
    const dir = this.refDir;
    const pose = this.refPose;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    const bob = Math.sin(t * 2.4) * 2;
    // 옷
    g.fillStyle = "#7a2f8f";
    g.strokeStyle = "#3a1048";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-34, 0);
    g.quadraticCurveTo(-40, -44, -22, -58 + bob);
    g.lineTo(22, -58 + bob);
    g.quadraticCurveTo(40, -44, 34, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = "#ffd23f";
    g.fillRect(-30, -22, 60, 7);
    // 머리
    g.fillStyle = "#b08a5e";
    g.beginPath();
    g.ellipse(0, -76 + bob, 32, 28, 0, 0, TAU);
    g.fill();
    g.stroke();
    g.strokeStyle = "#5c3f24";
    for (const sd of [-1, 1]) {
      g.fillStyle = "#b08a5e";
      g.beginPath();
      g.moveTo(sd * 26, -96 + bob);
      g.lineTo(sd * 30, -112 + bob);
      g.lineTo(sd * 12, -102 + bob);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = "#fff6dc";
      g.beginPath();
      g.arc(sd * 13, -78 + bob, 13, 0, TAU);
      g.fill();
      g.fillStyle = "#1f1408";
      g.beginPath();
      g.arc(sd * 13 + dir * 2, -78 + bob, 6.5, 0, TAU);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(sd * 13 + 2, -81 + bob, 2, 0, TAU);
      g.fill();
    }
    g.fillStyle = "#ff9d2e";
    g.beginPath();
    g.moveTo(-5, -72 + bob);
    g.lineTo(5, -72 + bob);
    g.lineTo(0, -62 + bob);
    g.closePath();
    g.fill();
    // 군배
    const raise = pose;
    const hx = dir >= 0 ? 34 + raise * 18 : -34 - raise * 18;
    const hy = -40 - raise * 44 + Math.sin(t * 9) * raise * 3;
    const sign = dir >= 0 ? 1 : -1;
    g.strokeStyle = "#5a3210";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(sign * 22, -38);
    g.lineTo(hx, hy);
    g.stroke();
    g.fillStyle = "#e8483a";
    g.strokeStyle = "#7a1810";
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(hx + sign * 8, hy - 16, 15, 20, sign * 0.3, 0, TAU);
    g.fill();
    g.stroke();
    g.restore();
  }

  /** 앞쪽 움직임 (눈 · 낙엽 · 모래 · 반짝이) */
  drawFront(g, t, dt) {
    const { W, H, S, world } = this;
    const want = world === "ice" ? 46 : world === "bamboo" ? 12 : world === "star" ? 26 : world === "desert" ? 16 : 0;
    const n = Math.round(want * (this.quality < 0.6 ? 0.45 : 1));
    while (this.parts.length < n) this.parts.push({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 6, k: 0.5 + Math.random() });
    for (const q of this.parts) {
      if (world === "ice") {
        q.y += (34 + q.k * 40) * S * dt;
        q.x += Math.sin(t + q.p) * 18 * S * dt;
      } else if (world === "bamboo") {
        q.y += (20 + q.k * 24) * S * dt;
        q.x += (Math.sin(t * 1.4 + q.p) * 40 + 14) * S * dt;
      } else if (world === "desert") {
        q.x += (60 + q.k * 90) * S * dt;
        q.y += Math.sin(t * 2 + q.p) * 6 * S * dt;
      } else {
        q.y -= (8 + q.k * 16) * S * dt;
      }
      if (q.y > H) q.y = -10;
      if (q.y < -10) q.y = H;
      if (q.x > W) q.x = 0;
      if (world === "ice") {
        g.fillStyle = "rgba(255,255,255,.85)";
        g.beginPath();
        g.arc(q.x, q.y, (1.5 + q.k * 2.2) * S, 0, TAU);
        g.fill();
      } else if (world === "bamboo") {
        g.save();
        g.translate(q.x, q.y);
        g.rotate(t * q.k * 2 + q.p);
        g.fillStyle = "#7fbf5a";
        g.beginPath();
        g.ellipse(0, 0, 8 * S, 2.8 * S, 0, 0, TAU);
        g.fill();
        g.restore();
      } else if (world === "desert") {
        g.fillStyle = "rgba(255,225,160,.5)";
        g.fillRect(q.x, q.y, 7 * S * q.k, 1.4 * S);
      } else {
        const a = 0.4 + Math.sin(t * 3 + q.p) * 0.4;
        g.fillStyle = `rgba(180,240,255,${a})`;
        const s = 2.4 * S * q.k;
        g.fillRect(q.x - s, q.y - 0.6, s * 2, 1.2);
        g.fillRect(q.x - 0.6, q.y - s, 1.2, s * 2);
      }
    }
    if (world === "bamboo" && this.quality >= 0.6) {
      // 앞쪽 대나무 몇 그루가 흔들린다
      for (const [px, w] of [[0.015, 18], [0.062, 13], [0.985, 19], [0.94, 12]]) {
        const sway = Math.sin(t * 0.9 + px * 20) * 6 * S;
        const x = W * px;
        const wd = w * S;
        const gr = g.createLinearGradient(x - wd / 2, 0, x + wd / 2, 0);
        gr.addColorStop(0, "#3f8f53");
        gr.addColorStop(0.5, "#7fc884");
        gr.addColorStop(1, "#347a47");
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(x - wd / 2, H);
        g.lineTo(x - wd / 2 + sway, 0);
        g.lineTo(x + wd / 2 + sway, 0);
        g.lineTo(x + wd / 2, H);
        g.closePath();
        g.fill();
      }
    }
  }

  /** 경계 위험 표시 + 좁아진 판 */
  drawDanger(g, fighters, R, t) {
    const { cx, gy, rx, ry, S } = this;
    const k = R / RING_R;
    if (k < 0.999) {
      // 좁아진 바깥은 위험 구역
      g.save();
      g.beginPath();
      g.ellipse(cx, gy, rx * 1.08, ry * 1.08, 0, 0, TAU);
      g.ellipse(cx, gy, rx * k, ry * k, 0, 0, TAU);
      g.fillStyle = `rgba(230,40,40,${0.22 + Math.sin(t * 8) * 0.07})`;
      g.fill("evenodd");
      g.restore();
      this.rope(g, k);
    }
    for (const f of fighters) {
      if (f.edge <= 0.04 || f.state === "out") continue;
      const a0 = Math.atan2(f.z / 1, f.x);
      const w = 0.3 + f.edge * 0.5;
      const pulse = 0.55 + Math.sin(t * (6 + f.edge * 10)) * 0.25;
      g.strokeStyle = `rgba(255,${Math.round(90 - f.edge * 70)},40,${Math.min(1, f.edge * 1.1) * pulse})`;
      g.lineWidth = (9 + f.edge * 8) * S * Math.max(0.7, k);
      g.lineCap = "round";
      g.beginPath();
      g.ellipse(cx, gy, rx * k, ry * k, 0, a0 - w, a0 + w);
      g.stroke();
    }
  }
}
