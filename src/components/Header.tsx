import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, User, Heart, ShoppingBag, Menu, X, ChevronDown } from 'lucide-react';
import { fetchCategories, fetchSettings } from '../services/catalogService';
import { useTranslation } from '../i18n/useI18n';
import { LanguageSwitcher } from '../i18n/LanguageSwitcher';
import './Header.css';

interface Category {
  id: string;
  name: string;
  slug: string;
}

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
  const [brandName, setBrandName] = useState('KINETIC');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchCategories();
      if (res.success && res.data) {
        setCategories(res.data);
      }
    } catch {
      console.warn('Failed to load categories');
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetchSettings();
      if (res.success && res.data) {
        const data = res.data;
        if (data.brandName && data.brandName.trim()) {
          setBrandName(data.brandName);
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

  const handleSpecialClick = (filter: 'sale' | 'new' | 'all', e: React.MouseEvent) => {
    e.preventDefault();
    onSelectSpecialFilter?.(filter);
    setMobileMenuOpen(false);
    setCategoriesOpen(false);
    setMobileCategoriesOpen(false);
  };

  const handleCategoryClick = (categoryName: string, e: React.MouseEvent) => {
    e.preventDefault();
    onSelectCategory?.(categoryName);
    setCategoriesOpen(false);
    setMobileCategoriesOpen(false);
  };

  const handleOutsideClick = (e: MouseEvent) => {
    if (categoriesRef.current && !categoriesRef.current.contains(e.target as Node)) {
      setCategoriesOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const renderBrand = () => {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={brandName}
          className="header__logo"
          style={{ height: '36px', width: 'auto', maxWidth: '180px' }}
        />
      );
    }
    return <span className="header__brand-text">{brandName}</span>;
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

            {/* Categories Dropdown */}
            <div className="header__nav-item header__categories-dropdown" ref={categoriesRef}>
              <button
                type="button"
                className="header__nav-link header__categories-btn"
                onClick={(e) => {
                  e.preventDefault();
                  setCategoriesOpen(!categoriesOpen);
                }}
                aria-haspopup="true"
                aria-expanded={categoriesOpen}
              >
                <span>{t('nav.categories')}</span>
                <ChevronDown size={14} className={`header__categories-chevron ${categoriesOpen ? 'open' : ''}`} />
              </button>
              {categoriesOpen && (
                <div className="header__categories-menu" role="menu">
                  <div className="header__categories-menu-inner">
                    {categories.map((cat) => (
                      <a
                        key={cat.id}
                        href="#"
                        className="header__categories-link"
                        role="menuitem"
                        onClick={(e) => handleCategoryClick(cat.name, e)}
                      >
                        {cat.name}
                      </a>
                    ))}
                    {categories.length === 0 && (
                      <span className="header__categories-empty">{t('nav.noCategories')}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

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

            {/* Mobile Categories Dropdown */}
            <li className="mobile-nav-item">
              <button
                type="button"
                className="mobile-nav-link mobile-categories-toggle"
                onClick={() => setMobileCategoriesOpen(!mobileCategoriesOpen)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
              >
                <span>{t('nav.categories')}</span>
                <ChevronDown size={16} className={`mobile-categories-chevron ${mobileCategoriesOpen ? 'open' : ''}`} />
              </button>
              {mobileCategoriesOpen && (
                <ul className="mobile-categories-submenu" role="menu">
                  {categories.map((cat) => (
                    <li key={cat.id} className="mobile-categories-subitem">
                      <a href="#" className="mobile-categories-sublink" role="menuitem" onClick={(e) => handleCategoryClick(cat.name, e)}>
                        {cat.name}
                      </a>
                    </li>
                  ))}
                  {categories.length === 0 && (
                    <li className="mobile-categories-subitem">
                      <span className="mobile-categories-sublink text-gray-500">{t('nav.noCategories')}</span>
                    </li>
                  )}
                </ul>
              )}
            </li>

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