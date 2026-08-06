// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://cafebarstone.de",
  "https://www.cafebarstone.de",
  "http://localhost",
  "http://127.0.0.1",
];

const ADMIN_URL = "https://cafebarstone.de/management-stone.html";

const SALUTATION_MAP: Record<string, string> = {
  Herr: "mr",
  Frau: "mrs",
  Divers: "divers",
};

const AREA_MAP: Record<string, string> = {
  Raucherbereich: "smoking",
  Nichtraucherbereich: "non_smoking",
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildOwnerEmailHtml(p: {
  name: string; email: string; phone: string; dateStr: string;
  timeStr: string; areaLabel: string; partySize: number; notes: string; dateIso: string;
}): string {
  const adminLink = `${ADMIN_URL}?date=${encodeURIComponent(p.dateIso)}`;
  const row = (l: string, v: string) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);font:600 11px -apple-system,sans-serif;letter-spacing:0.1em;text-transform:uppercase;color:#c1bccf;width:38%;">${l}</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);font:15px -apple-system,sans-serif;color:#f7f3ea;">${escapeHtml(v)}</td></tr>`;
  const notesRow = p.notes
    ? `<tr><td colspan="2" style="padding:14px 0 0;"><p style="margin:0 0 6px;font:600 11px -apple-system,sans-serif;letter-spacing:0.12em;text-transform:uppercase;color:#c99b4b;">Besondere Wünsche</p><p style="margin:0;font:14px -apple-system,sans-serif;line-height:1.6;color:#c1bccf;border-left:3px solid rgba(201,155,75,0.5);padding:8px 12px;background:#080a0f;">${escapeHtml(p.notes)}</p></td></tr>`
    : "";
  return `<!DOCTYPE html><html lang="de"><body style="margin:0;background:#07090c;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#10131a;border:1px solid rgba(255,255,255,0.12);border-radius:16px;"><tr><td style="padding:22px 22px 6px;"><p style="margin:0 0 4px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#c99b4b;">Café Bar Stone · Lingen (Ems)</p><h1 style="margin:0;font-size:22px;font-weight:500;color:#f7f3ea;">Neue Reservierungsanfrage</h1></td></tr><tr><td style="padding:14px 22px 22px;"><table role="presentation" width="100%" style="border-collapse:collapse;">${row("Datum", p.dateStr)}${row("Uhrzeit", p.timeStr)}${row("Bereich", p.areaLabel)}${row("Personen", String(p.partySize))}${row("Name", p.name)}${row("E-Mail", p.email)}${row("Telefon", p.phone)}${notesRow}</table><table role="presentation" width="100%" style="margin:22px 0 0;"><tr><td align="center"><a href="${adminLink}" style="display:inline-block;background:#c99b4b;color:#0b0d12;font:600 15px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-decoration:none;padding:13px 30px;border-radius:10px;">Reservierung im Dashboard bestätigen &rarr;</a></td></tr></table><p style="margin:12px 0 0;font-size:12px;color:#8a8499;text-align:center;">Öffnet das Admin-Dashboard &ndash; einmalige Anmeldung nötig.</p></td></tr></table></body></html>`;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.some(
    (o) => origin === o || origin.startsWith(o + ":")
  );
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonError(message: string, status: number, corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}

Deno.serve(async (req) => {
  const CORS_HEADERS = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405, CORS_HEADERS);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Ungültiges JSON", 400, CORS_HEADERS);
  }

  // --- Eingaben lesen ---
  const salutationRaw = String(body.salutation ?? "").trim();
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const dateValue = String(body.date ?? "").trim();
  const timeValue = String(body.time ?? "").trim();
  const areaRaw = String(body.area ?? "").trim();
  const partySizeRaw = Number(body.party_size);
  const notes = String(body.notes ?? "").trim();

  // --- Basis-Validierung ---
  if (!salutationRaw || !firstName || !lastName || !email || !phone || !dateValue || !timeValue || !areaRaw) {
    return jsonError("Pflichtfelder fehlen", 400, CORS_HEADERS);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("Ungültige E-Mail-Adresse", 400, CORS_HEADERS);
  }

  if (!/\d/.test(phone)) {
    return jsonError("Ungültige Telefonnummer", 400, CORS_HEADERS);
  }

  if (!Number.isInteger(partySizeRaw) || partySizeRaw < 1 || partySizeRaw > 20) {
    return jsonError("Personenanzahl muss eine ganze Zahl zwischen 1 und 20 sein", 400, CORS_HEADERS);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) {
    return jsonError("Ungültiges Datum oder Uhrzeit", 400, CORS_HEADERS);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Öffnungszeiten & Status aus DB laden (Fallback auf hardcoded Werte) ---
  let openDays = [4, 5, 6];
  let openFromHour = 19;
  let lastSlotHour = 20;
  let reservationsOpen = true;
  try {
    const { data: settings } = await supabase
      .from("business_settings")
      .select("reservations_open, open_days, open_from_hour, last_slot_hour")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (settings) {
      if (settings.reservations_open === false) reservationsOpen = false;
      if (Array.isArray(settings.open_days) && settings.open_days.length > 0) openDays = settings.open_days;
      if (typeof settings.open_from_hour === "number") openFromHour = settings.open_from_hour;
      if (typeof settings.last_slot_hour === "number") lastSlotHour = settings.last_slot_hour;
    }
  } catch {}

  if (!reservationsOpen) {
    return jsonError("Online-Reservierungen sind derzeit nicht möglich. Bitte kontaktieren Sie uns direkt.", 403, CORS_HEADERS);
  }

  // --- Öffnungszeiten validieren ---
  const [hoursStr, minutesStr] = timeValue.split(":");
  const totalMinutes = Number(hoursStr) * 60 + Number(minutesStr);
  if (totalMinutes < openFromHour * 60 || totalMinutes > lastSlotHour * 60) {
    return jsonError(`Reservierungen sind nur von ${openFromHour}:00 bis ${lastSlotHour}:00 Uhr möglich.`, 400, CORS_HEADERS);
  }

  const dowFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Berlin" });
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dateForDow = new Date(`${dateValue}T12:00:00Z`);
  const dow = dowMap[dowFormatter.format(dateForDow)];
  if (!openDays.includes(dow)) {
    return jsonError("Reservierungen sind nur an den regulären Öffnungstagen möglich.", 400, CORS_HEADERS);
  }

  // --- Datum+Zeit als Europe/Berlin → UTC ---
  const localDateTimeStr = `${dateValue}T${timeValue}:00`;
  const tzOffsetMs = new Date(
    new Date(localDateTimeStr + "Z").toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  ).getTime() - new Date(localDateTimeStr + "Z").getTime();
  const reservationDateTime = new Date(new Date(localDateTimeStr + "Z").getTime() - tzOffsetMs);

  if (Number.isNaN(reservationDateTime.getTime())) {
    return jsonError("Ungültiges Datum oder Uhrzeit", 400, CORS_HEADERS);
  }

  if (reservationDateTime <= new Date()) {
    return jsonError("Reservierungen können nur für zukünftige Zeitpunkte erstellt werden. Bitte wählen Sie ein Datum in der Zukunft.", 400, CORS_HEADERS);
  }

  const salutationDb = SALUTATION_MAP[salutationRaw] ?? "mr";
  const areaCode = AREA_MAP[areaRaw] ?? "non_smoking";

  // --- Kunde anlegen oder bestehenden per E-Mail zurückgeben ---
  const { data: customers, error: customerError } = await supabase
    .from("customers")
    .upsert(
      [{ salutation: salutationDb, first_name: firstName, last_name: lastName, email, phone }],
      { onConflict: "email", ignoreDuplicates: false }
    )
    .select("id");

  if (customerError || !customers || customers.length === 0) {
    console.error("customers upsert:", customerError);
    return jsonError("Fehler beim Speichern der Kundendaten. Bitte später erneut versuchen.", 500, CORS_HEADERS);
  }

  const customerId = customers[0].id;

  // --- Reservierung anlegen ---
  const { error: reservationError } = await supabase
    .from("reservations")
    .insert([{
      customer_id: customerId,
      reservation_at: reservationDateTime.toISOString(),
      area: areaCode,
      party_size: partySizeRaw,
      special_requests: notes || null,
    }]);

  if (reservationError) {
    console.error("reservations insert:", reservationError);
    let userMessage = "Fehler beim Speichern der Reservierung. Bitte später erneut versuchen.";
    if (reservationError.code === "P0001" && reservationError.message) {
      if (reservationError.message.includes("Reservierungslimit")) {
        userMessage = "Sie haben das Reservierungslimit erreicht. Pro E-Mail-Adresse sind maximal 5 Reservierungen innerhalb von 24 Stunden möglich.";
      } else if (reservationError.message.includes("zukünftige")) {
        userMessage = "Reservierungen können nur für zukünftige Zeitpunkte erstellt werden.";
      } else {
        userMessage = reservationError.message;
      }
    }
    return jsonError(userMessage, 400, CORS_HEADERS);
  }

  // --- Betreiber serverseitig benachrichtigen (Fehler blockt die Buchung NICHT) ---
  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const OWNER_EMAIL = Deno.env.get("OWNER_EMAIL") ?? "stone.lingen@web.de";
    if (RESEND_API_KEY) {
      const tz = "Europe/Berlin";
      const dateStr = reservationDateTime.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz });
      const timeStr = reservationDateTime.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: tz });
      const areaLabel = areaCode === "smoking" ? "Raucherbereich" : "Nichtraucherbereich";
      const fullName = `${firstName} ${lastName}`.trim();
      const html = buildOwnerEmailHtml({ name: fullName, email, phone, dateStr, timeStr, areaLabel, partySize: partySizeRaw, notes, dateIso: dateValue });
      const adminLink = `${ADMIN_URL}?date=${encodeURIComponent(dateValue)}`;
      const text = `Neue Reservierungsanfrage – Café Bar Stone\n\nDatum: ${dateStr}\nUhrzeit: ${timeStr}\nBereich: ${areaLabel}\nPersonen: ${partySizeRaw}\nName: ${fullName}\nE-Mail: ${email}\nTelefon: ${phone}${notes ? `\n\nBesondere Wünsche:\n${notes}` : ""}\n\nZum Bestätigen im Dashboard: ${adminLink}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: "Café Bar Stone <reservierung@noreply.cafebarstone.de>",
          to: OWNER_EMAIL,
          subject: `Neue Reservierungsanfrage – ${fullName} – ${dateStr}`,
          html,
          text,
        }),
      });
    }
  } catch (e) {
    console.error("owner notify:", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
});
