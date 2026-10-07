/*
 * 제트스키 썬더 레이스 — 스프라이트 캐시
 * 벡터 그림을 한 번만 오프스크린 캔버스에 그려 두고(물 반사 포함) 크기만 바꿔 찍는다.
 * 그림 단위: units = 1m 당 단위 수 (소품 100 = cm, 풍경 10 = dm)
 */
import * as P from "./props.js?v=2";
import * as S from "./scenery.js?v=2";
import * as S2 from "./scenery2.js?v=2";
import * as S3 from "./scenery3.js?v=2";
import * as S4 from "./scenery4.js?v=2";

/** box: [x0, y0, x1, y1] (그림 단위, y0 위쪽 음수) · ppm: 캐시 해상도(px/m) · refl: 물 반사 높이 비율 */
const DEFS = {
  pylon: { units: 100, box: [-82, -262, 82, 20], ppm: 120, refl: 0.35, draw: (c, o) => P.pylon(c, o) },
  rock: { units: 100, box: [-112, -156, 112, 18], ppm: 110, refl: 0.3, draw: (c, o) => P.rock(c, o) },
  rockBig: { units: 100, box: [-210, -292, 210, 30], ppm: 70, refl: 0.3, draw: (c, o) => P.rock(c, { ...o, big: true }) },
  log: { units: 100, box: [-284, -112, 284, 16], ppm: 90, refl: 0.4, draw: (c) => P.log(c) },
  barrel: { units: 100, box: [-60, -126, 60, 14], ppm: 130, refl: 0.4, draw: (c, o) => P.barrel(c, o) },
  crate: { units: 100, box: [-72, -116, 72, 14], ppm: 120, refl: 0.4, draw: (c) => P.crate(c) },
  ramp: { units: 100, box: [-310, -186, 310, 20], ppm: 80, refl: 0.25, draw: (c) => P.ramp(c) },
  bigRamp: { units: 100, box: [-350, -256, 350, 20], ppm: 70, refl: 0.25, draw: (c) => P.ramp(c, { big: true }) },
  orb: { units: 100, box: [-54, -162, 54, 14], ppm: 130, refl: 0, draw: (c) => P.orb(c) },
  signShort: { units: 100, box: [-182, -342, 182, 12], ppm: 70, refl: 0.3, draw: (c) => P.signShort(c) },
  coral: { units: 100, box: [-112, -190, 112, 14], ppm: 100, refl: 0.3, draw: (c, o) => P.coral(c, o) },
  // 게이트는 코스 폭에 맞춰 box 를 넘겨받는다 (o.span · o.box)
  gate: { units: 100, box: [-1400, -940, 1400, 30], ppm: 34, refl: 0.18, draw: (c, o) => P.gate(c, o.kind, o.span) },
  wreckMast: { units: 100, box: [-80, -272, 120, 18], ppm: 90, refl: 0.3, draw: (c) => S2.wreckMast(c) },
  reefHead: { units: 100, box: [-122, -140, 122, 18], ppm: 100, refl: 0.3, variants: 3, draw: (c, o) => S2.reefHead(c, o) },
  lavaRock: { units: 100, box: [-120, -142, 120, 18], ppm: 100, refl: 0.3, variants: 3, draw: (c, o) => S3.lavaRock(c, o) },
  beaconRock: { units: 100, box: [-116, -226, 116, 18], ppm: 100, refl: 0.3, draw: (c, o) => S3.beaconRock(c, o) },
  lanterns: { units: 100, box: [-200, -150, 200, 10], ppm: 60, refl: 0.4, variants: 3, draw: (c, o) => S3.lanterns(c, o) },
  iceberg: { units: 100, box: [-372, -456, 372, 40], ppm: 48, refl: 0.3, variants: 3, draw: (c, o) => S4.iceberg(c, o) },
  iceChunk: { units: 100, box: [-134, -124, 134, 22], ppm: 100, refl: 0.3, variants: 3, draw: (c, o) => S4.iceChunk(c, o) },
  coralArch: { units: 100, box: [-1400, -940, 1400, 40], ppm: 30, refl: 0.15, draw: (c, o) => S4.coralArch(c, o.span) },
  // 풍경 (dm)
  glacier: { units: 10, box: [-400, -214, 400, 8], ppm: 11, refl: 0.35, variants: 3, draw: (c, o) => S4.glacier(c, o) },
  penguinFloe: { units: 10, box: [-110, -62, 110, 6], ppm: 26, refl: 0.4, variants: 3, draw: (c, o) => S4.penguinFloe(c, o) },
  coralSpire: { units: 10, box: [-170, -320, 170, 8], ppm: 13, refl: 0.3, variants: 4, draw: (c, o) => S4.coralSpire(c, o) },
  grandstand: { units: 10, box: [-272, -232, 272, 6], ppm: 13, refl: 0.35, variants: 2, draw: (c, o) => S4.grandstand(c, o) },
  seaStack: { units: 10, box: [-110, -230, 110, 8], ppm: 16, refl: 0.35, variants: 3, draw: (c, o) => S3.seaStack(c, o) },
  lifeguard: { units: 10, box: [-46, -148, 60, 6], ppm: 22, refl: 0.4, draw: (c) => S3.lifeguard(c) },
  stormCliff: { units: 10, box: [-360, -260, 360, 8], ppm: 11, refl: 0.3, variants: 3, draw: (c, o) => S3.stormCliff(c, o) },
  stormLighthouse: { units: 10, box: [-90, -296, 90, 6], ppm: 14, refl: 0.35, draw: (c) => S3.stormLighthouse(c) },
  volcanoIsle: { units: 10, box: [-330, -420, 330, 8], ppm: 11, refl: 0.35, variants: 3, draw: (c, o) => S3.volcanoIsle(c, o) },
  nightIsle: { units: 10, box: [-330, -220, 330, 6], ppm: 12, refl: 0.4, variants: 3, draw: (c, o) => S3.nightIsle(c, o) },
  atoll: { units: 10, box: [-320, -100, 320, 8], ppm: 12, refl: 0.4, variants: 3, draw: (c, o) => S2.atoll(c, o) },
  reefRock: { units: 10, box: [-78, -72, 78, 6], ppm: 24, refl: 0.4, variants: 4, draw: (c, o) => S2.reefRock(c, o) },
  glassBoat: { units: 10, box: [-74, -50, 86, 6], ppm: 22, refl: 0.45, draw: (c) => S2.glassBoat(c) },
  divePlatform: { units: 10, box: [-46, -62, 52, 6], ppm: 26, refl: 0.45, draw: (c) => S2.divePlatform(c) },
  waterfallCliff: { units: 10, box: [-270, -340, 270, 8], ppm: 11, refl: 0.35, variants: 2, draw: (c, o) => S2.waterfallCliff(c, o) },
  pirateShip: { units: 10, box: [-205, -345, 222, 8], ppm: 13, refl: 0.35, variants: 2, draw: (c, o) => S2.pirateShip(c, o) },
  pier: { units: 10, box: [-156, -116, 156, 6], ppm: 18, refl: 0.4, variants: 2, draw: (c, o) => S2.pier(c, o) },
  treasureIsle: { units: 10, box: [-156, -92, 156, 6], ppm: 16, refl: 0.4, draw: (c, o) => S2.treasureIsle(c, o) },
  fortTower: { units: 10, box: [-76, -206, 76, 6], ppm: 16, refl: 0.4, draw: (c) => S2.fortTower(c) },
  isleBig: { units: 10, box: [-420, -240, 420, 10], ppm: 11, refl: 0.45, variants: 4, draw: (c, o) => S.isleBig(c, o) },
  isleTall: { units: 10, box: [-240, -300, 240, 8], ppm: 11, refl: 0.4, variants: 3, draw: (c, o) => S.isleTall(c, o) },
  sandbar: { units: 10, box: [-115, -106, 115, 8], ppm: 22, refl: 0.4, variants: 4, draw: (c, o) => S.sandbar(c, o) },
  palmTuft: { units: 10, box: [-62, -112, 62, 6], ppm: 28, refl: 0.3, variants: 3, draw: (c, o) => S.palmTuft(c, o) },
  rockIsle: { units: 10, box: [-62, -52, 62, 6], ppm: 26, refl: 0.4, variants: 3, draw: (c, o) => S.rockIsle(c, o) },
  sailboat: { units: 10, box: [-46, -100, 46, 6], ppm: 26, refl: 0.5, variants: 2, draw: (c, o) => S.sailboat(c, o) },
  yacht: { units: 10, box: [-102, -84, 106, 6], ppm: 20, refl: 0.45, draw: (c) => S.yacht(c) },
  lighthouse: { units: 10, box: [-62, -218, 62, 6], ppm: 18, refl: 0.4, draw: (c) => S.lighthouse(c) },
  hutPier: { units: 10, box: [-126, -112, 126, 6], ppm: 16, refl: 0.45, draw: (c) => S.hutPier(c) },
};

export function registerSprite(type, def) {
  DEFS[type] = def;
}

export function hasSprite(type) {
  return Boolean(DEFS[type]);
}

const CACHE = new Map();
let TINT = "";
let TINTV = null;
/** 테마 색조: [색, 세기] — 밤에는 푸르고 어둡게, 화산은 붉게 (레이서는 그대로 밝게 둔다) */
export function setSpriteTint(t) {
  TINTV = t || null;
  TINT = t ? `${t[0]}|${t[1]}` : "";
}
let pixelBoost = 1;
/** 화면 실제 해상도에 맞춰 캐시 해상도를 키운다 (선명하게) */
export function setSpriteBoost(px) {
  const b = Math.max(0.75, Math.min(1.6, px));
  if (Math.abs(b - pixelBoost) > 0.05) {
    pixelBoost = b;
    CACHE.clear();
  }
}

/** 물 반사가 붙은 캐시 스프라이트 */
export function getSprite(type, o = {}) {
  const def = DEFS[type];
  if (!def) return null;
  const variant = def.variants ? Math.floor((o.v || 0) * def.variants) % def.variants : 0;
  const key = `${type}|${variant}|${o.kind || ""}|${o.span || 0}|${o.color || ""}|${TINT}`;
  let sp = CACHE.get(key);
  if (sp) return sp;
  const box = o.box || def.box;
  const ppm = (o.ppm || def.ppm) * pixelBoost;
  const k = ppm / def.units; // px / 그림 단위
  const w = Math.ceil((box[2] - box[0]) * k) + 4;
  const above = Math.ceil(-box[1] * k) + 2;
  const below = Math.ceil(box[3] * k) + 2;
  const reflH = Math.ceil(above * (def.refl || 0));
  const h = above + Math.max(below, reflH) + 2;
  const cv = document.createElement("canvas");
  cv.width = Math.max(2, w);
  cv.height = Math.max(2, h);
  const ctx = cv.getContext("2d");
  const ax = -box[0] * k + 2;
  const ay = above;
  const drawOnce = (c) => {
    c.save();
    c.translate(ax, ay);
    c.scale(k, k);
    def.draw(c, { ...o, v: def.variants ? (variant + 0.5) / def.variants : o.v });
    c.restore();
  };
  if (reflH > 0) {
    // 물 반사: 아래로 뒤집어 흐리게 → 아래로 갈수록 사라진다
    const tmp = document.createElement("canvas");
    tmp.width = cv.width;
    tmp.height = ay + 2;
    const tc = tmp.getContext("2d");
    drawOnce(tc);
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.translate(0, ay * 2);
    ctx.scale(1, -1);
    ctx.drawImage(tmp, 0, 0, tmp.width, ay, 0, 0, tmp.width, ay);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const g = ctx.createLinearGradient(0, ay, 0, ay + reflH);
    g.addColorStop(0, "rgba(0,0,0,0.15)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, ay, cv.width, cv.height - ay);
    ctx.restore();
    // 반사 위 물결 줄
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(120,200,240,0.25)";
    for (let y = ay + 3; y < ay + reflH; y += 5) ctx.fillRect(0, y, cv.width, 2);
    ctx.restore();
  }
  drawOnce(ctx);
  if (TINTV) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = TINTV[1];
    ctx.fillStyle = TINTV[0];
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.restore();
  }
  sp = { cv, ax, ay, ppm, units: def.units };
  CACHE.set(key, sp);
  return sp;
}

/**
 * 화면에 찍기: (sx, sy) = 물 표면 기준점, s = px/m
 * clipY: 그 아래(앞 파도에 가려진 부분)는 그리지 않는다
 */
export function drawSprite(ctx, sp, sx, sy, s, opts = {}) {
  const f = s / sp.ppm;
  const w = sp.cv.width * f;
  const h = sp.cv.height * f;
  const x = sx - sp.ax * f;
  const y = sy - sp.ay * f;
  if (x > 560 || x + w < -20 || y > 1300) return;
  if (opts.flip) {
    ctx.save();
    ctx.translate(sx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-sx, 0);
    ctx.drawImage(sp.cv, x, y, w, h);
    ctx.restore();
  } else ctx.drawImage(sp.cv, x, y, w, h);
}
