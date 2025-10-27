"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * Rota inicial (placeholder) para gerenciamento de Templates.
 * Não faz chamadas ao Firestore ainda.
 * Objetivo: viabilizar navegação /prof/templates sem quebrar nada.
 */
export default function TemplatesPage() {
  const [loading] = useState(false);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Templates (placeholders)</h1>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          disabled
          title="Em breve: criar/duplicar template"
        >
          <Plus className="h-4 w-4" />
          Novo template
        </button>
      </header>

      <section className="rounded-xl border bg-white p-4">
        <p className="text-sm text-gray-600">
          Esta é a tela inicial de <strong>Templates</strong>. Ainda não há
          integração com Firestore — apenas um placeholder para o fluxo do
          patch T0. Próximos passos:
        </p>
        <ol className="mt-3 list-inside list-decimal text-sm text-gray-700">
          <li>Registrar paths de templates no Firestore.</li>
          <li>Listar templates (placeholders) existentes.</li>
          <li>Ações: criar rascunho, duplicar, publicar.</li>
        </ol>

        <div className="mt-5">
          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium">Status</div>
            <div className="mt-1 text-sm text-gray-700">
              {loading ? "Carregando..." : "OK — placeholder pronto"}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/"
            className="text-sm underline underline-offset-2 hover:opacity-90"
          >
            ← Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
