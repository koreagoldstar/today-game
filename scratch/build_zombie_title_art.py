"""Build polished title / hub thumbnail for Zombie Run."""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "games", "zombie-run", "assets")
OUT_GAME = os.path.join(ASSETS, "thumb.png")
OUT_HUB = os.path.join(ROOT, "assets", "thumbs", "zombie-run.png")
SIZE = 1024


def load(name: str) -> Image.Image:
    return Image.open(os.path.join(ASSETS, name)).convert("RGBA")


def fit_cover(img: Image.Image, w: int, h: int) -> Image.Image:
    sw, sh = img.size
    scale = max(w / sw, h / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return img.crop((left, top, left + w, top + h))


def paste_center(base: Image.Image, sprite: Image.Image, cx: int, cy: int, max_w: int) -> None:
    w, h = sprite.size
    scale = min(1.0, max_w / max(w, 1))
    if scale != 1.0:
        sprite = sprite.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    x = cx - sprite.width // 2
    y = cy - sprite.height // 2
    base.alpha_composite(sprite, (x, y))


def first_frame(sheet: Image.Image) -> Image.Image:
    w, h = sheet.size
    fw = w // 4
    return sheet.crop((0, 0, fw, h))


def build() -> None:
    bg = fit_cover(Image.open(os.path.join(ASSETS, "bg.jpg")).convert("RGB"), SIZE, SIZE)

    canvas = Image.new("RGBA", (SIZE, SIZE))
    canvas.paste(bg, (0, 0))

    # cinematic grade
    grade = Image.new("RGBA", (SIZE, SIZE), (8, 14, 28, 0))
    d = ImageDraw.Draw(grade)
    d.rectangle((0, 0, SIZE, SIZE), fill=(0, 0, 0, 95))
    d.rectangle((0, int(SIZE * 0.55), SIZE, SIZE), fill=(0, 0, 0, 120))
    canvas = Image.alpha_composite(canvas, grade)

    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((SIZE * 0.18, SIZE * 0.08, SIZE * 0.82, SIZE * 0.72), fill=(0, 240, 255, 38))
    gd.ellipse((SIZE * 0.22, SIZE * 0.52, SIZE * 0.78, SIZE * 0.98), fill=(255, 0, 85, 28))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=28))
    canvas = Image.alpha_composite(canvas, glow)

    # ground reflection strip
    floor = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    fd = ImageDraw.Draw(floor)
    fd.polygon(
        [
            (SIZE * 0.08, SIZE * 0.92),
            (SIZE * 0.92, SIZE * 0.92),
            (SIZE * 0.78, SIZE * 0.62),
            (SIZE * 0.22, SIZE * 0.62),
        ],
        fill=(0, 240, 255, 22),
    )
    canvas = Image.alpha_composite(canvas, floor)

    # heroes (preview PNGs)
    heroes = [
        ("preview_hero_rabbit.png", int(SIZE * 0.24), int(SIZE * 0.58), int(SIZE * 0.19)),
        ("preview_hero_chick.png", int(SIZE * 0.40), int(SIZE * 0.52), int(SIZE * 0.24)),
        ("preview_hero_bear.png", int(SIZE * 0.58), int(SIZE * 0.58), int(SIZE * 0.22)),
        ("preview_hero_bird.png", int(SIZE * 0.74), int(SIZE * 0.56), int(SIZE * 0.19)),
    ]
    for name, cx, cy, mw in heroes:
        paste_center(canvas, load(name), cx, cy, mw)

    # vehicles behind heroes
    paste_center(canvas, first_frame(load("tank.png")), int(SIZE * 0.18), int(SIZE * 0.70), int(SIZE * 0.28))
    paste_center(canvas, first_frame(load("chopper.png")), int(SIZE * 0.82), int(SIZE * 0.66), int(SIZE * 0.30))

    # zombies foreground
    z = first_frame(load("zombie.png"))
    paste_center(canvas, z, int(SIZE * 0.12), int(SIZE * 0.78), int(SIZE * 0.16))
    paste_center(canvas, z, int(SIZE * 0.88), int(SIZE * 0.80), int(SIZE * 0.14))

    # neon frame
    frame = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    pad = int(SIZE * 0.04)
    fd.rounded_rectangle(
        (pad, pad, SIZE - pad, SIZE - pad),
        radius=int(SIZE * 0.06),
        outline=(0, 240, 255, 180),
        width=6,
    )
    fd.rounded_rectangle(
        (pad + 10, pad + 10, SIZE - pad - 10, SIZE - pad - 10),
        radius=int(SIZE * 0.05),
        outline=(255, 209, 102, 90),
        width=2,
    )
    canvas = Image.alpha_composite(canvas, frame)

    # title strip
    strip_h = int(SIZE * 0.14)
    strip = Image.new("RGBA", (SIZE, strip_h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(strip)
    sd.rounded_rectangle((0, 0, SIZE, strip_h), radius=18, fill=(5, 10, 20, 190))
    sd.line([(0, strip_h - 2), (SIZE, strip_h - 2)], fill=(0, 240, 255, 160), width=3)
    canvas.alpha_composite(strip, (0, int(SIZE * 0.04)))

    try:
        font = ImageFont.truetype("arialbd.ttf", int(SIZE * 0.07))
        sub = ImageFont.truetype("malgun.ttf", int(SIZE * 0.034))
    except OSError:
        try:
            font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", int(SIZE * 0.07))
            sub = ImageFont.truetype(r"C:\Windows\Fonts\malgun.ttf", int(SIZE * 0.034))
        except OSError:
            font = ImageFont.load_default()
            sub = font

    td = ImageDraw.Draw(canvas)
    td.text((SIZE * 0.08, SIZE * 0.055), "ZOMBIE RUN", fill=(255, 255, 255, 245), font=font)
    td.text((SIZE * 0.08, SIZE * 0.115), "지혁 제작 · 50 STAGES", fill=(255, 209, 102, 230), font=sub)

    # vignette
    vig = Image.new("L", (SIZE, SIZE), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse((-SIZE * 0.08, -SIZE * 0.08, SIZE * 1.08, SIZE * 1.08), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(radius=42))
    vig_rgba = Image.merge("RGBA", (Image.new("L", (SIZE, SIZE), 0),) * 3 + (vig.point(lambda a: 255 - a),))
    canvas = Image.alpha_composite(canvas, vig_rgba)

    final = canvas.convert("RGB")
    final.save(OUT_GAME, quality=92)
    final.resize((512, 512), Image.Resampling.LANCZOS).save(OUT_HUB, quality=92)
    print(f"Wrote {OUT_GAME}")
    print(f"Wrote {OUT_HUB}")


if __name__ == "__main__":
    build()
