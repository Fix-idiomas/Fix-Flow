// src/lib/hooks/usePushNotifications.ts
// React hook para integrar push na UI de onboarding.
// Usa requestAndRegisterPush() e mantém estado simples.

import { useCallback, useState } from "react";
import { requestAndRegisterPush } from "../fcm";

export type PushState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; token: string }
  | { status: "denied"; reason: string }
  | { status: "error"; reason: string };

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({ status: "idle" });

  const request = useCallback(async () => {
    setState({ status: "requesting" });
    const r = await requestAndRegisterPush();
    if (r.ok) {
      setState({ status: "granted", token: r.token });
    } else if (r.reason === "denied" || r.reason === "default" || r.reason === "unsupported") {
      setState({ status: "denied", reason: r.reason });
    } else {
      setState({ status: "error", reason: r.reason });
    }
  }, []);

  return { state, request };
}
