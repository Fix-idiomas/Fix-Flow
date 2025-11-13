import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/push/status
// Response 200: { ok: true, hasToken: boolean, tokens: string[] }
// Response 401: { error: "unauthenticated" }
// Response 500: { error: string }
export async function GET(req: Request) {
  try {
    let firebaseUid: string | null = null;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      firebaseUid = await verifyFirebaseIdToken(token).catch(() => null);
    }
    if (!firebaseUid) firebaseUid = req.headers.get("x-firebase-uid");
    if (!firebaseUid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    const supabase = getSupabase();
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (userErr) return NextResponse.json({ error: "user_fetch_failed", detail: userErr.message }, { status: 500 });
    if (!userRow) return NextResponse.json({ ok: true, hasToken: false, tokens: [] });

    const { data: tokensRows, error: tokensErr } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userRow.id);
    if (tokensErr) return NextResponse.json({ error: "token_query_failed", detail: tokensErr.message }, { status: 500 });

    const tokens = (tokensRows || []).map((r: any) => r.token).filter(Boolean);
    return NextResponse.json({ ok: true, hasToken: tokens.length > 0, tokens });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server_error" }, { status: 500 });
  }
}