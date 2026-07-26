-- ============================================================
-- Plinko: Gewichtung + Spezial-Effekte
-- ============================================================
-- Additiv: zwei neue Spalten auf plinko_shots.
--   weight  – relative Trefferhäufigkeit (breiterer Slot = öfter)
--   effect  – 'normal' | 'double' (Doppelter Shot)
-- Keine Policy-Änderung nötig (anon SELECT / authenticated CRUD
-- gelten bereits für die ganze Tabelle). Idempotent.
-- ============================================================

ALTER TABLE public.plinko_shots
  ADD COLUMN IF NOT EXISTS weight numeric NOT NULL DEFAULT 1;

ALTER TABLE public.plinko_shots
  ADD COLUMN IF NOT EXISTS effect text NOT NULL DEFAULT 'normal';

-- Sicherheits-Guard: Gewicht immer positiv
ALTER TABLE public.plinko_shots
  DROP CONSTRAINT IF EXISTS plinko_shots_weight_positive;
ALTER TABLE public.plinko_shots
  ADD CONSTRAINT plinko_shots_weight_positive CHECK (weight > 0);
