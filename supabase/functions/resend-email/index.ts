// Läuft in Supabase Edge (Deno) – Cursor prüft als Node/TS, daher ts-nocheck
// @ts-nocheck
// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS: Erlaube Aufruf von deiner GitHub-Pages- und lokalen Entwicklung
// x-client-info wird vom Supabase-JS-Client gesendet und muss erlaubt sein
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://lukabpunkt.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // Preflight (OPTIONS) für CORS – Browser sendet das vor dem echten POST
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
    const dateStr = when
      ? when.toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";
    const timeStr = when
      ? when.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    const areaLabel =
      reservation.area === "smoking" ? "Raucherbereich" : "Nichtraucherbereich";
    const partySize = reservation.party_size ?? "—";

    const subject = "Bestätigung Ihrer Reservierung – Café Bar Stone";
    const html = `
      <h1>Ihre Reservierungsbestätigung</h1>
      <p>Hallo ${name},</p>
      <p>wir bestätigen hiermit Ihre Reservierung in der Café Bar Stone.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Datum: ${dateStr}</li>
        <li>Uhrzeit: ${timeStr}</li>
        <li>Bereich: ${areaLabel}</li>
        <li>Personen: ${partySize}</li>
      </ul>
      <p>Wir freuen uns auf Ihren Besuch!</p>
    `;

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
