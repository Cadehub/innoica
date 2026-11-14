import { createClient } from '@/lib/supabase/server';
import { redirect } from '@/i18n/routing';
import {
  ShieldAlert,
  Users,
  Building2,
  Bot,
  Smartphone,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { formatPriceXaf } from '@/lib/utils';

export default async function SuperAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Contrôle d'accès strict Super Admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user?.id)
    .single();

  if (!profile?.is_super_admin) {
    redirect({ href: '/dashboard', locale });
  }

  // 1. Métriques globales réelles de la plateforme
  const [usersRes, workspacesRes, agentsRes, waRes, logsRes, plansRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('workspaces').select('id, name, slug, created_at, owner_id'),
    supabase.from('agents').select('id', { count: 'exact', head: true }),
    supabase.from('whatsapp_connections').select('id, phone_number, status, last_connected_at'),
    supabase.from('execution_logs').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('plans').select('*').order('price_monthly_xaf', { ascending: true }),
  ]);

  const totalUsers = usersRes.count || 0;
  const workspaces = workspacesRes.data || [];
  const totalAgents = agentsRes.count || 0;
  const waConnections = waRes.data || [];
  const activeWaCount = waConnections.filter((w) => w.status === 'connected').length;
  const logs = logsRes.data || [];
  const plans = plansRes.data || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Panel Super Admin INNOICA
          </h1>
          <p className="mt-0.5 text-xs text-purple-700 font-semibold">
            Supervision globale, gestion multi-workspaces et audit système
          </p>
        </div>
      </div>

      {/* Global Platform Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Utilisateurs Inscrits</span>
            <Users className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{totalUsers}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Workspaces Clients</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{workspaces.length}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Agents Déployés</span>
            <Bot className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{totalAgents}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Sessions WhatsApp Actives</span>
            <Smartphone className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{activeWaCount}</div>
        </div>
      </div>

      {/* Workspaces List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">
          Workspaces Enregistrés ({workspaces.length})
        </h2>

        <div className="divide-y divide-slate-100">
          {workspaces.map((ws: any) => (
            <div key={ws.id} className="py-3 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-900">{ws.name}</div>
                <div className="text-[11px] text-slate-500 font-mono">Slug: {ws.slug}</div>
              </div>
              <div className="text-[11px] text-slate-400">
                Créé le {new Date(ws.created_at).toLocaleDateString('fr-FR')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plans & Quotas Configuration */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">
          Configuration des Plans & Quotas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <div className="flex items-center justify-between font-bold text-xs text-slate-900">
                <span>{p.name_fr}</span>
                <span className="text-purple-600">{formatPriceXaf(p.price_monthly_xaf)}/m</span>
              </div>
              <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                <div>Max Agents : <strong>{p.max_agents}</strong></div>
                <div>Max WhatsApp : <strong>{p.max_connections}</strong></div>
                <div>Max Documents : <strong>{p.max_knowledge_docs}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution Logs & Technical Audit */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>Journaux d'Exécution & Audit Technique</span>
        </h2>

        {logs.length === 0 ? (
          <div className="text-xs text-slate-400 py-4 text-center">
            Aucun journal d'erreur système enregistré.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 font-mono text-[11px]">
            {logs.map((log: any) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between">
                <div>
                  <span
                    className={`font-bold mr-2 uppercase ${
                      log.level === 'error' ? 'text-red-600' : 'text-blue-600'
                    }`}
                  >
                    [{log.level}]
                  </span>
                  <span className="font-semibold text-slate-800">{log.event_type}</span>
                  <div className="text-slate-600 mt-0.5">{log.message}</div>
                </div>
                <span className="text-[10px] text-slate-400 ml-4 shrink-0">
                  {new Date(log.created_at).toLocaleTimeString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
