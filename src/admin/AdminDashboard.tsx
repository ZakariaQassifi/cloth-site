import React from 'react';
import type { AdminOrder, AdminStats } from '../types/api';
import { useTranslation } from '../i18n/useI18n';
import { useOrderStatusLabel } from '../i18n/hooks';
import './AdminLayout.css';

export interface AdminDashboardProps {
  stats: AdminStats;
  onViewOrder: (order: AdminOrder) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ stats, onViewOrder }) => {
  const { t, formatDate, formatMoney } = useTranslation();
  const statusLabel = useOrderStatusLabel();

  return (
    <div>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-card__label">{t('admin.stats.totalProducts')}</span>
          <span className="admin-stat-card__value">{stats.totalProducts}</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__label">{t('admin.stats.totalOrders')}</span>
          <span className="admin-stat-card__value">{stats.totalOrders}</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__label">{t('admin.stats.pendingOrders')}</span>
          <span className="admin-stat-card__value">{stats.pendingOrders}</span>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-card__label">{t('admin.stats.totalSales')}</span>
          <span className="admin-stat-card__value">{formatMoney(stats.totalSales)}</span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">{t('admin.dashboard.recentOrders')}</h3>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.orders.orderId')}</th>
                <th>{t('admin.dashboard.customer')}</th>
                <th>{t('admin.dashboard.phone')}</th>
                <th>{t('common.total')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.action')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>
                    {t('admin.dashboard.noRecentOrders')}
                  </td>
                </tr>
              ) : (
                stats.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontWeight: 600 }}>#{order.id.slice(0, 8).toUpperCase()}</td>
                    <td>{order.customerName}</td>
                    <td>{order.customerPhone}</td>
                    <td style={{ fontWeight: 600 }}>{formatMoney(order.totalPrice)}</td>
                    <td>
                      <span className={`status-badge status-badge--${order.status.toLowerCase()}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn--outline"
                        onClick={() => onViewOrder(order)}
                      >
                        {t('common.view')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
