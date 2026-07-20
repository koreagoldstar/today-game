import subprocess
from pathlib import Path

games = ["flappy", "doodle", "jump-run", "ninja-dodge", "stork-stride", "tetris"]

for g in games:
    raw = subprocess.check_output(["git", "show", f"HEAD:games/{g}/index.html"])
    text = raw.decode("utf-8")

    if "share-rank-btn" not in text:
        for old in (
            '<button type="button" class="btn soft" id="retry-btn"',
            '<button type="button" class="btn" id="retry-btn"',
            '<button type="button" class="btn soft" id="again-btn"',
            '<button type="button" class="btn" id="again-btn"',
        ):
            if old in text:
                btn = (
                    '<button type="button" class="btn soft" id="share-rank-btn" hidden>'
                    "내 결과 공유</button>\n        " + old
                )
                text = text.replace(old, btn, 1)
                break

    if "/js/game-rank.js" not in text:
        if '<script src="/js/scores.js"></script>' in text:
            text = text.replace(
                '<script src="/js/scores.js"></script>',
                '<script src="/js/scores.js"></script>\n'
                '    <script src="/js/game-rank.js"></script>',
                1,
            )
        elif '<script src="game.js"></script>' in text:
            text = text.replace(
                '<script src="game.js"></script>',
                '<script src="/js/game-rank.js"></script>\n'
                '    <script src="game.js"></script>',
                1,
            )

    path = Path(f"games/{g}/index.html")
    path.write_text(text, encoding="utf-8", newline="\n")
    t2 = path.read_text(encoding="utf-8")
    title = next(ln for ln in t2.splitlines() if "<title>" in ln)
    print(
        g,
        title.strip(),
        "share=",
        "share-rank-btn" in t2,
        "rankjs=",
        "game-rank.js" in t2,
        "fffd=",
        t2.count("\ufffd"),
    )
