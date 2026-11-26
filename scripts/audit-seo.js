/* SEO 점검 (node scripts/audit-seo.js [--json])
 * 배포되는 모든 HTML 의 title · description · canonical · robots · og · h1 · img alt · 본문 설명,
 * sitemap 과 canonical 일치, robots.txt, 내부 링크의 쿼리 파라미터를 본다.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SITE = "https://www.todaygame.co.kr";
const SKIP = new Set(["node_modules", "scratch", "tools", "reels", ".claude", ".git", "test-results", "edu-svg-assets", "scripts", ".vercel", ".agents"]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? (m[2] != null ? m[2] : m[3]) : null;
};
function meta(html, key, val) {
  const re = /<meta\b[^>]*>/gi;
  let m;
  const out = [];
  while ((m = re.exec(html))) if ((attr(m[0], key) || "").toLowerCase() === val) out.push(attr(m[0], "content"));
  return out;
}
function urlOf(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  if (rel === "index.html") return SITE + "/";
  if (rel.endsWith("/index.html")) return `${SITE}/${rel.slice(0, -10)}`;
  return `${SITE}/${rel}`;
}

const pages = walk(ROOT).map((file) => {
  const html = fs.readFileSync(file, "utf8");
  const head = (html.split(/<\/head>/i)[0] || "");
  const body = html.slice(head.length);
  const titles = [...head.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => m[1].trim());
  const canon = [...head.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)].map((m) => attr(m[0], "href"));
  const imgs = [...body.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]).filter((h) => h.startsWith("/") && h.includes("?") && !/\.(css|js|png|webp|jpg|svg|ico|json|webmanifest)\?/.test(h));
  return {
    file: path.relative(ROOT, file).split(path.sep).join("/"),
    url: urlOf(file),
    title: titles,
    desc: meta(head, "name", "description"),
    robots: meta(head, "name", "robots"),
    canon,
    ogTitle: meta(head, "property", "og:title"),
    ogDesc: meta(head, "property", "og:description"),
    ogImage: meta(head, "property", "og:image"),
    ogUrl: meta(head, "property", "og:url"),
    h1: (body.match(/<h1\b/gi) || []).length,
    imgNoAlt: imgs.filter((t) => attr(t, "alt") == null).length,
    textLen: text.length,
    seoAbout: /class="seo-about"/.test(body),
    links,
  };
});

const sm = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const smUrls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
const robots = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8");

const games = pages.filter((p) => /^games\/[^/]+\/index\.html$/.test(p.file));
const issues = [];
const add = (p, msg) => issues.push(`${p.file}: ${msg}`);
const titleCount = {};
const descCount = {};
for (const p of pages) {
  const alias = p.canon.length === 1 && p.canon[0] !== p.url;
  if (p.title[0] && !alias) titleCount[p.title[0]] = (titleCount[p.title[0]] || 0) + 1;
  if (p.desc[0] && !alias) descCount[p.desc[0]] = (descCount[p.desc[0]] || 0) + 1;
}
const noindex = (p) => p.robots.some((r) => /noindex/i.test(r || ""));
// 같은 내용의 예전 주소: canonical 이 다른 페이지를 가리키면 그 페이지의 사본으로 보고 중복 검사에서 뺀다
const aliasOf = (p) => p.canon.length === 1 && p.canon[0] !== p.url && pages.some((q) => q.url === p.canon[0]);
const notes = [];
for (const p of pages) {
  const inSm = smUrls.includes(p.url);
  if (/^naver[0-9a-f]+\.html$/.test(p.file)) {
    notes.push(`${p.file}: 네이버 소유 확인 파일 (검사 제외)`);
    continue;
  }
  if (aliasOf(p)) {
    if (inSm) add(p, "사본 주소인데 사이트맵에 있음");
    if (!p.desc[0]) add(p, "description 없음");
    notes.push(`${p.file}: 대표 주소 ${p.canon[0]} 의 사본`);
    continue;
  }
  if (noindex(p)) {
    if (inSm) add(p, "noindex 인데 사이트맵에 있음");
    continue;
  }
  if (p.title.length !== 1 || !p.title[0]) add(p, `title ${p.title.length}개`);
  else if (titleCount[p.title[0]] > 1) add(p, `title 중복: ${p.title[0]}`);
  if (p.desc.length !== 1 || !p.desc[0]) add(p, `description ${p.desc.length}개${p.desc[0] === "" ? " (빈 값)" : ""}`);
  else {
    if (descCount[p.desc[0]] > 1) add(p, "description 중복");
    if (p.desc[0].length < 40) add(p, `description 짧음 (${p.desc[0].length}자)`);
  }
  if (p.canon.length !== 1) add(p, `canonical ${p.canon.length}개`);
  else if (p.canon[0] !== p.url) add(p, `canonical 불일치 ${p.canon[0]}`);
  if (inSm || p.file.startsWith("games/") || p.file === "index.html") {
    if (!p.ogTitle[0] || !p.ogDesc[0] || !p.ogImage[0]) add(p, "og title/description/image 빠짐");
    if (p.ogUrl[0] && p.ogUrl[0] !== p.url) add(p, `og:url 불일치 ${p.ogUrl[0]}`);
    if (p.h1 !== 1) add(p, `h1 ${p.h1}개`);
  }
  if (p.imgNoAlt) add(p, `alt 없는 img ${p.imgNoAlt}개`);
  if (p.file.startsWith("games/") && !p.seoAbout) add(p, "게임 설명 본문(seo-about) 없음");
  if (p.links.length) add(p, `쿼리 붙은 내부 링크: ${[...new Set(p.links)].slice(0, 3).join(" ")}`);
}
// 사이트맵
const dupSm = smUrls.filter((u, i) => smUrls.indexOf(u) !== i);
const smMissingPage = smUrls.filter((u) => !pages.some((p) => p.url === u));
const smQuery = smUrls.filter((u) => u.includes("?"));
const gamesNotInSm = games.filter((p) => !noindex(p) && !smUrls.includes(p.url)).map((p) => p.url);
const smCanonMismatch = smUrls.filter((u) => {
  const p = pages.find((q) => q.url === u);
  return p && p.canon[0] !== u;
});
const robotsBlocks = robots
  .split(/\r?\n/)
  .filter((l) => /^disallow:\s*\S/i.test(l))
  .map((l) => l.replace(/^disallow:\s*/i, ""));

const report = {
  pages: pages.length,
  games: games.length,
  sitemap: { urls: smUrls.length, dup: dupSm, missingPage: smMissingPage, query: smQuery, gamesNotIn: gamesNotInSm, canonMismatch: smCanonMismatch },
  robotsBlocks,
  issues,
};
if (process.argv.includes("--json")) console.log(JSON.stringify({ report, pages }, null, 1));
else {
  console.log(`HTML ${pages.length}개 · 게임 ${games.length}개 · 사이트맵 ${smUrls.length}개`);
  console.log("사이트맵 중복", dupSm.length, "· 없는 페이지", smMissingPage, "· 쿼리 URL", smQuery.length, "· 빠진 게임", gamesNotInSm, "· canonical 불일치", smCanonMismatch);
  console.log("robots.txt Disallow:", robotsBlocks.length ? robotsBlocks : "없음");
  console.log(`\n문제 ${issues.length}개`);
  for (const i of issues) console.log(" -", i);
}
process.exitCode = issues.length || dupSm.length || smMissingPage.length || smQuery.length || gamesNotInSm.length || smCanonMismatch.length ? 1 : 0;
