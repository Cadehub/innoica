'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Check,
  AlertCircle,
  Globe,
  Loader2,
  ShieldAlert,
  Power,
} from 'lucide-react';
import { slugRegex, isReservedStoreSlug } from '@innoica/shared';

interface StoreSettingsClientProps {
  initialStore: {
    store_name: string;
    store_slug: string;
    description: string | null;
    currency: string;
    is_active: boolean;
  };
  locale: 'fr' | 'en';
}

export function StoreSettingsClient({
  initialStore,
  locale,
}: StoreSettingsClientProps) {
  const router = useRouter();

  const [storeName, setStoreName] = useState(initialStore.store_name);
  const [storeSlug, setStoreSlug] = useState(initialStore.store_slug);
  const [description, setDescription] = useState(initialStore.description || '');
  const [currency, setCurrency] = useState(initialStore.currency || 'XAF');
  const [isActive, setIsActive] = useState(initialStore.is_active);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSlugChange = (val: string) => {
    // Convert to lowercase and sanitize spaces
    const formatted = val
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    setStoreSlug(formatted);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!storeName.trim() || storeName.trim().length < 2) {
      setErrorMessage('Le nom de la boutique doit comporter au moins 2 caractères.');
      return;
    }

    if (!storeSlug.trim() || storeSlug.trim().length < 2) {
      setErrorMessage('Le slug de la boutique doit comporter au moins 2 caractères.');
      return;
    }

    if (!slugRegex.test(storeSlug)) {
      setErrorMessage('Le slug ne doit comporter que des lettres minuscules, chiffres et tirets.');
      return;
    }

    if (isReservedStoreSlug(storeSlug)) {
      setErrorMessage('Ce slug est réservé par la plateforme INNOICA.');
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch('/api/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: storeName.trim(),
          storeSlug: storeSlug.trim(),
          description: description.trim() || null,
          currency,
          isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde des paramètres.');
      }

      setSuccessMessage('Paramètres de la boutique enregistrés avec succès !');
      router.refresh();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6 antialiased">
      <div>
        <h2 className="text-lg font-bold text-zinc-900">Paramètres Généraux</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Configurez l’identité publique de votre boutique et l’adresse de votre vitrine.
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Name */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-800">
              Nom de la Boutique <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex: Mode & Style Cameroun"
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-800">
              Lien de la Boutique (Slug unique) <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center rounded-xl border border-zinc-200 overflow-hidden focus-within:ring-2 focus-within:ring-zinc-400">
              <span className="px-3 py-2 bg-zinc-50 text-[11px] font-mono text-zinc-400 border-r border-zinc-200 select-none">
                innoica.com/store/
              </span>
              <input
                type="text"
                required
                value={storeSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="ma-boutique"
                className="flex-1 px-3 py-2 text-xs font-mono lowercase focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-zinc-400">
              Utilisez uniquement des lettres minuscules, chiffres et tirets.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-800">
              Description / Bio & Numéro WhatsApp du Commerçant
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Présentez votre boutique et indiquez votre numéro WhatsApp pour les commandes directes (ex: +237 6XXXXXXXX)..."
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-800">Devise de Facturation</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-200 bg-white focus:outline-none cursor-pointer"
            >
              <option value="XAF">Franc CFA (XAF / FCFA) — Cameroun</option>
            </select>
          </div>
        </div>

        {/* Store Active Toggle */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-zinc-900 block flex items-center gap-1.5">
              <Power className="h-4 w-4 text-emerald-600" />
              Statut de la Vitrine Publique
            </span>
            <span className="text-[11px] text-zinc-500 block">
              {isActive
                ? 'Votre boutique est visible et accepte les commandes en ligne.'
                : 'Votre boutique est hors ligne. Les visiteurs verront la page 404.'}
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Submit */}
        <div>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-xs font-bold bg-zinc-900 hover:bg-zinc-800 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Enregistrer les paramètres</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
