"use strict";
/*
 * 릴스 검수 (측정할 수 있는 것만, 통과/실패 + 사유)
 *  ffprobe: 1080x1920 · H.264 · AAC · 30fps · 길이(설정 15~20초) · 오디오 트랙
 *  게임 영역: blackdetect(검은 화면 1초↑ 실패) · freezedetect(멈춘 화면 2초↑ 실패) · 프레임 차이로 실제 움직임
 *  글자: 줄여도 칸을 넘은 문구가 없어야 함 · 커버: 1080x1920 JPEG · 8MB 이하 · 빈 그림 아님
 */
const fs = require("fs");
const { spawnSync } = require("child_process");
const { probe, run, FFMPEG } = require("./encode");
const { motionSeries } = require("./edit");
const { GAME } = require("./overlays");

const CROP = `crop=${GAME.w}:${GAME.h}:${GAME.x}:${GAME.y}`;

async function detect(file, filter) {
  const err = await run(FFMPEG, ["-hide_banner", "-i", file, "-an", "-vf", `${CROP},${filter}`, "-f", "null", "-"]);
  return err;
}

/** 그림 한 장이 비었는지: 작게 줄인 회색 값의 표준편차 */
function imageSpread(file) {
  const r = spawnSync(FFMPEG, ["-v", "error", "-i", file, "-vf", "scale=54:96,format=gray", "-frames:v", "1", "-f", "rawvideo", "-"], { maxBuffer: 1 << 20 });
  if (r.status !== 0 || !r.stdout.length) return 0;
  const a = [...r.stdout];
  const mean = a.reduce((s, x) => s + x, 0) / a.length;
  return Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length);
}

async function checkReel(render, settings) {
  const checks = [];
  const add = (id, name, ok, reason) => checks.push({ id, name, ok: !!ok, reason: ok ? "" : reason });
  const video = (render.files || []).find((f) => f.role === "video");
  const cover = (render.files || []).find((f) => f.role === "cover");
  const [minSec, maxSec] = settings.qc.reelSec;

  const info = video && fs.existsSync(video.path) ? probe(video.path) : null;
  add("v:open", "영상 파일 열림", !!(info && info.width), "영상 파일을 열 수 없음 (손상 또는 없음)");
  if (info && info.width) {
    add("v:size", "1080x1920", info.width === 1080 && info.height === 1920, `${info.width}x${info.height}`);
    add("v:codec", "H.264", info.vcodec === "h264", `영상 코덱 ${info.vcodec}`);
    add("v:audio", "AAC 오디오 트랙", info.acodec === "aac", `오디오 ${info.acodec || "없음"}`);
    add("v:fps", "30fps", Math.abs(info.fps - 30) < 0.5, `${info.fps.toFixed(2)}fps`);
    add("v:len", `길이 ${minSec}~${maxSec}초`, info.duration >= minSec - 0.05 && info.duration <= maxSec + 0.05, `${info.duration.toFixed(2)}초`);

  }
  // 게임 영역 검사는 크기가 맞을 때만 (다르면 잘라 낼 수 없어 ffmpeg 가 멈춘다)
  if (info && info.width === 1080 && info.height === 1920) {
    const black = await detect(video.path, `blackdetect=d=${settings.qc.blackSec}:pix_th=0.10`);
    const b = black.match(/black_start:([\d.]+)\s+black_end:([\d.]+)/);
    add("v:black", `검은 화면 ${settings.qc.blackSec}초 미만`, !b, b && `게임 영역 검은 화면 ${b[1]}~${b[2]}초`);
    const freeze = await detect(video.path, `freezedetect=n=-60dB:d=${settings.qc.freezeSec}`);
    const fz = freeze.match(/freeze_start: ?([\d.]+)/);
    add("v:freeze", `멈춘 화면 ${settings.qc.freezeSec}초 미만`, !fz, fz && `게임 영역이 ${fz[1]}초부터 ${settings.qc.freezeSec}초 넘게 멈춤`);
    const ms = motionSeries(video.path, { crop: GAME });
    const moving = ms.length ? ms.filter((x) => x.d > 0.004).length / ms.length : 0;
    const minM = settings.qc.minMotion;
    add("v:motion", `게임 영역이 실제로 움직임 (장면 ${Math.round(minM * 100)}% 이상)`, moving >= minM, `움직인 장면 ${(moving * 100).toFixed(0)}% (최소 ${Math.round(minM * 100)}%)`);
  } else if (info && info.width) add("v:area", "게임 영역 검사", false, "영상 크기가 달라 게임 영역을 검사하지 못함");

  const over = (render.meta && render.meta.textOverflow) || [];
  add("text:overflow", "글자가 칸을 넘지 않음", !over.length, `넘친 문구: ${over.join(" / ")}`);

  const ci = cover && fs.existsSync(cover.path) ? probe(cover.path) : null;
  add("c:open", "커버 이미지", !!(ci && ci.width), "커버가 없거나 열 수 없음");
  if (ci && ci.width) {
    add("c:size", "커버 1080x1920 JPEG", ci.width === 1080 && ci.height === 1920 && ci.vcodec === "mjpeg", `${ci.width}x${ci.height} ${ci.vcodec}`);
    add("c:bytes", "커버 8MB 이하", fs.statSync(cover.path).size <= 8 * 1024 * 1024, `${fs.statSync(cover.path).size} 바이트`);
    const spread = imageSpread(cover.path);
    add("c:blank", "커버가 빈 그림이 아님", spread > 8, `밝기 차이 ${spread.toFixed(1)} (거의 한 색)`);
  }
  return checks;
}

module.exports = { checkReel, imageSpread };
