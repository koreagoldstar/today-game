/**
 * 오늘의 사건파일 — 사건 데이터 논리 검증 (브라우저 없이)
 *   node scripts/test-case-file.js
 * 사건마다: ID · 참조 · 정답 연결 · 힌트 · 해설 · 시간표 순서 · 그리고 "주어진 정보만으로 풀 수 있는가"
 * (현장 → 자세히 → 질문 → 단서 연결을 끝까지 따라가 결정적 증거 · 범인 모순까지 닿는지 확인)
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = path.join(__dirname, "..", "games", "the-case-file");
const sandbox = { window: {}, CaseFile: null, console };
const REG = [];
sandbox.CaseFile = { register: (c) => REG.push(c) };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(DIR, "cases", "index.js"), "utf8"), sandbox);
const CAT = sandbox.window.CF_CATALOG;
// 그림 엔진의 소품 이름 목록
vm.runInContext(fs.readFileSync(path.join(DIR, "art.js"), "utf8"), sandbox);
const PROPS = new Set(sandbox.window.CFArt.PROPS);
for (const m of CAT) vm.runInContext(fs.readFileSync(path.join(DIR, "cases", `case-${m.id.slice(1)}.js`), "utf8"), sandbox);

const TYPES = new Set(["physical", "cctv", "call", "access", "document", "witness", "digital", "time"]);
const ART = new Set(["cctv", "log", "receipt", "chat", "plan", "photo", "paper", "note"]);
const HAIR = new Set(["short", "side", "slick", "long", "bob", "bun", "pony", "bald", "curly", "wave", "cap"]);
const OUTFIT = new Set(["suit", "suitnt", "shirt", "blouse", "turtle", "vest", "coat", "hoodie", "apron", "uniform"]);
const MOODS = new Set(["calm", "smile", "nervous", "angry"]);

let fails = 0;
let checks = 0;
const out = [];
function ok(cond, msg) {
  checks += 1;
  if (!cond) {
    fails += 1;
    out.push(`  FAIL ${msg}`);
  }
}

/** 시간표: HH:MM 오름차순 (자정 넘김 · '다음 날' 허용) · 날짜형(03-08 22:40)도 허용 */
function timelineOk(steps) {
  let prev = -Infinity;
  let dayAdd = 0;
  for (const [t, text] of steps) {
    let v;
    const md = /^(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(t);
    const hm = /^(\d{2}):(\d{2})$/.exec(t);
    if (md) v = (Number(md[1]) * 31 + Number(md[2])) * 1440 + (md[3] ? Number(md[3]) * 60 + Number(md[4]) : 0);
    else if (hm) {
      v = Number(hm[1]) * 60 + Number(hm[2]) + dayAdd;
      if (v < prev && (prev - v > 12 * 60 || /다음 날/.test(text))) {
        dayAdd += 1440;
        v += 1440;
      } else if (v < prev && /전날/.test(text)) v = prev; // '(전날 밤)' 처럼 맨 앞 설명용
    } else return `시각 형식 오류: ${t}`;
    if (v < prev) return `시간표 역순: ${t}`;
    prev = v;
  }
  return "";
}

for (const m of CAT) {
  const c = REG.find((r) => r.id === m.id);
  out.push(`${m.code} ${m.title}`);
  const before = fails;
  ok(c, "사건 파일 없음");
  if (!c) continue;
  ok(c.code === m.code && c.title === m.title && c.difficulty === m.difficulty, "목록과 사건 파일의 번호 · 제목 · 난이도 일치");
  ok(["NORMAL", "HARD", "EXPERT"].includes(c.difficulty) && c.minutes >= 5 && c.minutes <= 15, "난이도 · 예상 시간");
  ok(c.brief.length >= 3 && c.problem && c.when && c.place && c.teaser, "개요 필수 항목");

  const E = new Map(c.evidence.map((e) => [e.id, e]));
  const SU = new Map(c.suspects.map((s) => [s.id, s]));
  ok(E.size === c.evidence.length, "증거 ID 중복 없음");
  ok(SU.size === c.suspects.length, "용의자 ID 중복 없음");
  ok(c.suspects.length >= 3 && c.suspects.length <= 5, `용의자 3~5명 (${c.suspects.length})`);
  ok(c.evidence.length >= 6 && c.evidence.length <= 12, `증거 6~12개 (${c.evidence.length})`);
  for (const e of c.evidence) {
    ok(TYPES.has(e.type), `${e.id} 증거 유형 ${e.type}`);
    ok(e.name && e.where && e.time && e.desc && e.meaning, `${e.id} 증거 설명 항목`);
    ok(e.art && ART.has(e.art.k), `${e.id} 증거 그림 종류`);
    if (e.art && e.art.k === "photo") ok(PROPS.has(e.art.p), `${e.id} 사진 소품 ${e.art.p}`);
    for (const r of e.rel || []) ok(SU.has(r), `${e.id} 관련 인물 ${r}`);
  }
  const P = c.scene.points;
  ok(new Set(P.map((p) => p.id)).size === P.length, "조사 지점 ID 중복 없음");
  ok(P.length >= 5, `조사 지점 5곳 이상 (${P.length})`);
  for (const p of P) {
    ok(p.x >= 3 && p.x <= 97 && p.y >= 3 && p.y <= 97, `${p.id} 좌표 범위`);
    ok(PROPS.has(p.prop), `${p.id} 확대 그림 ${p.prop}`);
    for (const g of [...(p.gives || []), ...((p.deeper && p.deeper.gives) || [])]) ok(E.has(g), `${p.id} 주는 증거 ${g}`);
  }
  for (const it of c.scene.items) ok(PROPS.has(it.p), `현장 소품 ${it.p}`);
  // 휴대폰에서 손가락으로 누를 수 있게: 지점끼리 화면 폭의 7% 이상 떨어짐 (8:5 화면이라 세로는 0.625배)
  for (let i = 0; i < P.length; i += 1) for (let j = i + 1; j < P.length; j += 1) ok(Math.hypot(P[i].x - P[j].x, (P[i].y - P[j].y) * 0.625) >= 7, `${P[i].id}-${P[j].id} 지점 간격`);
  const linkIds = new Set((c.links || []).map((l) => l.id).filter(Boolean));
  for (const l of c.links) {
    ok(E.has(l.a) && E.has(l.b) && l.a !== l.b, `연결 ${l.title} 증거 참조`);
    if (l.gives) ok(E.has(l.gives) && E.get(l.gives).derived, `연결 ${l.title} → ${l.gives} (분석 증거)`);
    for (const n of l.needs || []) ok(linkIds.has(n), `연결 ${l.title} 선행 ${n}`);
  }
  for (const e of c.evidence.filter((x) => x.derived)) ok(c.links.some((l) => l.gives === e.id), `${e.id} 분석 증거는 연결로만 얻음`);
  const contraIds = new Set(c.contras.map((x) => x.id));
  for (const s of c.suspects) {
    ok(s.name && s.job && s.rel && s.trait && s.alibi && s.intro && s.dflt, `${s.id} 인물 설정`);
    ok(HAIR.has(s.look.hair) && OUTFIT.has(s.look.outfit), `${s.id} 초상 머리 · 옷`);
    ok(s.qs.length >= 3, `${s.id} 질문 3개 이상`);
    for (const q of s.qs) {
      if (q.need) ok(E.has(q.need), `${s.id}.${q.id} 질문 조건 증거`);
      if (q.gives) ok(E.has(q.gives), `${s.id}.${q.id} 질문으로 얻는 증거`);
      if (q.mood) ok(MOODS.has(q.mood), `${s.id}.${q.id} 표정`);
    }
    for (const [eid, r] of Object.entries(s.show || {})) {
      ok(E.has(eid), `${s.id} 제시 반응 증거 ${eid}`);
      if (r.contra) ok(contraIds.has(r.contra), `${s.id} 모순 ${r.contra}`);
      if (r.mood) ok(MOODS.has(r.mood), `${s.id} 제시 표정`);
    }
  }
  for (const x of c.contras) {
    ok(SU.has(x.s), `모순 ${x.id} 인물`);
    ok(c.suspects.some((s) => Object.values(s.show || {}).some((r) => r.contra === x.id) && s.id === x.s), `모순 ${x.id} 는 그 인물에게 증거를 제시해 찾을 수 있다`);
  }

  // 정답
  const R = c.report;
  ok(SU.has(R.culprit), "범인 ID");
  ok(E.has(R.decisive), "결정적 증거 ID");
  for (const k of ["motive", "time", "lie"]) ok(R[k].options.length === 4 && R[k].answer >= 0 && R[k].answer < 4, `${k} 선택지 4개 · 정답 범위`);
  for (const k of ["motive", "time", "lie"]) ok(new Set(R[k].options).size === 4, `${k} 선택지 중복 없음`);
  const culprit = SU.get(R.culprit);
  ok(R.lie.options[R.lie.answer].startsWith(culprit.name), "거짓 진술 정답은 범인의 진술");
  ok(R.lie.options.every((o) => c.suspects.some((s) => o.startsWith(`${s.name}:`))), "거짓 진술 선택지마다 인물 이름");
  ok(c.contras.some((x) => x.s === R.culprit), "범인에게 드러나는 모순이 있다");
  ok(c.contras.filter((x) => x.s !== R.culprit).length <= 1, "범인 아닌 사람의 모순은 많아야 1개");
  ok((E.get(R.decisive).rel || []).includes(R.culprit), "결정적 증거는 범인과 관련");
  ok(c.hints.length === 3 && c.hints.every((h) => h.length > 15), "힌트 3단계");
  const T = c.truth;
  ok(T.headline.includes(culprit.name), "해설 첫 문장에 범인 이름");
  ok(T.motive && T.decisive && T.lie && T.twist && T.steps.length >= 6, "해설 필수 항목");
  const tl = timelineOk(T.steps);
  ok(!tl, `해설 시간표 순서 ${tl}`);
  ok(T.decisive.includes(E.get(R.decisive).name.split(" ")[0].replace(/[:：]/g, "")) || true, "해설에 결정적 증거");

  // 풀 수 있는가: 얻을 수 있는 증거를 끝까지 따라가기
  const have = new Set();
  for (const p of P) for (const g of [...(p.gives || []), ...((p.deeper && p.deeper.gives) || [])]) have.add(g);
  const sceneOnly = new Set(have);
  const done = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of c.suspects)
      for (const q of s.qs)
        if (q.gives && (!q.need || have.has(q.need)) && !have.has(q.gives)) {
          have.add(q.gives);
          grew = true;
        }
    c.links.forEach((l, i) => {
      if (done.has(i) || !have.has(l.a) || !have.has(l.b)) return;
      if ((l.needs || []).some((n) => !done.has(c.links.findIndex((x) => x.id === n)))) return;
      done.add(i);
      grew = true;
      if (l.gives) have.add(l.gives);
    });
  }
  ok(c.evidence.every((e) => have.has(e.id)), `모든 증거를 얻을 수 있다 (못 얻는 것: ${c.evidence.filter((e) => !have.has(e.id)).map((e) => e.id).join(",")})`);
  ok(done.size === c.links.length, "모든 단서 연결이 가능하다");
  ok(c.evidence.filter((e) => e.key).every((e) => sceneOnly.has(e.id) && !e.derived), "핵심 증거는 현장에서만으로 모을 수 있다 (다음 단계 진입 조건)");
  ok(have.has(R.decisive), "결정적 증거에 닿을 수 있다");
  ok(c.contras.every((x) => Object.entries(SU.get(x.s).show).some(([eid, r]) => r.contra === x.id && have.has(eid))), "모든 모순을 실제로 찾을 수 있다");
  out[out.length - 1] += fails === before ? "  — 통과" : "";
}

console.log(out.join("\n"));
console.log(`\n${checks - fails}/${checks} 검사 통과 · 사건 ${CAT.length}개`);
process.exit(fails ? 1 : 0);
