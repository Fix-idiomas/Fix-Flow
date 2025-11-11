"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { APP_ID } from "@/config/app";
import Link from "next/link";

export default function FeedbackPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // auth anônima para identificar quem enviou
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

  const colPath = useMemo(
    () => (uid ? collection(db, "artifacts", APP_ID, "users", uid, "data", "app", "feedback") : null),
    [uid]
  );

  async function handleSend() {
    if (!uid || !colPath) return;
    const body = text.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      await addDoc(colPath, {
        body,
        createdAt: serverTimestamp(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      });
      setDone(true);
      setText("");
    } catch (e: any) {
      alert(e?.message || "Falha ao enviar feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Feedback</h1>
      <p className="mb-4 text-sm text-slate-600">
        Obrigado por testar o MVP. Conte em poucas linhas o que achou, dificuldades ou ideias.
      </p>
      {done ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Feedback enviado. Obrigado!
        </div>
      ) : (
        <>
          <textarea
            className="mb-3 w-full rounded-md border p-3 text-sm"
            rows={5}
            placeholder="Escreva aqui…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!uid || submitting}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={!uid || !text.trim() || submitting}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Enviar"}
            </button>
            <Link href="/" className="text-sm text-slate-600 hover:underline">
              Voltar
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
