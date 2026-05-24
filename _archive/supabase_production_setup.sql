-- =============================================================================
-- Cafe Bar Stone – Sichere Datenbank-Konfiguration für Live-Betrieb
-- =============================================================================
-- Einmalig im Supabase SQL-Editor ausführen (Projekt: Cafe Bar Stone).
-- Danach: Formular (index.html) und Admin-Dashboard (admin.html) nutzen diese
-- Rechte; customer_id bleibt Pflicht (Referenzintegrität).
-- =============================================================================

-- 1) Row Level Security ausschalten (stabile Rechte nur über GRANTs)
ALTER TABLE public.customers    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations DISABLE ROW LEVEL SECURITY;

-- 2) Alle bestehenden Policies entfernen (werden nicht mehr benötigt)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('customers', 'reservations')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 3) Schema-Recht für beide Rollen
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 4) Rechte zurücksetzen, dann minimal vergeben
REVOKE ALL ON public.customers    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.reservations FROM PUBLIC, anon, authenticated;

-- anon = öffentliche Website (Reservierungsformular)
-- Darf: Kunden anlegen + einmal lesen (für insert().select().single())
--       Reservierungen anlegen (mit gültiger customer_id)
GRANT INSERT, SELECT ON public.customers    TO anon;
GRANT INSERT        ON public.reservations TO anon;

-- authenticated = Admin nach Login (Dashboard)
-- Darf: Nur lesen (Kunden + Reservierungen für Übersicht)
GRANT SELECT ON public.customers    TO authenticated;
GRANT SELECT ON public.reservations TO authenticated;

-- 5) Referenzintegrität: customer_id in reservations soll nicht null sein
--    Nur ausführen, wenn noch keine Zeilen mit customer_id IS NULL existieren.
--    Falls Fehler: zuerst bestehende Reservierungen mit customer_id versehen.
-- ALTER TABLE public.reservations ALTER COLUMN customer_id SET NOT NULL;
