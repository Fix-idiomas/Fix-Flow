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

function isValidYoutubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{8,20}$/.test(id);
}

type Body = {
  slug: string;
  provider: "youtube";
  videoId: string;
  privacy?: "public" | "unlisted";
  requiredWatchPct?: number;
  allowBypass?: boolean;
  requireFullWatch?: boolean;
};

export async function POST(req: Request) {
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

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || !body.slug || !body.videoId || body.provider !== "youtube") {
      return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }

    if (!isValidYoutubeId(body.videoId)) {
      return NextResponse.json({ error: "youtube_id_invalido" }, { status: 400 });
    }

    // Check admin role via user_roles or owner
    const { data: roles } = await sb
      .from("user_roles")
      .select("role_id, roles(name)")
      .eq("user_id", user_id);
    const isAdmin = Array.isArray(roles) && roles.some((r: any) => r.roles?.name === "admin" || r.roles?.name === "owner" || r.roles?.name === "teacher");
    if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    // Find micro by slug
    const { data: micro } = await sb.from("micros").select("id").eq("slug", body.slug).maybeSingle();
    if (!micro?.id) return NextResponse.json({ error: "micro_not_found" }, { status: 404 });

    const privacy = body.privacy ?? "public";
    const requiredWatchPct = typeof body.requiredWatchPct === "number" ? Math.max(0, Math.min(1, body.requiredWatchPct)) : 0.7;
    const allowBypass = body.allowBypass ?? true;
    const requireFullWatch = body.requireFullWatch ?? false;

    const { data, error } = await sb
      .from("micro_media")
      .upsert({
        micro_id: micro.id,
        provider: "youtube",
        video_id: body.videoId,
        privacy,
        required_watch_pct: requiredWatchPct,
        allow_bypass: allowBypass,
        require_full_watch: requireFullWatch,
        created_by: user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "micro_id" })
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST { slug, provider: 'youtube', videoId, privacy, requiredWatchPct, allowBypass, requireFullWatch }" });
}
