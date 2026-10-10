import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, Heart, ShoppingBag, Menu, X } from 'lucide-react';
import { useCategories } from '../context/useCatalog';
import { fetchSettings } from '../services/catalogService';
import { useTranslation } from '../i18n/useI18n';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import './Header.css';

export interface HeaderProps {
  cartCount?: number;
  wishlistCount?: number;
  onCartClick?: () => void;
  onWishlistClick?: () => void;
  onSelectCategory?: (category: string) => void;
  onSelectSpecialFilter?: (filter: 'sale' | 'new' | 'all') => void;
  onContactClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount = 0,
  wishlistCount = 0,
  onCartClick,
  onWishlistClick,
  onSelectCategory,
  onSelectSpecialFilter,
  onContactClick,
}) => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [storeName, setStoreName] = useState('KINETIC');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Categories come from the shared catalog so the nav can never drift from
  // what the API actually serves.
  const categories = useCategories();

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetchSettings();
      if (res.success && res.data) {
        const data = res.data;
        if (data.storeName && data.storeName.trim()) {
          setStoreName(data.storeName);
        }
        if (data.logoUrl && data.logoUrl.trim()) {
          setLogoUrl(data.logoUrl);
        }
      }
    } catch {
      console.warn('Failed to load header settings');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleNavClick = (category: string, e: React.MouseEvent) => {
    e.preventDefault();
    onSelectCategory?.(category);
    setMobileMenuOpen(false);
  };

  const handleSpecialClick = (filter: 'sale' | 'new' | 'all', e: React.MouseEvent) => {
    e.preventDefault();
    onSelectSpecialFilter?.(filter);
    setMobileMenuOpen(false);
  };

  const mainNavItems = categories.slice(0, 5);
  const otherItems = categories.slice(5);

  const renderBrand = () => {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={storeName}
          className="header__logo"
          style={{ height: '36px', width: 'auto', maxWidth: '180px' }}
        />
      );
    }
    return <span className="header__brand-text">{storeName}</span>;
  };

  return (
    <>
      <header className="header">
        <div className="header__container">
          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            className="header__mobile-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-label={t('nav.openMenu')}
          >
            <Menu size={24} />
          </button>

          {/* Left: Brand Logo */}
          <a
            href="#"
            className="header__brand"
            onClick={(e) => {
              e.preventDefault();
              onSelectSpecialFilter?.('all');
            }}
          >
            {renderBrand()}
          </a>

          {/* Center: Desktop Navigation */}
          <nav className="header__nav-desktop" aria-label={t('nav.mainNavigation')}>
            <div className="header__nav-item">
              <a href="#" className="header__nav-link" onClick={(e) => handleSpecialClick('new', e)}>{t('nav.new')}</a>
            </div>

            {mainNavItems.map((cat) => (
              <div key={cat.id} className="header__nav-item">
                <a href="#" className="header__nav-link" onClick={(e) => handleNavClick(cat.name, e)}>
                  {cat.name.toUpperCase()}
                </a>
              </div>
            ))}

            {otherItems.length > 0 && (
              <div className="header__nav-item">
                <a href="#" className="header__nav-link">{t('nav.more')}</a>
                <div className="mega-menu" style={{ width: 'auto', minWidth: '200px', left: 'auto' }}>
                  <div className="mega-menu__container" style={{ display: 'block', padding: '1rem' }}>
                    <ul className="mega-menu__list">
                      {otherItems.map((cat) => (
                        <li key={cat.id}>
                          <a href="#" className="mega-menu__link" onClick={(e) => handleNavClick(cat.name, e)}>
                            {cat.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="header__nav-item">
              <a href="#" className="header__nav-link" onClick={(e) => handleSpecialClick('sale', e)} style={{ color: '#e11d48' }}>{t('nav.sale')}</a>
            </div>

            <div className="header__nav-item">
              <a href="#" className="header__nav-link" onClick={(e) => { e.preventDefault(); onContactClick?.(); }}>{t('nav.contact')}</a>
            </div>
          </nav>

          {/* Right: Actions */}
          <div className="header__actions">
            <LanguageSwitcher />
            <button type="button" className="header__action-btn" aria-label={t('nav.search')}>
              <Search size={20} />
            </button>
            <button type="button" className="header__action-btn" aria-label={t('nav.account')}>
              <User size={20} />
            </button>
            <button
              type="button"
              className="header__action-btn"
              aria-label={t('nav.wishlist')}
              onClick={onWishlistClick}
              data-wishlist-link="header"
            >
              <Heart size={20} />
              {wishlistCount > 0 && (
                <span className="header__cart-badge">{wishlistCount}</span>
              )}
            </button>
            <button
              type="button"
              className="header__action-btn"
              aria-label={t('nav.shoppingBag')}
              onClick={onCartClick}
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="header__cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-overlay ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Slide-out Drawer */}
      <div className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer__header">
          {renderBrand()}
          <button
            type="button"
            className="header__action-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t('nav.closeMenu')}
          >
            <X size={24} />
          </button>
        </div>

        <div className="mobile-drawer__body">
          <ul className="mobile-nav-list">
            <li className="mobile-nav-item">
              <a href="#" className="mobile-nav-link" onClick={(e) => handleSpecialClick('new', e)}>
                {t('nav.new')}
              </a>
            </li>

            {categories.map((cat) => (
              <li key={cat.id} className="mobile-nav-item">
                <a href="#" className="mobile-nav-link" onClick={(e) => handleNavClick(cat.name, e)}>
                  {cat.name.toUpperCase()}
                </a>
              </li>
            ))}

            <li className="mobile-nav-item">
              <a href="#" className="mobile-nav-link" style={{ color: '#e11d48' }} onClick={(e) => handleSpecialClick('sale', e)}>
                {t('nav.sale')}
              </a>
            </li>

            <li className="mobile-nav-item" style={{ borderBottom: 'none' }}>
              <a href="#" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); onContactClick?.(); setMobileMenuOpen(false); }}>
                {t('nav.contact')}
              </a>
            </li>
          </ul>
        </div>

        <div className="mobile-drawer__footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <LanguageSwitcher />
            <span className="text-caption">{t('language.switcher')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-caption">{t('nav.accountSettings')}</span>
            <User size={18} />
          </div>
          <button
            type="button"
            className="mobile-drawer__footer-link"
            onClick={() => {
              setMobileMenuOpen(false);
              onWishlistClick?.();
            }}
          >
            <span className="text-caption">{t('nav.wishlist')}</span>
            <span className="mobile-drawer__footer-meta">
              {wishlistCount > 0 && (
                <span className="header__cart-badge">{wishlistCount}</span>
              )}
              <Heart size={18} />
            </span>
          </button>
        </div>
      </div>
    </>
  );
};