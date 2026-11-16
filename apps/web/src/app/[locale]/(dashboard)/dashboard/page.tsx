import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { DashboardOverviewClient } from './dashboard-overview-client';

export default async function DashboardOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const workspaceId = ctx.workspace.id;
  const quota = ctx.quota;

  const { data: wsAgents } = await supabase
    .from('agents')
    .select('id, name, status')
    .eq('workspace_id', workspaceId);

  const agentIds = (wsAgents || []).map((a: any) => a.id);

  const [waConnectionsRes, conversationsRes, messagesRes, errorsRes] = await Promise.all([
    supabase
      .from('whatsapp_connections')
      .select('id, phone_number, status, agent_id')
      .eq('workspace_id', workspaceId),
    agentIds.length > 0
      ? supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .in('agent_id', agentIds)
      : Promise.resolve({ count: 0 }),
    agentIds.length > 0
      ? supabase
          .from('execution_logs')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('level', 'info')
          .eq('event_type', 'ai_reply_sent')
      : Promise.resolve({ count: 0 }),
    supabase
      .from('execution_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('level', ['error', 'warn'])
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <DashboardOverviewClient
      workspaceId={workspaceId}
      initialAgents={wsAgents || []}
      initialConnections={waConnectionsRes.data || []}
      initialTotalConversations={conversationsRes.count || 0}
      initialAiRepliesTotal={messagesRes.count || 0}
      initialRecentAlerts={errorsRes.data || []}
      quota={quota}
      locale={locale === 'en' ? 'en' : 'fr'}
    />
  );
}
