// src/lib/hooks/usePushNotifications.ts
// React hook para integrar push na UI de onboarding.
// Usa requestAndRegisterPush() e mantém estado simples.

import { useCallback, useEffect, useState } from "react";
import { requestAndRegisterPush } from "../fcm";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app } from "../firebase";

export type PushState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; token: string }
  | { status: "denied"; reason: string }
  | { status: "error"; reason: string };

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({ status: "idle" });
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Initialize status on mount without prompting the browser
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (typeof window === "undefined") return;
        const supported = await isSupported().catch(() => false);
        const rawPerm = Notification.permission;
        let swReg: ServiceWorkerRegistration | undefined = undefined;
        if ("serviceWorker" in navigator) {
          swReg = (await navigator.serviceWorker.getRegistration().catch(()=>undefined)) || undefined;
          if (!swReg) {
            try { swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }); } catch {}
          }
          try {
            const ready = await navigator.serviceWorker.ready;
            if (ready) swReg = ready;
          } catch {}
        }
        setDebugInfo({ supported, rawPerm, hasSw: !!swReg });
        if (!supported) {
          if (alive) setState({ status: "denied", reason: "unsupported" });
          return;
        }
        const perm = Notification.permission; // 'granted' | 'denied' | 'default'
        if (perm === "granted") {
          // Try to get existing token (no prompt)
          const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
          if (!vapidKey) {
            if (alive) setState({ status: "error", reason: "missing_vapid" });
            return;
          }
          // Ensure SW registration before attempting to fetch token silently
          let swReg: ServiceWorkerRegistration | undefined = undefined;
          if ("serviceWorker" in navigator) {
            swReg = (await navigator.serviceWorker.getRegistration().catch(()=>undefined)) || undefined;
            if (!swReg) {
              try { swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }); } catch {}
            }
            try {
              const ready = await navigator.serviceWorker.ready;
              if (ready) swReg = ready;
            } catch {}
          }
          const messaging = getMessaging(app);
          const cached = typeof localStorage !== "undefined" ? localStorage.getItem("ff_push_token") || "" : "";
          let token = cached;
          if (!token) {
            token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg }).catch(() => "");
          }
          if (token) {
            if (typeof localStorage !== "undefined") localStorage.setItem("ff_push_token", token);
            if (alive) setState({ status: "granted", token });
          } else {
            if (alive) setState({ status: "error", reason: "token_failed" });
          }
        } else if (perm === "denied") {
          if (alive) setState({ status: "denied", reason: "denied" });
        } else {
          // default: keep idle until user requests
          if (alive) setState({ status: "idle" });
        }
      } catch (e: any) {
        if (alive) setState({ status: "error", reason: e?.message || "error" });
      }
    })();
    return () => { alive = false; };
  }, []);

  const request = useCallback(async () => {
    setState({ status: "requesting" });
    const r = await requestAndRegisterPush();
    if (r.ok) {
      setState({ status: "granted", token: r.token });
      try { if (typeof localStorage !== "undefined") localStorage.setItem("ff_push_token", r.token); } catch {}
    } else if (r.reason === "denied" || r.reason === "default" || r.reason === "unsupported") {
      setState({ status: "denied", reason: r.reason });
    } else {
      setState({ status: "error", reason: r.reason });
    }
  }, []);

  return { state, request, debug: debugInfo };
}
