from PIL import Image
import os

SRC = r"C:\Users\COM\.cursor\projects\c-Users-COM-Projects-today-game\assets"
DST = r"C:\Users\COM\Projects\today game\games\jump-run\assets"
THUMB = r"C:\Users\COM\Projects\today game\assets\thumbs"
os.makedirs(DST, exist_ok=True)


def is_magenta(r, g, b):
    if r > 185 and b > 175 and g < 145 and (r + b) > g * 2.1:
        return True
    if r > 210 and b > 200 and g < 160 and abs(r - b) < 90:
        return True
    if r > 200 and b > 150 and g < 90:
        return True
    return False


def chroma_crop(path, out_path):
    im = Image.open(path).convert("RGBA")
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_magenta(r, g, b):
                # Soft fringe when near object colors
                if g < 100:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                strength = min(1.0, (145 - g) / 70.0)
                na = int(a * (1.0 - strength))
                if na < 18:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                px[x, y] = (r, max(g, 40), min(b, 200), na)

            r, g, b, a = px[x, y]
            if a > 24:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)

    # Cleanup leftover magenta fringe
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and is_magenta(r, g, b) and g < 130:
                px[x, y] = (0, 0, 0, 0)

    # Recompute bounds
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 24:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)

    if maxx <= minx or maxy <= miny:
        im.save(out_path)
        print("no crop", out_path)
        return

    pad = 6
    box = (
        max(0, minx - pad),
        max(0, miny - pad),
        min(w, maxx + 1 + pad),
        min(h, maxy + 1 + pad),
    )
    cropped = im.crop(box)
    cropped.save(out_path, optimize=True)
    print(out_path, cropped.size)


pairs = [
    ("jump-hero-raw.png", "hero.png"),
    ("jump-platform-raw.png", "platform.png"),
    ("jump-coin-raw.png", "coin.png"),
    ("jump-spike-raw.png", "spike.png"),
    ("jump-cloud-raw.png", "cloud.png"),
]
for src, dst in pairs:
    chroma_crop(os.path.join(SRC, src), os.path.join(DST, dst))

thumb = Image.open(os.path.join(SRC, "jump-thumb-raw.png")).convert("RGBA")
thumb.save(os.path.join(DST, "thumb.png"), optimize=True)
thumb.save(os.path.join(THUMB, "jump-run.png"), optimize=True)
print("thumb ok", thumb.size)
