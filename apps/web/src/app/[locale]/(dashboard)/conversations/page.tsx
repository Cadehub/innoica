import { getAfricaDoualaDateString } from '@innoica/shared';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { InboxClient } from './inbox-client';

export default async function ConversationsPage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const todayDouala = getAfricaDoualaDateString();

  const [{ data: conversations }, { data: reservations }] = await Promise.all([
    supabase
      .from('conversations')
      .select('*, contacts(*), agents!inner(id, name, workspace_id, status)')
      .eq('agents.workspace_id', ctx.workspace.id)
      .order('last_message_at', { ascending: false })
      .limit(100),
    supabase
      .from('quota_reply_reservations')
      .select('conversation_id')
      .eq('workspace_id', ctx.workspace.id)
      .eq('period_date', todayDouala)
      .eq('status', 'confirmed'),
  ]);

  const replyCountsByConv: Record<string, number> = {};
  for (const r of reservations || []) {
    if (r.conversation_id) {
      replyCountsByConv[r.conversation_id] = (replyCountsByConv[r.conversation_id] || 0) + 1;
    }
  }

  return (
    <InboxClient
      initialConversations={conversations || []}
      initialReplyCounts={replyCountsByConv}
      planSlug={ctx.quota?.planSlug || 'free'}
      maxRepliesPerConv={ctx.quota?.maxDailyBotRepliesPerConv ?? null}
      maxNewConvs={ctx.quota?.maxDailyNewConversations ?? null}
      usedNewConvs={ctx.quota?.dailyNewConversationsUsed ?? 0}
    />
  );
}
