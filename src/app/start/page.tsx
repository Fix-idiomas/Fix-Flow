"use client";

import { useRouter } from "next/navigation";
import { BookOpen, Volume2, Headphones } from "lucide-react";
import { useCallback } from "react";

type Option = {
  key: "word" | "pronunciation" | "listening";
  title: string;
  desc: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const OPTIONS: Option[] = [
  { key: "word", title: "Aprender uma palavra", desc: "Descubra e use uma palavra nova agora.", Icon: BookOpen },
  { key: "pronunciation", title: "Praticar pronúncia", desc: "Fale e ajuste sua pronúncia.", Icon: Volume2 },
  { key: "listening", title: "Ouvir e entender", desc: "Treine sua compreensão auditiva.", Icon: Headphones },
];

export default function StartPage() {
  const router = useRouter();

  const go = useCallback((mode: Option["key"]) => {
    // MVP: guardamos a preferência local e abrimos o runner com um hint
    localStorage.setItem("ff_last_mode", mode);
     router.push(`/atividade-inicio?mode=${mode}`);
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Hi! o que você quer aprender agora?</h1>
        <p className="mt-1 text-sm text-slate-600">Escolha uma opção para começar — é rápido e guiado.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {OPTIONS.map(({ key, title, desc, Icon }) => (
          <button
            key={key}
            onClick={() => go(key)}
            className="group rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white transition group-hover:scale-105">
                <Icon size={20} />
              </div>
              <h2 className="text-sm font-semibold">{title}</h2>
            </div>
            <p className="text-sm text-slate-600">{desc}</p>
            <div className="mt-3 text-xs font-medium text-slate-500">Começar →</div>
          </button>
        ))}
      </section>

      <p className="mt-6 text-xs text-slate-500">
        Dica: você pode mudar de opção a qualquer momento. Vamos ajustar o conteúdo conforme seu ritmo.
      </p>
    </main>
  );
}
