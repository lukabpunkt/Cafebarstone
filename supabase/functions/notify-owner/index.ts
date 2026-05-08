// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// E-Mail-Adresse des Ladenbesitzers – vor dem Go-Live anpassen
const OWNER_EMAIL = "luka.bloemendal@gmx.de";

const ALLOWED_ORIGINS = [
  "https://lukabpunkt.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function buildOwnerNotificationHtml(p: {
  salutation: string;
  name: string;
  email: string;
  phone: string;
  dateStr: string;
  timeStr: string;
  areaLabel: string;
  partySize: string | number;
  notes: string;
}): string {
  const row = (label: string, value: string) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#c1bccf;width:38%;vertical-align:top;">${label}</td>
        <td style="padding:10px 0 10px 12px;border-bottom:1px solid rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#f7f3ea;font-weight:500;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`;

  const notesBlock =
    p.notes.trim().length > 0
      ? `<tr>
          <td style="padding:16px 20px 0 20px;" colspan="2">
            <p style="margin:0 0 6px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#c99b4b;">Besondere Wünsche</p>
            <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#c1bccf;border-left:3px solid rgba(201,155,75,0.55);padding:10px 14px;background-color:#080a0f;border-radius:0 10px 10px 0;">${escapeHtml(p.notes)}</p>
          </td>
        </tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Neue Reservierungsanfrage</title>
</head>
<body style="margin:0;padding:0;background-color:#07090c;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#07090c;">
    <tr>
      <td align="center" style="padding:28px 16px 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;">
          <tr>
            <td style="padding:0 4px 20px 4px;text-align:center;">
              <p style="margin:0 0 8px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#c99b4b;">Café Bar Stone · Lingen (Ems)</p>
              <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;font-weight:500;line-height:1.25;color:#f7f3ea;">Neue Reservierungsanfrage</h1>
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
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#c1bccf;">Ein Gast wartet auf die Bestätigung seiner Reservierung.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 4px 20px;">
                    <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c99b4b;">Reservierungsdetails</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      ${row("Datum", p.dateStr)}
                      ${row("Uhrzeit", p.timeStr)}
                      ${row("Bereich", p.areaLabel)}
                      ${row("Personen", String(p.partySize))}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 4px 20px;">
                    <p style="margin:0 0 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#c99b4b;">Kontaktdaten</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      ${row("Name", `${p.salutation} ${p.name}`.trim())}
                      ${row("E-Mail", p.email)}
                      ${row("Telefon", p.phone)}
                    </table>
                  </td>
                </tr>
                ${notesBlock}
                <tr>
                  <td style="padding:20px 20px 8px 20px;border-top:1px solid rgba(255,255,255,0.06);">
                    <a href="https://lukabpunkt.github.io/Cafebarstone/management-stone" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,rgba(201,155,75,0.95),rgba(230,185,110,0.98));color:#07090c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.04em;">Zum Admin-Dashboard</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 20px 24px 20px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#8a8499;">Diese Benachrichtigung wurde automatisch versendet, sobald ein Gast eine Reservierungsanfrage abgeschickt hat.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

    const salutation = String(body.salutation ?? "").trim();
    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const dateStr = String(body.date_str ?? "").trim();
    const timeStr = String(body.time_str ?? "").trim();
    const areaLabel = String(body.area_label ?? "").trim();
    const partySize = body.party_size ?? "—";
    const notes = String(body.notes ?? "").trim();

    if (!email || !dateStr || !timeStr) {
      return new Response(
        JSON.stringify({ error: "Pflichtfelder fehlen: email, date_str, time_str" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY fehlt");
      return new Response(
        JSON.stringify({ error: "E-Mail-Dienst nicht konfiguriert" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const name = [firstName, lastName].filter(Boolean).join(" ") || "Gast";
    const subject = `Neue Reservierungsanfrage – ${name} – ${dateStr}`;
    const html = buildOwnerNotificationHtml({
      salutation,
      name,
      email,
      phone,
      dateStr,
      timeStr,
      areaLabel,
      partySize,
      notes,
    });

    const text = [
      "Neue Reservierungsanfrage – Café Bar Stone",
      "",
      "Ein Gast wartet auf die Bestätigung seiner Reservierung.",
      "",
      "Reservierungsdetails:",
      `- Datum: ${dateStr}`,
      `- Uhrzeit: ${timeStr}`,
      `- Bereich: ${areaLabel}`,
      `- Personen: ${partySize}`,
      "",
      "Kontaktdaten:",
      `- Name: ${salutation} ${name}`.trim(),
      `- E-Mail: ${email}`,
      `- Telefon: ${phone}`,
      notes ? `\nBesondere Wünsche:\n${notes}` : "",
      "",
      "→ Zum Admin-Dashboard: https://lukabpunkt.github.io/Cafebarstone/management-stone",
    ]
      .filter((l) => l !== undefined)
      .join("\n");

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Café Bar Stone <reservierung@noreply.cafebarstone.de>",
        to: OWNER_EMAIL,
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
