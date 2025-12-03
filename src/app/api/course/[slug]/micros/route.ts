import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> } ) {
  try {
    const sb = getSupabaseAdmin();
    const { slug } = await ctx.params;
    if (!slug) return NextResponse.json({ error: 'slug_obrigatorio' }, { status: 400 });

    const { data: course } = await sb.from('courses').select('id, slug, title, status').eq('slug', slug).maybeSingle();
    if (!course?.id) return NextResponse.json({ error: 'course_not_found' }, { status: 404 });

    // Prefer nav_spots ordering; only include published micros
    const { data: spots } = await sb
      .from('nav_spots')
      .select('entity_id, ord, visible, micros:entity_id(slug, title, est_minutes, status)')
      .eq('course_id', course.id)
      .eq('entity_type', 'micro')
      .eq('visible', true)
      .order('ord', { ascending: true });

    let items: any[] = [];
    for (const s of (spots || [])) {
      const m = Array.isArray((s as any).micros) ? (s as any).micros[0] : (s as any).micros;
      if (m?.status === 'published') {
        items.push({ slug: m.slug, title: m.title, est_minutes: m.est_minutes ?? null });
      }
    }

    // Fallback: if no spots, list published micros by modules of the course
    if (items.length === 0) {
      const { data: modules } = await sb.from('modules').select('id').eq('course_id', course.id);
      const moduleIds = (modules || []).map((m: any) => m.id);
      if (moduleIds.length) {
        const { data: micros } = await sb
          .from('micros')
          .select('slug, title, est_minutes, status, module_id')
          .in('module_id', moduleIds)
          .eq('status', 'published')
          .order('slug');
        items = (micros || []).map((m: any) => ({ slug: m.slug, title: m.title, est_minutes: m.est_minutes ?? null }));
      }
    }

    return NextResponse.json({ ok: true, course: { id: course.id, slug: course.slug, title: course.title }, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 });
  }
}
