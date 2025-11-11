"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { APP_ID } from "@/config/app";
import {
  doc,
  getDoc,
  Timestamp,
  collection,
  addDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { paths } from "@/lib/firestore";
import { attemptRecordConverter, taskItemConverter } from "@/lib/firestore/converters";

type DailyActivityCurrent = {
  templateRef?: { id?: string };
  overrideSlots?: Record<string, unknown>;
  publishedAt?: Timestamp;
  publishedBy?: string;
};

const DEFAULT_POINTS_ON_COMPLETE = 50;

export default function ActivityRunnerPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [data, setData] = useState<DailyActivityCurrent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Estado para criar tarefa quando não há atividade publicada
  const [showHWForm, setShowHWForm] = useState(false);
  const [hwText, setHwText] = useState("");
  const [hwWhen, setHwWhen] = useState<string>("");
  const [hwBusy, setHwBusy] = useState(false);

  const currentPath = useMemo(() => paths.dailyActivityCurrent(APP_ID), []);

  // ---- Auth anônima: garantir UID disponível ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          const cred = await signInAnonymously(auth);
          setUid(cred.user.uid);
        } catch {
          setUid(null);
        } finally {
          setAuthReady(true);
        }
      } else {
        setUid(user.uid);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // ---- Buscar daily_activity/current ----
  useEffect(() => {
    async function fetchCurrent() {
      try {
        setLoading(true);
        const ref = doc(db, currentPath);
        const snap = await getDoc(ref);
        setExists(snap.exists());
        setData((snap.data() as DailyActivityCurrent) || null);
      } catch (err) {
        console.error("[/atividade] read current:", err);
        setExists(false);
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchCurrent();
  }, [currentPath]);

  const templateId = data?.templateRef?.id || null;

  // Criar tarefa rápida (homework) quando não há atividade do dia
  async function handleAddHomework() {
    if (!uid || !hwText.trim()) return;
    setHwBusy(true);
    try {
      const tasksColPath = paths.userTasksCol(APP_ID, uid);
      const remindAt = hwWhen ? Timestamp.fromDate(new Date(hwWhen)) : null;
      await addDoc(
        collection(db, tasksColPath).withConverter(taskItemConverter),
        {
          text: hwText.trim(),
          completed: false,
          remindAt: remindAt ?? undefined,
          dueAt: remindAt ?? undefined,
          source: "atividade-empty",
        }
      );
      setHwText("");
      setHwWhen("");
      setShowHWForm(false);
    } catch (e: any) {
      console.error("addHomework:", e?.message || e);
      alert("Falha ao adicionar tarefa");
    } finally {
      setHwBusy(false);
    }
  }

  // ---- Ação “Concluir” (placeholder): cria attempt + soma pontos ----
  async function handleComplete() {
    if (!uid || !templateId) return;
    setSubmitting(true);
    try {
      // 1) attempt (placeholder)
      const attemptsColPath = paths.userAttemptsCol(APP_ID, uid);
      await addDoc(
        collection(db, attemptsColPath).withConverter(attemptRecordConverter),
        {
          templateId,
          payload: { placeholder: true },
          pointsAwarded: DEFAULT_POINTS_ON_COMPLETE,
        }
      );

      // 2) profile points (+DEFAULT_POINTS_ON_COMPLETE)
      const profilesColPath = paths.publicProfilesCol(APP_ID);
      const profileRef = doc(db, profilesColPath, uid);
      const snap = await getDoc(profileRef);
      const currentPoints =
        (typeof snap.data()?.points === "number" ? snap.data()?.points : 0) || 0;
      const displayName =
        typeof snap.data()?.displayName === "string"
          ? snap.data()?.displayName
          : "Aluno";

      await setDoc(
        profileRef,
        {
          displayName,
          points: Math.max(0, currentPoints + DEFAULT_POINTS_ON_COMPLETE),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setDone(true);
    } catch (err) {
      console.error("[/atividade] complete:", err);
      alert("Não foi possível concluir a atividade agora.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- UI do placeholder por templateId ----
  function PlaceholderBody() {
    if (!templateId) {
      return (
        <div className="rounded-2xl border p-5 text-sm text-gray-700 bg-white">
          <div className="mb-3 flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-slate-900" />
            <div className="text-base font-semibold text-slate-900">
              Ainda não há atividade publicada hoje
            </div>
          </div>
          <p className="mb-4 text-slate-600">
            Você pode explorar atividades ou agendar um “homework”.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/start"
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:opacity-95"
            >
              Explorar atividades guiadas
            </a>
            <button
              type="button"
              onClick={() => setShowHWForm(v => !v)}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Agendar tarefa
            </button>
          </div>
          {showHWForm && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                className="sm:col-span-2 rounded-md border px-3 py-2 text-sm"
                placeholder="Ex.: Revisar vocabulário da aula"
                value={hwText}
                onChange={e => setHwText(e.target.value)}
              />
              <input
                type="datetime-local"
                className="rounded-md border px-3 py-2 text-sm"
                value={hwWhen}
                onChange={e => setHwWhen(e.target.value)}
              />
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={handleAddHomework}
                  disabled={hwBusy || !uid || !hwText.trim()}
                  className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60"
                >
                  {hwBusy ? "Salvando…" : "Salvar tarefa"}
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    switch (templateId) {
      case "PD_TEXT_PLACEHOLDER":
        return (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <strong>PD (Texto):</strong> aqui haverá um campo de texto para montar a
              frase segundo o Princípio Direto. (placeholder)
            </div>
            <textarea
              className="w-full rounded-md border p-2 text-sm"
              rows={3}
              placeholder="Ex.: Digite sua frase aqui (dummy)"
              disabled
            />
          </div>
        );
      case "PD_BLOCKS_PLACEHOLDER":
        return (
          <div className="text-sm text-gray-700">
            <strong>PD (Blocos):</strong> aqui haverá blocos para ordenar/arrastar. (placeholder)
          </div>
        );
      case "PD_MC_PLACEHOLDER":
        return (
          <div className="text-sm text-gray-700">
            <strong>PD (Múltipla escolha):</strong> aqui haverá alternativas para seleção. (placeholder)
          </div>
        );
      case "PD_VOICE_PLACEHOLDER":
        return (
          <div className="text-sm text-gray-700">
            <strong>PD (Voz):</strong> aqui haverá gravação de áudio e avaliação depois. (placeholder)
          </div>
        );
      case "SPIDER_NAV_PLACEHOLDER":
        return (
          <div className="text-sm text-gray-700">
            <strong>Spider (Navegação):</strong> aqui haverá links de teia entre campos de ideia. (placeholder)
          </div>
        );
      default:
        return (
          <div className="text-sm text-gray-700">
            Template desconhecido: <code>{templateId}</code>
          </div>
        );
    }
  }

  const ready = authReady && !loading;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center gap-2">
        <CalendarCheck className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Atividade do Dia — placeholder</h1>
      </header>

      {!ready ? (
        <div className="flex items-center gap-2 text-gray-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      ) : (
        <section className="rounded-xl border bg-white p-4">
          <div className="mb-4 text-sm">
            <div className="text-gray-600">
              <span className="font-medium">UID:</span> {uid || "—"}
            </div>
            <div className="text-gray-600">
              <span className="font-medium">Template:</span>{" "}
              {templateId || "—"}
            </div>
          </div>

          <div className="mb-6">
            <PlaceholderBody />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleComplete}
              disabled={!templateId || !uid || submitting || done}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
              title="Concluir atividade (placeholder)"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : done ? (
                "Concluída ✔"
              ) : (
                "Concluir (ganhar pontos)"
              )}
            </button>
            <div className="text-xs text-gray-500">
              +{DEFAULT_POINTS_ON_COMPLETE} pontos ao concluir
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
