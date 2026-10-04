import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Order } from '../data/order';
import { useTranslation } from '../i18n/useI18n';
import { useColorLabel, usePaymentLabel } from '../i18n/hooks';
import { Button } from './Button';
import './OrderConfirmationPage.css';

export interface OrderConfirmationPageProps {
  order: Order;
  onContinueShopping: () => void;
}

const LAST_ORDER_KEY = 'kinetic_last_order';

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  order,
  onContinueShopping,
}) => {
  const { t, tRich, formatDate, formatMoney } = useTranslation();
  const colorLabel = useColorLabel();
  const paymentLabel = usePaymentLabel();

  useEffect(() => {
    // Keep a local copy of the last order for support/debugging. The database
    // remains the source of truth once the backend is connected.
    try {
      window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      // Storage unavailable — the confirmation screen still renders correctly.
    }
  }, [order]);

  const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <div className="confirmation-page">
      <div className="confirmation-container">
        <div className="confirmation-header">
          <div className="confirmation__icon">
            <CheckCircle2 size={36} strokeWidth={2.5} />
          </div>
          <h1 className="confirmation__title">{t('confirm.title')}</h1>
          <p className="confirmation__subtitle">
            {tRich('confirm.subtitle', {
              email: <strong>{order.customer.email}</strong>,
            })}
          </p>
        </div>

        <div className="order-receipt">
          <div className="receipt-meta">
            <div className="receipt-meta__group">
              <span className="receipt-meta__label">{t('confirm.orderNumber')}</span>
              <span className="receipt-meta__value" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {order.orderNumber}
              </span>
            </div>
            <div className="receipt-meta__group">
              <span className="receipt-meta__label">{t('confirm.date')}</span>
              <span className="receipt-meta__value">{formatDate(order.date)}</span>
            </div>
            <div className="receipt-meta__group">
              <span className="receipt-meta__label">{t('confirm.paymentMethod')}</span>
              <span className="receipt-meta__value">{paymentLabel(order.paymentMethod)}</span>
            </div>
          </div>

          <div className="receipt-grid">
            <div className="receipt-section">
              <h3 className="receipt-section__title">{t('confirm.customerInformation')}</h3>
              <div className="receipt-meta__group">
                <span className="receipt-meta__label">{t('confirm.name')}</span>
                <span className="receipt-meta__value">{order.customer.fullName}</span>
              </div>
              <div className="receipt-meta__group">
                <span className="receipt-meta__label">{t('confirm.shippingAddress')}</span>
                <span className="receipt-meta__value">
                  {order.customer.address}, {order.customer.city} {order.customer.postalCode}
                </span>
              </div>
              <div className="receipt-meta__group">
                <span className="receipt-meta__label">{t('confirm.phone')}</span>
                <span className="receipt-meta__value">{order.customer.phone}</span>
              </div>
            </div>

            <div className="receipt-section">
              <h3 className="receipt-section__title">{t('confirm.orderSummary')}</h3>
              <div className="summary-totals" style={{ borderTop: 'none', paddingTop: 0 }}>
                <div className="summary-row">
                  <span className="cart-summary-label">{t('common.subtotal')}</span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(order.totals.subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span className="cart-summary-label">{t('common.shipping')}</span>
                  <span style={{ fontWeight: 600 }}>
                    {order.totals.shipping === 0 ? t('common.freeUpper') : formatMoney(order.totals.shipping)}
                  </span>
                </div>
                <div className="summary-row summary-row--total">
                  <span className="cart-summary-label">{t('common.total')}</span>
                  <span>{formatMoney(order.totals.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="receipt-section">
            <h3 className="receipt-section__title">{t('confirm.orderedProducts', { count: itemCount })}</h3>
            <div className="receipt-items-list">
              {order.lines.map((line) => (
                <div key={line.lineId} className="receipt-item">
                  <img src={line.productImage} alt={line.productName} className="receipt-item__img" />
                  <div className="receipt-item__details">
                    <h4 className="receipt-item__name">{line.productName}</h4>
                    <span className="receipt-item__meta">
                      {t('confirm.itemMeta', {
                        qty: line.quantity,
                        size: line.size,
                        color: colorLabel(line.color),
                      })}
                    </span>
                  </div>
                  <span className="receipt-item__price">{formatMoney(line.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="confirmation-actions">
          <Button variant="primary" size="lg" onClick={onContinueShopping}>
            {t('confirm.continueShopping')}
          </Button>
        </div>
      </div>
    </div>
  );
};