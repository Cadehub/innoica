'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { X, ShoppingBag, Trash2, Plus, Minus, ArrowRight, ShieldCheck } from 'lucide-react';
import { useCart } from './cart-context';
import { formatPriceXaf } from '@/lib/utils';

interface CartDrawerProps {
  storeSlug: string;
  themeColor?: string;
}

export function CartDrawer({ storeSlug, themeColor = '#25D366' }: CartDrawerProps) {
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotalXaf, totalCount } =
    useCart();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeCart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeCart]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={closeCart}
      />

      {/* Drawer Panel */}
      <aside className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-zinc-200/80 flex items-center justify-between bg-zinc-50/60 shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-zinc-800" />
              <h2 className="text-base font-bold text-zinc-900">Votre Panier</h2>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold text-white shadow-2xs"
                style={{ backgroundColor: themeColor }}
              >
                {totalCount}
              </span>
            </div>
            <button
              type="button"
              onClick={closeCart}
              aria-label="Fermer le panier"
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body: Item List or Empty State */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 studio-scroll">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <h3 className="text-sm font-bold text-zinc-800">Votre panier est vide</h3>
                <p className="text-xs text-zinc-500 max-w-xs">
                  Parcourez notre catalogue et ajoutez vos articles favoris en quelques clics.
                </p>
                <button
                  type="button"
                  onClick={closeCart}
                  className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-transform hover:scale-102"
                  style={{ backgroundColor: themeColor }}
                >
                  Continuer mes achats
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {items.map((item) => (
                  <li key={`${item.productId}-${item.variantId || 'base'}`} className="py-3 flex gap-3">
                    {/* Thumbnail */}
                    <div className="h-18 w-18 rounded-xl bg-zinc-100 border border-zinc-200/80 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-6 w-6 text-zinc-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-zinc-900 line-clamp-1">
                            {item.title}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId, item.variantId)}
                            className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {item.variantTitle && (
                          <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                            {item.variantTitle}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-bold text-zinc-900">
                          {formatPriceXaf(item.priceXaf * item.quantity)}
                        </span>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1 border border-zinc-200 rounded-lg p-0.5 bg-zinc-50">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.productId, item.variantId, item.quantity - 1)
                            }
                            className="h-6 w-6 rounded flex items-center justify-center text-zinc-600 hover:bg-white transition-colors"
                            aria-label="Diminuer la quantité"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-mono font-bold text-zinc-800">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.productId, item.variantId, item.quantity + 1)
                            }
                            className="h-6 w-6 rounded flex items-center justify-center text-zinc-600 hover:bg-white transition-colors"
                            aria-label="Augmenter la quantité"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer Checkout Summary */}
          {items.length > 0 && (
            <div className="p-5 border-t border-zinc-200/80 bg-zinc-50/80 space-y-3 shrink-0">
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>Sous-total articles</span>
                <span className="font-bold text-zinc-900">{formatPriceXaf(subtotalXaf)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>Frais de livraison</span>
                <span>Calculés à la commande</span>
              </div>
              <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-sm font-black text-zinc-900">
                <span>Total estimé</span>
                <span style={{ color: themeColor }}>{formatPriceXaf(subtotalXaf)}</span>
              </div>

              <Link
                href={`/store/${storeSlug}/checkout`}
                onClick={closeCart}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white text-xs sm:text-sm font-bold shadow-md hover:brightness-105 active:scale-98 transition-all"
                style={{ backgroundColor: themeColor }}
              >
                <span>Passer la commande</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Paiement à la livraison ou Mobile Money vérifié</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
