'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import {
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  AlertCircle,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import { WorkspaceQuotaSnapshot } from '@innoica/shared';
import { AutoGrowTextarea } from '@/components/auto-grow-textarea';
import { formatPriceXaf } from '@/lib/utils';

export function SubscriptionPlansClient({
  plans,
  currentPlanSlug,
  quota,
  initialDeclarations,
}: {
  plans: any[];
  currentPlanSlug: 'free' | 'starter';
  quota: WorkspaceQuotaSnapshot | null;
  initialDeclarations: any[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState('Orange Money');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [declarations, setDeclarations] = useState<any[]>(initialDeclarations);

  useEffect(() => {
    const channel = supabase
      .channel('subscription-declarations-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_declarations' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setDeclarations((prev) => [payload.new, ...prev.filter((d) => d.id !== payload.new.id)]);
          } else if (payload.eventType === 'UPDATE') {
            setDeclarations((prev) =>
              prev.map((d) => (d.id === payload.new.id ? { ...d, ...payload.new } : d))
            );
            if (payload.new.status === 'approved') {
              router.refresh();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const freePlan = plans.find((p) => p.slug === 'free');
  const starterPlan = plans.find((p) => p.slug === 'starter');

  const starterMonthly = Number(starterPlan?.price_monthly_xaf ?? 5000);
  const starterYearly = Number(starterPlan?.price_yearly_xaf ?? 54000);
  const annualFullPrice = starterMonthly * 12;
  const annualSavings = Math.max(0, annualFullPrice - starterYearly);

  const handleSubmitDeclaration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/subscription/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingCycle,
          paymentMethod,
          reference,
          paidAt: paidAt || undefined,
          proofNote: proofNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la soumission');
      }

      setDeclarations((prev) => [data.declaration, ...prev]);
      setReference('');
      setProofNote('');
      setShowPaymentModal(false);
      setFeedback({
        type: 'success',
        text: 'Déclaration de paiement transmise. Notre équipe Super Admin la validera sous peu.',
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-2xl border p-4 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Cycle toggle */}
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors ${
              billingCycle === 'yearly'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span>Annuel</span>
            <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.2 text-[10px] font-semibold">
              -10%
            </span>
          </button>
        </div>
      </div>

      {/* Exact 2 Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Plan FREE */}
        <div
          className={`rounded-xl border p-5 sm:p-6 flex flex-col justify-between bg-white transition-colors ${
            currentPlanSlug === 'free'
              ? 'border-zinc-900 shadow-2xs'
              : 'border-zinc-200'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                Free
              </span>
              {currentPlanSlug === 'free' && (
                <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-mono font-medium text-zinc-800">
                  Plan actif
                </span>
              )}
            </div>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">0 FCFA</span>
              <span className="text-xs text-zinc-500">/ pour démarrer</span>
            </div>

            <p className="mt-1.5 text-xs text-zinc-500">
              {freePlan?.description_fr ||
                'Testez Innoica Agent Studio avec 1 agent WhatsApp et votre clé BYOK.'}
            </p>

            <div className="mt-5 border-t border-zinc-100 pt-4 space-y-2 text-xs text-zinc-700">
              {(freePlan?.features || [
                '1 Agent WhatsApp',
                '1 Numéro WhatsApp',
                '5 nouvelles conversations / jour',
                '10 réponses du bot / conversation / jour',
                'BYOK + Connaissances FAQ & TXT',
                'Historique 7 jours',
                'Messages texte uniquement (vocaux réservés aux plans payants)',
                'Signature INNOICA sur chaque réponse IA',
              ]).map((feat: string) => (
                <div key={feat} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-zinc-900 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
              {freePlan?.features && !freePlan.features.some((f: string) => /voc|voice/i.test(f)) && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Check className="h-4 w-4 text-zinc-300 shrink-0" />
                  <span>Messages texte uniquement (vocaux réservés aux plans payants)</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="w-full rounded-lg bg-zinc-50 border border-zinc-200/80 py-2.5 text-center text-xs font-mono tabular-nums text-zinc-600">
              {currentPlanSlug === 'free'
                ? `Quota du jour : ${quota?.dailyNewConversationsUsed ?? 0} / ${
                    quota?.maxDailyNewConversations ?? 5
                  } conv.`
                : 'Offre de base gratuite'}
            </div>
          </div>
        </div>

        {/* Plan STARTER */}
        <div
          className={`rounded-xl border p-5 sm:p-6 flex flex-col justify-between bg-white relative overflow-hidden transition-colors ${
            currentPlanSlug === 'starter'
              ? 'border-zinc-900 shadow-2xs ring-1 ring-zinc-900'
              : 'border-zinc-300 hover:border-zinc-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-900 font-mono">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
                Starter
              </span>
              {currentPlanSlug === 'starter' ? (
                <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-medium">
                  Plan actif
                </span>
              ) : (
                <span className="rounded-md bg-zinc-100 border border-zinc-200 text-zinc-700 px-2 py-0.5 text-[10px] font-mono font-medium">
                  Recommandé Entreprises
                </span>
              )}
            </div>

            <div className="mt-3">
              {billingCycle === 'monthly' ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                    {formatPriceXaf(starterMonthly)}
                  </span>
                  <span className="text-xs text-zinc-500">/ mois</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                      {formatPriceXaf(starterYearly)}
                    </span>
                    <span className="text-xs text-zinc-500">/ an</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className="line-through text-zinc-400 font-mono tabular-nums">
                      {formatPriceXaf(annualFullPrice)}/an
                    </span>
                    <span className="font-semibold text-emerald-700 font-mono tabular-nums">
                      Économisez {formatPriceXaf(annualSavings)} (-10%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-1.5 text-xs text-zinc-500">
              {starterPlan?.description_fr ||
                'Jusqu’à 2 agents, conversations et réponses illimitées côté INNOICA, PDF/URL et zéro signature.'}
            </p>

            <div className="mt-5 border-t border-zinc-100 pt-4 space-y-2 text-xs text-zinc-700">
              {(starterPlan?.features || [
                'Jusqu’à 2 Agents IA WhatsApp',
                'Jusqu’à 2 Numéros WhatsApp connectés',
                'Compréhension des messages vocaux (FR & EN) incluse sans frais',
                'Conversations quotidiennes illimitées côté INNOICA',
                'Réponses quotidiennes illimitées côté INNOICA',
                'FAQ, Import PDF, TXT et URL publique',
                'Mémoire durable contact & conversation',
                'Inbox complète, Human Takeover & historique étendu',
                'Aucune signature publicitaire INNOICA',
              ]).map((feat: string) => (
                <div key={feat} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
              {starterPlan?.features && !starterPlan.features.some((f: string) => /voc|voice/i.test(f)) && (
                <div className="flex items-center gap-2 font-medium text-emerald-800">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Compréhension des messages vocaux (FR & EN) incluse sans frais</span>
                </div>
              )}
            </div>

            <p className="mt-3 text-[11px] text-zinc-400">
              * « Illimité » signifie aucun quota quotidien imposé par INNOICA ; les limites techniques de WhatsApp et de votre fournisseur IA BYOK demeurent applicables.
            </p>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowPaymentModal((v) => !v)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 px-4 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                {currentPlanSlug === 'starter'
                  ? 'Renouveler Starter'
                  : `Activer Starter (${
                      billingCycle === 'yearly' ? '54 000 FCFA/an' : '5 000 FCFA/mois'
                    })`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment Declaration Form */}
      {showPaymentModal && (
        <form
          onSubmit={handleSubmitDeclaration}
          className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Déclarer un paiement Starter (
                {billingCycle === 'yearly' ? '54 000 FCFA / an' : '5 000 FCFA / mois'})
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Effectuez votre règlement Orange Money, MTN MoMo ou virement puis renseignez la référence pour activation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 cursor-pointer"
            >
              Fermer
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Moyen de paiement
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 py-2 px-3 text-xs bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="Orange Money">Orange Money Cameroun</option>
                <option value="MTN MoMo">MTN Mobile Money (MoMo)</option>
                <option value="Virement bancaire">Virement / Carte</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Référence transaction
              </label>
              <input
                type="text"
                required
                placeholder="Ex: MP261114.1045.A91827"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 py-2 px-3 text-xs text-zinc-900 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Date du paiement (optionnel)
              </label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 py-2 px-3 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Note / Numéro expéditeur (optionnel)
            </label>
            <AutoGrowTextarea
              minHeight={54}
              maxHeight={140}
              placeholder="Ex: Payé depuis +237 695..."
              value={proofNote}
              onChange={(e) => setProofNote(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !reference.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Soumettre la preuve de paiement</span>
            </button>
          </div>
        </form>
      )}

      {/* Payment Declarations History */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs">
        <h3 className="text-sm font-semibold text-zinc-900 mb-3">
          Historique de vos déclarations de paiement
        </h3>
        {declarations.length === 0 ? (
          <p className="text-xs text-zinc-400">Aucune déclaration soumise pour ce workspace.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {declarations.map((dec) => (
              <div
                key={dec.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-semibold text-zinc-900">
                    Starter ({dec.billing_cycle === 'yearly' ? 'Annuel' : 'Mensuel'}) —{' '}
                    <span className="font-mono tabular-nums">{formatPriceXaf(Number(dec.amount_xaf))}</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {dec.payment_method} • Réf : <span className="font-mono">{dec.reference}</span>
                  </div>
                  {dec.review_note && (
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      Note admin : {dec.review_note}
                    </div>
                  )}
                </div>
                <div>
                  {dec.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                      Validé
                    </span>
                  ) : dec.status === 'rejected' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 border border-red-200">
                      Rejeté
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                      En attente de revue
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
