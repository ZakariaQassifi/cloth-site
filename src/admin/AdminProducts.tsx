import React, { useState } from 'react';
import { Search, Plus, Eye, EyeOff } from 'lucide-react';
import type { AdminProduct, Category } from '../types/api';
import { useTranslation } from '../i18n/useI18n';

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
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-base tracking-wider uppercase text-gray-900 m-0">{t('admin.products.title', { count: filteredProducts.length })}</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <input
                type="text"
                className="w-full pl-10 px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
                placeholder={t('admin.products.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px] cursor-pointer"
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
              className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px] cursor-pointer"
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
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px]"
              onClick={onAddProduct}
            >
              <Plus size={16} /> {t('admin.products.addProduct')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm min-w-[800px]">
            <thead>
              <tr>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.products.image')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.products.productName')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.products.category')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.products.price')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.products.visibility')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.products.stock')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.products.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-12">{t('admin.products.noProducts')}</td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const totalStock = p.variants ? p.variants.reduce((sum, v) => sum + v.quantity, 0) : 0;
                  const isOut = totalStock === 0 || p.isOutOfStock === true;
                  const isLow = totalStock > 0 && totalStock <= 5;
                  const isOnSale = p.salePrice !== null && p.salePrice !== undefined && p.salePrice < p.price;
                  const isVisible = p.isVisible !== false;

                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 ${!isVisible ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <img
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800'}
                          alt={p.name}
                          className="w-10 h-12 object-cover rounded"
                        />
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <div className="font-semibold">{p.name}</div>
                        {isOnSale && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.625rem] font-semibold bg-green-100 text-green-800 ml-2">
                            {t('admin.products.sale')}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">{p.category}</td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        {isOnSale ? (
                          <div>
                            <span className="font-bold text-green-800">{formatMoney(p.salePrice ?? 0)}</span>
                            <span className="ml-2 text-sm line-through text-gray-400">{formatMoney(p.price)}</span>
                          </div>
                        ) : (
                          <span className="font-semibold">{formatMoney(p.price)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${isVisible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {isVisible ? t('admin.products.visible') : t('admin.products.hidden')}
                        </span>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${isOut ? 'bg-red-100 text-red-800' : isLow ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                          {isOut
                            ? t('admin.products.outOfStock')
                            : isLow
                              ? t('admin.products.lowStock', { count: totalStock })
                              : t('admin.products.inStock', { count: totalStock })}
                        </span>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors min-h-[44px] min-w-[44px]"
                            onClick={() => onToggleVisibility(p.id, !isVisible)}
                            title={isVisible ? t('admin.products.hideFromStorefront') : t('admin.products.showOnStorefront')}
                          >
                            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px]"
                            onClick={() => onEditProduct(p)}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px]"
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