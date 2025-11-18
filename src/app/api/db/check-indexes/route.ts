import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const supabase = getSupabase();

    // Expect an RPC helper to exist; if not, return setup SQL for convenience.
    const { data, error } = await supabase.rpc("db_check_indexes");
    if (error) {
      const setupSql = `
-- Create a stable function to introspect indexes/constraints (read-only)
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
`;
      return NextResponse.json({ ok: false, error: error.message, requiresSetup: true, setupSql }, { status: 200 });
    }
    return NextResponse.json({ ok: true, indexes: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
