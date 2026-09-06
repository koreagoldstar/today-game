(() => {
  "use strict";

  const { CELL } = window.ChickRescueLevels;

  function cellCapacity(type) {
    if (type === CELL.WALL || type === CELL.ROCK) return 0;
    if (type === CELL.LAVA) return 999;
    return 100;
  }

  function canHold(type) {
    return cellCapacity(type) > 0 && type !== CELL.LAVA;
  }

  function initWater(level) {
    const { rows, cols, cells } = level;
    const water = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cells[r][c] === CELL.SOURCE) water[r][c] = 100;
      }
    }
    return water;
  }

  function totalWater(water) {
    let sum = 0;
    water.forEach((row) => row.forEach((v) => { sum += v; }));
    return sum;
  }

  function simulateStep(level, water, barriers) {
    const { rows, cols, cells } = level;
    let moved = 0;
    const next = water.map((row) => row.slice());

    // gravity down
    for (let r = rows - 2; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const amt = next[r][c];
        if (amt <= 0.05) continue;
        const below = cells[r + 1][c];
        if (barriers.v[r][c]) continue;
        if (!canHold(below)) {
          if (below === CELL.LAVA && amt > 0) {
            const burn = Math.min(amt, 28);
            next[r][c] -= burn;
            moved += burn;
          }
          continue;
        }
        const space = 100 - next[r + 1][c];
        if (space <= 0.05) continue;
        const flow = Math.min(amt, space, 42);
        next[r][c] -= flow;
        next[r + 1][c] += flow;
        moved += flow;
      }
    }

    // horizontal equalize
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        if (barriers.h[r][c]) continue;
        const aType = cells[r][c];
        const bType = cells[r][c + 1];
        if (!canHold(aType) || !canHold(bType)) continue;
        const a = next[r][c];
        const b = next[r][c + 1];
        const diff = a - b;
        if (Math.abs(diff) <= 0.05) continue;
        const move = Math.sign(diff) * Math.min(Math.abs(diff) * 0.5, 22);
        next[r][c] -= move;
        next[r][c + 1] += move;
        moved += Math.abs(move);
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        water[r][c] = Math.max(0, Math.min(100, next[r][c]));
      }
    }
    return moved;
  }

  function simulate(level, water, barriers, maxSteps = 120) {
    let steps = 0;
    let moved = 1;
    while (moved > 0.4 && steps < maxSteps) {
      moved = simulateStep(level, water, barriers);
      steps++;
    }
    return steps;
  }

  function chickWater(level, water) {
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (level.cells[r][c] === CELL.CHICK) return water[r][c];
      }
    }
    return 0;
  }

  function isWin(level, water) {
    return chickWater(level, water) >= level.waterNeed;
  }

  function isFail(level, water) {
    const left = totalWater(water);
    const chick = chickWater(level, water);
    return left < 8 && chick < level.waterNeed;
  }

  window.ChickRescueWater = {
    initWater,
    simulate,
    simulateStep,
    chickWater,
    isWin,
    isFail,
    totalWater,
  };
})();
