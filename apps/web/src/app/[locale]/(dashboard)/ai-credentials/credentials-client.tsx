'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import {
  Sparkles,
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export function AICredentialsClient({
  initialCredentials,
  workspaceId,
}: {
  initialCredentials: any[];
  workspaceId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [credentials, setCredentials] = useState(initialCredentials);
  const [provider, setProvider] = useState<'openrouter' | 'groq' | 'gemini' | 'openai'>('openrouter');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !apiKey) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/ai-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          label,
          apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de l\'enregistrement de la clé');
      }

      setCredentials((prev) => [data.credential, ...prev]);
      setLabel('');
      setApiKey('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette clé API ?')) return;

    setCredentials((prev) => prev.filter((c) => c.id !== id));
    await supabase.from('ai_credentials').delete().eq('id', id);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* Formulaire d'ajout de clé BYOK */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-1">
          Ajouter une Clé API Personnelle
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          La clé est immédiatement chiffrée avec notre clé maîtresse AES-256-GCM et ne sera plus jamais visible en clair.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-600 border border-red-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Clé API chiffrée et enregistrée avec succès !</span>
          </div>
        )}

        <form onSubmit={handleAddKey} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Fournisseur</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 bg-white"
            >
              <option value="openrouter">OpenRouter (Tous modèles)</option>
              <option value="groq">Groq (Inférence Ultra-Rapide)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI (GPT-4o)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Libellé</label>
            <input
              type="text"
              required
              placeholder="Ex: Ma clé Pro OpenRouter"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Clé API Secrète</label>
            <input
              type="password"
              required
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-900 font-mono"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>Chiffrer & Enregistrer</span>
            </button>
          </div>
        </form>
      </div>

      {/* Liste des clés existantes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 mb-4">
          Clés Enregistrées dans ce Workspace ({credentials.length})
        </h2>

        {credentials.length === 0 ? (
          <div className="text-xs text-slate-400 py-8 text-center">
            Aucune clé API configurée. Ajoutez votre première clé ci-dessus pour activer vos agents.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {credentials.map((cred) => (
              <div key={cred.id} className="py-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{cred.label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-semibold uppercase text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {cred.provider}
                      </span>
                      <code className="text-[11px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                        {cred.key_hint}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    <span>AES-256 Chiffrée</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(cred.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Supprimer la clé"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
