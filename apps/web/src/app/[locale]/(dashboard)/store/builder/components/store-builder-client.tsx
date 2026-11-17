'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Send,
  RotateCcw,
  Sliders,
  Palette,
  Megaphone,
  History,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { StoreBuilderSection } from '@innoica/shared';
import { ColorPalettePicker } from './color-palette-picker';
import { SectionsManager } from './sections-manager';
import { SectionSettingsEditor } from './section-settings-editor';
import { DevicePreviewFrame } from './device-preview-frame';
import { VersionHistory } from './version-history';
import { ProductCardData } from '@/components/store/product-card';

// Standard 5 Oraimo-style Default Sections
export const DEFAULT_STORE_SECTIONS: StoreBuilderSection[] = [
  {
    id: 'sec-hero-1',
    type: 'hero',
    visible: true,
    order: 0,
    settings: {
      title: 'Bienvenue dans notre boutique',
      subtitle: 'Découvrez nos articles de qualité et profitez d’une livraison express partout au Cameroun.',
      badgeText: 'Collection Officielle 2026',
      ctaText: 'Commander maintenant',
      ctaLink: '#catalog',
    },
  },
  {
    id: 'sec-features-1',
    type: 'features_banner',
    visible: true,
    order: 1,
    settings: {},
  },
  {
    id: 'sec-catalog-1',
    type: 'catalog_grid',
    visible: true,
    order: 2,
    settings: {
      title: 'Nos Produits Populaires',
      subtitle: 'Sélectionnés pour vous',
      itemsLimit: 12,
      showCategoriesFilter: true,
    },
  },
  {
    id: 'sec-about-1',
    type: 'about',
    visible: true,
    order: 3,
    settings: {
      title: 'À Propos de Nous',
      body: 'Votre boutique de référence au Cameroun. Nous sélectionnons avec passion les meilleurs produits pour vous garantir satisfaction et tranquillité d’esprit.',
      locationText: 'Douala & Yaoundé, Cameroun',
    },
  },
  {
    id: 'sec-footer-1',
    type: 'footer',
    visible: true,
    order: 4,
    settings: {
      copyright: '© 2026 Tous droits réservés.',
      contactAddress: 'Cameroun',
    },
  },
];

interface StoreBuilderClientProps {
  initialLayout: any;
  initialThemeColor: string;
  storeName: string;
  storeSlug: string;
  sampleProducts?: ProductCardData[];
  locale?: 'fr' | 'en';
}

export function StoreBuilderClient({
  initialLayout,
  initialThemeColor = '#25D366',
  storeName,
  storeSlug,
  sampleProducts = [],
  locale = 'fr',
}: StoreBuilderClientProps) {
  const router = useRouter();

  // Builder State
  const [themeColor, setThemeColor] = useState<string>(
    initialLayout?.themeColor || initialThemeColor || '#25D366'
  );

  const initialSections: StoreBuilderSection[] =
    Array.isArray(initialLayout?.sections) && initialLayout.sections.length > 0
      ? initialLayout.sections
      : DEFAULT_STORE_SECTIONS;

  const [sections, setSections] = useState<StoreBuilderSection[]>(initialSections);

  const [announcement, setAnnouncement] = useState<{ enabled: boolean; text: string }>({
    enabled: initialLayout?.announcement?.enabled ?? true,
    text:
      initialLayout?.announcement?.text ||
      'Livraison express à Douala & Yaoundé • Retrait gratuit en boutique',
  });

  const [history, setHistory] = useState<any[]>(
    Array.isArray(initialLayout?.history) ? initialLayout.history : []
  );

  // Saved draft & published baseline for discard/restore
  const [availableDraft, setAvailableDraft] = useState<any | null>(
    initialLayout?.draft && Array.isArray(initialLayout.draft.sections) ? initialLayout.draft : null
  );
  const [publishedBaseline, setPublishedBaseline] = useState({
    themeColor: initialLayout?.themeColor || initialThemeColor || '#25D366',
    sections: initialSections,
    announcement: {
      enabled: initialLayout?.announcement?.enabled ?? true,
      text:
        initialLayout?.announcement?.text ||
        'Livraison express à Douala & Yaoundé • Retrait gratuit en boutique',
    },
  });

  const isDirty =
    themeColor !== publishedBaseline.themeColor ||
    JSON.stringify(sections) !== JSON.stringify(publishedBaseline.sections) ||
    JSON.stringify(announcement) !== JSON.stringify(publishedBaseline.announcement);

  // UI Navigation State
  const [activeTab, setActiveTab] = useState<'sections' | 'branding' | 'announcement' | 'history'>('sections');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selectedSection = sections.find((s) => s.id === selectedSectionId) || null;

  // Handlers
  const handleToggleVisibility = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, visible: !s.visible } : s))
    );
  };

  const handleUpdateSectionSettings = (sectionId: string, newSettings: Record<string, unknown>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, settings: newSettings } : s))
    );
  };

  const handleSaveAction = async (action: 'draft' | 'publish') => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        action,
        layout: {
          themeColor,
          sections,
          announcement,
        },
      };

      const res = await fetch('/api/store/builder/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde.');
      }

      if (action === 'publish') {
        setPublishedBaseline({
          themeColor,
          sections,
          announcement,
        });
        setAvailableDraft(null);
        setStatusMessage({
          type: 'success',
          text: 'Boutique publiée avec succès ! Les modifications sont visibles en ligne.',
        });
        if (data.builderLayout?.history) {
          setHistory(data.builderLayout.history);
        }
        router.refresh();
      } else {
        setAvailableDraft(data.builderLayout?.draft || { themeColor, sections, announcement, savedAt: new Date().toISOString() });
        setStatusMessage({
          type: 'success',
          text: 'Brouillon enregistré. Vous pouvez reprendre votre travail à tout moment.',
        });
      }

      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Une erreur est survenue lors de l’enregistrement.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreSnapshot = (snapshot: any) => {
    if (!snapshot) return;
    if (snapshot.themeColor) setThemeColor(snapshot.themeColor);
    if (Array.isArray(snapshot.sections)) setSections(snapshot.sections);
    if (snapshot.announcement) setAnnouncement(snapshot.announcement);

    setStatusMessage({
      type: 'success',
      text: 'Version restaurée avec succès sur le canevas d’édition.',
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDiscardChanges = () => {
    setThemeColor(publishedBaseline.themeColor);
    setSections(publishedBaseline.sections);
    setAnnouncement(publishedBaseline.announcement);
    setStatusMessage({
      type: 'success',
      text: 'Modifications non publiées annulées.',
    });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleLoadDraft = () => {
    if (!availableDraft) return;
    if (availableDraft.themeColor) setThemeColor(availableDraft.themeColor);
    if (Array.isArray(availableDraft.sections)) setSections(availableDraft.sections);
    if (availableDraft.announcement) setAnnouncement(availableDraft.announcement);
    setAvailableDraft(null);
    setStatusMessage({
      type: 'success',
      text: 'Brouillon chargé sur le canevas. Cliquez sur « Publier la boutique » pour le mettre en ligne.',
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <div className="space-y-4 antialiased">
      {/* Draft Restore Banner */}
      {availableDraft && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div>
            <span className="font-bold">Brouillon non publié disponible</span>
            {availableDraft.savedAt && (
              <span className="text-amber-700 ml-1.5">
                (enregistré le{' '}
                {new Date(availableDraft.savedAt).toLocaleString('fr-FR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
                )
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadDraft}
              className="px-3 py-1.5 rounded-xl bg-amber-900 text-white font-bold hover:bg-amber-800 transition-colors cursor-pointer"
            >
              Charger le brouillon
            </button>
            <button
              type="button"
              onClick={() => setAvailableDraft(null)}
              className="px-2.5 py-1.5 rounded-xl border border-amber-300 text-amber-800 font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
        <div>
          <h2 className="text-base font-black text-zinc-900 tracking-tight">
            Constructeur Visuel de Boutique
          </h2>
          <p className="text-[11px] text-zinc-500">
            Personnalisez votre vitrine Oraimo-style en temps réel sans coder.
          </p>
        </div>

        {/* Action Buttons: Discard, Save Draft, Publish, View Live */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleDiscardChanges}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Annuler</span>
            </button>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveAction('draft')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Enregistrer brouillon</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSaveAction('publish')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-950 hover:bg-zinc-800 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 text-[#25D366]" />
            )}
            <span>Publier la boutique</span>
          </button>

          <a
            href={`/store/${storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
            title="Ouvrir la vitrine publique"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Split Layout: Left Editor (380px), Right Live Preview Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Editor Controls (5 cols / ~420px) */}
        <aside className="lg:col-span-4 xl:col-span-4 bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/80 shadow-2xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Editor Sub-Tabs */}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('sections');
                  setSelectedSectionId(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'sections'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Sections
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('branding');
                  setSelectedSectionId(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'branding'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Couleurs
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('announcement');
                  setSelectedSectionId(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'announcement'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Bannière
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  setSelectedSectionId(null);
                }}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-white text-zinc-900 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Historique
              </button>
            </div>

            {/* Tab 1: Sections Manager or Section Details */}
            {activeTab === 'sections' && (
              <>
                {selectedSection ? (
                  <SectionSettingsEditor
                    section={selectedSection}
                    onUpdateSettings={handleUpdateSectionSettings}
                    onBack={() => setSelectedSectionId(null)}
                  />
                ) : (
                  <SectionsManager
                    sections={sections}
                    onReorder={setSections}
                    onToggleVisibility={handleToggleVisibility}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={(id) => setSelectedSectionId(id)}
                  />
                )}
              </>
            )}

            {/* Tab 2: Theme Colors */}
            {activeTab === 'branding' && (
              <ColorPalettePicker color={themeColor} onChange={setThemeColor} />
            )}

            {/* Tab 3: Announcement Bar */}
            {activeTab === 'announcement' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800">
                    Bannière d'Annonce Supérieure
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={announcement.enabled}
                      onChange={(e) =>
                        setAnnouncement((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700">Texte du message</label>
                  <input
                    type="text"
                    maxLength={200}
                    value={announcement.text}
                    onChange={(e) =>
                      setAnnouncement((prev) => ({ ...prev, text: e.target.value }))
                    }
                    placeholder="Livraison express à Douala & Yaoundé..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-400">
                    Affiché en haut de toutes les pages de votre boutique.
                  </p>
                </div>
              </div>
            )}

            {/* Tab 4: Version History */}
            {activeTab === 'history' && (
              <VersionHistory history={history} onRestore={handleRestoreSnapshot} />
            )}
          </div>
        </aside>

        {/* Right Column: Multi-Device Live Preview Frame (7 cols) */}
        <section className="lg:col-span-8 xl:col-span-8 bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col">
          <DevicePreviewFrame
            themeColor={themeColor}
            sections={sections}
            announcement={announcement}
            storeName={storeName}
            storeSlug={storeSlug}
            sampleProducts={sampleProducts}
            viewport={viewport}
            onChangeViewport={setViewport}
          />
        </section>
      </div>
    </div>
  );
}
