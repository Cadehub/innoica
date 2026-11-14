'use client';

import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  Smartphone,
  Sparkles,
  BookOpen,
  CreditCard,
  ShieldAlert,
  Building2,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

interface DashboardShellProps {
  children: React.ReactNode;
  profile: {
    full_name?: string | null;
    email?: string | null;
    is_super_admin?: boolean;
  } | null;
  userEmail: string;
  currentWorkspace: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export function DashboardShell({
  children,
  profile,
  userEmail,
  currentWorkspace,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: "Vue d'ensemble", icon: LayoutDashboard },
    { href: '/agents', label: 'Mes Agents', icon: Bot },
    { href: '/conversations', label: 'Conversations & Inbox', icon: MessageSquare },
    { href: '/whatsapp', label: 'Connexions WhatsApp', icon: Smartphone },
    { href: '/ai-credentials', label: 'Intelligence IA (BYOK)', icon: Sparkles },
    { href: '/knowledge', label: 'Base de Connaissances', icon: BookOpen },
    { href: '/subscription', label: 'Abonnement & Quotas', icon: CreditCard },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* --- Mobile Top Header (Visible only on < lg) --- */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-xs">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 block leading-tight">INNOICA</span>
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block">
              WhatsApp Agents
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* --- Mobile Slide-over Drawer Backdrop --- */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={closeMobileMenu}
        />
      )}

      {/* --- Navigation Drawer / Sidebar --- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-64 border-r border-slate-200 bg-white flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:z-30 lg:min-h-screen lg:shrink-0`}
      >
        <div>
          {/* Logo & Workspace header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between lg:block">
            <Link href="/dashboard" onClick={closeMobileMenu} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight text-slate-900">INNOICA</div>
                <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
                  WhatsApp Agents
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={closeMobileMenu}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {currentWorkspace && (
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 border border-slate-100 text-xs text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold truncate">{currentWorkspace.name}</span>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.includes(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-blue-600'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Super Admin section */}
            {profile?.is_super_admin && (
              <div className="pt-3 mt-3 border-t border-slate-100">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-purple-600">
                  Administration
                </div>
                <Link
                  href="/admin"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors min-h-[44px]"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Panel Super Admin</span>
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* User Footer Profile & Sign Out */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {profile?.full_name || 'Utilisateur'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{userEmail}</div>
              </div>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Déconnexion"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* --- Main Content Area --- */}
      <main className="flex-1 w-full min-h-screen">
        <div className="px-3 py-4 sm:px-6 sm:py-6 lg:p-8 max-w-7xl mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
