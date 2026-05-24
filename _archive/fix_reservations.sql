-- Einmalig im Supabase SQL-Editor ausführen (Projekt: Cafe Bar Stone)
-- Behebt: "null value in column customer_id violates not-null constraint"

-- customer_id darf leer sein (Reservierungen ohne Verknüpfung zu customers)
ALTER TABLE public.reservations
  ALTER COLUMN customer_id DROP NOT NULL;

-- Optional: Fremdschlüssel entfernen, falls du customers nicht mehr nutzt
-- ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_customer_id_fkey;
