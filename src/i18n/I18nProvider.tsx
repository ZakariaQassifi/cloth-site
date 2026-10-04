/**
 * Language provider.
 *
 * Holds the active locale, persists the visitor's choice in `localStorage` so
 * it survives a refresh, and mirrors it onto `<html lang dir>` so Arabic renders
 * right-to-left across the entire document — including admin screens.
 *
 * Translations come from statically imported dictionaries, so there is no async
 * gap where the UI would flash untranslated text.
 */

import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { en, type Dictionary } from './translations/en';
import { fr } from './translations/fr';
import { ar } from './translations/ar';
import { I18nContext, type I18nContextValue, type TranslateParams } from './i18nContext';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  LOCALE_STORAGE_KEY,
  isRtlLocale,
  matchBrowserLocale,
  resolveLocale,
  type Locale,
} from './locales';
import type { TranslationKey } from './translations/en';
import { formatCurrency } from '../../shared/currency';

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, ar };

/**
 * Resolve a key for the active locale. The dictionaries are typed, so a missing
 * key is a compile error; these fallbacks only guard a runtime-incomplete object.
 */
function lookup(locale: Locale, key: TranslationKey): string {
  return DICTIONARIES[locale]?.[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}

/** Stored choice wins; otherwise fall back to the browser's language. */
function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = resolveLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage blocked - fall through to the browser preference.
  }
  return matchBrowserLocale(navigator.languages ?? [navigator.language]) ?? DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const meta = LOCALE_META[locale];

  // Applied before paint so the first frame is already in the right direction.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = meta.intlTag;
    root.dir = meta.dir;
  }, [meta.dir, meta.intlTag]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Storage blocked — the choice still applies for this page view.
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const template = lookup(locale, key);
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = params[name];
        return value === undefined ? match : String(value);
      });
    },
    [locale]
  );

  /**
   * Interpolates a template whose parameters may be React nodes.
   *
   * The result is a keyed list so React does not warn about missing keys on the
   * array it returns; text segments and interpolated nodes both get stable keys
   * derived from their position in the template.
   */
  const tRich = useCallback(
    (key: TranslationKey, params?: TranslateParams): React.ReactNode => {
      const template = lookup(locale, key);
      if (!params) return template;

      const parts: React.ReactNode[] = [];
      const pattern = /\{(\w+)\}/g;
      let cursor = 0;
      let slot = 0;
      let match: RegExpExecArray | null;

      const pushText = (text: string) => {
        if (text) parts.push(<React.Fragment key={`text-${slot++}`}>{text}</React.Fragment>);
      };

      while ((match = pattern.exec(template)) !== null) {
        pushText(template.slice(cursor, match.index));

        const value = params[match[1]];
        if (value === undefined) {
          pushText(match[0]);
        } else if (React.isValidElement(value)) {
          parts.push(React.cloneElement(value, { key: `param-${slot++}` }));
        } else {
          pushText(String(value));
        }

        cursor = match.index + match[0].length;
      }
      pushText(template.slice(cursor));

      return parts;
    },
    [locale]
  );

  const formatDate = useCallback(
    (value: string | Date) =>
      new Intl.DateTimeFormat(meta.intlTag, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(value)),
    [meta.intlTag]
  );

  const formatDateTime = useCallback(
    (value: string | Date) =>
      new Intl.DateTimeFormat(meta.intlTag, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value)),
    [meta.intlTag]
  );

  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(meta.intlTag).format(value),
    [meta.intlTag]
  );

  // Digits follow the active locale; the currency itself comes from the shared
  // config so the storefront, admin and emails can never disagree on the unit.
  const formatMoney = useCallback(
    (value: number) => formatCurrency(value, meta.intlTag),
    [meta.intlTag]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: meta.dir,
      isRtl: isRtlLocale(locale),
      setLocale,
      t,
      tRich,
      formatDate,
      formatDateTime,
      formatNumber,
      formatMoney,
    }),
    [locale, meta.dir, setLocale, t, tRich, formatDate, formatDateTime, formatNumber, formatMoney]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
