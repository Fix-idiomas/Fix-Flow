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

async function requireAdmin(req: Request): Promise<{ user_id: string } | null> {
  const authz = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  let uid = token ? await verifyFirebaseIdToken(token) : null;
  if (!uid) uid = req.headers.get("x-firebase-uid");
  if (!uid) return null;
  const sb = getSupabaseAdmin();
  const { data: u } = await sb.from("users").select("id").eq("firebase_uid", uid).maybeSingle();
  const user_id = u?.id as string | undefined;
  if (!user_id) return null;
  const { data: roles } = await sb.from("user_roles").select("roles(name)").eq("user_id", user_id);
  const isAdmin = Array.isArray(roles) && roles.some((r: any) => ["owner","admin","teacher"].includes(r.roles?.name));
  return isAdmin ? { user_id } : null;
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => null) as { micro_id?: string; slug?: string; course_id?: string; module_id?: string; ord?: number; visible?: boolean } | null;
    if (!body || (!body.micro_id && !body.slug) || (!body.course_id && !body.module_id)) {
      return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }
    let micro_id = body.micro_id || null;
    if (!micro_id && body.slug) {
      const { data: m } = await sb.from("micros").select("id").eq("slug", body.slug).maybeSingle();
      micro_id = m?.id || null;
    }
    if (!micro_id) return NextResponse.json({ error: "micro_not_found" }, { status: 404 });
    const ord = Number.isFinite(body.ord) ? (body.ord as number) : 1;
    const visible = typeof body.visible === 'boolean' ? body.visible : true;
    const { data, error } = await sb
      .from("nav_spots")
      .upsert({
        entity_type: 'micro',
        entity_id: micro_id,
        course_id: body.course_id || null,
        module_id: body.module_id || null,
        ord,
        visible,
        created_by: admin.user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "entity_type,entity_id,course_id,module_id" })
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, spot: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get('slug') || '').trim();
    const course_id = (searchParams.get('course_id') || '').trim();
    const module_id = (searchParams.get('module_id') || '').trim();
    if (!slug && !searchParams.get('micro_id')) return NextResponse.json({ error: 'payload_invalido' }, { status: 400 });
    let micro_id = searchParams.get('micro_id');
    if (!micro_id && slug) {
      const { data: m } = await sb.from('micros').select('id').eq('slug', slug).maybeSingle();
      micro_id = m?.id || undefined;
    }
    if (!micro_id) return NextResponse.json({ error: 'micro_not_found' }, { status: 404 });
    const { error } = await sb
      .from('nav_spots')
      .delete()
      .eq('entity_type','micro')
      .eq('entity_id', micro_id)
      .eq('course_id', course_id || null)
      .eq('module_id', module_id || null);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 });
  }
}
