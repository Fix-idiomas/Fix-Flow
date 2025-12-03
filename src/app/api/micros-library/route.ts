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

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ items: [] });
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').toLowerCase();
    const { data, error } = await sb
      .from('micro_library')
      .select('id, slug, title, goal, criteria, ai_mode, est_minutes, tags, status')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ items: [] });
    let items = (data || []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      goal: r.goal || undefined,
      criteria: r.criteria || [],
      ai_mode: r.ai_mode || undefined,
      est_minutes: r.est_minutes || undefined,
      tags: r.tags || [],
      status: r.status || 'active',
    }));
    if (q) items = items.filter(it => (it.title||'').toLowerCase().includes(q) || (it.goal||'').toLowerCase().includes(q));
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || 'erro' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = await req.json().catch(() => null) as any;
    if (!body || !body.title) return NextResponse.json({ error: 'payload_invalido' }, { status: 400 });
    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: 'supabase_config' }, { status: 500 });
    const slug = slugify(body.slug || body.title);
    const criteria = Array.isArray(body.criteria) ? body.criteria.filter((x: any)=>x && String(x).trim()).map((x:any)=>String(x).trim()) : [];
    const est = Number.isFinite(body.estMinutes) ? body.estMinutes : null;
    const ai_mode = ['auto','flash','pro'].includes(body.ai_mode || '') ? body.ai_mode : null;
    const tags = Array.isArray(body.tags) ? body.tags : null;
    const { data, error } = await sb.from('micro_library').insert({
      slug,
      title: String(body.title).trim(),
      goal: body.goal?.trim() || null,
      task: body.task?.trim() || null,
      criteria: criteria.length ? criteria : null,
      est_minutes: est,
      ai_mode,
      tags,
      status: 'active',
      created_by: admin.user_id,
      updated_at: new Date().toISOString(),
    }).select('id, slug, title, goal, criteria, ai_mode, est_minutes, tags, status').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 });
  }
}
