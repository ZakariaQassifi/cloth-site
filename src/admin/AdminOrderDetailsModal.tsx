import React from 'react';
import { X } from 'lucide-react';
import { ORDER_STATUSES, shortOrderId } from '../data/order';
import { useTranslation } from '../i18n/useI18n';
import { useOrderStatusLabel, usePaymentLabel } from '../i18n/hooks';
import type { AdminOrder, OrderStatus } from '../types/api';
import { ColorValue } from './AdminOrders';
import './AdminLayout.css';

export interface AdminOrderDetailsModalProps {
  order: AdminOrder;
  onClose: () => void;
  onStatusChange: (orderId: string, newStatus: OrderStatus) => void;
  isUpdating?: boolean;
}

export const AdminOrderDetailsModal: React.FC<AdminOrderDetailsModalProps> = ({
  order,
  onClose,
  onStatusChange,
  isUpdating,
}) => {
  const { t, formatDateTime, formatMoney } = useTranslation();
  const statusLabel = useOrderStatusLabel();
  const paymentLabel = usePaymentLabel();

  if (!order) return null;

  const items = order.items ?? [];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  // Prefer the stored breakdown; derive it from the lines if it is missing.
  const subtotal =
    typeof order.subtotalPrice === 'number'
      ? order.subtotalPrice
      : items.reduce((sum, item) => sum + item.totalPrice, 0);
  const shipping =
    typeof order.shippingPrice === 'number'
      ? order.shippingPrice
      : Math.max((order.totalPrice ?? 0) - subtotal, 0);
  const total = typeof order.totalPrice === 'number' ? order.totalPrice : subtotal + shipping;

  return (
    <div className="cart-overlay open" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="cart-drawer open"
        style={{ maxWidth: '720px', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-card__header" style={{ padding: '1.5rem' }}>
          <div>
            <h3 className="admin-card__title">{t('admin.orderDetails.title', { id: shortOrderId(order.id) })}</h3>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {t('admin.orderDetails.placedAt', { date: formatDateTime(order.createdAt) })}
            </span>
          </div>
          <button type="button" className="header__action-btn" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Customer & Order Status Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div
              style={{
                background: '#f9fafb',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
              }}
            >
              <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.5rem' }}>
                {t('admin.orderDetails.customerInformation')}
              </h4>
              <p style={{ fontWeight: 600, margin: '0 0 0.25rem 0' }}>{order.customerName}</p>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 0.25rem 0' }}>
                {order.customerPhone}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 0.25rem 0' }}>
                {order.customerEmail}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0 }}>
                {order.customerAddress}
                {order.customerPostalCode ? `, ${order.customerPostalCode}` : ''}, {order.customerCity}
              </p>
              {order.customerNotes && (
                <p style={{ fontSize: '0.8125rem', color: '#92400e', marginTop: '0.5rem', marginBottom: 0 }}>
                  <strong>{t('admin.orderDetails.notes')}</strong> {order.customerNotes}
                </p>
              )}
            </div>

            <div
              style={{
                background: '#f9fafb',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.5rem' }}>
                  {t('admin.orderDetails.orderStatusPayment')}
                </h4>
                <span className={`status-badge status-badge--${order.status.toLowerCase()}`}>
                  {statusLabel(order.status)}
                </span>
                <p style={{ fontSize: '0.875rem', margin: '0.75rem 0 0.5rem 0' }}>
                  <strong>{t('admin.orderDetails.payment')}</strong> {paymentLabel(order.paymentMethod)}
                </p>
                <p style={{ fontSize: '0.875rem', margin: 0 }}>
                  <strong>{t('admin.orderDetails.items')}</strong> {itemCount}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{t('common.status')}:</span>
                <select
                  className="filter-select"
                  style={{ height: '36px', fontSize: '0.8125rem', padding: '0 0.5rem' }}
                  value={order.status}
                  disabled={isUpdating}
                  aria-label={t('admin.orderDetails.changeStatus')}
                  onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
                >
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Ordered Products Table */}
          <div>
            <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.75rem' }}>
              {t('admin.orderDetails.orderedProducts')}
            </h4>
            <div className="admin-table-wrap" style={{ border: '1px solid #e5e7eb', borderRadius: '6px' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('common.product')}</th>
                    <th>{t('common.size')}</th>
                    <th>{t('common.color')}</th>
                    <th>{t('common.qty')}</th>
                    <th>{t('admin.orderDetails.unitPrice')}</th>
                    <th>{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                        {t('admin.orderDetails.noItems')}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id ?? `${item.productName}-${item.size}-${item.color}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              loading="lazy"
                              style={{ width: '36px', height: '48px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                            <span style={{ fontWeight: 500 }}>{item.productName}</span>
                          </div>
                        </td>
                        <td>{item.size}</td>
                        <td>
                          <ColorValue color={item.color} />
                        </td>
                        <td>{item.quantity}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatMoney(item.unitPrice)}</td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatMoney(item.totalPrice)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              background: '#f9fafb',
              padding: '1rem',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#4b5563' }}>{t('common.subtotal')}</span>
              <span style={{ fontWeight: 600 }}>{formatMoney(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#4b5563' }}>{t('common.shipping')}</span>
              <span style={{ fontWeight: 600 }}>
                {shipping === 0 ? t('admin.orderDetails.freeShipping') : formatMoney(shipping)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.9375rem',
                fontWeight: 700,
                paddingTop: '0.5rem',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              <span>{t('common.total')}</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="admin-btn admin-btn--outline" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};