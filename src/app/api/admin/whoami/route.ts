import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/admin/whoami
// Returns { ok, uid, user_id, roles: [..] }
export async function GET(req: Request) {
  let uid: string | null = null;
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    uid = await verifyFirebaseIdToken(token).catch(() => null);
  }
  if (!uid) uid = req.headers.get("x-firebase-uid");
  if (!uid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: "supabase_config" }, { status: 500 });

  const { data: userRow } = await sb.from("users").select("id, email, display_name").eq("firebase_uid", uid).maybeSingle();
  let roles: string[] = [];
  if (userRow?.id) {
    const { data: roleRows } = await sb
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", userRow.id);
    roles = Array.isArray(roleRows) ? roleRows.map((r: any) => r.roles?.name).filter(Boolean) : [];
  }

  return NextResponse.json({ ok: true, uid, user_id: userRow?.id ?? null, roles });
}
