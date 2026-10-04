/**
 * Shared input validation for the API.
 *
 * These limits exist because the storefront is not the only thing that can POST
 * to this server. They are deliberately permissive — real customer details pass
 * without fuss — while still rejecting the shapes that produce corrupt data:
 * fractional stock, quantities no warehouse could ever hold, and free-text
 * fields long enough to break a database column or an email template.
 */

/** Longest accepted value for a short free-text field. */
const MAX_SHORT_TEXT = 200;
/** Longest accepted value for a street address or note. */
const MAX_LONG_TEXT = 1000;
/** Upper bound on stock for a single variant. Far above any realistic count. */
const MAX_STOCK_QUANTITY = 1_000_000;
/** Upper bound on units of one variant in one order. */
const MAX_ORDER_QUANTITY = 1000;
/** Most lines one order may contain. */
const MAX_ORDER_ITEMS = 50;

/**
 * A whole, finite number no larger than `max`.
 *
 * `Number.isInteger` is what keeps a decimal out of the stock column: without it
 * a request for 1.5 units decrements inventory by 1.5 and leaves a quantity
 * that no product grid or "N left in stock" label can represent.
 */
export function isBoundedInteger(value: unknown, max: number): value is number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max;
}

/** Required, trimmed, length-checked string. */
export function isShortText(value: unknown, max = MAX_SHORT_TEXT): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

/** Required string with no upper bound tighter than `max`. */
export function isLongText(value: unknown, max = MAX_LONG_TEXT): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

/** Optional string: absent/null is fine, otherwise must respect `max`. */
export function isOptionalText(value: unknown, max = MAX_LONG_TEXT): boolean {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && value.length <= max;
}

/**
 * Practical email check.
 *
 * Not an attempt to implement RFC 5322 — it rejects the shapes that actually
 * cause trouble downstream (missing @, missing domain, embedded whitespace)
 * while accepting every real address, including the plus-tagged and subdomain
 * forms people genuinely use.
 */
export function isEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const email = value.trim();
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/**
 * Phone number check.
 *
 * Digits, spaces and the punctuation people actually type. The length floor
 * catches placeholder junk such as "123" that would be undiallable.
 */
export function isPhone(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const phone = value.trim();
  if (phone.length < 6 || phone.length > 32) return false;
  return /^[+()\d][\d\s+()-]*$/.test(phone);
}

/** Human-readable reason an order payload is unusable, or null when it is fine. */
export function validateOrderCustomer(input: {
  customerName?: unknown;
  customerEmail?: unknown;
  customerPhone?: unknown;
  customerCity?: unknown;
  customerAddress?: unknown;
  customerPostalCode?: unknown;
  customerNotes?: unknown;
}): string | null {
  if (!isShortText(input.customerName)) return 'A customer name is required';
  if (!isEmail(input.customerEmail)) return 'A valid email address is required';
  if (!isPhone(input.customerPhone)) return 'A valid phone number is required';
  if (!isShortText(input.customerCity)) return 'A city is required';
  if (!isLongText(input.customerAddress)) return 'A delivery address is required';
  if (!isOptionalText(input.customerPostalCode, 32)) return 'Postal code is too long';
  if (!isOptionalText(input.customerNotes)) return 'Order notes are too long';
  return null;
}

/** Reason an `items` array is unusable, or null when it is acceptable. */
export function validateOrderItems(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Missing required customer information or order items';
  }
  if (items.length > MAX_ORDER_ITEMS) {
    return `An order may contain at most ${MAX_ORDER_ITEMS} items`;
  }
  for (const item of items) {
    if (typeof item !== 'object' || item === null) return 'Invalid order item details';
    const { productId, size, color, quantity } = item as Record<string, unknown>;
    if (!isShortText(productId, 64) || !isShortText(size, 32) || !isShortText(color, 64)) {
      return 'Invalid order item details';
    }
    // Whole units only: a fractional quantity would leave un-representable
    // fractional stock behind.
    if (!isBoundedInteger(quantity, MAX_ORDER_QUANTITY) || Number(quantity) < 1) {
      return 'Invalid order item details';
    }
  }
  return null;
}

export const LIMITS = {
  MAX_SHORT_TEXT,
  MAX_LONG_TEXT,
  MAX_STOCK_QUANTITY,
  MAX_ORDER_QUANTITY,
  MAX_ORDER_ITEMS,
} as const;
/**
 * Validates a sort position.
 *
 * `Number('abc')` is `NaN`, which Prisma cannot store — it surfaced as a 500 on
 * what is really bad input from a form. Coerce here so the caller gets a 400 and
 * a usable message instead.
 */
export function validateDisplayOrder(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Display order must be a number';
  if (!Number.isInteger(n)) return 'Display order must be a whole number';
  if (n < 0 || n > 100_000) return 'Display order must be between 0 and 100000';
  return null;
}
