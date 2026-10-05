/*
 * 물총 대작전 엔진 · ShootingSystem + WaterSystem
 * 물방울 덩어리(blob)가 노즐에서 조준점까지 포물선으로 날아가 '도착한 순간' 맞았는지 판정한다.
 * 누르고 있는 동안은 노즐과 조준점 사이에 출렁이는 물줄기를 그린다.
 */
import { clamp, lerp, rand } from "./view.js?v=2";

const MAX_BLOBS = 64;

export class WaterSystem {
  constructor() {
    this.blobs = Array.from({ length: MAX_BLOBS }, () => ({ on: false }));
    this.cursor = 0;
    this.cool = 0;
    this.rate = 0.11; // 연사 간격(초)
    this.endX = 0;
    this.endY = 0;
    this.streamA = 0; // 물줄기 보이는 정도
    this.wob = 0;
    this.kind = "normal"; // normal | rainbow | thunder | ice
  }

  reset() {
    for (const b of this.blobs) b.on = false;
    this.cool = 0;
    this.streamA = 0;
  }

  /** 쏠 수 있으면 true (연사 간격) */
  ready(dt, firing) {
    this.cool -= dt;
    if (firing && this.cool <= 0) {
      this.cool = this.rate;
      return true;
    }
    return false;
  }

  /**
   * from/to: 화면 좌표. target: 따라갈 대상(있으면 유도) · raw: 실제 조준점(퍼펙트 판정용)
   */
  fire(from, to, opts = {}) {
    let b = null;
    for (let k = 0; k < MAX_BLOBS; k++) {
      const i = (this.cursor + k) % MAX_BLOBS;
      if (!this.blobs[i].on) {
        b = this.blobs[i];
        this.cursor = (i + 1) % MAX_BLOBS;
        break;
      }
    }
    if (!b) return null;
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    Object.assign(b, {
      on: true,
      x0: from.x,
      y0: from.y,
      tx: to.x,
      ty: to.y,
      u: 0,
      dur: 0.07 + dist / 3800,
      arc: 30 + dist * 0.16,
      target: opts.target || null,
      raw: opts.raw || to,
      kind: opts.kind || this.kind,
      big: Boolean(opts.big),
      x: from.x,
      y: from.y,
      px: from.x,
      py: from.y,
      size: opts.size || 1,
    });
    return b;
  }

  /** resolve(blob) 는 도착한 물방울마다 한 번 불린다 */
  update(dt, firing, aim, nozzle, resolve, homingPoint) {
    this.wob += dt;
    this.streamA = clamp(this.streamA + (firing ? dt * 10 : -dt * 7), 0, 1);
    // 물줄기 끝은 조준점을 살짝 늦게 따라온다 (물의 무게감)
    const k = Math.min(1, dt * 22);
    this.endX = lerp(this.endX || aim.x, aim.x, k);
    this.endY = lerp(this.endY || aim.y, aim.y, k);
    for (const b of this.blobs) {
      if (!b.on) continue;
      if (b.target && homingPoint) {
        const hp = homingPoint(b.target);
        if (hp) {
          b.tx = lerp(b.tx, hp.x, Math.min(1, dt * 18));
          b.ty = lerp(b.ty, hp.y, Math.min(1, dt * 18));
        } else b.target = null;
      }
      b.u += dt / b.dur;
      const u = Math.min(1, b.u);
      const mx = (b.x0 + b.tx) / 2;
      const my = (b.y0 + b.ty) / 2 - b.arc;
      b.px = b.x;
      b.py = b.y;
      b.x = (1 - u) * (1 - u) * b.x0 + 2 * (1 - u) * u * mx + u * u * b.tx;
      b.y = (1 - u) * (1 - u) * b.y0 + 2 * (1 - u) * u * my + u * u * b.ty;
      if (b.u >= 1) {
        b.on = false;
        resolve(b);
      }
    }
  }

  colorFor(kind, t, i = 0) {
    switch (kind) {
      case "rainbow":
        return `hsl(${(t * 360 + i * 40) % 360}, 95%, 66%)`;
      case "thunder":
        return "#fff27a";
      case "ice":
        return "#c8f4ff";
      default:
        return "#5cc8ff";
    }
  }

  /** 물줄기 색 (구간 i / 전체 n) */
  bodyColor(kind, t, i, n) {
    switch (kind) {
      case "rainbow":
        return `hsla(${(t * 300 + i * 26) % 360}, 95%, 64%, 0.92)`;
      case "thunder":
        return i % 2 ? "rgba(255,246,150,0.92)" : "rgba(170,230,255,0.92)";
      case "ice":
        return "rgba(200,244,255,0.92)";
      default: {
        // 노즐 쪽은 진한 파랑 → 끝으로 갈수록 밝은 하늘빛
        const k = i / n;
        return `rgba(${Math.round(40 + 90 * k)},${Math.round(170 + 50 * k)},255,0.9)`;
      }
    }
  }

  draw(ctx, nozzle, t, quality = 1) {
    const a = this.streamA;
    if (a > 0.02) {
      const x0 = nozzle.x;
      const y0 = nozzle.y;
      const x2 = this.endX;
      const y2 = this.endY;
      const dist = Math.hypot(x2 - x0, y2 - y0);
      const wob = Math.sin(this.wob * 30) * 4;
      const mx = (x0 + x2) / 2 + wob;
      const my = (y0 + y2) / 2 - (30 + dist * 0.16);
      const pt = (u) => ({
        x: (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x2,
        y: (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * my + u * u * y2,
      });
      const N = 16;
      const P = [];
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * a;
        const q = pt(u);
        // 물의 출렁임 (가로 방향 흔들림)
        const nx = -(y2 - y0) / (dist || 1);
        const ny = (x2 - x0) / (dist || 1);
        const w = Math.sin(t * 38 - i * 1.3) * (1.2 + i * 0.12);
        P.push({ x: q.x + nx * w, y: q.y + ny * w });
      }
      const width = (i) => lerp(22, 7.5, i / N) * (0.75 + 0.25 * a);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // 1) 은은한 빛 번짐
      ctx.strokeStyle = this.kind === "normal" ? "rgba(120,215,255,0.2)" : "rgba(255,255,255,0.2)";
      for (let i = 0; i < N; i++) {
        ctx.lineWidth = width(i) + 14;
        ctx.beginPath();
        ctx.moveTo(P[i].x, P[i].y);
        ctx.lineTo(P[i + 1].x, P[i + 1].y);
        ctx.stroke();
      }
      // 2) 물줄기 몸통 (굵게 → 가늘게)
      for (let i = 0; i < N; i++) {
        ctx.strokeStyle = this.bodyColor(this.kind, t, i, N);
        ctx.lineWidth = width(i);
        ctx.beginPath();
        ctx.moveTo(P[i].x, P[i].y);
        ctx.lineTo(P[i + 1].x, P[i + 1].y);
        ctx.stroke();
      }
      // 3) 빛 받은 심 (위쪽으로 살짝)
      ctx.strokeStyle = "rgba(255,255,255,0.88)";
      for (let i = 0; i < N - 1; i++) {
        ctx.lineWidth = width(i) * 0.3;
        ctx.beginPath();
        ctx.moveTo(P[i].x - 1.5, P[i].y - 2);
        ctx.lineTo(P[i + 1].x - 1.5, P[i + 1].y - 2);
        ctx.stroke();
      }
      // 4) 물덩이가 흘러가는 느낌 (둥근 볼록)
      ctx.fillStyle = "rgba(235,250,255,0.7)";
      for (let k = 0; k < 6; k++) {
        const u = (t * 2.6 + k / 6) % 1;
        const fi = u * N;
        const i = Math.min(N - 1, Math.floor(fi));
        const f = fi - i;
        const x = lerp(P[i].x, P[i + 1].x, f);
        const y = lerp(P[i].y, P[i + 1].y, f);
        const r = width(fi) * 0.55;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 5) 떨어지는 물방울
      const drops = Math.round(10 * quality);
      for (let k = 0; k < drops; k++) {
        const u = ((t * 1.9 + k / drops) % 1) * a;
        const q = pt(u);
        const fall = ((t * 2.4 + k * 0.37) % 1);
        const r = 1.6 + (k % 3) * 0.9;
        ctx.fillStyle = k % 3 ? "rgba(200,240,255,0.9)" : "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(q.x + Math.sin(k * 9 + t * 7) * 9, q.y + fall * fall * 40 + 6, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (this.kind === "thunder") {
        ctx.strokeStyle = "#fffbd0";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i <= N; i += 2) {
          const j = i === 0 || i === N ? 0 : rand(-10, 10);
          if (i === 0) ctx.moveTo(P[i].x + j, P[i].y + j);
          else ctx.lineTo(P[i].x + j, P[i].y + j);
        }
        ctx.stroke();
      }
    }
    // 날아가는 물방울 덩어리 (반짝이는 물방울 + 꼬리)
    for (const b of this.blobs) {
      if (!b.on) continue;
      const ang = Math.atan2(b.y - b.py, b.x - b.px);
      const r = (b.big ? 12 : 7.5) * b.size;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(ang);
      ctx.fillStyle = b.kind === "normal" ? "rgba(110,205,255,0.55)" : "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(r * 0.6, -r * 0.7);
      ctx.quadraticCurveTo(-r * 3.4, 0, r * 0.6, r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = b.kind === "normal" ? "#8ad8ff" : this.colorFor(b.kind, t);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.25, r * 0.92, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(30,120,200,0.55)";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.beginPath();
      ctx.ellipse(r * 0.25, -r * 0.35, r * 0.45, r * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
