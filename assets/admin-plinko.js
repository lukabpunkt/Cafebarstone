// ============================================================
//  Plinko-Shot-Verwaltung im Admin-Dashboard
//  Eigenständig – nutzt dieselbe Supabase-Session wie admin.js,
//  fasst aber die Reservierungslogik nicht an.
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const card = document.getElementById("plinko-admin-card");
  const form = document.getElementById("plinko-shot-form");
  const nameInput = document.getElementById("plinko-shot-name");
  const descInput = document.getElementById("plinko-shot-desc");
  const colorInput = document.getElementById("plinko-shot-color");
  const weightInput = document.getElementById("plinko-shot-weight");
  const effectInput = document.getElementById("plinko-shot-effect");
  const listEl = document.getElementById("plinko-shots-list");
  const messageEl = document.getElementById("plinko-admin-message");
  const enabledToggle = document.getElementById("plinko-enabled-toggle");

  if (!card) return;

  let businessSettingsId = null;
  let plinkoEnabled = true;

  function setMessage(text) {
    if (messageEl) messageEl.textContent = text || "";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---- Ein/Aus-Schalter für das ganze Spiel ----
  function updateEnabledLabel() {
    if (!enabledToggle) return;
    enabledToggle.textContent = plinkoEnabled
      ? "Plinko-Spiel deaktivieren"
      : "Plinko-Spiel aktivieren";
  }

  async function loadPlinkoEnabled() {
    try {
      const { data, error } = await supabaseClient
        .from("business_settings")
        .select("id, plinko_enabled")
        .order("id", { ascending: true })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        businessSettingsId = data[0].id;
        plinkoEnabled = data[0].plinko_enabled !== false;
      } else {
        businessSettingsId = null;
        plinkoEnabled = true;
      }
    } catch (err) {
      console.error("plinko_enabled:", err);
    }
    updateEnabledLabel();
  }

  if (enabledToggle) {
    enabledToggle.addEventListener("click", async () => {
      enabledToggle.disabled = true;
      setMessage("Aktualisiere Spiel-Status …");
      const nextValue = !plinkoEnabled;
      try {
        if (!businessSettingsId) {
          const { data, error } = await supabaseClient
            .from("business_settings")
            .insert([{ plinko_enabled: nextValue }])
            .select("id, plinko_enabled")
            .single();
          if (error) throw error;
          businessSettingsId = data.id;
          plinkoEnabled = data.plinko_enabled !== false;
        } else {
          const { data, error } = await supabaseClient
            .from("business_settings")
            .update({ plinko_enabled: nextValue })
            .eq("id", businessSettingsId)
            .select("id, plinko_enabled")
            .single();
          if (error) throw error;
          plinkoEnabled = data.plinko_enabled !== false;
        }
        updateEnabledLabel();
        setMessage(plinkoEnabled ? "Plinko-Spiel ist aktiv." : "Plinko-Spiel ist deaktiviert.");
      } catch (err) {
        console.error(err);
        setMessage("Fehler beim Aktualisieren des Spiel-Status.");
      } finally {
        enabledToggle.disabled = false;
      }
    });
  }

  // ---- Shots laden & rendern ----
  async function loadShots() {
    if (!listEl) return;
    setMessage("Lade Shots …");
    const { data, error } = await supabaseClient
      .from("plinko_shots")
      .select("id, name, description, color, active, sort_order, weight, effect")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setMessage("Shots konnten nicht geladen werden.");
      return;
    }

    if (!data || data.length === 0) {
      listEl.innerHTML =
        '<p class="plinko-admin-empty">Noch keine Shots angelegt. Füge oben deinen ersten Shot hinzu.</p>';
      setMessage("");
      return;
    }

    listEl.innerHTML = data.map((s) => {
      const color = s.color || "#c99b4b";
      const desc = s.description ? escapeHtml(s.description) : "";
      const inactive = s.active === false;
      const weight = s.weight && Number(s.weight) > 0 ? Number(s.weight) : 1;
      const dbl = s.effect === "double";
      const meta = `Gewicht ${weight}${dbl ? " · ×2 Doppel" : ""}`;
      return `
        <div class="plinko-shot-item${inactive ? " is-inactive" : ""}">
          <span class="plinko-shot-swatch" style="background:${escapeHtml(color)}"></span>
          <span class="plinko-shot-info">
            <span class="plinko-shot-name">${escapeHtml(s.name)}${dbl ? ' <span class="plinko-shot-badge">×2</span>' : ""}</span>
            ${desc ? `<span class="plinko-shot-desc">${desc}</span>` : ""}
            <span class="plinko-shot-meta">${meta}</span>
          </span>
          <span class="plinko-shot-actions">
            <button type="button" class="admin-btn plinko-shot-toggle" data-id="${s.id}" data-active="${s.active !== false}">
              ${inactive ? "Aktivieren" : "Deaktivieren"}
            </button>
            <button type="button" class="admin-btn admin-btn-reject plinko-shot-delete" data-id="${s.id}" data-name="${escapeHtml(s.name)}">
              Löschen
            </button>
          </span>
        </div>
      `;
    }).join("");
    setMessage(`${data.length} Shot(s) geladen.`);
  }

  // ---- Shot hinzufügen ----
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
      const description = descInput instanceof HTMLInputElement ? descInput.value.trim() : "";
      const color = colorInput instanceof HTMLInputElement ? colorInput.value : null;
      let weight = weightInput instanceof HTMLInputElement ? Number(weightInput.value) : 1;
      if (!Number.isFinite(weight) || weight < 1) weight = 1;
      const effect = effectInput && effectInput.value === "double" ? "double" : "normal";

      if (!name) {
        setMessage("Bitte einen Namen für den Shot eingeben.");
        if (nameInput) nameInput.classList.add("error");
        return;
      }
      if (nameInput) nameInput.classList.remove("error");
      setMessage("Speichere Shot …");

      // nächste sort_order bestimmen
      let nextOrder = 0;
      try {
        const { data: maxData } = await supabaseClient
          .from("plinko_shots")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1);
        if (maxData && maxData.length > 0 && typeof maxData[0].sort_order === "number") {
          nextOrder = maxData[0].sort_order + 1;
        }
      } catch (_) { /* Fallback 0 */ }

      const { error } = await supabaseClient
        .from("plinko_shots")
        .insert([{ name, description: description || null, color: color || null, active: true, sort_order: nextOrder, weight, effect }]);

      if (error) {
        console.error(error);
        setMessage("Fehler beim Speichern: " + (error.message || "Bitte erneut versuchen."));
        return;
      }

      if (nameInput) nameInput.value = "";
      if (descInput) descInput.value = "";
      if (weightInput) weightInput.value = "1";
      if (effectInput) effectInput.value = "normal";
      setMessage("Shot hinzugefügt.");
      loadShots();
    });
  }

  // ---- Liste: Aktivieren/Deaktivieren & Löschen ----
  if (listEl) {
    listEl.addEventListener("click", async (e) => {
      const toggleBtn = e.target.closest(".plinko-shot-toggle");
      const deleteBtn = e.target.closest(".plinko-shot-delete");

      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-id");
        const isActive = toggleBtn.getAttribute("data-active") === "true";
        toggleBtn.disabled = true;
        const { error } = await supabaseClient
          .from("plinko_shots")
          .update({ active: !isActive })
          .eq("id", id);
        if (error) {
          console.error(error);
          setMessage("Status konnte nicht geändert werden.");
          toggleBtn.disabled = false;
          return;
        }
        loadShots();
        return;
      }

      if (deleteBtn) {
        const id = deleteBtn.getAttribute("data-id");
        // Zweistufiges Löschen ohne Browser-Dialog
        if (deleteBtn.getAttribute("data-confirm") !== "1") {
          deleteBtn.setAttribute("data-confirm", "1");
          deleteBtn.textContent = "Wirklich löschen?";
          setTimeout(() => {
            if (deleteBtn.isConnected) {
              deleteBtn.setAttribute("data-confirm", "0");
              deleteBtn.textContent = "Löschen";
            }
          }, 4000);
          return;
        }
        deleteBtn.disabled = true;
        const { error } = await supabaseClient
          .from("plinko_shots")
          .delete()
          .eq("id", id);
        if (error) {
          console.error(error);
          setMessage("Shot konnte nicht gelöscht werden.");
          deleteBtn.disabled = false;
          return;
        }
        setMessage("Shot gelöscht.");
        loadShots();
      }
    });
  }

  // ---- Sichtbarkeit an Login-Status koppeln ----
  async function showPanel() {
    card.style.display = "block";
    await loadPlinkoEnabled();
    await loadShots();
  }
  function hidePanel() {
    card.style.display = "none";
  }

  // Initiale Session prüfen (Reload bei aktiver Session)
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data && data.session) showPanel();
  });

  // Auf Login/Logout reagieren (admin.js löst die Auth-Events aus)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      showPanel();
    } else {
      hidePanel();
    }
  });
});
