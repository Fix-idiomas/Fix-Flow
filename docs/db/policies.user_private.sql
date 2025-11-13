-- RLS policies for public.user_private
-- Context: Users should be able to read, create, update and delete ONLY their own PII rows via the client (authenticated session with Supabase Auth).
-- This script assumes the table already exists with primary key uid and optional unique cpf.

-- 0) Safety: enable RLS (no policies -> deny-all for anon/auth; service role bypasses RLS)
alter table public.user_private enable row level security;

-- 1) Owner can SELECT their own row
create policy if not exists user_private_select_own
on public.user_private
for select
to authenticated
using (uid = auth.uid());

-- 2) Owner can INSERT their own row
create policy if not exists user_private_insert_own
on public.user_private
for insert
to authenticated
with check (uid = auth.uid());

-- 3) Owner can UPDATE their own row
-- Default: allow updates to all columns for own row
create policy if not exists user_private_update_own
on public.user_private
for update
to authenticated
using (uid = auth.uid())
with check (uid = auth.uid());

-- 3b) OPTIONAL: Lock CPF after first set (comment out the default UPDATE policy above and use the two below instead)
-- create policy if not exists user_private_update_own_noncpf
-- on public.user_private
-- for update
-- to authenticated
-- using (uid = auth.uid())
-- with check (
--   uid = auth.uid()
--   and (old.cpf = new.cpf or old.cpf is null) -- prevent changing CPF if already set
-- );

-- 3c) OPTIONAL: Safer correction model (grace window or until verified)
-- Add helper columns and a trigger to track when CPF was set and whether it was verified.
-- Apply this DDL first (idempotent):
-- alter table public.user_private add column if not exists cpf_set_at timestamptz;
-- alter table public.user_private add column if not exists cpf_verified_at timestamptz;
-- create or replace function public.set_cpf_timestamp()
-- returns trigger language plpgsql as $$
-- begin
--   if tg_op in ('INSERT','UPDATE') then
--     if new.cpf is distinct from old.cpf then
--       new.cpf_set_at := now();
--       -- Always reset verification on change
--       new.cpf_verified_at := null;
--     end if;
--   end if;
--   return new;
-- end; $$;
-- drop trigger if exists trg_user_private_cpf_set_at on public.user_private;
-- create trigger trg_user_private_cpf_set_at before insert or update on public.user_private
--   for each row execute function public.set_cpf_timestamp();
--
-- Then, replace the default UPDATE policy with this one:
-- create or replace policy user_private_update_own_cpf_grace
-- on public.user_private
-- for update
-- to authenticated
-- using (uid = auth.uid())
-- with check (
--   uid = auth.uid()
--   and (
--     -- allow any update to non-CPF fields
--     old.cpf = new.cpf
--     or
--     -- allow CPF change within a grace window (e.g., 24 hours) OR while not verified
--     age(now(), coalesce(old.cpf_set_at, old.created_at)) < interval '24 hours'
--     or old.cpf_verified_at is null
--   )
-- );

-- 4) Owner can DELETE their own row
create policy if not exists user_private_delete_own
on public.user_private
for delete
to authenticated
using (uid = auth.uid());

-- 5) Recommended constraints (idempotent)
alter table public.user_private
  add constraint if not exists user_private_uid_pk primary key (uid);

create unique index if not exists user_private_cpf_unique on public.user_private (cpf) where cpf is not null;

-- 6) OPTIONAL read-only masked view (useful if you prefer never returning raw CPF to the client)
-- CREATE OR REPLACE VIEW public.user_private_masked AS
--   SELECT
--     uid,
--     CASE WHEN cpf IS NULL THEN NULL ELSE regexp_replace(cpf, '\\d(?=\\d{2})', '*', 'g') END AS cpf_masked,
--     phone_e164,
--     address_street,
--     address_number,
--     address_complement,
--     address_neighborhood,
--     address_city,
--     address_state,
--     address_cep,
--     created_at,
--     updated_at
--   FROM public.user_private;
--
-- -- RLS for the view (views inherit underlying table RLS). To simplify, you can expose select on the view only:
-- GRANT SELECT ON public.user_private_masked TO authenticated;
-- -- Do NOT grant inserts/updates/deletes on the view; perform writes against the base table.
