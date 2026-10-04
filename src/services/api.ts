/**
 * Storefront service facade.
 *
 * Kept as the stable public surface for the shop UI; the actual transport and
 * normalisation live in `apiClient`, `catalogService` and `orderService`.
 */

import type { CreateOrderRequest } from '../data/order';
import type { Product } from '../data/products';
import { fetchProducts as fetchProductsApi } from './catalogService';
import { submitOrder as submitOrderApi } from './orderService';

/** Fetch products for the catalog. Never throws; resolves to an empty list on failure. */
export async function fetchProducts(filters?: Parameters<typeof fetchProductsApi>[0]): Promise<Product[]> {
  const result = await fetchProductsApi(filters);
  return result.success ? result.data : [];
}

/** Place an order. Returns the persisted order so the receipt can show its id. */
export function createOrderApi(order: CreateOrderRequest) {
  return submitOrderApi(order);
}

export { fetchProductsApi as fetchProductsResult, submitOrderApi as submitOrderResult };