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
import './AdminLayout.css';

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
      <div className="admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">{t('admin.categories.title')}</h3>
          <button
            type="button"
            className="admin-btn"
            onClick={handleOpenAdd}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} /> {t('admin.categories.add')}
          </button>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.categories.preview')}</th>
                <th>{t('admin.categories.categoryName')}</th>
                <th>{t('admin.products.visibility')}</th>
                <th>{t('admin.categories.order')}</th>
                <th>{t('admin.categories.products')}</th>
                <th>{t('admin.categories.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>
                    {t('admin.categories.noCategories')}
                  </td>
                </tr>
              ) : (
                categories.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).map((cat) => {
                  const isVis = cat.isVisible !== false;
                  return (
                    <tr key={cat.id} style={{ opacity: isVis ? 1 : 0.6 }}>
                      <td>
                        <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                          <img 
                            src={cat.imageUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800'} 
                            alt={t('admin.categories.previewAlt')}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{cat.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>/{cat.slug}</div>
                      </td>
                      <td>
                        <span className={`status-badge ${isVis ? 'status-badge--delivered' : 'status-badge--cancelled'}`}>
                          {isVis ? t('admin.products.visible') : t('admin.products.hidden')}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>#{cat.displayOrder || 0}</span>
                      </td>
                      <td>{t('admin.categories.itemCount', { count: cat._count ? cat._count.products : 0 })}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="admin-btn admin-btn--outline"
                            onClick={() => handleToggleVisibility(cat)}
                            title={isVis ? t('admin.categories.hide') : t('admin.categories.show')}
                          >
                            {isVis ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--outline"
                            onClick={() => handleOpenEdit(cat)}
                            title={t('admin.categories.editContent')}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--danger"
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
        <div className="cart-overlay open" onClick={() => setIsModalOpen(false)} style={{ zIndex: 1200 }}>
          <div
            className="cart-drawer open"
            style={{ maxWidth: '500px', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-card__header" style={{ padding: '1.5rem' }}>
              <h3 className="admin-card__title">
                {editingCategory ? t('admin.categories.editTitle') : t('admin.categories.addTitle')}
              </h3>
              <button type="button" className="header__action-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>
              {error && (
                <div style={{ padding: '0.75rem', backgroundColor: '#ffe4e6', color: '#9f1239', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">{t('admin.categories.nameLabel')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editingCategory) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                  }}
                  placeholder={t('admin.categories.namePlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('admin.categories.slugLabel')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t('admin.categories.slugPlaceholder')}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('admin.categories.displayOrder')}</label>
                <input
                  type="number"
                  className="form-input"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  placeholder="0"
                />
              </div>

              {/* Main Image */}
              <div className="form-group">
                <label className="form-label">{t('admin.categories.mainImage')}</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f3f4f6', flexShrink: 0 }}>
                    {imageUrl ? <img src={imageUrl} alt={t('admin.categories.previewAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}><Upload size={20} /></div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="file" onChange={(e) => handleFileUpload(e, 'main')} style={{ fontSize: '0.75rem' }} disabled={uploading} />
                    <input 
                      type="url" 
                      className="form-input" 
                      style={{ marginTop: '0.5rem', height: '36px' }} 
                      value={imageUrl} 
                      onChange={(e) => setImageUrl(e.target.value)} 
                      placeholder={t('admin.categories.pasteUrl')} 
                    />
                  </div>
                </div>
              </div>

              {/* Hover Image */}
              <div className="form-group">
                <label className="form-label">{t('admin.categories.hoverImage')}</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#f3f4f6', flexShrink: 0 }}>
                    {hoverImageUrl ? <img src={hoverImageUrl} alt={t('admin.categories.hoverPreviewAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}><Upload size={20} /></div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="file" onChange={(e) => handleFileUpload(e, 'hover')} style={{ fontSize: '0.75rem' }} disabled={uploading} />
                    <input 
                      type="url" 
                      className="form-input" 
                      style={{ marginTop: '0.5rem', height: '36px' }} 
                      value={hoverImageUrl} 
                      onChange={(e) => setHoverImageUrl(e.target.value)} 
                      placeholder={t('admin.categories.hoverUrlPlaceholder')} 
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={(e) => setIsVisible(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  {t('admin.categories.visibleOnStorefront')}
                </label>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button type="button" className="admin-btn admin-btn--outline" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  {t('admin.categories.cancel')}
                </button>
                <button type="submit" className="admin-btn" style={{ flex: 1 }} disabled={uploading}>
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
