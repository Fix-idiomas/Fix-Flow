'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Loader2, Send } from 'lucide-react';
import { getMicro } from '../micro';
import VideoGate from '@/components/VideoGate';
import { auth } from '@/lib/firebase';

type AnalyzeResponse = {
  scores: Record<string, number>;
  overallComment: string;
  improvementSuggestion: string;
  confidence: number;
  modelUsed: string;
  escalated: boolean;
};

export default function MicroPage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const micro = useMemo(() => getMicro(slug), [slug]);

  const [submission, setSubmission] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [practiceSent, setPracticeSent] = useState(false);

  if (!micro) {
    return (
      <main className="min-h-screen bg-gray-50 text-slate-800">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
            <ChevronLeft size={16} /> Voltar
          </button>
          <h1 className="mt-4 text-lg font-semibold">Microconceito não encontrado</h1>
          <p className="mt-1 text-sm text-slate-600">Verifique o link e tente novamente.</p>
        </div>
      </main>
    );
  }

  async function handleAnalyze() {
    if (!micro) {
      setError('Micro não carregado');
      return;
    }
    if (!practiceSent && unlocked && micro.video) {
      try {
        const token = await auth.currentUser?.getIdToken().catch(() => undefined);
        fetch('/api/track/video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
          },
          body: JSON.stringify({ slug: micro.slug, videoId: micro.video.videoId, event: 'practice_started' }),
        }).catch(() => {});
      } catch {}
      setPracticeSent(true);
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: micro.task,
          submission,
          criteria: micro.criteria,
          mode: micro.mode ?? 'auto',
        }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Erro' }));
        throw new Error(error || 'Falha na análise');
      }
      const json = (await res.json()) as AnalyzeResponse;
      setResult(json);
    } catch (e: any) {
      setError(e?.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4">
          <Link href="/curso/direct-principle" className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900">
            <ChevronLeft size={16} /> Voltar
          </Link>
        </div>
        <header>
          <h1 className="text-xl font-semibold text-slate-900">{micro.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{micro.goal}</p>
          {micro.estMinutes ? (
            <p className="mt-1 text-xs text-slate-500">Tempo estimado: {micro.estMinutes} min</p>
          ) : null}
        </header>

        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Tarefa</h2>
          <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{micro.task}</p>
          <div className="mt-3 text-xs text-slate-600">
            Critérios: {micro.criteria.join(', ')}
          </div>
        </section>

        {micro.video ? (
          <section className="mt-6">
            <VideoGate
              slug={micro.slug}
              videoId={micro.video.videoId}
              requiredWatchPct={micro.video.requireFullWatch ? 1 : micro.video.requiredWatchPct}
              allowBypass={!!micro.video.allowBypass && !micro.video.requireFullWatch}
              requireFullWatch={!!micro.video.requireFullWatch}
              onUnlock={() => setUnlocked(true)}
            />
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-900" htmlFor="submission">Sua resposta</label>
          <textarea
            id="submission"
            className="mt-2 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            rows={6}
            placeholder="Escreva aqui sua apresentação em inglês..."
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
            disabled={!!micro.video && !unlocked}
            onFocus={async () => {
              if (!practiceSent && unlocked && micro?.video) {
                try {
                  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
                  fetch('/api/track/video', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      ...(auth.currentUser?.uid ? { 'x-firebase-uid': auth.currentUser.uid } : {}),
                    },
                    body: JSON.stringify({ slug: micro.slug, videoId: micro.video.videoId, event: 'practice_started' }),
                  }).catch(() => {});
                } catch {}
                setPracticeSent(true);
              }
            }}
          />
          <div className="mt-3">
            {micro.video && !unlocked ? (
              <div className="mb-2 text-xs text-amber-700">Assista ao vídeo para liberar a prática.</div>
            ) : null}
            <button
              onClick={handleAnalyze}
              disabled={loading || submission.trim().length < 20 || (!!micro.video && !unlocked)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              {loading ? 'Analisando...' : 'Analisar com IA'}
            </button>
          </div>
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </section>

        {result && (
          <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Resultado</h2>
            <div className="mt-3 grid gap-2">
              {Object.entries(result.scores).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-medium text-slate-700 capitalize">{k}</div>
                  <div className="relative h-2 flex-1 rounded bg-slate-200">
                    <div className="absolute left-0 top-0 h-2 rounded bg-emerald-500" style={{ width: `${(Math.min(10, Math.max(0, v)) / 10) * 100}%` }} />
                  </div>
                  <div className="w-10 text-right text-xs text-slate-600">{v.toFixed(1)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-slate-700">
              <div className="font-semibold">Comentário geral</div>
              <p className="mt-1">{result.overallComment || '—'}</p>
              <div className="mt-3 font-semibold">Sugestão de melhoria</div>
              <p className="mt-1">{result.improvementSuggestion || '—'}</p>
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Modelo: {result.modelUsed} • Confiança: {(result.confidence * 100).toFixed(0)}%
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
