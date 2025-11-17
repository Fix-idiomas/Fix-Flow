import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

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

// GET /api/admin/is-admin
// Auth: Firebase ID token (Authorization: Bearer <token>) or x-firebase-uid (dev)
// 200 { ok: true, isAdmin: boolean, uid?: string }
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

  const isAdmin = admins.has(uid);
  return NextResponse.json({ ok: true, isAdmin, uid });
}
