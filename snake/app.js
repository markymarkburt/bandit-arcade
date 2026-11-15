// Bandit Snake — eat, grow, don't eat yourself. No backend, all client-side canvas.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const $ = (id) => document.getElementById(id);
const overlay = $("overlay");
const overlayTitle = $("overlay-title");
const overlaySub = $("overlay-sub");
const startBtn = $("start-btn");

// ---------- Tuning ----------
const CELL = 20;
const COLS = W / CELL; // 20
const ROWS = H / CELL; // 20
const BASE_TICK = 150; // ms per step at the start
const MIN_TICK = 70;

// ---------- State ----------
const state = {
  mode: "ready", // ready | playing | dead
  snake: [],     // [{x,y}], head first
  dir: { x: 1, y: 0 },
  nextDir: { x: 1, y: 0 },
  food: null,
  score: 0,
  best: 0,
  tick: BASE_TICK,
  lastStep: 0,
  touchStart: null,
};

function reset() {
  const cy = Math.floor(ROWS / 2);
  state.snake = [
    { x: 6, y: cy },
    { x: 5, y: cy },
    { x: 4, y: cy },
  ];
  state.dir = { x: 1, y: 0 };
  state.nextDir = { x: 1, y: 0 };
  state.score = 0;
  state.tick = BASE_TICK;
  placeFood();
}

function placeFood() {
  // Random empty cell.
  while (true) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
    if (!state.snake.some((s) => s.x === x && s.y === y)) {
      state.food = { x, y };
      return;
    }
  }
}

function start() {
  reset();
  state.mode = "playing";
  state.lastStep = performance.now();
  overlay.classList.add("hidden");
  $("score").textContent = "0";
  $("length").textContent = state.snake.length;
}

function die() {
  state.mode = "dead";
  if (state.score > state.best) {
    state.best = state.score;
    $("best").textContent = state.best;
  }
  overlayTitle.textContent = "GAME OVER";
  overlaySub.textContent = `Score ${state.score} · Best ${state.best}. Again?`;
  startBtn.textContent = "RETRY";
  overlay.classList.remove("hidden");
}

function setDirection(x, y) {
  // No reversing into yourself.
  if (x === -state.dir.x && y === -state.dir.y) return;
  state.nextDir = { x, y };
}

// ---------- Update ----------
function step() {
  state.dir = state.nextDir;
  const head = state.snake[0];
  const nx = head.x + state.dir.x;
  const ny = head.y + state.dir.y;

  // Walls.
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
    die();
    return;
  }
  // Self (exclude the tail tip, which moves away this step — unless we eat).
  const eating = state.food && nx === state.food.x && ny === state.food.y;
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((s) => s.x === nx && s.y === ny)) {
    die();
    return;
  }

  state.snake.unshift({ x: nx, y: ny });

  if (eating) {
    state.score += 10;
    state.tick = Math.max(MIN_TICK, BASE_TICK - state.score / 10 * 3);
    $("score").textContent = state.score;
    $("length").textContent = state.snake.length;
    placeFood();
  } else {
    state.snake.pop();
  }
}

// ---------- Draw ----------
function drawBoard() {
  // Checkered felt board.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#1e4636" : "#1a3d2f";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
}

function drawFood() {
  if (!state.food) return;
  const cx = state.food.x * CELL + CELL / 2;
  const cy = state.food.y * CELL + CELL / 2;
  // Gold loot coin with a soft pulse.
  const pulse = 1 + Math.sin(performance.now() / 200) * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, (CELL / 2 - 3) * pulse, 0, Math.PI * 2);
  ctx.fillStyle = "#f5c542";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 2, (CELL / 5) * pulse, 0, Math.PI * 2);
  ctx.fillStyle = "#ffe9a3";
  ctx.fill();
}

function drawSnake() {
  state.snake.forEach((seg, i) => {
    const isHead = i === 0;
    const t = i / Math.max(1, state.snake.length - 1);
    // Indigo head fading to a darker tail.
    const r = Math.round(92 - t * 40);
    const g = Math.round(107 - t * 45);
    const b = Math.round(192 - t * 60);
    ctx.fillStyle = isHead ? "#5c6bc0" : `rgb(${r},${g},${b})`;
    const pad = isHead ? 1 : 2;
    roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5);
    ctx.fill();

    if (isHead) {
      // Bandit mask + eyes, oriented by direction.
      const cx = seg.x * CELL + CELL / 2;
      const cy = seg.y * CELL + CELL / 2;
      ctx.fillStyle = "#1c2333";
      ctx.fillRect(seg.x * CELL + 2, cy - 4, CELL - 4, 7);
      const ex = state.dir.x * 3;
      const ey = state.dir.y * 3;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx + ex - 3, cy + ey - 1, 1.8, 0, Math.PI * 2);
      ctx.arc(cx + ex + 3, cy + ey - 1, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw() {
  drawBoard();
  drawFood();
  drawSnake();
}

// ---------- Loop ----------
function loop(now) {
  if (state.mode === "playing" && now - state.lastStep >= state.tick) {
    state.lastStep = now;
    step();
  }
  draw();
  requestAnimationFrame(loop);
}

// ---------- Input ----------
const KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
};

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && state.mode !== "playing") {
    e.preventDefault();
    start();
    return;
  }
  const dir = KEYS[e.key];
  if (dir && state.mode === "playing") {
    e.preventDefault();
    setDirection(dir[0], dir[1]);
  }
});

canvas.addEventListener("pointerdown", (e) => {
  state.touchStart = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", (e) => {
  if (!state.touchStart || state.mode !== "playing") return;
  const dx = e.clientX - state.touchStart.x;
  const dy = e.clientY - state.touchStart.y;
  state.touchStart = null;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) setDirection(Math.sign(dx), 0);
  else setDirection(0, Math.sign(dy));
});

startBtn.addEventListener("click", start);

reset();
requestAnimationFrame(loop);
