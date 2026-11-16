import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { KnowledgeClient } from './knowledge-client';

export default async function KnowledgePage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const [{ data: agents }, { data: sources }] = await Promise.all([
    supabase
      .from('agents')
      .select('id, name')
      .eq('workspace_id', ctx.workspace.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('agent_knowledge_sources')
      .select('*, agents!inner(id, name, workspace_id), agent_knowledge_chunks(count)')
      .eq('agents.workspace_id', ctx.workspace.id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Base de Connaissances des Agents
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Alimentez vos agents avec vos FAQ, textes, PDF et pages web publiques (protection SSRF active).
        </p>
      </div>

      <KnowledgeClient
        agents={agents || []}
        initialSources={sources || []}
        planSlug={ctx.quota?.planSlug || 'free'}
        allowedTypes={ctx.quota?.allowedKnowledgeTypes || ['faq', 'txt']}
        maxDocs={ctx.quota?.maxKnowledgeDocs ?? 3}
      />
    </div>
  );
}
