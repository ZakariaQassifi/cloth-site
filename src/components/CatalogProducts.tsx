import React, { useMemo, useState } from 'react';
import { Container } from './Container';
import { FilterBar } from './FilterBar';
import { ProductGrid } from './ProductGrid';
import {
  createFilterState,
  hasActiveFilters,
  selectVisibleProducts,
  type FilterState,
  type PriceRangeId,
  type SortOption,
} from '../data/filters';
import { getAvailableColors, getAvailableSizes } from '../data/filters';
import type { Product } from '../data/products';
import { useTranslation } from '../i18n/useI18n';
import './NewArrivalsSection.css';

export interface CatalogProductsProps {
  products: Product[];
  title: string;
  subtitle: string;
  /** Category locked by the current route. */
  category: string;
  /** Restrict the collection to discounted products. */
  saleOnly?: boolean;
  /** Category names from the API, so pills are stable even on filtered pages. */
  categoryOptions?: string[];
  onSelectProduct: (product: Product) => void;
}

/**
 * Renders a product collection with the shared filter bar.
 * All filtering, sorting and counting happens in `data/filters.ts` against the
 * single catalog dataset, so every collection page behaves identically.
 */
export const CatalogProducts: React.FC<CatalogProductsProps> = ({
  products,
  title,
  subtitle,
  category,
  saleOnly = false,
  categoryOptions,
  onSelectProduct,
}) => {
  const { t } = useTranslation();
  const routeKey = `${category}|${saleOnly}`;
  const [filters, setFilters] = useState<FilterState>(() =>
    createFilterState({ category, saleOnly })
  );
  const [activeRouteKey, setActiveRouteKey] = useState(routeKey);

  // Keep the filter in step with the route when the collection changes.
  if (activeRouteKey !== routeKey) {
    setActiveRouteKey(routeKey);
    setFilters((previous) => ({ ...previous, category, saleOnly }));
  }

  const categories = useMemo(() => {
    const known = new Set(products.map((product) => product.category));
    const names = categoryOptions?.filter((name) => known.has(name)) ?? Array.from(known);
    return ['All', ...Array.from(new Set(names)).sort()];
  }, [products, categoryOptions]);
  const sizes = useMemo(() => getAvailableSizes(products), [products]);
  const colors = useMemo(() => getAvailableColors(products), [products]);

  const visibleProducts = useMemo(
    () => selectVisibleProducts(products, filters),
    [products, filters]
  );

  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters((previous) => ({ ...previous, [key]: value }));

  return (
    <section className="new-arrivals-section">
      <Container maxWidth="lg">
        <div className="new-arrivals-section__header">
          <div className="new-arrivals-section__titles">
            <h2 className="new-arrivals-section__title">{title}</h2>
            <p className="new-arrivals-section__subtitle">{subtitle}</p>
          </div>
        </div>

        <FilterBar
          filters={filters}
          categories={categories}
          sizes={sizes}
          colors={colors}
          filteredCount={visibleProducts.length}
          hasActiveFilters={hasActiveFilters(filters)}
          onSearchChange={(search) => update('search', search)}
          onCategoryChange={(next) => update('category', next)}
          onPriceRangeChange={(next) => update('priceRange', next as PriceRangeId)}
          onSortChange={(next) => update('sort', next as SortOption)}
          onSizesChange={(next) => update('sizes', next)}
          onColorsChange={(next) => update('colors', next)}
          onClearFilters={() => setFilters(createFilterState({ category, saleOnly }))}
        />

        {visibleProducts.length === 0 ? (
          <div className="no-products" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <h3 className="no-products__title" style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('catalog.noProducts')}</h3>
            <p className="text-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {t('catalog.noProductsDesc')}
            </p>
            <div>
              <button
                type="button"
                className="btn btn--primary btn--md"
                onClick={() => setFilters(createFilterState({ category, saleOnly }))}
              >
                {t('catalog.resetFilters')}
              </button>
            </div>
          </div>
        ) : (
          <ProductGrid products={visibleProducts} onProductClick={onSelectProduct} />
        )}
      </Container>
    </section>
  );
};