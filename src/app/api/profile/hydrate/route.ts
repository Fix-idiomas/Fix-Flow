import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contract
// POST /api/profile/hydrate
// Body: { studentCode: string }
// Behavior:
//  - (Future) Query legacy view with studentCode.
//  - If match -> link to user (insert into user_links_legacy) & return legacy payload.
//  - If not found -> 404 { error: "not_found" }
//  - If ambiguous -> 409 { error: "ambiguous", candidates: n }
//  - If already linked -> 409 { error: "already_linked" }
// Response success 200: { user: {...}, legacy: {...} }

interface HydrateBody { studentCode: string }

function validate(b: any): { ok: true; data: HydrateBody } | { ok: false; error: string } {
  if (!b || typeof b !== "object") return { ok: false, error: "Body inválido" };
  if (!b.studentCode || typeof b.studentCode !== "string" || b.studentCode.length < 2) return { ok: false, error: "'studentCode' inválido" };
  return { ok: true, data: b as HydrateBody };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validate(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  // TODO:
  //  - Derive firebase UID and user record.
  //  - Query legacy Supabase view using service role.
  //  - Handle match / not_found / ambiguous logic.
  return NextResponse.json(
    {
      ok: false,
      message: "Not implemented yet. Will attempt to hydrate legacy profile.",
      received: v.data,
      expectedSuccess: {
        user: { id: "uuid", displayName: "Aluno", legacyLinked: true },
        legacy: {
          studentId: "...",
          language: "...",
          level: "...",
          classGroup: "...",
          lastSessionAt: "2025-01-01T00:00:00Z",
          lastTopics: ["topicA", "topicB"]
        }
      }
    },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Use POST with { studentCode } to attempt legacy hydration." },
    { status: 200 }
  );
}
