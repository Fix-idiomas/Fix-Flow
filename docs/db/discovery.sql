-- Fix-Flow DB Discovery Kit (Supabase/Postgres)
-- Goal: inspect current state BEFORE creating or changing anything.
-- Usage: paste in Supabase SQL Editor and run each block as needed.
-- Tip: This file targets schema 'public'. For projects using multiple schemas,
--      use the multi-schema alternatives at the bottom (sections 11+),
--      or replace 'public' with the desired schema.

-- =====================
-- 1) List public tables
-- =====================
select table_name
from information_schema.tables
where table_schema='public'
order by table_name;

-- =====================
-- 2) RLS enabled per table?
-- =====================
select c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relkind='r'
order by c.relname;

-- =====================
-- 3) Policies details (all tables)
-- =====================
select tablename       as table_name,
       policyname      as policy_name,
       permissive,
       roles,
       cmd             as command,
       qual            as using_expr,
       with_check      as with_check_expr
from pg_policies
where schemaname='public'
order by tablename, policyname;

-- =====================
-- 4) Indexes per table
-- =====================
select t.relname as table_name,
       i.relname as index_name,
       pg_get_indexdef(ix.indexrelid) as definition
from pg_class t
join pg_index ix on t.oid = ix.indrelid
join pg_class i on i.oid = ix.indexrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname='public'
  and t.relkind='r'
order by t.relname, i.relname;

-- =====================
-- 5) Triggers
-- =====================
select event_object_table as table_name,
       trigger_name,
       action_timing,
       event_manipulation,
       action_statement
from information_schema.triggers
where trigger_schema='public'
order by event_object_table, trigger_name;

-- =====================
-- 6) Functions (RPCs)
-- =====================
select specific_name,
       routine_name,
       routine_type,
       data_type
from information_schema.routines
where specific_schema='public'
order by routine_name;

-- =====================
-- 7) Views (name + definition)
-- =====================
select table_name as view_name,
       view_definition
from information_schema.views
where table_schema='public'
order by view_name;

-- =====================
-- 8) Object dependencies inside schema public
--    (what objects reference what, helpful before dropping/altering)
-- =====================
select
  dep.objid::regclass::text as object,
  ref.objid::regclass::text as referenced
from pg_depend dep
join pg_depend ref on dep.refobjid = ref.objid
where dep.deptype='n'
  and dep.objid::regclass::text like 'public.%'
  and ref.objid::regclass::text like 'public.%'
order by object, referenced;

-- =====================
-- 9) Column inventory for selected tables (edit IN list)
-- =====================
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('users','user_links_legacy','push_tokens','points_ledger','audit_events')
order by table_name, ordinal_position;

-- =====================
-- 10) Grants (optional)
-- =====================
select table_schema, table_name, privilege_type, grantee
from information_schema.table_privileges
where table_schema='public'
order by table_name, grantee, privilege_type;

-- =====================
-- 11) Multi-schema: RLS across all user schemas
-- =====================
select n.nspname as schema,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not like 'pg_%'
  and n.nspname <> 'information_schema'
order by n.nspname, c.relname;

-- =====================
-- 12) Multi-schema: Policies across all user schemas
-- =====================
select schemaname       as schema,
       tablename        as table_name,
       policyname       as policy_name,
       permissive,
       roles,
       cmd              as command,
       qual             as using_expr,
       with_check       as with_check_expr
from pg_policies
where schemaname not in ('pg_catalog','information_schema')
order by schemaname, tablename, policyname;

-- =====================
-- 13) Multi-schema: Views with full definitions
-- =====================
select schemaname as schema,
       viewname,
       pg_get_viewdef((quote_ident(schemaname)||'.'||quote_ident(viewname))::regclass, true) as definition
from pg_views
where schemaname not in ('pg_catalog','information_schema')
order by schemaname, viewname;

-- =====================
-- 14) Multi-schema: Functions (RPCs) with signatures
-- =====================
select n.nspname as schema,
       p.proname  as function,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prokind as kind  -- f=function, p=procedure
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog','information_schema')
order by n.nspname, p.proname;
-- Fix-Flow DB Discovery Kit (Supabase/Postgres)
-- Goal: inspect current state BEFORE creating or changing anything.
-- Usage: paste in Supabase SQL Editor and run each block as needed.
-- Tip: This file targets schema 'public'. For projects using multiple schemas,
--      use the multi-schema alternatives at the bottom (sections 11+),
--      or replace 'public' with the desired schema.

-- =====================
-- 1) List public tables
-- =====================
select table_name
from information_schema.tables
where table_schema='public'
order by table_name;

-- =====================
-- 2) RLS enabled per table?
-- =====================
select c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relkind='r'
order by c.relname;

-- =====================
-- 3) Policies details (all tables)
-- =====================
select tablename       as table_name,
       policyname      as policy_name,
       permissive,
       roles,
       cmd             as command,
       qual            as using_expr,
       with_check      as with_check_expr
from pg_policies
where schemaname='public'
order by tablename, policyname;

-- =====================
-- 4) Indexes per table
-- =====================
select t.relname as table_name,
       i.relname as index_name,
       pg_get_indexdef(ix.indexrelid) as definition
from pg_class t
join pg_index ix on t.oid = ix.indrelid
join pg_class i on i.oid = ix.indexrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname='public'
  and t.relkind='r'
order by t.relname, i.relname;

-- =====================
-- 5) Triggers
-- =====================
select event_object_table as table_name,
       trigger_name,
       action_timing,
       event_manipulation,
       action_statement
from information_schema.triggers
where trigger_schema='public'
order by event_object_table, trigger_name;

-- =====================
-- 6) Functions (RPCs)
-- =====================
select specific_name,
       routine_name,
       routine_type,
       data_type
from information_schema.routines
where specific_schema='public'
order by routine_name;

-- =====================
-- 7) Views (name + definition)
-- =====================
select table_name as view_name,
       view_definition
from information_schema.views
where table_schema='public'
order by view_name;

-- =====================
-- 8) Object dependencies inside schema public
--    (what objects reference what, helpful before dropping/altering)
-- =====================
select
  dep.objid::regclass::text as object,
  ref.objid::regclass::text as referenced
from pg_depend dep
join pg_depend ref on dep.refobjid = ref.objid
where dep.deptype='n'
  and dep.objid::regclass::text like 'public.%'
  and ref.objid::regclass::text like 'public.%'
order by object, referenced;

-- =====================
-- 9) Column inventory for selected tables (edit IN list)
-- =====================
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('users','user_links_legacy','push_tokens','points_ledger','audit_events')
order by table_name, ordinal_position;

-- =====================
-- 10) Grants (optional)
-- =====================
select table_schema, table_name, privilege_type, grantee
from information_schema.table_privileges
where table_schema='public'
order by table_name, grantee, privilege_type;

-- =====================
-- 11) Multi-schema: RLS across all user schemas
-- =====================
select n.nspname as schema,
       c.relname as table_name,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname not like 'pg_%'
  and n.nspname <> 'information_schema'
order by n.nspname, c.relname;

-- =====================
-- 12) Multi-schema: Policies across all user schemas
-- =====================
select schemaname       as schema,
       tablename        as table_name,
       policyname       as policy_name,
       permissive,
       roles,
       cmd              as command,
       qual             as using_expr,
       with_check       as with_check_expr
from pg_policies
where schemaname not in ('pg_catalog','information_schema')
order by schemaname, tablename, policyname;

-- =====================
-- 13) Multi-schema: Views with full definitions
-- =====================
select schemaname as schema,
       viewname,
       pg_get_viewdef((quote_ident(schemaname)||'.'||quote_ident(viewname))::regclass, true) as definition
from pg_views
where schemaname not in ('pg_catalog','information_schema')
order by schemaname, viewname;

-- =====================
-- 14) Multi-schema: Functions (RPCs) with signatures
-- =====================
select n.nspname as schema,
       p.proname  as function,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prokind as kind  -- f=function, p=procedure
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('pg_catalog','information_schema')
order by n.nspname, p.proname;
