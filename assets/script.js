document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // --- Hamburger nav ---
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

  // --- Reservation form ---
  const form = document.getElementById("reservation-form");
  const messageBox = document.getElementById("form-message");
  const closedBanner = document.getElementById("reservation-closed-banner");

  const dateField = document.getElementById("date");
  if (dateField instanceof HTMLInputElement) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    dateField.setAttribute("min", `${yyyy}-${mm}-${dd}`);
  }

  const timeField = document.getElementById("time");
  if (timeField instanceof HTMLInputElement) {
    timeField.setAttribute("min", "17:00");
    timeField.setAttribute("max", "20:00");
  }

  const phoneField = document.getElementById("phone");
  if (phoneField instanceof HTMLInputElement) {
    const stripInvalidPhoneChars = (raw) => raw.replace(/[^\d+()\s\-/.]/g, "");
    phoneField.addEventListener("input", () => {
      const cleaned = stripInvalidPhoneChars(phoneField.value);
      if (cleaned !== phoneField.value) phoneField.value = cleaned;
    });
  }

  let reservationsOpen = true;
  let openingDays = [4, 5, 6]; // Fallback: Do, Fr, Sa
  let openFromHour = 17;       // Fallback: 17:00
  let lastSlotHour = 20;       // Fallback: 20:00

  function isWithinOpeningHours(dateValue, timeValue) {
    if (!dateValue || !timeValue) {
      return {
        valid: false,
        message: "Bitte wählen Sie ein Datum und eine Uhrzeit innerhalb unserer Öffnungszeiten.",
      };
    }

    const reservationDate = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(reservationDate.getTime())) {
      return { valid: false, message: "Das ausgewählte Datum ist ungültig." };
    }

    const day = reservationDate.getDay();
    const [hoursStr, minutesStr] = String(timeValue).split(":");
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);

    if (!Number.isInteger(hours) || !Number.isInteger(minutes) ||
        hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return { valid: false, message: "Die ausgewählte Uhrzeit ist ungültig." };
    }

    const totalMinutes = hours * 60 + minutes;

    if (!openingDays.includes(day)) {
      const dayNames = { 0: "Sonntag", 1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag" };
      const openNames = openingDays.map((d) => dayNames[d]).join(", ");
      return { valid: false, message: `Reservierungen sind nur möglich an: ${openNames}.` };
    }

    if (totalMinutes < openFromHour * 60) {
      return { valid: false, message: `Reservierungen sind erst ab ${openFromHour}:00 Uhr möglich.` };
    }

    if (totalMinutes > lastSlotHour * 60) {
      return { valid: false, message: `Reservierungen sind nur bis ${lastSlotHour}:00 Uhr möglich.` };
    }

    return { valid: true };
  }

  function applyOpeningHoursToFields() {
    if (timeField instanceof HTMLInputElement) {
      timeField.setAttribute("min", `${String(openFromHour).padStart(2, "0")}:00`);
      timeField.setAttribute("max", `${String(lastSlotHour).padStart(2, "0")}:00`);
    }
  }

  async function refreshReservationStatus() {
    try {
      const { data, error } = await supabaseClient
        .from("business_settings")
        .select("reservations_open, open_days, open_from_hour, last_slot_hour")
        .limit(1);
      if (error) {
        console.error("business_settings:", error);
        return;
      }
      if (data && data.length > 0) {
        const s = data[0];
        reservationsOpen = s.reservations_open !== false;
        if (Array.isArray(s.open_days) && s.open_days.length > 0) openingDays = s.open_days;
        if (typeof s.open_from_hour === "number") openFromHour = s.open_from_hour;
        if (typeof s.last_slot_hour === "number") lastSlotHour = s.last_slot_hour;
      }
    } catch (err) {
      console.error(err);
    }

    applyOpeningHoursToFields();

    if (closedBanner) {
      if (reservationsOpen) {
        closedBanner.classList.add("is-hidden");
      } else {
        closedBanner.classList.remove("is-hidden");
      }
    }
  }

  refreshReservationStatus();

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!reservationsOpen) {
      if (messageBox) {
        messageBox.textContent =
          "Aktuell können online keine neuen Reservierungen entgegengenommen werden. Bitte versuchen Sie es später erneut.";
        messageBox.className = "form-message visible error";
      }
      return;
    }

    const requiredFields = [
      "salutation", "persons", "firstName", "lastName", "email", "phone", "date", "time",
    ];

    let hasError = false;

    requiredFields.forEach((id) => {
      const field = document.getElementById(id);
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;

      field.classList.remove("error");

      const value = field.value.trim();
      if (!value) {
        field.classList.add("error");
        hasError = true;
        return;
      }

      if (id === "persons") {
        const persons = Number(value);
        if (!Number.isFinite(persons) || persons < 1 || persons > 20) {
          field.classList.add("error");
          hasError = true;
        }
      }

      if (id === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          field.classList.add("error");
          hasError = true;
        }
      }

      if (id === "phone") {
        if (!/\d/.test(value)) {
          field.classList.add("error");
          hasError = true;
        }
      }
    });

    const dsgvoCheckbox = document.getElementById("dsgvo");
    if (dsgvoCheckbox) {
      dsgvoCheckbox.classList.remove("error");
      if (!dsgvoCheckbox.checked) {
        dsgvoCheckbox.classList.add("error");
        hasError = true;
      }
    }

    if (!messageBox) return;

    if (hasError) {
      const dsgvoMissing = dsgvoCheckbox && !dsgvoCheckbox.checked;
      messageBox.textContent = dsgvoMissing
        ? "Bitte stimmen Sie der Datenschutzerklärung zu, um die Reservierung abzusenden."
        : "Bitte überprüfen Sie Ihre Eingaben. Alle Pflichtfelder müssen korrekt ausgefüllt sein.";
      messageBox.className = "form-message visible error";
      return;
    }

    const honeypot = document.getElementById("website");
    if (honeypot && honeypot.value) {
      messageBox.textContent = "Vielen Dank für Ihre Anfrage. Wir melden uns in Kürze.";
      messageBox.className = "form-message visible success";
      form.reset();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Wird gesendet …";
    }

    const formData = new FormData(form);
    const salutation = formData.get("salutation");
    const firstName = formData.get("firstName");
    const lastName = formData.get("lastName");
    const email = formData.get("email");
    const phone = formData.get("phone");
    const personsRaw = formData.get("persons");
    const date = formData.get("date");
    const time = formData.get("time");
    const areaRaw = formData.get("area");
    const notes = formData.get("notes");

    const partySize = personsRaw ? Number(personsRaw) : null;
    const areaCode = areaRaw === "Raucherbereich" ? "smoking" : "non_smoking";

    const salutationMap = { Herr: "mr", Frau: "mrs", Divers: "divers" };
    const salutationDb = salutationMap[salutation] || salutationMap.Herr;

    let reservationDateTime = null;
    if (date && time) reservationDateTime = new Date(`${date}T${time}`);

    const openingHoursValidation = isWithinOpeningHours(date, time);
    if (!openingHoursValidation.valid) {
      messageBox.textContent = openingHoursValidation.message;
      messageBox.className = "form-message visible error";
      return;
    }

    try {
      const { data: submitData, error: submitError } = await supabaseClient.functions.invoke(
        "submit-reservation",
        {
          body: {
            salutation,
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            date,
            time,
            area: areaRaw,
            party_size: partySize,
            notes: notes ?? "",
          },
        }
      );

      if (submitError || !submitData?.ok) {
        let message = "Fehler beim Speichern der Reservierung. Bitte versuchen Sie es später erneut.";
        if (submitError && typeof submitError.context?.json === "function") {
          try {
            const errBody = await submitError.context.json();
            if (errBody && errBody.error) message = errBody.error;
          } catch {}
        } else if (submitData && submitData.error) {
          message = submitData.error;
        } else if (submitError && submitError.message) {
          message = submitError.message;
        }
        messageBox.textContent = message;
        messageBox.className = "form-message visible error";
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Anfrage senden"; }
        return;
      }

      const summary = [
        `Vielen Dank, ${salutation} ${lastName}.`,
        `Ihre Reservierungsanfrage für ${partySize} Person(en) im Bereich "${areaRaw}" ist bei uns eingegangen.`,
        "Wir melden uns in Kürze zur Bestätigung per E-Mail oder telefonisch.",
      ].join(" ");

      messageBox.textContent = summary;
      messageBox.className = "form-message visible success";
      form.reset();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Anfrage senden"; }

      const defaultArea = form.querySelector('input[name="area"][value="Nichtraucherbereich"]');
      if (defaultArea instanceof HTMLInputElement) defaultArea.checked = true;

      // Ladenbesitzer per E-Mail über neue Anfrage informieren (fire-and-forget)
      const reservationDate = new Date(`${date}T${time}`);
      const tz = "Europe/Berlin";
      supabaseClient.functions.invoke("notify-owner", {
        body: {
          salutation,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          date_str: reservationDate.toLocaleDateString("de-DE", {
            weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz,
          }),
          time_str: reservationDate.toLocaleTimeString("de-DE", {
            hour: "2-digit", minute: "2-digit", timeZone: tz,
          }),
          area_label: areaRaw,
          party_size: partySize,
          notes: notes ?? "",
        },
      }).catch((err) => console.error("notify-owner:", err));
    } catch (error) {
      console.error(error);
      messageBox.textContent = "Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es später erneut.";
      messageBox.className = "form-message visible error";
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Anfrage senden"; }
    }
  });
});
