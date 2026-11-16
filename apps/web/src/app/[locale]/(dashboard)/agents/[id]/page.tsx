import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { notFound } from 'next/navigation';
import { AgentConfigClient } from './config-client';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const { data: agent, error } = await supabase
    .from('agents')
    .select('*, whatsapp_connections(*), agent_templates(*)')
    .eq('id', id)
    .eq('workspace_id', ctx.workspace.id)
    .single();

  if (error || !agent) {
    notFound();
  }

  const [{ data: credentials }, { data: knowledgeSources }, { data: agentConversations }] =
    await Promise.all([
      supabase
        .from('ai_credentials')
        .select('id, provider, label, key_hint, is_valid')
        .eq('workspace_id', ctx.workspace.id),
      supabase
        .from('agent_knowledge_sources')
        .select('*, agent_knowledge_chunks(count)')
        .eq('agent_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('conversations')
        .select('id, contact_id, contacts(id, phone_number, push_name, display_name)')
        .eq('agent_id', id)
        .order('last_message_at', { ascending: false })
        .limit(30),
    ]);

  const contactIds = Array.from(
    new Set((agentConversations || []).map((c: any) => c.contact_id).filter(Boolean))
  );

  const { data: contactMemories } =
    contactIds.length > 0
      ? await supabase
          .from('contact_memories')
          .select('*, contacts(phone_number, push_name, display_name)')
          .in('contact_id', contactIds)
          .order('updated_at', { ascending: false })
      : { data: [] };

  return (
    <div className="space-y-6">
      <AgentConfigClient
        agent={agent}
        credentials={credentials || []}
        knowledgeSources={knowledgeSources || []}
        initialMemories={contactMemories || []}
        planSlug={ctx.quota?.planSlug || 'free'}
        allowedKnowledgeTypes={ctx.quota?.allowedKnowledgeTypes || ['faq', 'txt']}
        maxKnowledgeDocs={ctx.quota?.maxKnowledgeDocs ?? 3}
      />
    </div>
  );
}
