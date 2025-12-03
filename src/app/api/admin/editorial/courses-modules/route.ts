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
    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
    let uid = token ? await verifyFirebaseIdToken(token) : null;
    if (!uid) uid = req.headers.get("x-firebase-uid");
    if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const sb = getSupabaseAdmin();
    const { data: userRow } = await sb.from("users").select("id").eq("firebase_uid", uid).maybeSingle();
    const user_id = userRow?.id as string | undefined;
    if (!user_id) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    const { data: roles } = await sb.from("user_roles").select("role_id, roles(name)").eq("user_id", user_id);
    const can = Array.isArray(roles) && roles.some((r: any) => ["owner","admin","teacher"].includes(r.roles?.name));
    if (!can) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { data: courses, error: cErr } = await sb.from("courses").select("id, slug, title, status").order("slug");
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    const { data: modules, error: mErr } = await sb.from("modules").select("id, course_id, title, ord").order("ord");
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, courses, modules });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro" }, { status: 500 });
  }
}
