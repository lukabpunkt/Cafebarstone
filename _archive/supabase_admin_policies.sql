-- RLS-Policies damit eingeloggte Admins Reservierungen lesen und bestätigen können.
-- Im Supabase-Dashboard: SQL Editor → dieses Skript ausführen.

-- WICHTIG: Ohne diese GRANTs bekommst du "permission denied for table reservations".
-- Die Rolle "authenticated" muss explizit Berechtigung auf die Tabellen bekommen.
GRANT SELECT, UPDATE ON public.reservations TO authenticated;
GRANT SELECT ON public.customers TO authenticated;

-- Reservierungen: Authentifizierte Nutzer dürfen lesen und Status aktualisieren
create policy reservations_select_authenticated
on public.reservations
for select
to authenticated
using (true);

create policy reservations_update_authenticated
on public.reservations
for update
to authenticated
using (true)
with check (true);

-- Optional: Damit die Admin-App die Kundendaten für die Tabelle laden kann
-- (falls customers bisher nur für anon insert erlaubt war)
create policy customers_select_authenticated
on public.customers
for select
to authenticated
using (true);
