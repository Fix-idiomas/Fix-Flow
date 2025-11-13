import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface BodyShape { displayName?: string; avatarUrl?: string | null }

function validate(b: any): { ok: true; data: BodyShape } | { ok: false; error: string } {
  if (!b || typeof b !== "object") return { ok: false, error: "invalid_body" };
  const out: BodyShape = {};
  if (b.displayName !== undefined) {
    if (typeof b.displayName !== "string" || b.displayName.trim().length < 2)
      return { ok: false, error: "invalid_display_name" };
    out.displayName = b.displayName.trim();
  }
  if (b.avatarUrl !== undefined) {
    if (b.avatarUrl !== null && typeof b.avatarUrl !== "string")
      return { ok: false, error: "invalid_avatar_url" };
    out.avatarUrl = b.avatarUrl;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "empty_update" };
  return { ok: true, data: out };
}

export async function POST(req: Request) {
  try {
    // Auth: prefer Bearer Firebase ID token, fallback x-firebase-uid
    let firebaseUid: string | null = null;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      firebaseUid = await verifyFirebaseIdToken(token);
    }
    if (!firebaseUid) firebaseUid = req.headers.get("x-firebase-uid");
    if (!firebaseUid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const v = validate(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const supabase = getSupabase();
    // ensure user exists without overwriting display_name unless provided
    const { data: existingUser, error: selErr } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (selErr) return NextResponse.json({ error: "user_check_failed", detail: selErr.message }, { status: 500 });
    if (!existingUser) {
      const { error: insErr } = await supabase
        .from("users")
        .insert({ firebase_uid: firebaseUid, display_name: v.data.displayName ?? "Aluno" });
      if (insErr) return NextResponse.json({ error: "user_insert_failed", detail: insErr.message }, { status: 500 });
    }

    const patch: Record<string, any> = {};
    if (v.data.displayName !== undefined) patch.display_name = v.data.displayName;
    if (v.data.avatarUrl !== undefined) patch.avatar_url = v.data.avatarUrl;

    const { data: userRow, error: updErr } = await supabase
      .from("users")
      .update(patch)
      .eq("firebase_uid", firebaseUid)
      .select("*")
      .single();
    if (updErr || !userRow) return NextResponse.json({ error: "update_failed" }, { status: 500 });

    const user = {
      id: userRow.id,
      firebaseUid: userRow.firebase_uid,
      displayName: userRow.display_name,
      avatarUrl: userRow.avatar_url ?? null,
      fullName: userRow.full_name ?? null,
      email: userRow.email ?? null,
      onboardingCompleted: Boolean(userRow.onboarding_completed ?? false),
    };
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server_error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST { displayName?, avatarUrl? } to update basic profile." });
}
