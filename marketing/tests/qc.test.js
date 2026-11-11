"use strict";
/* PHASE 4 — 릴스 검수: 일부러 만든 나쁜 영상(검은 화면 · 짧은 영상 · 소리 없음 · 빈 커버 · 글자 넘침)이 불합격하는지 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { checkReel } = require("../renderers/reel/qc");
const { DEFAULTS, merge, validate } = require("../core/settings");

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mkt-qc-"));
const settings = validate(merge(DEFAULTS, {}));

function make(name, video, { sec = 18, audio = true } = {}) {
  const file = path.join(DIR, name);
  const args = ["-v", "error", "-y", "-f", "lavfi", "-i", `${video}${video.includes("=") ? ":" : "="}s=1080x1920:r=30:d=${sec}`];
  if (audio) args.push("-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${sec}`);
  args.push("-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p");
  if (audio) args.push("-c:a", "aac");
  args.push("-shortest", file);
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status) throw new Error(r.stderr);
  return file;
}
function still(name, video) {
  const file = path.join(DIR, name);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `${video}${video.includes("=") ? ":" : "="}s=1080x1920`, "-frames:v", "1", "-q:v", "2", file], { encoding: "utf8" });
  if (r.status) throw new Error(r.stderr);
  return file;
}
const render = (video, cover, meta = {}) => ({ kind: "reel", files: [{ role: "video", path: video }, { role: "cover", path: cover }], meta: { textOverflow: [], ...meta } });
const failed = (checks) => checks.filter((c) => !c.ok).map((c) => c.id);

const good = make("good.mp4", "testsrc2");
const goodCover = still("cover.jpg", "testsrc2");

test("정상 영상(움직이는 화면 · 18초 · 1080x1920 · H.264/AAC)은 통과", async () => {
  const c = await checkReel(render(good, goodCover), settings);
  assert.deepEqual(failed(c), [], JSON.stringify(c.filter((x) => !x.ok)));
});

test("검은 화면 → 검은 화면 · 멈춤 · 움직임 불합격", async () => {
  const c = await checkReel(render(make("black.mp4", "color=c=black"), goodCover), settings);
  for (const id of ["v:black", "v:freeze", "v:motion"]) assert.ok(failed(c).includes(id), `${id}: ${JSON.stringify(failed(c))}`);
  assert.match(c.find((x) => x.id === "v:black").reason, /검은 화면/);
});

test("10초짜리 짧은 영상 → 길이 불합격", async () => {
  const c = await checkReel(render(make("short.mp4", "testsrc2", { sec: 10 }), goodCover), settings);
  assert.deepEqual(failed(c), ["v:len"]);
  assert.match(c.find((x) => x.id === "v:len").reason, /10\.\d+초/);
});

test("소리 트랙 없음 · 가로 영상 · 깨진 파일 → 불합격", async () => {
  const silent = await checkReel(render(make("silent.mp4", "testsrc2", { audio: false }), goodCover), settings);
  assert.deepEqual(failed(silent), ["v:audio"]);
  const wide = path.join(DIR, "wide.mp4");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30:d=18", "-f", "lavfi", "-i", "sine=d=18", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", wide]);
  assert.ok(failed(await checkReel(render(wide, goodCover), settings)).includes("v:size"));
  const broken = path.join(DIR, "broken.mp4");
  fs.writeFileSync(broken, "not a video");
  assert.ok(failed(await checkReel(render(broken, goodCover), settings)).includes("v:open"));
});

test("빈 커버 · 커버 없음 · 글자 넘침 → 불합격", async () => {
  const blank = still("blank.jpg", "color=c=white");
  assert.deepEqual(failed(await checkReel(render(good, blank), settings)), ["c:blank"]);
  assert.deepEqual(failed(await checkReel(render(good, path.join(DIR, "none.jpg")), settings)), ["c:open"]);
  assert.deepEqual(failed(await checkReel(render(good, goodCover, { textOverflow: ["아주 아주 긴 문구"] }), settings)), ["text:overflow"]);
});
