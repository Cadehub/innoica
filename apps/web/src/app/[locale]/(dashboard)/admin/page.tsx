import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { redirect } from '@/i18n/routing';
import { AdminConsoleClient } from './admin-client';

export default async function SuperAdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);

  if (!ctx || !ctx.profile.is_super_admin) {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  let speechHealth: Record<string, any> | null = null;
  try {
    const speechRes = await fetch(`${process.env.SPEECH_WORKER_URL || 'http://localhost:4004'}/health`, {
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    });
    if (speechRes.ok) {
      speechHealth = await speechRes.json();
    }
  } catch {
    speechHealth = null;
  }

  const [plansRes, declarationsRes, workspacesRes, agentsRes, settingsRes, logsRes, statsRes, voiceJobsRes] =
    await Promise.all([
      supabase.from('plans').select('*').in('slug', ['free', 'starter']).order('sort_order'),
      supabase
        .from('payment_declarations')
        .select('*, workspaces(name, slug), plans(slug, name_fr)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('workspaces')
        .select('id, name, slug, status, plan_id, created_at, plans(slug, name_fr)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('agents')
        .select('id, name, workspace_id, status, ai_provider, ai_model, created_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('platform_settings').select('*').eq('id', 'default').maybeSingle(),
      supabase
        .from('execution_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase
        .from('voice_processing_jobs')
        .select('id, workspace_id, status, detected_language, quality_category, comprehension_status, duration_seconds, processing_ms, error_code, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

  return (
    <AdminConsoleClient
      initialPlans={plansRes.data || []}
      initialDeclarations={declarationsRes.data || []}
      initialWorkspaces={workspacesRes.data || []}
      initialAgents={agentsRes.data || []}
      initialSettings={settingsRes.data || null}
      initialLogs={logsRes.data || []}
      initialVoiceJobs={voiceJobsRes.data || []}
      speechWorkerHealth={speechHealth}
      totalUsers={statsRes.count || 0}
    />
  );
}
