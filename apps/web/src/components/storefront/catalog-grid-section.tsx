'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, SlidersHorizontal, Search } from 'lucide-react';
import { ProductCard, ProductCardData } from '@/components/store/product-card';
import { sanitizeText } from '@/lib/sanitize-builder';

export interface CatalogGridSettings {
  title?: string;
  subtitle?: string;
  columnsCount?: number;
  itemsLimit?: number;
  showCategoriesFilter?: boolean;
}

interface CategoryFilterItem {
  id: string;
  slug: string;
  name: string;
}

interface CatalogGridSectionProps {
  settings?: CatalogGridSettings;
  products?: ProductCardData[];
  categories?: CategoryFilterItem[];
  storeSlug: string;
  themeColor?: string;
}

export function CatalogGridSection({
  settings = {},
  products = [],
  categories = [],
  storeSlug,
  themeColor = '#25D366',
}: CatalogGridSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const title = sanitizeText(settings.title || 'Nos Produits');
  const subtitle = sanitizeText(settings.subtitle || 'Sélectionnés avec soin pour vous');
  const itemsLimit = settings.itemsLimit || 12;

  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory !== 'all') {
      result = result.filter(
        (p) => p.category_name?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => p.title.toLowerCase().includes(q));
    }

    return result.slice(0, itemsLimit);
  }, [products, selectedCategory, searchQuery, itemsLimit]);

  return (
    <section className="px-3 sm:px-4 md:px-6 my-8 max-w-7xl mx-auto" id="catalog">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">{subtitle}</p>
        </div>

        <Link
          href={`/store/${storeSlug}/catalog`}
          className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
          style={{ color: themeColor }}
        >
          <span>Voir tout le catalogue</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Category Pills & Search */}
      {(settings.showCategoriesFilter !== false || categories.length > 0) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          {/* Category Horizontal Scroll Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 studio-scroll">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'text-white shadow-2xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80'
              }`}
              style={selectedCategory === 'all' ? { backgroundColor: themeColor } : undefined}
            >
              Tous les articles
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                  selectedCategory.toLowerCase() === cat.name.toLowerCase()
                    ? 'text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80'
                }`}
                style={
                  selectedCategory.toLowerCase() === cat.name.toLowerCase()
                    ? { backgroundColor: themeColor }
                    : undefined
                }
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Inline Quick Search */}
          <div className="relative w-full sm:w-60 shrink-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-all"
            />
          </div>
        </div>
      )}

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="py-12 px-4 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 text-center space-y-2">
          <p className="text-sm font-bold text-zinc-700">Aucun produit trouvé</p>
          <p className="text-xs text-zinc-400">
            Essayez de modifier vos filtres ou effectuez une autre recherche.
          </p>
          {(selectedCategory !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-2 text-xs font-bold underline"
              style={{ color: themeColor }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              storeSlug={storeSlug}
              themeColor={themeColor}
            />
          ))}
        </div>
      )}
    </section>
  );
}
