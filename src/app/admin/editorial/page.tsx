'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import VideoPicker from '@/components/VideoPicker';
import MicroPicker from '@/components/MicroPicker';

type AdminStatus = { ok: boolean; isAdmin: boolean; uid?: string; source?: 'env' | 'roles' };
type Micro = { id: string; slug: string; title: string; status: string; module_id: string };
type Course = { id: string; slug: string; title: string; status: string };
type Module = { id: string; course_id: string; title: string; ord: number };
type Media = { provider: 'youtube'; video_id: string; privacy: 'public'|'unlisted'; required_watch_pct?: number; allow_bypass?: boolean; require_full_watch?: boolean } | null;

export default function EditorialAdminPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  // seleção hierárquica
  const [selCourse, setSelCourse] = useState('');
  const [selModule, setSelModule] = useState('');
  const [selMicroSlug, setSelMicroSlug] = useState('');
  const [videoId, setVideoId] = useState('');
  const [reqPct, setReqPct] = useState('0.7');
  const [allowBypass, setAllowBypass] = useState(true);
  const [requireFullWatch, setRequireFullWatch] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [microPickerOpen, setMicroPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [micros, setMicros] = useState<Micro[]>([]);
  const [loadingMicros, setLoadingMicros] = useState(false);
  const [currentMedia, setCurrentMedia] = useState<Media>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [cTitle, setCTitle] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [mCourseId, setMCourseId] = useState('');
  const [mTitle, setMTitle] = useState('');
  const [creatingModule, setCreatingModule] = useState(false);
  const [microModuleId, setMicroModuleId] = useState('');
  const [microTitle, setMicroTitle] = useState('');
  const [microGoal, setMicroGoal] = useState('');
  const [microTask, setMicroTask] = useState('');
  const [microCriteria, setMicroCriteria] = useState('');
  const [microEstMinutes, setMicroEstMinutes] = useState('');
  const [creatingMicro, setCreatingMicro] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch('/api/admin/is-admin', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
      });
      const json = (await res.json().catch(() => ({}))) as AdminStatus;
      setStatus(json);
    })();
  }, []);

  const canEdit = useMemo(() => !!status?.isAdmin, [status]);

  useEffect(() => {
    if (!canEdit) return;
    (async () => {
      setLoadingMicros(true);
      try {
        const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
        const res = await fetch('/api/admin/editorial/micros', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
          },
        });
        const json = await res.json();
        if (res.ok && Array.isArray(json?.items)) {
          setMicros(json.items);
        }
        // load courses/modules
        const resCM = await fetch('/api/admin/editorial/courses-modules', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
          },
        });
        const jCM = await resCM.json();
        if (resCM.ok) {
          setCourses(Array.isArray(jCM.courses) ? jCM.courses : []);
          setModules(Array.isArray(jCM.modules) ? jCM.modules : []);
          if (!mCourseId && jCM.courses?.length) {
            setMCourseId(jCM.courses[0].id);
            setSelCourse(jCM.courses[0].id);
          }
          if (!microModuleId && jCM.modules?.length) {
            setMicroModuleId(jCM.modules[0].id);
            setSelModule(jCM.modules[0].id);
          }
          // definir micro selecionado inicial se combinar módulo
          const firstMicro = json?.items?.find((mi: Micro) => mi.module_id === (jCM.modules?.[0]?.id || ''));
          if (firstMicro) setSelMicroSlug(firstMicro.slug);
        }
      } finally {
        setLoadingMicros(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  // Auto-seleciona o primeiro módulo do curso atual para habilitar o botão
  useEffect(() => {
    if (!canEdit) return;
    if (!selCourse) return;
    if (selModule) return; // já selecionado
    const firstModule = modules.find(m => m.course_id === selCourse);
    if (firstModule) {
      setSelModule(firstModule.id);
    }
  }, [canEdit, selCourse, selModule, modules]);

  useEffect(() => {
    if (!canEdit || !selMicroSlug) { setCurrentMedia(null); setVideoId(''); return; }
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
        const res = await fetch(`/api/admin/editorial/micro-media/get?slug=${encodeURIComponent(selMicroSlug)}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
          },
        });
        const json = await res.json();
        if (res.ok) {
          setCurrentMedia(json.media ?? null);
          setVideoId(json.media?.video_id || '');
        } else {
          setCurrentMedia(null);
          setVideoId('');
        }
      } catch {
        setCurrentMedia(null);
      }
    })();
  }, [canEdit, selMicroSlug]);

  async function saveVideo() {
    setSaving(true);
    setMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch('/api/admin/editorial/micro-media/set', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({
          slug: selMicroSlug,
          provider: 'youtube',
          videoId,
          privacy: 'public',
          requiredWatchPct: requireFullWatch ? 1 : Math.max(0, Math.min(1, Number(reqPct || '0.7'))),
          allowBypass: requireFullWatch ? false : allowBypass,
          requireFullWatch,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Erro ao salvar');
      setMessage('Vídeo configurado com sucesso.');
      if (json?.row) {
        setCurrentMedia({
          provider: json.row.provider,
          video_id: json.row.video_id,
          privacy: json.row.privacy,
          required_watch_pct: json.row.required_watch_pct,
          allow_bypass: json.row.allow_bypass,
          require_full_watch: json.row.require_full_watch,
        } as any);
      }
    } catch (e: any) {
      setMessage(e?.message || 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function openPicker() {
    setPickerOpen(true);
  }
  function handleSelectVideo(it: any) {
    // Map selection to provider/videoId for existing API
    if (it.provider === 'youtube' && it.youtube_id) {
      setVideoId(it.youtube_id);
    } else {
      // For non-youtube, we would use future API; for now, set placeholder
      setVideoId('');
    }
    setPickerOpen(false);
  }

  async function updateMicroStatus(next: 'published' | 'draft') {
    if (!selMicroSlug) return;
    setPublishing(true); setMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch('/api/admin/editorial/micro', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({ slug: selMicroSlug, status: next })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Erro ao atualizar status');
      setMicros(prev => prev.map(mi => mi.slug === selMicroSlug ? { ...mi, status: j.micro.status } : mi));
      setMessage(next === 'published' ? 'Micro publicado.' : 'Micro despublicado.');
    } catch (e: any) {
      setMessage(e?.message || 'Falha ao publicar');
    } finally {
      setPublishing(false);
    }
  }

  async function addSpotToCourse() {
    if (!selMicroSlug || (!selCourse && !selModule)) { setMessage('Selecione curso ou módulo.'); return; }
    setPlacing(true); setMessage(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch('/api/admin/editorial/nav-spot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({ slug: selMicroSlug, course_id: selCourse || undefined, module_id: selModule || undefined })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Erro ao adicionar ao curso');
      setMessage('Micro adicionado ao curso/módulo.');
    } catch (e: any) {
      setMessage(e?.message || 'Falha ao adicionar ao curso');
    } finally {
      setPlacing(false);
    }
  }

  function openMicroPicker() {
    setMicroPickerOpen(true);
  }
  async function handleSelectMicroModel(it: any) {
    if (!selModule || !it?.id) { setMicroPickerOpen(false); return; }
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch(`/api/micros-library/${encodeURIComponent(it.id)}/instantiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({ module_id: selModule })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Falha ao inserir');
      // refresh micros list in UI
      setMicros(prev => [...prev, { id: j.micro.id, slug: j.micro.slug, title: j.micro.title, status: j.micro.status, module_id: j.micro.module_id }]);
      setSelMicroSlug(j.micro.slug);
      setCreateMsg('Micro inserido a partir da biblioteca.');
    } catch (e: any) {
      setCreateMsg(e?.message || 'Erro ao inserir');
    } finally {
      setMicroPickerOpen(false);
    }
  }

  async function createCourse() {
    setCreatingCourse(true); setCreateMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch('/api/admin/editorial/course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({ title: cTitle, description: cDesc }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Erro');
      setCourses((prev) => [...prev, j.course]);
      setMCourseId(j.course.id);
      setCTitle(''); setCDesc('');
      setCreateMsg('Curso criado.');
    } catch (e: any) { setCreateMsg(e?.message || 'Falha curso'); }
    finally { setCreatingCourse(false); }
  }

  async function createModule() {
    if (!mCourseId) return;
    setCreatingModule(true); setCreateMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch('/api/admin/editorial/module', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({ course_id: mCourseId, title: mTitle }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Erro');
      setModules((prev) => [...prev, j.module]);
      setMicroModuleId(j.module.id);
      setMTitle('');
      setCreateMsg('Módulo criado.');
    } catch (e: any) { setCreateMsg(e?.message || 'Falha módulo'); }
    finally { setCreatingModule(false); }
  }

  async function createMicro() {
    if (!microModuleId || !microTitle) return;
    setCreatingMicro(true); setCreateMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken(true).catch(() => undefined);
      const res = await fetch('/api/admin/editorial/micro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
        },
        body: JSON.stringify({
          module_id: microModuleId,
          title: microTitle,
          goal: microGoal || undefined,
          task: microTask || undefined,
          criteria: microCriteria.split(',').map(c => c.trim()).filter(Boolean),
          estMinutes: microEstMinutes ? Number(microEstMinutes) : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'Erro');
      setMicros((prev) => [...prev, { id: j.micro.id, slug: j.micro.slug, title: j.micro.title, status: j.micro.status, module_id: j.micro.module_id }]);
      setSelMicroSlug(j.micro.slug);
      setMicroTitle(''); setMicroGoal(''); setMicroTask(''); setMicroCriteria(''); setMicroEstMinutes('');
      setCreateMsg('Micro criado.');
    } catch (e: any) { setCreateMsg(e?.message || 'Falha micro'); }
    finally { setCreatingMicro(false); }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Editorial Admin</h1>
          <Link href="/admin" className="text-sm text-slate-700 hover:text-slate-900">Voltar</Link>
        </div>
        <section className="mb-4 rounded-lg border bg-white p-4 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Seu status</div>
              <div className="text-slate-700">UID: {status?.uid ?? '—'}</div>
            </div>
            <div className={"rounded px-2 py-1 text-xs font-semibold " + (canEdit ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800") }>
              {canEdit ? `Admin (${status?.source ?? '—'})` : 'Sem permissão'}
            </div>
          </div>
        </section>
        {!canEdit ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">Você precisa ser admin/owner para editar.</div>
        ) : (
          <div className="grid gap-6">
            <section className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold">Seleção hierárquica</h2>
              <p className="mt-1 text-xs text-slate-600">Curso → Módulo → Micro para vincular vídeo.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-medium">Curso</label>
                  <select value={selCourse} onChange={e=>{ setSelCourse(e.target.value); setSelModule(''); setSelMicroSlug(''); }} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                    <option value="">--</option>
                    {courses.map(c=> <option key={c.id} value={c.id}>{c.slug} — {c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Módulo</label>
                  <select value={selModule} onChange={e=>{ setSelModule(e.target.value); setSelMicroSlug(''); }} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                    <option value="">--</option>
                    {modules.filter(m=> !selCourse || m.course_id === selCourse).map(m=> <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Micro</label>
                  <select value={selMicroSlug} onChange={e=> setSelMicroSlug(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                    <option value="">--</option>
                    {micros.filter(mi=> !selModule || mi.module_id === selModule).map(mi=> <option key={mi.id} value={mi.slug}>{mi.slug} — {mi.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <button onClick={openMicroPicker} disabled={!selModule} className="rounded bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-800">Adicionar micro da biblioteca…</button>
              </div>
              {selMicroSlug && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Vídeo</h3>
                  <div className="mb-2 flex items-center gap-2 text-xs">
                    <span className={"inline-flex items-center rounded px-2 py-0.5 font-semibold " +
                      ((micros.find(m=>m.slug===selMicroSlug)?.status === 'published') ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700')
                    }>
                      Status: {micros.find(m=>m.slug===selMicroSlug)?.status || '—'}
                    </span>
                    <button onClick={()=>updateMicroStatus('published')} disabled={publishing || micros.find(m=>m.slug===selMicroSlug)?.status==='published'} className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{publishing ? '...' : 'Publicar'}</button>
                    <button onClick={()=>updateMicroStatus('draft')} disabled={publishing || micros.find(m=>m.slug===selMicroSlug)?.status==='draft'} className="rounded bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-800 disabled:opacity-50">{publishing ? '...' : 'Despublicar'}</button>
                    <button onClick={addSpotToCourse} disabled={placing || (!selCourse && !selModule) || !selMicroSlug} className="rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">{placing ? '...' : 'Adicionar ao curso'}</button>
                  </div>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium">YouTube Video ID</label>
                      <input value={videoId} onChange={e=> setVideoId(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="ex: dQw4w9WgXcQ" />
                    </div>
                    <div className="text-xs text-slate-600 flex items-end">
                      {currentMedia ? (
                        <span>Atual: <span className="font-mono">{currentMedia.video_id}</span> • {(currentMedia.required_watch_pct ?? 0.7)*100}%</span>
                      ) : (
                        <span>Nenhum vídeo vinculado</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-medium">Percentual exigido</label>
                      <input
                        value={reqPct}
                        onChange={e=> setReqPct(e.target.value)}
                        disabled={requireFullWatch}
                        className="mt-1 w-full rounded border px-3 py-2 text-sm"
                        placeholder="0.7"
                      />
                      <div className="mt-1 text-[11px] text-slate-500">0.0–1.0 (ex.: 0.7 = 70%)</div>
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2 text-xs font-medium">
                        <input type="checkbox" checked={allowBypass} onChange={e=> setAllowBypass(e.target.checked)} disabled={requireFullWatch} />
                        Permitir bypass
                      </label>
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2 text-xs font-medium">
                        <input type="checkbox" checked={requireFullWatch} onChange={e=> setRequireFullWatch(e.target.checked)} />
                        Exigir 100% (sem bypass)
                      </label>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex gap-2">
                      <button onClick={saveVideo} disabled={saving || !selMicroSlug || !videoId} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar vídeo'}</button>
                      <button onClick={openPicker} disabled={!selMicroSlug} className="rounded bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">Selecionar da biblioteca</button>
                    </div>
                  </div>
                  {message && <div className="mt-2 text-xs text-slate-700">{message}</div>}
                </div>
              )}
            </section>

            <section className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold">Criar curso</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium">Título</label>
                  <input value={cTitle} onChange={e=>setCTitle(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Ex: Inglês Essencial" />
                </div>
                <div>
                  <label className="text-xs font-medium">Descrição</label>
                  <input value={cDesc} onChange={e=>setCDesc(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Resumo" />
                </div>
              </div>
              <div className="mt-3">
                <button onClick={createCourse} disabled={creatingCourse || !cTitle.trim()} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{creatingCourse ? 'Criando...' : 'Criar curso'}</button>
              </div>
            </section>

            <section className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold">Criar módulo</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium">Curso</label>
                  <select value={mCourseId} onChange={e=>setMCourseId(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                    {courses.map(c => <option key={c.id} value={c.id}>{c.slug} — {c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Título do módulo</label>
                  <input value={mTitle} onChange={e=>setMTitle(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Ex: Fundamentos" />
                </div>
              </div>
              <div className="mt-3">
                <button onClick={createModule} disabled={creatingModule || !mCourseId || !mTitle.trim()} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{creatingModule ? 'Criando...' : 'Criar módulo'}</button>
              </div>
            </section>

            <section className="rounded-lg border bg-white p-4">
              <h2 className="text-sm font-semibold">Criar micro</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium">Módulo</label>
                  <select value={microModuleId} onChange={e=>setMicroModuleId(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm">
                    {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Título do micro</label>
                  <input value={microTitle} onChange={e=>setMicroTitle(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Ex: Apresentação" />
                </div>
                <div>
                  <label className="text-xs font-medium">Goal</label>
                  <input value={microGoal} onChange={e=>setMicroGoal(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Objetivo" />
                </div>
                <div>
                  <label className="text-xs font-medium">Est. minutos</label>
                  <input value={microEstMinutes} onChange={e=>setMicroEstMinutes(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Ex: 8" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium">Task</label>
                  <textarea value={microTask} onChange={e=>setMicroTask(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={3} placeholder="Instrução da tarefa" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium">Critérios (separados por vírgula)</label>
                  <input value={microCriteria} onChange={e=>setMicroCriteria(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="clareza, vocabulário, fluência" />
                </div>
              </div>
              <div className="mt-3">
                <button onClick={createMicro} disabled={creatingMicro || !microModuleId || !microTitle.trim()} className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{creatingMicro ? 'Criando...' : 'Criar micro'}</button>
              </div>
            </section>
            {createMsg && <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-700">{createMsg}</div>}
          </div>
        )}
      </div>
      <VideoPicker open={pickerOpen} onClose={()=>setPickerOpen(false)} onSelect={handleSelectVideo} />
      <MicroPicker open={microPickerOpen} onClose={()=>setMicroPickerOpen(false)} onSelect={handleSelectMicroModel} />
    </main>
  );
}
