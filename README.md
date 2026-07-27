# Café Bar Stone – Website

Website der Café Bar Stone (Lingen/Ems): Online-Platzreservierung, Admin-Dashboard und ein Plinko-Shot-Minigame. Statisches Frontend (HTML/CSS/Vanilla-JS) + Supabase-Backend, gehostet über GitHub Pages.

## Seiten
- **index.html** – Öffentliche Reservierungsseite
- **plinko.html** – Plinko Shot-Game (Gäste spielen reihum, Shots werden verlost)
- **management-stone.html** – Internes Admin-Dashboard (Login, Reservierungen bestätigen/ablehnen, Reservierungen sperren, Plinko-Shots verwalten)
- **impressum.html**, **datenschutz.html** – Rechtstexte
- **404.html** – Fehlerseite

## Assets (`assets/`)
- `script.js` – Reservierungs-Frontend
- `admin.js` – Admin-Dashboard (Reservierungen)
- `admin-plinko.js` – Admin-Verwaltung der Plinko-Shots
- `plinko.js` / `plinko.css` – Plinko-Spiel
- `styles.css` – gemeinsame Styles/Design-Tokens
- Bilder: `Stonelogo.png`, `Watermark_white.png`, `hero.jpg`, `og-image.jpg`, Favicons

## Backend (`supabase/`)
- **migrations/** – DB-Schema, RLS-Policies, Trigger, Plinko-Tabellen
- **functions/** – drei Edge Functions:
  - `submit-reservation` – legt Kunde + Reservierung an (Service-Role, serverseitige Validierung)
  - `notify-owner` – benachrichtigt den Betreiber über neue Anfragen (per Resend)
  - `resend-email` – sendet Bestätigungs-/Ablehnungs-Mail an den Gast

Tabellen: `customers`, `reservations`, `reservations_log`, `business_settings`, `plinko_shots`.

## Setup / Deploy
1. Supabase-Projekt anlegen und die Migrationen anwenden (`supabase db push`).
2. Edge Functions deployen und Secrets setzen: `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`. Resend-Absenderdomain verifizieren.
3. Frontend via GitHub Pages ausliefern (Deploy aus `main`).

## Git
Version über GitHub (`github.com/lukabpunkt/Cafebarstone`), Live über GitHub Pages.
