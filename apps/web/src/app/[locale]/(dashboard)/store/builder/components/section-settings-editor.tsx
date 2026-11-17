'use client';

import React from 'react';
import { ArrowLeft, Sparkles, Sliders } from 'lucide-react';
import { StoreBuilderSection } from '@innoica/shared';

interface SectionSettingsEditorProps {
  section: StoreBuilderSection;
  onUpdateSettings: (sectionId: string, newSettings: Record<string, unknown>) => void;
  onBack: () => void;
}

export function SectionSettingsEditor({
  section,
  onUpdateSettings,
  onBack,
}: SectionSettingsEditorProps) {
  const settings = section.settings || {};

  const handleFieldChange = (key: string, value: unknown) => {
    onUpdateSettings(section.id, {
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4 antialiased">
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-200">
        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 cursor-pointer"
          title="Retour aux sections"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Paramètres : {section.type}
          </h3>
          <p className="text-[10px] text-zinc-500">Modifiez le contenu de ce bloc</p>
        </div>
      </div>

      {/* Hero Settings */}
      {section.type === 'hero' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Titre Principal</label>
            <input
              type="text"
              value={(settings.title as string) || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Ex: Bienvenue dans notre boutique"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Sous-titre / Accroche</label>
            <textarea
              rows={2}
              value={(settings.subtitle as string) || ''}
              onChange={(e) => handleFieldChange('subtitle', e.target.value)}
              placeholder="Ex: Découvrez nos articles et profitez d’une livraison express."
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Badge Supérieur</label>
            <input
              type="text"
              value={(settings.badgeText as string) || ''}
              onChange={(e) => handleFieldChange('badgeText', e.target.value)}
              placeholder="Ex: Collection Officielle 2026"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-700">Texte du Bouton</label>
              <input
                type="text"
                value={(settings.ctaText as string) || ''}
                onChange={(e) => handleFieldChange('ctaText', e.target.value)}
                placeholder="Ex: Découvrir nos offres"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-700">Lien du Bouton</label>
              <input
                type="text"
                value={(settings.ctaLink as string) || ''}
                onChange={(e) => handleFieldChange('ctaLink', e.target.value)}
                placeholder="#catalog ou /store/slug/catalog"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Catalog Grid Settings */}
      {section.type === 'catalog_grid' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Titre de la Section</label>
            <input
              type="text"
              value={(settings.title as string) || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Ex: Nos Produits Populaires"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Sous-titre</label>
            <input
              type="text"
              value={(settings.subtitle as string) || ''}
              onChange={(e) => handleFieldChange('subtitle', e.target.value)}
              placeholder="Ex: Sélectionnés pour vous"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Nombre d'articles affichés</label>
            <input
              type="number"
              min={4}
              max={40}
              value={(settings.itemsLimit as number) || 12}
              onChange={(e) => handleFieldChange('itemsLimit', parseInt(e.target.value, 10) || 12)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* About Settings */}
      {section.type === 'about' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Titre</label>
            <input
              type="text"
              value={(settings.title as string) || ''}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Ex: À Propos de Notre Boutique"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Texte de Présentation</label>
            <textarea
              rows={3}
              value={(settings.body as string) || ''}
              onChange={(e) => handleFieldChange('body', e.target.value)}
              placeholder="Présentation de votre boutique, votre engagement qualité..."
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Localisation / Ville</label>
            <input
              type="text"
              value={(settings.locationText as string) || ''}
              onChange={(e) => handleFieldChange('locationText', e.target.value)}
              placeholder="Ex: Douala, Akwa face Direction Orange"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Téléphone WhatsApp</label>
            <input
              type="text"
              value={(settings.contactPhone as string) || ''}
              onChange={(e) => handleFieldChange('contactPhone', e.target.value)}
              placeholder="+237 6XXXXXXXX"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Footer Settings */}
      {section.type === 'footer' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Texte Copyright</label>
            <input
              type="text"
              value={(settings.copyright as string) || ''}
              onChange={(e) => handleFieldChange('copyright', e.target.value)}
              placeholder="© 2026 Tous droits réservés."
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Adresse de Contact</label>
            <input
              type="text"
              value={(settings.contactAddress as string) || ''}
              onChange={(e) => handleFieldChange('contactAddress', e.target.value)}
              placeholder="Douala / Yaoundé, Cameroun"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-zinc-700">Téléphone de Contact</label>
            <input
              type="text"
              value={(settings.contactPhone as string) || ''}
              onChange={(e) => handleFieldChange('contactPhone', e.target.value)}
              placeholder="+237 6XXXXXXXX"
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-zinc-200 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Features Banner Settings */}
      {section.type === 'features_banner' && (
        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
          <p className="font-bold text-zinc-800">Garanties Standard Oraimo :</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Les 4 badges de confiance (Livraison Rapide, Garantie 100%, Paiement sécurisé et Support WhatsApp) sont optimisés automatiquement pour le marché camerounais.
          </p>
        </div>
      )}
    </div>
  );
}
