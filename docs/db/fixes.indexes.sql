-- Idempotent fixes for indexes and foreign keys used by the app
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- 1) Remove duplicate unique index on users(firebase_uid) if present
-- Keep the primary/unique key already in place (users_firebase_uid_key)
drop index if exists users_firebase_uid_unique;

-- 2) Ensure unique email (case-insensitive) if you store user emails
create unique index if not exists users_email_unique
  on public.users (lower(email))
  where email is not null;

-- 3) Ensure FK: push_tokens.user_id -> users.id (use DO block since some Postgres versions don't support IF NOT EXISTS on ADD CONSTRAINT)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_user_id_fkey'
      and conrelid = 'public.push_tokens'::regclass
  ) then
    alter table public.push_tokens
      add constraint push_tokens_user_id_fkey
      foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

-- 4) Ensure push_tokens indexes
create unique index if not exists push_tokens_token_unique on public.push_tokens (token);
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
