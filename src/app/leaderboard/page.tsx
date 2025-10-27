"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

type PublicProfile = { id: string; displayName: string; points: number };

export default function LeaderboardPage() {
  const [top, setTop] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // artifacts/{APP_ID}/public/data/public_profiles (ordenado por pontos)
    const APP_ID = "fix-flow-web";
    const q = query(
      collection(db, "artifacts", APP_ID, "public", "data", "public_profiles"),
      orderBy("points", "desc"),
      limit(20)
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as { displayName?: string; points?: number };
        return {
          id: d.id,
          displayName: data.displayName ?? `Aluno ${d.id.slice(0, 6)}…`,
          points: Number.isFinite(data.points) ? (data.points as number) : 0,
        };
      });
      setTop(rows);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-md px-4 py-10">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Leaderboard</h1>
          <Link
            href="/"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
          >
            ← Voltar
          </Link>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          {loading ? (
            <div className="text-sm text-slate-500">Carregando…</div>
          ) : top.length === 0 ? (
            <div className="text-sm text-slate-500">Sem dados ainda…</div>
          ) : (
            <ol className="divide-y rounded-lg border">
              {top.map((u, i) => (
                <li key={u.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">
                    <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-xs">#{i + 1}</span>
                    {u.displayName}
                  </span>
                  <span className="text-sm font-semibold">{u.points} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="mt-8 text-center text-xs text-slate-400">
          v0.2 — Leaderboard (read-only)
        </footer>
      </div>
    </main>
  );
}
