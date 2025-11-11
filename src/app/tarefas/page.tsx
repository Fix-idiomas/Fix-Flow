// app/tarefas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { APP_ID } from "@/config/app";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { taskItemConverter, type TaskItem } from "@/lib/firestore/converters";

type Task = TaskItem & { id: string };

export default function TasksPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] =
    useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");

  // referência para: artifacts/{APP_ID}/users/{uid}/data/app/tasks
  const tasksPath = useMemo(() => {
    if (!uid) return null;
    return collection(
      db,
      "artifacts",
      APP_ID,
      "users",
      uid,
      "data",
      "app",
      "tasks"
    ).withConverter(taskItemConverter);
  }, [uid]);

  // auth + listener das tarefas
  useEffect(() => {
    setStatus("loading");
    const stopAuth = onAuthStateChanged(auth, async (user) => {
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
    });
    return () => stopAuth();
  }, []);

  useEffect(() => {
    if (!tasksPath) return;
    const q = query(tasksPath, orderBy("createdAt", "desc"));
    const stop = onSnapshot(
      q,
      (snap) => {
        const rows: Task[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTasks(rows);
      },
      (err) => {
        // Falha de permissão aparece aqui
        console.error("Listener de tarefas:", err?.message || err);
      }
    );
    return () => stop();
  }, [tasksPath]);

  async function handleAddTask() {
    if (!tasksPath) return;
    const text = input.trim();
    if (!text) return;

    try {
      await addDoc(tasksPath, {
        text,
        completed: false,
      });
      setInput("");
    } catch (e: any) {
      console.error("Erro ao adicionar tarefa:", e?.message || e);
      alert(
        e?.code === "permission-denied"
          ? "Sem permissão para criar tarefas (ajuste as regras do Firestore)."
          : "Falha ao criar tarefa."
      );
    }
  }

  async function toggleTask(task: Task) {
    if (!uid) return;
    if (!tasksPath) return;
    try {
      const ref = doc(tasksPath, task.id);
      await updateDoc(ref, { completed: !task.completed });
    } catch (e: any) {
      console.error("Erro ao marcar tarefa:", e?.message || e);
      alert(
        e?.code === "permission-denied"
          ? "Sem permissão para atualizar tarefas (regras)."
          : "Falha ao atualizar."
      );
    }
  }

  async function removeTask(task: Task) {
    if (!uid) return;
    if (!confirm("Apagar essa tarefa?")) return;
    if (!tasksPath) return;
    try {
      const ref = doc(tasksPath, task.id);
      await deleteDoc(ref);
    } catch (e: any) {
      console.error("Erro ao apagar tarefa:", e?.message || e);
      alert(
        e?.code === "permission-denied"
          ? "Sem permissão para apagar tarefas (regras)."
          : "Falha ao apagar."
      );
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-md px-4 py-10">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ListChecks size={20} /> Tarefas
          </h1>
          <Link
            href="/leaderboard"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
          >
            Ver leaderboard →
          </Link>
        </header>

        {/* Estado de auth */}
        {status === "loading" && (
          <div className="mb-6 rounded-2xl bg-white p-5 text-slate-600 shadow-sm">
            Conectando ao Firebase…
          </div>
        )}
        {status === "error" && (
          <div className="mb-6 space-y-2 rounded-2xl bg-white p-5 shadow-sm">
            <div className="font-medium text-red-600">❌ Erro ao autenticar</div>
            <pre className="whitespace-pre-wrap rounded bg-red-50 p-3 text-sm text-red-800">
              {errorMsg}
            </pre>
          </div>
        )}

        {/* Caixa de criação */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm text-slate-500">
            Items ficam em{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
              artifacts/{APP_ID}/users/{uid}/data/app/tasks
            </code>
            .
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border px-3 py-2"
              placeholder="Adicionar nova tarefa…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!uid}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTask();
              }}
            />
            <button
              onClick={handleAddTask}
              disabled={!uid || !input.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>

          {/* Lista */}
          <ul className="mt-5 divide-y rounded-lg border">
            {tasks.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">
                Nenhuma tarefa por aqui.
              </li>
            ) : (
              tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-3 py-2">
                  <label className="flex flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      checked={t.completed}
                      onChange={() => toggleTask(t)}
                    />
                    <span
                      className={`text-sm ${
                        t.completed ? "text-slate-400 line-through" : ""
                      }`}
                    >
                      {t.text}
                    </span>
                  </label>
                  <button
                    aria-label="Apagar"
                    className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                    onClick={() => removeTask(t)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-400">
          v0.6 — Tarefas com Firestore (tempo real)
        </footer>
      </div>
    </main>
  );
}
