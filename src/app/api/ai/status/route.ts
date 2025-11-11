import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const keyPresent = !!process.env.GEMINI_API_KEY;
  return NextResponse.json({
    ok: true,
    keyPresent,
    defaultModel: process.env.GEMINI_MODEL_DEFAULT || null,
    complexModel: process.env.GEMINI_MODEL_COMPLEX || null,
    nodeVersion: process.version,
    env: Object.keys(process.env).filter(k => k.startsWith('GEMINI_')),
    timestamp: Date.now()
  });
}
