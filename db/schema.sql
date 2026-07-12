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

-- Safe to re-run against a database created before certificate_png existed.
alter table students add column if not exists certificate_png bytea;

create index if not exists students_credential_id_idx on students(credential_id);

create table if not exists weekly_submissions (
  cohort_id uuid not null references cohorts(id) on delete cascade,
  week text not null check (week in ('week2', 'week3')),
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  primary key (cohort_id, week, email)
);

-- Backs lib/rate-limit.ts — a plain fixed-window counter per bucket key
-- (e.g. "claim:1.2.3.4"). Rows are pruned by the limiter itself as it goes.
create table if not exists rate_limit_hits (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_bucket_created_idx on rate_limit_hits(bucket, created_at);

-- Every call to /api/automation/cohorts/[id]/students, regardless of outcome.
create table if not exists automation_audit_log (
  id bigserial primary key,
  cohort_id uuid,
  email text,
  outcome text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists automation_audit_log_created_idx on automation_audit_log(created_at);
