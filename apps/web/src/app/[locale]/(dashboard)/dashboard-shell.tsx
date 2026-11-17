'use client';

import { useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
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
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  ShoppingBag,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { PWAInstaller } from '@/components/pwa-installer';
import { PlanSlug } from '@innoica/shared';
import { isStoreModuleEnabled } from '@/lib/feature-flags';

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
    status?: string;
  } | null;
  planSlug?: PlanSlug;
  locale?: 'fr' | 'en';
}

export function DashboardShell({
  children,
  profile,
  userEmail,
  currentWorkspace,
  planSlug = 'free',
  locale = 'fr',
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isInboxRoute = pathname.includes('/conversations');

  const navItems = [
    { href: '/dashboard', label: locale === 'en' ? 'Overview' : "Vue d'ensemble", icon: LayoutDashboard },
    { href: '/agents', label: locale === 'en' ? 'Agents' : 'Mes Agents', icon: Bot },
    { href: '/conversations', label: 'Inbox WhatsApp', icon: MessageSquare },
    { href: '/whatsapp', label: locale === 'en' ? 'WhatsApp Links' : 'Connexions WA', icon: Smartphone },
    ...(isStoreModuleEnabled
      ? [{ href: '/store', label: locale === 'en' ? 'My Store' : 'Ma boutique', icon: ShoppingBag }]
      : []),
    { href: '/knowledge', label: locale === 'en' ? 'Knowledge' : 'Connaissances', icon: BookOpen },
    { href: '/ai-credentials', label: locale === 'en' ? 'AI Keys (BYOK)' : 'Clés IA (BYOK)', icon: Sparkles },
    { href: '/subscription', label: locale === 'en' ? 'Plan & Quotas' : 'Abonnement', icon: CreditCard },
    { href: '/settings', label: locale === 'en' ? 'Settings' : 'Paramètres', icon: Settings },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const switchLocale = () => {
    const nextLocale = locale === 'fr' ? 'en' : 'fr';
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#fafafb] flex flex-col lg:flex-row antialiased">
      {/* Mobile Header */}
      <header className="lg:hidden shrink-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200/80 bg-white px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 shrink-0">
          <BrandLogo size="sm" />
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium uppercase tabular-nums shrink-0 ${
              planSlug === 'starter'
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
            }`}
          >
            {planSlug}
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-900/30 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 border-r border-zinc-200/80 bg-white flex flex-col justify-between transition-all duration-200 ease-in-out overflow-hidden lg:static lg:z-30 lg:h-full lg:shrink-0 ${
          sidebarCollapsed ? 'lg:w-16 w-64' : 'w-64 lg:w-60'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div
            className={`border-b border-zinc-100 flex shrink-0 ${
              sidebarCollapsed
                ? 'lg:flex-col lg:items-center lg:justify-center lg:gap-2 lg:py-3 lg:px-2 p-3.5 items-center justify-between'
                : 'p-3.5 items-center justify-between gap-2'
            }`}
          >
            <Link
              href="/dashboard"
              onClick={closeMobileMenu}
              className="shrink-0 flex items-center justify-center min-w-0"
            >
              <BrandLogo compact={sidebarCollapsed} size={sidebarCollapsed ? 'sm' : 'md'} />
            </Link>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={
                sidebarCollapsed
                  ? locale === 'en'
                    ? 'Expand sidebar'
                    : 'Déplier la barre latérale'
                  : locale === 'en'
                  ? 'Collapse sidebar'
                  : 'Réduire la barre latérale'
              }
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer shrink-0 transition-colors"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              onClick={closeMobileMenu}
              className="lg:hidden p-1.5 rounded-md text-zinc-400 hover:bg-zinc-100 shrink-0"
              aria-label="Fermer le menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {currentWorkspace && !sidebarCollapsed && (
            <div className="px-3 pt-2.5 pb-1 shrink-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 border border-zinc-200/70 text-xs text-zinc-700">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span className="font-medium truncate">{currentWorkspace.name}</span>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.2 text-[9px] font-mono font-medium uppercase tabular-nums ${
                    planSlug === 'starter'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white text-zinc-600 border border-zinc-200'
                  }`}
                >
                  {planSlug}
                </span>
              </div>
            </div>
          )}

          <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto overflow-x-hidden studio-scroll">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard' || pathname === '/fr/dashboard' || pathname === '/en/dashboard'
                  : pathname.includes(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center rounded-lg text-xs transition-colors min-h-[36px] ${
                    sidebarCollapsed
                      ? 'lg:justify-center lg:px-0 lg:w-full px-2.5 py-2 gap-2.5'
                      : 'px-2.5 py-2 gap-2.5'
                  } ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-900 font-medium'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-zinc-900' : 'text-zinc-400'
                    }`}
                  />
                  {!sidebarCollapsed && <span className="truncate min-w-0">{item.label}</span>}
                </Link>
              );
            })}

            {profile?.is_super_admin && (
              <div className="pt-2 mt-2 border-t border-zinc-100">
                {!sidebarCollapsed && (
                  <div className="px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400 truncate">
                    Administration
                  </div>
                )}
                <Link
                  href="/admin"
                  onClick={closeMobileMenu}
                  title="Panel Super Admin"
                  className={`flex items-center rounded-lg text-xs transition-colors min-h-[36px] ${
                    sidebarCollapsed
                      ? 'lg:justify-center lg:px-0 lg:w-full px-2.5 py-2 gap-2.5'
                      : 'px-2.5 py-2 gap-2.5'
                  } ${
                    pathname.includes('/admin')
                      ? 'bg-zinc-900 text-white font-medium'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`}
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 text-zinc-400" />
                  {!sidebarCollapsed && <span className="truncate min-w-0">Super Admin</span>}
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* Footer */}
        <div
          className={`border-t border-slate-100 shrink-0 space-y-2 overflow-hidden ${
            sidebarCollapsed ? 'lg:p-2 lg:flex lg:flex-col lg:items-center p-3' : 'p-3'
          }`}
        >
          <button
            type="button"
            onClick={switchLocale}
            title={
              sidebarCollapsed
                ? locale === 'fr'
                  ? 'Passer en anglais'
                  : 'Switch to English'
                : undefined
            }
            className={`flex items-center rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors ${
              sidebarCollapsed
                ? 'lg:h-8 lg:w-8 lg:justify-center lg:p-0 w-full px-3 py-1.5 justify-between'
                : 'w-full px-3 py-1.5 justify-between gap-2'
            }`}
          >
            <span className="flex items-center gap-1.5 shrink-0">
              <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {!sidebarCollapsed && <span className="truncate whitespace-nowrap">{locale === 'fr' ? 'Français' : 'English'}</span>}
            </span>
            {!sidebarCollapsed && (
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-600 border border-slate-200 uppercase shrink-0">
                {locale === 'fr' ? 'EN' : 'FR'}
              </span>
            )}
          </button>

          {!sidebarCollapsed && (
            <div className="flex items-center justify-center gap-2.5 text-[10px] text-zinc-400 py-1 border-y border-zinc-100 my-1 font-medium">
              <Link href="/privacy" className="hover:text-zinc-700 transition-colors">
                {locale === 'en' ? 'Privacy' : 'Confidentialité'}
              </Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-zinc-700 transition-colors">
                {locale === 'en' ? 'Terms' : 'CGU'}
              </Link>
              <span>•</span>
              <Link href="/legal" className="hover:text-zinc-700 transition-colors">
                {locale === 'en' ? 'Legal' : 'Légal'}
              </Link>
            </div>
          )}

          <div
            className={`flex items-center gap-2 ${
              sidebarCollapsed
                ? 'lg:flex-col lg:justify-center lg:items-center w-full justify-between'
                : 'w-full justify-between'
            }`}
          >
            <div className={`flex items-center gap-2.5 min-w-0 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 overflow-hidden">
                  <div className="text-xs font-semibold text-slate-900 truncate whitespace-nowrap">
                    {profile?.full_name || 'Utilisateur'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate whitespace-nowrap">{userEmail}</div>
                </div>
              )}
            </div>

            <form
              action="/auth/signout"
              method="post"
              className={sidebarCollapsed ? 'lg:w-full lg:flex lg:justify-center' : 'shrink-0'}
            >
              <button
                type="submit"
                title={locale === 'en' ? 'Sign out' : 'Déconnexion'}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer flex items-center justify-center shrink-0 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area: Inbox takes 100% height with internal column scroll; other views scroll internally */}
      <main
        className={`flex-1 min-w-0 min-h-0 flex flex-col ${
          isInboxRoute ? 'overflow-hidden' : 'overflow-y-auto studio-scroll'
        }`}
      >
        {isInboxRoute ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
        ) : (
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8 max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto w-full">
            {children}
          </div>
        )}
      </main>

      {/* PWA Smart Installation Prompt for Authenticated Users (iOS Safari & Android/Desktop) */}
      <PWAInstaller />
    </div>
  );
}
