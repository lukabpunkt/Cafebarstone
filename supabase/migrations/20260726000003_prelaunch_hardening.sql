-- ============================================================
-- Pre-Launch-Härtung – Café Bar Stone
-- ============================================================
-- Versioniert bisher nicht versionierte, aber live genutzte Objekte.
-- Alles idempotent → auf der Live-DB No-op, für Neuaufbau nötig.
-- ============================================================

-- Unique-Index auf customers.email (nötig für Upsert onConflict:"email"
-- in der Edge Function submit-reservation).
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_key ON public.customers (email);

-- business_settings: live genutzte Spalten (Öffnungszeiten/Status).
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS reservations_open boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS open_days integer[] DEFAULT '{4,5,6}',
  ADD COLUMN IF NOT EXISTS open_from_hour integer DEFAULT 17,
  ADD COLUMN IF NOT EXISTS last_slot_hour integer DEFAULT 20;
