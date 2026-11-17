'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Building2,
  Bot,
  Save,
  Sliders,
  AlertCircle,
  Clock,
  Users,
  Mic,
} from 'lucide-react';
import { formatPriceXaf } from '@/lib/utils';
import { AutoGrowTextarea } from '@/components/auto-grow-textarea';
import { PlanSlug } from '@innoica/shared';

export function AdminConsoleClient({
  initialPlans,
  initialDeclarations,
  initialWorkspaces,
  initialAgents,
  initialSettings,
  initialLogs,
  initialVoiceJobs = [],
  speechWorkerHealth = null,
  totalUsers,
}: {
  initialPlans: any[];
  initialDeclarations: any[];
  initialWorkspaces: any[];
  initialAgents: any[];
  initialSettings: any;
  initialLogs: any[];
  initialVoiceJobs?: any[];
  speechWorkerHealth?: Record<string, any> | null;
  totalUsers: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [plans, setPlans] = useState<any[]>(initialPlans);
  const [declarations, setDeclarations] = useState<any[]>(initialDeclarations);
  const [workspaces, setWorkspaces] = useState<any[]>(initialWorkspaces);
  const [agents, setAgents] = useState<any[]>(initialAgents);
  const [logs, setLogs] = useState<any[]>(initialLogs);

  useEffect(() => {
    const declChannel = supabase
      .channel('admin-declarations-sync')
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
          }
        }
      )
      .subscribe();

    const logsChannel = supabase
      .channel('admin-logs-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'execution_logs' },
        (payload: any) => {
          if (payload.new) {
            setLogs((prev) => [payload.new, ...prev.slice(0, 39)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(declChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [supabase]);

  const identity = initialSettings?.platform_identity || {};
  const [officialUrl, setOfficialUrl] = useState<string>(
    identity.official_url || 'https://agents.innoica.com'
  );
  const [watermarkFr, setWatermarkFr] = useState<string>(
    identity.free_watermark_fr ||
      'Propulsé par Innoica Agent Studio — Créez votre assistant WhatsApp IA sur {{url}}'
  );
  const [watermarkEn, setWatermarkEn] = useState<string>(
    identity.free_watermark_en ||
      'Powered by Innoica Agent Studio — Build your WhatsApp AI agent at {{url}}'
  );

  const [reviewNote, setReviewNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const callAdmin = async (payload: Record<string, any>, successMsg: string) => {
    setFeedback(null);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Action refusée');
    }
    setFeedback({ type: 'success', text: successMsg });
    router.refresh();
    return data;
  };

  const handleDecision = async (declarationId: string, decision: 'approved' | 'rejected') => {
    setBusyId(declarationId);
    try {
      await callAdmin(
        { action: 'review_payment', declarationId, decision, reviewNote: reviewNote || undefined },
        decision === 'approved'
          ? 'Paiement approuvé et plan Starter activé.'
          : 'Déclaration de paiement rejetée.'
      );
      setDeclarations((prev) =>
        prev.map((d) =>
          d.id === declarationId ? { ...d, status: decision, review_note: reviewNote || null } : d
        )
      );
      setReviewNote('');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleSavePlan = async (plan: any) => {
    setBusyId(plan.slug);
    try {
      const res = await callAdmin(
        {
          action: 'update_plan',
          plan: {
            slug: plan.slug,
            price_monthly_xaf: Number(plan.price_monthly_xaf),
            price_yearly_xaf: Number(plan.price_yearly_xaf),
            max_agents: Number(plan.max_agents),
            max_connections: Number(plan.max_connections),
            max_knowledge_docs: Number(plan.max_knowledge_docs),
            max_daily_new_conversations:
              plan.max_daily_new_conversations === '' || plan.max_daily_new_conversations == null
                ? null
                : Number(plan.max_daily_new_conversations),
            max_daily_bot_replies_per_conv:
              plan.max_daily_bot_replies_per_conv === '' ||
              plan.max_daily_bot_replies_per_conv == null
                ? null
                : Number(plan.max_daily_bot_replies_per_conv),
            history_retention_days:
              plan.history_retention_days === '' || plan.history_retention_days == null
                ? null
                : Number(plan.history_retention_days),
            has_watermark: Boolean(plan.has_watermark),
            capabilities: {
              ...(plan.capabilities || {}),
              voice_message_understanding: Boolean(plan.capabilities?.voice_message_understanding),
            },
          },
        },
        `Configuration du plan ${plan.slug.toUpperCase()} mise à jour.`
      );
      if (res.plan) {
        setPlans((prev) => prev.map((p) => (p.slug === plan.slug ? res.plan : p)));
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleSavePlatformSettings = async () => {
    setBusyId('settings');
    try {
      await callAdmin(
        {
          action: 'update_platform_settings',
          officialUrl,
          freeWatermarkFr: watermarkFr,
          freeWatermarkEn: watermarkEn,
        },
        'Domaine officiel et signature publicitaire Free mis à jour.'
      );
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleSetWorkspacePlan = async (workspaceId: string, planSlug: PlanSlug) => {
    setBusyId(workspaceId);
    try {
      await callAdmin(
        { action: 'set_workspace_plan', workspaceId, planSlug, billingCycle: 'monthly', durationDays: 30 },
        `Workspace basculé sur ${planSlug.toUpperCase()}.`
      );
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId ? { ...w, plans: { slug: planSlug, name_fr: planSlug } } : w
        )
      );
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleWorkspace = async (workspaceId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    setBusyId(workspaceId);
    try {
      await callAdmin(
        { action: 'toggle_workspace_status', workspaceId, status: nextStatus },
        `Workspace ${nextStatus === 'suspended' ? 'suspendu' : 'réactivé'}.`
      );
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? { ...w, status: nextStatus } : w))
      );
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = declarations.filter((d) => d.status === 'pending').length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-sm">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Administration Innoica Agent Studio
            </h1>
            <p className="text-xs text-violet-700 font-semibold">
              Validation paiements, plans Free/Starter, quotas, domaine officiel et sécurité
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-2xl p-4 text-xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Utilisateurs</span>
            <Users className="h-4 w-4 text-violet-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{totalUsers}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Workspaces</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{workspaces.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Agents</span>
            <Bot className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{agents.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Paiements en attente</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{pendingCount}</div>
        </div>
      </div>

      {/* Payment Declarations */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            Déclarations de paiements (Agent / Commerce / Starter)
          </h2>
          <input
            type="text"
            placeholder="Note de validation (optionnelle)..."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs sm:w-64"
          />
        </div>

        {declarations.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune déclaration enregistrée.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {declarations.map((dec) => (
              <div
                key={dec.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {dec.workspaces?.name || dec.workspace_id} — Starter ({dec.billing_cycle}) •{' '}
                    {formatPriceXaf(Number(dec.amount_xaf))}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {dec.payment_method} • Réf : <span className="font-mono">{dec.reference}</span>
                    {dec.proof_note ? ` • ${dec.proof_note}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {dec.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === dec.id}
                        onClick={() => handleDecision(dec.id, 'approved')}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
                      </button>
                      <button
                        type="button"
                        disabled={busyId === dec.id}
                        onClick={() => handleDecision(dec.id, 'rejected')}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Refuser
                      </button>
                    </>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-slate-600">
                      {dec.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plans Config */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Configuration centralisée des plans (Free, Agent, Commerce & Starter)
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.slug}
              className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase text-slate-900">{plan.slug}</span>
                <button
                  type="button"
                  disabled={busyId === plan.slug}
                  onClick={() => handleSavePlan(plan)}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" /> Enregistrer
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-600 block">Mensuel (FCFA)</label>
                  <input
                    type="number"
                    value={plan.price_monthly_xaf}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.slug === plan.slug ? { ...p, price_monthly_xaf: e.target.value } : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block">Annuel (FCFA)</label>
                  <input
                    type="number"
                    value={plan.price_yearly_xaf}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.slug === plan.slug ? { ...p, price_yearly_xaf: e.target.value } : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block">Max Agents</label>
                  <input
                    type="number"
                    value={plan.max_agents}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.slug === plan.slug ? { ...p, max_agents: e.target.value } : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block">Max Numéros WA</label>
                  <input
                    type="number"
                    value={plan.max_connections}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.slug === plan.slug ? { ...p, max_connections: e.target.value } : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block">
                    Nouv. conv / jour (vide = illimité)
                  </label>
                  <input
                    type="number"
                    value={plan.max_daily_new_conversations ?? ''}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.slug === plan.slug
                            ? { ...p, max_daily_new_conversations: e.target.value }
                            : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block">
                    Réponses / conv / jour (vide = illimité)
                  </label>
                  <input
                    type="number"
                    value={plan.max_daily_bot_replies_per_conv ?? ''}
                    onChange={(e) =>
                      setPlans((prev) =>
                        prev.map((p) =>
                          p.slug === plan.slug
                            ? { ...p, max_daily_bot_replies_per_conv: e.target.value }
                            : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(plan.has_watermark)}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.slug === plan.slug ? { ...p, has_watermark: e.target.checked } : p
                      )
                    )
                  }
                />
                <span>Signature publicitaire INNOICA active</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(
                    plan.capabilities?.voice_message_understanding ?? plan.slug !== 'free'
                  )}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.slug === plan.slug
                          ? {
                              ...p,
                              capabilities: {
                                ...(p.capabilities || {}),
                                voice_message_understanding: e.target.checked,
                              },
                            }
                          : p
                      )
                    )
                  }
                />
                <span>Compréhension vocale WhatsApp (`voice_message_understanding`)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(
                    plan.capabilities?.ecommerce_store ?? (plan.slug === 'commerce')
                  )}
                  onChange={(e) =>
                    setPlans((prev) =>
                      prev.map((p) =>
                        p.slug === plan.slug
                          ? {
                              ...p,
                              capabilities: {
                                ...(p.capabilities || {}),
                                ecommerce_store: e.target.checked,
                              },
                            }
                          : p
                      )
                    )
                  }
                />
                <span>Boutique & Moteur E-Commerce (`ecommerce_store`)</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Identity & Watermark Settings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">
            Domaine officiel & Signature publicitaire Free
          </h2>
          <button
            type="button"
            disabled={busyId === 'settings'}
            onClick={handleSavePlatformSettings}
            className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" /> Enregistrer
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block">URL officielle</label>
            <input
              type="url"
              value={officialUrl}
              onChange={(e) => setOfficialUrl(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block">Template FR</label>
            <AutoGrowTextarea
              minHeight={44}
              maxHeight={120}
              value={watermarkFr}
              onChange={(e) => setWatermarkFr(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-700 block">Template EN</label>
            <AutoGrowTextarea
              minHeight={44}
              maxHeight={120}
              value={watermarkEn}
              onChange={(e) => setWatermarkEn(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"
            />
          </div>
        </div>
      </div>

      {/* Workspaces management */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Workspaces & Attribution directe</h2>
        <div className="divide-y divide-slate-100">
          {workspaces.map((ws) => {
            const slug = ws.plans?.slug || 'free';
            return (
              <div
                key={ws.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {ws.name}{' '}
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase">
                      {slug}
                    </span>
                    {ws.status === 'suspended' && (
                      <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        Suspendu
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">{ws.id}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    disabled={busyId === ws.id}
                    value={slug}
                    onChange={(e) =>
                      handleSetWorkspacePlan(ws.id, e.target.value as PlanSlug)
                    }
                    className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer focus:outline-none"
                  >
                    <option value="free">Free (0 FCFA)</option>
                    <option value="agent">INNOICA Agent (3 500 FCFA)</option>
                    <option value="commerce">INNOICA Commerce (6 500 FCFA)</option>
                    <option value="starter">Starter (5 000 FCFA)</option>
                  </select>
                  <button
                    type="button"
                    disabled={busyId === ws.id}
                    onClick={() => handleToggleWorkspace(ws.id, ws.status)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    {ws.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Speech Worker & Voice Jobs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Speech Worker Local (faster-whisper INT8 CPU) & Jobs Vocaux
            </h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              speechWorkerHealth?.modelLoaded
                ? 'bg-emerald-100 text-emerald-700'
                : speechWorkerHealth
                ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {speechWorkerHealth?.modelLoaded
              ? `Opérationnel (${speechWorkerHealth.modelSize} ${speechWorkerHealth.computeType})`
              : speechWorkerHealth
              ? `En ligne • Modèle non chargé (${speechWorkerHealth.modelError || 'weights manquants'})`
              : 'Speech Worker hors ligne'}
          </span>
        </div>

        {speechWorkerHealth && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
              <div className="text-slate-500">Modèle / Quantification</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {speechWorkerHealth.modelSize} • {speechWorkerHealth.computeType}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
              <div className="text-slate-500">Threads CPU / File</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {speechWorkerHealth.cpuThreads} threads • {speechWorkerHealth.activeJobs}/{speechWorkerHealth.maxConcurrency} actifs
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
              <div className="text-slate-500">RAM Serveur</div>
              <div className="font-bold text-slate-900 mt-0.5">
                {speechWorkerHealth.hardware?.availableRamGb ?? '-'} / {speechWorkerHealth.hardware?.totalRamGb ?? '-'} GB
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
              <div className="text-slate-500">Fallback API payante</div>
              <div className="font-bold text-emerald-700 mt-0.5">Désactivé (100% local)</div>
            </div>
          </div>
        )}

        <div className="max-h-56 overflow-y-auto studio-scroll divide-y divide-slate-100 text-xs">
          {initialVoiceJobs.length === 0 ? (
            <p className="text-slate-400 py-2">Aucun traitement vocal enregistré.</p>
          ) : (
            initialVoiceJobs.map((job) => (
              <div key={job.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-bold uppercase text-slate-800">{job.status}</span>{' '}
                  <span className="text-slate-500">
                    lang={job.detected_language || '-'} • qualite={job.quality_category || '-'} • comprehension={job.comprehension_status || '-'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {job.processing_ms ? `${job.processing_ms}ms` : job.error_code || '-'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Derniers événements système</h2>
        <div className="max-h-72 overflow-y-auto studio-scroll divide-y divide-slate-100 text-xs">
          {logs.map((l) => (
            <div key={l.id} className="py-2 flex items-start justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800">{l.event_type}</span>{' '}
                <span className="text-slate-600">{l.message}</span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 uppercase">{l.level}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
