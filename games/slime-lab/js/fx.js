/*
 * 말랑팡! 슬라임 연구소 · 효과 (파티클 · 떠오르는 점수 · 화면 흔들림)
 *  개수 상한 · 미리 만든 칸 재사용 (게임 루프에서 객체를 새로 만들지 않음)
 *  움직임 줄이기: 파티클 1/3 · 흔들림 없음
 */
const TAU = Math.PI * 2;
const MAXP = 260;
const MAXF = 24;

export class FX {
  constructor() {
    this.p = Array.from({ length: MAXP }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s: 1, col: "#fff", kind: 0, rot: 0, vr: 0 }));
    this.f = Array.from({ length: MAXF }, () => ({ on: false, x: 0, y: 0, life: 0, max: 1, text: "", col: "#fff", size: 1 }));
    this.pi = 0;
    this.fi = 0;
    this.shake = 0;
    this.reduced = false;
    this.alive = 0;
  }
  reset() {
    for (const q of this.p) q.on = false;
    for (const q of this.f) q.on = false;
    this.shake = 0;
  }
  spawn(x, y, vx, vy, life, s, col, kind) {
    const q = this.p[this.pi];
    this.pi = (this.pi + 1) % MAXP;
    q.on = true;
    q.x = x;
    q.y = y;
    q.vx = vx;
    q.vy = vy;
    q.life = 0;
    q.max = life;
    q.s = s;
    q.col = col;
    q.kind = kind; // 0 물방울 · 1 별 · 2 고리 · 3 종이 꽃가루
    q.rot = Math.random() * TAU;
    q.vr = (Math.random() - 0.5) * 8;
  }
  /** 합체 팡: 단계 · 콤보가 클수록 많이 */
  burst(x, y, r, cols, level, combo = 1) {
    let n = 10 + level * 3 + Math.min(12, combo * 2);
    if (this.reduced) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (120 + Math.random() * 220) * (0.6 + r / 60);
      this.spawn(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, Math.cos(a) * sp, Math.sin(a) * sp - 120, 0.45 + Math.random() * 0.4, 3 + Math.random() * 4 + r * 0.04, cols[i % cols.length], i % 4 === 0 ? 1 : 0);
    }
    this.spawn(x, y, 0, 0, 0.35, r, cols[0], 2);
    if (level >= 5 && !this.reduced) for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      this.spawn(x, y, Math.cos(a) * 260, Math.sin(a) * 260, 0.7, 7, "#fff6a8", 1);
    }
    if (!this.reduced) this.shake = Math.max(this.shake, Math.min(0.5, 0.06 * level + 0.03 * combo));
  }
  /** 작은 톡 (떨어뜨림 · 세게 부딪힘) */
  puff(x, y, col, n = 4) {
    if (this.reduced) n = Math.min(n, 2);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      this.spawn(x, y, Math.cos(a) * 90, Math.sin(a) * 90, 0.35, 2.5 + Math.random() * 2, col, 0);
    }
  }
  /** 축하 꽃가루 (새 최고 기록 · 미션 성공) */
  confetti(w, h) {
    const cols = ["#ff8fc8", "#ffe866", "#8fd6ff", "#7fe8c4", "#c9b6f2", "#ffb08a"];
    const n = this.reduced ? 30 : 110;
    for (let i = 0; i < n; i++) this.spawn(Math.random() * w, -20 - Math.random() * h * 0.3, (Math.random() - 0.5) * 80, 120 + Math.random() * 160, 2.2 + Math.random(), 4 + Math.random() * 4, cols[i % cols.length], 3);
  }
  text(x, y, text, col, size = 1) {
    const q = this.f[this.fi];
    this.fi = (this.fi + 1) % MAXF;
    Object.assign(q, { on: true, x, y, life: 0, max: 1.0, text, col, size });
  }
  update(dt) {
    let n = 0;
    for (const q of this.p) {
      if (!q.on) continue;
      q.life += dt;
      if (q.life >= q.max) {
        q.on = false;
        continue;
      }
      n++;
      if (q.kind === 3) {
        q.vx += Math.sin(q.life * 4 + q.rot) * 30 * dt;
        q.vy = Math.min(q.vy, 160);
      } else if (q.kind !== 2) q.vy += 700 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
    }
    this.alive = n;
    for (const q of this.f) {
      if (!q.on) continue;
      q.life += dt;
      q.y -= 40 * dt;
      if (q.life >= q.max) q.on = false;
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
  /** 그리기 (세계 → 화면: sx(x), sy(y), k 배율) */
  draw(ctx, X, Y, k) {
    for (const q of this.p) {
      if (!q.on) continue;
      const a = 1 - q.life / q.max;
      const x = X(q.x);
      const y = Y(q.y);
      ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.4));
      ctx.fillStyle = q.col;
      if (q.kind === 2) {
        ctx.strokeStyle = q.col;
        ctx.lineWidth = Math.max(1, 4 * k * a);
        ctx.beginPath();
        ctx.arc(x, y, q.s * k * (1 + (1 - a) * 0.9), 0, TAU);
        ctx.stroke();
      } else if (q.kind === 1) {
        star(ctx, x, y, q.s * k, q.rot);
        ctx.fill();
      } else if (q.kind === 3) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(q.rot);
        ctx.fillRect(-q.s, -q.s * 0.5, q.s * 2, q.s);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, q.s * k * (0.5 + a * 0.5), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const q of this.f) {
      if (!q.on) continue;
      const a = q.life / q.max;
      const s = (a < 0.15 ? 0.6 + (a / 0.15) * 0.5 : 1.1 - Math.min(0.1, (a - 0.15) * 0.3)) * q.size;
      ctx.globalAlpha = a > 0.7 ? (1 - a) / 0.3 : 1;
      ctx.font = `${Math.round(Math.max(14, 22 * k) * s)}px "Bagel Fat One", Jua, sans-serif`;
      ctx.lineWidth = Math.max(3, 6 * k * s);
      ctx.strokeStyle = "rgba(80,50,110,0.85)";
      ctx.strokeText(q.text, X(q.x), Y(q.y));
      ctx.fillStyle = q.col;
      ctx.fillText(q.text, X(q.x), Y(q.y));
    }
    ctx.globalAlpha = 1;
  }
}
function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
