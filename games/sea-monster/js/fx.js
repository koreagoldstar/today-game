/*
 * 바다괴물 탐험대 · 효과 (기포 · 물방울 · 물보라 · 먹물 · 반짝임 · 모래 · 글자 · 흔들림 · 번쩍임 · 슬로모션)
 * 미리 만든 풀(pool)을 돌려 쓴다 → 판이 길어져도 쓰레기가 쌓이지 않는다.
 * 입자는 세계 좌표, 글자는 세계(world) 또는 화면(screen) 좌표.
 */
import { W, H, TAU, rand, clamp, ease } from "./view.js?v=1";
import { sprite, put } from "../art/sprites.js?v=1";

const MAX = 420;
const MAX_TXT = 30;

/** 부드러운 흰 덩어리 */
function blobSprite(color, key) {
  return sprite(`fxb|${key}`, 64, 64, 32, 32, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
    g.addColorStop(0, color.replace("A", "0.9"));
    g.addColorStop(0.5, color.replace("A", "0.45"));
    g.addColorStop(1, color.replace("A", "0"));
    c.fillStyle = g;
    c.fillRect(-32, -32, 64, 64);
  });
}

export class Effects {
  constructor() {
    this.p = Array.from({ length: MAX }, () => ({ on: false }));
    this.cur = 0;
    this.txt = Array.from({ length: MAX_TXT }, () => ({ on: false }));
    this.tcur = 0;
    this.shakeA = 0;
    this.sx = 0;
    this.sy = 0;
    this.flashA = 0;
    this.flashC = "#fff";
    this.slowT = 0;
    this.slowK = 1;
    this.banner = null;
    this.quality = 1;
  }

  reset() {
    for (const q of this.p) q.on = false;
    for (const q of this.txt) q.on = false;
    this.shakeA = 0;
    this.flashA = 0;
    this.slowT = 0;
    this.banner = null;
  }

  spawn(o) {
    const q = this.p[this.cur];
    this.cur = (this.cur + 1) % MAX;
    q.on = true;
    q.kind = o.kind || "bubble";
    q.x = o.x;
    q.y = o.y;
    q.vx = o.vx || 0;
    q.vy = o.vy || 0;
    q.r = o.r || 3;
    q.life = o.life || 1;
    q.age = 0;
    q.c = o.c || "#ffffff";
    q.g = o.g || 0;
    q.drag = o.drag == null ? 1.5 : o.drag;
    q.grow = o.grow || 0;
    q.a = o.a == null ? 1 : o.a;
    q.ph = Math.random() * TAU;
    q.rot = o.rot || 0;
    q.tx = o.tx;
    q.ty = o.ty;
    q.screen = !!o.screen;
    return q;
  }

  /* ---------------- 묶음 효과 ---------------- */
  bubbles(x, y, n = 6, spread = 10, big = 1) {
    n = Math.ceil(n * this.quality);
    for (let i = 0; i < n; i++) this.spawn({ kind: "bubble", x: x + rand(-spread, spread), y: y + rand(-spread, spread), vx: rand(-20, 20), vy: rand(-90, -40), r: rand(2, 5.5) * big, life: rand(0.8, 1.6), drag: 0.8 });
  }
  /** 물줄기가 맞은 자리: 물보라 + 고리 + 기포 */
  splash(x, y, dir = 0, s = 1) {
    const n = Math.ceil(9 * this.quality * s);
    for (let i = 0; i < n; i++) {
      const a = dir + Math.PI + rand(-1.3, 1.3);
      const sp = rand(80, 260) * s;
      this.spawn({ kind: "drop", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(1.6, 3.4) * s, life: rand(0.25, 0.5), drag: 4, c: "#e9fbff" });
    }
    this.spawn({ kind: "ring", x, y, r: 6 * s, grow: 5, life: 0.35, c: "rgba(255,255,255,0.85)" });
    this.spawn({ kind: "mist", x, y, r: 16 * s, grow: 1.4, life: 0.4, a: 0.6 });
    this.bubbles(x, y, 3 * s, 8);
  }
  /** 막혔을 때 (닫힌 조개 · 단단한 등딱지) */
  ting(x, y) {
    for (let i = 0; i < 6; i++) {
      const a = rand(0, TAU);
      this.spawn({ kind: "spark", x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, r: 4, life: 0.3, drag: 5, c: "#fff6c0" });
    }
  }
  ink(x, y, s = 1) {
    for (let i = 0; i < 8; i++) this.spawn({ kind: "ink", x: x + rand(-18, 18) * s, y: y + rand(-14, 14) * s, vx: rand(-40, 40), vy: rand(-30, 20), r: rand(16, 30) * s, grow: 1.2, life: rand(1.3, 2), drag: 2, a: 0.85 });
  }
  dust(x, y, s = 1) {
    for (let i = 0; i < 10 * s; i++) this.spawn({ kind: "dust", x: x + rand(-24, 24), y: y + rand(-6, 4), vx: rand(-50, 50), vy: rand(-60, -10), r: rand(6, 14), grow: 1.5, life: rand(0.6, 1.1), drag: 2.5, a: 0.75 });
  }
  sparkle(x, y, n = 8, c = "#fff7b0", spread = 30) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(30, 140);
      this.spawn({ kind: "spark", x: x + Math.cos(a) * rand(0, spread * 0.3), y: y + Math.sin(a) * rand(0, spread * 0.3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(3, 6), life: rand(0.4, 0.8), drag: 3, c });
    }
  }
  /** 잡혔을 때 터지는 큰 물방울 폭발 */
  burst(x, y, s = 1) {
    for (let i = 0; i < 22 * this.quality; i++) {
      const a = rand(0, TAU);
      const sp = rand(120, 380) * s;
      this.spawn({ kind: "drop", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(2, 4.5), life: rand(0.4, 0.8), drag: 3, c: "#dff8ff" });
    }
    this.spawn({ kind: "ring", x, y, r: 20 * s, grow: 6, life: 0.5, c: "rgba(255,255,255,0.9)" });
    this.spawn({ kind: "ring", x, y, r: 10 * s, grow: 9, life: 0.7, c: "rgba(140,230,255,0.7)" });
    this.bubbles(x, y, 14, 30, 1.3);
    this.sparkle(x, y, 10, "#fff7b0", 40);
  }
  /** 동전: 세계 자리에서 튀어나와 화면 (tx,ty)로 날아간다 */
  coins(x, y, n, tx, ty) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0);
      this.spawn({ kind: "coin", x, y, vx: Math.cos(a) * rand(80, 200), vy: Math.sin(a) * rand(120, 240), r: 8, life: 0.9 + i * 0.05, drag: 2, tx, ty });
    }
  }
  /** 소나 고리 (세계 좌표) */
  sonar(x, y, r) {
    this.spawn({ kind: "sonar", x, y, r: 10, grow: r, life: 1.1, a: 1 });
  }

  /* ---------------- 글자 ---------------- */
  /**
   * str, x, y, { size, color, stroke, life, rise, screen, punch, delay, sub }
   */
  text(str, x, y, o = {}) {
    const q = this.txt[this.tcur];
    this.tcur = (this.tcur + 1) % MAX_TXT;
    q.on = true;
    q.str = str;
    q.x = x;
    q.y = y;
    q.size = o.size || 24;
    q.color = o.color || "#ffffff";
    q.stroke = o.stroke || "#0b3a66";
    q.life = o.life || 0.8;
    q.rise = o.rise == null ? 40 : o.rise;
    q.screen = !!o.screen;
    q.punch = !!o.punch;
    q.delay = o.delay || 0;
    q.sub = o.sub || "";
    q.age = 0;
    return q;
  }
  showBanner(str, o = {}) {
    this.banner = { str, sub: o.sub || "", color: o.color || "#ffffff", color2: o.color2 || "#7fe9ff", stroke: o.stroke || "#062a5a", size: o.size || 72, life: o.life || 1.6, age: 0 };
  }
  shake(a) {
    this.shakeA = Math.max(this.shakeA, a);
  }
  flash(a = 0.5, c = "#ffffff") {
    this.flashA = Math.max(this.flashA, a);
    this.flashC = c;
  }
  /** 잠깐 느리게 (발견 · PERFECT) */
  slow(k, t) {
    this.slowK = k;
    this.slowT = Math.max(this.slowT, t);
  }
  get timeScale() {
    return this.slowT > 0 ? this.slowK : 1;
  }

  update(dt) {
    // dt 는 실제 시간 (슬로모션과 상관없이 효과는 자연스럽게)
    if (this.slowT > 0) this.slowT -= dt;
    for (const q of this.p) {
      if (!q.on) continue;
      q.age += dt;
      if (q.age >= q.life) {
        q.on = false;
        continue;
      }
      if (q.kind === "coin") {
        // 처음엔 튀고, 나중엔 HUD 로 빨려간다 (화면 좌표로 바뀐다)
        continue;
      }
      const dr = Math.exp(-q.drag * dt);
      q.vx *= dr;
      q.vy *= dr;
      q.vy += q.g * dt;
      if (q.kind === "bubble") {
        q.vy -= 60 * dt;
        q.x += Math.sin(q.age * 7 + q.ph) * 14 * dt;
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    for (const t of this.txt) {
      if (!t.on) continue;
      t.age += dt;
      if (t.age > t.life + t.delay) t.on = false;
    }
    this.shakeA *= Math.exp(-8 * dt);
    if (this.shakeA < 0.3) this.shakeA = 0;
    const s = this.shakeA;
    this.sx = (Math.random() - 0.5) * s * 2;
    this.sy = (Math.random() - 0.5) * s * 2;
    this.flashA = Math.max(0, this.flashA - dt * 2.4);
    if (this.banner) {
      this.banner.age += dt;
      if (this.banner.age > this.banner.life) this.banner = null;
    }
  }

  /** 세계 좌표 입자 (카메라 기준) */
  drawWorld(ctx, cam) {
    const mist = blobSprite("rgba(255,255,255,A)", "mist");
    const ink = blobSprite("rgba(40,20,70,A)", "ink");
    const dust = blobSprite("rgba(230,205,150,A)", "dust");
    for (const q of this.p) {
      if (!q.on || q.kind === "coin") continue;
      const x = q.x - cam.x;
      const y = q.y - cam.y;
      if (x < -80 || x > W + 80 || y < -80 || y > H + 80) continue;
      const k = q.age / q.life;
      const a = q.a * (1 - k * k);
      switch (q.kind) {
        case "bubble": {
          const r = q.r * (1 + k * 0.4);
          ctx.globalAlpha = Math.min(1, a * 1.2);
          ctx.strokeStyle = "rgba(235,252,255,0.95)";
          ctx.lineWidth = Math.max(1, r * 0.28);
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = "rgba(200,245,255,0.25)";
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU);
          ctx.fill();
          break;
        }
        case "drop":
          ctx.globalAlpha = a;
          ctx.fillStyle = q.c;
          ctx.beginPath();
          ctx.arc(x, y, q.r * (1 - k * 0.4), 0, TAU);
          ctx.fill();
          break;
        case "ring":
          ctx.globalAlpha = a;
          ctx.strokeStyle = q.c;
          ctx.lineWidth = 3 * (1 - k) + 0.6;
          ctx.beginPath();
          ctx.arc(x, y, q.r * (1 + k * q.grow), 0, TAU);
          ctx.stroke();
          break;
        case "mist": {
          const r = q.r * (1 + k * q.grow);
          ctx.globalAlpha = a;
          put(ctx, mist, x, y, r / 32);
          break;
        }
        case "ink": {
          const r = q.r * (1 + k * q.grow);
          ctx.globalAlpha = a * 0.9;
          put(ctx, ink, x, y, r / 32);
          break;
        }
        case "dust": {
          const r = q.r * (1 + k * q.grow);
          ctx.globalAlpha = a;
          put(ctx, dust, x, y, r / 32);
          break;
        }
        case "spark": {
          ctx.globalAlpha = a;
          ctx.fillStyle = q.c;
          const r = q.r * (1 - k * 0.5);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const rr = i % 2 ? r * 0.3 : r;
            const ang = (i / 8) * TAU + q.ph;
            ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "sonar": {
          const r = q.r + q.grow * ease.out(k);
          ctx.globalAlpha = 0.6 * (1 - k);
          ctx.strokeStyle = "#8ff6ff";
          ctx.lineWidth = 6 * (1 - k) + 1.5;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 0.25 * (1 - k);
          ctx.lineWidth = 18 * (1 - k);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** 동전 (세계 → 화면으로 날아감) */
  drawCoins(ctx, cam) {
    for (const q of this.p) {
      if (!q.on || q.kind !== "coin") continue;
      const k = q.age / q.life;
      // 처음 35%: 세계에서 튐 · 그 뒤: 화면 목표로
      const k1 = Math.min(1, k / 0.35);
      const wx = q.x + q.vx * 0.35 * k1 - cam.x;
      const wy = q.y + q.vy * 0.35 * k1 + 160 * k1 * k1 * 0.35 - cam.y;
      const k2 = clamp((k - 0.35) / 0.65, 0, 1);
      const e = ease.inOut(k2);
      const x = wx + (q.tx - wx) * e;
      const y = wy + (q.ty - wy) * e - Math.sin(e * Math.PI) * 60;
      const sq = Math.abs(Math.cos(q.age * 14));
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "#b07a00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, q.r * (0.3 + sq * 0.7), q.r, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff6c0";
      ctx.beginPath();
      ctx.ellipse(x - q.r * 0.25 * sq, y - q.r * 0.3, q.r * 0.25 * sq + 0.5, q.r * 0.3, 0, 0, TAU);
      ctx.fill();
    }
  }

  drawTexts(ctx, cam) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const t of this.txt) {
      if (!t.on || t.age < t.delay) continue;
      const k = (t.age - t.delay) / t.life;
      const x = t.screen ? t.x : t.x - cam.x;
      const y = (t.screen ? t.y : t.y - cam.y) - t.rise * ease.out(k);
      const pop = t.punch ? (k < 0.15 ? 0.4 + (k / 0.15) * 0.9 : k < 0.25 ? 1.3 - ((k - 0.15) / 0.1) * 0.3 : 1) : k < 0.12 ? 0.6 + (k / 0.12) * 0.4 : 1;
      const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.globalAlpha = a;
      ctx.font = `${Math.round(t.size * pop)}px "Bagel Fat One", "Jua", sans-serif`;
      ctx.lineWidth = Math.max(3, t.size * 0.18);
      ctx.strokeStyle = t.stroke;
      ctx.strokeText(t.str, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, x, y);
      if (t.sub) {
        ctx.font = `${Math.round(t.size * 0.48)}px "Jua", sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeText(t.sub, x, y + t.size * 0.78);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(t.sub, x, y + t.size * 0.78);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawScreen(ctx) {
    if (this.banner) {
      const b = this.banner;
      const k = b.age / b.life;
      const inK = Math.min(1, b.age / 0.3);
      const s = ease.back(inK);
      const a = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, H * 0.36);
      ctx.scale(s, s);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.font = `${b.size}px "Bagel Fat One", sans-serif`;
      for (let i = 6; i >= 1; i--) {
        ctx.fillStyle = b.stroke;
        ctx.fillText(b.str, 0, i);
      }
      ctx.lineWidth = b.size * 0.12;
      ctx.strokeStyle = b.stroke;
      ctx.strokeText(b.str, 0, 0);
      const g = ctx.createLinearGradient(0, -b.size / 2, 0, b.size / 2);
      g.addColorStop(0, b.color);
      g.addColorStop(0.55, b.color);
      g.addColorStop(0.56, b.color2);
      g.addColorStop(1, b.color2);
      ctx.fillStyle = g;
      ctx.fillText(b.str, 0, 0);
      if (b.sub) {
        ctx.font = `${Math.round(b.size * 0.32)}px "Jua", sans-serif`;
        ctx.lineWidth = 6;
        ctx.strokeText(b.sub, 0, b.size * 0.78);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(b.sub, 0, b.size * 0.78);
      }
      ctx.restore();
    }
    if (this.flashA > 0) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashC;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }
}
