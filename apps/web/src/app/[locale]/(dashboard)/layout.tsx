import { redirect } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/routing';
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  Smartphone,
  Sparkles,
  BookOpen,
  CreditCard,
  ShieldAlert,
  LogOut,
  Building2,
} from 'lucide-react';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }

  // Récupérer le profil et vérifier si Super Admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, is_super_admin')
    .eq('id', user.id)
    .single();

  // Récupérer le premier workspace de l'utilisateur
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces (id, name, slug)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const currentWorkspace = membership?.workspaces as any;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white flex flex-col justify-between">
        <div>
          {/* Logo & Workspace */}
          <div className="p-5 border-b border-slate-100">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-bold tracking-tight text-slate-900">
                  INNOICA
                </div>
                <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
                  WhatsApp Agents
                </div>
              </div>
            </Link>

            {currentWorkspace && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-slate-100 text-xs text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium truncate">{currentWorkspace.name}</span>
              </div>
            )}
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Vue d'ensemble</span>
            </Link>

            <Link
              href="/agents"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <Bot className="h-4 w-4" />
              <span>Mes Agents</span>
            </Link>

            <Link
              href="/conversations"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Conversations & Inbox</span>
            </Link>

            <Link
              href="/whatsapp"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <Smartphone className="h-4 w-4" />
              <span>Connexions WhatsApp</span>
            </Link>

            <Link
              href="/ai-credentials"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              <span>Intelligence IA (BYOK)</span>
            </Link>

            <Link
              href="/knowledge"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              <span>Base de Connaissances</span>
            </Link>

            <Link
              href="/subscription"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              <span>Abonnement & Quotas</span>
            </Link>

            {profile?.is_super_admin && (
              <div className="pt-3 mt-3 border-t border-slate-100">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-purple-600">
                  Administration
                </div>
                <Link
                  href="/admin"
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Panel Super Admin</span>
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* User Footer */}
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
                <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
              </div>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                title="Déconnexion"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex-1 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
