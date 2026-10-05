/*
 * 🌊 바다 물총 대작전 — 아트 진입점 (엔진이 부르는 그리기 API)
 *  enemy · boss · shot · item · player · nozzle · portrait · boatPortrait · heroPortrait · menuActors
 */
import { W, H, project, clamp } from "../../../js/blaster/view.js?v=2";
import { ENEMY_ART } from "./enemies.js?v=2";
import "./enemies2.js?v=2";
import "./enemies3.js?v=2";
import { drawShot, drawItem } from "./props.js?v=2";
import { BOSS_ART, seaCoil } from "./bosses.js?v=2";
import { drawHeroBack, drawHeroFront, drawHeroPortrait, GUN_PIVOT } from "./hero.js?v=2";
import { boatSprite, drawBoatWater, drawBoatLive, drawBoatFoam, drawBoatStatic } from "./boat.js?v=2";
import { ell, circ, shadow, stroke, linear, radial } from "./kit.js?v=2";

ENEMY_ART["sea-coil"] = seaCoil;

const HERO_Y = -84;
const HERO_S = 0.9;
let facing = 1;
let turnT = 0;

function boatGeom(st) {
  const sail = st.sail == null ? 1 : st.sail;
  const esc = st.escape || 0;
  const bob = Math.sin(st.t * 1.7) * 3.5;
  return {
    x: W / 2 + Math.sin(st.t * 0.9) * 3,
    y: H - 58 + bob + (1 - sail) * 170 + esc * esc * 320,
    tilt: Math.sin(st.t * 1.3) * 0.012 + (st.hurt || 0) * Math.sin(st.t * 30) * 0.025,
  };
}

function updateFacing(st) {
  const g = boatGeom(st);
  const before = facing;
  if (st.aimX < g.x - 30) facing = -1;
  else if (st.aimX > g.x + 30) facing = 1;
  if (before !== facing) turnT = 0.14;
}

function pivot(st) {
  const g = boatGeom(st);
  const breath = Math.sin(st.t * 2.2) * 1.4;
  return { x: g.x + facing * GUN_PIVOT.x * HERO_S, y: g.y + HERO_Y + (GUN_PIVOT.y + breath) * HERO_S };
}

function nozzle(st) {
  updateFacing(st);
  const pv = pivot(st);
  const a = Math.atan2(st.aimY - pv.y, st.aimX - pv.x);
  const len = (106 - (st.recoil || 0) * 7) * HERO_S;
  return { x: pv.x + Math.cos(a) * len, y: pv.y + Math.sin(a) * len, a };
}

function spritePx(game) {
  const s = game && game.view ? game.view.scale : 0.75;
  return clamp(s * Math.min(2.5, window.devicePixelRatio || 1), 1, 3);
}

function drawPlayer(ctx, st, game) {
  updateFacing(st);
  if (turnT > 0) turnT -= 1 / 60;
  const g = boatGeom(st);
  const id = st.boat || "blue-shark";
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.tilt);
  drawBoatWater(ctx, st.t, id, st.escape > 0 ? -1 : 1);
  const sp = boatSprite(id, spritePx(game));
  ctx.drawImage(sp.cv, sp.x0, sp.y0, sp.w, sp.h);
  drawBoatLive(ctx, st.t, id);
  // 지혁
  ctx.save();
  ctx.translate(0, HERO_Y);
  const squash = turnT > 0 ? 0.75 + (1 - turnT / 0.14) * 0.25 : 1;
  ctx.scale(HERO_S * facing * squash, HERO_S);
  const front = (st.cheer || 0) > 0.5 || ((st.hurt || 0) > 0.3 && !st.firing);
  if (front) drawHeroFront(ctx, 0, 0, 1, { t: st.t }, st.cheer > 0.5 ? "cheer" : "wet");
  else {
    const pv = pivot(st);
    const a = Math.atan2(st.aimY - pv.y, st.aimX - pv.x) - g.tilt;
    const local = facing > 0 ? a : Math.PI - a;
    drawHeroBack(ctx, { t: st.t, aim: local, recoil: st.recoil, firing: st.firing, hurt: st.hurt });
  }
  ctx.restore();
  drawBoatFoam(ctx, st.t);
  ctx.restore();
  if (st.escape > 0) {
    // 긴급 탈출: 구명 튜브
    const ry = g.y - 200 + Math.sin(st.t * 6) * 6;
    ctx.save();
    ctx.translate(g.x + 130, ry);
    ell(ctx, 0, 0, 24, 26);
    stroke(ctx, "#ff4d4d", 12);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 26, 0, i * (Math.PI / 2) + 0.35, i * (Math.PI / 2) + 0.95);
      stroke(ctx, "#ffffff", 12, "butt");
    }
    ctx.restore();
  }
  if (st.power === "rainbow" || st.power === "thunder" || st.power === "ice") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18 + 0.1 * Math.sin(st.t * 10);
    shadow(ctx, g.x, g.y - 170, 110, 110, 0.9, st.power === "rainbow" ? "255,170,240" : st.power === "ice" ? "170,235,255" : "255,240,120");
    ctx.restore();
  }
}

const POSE = (o) => ({ t: 0.6, now: 0.6, blink: false, dir: 1, hit: 0, wet: 0, soaked: false, dizzy: false, open: false, mode: "", angry: false, windup: 0, ...o });

function portraitBg(ctx, w, h, seen, boss) {
  ctx.fillStyle = radial(ctx, `pbg${seen}|${boss}|${w}`, w * 0.5, h * 0.38, 4, w * 0.5, h * 0.5, w * 0.72, boss
    ? [
        [0, seen ? "#ffe9f0" : "#e2e6ee"],
        [1, seen ? "#ff8fa8" : "#97a3b5"],
      ]
    : [
        [0, seen ? "#effbff" : "#dfe8f0"],
        [1, seen ? "#7fcaf5" : "#97a9b9"],
      ]);
  ctx.fillRect(0, 0, w, h);
  // 물결 바닥
  ctx.fillStyle = seen ? "rgba(20,120,210,0.55)" : "rgba(60,80,100,0.5)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.78);
  for (let x = 0; x <= w; x += w / 8) ctx.quadraticCurveTo(x + w / 16, h * 0.74, x + w / 8, h * 0.78);
  ctx.lineTo(w, h);
  ctx.fill();
}

/* 도감 그림: 실제로 그려지는 범위를 한 번 재서 카드 안에 꽉 차게 맞춘다 */
const FIT = new Map();
function measure(key, draw) {
  if (FIT.has(key)) return FIT.get(key);
  const N = 720;
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.translate(N / 2, N * 0.78);
  draw(x);
  const d = x.getImageData(0, 0, N, N).data;
  let x0 = N;
  let y0 = N;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < N; y += 2)
    for (let xx = 0; xx < N; xx += 2) {
      if (d[(y * N + xx) * 4 + 3] > 24) {
        if (xx < x0) x0 = xx;
        if (xx > x1) x1 = xx;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  const bb = x1 > x0 ? { x0: x0 - N / 2, x1: x1 - N / 2, y0: y0 - N * 0.78, y1: y1 - N * 0.78 } : { x0: -50, x1: 50, y0: -100, y1: 10 };
  FIT.set(key, bb);
  return bb;
}
function fitDraw(ctx, w, h, key, draw, maxScale) {
  const bb = measure(key, draw);
  const bw = bb.x1 - bb.x0;
  const bh = bb.y1 - bb.y0;
  const sc = Math.min((w * 0.84) / bw, (h * 0.78) / bh, maxScale);
  ctx.save();
  ctx.translate(w / 2 - ((bb.x0 + bb.x1) / 2) * sc, h * 0.9 - bb.y1 * sc);
  ctx.scale(sc, sc);
  draw(ctx);
  ctx.restore();
}

export function makeArt(content) {
  const art = {
    enemy(ctx, e, p) {
      const fn = ENEMY_ART[e.id];
      if (fn) fn(ctx, e, p);
    },
    boss(ctx, b, p) {
      const fn = BOSS_ART[b.id];
      if (fn) fn(ctx, b, p);
    },
    shot: drawShot,
    item: drawItem,
    player: drawPlayer,
    nozzle,
    heroPortrait: drawHeroPortrait,
    kidFront: drawHeroFront,
    hasEnemy: (id) => Boolean(ENEMY_ART[id]),
    hasBoss: (id) => Boolean(BOSS_ART[id]),
    portrait(cv, id, seen) {
      const ctx = cv.getContext("2d");
      const w = cv.width;
      const h = cv.height;
      ctx.clearRect(0, 0, w, h);
      const boss = content.bosses[id];
      const drawChar = (c) => {
        if (id.startsWith("item-")) {
          const it = content.items[id.slice(5)];
          drawItem(c, { sx: w / 2, sy: h * 0.46, s: w / 110, age: 0, d: { ...(it || {}), name: "" } }, 0.4);
        } else if (boss) {
          fitDraw(c, w, h, `b:${id}`, (x) => BOSS_ART[id](x, { id }, POSE({ phase: 0, spout: false, hp: 1 })), (w / 160) * 1.6);
        } else if (ENEMY_ART[id]) {
          const d = content.enemies[id] || {};
          const fake = { id, d, mem: { open: true, puff: id.includes("puffer") ? 1 : 0 }, opts: {}, uid: 3, slot: 1, carry: "bomb", hp: 2, maxHp: 2, atkT: 9 };
          fitDraw(c, w, h, `e:${id}`, (x) => ENEMY_ART[id](x, fake, POSE({ open: Boolean(d.weakPoint && d.weakPoint.when === "open") })), (w / 160) * 1.5);
        }
      };
      portraitBg(ctx, w, h, seen, Boolean(boss));
      if (seen) {
        drawChar(ctx);
        return;
      }
      // 아직 못 만난 친구: 그림자 실루엣 + 물음표
      const sil = document.createElement("canvas");
      sil.width = w;
      sil.height = h;
      const c2 = sil.getContext("2d");
      drawChar(c2);
      c2.globalCompositeOperation = "source-in";
      c2.fillStyle = "rgba(28,42,60,0.93)";
      c2.fillRect(0, 0, w, h);
      ctx.drawImage(sil, 0, 0);
      ctx.font = `${Math.round(w * 0.24)}px "Bagel Fat One", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(3, w * 0.03);
      ctx.strokeStyle = "rgba(10,30,60,0.6)";
      ctx.strokeText("?", w / 2, h * 0.46);
      ctx.fillStyle = "#ffffff";
      ctx.fillText("?", w / 2, h * 0.46);
    },
    boatPortrait(cv, id, have) {
      const ctx = cv.getContext("2d");
      const w = cv.width;
      const h = cv.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = linear(ctx, `bp${h}`, 0, 0, 0, h, [
        [0, "#bfeaff"],
        [1, "#1f8fd6"],
      ]);
      ctx.fillRect(0, 0, w, h);
      fitDraw(ctx, w, h, `boat:${id}`, (c) => {
        c.save();
        c.scale(0.8, 0.8);
        drawBoatStatic(c, id);
        c.translate(0, HERO_Y);
        c.scale(HERO_S, HERO_S);
        drawHeroBack(c, { t: 0.5, aim: -1.2, recoil: 0, firing: false });
        c.restore();
      }, 10);
      if (!have) {
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = "rgba(28,42,60,0.86)";
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    },
    /** 메뉴: 둥실 떠 있는 친구들 + 보트 위에서 손 흔드는 지혁 */
    menuActors(ctx, t, jump, game) {
      const pose = (o) => ({ t, now: t, blink: t % 3.1 < 0.12, dir: 1, hit: 0, wet: 0, soaked: false, dizzy: false, open: false, mode: "", angry: false, ...o });
      const fake = (id, o) => ({ id, mem: {}, opts: {}, uid: 5, slot: 0, d: content.enemies[id] || {}, ...o });
      const put = (id, x, z, s, flip, extra) => {
        const p = project(x, z, Math.sin(t * 2 + x * 5) * 4);
        const w = project(x, z, 0);
        shadow(ctx, w.sx, w.sy + 6 * p.s, 40 * p.s * s, 9 * p.s, 0.3, "2,25,60");
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, w.sy + 4 * p.s);
        ctx.clip();
        ctx.translate(p.sx, p.sy);
        ctx.scale(p.s * s * (flip ? -1 : 1), p.s * s);
        ENEMY_ART[id](ctx, fake(id, extra), pose());
        ctx.restore();
        ctx.globalAlpha = 0.7;
        ell(ctx, w.sx, w.sy + 2, 40 * p.s * s, 7 * p.s);
        stroke(ctx, "#ffffff", 2.2 * p.s);
        ctx.globalAlpha = 1;
      };
      if (jump < 0) {
        const k = -jump / 1.7;
        const p = project(-0.7 + k * 1.4, 0.16, Math.sin(k * Math.PI) * 170);
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.rotate((0.5 - k) * -1.1);
        ctx.scale(p.s * 1.1, p.s * 1.1);
        ENEMY_ART.dolphin(ctx, fake("dolphin"), pose());
        ctx.restore();
      }
      put("puffer", 0.74, 0.4, 1.15, true, { mem: { puff: 0 } });
      put("pirate-duck", -0.78, 0.46, 1.15, false);
      put("pirate-crab", -0.52, 0.72, 1.1, false);
      // 보트 + 지혁 (앞모습)
      const by = H - 190 + Math.sin(t * 1.6) * 4;
      ctx.save();
      ctx.translate(W / 2, by);
      ctx.scale(0.82, 0.82);
      drawBoatWater(ctx, t, game.save.data.boat, 0.4);
      const sp = boatSprite(game.save.data.boat, spritePx(game));
      ctx.drawImage(sp.cv, sp.x0, sp.y0, sp.w, sp.h);
      drawBoatLive(ctx, t, game.save.data.boat);
      drawHeroFront(ctx, 0, HERO_Y, 1.05, { t }, Math.sin(t * 0.7) > 0.72 ? "cheer" : "happy");
      drawBoatFoam(ctx, t);
      ctx.restore();
    },
  };
  return art;
}
