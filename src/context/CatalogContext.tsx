import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchCategories, fetchProducts } from '../services/catalogService';
import type { Product } from '../data/products';
import type { Category, ProductQuery } from '../types/api';
import { CatalogContext, type CatalogContextValue } from './catalogStore';

/**
 * Owns the single product dataset and category list for the whole application.
 * Components read from here instead of fetching their own copy, so search,
 * filters, cards and detail pages always agree.
 */
export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guards against an older, slower response overwriting a newer one.
  const latestRequestId = useRef(0);

  const loadProducts = useCallback(async (query: ProductQuery = {}) => {
    latestRequestId.current += 1;
    const requestId = latestRequestId.current;
    setIsLoading(true);
    const result = await fetchProducts(query);
    if (requestId !== latestRequestId.current) return;
    if (result.success) {
      setProducts(result.data);
      setError(null);
    } else {
      setError(result.message);
    }
    setIsLoading(false);
  }, []);

  const reloadCategories = useCallback(async () => {
    const result = await fetchCategories();
    if (result.success) setCategories(result.data);
  }, []);

  // Categories are route independent, so they load once. Products are loaded by
  // the view that owns the current route to avoid duplicate competing requests.
  useEffect(() => {
    let active = true;
    fetchCategories().then((result) => {
      if (active && result.success) setCategories(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const findCategory = useCallback(
    (name: string) => categories.find((category) => category.name.toLowerCase() === name.toLowerCase()),
    [categories]
  );

  const value = useMemo<CatalogContextValue>(
    () => ({ products, categories, isLoading, error, loadProducts, reloadCategories, findCategory }),
    [products, categories, isLoading, error, loadProducts, reloadCategories, findCategory]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};