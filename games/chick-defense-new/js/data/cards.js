/*
 * 전술 강화 카드 — 웨이브를 깨면 3장 중 1장을 고름 (그 월드 판 안에서만 이어짐)
 *  max: 최대 몇 번까지 고를 수 있는지 (다 고르면 다시 안 나옴)
 *  instant: 고르는 순간 한 번 효과 (반복 가능하지만 둥지 상한이 있음)
 *  모든 효과는 sim 의 mods / 둥지에 실제로 들어간다 (sim/cards.js)
 */
export const CARDS = [
  { id: "swift", name: "날쌘 깃털", icon: "💨", desc: "모든 타워 공격속도 +8%", max: 5, weight: 10 },
  { id: "power", name: "튼튼 부리", icon: "💪", desc: "모든 타워 피해 +10%", max: 5, weight: 10 },
  { id: "eagle", name: "독수리 눈", icon: "👁️", desc: "모든 타워 사거리 +7%", max: 3, weight: 7 },
  { id: "blast", name: "빵빵 화약", icon: "💥", desc: "폭발 범위 +15%", max: 3, weight: 6 },
  { id: "frost", name: "차가운 바람", icon: "🌬️", desc: "감속 세기 · 빙결 확률 +20%", max: 3, weight: 6 },
  { id: "boss", name: "용사의 깃발", icon: "🚩", desc: "보스에게 주는 피해 +20%", max: 3, weight: 6 },
  { id: "elite", name: "엘리트 사냥꾼", icon: "🎯", desc: "엘리트 적에게 주는 피해 +25%", max: 2, weight: 5 },
  { id: "bounty", name: "반짝 동전", icon: "💰", desc: "적을 쓰러뜨릴 때 코인 +1", max: 3, weight: 7 },
  { id: "double", name: "쌍둥이 화살", icon: "🎏", desc: "8% 확률로 한 발 더 쏴요", max: 3, weight: 6 },
  { id: "chain", name: "찌릿찌릿", icon: "⚡", desc: "번개가 한 번 더 튕겨요", max: 2, weight: 5 },
  { id: "dot", name: "뜨끈뜨끈", icon: "🔥", desc: "화상 · 서리 장판 지속 피해 +25%", max: 3, weight: 5 },
  { id: "crit", name: "급소 찌르기", icon: "✨", desc: "10% 확률로 피해 2배", max: 2, weight: 5 },
  { id: "interest", name: "저금통", icon: "🐷", desc: "웨이브가 끝나면 가진 코인의 5% 더 (최대 30)", max: 2, weight: 5 },
  { id: "discount", name: "할인 쿠폰", icon: "🏷️", desc: "타워 설치 · 강화 비용 -8%", max: 2, weight: 5 },
  { id: "refund", name: "알뜰 장사", icon: "♻️", desc: "타워를 팔 때 90% 돌려받아요", max: 1, weight: 3 },
  { id: "shieldUp", name: "둥지 방어막", icon: "🛡️", desc: "둥지 방어막 +3 (최대 10)", instant: true, weight: 6 },
  { id: "repair", name: "둥지 수리", icon: "🔨", desc: "둥지 체력 +4 (최대 체력까지)", instant: true, weight: 6 },
];
export const cardById = (id) => CARDS.find((c) => c.id === id);
