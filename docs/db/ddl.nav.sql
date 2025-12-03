-- Navigation spots for placing published micros in course/module views
begin;

create extension if not exists "pgcrypto";

create table if not exists public.nav_spots (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('micro')),
  entity_id uuid not null references public.micros(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  module_id uuid references public.modules(id) on delete cascade,
  ord smallint not null default 1,
  visible boolean not null default true,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, course_id, module_id)
);

alter table public.nav_spots enable row level security;

commit;
