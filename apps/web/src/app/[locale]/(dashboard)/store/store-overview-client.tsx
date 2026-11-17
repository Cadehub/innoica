'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Store,
  ExternalLink,
  Copy,
  Check,
  Paintbrush,
  Settings,
  Share2,
  Package,
  Layers,
  ShoppingBag,
  MessageCircle,
} from 'lucide-react';

interface StoreOverviewClientProps {
  storeSlug: string;
  storeName: string;
  isActive: boolean;
  themeColor: string;
  currency: string;
  productsCount: number;
  categoriesCount: number;
  ordersCount: number;
  publicStoreUrl: string;
  locale: 'fr' | 'en';
}

export function StoreOverviewClient({
  storeSlug,
  storeName,
  isActive,
  themeColor,
  currency,
  productsCount,
  categoriesCount,
  ordersCount,
  publicStoreUrl,
  locale,
}: StoreOverviewClientProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(publicStoreUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = `Découvrez ma boutique en ligne ${storeName} sur INNOICA : ${publicStoreUrl}`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="space-y-6 antialiased">
      {/* Store Link Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Lien public de votre vitrine
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={publicStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm sm:text-base font-black text-zinc-950 hover:underline flex items-center gap-1.5"
              >
                <span>{publicStoreUrl}</span>
                <ExternalLink className="h-4 w-4 text-zinc-400" />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 shadow-2xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copié !' : 'Copier le lien'}</span>
            </button>

            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:brightness-105 shadow-2xs transition-all cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Partager sur WhatsApp</span>
            </a>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-bold uppercase tracking-wider">Produits Actifs</span>
            <Package className="h-4 w-4" />
          </div>
          <p className="text-2xl font-black text-zinc-950">{productsCount}</p>
          <p className="text-[11px] text-zinc-500">Articles en vente dans la boutique</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-bold uppercase tracking-wider">Catégories</span>
            <Layers className="h-4 w-4" />
          </div>
          <p className="text-2xl font-black text-zinc-950">{categoriesCount}</p>
          <p className="text-[11px] text-zinc-500">Rayons de classement actifs</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-bold uppercase tracking-wider">Commandes Enregistrées</span>
            <ShoppingBag className="h-4 w-4" />
          </div>
          <p className="text-2xl font-black text-zinc-950">{ordersCount}</p>
          <p className="text-[11px] text-zinc-500">Total commandes passées sur la boutique</p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/store/builder"
          className="group p-5 rounded-2xl bg-white border border-zinc-200/80 hover:border-zinc-300 shadow-2xs hover:shadow-xs transition-all space-y-2"
        >
          <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
            <Paintbrush className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-zinc-900">Constructeur Visuel</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Personnalisez vos bannières, agencement des sections, couleurs thématiques avec prévisualisation multi-écrans en direct.
          </p>
        </Link>

        <Link
          href="/store/settings"
          className="group p-5 rounded-2xl bg-white border border-zinc-200/80 hover:border-zinc-300 shadow-2xs hover:shadow-xs transition-all space-y-2"
        >
          <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white transition-colors">
            <Settings className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-zinc-900">Paramètres de la Boutique</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Modifiez le nom de votre boutique, l'adresse de votre lien (slug unique) et le statut de publication en ligne.
          </p>
        </Link>
      </div>
    </div>
  );
}
