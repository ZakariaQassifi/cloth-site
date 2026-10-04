/** Wishlist consumer hook. */

import { useContext } from 'react';
import { WishlistContext, type WishlistContextValue } from './wishlistStore';

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
  return context;
}