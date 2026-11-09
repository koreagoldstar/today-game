"use strict";
/*
 * Renderer "reel": 실제 플레이 원본 클립 → 15~20초 1080x1920 릴스 + 커버
 *  원본: plan.clipFile(이미 녹화된 클립) 이 있으면 그것, 없으면 지금 녹화 (3D 재고 꺼내기는 PHASE 5)
 *  0~2.2초 첫 문구 + 게임 이름 · 본편 게임 화면 가운데 · 사건 자막 · 마지막 2.2초 엔딩(로고 · 오늘의 게임에서 플레이 · 주소)
 */
const fs = require("fs");
const path = require("path");
const { recordGame, loadProfile, ROOT } = require("./record");
const { launch } = require("./browser");
const { probe } = require("./encode");
const { pickHighlight, pickCaptionMoments, HOOK_S, CTA_S } = require("./highlight");
const { makeFinal, makeCover, motionSeries, motionFn } = require("./edit");
const ovl = require("./overlays");
const { checkReel } = require("./qc");

// 사건 자막: 게임이 남긴 짧은 한국어 이름이면 그대로, 아니면 종류별 반응 (사실을 지어내지 않는 감탄만)
const REACT = { score: ["좋아!", "나이스!"], combo: ["계속 간다!", "또 획득!"], near: ["아슬아슬!", "앗!"], miss: ["아깝다!"], fail: ["앗!", "아깝다!"], clear: ["해냈다!"], drop: ["간다!"] };
const pick = (list, used) => list.find((x) => !used.includes(x)) || list[0];

function captionText(e, used) {
  const label = String(e.label || "");
  if (/^\d+ms$/.test(label)) return `${label}!`;
  if (/[가-힣]/.test(label) && label.length <= 10 && !/[a-z_]/i.test(label)) return label;
  return REACT[e.type] ? pick(REACT[e.type], used) : null;
}

function readClip(file) {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const json = abs.replace(/\.mp4$/, ".json");
  if (!fs.existsSync(abs) || !fs.existsSync(json)) throw new Error(`원본 클립이 없습니다: ${file}`);
  const meta = JSON.parse(fs.readFileSync(json, "utf8"));
  if (!meta.ok) throw new Error(`실패한 녹화는 쓸 수 없습니다: ${file}`);
  return { file: abs, meta };
}

async function recentOf(store, field, genre) {
  if (!store) return [];
  return (await store.listContents(10)).map((d) => d.render && d.render.meta).filter((m) => m && (!genre || m.genre === genre)).map((m) => m[field]).filter(Boolean);
}

module.exports = {
  kinds: ["reel"],

  async render(source, template, ctx) {
    const { doc, settings, store } = ctx;
    const profile = loadProfile(source.sourceId);
    const out = path.join(ROOT, "marketing", "out");
    const log = ctx.logger ? (m) => ctx.logger.info(m) : () => {};

    // 1) 원본 클립
    let clip;
    if (doc.plan.clipFile) clip = readClip(doc.plan.clipFile);
    else {
      const meta = await recordGame(profile, { outDir: path.join(out, "clips"), render: ctx.render, log });
      if (!meta.ok) throw new Error(`녹화 실패 (${meta.stage}): ${meta.reason}`);
      clip = readClip(meta.file);
    }

    // 2) 하이라이트 15~20초
    const [min, max] = settings.qc.reelSec;
    const hl = pickHighlight({ events: clip.meta.events, duration: clip.meta.durationSec }, motionFn(motionSeries(clip.file)), { min, max, target: Math.min(max, 18) });
    if (!hl) throw new Error("하이라이트 구간을 찾지 못했습니다 (플레이 시간이 너무 짧음).");

    // 3) 템플릿 · 문구 (같은 장르에서 최근에 쓴 것은 피함)
    const genre = source.facts.category;
    const L = ovl.look(genre, template && ovl.TEMPLATES.includes(template) ? template : ovl.pickTemplate(await recentOf(store, "template", genre)));
    const usedHooks = await recentOf(store, "hook");
    const hook = (profile.hooks || [source.facts.title]).find((h) => !usedHooks.includes(h)) || profile.hooks[0];
    const used = [];
    const moments = pickCaptionMoments(hl)
      .map((e) => {
        const text = captionText(e, used);
        if (text) used.push(text);
        return { ...e, text };
      })
      .filter((m) => m.text);

    const dir = path.join(out, "reels", `${doc.id}-v${doc.version}-r${doc.redoCount || 0}`);
    fs.mkdirSync(dir, { recursive: true });
    const browser = await launch({ render: "cpu", scale: 1 });
    let painter;
    try {
      painter = await ovl.createPainter(browser);
      const f = (n) => path.join(dir, n);
      const ov = {
        base: await painter.png(ovl.baseHtml(L), f("base.png")),
        mask: await painter.png(ovl.maskHtml(), f("mask.png"), ovl.GAME),
        hook: await painter.png(ovl.bandHtml({ text: hook, sub: source.facts.title, kind: "hook" }, L), f("hook.png")),
        title: await painter.png(ovl.bandHtml({ text: source.facts.title, sub: source.facts.tag, kind: "title" }, L), f("title.png")),
        cta: await painter.png(ovl.ctaHtml(L), f("cta.png")),
        captions: [],
      };
      for (let i = 0; i < moments.length; i++) ov.captions.push({ at: moments[i].rel, file: await painter.png(ovl.bandHtml({ text: moments[i].text, kind: "caption" }, L), f(`cap${i}.png`)) });

      // 4) 합성 + 커버 (가장 큰 사건 장면)
      const video = f("reel.mp4");
      await makeFinal({ raw: clip.file, hasAudio: !!clip.meta.hasAudio, hl, ov, outFile: video, logFile: f("edit.log") });
      const len = hl.end - hl.start;
      const best = [...hl.events].filter((e) => e.rel > HOOK_S && e.rel < len - CTA_S).sort((a, b) => b.weight - a.weight)[0];
      const at = best ? Math.min(len - CTA_S - 0.2, best.rel + 0.25) : len / 2;
      const coverPng = await painter.png(ovl.coverHtml({ title: source.facts.title, line: hook }, L), f("cover-text.png"));
      const cover = await makeCover({ video, at, textPng: coverPng, outFile: f("cover.jpg"), logFile: f("edit.log") });
      const info = probe(video);
      return {
        kind: "reel",
        files: [
          { role: "video", path: video, contentType: "video/mp4" },
          { role: "cover", path: cover, contentType: "image/jpeg" },
        ],
        meta: {
          title: source.facts.title,
          durationSec: info ? +info.duration.toFixed(2) : null,
          genre,
          template: L.template,
          hook,
          captions: moments.map((m) => ({ at: m.rel, text: m.text })),
          highlight: { start: hl.start, end: hl.end, score: hl.score },
          clip: { id: clip.meta.id, render: clip.meta.render, captureFps: clip.meta.captureFps, gameHash: clip.meta.gameHash },
          coverAt: +at.toFixed(2),
          fonts: ovl.FONTS,
          audio: [], // 덧붙인 배경음악 없음 (게임 원래 소리만)
          gameSound: !!clip.meta.hasAudio,
          textOverflow: painter.overflow,
          cta: ovl.SITE,
        },
      };
    } finally {
      if (painter) await painter.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  },

  qc: (render, { settings }) => checkReel(render, settings),
};
