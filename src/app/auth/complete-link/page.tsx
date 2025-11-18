'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import {
  onAuthStateChanged,
  isSignInWithEmailLink,
  EmailAuthProvider,
  linkWithCredential,
  signInWithEmailLink,
  type User,
} from 'firebase/auth';

export default function CompleteLinkPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(!auth.currentUser);
  const [email, setEmail] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const href = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), []);
  const emailFromStorage = useMemo(() => (typeof window !== 'undefined' ? window.localStorage.getItem('fx_magic_email') || '' : ''), []);
  const openedOnDifferentDevice = useMemo(() => typeof window !== 'undefined' && !emailFromStorage, [emailFromStorage]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!href) return;
    if (!isSignInWithEmailLink(auth, href)) {
      setInfo('Link inválido ou expirado. Solicite um novo link.');
      return;
    }
    if (emailFromStorage && !email) setEmail(emailFromStorage);
  }, [href, emailFromStorage, email]);

  const promote = async () => {
    try {
      const idToken = await auth.currentUser!.getIdToken();
      await fetch('/api/auth/promote', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` } });
    } catch {}
  };

  const handleComplete = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new Error('Informe um email válido.');
      }
      if (user && user.isAnonymous) {
        const cred = EmailAuthProvider.credentialWithLink(email, href);
        await linkWithCredential(user, cred);
      } else {
        await signInWithEmailLink(auth, email, href);
      }
      try { window.localStorage.removeItem('fx_magic_email'); } catch {}
      await promote();
      setInfo('Conta vinculada com sucesso. Redirecionando…');
      setTimeout(() => router.push('/'), 800);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível concluir o login por link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">Concluir login por link</h1>
      <div className="mb-3 rounded border border-amber-300 bg-amber-50 text-amber-800 text-sm p-3">
        Para manter seu progresso atual, finalize este login <strong>neste mesmo dispositivo</strong>.
        Após concluir, você poderá entrar em <strong>qualquer dispositivo</strong> e continuar normalmente —
        todo novo progresso ficará salvo na mesma conta. <strong>Mas não se preocupe</strong>: você só precisa fazer isso
        <strong> desta vez</strong>. Depois de finalizar o cadastro, o seu progresso será salvo em <strong>qualquer
        dispositivo</strong> que você utilizar.
      </div>
      {openedOnDifferentDevice && (
        <div className="mb-3 rounded border border-blue-300 bg-blue-50 text-blue-800 text-sm p-3">
          Parece que este link foi aberto em outro dispositivo ou navegador.
          Para <strong>preservar seu progresso atual</strong>, abra o email e clique no link no <strong>mesmo dispositivo</strong> onde você iniciou.
          Se preferir continuar aqui, seu acesso será concluído normalmente, mas o progresso anônimo do outro dispositivo <strong>não será vinculado automaticamente</strong>.
        </div>
      )}
      {loadingAuth ? (
        <div>Carregando…</div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Confirme seu email para finalizar {user?.isAnonymous ? 'a vinculação' : 'o acesso'}.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded border px-3 py-2 text-sm"
            disabled={busy}
          />
          <button
            onClick={handleComplete}
            disabled={busy || !email}
            className="bg-slate-900 text-white px-4 py-2 rounded disabled:opacity-60"
          >
            Concluir
          </button>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {info && <div className="text-sm text-green-600">{info}</div>}
        </div>
      )}
    </main>
  );
}
