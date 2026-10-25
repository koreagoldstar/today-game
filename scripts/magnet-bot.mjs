/**
 * 자석 대소동 · 풀이 로봇 (자동 점검용) — 사람이 누르는 키를 대신 눌러 준다
 *
 *  게임과 같은 규칙(sim.js)을 그대로 돌리므로, 여기서 깨지면 사람도 같은 입력으로 깰 수 있다.
 *  명령 (스테이지마다 levels 의 풀이에 적어 둠):
 *    ["walk", x]               x 까지 걸어감 (가까워지면 멈춤)
 *    ["walk", x, "jump"]       걷다가 한 번 점프
 *    ["jump", t?]              제자리 점프 (t 초 동안 누름 · 길게 누를수록 높이)
 *    ["air", dir, t]           점프하면서 dir(1 오른쪽 · -1 왼쪽) 쪽으로 t 초
 *    ["hold", dir, t]          dir 쪽으로 t 초 걷기
 *    ["face", dir]             그쪽을 보게 (아주 잠깐 누름)
 *    ["mag", true|false]       자석 켜기 · 끄기
 *    ["pole", "N"|"S"]         극 맞추기
 *    ["use"]                   레버 조작
 *    ["wait", t]               t 초 기다림
 *    ["until", "이름", t]       조건이 될 때까지 (최대 t 초) — 이름: 스위치 · 목표 · 레버 id, "exit", "held:물체", "x>값" 등
 */
import { stepGame, cond } from "../games/magnet-mayhem/js/sim.js?v=1";

const FRAME = 1 / 120;


/**
 * 풀이 → 한 걸음마다 누를 키 (driver.next(G) 가 그 걸음의 입력을 돌려줌)
 *  Node 검증(runBot)과 브라우저 점검(게임 입력을 이것으로 바꿔 끼움)이 똑같이 쓴다.
 */
export function makeDriver(script) {
  const queue = script.map((c) => [...c]);
  let cur = null;
  let ct = 0;
  let pressed = {};
  const log = [];
  return {
    log,
    get done() {
      return !cur && !queue.length;
    },
    next(G) {
      const inp = { left: false, right: false, jump: false, jumpPressed: false, magPressed: false, polPressed: false, usePressed: false };
      if (!cur && queue.length) {
        cur = queue.shift();
        ct = 0;
        pressed = {};
      }
      if (!cur) return inp;
      const [op, a, b] = cur;
      const R = G.robot;
      let done = false;
      switch (op) {
        case "walk": {
          const dx = a - R.x;
          if (Math.abs(dx) > 6) {
            if (dx > 0) inp.right = true;
            else inp.left = true;
          } else if (Math.abs(R.vx - (R.ground ? R.groundVx : 0)) < 40 || ct > 0.6) done = true;
          if (b === "jump" && !pressed.j && Math.abs(dx) < Math.abs(a - (cur.from ?? (cur.from = R.x))) * 0.8) {
            inp.jumpPressed = true;
            inp.jump = true;
            pressed.j = ct;
          }
          if (pressed.j != null && ct - pressed.j < 0.3) inp.jump = true;
          if (ct > 10) {
            log.push(`walk ${a} 시간 초과 (x ${R.x.toFixed(0)})`);
            done = true;
          }
          break;
        }
        case "jump":
          inp.jump = ct < (a || 0.3);
          if (!pressed.j) {
            inp.jumpPressed = true;
            pressed.j = true;
          }
          done = ct >= (a || 0.3) + 0.02;
          break;
        case "air":
          if (!pressed.j) {
            inp.jumpPressed = true;
            pressed.j = true;
          }
          inp.jump = ct < 0.32;
          if (a > 0) inp.right = true;
          else inp.left = true;
          done = ct >= b;
          break;
        case "hold":
          if (a > 0) inp.right = true;
          else if (a < 0) inp.left = true;
          done = ct >= b;
          break;
        case "face":
          if (a > 0) inp.right = true;
          else inp.left = true;
          done = ct >= 0.02;
          break;
        case "mag":
          if (G.mag.on !== a && !pressed.m) {
            inp.magPressed = true;
            pressed.m = true;
          }
          done = true;
          break;
        case "pole":
          if (G.mag.pole !== a) inp.polPressed = true;
          done = true;
          break;
        case "use":
          inp.usePressed = true;
          done = true;
          break;
        case "wait":
          done = ct >= a;
          break;
        case "until":
          done = cond(G, a);
          if (!done && ct > (b || 10)) {
            log.push(`until ${a} 시간 초과`);
            done = true;
          }
          break;
        default:
          throw new Error("모르는 명령 " + op);
      }
      ct += FRAME;
      if (done) cur = null;
      return inp;
    },
  };
}

/** 풀이 한 개를 끝까지 (또는 maxT 초까지) 돌림 → { won, t, stars? } · onFrame 으로 매 걸음 보기 */
export function runBot(G, script, { maxT = 180, onFrame, after = 2 } = {}) {
  const drv = makeDriver(script);
  const total = Math.round(maxT / FRAME);
  let doneAt = null;
  let idle = null;
  for (let f = 0; f < total; f++) {
    const inp = drv.next(G);
    stepGame(G, inp);
    if (onFrame) onFrame(G, inp, f);
    if ((G.won || G.failed) && doneAt == null) doneAt = f;
    if (doneAt != null && f - doneAt > after / FRAME) break;
    if (drv.done && doneAt == null && f > 0) {
      // 명령은 끝났는데 아직 안 깸 → 조금 더 기다려 봄
      if (idle == null) idle = f;
      if (f - idle > 3 / FRAME) break;
    }
  }
  return { won: G.won, failed: G.failed, t: G.t, log: drv.log, uses: G.uses, energy: G.energy, gear: G.gearGot, falls: G.falls };
}
