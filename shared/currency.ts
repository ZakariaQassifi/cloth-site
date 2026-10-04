/**
 * Currency definition — the single source of truth for money on this project.
 *
 * Every displayed amount (storefront, admin, order emails) is rendered through
 * `formatCurrency`, so changing the currency is a one-line edit here rather than
 * a hunt through every price label.
 *
 * Amounts are stored in the database as bare numbers, which is safe because a
 * store only ever trades in one currency; the unit is implied by this module.
 */

/** ISO 4217 code. Used for machine-readable contexts and future multi-currency. */
export const CURRENCY_CODE = 'MAD';

/**
 * Display symbol. Moroccan dirham is written "DH" in English and French, which
 * is what shoppers here expect, so the symbol is pinned rather than left to
 * `Intl` — which renders Arabic as "د.م." and would read as a different currency
 * to a large part of the store's audience.
 */
export const CURRENCY_SYMBOL = 'DH';

/** Dirhams always carry two decimals, so a total never looks truncated. */
export const CURRENCY_DECIMALS = 2;

/** Coerce anything into a usable amount, so a bad value can never print "NaN". */
export function toAmount(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Round to the currency's precision.
 *
 * Called on every derived total so repeated additions of fractional dirhams
 * cannot leave the stored total a fraction of a cent away from the sum of the
 * printed lines.
 */
export function roundAmount(value: unknown): number {
  return Number(toAmount(value).toFixed(CURRENCY_DECIMALS));
}

/**
 * Format an amount for display.
 *
 * `localeTag` selects the digit grouping and decimal separators. It is optional
 * so the API can format amounts for emails with a stable representation rather
 * than one that varies with the recipient's assumptions.
 */
export function formatCurrency(value: unknown, localeTag?: string): string {
  const amount = toAmount(value);
  const digits = localeTag
    ? new Intl.NumberFormat(localeTag, {
        minimumFractionDigits: CURRENCY_DECIMALS,
        maximumFractionDigits: CURRENCY_DECIMALS,
      }).format(amount)
    : amount.toFixed(CURRENCY_DECIMALS);

  return `${digits} ${CURRENCY_SYMBOL}`;
}