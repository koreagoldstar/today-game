from PIL import Image
import os

SRC = r"C:\Users\COM\.cursor\projects\c-Users-COM-Projects-today-game\assets"


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
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_magenta(r, g, b):
                if g < 100:
                    px[x, y] = (0, 0, 0, 0)
                    continue
                strength = min(1.0, (145 - g) / 70.0)
                na = int(a * (1.0 - strength))
                px[x, y] = (0, 0, 0, 0) if na < 18 else (r, max(g, 40), min(b, 200), na)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and is_magenta(r, g, b) and g < 130:
                px[x, y] = (0, 0, 0, 0)
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 24:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    pad = 4
    box = (max(0, minx - pad), max(0, miny - pad), min(w, maxx + 1 + pad), min(h, maxy + 1 + pad))
    cropped = im.crop(box)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cropped.save(out_path, optimize=True)
    print(out_path, cropped.size)


pairs = [
    ("hq-pinball-ball.png", r"C:\Users\COM\Projects\today game\games\pinball\assets\ball.png"),
    ("hq-pinball-bumper.png", r"C:\Users\COM\Projects\today game\games\pinball\assets\bumper.png"),
    ("hq-odd-coral.png", r"C:\Users\COM\Projects\today game\games\odd-even\assets\orb-coral.png"),
    ("hq-odd-cyan.png", r"C:\Users\COM\Projects\today game\games\odd-even\assets\orb-cyan.png"),
    ("hq-marble-blue.png", r"C:\Users\COM\Projects\today game\games\alggagi\assets\marble-blue.png"),
    ("hq-marble-red.png", r"C:\Users\COM\Projects\today game\games\alggagi\assets\marble-red.png"),
]
for src, dst in pairs:
    chroma_crop(os.path.join(SRC, src), dst)
