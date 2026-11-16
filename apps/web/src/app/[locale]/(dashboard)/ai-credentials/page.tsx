import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { AICredentialsClient } from './credentials-client';

export default async function AICredentialsPage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const { data: credentials } = await supabase
    .from('ai_credentials')
    .select('id, workspace_id, provider, label, key_hint, is_valid, last_tested_at, created_at')
    .eq('workspace_id', ctx.workspace.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Clés API & Fournisseurs IA (BYOK)
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Enregistrez vos clés API personnelles (Gemini, Groq, OpenRouter, OpenAI). Elles sont chiffrées côté serveur en AES-256-GCM.
        </p>
      </div>

      <AICredentialsClient
        initialCredentials={credentials || []}
        workspaceId={ctx.workspace.id}
      />
    </div>
  );
}
