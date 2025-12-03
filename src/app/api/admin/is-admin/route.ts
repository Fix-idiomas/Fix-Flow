import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseAdminUids(): Set<string> {
  const raw = process.env.ADMIN_UIDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/admin/is-admin
// Auth: Firebase ID token (Authorization: Bearer <token>) or x-firebase-uid (dev)
// 200 { ok: true, isAdmin: boolean, uid?: string, source?: 'env' | 'roles' }
// 401 { error: "unauthenticated" }
export async function GET(req: Request) {
  const admins = parseAdminUids();
  let uid: string | null = null;

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    uid = await verifyFirebaseIdToken(token).catch(() => null);
  }
  if (!uid) uid = req.headers.get("x-firebase-uid");
  if (!uid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let isAdmin = admins.has(uid);
  let source: 'env' | 'roles' | undefined = isAdmin ? 'env' : undefined;
  if (!isAdmin) {
    const sb = getSupabaseAdmin();
    if (sb) {
      // Resolve user_id and check user_roles for owner/admin/teacher
      const { data: u } = await sb.from("users").select("id").eq("firebase_uid", uid).maybeSingle();
      const user_id = u?.id as string | undefined;
      if (user_id) {
        const { data: roles } = await sb
          .from("user_roles")
          .select("roles(name)")
          .eq("user_id", user_id);
        const hasRole = Array.isArray(roles) && roles.some((r: any) => ["owner", "admin", "teacher"].includes(r.roles?.name));
        if (hasRole) {
          isAdmin = true;
          source = 'roles';
        }
      }
    }
  }

  return NextResponse.json({ ok: true, isAdmin, uid, source });
}
