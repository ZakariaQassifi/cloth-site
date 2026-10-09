/**
 * Catalog reads — the only place the storefront asks for products and
 * categories. Swapping this implementation (REST -> GraphQL -> local fixture)
 * is enough to change where the catalog comes from.
 */

import { normalizeProduct, type Product } from '../data/products';
import type { ApiResult, Category, ProductQuery } from '../types/api';
import { request } from './apiClient';

/** Fetch products, normalised into the app's canonical `Product` shape. */
export async function fetchProducts(filters: ProductQuery = {}): Promise<ApiResult<Product[]>> {
  const query: ProductQuery = { ...filters };
  if (query.category === 'All') delete query.category;

  // ✅ FIX: Zidna /api/ f l-path
  const result = await request<unknown[] | Record<string, unknown>[]>('/api/products', { query });
  if (!result.success) return { success: false, message: result.message };

  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    success: true,
    message: result.message,
    data: rows.map((row) => normalizeProduct(row as Partial<Product> & { id: string; name: string })),
  };
}

export async function fetchProductById(id: string): Promise<ApiResult<Product>> {
  // ✅ FIX: Zidna /api/ f l-path
  const result = await request<Record<string, unknown>>(`/api/products/${id}`);
  if (!result.success || !result.data) return { success: false, message: result.message || 'Product not found' };

  const raw = result.data as Partial<Product> & { id: string; name: string };
  return { success: true, message: result.message, data: normalizeProduct(raw) };
}

/** Visible categories, ordered for navigation. */
export async function fetchCategories(): Promise<ApiResult<Category[]>> {
  // ✅ FIX: Zidna /api/ f l-path
  const result = await request<Category[]>('/api/categories');
  if (!result.success || !Array.isArray(result.data)) {
    return { success: false, message: result.message || 'Categories unavailable' };
  }

  const visible = result.data
    .filter((category) => category.isVisible !== false)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  return { success: true, message: result.message, data: visible };
}