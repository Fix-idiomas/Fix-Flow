import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest, context: any) {
  try {
    // Next.js validator may wrap params in a Promise, handle both forms
    const rawParams = context?.params && typeof context.params.then === 'function' ? await context.params : context.params;
    const slug = rawParams?.slug;
    if (!slug) return NextResponse.json({ error: "slug_obrigatorio" }, { status: 400 });

    // Auth (optional for published). We allow anonymous (no token) only for published content.
    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
    let uid = token ? await verifyFirebaseIdToken(token).catch(() => null) : null;
    if (!uid) uid = req.headers.get("x-firebase-uid") || null;

    const sb = getSupabaseAdmin();

    // Resolve user_id + roles when authenticated
    let user_id: string | null = null;
    let roles: string[] = [];
    if (uid) {
      const { data: userRow } = await sb.from("users").select("id").eq("firebase_uid", uid).maybeSingle();
      user_id = userRow?.id || null;
      if (user_id) {
        const { data: roleRows } = await sb
          .from("user_roles")
          .select("roles(name)")
          .eq("user_id", user_id);
        roles = Array.isArray(roleRows) ? roleRows.map((r: any) => r.roles?.name).filter(Boolean) : [];
      }
    }

    const { data: micro } = await sb
      .from("micros")
      .select("id, slug, title, goal, task, criteria, ai_mode, est_minutes, status, module_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!micro) return NextResponse.json({ error: "micro_not_found" }, { status: 404 });

    const isAdmin = roles.some(r => ["owner", "admin", "teacher"].includes(r));
    if (micro.status !== "published" && !isAdmin) {
      return NextResponse.json({ error: "not_published" }, { status: 403 });
    }

    const { data: media } = await sb
      .from("micro_media")
      .select("provider, video_id, privacy, required_watch_pct, allow_bypass, require_full_watch, duration_sec")
      .eq("micro_id", micro.id)
      .maybeSingle();

    return NextResponse.json({ ok: true, micro, media, roles, published: micro.status === "published" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro" }, { status: 500 });
  }
}
