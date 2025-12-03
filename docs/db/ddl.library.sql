-- Library schema for videos and micro models
begin;

create extension if not exists "pgcrypto";

-- Video Library (generic for YouTube/Supabase/external)
create table if not exists public.video_library (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('youtube','supabase','external')),
  youtube_id text,
  storage_path text,
  mime_type text,
  title text,
  channel text,
  duration_sec int,
  tags text[],
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  unique (provider, youtube_id)
);

-- Micro Library (reusable practice templates)
create table if not exists public.micro_library (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  goal text,
  task text,
  criteria jsonb,
  ai_mode text check (ai_mode in ('auto','flash','pro')),
  est_minutes smallint,
  tags text[],
  status text not null default 'active' check (status in ('active','archived')),
  default_video_id uuid references public.video_library(id),
  default_required_watch_pct real,
  default_allow_bypass boolean,
  default_require_full_watch boolean,
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

-- Optional: usage table (not required now)
create table if not exists public.video_usage (
  video_id uuid references public.video_library(id) on delete cascade,
  entity_type text not null check (entity_type in ('micro')),
  entity_id uuid not null,
  linked_by uuid references public.users(id),
  linked_at timestamptz not null default now(),
  primary key (video_id, entity_type, entity_id)
);

-- Enable RLS
alter table public.video_library enable row level security;
alter table public.micro_library enable row level security;
alter table public.video_usage enable row level security;

commit;
