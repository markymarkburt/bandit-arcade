// Flappy Bandit — flap, dodge, repeat. No backend, all client-side canvas.

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
const GRAVITY = 0.45;
const FLAP = -7.6;
const BANDIT_X = 90;
const BANDIT_R = 15;
const PIPE_W = 64;
const PIPE_SPACING = 210;
const BASE_SPEED = 2.4;

// ---------- State ----------
const state = {
  mode: "ready", // ready | playing | dead
  y: H / 2,
  vy: 0,
  pipes: [],
  score: 0,
  best: 0,
  runs: 0,
  frame: 0,
  groundScroll: 0,
  rotation: 0,
};

function gapSize() {
  // Tightens slowly as the score climbs, floor of 130px.
  return Math.max(130, 170 - state.score * 0.8);
}

function speed() {
  return Math.min(4.0, BASE_SPEED + state.score * 0.03);
}

function reset() {
  state.y = H / 2;
  state.vy = 0;
  state.pipes = [];
  state.score = 0;
  state.frame = 0;
  state.rotation = 0;
  spawnPipe(W + 120);
  spawnPipe(W + 120 + PIPE_SPACING);
  spawnPipe(W + 120 + PIPE_SPACING * 2);
}

function spawnPipe(x) {
  const gap = gapSize();
  const margin = 60;
  const top = margin + Math.random() * (H - gap - margin * 2 - 90);
  state.pipes.push({ x, top, gap, scored: false });
}

function flap() {
  if (state.mode === "playing") {
    state.vy = FLAP;
  }
}

function start() {
  reset();
  state.mode = "playing";
  state.runs++;
  overlay.classList.add("hidden");
  $("runs").textContent = state.runs;
  $("score").textContent = "0";
}

function die() {
  state.mode = "dead";
  if (state.score > state.best) {
    state.best = state.score;
    $("best").textContent = state.best;
  }
  overlayTitle.textContent = "WASTED";
  overlaySub.textContent = `Score ${state.score} · Best ${state.best}. One more run?`;
  startBtn.textContent = "RETRY";
  overlay.classList.remove("hidden");
}

// ---------- Update ----------
function update() {
  if (state.mode !== "playing") return;
  state.frame++;
  state.groundScroll = (state.groundScroll + speed()) % 40;

  // Physics.
  state.vy += GRAVITY;
  state.y += state.vy;
  state.rotation = Math.max(-0.5, Math.min(1.2, state.vy * 0.09));

  // Pipes.
  const v = speed();
  for (const pipe of state.pipes) {
    pipe.x -= v;
    if (!pipe.scored && pipe.x + PIPE_W < BANDIT_X - BANDIT_R) {
      pipe.scored = true;
      state.score++;
      $("score").textContent = state.score;
    }
  }
  if (state.pipes.length && state.pipes[0].x < -PIPE_W) {
    state.pipes.shift();
    spawnPipe(state.pipes[state.pipes.length - 1].x + PIPE_SPACING);
  }

  // Collisions.
  if (state.y + BANDIT_R >= H - 56 || state.y - BANDIT_R <= 0) {
    die();
    return;
  }
  for (const pipe of state.pipes) {
    const inX = BANDIT_X + BANDIT_R > pipe.x && BANDIT_X - BANDIT_R < pipe.x + PIPE_W;
    if (!inX) continue;
    const gapTop = pipe.top;
    const gapBottom = pipe.top + pipe.gap;
    if (state.y - BANDIT_R < gapTop || state.y + BANDIT_R > gapBottom) {
      die();
      return;
    }
  }
}

// ---------- Draw ----------
function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#1b2340");
  sky.addColorStop(0.6, "#2a3355");
  sky.addColorStop(1, "#3a2f4f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars.
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 24; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % (H * 0.5);
    ctx.fillRect(x, y, 2, 2);
  }

  // Moon.
  ctx.beginPath();
  ctx.arc(W - 70, 70, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#f5e9c8";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W - 62, 64, 22, 0, Math.PI * 2);
  ctx.fillStyle = "#1b2340";
  ctx.fill();
}

function drawPipes() {
  for (const pipe of state.pipes) {
    const gapBottom = pipe.top + pipe.gap;
    pipeRect(pipe.x, 0, PIPE_W, pipe.top, true);
    pipeRect(pipe.x, gapBottom, PIPE_W, H - gapBottom - 56, false);
  }
}

function pipeRect(x, y, w, h, isTop) {
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, "#3f51b5");
  grad.addColorStop(0.5, "#5c6bc0");
  grad.addColorStop(1, "#2c3a8c");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  // Cap.
  ctx.fillStyle = "#6f7fd0";
  const capH = 16;
  const capY = isTop ? y + h - capH : y;
  ctx.fillRect(x - 4, capY, w + 8, capH);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 4, capY, w + 8, capH);
}

function drawGround() {
  ctx.fillStyle = "#2a2f3a";
  ctx.fillRect(0, H - 56, W, 56);
  ctx.fillStyle = "#f5c542";
  ctx.fillRect(0, H - 56, W, 4);
  // Scroll stripes.
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let x = -state.groundScroll; x < W; x += 40) {
    ctx.fillRect(x, H - 40, 20, 8);
  }
}

function drawBandit() {
  ctx.save();
  ctx.translate(BANDIT_X, state.y);
  ctx.rotate(state.rotation);

  // Body.
  ctx.beginPath();
  ctx.arc(0, 0, BANDIT_R, 0, Math.PI * 2);
  ctx.fillStyle = "#f5c542";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#8a6a1c";
  ctx.stroke();

  // Bandit mask.
  ctx.fillStyle = "#1c2333";
  ctx.fillRect(-BANDIT_R, -6, BANDIT_R * 2, 9);

  // Eye.
  ctx.beginPath();
  ctx.arc(5, -2, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -2, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = "#1c2333";
  ctx.fill();

  // Wing (flaps with the frame counter).
  const wingUp = state.mode === "playing" && Math.floor(state.frame / 6) % 2 === 0;
  ctx.beginPath();
  ctx.ellipse(-6, wingUp ? -4 : 4, 8, 5, wingUp ? -0.5 : 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "#e0a92e";
  ctx.fill();

  ctx.restore();
}

function drawScore() {
  if (state.mode !== "playing") return;
  ctx.font = "800 40px Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillText(state.score, W / 2 + 2, 62);
  ctx.fillStyle = "#fff";
  ctx.fillText(state.score, W / 2, 60);
}

function draw() {
  drawSky();
  drawPipes();
  drawGround();
  drawBandit();
  drawScore();
}

// ---------- Loop ----------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ---------- Input ----------
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  flap();
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (state.mode === "playing") flap();
    else start();
  }
});
startBtn.addEventListener("click", start);

reset();
loop();
