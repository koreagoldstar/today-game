/*
 * NEW 둥지디펜스 · 150 웨이브 (월드마다 30) + 무한 생존 웨이브 만들기
 *
 *  한 줄 = 한 웨이브. 무리(group)는 쉼표로 나눔:
 *    종류*마리수/간격@시작초#길      예) "turtle*3/2.5@2"  → 2초 뒤부터 2.5초마다 거북 3마리
 *    ! 를 앞에 붙이면 엘리트      예) "!boar*1/1@6"
 *    B:보스이름  (뒤에 !aw 면 각성 — 마지막 페이즈가 더 있음)
 *    #0 / #1 = 길 번호 (용암 협곡은 길이 두 개) · #x = 번갈아
 *  ev: 특별 이벤트 이름 (화면 알림) · note: 웨이브 사이에 보여 줄 한마디
 *  체력 · 보상 배율은 waveScale() 이 월드와 웨이브 번호로 정한다 (적 체력만 키우지 않고 조합 · 능력으로 어렵게).
 */
import { ENEMIES, BOSSES, ELITE } from "./enemies.js";

const W1 = [
  ["slime*6/1.4", null, "슬라임이 와요! 길 옆 빈 칸에 병아리 궁수를 세워 보세요."],
  ["slime*9/1.1"],
  ["slime*8/1.0, fox*4/1.2@5", null, "빠른 여우! 얼음 토끼로 느리게 할 수 있어요."],
  ["turtle*3/2.5, slime*6/1@2"],
  ["fox*8/0.7, turtle*2/3@4"],
  ["beetle*4/2, mole*3/2.5@3"],
  ["shroomSplit*4/2.2, slime*6/0.9@2"],
  ["featherHealer*2/4, turtle*4/2@1, fox*5/0.8@4"],
  ["bat*6/1.1, slime*8/0.8@3", null, "하늘을 나는 박쥐는 폭탄 · 대포로 못 맞혀요!"],
  ["B:crownSlime, slime*6/1.5@4", "boss"],
  ["boar*3/3, beetle*3/2@2"],
  ["mole*5/1.6, bat*4/1@4, fox*6/0.6@6"],
  ["shroomSplit*5/1.6, featherHealer*2/5@3, turtle*3/2@1"],
  ["boar*4/2.2, bat*6/0.8@3, slime*10/0.5@5"],
  ["!turtle*2/4, !boar*1/1@6, slime*8/0.7", "elite", "엘리트(빛나는 왕관)는 체력이 세 배예요!"],
  ["beetle*6/1.4, mole*6/1.2@4"],
  ["featherHealer*3/3, boar*4/2@2, shroomSplit*4/2@5"],
  ["bat*10/0.6, fox*10/0.5@4", "swarm"],
  ["turtle*6/1.5, featherHealer*3/3@2, beetle*5/1.5@6"],
  ["B:ironBoarChief, boar*4/3@5", "boss"],
  ["mole*8/1.0, shroomSplit*5/1.6@3", null, "두더지 무리가 땅굴로 쏟아져요!"],
  ["!bat*3/2, bat*8/0.7@2"],
  ["boar*6/1.6, featherHealer*3/3@3, turtle*4/2@6"],
  ["shroomSplit*8/1.1, fox*10/0.5@4"],
  ["!featherHealer*2/4, !turtle*2/4@2, beetle*8/1@3", "elite"],
  ["mole*6/1.2, bat*8/0.7@2, boar*4/2@6"],
  ["slime*20/0.35, fox*12/0.4@5", "rush"],
  ["!boar*3/3, shroomSplit*6/1.4@2, featherHealer*3/3@4"],
  ["turtle*8/1.2, bat*10/0.6@3, mole*6/1.2@6, !shroomSplit*2/3@8"],
  ["B:ironBoarChief!aw, boar*4/2.5@6, featherHealer*2/5@8", "boss", "초원의 마지막 싸움! 각성한 멧돼지 대장이 와요."],
];

const W2 = [
  ["slime*8/1, poisonSpore*3/2.5@3", null, "독 구름 옆 타워는 느려져요. 길 초반에서 처치해요."],
  ["poisonSpore*5/1.8, fox*6/0.8@4"],
  ["sporeBomb*5/1.6, slime*6/1@2", null, "포자 폭탄충은 쓰러지면 터져 근처 타워를 멈춰요."],
  ["vineCrawler*4/2, beetle*4/1.8@3"],
  ["cloner*2/5, slime*8/0.8@2"],
  ["beeHealer*3/2.5, beetle*6/1.4@1", null, "꿀벌 치료사는 날아다녀요. 궁수 · 번개로!"],
  ["shroomKnight*2/4, poisonSpore*4/1.6@3", null, "갑각병은 독이 안 통하고 불에 약해요."],
  ["sporeBomb*8/1, vineCrawler*3/2@4"],
  ["cloner*3/3.5, beeHealer*3/3@2, fox*8/0.6@5"],
  ["B:sporeQueen, poisonSpore*4/2@4", "boss"],
  ["shroomKnight*3/3, beeHealer*4/2@2"],
  ["vineCrawler*6/1.4, sporeBomb*6/1.1@3"],
  ["poisonSpore*8/1, cloner*2/4@4"],
  ["!shroomKnight*1/1, beetle*8/1@2, beeHealer*3/2.5@4", "elite"],
  ["sporeBomb*12/0.6, fox*10/0.5@3", "swarm"],
  ["cloner*4/2.5, vineCrawler*5/1.6@3, beeHealer*3/3@5"],
  ["shroomKnight*4/2.5, poisonSpore*6/1.2@2"],
  ["!cloner*2/4, !beeHealer*2/3@2, slime*16/0.4@1", "elite", "버섯 군락이 깨어났어요!"],
  ["vineCrawler*8/1.1, shroomKnight*3/3@4, sporeBomb*6/1@6"],
  ["B:sporeQueen!aw, cloner*2/5@5, beeHealer*3/3@7", "boss", "각성한 포자 여왕!"],
  ["poisonSpore*10/0.8, beetle*8/0.9@3"],
  ["sporeBomb*10/0.8, shroomKnight*4/2.5@3"],
  ["beeHealer*6/1.4, vineCrawler*6/1.4@2, fox*10/0.5@5"],
  ["cloner*5/2, shroomKnight*3/3@3"],
  ["!shroomKnight*2/3, !sporeBomb*3/2@3, poisonSpore*6/1@1", "elite"],
  ["vineCrawler*10/0.9, beeHealer*5/1.8@3"],
  ["slime*24/0.3, sporeBomb*10/0.6@5", "rush"],
  ["!beeHealer*3/2, shroomKnight*5/2@2, cloner*3/3@5"],
  ["poisonSpore*8/0.9, vineCrawler*6/1.1@2, !cloner*2/4@6, sporeBomb*6/0.9@8"],
  ["B:mushroomColossus, shroomKnight*3/3@5, beeHealer*4/2@8", "boss", "숲의 주인, 고대 버섯 거신이 깨어나요!"],
];

const W3 = [
  ["iceWolf*4/0.35, slime*8/0.9@4", null, "얼음 늑대는 무리로 달려와요. 빙판 위에서는 더 빨라요!"],
  ["iceWolf*4/0.35, iceWolf*4/0.35@8, fox*6/0.7@3"],
  ["frostBat*5/1.4, beetle*5/1.6@2", null, "서리 박쥐가 스치면 타워가 얼어 느려져요."],
  ["frostGolem*2/4, iceWolf*5/0.35@5", null, "골렘의 파란 막대는 얼음 보호막이에요."],
  ["blizzardSpirit*2/4, beetle*6/1.2@1, iceWolf*5/0.35@6"],
  ["crystalBug*3/3, frostGolem*2/4@2"],
  ["snowShade*5/1.5, fox*8/0.6@3", null, "설원 그림자는 화살을 피해요. 번개 · 폭발은 못 피해요."],
  ["iceWolf*6/0.3, iceWolf*6/0.3@7, frostBat*5/1@3", "pack"],
  ["frostGolem*3/3, crystalBug*3/3@2, blizzardSpirit*2/4@5"],
  ["B:glacierGuardian, iceWolf*5/0.35@5", "boss"],
  ["snowShade*6/1.2, frostBat*6/1@3"],
  ["blizzardSpirit*3/3, iceWolf*8/0.3@2, beetle*6/1@6"],
  ["crystalBug*4/2.5, frostGolem*3/3@1, snowShade*4/1.4@5"],
  ["frostBat*10/0.7, fox*10/0.5@4", "swarm"],
  ["iceWolf*8/0.25, iceWolf*8/0.25@6, iceWolf*8/0.25@12", "pack", "늑대 대이동!"],
  ["frostGolem*4/2.5, blizzardSpirit*3/3@2"],
  ["snowShade*8/1, crystalBug*4/2.5@3"],
  ["!frostGolem*2/4, frostBat*8/0.8@2", "elite"],
  ["blizzardSpirit*4/2.5, iceWolf*10/0.3@3, crystalBug*4/2.5@7"],
  ["B:glacierGuardian!aw, frostGolem*2/5@6, iceWolf*6/0.3@9", "boss", "각성한 빙하 수호자!"],
  ["snowShade*10/0.8, frostBat*8/0.8@3"],
  ["frostGolem*5/2, crystalBug*5/2@2"],
  ["iceWolf*12/0.25, blizzardSpirit*4/2.5@4", "pack"],
  ["frostBat*12/0.6, snowShade*8/0.9@3"],
  ["!snowShade*3/2, !blizzardSpirit*2/3@3, iceWolf*10/0.3@5", "elite"],
  ["crystalBug*6/1.8, frostGolem*4/2.5@2, frostBat*6/1@6"],
  ["beetle*12/0.7, iceWolf*12/0.25@4, fox*12/0.4@8", "rush"],
  ["!frostGolem*3/3, crystalBug*5/2@2, snowShade*6/1@5"],
  ["blizzardSpirit*5/2, frostBat*10/0.6@2, iceWolf*12/0.25@6, !crystalBug*2/4@8"],
  ["B:blizzardQueen, iceWolf*6/0.3@6, frostBat*6/0.8@10", "boss", "눈보라의 여왕이 계곡을 얼려요!"],
];

const W4 = [
  ["lavaLizard*4/2#0, slime*8/1#1", null, "길이 두 갈래예요! 도마뱀의 불 자국 위에서는 얼음이 풀려요."],
  ["lavaLizard*4/1.8#1, fox*8/0.7#0@2"],
  ["emberBat*6/1.2#x, beetle*5/1.6#0@2"],
  ["fireBomber*3/3#x, slime*10/0.7#x@1", null, "화염 폭탄병은 둥지 가까이서 심지를 태워요. 그 전에 처치!"],
  ["magmaGolem*2/4#0, lavaLizard*4/1.5#1@2", null, "마그마 골렘이 붉게 빛나면 곧 터져요."],
  ["fireBoar*3/3#1, emberBat*5/1#0@3"],
  ["ashShaman*2/4#x, beetle*6/1.2#x@1, fox*6/0.6#x@4"],
  ["fireBomber*5/2#x, lavaLizard*6/1.2#x@2"],
  ["magmaGolem*3/3#x, ashShaman*2/4#x@2, emberBat*6/0.9#x@5"],
  ["B:magmaColossus#0, lavaLizard*6/1.2#1@3", "boss"],
  ["fireBoar*4/2.5#x, fireBomber*4/2#x@3"],
  ["emberBat*12/0.6#x, ashShaman*2/4#0@4", "swarm"],
  ["lavaLizard*10/0.8#x, magmaGolem*2/4#1@3"],
  ["!fireBoar*2/4#x, beetle*8/1#x@2", "elite"],
  ["fireBomber*10/0.8#x, fox*12/0.5#x@3", "rush"],
  ["ashShaman*3/3#x, fireBoar*4/2.5#x@1, emberBat*8/0.8#x@5"],
  ["magmaGolem*4/2.5#x, lavaLizard*8/1#x@2"],
  ["!ashShaman*2/4#x, fireBomber*6/1.4#x@2, emberBat*8/0.7#x@4", "elite"],
  ["fireBoar*6/1.8#x, magmaGolem*3/3#x@3, !lavaLizard*2/3#x@6"],
  ["B:ignis#1, fireBomber*4/2#0@5", "boss"],
  ["emberBat*14/0.5#x, ashShaman*3/3#x@4", "swarm"],
  ["magmaGolem*5/2.2#x, fireBomber*6/1.4#x@3"],
  ["lavaLizard*12/0.7#x, fireBoar*5/2#x@3"],
  ["!magmaGolem*2/4#x, ashShaman*3/3#x@2, fox*12/0.4#x@4", "elite"],
  ["!fireBomber*2/3#x, !emberBat*4/1.5#x@3, lavaLizard*10/0.8#x@1", "elite"],
  ["fireBoar*8/1.4#x, ashShaman*4/2.5#x@3"],
  ["slime*30/0.25#x, emberBat*12/0.5#x@5", "rush"],
  ["magmaGolem*6/2#x, !fireBoar*2/4#x@4, fireBomber*6/1.4#x@6"],
  ["ashShaman*5/2#x, lavaLizard*12/0.7#x@2, emberBat*12/0.5#x@5, !magmaGolem*2/4#x@8"],
  ["B:ignis!aw#0, fireBoar*4/2.5#1@6, ashShaman*3/3#1@9", "boss", "각성한 화산왕 이그니스!"],
];

const W5 = [
  ["shadowKnight*2/4, slime*8/1@2", null, "그림자 기사는 앞에서 오는 공격을 막아요. 옆 · 뒤에도 타워를!"],
  ["illusionCrow*3/2.2, fox*8/0.7@2", null, "환영 까마귀의 분신은 반투명해요."],
  ["soulReaper*1/1, slime*12/0.6@1"],
  ["curseCaster*2/4, beetle*5/1.3@1, shadowKnight*1/1@5", null, "저주술사의 보라 원 안 타워는 약해져요."],
  ["darkSummoner*2/5, fox*8/0.6@2"],
  ["voidEater*2/4, beetle*6/1.2@2"],
  ["shadowKnight*5/2, illusionCrow*4/1.6@3"],
  ["soulReaper*3/3, slime*18/0.4@1, curseCaster*2/4@5"],
  ["darkSummoner*2/4, voidEater*2/4@3, illusionCrow*3/1.5@6"],
  ["B:darkLord, shadowKnight*4/3@5", "boss"],
  ["illusionCrow*8/1, curseCaster*3/3@3"],
  ["voidEater*4/2.5, soulReaper*3/3@2"],
  ["shadowKnight*6/1.6, darkSummoner*2/5@3"],
  ["!curseCaster*2/4, beetle*10/0.8@2, illusionCrow*6/1@4", "elite"],
  ["voidEater*6/1.8, fox*14/0.4@3", "rush"],
  ["soulReaper*4/2.5, shadowKnight*5/2@2, slime*16/0.4@4"],
  ["darkSummoner*4/3, curseCaster*3/3@3"],
  ["!illusionCrow*3/2.5, !voidEater*2/4@3, shadowKnight*4/2@1", "elite"],
  ["shadowKnight*8/1.4, soulReaper*4/2.5@3, curseCaster*3/3@6"],
  ["B:darkLord!aw, darkSummoner*2/5@5, illusionCrow*6/1@8", "boss", "각성한 어둠의 군주!"],
  ["voidEater*6/1.6, illusionCrow*8/0.9@3"],
  ["curseCaster*4/2.5, shadowKnight*8/1.4@2"],
  ["darkSummoner*5/2.5, soulReaper*4/2.5@3"],
  ["!shadowKnight*3/3, voidEater*5/2@3, illusionCrow*8/0.8@5", "elite"],
  ["slime*30/0.25, fox*20/0.3@4, soulReaper*4/2@6", "rush"],
  ["illusionCrow*12/0.7, curseCaster*4/2.5@3", "swarm"],
  ["!darkSummoner*2/5, shadowKnight*8/1.2@2, voidEater*5/2@6"],
  ["!soulReaper*2/4, !curseCaster*2/4@3, !voidEater*2/4@6", "elite"],
  ["shadowKnight*10/1.1, illusionCrow*10/0.8@2, darkSummoner*4/3@5, voidEater*6/1.6@8, curseCaster*4/2.5@10"],
  ["B:ravenKing, shadowKnight*4/3@8, illusionCrow*6/1@14", "boss", "마지막 결전! 그림자 까마귀 마왕이 둥지를 노려요!"],
];

export const WORLD_WAVES = { 1: W1, 2: W2, 3: W3, 4: W4, 5: W5 };
export const WAVES_PER_WORLD = 30;

// 월드가 바뀌면 처음부터 다시 쌓으므로 월드 배율은 작게 · 웨이브 안에서 크게 오름
const WORLD_HP = { 1: 1, 2: 1.08, 3: 1.12, 4: 1.08, 5: 1.12 };
// 월드 후반만 조금 더 세게 (버섯 숲 · 용암 협곡은 후반 조합이 상대적으로 쉬워서)
const LATE_HP = { 1: 0, 2: 0.2, 3: 0.1, 4: 0.3, 5: 0 };
const BOSS_HP = 1.1;

/** 웨이브 배율 (local: 그 월드 안의 1~30) */
export function waveScale(world, local) {
  const n = local - 1;
  const base = WORLD_HP[world] || 1;
  return {
    hp: base * (1 + 0.15 * n + 0.02 * n * n + 0.0012 * n * n * n) * (1 + (LATE_HP[world] || 0) * (n / 29) ** 3),
    // 보스는 월드가 바뀌어도 '그 월드의 몇 번째 웨이브인가'로 세기를 정함 (10번 = 1 · 20번 = 1.8 · 30번 = 2.6)
    bossHp: base * BOSS_HP * (0.2 + 0.08 * local),
    reward: 1 + 0.02 * n,
    clear: 20 + 2 * local,
  };
}

/** 한 줄 → 무리 목록 (꼬리표 @시작초 · #길 은 순서 상관없음) */
export function parseWave(line) {
  const groups = [];
  for (const raw of line.split(",")) {
    let s = raw.trim();
    if (!s) continue;
    let delay = 0;
    let path = 0;
    s = s.replace(/@([\d.]+)/, (_, v) => ((delay = +v), "")).replace(/#(\d|x)/, (_, v) => ((path = v === "x" ? "x" : +v), ""));
    let m = s.match(/^B:([A-Za-z]+)(!aw)?$/);
    if (m) {
      groups.push({ type: m[1], boss: true, awakened: !!m[2], count: 1, interval: 0, delay, path });
      continue;
    }
    m = s.match(/^(!)?([A-Za-z]+)\*(\d+)\/([\d.]+)$/);
    if (!m) throw new Error(`웨이브 문법 오류: "${raw.trim()}"`);
    groups.push({ type: m[2], elite: !!m[1], count: +m[3], interval: +m[4], delay, path });
  }
  return groups;
}

/** 캠페인 웨이브 하나 (world 1~5, local 1~30) */
export function campaignWave(world, local) {
  const row = WORLD_WAVES[world][local - 1];
  const [line, ev = null, note = null] = row;
  return { world, local, global: (world - 1) * WAVES_PER_WORLD + local, groups: parseWave(line), ev, note, scale: waveScale(world, local), boss: /B:/.test(line) };
}

/** 이 웨이브에서 처음 나오는 특화 적 (안내 카드용) */
export function newEnemiesAt(world, local) {
  const seen = new Set();
  for (let i = 1; i < local; i++) for (const g of campaignWave(world, i).groups) seen.add(g.type);
  return [...new Set(campaignWave(world, local).groups.map((g) => g.type))].filter((t) => !seen.has(t));
}

/*
 * 무한 생존: 웨이브 번호 n(1~) 으로 결정적으로 만들기 (같은 n 이면 같은 웨이브)
 *  - 조합은 모든 월드의 특화 적에서 고름 (2~4 무리) · 5마다 엘리트 · 10마다 보스 (돌아가며)
 *  - 체력 배율은 천천히 오르다 상한 · 마리 수와 출현 속도도 상한 (끝없는 생성 · 넘침 방지)
 */
const ENDLESS_POOL = [
  ["slime", "fox", "beetle", "turtle", "mole", "bat", "shroomSplit", "boar", "featherHealer"],
  ["poisonSpore", "sporeBomb", "vineCrawler", "cloner", "beeHealer", "shroomKnight"],
  ["iceWolf", "frostBat", "frostGolem", "blizzardSpirit", "crystalBug", "snowShade"],
  ["lavaLizard", "emberBat", "magmaGolem", "fireBomber", "fireBoar", "ashShaman"],
  ["shadowKnight", "illusionCrow", "soulReaper", "darkSummoner", "curseCaster", "voidEater"],
];
const ENDLESS_BOSSES = ["crownSlime", "sporeQueen", "glacierGuardian", "magmaColossus", "darkLord", "ironBoarChief", "mushroomColossus", "blizzardQueen", "ignis", "ravenKing"];
export const ENDLESS_MAX_HP = 60;

export function endlessWave(n, pathCount = 1) {
  let seed = (n * 2654435761) >>> 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tier = Math.min(5, 1 + Math.floor((n - 1) / 6)); // 6웨이브마다 더 뒤 월드 적이 섞임
  const pick = () => {
    const w = Math.floor(rnd() * tier);
    const list = ENDLESS_POOL[w];
    return list[Math.floor(rnd() * list.length)];
  };
  const groups = [];
  const nGroups = Math.min(4, 2 + Math.floor(n / 12));
  const pathOf = () => (pathCount > 1 ? "x" : 0);
  for (let i = 0; i < nGroups; i++) {
    const type = pick();
    const d = ENEMIES[type];
    const heavy = d.hp >= 150;
    const count = Math.min(heavy ? 8 : 18, Math.round((heavy ? 2 : 5) + n * (heavy ? 0.12 : 0.35) + rnd() * 3));
    const interval = Math.max(heavy ? 1.2 : 0.35, (heavy ? 3 : 1.4) - n * 0.03);
    groups.push({ type, elite: false, count, interval: +interval.toFixed(2), delay: +(i * (2 + rnd() * 3)).toFixed(1), path: pathOf() });
  }
  let ev = null;
  if (n % 5 === 0) {
    ev = "elite";
    groups.push({ type: pick(), elite: true, count: Math.min(6, 1 + Math.floor(n / 10)), interval: 2.5, delay: 3, path: pathOf() });
  }
  if (n % 10 === 0) {
    ev = "boss";
    groups.push({ type: ENDLESS_BOSSES[(n / 10 - 1) % ENDLESS_BOSSES.length], boss: true, awakened: n >= 60, count: 1, interval: 0, delay: 1, path: 0 });
  }
  const k = n - 1;
  const hp = Math.min(ENDLESS_MAX_HP, 1 + 0.11 * k + 0.0035 * k * k);
  return {
    world: 0,
    local: n,
    global: n,
    endless: true,
    groups,
    ev,
    note: null,
    boss: n % 10 === 0,
    scale: { hp, bossHp: Math.min(ENDLESS_MAX_HP * 0.6, 1 + 0.06 * k), reward: Math.min(4, 1 + 0.03 * k), clear: Math.min(250, 30 + 4 * n) },
  };
}

/** 무리의 실제 적 정의 (엘리트 · 보스 배율 포함) — 검증용 */
export function groupDef(g) {
  const d = g.boss ? BOSSES[g.type] : ENEMIES[g.type];
  return d ? { d, elite: g.elite ? ELITE : null } : null;
}
