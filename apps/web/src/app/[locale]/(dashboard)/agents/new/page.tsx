import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { AgentCreationForm } from './form-client';

export default async function NewAgentPage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const [{ data: templates }, { data: credentials }, { count: agentsCount }] = await Promise.all([
    supabase
      .from('agent_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('ai_credentials')
      .select('id, provider, label, key_hint')
      .eq('workspace_id', ctx.workspace.id),
    supabase
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspace.id),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Créer un Nouvel Agent WhatsApp
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Sélectionnez un modèle préconfiguré ou concevez un assistant sur mesure pour votre entreprise.
        </p>
      </div>

      <AgentCreationForm
        templates={templates || []}
        credentials={credentials || []}
        planSlug={ctx.quota?.planSlug || 'free'}
        maxAgents={ctx.quota?.maxAgents ?? 1}
        currentAgentsCount={agentsCount ?? 0}
      />
    </div>
  );
}
