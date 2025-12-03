import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireAdmin(req: Request): Promise<{ uid: string; user_id: string } | null> {
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  let uid = token ? await verifyFirebaseIdToken(token) : null;
  if (!uid) uid = req.headers.get("x-firebase-uid");
  if (!uid) return null;
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data: u } = await sb.from("users").select("id").eq("firebase_uid", uid).maybeSingle();
  const user_id = u?.id as string | undefined;
  if (!user_id) return null;
  const { data: roles } = await sb.from("user_roles").select("roles(name)").eq("user_id", user_id);
  const isAdmin = Array.isArray(roles) && roles.some((r: any) => ["owner","admin","teacher"].includes(r.roles?.name));
  return isAdmin ? { uid, user_id } : null;
}

function slugify(raw: string) {
  return raw
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: 'supabase_config' }, { status: 500 });
    const { id } = await params;
    const body = await req.json().catch(() => null) as { module_id?: string; overrides?: any } | null;
    if (!id || !body?.module_id) return NextResponse.json({ error: 'payload_invalido' }, { status: 400 });

    const { data: model } = await sb.from('micro_library').select('*').eq('id', id).maybeSingle();
    if (!model?.id) return NextResponse.json({ error: 'model_not_found' }, { status: 404 });

    const title = (body?.overrides?.title || model.title) as string;
    const slug = slugify(body?.overrides?.slug || model.slug || title);
    const goal = (body?.overrides?.goal ?? model.goal) as string | null;
    const task = (body?.overrides?.task ?? model.task) as string | null;
    const criteria = Array.isArray(body?.overrides?.criteria) ? body?.overrides?.criteria : (model.criteria || null);
    const est_minutes = Number.isFinite(body?.overrides?.est_minutes) ? body?.overrides?.est_minutes : (model.est_minutes ?? null);
    const ai_mode = ['auto','flash','pro'].includes(body?.overrides?.ai_mode || model.ai_mode || '') ? (body?.overrides?.ai_mode || model.ai_mode) : null;

    const { data: created, error } = await sb.from('micros').insert({
      module_id: body.module_id,
      slug,
      title,
      goal: goal || null,
      task: task || null,
      criteria: criteria && criteria.length ? criteria : null,
      est_minutes,
      ai_mode,
    }).select('id, slug, title, status, module_id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, micro: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 });
  }
}
