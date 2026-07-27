document.addEventListener("DOMContentLoaded", () => {
  // ---- Jahr im Footer ----
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---- Hamburger-Nav ----
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const navMenu = document.getElementById("nav-menu");
  const navBackdrop = document.getElementById("nav-backdrop");
  function toggleNav() {
    const isOpen = navMenu.classList.toggle("is-open");
    hamburgerBtn.classList.toggle("is-open", isOpen);
    navBackdrop.classList.toggle("is-open", isOpen);
    hamburgerBtn.setAttribute("aria-expanded", String(isOpen));
    document.body.style.overflow = isOpen ? "hidden" : "";
  }
  function closeNav() {
    navMenu.classList.remove("is-open");
    hamburgerBtn.classList.remove("is-open");
    navBackdrop.classList.remove("is-open");
    hamburgerBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  if (hamburgerBtn) hamburgerBtn.addEventListener("click", toggleNav);
  if (navBackdrop) navBackdrop.addEventListener("click", closeNav);
  if (navMenu) {
    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        if (navMenu.classList.contains("is-open")) closeNav();
      });
    });
  }

  // ============================================================
  //  Elemente
  // ============================================================
  const setupScreen = document.getElementById("plinko-setup");
  const gameScreen = document.getElementById("plinko-game");
  const resultsScreen = document.getElementById("plinko-results");

  const playersWrap = document.getElementById("plinko-players");
  const addPlayerBtn = document.getElementById("plinko-add-player");
  const startBtn = document.getElementById("plinko-start");
  const setupError = document.getElementById("plinko-setup-error");
  const betToggle = document.getElementById("plinko-bet-toggle");

  const currentPlayerEl = document.getElementById("plinko-current-player");
  const progressEl = document.getElementById("plinko-progress");
  const dropBtn = document.getElementById("plinko-drop");
  const legendEl = document.getElementById("plinko-legend");

  const tipBar = document.getElementById("plinko-tip");
  const tipNameEl = document.getElementById("plinko-tip-name");
  const tipChipsEl = document.getElementById("plinko-tip-chips");

  const celebration = document.getElementById("plinko-celebration");
  const celPlayerEl = document.getElementById("celebration-player");
  const celShotEl = document.getElementById("celebration-shot");
  const celTagsEl = document.getElementById("celebration-tags");
  const celDescEl = document.getElementById("celebration-desc");
  const nextBtn = document.getElementById("plinko-next");
  const confettiCanvas = document.getElementById("plinko-confetti");

  const resultsList = document.getElementById("plinko-results-list");
  const restartBtn = document.getElementById("plinko-restart");
  const shareBtn = document.getElementById("plinko-share");
  const saveBtn = document.getElementById("plinko-save");
  const sharePreview = document.getElementById("plinko-share-preview");
  const shareImg = document.getElementById("plinko-share-img");
  const shareDownload = document.getElementById("plinko-share-download");
  const shareClose = document.getElementById("plinko-share-close");

  const canvas = document.getElementById("plinko-canvas");
  const ctx = canvas.getContext("2d");

  const MAX_PLAYERS = 10;
  const GAME_URL = "lukabpunkt.github.io/Cafebarstone/plinko.html";
  const reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

  const PALETTE = [
    "#c99b4b", "#e0b46e", "#b5813a", "#d98c5f",
    "#8f9b57", "#6f9bb5", "#b56f8f", "#7f6fb5",
    "#5fae8c", "#cf6d6d", "#c9b44b", "#9b7bd1",
  ];

  // Stone-Logo für Board-Wasserzeichen + Story-Karte
  let logoImg = null, logoReady = false;
  (function () {
    const im = new Image();
    im.onload = () => { logoImg = im; logoReady = true; };
    im.src = "assets/Stonelogo.png";
  })();

  // ============================================================
  //  State
  // ============================================================
  let shots = [];        // [{name, description, color, weight, effect}]
  let players = [];      // [{name, shotIndex}]
  let currentIndex = 0;
  let animating = false;
  let celebrationVisible = false;
  let betMode = false;
  let predictedSlot = null;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function shotColor(i) {
    const s = shots[i];
    if (s && s.color && /^#?[0-9a-fA-F]{3,8}$/.test(s.color)) {
      return s.color[0] === "#" ? s.color : "#" + s.color;
    }
    return PALETTE[i % PALETTE.length];
  }
  const isDouble = (i) => shots[i] && shots[i].effect === "double";

  function readToken(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  const COL_ACCENT = readToken("--color-accent", "#c99b4b");
  const COL_TEXT = readToken("--color-text", "#f7f3ea");
  const COL_TEXT_SOFT = readToken("--color-text-soft", "#c1bccf");

  function showScreen(screen) {
    [setupScreen, gameScreen, resultsScreen].forEach((s) => {
      if (s) s.classList.toggle("is-hidden", s !== screen);
    });
  }

  function hexToRgba(hex, alpha) {
    let h = String(hex).replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const num = parseInt(h.slice(0, 6), 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function vibrate(pattern) {
    if (reducedMotion || !canVibrate) return;
    try { navigator.vibrate(pattern); } catch (_) {}
  }

  // ============================================================
  //  Setup: Spielernamen
  // ============================================================
  function addPlayerRow(value) {
    if (!playersWrap) return;
    const rows = playersWrap.querySelectorAll(".plinko-player-row");
    if (rows.length >= MAX_PLAYERS) return;

    const row = document.createElement("div");
    row.className = "plinko-player-row";
    const idx = document.createElement("span");
    idx.className = "plinko-player-index";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 24;
    input.placeholder = "Name";
    input.value = value || "";
    input.autocomplete = "off";
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addPlayerRow("");
        const inputs = playersWrap.querySelectorAll("input");
        const last = inputs[inputs.length - 1];
        if (last) last.focus();
      }
    });
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "plinko-remove-btn";
    removeBtn.setAttribute("aria-label", "Spieler entfernen");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => { row.remove(); renumberPlayerRows(); });
    row.append(idx, input, removeBtn);
    playersWrap.appendChild(row);
    renumberPlayerRows();
  }

  function renumberPlayerRows() {
    if (!playersWrap) return;
    const rows = playersWrap.querySelectorAll(".plinko-player-row");
    rows.forEach((row, i) => {
      const idx = row.querySelector(".plinko-player-index");
      if (idx) idx.textContent = String(i + 1);
      const removeBtn = row.querySelector(".plinko-remove-btn");
      if (removeBtn) removeBtn.style.visibility = rows.length > 1 ? "visible" : "hidden";
    });
    if (addPlayerBtn) addPlayerBtn.disabled = rows.length >= MAX_PLAYERS;
  }

  function collectPlayerNames() {
    if (!playersWrap) return [];
    return [...playersWrap.querySelectorAll("input")]
      .map((el, i) => { const v = el.value.trim(); return v || `Spieler ${i + 1}`; });
  }

  // ============================================================
  //  Canvas-Geometrie & Board (gewichtete Slots)
  // ============================================================
  const TOP_PAD = 46;
  const SLOT_H = 58;
  let W = 460, H = 620;
  let BOARD = null;

  function fitCanvas() {
    const wrap = canvas.parentElement;
    const cssW = Math.max(240, Math.round(wrap.clientWidth));
    const availH = window.innerHeight || 700;
    let cssH = Math.round(Math.min(cssW * 1.34, availH * 0.6));
    cssH = Math.max(cssH, Math.round(cssW * 1.08));
    const dpr = window.devicePixelRatio || 1;
    W = cssW; H = cssH;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBoard();
  }

  function buildBoard() {
    const P = Math.max(12, W * 0.05);
    const n = Math.max(1, shots.length);
    const fieldW = W - 2 * P;
    const slotTop = H - SLOT_H;

    // Gewichtete Slot-Breiten
    const weights = shots.map((s) => (s.weight && s.weight > 0 ? Number(s.weight) : 1));
    while (weights.length < n) weights.push(1);
    let widths = normalizeWidths(weights, fieldW, n);

    // kumulative Grenzen
    const bounds = [P];
    for (let i = 0; i < n; i++) bounds.push(bounds[i] + widths[i]);
    bounds[n] = W - P;

    const minActual = Math.min(...widths);
    const ballR = clamp(Math.min(W * 0.028, minActual * 0.36), 5, 22);
    const pegR = Math.max(3, W * 0.0095);

    // Dichtes, versetztes Pin-Raster
    const pegSpacingX = Math.max(ballR * 3.8, fieldW / 8);
    const cols = Math.max(2, Math.floor(fieldW / pegSpacingX));
    const actualSpacing = fieldW / cols;
    const rowSpacingY = Math.max(ballR * 3.0, actualSpacing * 0.82);
    const topY = TOP_PAD + rowSpacingY * 0.7;
    const usableH = slotTop - topY - rowSpacingY * 0.5;
    let R = clamp(Math.floor(usableH / rowSpacingY), 7, 14);

    const pegs = [];
    for (let r = 0; r < R; r++) {
      const y = topY + r * rowSpacingY;
      if (r % 2 === 0) {
        for (let c = 0; c <= cols; c++) pegs.push({ x: P + c * actualSpacing, y, flash: 0 });
      } else {
        for (let c = 0; c < cols; c++) pegs.push({ x: P + (c + 0.5) * actualSpacing, y, flash: 0 });
      }
    }

    BOARD = { P, n, slotTop, bounds, widths, ballR, pegR, pegs, floorY: H - 8 - ballR };
  }

  // Verteilt fieldW nach Gewichten, erzwingt aber Mindestbreite je Slot
  function normalizeWidths(weights, fieldW, n) {
    const ballRguess = clamp(fieldW / n * 0.5, 6.5, 40);
    let minSlot = Math.max(ballRguess * 1.6, fieldW * 0.055);
    if (n * minSlot > fieldW) minSlot = fieldW / n; // physisch unmöglich -> uniform
    const total = weights.reduce((a, b) => a + b, 0) || n;
    let widths = weights.map((w) => fieldW * (w / total));
    for (let iter = 0; iter < 24; iter++) {
      const fixed = widths.map((w) => w < minSlot - 0.01);
      if (!fixed.some(Boolean)) break;
      const fixedCount = fixed.filter(Boolean).length;
      const remain = fieldW - fixedCount * minSlot;
      const othW = weights.reduce((a, w, i) => (fixed[i] ? a : a + w), 0) || 1;
      widths = weights.map((w, i) => (fixed[i] ? minSlot : Math.max(minSlot, remain * (w / othW))));
    }
    // Rundungs-Korrektur auf exakt fieldW
    const sum = widths.reduce((a, b) => a + b, 0);
    const k = fieldW / sum;
    return widths.map((w) => w * k);
  }

  function slotIndexAtX(x) {
    const b = BOARD.bounds;
    const xc = clamp(x, b[0], b[BOARD.n]);
    for (let i = 0; i < BOARD.n; i++) if (xc < b[i + 1]) return i;
    return BOARD.n - 1;
  }
  function slotCenterX(i) { return (BOARD.bounds[i] + BOARD.bounds[i + 1]) / 2; }

  // ============================================================
  //  Zeichnen
  // ============================================================
  function drawBoard(ball, highlightSlot, nearSlot, nearIntensity) {
    if (!BOARD) return;
    ctx.clearRect(0, 0, W, H);
    const { P, n, slotTop, bounds, ballR, pegR, pegs } = BOARD;

    // Logo-Wasserzeichen (Branding)
    if (logoReady) {
      const lw = W * 0.52;
      const lh = lw * (logoImg.height / logoImg.width);
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.drawImage(logoImg, (W - lw) / 2, (slotTop - lh) / 2 + 10, lw, lh);
      ctx.restore();
    }

    // Slots
    for (let i = 0; i < n; i++) {
      const x = bounds[i], w = bounds[i + 1] - bounds[i];
      const col = shotColor(i);
      let intensity = 0.16;
      if (i === highlightSlot) intensity = 0.5;
      else if (i === nearSlot) intensity = 0.16 + 0.3 * (nearIntensity || 0);
      ctx.fillStyle = hexToRgba(col, intensity);
      ctx.fillRect(x, slotTop, w, SLOT_H);
      ctx.fillStyle = hexToRgba(col, i === highlightSlot ? 1 : 0.85);
      ctx.fillRect(x + 2, H - 6, w - 4, 4);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, slotTop); ctx.lineTo(x, H); ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = i === highlightSlot ? COL_TEXT : COL_TEXT_SOFT;
      if (isDouble(i)) {
        ctx.font = "600 12px -apple-system, system-ui, sans-serif";
        ctx.fillText(String(i + 1), x + w / 2, slotTop + SLOT_H / 2 - 8);
        ctx.font = "700 12px -apple-system, system-ui, sans-serif";
        ctx.fillStyle = hexToRgba(col, 1);
        ctx.fillText("×2", x + w / 2, slotTop + SLOT_H / 2 + 9);
      } else {
        ctx.font = "600 13px -apple-system, system-ui, sans-serif";
        ctx.fillText(String(i + 1), x + w / 2, slotTop + SLOT_H / 2);
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath(); ctx.moveTo(P, slotTop); ctx.lineTo(W - P, slotTop); ctx.stroke();

    // Pegs
    for (const p of pegs) {
      const f = p.flash > 0 ? p.flash / 6 : 0;
      if (p.flash > 0) p.flash--;
      const rr = pegR + f * 2.2;
      if (f > 0) {
        ctx.beginPath(); ctx.arc(p.x, p.y, rr + 3, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba("#ffe9c2", 0.25 * f); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fillStyle = f > 0 ? hexToRgba("#ffe9c2", 0.9) : hexToRgba(COL_ACCENT, 0.55);
      ctx.fill();
    }

    // Ball
    if (ball) {
      if (ball.trail && ball.trail.length) {
        for (let t = 0; t < ball.trail.length; t++) {
          const tp = ball.trail[t];
          const a = ((t + 1) / ball.trail.length) * 0.35;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, ballR * (0.5 + 0.5 * (t + 1) / ball.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(COL_ACCENT, a); ctx.fill();
        }
      }
      const speed = Math.hypot(ball.vx || 0, ball.vy || 0);
      const squash = clamp(1 + (ball.hit || 0) * 0.05, 1, 1.35);
      const ang = Math.atan2(ball.vy || 0, ball.vx || 0);
      if (ball.hit > 0) ball.hit--;
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ang);
      ctx.scale(squash, 1 / squash);
      const grad = ctx.createRadialGradient(-ballR * 0.3, -ballR * 0.3, ballR * 0.2, 0, 0, ballR);
      grad.addColorStop(0, "#fff4de");
      grad.addColorStop(1, COL_ACCENT);
      ctx.beginPath(); ctx.arc(0, 0, ballR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(201,155,75,0.7)";
      ctx.shadowBlur = 14 + Math.min(10, speed);
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }

  // ============================================================
  //  Physik-Simulation
  // ============================================================
  function dropBall(onDone) {
    const { P, n, slotTop, bounds, ballR, pegR, pegs, floorY } = BOARD;
    const gravity = 0.13, restitution = 0.66, wallRest = 0.5, jitterAmt = 1.3;
    const maxV = ballR * 0.62, SUB = 3;
    const SPEED = 0.5; // globaler Tempo-Regler (kleiner = langsamer)

    const ball = {
      x: W / 2 + (Math.random() - 0.5) * (bounds[n] - bounds[0]) * 0.12,
      y: TOP_PAD - 6,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 0.6, trail: [], hit: 0,
    };
    let stable = 0, frames = 0, lastTick = 0;

    function hapticTick() {
      if (reducedMotion || !canVibrate) return;
      if (frames - lastTick > 3) { try { navigator.vibrate(5); } catch (_) {} lastTick = frames; }
    }
    function collidePegs() {
      for (const p of pegs) {
        const dx = ball.x - p.x, dy = ball.y - p.y, minD = ballR + pegR;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD * minD) {
          const d = Math.sqrt(d2) || 0.0001, nx = dx / d, ny = dy / d;
          ball.x = p.x + nx * minD; ball.y = p.y + ny * minD;
          const vdot = ball.vx * nx + ball.vy * ny;
          ball.vx -= (1 + restitution) * vdot * nx;
          ball.vy -= (1 + restitution) * vdot * ny;
          const jitter = (Math.random() - 0.5) * jitterAmt;
          ball.vx += -ny * jitter; ball.vy += nx * jitter;
          p.flash = 6; ball.hit = 6; hapticTick();
        }
      }
    }
    function substep() {
      ball.vy += gravity / SUB;
      ball.vx *= 0.999;
      ball.vx = clamp(ball.vx, -maxV, maxV);
      ball.vy = clamp(ball.vy, -maxV, maxV);
      ball.x += ball.vx * SPEED; ball.y += ball.vy * SPEED;
      if (ball.x < P + ballR) { ball.x = P + ballR; ball.vx = Math.abs(ball.vx) * wallRest; }
      if (ball.x > W - P - ballR) { ball.x = W - P - ballR; ball.vx = -Math.abs(ball.vx) * wallRest; }
      collidePegs();
      if (ball.y > slotTop - ballR) {
        const col = slotIndexAtX(ball.x);
        const leftX = bounds[col] + ballR, rightX = bounds[col + 1] - ballR;
        if (ball.x < leftX) { ball.x = leftX; ball.vx = Math.abs(ball.vx) * 0.4; }
        if (ball.x > rightX) { ball.x = rightX; ball.vx = -Math.abs(ball.vx) * 0.4; }
        if (ball.y > floorY) { ball.y = floorY; ball.vy = -Math.abs(ball.vy) * 0.34; ball.vx *= 0.6; }
      }
    }
    function frame() {
      frames++;
      for (let s = 0; s < SUB; s++) substep();
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > (reducedMotion ? 0 : 8)) ball.trail.shift();

      let nearSlot = -1, nearIntensity = 0;
      const slotW0 = bounds[1] - bounds[0];
      if (ball.y > slotTop - slotW0) {
        nearSlot = slotIndexAtX(ball.x);
        nearIntensity = clamp((ball.y - (slotTop - slotW0)) / slotW0, 0, 1);
      }
      drawBoard(ball, -1, nearSlot, nearIntensity);

      const slow = Math.abs(ball.vx) < 0.5 && Math.abs(ball.vy) < 0.9;
      if (ball.y > slotTop && slow) stable++; else stable = 0;

      if (stable > 9 || frames > 60 * 15) {
        const result = slotIndexAtX(ball.x);
        if (!reducedMotion) {
          canvas.classList.remove("is-shaking"); void canvas.offsetWidth;
          canvas.classList.add("is-shaking");
        }
        drawBoard(ball, result, -1, 0);
        onDone(result);
      } else {
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  //  Konfetti
  // ============================================================
  let confettiRAF = null;
  function startConfetti(color, boost) {
    if (!confettiCanvas) return;
    const cx = confettiCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    confettiCanvas.width = Math.round(w * dpr);
    confettiCanvas.height = Math.round(h * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = [color, "#e0b46e", "#c99b4b", "#ffffff", "#ffe9c2"];
    const N = Math.round((reducedMotion ? 36 : 150) * (boost || 1));
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.35,
        y: h * 0.42 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 11, vy: -7 - Math.random() * 10,
        g: 0.22 + Math.random() * 0.14, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 7, h: 9 + Math.random() * 10,
        col: cols[i % cols.length], life: 0, ttl: 90 + Math.random() * 70,
      });
    }
    cancelAnimationFrame(confettiRAF);
    function loop() {
      cx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of parts) {
        if (p.life > p.ttl) continue;
        alive = true;
        p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
        const fade = p.life > p.ttl - 25 ? Math.max(0, (p.ttl - p.life) / 25) : 1;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.globalAlpha = fade;
        cx.fillStyle = p.col; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      }
      if (alive && celebrationVisible) confettiRAF = requestAnimationFrame(loop);
      else cx.clearRect(0, 0, w, h);
    }
    loop();
  }
  function stopConfetti() {
    cancelAnimationFrame(confettiRAF);
    if (!confettiCanvas) return;
    const cx = confettiCanvas.getContext("2d");
    cx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }

  // ============================================================
  //  Legende + Tipp-Chips (Wette)
  // ============================================================
  function renderLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = "";
    shots.forEach((s, i) => {
      const item = document.createElement("span");
      item.className = "plinko-legend-item";
      const sw = document.createElement("span");
      sw.className = "plinko-legend-swatch";
      sw.style.background = shotColor(i);
      const label = document.createElement("span");
      label.textContent = `${i + 1}. ${s.name}${isDouble(i) ? " ×2" : ""}`;
      item.append(sw, label);
      legendEl.appendChild(item);
    });
  }

  function renderTipChips() {
    if (!tipChipsEl) return;
    tipChipsEl.innerHTML = "";
    shots.forEach((s, i) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "plinko-tip-chip";
      chip.dataset.idx = String(i);
      const sw = document.createElement("span");
      sw.className = "plinko-legend-swatch";
      sw.style.background = shotColor(i);
      const label = document.createElement("span");
      label.textContent = s.name + (isDouble(i) ? " ×2" : "");
      chip.append(sw, label);
      chip.addEventListener("click", () => {
        predictedSlot = i;
        tipChipsEl.querySelectorAll(".plinko-tip-chip").forEach((c) => c.classList.remove("is-selected"));
        chip.classList.add("is-selected");
        if (dropBtn) dropBtn.disabled = false;
        vibrate(8);
      });
      tipChipsEl.appendChild(chip);
    });
  }

  // ============================================================
  //  Turn-Flow
  // ============================================================
  function startGame() {
    if (!setupError) return;
    setupError.textContent = "";
    if (shots.length === 0) {
      setupError.textContent = "Aktuell sind keine Shots konfiguriert. Bitte sprich das Bar-Team an.";
      return;
    }
    const names = collectPlayerNames();
    if (names.length === 0) { setupError.textContent = "Bitte mindestens einen Spieler eintragen."; return; }

    betMode = !!(betToggle && betToggle.checked);
    players = names.map((name) => ({ name, shotIndex: null, betCorrect: false }));
    currentIndex = 0;

    showScreen(gameScreen);
    fitCanvas();
    renderLegend();
    beginTurn();
  }

  function beginTurn() {
    animating = false;
    hideCelebration();
    predictedSlot = null;

    if (tipBar) {
      if (betMode) {
        tipBar.classList.remove("is-hidden");
        if (tipNameEl) tipNameEl.textContent = players[currentIndex].name;
        renderTipChips();
      } else {
        tipBar.classList.add("is-hidden");
      }
    }
    if (dropBtn) {
      dropBtn.style.display = "";
      dropBtn.disabled = betMode; // im Wett-Modus erst nach Tipp
    }
    const player = players[currentIndex];
    if (currentPlayerEl) {
      currentPlayerEl.textContent = player.name;
      currentPlayerEl.classList.add("is-pulsing");
    }
    if (progressEl) progressEl.textContent = `Spieler ${currentIndex + 1} von ${players.length}`;
    fitCanvas();
    drawBoard(null, -1, -1, 0);
  }

  function onDrop() {
    if (animating) return;
    if (betMode && predictedSlot === null) return;
    animating = true;
    if (dropBtn) dropBtn.disabled = true;
    if (tipBar) tipBar.classList.add("is-hidden");
    if (currentPlayerEl) currentPlayerEl.classList.remove("is-pulsing");
    vibrate(12);
    dropBall((slot) => {
      players[currentIndex].shotIndex = slot;
      players[currentIndex].betCorrect = betMode && predictedSlot === slot;
      setTimeout(() => showCelebration(slot), 260);
    });
  }

  function showCelebration(slot) {
    const shot = shots[slot];
    const color = shotColor(slot);
    const dbl = isDouble(slot);
    const betWon = players[currentIndex].betCorrect;

    if (celebration) celebration.style.setProperty("--cel-color", color);
    if (celPlayerEl) celPlayerEl.textContent = players[currentIndex].name;
    if (celShotEl) celShotEl.textContent = dbl ? `${shot.name} ×2` : shot.name;
    if (celDescEl) {
      celDescEl.textContent = shot.description || "";
      celDescEl.style.display = shot.description ? "" : "none";
    }
    if (celTagsEl) {
      celTagsEl.innerHTML = "";
      if (dbl) {
        const t = document.createElement("span");
        t.className = "plinko-cel-tag is-double";
        t.textContent = "🥃 DOPPELTER SHOT!";
        celTagsEl.appendChild(t);
      }
      if (betWon) {
        const t = document.createElement("span");
        t.className = "plinko-cel-tag is-bet";
        const others = players.filter((_, i) => i !== currentIndex);
        if (others.length > 0) {
          const payer = others[Math.floor(Math.random() * others.length)];
          const b = document.createElement("b");
          b.textContent = payer.name;
          t.append("🎯 Richtig getippt! ", b, " gibt dir aus! 🍻");
        } else {
          t.textContent = "🎯 Richtig getippt – die Runde geht aufs Haus! 🍻";
        }
        celTagsEl.appendChild(t);
      }
    }
    if (nextBtn) {
      nextBtn.textContent = currentIndex >= players.length - 1 ? "Ergebnis anzeigen 🎊" : "Nächster Spieler →";
    }
    celebrationVisible = true;
    if (celebration) {
      celebration.classList.remove("is-hidden");
      celebration.setAttribute("aria-hidden", "false");
    }
    vibrate(dbl || betWon ? [0, 70, 40, 70, 40, 90, 40, 180] : [0, 55, 45, 90, 45, 160]);
    startConfetti(color, dbl || betWon ? 1.8 : 1);
    animating = false;
  }

  function hideCelebration() {
    celebrationVisible = false;
    stopConfetti();
    if (celebration) {
      celebration.classList.add("is-hidden");
      celebration.setAttribute("aria-hidden", "true");
    }
  }

  function onNext() {
    hideCelebration();
    if (currentIndex >= players.length - 1) showResults();
    else { currentIndex++; beginTurn(); }
  }

  function resultLabel(p) {
    const shot = shots[p.shotIndex];
    if (!shot) return "—";
    return isDouble(p.shotIndex) ? `${shot.name} ×2` : shot.name;
  }

  function showResults() {
    if (resultsList) {
      resultsList.innerHTML = "";
      players.forEach((p, idx) => {
        const li = document.createElement("li");
        li.style.animationDelay = (idx * 0.06) + "s";
        const nameEl = document.createElement("span");
        nameEl.className = "plinko-result-player";
        nameEl.textContent = p.name;
        const shotEl = document.createElement("span");
        shotEl.className = "plinko-result-shot";
        const sw = document.createElement("span");
        sw.className = "plinko-legend-swatch";
        sw.style.background = shotColor(p.shotIndex);
        const shotName = document.createElement("span");
        shotName.textContent = resultLabel(p);
        shotEl.append(sw, shotName);
        li.append(nameEl, shotEl);
        resultsList.appendChild(li);
      });
    }
    showScreen(resultsScreen);
    vibrate([0, 40, 30, 40, 30, 80]);
  }

  function restart() {
    hideCelebration();
    hideSharePreview();
    players = [];
    currentIndex = 0;
    showScreen(setupScreen);
    if (setupError) setupError.textContent = "";
  }

  // ============================================================
  //  Teilbare Story-Karte (1080×1920)
  // ============================================================
  function renderShareCard() {
    const CW = 1080, CH = 1920, MX = 108;
    const cv = document.createElement("canvas");
    cv.width = CW; cv.height = CH;
    const g = cv.getContext("2d");

    // Hintergrund + Gold-Glow oben
    const bg = g.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, "#0b0e14");
    bg.addColorStop(1, "#05060a");
    g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
    const glow = g.createRadialGradient(CW / 2, 380, 60, CW / 2, 380, 760);
    glow.addColorStop(0, "rgba(201,155,75,0.22)");
    glow.addColorStop(1, "rgba(201,155,75,0)");
    g.fillStyle = glow; g.fillRect(0, 0, CW, 960);

    // Zierrahmen
    g.strokeStyle = "rgba(201,155,75,0.35)";
    g.lineWidth = 3;
    roundRect(g, 40, 40, CW - 80, CH - 80, 42); g.stroke();

    // Logo / Titel
    if (logoReady) {
      const lw = 440, lh = lw * (logoImg.height / logoImg.width);
      g.drawImage(logoImg, (CW - lw) / 2, 155, lw, lh);
    } else {
      g.fillStyle = "#f7f3ea"; g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.font = "800 82px -apple-system, system-ui, sans-serif";
      g.fillText("CAFÉ BAR STONE", CW / 2, 270);
    }

    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillStyle = "#c99b4b";
    g.font = "700 36px -apple-system, system-ui, sans-serif";
    drawSpaced(g, "PLINKO · SHOT-GAME", CW / 2, 476, 7);
    g.fillStyle = "#f7f3ea";
    g.font = "800 72px -apple-system, system-ui, sans-serif";
    g.fillText("Wer trinkt was? 🍻", CW / 2, 566);

    // Divider oben
    g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(MX, 632); g.lineTo(CW - MX, 632); g.stroke();

    // Liste – vertikal zentriert, alles bündig
    const n = players.length;
    const listTop = 690, listBottom = 1690;
    const rowH = Math.min(148, (listBottom - listTop) / Math.max(1, n));
    const startY = listTop + Math.max(0, ((listBottom - listTop) - rowH * n) / 2);
    const nameFs = clamp(rowH * 0.40, 32, 54);
    const shotFs = nameFs * 0.92;
    const rowInnerH = Math.min(rowH * 0.84, 124);
    const cardPad = 34;
    const swSize = nameFs * 0.95;
    const swX = MX + cardPad;
    const nameX = swX + swSize + 28;      // gleiche Startlinie für ALLE Namen
    const shotRight = CW - MX - cardPad;  // gleiche rechte Kante für ALLE Shots

    players.forEach((p, i) => {
      const cy = startY + rowH * i + rowH / 2;
      const col = shotColor(p.shotIndex);

      // Zeilen-Karte
      g.fillStyle = "rgba(255,255,255,0.045)";
      roundRect(g, MX, cy - rowInnerH / 2, CW - 2 * MX, rowInnerH, 26); g.fill();
      g.strokeStyle = "rgba(255,255,255,0.07)"; g.lineWidth = 1;
      roundRect(g, MX, cy - rowInnerH / 2, CW - 2 * MX, rowInnerH, 26); g.stroke();

      // Farb-Swatch
      g.fillStyle = col;
      roundRect(g, swX, cy - swSize / 2, swSize, swSize, 9); g.fill();

      // Shot rechtsbündig (zuerst messen, um Namensbreite zu begrenzen)
      const shotText = resultLabel(p);
      g.font = `600 ${shotFs}px -apple-system, system-ui, sans-serif`;
      const shotW = g.measureText(shotText).width;
      g.textAlign = "right"; g.textBaseline = "middle";
      g.fillStyle = col;
      g.fillText(shotText, shotRight, cy);

      // Name linksbündig, sauber abgeschnitten falls zu lang
      g.font = `700 ${nameFs}px -apple-system, system-ui, sans-serif`;
      const nameMax = (shotRight - shotW - 32) - nameX;
      g.textAlign = "left"; g.textBaseline = "middle";
      g.fillStyle = "#f7f3ea";
      g.fillText(fitText(g, p.name, nameMax), nameX, cy);
    });

    // Divider unten + Footer
    g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(MX, 1742); g.lineTo(CW - MX, 1742); g.stroke();
    g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillStyle = "#c99b4b"; g.font = "700 42px -apple-system, system-ui, sans-serif";
    g.fillText("@stonelingen", CW / 2, 1802);
    g.fillStyle = "rgba(193,188,207,0.7)"; g.font = "400 30px -apple-system, system-ui, sans-serif";
    g.fillText(GAME_URL, CW / 2, 1852);

    return cv.toDataURL("image/png");
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function fitText(g, text, maxW) {
    text = String(text);
    if (g.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t + "…";
  }
  function drawSpaced(g, text, cx, y, spacing) {
    const chars = [...String(text)];
    let total = 0;
    for (const c of chars) total += g.measureText(c).width + spacing;
    total -= spacing;
    const prev = g.textAlign;
    g.textAlign = "left";
    let x = cx - total / 2;
    for (const c of chars) { g.fillText(c, x, y); x += g.measureText(c).width + spacing; }
    g.textAlign = prev;
  }

  async function shareResults() {
    let dataUrl;
    try { dataUrl = renderShareCard(); } catch (e) { console.error(e); return; }
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "plinko-cafebarstone.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Café Bar Stone · Plinko",
          text: "Wer trinkt was? 🍻 #cafebarstone",
        });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return; // Nutzer hat das Teilen abgebrochen
    }
    showSharePreview(dataUrl);
  }

  function showSharePreview(dataUrl) {
    if (!sharePreview) return;
    if (shareImg) shareImg.src = dataUrl;
    if (shareDownload) shareDownload.href = dataUrl;
    sharePreview.classList.remove("is-hidden");
    sharePreview.setAttribute("aria-hidden", "false");
  }
  function hideSharePreview() {
    if (!sharePreview) return;
    sharePreview.classList.add("is-hidden");
    sharePreview.setAttribute("aria-hidden", "true");
  }

  // ============================================================
  //  Daten laden
  // ============================================================
  async function loadData() {
    try {
      const { data } = await supabaseClient
        .from("business_settings").select("plinko_enabled").limit(1);
      if (data && data.length > 0 && data[0].plinko_enabled === false) {
        showDisabledMessage();
        return false;
      }
    } catch (_) {}
    async function fetchShots(cols) {
      return supabaseClient
        .from("plinko_shots")
        .select(cols)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
    }
    try {
      // Neue Spalten weight/effect – bei Fehler (Migration noch nicht da) Fallback
      let { data, error } = await fetchShots("name, description, color, weight, effect, sort_order");
      if (error) {
        ({ data, error } = await fetchShots("name, description, color, sort_order"));
        if (error) throw error;
      }
      shots = (data || []).map((s) => ({
        name: s.name,
        description: s.description || "",
        color: s.color || null,
        weight: s.weight && Number(s.weight) > 0 ? Number(s.weight) : 1,
        effect: s.effect === "double" ? "double" : "normal",
      }));
    } catch (err) {
      console.error("plinko_shots:", err);
      shots = [];
    }
    return true;
  }

  function showDisabledMessage() {
    if (setupScreen) {
      setupScreen.innerHTML =
        '<div class="plinko-panel"><p class="eyebrow">Nicht verfügbar</p>' +
        '<p style="color:var(--color-text-soft);font-size:14px;line-height:1.7;margin-top:8px;">' +
        "Das Plinko-Spiel ist gerade nicht verfügbar. Schau später wieder vorbei oder frag das Bar-Team.</p></div>";
    }
  }

  // ============================================================
  //  Init
  // ============================================================
  if (addPlayerBtn) addPlayerBtn.addEventListener("click", () => addPlayerRow(""));
  if (startBtn) startBtn.addEventListener("click", startGame);
  if (dropBtn) dropBtn.addEventListener("click", onDrop);
  if (nextBtn) nextBtn.addEventListener("click", onNext);
  if (restartBtn) restartBtn.addEventListener("click", restart);
  if (shareBtn) shareBtn.addEventListener("click", shareResults);
  if (saveBtn) saveBtn.addEventListener("click", () => {
    try { showSharePreview(renderShareCard()); } catch (e) { console.error(e); }
  });
  if (shareClose) shareClose.addEventListener("click", hideSharePreview);
  if (sharePreview) sharePreview.addEventListener("click", (e) => { if (e.target === sharePreview) hideSharePreview(); });

  window.addEventListener("resize", () => {
    if (!gameScreen.classList.contains("is-hidden") && !animating && !celebrationVisible) {
      fitCanvas();
      drawBoard(null, -1, -1, 0);
    }
  });

  addPlayerRow("");
  addPlayerRow("");

  loadData().then((ok) => {
    if (ok && shots.length === 0 && setupError) {
      setupError.textContent =
        "Hinweis: Es sind noch keine Shots hinterlegt – das Bar-Team muss sie erst konfigurieren.";
    }
  });
});
