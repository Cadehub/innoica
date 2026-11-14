import { createClient } from '@/lib/supabase/server';
import { WhatsAppPageClient } from './whatsapp-client';

export default async function WhatsAppConnectionsPage() {
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

  // Récupérer tous les agents avec leurs connexions WhatsApp
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, status, whatsapp_connections(*)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Connexions WhatsApp (Pairing Code)
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Gérez l'association de vos numéros WhatsApp par code temporaire à 8 caractères. Aucun QR code requis.
        </p>
      </div>

      <WhatsAppPageClient agents={agents || []} />
    </div>
  );
}
