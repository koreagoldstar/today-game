/*
 * 바다괴물 탐험대 · 아쿠아 물총 (물속 고압 물줄기)
 * 물방울 덩어리(blob)가 노즐에서 조준 방향으로 곧게 날아간다. 매 프레임 지나간 선분으로 맞았는지 본다.
 * 그림: 빛나는 물줄기(바깥 빛 · 몸통 · 하얀 심) + 뒤로 남는 작은 기포.
 */
import { TAU, rand } from "./view.js?v=1";

const MAX = 72;

export class WaterGun {
  constructor() {
    this.b = Array.from({ length: MAX }, () => ({ on: false }));
    this.cur = 0;
    this.cool = 0;
    this.rate = 0.11;
    this.speed = 1000;
    this.range = 390;
    this.chain = 0;
    this.was = false;
    this.recoil = 0;
    this.shots = 0;
    this.power = 1; // PERFECT 직후 잠깐 굵어진다
    this.powerT = 0;
  }

  reset() {
    for (const q of this.b) q.on = false;
    this.cool = 0;
    this.recoil = 0;
    this.shots = 0;
  }

  /**
   * firing: 쏘는 중 · noz: 노즐 {x,y} · ang: 조준 각도
   * resolve(q, x0, y0, x1, y1) → { x, y, stop } | null  (맞았으면 물방울이 멈춘다)
   */
  update(dt, firing, noz, ang, resolve, fx) {
    if (firing && !this.was) this.chain++;
    this.was = firing;
    this.cool -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    if (this.powerT > 0) this.powerT -= dt;
    let fired = 0;
    if (firing && this.cool <= 0) {
      this.cool = this.rate;
      const q = this.b[this.cur];
      this.cur = (this.cur + 1) % MAX;
      const a = ang + rand(-0.025, 0.025);
      q.on = true;
      q.x = noz.x;
      q.y = noz.y;
      q.vx = Math.cos(a) * this.speed;
      q.vy = Math.sin(a) * this.speed;
      q.age = 0;
      q.dist = 0;
      q.chain = this.chain;
      q.dead = 0;
      q.big = this.powerT > 0 ? 1.6 : 1;
      q.id = ++this.shots;
      this.recoil = 1;
      fired = 1;
      // 노즐 앞 기포 한 줌
      if (fx && Math.random() < 0.7) fx.spawn({ kind: "bubble", x: noz.x + Math.cos(ang) * 8, y: noz.y + Math.sin(ang) * 8, vx: Math.cos(ang) * 120 + rand(-30, 30), vy: Math.sin(ang) * 120 + rand(-30, 30), r: rand(1.6, 3), life: rand(0.4, 0.8), drag: 3 });
    }
    for (const q of this.b) {
      if (!q.on) continue;
      if (q.dead) {
        q.dead += dt;
        if (q.dead > 0.12) q.on = false;
        continue;
      }
      q.age += dt;
      const x0 = q.x;
      const y0 = q.y;
      // 물속이라 조금씩 느려진다
      const k = Math.exp(-0.9 * dt);
      q.vx *= k;
      q.vy *= k;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.dist += Math.hypot(q.x - x0, q.y - y0);
      const hit = resolve ? resolve(q, x0, y0, q.x, q.y) : null;
      if (hit) {
        q.x = hit.x;
        q.y = hit.y;
        q.dead = 0.001;
        continue;
      }
      if (q.dist > this.range) {
        q.dead = 0.001;
        if (fx && Math.random() < 0.5) fx.bubbles(q.x, q.y, 2, 6, 0.8);
      }
      // 지나간 자리에 작은 기포 (물줄기 꼬리)
      if (fx && Math.random() < 0.12 * fx.quality) fx.spawn({ kind: "bubble", x: q.x, y: q.y, vx: rand(-15, 15), vy: rand(-30, 0), r: rand(1.2, 2.4), life: rand(0.4, 0.9), drag: 2 });
    }
    return fired;
  }

  /** 물줄기 그리기: 같은 줄기(chain)의 물방울을 이어서 */
  draw(ctx, cam, noz, firing, t) {
    const groups = new Map();
    for (const q of this.b) {
      if (!q.on || q.dead) continue;
      let g = groups.get(q.chain);
      if (!g) {
        g = [];
        groups.set(q.chain, g);
      }
      g.push(q);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [chain, g] of groups) {
      g.sort((a, b) => b.id - a.id); // 최근 → 오래된
      const pts = [];
      if (firing && chain === this.chain && noz) pts.push([noz.x - cam.x, noz.y - cam.y, 1]);
      for (let i = 0; i < g.length; i++) {
        const q = g[i];
        // 연속으로 쏜 것만 잇는다 (사이가 벌어지면 끊는다)
        if (i > 0 && g[i - 1].id - q.id > 2) break;
        const wob = Math.sin(q.age * 34 + q.id) * 2.5 * Math.min(1, q.dist / 80);
        const nx = -q.vy / (Math.hypot(q.vx, q.vy) + 1);
        const ny = q.vx / (Math.hypot(q.vx, q.vy) + 1);
        pts.push([q.x - cam.x + nx * wob, q.y - cam.y + ny * wob, q.big]);
      }
      if (pts.length < 2) {
        if (pts.length === 1) {
          ctx.fillStyle = "rgba(220,250,255,0.9)";
          ctx.beginPath();
          ctx.arc(pts[0][0], pts[0][1], 4, 0, TAU);
          ctx.fill();
        }
        continue;
      }
      const big = pts.reduce((m, p) => Math.max(m, p[2]), 1);
      const line = (w, c) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.lineWidth = w * big;
        ctx.strokeStyle = c;
        ctx.stroke();
      };
      line(24, "rgba(110,230,255,0.2)");
      line(13, "rgba(170,240,255,0.55)");
      line(7, "rgba(215,250,255,0.85)");
      line(3, "rgba(255,255,255,1)");
      // 끝머리 물방울
      const e = pts[pts.length - 1];
      ctx.fillStyle = "rgba(235,252,255,0.95)";
      ctx.beginPath();
      ctx.arc(e[0], e[1], 7 * big, 0, TAU);
      ctx.fill();
      // 반짝임 점
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 1; i < pts.length; i += 2) {
        const p = pts[i];
        const off = Math.sin(t * 20 + i) * 5;
        ctx.beginPath();
        ctx.arc(p[0] + off * 0.6, p[1] - off * 0.6, 1.6, 0, TAU);
        ctx.fill();
      }
    }
  }
}
