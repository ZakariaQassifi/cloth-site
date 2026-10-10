import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Package, Tag, ShoppingCart, Users, Settings, Menu, X, ArrowLeft, LogOut } from 'lucide-react';
import {
  adminDeleteProduct,
  adminFetchStats,
  adminLogout,
  adminSession,
  adminUpdateOrderStatus,
  adminUpdateProduct,
  summarizeStats,
} from '../services/adminApi';
import { AdminDashboard } from './AdminDashboard';
import { AdminProducts } from './AdminProducts';
import { AdminProductForm } from './AdminProductForm';
import { AdminCategories } from './AdminCategories';
import { AdminOrders } from './AdminOrders';
import { AdminOrderDetailsModal } from './AdminOrderDetailsModal';
import { AdminLogin } from './AdminLogin';
import { AdminSettings } from './AdminSettings';
import { clearAdminSession, useAdminToken } from './adminAuth';
import { ADMIN_LOGIN_PATH, navigate } from '../routing/routes';
import type { AdminOrder, AdminProduct, AdminStats, OrderStatus } from '../types/api';
import { useTranslation } from '../i18n/useI18n';
import type { TranslationKey } from '../i18n/translations/en';

/** Sidebar tab ids mapped to their labels so the topbar title is translated too. */
const ADMIN_TAB_KEYS: Record<AdminTab, TranslationKey> = {
  dashboard: 'admin.nav.dashboard',
  products: 'admin.nav.products',
  categories: 'admin.nav.categories',
  orders: 'admin.nav.orders',
  customers: 'admin.nav.customers',
  settings: 'admin.nav.settings',
};

export interface AdminLayoutProps {
  onReturnToStore: () => void;
  /** True when the browser is sitting on /admin/login. */
  loginMode?: boolean;
}

type AdminTab = 'dashboard' | 'products' | 'categories' | 'orders' | 'customers' | 'settings';

/** Authentication status of the dashboard shell. */
type AuthPhase = 'checking' | 'authenticated' | 'anonymous';

/** Verdict for a specific token, so a new token is re-checked rather than reused. */
interface TokenValidation {
  token: string;
  valid: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onReturnToStore, loginMode = false }) => {
  const { t } = useTranslation();
  const token = useAdminToken();
  const [validation, setValidation] = useState<TokenValidation | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<AdminStats>({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    outOfStock: 0,
    totalSales: 0,
    recentOrders: [],
    products: [],
    categories: [],
    orders: [],
  });
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Product management sub-views
  const [productViewMode, setProductViewMode] = useState<'list' | 'add' | 'edit'>('list');
  const [productToEdit, setProductToEdit] = useState<AdminProduct | null>(null);

  const applyStats = async () => {
    if (phase !== 'authenticated') return;
    setLoading(true);
    const res = await adminFetchStats();
    if (res.success) {
      setStatsData(res.data);
      setError(null);
    } else {
      setError(res.message || t('admin.loadFailed'));
    }
    setLoading(false);
  };

  /**
   * Authentication phase, derived from the token and its last verdict.
   *
   * No token means signed out. A token with no verdict yet is still being
   * checked. A token the API rejected is treated as signed out, which discards
   * the stored credentials rather than trusting localStorage.
   */
  const phase: AuthPhase =
    token === null
      ? 'anonymous'
      : validation?.token === token
        ? validation.valid
          ? 'authenticated'
          : 'anonymous'
        : 'checking';

  /**
   * Validate the stored token before rendering any dashboard content.
   *
   * A token that the API rejects (expired, tampered, signed with a rotated
   * secret) is discarded here, so the guard trusts the server rather than the
   * mere presence of a value in localStorage.
   */
  useEffect(() => {
    if (!token) return;

    let active = true;
    adminSession().then((res) => {
      if (!active) return;
      if (res.success && res.data?.admin) {
        setValidation({ token, valid: true });
      } else {
        setValidation({ token, valid: false });
        clearAdminSession();
      }
    });

    return () => {
      active = false;
    };
  }, [token]);

  // Fetch once authenticated; the response is applied only if still signed in.
  useEffect(() => {
    if (phase !== 'authenticated') return;
    let active = true;
    adminFetchStats().then((res) => {
      if (!active) return;
      if (res.success) {
        setStatsData(res.data);
        setError(null);
      } else {
        setError(res.message || t('admin.loadFailed'));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [phase, t]);

  /** Send unauthenticated visitors to the login page. */
  useEffect(() => {
    if (phase === 'anonymous' && !loginMode) {
      navigate(ADMIN_LOGIN_PATH, { replace: true });
    }
  }, [phase, loginMode]);

  /** Signed-in admins skip the login form and go straight to the dashboard. */
  useEffect(() => {
    if (phase === 'authenticated' && loginMode) {
      navigate('/admin', { replace: true });
    }
  }, [phase, loginMode]);

  const handleLogout = async () => {
    // Tell the API first, but never let a failed call trap the admin in the UI.
    // Clearing the session drops `token` to null, which flips phase to anonymous.
    try {
      await adminLogout();
    } catch {
      // Ignored: the local session is cleared regardless.
    }
    clearAdminSession();
    setSelectedOrder(null);
    navigate(ADMIN_LOGIN_PATH, { replace: true });
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await adminDeleteProduct(id);
    if (res.success) {
      void applyStats();
    } else {
      alert(res.message || t('admin.deleteProductFailed'));
    }
  };

  const handleToggleProductVisibility = async (id: string, isVisible: boolean) => {
    const res = await adminUpdateProduct(id, { isVisible });
    if (res.success) {
      void applyStats();
    } else {
      alert(res.message || t('admin.updateVisibilityFailed'));
    }
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await adminUpdateOrderStatus(orderId, status);
      if (res.success) {
        // Patch the single changed row in place, then recompute the counters, so
        // the page does not blank out on every status write.
        setStatsData((prev) =>
          summarizeStats(
            prev.products,
            prev.orders.map((order) => (order.id === orderId ? res.data : order)),
            prev.categories
          )
        );
        setSelectedOrder((prev) => (prev && prev.id === orderId ? res.data : prev));
      } else {
        alert(res.message || t('admin.updateStatusFailed'));
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Hold the dashboard back until the stored token has been verified, so an
  // expired session never flashes protected content on the way to the login page.
  if (phase === 'checking') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="text-gray-600 font-medium">{t('admin.loadingDashboard')}</div>
      </div>
    );
  }

  if (phase === 'anonymous') {
    return (
      <AdminLogin onReturnToStore={onReturnToStore} />
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity md:hidden ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label={t('admin.nav.mainNavigation')}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <span className="font-display font-semibold text-lg tracking-wider uppercase">{t('admin.brand')}</span>
          <button
            type="button"
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label={t('admin.closeSidebar')}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="px-4 py-6 flex-1 flex flex-col gap-2 overflow-y-auto">
          <button
            type="button"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full ${
              activeTab === 'dashboard'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => { setActiveTab('dashboard'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <LayoutDashboard size={18} /> {t('admin.nav.dashboard')}
          </button>
          <button
            type="button"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full ${
              activeTab === 'products'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => { setActiveTab('products'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <Package size={18} /> {t('admin.nav.products')}
          </button>
          <button
            type="button"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full ${
              activeTab === 'categories'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => { setActiveTab('categories'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <Tag size={18} /> {t('admin.nav.categories')}
          </button>
          <button
            type="button"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full ${
              activeTab === 'orders'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => { setActiveTab('orders'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <ShoppingCart size={18} /> {t('admin.nav.orders')}
          </button>
          <button
            type="button"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full ${
              activeTab === 'customers'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => { setActiveTab('customers'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <Users size={18} /> {t('admin.nav.customers')}
          </button>
          <button
            type="button"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 w-full ${
              activeTab === 'settings'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={() => { setActiveTab('settings'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <Settings size={18} /> {t('admin.nav.settings')}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            type="button"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 w-full justify-center transition-colors"
            onClick={handleLogout}
          >
            <LogOut size={18} /> {t('admin.nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 px-4 md:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label={t('admin.openSidebar')}
            >
              <Menu size={24} />
            </button>
            <h1 className="font-display font-semibold text-lg tracking-wider uppercase text-gray-900 m-0">
              {activeTab === 'products' && productViewMode !== 'list'
                ? `${t(productViewMode === 'add' ? 'admin.tabAddProduct' : 'admin.tabEditProduct')}`
                : t(ADMIN_TAB_KEYS[activeTab])}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
              onClick={onReturnToStore}
            >
              <ArrowLeft size={16} /> {t('admin.exitToStore')}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {loading ? (
            <div className="text-center py-20 text-gray-500">
              {t('admin.loadingDashboard')}
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 text-red-800 rounded-xl border border-red-200">
              <strong className="block mb-2">{t('admin.errorPrefix')}</strong> {error}
              <div className="mt-4">
                <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px]" onClick={() => void applyStats()}>
                  {t('common.retry')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <AdminDashboard stats={statsData} onViewOrder={(order) => setSelectedOrder(order)} />
              )}
              {activeTab === 'products' && productViewMode === 'list' && (
                <AdminProducts
                  products={statsData.products}
                  categories={statsData.categories}
                  onDeleteProduct={handleDeleteProduct}
                  onToggleVisibility={handleToggleProductVisibility}
                  onAddProduct={() => { setProductToEdit(null); setProductViewMode('add'); }}
                  onEditProduct={(product) => { setProductToEdit(product); setProductViewMode('edit'); }}
                />
              )}
              {activeTab === 'products' && (productViewMode === 'add' || productViewMode === 'edit') && (
                <AdminProductForm
                  productToEdit={productToEdit}
                  categories={statsData.categories}
                  onBack={() => setProductViewMode('list')}
                  onSuccess={() => { setProductViewMode('list'); void applyStats(); }}
                />
              )}
              {activeTab === 'categories' && (
                <AdminCategories categories={statsData.categories} onRefresh={applyStats} />
              )}
              {activeTab === 'orders' && (
                <AdminOrders
                  orders={statsData.orders}
                  onViewOrder={(order) => setSelectedOrder(order)}
                  onStatusChange={handleStatusChange}
                  updatingOrderId={updatingOrderId}
                />
              )}
              {activeTab === 'customers' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6 p-12 text-center text-gray-500">
                  <h3 className="font-display font-semibold text-lg tracking-wider uppercase mb-2">{t('admin.customers.title')}</h3>
                  <p>{t('admin.customers.desc')}</p>
                </div>
              )}
              {activeTab === 'settings' && (
                <AdminSettings onRefresh={applyStats} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <AdminOrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          isUpdating={updatingOrderId === selectedOrder.id}
        />
      )}
    </div>
  );
};