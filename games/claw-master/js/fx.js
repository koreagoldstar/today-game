/* 화면 효과: 별 · 먼지 · 색종이(무지개) · 글자. 재사용 풀이라 메모리가 늘지 않는다 */
const TAU = Math.PI * 2;
const MAX = 320;

export class FX {
  constructor() {
    this.p = Array.from({ length: MAX }, () => ({ on: false }));
    this.head = 0;
    this.texts = [];
    this.q = 1;
  }
  spawn(o) {
    const it = this.p[this.head];
    this.head = (this.head + 1) % MAX;
    Object.assign(it, { on: true, t: 0, rot: 0, vr: 0, g: 0, drag: 0 }, o);
  }
  stars(x, y, n, s, cols = ["#ffe14a", "#fff6b0", "#ff9ec4", "#ffffff"]) {
    for (let i = 0; i < Math.round(n * this.q); i += 1) {
      const a = Math.random() * TAU;
      const sp = (60 + Math.random() * 140) * s;
      this.spawn({ k: "star", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * s, life: 0.5 + Math.random() * 0.4, r: (3 + Math.random() * 4) * s, c: cols[i % cols.length], g: 180 * s, vr: (Math.random() - 0.5) * 10, drag: 1.5 });
    }
  }
  puff(x, y, n, s) {
    for (let i = 0; i < Math.round(n * this.q); i += 1) {
      const a = Math.random() * TAU;
      const sp = (20 + Math.random() * 50) * s;
      this.spawn({ k: "puff", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, life: 0.4 + Math.random() * 0.3, r: (2 + Math.random() * 3) * s, c: "rgba(255,255,255,.85)", drag: 3 });
    }
  }
  confetti(W, H, n = 90, rainbow = false) {
    const col = rainbow ? ["#ff5a7a", "#ffb340", "#ffe14a", "#5fd38a", "#4fb8ff", "#9b7dff"] : ["#ff8fb8", "#ffd84a", "#8fd3ff", "#b9a3ff", "#ffffff"];
    for (let i = 0; i < Math.round(n * this.q); i += 1) {
      this.spawn({ k: "paper", x: Math.random() * W, y: -20 - Math.random() * H * 0.3, vx: (Math.random() - 0.5) * 60, vy: 100 + Math.random() * 120, life: 2.6 + Math.random() * 1.5, r: 4 + Math.random() * 4, c: col[i % col.length], vr: (Math.random() - 0.5) * 12 });
    }
  }
  text(x, y, s, size, c = "#fff", stroke = "#a8326b", dur = 1) {
    this.texts.push({ x, y, s, size, c, stroke, t: 0, dur });
    if (this.texts.length > 6) this.texts.shift();
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
    for (const q of this.texts) q.t += dt;
    this.texts = this.texts.filter((q) => q.t < q.dur);
  }
  draw(g) {
    for (const p of this.p) {
      if (!p.on) continue;
      const k = p.t / p.life;
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      if (p.k === "star") {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        const R = p.r * (1 - k * 0.3);
        g.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const a = (i / 10) * TAU - Math.PI / 2;
          const q = i % 2 ? R * 0.45 : R;
          g.lineTo(Math.cos(a) * q, Math.sin(a) * q);
        }
        g.closePath();
        g.fillStyle = p.c;
        g.fill();
        g.restore();
      } else if (p.k === "puff") {
        g.fillStyle = p.c;
        g.beginPath();
        g.arc(p.x, p.y, p.r * (0.6 + k), 0, TAU);
        g.fill();
      } else {
        g.save();
        g.translate(p.x + Math.sin(p.t * 3 + p.r) * 10, p.y);
        g.rotate(p.rot);
        g.scale(1, Math.abs(Math.cos(p.t * 5 + p.r)) * 0.8 + 0.2);
        g.fillStyle = p.c;
        g.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        g.restore();
      }
    }
    g.globalAlpha = 1;
    for (const q of this.texts) {
      const k = q.t / q.dur;
      const pop = k < 0.15 ? 0.5 + (k / 0.15) * 0.6 : 1.1 - Math.min(0.1, (k - 0.15) * 0.5);
      g.save();
      g.translate(q.x, q.y - k * 26);
      g.scale(pop, pop);
      g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      g.font = `400 ${q.size}px "Bagel Fat One", "Jua", sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = q.size * 0.22;
      g.strokeStyle = q.stroke;
      g.strokeText(q.s, 0, 0);
      g.fillStyle = q.c;
      g.fillText(q.s, 0, 0);
      g.restore();
    }
    g.globalAlpha = 1;
  }
}
