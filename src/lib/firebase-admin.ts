// Server-side Firebase Admin initialization and ID token verification
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp: App | null = null;

function sanitizePrivateKey(pk: string | undefined | null): string | null {
  if (!pk) return null;
  let v = pk.trim();
  // Remove surrounding quotes if present
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  // Replace literal \n with actual newlines
  if (v.includes("\\n")) v = v.replace(/\\n/g, "\n");
  return v;
}

function looksLikeServiceAccount(obj: any): boolean {
  return !!(obj && typeof obj === "object" && typeof obj.client_email === "string" && typeof obj.private_key === "string");
}

function getServiceAccountFromEnv(): any | null {
  // Option 1: Full JSON in FIREBASE_SERVICE_ACCOUNT
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saJson) {
    try {
      const parsed = JSON.parse(saJson);
      if (looksLikeServiceAccount(parsed)) {
        parsed.private_key = sanitizePrivateKey(parsed.private_key);
        return parsed;
      }
    } catch {}
  }

  // Option 2: Individual fields
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = sanitizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  return null;
}

export function getFirebaseAdmin(): App | null {
  if (adminApp) return adminApp;
  const sa = getServiceAccountFromEnv();
  if (!sa) return null;
  const apps = getApps();
  adminApp = apps.length ? apps[0]! : initializeApp({ credential: cert(sa) });
  return adminApp;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<string | null> {
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}
