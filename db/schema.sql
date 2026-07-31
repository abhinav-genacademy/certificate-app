-- The Gen Academy certificate app — Postgres schema (Neon).
-- Run this once against a fresh database before the app can use it:
--   psql "$DATABASE_URL" -f db/schema.sql
-- or paste it into Neon's SQL editor. Safe to re-run against a database
-- that already has some or all of this — every statement below is
-- idempotent, including the first_name/last_name -> name migration.

create table if not exists cohorts (
  id uuid primary key,
  course_name text not null,
  cohort_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key,
  cohort_id uuid not null references cohorts(id) on delete cascade,
  name text not null,
  email text not null,
  credential_id text unique,
  certificate_url text,
  certificate_png bytea,
  issued_at timestamptz,
  revoked_at timestamptz,
  -- 'manual' = an admin added this person by hand (an exception the
  -- automatic Week 2/3 lists didn't cover). null = came from the computed
  -- Week 2 ∩ Week 3 roster. Manual entries are exempt from the requirement
  -- check and are never removed by a recompute.
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cohort_id, email)
);

-- Safe to re-run against a database created before these columns existed.
alter table students add column if not exists certificate_png bytea;

-- There is only ever one certificate design now (matches the approved Canva
-- source) — drop the per-student style choice and the theme-switcher UI
-- that used to write it.
alter table students drop column if exists theme;

-- Migrate first_name/last_name -> a single name column. Guarded by an
-- information_schema check so it's a no-op once already applied (plain SQL
-- referencing a since-dropped column inside an unreached IF branch is never
-- planned/validated by Postgres, so this is safe to leave in permanently).
alter table students add column if not exists name text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'students' and column_name = 'first_name'
  ) then
    update students
    set name = trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
    where name is null;
    alter table students drop column first_name;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'students' and column_name = 'last_name'
  ) then
    alter table students drop column last_name;
  end if;
end $$;
alter table students alter column name set not null;

create index if not exists students_credential_id_idx on students(credential_id);

create table if not exists weekly_submissions (
  cohort_id uuid not null references cohorts(id) on delete cascade,
  week text not null check (week in ('week2', 'week3')),
  email text not null,
  name text not null default '',
  primary key (cohort_id, week, email)
);

alter table weekly_submissions add column if not exists name text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'weekly_submissions' and column_name = 'first_name'
  ) then
    update weekly_submissions
    set name = trim(both ' ' from coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
    where name is null;
    alter table weekly_submissions drop column first_name;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_name = 'weekly_submissions' and column_name = 'last_name'
  ) then
    alter table weekly_submissions drop column last_name;
  end if;
end $$;
update weekly_submissions set name = '' where name is null;
alter table weekly_submissions alter column name set default '';
alter table weekly_submissions alter column name set not null;

-- Fallback for cohorts not using the Google Forms quiz integration — an
-- admin-uploaded CSV of final assessment scores. Only a score > 80 counts
-- as passing (see getMissingRequirements in lib/store.ts). Empty for a
-- cohort means "not enforced yet", same convention as weekly_submissions.
create table if not exists assessment_scores (
  cohort_id uuid not null references cohorts(id) on delete cascade,
  email text not null,
  score numeric not null,
  primary key (cohort_id, email)
);
