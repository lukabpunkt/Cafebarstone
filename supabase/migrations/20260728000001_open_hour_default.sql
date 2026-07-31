-- ============================================================
-- Öffnungsstunde: auch den Spalten-DEFAULT auf 19 setzen
-- ============================================================
-- Ergänzt 20260728000000 (das nur den Wert per UPDATE setzte).
-- Damit bekommt eine neu angelegte business_settings-Zeile
-- (z. B. nach db reset oder Admin-Insert ohne open_from_hour)
-- ebenfalls 19:00 statt des alten Defaults 17.
-- ============================================================

ALTER TABLE public.business_settings
  ALTER COLUMN open_from_hour SET DEFAULT 19;
