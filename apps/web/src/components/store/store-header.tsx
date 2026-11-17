'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, ShoppingBag } from 'lucide-react';
import { CartBadgeButton } from './cart-badge-button';

interface StoreHeaderProps {
  storeSlug: string;
  storeName: string;
  logoUrl?: string | null;
  themeColor?: string;
}

export function StoreHeader({
  storeSlug,
  storeName,
  logoUrl,
  themeColor = '#25D366',
}: StoreHeaderProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/store/${storeSlug}/catalog?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-zinc-200/80 shadow-2xs antialiased">
      <div className="max-w-7xl 2xl:max-w-(--breakpoint-2xl) mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 h-16 flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link
            href={`/store/${storeSlug}`}
            className="flex items-center gap-2.5 min-w-0 group"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={storeName}
                className="h-9 w-9 rounded-xl object-contain border border-zinc-200/80 shrink-0"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-2xs"
                style={{ backgroundColor: themeColor }}
              >
                {storeName ? storeName.charAt(0).toUpperCase() : 'B'}
              </div>
            )}
            <span className="font-black text-base sm:text-lg text-zinc-950 truncate tracking-tight group-hover:text-zinc-700 transition-colors">
              {storeName}
            </span>
          </Link>
        </div>

        {/* Center: Search Bar (Desktop) */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-md mx-4 relative"
        >
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Rechercher un produit, une référence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-zinc-100 border border-transparent placeholder:text-zinc-400 focus:bg-white focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all"
          />
        </form>

        {/* Right: Desktop Links & Cart Badge */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-zinc-600">
            <Link
              href={`/store/${storeSlug}`}
              className="hover:text-zinc-950 transition-colors"
            >
              Accueil
            </Link>
            <Link
              href={`/store/${storeSlug}/catalog`}
              className="hover:text-zinc-950 transition-colors"
            >
              Catalogue
            </Link>
            <Link
              href={`/store/${storeSlug}#about`}
              className="hover:text-zinc-950 transition-colors"
            >
              À propos
            </Link>
          </nav>

          <CartBadgeButton themeColor={themeColor} />
        </div>
      </div>

      {/* Mobile Drawer Navigation & Search */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-200/80 bg-white p-4 space-y-4 animate-fade-in shadow-lg">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-zinc-100 border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </form>

          <nav className="flex flex-col space-y-1 text-xs font-bold text-zinc-700">
            <Link
              href={`/store/${storeSlug}`}
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Accueil
            </Link>
            <Link
              href={`/store/${storeSlug}/catalog`}
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Catalogue complet
            </Link>
            <Link
              href={`/store/${storeSlug}#about`}
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              À propos
            </Link>
            <Link
              href={`/store/${storeSlug}/checkout`}
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center justify-between"
            >
              <span>Valider ma commande</span>
              <ShoppingBag className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
