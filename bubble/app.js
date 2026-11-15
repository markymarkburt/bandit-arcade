// Bubble Bandit — bubble shooter. Aim, fire, match 3. No backend, all client-side canvas.

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
const R = 16;                 // bubble radius
const COLS = 11;              // bubbles in a full (even) row
const ROW_H = Math.round(R * 1.75); // hex row spacing
const GRID_TOP = 40;
const SHOOT_Y = H - 40;
const SHOT_SPEED = 9;
const START_ROWS = 5;
const DANGER_Y = H - 120;     // lose line

const COLORS = [
  { fill: "#5c6bc0", dark: "#3f51b5" }, // indigo
  { fill: "#f50057", dark: "#b0003a" }, // pink
  { fill: "#f5c542", dark: "#c9962e" }, // gold
  { fill: "#4ade80", dark: "#2a9d54" }, // green
  { fill: "#61dafb", dark: "#3aa7c7" }, // react blue
];

// ---------- State ----------
const state = {
  mode: "ready", // ready | playing | won | dead
  grid: [],      // rows of color-index-or-null, hex offset by row parity
  aim: -Math.PI / 2,
  shot: null,    // {x,y,vx,vy,color}
  nextColor: 0,
  currentColor: 0,
  score: 0,
  best: 0,
  popping: [],   // {x,y,color,t} pop animations
  falling: [],   // {x,y,vy,color} falling bubbles
};

function rowCols(row) {
  return row % 2 === 0 ? COLS : COLS - 1;
}

function cellXY(row, col) {
  const offset = row % 2 === 0 ? 0 : R;
  return {
    x: col * R * 2 + R + offset + (W - (COLS * 2 + 1) * R) / 2,
    y: GRID_TOP + row * ROW_H + R,
  };
}

function randomColor() {
  return Math.floor(Math.random() * COLORS.length);
}

function reset() {
  state.grid = [];
  for (let r = 0; r < START_ROWS; r++) {
    const row = [];
    for (let c = 0; c < rowCols(r); c++) row.push(randomColor());
    state.grid.push(row);
  }
  state.shot = null;
  state.currentColor = randomColor();
  state.nextColor = randomColor();
  state.score = 0;
  state.popping = [];
  state.falling = [];
  state.aim = -Math.PI / 2;
}

function start() {
  reset();
  state.mode = "playing";
  overlay.classList.add("hidden");
  $("score").textContent = "0";
  updateLeft();
}

function updateLeft() {
  let n = 0;
  for (const row of state.grid) for (const cell of row) if (cell !== null) n++;
  $("left").textContent = n;
  return n;
}

function end(won) {
  state.mode = won ? "won" : "dead";
  if (state.score > state.best) {
    state.best = state.score;
    $("best").textContent = state.best;
  }
  overlayTitle.textContent = won ? "BOARD CLEARED!" : "GAME OVER";
  overlaySub.textContent = `Score ${state.score} · Best ${state.best}.`;
  startBtn.textContent = "PLAY AGAIN";
  overlay.classList.remove("hidden");
}

// ---------- Grid helpers ----------
function neighbors(row, col) {
  // Hex neighbors; offset depends on row parity.
  const even = row % 2 === 0;
  const deltas = even
    ? [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
    : [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
  const out = [];
  for (const [dr, dc] of deltas) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < state.grid.length && c >= 0 && c < rowCols(r)) {
      out.push([r, c]);
    }
  }
  return out;
}

function floodSame(row, col) {
  const color = state.grid[row][col];
  if (color === null) return [];
  const seen = new Set([`${row},${col}`]);
  const stack = [[row, col]];
  const group = [];
  while (stack.length) {
    const [r, c] = stack.pop();
    group.push([r, c]);
    for (const [nr, nc] of neighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!seen.has(key) && state.grid[nr][nc] === color) {
        seen.add(key);
        stack.push([nr, nc]);
      }
    }
  }
  return group;
}

function dropFloating() {
  // Anything not connected to row 0 falls.
  const connected = new Set();
  const stack = [];
  for (let c = 0; c < rowCols(0); c++) {
    if (state.grid[0] && state.grid[0][c] !== null) {
      connected.add(`0,${c}`);
      stack.push([0, c]);
    }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [nr, nc] of neighbors(r, c)) {
      const key = `${nr},${nc}`;
      if (!connected.has(key) && state.grid[nr][nc] !== null) {
        connected.add(key);
        stack.push([nr, nc]);
      }
    }
  }
  let dropped = 0;
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < rowCols(r); c++) {
      if (state.grid[r][c] !== null && !connected.has(`${r},${c}`)) {
        const { x, y } = cellXY(r, c);
        state.falling.push({ x, y, vy: 1, color: state.grid[r][c] });
        state.grid[r][c] = null;
        dropped++;
      }
    }
  }
  return dropped;
}

function nearestColInRow(row, x) {
  let best = 0;
  let bestDist = Infinity;
  for (let c = 0; c < rowCols(row); c++) {
    const d = Math.abs(cellXY(row, c).x - x);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function snapShot() {
  // Find the nearest empty cell to the shot and stick it there.
  const shot = state.shot;
  let bestCell = null;
  let bestDist = Infinity;
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < rowCols(r); c++) {
      if (state.grid[r][c] !== null) continue;
      const { x, y } = cellXY(r, c);
      const d = Math.hypot(shot.x - x, shot.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestCell = [r, c];
      }
    }
  }

  // No empty cell — the shot reached the bottom of the grid; append a row.
  if (!bestCell) {
    const r = state.grid.length;
    state.grid.push(new Array(rowCols(r)).fill(null));
    bestCell = [r, nearestColInRow(r, shot.x)];
  }

  const [r, c] = bestCell;
  state.grid[r][c] = shot.color;

  // Match-3 pop.
  const group = floodSame(r, c);
  if (group.length >= 3) {
    for (const [gr, gc] of group) {
      const pos = cellXY(gr, gc);
      state.popping.push({ x: pos.x, y: pos.y, color: state.grid[gr][gc], t: 0 });
      state.grid[gr][gc] = null;
    }
    state.score += group.length * 10;
    const dropped = dropFloating();
    state.score += dropped * 20;
    $("score").textContent = state.score;
  }

  // Trim fully-empty rows off the bottom so the grid never bloats.
  while (state.grid.length && state.grid[state.grid.length - 1].every((cell) => cell === null)) {
    state.grid.pop();
  }

  state.shot = null;

  const left = updateLeft();
  if (left === 0) {
    end(true);
    return;
  }
  // Lose if any bubble crosses the danger line.
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < rowCols(r); c++) {
      if (state.grid[r][c] !== null && cellXY(r, c).y + R > DANGER_Y) {
        end(false);
        return;
      }
    }
  }
}

// ---------- Update ----------
function update() {
  if (state.mode !== "playing") return;

  if (state.shot) {
    const s = state.shot;
    s.x += s.vx;
    s.y += s.vy;
    // Wall bounce.
    if (s.x - R <= 0 || s.x + R >= W) {
      s.vx *= -1;
      s.x = Math.max(R, Math.min(W - R, s.x));
    }
    // Ceiling.
    if (s.y - R <= GRID_TOP - R) {
      snapShot();
    } else {
      // Hit an existing bubble.
      outer: for (let r = 0; r < state.grid.length; r++) {
        for (let c = 0; c < rowCols(r); c++) {
          if (state.grid[r][c] === null) continue;
          const { x, y } = cellXY(r, c);
          if (Math.hypot(s.x - x, s.y - y) < R * 1.9) {
            snapShot();
            break outer;
          }
        }
      }
    }
  }

  // Pop animations.
  for (const p of state.popping) p.t += 1;
  state.popping = state.popping.filter((p) => p.t < 12);
  // Falling bubbles.
  for (const f of state.falling) {
    f.vy += 0.5;
    f.y += f.vy;
  }
  state.falling = state.falling.filter((f) => f.y - R < H);
}

// ---------- Draw ----------
function drawBubble(x, y, colorIdx, scale = 1) {
  const color = COLORS[colorIdx];
  ctx.beginPath();
  ctx.arc(x, y, R * scale, 0, Math.PI * 2);
  ctx.fillStyle = color.fill;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color.dark;
  ctx.stroke();
  // Shine.
  ctx.beginPath();
  ctx.arc(x - R * 0.3 * scale, y - R * 0.3 * scale, R * 0.28 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fill();
}

function draw() {
  // Background.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b2340");
  bg.addColorStop(1, "#14161c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Danger line.
  ctx.strokeStyle = "rgba(245, 0, 87, 0.4)";
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, DANGER_Y);
  ctx.lineTo(W, DANGER_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Grid.
  for (let r = 0; r < state.grid.length; r++) {
    for (let c = 0; c < rowCols(r); c++) {
      if (state.grid[r][c] === null) continue;
      const { x, y } = cellXY(r, c);
      drawBubble(x, y, state.grid[r][c]);
    }
  }

  // Falling + popping.
  for (const f of state.falling) drawBubble(f.x, f.y, f.color);
  for (const p of state.popping) {
    drawBubble(p.x, p.y, p.color, 1 + p.t * 0.12);
  }

  if (state.mode === "playing") {
    // Aim guide.
    const ax = W / 2;
    const ay = SHOOT_Y;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + Math.cos(state.aim) * 70, ay + Math.sin(state.aim) * 70);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current + next bubble.
    drawBubble(ax, ay, state.currentColor);
    drawBubble(ax + 44, ay + 6, state.nextColor, 0.6);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NEXT", ax + 44, ay + 30);

    // In-flight shot.
    if (state.shot) drawBubble(state.shot.x, state.shot.y, state.shot.color);
  }
}

// ---------- Loop ----------
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ---------- Input ----------
function aimAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const angle = Math.atan2(y - SHOOT_Y, x - W / 2);
  // Clamp to upward cone.
  state.aim = Math.max(-Math.PI + 0.25, Math.min(-0.25, angle));
}

function fire() {
  if (state.mode !== "playing" || state.shot) return;
  state.shot = {
    x: W / 2,
    y: SHOOT_Y,
    vx: Math.cos(state.aim) * SHOT_SPEED,
    vy: Math.sin(state.aim) * SHOT_SPEED,
    color: state.currentColor,
  };
  state.currentColor = state.nextColor;
  state.nextColor = randomColor();
}

canvas.addEventListener("pointermove", (e) => aimAt(e.clientX, e.clientY));
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  aimAt(e.clientX, e.clientY);
  fire();
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && state.mode !== "playing") {
    e.preventDefault();
    start();
  }
});
startBtn.addEventListener("click", start);

reset();
requestAnimationFrame(loop);
