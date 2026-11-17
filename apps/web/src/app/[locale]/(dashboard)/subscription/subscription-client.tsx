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
  ShoppingBag,
  XCircle,
  Zap,
} from 'lucide-react';
import { PlanSlug, WorkspaceQuotaSnapshot } from '@innoica/shared';
import { AutoGrowTextarea } from '@/components/auto-grow-textarea';
import { formatPriceXaf } from '@/lib/utils';
import { isStoreModuleEnabled } from '@/lib/feature-flags';

export function SubscriptionPlansClient({
  plans,
  currentPlanSlug,
  quota,
  initialDeclarations,
}: {
  plans: any[];
  currentPlanSlug: PlanSlug;
  quota: WorkspaceQuotaSnapshot | null;
  initialDeclarations: any[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<'agent' | 'commerce' | 'starter'>('agent');
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
  const agentPlan = plans.find((p) => p.slug === 'agent');
  const commercePlan = plans.find((p) => p.slug === 'commerce');
  const starterPlan = plans.find((p) => p.slug === 'starter');

  const agentMonthly = Number(agentPlan?.price_monthly_xaf ?? 3500);
  const agentYearly = Number(agentPlan?.price_yearly_xaf ?? 37800);
  const agentAnnualFull = agentMonthly * 12;
  const agentAnnualSavings = Math.max(0, agentAnnualFull - agentYearly);

  const commerceMonthly = Number(commercePlan?.price_monthly_xaf ?? 6500);
  const commerceYearly = Number(commercePlan?.price_yearly_xaf ?? 70200);
  const commerceAnnualFull = commerceMonthly * 12;
  const commerceAnnualSavings = Math.max(0, commerceAnnualFull - commerceYearly);

  const starterMonthly = Number(starterPlan?.price_monthly_xaf ?? 5000);
  const starterYearly = Number(starterPlan?.price_yearly_xaf ?? 54000);

  const currentSelectedPrice = useMemo(() => {
    if (selectedPlanSlug === 'commerce') {
      return billingCycle === 'yearly' ? commerceYearly : commerceMonthly;
    }
    if (selectedPlanSlug === 'starter') {
      return billingCycle === 'yearly' ? starterYearly : starterMonthly;
    }
    return billingCycle === 'yearly' ? agentYearly : agentMonthly;
  }, [selectedPlanSlug, billingCycle, commerceYearly, commerceMonthly, starterYearly, starterMonthly, agentYearly, agentMonthly]);

  const selectedPlanName = useMemo(() => {
    if (selectedPlanSlug === 'commerce') return 'INNOICA Commerce';
    if (selectedPlanSlug === 'starter') return 'Starter (Grandfathered)';
    return 'INNOICA Agent';
  }, [selectedPlanSlug]);

  const handleOpenModal = (planSlug: 'agent' | 'commerce' | 'starter') => {
    setSelectedPlanSlug(planSlug);
    setShowPaymentModal(true);
  };

  const handleSubmitDeclaration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/subscription/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: selectedPlanSlug,
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

      {/* Commercial Plans Grid (Free, Agent, and optional Commerce) */}
      <div className={`grid grid-cols-1 ${isStoreModuleEnabled ? 'md:grid-cols-3' : 'md:grid-cols-2 max-w-4xl'} gap-4`}>
        {/* Plan FREE */}
        <div
          className={`rounded-xl border p-5 sm:p-6 flex flex-col justify-between bg-white transition-colors ${
            currentPlanSlug === 'free'
              ? 'border-zinc-900 shadow-2xs ring-1 ring-zinc-900'
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
                'Découvrez Innoica Agent Studio avec 1 agent WhatsApp et quota journalier gratuit.'}
            </p>

            <div className="mt-5 border-t border-zinc-100 pt-4 space-y-2 text-xs text-zinc-700">
              {(freePlan?.features || [
                '1 Agent WhatsApp',
                '1 Numéro WhatsApp',
                '5 nouvelles conversations / jour',
                '10 réponses du bot / conversation / jour',
                'BYOK + Connaissances FAQ & TXT',
                'Historique 7 jours',
                'Messages texte uniquement',
                'Signature INNOICA sur chaque réponse',
              ]).map((feat: string) => (
                <div key={feat} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-zinc-900 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="w-full rounded-lg bg-zinc-50 border border-zinc-200/80 py-2.5 text-center text-xs font-mono tabular-nums text-zinc-600">
              {currentPlanSlug === 'free'
                ? `Quota du jour : ${quota?.dailyNewConversationsUsed ?? 0} / ${
                    quota?.maxDailyNewConversations ?? 5
                  } conv.`
                : 'Offre gratuite'}
            </div>
          </div>
        </div>

        {/* Plan INNOICA AGENT (3 500 FCFA) */}
        <div
          className={`rounded-xl border p-5 sm:p-6 flex flex-col justify-between bg-white relative overflow-hidden transition-colors ${
            currentPlanSlug === 'agent'
              ? 'border-zinc-900 shadow-2xs ring-1 ring-zinc-900'
              : 'border-zinc-300 hover:border-zinc-400'
          }`}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-900 font-mono">
                <Zap className="h-3.5 w-3.5 text-blue-600" />
                INNOICA Agent
              </span>
              {currentPlanSlug === 'agent' ? (
                <span className="rounded-md bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 text-[10px] font-mono font-medium">
                  Plan actif
                </span>
              ) : (
                <span className="rounded-md bg-zinc-100 border border-zinc-200 text-zinc-700 px-2 py-0.5 text-[10px] font-mono font-medium">
                  Relation Client
                </span>
              )}
            </div>

            <div className="mt-3">
              {billingCycle === 'monthly' ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                    {formatPriceXaf(agentMonthly)}
                  </span>
                  <span className="text-xs text-zinc-500">/ mois</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                      {formatPriceXaf(agentYearly)}
                    </span>
                    <span className="text-xs text-zinc-500">/ an</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs">
                    <span className="line-through text-zinc-400 font-mono tabular-nums">
                      {formatPriceXaf(agentAnnualFull)}/an
                    </span>
                    <span className="font-semibold text-emerald-700 font-mono tabular-nums">
                      Économisez {formatPriceXaf(agentAnnualSavings)} (-10%)
                    </span>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-1.5 text-xs text-zinc-500">
              {agentPlan?.description_fr ||
                'Agent IA complet avec compréhension vocale, conversations illimitées et zéro signature.'}
            </p>

            <div className="mt-5 border-t border-zinc-100 pt-4 space-y-2 text-xs text-zinc-700">
              {(agentPlan?.features || [
                'Jusqu’à 2 Agents IA WhatsApp',
                'Jusqu’à 2 Numéros WhatsApp connectés',
                'Compréhension vocale FR/EN incluse sans frais',
                'Conversations quotidiennes sans quota INNOICA',
                'Réponses IA quotidiennes sans quota INNOICA',
                'Connaissances : FAQ, PDF, TXT & URLs',
                'Mémoire durable par contact & conversation',
                'Inbox temps réel & Human Takeover',
                'Sans signature publicitaire INNOICA',
              ]).map((feat: string) => (
                <div key={feat} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => handleOpenModal('agent')}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 px-4 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                {currentPlanSlug === 'agent'
                  ? 'Renouveler INNOICA Agent'
                  : `Activer INNOICA Agent (${
                      billingCycle === 'yearly' ? '37 800 FCFA/an' : '3 500 FCFA/mois'
                    })`}
              </span>
            </button>
          </div>
        </div>

        {/* Plan INNOICA COMMERCE (6 500 FCFA) - Visible only when store module is enabled */}
        {isStoreModuleEnabled && (
          <div
            className={`rounded-xl border-2 p-5 sm:p-6 flex flex-col justify-between bg-white relative overflow-hidden transition-colors ${
              currentPlanSlug === 'commerce'
                ? 'border-emerald-600 shadow-2xs ring-1 ring-emerald-600'
                : 'border-zinc-900 shadow-2xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 font-mono">
                  <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" />
                  INNOICA Commerce
                </span>
                {currentPlanSlug === 'commerce' ? (
                  <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-medium">
                    Plan actif
                  </span>
                ) : (
                  <span className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[10px] font-mono font-semibold">
                    Boutique + IA
                  </span>
                )}
              </div>

              <div className="mt-3">
                {billingCycle === 'monthly' ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                      {formatPriceXaf(commerceMonthly)}
                    </span>
                    <span className="text-xs text-zinc-500">/ mois</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-semibold font-mono tabular-nums text-zinc-900">
                        {formatPriceXaf(commerceYearly)}
                      </span>
                      <span className="text-xs text-zinc-500">/ an</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span className="line-through text-zinc-400 font-mono tabular-nums">
                        {formatPriceXaf(commerceAnnualFull)}/an
                      </span>
                      <span className="font-semibold text-emerald-700 font-mono tabular-nums">
                        Économisez {formatPriceXaf(commerceAnnualSavings)} (-10%)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <p className="mt-1.5 text-xs text-zinc-500">
                {commercePlan?.description_fr ||
                  'Tout INNOICA Agent + Moteur E-Commerce Natif, Storefront, Catalogue & Commandes Baileys.'}
              </p>

              <div className="mt-5 border-t border-zinc-100 pt-4 space-y-2 text-xs text-zinc-700">
                {(commercePlan?.features || [
                  'Tout le plan INNOICA Agent',
                  'Jusqu’à 3 Agents IA WhatsApp & 3 numéros connectés',
                  'Boutique en ligne native hébergée par INNOICA',
                  'Constructeur visuel sécurisé sans code',
                  'Catalogue produits, variantes & gestion des stocks',
                  'Paniers & commandes en temps réel',
                  'Paiements manuels (Livraison, Retrait, Mobile Money)',
                  'Synchronisation catalogue & commandes WhatsApp',
                ]).map((feat: string) => (
                  <div key={feat} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => handleOpenModal('commerce')}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 px-4 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer shadow-2xs"
              >
                <CreditCard className="h-4 w-4" />
                <span>
                  {currentPlanSlug === 'commerce'
                    ? 'Renouveler INNOICA Commerce'
                    : `Activer INNOICA Commerce (${
                        billingCycle === 'yearly' ? '70 200 FCFA/an' : '6 500 FCFA/mois'
                      })`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grandfathered Starter Card if applicable */}
      {currentPlanSlug === 'starter' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-amber-900 font-mono">
              <Zap className="h-4 w-4 text-amber-600" />
              Abonnement Actif : Starter (Grandfathered)
            </div>
            <p className="text-xs text-amber-800 mt-1">
              Vous bénéficiez de l’offre Starter historique à 5 000 FCFA/mois (54 000 FCFA/an). Vos conditions contractuelles restent intégralement préservées. Vous pouvez renouveler ou basculer sur INNOICA Commerce.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenModal('starter')}
            className="shrink-0 rounded-lg bg-amber-800 px-4 py-2 text-xs font-medium text-white hover:bg-amber-900 transition-colors cursor-pointer"
          >
            Renouveler Starter ({billingCycle === 'yearly' ? '54 000 FCFA/an' : '5 000 FCFA/mois'})
          </button>
        </div>
      )}

      {/* Payment Declaration Form Modal */}
      {showPaymentModal && (
        <form
          onSubmit={handleSubmitDeclaration}
          className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Déclarer un paiement {selectedPlanName} (
                {formatPriceXaf(currentSelectedPrice)} / {billingCycle === 'yearly' ? 'an' : 'mois'})
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Offre sélectionnée
              </label>
              <select
                value={selectedPlanSlug}
                onChange={(e) => setSelectedPlanSlug(e.target.value as any)}
                className="w-full rounded-lg border border-zinc-200 py-2 px-3 text-xs bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="agent">INNOICA Agent (3 500 FCFA/m)</option>
                <option value="commerce">INNOICA Commerce (6 500 FCFA/m)</option>
                {currentPlanSlug === 'starter' && (
                  <option value="starter">Starter Historique (5 000 FCFA/m)</option>
                )}
              </select>
            </div>

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
              <span>Soumettre la preuve ({formatPriceXaf(currentSelectedPrice)})</span>
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
            {declarations.map((dec) => {
              const planLabel =
                dec.plans?.name_fr ||
                (dec.plans?.slug === 'commerce'
                  ? 'INNOICA Commerce'
                  : dec.plans?.slug === 'agent'
                  ? 'INNOICA Agent'
                  : 'Abonnement');
              return (
                <div
                  key={dec.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-zinc-900">
                      {planLabel} ({dec.billing_cycle === 'yearly' ? 'Annuel' : 'Mensuel'}) —{' '}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
