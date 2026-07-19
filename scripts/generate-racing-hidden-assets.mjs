import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function writePng(path, w, h, rgba) {
  mkdirSync(dirname(path), { recursive: true });
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    const row = y * (w * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

function makeBuffer(w, h) {
  return Buffer.alloc(w * h * 4, 0);
}

function setPx(buf, w, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  if (i < 0 || i >= buf.length) return;
  if (a === 255) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = 255;
    return;
  }
  const oa = buf[i + 3] / 255;
  const na = a / 255;
  const out = na + oa * (1 - na);
  if (out <= 0) return;
  buf[i] = Math.round((r * na + buf[i] * oa * (1 - na)) / out);
  buf[i + 1] = Math.round((g * na + buf[i + 1] * oa * (1 - na)) / out);
  buf[i + 2] = Math.round((b * na + buf[i + 2] * oa * (1 - na)) / out);
  buf[i + 3] = Math.round(out * 255);
}

function fillRect(buf, w, h, x0, y0, rw, rh, r, g, b, a = 255) {
  for (let y = y0; y < y0 + rh; y += 1) {
    for (let x = x0; x < x0 + rw; x += 1) setPx(buf, w, x, y, r, g, b, a);
  }
}

function fillCircle(buf, w, cx, cy, rad, r, g, b, a = 255) {
  const rr = rad * rad;
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y += 1) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rr) setPx(buf, w, x, y, r, g, b, a);
    }
  }
}

function fillRoundRect(buf, w, x0, y0, rw, rh, rad, r, g, b, a = 255) {
  fillRect(buf, w, 0, x0 + rad, y0, rw - rad * 2, rh, r, g, b, a);
  fillRect(buf, w, 0, x0, y0 + rad, rw, rh - rad * 2, r, g, b, a);
  fillCircle(buf, w, x0 + rad, y0 + rad, rad, r, g, b, a);
  fillCircle(buf, w, x0 + rw - rad, y0 + rad, rad, r, g, b, a);
  fillCircle(buf, w, x0 + rad, y0 + rh - rad, rad, r, g, b, a);
  fillCircle(buf, w, x0 + rw - rad, y0 + rh - rad, rad, r, g, b, a);
}

function drawCar(buf, w, h, bodyR, bodyG, bodyB, accentR, accentG, accentB) {
  fillRoundRect(buf, w, 10, 28, 52, 34, 10, bodyR, bodyG, bodyB);
  fillRoundRect(buf, w, 16, 14, 40, 22, 8, accentR, accentG, accentB, 220);
  fillCircle(buf, w, 20, 64, 9, 40, 40, 40);
  fillCircle(buf, w, 52, 64, 9, 40, 40, 40);
  fillCircle(buf, w, 20, 64, 5, 200, 200, 200);
  fillCircle(buf, w, 52, 64, 5, 200, 200, 200);
  fillCircle(buf, w, 31, 8, 8, 255, 220, 80);
  fillCircle(buf, w, 31, 8, 4, 50, 40, 20);
}

function drawTree(buf, w, h) {
  fillRoundRect(buf, w, 18, 48, 12, 20, 4, 120, 80, 50);
  fillCircle(buf, w, 24, 34, 18, 72, 168, 88);
  fillCircle(buf, w, 16, 28, 12, 96, 190, 110);
  fillCircle(buf, w, 32, 26, 11, 88, 180, 100);
}

function drawTeddy(buf, w) {
  fillCircle(buf, w, 14, 14, 7, 180, 130, 90);
  fillCircle(buf, w, 34, 14, 7, 180, 130, 90);
  fillCircle(buf, w, 24, 26, 14, 200, 150, 105);
  fillCircle(buf, w, 18, 24, 2, 40, 30, 25);
  fillCircle(buf, w, 30, 24, 2, 40, 30, 25);
}

function drawClock(buf, w) {
  fillCircle(buf, w, 24, 24, 18, 255, 245, 220);
  fillCircle(buf, w, 24, 24, 15, 255, 255, 255);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    setPx(buf, w, 24 + Math.round(Math.cos(a) * 12), 24 + Math.round(Math.sin(a) * 12), 80, 80, 90);
  }
  setPx(buf, w, 24, 14, 50, 50, 60);
  setPx(buf, w, 30, 24, 50, 50, 60);
}

function drawKey(buf, w) {
  fillCircle(buf, w, 14, 14, 8, 255, 210, 60);
  fillRect(buf, w, 0, 22, 18, 18, 6, 255, 210, 60);
  fillRect(buf, w, 0, 34, 22, 4, 8, 255, 210, 60);
  fillRect(buf, w, 0, 30, 26, 4, 6, 255, 210, 60);
}

function drawSock(buf, w) {
  fillRoundRect(buf, w, 10, 8, 18, 28, 6, 255, 140, 170);
  fillRoundRect(buf, w, 8, 30, 22, 14, 6, 255, 140, 170);
}

function drawMug(buf, w) {
  fillRoundRect(buf, w, 12, 14, 22, 24, 5, 255, 255, 255);
  fillRoundRect(buf, w, 14, 16, 18, 10, 4, 255, 180, 120);
  fillCircle(buf, w, 38, 24, 7, 255, 255, 255, 0);
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    setPx(buf, w, 38 + Math.round(Math.cos(a) * 7), 24 + Math.round(Math.sin(a) * 7), 200, 210, 220);
  }
}

function drawBook(buf, w) {
  fillRoundRect(buf, w, 10, 10, 28, 32, 3, 100, 160, 220);
  fillRect(buf, w, 0, 12, 12, 3, 28, 255, 255, 255, 180);
  fillRect(buf, w, 0, 12, 20, 3, 28, 255, 255, 255, 180);
}

function drawGlasses(buf, w) {
  fillCircle(buf, w, 16, 24, 9, 60, 60, 70, 0);
  for (let a = 0; a < Math.PI * 2; a += 0.15) {
    setPx(buf, w, 16 + Math.round(Math.cos(a) * 9), 24 + Math.round(Math.sin(a) * 9), 60, 60, 70);
  }
  fillCircle(buf, w, 32, 24, 9, 60, 60, 70, 0);
  for (let a = 0; a < Math.PI * 2; a += 0.15) {
    setPx(buf, w, 32 + Math.round(Math.cos(a) * 9), 24 + Math.round(Math.sin(a) * 9), 60, 60, 70);
  }
  fillRect(buf, w, 0, 24, 22, 8, 2, 60, 60, 70);
}

function drawStar(buf, w) {
  const cx = 24;
  const cy = 24;
  for (let i = 0; i < 5; i += 1) {
    const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const a2 = a1 + Math.PI / 5;
    const x1 = cx + Math.cos(a1) * 16;
    const y1 = cy + Math.sin(a1) * 16;
    const x2 = cx + Math.cos(a2) * 7;
    const y2 = cy + Math.sin(a2) * 7;
    for (let t = 0; t <= 1; t += 0.05) {
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      fillCircle(buf, w, x, y, 3, 255, 210, 60);
    }
  }
}

function drawPlant(buf, w) {
  fillRoundRect(buf, w, 16, 34, 16, 12, 3, 220, 140, 90);
  fillCircle(buf, w, 24, 26, 14, 90, 180, 100);
  fillCircle(buf, w, 16, 22, 8, 110, 200, 110);
  fillCircle(buf, w, 32, 20, 7, 100, 190, 105);
}

const iconDrawers = {
  teddy: drawTeddy,
  clock: drawClock,
  key: drawKey,
  sock: drawSock,
  mug: drawMug,
  book: drawBook,
  glasses: drawGlasses,
  star: drawStar,
  plant: drawPlant,
};

function makeIcon(name) {
  const w = 48;
  const h = 48;
  const buf = makeBuffer(w, h);
  iconDrawers[name](buf, w);
  return { w, h, buf };
}

function blit(dst, dw, dh, src, sw, sh, dx, dy, scale = 1) {
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const si = (y * sw + x) * 4;
      const a = src[si + 3];
      if (a === 0) continue;
      const tx = dx + Math.floor(x * scale);
      const ty = dy + Math.floor(y * scale);
      const ts = Math.max(1, Math.floor(scale));
      for (let oy = 0; oy < ts; oy += 1) {
        for (let ox = 0; ox < ts; ox += 1) {
          setPx(dst, dw, tx + ox, ty + oy, src[si], src[si + 1], src[si + 2], a);
        }
      }
    }
  }
}

function drawBedroomScene() {
  const w = 390;
  const h = 580;
  const buf = makeBuffer(w, h);
  fillRect(buf, w, h, 0, 0, w, h, 255, 244, 232);
  fillRect(buf, w, h, 0, 0, w, 180, 255, 220, 200);
  fillRect(buf, w, h, 0, 380, w, 200, 230, 200, 170);
  fillRoundRect(buf, w, 40, 300, 310, 120, 16, 255, 180, 200);
  fillRoundRect(buf, w, 60, 280, 270, 40, 12, 255, 210, 225);
  fillRoundRect(buf, w, 250, 120, 120, 140, 10, 200, 230, 255, 180);
  fillRoundRect(buf, w, 30, 200, 140, 90, 8, 210, 170, 130);
  fillRect(buf, w, h, 30, 288, 140, 8, 180, 140, 100);

  const placements = [
    ["clock", 0.08, 0.1],
    ["mug", 0.3, 0.38],
    ["glasses", 0.33, 0.34],
    ["book", 0.38, 0.4],
    ["plant", 0.84, 0.3],
    ["key", 0.78, 0.46],
    ["teddy", 0.68, 0.5],
    ["sock", 0.22, 0.78],
  ];

  for (const [name, nx, ny] of placements) {
    const icon = makeIcon(name);
    blit(buf, w, h, icon.buf, icon.w, icon.h, Math.floor(nx * w - 24), Math.floor(ny * h - 24), 1.1);
  }
  return { w, h, buf };
}

function drawPicnicScene() {
  const w = 390;
  const h = 580;
  const buf = makeBuffer(w, h);
  fillRect(buf, w, h, 0, 0, w, h, 180, 230, 170);
  fillCircle(buf, w, 80, 90, 50, 255, 255, 255, 120);
  fillCircle(buf, w, 300, 70, 40, 255, 255, 255, 100);
  fillRoundRect(buf, w, 60, 360, 270, 120, 20, 255, 230, 190);
  fillRoundRect(buf, w, 90, 330, 210, 80, 16, 255, 150, 170);
  fillRoundRect(buf, w, 280, 300, 70, 55, 8, 200, 140, 90);

  const placements = [
    ["star", 0.48, 0.52],
    ["key", 0.64, 0.45],
    ["mug", 0.34, 0.55],
    ["book", 0.44, 0.6],
    ["glasses", 0.54, 0.5],
    ["sock", 0.18, 0.68],
    ["plant", 0.82, 0.36],
    ["teddy", 0.4, 0.48],
  ];

  for (const [name, nx, ny] of placements) {
    const icon = makeIcon(name);
    blit(buf, w, h, icon.buf, icon.w, icon.h, Math.floor(nx * w - 24), Math.floor(ny * h - 24), 1.1);
  }
  return { w, h, buf };
}

const racingDir = join(root, "games", "racing", "assets");
const hiddenDir = join(root, "games", "hidden", "assets");
const iconsDir = join(hiddenDir, "icons");

const player = makeBuffer(72, 96);
drawCar(player, 72, 96, 255, 210, 60, 255, 245, 200);
writePng(join(racingDir, "player.png"), 72, 96, player);

const red = makeBuffer(64, 88);
drawCar(red, 64, 88, 230, 70, 80, 255, 180, 180);
writePng(join(racingDir, "car_red.png"), 64, 88, red);

const blue = makeBuffer(64, 88);
drawCar(blue, 64, 88, 70, 130, 230, 180, 210, 255);
writePng(join(racingDir, "car_blue.png"), 64, 88, blue);

const tree = makeBuffer(48, 72);
drawTree(tree, 48, 72);
writePng(join(racingDir, "tree.png"), 48, 72, tree);

for (const name of Object.keys(iconDrawers)) {
  const icon = makeIcon(name);
  writePng(join(iconsDir, `${name}.png`), icon.w, icon.h, icon.buf);
}

const scene1 = drawBedroomScene();
writePng(join(hiddenDir, "scene1.png"), scene1.w, scene1.h, scene1.buf);

const scene2 = drawPicnicScene();
writePng(join(hiddenDir, "scene2.png"), scene2.w, scene2.h, scene2.buf);

console.log("Generated racing + hidden game assets.");
