"use client";
import { useEffect, useMemo, useState } from "react";
import { auth, storage } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";

type Profile = { id: string; firebaseUid: string; displayName: string | null; avatarUrl: string | null; onboardingCompleted: boolean };

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const [avatarTask, setAvatarTask] = useState<ReturnType<typeof uploadBytesResumable> | null>(null);
  const { state: pushState, request: requestPush, debug: pushDebug } = usePushNotifications();
  const [pushBackend, setPushBackend] = useState<null | { hasToken: boolean; tokens: string[] }>(null);
  useEffect(() => {
    (async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);
        const idToken = await auth.currentUser?.getIdToken().catch(()=>undefined);
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const res = await fetch("/api/push/status", {
          headers: {
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            "x-firebase-uid": uid,
          }
        });
        if (res.ok) {
          const j = await res.json();
          setPushBackend({ hasToken: j.hasToken, tokens: j.tokens || [] });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!auth.currentUser) await signInAnonymously(auth);
        const idToken = await auth.currentUser?.getIdToken();
        const uid = auth.currentUser?.uid!;
        const res = await fetch("/api/auth/init", {
          method: "POST",
          headers: {
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            "x-firebase-uid": uid,
          },
        });
        const j = await res.json();
        if (mounted && res.ok) {
          setProfile(j.user);
          setDisplayName(j.user?.displayName || "");
          setAvatarUrl(j.user?.avatarUrl || null);
        }
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function saveProfile() {
    setSaving(true); setError(null);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const idToken = await auth.currentUser?.getIdToken();
      const uid = auth.currentUser?.uid!;
      const res = await fetch("/api/profile/update-basic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          "x-firebase-uid": uid,
        },
        body: JSON.stringify({ displayName, avatarUrl }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `server_${res.status}`);
      if (j?.user) {
        setProfile(j.user);
        setDisplayName(j.user.displayName || "");
        setAvatarUrl(j.user.avatarUrl || null);
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploadError(null);
      setUploadingAvatar(true);
      setAvatarProgress(0);
      if (!/^image\//.test(file.type)) {
        throw new Error("Tipo de arquivo inválido");
      }
      const MAX_MB = 5;
      if (file.size > MAX_MB * 1024 * 1024) {
        throw new Error(`Imagem maior que ${MAX_MB}MB`);
      }
      if (!auth.currentUser) await signInAnonymously(auth);
      const path = `avatars/${auth.currentUser!.uid}/${Date.now()}_${file.name}`;
      const r = ref(storage, path);
      let uploadedRef = null as null | ReturnType<typeof ref>;
      try {
        const task = uploadBytesResumable(r, file, { contentType: file.type });
        setAvatarTask(task);
        await new Promise<void>((resolve, reject) => {
          task.on("state_changed", (snap) => {
            if (snap.totalBytes) {
              setAvatarProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          }, (err) => reject(err), () => resolve());
        });
        uploadedRef = task.snapshot.ref as any;
      } catch (err: any) {
        console.warn("Resumable upload falhou, tentando fallback simples", err);
        if (err?.code === 'storage/canceled') throw err; // não tentar fallback se usuário cancelou
        // Fallback para uploadBytes (menos headers CORS)
        await uploadBytes(r, file, { contentType: file.type } as any);
        uploadedRef = r as any;
      }
      const url = await getDownloadURL(uploadedRef! as any);
      setAvatarUrl(url);
    } catch (err: any) {
      const code = err?.code || "";
      let friendly = err?.message || "Falha no upload. Tente novamente.";
      if (code === 'storage/canceled') friendly = "Upload cancelado.";
      // CORS típico: preflight 404/blocked => net::ERR_FAILED + tarefa vira canceled
      if (/CORS|preflight/i.test(err?.message || "") || (code === 'storage/canceled' && avatarProgress === 0)) {
        friendly += " Verifique CORS do bucket e domínio autorizado no Firebase (localhost:3000).";
      }
      setAvatarUploadError(friendly);
    } finally {
      setUploadingAvatar(false);
      setAvatarTask(null);
      setAvatarProgress(null);
    }
  }

  function cancelUpload() {
    try {
      avatarTask?.cancel();
      setAvatarUploadError("Upload cancelado");
    } catch {}
  }

  const presets = useMemo(() => {
    const seeds = ["Alex", "Bianca", "Caio", "Duda", "Enzo", "Fabi", "Gabi", "Heitor"];
    return seeds.map((s) => `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${encodeURIComponent(s)}`);
  }, []);

  if (loading) return <div className="p-6">Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-2">Seu perfil</h1>
      <p className="text-sm text-gray-500 mb-6">Atualize nome, avatar e notificações.</p>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      <div className="grid gap-6">
        <section className="border rounded-lg p-4 bg-white">
          <h2 className="font-medium mb-3">Identidade</h2>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input className="w-full border rounded px-3 py-2" value={displayName} onChange={(e)=>setDisplayName(e.target.value)} />
        </section>

        <section className="border rounded-lg p-4 bg-white">
          <h2 className="font-medium mb-3">Avatar</h2>
          <div className="flex items-center gap-4 mb-3">
            <div className="h-16 w-16 rounded-full overflow-hidden border bg-slate-100">
              {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : null}
            </div>
            <label className={`px-3 py-2 rounded border ${uploadingAvatar?"opacity-60 cursor-not-allowed":"cursor-pointer"}`}>
              {uploadingAvatar ? (avatarProgress != null ? `Enviando ${avatarProgress}%` : "Enviando...") : "Upload"}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploadingAvatar} />
            </label>
            {uploadingAvatar && <button type="button" onClick={cancelUpload} className="text-xs text-red-600 underline">Cancelar</button>}
          </div>
          {avatarUploadError && <div className="text-sm text-red-600 mb-2">{avatarUploadError}</div>}
          <div className="grid grid-cols-6 gap-3">
            {presets.map((url) => (
              <button key={url} className={`aspect-square rounded overflow-hidden border ${avatarUrl===url?"ring-2 ring-blue-600":""}`} onClick={() => setAvatarUrl(url)}>
                <img src={url} alt="avatar" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>

        <section className="border rounded-lg p-4 bg-white">
          <h2 className="font-medium mb-3">Notificações</h2>
          <div className="text-sm">Status: <span className="font-medium">{pushState.status}</span></div>
          {pushDebug && (
            <div className="text-xs text-gray-500 mt-1">Debug: perm={String(pushDebug.rawPerm)} | supported={String(pushDebug.supported)} | sw={String(pushDebug.hasSw)}</div>
          )}
          {pushBackend && (
            <div className="text-xs text-gray-500 mt-1">Backend: {pushBackend.hasToken ? `token registrado (${pushBackend.tokens.length})` : "sem token"}</div>
          )}
          {pushState.status === "granted" && (
            <div className="text-xs text-gray-500 break-all mt-1">Token: {pushState.token}</div>
          )}
          {pushState.status === "denied" && (
            <div className="text-xs text-red-600 mt-1">Permissão negada: {pushState.reason}. Você pode reativar nas configurações do navegador.</div>
          )}
          {pushState.status === "error" && (
            <div className="text-xs text-red-600 mt-1">Erro: {pushState.reason}</div>
          )}
          <button className="mt-2 px-3 py-2 rounded bg-blue-600 text-white" onClick={requestPush}>Ativar/Reativar</button>
        </section>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded bg-gray-100" onClick={() => window.history.back()}>Voltar</button>
          <button disabled={saving} className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50" onClick={saveProfile}>{saving?"Salvando…":"Salvar alterações"}</button>
        </div>
      </div>
    </div>
  );
}
