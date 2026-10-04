import React from 'react';
import { Heart } from 'lucide-react';
import { useWishlist } from '../context/useWishlist';
import { useTranslation } from '../i18n/useI18n';
import type { Product } from '../data/products';
import './WishlistButton.css';

export interface WishlistButtonProps {
  product: Product;
  /**
   * `overlay` sits on a product image (the card), `inline` sits in a row of
   * actions (the detail page and the wishlist page).
   */
  variant?: 'overlay' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * The ♡ toggle shared by product cards, the product detail page and the
 * wishlist page, so saving a product behaves identically everywhere.
 *
 * Reads and writes the wishlist itself, and stops click propagation so pressing
 * it never also opens the product card behind it.
 */
export const WishlistButton: React.FC<WishlistButtonProps> = ({
  product,
  variant = 'overlay',
  size = 'md',
  className = '',
}) => {
  const { t } = useTranslation();
  const { isWishlisted, toggle } = useWishlist();
  const saved = isWishlisted(product.id);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // The card's own click handler opens the product page.
    event.preventDefault();
    event.stopPropagation();
    toggle(product);
  };

  return (
    <button
      type="button"
      className={`wishlist-btn wishlist-btn--${variant} wishlist-btn--${size} ${
        saved ? 'wishlist-btn--active' : ''
      } ${className}`}
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={
        saved
          ? t('product.removeFromWishlist', { name: product.name })
          : t('product.addToWishlist')
      }
      title={
        saved
          ? t('product.removeFromWishlist', { name: product.name })
          : t('product.addToWishlist')
      }
      data-wishlist-toggle={product.id}
    >
      <Heart size={size === 'lg' ? 22 : size === 'sm' ? 14 : 18} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
};