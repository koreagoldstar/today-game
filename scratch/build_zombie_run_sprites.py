"""
Process HQ Zombie Run sprite sheets:
- white/black background removal
- split into 4 equal frames
- normalize each frame to fixed canvas (512x512)
- output transparent PNGs for the game
"""
from __future__ import annotations

import os
import shutil
from PIL import Image, ImageChops, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(
    os.path.expanduser("~"),
    ".cursor",
    "projects",
    "c-Users-COM-Projects-today-game",
    "assets",
)
DST_DIR = os.path.join(ROOT, "games", "zombie-run", "assets")
THUMB_HUB = os.path.join(ROOT, "assets", "thumbs", "zombie-run.png")

SPRITE_FRAMES = 4
FRAME_SIZE = 512  # each frame normalized to 512x512

SHEETS = {
    "hq_hero_chick.png": "hero_chick.png",
    "hq_hero_rabbit.png": "hero_rabbit.png",
    "hq_hero_bear.png": "hero_bear.png",
    "hq_hero_bird.png": "hero_bird.png",
    "hq_zombie.png": "zombie.png",
    "hq_zombie_mutant.png": "zombie_mutant.png",
    "hq_tank.png": "tank.png",
    "hq_chopper.png": "chopper.png",
    "hq_boss_sheet.png": "boss.png",
}

SINGLE = {}


def remove_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue

            # pure / near white
            if r > 235 and g > 235 and b > 235:
                px[x, y] = (r, g, b, 0)
                continue

            # checkerboard / gray backdrop
            if abs(r - g) < 12 and abs(g - b) < 12 and r > 90:
                px[x, y] = (r, g, b, 0)
                continue

            # leftover black matte
            if r < 18 and g < 18 and b < 18:
                px[x, y] = (r, g, b, 0)

    # soften jagged edges
    alpha = img.split()[3]
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.6))
    img.putalpha(alpha)
    return img


def trim_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def center_on_canvas(img: Image.Image, size: int) -> Image.Image:
    img = trim_transparent(img)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    iw, ih = img.size
    scale = min((size * 0.88) / iw, (size * 0.92) / ih)
    nw = max(1, int(iw * scale))
    nh = max(1, int(ih * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (size - nw) // 2
    oy = size - nh - int(size * 0.04)  # feet near bottom
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def build_sheet(src_path: str, dst_path: str, frames: int = SPRITE_FRAMES) -> None:
    raw = Image.open(src_path)
    raw = remove_background(raw)
    fw = raw.width // frames
    fh = raw.height

    frames_img = []
    for i in range(frames):
        frame = raw.crop((i * fw, 0, (i + 1) * fw, fh))
        frames_img.append(center_on_canvas(frame, FRAME_SIZE))

    out_w = FRAME_SIZE * frames
    sheet = Image.new("RGBA", (out_w, FRAME_SIZE), (0, 0, 0, 0))
    for i, frame in enumerate(frames_img):
        sheet.paste(frame, (i * FRAME_SIZE, 0), frame)

    sheet.save(dst_path, "PNG")
    print(f"sheet {dst_path} -> {sheet.size}")


def build_single(src_path: str, dst_path: str, size: int = 768) -> None:
    raw = remove_background(Image.open(src_path))
    out = center_on_canvas(raw, size)
    out.save(dst_path, "PNG")
    print(f"single {dst_path} -> {out.size}")


def build_thumb(sheet_path: str, thumb_path: str) -> None:
    sheet = Image.open(sheet_path)
    frame = sheet.crop((0, 0, FRAME_SIZE, FRAME_SIZE))
    frame.resize((256, 256), Image.Resampling.LANCZOS).save(thumb_path, "PNG")


def main() -> None:
    os.makedirs(DST_DIR, exist_ok=True)

    for src_name, dst_name in SHEETS.items():
        src = os.path.join(SRC_DIR, src_name)
        if not os.path.exists(src):
            print(f"skip missing: {src_name}")
            continue
        build_sheet(src, os.path.join(DST_DIR, dst_name))

    for src_name, dst_name in SINGLE.items():
        src = os.path.join(SRC_DIR, src_name)
        if not os.path.exists(src):
            raise FileNotFoundError(f"Missing source asset: {src}")
        build_single(src, os.path.join(DST_DIR, dst_name))

    build_thumb(os.path.join(DST_DIR, "hero_chick.png"), os.path.join(DST_DIR, "thumb.png"))
    for key in ("hero_chick", "hero_rabbit", "hero_bear", "hero_bird"):
        sheet = Image.open(os.path.join(DST_DIR, f"{key}.png"))
        preview = sheet.crop((0, 0, FRAME_SIZE, FRAME_SIZE)).resize((128, 128), Image.Resampling.LANCZOS)
        preview.save(os.path.join(DST_DIR, f"preview_{key}.png"), "PNG")
    os.makedirs(os.path.dirname(THUMB_HUB), exist_ok=True)
    shutil.copy2(os.path.join(DST_DIR, "thumb.png"), THUMB_HUB)
    print("done")


if __name__ == "__main__":
    main()
