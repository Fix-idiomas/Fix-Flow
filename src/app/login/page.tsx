"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [variant, setVariant] = useState<"login" | "signup">("login");
  const [showPass, setShowPass] = useState(false);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passInputRef = useRef<HTMLInputElement | null>(null);

  const actionUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/auth/complete-link`;
  }, []);

  useEffect(() => {
    // foco automático no primeiro campo do painel ativo
    if (mode === "password") {
      (emailInputRef.current ?? undefined)?.focus?.();
    } else if (mode === "magic") {
      (emailInputRef.current ?? undefined)?.focus?.();
    }
  }, [mode]);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const provider = new GoogleAuthProvider();
      const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 640;
      if (isSmallScreen) {
        await signInWithRedirect(auth, provider);
        return;
      } else {
        await signInWithPopup(auth, provider);
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch("/api/auth/promote", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
      }

      router.push("/");
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/popup-closed-by-user") {
        setError("Janela fechada antes de concluir o login.");
      } else if (code === "auth/cancelled-popup-request") {
        setError("Já existe uma janela de login aberta. Tente novamente.");
      } else {
        setError(e?.message || "Não foi possível entrar com Google.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailPassword() {
    setError(null);
    setInfo(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Digite seu email.");
      return;
    }
    if (variant === "signup" && password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      setBusy(true);
      if (variant === "login") {
        await signInWithEmailAndPassword(auth, trimmed, password);
      } else {
        await createUserWithEmailAndPassword(auth, trimmed, password);
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        await fetch("/api/auth/promote", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
      }
      router.push("/");
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/invalid-email") setError("Email inválido.");
      else if (code === "auth/user-not-found") setError("Usuário não encontrado.");
      else if (code === "auth/wrong-password") setError("Senha incorreta.");
      else if (code === "auth/email-already-in-use") setError("Email já cadastrado.");
      else if (code === "auth/too-many-requests") setError("Muitas tentativas. Tente mais tarde.");
      else setError(e?.message || "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    setError(null);
    setInfo(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Digite um email para receber o link.");
      return;
    }

    if (!actionUrl) {
      setError("Ambiente ainda está carregando, tente novamente em instantes.");
      return;
    }

    try {
      setBusy(true);

      await sendSignInLinkToEmail(auth, trimmed, {
        url: actionUrl,
        handleCodeInApp: true,
      });

      if (typeof window !== "undefined") {
        window.localStorage.setItem("fx_magic_email", trimmed);
      }

      setInfo("Enviamos um link de acesso para o seu email.");
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/invalid-email") {
        setError("Email inválido. Confira o endereço informado.");
      } else {
        setError(e?.message || "Não foi possível enviar o link. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    setError(null);
    setInfo(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Digite seu email para redefinir a senha.");
      return;
    }

    try {
      setBusy(true);
      await sendPasswordResetEmail(auth, trimmed);
      setInfo("Enviamos instruções de redefinição para o seu email.");
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/invalid-email") setError("Email inválido.");
      else if (code === "auth/user-not-found") setError("Não há conta para este email.");
      else setError(e?.message || "Não foi possível enviar o email de redefinição.");
    } finally {
      setBusy(false);
    }
  }

  function handleContinueAnonymous() {
    router.push("/");
  }

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-800 overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 py-10 relative">
        {/* Hero */}
        <header className="mb-10 max-w-2xl relative">
          <div className="mb-4 flex items-center gap-3">
            <Image
              src="/Logo_Oficial.png"
              alt="Logo oficial Fix Idiomas"
              width={60}
              height={60}
              priority
              className="h-15 w-15 rounded-md object-contain"
            />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                <span className="font-bold">FIX FLOW</span>
              </h1>
              <p className="text-sm font-medium text-slate-500 -mt-1">Um sistema de estudo</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Aqui você vai ter a experiência de buscar alcançar uma rotina prática de seus estudos de inglês. Você receberá seus exercícios e feedbacks de forma dirigida e personalizada.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_380px]">
          {/* Highlights */}
          <section className="relative py-8 flex items-center justify-center">
            {/* Background logo dedicated to highlight cards */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/Logo_Oficial.png"
                alt="Logo de fundo seção destaques"
                width={900}
                height={900}
                priority
                className="pointer-events-none select-none max-w-none object-contain scale-110"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 relative z-10">
              <div className="rounded-xl border bg-white/90 backdrop-blur-sm p-4 shadow-sm relative z-10">
              <div className="text-sm font-semibold">Atividade do dia</div>
              <p className="mt-1 text-sm text-slate-600">Pratique todo dia com foco e clareza.</p>
            </div>
              <div className="rounded-xl border bg-white/90 backdrop-blur-sm p-4 shadow-sm relative z-10">
              <div className="text-sm font-semibold">Feedback personalizado</div>
              <p className="mt-1 text-sm text-slate-600">Correções e dicas sob medida.</p>
            </div>
              <div className="rounded-xl border bg-white/90 backdrop-blur-sm p-4 shadow-sm relative z-10">
              <div className="text-sm font-semibold">Gamificação e ranking</div>
              <p className="mt-1 text-sm text-slate-600">Pontos, conquistas e motivação contínua.</p>
            </div>
              <div className="rounded-xl border bg-white/90 backdrop-blur-sm p-4 shadow-sm relative z-10">
              <div className="text-sm font-semibold">Progresso sincronizado</div>
              <p className="mt-1 text-sm text-slate-600">Continue no celular ou no computador.</p>
            </div>
              {/* Avatar fundador / presença pessoal */}
              <div className="rounded-xl border bg-white/90 backdrop-blur-sm p-4 shadow-sm sm:col-span-2 flex items-center gap-4 relative z-10">
              <Image
                src="/Avatar-Bruno.png"
                alt="Avatar do fundador Bruno"
                width={56}
                height={56}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-200"
              />
              <div className="text-sm">
                <div className="font-semibold">Acompanhamento humano</div>
                <p className="mt-1 text-slate-600">Guidance pedagógica e curadoria feita por pessoas — tecnologia para potencializar, não substituir.</p>
              </div>
            </div>
            </div>
          </section>

          {/* Painel de autenticação */}
          <aside className="rounded-2xl border bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="w-full rounded-md bg-[var(--brand)] text-white py-2.5 text-sm font-medium hover:bg-[var(--brand-hover)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand)]"
            >
              {busy ? "Conectando…" : "Continuar com Google"}
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
              <div className="h-px flex-1 bg-gray-200" />
              <span>ou</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Tabs */}
            <div role="tablist" aria-label="Métodos de entrada" className="mb-3 grid grid-cols-2 gap-2">
              <button
                role="tab"
                aria-selected={mode === "password"}
                className={[
                  "rounded-md px-3 py-2 text-sm font-medium",
                  mode === "password" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700",
                ].join(" ")}
                onClick={() => setMode("password")}
              >
                Email e senha
              </button>
              <button
                role="tab"
                aria-selected={mode === "magic"}
                className={[
                  "rounded-md px-3 py-2 text-sm font-medium",
                  mode === "magic" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700",
                ].join(" ")}
                onClick={() => setMode("magic")}
              >
                Link mágico
              </button>
            </div>

            {/* Panel: Email/Senha */}
            {mode === "password" && (
              <div role="tabpanel" aria-label="Email e senha" className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-gray-700">Email</label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-gray-700">Senha</label>
                  <div className="relative">
                    <input
                      ref={passInputRef}
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      {showPass ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="inline-flex items-center gap-2">
                    <input
                      id="signupToggle"
                      type="checkbox"
                      checked={variant === "signup"}
                      onChange={(e) => setVariant(e.target.checked ? "signup" : "login")}
                    />
                    <label htmlFor="signupToggle" className="text-slate-700 select-none">
                      Criar nova conta
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="text-slate-600 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleEmailPassword}
                  disabled={busy}
                  className="mt-2 w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {variant === "login" ? (busy ? "Entrando…" : "Entrar") : busy ? "Criando…" : "Criar conta"}
                </button>
              </div>
            )}

            {/* Panel: Link mágico */}
            {mode === "magic" && (
              <div role="tabpanel" aria-label="Link mágico" className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-xs font-medium text-gray-700">Email</label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={busy}
                  className="w-full rounded-md border border-blue-600 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-60"
                >
                  {busy ? "Enviando…" : "Enviar link mágico"}
                </button>
                <p className="text-[11px] text-slate-500">Abra o link neste mesmo dispositivo.</p>
              </div>
            )}

            {error && <p className="mt-4 text-xs text-red-600" role="status" aria-live="polite">{error}</p>}
            {info && !error && <p className="mt-4 text-xs text-emerald-600" role="status" aria-live="polite">{info}</p>}

            <div className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-500">
              <p className="mb-3">
                Você pode continuar explorando o Fix Flow sem criar cadastro agora e
                decidir salvar seu progresso mais tarde.
              </p>
              <button
                type="button"
                onClick={handleContinueAnonymous}
                className="w-full rounded-md border border-gray-300 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Acessar sem cadastro agora
              </button>
            </div>
          </aside>
        </div>

        <footer className="mt-10 text-[11px] text-slate-400">v0.1 – Fix Flow</footer>
      </div>
    </div>
  );
}
