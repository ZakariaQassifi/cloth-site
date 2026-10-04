/**
 * Order writes — the single entry point for placing an order.
 * The confirmation UI depends only on `submitOrder`'s result shape.
 */

import type { ApiResult } from '../types/api';
import type { CreateOrderRequest } from '../data/order';
import { request } from './apiClient';

interface CreatedOrderResponse {
  id?: string;
  status?: string;
  createdAt?: string;
  totalPrice?: number;
}

export async function submitOrder(
  order: CreateOrderRequest
): Promise<ApiResult<CreatedOrderResponse>> {
  return request<CreatedOrderResponse>('/orders', { method: 'POST', body: order });
}