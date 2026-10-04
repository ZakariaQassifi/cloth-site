import React, { useEffect, useRef, useState } from 'react';
import { Languages, Check } from 'lucide-react';
import { useI18n } from './useI18n';
import { LOCALES, LOCALE_META } from './locales';
import './LanguageSwitcher.css';

/**
 * Language picker for the storefront header.
 *
 * Renders each language in its own script (English / Français / العربية) so the
 * options are readable whichever locale is active. Choice is persisted by the
 * provider, which also flips `<html dir>` for Arabic.
 */
export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape, matching native menu behaviour.
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const active = LOCALE_META[locale];

  return (
    <div className="lang-switcher" ref={containerRef}>
      <button
        type="button"
        className="header__action-btn"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={t('language.switcher')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={t('language.current', { language: active.nativeName })}
      >
        <Languages size={20} />
      </button>

      {isOpen && (
        <div className="lang-switcher__menu" role="menu">
          {LOCALES.map((code) => {
            const option = LOCALE_META[code];
            const isActive = option.code === locale;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                className={`lang-switcher__option ${isActive ? 'active' : ''}`}
                lang={option.intlTag}
                dir={option.dir}
                onClick={() => {
                  setLocale(code);
                  setIsOpen(false);
                }}
              >
                <span className="lang-switcher__label">{option.nativeName}</span>
                {isActive && <Check size={14} className="lang-switcher__check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};