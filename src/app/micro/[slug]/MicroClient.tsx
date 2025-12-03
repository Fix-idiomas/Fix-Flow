"use client";
import VideoGate from "@/components/VideoGate";
import { auth } from "@/lib/firebase";
import { useState } from "react";
import type { MicroData, MediaData } from "./page";

export default function MicroClient({ micro, media }: { micro: MicroData; media: MediaData }) {
  const hasVideo = !!media?.video_id;
  const [unlocked, setUnlocked] = useState(!hasVideo);
  const [practiceSent, setPracticeSent] = useState(false);
  const [submission, setSubmission] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function handleAnalyze() {
    if (!practiceSent && unlocked && hasVideo) {
      try {
        const token = await auth.currentUser?.getIdToken().catch(() => undefined);
        fetch("/api/track/video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(auth.currentUser?.uid ? { "x-firebase-uid": auth.currentUser.uid } : {}),
          },
          body: JSON.stringify({ slug: micro.slug, videoId: media?.video_id || "unknown", event: "practice_started" }),
        }).catch(() => {});
      } catch {}
      setPracticeSent(true);
    }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: micro.task,
          submission,
          criteria: micro.criteria || [],
          mode: micro.ai_mode || "auto",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Falha na análise");
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">{micro.title}</h1>
          {micro.goal && <p className="mt-1 text-sm text-slate-600">{micro.goal}</p>}
          {micro.est_minutes ? <p className="mt-1 text-xs text-slate-500">Tempo estimado: {micro.est_minutes} min</p> : null}
          {micro.status !== "published" && <p className="mt-2 text-xs text-amber-600">Rascunho (visível apenas para papéis privilegiados)</p>}
        </header>
        {hasVideo && media?.video_id && (
          <section className="mt-6">
            <VideoGate
              slug={micro.slug}
              videoId={media.video_id}
              requiredWatchPct={media.require_full_watch ? 1 : (media.required_watch_pct ?? 0.7)}
              allowBypass={!!media.allow_bypass && !media.require_full_watch}
              requireFullWatch={!!media.require_full_watch}
              onUnlock={() => setUnlocked(true)}
            />
          </section>
        )}
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-900" htmlFor="submission">Sua resposta</label>
          <textarea
            id="submission"
            className="mt-2 w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            rows={6}
            placeholder="Escreva aqui..."
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
            disabled={hasVideo && !unlocked}
          />
          {hasVideo && !unlocked && <div className="mt-2 text-xs text-amber-700">Assista ao vídeo para liberar a prática.</div>}
          <div className="mt-3">
            <button
              onClick={handleAnalyze}
              disabled={loading || submission.trim().length < 20 || (hasVideo && !unlocked)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Analisando..." : "Analisar com IA"}
            </button>
          </div>
          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
          {result && (
            <div className="mt-6 text-sm">
              <div className="font-semibold mb-2">Resultado</div>
              <pre className="whitespace-pre-wrap text-xs bg-slate-50 p-3 rounded-md">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
