import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

type Body = { module_id: string; title: string; slug?: string; goal?: string; task?: string; criteria?: string[]; estMinutes?: number; ai_mode?: string };

function slugify(raw: string) {
  return raw
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function POST(req: Request) {
  try {
    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
    let uid = token ? await verifyFirebaseIdToken(token) : null;
    if (!uid) uid = req.headers.get("x-firebase-uid");
    if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const sb = getSupabaseAdmin();
    const { data: userRow } = await sb.from("users").select("id").eq("firebase_uid", uid).maybeSingle();
    const user_id = userRow?.id as string | undefined;
    if (!user_id) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    const { data: roles } = await sb.from("user_roles").select("role_id, roles(name)").eq("user_id", user_id);
    const can = Array.isArray(roles) && roles.some((r: any) => ["owner","admin","teacher"].includes(r.roles?.name));
    if (!can) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null) as Body | null;
    if (!body || !body.module_id || !body.title) return NextResponse.json({ error: 'payload_invalido' }, { status: 400 });
    const slug = slugify(body.slug || body.title);
    if (!slug) return NextResponse.json({ error: 'slug_invalido' }, { status: 400 });
    const criteria = (Array.isArray(body.criteria) ? body.criteria : []).filter(c => c && c.trim()).map(c => c.trim());
    const estMinutes = Number.isFinite(body.estMinutes) ? body.estMinutes : null;
    const ai_mode = ['auto','flash','pro'].includes(body.ai_mode || '') ? body.ai_mode : null;

    const { data, error } = await sb.from('micros').insert({
      module_id: body.module_id,
      slug,
      title: body.title.trim(),
      goal: body.goal?.trim() || null,
      task: body.task?.trim() || null,
      criteria: criteria.length ? criteria : null,
      est_minutes: estMinutes,
      ai_mode,
    }).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, micro: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
    let uid = token ? await verifyFirebaseIdToken(token) : null;
    if (!uid) uid = req.headers.get("x-firebase-uid");
    if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const sb = getSupabaseAdmin();
    const { data: userRow } = await sb.from("users").select("id").eq("firebase_uid", uid).maybeSingle();
    const user_id = userRow?.id as string | undefined;
    if (!user_id) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    const { data: roles } = await sb.from("user_roles").select("role_id, roles(name)").eq("user_id", user_id);
    const can = Array.isArray(roles) && roles.some((r: any) => ["owner","admin","teacher"].includes(r.roles?.name));
    if (!can) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null) as { id?: string; slug?: string; status?: string } | null;
    if (!body || (!body.id && !body.slug) || !body.status) {
      return NextResponse.json({ error: 'payload_invalido' }, { status: 400 });
    }
    const status = String(body.status);
    if (!['draft','review','published','archived'].includes(status)) {
      return NextResponse.json({ error: 'status_invalido' }, { status: 400 });
    }

    let query = sb.from('micros').update({ status }).select('id, slug, title, status, module_id').limit(1);
    if (body.id) query = query.eq('id', body.id);
    else query = query.eq('slug', body.slug!);

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'micro_not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, micro: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 });
  }
}
