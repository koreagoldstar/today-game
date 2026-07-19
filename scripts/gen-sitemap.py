from pathlib import Path
from datetime import date

base = "https://www.todaygame.co.kr"
today = date.today().isoformat()

game_dirs = sorted(
    p.name for p in Path("games").iterdir() if (p / "index.html").is_file()
)

pages = [
    ("/", "daily", "1.0"),
    ("/rankings/", "daily", "0.9"),
    ("/fame/", "daily", "0.9"),
]
for g in game_dirs:
    pages.append((f"/games/{g}/", "weekly", "0.8"))

parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
]
for path, freq, pri in pages:
    loc = base + "/" if path == "/" else base + path
    parts.extend(
        [
            "  <url>",
            f"    <loc>{loc}</loc>",
            f"    <lastmod>{today}</lastmod>",
            f"    <changefreq>{freq}</changefreq>",
            f"    <priority>{pri}</priority>",
            "  </url>",
        ]
    )
parts.append("</urlset>")
parts.append("")

Path("sitemap.xml").write_text("\n".join(parts), encoding="utf-8")
Path("robots.txt").write_text(
    f"User-agent: *\nAllow: /\n\nSitemap: {base}/sitemap.xml\n",
    encoding="utf-8",
)
print(f"games={len(game_dirs)} urls={len(pages)}")
