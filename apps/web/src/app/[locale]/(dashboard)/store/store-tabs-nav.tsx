'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Paintbrush,
  Settings,
  ExternalLink,
  Store,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Package,
} from 'lucide-react';

interface StoreTabsNavProps {
  storeSlug: string;
  storeName: string;
  isActive: boolean;
  locale: 'fr' | 'en';
}

export function StoreTabsNav({
  storeSlug,
  storeName,
  isActive,
  locale,
}: StoreTabsNavProps) {
  const pathname = usePathname();

  const tabs = [
    {
      href: '/store',
      label: locale === 'en' ? 'Overview' : "Vue d'ensemble",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: '/store/orders',
      label: locale === 'en' ? 'Orders' : 'Commandes',
      icon: ShoppingBag,
    },
    {
      href: '/store/products',
      label: locale === 'en' ? 'Products' : 'Produits',
      icon: Package,
    },
    {
      href: '/store/builder',
      label: locale === 'en' ? 'Visual Builder' : 'Constructeur Visuel',
      icon: Paintbrush,
    },
    {
      href: '/store/settings',
      label: locale === 'en' ? 'Settings' : 'Paramètres',
      icon: Settings,
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-zinc-900 text-[#25D366] flex items-center justify-center">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <span>{storeName}</span>
              {isActive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  En ligne
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-500 border border-zinc-200">
                  <XCircle className="h-3 w-3" />
                  Hors ligne
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Tabs Bar */}
        <nav className="flex items-center gap-1.5 pt-2 overflow-x-auto pb-1 max-w-full studio-scroll">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isTabActive = tab.exact
              ? pathname === tab.href ||
                pathname === `/fr${tab.href}` ||
                pathname === `/en${tab.href}`
              : pathname.includes(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  isTabActive
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* External Public Storefront Button */}
      {storeSlug && (
        <div className="flex items-center gap-2">
          <a
            href={`/store/${storeSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300 shadow-2xs transition-all cursor-pointer"
          >
            <span>Voir ma boutique</span>
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
          </a>
        </div>
      )}
    </div>
  );
}
