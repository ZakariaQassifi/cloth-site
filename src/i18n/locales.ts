/**
 * Supported interface languages.
 *
 * `en` is the source of truth for the translation catalogue: every other locale
 * is typed against it, so a missing or misspelled key is a compile error rather
 * than a silent fallback to English at runtime.
 */

export const LOCALES = ['en', 'fr', 'ar'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'kinetic_lang';

export interface LocaleMeta {
  code: Locale;
  /** Name written in the language itself, as shown in the switcher. */
  nativeName: string;
  /** Endonym in Latin script for the English/French menus. */
  label: string;
  dir: 'ltr' | 'rtl';
  /** BCP-47 tag used for `Intl` formatting. */
  intlTag: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { code: 'en', nativeName: 'English', label: 'English', dir: 'ltr', intlTag: 'en-US' },
  fr: { code: 'fr', nativeName: 'Français', label: 'Français', dir: 'ltr', intlTag: 'fr-FR' },
  ar: { code: 'ar', nativeName: 'العربية', label: 'العربية', dir: 'rtl', intlTag: 'ar-MA' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Narrow an arbitrary stored/browser value to a supported locale. */
export function resolveLocale(value: unknown): Locale | null {
  return isLocale(value) ? value : null;
}

export function isRtlLocale(locale: Locale): boolean {
  return LOCALE_META[locale].dir === 'rtl';
}

/**
 * Best-effort match of a browser language list to a supported locale, so a
 * first-time visitor with `fr-FR` or `ar-MA` gets their language immediately.
 */
export function matchBrowserLocale(languages: readonly string[]): Locale | null {
  for (const raw of languages) {
    const base = raw.toLowerCase().split('-')[0];
    const match = resolveLocale(base);
    if (match) return match;
  }
  return null;
}