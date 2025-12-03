begin;

-- Helper: create a stable function to inspect indexes/constraints via /api/db/check-indexes
create or replace function public.db_check_indexes()
returns json language sql stable as $$
  select json_build_object(
    'users_firebase_uid_unique', exists(
      select 1 from pg_indexes where schemaname='public' and tablename='users' and indexdef ilike '%unique%' and indexdef ilike '%(firebase_uid)%'
    ),
    'users_email_unique', exists(
      select 1 from pg_indexes where schemaname='public' and tablename='users' and indexname='users_email_unique'
    ),
    'push_tokens_token_unique', exists(
      select 1 from pg_indexes where schemaname='public' and tablename='push_tokens' and indexdef ilike '%unique%' and indexdef ilike '%(token)%'
    ),
    'push_tokens_user_id_fk', exists(
      select 1 from pg_constraint where conname='push_tokens_user_id_fkey' and conrelid='public.push_tokens'::regclass
    )
  );
$$;

-- Example usage:
-- select public.db_check_indexes();

commit;
