document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const form = document.getElementById("reservation-form");
  const messageBox = document.getElementById("form-message");

  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const requiredFields = [
      "salutation",
      "persons",
      "firstName",
      "lastName",
      "email",
      "phone",
    ];

    let hasError = false;

    requiredFields.forEach((id) => {
      const field = document.getElementById(id);
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
        return;
      }

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
    });

    if (!messageBox) return;

    if (hasError) {
      messageBox.textContent =
        "Bitte überprüfen Sie Ihre Eingaben. Alle Pflichtfelder müssen korrekt ausgefüllt sein.";
      messageBox.className = "form-message visible error";
      return;
    }

    const formData = new FormData(form);
    const area = formData.get("area");

    const summary = [
      `Vielen Dank, ${formData.get("salutation")} ${formData.get("lastName")}.`,
      `Ihre Reservierungsanfrage für ${formData.get(
        "persons"
      )} Person(en) im Bereich "${area}" ist bei uns eingegangen.`,
      "Wir melden uns in Kürze zur Bestätigung per E-Mail oder telefonisch.",
    ].join(" ");

    messageBox.textContent = summary;
    messageBox.className = "form-message visible success";

    form.reset();
    const defaultArea = form.querySelector('input[name="area"][value="Nichtraucherbereich"]');
    if (defaultArea instanceof HTMLInputElement) {
      defaultArea.checked = true;
    }
  });
});

