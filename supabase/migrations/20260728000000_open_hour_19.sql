-- ============================================================
-- Öffnungszeit auf 19:00 Uhr setzen (Do/Fr/Sa)
-- ============================================================
-- Setzt die maßgebliche Öffnungsstunde in business_settings.
-- Client (script.js) und Server (submit-reservation) lesen diesen
-- Wert; damit greift 19:00 sowohl in der Anzeige der Slots als
-- auch in der serverseitigen Validierung.
-- ============================================================

UPDATE public.business_settings SET open_from_hour = 19;
