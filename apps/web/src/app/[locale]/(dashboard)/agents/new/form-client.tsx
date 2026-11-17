'use client';

import { useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { AI_PROVIDERS_CONFIG, PlanSlug } from '@innoica/shared';
import { AutoGrowTextarea } from '@/components/auto-grow-textarea';
import {
  UserCheck,
  TrendingUp,
  LifeBuoy,
  CalendarCheck,
  UtensilsCrossed,
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
  Bot,
  Lock,
  AlertCircle,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  UserCheck,
  TrendingUp,
  LifeBuoy,
  CalendarCheck,
  UtensilsCrossed,
  Sparkles,
};

export function AgentCreationForm({
  templates,
  credentials,
  planSlug,
  maxAgents,
  currentAgentsCount,
}: {
  templates: any[];
  credentials: any[];
  planSlug: PlanSlug;
  maxAgents: number;
  currentAgentsCount: number;
}) {
  const router = useRouter();
  const limitReached = currentAgentsCount >= maxAgents;

  const [selectedTemplate, setSelectedTemplate] = useState(
    templates.find((t) => t.slug === 'receptionist') || templates[0]
  );
  const [name, setName] = useState('Agent Réceptionniste');
  const [description, setDescription] = useState(
    'Accueil des clients, présentation de nos services et FAQ.'
  );
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [systemPrompt, setSystemPrompt] = useState(
    selectedTemplate?.default_system_prompt_fr || ''
  );
  const [aiProvider, setAiProvider] = useState<string>('gemini');
  const [aiModel, setAiModel] = useState<string>('gemini-2.0-flash');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>(
    credentials.find((c) => c.provider === 'gemini')?.id || credentials[0]?.id || ''
  );
  const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setName(language === 'fr' ? template.name_fr : template.name_en);
    setDescription(language === 'fr' ? template.description_fr : template.description_en);
    setSystemPrompt(
      language === 'fr' ? template.default_system_prompt_fr : template.default_system_prompt_en
    );
  };

  const handleLanguageChange = (newLang: 'fr' | 'en') => {
    setLanguage(newLang);
    if (selectedTemplate) {
      setSystemPrompt(
        newLang === 'fr'
          ? selectedTemplate.default_system_prompt_fr
          : selectedTemplate.default_system_prompt_en
      );
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setAiProvider(newProvider);
    const providerConfig = (AI_PROVIDERS_CONFIG as any)[newProvider];
    if (providerConfig) {
      setAiModel(providerConfig.defaultModel);
    }
    const matchingCred = credentials.find((c) => c.provider === newProvider);
    if (matchingCred) {
      setSelectedCredentialId(matchingCred.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limitReached) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          template_slug: selectedTemplate?.slug,
          primary_language: language,
          system_prompt: systemPrompt,
          personality_traits: ['Professionnel', 'Courtois'],
          ai_provider: aiProvider,
          ai_model: aiModel,
          ai_temperature: temperature,
          is_memory_enabled: isMemoryEnabled,
          ai_credential_id: selectedCredentialId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la création de l’agent');
      }

      router.push(`/agents/${data.agent.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const currentModels = (AI_PROVIDERS_CONFIG as any)[aiProvider]?.models || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {limitReached && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-violet-950">
                Quota d'agents atteint ({currentAgentsCount} / {maxAgents} sur le plan{' '}
                {planSlug === 'starter' ? 'Starter' : 'Free'})
              </h3>
              <p className="text-xs text-violet-800 mt-0.5">
                {planSlug === 'free'
                  ? 'Le plan Free inclut 1 agent WhatsApp. Passez sur Starter (5 000 FCFA/mois) pour débloquer 2 agents.'
                  : 'Votre plan Starter autorise jusqu’à 2 agents simultanés.'}
              </p>
            </div>
          </div>
          {planSlug === 'free' && (
            <Link
              href="/subscription"
              className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700"
            >
              Passer à Starter
            </Link>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Template */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          1. Choisissez votre Modèle de Départ
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Chaque modèle préconfigure les instructions et la tonalité de l'agent.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {templates.map((tpl) => {
            const Icon = ICON_MAP[tpl.icon] || Bot;
            const isSelected = selectedTemplate?.slug === tpl.slug;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                </div>
                <span className="text-xs font-bold text-slate-900">{tpl.name_fr}</span>
                <span className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {tpl.description_fr}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Identity & System Prompt */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          2. Identité et Instructions de l'Agent
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Nom de l'agent</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Langue principale</label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as 'fr' | 'en')}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Description</label>
          <AutoGrowTextarea
            minHeight={42}
            maxHeight={120}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Instructions Système (Comportement & Mission)
          </label>
          <AutoGrowTextarea
            required
            minHeight={110}
            maxHeight={320}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
          />
        </div>
      </div>

      {/* 3. AI Provider */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          3. Intelligence Artificielle & Fournisseur (BYOK)
        </h2>
        <p className="text-xs text-slate-500">
          Chaque agent utilise votre propre clé API chiffrée AES-256-GCM.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Fournisseur IA</label>
            <select
              value={aiProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
            >
              <option value="gemini">Google Gemini</option>
              <option value="groq">Groq Cloud</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Modèle recommandé</label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
            >
              {currentModels.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.isFree ? '[Gratuit]' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Clé API BYOK</label>
            {credentials.length === 0 ? (
              <div className="mt-2 text-[11px] text-amber-700">
                Aucune clé enregistrée.{' '}
                <Link href="/ai-credentials" className="underline font-bold">
                  Ajouter une clé
                </Link>
              </div>
            ) : (
              <select
                value={selectedCredentialId}
                onChange={(e) => setSelectedCredentialId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              >
                <option value="">Auto (clé active du fournisseur)</option>
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.provider} - {c.key_hint})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 items-center">
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

          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isMemoryEnabled}
              onChange={(e) => setIsMemoryEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Activer la mémoire contextuelle</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading || limitReached}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          <span>Créer et configurer l'agent</span>
        </button>
      </div>
    </form>
  );
}
