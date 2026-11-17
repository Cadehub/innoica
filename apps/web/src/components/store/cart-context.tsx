'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export interface CartItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  title: string;
  variantTitle?: string | null;
  priceXaf: number;
  compareAtPriceXaf?: number | null;
  image?: string;
  stockQuantity: number;
}

interface CartContextValue {
  items: CartItem[];
  totalCount: number;
  subtotalXaf: number;
  cartToken: string;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  updateQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function getOrCreateCartToken(storeSlug: string): string {
  if (typeof window === 'undefined') return '';
  const storageKey = `innoica_cart_token_${storeSlug}`;
  let token = localStorage.getItem(storageKey);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(storageKey, token);
  }
  // Synchronise also in cookie for 30 days
  document.cookie = `innoica_cart_${storeSlug}=${token}; path=/; max-age=2592000; SameSite=Lax`;
  return token;
}

export function CartProvider({
  children,
  storeSlug,
}: {
  children: React.ReactNode;
  storeSlug: string;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [cartToken, setCartToken] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState(false);

  const itemsStorageKey = `innoica_cart_items_${storeSlug}`;

  // Initialisation au montage côté client
  useEffect(() => {
    try {
      const token = getOrCreateCartToken(storeSlug);
      setCartToken(token);

      const saved = localStorage.getItem(itemsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      setIsHydrated(true);
    }
  }, [storeSlug, itemsStorageKey]);

  // Sauvegarde des articles à chaque mutation
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(itemsStorageKey, JSON.stringify(items));
    } catch {
      // Ignore quota exceeded
    }
  }, [items, isHydrated, itemsStorageKey]);

  const totalCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotalXaf = useMemo(
    () => items.reduce((sum, item) => sum + item.priceXaf * item.quantity, 0),
    [items]
  );

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen((prev) => !prev);

  const addItem = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    const qty = newItem.quantity || 1;
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (it) => it.productId === newItem.productId && it.variantId === (newItem.variantId || null)
      );

      if (existingIndex > -1) {
        const updated = [...prevItems];
        const currentQty = updated[existingIndex].quantity;
        const maxStock = updated[existingIndex].stockQuantity;
        const newQty = Math.min(currentQty + qty, maxStock > 0 ? maxStock : currentQty + qty);
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }

      return [
        ...prevItems,
        {
          productId: newItem.productId,
          variantId: newItem.variantId || null,
          quantity: qty,
          title: newItem.title,
          variantTitle: newItem.variantTitle || null,
          priceXaf: newItem.priceXaf,
          compareAtPriceXaf: newItem.compareAtPriceXaf || null,
          image: newItem.image,
          stockQuantity: newItem.stockQuantity,
        },
      ];
    });

    setIsOpen(true);
  };

  const updateQuantity = (
    productId: string,
    variantId: string | null | undefined,
    quantity: number
  ) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.productId === productId && item.variantId === (variantId || null)) {
          const maxStock = item.stockQuantity;
          const cappedQty = maxStock > 0 ? Math.min(quantity, maxStock) : quantity;
          return { ...item, quantity: cappedQty };
        }
        return item;
      })
    );
  };

  const removeItem = (productId: string, variantId?: string | null) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.productId === productId && item.variantId === (variantId || null))
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(itemsStorageKey);
    } catch {
      // Ignore
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        totalCount,
        subtotalXaf,
        cartToken,
        isOpen,
        openCart,
        closeCart,
        toggleCart,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé à l’intérieur d’un CartProvider');
  }
  return context;
}
