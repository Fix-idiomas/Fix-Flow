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

// Read-only introspection of table/column availability by probing select() operations.
// No assumptions; reports missing tables/columns without modifying schema.
export async function GET() {
  try {
    const supabase = getSupabase();

    async function tableExists(name: string): Promise<boolean> {
      const r = await supabase.from(name).select("*").limit(1);
      if (r.error) {
        const msg = r.error.message || "";
        if (/relation .* does not exist/i.test(msg) || /table .* does not exist/i.test(msg)) return false;
        // If other error, treat as exists but inaccessible
        return true;
      }
      return true;
    }

    async function columnExists(table: string, column: string): Promise<boolean> {
      const r = await supabase.from(table).select(column).limit(1);
      if (r.error) {
        const msg = r.error.message || "";
        if (/column .* does not exist/i.test(msg)) return false;
        return true;
      }
      return true; // query fine even if no rows
    }

    const checks: Record<string, { exists: boolean; columns: Record<string, boolean> }> = {};

    // users
    const usersCols = [
      "id","firebase_uid","display_name","avatar_url","push_opt_in","push_last_token_at","legacy_linked","onboarding_completed","status","full_name","email"
    ];
    const usersExists = await tableExists("users");
    const usersColMap: Record<string, boolean> = {};
    if (usersExists) {
      for (const c of usersCols) usersColMap[c] = await columnExists("users", c);
    }
    checks["users"] = { exists: usersExists, columns: usersColMap };

    // push_tokens
    const pushCols = ["user_id","token","platform","user_agent","created_at"];
    const pushExists = await tableExists("push_tokens");
    const pushColMap: Record<string, boolean> = {};
    if (pushExists) {
      for (const c of pushCols) pushColMap[c] = await columnExists("push_tokens", c);
    }
    checks["push_tokens"] = { exists: pushExists, columns: pushColMap };

    // user_private
    const privCols = [
      "uid","cpf","phone_e164","address_street","address_number","address_complement","address_neighborhood","address_city","address_state","address_cep"
    ];
    const privExists = await tableExists("user_private");
    const privColMap: Record<string, boolean> = {};
    if (privExists) {
      for (const c of privCols) privColMap[c] = await columnExists("user_private", c);
    }
    checks["user_private"] = { exists: privExists, columns: privColMap };

    return NextResponse.json({ ok: true, checks });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}
