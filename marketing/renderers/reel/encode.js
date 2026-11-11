"use strict";
/* 녹화 프레임 + 게임 소리 → 원본 MP4 (tools/game-reels/lib/editor.js 의 makeRaw · probe) */
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const { framesToConcatList } = require("./recorder");

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

function checkFfmpeg() {
  const r = spawnSync(FFMPEG, ["-version"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("FFmpeg 를 찾지 못했습니다. (Windows: winget install Gyan.FFmpeg · Ubuntu: apt-get install ffmpeg · 또는 FFMPEG_PATH)");
  return r.stdout.split("\n")[0];
}

function run(bin, args, logFile) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d;
      if (err.length > 400000) err = err.slice(-200000);
    });
    p.on("close", (code) => {
      if (logFile) fs.appendFileSync(logFile, `\n$ ${path.basename(bin)} ${args.join(" ")}\n${err.slice(-6000)}\n`);
      if (code === 0) resolve(err);
      else reject(new Error(`${path.basename(bin)} 실패 (code ${code}): ${err.split("\n").slice(-6).join(" | ")}`));
    });
  });
}

function probe(file) {
  const r = spawnSync(FFPROBE, ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration", "-of", "json", file], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  return {
    duration: Number(j.format.duration),
    width: v && v.width,
    height: v && v.height,
    fps: v ? v.r_frame_rate.split("/").reduce((n, d) => Number(n) / Number(d)) : 0,
    vcodec: v && v.codec_name,
    acodec: a && a.codec_name,
  };
}

/** 녹화 프레임 + 소리 → 원본 MP4 (30fps, H.264, 소리가 있으면 AAC) */
async function makeRaw({ frames, duration, audio }, dir, outFile, logFile) {
  const list = path.join(dir, "frames.ffconcat");
  fs.writeFileSync(list, framesToConcatList(frames, duration));
  const args = ["-y", "-f", "concat", "-safe", "0", "-i", list];
  const hasAudio = !!(audio && fs.existsSync(audio.file) && fs.statSync(audio.file).size > 2000);
  if (hasAudio) args.push("-itsoffset", String(Math.max(0, audio.offset)), "-i", audio.file);
  args.push("-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p");
  if (hasAudio) args.push("-c:a", "aac", "-b:a", "192k", "-ar", "48000");
  args.push("-movflags", "+faststart", "-t", duration.toFixed(3), outFile);
  await run(FFMPEG, args, logFile);
  return { file: outFile, hasAudio };
}

module.exports = { checkFfmpeg, run, probe, makeRaw, FFMPEG, FFPROBE };
