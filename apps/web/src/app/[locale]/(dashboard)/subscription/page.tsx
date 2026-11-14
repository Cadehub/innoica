import { createClient } from '@/lib/supabase/server';
import { Check, CreditCard, Sparkles, ShieldCheck } from 'lucide-react';
import { formatPriceXaf } from '@/lib/utils';

export default async function SubscriptionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(plan_id, plans(*))')
    .eq('user_id', user?.id)
    .single();

  const currentPlan = (membership?.workspaces as any)?.plans;

  // Récupérer tous les forfaits actifs
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly_xaf', { ascending: true });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Forfaits & Abonnements INNOICA
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Tarification claire et transparente en Francs CFA (XAF) pour les entreprises et les particuliers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const isCurrent = currentPlan?.slug === plan.slug;

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-6 flex flex-col justify-between transition-all ${
                isCurrent
                  ? 'border-blue-600 bg-white ring-2 ring-blue-600 shadow-lg shadow-blue-500/10'
                  : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {plan.name_fr}
                  </span>
                  {isCurrent && (
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                      Actuel
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {formatPriceXaf(plan.price_monthly_xaf)}
                  </span>
                  <span className="text-xs text-slate-400">/ mois</span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  {plan.description_fr}
                </p>

                <div className="mt-6 border-t border-slate-100 pt-4 space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Jusqu'à <strong>{plan.max_agents} Agent{plan.max_agents > 1 ? 's' : ''} IA</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                    <span><strong>{plan.max_connections} Compte{plan.max_connections > 1 ? 's' : ''} WhatsApp</strong> (Pairing Code)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                    <span><strong>{plan.max_knowledge_docs} Sources</strong> de connaissances (FAQ, PDF, Web)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Intégration <strong>BYOK</strong> (OpenRouter, Groq, Gemini, OpenAI)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Double Contrôle <strong>Human Takeover</strong></span>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-500 cursor-not-allowed"
                  >
                    Votre formule actuelle
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                  >
                    Sélectionner ce forfait
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
