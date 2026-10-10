import React, { useState } from 'react';
import { Plus, X, Upload, Eye, EyeOff, Trash2, Edit2 } from 'lucide-react';
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminUpdateCategory,
  adminUploadImages,
} from '../services/adminApi';
import type { Category, CategoryInput } from '../types/api';
import { useTranslation } from '../i18n/useI18n';

export interface AdminCategoriesProps {
  categories: Category[];
  onRefresh: () => void;
}

export const AdminCategories: React.FC<AdminCategoriesProps> = ({ categories, onRefresh }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [hoverImageUrl, setHoverImageUrl] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setSlug('');
    setDescription('');
    setImageUrl('');
    setHoverImageUrl('');
    setIsVisible(true);
    setDisplayOrder(0);
    setError(null);
    setEditingCategory(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || '');
    setImageUrl(cat.imageUrl || '');
    setHoverImageUrl(cat.hoverImageUrl || '');
    setIsVisible(cat.isVisible !== false);
    setDisplayOrder(cat.displayOrder || 0);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'hover') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setUploading(true);
    const res = await adminUploadImages(Array.from(files));
    setUploading(false);
    
    if (res.success && res.data && res.data.length > 0) {
      if (type === 'main') setImageUrl(res.data[0]);
      else setHoverImageUrl(res.data[0]);
    } else {
      alert(res.message || t('admin.categories.uploadFailed'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError(t('admin.categories.nameSlugRequired'));
      return;
    }

    const payload = { 
      name, 
      slug, 
      description, 
      imageUrl: imageUrl || null, 
      hoverImageUrl: hoverImageUrl || null, 
      isVisible, 
      displayOrder: Number(displayOrder) 
    };

    let res;
    if (editingCategory) {
      res = await adminUpdateCategory(editingCategory.id, payload);
    } else {
      res = await adminCreateCategory(payload as CategoryInput);
    }

    if (res.success) {
      resetForm();
      setIsModalOpen(false);
      onRefresh();
    } else {
      setError(res.message || t('admin.categories.saveFailed'));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(t('admin.categories.deleteConfirm', { name }))) {
      const res = await adminDeleteCategory(id);
      if (res.success) {
        onRefresh();
      } else {
        alert(res.message || t('admin.categories.deleteFailed'));
      }
    }
  };

  const handleToggleVisibility = async (cat: Category) => {
    const res = await adminUpdateCategory(cat.id, { isVisible: !cat.isVisible });
    if (res.success) {
      onRefresh();
    }
  };

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-semibold text-base tracking-wider uppercase text-gray-900 m-0">{t('admin.categories.title')}</h3>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px]"
            onClick={handleOpenAdd}
          >
            <Plus size={16} /> {t('admin.categories.add')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm min-w-[700px]">
            <thead>
              <tr>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.categories.preview')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.categories.categoryName')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.products.visibility')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.categories.order')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.categories.products')}</th>
                <th className="bg-gray-50 px-5 py-3.5 font-semibold text-gray-500 border-b border-gray-200 uppercase tracking-wider text-xs">{t('admin.categories.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500 py-12">{t('admin.categories.noCategories')}</td>
                </tr>
              ) : (
                categories.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((cat) => {
                  const isVis = cat.isVisible !== false;
                  return (
                    <tr key={cat.id} className={`hover:bg-gray-50 ${!isVis ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <div className="w-15 h-15 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 relative">
                          <img 
                            src={cat.imageUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800'} 
                            alt={t('admin.categories.previewAlt')}
                            className="w-full h-full object-cover max-w-full max-h-full" 
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <div className="font-semibold">{cat.name}</div>
                        <div className="text-sm text-gray-500">/{cat.slug}</div>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${isVis ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {isVis ? t('admin.products.visible') : t('admin.products.hidden')}
                        </span>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <span className="font-semibold">#{cat.displayOrder || 0}</span>
                      </td>
                      <td className="px-5 py-4 border-b border-gray-100">{t('admin.categories.itemCount', { count: cat._count ? cat._count.products : 0 })}</td>
                      <td className="px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors min-h-[44px] min-w-[44px]"
                            onClick={() => handleToggleVisibility(cat)}
                            title={isVis ? t('admin.categories.hide') : t('admin.categories.show')}
                          >
                            {isVis ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors min-h-[44px] min-w-[44px]"
                            onClick={() => handleOpenEdit(cat)}
                            title={t('admin.categories.editContent')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center p-2 rounded-lg bg-red-100 text-red-800 border border-red-200 hover:bg-red-200 transition-colors min-h-[44px] min-w-[44px]"
                            onClick={() => handleDelete(cat.id, cat.name)}
                            title={t('admin.categories.delete')}
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

      {/* Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl shadow-xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-display font-semibold text-base tracking-wider uppercase text-gray-900 m-0">
                {editingCategory ? t('admin.categories.editTitle') : t('admin.categories.addTitle')}
              </h3>
              <button type="button" className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
                  {error}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('admin.categories.nameLabel')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editingCategory) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  placeholder={t('admin.categories.namePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('admin.categories.slugLabel')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t('admin.categories.slugPlaceholder')}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('admin.categories.displayOrder')}</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  placeholder="0"
                />
              </div>

              {/* Main Image */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('admin.categories.mainImage')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                    {imageUrl ? (
                      <img src={imageUrl} alt={t('admin.categories.previewAlt')} className="w-full h-full object-cover max-w-full max-h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><Upload size={24} /></div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input type="file" onChange={(e) => handleFileUpload(e, 'main')} className="text-sm" disabled={uploading} />
                    <input 
                      type="url" 
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]" 
                      value={imageUrl} 
                      onChange={(e) => setImageUrl(e.target.value)} 
                      placeholder={t('admin.categories.pasteUrl')} 
                    />
                  </div>
                </div>
              </div>

              {/* Hover Image */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t('admin.categories.hoverImage')}</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
                    {hoverImageUrl ? (
                      <img src={hoverImageUrl} alt={t('admin.categories.hoverPreviewAlt')} className="w-full h-full object-cover max-w-full max-h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><Upload size={24} /></div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input type="file" onChange={(e) => handleFileUpload(e, 'hover')} className="text-sm" disabled={uploading} />
                    <input 
                      type="url" 
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent min-h-[44px]" 
                      value={hoverImageUrl} 
                      onChange={(e) => setHoverImageUrl(e.target.value)} 
                      placeholder={t('admin.categories.hoverUrlPlaceholder')} 
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  {t('admin.categories.visibleOnStorefront')}
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-100 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px] flex-1" onClick={() => setIsModalOpen(false)}>
                  {t('admin.categories.cancel')}
                </button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 min-h-[44px] flex-1" disabled={uploading}>
                  {editingCategory ? t('admin.categories.update') : t('admin.categories.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};