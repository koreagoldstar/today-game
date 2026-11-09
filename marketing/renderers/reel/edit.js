"use strict";
/*
 * FFmpeg 편집: 원본 클립 → 1080x1920 · H.264/AAC · 30fps 릴스 + 커버 JPG (tools/game-reels/lib/editor.js 의 makeFinal 에서 가져옴)
 *  배경: 같은 게임 화면을 흐리게 · 가운데: 게임 화면 비율 그대로(잘림 없음) + 둥근 모서리 · 위: 디자인 영역 · 마지막 2.2초: 엔딩
 *  바꾼 점: -preset veryfast (지시서) · 움직임 측정(motionSeries)
 */
const { spawnSync } = require("child_process");
const { run, FFMPEG } = require("./encode");
const { OUT, GAME } = require("./overlays");
const { HOOK_S, CTA_S } = require("./highlight");

/**
 * 화면 움직임: 초당 fps 장을 작은 회색 그림으로 뽑아 이웃한 장끼리 차이(0~1)를 잰다
 * @returns {{ t: number, d: number }[]}
 */
function motionSeries(file, { crop = null, fps = 5, from = 0, to = null } = {}) {
  const W = 54;
  const H = 96;
  const vf = [crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}` : null, `fps=${fps}`, `scale=${W}:${H}`, "format=gray"].filter(Boolean).join(",");
  const args = ["-v", "error", "-ss", String(from), ...(to != null ? ["-t", String(to - from)] : []), "-i", file, "-an", "-vf", vf, "-f", "rawvideo", "-"];
  const r = spawnSync(FFMPEG, args, { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`움직임 측정 실패: ${String(r.stderr).slice(-300)}`);
  const buf = r.stdout;
  const n = Math.floor(buf.length / (W * H));
  const out = [];
  for (let i = 1; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < W * H; k++) sum += Math.abs(buf[i * W * H + k] - buf[(i - 1) * W * H + k]);
    out.push({ t: from + i / fps, d: sum / (W * H * 255) });
  }
  return out;
}

/** 움직임 목록 → (시작, 끝) 구간 평균을 돌려주는 함수 */
const motionFn = (series) => (s, e) => {
  const w = series.filter((x) => x.t >= s && x.t <= e);
  return w.length ? w.reduce((a, x) => a + x.d, 0) / w.length / 0.05 : 0; // 0.05(5%) 차이를 1 로
};

/**
 * @param {{ raw, hasAudio, hl, ov: { base, mask, hook, title, cta, captions: {file, at}[] }, outFile, logFile }} o
 */
async function makeFinal({ raw, hasAudio, hl, ov, outFile, logFile }) {
  const len = +(hl.end - hl.start).toFixed(3);
  const args = ["-y", "-ss", String(hl.start), "-t", String(len), "-i", raw];
  const still = (f) => args.push("-loop", "1", "-t", String(len), "-i", f);
  still(ov.base); // 1
  still(ov.mask); // 2
  still(ov.hook); // 3
  still(ov.title); // 4
  still(ov.cta); // 5
  ov.captions.forEach((c) => still(c.file)); // 6..
  const silentIdx = 6 + ov.captions.length;
  if (!hasAudio) args.push("-f", "lavfi", "-t", String(len), "-i", "anullsrc=r=48000:cl=stereo");

  const capOn = ov.captions.map((c) => `between(t,${c.at.toFixed(2)},${(c.at + 1.3).toFixed(2)})`);
  const titleEnable = `gte(t,${HOOK_S})*lt(t,${(len - CTA_S).toFixed(2)})` + (capOn.length ? `*not(${capOn.join("+")})` : "");
  const f = [];
  f.push(`[0:v]fps=30,split=2[v1][v2]`);
  f.push(`[v1]scale=${OUT.w}:${OUT.h}:force_original_aspect_ratio=increase,crop=${OUT.w}:${OUT.h},gblur=sigma=36,eq=brightness=-0.17:saturation=0.8[bg]`);
  f.push(`[v2]scale=${GAME.w}:${GAME.h}:flags=lanczos,format=rgba[g]`);
  f.push(`[2:v]scale=${GAME.w}:${GAME.h},format=gray[m]`);
  f.push(`[g][m]alphamerge[gm]`);
  f.push(`[bg][gm]overlay=${GAME.x}:${GAME.y}[s0]`);
  f.push(`[s0][1:v]overlay=0:0[s1]`);
  f.push(`[3:v]format=rgba,fade=t=out:st=${(HOOK_S - 0.2).toFixed(2)}:d=0.2:alpha=1[hk]`);
  f.push(`[s1][hk]overlay=0:0:enable='lt(t,${HOOK_S})'[s2]`);
  f.push(`[s2][4:v]overlay=0:0:enable='${titleEnable}'[s3]`);
  let last = "s3";
  ov.captions.forEach((c, i) => {
    f.push(`[${6 + i}:v]format=rgba,fade=t=in:st=${c.at.toFixed(2)}:d=0.12:alpha=1[c${i}]`);
    f.push(`[${last}][c${i}]overlay=0:0:enable='${capOn[i]}'[k${i}]`);
    last = `k${i}`;
  });
  const ctaAt = (len - CTA_S).toFixed(2);
  f.push(`[5:v]format=rgba,fade=t=in:st=${ctaAt}:d=0.25:alpha=1[ct]`);
  f.push(`[${last}][ct]overlay=0:0:enable='gte(t,${ctaAt})',format=yuv420p[vout]`);
  if (hasAudio) f.push(`[0:a]loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.08,afade=t=out:st=${(len - 0.45).toFixed(2)}:d=0.45[aout]`);

  args.push("-filter_complex", f.join(";"), "-map", "[vout]", "-map", hasAudio ? "[aout]" : `${silentIdx}:a`);
  args.push("-t", String(len), "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", outFile);
  await run(FFMPEG, args, logFile);
  return outFile;
}

/** 릴스의 한 장면 + 큰 글자 → 커버 JPG (1080x1920) */
async function makeCover({ video, at, textPng, outFile, logFile }) {
  await run(FFMPEG, ["-y", "-ss", String(at), "-i", video, "-i", textPng, "-filter_complex", "[0:v][1:v]overlay=0:0", "-frames:v", "1", "-q:v", "2", outFile], logFile);
  return outFile;
}

/** 평균 음량 (dB) — 소리가 실제로 들어 있는지 */
async function meanVolume(file) {
  try {
    const out = await run(FFMPEG, ["-i", file, "-af", "volumedetect", "-vn", "-f", "null", "-"]);
    const m = out.match(/mean_volume:\s*(-?[\d.]+) dB/);
    return m ? Number(m[1]) : null;
  } catch (_) {
    return null;
  }
}

module.exports = { makeFinal, makeCover, meanVolume, motionSeries, motionFn };
