/**
 * Catalog filtering and sorting — one engine shared by every view.
 *
 * Filters operate purely on the normalised `Product[]` supplied by the catalog
 * provider, so there is exactly one product dataset in the application.
 */

import {
  getProductColors,
  getProductSizes,
  getUnitPrice,
  isProductOnSale,
  type Product,
} from './products';
import type { TranslationKey } from '../i18n/translations/en';

export type SortOption = 'newest' | 'price-asc' | 'price-desc';
export type PriceRangeId = 'all' | 'under-100' | '100-200' | 'over-200';

export interface FilterState {
  search: string;
  category: string;
  sizes: string[];
  colors: string[];
  priceRange: PriceRangeId;
  sort: SortOption;
  /** When true only discounted products survive (the /sale collection). */
  saleOnly: boolean;
}

export const ALL_CATEGORIES = 'All';

/**
 * Sort/price labels live here as translation keys, not display strings, so the
 * dropdown text follows the active locale without re-deriving it per render.
 */
export const SORT_LABEL_KEYS: Record<SortOption, TranslationKey> = {
  newest: 'sort.newest',
  'price-asc': 'sort.priceAsc',
  'price-desc': 'sort.priceDesc',
};

export const PRICE_RANGE_LABEL_KEYS: Record<PriceRangeId, TranslationKey> = {
  all: 'price.all',
  'under-100': 'price.under100',
  '100-200': 'price.from100to200',
  'over-200': 'price.over200',
};

export const SORT_OPTIONS: Array<{ value: SortOption; labelKey: TranslationKey }> = [
  { value: 'newest', labelKey: SORT_LABEL_KEYS.newest },
  { value: 'price-asc', labelKey: SORT_LABEL_KEYS['price-asc'] },
  { value: 'price-desc', labelKey: SORT_LABEL_KEYS['price-desc'] },
];

export const PRICE_RANGE_OPTIONS: Array<{ value: PriceRangeId; labelKey: TranslationKey }> = [
  { value: 'all', labelKey: PRICE_RANGE_LABEL_KEYS.all },
  { value: 'under-100', labelKey: PRICE_RANGE_LABEL_KEYS['under-100'] },
  { value: '100-200', labelKey: PRICE_RANGE_LABEL_KEYS['100-200'] },
  { value: 'over-200', labelKey: PRICE_RANGE_LABEL_KEYS['over-200'] },
];

export function createFilterState(overrides: Partial<FilterState> = {}): FilterState {
  return {
    search: '',
    category: ALL_CATEGORIES,
    sizes: [],
    colors: [],
    priceRange: 'all',
    sort: 'newest',
    saleOnly: false,
    ...overrides,
  };
}

function matchesPriceRange(product: Product, range: PriceRangeId): boolean {
  const price = getUnitPrice(product);
  if (range === 'under-100') return price < 100;
  if (range === '100-200') return price >= 100 && price <= 200;
  if (range === 'over-200') return price > 200;
  return true;
}

function matchesSearch(product: Product, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return (
    product.name.toLowerCase().includes(term) ||
    product.category.toLowerCase().includes(term) ||
    (product.description ?? '').toLowerCase().includes(term)
  );
}

export function filterProducts(products: Product[], state: FilterState): Product[] {
  return products.filter((product) => {
    if (!matchesSearch(product, state.search)) return false;
    if (state.category !== ALL_CATEGORIES && product.category.toLowerCase() !== state.category.toLowerCase()) {
      return false;
    }
    if (!matchesPriceRange(product, state.priceRange)) return false;
    if (state.saleOnly && !isProductOnSale(product)) return false;

    if (state.sizes.length > 0) {
      const sizes = getProductSizes(product);
      const hasSize = state.sizes.some((size) => sizes.includes(size));
      if (!hasSize) return false;
    }

    if (state.colors.length > 0) {
      const colors = getProductColors(product);
      const needle = state.colors.map((color) => color.toLowerCase());
      const hasColor = colors.some((color) => needle.includes(color.toLowerCase()));
      if (!hasColor) return false;
    }

    return true;
  });
}

export function sortProducts(products: Product[], sort: SortOption): Product[] {
  const sorted = [...products];
  if (sort === 'price-asc') {
    return sorted.sort((a, b) => getUnitPrice(a) - getUnitPrice(b));
  }
  if (sort === 'price-desc') {
    return sorted.sort((a, b) => getUnitPrice(b) - getUnitPrice(a));
  }
  return sorted.sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );
}

/** Distinct sizes present across the supplied products. */
export function getAvailableSizes(products: Product[]): string[] {
  const sizes = new Set<string>();
  products.forEach((product) => getProductSizes(product).forEach((size) => sizes.add(size)));
  return Array.from(sizes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Distinct colours present across the supplied products. */
export function getAvailableColors(products: Product[]): string[] {
  const colors = new Set<string>();
  products.forEach((product) => getProductColors(product).forEach((color) => colors.add(color)));
  return Array.from(colors).sort((a, b) => a.localeCompare(b));
}

/** Apply filters and sorting in the correct order. */
export function selectVisibleProducts(products: Product[], state: FilterState): Product[] {
  return sortProducts(filterProducts(products, state), state.sort);
}

export function hasActiveFilters(state: FilterState): boolean {
  return (
    state.search.trim() !== '' ||
    state.category !== ALL_CATEGORIES ||
    state.sizes.length > 0 ||
    state.colors.length > 0 ||
    state.priceRange !== 'all' ||
    state.sort !== 'newest'
  );
}

/** Toggle a value inside a multi-select filter list. */
export function toggleFilterValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}