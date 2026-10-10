import React from 'react';
import { X } from 'lucide-react';
import { ORDER_STATUSES, shortOrderId } from '../data/order';
import { useTranslation } from '../i18n/useI18n';
import { useOrderStatusLabel, usePaymentLabel } from '../i18n/hooks';
import type { AdminOrder, OrderStatus } from '../types/api';
import { ColorValue } from './AdminOrders';

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-display font-semibold text-base tracking-wider uppercase text-gray-900 m-0">
              {t('admin.orderDetails.title', { id: shortOrderId(order.id) })}
            </h3>
            <span className="text-xs text-gray-500 block mt-0.5">
              {t('admin.orderDetails.placedAt', { date: formatDateTime(order.createdAt) })}
            </span>
          </div>
          <button type="button" className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer & Order Status Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Information */}
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
              <h4 className="text-xs uppercase tracking-wider font-medium text-gray-500 mb-3">
                {t('admin.orderDetails.customerInformation')}
              </h4>
              <p className="font-semibold text-gray-900 mb-1">{order.customerName}</p>
              <p className="text-sm text-gray-600 mb-1">{order.customerPhone}</p>
              <p className="text-sm text-gray-600 mb-1">{order.customerEmail}</p>
              <p className="text-sm text-gray-600 mb-1">
                {order.customerAddress}
                {order.customerPostalCode ? `, ${order.customerPostalCode}` : ''}, {order.customerCity}
              </p>
              {order.customerNotes && (
                <p className="text-sm text-amber-800 mt-3 mb-0">
                  <strong className="text-amber-900">{t('admin.orderDetails.notes')}</strong> {order.customerNotes}
                </p>
              )}
            </div>

            {/* Order Status & Payment */}
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 flex flex-col">
              <div>
                <h4 className="text-xs uppercase tracking-wider font-medium text-gray-500 mb-3">
                  {t('admin.orderDetails.orderStatusPayment')}
                </h4>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider status-badge status-badge--${order.status.toLowerCase()}`}>
                  {statusLabel(order.status)}
                </span>
                <p className="text-sm mt-3 mb-1">
                  <strong className="text-gray-700">{t('admin.orderDetails.payment')}</strong> <span className="text-gray-900">{paymentLabel(order.paymentMethod)}</span>
                </p>
                <p className="text-sm mb-0">
                  <strong className="text-gray-700">{t('admin.orderDetails.items')}</strong> <span className="text-gray-900">{itemCount}</span>
                </p>
              </div>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">{t('common.status')}:</span>
                <select
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[36px] cursor-pointer"
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
            <h4 className="text-xs uppercase tracking-wider font-medium text-gray-500 mb-3">
              {t('admin.orderDetails.orderedProducts')}
            </h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider text-xs">{t('common.product')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider text-xs">{t('common.size')}</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider text-xs">{t('common.color')}</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase tracking-wider text-xs">{t('common.qty')}</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">{t('admin.orderDetails.unitPrice')}</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-500 uppercase tracking-wider text-xs">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        {t('admin.orderDetails.noItems')}
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id ?? `${item.productName}-${item.size}-${item.color}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              loading="lazy"
                              className="w-9 h-12 object-cover rounded"
                            />
                            <span className="font-medium text-gray-900 truncate max-w-[200px]">{item.productName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{item.size}</td>
                        <td className="px-4 py-3">
                          <ColorValue color={item.color} />
                        </td>
                        <td className="px-4 py-3 text-center text-gray-900 font-medium">{item.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium whitespace-nowrap">{formatMoney(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-semibold whitespace-nowrap">{formatMoney(item.totalPrice)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('common.subtotal')}</span>
              <span className="font-semibold text-gray-900">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('common.shipping')}</span>
              <span className="font-semibold text-gray-900">
                {shipping === 0 ? t('admin.orderDetails.freeShipping') : formatMoney(shipping)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
              <span className="text-gray-900">{t('common.total')}</span>
              <span className="text-gray-900">{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px]" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};