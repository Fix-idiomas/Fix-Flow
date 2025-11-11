// Força renderização dinâmica no lado do servidor
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import FirstRunClient from "@/app/atividade-inicio/FirstRunClient";

export default function FirstRunPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8 text-sm text-slate-600">Carregando…</div>}>
      <FirstRunClient />
    </Suspense>
  );
}
