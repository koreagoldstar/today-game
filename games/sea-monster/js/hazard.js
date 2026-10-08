/*
 * 바다괴물 탐험대 · 지역 기믹 (위험물)
 *  zap      전기 말미잘   (해파리 계곡) 찌릿찌릿 모았다가 번쩍! 둥근 전기
 *  geyser   용암 분수구   (화산 해저)   우르르 → 뜨거운 기포 기둥
 *  icicle   고드름        (얼음 바다)   밑으로 지나가면 흔들 → 뚝!
 *  current  물살          (심해 협곡 · 폭풍) 지혁을 한쪽으로 민다 (다치지 않는다)
 * 모두 "준비 몸짓"이 먼저 보인다 → 보고 피할 수 있다.
 */
import { TAU, clamp, rand, dist } from "./view.js?v=1";
import { zapAnemone } from "../art/monsters5.js?v=1";
import { lureBulb } from "../art/monsters8.js?v=1";

/** 지그재그 번개 (x0,y0) → (x1,y1) */
export function bolt(ctx, x0, y0, x1, y1, jag = 10, n = 6) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.hypot(dx, dy) + 1;
  const nx = -dy / d;
  const ny = dx / d;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) {
    const k = i / n;
    const o = (Math.random() - 0.5) * 2 * jag;
    ctx.lineTo(x0 + dx * k + nx * o, y0 + dy * k + ny * o);
  }
  ctx.lineTo(x1, y1);
}
/** 번개 고리 */
export function zapRing(ctx, x, y, r, a = 1, color = "#fff36a") {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const n = Math.max(12, Math.round(r / 9));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const ang = (i / n) * TAU;
    const rr = r + (i === n ? 0 : (Math.random() - 0.5) * 18);
    pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr]);
  }
  pts[n] = pts[0];
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
  };
  path();
  ctx.strokeStyle = "rgba(160,120,255,0.5)";
  ctx.lineWidth = 12;
  ctx.stroke();
  path();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
  path();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

export class Hazard {
  constructor(kind, x, y, o = {}) {
    Object.assign(this, { kind, x, y, t: rand(0, 3), st: 0, phase: "idle", k: 0 }, o);
    this.cd = o.cd || rand(1.5, 3.5);
    if (kind === "icicle") {
      this.y0 = y;
      this.len = o.len || 70;
    }
  }

  update(dt, g) {
    this.t += dt;
    this.st += dt;
    const pl = g.player;
    switch (this.kind) {
      case "zap": {
        // 쉬기 → 모으기(1.1초 · 노랗게) → 번쩍(0.35초)
        const near = pl && dist(pl.x, pl.y, this.x, this.y) < 520;
        if (this.phase === "idle") {
          this.k = 0;
          this.cd -= dt * (near ? 1 : 0.5);
          if (this.cd <= 0) this.set("charge");
        } else if (this.phase === "charge") {
          this.k = Math.min(1, this.st / 1.1);
          if (near && Math.random() < dt * 8) g.fx.sparkle(this.x + rand(-30, 30), this.y - 30 - rand(0, 20), 1, "#fff36a", 10);
          if (this.st >= 1.1) {
            this.set("zap");
            if (near) {
              g.audio.play("zap");
              g.fx.shake(3);
            }
          }
        } else if (this.phase === "zap") {
          this.k = this.st / 0.35;
          if (this.st >= 0.35) {
            this.set("idle");
            this.cd = this.period || rand(2.4, 3.4);
          }
        }
        break;
      }
      case "geyser": {
        // 쉬기 → 우르르(1초 · 빨갛게 · 작은 기포) → 분수(1.3초)
        const near = pl && dist(pl.x, pl.y, this.x, this.y - 150) < 560;
        if (this.phase === "idle") {
          this.cd -= dt;
          this.k = 0;
          if (this.cd <= 0) this.set("rumble");
        } else if (this.phase === "rumble") {
          this.k = this.st / 1;
          if (Math.random() < dt * 14) g.fx.bubbles(this.x + rand(-14, 14), this.y - 10, 1, 4, 0.8);
          if (this.st >= 1) {
            this.set("burst");
            if (near) {
              g.audio.play("geyser");
              g.fx.shake(4);
            }
          }
        } else if (this.phase === "burst") {
          this.k = this.st / 1.3;
          if (Math.random() < dt * 30) g.fx.spawn({ kind: "bubble", x: this.x + rand(-20, 20), y: this.y - rand(0, 60), vx: rand(-30, 30), vy: rand(-520, -360), r: rand(3, 7), life: rand(0.6, 0.9), drag: 0.6 });
          if (this.st >= 1.3) {
            this.set("idle");
            this.cd = this.period || rand(2.6, 3.6);
          }
        }
        break;
      }
      case "icicle": {
        // 매달림 → 지혁이 밑에 오면 흔들(0.7초) → 뚝! → 바닥에 부서짐 → 다시 자람
        if (this.phase === "idle") {
          this.k = Math.min(1, this.k + dt * 0.5);
          if (this.k >= 1 && pl && Math.abs(pl.x - this.x) < 90 && pl.y > this.y && pl.y - this.y < 520) {
            this.set("shake");
            g.audio.play("crack");
          }
        } else if (this.phase === "shake") {
          if (this.st >= 0.7) {
            this.set("fall");
            this.vy = 120;
          }
        } else if (this.phase === "fall") {
          this.vy += 900 * dt;
          this.y += this.vy * dt;
          if (!g.world.open(this.x, this.y + this.len * 0.6, 2) || this.y - this.y0 > 1400) {
            g.fx.ting(this.x, this.y + this.len * 0.5);
            for (let i = 0; i < 8; i++) {
              const a = rand(-Math.PI, 0);
              g.fx.spawn({ kind: "spark", x: this.x, y: this.y + this.len * 0.5, vx: Math.cos(a) * rand(80, 220), vy: Math.sin(a) * rand(80, 220), r: rand(3, 6), life: 0.5, drag: 3, c: "#dff6ff" });
            }
            if (dist(pl.x, pl.y, this.x, this.y) < 600) g.audio.play("shatter");
            this.set("gone");
          }
        } else if (this.phase === "gone") {
          if (this.st > 3.5) {
            this.y = this.y0;
            this.k = 0;
            this.set("idle");
          }
        }
        break;
      }
      case "dart": {
        // 쉬기 → 눈이 빛남(0.8초) → 돌 화살 쏘기
        const near = pl && dist(pl.x, pl.y, this.x, this.y) < 640;
        if (this.phase === "idle") {
          this.cd -= dt;
          this.k = 0;
          if (this.cd <= 0 && near) this.set("charge");
        } else if (this.phase === "charge") {
          this.k = this.st / 0.8;
          if (this.st >= 0.8) {
            g.shoot({ kind: "dart", x: this.x + this.dir * 30, y: this.y, vx: this.dir * 380, vy: 0, r: 9, dmg: 4, life: 3 });
            g.audio.play("throw");
            this.set("idle");
            this.cd = this.period || rand(2.2, 3.0);
          }
        }
        break;
      }
      case "whirl": {
        const R = this.r || 170;
        if (pl && pl.control) {
          const dx = pl.x - this.x;
          const dy = pl.y - this.y;
          const d = Math.hypot(dx, dy) + 1;
          if (d < R) {
            const k = 1 - d / R;
            const f = (this.force || 520) * k;
            const s = this.dir || 1;
            pl.vx += ((-dy / d) * s * f - (dx / d) * f * 0.35) * dt;
            pl.vy += ((dx / d) * s * f - (dy / d) * f * 0.35) * dt;
          }
        }
        if (Math.random() < dt * 8 && g.onScreen(this.x, this.y, R)) {
          const a = rand(0, TAU);
          const r0 = rand(40, R);
          g.fx.spawn({ kind: "bubble", x: this.x + Math.cos(a) * r0, y: this.y + Math.sin(a) * r0, vx: -Math.sin(a) * 160 * (this.dir || 1), vy: Math.cos(a) * 160 * (this.dir || 1), r: rand(1.5, 3), life: 0.8, drag: 0.4 });
        }
        break;
      }
      case "current": {
        // 물살 띠: 안에 있으면 한쪽으로 밀린다 (다치지는 않는다)
        if (pl && pl.control && pl.x > this.x0 && pl.x < this.x1 && pl.y > this.y0 && pl.y < this.y1) {
          const on = this.pulse ? 0.5 + 0.5 * Math.sin(this.t * 1.2) : 1;
          pl.vx += this.fx * on * dt;
          pl.vy += this.fy * on * dt;
        }
        if (pl && Math.random() < dt * 6 && g.onScreen((this.x0 + this.x1) / 2, (this.y0 + this.y1) / 2, 400)) {
          const x = rand(this.x0, this.x1);
          const y = rand(this.y0, this.y1);
          g.fx.spawn({ kind: "bubble", x, y, vx: this.fx * 0.9, vy: this.fy * 0.9 - 10, r: rand(1.5, 3), life: 1.2, drag: 0.2, a: 0.7 });
        }
        break;
      }
    }
  }
  set(ph) {
    this.phase = ph;
    this.st = 0;
  }

  /** 지혁을 다치게 하는 곳 { x, y, r, ring? , rect? } */
  harm() {
    if (this.kind === "zap" && this.phase === "zap") return { x: this.x, y: this.y - 34, r: 40 + this.k * (this.r || 120) };
    if (this.kind === "geyser" && this.phase === "burst" && this.k < 0.92) return { rect: true, x0: this.x - 30, x1: this.x + 30, y0: this.y - (this.h || 380) * Math.min(1, this.k * 4), y1: this.y, x: this.x, y: this.y - 60 };
    if (this.kind === "icicle" && this.phase === "fall") return { x: this.x, y: this.y + this.len * 0.45, r: 20 };
    return null;
  }
  get dmg() {
    return { zap: 4, geyser: 5, icicle: 4 }[this.kind] || 4;
  }
  /** 어둠 속 빛 */
  light() {
    if (this.kind === "zap") return { x: this.x, y: this.y - 30, r: 70 + this.k * 90 + (this.phase === "zap" ? 120 : 0) };
    if (this.kind === "geyser") return { x: this.x, y: this.y - 20, r: 80 + (this.phase === "rumble" ? this.k * 60 : this.phase === "burst" ? 140 : 0) };
    if (this.kind === "lure") return { x: this.x + Math.sin(this.t * 0.8) * 10, y: this.y + Math.sin(this.t * 1.1) * 8, r: 100 };
    return null;
  }

  draw(ctx, cam, t) {
    const x = this.x - cam.x;
    const y = this.y - cam.y;
    switch (this.kind) {
      case "zap": {
        ctx.save();
        ctx.translate(x, y);
        const ch = this.phase === "charge" ? this.k : this.phase === "zap" ? 1 : 0;
        zapAnemone(ctx, this.t, ch, this.phase === "zap");
        ctx.restore();
        if (this.phase === "charge" && this.k > 0.25) {
          // 예고: 노란 점선 원 (곧 여기까지 찌릿)
          ctx.save();
          ctx.setLineDash([8, 10]);
          ctx.lineDashOffset = -t * 40;
          ctx.strokeStyle = `rgba(255,243,106,${0.25 + this.k * 0.45})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y - 34, 40 + (this.r || 120), 0, TAU);
          ctx.stroke();
          ctx.restore();
          ctx.strokeStyle = "#fffbe0";
          ctx.lineWidth = 2;
          for (let i = 0; i < 2; i++) {
            const a = rand(0, TAU);
            bolt(ctx, x, y - 34, x + Math.cos(a) * 40 * this.k, y - 34 + Math.sin(a) * 40 * this.k, 6, 4);
            ctx.stroke();
          }
        }
        if (this.phase === "zap") {
          const r = 40 + this.k * (this.r || 120);
          zapRing(ctx, x, y - 34, r, 1 - this.k * 0.6);
          ctx.strokeStyle = "#fffbe0";
          ctx.lineWidth = 2.6;
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU + t * 3;
            bolt(ctx, x, y - 34, x + Math.cos(a) * r, y - 34 + Math.sin(a) * r, 12, 6);
            ctx.stroke();
          }
        }
        break;
      }
      case "geyser": {
        // 분수구 (바닥 굴뚝)
        ctx.save();
        ctx.translate(x, y);
        const hot = this.phase === "rumble" ? this.k : this.phase === "burst" ? 1 : 0.15;
        ctx.fillStyle = "#3a2a2a";
        ctx.strokeStyle = "#1a0e0e";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-44, 6);
        ctx.quadraticCurveTo(-34, -18, -18, -30);
        ctx.lineTo(18, -30);
        ctx.quadraticCurveTo(34, -18, 44, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const lg = ctx.createRadialGradient(0, -30, 2, 0, -30, 26);
        lg.addColorStop(0, `rgba(255,${200 + hot * 55},120,${0.5 + hot * 0.5})`);
        lg.addColorStop(1, "rgba(255,80,20,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(-30, -56, 60, 52);
        ctx.fillStyle = `rgb(${200 + hot * 55},${80 + hot * 90},30)`;
        ctx.beginPath();
        ctx.ellipse(0, -30, 18, 6, 0, 0, TAU);
        ctx.fill();
        // 용암 금
        ctx.strokeStyle = `rgba(255,${120 + hot * 100},40,${0.5 + hot * 0.5})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-30, -2);
        ctx.lineTo(-20, -14);
        ctx.lineTo(-24, -22);
        ctx.moveTo(26, 0);
        ctx.lineTo(18, -12);
        ctx.stroke();
        if (this.phase === "rumble") {
          ctx.translate(Math.sin(t * 60) * 2, 0);
          ctx.strokeStyle = `rgba(255,150,60,${this.k * 0.7})`;
          ctx.setLineDash([10, 10]);
          ctx.lineDashOffset = t * 60;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-26, -36);
          ctx.lineTo(-26, -(this.h || 380));
          ctx.moveTo(26, -36);
          ctx.lineTo(26, -(this.h || 380));
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (this.phase === "burst") {
          const h = (this.h || 380) * Math.min(1, this.k * 4) * (this.k > 0.85 ? 1 - (this.k - 0.85) / 0.15 : 1);
          const g = ctx.createLinearGradient(0, -30, 0, -30 - h);
          g.addColorStop(0, "rgba(255,240,170,0.95)");
          g.addColorStop(0.3, "rgba(255,150,60,0.8)");
          g.addColorStop(1, "rgba(255,90,40,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(-16, -30);
          for (let i = 0; i <= 8; i++) {
            const k = i / 8;
            ctx.lineTo(-16 - k * 14 + Math.sin(t * 20 + i) * 5, -30 - k * h);
          }
          for (let i = 8; i >= 0; i--) {
            const k = i / 8;
            ctx.lineTo(16 + k * 14 + Math.sin(t * 22 + i * 2) * 5, -30 - k * h);
          }
          ctx.closePath();
          ctx.fill();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "rgba(255,160,80,0.25)";
          ctx.fillRect(-40, -30 - h, 80, h);
        }
        ctx.restore();
        break;
      }
      case "dart": {
        // 벽의 돌 물고기 머리 (입에서 화살)
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(this.dir, 1);
        ctx.beginPath();
        ctx.moveTo(-30, -26);
        ctx.quadraticCurveTo(18, -30, 34, -4);
        ctx.lineTo(34, 6);
        ctx.quadraticCurveTo(18, 30, -30, 26);
        ctx.closePath();
        ctx.fillStyle = "#7a8a8c";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#2a3436";
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(28, 1, 6, 4, 0, 0, TAU);
        ctx.fillStyle = "#1a2224";
        ctx.fill();
        const glow = this.phase === "charge" ? this.k : 0;
        ctx.beginPath();
        ctx.arc(8, -10, 6, 0, TAU);
        ctx.fillStyle = glow > 0 ? `rgba(255,${120 + glow * 100},80,${0.5 + glow * 0.5})` : "#3a4446";
        ctx.fill();
        if (glow > 0.2) {
          ctx.globalCompositeOperation = "lighter";
          const gg = ctx.createRadialGradient(8, -10, 1, 8, -10, 30);
          gg.addColorStop(0, `rgba(255,160,80,${glow * 0.8})`);
          gg.addColorStop(1, "rgba(255,120,60,0)");
          ctx.fillStyle = gg;
          ctx.fillRect(-22, -40, 60, 60);
        }
        ctx.restore();
        break;
      }
      case "whirl": {
        // 소용돌이 나선
        const R = this.r || 170;
        ctx.save();
        ctx.translate(x, y);
        ctx.lineCap = "round";
        for (let arm = 0; arm < 4; arm++) {
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const k = i / 24;
            const a = arm * (TAU / 4) + k * 4.2 * (this.dir || 1) - t * 2.6 * (this.dir || 1);
            const r = 12 + k * R;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9);
          }
          ctx.strokeStyle = `rgba(220,245,255,${0.28})`;
          ctx.lineWidth = 5;
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.45)";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case "lure": {
        // 가짜 빛: 위에서 내려온 가는 실 끝에 빛 (아귀 유인등과 닮았다)
        const lx = x + Math.sin(this.t * 0.8) * 10;
        const ly = y + Math.sin(this.t * 1.1) * 8;
        ctx.strokeStyle = "rgba(160,200,220,0.25)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.quadraticCurveTo(lx - 10, ly - 60, lx + 4, ly - 140);
        ctx.stroke();
        lureBulb(ctx, lx, ly, this.t + (this.ph || 0), this.color || "#bfffe0");
        break;
      }
      case "icicle": {
        if (this.phase === "gone") break;
        ctx.save();
        ctx.translate(x + (this.phase === "shake" ? Math.sin(t * 70) * 3 : 0), y);
        const L = this.len * (this.phase === "idle" ? 0.35 + this.k * 0.65 : 1);
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.quadraticCurveTo(-8, L * 0.5, 0, L);
        ctx.quadraticCurveTo(8, L * 0.5, 14, 0);
        ctx.closePath();
        const g = ctx.createLinearGradient(-14, 0, 14, 0);
        g.addColorStop(0, "#e8fbff");
        g.addColorStop(0.5, "#9fdcf5");
        g.addColorStop(1, "#cdefff");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#4a8ab0";
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6, 4);
        ctx.quadraticCurveTo(-4, L * 0.4, -1, L * 0.7);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.restore();
        if (this.phase === "shake") {
          // 예고: 떨어질 자리
          ctx.save();
          ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 20);
          ctx.strokeStyle = "#dff6ff";
          ctx.setLineDash([6, 10]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y + this.len + 10);
          ctx.lineTo(x, y + 420);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case "current": {
        // 물살 줄무늬 (흐르는 선)
        const x0 = this.x0 - cam.x;
        const y0 = this.y0 - cam.y;
        const w = this.x1 - this.x0;
        const h = this.y1 - this.y0;
        if (x0 > 560 || x0 + w < -20 || y0 > 1300 || y0 + h < -20) break;
        const sp = Math.hypot(this.fx, this.fy) + 1;
        const ux = this.fx / sp;
        const uy = this.fy / sp;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, w, h);
        ctx.clip();
        ctx.strokeStyle = this.color || "rgba(220,245,255,0.22)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        const n = Math.round((w * h) / 9000);
        for (let i = 0; i < n; i++) {
          const sx = ((i * 97.3) % 1) * w;
          const sy = ((i * 61.7) % 1) * h;
          const off = ((t * sp * 0.6 + i * 53) % (w + h)) - 60;
          const px = x0 + ((sx + ux * off) % w + w) % w;
          const py = y0 + ((sy + uy * off) % h + h) % h;
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(i + t);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + ux * 46, py + uy * 46);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
    }
  }
}
