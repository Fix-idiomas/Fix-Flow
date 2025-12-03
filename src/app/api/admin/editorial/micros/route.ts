import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);

    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
    let uid = token ? await verifyFirebaseIdToken(token) : null;
    if (!uid) uid = req.headers.get("x-firebase-uid");
    if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const sb = getSupabaseAdmin();
    const { data: userRow } = await sb.from("users").select("id").eq("firebase_uid", uid).maybeSingle();
    const user_id = userRow?.id as string | undefined;
    if (!user_id) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    const { data: roles } = await sb
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user_id);
    const isAdmin = Array.isArray(roles) && roles.some((r: any) => ["owner", "admin", "teacher"].includes(r.roles?.name));
    if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    let query = sb.from("micros").select("id, slug, title, status, module_id").order("slug");
    if (q) {
      // simple ilike on slug/title
      query = query.or(`slug.ilike.%${q}%,title.ilike.%${q}%`);
    }
    const { data, error } = await query.limit(limit);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, items: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro" }, { status: 500 });
  }
}
