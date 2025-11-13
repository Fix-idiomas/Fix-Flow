import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

// Expect environment variables (server-only; DO NOT prefix with NEXT_PUBLIC):
// SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
// For now we rely on service role directly. In production ensure this route is protected.

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role (has bypass RLS)
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contract
// POST /api/push/register-token
// Body: { token: string, platform?: string, userAgent?: string }
// Behavior:
//  - Upsert token into push_tokens (unique token)
//  - Set users.push_opt_in=true and push_last_token_at=now()
// Response 200: { ok: true }
// Errors: 400 (missing token), 500

interface PushTokenBody { token: string; platform?: string; userAgent?: string }

function validate(b: any): { ok: true; data: PushTokenBody } | { ok: false; error: string } {
  if (!b || typeof b !== "object") return { ok: false, error: "Body inválido" };
  if (!b.token || typeof b.token !== "string" || b.token.length < 10) return { ok: false, error: "'token' inválido" };
  if (b.platform && typeof b.platform !== "string") return { ok: false, error: "'platform' inválido" };
  if (b.userAgent && typeof b.userAgent !== "string") return { ok: false, error: "'userAgent' inválido" };
  return { ok: true, data: b as PushTokenBody };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const v = validate(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    // Try Authorization Bearer ID token first; fallback to header x-firebase-uid (MVP)
    let firebaseUid: string | null = null;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      firebaseUid = await verifyFirebaseIdToken(token);
    }
    if (!firebaseUid) firebaseUid = req.headers.get("x-firebase-uid");
    if (!firebaseUid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supabase = getSupabase();

    // Ensure user exists (insert only if missing, do not override display_name)
    const { data: existing, error: selExistingErr } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (selExistingErr) return NextResponse.json({ error: "user_check_failed", detail: selExistingErr.message }, { status: 500 });
    if (!existing) {
      const { error: insErr } = await supabase
        .from("users")
        .insert({ firebase_uid: firebaseUid, display_name: "Aluno" });
      if (insErr) return NextResponse.json({ error: "user_insert_failed", detail: insErr.message }, { status: 500 });
    }

    // Fetch user id
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .single();
    if (userErr || !userRow) return NextResponse.json({ error: "user_fetch_failed" }, { status: 500 });

    // Insert push token (ignore duplicates)
    const { error: tokenErr } = await supabase
      .from("push_tokens")
      .upsert({ user_id: userRow.id, token: v.data.token, platform: v.data.platform || "web", user_agent: v.data.userAgent || null }, { onConflict: "token" });
    if (tokenErr) return NextResponse.json({ error: "token_upsert_failed", detail: tokenErr.message }, { status: 500 });

    // Update user flags
    const { error: flagErr } = await supabase
      .from("users")
      .update({ push_opt_in: true, push_last_token_at: new Date().toISOString() })
      .eq("id", userRow.id);
    if (flagErr) return NextResponse.json({ error: "flag_update_failed", detail: flagErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server_error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Use POST with { token } to register a push token." },
    { status: 200 }
  );
}
