import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lista modelos disponíveis (útil para depurar 404).
export async function GET() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY ausente" }, { status: 503 });
  try {
    // Use API v1 para listar modelos compatíveis com generateContent
    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
    const json = await res.json();
    return NextResponse.json({ ok: true, models: json.models || [], count: (json.models || []).length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro" }, { status: 500 });
  }
}
