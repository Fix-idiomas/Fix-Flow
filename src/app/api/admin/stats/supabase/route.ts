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

function parseAdminUids(): Set<string> {
  const raw = process.env.ADMIN_UIDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

async function assertAdmin(req: Request): Promise<string> {
  const admins = parseAdminUids();
  let uid: string | null = null;
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    uid = await verifyFirebaseIdToken(token).catch(() => null);
  }
  if (!uid) uid = req.headers.get("x-firebase-uid");
  if (!uid) throw new Error("unauthenticated");
  if (!admins.has(uid)) throw new Error("forbidden");
  return uid;
}

// GET /api/admin/stats/supabase
// Returns aggregate metrics from Supabase without modifying schema
// 200 { ok: true, totals: { users: number, newUsers24h: number, pushTokens: number } }
// 401/403/500 errors
export async function GET(req: Request) {
  try {
    await assertAdmin(req);
    const supabase = getSupabase();

    // Total users
    const usersCountPromise = supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    // New users in last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const newUsersCountPromise = supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    // Total push tokens
    const pushTokensCountPromise = supabase
      .from("push_tokens")
      .select("*", { count: "exact", head: true });

    const [usersCount, newUsersCount, pushTokensCount] = await Promise.all([
      usersCountPromise,
      newUsersCountPromise,
      pushTokensCountPromise,
    ]);

    if (usersCount.error) throw usersCount.error;
    if (newUsersCount.error) throw newUsersCount.error;
    if (pushTokensCount.error) throw pushTokensCount.error;

    return NextResponse.json({
      ok: true,
      totals: {
        users: usersCount.count ?? 0,
        newUsers24h: newUsersCount.count ?? 0,
        pushTokens: pushTokensCount.count ?? 0,
      },
    });
  } catch (e: any) {
    if (e?.message === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    if (e?.message === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: e?.message || "server_error" }, { status: 500 });
  }
}
