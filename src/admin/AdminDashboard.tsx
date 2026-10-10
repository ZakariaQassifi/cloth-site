import React from 'react';
import type { AdminOrder, AdminStats } from '../types/api';
import { useTranslation } from '../i18n/useI18n';
import { useOrderStatusLabel } from '../i18n/hooks';

export interface AdminDashboardProps {
  stats: AdminStats;
  onViewOrder: (order: AdminOrder) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ stats, onViewOrder }) => {
  const { t, formatDate, formatMoney } = useTranslation();
  const statusLabel = useOrderStatusLabel();

  return (
    <div>
      <div className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider font-medium text-gray-500">{t('admin.stats.totalProducts')}</span>
          <span className="font-display text-2xl font-bold text-gray-900">{stats.totalProducts}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider font-medium text-gray-500">{t('admin.stats.totalOrders')}</span>
          <span className="font-display text-2xl font-bold text-gray-900">{stats.totalOrders}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider font-medium text-gray-500">{t('admin.stats.pendingOrders')}</span>
          <span className="font-display text-2xl font-bold text-gray-900">{stats.pendingOrders}</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wider font-medium text-gray-500">{t('admin.stats.totalSales')}</span>
          <span className="font-display text-2xl font-bold text-gray-900">{formatMoney(stats.totalSales)}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-base tracking-wider uppercase text-gray-900 m-0">{t('admin.dashboard.recentOrders')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm min-w-[700px]">
            <thead>
              <tr>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.orders.orderId')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.dashboard.customer')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.dashboard.phone')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('common.total')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('common.status')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('common.date')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-12">{t('admin.dashboard.noRecentOrders')}</td>
                </tr>
              ) : (
                stats.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 border-b border-gray-100 font-semibold">#{order.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-5 py-4 border-b border-gray-100">{order.customerName}</td>
                    <td className="px-5 py-4 border-b border-gray-100">{order.customerPhone}</td>
                    <td className="px-5 py-4 border-b border-gray-100 font-semibold">{formatMoney(order.totalPrice)}</td>
                    <td className="px-5 py-4 border-b border-gray-100">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider status-badge--${order.status.toLowerCase()}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 border-b border-gray-100">{formatDate(order.createdAt)}</td>
                    <td className="px-5 py-4 border-b border-gray-100">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px]"
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