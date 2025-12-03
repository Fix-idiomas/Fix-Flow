// src/components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Menu, X, Home, Users, Trophy, ListChecks, Store, BarChart3, Pin, PinOff, BookOpen, Shield, MessageSquare,
} from "lucide-react";
import { Timer } from "lucide-react";
import { AccountLinker } from "./auth/AccountLinker";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";


type Item = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
};

const NAV: Item[] = [
  { href: "/", label: "Início", Icon: Home },
  { href: "/curso", label: "Cursos", Icon: BookOpen },
  { href: "/leaderboard", label: "Leaderboard", Icon: BarChart3 },
  { href: "/comunidade", label: "Comunidade", Icon: Users },
  { href: "/tarefas", label: "Tarefas", Icon: ListChecks },
  { href: "/conquistas", label: "Conquistas", Icon: Trophy },
  { href: "/loja", label: "Loja", Icon: Store },
  { href: "/estudo", label: "Estudo", Icon: Timer },
  { href: "/feedback", label: "Feedback", Icon: MessageSquare },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // All hooks must be called unconditionally
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<unknown | null>(null);
  const [openMobile, setOpenMobile] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminChecked, setAdminChecked] = useState(false);

  // Render only content for /login, but hooks are always called
  const isLogin = pathname === "/login";

  async function handleLogout() {
    try {
      await signOut(auth);
      // Redireciono é feito pelo onAuthStateChanged quando user fica null
    } catch (e) {
      console.error("Erro ao sair:", e);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setIsAdmin(false);
        setAdminChecked(true);
        router.replace("/login");
        return;
      }
      // fetch admin status
      try {
        const token = await u.getIdToken(true).catch(() => undefined);
        const res = await fetch('/api/admin/is-admin', {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'x-firebase-uid': u.uid,
          },
          cache: 'no-store'
        });
        if (res.ok) {
          const j = await res.json();
          setIsAdmin(Boolean(j?.isAdmin));
        } else {
          setIsAdmin(false);
        }
      } catch {
        setIsAdmin(false);
      } finally {
        setAdminChecked(true);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    const v = localStorage.getItem("sidebarPinned");
    if (v === "1") setPinned(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebarPinned", pinned ? "1" : "0");
  }, [pinned]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // classes principais
  const asideBase =
    "fixed inset-y-0 left-0 z-50 border-r bg-white transition-[transform,width] duration-200";
  // no desktop:
  // - se pinned => md:w-64
  // - se rail   => md:w-16 e expande para md:w-64 no hover, sem mover o conteúdo
  const asideDesktopWidth = pinned
    ? "md:w-64"
    : "md:w-16 md:hover:w-64";

  // mobile slide
  const asideSlide =
    openMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0";

  // padding do conteúdo: fixo para rail (md:pl-16) e para pinned (md:pl-64)
  const mainPadDesktop = pinned ? "md:pl-64" : "md:pl-16";

  // Render logic
  if (isLogin) {
    return <div className="min-h-screen bg-slate-50 text-slate-800">{children}</div>;
  }
  if (!authReady) {
    return <div className="min-h-screen bg-gray-50" />;
  }
  if (!user) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800">
      {/* Topbar (mobile) */}
      <header className="flex items-center gap-3 border-b bg-white px-3 py-2 md:hidden">
        <button
          aria-label="Abrir menu"
          onClick={() => setOpenMobile(true)}
          className="rounded-md p-2 hover:bg-slate-100"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-600 font-bold text-white">
            fx
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">fix idiomas</div>
            <div className="text-[11px] text-slate-500">Sua jornada de estudos</div>
          </div>
        </div>
      </header>

{/* Topbar (desktop) */}
      <header className="hidden md:flex items-center justify-end border-b bg-white px-4 h-14">
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <div className="text-sm font-semibold">Fix Flow - Sua jornada de estudos</div>
          </div>
          <Link
            href="/perfil"
            aria-label="Perfil"
            title="Perfil"
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <span className="hidden lg:inline text-slate-700">Perfil</span>
            <div className="h-6 w-6 rounded-full bg-slate-200" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-gray-50"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Overlay (mobile) */}
      {openMobile && (
        <button
          aria-label="Fechar menu"
          onClick={() => setOpenMobile(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {/* Sidebar (rail no desktop; expande no hover) */}
      <aside
        className={`${asideBase} ${asideDesktopWidth} ${asideSlide} group flex flex-col`}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-2 border-b px-3 py-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-600 font-bold text-white">
              fx
            </div>
            {/* Título: escondido no rail e aparece ao hover; fixo quando pinned */}
            <div
              className={[
                "leading-tight transition-opacity duration-150",
                pinned
                  ? "opacity-100"
                  : "hidden md:block md:opacity-0 md:group-hover:opacity-100",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">fix idiomas</div>
              <div className="text-[11px] text-slate-500">Sua jornada de estudos</div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center gap-1">
            {/* fechar (mobile) */}
            <button
              aria-label="Fechar menu"
              onClick={() => setOpenMobile(false)}
              className="rounded-md p-2 hover:bg-slate-100 md:hidden"
            >
              <X size={18} />
            </button>

            {/* pin/unpin (desktop) */}
            <button
              aria-label={pinned ? "Desafixar menu" : "Fixar menu"}
              onClick={() => setPinned((v) => !v)}
              className="hidden rounded-md p-2 hover:bg-slate-100 md:inline-flex"
              title={pinned ? "Desafixar" : "Fixar"}
            >
              {pinned ? <Pin size={18} /> : <PinOff size={18} />}
            </button>
          </div>
        </div>

        {/* Navegação */}
        <nav className="px-2 py-3" role="navigation" aria-label="Navegação principal">
          <ul className="space-y-1">
            {NAV.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpenMobile(false)}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={[
                    "group/link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                  isActive(href)
                ? "bg-slate-900 text-white shadow-sm"
                 : "text-slate-700 hover:bg-slate-100"
                ].join(" ")}
                  title={!pinned ? label : undefined} // tooltip nativo quando em rail
                >
                  <Icon
                    size={18}
                    className={
                      isActive(href) ? "text-white" : "text-slate-500 group-hover/link:text-slate-800"
                    }
                  />
                  {/* Rótulo:
                      - se pinned: sempre visível
                      - se rail: escondido, aparece ao passar o mouse na sidebar (group-hover) */}
                  <span
                    className={[
                      "truncate transition-opacity duration-150",
                      pinned
                        ? "opacity-100"
                        : "hidden md:inline md:opacity-0 md:group-hover:opacity-100",
                    ].join(" ")}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            ))}
            {adminChecked && isAdmin && (
              <li>
                <Link
                  href="/admin"
                  onClick={() => setOpenMobile(false)}
                  aria-current={isActive('/admin') ? 'page' : undefined}
                  className={[
                    'group/link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                    isActive('/admin') ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                  ].join(' ')}
                  title={!pinned ? 'Admin' : undefined}
                >
                  <Shield size={18} className={isActive('/admin') ? 'text-white' : 'text-slate-500 group-hover/link:text-slate-800'} />
                  <span
                    className={[
                      'truncate transition-opacity duration-150',
                      pinned ? 'opacity-100' : 'hidden md:inline md:opacity-0 md:group-hover:opacity-100'
                    ].join(' ')}
                  >
                    Admin
                  </span>
                </Link>
              </li>
            )}
            {adminChecked && isAdmin && (
              <li>
                <Link
                  href="/admin/editorial"
                  onClick={() => setOpenMobile(false)}
                  aria-current={isActive('/admin/editorial') ? 'page' : undefined}
                  className={[
                    'group/link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                    isActive('/admin/editorial') ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                  ].join(' ')}
                  title={!pinned ? 'Editorial' : undefined}
                >
                  <ListChecks size={18} className={isActive('/admin/editorial') ? 'text-white' : 'text-slate-500 group-hover/link:text-slate-800'} />
                  <span
                    className={[
                      'truncate transition-opacity duration-150',
                      pinned ? 'opacity-100' : 'hidden md:inline md:opacity-0 md:group-hover:opacity-100'
                    ].join(' ')}
                  >
                    Editorial
                  </span>
                </Link>
              </li>
            )}
            {adminChecked && isAdmin && (
              <li>
                <Link
                  href="/prof/activities"
                  onClick={() => setOpenMobile(false)}
                  aria-current={isActive('/prof/activities') ? 'page' : undefined}
                  className={[
                    'group/link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                    isActive('/prof/activities') ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                  ].join(' ')}
                  title={!pinned ? 'Professor' : undefined}
                >
                  <Users size={18} className={isActive('/prof/activities') ? 'text-white' : 'text-slate-500 group-hover/link:text-slate-800'} />
                  <span
                    className={[
                      'truncate transition-opacity duration-150',
                      pinned ? 'opacity-100' : 'hidden md:inline md:opacity-0 md:group-hover:opacity-100'
                    ].join(' ')}
                  >
                    Professor
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </nav>

        {/* Account promotion for anonymous users */}
        <div className="mt-auto px-2 pb-3">
          <AccountLinker />
        </div>
      </aside>

      {/* Conteúdo — compensa a largura do rail (16) ou expandido (64) */}
      <main className={`${mainPadDesktop} px-4 py-4`}>{children}</main>
    </div>
  );
}
