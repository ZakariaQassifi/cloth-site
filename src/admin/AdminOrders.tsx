import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { isHexColor, ORDER_STATUSES, shortOrderId } from '../data/order';
import { useTranslation } from '../i18n/useI18n';
import { useOrderStatusLabel, usePaymentLabel } from '../i18n/hooks';
import type { AdminOrder, OrderStatus } from '../types/api';

export interface AdminOrdersProps {
  orders: AdminOrder[];
  onViewOrder: (order: AdminOrder) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  /** Tracks in-flight status writes so each row can show its own state. */
  updatingOrderId?: string | null;
}

type StatusFilter = 'ALL' | OrderStatus;

const STATUS_FILTERS: StatusFilter[] = ['ALL', ...ORDER_STATUSES];

export const AdminOrders: React.FC<AdminOrdersProps> = ({
  orders,
  onViewOrder,
  onStatusChange,
  updatingOrderId,
}) => {
  const { t, formatDate, formatMoney } = useTranslation();
  const statusLabel = useOrderStatusLabel();
  const paymentLabel = usePaymentLabel();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
      if (!term) return true;
      return (
        (order.customerName ?? '').toLowerCase().includes(term) ||
        (order.customerPhone ?? '').toLowerCase().includes(term) ||
        (order.customerEmail ?? '').toLowerCase().includes(term) ||
        shortOrderId(order.id).toLowerCase().includes(term) ||
        (order.items ?? []).some((item) =>
          (item.productName ?? '').toLowerCase().includes(term)
        )
      );
    });
  }, [orders, search, statusFilter]);

  const countFor = (filter: StatusFilter) =>
    filter === 'ALL' ? orders.length : orders.filter((o) => o.status === filter).length;

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-base tracking-wider uppercase text-gray-900 m-0">{t('admin.orders.title', { count: filteredOrders.length })}</h3>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            <input
              type="text"
              className="w-full pl-10 px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
              placeholder={t('admin.orders.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 py-4 flex flex-wrap gap-2 border-b border-gray-200">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-sm font-semibold cursor-pointer transition-all duration-150 ${
                statusFilter === filter
                  ? 'bg-gray-900 border-gray-900 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'ALL' ? t('admin.orders.filterAll') : statusLabel(filter)}
              <span className={`inline-flex items-center justify-center min-w-5 px-1.5 rounded-full text-[0.625rem] font-medium ${
                statusFilter === filter
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {countFor(filter)}
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm min-w-[1000px]">
            <thead>
              <tr>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.orders.orderId')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.dashboard.customer')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.orders.address')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.orders.products')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('common.total')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.orders.payment')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('common.status')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('common.date')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-500 py-12">
                    {orders.length === 0 ? t('admin.orders.noOrders') : t('admin.orders.noMatch')}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const itemCount = (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0);
                  const isUpdating = updatingOrderId === order.id;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 border-b border-gray-100 font-semibold whitespace-nowrap">#{shortOrderId(order.id)}</td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <div className="font-semibold">{order.customerName}</div>
                        <div className="text-sm text-gray-500">{order.customerPhone}</div>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100 max-w-[220px]">
                        <div className="text-sm">{order.customerAddress}</div>
                        <div className="text-sm text-gray-500">{order.customerCity}</div>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100 whitespace-nowrap">{t('common.items', { count: itemCount })}</td>
                      <td className="px-5 py-4 border-b border-gray-100 font-semibold whitespace-nowrap">{formatMoney(order.totalPrice)}</td>
                      <td className="px-5 py-4 border-b border-gray-100 text-sm">{paymentLabel(order.paymentMethod)}</td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider status-badge--${order.status.toLowerCase()}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100 text-sm whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <select
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[34px] cursor-pointer"
                            style={{ height: '34px', fontSize: '0.8125rem', padding: '0 0.5rem' }}
                            value={order.status}
                            disabled={isUpdating}
                            aria-label={t('admin.orders.changeStatus', { id: shortOrderId(order.id) })}
                            onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
                          >
                            {ORDER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {statusLabel(status)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px]"
                            onClick={() => onViewOrder(order)}
                          >
                            {t('common.view')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/** Colour cell shared by the orders list and the details modal. */
export const ColorValue: React.FC<{ color: string }> = ({ color }) => {
  if (!isHexColor(color)) return <span>{color}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden="true"
        className="w-3 h-3 rounded-full border border-gray-300"
        style={{ background: color }}
      />
      {color}
    </span>
  );
};