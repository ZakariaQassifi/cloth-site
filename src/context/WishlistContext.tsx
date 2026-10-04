import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  addWishlistEntry,
  createWishlistEntry,
  getWishlistCount,
  isProductWishlisted,
  removeWishlistEntry,
  reviveWishlist,
  type WishlistEntry,
} from '../data/wishlist';
import type { Product } from '../data/products';
import { WishlistContext, type WishlistContextValue } from './wishlistStore';

const STORAGE_KEY = 'kinetic_wishlist';

type WishlistAction =
  | { type: 'add'; entry: WishlistEntry }
  | { type: 'remove'; productId: string }
  | { type: 'toggle'; product: Product }
  | { type: 'clear' };

function wishlistReducer(entries: WishlistEntry[], action: WishlistAction): WishlistEntry[] {
  switch (action.type) {
    case 'add':
      return addWishlistEntry(entries, action.entry);
    case 'remove':
      return removeWishlistEntry(entries, action.productId);
    case 'toggle':
      return isProductWishlisted(entries, action.product.id)
        ? removeWishlistEntry(entries, action.product.id)
        : addWishlistEntry(entries, createWishlistEntry(action.product));
    case 'clear':
      return [];
    default:
      return entries;
  }
}

function readStoredWishlist(): WishlistEntry[] {
  try {
    return reviveWishlist(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

/**
 * Single source of truth for saved products.
 *
 * A product can only be saved once, and the wishlist survives a page refresh
 * because every change is mirrored into localStorage.
 */
export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, dispatch] = useReducer(wishlistReducer, undefined, readStoredWishlist);

  const hasMounted = useRef(false);
  useEffect(() => {
    // Skip the first pass: writing then would replace a stored wishlist with
    // the reducer's initial state before hydration has settled.
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage unavailable (private mode / quota) — wishlist stays in memory only.
    }
  }, [entries]);

  const add = useCallback(
    (product: Product) => dispatch({ type: 'add', entry: createWishlistEntry(product) }),
    []
  );

  const remove = useCallback(
    (productId: string) => dispatch({ type: 'remove', productId }),
    []
  );

  const toggle = useCallback(
    (product: Product) => dispatch({ type: 'toggle', product }),
    []
  );

  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const isWishlisted = useCallback(
    (productId: string) => isProductWishlisted(entries, productId),
    [entries]
  );

  const value = useMemo<WishlistContextValue>(
    () => ({ entries, count: getWishlistCount(entries), isWishlisted, add, remove, toggle, clear }),
    [entries, isWishlisted, add, remove, toggle, clear]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};