/**
 * Catalog store contract: the context object lives in its own module so the
 * provider file exports a single component and consumers can import the hook
 * without pulling in the provider.
 */

import { createContext } from 'react';
import type { Product } from '../data/products';
import type { Category, ProductQuery } from '../types/api';

export interface CatalogContextValue {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  /** Reload products using the supplied query. */
  loadProducts: (query?: ProductQuery) => Promise<void>;
  /** Re-read categories from the API. */
  reloadCategories: () => Promise<void>;
  /** Look up a category by name (case-insensitive). */
  findCategory: (name: string) => Category | undefined;
}

export const CatalogContext = createContext<CatalogContextValue | null>(null);
