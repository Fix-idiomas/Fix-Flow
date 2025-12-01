'use client';

import { ChevronRight, Target, BookOpenCheck, Layers } from 'lucide-react';
import { microconceitos } from './micro';

export default function DirectPrinciplePage() {
  return (
    <main className="min-h-screen bg-gray-50 text-slate-800">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Direct Principle</h1>
          <p className="mt-1 text-sm text-slate-600">
            Primeira trilha do método Direct Principle. Foco na prática guiada e progressão direta.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <Target size={18} />
              <span className="font-semibold">Objetivo</span>
            </div>
            <p className="text-sm text-slate-600">
              Construir base sólida com prática objetiva (listening, pronúncia e vocabulário aplicado).
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <BookOpenCheck size={18} />
              <span className="font-semibold">Formato</span>
            </div>
            <p className="text-sm text-slate-600">
              Aulas curtas, exercícios imediatos e feedback contínuo. Sem enrolação.
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 inline-flex items-center gap-2 text-slate-900">
              <Layers size={18} />
              <span className="font-semibold">Módulos</span>
            </div>
            <ul className="text-sm text-slate-600 list-disc pl-4">
              <li>Fundamentos Expressivos</li>
              <li>Compreensão Objetiva</li>
              <li>Vocabulário em Ação</li>
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Começar agora</h2>
          <p className="mt-1 text-sm text-slate-600">
            Inicie pela primeira prática guiada e acompanhe sua evolução.
          </p>
          <div className="mt-4">
            <a
              href="#praticas"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById('praticas');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Ir para prática <ChevronRight size={16} />
            </a>
          </div>
        </section>

        <section id="praticas" className="mt-8 grid gap-4 md:grid-cols-3">
          {microconceitos.map(mc => (
            <a key={mc.slug} href={`/curso/direct-principle/${mc.slug}`} className="rounded-2xl border bg-white p-5 shadow-sm hover:border-slate-300">
              <div className="mb-1 text-slate-900 font-semibold">{mc.title}</div>
              <p className="text-sm text-slate-600">{mc.goal}</p>
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                Disponível
              </div>
            </a>
          ))}
          <div className="rounded-2xl border bg-white p-5 shadow-sm opacity-70">
            <div className="mb-1 text-slate-900 font-semibold">Listening — Objetivo 01</div>
            <p className="text-sm text-slate-600">Clipes curtos com foco em compreensão e repetição.</p>
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
              Em breve
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm opacity-70">
            <div className="mb-1 text-slate-900 font-semibold">Vocabulário — Em Ação</div>
            <p className="text-sm text-slate-600">Palavras úteis aplicadas em situações reais.</p>
            <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
              Em breve
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
