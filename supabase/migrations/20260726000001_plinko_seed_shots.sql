-- ============================================================
-- Plinko-Minigame – Start-Shots (Seed)
-- ============================================================
-- Legt eine erste Auswahl an Shots an, damit das Spiel sofort
-- spielbar ist. Wird nur eingefügt, wenn die Tabelle noch leer
-- ist (idempotent). Der Admin kann diese Shots im Dashboard
-- jederzeit bearbeiten, deaktivieren oder löschen.
-- ============================================================

INSERT INTO public.plinko_shots (name, description, color, active, sort_order)
SELECT v.name, v.description, v.color, true, v.sort_order
FROM (VALUES
  ('Tequila',                'mit Salz & Zitrone', '#e0b46e', 0),
  ('Jägermeister',           'eiskalt',            '#5fae8c', 1),
  ('Sambuca',                'mit Kaffeebohne',    '#6f9bb5', 2),
  ('Vodka Feige',            'süß-fruchtig',       '#cf6d6d', 3),
  ('Wasser (für den Fahrer)','Prost, Held!',       '#9b7bd1', 4)
) AS v(name, description, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.plinko_shots);
