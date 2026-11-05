/* 화면 효과: 별 · 먼지 · 충격파 · 속도선 · 땀 · 색종이 · 글자. 재사용해서 메모리가 늘지 않는다 */
const TAU = Math.PI * 2;
const MAX = 260;

export class FX {
  constructor() {
    this.p = [];
    for (let i = 0; i < MAX; i += 1) this.p.push({ on: false });
    this.head = 0;
    this.rings = [];
    this.texts = [];
    this.q = 1;
  }

  spawn(o) {
    const it = this.p[this.head];
    this.head = (this.head + 1) % MAX;
    Object.assign(it, { on: true, t: 0, rot: 0, vr: 0, g: 0, drag: 0 }, o);
    return it;
  }

  /** 충돌 별 */
  stars(x, y, n, S, power = 1, dir = 0) {
    const c = ["#ffe14a", "#fff6b0", "#ff9d2e", "#ffffff"];
    const m = Math.round(n * this.q);
    for (let i = 0; i < m; i += 1) {
      const a = Math.random() * TAU;
      const sp = (140 + Math.random() * 300 * power) * S;
      this.spawn({ k: "star", x, y, vx: Math.cos(a) * sp + dir * 120 * S, vy: Math.sin(a) * sp * 0.75 - 70 * S, life: 0.42 + Math.random() * 0.32, r: (7 + Math.random() * 11 * power) * S, c: c[i % 4], g: 520 * S, vr: (Math.random() - 0.5) * 14, drag: 2.2 });
    }
  }

  dust(x, y, n, S, dir = 0, c = "rgba(255,245,225,.9)") {
    const m = Math.round(n * this.q);
    for (let i = 0; i < m; i += 1) {
      const a = Math.random() * TAU;
      const sp = (24 + Math.random() * 90) * S;
      this.spawn({ k: "puff", x: x + (Math.random() - 0.5) * 24 * S, y: y + (Math.random() - 0.5) * 7 * S, vx: Math.cos(a) * sp + dir * 150 * S, vy: Math.sin(a) * sp * 0.4 - 18 * S, life: 0.34 + Math.random() * 0.36, r: (9 + Math.random() * 13) * S, c, drag: 3 });
    }
  }

  sweat(x, y, S, dir) {
    this.spawn({ k: "drop", x, y, vx: dir * (60 + Math.random() * 90) * S, vy: -(90 + Math.random() * 80) * S, life: 0.5, r: 5 * S, c: "#8fdcff", g: 620 * S });
  }

  speedLine(x, y, S, dir, c = "rgba(255,255,255,.85)") {
    this.spawn({ k: "line", x: x + (Math.random() - 0.5) * 40 * S, y: y - Math.random() * 130 * S, vx: -dir * 300 * S, vy: 0, life: 0.2, r: (34 + Math.random() * 52) * S, c });
  }

  confetti(W, S, n = 70) {
    const col = ["#ff4a5a", "#ffd21f", "#4ad8ff", "#7cf06a", "#ff7ae0", "#fff"];
    const m = Math.round(n * this.q);
    for (let i = 0; i < m; i += 1) {
      this.spawn({ k: "paper", x: Math.random() * W, y: -20 - Math.random() * 220 * S, vx: (Math.random() - 0.5) * 70 * S, vy: (90 + Math.random() * 130) * S, life: 2.6 + Math.random() * 1.6, r: (5 + Math.random() * 5) * S, c: col[i % 6], vr: (Math.random() - 0.5) * 12 });
    }
  }

  firework(x, y, S) {
    const col = ["#ff4a5a", "#ffd21f", "#4ad8ff", "#7cf06a", "#ff7ae0"][Math.floor(Math.random() * 5)];
    const m = Math.round(26 * this.q);
    for (let i = 0; i < m; i += 1) {
      const a = (i / m) * TAU;
      const sp = (150 + Math.random() * 70) * S;
      this.spawn({ k: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.72 + Math.random() * 0.3, r: 3.4 * S, c: col, g: 130 * S, drag: 1.6 });
    }
  }

  ring(x, y, R, S, c = "#fff", dur = 0.34) {
    this.rings.push({ x, y, R: R * S, t: 0, dur, c, S });
    if (this.rings.length > 10) this.rings.shift();
  }

  /** 글자: 쾅! 슈웅! */
  text(x, y, s, size, c = "#fff", stroke = "#3a1a10", dur = 0.7, rot = -0.08) {
    this.texts.push({ x, y, s, size, c, stroke, t: 0, dur, rot });
    if (this.texts.length > 8) this.texts.shift();
  }

  update(dt) {
    for (const p of this.p) {
      if (!p.on) continue;
      p.t += dt;
      if (p.t >= p.life) {
        p.on = false;
        continue;
      }
      const d = p.drag ? Math.exp(-p.drag * dt) : 1;
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < r.dur);
    for (const q of this.texts) q.t += dt;
    this.texts = this.texts.filter((q) => q.t < q.dur);
  }

  draw(g) {
    for (const r of this.rings) {
      const k = r.t / r.dur;
      const e = 1 - (1 - k) * (1 - k);
      g.globalAlpha = 1 - k;
      g.strokeStyle = r.c;
      g.lineWidth = (10 * (1 - k) + 1.5) * r.S;
      g.beginPath();
      g.ellipse(r.x, r.y, r.R * e, r.R * e * 0.42, 0, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (const p of this.p) {
      if (!p.on) continue;
      const k = p.t / p.life;
      if (p.k === "puff") {
        g.globalAlpha = (1 - k) * 0.9;
        g.fillStyle = p.c;
        g.beginPath();
        g.arc(p.x, p.y, p.r * (0.6 + k * 0.8), 0, TAU);
        g.fill();
      } else if (p.k === "star") {
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        const R = p.r * (1 - k * 0.35);
        g.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const a = (i / 10) * TAU - Math.PI / 2;
          const q = i % 2 ? R * 0.44 : R;
          if (i === 0) g.moveTo(Math.cos(a) * q, Math.sin(a) * q);
          else g.lineTo(Math.cos(a) * q, Math.sin(a) * q);
        }
        g.closePath();
        g.fillStyle = p.c;
        g.fill();
        g.strokeStyle = "rgba(120,60,0,.65)";
        g.lineWidth = 1.5;
        g.stroke();
        g.restore();
      } else if (p.k === "drop") {
        g.globalAlpha = 1 - k * 0.6;
        g.fillStyle = p.c;
        g.beginPath();
        g.ellipse(p.x, p.y, p.r * 0.7, p.r, Math.atan2(p.vx, -p.vy), 0, TAU);
        g.fill();
      } else if (p.k === "line") {
        g.globalAlpha = 1 - k;
        g.strokeStyle = p.c;
        g.lineWidth = 3;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - Math.sign(p.vx) * p.r * -1, p.y);
        g.stroke();
      } else if (p.k === "paper") {
        g.globalAlpha = k > 0.86 ? (1 - k) / 0.14 : 1;
        g.save();
        g.translate(p.x + Math.sin(p.t * 3 + p.r) * 12, p.y);
        g.rotate(p.rot);
        g.scale(1, Math.abs(Math.cos(p.t * 5 + p.r)) * 0.8 + 0.2);
        g.fillStyle = p.c;
        g.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        g.restore();
      } else if (p.k === "spark") {
        g.globalAlpha = 1 - k;
        g.fillStyle = p.c;
        g.beginPath();
        g.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, TAU);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    for (const q of this.texts) {
      const k = q.t / q.dur;
      const pop = k < 0.16 ? 0.5 + (k / 0.16) * 0.7 : k < 0.3 ? 1.2 - ((k - 0.16) / 0.14) * 0.2 : 1;
      g.save();
      g.translate(q.x, q.y - k * 22);
      g.rotate(q.rot);
      g.scale(pop, pop);
      g.globalAlpha = k > 0.74 ? (1 - k) / 0.26 : 1;
      g.font = `400 ${q.size}px "Bagel Fat One", "Jua", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = q.size * 0.2;
      g.strokeStyle = q.stroke;
      g.strokeText(q.s, 0, 0);
      g.fillStyle = q.c;
      g.fillText(q.s, 0, 0);
      g.restore();
    }
    g.globalAlpha = 1;
  }
}
