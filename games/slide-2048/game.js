(() => {
  "use strict";

  const SIZE = 4;
  const TILE_COLORS = {
    2: { bg: "#fff8f0", fg: "#fff", size: 28, face: "t2.png" },
    4: { bg: "#ffe0ec", fg: "#fff", size: 28, face: "t4.png" },
    8: { bg: "#ffc4a8", fg: "#fff", size: 28, face: "t8.png" },
    16: { bg: "#ffd4a0", fg: "#fff", size: 26, face: "t16.png" },
    32: { bg: "#c8f5d8", fg: "#fff", size: 26, face: "t32.png" },
    64: { bg: "#ddd0ff", fg: "#fff", size: 26, face: "t64.png" },
    128: { bg: "#c8e8ff", fg: "#fff", size: 24, face: "t128.png" },
    256: { bg: "#d4b8ff", fg: "#fff", size: 24, face: "t256.png" },
    512: { bg: "#ffe89a", fg: "#fff", size: 24, face: "t2.png" },
    1024: { bg: "#ffb8d8", fg: "#fff", size: 20, face: "t4.png" },
    2048: { bg: "#ff8ab5", fg: "#fff", size: 20, face: "t8.png" },
  };

  const gridBg = document.getElementById("grid-bg");
  const tilesEl = document.getElementById("tiles");
  const overlays = {
    title: document.getElementById("title"),
    win: document.getElementById("win"),
    over: document.getElementById("over"),
  };

  /** @type {{ id: number, value: number, x: number, y: number, merged?: boolean, born?: boolean }[]} */
  let tiles = [];
  let nextId = 1;
  let score = 0;
  let best = Number(localStorage.getItem("slide2048-best") || "0");
  let won = false;
  let keepPlaying = false;
  let busy = false;
  let touchStart = null;
  let cellSize = 0;
  let gap = 10;
  /** @type {Map<number, HTMLElement>} */
  const tileNodes = new Map();

  document.getElementById("best").textContent = String(best);

  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const c = document.createElement("div");
    c.className = "cell";
    gridBg.appendChild(c);
  }

  function measure() {
    const rect = gridBg.getBoundingClientRect();
    gap = 10;
    cellSize = (rect.width - gap * (SIZE - 1)) / SIZE;
  }

  function posStyle(x, y) {
    return {
      left: `${x * (cellSize + gap)}px`,
      top: `${y * (cellSize + gap)}px`,
      width: `${cellSize}px`,
      height: `${cellSize}px`,
    };
  }

  function gridAt(x, y) {
    return tiles.find((t) => t.x === x && t.y === y) || null;
  }

  function emptyCells() {
    const empty = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (!gridAt(x, y)) empty.push({ x, y });
      }
    }
    return empty;
  }

  function spawnTile(at) {
    const empty = emptyCells();
    if (!empty.length) return null;
    const pick = at || empty[Math.floor(Math.random() * empty.length)];
    const tile = {
      id: nextId++,
      value: Math.random() < 0.9 ? 2 : 4,
      x: pick.x,
      y: pick.y,
      born: true,
    };
    tiles.push(tile);
    return tile;
  }

  function updateHud() {
    document.getElementById("score").textContent = String(score);
    if (score > best) {
      best = score;
      localStorage.setItem("slide2048-best", String(best));
      document.getElementById("best").textContent = String(best);
    }
  }

  function paintTile(el, tile) {
    const style = TILE_COLORS[tile.value] || { bg: "#e8d0ff", fg: "#fff", size: 18, face: "t64.png" };
    const pos = posStyle(tile.x, tile.y);
    el.innerHTML = "";
    const face = document.createElement("span");
    face.className = "tile-face";
    if (style.face) {
      face.style.backgroundImage = `url(assets/${style.face})`;
    }
    const num = document.createElement("span");
    num.className = "tile-num";
    num.textContent = String(tile.value);
    el.appendChild(face);
    el.appendChild(num);
    el.style.left = pos.left;
    el.style.top = pos.top;
    el.style.width = pos.width;
    el.style.height = pos.height;
    el.style.background = style.bg;
    el.style.color = style.fg;
    el.style.fontSize = `${style.size}px`;
    if (tile.value >= 2048) el.classList.add("tile-glow");
    else el.classList.remove("tile-glow");
  }

  function render() {
    measure();
    const alive = new Set(tiles.map((t) => t.id));

    for (const [id, el] of tileNodes) {
      if (!alive.has(id)) {
        el.remove();
        tileNodes.delete(id);
      }
    }

    tiles.forEach((tile) => {
      let el = tileNodes.get(tile.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "tile";
        tileNodes.set(tile.id, el);
        tilesEl.appendChild(el);
        // place without transition first frame for new tiles
        el.style.transition = "none";
        paintTile(el, tile);
        if (tile.born) {
          el.classList.add("spawn");
          requestAnimationFrame(() => {
            el.style.transition = "";
          });
        } else {
          requestAnimationFrame(() => {
            el.style.transition = "";
          });
        }
      } else {
        paintTile(el, tile);
        if (tile.merged) {
          el.classList.remove("merge");
          void el.offsetWidth;
          el.classList.add("merge");
        }
      }
      tile.born = false;
      tile.merged = false;
    });
  }

  /**
   * Slide one row/column of tiles toward the start of the line.
   * line: array of {x,y} from far side? No — from destination side first.
   * Actually: positions ordered from the wall we're sliding toward.
   */
  function slideLine(coords) {
    // Gather tiles on this line, ordered toward the destination wall
    const lineTiles = coords.map((c) => gridAt(c.x, c.y)).filter(Boolean);
    if (!lineTiles.length) return { moved: false, gained: 0 };

    const result = [];
    let gained = 0;
    let moved = false;
    let i = 0;
    while (i < lineTiles.length) {
      const a = lineTiles[i];
      const b = lineTiles[i + 1];
      if (b && a.value === b.value) {
        // merge a into new tile at destination slot
        result.push({ value: a.value * 2, from: [a, b] });
        gained += a.value * 2;
        i += 2;
      } else {
        result.push({ value: a.value, from: [a] });
        i += 1;
      }
    }

    // Remove old tiles on this line, place new ones
    const removeIds = new Set(lineTiles.map((t) => t.id));
    tiles = tiles.filter((t) => !removeIds.has(t.id));

    result.forEach((item, idx) => {
      const dest = coords[idx];
      const survivors = item.from;
      // Keep the first tile's id for smooth animation; remove the rest
      const keeper = survivors[0];
      const startX = keeper.x;
      const startY = keeper.y;
      if (startX !== dest.x || startY !== dest.y || survivors.length > 1) moved = true;

      survivors.slice(1).forEach((extra) => {
        // move extra toward dest visually then drop — mark for removal from nodes after merge
        const ghost = tileNodes.get(extra.id);
        if (ghost) {
          const pos = posStyle(dest.x, dest.y);
          ghost.style.left = pos.left;
          ghost.style.top = pos.top;
          setTimeout(() => {
            ghost.remove();
            tileNodes.delete(extra.id);
          }, 140);
        }
      });

      keeper.x = dest.x;
      keeper.y = dest.y;
      keeper.value = item.value;
      if (survivors.length > 1) {
        keeper.merged = true;
        if (keeper.value === 2048 && !won) won = true;
      }
      tiles.push(keeper);
    });

    return { moved, gained };
  }

  function linesFor(direction) {
    const lines = [];
    if (direction === "left") {
      for (let y = 0; y < SIZE; y += 1) {
        lines.push(Array.from({ length: SIZE }, (_, x) => ({ x, y })));
      }
    } else if (direction === "right") {
      for (let y = 0; y < SIZE; y += 1) {
        lines.push(Array.from({ length: SIZE }, (_, i) => ({ x: SIZE - 1 - i, y })));
      }
    } else if (direction === "up") {
      for (let x = 0; x < SIZE; x += 1) {
        lines.push(Array.from({ length: SIZE }, (_, y) => ({ x, y })));
      }
    } else if (direction === "down") {
      for (let x = 0; x < SIZE; x += 1) {
        lines.push(Array.from({ length: SIZE }, (_, i) => ({ x, y: SIZE - 1 - i })));
      }
    }
    return lines;
  }

  function slide(direction) {
    if (busy) return false;
    measure();

    let anyMoved = false;
    let gained = 0;
    linesFor(direction).forEach((line) => {
      const r = slideLine(line);
      if (r.moved) anyMoved = true;
      gained += r.gained;
    });

    if (!anyMoved) return false;

    score += gained;
    updateHud();
    render();

    busy = true;
    setTimeout(() => {
      spawnTile();
      render();
      busy = false;
      if (won && !keepPlaying) overlays.win.classList.remove("hidden");
      else if (!canMove()) showGameOver();
    }, 150);

    return true;
  }

  function canMove() {
    if (emptyCells().length) return true;
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const t = gridAt(x, y);
        if (!t) return true;
        const right = gridAt(x + 1, y);
        const down = gridAt(x, y + 1);
        if (right && right.value === t.value) return true;
        if (down && down.value === t.value) return true;
      }
    }
    return false;
  }

  function showGameOver() {
    document.getElementById("over-detail").textContent = `점수 ${score}`;
    overlays.over.classList.remove("hidden");
  }

  function clearBoard() {
    tiles = [];
    tileNodes.forEach((el) => el.remove());
    tileNodes.clear();
    nextId = 1;
  }

  function newGame() {
    clearBoard();
    score = 0;
    won = false;
    keepPlaying = false;
    busy = false;
    updateHud();
    spawnTile();
    spawnTile();
    render();
    overlays.win.classList.add("hidden");
    overlays.over.classList.add("hidden");
  }

  function startGame() {
    overlays.title.classList.add("hidden");
    newGame();
  }

  function onKey(e) {
    const map = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    if (!map[e.code]) return;
    e.preventDefault();
    slide(map[e.code]);
  }

  const board = document.querySelector(".board-wrap");
  board.addEventListener("pointerdown", (e) => {
    touchStart = { x: e.clientX, y: e.clientY };
  });
  board.addEventListener("pointerup", (e) => {
    if (!touchStart || busy) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 28 && Math.abs(dy) < 28) return;
    if (Math.abs(dx) > Math.abs(dy)) slide(dx > 0 ? "right" : "left");
    else slide(dy > 0 ? "down" : "up");
  });

  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", () => render());

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("new-btn").addEventListener("click", newGame);
  document.getElementById("retry-btn").addEventListener("click", () => {
    overlays.over.classList.add("hidden");
    newGame();
  });
  document.getElementById("continue-btn").addEventListener("click", () => {
    keepPlaying = true;
    overlays.win.classList.add("hidden");
  });
  document.getElementById("win-new-btn").addEventListener("click", () => {
    overlays.win.classList.add("hidden");
    newGame();
  });
})();
