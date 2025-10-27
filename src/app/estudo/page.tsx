// app/estudo/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { APP_ID } from "@/config/app";
import { doc, onSnapshot } from "firebase/firestore";
import { upsertPublicProfile } from "@/lib/firestore";
import Link from "next/link";

export default function StudyPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [points, setPoints] = useState<number>(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // timer state
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // em segundos
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // auth + carregar perfil público do usuário (p/ ler pontos atuais)
  useEffect(() => {
    setStatus("loading");
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
          return; // onAuthStateChanged chamará de novo
        } catch (e: any) {
          setStatus("error");
          setErrorMsg(e?.message ?? "Falha ao autenticar anonimamente.");
          return;
        }
      }
      setUid(user.uid);
      setStatus("ready");
      setErrorMsg(null);

      // listener do próprio perfil
      const myRef = doc(
        db,
        "artifacts",
        APP_ID,
        "public",
        "data",
        "public_profiles",
        user.uid
      );
      const stop = onSnapshot(myRef, (snap) => {
        const d = snap.data() as { displayName?: string; points?: number } | undefined;
        setDisplayName(d?.displayName ?? "");
        setPoints(Number.isFinite(d?.points) ? (d!.points as number) : 0);
      });
      return () => stop();
    });
    return () => unsub();
  }, []);

  // loop do timer
  useEffect(() => {
    if (!running) {
      // parar loop
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    // inicia
    if (startedAtRef.current === null) {
      startedAtRef.current = performance.now() - elapsed * 1000;
    }

    const tick = (t: number) => {
      if (startedAtRef.current != null) {
        const secs = Math.floor((t - startedAtRef.current) / 1000);
        setElapsed(secs);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, elapsed]);

  function toggleTimer() {
    setRunning((r) => {
      if (r) {
        // pausando
        return false;
      } else {
        // retomando
        if (startedAtRef.current === null) startedAtRef.current = performance.now();
        return true;
      }
    });
  }

  function resetTimer() {
    setRunning(false);
    startedAtRef.current = null;
    setElapsed(0);
  }

  function fmt(secs: number) {
    const h = Math.floor(secs / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((secs % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(secs % 60)
      .toString()
      .padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  async function handleSaveSession() {
    if (!uid) return;
    // regra simples: 1 ponto por minuto cheio
    const minutes = Math.floor(elapsed / 60);
    if (minutes <= 0) {
      alert("Estude pelo menos 1 minuto para salvar pontos 🙂");
      return;
    }
    try {
      const newPoints = points + minutes;
      await upsertPublicProfile(APP_ID, uid, displayName || "Aluno", newPoints);
      resetTimer();
    } catch (e: any) {
      console.error("Falha ao salvar sessão:", e?.message || e);
      alert("Não foi possível salvar. Verifique as regras do Firestore.");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-md px-4 py-10">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Estudo</h1>
          <Link
            href="/leaderboard"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
          >
            Ver leaderboard →
          </Link>
        </header>

        {/* Estado de conexão */}
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Estado</h2>
          {status === "loading" && (
            <div className="text-slate-600">Conectando ao Firebase…</div>
          )}
          {status === "ready" && (
            <div className="space-y-1 text-sm">
              <div className="text-green-600 font-medium">✅ Autenticado</div>
              <div>
                <span className="font-semibold">UID:</span>{" "}
                <code className="rounded bg-slate-100 px-2 py-0.5">{uid}</code>
              </div>
              <div>
                <span className="font-semibold">Display:</span>{" "}
                {displayName || <span className="text-slate-400">—</span>}
              </div>
              <div>
                <span className="font-semibold">Pontos:</span> {points}
              </div>
            </div>
          )}
          {status === "error" && (
            <div className="space-y-2">
              <div className="font-medium text-red-600">❌ Erro ao autenticar</div>
              <pre className="whitespace-pre-wrap rounded bg-red-50 p-3 text-sm text-red-800">
                {errorMsg}
              </pre>
            </div>
          )}
        </section>

        {/* Cronômetro */}
        <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h2 className="text-2xl font-bold mb-2">Cronômetro de Estudo</h2>
          <p className="text-slate-500 mb-6 text-sm">
            Meta: 20 min/dia (1 ponto por minuto salvo).
          </p>

          <div className="mx-auto mb-6 grid h-48 w-48 place-items-center rounded-full bg-slate-100 text-3xl font-bold">
            {fmt(elapsed)}
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={toggleTimer}
              disabled={status !== "ready"}
              className={`rounded-full px-6 py-3 font-semibold text-white ${
                running
                  ? "bg-yellow-500 hover:bg-yellow-600"
                  : "bg-red-600 hover:bg-red-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {running ? "Pausar" : "Iniciar"}
            </button>
            <button
              onClick={handleSaveSession}
              disabled={status !== "ready" || elapsed < 60}
              className="rounded-full bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Salvar sessão
            </button>
          </div>

          <button
            onClick={resetTimer}
            disabled={elapsed === 0}
            className="mt-4 rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Zerar
          </button>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-400">
          v0.3 — /estudo com cronômetro (salva pontos no perfil público)
        </footer>
      </div>
    </main>
  );
}
