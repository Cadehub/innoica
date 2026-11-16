import { redirect } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
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
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx) {
    redirect({ href: '/login', locale });
    return null;
  }

  return (
    <DashboardShell
      profile={ctx.profile}
      userEmail={ctx.user.email}
      currentWorkspace={ctx.workspace}
      planSlug={ctx.quota?.planSlug || 'free'}
      locale={locale === 'en' ? 'en' : 'fr'}
    >
      {children}
    </DashboardShell>
  );
}
