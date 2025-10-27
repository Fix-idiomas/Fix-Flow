// app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
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




export default function Home() {
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [displayName, setDisplayName] = useState("");
  const [points, setPoints] = useState<number>(0);
  const [topProfiles, setTopProfiles] = useState<
    Array<{ id: string; displayName: string; points: number }>
  >([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // feedback das operações no Firestore
  const [opStatus, setOpStatus] = useState<null | {
    action: "write" | "read";
    ok: boolean;
    message: string;
  }>(null);

  useEffect(() => {
    setStatus("loading");

    // Observa o estado de auth; se não houver usuário, tenta login anônimo
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        setStatus("ready");
        setErrorMsg(null);
        loadMyProfile(user.uid);
      } else {
        try {
          await signInAnonymously(auth);
          // o onAuthStateChanged será disparado novamente e cairá no branch acima
        } catch (err: any) {
          setStatus("error");
          setErrorMsg(err?.message ?? "Falha ao autenticar anonimamente.");
        }
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Listener do Top 5 em tempo real (único)
  useEffect(() => {
    if (status !== "ready" || !uid) return;

    const q = query(
      collection(db, "artifacts", APP_ID, "public", "data", "public_profiles"),
      orderBy("points", "desc"),
      limit(5)
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
        currentUid
      );
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const d = snap.data() as any;
        setDisplayName(d?.displayName ?? "");
        setPoints(Number.isFinite(d?.points) ? d.points : 0);
      } else {
        // se não existir, só deixa os campos em branco/zero (sem escrever nada)
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
      // o listener do Top 5 atualiza sozinho
    } catch (e: any) {
      if (e?.code === "permission-denied") {
        console.error(
          "❌ PERMISSION_DENIED: Ajuste as regras do Firestore para permitir escrita em public_profiles"
        );
      } else {
        console.error("Erro ao salvar perfil público:", e?.message || e);
      }
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
  <div className="mx-auto max-w-md px-4 py-10">
   
        {/* Card de conexão */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Estado da conexão</h2>

          {status === "loading" && (
            <div className="text-slate-600">Conectando ao Firebase…</div>
          )}

          {status === "ready" && (
            <div className="space-y-3">
              <div className="text-green-600 font-medium">
                ✅ Autenticado anonimamente
              </div>
              <div className="text-sm">
                <span className="font-semibold">UID:</span>{" "}
                <code className="rounded bg-slate-100 px-2 py-1">{uid}</code>
              </div>
              <p className="text-xs text-slate-500">
                (Login anônimo apenas para teste do front ↔ Firebase)
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <div className="font-medium text-red-600">❌ Erro ao autenticar</div>
              <pre className="whitespace-pre-wrap rounded bg-red-50 p-3 text-sm text-red-800">
                {errorMsg}
              </pre>
              <button
                onClick={async () => {
                  setStatus("loading");
                  setErrorMsg(null);
                  try {
                    await signInAnonymously(auth);
                  } catch (err: any) {
                    setStatus("error");
                    setErrorMsg(err?.message ?? "Falha ao autenticar.");
                  }
                }}
                className="mt-1 w-full rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </section>

        {/* Card de Firestore */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Firestore (smoke test)</h2>
          <p className="mb-4 text-sm text-slate-500">
            Teste rápido de escrita/leitura. Sem regras definidas, é normal ver
            <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">
              PERMISSION_DENIED
            </code>
            .
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={handleWritePing}
              disabled={!uid}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Gravar ping
            </button>
            <button
              onClick={handleReadPing}
              disabled={!uid}
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ler ping
            </button>
          </div>

          {opStatus && (
            <div
              className={`mt-4 rounded-lg border p-3 text-sm ${
                opStatus.ok
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <div className="font-semibold">
                {opStatus.action === "write" ? "Escrita:" : "Leitura:"}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{opStatus.message}</div>
            </div>
          )}
        </section>

        {/* Perfil Público */}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Perfil público</h2>
          <p className="mb-4 text-sm text-slate-500">
            Atualize seu{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
              artifacts/{APP_ID}/public/data/public_profiles/{uid}
            </code>
            . Você só pode escrever o <strong>seu</strong> próprio documento.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              className="rounded-lg border px-3 py-2"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!uid}
            />
            <input
              type="number"
              className="rounded-lg border px-3 py-2"
              placeholder="Points"
              value={Number.isFinite(points) ? points : 0}
              onChange={(e) => setPoints(parseInt(e.target.value || "0", 10))}
              disabled={!uid}
            />
            <button
              onClick={handleSaveProfile}
              disabled={!uid}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Salvar perfil
            </button>
          </div>

          {/* Top 5 ranking (leitura pública em tempo real) */}
          <div className="mt-6">
            <h3 className="mb-2 font-semibold">Top 5 (ranking público)</h3>
            {topProfiles.length === 0 ? (
              <div className="text-sm text-slate-500">Sem dados ainda…</div>
            ) : (
              <ul className="divide-y rounded-lg border">
                {topProfiles.map((u, i) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-sm">
                      <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-xs">
                        #{i + 1}
                      </span>
                      {u.displayName}
                    </span>
                    <span className="text-sm font-semibold">
                      {u.points} pts
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Rodapé */}
        <footer className="mt-8 text-center text-xs text-slate-400">
          v0.1 — Patch Firestore smoke-test (somente front)
        </footer>
      </div>
    </main>
  );
}
