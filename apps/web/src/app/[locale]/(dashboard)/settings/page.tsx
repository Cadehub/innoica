import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { SettingsClient } from './settings-client';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
          Paramètres du Studio
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Profil utilisateur, identité du workspace, langue et préférences de l'Inbox WhatsApp Web.
        </p>
      </div>

      <SettingsClient
        initialFullName={ctx.profile.full_name || ''}
        userEmail={ctx.user.email}
        initialWorkspaceName={ctx.workspace.name}
        workspaceSlug={ctx.workspace.slug}
        locale={locale === 'en' ? 'en' : 'fr'}
      />
    </div>
  );
}
