// Läuft in Supabase Edge (Deno) – Cursor prüft als Node/TS, daher ts-nocheck
// @ts-nocheck
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  "https://lukabpunkt.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + ":"));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
  };
}

const F = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const detailRow = (label: string, value: string) => `
  <tr>
    <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.07);font-family:${F};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#7e7a8f;width:36%;vertical-align:middle;">${label}</td>
    <td style="padding:12px 0 12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);font-family:${F};font-size:15px;color:#f0ecdf;font-weight:500;vertical-align:middle;">${escapeHtml(value)}</td>
  </tr>`;

const emailShell = (accentGradient: string, header: string, body: string) => `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${header}</title>
</head>
<body style="margin:0;padding:0;background-color:#07090c;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#07090c;">
    <tr><td align="center" style="padding:36px 16px 48px;">

      <!-- Wrapper -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;">

        <!-- Logo-Bereich -->
        <tr><td style="padding:0 0 28px;text-align:center;">
          <p style="margin:0 0 6px;font-family:${F};font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#c99b4b;">Café Bar Stone</p>
          <p style="margin:0;font-family:${F};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#4a4658;">Lingen (Ems)</p>
        </td></tr>

        <!-- Karte -->
        <tr><td style="border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.09);box-shadow:0 32px 80px rgba(0,0,0,0.6);">

          <!-- Akzentbalken -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td style="background:${accentGradient};height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
          </table>

          <!-- Karteninhalt -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0d1018;">
            ${body}
          </table>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:28px 0 0;text-align:center;border-top:0;">
          <p style="margin:0 0 6px;font-family:${F};font-size:12px;color:#4a4658;letter-spacing:0.04em;">Café Bar Stone · Am Markt 26 · 49808 Lingen (Ems)</p>
          <p style="margin:0 0 16px;font-family:${F};font-size:12px;color:#4a4658;">Tel. 0591 96656700</p>
          <p style="margin:0;font-family:${F};font-size:10px;color:#312e3d;letter-spacing:0.04em;">Diese Nachricht wurde automatisch versendet – bitte nicht direkt antworten.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

function buildConfirmationEmailHtml(parts: {
  name: string; dateStr: string; timeStr: string;
  areaLabel: string; partySize: string | number; notesBlock: string;
}): string {
  const { name, dateStr, timeStr, areaLabel, partySize, notesBlock } = parts;

  const body = `
    <!-- Begrüßung -->
    <tr><td style="padding:36px 32px 0;">
      <p style="margin:0 0 6px;font-family:${F};font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:#c99b4b;">Reservierungsbestätigung</p>
      <h1 style="margin:0 0 20px;font-family:${F};font-size:26px;font-weight:400;line-height:1.2;color:#f0ecdf;">Ihr Abend im Stone<br>ist gesichert.</h1>
      <p style="margin:0;font-family:${F};font-size:15px;line-height:1.75;color:#9390a0;">Liebe/r <span style="color:#f0ecdf;font-weight:500;">${escapeHtml(name)}</span>, herzlichen Dank für Ihre Reservierung – wir haben Ihren Platz soeben für Sie reserviert und freuen uns sehr, Sie bald bei uns begrüßen zu dürfen.</p>
    </td></tr>

    <!-- Trennlinie -->
    <tr><td style="padding:28px 32px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td style="height:1px;background:linear-gradient(90deg,rgba(201,155,75,0.4) 0%,rgba(201,155,75,0.08) 100%);line-height:1px;font-size:0;">&nbsp;</td></tr>
      </table>
    </td></tr>

    <!-- Details -->
    <tr><td style="padding:20px 32px 0;">
      <p style="margin:0 0 4px;font-family:${F};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#c99b4b;">Ihre Reservierung</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${detailRow("Datum", dateStr)}
        ${detailRow("Uhrzeit", timeStr)}
        ${detailRow("Bereich", areaLabel)}
        ${detailRow("Personenanzahl", String(partySize))}
      </table>
    </td></tr>

    ${notesBlock}

    <!-- Abschluss -->
    <tr><td style="padding:28px 32px 0;">
      <p style="margin:0;font-family:${F};font-size:15px;line-height:1.75;color:#9390a0;">Sollte sich etwas an Ihrer Planung ändern, melden Sie sich gerne direkt bei uns – wir helfen Ihnen unkompliziert weiter.</p>
    </td></tr>

    <!-- Signatur -->
    <tr><td style="padding:28px 32px 36px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr><td style="border-left:2px solid rgba(201,155,75,0.5);padding:2px 0 2px 14px;">
          <p style="margin:0 0 2px;font-family:${F};font-size:14px;color:#f0ecdf;font-weight:500;">Bis bald im Stone.</p>
          <p style="margin:0;font-family:${F};font-size:13px;color:#6b6578;">Ihr Team der Café Bar Stone</p>
        </td></tr>
      </table>
    </td></tr>`;

  return emailShell(
    "linear-gradient(90deg, #c99b4b 0%, #e6b96e 50%, #c99b4b 100%)",
    "Ihre Reservierung ist bestätigt – Café Bar Stone",
    body
  );
}

function buildRejectionEmailHtml(parts: {
  name: string; dateStr: string; timeStr: string;
  areaLabel: string; partySize: string | number;
}): string {
  const { name, dateStr, timeStr, areaLabel, partySize } = parts;

  const body = `
    <!-- Begrüßung -->
    <tr><td style="padding:36px 32px 0;">
      <p style="margin:0 0 6px;font-family:${F};font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:#c99b4b;">Zu Ihrer Anfrage</p>
      <h1 style="margin:0 0 20px;font-family:${F};font-size:26px;font-weight:400;line-height:1.2;color:#f0ecdf;">Wir bedauern es<br>sehr.</h1>
      <p style="margin:0 0 14px;font-family:${F};font-size:15px;line-height:1.75;color:#9390a0;">Liebe/r <span style="color:#f0ecdf;font-weight:500;">${escapeHtml(name)}</span>, vielen Dank, dass Sie sich für einen Abend in der Café Bar Stone entschieden haben – das bedeutet uns wirklich viel.</p>
      <p style="margin:0;font-family:${F};font-size:15px;line-height:1.75;color:#9390a0;">Leider müssen wir Ihnen mitteilen, dass wir Ihren Wunschtermin nicht mehr bestätigen können – zum gewählten Zeitpunkt sind keine Plätze mehr verfügbar.</p>
    </td></tr>

    <!-- Trennlinie -->
    <tr><td style="padding:28px 32px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr><td style="height:1px;background:linear-gradient(90deg,rgba(201,155,75,0.4) 0%,rgba(201,155,75,0.08) 100%);line-height:1px;font-size:0;">&nbsp;</td></tr>
      </table>
    </td></tr>

    <!-- Details -->
    <tr><td style="padding:20px 32px 0;">
      <p style="margin:0 0 4px;font-family:${F};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#c99b4b;">Ihre Anfrage</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        ${detailRow("Datum", dateStr)}
        ${detailRow("Uhrzeit", timeStr)}
        ${detailRow("Bereich", areaLabel)}
        ${detailRow("Personenanzahl", String(partySize))}
      </table>
    </td></tr>

    <!-- Einladung zur neuen Anfrage -->
    <tr><td style="padding:28px 32px 0;">
      <p style="margin:0;font-family:${F};font-size:15px;line-height:1.75;color:#9390a0;">Wir würden uns sehr freuen, wenn Sie es zu einem anderen Termin noch einmal bei uns versuchen würden. Über unsere Website können Sie jederzeit eine neue Anfrage stellen – wir tun unser Bestes, Ihnen schnellstmöglich einen schönen Abend zu ermöglichen.</p>
    </td></tr>

    <!-- Signatur -->
    <tr><td style="padding:28px 32px 36px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr><td style="border-left:2px solid rgba(201,155,75,0.5);padding:2px 0 2px 14px;">
          <p style="margin:0 0 2px;font-family:${F};font-size:14px;color:#f0ecdf;font-weight:500;">Auf ein baldiges Wiedersehen.</p>
          <p style="margin:0;font-family:${F};font-size:13px;color:#6b6578;">Ihr Team der Café Bar Stone</p>
        </td></tr>
      </table>
    </td></tr>`;

  return emailShell(
    "linear-gradient(90deg, rgba(180,60,60,0.9) 0%, rgba(210,90,90,0.95) 50%, rgba(180,60,60,0.9) 100%)",
    "Ihre Reservierungsanfrage – Café Bar Stone",
    body
  );
}

Deno.serve(async (req) => {
  const CORS_HEADERS = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }

  try {
    const body = await req.json();
    const reservationId = body.reservation_id;
    const type: "confirmation" | "rejection" = body.type === "rejection" ? "rejection" : "confirmation";

    if (!reservationId) {
      return new Response(
        JSON.stringify({ error: "reservation_id fehlt" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select(`id, reservation_at, area, party_size, special_requests, customers (first_name, last_name, email)`)
      .eq("id", reservationId)
      .single();

    if (fetchError || !reservation) {
      console.error("Reservierung laden:", fetchError);
      return new Response(
        JSON.stringify({ error: "Reservierung nicht gefunden" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const customer = reservation.customers as { first_name?: string; last_name?: string; email?: string } | null;
    const email = customer?.email?.trim();
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Keine E-Mail-Adresse zum Kunden hinterlegt" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim() || "Gast";
    const tz = "Europe/Berlin";
    const when = reservation.reservation_at ? new Date(reservation.reservation_at) : null;
    const dateStr = when ? when.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz }) : "—";
    const timeStr = when ? when.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : "—";
    const areaLabel = reservation.area === "smoking" ? "Raucherbereich" : "Nichtraucherbereich";
    const partySize = reservation.party_size ?? "—";

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY fehlt");
      return new Response(
        JSON.stringify({ error: "E-Mail-Dienst nicht konfiguriert" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    let subject: string;
    let html: string;
    let text: string;

    if (type === "rejection") {
      subject = "Ihre Reservierungsanfrage – Café Bar Stone";
      html = buildRejectionEmailHtml({ name, dateStr, timeStr, areaLabel, partySize });
      text = [
        `Liebe/r ${name},`,
        "",
        "vielen Dank, dass Sie sich für einen Abend in der Café Bar Stone entschieden haben – das bedeutet uns wirklich viel.",
        "",
        "Leider müssen wir Ihnen mitteilen, dass wir Ihren Wunschtermin nicht mehr bestätigen können. Zum gewählten Zeitpunkt sind keine Plätze mehr verfügbar.",
        "",
        "Ihre Anfrage:",
        `  Datum:          ${dateStr}`,
        `  Uhrzeit:        ${timeStr}`,
        `  Bereich:        ${areaLabel}`,
        `  Personenanzahl: ${partySize}`,
        "",
        "Wir würden uns sehr freuen, wenn Sie es zu einem anderen Termin noch einmal bei uns versuchen würden. Über unsere Website können Sie jederzeit eine neue Anfrage stellen.",
        "",
        "Auf ein baldiges Wiedersehen.",
        "Ihr Team der Café Bar Stone",
        "",
        "Café Bar Stone · Am Markt 26 · 49808 Lingen (Ems) · Tel. 0591 96656700",
      ].join("\n");
    } else {
      const notesRaw = reservation.special_requests?.trim();
      const notesBlock = notesRaw && notesRaw.length > 0
        ? `<tr><td style="padding:20px 32px 0;">
              <p style="margin:0 0 8px;font-family:${F};font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#c99b4b;">Ihre besonderen Wünsche</p>
              <p style="margin:0;font-family:${F};font-size:14px;line-height:1.7;color:#9390a0;border-left:2px solid rgba(201,155,75,0.4);padding:10px 16px;background:rgba(201,155,75,0.04);border-radius:0 8px 8px 0;">${escapeHtml(notesRaw)}</p>
           </td></tr>`
        : "";
      subject = "Bestätigung Ihrer Reservierung – Café Bar Stone";
      html = buildConfirmationEmailHtml({ name, dateStr, timeStr, areaLabel, partySize, notesBlock });
      text = [
        `Liebe/r ${name},`,
        "",
        "herzlichen Dank für Ihre Reservierung – wir haben Ihren Platz soeben für Sie reserviert und freuen uns sehr, Sie bald bei uns begrüßen zu dürfen.",
        "",
        "Ihre Reservierung:",
        `  Datum:          ${dateStr}`,
        `  Uhrzeit:        ${timeStr}`,
        `  Bereich:        ${areaLabel}`,
        `  Personenanzahl: ${partySize}`,
        notesRaw ? `\nIhre besonderen Wünsche:\n  ${notesRaw}` : "",
        "",
        "Sollte sich etwas an Ihrer Planung ändern, melden Sie sich gerne direkt bei uns – wir helfen Ihnen unkompliziert weiter.",
        "",
        "Bis bald im Stone.",
        "Ihr Team der Café Bar Stone",
        "",
        "Café Bar Stone · Am Markt 26 · 49808 Lingen (Ems) · Tel. 0591 96656700",
      ].filter(Boolean).join("\n");
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: "Café Bar Stone <reservierung@noreply.cafebarstone.de>", to: email, subject, html, text }),
    });

    const resendData = await resendRes.json();
    if (!resendRes.ok) {
      console.error("Resend:", resendData);
      return new Response(
        JSON.stringify({ error: "E-Mail-Versand fehlgeschlagen", details: resendData }),
        { status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    return new Response(JSON.stringify(resendData), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Interner Fehler" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
});
