-- Schema für Cafe Bar Stone – Platzreservierungs-System
-- Postgres / Supabase-kompatibel
-- HINWEIS: Dieser Code legt neue Typen und Tabellen an.
-- Führe ihn im SQL-Editor deines Supabase-Projekts "Cafe Bar Stone" genau einmal aus.

-- =========================
-- 1. Enums
-- =========================

-- Anrede-Enum, passend zur Map in index.html:
-- Herr   -> 'mr'
-- Frau   -> 'mrs'
-- Divers -> 'divers'
drop type if exists salutation_enum cascade;
create type salutation_enum as enum ('mr', 'mrs', 'divers');

-- Bereichs-Enum, passend zu areaCode in index.html:
-- Nichtraucherbereich -> 'non_smoking'
-- Raucherbereich      -> 'smoking'
drop type if exists area_enum cascade;
create type area_enum as enum ('non_smoking', 'smoking');

-- Status für Reservierungen (für spätere Verwaltung nützlich)
drop type if exists reservation_status_enum cascade;
create type reservation_status_enum as enum ('pending', 'confirmed', 'cancelled', 'no_show');


-- =========================
-- 2. Kern-Tabellen
-- =========================

-- Kundenstammdaten
drop table if exists public.customers cascade;
create table public.customers (
  id           bigserial primary key,
  created_at   timestamptz not null default timezone('utc', now()),
  salutation   salutation_enum,           -- 'mr', 'mrs', 'divers'
  first_name   text not null,
  last_name    text not null,
  email        text not null,
  phone        text not null,

  -- Optionale einfache Dublettenbegrenzung
  constraint customers_email_phone_unique unique (email, phone)
);

-- Reservierungen (keine Tische, nur Kapazität / Slots)
drop table if exists public.reservations cascade;
create table public.reservations (
  id               bigserial primary key,
  created_at       timestamptz not null default timezone('utc', now()),

  customer_id      bigint not null
                   references public.customers(id)
                   on delete cascade,

  -- Zeitpunkt der Reservierung (Datum + Uhrzeit, auch über Mitternacht möglich)
  reservation_at   timestamptz not null,

  -- Bereich (Nichtraucher / Raucher)
  area             area_enum not null,

  -- Anzahl der Personen
  party_size       integer not null check (party_size > 0),

  -- Freitextwünsche (z. B. Geburtstag, JGA, Musikwunsch)
  special_requests text,

  -- Interner Status der Reservierung
  status           reservation_status_enum not null default 'pending',

  -- Quelle (für spätere Auswertungen)
  source           text not null default 'web'
);

-- Indexe für typische Abfragen (z. B. Kapazitäten pro Tag / Bereich)
create index reservations_reservation_at_idx
  on public.reservations (reservation_at);

create index reservations_reservation_at_area_idx
  on public.reservations (reservation_at, area);


-- =========================
-- 3. Log-Tabelle & Trigger
-- =========================
-- Diese Tabelle protokolliert Reservierungs-Ereignisse
-- (z. B. Insert), damit du später nachvollziehen kannst,
-- was passiert ist – ohne deine App ändern zu müssen.

drop table if exists public.reservations_log cascade;
create table public.reservations_log (
  id             bigserial primary key,
  reservation_id bigint not null,
  created_at     timestamptz not null default timezone('utc', now()),
  action         text not null,   -- z. B. 'insert'
  payload        jsonb not null,  -- kompletter Datensatz als JSON

  constraint reservations_log_reservation_fk
    foreign key (reservation_id)
    references public.reservations(id)
    on delete cascade
);

-- Trigger-Funktion: loggt neue Reservierungen
create or replace function public.log_reservation_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.reservations_log (reservation_id, action, payload)
  values (new.id, 'insert', to_jsonb(new));
  return new;
end;
$$;

-- Trigger auf inserts in reservations
drop trigger if exists trg_log_reservation_insert on public.reservations;
create trigger trg_log_reservation_insert
after insert on public.reservations
for each row
execute function public.log_reservation_insert();


-- =========================
-- 4. (Optional) einfache Einstellungen-Tabelle
-- =========================
-- Hier kannst du später z. B. Öffnungszeiten oder Standard-Kapazitäten speichern.
-- Aktuell wird sie von der Website noch nicht aktiv benutzt,
-- ist aber vorbereitet.

drop table if exists public.business_settings cascade;
create table public.business_settings (
  id                       bigserial primary key,
  created_at               timestamptz not null default timezone('utc', now()),
  name                     text not null default 'Cafe Bar Stone',
  timezone                 text not null default 'Europe/Berlin',

  -- Optionale Standard-Kapazitäten (gesamt pro Abend / Tag & Bereich)
  max_capacity_non_smoking integer,
  max_capacity_smoking     integer
);


-- =========================
-- 5. Row Level Security (RLS) & Policies
-- =========================
-- Die Website greift mit dem anon-Key zu (Rolle "anon").
-- Wir erlauben:
-- - Kunden anlegen (INSERT auf customers)
-- - Reservierungen anlegen (INSERT auf reservations)
-- Die Log-Tabelle und business_settings bleiben für den Client schreibgeschützt.

alter table public.customers enable row level security;
alter table public.reservations enable row level security;

-- Bestehende Policies vorsichtshalber entfernen
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('customers', 'reservations')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, 'customers');
    execute format('drop policy if exists %I on public.%I', pol.policyname, 'reservations');
  end loop;
end $$;

-- Neue, einfache Insert-Policies für anon
create policy customers_insert_anon
on public.customers
for insert
to anon
with check (true);

create policy reservations_insert_anon
on public.reservations
for insert
to anon
with check (true);

-- (Optional) nur interne Rollen dürfen Logs und Einstellungen lesen/schreiben.
-- Für dein Frontend ist dafür keine Policy nötig.

