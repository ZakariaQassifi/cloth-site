import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ReceiptPrinter } from './ReceiptPrinter';
import type { Order } from '../data/order';
import { useTranslation } from '../i18n/useI18n';
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
  const { t, tRich } = useTranslation();

  useEffect(() => {
    // Keep a local copy of the last order for support/debugging. The database
    // remains the source of truth once the backend is connected.
    try {
      window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      // Storage unavailable — the confirmation screen still renders correctly.
    }
  }, [order]);

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

        <ReceiptPrinter order={order} />

        <div className="confirmation-actions">
          <Button variant="primary" size="lg" onClick={onContinueShopping}>
            {t('confirm.continueShopping')}
          </Button>
        </div>
      </div>
    </div>
  );
};