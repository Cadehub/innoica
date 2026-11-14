import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { AgentConfigClient } from './config-client';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Récupérer l'agent avec sa connexion WhatsApp et son template
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*, whatsapp_connections(*), agent_templates(*)')
    .eq('id', id)
    .single();

  if (error || !agent) {
    notFound();
  }

  // Récupérer les clés BYOK du workspace
  const { data: credentials } = await supabase
    .from('ai_credentials')
    .select('id, provider, label, key_hint')
    .eq('workspace_id', agent.workspace_id);

  // Récupérer les sources de connaissances de cet agent
  const { data: knowledgeSources } = await supabase
    .from('agent_knowledge_sources')
    .select('*, agent_knowledge_chunks(count)')
    .eq('agent_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <AgentConfigClient
        agent={agent}
        credentials={credentials || []}
        knowledgeSources={knowledgeSources || []}
      />
    </div>
  );
}
