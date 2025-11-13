"use client";
import { useEffect, useMemo, useState } from "react";
import { auth, storage } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { validateCEP, validateUF, normalizeCPF } from "@/lib/validation/profile";

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
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [pushBackend, setPushBackend] = useState<null | { hasToken: boolean; tokens: string[] }>(null);
  // Extended profile state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [addrComplement, setAddrComplement] = useState("");
  const [addrNeighborhood, setAddrNeighborhood] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrCep, setAddrCep] = useState("");
  const [savingSensitive, setSavingSensitive] = useState(false);
  const [sensitiveMsg, setSensitiveMsg] = useState<string | null>(null);
  const [sensitiveWarnings, setSensitiveWarnings] = useState<string[]>([]);
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

  // Auto-sync: se já há permissão e token local, garante registro no backend
  useEffect(() => {
    (async () => {
      try {
        if (pushState.status !== "granted") return;
        if (pushBackend?.hasToken) return;
        if (!auth.currentUser) await signInAnonymously(auth);
        const idToken = await auth.currentUser?.getIdToken().catch(()=>undefined);
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        await fetch("/api/push/register-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            "x-firebase-uid": uid,
          },
          body: JSON.stringify({ token: pushState.token }),
        });
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
  }, [pushState.status]);

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
          // Prefill if backend returns these (optional; only if columns exist)
          if (typeof j.user?.fullName === "string") setFullName(j.user.fullName || "");
          if (typeof j.user?.email === "string") setEmail(j.user.email || "");
          // Prefill private data if available
          if (j.private) {
            if (typeof j.private.phone === "string") setPhone(j.private.phone || "");
            if (typeof j.private.cpf === "string") setCpf(j.private.cpf || "");
            if (typeof j.private.street === "string") setAddrStreet(j.private.street || "");
            if (typeof j.private.number === "string") setAddrNumber(j.private.number || "");
            if (typeof j.private.complement === "string") setAddrComplement(j.private.complement || "");
            if (typeof j.private.neighborhood === "string") setAddrNeighborhood(j.private.neighborhood || "");
            if (typeof j.private.city === "string") setAddrCity(j.private.city || "");
            if (typeof j.private.state === "string") setAddrState(j.private.state || "");
            if (typeof j.private.cep === "string") setAddrCep(j.private.cep || "");
          }
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
  
  async function saveSensitive() {
    setSavingSensitive(true); setSensitiveMsg(null); setSensitiveWarnings([]);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const idToken = await auth.currentUser?.getIdToken();
      const uid = auth.currentUser?.uid!;
      // Basic client-side checks (optional; server will revalidate)
      // CEP
      if (addrCep) {
        const cv = validateCEP(addrCep);
        if (!cv.ok) throw new Error("invalid_cep");
      }
      // UF
      if (addrState) {
        const sv = validateUF(addrState);
        if (!sv.ok) throw new Error("invalid_uf");
      }
      // CPF
      if (cpf) {
        const nv = normalizeCPF(cpf);
        if (!nv.ok) throw new Error("invalid_cpf");
      }
      const body: any = {};
      if (fullName) body.fullName = fullName;
      if (email) body.email = email;
      if (phone) body.phone = phone;
  if (cpf) body.cpf = cpf;
      const address: any = {};
      if (addrStreet) address.street = addrStreet;
      if (addrNumber) address.number = addrNumber;
      if (addrComplement) address.complement = addrComplement;
      if (addrNeighborhood) address.neighborhood = addrNeighborhood;
      if (addrCity) address.city = addrCity;
      if (addrState) address.state = addrState;
      if (addrCep) address.cep = addrCep;
      if (Object.keys(address).length > 0) body.address = address;

      const res = await fetch("/api/profile/update-sensitive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          "x-firebase-uid": uid,
        },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `server_${res.status}`);
      // Update UI with returned data when available
      if (j?.user) {
        setFullName(j.user.fullName || fullName);
        setEmail(j.user.email || email);
      }
      if (j?.private) {
        if (j.private.cpf) setCpf(j.private.cpf);
        if (j.private.phone) setPhone(j.private.phone);
        if (j.private.street) setAddrStreet(j.private.street);
        if (j.private.number) setAddrNumber(j.private.number);
        if (j.private.complement) setAddrComplement(j.private.complement);
        if (j.private.neighborhood) setAddrNeighborhood(j.private.neighborhood);
        if (j.private.city) setAddrCity(j.private.city);
        if (j.private.state) setAddrState(j.private.state);
        if (j.private.cep) setAddrCep(j.private.cep);
      }
      if (Array.isArray(j?.warnings)) setSensitiveWarnings(j.warnings);
      setSensitiveMsg("Dados pessoais salvos.");
    } catch (e: any) {
      const code = e?.message || "erro";
      let msg = "Erro ao salvar dados pessoais";
      if (code === "invalid_cpf") msg = "CPF inválido";
      else if (code === "cpf_in_use") msg = "CPF já em uso";
      else if (code === "invalid_email") msg = "E-mail inválido";
      else if (code === "email_in_use") msg = "E-mail já cadastrado";
      else if (code === "invalid_phone") msg = "Telefone inválido";
      else if (code === "invalid_cep") msg = "CEP inválido";
      else if (code === "invalid_uf") msg = "UF inválida";
      else if (/users\.email missing/i.test(code)) msg = "Campo de e-mail indisponível no momento";
      setSensitiveMsg(msg + (msg === "Erro ao salvar dados pessoais" ? ` (${code})` : ""));
    } finally {
      setSavingSensitive(false);
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

  async function sendTestPush() {
    setSendingTest(true);
    setTestResult(null);
    try {
      if (!auth.currentUser) await signInAnonymously(auth);
      const idToken = await auth.currentUser?.getIdToken().catch(()=>undefined);
      const uid = auth.currentUser?.uid;
      const currentToken = pushState.status === "granted" ? pushState.token : undefined;
      const res = await fetch("/api/push/send-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          ...(uid ? { "x-firebase-uid": uid } : {}),
        },
        // Prefer enviar para ESTE dispositivo (se tivermos o token em memória)
        body: JSON.stringify({ token: currentToken }),
      });
      const j = await res.json().catch(()=>({}));
      if (!res.ok) {
        const msg = j?.message || j?.error || `server_${res.status}`;
        throw new Error(msg);
      }
      setTestResult("Enviado! Verifique a notificação.");
    } catch (e: any) {
      setTestResult(`Falha ao enviar: ${e?.message || "erro"}`);
    } finally {
      setSendingTest(false);
    }
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
          <h2 className="font-medium mb-3">Dados pessoais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nome completo</label>
              <input className="w-full border rounded px-3 py-2" value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder="Ex.: Ana Maria Silva" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input className="w-full border rounded px-3 py-2" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="ana@exemplo.com" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input className="w-full border rounded px-3 py-2" value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="(11) 9 1234-5678" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CPF</label>
              <input className="w-full border rounded px-3 py-2" value={cpf} onChange={(e)=>setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Rua</label>
              <input className="w-full border rounded px-3 py-2" value={addrStreet} onChange={(e)=>setAddrStreet(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Número</label>
              <input className="w-full border rounded px-3 py-2" value={addrNumber} onChange={(e)=>setAddrNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Complemento</label>
              <input className="w-full border rounded px-3 py-2" value={addrComplement} onChange={(e)=>setAddrComplement(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bairro</label>
              <input className="w-full border rounded px-3 py-2" value={addrNeighborhood} onChange={(e)=>setAddrNeighborhood(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cidade</label>
              <input className="w-full border rounded px-3 py-2" value={addrCity} onChange={(e)=>setAddrCity(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">UF</label>
              <select className="w-full border rounded px-3 py-2" value={addrState} onChange={(e)=>setAddrState(e.target.value)}>
                <option value="">Selecione</option>
                {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf=> (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CEP</label>
              <input className="w-full border rounded px-3 py-2" value={addrCep} onChange={(e)=>setAddrCep(e.target.value)} placeholder="00000-000" />
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">Usamos estes dados para faturamento e comunicação. Você pode completar depois.</div>
          {sensitiveWarnings.length > 0 && (
            <div className="mt-2 text-xs text-amber-700">{sensitiveWarnings.join("; ")}</div>
          )}
          {sensitiveMsg && (
            <div className={`mt-2 text-sm ${sensitiveMsg.startsWith("Erro")?"text-red-600":"text-emerald-700"}`}>{sensitiveMsg}</div>
          )}
          <div className="mt-3">
            <button disabled={savingSensitive} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={saveSensitive}>
              {savingSensitive?"Salvando…":"Salvar dados pessoais"}
            </button>
          </div>
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
          <div className="flex gap-2 mt-2">
            <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={requestPush}>Ativar/Reativar</button>
            <button disabled={sendingTest || pushState.status !== "granted"} className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-50" onClick={sendTestPush}>{sendingTest?"Enviando…":"Enviar push de teste"}</button>
          </div>
          {testResult && (
            <div className={`text-xs mt-2 ${testResult.startsWith('Falha') ? 'text-red-600' : 'text-gray-600'}`}>
              {testResult}
            </div>
          )}
        </section>

        <div className="flex gap-3">
          <button className="px-4 py-2 rounded bg-gray-100" onClick={() => window.history.back()}>Voltar</button>
          <button disabled={saving} className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50" onClick={saveProfile}>{saving?"Salvando…":"Salvar alterações"}</button>
        </div>
      </div>
    </div>
  );
}
