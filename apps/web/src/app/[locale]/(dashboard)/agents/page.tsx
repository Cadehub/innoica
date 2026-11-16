import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { Link } from '@/i18n/routing';
import {
  Bot,
  Plus,
  Smartphone,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-react';

export default async function AgentsListPage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const { data: agents } = await supabase
    .from('agents')
    .select('*, whatsapp_connections(phone_number, status, pairing_code), agent_templates(name_fr, slug)')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false });

  const maxAgents = ctx.quota?.maxAgents ?? 1;
  const planSlug = ctx.quota?.planSlug || 'free';
  const reachedLimit = (agents?.length || 0) >= maxAgents;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 border border-emerald-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Actif & Opérationnel
          </span>
        );
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-800 border border-zinc-200">
            WhatsApp Connecté
          </span>
        );
      case 'pending_connection':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 border border-amber-200">
            En attente de connexion
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 border border-zinc-200">
            En pause
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500 border border-zinc-200">
            Brouillon
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              Mes Agents WhatsApp
            </h1>
            <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-mono font-medium tabular-nums text-zinc-700">
              {agents?.length || 0} / {maxAgents} ({planSlug === 'starter' ? 'Starter' : 'Free'})
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            Créez, configurez et supervisez vos agents IA autonomes connectés par Pairing Code.
          </p>
        </div>

        {reachedLimit ? (
          <Link
            href="/subscription"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Passer à Starter (2 agents max)</span>
          </Link>
        ) : (
          <Link
            href="/agents/new"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nouvel Agent</span>
          </Link>
        )}
      </div>

      {!agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white p-12 text-center shadow-2xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 mb-3">
            <Bot className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900">Aucun agent configuré</h3>
          <p className="mt-1 max-w-sm text-xs text-zinc-500">
            Créez votre premier agent spécialisé (Accueil, Ventes, Support) et associez-le à votre numéro WhatsApp.
          </p>
          <Link
            href="/agents/new"
            className="mt-5 flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Créer un agent maintenant</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => {
            const waConn = Array.isArray(agent.whatsapp_connections)
              ? agent.whatsapp_connections[0]
              : agent.whatsapp_connections;
            return (
              <div
                key={agent.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs hover:border-zinc-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-800">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 truncate">
                          {agent.name}
                        </h3>
                        <div className="text-[11px] font-medium text-zinc-400 truncate">
                          {agent.agent_templates?.name_fr || 'Agent Personnalisé'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5">{getStatusBadge(agent.status)}</div>

                  <p className="mt-2.5 text-xs text-zinc-600 line-clamp-2">
                    {agent.description || agent.system_prompt}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-zinc-400" />
                        <span>WhatsApp :</span>
                      </span>
                      <span className="font-mono text-zinc-800 text-[11px] tabular-nums">
                        {waConn?.phone_number || 'Non connecté'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Modèle IA :</span>
                      </span>
                      <span className="font-mono text-zinc-800 text-[11px] truncate max-w-[160px]">
                        {String(agent.ai_model || '').split('/').pop()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex items-center gap-1.5 text-xs font-medium text-zinc-900 hover:text-zinc-700 transition-colors"
                  >
                    <span>Configurer l'agent</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <span className="text-[10px] text-zinc-400 uppercase font-mono">
                    {agent.primary_language === 'fr' ? 'Français' : 'English'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
