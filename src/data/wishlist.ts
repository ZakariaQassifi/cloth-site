/**
 * Wishlist domain model — pure, centralised wishlist operations.
 *
 * Mirrors the cart's approach: every entry keeps a snapshot of the product, so a
 * saved wishlist still renders after a page refresh (or before the catalogue has
 * finished loading). The wishlist page reconciles each entry against the live
 * catalogue when it is available, so prices and availability stay truthful.
 */

import {
  getProductColors,
  getProductSizes,
  getVariantStock,
  type Product,
} from './products';

export interface WishlistEntry {
  /** A product can only be saved once. */
  productId: string;
  /** ISO timestamp, used to keep the most recently saved item first. */
  addedAt: string;
  /** Snapshot of the product at the time it was saved. */
  product: Product;
}

export function createWishlistEntry(product: Product): WishlistEntry {
  return { productId: product.id, addedAt: new Date().toISOString(), product };
}

export function addWishlistEntry(entries: WishlistEntry[], entry: WishlistEntry): WishlistEntry[] {
  // Re-adding an existing product refreshes its snapshot and moves it to the top
  // instead of creating a duplicate.
  const rest = entries.filter((item) => item.productId !== entry.productId);
  return [entry, ...rest];
}

export function removeWishlistEntry(entries: WishlistEntry[], productId: string): WishlistEntry[] {
  return entries.filter((item) => item.productId !== productId);
}

/** Add the product when absent, remove it when present. Returns the new state. */
export function toggleWishlistEntry(
  entries: WishlistEntry[],
  product: Product
): { entries: WishlistEntry[]; saved: boolean } {
  if (isProductWishlisted(entries, product.id)) {
    return { entries: removeWishlistEntry(entries, product.id), saved: false };
  }
  return { entries: addWishlistEntry(entries, createWishlistEntry(product)), saved: true };
}

export function isProductWishlisted(entries: WishlistEntry[], productId: string): boolean {
  return entries.some((item) => item.productId === productId);
}

export function findWishlistEntry(
  entries: WishlistEntry[],
  productId: string
): WishlistEntry | undefined {
  return entries.find((item) => item.productId === productId);
}

/** Total number of saved products. */
export function getWishlistCount(entries: WishlistEntry[]): number {
  return entries.length;
}

/**
 * The size/colour pair to buy when moving a wishlist item straight into the bag.
 *
 * A wishlist entry records no chosen variant, so the first variant that is
 * actually in stock is used; that keeps "Add to Cart" one click and always
 * produces a variant the checkout API can resolve.
 */
export function pickPurchasableVariant(product: Product): { color: string; size: string } {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  const inStock =
    variants.find((variant) => (Number(variant.quantity) || 0) > 0) ??
    variants.find((variant) => getVariantStock(product, variant.size, variant.color) > 0);
  if (inStock) return { color: inStock.color, size: inStock.size };

  if (variants.length > 0) return { color: variants[0].color, size: variants[0].size };

  return {
    color: getProductColors(product)[0] ?? '',
    size: getProductSizes(product)[0] ?? 'M',
  };
}

/** True when at least one variant can actually be bought. */
export function isWishlistEntryPurchasable(product: Product): boolean {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (variants.length === 0) return true;
  return variants.some((variant) => (Number(variant.quantity) || 0) > 0);
}

/** Guard against malformed data restored from storage. */
export function isWishlistEntry(value: unknown): value is WishlistEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<WishlistEntry>;
  return (
    typeof entry.productId === 'string' &&
    !!entry.product &&
    typeof entry.product.id === 'string' &&
    typeof entry.product.price === 'number'
  );
}

/**
 * Rehydrate persisted entries, dropping anything malformed.
 *
 * The snapshot is preserved so the list renders before the catalogue arrives;
 * the page prefers the live product when the API has one for this id.
 */
export function reviveWishlist(value: unknown): WishlistEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter(isWishlistEntry).filter((entry) => {
    if (seen.has(entry.productId)) return false;
    seen.add(entry.productId);
    return true;
  });
}