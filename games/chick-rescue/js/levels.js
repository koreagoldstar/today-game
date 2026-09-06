(() => {
  "use strict";

  const STAGE_COUNT = 100;
  const CELL = {
    EMPTY: 0,
    WALL: 1,
    SOURCE: 2,
    CHICK: 3,
    LAVA: 4,
    ROCK: 5,
  };

  function seeded(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function inBounds(r, c, rows, cols) {
    return r >= 0 && c >= 0 && r < rows && c < cols;
  }

  function makeGrid(rows, cols, fill = CELL.EMPTY) {
    return Array.from({ length: rows }, () => Array(cols).fill(fill));
  }

  function makeBarriers(rows, cols, fill = true) {
    return {
      h: Array.from({ length: rows }, () => Array(Math.max(0, cols - 1)).fill(fill)),
      v: Array.from({ length: Math.max(0, rows - 1) }, () => Array(cols).fill(fill)),
    };
  }

  function cloneBarriers(bar) {
    return {
      h: bar.h.map((row) => row.slice()),
      v: bar.v.map((row) => row.slice()),
    };
  }

  /** Hand-tuned intro stages for reliable onboarding */
  const TUTORIAL = [
    {
      rows: 5,
      cols: 4,
      cells: [
        "WWWW",
        "WS.W",
        "W..W",
        "W.CW",
        "WWWW",
      ],
      openH: [],
      openV: [[1, 1]],
      steelH: [],
      steelV: [],
      moves: 2,
    },
    {
      rows: 6,
      cols: 5,
      cells: [
        "WWWWW",
        "WS..W",
        "W...W",
        "W...W",
        "W..CW",
        "WWWWW",
      ],
      openH: [[1, 2]],
      openV: [[1, 1], [2, 1], [3, 1]],
      steelH: [],
      steelV: [],
      moves: 3,
    },
    {
      rows: 6,
      cols: 5,
      cells: [
        "WWWWW",
        "W.S.W",
        "W...W",
        "W.L.W",
        "W..CW",
        "WWWWW",
      ],
      openH: [[1, 1], [3, 1]],
      openV: [[1, 2], [2, 2]],
      steelH: [[2, 1]],
      steelV: [],
      moves: 3,
    },
  ];

  function parseCells(lines) {
    const rows = lines.length;
    const cols = lines[0].length;
    const grid = makeGrid(rows, cols, CELL.WALL);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = lines[r][c];
        if (ch === ".") grid[r][c] = CELL.EMPTY;
        else if (ch === "S") grid[r][c] = CELL.SOURCE;
        else if (ch === "C") grid[r][c] = CELL.CHICK;
        else if (ch === "L") grid[r][c] = CELL.LAVA;
        else if (ch === "R") grid[r][c] = CELL.ROCK;
      }
    }
    return grid;
  }

  function applyOpenings(bar, openH, openV) {
    openH.forEach(([r, c]) => {
      if (bar.h[r] && bar.h[r][c] !== undefined) bar.h[r][c] = false;
    });
    openV.forEach(([r, c]) => {
      if (bar.v[r] && bar.v[r][c] !== undefined) bar.v[r][c] = false;
    });
  }

  function applySteel(removable, steelH, steelV) {
    steelH.forEach(([r, c]) => {
      if (removable.h[r] && removable.h[r][c] !== undefined) removable.h[r][c] = false;
    });
    steelV.forEach(([r, c]) => {
      if (removable.v[r] && removable.v[r][c] !== undefined) removable.v[r][c] = false;
    });
  }

  function packLevel(rows, cols, cells, bar, removable, par, stageIdx) {
    return {
      stage: stageIdx + 1,
      rows,
      cols,
      cells,
      barriers: bar,
      removable,
      par,
      waterNeed: 55 + Math.min(25, Math.floor(stageIdx / 8)),
    };
  }

  function generateProcedural(stageIdx) {
    const n = stageIdx + 1;
    const rand = seeded(n * 92821 + 17);
    const rows = Math.min(9, 5 + Math.floor(n / 18));
    const cols = Math.min(8, 4 + Math.floor(n / 22));
    const cells = makeGrid(rows, cols, CELL.WALL);

    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) cells[r][c] = CELL.EMPTY;
    }

    const sourceCount = 1 + Math.min(2, Math.floor(n / 35));
    const sources = [];
    for (let i = 0; i < sourceCount; i++) {
      const c = 1 + Math.floor(rand() * (cols - 2));
      const r = 1 + Math.floor(rand() * Math.max(1, Math.floor((rows - 3) / 2)));
      if (cells[r][c] === CELL.EMPTY) {
        cells[r][c] = CELL.SOURCE;
        sources.push([r, c]);
      }
    }
    if (!sources.length) {
      cells[1][1] = CELL.SOURCE;
      sources.push([1, 1]);
    }

    let chickR = rows - 2;
    let chickC = cols - 2;
    cells[chickR][chickC] = CELL.CHICK;

    const lavaCount = n > 12 ? Math.min(6, 1 + Math.floor(n / 16)) : 0;
    for (let i = 0; i < lavaCount; i++) {
      const r = 2 + Math.floor(rand() * (rows - 3));
      const c = 1 + Math.floor(rand() * (cols - 2));
      if (cells[r][c] === CELL.EMPTY && Math.abs(r - chickR) + Math.abs(c - chickC) > 2) {
        cells[r][c] = CELL.LAVA;
      }
    }

    const rockCount = n > 28 ? Math.min(4, Math.floor(n / 25)) : 0;
    for (let i = 0; i < rockCount; i++) {
      const r = 2 + Math.floor(rand() * (rows - 3));
      const c = 1 + Math.floor(rand() * (cols - 2));
      if (cells[r][c] === CELL.EMPTY) cells[r][c] = CELL.ROCK;
    }

    const bar = makeBarriers(rows, cols, true);
    const removable = makeBarriers(rows, cols, true);

    // carve a guaranteed solution path from nearest source to chick
    let cr = sources[0][0];
    let cc = sources[0][1];
    const pathEdges = [];
    while (cr !== chickR || cc !== chickC) {
      const opts = [];
      if (cr < chickR) opts.push([1, 0]);
      if (cr > chickR) opts.push([-1, 0]);
      if (cc < chickC) opts.push([0, 1]);
      if (cc > chickC) opts.push([0, -1]);
      opts.sort(() => rand() - 0.5);
      const [dr, dc] = opts[0];
      const nr = cr + dr;
      const nc = cc + dc;
      if (dr === 1) pathEdges.push(["v", cr, cc]);
      else if (dr === -1) pathEdges.push(["v", nr, cc]);
      else if (dc === 1) pathEdges.push(["h", cr, cc]);
      else pathEdges.push(["h", cr, nc]);
      cr = nr;
      cc = nc;
    }

    const openH = [];
    const openV = [];
    pathEdges.forEach((edge) => {
      if (edge[0] === "h") openH.push([edge[1], edge[2]]);
      else openV.push([edge[1], edge[2]]);
    });

    // pre-open a few path edges so puzzle isn't "remove everything"
    const mustClose = Math.min(openH.length + openV.length, 2 + Math.floor(n / 6));
    const allPath = [
      ...openH.map((e) => ({ t: "h", r: e[0], c: e[1] })),
      ...openV.map((e) => ({ t: "v", r: e[0], c: e[1] })),
    ];
    allPath.sort(() => rand() - 0.5);
    const closed = allPath.slice(0, mustClose);
    const preOpen = allPath.slice(mustClose);
    preOpen.forEach((e) => {
      if (e.t === "h") openH.splice(openH.findIndex((x) => x[0] === e.r && x[1] === e.c), 1);
      else openV.splice(openV.findIndex((x) => x[0] === e.r && x[1] === e.c), 1);
    });

    applyOpenings(bar, openH, openV);

    const steelH = [];
    const steelV = [];
    const steelRate = Math.min(0.45, n / 220);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        if (!bar.h[r][c] && rand() < steelRate * 0.25) {
          steelH.push([r, c]);
        }
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        if (!bar.v[r][c] && rand() < steelRate * 0.25) {
          steelV.push([r, c]);
        }
      }
    }
    // solution edges stay removable
    closed.forEach((e) => {
      if (e.t === "h") {
        const i = steelH.findIndex((x) => x[0] === e.r && x[1] === e.c);
        if (i >= 0) steelH.splice(i, 1);
      } else {
        const i = steelV.findIndex((x) => x[0] === e.r && x[1] === e.c);
        if (i >= 0) steelV.splice(i, 1);
      }
    });
    applySteel(removable, steelH, steelV);

    return packLevel(rows, cols, cells, bar, removable, closed.length + 1, stageIdx);
  }

  function buildLevel(stageIdx) {
    if (stageIdx < TUTORIAL.length) {
      const t = TUTORIAL[stageIdx];
      const cells = parseCells(t.cells);
      const bar = makeBarriers(t.rows, t.cols, true);
      const removable = makeBarriers(t.rows, t.cols, true);
      applyOpenings(bar, t.openH || [], t.openV || []);
      applySteel(removable, t.steelH || [], t.steelV || []);
      return packLevel(t.rows, t.cols, cells, bar, removable, t.moves || 3, stageIdx);
    }
    return generateProcedural(stageIdx);
  }

  window.ChickRescueLevels = {
    STAGE_COUNT,
    CELL,
    buildLevel,
    cloneBarriers,
  };
})();
