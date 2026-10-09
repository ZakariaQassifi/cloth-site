import React from 'react';
import {
  getDiscountPercent,
  getPrimaryImage,
  getProductImages,
  getShippingPrice,
  getUnitPrice,
  isProductOnSale,
  isProductOutOfStock,
  toSwatchColor,
  type Product,
} from '../data/products';
import { useTranslation } from '../i18n/useI18n';
import { WishlistButton } from './WishlistButton';
import './ProductCard.css';

export interface ProductCardProps {
  product: Product;
  onClick?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  const { t, formatMoney } = useTranslation();
  const images = getProductImages(product);
  const isOnSale = isProductOnSale(product);
  const discountPercent = getDiscountPercent(product);
  const isOutOfStock = isProductOutOfStock(product);
  const shippingPrice = getShippingPrice(product);
  const hoverImage = product.hoverImageUrl ?? images[1];

  return (
    <div
      className={`product-card ${isOutOfStock ? 'product-card--out-of-stock' : ''}`}
      onClick={onClick}
    >
      <div className="product-card__image-container">
        <img
          src={getPrimaryImage(product)}
          alt={product.name}
          className="product-card__img product-card__img--primary"
          loading="lazy"
        />
        {hoverImage && (
          <img
            src={hoverImage}
            alt={t('product.alternateView', { name: product.name })}
            className="product-card__img product-card__img--secondary"
            loading="lazy"
          />
        )}
        {isOnSale && (
          <span className="product-card__badge product-card__badge--sale">-{discountPercent}%</span>
        )}
        {isOutOfStock && (
          <div className="product-card__outofstock-overlay">
            <span>{t('product.outOfStock')}</span>
          </div>
        )}
        <WishlistButton product={product} variant="overlay" />
      </div>

      <div className="product-card__info">
        <span className="product-card__category">{product.category}</span>
        <h4 className="product-card__name">{product.name}</h4>
        <div className="product-card__footer">
          <div className="product-card__prices" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isOnSale ? (
              <>
                <span className="product-card__price product-card__price--sale" style={{ color: '#166534', fontWeight: 700 }}>{formatMoney(getUnitPrice(product))}</span>
                <span className="product-card__price product-card__price--original" style={{ textDecoration: 'line-through', color: '#6b7280', fontSize: '0.85rem' }}>{formatMoney(product.price)}</span>
              </>
            ) : (
              <span className="product-card__price">{formatMoney(product.price)}</span>
            )}
          </div>
          {shippingPrice > 0 && (
            <div className="product-card__shipping" style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
              + {formatMoney(shippingPrice)} {t('common.shipping')}
            </div>
          )}
          {product.colors && product.colors.length > 0 && (
            <div className="product-card__colors">
              {product.colors.map((color, index) => (
                <span
                  key={`${color}-${index}`}
                  className="product-card__color-dot"
                  style={{ backgroundColor: toSwatchColor(color) }}
                  title={color}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};