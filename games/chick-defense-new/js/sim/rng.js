/* 씨앗이 같으면 같은 수를 내는 난수 (자동 검증 · 다시 하기가 같은 흐름이 되게) */
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.state = () => s;
  rng.set = (v) => (s = v >>> 0);
  return rng;
}
