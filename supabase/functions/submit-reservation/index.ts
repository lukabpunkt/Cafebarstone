// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://lukabpunkt.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

const SALUTATION_MAP: Record<string, string> = {
  Herr: "mr",
  Frau: "mrs",
  Divers: "divers",
};

const AREA_MAP: Record<string, string> = {
  Raucherbereich: "smoking",
  Nichtraucherbereich: "non_smoking",
};

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

  if (!Number.isFinite(partySizeRaw) || partySizeRaw < 1 || partySizeRaw > 20) {
    return jsonError("Personenanzahl muss zwischen 1 und 20 liegen", 400, CORS_HEADERS);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) {
    return jsonError("Ungültiges Datum oder Uhrzeit", 400, CORS_HEADERS);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- Öffnungszeiten aus DB laden (Fallback auf hardcoded Werte) ---
  let openDays = [4, 5, 6];
  let openFromHour = 17;
  let lastSlotHour = 20;
  try {
    const { data: settings } = await supabase
      .from("business_settings")
      .select("open_days, open_from_hour, last_slot_hour")
      .limit(1)
      .single();
    if (settings) {
      if (Array.isArray(settings.open_days) && settings.open_days.length > 0) openDays = settings.open_days;
      if (typeof settings.open_from_hour === "number") openFromHour = settings.open_from_hour;
      if (typeof settings.last_slot_hour === "number") lastSlotHour = settings.last_slot_hour;
    }
  } catch {}

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

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
});
