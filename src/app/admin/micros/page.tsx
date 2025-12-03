"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Plus, Search, Edit, Tags, Library } from "lucide-react";

type AdminStatus = { ok: boolean; isAdmin: boolean };

export type MicroModel = {
  id: string;
  slug: string;
  title: string;
  goal?: string;
  task?: string;
  criteria?: string[];
  ai_mode?: "auto" | "flash" | "pro";
  est_minutes?: number;
  tags?: string[];
  status?: "active" | "archived";
};

export default function AdminMicrosPage() {
  const [admin, setAdmin] = useState<AdminStatus | null>(null);
  const [items, setItems] = useState<MicroModel[]>([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [task, setTask] = useState("");
  const [criteria, setCriteria] = useState("");
  const [est, setEst] = useState("");
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
        const res = await fetch("/api/micros-library?q=" + encodeURIComponent(q), {
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

  async function createMicroModel() {
    if (!title.trim()) return;
    setCreating(true); setMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch("/api/micros-library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { "x-firebase-uid": auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({
          title,
          goal: goal || undefined,
          task: task || undefined,
          criteria: criteria.split(',').map(s=>s.trim()).filter(Boolean),
          estMinutes: est ? Number(est) : undefined,
        })
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(j?.error || "Falha ao criar");
      setItems(prev => [j.item, ...prev]);
      setTitle(""); setGoal(""); setTask(""); setCriteria(""); setEst("");
      setMessage("Micro adicionado à biblioteca");
    } catch (e: any) {
      setMessage(e?.message || "Erro ao adicionar");
    } finally {
      setCreating(false);
    }
  }

  const isAdmin = !!admin?.isAdmin;

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Biblioteca de Micros</h1>
          <div className={"rounded px-2 py-1 text-xs font-semibold " + (isAdmin ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
            {isAdmin ? "Admin" : "Sem permissão"}
          </div>
        </div>

        <section className="rounded-lg border bg-white p-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 text-slate-500" size={16} />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por título, tags..." className="w-full rounded border pl-7 px-3 py-2 text-sm" />
          </div>
          <div className="mt-2 text-xs text-slate-600">Lista depende do backend — exibimos vazia por enquanto.</div>
        </section>

        <section className="mt-6 rounded-lg border bg-white p-4">
          <div className="mb-2 text-sm font-semibold">Criar micro modelo</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Título</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Ex: Apresentação direta" />
            </div>
            <div>
              <label className="text-xs font-medium">Est. minutos</label>
              <input value={est} onChange={e=>setEst(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Ex: 5" />
            </div>
            <div>
              <label className="text-xs font-medium">Goal</label>
              <input value={goal} onChange={e=>setGoal(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Objetivo" />
            </div>
            <div>
              <label className="text-xs font-medium">Critérios (vírgula)</label>
              <input value={criteria} onChange={e=>setCriteria(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="clareza, vocabulário, gramática" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium">Tarefa</label>
              <textarea value={task} onChange={e=>setTask(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={3} placeholder="Instrução da tarefa" />
            </div>
          </div>
          <div className="mt-3">
            <button onClick={createMicroModel} disabled={!isAdmin || creating || !title.trim()} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Plus size={16}/> {creating ? "Adicionando..." : "Adicionar"}
            </button>
            {message && <div className="mt-2 text-xs text-slate-700">{message}</div>}
          </div>
        </section>

        <section className="mt-6 rounded-lg border bg-white p-4">
          <div className="mb-3 text-sm font-semibold">Modelos</div>
          {items.length === 0 ? (
            <div className="text-sm text-slate-600">Nenhum micro. Crie acima ou aguarde backend.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(m => (
                <div key={m.id} className="rounded-lg border p-3">
                  <div className="text-sm font-medium text-slate-900">{m.title}</div>
                  <div className="text-xs text-slate-600">{m.goal || "—"}</div>
                  <div className="mt-2 text-[11px] text-slate-500 inline-flex items-center gap-1"><Tags size={12}/> {(m.tags||[]).join(', ') || 'sem tags'}</div>
                  <div className="mt-2">
                    <button className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700"><Edit size={12}/> Editar</button>
                    <button className="ml-2 inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700"><Library size={12}/> Inserir...</button>
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
