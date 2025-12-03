"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, Film, ListChecks, Library } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { APP_ID } from "@/config/app";
import {
  collection,
  query,
  where,
  orderBy,
  limit as qLimit,
  getDocs,
} from "firebase/firestore";

type SupabaseTotals = {
  users: number;
  newUsers24h: number;
  pushTokens: number;
};

export default function AdminPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sbTotals, setSbTotals] = useState<SupabaseTotals | null>(null);
  const [active24h, setActive24h] = useState<number | null>(null);
  const [active7d, setActive7d] = useState<number | null>(null);
  const [topProfiles, setTopProfiles] = useState<Array<{ id: string; displayName: string; points: number }>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pingsCol = useMemo(
    () => collection(db, "artifacts", APP_ID, "public", "health", "pings"),
    []
  );
  const publicProfilesCol = useMemo(
    () => collection(db, "artifacts", APP_ID, "public", "data", "public_profiles"),
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setStatus("ready");
        setIsAdmin(false);
        return;
      }
      setUid(user.uid);
      setStatus("ready");
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/is-admin", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          setIsAdmin(false);
          return;
        }
        const j = await res.json();
        setIsAdmin(Boolean(j?.isAdmin));
      } catch (e: any) {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (status !== "ready" || !isAdmin) return;
    // fetch supabase totals
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch("/api/admin/stats/supabase", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        });
        if (res.ok) {
          const j = await res.json();
          setSbTotals(j?.totals ?? null);
        }
      } catch (e: any) {
        // ignore
      }
    })();

    // firestore active users (last ping timestamps)
    (async () => {
      try {
        const t24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const q24 = query(pingsCol, where("at", ">=", t24));
        const s24 = await getDocs(q24);
        setActive24h(s24.size);
      } catch (e: any) {
        setActive24h(null);
      }
      try {
        const t7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const q7 = query(pingsCol, where("at", ">=", t7));
        const s7 = await getDocs(q7);
        setActive7d(s7.size);
      } catch (e: any) {
        setActive7d(null);
      }
    })();

    // top public profiles
    (async () => {
      try {
        const qTop = query(publicProfilesCol, orderBy("points", "desc"), qLimit(5));
        const snap = await getDocs(qTop);
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            displayName: data?.displayName ?? `Aluno ${d.id.slice(0, 6)}…`,
            points: Number.isFinite(data?.points) ? data.points : 0,
          };
        });
        setTopProfiles(list);
      } catch (e: any) {
        setTopProfiles([]);
      }
    })();
  }, [status, isAdmin, pingsCol, publicProfilesCol]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-gray-50 text-slate-800">
        <div className="mx-auto max-w-4xl px-4 py-10">Carregando…</div>
      </main>
    );
  }

  if (!uid || !isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 text-slate-800">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <h1 className="text-xl font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-600">Você precisa ser administrador para ver este painel.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Painel Administrativo</h1>
          <p className="mt-1 text-sm text-slate-600">Métricas de uso (sem alterar o schema).</p>
        </header>

        {/* Hub de atalhos admin */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/admin" className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-300">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <LayoutDashboard size={18} />
              <span className="font-semibold">Painel</span>
            </div>
            <p className="text-sm text-slate-600">Visão geral com métricas rápidas.</p>
          </Link>
          <Link href="/admin/videos" className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-300">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <Film size={18} />
              <span className="font-semibold">Biblioteca de Vídeos</span>
            </div>
            <p className="text-sm text-slate-600">Gerencie vídeos (YouTube e uploads) e reutilize nas aulas.</p>
          </Link>
          <Link href="/admin/micros" className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-300">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <Library size={18} />
              <span className="font-semibold">Biblioteca de Micros</span>
            </div>
            <p className="text-sm text-slate-600">Modelos de práticas reutilizáveis (goal, task, critérios).</p>
          </Link>
          <Link href="/admin/editorial" className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-300">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <ListChecks size={18} />
              <span className="font-semibold">Editorial</span>
            </div>
            <p className="text-sm text-slate-600">Crie cursos, módulos e micros e vincule conteúdo.</p>
          </Link>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Usuários (Supabase)" value={sbTotals?.users ?? "—"} hint="Tabela public.users" />
          <Card title="Novos 24h" value={sbTotals?.newUsers24h ?? "—"} hint="," />
          <Card title="Push inscritos" value={sbTotals?.pushTokens ?? "—"} hint="Tabela public.push_tokens" />
          <Card title="Ativos 24h" value={active24h ?? "—"} hint="Firestore health/pings" />
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Ativos 7 dias</h2>
            <p className="mt-2 text-3xl font-bold">{active7d ?? "—"}</p>
            <p className="mt-1 text-xs text-slate-500">Fonte: Firestore health/pings</p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Top por pontos</h2>
            <ul className="mt-3 divide-y">
              {topProfiles.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span className="truncate text-sm text-slate-700">{p.displayName}</span>
                  <span className="text-sm font-semibold text-slate-900">{p.points}</span>
                </li>
              ))}
              {topProfiles.length === 0 && (
                <li className="py-2 text-sm text-slate-400">Sem dados</li>
              )}
            </ul>
            <p className="mt-1 text-xs text-slate-500">Fonte: Firestore public_profiles</p>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Observações</h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
            <li>Sem histórico de eventos: métricas de ativos usam o último ping conhecido.</li>
            <li>Para séries (DAU/WAU/MAU por dia), podemos evoluir com um registro leve de presença diária.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

function Card({ title, value, hint }: { title: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-3xl font-bold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}
