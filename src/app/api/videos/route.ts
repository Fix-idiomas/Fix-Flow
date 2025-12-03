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

async function requireAdmin(req: Request): Promise<{ uid: string; user_id: string; ok: boolean } | null> {
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
  return isAdmin ? { uid, user_id, ok: true } : null;
}

function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  // Direct ID
  if (/^[a-zA-Z0-9_-]{8,20}$/.test(s)) return s;
  // youtu.be/<id>
  const m1 = s.match(/youtu\.be\/([a-zA-Z0-9_-]{8,20})/);
  if (m1) return m1[1];
  // youtube.com/watch?v=<id>
  const m2 = s.match(/[?&]v=([a-zA-Z0-9_-]{8,20})/);
  if (m2) return m2[1];
  // shorts
  const m3 = s.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{8,20})/);
  if (m3) return m3[1];
  return null;
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ items: [] });

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").toLowerCase();

    // Fetch from persistent library
    let query = sb
      .from("video_library")
      .select("id, provider, youtube_id, storage_path, mime_type, title, channel, duration_sec, tags, status, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (q) {
      // Match title, channel or youtube_id
      query = query.or(`title.ilike.%${q}%,channel.ilike.%${q}%,youtube_id.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ items: [], error: error.message });

    let items = (data || []).map((row: any) => ({
      id: row.id as string,
      provider: row.provider as "youtube" | "supabase" | "external",
      youtube_id: row.youtube_id || undefined,
      storage_path: row.storage_path || undefined,
      mime_type: row.mime_type || undefined,
      title: row.title || undefined,
      channel: row.channel || undefined,
      duration_sec: row.duration_sec || undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
      status: row.status || "active",
    }));

    // Backward-compat: if library is empty, fall back to distinct videos from micro_media
    if ((!items || items.length === 0) && !q) {
      const { data: mm, error: mmErr } = await sb
        .from("micro_media")
        .select("video_id, duration_sec, updated_at, micros:micro_id(slug, title)")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (!mmErr && Array.isArray(mm)) {
        const map = new Map<string, any>();
        for (const row of mm) {
          const vid = (row as any).video_id as string;
          if (!map.has(vid)) {
            const firstMicro = Array.isArray((row as any).micros) ? (row as any).micros[0] : (row as any).micros;
            const title = firstMicro?.title || undefined;
            map.set(vid, {
              id: vid,
              provider: "youtube" as const,
              youtube_id: vid,
              title,
              channel: undefined,
              duration_sec: (row as any).duration_sec || undefined,
              status: "active" as const,
              tags: [] as string[],
            });
          }
        }
        items = Array.from(map.values());
      }
    }
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || "erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const body = (await req.json().catch(() => null)) as { provider?: string; input?: string } | null;
    if (!body || body.provider !== "youtube" || !body.input) {
      return NextResponse.json({ error: "payload_invalido" }, { status: 400 });
    }
    const id = parseYouTubeId(body.input);
    if (!id) return NextResponse.json({ error: "youtube_id_invalido" }, { status: 400 });

    const sb = getSupabaseAdmin();
    if (!sb) return NextResponse.json({ error: "supabase_config" }, { status: 500 });

    const { data, error } = await sb
      .from("video_library")
      .upsert(
        {
          provider: "youtube",
          youtube_id: id,
          status: "active",
          created_by: admin.user_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,youtube_id" }
      )
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const item = {
      id: data?.id as string,
      provider: data?.provider as "youtube",
      youtube_id: data?.youtube_id as string,
      title: data?.title || undefined,
      channel: data?.channel || undefined,
      duration_sec: data?.duration_sec || undefined,
      status: (data?.status as "active" | "archived") || "active",
      tags: Array.isArray(data?.tags) ? (data?.tags as string[]) : [],
      storage_path: data?.storage_path || undefined,
      mime_type: data?.mime_type || undefined,
    };
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "erro" }, { status: 500 });
  }
}
