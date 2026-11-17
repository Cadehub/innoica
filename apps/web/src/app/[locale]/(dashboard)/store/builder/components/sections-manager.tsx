'use client';

import React from 'react';
import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
  LayoutGrid,
  ShieldCheck,
  Store,
  PanelBottom,
  Sliders,
} from 'lucide-react';
import { StoreBuilderSection } from '@innoica/shared';

interface SectionsManagerProps {
  sections: StoreBuilderSection[];
  onReorder: (newSections: StoreBuilderSection[]) => void;
  onToggleVisibility: (sectionId: string) => void;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
}

function getSectionMeta(type: string) {
  switch (type) {
    case 'hero':
      return {
        label: 'Bannière Héro & Promos',
        icon: Sparkles,
        description: 'Titre principal, accroche, badge et bouton d’action',
      };
    case 'features_banner':
      return {
        label: 'Garanties & Confiance (Oraimo)',
        icon: ShieldCheck,
        description: 'Livraison 24h, authenticité, Mobile Money, WhatsApp',
      };
    case 'catalog_grid':
      return {
        label: 'Grille de Produits & Filtres',
        icon: LayoutGrid,
        description: 'Affichage des articles par catégories avec recherche',
      };
    case 'about':
      return {
        label: 'À Propos & Présentation',
        icon: Store,
        description: 'Histoire de votre boutique, localisation et contact',
      };
    case 'footer':
      return {
        label: 'Pied de Page Boutique',
        icon: PanelBottom,
        description: 'Informations de contact, horaires et copyright',
      };
    default:
      return {
        label: type,
        icon: Sliders,
        description: 'Section personnalisée',
      };
  }
}

export function SectionsManager({
  sections,
  onReorder,
  onToggleVisibility,
  selectedSectionId,
  onSelectSection,
}: SectionsManagerProps) {
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = [...sections];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;

    // Reassign order 0..N
    const updated = reordered.map((sec, i) => ({ ...sec, order: i }));
    onReorder(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= sections.length - 1) return;
    const reordered = [...sections];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;

    const updated = reordered.map((sec, i) => ({ ...sec, order: i }));
    onReorder(updated);
  };

  return (
    <div className="space-y-3 antialiased">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-800">
          Agencement des Sections ({sections.length})
        </label>
        <span className="text-[10px] text-zinc-400">Cliquez pour modifier</span>
      </div>

      <div className="space-y-2">
        {sections.map((sec, index) => {
          const meta = getSectionMeta(sec.type);
          const Icon = meta.icon;
          const isSelected = selectedSectionId === sec.id;

          return (
            <div
              key={sec.id}
              onClick={() => onSelectSection(sec.id)}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                isSelected
                  ? 'border-zinc-950 bg-zinc-900 text-white shadow-xs'
                  : sec.visible
                  ? 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-800'
                  : 'border-zinc-200 bg-zinc-100/70 text-zinc-400 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-zinc-800 text-[#25D366]'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate leading-tight">{meta.label}</p>
                  <p
                    className={`text-[10px] truncate ${
                      isSelected ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    {meta.description}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Visibility toggle and Reorder arrows */}
              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Visibility */}
                <button
                  type="button"
                  onClick={() => onToggleVisibility(sec.id)}
                  title={sec.visible ? 'Masquer cette section' : 'Afficher cette section'}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'hover:bg-zinc-800 text-zinc-300'
                      : 'hover:bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {sec.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>

                {/* Move Up */}
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  title="Monter"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-20 ${
                    isSelected
                      ? 'hover:bg-zinc-800 text-zinc-300'
                      : 'hover:bg-zinc-100 text-zinc-500'
                  }`}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>

                {/* Move Down */}
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === sections.length - 1}
                  title="Descendre"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-20 ${
                    isSelected
                      ? 'hover:bg-zinc-800 text-zinc-300'
                      : 'hover:bg-zinc-100 text-zinc-500'
                  }`}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
