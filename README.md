# Café Bar Stone – Platzbuchung

Website and admin dashboard for table reservations at Café Bar Stone.

## Contents

- **index.html** – Public booking page
- **admin.html** – Admin dashboard (login, view and confirm reservations, send confirmation emails)
- **script.js** / **styles.css** – Front-end logic and styles
- **\*.sql** – Supabase schema and RLS policies
- **Stonelogo.png**, **Watermark_white.png** – Assets

## Setup

1. Create a Supabase project and run the SQL scripts (schema, policies).
2. Deploy the `resend-email` Edge Function in Supabase and set `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Serve the folder via a web server (e.g. your host or `npx serve`) and open `index.html` / `admin.html`.

## Git

Initialized with Git; push to GitHub to keep code and images in version control.
