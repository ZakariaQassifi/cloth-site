/**
 * Shared i18n types and the React context object.
 *
 * Deliberately separate from `I18nProvider.tsx` so that module exports only a
 * component (React Fast Refresh requires this), and so hooks can reach the
 * context without pulling in the provider's implementation.
 */

import { createContext } from 'react';
import type React from 'react';
import type { TranslationKey } from './translations/en';
import type { Locale } from './locales';

export type TranslateParams = Record<string, React.ReactNode>;

export interface I18nContextValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  setLocale: (locale: Locale) => void;
  /** Translate to a string, substituting `{placeholder}` params. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /**
   * Like `t`, but params may be React nodes — used where a translated sentence
   * needs inline markup, such as a highlighted result count.
   */
  tRich: (key: TranslationKey, params?: TranslateParams) => React.ReactNode;
  /** Locale-aware date, e.g. "4 octobre 2026". */
  formatDate: (value: string | Date) => string;
  /** Locale-aware date and time, used for order timestamps. */
  formatDateTime: (value: string | Date) => string;
  /** Locale-aware number with locale grouping. */
  formatNumber: (value: number) => string;
  /**
   * Money for display. The currency comes from the shared currency config, so
   * every screen quotes the same unit; digits follow the active locale.
   */
  formatMoney: (value: number) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);