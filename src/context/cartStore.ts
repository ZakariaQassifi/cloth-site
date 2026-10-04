/** Cart store contract, kept separate from the provider component. */

import { createContext } from 'react';
import type { CartLine } from '../data/cart';
import type { Product } from '../data/products';

export interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (product: Product, quantity: number, color: string, size: string) => void;
  updateQuantity: (cartId: string, delta: number) => void;
  removeItem: (cartId: string) => void;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);
