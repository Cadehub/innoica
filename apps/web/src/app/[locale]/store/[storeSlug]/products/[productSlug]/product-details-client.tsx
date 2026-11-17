'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  MessageCircle,
  Check,
  ChevronRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  Plus,
  Minus,
  Sparkles,
  Share2,
} from 'lucide-react';
import { useCart } from '@/components/store/cart-context';
import { formatPriceXaf } from '@/lib/utils';
import { StockBadge } from '@/components/store/stock-badge';

export interface ProductVariantItem {
  id: string;
  title: string;
  sku?: string | null;
  price_xaf: number;
  stock_quantity: number;
  track_stock?: boolean;
  attributes: Record<string, string>;
  is_active: boolean;
}

export interface ProductDetailsData {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  base_price_xaf: number;
  compare_at_price_xaf?: number | null;
  images: string[];
  sku?: string | null;
  stock_quantity: number;
  track_stock: boolean;
  has_variants: boolean;
  category_name?: string | null;
  category_slug?: string | null;
  variants: ProductVariantItem[];
}

interface ProductDetailsClientProps {
  product: ProductDetailsData;
  storeSlug: string;
  storeName: string;
  merchantWhatsAppPhone?: string | null;
  themeColor?: string;
}

export function ProductDetailsClient({
  product,
  storeSlug,
  storeName,
  merchantWhatsAppPhone = '',
  themeColor = '#25D366',
}: ProductDetailsClientProps) {
  const router = useRouter();
  const { addItem, closeCart } = useCart();

  // Active image
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Active variant (auto-select first in-stock variant if available)
  const activeVariants = (product.variants || []).filter((v) => v.is_active);
  const firstInStockVariant =
    activeVariants.find((v) => {
      const vTrackStock = v.track_stock ?? product.track_stock;
      return !vTrackStock || v.stock_quantity > 0;
    }) || activeVariants[0] || null;

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    firstInStockVariant ? firstInStockVariant.id : null
  );

  const selectedVariant = activeVariants.find((v) => v.id === selectedVariantId) || null;

  // Active pricing & stock (respect variant-level track_stock)
  const currentPrice = selectedVariant ? selectedVariant.price_xaf : product.base_price_xaf;
  const currentStock = selectedVariant ? selectedVariant.stock_quantity : product.stock_quantity;
  const currentTrackStock = selectedVariant
    ? (selectedVariant.track_stock ?? product.track_stock)
    : product.track_stock;
  const isOutOfStock = currentTrackStock && currentStock <= 0;

  // Quantity stepper
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const images = product.images && product.images.length > 0 ? product.images : [];
  const currentImage = images[activeImageIndex] || null;

  const discountPercent =
    product.compare_at_price_xaf && product.compare_at_price_xaf > currentPrice
      ? Math.round(((product.compare_at_price_xaf - currentPrice) / product.compare_at_price_xaf) * 100)
      : null;

  const handleAddToCart = (openDrawer: boolean = true) => {
    if (isOutOfStock) return;

    addItem({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      title: product.title,
      variantTitle: selectedVariant?.title || null,
      priceXaf: currentPrice,
      compareAtPriceXaf: product.compare_at_price_xaf,
      image: currentImage || undefined,
      stockQuantity: currentStock,
      quantity,
      openDrawer,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    handleAddToCart(false);
    closeCart();
    router.push(`/store/${storeSlug}/checkout`);
  };

  // Direct WhatsApp pre-filled order URL
  const cleanPhone = (merchantWhatsAppPhone || '').replace(/\D/g, '');
  const variantText = selectedVariant ? ` (Variante: ${selectedVariant.title})` : '';
  const waMessage = `Bonjour ${storeName}, je souhaite commander : ${product.title}${variantText} à ${formatPriceXaf(
    currentPrice
  )} sur votre boutique. Est-il disponible ?`;
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 antialiased">
      {/* Breadcrumbs */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-zinc-500 mb-6 flex-wrap">
        <Link href={`/store/${storeSlug}`} className="hover:text-zinc-900 transition-colors">
          Accueil
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <Link href={`/store/${storeSlug}/catalog`} className="hover:text-zinc-900 transition-colors">
          Catalogue
        </Link>
        {product.category_name && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-600">{product.category_name}</span>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span className="font-bold text-zinc-900 truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main PDP Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Image Gallery (5 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Main Viewport */}
          <div className="relative aspect-square w-full rounded-3xl bg-white border border-zinc-200/80 shadow-xs overflow-hidden flex items-center justify-center p-6">
            {currentImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImage}
                alt={product.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-300">
                <ShoppingBag className="h-16 w-16" />
                <span className="text-xs text-zinc-400 mt-2">Aucune image disponible</span>
              </div>
            )}

            {discountPercent && (
              <span className="absolute top-4 left-4 rounded-xl px-2.5 py-1 text-xs font-black uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                -{discountPercent}%
              </span>
            )}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 studio-scroll">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative h-18 w-18 rounded-2xl border-2 overflow-hidden bg-white shrink-0 p-1 cursor-pointer transition-all ${
                    activeImageIndex === idx
                      ? 'border-zinc-900 shadow-xs scale-102'
                      : 'border-zinc-200 hover:border-zinc-300 opacity-70'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Info & Purchase Box (7 cols) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-2">
            {product.category_name && (
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {product.category_name}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight leading-tight">
              {product.title}
            </h1>
            {product.sku && (
              <p className="text-xs text-zinc-400 font-mono">Réf / SKU : {product.sku}</p>
            )}
          </div>

          {/* Price Block */}
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-baseline justify-between flex-wrap gap-2">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-zinc-950">
                {formatPriceXaf(currentPrice)}
              </span>
              {product.compare_at_price_xaf && product.compare_at_price_xaf > currentPrice && (
                <span className="text-sm text-zinc-400 line-through font-semibold">
                  {formatPriceXaf(product.compare_at_price_xaf)}
                </span>
              )}
            </div>

            <StockBadge quantity={currentStock} trackStock={currentTrackStock} />
          </div>

          {/* Variants Selector */}
          {activeVariants.length > 0 && (
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Sélectionner une option :
              </label>
              <div className="flex flex-wrap gap-2">
                {activeVariants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  const variantTrackStock = v.track_stock ?? product.track_stock;
                  const variantOutOfStock = variantTrackStock && v.stock_quantity <= 0;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={variantOutOfStock}
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        setQuantity(1);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        isSelected
                          ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                          : variantOutOfStock
                          ? 'border-zinc-200 bg-zinc-100 text-zinc-400 line-through cursor-not-allowed'
                          : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400'
                      }`}
                    >
                      {v.title} — {formatPriceXaf(v.price_xaf)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity & CTA Buttons */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              {/* Stepper */}
              <div className="flex items-center border border-zinc-300 rounded-xl bg-white p-1">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                  aria-label="Diminuer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-mono font-bold text-sm text-zinc-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) =>
                      currentTrackStock && currentStock > 0 ? Math.min(currentStock, q + 1) : q + 1
                    )
                  }
                  disabled={isOutOfStock || (currentTrackStock && currentStock > 0 && quantity >= currentStock)}
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 cursor-pointer"
                  aria-label="Augmenter"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={() => handleAddToCart(true)}
                disabled={isOutOfStock}
                className={`flex-1 py-3 px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
                  isOutOfStock
                    ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                    : added
                    ? 'bg-emerald-600 text-white'
                    : 'text-white hover:brightness-105 active:scale-98 cursor-pointer'
                }`}
                style={!isOutOfStock && !added ? { backgroundColor: themeColor } : undefined}
              >
                {added ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Ajouté au panier !</span>
                  </>
                ) : isOutOfStock ? (
                  <span>Produit épuisé</span>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    <span>Ajouter au panier</span>
                  </>
                )}
              </button>
            </div>

            {/* Direct WhatsApp Ordering Button (Oraimo benchmark) */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold bg-[#25D366] text-white flex items-center justify-center gap-2 shadow-sm hover:brightness-105 active:scale-98 transition-all cursor-pointer"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Commander directement via WhatsApp</span>
            </a>

            {/* Buy now direct */}
            {!isOutOfStock && (
              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold border border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Acheter maintenant (Paiement à la livraison)
              </button>
            )}
          </div>

          {/* Trust Guarantees */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-200 text-xs text-zinc-600">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
              <Truck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Livraison express à domicile</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
              <span>Paiement sécurisé ou cash</span>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-2 pt-4 border-t border-zinc-200">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                Description du Produit
              </h2>
              <div className="text-xs sm:text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
