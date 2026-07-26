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

  const revealBox = document.getElementById("plinko-reveal");
  const revealShotEl = document.getElementById("plinko-reveal-shot");
  const revealDescEl = document.getElementById("plinko-reveal-desc");
  const nextBtn = document.getElementById("plinko-next");

  const resultsList = document.getElementById("plinko-results-list");
  const restartBtn = document.getElementById("plinko-restart");

  const canvas = document.getElementById("plinko-canvas");
  const ctx = canvas.getContext("2d");

  const MAX_PLAYERS = 10;

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
  //  Canvas-Geometrie
  // ============================================================
  const TOP_PAD = 40;
  const SLOT_H = 56;
  let W = 480, H = 560;
  const rows = () => Math.max(6, Math.min(10, shots.length + 3));

  function fitCanvas() {
    const wrap = canvas.parentElement;
    const cssW = Math.max(240, Math.round(wrap.clientWidth));
    const cssH = Math.round(cssW * 1.16);
    const dpr = window.devicePixelRatio || 1;
    W = cssW;
    H = cssH;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function slotGeometry() {
    const P = Math.max(10, W * 0.04);
    const n = Math.max(1, shots.length);
    const fieldW = W - 2 * P;
    const slotW = fieldW / n;
    const slotTop = H - SLOT_H;
    return { P, n, fieldW, slotW, slotTop };
  }

  function slotCenterX(i) {
    const { P, slotW } = slotGeometry();
    return P + slotW * (i + 0.5);
  }

  function pegPositions() {
    const { P, n, fieldW } = slotGeometry();
    const R = rows();
    const top = TOP_PAD;
    const bottom = H - SLOT_H;
    const rowGap = (bottom - top) / (R + 1);
    const colGap = fieldW / n;
    const pegs = [];
    for (let r = 0; r < R; r++) {
      const y = top + rowGap * (r + 1);
      const offset = r % 2 === 0 ? 0 : colGap / 2;
      for (let c = 0; c <= n; c++) {
        const x = P + colGap * c + offset;
        if (x >= P - 1 && x <= W - P + 1) pegs.push({ x, y });
      }
    }
    return pegs;
  }

  // ============================================================
  //  Zeichnen
  // ============================================================
  function drawBoard(ballX, ballY, highlightSlot) {
    ctx.clearRect(0, 0, W, H);
    const { P, n, slotW, slotTop } = slotGeometry();

    // Slots (unten)
    for (let i = 0; i < n; i++) {
      const x = P + slotW * i;
      const col = shotColor(i);
      // Fläche
      ctx.fillStyle = hexToRgba(col, i === highlightSlot ? 0.42 : 0.16);
      ctx.fillRect(x, slotTop, slotW, SLOT_H);
      // Farbbalken ganz unten
      ctx.fillStyle = hexToRgba(col, i === highlightSlot ? 1 : 0.85);
      ctx.fillRect(x + 2, H - 6, slotW - 4, 4);
      // Trenner
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, slotTop);
      ctx.lineTo(x, H);
      ctx.stroke();
      // Nummer
      ctx.fillStyle = i === highlightSlot ? COL_TEXT : COL_TEXT_SOFT;
      ctx.font = "600 13px -apple-system, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x + slotW / 2, slotTop + SLOT_H / 2);
    }
    // Rahmen ueber den Slots
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(P, slotTop);
    ctx.lineTo(W - P, slotTop);
    ctx.stroke();

    // Pegs
    const pegs = pegPositions();
    for (const p of pegs) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(COL_ACCENT, 0.55);
      ctx.fill();
    }

    // Ball
    if (ballX != null && ballY != null) {
      const r = Math.max(6, W * 0.018);
      const grad = ctx.createRadialGradient(ballX - r * 0.3, ballY - r * 0.3, r * 0.2, ballX, ballY, r);
      grad.addColorStop(0, "#ffe9c2");
      grad.addColorStop(1, COL_ACCENT);
      ctx.beginPath();
      ctx.arc(ballX, ballY, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(201,155,75,0.6)";
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function hexToRgba(hex, alpha) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const num = parseInt(h.slice(0, 6), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ============================================================
  //  Fall-Animation (fair: Zielslot uniform, Kugel wird geführt)
  // ============================================================
  function dropBall(onDone) {
    const { slotTop } = slotGeometry();
    // Fair & gleichverteilt: jeder Slot (= jeder Shot) exakt gleich wahrscheinlich
    const targetSlot = Math.floor(Math.random() * Math.max(1, shots.length));
    const targetX = slotCenterX(targetSlot);
    const startX = W / 2;
    const startY = TOP_PAD - 10;
    const endY = slotTop - Math.max(6, W * 0.018);

    const R = rows();
    const amp = Math.min(slotGeometry().slotW * 0.4, W * 0.11);

    let y = startY;
    let vy = 1.2;
    const gravity = 0.35;

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function frame() {
      vy += gravity;
      y += vy;
      let p = (y - startY) / (endY - startY);
      if (p > 1) p = 1;

      const baseX = startX + (targetX - startX) * easeInOut(p);
      const wobble = Math.sin(p * R * Math.PI) * amp * (1 - p);
      const x = baseX + wobble;

      drawBoard(x, y, targetSlot);

      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        settleBall(targetX, endY, targetSlot, onDone.bind(null, targetSlot));
      }
    }
    requestAnimationFrame(frame);
  }

  function settleBall(x, restY, targetSlot, done) {
    const { slotTop } = slotGeometry();
    const floorY = H - 6 - Math.max(6, W * 0.018);
    let y = restY;
    let vy = 3.5;
    let bounces = 0;
    const gravity = 0.6;

    function frame() {
      vy += gravity;
      y += vy;
      if (y >= floorY) {
        y = floorY;
        vy = -vy * 0.42;
        bounces++;
      }
      drawBoard(x, y, targetSlot);
      if (bounces < 3 && Math.abs(vy) > 0.6) {
        requestAnimationFrame(frame);
      } else {
        drawBoard(x, floorY, targetSlot);
        done();
      }
    }
    requestAnimationFrame(frame);
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

    fitCanvas();
    renderLegend();
    showScreen(gameScreen);
    beginTurn();
  }

  function beginTurn() {
    animating = false;
    if (revealBox) revealBox.classList.add("is-hidden");
    if (dropBtn) {
      dropBtn.style.display = "";
      dropBtn.disabled = false;
    }
    const player = players[currentIndex];
    if (currentPlayerEl) currentPlayerEl.textContent = player.name;
    if (progressEl) {
      progressEl.textContent = `Spieler ${currentIndex + 1} von ${players.length}`;
    }
    fitCanvas();
    drawBoard(null, null, -1);
  }

  function onDrop() {
    if (animating) return;
    animating = true;
    if (dropBtn) dropBtn.disabled = true;
    dropBall((targetSlot) => {
      players[currentIndex].shotIndex = targetSlot;
      revealShot(targetSlot);
    });
  }

  function revealShot(slot) {
    const shot = shots[slot];
    if (revealShotEl) revealShotEl.textContent = shot.name;
    if (revealDescEl) {
      revealDescEl.textContent = shot.description || "";
      revealDescEl.style.display = shot.description ? "" : "none";
    }
    if (dropBtn) dropBtn.style.display = "none";
    if (revealBox) revealBox.classList.remove("is-hidden");
    if (nextBtn) {
      nextBtn.textContent =
        currentIndex >= players.length - 1 ? "Ergebnis anzeigen" : "Weiter";
    }
    animating = false;
  }

  function onNext() {
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
      players.forEach((p) => {
        const shot = shots[p.shotIndex];
        const li = document.createElement("li");

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
  }

  function restart() {
    players = [];
    currentIndex = 0;
    showScreen(setupScreen);
    if (setupError) setupError.textContent = "";
  }

  // ============================================================
  //  Daten laden
  // ============================================================
  async function loadData() {
    // Optionaler Ein/Aus-Schalter – Fehler ignorieren (Standard: aktiv)
    try {
      const { data } = await supabaseClient
        .from("business_settings")
        .select("plinko_enabled")
        .limit(1);
      if (data && data.length > 0 && data[0].plinko_enabled === false) {
        showDisabledMessage();
        return false;
      }
    } catch (_) { /* Spalte evtl. noch nicht vorhanden – ignorieren */ }

    // Aktive Shots laden
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
        '<p class="eyebrow">Nicht verfügbar</p>' +
        '<p style="color:var(--color-text-soft);font-size:14px;line-height:1.7;margin-top:8px;">' +
        "Das Plinko-Spiel ist gerade nicht verfügbar. Schau später wieder vorbei " +
        "oder frag das Bar-Team.</p>";
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
    if (!gameScreen.classList.contains("is-hidden") && !animating) {
      fitCanvas();
      drawBoard(null, null, -1);
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
