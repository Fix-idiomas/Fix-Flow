import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getFirebaseAdmin, verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    let firebaseUid: string | null = null;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      firebaseUid = await verifyFirebaseIdToken(token);
    }
    if (!firebaseUid) {
      const fallbackUid = req.headers.get("x-firebase-uid");
      if (fallbackUid) firebaseUid = fallbackUid;
    }
    if (!firebaseUid) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Ensure user row exists
    const { data: existing, error: selErr } = await supabase
      .from("users")
      .select("id, display_name, avatar_url")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (selErr) {
      return NextResponse.json({ ok: false, error: "user_check_failed", detail: selErr.message }, { status: 500 });
    }
    if (!existing) {
      const { error: insErr } = await supabase
        .from("users")
        .insert({ firebase_uid: firebaseUid, display_name: "Aluno" });
      if (insErr) {
        return NextResponse.json({ ok: false, error: "user_insert_failed", detail: insErr.message }, { status: 500 });
      }
    }

    // Fetch provider profile from Firebase Admin
    const app = getFirebaseAdmin();
    let displayName: string | null = null;
    let email: string | null = null;
    let photoURL: string | null = null;
    if (app) {
      try {
        const adminAuth = getAuth(app);
        const rec = await adminAuth.getUser(firebaseUid);
        displayName = rec.displayName || null;
        email = rec.email || null;
        photoURL = rec.photoURL || null;
      } catch {}
    }

    // Build update payload (tolerant to missing optional columns like email)
    const baseUpdate: Record<string, any> = {};
    if (displayName) baseUpdate.display_name = displayName;
    if (photoURL) baseUpdate.avatar_url = photoURL;

    if (Object.keys(baseUpdate).length) {
      const { error: updErr } = await supabase
        .from("users")
        .update(baseUpdate)
        .eq("firebase_uid", firebaseUid);
      if (updErr) {
        return NextResponse.json({ ok: false, error: "user_update_failed", detail: updErr.message }, { status: 500 });
      }
    }

    // Best-effort update for email if column exists
    if (email) {
      try {
        const { error: updEmailErr } = await supabase
          .from("users")
          .update({ email })
          .eq("firebase_uid", firebaseUid);
        // Ignore column-not-exist errors silently
        if (updEmailErr && !/column\s+email\s+does\s+not\s+exist/i.test(updEmailErr.message)) {
          return NextResponse.json({ ok: false, error: "user_email_update_failed", detail: updEmailErr.message }, { status: 500 });
        }
      } catch {}
    }

    // Return consolidated user
    const { data: row, error: fetchErr } = await supabase
      .from("users")
      .select("*")
      .eq("firebase_uid", firebaseUid)
      .single();
    if (fetchErr || !row) {
      return NextResponse.json({ ok: false, error: "user_fetch_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: row }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Use POST com Bearer ID token para promover/sincronizar perfil." });
}
