'use client';

import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from './cart-context';

interface CartBadgeButtonProps {
  themeColor?: string;
}

export function CartBadgeButton({ themeColor = '#25D366' }: CartBadgeButtonProps) {
  const { totalCount, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Ouvrir le panier (${totalCount} articles)`}
      className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 transition-colors cursor-pointer select-none"
    >
      <ShoppingBag className="h-5 w-5" />
      {totalCount > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-white text-[11px] font-black flex items-center justify-center shadow-md animate-fade-in"
          style={{ backgroundColor: themeColor }}
        >
          {totalCount > 99 ? '99+' : totalCount}
        </span>
      )}
    </button>
  );
}
