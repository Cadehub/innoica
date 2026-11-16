import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { WhatsAppPageClient } from './whatsapp-client';

export default async function WhatsAppConnectionsPage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, status, whatsapp_connections(*)')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Connexions WhatsApp (Pairing Code)
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Associez jusqu'à {ctx.quota?.maxConnections ?? 1} numéro(s) sur votre offre{' '}
          {ctx.quota?.planSlug === 'starter' ? 'Starter' : 'Free'} par code à 8 caractères. Aucun QR code requis.
        </p>
      </div>

      <WhatsAppPageClient
        agents={agents || []}
        maxConnections={ctx.quota?.maxConnections ?? 1}
        planSlug={ctx.quota?.planSlug || 'free'}
      />
    </div>
  );
}
