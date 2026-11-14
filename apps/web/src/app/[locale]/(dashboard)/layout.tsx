import { redirect } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from './dashboard-shell';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect({ href: '/login', locale });
    return null;
  }

  // Récupérer le profil et vérifier si Super Admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, is_super_admin')
    .eq('id', user.id)
    .single();

  // Récupérer le premier workspace de l'utilisateur
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces (id, name, slug)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const currentWorkspace = membership?.workspaces as any;

  return (
    <DashboardShell
      profile={profile}
      userEmail={user.email || ''}
      currentWorkspace={currentWorkspace}
    >
      {children}
    </DashboardShell>
  );
}
