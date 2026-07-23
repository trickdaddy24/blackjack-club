// Standalone Tetris engine — vanilla canvas + WebAudio, no React deps.
// mountTetris(root) wires everything up against elements inside `root` and
// returns a destroy() that removes every listener/rAF/interval/AudioContext
// it created, since the Next.js route unmounts and remounts this on nav
// (and React StrictMode double-invokes effects in dev).
export function mountTetris(root) {
  const COLS = 10, ROWS = 20;
  const COLORS = {
    I: "#35e0c9", O: "#ffd447", T: "#b46bff", S: "#48e06b",
    Z: "#ff5470", J: "#4d8bff", L: "#ff9a3d",
  };

  const SHAPES = {
    I: [
      [[0,1],[1,1],[2,1],[3,1]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[1,0],[1,1],[1,2],[1,3]],
    ],
    O: [
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
    ],
    T: [
      [[1,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[0,1],[1,1],[1,2]],
    ],
    S: [
      [[1,0],[2,0],[0,1],[1,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[1,1],[2,1],[0,2],[1,2]],
      [[0,0],[0,1],[1,1],[1,2]],
    ],
    Z: [
      [[0,0],[1,0],[1,1],[2,1]],
      [[2,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,0],[0,1],[1,1],[0,2]],
    ],
    J: [
      [[0,0],[0,1],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[0,2],[1,2]],
    ],
    L: [
      [[2,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,1],[0,2]],
      [[0,0],[1,0],[1,1],[1,2]],
    ],
  };
  const PIECES = Object.keys(SHAPES);
  const KICKS = [[0,0],[-1,0],[1,0],[0,-1],[-2,0],[2,0],[0,-2]];

  const boardCanvas = root.querySelector(".tetris-board");
  const bctx = boardCanvas.getContext("2d");
  const holdCanvas = root.querySelector(".tetris-hold");
  const hctx = holdCanvas.getContext("2d");
  const nextCanvas = root.querySelector(".tetris-next");
  const nctx = nextCanvas.getContext("2d");

  const scoreEl = root.querySelector(".tetris-score");
  const linesEl = root.querySelector(".tetris-lines");
  const levelEl = root.querySelector(".tetris-level");
  const bestEl = root.querySelector(".tetris-best");
  const overlay = root.querySelector(".tetris-overlay");
  const overlayTitle = root.querySelector(".tetris-overlay-title");
  const overlaySub = root.querySelector(".tetris-overlay-sub");
  const overlayBtn = root.querySelector(".tetris-overlay-btn");
  const pauseBtn = root.querySelector(".tetris-pause-btn");
  const soundBtn = root.querySelector(".tetris-sound-btn");
  const restartBtn = root.querySelector(".tetris-restart-btn");

  const cleanups = [];
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  }

  let cell = 28;
  function resizeCanvas() {
    const wrap = boardCanvas.parentElement;
    const availH = wrap.clientHeight;
    const availW = wrap.clientWidth;
    cell = Math.floor(Math.min(availH / ROWS, availW / COLS));
    cell = Math.max(cell, 12);
    boardCanvas.width = cell * COLS;
    boardCanvas.height = cell * ROWS;
    draw();
  }
  on(window, "resize", resizeCanvas);

  let grid, current, currentRot, curX, curY, bag, nextQueue, hold, holdUsed;
  let score, lines, level, dropInterval, dropTimer, softDrop;
  let paused, gameOver;
  let soundOn = true;
  let destroyed = false;

  const BEST_KEY = "tetris_best_score_v1";
  bestEl.textContent = localStorage.getItem(BEST_KEY) || "0";

  function newGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function refillBag() {
    const b = [...PIECES];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  }

  function ensureQueue() {
    while (nextQueue.length < 5) {
      if (bag.length === 0) bag = refillBag();
      nextQueue.push(bag.shift());
    }
  }

  function ensureQueueShift() {
    ensureQueue();
    return nextQueue.shift();
  }

  function spawnPiece(type) {
    current = type;
    currentRot = 0;
    curX = 3;
    curY = type === "I" ? -1 : 0;
    holdUsed = false;
    if (collides(current, currentRot, curX, curY)) endGame();
  }

  function cellsFor(type, rot) { return SHAPES[type][rot]; }

  function collides(type, rot, ox, oy) {
    const cells = cellsFor(type, rot);
    for (const [cx, cy] of cells) {
      const x = ox + cx, y = oy + cy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
    return false;
  }

  function lockPiece() {
    const cells = cellsFor(current, currentRot);
    for (const [cx, cy] of cells) {
      const x = curX + cx, y = curY + cy;
      if (y < 0) { endGame(); return; }
      grid[y][x] = current;
    }
    clearLines();
    spawnPiece(ensureQueueShift());
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every((c) => c)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      const table = [0, 100, 300, 500, 800];
      score += table[cleared] * level;
      lines += cleared;
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel !== level) {
        level = newLevel;
        dropInterval = Math.max(90, 1000 - (level - 1) * 75);
      }
      updateStats();
      beep(cleared >= 4 ? 880 : 520, cleared >= 4 ? 0.18 : 0.08);
    }
  }

  function updateStats() {
    scoreEl.textContent = score;
    linesEl.textContent = lines;
    levelEl.textContent = level;
    const best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
    if (score > best) {
      localStorage.setItem(BEST_KEY, String(score));
      bestEl.textContent = String(score);
    }
  }

  function tryMove(dx, dy) {
    if (!collides(current, currentRot, curX + dx, curY + dy)) {
      curX += dx; curY += dy;
      return true;
    }
    return false;
  }

  function tryRotate(dir) {
    const newRot = (currentRot + dir + 4) % 4;
    for (const [kx, ky] of KICKS) {
      if (!collides(current, newRot, curX + kx, curY + ky)) {
        currentRot = newRot;
        curX += kx; curY += ky;
        beep(660, 0.04);
        return true;
      }
    }
    return false;
  }

  function hardDrop() {
    let dist = 0;
    while (!collides(current, currentRot, curX, curY + 1)) { curY++; dist++; }
    score += dist * 2;
    beep(200, 0.06);
    lockPiece();
    draw();
    updateStats();
  }

  function ghostY() {
    let gy = curY;
    while (!collides(current, currentRot, curX, gy + 1)) gy++;
    return gy;
  }

  function doHold() {
    if (holdUsed) return;
    holdUsed = true;
    if (hold === null) {
      hold = current;
      spawnPiece(ensureQueueShift());
    } else {
      const tmp = hold;
      hold = current;
      spawnPiece(tmp);
    }
    draw();
  }

  function drawCellRect(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x, y, size, Math.max(2, size * 0.12));
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x, y + size - Math.max(2, size * 0.12), size, Math.max(2, size * 0.12));
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  function draw() {
    bctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    bctx.strokeStyle = "#1c2338";
    bctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      bctx.beginPath(); bctx.moveTo(x * cell, 0); bctx.lineTo(x * cell, ROWS * cell); bctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      bctx.beginPath(); bctx.moveTo(0, y * cell); bctx.lineTo(COLS * cell, y * cell); bctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) drawCellRect(bctx, x * cell, y * cell, cell, COLORS[grid[y][x]]);
      }
    }
    if (!gameOver && current) {
      const gy = ghostY();
      bctx.globalAlpha = 0.25;
      for (const [cx, cy] of cellsFor(current, currentRot)) {
        const y = gy + cy;
        if (y >= 0) drawCellRect(bctx, (curX + cx) * cell, y * cell, cell, COLORS[current]);
      }
      bctx.globalAlpha = 1;
      for (const [cx, cy] of cellsFor(current, currentRot)) {
        const y = curY + cy;
        if (y >= 0) drawCellRect(bctx, (curX + cx) * cell, y * cell, cell, COLORS[current]);
      }
    }
    drawMini(hctx, holdCanvas, hold ? [hold] : []);
    drawMini(nctx, nextCanvas, nextQueue.slice(0, 4));
  }

  function drawMini(ctx, canvas, list) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const size = 20;
    list.forEach((type, i) => {
      const cells = SHAPES[type][0];
      const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const w = (maxX - minX + 1) * size, h = (maxY - minY + 1) * size;
      const offX = (canvas.width - w) / 2 - minX * size;
      const offY = i * 70 + (70 - h) / 2 - minY * size;
      for (const [cx, cy] of cells) {
        drawCellRect(ctx, offX + cx * size, offY + cy * size, size, COLORS[type]);
      }
    });
  }

  let actx;
  function beep(freq, dur) {
    if (!soundOn) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.frequency.value = freq;
      o.type = "square";
      g.gain.value = 0.05;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.stop(actx.currentTime + dur);
    } catch (e) { /* audio unavailable */ }
  }

  function resetGame() {
    grid = newGrid();
    bag = refillBag();
    nextQueue = [];
    ensureQueue();
    hold = null;
    holdUsed = false;
    score = 0; lines = 0; level = 1;
    dropInterval = 1000;
    dropTimer = 0;
    softDrop = false;
    paused = false;
    gameOver = false;
    spawnPiece(ensureQueueShift());
    updateStats();
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }

  function endGame() {
    gameOver = true;
    overlayTitle.textContent = "Game Over";
    overlaySub.textContent = `Score ${score} · Lines ${lines} · Level ${level}`;
    overlayBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
  }

  function togglePause(force) {
    if (gameOver) return;
    paused = force !== undefined ? force : !paused;
    if (paused) {
      overlayTitle.textContent = "Paused";
      overlaySub.textContent = "";
      overlayBtn.textContent = "Resume";
      overlay.classList.remove("hidden");
      pauseBtn.textContent = "Resume";
    } else {
      overlay.classList.add("hidden");
      pauseBtn.textContent = "Pause";
      lastTime = performance.now();
    }
  }

  let lastTime = performance.now();
  let rafId = null;
  function step(now) {
    if (destroyed) return;
    if (!paused && !gameOver) {
      const dt = now - lastTime;
      lastTime = now;
      dropTimer += dt * (softDrop ? 12 : 1);
      if (dropTimer >= dropInterval) {
        dropTimer = 0;
        if (!tryMove(0, 1)) lockPiece();
        draw();
      }
    }
    rafId = requestAnimationFrame(step);
  }

  on(overlayBtn, "click", () => {
    if (gameOver) { resetGame(); draw(); }
    else togglePause(false);
  });
  on(pauseBtn, "click", () => togglePause());
  on(restartBtn, "click", () => { resetGame(); draw(); });
  on(soundBtn, "click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = "Sound: " + (soundOn ? "On" : "Off");
  });

  const keyRepeat = {};
  on(window, "keydown", (e) => {
    if (gameOver && e.code !== "KeyP") return;
    switch (e.code) {
      case "ArrowLeft": if (!keyRepeat.left) { tryMove(-1, 0); draw(); } keyRepeat.left = true; e.preventDefault(); break;
      case "ArrowRight": if (!keyRepeat.right) { tryMove(1, 0); draw(); } keyRepeat.right = true; e.preventDefault(); break;
      case "ArrowDown": softDrop = true; e.preventDefault(); break;
      case "ArrowUp": case "KeyX": if (!keyRepeat.rotCW) { tryRotate(1); draw(); } keyRepeat.rotCW = true; e.preventDefault(); break;
      case "KeyZ": case "ControlLeft": if (!keyRepeat.rotCCW) { tryRotate(-1); draw(); } keyRepeat.rotCCW = true; e.preventDefault(); break;
      case "Space": if (!keyRepeat.drop) hardDrop(); keyRepeat.drop = true; e.preventDefault(); break;
      case "KeyC": case "ShiftLeft": case "ShiftRight": if (!keyRepeat.hold) doHold(); keyRepeat.hold = true; e.preventDefault(); break;
      case "KeyP": togglePause(); e.preventDefault(); break;
    }
  });
  on(window, "keyup", (e) => {
    switch (e.code) {
      case "ArrowLeft": keyRepeat.left = false; break;
      case "ArrowRight": keyRepeat.right = false; break;
      case "ArrowDown": softDrop = false; break;
      case "ArrowUp": case "KeyX": keyRepeat.rotCW = false; break;
      case "KeyZ": case "ControlLeft": keyRepeat.rotCCW = false; break;
      case "Space": keyRepeat.drop = false; break;
      case "KeyC": case "ShiftLeft": case "ShiftRight": keyRepeat.hold = false; break;
    }
  });

  let dasDir = 0, dasTimer = 0, dasCharged = false;
  on(window, "keydown", (e) => {
    if (e.code === "ArrowLeft") dasDir = -1;
    if (e.code === "ArrowRight") dasDir = 1;
  });
  on(window, "keyup", (e) => {
    if ((e.code === "ArrowLeft" && dasDir === -1) || (e.code === "ArrowRight" && dasDir === 1)) {
      dasDir = 0; dasCharged = false; dasTimer = 0;
    }
  });
  const dasIntervalId = setInterval(() => {
    if (paused || gameOver || dasDir === 0) return;
    dasTimer += 50;
    const delay = dasCharged ? 50 : 160;
    if (dasTimer >= delay) {
      dasTimer = 0; dasCharged = true;
      tryMove(dasDir, 0); draw();
    }
  }, 50);
  cleanups.push(() => clearInterval(dasIntervalId));

  function bindHold(el, fn, repeat) {
    let iv;
    const start = (e) => { e.preventDefault(); fn(); if (repeat) iv = setInterval(fn, 110); };
    const stop = () => clearInterval(iv);
    on(el, "touchstart", start, { passive: false });
    on(el, "touchend", stop);
    on(el, "touchcancel", stop);
    on(el, "mousedown", start);
    on(window, "mouseup", stop);
  }

  bindHold(root.querySelector(".tc-left"), () => { tryMove(-1, 0); draw(); }, true);
  bindHold(root.querySelector(".tc-right"), () => { tryMove(1, 0); draw(); }, true);
  bindHold(root.querySelector(".tc-down"), () => { tryMove(0, 1); draw(); }, true);
  bindHold(root.querySelector(".tc-rotate"), () => { tryRotate(1); draw(); }, false);
  bindHold(root.querySelector(".tc-hold"), () => { doHold(); }, false);
  bindHold(root.querySelector(".tc-drop"), () => { hardDrop(); }, false);

  let touchStartY = null, touchStartX = null;
  on(boardCanvas, "touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  on(boardCanvas, "touchend", (e) => {
    if (touchStartY === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dy) > Math.abs(dx) && dy > 60) hardDrop();
    else if (Math.abs(dx) < 20 && Math.abs(dy) < 20) { tryRotate(1); draw(); }
    touchStartY = null;
  });

  on(document, "gesturestart", (e) => e.preventDefault());

  resetGame();
  resizeCanvas();
  rafId = requestAnimationFrame(step);

  return function destroy() {
    destroyed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (actx) { try { actx.close(); } catch (e) { /* noop */ } }
    cleanups.forEach((fn) => fn());
  };
}
