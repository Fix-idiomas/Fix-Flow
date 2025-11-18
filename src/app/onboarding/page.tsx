"use client";
import { useEffect, useMemo, useState } from "react";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { auth } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state: pushState, request: requestPush } = usePushNotifications();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const LS_KEY_STEP = "ff_onb_step";

  useEffect(() => {
    let mounted = true;
    async function ensureAuth() {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken && mounted) {
          // Pre-inicializa o usuário no backend (idempotente) e checa onboarding
          const res = await fetch("/api/auth/init", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "x-firebase-uid": auth.currentUser!.uid,
            },
          });
          if (res.ok) {
            const j = await res.json().catch(() => null);
            const completed = Boolean(j?.user?.onboardingCompleted);
            // Se já concluiu, ir direto para a home
            if (completed) {
              window.location.replace("/");
              return;
            }
            // Prefill com dados já existentes
            if (typeof j?.user?.displayName === "string") setDisplayName(j.user.displayName || "");
            if (typeof j?.user?.avatarUrl === "string") setAvatarUrl(j.user.avatarUrl || null);
          }
        }
        // Restaura passo salvo (apenas se não redirecionado)
        if (mounted) {
          const saved = Number(localStorage.getItem(LS_KEY_STEP) || "1");
          if (saved >= 1 && saved <= 4) setStep(saved as Step);
        }
      } catch {}
    }
    ensureAuth();
    return () => { mounted = false; };
  }, []);

  const canNextIdentity = useMemo(() => displayName.trim().length >= 2, [displayName]);

  async function saveIdentity() {
    setSaving(true); setError(null);
    try {
      // Garante auth + token
      if (!auth.currentUser) await signInAnonymously(auth);
      const idToken = await auth.currentUser?.getIdToken();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("no_uid");
      const res = await fetch("/api/profile/update-basic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          "x-firebase-uid": uid,
        },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `server_${res.status}`);
      }
      setStep(2);
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  }

  async function saveAvatar(url: string | null) {
    setSaving(true); setError(null);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const idToken = await auth.currentUser?.getIdToken();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("no_uid");
      const res = await fetch("/api/profile/update-basic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          "x-firebase-uid": uid,
        },
        body: JSON.stringify({ avatarUrl: url }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `server_${res.status}`);
      }
      setAvatarUrl(url);
      setStep(3);
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar avatar");
    } finally { setSaving(false); }
  }

  async function finish() {
    setSaving(true); setError(null);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const idToken = await auth.currentUser?.getIdToken();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("no_uid");
      const res = await fetch("/api/profile/complete-onboarding", {
        method: "POST",
        headers: {
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          "x-firebase-uid": uid,
        },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `server_${res.status}`);
      }
      // Limpa progresso local e segue para a home
      try { localStorage.removeItem(LS_KEY_STEP); } catch {}
      window.location.href = "/"; // home
    } catch (e: any) {
      setError(e?.message || "Erro ao concluir");
    } finally { setSaving(false); }
  }

  // Persiste o passo atual (simples) para evitar perder progresso no refresh
  useEffect(() => {
    try { localStorage.setItem(LS_KEY_STEP, String(step)); } catch {}
  }, [step]);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Bem-vindo(a) ao Fix Flow</h1>
      <p className="text-sm text-gray-500 mb-6">Vamos personalizar sua experiência em poucos passos.</p>

      <Progress step={step} />

      <div className="mt-6 border rounded-lg p-5 bg-white">
        {step === 1 && (
          <div>
            <h2 className="text-lg font-medium mb-4">Seu perfil</h2>
            <label className="block text-sm font-medium mb-1">Como devemos te chamar?</label>
            <input
              className="w-full border rounded px-3 py-2 mb-3"
              placeholder="Ex.: Ana"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <p className="text-xs text-gray-500 mb-4">Você pode editar isso depois em Perfil.</p>

            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

            <div className="flex gap-3">
              <button
                className="px-4 py-2 rounded bg-gray-100"
                onClick={() => setStep(2)}
              >Pular agora</button>
              <button
                disabled={!canNextIdentity || saving}
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
                onClick={saveIdentity}
              >{saving ? "Salvando..." : "Continuar"}</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <AvatarStep
            current={avatarUrl}
            onSkip={() => setStep(3)}
            onSave={saveAvatar}
          />
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-medium mb-2">Notificações</h2>
            <p className="text-sm text-gray-600 mb-3">Receba lembretes de estudo e avisos de progresso. Você pode mudar isso depois em Perfil.</p>
            {/* Soft ask: explicação antes do prompt nativo */}
            {pushState.status === "idle" && (
              <div className="mb-4 rounded border bg-slate-50 p-3 text-sm text-slate-700">
                Vamos pedir permissão do navegador para enviar notificações. Isso ajuda a manter a rotina.
                <div className="mt-3 flex gap-2">
                  <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={requestPush}>Ativar agora</button>
                  <button className="px-3 py-2 rounded border" onClick={() => setStep(4)}>Pedir depois</button>
                </div>
              </div>
            )}
            <PushCard state={pushState} onRequest={requestPush} />
            <div className="mt-4 flex gap-3">
              <button className="px-4 py-2 rounded bg-gray-100" onClick={() => setStep(2)}>Voltar</button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={() => setStep(4)}>Continuar</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-lg font-medium mb-2">Tudo pronto!</h2>
            <p className="text-sm text-gray-600 mb-4">Você pode alterar suas preferências depois em Perfil.</p>
            {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded bg-gray-100" onClick={() => setStep(3)}>Voltar</button>
              <button className="px-4 py-2 rounded bg-green-600 text-white" onClick={finish}>
                {saving ? "Finalizando..." : "Concluir e começar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2">
      {[1,2,3,4].map((s) => (
        <div key={s}
          className={"h-1 rounded-full " + (s <= step ? "bg-blue-600" : "bg-gray-200")} 
          style={{ flex: 1 }}
        />
      ))}
    </div>
  );
}

function PushCard({ state, onRequest }: { state: ReturnType<typeof usePushNotifications>["state"]; onRequest: () => void }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm mb-2">Status: <span className="font-medium">{state.status}</span></div>
      {state.status === "granted" && (
        <div className="text-xs text-gray-500 break-all">Token: {state.token}</div>
      )}
      {state.status === "denied" && (
        <div className="text-xs text-red-600">Permissão negada: {state.reason}</div>
      )}
      {state.status === "error" && (
        <div className="text-xs text-red-600">Erro: {state.reason}</div>
      )}
      <button className="mt-3 px-3 py-2 rounded bg-blue-600 text-white" onClick={onRequest}>
        Ativar notificações
      </button>
      <p className="text-xs text-gray-500 mt-3">Você pode ajustar isso depois nas configurações do navegador.</p>
    </div>
  );
}

function AvatarStep({ current, onSave, onSkip }: { current: string | null; onSave: (url: string | null) => void; onSkip: () => void }) {
  const [selected, setSelected] = useState<string | null>(current ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const presets = useMemo(() => {
    const seeds = ["Alex", "Bianca", "Caio", "Duda", "Enzo", "Fabi", "Gabi", "Heitor"];
    return seeds.map((s) => `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(s)}`);
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadErr(null);
      setUploading(true);
      if (!auth.currentUser) await signInAnonymously(auth);
      const { storage } = await import("@/lib/firebase");
      const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const path = `avatars/${auth.currentUser!.uid}/${Date.now()}_${file.name}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      setSelected(url);
    } catch (err: any) {
      setUploadErr(err?.message || "Falha no upload. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-medium mb-2">Seu avatar</h2>
      <p className="text-sm text-gray-600 mb-4">Escolha um avatar ou envie uma imagem.</p>
      <div className="grid grid-cols-4 gap-3">
        {presets.map((url) => (
          <button key={url} className={`aspect-square rounded overflow-hidden border ${selected===url?"ring-2 ring-blue-600":""}`} onClick={() => setSelected(url)}>
            <img src={url} alt="avatar" className="w-full h-full object-cover" />
          </button>
        ))}
        <label className="aspect-square grid place-items-center rounded border cursor-pointer text-sm text-slate-600 bg-slate-50">
          Upload
          <input type="file" accept="image/*" className="hidden" onChange={onFile} />
        </label>
      </div>
      {uploadErr && <div className="mt-2 text-sm text-red-600">{uploadErr}</div>}
      <div className="mt-4 flex gap-3">
        <button className="px-4 py-2 rounded bg-gray-100" onClick={onSkip}>Pular</button>
        <button disabled={uploading} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={() => onSave(selected ?? null)}>
          {uploading ? "Enviando..." : "Salvar e continuar"}
        </button>
      </div>
    </div>
  );
}
