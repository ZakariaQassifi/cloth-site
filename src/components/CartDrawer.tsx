import React from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { getCartLineTotal, type CartLine } from '../data/cart';
import { getVariantStock, toSwatchColor } from '../data/products';
import { useTranslation } from '../i18n/useI18n';
import { useColorLabel } from '../i18n/hooks';
import { Button } from './Button';
import './CartDrawer.css';

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  onUpdateQuantity: (cartId: string, delta: number) => void;
  onRemoveItem: (cartId: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  lines,
  subtotal,
  shipping,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const { t, formatMoney } = useTranslation();
  const colorLabel = useColorLabel();
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  /**
   * Units still available for a cart line, taken from the product snapshot the
   * line was created with. The `+` control stops at this number so the bag
   * cannot hold a quantity the server would reject; the server still has the
   * final say, since stock may change after the item was added.
   */
  const availableFor = (line: CartLine): number =>
    Math.max(0, getVariantStock(line.product, line.selectedSize, line.selectedColor));

  return (
    <>
      <div
        className={`cart-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <div className={`cart-drawer ${isOpen ? 'open' : ''}`}>
        <div className="cart-drawer__header">
          <h3 className="cart-drawer__title">{t('cart.title', { count: itemCount })}</h3>
          <button
            type="button"
            className="header__action-btn"
            onClick={onClose}
            aria-label={t('cart.close')}
          >
            <X size={24} />
          </button>
        </div>

        <div className="cart-drawer__body">
          {lines.length === 0 ? (
            <div className="cart-empty">
              <ShoppingBag size={48} strokeWidth={1.5} />
              <h4 className="cart-empty__title">{t('cart.empty')}</h4>
              <p className="text-body" style={{ fontSize: '0.875rem' }}>
                {t('cart.emptyDesc')}
              </p>
              <div style={{ marginTop: '1.5rem', width: '100%' }}>
                <Button variant="primary" size="md" fullWidth onClick={onClose}>
                  {t('cart.continueShopping')}
                </Button>
              </div>
            </div>
          ) : (
            lines.map((line) => (
              <div key={line.cartId} className="cart-item">
                <div className="cart-item__image-wrap">
                  <img
                    src={line.image}
                    alt={line.name}
                    className="cart-item__image"
                  />
                </div>
                <div className="cart-item__details">
                  <div className="cart-item__top">
                    <div>
                      <span className="text-caption" style={{ fontSize: '0.6875rem' }}>{line.category}</span>
                      <h4 className="cart-item__name">{line.name}</h4>
                    </div>
                    <button
                      type="button"
                      className="cart-item__remove-btn"
                      onClick={() => onRemoveItem(line.cartId)}
                      aria-label={t('cart.removeItem')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="cart-item__meta">
                    <div className="cart-item__meta-item">
                      <span>{t('cart.colorLabel')}</span>
                      <span
                        className="cart-item__color-dot"
                        style={{ backgroundColor: toSwatchColor(line.selectedColor) }}
                        title={colorLabel(line.selectedColor)}
                      />
                    </div>
                    <div className="cart-item__meta-item">
                      <span>{t('cart.sizeLabel')}</span>
                      <strong>{line.selectedSize}</strong>
                    </div>
                  </div>

                  <div className="cart-item__bottom">
                    <span className="cart-item__price">{formatMoney(getCartLineTotal(line))}</span>
                    <div className="cart-item__quantity-ctrl">
                      <button
                        type="button"
                        className="cart-item__qty-btn"
                        onClick={() => onUpdateQuantity(line.cartId, -1)}
                        aria-label={t('cart.decreaseQuantity')}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="cart-item__qty-value">{line.quantity}</span>
                      <button
                        type="button"
                        className="cart-item__qty-btn"
                        onClick={() => onUpdateQuantity(line.cartId, 1)}
                        aria-label={t('cart.increaseQuantity')}
                        disabled={line.quantity >= availableFor(line)}
                        title={
                          line.quantity >= availableFor(line)
                            ? t('cart.maxStock', { count: availableFor(line) })
                            : undefined
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {lines.length > 0 && (
          <div className="cart-drawer__footer">
            <div className="cart-summary-row">
              <span className="cart-summary-label">{t('common.subtotal')}</span>
              <span style={{ fontWeight: 600 }}>{formatMoney(subtotal)}</span>
            </div>
            <div className="cart-summary-row">
              <span className="cart-summary-label">{t('common.shipping')}</span>
              <span style={{ fontWeight: 600 }}>
                {shipping === 0 ? t('common.freeUpper') : formatMoney(shipping)}
              </span>
            </div>
            <div className="cart-summary-row cart-summary-row--total">
              <span className="cart-summary-label">{t('common.total')}</span>
              <span>{formatMoney(subtotal + shipping)}</span>
            </div>

            <div className="cart-actions">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={onCheckout}
              >
                {t('cart.proceedToCheckout')}
              </Button>
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={onClose}
              >
                {t('cart.continueShopping')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};