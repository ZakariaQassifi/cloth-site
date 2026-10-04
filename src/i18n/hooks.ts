/**
 * Locale-aware presentation helpers for values that live in the database.
 *
 * Colours, order statuses and payment methods are stored as language-neutral
 * codes (`#0f0f0f`, `PENDING`, `CASH_ON_DELIVERY`), so they are resolved to a
 * translated label at render time rather than being translated on write.
 */

import { useCallback } from 'react';
import { useI18n } from './useI18n';
import { toColorName } from '../data/products';
import type { TranslationKey } from './translations/en';
import type { OrderStatus, PaymentMethod } from '../data/order';

/**
 * Colour names produced by `toColorName`, normalised to lowercase. Anything
 * outside this table (a raw hex the catalogue does not know) falls through and
 * is displayed verbatim.
 */
const COLOR_LABEL_KEYS: Record<string, TranslationKey> = {
  black: 'color.black',
  white: 'color.white',
  'light grey': 'color.lightGrey',
  grey: 'color.grey',
  gray: 'color.grey',
  charcoal: 'color.charcoal',
  navy: 'color.navy',
  brown: 'color.brown',
  beige: 'color.beige',
  cream: 'color.cream',
  tan: 'color.tan',
  yellow: 'color.yellow',
  purple: 'color.purple',
  pink: 'color.pink',
  orange: 'color.orange',
  green: 'color.green',
  blue: 'color.blue',
  red: 'color.red',
  olive: 'color.green',
  'grey melange': 'color.greyMelange',
  'gray melange': 'color.greyMelange',
  heather: 'color.heather',
};

const ORDER_STATUS_KEYS: Record<OrderStatus, TranslationKey> = {
  PENDING: 'status.pending',
  CONFIRMED: 'status.confirmed',
  SHIPPED: 'status.shipped',
  DELIVERED: 'status.delivered',
  CANCELLED: 'status.cancelled',
};

const PAYMENT_METHOD_KEYS: Record<PaymentMethod, TranslationKey> = {
  CASH_ON_DELIVERY: 'payment.cod',
};

/** Translate a stored colour value (hex or name) into a readable label. */
export function useColorLabel(): (value: string) => string {
  const { t } = useI18n();
  return useCallback(
    (value: string) => {
      if (!value) return '';
      const name = toColorName(value);
      const key = COLOR_LABEL_KEYS[name.trim().toLowerCase()];
      return key ? t(key) : name;
    },
    [t]
  );
}

/** Translate an order status, falling back to the raw code if unknown. */
export function useOrderStatusLabel(): (status: OrderStatus | string) => string {
  const { t } = useI18n();
  return useCallback(
    (status: OrderStatus | string) => {
      const key = ORDER_STATUS_KEYS[status as OrderStatus];
      return key ? t(key) : String(status);
    },
    [t]
  );
}

/** Translate the payment method; the store only accepts Cash on Delivery. */
export function usePaymentLabel(): (method: PaymentMethod | string) => string {
  const { t } = useI18n();
  return useCallback(
    (method: PaymentMethod | string) => {
      const key = PAYMENT_METHOD_KEYS[method as PaymentMethod];
      return key ? t(key) : String(method);
    },
    [t]
  );
}