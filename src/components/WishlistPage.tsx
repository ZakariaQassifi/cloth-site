import React, { useMemo } from 'react';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import {
  getUnitPrice,
  isProductOnSale,
  isProductOutOfStock,
  getProductStock,
  type Product,
} from '../data/products';
import {
  isWishlistEntryPurchasable,
  pickPurchasableVariant,
  type WishlistEntry,
} from '../data/wishlist';
import { useTranslation } from '../i18n/useI18n';
import { Button } from './Button';
import { Container } from './Container';
import { WishlistButton } from './WishlistButton';
import { navigate } from '../routing/routes';
import './WishlistPage.css';

export interface WishlistPageProps {
  entries: WishlistEntry[];
  /**
   * Live catalogue, used to refresh price and availability. An entry whose
   * product is no longer published falls back to its stored snapshot and is
   * reported as unavailable.
   */
  products: Product[];
  onRemove: (productId: string) => void;
  onClear: () => void;
  onAddToCart: (product: Product, quantity: number, color: string, size: string) => void;
  onSelectProduct: (product: Product) => void;
}

/**
 * Saved products, with the essentials a shopper needs to decide:
 * image, name, price and whether it can still be bought.
 */
export const WishlistPage: React.FC<WishlistPageProps> = ({
  entries,
  products,
  onRemove,
  onClear,
  onAddToCart,
  onSelectProduct,
}) => {
  const { t, formatMoney } = useTranslation();

  /**
   * Prefer the live product so a price change or a stock-out is reflected
   * immediately; fall back to the snapshot captured when it was saved.
   */
  const resolved = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        product: products.find((item) => item.id === entry.productId) ?? entry.product,
        /** Present in the catalogue as a published product. */
        isListed: products.some((item) => item.id === entry.productId),
      })),
    [entries, products]
  );

  return (
    <div className="wishlist-page">
      <Container maxWidth="lg">
        <div className="wishlist-page__header">
          <div>
            <h1 className="wishlist-page__title">{t('wishlist.title')}</h1>
            <p className="wishlist-page__subtitle">
              {entries.length === 0
                ? t('wishlist.subtitleEmpty')
                : entries.length === 1
                  ? t('wishlist.subtitleOne')
                  : t('wishlist.subtitleOther', { count: entries.length })}
            </p>
          </div>
          {entries.length > 0 && (
            <button
              type="button"
              className="wishlist-page__clear"
              onClick={onClear}
              aria-label={t('wishlist.clearAll')}
            >
              <Trash2 size={16} />
              <span>{t('wishlist.clearAll')}</span>
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="wishlist-empty">
            <div className="wishlist-empty__icon">
              <Heart size={44} strokeWidth={1.5} />
            </div>
            <h2 className="wishlist-empty__title">{t('wishlist.empty')}</h2>
            <p className="wishlist-empty__text">{t('wishlist.emptyDesc')}</p>
            <div className="wishlist-empty__action">
              <Button variant="primary" size="md" onClick={() => navigate('/')}>
                {t('wishlist.browseProducts')}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="wishlist-grid">
            {resolved.map(({ entry, product, isListed }) => {
              const soldOut = isProductOutOfStock(product);
              const unavailable = !isListed || soldOut || !isWishlistEntryPurchasable(product);
              const onSale = isProductOnSale(product);
              const stock = getProductStock(product);

              return (
                <li key={entry.productId} className="wishlist-item">
                  <button
                    type="button"
                    className="wishlist-item__media"
                    onClick={() => onSelectProduct(product)}
                    aria-label={t('common.viewDetails')}
                  >
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="wishlist-item__image"
                      loading="lazy"
                    />
                    {unavailable && (
                      <span className="wishlist-item__unavailable">
                        {t('wishlist.unavailable')}
                      </span>
                    )}
                  </button>

                  <div className="wishlist-item__body">
                    <span className="wishlist-item__category">{product.category}</span>
                    <h3
                      className="wishlist-item__name"
                      onClick={() => onSelectProduct(product)}
                    >
                      {product.name}
                    </h3>

                    <div className="wishlist-item__pricing">
                      {onSale ? (
                        <>
                          <span className="wishlist-item__price wishlist-item__price--sale">
                            {formatMoney(getUnitPrice(product))}
                          </span>
                          <span className="wishlist-item__price wishlist-item__price--original">
                            {formatMoney(product.price)}
                          </span>
                        </>
                      ) : (
                        <span className="wishlist-item__price">
                          {formatMoney(product.price)}
                        </span>
                      )}
                    </div>

                    <p
                      className={`wishlist-item__stock ${unavailable ? 'wishlist-item__stock--out' : ''}`}
                    >
                      {unavailable ? (
                        t('wishlist.outOfStock')
                      ) : (
                        t('wishlist.inStock', { count: stock })
                      )}
                    </p>

                    <div className="wishlist-item__actions">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={unavailable}
                        className="wishlist-item__add"
                        onClick={() => {
                          const variant = pickPurchasableVariant(product);
                          onAddToCart(product, 1, variant.color, variant.size);
                        }}
                      >
                        <ShoppingBag size={16} />
                        {t('wishlist.addToCart')}
                      </Button>
                      <WishlistButton
                        product={product}
                        variant="inline"
                        className="wishlist-item__remove-heart"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="wishlist-item__remove"
                    onClick={() => onRemove(entry.productId)}
                    aria-label={t('wishlist.remove', { name: product.name })}
                    title={t('wishlist.remove', { name: product.name })}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </div>
  );
};