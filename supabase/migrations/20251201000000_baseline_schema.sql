-- ============================================================
-- Baseline-Schema – Café Bar Stone
-- ============================================================
-- Versioniert die Kern-Tabellen, damit ein sauberer Neuaufbau
-- (supabase db reset) funktioniert. Alles idempotent (IF NOT
-- EXISTS) → auf der bestehenden Live-DB ein No-op.
-- Früheste Migration (vor Security-Hardening 20260101).
-- ============================================================

-- --- Enums ---
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'salutation_enum') THEN
    CREATE TYPE salutation_enum AS ENUM ('mr', 'mrs', 'divers');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'area_enum') THEN
    CREATE TYPE area_enum AS ENUM ('non_smoking', 'smoking');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status_enum') THEN
    CREATE TYPE reservation_status_enum AS ENUM ('pending', 'confirmed', 'cancelled', 'no_show');
  END IF;
END $$;

-- --- Kunden ---
CREATE TABLE IF NOT EXISTS public.customers (
  id         bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  salutation salutation_enum,
  first_name text NOT NULL,
  last_name  text NOT NULL,
  email      text NOT NULL,
  phone      text NOT NULL
);

-- --- Reservierungen ---
CREATE TABLE IF NOT EXISTS public.reservations (
  id               bigserial PRIMARY KEY,
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  customer_id      bigint NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reservation_at   timestamptz NOT NULL,
  area             area_enum NOT NULL,
  party_size       integer NOT NULL CHECK (party_size > 0),
  special_requests text,
  status           reservation_status_enum NOT NULL DEFAULT 'pending',
  source           text NOT NULL DEFAULT 'web',
  confirmed_by     uuid,
  confirmed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS reservations_reservation_at_idx ON public.reservations (reservation_at);

-- --- Log-Tabelle ---
CREATE TABLE IF NOT EXISTS public.reservations_log (
  id             bigserial PRIMARY KEY,
  reservation_id bigint NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),
  action         text NOT NULL,
  payload        jsonb NOT NULL
);

-- --- Einstellungen ---
CREATE TABLE IF NOT EXISTS public.business_settings (
  id         bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  name       text NOT NULL DEFAULT 'Cafe Bar Stone',
  timezone   text NOT NULL DEFAULT 'Europe/Berlin'
);

-- --- Log-Trigger (SECURITY DEFINER, siehe Audit N1) ---
CREATE OR REPLACE FUNCTION public.log_reservation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.reservations_log (reservation_id, action, payload)
  VALUES (NEW.id, 'insert', to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_reservation_insert ON public.reservations;
CREATE TRIGGER trg_log_reservation_insert
AFTER INSERT ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.log_reservation_insert();
