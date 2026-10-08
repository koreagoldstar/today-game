/*
 * 바다괴물 탐험대 · 바닷속 세계 (지형 · 숨는 곳 · 5겹 깊이 레이어 · 수중 빛)
 *
 *  BACKGROUND      물빛 그라데이션(깊을수록 진하게) · 수면 아래 반짝임 · 빛줄기
 *  DEEP BACKGROUND 먼 산호 능선 · 바위 아치 · 지나가는 큰 생물 그림자 (패럴랙스 0.35)
 *  MIDGROUND       물빛에 반쯤 녹은 뒤쪽 바위 · 산호 (0.65)
 *  GAMEPLAY        벽 · 바닥 · 산호 · 숨는 곳 · 물고기 떼 · (엔진) 괴물 · 지혁 · 물줄기
 *  FOREGROUND      화면 가장자리의 큰 다시마 · 떠다니는 입자 · 큰 기포 · 비네팅 (1.3)
 *
 * 스테이지 모양은 stages.js 의 build(b) 가 Builder 로 놓는다.
 */
import { W, H, TAU, clamp, lerp, seeded, hash2 } from "./view.js?v=1";
import * as A from "../art/reef.js?v=1";
import { sprite, put } from "../art/sprites.js?v=1";
import { drawShip, SHIP } from "../art/ship.js?v=1";
import { stalactites, crystal, shroom } from "../art/monsters4.js?v=1";
import { Hazard } from "./hazard.js?v=1";
import { jellyBody, AMB } from "../art/monsters5.js?v=1";
import { chimney, lavaRocks } from "../art/monsters6.js?v=1";
import { iceBlock, iceSlab, iceHoleRim } from "../art/monsters7.js?v=1";
import { whaleBones } from "../art/monsters8.js?v=1";
import { column, archway, plinth, rubble } from "../art/monsters9.js?v=1";
import { eggNest } from "../art/monsters10.js?v=1";
import { mix, alpha, lighten, darken, linear, radial } from "../../ocean-blaster/art/kit.js?v=3";

const R2 = (v) => Math.round(v);

/* ---------------- 깊이에 따른 물빛 ---------------- */
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class World {
  constructor(stage) {
    this.stage = stage;
    this.w = stage.world.w;
    this.h = stage.world.h;
    this.pal = stage.pal;
    this.solids = [];
    this.spots = [];
    this.decor = []; // 캐시 그림 { s, x, y, scale, z }
    this.anims = []; // 매 프레임 그리는 것 { kind, x, y, ... }
    this.far = [];
    this.mid = [];
    this.fg = [];
    this.schools = [];
    this.vents = [];
    this.lights = []; // 스스로 빛나는 것 (어두운 스테이지)
    this.occ = []; // 앞을 가리는 다시마
    this.darkZones = []; // 어두운 곳 (배 안 · 동굴)
    this.lamps = []; // 등불 (빛 · 그림)
    this.shadows = []; // 먼 배경을 지나가는 큰 생물
    this.hazards = []; // 지역 기믹 (전기 말미잘 · 용암 분수 · 고드름 · 물살)
    this.jellies = []; // 떠다니는 해파리 (장식 · 빛)
    this.time = 0;
    this.wallSeed = stage.seed || 7;
    this.wallL = (y) => 0;
    this.wallR = (y) => this.w;
    this.bedY = (x) => this.h - 120;
    this.depthStops = (stage.pal.water || []).map(([d, c]) => [d, hexToRgb(c)]);
    const b = new Builder(this);
    stage.build(b);
    // 떠다니는 입자 (화면 공간 · 3겹 깊이)
    const rnd = seeded(91);
    this.snow = Array.from({ length: 70 }, (_, i) => ({ x: rnd() * W, y: rnd() * 1200, p: [0.4, 0.8, 1.25][i % 3], r: [0.9, 1.4, 2.4][i % 3], a: [0.35, 0.5, 0.35][i % 3], ph: rnd() * TAU }));
    this.prevCam = null;
    this.gradCache = new Map();
  }

  /* ---------------- 물빛 ---------------- */
  waterRGB(y) {
    const st = this.depthStops;
    if (!st.length) return [40, 140, 200];
    if (y <= st[0][0]) return st[0][1];
    for (let i = 1; i < st.length; i++) {
      if (y <= st[i][0]) {
        const k = (y - st[i - 1][0]) / (st[i][0] - st[i - 1][0]);
        const a = st[i - 1][1];
        const b = st[i][1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      }
    }
    return st[st.length - 1][1];
  }
  /** 같은 색을 #rrggbb 로 (밝게 · 어둡게 섞는 그림 함수용) */
  waterHex(y, darkK = 0) {
    const c = this.waterRGB(y);
    const k = 1 - darkK;
    return "#" + c.map((v) => Math.max(0, Math.min(255, R2(v * k))).toString(16).padStart(2, "0")).join("");
  }
  water(y, darkK = 0, a = 1) {
    const c = this.waterRGB(y);
    const k = 1 - darkK;
    return `rgba(${R2(c[0] * k)},${R2(c[1] * k)},${R2(c[2] * k)},${a})`;
  }

  /* ---------------- 충돌 ---------------- */
  /** 원(x,y,r)이 벽 · 바닥 · 바위에 박히지 않게 밀어낸다. 닿았으면 {nx,ny} */
  push(o, r) {
    let hit = null;
    const top = this.stage.ceiling == null ? 30 : this.stage.ceiling;
    if (o.y < top + r) {
      o.y = top + r;
      hit = { nx: 0, ny: 1 };
    }
    const l = this.wallL(o.y) + r;
    if (o.x < l) {
      o.x = l;
      hit = { nx: 1, ny: 0 };
    }
    const rr = this.wallR(o.y) - r;
    if (o.x > rr) {
      o.x = rr;
      hit = { nx: -1, ny: 0 };
    }
    const by = this.bedY(o.x) - r;
    if (o.y > by) {
      o.y = by;
      hit = { nx: 0, ny: -1 };
    }
    for (const s of this.solids) {
      if (s.type === "circle") {
        const dx = o.x - s.x;
        const dy = o.y - s.y;
        const d = Math.hypot(dx, dy);
        const m = s.r + r;
        if (d < m && d > 0.01) {
          o.x = s.x + (dx / d) * m;
          o.y = s.y + (dy / d) * m;
          hit = { nx: dx / d, ny: dy / d };
        }
      } else if (s.type === "rect") {
        const cx = Math.max(s.x0, Math.min(s.x1, o.x));
        const cy = Math.max(s.y0, Math.min(s.y1, o.y));
        const dx = o.x - cx;
        const dy = o.y - cy;
        const d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 0.01) {
            o.x = cx + (dx / d) * r;
            o.y = cy + (dy / d) * r;
            hit = { nx: dx / d, ny: dy / d };
          } else {
            // 네모 안으로 들어가 버렸으면 가장 가까운 면으로
            const l = o.x - s.x0;
            const rr = s.x1 - o.x;
            const t = o.y - s.y0;
            const b = s.y1 - o.y;
            const m = Math.min(l, rr, t, b);
            if (m === l) (o.x = s.x0 - r), (hit = { nx: -1, ny: 0 });
            else if (m === rr) (o.x = s.x1 + r), (hit = { nx: 1, ny: 0 });
            else if (m === t) (o.y = s.y0 - r), (hit = { nx: 0, ny: -1 });
            else (o.y = s.y1 + r), (hit = { nx: 0, ny: 1 });
          }
        }
      } else if (s.type === "ellipse") {
        // 타원을 원으로 펴서 계산
        const dx = (o.x - s.x) / (s.rx + r);
        const dy = (o.y - s.y) / (s.ry + r);
        const d = Math.hypot(dx, dy);
        if (d < 1 && d > 0.001) {
          o.x = s.x + (dx / d) * (s.rx + r);
          o.y = s.y + (dy / d) * (s.ry + r);
          hit = { nx: dx / d, ny: dy / d };
        }
      }
    }
    return hit;
  }
  /** 점이 물속(벽 · 바닥 · 바위 밖)인가 */
  open(x, y, r = 0) {
    const o = { x, y };
    return !this.push(o, r);
  }

  /* ---------------- 갱신 ---------------- */
  update(dt, player) {
    this.time += dt;
    for (const sc of this.schools) sc.update(dt, player, this);
    if (this.g) for (const h of this.hazards) h.update(dt, this.g);
    for (const sh of this.shadows) {
      sh.x += sh.vx * dt;
      if (sh.vx > 0 && sh.x > sh.x1) sh.x = sh.x0;
      if (sh.vx < 0 && sh.x < sh.x0) sh.x = sh.x1;
    }
  }

  /* ================================================================
   * 그리기
   * ============================================================== */
  /** BACKGROUND + DEEP BACKGROUND + MIDGROUND */
  drawBack(ctx, cam) {
    const t = this.time;
    const cy = cam.y;
    // 1) 물빛: 화면 위아래 깊이를 따라 진해진다
    const key = R2(cy / 8);
    let g = this.gradCache.get(key);
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, H);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, this.water(cy + (H * i) / 6));
      if (this.gradCache.size > 400) this.gradCache.clear();
      this.gradCache.set(key, g);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 3) 빛줄기
    this.drawRays(ctx, cam, t);
    // 4) 먼 배경 (0.35)
    const pf = 0.35;
    for (const f of this.far) {
      const sx = f.x - cam.x * pf;
      const sy = f.y - cy * pf;
      if (sx > W + f.w || sx + f.w < -f.w || sy > H + 40 || sy + f.h < -40) continue;
      put(ctx, f.s, sx, sy);
    }
    for (const sh of this.shadows) {
      const sx = sh.x - cam.x * sh.p;
      const sy = sh.y - cy * sh.p;
      if (sx < -400 || sx > W + 400 || sy < -200 || sy > H + 200) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(sh.vx > 0 ? 1 : -1, 1);
      ctx.globalAlpha = sh.a;
      if (sh.kind === "manta") A.mantaShadow(ctx, sh.s, t + sh.ph, this.water(sh.y / sh.p, 0.32));
      else A.whaleShadow(ctx, sh.s, t + sh.ph, this.water(sh.y / sh.p, 0.3));
      ctx.restore();
    }
    // 5) 중간 (0.65) — 물빛에 반쯤 녹아 흐릿하게
    const pm = 0.65;
    ctx.globalAlpha = 0.6;
    for (const m of this.mid) {
      const sx = m.x - cam.x * pm;
      const sy = m.y - cy * pm;
      if (m.top) {
        if (sx > W || sx + m.w < 0 || sy > H || sy + m.h < 0) continue;
        ctx.globalAlpha = 0.9;
        put(ctx, m.s, sx, sy);
        ctx.globalAlpha = 0.6;
        continue;
      }
      if (sx < -m.s.w || sx > W + m.s.w || sy < -40 || sy - m.s.h > H + 40) continue;
      put(ctx, m.s, sx, sy, m.scale || 1);
    }
    ctx.globalAlpha = 1;
    // 중간 레이어 위로 물빛 안개 한 겹 (멀리 있는 느낌)
    ctx.fillStyle = this.water(cy + H * 0.5, 0, 0.22);
    ctx.fillRect(0, 0, W, H);
    // 수면 (위는 하늘 · 탐험대 보트, 아래는 출렁이는 천장)
    if (cy < 260) this.drawSurface(ctx, cam, t);
  }

  drawSurface(ctx, cam, t) {
    const sy = -cam.y;
    // 수면 위: 하늘 · 먼 수평선 · 구름 · 탐험대 보트
    if (sy > 0) {
      const g = ctx.createLinearGradient(0, sy - 420, 0, sy);
      g.addColorStop(0, "#5ec4f5");
      g.addColorStop(0.7, "#bfeaff");
      g.addColorStop(1, "#f2fbff");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, sy);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const [cx, cyy, r] of [
        [80, -230, 26],
        [118, -240, 34],
        [158, -228, 24],
        [380, -300, 22],
        [412, -310, 30],
        [446, -298, 20],
      ]) {
        ctx.beginPath();
        ctx.arc(cx - cam.x * 0.2, sy + cyy, r, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#4fb6dc";
      ctx.fillRect(0, sy - 8, W, 8);
      if (this.stage.start) {
        ctx.save();
        ctx.translate(this.stage.start.x - 110 - cam.x, sy - 2);
        A.boatSide(ctx, t);
        ctx.restore();
      }
    }
    // 출렁이는 수면 테두리
    ctx.beginPath();
    ctx.moveTo(0, sy - 30);
    for (let x = 0; x <= W; x += 18) {
      const wx = x + cam.x;
      ctx.lineTo(x, sy + Math.sin(wx * 0.025 + t * 1.6) * 5 + Math.sin(wx * 0.061 - t * 2.3) * 3);
    }
    ctx.lineTo(W, sy - 30);
    ctx.closePath();
    ctx.fillStyle = "rgba(235,252,255,0.95)";
    ctx.fill();
    if (this.pal.canopy) {
      // 수면에 떠 있는 다시마 잎 (빛이 잎 사이로 새어 든다)
      for (let i = 0; i < 18; i++) {
        const wx = i * 71 + 20;
        const x = wx - cam.x;
        if (x < -60 || x > W + 60) continue;
        const sw = Math.sin(t * 0.8 + i) * 8;
        ctx.save();
        ctx.translate(x, sy + 6);
        ctx.rotate(Math.sin(i * 2.3) * 0.5 + sw * 0.01);
        ctx.beginPath();
        ctx.ellipse(sw, 6, 44, 10, 0, 0, TAU);
        ctx.fillStyle = i % 2 ? "rgba(40,120,70,0.85)" : "rgba(60,150,80,0.8)";
        ctx.fill();
        ctx.restore();
      }
    }
    // 수면 바로 아래 반짝이는 그물 무늬
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const wx = (i * 97 + 40) % (this.w + 200) - 100;
      const x = wx - cam.x;
      if (x < -60 || x > W + 60) continue;
      const y = sy + 14 + ((i * 37) % 60);
      const a = 0.12 + 0.1 * Math.sin(t * 2 + i);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 24, y);
      ctx.quadraticCurveTo(x, y - 8 + Math.sin(t * 3 + i) * 4, x + 24, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRays(ctx, cam, t) {
    const rays = this.stage.light.rays || 0;
    if (!rays) return;
    const reach = this.stage.light.reach || 1500;
    const top = -cam.y;
    if (top + reach < 0) return;
    const ray = sprite("ray", 120, 1000, 60, 0, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 1000);
      g.addColorStop(0, "rgba(255,255,240,0.55)");
      g.addColorStop(0.35, "rgba(220,250,255,0.22)");
      g.addColorStop(1, "rgba(200,240,255,0)");
      const h = c.createLinearGradient(-60, 0, 60, 0);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-26, 0);
      c.lineTo(26, 0);
      c.lineTo(60, 1000);
      c.lineTo(-60, 1000);
      c.closePath();
      c.fill();
      void h;
    });
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const strength = this.stage.light.rayA || 0.55;
    for (let i = 0; i < rays; i++) {
      const wx = ((i + 0.5) / rays) * (this.w + 200) - 100 + Math.sin(t * 0.13 + i * 2.1) * 30;
      const x = wx - cam.x * 0.55;
      const a = strength * (0.55 + 0.45 * Math.sin(t * 0.37 + i * 1.7));
      ctx.globalAlpha = Math.max(0, a);
      ctx.save();
      ctx.translate(x, top);
      ctx.rotate(0.22 + Math.sin(t * 0.21 + i) * 0.03);
      ctx.scale(0.8 + (i % 3) * 0.35, reach / 1000);
      put(ctx, ray, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  /** GAMEPLAY 레이어 (괴물 · 지혁보다 뒤): 벽 · 바닥 · 산호 · 숨는 곳 뒤판 */
  drawTerrain(ctx, cam) {
    const t = this.time;
    const cx = cam.x;
    const cy = cam.y;
    const vis = (x, y, w, h) => x + w > cx - 60 && x - w < cx + W + 60 && y + 60 > cy && y - h < cy + H + 60;
    // 벽
    for (const wl of this.wallSprites) {
      put(ctx, wl.s, wl.x - cx, wl.y - cy);
    }
    // 뒤쪽 해초 (지형 앞 · 산호 뒤) — 물빛에 살짝 녹아 뒤로 물러나 보이게
    ctx.globalAlpha = 0.72;
    for (const a of this.anims) {
      if (a.layer !== "back" || !vis(a.x, a.y, 80, a.h || 120)) continue;
      this.drawAnim(ctx, a, a.x - cx, a.y - cy, t);
    }
    ctx.globalAlpha = 1;
    // 바닥 모래 + 물결 빛 무늬 (커스틱)
    for (const sd of this.bedSprites) put(ctx, sd.s, sd.x - cx, sd.y - cy);
    if (this.stage.light.caustics !== false) this.drawCaustics(ctx, cam, t);
    // 장식 (정렬된 순서)
    for (const d of this.decor) {
      if (!vis(d.x, d.y, d.s.w, d.s.h)) continue;
      if (d.flip) {
        ctx.save();
        ctx.translate(d.x - cx, d.y - cy);
        ctx.scale(-1, 1);
        put(ctx, d.s, 0, 0, d.scale || 1);
        ctx.restore();
      } else put(ctx, d.s, d.x - cx, d.y - cy, d.scale || 1);
    }
    for (const a of this.anims) {
      if (a.layer === "back" || a.layer === "fg" || !vis(a.x, a.y, 80, a.h || 120)) continue;
      this.drawAnim(ctx, a, a.x - cx, a.y - cy, t);
    }
    // 기포 기둥 (바닥에서 보글보글)
    ctx.fillStyle = "rgba(230,250,255,0.75)";
    for (const v of this.vents) {
      if (v.off || !vis(v.x, v.y, 40, 300)) continue;
      for (let i = 0; i < 7; i++) {
        const k = (t * v.speed + i / 7) % 1;
        const y = v.y - k * v.h;
        const x = v.x + Math.sin(k * 9 + i) * 6;
        const r = 1.5 + k * 3.5 + (i % 2);
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.beginPath();
        ctx.arc(x - cx, y - cy, r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // 등불 · 수정 · 빛버섯
    for (const L of this.lamps) {
      const x = L.x - cx;
      const y = L.y - cy;
      if (x < -80 || x > W + 80 || y < -100 || y > H + 80) continue;
      if (L.kind === "hot") continue;
      if (L.kind === "crystal" || L.kind === "shroom") {
        put(ctx, L.s, x, y);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 2 + L.x);
        const gl = ctx.createRadialGradient(x, y - 20, 2, x, y - 20, 90);
        gl.addColorStop(0, L.color + "cc");
        gl.addColorStop(1, L.color + "00");
        ctx.fillStyle = gl;
        ctx.fillRect(x - 90, y - 110, 180, 180);
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(x, y - 30);
      ctx.lineTo(x, y - 12);
      ctx.strokeStyle = "#3a3020";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#c8962e";
      ctx.fillRect(x - 9, y - 14, 18, 4);
      ctx.fillRect(x - 9, y + 10, 18, 4);
      const g = ctx.createRadialGradient(x, y, 1, x, y, 12);
      g.addColorStop(0, "#fffbe0");
      g.addColorStop(1, "#ffb03a");
      ctx.fillStyle = g;
      ctx.fillRect(x - 7, y - 10, 14, 20);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35 + 0.08 * Math.sin(t * 7 + L.x);
      const gl = ctx.createRadialGradient(x, y, 2, x, y, 70);
      gl.addColorStop(0, "rgba(255,210,120,0.9)");
      gl.addColorStop(1, "rgba(255,180,80,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(x - 70, y - 70, 140, 140);
      ctx.restore();
    }
    // 물고기 떼
    for (const sc of this.schools) sc.draw(ctx, cam, t);
    this.drawJellies(ctx, cam, t);
  }

  /** 떠다니는 해파리 (괴물이 아님 · 빛을 낸다) */
  jellyPos(j, t) {
    return [j.x + Math.sin(t * 0.31 * j.sp + j.ph) * 18, j.y + Math.sin(t * 0.52 * j.sp + j.ph * 1.7) * 22];
  }
  drawJellies(ctx, cam, t) {
    if (!this.jellies.length) return;
    const gl = sprite("jglow", 140, 140, 70, 70, (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 70);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(-70, -70, 140, 140);
    });
    for (const j of this.jellies) {
      const [x, y] = this.jellyPos(j, t);
      const sx = x - cam.x;
      const sy = y - cam.y;
      if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 120) continue;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35;
      put(ctx, gl, sx, sy - 6, j.size);
      ctx.restore();
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(j.size, j.size);
      if (!j.p) j.p = { t: 0 };
      j.p.t = t * j.sp + j.ph;
      jellyBody(ctx, j.p, { color: j.color, w: 30, h: 26, len: 56, n: 5, tw: 2.6, speed: 2.4 });
      ctx.restore();
    }
  }

  /** 모래 위에 일렁이는 빛 그물 (바닥 모양 안에서만) */
  drawCaustics(ctx, cam, t) {
    const top = this.bedY(cam.x + W / 2) - cam.y;
    if (top > H + 20 || top < -200) return;
    const tile = sprite("caustic", 256, 256, 0, 0, (c) => {
      const rnd = seeded(77);
      c.strokeStyle = "rgba(255,255,240,0.9)";
      c.lineCap = "round";
      // 셀 경계 같은 구불구불한 선
      for (let i = 0; i < 46; i++) {
        const x = rnd() * 256;
        const y = rnd() * 256;
        const len = 18 + rnd() * 30;
        const a = rnd() * TAU;
        c.lineWidth = 1.5 + rnd() * 2.5;
        for (const ox of [-256, 0, 256])
          for (const oy of [-256, 0, 256]) {
            c.beginPath();
            c.moveTo(x + ox, y + oy);
            c.quadraticCurveTo(x + ox + Math.cos(a + 1) * len * 0.6, y + oy + Math.sin(a + 1) * len * 0.6, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
            c.stroke();
          }
      }
    });
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-10, H + 10);
    for (let x = -10; x <= W + 20; x += 30) ctx.lineTo(x, this.bedY(x + cam.x) - cam.y + 4);
    ctx.lineTo(W + 20, H + 10);
    ctx.closePath();
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 2; k++) {
      const ox = ((-cam.x * 1 + t * (k ? 11 : -7)) % 256) - 256;
      const oy = ((-cam.y + t * (k ? 5 : 8)) % 256) - 256;
      ctx.globalAlpha = 0.07 + 0.03 * Math.sin(t * 1.3 + k * 2);
      for (let x = ox; x < W; x += 256) for (let y = Math.max(oy, Math.floor((top - 256 - oy) / 256) * 256 + oy); y < H; y += 256) put(ctx, tile, x, y);
    }
    ctx.restore();
  }

  drawAnim(ctx, a, x, y, t) {
    switch (a.kind) {
      case "anemone":
        A.anemone(ctx, x, y, a.s, t + a.ph, { color: a.color, tip: a.tip });
        break;
      case "weed":
        A.seaweed(ctx, x, y, a.h, t + a.ph, { color: a.color, w: a.w });
        break;
      case "kelp":
        A.kelp(ctx, x, y, a.h, t + a.ph, { color: a.color, w: a.w });
        break;
      case "eddy": {
        // 작은 소용돌이 (소용돌이물고기가 숨는다)
        ctx.save();
        ctx.translate(x, y);
        ctx.lineCap = "round";
        for (let arm = 0; arm < 3; arm++) {
          ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const k = i / 16;
            const ang = arm * (TAU / 3) + k * 3.4 - (t + a.ph) * 3.2;
            const r = 6 + k * 62;
            ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r * 0.85);
          }
          ctx.strokeStyle = "rgba(220,245,255,0.32)";
          ctx.lineWidth = 4;
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
    }
  }

  /** 숨는 곳 '뒤판' (구멍 안쪽 등) — 숨은 괴물보다 먼저 */
  drawSpotBack(ctx, sp, cam) {
    if (sp.back) put(ctx, sp.back, sp.x - cam.x, sp.y - cam.y);
    if (sp.backAnim) this.drawAnim(ctx, sp.backAnim, sp.backAnim.x - cam.x, sp.backAnim.y - cam.y, this.time);
  }
  /** 숨는 곳 '가리개' (산호 덤불 · 바위 · 구멍 테) — 숨은 괴물보다 나중에 */
  drawSpotCover(ctx, sp, cam) {
    if (sp.cover) put(ctx, sp.cover, sp.x - cam.x, sp.y - cam.y);
    if (sp.coverAnims) for (const a of sp.coverAnims) this.drawAnim(ctx, a, a.x - cam.x, a.y - cam.y, this.time);
  }

  /** 괴물 · 지혁보다 앞에 서 있는 큰 다시마 (시야를 가린다) */
  drawOccluders(ctx, cam) {
    if (!this.occ.length) return;
    ctx.globalAlpha = 0.9;
    for (const a of this.occ) {
      if (a.x < cam.x - 120 || a.x > cam.x + W + 120 || a.y - a.h > cam.y + H || a.y < cam.y - 40) continue;
      this.drawAnim(ctx, a, a.x - cam.x, a.y - cam.y, this.time);
    }
    ctx.globalAlpha = 1;
  }

  /** FOREGROUND: 큰 다시마 · 입자 · 비네팅 · 깊이 어둠 */
  drawFront(ctx, cam, darkLights) {
    const t = this.time;
    const pf = 1.3;
    for (const f of this.fg) {
      const sx = f.x - cam.x * pf + (W * (pf - 1)) / 2;
      const sy = f.y - cam.y * pf + (H * (pf - 1)) / 2;
      if (sx < -260 || sx > W + 260 || sy - 420 * (f.s || 1) > H || sy < -60) continue;
      ctx.globalAlpha = f.a;
      A.kelpClump(ctx, sx, sy, f.s || 1, t + f.ph, f.color);
    }
    ctx.globalAlpha = 1;
    // 떠다니는 입자 (마린 스노우)
    if (this.prevCam) {
      const dx = cam.x - this.prevCam.x;
      const dy = cam.y - this.prevCam.y;
      for (const p of this.snow) {
        p.x -= dx * p.p;
        p.y -= dy * p.p;
      }
    }
    this.prevCam = { x: cam.x, y: cam.y };
    const snowC = this.pal.snow || "255,255,255";
    for (const p of this.snow) {
      p.y -= 4 * p.p * (1 / 60);
      p.x = ((p.x % W) + W) % W;
      p.y = ((p.y % (H + 40)) + H + 40) % (H + 40);
      const tw = 0.6 + 0.4 * Math.sin(t * 1.3 + p.ph);
      ctx.fillStyle = `rgba(${snowC},${p.a * tw})`;
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(t * 0.6 + p.ph) * 6, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    // 깊이 어둠 + 빛 (어두운 스테이지는 헤드램프 · 빛나는 생물만 밝다)
    const dark = clamp(this.stage.light.dark || 0, 0, 0.95);
    const deep = clamp((cam.y + H * 0.5 - (this.stage.light.darkFrom || 1300)) / 1800, 0, 0.35) * (this.stage.light.deepDark == null ? 1 : this.stage.light.deepDark);
    const total = Math.min(0.96, dark + deep + (this.extraDark || 0));
    const zones = this.darkZones.filter((z) => z.x1 > cam.x && z.x0 < cam.x + W && z.y1 > cam.y && z.y0 < cam.y + H);
    if (total > 0.02 || zones.length) {
      const lights = (darkLights || []).slice();
      for (const j of this.jellies) {
        const [jx, jy] = this.jellyPos(j, t);
        const x = jx - cam.x;
        const y = jy - cam.y;
        if (x > -100 && x < W + 100 && y > -100 && y < H + 100) lights.push({ x, y, r: 95 * j.size, a: 0.7 });
      }
      for (const h of this.hazards) {
        const L = h.light && h.light();
        if (!L) continue;
        const x = L.x - cam.x;
        const y = L.y - cam.y;
        if (x > -L.r && x < W + L.r && y > -L.r && y < H + L.r) lights.push({ x, y, r: L.r, a: 0.85 });
      }
      for (const L of this.lamps) {
        const x = L.x - cam.x;
        const y = L.y - cam.y;
        if (x > -L.r && x < W + L.r && y > -L.r && y < H + L.r) lights.push({ x, y, r: L.r * (0.92 + 0.08 * Math.sin(t * 7 + L.x)), a: 0.95 });
      }
      this.drawDark(ctx, total, lights, zones, cam);
    }
    // 비네팅
    const vg = sprite(`vig${H}`, W, H, 0, 0, (c) => {
      const g = c.createRadialGradient(W / 2, H * 0.48, H * 0.32, W / 2, H * 0.5, H * 0.78);
      g.addColorStop(0, "rgba(0,20,50,0)");
      g.addColorStop(1, "rgba(0,18,46,0.42)");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    });
    put(ctx, vg, 0, 0);
  }

  /** 어둠 판: 저해상도 캔버스에 어둠을 칠하고 빛 자리만 지운다 */
  drawDark(ctx, a, lights, zones = [], cam = { x: 0, y: 0 }) {
    const s = 0.25;
    if (!this.darkC) {
      this.darkC = document.createElement("canvas");
      this.darkX = this.darkC.getContext("2d");
    }
    const c = this.darkC;
    const w = Math.ceil(W * s);
    const h = Math.ceil(H * s);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const x = this.darkX;
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, w, h);
    const dc = this.pal.darkColor || "2,10,28";
    if (a > 0) {
      x.fillStyle = `rgba(${dc},${a})`;
      x.fillRect(0, 0, w, h);
    }
    for (const z of zones) {
      // 구역 가장자리는 부드럽게 (빛이 새어 든다)
      const zx = (z.x0 - cam.x) * s;
      const zy = (z.y0 - cam.y) * s;
      const zw = (z.x1 - z.x0) * s;
      const zh = (z.y1 - z.y0) * s;
      x.fillStyle = `rgba(${dc},${z.a})`;
      x.fillRect(zx, zy, zw, zh);
    }
    x.globalCompositeOperation = "destination-out";
    for (const L of lights) {
      const r = L.r * s;
      const g = x.createRadialGradient(L.x * s, L.y * s, 0, L.x * s, L.y * s, r);
      g.addColorStop(0, `rgba(0,0,0,${L.a == null ? 1 : L.a})`);
      g.addColorStop(0.55, `rgba(0,0,0,${(L.a == null ? 1 : L.a) * 0.6})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      if (L.cone) {
        x.beginPath();
        x.moveTo(L.x * s, L.y * s);
        x.arc(L.x * s, L.y * s, r, L.ang - L.cone, L.ang + L.cone);
        x.closePath();
        x.fill();
      } else {
        x.fillRect(L.x * s - r, L.y * s - r, r * 2, r * 2);
      }
    }
    ctx.drawImage(c, 0, 0, W, H);
  }
}

/* ================================================================
 * 물고기 떼 (장식): 기준점 주위를 돌다가 지혁이 가까이 오면 흩어진다
 * ============================================================== */
class School {
  constructor(x, y, n, color, rnd, size = 1) {
    this.ax = x;
    this.ay = y;
    this.color = color;
    this.fish = Array.from({ length: n }, () => ({ x: x + (rnd() - 0.5) * 80, y: y + (rnd() - 0.5) * 50, vx: 0, vy: 0, ph: rnd() * TAU, s: (0.75 + rnd() * 0.4) * size }));
    this.t = rnd() * 10;
  }
  update(dt, player, world) {
    this.t += dt;
    const cx = this.ax + Math.cos(this.t * 0.35) * 70;
    const cy = this.ay + Math.sin(this.t * 0.5) * 30;
    for (const f of this.fish) {
      let ax = (cx - f.x) * 0.9 + Math.cos(this.t * 0.35 + 1.57) * 30;
      let ay = (cy - f.y) * 0.9;
      if (player) {
        const dx = f.x - player.x;
        const dy = f.y - player.y;
        const d = Math.hypot(dx, dy);
        if (d < 150) {
          ax += (dx / (d + 1)) * 2600 * (1 - d / 150);
          ay += (dy / (d + 1)) * 2600 * (1 - d / 150);
        }
      }
      f.vx += (ax - f.vx * 1.6) * dt;
      f.vy += (ay - f.vy * 1.6) * dt;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > 260) {
        f.vx *= 260 / sp;
        f.vy *= 260 / sp;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      world.push(f, 6);
    }
  }
  draw(ctx, cam, t) {
    for (const f of this.fish) {
      const x = f.x - cam.x;
      const y = f.y - cam.y;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
      A.smallFish(ctx, x, y, f.s, t + f.ph, this.color, f.vx >= 0 ? 1 : -1);
    }
  }
}

/** 그림 아래쪽을 투명하게 (먼 배경이 띠처럼 끊기지 않게) */
function fadeBottom(c, from = 0.45) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "destination-in";
  const g = c.createLinearGradient(0, 0, 0, c.canvas.height);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(from, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  c.restore();
}

/* ================================================================
 * Builder — stages.js 의 build(b) 가 부른다
 * ============================================================== */
class Builder {
  constructor(world) {
    this.world = world;
    this.rnd = seeded(world.stage.seed || 11);
    this.n = 0;
    world.wallSprites = [];
    world.bedSprites = [];
  }
  get w() {
    return this.world.w;
  }
  get h() {
    return this.world.h;
  }

  /** 좌우 벽: 안쪽 가장자리 x = base + 울퉁불퉁 */
  walls({ left = 120, right = 120, amp = 40, color = "#6f7f98" } = {}) {
    const wd = this.world;
    const s1 = this.rnd() * 10;
    const s2 = this.rnd() * 10;
    wd.wallL = (y) => left + Math.sin(y * 0.006 + s1) * amp + Math.sin(y * 0.017 + s2) * amp * 0.45;
    wd.wallR = (y) => wd.w - right - Math.sin(y * 0.0055 + s2) * amp - Math.sin(y * 0.019 + s1) * amp * 0.45;
    const maxL = left + amp * 1.5 + 30;
    const maxR = right + amp * 1.5 + 30;
    const rnd = seeded((wd.stage.seed || 3) * 7 + 1);
    const mk = (side) => {
      const wdth = side < 0 ? maxL : maxR;
      return sprite(`wall${side}|${wd.stage.id}`, wdth + 40, wd.h, side < 0 ? 0 : 40, 0, (c) => {
        // 가장자리를 따라 바위 덩어리
        c.beginPath();
        if (side < 0) {
          c.moveTo(-10, 0);
          for (let y = 0; y <= wd.h; y += 24) c.lineTo(wd.wallL(y) + Math.sin(y * 0.11) * 4, y);
          c.lineTo(-10, wd.h);
        } else {
          c.moveTo(wdth + 10, 0);
          for (let y = 0; y <= wd.h; y += 24) c.lineTo(wd.wallR(y) - (wd.w - wdth) + Math.sin(y * 0.11) * 4, y);
          c.lineTo(wdth + 10, wd.h);
        }
        c.closePath();
        const inner = side < 0 ? left + amp : 0;
        const g = c.createLinearGradient(side < 0 ? 0 : wdth, 0, side < 0 ? inner + 20 : 0, 0);
        g.addColorStop(0, darken(color, 0.55));
        g.addColorStop(0.7, darken(color, 0.1));
        g.addColorStop(1, lighten(color, 0.12));
        c.fillStyle = g;
        c.fill();
        c.lineWidth = 3;
        c.strokeStyle = darken(color, 0.62);
        c.stroke();
        c.save();
        c.clip();
        // 바위 층 · 이끼 · 산호 점
        for (let i = 0; i < wd.h / 18; i++) {
          const y = rnd() * wd.h;
          const ex = side < 0 ? wd.wallL(y) : wd.wallR(y) - (wd.w - wdth);
          const x = ex + (side < 0 ? -1 : 1) * rnd() * 70;
          c.beginPath();
          c.ellipse(x, y, 10 + rnd() * 24, 6 + rnd() * 10, rnd() * 3, 0, TAU);
          c.fillStyle = alpha(rnd() < 0.55 ? darken(color, 0.3) : lighten(color, 0.18), 0.5);
          c.fill();
        }
        for (let i = 0; i < wd.h / 26; i++) {
          const y = rnd() * wd.h;
          const ex = side < 0 ? wd.wallL(y) : wd.wallR(y) - (wd.w - wdth);
          const x = ex + (side < 0 ? -1 : 1) * (2 + rnd() * 14);
          c.beginPath();
          c.arc(x, y, 3 + rnd() * 5, 0, TAU);
          c.fillStyle = alpha(["#ff8fb3", "#7fd18a", "#ffd166", "#b28bff", "#ff9b6a"][Math.floor(rnd() * 5)], 0.85);
          c.fill();
        }
        // 위에서 오는 빛: 가장자리를 따라 밝은 테
        c.restore();
        c.beginPath();
        for (let y = 0; y <= wd.h; y += 24) {
          const x = side < 0 ? wd.wallL(y) - 3 : wd.wallR(y) - (wd.w - wdth) + 3;
          if (y === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.strokeStyle = alpha(lighten(color, 0.45), 0.5);
        c.lineWidth = 2;
        c.stroke();
      });
    };
    wd.wallSprites.push({ s: mk(-1), x: 0, y: 0 });
    wd.wallSprites.push({ s: mk(1), x: wd.w - maxR, y: 0 });
  }

  /** 바닥: 기본 높이(아래에서) + 언덕 */
  bed({ depth = 150, amp = 30, color = "#f3d9a4" } = {}) {
    const wd = this.world;
    const s1 = this.rnd() * 10;
    wd.bedY = (x) => wd.h - depth - Math.sin(x * 0.007 + s1) * amp - Math.sin(x * 0.021 + s1 * 2) * amp * 0.35;
    const top = wd.h - depth - amp * 1.4 - 20;
    const hgt = wd.h - top + 10;
    const rnd = seeded((wd.stage.seed || 3) * 13);
    const s = sprite(`bed|${wd.stage.id}`, wd.w, hgt, 0, 0, (c) => {
      c.beginPath();
      c.moveTo(0, hgt);
      for (let x = 0; x <= wd.w; x += 20) c.lineTo(x, wd.bedY(x) - top);
      c.lineTo(wd.w, hgt);
      c.closePath();
      const g = c.createLinearGradient(0, 0, 0, hgt);
      g.addColorStop(0, lighten(color, 0.25));
      g.addColorStop(0.3, color);
      g.addColorStop(1, darken(color, 0.55));
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = darken(color, 0.55);
      c.stroke();
      c.save();
      c.clip();
      for (let i = 0; i < wd.w / 16; i++) {
        const x = rnd() * wd.w;
        const y = wd.bedY(x) - top + 14 + rnd() * 70;
        c.beginPath();
        c.moveTo(x - 14, y);
        c.quadraticCurveTo(x, y - 4, x + 14, y);
        c.strokeStyle = alpha(darken(color, 0.25), 0.45);
        c.lineWidth = 1.6;
        c.stroke();
      }
      for (let i = 0; i < wd.w / 8; i++) {
        const x = rnd() * wd.w;
        const y = wd.bedY(x) - top + 6 + rnd() * 90;
        c.beginPath();
        c.arc(x, y, 0.8 + rnd() * 2, 0, TAU);
        c.fillStyle = alpha(rnd() < 0.5 ? "#ffffff" : darken(color, 0.35), 0.55);
        c.fill();
      }
      c.restore();
      // 윗면 빛 테
      c.beginPath();
      for (let x = 0; x <= wd.w; x += 20) {
        const y = wd.bedY(x) - top - 2;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = alpha(lighten(color, 0.5), 0.7);
      c.lineWidth = 2.4;
      c.stroke();
    });
    wd.bedSprites.push({ s, x: 0, y: top });
  }
  onBed(x, sink = 6) {
    return this.world.bedY(x) + sink;
  }

  /** 벽에서 튀어나온 바위 턱: 벽 쪽이 두껍고 끝이 얇다 (부딪힘은 타원 두 개) */
  ledge(side, y, reach, thick, color = "#7d8fa6") {
    const wd = this.world;
    const wx = side < 0 ? wd.wallL(y) : wd.wallR(y);
    const len = reach;
    const seed = ++this.n;
    const s = sprite(`ledge|${wd.stage.id}|${seed}`, len + thick + 60, thick * 1.8 + 40, 40, thick * 0.9 + 20, (c) => {
      A.ledgeRock(c, len, thick, color, seeded(seed * 31));
    });
    wd.decor.push({ s, x: wx, y, z: y - 1000, flip: side > 0 });
    const dir = side < 0 ? 1 : -1;
    wd.solids.push({ type: "ellipse", x: wx + dir * len * 0.3, y: y + thick * 0.05, rx: len * 0.42, ry: thick * 0.58 });
    wd.solids.push({ type: "ellipse", x: wx + dir * len * 0.72, y: y - thick * 0.12, rx: len * 0.3, ry: thick * 0.32 });
    const topAt = (x) => y - thick * (0.62 - Math.min(1, Math.abs(x - wx) / len) * 0.36);
    // 아래쪽 면 (고드름 · 매달린 것)
    const bottomAt = (x) => {
      let b = y;
      for (const [cx, cy, rx, ry] of [
        [wx + dir * len * 0.3, y + thick * 0.05, len * 0.42, thick * 0.58],
        [wx + dir * len * 0.72, y - thick * 0.12, len * 0.3, thick * 0.32],
      ]) {
        const u = (x - cx) / rx;
        if (Math.abs(u) < 1) b = Math.max(b, cy + ry * Math.sqrt(1 - u * u));
      }
      return b;
    };
    return { x: wx + dir * len * 0.55, tip: wx + dir * len, wall: wx, y, top: topAt(wx + dir * len * 0.55), topAt, bottomAt, dir };
  }

  /** 단단한 바위 (부딪힘) */
  rock(x, y, s = 1, color = "#7d8fa6") {
    const wd = this.world;
    const seed = ++this.n;
    const sp = sprite(`rock|${wd.stage.id}|${seed}`, 160 * s, 80 * s, 80 * s, 66 * s, (c) => A.rock(c, s, seeded(seed * 7), { color }));
    wd.decor.push({ s: sp, x, y, z: y });
    wd.solids.push({ type: "ellipse", x, y: y - 20 * s, rx: 58 * s, ry: 30 * s });
  }

  /** 산호 · 해면 (장식, 부딪히지 않는다) */
  coral(kind, x, y, s = 1, color) {
    const wd = this.world;
    const seed = ++this.n;
    const fn = { branch: A.branchCoral, brain: A.brainCoral, fan: A.fanCoral, table: A.tableCoral, tube: A.tubeSponge }[kind];
    const box = { branch: [150, 150], brain: [110, 60], fan: [130, 110], table: [140, 90], tube: [90, 90] }[kind];
    const sp = sprite(`c|${kind}|${wd.stage.id}|${seed}`, box[0] * s, box[1] * s + 12, (box[0] * s) / 2, box[1] * s + 4, (c) => fn(c, s, seeded(seed * 11), { color }));
    wd.decor.push({ s: sp, x, y, z: y });
  }
  shell(x, y, s = 1) {
    const seed = ++this.n;
    const sp = sprite(`sh|${this.world.stage.id}|${seed}`, 30 * s, 20 * s, 15 * s, 16 * s, (c) => A.shell(c, s, seeded(seed)));
    this.world.decor.push({ s: sp, x, y, z: y });
  }
  starfish(x, y, s = 1) {
    const seed = ++this.n;
    const sp = sprite(`sf|${this.world.stage.id}|${seed}`, 32 * s, 22 * s, 16 * s, 14 * s, (c) => A.starfish(c, s, seeded(seed)));
    this.world.decor.push({ s: sp, x, y, z: y });
  }
  anemone(x, y, s = 1, color, tip) {
    this.world.anims.push({ kind: "anemone", x, y, s, color, tip, ph: this.rnd() * 10, h: 50 * s });
  }
  weed(x, y, h, color, w = 8, layer = "front") {
    this.world.anims.push({ kind: "weed", x, y, h, color, w, ph: this.rnd() * 10, layer });
  }
  kelp(x, y, h, color, w = 7, layer = "back") {
    this.world.anims.push({ kind: "kelp", x, y, h, color, w, ph: this.rnd() * 10, layer });
  }
  /** 빛나는 수정 · 빛버섯 (어두운 곳의 빛) */
  glow(kind, x, y, s = 1, color = kind === "crystal" ? "#5ff0ff" : "#7dff9a", r = kind === "crystal" ? 160 : 110) {
    const seed = ++this.n;
    const sp = sprite(`glow|${kind}|${this.world.stage.id}|${seed}`, 120 * s, 100 * s, 60 * s, 92 * s, (c) => (kind === "crystal" ? crystal(c, s, seeded(seed * 3), color) : shroom(c, s, seeded(seed * 3), color)));
    this.world.lamps.push({ kind, x, y, r, color, s: sp });
  }
  /** 종유석 (턱 아래 · 천장) */
  stalac(x, y, w, color = "#5a6278") {
    const seed = ++this.n;
    const sp = sprite(`stal|${this.world.stage.id}|${seed}`, w + 20, 100, w / 2 + 10, 6, (c) => stalactites(c, w, seeded(seed * 5), color));
    this.world.decor.push({ s: sp, x, y, z: y - 900 });
  }
  /** 앞을 가리는 큰 다시마 (괴물 · 지혁 앞에 그려진다) */
  kelpFront(x, y, h, color = "#5a8a30", w = 9) {
    this.world.occ.push({ kind: "kelp", x, y, h, color, w, ph: this.rnd() * 10 });
  }
  vent(x, y, h = 260, speed = 0.45) {
    this.world.vents.push({ x, y, h, speed });
  }
  school(x, y, n, color, size = 1) {
    this.world.schools.push(new School(x, y, n, color, this.rnd, size));
  }
  /** 앞쪽 다시마 덤불 (1.3 좌표: 화면 가장자리 아래에서 올라온다) */
  fgKelp(x, y, s = 1, color = "#0c3f4c", a = 0.88) {
    this.world.fg.push({ x, y, s, color, a, ph: this.rnd() * 10 });
  }

  /** 레이어 좌표 y 의 그림이 화면 가운데쯤 보일 때의 세계 깊이 */
  depthOf(y, p) {
    return (y - H * 0.5) / p + H * 0.5;
  }
  /** 먼 배경 (0.35 패럴랙스 좌표) */
  farRidge(x, y, w, h, dark = 0.18) {
    const wd = this.world;
    const seed = ++this.n;
    const col = wd.water(this.depthOf(y + h * 0.3, 0.35), dark);
    const hh = h + 260;
    const s = sprite(`far|${wd.stage.id}|${seed}`, w, hh, 0, 0, (c) => {
      A.farRidge(c, w, hh, col, seeded(seed * 3));
      fadeBottom(c, h / hh);
    });
    wd.far.push({ s, x, y, w, h: hh });
  }
  farArch(x, y, w, h, dark = 0.2) {
    const wd = this.world;
    const seed = ++this.n;
    const col = wd.water(this.depthOf(y + h * 0.5, 0.35), dark);
    const s = sprite(`arch|${wd.stage.id}|${seed}`, w, h, 0, 0, (c) => {
      A.farArch(c, w, h, col);
      fadeBottom(c, 0.55);
    });
    wd.far.push({ s, x, y, w, h });
  }
  shadow(kind, y, s, speed, p = 0.35, a = 0.55) {
    const wd = this.world;
    const span = (wd.w - W) * p + W;
    wd.shadows.push({ kind, x: speed > 0 ? -300 : span + 300, x0: -400, x1: span + 400, y, s, vx: speed, p, a, ph: this.rnd() * 10 });
  }
  /** 중간 레이어 능선 (0.65 좌표): 바위 언덕 + 산호 실루엣, 아래로 흐려짐 */
  midRidge(x, y, w, h, dark = 0.1, tint) {
    const wd = this.world;
    const seed = ++this.n;
    const wy = this.depthOf(y + h * 0.3, 0.65);
    const base = tint ? mix(wd.waterHex(wy, dark), tint, 0.18) : wd.waterHex(wy, dark);
    const s = sprite(`mrg|${wd.stage.id}|${seed}`, w, h, 0, 0, (c) => {
      A.midRidge(c, w, h, base, seeded(seed * 7));
      fadeBottom(c, 0.35);
    });
    wd.mid.push({ s, x, y, w, h, top: true });
  }
  /** 중간 레이어 (0.65 패럴랙스 좌표): 흐릿한 바위 · 산호 */
  midRock(x, y, s, color = "#5f7a96") {
    const seed = ++this.n;
    const sp = sprite(`mr|${this.world.stage.id}|${seed}`, 160 * s, 80 * s, 80 * s, 66 * s, (c) => A.rock(c, s, seeded(seed * 5), { color }));
    this.world.mid.push({ s: sp, x, y });
  }
  midCoral(kind, x, y, s, color) {
    const seed = ++this.n;
    const fn = { branch: A.branchCoral, brain: A.brainCoral, fan: A.fanCoral, table: A.tableCoral, tube: A.tubeSponge }[kind];
    const box = { branch: [150, 150], brain: [110, 60], fan: [130, 110], table: [140, 90], tube: [90, 90] }[kind];
    const sp = sprite(`mc|${kind}|${this.world.stage.id}|${seed}`, box[0] * s, box[1] * s + 12, (box[0] * s) / 2, box[1] * s + 4, (c) => fn(c, s, seeded(seed * 9), { color }));
    this.world.mid.push({ s: sp, x, y });
  }

  /**
   * 숨는 곳. kind: coral | rock | sand | hole | rockbed | kelp | chest ...
   * 가리개(cover)는 숨은 괴물 앞에 그려진다. hx,hy = 괴물이 숨는 자리.
   */
  spot(kind, x, y, o = {}) {
    const wd = this.world;
    const seed = ++this.n;
    const rnd = seeded(seed * 19);
    const sp = { id: `sp${wd.spots.length}`, kind, x, y, hx: x, hy: y - (o.lift || 0), r: o.r || 50, side: o.side || 0, monster: null, cover: null, back: null, used: 0 };
    const id = wd.stage.id;
    if (kind === "coral") {
      const cols = o.colors || ["#ff7aa2", "#ffb347", "#b066ff"];
      sp.cover = sprite(`spc|${id}|${seed}`, 200, 150, 100, 140, (c) => {
        c.save();
        c.translate(-46, 2);
        A.branchCoral(c, 0.85, rnd, { color: cols[0] });
        c.restore();
        c.save();
        c.translate(40, 4);
        A.fanCoral(c, 0.85, rnd, { color: cols[2] });
        c.restore();
        c.save();
        c.translate(-4, 8);
        A.brainCoral(c, 0.95, rnd, { color: cols[1] });
        c.restore();
      });
      sp.hy = y - 46;
      sp.r = 70;
    } else if (kind === "rock") {
      sp.cover = sprite(`spr|${id}|${seed}`, 200, 110, 100, 96, (c) => A.rock(c, 1.3, rnd, { color: o.color || "#7d8fa6" }));
      sp.hy = y - 40;
      sp.r = 70;
      wd.solids.push({ type: "ellipse", x, y: y - 26, rx: 72, ry: 34 });
    } else if (kind === "hole") {
      // 벽 구멍: 뒤판(어두운 안쪽) + 테(앞)
      const s = o.side || -1;
      sp.back = sprite(`sph|${id}|${seed}`, 120, 90, 60, 45, (c) => {
        const g = c.createRadialGradient(0, 0, 4, 0, 0, 46);
        g.addColorStop(0, "#02060f");
        g.addColorStop(0.7, "#0b1a33");
        g.addColorStop(1, "rgba(20,40,70,0)");
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, 44, 32, 0, 0, TAU);
        c.fill();
      });
      sp.cover = sprite(`sphc|${id}|${seed}`, 130, 100, 65, 50, (c) => {
        c.lineCap = "round";
        c.beginPath();
        c.ellipse(0, 0, 44, 32, 0, 0, TAU);
        c.lineWidth = 12;
        c.strokeStyle = darken(o.color || "#6f7f98", 0.15);
        c.stroke();
        c.lineWidth = 3;
        c.strokeStyle = darken(o.color || "#6f7f98", 0.6);
        c.stroke();
        c.beginPath();
        c.ellipse(0, 0, 50, 38, 0, Math.PI * 1.1, Math.PI * 1.75);
        c.lineWidth = 3;
        c.strokeStyle = alpha("#ffffff", 0.35);
        c.stroke();
        for (let i = 0; i < 6; i++) {
          const a = rnd() * TAU;
          c.beginPath();
          c.arc(Math.cos(a) * 48, Math.sin(a) * 36, 3 + rnd() * 4, 0, TAU);
          c.fillStyle = ["#ff8fb3", "#7fd18a", "#ffd166"][i % 3];
          c.fill();
        }
      });
      sp.hx = x;
      sp.hy = y;
      sp.r = 60;
    } else if (kind === "sand") {
      // 모래 둔덕 (조개가 반쯤 묻혀 있다) — 가리개 없음
      sp.back = sprite(`sps|${id}|${seed}`, 160, 40, 80, 30, (c) => {
        c.beginPath();
        c.ellipse(0, 4, 74, 22, 0, Math.PI, 0);
        c.closePath();
        c.fillStyle = mix(o.color || "#f3d9a4", "#ffffff", 0.12);
        c.fill();
        for (let i = 0; i < 5; i++) {
          c.save();
          c.translate(-60 + rnd() * 120, -2 - rnd() * 10);
          c.scale(0.6, 0.6);
          A.shell(c, 1, rnd);
          c.restore();
        }
      });
      sp.hy = y - 10;
      sp.r = 50;
    } else if (kind === "rockbed") {
      sp.hy = y - 22;
      sp.r = 50;
    } else if (kind === "nook") {
      // 벽 틈 (어두운 움푹한 곳)
      sp.back = sprite(`spn|${id}|${seed}`, 110, 80, 55, 40, (c) => {
        const g = c.createRadialGradient(0, 0, 4, 0, 0, 44);
        g.addColorStop(0, "#02040a");
        g.addColorStop(0.75, "#0b1424");
        g.addColorStop(1, "rgba(20,30,50,0)");
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, 48, 30, 0, 0, TAU);
        c.fill();
      });
      sp.hx = x;
      sp.hy = y;
      sp.r = 44;
    } else if (kind === "dark") {
      sp.hx = x;
      sp.hy = y;
      sp.r = 70;
    } else if (kind === "wallface") {
      sp.hx = x;
      sp.hy = y;
      sp.r = 60;
    } else if (kind === "porthole") {
      sp.hx = x;
      sp.hy = y;
      sp.r = 34;
    } else if (kind === "chest") {
      sp.hy = y - 14;
      sp.r = 44;
      sp.patrol = o.patrol || [x - 80, x + 80];
    } else if (kind === "anchor") {
      sp.hy = y - 16;
      sp.r = 44;
      sp.patrol = o.patrol || [x - 90, x + 90];
    } else if (kind === "kelp") {
      // 빽빽한 해초 덤불: 숨은 괴물 '앞'에 그려지는 움직이는 가리개
      const n = 11;
      sp.coverAnims = [];
      for (let i = 0; i < n; i++) {
        const ax = x - 78 + (i / (n - 1)) * 156 + (this.rnd() - 0.5) * 10;
        sp.coverAnims.push({ kind: "weed", x: ax, y: y + 6, h: 120 + this.rnd() * 90, color: ["#2fa86a", "#3fbf6a", "#27935c"][i % 3], w: 11, ph: this.rnd() * 10 });
      }
      sp.hy = y - 62;
      sp.r = 80;
    } else if (kind === "weed") {
      // 미역 밭: 진짜 미역 여러 포기 사이에 미역괴물이 섞여 있다
      for (let i = 0; i < 5; i++) {
        const ax = x - 90 + i * 45 + (this.rnd() - 0.5) * 10;
        if (Math.abs(ax - x) < 20) continue;
        this.weed(ax, y + 4, 110 + this.rnd() * 30, "#4fae5e", 15, "front");
      }
      sp.hy = y + 4;
      sp.r = 50;
    } else if (kind === "chimney") {
      // 열수 굴뚝: 꼭대기에서 기포가 나온다 (벌레가 나오면 멈춘다)
      const h = o.h || 150;
      sp.cover = sprite(`spch|${id}|${seed}`, 180, h + 30, 90, h + 10, (c) => chimney(c, h, rnd));
      sp.hx = x;
      sp.hy = y - h;
      sp.r = 50;
      const v = { x, y: y - h - 6, h: 260, speed: 0.55 };
      wd.vents.push(v);
      sp.vent = v;
      wd.solids.push({ type: "ellipse", x, y: y - h * 0.32, rx: 54, ry: h * 0.34 });
      wd.lamps.push({ x, y: y - h - 10, r: 90, kind: "hot", color: "#ff7a2a" });
    } else if (kind === "lantern") {
      // 깊은 어둠 속 떠 있는 빛 (심연등불)
      sp.hx = x;
      sp.hy = y;
      sp.r = 60;
    } else if (kind === "eddy") {
      sp.backAnim = { kind: "eddy", x, y, ph: this.rnd() * 10 };
      sp.hx = x;
      sp.hy = y;
      sp.r = 60;
    } else if (kind === "sandbed") {
      // 모래 둔덕 (폭풍가오리가 납작 숨는다)
      sp.back = sprite(`spsb|${id}|${seed}`, 260, 50, 130, 36, (c) => {
        c.beginPath();
        c.ellipse(0, 6, 120, 26, 0, Math.PI, 0);
        c.closePath();
        c.fillStyle = mix(o.color || "#c8b890", "#ffffff", 0.1);
        c.fill();
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.ellipse(-60 + i * 30, -4 - (i % 2) * 6, 22, 5, 0, Math.PI, 0);
          c.strokeStyle = alpha("#8a7a5a", 0.5);
          c.lineWidth = 2;
          c.stroke();
        }
      });
      sp.hy = y - 22;
      sp.r = 80;
    } else if (kind === "egg") {
      // 알 둥지 (진짜 알깍쟁이는 흔들흔들 · 금 사이로 눈)
      sp.back = sprite(`speg|${id}|${seed}`, 200, 90, 100, 70, (c) => eggNest(c, rnd, 4));
      sp.hy = y - 40;
      sp.r = 50;
    } else if (kind === "statue") {
      // 석상 받침 (빈 받침엔 가짜 석상 · 진짜 석상수호자는 눈이 빛난다)
      sp.back = sprite(`spst|${id}|${seed}`, 100, 40, 50, 30, (c) => plinth(c));
      sp.hy = y - 100;
      sp.r = 60;
      wd.solids.push({ type: "rect", x0: x - 40, y0: y - 26, x1: x + 40, y1: y });
    } else if (kind === "pillar") {
      // 기둥 (앵무조개가 뒤에 숨는다)
      const h = o.h || 260;
      sp.cover = sprite(`sppl|${id}|${seed}`, 110, h + 30, 55, h + 6, (c) => column(c, h, !!o.broken, rnd));
      sp.hy = y - h * 0.55;
      sp.r = 56;
      wd.solids.push({ type: "rect", x0: x - 30, y0: y - h + 10, x1: x + 30, y1: y });
    } else if (kind === "arch") {
      // 아치 창 (거울물고기가 안쪽에서 반짝)
      const w = o.w || 200;
      const h = o.h || 260;
      sp.back = sprite(`spar|${id}|${seed}`, w + 20, h + 30, w / 2 + 10, h + 10, (c) => {
        const g = c.createLinearGradient(0, -h, 0, 0);
        g.addColorStop(0, "rgba(10,40,60,0.75)");
        g.addColorStop(1, "rgba(10,40,60,0.35)");
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-w / 2 + 30, 0);
        c.lineTo(-w / 2 + 30, -h + w / 2);
        c.arc(0, -h + w / 2, w / 2 - 30, Math.PI, 0);
        c.lineTo(w / 2 - 30, 0);
        c.closePath();
        c.fill();
        archway(c, w, h, rnd);
      });
      sp.hy = y - h * 0.5;
      sp.r = 70;
    } else if (kind === "abyss") {
      // 어둠 속 빈 물 (아귀가 떠 있다)
      sp.hx = x;
      sp.hy = y;
      sp.r = 70;
    } else if (kind === "deepnook") {
      // 협곡 벽의 깊은 틈 (펠리컨장어)
      const sd = o.side || -1;
      sp.back = sprite(`spdn|${id}|${seed}`, 300, 180, 150, 90, (c) => {
        const g = c.createRadialGradient(-sd * 40, 0, 10, -sd * 40, 0, 140);
        g.addColorStop(0, "#01020a");
        g.addColorStop(0.6, "#060a1a");
        g.addColorStop(1, "rgba(10,16,34,0)");
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(-sd * 40, 0, 140, 80, 0, 0, TAU);
        c.fill();
      });
      sp.hx = x;
      sp.hy = y;
      sp.r = 70;
    } else if (kind === "bones") {
      // 고래 뼈 (대왕갯강구가 뼈 사이에 숨는다)
      const w = o.w || 300;
      sp.back = sprite(`spbn|${id}|${seed}`, w + 160, 150, w / 2 + 30, 120, (c) => whaleBones(c, w, rnd));
      sp.hy = y - 26;
      sp.r = 60;
    } else if (kind === "iceblock") {
      // 얼음 덩어리 (서리오징어가 뒤에 숨는다)
      const w = o.w || 170;
      const h = o.h || 120;
      sp.cover = sprite(`spib|${id}|${seed}`, w + 20, h + 20, w / 2 + 10, h + 10, (c) => iceBlock(c, w, h, rnd));
      sp.hy = y - h * 0.45;
      sp.r = 70;
      wd.solids.push({ type: "ellipse", x, y: y - h * 0.32, rx: w * 0.42, ry: h * 0.4 });
    } else if (kind === "iceslab") {
      // 벽에 박힌 투명 얼음 판 (유리게가 비쳐 보인다)
      sp.back = sprite(`spisb|${id}|${seed}`, 150, 120, 75, 60, (c) => {
        const g = c.createRadialGradient(0, 0, 6, 0, 0, 64);
        g.addColorStop(0, "#1a4a7a");
        g.addColorStop(1, "rgba(30,80,130,0)");
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, 64, 50, 0, 0, TAU);
        c.fill();
      });
      sp.cover = sprite(`spis|${id}|${seed}`, 150, 120, 75, 60, (c) => iceSlab(c, 130, 100, rnd));
      sp.hx = x;
      sp.hy = y;
      sp.r = 54;
    } else if (kind === "icehole") {
      sp.back = sprite(`spih|${id}|${seed}`, 120, 90, 60, 45, (c) => {
        const g = c.createRadialGradient(0, 0, 4, 0, 0, 46);
        g.addColorStop(0, "#04122a");
        g.addColorStop(0.7, "#0e2a4e");
        g.addColorStop(1, "rgba(30,70,120,0)");
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(0, 0, 44, 34, 0, 0, TAU);
        c.fill();
      });
      sp.cover = sprite(`spihc|${id}|${seed}`, 130, 110, 65, 55, (c) => iceHoleRim(c, rnd));
      sp.hx = x;
      sp.hy = y;
      sp.r = 56;
    } else if (kind === "lavarock") {
      sp.back = sprite(`splr|${id}|${seed}`, 160, 70, 80, 60, (c) => lavaRocks(c, 1, rnd));
      sp.hy = y - 22;
      sp.r = 52;
    } else if (kind === "boulder") {
      sp.hy = y - 30;
      sp.r = 66;
    } else if (kind === "jellies") {
      // 해파리 무리: 진짜 해파리 넷 사이에 해파리괴물 · 쌍둥이가 섞여 있다
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + this.rnd() * 0.8;
        this.jelly(x + Math.cos(a) * (60 + this.rnd() * 30), y + Math.sin(a) * (44 + this.rnd() * 20), 0.95 + this.rnd() * 0.35);
      }
      sp.hx = x;
      sp.hy = y;
      sp.r = 80;
    } else if (kind === "crevice") {
      // 바위 틈 (전기뱀장어): 벽에 가로로 길게 갈라진 틈
      const sd = o.side || -1;
      const col = o.color || "#5a5a7a";
      sp.back = sprite(`spcv|${id}|${seed}`, 160, 80, 80, 40, (c) => {
        const g = c.createRadialGradient(0, 0, 4, 0, 0, 70);
        g.addColorStop(0, "#03030c");
        g.addColorStop(0.7, "#0d0c22");
        g.addColorStop(1, "rgba(20,20,40,0)");
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(-66, 0);
        c.quadraticCurveTo(-30, -26, 10, -20);
        c.quadraticCurveTo(50, -16, 66, 0);
        c.quadraticCurveTo(40, 22, 0, 18);
        c.quadraticCurveTo(-40, 20, -66, 0);
        c.fill();
      });
      sp.cover = sprite(`spcvc|${id}|${seed}`, 180, 100, 90, 50, (c) => {
        c.lineJoin = "round";
        const lip = (dy, flip) => {
          c.beginPath();
          c.moveTo(-74, 0);
          c.quadraticCurveTo(-30, dy * 30, 10, dy * 24);
          c.quadraticCurveTo(50, dy * 20, 74, 0);
          c.quadraticCurveTo(50, dy * 34, 10, dy * 36);
          c.quadraticCurveTo(-30, dy * 40, -74, 0);
          c.closePath();
          c.fillStyle = flip ? darken(col, 0.25) : col;
          c.fill();
          c.lineWidth = 3;
          c.strokeStyle = darken(col, 0.6);
          c.stroke();
        };
        lip(-1, false);
        lip(1, true);
        // 반짝이는 광물 점
        for (let i = 0; i < 5; i++) {
          c.beginPath();
          c.arc(-50 + rnd() * 100, (rnd() < 0.5 ? -1 : 1) * (26 + rnd() * 6), 2 + rnd() * 2, 0, TAU);
          c.fillStyle = ["#fff36a", "#c58bff", "#7ff0ff"][i % 3];
          c.fill();
        }
      });
      sp.hx = x;
      sp.hy = y;
      sp.r = 56;
    } else if (kind === "kelpTall") {
      // 다시마 줄기 한 포기 (해마가 꼬리를 감는다)
      sp.backAnim = { kind: "kelp", x, y: y + 6, h: o.h || 260, color: "#6f9a3a", w: 7, ph: this.rnd() * 10 };
      sp.hx = x + 4;
      sp.hy = y - (o.h || 260) * 0.45;
      sp.r = 50;
    }
    wd.spots.push(sp);
    return sp;
  }

  /**
   * 침몰한 보물선 (옆 단면). (x, y) = 용골 가운데 바닥.
   * 바깥 벽 · 갑판은 부딪히고, 안쪽은 어둡다. 둥근 창 · 상자 · 닻 자리를 돌려준다.
   */
  ship(x, y) {
    const wd = this.world;
    const s = sprite(`ship|${wd.stage.id}`, 1120, 900, 560, 860, (c) => drawShip(c, seeded(91)));
    wd.decor.push({ s, x, y, z: y - 2000 });
    const S = SHIP;
    const R = (x0, y0, x1, y1) => wd.solids.push({ type: "rect", x0: x + x0, y0: y + y0, x1: x + x1, y1: y + y1 });
    // 선미루 · 선수루 (단단한 덩어리)
    R(S.stern.x0, S.stern.top, S.stern.x1, 0);
    R(S.bow.x0 + 30, S.bow.top, S.bow.x1, 0);
    R(S.bow.x0, S.bow.top, S.bow.x0 + 30, S.bowBreach.y0);
    R(S.bow.x0, S.bowBreach.y1, S.bow.x0 + 30, 0);
    // 짐칸 바닥 · 가운데 갑판(구멍) · 위 갑판(틈)
    R(S.stern.x1, S.hold.floor, S.bow.x0, 0);
    R(S.stern.x1, S.hold.mid - 7, S.midGap.x0, S.hold.mid + 7);
    R(S.midGap.x1, S.hold.mid - 7, S.bow.x0, S.hold.mid + 7);
    R(S.stern.x1, S.hold.deck - 7, S.deckGap.x0, S.hold.deck + 7);
    R(S.deckGap.x1, S.hold.deck - 7, S.bow.x0, S.hold.deck + 7);
    // 배 안은 어둡다 (헤드램프 · 등불이 비춘다)
    wd.darkZones.push({ x0: x + S.stern.x1, y0: y + S.hold.deck, x1: x + S.bow.x0, y1: y, a: 0.55 });
    for (const [lx, ly] of S.lanterns) wd.lamps.push({ x: x + lx, y: y + ly, r: 150 });
    // 둥근 창 (창문눈알이 옮겨 다니는 곳)
    for (const [px, py] of S.portholes) this.spot("porthole", x + px, y + py);
    return {
      floor: y + S.hold.floor,
      mid: y + S.hold.mid,
      deck: y + S.hold.deck,
      left: x + S.stern.x1,
      right: x + S.bow.x0,
      gapMid: [x + S.midGap.x0, x + S.midGap.x1],
      gapDeck: [x + S.deckGap.x0, x + S.deckGap.x1],
      sternTop: y + S.stern.top,
      bowTop: y + S.bow.top,
      x,
      y,
    };
  }

  /** 떠다니는 해파리 하나 (장식 · 빛) */
  jelly(x, y, size = 1, color = AMB) {
    this.world.jellies.push({ x, y, size, color, ph: this.rnd() * 10, sp: 0.7 + this.rnd() * 0.6 });
  }

  /** 유적: 기둥 (부딪힘) */
  column(x, y, h = 240, broken = false) {
    const seed = ++this.n;
    const s = sprite(`col|${this.world.stage.id}|${seed}`, 110, h + 30, 55, h + 6, (c) => column(c, h, broken, seeded(seed * 7)));
    this.world.decor.push({ s, x, y, z: y - 500 });
    this.world.solids.push({ type: "rect", x0: x - 30, y0: y - h + 10, x1: x + 30, y1: y });
    return { x, y, top: y - h };
  }
  /** 유적: 아치 (뒤 장식 · 부딪히지 않음) */
  arch(x, y, w = 200, h = 260) {
    const seed = ++this.n;
    const s = sprite(`arch|${this.world.stage.id}|${seed}`, w + 20, h + 30, w / 2 + 10, h + 10, (c) => archway(c, w, h, seeded(seed * 3)));
    this.world.decor.push({ s, x, y, z: y - 3000 });
  }
  rubble(x, y, s = 1) {
    const seed = ++this.n;
    const sp = sprite(`rub|${this.world.stage.id}|${seed}`, 160 * s, 70 * s, 80 * s, 60 * s, (c) => rubble(c, s, seeded(seed * 5)));
    this.world.decor.push({ s: sp, x, y, z: y });
  }

  /** 지역 기믹 (hazard.js) */
  hazard(kind, x, y, o = {}) {
    const h = new Hazard(kind, x, y, o);
    this.world.hazards.push(h);
    return h;
  }

  /** 정리: 장식을 높이 순서로 */
  done() {
    this.world.decor.sort((a, b) => a.z - b.z);
  }
}
