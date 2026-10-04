/**
 * Order domain model — database-ready order structure.
 *
 * Mirrors the future `orders` / `order_items` tables so an order created in the
 * browser can be persisted as-is and rehydrated without reshaping.
 */

import { getCartLineShipping, getCartLineTotal, getCartSubtotal, type CartLine } from './cart';
import { roundAmount } from '../../shared/currency';

/**
 * The store accepts Cash on Delivery only — card payments were removed, so the
 * method is a single-member union rather than an open list.
 */
export type PaymentMethod = 'CASH_ON_DELIVERY';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export const ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
];

export const PAYMENT_METHODS: PaymentMethod[] = ['CASH_ON_DELIVERY'];

/**
 * Colours are stored as hex (`#0f0f0f`) or as a plain name (`Black`), so only
 * hex values can be previewed as a swatch.
 */
export function isHexColor(color: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim());
}

/** Short order reference shown in admin lists and the details view. */
export function shortOrderId(orderId: string): string {
  return orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface OrderLine {
  /** Stable identity: `${productId}-${color}-${size}`. */
  lineId: string;
  productId: string;
  productName: string;
  productImage: string;
  category: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Per-unit shipping captured with the line. */
  shippingPrice: number;
  /** Shipping for this line: `shippingPrice × quantity`. */
  lineShipping: number;
}

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  total: number;
}

export interface Order {
  orderId: string;
  orderNumber: string;
  /** Human-readable date for the receipt. */
  date: string;
  /** ISO timestamp for persistence and sorting. */
  createdAt: string;
  status: OrderStatus;
  customer: CustomerInfo;
  lines: OrderLine[];
  totals: OrderTotals;
  paymentMethod: PaymentMethod;
  notes?: string;
}

/** Payload accepted by `POST /api/orders`. */
export interface CreateOrderRequest {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCity: string;
  customerAddress: string;
  customerPostalCode: string;
  customerNotes?: string;
  paymentMethod: PaymentMethod;
  items: Array<{
    productId: string;
    size: string;
    color: string;
    quantity: number;
  }>;
}

/**
 * Order totals.
 *
 * Shipping is the sum of each line's own per-unit shipping price rather than a
 * store-wide flat rate, so the quote a shopper sees at checkout is the amount the
 * server charges.
 */
export function calculateTotals(lines: OrderLine[]): OrderTotals {
  const subtotal = roundAmount(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const shipping = roundAmount(lines.reduce((sum, line) => sum + line.lineShipping, 0));
  return { subtotal, shipping, total: roundAmount(subtotal + shipping) };
}

/** Project cart lines into order lines, preserving size/colour/quantity/price. */
export function buildOrderLines(lines: CartLine[]): OrderLine[] {
  return lines.map((line) => ({
    lineId: line.cartId,
    productId: line.productId,
    productName: line.name,
    productImage: line.image,
    category: line.category,
    size: line.selectedSize,
    color: line.selectedColor,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: getCartLineTotal(line),
    shippingPrice: line.shippingPrice,
    lineShipping: getCartLineShipping(line),
  }));
}

/** Map a cart line to the `items[]` shape the order endpoint expects. */
export function toOrderItems(lines: CartLine[]): CreateOrderRequest['items'] {
  return lines.map((line) => ({
    productId: line.productId,
    size: line.selectedSize,
    color: line.selectedColor,
    quantity: line.quantity,
  }));
}

export function toCreateOrderRequest(
  customer: CustomerInfo,
  paymentMethod: PaymentMethod,
  lines: CartLine[],
  notes?: string
): CreateOrderRequest {
  return {
    customerName: customer.fullName,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customerCity: customer.city,
    customerAddress: customer.address,
    customerPostalCode: customer.postalCode,
    customerNotes: notes,
    paymentMethod,
    items: toOrderItems(lines),
  };
}

export function formatOrderNumber(orderId: string): string {
  return `KNT-${orderId.slice(0, 6).toUpperCase()}`;
}

export function formatOrderDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Build the order shown on the confirmation screen.
 * `orderId` is the id returned by the API once the order is persisted; a
 * provisional id keeps the flow working before a backend is connected.
 */
export function createOrder(params: {
  orderId: string;
  customer: CustomerInfo;
  lines: CartLine[];
  paymentMethod: PaymentMethod;
  status?: OrderStatus;
  createdAt?: string;
  notes?: string;
}): Order {
  const createdAt = params.createdAt ?? new Date().toISOString();
  const lines = buildOrderLines(params.lines);

  return {
    orderId: params.orderId,
    orderNumber: formatOrderNumber(params.orderId),
    date: formatOrderDate(createdAt),
    createdAt,
    status: params.status ?? 'PENDING',
    customer: params.customer,
    lines,
    totals: calculateTotals(lines),
    paymentMethod: params.paymentMethod,
    notes: params.notes,
  };
}

/**
 * Reconcile a server order response with the local cart snapshot.
 * Authoritative money comes from the backend — it priced the order from the
 * database, not from the cart snapshot the browser happened to hold — while the
 * product snapshot comes from the cart so the receipt can render immediately.
 */
export function orderFromResponse(
  response:
    | { id?: string; status?: string; createdAt?: string; subtotalPrice?: number; shippingPrice?: number; totalPrice?: number }
    | undefined,
  customer: CustomerInfo,
  lines: CartLine[],
  paymentMethod: PaymentMethod
): Order {
  const order = createOrder({
    orderId: response?.id ?? createProvisionalOrderId(),
    customer,
    lines,
    paymentMethod,
    status: (response?.status as OrderStatus) ?? 'PENDING',
    createdAt: response?.createdAt,
  });

  const subtotal =
    typeof response?.subtotalPrice === 'number' ? response.subtotalPrice : order.totals.subtotal;
  const shipping =
    typeof response?.shippingPrice === 'number' ? response.shippingPrice : order.totals.shipping;
  const total =
    typeof response?.totalPrice === 'number' ? response.totalPrice : roundAmount(subtotal + shipping);

  return { ...order, totals: { subtotal, shipping, total } };
}

function createProvisionalOrderId(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `local-${random}`;
}

/** Convenience re-export so totals can be read without importing the cart module. */
export { getCartSubtotal };