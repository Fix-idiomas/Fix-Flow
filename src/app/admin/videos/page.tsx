"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { Plus, Search, UploadCloud, Edit, Trash2 } from "lucide-react";

type AdminStatus = { ok: boolean; isAdmin: boolean };

type VideoItem = {
  id: string;
  provider: "youtube" | "supabase" | "external";
  title?: string;
  channel?: string;
  duration_sec?: number;
  tags?: string[];
  status?: "active" | "archived";
  youtube_id?: string;
  storage_path?: string;
  mime_type?: string;
};

export default function AdminVideosPage() {
  const [admin, setAdmin] = useState<AdminStatus | null>(null);
  const [items, setItems] = useState<VideoItem[]>([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [ytInput, setYtInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
        const res = await fetch("/api/admin/is-admin", {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { "x-firebase-uid": auth.currentUser.uid } : {}),
          },
        });
        const json = await res.json();
        setAdmin(json);
      } catch {
        setAdmin({ ok: false, isAdmin: false });
      }
    })();
  }, []);

  useEffect(() => {
    if (!admin?.isAdmin) return;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken().catch(() => undefined);
        const res = await fetch("/api/videos?q=" + encodeURIComponent(q), {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { "x-firebase-uid": auth.currentUser.uid } : {}),
          },
        });
        if (res.ok) {
          const j = await res.json();
          setItems(Array.isArray(j.items) ? j.items : []);
        } else {
          setItems([]);
        }
      } catch {
        setItems([]);
      }
    })();
  }, [admin?.isAdmin, q]);

  async function createYouTube() {
    const trimmed = ytInput.trim();
    if (!trimmed) return;
    setCreating(true); setMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { "x-firebase-uid": auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({ provider: "youtube", input: trimmed })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || "Falha ao criar");
      setItems(prev => [j.item, ...prev]);
      setYtInput("");
      setMessage("Vídeo adicionado");
    } catch (e: any) {
      setMessage(e?.message || "Erro ao adicionar");
    } finally {
      setCreating(false);
    }
  }

  const isAdmin = !!admin?.isAdmin;
  const filtered = useMemo(() => {
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter(it => (it.title||"").toLowerCase().includes(needle) || (it.channel||"").toLowerCase().includes(needle) || (it.youtube_id||"").toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Biblioteca de Vídeos</h1>
          <div className={"rounded px-2 py-1 text-xs font-semibold " + (isAdmin ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
            {isAdmin ? "Admin" : "Sem permissão"}
          </div>
        </div>

        <section className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 text-slate-500" size={16} />
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por título, canal ou ID" className="w-full rounded border pl-7 px-3 py-2 text-sm" />
            </div>
            <button className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              <UploadCloud size={16}/> Upload (Supabase)
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-600">Upload ainda não implementado — começamos pelo YouTube.</div>
        </section>

        <section className="mt-6 rounded-lg border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">Adicionar vídeo do YouTube</div>
          <div className="flex items-center gap-2">
            <input value={ytInput} onChange={e=>setYtInput(e.target.value)} placeholder="Cole URL ou ID do YouTube" className="flex-1 rounded border px-3 py-2 text-sm" />
            <button onClick={createYouTube} disabled={!isAdmin || creating || !ytInput.trim()} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Plus size={16}/> {creating ? "Adicionando..." : "Adicionar"}
            </button>
          </div>
          {message && <div className="mt-2 text-xs text-slate-700">{message}</div>}
        </section>

        <section className="mt-6 rounded-lg border bg-white p-4">
          <div className="mb-3 text-sm font-semibold">Vídeos</div>
          {filtered.length === 0 ? (
            <div className="text-sm text-slate-600">Nenhum vídeo encontrado. Adicione com YouTube ou aguarde backend.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(v => (
                <div key={v.id} className="rounded-lg border p-3">
                  <div className="aspect-video relative mb-2 rounded bg-slate-100">
                    {/* YouTube thumb */}
                    {v.provider === "youtube" && v.youtube_id ? (
                      <Image src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`} alt={v.title||v.youtube_id} fill className="object-cover rounded" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-xs text-slate-500">Sem miniatura</div>
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-900">{v.title || v.youtube_id || v.storage_path || "Vídeo"}</div>
                  <div className="text-xs text-slate-600">{v.channel || v.mime_type || v.provider}</div>
                  <div className="mt-2 flex gap-2">
                    <button className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700"><Edit size={12}/> Editar</button>
                    <button className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[11px] text-red-700"><Trash2 size={12}/> Arquivar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
