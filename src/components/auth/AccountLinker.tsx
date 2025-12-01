'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, onAuthStateChanged, linkWithPopup, signInWithPopup, type User, sendSignInLinkToEmail } from 'firebase/auth';
import { useRouter } from 'next/navigation';

/**
 * Renders buttons to link an anonymous account to a permanent one.
 * This component is only visible to anonymous users.
 */
export const AccountLinker: React.FC = () => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(!auth.currentUser);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  const actionUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/auth/complete-link`;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading || !user || !user.isAnonymous) return null;

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      if (user.isAnonymous) {
        await linkWithPopup(user, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
      // Sync with Supabase backend
      const idToken = await auth.currentUser!.getIdToken();
      const resp = await fetch('/api/auth/promote', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || 'Falha ao sincronizar com o servidor');
      }
      setInfo('Conta vinculada com sucesso. Redirecionando…');
      setTimeout(() => {
        router.push('/');
      }, 700);
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === 'auth/credential-already-in-use') {
        setError('Esta conta Google já está vinculada a outro usuário. Use a tela de login para entrar com ela neste dispositivo.');
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Janela fechada antes de concluir o login.');
      } else if (code === 'auth/cancelled-popup-request') {
        setError('Já existe uma janela de login em andamento. Tente novamente.');
      } else {
        setError(e?.message || 'Falha ao conectar com Google');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSendMagicLink = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new Error('Informe um email válido.');
      }
      const settings = {
        url: actionUrl,
        handleCodeInApp: true,
      } as const;
      window.localStorage.setItem('fx_magic_email', email);
      await sendSignInLinkToEmail(auth, email, settings);
      setInfo('Enviamos um link para seu email. Abra no mesmo dispositivo para manter seu progresso atual. Depois de concluir, você poderá usar a conta em qualquer dispositivo e todo novo progresso será salvo normalmente. Mas não se preocupe: você só precisa fazer isso desta vez. Depois de finalizar o cadastro, seu progresso será salvo em qualquer dispositivo que você utilizar.');
    } catch (e: any) {
      setError(e?.message || 'Falha ao enviar link mágico');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-2">Salve seu progresso!</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Crie uma conta para acessar seu histórico em qualquer dispositivo.
      </p>
      <div className="space-y-3">
        <button
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-70 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          {busy ? 'Conectando…' : 'Continuar com Google'}
        </button>
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 mb-1">Ou receba um link por email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="flex-1 rounded border px-3 py-2 text-sm"
              disabled={busy}
            />
            <button
              onClick={handleSendMagicLink}
              disabled={busy || !email}
              className="whitespace-nowrap bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-semibold px-3 py-2 rounded"
            >
              Enviar link
            </button>
          </div>
        </div>
        {error && (
          <div className="text-xs text-red-600">
            {error}{' '}
            {error.includes('tela de login') && (
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="underline text-blue-600 ml-1"
              >
                Ir para login
              </button>
            )}
          </div>
        )}
        {info && (
          <div className="text-xs text-green-600">{info}</div>
        )}
      </div>
    </div>
  );
};
