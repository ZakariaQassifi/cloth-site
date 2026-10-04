import React, { useMemo, useState } from 'react';
import { ArrowLeft, Banknote } from 'lucide-react';
import type { CartLine } from '../data/cart';
import {
  buildOrderLines,
  calculateTotals,
  orderFromResponse,
  toCreateOrderRequest,
  type CustomerInfo,
  type Order,
} from '../data/order';
import { useTranslation } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n/translations/en';
import { submitOrder } from '../services/orderService';
import { Button } from './Button';
import './CheckoutPage.css';

export interface CheckoutPageProps {
  lines: CartLine[];
  onBack: () => void;
  onOrderSuccess: (order: Order) => void;
}

/** The store is Cash on Delivery only, so the method is fixed rather than chosen. */
const PAYMENT_METHOD = 'CASH_ON_DELIVERY' as const;

const EMPTY_FORM: CustomerInfo = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
};

/** Errors are stored as translation keys so they re-render in the active locale. */
type FormErrors = Partial<Record<keyof CustomerInfo, TranslationKey>>;

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ lines, onBack, onOrderSuccess }) => {
  const { t, formatMoney } = useTranslation();
  const [formData, setFormData] = useState<CustomerInfo>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Totals come from the order domain so the summary always matches the order.
  const orderLines = useMemo(() => buildOrderLines(lines), [lines]);
  const totals = useMemo(() => calculateTotals(orderLines), [orderLines]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as { name: keyof CustomerInfo; value: string };
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) setServerError(null);
  };

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};
    if (!formData.fullName.trim()) nextErrors.fullName = 'error.fullNameRequired';
    if (!formData.email.trim()) {
      nextErrors.email = 'error.emailRequired';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      nextErrors.email = 'error.emailInvalid';
    }
    if (!formData.phone.trim()) nextErrors.phone = 'error.phoneRequired';
    if (!formData.address.trim()) nextErrors.address = 'error.addressRequired';
    if (!formData.city.trim()) nextErrors.city = 'error.cityRequired';
    if (!formData.postalCode.trim()) nextErrors.postalCode = 'error.postalCodeRequired';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setServerError(t('checkout.emptyBag'));
      return;
    }
    if (!validateForm()) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const result = await submitOrder(toCreateOrderRequest(formData, PAYMENT_METHOD, lines));

      if (!result.success) {
        setServerError(result.message || t('checkout.failedToPlace'));
        return;
      }

      onOrderSuccess(orderFromResponse(result.data, formData, lines, PAYMENT_METHOD));
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('checkout.unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <button type="button" className="checkout__back-btn" onClick={onBack}>
          <ArrowLeft size={16} className="checkout__back-icon" />
          {t('checkout.backToBag')}
        </button>

        <div className="checkout__header">
          <h1 className="checkout__title">{t('checkout.title')}</h1>
        </div>

        {serverError && (
          <div className="checkout__alert">
            <strong>{t('checkout.orderError')}</strong> {serverError}
          </div>
        )}

        <form onSubmit={handlePlaceOrder} className="checkout__layout">
          {/* Left Side: Customer Info & Payment */}
          <div className="checkout-form">
            <div>
              <h3 className="checkout-section-title">{t('checkout.sectionCustomer')}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="fullName">{t('checkout.fullName')}</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    className={`form-input ${errors.fullName ? 'error' : ''}`}
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder={t('checkout.phFullName')}
                  />
                  {errors.fullName && <span className="form-error">{t(errors.fullName)}</span>}
                </div>

                <div className="form-grid form-grid--2col">
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">{t('checkout.emailAddress')}</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      className={`form-input ${errors.email ? 'error' : ''}`}
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder={t('checkout.phEmail')}
                    />
                    {errors.email && <span className="form-error">{t(errors.email)}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">{t('checkout.phoneNumber')}</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className={`form-input ${errors.phone ? 'error' : ''}`}
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder={t('checkout.phPhone')}
                    />
                    {errors.phone && <span className="form-error">{t(errors.phone)}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="address">{t('checkout.streetAddress')}</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    className={`form-input ${errors.address ? 'error' : ''}`}
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder={t('checkout.phAddress')}
                  />
                  {errors.address && <span className="form-error">{t(errors.address)}</span>}
                </div>

                <div className="form-grid form-grid--2col">
                  <div className="form-group">
                    <label className="form-label" htmlFor="city">{t('checkout.city')}</label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      className={`form-input ${errors.city ? 'error' : ''}`}
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder={t('checkout.phCity')}
                    />
                    {errors.city && <span className="form-error">{t(errors.city)}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="postalCode">{t('checkout.postalCode')}</label>
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      className={`form-input ${errors.postalCode ? 'error' : ''}`}
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      placeholder={t('checkout.phPostalCode')}
                    />
                    {errors.postalCode && <span className="form-error">{t(errors.postalCode)}</span>}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="checkout-section-title">{t('checkout.sectionPayment')}</h3>
              <div className="payment-methods">
                <div className="payment-option active">
                  <span className="payment-option__icon" aria-hidden="true">
                    <Banknote size={18} />
                  </span>
                  <span className="payment-option__body">
                    <span className="payment-option__label">{t('checkout.codTitle')}</span>
                    <span className="payment-option__hint">{t('checkout.codDescription')}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Order Summary */}
          <div>
            <div className="order-summary-box">
              <h3 className="checkout-section-title" style={{ margin: 0 }}>{t('checkout.orderSummary')}</h3>

              <div className="summary-items-list">
                {orderLines.map((line) => (
                  <div key={line.lineId} className="summary-item">
                    <img src={line.productImage} alt={line.productName} className="summary-item__img" />
                    <div className="summary-item__details">
                      <h4 className="summary-item__name">{line.productName}</h4>
                      <span className="summary-item__meta">
                        {t('checkout.summaryMeta', { qty: line.quantity, size: line.size })}
                      </span>
                    </div>
                    <span className="summary-item__price">{formatMoney(line.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="summary-totals">
                <div className="summary-row">
                  <span className="cart-summary-label">{t('common.subtotal')}</span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(totals.subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span className="cart-summary-label">{t('common.shipping')}</span>
                  <span style={{ fontWeight: 600 }}>
                    {totals.shipping === 0 ? t('common.freeUpper') : formatMoney(totals.shipping)}
                  </span>
                </div>
                <div className="summary-row summary-row--total">
                  <span className="cart-summary-label">{t('common.total')}</span>
                  <span>{formatMoney(totals.total)}</span>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Button variant="primary" size="lg" fullWidth type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('checkout.processingOrder') : t('checkout.placeOrder')}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};