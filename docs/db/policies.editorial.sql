-- Fix-Flow Editorial RLS Policies (outline)
-- This file enables secure-by-default behavior (RLS on, no client policies)
-- and documents optional policies for student read and teacher/admin edits.
-- Apply selectively in Supabase SQL editor.

-- RLS already enabled in ddl.editorial.sql

-- 0) Default posture: server-only access (deny-all for anon/auth; service_role bypasses RLS)
-- Do NOT create policies here to keep editorial data accessible only via Next.js server (SERVICE_ROLE) by default.

-- 1) OPTIONAL: Student read-only of published content (enable when UI reads directly from client)
-- NOTE: Using `to public` allows both anon and authenticated to read.
-- create policy if not exists courses_select_published
-- on public.courses
-- for select
-- to public
-- using (status = 'published');

-- create policy if not exists modules_select_published
-- on public.modules
-- for select
-- to public
-- using (
--   exists(select 1 from public.courses c where c.id = course_id and c.status = 'published')
-- );

-- create policy if not exists micros_select_published
-- on public.micros
-- for select
-- to public
-- using (status = 'published');

-- create policy if not exists micro_media_select_published
-- on public.micro_media
-- for select
-- to public
-- using (
--   exists(select 1 from public.micros m where m.id = micro_id and m.status = 'published')
-- );

-- 2) OPTIONAL: Teacher ownership-based CRUD (when using Supabase client from browser for editors)
-- Requires users to authenticate with Supabase Auth so auth.uid() matches public.users.id; otherwise keep server-only.
-- Example for micros (repeat similarly for courses/modules/micro_media as needed)
-- create policy if not exists micros_select_owner_editor
-- on public.micros
-- for select to authenticated
-- using (exists (select 1 from public.ownership o where o.entity_type = 'micro' and o.entity_id = id and o.user_id = auth.uid()));
-- create policy if not exists micros_insert_owner_editor
-- on public.micros
-- for insert to authenticated
-- with check (exists (select 1 from public.ownership o where o.entity_type = 'course' and o.entity_id = (select module.course_id from public.modules module where module.id = module_id) and o.user_id = auth.uid()));
-- create policy if not exists micros_update_owner_editor
-- on public.micros
-- for update to authenticated
-- using (exists (select 1 from public.ownership o where o.entity_type = 'micro' and o.entity_id = id and o.user_id = auth.uid()))
-- with check (exists (select 1 from public.ownership o where o.entity_type = 'micro' and o.entity_id = id and o.user_id = auth.uid()));
-- create policy if not exists micros_delete_owner_editor
-- on public.micros
-- for delete to authenticated
-- using (exists (select 1 from public.ownership o where o.entity_type = 'micro' and o.entity_id = id and o.user_id = auth.uid()));

-- 3) OPTIONAL: Admin/Owner broad access via role membership
-- Example for courses (apply similarly to other tables)
-- create policy if not exists courses_admin_all
-- on public.courses
-- for all to authenticated
-- using (exists (
--   select 1 from public.user_roles ur
--   join public.roles r on r.id = ur.role_id
--   where ur.user_id = auth.uid() and r.name in ('admin','owner')
-- ))
-- with check (exists (
--   select 1 from public.user_roles ur
--   join public.roles r on r.id = ur.role_id
--   where ur.user_id = auth.uid() and r.name in ('admin','owner')
-- ));

-- 4) User roles tables: keep server-only (no policies) unless you intend to expose read to admins in client.
-- Example read-only policy for admins (optional):
-- create policy if not exists user_roles_select_admin
-- on public.user_roles for select to authenticated
-- using (exists (
--   select 1 from public.user_roles ur2
--   join public.roles r2 on r2.id = ur2.role_id
--   where ur2.user_id = auth.uid() and r2.name in ('admin','owner')
-- ));

-- End of outline. Apply only what your app needs.
