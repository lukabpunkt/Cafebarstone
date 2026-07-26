document.addEventListener("DOMContentLoaded", () => {
  // ---- Jahr im Footer ----
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ---- Hamburger-Nav (identisch zur Startseite) ----
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

  const currentPlayerEl = document.getElementById("plinko-current-player");
  const progressEl = document.getElementById("plinko-progress");
  const dropBtn = document.getElementById("plinko-drop");
  const legendEl = document.getElementById("plinko-legend");

  const celebration = document.getElementById("plinko-celebration");
  const celPlayerEl = document.getElementById("celebration-player");
  const celShotEl = document.getElementById("celebration-shot");
  const celDescEl = document.getElementById("celebration-desc");
  const nextBtn = document.getElementById("plinko-next");
  const confettiCanvas = document.getElementById("plinko-confetti");

  const resultsList = document.getElementById("plinko-results-list");
  const restartBtn = document.getElementById("plinko-restart");

  const canvas = document.getElementById("plinko-canvas");
  const ctx = canvas.getContext("2d");

  const MAX_PLAYERS = 10;
  const reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canVibrate = typeof navigator !== "undefined" && "vibrate" in navigator;

  // Akzent-nahe Palette für Shots ohne eigene Farbe
  const PALETTE = [
    "#c99b4b", "#e0b46e", "#b5813a", "#d98c5f",
    "#8f9b57", "#6f9bb5", "#b56f8f", "#7f6fb5",
    "#5fae8c", "#cf6d6d", "#c9b44b", "#9b7bd1",
  ];

  // ============================================================
  //  State
  // ============================================================
  let shots = [];        // [{name, description, color}]
  let players = [];      // [{name, shotIndex}]
  let currentIndex = 0;
  let animating = false;
  let celebrationVisible = false;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function shotColor(i) {
    const s = shots[i];
    if (s && s.color && /^#?[0-9a-fA-F]{3,8}$/.test(s.color)) {
      return s.color[0] === "#" ? s.color : "#" + s.color;
    }
    return PALETTE[i % PALETTE.length];
  }

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
    removeBtn.addEventListener("click", () => {
      row.remove();
      renumberPlayerRows();
    });

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
      .map((el, i) => {
        const v = el.value.trim();
        return v || `Spieler ${i + 1}`;
      });
  }

  // ============================================================
  //  Canvas-Geometrie & Board-Aufbau
  // ============================================================
  const TOP_PAD = 46;
  const SLOT_H = 58;
  let W = 460, H = 620;
  let BOARD = null; // {P, n, slotW, slotTop, ballR, pegR, pegs, floorY}

  function fitCanvas() {
    const wrap = canvas.parentElement;
    const cssW = Math.max(240, Math.round(wrap.clientWidth));
    const availH = window.innerHeight || 700;
    let cssH = Math.round(Math.min(cssW * 1.34, availH * 0.6));
    cssH = Math.max(cssH, Math.round(cssW * 1.08));
    const dpr = window.devicePixelRatio || 1;
    W = cssW;
    H = cssH;
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
    const slotW = fieldW / n;
    const ballR = clamp(W * 0.028, 7, slotW * 0.36);
    const pegR = Math.max(3, W * 0.0095);

    // Dichtes, versetztes Pin-Raster (mehr Hindernisse => mehr Bounces)
    const pegSpacingX = Math.max(ballR * 3.8, fieldW / 8);
    let cols = Math.max(2, Math.floor(fieldW / pegSpacingX));
    const actualSpacing = fieldW / cols;
    const rowSpacingY = Math.max(ballR * 3.0, actualSpacing * 0.82);
    const topY = TOP_PAD + rowSpacingY * 0.7;
    const usableH = slotTop - topY - rowSpacingY * 0.5;
    let R = Math.floor(usableH / rowSpacingY);
    R = clamp(R, 7, 14);

    const pegs = [];
    for (let r = 0; r < R; r++) {
      const y = topY + r * rowSpacingY;
      if (r % 2 === 0) {
        for (let c = 0; c <= cols; c++) pegs.push({ x: P + c * actualSpacing, y, flash: 0 });
      } else {
        for (let c = 0; c < cols; c++) pegs.push({ x: P + (c + 0.5) * actualSpacing, y, flash: 0 });
      }
    }

    BOARD = {
      P, n, slotW, slotTop, ballR, pegR, pegs,
      floorY: H - 8 - ballR,
    };
  }

  function slotCenterX(i) {
    return BOARD.P + BOARD.slotW * (i + 0.5);
  }

  // ============================================================
  //  Zeichnen
  // ============================================================
  function drawBoard(ball, highlightSlot, nearSlot, nearIntensity) {
    if (!BOARD) return;
    ctx.clearRect(0, 0, W, H);
    const { P, n, slotW, slotTop, ballR, pegR, pegs } = BOARD;

    // Slots (unten)
    for (let i = 0; i < n; i++) {
      const x = P + slotW * i;
      const col = shotColor(i);
      let intensity = 0.16;
      if (i === highlightSlot) intensity = 0.5;
      else if (i === nearSlot) intensity = 0.16 + 0.3 * (nearIntensity || 0);
      ctx.fillStyle = hexToRgba(col, intensity);
      ctx.fillRect(x, slotTop, slotW, SLOT_H);
      ctx.fillStyle = hexToRgba(col, i === highlightSlot ? 1 : 0.85);
      ctx.fillRect(x + 2, H - 6, slotW - 4, 4);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, slotTop);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.fillStyle = i === highlightSlot ? COL_TEXT : COL_TEXT_SOFT;
      ctx.font = "600 13px -apple-system, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x + slotW / 2, slotTop + SLOT_H / 2);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(P, slotTop);
    ctx.lineTo(W - P, slotTop);
    ctx.stroke();

    // Pegs (mit Flash bei Treffer)
    for (const p of pegs) {
      const f = p.flash > 0 ? p.flash / 6 : 0;
      if (p.flash > 0) p.flash--;
      const rr = pegR + f * 2.2;
      if (f > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr + 3, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba("#ffe9c2", 0.25 * f);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fillStyle = f > 0 ? hexToRgba("#ffe9c2", 0.9) : hexToRgba(COL_ACCENT, 0.55);
      ctx.fill();
    }

    // Ball (mit Trail + Squash)
    if (ball) {
      if (ball.trail && ball.trail.length) {
        for (let t = 0; t < ball.trail.length; t++) {
          const tp = ball.trail[t];
          const a = ((t + 1) / ball.trail.length) * 0.35;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, ballR * (0.5 + 0.5 * (t + 1) / ball.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(COL_ACCENT, a);
          ctx.fill();
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
      ctx.beginPath();
      ctx.arc(0, 0, ballR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(201,155,75,0.7)";
      ctx.shadowBlur = 14 + Math.min(10, speed);
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }

  // ============================================================
  //  Physik-Simulation (echte Kollisionen, natürliche Verteilung)
  // ============================================================
  function dropBall(onDone) {
    const { P, n, slotW, slotTop, ballR, pegR, pegs, floorY } = BOARD;
    const gravity = 0.20;
    const restitution = 0.66;
    const wallRest = 0.5;
    const jitterAmt = 1.3;
    const maxV = ballR * 0.8;
    const SUB = 3;

    const ball = {
      x: W / 2 + (Math.random() - 0.5) * slotW * 0.5,
      y: TOP_PAD - 6,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 0.6,
      trail: [],
      hit: 0,
    };

    let stable = 0;
    let frames = 0;
    let lastTick = 0;

    function hapticTick() {
      if (reducedMotion || !canVibrate) return;
      frames - lastTick > 3 && (navigator.vibrate(5), lastTick = frames);
    }

    function collidePegs() {
      for (const p of pegs) {
        const dx = ball.x - p.x, dy = ball.y - p.y;
        const minD = ballR + pegR;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD * minD) {
          const d = Math.sqrt(d2) || 0.0001;
          const nx = dx / d, ny = dy / d;
          ball.x = p.x + nx * minD;
          ball.y = p.y + ny * minD;
          const vdot = ball.vx * nx + ball.vy * ny;
          ball.vx -= (1 + restitution) * vdot * nx;
          ball.vy -= (1 + restitution) * vdot * ny;
          const jitter = (Math.random() - 0.5) * jitterAmt;
          ball.vx += -ny * jitter;
          ball.vy += nx * jitter;
          p.flash = 6;
          ball.hit = 6;
          hapticTick();
        }
      }
    }

    function substep() {
      ball.vy += gravity / SUB;
      ball.vx *= 0.999;
      ball.vx = clamp(ball.vx, -maxV, maxV);
      ball.vy = clamp(ball.vy, -maxV, maxV);
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Seitenwände
      if (ball.x < P + ballR) { ball.x = P + ballR; ball.vx = Math.abs(ball.vx) * wallRest; }
      if (ball.x > W - P - ballR) { ball.x = W - P - ballR; ball.vx = -Math.abs(ball.vx) * wallRest; }

      collidePegs();

      // Slot-Bereich: in Rinne führen + Boden
      if (ball.y > slotTop - ballR) {
        const col = clamp(Math.floor((ball.x - P) / slotW), 0, n - 1);
        const leftX = P + col * slotW + ballR;
        const rightX = P + (col + 1) * slotW - ballR;
        if (ball.x < leftX) { ball.x = leftX; ball.vx = Math.abs(ball.vx) * 0.4; }
        if (ball.x > rightX) { ball.x = rightX; ball.vx = -Math.abs(ball.vx) * 0.4; }
        if (ball.y > floorY) {
          ball.y = floorY;
          ball.vy = -Math.abs(ball.vy) * 0.34;
          ball.vx *= 0.6;
        }
      }
    }

    function frame() {
      frames++;
      for (let s = 0; s < SUB; s++) substep();

      // Trail pflegen
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > (reducedMotion ? 0 : 8)) ball.trail.shift();

      // Nähe zum Ziel-Slot für Puls
      let nearSlot = -1, nearIntensity = 0;
      if (ball.y > slotTop - BOARD.slotW) {
        nearSlot = clamp(Math.floor((ball.x - P) / slotW), 0, n - 1);
        nearIntensity = clamp((ball.y - (slotTop - BOARD.slotW)) / BOARD.slotW, 0, 1);
      }
      drawBoard(ball, -1, nearSlot, nearIntensity);

      // Ruhelage prüfen
      const slow = Math.abs(ball.vx) < 0.5 && Math.abs(ball.vy) < 0.9;
      if (ball.y > slotTop && slow) stable++; else stable = 0;

      if (stable > 9 || frames > 60 * 9) {
        const result = clamp(Math.floor((ball.x - P) / slotW), 0, n - 1);
        // kurzer Einschlag-Shake
        if (!reducedMotion) {
          canvas.classList.remove("is-shaking");
          void canvas.offsetWidth;
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
  //  Konfetti (Feier)
  // ============================================================
  let confettiRAF = null;
  function startConfetti(color) {
    if (!confettiCanvas) return;
    const cx = confettiCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    confettiCanvas.width = Math.round(w * dpr);
    confettiCanvas.height = Math.round(h * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cols = [color, "#e0b46e", "#c99b4b", "#ffffff", "#ffe9c2"];
    const N = reducedMotion ? 36 : 150;
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.35,
        y: h * 0.42 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 11,
        vy: -7 - Math.random() * 10,
        g: 0.22 + Math.random() * 0.14,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 10,
        col: cols[i % cols.length],
        life: 0,
        ttl: 90 + Math.random() * 70,
      });
    }

    cancelAnimationFrame(confettiRAF);
    function loop() {
      cx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of parts) {
        if (p.life > p.ttl) continue;
        alive = true;
        p.vy += p.g;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life++;
        const fade = p.life > p.ttl - 25 ? Math.max(0, (p.ttl - p.life) / 25) : 1;
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.globalAlpha = fade;
        cx.fillStyle = p.col;
        cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        cx.restore();
      }
      if (alive && celebrationVisible) {
        confettiRAF = requestAnimationFrame(loop);
      } else {
        cx.clearRect(0, 0, w, h);
      }
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
  //  Legende
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
      label.textContent = `${i + 1}. ${s.name}`;
      item.append(sw, label);
      legendEl.appendChild(item);
    });
  }

  // ============================================================
  //  Turn-Flow
  // ============================================================
  function startGame() {
    if (!setupError) return;
    setupError.textContent = "";

    if (shots.length === 0) {
      setupError.textContent =
        "Aktuell sind keine Shots konfiguriert. Bitte sprich das Bar-Team an.";
      return;
    }
    const names = collectPlayerNames();
    if (names.length === 0) {
      setupError.textContent = "Bitte mindestens einen Spieler eintragen.";
      return;
    }

    players = names.map((name) => ({ name, shotIndex: null }));
    currentIndex = 0;

    showScreen(gameScreen);
    fitCanvas();
    renderLegend();
    beginTurn();
  }

  function beginTurn() {
    animating = false;
    hideCelebration();
    if (dropBtn) {
      dropBtn.style.display = "";
      dropBtn.disabled = false;
    }
    const player = players[currentIndex];
    if (currentPlayerEl) {
      currentPlayerEl.textContent = player.name;
      currentPlayerEl.classList.add("is-pulsing");
    }
    if (progressEl) {
      progressEl.textContent = `Spieler ${currentIndex + 1} von ${players.length}`;
    }
    fitCanvas();
    drawBoard(null, -1, -1, 0);
  }

  function onDrop() {
    if (animating) return;
    animating = true;
    if (dropBtn) dropBtn.disabled = true;
    if (currentPlayerEl) currentPlayerEl.classList.remove("is-pulsing");
    vibrate(12);
    dropBall((slot) => {
      players[currentIndex].shotIndex = slot;
      setTimeout(() => showCelebration(slot), 260);
    });
  }

  function showCelebration(slot) {
    const shot = shots[slot];
    const color = shotColor(slot);
    if (celebration) celebration.style.setProperty("--cel-color", color);
    if (celPlayerEl) celPlayerEl.textContent = players[currentIndex].name;
    if (celShotEl) celShotEl.textContent = shot.name;
    if (celDescEl) {
      celDescEl.textContent = shot.description || "";
      celDescEl.style.display = shot.description ? "" : "none";
    }
    if (nextBtn) {
      nextBtn.textContent =
        currentIndex >= players.length - 1 ? "Ergebnis anzeigen 🎊" : "Nächster Spieler →";
    }
    celebrationVisible = true;
    if (celebration) {
      celebration.classList.remove("is-hidden");
      celebration.setAttribute("aria-hidden", "false");
    }
    vibrate([0, 55, 45, 90, 45, 160]);
    startConfetti(color);
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
    if (currentIndex >= players.length - 1) {
      showResults();
    } else {
      currentIndex++;
      beginTurn();
    }
  }

  function showResults() {
    if (resultsList) {
      resultsList.innerHTML = "";
      players.forEach((p, idx) => {
        const shot = shots[p.shotIndex];
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
        shotName.textContent = shot ? shot.name : "—";
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
    players = [];
    currentIndex = 0;
    showScreen(setupScreen);
    if (setupError) setupError.textContent = "";
  }

  // ============================================================
  //  Daten laden
  // ============================================================
  async function loadData() {
    try {
      const { data } = await supabaseClient
        .from("business_settings")
        .select("plinko_enabled")
        .limit(1);
      if (data && data.length > 0 && data[0].plinko_enabled === false) {
        showDisabledMessage();
        return false;
      }
    } catch (_) { /* Spalte evtl. nicht vorhanden – ignorieren */ }

    try {
      const { data, error } = await supabaseClient
        .from("plinko_shots")
        .select("name, description, color, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      shots = (data || []).map((s) => ({
        name: s.name,
        description: s.description || "",
        color: s.color || null,
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
        "Das Plinko-Spiel ist gerade nicht verfügbar. Schau später wieder vorbei " +
        "oder frag das Bar-Team.</p></div>";
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

  window.addEventListener("resize", () => {
    if (!gameScreen.classList.contains("is-hidden") && !animating && !celebrationVisible) {
      fitCanvas();
      drawBoard(null, -1, -1, 0);
    }
  });

  // Zwei Startfelder vorbelegen
  addPlayerRow("");
  addPlayerRow("");

  loadData().then((ok) => {
    if (ok && shots.length === 0 && setupError) {
      setupError.textContent =
        "Hinweis: Es sind noch keine Shots hinterlegt – das Bar-Team muss sie erst konfigurieren.";
    }
  });
});
