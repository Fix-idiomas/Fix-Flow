// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Sparkles,
  ChevronRight,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  tryWriteHealthPing,
  tryReadHealthPing,
  upsertPublicProfile,
} from "@/lib/firestore";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { APP_ID } from "@/config/app";

type TopProfile = {
  id: string;
  displayName: string;
  points: number;
};

type OpStatus =
  | null
  | {
      action: "write" | "read";
      ok: boolean;
      message: string;
    };

export default function Home() {
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [displayName, setDisplayName] = useState("");
  const [points, setPoints] = useState<number>(0);
  const [topProfiles, setTopProfiles] = useState<TopProfile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [opStatus, setOpStatus] = useState<OpStatus>(null);

  useEffect(() => {
    setStatus("loading");

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        setStatus("ready");
        setErrorMsg(null);
        loadMyProfile(user.uid);
      } else {
        setStatus("error");
        setErrorMsg("Usuário não autenticado.");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (status !== "ready" || !uid) return;

    const q = query(
      collection(db, "artifacts", APP_ID, "public", "data", "public_profiles"),
      orderBy("points", "desc"),
      limit(5),
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as { displayName?: string; points?: number };
        return {
          id: d.id,
          displayName: data.displayName ?? `Aluno ${d.id.slice(0, 6)}…`,
          points: Number.isFinite(data.points) ? (data.points as number) : 0,
        };
      });
      setTopProfiles(list);
    });

    return () => unsub();
  }, [status, uid]);

  async function loadMyProfile(currentUid: string) {
    try {
      const ref = doc(
        db,
        "artifacts",
        APP_ID,
        "public",
        "data",
        "public_profiles",
        currentUid,
      );
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const d = snap.data() as any;
        setDisplayName(d?.displayName ?? "");
        setPoints(Number.isFinite(d?.points) ? d.points : 0);
      } else {
        setDisplayName("");
        setPoints(0);
      }
    } catch {
      // silencioso em dev
    }
  }

  async function handleWritePing() {
    if (!uid) return;
    setOpStatus(null);
    try {
      const path = await tryWriteHealthPing(APP_ID, uid);
      setOpStatus({
        action: "write",
        ok: true,
        message: `✔ Gravado em: ${path} (se regras permitirem).`,
      });
    } catch (e: any) {
      setOpStatus({
        action: "write",
        ok: false,
        message:
          e?.code === "permission-denied"
            ? "PERMISSION_DENIED (esperado por enquanto — ainda não definimos regras)."
            : `Erro: ${e?.message ?? "falha ao gravar ping."}`,
      });
    }
  }

  async function handleReadPing() {
    if (!uid) return;
    setOpStatus(null);
    try {
      const { exists, data } = await tryReadHealthPing(APP_ID, uid);
      setOpStatus({
        action: "read",
        ok: true,
        message: exists
          ? `✔ Documento existe: ${JSON.stringify(data)}`
          : "Documento não existe (ou regras bloquearam a leitura).",
      });
    } catch (e: any) {
      setOpStatus({
        action: "read",
        ok: false,
        message:
          e?.code === "permission-denied"
            ? "PERMISSION_DENIED (esperado por enquanto — ainda não definimos regras)."
            : `Erro: ${e?.message ?? "falha ao ler ping."}`,
      });
    }
  }

  async function handleSaveProfile() {
    if (!uid) return;
    try {
      await upsertPublicProfile(APP_ID, uid, displayName || "Aluno", points);
    } catch (e: any) {
      if (e?.code === "permission-denied") {
        console.error(
          "❌ PERMISSION_DENIED: Ajuste as regras do Firestore para permitir escrita em public_profiles",
        );
      } else {
        console.error("Erro ao salvar perfil público:", e?.message || e);
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Bem-vindo 👋</h1>
        <p className="mt-1 text-sm text-slate-600">
          Escolha por onde começar. É rápido e guiado.
        </p>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/atividade"
          className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white transition group-hover:scale-105">
              <CalendarCheck size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Atividade do dia
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Faça o desafio publicado hoje (global ou do seu professor).
          </p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700">
            Começar <ChevronRight size={16} />
          </div>
        </Link>

        <Link
          href="/start"
          className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white transition group-hover:scale-105">
              <Sparkles size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Meu Progresso
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Escolha uma primeira atividade (palavra, pronúncia ou ouvir) e
            ganhe pontos.
          </p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700">
            Abrir <ChevronRight size={16} />
          </div>
        </Link>

        <Link
          href="/curso/direct-principle"
          className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white transition group-hover:scale-105">
              <BookOpen size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              Curso: Direct Principle
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Primeira trilha do método Direct Principle. Comece pela base e
            evolua com prática guiada.
          </p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700">
            Explorar <ChevronRight size={16} />
          </div>
        </Link>
      </section>

      {/* Estado da conexão */}
      {/* ...se quiser, posso também resumir/limpar essa parte depois... */}

      <div className="mt-8">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-gray-50"
        >
          <BarChart3 size={16} />
          Ver ranking
        </Link>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        v0.1 - Patch Firestore smoke-test (somente front)
      </footer>
    </div>
  );
}