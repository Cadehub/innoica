'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import {
  Bot,
  MessageSquare,
  Smartphone,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Zap,
  Activity,
  Radio,
} from 'lucide-react';

interface DashboardOverviewClientProps {
  workspaceId: string;
  initialAgents: any[];
  initialConnections: any[];
  initialTotalConversations: number;
  initialAiRepliesTotal: number;
  initialRecentAlerts: any[];
  quota: any;
  locale: 'fr' | 'en';
}

export function DashboardOverviewClient({
  workspaceId,
  initialAgents,
  initialConnections,
  initialTotalConversations,
  initialAiRepliesTotal,
  initialRecentAlerts,
  quota,
  locale = 'fr',
}: DashboardOverviewClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [agents, setAgents] = useState<any[]>(initialAgents);
  const [connections, setConnections] = useState<any[]>(initialConnections);
  const [totalConversations, setTotalConversations] = useState<number>(initialTotalConversations);
  const [aiRepliesTotal, setAiRepliesTotal] = useState<number>(initialAiRepliesTotal);
  const [recentAlerts, setRecentAlerts] = useState<any[]>(initialRecentAlerts);
  const [dailyConvUsed, setDailyConvUsed] = useState<number>(quota?.dailyNewConversationsUsed ?? 0);
  const [dailyRepliesUsed, setDailyRepliesUsed] = useState<number>(quota?.dailyBotRepliesUsed ?? 0);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);

  // Keep a ref to valid agent IDs in this workspace for real-time conversation filtering
  const agentIdsRef = useRef<string[]>(initialAgents.map((a) => a.id));
  useEffect(() => {
    agentIdsRef.current = agents.map((a) => a.id);
  }, [agents]);

  const isStarter = quota?.planSlug === 'starter';
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const connectedWa = connections.filter((c) => c.status === 'connected').length;

  const convQuotaMax = quota?.maxDailyNewConversations ?? 5;
  const convQuotaPct = Math.min(100, Math.round((dailyConvUsed / Math.max(1, convQuotaMax)) * 100));

  const formatEventTime = () =>
    new Date().toLocaleTimeString('fr-FR', {
      timeZone: 'Africa/Douala',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  // Set up Supabase Realtime Channels for Workspace
  useEffect(() => {
    // 1. WhatsApp Connections channel
    const waChannel = supabase
      .channel(`dashboard-wa-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_connections',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          setLastEventAt(formatEventTime());
          if (payload.eventType === 'INSERT') {
            setConnections((prev) => [...prev.filter((c) => c.id !== payload.new.id), payload.new]);
          } else if (payload.eventType === 'UPDATE') {
            setConnections((prev) =>
              prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
            );
          } else if (payload.eventType === 'DELETE') {
            setConnections((prev) => prev.filter((c) => c.id !== (payload.old?.id || payload.new?.id)));
          }
          router.refresh();
        }
      )
      .subscribe((status) => {
        setIsLiveActive(status === 'SUBSCRIBED');
      });

    // 2. Agents channel
    const agentsChannel = supabase
      .channel(`dashboard-agents-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          setLastEventAt(formatEventTime());
          if (payload.eventType === 'INSERT') {
            setAgents((prev) => {
              const next = [...prev.filter((a) => a.id !== payload.new.id), payload.new];
              agentIdsRef.current = next.map((a) => a.id);
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            setAgents((prev) => {
              const next = prev.map((a) => (a.id === payload.new.id ? { ...a, ...payload.new } : a));
              agentIdsRef.current = next.map((a) => a.id);
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            setAgents((prev) => {
              const next = prev.filter((a) => a.id !== (payload.old?.id || payload.new?.id));
              agentIdsRef.current = next.map((a) => a.id);
              return next;
            });
          }
        }
      )
      .subscribe();

    // 3. Conversations channel (scoped to current workspace's agents)
    const convChannel = supabase
      .channel(`dashboard-convs-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const agentId = payload.new?.agent_id;
            if (!agentId || agentIdsRef.current.includes(agentId)) {
              setLastEventAt(formatEventTime());
              setTotalConversations((prev) => prev + 1);
              setDailyConvUsed((prev) => prev + 1);
            }
          } else if (payload.eventType === 'DELETE') {
            const agentId = payload.old?.agent_id;
            if (!agentId || agentIdsRef.current.includes(agentId)) {
              setLastEventAt(formatEventTime());
              setTotalConversations((prev) => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    // 4. Execution Logs channel (real-time alerts & confirmed AI replies)
    const logsChannel = supabase
      .channel(`dashboard-logs-${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'execution_logs',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;

          setLastEventAt(formatEventTime());

          if (row.event_type === 'ai_reply_sent') {
            setAiRepliesTotal((prev) => prev + 1);
            setDailyRepliesUsed((prev) => prev + 1);
          }

          if (row.level === 'error' || row.level === 'warn') {
            setRecentAlerts((prev) => [row, ...prev.slice(0, 4)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(waChannel);
      supabase.removeChannel(agentsChannel);
      supabase.removeChannel(convChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [workspaceId, supabase, router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
              {locale === 'en' ? 'Overview' : "Vue d'ensemble"}
            </h1>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200/80">
              <span className="relative flex h-1.5 w-1.5">
                {isLiveActive && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600" />
              </span>
              <span className="font-mono">Temps réel</span>
              {lastEventAt && (
                <span className="text-[9px] text-emerald-700/80 border-l border-emerald-200 pl-1 font-mono tabular-nums">
                  {lastEventAt}
                </span>
              )}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {locale === 'en'
              ? 'Operational supervision of WhatsApp agents — Africa/Douala timezone.'
              : 'Supervision opérationnelle de vos agents WhatsApp — fuseau Africa/Douala.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/conversations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
            <span>{locale === 'en' ? 'Open Inbox' : "Ouvrir l'Inbox"}</span>
          </Link>
          <Link
            href="/agents/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>{locale === 'en' ? 'New Agent' : 'Nouvel Agent'}</span>
          </Link>
        </div>
      </div>

      {/* Plan Status & Quotas Card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                isStarter ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {isStarter ? <Zap className="h-5 w-5 text-emerald-400" /> : <CreditCard className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Offre {isStarter ? 'Starter' : 'Free'}
                </h2>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium ${
                    isStarter
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                  }`}
                >
                  {isStarter
                    ? '5 000 FCFA/mois • Zéro signature INNOICA'
                    : '0 FCFA • Quotas quotidiens Free'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-zinc-500 max-w-2xl">
                {isStarter
                  ? 'Conversations quotidiennes illimitées côté INNOICA. Compréhension vocale FR & EN, fiches et liens web inclus, mémoire durable et jusqu’à 2 agents.'
                  : 'Jusqu’à 5 nouvelles conversations/jour et 10 réponses IA/conversation/jour (remise à zéro 00h00 Africa/Douala). Signature INNOICA incluse.'}
              </p>
            </div>
          </div>

          <Link
            href="/subscription"
            className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
              isStarter
                ? 'border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            <span>{isStarter ? 'Gérer mon abonnement' : 'Passer à Starter (5 000 FCFA/mois)'}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!isStarter && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-zinc-100">
            <div className="rounded-lg bg-zinc-50 p-3 border border-zinc-200/60">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-700">
                <span>Nouvelles conversations aujourd'hui</span>
                <span
                  className={`font-mono tabular-nums ${
                    dailyConvUsed >= convQuotaMax ? 'text-red-600 font-semibold' : 'text-zinc-900'
                  }`}
                >
                  {dailyConvUsed} / {convQuotaMax}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    dailyConvUsed >= convQuotaMax ? 'bg-red-500' : 'bg-zinc-900'
                  }`}
                  style={{ width: `${convQuotaPct}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] font-mono text-zinc-500 tabular-nums">
                Réponses IA : {dailyRepliesUsed} (max {quota?.maxDailyBotRepliesPerConv ?? 10}/conv)
              </div>
            </div>

            <div className="rounded-lg bg-zinc-50 p-3 border border-zinc-200/60 flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-zinc-400 shrink-0" />
              <div>
                <div className="text-xs font-medium text-zinc-800">Rétention d'historique</div>
                <div className="text-[11px] font-mono text-zinc-500 mt-0.5 tabular-nums">
                  {quota?.historyRetentionDays ?? 7} jours inclus sur Free
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-zinc-50 p-3 border border-zinc-200/60 flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-zinc-500 shrink-0" />
              <div>
                <div className="text-xs font-medium text-zinc-800">Signature publicitaire active</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  Apposée automatiquement côté serveur
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Agents configurés</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-zinc-900">
            {totalAgents}
            <span className="text-xs font-normal text-zinc-400 ml-1">
              / {quota?.maxAgents ?? 1}
            </span>
          </div>
          <div className="mt-1.5 flex items-center text-[11px] text-emerald-700 font-medium">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            <span>{activeAgents} actif{activeAgents > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Numéros WhatsApp</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
              <Smartphone className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-zinc-900">
            {connectedWa}
            <span className="text-xs font-normal text-zinc-400 ml-1">
              / {quota?.maxConnections ?? 1}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-zinc-500">
            {connectedWa > 0 ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Session Baileys connectée
              </span>
            ) : (
              'Pairing Code Baileys actif'
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Conversations</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-zinc-900">
            {totalConversations}
          </div>
          <div className="mt-1.5 text-[11px] text-zinc-500">
            Fils supervisés dans l'Inbox
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">Réponses délivrées</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono tabular-nums text-zinc-900">
            {aiRepliesTotal}
          </div>
          <div className="mt-1.5 text-[11px] text-zinc-500">
            Envois confirmés par l'AI Runtime
          </div>
        </div>
      </div>

      {/* Quick Links & Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-xs font-semibold text-zinc-900 mb-3">Accès rapide au Studio</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Link
              href="/whatsapp"
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900">Associer WhatsApp</div>
                <div className="text-[11px] text-zinc-500">Pairing Code à 8 caractères</div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
            <Link
              href="/ai-credentials"
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900">Clés IA (BYOK)</div>
                <div className="text-[11px] text-zinc-500">Groq, Gemini, OpenRouter, OpenAI</div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
            <Link
              href="/knowledge"
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900">Connaissances</div>
                <div className="text-[11px] text-zinc-500">
                  {isStarter ? 'FAQ, TXT, PDF, URL web' : 'FAQ et TXT inclus'}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
            <Link
              href="/settings"
              className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 transition-colors cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-zinc-900">Paramètres</div>
                <div className="text-[11px] text-zinc-500">Profil, Workspace, Langue</div>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-zinc-900">Alertes & Événements récents</h3>
            <span className="text-[11px] text-zinc-400 font-mono">Workspace courant</span>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-500">
              Aucun incident technique récent signalé sur ce workspace.
            </div>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 rounded-lg bg-zinc-50 p-2.5 border border-zinc-200/70"
                >
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      log.level === 'error' ? 'text-red-500' : 'text-amber-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-800 truncate">
                        {log.event_type}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0 tabular-nums">
                        {new Date(log.created_at).toLocaleTimeString('fr-FR', {
                          timeZone: 'Africa/Douala',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-0.5 break-words">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
