"""Punch magenta chroma and split sprite sheets into game assets."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

GEN = Path(r"C:\Users\COM\.cursor\projects\c-Users-COM-Projects-today-game\assets")
GAMES = Path(r"C:\Users\COM\Projects\today game\games")


def is_magenta(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 20:
        return True
    # strong magenta / hot pink chroma
    if r > 180 and b > 180 and g < 90:
        return True
    if r > 200 and b > 160 and g < 110 and (r + b) > g * 3.2:
        return True
    return False


def punch(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_magenta(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
    return img


def bbox_content(img: Image.Image, pad: int = 2):
    px = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 12:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    if max_x < 0:
        return None
    min_x = max(0, min_x - pad)
    min_y = max(0, min_y - pad)
    max_x = min(w - 1, max_x + pad)
    max_y = min(h - 1, max_y + pad)
    return (min_x, min_y, max_x + 1, max_y + 1)


def crop_content(img: Image.Image) -> Image.Image:
    box = bbox_content(img)
    if not box:
        return img
    return img.crop(box)


def flood_components(img: Image.Image, min_area: int = 800):
    """Return bounding boxes of opaque connected components (4-connected)."""
    w, h = img.size
    px = img.load()
    visited = [[False] * w for _ in range(h)]
    boxes = []
    for y0 in range(h):
        for x0 in range(w):
            if visited[y0][x0] or px[x0, y0][3] <= 12:
                continue
            stack = [(x0, y0)]
            visited[y0][x0] = True
            min_x = max_x = x0
            min_y = max_y = y0
            area = 0
            while stack:
                x, y = stack.pop()
                area += 1
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and px[nx, ny][3] > 12:
                        visited[ny][nx] = True
                        stack.append((nx, ny))
            if area >= min_area:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1, area))
    boxes.sort(key=lambda b: (b[1] // 40, b[0]))
    return boxes


def split_sheet(src: Path, out_dir: Path, names: list[str], min_area: int = 800):
    img = punch(Image.open(src))
    boxes = flood_components(img, min_area=min_area)
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"{src.name}: found {len(boxes)} components, need {len(names)}")
    for i, name in enumerate(names):
        if i >= len(boxes):
            print(f"  missing {name}")
            continue
        x0, y0, x1, y1, _ = boxes[i]
        pad = 3
        piece = img.crop(
            (
                max(0, x0 - pad),
                max(0, y0 - pad),
                min(img.width, x1 + pad),
                min(img.height, y1 + pad),
            )
        )
        piece = crop_content(piece)
        dest = out_dir / name
        piece.save(dest)
        print(f"  -> {dest.name} {piece.size}")


def save_full(src: Path, dest: Path, do_punch: bool = False):
    img = Image.open(src).convert("RGBA")
    if do_punch:
        img = punch(img)
        img = crop_content(img)
    dest.parent.mkdir(parents=True, exist_ok=True)
    # backgrounds as PNG (or JPEG for park-like)
    if dest.suffix.lower() in {".jpg", ".jpeg"}:
        rgb = Image.new("RGB", img.size, (255, 255, 255))
        rgb.paste(img, mask=img.split()[-1])
        rgb.save(dest, quality=90)
    else:
        img.save(dest)
    print(f"saved {dest} {img.size}")


def main():
    # brick
    save_full(GEN / "brick-bg.png", GAMES / "brick" / "assets" / "bg.png")
    split_sheet(
        GEN / "brick-paddle-ball.png",
        GAMES / "brick" / "assets",
        ["paddle.png", "ball.png"],
        min_area=1200,
    )

    # tower
    split_sheet(
        GEN / "tower-hook.png",
        GAMES / "tower" / "assets",
        ["hook.png"],
        min_area=400,
    )
    split_sheet(
        GEN / "tower-blocks.png",
        GAMES / "tower" / "assets",
        ["block0.png", "block1.png", "block2.png", "block3.png", "block4.png"],
        min_area=1500,
    )

    # sokoban
    split_sheet(
        GEN / "sokoban-set.png",
        GAMES / "sokoban" / "assets",
        ["bunny.png", "crate.png", "hedge.png", "grass.png", "goal.png"],
        min_area=1500,
    )

    # memory animals
    split_sheet(
        GEN / "memory-animals.png",
        GAMES / "memory" / "assets" / "tiles",
        ["chick.png", "cat.png", "calico.png", "bunny.png", "dog.png", "bear.png"],
        min_area=2000,
    )

    # diff props
    split_sheet(
        GEN / "diff-props.png",
        GAMES / "diff" / "assets",
        [
            "prop-balloon.png",
            "prop-heart.png",
            "prop-butterfly.png",
            "prop-flower.png",
            "prop-cat.png",
        ],
        min_area=1500,
    )

    # ttamogi
    save_full(GEN / "ttamogi-bg1.png", GAMES / "ttamogi" / "assets" / "bg1.png")
    save_full(GEN / "ttamogi-bg2.png", GAMES / "ttamogi" / "assets" / "bg2.png")
    save_full(GEN / "ttamogi-bg3.png", GAMES / "ttamogi" / "assets" / "bg3.png")
    split_sheet(
        GEN / "ttamogi-chars.png",
        GAMES / "ttamogi" / "assets",
        ["bunny.png", "dragon.png"],
        min_area=2000,
    )

    # 2048 jelly faces as optional overlays - save sheet for CSS background use
    split_sheet(
        GEN / "jelly-tiles.png",
        GAMES / "slide-2048" / "assets",
        [
            "t2.png",
            "t4.png",
            "t8.png",
            "t16.png",
            "t32.png",
            "t64.png",
            "t128.png",
            "t256.png",
        ],
        min_area=800,
    )


if __name__ == "__main__":
    main()
