import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Contract
// POST /api/avatar/finish
// Body: { source: "upload" | "preset", url: string }
// Validations:
//  - source "upload": URL must belong to Firebase Storage path avatars/{firebase_uid}/...
//  - source "preset": URL must be from approved public preset list (/public/avatars/*)
// Response 200: { ok: true, avatarUrl }
// Errors: 400 (invalid), 403 (ownership), 500 (server)

interface FinishAvatarBody { source: "upload" | "preset"; url: string }

function validate(body: any): { ok: true; data: FinishAvatarBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body inválido" };
  if (!body.url || typeof body.url !== "string") return { ok: false, error: "'url' obrigatória" };
  if (!body.source || !["upload", "preset"].includes(body.source)) return { ok: false, error: "'source' inválido" };
  return { ok: true, data: body as FinishAvatarBody };
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const v = validate(json);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  // TODO:
  //  - Derive firebase UID server-side.
  //  - Validate URL pattern by source.
  //  - Persist avatar_url in public.users.
  return NextResponse.json(
    {
      ok: false,
      message: "Not implemented yet. Will validate and persist avatar_url.",
      received: v.data,
      expectedSuccess: { ok: true, avatarUrl: v.data.url },
    },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Use POST to finalize avatar selection." }, { status: 200 });
}
