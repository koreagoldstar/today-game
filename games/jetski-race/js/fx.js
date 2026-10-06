/*
 * 제트스키 썬더 레이스 · 효과
 *  - 3D 물보라 입자 (월드 좌표: 렌더러가 깊이 순서로 그린다)
 *  - 화면 효과: 떠오르는 글자 · 큰 배너(3D 숫자) · 속도선 · 부스트 테두리 · 번쩍 · 화면 물방울 · 꽃가루
 * 모두 미리 만든 풀을 돌려 써서 판이 길어져도 쓰레기가 쌓이지 않는다.
 */
import { W, H, HZ, clamp, lerp, rand, ease } from "./view.js?v=1";

const MAX_PARTS = 700;
const MAX_TEXTS = 24;

export class Effects {
  constructor() {
    this.parts = Array.from({ length: MAX_PARTS }, () => ({ on: false }));
    this.texts = Array.from({ length: MAX_TEXTS }, () => ({ on: false }));
    this.cursor = 0;
    this.tcursor = 0;
    this.serial = 0;
    this.quality = 1;
    this.flashA = 0;
    this.flashC = "#ffffff";
    this.banner = null;
    this.drops = [];
    this.confetti = [];
    this.fireworks = [];
    this.speedLines = 0; // 0~1
    this.boostGlow = 0;
    this.shakeAmp = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  reset() {
    for (const p of this.parts) p.on = false;
    for (const t of this.texts) t.on = false;
    this.flashA = 0;
    this.banner = null;
    this.drops.length = 0;
    this.confetti.length = 0;
    this.fireworks.length = 0;
    this.speedLines = 0;
    this.boostGlow = 0;
    this.shakeAmp = 0;
  }

  /* ---------------- 3D 입자 ---------------- */
  spawn(o) {
    for (let k = 0; k < MAX_PARTS; k++) {
      const i = (this.cursor + k) % MAX_PARTS;
      const p = this.parts[i];
      if (!p.on) {
        this.cursor = (i + 1) % MAX_PARTS;
        return Object.assign(p, DEF, o, { on: true, age: 0 });
      }
    }
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PARTS;
    return Object.assign(p, DEF, o, { on: true, age: 0 });
  }

  /** 착지 · 충돌: 왕관 물보라 + 물결 고리 */
  splash(x, y, z, power = 1, vz = 0) {
    const n = Math.round(26 * power * this.quality);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = rand(3, 7) * power;
      this.spawn({ kind: i % 3 ? 0 : 1, x, y: y + 0.1, z, vx: Math.cos(a) * sp * 0.8, vy: rand(3, 7.5) * power, vz: Math.sin(a) * sp * 0.5 + vz, r: i % 3 ? rand(0.06, 0.14) : rand(0.25, 0.5), life: rand(0.5, 0.9), g: 16, a: 0.95, c: i % 4 ? "#ffffff" : "#c6f1ff", grow: i % 3 ? 0 : 1.2 });
    }
    this.spawn({ kind: 2, x, y, z, r: 0.8 * power, grow: 4, life: 0.7, a: 0.9, c: "rgba(255,255,255,0.9)", g: 0 });
    this.spawn({ kind: 2, x, y, z, r: 0.5 * power, grow: 6, life: 1, a: 0.6, c: "rgba(190,240,255,0.9)", g: 0 });
  }

  sparkles(x, y, z, n = 8) {
    for (let i = 0; i < n * this.quality; i++) {
      this.spawn({ kind: 3, x: x + rand(-0.8, 0.8), y: y + rand(0.2, 1.8), z: z + rand(-0.6, 0.6), vx: rand(-2, 2), vy: rand(1, 4), vz: rand(-1, 1), r: rand(0.12, 0.24), life: rand(0.4, 0.7), g: 2, a: 1 });
    }
  }

  update(dt, track) {
    for (const p of this.parts) {
      if (!p.on) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.on = false;
        continue;
      }
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.drag) {
        const d = Math.pow(p.drag, dt);
        p.vx *= d;
        p.vz *= d;
      }
      if (p.kind === 0 && track && p.vy < 0) {
        const wy = track.heightAt(p.z);
        if (p.y < wy) p.on = false;
      }
    }
    // 글자
    for (const t of this.texts) {
      if (!t.on) continue;
      if (t.delay > 0) {
        t.delay -= dt;
        continue;
      }
      t.age += dt;
      if (t.age >= t.life) t.on = false;
    }
    this.layoutTexts();
    this.flashA = Math.max(0, this.flashA - dt * 2.4);
    if (this.banner) {
      this.banner.age += dt;
      if (this.banner.age > this.banner.life) this.banner = null;
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.y += d.vy * dt;
      d.vy += 40 * dt;
      if (d.age > d.life) this.drops.splice(i, 1);
    }
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const f = this.fireworks[i];
      f.age += dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= Math.pow(0.25, dt);
      f.vy = f.vy * Math.pow(0.25, dt) + 60 * dt;
      if (f.age > f.life) this.fireworks.splice(i, 1);
    }
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.age += dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 60 * dt;
      c.rot += c.spin * dt;
      if (c.age > c.life || c.y > H + 20) this.confetti.splice(i, 1);
    }
    if (this.shakeAmp > 0.1) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeAmp;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeAmp;
      this.shakeAmp *= Math.pow(0.002, dt);
    } else this.shakeAmp = this.shakeX = this.shakeY = 0;
  }

  /* ---------------- 화면 효과 ---------------- */
  /**
   * 떠오르는 글자. slot 이 같은 글자는 하나만 · punch: 크게 나타났다 제자리 · sub: 작은 둘째 줄
   */
  text(str, x, y, { color = "#fff", stroke = "#0b3f66", size = 30, life = 0.9, rise = 50, delay = 0, slot = "", punch = false, sub = "" } = {}) {
    if (slot) for (const o of this.texts) if (o.on && o.slot === slot) o.life = Math.min(o.life, o.age + 0.08);
    const half = Math.min(W / 2 - 8, String(str).length * size * 0.33 + 10);
    x = clamp(x, half, W - half);
    const t = this.texts[this.tcursor];
    this.tcursor = (this.tcursor + 1) % MAX_TEXTS;
    Object.assign(t, { on: true, str, x, y, color, stroke, size, life, rise, delay, slot, punch, sub, age: 0, ny: 0, born: ++this.serial });
    return t;
  }

  /** 겹친 글자는 나중에 뜬 것을 위로 비켜 세운다 */
  layoutTexts() {
    const list = (this._order = this._order || []);
    list.length = 0;
    for (const t of this.texts) if (t.on && t.delay <= 0) list.push(t);
    list.sort((a, b) => a.born - b.born);
    for (let j = 0; j < list.length; j++) {
      const t = list[j];
      const base = t.y - ease.out(t.age / t.life) * t.rise;
      const w = String(t.str).length * t.size * 0.6;
      let y = base + t.ny;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < j; i++) {
          const o = list[i];
          const ow = String(o.str).length * o.size * 0.6;
          const gap = (t.size + o.size) * 0.5 + (o.sub ? o.size * 0.5 : 0);
          if (Math.abs(o.x - t.x) < (w + ow) / 2 && Math.abs(o.dy - y) < gap) y = o.dy - gap;
        }
      }
      const want = Math.min(0, y - base);
      t.ny += (want - t.ny) * (want < t.ny ? 0.45 : 0.15);
      t.dy = base + t.ny;
    }
  }

  /** 화면 가운데 큰 글자 (3·2·1·GO · FINISH) */
  showBanner(str, { color = "#ffffff", color2 = "#ffd23f", stroke = "#0b3f66", size = 120, life = 0.9, sub = "", kind = "pop" } = {}) {
    this.banner = { str, color, color2, stroke, size, life, sub, kind, age: 0 };
  }

  flash(a = 0.5, c = "#ffffff") {
    this.flashA = Math.max(this.flashA, a);
    this.flashC = c;
  }

  shake(a) {
    this.shakeAmp = Math.max(this.shakeAmp, a);
  }

  wetScreen(n = 10) {
    for (let i = 0; i < n; i++) {
      this.drops.push({ x: rand(20, W - 20), y: rand(H * 0.25, H * 0.9), r: rand(10, 26), vy: rand(10, 40), age: 0, life: rand(1, 1.8) });
    }
  }

  /** 하늘에서 터지는 불꽃 (화면 좌표) */
  firework(x, y, color) {
    const n = Math.round(46 * this.quality);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 140 + Math.random() * 120;
      this.fireworks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 1 + Math.random() * 0.5, c: color });
    }
  }

  burstConfetti(n = 70) {
    const cols = ["#ff5d8f", "#ffd23f", "#4fd1c5", "#7c83fd", "#ff9f43", "#5be37d", "#ffffff"];
    for (let i = 0; i < n * this.quality; i++) {
      this.confetti.push({ x: rand(0, W), y: rand(-80, -10), vx: rand(-50, 50), vy: rand(80, 220), r: rand(5, 10), age: 0, life: rand(2.2, 3.4), rot: rand(0, 6), spin: rand(-9, 9), c: cols[i % cols.length] });
    }
  }

  /** 날씨: rain(비) · snow(눈) · ash(화산재 · 불티) · spark(밤바다 반딧불 플랑크톤) */
  drawWeather(ctx, time, wx, wind = 0, speed = 0) {
    if (!wx) return;
    const n = Math.round((wx.n || 70) * this.quality);
    ctx.save();
    if (wx.kind === "rain") {
      ctx.strokeStyle = "rgba(215,230,255,0.42)";
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      const slant = 0.25 + wind * 0.06;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sp = 900 + (i % 7) * 60 + speed * 300;
        const x = (((i * 97.3 + time * sp * slant) % (W + 80)) + W + 80) % (W + 80) - 40;
        const y = ((i * 53.7 + time * sp) % (H + 60)) - 30;
        const L = 22 + (i % 5) * 6;
        ctx.moveTo(x, y);
        ctx.lineTo(x - L * slant, y - L);
      }
      ctx.stroke();
    } else if (wx.kind === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < n; i++) {
        const sp = 40 + (i % 5) * 18 + speed * 160;
        const x = (((i * 71.3 + Math.sin(time * 0.8 + i) * 30 + time * wind * 20) % W) + W) % W;
        const y = ((i * 47.1 + time * sp) % (H + 20)) - 10;
        const r = 1.4 + (i % 3) * 1.1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (wx.kind === "ash") {
      for (let i = 0; i < n; i++) {
        const x = (((i * 83.1 + Math.sin(time * 0.6 + i * 1.7) * 24) % W) + W) % W;
        const y = H - (((i * 61.7 + time * (30 + (i % 4) * 14)) % (H + 20)) - 10);
        const ember = i % 4 === 0;
        ctx.fillStyle = ember ? `rgba(255,${140 + (i % 3) * 30},60,${0.5 + 0.4 * Math.sin(time * 6 + i)})` : "rgba(90,80,80,0.45)";
        ctx.beginPath();
        ctx.arc(x, y, ember ? 1.8 : 1.4 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (wx.kind === "spark") {
      for (let i = 0; i < n; i++) {
        const x = (((i * 83.1 + Math.sin(time * 0.5 + i * 1.3) * 30) % W) + W) % W;
        const y = HZ + 40 + ((i * 37.3) % (H - HZ - 40));
        const a = 0.25 + 0.35 * Math.sin(time * 3 + i * 2.1);
        if (a <= 0.05) continue;
        ctx.fillStyle = `rgba(150,255,240,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.3 + (i % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** 속도선 · 부스트 테두리 · 화면 물방울 · 꽃가루 · 번쩍 · 글자 · 배너 */
  drawScreen(ctx, time) {
    // 속도선: 소실점에서 화면 가장자리 쪽으로 뻗어 나가는 가는 꼬리 (가운데는 비워 둔다)
    const sl = this.speedLines;
    if (sl > 0.02) {
      ctx.save();
      const cx = W / 2;
      const cy = HZ + 26;
      const n = Math.round(20 * this.quality);
      for (let i = 0; i < n; i++) {
        const jit = Math.sin(i * 12.9898) * 0.5 + 0.5;
        const a = (i / n) * Math.PI * 2 + jit * 0.25;
        const ph = (time * (1.8 + jit * 1.2) + i * 0.137) % 1;
        const r0 = 300 + ph * 420;
        const len = (70 + sl * 170) * (0.6 + jit * 0.5);
        const ca = Math.cos(a);
        const sa = Math.sin(a) * 1.25;
        const x0 = cx + ca * r0;
        const y0 = cy + sa * r0;
        if (y0 < 110) continue;
        const x1 = cx + ca * (r0 + len);
        const y1 = cy + sa * (r0 + len);
        const w = 1.2 + sl * 3.4;
        const nx = -sa;
        const ny = ca;
        const nl = Math.hypot(nx, ny) || 1;
        ctx.fillStyle = `rgba(255,255,255,${sl * 0.55 * Math.min(1, ph * 3)})`;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1 + (nx / nl) * w, y1 + (ny / nl) * w);
        ctx.lineTo(x1 - (nx / nl) * w, y1 - (ny / nl) * w);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // 부스트: 화면 테두리가 시원한 하늘빛으로
    if (this.boostGlow > 0.02) {
      const b = this.boostGlow;
      const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.75);
      g.addColorStop(0, "rgba(120,240,255,0)");
      g.addColorStop(1, `rgba(120,240,255,${0.32 * b})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // 화면에 맺힌 물방울
    for (const d of this.drops) {
      const a = d.age > d.life - 0.4 ? (d.life - d.age) / 0.4 : 1;
      ctx.globalAlpha = a * 0.55;
      const g = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 1, d.x, d.y, d.r);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.5, "rgba(170,225,255,0.3)");
      g.addColorStop(1, "rgba(120,200,255,0.5)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r * 0.85, d.r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.fireworks.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const f of this.fireworks) {
        const k = f.age / f.life;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = f.c;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2.6 * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.scale(1, Math.abs(Math.cos(c.age * 7 + c.rot)));
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.r * 0.6, -c.r * 0.35, c.r * 1.2, c.r * 0.7);
      ctx.restore();
    }
    // 글자
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const t of this.texts) {
      if (!t.on || t.delay > 0) continue;
      const k = t.age / t.life;
      let sc = k < 0.16 ? ease.back(k / 0.16) : 1;
      if (t.punch) sc = t.age < 0.14 ? 1.7 - 0.7 * ease.out(t.age / 0.14) : 1;
      const y = t.y - ease.out(k) * t.rise + (t.ny || 0);
      ctx.globalAlpha = k > 0.72 ? (1 - k) / 0.28 : 1;
      ctx.save();
      ctx.translate(t.x, y);
      ctx.scale(sc, sc);
      ctx.font = `${t.size}px "Bagel Fat One", "Jua", sans-serif`;
      ctx.lineWidth = Math.max(4, t.size * 0.24);
      ctx.strokeStyle = t.stroke;
      ctx.strokeText(t.str, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, 0, 0);
      if (t.sub) {
        ctx.font = `${Math.round(t.size * 0.55)}px "Bagel Fat One", "Jua", sans-serif`;
        ctx.lineWidth = Math.max(3, t.size * 0.14);
        ctx.strokeText(t.sub, 0, t.size * 0.78);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(t.sub, 0, t.size * 0.78);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (this.flashA > 0.01) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashC;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.banner) drawBanner(ctx, this.banner, time);
  }
}

const DEF = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.1, life: 1, g: 9.8, a: 1, c: "#ffffff", kind: 0, grow: 0, drag: 0 };

/** 입체 글자: 아래로 겹겹이 두께 + 그라데이션 면 + 하이라이트 */
export function drawBanner(ctx, b, time) {
  const k = b.age / b.life;
  let sc;
  let a = 1;
  if (b.kind === "count") {
    // 크게 날아와 박히고 → 살짝 커지며 사라짐
    sc = k < 0.18 ? 2.2 - 1.2 * ease.out(k / 0.18) : 1 + (k - 0.18) * 0.25;
    a = k > 0.75 ? (1 - k) / 0.25 : 1;
  } else {
    sc = k < 0.15 ? ease.back(k / 0.15) : k > 0.85 ? 1 + (k - 0.85) * 2 : 1;
    a = k > 0.85 ? (1 - k) / 0.15 : 1;
  }
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, H * 0.36);
  ctx.scale(sc, sc);
  ctx.rotate(Math.sin(time * 3) * 0.015);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.font = `${b.size}px "Bagel Fat One", "Jua", sans-serif`;
  const depth = Math.round(b.size * 0.06);
  // 두께 (아래로 겹겹이) + 바깥 테두리
  ctx.fillStyle = b.stroke;
  ctx.strokeStyle = b.stroke;
  ctx.lineWidth = b.size * 0.1;
  for (let i = depth; i >= 1; i--) {
    ctx.strokeText(b.str, 0, i);
    ctx.fillText(b.str, 0, i);
  }
  ctx.strokeText(b.str, 0, 0);
  const g = ctx.createLinearGradient(0, -b.size * 0.45, 0, b.size * 0.45);
  g.addColorStop(0, b.color);
  g.addColorStop(0.52, b.color);
  g.addColorStop(0.53, b.color2);
  g.addColorStop(1, b.color2);
  ctx.fillStyle = g;
  ctx.fillText(b.str, 0, 0);
  // 위쪽 하이라이트
  ctx.save();
  ctx.globalAlpha = a * 0.5;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.rect(-W, -b.size * 0.5, W * 2, b.size * 0.22);
  ctx.clip();
  ctx.fillText(b.str, 0, 0);
  ctx.restore();
  if (b.sub) {
    ctx.font = `${Math.round(b.size * 0.24)}px "Jua", sans-serif`;
    ctx.lineWidth = 7;
    ctx.strokeText(b.sub, 0, b.size * 0.72);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(b.sub, 0, b.size * 0.72);
  }
  ctx.restore();
}

/** 항적 기록용 고리 버퍼 */
export class Ring {
  constructor(n) {
    this.buf = Array.from({ length: n }, () => ({ z: 0, x: 0, t: 0, air: false }));
    this.head = 0;
    this.n = 0;
  }
  push(z, x, t, air) {
    const q = this.buf[this.head];
    q.z = z;
    q.x = x;
    q.t = t;
    q.air = air;
    this.head = (this.head + 1) % this.buf.length;
    this.n = Math.min(this.n + 1, this.buf.length);
  }
  /** i=0 가장 오래된 것 */
  get(i) {
    const L = this.buf.length;
    return this.buf[(this.head - this.n + i + L) % L];
  }
  clear() {
    this.n = 0;
  }
}
