"use client";

import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { useEffect } from "react";

export default function PushTestPage() {
  const { state, request } = usePushNotifications();

  useEffect(() => {
    // optional: log state transitions for debugging
    // console.log("push state", state);
  }, [state]);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Push Test</h1>
      <p className="text-sm text-slate-600">
        Este é um teste simples para solicitar permissão do navegador, obter o token
        do FCM e enviá-lo ao backend.
      </p>

      <div className="rounded-md border p-4 bg-white">
        <div className="mb-3 text-sm">
          <strong>Status:</strong>{" "}
          {state.status === "idle" && "idle"}
          {state.status === "requesting" && "solicitando permissão / registrando..."}
          {state.status === "granted" && "permitido"}
          {state.status === "denied" && `negado (${state.reason})`}
          {state.status === "error" && `erro (${state.reason})`}
        </div>

        {state.status === "granted" && (
          <div className="text-xs break-all text-slate-700">
            <strong>Token:</strong> {state.token.slice(0, 28)}...{state.token.slice(-12)}
          </div>
        )}

        <button
          onClick={request}
          className="mt-3 inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Solicitar permissão e registrar token
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Dica: Verifique o arquivo <code>public/firebase-messaging-sw.js</code> e as
        variáveis <code>NEXT_PUBLIC_FCM_VAPID_KEY</code> e
        <code> NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</code>.
      </p>
    </div>
  );
}
