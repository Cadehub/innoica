'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { AI_PROVIDERS_CONFIG } from '@innoica/shared';
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
  workspaceId,
}: {
  templates: any[];
  credentials: any[];
  workspaceId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

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
  const [aiProvider, setAiProvider] = useState<string>('openrouter');
  const [aiModel, setAiModel] = useState<string>('meta-llama/llama-3.3-70b-instruct');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>(
    credentials[0]?.id || ''
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
    // Filtrer les credentials associés à ce provider
    const matchingCred = credentials.find((c) => c.provider === newProvider);
    if (matchingCred) {
      setSelectedCredentialId(matchingCred.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: newAgent, error: insertError } = await supabase
        .from('agents')
        .insert({
          workspace_id: workspaceId,
          template_id: selectedTemplate?.id || null,
          name,
          description,
          primary_language: language,
          system_prompt: systemPrompt,
          personality_traits: ['Professionnel', 'Courtois'],
          status: 'draft',
          is_memory_enabled: isMemoryEnabled,
          ai_credential_id: selectedCredentialId || null,
          ai_provider: aiProvider,
          ai_model: aiModel,
          ai_temperature: temperature,
        })
        .select('id')
        .single();

      if (insertError || !newAgent) {
        throw new Error(insertError?.message || 'Erreur création agent');
      }

      // Rediriger vers l'écran de configuration & pairing WhatsApp
      router.push(`/agents/${newAgent.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const currentModels = (AI_PROVIDERS_CONFIG as any)[aiProvider]?.models || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 1. Sélection du Template */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

      {/* 2. Identité & Langue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
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
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Langue principale</label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as any)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
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
            className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Instructions Système (Comportement & Mission)
          </label>
          <textarea
            required
            rows={5}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
          />
        </div>
      </div>

      {/* 3. Configuration Fournisseur IA & BYOK */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          3. Intelligence Artificielle & Fournisseur (BYOK)
        </h2>
        <p className="text-xs text-slate-500">
          Chaque agent utilise votre propre clé API pour une transparence totale des coûts.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Fournisseur IA</label>
            <select
              value={aiProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
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
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
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
            {credentials.length === 0 ? (
              <div className="mt-1 text-[11px] text-amber-600">
                Aucune clé enregistrée.{' '}
                <a href="/ai-credentials" className="underline font-bold">
                  Ajouter une clé
                </a>
              </div>
            ) : (
              <select
                value={selectedCredentialId}
                onChange={(e) => setSelectedCredentialId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white"
              >
                <option value="">Sélectionner une clé...</option>
                {credentials.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.provider} - {c.key_hint})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input
            type="checkbox"
            id="memory"
            checked={isMemoryEnabled}
            onChange={(e) => setIsMemoryEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="memory" className="text-xs text-slate-700 cursor-pointer">
            <span className="font-semibold">Activer la mémoire durable par contact</span> (retenir les préférences et historique synthétique)
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
          {error}
        </div>
      )}

      {/* Bouton de validation */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/agents')}
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span>Créer l'agent & Associer WhatsApp</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
