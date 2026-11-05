import React, { useCallback, useEffect, useState } from 'react';
import { Plus, X, Trash2, Edit2, Power } from 'lucide-react';
import {
  adminCreatePromoCode,
  adminDeletePromoCode,
  adminFetchPromoCodes,
  adminUpdatePromoCode,
} from '../services/adminApi';
import type { PromoCode, PromoCodeInput, PromoDiscountType } from '../types/api';
import { useTranslation } from '../i18n/useI18n';

export const AdminPromoCodes: React.FC = () => {
  const { t, formatMoney } = useTranslation();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<PromoDiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [minProductsCount, setMinProductsCount] = useState(1);
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  const applyResult = useCallback(
    (res: Awaited<ReturnType<typeof adminFetchPromoCodes>>) => {
      if (res.success) {
        setPromos(res.data ?? []);
        setLoadError(null);
      } else {
        setLoadError(res.message || t('admin.promos.loadFailed'));
      }
      setIsLoading(false);
    },
    [t]
  );

  /** Initial load: no synchronous setState — the spinner is the default state. */
  useEffect(() => {
    let active = true;
    adminFetchPromoCodes().then((res) => {
      if (!active) return;
      applyResult(res);
    });
    return () => {
      active = false;
    };
  }, [applyResult]);

  /** Manual refresh after a quota/restore action shows the spinner again. */
  const fetchPromos = useCallback(async () => {
    setIsLoading(true);
    applyResult(await adminFetchPromoCodes());
  }, [applyResult]);

  const resetForm = () => {
    setCode('');
    setDiscountType('PERCENTAGE');
    setDiscountValue('');
    setMinProductsCount(1);
    setUsageLimit('');
    setExpiresAt('');
    setIsActive(true);
    setFormError(null);
    setEditingPromo(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (promo: PromoCode) => {
    setEditingPromo(promo);
    setCode(promo.code);
    setDiscountType(promo.discountType);
    setDiscountValue(String(promo.discountValue));
    setMinProductsCount(promo.minProductsCount);
    setUsageLimit(promo.usageLimit === null ? '' : String(promo.usageLimit));
    setExpiresAt(promo.expiresAt ? promo.expiresAt.slice(0, 16) : '');
    setIsActive(promo.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

/** Frozen at mount so expiry badges stay stable during a render pass. */
const [now] = useState(() => Date.now());

/** Whether a code row is currently unusable (expired or usage exhausted). */
const isDepleted = useCallback(
  (promo: PromoCode): boolean => {
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) return true;
    return promo.expiresAt !== null && new Date(promo.expiresAt).getTime() <= now;
  },
  [now]
);

  const statusOf = (promo: PromoCode): 'active' | 'inactive' | 'depleted' => {
    if (!promo.isActive || isDepleted(promo)) return 'inactive';
    return 'active';
  };

  const formatDiscount = (promo: PromoCode): string =>
    promo.discountType === 'PERCENTAGE'
      ? `${promo.discountValue}%`
      : formatMoney(promo.discountValue);

  const formatExpiry = (promo: PromoCode): string =>
    promo.expiresAt
      ? new Date(promo.expiresAt).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : t('admin.promos.noExpiry');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !discountValue) {
      setFormError(t('admin.promos.codeValueRequired'));
      return;
    }

    const payload: PromoCodeInput = {
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: Number(discountValue),
      minProductsCount,
      usageLimit: usageLimit === '' ? null : Number(usageLimit),
      isActive,
      expiresAt: expiresAt === '' ? null : new Date(expiresAt).toISOString(),
    };

    setIsSaving(true);
    const res = editingPromo
      ? await adminUpdatePromoCode(editingPromo.id, payload)
      : await adminCreatePromoCode(payload);
    setIsSaving(false);

    if (res.success) {
      setIsModalOpen(false);
      resetForm();
      void fetchPromos();
    } else {
      setFormError(res.message || t('admin.promos.saveFailed'));
    }
  };

  const handleDelete = async (promo: PromoCode) => {
    if (!confirm(t('admin.promos.deleteConfirm', { code: promo.code }))) return;
    const res = await adminDeletePromoCode(promo.id);
    if (res.success) {
      void fetchPromos();
    } else {
      alert(res.message || t('admin.promos.deleteFailed'));
    }
  };

  const handleToggleActive = async (promo: PromoCode) => {
    const res = await adminUpdatePromoCode(promo.id, { isActive: !promo.isActive });
    if (res.success) {
      void fetchPromos();
    } else {
      alert(res.message || t('admin.promos.saveFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-base tracking-wider uppercase text-gray-900 m-0">
            {t('admin.promos.title')}
          </h3>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px]"
            onClick={handleOpenAdd}
          >
            <Plus size={16} /> {t('admin.promos.add')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm min-w-[820px]">
            <thead>
              <tr>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.promos.colCode')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.promos.colDiscount')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.promos.colMinProducts')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.promos.colUsage')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.promos.colExpiry')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.promos.colStatus')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.promos.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-12">{t('common.loading')}</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-12">{loadError}</td>
                </tr>
              ) : promos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-12">{t('admin.promos.none')}</td>
                </tr>
              ) : (
                promos.map((promo) => {
                  const status = statusOf(promo);
                  return (
                    <tr key={promo.id} className={`hover:bg-gray-50 ${status === 'inactive' ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <span className="font-mono font-semibold tracking-wider">{promo.code}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <span className="font-semibold">{formatDiscount(promo)}</span>
                        <span className="text-sm text-gray-500 ml-1">
                          {promo.discountType === 'PERCENTAGE' ? t('admin.promos.typePercentage') : ''}
                        </span>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">{t('admin.promos.minProductsValue', { count: promo.minProductsCount })}</td>
                      <td className="px-5 py-4 border-b border-gray-100">{t('admin.promos.usageLabel', { used: promo.usedCount, limit: promo.usageLimit === null ? '∞' : promo.usageLimit })}</td>
                      <td className="px-5 py-4 border-b border-gray-100">{formatExpiry(promo)}</td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {status === 'active' ? t('admin.promos.active') : isDepleted(promo) ? t('admin.promos.depleted') : t('admin.promos.inactive')}
                        </span>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors min-h-[44px] min-w-[44px]"
                            onClick={() => handleToggleActive(promo)}
                            title={promo.isActive ? t('admin.promos.deactivate') : t('admin.promos.activate')}
                          >
                            <Power size={16} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors min-h-[44px] min-w-[44px]"
                            onClick={() => handleOpenEdit(promo)}
                            title={t('admin.promos.edit')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 transition-colors min-h-[44px] min-w-[44px]"
                            onClick={() => handleDelete(promo)}
                            title={t('admin.promos.delete')}
                          >
                            <Trash2 size={16} />
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

      {/* Promo code modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-display font-semibold text-base tracking-wider uppercase text-gray-900 m-0">
                {editingPromo ? t('admin.promos.editTitle') : t('admin.promos.addTitle')}
              </h3>
              <button type="button" className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('admin.promos.codeLabel')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 text-sm font-mono uppercase border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  placeholder={t('admin.promos.codePlaceholder')}
                  maxLength={32}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{t('admin.promos.typeLabel')}</label>
                  <select
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 min-h-[44px]"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
                  >
                    <option value="PERCENTAGE">{t('admin.promos.typePercentage')}</option>
                    <option value="FIXED">{t('admin.promos.typeFixed')}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    {discountType === 'PERCENTAGE' ? t('admin.promos.percentLabel') : t('admin.promos.fixedLabel')}
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'PERCENTAGE' ? t('admin.promos.percentPlaceholder') : t('admin.promos.fixedPlaceholder')}
                    min={0}
                    step={discountType === 'PERCENTAGE' ? 1 : 0.01}
                    max={discountType === 'PERCENTAGE' ? 100 : undefined}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{t('admin.promos.minProductsLabel')}</label>
                  <select
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 min-h-[44px]"
                    value={minProductsCount}
                    onChange={(e) => setMinProductsCount(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{t('admin.promos.minProductsOption', { count: n })}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">{t('admin.promos.minProductsHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{t('admin.promos.usageLimitLabel')}</label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder={t('admin.promos.usageLimitPlaceholder')}
                    min={1}
                  />
                  <p className="text-xs text-gray-500">{t('admin.promos.usageLimitHint')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{t('admin.promos.expiryLabel')}</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">{t('admin.promos.expiryHint')}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700">{t('admin.promos.statusLabel')}</label>
                  <label className="flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg min-h-[44px] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-gray-900"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <span className="text-sm text-gray-700">{t('admin.promos.statusActiveLabel')}</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider rounded-lg bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px] disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving ? t('common.loading') : editingPromo ? t('admin.promos.saveChanges') : t('admin.promos.create')}
                </button>
                <button
                  type="button"
                  className="flex-1 inline-flex items-center justify-center px-4 py-3 text-xs font-semibold uppercase tracking-wider rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors min-h-[44px]"
                  onClick={() => setIsModalOpen(false)}
                >
                  {t('admin.categories.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
