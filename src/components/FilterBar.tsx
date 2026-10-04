import React from 'react';
import { Search } from 'lucide-react';
import {
  PRICE_RANGE_OPTIONS,
  SORT_OPTIONS,
  type FilterState,
} from '../data/filters';
import { toSwatchColor } from '../data/products';
import { useTranslation } from '../i18n/useI18n';
import { useColorLabel } from '../i18n/hooks';
import './FilterBar.css';

export interface FilterBarProps {
  filters: FilterState;
  /** Category options, derived from the catalog rather than hardcoded. */
  categories: string[];
  /** Size options available across the current catalog. */
  sizes: string[];
  /** Colour options available across the current catalog. */
  colors: string[];
  filteredCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onPriceRangeChange: (range: string) => void;
  onSortChange: (sort: string) => void;
  onSizesChange: (sizes: string[]) => void;
  onColorsChange: (colors: string[]) => void;
  onClearFilters: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  categories,
  sizes,
  colors,
  filteredCount,
  hasActiveFilters,
  onSearchChange,
  onCategoryChange,
  onPriceRangeChange,
  onSortChange,
  onSizesChange,
  onColorsChange,
  onClearFilters,
}) => {
  const { t, tRich } = useTranslation();
  const colorLabel = useColorLabel();

  const toggleValue = (value: string, current: string[], apply: (next: string[]) => void) =>
    apply(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);

  return (
    <div className="filter-bar">
      <div className="filter-bar__top">
        {/* Search Bar */}
        <div className="filter-search">
          <Search size={18} className="filter-search__icon" />
          <input
            type="text"
            className="filter-search__input"
            placeholder={t('catalog.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Price & Sort Controls */}
        <div className="filter-controls">
          {sizes.length > 0 && (
            <select
              className="filter-select"
              value={filters.sizes[0] ?? ''}
              onChange={(e) => {
                const next = e.target.value;
                onSizesChange(next ? [next] : []);
              }}
              aria-label={t('catalog.filterBySize')}
            >
              <option value="">{t('catalog.allSizes')}</option>
              {sizes.map((size) => (
                <option key={size} value={size}>
                  {t('catalog.sizeValue', { size })}
                </option>
              ))}
            </select>
          )}

          {colors.length > 0 && (
            <select
              className="filter-select"
              value={filters.colors[0] ?? ''}
              onChange={(e) => {
                const next = e.target.value;
                onColorsChange(next ? [next] : []);
              }}
              aria-label={t('catalog.filterByColor')}
            >
              <option value="">{t('catalog.allColors')}</option>
              {colors.map((color) => (
                <option key={color} value={color}>
                  {t('catalog.colorValue', { color: colorLabel(color) })}
                </option>
              ))}
            </select>
          )}

          <select
            className="filter-select"
            value={filters.priceRange}
            onChange={(e) => onPriceRangeChange(e.target.value)}
            aria-label={t('catalog.filterByPrice')}
          >
            {PRICE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filters.sort}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label={t('catalog.sortBy')}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active variant filters */}
      {(filters.sizes.length > 0 || filters.colors.length > 0) && (
        <div className="filter-categories">
          {filters.sizes.map((size) => (
            <button
              key={`size-${size}`}
              type="button"
              className="filter-category-btn active"
              onClick={() => toggleValue(size, filters.sizes, onSizesChange)}
            >
              {t('catalog.sizeValue', { size })} &times;
            </button>
          ))}
          {filters.colors.map((color) => (
            <button
              key={`color-${color}`}
              type="button"
              className="filter-category-btn active"
              onClick={() => toggleValue(color, filters.colors, onColorsChange)}
            >
              <span
                className="filter-category-btn__swatch"
                style={{ backgroundColor: toSwatchColor(color) }}
              />
              {colorLabel(color)} &times;
            </button>
          ))}
        </div>
      )}

      {/* Category Pills */}
      <div className="filter-categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`filter-category-btn ${filters.category === category ? 'active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Results Count & Clear */}
      <div className="filter-bar__bottom">
        <div>
          {tRich('catalog.showing', {
            count: <span className="filter-count">{filteredCount}</span>,
          })}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-clear-btn"
            onClick={onClearFilters}
          >
            {t('catalog.clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
};