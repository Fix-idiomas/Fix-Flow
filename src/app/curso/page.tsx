"use client";

import Link from "next/link";
import { ChevronRight, BookOpen } from "lucide-react";

export default function CursosIndexPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6 flex items-center gap-2">
          <BookOpen size={20} />
          <h1 className="text-2xl font-semibold text-slate-900">Cursos</h1>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 text-slate-900 font-semibold">Direct Principle</div>
            <p className="text-sm text-slate-600">
              Primeira trilha do método: prática guiada, foco em progresso direto.
            </p>
            <div className="mt-4">
              <Link
                href="/curso/direct-principle"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Abrir trilha <ChevronRight size={16} />
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
