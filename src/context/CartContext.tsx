import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  addCartLine,
  changeCartLineQuantity,
  createCartLine,
  getCartItemCount,
  getCartSubtotal,
  removeCartLine,
  reviveCartLines,
  type CartLine,
} from '../data/cart';
import type { Product } from '../data/products';
import { CartContext, type CartContextValue } from './cartStore';
import { fetchSettings } from '../services/catalogService';

const STORAGE_KEY = 'kinetic_cart';

type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'setQuantity'; cartId: string; delta: number }
  | { type: 'remove'; cartId: string }
  | { type: 'clear' }
  | { type: 'hydrate'; lines: CartLine[] };

function cartReducer(lines: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add':
      return addCartLine(lines, action.line);
    case 'setQuantity':
      return changeCartLineQuantity(lines, action.cartId, action.delta);
    case 'remove':
      return removeCartLine(lines, action.cartId);
    case 'hydrate':
      return action.lines;
    case 'clear':
      return [];
    default:
      return lines;
  }
}

function readStoredCart(): CartLine[] {
  try {
    return reviveCartLines(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

/**
 * Single source of truth for the shopping bag.
 * The same product in a different size or colour becomes a separate line, and
 * the cart survives a page refresh.
 */
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lines, dispatch] = useReducer(cartReducer, undefined, readStoredCart);
  const [shippingConfig, setShippingConfig] = useState<{ flatShippingRate: number; freeShippingThreshold: number | null } | null>(null);

  // Fetch shipping settings on mount
  useEffect(() => {
    const loadShippingConfig = async () => {
      try {
        const res = await fetchSettings();
        if (res.success && res.data) {
          setShippingConfig({
            flatShippingRate: res.data.flatShippingRate ?? 15,
            freeShippingThreshold: res.data.freeShippingThreshold ?? 150,
          });
        }
      } catch {
        console.warn('Failed to load shipping settings');
      }
    };
    loadShippingConfig();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage unavailable (private mode / quota) — cart stays in memory only.
    }
  }, [lines]);

  const addItem = useCallback((product: Product, quantity: number, color: string, size: string) => {
    dispatch({ type: 'add', line: createCartLine(product, quantity, color, size) });
  }, []);

  const updateQuantity = useCallback((cartId: string, delta: number) => {
    dispatch({ type: 'setQuantity', cartId, delta });
  }, []);

  const removeItem = useCallback((cartId: string) => {
    dispatch({ type: 'remove', cartId });
  }, []);

  const clearCart = useCallback(() => dispatch({ type: 'clear' }), []);

  // Calculate shipping based on flat rate + free threshold
  const shipping = useMemo(() => {
    if (!shippingConfig) return 0;
    const subtotal = getCartSubtotal(lines);
    const { flatShippingRate, freeShippingThreshold } = shippingConfig;
    if (freeShippingThreshold !== null && subtotal >= freeShippingThreshold) return 0;
    return flatShippingRate;
  }, [lines, shippingConfig]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: getCartItemCount(lines),
      subtotal: getCartSubtotal(lines),
      shipping,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    }),
    [lines, shipping, addItem, updateQuantity, removeItem, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};