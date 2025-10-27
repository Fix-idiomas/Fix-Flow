// app/conquistas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { APP_ID } from "@/config/app";
import { doc, onSnapshot } from "firebase/firestore";
import { Trophy, Lock } from "lucide-react";

type Badge = {
  id: string;
  title: string;
  pointsRequired: number;
  emoji?: string;
};

const BADGES: Badge[] = [
  { id: "b10", title: "Primeiros Passos", pointsRequired: 10, emoji: "🎯" },
  { id: "b50", title: "Em Ritmo", pointsRequired: 50, emoji: "🚀" },
  { id: "b100", title: "Firme e Forte", pointsRequired: 100, emoji: "💪" },
  { id: "b250", title: "Maratonista", pointsRequired: 250, emoji: "🏆" },
  { id: "b500", title: "Lenda do Estudo", pointsRequired: 500, emoji: "👑" },
];

export default function AchievementsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState<string>("");
  const [points, setPoints] = useState<number>(0);

  // auth + listener de pontos do perfil público
  useEffect(() => {
    setStatus("loading");
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
          return;
        } catch (e: any) {
          setStatus("error");
          setErrorMsg(e?.message ?? "Falha ao autenticar anonimamente.");
          return;
        }
      }
      setUid(user.uid);
      setStatus("ready");
      setErrorMsg(null);

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
        const d =
          (snap.data() as { displayName?: string; points?: number }) || {};
        setDisplayName(d.displayName ?? "");
        setPoints(Number.isFinite(d.points) ? (d.points as number) : 0);
      });
      return () => stop();
    });
    return () => unsub();
  }, []);

  const unlockedIds = useMemo(
    () => new Set(BADGES.filter((b) => points >= b.pointsRequired).map((b) => b.id)),
    [points]
  );

  const nextBadge = useMemo(
    () => BADGES.find((b) => points < b.pointsRequired) || null,
    [points]
  );

  const progressToNext = useMemo(() => {
    if (!nextBadge) return 100;
    const prev =
      [...BADGES]
        .filter((b) => b.pointsRequired <= points)
        .sort((a, b) => a.pointsRequired - b.pointsRequired)
        .at(-1)?.pointsRequired ?? 0;
    const span = nextBadge.pointsRequired - prev || 1;
    const val = Math.min(100, Math.max(0, ((points - prev) / span) * 100));
    return Math.round(val);
  }, [points, nextBadge]);

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-md px-4 py-10">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Conquistas</h1>
          <Link
            href="/leaderboard"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
          >
            Ver leaderboard →
          </Link>
        </header>

        {/* Estado do usuário */}
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Seu progresso</h2>
          {status === "loading" && (
            <div className="text-slate-600">Conectando ao Firebase…</div>
          )}
          {status === "error" && (
            <div className="space-y-2">
              <div className="font-medium text-red-600">❌ Erro ao autenticar</div>
              <pre className="whitespace-pre-wrap rounded bg-red-50 p-3 text-sm text-red-800">
                {errorMsg}
              </pre>
            </div>
          )}
          {status === "ready" && (
            <>
              <div className="text-sm">
                <span className="font-semibold">UID:</span>{" "}
                <code className="rounded bg-slate-100 px-2 py-0.5">{uid}</code>
              </div>
              <div className="mt-1 text-sm">
                <span className="font-semibold">Pontos:</span> {points}
              </div>

              {/* Barra de progresso para a próxima badge */}
              <div className="mt-4">
                {nextBadge ? (
                  <>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span>Próxima: {nextBadge.title}</span>
                      <span>
                        {points}/{nextBadge.pointsRequired}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-red-600 transition-[width] duration-300"
                        style={{ width: `${progressToNext}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                    Você já desbloqueou todas as conquistas atuais. 👑
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Grade de badges */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Badges</h2>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BADGES.map((b) => {
              const unlocked = unlockedIds.has(b.id);
              return (
                <li
                  key={b.id}
                  className={[
                    "rounded-xl border p-4 text-center transition",
                    unlocked
                      ? "border-green-200 bg-green-50"
                      : "border-slate-200 bg-slate-50 opacity-80",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center justify-center">
                    {unlocked ? (
                      <Trophy className="text-green-600" size={22} />
                    ) : (
                      <Lock className="text-slate-400" size={20} />
                    )}
                  </div>
                  <div className="text-sm font-semibold">
                    {b.emoji ? `${b.emoji} ` : ""}
                    {b.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {b.pointsRequired} pts
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-400">
          v0.5 — /conquistas baseado em pontos (read-only)
        </footer>
      </div>
    </main>
  );
}
