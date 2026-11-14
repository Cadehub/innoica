'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { AI_PROVIDERS_CONFIG } from '@innoica/shared';
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
} from 'lucide-react';

export function AgentConfigClient({
  agent,
  credentials,
  knowledgeSources,
}: {
  agent: any;
  credentials: any[];
  knowledgeSources: any[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<'whatsapp' | 'general' | 'instructions' | 'intelligence' | 'knowledge'>('whatsapp');

  // General & Instructions Form State
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [language, setLanguage] = useState(agent.primary_language);
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [personalityTraits, setPersonalityTraits] = useState(agent.personality_traits.join(', '));
  const [status, setStatus] = useState(agent.status);

  // Intelligence State
  const [aiProvider, setAiProvider] = useState(agent.ai_provider);
  const [aiModel, setAiModel] = useState(agent.ai_model);
  const [temperature, setTemperature] = useState(Number(agent.ai_temperature) || 0.7);
  const [credentialId, setCredentialId] = useState(agent.ai_credential_id || '');
  const [isMemoryEnabled, setIsMemoryEnabled] = useState(agent.is_memory_enabled);

  // WhatsApp Pairing State
  const initialWa = agent.whatsapp_connections;
  const [phoneNumber, setPhoneNumber] = useState(initialWa?.phone_number || '+237');
  const [pairingCode, setPairingCode] = useState<string | null>(initialWa?.pairing_code || null);
  const [waStatus, setWaStatus] = useState(initialWa?.status || 'pending');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);

  // Knowledge State
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [webTitle, setWebTitle] = useState('');
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeMsg, setKnowledgeMsg] = useState<string | null>(null);

  // Global Save State
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Sauvegarde des paramètres de l'agent
  const handleSaveGeneral = async () => {
    setSaveLoading(true);
    setSaveSuccess(false);

    const traitsArray = personalityTraits
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from('agents')
      .update({
        name,
        description,
        primary_language: language,
        system_prompt: systemPrompt,
        personality_traits: traitsArray,
        status,
        ai_provider: aiProvider,
        ai_model: aiModel,
        ai_temperature: temperature,
        ai_credential_id: credentialId || null,
        is_memory_enabled: isMemoryEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent.id);

    setSaveLoading(false);
    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      router.refresh();
    }
  };

  // 2. Génération du Pairing Code WhatsApp (ZÉRO QR CODE)
  const handleGeneratePairingCode = async () => {
    setPairingLoading(true);
    setWaError(null);

    try {
      // Validation format international (+237...)
      if (!phoneNumber.startsWith('+') || phoneNumber.length < 8) {
        throw new Error('Le numéro doit comporter l\'indicatif international (ex: +237691234567)');
      }

      // Appeler le worker WhatsApp en local ou remote
      const workerUrl = process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL || 'http://localhost:4001';
      const res = await fetch(`${workerUrl}/api/sessions/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          phoneNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la génération du code');
      }

      setPairingCode(data.pairingCode);
      setWaStatus(data.status);
    } catch (err: any) {
      setWaError(err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  // 3. Déconnexion WhatsApp
  const handleDisconnectWa = async () => {
    setPairingLoading(true);
    try {
      const workerUrl = process.env.NEXT_PUBLIC_WHATSAPP_WORKER_URL || 'http://localhost:4001';
      await fetch(`${workerUrl}/api/sessions/${agent.id}/disconnect`, {
        method: 'POST',
      });
      setWaStatus('disconnected');
      setPairingCode(null);
      router.refresh();
    } catch (err: any) {
      setWaError(err.message);
    } finally {
      setPairingLoading(false);
    }
  };

  // 4. Copier le Pairing Code
  const handleCopyCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 5. Ingestion d'une FAQ
  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion || !faqAnswer) return;
    setKnowledgeLoading(true);
    setKnowledgeMsg(null);

    try {
      const ingestionUrl = process.env.NEXT_PUBLIC_INGESTION_WORKER_URL || 'http://localhost:4003';
      const res = await fetch(`${ingestionUrl}/api/ingest/faq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          question: faqQuestion,
          answer: faqAnswer,
        }),
      });

      if (!res.ok) throw new Error('Échec d\'enregistrement de la FAQ');

      setFaqQuestion('');
      setFaqAnswer('');
      setKnowledgeMsg('FAQ ajoutée et indexée avec succès !');
      router.refresh();
    } catch (err: any) {
      setKnowledgeMsg(`Erreur : ${err.message}`);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  // 6. Ingestion d'une URL Web (SSRF Protection)
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl) return;
    setKnowledgeLoading(true);
    setKnowledgeMsg(null);

    try {
      const ingestionUrl = process.env.NEXT_PUBLIC_INGESTION_WORKER_URL || 'http://localhost:4003';
      const res = await fetch(`${ingestionUrl}/api/ingest/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          title: webTitle || 'Source Web',
          url: webUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de l\'ingestion de l\'URL');
      }

      setWebUrl('');
      setWebTitle('');
      setKnowledgeMsg(`URL ingérée avec succès (${data.chunkCount} fragments créés) !`);
      router.refresh();
    } catch (err: any) {
      setKnowledgeMsg(`Erreur SSRF/Ingestion : ${err.message}`);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const currentModels = (AI_PROVIDERS_CONFIG as any)[aiProvider]?.models || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
            <Bot className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{agent.name}</h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {status === 'active' ? '● En Ligne & Actif' : status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ID : <code className="text-slate-700">{agent.id}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              <span>Enregistré !</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSaveGeneral}
            disabled={saveLoading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
          >
            {saveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Enregistrer les modifications</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'whatsapp'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Smartphone className="h-4 w-4" />
          <span>Connexion WhatsApp (Pairing Code)</span>
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Général</span>
        </button>

        <button
          onClick={() => setActiveTab('instructions')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'instructions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bot className="h-4 w-4" />
          <span>Instructions & Prompt</span>
        </button>

        <button
          onClick={() => setActiveTab('intelligence')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'intelligence'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Intelligence IA (BYOK)</span>
        </button>

        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'knowledge'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Connaissances ({knowledgeSources.length})</span>
        </button>
      </div>

      {/* TAB 1: WHATSAPP PAIRING CODE ONLY (STRICT ZERO QR CODE) */}
      {activeTab === 'whatsapp' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Appairage WhatsApp par Pairing Code (Sans QR Code)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              INNOICA utilise exclusivement le mécanisme officiel d'association par numéro de téléphone. Aucun scan QR n'est requis.
            </p>
          </div>

          {waError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{waError}</span>
            </div>
          )}

          {/* Formulaire de saisie du numéro international */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">
                Numéro WhatsApp de l'agent (Format international normalisé)
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+237691234567 ou +33612345678"
                  disabled={waStatus === 'connected'}
                  className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-sm text-slate-900 font-mono focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Exemple : <strong>+237691234567</strong> pour le Cameroun, <strong>+33612345678</strong> pour la France.
              </span>
            </div>

            <div>
              {waStatus === 'connected' ? (
                <button
                  type="button"
                  onClick={handleDisconnectWa}
                  disabled={pairingLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 px-4 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Déconnecter ce numéro</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGeneratePairingCode}
                  disabled={pairingLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {pairingLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span>Générer mon Pairing Code</span>
                </button>
              )}
            </div>
          </div>

          {/* Affichage du Pairing Code Temporaire */}
          {pairingCode && waStatus !== 'connected' && (
            <div className="mt-6 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-6 text-center space-y-4">
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700">
                Code d'Association Temporaire (Valide 10 minutes)
              </span>

              <div className="flex items-center justify-center gap-3">
                <span className="text-4xl font-extrabold tracking-widest text-slate-900 font-mono bg-white px-6 py-3 rounded-2xl border border-blue-200 shadow-sm">
                  {pairingCode}
                </span>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Copier le code"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>

              {/* Instructions pas à pas */}
              <div className="max-w-md mx-auto text-left bg-white p-4 rounded-xl border border-blue-100 text-xs text-slate-700 space-y-2">
                <div className="font-bold text-slate-900 mb-1">
                  Procédure sur votre smartphone :
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">1.</span>
                  <span>Ouvrez WhatsApp sur votre téléphone.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">2.</span>
                  <span>Accédez à <strong>Réglages</strong> (ou Menu ⋮) &gt; <strong>Appareils connectés</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">3.</span>
                  <span>Touchez <strong>Associer un appareil</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">4.</span>
                  <span>Touchez en bas de l'écran : <strong>« Associer avec un numéro de téléphone »</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">5.</span>
                  <span>Saisissez le code à 8 caractères affiché ci-dessus.</span>
                </div>
              </div>
            </div>
          )}

          {waStatus === 'connected' && (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">WhatsApp est connecté et opérationnel !</span>
                <p className="mt-0.5 text-emerald-700">
                  Votre agent écoute désormais les messages entrants sur le numéro {phoneNumber}.
                </p>
              </div>
            </div>
          )}

          {/* Avertissement de sécurité Baileys */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-[11px] text-slate-500 space-y-1">
            <span className="font-bold text-slate-700">Transparence technique :</span>
            <p>
              INNOICA utilise le connecteur open-source Baileys. Ce service n'est ni affilié ni approuvé par WhatsApp ou Meta.
              Les utilisateurs s'engagent à respecter les politiques d'usage responsable. Le spam ou démarchage massif non sollicité est strictement interdit.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL */}
      {activeTab === 'general' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Paramètres Généraux</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Nom de l'agent</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Langue principale</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 bg-white"
              >
                <option value="fr">🇫🇷 Français</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">État de l'agent</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 bg-white"
            >
              <option value="active">Actif & Opérationnel</option>
              <option value="paused">Suspendu (Pause)</option>
              <option value="draft">Brouillon</option>
            </select>
          </div>
        </div>
      )}

      {/* TAB 3: INSTRUCTIONS & SYSTEM PROMPT */}
      {activeTab === 'instructions' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Instructions Système & Tonalité</h2>
          <p className="text-xs text-slate-500">
            Ces instructions définissent l'identité, le rôle et les garde-fous stricts de l'agent.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Traits de personnalité (séparés par des virgules)</label>
            <input
              type="text"
              value={personalityTraits}
              onChange={(e) => setPersonalityTraits(e.target.value)}
              placeholder="Ex: Courtois, Convivial, Rigoureux"
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Prompt Système Inviolable</label>
            <textarea
              rows={8}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 font-mono"
            />
          </div>
        </div>
      )}

      {/* TAB 4: INTELLIGENCE & BYOK */}
      {activeTab === 'intelligence' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Fournisseur IA (BYOK)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Fournisseur</label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  setAiProvider(e.target.value);
                  const cfg = (AI_PROVIDERS_CONFIG as any)[e.target.value];
                  if (cfg) setAiModel(cfg.defaultModel);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 bg-white"
              >
                <option value="openrouter">OpenRouter</option>
                <option value="groq">Groq (Ultra-Rapide)</option>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Modèle</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 bg-white"
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
                className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 bg-white"
              >
                <option value="">Sélectionner une clé...</option>
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.provider} - {c.key_hint})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700">
              Température (Créativité : {temperature})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>
      )}

      {/* TAB 5: KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-1">
              Ajouter des Connaissances à l'Agent
            </h2>

            {knowledgeMsg && (
              <div className="mb-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-700 border border-blue-100">
                {knowledgeMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              {/* Formulaire FAQ */}
              <form onSubmit={handleAddFaq} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-blue-600" />
                  Ajouter une FAQ (Question / Réponse)
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ex: Quels sont vos horaires d'ouverture ?"
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Nous sommes ouverts du lundi au samedi de 8h à 19h."
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={knowledgeLoading}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Ajouter la FAQ
                </button>
              </form>

              {/* Formulaire URL Web (SSRF Protection) */}
              <form onSubmit={handleAddUrl} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <ExternalLink className="h-4 w-4 text-purple-600" />
                  Ingérer une URL Web (Scraping Anti-SSRF)
                </span>
                <input
                  type="text"
                  placeholder="Titre de la page (Optionnel)"
                  value={webTitle}
                  onChange={(e) => setWebTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                />
                <input
                  type="url"
                  required
                  placeholder="https://votre-site.com/tarifs"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                />
                <button
                  type="submit"
                  disabled={knowledgeLoading}
                  className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
                >
                  Scanner & Indexer
                </button>
              </form>
            </div>
          </div>

          {/* Liste des sources existantes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Sources indexées ({knowledgeSources.length})
            </h3>
            {knowledgeSources.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">
                Aucun document ou FAQ n'est encore associé à cet agent.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {knowledgeSources.map((src: any) => (
                  <div key={src.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-800">{src.title}</div>
                      <div className="text-[11px] text-slate-400">
                        Type : <span className="uppercase">{src.source_type}</span> • Statut : {src.status}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Prêt
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
