'use client';

import React, { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, X, PackageOpen } from 'lucide-react';
import { ProductCard, ProductCardData } from '@/components/store/product-card';
import { formatPriceXaf } from '@/lib/utils';

interface CategoryItem {
  id: string;
  slug: string;
  name: string;
}

interface CatalogClientProps {
  initialProducts: ProductCardData[];
  categories: CategoryItem[];
  storeSlug: string;
  themeColor?: string;
  initialQuery?: string;
  initialCategory?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
  initialSort?: string;
  initialInStockOnly?: boolean;
}

export function CatalogClient({
  initialProducts,
  categories,
  storeSlug,
  themeColor = '#25D366',
  initialQuery = '',
  initialCategory = 'all',
  initialMinPrice = '',
  initialMaxPrice = '',
  initialSort = 'popular',
  initialInStockOnly = false,
}: CatalogClientProps) {
  const matchedCategory =
    initialCategory !== 'all'
      ? categories.find(
          (c) =>
            c.slug.toLowerCase() === initialCategory.toLowerCase() ||
            c.name.toLowerCase() === initialCategory.toLowerCase()
        )?.name || initialCategory
      : 'all';

  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(matchedCategory);
  const [sortOption, setSortOption] = useState<'popular' | 'price_asc' | 'price_desc' | 'newest'>(
    (['popular', 'price_asc', 'price_desc', 'newest'].includes(initialSort)
      ? initialSort
      : 'popular') as any
  );
  const [inStockOnly, setInStockOnly] = useState<boolean>(initialInStockOnly);
  const [pricePreset, setPricePreset] = useState<'all' | 'under10k' | '10k-25k' | '25k-50k' | 'above50k'>('all');
  const [minPrice, setMinPrice] = useState<string>(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState<string>(initialMaxPrice);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filteredAndSorted = useMemo(() => {
    let list = [...initialProducts];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => p.title.toLowerCase().includes(q));
    }

    // Category filter
    if (selectedCategory !== 'all') {
      list = list.filter(
        (p) => p.category_name?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // In-stock filter
    if (inStockOnly) {
      list = list.filter((p) => !p.track_stock || p.stock_quantity > 0);
    }

    // Price presets
    if (pricePreset === 'under10k') {
      list = list.filter((p) => p.base_price_xaf < 10000);
    } else if (pricePreset === '10k-25k') {
      list = list.filter((p) => p.base_price_xaf >= 10000 && p.base_price_xaf <= 25000);
    } else if (pricePreset === '25k-50k') {
      list = list.filter((p) => p.base_price_xaf > 25000 && p.base_price_xaf <= 50000);
    } else if (pricePreset === 'above50k') {
      list = list.filter((p) => p.base_price_xaf > 50000);
    }

    // Custom min/max FCFA range
    const parsedMin = minPrice.trim() ? Number(minPrice) : null;
    const parsedMax = maxPrice.trim() ? Number(maxPrice) : null;
    if (parsedMin !== null && !Number.isNaN(parsedMin)) {
      list = list.filter((p) => p.base_price_xaf >= parsedMin);
    }
    if (parsedMax !== null && !Number.isNaN(parsedMax)) {
      list = list.filter((p) => p.base_price_xaf <= parsedMax);
    }

    // Sort
    switch (sortOption) {
      case 'price_asc':
        list.sort((a, b) => a.base_price_xaf - b.base_price_xaf);
        break;
      case 'price_desc':
        list.sort((a, b) => b.base_price_xaf - a.base_price_xaf);
        break;
      case 'newest':
        // Keep initial desc order or reverse
        break;
      case 'popular':
      default:
        // featured first
        list.sort((a, b) => (b.track_stock ? 1 : 0) - (a.track_stock ? 1 : 0));
        break;
    }

    return list;
  }, [initialProducts, search, selectedCategory, inStockOnly, pricePreset, minPrice, maxPrice, sortOption]);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSortOption('popular');
    setInStockOnly(false);
    setPricePreset('all');
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 antialiased">
      {/* Top Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            Catalogue de Produits
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {filteredAndSorted.length} article{filteredAndSorted.length > 1 ? 's' : ''} disponible{filteredAndSorted.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-zinc-200 bg-white text-zinc-700 focus:outline-none cursor-pointer"
            >
              <option value="popular">Trier : Populaires</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
              <option value="newest">Nouveautés</option>
            </select>
          </div>

          {/* Mobile Filter Toggle */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="md:hidden p-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            aria-label="Filtres"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar Filters */}
        <aside className="hidden md:block w-60 shrink-0 space-y-6">
          {/* Categories */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              Catégories
            </h2>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'font-bold bg-zinc-100 text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                Tous les articles
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedCategory.toLowerCase() === cat.name.toLowerCase()
                      ? 'font-bold bg-zinc-100 text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Presets */}
          <div className="space-y-2 border-t border-zinc-200/80 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              Fourchette de Prix
            </h2>
            <div className="space-y-1">
              {[
                { key: 'all', label: 'Tous les prix' },
                { key: 'under10k', label: 'Moins de 10 000 FCFA' },
                { key: '10k-25k', label: '10 000 - 25 000 FCFA' },
                { key: '25k-50k', label: '25 000 - 50 000 FCFA' },
                { key: 'above50k', label: 'Plus de 50 000 FCFA' },
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPricePreset(p.key as any)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pricePreset === p.key
                      ? 'font-bold bg-zinc-100 text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <input
                type="number"
                min={0}
                placeholder="Min FCFA"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
              <input
                type="number"
                min={0}
                placeholder="Max FCFA"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
              />
            </div>
          </div>

          {/* Availability */}
          <div className="space-y-2 border-t border-zinc-200/80 pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              Disponibilité
            </h2>
            <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>En stock uniquement</span>
            </label>
          </div>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={resetFilters}
            className="w-full py-2 px-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Réinitialiser les filtres
          </button>
        </aside>

        {/* Product Grid Area */}
        <div className="flex-1 min-w-0">
          {filteredAndSorted.length === 0 ? (
            <div className="py-16 px-4 rounded-2xl bg-white border border-dashed border-zinc-200 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-zinc-100 mx-auto flex items-center justify-center text-zinc-400">
                <PackageOpen className="h-7 w-7" />
              </div>
              <h2 className="text-sm font-bold text-zinc-800">Aucun produit ne correspond</h2>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Aucun article ne correspond à vos critères de recherche actuels.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs"
                style={{ backgroundColor: themeColor }}
              >
                Afficher tous les articles
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredAndSorted.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  storeSlug={storeSlug}
                  themeColor={themeColor}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filters Drawer Modal */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-xs md:hidden animate-fade-in">
          <div className="w-full max-w-xs bg-white h-full p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <h3 className="font-bold text-sm text-zinc-900">Filtres</h3>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-zinc-900">Catégories</h4>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs ${
                      selectedCategory === 'all' ? 'font-bold bg-zinc-100' : 'text-zinc-600'
                    }`}
                  >
                    Tous les articles
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCategory(c.name)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs ${
                        selectedCategory === c.name ? 'font-bold bg-zinc-100' : 'text-zinc-600'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div className="space-y-2 border-t border-zinc-100 pt-4">
                <h4 className="text-xs font-bold uppercase text-zinc-900">Prix</h4>
                <div className="space-y-1">
                  {[
                    { key: 'all', label: 'Tous les prix' },
                    { key: 'under10k', label: '< 10 000 FCFA' },
                    { key: '10k-25k', label: '10 000 - 25 000 FCFA' },
                    { key: '25k-50k', label: '25 000 - 50 000 FCFA' },
                    { key: 'above50k', label: '> 50 000 FCFA' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPricePreset(p.key as any)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs ${
                        pricePreset === p.key ? 'font-bold bg-zinc-100' : 'text-zinc-600'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 space-y-2">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full py-2.5 rounded-xl text-white text-xs font-bold"
                style={{ backgroundColor: themeColor }}
              >
                Appliquer ({filteredAndSorted.length})
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="w-full py-2 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
