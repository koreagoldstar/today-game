/*
 * 물총 대작전 엔진 · EffectSystem
 * 파티클 · 떠오르는 글자 · 화면 흔들림 · 번쩍임 · 큰 배너.
 * 전부 미리 만든 풀(pool)을 돌려 써서 판이 길어져도 쓰레기가 쌓이지 않는다.
 */
import { W, H, rand, ease } from "./view.js?v=2";

const MAX_PARTS = 520;
const MAX_TEXTS = 36;

export class EffectSystem {
  constructor() {
    this.parts = Array.from({ length: MAX_PARTS }, () => ({ on: false }));
    this.texts = Array.from({ length: MAX_TEXTS }, () => ({ on: false }));
    this.cursor = 0;
    this.tcursor = 0;
    this.shakeAmp = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.flashA = 0;
    this.flashColor = "#fff";
    this.banner = null;
    this.quality = 1; // 0.5 = 가벼운 효과
    this.screenDrops = []; // 화면에 맺힌 물방울 (보트가 맞았을 때)
    this.inks = []; // 먹물 얼룩
  }

  reset() {
    for (const p of this.parts) p.on = false;
    for (const t of this.texts) t.on = false;
    this.shakeAmp = 0;
    this.flashA = 0;
    this.banner = null;
    this.screenDrops.length = 0;
    this.inks.length = 0;
  }

  spawn(o) {
    // 빈 칸을 찾아 쓰고, 없으면 가장 오래된 것을 덮어쓴다
    for (let k = 0; k < MAX_PARTS; k++) {
      const i = (this.cursor + k) % MAX_PARTS;
      if (!this.parts[i].on) {
        this.cursor = (i + 1) % MAX_PARTS;
        return Object.assign(this.parts[i], PART_DEFAULT, o, { on: true, age: 0 });
      }
    }
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PARTS;
    return Object.assign(p, PART_DEFAULT, o, { on: true, age: 0 });
  }

  /* ---------- 자주 쓰는 묶음 ---------- */

  splash(x, y, s = 1, { color = "#7fd6ff", count = 16, power = 1, ring = true } = {}) {
    const n = Math.round(count * this.quality);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + rand(-1.25, 1.25);
      const sp = rand(140, 360) * s * power;
      this.spawn({
        kind: "drop",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 820 * s,
        r: rand(3, 7) * s,
        life: rand(0.45, 0.8),
        color: Math.random() < 0.3 ? "#ffffff" : color,
      });
    }
    if (ring) {
      this.spawn({ kind: "ring", x, y: y + 6 * s, r: 8 * s, grow: 130 * s, life: 0.5, color: "#ffffff", w: 4 * s, flat: 0.4 });
      this.spawn({ kind: "ring", x, y: y + 6 * s, r: 4 * s, grow: 80 * s, life: 0.6, color: color, w: 3 * s, flat: 0.4, delay: 0.08 });
    }
  }

  /** 수면에 맞았을 때: 왕관 모양 물보라 + 물방울 + 물결 고리 */
  impact(x, y, s = 1, { onWater = true, color = "#8fdcff", power = 1 } = {}) {
    this.spawn({ kind: "glow", x, y, r: 26 * s, life: 0.18, color: "255,255,255" });
    if (onWater) {
      this.spawn({ kind: "crown", x, y, r: 18 * s, h: 30 * s * power, life: 0.42, seed: Math.random() * 10, color });
      this.spawn({ kind: "ring", x, y: y + 4 * s, r: 10 * s, grow: 120 * s, life: 0.55, color: "#ffffff", w: 4 * s, flat: 0.32 });
      this.spawn({ kind: "ring", x, y: y + 4 * s, r: 4 * s, grow: 70 * s, life: 0.7, color, w: 3 * s, flat: 0.32, delay: 0.1 });
    } else {
      this.spawn({ kind: "splat", x, y, r: 10 * s, grow: 90 * s, life: 0.3, color: "#ffffff" });
    }
    const n = Math.round((onWater ? 12 : 14) * this.quality);
    for (let i = 0; i < n; i++) {
      const a = onWater ? -Math.PI / 2 + rand(-1.1, 1.1) : rand(0, Math.PI * 2);
      const sp = rand(120, 320) * s * power;
      this.spawn({ kind: "drop", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (onWater ? 60 : 30) * s, g: 900 * s, r: rand(2.5, 6) * s, life: rand(0.35, 0.65), color: Math.random() < 0.35 ? "#ffffff" : color });
    }
  }

  /** PERFECT! — 사방으로 뻗는 빛줄기 + 반짝 */
  perfectBurst(x, y, s = 1) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.1, 0.1);
      this.spawn({ kind: "line", x, y, ang: a, r: 18 * s, len: rand(40, 80) * s, life: 0.32, w: rand(3, 6) * s, color: i % 2 ? "#fff6b0" : "#ffffff" });
    }
    this.spawn({ kind: "glow", x, y, r: 70 * s, life: 0.28, color: "255,240,170" });
    this.sparkle(x, y, 1.4 * s, 12, "#fff2a8");
  }

  mist(x, y, s = 1, color = "rgba(255,255,255,0.8)") {
    for (let i = 0; i < 5 * this.quality; i++) {
      this.spawn({ kind: "puff", x: x + rand(-18, 18) * s, y: y + rand(-10, 10) * s, vx: rand(-30, 30), vy: rand(-50, -10), r: rand(10, 18) * s, grow: 30 * s, life: rand(0.4, 0.7), color });
    }
  }

  stars(x, y, s = 1, n = 6) {
    for (let i = 0; i < n * this.quality; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(90, 220) * s;
      this.spawn({ kind: "star", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: 260, r: rand(6, 11) * s, life: rand(0.6, 1), spin: rand(-8, 8), color: Math.random() < 0.5 ? "#ffe066" : "#fff6b0" });
    }
  }

  sparkle(x, y, s = 1, n = 8, color = "#fff7b0") {
    for (let i = 0; i < n * this.quality; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 200) * s;
      this.spawn({ kind: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(5, 10) * s, life: rand(0.35, 0.7), spin: rand(-4, 4), color });
    }
  }

  bubbles(x, y, s = 1, n = 6) {
    for (let i = 0; i < n * this.quality; i++) {
      this.spawn({ kind: "bubble", x: x + rand(-20, 20) * s, y: y + rand(-6, 6) * s, vx: rand(-20, 20), vy: rand(-110, -50) * s, r: rand(3, 8) * s, life: rand(0.6, 1.2), wob: rand(0, 6) });
    }
  }

  confetti(n = 60) {
    const cols = ["#ff5d8f", "#ffd23f", "#4fd1c5", "#7c83fd", "#ff9f43", "#5be37d"];
    for (let i = 0; i < n * this.quality; i++) {
      this.spawn({ kind: "confetti", x: rand(0, W), y: rand(-80, -10), vx: rand(-60, 60), vy: rand(120, 260), g: 40, r: rand(5, 9), life: rand(2, 3.2), spin: rand(-9, 9), color: cols[i % cols.length] });
    }
  }

  coins(x, y, n = 6) {
    for (let i = 0; i < n * this.quality; i++) {
      const a = -Math.PI / 2 + rand(-1, 1);
      const sp = rand(160, 300);
      this.spawn({ kind: "coin", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 700, r: rand(6, 9), life: rand(0.7, 1.1), spin: rand(6, 12) });
    }
  }

  ink(x, y, s = 1) {
    for (let i = 0; i < 10 * this.quality; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 200) * s;
      this.spawn({ kind: "drop", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 500, r: rand(4, 9) * s, life: rand(0.4, 0.7), color: "#5b3a8c" });
    }
  }

  /** 화면 앞에 맺히는 먹물 — 몇 초 뒤 흘러내리며 사라진다 */
  inkScreen(n = 3) {
    for (let i = 0; i < n; i++) this.inks.push({ x: rand(80, W - 80), y: rand(260, 680), r: rand(55, 85), age: 0, life: 2.6, seed: Math.random() * 10 });
  }

  /** 보트가 젖었을 때 화면 가장자리에 물방울 */
  wetScreen(n = 14) {
    for (let i = 0; i < n; i++) {
      const edge = Math.random();
      this.screenDrops.push({
        x: edge < 0.5 ? rand(0, W) : Math.random() < 0.5 ? rand(0, 90) : rand(W - 90, W),
        y: edge < 0.5 ? rand(H - 240, H) : rand(200, H),
        r: rand(10, 26),
        vy: rand(10, 40),
        age: 0,
        life: rand(1.4, 2.4),
      });
    }
  }

  text(str, x, y, { color = "#fff", size = 26, life = 0.9, rise = 70, stroke = "#1b4b72", pop = true, font = "Bagel Fat One" } = {}) {
    const t = this.texts[this.tcursor];
    this.tcursor = (this.tcursor + 1) % MAX_TEXTS;
    Object.assign(t, { on: true, str, x, y, color, size, life, rise, stroke, pop, font, age: 0 });
    return t;
  }

  showBanner(str, { sub = "", color = "#fff", stroke = "#0b4f7c", life = 1.4, size = 64 } = {}) {
    this.banner = { str, sub, color, stroke, life, size, age: 0 };
  }

  shake(a) {
    this.shakeAmp = Math.max(this.shakeAmp, a);
  }

  flash(a = 0.6, color = "#ffffff") {
    this.flashA = Math.max(this.flashA, a);
    this.flashColor = color;
  }

  /* ---------- 갱신 ---------- */

  update(dt) {
    for (const p of this.parts) {
      if (!p.on) continue;
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.on = false;
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.kind === "ring" || p.kind === "puff" || p.kind === "splat") p.r += p.grow * dt;
      if (p.kind === "bubble") p.x += Math.sin(p.age * 8 + p.wob) * 30 * dt;
    }
    for (const t of this.texts) {
      if (!t.on) continue;
      t.age += dt;
      if (t.age >= t.life) t.on = false;
    }
    if (this.shakeAmp > 0.1) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeAmp;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeAmp;
      this.shakeAmp *= Math.pow(0.0025, dt);
    } else {
      this.shakeAmp = this.shakeX = this.shakeY = 0;
    }
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    if (this.banner) {
      this.banner.age += dt;
      if (this.banner.age > this.banner.life) this.banner = null;
    }
    for (let i = this.screenDrops.length - 1; i >= 0; i--) {
      const d = this.screenDrops[i];
      d.age += dt;
      d.y += d.vy * dt;
      d.vy += 30 * dt;
      if (d.age > d.life) this.screenDrops.splice(i, 1);
    }
    for (let i = this.inks.length - 1; i >= 0; i--) {
      const k = this.inks[i];
      k.age += dt;
      if (k.age > k.life) this.inks.splice(i, 1);
    }
  }

  /* ---------- 그리기 ---------- */

  draw(ctx) {
    for (const p of this.parts) {
      if (!p.on || p.delay > 0) continue;
      const k = p.age / p.life;
      const a = 1 - k;
      switch (p.kind) {
        case "drop": {
          ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.fillStyle = p.color;
          const sp = Math.hypot(p.vx, p.vy);
          const ang = Math.atan2(p.vy, p.vx);
          const st = Math.min(2.2, 1 + sp / 500);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * st, p.r, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
        case "ring":
          ctx.globalAlpha = a * 0.9;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.w * a + 0.5;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r, p.r * p.flat, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "glow": {
          ctx.globalAlpha = a * a;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (0.6 + k * 0.6));
          g.addColorStop(0, `rgba(${p.color},0.95)`);
          g.addColorStop(1, `rgba(${p.color},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (0.6 + k * 0.6), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "crown": {
          // 왕관 물보라: 둥근 테두리에서 물기둥이 솟았다 떨어진다
          const grow = 0.45 + ease.out(k) * 0.9;
          const rise = Math.sin(Math.min(1, k * 1.25) * Math.PI);
          const n = 11;
          ctx.globalAlpha = Math.min(1, a * 1.6);
          ctx.lineCap = "round";
          for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < n; i++) {
              const th = (i / n) * Math.PI * 2 + p.seed;
              const back = Math.sin(th) < 0;
              if ((pass === 0) !== back) continue;
              const bx = p.x + Math.cos(th) * p.r * grow;
              const by = p.y + Math.sin(th) * p.r * 0.32 * grow;
              const hh = p.h * rise * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.7 + p.seed)));
              const tx = bx + Math.cos(th) * hh * 0.35;
              const ty = by - hh;
              ctx.strokeStyle = back ? "rgba(190,235,255,0.85)" : "rgba(235,250,255,0.95)";
              ctx.lineWidth = Math.max(1, 3.6 * (1 - k * 0.6) * (p.r / 18));
              ctx.beginPath();
              ctx.moveTo(bx, by);
              ctx.quadraticCurveTo(bx + Math.cos(th) * hh * 0.05, by - hh * 0.6, tx, ty);
              ctx.stroke();
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(tx, ty, ctx.lineWidth * 0.85, 0, Math.PI * 2);
              ctx.fill();
            }
            if (pass === 0) {
              ctx.strokeStyle = "rgba(255,255,255,0.85)";
              ctx.lineWidth = Math.max(1, 3 * (1 - k));
              ctx.beginPath();
              ctx.ellipse(p.x, p.y, p.r * grow, p.r * 0.32 * grow, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          break;
        }
        case "splat":
          ctx.globalAlpha = a * 0.8;
          ctx.fillStyle = "rgba(220,245,255,0.55)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3 * a;
          ctx.stroke();
          break;
        case "line": {
          const r0 = p.r + ease.out(k) * p.len;
          const r1 = r0 + p.len * 0.5 * (1 - k);
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.w * a;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(p.ang) * r0, p.y + Math.sin(p.ang) * r0);
          ctx.lineTo(p.x + Math.cos(p.ang) * r1, p.y + Math.sin(p.ang) * r1);
          ctx.stroke();
          break;
        }
        case "puff":
          ctx.globalAlpha = a * 0.7;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "star":
          ctx.globalAlpha = Math.min(1, a * 2);
          drawStar(ctx, p.x, p.y, p.r, p.rot, p.color);
          break;
        case "spark":
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.r, -p.r * 0.18, p.r * 2, p.r * 0.36);
          ctx.fillRect(-p.r * 0.18, -p.r, p.r * 0.36, p.r * 2);
          ctx.restore();
          break;
        case "bubble":
          ctx.globalAlpha = a * 0.85;
          ctx.strokeStyle = "#e9fbff";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.beginPath();
          ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.25, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "confetti":
          ctx.globalAlpha = Math.min(1, a * 3);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.abs(Math.cos(p.age * 7 + p.rot)));
          ctx.fillRect(-p.r * 0.6, -p.r * 0.35, p.r * 1.2, p.r * 0.7);
          ctx.restore();
          break;
        case "coin": {
          ctx.globalAlpha = Math.min(1, a * 2);
          const sx = Math.abs(Math.cos(p.age * p.spin));
          ctx.fillStyle = "#ffcc33";
          ctx.strokeStyle = "#b07800";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r * sx + 1, p.r, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const t of this.texts) {
      if (!t.on) continue;
      const k = t.age / t.life;
      const sc = t.pop ? (k < 0.18 ? ease.back(k / 0.18) : 1) : 1;
      const y = t.y - ease.out(k) * t.rise;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.save();
      ctx.translate(t.x, y);
      ctx.scale(sc, sc);
      ctx.font = `${t.size}px "${t.font}", "Jua", sans-serif`;
      ctx.lineWidth = Math.max(4, t.size * 0.22);
      ctx.strokeStyle = t.stroke;
      ctx.strokeText(t.str, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** 화면 맨 앞 (HUD 바로 아래) — 물방울, 먹물, 번쩍임, 배너 */
  drawOverlay(ctx, now) {
    for (const k of this.inks) {
      const a = k.age < 0.15 ? k.age / 0.15 : k.age > k.life - 0.8 ? (k.life - k.age) / 0.8 : 1;
      ctx.globalAlpha = a * 0.92;
      ctx.fillStyle = "#3d2266";
      const drip = Math.max(0, k.age - 0.6) * 40;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        const rr = k.r * (0.8 + 0.25 * Math.sin(k.seed + i * 2.1));
        ctx.lineTo(k.x + Math.cos(ang) * rr, k.y + Math.sin(ang) * rr + (Math.sin(ang) > 0.3 ? drip : 0));
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(k.x - k.r * 0.3, k.y - k.r * 0.3, k.r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const d of this.screenDrops) {
      const a = d.age > d.life - 0.5 ? (d.life - d.age) / 0.5 : 1;
      ctx.globalAlpha = a * 0.55;
      const g = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 1, d.x, d.y, d.r);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.5, "rgba(170,225,255,0.35)");
      g.addColorStop(1, "rgba(120,200,255,0.55)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r * 0.85, d.r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.flashA > 0.01) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    const b = this.banner;
    if (b) {
      const k = b.age / b.life;
      const sc = k < 0.15 ? ease.back(k / 0.15) : k > 0.85 ? 1 + (k - 0.85) * 2 : 1;
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      ctx.save();
      ctx.translate(W / 2, H * 0.4);
      ctx.scale(sc, sc);
      ctx.rotate(Math.sin(now * 3) * 0.02);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.font = `${b.size}px "Bagel Fat One", "Jua", sans-serif`;
      ctx.lineWidth = b.size * 0.28;
      ctx.strokeStyle = b.stroke;
      ctx.strokeText(b.str, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.str, 0, 0);
      if (b.sub) {
        ctx.font = `26px "Jua", sans-serif`;
        ctx.lineWidth = 7;
        ctx.strokeText(b.sub, 0, b.size * 0.78);
        ctx.fillStyle = "#fff";
        ctx.fillText(b.sub, 0, b.size * 0.78);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
}

const PART_DEFAULT = { x: 0, y: 0, vx: 0, vy: 0, g: 0, r: 4, life: 1, rot: 0, spin: 0, grow: 0, color: "#fff", w: 2, flat: 1, delay: 0, wob: 0, h: 0, seed: 0, ang: 0, len: 0 };

export function drawStar(ctx, x, y, r, rot, color, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}
