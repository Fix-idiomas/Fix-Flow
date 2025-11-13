-- Fix-Flow minimal schema (Supabase/Postgres)
-- Run this once in Supabase SQL Editor (Project: Flow)

-- Prereq
create extension if not exists "pgcrypto";

-- USERS: every person in Flow (even without legacy match)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique not null,
  display_name text not null,
  avatar_url text,
  onboarding_completed boolean not null default false,
  legacy_linked boolean not null default false,
  push_opt_in boolean not null default false,
  push_last_token_at timestamptz,
  status text not null default 'active' check (status in ('active','blocked','deleted')),
  created_at timestamptz not null default now()
);

create index if not exists idx_users_firebase_uid on public.users(firebase_uid);

-- LEGACY LINK: optional link to legacy student
create table if not exists public.user_links_legacy (
  user_id uuid not null references public.users(id) on delete cascade,
  legacy_student_id text not null,
  linked_at timestamptz not null default now(),
  primary key (user_id),
  unique (legacy_student_id)
);

-- PUSH TOKENS (FCM)
create table if not exists public.push_tokens (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  platform text not null default 'web',
  user_agent text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (token)
);

create index if not exists idx_push_tokens_user on public.push_tokens(user_id);
create index if not exists idx_push_tokens_platform on public.push_tokens(platform);

-- POINTS LEDGER (future-proof for ranking)
create table if not exists public.points_ledger (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  delta int not null check (delta <> 0),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_points_ledger_user on public.points_ledger(user_id);
create index if not exists idx_points_ledger_created_at on public.points_ledger(created_at desc);

-- AUDIT EVENTS (server-only, optional)
create table if not exists public.audit_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_user_id uuid,
  kind text not null,
  meta jsonb
);

-- RLS: secure baseline (server-only; service_role bypasses RLS)
alter table public.users             enable row level security;
alter table public.user_links_legacy enable row level security;
alter table public.push_tokens       enable row level security;
alter table public.points_ledger     enable row level security;
alter table public.audit_events      enable row level security;

-- No end-user policies by default. Access via Next.js API using SERVICE_ROLE only.
-- If later you want client read/write, add explicit policies referencing auth.jwt().
