/**
 * Cart domain model — pure, centralised cart operations.
 *
 * A cart line is identified by `cartId` = productId + colour + size, so the
 * same product in a different size or colour is a separate line. Every price
 * is resolved through `getUnitPrice` so the cart, checkout and order all agree.
 */

import { getPrimaryImage, getShippingPrice, getUnitPrice, type Product } from './products';

export interface CartLine {
  /** Stable identity: `${productId}-${color}-${size}`. */
  cartId: string;
  productId: string;
  name: string;
  image: string;
  category: string;
  selectedColor: string;
  selectedSize: string;
  quantity: number;
  /** Price captured when the line was added. */
  unitPrice: number;
  /** Per-unit shipping captured when the line was added. */
  shippingPrice: number;
  /** Snapshot of the product, kept so totals can be computed without the catalog. */
  product: Product;
}

export function buildCartId(productId: string, color: string, size: string): string {
  return `${productId}-${color}-${size}`;
}

export function createCartLine(
  product: Product,
  quantity: number,
  color: string,
  size: string
): CartLine {
  const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
  return {
    cartId: buildCartId(product.id, color, size),
    productId: product.id,
    name: product.name,
    image: getPrimaryImage(product),
    category: product.category,
    selectedColor: color,
    selectedSize: size,
    quantity: safeQuantity,
    unitPrice: getUnitPrice(product),
    shippingPrice: getShippingPrice(product),
    product,
  };
}

/** Add quantity to an existing matching line, or append a new one. */
export function addCartLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.findIndex((item) => item.cartId === line.cartId);
  if (existing === -1) return [...lines, line];

  const next = [...lines];
  next[existing] = { ...next[existing], quantity: next[existing].quantity + line.quantity };
  return next;
}

/** Increase or decrease a line; drops the line when the quantity reaches zero. */
export function changeCartLineQuantity(
  lines: CartLine[],
  cartId: string,
  delta: number
): CartLine[] {
  return lines
    .map((line) =>
      line.cartId === cartId ? { ...line, quantity: line.quantity + delta } : line
    )
    .filter((line) => line.quantity > 0);
}

export function removeCartLine(lines: CartLine[], cartId: string): CartLine[] {
  return lines.filter((line) => line.cartId !== cartId);
}

/** Extended price of a single line. */
export function getCartLineTotal(line: CartLine): number {
  return line.unitPrice * line.quantity;
}

/** Shipping for a single line: the product's rate times the quantity. */
export function getCartLineShipping(line: CartLine): number {
  return line.shippingPrice * line.quantity;
}

/** Sum of all line totals. */
export function getCartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + getCartLineTotal(line), 0);
}

/**
 * Shipping for the whole cart.
 *
 * Each product carries its own per-unit shipping price, so this is the sum over
 * lines rather than a single store-wide rate.
 */
export function getCartShipping(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + getCartLineShipping(line), 0);
}

/** Total number of physical units in the cart. */
export function getCartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Guard against malformed data restored from storage. */
export function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as Partial<CartLine>;
  return (
    typeof line.cartId === 'string' &&
    typeof line.productId === 'string' &&
    typeof line.quantity === 'number' &&
    line.quantity > 0 &&
    typeof line.unitPrice === 'number' &&
    !!line.product &&
    typeof line.product.id === 'string'
  );
}

/** Rehydrate persisted lines, dropping anything malformed or stale. */
export function reviveCartLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isCartLine).map((line) => ({
    ...line,
    image: line.image || getPrimaryImage(line.product),
    unitPrice: Number.isFinite(line.unitPrice) ? line.unitPrice : getUnitPrice(line.product),
    // Carts saved before shipping prices existed have no snapshot; fall back to
    // the product so an old bag still quotes a delivery charge.
    shippingPrice: Number.isFinite(line.shippingPrice)
      ? line.shippingPrice
      : getShippingPrice(line.product),
  }));
}