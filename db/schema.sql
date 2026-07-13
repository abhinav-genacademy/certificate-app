-- The Gen Academy certificate app — Postgres schema (Neon).
-- Run this once against a fresh database before the app can use it:
--   psql "$DATABASE_URL" -f db/schema.sql
-- or paste it into Neon's SQL editor.

create table if not exists cohorts (
  id uuid primary key,
  course_name text not null,
  cohort_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key,
  cohort_id uuid not null references cohorts(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  email text not null,
  credential_id text unique,
  certificate_url text,
  certificate_png bytea,
  -- Which certificate design was rendered, chosen by the student on their
  -- /verify/<credentialId> link. Defaults to 'light' for certificates
  -- generated before a student ever visits (e.g. an admin's bulk
  -- "Generate certificates").
  theme text not null default 'light' check (theme in ('light', 'dark')),
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
alter table students add column if not exists theme text not null default 'light' check (theme in ('light', 'dark'));

create index if not exists students_credential_id_idx on students(credential_id);

create table if not exists weekly_submissions (
  cohort_id uuid not null references cohorts(id) on delete cascade,
  week text not null check (week in ('week2', 'week3')),
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  primary key (cohort_id, week, email)
);

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
