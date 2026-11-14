import { createClient } from '@/lib/supabase/server';
import { BookOpen, ExternalLink, FileText, HelpCircle, CheckCircle2 } from 'lucide-react';

export default async function KnowledgePage() {
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

  // Récupérer toutes les sources de connaissances rattachées aux agents du workspace
  const { data: sources } = await supabase
    .from('agent_knowledge_sources')
    .select('*, agents!inner(id, name, workspace_id), agent_knowledge_chunks(count)')
    .eq('agents.workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Base de Connaissances des Agents
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Documents, FAQ et pages web indexés pour enrichir les réponses de vos agents en contexte réel.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">
          Documents & Sources Indexées ({sources?.length || 0})
        </h2>

        {!sources || sources.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Aucune source de connaissances enregistrée pour l'instant. Rendez-vous dans la configuration d'un agent pour ajouter vos FAQ ou scanner une page web.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sources.map((src: any) => (
              <div key={src.id} className="py-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    {src.source_type === 'faq' ? (
                      <HelpCircle className="h-4 w-4" />
                    ) : src.source_type === 'url' ? (
                      <ExternalLink className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{src.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Agent : <span className="font-semibold text-slate-700">{src.agents?.name}</span> • Type :{' '}
                      <span className="uppercase font-semibold">{src.source_type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="h-3 w-3" />
                      Indexé & Prêt
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {src.agent_knowledge_chunks?.[0]?.count || 1} fragment{src.agent_knowledge_chunks?.[0]?.count > 1 ? 's' : ''} RAG
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
