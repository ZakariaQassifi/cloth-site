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
import './AdminLayout.css';

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
      <div className="admin-loading-screen">
        <div className="admin-loading-screen__text">{t('admin.loadingDashboard')}</div>
      </div>
    );
  }

  if (phase === 'anonymous') {
    return (
      <AdminLogin onReturnToStore={onReturnToStore} />
    );
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar__brand">
          <span>{t('admin.brand')}</span>
          <button
            type="button"
            className="admin-mobile-toggle"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="admin-sidebar__nav">
          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <LayoutDashboard size={18} /> {t('admin.nav.dashboard')}
          </button>
          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => { setActiveTab('products'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <Package size={18} /> {t('admin.nav.products')}
          </button>
          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => { setActiveTab('categories'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <Tag size={18} /> {t('admin.nav.categories')}
          </button>
          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTab('orders'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <ShoppingCart size={18} /> {t('admin.nav.orders')}
          </button>
          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => { setActiveTab('customers'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <Users size={18} /> {t('admin.nav.customers')}
          </button>
          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); setProductViewMode('list'); setSidebarOpen(false); }}
          >
            <Settings size={18} /> {t('admin.nav.settings')}
          </button>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb' }}>
          <button
            type="button"
            className="admin-nav-item"
            onClick={handleLogout}
            style={{ color: '#991b1b' }}
          >
            <LogOut size={18} /> {t('admin.nav.logout')}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="admin-main">
        {/* Top Navbar */}
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <button
              type="button"
              className="admin-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label={t('admin.openSidebar')}
            >
              <Menu size={24} />
            </button>
            <h1 className="admin-topbar__title">
              {activeTab === 'products' && productViewMode !== 'list'
                ? `${t(productViewMode === 'add' ? 'admin.tabAddProduct' : 'admin.tabEditProduct')}`
                : t(ADMIN_TAB_KEYS[activeTab])}
            </h1>
          </div>
          <div className="admin-topbar__right">
            <button
              type="button"
              className="admin-storefront-link"
              onClick={onReturnToStore}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ArrowLeft size={16} className="admin-exit-icon" /> {t('admin.exitToStore')}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="admin-content">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '5rem', color: '#6b7280' }}>
              {t('admin.loadingDashboard')}
            </div>
          ) : error ? (
            <div style={{ padding: '2rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
              <strong>{t('admin.errorPrefix')}</strong> {error}
              <div style={{ marginTop: '1rem' }}>
                <button type="button" className="admin-btn" onClick={() => void applyStats()}>
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
                <div className="admin-card" style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                  <h3>{t('admin.customers.title')}</h3>
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
