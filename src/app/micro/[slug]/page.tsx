import MicroClient from "./MicroClient";
import { createClient } from "@supabase/supabase-js";

export type MicroData = {
  id: string;
  slug: string;
  title: string;
  goal: string | null;
  task: string | null;
  criteria: string[] | null;
  ai_mode: string | null;
  est_minutes: number | null;
  status: string;
  module_id: string;
};
export type MediaData = {
  provider: 'youtube';
  video_id: string;
  required_watch_pct?: number;
  allow_bypass?: boolean;
  require_full_watch?: boolean;
} | null;

async function fetchMicro(slug: string) {
  const sb = getSupabaseAdmin();
  const { data: micro } = await sb
    .from("micros")
    .select("id, slug, title, goal, task, criteria, ai_mode, est_minutes, status, module_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!micro) return null;
  const { data: media } = await sb
    .from("micro_media")
    .select("provider, video_id, privacy, required_watch_pct, allow_bypass, require_full_watch, duration_sec")
    .eq("micro_id", micro.id)
    .maybeSingle();
  return { ok: true, micro, media, published: micro.status === "published" } as { micro: MicroData; media: MediaData; published: boolean };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function MicroDynamicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  if (!rawSlug || rawSlug === 'undefined') {
    return (
      <div className="rounded border bg-white p-4 text-sm text-slate-700">Micro não encontrado.</div>
    );
  }
  const data = await fetchMicro(rawSlug);
  if (!data) {
    return (
      <div className="rounded border bg-white p-4 text-sm text-slate-700">Micro não encontrado.</div>
    );
  }
  const { micro, media } = data;
  return <MicroClient micro={micro} media={media} />;
}
