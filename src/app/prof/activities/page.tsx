"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, RefreshCcw, Send } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { APP_ID } from "@/config/app";
import {
  doc,
  getDoc,
  Timestamp,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { paths } from "@/lib/firestore";

/**
 * Placeholder de "Atividades" do professor.
 * Agora com "Publicar hoje": grava artifacts/{APP_ID}/public/data/daily_activity/current
 */

type DailyActivityCurrent = {
  templateRef?: { id?: string };
  overrideSlots?: Record<string, unknown>;
  publishedAt?: Timestamp;
  publishedBy?: string;
};

const TEMPLATE_OPTIONS = [
  "PD_TEXT_PLACEHOLDER",
  "PD_BLOCKS_PLACEHOLDER",
  "PD_MC_PLACEHOLDER",
  "PD_VOICE_PLACEHOLDER",
  "SPIDER_NAV_PLACEHOLDER",
];

export default function ProfActivitiesPage() {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState<boolean>(false);
  const [data, setData] = useState<DailyActivityCurrent | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("PD_TEXT_PLACEHOLDER");
  const [publishing, setPublishing] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  const currentPath = useMemo(() => paths.dailyActivityCurrent(APP_ID), []);

  // Auth (para publishedBy e checagem de permissão pelas regras)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user ? user.uid : null);
    });
    return () => unsub();
  }, []);

  async function fetchCurrent() {
    try {
      setLoading(true);
      const ref = doc(db, currentPath);
      const snap = await getDoc(ref);
      setExists(snap.exists());
      setData((snap.data() as DailyActivityCurrent) || null);
    } catch (err) {
      console.error("[/prof/activities] read current:", err);
      setExists(false);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publishedAtStr =
    data?.publishedAt instanceof Timestamp
      ? data.publishedAt.toDate().toLocaleString()
      : "—";

  async function publishToday() {
    if (!uid || !selectedTemplate) return;
    setPublishing(true);
    try {
      const ref = doc(db, currentPath);
      await setDoc(ref, {
        templateRef: { id: selectedTemplate },
        publishedAt: serverTimestamp(),
        publishedBy: uid,
        overrideSlots: {}, // por enquanto vazio
      });
      await fetchCurrent();
      alert("Atividade do dia publicada!");
    } catch (err: any) {
      console.error("[/prof/activities] publish:", err);
      alert(`Não foi possível publicar: ${err?.message || "erro"}`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="inline-flex items-center gap-2 text-xl font-semibold">
          <CalendarDays className="h-5 w-5" />
          Atividades (prof) — placeholder
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchCurrent}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            title="Recarregar"
          >
            <RefreshCcw className="h-4 w-4" />
            Recarregar
          </button>
        </div>
      </header>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Template (placeholder)
            </label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              {TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Você está logado como UID: <code>{uid || "—"}</code>
            </p>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={publishToday}
              disabled={!uid || publishing}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
              title="Publicar como atividade do dia"
            >
              <Send className="h-4 w-4" />
              {publishing ? "Publicando…" : "Publicar hoje"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="text-sm font-medium">Status atual</div>
          <div className="mt-2 text-sm text-gray-700">
            <div className="mb-1">
              <span className="text-gray-600">Doc:</span>{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5">{currentPath}</code>
            </div>
            {loading ? (
              <div>Carregando…</div>
            ) : exists ? (
              <div className="space-y-1">
                <div>
                  <span className="text-gray-600">Template: </span>
                  <span className="font-medium">{data?.templateRef?.id || "—"}</span>
                </div>
                <div>
                  <span className="text-gray-600">Publicado em: </span>
                  <span className="font-medium">{publishedAtStr}</span>
                </div>
                <div>
                  <span className="text-gray-600">Publicado por: </span>
                  <span className="font-medium">{data?.publishedBy || "—"}</span>
                </div>
              </div>
            ) : (
              <div>Nenhuma atividade publicada hoje.</div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/prof/templates"
            className="text-sm underline underline-offset-2 hover:opacity-90"
          >
            ← Ir para Templates
          </Link>
        </div>
      </section>
    </main>
  );
}
