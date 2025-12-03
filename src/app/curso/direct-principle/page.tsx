"use client";

import { ChevronRight, Target, BookOpenCheck, Layers, Pencil, Save, X } from 'lucide-react';
import { microconceitos } from './micro';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';

type AdminStatus = { ok: boolean; isAdmin: boolean; uid?: string };
type MediaResp = { media?: { video_id: string } };
type SpotItem = { slug: string; title: string; est_minutes?: number | null };

export default function DirectPrinciplePage() {
  const [admin, setAdmin] = useState<AdminStatus | null>(null);
  const [mediaMap, setMediaMap] = useState<Record<string, string | null>>({});
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [videoInput, setVideoInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [spots, setSpots] = useState<SpotItem[]>([]);

  // Load admin status
  useEffect(() => {
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
        const res = await fetch('/api/admin/is-admin', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
          },
        });
        const json = await res.json();
        setAdmin(json);
      } catch {
        setAdmin({ ok: false, isAdmin: false });
      }
    })();
  }, []);

  // Fetch published micros for this course (public route)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/course/direct-principle/micros');
        const j = await res.json();
        if (res.ok && Array.isArray(j.items)) {
          // Validate availability: only include micros that are reachable by students
          const checks = await Promise.all(j.items.map(async (it: SpotItem) => {
            try {
              const r = await fetch(`/api/micro/${encodeURIComponent(it.slug)}`);
              return r.ok ? it : null;
            } catch { return null; }
          }));
          setSpots(checks.filter(Boolean) as SpotItem[]);
        } else {
          setSpots([]);
        }
      } catch {
        setSpots([]);
      }
    })();
  }, []);

  // Fetch media for each micro (only if admin)
  useEffect(() => {
    if (!admin?.isAdmin) return;
    microconceitos.forEach(async (m) => {
      try {
        const token = await auth.currentUser?.getIdToken().catch(() => undefined);
        const res = await fetch(`/api/admin/editorial/micro-media/get?slug=${encodeURIComponent(m.slug)}` , {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
          },
        });
        if (res.ok) {
          const j: MediaResp = await res.json();
            setMediaMap(prev => ({ ...prev, [m.slug]: j.media?.video_id || null }));
        } else {
          setMediaMap(prev => ({ ...prev, [m.slug]: null }));
        }
      } catch {
        setMediaMap(prev => ({ ...prev, [m.slug]: null }));
      }
    });
  }, [admin?.isAdmin]);

  async function saveVideo(slug: string) {
    if (!videoInput.trim()) return;
    setSaving(true); setSaveMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch('/api/admin/editorial/micro-media/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({ slug, provider: 'youtube', videoId: videoInput.trim(), privacy: 'public', requiredWatchPct: 0.7, allowBypass: true, requireFullWatch: false })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'Falha ao salvar');
      setMediaMap(prev => ({ ...prev, [slug]: videoInput.trim() }));
      setSaveMsg('Vídeo salvo');
      setEditingSlug(null);
      setVideoInput('');
    } catch (e: any) {
      setSaveMsg(e?.message || 'Erro');
    } finally {
      setSaving(false);
    }
  }

  const isAdmin = !!admin?.isAdmin;

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Direct Principle</h1>
          <p className="mt-1 text-sm text-slate-600">
            Primeira trilha do método Direct Principle. Foco na prática guiada e progressão direta.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <Target size={18} />
              <span className="font-semibold">Objetivo</span>
            </div>
            <p className="text-sm text-slate-600">
              Construir base sólida com prática objetiva (listening, pronúncia e vocabulário aplicado).
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <BookOpenCheck size={18} />
              <span className="font-semibold">Formato</span>
            </div>
            <p className="text-sm text-slate-600">
              Aulas curtas, exercícios imediatos e feedback contínuo. Sem enrolação.
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <Layers size={18} />
              <span className="font-semibold">Módulos</span>
            </div>
            <ul className="text-sm text-slate-600 list-disc pl-4">
              <li>Fundamentos Expressivos</li>
              <li>Compreensão Objetiva</li>
              <li>Vocabulário em Ação</li>
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Começar agora</h2>
          <p className="mt-1 text-sm text-slate-600">
            Inicie pela primeira prática guiada e acompanhe sua evolução.
          </p>
          <div className="mt-4">
            <a
              href="#praticas"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById('praticas');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Ir para prática <ChevronRight size={16} />
            </a>
          </div>
        </section>

        <section id="praticas" className="mt-8 grid gap-4 md:grid-cols-3">
          {spots.length > 0 && (
            <div className="md:col-span-3 rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Práticas Disponíveis</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spots.map(s => (
                  <Link key={s.slug} href={`/micro/${s.slug}`} className="rounded-lg border p-3 hover:border-slate-300">
                    <div className="text-sm font-medium text-slate-900">{s.title}</div>
                    <div className="text-xs text-slate-600">{s.est_minutes ? `${s.est_minutes} min` : 'Prática'}</div>
                    <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">Começar</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {microconceitos.map(mc => {
            const cardVideo = mediaMap[mc.slug];
            const editing = editingSlug === mc.slug;
            return (
              <div key={mc.slug} className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-300 relative">
                <a href={`/curso/direct-principle/${mc.slug}`} className="block">
                  <div className="mb-1 text-slate-900 font-semibold">{mc.title}</div>
                  <p className="text-sm text-slate-600">{mc.goal}</p>
                </a>
                <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                  Disponível
                </div>
                {isAdmin && !editing && (
                  <button
                    onClick={() => { setEditingSlug(mc.slug); setVideoInput(cardVideo || ''); setSaveMsg(null); }}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white hover:bg-black"
                  >
                    <Pencil size={12} /> {cardVideo ? 'Editar vídeo' : 'Add vídeo'}
                  </button>
                )}
                {isAdmin && editing && (
                  <div className="mt-3 space-y-2">
                    <input
                      value={videoInput}
                      onChange={e => setVideoInput(e.target.value)}
                      placeholder="YouTube ID"
                      className="w-full rounded border px-2 py-1 text-xs"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveVideo(mc.slug)}
                        disabled={saving || !videoInput.trim()}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                      >
                        <Save size={12} /> {saving ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        onClick={() => { setEditingSlug(null); setVideoInput(''); }}
                        className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700"
                      >
                        <X size={12} /> Cancelar
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {cardVideo ? <span>Atual: <span className="font-mono">{cardVideo}</span></span> : 'Sem vídeo vinculado'}
                      {saveMsg && <span className="ml-2 text-emerald-700">{saveMsg}</span>}
                    </div>
                    <div className="text-[10px] text-slate-500">Ao salvar, o micro precisa existir no banco; caso contrário crie no painel Editorial.</div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="rounded-2xl border bg-white p-5 shadow-sm opacity-70">
            <div className="mb-1 text-slate-900 font-semibold">Listening — Objetivo 01</div>
            <p className="text-sm text-slate-600">Clipes curtos com foco em compreensão e repetição.</p>
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
              Em breve
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm opacity-70">
            <div className="mb-1 text-slate-900 font-semibold">Vocabulário — Em Ação</div>
            <p className="text-sm text-slate-600">Palavras úteis aplicadas em situações reais.</p>
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
              Em breve
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
