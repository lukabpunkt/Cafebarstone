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

/** E-Mail-sichere Ausgabe (XSS in HTML-Mail vermeiden) */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ConfirmationEmailParts = {
  name: string;
  dateStr: string;
  timeStr: string;
  areaLabel: string;
  partySize: string | number;
  notesBlock: string;
};

/**
 * HTML-Mail im Look der Reservierungsseite (dunkler Hintergrund, Gold-Akzent, System-Schrift).
 * Tabellen-Layout für gängige Mail-Clients.
 */
function buildConfirmationEmailHtml(parts: ConfirmationEmailParts): string {
  const { name, dateStr, timeStr, areaLabel, partySize, notesBlock } = parts;
  const safeName = escapeHtml(name);

  const detailRow = (
    label: string,
    value: string
  ) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#c1bccf;width:38%;vertical-align:top;">${label}</td>
        <td style="padding:10px 0 10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#f7f3ea;font-weight:500;vertical-align:top;">${escapeHtml(
          value
        )}</td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reservierungsbestätigung</title>
</head>
<body style="margin:0;padding:0;background-color:#07090c;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#07090c;background-image:linear-gradient(180deg,#0a0d12 0%,#07090c 45%,#050608 100%);">
    <tr>
      <td align="center" style="padding:28px 16px 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;">
          <tr>
            <td style="padding:0 4px 20px 4px;text-align:center;">
              <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#c99b4b;">Café Bar Stone · Lingen (Ems)</p>
              <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;font-weight:500;line-height:1.25;color:#f7f3ea;">Ihre Reservierung ist bestätigt</h1>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(135deg,rgba(201,155,75,0.95),rgba(230,185,110,0.98));border-radius:18px 18px 0 0;height:4px;line-height:4px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="background-color:#10131a;border:1px solid rgba(255,255,255,0.12);border-top:none;border-radius:0 0 18px 18px;box-shadow:0 24px 60px rgba(0,0,0,0.45);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:24px 20px 8px 20px;">
                    <p style="margin:0 0 14px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#c1bccf;">Hallo <span style="color:#f7f3ea;font-weight:500;">${safeName}</span>,</p>
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#c1bccf;">wir bestätigen hiermit Ihre Reservierung in der <strong style="color:#f7f3ea;font-weight:500;">Café Bar Stone</strong>.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 4px 20px;">
                    <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c99b4b;">Details</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      ${detailRow("Datum", dateStr)}
                      ${detailRow("Uhrzeit", timeStr)}
                      ${detailRow("Bereich", areaLabel)}
                      ${detailRow("Personen", String(partySize))}
                    </table>
                  </td>
                </tr>
                ${notesBlock}
                <tr>
                  <td style="padding:20px 20px 8px 20px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#f7f3ea;">Wir freuen uns auf Ihren Besuch!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 24px 20px;border-top:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0 0 4px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8499;">Café Bar Stone</p>
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8499;">Am Markt 26 · 49808 Lingen (Ems) · Tel. 0591 96656700</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0 8px;text-align:center;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#6b6578;">Diese Nachricht wurde automatisch versendet. Bitte antworten Sie nicht direkt auf diese E-Mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + ":"));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
  };
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

    if (!reservationId) {
      return new Response(
        JSON.stringify({ error: "reservation_id fehlt" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select(
        `
        id,
        reservation_at,
        area,
        party_size,
        special_requests,
        customers (
          first_name,
          last_name,
          email
        )
      `
      )
      .eq("id", reservationId)
      .single();

    if (fetchError || !reservation) {
      console.error("Reservierung laden:", fetchError);
      return new Response(
        JSON.stringify({ error: "Reservierung nicht gefunden" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const customer = reservation.customers as {
      first_name?: string;
      last_name?: string;
      email?: string;
    } | null;

    const email = customer?.email?.trim();
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Keine E-Mail-Adresse zum Kunden hinterlegt" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const name = [customer?.first_name, customer?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "Gast";

    const when = reservation.reservation_at
      ? new Date(reservation.reservation_at)
      : null;
    // Feste Zeitzone wie Bar-Standort (Edge-Runtime ist sonst UTC → Abweichung zur Admin-Ansicht im Browser)
    const tz = "Europe/Berlin";
    const dateStr = when
      ? when.toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: tz,
        })
      : "—";
    const timeStr = when
      ? when.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: tz,
        })
      : "—";

    const areaLabel =
      reservation.area === "smoking" ? "Raucherbereich" : "Nichtraucherbereich";
    const partySize = reservation.party_size ?? "—";
    const notesRaw = reservation.special_requests?.trim();
    const notesBlock =
      notesRaw && notesRaw.length > 0
        ? `
                <tr>
                  <td style="padding:16px 20px 0 20px;">
                    <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#c99b4b;">Ihre Angaben</p>
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#c1bccf;border-left:3px solid rgba(201,155,75,0.55);padding:10px 14px;background-color:#080a0f;border-radius:0 10px 10px 0;">${escapeHtml(
            notesRaw
          )}</p>
                  </td>
                </tr>`
        : "";

    const subject = "Bestätigung Ihrer Reservierung – Café Bar Stone";
    const html = buildConfirmationEmailHtml({
      name,
      dateStr,
      timeStr,
      areaLabel,
      partySize,
      notesBlock,
    });
    const text = [
      `Hallo ${name},`,
      "",
      "wir bestätigen hiermit Ihre Reservierung in der Café Bar Stone.",
      "",
      "Details:",
      `- Datum: ${dateStr}`,
      `- Uhrzeit: ${timeStr}`,
      `- Bereich: ${areaLabel}`,
      `- Personen: ${partySize}`,
      notesRaw ? `\nIhre Angaben:\n${notesRaw}` : "",
      "",
      "Wir freuen uns auf Ihren Besuch!",
      "",
      "Café Bar Stone · Am Markt 26 · 49808 Lingen (Ems)",
    ]
      .filter(Boolean)
      .join("\n");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY fehlt");
      return new Response(
        JSON.stringify({ error: "E-Mail-Dienst nicht konfiguriert" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Café Bar Stone <reservierung@noreply.cafebarstone.de>",
        to: email,
        subject,
        html,
        text,
      }),
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
