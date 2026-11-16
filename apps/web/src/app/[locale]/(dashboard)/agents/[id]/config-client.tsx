'use client';

import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { AI_PROVIDERS_CONFIG } from '@innoica/shared';
import { PhoneInput } from '@/components/phone-input';
import { AutoGrowTextarea } from '@/components/auto-grow-textarea';
import {
  Bot,
  Smartphone,
  Sparkles,
  BookOpen,
  Sliders,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
  Power,
  RefreshCw,
  Trash2,
  Plus,
  ExternalLink,
  FileText,
  Brain,
  FlaskConical,
  Send,
  Upload,
  Lock,
} from 'lucide-react';

export function AgentConfigClient({
  agent,
  credentials,
  knowledgeSources,
  initialMemories,
  planSlug,
  allowedKnowledgeTypes,
  maxKnowledgeDocs,
}: {
  agent: any;
  credentials: any[];
  knowledgeSources: any[];
  initialMemories: any[];
  planSlug: 'free' | 'starter';
  allowedKnowledgeTypes: string[];
  maxKnowledgeDocs: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<
    'whatsapp' | 'general' | 'instructions' | 'intelligence' | 'knowledge' | 'memory' | 'test'
  >('whatsapp');

  // General & Instructions
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [language, setLanguage] = useState(agent.primary_language);
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [personalityTraits, setPersonalityTraits] = useState(
    Array.isArray(agent.personality_traits) ? agent.personality_traits.join(', ') : ''
  );
  const [status, setStatus] = useState(agent.status);

  // Intelligence
  const [aiProvider, setAiProvider] = useState(agent.ai_provider);
  const [aiModel, setAiModel] = useState(agent.ai_model);
  const [temperature, setTemperature] = useState(Number(agent.ai_temperature) || 0.7);
  const [credentialId, setCredentialId] = useState(agent.ai_credential_id || '');
  const [isMemoryEnabled, setIsMemoryEnabled] = useState(Boolean(agent.is_memory_enabled));

  // WhatsApp Pairing
  const initialWa = Array.isArray(agent.whatsapp_connections)
    ? agent.whatsapp_connections[0]
    : agent.whatsapp_connections;
  const [phoneNumber, setPhoneNumber] = useState(initialWa?.phone_number || '+237');
  const [pairingCode, setPairingCode] = useState<string | null>(initialWa?.pairing_code || null);
  const [waStatus, setWaStatus] = useState<string>(initialWa?.status || 'disconnected');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);

  // Knowledge
  const [sources, setSources] = useState<any[]>(knowledgeSources || []);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [txtTitle, setTxtTitle] = useState('');
  const [txtContent, setTxtContent] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [webTitle, setWebTitle] = useState('');
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeMsg, setKnowledgeMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Memory
  const [memories, setMemories] = useState<any[]>(initialMemories || []);

  // Sandbox Test
  const [testInput, setTestInput] = useState(
    'Bonjour, quels services proposez-vous et quels sont vos tarifs ?'
  );
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Global Save & Delete
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Realtime sync on WhatsApp connection state
  useEffect(() => {
    const channel = supabase
      .channel(`wa-conn-${agent.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_connections',
          filter: `agent_id=eq.${agent.id}`,
        },
        (payload: any) => {
          const next = payload.new;
          if (next) {
            if (next.status) setWaStatus(next.status);
            if (next.pairing_code !== undefined) setPairingCode(next.pairing_code);
            if (next.status === 'connected') setStatus('active');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agent.id, supabase]);

  const handleSaveAgent = async () => {
    setSaveLoading(true);
    setSaveFeedback(null);

    try {
      const traitsArray = personalityTraits
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          primary_language: language,
          system_prompt: systemPrompt,
          personality_traits: traitsArray,
          ai_provider: aiProvider,
          ai_model: aiModel,
          ai_temperature: temperature,
          ai_credential_id: credentialId || null,
          is_memory_enabled: isMemoryEnabled,
          status: status === 'paused' ? 'paused' : 'active',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la sauvegarde.');
      }
      setSaveFeedback({ type: 'success', text: 'Configuration enregistrée.' });
      router.refresh();
    } catch (err: any) {
      setSaveFeedback({ type: 'error', text: err.message });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTogglePause = async () => {
    const nextStatus = status === 'paused' ? 'active' : 'paused';
    setSaveLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus(nextStatus);
        router.refresh();
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    setSaveLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/agents');
        router.refresh();
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleRequestPairingCode = async () => {
    setPairingLoading(true);
    setWaError(null);
    try {
      const res = await fetch('/api/whatsapp/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la génération du Pairing Code');
      }
      setPairingCode(data.pairingCode);
      setWaStatus(data.status || 'pairing');
      router.refresh();
    } catch (err: any) {
      setWaError(err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setPairingLoading(true);
    setWaError(null);
    try {
      const res = await fetch('/api/whatsapp/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Déconnexion impossible');
      setWaStatus('disconnected');
      setPairingCode(null);
      router.refresh();
    } catch (err: any) {
      setWaError(err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  const handleAddJsonKnowledge = async (type: 'faq' | 'txt' | 'url') => {
    setKnowledgeLoading(true);
    setKnowledgeMsg(null);
    try {
      const endpoint =
        type === 'faq'
          ? '/api/knowledge/faq'
          : type === 'txt'
          ? '/api/knowledge/txt'
          : '/api/knowledge/url';
      const payload =
        type === 'faq'
          ? { agentId: agent.id, question: faqQuestion, answer: faqAnswer }
          : type === 'txt'
          ? { agentId: agent.id, title: txtTitle, content: txtContent }
          : { agentId: agent.id, title: webTitle || undefined, url: webUrl };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur ingestion');

      if (data.source) {
        setSources((prev) => [
          { ...data.source, agent_knowledge_chunks: [{ count: data.chunkCount || 1 }] },
          ...prev,
        ]);
      }
      setFaqQuestion('');
      setFaqAnswer('');
      setTxtTitle('');
      setTxtContent('');
      setWebUrl('');
      setWebTitle('');
      setKnowledgeMsg({
        type: 'success',
        text: `Source ajoutée (${data.chunkCount || 1} fragment(s) indexés).`,
      });
    } catch (err: any) {
      setKnowledgeMsg({ type: 'error', text: err.message });
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const handleAddPdf = async () => {
    if (!pdfFile) return;
    setKnowledgeLoading(true);
    setKnowledgeMsg(null);
    try {
      const fd = new FormData();
      fd.append('agentId', agent.id);
      if (pdfTitle.trim()) fd.append('title', pdfTitle.trim());
      fd.append('file', pdfFile);

      const res = await fetch('/api/knowledge/pdf', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur PDF');

      if (data.source) {
        setSources((prev) => [
          { ...data.source, agent_knowledge_chunks: [{ count: data.chunkCount || 1 }] },
          ...prev,
        ]);
      }
      setPdfTitle('');
      setPdfFile(null);
      setKnowledgeMsg({
        type: 'success',
        text: `PDF extrait et indexé (${data.totalPages} pages, ${data.chunkCount} fragments).`,
      });
    } catch (err: any) {
      setKnowledgeMsg({ type: 'error', text: err.message });
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    const res = await fetch(`/api/knowledge/${sourceId}`, { method: 'DELETE' });
    if (res.ok) {
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    }
  };

  const handleDeleteMemory = async (memId: string) => {
    const res = await fetch('/api/memories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'contact', id: memId }),
    });
    if (res.ok) {
      setMemories((prev) => prev.filter((m) => m.id !== memId));
    }
  };

  const handleTestAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true);
    setTestError(null);
    setTestReply(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Test impossible');
      }
      setTestReply(data.reply);
    } catch (err: any) {
      setTestError(err.message);
    } finally {
      setTestLoading(false);
    }
  };

  const currentModels = (AI_PROVIDERS_CONFIG as any)[aiProvider]?.models || [];
  const pdfAllowed = allowedKnowledgeTypes.includes('pdf');
  const urlAllowed = allowedKnowledgeTypes.includes('url');

  const tabs = [
    { id: 'whatsapp', label: 'WhatsApp Pairing', icon: Smartphone },
    { id: 'general', label: 'Général', icon: Bot },
    { id: 'instructions', label: 'Instructions', icon: Sliders },
    { id: 'intelligence', label: 'Intelligence IA', icon: Sparkles },
    { id: 'knowledge', label: `Connaissances (${sources.length})`, icon: BookOpen },
    { id: 'memory', label: `Mémoire (${memories.length})`, icon: Brain },
    { id: 'test', label: 'Tester l’agent', icon: FlaskConical },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">{name}</h1>
              {waStatus === 'connected' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  WhatsApp Connecté
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                  {waStatus === 'pairing' ? 'En cours d’appairage' : 'WhatsApp Non connecté'}
                </span>
              )}
              {status === 'paused' && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                  En pause
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {agent.agent_templates?.name_fr || 'Agent Sur-Mesure'} • Modèle :{' '}
              {aiModel.split('/').pop()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleTogglePause}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Power className="h-3.5 w-3.5" />
            <span>{status === 'paused' ? 'Réactiver' : 'Mettre en pause'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAgent}
            disabled={saveLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {saveLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Enregistrer</span>
          </button>
        </div>
      </div>

      {saveFeedback && (
        <div
          className={`flex items-center gap-2 rounded-xl p-3 text-xs border ${
            saveFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {saveFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{saveFeedback.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: WhatsApp */}
      {activeTab === 'whatsapp' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Association WhatsApp par Pairing Code
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Liez cet agent à votre numéro WhatsApp via code à 8 caractères (sans QR code).
            </p>
          </div>

          {waError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{waError}</span>
            </div>
          )}

          {waStatus === 'connected' ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-emerald-950">
                    Numéro connecté : {phoneNumber}
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    L'agent répond automatiquement selon votre offre {planSlug === 'starter' ? 'Starter' : 'Free'}.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisconnectWhatsApp}
                disabled={pairingLoading}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
              >
                Déconnecter
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Numéro WhatsApp (Format E.164)
                  </label>
                  <PhoneInput value={phoneNumber} onChange={setPhoneNumber} />
                </div>
                <button
                  type="button"
                  onClick={handleRequestPairingCode}
                  disabled={pairingLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer min-h-[42px]"
                >
                  {pairingLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>Générer le Pairing Code</span>
                </button>
              </div>

              {pairingCode && (
                <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-6 text-center space-y-3">
                  <div className="text-xs font-bold text-blue-700">
                    Entrez ce code sur WhatsApp (Appareils connectés &gt; Associer avec numéro) :
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-3xl font-extrabold tracking-widest text-slate-900 font-mono bg-white px-5 py-2.5 rounded-xl border border-blue-200">
                      {pairingCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pairingCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-blue-200 text-blue-600 hover:bg-blue-100 cursor-pointer"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: General */}
      {activeTab === 'general' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nom de l'agent</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Langue principale</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs bg-white"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Description</label>
            <AutoGrowTextarea
              minHeight={48}
              maxHeight={140}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-red-700">Zone sensible</div>
              <div className="text-[11px] text-slate-500">
                La suppression efface l'agent et ses conversations associées.
              </div>
            </div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
              >
                Supprimer l'agent
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAgent}
                  className="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
                >
                  Confirmer la suppression
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Instructions */}
      {activeTab === 'instructions' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Instructions Système (Mission, Règles, Limites)
            </label>
            <AutoGrowTextarea
              minHeight={160}
              maxHeight={380}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Traits de personnalité (séparés par des virgules)
            </label>
            <input
              type="text"
              value={personalityTraits}
              onChange={(e) => setPersonalityTraits(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs"
            />
          </div>
        </div>
      )}

      {/* Tab 4: Intelligence */}
      {activeTab === 'intelligence' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Fournisseur IA</label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  const p = e.target.value;
                  setAiProvider(p);
                  const cfg = (AI_PROVIDERS_CONFIG as any)[p];
                  if (cfg) setAiModel(cfg.defaultModel);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs bg-white"
              >
                <option value="gemini">Google Gemini</option>
                <option value="groq">Groq Cloud</option>
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Modèle</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs bg-white"
              >
                {currentModels.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Clé API BYOK</label>
              <select
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs bg-white"
              >
                <option value="">Clé par défaut du fournisseur</option>
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.provider} - {c.key_hint})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Température : {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-blue-600 mt-2"
              />
            </div>

            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isMemoryEnabled}
                onChange={(e) => setIsMemoryEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>Activer l'extraction de mémoire contact & conversation</span>
            </label>
          </div>
        </div>
      )}

      {/* Tab 5: Knowledge */}
      {activeTab === 'knowledge' && (
        <div className="space-y-5">
          {knowledgeMsg && (
            <div
              className={`rounded-xl p-3 text-xs border ${
                knowledgeMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {knowledgeMsg.text}
            </div>
          )}

          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>
              Sources du workspace limitées à {maxKnowledgeDocs} documents sur votre plan{' '}
              <strong>{planSlug === 'starter' ? 'Starter' : 'Free'}</strong>.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* FAQ */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Ajouter une FAQ</h3>
              <input
                type="text"
                placeholder="Question fréquente..."
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <AutoGrowTextarea
                minHeight={72}
                maxHeight={200}
                placeholder="Réponse précise de l'entreprise..."
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs"
              />
              <button
                type="button"
                onClick={() => handleAddJsonKnowledge('faq')}
                disabled={knowledgeLoading || !faqQuestion || !faqAnswer}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Indexer FAQ</span>
              </button>
            </div>

            {/* TXT */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Ajouter un texte (TXT)</h3>
              <input
                type="text"
                placeholder="Titre du document..."
                value={txtTitle}
                onChange={(e) => setTxtTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <AutoGrowTextarea
                minHeight={72}
                maxHeight={200}
                placeholder="Collez tarifs, catalogue, conditions..."
                value={txtContent}
                onChange={(e) => setTxtContent(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs"
              />
              <button
                type="button"
                onClick={() => handleAddJsonKnowledge('txt')}
                disabled={knowledgeLoading || !txtTitle || !txtContent}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Indexer Texte</span>
              </button>
            </div>

            {/* URL */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Importer une URL publique</h3>
                {!urlAllowed && (
                  <Link
                    href="/subscription"
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-700"
                  >
                    <Lock className="h-3 w-3" /> Starter
                  </Link>
                )}
              </div>
              <input
                type="text"
                placeholder="Titre (optionnel)"
                value={webTitle}
                onChange={(e) => setWebTitle(e.target.value)}
                disabled={!urlAllowed}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
              />
              <input
                type="url"
                placeholder="https://votre-site.com/tarifs"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                disabled={!urlAllowed}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => handleAddJsonKnowledge('url')}
                disabled={!urlAllowed || knowledgeLoading || !webUrl}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Importer URL</span>
              </button>
            </div>

            {/* PDF */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Importer un document PDF</h3>
                {!pdfAllowed && (
                  <Link
                    href="/subscription"
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-bold text-violet-700"
                  >
                    <Lock className="h-3 w-3" /> Starter
                  </Link>
                )}
              </div>
              <input
                type="text"
                placeholder="Titre (optionnel)"
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                disabled={!pdfAllowed}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-50"
              />
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={!pdfAllowed}
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700"
              />
              <button
                type="button"
                onClick={handleAddPdf}
                disabled={!pdfAllowed || knowledgeLoading || !pdfFile}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Extraire & Indexer PDF</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Sources indexées</h3>
            {sources.length === 0 ? (
              <p className="text-xs text-slate-400">Aucune source pour le moment.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {sources.map((src) => (
                  <div key={src.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{src.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {src.source_type.toUpperCase()} •{' '}
                        {src.agent_knowledge_chunks?.[0]?.count ?? 1} fragment(s)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSource(src.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Memory */}
      {activeTab === 'memory' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Mémoire durable des contacts</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Faits retenus automatiquement ou manuellement sur les contacts de cet agent.
            </p>
          </div>
          {memories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              Aucune mémoire enregistrée pour cet agent pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {memories.map((mem) => (
                <div key={mem.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-900">
                      {mem.contacts?.display_name || mem.contacts?.push_name || mem.contacts?.phone_number}
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      <span className="font-semibold text-blue-700">{mem.key} :</span> {mem.value}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteMemory(mem.id)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Live Test */}
      {activeTab === 'test' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Bac à sable BYOK en direct</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Simule un message client avec le prompt, les connaissances et la signature de votre plan{' '}
              <strong>{planSlug === 'starter' ? 'Starter' : 'Free'}</strong>.
            </p>
          </div>

          <form onSubmit={handleTestAgent} className="space-y-3">
            <AutoGrowTextarea
              minHeight={64}
              maxHeight={180}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Saisissez un message client test..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs"
            />
            <button
              type="submit"
              disabled={testLoading || !testInput.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {testLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span>Tester la réponse IA</span>
            </button>
          </form>

          {testError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              {testError}
            </div>
          )}

          {testReply && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                Réponse générée ({planSlug === 'free' ? 'avec signature Free' : 'sans signature Starter'})
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800">{testReply}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
