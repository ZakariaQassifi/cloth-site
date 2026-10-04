/** Wishlist store contract, kept separate from the provider component. */

import { createContext } from 'react';
import type { WishlistEntry } from '../data/wishlist';
import type { Product } from '../data/products';

export interface WishlistContextValue {
  entries: WishlistEntry[];
  /** Number of saved products, used for the header badge. */
  count: number;
  isWishlisted: (productId: string) => boolean;
  add: (product: Product) => void;
  remove: (productId: string) => void;
  /** Add the product when it is not saved, remove it when it is. */
  toggle: (product: Product) => void;
  clear: () => void;
}

export const WishlistContext = createContext<WishlistContextValue | null>(null);