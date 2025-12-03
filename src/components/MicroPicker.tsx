"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Search, Check, X } from "lucide-react";

export type MicroModelItem = {
  id: string;
  slug: string;
  title: string;
  goal?: string;
  tags?: string[];
};

export default function MicroPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (item: MicroModelItem) => void; }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MicroModelItem[]>([]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div className="absolute left-1/2 top-10 w-[680px] -translate-x-1/2 rounded-lg border bg-white p-4" onClick={e=>e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Selecionar micro</div>
          <button onClick={onClose} className="rounded bg-slate-200 px-2 py-1 text-[11px] text-slate-700 inline-flex items-center gap-1"><X size={12}/> Fechar</button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 text-slate-500" size={16} />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar micros..." className="w-full rounded border pl-7 px-3 py-2 text-sm" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {items.length === 0 ? (
            <div className="text-sm text-slate-600">Nenhum micro na biblioteca.</div>
          ) : items.map(it => (
            <div key={it.id} className="rounded border p-3">
              <div className="text-sm font-medium text-slate-900">{it.title}</div>
              <div className="text-xs text-slate-600">{it.goal || '—'}</div>
              <div className="mt-1 text-[11px] text-slate-500">{(it.tags||[]).join(', ')}</div>
              <div className="mt-2">
                <button onClick={() => onSelect(it)} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white"><Check size={12}/> Selecionar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
