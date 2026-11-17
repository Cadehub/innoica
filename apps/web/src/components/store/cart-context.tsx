'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';

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
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number; openDrawer?: boolean }) => void;
  updateQuantity: (productId: string, variantId: string | null | undefined, quantity: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getOrCreateCartToken(storeSlug: string): string {
  if (typeof window === 'undefined') return '';
  const storageKey = `innoica_cart_token_${storeSlug}`;
  let token = localStorage.getItem(storageKey);
  if (!token || !UUID_REGEX.test(token)) {
    token = crypto.randomUUID();
    localStorage.setItem(storageKey, token);
  }
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
  const tokenRef = useRef<string>('');

  const itemsStorageKey = `innoica_cart_items_${storeSlug}`;

  // Initialisation côté client + synchronisation Supabase Cart API
  useEffect(() => {
    let active = true;
    try {
      const token = getOrCreateCartToken(storeSlug);
      tokenRef.current = token;
      setCartToken(token);

      const saved = localStorage.getItem(itemsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }

      if (storeSlug && storeSlug !== 'preview' && token) {
        fetch(`/api/store/${encodeURIComponent(storeSlug)}/cart?cartToken=${encodeURIComponent(token)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!active || !data?.success || !Array.isArray(data.items)) return;
            if (data.items.length > 0) {
              setItems(data.items);
            }
          })
          .catch(() => {
            // Keep localStorage fallback silently
          });
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      setIsHydrated(true);
    }
    return () => {
      active = false;
    };
  }, [storeSlug, itemsStorageKey]);

  // Sauvegarde locale des articles à chaque mutation
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

  const syncCartMutation = (method: 'POST' | 'PATCH' | 'DELETE', payload?: Record<string, unknown>) => {
    if (!storeSlug || storeSlug === 'preview') return;
    const token = tokenRef.current || cartToken;
    if (!token) return;

    if (method === 'DELETE') {
      const qs = new URLSearchParams({ cartToken: token });
      if (payload?.productId) qs.set('productId', String(payload.productId));
      if (payload?.variantId) qs.set('variantId', String(payload.variantId));
      fetch(`/api/store/${encodeURIComponent(storeSlug)}/cart?${qs.toString()}`, {
        method: 'DELETE',
      }).catch(() => {});
      return;
    }

    fetch(`/api/store/${encodeURIComponent(storeSlug)}/cart`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, cartToken: token }),
    }).catch(() => {});
  };

  const addItem = (
    newItem: Omit<CartItem, 'quantity'> & { quantity?: number; openDrawer?: boolean }
  ) => {
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

    if (UUID_REGEX.test(newItem.productId)) {
      syncCartMutation('POST', {
        productId: newItem.productId,
        variantId: newItem.variantId || null,
        quantity: qty,
      });
    }

    if (newItem.openDrawer !== false) {
      setIsOpen(true);
    }
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

    if (UUID_REGEX.test(productId)) {
      syncCartMutation('PATCH', {
        productId,
        variantId: variantId || null,
        quantity,
      });
    }
  };

  const removeItem = (productId: string, variantId?: string | null) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.productId === productId && item.variantId === (variantId || null))
      )
    );

    if (UUID_REGEX.test(productId)) {
      syncCartMutation('DELETE', {
        productId,
        variantId: variantId || null,
      });
    }
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(itemsStorageKey);
    } catch {
      // Ignore
    }
    syncCartMutation('DELETE');
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
