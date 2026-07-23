// Standalone platformer engine — vanilla canvas + WebAudio, no React deps.
// mountPixelPlumber(root) wires everything up against elements inside `root`
// and returns a destroy() that removes every listener/rAF/timeout it
// created, since the Next.js route unmounts/remounts this on navigation.
export function mountPixelPlumber(root) {
  const TILE = 32;
  const VIEW_COLS = 20, VIEW_ROWS = 12;
  const canvas = root.querySelector(".mario-canvas");
  canvas.width = TILE * VIEW_COLS;
  canvas.height = TILE * VIEW_ROWS;
  const ctx = canvas.getContext("2d");

  const SOLID = new Set(["#", "B", "?", "="]);

  const scoreEl = root.querySelector(".mario-score");
  const coinsEl = root.querySelector(".mario-coins");
  const worldEl = root.querySelector(".mario-world");
  const livesEl = root.querySelector(".mario-lives");
  const timeEl = root.querySelector(".mario-time");
  const overlay = root.querySelector(".mario-overlay");
  const overlayTitle = root.querySelector(".mario-overlay-title");
  const overlaySub = root.querySelector(".mario-overlay-sub");
  const overlayBtn = root.querySelector(".mario-overlay-btn");
  const pauseBtn = root.querySelector(".mario-pause-btn");
  const soundBtn = root.querySelector(".mario-sound-btn");
  const restartBtn = root.querySelector(".mario-restart-btn");

  const cleanups = [];
  const timeouts = [];
  function on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  }
  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timeouts.push(id);
    return id;
  }

  function buildLevel(spec) {
    const rows = VIEW_ROWS;
    const grid = Array.from({ length: rows }, () => Array(spec.width).fill("."));
    for (let x = 0; x < spec.width; x++) { grid[10][x] = "#"; grid[11][x] = "#"; }
    (spec.pits || []).forEach(([s, e]) => {
      for (let x = s; x <= e; x++) { grid[10][x] = "."; grid[11][x] = "."; }
    });
    (spec.blocks || []).forEach(([x, y, t]) => { grid[y][x] = t; });
    (spec.coins || []).forEach(([x, y]) => { grid[y][x] = "C"; });
    for (let y = 2; y <= 9; y++) grid[y][spec.flagX] = "F";
    return { grid, width: spec.width, startX: spec.startX, flagX: spec.flagX, goombas: spec.goombas || [], name: spec.name };
  }

  const LEVELS = [
    buildLevel({
      name: "1-1", width: 60, startX: 2, flagX: 55,
      pits: [[18, 20], [34, 36]],
      blocks: [[10,7,"?"],[11,7,"B"],[12,7,"?"],[13,7,"B"],
               [24,7,"?"],[25,6,"?"],
               [40,7,"B"],[41,7,"?"],[42,7,"B"],
               [46,9,"="],[47,9,"="]],
      coins: [[10,4],[24,4],[25,3],[41,4],[52,9],[53,9]],
      goombas: [{ x: 16 }, { x: 30 }, { x: 44 }, { x: 51 }],
    }),
    buildLevel({
      name: "1-2", width: 75, startX: 2, flagX: 70,
      pits: [[12,13],[26,28],[44,46],[58,60]],
      blocks: [[8,7,"?"],[9,7,"B"],[16,6,"?"],[17,6,"?"],[18,6,"?"],
               [30,7,"B"],[31,7,"?"],[32,7,"B"],
               [38,9,"="],[39,9,"="],[40,9,"="],
               [50,7,"?"],[51,6,"?"],[52,5,"?"],
               [62,7,"B"],[63,7,"?"],[64,7,"B"]],
      coins: [[8,4],[16,3],[17,3],[18,3],[31,4],[50,4],[51,3],[52,2],[67,9],[68,9]],
      goombas: [{ x: 14 }, { x: 22 }, { x: 34 }, { x: 48 }, { x: 55 }, { x: 65 }],
    }),
    buildLevel({
      name: "1-3", width: 90, startX: 2, flagX: 85,
      pits: [[10,11],[20,22],[30,31],[42,44],[54,56],[66,68],[76,78]],
      blocks: [[7,7,"?"],[15,6,"B"],[16,6,"?"],[17,6,"B"],
               [25,7,"?"],[35,6,"?"],[36,5,"?"],[37,4,"?"],
               [47,7,"B"],[48,7,"?"],[49,7,"B"],[50,7,"?"],
               [60,9,"="],[61,9,"="],[62,9,"="],[63,9,"="],
               [72,6,"?"],[73,6,"?"],[80,7,"B"],[81,7,"?"]],
      coins: [[7,4],[16,3],[25,4],[36,1],[48,4],[73,3],[83,9],[84,9]],
      goombas: [{ x: 13 },{ x: 19 },{ x: 27 },{ x: 33 },{ x: 40 },{ x: 51 },{ x: 58 },{ x: 70 },{ x: 79 }],
    }),
  ];

  let level, levelIdx, entities, player, camX, score, coins, lives, timeLeft, timerAcc;
  let paused, gameOver, levelComplete, gameWon;
  let soundOn = true;
  let lastTime;
  let destroyed = false;

  function resetLevel(idx, keepStats) {
    levelIdx = idx;
    level = LEVELS[idx];
    camX = 0;
    player = {
      x: level.startX * TILE, y: 9 * TILE, w: 22, h: 30,
      vx: 0, vy: 0, onGround: false, facing: 1, alive: true,
      invuln: 0, jumpHeld: false,
    };
    entities = {
      goombas: level.goombas.map((g) => ({
        x: g.x * TILE, y: 9 * TILE, w: 26, h: 24, vx: -40, alive: true, squashT: 0,
      })),
      coins: [],
      bumps: [],
    };
    for (let y = 0; y < VIEW_ROWS; y++) {
      for (let x = 0; x < level.width; x++) {
        if (level.grid[y][x] === "C") entities.coins.push({ x, y, taken: false, bob: Math.random() * 6.28 });
      }
    }
    if (!keepStats) { score = 0; coins = 0; lives = 3; }
    timeLeft = 400;
    timerAcc = 0;
    paused = false; gameOver = false; levelComplete = false; gameWon = false;
    worldEl.textContent = level.name;
    updateHud();
    overlay.classList.add("hidden");
    lastTime = performance.now();
  }

  function updateHud() {
    scoreEl.textContent = String(score).padStart(6, "0");
    coinsEl.textContent = coins;
    livesEl.textContent = lives;
    timeEl.textContent = Math.max(0, Math.ceil(timeLeft));
  }

  let actx;
  function beep(freq, dur, type) {
    if (!soundOn) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.frequency.value = freq;
      o.type = type || "square";
      g.gain.value = 0.06;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.stop(actx.currentTime + dur);
    } catch (e) { /* audio unavailable */ }
  }

  const GRAVITY = 1400;
  const JUMP_V = 560;
  const WALK_SPEED = 150;
  const RUN_SPEED = 250;
  const ACCEL = 900;
  const FRICTION = 1200;

  function tileAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (ty < 0 || ty >= VIEW_ROWS || tx < 0 || tx >= level.width) return ".";
    return level.grid[ty][tx];
  }
  function solidAt(px, py) { return SOLID.has(tileAt(px, py)); }

  function moveEntityX(e, dx) {
    if (dx === 0) return;
    e.x += dx;
    const dir = dx > 0 ? 1 : -1;
    const edgeX = dir > 0 ? e.x + e.w : e.x;
    for (const py of [e.y + 1, e.y + e.h / 2, e.y + e.h - 1]) {
      if (solidAt(edgeX, py)) {
        const tx = Math.floor(edgeX / TILE);
        e.x = dir > 0 ? tx * TILE - e.w : (tx + 1) * TILE;
        e.vx = 0;
        return true;
      }
    }
    return false;
  }

  function moveEntityY(e, dy) {
    if (dy === 0) return;
    e.y += dy;
    const dir = dy > 0 ? 1 : -1;
    const edgeY = dir > 0 ? e.y + e.h : e.y;
    for (const px of [e.x + 1, e.x + e.w / 2, e.x + e.w - 1]) {
      if (solidAt(px, edgeY)) {
        const ty = Math.floor(edgeY / TILE);
        e.y = dir > 0 ? ty * TILE - e.h : (ty + 1) * TILE;
        if (dir > 0) e.onGround = true;
        if (dir < 0 && e === player) hitBlockAbove(px, edgeY);
        e.vy = 0;
        return true;
      }
    }
    return false;
  }

  function hitBlockAbove(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const t = level.grid[ty] && level.grid[ty][tx];
    if (t === "?") {
      level.grid[ty][tx] = "B";
      score += 50;
      coins += 1;
      beep(1000, 0.08);
      entities.bumps.push({ x: tx, y: ty, t: 0 });
    } else if (t === "B") {
      beep(180, 0.05);
      entities.bumps.push({ x: tx, y: ty, t: 0 });
    }
  }

  const keys = {};
  on(window, "keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "KeyP") togglePause();
    if (["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
  });
  on(window, "keyup", (e) => { keys[e.code] = false; });

  let touchLeft = false, touchRight = false, touchRun = false, touchJumpHeld = false, touchJumpPressed = false;

  function wantLeft() { return keys.ArrowLeft || keys.KeyA || touchLeft; }
  function wantRight() { return keys.ArrowRight || keys.KeyD || touchRight; }
  function wantRun() { return keys.KeyZ || keys.ShiftLeft || keys.ShiftRight || touchRun; }
  let prevJump = false;
  function wantJumpPressed() {
    const p = (keys.Space || keys.ArrowUp || keys.KeyW) && !prevJump;
    return p || touchJumpPressed;
  }

  function playerDie() {
    if (!player.alive) return;
    player.alive = false;
    beep(140, 0.5, "sawtooth");
    lives--;
    updateHud();
    if (lives <= 0) endGame(false);
    else later(() => resetLevel(levelIdx, true), 900);
  }

  function killGoomba(g) {
    g.alive = false;
    g.squashT = 0.001;
    score += 100;
    beep(300, 0.08);
  }

  function endGame(won) {
    gameOver = !won;
    gameWon = won;
    overlayTitle.textContent = won ? "You Win!" : "Game Over";
    overlaySub.textContent = won
      ? `Final score ${score} · Coins ${coins}`
      : `Score ${score} · Coins ${coins}\nReached world ${level.name}`;
    overlayBtn.textContent = "Play Again";
    overlay.classList.remove("hidden");
  }

  function completeLevel() {
    if (levelComplete) return;
    levelComplete = true;
    beep(660, 0.12); beep(880, 0.12);
    score += Math.ceil(timeLeft) * 2;
    updateHud();
    if (levelIdx + 1 < LEVELS.length) {
      overlayTitle.textContent = "Level Complete!";
      overlaySub.textContent = `Score ${score} · Coins ${coins}`;
      overlayBtn.textContent = "Next Level";
      overlay.classList.remove("hidden");
    } else {
      later(() => endGame(true), 200);
    }
  }

  on(overlayBtn, "click", () => {
    if (gameOver || gameWon) { resetLevel(0, false); return; }
    if (levelComplete) { resetLevel(levelIdx + 1, true); return; }
    togglePause(false);
  });
  on(pauseBtn, "click", () => togglePause());
  on(restartBtn, "click", () => resetLevel(0, false));
  on(soundBtn, "click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = "Sound: " + (soundOn ? "On" : "Off");
  });

  function togglePause(force) {
    if (gameOver || levelComplete || gameWon) return;
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

  function update(dt) {
    if (paused || gameOver || levelComplete || gameWon) return;

    timerAcc += dt;
    if (timerAcc > 0.4) {
      timerAcc = 0;
      timeLeft -= 1;
      updateHud();
      if (timeLeft <= 0) playerDie();
    }

    if (player.alive) {
      const left = wantLeft(), right = wantRight(), run = wantRun();
      const target = (right ? 1 : 0) - (left ? 1 : 0);
      const maxSpeed = run ? RUN_SPEED : WALK_SPEED;
      if (target !== 0) {
        player.facing = target;
        player.vx += target * ACCEL * dt;
        player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));
      } else {
        if (player.vx > 0) player.vx = Math.max(0, player.vx - FRICTION * dt);
        else if (player.vx < 0) player.vx = Math.min(0, player.vx + FRICTION * dt);
      }

      const jumpPressed = wantJumpPressed();
      const jumpHeldNow = keys.Space || keys.ArrowUp || keys.KeyW || touchJumpHeld;
      if (jumpPressed && player.onGround) {
        player.vy = -JUMP_V;
        player.onGround = false;
        player.jumpHeld = true;
        beep(520, 0.09);
      }
      if (player.vy < 0 && !jumpHeldNow) player.jumpHeld = false;
      const g = (player.vy < 0 && player.jumpHeld) ? GRAVITY * 0.55 : GRAVITY;
      player.vy += g * dt;
      player.vy = Math.min(player.vy, 900);

      player.onGround = false;
      moveEntityX(player, player.vx * dt);
      moveEntityY(player, player.vy * dt);

      if (player.y > VIEW_ROWS * TILE + 40) playerDie();
      if (player.invuln > 0) player.invuln -= dt;

      for (const c of entities.coins) {
        if (c.taken) continue;
        c.bob += dt * 6;
        const cx = c.x * TILE + 8, cy = c.y * TILE + 8 + Math.sin(c.bob) * 3;
        if (aabb(player.x, player.y, player.w, player.h, cx, cy, 16, 16)) {
          c.taken = true; coins++; score += 20; updateHud(); beep(1100, 0.06);
        }
      }

      for (const g2 of entities.goombas) {
        if (!g2.alive) continue;
        if (g2.squashT > 0) continue;
        g2.x += g2.vx * dt;
        const frontX = g2.vx > 0 ? g2.x + g2.w + 1 : g2.x - 1;
        const belowY = g2.y + g2.h + 2;
        if (solidAt(frontX, g2.y + g2.h / 2) || !solidAt(frontX, belowY)) {
          g2.vx *= -1;
          g2.x += g2.vx * dt * 2;
        }
        if (g2.y > VIEW_ROWS * TILE + 60) g2.alive = false;

        if (aabb(player.x, player.y, player.w, player.h, g2.x, g2.y, g2.w, g2.h)) {
          const playerBottom = player.y + player.h;
          const stomping = player.vy > 0 && playerBottom - player.vy * dt <= g2.y + 8;
          if (stomping) {
            killGoomba(g2);
            player.vy = -JUMP_V * 0.6;
          } else if (player.invuln <= 0) {
            playerDie();
          }
        }
      }

      if (player.x >= level.flagX * TILE) completeLevel();
    }

    for (const g2 of entities.goombas) {
      if (g2.squashT > 0) {
        g2.squashT += dt;
        if (g2.squashT > 0.3) g2.alive = false;
      }
    }
    entities.bumps.forEach((b) => b.t += dt);
    entities.bumps = entities.bumps.filter((b) => b.t < 0.15);

    const targetCam = player.x - VIEW_COLS * TILE / 2;
    camX = Math.max(0, Math.min(targetCam, level.width * TILE - VIEW_COLS * TILE));
  }

  function aabb(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  const TILE_COLORS = { "#": "#c84c0c", "B": "#e0824a", "?": "#fbd000", "=": "#2e9e3a" };

  function drawTile(t, px, py) {
    if (t === ".") return;
    if (t === "F") return;
    if (t === "C") return;
    if (t === "?") {
      ctx.fillStyle = "#fbd000";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#c88e00";
      ctx.fillRect(px, py, TILE, 4);
      ctx.fillStyle = "#7a4a00";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "center";
      ctx.fillText("?", px + TILE / 2, py + TILE / 2 + 6);
      return;
    }
    ctx.fillStyle = TILE_COLORS[t] || "#888";
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    if (t === "#") {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(px, py, TILE, 4);
    }
    if (t === "B") {
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.moveTo(px, py + TILE / 2); ctx.lineTo(px + TILE, py + TILE / 2);
      ctx.moveTo(px + TILE / 2, py); ctx.lineTo(px + TILE / 2, py + TILE / 2);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const px = player.x - camX, py = player.y;
    const facing = player.facing;
    ctx.save();
    if (player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#2a5fd0";
    ctx.fillRect(px + 3, py + 20, 7, 10);
    ctx.fillRect(px + player.w - 10, py + 20, 7, 10);
    ctx.fillStyle = "#2a5fd0";
    ctx.fillRect(px + 2, py + 12, player.w - 4, 10);
    ctx.fillStyle = "#e0463c";
    ctx.fillRect(px, py + 10, player.w, 6);
    ctx.fillStyle = "#f2c090";
    ctx.fillRect(px + 3, py + 2, player.w - 6, 9);
    ctx.fillStyle = "#e0463c";
    ctx.fillRect(px + 2, py, player.w - 4, 4);
    ctx.fillRect(px + (facing > 0 ? player.w - 6 : 0), py + 3, 6, 3);
    ctx.restore();
  }

  function drawGoomba(g) {
    const px = g.x - camX, py = g.y;
    const squash = g.squashT > 0 ? Math.min(1, g.squashT / 0.3) : 0;
    ctx.save();
    ctx.translate(px, py + g.h * squash * 0.6);
    ctx.scale(1, 1 - squash * 0.6);
    ctx.fillStyle = "#8a4b2a";
    ctx.beginPath();
    ctx.ellipse(g.w / 2, g.h / 2, g.w / 2, g.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a2a12";
    ctx.fillRect(0, g.h - 6, g.w, 6);
    ctx.fillStyle = "#fff";
    ctx.fillRect(g.w * 0.22, g.h * 0.35, 5, 5);
    ctx.fillRect(g.w * 0.62, g.h * 0.35, 5, 5);
    ctx.fillStyle = "#000";
    ctx.fillRect(g.w * 0.24, g.h * 0.4, 2, 2);
    ctx.fillRect(g.w * 0.64, g.h * 0.4, 2, 2);
    ctx.restore();
  }

  function drawCoin(c) {
    const cx = c.x * TILE + 16 - camX, cy = c.y * TILE + 16 + Math.sin(c.bob) * 3;
    ctx.fillStyle = "#fbd000";
    ctx.beginPath();
    ctx.ellipse(cx, cy, 7 * Math.abs(Math.cos(c.bob * 0.7)) + 2, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a87a00";
    ctx.stroke();
  }

  function drawFlag() {
    const px = level.flagX * TILE - camX;
    ctx.fillStyle = "#cfcfcf";
    ctx.fillRect(px + 14, 2 * TILE, 4, 8 * TILE);
    ctx.fillStyle = "#3fae4a";
    ctx.beginPath();
    ctx.moveTo(px + 18, 2 * TILE + 4);
    ctx.lineTo(px + 40, 2 * TILE + 12);
    ctx.lineTo(px + 18, 2 * TILE + 20);
    ctx.closePath();
    ctx.fill();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 260) - camX * 0.3) % (canvas.width + 200) - 100;
      ctx.beginPath();
      ctx.ellipse(cx, 50 + (i % 3) * 20, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const startCol = Math.max(0, Math.floor(camX / TILE) - 1);
    const endCol = Math.min(level.width, startCol + VIEW_COLS + 3);
    for (let y = 0; y < VIEW_ROWS; y++) {
      for (let x = startCol; x < endCol; x++) {
        const t = level.grid[y][x];
        if (t !== ".") drawTile(t, x * TILE - camX, y * TILE);
      }
    }
    drawFlag();
    entities.coins.forEach((c) => { if (!c.taken) drawCoin(c); });
    entities.goombas.forEach((g) => { if (g.alive || g.squashT > 0) drawGoomba(g); });
    if (player.alive) drawPlayer();
  }

  let rafId = null;
  function loop(now) {
    if (destroyed) return;
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    prevJump = keys.Space || keys.ArrowUp || keys.KeyW || touchJumpHeld;
    touchJumpPressed = false;
    rafId = requestAnimationFrame(loop);
  }

  function bind(el, onDown, onUp) {
    const down = (e) => { e.preventDefault(); onDown(); };
    const up = (e) => { if (e) e.preventDefault(); onUp && onUp(); };
    on(el, "touchstart", down, { passive: false });
    on(el, "touchend", up, { passive: false });
    on(el, "touchcancel", up, { passive: false });
    on(el, "mousedown", down);
    on(window, "mouseup", up);
  }
  bind(root.querySelector(".tc-left"), () => (touchLeft = true), () => (touchLeft = false));
  bind(root.querySelector(".tc-right"), () => (touchRight = true), () => (touchRight = false));
  bind(root.querySelector(".tc-run"), () => (touchRun = true), () => (touchRun = false));
  bind(root.querySelector(".tc-jump"), () => { touchJumpHeld = true; touchJumpPressed = true; }, () => (touchJumpHeld = false));

  on(document, "gesturestart", (e) => e.preventDefault());

  resetLevel(0, false);
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);

  return function destroy() {
    destroyed = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (actx) { try { actx.close(); } catch (e) { /* noop */ } }
    timeouts.forEach((id) => clearTimeout(id));
    cleanups.forEach((fn) => fn());
  };
}
