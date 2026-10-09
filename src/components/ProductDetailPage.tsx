import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getProductColors,
  getProductDescription,
  getProductImages,
  getProductSizes,
  getShippingPrice,
  getUnitPrice,
  getVariantStock,
  isProductOnSale,
  isProductOutOfStock,
  toSwatchColor,
  type Product,
} from '../data/products';
import { useTranslation } from '../i18n/useI18n';
import { useColorLabel } from '../i18n/hooks';
import { Button } from './Button';
import { WishlistButton } from './WishlistButton';
import './ProductDetailPage.css';

export interface ProductDetailPageProps {
  product: Product;
  onBack: () => void;
  onAddToCart?: (product: Product, quantity: number, selectedColor: string, selectedSize: string) => void;
  onBuyNow?: (product: Product, quantity: number, selectedColor: string, selectedSize: string) => void;
}

/**
 * Choose a size and colour that correspond to a real variant row.
 *
 * Sizes and colours are independent lists, so `sizes[0]` combined with
 * `colors[0]` is not necessarily something the store stocks. On a product whose
 * colours are not offered in every size — a black bag in S/M and a tan bag in
 * L/XL, say — that default pair matches no variant, so the page reported "out of
 * stock" and disabled Add to Cart for a fully stocked product.
 *
 * Preference order: the requested pair, then the requested size in any colour,
 * then the requested colour in any size, then anything actually in stock.
 */
function pickAvailableVariant(
  product: Product,
  sizes: string[],
  colors: string[],
  preferredSize?: string,
  preferredColor?: string
): { size: string; color: string } {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const first = variants[0];
  if (variants.length === 0 || !first) {
    return { size: preferredSize ?? sizes[0] ?? 'M', color: preferredColor ?? colors[0] ?? '' };
  }

  const matches = (size: string, color: string) =>
    variants.some((v) => v.size === size && v.color === color);

  const bySize = preferredSize
    ? variants.find((v) => v.size === preferredSize && (!preferredColor || v.color === preferredColor))
      ?? variants.find((v) => v.size === preferredSize)
    : null;
  if (bySize) {
    // Keep the requested colour only if that size is genuinely offered in it.
    const color = preferredColor && matches(bySize.size, preferredColor) ? preferredColor : bySize.color;
    return { size: bySize.size, color };
  }

  const byColor = preferredColor ? variants.find((v) => v.color === preferredColor) : null;
  if (byColor) return { size: byColor.size, color: byColor.color };

  const inStock = variants.find((v) => Number(v.quantity) > 0) ?? first;
  return { size: inStock.size, color: inStock.color };
}

/** Parse and format product details JSON string into HTML. */
function formatDetails(details: string): string {
  try {
    const parsed = JSON.parse(details);
    if (Array.isArray(parsed)) {
      return `<ul>${parsed.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed)
        .map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</p>`)
        .join('');
    }
  } catch {
    // If not valid JSON, treat as plain text with line breaks
  }
  return details.split('\n').map(line => `<p>${escapeHtml(line)}</p>`).join('');
}

/** Parse and format shipping info JSON string into HTML. */
function formatShippingInfo(shippingInfo: string): string {
  try {
    const parsed = JSON.parse(shippingInfo);
    if (Array.isArray(parsed)) {
      return `<ul>${parsed.map((item: string) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed)
        .map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</p>`)
        .join('');
    }
  } catch {
    // If not valid JSON, treat as plain text with line breaks
  }
  return shippingInfo.split('\n').map(line => `<p>${escapeHtml(line)}</p>`).join('');
}

/** Escape HTML to prevent XSS. */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  onBack,
  onAddToCart,
  onBuyNow,
}) => {
  const { t, formatMoney } = useTranslation();
  const colorLabel = useColorLabel();
  const images = getProductImages(product);
  const sizes = getProductSizes(product);
  const colors = getProductColors(product);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  // Start on a size/colour pair that is actually stocked, so the page never
  // opens on a combination the store does not have.
  const [initialVariant] = useState(() => pickAvailableVariant(product, sizes, colors, sizes[0], colors[0]));
  const [selectedColor, setSelectedColor] = useState(initialVariant.color);
  const [selectedSize, setSelectedSize] = useState(initialVariant.size);
  const [quantity, setQuantity] = useState(1);
  const [openAccordion, setOpenAccordion] = useState<string | null>('details');

  /**
   * Switching one option can strand the other on an impossible pairing, so pull
   * the counterpart across to a colour/size the new choice is actually offered in.
   */
  const handleSelectColor = (color: string) => {
    const next = pickAvailableVariant(product, sizes, colors, selectedSize, color);
    setSelectedColor(next.color);
    setSelectedSize(next.size);
  };

  const handleSelectSize = (size: string) => {
    const next = pickAvailableVariant(product, sizes, colors, size, selectedColor);
    setSelectedSize(next.size);
    setSelectedColor(next.color);
  };

  const variantStock = getVariantStock(product, selectedSize, selectedColor);
  const outOfStock = isProductOutOfStock(product) || (variantStock <= 0 && colors.length > 0);
  const maxQuantity = Math.max(1, variantStock || 1);

  /** At or below this many units the product is flagged as running low. */
  const LOW_STOCK_THRESHOLD = 5;

  /**
   * Availability for the selected size/colour, so the shopper sees the limit
   * that the server will actually enforce at checkout.
   */
  const stockStatus = useMemo(() => {
    if (outOfStock) {
      return { tone: 'product-stock-status--out', label: t('detail.stockOut') };
    }
    if (variantStock <= LOW_STOCK_THRESHOLD) {
      return {
        tone: 'product-stock-status--low',
        label: t('detail.stockLow', { count: variantStock }),
      };
    }
    return {
      tone: 'product-stock-status--in',
      label: t('detail.stockIn', { count: variantStock }),
    };
  }, [outOfStock, variantStock, t]);

  const toggleAccordion = (section: string) => {
    setOpenAccordion(openAccordion === section ? null : section);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.min(maxQuantity, Math.max(1, prev + delta)));
  };

  return (
    <div className="product-detail-page">
      <div className="product-detail-container">
        <button type="button" className="product-detail__back-btn" onClick={onBack}>
          <ArrowLeft size={16} className="product-detail__back-icon" />
          {t('detail.backToCatalog')}
        </button>

        <div className="product-detail__layout">
          {/* Left: Image Gallery */}
          <div className="product-gallery">
            <div className="product-gallery__main">
              <img
                src={images[Math.min(selectedImageIndex, images.length - 1)]}
                alt={product.name}
                className="product-gallery__main-img"
              />
            </div>
            {images.length > 1 && (
              <div className="product-gallery__thumbs">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`product-gallery__thumb ${selectedImageIndex === idx ? 'active' : ''}`}
                    onClick={() => setSelectedImageIndex(idx)}
                  >
                    <img src={img} alt={t('detail.thumbAlt', { name: product.name, index: idx + 1 })} className="product-gallery__thumb-img" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Info & Actions */}
          <div className="product-info">
            <div className="product-info__header">
              <span className="product-info__category">{product.category}</span>
              <h1 className="product-info__title">{product.name}</h1>
              <div className="product-info__price">
                {isProductOnSale(product) ? (
                  <>
                    <span className="product-info__price--sale">{formatMoney(getUnitPrice(product))}</span>
                    <span className="product-info__price--original">{formatMoney(product.price)}</span>
                  </>
                ) : (
                  <>{formatMoney(product.price)}</>
                )}
              </div>
              {getShippingPrice(product) > 0 && (
                <div className="product-info__shipping" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '8px' }}>
                  + {formatMoney(getShippingPrice(product))} {t('common.shipping')} {t('common.perUnit', { defaultValue: 'per unit' })}
                </div>
              )}
            </div>

            <p className="product-info__description">{getProductDescription(product)}</p>

            {/* Color Selector */}
            {colors.length > 0 && (
              <div className="product-option-group">
                <span className="product-option__label">
                  {t('detail.colorLabel', { color: colorLabel(selectedColor) })}
                </span>
                <div className="color-swatches">
                  {colors.map((color, idx) => (
                    <button
                      key={`${color}-${idx}`}
                      type="button"
                      className={`color-swatch ${selectedColor === color ? 'active' : ''}`}
                      onClick={() => handleSelectColor(color)}
                      aria-label={t('detail.selectColor', { color: colorLabel(color) })}
                    >
                      <span className="color-swatch__inner" style={{ backgroundColor: toSwatchColor(color) }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector */}
            <div className="product-option-group">
              <span className="product-option__label">
                {t('detail.sizeLabel', { size: selectedSize })}
              </span>
              <div className="size-buttons">
                {sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`size-btn ${selectedSize === size ? 'active' : ''}`}
                    onClick={() => handleSelectSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity and CTA Buttons */}
            <div className="product-actions-row">
              <div className="quantity-selector">
                <button
                  type="button"
                  className="quantity-btn"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  aria-label={t('detail.decreaseQuantity')}
                >
                  <Minus size={16} />
                </button>
                <span className="quantity-display">{quantity}</span>
                <button
                  type="button"
                  className="quantity-btn"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= maxQuantity}
                  aria-label={t('detail.increaseQuantity')}
                >
                  <Plus size={16} />
                </button>
              </div>

              {stockStatus && (
                <p className={`product-stock-status ${stockStatus.tone}`}>{stockStatus.label}</p>
              )}
            </div>

            <div className="product-cta-buttons">
              <Button
                variant="primary"
                size="lg"
                disabled={outOfStock}
                onClick={() => {
                  if (outOfStock) return;
                  if (onAddToCart) {
                    onAddToCart(product, quantity, selectedColor, selectedSize);
                  } else {
                    alert(t('detail.addedToCart', { qty: quantity, name: product.name, size: selectedSize }));
                  }
                }}
              >
                {outOfStock ? t('detail.outOfStock') : t('detail.addToCart')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={outOfStock}
                onClick={() => {
                  if (outOfStock) return;
                  if (onBuyNow) {
                    onBuyNow(product, quantity, selectedColor, selectedSize);
                  } else {
                    alert(t('detail.proceedingToCheckout', { name: product.name }));
                  }
                }}
              >
                {t('detail.buyNow')}
              </Button>
              <WishlistButton product={product} variant="inline" size="lg" />
            </div>

            {/* Accordion Information Sections */}
            <div className="product-details-accordion">
              <div className="accordion-item">
                <button
                  type="button"
                  className="accordion-header"
                  onClick={() => toggleAccordion('details')}
                >
                  <span>{t('detail.accordionDetails')}</span>
                  {openAccordion === 'details' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {openAccordion === 'details' && (
                  <div className="accordion-content">
                    {product.details ? (
                      <div dangerouslySetInnerHTML={{ __html: formatDetails(product.details) }} />
                    ) : (
                      <>
                        <p>{t('detail.detailsDescription')}</p>
                        <ul>
                          <li>{t('detail.material1')}</li>
                          <li>{t('detail.material2')}</li>
                          <li>{t('detail.material3')}</li>
                          <li>{t('detail.material4')}</li>
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="accordion-item">
                <button
                  type="button"
                  className="accordion-header"
                  onClick={() => toggleAccordion('shipping')}
                >
                  <span>{t('detail.accordionShipping')}</span>
                  {openAccordion === 'shipping' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {openAccordion === 'shipping' && (
                  <div className="accordion-content">
                    {product.shippingInfo ? (
                      <div dangerouslySetInnerHTML={{ __html: formatShippingInfo(product.shippingInfo) }} />
                    ) : (
                      <p>{t('detail.shippingDescription')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
