/*
 * 용암 서핑 · 스테이지 (15 정규 + 보스 3 + 무한 도전)
 *
 *  월드 1 화산의 시작   : 01 검은 화산 경사면 · 02 불타는 바위 계곡 · 03 무너지는 용암 다리
 *  월드 2 불꽃의 협곡   : 04 불기둥 협곡 · 05 용암 폭포 · 06 폭발하는 화산 분화구 → BOSS 1 화산 골렘
 *  월드 3 용암 바다     : 07 용암 호수 · 08 검은 현무암 미로 · 09 용암 파도 추격전
 *  월드 4 화산의 심장   : 10 회전하는 화산 터널 · 11 화염 톱니 절벽 · 12 마그마 발전소 → BOSS 2 불꽃 와이번
 *  월드 5 용의 영역     : 13 화산 위의 폭풍 · 14 용의 둥지 · 15 용암 절벽 최종 질주 → BOSS 3 고대 용
 *
 *  각 스테이지는 builder.js 로 구간을 이어 붙여 만든다. 모든 위치 s 는 출발점부터의 거리(m), u 는 오른쪽(+) 옆 거리(m).
 *  출발선은 s = 60 (그 뒤 분화구 비탈에서 용암이 시작).
 */
import { CourseBuilder } from "./builder.js?v=2";
import { seeded } from "./tex.js?v=2";

export const START_S = 60;

/* ================================================================
 * 공통 조각
 * ============================================================== */
function begin(id, name, { hw = 9, walls = "both", lavaDepth = 10, slope = 0.1, y0 = 260 } = {}) {
  const C = new CourseBuilder({ id, name, y0, hw, slope, seed: id * 31 + 7, lavaDepth });
  C.run(START_S, { slope, hw, walls }); // 분화구 비탈 (용암이 여기서 시작)
  return C;
}
/** 점프대 + 틈 (+ 위로 구슬 활) → 틈 시작 s */
function rampGap(C, rampLen, h, gapLen, { orbs = true, top, after = 20, hw } = {}) {
  C.ramp(rampLen, h, hw ? { hw } : {});
  const g = C.s;
  C.gap(gapLen);
  if (orbs) C.arc(g - 2, g + gapLen + 2, 0, top ?? Math.min(6, h * 1.3 + gapLen * 0.1), Math.max(3, Math.round(gapLen / 2.6)));
  if (after) C.run(after);
  return g;
}
/** 점프 버튼으로 넘는 작은 틈 */
function jumpGap(C, len, { orbs = true, after = 18 } = {}) {
  const g = C.s;
  C.gap(len);
  if (orbs) C.arc(g - 3, g + len + 3, 0, 1.6, 3);
  if (after) C.run(after);
  return g;
}
/** 용암 위 바위 발판 건너기: pads = [{d 틈 시작부터 가운데까지, u, l(앞뒤 반길이), r(옆 반폭), sink, lift, orbs}]
 *  기본 발판 16m · 사이 용암 6m (보통 빠르기 점프 18~20m 가 다음 발판에 넉넉히 들어감) → d = 16, 38, 60, 82 … */
function hop(C, pads, { tail = 8 } = {}) {
  const g = C.s;
  const last = pads[pads.length - 1];
  C.gap(last.d + (last.l ?? 8) + tail);
  for (const p of pads) {
    C.pad(g + p.d, p.u ?? 0, p.r ?? 3.4, { l: p.l ?? 8, sink: p.sink, lift: p.lift, h: p.h ?? 0 });
    if (p.orbs !== false) C.orbs(g + p.d - (p.l ?? 8) * 0.5, g + p.d + (p.l ?? 8) * 0.5, p.u ?? 0, p.u ?? 0, p.orbs || 3, 1.2);
  }
  return g;
}
/** 구간 하나: run 하고 그 구간 시작 s 를 fn 에 넘겨 장애물을 놓는다 */
function seg(C, len, opts, fn) {
  const s = C.s;
  C.run(len, opts);
  if (fn) fn(s, s + len);
  return s;
}

/* ================================================================
 * STAGE 01 · 검은 화산 경사면 (입문)
 * ============================================================== */
function s01() {
  const C = begin(1, "검은 화산 경사면", { hw: 10 });
  C.lava(40, 0.95);
  C.hint("A·D / ←→ 로 좌우, Space 점프, Shift 부스터!", "◀ ▶ 좌우 · 점프 · 부스터 버튼!");
  seg(C, 90, { slope: 0.1, hw: 10.5 }, (s) => C.orbs(s + 20, s + 80, 0, 0, 6));
  C.hint("구슬을 따라 좌우로 움직여 봐요");
  seg(C, 120, { slope: 0.12, turn: 0.25 }, (s) => {
    C.orbs(s + 10, s + 50, -4, 4, 6);
    C.orbs(s + 65, s + 110, 4, -4, 6);
  });
  C.hint("낮은 바위는 피하거나 점프로 넘어요");
  seg(C, 130, { slope: 0.13, turn: -0.3, hw: 9.5 }, (s) => {
    for (const [d, u] of [
      [20, -3],
      [38, 3],
      [55, 0],
      [72, -4.5],
      [75, 4.5],
      [95, -1.5],
      [112, 2.5],
    ])
      C.rock(s + d, u);
    C.orbs(s + 55, s + 55, 0, 0, 1, 2.6);
    C.orbs(s + 80, s + 120, -1, 1, 4);
  });
  C.hint("빛나는 용암 웅덩이는 피해 가요");
  seg(C, 120, { slope: 0.12, turn: 0.2 }, (s) => {
    C.hole(s + 25, s + 31, -6.5, -2);
    C.hole(s + 52, s + 58, 1.5, 6);
    C.hole(s + 82, s + 88, -2.2, 2.2);
    C.orbs(s + 20, s + 36, 2, 2, 3);
    C.orbs(s + 46, s + 62, -2.5, -2.5, 3);
    C.orbs(s + 76, s + 94, 4.5, 4.5, 3);
  });
  C.cp();
  C.hint("점프대! 끝에서 Space 를 누르면 더 멀리", "점프대 끝에서 점프 버튼을 누르면 더 멀리!");
  C.run(30);
  rampGap(C, 12, 2.2, 9, { after: 30 });
  C.hint("바위 기둥 사이로 지그재그!");
  seg(C, 150, { slope: 0.14, hw: 9 }, (s) => {
    for (const [d, u] of [
      [20, 3.5],
      [45, -3.5],
      [70, 4],
      [95, -4],
      [120, 3],
    ]) {
      C.spire(s + d, u, { r: 1.2, h: 6 });
      C.orbs(s + d - 4, s + d + 4, -u, -u, 3);
    }
  });
  C.hint("틈 앞에서 Space 로 점프!", "틈 앞에서 점프 버튼!");
  C.run(24);
  C.sign(C.s - 14, -5, "jump");
  jumpGap(C, 6, { after: 30 });
  C.cp();
  C.hint("벽이 없어요 · 가장자리 밖은 용암!");
  seg(C, 160, { hw: 7, walls: "none", turn: 0.35, slope: 0.12 }, (s) => {
    C.orbs(s + 10, s + 150, 0, 0, 12);
    C.rock(s + 60, -3);
    C.rock(s + 100, 3);
  });
  C.hint("부스터 발판 → 점프대로 안전지대까지!");
  C.run(30, { hw: 8.5, walls: "both" });
  C.boost(C.s - 14, 0);
  const g = rampGap(C, 14, 3.0, 14, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "basalt" });
}

/* ================================================================
 * STAGE 02 · 불타는 바위 계곡
 * ============================================================== */
function s02() {
  const C = begin(2, "불타는 바위 계곡", { hw: 10 });
  C.lava(36, 1.0);
  C.hint("붉은 바위 계곡! 큰 바위가 좌우로 굴러다녀요");
  seg(C, 80, { hw: 10, turn: 0.2 }, (s) => C.orbs(s + 10, s + 70, 0, 0, 6));
  seg(C, 200, { hw: 10, slope: 0.14, turn: -0.3 }, (s) => {
    C.slider(s + 30, -7, 7, { look: "boulder", h: 3.2, period: 3.6 });
    C.slider(s + 75, 7, -7, { look: "boulder", h: 3.2, period: 3.2 });
    C.slider(s + 120, -7, 7, { look: "boulder", h: 3.0, period: 3.0, phase: 0.3 });
    C.slider(s + 165, -7.5, -0.5, { look: "boulder", h: 2.8, period: 2.4 });
    C.slider(s + 165, 7.5, 0.5, { look: "boulder", h: 2.8, period: 2.4 });
    C.orbs(s + 40, s + 60, 0, 0, 3);
    C.orbs(s + 140, s + 155, -3, 3, 3);
  });
  C.cp();
  C.hint("길이 좁아져요 · 바위 기둥 사이로!");
  seg(C, 170, { hw: 6.5, slope: 0.15, turn: 0.4 }, (s) => {
    for (const [d, u] of [
      [20, 2.8],
      [40, -2.8],
      [60, 3],
      [80, -3],
      [100, 2.6],
      [120, -2.6],
      [145, 0],
    ]) {
      C.spire(s + d, u, { r: 1.3, h: 7, look: "redrock" });
      if (u) C.orbs(s + d - 3, s + d + 3, -u, -u, 2);
    }
    C.orbs(s + 140, s + 150, 4.2, 4.2, 2);
  });
  C.hint("바닥에 붉은 줄이 생기면 바위가 굴러와요");
  seg(C, 130, { hw: 8, slope: 0.15 }, (s) => {
    C.roll(s + 40, -1, { speed: 8.5 });
    C.roll(s + 92, 1, { speed: 9 });
    C.orbs(s + 55, s + 80, 0, 0, 4);
  });
  C.cp();
  C.hint("벽이 없어요! 가장자리 밖은 용암");
  seg(C, 160, { hw: 6, walls: "none", turn: -0.35, slope: 0.13 }, (s) => {
    C.slider(s + 40, -4.2, 4.2, { look: "boulder", h: 2.6, period: 3.0 });
    C.slider(s + 100, 4.2, -4.2, { look: "boulder", h: 2.6, period: 2.8 });
    C.orbs(s + 55, s + 85, 4.6, 4.6, 5);
    C.orbs(s + 115, s + 145, -4.6, -4.6, 5);
    C.rock(s + 70, 0);
  });
  C.run(30, { walls: "both", hw: 8 });
  rampGap(C, 12, 2.6, 12);
  C.hint("마지막 바위 굴리기! 빈틈을 노려요");
  seg(C, 130, { hw: 9, slope: 0.14, turn: 0.25 }, (s) => {
    C.slider(s + 30, -7, 7, { look: "boulder", h: 3.0, period: 2.6 });
    C.slider(s + 70, 7, -7, { look: "boulder", h: 3.0, period: 2.6, phase: 0.5 });
    C.roll(s + 108, -1, { speed: 9.5 });
  });
  C.stopLava(C.s);
  C.finish({ approach: 20 });
  return C.done({ theme: "canyon" });
}

/* ================================================================
 * STAGE 03 · 무너지는 용암 다리
 * ============================================================== */
function bridgeRun(C, len, opts = {}) {
  const s = C.s;
  C.run(len, { hw: 3.6, walls: "none", style: "bridge", slope: 0.07, ...opts });
  for (let d = 12; d < len; d += 26) C.decor("pillar", s + d);
  return s;
}
function s03() {
  const C = begin(3, "무너지는 용암 다리", { hw: 8, lavaDepth: 9 });
  C.lava(36, 1.0);
  C.hint("용암 바다 위 돌다리! 금 간 곳은 곧 무너져요");
  C.run(40, { hw: 8 });
  // 다리 1: 한쪽씩 미리 무너지는 곳 (피함) + 끊어진 곳 (점프)
  let s = bridgeRun(C, 120, { turn: 0.25 });
  C.crumble(s + 30, s + 40, -3.7, 0);
  C.crumble(s + 62, s + 72, 0, 3.7);
  C.crumble(s + 95, s + 105, -3.7, 0);
  C.orbs(s + 20, s + 110, 0, 0, 8);
  C.hint("다리가 끊겼어요 · 점프!", "다리가 끊겼어요 · 점프 버튼!");
  jumpGap(C, 6, { after: 0 });
  s = bridgeRun(C, 80, { turn: -0.2 });
  C.crumble(s + 25, s + 35, 0, 3.7);
  C.crumble(s + 50, s + 60, -3.7, 0);
  // 섬 + 체크포인트
  C.run(46, { hw: 8, walls: "none", style: null });
  C.cp();
  // 다리 2: 연속 점프
  C.hint("연달아 끊긴 다리! 리듬에 맞춰 점프");
  bridgeRun(C, 22);
  jumpGap(C, 5, { after: 0 });
  bridgeRun(C, 16);
  jumpGap(C, 6, { after: 0 });
  bridgeRun(C, 16);
  jumpGap(C, 7, { after: 0 });
  bridgeRun(C, 22);
  C.ramp(9, 1.4, { hw: 3.6, walls: "none", style: "bridge" });
  const g2 = C.s;
  C.gap(11);
  C.arc(g2 - 2, g2 + 13, 0, 2.6, 4);
  s = bridgeRun(C, 60);
  C.crumble(s + 20, s + 30, -3.7, 0);
  C.run(46, { hw: 8, walls: "none", style: null });
  C.cp();
  // 다리 3: 뒤에서 무너지는 다리 + 용암 추격
  C.hint("다리가 무너진다! 멈추지 말고 달려!");
  C.lava(24, 1.1);
  s = bridgeRun(C, 200, { turn: 0.3 });
  for (let d = 10; d < 190; d += 6) C.crumble(s + d, s + d + 6, -3.9, 3.9, { trigger: 10, delay: 1.1 });
  C.orbs(s + 10, s + 190, 0, 0, 14);
  jumpGap(C, 6, { after: 0 });
  s = bridgeRun(C, 60);
  for (let d = 4; d < 56; d += 6) C.crumble(s + d, s + d + 6, -3.9, 3.9, { trigger: 10, delay: 1.1 });
  C.hint("마지막 점프로 땅까지!");
  C.ramp(10, 2.4, { hw: 4, walls: "none", style: "bridge" });
  const g = C.s;
  C.gap(13);
  C.arc(g - 2, g + 15, 0, 3.4, 5);
  C.stopLava(g);
  C.run(10, { hw: 9, walls: "both", style: null });
  C.finish({ approach: 14 });
  return C.done({ theme: "bridge" });
}

/* ================================================================
 * STAGE 04 · 불기둥 협곡
 * ============================================================== */
function s04() {
  const C = begin(4, "불기둥 협곡", { hw: 9 });
  C.lava(34, 1.0);
  C.hint("땅이 붉게 빛나면 곧 불기둥! 옆으로 피해요");
  seg(C, 60, {}, (s) => C.orbs(s + 10, s + 50, 0, 0, 5));
  seg(C, 120, { turn: 0.2, slope: 0.13 }, (s) => {
    C.fire(s + 20, 0, { period: 2.8 });
    C.fire(s + 45, -3.5, { phase: 0.3 });
    C.fire(s + 45, 3.5, { phase: 0.8 });
    C.fire(s + 75, 0, { phase: 0.5 });
    C.fire(s + 100, -3, { phase: 0 });
    C.fire(s + 100, 3, { phase: 0.5 });
    C.orbs(s + 30, s + 38, 0, 0, 2);
    C.orbs(s + 85, s + 92, 0, 0, 2);
  });
  C.cp();
  C.hint("불기둥마다 솟는 박자가 달라요 · 박자를 봐요!");
  seg(C, 150, { turn: 0.3, slope: 0.13 }, (s) => {
    [25, 60, 95, 130].forEach((d, i) => {
      [-4, 0, 4].forEach((u, j) => C.fire(s + d, u, { period: 2.4, phase: ((j + i) % 3) / 3, r: 1.6 }));
    });
    C.orbs(s + 40, s + 50, 0, 0, 2);
    C.orbs(s + 110, s + 118, 0, 0, 2);
  });
  C.hint("가운데 불기둥은 빨리 솟아요!");
  seg(C, 140, { hw: 8, slope: 0.14 }, (s) => {
    for (let d = 15; d < 140; d += 20) {
      C.fire(s + d, -4.5, { period: 3.2, phase: 0, r: 1.5 });
      C.fire(s + d, 4.5, { period: 3.2, phase: 0.5, r: 1.5 });
    }
    for (let d = 25; d < 140; d += 28) C.fire(s + d, 0, { period: 1.6, warn: 0.6, on: 0.5, phase: d / 100, r: 1.4 });
  });
  C.cp();
  C.hint("커다란 불기둥! 오래 경고하고 오래 타올라요");
  seg(C, 120, { hw: 9, turn: -0.3 }, (s) => {
    C.fire(s + 30, -2.5, { r: 2.4, period: 3.4, warn: 1.4, on: 1.2, big: true });
    C.fire(s + 70, 2.5, { r: 2.4, period: 3.4, warn: 1.4, on: 1.2, big: true, phase: 0.4 });
    C.fire(s + 100, 0, { r: 2.4, period: 3.4, warn: 1.4, on: 1.2, big: true, phase: 0.75 });
    C.orbs(s + 30, s + 30, 4.5, 4.5, 1);
    C.orbs(s + 70, s + 70, -4.5, -4.5, 1);
  });
  rampGap(C, 12, 2.6, 12);
  C.hint("마지막 불길! 빈 곳을 찾아 달려요");
  seg(C, 160, { hw: 9, turn: 0.35, slope: 0.14 }, (s) => {
    const rnd = seeded(404);
    for (let i = 0; i < 6; i++) {
      const d = 20 + i * 24;
      const a = -5 + rnd() * 3;
      C.fire(s + d, a, { period: 2.2, phase: rnd() });
      C.fire(s + d, a + 5.5, { period: 2.2, phase: rnd() });
      C.orbs(s + d + 10, s + d + 14, a + 2.7, a + 2.7, 2);
    }
  });
  C.stopLava(C.s);
  C.finish({ approach: 20 });
  return C.done({ theme: "firecanyon" });
}

/* ================================================================
 * STAGE 05 · 용암 폭포
 * ============================================================== */
function s05() {
  const C = begin(5, "용암 폭포", { hw: 9 });
  C.lava(34, 1.0);
  C.hint("위에서 용암 폭포가 쏟아져요 · 폭포 사이 틈으로!");
  seg(C, 70, {}, (s) => C.orbs(s + 10, s + 60, 0, 0, 5));
  seg(C, 160, { slope: 0.13, turn: 0.25 }, (s) => {
    C.lavafall(s + 30, -9.5, -1);
    C.lavafall(s + 65, 1, 9.5);
    C.lavafall(s + 100, -9.5, -2.5);
    C.lavafall(s + 100, 2.5, 9.5);
    C.lavafall(s + 135, -9.5, 0.5);
    C.orbs(s + 30, s + 30, 4, 4, 1);
    C.orbs(s + 65, s + 65, -4, -4, 1);
    C.orbs(s + 100, s + 100, 0, 0, 1);
    C.orbs(s + 135, s + 135, 4.5, 4.5, 1);
  });
  C.cp();
  C.hint("폭포가 멈췄다 쏟아졌다 해요 · 멈췄을 때 지나가요!");
  seg(C, 150, { slope: 0.13, turn: -0.2 }, (s) => {
    C.lavafall(s + 30, -9.5, 3, { period: 3.2, on: 1.4, warn: 0.8 });
    C.lavafall(s + 30, 5.5, 9.5);
    C.lavafall(s + 80, -9.5, 9.5, { period: 3.0, on: 1.0, warn: 0.8, phase: 0.3 });
    C.lavafall(s + 120, -9.5, -0.5, { period: 2.6, on: 1.0, warn: 0.7 });
    C.lavafall(s + 120, 0.5, 9.5, { period: 2.6, on: 1.0, warn: 0.7, phase: 0.5 });
  });
  C.hint("옆에서 용암 덩어리가 날아와요 · 붉은 원을 피해요!");
  const s3 = seg(C, 160, { hw: 8, slope: 0.13 }, (s) => {
    for (const [d, u] of [
      [25, 2],
      [45, -3],
      [62, 0.5],
      [80, 4],
      [98, -2],
      [118, 1],
      [140, -4],
    ])
      C.bomb(s + d, u, { from: "side", kind: "lava", r: 1.8, trigger: 40, flight: 1.1 });
    C.orbs(s + 20, s + 150, 0, 0, 10);
  });
  C.cp();
  C.hint("연기 속 좁은 길! 폭포 사이로");
  const s4 = seg(C, 150, { hw: 7, turn: 0.4, slope: 0.13 }, (s) => {
    C.lavafall(s + 20, -7.5, -1.5);
    C.lavafall(s + 45, 1.5, 7.5);
    C.lavafall(s + 70, -7.5, -0.5, { period: 2.8, on: 1.2 });
    C.lavafall(s + 95, 0.5, 7.5);
    C.bomb(s + 60, 3, { from: "side", kind: "lava", trigger: 40 });
    C.bomb(s + 115, -2, { from: "side", kind: "lava", trigger: 40 });
    C.orbs(s + 20, s + 20, 3, 3, 1);
    C.orbs(s + 45, s + 45, -3, -3, 1);
  });
  C.fog(s3 + 60, s4 + 150, 22, 150);
  rampGap(C, 12, 2.8, 14);
  C.hint("마지막 폭포 지그재그!");
  seg(C, 120, { hw: 8, slope: 0.14 }, (s) => {
    C.lavafall(s + 20, -8.5, -1);
    C.lavafall(s + 20, 3, 8.5);
    C.lavafall(s + 50, -8.5, -3);
    C.lavafall(s + 50, 1, 8.5);
    C.lavafall(s + 80, -8.5, 0);
    C.lavafall(s + 80, 4, 8.5);
    C.orbs(s + 20, s + 20, 1, 1, 1);
    C.orbs(s + 50, s + 50, -1, -1, 1);
    C.orbs(s + 80, s + 80, 2, 2, 1);
  });
  C.stopLava(C.s);
  C.finish({ approach: 20 });
  return C.done({ theme: "falls" });
}

/* ================================================================
 * STAGE 06 · 폭발하는 화산 분화구
 * ============================================================== */
function s06() {
  const C = begin(6, "폭발하는 화산 분화구", { hw: 10.5 });
  C.lava(36, 1.0);
  C.hint("분화구가 흔들리면 곧 폭발! 충격파는 점프로 넘어요");
  seg(C, 70, { hw: 10.5 }, (s) => C.orbs(s + 10, s + 60, 0, 0, 5));
  seg(C, 150, { slope: 0.12, turn: 0.2 }, (s) => {
    C.erupt(s + 45, -5.5, { period: 5, ring: 14, debris: 2 });
    C.erupt(s + 105, 5.5, { period: 5, phase: 0.45, ring: 14, debris: 2 });
    C.orbs(s + 40, s + 50, 3, 3, 2);
    C.orbs(s + 100, s + 110, -3, -3, 2);
  });
  C.hint("하늘에서 바위가 떨어져요 · 그림자 원을 피해요!");
  seg(C, 140, { slope: 0.13, turn: -0.3 }, (s) => {
    for (const [d, u] of [
      [20, 0],
      [35, -4],
      [50, 4],
      [62, -1],
      [76, 3],
      [90, -5],
      [104, 1],
      [118, -3],
    ])
      C.bomb(s + d, u, { from: "sky", kind: "rock", trigger: 44, flight: 1.4 });
  });
  C.cp();
  seg(C, 170, { hw: 9.5, slope: 0.13, turn: 0.25 }, (s) => {
    C.erupt(s + 30, 0, { period: 4.2, ring: 18, debris: 3 });
    C.erupt(s + 95, -4.5, { period: 4.6, ring: 16, debris: 2 });
    C.erupt(s + 95, 4.5, { period: 4.6, phase: 0.5, ring: 16, debris: 2 });
    C.bomb(s + 60, 3, { trigger: 44 });
    C.bomb(s + 135, -2, { trigger: 44 });
    C.orbs(s + 40, s + 85, -5, -5, 5);
  });
  rampGap(C, 12, 2.8, 13);
  C.cp();
  C.hint("화산이 연달아 터져요! 멈추지 말고 탈출!");
  C.lava(26, 1.08);
  seg(C, 220, { hw: 10, slope: 0.14, turn: -0.3 }, (s) => {
    for (let i = 0; i < 5; i++) C.erupt(s + 25 + i * 40, i % 2 ? 5 : -5, { period: 3.6, phase: i * 0.27, ring: 15, debris: 3 });
    for (let d = 40; d < 210; d += 22) C.bomb(s + d, ((d * 7) % 13) - 6, { trigger: 44, flight: 1.3 });
    C.boost(s + 60, 0);
    C.boost(s + 150, 0);
    C.orbs(s + 10, s + 210, 0, 0, 14);
  });
  C.run(20);
  C.boost(C.s - 10, 0);
  const g = rampGap(C, 14, 3.4, 16, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "crater" });
}

/* ================================================================
 * STAGE 07 · 용암 호수
 * ============================================================== */
function causeway(C, len, fn) {
  return seg(C, len, { hw: 4.5, walls: "none", slope: 0.08 }, fn);
}
function s07() {
  const C = begin(7, "용암 호수", { hw: 8, lavaDepth: 6 });
  C.lava(36, 1.0);
  C.hint("용암 호수! 바위 발판을 점프로 건너요", "용암 호수! 점프 버튼으로 바위 발판을 건너요");
  C.run(40, { hw: 8 });
  causeway(C, 26);
  hop(C, [
    { d: 16, u: 0 },
    { d: 38, u: 2 },
    { d: 60, u: -1 },
  ]);
  causeway(C, 50, (s) => C.orbs(s + 8, s + 42, 0, 0, 5));
  C.cp();
  C.hint("금 간 발판은 밟으면 가라앉아요 · 바로 점프!");
  hop(C, [
    { d: 16, u: -2, sink: true },
    { d: 38, u: 1, sink: true },
    { d: 60, u: -1, sink: true },
    { d: 82, u: 2, sink: true },
  ]);
  causeway(C, 56, (s) => C.orbs(s + 8, s + 48, 0, 0, 5));
  C.cp();
  C.hint("왼쪽은 넓고 안전한 길 · 오른쪽 작은 발판은 구슬이 많은 지름길!");
  {
    const s = C.s;
    C.sign(s - 12, -2.6, "go");
    C.sign(s - 12, 3, "short");
  }
  {
    const g = C.s;
    C.gap(82);
    for (const d of [16, 38, 60]) C.pad(g + d, -3.2, 3.0, { l: 8 });
    // 지름길: 작은 발판 (발판 가운데에서 점프해야 다음 발판)
    for (const d of [13, 31, 49, 67]) {
      C.pad(g + d, 4.6, 1.9, { l: 4.2 });
      C.orbs(g + d - 1.5, g + d + 1.5, 4.6, 4.6, 2, 1.3);
    }
    C.big(g + 40, 4.6, 2.6, true);
    C.orbs(g + 10, g + 66, -3.2, -3.2, 6, 1.2);
  }
  causeway(C, 50, (s) => C.orbs(s + 8, s + 42, 0, 0, 5));
  C.hint("긴 호수 건너기! 발판마다 높이가 달라요");
  hop(C, [
    { d: 16, u: 0 },
    { d: 38, u: -2.5, sink: true },
    { d: 60, u: 2.5, sink: true, h: 0.6 },
    { d: 82, u: 0, h: 1.0 },
    { d: 104, u: -2, sink: true, h: 0.4 },
  ]);
  causeway(C, 40);
  C.run(20, { hw: 8, walls: "both" });
  C.stopLava(C.s);
  C.finish({ approach: 10 });
  return C.done({ theme: "lake" });
}

/* ================================================================
 * STAGE 08 · 검은 현무암 미로
 * ============================================================== */
/** 세 갈래 길: dead = 막다른 길(끝이 용암 구덩이), short = 지름길(부스터 · 구슬 · 작은 구덩이 점프) */
function split(C, { len = 84, pre = 34, dead = [], short = null, hw = 10.5 } = {}) {
  const s0 = C.s;
  C.run(pre + len + 14, { hw, walls: "both", slope: 0.12 });
  const d0 = s0 + pre;
  const d1 = d0 + len;
  const lanes = [-3.6, 3.6];
  for (const u of lanes) {
    C.divider(d0, d1, u, { h: 5.5 });
    C.spire(d0 + 0.4, u, { r: 0.75, h: 4.5, look: "basalt" });
  }
  const box = { L: [-hw - 1, lanes[0]], C: [lanes[0], lanes[1]], R: [lanes[1], hw + 1] };
  const mid = { L: (-hw + lanes[0]) / 2, C: 0, R: (lanes[1] + hw) / 2 };
  for (const k of ["L", "C", "R"]) {
    const kind = dead.includes(k) ? "stop" : short === k ? "short" : "go";
    C.sign(d0 - 20, mid[k], kind);
    const [a, b] = box[k];
    const ua = k === "L" ? a : a + 0.5;
    const ub = k === "R" ? b : b - 0.5;
    if (kind === "stop") C.hole(d1 - 20, d1 - 2, ua, ub);
    else if (kind === "short") {
      C.boost(d0 + 8, mid[k], { w: 2.6, l: 4 });
      C.hole(d0 + 40, d0 + 46, ua, ub);
      C.arc(d0 + 37, d0 + 49, mid[k], 1.6, 3);
      C.orbs(d0 + 14, d0 + 34, mid[k], mid[k], 5);
      C.orbs(d0 + 52, d1 - 6, mid[k], mid[k], 6);
      C.big(d0 + 66, mid[k], 1.2);
    } else C.orbs(d0 + 10, d1 - 10, mid[k], mid[k], 4);
  }
  return { d0, d1 };
}
function s08() {
  const C = begin(8, "검은 현무암 미로", { hw: 10 });
  C.lava(38, 0.98);
  C.hint("현무암 미로! 표지판을 보고 길을 골라요 · 빨간 X 는 막다른 길");
  C.run(50, { hw: 10.5 });
  split(C, { dead: ["L"], short: "R" });
  seg(C, 70, { hw: 10, turn: 0.3 }, (s) => {
    C.spire(s + 25, -3, { look: "basalt", r: 1.3, h: 6 });
    C.spire(s + 45, 3.5, { look: "basalt", r: 1.3, h: 6 });
    C.orbs(s + 20, s + 60, 0, 0, 4);
  });
  C.hint("막다른 길은 끝에 용암 구덩이! 들어가기 전에 골라요");
  split(C, { dead: ["C"], short: "L" });
  C.run(30, { hw: 10 });
  C.cp();
  C.hint("이번엔 가운데 길만 열려 있어요!");
  split(C, { dead: ["L", "R"] });
  seg(C, 80, { hw: 9, turn: -0.35 }, (s) => {
    C.slider(s + 30, -6, 6, { period: 3.0, h: 2.6 });
    C.spire(s + 60, 0, { look: "basalt", r: 1.4, h: 6 });
    C.orbs(s + 55, s + 65, 4, 4, 2);
  });
  C.cp();
  C.hint("갈림길이 이어져요 · 침착하게!");
  split(C, { dead: ["R"], short: "C" });
  C.run(20, { hw: 10 });
  split(C, { dead: ["C"], short: "R" });
  C.run(30, { hw: 9 });
  C.boost(C.s - 12, 0);
  const g = rampGap(C, 12, 2.8, 13, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "maze" });
}

/* ================================================================
 * STAGE 09 · 용암 파도 추격전
 * ============================================================== */
function s09() {
  const C = begin(9, "용암 파도 추격전", { hw: 9 });
  C.lava(30, 1.04);
  C.hint("거대한 용암 파도가 쫓아와요! 부스터 발판으로 거리를 벌려요");
  seg(C, 50, {}, (s) => C.boost(s + 30, 0));
  seg(C, 150, { slope: 0.15, turn: 0.3 }, (s) => {
    for (let i = 0; i < 9; i++) {
      const d = 12 + i * 15;
      if (i % 3 === 2) C.spire(s + d, i % 2 ? 3 : -3, { r: 1.1, h: 5 });
      else C.rock(s + d, ((i * 5) % 9) - 4);
    }
    C.boost(s + 80, 0);
    C.orbs(s + 10, s + 140, 0, 0, 10);
  });
  seg(C, 160, { slope: 0.15, turn: -0.3 }, (s) => {
    C.slider(s + 25, -6.5, 6.5, { period: 2.6 });
    C.roll(s + 60, -1, { speed: 10 });
    C.slider(s + 95, 6.5, -6.5, { period: 2.4 });
    C.roll(s + 130, 1, { speed: 10 });
    C.boost(s + 112, 0);
  });
  C.cp();
  C.hint("파도가 더 빨라졌어요! 실수하면 따라잡혀요");
  C.lava(26, 1.06);
  seg(C, 150, { slope: 0.15, turn: 0.35 }, (s) => {
    [20, 45, 70, 95, 120].forEach((d, i) => {
      C.fire(s + d, i % 2 ? 3.2 : -3.2, { period: 2.2, phase: i * 0.3 });
      C.fire(s + d + 8, 0, { period: 2.2, phase: i * 0.3 + 0.5 });
    });
    C.boost(s + 58, i2u(1));
    C.boost(s + 132, 0);
  });
  seg(C, 150, { slope: 0.15, turn: -0.3, hw: 8 }, (s) => {
    C.crumble(s + 20, s + 32, -8, -0.5);
    C.crumble(s + 50, s + 62, 0.5, 8);
    C.crumble(s + 80, s + 92, -8, -1);
    for (const [d, u] of [
      [40, 2],
      [70, -2],
      [104, 3],
      [125, -3],
    ])
      C.bomb(s + d, u, { trigger: 40, flight: 1.1 });
    C.boost(s + 110, 0);
  });
  C.cp();
  C.hint("마지막 탈출 통로! 좁은 길에서 낮은 막대는 점프!");
  C.lava(22, 1.07);
  seg(C, 150, { hw: 3.4, slope: 0.15, turn: 0.4 }, (s) => {
    for (let d = 25; d < 140; d += 28) C.bar(s + d, -3.5, 3.5, { h: 0.8, look: "log" });
    C.orbs(s + 10, s + 140, 0, 0, 10);
  });
  C.run(20, { hw: 7 });
  C.boost(C.s - 10, 0);
  const g = rampGap(C, 14, 3.6, 18, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "chase" });
}
const i2u = (i) => (i % 2 ? 2.5 : -2.5);

/* ================================================================
 * STAGE 10 · 회전하는 화산 터널
 * ============================================================== */
function s10() {
  const C = begin(10, "회전하는 화산 터널", { hw: 7 });
  C.lava(34, 1.0);
  C.hint("화산 속 터널! 도는 날개의 빈틈으로 지나가요");
  C.run(50, { hw: 6 });
  let s = C.s;
  C.tunnel(220, { hw: 5, slope: 0.12, turn: 0.3 });
  C.rotor(s + 40, { speed: 1.1 });
  C.rotor(s + 95, { speed: -1.3, phase: 0.2 });
  C.rotor(s + 150, { speed: 1.5, arms: 2, blade: 1.0 });
  C.rotor(s + 200, { speed: -1.2, phase: 0.5 });
  C.orbs(s + 10, s + 210, 0, 0, 12);
  C.run(40, { hw: 7 });
  C.cp();
  C.hint("바닥을 쓰는 팔은 점프로 넘어요!");
  s = C.s;
  C.tunnel(200, { hw: 5.5, slope: 0.12, turn: -0.3 });
  C.sweeper(s + 30, 0, { L: 4.6, speed: 1.7 });
  C.sweeper(s + 75, -2.8, { L: 2.6, speed: -2.0 });
  C.sweeper(s + 75, 2.8, { L: 2.6, speed: 2.0, phase: 0.5 });
  C.rotor(s + 120, { speed: 1.3 });
  C.sweeper(s + 165, 0, { L: 4.6, speed: -1.9, phase: 0.25 });
  C.orbs(s + 40, s + 60, 0, 0, 3);
  C.orbs(s + 130, s + 150, 0, 0, 3);
  C.run(30, { hw: 7 });
  rampGap(C, 12, 2.6, 12);
  C.cp();
  C.hint("마지막 터널! 날개 · 쓰는 팔 · 끊긴 바닥이 모두 나와요");
  s = C.s;
  C.tunnel(130, { hw: 5, slope: 0.12, turn: 0.35 });
  C.rotor(s + 30, { speed: 1.6, arms: 4, blade: 0.55 });
  C.sweeper(s + 70, 0, { L: 4.4, speed: 2.1 });
  C.rotor(s + 110, { speed: -1.5, arms: 3 });
  C.orbs(s + 40, s + 60, 0, 0, 3);
  const t2 = C.s;
  C.gap(6);
  C.arc(t2 - 3, t2 + 9, 0, 1.6, 3);
  s = C.s;
  C.tunnel(110, { hw: 5, slope: 0.12, turn: -0.25 });
  C.rotor(s + 25, { speed: 1.4 });
  C.sweeper(s + 60, 0, { L: 4.4, speed: -2.2 });
  C.rotor(s + 95, { speed: -1.7, arms: 2, blade: 1.1 });
  C.def.tunnels[C.def.tunnels.length - 2][1] = t2; // 앞 터널은 틈 앞에서 끝
  C.run(20, { hw: 7 });
  C.stopLava(C.s);
  C.finish({ approach: 10 });
  return C.done({ theme: "tunnel" });
}

/* ================================================================
 * STAGE 11 · 화염 톱니 절벽
 * ============================================================== */
function s11() {
  const C = begin(11, "화염 톱니 절벽", { hw: 7, walls: "left" });
  C.lava(34, 1.0);
  C.hint("절벽 길! 오른쪽은 낭떠러지 · 불꽃 톱니를 피해요");
  C.run(50, { walls: "left" });
  seg(C, 160, { hw: 7, slope: 0.13, turn: 0.3, walls: "left" }, (s) => {
    C.wheel(s + 30, -5, 5, { period: 2.6 });
    C.wheel(s + 70, 5, -5, { period: 2.2 });
    C.wheel(s + 110, -5, 0, { period: 1.8 });
    C.wheel(s + 110, 5, 0.5, { period: 1.8, phase: 0.5 });
    C.orbs(s + 40, s + 60, 0, 0, 3);
    C.orbs(s + 80, s + 100, 0, 0, 3);
  });
  C.hint("오르내리는 바위 발판! 높이 올라왔을 때 뛰어올라요");
  C.run(20, { walls: "left" });
  hop(C, [
    { d: 16, u: 0, lift: { amp: 1.3, period: 3.2, phase: 0 }, h: -0.8 },
    { d: 38, u: 0, lift: { amp: 1.3, period: 3.2, phase: 0.5 }, h: -0.8 },
  ]);
  C.run(40, { walls: "left" });
  C.cp();
  C.hint("체크포인트 다음은 더 어려워요! 낮은 통나무는 점프");
  seg(C, 180, { hw: 6.5, slope: 0.14, turn: -0.35, walls: "left" }, (s) => {
    C.wheel(s + 25, -4.5, 4.5, { period: 1.8 });
    C.bar(s + 50, -6.5, 6.5, { h: 0.8, look: "log" });
    C.wheel(s + 75, 4.5, -4.5, { period: 1.6 });
    C.fire(s + 100, -2.5, { period: 2.2 });
    C.fire(s + 100, 2.5, { period: 2.2, phase: 0.5 });
    C.bar(s + 125, -6.5, 6.5, { h: 0.8, look: "log" });
    C.wheel(s + 150, -4.5, 4.5, { period: 1.5, phase: 0.3 });
    C.orbs(s + 40, s + 60, 0, 0, 3);
  });
  C.run(15, { walls: "left" });
  hop(C, [
    { d: 16, u: 0, lift: { amp: 1.4, period: 2.8, phase: 0.1 }, h: -0.8 },
    { d: 38, u: 1.5, lift: { amp: 1.4, period: 2.8, phase: 0.45 }, h: -0.8 },
    { d: 60, u: -1, lift: { amp: 1.4, period: 2.8, phase: 0.8 }, h: -0.8 },
  ]);
  C.run(30, { walls: "left" });
  C.cp();
  C.hint("마지막 톱니 길! 박자를 맞춰 달려요");
  seg(C, 150, { hw: 7, slope: 0.14, turn: 0.3, walls: "left" }, (s) => {
    for (let i = 0; i < 5; i++) C.wheel(s + 20 + i * 26, i % 2 ? 5 : -5, i % 2 ? -5 : 5, { period: 1.7 + (i % 3) * 0.2, phase: i * 0.2 });
    C.orbs(s + 10, s + 140, 0, 0, 10);
  });
  C.run(20, { walls: "both" });
  const g = rampGap(C, 12, 3.0, 14, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "cliffs" });
}

/* ================================================================
 * STAGE 12 · 마그마 발전소
 * ============================================================== */
function s12() {
  const C = begin(12, "마그마 발전소", { hw: 8.5 });
  C.lava(34, 1.0);
  C.hint("마그마 발전소! 문은 열리고 닫혀요 · 초록불일 때 통과!");
  C.run(50, { style: "metal" });
  for (let d = 80; d < 1400; d += 70) C.decor("pipeArch", d);
  seg(C, 160, { style: "metal", slope: 0.12, turn: 0.25 }, (s) => {
    C.gate(s + 45, -2, 2, { period: 3, open: 0.65 });
    C.gate(s + 110, 1.5, 6, { period: 2.6, open: 0.65, phase: 0.3 });
    C.orbs(s + 20, s + 40, 0, 0, 3);
    C.orbs(s + 80, s + 100, 3.7, 3.7, 3);
  });
  C.hint("빨간 레이저는 점프로 넘어요!");
  seg(C, 140, { style: "metal", slope: 0.12, turn: -0.25 }, (s) => {
    C.laser(s + 30, { period: 2.4, on: 1.1 });
    C.laser(s + 60, { period: 2.0, on: 1.0, phase: 0.5 });
    C.laser(s + 90, { period: 99, on: 98, warn: 0.5 });
    C.laser(s + 118, { period: 2.2, on: 1.2 });
    C.orbs(s + 88, s + 92, 0, 0, 1, 1.9);
  });
  C.cp();
  C.hint("발판 스위치를 밟으면 문이 열려요! 초록 버튼으로!");
  seg(C, 170, { style: "metal", slope: 0.12, hw: 8 }, (s) => {
    C.gate(s + 60, -2.5, 2.5, { sw: { s: s + 25, u: -5 } });
    C.gate(s + 135, -2.5, 2.5, { sw: { s: s + 100, u: 5 } });
    C.orbs(s + 20, s + 30, -5, -5, 2);
    C.orbs(s + 95, s + 105, 5, 5, 2);
  });
  C.hint("에너지 벽이 좌우로 움직여요");
  seg(C, 140, { style: "metal", slope: 0.12, turn: 0.3 }, (s) => {
    C.slider(s + 30, -6, 6, { look: "fence", h: 2.4, period: 3 });
    C.slider(s + 75, 6, -6, { look: "fence", h: 2.4, period: 2.6 });
    C.slider(s + 115, -6, 0, { look: "fence", h: 2.4, period: 2.0 });
    C.slider(s + 115, 6, 0.5, { look: "fence", h: 2.4, period: 2.0, phase: 0.5 });
  });
  C.cp();
  C.hint("마지막 공장 구역! 문 · 레이저 · 파이프가 섞여 있어요");
  seg(C, 200, { style: "metal", slope: 0.13, turn: -0.3 }, (s) => {
    C.bar(s + 25, -8.5, 8.5, { h: 0.8, look: "pipe" });
    C.gate(s + 60, -6, -1.5, { period: 2.8, open: 0.65 });
    C.laser(s + 95, { period: 2.0, on: 1.0 });
    C.gate(s + 130, -2, 2, { sw: { s: s + 108, u: 5.5 } });
    C.laser(s + 165, { period: 1.8, on: 0.9, phase: 0.4 });
    C.bar(s + 185, -8.5, 8.5, { h: 0.8, look: "pipe" });
    C.orbs(s + 40, s + 55, -3.7, -3.7, 3);
  });
  C.run(20, { style: "metal" });
  const g = rampGap(C, 12, 3.0, 14, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "plant" });
}

/* ================================================================
 * STAGE 13 · 화산 위의 폭풍
 * ============================================================== */
function s13() {
  const C = begin(13, "화산 위의 폭풍", { hw: 9 });
  C.lava(34, 1.0);
  C.hint("돌풍이 불면 옆으로 밀려요 · 반대쪽으로 버텨요!");
  C.run(50);
  seg(C, 160, { slope: 0.12, turn: 0.2 }, (s) => {
    C.wind(s + 15, s + 75, 5, { period: 3.4, on: 1.6 });
    C.wind(s + 85, s + 150, -5, { period: 3.4, on: 1.6, phase: 0.5 });
    C.sign(s + 5, -6, "wind");
    C.orbs(s + 20, s + 150, 0, 0, 10);
  });
  C.hint("번개 칠 곳에 빛나는 원이 생겨요 · 피해요!");
  seg(C, 150, { slope: 0.13, turn: -0.3 }, (s) => {
    for (let d = 20; d < 145; d += 18) C.bomb(s + d, ((d * 11) % 13) - 6, { kind: "bolt", trigger: 42, flight: 1.2, r: 1.7 });
  });
  C.cp();
  C.hint("점프할 때 바람이 더 세게 밀어요!");
  C.run(30);
  {
    const s = C.s;
    C.wind(s - 5, s + 45, 6);
    rampGap(C, 12, 2.4, 14, { after: 20 });
    const s2 = C.s;
    C.wind(s2 - 5, s2 + 40, -6);
    jumpGap(C, 7, { after: 20 });
  }
  C.hint("부서지는 바위 길! 금 간 곳은 무너져요");
  seg(C, 140, { hw: 7, walls: "none", slope: 0.13, turn: 0.3 }, (s) => {
    C.crumble(s + 20, s + 32, -7, -0.5);
    C.crumble(s + 50, s + 62, 0.5, 7);
    C.crumble(s + 85, s + 97, -7, -1);
    C.bomb(s + 70, 0, { kind: "bolt", trigger: 42 });
    C.bomb(s + 115, -2, { kind: "bolt", trigger: 42 });
  });
  C.cp();
  C.hint("폭풍의 한가운데! 바람 · 번개 · 무너지는 땅");
  seg(C, 200, { hw: 8, slope: 0.14, turn: -0.35 }, (s) => {
    C.wind(s + 10, s + 190, 5.5, { period: 2.8, on: 1.3 });
    C.wind(s + 10, s + 190, -5.5, { period: 2.8, on: 1.3, phase: 0.5 });
    for (let d = 30; d < 190; d += 26) C.bomb(s + d, ((d * 7) % 11) - 5, { kind: "bolt", trigger: 42 });
    C.crumble(s + 60, s + 72, 1, 8);
    C.crumble(s + 120, s + 132, -8, -1);
    C.orbs(s + 20, s + 190, 0, 0, 12);
  });
  C.fog(C.s - 360, C.s, 18, 130);
  C.run(20);
  const g = rampGap(C, 12, 3.0, 14, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "storm" });
}

/* ================================================================
 * STAGE 14 · 용의 둥지
 * ============================================================== */
function s14() {
  const C = begin(14, "용의 둥지", { hw: 9 });
  C.lava(32, 1.0);
  C.hint("용의 둥지! 반짝이는 보석은 점수가 커요");
  C.run(50, { style: "bone" });
  for (let d = 70; d < 1300; d += 34) C.decor("rib", d, { h: 9 + ((d * 7) % 5) });
  seg(C, 160, { style: "bone", slope: 0.12, turn: 0.25 }, (s) => {
    C.slider(s + 35, -6, 6, { look: "claw", h: 3.2, period: 3.2 });
    C.slider(s + 85, 6, -6, { look: "claw", h: 3.2, period: 2.8 });
    C.slider(s + 130, -6, 6, { look: "claw", h: 3.2, period: 2.4 });
    C.big(s + 60, 0, 1.2);
    C.big(s + 108, 0, 1.2);
  });
  C.hint("낮은 꼬리는 점프로 넘어요!");
  seg(C, 140, { style: "bone", slope: 0.12, turn: -0.25 }, (s) => {
    C.slider(s + 30, -6, 6, { look: "tail", h: 0.85, period: 2.6, w: 2.4 });
    C.slider(s + 70, 6, -6, { look: "tail", h: 0.85, period: 2.4, w: 2.4 });
    C.slider(s + 110, -6, 6, { look: "tail", h: 0.85, period: 2.2, w: 2.4 });
    C.spire(s + 50, -5, { look: "bone", r: 1.0, h: 5 });
    C.spire(s + 90, 5, { look: "bone", r: 1.0, h: 5 });
    C.orbs(s + 20, s + 130, 0, 0, 8);
  });
  C.cp();
  C.hint("불덩이가 날아와요 · 붉은 원을 피해요!");
  seg(C, 170, { style: "bone", slope: 0.13, turn: 0.3 }, (s) => {
    for (let d = 20; d < 165; d += 16) C.bomb(s + d, ((d * 5) % 11) - 5, { from: "front", kind: "fire", trigger: 50, flight: 1.5, r: 1.8 });
    C.big(s + 90, 0, 1.2);
  });
  C.cp();
  C.hint("둥지 깊은 곳! 발톱 · 꼬리 · 불덩이 · 뼈 가시");
  seg(C, 200, { style: "bone", slope: 0.13, turn: -0.3 }, (s) => {
    C.slider(s + 25, -6, 6, { look: "claw", h: 3.2, period: 2.4 });
    C.slider(s + 55, 6, -6, { look: "tail", h: 0.85, period: 2.2, w: 2.4 });
    C.bomb(s + 80, -2, { from: "front", kind: "fire", trigger: 50 });
    C.bomb(s + 92, 3, { from: "front", kind: "fire", trigger: 50 });
    C.spire(s + 110, 0, { look: "crystal", r: 1.2, h: 5 });
    C.slider(s + 135, -6, 6, { look: "claw", h: 3.2, period: 2.2, phase: 0.4 });
    C.slider(s + 165, 6, -6, { look: "tail", h: 0.85, period: 2.0, w: 2.4 });
    C.big(s + 150, 0, 1.2);
    C.orbs(s + 10, s + 190, 0, 0, 10);
  });
  C.run(20, { style: "bone" });
  const g = rampGap(C, 12, 3.0, 14, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "nest" });
}

/* ================================================================
 * STAGE 15 · 용암 절벽 최종 질주
 * ============================================================== */
function s15() {
  const C = begin(15, "용암 절벽 최종 질주", { hw: 9 });
  C.lava(30, 1.02);
  C.hint("마지막 질주! 지금까지 배운 걸 모두 써요");
  C.run(50);
  seg(C, 170, { walls: "left", slope: 0.14, turn: 0.3 }, (s) => {
    C.crumble(s + 25, s + 37, 0.5, 9);
    C.crumble(s + 60, s + 72, 0.5, 9);
    C.crumble(s + 95, s + 107, -2, 9);
    C.rock(s + 45, -4);
    C.rock(s + 80, -3);
    C.roll(s + 135, -1, { speed: 10 });
    C.orbs(s + 20, s + 160, -4, -4, 10);
  });
  seg(C, 140, { walls: "both", slope: 0.14, turn: -0.3 }, (s) => {
    [20, 50, 80, 110].forEach((d, i) => {
      C.fire(s + d, -4, { period: 2.2, phase: i * 0.25 });
      C.fire(s + d, 0, { period: 2.2, phase: i * 0.25 + 0.33 });
      C.fire(s + d, 4, { period: 2.2, phase: i * 0.25 + 0.66 });
    });
  });
  C.cp();
  C.hint("용암 파도가 빨라졌어요! 폭포 사이로 달려요");
  C.lava(24, 1.06);
  seg(C, 160, { slope: 0.14, turn: 0.3 }, (s) => {
    C.lavafall(s + 25, -9, -1);
    C.lavafall(s + 55, 1, 9);
    C.lavafall(s + 85, -9, 9, { period: 2.8, on: 1.0 });
    C.bomb(s + 110, 2, { from: "side", kind: "lava", trigger: 40 });
    C.bomb(s + 130, -3, { from: "side", kind: "lava", trigger: 40 });
    C.boost(s + 145, 0);
  });
  C.run(20);
  hop(C, [
    { d: 16, u: 0 },
    { d: 38, u: 2, sink: true },
    { d: 60, u: -1.5, sink: true },
  ]);
  C.run(30);
  C.cp();
  C.hint("용의 영역이 보여요! 끝까지 달려요!");
  seg(C, 200, { hw: 9, slope: 0.15, turn: -0.35 }, (s) => {
    C.slider(s + 25, -7, 7, { look: "boulder", h: 3, period: 2.6 });
    C.erupt(s + 60, 4.5, { period: 3.8, ring: 15, debris: 2 });
    C.bomb(s + 90, -2, { trigger: 44 });
    C.slider(s + 115, 7, -7, { look: "boulder", h: 3, period: 2.4 });
    C.fire(s + 145, -2.5, { period: 2.0 });
    C.fire(s + 145, 2.5, { period: 2.0, phase: 0.5 });
    C.boost(s + 175, 0);
    C.orbs(s + 10, s + 190, 0, 0, 12);
  });
  C.run(25);
  C.decor("dragonGate", C.s - 6);
  const g = rampGap(C, 14, 3.6, 18, { after: 0 });
  C.stopLava(g);
  C.finish({ approach: 20 });
  return C.done({ theme: "final" });
}

/* ================================================================
 * 보스 경기장 (긴 내리막 · 정적 장애물 없음 · 용암 추격 없음)
 * ============================================================== */
function bossCourse(id, name, theme, { ramps = false, len = 4600, hw = 11 } = {}) {
  const C = begin(id, name, { hw });
  C.def.noLava = true;
  C.lava(80, 1.0);
  C.run(60, { hw });
  const rnd = seeded(id * 13);
  let n = 0;
  while (C.s < len) {
    if (ramps) {
      // 고대 용 보스: 약점을 노리는 점프대 (틈 없이 튀어 오르기만) — 약 150m 마다
      C.run(80, { hw, slope: 0.1 + rnd() * 0.03, turn: (rnd() - 0.5) * 0.4 });
      C.run(30, { hw, slope: 0.1 });
      C.ramp(14, 3.2, { hw });
      C.run(26, { hw, slope: 0.1 });
    } else C.run(140, { hw, slope: 0.1 + rnd() * 0.04, turn: (rnd() - 0.5) * 0.6 });
    n++;
  }
  C.finish({ approach: 10 });
  return C.done({ theme });
}

/* ================================================================
 * 무한 도전: 지금까지의 장치를 섞어 끝없이 (멀리 갈수록 어려워짐)
 * ============================================================== */
function endless(seed = 1) {
  const C = begin(99, "무한 도전", { hw: 9.5 });
  C.lava(40, 0.98);
  C.hint("무한 도전! 얼마나 멀리 갈 수 있을까요?");
  C.run(60);
  const rnd = seeded(seed * 7 + 3);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const R = (a, b) => a + rnd() * (b - a);
  const LEN = 9000;
  let lastCp = C.s;
  let k = 0;
  while (C.s < LEN) {
    const d = Math.min(1, C.s / 5000); // 어려움 0 → 1
    const turn = (rnd() - 0.5) * 0.7;
    const hw = 9 - d * 1.5;
    const kind = pick(["rocks", "zig", "sliders", "rolls", "fire", "ramp", "hops", "bombs", "erupt", "lasers", "gates", "sweep", "wheels", "falls", "bars", "crumble", "claws", "wind", "free"]);
    if (kind === "rocks")
      seg(C, 110, { hw, turn }, (s) => {
        for (let i = 0; i < 6 + d * 4; i++) C.rock(s + 12 + i * (90 / (6 + d * 4)), R(-hw + 1.5, hw - 1.5));
        C.orbs(s + 10, s + 100, 0, 0, 6);
      });
    else if (kind === "zig")
      seg(C, 120, { hw, turn }, (s) => {
        for (let i = 0; i < 5; i++) C.spire(s + 15 + i * 22, (i % 2 ? 1 : -1) * R(2.5, 4), { look: pick(["obsidian", "redrock", "basalt", "crystal"]) });
      });
    else if (kind === "sliders")
      seg(C, 120, { hw, turn }, (s) => {
        for (let i = 0; i < 3; i++) C.slider(s + 25 + i * 35, -hw + 2, hw - 2, { look: pick(["obsidian", "boulder", "fence"]), h: 2.6, period: R(3.2, 2.2 - d * 0.4), phase: rnd() });
      });
    else if (kind === "rolls")
      seg(C, 110, { hw, turn }, (s) => {
        C.roll(s + 35, -1, { speed: 8.5 + d * 2 });
        C.roll(s + 80, 1, { speed: 8.5 + d * 2 });
      });
    else if (kind === "fire")
      seg(C, 120, { hw, turn }, (s) => {
        for (let i = 0; i < 4; i++) for (const u of [-3.5, 0, 3.5]) if (rnd() < 0.55 + d * 0.2) C.fire(s + 20 + i * 26, u, { period: R(2.2, 3), phase: rnd() });
      });
    else if (kind === "ramp") {
      C.run(20, { hw });
      rampGap(C, 12, R(2.4, 3.2), R(10, 14 + d * 3));
    } else if (kind === "hops") {
      C.run(20, { hw: 6, walls: "none" });
      const n = 2 + Math.round(d * 2);
      hop(
        C,
        Array.from({ length: n }, (_, i) => ({ d: 16 + i * 22, u: R(-2, 2), sink: rnd() < d * 0.6 }))
      );
      C.run(20, { hw, walls: "both" });
    } else if (kind === "bombs")
      seg(C, 130, { hw, turn }, (s) => {
        const kd = pick(["rock", "lava", "fire", "bolt"]);
        for (let dd = 20; dd < 125; dd += 18 - d * 4) C.bomb(s + dd, R(-hw + 1.5, hw - 1.5), { kind: kd, from: kd === "fire" ? "front" : kd === "lava" ? "side" : "sky", trigger: 44 });
      });
    else if (kind === "erupt")
      seg(C, 120, { hw: hw + 1, turn }, (s) => {
        C.erupt(s + 40, -5, { period: 4.4, ring: 14, debris: 2, phase: rnd() });
        C.erupt(s + 90, 5, { period: 4.4, ring: 14, debris: 2, phase: rnd() });
      });
    else if (kind === "lasers")
      seg(C, 110, { hw, turn, style: "metal" }, (s) => {
        for (let i = 0; i < 3; i++) C.laser(s + 25 + i * 30, { period: R(2, 2.6), on: 1.0, phase: rnd() });
      });
    else if (kind === "gates")
      seg(C, 120, { hw, turn, style: "metal" }, (s) => {
        const a = R(-hw + 2, hw - 6);
        C.gate(s + 40, a, a + 4.5, { period: R(2.6, 3.2), open: 0.65, phase: rnd() });
        const b = R(-hw + 2, hw - 6);
        C.gate(s + 95, b, b + 4.5, { period: R(2.6, 3.2), open: 0.65, phase: rnd() });
      });
    else if (kind === "sweep")
      seg(C, 110, { hw: Math.min(hw, 7), turn }, (s) => {
        C.sweeper(s + 35, 0, { L: 4.4, speed: 1.6 + d, phase: rnd() });
        C.sweeper(s + 80, 0, { L: 4.4, speed: -(1.6 + d), phase: rnd() });
      });
    else if (kind === "wheels")
      seg(C, 110, { hw: 7, turn }, (s) => {
        C.wheel(s + 35, -5, 5, { period: R(1.8, 2.6), phase: rnd() });
        C.wheel(s + 80, 5, -5, { period: R(1.8, 2.6), phase: rnd() });
      });
    else if (kind === "falls")
      seg(C, 110, { hw, turn }, (s) => {
        const g1 = R(-3, 3);
        C.lavafall(s + 35, -hw - 0.5, g1 - 2);
        C.lavafall(s + 35, g1 + 2, hw + 0.5);
        const g2 = R(-3, 3);
        C.lavafall(s + 80, -hw - 0.5, g2 - 2);
        C.lavafall(s + 80, g2 + 2, hw + 0.5);
        C.orbs(s + 35, s + 35, g1, g1, 1);
        C.orbs(s + 80, s + 80, g2, g2, 1);
      });
    else if (kind === "bars")
      seg(C, 100, { hw, turn }, (s) => {
        for (let i = 0; i < 3; i++) C.bar(s + 25 + i * 26, -hw, hw, { h: 0.8, look: pick(["log", "pipe", "bone"]) });
      });
    else if (kind === "crumble")
      seg(C, 120, { hw, turn }, (s) => {
        C.crumble(s + 25, s + 37, -hw, -0.5);
        C.crumble(s + 65, s + 77, 0.5, hw);
      });
    else if (kind === "claws")
      seg(C, 120, { hw, turn, style: "bone" }, (s) => {
        C.slider(s + 30, -6, 6, { look: "claw", h: 3.2, period: R(2.4, 3) });
        C.slider(s + 80, 6, -6, { look: "tail", h: 0.85, period: R(2.2, 2.8), w: 2.4 });
      });
    else if (kind === "wind")
      seg(C, 120, { hw, turn }, (s) => {
        C.wind(s + 10, s + 110, (rnd() < 0.5 ? -1 : 1) * (4 + d * 2), { period: 3, on: 1.5, phase: rnd() });
        C.orbs(s + 10, s + 110, 0, 0, 8);
      });
    else seg(C, 70, { hw, turn }, (s) => C.orbs(s + 10, s + 60, R(-3, 3), R(-3, 3), 6));
    if (C.s - lastCp > 520) {
      C.run(16, { hw: 9, walls: "both", style: null });
      C.cp();
      C.run(10);
      lastCp = C.s;
      C.lava(Math.max(18, 36 - d * 16), 1 + d * 0.1);
    }
    k++;
  }
  C.finish({ approach: 20 });
  return C.done({ theme: "endless" });
}

/* ================================================================
 * 스테이지 목록
 * ============================================================== */
export const WORLDS = [
  { id: 1, name: "화산의 시작" },
  { id: 2, name: "불꽃의 협곡" },
  { id: 3, name: "용암 바다" },
  { id: 4, name: "화산의 심장" },
  { id: 5, name: "용의 영역" },
];
export const STAGES = [
  { id: 1, no: 1, world: 1, name: "검은 화산 경사면", build: s01, theme: "basalt", par: 62, intro: "넓은 경사면에서 좌우 · 점프 · 부스터를 익혀요" },
  { id: 2, no: 2, world: 1, name: "불타는 바위 계곡", build: s02, theme: "canyon", par: 62, intro: "좌우로 굴러다니는 거대한 바위 · 좁아지는 계곡" },
  { id: 3, no: 3, world: 1, name: "무너지는 용암 다리", build: s03, theme: "bridge", par: 64, intro: "금 간 돌다리는 곧 무너져요 · 끊긴 다리는 점프!" },
  { id: 4, no: 4, world: 2, name: "불기둥 협곡", build: s04, theme: "firecanyon", par: 60, intro: "불기둥마다 솟는 박자가 달라요" },
  { id: 5, no: 5, world: 2, name: "용암 폭포", build: s05, theme: "falls", par: 60, intro: "쏟아지는 용암 폭포 사이 좁은 길 · 날아오는 용암" },
  { id: 6, no: 6, world: 2, name: "폭발하는 화산 분화구", build: s06, theme: "crater", par: 62, intro: "분출 충격파는 점프로 · 떨어지는 바위는 피해서" },
  { id: 7, boss: "golem", world: 2, name: "화산 골렘", build: () => bossCourse(107, "화산 골렘", "golem"), theme: "golem", par: 110, intro: "길을 막는 거대한 골렘! 공격 뒤 드러나는 약점에 돌진!" },
  { id: 8, no: 7, world: 3, name: "용암 호수", build: s07, theme: "lake", par: 54, intro: "바위 발판을 점프로 건너요 · 가라앉는 발판 조심" },
  { id: 9, no: 8, world: 3, name: "검은 현무암 미로", build: s08, theme: "maze", par: 60, intro: "표지판을 보고 길을 골라요 · 막다른 길은 용암 구덩이" },
  { id: 10, no: 9, world: 3, name: "용암 파도 추격전", build: s09, theme: "chase", par: 58, intro: "거대한 용암 파도가 바짝 쫓아와요!" },
  { id: 11, no: 10, world: 4, name: "회전하는 화산 터널", build: s10, theme: "tunnel", par: 52, intro: "도는 날개의 빈틈 · 바닥을 쓰는 팔은 점프" },
  { id: 12, no: 11, world: 4, name: "화염 톱니 절벽", build: s11, theme: "cliffs", par: 56, intro: "불꽃 톱니 · 오르내리는 바위 발판" },
  { id: 13, no: 12, world: 4, name: "마그마 발전소", build: s12, theme: "plant", par: 60, intro: "열리고 닫히는 문 · 레이저 · 스위치 발판" },
  { id: 14, boss: "wyvern", world: 4, name: "불꽃 와이번", build: () => bossCourse(114, "불꽃 와이번", "wyvern"), theme: "wyvern", par: 120, intro: "하늘에서 쫓아오는 와이번! 얼음 수정을 모아 반격!" },
  { id: 15, no: 13, world: 5, name: "화산 위의 폭풍", build: s13, theme: "storm", par: 60, intro: "돌풍 · 번개 · 부서지는 바위 · 낮은 시야" },
  { id: 16, no: 14, world: 5, name: "용의 둥지", build: s14, theme: "nest", par: 58, intro: "용의 발톱 · 꼬리 · 날아오는 불덩이" },
  { id: 17, no: 15, world: 5, name: "용암 절벽 최종 질주", build: s15, theme: "final", par: 64, intro: "모든 장치가 섞인 최종 코스 · 그 끝은 용의 영역" },
  { id: 18, boss: "dragon", world: 5, name: "고대 용", build: () => bossCourse(118, "고대 용", "dragon", { ramps: true }), theme: "dragon", par: 150, intro: "최종 보스! 점프대에서 날아올라 약점을 노려요" },
];
export const ENDLESS = { id: 99, endless: true, world: 0, name: "무한 도전", build: endless, theme: "endless", intro: "끝없이 이어지는 코스 · 얼마나 멀리 갈 수 있을까요?" };
export function stageLabel(def) {
  if (def.endless) return "ENDLESS";
  if (def.boss) return `BOSS ${def.boss === "golem" ? 1 : def.boss === "wyvern" ? 2 : 3}`;
  return `STAGE ${String(def.no).padStart(2, "0")}`;
}
