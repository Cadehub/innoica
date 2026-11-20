'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { PhoneInput } from '@/components/phone-input';
import { PlanSlug } from '@innoica/shared';
import {
  Smartphone,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Bot,
  ShieldAlert,
  Lock,
  Users,
  Radio,
  Save,
  CheckCircle2,
} from 'lucide-react';

export function WhatsAppPageClient({
  agents,
  maxConnections,
  planSlug,
}: {
  agents: any[];
  maxConnections: number;
  planSlug: PlanSlug;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [agentsList, setAgentsList] = useState<any[]>(agents);

  useEffect(() => {
    setAgentsList(agents);
  }, [agents]);

  const normalizeConn = (ag: any) =>
    Array.isArray(ag?.whatsapp_connections) ? ag.whatsapp_connections[0] : ag?.whatsapp_connections;

  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');
  const selectedAgentIdRef = useRef(selectedAgentId);
  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  const initialConn = normalizeConn(agents[0]);
  const [phoneNumber, setPhoneNumber] = useState(initialConn?.phone_number || '+237');
  const [pairingCode, setPairingCode] = useState<string | null>(initialConn?.pairing_code || null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<'numbers' | 'groups' | 'channels'>('numbers');
  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [channelsList, setChannelsList] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [newChannelJid, setNewChannelJid] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [channelFeedback, setChannelFeedback] = useState<string | null>(null);

  const loadGroups = async () => {
    if (!selectedAgentId) return;
    setLoadingGroups(true);
    try {
      const res = await fetch(`/api/whatsapp/groups?agentId=${selectedAgentId}`);
      const data = await res.json();
      if (res.ok && data?.groups) {
        setGroupsList(data.groups);
      }
    } catch {
      // Ignorer
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSaveGroupConfig = async (grp: any) => {
    setSavingGroupId(grp.group_jid);
    try {
      const res = await fetch(`/api/whatsapp/groups?agentId=${selectedAgentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_jid: grp.group_jid,
          group_name: grp.group_name,
          is_active: grp.is_active,
          monitor_mode: grp.monitor_mode,
          keywords: Array.isArray(grp.keywords)
            ? grp.keywords
            : String(grp.keywords || '').split(',').map((s) => s.trim()).filter(Boolean),
          custom_instructions: grp.custom_instructions || null,
          allow_admin_actions: grp.allow_admin_actions || false,
        }),
      });
      if (res.ok) {
        setGroupsList((prev) =>
          prev.map((g) => (g.group_jid === grp.group_jid ? { ...g, saved: true } : g))
        );
        setTimeout(() => {
          setGroupsList((prev) =>
            prev.map((g) => (g.group_jid === grp.group_jid ? { ...g, saved: false } : g))
          );
        }, 2000);
      }
    } catch {
      // Ignorer
    } finally {
      setSavingGroupId(null);
    }
  };

  const loadChannels = async () => {
    if (!selectedAgentId) return;
    setLoadingChannels(true);
    try {
      const res = await fetch(`/api/whatsapp/channels?agentId=${selectedAgentId}`);
      const data = await res.json();
      if (res.ok && data?.channels) {
        setChannelsList(data.channels);
      }
    } catch {
      // Ignorer
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelJid.trim() || !newChannelName.trim()) return;
    setChannelFeedback(null);
    try {
      const formattedJid = newChannelJid.includes('@') ? newChannelJid : `${newChannelJid}@newsletter`;
      const res = await fetch(`/api/whatsapp/channels?agentId=${selectedAgentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_jid: formattedJid,
          channel_name: newChannelName,
          is_active: true,
          require_human_approval: true,
          auto_publish_enabled: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChannelsList((prev) => [data.channel, ...prev]);
        setNewChannelJid('');
        setNewChannelName('');
        setChannelFeedback('Chaîne enregistrée avec succès.');
      } else {
        setChannelFeedback(data.error || 'Erreur enregistrement chaîne');
      }
    } catch (err: any) {
      setChannelFeedback(err.message || 'Erreur réseau');
    }
  };

  const activeConnectionsCount = agentsList.filter((ag) => {
    const conn = normalizeConn(ag);
    return conn?.status === 'connected' || conn?.status === 'pairing';
  }).length;

  const selectedAgent = agentsList.find((a) => a.id === selectedAgentId);
  const selectedConn = normalizeConn(selectedAgent);
  const connectionLimitReached =
    activeConnectionsCount >= maxConnections &&
    selectedConn?.status !== 'connected' &&
    selectedConn?.status !== 'pairing';

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-page-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_connections' },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            setAgentsList((prev) =>
              prev.map((ag) => {
                const conn = normalizeConn(ag);
                if (conn?.id === deletedId) {
                  return { ...ag, whatsapp_connections: null };
                }
                return ag;
              })
            );
            router.refresh();
            return;
          }

          const row = payload.new;
          if (row?.agent_id) {
            setAgentsList((prev) =>
              prev.map((ag) => {
                if (ag.id === row.agent_id) {
                  return {
                    ...ag,
                    whatsapp_connections: row,
                  };
                }
                return ag;
              })
            );

            if (row.agent_id === selectedAgentIdRef.current) {
              if (row.phone_number) setPhoneNumber(row.phone_number);
              setPairingCode(row.pairing_code || null);
              if (row.status === 'connected') {
                setLoading(false);
              }
            }
          }
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    const ag = agentsList.find((a) => a.id === agentId);
    const conn = normalizeConn(ag);
    setPhoneNumber(conn?.phone_number || '+237');
    setPairingCode(conn?.pairing_code || null);
  };

  const handleGenerateCode = async () => {
    if (!selectedAgentId || !phoneNumber || connectionLimitReached) return;
    setLoading(true);
    setError(null);

    try {
      if (!phoneNumber.startsWith('+') || phoneNumber.length < 8) {
        throw new Error(
          "Le numéro doit comporter l'indicatif international (ex: +237691234567)"
        );
      }

      const res = await fetch('/api/whatsapp/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          phoneNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la génération du Pairing Code');
      }

      setPairingCode(data.pairingCode);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (agentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Déconnexion impossible');
      }
      setPairingCode(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sous-navigation WhatsApp */}
      <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 border border-zinc-200/80 w-fit">
        <button
          type="button"
          onClick={() => setSubTab('numbers')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'numbers' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          <span>Numéros & Jumelage</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('groups');
            loadGroups();
          }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'groups' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Groupes WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSubTab('channels');
            loadChannels();
          }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'channels' ? 'bg-white text-zinc-950 shadow-2xs' : 'text-zinc-600 hover:text-zinc-950'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          <span>Chaînes WhatsApp</span>
        </button>
      </div>

      {subTab === 'numbers' && (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">
            Connexions par Agent ({activeConnectionsCount} / {maxConnections} autorisée
            {maxConnections > 1 ? 's' : ''})
          </h2>
          <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase text-zinc-700">
            Plan {planSlug}
          </span>
        </div>

        {agentsList.length === 0 ? (
          <div className="text-xs text-zinc-400 py-6 text-center">
            Aucun agent créé pour l'instant. Créez d'abord un agent avant d'associer WhatsApp.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {agentsList.map((ag) => {
              const wa = normalizeConn(ag);
              const isConnected = wa?.status === 'connected';

              return (
                <div
                  key={ag.id}
                  className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-zinc-900">{ag.name}</div>
                      <div className="text-zinc-500 font-mono text-[11px] mt-0.5">
                        {wa?.phone_number || 'Non associé'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 border border-emerald-200/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Connecté
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600 border border-zinc-200">
                        {wa?.status === 'pairing' ? "En cours d'association" : 'Déconnecté'}
                      </span>
                    )}

                    {isConnected ? (
                      <button
                        type="button"
                        onClick={() => handleDisconnect(ag.id)}
                        disabled={loading}
                        className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer transition-colors"
                      >
                        Déconnecter
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectAgent(ag.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                          selectedAgentId === ag.id
                            ? 'bg-zinc-900 text-white'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        {selectedAgentId === ag.id ? 'Sélectionné' : 'Sélectionner'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pairing Code Generator */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Associer un Numéro WhatsApp par Pairing Code
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Aucun QR code requis. Générez un code alphanumérique à 8 caractères à saisir dans WhatsApp &gt; Appareils connectés.
          </p>
        </div>

        {connectionLimitReached && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2.5">
              <Lock className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                Limite de numéros atteinte ({maxConnections} sur le plan {planSlug}). Passez sur Starter pour connecter 2 numéros.
              </span>
            </div>
            <Link
              href="/subscription"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              Passer à Starter
            </Link>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
          <div>
            <label className="block text-xs font-medium text-zinc-700">Agent à associer</label>
            <select
              value={selectedAgentId}
              onChange={(e) => handleSelectAgent(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 py-2 px-3 text-xs text-zinc-900 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              {agentsList.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Numéro WhatsApp (E.164)
            </label>
            <PhoneInput value={phoneNumber} onChange={setPhoneNumber} placeholder="691234567" />
          </div>

          <button
            type="button"
            onClick={handleGenerateCode}
            disabled={loading || !selectedAgentId || connectionLimitReached}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2 px-4 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer min-h-[38px] transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span>Générer le Pairing Code</span>
          </button>
        </div>

        {pairingCode && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 text-center space-y-3">
            <span className="inline-block rounded-md bg-zinc-200/80 px-2.5 py-0.5 text-[10px] font-mono font-medium text-zinc-700">
              Code de Jumelage (Valide 10 minutes)
            </span>

            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl sm:text-3xl font-bold tracking-widest text-zinc-900 font-mono bg-white px-5 py-2.5 rounded-lg border border-zinc-200/80 shadow-2xs tabular-nums">
                {pairingCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(pairingCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 cursor-pointer transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Ouvrez WhatsApp sur votre téléphone &gt; Menu &gt; Appareils connectés &gt; Connecter avec un code.
            </p>
          </div>
        )}

        <div className="rounded-lg bg-zinc-50 border border-zinc-200/60 p-3 flex items-start gap-2.5 text-[11px] text-zinc-600">
          <ShieldAlert className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
          <span>
            Note d'usage : la connexion repose sur le moteur open-source Baileys (non officiel). Respectez les limites anti-spam de WhatsApp pour préserver votre numéro.
          </span>
        </div>
      </div>
      </>
      )}

      {/* ============================================================== */}
      {/* VUE : GROUPES WHATSAPP DÉTECTÉS PAR BAILEYS */}
      {/* ============================================================== */}
      {subTab === 'groups' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
                  <Users className="h-4 w-4 text-zinc-800" />
                  Gestion des Groupes WhatsApp ({groupsList.length} détecté{groupsList.length > 1 ? 's' : ''})
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  L'agent n'écoute et ne répond <strong>que dans les groupes où vous l'activez explicitement</strong> ci-dessous. Aucun groupe n'est surveillé par défaut.
                </p>
              </div>

              <button
                type="button"
                onClick={loadGroups}
                disabled={loadingGroups}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingGroups ? 'animate-spin' : ''}`} />
                <span>Actualiser les groupes</span>
              </button>
            </div>

            {loadingGroups ? (
              <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
                <p>Récupération des groupes participants depuis WhatsApp Baileys...</p>
              </div>
            ) : groupsList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center space-y-2 text-xs text-zinc-500">
                <Users className="h-8 w-8 text-zinc-300 mx-auto" />
                <p className="font-semibold text-zinc-800">Aucun groupe participant détecté</p>
                <p>Connectez votre numéro WhatsApp et intégrez votre agent dans au moins un groupe WhatsApp pour le voir apparaître ici.</p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {groupsList.map((grp) => (
                  <div
                    key={grp.group_jid}
                    className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 space-y-4 shadow-2xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-zinc-950">{grp.group_name}</h3>
                          <span className="rounded bg-zinc-100 text-zinc-600 text-[10px] font-mono px-2 py-0.5">
                            {grp.size} participants
                          </span>
                          {grp.isBotAdmin && (
                            <span className="rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
                              Agent Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                          JID : {grp.group_jid}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={grp.is_active}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setGroupsList((prev) =>
                                prev.map((g) =>
                                  g.group_jid === grp.group_jid ? { ...g, is_active: checked } : g
                                )
                              );
                            }}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                          />
                          <span>Activer l'agent dans ce groupe</span>
                        </label>
                      </div>
                    </div>

                    {/* Paramètres de comportement pour ce groupe */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-medium text-zinc-700 mb-1">
                          Mode de surveillance
                        </label>
                        <select
                          value={grp.monitor_mode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGroupsList((prev) =>
                              prev.map((g) =>
                                g.group_jid === grp.group_jid ? { ...g, monitor_mode: val } : g
                              )
                            );
                          }}
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800"
                        >
                          <option value="smart_needed">
                            Intelligent — Répondre quand nécessaire (questions, aide, mentions)
                          </option>
                          <option value="mentions_only">
                            Mentions uniquement (@bot)
                          </option>
                          <option value="keywords_only">
                            Mots-clés déclencheurs uniquement
                          </option>
                          <option value="all_messages">
                            Tous les messages du groupe
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-medium text-zinc-700 mb-1">
                          Mots-clés déclencheurs (séparés par des virgules)
                        </label>
                        <input
                          type="text"
                          value={Array.isArray(grp.keywords) ? grp.keywords.join(', ') : grp.keywords || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGroupsList((prev) =>
                              prev.map((g) =>
                                g.group_jid === grp.group_jid ? { ...g, keywords: val } : g
                              )
                            );
                          }}
                          placeholder="devis, support, prix, commande"
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-medium text-zinc-700 mb-1">
                          Consignes spécifiques pour ce groupe
                        </label>
                        <textarea
                          rows={2}
                          value={grp.custom_instructions || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGroupsList((prev) =>
                              prev.map((g) =>
                                g.group_jid === grp.group_jid ? { ...g, custom_instructions: val } : g
                              )
                            );
                          }}
                          placeholder="Exemple : Dans ce groupe, réponds uniquement aux questions techniques. Ne traite pas de commandes privées..."
                          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                      <span className="text-[11px] text-zinc-400">
                        {grp.saved ? (
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Enregistré avec succès !
                          </span>
                        ) : (
                          'Les modifications prennent effet immédiatement dès enregistrement.'
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleSaveGroupConfig(grp)}
                        disabled={savingGroupId === grp.group_jid}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-2xs"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{savingGroupId === grp.group_jid ? 'Enregistrement...' : 'Enregistrer ce groupe'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VUE : CHAÎNES WHATSAPP (NEWSLETTERS) */}
      {/* ============================================================== */}
      {subTab === 'channels' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 flex items-center gap-2">
                <Radio className="h-4 w-4 text-zinc-800" />
                Assistant Éditorial & Chaînes WhatsApp
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Préparez vos publications de chaînes WhatsApp (texte et médias) avec validation humaine obligatoire préalable.
              </p>
            </div>

            {channelFeedback && (
              <div className="rounded-lg bg-zinc-100 border border-zinc-200 p-3 text-xs text-zinc-800">
                {channelFeedback}
              </div>
            )}

            <form onSubmit={handleAddChannel} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Nom de la chaîne
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="Ex : Actualités Innoica"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Identifiant Chaîne (JID ou @newsletter)
                </label>
                <input
                  type="text"
                  value={newChannelJid}
                  onChange={(e) => setNewChannelJid(e.target.value)}
                  placeholder="12036302... ou @newsletter"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-800"
                  required
                />
              </div>

              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-2xs"
              >
                Ajouter la chaîne
              </button>
            </form>

            <div className="pt-4 border-t border-zinc-100 space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                Chaînes configurées ({channelsList.length}) :
              </span>

              {channelsList.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  Aucune chaîne ajoutée pour l'instant.
                </div>
              ) : (
                <div className="space-y-2">
                  {channelsList.map((ch) => (
                    <div
                      key={ch.channel_jid}
                      className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-zinc-900">{ch.channel_name}</div>
                        <div className="text-[10px] font-mono text-zinc-400">{ch.channel_jid}</div>
                      </div>
                      <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
                        Approbation requise active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
