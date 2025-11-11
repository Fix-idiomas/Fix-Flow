// Deprecated: use /api/health instead. Keeping temporarily to avoid 404 during transition.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, deprecated: true, use: "/api/health", ts: Date.now() });
}
