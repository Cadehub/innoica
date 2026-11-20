import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { redirect } from '@/i18n/routing';
import { AutomationsClient } from './automations-client';

export default async function AutomationsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    redirect({ href: '/login', locale });
    return null;
  }

  // 1. Récupérer les workflows existants
  const { data: workflows } = await supabase
    .from('workflow_definitions')
    .select('*, agent:agents(id, name)')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false });

  // 2. Récupérer les approbations en attente
  const { data: approvals } = await supabase
    .from('workflow_approvals')
    .select('*, execution:workflow_executions(workflow_id, trigger_event)')
    .eq('workspace_id', ctx.workspace.id)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  // 3. Récupérer les agents disponibles pour assignation
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, status')
    .eq('workspace_id', ctx.workspace.id);

  // 4. Récupérer les exécutions récentes
  const { data: recentExecutions } = await supabase
    .from('workflow_executions')
    .select('*, workflow:workflow_definitions(name, domain)')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false })
    .limit(25);

  return (
    <AutomationsClient
      workspaceId={ctx.workspace.id}
      initialWorkflows={workflows || []}
      initialApprovals={approvals || []}
      initialExecutions={recentExecutions || []}
      agents={agents || []}
      locale={locale === 'en' ? 'en' : 'fr'}
    />
  );
}
