import { createClient } from '@/lib/supabase/server';
import { AICredentialsClient } from './credentials-client';

export default async function AICredentialsPage() {
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

  const { data: credentials } = await supabase
    .from('ai_credentials')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Intelligence Artificielle & Fournisseurs (BYOK)
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Enregistrez vos clés API personnelles (OpenRouter, Groq, Gemini, OpenAI). Elles sont chiffrées côté serveur avec AES-256-GCM et jamais exposées en clair.
        </p>
      </div>

      <AICredentialsClient
        initialCredentials={credentials || []}
        workspaceId={workspaceId}
      />
    </div>
  );
}
