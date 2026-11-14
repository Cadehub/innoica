import { createClient } from '@/lib/supabase/server';
import { AgentCreationForm } from './form-client';

export default async function NewAgentPage() {
  const supabase = await createClient();

  // Récupérer les templates disponibles
  const { data: templates } = await supabase
    .from('agent_templates')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  // Récupérer les clés BYOK disponibles dans le workspace
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user?.id)
    .single();

  const { data: credentials } = await supabase
    .from('ai_credentials')
    .select('id, provider, label, key_hint')
    .eq('workspace_id', membership?.workspace_id);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Créer un Nouvel Agent WhatsApp
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Sélectionnez un modèle préconfiguré ou concevez un agent sur mesure pour votre entreprise.
        </p>
      </div>

      <AgentCreationForm
        templates={templates || []}
        credentials={credentials || []}
        workspaceId={membership?.workspace_id}
      />
    </div>
  );
}
