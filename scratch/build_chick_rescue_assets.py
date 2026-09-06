"""Process Chick Rescue HQ assets."""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(
    os.path.expanduser("~"),
    ".cursor",
    "projects",
    "c-Users-COM-Projects-today-game",
    "assets",
)
DST = os.path.join(ROOT, "games", "chick-rescue", "assets")
THUMB_HUB = os.path.join(ROOT, "assets", "thumbs", "chick-rescue.png")


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def remove_soft_bg(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 235 and g > 235 and b > 235:
                px[x, y] = (r, g, b, 0)
            elif abs(r - g) < 12 and abs(g - b) < 12 and r > 90:
                px[x, y] = (r, g, b, 0)
    return img


def fit_square(img: Image.Image, size: int) -> Image.Image:
    img = remove_soft_bg(img)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    iw, ih = img.size
    scale = min((size * 0.88) / iw, (size * 0.88) / ih)
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, size - nh - int(size * 0.06)), resized)
    return canvas


def make_lava_tile(size: int = 128) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(size):
        for x in range(size):
            t = (x + y * 1.7) / size
            r = int(255 * (0.55 + 0.35 * abs((t % 1) - 0.5)))
            g = int(90 + 40 * (1 - t))
            b = int(20 + 15 * t)
            d.point((x, y), (r, g, b, 255))
    glow = img.filter(ImageFilter.GaussianBlur(2))
    return Image.blend(img, glow, 0.35)


def make_water_tile(size: int = 128) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for y in range(size):
        for x in range(size):
            wave = abs(((x * 0.12 + y * 0.08) % 1) - 0.5)
            r = int(70 + wave * 40)
            g = int(170 + wave * 50)
            b = int(240 + wave * 15)
            d.point((x, y), (r, g, b, 230))
    return img


def main() -> None:
    ensure_dir(DST)
    ensure_dir(os.path.dirname(THUMB_HUB))

    chick_src = os.path.join(SRC, "chick-rescue-chick.png")
    thumb_src = os.path.join(SRC, "chick-rescue-thumb.png")
    bg_src = os.path.join(SRC, "chick-rescue-bg.png")

    if os.path.exists(chick_src):
        fit_square(Image.open(chick_src), 256).save(os.path.join(DST, "chick.png"), "PNG")
        print("chick.png")

    if os.path.exists(thumb_src):
        thumb = Image.open(thumb_src).convert("RGB")
        thumb.resize((512, 512), Image.Resampling.LANCZOS).save(
            os.path.join(DST, "thumb.png"), quality=92
        )
        thumb.resize((512, 512), Image.Resampling.LANCZOS).save(THUMB_HUB, quality=92)
        print("thumb + hub")

    if os.path.exists(bg_src):
        bg = Image.open(bg_src).convert("RGB")
        bg.resize((960, 540), Image.Resampling.LANCZOS).save(
            os.path.join(DST, "bg.jpg"), quality=90
        )
        print("bg.jpg")

    make_water_tile().save(os.path.join(DST, "water_tile.png"), "PNG")
    make_lava_tile().save(os.path.join(DST, "lava_tile.png"), "PNG")
    print("tiles done")


if __name__ == "__main__":
    main()
