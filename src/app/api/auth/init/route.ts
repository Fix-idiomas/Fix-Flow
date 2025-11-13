import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic"; // always server-side
export const runtime = "nodejs"; // ensure Node runtime

// Contract
// POST /api/auth/init
// Server responsibility:
// - Extract firebase UID from a trusted source (MVP: header x-firebase-uid; PROD: validar ID Token Firebase)
// - Upsert uma linha em public.users para este UID
// Response 200:
// { user: { id, firebaseUid, displayName, avatarUrl, pushOptIn, legacyLinked, onboardingCompleted, status } }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role (bypass RLS)
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    // Tentar extrair ID Token do header Authorization se disponível
    // Formato esperado: Authorization: Bearer <idToken>
    let firebaseUid: string | null = null;
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      firebaseUid = await verifyFirebaseIdToken(token);
    }

    // Fallback MVP para header x-firebase-uid caso admin não esteja configurado ainda
    if (!firebaseUid) {
      const fallbackUid = req.headers.get("x-firebase-uid");
      if (fallbackUid) firebaseUid = fallbackUid;
    }

    if (!firebaseUid) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    const supabase = getSupabase();

    // Ensure user exists without overwriting existing display_name
    const { data: existing, error: selExistingErr } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (selExistingErr) {
      return NextResponse.json({ ok: false, error: "user_check_failed", detail: selExistingErr.message }, { status: 500 });
    }
    if (!existing) {
      const { error: insErr } = await supabase
        .from("users")
        .insert({ firebase_uid: firebaseUid, display_name: "Aluno" });
      if (insErr) return NextResponse.json({ ok: false, error: "user_insert_failed", detail: insErr.message }, { status: 500 });
    }

    // Buscar perfil completo (seleção ampla para tolerar colunas opcionais)
    const { data: row, error: selErr } = await supabase
      .from("users")
      .select("*")
      .eq("firebase_uid", firebaseUid)
      .single();
    if (selErr || !row) {
      return NextResponse.json({ ok: false, error: "user_fetch_failed" }, { status: 500 });
    }

    const user = {
      id: row.id,
      firebaseUid: row.firebase_uid,
      displayName: row.display_name ?? null,
      avatarUrl: row.avatar_url ?? null,
      pushOptIn: Boolean(row.push_opt_in ?? false),
      legacyLinked: Boolean(row.legacy_linked ?? false),
      onboardingCompleted: Boolean(row.onboarding_completed ?? false),
      status: (row.status as string) ?? "active",
    };

    return NextResponse.json({ ok: true, user }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "server_error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      message: "Use POST para inicializar/buscar o usuário Flow do UID atual (MVP: header x-firebase-uid).",
      endpoint: "/api/auth/init",
    },
    { status: 200 }
  );
}
