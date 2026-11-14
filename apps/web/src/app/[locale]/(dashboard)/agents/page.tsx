import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/routing';
import {
  Bot,
  Plus,
  Smartphone,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Pause,
  Play,
} from 'lucide-react';

export default async function AgentsListPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user?.id)
    .single();

  const workspaceId = membership?.workspace_id;

  // Récupérer les agents avec leur connexion WhatsApp
  const { data: agents } = await supabase
    .from('agents')
    .select('*, whatsapp_connections(phone_number, status, pairing_code), agent_templates(name_fr, slug)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Actif & Opérationnel
          </span>
        );
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 border border-blue-100">
            WhatsApp Connecté
          </span>
        );
      case 'pending_connection':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-100">
            En attente de connexion
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            Suspendu
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 border border-red-100">
            Erreur de configuration
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            Brouillon
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Mes Agents WhatsApp
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Gérez et supervisez vos agents d'intelligence artificielle connectés à WhatsApp.
          </p>
        </div>

        <Link
          href="/agents/new"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Nouvel Agent</span>
        </Link>
      </div>

      {/* Agents Grid or Empty State */}
      {!agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
            <Bot className="h-7 w-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Aucun agent configuré</h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Créez votre premier agent spécialisé (Accueil, Ventes, Support) et associez-le à votre numéro WhatsApp par Pairing Code.
          </p>
          <Link
            href="/agents/new"
            className="mt-6 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Créer un agent maintenant</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent: any) => {
            const waConn = agent.whatsapp_connections;
            return (
              <div
                key={agent.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold">
                        <Bot className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                          {agent.name}
                        </h3>
                        <div className="text-[11px] font-medium text-slate-400">
                          {agent.agent_templates?.name_fr || 'Agent Personnalisé'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">{getStatusBadge(agent.status)}</div>

                  <p className="mt-3 text-xs text-slate-600 line-clamp-2">
                    {agent.description || agent.system_prompt}
                  </p>

                  <div className="mt-5 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                        <span>WhatsApp :</span>
                      </span>
                      <span className="font-semibold text-slate-800">
                        {waConn?.phone_number || 'Non connecté'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                        <span>Modèle IA :</span>
                      </span>
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                        {agent.ai_model.split('/').pop()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <span>Configurer l'agent</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    {agent.primary_language === 'fr' ? '🇫🇷 Français' : '🇬🇧 Anglais'}
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
