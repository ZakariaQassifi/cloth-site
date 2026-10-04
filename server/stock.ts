/**
 * Inventory operations.
 *
 * Every stock change in the system goes through this module so three rules hold
 * everywhere:
 *
 *  1. Stock is never allowed to go negative. Reservations use a conditional
 *     `updateMany` (compare-and-set) rather than read-then-write, so two
 *     simultaneous checkouts cannot both pass a stale availability check.
 *  2. A product is out of stock when its variants total zero, or when an admin
 *     has flagged it manually. That effective flag is recomputed after every
 *     change so the stored value can never drift from the variant quantities.
 *  3. Releasing stock is symmetric with reserving it, and is idempotent per
 *     order status transition, so an order can be cancelled and reinstated
 *     repeatedly without corrupting inventory.
 */

import { Prisma, type PrismaClient } from '@prisma/client';

/** Minimal client surface, satisfied by both PrismaClient and a transaction. */
export type StockClient = Prisma.TransactionClient | PrismaClient;

/**
 * Base class for the stock rules a shopper is allowed to be told about.
 *
 * The API layer sends `message` for these verbatim and falls back to a generic
 * response for anything else, so an internal failure can never be mistaken for
 * an explanation of what went wrong with an order.
 */
export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockError';
  }
}

export class InsufficientStockError extends StockError {
  readonly available: number;
  readonly requested: number;

  constructor(message: string, available: number, requested: number) {
    super(message);
    this.name = 'InsufficientStockError';
    this.available = available;
    this.requested = requested;
  }
}

export class ProductUnavailableError extends StockError {
  constructor(message: string) {
    super(message);
    this.name = 'ProductUnavailableError';
  }
}

export interface VariantRef {
  size: string;
  color: string;
}

/** Sum of every variant quantity for a product. */
export async function totalVariantStock(tx: StockClient, productId: string): Promise<number> {
  const result = await tx.productVariant.aggregate({
    where: { productId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/**
 * Recompute and persist the effective out-of-stock flag for a product.
 *
 * Returns the value written. Safe to call after any quantity change.
 */
export async function syncOutOfStock(tx: StockClient, productId: string): Promise<boolean> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { manualOutOfStock: true },
  });
  // The product was deleted while an order was in flight; nothing to sync.
  if (!product) return false;

  const total = await totalVariantStock(tx, productId);
  const effective = product.manualOutOfStock || total <= 0;

  await tx.product.update({ where: { id: productId }, data: { isOutOfStock: effective } });
  return effective;
}

/**
 * Locate the variant for a size/colour pair.
 *
 * An exact match is preferred so a colour such as "White" can never resolve to a
 * different variant that merely contains the term.
 */
export async function findVariantForOrder(tx: StockClient, productId: string, ref: VariantRef) {
  const exact = await tx.productVariant.findFirst({
    where: { productId, size: ref.size, color: ref.color },
    include: { product: true },
  });
  if (exact) return exact;

  return tx.productVariant.findFirst({
    where: { productId, size: ref.size, color: { contains: ref.color } },
    include: { product: true },
  });
}

export interface Reservation {
  variantId: string;
  productId: string;
  productName: string;
  quantity: number;
}

/**
 * Take `quantity` units out of stock for one order line.
 *
 * The decrement is a single conditional update, which is what makes this safe
 * under concurrency: if two requests race for the last unit, only one can match
 * `quantity >= n` and the other is rejected instead of driving stock negative.
 */
export async function reserveStock(
  tx: StockClient,
  input: { productId: string; size: string; color: string; quantity: number }
): Promise<Reservation> {
  const { productId, size, color, quantity } = input;

  const variant = await findVariantForOrder(tx, productId, { size, color });
  if (!variant) {
    throw new ProductUnavailableError(
      `Product variant not found for product ${productId} (Size: ${size}, Color: ${color})`
    );
  }

  // An admin flag hides the product from sale even when units remain.
  if (variant.product.manualOutOfStock || variant.product.isOutOfStock) {
    throw new ProductUnavailableError(`${variant.product.name} is currently out of stock`);
  }

  const claimed = await tx.productVariant.updateMany({
    where: { id: variant.id, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });

  if (claimed.count !== 1) {
    // Re-read for an accurate message; another order may have taken the units.
    const current = await tx.productVariant.findUnique({
      where: { id: variant.id },
      select: { quantity: true },
    });
    const available = current?.quantity ?? 0;
    throw new InsufficientStockError(
      `Insufficient stock for ${variant.product.name} (Size: ${size}, Color: ${color}). Available: ${available}, Requested: ${quantity}`,
      available,
      quantity
    );
  }

  await syncOutOfStock(tx, variant.productId);

  return {
    variantId: variant.id,
    productId: variant.productId,
    productName: variant.product.name,
    quantity,
  };
}

export interface RestorableItem {
  productId: string | null;
  size: string;
  color: string;
  quantity: number;
}

/**
 * Put stock back for every line of a cancelled order.
 *
 * The variant is re-resolved from the product/size/colour recorded on the order
 * item, because a variant row may have been re-created by an admin edit since the
 * order was placed. Lines whose variant no longer exists are skipped rather than
 * failing the whole cancellation — the order is still cancelled either way.
 */
export async function releaseStock(tx: StockClient, items: RestorableItem[]): Promise<number> {
  let restored = 0;
  const touchedProducts = new Set<string>();

  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;

    const variant = await findVariantForOrder(tx, item.productId, {
      size: item.size,
      color: item.color,
    });
    if (!variant) continue;

    await tx.productVariant.update({
      where: { id: variant.id },
      data: { quantity: { increment: item.quantity } },
    });
    restored += item.quantity;
    touchedProducts.add(variant.productId);
  }

  for (const productId of touchedProducts) {
    await syncOutOfStock(tx, productId);
  }

  return restored;
}

/**
 * Re-reserve the stock for an order that is leaving CANCELLED, e.g. an admin
 * reinstating it after a mistake. Fails if the units are no longer available,
 * which is the correct outcome: the order cannot be reinstated against stock
 * that has since been sold.
 */
export async function reReserveStock(tx: StockClient, items: RestorableItem[]): Promise<void> {
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;

    // `reserveStock` also re-syncs the out-of-stock flag for the product.
    await reserveStock(tx, {
      productId: item.productId,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    });
  }
}