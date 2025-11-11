import { NextResponse } from "next/server";

export async function GET() {
  // Simple serverless liveness probe (no external deps)
  return NextResponse.json({ ok: true, ts: Date.now() });
}
