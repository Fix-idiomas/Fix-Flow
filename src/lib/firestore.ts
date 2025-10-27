// src/lib/firestore.ts
// Helpers de Firestore para o protótipo — caminho “não intrusivo”.

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit as qLimit,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Escreve um “ping” de saúde em:
 * artifacts/{appId}/public/health/pings/{uid}
 * Retorna o caminho usado (string).
 */
export async function tryWriteHealthPing(
  appId: string,
  uid: string
): Promise<string> {
  // Evita caracteres problemáticos no segmento do path
  const safeAppId = encodeURIComponent(appId);

  // Forma segmentada do path (evita 400 Bad Request)
  const ref = doc(db, "artifacts", safeAppId, "public", "health", "pings", uid);

  // Campos mínimos e SEM undefined
  const payload = {
    at: serverTimestamp(),
    ua:
      typeof navigator !== "undefined" && navigator.userAgent
        ? navigator.userAgent
        : "unknown",
  };

  await setDoc(ref, payload, { merge: true });
  return `artifacts/${safeAppId}/public/health/pings/${uid}`;
}

/**
 * Lê o “ping” em:
 * artifacts/{appId}/public/health/pings/{uid}
 * Retorna { exists, data }.
 */
export async function tryReadHealthPing(
  appId: string,
  uid: string
): Promise<{ exists: boolean; data: Record<string, unknown> | undefined }> {
  const safeAppId = encodeURIComponent(appId);
  const ref = doc(db, "artifacts", safeAppId, "public", "health", "pings", uid);
  const snap = await getDoc(ref);
  return { exists: snap.exists(), data: snap.data() };
}

/* =========================
   Public Profile helpers
   ========================= */

/**
 * Cria/atualiza o perfil público do usuário:
 * artifacts/{appId}/public/data/public_profiles/{uid}
 * Regras permitem escrever apenas displayName (string) e points (int >= 0)
 * e somente no próprio documento (uid).
 */
export async function upsertPublicProfile(
  appId: string,
  uid: string,
  displayName: string,
  points: number
): Promise<void> {
  const safeAppId = encodeURIComponent(appId);
  const ref = doc(
    db,
    "artifacts",
    safeAppId,
    "public",
    "data",
    "public_profiles",
    uid
  );

  // Sanitização simples
  const cleaned = {
    displayName: (displayName || "Aluno").toString().slice(0, 80),
    points: Math.max(0, Number.isFinite(points) ? Math.floor(points) : 0),
    updatedAt: serverTimestamp(), // opcional; regra não exige
  };

  await setDoc(ref, cleaned, { merge: true });
}

/**
 * Busca top perfis ordenados por pontos (leitura é pública pelas regras):
 * artifacts/{appId}/public/data/public_profiles
 */
export async function getTopPublicProfiles(
  appId: string,
  topN = 5
): Promise<Array<{ id: string; displayName: string; points: number }>> {
  const safeAppId = encodeURIComponent(appId);
  const colRef = collection(
    db,
    "artifacts",
    safeAppId,
    "public",
    "data",
    "public_profiles"
  );
  const q = query(colRef, orderBy("points", "desc"), qLimit(topN));
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      displayName: typeof data?.displayName === "string" ? data.displayName : "Aluno",
      points: typeof data?.points === "number" ? data.points : 0,
    };
  });
}

/* =========================
   Paths utilitários (MVP Templates)
   ========================= */
/**
 * Helpers centralizados para evitar "string solta" de caminhos.
 * Sempre usa appId sanitizado (encodeURIComponent).
 * Retornam caminhos em string — compatível com doc()/collection().
 */
export const paths = {
  /**
   * Catálogo de templates (placeholders) do app.
   * Ex.: artifacts/{APP_ID}/public/templates
   */
  templatesRoot(appId: string) {
    const safeAppId = encodeURIComponent(appId);
    return `artifacts/${safeAppId}/public/templates`;
  },

  /**
   * Atividade do dia “current”.
   * Ex.: artifacts/{APP_ID}/public/daily_activity/current
  */
  dailyActivityCurrent(appId: string) {
    const safeAppId = encodeURIComponent(appId);
    // Alternância correta: artifacts(C)/APP_ID(D)/public(C)/data(D)/daily_activity(C)/current(D)
    return `artifacts/${safeAppId}/public/data/daily_activity/current`;
  },
  /**
   * Tentativas do usuário (runner genérico).
   * Ex.: artifacts/{APP_ID}/users/{uid}/data/app/attempts
   */
  userAttemptsCol(appId: string, uid: string) {
    const safeAppId = encodeURIComponent(appId);
    return `artifacts/${safeAppId}/users/${uid}/data/app/attempts`;
  },

  /**
   * Perfil público (coleção).
   * Ex.: artifacts/{APP_ID}/public/data/public_profiles
   * (mantido aqui por conveniência de reuso futuro)
   */
  publicProfilesCol(appId: string) {
    const safeAppId = encodeURIComponent(appId);
    return `artifacts/${safeAppId}/public/data/public_profiles`;
  },
};