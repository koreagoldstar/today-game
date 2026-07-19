from pathlib import Path
from PIL import Image


def punch(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                px[x, y] = (0, 0, 0, 0)
                continue
            if r > 170 and b > 140 and g < 130 and r + b > g * 2.6:
                px[x, y] = (0, 0, 0, 0)
                continue
            if r > 200 and b > 180 and g < 160:
                px[x, y] = (0, 0, 0, 0)
                continue
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(path)
    print(path.name, img.size)


brick = Path(r"C:\Users\COM\Projects\today game\games\brick\assets")
# swap if needed (paddle should be wide capsule)
p = Image.open(brick / "paddle.png")
b = Image.open(brick / "ball.png")
# wide one is paddle
if p.width < b.width:
    p.save(brick / "_tmp.png")
    b.save(brick / "paddle.png")
    Image.open(brick / "_tmp.png").save(brick / "ball.png")
    (brick / "_tmp.png").unlink(missing_ok=True)
    print("swapped")

base = Path(r"C:\Users\COM\Projects\today game\games")
for rel in [
    "brick/assets/paddle.png",
    "brick/assets/ball.png",
    "tower/assets/hook.png",
    "ttamogi/assets/bunny.png",
    "ttamogi/assets/dragon.png",
]:
    punch(base / rel)
