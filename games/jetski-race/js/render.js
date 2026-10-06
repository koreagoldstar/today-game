/*
 * 제트스키 썬더 레이스 · 렌더러 (의사 3D 바다 레이싱)
 *
 *  - 카메라는 내 제트스키 뒤 위에 있다. 속도가 빨라질수록 시야(F)가 넓어지고 카메라가 다가와
 *    내 제트스키 크기는 그대로인 채 바다가 더 빠르게 다가온다 (돌리 줌 속도감).
 *  - 물은 5m 구간 띠를 가까운 것부터 그리며 앞 파도에 가려진 부분을 잘라낸다 (너울 · 큰 파도).
 *  - 물 위 무늬(차선 · 부스터 판 · 섬 바닥 · 물결 · 반짝임) → 스프라이트 · 레이서 · 물보라를 먼 것부터.
 */
import { W, H, HZ, PY, clamp, lerp, hash2 } from "./view.js?v=1";
import { SEG } from "./track.js?v=1";
import { buildSky, buildFar, gull } from "../art/sky.js?v=1";
import { getSprite, drawSprite, setSpriteBoost, setSpriteTint } from "../art/sprites.js?v=1";
import { drawRacer, drawHullFoam, hullInfo } from "../art/jetski.js?v=1";
import { dolphin } from "../art/scenery.js?v=1";
import { blimp } from "../art/scenery4.js?v=1";

export const PSCALE = 112; // 내 제트스키가 그려지는 크기 (px/m) — 시야가 바뀌어도 그대로
const DRAW = 130; // 앞으로 그리는 구간 수 (650m)
const NEAR = 0.6;

const rgbOf = (hex) => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export class Renderer {
  constructor(view) {
    this.view = view;
    this.theme = null;
    this.themeId = "";
    this.sky = null;
    this.far = null;
    this.skyShift = 0;
    this.camX = 0;
    this.camY = 0;
    this.camZ = 0;
    this.F = 680;
    this.P = new Array(DRAW + 2).fill(null).map(() => ({}));
    this.items = [];
    this.nItems = 0;
    this.dip = 0; // 착지 반동
    this.dipV = 0;
    this.shake = 0;
  }

  setTheme(theme, id) {
    if (this.themeId === id && this.sky) return;
    this.theme = theme;
    this.themeId = id;
    this.col = {
      far: rgbOf(theme.water.far),
      mid: rgbOf(theme.water.mid),
      near: rgbOf(theme.water.near),
      deep: rgbOf(theme.water.deep),
      fog: theme.fog,
    };
    this.rebuild();
  }

  /** 화면 크기가 바뀌면 하늘 캐시를 다시 */
  rebuild() {
    if (!this.theme) return;
    setSpriteTint(this.theme.tint || null);
    const px = Math.min(2, this.view.pixel || 1);
    setSpriteBoost(px);
    this.sky = buildSky(this.theme, W * 2, HZ, px);
    this.far = buildFar(this.theme, W * 2, 60, px);
    this.skyPx = px;
  }

  /* ---------------- 카메라 ---------------- */
  /** 레이스 상태에서 카메라를 정한다 (dt 로 부드럽게) */
  updateCamera(track, p, dt, speed01, boost01) {
    // 속도가 빠를수록 시야를 넓힌다
    const wantF = 690 - 90 * speed01 - 50 * boost01;
    this.F = lerp(this.F, wantF, Math.min(1, dt * 3));
    const back = this.F / PSCALE;
    this.camZ = p.z - back;
    const camH = (PY - HZ) / PSCALE;
    const water = track.heightAt(p.z);
    // 점프하면 카메라도 따라 오른다 (조금 덜)
    const lift = Math.max(0, p.Y - water) * 0.62;
    // 착지 반동 (스프링)
    this.dipV += (-this.dip * 60 - this.dipV * 11) * dt;
    this.dip += this.dipV * dt;
    this.camY = water + camH + lift + this.dip;
    this.track = track;
    this.computeOffsets(track);
    const target = p.x + this.offAt(p.z) + (p.vx || 0) * 0.06;
    this.camX = lerp(this.camX, target, Math.min(1, dt * 7));
    if (Math.abs(this.camX - target) > 6) this.camX = target;
    // 코너를 돌면 하늘이 옆으로 흐른다
    this.skyShift += track.curveAt(p.z) * p.v * dt * 260;
  }

  landBump(power) {
    this.dipV -= power;
  }

  /** 구간마다 휘어진 정도를 누적 (카메라 바로 앞은 곧게) */
  computeOffsets(track) {
    const segs = track.segs;
    const b = Math.max(0, Math.floor(this.camZ / SEG));
    const frac = this.camZ / SEG - b;
    this.base = b;
    const c0 = segs[b] ? segs[b].curve : 0;
    let slope = -c0 * frac * SEG;
    let off = 0.5 * c0 * (frac * SEG) * (frac * SEG);
    const O = this.offs || (this.offs = new Float64Array(DRAW + 4));
    const S = this.slopes || (this.slopes = new Float64Array(DRAW + 4));
    for (let k = 0; k < DRAW + 3; k++) {
      const s = segs[b + k];
      const c = s ? s.curve : 0;
      O[k] = off;
      S[k] = slope;
      off += slope * SEG + 0.5 * c * SEG * SEG;
      slope += c * SEG;
    }
  }

  /** z 지점의 휨 오프셋 (m) */
  offAt(z) {
    const rel = z / SEG - this.base;
    let k = Math.floor(rel);
    if (k < 0) {
      // 카메라 뒤 (물보라 등): 첫 구간 기울기로 연장
      const dz = (rel - 0) * SEG;
      return this.offs[0] + this.slopes[0] * dz;
    }
    if (k > DRAW + 2) k = DRAW + 2;
    const dz = (rel - k) * SEG;
    const s = this.track.segs[this.base + k];
    const c = s ? s.curve : 0;
    return this.offs[k] + this.slopes[k] * dz + 0.5 * c * dz * dz;
  }

  /** 월드 → 화면. 뒤에 있으면 null */
  proj(x, y, z, out) {
    const dz = z - this.camZ;
    if (dz < NEAR) return null;
    const s = this.F / dz;
    out.sx = W / 2 + (x + this.offAt(z) - this.camX) * s;
    out.sy = HZ + (this.camY - y) * s;
    out.s = s;
    out.dz = dz;
    return out;
  }

  /* ---------------- 그리기 ---------------- */
  render(ctx, race, time) {
    const track = race.track;
    const T = this.theme;
    this._player = race.player;
    // 1) 하늘
    this.drawSky(ctx, time);
    // 2) 물 띠 (가까운 것부터, 가려진 부분은 건너뜀)
    this.drawWater(ctx, track, time);
    // 3) 물 위 무늬 (먼 것부터)
    this.drawDecals(ctx, track, race, time);
    // 밤바다: 내 제트스키 헤드라이트가 앞 물을 비춘다
    if (T.night) this.drawHeadlight(ctx, race.player, time);
    // 4) 물 자국 (항적)
    for (const r of race.racers) this.drawWake(ctx, r, time);
    // 5) 스프라이트 · 레이서 · 물보라 — 깊이 순서
    this.drawWorld(ctx, track, race, time);
  }

  drawSky(ctx, time) {
    const T = this.theme;
    if (!this.sky) return;
    const sw = W * 2;
    let o = (W / 2 + this.skyShift * 0.35) % sw;
    if (o < 0) o += sw;
    ctx.drawImage(this.sky, 0, 0, this.sky.width, this.sky.height, -o, 0, sw, HZ + 4);
    if (o > sw - W) ctx.drawImage(this.sky, 0, 0, this.sky.width, this.sky.height, -o + sw, 0, sw, HZ + 4);
    this.sunX = (W * 2 * (0.25 + 0.5 * (T.sun ? T.sun.x : 0.7)) - o + sw) % sw;
    // GP 비행선
    if (T.blimp) blimp(ctx, ((time * 9 - this.skyShift * 0.3) % (W + 200)) - 100, HZ * 0.34 + Math.sin(time * 0.5) * 4, 0.9);
    // 하늘 번개 (폭풍 테마)
    if (this.skyBolt && this.skyBolt.t > 0) {
      const b = this.skyBolt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.t * 5);
      ctx.lineCap = "round";
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? "rgba(170,200,255,0.5)" : "rgba(255,255,255,0.95)";
        ctx.lineWidth = pass === 0 ? 9 : 2.5;
        ctx.beginPath();
        let x = b.x;
        ctx.moveTo(x, 0);
        for (let i = 1; i <= 7; i++) {
          x += (hash2(b.seed, i) - 0.5) * 50;
          ctx.lineTo(x, (HZ - 10) * (i / 7));
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // 갈매기
    if (!T.noGulls) {
      for (let i = 0; i < 4; i++) {
        const gx = ((time * (14 + i * 3) + i * 170 - this.skyShift * 0.5) % (W + 120)) - 60;
        const gy = HZ * (0.3 + 0.12 * i) + Math.sin(time * 0.8 + i) * 6;
        gull(ctx, gx, gy, 0.8 + (i % 2) * 0.3, time * 9 + i * 2);
      }
    }
    // 수평선 너머 섬 띠
    const fw = W * 2;
    let fo = (W / 2 + this.skyShift * 0.62) % fw;
    if (fo < 0) fo += fw;
    const fh = 60;
    ctx.drawImage(this.far, 0, 0, this.far.width, this.far.height, -fo, HZ - fh + 1, fw, fh);
    if (fo > fw - W) ctx.drawImage(this.far, 0, 0, this.far.width, this.far.height, -fo + fw, HZ - fh + 1, fw, fh);
  }

  drawWater(ctx, track, time) {
    const segs = track.segs;
    const C = this.col;
    const T = this.theme;
    const fogK = T.fogK || 0.0024;
    // 맨 먼 곳 (그릴 거리 밖): 안개 색
    ctx.fillStyle = `rgb(${C.fog[0]},${C.fog[1]},${C.fog[2]})`;
    ctx.fillRect(0, HZ, W, H - HZ);
    let maxy = H + 2;
    const b = this.base;
    const P = this.P;
    let nVis = 0;
    for (let k = 0; k < DRAW; k++) {
      const s = segs[b + k];
      const n = segs[b + k + 1];
      const pk = P[k];
      pk.vis = false;
      if (!s || !n) {
        pk.ok = false;
        continue;
      }
      pk.ok = true;
      const z1 = s.z;
      const z2 = s.z + SEG;
      const dz1 = Math.max(NEAR, z1 - this.camZ);
      const dz2 = Math.max(NEAR + 0.01, z2 - this.camZ);
      const s1 = this.F / dz1;
      const s2 = this.F / dz2;
      const o1 = z1 - this.camZ < NEAR ? this.offAt(this.camZ + NEAR) : this.offs[k];
      const o2 = this.offs[k + 1];
      pk.s1 = s1;
      pk.s2 = s2;
      const wy1 = track.waves.length ? track.heightAt(z1) : s.y;
      const wy2 = track.waves.length ? track.heightAt(z2) : n.y;
      pk.wy1 = wy1;
      pk.wy2 = wy2;
      pk.y1 = HZ + (this.camY - wy1) * s1;
      pk.y2 = HZ + (this.camY - wy2) * s2;
      pk.x1 = W / 2 + (o1 - this.camX) * s1;
      pk.x2 = W / 2 + (o2 - this.camX) * s2;
      pk.w1 = s.hw * s1;
      pk.w2 = n.hw * s2;
      pk.clip = maxy;
      pk.seg = s;
      pk.z1 = z1;
      if (pk.y2 >= maxy) continue; // 앞 파도에 가림
      pk.vis = true;
      nVis++;
      const top = pk.y2;
      const bot = Math.min(pk.y1, maxy);
      // 색: 가까울수록 진하고 깊은 파랑 → 멀수록 밝은 청록 → 안개
      const d = z1 - this.camZ;
      const fog = 1 - Math.exp(-Math.max(0, d) * fogK);
      const nm = clamp(d / 140, 0, 1);
      let r = lerp(C.near[0], C.mid[0], nm);
      let g = lerp(C.near[1], C.mid[1], nm);
      let bl = lerp(C.near[2], C.mid[2], nm);
      const fm = clamp((d - 80) / 380, 0, 1);
      r = lerp(r, C.far[0], fm);
      g = lerp(g, C.far[1], fm);
      bl = lerp(bl, C.far[2], fm);
      // 너울 무늬 (시간에 따라 흐른다) — 가까운 물결일수록 또렷
      const sw = Math.sin(z1 * 0.21 + time * 1.7) * 0.5 + Math.sin(z1 * 0.083 - time * 0.9) * 0.5;
      const lift = sw * 10 * (1 - fog);
      // 물 높이가 높은 곳(파도 마루)은 밝게
      // 파도 면: 카메라 쪽을 보는 오르막 면은 밝게, 마루는 더 밝게, 골은 어둡게
      const crest = clamp((pk.wy2 - pk.wy1) * 9 + pk.wy1 * 4.5, -22, 40);
      r = lerp(r + lift + crest, C.fog[0], fog);
      g = lerp(g + lift + crest, C.fog[1], fog);
      bl = lerp(bl + lift * 0.6 + crest * 0.5, C.fog[2], fog);
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
      ctx.fillRect(0, top - 0.5, W, bot - top + 1);
      pk.fog = fog;
      maxy = top;
    }
    this.nVis = nVis;
    // 해 아래 반짝이는 물빛 길
    const T2 = this.theme;
    if (T2.glitter && this.sunX > -100 && this.sunX < W + 100) {
      ctx.save();
      ctx.globalAlpha = 0.5 * T2.glitter;
      const g = ctx.createRadialGradient(this.sunX, HZ + 6, 4, this.sunX, HZ + 40, 170);
      g.addColorStop(0, "rgba(255,250,225,0.9)");
      g.addColorStop(0.4, "rgba(255,250,225,0.25)");
      g.addColorStop(1, "rgba(255,250,225,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(this.sunX, HZ + 40, 120, 60, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 물 위 무늬: 코스 차선 · 섬 바닥 · 부스터 판 · 물살 화살표 · 물결 · 로프 부표 · 반짝임 */
  drawDecals(ctx, track, race, time) {
    const P = this.P;
    const T = this.theme;
    const lane = T.lane;
    const segs = track.segs;
    const b = this.base;
    // 코스 차선 (조금 밝은 물)
    ctx.fillStyle = `rgba(${lane[0]},${lane[1]},${lane[2]},${lane[3]})`;
    ctx.beginPath();
    for (let k = DRAW - 1; k >= 0; k--) {
      const p = P[k];
      if (!p.vis) continue;
      const bot = Math.min(p.y1, p.clip);
      const t = bot === p.y1 ? 1 : (p.y2 - bot) / (p.y2 - p.y1 || 1);
      const xb = lerp(p.x2, p.x1, t);
      const wb = lerp(p.w2, p.w1, t);
      ctx.moveTo(p.x2 - p.w2, p.y2);
      ctx.lineTo(p.x2 + p.w2, p.y2);
      ctx.lineTo(xb + wb, bot);
      ctx.lineTo(xb - wb, bot);
      ctx.closePath();
    }
    ctx.fill();
    // 물속 산호초 · 물고기 떼 (맑은 바다 테마)
    if (T.reef) this.drawReef(ctx, track, time);
    // 심해: 물속에서 반짝이는 생물 빛 + 지나가는 거대 고래 그림자
    if (T.deepGlow) this.drawDeep(ctx, track, time);
    // 미끄러운 얼음물: 코스 위 반짝이는 얼음 막
    if (track.slips.length) this.drawSlips(ctx, track, time);
    // 갈림길 가운데 섬 바닥 (모래 + 얕은 물 테두리)
    for (let k = DRAW - 1; k >= 0; k--) {
      const p = P[k];
      if (!p.vis || !p.seg.split) continue;
      const z1 = p.z1;
      const d1 = track.dividerAt(z1);
      const d2 = track.dividerAt(z1 + SEG);
      if (!d1 && !d2) continue;
      const w1 = d1 ? d1.w : 0;
      const w2 = d2 ? d2.w : 0;
      const cx = (d1 || d2).cx;
      const bot = Math.min(p.y1, p.clip);
      // 얕은 물
      ctx.fillStyle = "rgba(120,240,230,0.55)";
      quad(ctx, p.x2 + (cx - w2 - 2.2) * p.s2, p.x2 + (cx + w2 + 2.2) * p.s2, p.y2, p.x1 + (cx - w1 - 2.2) * p.s1, p.x1 + (cx + w1 + 2.2) * p.s1, bot);
      ctx.fillStyle = T.shore || "#f4dc9b";
      quad(ctx, p.x2 + (cx - w2) * p.s2, p.x2 + (cx + w2) * p.s2, p.y2, p.x1 + (cx - w1) * p.s1, p.x1 + (cx + w1) * p.s1, bot);
      // 젖은 모래 · 하얀 파도 테두리
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1, 0.18 * p.s2);
      ctx.beginPath();
      ctx.moveTo(p.x2 + (cx - w2) * p.s2, p.y2);
      ctx.lineTo(p.x1 + (cx - w1) * p.s1, bot);
      ctx.moveTo(p.x2 + (cx + w2) * p.s2, p.y2);
      ctx.lineTo(p.x1 + (cx + w1) * p.s1, bot);
      ctx.stroke();
    }
    // 물살 화살표 (지름길 · 해류)
    for (const c of track.currents) {
      for (let z = Math.max(c.z0, this.camZ + 2); z < Math.min(c.z1, this.camZ + 260); z += 10) {
        const zz = z - ((time * 18) % 10);
        if (zz < c.z0 || zz < this.camZ + 2) continue;
        const cx = (Math.max(c.x0, -40) + Math.min(c.x1, 40)) / 2;
        const xx = c.x0 < -50 ? Math.min(c.x1, 40) - 6 : c.x1 > 50 ? Math.max(c.x0, -40) + 7 : cx;
        this.chevron(ctx, xx, zz, 2.2, c.mul > 1 ? "rgba(190,255,250,0.55)" : "rgba(255,190,170,0.5)", c.mul < 1);
      }
    }
    // 부스터 판
    for (let k = DRAW - 1; k >= 0; k--) {
      const p = P[k];
      if (!p.vis) continue;
      for (const o of p.seg.objs) if (o.pad && !o.gone) this.drawPad(ctx, o, time);
    }
    // 물결 무늬 (흰 물마루 조각) + 로프 부표
    const rope = T.rope;
    for (let k = DRAW - 1; k >= 1; k--) {
      const p = P[k];
      if (!p.vis) continue;
      const s = p.seg;
      const fogA = 1 - p.fog;
      const yb = Math.min(p.y1, p.clip);
      // 큰 파도 마루: 화면을 가로지르는 하얀 거품 줄 (빅 웨이브 · 폭풍)
    if (track.waves.length) {
      for (let k = DRAW - 2; k >= 1; k--) {
        const p = P[k];
        if (!p.vis) continue;
        const a = P[k - 1];
        const c = P[k + 1];
        if (!a.ok || !c.ok) continue;
        if (!(p.wy1 > 0.55 && p.wy1 >= a.wy1 && p.wy1 > c.wy1)) continue;
        if (p.s1 > 120) continue;
        const fogA = 1 - p.fog;
        const y = Math.min(p.y1, p.clip);
        const th = clamp(0.3 * p.s1, 1.5, 10);
        ctx.fillStyle = `rgba(255,255,255,${0.75 * fogA})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= W; x += 18) ctx.lineTo(x, y - th * (0.6 + 0.4 * Math.sin(x * 0.05 + time * 3 + k)));
        for (let x = W; x >= 0; x -= 18) ctx.lineTo(x, y + th * 0.5 * (0.5 + 0.5 * Math.cos(x * 0.07 + time * 2 + k)));
        ctx.closePath();
        ctx.fill();
        // 마루 뒤로 날리는 물보라
        ctx.fillStyle = `rgba(255,255,255,${0.35 * fogA})`;
        for (let x = (k * 37) % 50; x < W; x += 50) {
          ctx.beginPath();
          ctx.arc(x + Math.sin(time * 4 + x) * 6, y - th * 2.2, th * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // 물마루 (멀리 넓게 4개 + 가까울 때만 코스 근처에 6개 더) + 그 아래 물골 그늘
      ctx.lineCap = "round";
      const nj = p.s2 > 22 ? 10 : 4;
      for (let j = 0; j < nj; j++) {
        const h1 = hash2(s.i, j);
        const h2 = hash2(s.i, j + 19);
        const range = j < 4 ? 150 : 34;
        const wx = (h1 - 0.5) * range + Math.sin(time * 0.6 + j + s.i) * 0.6;
        const f = h2;
        const y = lerp(p.y1, p.y2, f);
        if (y > yb || y < p.y2) continue;
        const sc = lerp(p.s1, p.s2, f);
        const x = lerp(p.x1, p.x2, f) + wx * sc;
        const L = (0.6 + hash2(s.i, j + 3) * (j < 4 ? 2.6 : 1.4)) * sc;
        if (x + L < 0 || x - L > W) continue;
        if (sc > 18) {
          ctx.strokeStyle = `rgba(4,60,110,${0.16 * fogA})`;
          ctx.lineWidth = Math.max(0.8, 0.14 * sc);
          ctx.beginPath();
          ctx.moveTo(x - L * 0.9, y + 0.1 * sc);
          ctx.quadraticCurveTo(x, y + 0.24 * sc, x + L * 0.9, y + 0.1 * sc);
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(${T.foam},${0.5 * fogA})`;
        ctx.lineWidth = Math.max(0.7, 0.07 * sc);
        ctx.beginPath();
        ctx.moveTo(x - L, y);
        ctx.quadraticCurveTo(x, y - 0.2 * sc, x + L, y);
        ctx.stroke();
      }
      // 반짝이는 햇빛 조각 (가까운 물)
      if (p.s2 > 10 && T.glitter) {
        for (let j = 0; j < 3; j++) {
          const tw = hash2(s.i * 3 + j, Math.floor(time * 5 + j * 0.3 + s.i * 0.17));
          if (tw < 0.7) continue;
          const f = hash2(s.i, j + 40);
          const y = lerp(p.y1, p.y2, f);
          if (y > yb) continue;
          const sc = lerp(p.s1, p.s2, f);
          const x = lerp(p.x1, p.x2, f) + (hash2(s.i, j + 50) - 0.5) * 60 * sc;
          if (x < 0 || x > W) continue;
          sparkle(ctx, x, y, Math.min(9, 0.12 * sc + 1.5), (tw - 0.7) * 3 * fogA);
        }
      }
      // 레인 로프 부표 (양쪽 가장자리)
      if (p.s2 > 3) {
        const r = Math.max(1, 0.2 * p.s2);
        for (const sd of [-1, 1]) {
          const x = p.x2 + sd * p.w2;
          if (x < -10 || x > W + 10) continue;
          if (T.glowRope) {
            ctx.fillStyle = T.glowRope[(s.i + (sd > 0 ? 1 : 0)) % 2];
            ctx.globalAlpha = 0.35 * fogA;
            ctx.beginPath();
            ctx.ellipse(x, p.y2 - r * 0.4, r * 3.2, r * 2.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.fillStyle = rope[(s.i + (sd > 0 ? 1 : 0)) % 2];
          ctx.beginPath();
          ctx.ellipse(x, p.y2 - r * 0.4, r * 1.25, r, 0, 0, Math.PI * 2);
          ctx.fill();
          if (r > 2.5) {
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.beginPath();
            ctx.ellipse(x - r * 0.35, p.y2 - r * 0.75, r * 0.45, r * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // 로프 줄
        if (p.s2 > 8) {
          ctx.strokeStyle = `rgba(255,255,255,${0.35 * fogA})`;
          ctx.lineWidth = Math.max(0.6, 0.03 * p.s2);
          for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(p.x2 + sd * p.w2, p.y2 - 0.08 * p.s2);
            ctx.lineTo(p.x1 + sd * p.w1, Math.min(p.y1, p.clip) - 0.08 * p.s1);
            ctx.stroke();
          }
        }
      }
    }
    // 해 아래 반짝임
    if (T.glitter) {
      for (let i = 0; i < 26; i++) {
        const h = hash2(i, Math.floor(time * 6 + i * 0.37));
        const depth = hash2(i + 40, 3);
        const y = HZ + 3 + depth * depth * 120;
        const x = this.sunX + (hash2(i, 77) - 0.5) * (30 + depth * 260);
        const a = h > 0.55 ? (h - 0.55) * 2 : 0;
        if (a <= 0 || x < 0 || x > W) continue;
        sparkle(ctx, x, y, 2 + depth * 5, a * T.glitter);
      }
    }
  }

  drawDeep(ctx, track, time) {
    const P = this.P;
    for (let k = DRAW - 1; k >= 1; k--) {
      const p = P[k];
      if (!p.vis || p.s2 < 1.5) continue;
      const s = p.seg;
      const fogA = 1 - p.fog;
      for (let j = 0; j < 3; j++) {
        const tw = 0.5 + 0.5 * Math.sin(time * (1.5 + j) + s.i * 1.7 + j * 2);
        const f = hash2(s.i, j + 120);
        const y = lerp(p.y1, p.y2, f);
        if (y > Math.min(p.y1, p.clip)) continue;
        const sc = lerp(p.s1, p.s2, f);
        const x = lerp(p.x1, p.x2, f) + (hash2(s.i, j + 130) - 0.5) * 80 * sc;
        if (x < -20 || x > W + 20) continue;
        const r = Math.max(1, (0.25 + hash2(s.i, j + 140) * 0.35) * sc);
        const col = j % 3 === 0 ? "120,255,230" : j % 3 === 1 ? "190,140,255" : "120,200,255";
        ctx.fillStyle = `rgba(${col},${0.12 * tw * fogA})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${col},${0.7 * tw * fogA})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 고래 그림자: 몇십 초마다 코스 아래를 천천히 가로지른다
    const cyc = (time % 26) / 26;
    if (cyc < 0.6) {
      const zz = this.camZ + 70;
      const xx = -60 + cyc / 0.6 * 120;
      const p = this.proj(xx, track.heightAt(zz) - 1, zz, _e);
      if (p) {
        const camH = (PY - HZ) / PSCALE;
        const flat = Math.min(0.6, camH / p.dz);
        ctx.fillStyle = "rgba(4,14,34,0.32)";
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, 14 * p.s, 14 * p.s * flat * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.sx - 13 * p.s, p.sy);
        ctx.lineTo(p.sx - 19 * p.s, p.sy - 3 * p.s * flat);
        ctx.lineTo(p.sx - 19 * p.s, p.sy + 3 * p.s * flat);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawSlips(ctx, track, time) {
    const P = this.P;
    ctx.save();
    for (let k = DRAW - 1; k >= 0; k--) {
      const p = P[k];
      if (!p.vis) continue;
      const g = track.gripAt(p.z1 + 2.5);
      if (g >= 1) continue;
      const bot = Math.min(p.y1, p.clip);
      ctx.fillStyle = `rgba(230,248,255,${0.22 * (1 - p.fog)})`;
      ctx.beginPath();
      ctx.moveTo(p.x2 - p.w2, p.y2);
      ctx.lineTo(p.x2 + p.w2, p.y2);
      ctx.lineTo(p.x1 + p.w1, bot);
      ctx.lineTo(p.x1 - p.w1, bot);
      ctx.closePath();
      ctx.fill();
      // 얼음 결 반짝
      if (p.s2 > 6) {
        const tw = hash2(p.seg.i, Math.floor(time * 4));
        if (tw > 0.6) sparkle(ctx, p.x2 + (hash2(p.seg.i, 3) - 0.5) * p.w2 * 1.6, p.y2, Math.min(8, 0.1 * p.s2 + 2), (tw - 0.6) * 2);
      }
    }
    ctx.restore();
  }

  /** 물속에 비치는 산호 덩어리 (물 표면 아래라 흐릿하게) + 헤엄치는 물고기 떼 */
  drawReef(ctx, track, time) {
    const P = this.P;
    const T = this.theme;
    const cols = T.reef;
    const camH = (PY - HZ) / PSCALE;
    for (let k = DRAW - 1; k >= 1; k--) {
      const p = P[k];
      if (!p.vis || p.s2 < 2.2) continue;
      const s = p.seg;
      const fogA = 1 - p.fog;
      for (let j = 0; j < 2; j++) {
        const h = hash2(s.i, j + 70);
        if (h < 0.35) continue;
        const f = hash2(s.i, j + 80);
        const y = lerp(p.y1, p.y2, f);
        if (y > Math.min(p.y1, p.clip)) continue;
        const sc = lerp(p.s1, p.s2, f);
        const dz = this.F / sc;
        const flat = Math.min(0.6, camH / dz);
        const x = lerp(p.x1, p.x2, f) + (hash2(s.i, j + 90) - 0.5) * 70 * sc;
        const R = (2.2 + h * 3.2) * sc;
        if (x + R < 0 || x - R > W) continue;
        const c = cols[(s.i + j) % cols.length];
        ctx.globalAlpha = 0.32 * fogA;
        ctx.fillStyle = c;
        for (let b = 0; b < 4; b++) {
          const bx = x + (hash2(s.i + b, j) - 0.5) * R * 1.4;
          const by = y + (hash2(s.i, b + j * 7) - 0.5) * R * flat * 0.8;
          ctx.beginPath();
          ctx.ellipse(bx, by, R * (0.35 + hash2(b, s.i) * 0.3), R * flat * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // 물고기 떼: 코스를 가로질러 헤엄 (어두운 그림자)
    ctx.globalAlpha = 1;
    for (let g = 0; g < 5; g++) {
      const zz = Math.floor(this.camZ / 40) * 40 + g * 40 + 30 + hash2(g, Math.floor(this.camZ / 40) + g) * 20;
      const p = this.proj(0, track.heightAt(zz) - 0.5, zz, _e);
      if (!p || p.s < 3) continue;
      const dir = hash2(g, 3) < 0.5 ? -1 : 1;
      const cx = ((time * 1.6 * dir + hash2(g, 9) * 60) % 60) - 30;
      for (let i = 0; i < 7; i++) {
        const fx = cx + (i % 3) * 0.9 * -dir + Math.sin(time * 3 + i) * 0.2;
        const fz = zz + ((i * 0.7) % 2.4) - 1.2;
        const q = this.proj(fx, track.heightAt(fz) - 0.4, fz, _f);
        if (!q || q.sx < -20 || q.sx > W + 20) continue;
        const L = 0.45 * q.s;
        ctx.fillStyle = "rgba(10,60,90,0.35)";
        ctx.beginPath();
        ctx.ellipse(q.sx, q.sy, L, L * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(q.sx - dir * L, q.sy);
        ctx.lineTo(q.sx - dir * L * 1.5, q.sy - L * 0.3);
        ctx.lineTo(q.sx - dir * L * 1.5, q.sy + L * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  chevron(ctx, x, z, w, color, back) {
    const a = this.proj(x - w, this.track.heightAt(z), z, _a);
    const b2 = this.proj(x + w, this.track.heightAt(z), z, _b);
    const c = this.proj(x, this.track.heightAt(z + (back ? -3 : 3)), z + (back ? -3 : 3), _c);
    if (!a || !b2 || !c) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, 0.35 * a.s);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(b2.sx, b2.sy);
    ctx.stroke();
  }

  /** 부스터 판: 물 위에 빛나는 노란 패널 + 앞으로 흐르는 화살표 */
  drawPad(ctx, o, time) {
    const tr = this.track;
    const z0 = o.z - o.d;
    const z1 = o.z + o.d;
    const y0 = tr.heightAt(z0);
    const y1 = tr.heightAt(z1);
    const a = this.proj(o.x - o.r, y0, z0, _a);
    const b = this.proj(o.x + o.r, y0, z0, _b);
    const c = this.proj(o.x + o.r, y1, z1, _c);
    const d = this.proj(o.x - o.r, y1, z1, _d);
    if (!a || !b || !c || !d) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.lineTo(c.sx, c.sy);
    ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, d.sy, 0, a.sy);
    g.addColorStop(0, "rgba(255,170,40,0.9)");
    g.addColorStop(1, "rgba(255,230,90,0.95)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 0.12 * a.s);
    ctx.strokeStyle = "#fff6c0";
    ctx.stroke();
    ctx.clip();
    // 흐르는 화살표 3개
    for (let i = 0; i < 3; i++) {
      const u = ((i / 3 + time * 1.6) % 1);
      const zz = lerp(z0, z1, u);
      const yy = tr.heightAt(zz);
      const l = this.proj(o.x - o.r * 0.75, yy, zz, _e);
      const r = this.proj(o.x + o.r * 0.75, yy, zz, _f);
      const t = this.proj(o.x, yy, zz + o.d * 0.45, _g);
      if (!l || !r || !t) continue;
      ctx.beginPath();
      ctx.moveTo(l.sx, l.sy);
      ctx.lineTo(t.sx, t.sy);
      ctx.lineTo(r.sx, r.sy);
      ctx.lineWidth = Math.max(1.5, 0.45 * l.s);
      ctx.strokeStyle = `rgba(255,255,255,${0.95 - u * 0.5})`;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 항적: 두 갈래로 벌어지며 흐려지는 하얀 물자국 + 가운데 거품 (최근 1.2초만) */
  drawWake(ctx, r, time) {
    const wk = r.wake;
    if (!wk || wk.n < 2) return;
    const tr = this.track;
    const LIFE = 1.25;
    ctx.lineCap = "round";
    const pts = this._wk || (this._wk = []);
    pts.length = 0;
    for (let i = 0; i < wk.n; i++) {
      const q = wk.get(i);
      const age = time - q.t;
      if (age > LIFE || q.air) continue;
      pts.push(q);
    }
    if (pts.length < 2) return;
    for (let pass = 0; pass < 3; pass++) {
      let prev = null;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        const age = time - q.t;
        const wob = Math.sin(q.t * 7 + i * 0.9) * 0.18 * age;
        const spread = pass === 2 ? 0 : (0.6 + age * 1.9 + wob) * (pass === 0 ? -1 : 1);
        const pr = this.proj(q.x + spread, tr.heightAt(q.z), q.z, pass === 0 ? _a : pass === 1 ? _b : _c);
        if (!pr) {
          prev = null;
          continue;
        }
        const cur = { x: pr.sx, y: pr.sy, s: pr.s, age };
        if (prev && Math.abs(prev.y - cur.y) + Math.abs(prev.x - cur.x) > 0.5) {
          const fade = 1 - age / LIFE;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(cur.x, cur.y);
          if (pass === 2) {
            ctx.strokeStyle = `rgba(235,252,255,${0.22 * fade})`;
            ctx.lineWidth = Math.max(1.5, cur.s * 0.7);
          } else {
            ctx.strokeStyle = `rgba(255,255,255,${0.75 * fade})`;
            ctx.lineWidth = Math.max(0.8, cur.s * 0.13 * (0.6 + fade * 0.6));
          }
          ctx.stroke();
        }
        prev = cur;
      }
    }
  }

  /** 깊이 순서로 스프라이트 · 레이서 · 물보라 */
  drawWorld(ctx, track, race, time) {
    const P = this.P;
    const items = this.items;
    let n = 0;
    const add = (z, kind, ref, clip) => {
      let it = items[n];
      if (!it) it = items[n] = {};
      it.z = z;
      it.kind = kind;
      it.ref = ref;
      it.clip = clip;
      n++;
    };
    for (let k = 0; k < DRAW; k++) {
      const p = P[k];
      if (!p.ok) continue;
      // 가려진 구간이어도 키 큰 풍경은 위쪽이 보일 수 있다 → clip 으로 처리
      for (const o of p.seg.objs) if (!o.pad && !o.gone) add(o.z, "obj", o, p.clip);
      for (const o of p.seg.scen) add(o.z, "scen", o, p.clip);
    }
    for (const r of race.racers) {
      const k = Math.floor(r.z / SEG) - this.base;
      add(r.z, "racer", r, k >= 0 && k < DRAW && P[k].ok ? P[k].clip : H + 10);
    }
    const parts = race.fx.parts;
    for (let i = 0; i < parts.length; i++) {
      const q = parts[i];
      if (!q.on) continue;
      add(q.z, "part", q, H + 10);
    }
    this.nItems = n;
    // 먼 것부터
    const list = items.slice(0, n);
    list.sort((a, b) => b.z - a.z);
    for (const it of list) {
      if (it.kind === "part") this.drawPart(ctx, it.ref);
      else if (it.kind === "racer") this.drawRacerAt(ctx, it.ref, time, race, it.clip);
      else this.drawThing(ctx, it.ref, time, it.clip);
    }
  }

  drawThing(ctx, o, time, clip) {
    const tr = this.track;
    const wy = tr.heightAt(o.z);
    let bobY = 0;
    if (o.type === "pylon" || o.type === "barrel" || o.type === "orb" || o.type === "crate") bobY = Math.sin(time * 2.2 + o.z) * 0.06 + (o.type === "orb" ? 0.25 + (o.h || 0) : 0);
    let x = o.x;
    if (o.move) x += Math.sin(time * o.move.speed + o.z) * o.move.amp;
    const p = this.proj(x, wy + bobY, o.z, _a);
    if (!p) return;
    if (p.sx < -800 || p.sx > W + 800) return;
    const clipped = clip < p.sy - 1;
    if (clipped) {
      if (clip < p.sy - 500 * (p.s / 30)) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, clip);
      ctx.clip();
    }
    if (o.hazard) {
      this.drawHazard(ctx, o, p, time);
    } else if (o.lightGate) {
      this.drawLightGate(ctx, o, p, time);
    } else if (o.type === "coralArch") {
      const span = (tr.hwAt(o.z) + 2.4) * 2;
      const sp = getSprite("coralArch", { span: Math.round(span * 100), box: [-span * 50 - 160, -940, span * 50 + 160, 40] });
      if (sp) drawSprite(ctx, sp, p.sx, p.sy, p.s);
    } else if (o.type === "gate") {
      const span = (tr.hwAt(o.z) + 1.6) * 2;
      const sp = getSprite("gate", { kind: o.kind, span: Math.round(span * 100), box: [-span * 50 - 140, -940, span * 50 + 140, 30] });
      if (sp) drawSprite(ctx, sp, p.sx, p.sy, p.s);
    } else if (o.type === "dolphins") {
      if (p.s > 1.2) {
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.scale(p.s / 10, p.s / 10);
        const ph = (time * 0.45 + o.z * 0.01) % 2.2;
        dolphin(ctx, ph, 1);
        dolphin(ctx, ph - 0.35, 0.8);
        if (ph < 1.05 && ph > 0.95) {
          /* 물 튐은 생략 */
        }
        ctx.restore();
      }
    } else {
      const sp = getSprite(o.type, o);
      if (sp) {
        if (o.type === "orb") {
          // 빛 번짐
          const gl = ctx.createRadialGradient(p.sx, p.sy - 1.1 * p.s, 0, p.sx, p.sy - 1.1 * p.s, 1.4 * p.s);
          gl.addColorStop(0, "rgba(160,250,255,0.55)");
          gl.addColorStop(1, "rgba(160,250,255,0)");
          ctx.fillStyle = gl;
          ctx.fillRect(p.sx - 1.4 * p.s, p.sy - 2.5 * p.s, 2.8 * p.s, 2.8 * p.s);
        }
        drawSprite(ctx, sp, p.sx, p.sy, p.s, { flip: o.flip });
        if (o.type === "beaconRock") {
          const on = Math.sin(time * 5 + o.z) > 0;
          const ly = p.sy - 2.02 * p.s;
          const g = ctx.createRadialGradient(p.sx, ly, 0, p.sx, ly, 1.4 * p.s);
          g.addColorStop(0, on ? "rgba(255,80,80,0.95)" : "rgba(255,80,80,0.35)");
          g.addColorStop(1, "rgba(255,80,80,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.sx, ly, 1.4 * p.s, 0, Math.PI * 2);
          ctx.fill();
        } else if (o.type === "stormLighthouse" || o.type === "lighthouse") {
          // 돌아가는 등대 불빛
          const ly = p.sy - (o.type === "lighthouse" ? 18.2 : 24.6) * p.s;
          const lx = p.sx + (o.flip ? -1 : 1) * 0;
          const a = Math.sin(time * 0.9 + o.z) * 1.1;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.translate(lx, ly);
          ctx.rotate(a);
          const L = 40 * p.s;
          const g = ctx.createLinearGradient(0, 0, L, 0);
          g.addColorStop(0, `rgba(255,244,190,${this.theme.night || this.theme.lightning ? 0.45 : 0.18})`);
          g.addColorStop(1, "rgba(255,244,190,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(L, -L * 0.12);
          ctx.lineTo(L, L * 0.12);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }
    if (clipped) ctx.restore();
  }

  /** 헤드라이트: 앞 물 위에 부드러운 빛 부채꼴 (밝게 더하기) */
  drawHeadlight(ctx, pl, time) {
    if (pl.air) return;
    const tr = this.track;
    const pts = [];
    for (const [dz, w] of [
      [1.5, 0.9],
      [40, 9],
    ]) {
      const z = pl.z + dz;
      const a = this.proj(pl.x - w + (pl.vx || 0) * 0.05 * dz, tr.heightAt(z), z, _f);
      const b = this.proj(pl.x + w + (pl.vx || 0) * 0.05 * dz, tr.heightAt(z), z, _g);
      if (!a || !b) return;
      pts.push([a.sx, a.sy, b.sx, b.sy]);
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(0, pts[0][1], 0, pts[1][1]);
    g.addColorStop(0, "rgba(255,240,200,0.32)");
    g.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.lineTo(pts[1][2], pts[1][3]);
    ctx.lineTo(pts[0][2], pts[0][3]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 번개 · 증기 · 촉수: 경고 → 터짐 */
  drawHazard(ctx, o, p, time) {
    const hs = this.track.hazardState(o);
    const camH = (PY - HZ) / PSCALE;
    const flat = Math.min(0.62, camH / Math.max(1, p.dz));
    const R = o.r * p.s;
    if (o.hazard === "zap") {
      if (hs.st === "warn") {
        const pulse = 0.5 + 0.5 * Math.sin(time * 16);
        ctx.fillStyle = `rgba(255,60,70,${0.12 + 0.22 * hs.k})`;
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, R, R * flat, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = Math.max(2, 0.16 * p.s);
        ctx.setLineDash([Math.max(4, R * 0.28), Math.max(3, R * 0.18)]);
        ctx.lineDashOffset = -time * 40;
        ctx.strokeStyle = `rgba(255,232,80,${0.6 + 0.4 * pulse})`;
        ctx.stroke();
        ctx.setLineDash([]);
        // 줄어드는 안쪽 고리 = 남은 시간
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = Math.max(1.5, 0.1 * p.s);
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, R * (1 - hs.k) + 1, (R * (1 - hs.k) + 1) * flat, 0, 0, Math.PI * 2);
        ctx.stroke();
        warnSign(ctx, p.sx, p.sy - 3.2 * p.s, Math.max(10, 0.9 * p.s), time, "zap");
      } else if (hs.st === "strike") {
        // 하늘에서 떨어지는 번개
        const seed = Math.floor(time * 24);
        const top = Math.min(p.sy - 40, HZ - 120);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass === 0 ? "rgba(160,210,255,0.5)" : "rgba(255,255,255,0.98)";
          ctx.lineWidth = pass === 0 ? Math.max(8, 0.9 * p.s) : Math.max(2.5, 0.28 * p.s);
          ctx.beginPath();
          ctx.moveTo(p.sx + (hash2(seed, 1) - 0.5) * 60, top);
          for (let i = 1; i <= 8; i++) {
            const u = i / 8;
            const jx = i === 8 ? 0 : (hash2(seed, i + 3) - 0.5) * R * 1.4;
            ctx.lineTo(p.sx + jx, lerp(top, p.sy, u));
          }
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, R * 1.6);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.4, "rgba(170,220,255,0.55)");
        g.addColorStop(1, "rgba(170,220,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, R * 1.6, R * 1.6 * flat + R * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 쉬는 동안: 물 위 어두운 그림자 (먹구름 아래)
        ctx.fillStyle = "rgba(10,20,40,0.12)";
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, R, R * flat, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (o.hazard === "geyser") {
      // 분출구: 검은 바위 고리 + 붉은 빛
      ctx.fillStyle = "rgba(40,30,30,0.85)";
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, R * 0.75, R * 0.75 * flat, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,120,40,${0.35 + 0.25 * Math.sin(time * 5 + o.z)})`;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, R * 0.42, R * 0.42 * flat, 0, 0, Math.PI * 2);
      ctx.fill();
      if (hs.st === "warn") {
        // 보글보글 거품 + 김 조금
        for (let i = 0; i < 7; i++) {
          const ph = (time * 2.2 + i * 0.37) % 1;
          const a = i * 2.4;
          const bx = p.sx + Math.cos(a) * R * 0.5 * (1 - ph * 0.3);
          const by = p.sy + Math.sin(a) * R * 0.5 * flat - ph * R * 0.4;
          ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - ph)})`;
          ctx.lineWidth = Math.max(1, 0.05 * p.s);
          ctx.beginPath();
          ctx.arc(bx, by, Math.max(1.5, (0.12 + ph * 0.15) * p.s), 0, Math.PI * 2);
          ctx.stroke();
        }
        warnSign(ctx, p.sx, p.sy - 3 * p.s, Math.max(10, 0.85 * p.s), time, "steam");
      } else if (hs.st === "strike") {
        // 증기 기둥: 아래는 좁고 위는 넓게 피어오른다
        const h = (6 + 4 * Math.sin(Math.min(1, hs.k * 1.4) * Math.PI * 0.5)) * p.s;
        const blobImg = blob();
        ctx.globalAlpha = 0.9 * (1 - Math.max(0, hs.k - 0.75) * 4);
        for (let i = 0; i < 9; i++) {
          const u = i / 8;
          const w = R * (0.5 + u * 1.3) * (0.9 + 0.2 * Math.sin(time * 9 + i));
          ctx.drawImage(blobImg, p.sx - w + Math.sin(time * 3 + i) * R * 0.2, p.sy - h * u - w * 0.8, w * 2, w * 1.6);
        }
        ctx.globalAlpha = 1;
      }
    } else if (o.hazard === "tentacle") {
      this.drawTentacle(ctx, o, p, hs, time);
    }
  }

  /** 거대 촉수: 경고(물결 소용돌이) → 물 위로 솟았다 → 내려간다 (코스를 막는 환경 요소) */
  drawTentacle(ctx, o, p, hs, time) {
    const camH = (PY - HZ) / PSCALE;
    const flat = Math.min(0.62, camH / Math.max(1, p.dz));
    const R = o.r * p.s;
    if (hs.st === "warn") {
      ctx.strokeStyle = "rgba(200,140,255,0.7)";
      ctx.lineWidth = Math.max(1.5, 0.1 * p.s);
      for (let i = 0; i < 3; i++) {
        const k = (time * 0.8 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, R * (0.4 + k * 1.2), R * (0.4 + k * 1.2) * flat, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      warnSign(ctx, p.sx, p.sy - 3 * p.s, Math.max(10, 0.85 * p.s), time, "tentacle");
      return;
    }
    if (hs.st !== "strike") return;
    // 솟는 높이: 빨리 솟고 천천히 가라앉는다
    const up = hs.k < 0.25 ? hs.k / 0.25 : 1 - Math.max(0, hs.k - 0.7) / 0.3;
    const h = 4.2 * up * p.s;
    const sway = Math.sin(time * 2.4 + o.z) * 0.6 * p.s;
    const w = o.r * 0.8 * p.s;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.sx - w, p.sy);
    ctx.bezierCurveTo(p.sx - w * 0.9, p.sy - h * 0.5, p.sx + sway - w * 0.5, p.sy - h * 0.8, p.sx + sway * 1.6, p.sy - h);
    ctx.bezierCurveTo(p.sx + sway + w * 0.5, p.sy - h * 0.82, p.sx + w * 0.9, p.sy - h * 0.5, p.sx + w, p.sy);
    ctx.closePath();
    const g = ctx.createLinearGradient(p.sx - w, 0, p.sx + w, 0);
    g.addColorStop(0, "#5a2a8a");
    g.addColorStop(0.45, "#9a5ad6");
    g.addColorStop(1, "#4a1f78");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, 0.08 * p.s);
    ctx.strokeStyle = "#2a1048";
    ctx.stroke();
    // 빨판
    ctx.fillStyle = "#f0c6ff";
    for (let i = 1; i < 6; i++) {
      const u = i / 6;
      const cx = lerp(p.sx - w * 0.4, p.sx + sway * 1.4, u);
      const cy = p.sy - h * u * 0.92;
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.25 * (1 - u), cy, Math.max(1, w * 0.18 * (1 - u * 0.6)), Math.max(1, w * 0.12 * (1 - u * 0.6)), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // 물거품 고리
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = Math.max(1.5, 0.12 * p.s);
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, w * 1.4, w * 1.4 * flat, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** 조명 게이트: 기둥 두 개 + 반짝이는 전구 아치 (가운데로 지나가면 게이지 +½) */
  drawLightGate(ctx, o, p, time) {
    const tr = this.track;
    const wy = tr.heightAt(o.z);
    const l = this.proj(o.x - o.r, wy, o.z, _f);
    const r = this.proj(o.x + o.r, wy, o.z, _g);
    if (!l || !r) return;
    const h = 4.2 * p.s;
    const taken = this._player && this._player.taken.has(o.id);
    ctx.lineCap = "round";
    // 기둥
    for (const q of [l, r]) {
      ctx.strokeStyle = "#2a3550";
      ctx.lineWidth = Math.max(2, 0.22 * p.s);
      ctx.beginPath();
      ctx.moveTo(q.sx, q.sy);
      ctx.lineTo(q.sx, q.sy - h * 0.92);
      ctx.stroke();
    }
    // 아치
    const peakY = p.sy - h * 1.28;
    ctx.strokeStyle = "#3a4870";
    ctx.lineWidth = Math.max(2, 0.18 * p.s);
    ctx.beginPath();
    ctx.moveTo(l.sx, l.sy - h * 0.92);
    ctx.quadraticCurveTo(p.sx, peakY, r.sx, r.sy - h * 0.92);
    ctx.stroke();
    // 전구 (차례로 반짝)
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = (1 - u) * (1 - u) * l.sx + 2 * (1 - u) * u * p.sx + u * u * r.sx;
      const y = (1 - u) * (1 - u) * (l.sy - h * 0.92) + 2 * (1 - u) * u * peakY + u * u * (r.sy - h * 0.92);
      const on = 0.5 + 0.5 * Math.sin(time * 8 - i * 0.9);
      const rad = Math.max(1.5, 0.16 * p.s);
      const col = taken ? "180,190,210" : i % 3 === 0 ? "255,214,90" : i % 3 === 1 ? "120,240,255" : "255,140,210";
      ctx.fillStyle = `rgba(${col},${0.25 + 0.3 * on})`;
      ctx.beginPath();
      ctx.arc(x, y, rad * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${col},1)`;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRacerAt(ctx, r, time, race, clip) {
    const tr = this.track;
    const wy = tr.heightAt(r.z);
    const p = this.proj(r.x, r.Y, r.z, _a);
    if (!p) return;
    if (p.sx < -200 || p.sx > W + 200) return;
    const clipped = clip < p.sy - 1;
    if (clipped) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, clip);
      ctx.clip();
    }
    // 그림자 (공중이면 물 위에 따로)
    const air = r.Y - wy > 0.15;
    if (air) {
      const sh = this.proj(r.x, wy, r.z, _b);
      if (sh) {
        ctx.save();
        ctx.translate(sh.sx, sh.sy);
        ctx.scale(sh.s / 100, sh.s / 100);
        ctx.globalAlpha = clamp(1 - (r.Y - wy) / 6, 0.2, 0.7);
        ctx.fillStyle = "rgba(4,40,70,0.55)";
        ctx.beginPath();
        ctx.ellipse(0, 4, 70, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(p.sx, p.sy);
    const k = p.s / 100;
    ctx.scale(k, k);
    if (p.s < 9) {
      // 아주 멀리: 간단한 모양 (선체 색 덩어리 + 물보라)
      ctx.fillStyle = r.def.body;
      ctx.beginPath();
      ctx.ellipse(0, -40, 60, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(0, 6, 90, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      if (!air) {
        sprayWings(ctx, r, time);
        drawHullFoam(ctx, r.def, r.pose);
      }
      drawRacer(ctx, r.def, r.pose);
      // 부스트: 노즐 뒤로 빛나는 물 분사
      if (r.boostT > 0) {
        const fl = 0.7 + Math.sin(time * 40) * 0.3;
        const g = ctx.createRadialGradient(0, -6, 2, 0, 6, 60 * fl);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.4, "rgba(140,240,255,0.6)");
        g.addColorStop(1, "rgba(140,240,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 4, 50 * fl, 34 * fl, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (clipped) ctx.restore();
    r.screen = r.screen || {};
    r.screen.x = p.sx;
    r.screen.y = p.sy;
    r.screen.s = p.s;
  }

  /** 물보라 입자 — 카메라에 너무 가까워지면 흐려져 사라진다 (화면을 덮지 않게) */
  drawPart(ctx, q) {
    const p = this.proj(q.x, q.y, q.z, _a);
    if (!p) return;
    const k = q.age / q.life;
    const near = clamp((p.dz - 1.8) / 3.2, 0, 1);
    const a = (1 - k * k) * q.a * near;
    if (a <= 0.02) return;
    let r = q.r * p.s * (q.grow ? 1 + k * q.grow : 1);
    if (r < 0.4 || p.sx < -r || p.sx > W + r || p.sy < -r) return;
    if (q.kind === 0) {
      // 물방울: 빛나는 작은 알갱이 (너무 크지 않게)
      r = Math.min(r, 5.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = q.c;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, Math.max(0.7, r), Math.max(0.7, r * 1.25), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (q.kind === 1) {
      // 물안개: 가장자리가 부드러운 흰 덩어리
      r = Math.min(r, 70);
      ctx.globalAlpha = a * 0.85;
      ctx.drawImage(blob(), p.sx - r, p.sy - r, r * 2, r * 2);
    } else if (q.kind === 2) {
      // 물결 고리 (착지 · 충돌)
      ctx.globalAlpha = a;
      ctx.strokeStyle = q.c;
      ctx.lineWidth = Math.max(1, 0.12 * p.s * (1 - k));
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy, r, r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (q.kind === 3) {
      ctx.globalAlpha = 1;
      sparkle(ctx, p.sx, p.sy, Math.min(r, 16), a);
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * 물 날개: 선체 양옆으로 비스듬히 튀어 오르는 반투명 물막 (속도 · 부스트 · 꺾는 쪽 바깥이 크다)
 * + 노즐 뒤로 카메라 쪽(화면 아래)으로 뻗는 물기둥 (rooster tail)
 */
function sprayWings(ctx, r, time) {
  const pose = r.pose;
  const sp = clamp(pose.speed || 0, 0, 1.3);
  if (sp < 0.12) return;
  const b = pose.boost || 0;
  const w = hullInfo(r.def.hull).w / 2;
  const fl = 0.85 + Math.sin(time * 31 + r.z) * 0.1 + Math.sin(time * 17) * 0.05;
  for (const s of [-1, 1]) {
    const carve = 1 + clamp(-s * (pose.yaw || 0), 0, 1) * 0.9;
    const h = (26 + 46 * sp + 36 * b) * carve * fl;
    const reach = (44 + 60 * sp + 44 * b) * carve * fl;
    ctx.save();
    ctx.scale(s, 1);
    const g = ctx.createLinearGradient(w, 0, w + reach, -h * 0.5);
    g.addColorStop(0, "rgba(255,255,255,0.8)");
    g.addColorStop(0.6, "rgba(235,250,255,0.45)");
    g.addColorStop(1, "rgba(235,250,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w - 8, 4);
    ctx.quadraticCurveTo(w + reach * 0.35, -h * 1.15, w + reach, -h * 0.25 + 12);
    ctx.quadraticCurveTo(w + reach * 0.62, -h * 0.3, w + 6, 10);
    ctx.closePath();
    ctx.fill();
    // 날개 끝 물방울
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 4; i++) {
      const u = 0.55 + i * 0.13;
      const x = w + reach * u + Math.sin(time * 23 + i * 2.1) * 4;
      const y = -h * (1 - u) * 0.9 + Math.cos(time * 19 + i) * 4;
      ctx.beginPath();
      ctx.arc(x, y, 2.6 + (i % 2) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  // 물기둥 (노즐 → 카메라 쪽)
  const L = (40 + 60 * sp + 70 * b) * fl;
  const g2 = ctx.createLinearGradient(0, 0, 0, L);
  g2.addColorStop(0, "rgba(255,255,255,0.75)");
  g2.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.quadraticCurveTo(-26 - b * 10, L * 0.55, -8, L);
  ctx.lineTo(8, L);
  ctx.quadraticCurveTo(26 + b * 10, L * 0.55, 12, 0);
  ctx.closePath();
  ctx.fill();
}

let BLOB = null;
/** 부드러운 흰 물안개 스프라이트 (한 번만 만든다) */
function blob() {
  if (BLOB) return BLOB;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(28, 28, 2, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(250,254,255,0.75)");
  g.addColorStop(0.8, "rgba(230,248,255,0.25)");
  g.addColorStop(1, "rgba(230,248,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  BLOB = c;
  return c;
}

/** 떠 있는 경고 표지 (노란 삼각형 + 그림) */
function warnSign(ctx, x, y, s, time, kind) {
  const bob = Math.sin(time * 6) * s * 0.08;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.95, s * 0.68);
  ctx.lineTo(-s * 0.95, s * 0.68);
  ctx.closePath();
  ctx.fillStyle = "#ffd23f";
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, s * 0.14);
  ctx.strokeStyle = "#3a2a00";
  ctx.stroke();
  ctx.fillStyle = "#3a2a00";
  if (kind === "zap") {
    ctx.beginPath();
    ctx.moveTo(s * 0.08, -s * 0.5);
    ctx.lineTo(-s * 0.22, s * 0.12);
    ctx.lineTo(-s * 0.02, s * 0.12);
    ctx.lineTo(-s * 0.1, s * 0.5);
    ctx.lineTo(s * 0.24, -s * 0.08);
    ctx.lineTo(s * 0.02, -s * 0.08);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-s * 0.07, -s * 0.42, s * 0.14, s * 0.56);
    ctx.beginPath();
    ctx.arc(0, s * 0.36, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const _a = {};
const _b = {};
const _c = {};
const _d = {};
const _e = {};
const _f = {};
const _g = {};

function quad(ctx, xa, xb, ya, xc, xd, yb) {
  ctx.beginPath();
  ctx.moveTo(xa, ya);
  ctx.lineTo(xb, ya);
  ctx.lineTo(xd, yb);
  ctx.lineTo(xc, yb);
  ctx.closePath();
  ctx.fill();
}

export function sparkle(ctx, x, y, r, a = 1) {
  ctx.fillStyle = `rgba(255,255,245,${a})`;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  ctx.fill();
}
