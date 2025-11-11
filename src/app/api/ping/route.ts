// Removed: use /api/health instead. This endpoint now returns 410 Gone.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "/api/ping foi removido. Use /api/health.", use: "/api/health" },
    { status: 410 }
  );
}
