import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/routing';
import {
  Bot,
  MessageSquare,
  Smartphone,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';

export default async function DashboardOverviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Récupérer le workspace de l'utilisateur
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces (id, name, plan_id, plans(name_fr, slug, price_monthly_xaf))')
    .eq('user_id', user?.id)
    .limit(1)
    .single();

  const workspaceId = membership?.workspace_id;
  const planInfo = (membership?.workspaces as any)?.plans;

  // 2. Compteurs réels en base de données
  const [agentsRes, activeAgentsRes, waConnectionsRes, conversationsRes, messagesRes, errorsRes] =
    await Promise.all([
      supabase.from('agents').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
      supabase.from('agents').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'active'),
      supabase.from('whatsapp_connections').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'connected'),
      supabase.from('conversations').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      supabase.from('execution_logs').select('*').eq('workspace_id', workspaceId).eq('level', 'error').order('created_at', { ascending: false }).limit(5),
    ]);

  const totalAgents = agentsRes.count || 0;
  const activeAgents = activeAgentsRes.count || 0;
  const connectedWa = waConnectionsRes.count || 0;
  const totalConversations = conversationsRes.count || 0;
  const totalMessages = messagesRes.count || 0;
  const recentErrors = errorsRes.data || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Vue d'ensemble
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Métriques et état opérationnel en temps réel de votre flotte d'agents IA WhatsApp.
        </p>
      </div>

      {/* Real Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Agents */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Agents Créés</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Bot className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {totalAgents}
          </div>
          <div className="mt-2 flex items-center text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            <span>{activeAgents} actuellement actif{activeAgents > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Connected WhatsApp Accounts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Numéros Connectés</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Smartphone className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {connectedWa}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Association par Pairing Code
          </div>
        </div>

        {/* Total Conversations */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Conversations</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {totalConversations}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Contacts clients engagés
          </div>
        </div>

        {/* Total Messages Handled */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Messages Traités</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {totalMessages}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Échanges entrants & sortants
          </div>
        </div>
      </div>

      {/* Quick Actions & Subscription Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launchpad */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Actions Rapides</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/agents/new"
              className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 transition-all group"
            >
              <div>
                <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center mb-3">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600">
                  Créer un Agent
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Démarrez avec un modèle préconfiguré (Accueil, Ventes, Support)
                </div>
              </div>
              <div className="mt-3 flex items-center text-[11px] font-semibold text-blue-600">
                <span>Créer</span>
                <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </Link>

            <Link
              href="/whatsapp"
              className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-emerald-50/50 hover:border-emerald-200 transition-all group"
            >
              <div>
                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center mb-3">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-600">
                  Connecter WhatsApp
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Générez un Pairing Code sécurisé sans aucun scan QR
                </div>
              </div>
              <div className="mt-3 flex items-center text-[11px] font-semibold text-emerald-600">
                <span>Appairer</span>
                <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </Link>

            <Link
              href="/conversations"
              className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-purple-50/50 hover:border-purple-200 transition-all group"
            >
              <div>
                <div className="h-8 w-8 rounded-lg bg-purple-600 text-white flex items-center justify-center mb-3">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="text-xs font-bold text-slate-900 group-hover:text-purple-600">
                  Boîte de Réception
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Supervisez les échanges et reprenez la main manuellement
                </div>
              </div>
              <div className="mt-3 flex items-center text-[11px] font-semibold text-purple-600">
                <span>Consulter</span>
                <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </Link>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Plan Actuel
              </span>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">
              {planInfo?.name_fr || 'Starter'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {planInfo?.price_monthly_xaf
                ? `${new Intl.NumberFormat('fr-FR').format(planInfo.price_monthly_xaf)} FCFA / mois`
                : 'Formule Active'}
            </div>
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Quota Agents :</span>
                <span className="font-semibold text-slate-900">{totalAgents} / 3</span>
              </div>
              <div className="flex justify-between">
                <span>Connexions actives :</span>
                <span className="font-semibold text-slate-900">{connectedWa} / 3</span>
              </div>
              <div className="flex justify-between">
                <span>Support BYOK :</span>
                <span className="font-semibold text-emerald-600">Inclus</span>
              </div>
            </div>
          </div>

          <Link
            href="/subscription"
            className="mt-6 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span>Gérer mon abonnement</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Recent Errors / Health Supervision */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">
              Journaux d'Exécution & Incidents Récents
            </h2>
          </div>
          <span className="text-xs text-slate-400">Derniers événements système</span>
        </div>

        {recentErrors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
            <div className="text-xs font-semibold text-slate-800">Aucune erreur récente</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Tous les services fonctionnent nominalement.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentErrors.map((err: any) => (
              <div key={err.id} className="py-3 flex items-start justify-between text-xs">
                <div>
                  <div className="font-semibold text-red-600">{err.event_type}</div>
                  <div className="text-slate-600 mt-0.5">{err.message}</div>
                </div>
                <div className="text-[10px] text-slate-400 whitespace-nowrap ml-4">
                  {new Date(err.created_at).toLocaleTimeString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
