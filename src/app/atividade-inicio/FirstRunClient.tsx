"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { addDoc, collection, doc, serverTimestamp, setDoc, increment } from "firebase/firestore";
import { APP_ID } from "@/config/app";
import { Headphones, Volume2, BookOpen, CheckCircle2 } from "lucide-react";

 type Mode = "word" | "pronunciation" | "listening";

const MODES: Record<Mode, { title: string; desc: string; est: string; Icon: any; cta: string }> = {
  word: {
    title: "Aprender uma palavra",
    desc: "Veja um exemplo simples e use a palavra em uma frase.",
    est: "1–2 min",
    Icon: BookOpen,
    cta: "Concluir",
  },
  pronunciation: {
    title: "Praticar pronúncia",
    desc: "Leia em voz alta; foco no ritmo e nas vogais.",
    est: "1–2 min",
    Icon: Volume2,
    cta: "Concluir",
  },
  listening: {
    title: "Ouvir e entender",
    desc: "Ouça uma frase curta e identifique a ideia principal.",
    est: "2–3 min",
    Icon: Headphones,
    cta: "Concluir",
  },
};

export default function FirstRunClient() {
  const search = useSearchParams();
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const mode: Mode = useMemo(() => {
    const q = (search?.get("mode") || "").trim() as Mode;
    if (q === "word" || q === "pronunciation" || q === "listening") {
      if (typeof window !== "undefined") localStorage.setItem("ff_last_mode", q);
      return q;
    }
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ff_last_mode") as Mode | null;
      if (saved === "word" || saved === "pronunciation" || saved === "listening") return saved;
    }
    return "word";
  }, [search]);

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

  async function handleFinish() {
    if (!uid) return;
    setSubmitting(true);
    try {
      const col = collection(db, "artifacts", APP_ID, "users", uid, "data", "app", "attempts");
      await addDoc(col, {
        mode,
        at: serverTimestamp(),
        payload: {},
        points: 50,
      });

      const profRef = doc(db, "artifacts", APP_ID, "public", "data", "public_profiles", uid);
      await setDoc(
        profRef,
        { points: increment(50), updatedAt: serverTimestamp() },
        { merge: true }
      );

      setDone(true);
      setTimeout(() => router.replace("/"), 1100);
    } catch (err: any) {
      alert(`Não foi possível concluir: ${err?.message || "erro"}`);
    } finally {
      setSubmitting(false);
    }
  }

  const meta = MODES[mode];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <meta.Icon className="h-6 w-6 text-slate-900" />
          <h1 className="text-xl font-semibold text-slate-900">{meta.title}</h1>
        </div>
        <span className="rounded-full border px-2 py-1 text-xs text-slate-600">{meta.est}</span>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        {!done ? (
          <>
            <p className="mb-4 text-sm text-slate-700">{meta.desc}</p>
            <div className="mb-5 rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
              Conteúdo interativo chegará aqui (texto, áudio ou micro-exercício). Por enquanto, clique em <strong>{meta.cta}</strong> para registrar sua primeira tentativa.
            </div>
            <button
              type="button"
              onClick={handleFinish}
              disabled={!uid || submitting}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? "Enviando…" : meta.cta}
            </button>
            <p className="mt-3 text-[11px] text-slate-500">UID: <code>{uid ?? "…"}</code></p>
          </>
        ) : (
          <div className="flex items-center gap-3 text-slate-800">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div className="text-sm">
              <div className="font-medium">Concluído! +50 pontos</div>
              <div className="text-slate-600">Vamos te levar à página inicial…</div>
            </div>
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-slate-500">
        Dica: você pode trocar o tipo em <code>/start</code>. Sua última escolha fica salva.
      </p>
    </main>
  );
}
