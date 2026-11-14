'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import {
  Sparkles,
  Key,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Zap,
  Cpu,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface AICredential {
  id: string;
  provider: 'openrouter' | 'groq' | 'gemini' | 'openai';
  label: string;
  key_hint: string;
  is_valid: boolean;
  last_tested_at?: string;
  created_at: string;
}

const PROVIDERS_INFO = {
  groq: {
    name: 'Groq Cloud',
    tagline: 'Vitesse Ultra-Rapide (< 500ms)',
    recommendedFor: 'Recommandé pour WhatsApp (temps réel)',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-200',
    keyPlaceholder: 'gsk_...',
    keyPrefix: 'gsk_',
    docUrl: 'https://console.groq.com/keys',
    docLabel: 'console.groq.com',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    description: 'Architecture LPU offrant la latence la plus faible du marché. Idéal pour des réponses instantanées.',
  },
  gemini: {
    name: 'Google Gemini',
    tagline: 'Contexte 1M+ & Quota Gratuit',
    recommendedFor: 'Recommandé pour documents volumineux',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-200',
    keyPlaceholder: 'AIzaSy...',
    keyPrefix: 'AIza',
    docUrl: 'https://aistudio.google.com/app/apikey',
    docLabel: 'aistudio.google.com',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    description: 'Modèle multimodal de pointe de Google avec une capacité d’analyse documentaire massive.',
  },
  openrouter: {
    name: 'OpenRouter',
    tagline: 'Multi-Modèles Mondial (DeepSeek, Llama, Claude)',
    recommendedFor: 'Recommandé pour la flexibilité',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-200',
    keyPlaceholder: 'sk-or-v1-...',
    keyPrefix: 'sk-or-',
    docUrl: 'https://openrouter.ai/keys',
    docLabel: 'openrouter.ai/keys',
    models: ['meta-llama/llama-3.3-70b-instruct', 'deepseek/deepseek-chat', 'mistralai/mistral-large-2411'],
    description: 'Une seule API unifiée donnant accès à plus de 100 modèles open-source et propriétaires.',
  },
  openai: {
    name: 'OpenAI',
    tagline: 'Précision & Fiabilité Industrie',
    recommendedFor: 'Standard d’entreprise',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    keyPlaceholder: 'sk-proj-... ou sk-...',
    keyPrefix: 'sk-',
    docUrl: 'https://platform.openai.com/api-keys',
    docLabel: 'platform.openai.com',
    models: ['gpt-4o-mini', 'gpt-4o'],
    description: 'Les modèles GPT de référence pour des instructions complexes et des raisonnements précis.',
  },
} as const;

export function AICredentialsClient({
  initialCredentials,
  workspaceId,
}: {
  initialCredentials: AICredential[];
  workspaceId: string;
}) {
  const router = useRouter();

  const [credentials, setCredentials] = useState<AICredential[]>(initialCredentials);
  const [provider, setProvider] = useState<'openrouter' | 'groq' | 'gemini' | 'openai'>('groq');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const [testLoading, setTestLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [retestId, setRetestId] = useState<string | null>(null);

  const [testMessage, setTestMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentProviderInfo = PROVIDERS_INFO[provider];

  // 1. Tester la clé directement sans enregistrer
  const handleTestRawKey = async () => {
    if (!apiKey.trim()) {
      setError('Veuillez saisir une clé API pour effectuer le test de connexion.');
      return;
    }

    setTestLoading(true);
    setTestMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/ai-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestMessage({ success: true, text: data.message || 'Clé API validée avec succès !' });
      } else {
        setTestMessage({ success: false, text: data.error || data.message || 'Échec du test de connexion.' });
      }
    } catch (err: any) {
      setTestMessage({ success: false, text: `Erreur réseau : ${err.message}` });
    } finally {
      setTestLoading(false);
    }
  };

  // 2. Enregistrer la clé avec chiffrement AES-256-GCM
  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !apiKey.trim()) {
      setError('Veuillez renseigner un libellé et votre clé API.');
      return;
    }

    setSaveLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/ai-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          label: label.trim(),
          apiKey: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de l’enregistrement de la clé');
      }

      setCredentials((prev) => [data.credential, ...prev]);
      setLabel('');
      setApiKey('');
      setTestMessage(null);
      setSuccess(`Clé API "${data.credential.label}" chiffrée et enregistrée avec succès.`);
      setTimeout(() => setSuccess(null), 4000);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // 3. Re-tester une clé déjà enregistrée
  const handleRetest = async (credentialId: string) => {
    setRetestId(credentialId);
    try {
      const res = await fetch('/api/ai-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });

      const data = await res.json();
      setCredentials((prev) =>
        prev.map((c) =>
          c.id === credentialId
            ? { ...c, is_valid: data.success, last_tested_at: new Date().toISOString() }
            : c
        )
      );
    } catch {
      // Ignorer l'erreur réseau ponctuelle
    } finally {
      setRetestId(null);
    }
  };

  // 4. Supprimer une clé
  const handleDelete = async (id: string, keyLabel: string) => {
    if (!confirm(`Supprimer définitivement la clé "${keyLabel}" ? Les agents associés perdront leur accès.`)) {
      return;
    }

    setCredentials((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/ai-credentials?id=${id}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-2 sm:px-4">
      {/* Bannière de Sécurité & Information BYOK */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Architecture Sécurisée BYOK (Bring Your Own Key)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Vous gardez le contrôle total de vos coûts et quotas. Vos clés sont chiffrées côté serveur avec <strong>AES-256-GCM</strong> et ne sont jamais renvoyées en clair.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-semibold">
            <Lock className="h-3.5 w-3.5" />
            <span>Chiffrement matériel GCM</span>
          </div>
        </div>
      </div>

      {/* Formulaire d'ajout de clé */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Ajouter une Nouvelle Clé Fournisseur
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Sélectionnez votre fournisseur IA, configurez votre clé et testez la liaison en un clic.
        </p>

        {/* Sélection visuelle du fournisseur IA (Mobile-First Grid) */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-700 mb-2">
            1. Choisissez le Fournisseur IA
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.entries(PROVIDERS_INFO) as [keyof typeof PROVIDERS_INFO, typeof PROVIDERS_INFO.groq][]).map(
              ([key, info]) => {
                const isSelected = provider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setProvider(key);
                      setTestMessage(null);
                    }}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-sm text-slate-900">{info.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${info.badgeColor}`}>
                        {key.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-blue-600 mb-2">
                      {info.tagline}
                    </span>
                    <span className="text-[11px] text-slate-500 line-clamp-2 mt-auto">
                      {info.description}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Guide d'obtention de la clé pour le fournisseur sélectionné */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-1">
              <span className="font-semibold text-slate-800">
                Comment obtenir votre clé {currentProviderInfo.name} ?
              </span>
              <p className="text-slate-500 text-[11px]">
                Format attendu : commence par <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-800 font-mono">{currentProviderInfo.keyPrefix}</code> • Modèles recommandés : {currentProviderInfo.models.slice(0, 2).join(', ')}.
              </p>
            </div>
            <a
              href={currentProviderInfo.docUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs text-xs shrink-0 self-start sm:self-auto"
            >
              <span>Ouvrir {currentProviderInfo.docLabel}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Messages d'alerte / feedback */}
        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {testMessage && (
          <div
            className={`mb-5 flex items-center gap-2 rounded-xl p-3 text-xs border ${
              testMessage.success
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-red-50 text-red-600 border-red-200'
            }`}
          >
            {testMessage.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            )}
            <span>{testMessage.text}</span>
          </div>
        )}

        {/* Formulaire Saisie */}
        <form onSubmit={handleSaveKey} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nom ou Libellé de la Clé
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Clé Principale Production, Clé Test..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 min-h-[44px]"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Valeur de la Clé API ({currentProviderInfo.name})
                </label>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  <span>{showKey ? 'Masquer' : 'Afficher'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTestMessage(null);
                  }}
                  placeholder={currentProviderInfo.keyPlaceholder}
                  className="w-full font-mono rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 min-h-[44px]"
                  required
                />
              </div>
            </div>
          </div>

          {/* Boutons d'actions tactiles */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestRawKey}
              disabled={testLoading || saveLoading || !apiKey.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 min-h-[44px] cursor-pointer transition-all"
            >
              {testLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span>Test de liaison en cours...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Tester la Clé avant Sauvegarde</span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={saveLoading || !label.trim() || !apiKey.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 min-h-[44px] cursor-pointer transition-all"
            >
              {saveLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Chiffrement et enregistrement...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Chiffrer et Enregistrer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Liste des Clés Enregistrées (Mobile-First Cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Clés API Actives ({credentials.length})
            </h3>
            <p className="text-xs text-slate-500">
              Gérez les clés configurées pour votre espace de travail.
            </p>
          </div>
        </div>

        {credentials.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Key className="mx-auto h-10 w-10 text-slate-400 mb-3" />
            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Aucune clé API configurée
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Ajoutez votre première clé OpenRouter, Groq, Gemini ou OpenAI ci-dessus pour activer vos agents WhatsApp.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {credentials.map((cred) => {
              const info = PROVIDERS_INFO[cred.provider] || PROVIDERS_INFO.groq;
              const isRetesting = retestId === cred.id;

              return (
                <div
                  key={cred.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">
                          <Cpu className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                            {cred.label}
                          </h4>
                          <span className="text-xs text-slate-500">
                            {info.name}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          cred.is_valid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-600 border-red-200'
                        }`}
                      >
                        {cred.is_valid ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Opérationnelle</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            <span>Invalide / Expirée</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div className="mt-3 rounded-xl bg-slate-50 p-2.5 flex items-center justify-between text-xs font-mono text-slate-600 border border-slate-100">
                      <span>Empreinte : {cred.key_hint}</span>
                      <span className="text-[10px] text-slate-400 font-sans">AES-256</span>
                    </div>

                    <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Ajoutée le {new Date(cred.created_at).toLocaleDateString()}</span>
                      {cred.last_tested_at && (
                        <span>Vérifiée le {new Date(cred.last_tested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleRetest(cred.id)}
                      disabled={isRetesting}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer min-h-[36px]"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRetesting ? 'animate-spin' : ''}`} />
                      <span>{isRetesting ? 'Test en cours...' : 'Tester la clé'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(cred.id, cred.label)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer min-h-[36px]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Supprimer</span>
                    </button>
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
