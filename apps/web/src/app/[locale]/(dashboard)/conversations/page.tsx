import { createClient } from '@/lib/supabase/server';
import { InboxClient } from './inbox-client';

export default async function ConversationsPage() {
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

  // Récupérer les conversations avec contacts et agents
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*, contacts(*), agents!inner(id, name, workspace_id)')
    .eq('agents.workspace_id', workspaceId)
    .order('last_message_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Boîte de Réception & Contrôle Humain
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Supervisez les échanges WhatsApp en direct et reprenez la main manuellement à tout moment (Human Takeover).
        </p>
      </div>

      <InboxClient initialConversations={conversations || []} />
    </div>
  );
}
