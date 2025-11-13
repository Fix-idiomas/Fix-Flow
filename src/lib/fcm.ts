// src/lib/fcm.ts
// Helper para solicitar permissão e registrar token FCM no backend.
// Requer: NEXT_PUBLIC_FCM_VAPID_KEY e NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID no ambiente.

import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
};

function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export async function requestAndRegisterPush(): Promise<
  | { ok: true; token: string }
  | { ok: false; reason: string }
> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "server" };
    const supported = await isSupported().catch(() => false);
    if (!supported) return { ok: false, reason: "unsupported" };

    const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
    if (!vapidKey) return { ok: false, reason: "missing_vapid" };

    // Soft ask is responsibility of caller (UI). Browser prompt below:
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: perm };

    const app = getFirebaseApp();
    const auth = getAuth(app);
    // Ensure anonymous auth to obtain a UID we can send to the server
    if (!auth.currentUser) {
      await signInAnonymously(auth).catch(() => undefined);
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return { ok: false, reason: "no_uid" };
    const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);

    // Ensure a service worker is registered for FCM (required for tokens and background messages)
    let swReg: ServiceWorkerRegistration | undefined = undefined;
    if ("serviceWorker" in navigator) {
      // Prefer an existing registration; otherwise register and then await readiness
      swReg = (await navigator.serviceWorker.getRegistration().catch(()=>undefined)) || undefined;
      if (!swReg) {
        try { swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }); } catch {}
      }
      // Wait for an active/ready registration for reliability on first install
      try {
        const ready = await navigator.serviceWorker.ready;
        if (ready) swReg = ready;
      } catch {}
    }
    const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg }).catch(() => "");
    if (!token) return { ok: false, reason: "token_failed" };

    // Best-effort: initialize Flow user on server (idempotent)
    try {
      await fetch("/api/auth/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          // Fallback for MVP
          "x-firebase-uid": uid,
        },
        body: "{}",
      });
    } catch {}

    // Send token to backend
    const res = await fetch("/api/push/register-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        // Fallback for MVP
        "x-firebase-uid": uid,
      },
      body: JSON.stringify({ token, platform: "web", userAgent: navigator.userAgent }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const data = await res.json();
        detail = data?.error || data?.message || "";
      } catch {}
      return { ok: false, reason: `server_${res.status}${detail ? ":" + detail : ""}` };
    }

    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "error" };
  }
}
