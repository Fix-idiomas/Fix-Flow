"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { upsertPublicProfile } from "@/lib/firestore";
import { APP_ID } from "@/config/app";

export default function OnboardingPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Garante usuário anônimo
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        await signInAnonymously(auth);
      } else {
        setUid(user.uid);
      }
    });
    return () => unsub();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setSubmitting(true);
    try {
      const name = displayName.trim() || "Aluno";
      await upsertPublicProfile(APP_ID, uid, name, 0);

      // MVP: guarda o código localmente (vinculação real vem depois)
      if (classCode.trim()) {
        localStorage.setItem("fixflow_class_code", classCode.trim());
      }

      router.replace("/start"); // vai direto para a escolha da primeira atividade
    } catch (err: any) {
      alert(`Não foi possível concluir o onboarding: ${err?.message || "erro"}`);
    } finally {
      setSubmitting(false);
    }
  }

  const ready = Boolean(uid);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Bem-vindo ao Fix Flow</h1>
        <p className="mt-1 text-sm text-slate-600">
          Crie seu apelido e (opcional) informe o código do seu professor ou turma.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="nickname">
            Seu apelido
          </label>
          <input
            id="nickname"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ex.: Ana, JP, Carol S."
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="mt-1 text-xs text-slate-500">
            Será mostrado no ranking. Você pode mudar depois.
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="classCode">
            Código do professor/turma (opcional)
          </label>
          <input
            id="classCode"
            type="text"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            placeholder="Ex.: ABC123"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p className="mt-1 text-xs text-slate-500">
            Se informado, você verá as atividades do seu professor além do desafio global.
          </p>
        </div>

        <button
          type="submit"
          disabled={!ready || submitting}
          className="w-full rounded-md border bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60"
        >
          {submitting ? "Concluindo…" : "Começar"}
        </button>

        <p className="mt-3 text-center text-[11px] text-slate-500">
          UID: <code>{uid ?? "…"}</code>
        </p>
      </form>
    </main>
  );
}
