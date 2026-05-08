document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const loginForm = document.getElementById("admin-login-form");
  const loginMessage = document.getElementById("admin-login-message");
  const dashboard = document.getElementById("admin-dashboard");
  const dateFromInput = document.getElementById("admin-date-from");
  const dateToInput = document.getElementById("admin-date-to");
  const reloadBtn = document.getElementById("admin-reload");
  const tableBody = document.getElementById("admin-reservations-body");
  const adminMessage = document.getElementById("admin-message");
  const availabilityBtn = document.getElementById("admin-toggle-reservations");
  const logoutBtn = document.getElementById("admin-logout-btn");

  let reservationsOpen = true;
  let businessSettingsId = null;

  function updateAvailabilityButtonLabel() {
    if (!availabilityBtn) return;
    availabilityBtn.textContent = reservationsOpen
      ? "Reservierungen sperren (alle Plätze belegt)"
      : "Reservierungen wieder freigeben";
  }

  async function loadBusinessSettings(showMessage) {
    try {
      const { data, error } = await supabaseClient
        .from("business_settings")
        .select("id, reservations_open")
        .limit(1);
      if (error) {
        console.error("business_settings:", error);
        if (showMessage && adminMessage) {
          adminMessage.textContent = "Einstellung zur Online-Reservierung konnte nicht geladen werden.";
        }
        return;
      }
      if (data && data.length > 0) {
        businessSettingsId = data[0].id;
        reservationsOpen = data[0].reservations_open !== false;
      } else {
        businessSettingsId = null;
        reservationsOpen = true;
      }
      updateAvailabilityButtonLabel();
    } catch (err) {
      console.error(err);
      if (showMessage && adminMessage) {
        adminMessage.textContent = "Einstellung zur Online-Reservierung konnte nicht geladen werden.";
      }
    }
  }

  function setToday() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;
    if (dateFromInput instanceof HTMLInputElement) dateFromInput.value = todayStr;
    if (dateToInput instanceof HTMLInputElement) dateToInput.value = todayStr;
  }

  if (dateFromInput instanceof HTMLInputElement) {
    dateFromInput.addEventListener("change", () => {
      if (dateToInput instanceof HTMLInputElement && dateFromInput.value) {
        if (!dateToInput.value || dateToInput.value < dateFromInput.value) {
          dateToInput.value = dateFromInput.value;
        }
        dateToInput.setAttribute("min", dateFromInput.value);
      }
    });
  }

  if (dateToInput instanceof HTMLInputElement) {
    dateToInput.addEventListener("change", () => {
      if (dateFromInput instanceof HTMLInputElement && dateFromInput.value) {
        if (dateToInput.value && dateToInput.value < dateFromInput.value) {
          dateToInput.value = dateFromInput.value;
        }
      }
    });
  }

  async function loadReservationsForDateRange() {
    if (!tableBody || !adminMessage) return;
    tableBody.innerHTML = "";
    adminMessage.textContent = "Lade Reservierungen ...";

    const from = dateFromInput instanceof HTMLInputElement ? dateFromInput.value : "";
    const to = dateToInput instanceof HTMLInputElement ? dateToInput.value : "";

    if (!from || !to) {
      adminMessage.textContent = "Bitte zuerst einen Zeitraum (von/bis) auswählen.";
      return;
    }

    const start = new Date(`${from}T00:00:00`);
    const end = new Date(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseClient
      .from("reservations")
      .select(`
        id,
        reservation_at,
        area,
        party_size,
        status,
        special_requests,
        customers (
          salutation,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .gte("reservation_at", start.toISOString())
      .lt("reservation_at", end.toISOString())
      .order("reservation_at", { ascending: true });

    if (error) {
      console.error(error);
      adminMessage.textContent = "Fehler beim Laden der Reservierungen. Bitte später erneut versuchen.";
      return;
    }

    if (!data || data.length === 0) {
      adminMessage.textContent = "Keine Reservierungen für diesen Zeitraum.";
      return;
    }

    const businessTz = "Europe/Berlin";

    const rows = data.map((row) => {
      const when = new Date(row.reservation_at);
      const dateStr = when.toLocaleDateString("de-DE", {
        weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: businessTz,
      });
      const timeStr = when.toLocaleTimeString("de-DE", {
        hour: "2-digit", minute: "2-digit", timeZone: businessTz,
      });

      const c = row.customers;
      const guest = c ? [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "-" : "-";
      const email = c?.email ?? "";
      const phone = c?.phone ?? "";
      const notes = row.special_requests || "";
      const areaLabel = row.area === "smoking" ? "Raucherbereich" : "Nichtraucherbereich";
      const statusLabelMap = { confirmed: "Bestätigt", cancelled: "Abgelehnt", pending: "Ausstehend" };
      const statusLabel = statusLabelMap[row.status] ?? "Ausstehend";
      const statusClass = `admin-status-pill ${row.status === "confirmed" ? "confirmed" : row.status === "cancelled" ? "cancelled" : "pending"}`;
      const showConfirm = row.status === "pending";
      const showReject = row.status === "pending";
      const fullName = guest !== "-" ? guest : "";

      const infoAttrs = [
        `data-reservation-id="${row.id}"`,
        `data-date="${dateStr}"`,
        `data-time="${timeStr}"`,
        `data-area="${areaLabel}"`,
        `data-party-size="${row.party_size}"`,
        fullName ? `data-name="${fullName}"` : "",
        email ? `data-email="${email}"` : "",
        phone ? `data-phone="${phone}"` : "",
        notes ? `data-notes="${String(notes).replace(/"/g, "&quot;")}"` : "",
      ].filter(Boolean).join(" ");

      const actionAttrs = [
        `data-reservation-id="${row.id}"`,
        email ? `data-email="${email}"` : "",
        fullName ? `data-name="${fullName}"` : "",
        row.reservation_at ? `data-reservation-at="${row.reservation_at}"` : "",
        `data-area-label="${areaLabel}"`,
        `data-party-size="${row.party_size}"`,
      ].filter(Boolean).join(" ");

      const infoBtn = `<button type="button" class="admin-btn admin-btn-info" ${infoAttrs}>Info</button>`;
      const confirmBtn = showConfirm
        ? `<button type="button" class="admin-btn admin-btn-confirm" ${actionAttrs}>Bestätigen</button>`
        : "";
      const rejectBtn = showReject
        ? `<button type="button" class="admin-btn admin-btn-reject" ${actionAttrs}>Ablehnen</button>`
        : "";

      return `
        <tr>
          <td data-label="Datum">${dateStr}</td>
          <td data-label="Uhrzeit">${timeStr}</td>
          <td data-label="Bereich">${areaLabel}</td>
          <td data-label="Personen">${row.party_size}</td>
          <td data-label="Name">${guest || "-"}</td>
          <td data-label="Status"><span class="${statusClass}">${statusLabel}</span></td>
          <td class="admin-actions-cell">${infoBtn}${confirmBtn}${rejectBtn}</td>
        </tr>
      `;
    }).join("");

    tableBody.innerHTML = rows;
    adminMessage.textContent = `${data.length} Reservierung(en) geladen.`;
  }

  async function confirmReservation(payload) {
    if (!adminMessage) return;
    adminMessage.textContent = "Bestätige Reservierung …";

    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !sessionData?.session) {
      console.error("Kein gültiges Admin-Session-Token:", sessionError);
      adminMessage.textContent = "Du bist nicht mehr angemeldet. Bitte neu einloggen und erneut versuchen.";
      return;
    }

    const { error: updateError } = await supabaseClient
      .from("reservations")
      .update({ status: "confirmed" })
      .eq("id", payload.id);

    if (updateError) {
      console.error(updateError);
      adminMessage.textContent = "Fehler beim Bestätigen: " + (updateError.message || "Bitte erneut versuchen.");
      return;
    }

    adminMessage.textContent = "Reservierung bestätigt. Sende Bestätigungs-E-Mail …";

    try {
      const { data: fnData, error: fnError } = await supabaseClient.functions.invoke("resend-email", {
        body: { reservation_id: payload.id },
      });

      if (fnError) {
        console.error("resend-email fnError:", fnError, fnData);
        const detail = (fnData && (fnData.error || fnData.details || fnData.message)) || fnError.message || String(fnError);
        adminMessage.textContent = "Reservierung ist bestätigt. E-Mail konnte nicht gesendet werden: " + detail;
        return;
      }

      adminMessage.textContent = "Reservierung bestätigt und Bestätigungs-E-Mail gesendet.";
      loadReservationsForDateRange();
    } catch (invokeErr) {
      console.error("Edge-Function-Aufruf fehlgeschlagen:", invokeErr);
      adminMessage.textContent = "Reservierung ist bestätigt. Edge-Function-Aufruf fehlgeschlagen: " + (invokeErr.message || String(invokeErr));
    }
  }

  async function rejectReservation(payload) {
    if (!adminMessage) return;
    adminMessage.textContent = "Lehne Reservierung ab …";

    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !sessionData?.session) {
      adminMessage.textContent = "Du bist nicht mehr angemeldet. Bitte neu einloggen und erneut versuchen.";
      return;
    }

    const { error: updateError } = await supabaseClient
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", payload.id);

    if (updateError) {
      console.error(updateError);
      adminMessage.textContent = "Fehler beim Ablehnen: " + (updateError.message || "Bitte erneut versuchen.");
      return;
    }

    adminMessage.textContent = "Reservierung abgelehnt. Sende Benachrichtigung an Kunden …";

    try {
      const { data: fnData, error: fnError } = await supabaseClient.functions.invoke("resend-email", {
        body: { reservation_id: payload.id, type: "rejection" },
      });

      if (fnError) {
        console.error("resend-email fnError:", fnError, fnData);
        const detail = (fnData && (fnData.error || fnData.details || fnData.message)) || fnError.message || String(fnError);
        adminMessage.textContent = "Reservierung wurde abgelehnt. E-Mail konnte nicht gesendet werden: " + detail;
        return;
      }

      adminMessage.textContent = "Reservierung abgelehnt und Kunde per E-Mail benachrichtigt.";
      loadReservationsForDateRange();
    } catch (invokeErr) {
      console.error("Edge-Function-Aufruf fehlgeschlagen:", invokeErr);
      adminMessage.textContent = "Reservierung wurde abgelehnt. Edge-Function-Aufruf fehlgeschlagen: " + (invokeErr.message || String(invokeErr));
    }
  }

  function openConfirmModal(text, options) {
    const title = options?.title || "Bist du sicher?";
    const okLabel = options?.okLabel || "Ja, bestätigen";
    return new Promise((resolve) => {
      const overlay = document.getElementById("confirm-modal-overlay");
      const titleEl = document.getElementById("confirm-modal-title");
      const textEl = document.getElementById("confirm-modal-text");
      const cancelBtn = document.getElementById("confirm-modal-cancel");
      const okBtn = document.getElementById("confirm-modal-ok");
      if (!overlay || !titleEl || !textEl || !cancelBtn || !okBtn) { resolve(false); return; }

      titleEl.textContent = title;
      textEl.textContent = text;
      okBtn.textContent = okLabel;
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");

      function close(result) {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        cancelBtn.removeEventListener("click", onCancel);
        okBtn.removeEventListener("click", onOk);
        overlay.removeEventListener("click", onOverlayClick);
        window.removeEventListener("keydown", onKeydown);
        resolve(result);
      }
      function onCancel() { close(false); }
      function onOk() { close(true); }
      function onOverlayClick(e) { if (e.target === overlay) close(false); }
      function onKeydown(e) { if (e.key === "Escape") close(false); }

      cancelBtn.addEventListener("click", onCancel);
      okBtn.addEventListener("click", onOk);
      overlay.addEventListener("click", onOverlayClick);
      window.addEventListener("keydown", onKeydown);
    });
  }

  function openInfoModal(payload) {
    const overlay = document.getElementById("info-modal-overlay");
    const basicEl = document.getElementById("info-modal-basic");
    const contactEl = document.getElementById("info-modal-contact");
    const notesEl = document.getElementById("info-modal-notes");
    const closeBtn = document.getElementById("info-modal-close");
    if (!overlay || !basicEl || !contactEl || !notesEl || !closeBtn) return;

    const party = payload.partySize != null ? payload.partySize : "—";
    basicEl.textContent = `${payload.name || "Gast"} • ${payload.date || "—"} • ${payload.time || "—"} • ${payload.area || "—"} • ${party} Person(en)`;

    const contactParts = [];
    if (payload.email) contactParts.push(`E-Mail: ${payload.email}`);
    if (payload.phone) contactParts.push(`Telefon: ${payload.phone}`);
    contactEl.textContent = contactParts.length > 0 ? contactParts.join("  •  ") : "Keine Kontaktdaten hinterlegt.";

    notesEl.innerHTML = payload.notes
      ? `<span class="modal-notes-label">Besondere Wünsche</span>${payload.notes}`
      : `<span class="modal-notes-label">Besondere Wünsche</span>Keine besonderen Wünsche angegeben.`;

    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");

    function close() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      closeBtn.removeEventListener("click", onClose);
      overlay.removeEventListener("click", onOverlayClick);
      window.removeEventListener("keydown", onKeydown);
    }
    function onClose() { close(); }
    function onOverlayClick(e) { if (e.target === overlay) close(); }
    function onKeydown(e) { if (e.key === "Escape") close(); }

    closeBtn.addEventListener("click", onClose);
    overlay.addEventListener("click", onOverlayClick);
    window.addEventListener("keydown", onKeydown);
  }

  // --- Login ---
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!loginMessage || !dashboard) return;

      const emailInput = document.getElementById("admin-email");
      const passwordInput = document.getElementById("admin-password");
      const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
      const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : "";

      if (!email || !password) {
        loginMessage.textContent = "Bitte E-Mail und Passwort eingeben.";
        return;
      }

      loginMessage.textContent = "Anmeldung läuft ...";

      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        console.error(error);
        loginMessage.textContent = "Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.";
        return;
      }

      loginMessage.textContent = "Erfolgreich angemeldet.";
      dashboard.style.display = "block";
      if (logoutBtn) logoutBtn.classList.add("is-visible");
      setToday();
      loadBusinessSettings(true);
      loadReservationsForDateRange();
    });
  }

  // --- Logout ---
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      dashboard.style.display = "none";
      logoutBtn.classList.remove("is-visible");
      if (tableBody) tableBody.innerHTML = "";
      if (adminMessage) adminMessage.textContent = "";
      if (loginMessage) loginMessage.textContent = "Du wurdest erfolgreich abgemeldet.";
      const emailInput = document.getElementById("admin-email");
      const passwordInput = document.getElementById("admin-password");
      if (emailInput instanceof HTMLInputElement) emailInput.value = "";
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = "";
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => loadReservationsForDateRange());
  }

  // --- Reservierungen sperren/freigeben ---
  if (availabilityBtn) {
    availabilityBtn.addEventListener("click", async () => {
      if (!adminMessage) return;
      availabilityBtn.disabled = true;
      adminMessage.textContent = "Aktualisiere, ob Online-Reservierungen möglich sind …";

      try {
        const nextValue = !reservationsOpen;

        if (!nextValue) {
          const confirmed = await openConfirmModal(
            "Möchtest du die Online-Reservierung wirklich deaktivieren? Gäste können dann keine Plätze mehr online reservieren.",
            { title: "Reservierungen sperren?", okLabel: "Ja, sperren" }
          );
          if (!confirmed) {
            adminMessage.textContent = "Deaktivierung der Online-Reservierung wurde abgebrochen.";
            availabilityBtn.disabled = false;
            return;
          }
        }

        if (!businessSettingsId) {
          const { data, error } = await supabaseClient
            .from("business_settings")
            .insert([{ reservations_open: nextValue }])
            .select("id, reservations_open")
            .single();
          if (error) throw error;
          businessSettingsId = data.id;
          reservationsOpen = data.reservations_open !== false;
        } else {
          const { data, error } = await supabaseClient
            .from("business_settings")
            .update({ reservations_open: nextValue })
            .eq("id", businessSettingsId)
            .select("id, reservations_open")
            .single();
          if (error) throw error;
          reservationsOpen = data.reservations_open !== false;
        }

        updateAvailabilityButtonLabel();
        adminMessage.textContent = reservationsOpen
          ? "Online-Reservierung ist jetzt wieder möglich."
          : "Online-Reservierung wurde gesperrt (alle Plätze belegt).";
      } catch (error) {
        console.error(error);
        adminMessage.textContent = "Fehler beim Aktualisieren der Online-Reservierung. Bitte später erneut versuchen.";
      } finally {
        availabilityBtn.disabled = false;
      }
    });
  }

  // --- Tabellen-Klicks (Info / Bestätigen) ---
  if (tableBody) {
    tableBody.addEventListener("click", (e) => {
      const infoBtn = e.target.closest(".admin-btn-info");
      const confirmBtn = e.target.closest(".admin-btn-confirm");

      if (infoBtn) {
        const id = infoBtn.getAttribute("data-reservation-id");
        if (!id) return;
        openInfoModal({
          id: Number(id),
          date: infoBtn.getAttribute("data-date") || "",
          time: infoBtn.getAttribute("data-time") || "",
          area: infoBtn.getAttribute("data-area") || "",
          partySize: Number(infoBtn.getAttribute("data-party-size")) || null,
          name: infoBtn.getAttribute("data-name") || "",
          email: infoBtn.getAttribute("data-email") || "",
          phone: infoBtn.getAttribute("data-phone") || "",
          notes: infoBtn.getAttribute("data-notes") || "",
        });
        return;
      }

      if (confirmBtn) {
        const id = confirmBtn.getAttribute("data-reservation-id");
        if (!id) return;

        const name = confirmBtn.getAttribute("data-name") || "";
        const displayName = name || "Gast";
        confirmBtn.disabled = true;

        openConfirmModal(
          `Möchtest du die Reservierung von ${displayName} wirklich bestätigen? Es wird eine Bestätigungs-E-Mail an den Kunden gesendet.`,
          { title: "Reservierung bestätigen?", okLabel: "Ja, bestätigen" }
        ).then((confirmed) => {
          if (!confirmed) { confirmBtn.disabled = false; return; }

          const partySizeAttr = confirmBtn.getAttribute("data-party-size") || "";
          confirmReservation({
            id,
            email: confirmBtn.getAttribute("data-email") || "",
            name,
            reservationAt: confirmBtn.getAttribute("data-reservation-at") || "",
            areaLabel: confirmBtn.getAttribute("data-area-label") || "",
            partySize: partySizeAttr ? Number(partySizeAttr) : null,
          }).finally(() => { confirmBtn.disabled = false; });
        });
      }

      const rejectBtn = e.target.closest(".admin-btn-reject");
      if (rejectBtn) {
        const id = rejectBtn.getAttribute("data-reservation-id");
        if (!id) return;

        const name = rejectBtn.getAttribute("data-name") || "";
        const displayName = name || "Gast";
        rejectBtn.disabled = true;

        openConfirmModal(
          `Möchtest du die Reservierung von ${displayName} wirklich ablehnen? Der Kunde wird per E-Mail benachrichtigt.`,
          { title: "Reservierung ablehnen?", okLabel: "Ja, ablehnen" }
        ).then((confirmed) => {
          if (!confirmed) { rejectBtn.disabled = false; return; }

          rejectReservation({ id }).finally(() => { rejectBtn.disabled = false; });
        });
      }
    });
  }
});
