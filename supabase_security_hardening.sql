-- ============================================================
-- Supabase Security Hardening – Café Bar Stone
-- ============================================================
-- Alles in einem Script. Kann auf einmal ausgeführt werden.
-- Entfernt zuerst ALLE bestehenden Policies, dann baut es
-- alles sauber neu auf.
-- ============================================================


-- ============================================================
-- SCHRITT 1: Alle bestehenden Policies auf ALLEN Tabellen löschen
-- ============================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('customers', 'reservations', 'reservations_log', 'business_settings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;


-- ============================================================
-- SCHRITT 2: RLS auf allen Tabellen aktivieren
-- ============================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SCHRITT 3: Alle GRANTs sauber setzen
-- ============================================================

-- Zuerst alles entziehen, dann gezielt vergeben
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.reservations FROM anon;
REVOKE ALL ON public.reservations_log FROM anon;
REVOKE ALL ON public.business_settings FROM anon;

REVOKE ALL ON public.customers FROM authenticated;
REVOKE ALL ON public.reservations FROM authenticated;
REVOKE ALL ON public.reservations_log FROM authenticated;
REVOKE ALL ON public.business_settings FROM authenticated;

-- anon (öffentlicher Besucher der Website)
GRANT INSERT ON public.customers TO anon;
GRANT SELECT (id, email, phone) ON public.customers TO anon;
GRANT INSERT ON public.reservations TO anon;
GRANT SELECT ON public.business_settings TO anon;

-- anon braucht Zugriff auf Sequenzen für INSERT
GRANT USAGE ON SEQUENCE public.customers_id_seq TO anon;
GRANT USAGE ON SEQUENCE public.reservations_id_seq TO anon;

-- authenticated (eingeloggter Admin)
GRANT SELECT, UPDATE ON public.reservations TO authenticated;
GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.business_settings TO authenticated;
GRANT SELECT ON public.reservations_log TO authenticated;


-- ============================================================
-- SCHRITT 4: Neue Policies – customers
-- ============================================================

-- anon darf Kunden anlegen
CREATE POLICY customers_insert_anon
ON public.customers
FOR INSERT
TO anon
WITH CHECK (true);

-- anon darf nur id, email, phone lesen (für Duplikat-Check)
CREATE POLICY customers_select_anon
ON public.customers
FOR SELECT
TO anon
USING (true);

-- Admin darf alle Kundendaten lesen
CREATE POLICY customers_select_authenticated
ON public.customers
FOR SELECT
TO authenticated
USING (true);


-- ============================================================
-- SCHRITT 5: Neue Policies – reservations
-- ============================================================

-- anon darf Reservierungen anlegen
CREATE POLICY reservations_insert_anon
ON public.reservations
FOR INSERT
TO anon
WITH CHECK (true);

-- Admin darf Reservierungen lesen
CREATE POLICY reservations_select_authenticated
ON public.reservations
FOR SELECT
TO authenticated
USING (true);

-- Admin darf Reservierungen aktualisieren (Status ändern)
CREATE POLICY reservations_update_authenticated
ON public.reservations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);


-- ============================================================
-- SCHRITT 6: Neue Policies – business_settings
-- ============================================================

-- anon darf lesen (für "Reservierungen offen?"-Check)
CREATE POLICY business_settings_select_anon
ON public.business_settings
FOR SELECT
TO anon
USING (true);

-- Admin darf lesen
CREATE POLICY business_settings_select_authenticated
ON public.business_settings
FOR SELECT
TO authenticated
USING (true);

-- Admin darf ändern (Reservierungen sperren/freigeben)
CREATE POLICY business_settings_update_authenticated
ON public.business_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Admin darf anlegen (falls noch kein Eintrag existiert)
CREATE POLICY business_settings_insert_authenticated
ON public.business_settings
FOR INSERT
TO authenticated
WITH CHECK (true);


-- ============================================================
-- SCHRITT 7: Neue Policies – reservations_log
-- ============================================================

-- Nur Admin darf Logs lesen
CREATE POLICY reservations_log_select_authenticated
ON public.reservations_log
FOR SELECT
TO authenticated
USING (true);

-- Der INSERT-Trigger läuft als SECURITY DEFINER, braucht keine Policy


-- ============================================================
-- SCHRITT 8: Rate Limiting – Max 5 Reservierungen pro E-Mail / 24h
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_reservation_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_email TEXT;
  recent_count   INTEGER;
BEGIN
  SELECT email INTO customer_email
  FROM public.customers
  WHERE id = NEW.customer_id;

  IF customer_email IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_count
    FROM public.reservations r
    JOIN public.customers c ON r.customer_id = c.id
    WHERE c.email = customer_email
      AND r.created_at > NOW() - INTERVAL '24 hours';

    IF recent_count >= 5 THEN
      RAISE EXCEPTION 'Reservierungslimit erreicht. Maximal 5 Reservierungen pro E-Mail innerhalb von 24 Stunden.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_rate_limit ON public.reservations;
CREATE TRIGGER trg_reservation_rate_limit
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reservation_rate_limit();


-- ============================================================
-- SCHRITT 9: Rate Limiting – Max 10 Kunden-Einträge pro E-Mail / 24h
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_customer_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.customers
  WHERE email = NEW.email
    AND created_at > NOW() - INTERVAL '24 hours';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Zu viele Registrierungen mit dieser E-Mail-Adresse. Bitte später erneut versuchen.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_rate_limit ON public.customers;
CREATE TRIGGER trg_customer_rate_limit
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.check_customer_rate_limit();


-- ============================================================
-- SCHRITT 10: Nur Reservierungen in der Zukunft erlauben
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_reservation_future_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.reservation_at < NOW() THEN
    RAISE EXCEPTION 'Reservierungen können nur für zukünftige Zeitpunkte erstellt werden.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_future_only ON public.reservations;
CREATE TRIGGER trg_reservation_future_only
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reservation_future_only();


-- ============================================================
-- SCHRITT 11: party_size Obergrenze auf Datenbankebene
-- ============================================================

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_party_size_max;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_party_size_max
  CHECK (party_size >= 1 AND party_size <= 20);


-- ============================================================
-- FERTIG!
-- ============================================================
