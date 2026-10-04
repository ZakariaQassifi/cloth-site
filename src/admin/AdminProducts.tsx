import React, { useState } from 'react';
import { Search, Plus, Eye, EyeOff } from 'lucide-react';
import type { AdminProduct, Category } from '../types/api';
import { useTranslation } from '../i18n/useI18n';
import './AdminLayout.css';

export interface AdminProductsProps {
  products: AdminProduct[];
  categories: Category[];
  onDeleteProduct: (id: string) => void;
  onToggleVisibility: (id: string, isVisible: boolean) => void;
  onAddProduct: () => void;
  onEditProduct: (product: AdminProduct) => void;
}

export const AdminProducts: React.FC<AdminProductsProps> = ({
  products,
  categories,
  onDeleteProduct,
  onToggleVisibility,
  onAddProduct,
  onEditProduct,
}) => {
  const { t, formatMoney } = useTranslation();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all'); // all, visible, hidden, out-of-stock, sale

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase());

    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;

    const totalStock = p.variants ? p.variants.reduce((sum, v) => sum + v.quantity, 0) : 0;
    const isOut = totalStock === 0 || p.isOutOfStock === true;
    const isOnSale = p.salePrice !== null && p.salePrice !== undefined && p.salePrice < p.price;

    let matchesStatus = true;
    if (statusFilter === 'visible') {
      matchesStatus = p.isVisible !== false;
    } else if (statusFilter === 'hidden') {
      matchesStatus = p.isVisible === false;
    } else if (statusFilter === 'out-of-stock') {
      matchesStatus = isOut;
    } else if (statusFilter === 'sale') {
      matchesStatus = isOnSale;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div>
      <div className="admin-card">
        <div className="admin-card__header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <h3 className="admin-card__title">{t('admin.products.title', { count: filteredProducts.length })}</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="filter-search" style={{ maxWidth: '240px' }}>
              <Search size={16} className="filter-search__icon" />
              <input
                type="text"
                className="filter-search__input"
                placeholder={t('admin.products.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label={t('admin.products.allCategories')}
            >
              <option value="All">{t('admin.products.allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={t('admin.products.allStatus')}
            >
              <option value="all">{t('admin.products.allStatus')}</option>
              <option value="visible">{t('admin.products.visible')}</option>
              <option value="hidden">{t('admin.products.hidden')}</option>
              <option value="out-of-stock">{t('admin.products.outOfStock')}</option>
              <option value="sale">{t('admin.products.onSale')}</option>
            </select>

            <button
              type="button"
              className="admin-btn"
              onClick={onAddProduct}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', height: '44px' }}
            >
              <Plus size={16} /> {t('admin.products.addProduct')}
            </button>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.products.image')}</th>
                <th>{t('admin.products.productName')}</th>
                <th>{t('admin.products.category')}</th>
                <th>{t('admin.products.price')}</th>
                <th>{t('admin.products.visibility')}</th>
                <th>{t('admin.products.stock')}</th>
                <th>{t('admin.products.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>
                    {t('admin.products.noProducts')}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const totalStock = p.variants ? p.variants.reduce((sum, v) => sum + v.quantity, 0) : 0;
                  const isOut = totalStock === 0 || p.isOutOfStock === true;
                  const isLow = totalStock > 0 && totalStock <= 5;
                  const isOnSale = p.salePrice !== null && p.salePrice !== undefined && p.salePrice < p.price;
                  const isVisible = p.isVisible !== false;

                  return (
                    <tr key={p.id} style={{ opacity: isVisible ? 1 : 0.6 }}>
                      <td>
                        <img
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800'}
                          alt={p.name}
                          style={{ width: '40px', height: '50px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {isOnSale && (
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#166534', backgroundColor: '#dcfce7', padding: '1px 4px', borderRadius: '2px' }}>
                            {t('admin.products.sale')}
                          </span>
                        )}
                      </td>
                      <td>{p.category}</td>
                      <td>
                        {isOnSale ? (
                          <div>
                            <span style={{ fontWeight: 700, color: '#166534' }}>{formatMoney(p.salePrice ?? 0)}</span>
                            <span className="admin-price__original">{formatMoney(p.price)}</span>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{formatMoney(p.price)}</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${isVisible ? 'status-badge--delivered' : 'status-badge--cancelled'}`}>
                          {isVisible ? t('admin.products.visible') : t('admin.products.hidden')}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${isOut ? 'status-badge--cancelled' : isLow ? 'status-badge--pending' : 'status-badge--delivered'}`}>
                          {isOut
                            ? t('admin.products.outOfStock')
                            : isLow
                              ? t('admin.products.lowStock', { count: totalStock })
                              : t('admin.products.inStock', { count: totalStock })}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="admin-btn admin-btn--outline"
                            onClick={() => onToggleVisibility(p.id, !isVisible)}
                            title={isVisible ? t('admin.products.hideFromStorefront') : t('admin.products.showOnStorefront')}
                          >
                            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--outline"
                            onClick={() => onEditProduct(p)}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
                            onClick={() => {
                              if (confirm(t('admin.products.deleteConfirm', { name: p.name }))) {
                                onDeleteProduct(p.id);
                              }
                            }}
                          >
                            {t('common.delete')}
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
