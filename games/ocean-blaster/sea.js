/*
 * 🌊 바다 물총 대작전 — 레이어드 바다 렌더러 (12개 해역 + 보너스 + 메뉴)
 *
 *  Layer 1 하늘     : 그라데이션 · 햇빛 번짐 · 입체 구름(2겹 패럴랙스) · 갈매기
 *  Layer 2 먼 바다  : 대기 원근이 들어간 섬 실루엣 · 수평선 안개 · 하늘 반사
 *  Layer 3 중간 바다: 깊이마다 크기가 다른 파도 줄(불규칙) · 반짝임 · 물속 광선 · 물속 그림자
 *  Layer 4 플레이   : (엔진) 적 · 탄 · 물보라
 *  Layer 5 플레이어 : (엔진) 배 · 지혁
 *  Layer 6 앞쪽     : 가까운 파도 · 날씨 · 비네팅
 * 움직이지 않는 것은 캐시 캔버스에 한 번만 그린다.
 */
import { W, H, HORIZON, NEAR_Y, project, seeded, clamp, lerp } from "../../js/blaster/view.js?v=2";
import { TAU, mix, lighten, darken, alpha, lineOf, linear, radial, ell, circ, rrect, smooth, fill, flat, stroke, gloss, dot, shadow, sparkle, star } from "./art/kit.js?v=2";

const seaTop = () => HORIZON + 18;

/* ================================================================
 * 해역 설정 (STAGE 1~12 · 보너스 · 메뉴)
 * ============================================================== */
export const SCENES = {
  clear: {
    title: "CLEAR WATERS",
    sky: ["#2f9ff0", "#7cccff", "#d9f3ff", "#f6fcff"],
    sun: { x: 420, y: 128, r: 40, color: "#fffbe6", glow: "255,250,225" },
    clouds: { far: 5, near: 3, tint: "#ffffff", shade: "#bcdcf2" },
    sea: ["#a8ecf5", "#46c9e3", "#1ba3d8", "#0a71bd", "#06508e"],
    waveTint: "255,255,255",
    islands: [
      { kind: "hills", x: 470, w: 150, h: 20, color: "#8fb6c9" },
      { kind: "tropic", x: 112, s: 1, color: "#3fae6a" },
      { kind: "sailboat", x: 320, s: 0.6 },
    ],
    birds: 4,
    rays: 0.12,
    glint: 1,
    caustic: 0.5,
  },
  gull: {
    title: "SEAGULL ISLE",
    sky: ["#3aa4ec", "#86cdf7", "#e0f5ff", "#fdfeff"],
    sun: { x: 110, y: 120, r: 36, color: "#fffbe6", glow: "255,250,225" },
    clouds: { far: 6, near: 3, tint: "#ffffff", shade: "#c2dcee" },
    sea: ["#b2eef4", "#53c9df", "#1e9bd2", "#0b6cb4", "#074d88"],
    waveTint: "255,255,255",
    islands: [
      { kind: "hills", x: 90, w: 120, h: 16, color: "#9dbccb" },
      { kind: "lighthouseIsle", x: 380, s: 1.05 },
    ],
    birds: 9,
    rays: 0.12,
    glint: 1,
    caustic: 0.4,
  },
  coral: {
    title: "CORAL REEF",
    sky: ["#25b3f0", "#7fdcff", "#e4fbff", "#fbfffe"],
    sun: { x: 440, y: 112, r: 42, color: "#fffbe0", glow: "255,250,220" },
    clouds: { far: 4, near: 2, tint: "#ffffff", shade: "#c4e7f4" },
    sea: ["#c4fbf3", "#5be3d6", "#22c2cf", "#109bc2", "#0b74a8"],
    waveTint: "255,255,255",
    islands: [{ kind: "sandbar", x: 150, s: 1 }, { kind: "hills", x: 450, w: 110, h: 14, color: "#9fcfd4" }],
    reef: true,
    birds: 2,
    rays: 0.16,
    glint: 1.1,
    caustic: 1,
  },
  squidbay: {
    title: "THE SQUID BAY",
    sky: ["#5b4fb8", "#c27ac9", "#ffc6c6", "#ffe8d6"],
    sun: { x: 300, y: 250, r: 54, color: "#ffe0b8", glow: "255,210,170" },
    clouds: { far: 4, near: 2, tint: "#ffe3ec", shade: "#b98ab8" },
    sea: ["#e8c3d6", "#9a8fd6", "#5d64b9", "#373f8f", "#22286a"],
    waveTint: "255,230,245",
    islands: [{ kind: "cliffs", color: "#4c3f6e" }, { kind: "cave", x: 270 }],
    props: [
      { kind: "rock", x: -0.55, z: 0.4, w: 96, h: 66, block: true },
      { kind: "rock", x: 0.5, z: 0.5, w: 100, h: 62, block: true },
      { kind: "rock", x: 0.02, z: 0.28, w: 84, h: 58, block: true },
    ],
    mist: 0.35,
    rays: 0.08,
    glint: 0.7,
    caustic: 0.3,
  },
  pirate: {
    title: "PIRATE WATERS",
    sky: ["#f08b52", "#ffc184", "#ffe7c4", "#fff6e6"],
    sun: { x: 430, y: 170, r: 50, color: "#fff0c4", glow: "255,225,170" },
    clouds: { far: 5, near: 2, tint: "#fff3e3", shade: "#e9b48e" },
    sea: ["#ffd9a8", "#5cc4cf", "#1b8db8", "#0d5f98", "#083f70"],
    waveTint: "255,245,225",
    islands: [{ kind: "ship", x: 120, s: 0.9 }, { kind: "ship", x: 410, s: 0.55, flip: true }, { kind: "hills", x: 280, w: 140, h: 14, color: "#c9a48f" }],
    floaters: "barrel",
    birds: 2,
    rays: 0.1,
    glint: 1,
    caustic: 0.4,
  },
  stormy: {
    title: "STORMY SEA",
    sky: ["#39465f", "#5c6b86", "#8492a8", "#a9b4c4"],
    clouds: { far: 7, near: 4, tint: "#9aa6ba", shade: "#56627a", faces: true, speed: 2.2 },
    sea: ["#9fb3be", "#58798c", "#38596f", "#233f55", "#152a3d"],
    waveTint: "235,245,255",
    islands: [{ kind: "hills", x: 420, w: 160, h: 18, color: "#56657a" }],
    swell: 12,
    rain: 0.7,
    lightning: { every: 6, color: "#fff8d0" },
    rays: 0,
    glint: 0.3,
    foam: 1.3,
  },
  deep: {
    title: "DEEP BLUE",
    sky: ["#1f6fd6", "#5aa8f0", "#b9e1ff", "#eaf6ff"],
    sun: { x: 120, y: 110, r: 36, color: "#ffffff", glow: "235,245,255" },
    clouds: { far: 4, near: 4, tint: "#ffffff", shade: "#b2cde6", big: true },
    sea: ["#7cc2ee", "#2a79cc", "#1450a6", "#0b3480", "#061f58"],
    waveTint: "220,240,255",
    islands: [],
    swell: 26,
    whales: true,
    rays: 0.14,
    glint: 0.8,
    foam: 1.2,
  },
  glacier: {
    title: "GLACIER SEA",
    sky: ["#7cc3f0", "#b8e2fa", "#e8f7ff", "#ffffff"],
    sun: { x: 130, y: 100, r: 30, color: "#ffffff", glow: "240,250,255" },
    clouds: { far: 4, near: 2, tint: "#ffffff", shade: "#cfe3f0" },
    sea: ["#c9eef8", "#6ac0dc", "#2f8dbb", "#15659a", "#0b466f"],
    waveTint: "255,255,255",
    islands: [{ kind: "glacier" }],
    props: [
      { kind: "iceberg", x: -0.62, z: 0.36, w: 116, h: 96, block: true },
      { kind: "floe", x: 0.62, z: 0.46, w: 116, h: 32, block: false, penguin: true },
      { kind: "iceberg", x: 0.42, z: 0.18, w: 96, h: 84, block: true },
    ],
    snow: 0.8,
    rays: 0.1,
    glint: 0.9,
    caustic: 0.3,
  },
  night: {
    title: "MOONLIT SEA",
    sky: ["#0a1638", "#182b62", "#2d4686", "#4a5f9c"],
    moon: { x: 400, y: 122, r: 40 },
    stars: 70,
    clouds: { far: 3, near: 2, tint: "#46578f", shade: "#26325e" },
    sea: ["#5568a8", "#24407e", "#142d62", "#0b1d45", "#06122e"],
    waveTint: "190,215,255",
    islands: [{ kind: "lighthouse", x: 92 }],
    plankton: true,
    dark: 0.48,
    beam: { x: 92, dy: -88 },
    rays: 0,
    glint: 0.6,
  },
  tempest: {
    title: "THE TEMPEST",
    sky: ["#1e2333", "#3b3f55", "#5f5670", "#8a6a74"],
    clouds: { far: 8, near: 5, tint: "#6b6f86", shade: "#2c3044", speed: 3.2, big: true },
    sea: ["#7f8a9a", "#3f5568", "#28394d", "#18263a", "#0c1626"],
    waveTint: "230,240,255",
    islands: [],
    swell: 22,
    rain: 1.2,
    lightning: { every: 3.2, color: "#fff4c0" },
    rays: 0,
    glint: 0.2,
    foam: 1.6,
  },
  abyss: {
    title: "ABYSS GATE",
    sky: ["#081a2e", "#0f3550", "#1d5a6e", "#3a8a8c"],
    stars: 30,
    clouds: { far: 3, near: 2, tint: "#1f4a5e", shade: "#0c2638" },
    sea: ["#4fb6a8", "#1f7f86", "#11505f", "#0a3345", "#051c2a"],
    waveTint: "170,255,240",
    islands: [{ kind: "vortex", x: 270 }, { kind: "arches" }],
    plankton: true,
    glowJellies: true,
    dark: 0.32,
    rays: 0.12,
    rayColor: "120,255,230",
    glint: 0.5,
  },
  final: {
    title: "LEVIATHAN WATERS",
    sky: ["#2a0f45", "#6b1f6e", "#d4477a", "#ff9a7a"],
    clouds: { far: 6, near: 4, tint: "#8a3f8a", shade: "#3c1a4c", speed: 2, big: true },
    sea: ["#ff9ab0", "#a24a9a", "#5a2a86", "#33185f", "#1a0b38"],
    waveTint: "255,215,240",
    islands: [{ kind: "leviathanShadow", x: 270 }],
    swell: 10,
    lightning: { every: 5, color: "#f3c6ff" },
    rays: 0.06,
    rayColor: "255,170,230",
    glint: 0.6,
  },
  fair: {
    title: "SPLASH FESTIVAL",
    sky: ["#46b8f5", "#9fdcff", "#ecfaff", "#fff8fd"],
    sun: { x: 440, y: 110, r: 38, color: "#fffbe6", glow: "255,250,225" },
    clouds: { far: 4, near: 2, tint: "#ffffff", shade: "#c6e2f4" },
    sea: ["#b9f1f8", "#55d0e6", "#22a8da", "#0d7cc0", "#085a98"],
    waveTint: "255,255,255",
    islands: [{ kind: "pier" }],
    bunting: true,
    rays: 0.12,
    glint: 1,
    caustic: 0.5,
  },
};
// 예전 이름 호환
const ALIAS = { peaceful: "clear", palm: "gull", rocky: "squidbay", waves: "deep", octopus: "squidbay", storm: "stormy", volcano: "pirate", ice: "glacier", pirateKing: "pirate", giantOctopus: "final" };

export function createScenes() {
  return {
    create(id, game) {
      return new Scene(SCENES[id] || SCENES[ALIAS[id]] || SCENES.clear, id, game);
    },
    menu(game) {
      return new MenuScene(game);
    },
    preview(id, w, h) {
      return previewCanvas(SCENES[id] || SCENES.clear, w, h);
    },
  };
}

/* ================================================================
 * 해역
 * ============================================================== */
class Scene {
  constructor(cfg, id, game) {
    this.cfg = cfg;
    this.id = id;
    this.game = game;
    this.rnd = seeded(hash(id) + 7);
    this.props = (cfg.props || []).map((p) => ({ ...p }));
    this.t = 0;
    this.build();
  }

  build() {
    const cfg = this.cfg;
    const r = this.rnd;
    this.cache = renderBack(cfg, this.game);
    const cl = cfg.clouds || { far: 0, near: 0 };
    const mk = (n, near) =>
      Array.from({ length: n }, () => {
        const sc = near ? 1 + r() * 0.5 : 0.5 + r() * 0.35;
        return {
          x: r() * (W + 300) - 150,
          y: near ? 60 + r() * (seaTop() - 200) : seaTop() - 90 - r() * 120,
          s: sc * (cl.big ? 1.25 : 1),
          v: (near ? 9 + r() * 7 : 3 + r() * 3) * (cl.speed || 1),
          sp: cloudSprite(Math.floor(r() * 1e6), cl.tint || "#ffffff", cl.shade || "#c9dff0", near, cl.faces && near && r() < 0.6),
          a: near ? 1 : 0.75,
        };
      });
    this.cloudsFar = mk(cl.far || 0, false);
    this.cloudsNear = mk(cl.near || 0, true);
    this.birds = Array.from({ length: cfg.birds || 0 }, (_, i) => ({ x: r() * W, y: 70 + r() * (seaTop() - 160), v: 16 + r() * 18, ph: r() * 6, s: 0.7 + r() * 0.6, flock: i % 3 }));
    // 파도 줄: 줄마다 파장 · 위상 · 속도가 다르다
    this.rows = Array.from({ length: 18 }, (_, i) => ({ ph: r() * 10, ph2: r() * 10, k: 0.022 + r() * 0.012, k2: 0.05 + r() * 0.03, v: 0.8 + r() * 0.9, amp: 0.8 + r() * 0.5, off: r() }));
    this.glints = Array.from({ length: 60 }, () => ({ x: r() * 2.6 - 1.3, z: Math.pow(r(), 0.8), ph: r() * 6, s: 0.6 + r() * 0.8 }));
    this.foam = Array.from({ length: 22 }, () => ({ x: r() * 2.6 - 1.3, z: r(), w: 0.6 + r() * 0.8, ph: r() * 6 }));
    this.floaters = cfg.floaters ? Array.from({ length: 4 }, (_, i) => ({ x: r() * 2 - 1, z: (i + r()) / 4, rot: r() * 6 })) : [];
    const n = cfg.rain ? Math.round(110 * cfg.rain) : cfg.snow ? Math.round(80 * cfg.snow) : 0;
    this.drops = Array.from({ length: n }, () => ({ x: r() * W, y: r() * H, v: 0.6 + r() * 0.6, ph: r() * 6 }));
    this.stars = Array.from({ length: cfg.stars || 0 }, () => ({ x: r() * W, y: r() * (seaTop() - 40), r: 0.6 + r() * 1.8, ph: r() * 6 }));
    this.plankton = cfg.plankton ? Array.from({ length: 70 }, () => ({ x: r() * 2.6 - 1.3, z: r(), ph: r() * 6, c: r() < 0.5 ? "120,255,240" : "150,200,255" })) : [];
    this.jellies = cfg.glowJellies ? Array.from({ length: 6 }, () => ({ x: r() * 2 - 1, z: 0.2 + r() * 0.8, ph: r() * 6 })) : [];
    this.flash = 0;
    this.nextBolt = 3 + r() * 3;
    this.bolt = null;
    this.vignette = null;
  }

  rebuild() {
    this.cache = renderBack(this.cfg, this.game);
    this.vignette = null;
  }

  waveAt(x, z, t) {
    const a = this.cfg.swell || 2.5;
    return (Math.sin(t * 1.3 + z * 7 + x * 2) + 0.4 * Math.sin(t * 2.1 - z * 11 + x * 3.3)) * a * (0.5 + z * 0.6);
  }

  update(dt, game) {
    this.t += dt;
    for (const c of this.cloudsFar.concat(this.cloudsNear)) {
      c.x += c.v * dt;
      if (c.x > W + 170) c.x = -170 - Math.random() * 60;
    }
    for (const b of this.birds) {
      b.x += b.v * dt;
      if (b.x > W + 30) {
        b.x = -30;
        b.y = 70 + Math.random() * (seaTop() - 160);
      }
    }
    const lt = this.cfg.lightning;
    if (lt) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = lt.every * (0.7 + Math.random() * 0.6);
        this.flash = 1;
        this.bolt = { pts: boltPts(60 + Math.random() * (W - 120)), t: 0.32 };
        if (game && game.audio) game.audio.play("zap");
      }
      this.flash = Math.max(0, this.flash - dt * 3);
      if (this.bolt) {
        this.bolt.t -= dt;
        if (this.bolt.t <= 0) this.bolt = null;
      }
    }
    for (const d of this.drops) {
      if (this.cfg.rain) {
        d.y += 950 * d.v * dt;
        d.x -= 200 * d.v * dt;
      } else {
        d.y += 55 * d.v * dt;
        d.x += Math.sin(d.ph + d.y * 0.02) * 22 * dt;
      }
      if (d.y > H) {
        d.y = -12;
        d.x = Math.random() * (W + 200);
      }
    }
  }

  /* ---------- Layer 1~3 ---------- */
  drawBack(ctx, t) {
    const cfg = this.cfg;
    ctx.drawImage(this.cache.canvas, 0, 0, W, H);
    if (this.stars.length) {
      for (const s of this.stars) {
        ctx.globalAlpha = 0.45 + 0.55 * Math.sin(t * 2 + s.ph);
        dot(ctx, s.x, s.y, s.r, "#fffbe0");
      }
      ctx.globalAlpha = 1;
    }
    if (cfg.sun) {
      // 천천히 도는 햇살
      ctx.save();
      ctx.translate(cfg.sun.x, cfg.sun.y);
      ctx.rotate(t * 0.05);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        ctx.fillStyle = linear(ctx, `ray${cfg.sun.glow}`, 0, cfg.sun.r, 0, cfg.sun.r * 4.2, [
          [0, `rgba(${cfg.sun.glow},0.16)`],
          [1, `rgba(${cfg.sun.glow},0)`],
        ]);
        ctx.beginPath();
        ctx.moveTo(-7, cfg.sun.r * 0.9);
        ctx.lineTo(0, cfg.sun.r * 4.2);
        ctx.lineTo(7, cfg.sun.r * 0.9);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const c of this.cloudsFar) drawCloud(ctx, c);
    if (this.bolt) drawBolt(ctx, this.bolt, this.cfg.lightning.color);
    for (const c of this.cloudsNear) drawCloud(ctx, c);
    for (const b of this.birds) drawGull(ctx, b.x, b.y, t * 7 + b.ph, b.s);
    if (cfg.beam) {
      const a = Math.sin(t * 0.8) * 0.9 + 0.3;
      ctx.save();
      ctx.translate(cfg.beam.x, seaTop() + cfg.beam.dy);
      ctx.rotate(a);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = linear(ctx, "beam", 0, 0, 460, 0, [
        [0, "rgba(255,240,180,0.5)"],
        [1, "rgba(255,240,180,0)"],
      ]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(460, -46);
      ctx.lineTo(460, 46);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawWater(ctx, t) {
    const cfg = this.cfg;
    const top = seaTop();
    // 물속 광선 (아래쪽 · 햇빛 방향으로 기울어짐)
    if (cfg.rays) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const col = cfg.rayColor || "200,250,255";
      for (let i = 0; i < 7; i++) {
        const x = ((i * 97 + t * 9) % (W + 200)) - 100;
        const sway = Math.sin(t * 0.6 + i * 1.7) * 18;
        const yTop = lerp(top + 40, NEAR_Y - 140, (i % 3) / 3);
        const w = 26 + (i % 3) * 16;
        ctx.globalAlpha = cfg.rays * (0.55 + 0.45 * Math.sin(t * 0.9 + i * 2.1));
        ctx.fillStyle = linear(ctx, `uray${col}|${yTop | 0}`, 0, yTop, 0, H, [
          [0, `rgba(${col},0)`],
          [0.25, `rgba(${col},0.9)`],
          [1, `rgba(${col},0)`],
        ]);
        ctx.beginPath();
        ctx.moveTo(x + sway, yTop);
        ctx.lineTo(x + w + sway, yTop);
        ctx.lineTo(x + w * 2.4 - 120, H);
        ctx.lineTo(x - 120 + w * 0.4, H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // 수면 아래 반짝 무늬 (얕은 바다)
    if (cfg.caustic) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(210,255,255,${0.07 * cfg.caustic})`;
      ctx.lineWidth = 2;
      for (let row = 0; row < 7; row++) {
        const z = 0.35 + row * 0.1;
        const p = project(0, z, 0);
        ctx.beginPath();
        for (let x = -20; x <= W + 20; x += 16) {
          const y = p.sy + Math.sin(x * 0.05 + t * 1.5 + row * 2) * 4 * p.s + Math.sin(x * 0.11 - t * 2 + row) * 3 * p.s;
          if (x === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // 깊은 물속을 지나가는 고래 그림자
    if (cfg.whales) {
      for (let i = 0; i < 2; i++) {
        const x = ((t * (14 + i * 6) + i * 300) % (W + 400)) - 200;
        const p = project(0, 0.35 + i * 0.3, 0);
        shadow(ctx, x, p.sy + 20, 90 * p.s, 22 * p.s, 0.22, "2,15,50");
      }
    }
    if (this.jellies.length) {
      for (const j of this.jellies) {
        const p = project(j.x + Math.sin(t * 0.3 + j.ph) * 0.1, j.z, 0);
        const a = 0.35 + 0.25 * Math.sin(t * 2 + j.ph);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a;
        shadow(ctx, p.sx, p.sy + 24 * p.s, 26 * p.s, 18 * p.s, 0.9, "90,255,220");
        ctx.restore();
      }
    }
    // 파도 줄 (먼 곳 → 가까운 곳)
    this.drawWaves(ctx, t);
    // 반짝임 · 야광 플랑크톤
    if (cfg.glint) {
      for (const g of this.glints) {
        const a = Math.sin(t * 2.6 + g.ph);
        if (a < 0.35) continue;
        const z = (g.z + t * 0.012) % 1.05;
        const p = project(g.x, z, 0);
        ctx.globalAlpha = (a - 0.35) * 1.4 * cfg.glint;
        sparkle(ctx, p.sx, p.sy - 2, (3 + 6 * p.s) * g.s, 1);
      }
      ctx.globalAlpha = 1;
    }
    for (const pl of this.plankton) {
      const z = (pl.z + t * 0.01) % 1.05;
      const p = project(pl.x, z, 0);
      const a = 0.4 + 0.6 * Math.sin(t * 2 + pl.ph);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = `rgba(${pl.c},1)`;
      circ(ctx, p.sx, p.sy, 1.2 + p.s * 2.2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 떠다니는 거품 (배가 앞으로 가는 느낌)
    for (const f of this.foam) {
      const z = (f.z + t * 0.035) % 1.1;
      const p = project(f.x, z, 0);
      ctx.globalAlpha = Math.min(1, z * 3) * 0.55 * (cfg.foam || 1);
      ell(ctx, p.sx, p.sy, 16 * p.s * f.w, 3.2 * p.s, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ell(ctx, p.sx + 12 * p.s, p.sy + 1, 7 * p.s * f.w, 2 * p.s, 0);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const fl of this.floaters) {
      const z = (fl.z + t * 0.02) % 1;
      const p = project(fl.x, z, Math.sin(t * 2 + fl.rot) * 3);
      drawBarrel(ctx, p.sx, p.sy, p.s, Math.sin(t + fl.rot) * 0.3);
    }
  }

  drawWaves(ctx, t) {
    const cfg = this.cfg;
    const tint = cfg.waveTint || "255,255,255";
    const N = this.rows.length;
    const swell = cfg.swell || 0;
    for (let i = 0; i < N; i++) {
      const R = this.rows[i];
      const zr = ((i + ((t * 0.07) % 1)) / N) % 1;
      const z = Math.pow(zr, 1.35) * 1.12;
      const p = project(0, z, 0);
      const s = p.s;
      const amp = (2.2 + s * 7 + swell * 0.25 * s) * R.amp;
      const k = R.k / s;
      const k2 = R.k2 / s;
      const ph = R.ph + t * R.v;
      const ph2 = R.ph2 - t * R.v * 0.6;
      const yOf = (x) => p.sy + Math.sin(x * k + ph) * amp + Math.sin(x * k2 + ph2) * amp * 0.45 + (swell ? Math.sin(x * 0.006 + t * 1.2 + z * 6) * swell * 0.5 * s : 0);
      const step = 10 + s * 6;
      const fade = Math.min(1, zr * 4);
      // 물결 밝은 면 (마루 위)
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += step) {
        const y = yOf(x);
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let x = W + 20; x >= -20; x -= step) ctx.lineTo(x, yOf(x) - amp * 0.9);
      ctx.closePath();
      ctx.fillStyle = `rgba(${tint},${0.07 * fade})`;
      ctx.fill();
      // 물결 그늘 (마루 아래)
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += step) {
        const y = yOf(x);
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let x = W + 20; x >= -20; x -= step) ctx.lineTo(x, yOf(x) + amp * 1.6);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,30,80,${0.09 * fade})`;
      ctx.fill();
      // 마루 선 (두께가 깊이에 따라)
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += step) {
        const y = yOf(x);
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 0.8 + s * 1.6;
      ctx.strokeStyle = `rgba(${tint},${(0.12 + s * 0.16) * fade})`;
      ctx.lineJoin = "round";
      ctx.stroke();
      // 높은 마루에만 흰 거품
      ctx.fillStyle = `rgba(255,255,255,${(0.35 + s * 0.3) * fade * (cfg.foam || 1)})`;
      for (let x = -20; x <= W + 20; x += step) {
        const v = Math.sin(x * k + ph) + Math.sin(x * k2 + ph2) * 0.45;
        if (v > 1.05) {
          const y = yOf(x);
          ell(ctx, x, y - 0.5, (3 + s * 7) * (v - 0.9), 1 + s * 1.6, 0);
          ctx.fill();
        }
      }
    }
  }

  drawProp(ctx, pr, t) {
    const p = project(pr.x, pr.z, 0);
    const s = p.s;
    // 물속에 잠긴 부분 그림자
    shadow(ctx, p.sx, p.sy + 8 * s, pr.w * 0.62 * s, 12 * s, 0.35, "2,20,50");
    ctx.save();
    ctx.translate(p.sx, p.sy + Math.sin(t * 1.2 + pr.x * 3) * (pr.kind === "floe" ? 2 : 0));
    ctx.scale(s, s);
    if (pr.kind === "rock") drawRock(ctx, pr.w, pr.h, this.cfg);
    else if (pr.kind === "iceberg") drawIceberg(ctx, pr.w, pr.h);
    else if (pr.kind === "floe") drawFloe(ctx, pr.w, pr.h, pr.penguin, t);
    ctx.restore();
    // 물가 거품
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + t * 0.6;
      ell(ctx, p.sx + Math.cos(a) * pr.w * 0.5 * s, p.sy + 2 + Math.sin(a) * 5 * s, (5 + (i % 3) * 3) * s, 2 * s);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  blockAt(x, y, zTarget) {
    for (const p of this.props) {
      if (!p.block || p.z <= zTarget + 0.004) continue;
      const pr = project(p.x, p.z, 0);
      const rx = p.w * 0.5 * pr.s;
      const ry = p.h * 0.5 * pr.s;
      const cy = pr.sy - ry;
      const dx = (x - pr.sx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) return p;
    }
    return null;
  }

  /* ---------- Layer 6 ---------- */
  drawFront(ctx, t, game) {
    const cfg = this.cfg;
    // 가까운 파도 (아래 양쪽 모서리)
    for (const side of [-1, 1]) {
      const bx = side < 0 ? 0 : W;
      ctx.beginPath();
      ctx.moveTo(bx, H + 10);
      for (let i = 0; i <= 10; i++) {
        const x = bx - side * i * 13;
        const y = H - 34 - Math.sin(t * 2.1 + i * 0.7) * 9 - (10 - i) * 7;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(bx - side * 130, H + 10);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, `fw${cfg.sea[3]}`, 0, H - 120, 0, H, [
        [0, alpha(lighten(cfg.sea[2], 0.25), 0.75)],
        [1, alpha(cfg.sea[4], 0.9)],
      ]);
      ctx.fill();
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const x = bx - side * i * 13;
        const y = H - 34 - Math.sin(t * 2.1 + i * 0.7) * 9 - (10 - i) * 7;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      stroke(ctx, "rgba(255,255,255,0.75)", 3);
    }
    if (cfg.rain) {
      ctx.strokeStyle = "rgba(220,235,255,0.5)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (const d of this.drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 9 * d.v, d.y + 28 * d.v);
      }
      ctx.stroke();
    }
    if (cfg.snow) {
      for (const d of this.drops) dot(ctx, d.x, d.y, 1.6 + d.v * 2.2, "rgba(255,255,255,0.92)");
    }
    if (cfg.mist) {
      ctx.fillStyle = linear(ctx, `mist${cfg.mist}`, 0, seaTop() - 40, 0, seaTop() + 160, [
        [0, "rgba(255,240,250,0)"],
        [0.4, `rgba(255,240,250,${cfg.mist})`],
        [1, "rgba(255,240,250,0)"],
      ]);
      ctx.fillRect(0, seaTop() - 40, W, 200);
    }
    if (cfg.bunting) drawBunting(ctx, t);
    if (cfg.dark && game && game.aim) {
      const ax = game.aim.x;
      const ay = game.aim.y;
      ctx.fillStyle = radialAt(ctx, ax, ay, cfg.dark);
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = linear(ctx, "lantern", 0, H - 340, 0, H, [
        [0, "rgba(255,220,150,0)"],
        [1, "rgba(255,220,150,0.18)"],
      ]);
      ctx.fillRect(0, H - 340, W, 340);
      ctx.restore();
    }
    if (this.flash > 0.01) {
      ctx.globalAlpha = this.flash * 0.4;
      ctx.fillStyle = cfg.lightning.color;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // 비네팅 (가장자리를 살짝 어둡게 → 가운데로 시선)
    if (!this.vignette || this.vignette.h !== H) {
      const c = document.createElement("canvas");
      c.width = 270;
      c.height = Math.round(H / 2);
      const v = c.getContext("2d");
      const g = v.createRadialGradient(135, c.height * 0.55, 60, 135, c.height * 0.55, c.height * 0.85);
      g.addColorStop(0, "rgba(0,10,30,0)");
      g.addColorStop(1, "rgba(0,10,30,0.32)");
      v.fillStyle = g;
      v.fillRect(0, 0, c.width, c.height);
      this.vignette = { c, h: H };
    }
    ctx.drawImage(this.vignette.c, 0, 0, W, H);
  }
}

function radialAt(ctx, x, y, a) {
  const g = ctx.createRadialGradient(x, y, 50, x, y, 330);
  g.addColorStop(0, "rgba(4,10,35,0)");
  g.addColorStop(1, `rgba(4,10,35,${a})`);
  return g;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* ================================================================
 * 캐시 배경 (하늘 · 먼 섬 · 바다 바탕)
 * ============================================================== */
function renderBack(cfg, game) {
  const scale = clamp((game && game.view ? game.view.scale : 1) * Math.min(2, window.devicePixelRatio || 1), 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const c = canvas.getContext("2d");
  c.scale(scale, scale);
  paintBack(c, cfg);
  return { canvas };
}

function paintBack(c, cfg) {
  const top = seaTop();
  const r = seeded(91);
  // 하늘
  const sky = c.createLinearGradient(0, 0, 0, top);
  sky.addColorStop(0, cfg.sky[0]);
  sky.addColorStop(0.45, cfg.sky[1]);
  sky.addColorStop(0.85, cfg.sky[2]);
  sky.addColorStop(1, cfg.sky[3]);
  c.fillStyle = sky;
  c.fillRect(0, 0, W, top + 2);
  if (cfg.sun) {
    const s = cfg.sun;
    const g = c.createRadialGradient(s.x, s.y, s.r * 0.4, s.x, s.y, s.r * 5);
    g.addColorStop(0, `rgba(${s.glow},0.95)`);
    g.addColorStop(0.25, `rgba(${s.glow},0.45)`);
    g.addColorStop(1, `rgba(${s.glow},0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, top);
    circ(c, s.x, s.y, s.r);
    const sg = c.createRadialGradient(s.x - s.r * 0.3, s.y - s.r * 0.3, 2, s.x, s.y, s.r);
    sg.addColorStop(0, "#ffffff");
    sg.addColorStop(1, s.color);
    c.fillStyle = sg;
    c.fill();
  }
  if (cfg.moon) {
    const m = cfg.moon;
    const g = c.createRadialGradient(m.x, m.y, m.r * 0.5, m.x, m.y, m.r * 4);
    g.addColorStop(0, "rgba(255,248,215,0.55)");
    g.addColorStop(1, "rgba(255,248,215,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, top);
    circ(c, m.x, m.y, m.r);
    const mg = c.createRadialGradient(m.x - 12, m.y - 12, 4, m.x, m.y, m.r);
    mg.addColorStop(0, "#fffdf0");
    mg.addColorStop(1, "#f0e2b0");
    c.fillStyle = mg;
    c.fill();
    for (const [dx, dy, rr] of [
      [-12, -8, 7],
      [10, 12, 5],
      [14, -14, 4],
    ]) {
      circ(c, m.x + dx, m.y + dy, rr);
      c.fillStyle = "rgba(210,190,130,0.45)";
      c.fill();
    }
  }
  // 수평선 아지랑이
  const haze = c.createLinearGradient(0, top - 70, 0, top + 4);
  haze.addColorStop(0, "rgba(255,255,255,0)");
  haze.addColorStop(1, alpha(cfg.sky[3], 0.85));
  c.fillStyle = haze;
  c.fillRect(0, top - 70, W, 74);
  // 먼 섬 (대기 원근 — 뒤에서 앞 순서)
  for (const isl of cfg.islands || []) drawIsland(c, isl, cfg, top);
  // 바다 바탕
  const sea = c.createLinearGradient(0, top, 0, H);
  sea.addColorStop(0, cfg.sea[0]);
  sea.addColorStop(0.08, cfg.sea[1]);
  sea.addColorStop(0.35, cfg.sea[2]);
  sea.addColorStop(0.7, cfg.sea[3]);
  sea.addColorStop(1, cfg.sea[4]);
  c.fillStyle = sea;
  c.fillRect(0, top, W, H - top);
  // 하늘 반사 띠 (수평선 근처 밝은 가로 줄)
  for (let i = 0; i < 26; i++) {
    const y = top + 2 + i * i * 0.42;
    c.globalAlpha = 0.22 * (1 - i / 26);
    c.fillStyle = "#ffffff";
    c.fillRect(r() * 60 - 30, y, W, 1 + i * 0.06);
  }
  c.globalAlpha = 1;
  // 섬 그림자 반사
  for (const isl of cfg.islands || []) reflectIsland(c, isl, cfg, top);
  // 해 · 달 반사 기둥
  const src = cfg.sun || cfg.moon;
  if (src) {
    for (let i = 0; i < 40; i++) {
      const y = top + 3 + Math.pow(i, 1.75) * 0.9;
      if (y > H) break;
      const w = 12 + i * 3.4;
      c.globalAlpha = 0.4 * (1 - i / 40);
      c.fillStyle = cfg.moon ? "#fff3c4" : "#ffffff";
      const jx = Math.sin(i * 1.9) * (6 + i * 0.6);
      rrect(c, src.x - w / 2 + jx, y, w, 1.6 + i * 0.12, 1);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  // 물속 깊이 얼룩 (구름 같은 어두운/밝은 덩어리)
  for (let i = 0; i < 14; i++) {
    const z = 0.25 + r() * 0.85;
    const p = project(r() * 2.4 - 1.2, z, 0);
    const rr = 70 + r() * 110;
    const dark = r() < 0.6;
    const g = c.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rr * p.s);
    g.addColorStop(0, dark ? "rgba(0,25,70,0.16)" : "rgba(200,250,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.save();
    c.translate(0, 0);
    c.fillRect(p.sx - rr, p.sy - rr * 0.4, rr * 2, rr * 0.8);
    c.restore();
  }
  if (cfg.reef) drawReef(c, top);
}

/* ---------------- 섬 · 실루엣 ---------------- */
function drawIsland(c, isl, cfg, top) {
  const r = seeded(Math.round((isl.x || 1) * 13));
  switch (isl.kind) {
    case "hills": {
      c.beginPath();
      c.moveTo(isl.x - isl.w / 2, top + 1);
      c.quadraticCurveTo(isl.x - isl.w * 0.2, top - isl.h * 1.8, isl.x, top - isl.h * 1.4);
      c.quadraticCurveTo(isl.x + isl.w * 0.25, top - isl.h * 2, isl.x + isl.w / 2, top + 1);
      c.closePath();
      c.fillStyle = mix(isl.color, cfg.sky[3], 0.35);
      c.fill();
      break;
    }
    case "tropic": {
      const s = isl.s || 1;
      c.save();
      c.translate(isl.x, top + 2);
      c.scale(s, s);
      // 모래
      c.beginPath();
      c.moveTo(-120, 0);
      c.quadraticCurveTo(-60, -22, 0, -24);
      c.quadraticCurveTo(70, -22, 120, 0);
      c.closePath();
      c.fillStyle = mix("#f6dca0", cfg.sky[3], 0.12);
      c.fill();
      // 언덕 (빛 + 그늘)
      c.beginPath();
      c.moveTo(-96, -10);
      c.quadraticCurveTo(-60, -66, -6, -64);
      c.quadraticCurveTo(52, -60, 90, -10);
      c.closePath();
      const hg = c.createLinearGradient(-96, -64, 90, -10);
      hg.addColorStop(0, mix(lighten(isl.color, 0.25), cfg.sky[3], 0.2));
      hg.addColorStop(1, mix(darken(isl.color, 0.25), cfg.sky[3], 0.2));
      c.fillStyle = hg;
      c.fill();
      // 바위
      for (const [x, y, rr] of [
        [72, -8, 9],
        [86, -4, 6],
        [-84, -6, 7],
      ]) {
        ell(c, x, y, rr, rr * 0.7);
        c.fillStyle = mix("#8a96a6", cfg.sky[3], 0.2);
        c.fill();
      }
      palmTree(c, -52, -40, 0.75, cfg, 0.1);
      palmTree(c, -10, -58, 0.95, cfg, -0.08);
      palmTree(c, 40, -44, 0.7, cfg, 0.18);
      // 작은 오두막
      c.fillStyle = mix("#c98a3c", cfg.sky[3], 0.15);
      c.beginPath();
      c.moveTo(14, -30);
      c.lineTo(30, -44);
      c.lineTo(46, -30);
      c.closePath();
      c.fill();
      c.fillStyle = mix("#ecc98c", cfg.sky[3], 0.15);
      c.fillRect(18, -30, 24, 14);
      c.fillStyle = mix("#7a5a32", cfg.sky[3], 0.15);
      c.fillRect(27, -24, 6, 8);
      c.restore();
      break;
    }
    case "sailboat": {
      c.save();
      c.translate(isl.x, top + 1);
      c.scale(isl.s, isl.s);
      c.fillStyle = mix("#ffffff", cfg.sky[3], 0.2);
      c.beginPath();
      c.moveTo(0, -4);
      c.lineTo(0, -44);
      c.lineTo(22, -8);
      c.closePath();
      c.fill();
      c.fillStyle = mix("#ff8a6a", cfg.sky[3], 0.3);
      c.beginPath();
      c.moveTo(-2, -8);
      c.lineTo(-2, -36);
      c.lineTo(-16, -8);
      c.closePath();
      c.fill();
      c.fillStyle = mix("#2d4f9e", cfg.sky[3], 0.3);
      c.fillRect(-18, -4, 40, 5);
      c.restore();
      break;
    }
    case "lighthouseIsle": {
      const s = isl.s || 1;
      c.save();
      c.translate(isl.x, top + 2);
      c.scale(s, s);
      c.beginPath();
      c.moveTo(-150, 0);
      c.lineTo(-120, -40);
      c.lineTo(-70, -70);
      c.lineTo(-10, -84);
      c.lineTo(60, -76);
      c.lineTo(120, -40);
      c.lineTo(150, 0);
      c.closePath();
      const g = c.createLinearGradient(0, -84, 0, 0);
      g.addColorStop(0, mix("#8ec27a", cfg.sky[3], 0.2));
      g.addColorStop(0.35, mix("#6b9a62", cfg.sky[3], 0.2));
      g.addColorStop(0.4, mix("#a4977f", cfg.sky[3], 0.2));
      g.addColorStop(1, mix("#7d715e", cfg.sky[3], 0.25));
      c.fillStyle = g;
      c.fill();
      // 등대
      c.fillStyle = "#f4efe6";
      c.beginPath();
      c.moveTo(-12, -80);
      c.lineTo(-8, -150);
      c.lineTo(8, -150);
      c.lineTo(12, -80);
      c.closePath();
      c.fill();
      c.fillStyle = "#e0474c";
      c.fillRect(-10, -126, 20, 10);
      c.fillRect(-11, -102, 22, 10);
      c.fillStyle = "#3b4a63";
      c.fillRect(-11, -160, 22, 10);
      circ(c, 0, -154, 6);
      c.fillStyle = "#fff4b0";
      c.fill();
      c.beginPath();
      c.moveTo(-13, -160);
      c.lineTo(0, -172);
      c.lineTo(13, -160);
      c.closePath();
      c.fillStyle = "#e0474c";
      c.fill();
      // 바위 위 갈매기
      for (const [x, y] of [
        [80, -48],
        [96, -40],
        [-90, -36],
      ]) {
        ell(c, x, y, 5, 3.4);
        c.fillStyle = "#ffffff";
        c.fill();
        circ(c, x + 4, y - 3, 2.4);
        c.fill();
      }
      c.restore();
      break;
    }
    case "sandbar": {
      c.save();
      c.translate(isl.x, top + 3);
      c.scale(isl.s, isl.s);
      c.beginPath();
      c.moveTo(-110, 0);
      c.quadraticCurveTo(-30, -14, 40, -12);
      c.quadraticCurveTo(90, -10, 120, 0);
      c.closePath();
      c.fillStyle = mix("#ffe8b5", cfg.sky[3], 0.1);
      c.fill();
      palmTree(c, -20, -12, 0.8, cfg, 0.25);
      palmTree(c, 20, -11, 0.62, cfg, -0.2);
      c.restore();
      break;
    }
    case "cliffs": {
      for (const side of [-1, 1]) {
        c.save();
        c.translate(side < 0 ? 0 : W, top + 4);
        c.scale(side < 0 ? 1 : -1, 1);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -240);
        c.lineTo(36, -228);
        c.lineTo(62, -190);
        c.lineTo(84, -176);
        c.lineTo(100, -130);
        c.lineTo(126, -96);
        c.lineTo(140, -40);
        c.lineTo(176, 0);
        c.closePath();
        const g = c.createLinearGradient(0, -240, 170, 0);
        g.addColorStop(0, lighten(isl.color, 0.12));
        g.addColorStop(1, darken(isl.color, 0.2));
        c.fillStyle = g;
        c.fill();
        c.fillStyle = alpha(lighten(isl.color, 0.35), 0.5);
        c.beginPath();
        c.moveTo(0, -240);
        c.lineTo(36, -228);
        c.lineTo(30, -170);
        c.lineTo(0, -160);
        c.fill();
        c.restore();
      }
      break;
    }
    case "cave": {
      c.save();
      c.translate(isl.x, top + 2);
      c.beginPath();
      c.moveTo(-90, 0);
      c.quadraticCurveTo(-80, -80, 0, -96);
      c.quadraticCurveTo(80, -80, 90, 0);
      c.closePath();
      c.fillStyle = "#3f3460";
      c.fill();
      c.beginPath();
      c.moveTo(-34, 0);
      c.quadraticCurveTo(-30, -44, 0, -48);
      c.quadraticCurveTo(30, -44, 34, 0);
      c.closePath();
      c.fillStyle = "#1c1630";
      c.fill();
      for (let i = 0; i < 5; i++) {
        circ(c, -18 + i * 9, -18 - (i % 2) * 8, 2);
        c.fillStyle = "rgba(255,180,230,0.7)";
        c.fill();
      }
      c.restore();
      break;
    }
    case "ship": {
      c.save();
      c.translate(isl.x, top + 2);
      c.scale(isl.flip ? -isl.s : isl.s, isl.s);
      const hull = mix("#5a3a22", cfg.sky[3], 0.3);
      c.fillStyle = hull;
      c.beginPath();
      c.moveTo(-70, -16);
      c.lineTo(70, -16);
      c.lineTo(54, 0);
      c.lineTo(-58, 0);
      c.closePath();
      c.fill();
      c.fillRect(-70, -24, 30, 8);
      c.fillStyle = mix("#3a2414", cfg.sky[3], 0.3);
      c.fillRect(-2, -110, 4, 94);
      c.fillRect(-42, -84, 3, 68);
      const sail = mix("#fff4e0", cfg.sky[3], 0.2);
      c.fillStyle = sail;
      for (const [x, y, w, h] of [
        [-30, -104, 60, 36],
        [-26, -64, 52, 30],
        [-60, -78, 36, 26],
      ]) {
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + w / 2, y + 8, x + w, y);
        c.lineTo(x + w - 2, y + h);
        c.quadraticCurveTo(x + w / 2, y + h + 6, x + 2, y + h);
        c.closePath();
        c.fill();
      }
      c.fillStyle = mix("#2b2d4a", cfg.sky[3], 0.25);
      c.beginPath();
      c.moveTo(2, -110);
      c.lineTo(26, -104);
      c.lineTo(2, -98);
      c.fill();
      c.restore();
      break;
    }
    case "glacier": {
      c.beginPath();
      c.moveTo(0, top + 2);
      let x = 0;
      while (x < W + 20) {
        const h = 36 + r() * 40;
        c.lineTo(x, top - h);
        x += 26 + r() * 30;
        c.lineTo(x, top - h + 10 + r() * 14);
      }
      c.lineTo(W, top + 2);
      c.closePath();
      const g = c.createLinearGradient(0, top - 80, 0, top);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, "#bfe3f4");
      c.fillStyle = g;
      c.fill();
      c.fillStyle = "rgba(120,190,230,0.35)";
      for (let i = 0; i < 16; i++) c.fillRect(r() * W, top - 60 + r() * 50, 2, 20 + r() * 20);
      break;
    }
    case "lighthouse": {
      c.save();
      c.translate(isl.x, top + 3);
      c.fillStyle = "#13204a";
      c.beginPath();
      c.moveTo(-100, 0);
      c.quadraticCurveTo(-40, -42, 10, -44);
      c.quadraticCurveTo(60, -40, 100, 0);
      c.fill();
      c.fillStyle = "#e9e4d6";
      c.beginPath();
      c.moveTo(-12, -40);
      c.lineTo(-8, -104);
      c.lineTo(8, -104);
      c.lineTo(12, -40);
      c.fill();
      c.fillStyle = "#d84a4f";
      c.fillRect(-10, -80, 20, 9);
      c.fillRect(-11, -58, 22, 9);
      const g = c.createRadialGradient(0, -112, 2, 0, -112, 30);
      g.addColorStop(0, "rgba(255,245,180,1)");
      g.addColorStop(1, "rgba(255,245,180,0)");
      c.fillStyle = g;
      c.fillRect(-30, -142, 60, 60);
      c.restore();
      break;
    }
    case "vortex": {
      c.save();
      c.translate(isl.x, top + 6);
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.ellipse(0, 0, 140 - i * 22, 16 - i * 2.2, 0, 0, TAU);
        c.lineWidth = 3;
        c.strokeStyle = `rgba(120,255,230,${0.12 + i * 0.07})`;
        c.stroke();
      }
      const g = c.createRadialGradient(0, -10, 0, 0, -10, 90);
      g.addColorStop(0, "rgba(140,255,235,0.6)");
      g.addColorStop(1, "rgba(140,255,235,0)");
      c.fillStyle = g;
      c.fillRect(-90, -100, 180, 110);
      c.restore();
      break;
    }
    case "arches": {
      for (const side of [-1, 1]) {
        c.save();
        c.translate(side < 0 ? 40 : W - 40, top + 4);
        c.scale(side, 1);
        c.beginPath();
        c.moveTo(-50, 0);
        c.quadraticCurveTo(-40, -150, 40, -170);
        c.quadraticCurveTo(70, -160, 60, -120);
        c.quadraticCurveTo(10, -110, 20, 0);
        c.closePath();
        c.fillStyle = "#0c2a3a";
        c.fill();
        for (let i = 0; i < 6; i++) {
          circ(c, -20 + i * 10, -40 - i * 18, 3);
          c.fillStyle = "rgba(120,255,230,0.75)";
          c.fill();
        }
        c.restore();
      }
      break;
    }
    case "leviathanShadow": {
      c.save();
      c.translate(isl.x, top + 4);
      c.fillStyle = "rgba(40,10,60,0.85)";
      for (const [x, h, w] of [
        [-150, 90, 50],
        [-60, 150, 64],
        [70, 120, 56],
        [160, 70, 40],
      ]) {
        c.beginPath();
        c.moveTo(x - w, 0);
        c.quadraticCurveTo(x - w * 0.6, -h, x, -h);
        c.quadraticCurveTo(x + w * 0.6, -h, x + w, 0);
        c.quadraticCurveTo(x, -h * 0.55, x - w, 0);
        c.fill();
      }
      c.beginPath();
      c.moveTo(-24, -150);
      c.lineTo(-40, -186);
      c.lineTo(-10, -160);
      c.lineTo(4, -192);
      c.lineTo(14, -156);
      c.fill();
      for (const sx of [-12, 6]) {
        circ(c, -60 + sx, -126, 5);
        c.fillStyle = "rgba(255,120,200,0.9)";
        c.fill();
        c.fillStyle = "rgba(40,10,60,0.85)";
      }
      c.restore();
      break;
    }
    case "pier": {
      const y = top + 4;
      c.fillStyle = "#a8743f";
      c.fillRect(0, y - 28, W, 10);
      for (let x = 10; x < W; x += 38) {
        c.fillStyle = "#8a5a2b";
        c.fillRect(x, y - 18, 6, 20);
      }
      const tents = [
        [70, "#ff6b8b"],
        [200, "#4fc3f7"],
        [330, "#ffd54f"],
        [460, "#66d39a"],
      ];
      for (const [x, col] of tents) {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(x - 48, y - 28);
        c.lineTo(x, y - 92);
        c.lineTo(x + 48, y - 28);
        c.closePath();
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.9)";
        c.beginPath();
        c.moveTo(x - 16, y - 28);
        c.lineTo(x, y - 92);
        c.lineTo(x + 16, y - 28);
        c.closePath();
        c.fill();
        c.fillStyle = "rgba(0,0,0,0.12)";
        c.beginPath();
        c.moveTo(x, y - 92);
        c.lineTo(x + 48, y - 28);
        c.lineTo(x + 16, y - 28);
        c.closePath();
        c.fill();
      }
      break;
    }
    default:
      break;
  }
}

function reflectIsland(c, isl, cfg, top) {
  if (!["tropic", "lighthouseIsle", "ship", "cave", "sandbar"].includes(isl.kind)) return;
  c.save();
  c.beginPath();
  c.rect(0, top + 1, W, 70);
  c.clip();
  c.globalAlpha = 0.22;
  // 수평선을 기준으로 뒤집고 납작하게 (물에 비친 섬)
  c.translate(0, top + 2);
  c.scale(1, -0.55);
  c.translate(0, -(top + 2));
  drawIsland(c, isl, { ...cfg, sky: cfg.sky.map((x) => mix(x, cfg.sea[1], 0.5)) }, top);
  c.restore();
  c.globalAlpha = 1;
}

function palmTree(c, x, y, s, cfg, lean = 0) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.rotate(lean);
  const trunk = mix("#9a6b45", cfg.sky[3], 0.12);
  c.beginPath();
  c.moveTo(-4, 0);
  c.quadraticCurveTo(6, -40, 2, -84);
  c.lineTo(9, -84);
  c.quadraticCurveTo(13, -40, 5, 0);
  c.closePath();
  c.fillStyle = trunk;
  c.fill();
  c.strokeStyle = mix("#6d4a2c", cfg.sky[3], 0.12);
  c.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    c.beginPath();
    c.moveTo(0 + i * 0.3, -10 - i * 9);
    c.lineTo(8 + i * 0.3, -12 - i * 9);
    c.stroke();
  }
  const leaf = mix("#2f9c54", cfg.sky[3], 0.15);
  const leafLight = mix("#55c46f", cfg.sky[3], 0.15);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.52;
    const L = 52 + (i % 2) * 8;
    const ex = 5 + Math.cos(a) * L;
    const ey = -84 + Math.sin(a) * L * 0.55 + 18;
    c.beginPath();
    c.moveTo(5, -84);
    c.quadraticCurveTo(5 + Math.cos(a) * L * 0.5, -84 + Math.sin(a) * L * 0.5 - 16, ex, ey);
    c.quadraticCurveTo(5 + Math.cos(a) * L * 0.45, -84 + Math.sin(a) * L * 0.3, 5, -80);
    c.fillStyle = i % 2 ? leaf : leafLight;
    c.fill();
  }
  for (const [dx, dy] of [
    [0, -80],
    [8, -78],
    [4, -74],
  ]) {
    circ(c, dx + 2, dy, 4);
    c.fillStyle = mix("#7b4a2a", cfg.sky[3], 0.12);
    c.fill();
  }
  c.restore();
}

function drawReef(c, top) {
  // 수면 아래로 비치는 산호 · 모래 (얕은 바다)
  const r = seeded(5);
  const cols = ["#ff7aa8", "#ffb067", "#ff8f7a", "#c58cff", "#ffd36e"];
  for (let i = 0; i < 26; i++) {
    const z = 0.2 + r() * 0.9;
    const p = project(r() * 2.6 - 1.3, z, -30);
    const s = p.s;
    c.globalAlpha = 0.18 + z * 0.12;
    if (r() < 0.35) {
      ell(c, p.sx, p.sy + 18 * s, 50 * s, 12 * s);
      c.fillStyle = "#fff2c6";
      c.fill();
      continue;
    }
    const col = cols[Math.floor(r() * cols.length)];
    c.fillStyle = col;
    if (r() < 0.5) {
      // 가지 산호
      c.strokeStyle = col;
      c.lineCap = "round";
      c.lineWidth = 5 * s;
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.moveTo(p.sx, p.sy + 20 * s);
        c.quadraticCurveTo(p.sx + (k - 1.5) * 10 * s, p.sy, p.sx + (k - 1.5) * 16 * s, p.sy - 14 * s);
        c.stroke();
      }
    } else {
      // 뇌 산호
      ell(c, p.sx, p.sy + 12 * s, 22 * s, 12 * s);
      c.fill();
    }
  }
  c.globalAlpha = 1;
}

/* ---------------- 구름 (입체 스프라이트) ---------------- */
const CLOUD_CACHE = new Map();
function cloudSprite(seed, tint, shade, near, face) {
  const key = `${seed}|${tint}|${shade}|${near}|${face}`;
  if (CLOUD_CACHE.has(key)) return CLOUD_CACHE.get(key);
  const r = seeded(seed);
  const w = 220;
  const h = 120;
  const sc = 2;
  const cv = document.createElement("canvas");
  cv.width = w * sc;
  cv.height = h * sc;
  const c = cv.getContext("2d");
  c.scale(sc, sc);
  const puffs = [];
  const n = 6 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    puffs.push([30 + k * 160 + (r() - 0.5) * 16, 76 - Math.sin(k * Math.PI) * (22 + r() * 22) + (r() - 0.5) * 8, 20 + Math.sin(k * Math.PI) * (16 + r() * 12)]);
  }
  const path = () => {
    c.beginPath();
    for (const [x, y, rr] of puffs) {
      c.moveTo(x + rr, y);
      c.arc(x, y, rr, 0, TAU);
    }
    c.rect(26, 74, 168, 22);
  };
  c.save();
  c.shadowColor = alpha(shade, 0.6);
  c.shadowBlur = 10;
  path();
  const g = c.createLinearGradient(0, 20, 0, 100);
  g.addColorStop(0, lighten(tint, 0.2));
  g.addColorStop(0.55, tint);
  g.addColorStop(1, shade);
  c.fillStyle = g;
  c.fill();
  c.restore();
  // 윗면 하이라이트
  c.globalAlpha = 0.55;
  for (const [x, y, rr] of puffs) {
    c.beginPath();
    c.arc(x - rr * 0.25, y - rr * 0.3, rr * 0.55, 0, TAU);
    c.fillStyle = "#ffffff";
    c.fill();
  }
  c.globalAlpha = 1;
  if (face) {
    c.strokeStyle = "rgba(40,50,80,0.65)";
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.beginPath();
    c.arc(96, 66, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    c.moveTo(129, 66);
    c.arc(124, 66, 5, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();
    c.beginPath();
    c.arc(110, 80, 4, 0, TAU);
    c.stroke();
  }
  const sp = { cv, w, h };
  if (CLOUD_CACHE.size > 60) CLOUD_CACHE.clear();
  CLOUD_CACHE.set(key, sp);
  return sp;
}

function drawCloud(ctx, c) {
  ctx.globalAlpha = c.a;
  ctx.drawImage(c.sp.cv, c.x - (c.sp.w * c.s) / 2, c.y - (c.sp.h * c.s) / 2, c.sp.w * c.s, c.sp.h * c.s);
  ctx.globalAlpha = 1;
}

function drawGull(ctx, x, y, ph, s = 1) {
  const f = Math.sin(ph);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-14, -f * 6);
  ctx.quadraticCurveTo(-6, -9 + f * 5, 0, 0);
  ctx.quadraticCurveTo(6, -9 + f * 5, 14, -f * 6);
  ctx.quadraticCurveTo(6, -4 + f * 3, 0, 3);
  ctx.quadraticCurveTo(-6, -4 + f * 3, -14, -f * 6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(60,80,110,0.5)";
  ctx.stroke();
  dot(ctx, -13, -f * 6, 1.6, "#3b4a63");
  dot(ctx, 13, -f * 6, 1.6, "#3b4a63");
  ctx.restore();
}

function boltPts(x) {
  const pts = [x, 30];
  let cx = x;
  for (let y = 60; y < seaTop(); y += 30) {
    cx += (Math.random() - 0.5) * 54;
    pts.push(cx, y);
  }
  return pts;
}

function drawBolt(ctx, b, color) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(b.pts[0], b.pts[1]);
    for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1]);
  };
  ctx.globalAlpha = Math.min(1, b.t * 4);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  path();
  stroke(ctx, color, 6);
  ctx.restore();
  path();
  stroke(ctx, "#ffffff", 2);
  ctx.globalAlpha = 1;
}

/* ---------------- 바다 위 소품 ---------------- */
function drawRock(ctx, w, h, cfg) {
  const base = cfg && cfg.title === "THE SQUID BAY" ? "#7a6f96" : "#8e9aab";
  ctx.beginPath();
  ctx.moveTo(-w / 2, 4);
  ctx.quadraticCurveTo(-w / 2 - 6, -h * 0.65, -w * 0.18, -h * 0.95);
  ctx.quadraticCurveTo(w * 0.05, -h * 1.1, w * 0.3, -h * 0.82);
  ctx.quadraticCurveTo(w / 2 + 6, -h * 0.4, w / 2 - 2, 4);
  ctx.closePath();
  fill(ctx, base, -w * 0.1, -h * 0.5, w * 0.55, h * 0.6, 3);
  ctx.beginPath();
  ctx.moveTo(-w * 0.32, -h * 0.72);
  ctx.quadraticCurveTo(-w * 0.12, -h * 1.0, w * 0.18, -h * 0.86);
  ctx.quadraticCurveTo(0, -h * 0.66, -w * 0.32, -h * 0.72);
  ctx.fillStyle = alpha(lighten(base, 0.5), 0.7);
  ctx.fill();
  // 이끼 · 따개비
  ell(ctx, w * 0.12, -h * 0.9, w * 0.18, 5);
  ctx.fillStyle = "#6fae6a";
  ctx.fill();
  for (const [x, y] of [
    [-w * 0.3, -h * 0.25],
    [-w * 0.22, -h * 0.18],
    [w * 0.28, -h * 0.3],
  ]) {
    circ(ctx, x, y, 3);
    flat(ctx, "#e6e1d2", 1, "#9a9384");
  }
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillRect(-w / 2, -3, w, 5);
}

function drawIceberg(ctx, w, h) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 4);
  ctx.lineTo(-w * 0.36, -h * 0.58);
  ctx.lineTo(-w * 0.08, -h);
  ctx.lineTo(w * 0.22, -h * 0.78);
  ctx.lineTo(w * 0.34, -h * 0.5);
  ctx.lineTo(w / 2, 4);
  ctx.closePath();
  fill(ctx, "#f4fbff", 0, -h * 0.5, w * 0.5, h * 0.6, 3);
  ctx.beginPath();
  ctx.moveTo(-w * 0.08, -h);
  ctx.lineTo(w * 0.22, -h * 0.78);
  ctx.lineTo(w * 0.34, -h * 0.5);
  ctx.lineTo(w / 2, 4);
  ctx.lineTo(w * 0.04, 4);
  ctx.closePath();
  ctx.fillStyle = "rgba(120,190,230,0.45)";
  ctx.fill();
  gloss(ctx, -w * 0.2, -h * 0.6, 7, 16, 0.8, 0.2);
  ctx.fillStyle = "rgba(160,220,245,0.6)";
  ctx.fillRect(-w / 2, -2, w, 6);
}

function drawFloe(ctx, w, h, penguin, t) {
  ell(ctx, 0, -h * 0.3, w / 2, h * 0.5);
  fill(ctx, "#f4fbff", 0, -h * 0.4, w / 2, h * 0.5, 3);
  if (!penguin) return;
  ctx.save();
  ctx.translate(0, -h * 0.45);
  ctx.rotate(Math.sin(t * 3) * 0.1);
  ell(ctx, 0, -26, 15, 23);
  fill(ctx, "#2d3550", 0, -26, 15, 23, 2.6);
  ell(ctx, 0, -22, 10, 17);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  dot(ctx, -4, -38, 2.6, "#1a1f33");
  dot(ctx, 4, -38, 2.6, "#1a1f33");
  dot(ctx, -3.4, -38.8, 0.9, "#ffffff");
  dot(ctx, 4.6, -38.8, 0.9, "#ffffff");
  ctx.beginPath();
  ctx.moveTo(-3.5, -33);
  ctx.lineTo(0, -29);
  ctx.lineTo(3.5, -33);
  ctx.fillStyle = "#ff9800";
  ctx.fill();
  ctx.save();
  ctx.translate(13, -28);
  ctx.rotate(-0.8 + Math.sin(t * 8) * 0.5);
  ell(ctx, 6, 0, 8, 3.6);
  fill(ctx, "#2d3550", 6, 0, 8, 3.6, 2);
  ctx.restore();
  ctx.restore();
}

function drawBarrel(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(rot);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-30, -40, 60, 40);
  ctx.clip();
  rrect(ctx, -16, -26, 32, 30, 8);
  fill(ctx, "#a06a3a", 0, -12, 16, 15, 2.4);
  for (const yy of [-20, -6]) {
    ctx.beginPath();
    ctx.moveTo(-16, yy);
    ctx.lineTo(16, yy);
    stroke(ctx, "#5e6b82", 3);
  }
  ctx.restore();
  ctx.restore();
}

function drawBunting(ctx, t) {
  const cols = ["#ff6b8b", "#ffd54f", "#4fc3f7", "#66d39a", "#b388ff"];
  for (const row of [92, 120]) {
    ctx.beginPath();
    ctx.moveTo(-10, row);
    ctx.quadraticCurveTo(W / 2, row + 40, W + 10, row);
    stroke(ctx, "rgba(255,255,255,0.9)", 2);
    for (let i = 0; i < 12; i++) {
      const k = i / 11;
      const x = lerp(-10, W + 10, k);
      const y = row + Math.sin(k * Math.PI) * 20 + 2;
      ctx.beginPath();
      ctx.moveTo(x - 11, y);
      ctx.lineTo(x + 11, y);
      ctx.lineTo(x, y + 20 + Math.sin(t * 4 + i) * 2);
      ctx.closePath();
      ctx.fillStyle = cols[(i + (row === 120 ? 2 : 0)) % cols.length];
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 11, y);
      ctx.lineTo(x, y + 20 + Math.sin(t * 4 + i) * 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/* ---------------- 지도용 미리보기 ---------------- */
function previewCanvas(cfg, w, h) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d");
  const s = w / W;
  c.save();
  c.scale(s, s);
  c.translate(0, -(seaTop() - (h / s) * 0.55));
  paintBack(c, cfg);
  c.restore();
  return cv;
}

/* ================================================================
 * 살아 있는 메인 메뉴
 * ============================================================== */
class MenuScene {
  constructor(game) {
    this.game = game;
    this.scene = new Scene(SCENES.clear, "menu", game);
    this.t = 0;
    this.jump = 2.5;
  }
  rebuild() {
    this.scene.rebuild();
  }
  update(dt) {
    this.t += dt;
    this.scene.update(dt, null);
    this.jump -= dt;
    if (this.jump < -1.7) this.jump = 4 + Math.random() * 3;
  }
  draw(ctx) {
    const t = this.t;
    const sc = this.scene;
    sc.drawBack(ctx, t);
    sc.drawWater(ctx, t);
    const art = this.game.content.art;
    art.menuActors(ctx, t, this.jump, this.game);
    sc.drawFront(ctx, t, null);
  }
}

export { drawRock, drawIceberg, drawFloe, palmTree };
