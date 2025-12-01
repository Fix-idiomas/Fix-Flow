-- Fix-Flow Editorial Schema (Courses, Micros, Media, Roles)
-- Idempotent DDL to bootstrap content management for admin/teacher

create extension if not exists "pgcrypto";

-- Roles mapping (simple, flexible)
create table if not exists public.roles (
  id bigserial primary key,
  name text unique not null check (name in ('owner','admin','teacher','student')),
  description text
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users(id) on delete cascade,
  role_id bigint not null references public.roles(id) on delete cascade,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Courses/modules/micros
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  ord smallint not null default 1,
  unique (course_id, ord)
);

create table if not exists public.micros (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  slug text unique not null,
  title text not null,
  goal text,
  task text,
  criteria jsonb,
  ai_mode text check (ai_mode in ('auto','flash','pro')),
  est_minutes smallint,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  ord smallint not null default 1
);

-- Media and gating for micros
create table if not exists public.micro_media (
  micro_id uuid primary key references public.micros(id) on delete cascade,
  provider text not null check (provider = 'youtube'),
  video_id text not null,
  privacy text not null default 'public' check (privacy in ('public','unlisted')),
  duration_sec int,
  required_watch_pct real check (required_watch_pct between 0 and 1),
  allow_bypass boolean not null default true,
  require_full_watch boolean not null default false,
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

-- Ownership grants for editorial entities
create table if not exists public.ownership (
  user_id uuid not null references public.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('course','micro')),
  entity_id uuid not null,
  role text not null check (role in ('owner','editor')),
  granted_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

-- Helpful indexes
create index if not exists idx_modules_course on public.modules(course_id);
create index if not exists idx_micros_module on public.micros(module_id);
create index if not exists idx_ownership_entity on public.ownership(entity_type, entity_id);

-- RLS enable
alter table public.roles        enable row level security;
alter table public.user_roles   enable row level security;
alter table public.courses      enable row level security;
alter table public.modules      enable row level security;
alter table public.micros       enable row level security;
alter table public.micro_media  enable row level security;
alter table public.ownership    enable row level security;

-- Policy outlines (implement in a separate policies file as needed)
-- NOTE: service_role bypasses RLS; end-user access must be explicitly granted.
-- Students: read-only published content
-- create policy courses_select_published on public.courses for select to authenticated using (status = 'published');
-- create policy modules_select_published on public.modules for select to authenticated using (
--   exists(select 1 from public.courses c where c.id = course_id and c.status = 'published')
-- );
-- create policy micros_select_published on public.micros for select to authenticated using (status = 'published');
-- create policy micro_media_select_published on public.micro_media for select to authenticated using (
--   exists(select 1 from public.micros m where m.id = micro_id and m.status = 'published')
-- );

-- Teachers (ownership-based): CRUD where user has owner/editor on the entity
-- Example select policy for micros
-- create policy micros_select_owner_editor on public.micros for select to authenticated using (
--   exists(select 1 from public.ownership o where o.entity_type = 'micro' and o.entity_id = id and o.user_id = auth.uid())
-- );
-- Similar policies for insert/update/delete with with check using ownership.

-- Admin: broad CRUD via role membership; Owner supersets all
-- Implement via policies checking user_roles membership. Example:
-- create policy courses_admin_all on public.courses for all to authenticated using (
--   exists(
--     select 1 from public.user_roles ur
--     join public.roles r on r.id = ur.role_id
--     where ur.user_id = auth.uid() and r.name in ('admin','owner')
--   )
-- ) with check (
--   exists(
--     select 1 from public.user_roles ur
--     join public.roles r on r.id = ur.role_id
--     where ur.user_id = auth.uid() and r.name in ('admin','owner')
--   )
-- );

-- Audit: use existing public.audit_events from ddl.flow.sql for write logging (handled in app layer).
