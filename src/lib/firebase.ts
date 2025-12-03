// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID, // opcional
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  // Necessário para Firebase Storage
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`
      : undefined),
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Exports padronizados (use sempre estes):
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Expor auth para debugging no console em dev (não em produção)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  window.__FF_AUTH__ = auth;
}

export { app, auth, db, storage };
