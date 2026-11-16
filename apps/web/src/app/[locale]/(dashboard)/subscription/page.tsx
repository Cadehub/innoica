import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceContext } from '@/lib/workspace';
import { SubscriptionPlansClient } from './subscription-client';

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const ctx = await getActiveWorkspaceContext(supabase);
  if (!ctx) return null;

  const [{ data: plans }, { data: declarations }] = await Promise.all([
    supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .in('slug', ['free', 'starter'])
      .order('sort_order', { ascending: true }),
    supabase
      .from('payment_declarations')
      .select('*')
      .eq('workspace_id', ctx.workspace.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Offres & Abonnement Innoica Agent Studio
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Tarification transparente en FCFA (XAF) — choisissez Free pour démarrer ou Starter pour débloquer votre croissance.
        </p>
      </div>

      <SubscriptionPlansClient
        plans={plans || []}
        currentPlanSlug={ctx.quota?.planSlug || 'free'}
        quota={ctx.quota}
        initialDeclarations={declarations || []}
      />
    </div>
  );
}
