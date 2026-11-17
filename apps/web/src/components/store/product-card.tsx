'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, Check } from 'lucide-react';
import { useCart } from './cart-context';
import { formatPriceXaf } from '@/lib/utils';
import { StockBadge } from './stock-badge';

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  base_price_xaf: number;
  compare_at_price_xaf?: number | null;
  images: string[];
  stock_quantity: number;
  track_stock?: boolean;
  has_variants?: boolean;
  is_featured?: boolean;
  category_name?: string | null;
}

interface ProductCardProps {
  product: ProductCardData;
  storeSlug: string;
  themeColor?: string;
}

export function ProductCard({
  product,
  storeSlug,
  themeColor = '#25D366',
}: ProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = React.useState(false);

  const discountPercent =
    product.compare_at_price_xaf && product.compare_at_price_xaf > product.base_price_xaf
      ? Math.round(
          ((product.compare_at_price_xaf - product.base_price_xaf) /
            product.compare_at_price_xaf) *
            100
        )
      : null;

  const isOutOfStock = product.track_stock && product.stock_quantity <= 0;
  const mainImage = product.images?.[0];

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || product.has_variants) return;

    addItem({
      productId: product.id,
      title: product.title,
      priceXaf: product.base_price_xaf,
      compareAtPriceXaf: product.compare_at_price_xaf,
      image: mainImage,
      stockQuantity: product.stock_quantity,
      quantity: 1,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl bg-white border border-zinc-200/80 shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden">
      <Link
        href={`/store/${storeSlug}/products/${product.slug}`}
        className="flex flex-col flex-1"
      >
        {/* Media Frame */}
        <div className="relative aspect-square w-full bg-zinc-50 overflow-hidden flex items-center justify-center p-3">
          {mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainImage}
              alt={product.title}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-300">
              <ShoppingBag className="h-10 w-10" />
            </div>
          )}

          {/* Badges Overlay */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start z-10">
            {discountPercent && (
              <span className="rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                -{discountPercent}%
              </span>
            )}
          </div>

          <div className="absolute bottom-2 left-2.5 z-10">
            <StockBadge
              quantity={product.stock_quantity}
              trackStock={product.track_stock}
            />
          </div>
        </div>

        {/* Content Box */}
        <div className="p-3 sm:p-4 flex flex-col justify-between flex-1 space-y-2">
          {product.category_name && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">
              {product.category_name}
            </p>
          )}

          <h3 className="text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-zinc-700 line-clamp-2 leading-snug">
            {product.title}
          </h3>

          {/* Price Block */}
          <div className="pt-1 flex items-baseline gap-2 flex-wrap">
            <span className="text-sm sm:text-base font-black text-zinc-950">
              {formatPriceXaf(product.base_price_xaf)}
            </span>
            {product.compare_at_price_xaf &&
              product.compare_at_price_xaf > product.base_price_xaf && (
                <span className="text-xs text-zinc-400 line-through font-medium">
                  {formatPriceXaf(product.compare_at_price_xaf)}
                </span>
              )}
          </div>
        </div>
      </Link>

      {/* Quick Add / Variant Selection CTA */}
      <div className="p-3 pt-0">
        {product.has_variants ? (
          <Link
            href={`/store/${storeSlug}/products/${product.slug}`}
            className="w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs text-white hover:brightness-105 active:scale-98"
            style={{ backgroundColor: themeColor }}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Choisir une option</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={isOutOfStock}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs ${
              isOutOfStock
                ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                : added
                ? 'bg-emerald-600 text-white'
                : 'text-white hover:brightness-105 active:scale-98 cursor-pointer'
            }`}
            style={!isOutOfStock && !added ? { backgroundColor: themeColor } : undefined}
          >
            {added ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Ajouté !</span>
              </>
            ) : isOutOfStock ? (
              <span>Épuisé</span>
            ) : (
              <>
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Ajouter</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
