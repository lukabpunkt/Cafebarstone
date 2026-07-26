-- ============================================================
-- Plinko-Minigame – Café Bar Stone
-- ============================================================
-- Legt die Tabelle für die vom Admin konfigurierbaren Shots an,
-- aktiviert RLS, setzt Policies + GRANTs und ergänzt einen
-- optionalen Ein/Aus-Schalter in business_settings.
-- Kann gefahrlos mehrfach ausgeführt werden (idempotent).
-- Berührt KEINE bestehenden Reservierungs-Tabellen/-Policies.
-- ============================================================


-- ============================================================
-- SCHRITT 1: Tabelle plinko_shots
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plinko_shots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL,
  description text,
  color       text,                       -- optionaler Slot-Farbton (#hex); sonst Gold-Default im Frontend
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0
);


-- ============================================================
-- SCHRITT 2: Optionaler Ein/Aus-Schalter fürs ganze Spiel
-- ============================================================

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS plinko_enabled boolean DEFAULT true;


-- ============================================================
-- SCHRITT 3: RLS aktivieren
-- ============================================================

ALTER TABLE public.plinko_shots ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SCHRITT 4: Bestehende Policies auf plinko_shots entfernen
-- ============================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plinko_shots'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.plinko_shots', pol.policyname);
  END LOOP;
END $$;


-- ============================================================
-- SCHRITT 5: GRANTs
-- ============================================================

REVOKE ALL ON public.plinko_shots FROM anon;
REVOKE ALL ON public.plinko_shots FROM authenticated;

-- anon (öffentlicher Besucher / Spieler): nur lesen
GRANT SELECT ON public.plinko_shots TO anon;

-- authenticated (eingeloggter Admin): volle Verwaltung
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plinko_shots TO authenticated;


-- ============================================================
-- SCHRITT 6: Policies – plinko_shots
-- ============================================================

-- anon darf nur AKTIVE Shots sehen
CREATE POLICY plinko_shots_select_anon
ON public.plinko_shots
FOR SELECT
TO anon
USING (active = true);

-- Admin darf alle Shots sehen (auch inaktive)
CREATE POLICY plinko_shots_select_authenticated
ON public.plinko_shots
FOR SELECT
TO authenticated
USING (true);

-- Admin darf Shots anlegen
CREATE POLICY plinko_shots_insert_authenticated
ON public.plinko_shots
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admin darf Shots ändern
CREATE POLICY plinko_shots_update_authenticated
ON public.plinko_shots
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Admin darf Shots löschen
CREATE POLICY plinko_shots_delete_authenticated
ON public.plinko_shots
FOR DELETE
TO authenticated
USING (true);


-- ============================================================
-- FERTIG!
-- ============================================================
