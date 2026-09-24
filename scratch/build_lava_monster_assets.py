"""Process HQ Lava Monster assets — heroes, enemies, items, maps."""
from __future__ import annotations

import os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(
    os.path.expanduser("~"),
    ".cursor",
    "projects",
    "c-Users-COM-Projects-today-game",
    "assets",
)
DST_DIR = os.path.join(ROOT, "games", "lava-monster", "assets")
THUMB_HUB = os.path.join(ROOT, "assets", "thumbs", "lava-monster.png")
FRAMES = 4
FRAME_H = 512


def remove_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 232 and g > 232 and b > 232:
                px[x, y] = (r, g, b, 0)
            elif abs(r - g) < 14 and abs(g - b) < 14 and r > 85:
                px[x, y] = (r, g, b, 0)
            elif r < 20 and g < 20 and b < 20:
                px[x, y] = (r, g, b, 0)
    alpha = img.split()[3].filter(ImageFilter.GaussianBlur(radius=0.55))
    img.putalpha(alpha)
    return img


def trim_transparent(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def fit_frame(img: Image.Image, fw: int, fh: int) -> Image.Image:
    img = trim_transparent(img)
    canvas = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    iw, ih = img.size
    scale = min((fw * 0.9) / iw, (fh * 0.9) / ih)
    nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (fw - nw) // 2
    oy = fh - nh - int(fh * 0.035)
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def build_walk_sheet(src_name: str, dst_name: str, frame_w: int = 512) -> None:
    src = os.path.join(SRC_DIR, src_name)
    if not os.path.exists(src):
        print(f"skip missing: {src_name}")
        return
    raw = remove_background(Image.open(src))
    slice_w = max(1, raw.width // FRAMES)
    sheet = Image.new("RGBA", (frame_w * FRAMES, FRAME_H), (0, 0, 0, 0))
    for i in range(FRAMES):
        frame = raw.crop((i * slice_w, 0, min((i + 1) * slice_w, raw.width), raw.height))
        fitted = fit_frame(frame, frame_w, FRAME_H)
        sheet.paste(fitted, (i * frame_w, 0), fitted)
    out = os.path.join(DST_DIR, dst_name)
    sheet.save(out, "PNG")
    preview = sheet.crop((0, 0, frame_w, FRAME_H)).resize((128, 128), Image.Resampling.LANCZOS)
    preview.save(os.path.join(DST_DIR, dst_name.replace(".png", "_preview.png")), "PNG")
    print(f"walk {dst_name} -> {sheet.size}")


def build_item(src_name: str, dst_name: str) -> None:
    src = os.path.join(SRC_DIR, src_name)
    if not os.path.exists(src):
        return
    out = fit_frame(remove_background(Image.open(src)), 256, 256)
    out.save(os.path.join(DST_DIR, dst_name), "PNG")
    print(f"item {dst_name}")


def build_map(src_name: str, dst_name: str) -> None:
    src = os.path.join(SRC_DIR, src_name)
    if not os.path.exists(src):
        return
    img = Image.open(src).convert("RGB")
    target_h = 720
    scale = target_h / img.height
    img = img.resize((int(img.width * scale), target_h), Image.Resampling.LANCZOS)
    img.save(os.path.join(DST_DIR, dst_name), quality=90)


def main() -> None:
    os.makedirs(DST_DIR, exist_ok=True)
    heroes = [
        ("hq_lava_hero_chick.png", "hero_chick.png"),
        ("hq_lava_hero_bear.png", "hero_bear.png"),
        ("hq_lava_hero_rabbit.png", "hero_rabbit.png"),
        ("hq_lava_hero_squirrel.png", "hero_squirrel.png"),
    ]
    enemies = [
        ("hq_lava_enemy_soldier.png", "enemy_soldier.png", 448),
        ("hq_lava_enemy_imp.png", "enemy_imp.png", 400),
        ("hq_lava_enemy_brute.png", "enemy_brute.png", 512),
        ("hq_lava_enemy_walk2.png", "enemy_blob.png", 448),
    ]
    for src, dst in heroes:
        build_walk_sheet(src, dst)
    for src, dst, fw in enemies:
        build_walk_sheet(src, dst, fw)
    build_walk_sheet("hq_lava_boss_v2.png", "boss.png", 640)
    build_item("hq_lava_item_bomb.png", "item_bomb.png")
    build_item("hq_lava_item_water.png", "item_heal.png")
    build_item("hq_lava_item_ice.png", "item_shield.png")
    for i in range(1, 6):
        build_map(f"hq_lava_map{i}.png", f"bg{i}.jpg")
    src_thumb = os.path.join(SRC_DIR, "hq_lava_thumb.png")
    if os.path.exists(src_thumb):
        thumb = Image.open(src_thumb).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
        thumb.save(os.path.join(DST_DIR, "thumb.png"), quality=92)
        os.makedirs(os.path.dirname(THUMB_HUB), exist_ok=True)
        thumb.resize((512, 512), Image.Resampling.LANCZOS).save(THUMB_HUB, quality=92)
    print("done")


if __name__ == "__main__":
    main()
