// out/*.txt 후보에서 골라 games/jelly-factory/js/levels.js 를 만든다
// node scripts/jelly-gen/build.mjs   (out/<설계도>.txt 후보 중 PICK_tXX 번째(기본 0)를 스테이지로, 나머지를 오늘의 퍼즐로)
import fs from "node:fs";
import { RECIPES } from "./recipes.mjs";
import { solve } from "../jelly-solver.mjs";

/** 지금 규칙(가지치기 포함)으로 가장 짧은 풀이를 다시 확인 → 더 짧으면 그것으로 */
function exact(c, goals) {
  const w = c.map[0].length;
  const r = solve({ map: c.map, goals, moves: c.par }, { maxDepth: c.par });
  if (!r.ok) return false;
  if (r.par < c.par) {
    c.par = r.par;
    c.sol = r.path.map(([i, d]) => [i % w, Math.floor(i / w), d]);
  }
  return true;
}

const OUT = new URL("./out/", import.meta.url);
function read(t) {
  let txt = "";
  try {
    txt = fs.readFileSync(new URL(t + ".txt", OUT), "utf8");
  } catch (_) {
    return [];
  }
  const list = [];
  let cur = null;
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^--- par (\d+)/);
    if (m) {
      cur = { par: Number(m[1]), map: [], sol: null };
      list.push(cur);
      continue;
    }
    if (!cur) continue;
    const mm = line.match(/^\s+"([^"]+)",$/);
    if (mm) cur.map.push(mm[1]);
    const ms = line.match(/풀이 (\[.*\])/);
    if (ms) cur.sol = JSON.parse(ms[1]);
  }
  return list.filter((c) => c.sol && c.map.length);
}

const META = [
  ["t01", "첫 출근", "젤리를 누른 채 밀어 보세요. 젤리는 벽이나 다른 것에 닿을 때까지 쭉 미끄러져요. 같은 색 3개가 붙으면 합쳐져요!"],
  ["t02", "두 줄 반죽", "목표가 '모두 없애기'예요. 두 가지 색을 모두 3개씩 이어 주세요."],
  ["t03", "미끌미끌 바닥", "기계 블록 앞에서 멈추는 것을 이용해요. 젤리를 누르면 어디서 멈출지 미리 보여요."],
  ["t04", "세 가지 맛", ""],
  ["t05", "콤보 맛보기", "이동할 때마다 계속 이으면 콤보! 점수가 점점 커져요. 4개를 이으면 점수가 더 많아요."],
  ["t06", "번쩍 번개", "같은 색 4개를 한 줄로 이으면 번개 젤리가 생겨요. 번개 젤리를 밀면 멈춘 줄 전체가 펑!"],
  ["t07", "반짝 별", "같은 색 4개를 T자로 이으면 별 젤리! 밀면 멈춘 자리 둘레 3×3 이 펑!"],
  ["t08", "통통 튕김 패드", "튕김 패드를 지나가면 화살표 쪽으로 방향이 꺾여요."],
  ["t09", "끈적끈적", "끈적판에 들어간 젤리는 그 자리에 딱 멈춰요."],
  ["t10", "기초 졸업 시험", "지금까지 배운 장치를 모두 써 봐요."],
  ["t11", "쿠키 상자 배달", "쿠키 상자는 못 움직여요. 바로 옆에서 젤리를 이으면 깨져요."],
  ["t12", "단단한 상자", "쇠 띠를 두른 상자는 두 번 이어야 깨져요."],
  ["t13", "꽁꽁 냉동실", "꽁꽁 젤리는 못 움직이지만, 같은 색과 이어지거나 바로 옆에서 이으면 녹아요."],
  ["t14", "파이프 여행", "같은 숫자 파이프로 쏙 들어가 나와서 같은 방향으로 계속 가요."],
  ["t15", "튕김 미로", "패드를 여러 번 지나며 꺾이는 길을 잘 봐요."],
  ["t16", "좁은 작업대", "두 가지 색 목표를 함께 채워야 해요."],
  ["t17", "폭신폭신 청소", "4개를 ㄱ자나 S자로 이으면 폭신 젤리! 밀면 둘레 5×5 의 상자를 부수고 얼음을 녹여요."],
  ["t18", "번개 배달", "번개 젤리로 상자를 한꺼번에 깨 봐요."],
  ["t19", "얼음과 쿠키", ""],
  ["t20", "장치 졸업 시험", ""],
  ["t21", "무지개 공장", "5개 이상 이으면 무지개 젤리! 밀어서 부딪힌 젤리와 같은 색을 모두 없애요."],
  ["t22", "연쇄 반응", "특수 젤리 효과가 다른 특수 젤리에 닿으면 그것도 터져요."],
  ["t23", "특수 생산 라인", ""],
  ["t24", "파이프 냉동고", ""],
  ["t25", "꽉 찬 창고", ""],
  ["t26", "점수 대폭발", "큰 무리 · 콤보 · 특수 젤리로 점수를 크게 모아요."],
  ["t27", "얼음 성", ""],
  ["t28", "번개 철거반", ""],
  ["t29", "끈적 미로 창고", ""],
  ["t30", "공장장 시험", "마지막 시험! 모든 장치와 특수 젤리를 써 봐요."],
];
const DAILY_NAMES = ["아침 반죽", "말랑 출근길", "젤리 포장", "오후 간식", "포근 창고", "반짝 점검", "쫀득 라인", "콩떡 배달", "달콤 작업대", "통통 컨베이어", "말랑 정리", "꿀렁 퍼즐", "야근 공장", "주말 특근", "몽글 회의", "콩콩 조립", "퐁퐁 세척", "통통 운반", "쫀득 시식", "젤리 품평회", "공장 축제", "새 기계 시험", "점심 도시락", "말랑 체조", "젤리 반상회", "상자 쌓기", "출고 준비", "재고 정리", "공장 견학", "말랑 산책", "새벽 반죽", "쫀득 마감", "콩떡 시험", "젤리 경주", "몽글 낮잠", "꿀렁 회전", "말랑 퀴즈", "젤리 줄서기", "주문 폭주", "공장 대청소", "달빛 야근", "말랑 소풍", "젤리 택배", "콩떡 잔치", "말랑 운동회", "쫀득 연구", "통통 행진", "몽글 노래", "퐁퐁 목욕", "젤리 사진관"];

const slackFor = (tier, id) => (tier === 1 ? (id <= 3 ? 3 : 3) : tier === 2 ? 2 : id >= 28 ? 1 : 2);
const stages = [];
const daily = [];
const missing = [];
META.forEach(([t, name, tip], k) => {
  const id = k + 1;
  const tier = id <= 10 ? 1 : id <= 20 ? 2 : 3;
  const cands = read(t);
  const pick = Number(process.env["PICK_" + t] || 0);
  const c = cands[pick];
  if (!c) {
    missing.push(t);
    return;
  }
  const R = RECIPES[t];
  if (!exact(c, R.goals)) {
    missing.push(t + "(재확인 실패)");
    return;
  }
  stages.push({ id, name, tier, map: c.map, goals: R.goals, moves: c.par + slackFor(tier, id), par: c.par, sol: c.sol, tip: tip || undefined });
  // 남은 후보는 오늘의 퍼즐로 (너무 쉬운 1~3번 설계도는 빼고)
  if (id >= 4) cands.forEach((d, j) => j !== pick && exact(d, R.goals) && d.par >= 3 && daily.push({ map: d.map, goals: R.goals, moves: d.par + 2, par: d.par, sol: d.sol, from: t }));
});
daily.forEach((d, i) => (d.name = DAILY_NAMES[i % DAILY_NAMES.length] + (i >= DAILY_NAMES.length ? " 2" : "")));

const fmt = (o) => {
  const lines = [`  {`];
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || k === "from") continue;
    if (k === "map") lines.push(`    map: [\n${v.map((r) => `      "${r}",`).join("\n")}\n    ],`);
    else lines.push(`    ${k}: ${JSON.stringify(v)},`);
  }
  lines.push(`  },`);
  return lines.join("\n");
};
const src = `/*
 * 말랑콩떡! 젤리 공장 · 스테이지 30개 + 오늘의 퍼즐 모음 (자동 생성 · 자동 검증)
 *
 *  모든 판은 규칙 엔진(engine.js)과 같은 코드를 쓰는 자동 풀이기(scripts/jelly-solver.mjs)로
 *  - 처음 판에 이미 3개 이어진 곳이 없고
 *  - par = 가장 짧은 풀이의 이동 수 (너비 우선으로 모두 찾아 봄)
 *  - sol = 실제로 두어 보면 깨지는 풀이 (적어 둔 그대로)
 *  - moves(제한 이동) = par + 여유 (1공장 3 · 2공장 2 · 3공장 2~1)
 *  인 것을 확인했다.  확인:  node scripts/jelly-solver.mjs
 *
 *  sol 의 한 수 = [x, y, 방향]  (방향 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽)
 */
export const STAGES = [
${stages.map(fmt).join("\n")}
];

/** 오늘의 퍼즐 모음 (서울 날짜로 하나를 골라 모두 같은 판) */
export const DAILY = [
${daily.map(fmt).join("\n")}
];
`;
fs.writeFileSync(new URL("../../games/jelly-factory/js/levels.js", import.meta.url), src);
console.log(`스테이지 ${stages.length}개 · 오늘의 퍼즐 ${daily.length}개 · 빠진 설계도: ${missing.join(" ") || "없음"}`);
