import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { isHexColor, ORDER_STATUSES, shortOrderId } from '../data/order';
import { useTranslation } from '../i18n/useI18n';
import { useOrderStatusLabel, usePaymentLabel } from '../i18n/hooks';
import type { AdminOrder, OrderStatus } from '../types/api';
import './AdminLayout.css';

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
      <div className="admin-card">
        <div className="admin-card__header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <h3 className="admin-card__title">{t('admin.orders.title', { count: filteredOrders.length })}</h3>
          <div className="filter-search" style={{ maxWidth: '300px' }}>
            <Search size={16} className="filter-search__icon" />
            <input
              type="text"
              className="filter-search__input"
              placeholder={t('admin.orders.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="admin-order-filters">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`admin-chip ${statusFilter === filter ? 'active' : ''}`}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'ALL' ? t('admin.orders.filterAll') : statusLabel(filter)}
              <span className="admin-chip__count">{countFor(filter)}</span>
            </button>
          ))}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.orders.orderId')}</th>
                <th>{t('admin.dashboard.customer')}</th>
                <th>{t('admin.orders.address')}</th>
                <th>{t('admin.orders.products')}</th>
                <th>{t('common.total')}</th>
                <th>{t('admin.orders.payment')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>
                    {orders.length === 0 ? t('admin.orders.noOrders') : t('admin.orders.noMatch')}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const itemCount = (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0);
                  const isUpdating = updatingOrderId === order.id;
                  return (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        #{shortOrderId(order.id)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{order.customerPhone}</div>
                      </td>
                      <td style={{ maxWidth: '220px' }}>
                        <div style={{ fontSize: '0.8125rem' }}>{order.customerAddress}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{order.customerCity}</div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{t('common.items', { count: itemCount })}</td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatMoney(order.totalPrice)}
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {paymentLabel(order.paymentMethod)}
                      </td>
                      <td>
                        <span className={`status-badge status-badge--${order.status.toLowerCase()}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                        {formatDate(order.createdAt)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <select
                            className="filter-select"
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
                            className="admin-btn admin-btn--outline"
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <span
        aria-hidden="true"
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: color,
          border: '1px solid #d1d5db',
          display: 'inline-block',
        }}
      />
      {color}
    </span>
  );
};