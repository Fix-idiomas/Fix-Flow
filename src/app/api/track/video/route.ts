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

type TrackBody = {
  slug: string;
  videoId: string;
  seconds?: number; // delta or absolute; we will clamp
  pct?: number;     // absolute percent (0..1) preferred
  duration?: number;
  event?: "progress" | "completed" | "bypass_clicked" | "practice_started";
};

export async function POST(req: Request) {
  try {
    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
    let uid = token ? await verifyFirebaseIdToken(token) : null;
    if (!uid) uid = req.headers.get("x-firebase-uid");
    if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as TrackBody | null;
    if (!body || !body.slug || !body.videoId) {
      return NextResponse.json({ error: "payload inválido" }, { status: 400 });
    }

    const seconds = Math.max(0, Math.min(60 * 60 * 3, Math.floor(body.seconds ?? 0))); // clamp up to 3h
    const pctRaw = typeof body.pct === "number" ? body.pct : 0;
    const pct = Math.max(0, Math.min(1, pctRaw));
    const duration = body.duration && body.duration > 0 ? Math.min(60 * 60 * 3, Math.floor(body.duration)) : null;

    const sb = getSupabaseAdmin();
    // Resolve user_id by firebase_uid
    const { data: userRow, error: userErr } = await sb
      .from("users")
      .select("id")
      .eq("firebase_uid", uid)
      .maybeSingle();
    if (userErr || !userRow?.id) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const user_id = userRow.id as string;

    // Upsert progress: keep the max of seconds/pct, set completed/bypassed flags
    const updates: any = {
      user_id,
      slug: body.slug,
      video_id: body.videoId,
      updated_at: new Date().toISOString(),
    };
    if (duration !== null) updates.duration_sec = duration;
    if (seconds) updates.seconds_watched = seconds;
    if (pct) updates.pct = pct;
    if (body.event === "completed") updates.completed = true;
    if (body.event === "bypass_clicked") updates.bypassed = true;

    const { data, error } = await sb
      .from("lesson_video_progress")
      .upsert(updates, { onConflict: "user_id,slug" })
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, row: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST video progress: { slug, videoId, seconds, pct, duration, event }" });
}
