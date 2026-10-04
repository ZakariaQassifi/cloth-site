/**
 * Accessors for the active language.
 *
 * Split out of `I18nProvider.tsx` so the provider module keeps exporting only a
 * component, which is what React Fast Refresh requires. Every storefront and
 * admin component imports `useTranslation` from here.
 */

import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './i18nContext';
import type { TranslationKey } from './translations/en';

/**
 * Full language context. Must be called inside `I18nProvider`; both the
 * storefront and the admin tree are wrapped by it in `main.tsx`.
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

/** Convenience hook for components that only need the translator. */
export function useTranslation(): I18nContextValue {
  return useI18n();
}

export type { TranslationKey };