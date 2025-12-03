-- Fix-Flow Editorial RLS Policies
-- Strategy: keep server-only by default; enable fine-grained client access when needed.
-- This block adds ACTIVE policies for: student read of published, teacher ownership CRUD (limited), admin/owner full CRUD, lesson video progress self-access.
-- All policies wrapped in DO blocks for idempotency (skip if already exists).
-- IMPORTANT: Requires Supabase auth (auth.uid()) for client-side access; service_role bypasses RLS.

begin;

-- Enable RLS on lesson_video_progress (was not enabled in initial DDL)
alter table public.lesson_video_progress enable row level security;

-- Helper: check if policy exists function
-- (Policy existence check done via pg_policies; we guard creation with dynamic EXECUTE.)

/* ======================= STUDENT READ (published only) ======================= */
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='courses' and policyname='courses_select_published_students') then
		execute $$create policy courses_select_published_students on public.courses for select to authenticated using (status='published')$$;
	end if;
end $$;

do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='modules' and policyname='modules_select_published_students') then
		execute $$create policy modules_select_published_students on public.modules for select to authenticated using (exists (select 1 from public.courses c where c.id=course_id and c.status='published'))$$;
	end if;
end $$;

do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='micros' and policyname='micros_select_published_students') then
		execute $$create policy micros_select_published_students on public.micros for select to authenticated using (status='published')$$;
	end if;
end $$;

do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='micro_media' and policyname='micro_media_select_published_students') then
		execute $$create policy micro_media_select_published_students on public.micro_media for select to authenticated using (exists (select 1 from public.micros m where m.id=micro_id and m.status='published'))$$;
	end if;
end $$;

/* ======================= ADMIN / OWNER FULL CRUD ======================= */
-- Courses
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='courses' and policyname='courses_admin_owner_all') then
		execute $$create policy courses_admin_owner_all on public.courses for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner')))$$;
	end if;
end $$;

-- Modules
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='modules' and policyname='modules_admin_owner_all') then
		execute $$create policy modules_admin_owner_all on public.modules for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner')))$$;
	end if;
end $$;

-- Micros
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='micros' and policyname='micros_admin_owner_all') then
		execute $$create policy micros_admin_owner_all on public.micros for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner')))$$;
	end if;
end $$;

-- micro_media
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='micro_media' and policyname='micro_media_admin_owner_all') then
		execute $$create policy micro_media_admin_owner_all on public.micro_media for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner')))$$;
	end if;
end $$;

-- ownership (only owner/admin manage)
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='ownership' and policyname='ownership_admin_owner_all') then
		execute $$create policy ownership_admin_owner_all on public.ownership for all to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner'))) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name in ('admin','owner')))$$;
	end if;
end $$;

/* ======================= TEACHER OWNERSHIP-BASED LIMITED CRUD ======================= */
-- Teachers can update micros they own via ownership table (role=owner/editor on that micro)
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='micros' and policyname='micros_teacher_update_owned') then
		execute $$create policy micros_teacher_update_owned on public.micros for update to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name='teacher') and exists (select 1 from public.ownership o where o.entity_type='micro' and o.entity_id=id and o.user_id=auth.uid())) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name='teacher') and exists (select 1 from public.ownership o where o.entity_type='micro' and o.entity_id=id and o.user_id=auth.uid()))$$;
	end if;
end $$;

-- Teachers can insert micro_media for micros they own
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='micro_media' and policyname='micro_media_teacher_insert_owned') then
		execute $$create policy micro_media_teacher_insert_owned on public.micro_media for insert to authenticated with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name='teacher') and exists (select 1 from public.ownership o join public.micros m on m.id=o.entity_id where o.entity_type='micro' and m.id=micro_id and o.user_id=auth.uid()))$$;
	end if;
end $$;

-- Teachers can update micro_media for owned micros
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='micro_media' and policyname='micro_media_teacher_update_owned') then
		execute $$create policy micro_media_teacher_update_owned on public.micro_media for update to authenticated using (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name='teacher') and exists (select 1 from public.ownership o join public.micros m on m.id=o.entity_id where o.entity_type='micro' and m.id=micro_id and o.user_id=auth.uid())) with check (exists (select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.name='teacher') and exists (select 1 from public.ownership o join public.micros m on m.id=o.entity_id where o.entity_type='micro' and m.id=micro_id and o.user_id=auth.uid()))$$;
	end if;
end $$;

/* ======================= LESSON VIDEO PROGRESS (self-access) ======================= */
do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='lesson_video_progress' and policyname='lvp_select_self') then
		execute $$create policy lvp_select_self on public.lesson_video_progress for select to authenticated using (user_id=auth.uid())$$;
	end if;
end $$;

do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='lesson_video_progress' and policyname='lvp_insert_self') then
		execute $$create policy lvp_insert_self on public.lesson_video_progress for insert to authenticated with check (user_id=auth.uid())$$;
	end if;
end $$;

do $$ begin
	if not exists (select 1 from pg_policies where schemaname='public' and tablename='lesson_video_progress' and policyname='lvp_update_self') then
		execute $$create policy lvp_update_self on public.lesson_video_progress for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid())$$;
	end if;
end $$;

commit;

-- NOTE: user_roles & roles remain server-only (no policies) to prevent privilege escalation via client.
-- To allow admins to list user_roles on client, add a select policy restricted to admin/owner later.

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
-- End of active policies block.
