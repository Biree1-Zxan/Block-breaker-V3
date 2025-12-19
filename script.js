const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------- Constants ----------
const DEFAULT_PADDLE_W = 110;
const WIDE_PADDLE_W = 170;

const DEFAULT_BALL_SPEED = 5;
const SLOW_BALL_SPEED = 3.5;

// ---------- Game state ----------
const state = {
  score: 0,
  lives: 3,
  paused: false,
  started: false,
  gameOver: false,
};

// Paddle
const paddle = {
  w: DEFAULT_PADDLE_W,
  h: 14,
  x: (canvas.width - DEFAULT_PADDLE_W) / 2,
  y: canvas.height - 30,
  speed: 7,
  dx: 0,
};

// Balls (MULTIBALL: we store multiple balls here)
const balls = [];

// Bricks
const bricks = {
  rows: 7,
  cols: 8,
  w: 48,
  h: 18,
  pad: 10,
  top: 70,
  left: 22,
  grid: [],
};

// ---------- Power-ups ----------
const powerUps = []; // falling items
const POWERUP_TYPES = ["WIDE", "SLOW", "LIFE", "MULTI"];

const powerupState = {
  wideUntil: 0,
  slowUntil: 0,
};

function spawnPowerUp(x, y) {
  if (Math.random() > 0.25) return; // 25% chance
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerUps.push({ type, x, y, r: 10, vy: 2.4, alive: true });
}

// ---------- Setup / Reset ----------
function makeBall() {
  return {
    r: 7,
    x: canvas.width / 2,
    y: paddle.y - 7 - 1,
    vx: 0,
    vy: 0,
    speed: DEFAULT_BALL_SPEED,
    alive: true,
  };
}

function resetBallsToOne() {
  balls.length = 0;
  balls.push(makeBall());
}

function resetBallOnPaddle() {
  // Only the first ball sits on the paddle before launch
  const b = balls[0];
  b.x = paddle.x + paddle.w / 2;
  b.y = paddle.y - b.r - 1;
  b.vx = 0;
  b.vy = 0;
  b.speed = DEFAULT_BALL_SPEED;
  state.started = false;
}

function clearPowerUpsAndEffects() {
  powerUps.length = 0;
  powerupState.wideUntil = 0;
  powerupState.slowUntil = 0;

  paddle.w = DEFAULT_PADDLE_W;
  paddle.x = clamp(paddle.x, 0, canvas.width - paddle.w);

  // Restore ball speeds (all balls)
  for (const b of balls) setBallSpeedForBall(b, DEFAULT_BALL_SPEED);
}

function resetBricks() {
  bricks.grid = [];
  for (let r = 0; r < bricks.rows; r++) {
    bricks.grid[r] = [];
    for (let c = 0; c < bricks.cols; c++) bricks.grid[r][c] = { alive: true };
  }
}

function fullReset() {
  state.score = 0;
  state.lives = 3;
  state.paused = false;
  state.started = false;
  state.gameOver = false;

  paddle.w = DEFAULT_PADDLE_W;
  paddle.x = (canvas.width - paddle.w) / 2;
  paddle.dx = 0;

  resetBricks();
  resetBallsToOne();
  clearPowerUpsAndEffects();
  resetBallOnPaddle();
}

resetBricks();
resetBallsToOne();
resetBallOnPaddle();

// ---------- Input ----------
const keys = new Set();

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);

  if (k === " " || e.code === "Space") {
    if (state.gameOver) return;
    if (!state.started) launchBalls();
    else state.paused = !state.paused;
    e.preventDefault();
  }

  if (k === "r") fullReset();
});

window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

function launchBalls() {
  state.started = true;

  // Launch the first ball if it's not moving
  const b = balls[0];
  if (Math.hypot(b.vx, b.vy) < 1e-6) {
    const angle = (Math.random() * 0.9 + 0.15) * Math.PI;
    b.vx = Math.cos(angle) * b.speed;
    b.vy = -Math.abs(Math.sin(angle) * b.speed);
  }
}

// ---------- Helpers ----------
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

function remainingBricks() {
  let count = 0;
  for (let r = 0; r < bricks.rows; r++) {
    for (let c = 0; c < bricks.cols; c++) if (bricks.grid[r][c].alive) count++;
  }
  return count;
}

function setBallSpeedForBall(b, newSpeed) {
  const mag = Math.hypot(b.vx, b.vy);
  if (mag < 1e-6) {
    b.speed = newSpeed;
    return;
  }
  const scale = newSpeed / mag;
  b.vx *= scale;
  b.vy *= scale;
  b.speed = newSpeed;
}

function applyPowerUp(type) {
  const now = Date.now();

  if (type === "WIDE") {
    paddle.w = WIDE_PADDLE_W;
    paddle.x = clamp(paddle.x, 0, canvas.width - paddle.w);
    powerupState.wideUntil = now + 9000;
  } else if (type === "SLOW") {
    for (const b of balls) setBallSpeedForBall(b, SLOW_BALL_SPEED);
    powerupState.slowUntil = now + 7000;
  } else if (type === "LIFE") {
    state.lives = Math.min(state.lives + 1, 9);
  } else if (type === "MULTI") {
    // Duplicate 2 extra balls based on an existing ball (use first ball as reference)
    const ref = balls[0];
    if (!ref) return;

    for (let i = 0; i < 2; i++) {
      const nb = makeBall();
      nb.x = ref.x;
      nb.y = ref.y;
      nb.speed = ref.speed;

      // Slightly different angles so they spread out
      const baseAngle = Math.atan2(ref.vy, ref.vx);
      const offset = (i === 0 ? -0.35 : 0.35); // radians
      const angle = baseAngle + offset;

      nb.vx = Math.cos(angle) * nb.speed;
      nb.vy = Math.sin(angle) * nb.speed;

      // Ensure they go upward-ish if reference is weird
      if (nb.vy > 0) nb.vy *= -1;

      balls.push(nb);
    }
  }
}

// ---------- Update ----------
function update() {
  // Paddle movement
  const left = keys.has("arrowleft") || keys.has("a");
  const right = keys.has("arrowright") || keys.has("d");
  paddle.dx = (right ? 1 : 0) - (left ? 1 : 0);

  paddle.x += paddle.dx * paddle.speed;
  paddle.x = clamp(paddle.x, 0, canvas.width - paddle.w);

  // If not started, keep 1 ball on paddle
  if (!state.started) {
    resetBallOnPaddle();
    return;
  }

  // Move balls + collisions
  for (const b of balls) {
    if (!b.alive) continue;

    b.x += b.vx;
    b.y += b.vy;

    // Walls
    if (b.x - b.r <= 0) {
      b.x = b.r;
      b.vx *= -1;
    }
    if (b.x + b.r >= canvas.width) {
      b.x = canvas.width - b.r;
      b.vx *= -1;
    }
    if (b.y - b.r <= 0) {
      b.y = b.r;
      b.vy *= -1;
    }

    // Bottom => this ball dies
    if (b.y - b.r > canvas.height) {
      b.alive = false;
      continue;
    }

    // Paddle collision
    if (
      b.vy > 0 &&
      circleRectCollision(b.x, b.y, b.r, paddle.x, paddle.y, paddle.w, paddle.h)
    ) {
      b.y = paddle.y - b.r - 1;
      b.vy = -Math.abs(b.vy);

      const hitPos = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // [-1..1]
      b.vx = hitPos * b.speed * 1.1;

      const maxVX = b.speed * 1.4;
      b.vx = clamp(b.vx, -maxVX, maxVX);
    }

    // Brick collision (only 1 brick hit per ball per frame)
    let hitBrickThisBall = false;

    for (let r = 0; r < bricks.rows && !hitBrickThisBall; r++) {
      for (let c = 0; c < bricks.cols && !hitBrickThisBall; c++) {
        const brick = bricks.grid[r][c];
        if (!brick.alive) continue;

        const bx = bricks.left + c * (bricks.w + bricks.pad);
        const by = bricks.top + r * (bricks.h + bricks.pad);

        if (circleRectCollision(b.x, b.y, b.r, bx, by, bricks.w, bricks.h)) {
          brick.alive = false;
          state.score += 10;

          spawnPowerUp(bx + bricks.w / 2, by + bricks.h / 2);

          b.vy *= -1;
          hitBrickThisBall = true;
        }
      }
    }
  }

  // Remove dead balls
  for (let i = balls.length - 1; i >= 0; i--) {
    if (!balls[i].alive) balls.splice(i, 1);
  }

  // If all balls are gone, lose a life
  if (balls.length === 0) {
    state.lives--;
    if (state.lives <= 0) {
      state.gameOver = true;
      state.paused = true;
      return;
    }

    // Reset to one ball + clear effects
    resetBallsToOne();
    clearPowerUpsAndEffects();
    resetBallOnPaddle();
    return;
  }

  // Win check
  if (remainingBricks() === 0) {
    state.gameOver = true;
    state.paused = true;
  }

  // Power-ups falling + pickup
  for (const p of powerUps) {
    if (!p.alive) continue;
    p.y += p.vy;

    if (circleRectCollision(p.x, p.y, p.r, paddle.x, paddle.y, paddle.w, paddle.h)) {
      p.alive = false;
      applyPowerUp(p.type);
    }

    if (p.y - p.r > canvas.height) p.alive = false;
  }

  // Remove dead power-ups
  for (let i = powerUps.length - 1; i >= 0; i--) {
    if (!powerUps[i].alive) powerUps.splice(i, 1);
  }

  // Expire timed effects
  const now = Date.now();

  if (powerupState.wideUntil && now > powerupState.wideUntil) {
    paddle.w = DEFAULT_PADDLE_W;
    paddle.x = clamp(paddle.x, 0, canvas.width - paddle.w);
    powerupState.wideUntil = 0;
  }

  if (powerupState.slowUntil && now > powerupState.slowUntil) {
    for (const b of balls) setBallSpeedForBall(b, DEFAULT_BALL_SPEED);
    powerupState.slowUntil = 0;
  }
}

// ---------- Draw ----------
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bricks
  for (let r = 0; r < bricks.rows; r++) {
    for (let c = 0; c < bricks.cols; c++) {
      const b = bricks.grid[r][c];
      if (!b.alive) continue;

      const x = bricks.left + c * (bricks.w + bricks.pad);
      const y = bricks.top + r * (bricks.h + bricks.pad);

      const shade = 210 + r * 5;
      ctx.fillStyle = `hsl(${shade}, 70%, 55%)`;
      roundRect(x, y, bricks.w, bricks.h, 6, true);
    }
  }

  // Power-ups
  for (const p of powerUps) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);

    if (p.type === "WIDE") ctx.fillStyle = "#5cf2a6";
    else if (p.type === "SLOW") ctx.fillStyle = "#5cc7ff";
    else if (p.type === "LIFE") ctx.fillStyle = "#ff6b6b";
    else if (p.type === "MULTI") ctx.fillStyle = "#ffd166";
    else ctx.fillStyle = "#ffffff";

    ctx.fill();

    ctx.fillStyle = "#071024";
    ctx.font = "700 12px system-ui, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.type[0], p.x, p.y); // W / S / L / M
  }
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";

  // Paddle
  ctx.fillStyle = "#dbe7ff";
  roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 8, true);

  // Balls
  for (const b of balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }

  // HUD
  ctx.fillStyle = "rgba(219,231,255,0.9)";
  ctx.font = "14px system-ui, Arial";
  ctx.fillText(`Score: ${state.score}`, 14, 24);
  ctx.fillText(`Lives: ${state.lives}`, canvas.width - 80, 24);

  // Overlay text
  if (!state.started && !state.gameOver) centerText("Press SPACE to launch", canvas.height * 0.55);
  if (state.paused && state.started && !state.gameOver) centerText("Paused (SPACE to resume)", canvas.height * 0.55);
  if (state.gameOver) {
    const msg = remainingBricks() === 0 ? "You Win!" : "Game Over";
    centerText(`${msg}  (R to restart)`, canvas.height * 0.55);
  }
}

function centerText(text, y) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "600 18px system-ui, Arial";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, y);
  ctx.restore();
}

function roundRect(x, y, w, h, r, fill) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
}

// ---------- Loop ----------
function loop() {
  if (!state.paused) update();
  draw();
  requestAnimationFrame(loop);
}
loop();
