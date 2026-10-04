import React, { useState } from 'react';
import { ArrowLeft, X, Plus, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { adminCreateProduct, adminUpdateProduct, adminUploadImages } from '../services/adminApi';
import type { AdminProduct, Category, ProductInput } from '../types/api';
import { useTranslation } from '../i18n/useI18n';
import { useColorLabel } from '../i18n/hooks';
import './AdminProductForm.css';

export interface AdminProductFormProps {
  productToEdit?: AdminProduct | null;
  categories: Category[];
  onBack: () => void;
  onSuccess: () => void;
}

/** Stock assigned to a size/colour combination the admin has not edited yet. */
const DEFAULT_VARIANT_QUANTITY = 10;

const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const AVAILABLE_COLORS = ['Black', 'White', 'Grey', 'Blue', 'Red', 'Green', 'Beige'];

export const AdminProductForm: React.FC<AdminProductFormProps> = ({
  productToEdit,
  categories,
  onBack,
  onSuccess,
}) => {
  const { t, formatMoney } = useTranslation();
  const colorLabel = useColorLabel();
  const [name, setName] = useState(productToEdit?.name || '');
  const [description, setDescription] = useState(productToEdit?.description || '');
  const [categoryId, setCategoryId] = useState(productToEdit?.categoryId || (categories[0]?.id ?? ''));
  const [price, setPrice] = useState(productToEdit?.price ? String(productToEdit.price) : '');
  const [salePrice, setSalePrice] = useState(productToEdit?.salePrice ? String(productToEdit.salePrice) : '');
  const [images, setImages] = useState<string[]>(productToEdit?.images || ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800']);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [selectedSizes, setSelectedSizes] = useState<string[]>(
    productToEdit?.variants ? Array.from(new Set(productToEdit.variants.map((v) => v.size))) : ['S', 'M', 'L']
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(
    productToEdit?.variants ? Array.from(new Set(productToEdit.variants.map((v) => v.color))) : ['Black', 'White']
  );

  // Only holds admin edits; anything absent falls back to DEFAULT_VARIANT_QUANTITY,
  // so newly selected sizes/colours need no extra bookkeeping.
  const [variantQuantities, setVariantQuantities] = useState<{ [key: string]: number }>(() => {
    const map: { [key: string]: number } = {};
    productToEdit?.variants?.forEach((variant) => {
      map[`${variant.size}-${variant.color}`] = variant.quantity;
    });
    return map;
  });

  /**
   * Only the manual switch is editable. The effective out-of-stock flag is
   * derived by the server from variant quantities, so seeding this form from
   * `isOutOfStock` would freeze a product as "out of stock" for good the moment
   * it happened to sell out.
   */
  const [isOutOfStock, setIsOutOfStock] = useState(productToEdit?.manualOutOfStock || false);
  const [isActive, setIsActive] = useState(productToEdit?.isActive ?? true);
  const [isVisible, setIsVisible] = useState(productToEdit?.isVisible ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    const fileArray = Array.from(files);

    // Validate type and size (max 5MB)
    for (const file of fileArray) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setUploadError(t('admin.form.errInvalidImage'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(t('admin.form.errFileTooLarge'));
        return;
      }
    }

    setUploading(true);
    const res = await adminUploadImages(fileArray);
    setUploading(false);

    if (res.success && res.data) {
      setImages([...images, ...res.data]);
    } else {
      setUploadError(res.message || t('admin.form.errUploadFailed'));
    }
  };

  const handleAddUrlImage = () => {
    if (newImageUrl.trim()) {
      setImages([...images, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;
    const updated = [...images];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setImages(updated);
  };

  const numPrice = parseFloat(price) || 0;
  const numSale = salePrice !== '' ? parseFloat(salePrice) : null;
  const discountPercent = numSale !== null && numPrice > 0 && numSale < numPrice
    ? Math.round(((numPrice - numSale) / numPrice) * 100)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('admin.form.errNameRequired'));
      return;
    }
    if (!categoryId) {
      setError(t('admin.form.errSelectCategory'));
      return;
    }
    if (isNaN(numPrice) || numPrice <= 0) {
      setError(t('admin.form.errPriceZero'));
      return;
    }
    if (numSale !== null) {
      if (isNaN(numSale) || numSale < 0) {
        setError(t('admin.form.errSaleNegative'));
        return;
      }
      if (numSale >= numPrice) {
        setError(t('admin.form.errSaleTooHigh'));
        return;
      }
    }
    if (selectedSizes.length === 0 || selectedColors.length === 0) {
      setError(t('admin.form.errSelectVariants'));
      return;
    }

    const variantsPayload: NonNullable<ProductInput['variants']> = [];
    for (const size of selectedSizes) {
      for (const color of selectedColors) {
        const qty = variantQuantities[`${size}-${color}`] ?? DEFAULT_VARIANT_QUANTITY;
        variantsPayload.push({ size, color, quantity: Number(qty) });
      }
    }

    setLoading(true);

    const payload: ProductInput = {
      name,
      description,
      price: numPrice,
      salePrice: numSale,
      categoryId,
      images,
      variants: variantsPayload,
      isOutOfStock,
      isActive,
      isVisible,
    };

    let res;
    if (productToEdit) {
      res = await adminUpdateProduct(productToEdit.id, payload);
    } else {
      res = await adminCreateProduct(payload);
    }

    setLoading(false);

    if (res.success) {
      onSuccess();
    } else {
      setError(res.message || t('admin.form.errSave'));
    }
  };

  return (
    <div className="admin-form-page">
      <div className="admin-form-header">
        <button type="button" className="checkout__back-btn" onClick={onBack}>
          <ArrowLeft size={16} className="admin-form-back-icon" /> {t('admin.form.backToProducts')}
        </button>
        <h1 className="admin-card__title" style={{ fontSize: '1.25rem' }}>
          {productToEdit ? t('admin.form.editProduct') : t('admin.form.addProduct')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="admin-form-card">
        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#ffe4e6', color: '#9f1239', border: '1px solid #fda4af' }}>
            <strong>{t('admin.form.validationError')}</strong> {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.form.sectionBasic')}</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="prodName">{t('admin.form.productName')}</label>
            <input
              type="text"
              id="prodName"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin.form.productNamePlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prodCat">{t('admin.form.category')}</label>
            <select
              id="prodCat"
              className="filter-select"
              style={{ width: '100%', height: '48px' }}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="prodDesc">{t('admin.form.description')}</label>
            <textarea
              id="prodDesc"
              className="form-input"
              style={{ height: '120px', padding: '1rem' }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('admin.form.descriptionPlaceholder')}
            />
          </div>
        </div>

        {/* Pricing & Discounts */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.form.sectionPricing')}</h3>
          <div className="form-grid form-grid--2col">
            <div className="form-group">
              <label className="form-label" htmlFor="prodPrice">{t('admin.form.regularPrice')}</label>
              <input
                type="number"
                id="prodPrice"
                className="form-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="280"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prodSale">{t('admin.form.salePrice')}</label>
              <input
                type="number"
                id="prodSale"
                className="form-input"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="210"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          {discountPercent !== null && discountPercent > 0 && (
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#166534' }}>
              {t('admin.form.discount', {
                percent: discountPercent,
                from: formatMoney(numPrice),
                to: formatMoney(numSale ?? 0),
              })}
            </div>
          )}
        </div>

        {/* Product Media & Image Management */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.form.sectionMedia')}</h3>
          
          {uploadError && (
            <div style={{ padding: '0.75rem', backgroundColor: '#ffe4e6', color: '#9f1239', fontSize: '0.875rem' }}>
              {uploadError}
            </div>
          )}

          {/* Upload Box */}
          <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '2rem', textAlign: 'center', backgroundColor: '#f9fafb', position: 'relative' }}>
            <Upload size={32} style={{ margin: '0 auto 0.75rem auto', color: '#6b7280' }} />
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              {uploading ? t('admin.form.uploadingImages') : t('admin.form.dropImages')}
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '1rem' }}>
              {t('admin.form.supportsFormats')}
            </p>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
          </div>

          {/* Fallback URL input */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <input
              type="url"
              className="form-input"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder={t('admin.form.pasteExternalUrl')}
            />
            <button type="button" className="admin-btn" onClick={handleAddUrlImage} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
              <Plus size={16} /> {t('admin.form.addUrl')}
            </button>
          </div>

          {/* Image Previews & Reordering */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
            {images.map((imgUrl, index) => (
              <div key={index} style={{ position: 'relative', border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: '100%', aspectRatio: '3 / 4', background: '#f3f4f6', position: 'relative' }}>
                  <img src={imgUrl} alt={t('admin.form.imageAlt', { index: index + 1 })} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {index === 0 && (
                    <span style={{ position: 'absolute', top: 6, left: 6, background: '#111827', color: '#fff', fontSize: '0.625rem', fontWeight: 600, padding: '2px 6px', textTransform: 'uppercase', borderRadius: '3px' }}>
                      {t('admin.form.primary')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    style={{ position: 'absolute', top: 6, right: 6, background: '#fee2e2', border: 'none', color: '#991b1b', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    aria-label={t('admin.form.removeImage')}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563' }}>#{index + 1}</span>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveImage(index, 'up')}
                      style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: '3px', cursor: index === 0 ? 'not-allowed' : 'pointer', padding: '2px' }}
                      title={t('admin.form.moveUp')}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === images.length - 1}
                      onClick={() => handleMoveImage(index, 'down')}
                      style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: '3px', cursor: index === images.length - 1 ? 'not-allowed' : 'pointer', padding: '2px' }}
                      title={t('admin.form.moveDown')}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sizes & Colors */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.form.sectionSizesColors')}</h3>
          <div className="form-group">
            <label className="form-label">{t('admin.form.availableSizes')}</label>
            <div className="checkbox-group">
              {AVAILABLE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`checkbox-chip ${selectedSizes.includes(size) ? 'active' : ''}`}
                  onClick={() => toggleSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label">{t('admin.form.availableColors')}</label>
            <div className="checkbox-group">
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`checkbox-chip ${selectedColors.includes(color) ? 'active' : ''}`}
                  onClick={() => toggleColor(color)}
                >
                  {colorLabel(color)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Variant Stock Management */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.form.sectionStock')}</h3>
          {selectedSizes.length === 0 || selectedColors.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{t('admin.form.selectVariantsFirst')}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="variant-matrix-table">
                <thead>
                  <tr>
                    <th>{t('common.size')}</th>
                    <th>{t('common.color')}</th>
                    <th>{t('admin.form.quantityStock')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSizes.map((size) =>
                    selectedColors.map((color) => {
                      const key = `${size}-${color}`;
                      return (
                        <tr key={key}>
                          <td style={{ fontWeight: 600 }}>{size}</td>
                          <td>{colorLabel(color)}</td>
                          <td>
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '120px', height: '36px' }}
                              value={variantQuantities[key] ?? DEFAULT_VARIANT_QUANTITY}
                              onChange={(e) =>
                                setVariantQuantities({
                                  ...variantQuantities,
                                  [key]: Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              min="0"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Availability */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.form.sectionAvailability')}</h3>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              {t('admin.form.activeStatus')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setIsVisible(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              {t('admin.form.visibleStorefront')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isOutOfStock}
                onChange={(e) => setIsOutOfStock(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              {t('admin.form.markOutOfStock')}
            </label>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="admin-btn admin-btn--outline" onClick={onBack}>
            {t('admin.form.cancel')}
          </button>
          <button type="submit" className="admin-btn" disabled={loading || uploading}>
            {loading
              ? t('admin.form.saving')
              : productToEdit
                ? t('admin.form.updateProduct')
                : t('admin.form.createProduct')}
          </button>
        </div>
      </form>
    </div>
  );
};
