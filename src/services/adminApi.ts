/**
 * Admin service layer — all admin reads and writes, typed against the shared
 * API contracts and routed through the shared `apiClient` transport.
 */

import type {
  AdminOrder,
  AdminProduct,
  AdminStats,
  ApiResult,
  Category,
  CategoryInput,
  ProductInput,
} from '../types/api';
import { request, uploadFiles } from './apiClient';
import { adminAuthHeader, clearAdminSession, type AdminProfile } from '../admin/adminAuth';
import {
  AUTH_REQUIRED,
  INVALID_CREDENTIALS,
  SESSION_EXPIRED,
  TOO_MANY_ATTEMPTS,
} from '../../shared/adminAuthMessages';

/**
 * Admin request helper.
 *
 * Attaches the session token to every admin call and treats a rejected session
 * as lost: the stored token is discarded so the dashboard immediately falls back
 * to the login screen instead of looping on failed requests.
 */
async function adminRequest<T>(
  path: string,
  options: Parameters<typeof request<T>>[1] = {}
): Promise<ApiResult<T>> {
  const result = await request<T>(path, { ...options, headers: adminAuthHeader() });
  if (isSessionRejection(result.message)) clearAdminSession();
  return result;
}

/** True when the API refused the request because the session is not usable. */
function isSessionRejection(message: string | undefined): boolean {
  return message === AUTH_REQUIRED || message === SESSION_EXPIRED;
}

/** Distinguishes a throttled login so the form can say so, not "wrong password". */
export function isThrottled(result: ApiResult<unknown>): boolean {
  return result.message === TOO_MANY_ATTEMPTS;
}

/** True when the API rejected the submitted credentials. */
export function isBadCredentials(result: ApiResult<unknown>): boolean {
  return result.message === INVALID_CREDENTIALS;
}

/**
 * Derive the dashboard counters from the raw rows so the same totals can be
 * recomputed locally after a single order changes.
 */
export function summarizeStats(
  productRows: AdminProduct[],
  orderRows: AdminOrder[],
  categoryRows: Category[]
): AdminStats {
  return {
    totalProducts: productRows.length,
    totalOrders: orderRows.length,
    pendingOrders: orderRows.filter((order) => order.status === 'PENDING').length,
    deliveredOrders: orderRows.filter((order) => order.status === 'DELIVERED').length,
    outOfStock: productRows.filter(
      (product) =>
        product.isOutOfStock ||
        (product.variants ?? []).every((variant) => variant.quantity <= 0)
    ).length,
    totalSales: orderRows
      .filter((order) => order.status !== 'CANCELLED')
      .reduce((sum, order) => sum + (order.totalPrice ?? 0), 0),
    recentOrders: orderRows.slice(0, 5),
    products: productRows,
    categories: categoryRows,
    orders: orderRows,
  };
}

/** Aggregate dashboard payload in one round trip. */
export async function adminFetchStats(): Promise<ApiResult<AdminStats>> {
  const [products, orders, categories] = await Promise.all([
    adminRequest<AdminProduct[]>('/products', { query: { admin: true } }),
    adminRequest<AdminOrder[]>('/orders'),
    adminRequest<Category[]>('/categories', { query: { admin: true } }),
  ]);

  if (!products.success) return { success: false, message: products.message };
  if (!orders.success) return { success: false, message: orders.message };
  if (!categories.success) return { success: false, message: categories.message };

  return {
    success: true,
    message: 'OK',
    data: summarizeStats(products.data ?? [], orders.data ?? [], categories.data ?? []),
  };
}

export function adminDeleteProduct(id: string): Promise<ApiResult<null>> {
  return adminRequest<null>(`/products/${id}`, { method: 'DELETE' });
}

export function adminCreateProduct(input: ProductInput): Promise<ApiResult<AdminProduct>> {
  return adminRequest<AdminProduct>('/products', { method: 'POST', body: input });
}

export function adminUpdateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<ApiResult<AdminProduct>> {
  return adminRequest<AdminProduct>(`/products/${id}`, { method: 'PUT', body: input });
}

export function adminCreateCategory(input: CategoryInput): Promise<ApiResult<Category>> {
  return adminRequest<Category>('/categories', { method: 'POST', body: input });
}

export function adminUpdateCategory(
  id: string,
  input: Partial<CategoryInput>
): Promise<ApiResult<Category>> {
  return adminRequest<Category>(`/categories/${id}`, { method: 'PUT', body: input });
}

export function adminDeleteCategory(id: string): Promise<ApiResult<null>> {
  return adminRequest<null>(`/categories/${id}`, { method: 'DELETE' });
}

export function adminUpdateOrderStatus(id: string, status: string): Promise<ApiResult<AdminOrder>> {
  return adminRequest<AdminOrder>(`/orders/${id}`, { method: 'PUT', body: { status } });
}

export interface AdminLoginResponse {
  token: string;
  admin: AdminProfile;
}

/** Public endpoint — sends no token, since the caller has none yet. */
export function adminLogin(
  email: string,
  password: string
): Promise<ApiResult<AdminLoginResponse>> {
  return request<AdminLoginResponse>('/admin/login', {
    method: 'POST',
    body: { email, password },
  });
}

/** Confirms a stored token is still valid; used on dashboard load and refresh. */
export function adminSession(): Promise<ApiResult<{ admin: AdminProfile | null }>> {
  return adminRequest<{ admin: AdminProfile | null }>('/admin/me');
}

/** Notifies the API of sign-out. The client discards the token either way. */
export async function adminLogout(): Promise<ApiResult<null>> {
  return adminRequest<null>('/admin/logout', { method: 'POST' });
}

export function adminUploadImages(files: File[]): Promise<ApiResult<string[]>> {
  return uploadFiles('/upload', files, 'images', adminAuthHeader());
}