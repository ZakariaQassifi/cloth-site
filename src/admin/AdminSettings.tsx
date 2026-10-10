import React, { useState, useEffect, useCallback } from 'react';
import { Link, Mail, Phone, MapPin, Plus, Trash2, GripVertical } from 'lucide-react';
import { adminFetchSettings, adminUpdateSettings } from '../services/adminApi';
import type { SiteSettingsInput } from '../types/api';
import { useTranslation } from '../i18n/useI18n';
import './AdminLayout.css';

interface SocialLink {
  platform: string;
  url: string;
}

interface FooterLink {
  label: string;
  href: string;
}

const SOCIAL_PLATFORMS = [
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  {key: 'twitter', label: 'Twitter / X' },
  {key: 'youtube', label: 'YouTube' },
];

export interface AdminSettingsProps {
  onRefresh?: () => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ onRefresh }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [storeName, setStoreName] = useState('KINETIC STUDIO');
  const [logoUrl, setLogoUrl] = useState('');
  const [copyrightText, setCopyrightText] = useState('© 2026 KINETIC STUDIO. All rights reserved.');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>([]);

  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaKeywords, setMetaKeywords] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [customJs, setCustomJs] = useState('');

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [footerImageUrl, setFooterImageUrl] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetchSettings();
      if (res.success && res.data) {
        const data = res.data;
        setStoreName(data.storeName || 'KINETIC STUDIO');
        setLogoUrl(data.logoUrl || '');
        setCopyrightText(data.copyrightText || '© 2026 KINETIC STUDIO. All rights reserved.');
        setContactEmail(data.contactEmail || '');
        setContactPhone(data.contactPhone || '');
        setContactAddress(data.contactAddress || '');

        let parsedSocial: SocialLink[] = [];
        if (data.socialLinks) {
          try {
            parsedSocial = JSON.parse(data.socialLinks);
          } catch {
            parsedSocial = [];
          }
        }
        setSocialLinks(parsedSocial.length > 0 ? parsedSocial : SOCIAL_PLATFORMS.map(p => ({ platform: p.key, url: '' })));

        let parsedFooter: FooterLink[] = [];
        if (data.footerLinks) {
          try {
            parsedFooter = JSON.parse(data.footerLinks);
          } catch {
            parsedFooter = [];
          }
        }
        setFooterLinks(parsedFooter.length > 0 ? parsedFooter : [
          { label: 'Home', href: '/' },
          { label: 'Shop', href: '/shop' },
          { label: 'Contact', href: '/contact' },
        ]);

        let parsedHeroImages: string[] = [];
        if (data.heroImages) {
          try {
            parsedHeroImages = JSON.parse(data.heroImages);
          } catch {
            parsedHeroImages = [];
          }
        }
        setHeroImages(parsedHeroImages);

        setMetaTitle(data.metaTitle || '');
        setMetaDescription(data.metaDescription || '');
        setMetaKeywords(data.metaKeywords || '');
        setTrackingId(data.trackingId || '');
        setCustomCss(data.customCss || '');
        setCustomJs(data.customJs || '');
        setHeroTitle(data.heroTitle || '');
        setHeroSubtitle(data.heroSubtitle || '');
        setFooterImageUrl(data.footerImageUrl || '');
      }
    } catch {
      setError(t('admin.settings.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, [loadSettings]);

  const handleAddSocialLink = () => {
    setSocialLinks([...socialLinks, { platform: '', url: '' }]);
  };

  const handleRemoveSocialLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  const handleAddFooterLink = () => {
    setFooterLinks([...footerLinks, { label: '', href: '' }]);
  };

  const handleRemoveFooterLink = (index: number) => {
    setFooterLinks(footerLinks.filter((_, i) => i !== index));
  };

  const handleAddHeroImage = () => {
    setHeroImages([...heroImages, '']);
  };

  const handleRemoveHeroImage = (index: number) => {
    setHeroImages(heroImages.filter((_, i) => i !== index));
  };

  const handleHeroImageChange = (index: number, value: string) => {
    setHeroImages(heroImages.map((img, i) => i === index ? value : img));
  };

  const handleMoveHeroImage = (fromIndex: number, toIndex: number) => {
    const newImages = [...heroImages];
    const [removed] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, removed);
    setHeroImages(newImages);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const validSocialLinks = socialLinks.filter(s => s.platform && s.url);
    const validFooterLinks = footerLinks.filter(f => f.label && f.href);
    const validHeroImages = heroImages.filter(img => img.trim());

    const payload: SiteSettingsInput = {
      storeName,
      logoUrl: logoUrl || null,
      copyrightText,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      contactAddress: contactAddress || null,
      socialLinks: validSocialLinks.length > 0 ? JSON.stringify(validSocialLinks) : null,
      footerLinks: validFooterLinks.length > 0 ? JSON.stringify(validFooterLinks) : null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null,
      metaKeywords: metaKeywords || null,
      trackingId: trackingId || null,
      customCss: customCss || null,
      customJs: customJs || null,
      heroTitle: heroTitle || null,
      heroSubtitle: heroSubtitle || null,
      heroImages: validHeroImages.length > 0 ? JSON.stringify(validHeroImages) : null,
      footerImageUrl: footerImageUrl || null,
    };

    try {
      const res = await adminUpdateSettings(payload);
      if (res.success) {
        setSuccess(t('admin.settings.saveSuccess'));
        onRefresh?.();
      } else {
        setError(res.message || t('admin.settings.saveFailed'));
      }
    } catch {
      setError(t('admin.settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  return (
    <div className="admin-settings-page">
      <h1 className="admin-card__title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
        {t('admin.settings.title')}
      </h1>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#ffe4e6', color: '#9f1239', border: '1px solid #fda4af', marginBottom: '1rem' }}>
          <strong>{t('admin.settings.error')}</strong> {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '1rem', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', marginBottom: '1rem' }}>
          <strong>{t('admin.settings.success')}</strong> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="admin-form-card">
        {/* General Settings */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.generalTitle')}</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="storeName">{t('admin.settings.storeName')}</label>
            <input
              type="text"
              id="storeName"
              className="form-input"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder={t('admin.settings.storeNamePlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="logoUrl">{t('admin.settings.logoUrl')}</label>
            <input
              type="url"
              id="logoUrl"
              className="form-input"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder={t('admin.settings.logoUrlPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="copyrightText">{t('admin.settings.copyrightText')}</label>
            <input
              type="text"
              id="copyrightText"
              className="form-input"
              value={copyrightText}
              onChange={(e) => setCopyrightText(e.target.value)}
              placeholder={t('admin.settings.copyrightTextPlaceholder')}
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.contactTitle')}</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="contactEmail">
              <Mail size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              {t('admin.settings.contactEmail')}
            </label>
            <input
              type="email"
              id="contactEmail"
              className="form-input"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={t('admin.settings.contactEmailPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="contactPhone">
              <Phone size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              {t('admin.settings.contactPhone')}
            </label>
            <input
              type="tel"
              id="contactPhone"
              className="form-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={t('admin.settings.contactPhonePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="contactAddress">
              <MapPin size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              {t('admin.settings.contactAddress')}
            </label>
            <textarea
              id="contactAddress"
              className="form-input"
              style={{ height: '80px', padding: '1rem' }}
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder={t('admin.settings.contactAddressPlaceholder')}
            />
          </div>
        </div>

        {/* Social Media Links */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.socialTitle')}</h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
            {t('admin.settings.socialDescription')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {socialLinks.map((social, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <select
                  className="form-input"
                  style={{ width: '160px' }}
                  value={social.platform}
                  onChange={(e) => setSocialLinks(socialLinks.map((s, i) => i === index ? { ...s, platform: e.target.value } : s))}
                >
                  <option value="">{t('admin.settings.selectPlatform')}</option>
                  {SOCIAL_PLATFORMS.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
                <input
                  type="url"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={social.url}
                  onChange={(e) => setSocialLinks(socialLinks.map((s, i) => i === index ? { ...s, url: e.target.value } : s))}
                  placeholder={`https://${social.platform}.com/...`}
                />
                {socialLinks.length > 1 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => handleRemoveSocialLink(index)}
                    style={{ padding: '0.5rem' }}
                    aria-label={t('admin.settings.removeSocialLink')}
                  >
                    <Link size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="admin-btn admin-btn--outline"
              onClick={handleAddSocialLink}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
            >
              <Link size={16} /> {t('admin.settings.addSocialLink')}
            </button>
          </div>
        </div>

        {/* Footer Navigation Links */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.footerLinksTitle')}</h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
            {t('admin.settings.footerLinksDescription')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {footerLinks.map((link, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 1 }}
                  value={link.label}
                  onChange={(e) => setFooterLinks(footerLinks.map((f, i) => i === index ? { ...f, label: e.target.value } : f))}
                  placeholder={t('admin.settings.footerLinkLabelPlaceholder')}
                />
                <input
                  type="text"
                  className="form-input"
                  style={{ flex: 2 }}
                  value={link.href}
                  onChange={(e) => setFooterLinks(footerLinks.map((f, i) => i === index ? { ...f, href: e.target.value } : f))}
                  placeholder={t('admin.settings.footerLinkHrefPlaceholder')}
                />
                {footerLinks.length > 1 && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    onClick={() => handleRemoveFooterLink(index)}
                    style={{ padding: '0.5rem', height: '44px' }}
                    aria-label={t('admin.settings.removeFooterLink')}
                  >
                    <Link size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="admin-btn admin-btn--outline"
              onClick={handleAddFooterLink}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
            >
              <Link size={16} /> {t('admin.settings.addFooterLink')}
            </button>
          </div>
        </div>

        {/* Footer Image */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.footerImageUrl')}</h3>
          <div className="form-group">
            <label className="form-label" htmlFor="footerImageUrl">{t('admin.settings.footerImageUrl')}</label>
            <input
              type="url"
              id="footerImageUrl"
              className="form-input"
              value={footerImageUrl}
              onChange={(e) => setFooterImageUrl(e.target.value)}
              placeholder={t('admin.settings.footerImageUrlPlaceholder')}
            />
          </div>
        </div>

        {/* Hero Section */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.heroTitle')}</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="heroTitle">{t('admin.settings.heroTitleLabel')}</label>
            <input
              type="text"
              id="heroTitle"
              className="form-input"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder={t('admin.settings.heroTitlePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="heroSubtitle">{t('admin.settings.heroSubtitleLabel')}</label>
            <textarea
              id="heroSubtitle"
              className="form-input"
              style={{ height: '80px', padding: '1rem' }}
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder={t('admin.settings.heroSubtitlePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="heroImages">
              {t('admin.settings.heroImagesLabel')}
            </label>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              {t('admin.settings.heroImagesDescription')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {heroImages.map((imageUrl, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--outline"
                    onClick={() => handleMoveHeroImage(index, index - 1)}
                    disabled={index === 0}
                    style={{ padding: '0.5rem', height: '44px' }}
                    aria-label="Move up"
                  >
                    <GripVertical size={16} />
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--outline"
                    onClick={() => handleMoveHeroImage(index, index + 1)}
                    disabled={index === heroImages.length - 1}
                    style={{ padding: '0.5rem', height: '44px' }}
                    aria-label="Move down"
                  >
                    <GripVertical size={16} />
                  </button>
                  <input
                    type="url"
                    className="form-input"
                    style={{ flex: 1 }}
                    value={imageUrl}
                    onChange={(e) => handleHeroImageChange(index, e.target.value)}
                    placeholder={t('admin.settings.heroImageUrlPlaceholder')}
                  />
                  {heroImages.length > 1 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      onClick={() => handleRemoveHeroImage(index)}
                      style={{ padding: '0.5rem', height: '44px' }}
                      aria-label={t('admin.settings.removeHeroImage')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="admin-btn admin-btn--outline"
                onClick={handleAddHeroImage}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content' }}
              >
                <Plus size={16} /> {t('admin.settings.addHeroImage')}
              </button>
            </div>
          </div>
        </div>

        {/* SEO Settings */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.seoTitle')}</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="metaTitle">{t('admin.settings.metaTitle')}</label>
            <input
              type="text"
              id="metaTitle"
              className="form-input"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder={t('admin.settings.metaTitlePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="metaDescription">{t('admin.settings.metaDescription')}</label>
            <textarea
              id="metaDescription"
              className="form-input"
              style={{ height: '80px', padding: '1rem' }}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder={t('admin.settings.metaDescriptionPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="metaKeywords">{t('admin.settings.metaKeywords')}</label>
            <input
              type="text"
              id="metaKeywords"
              className="form-input"
              value={metaKeywords}
              onChange={(e) => setMetaKeywords(e.target.value)}
              placeholder={t('admin.settings.metaKeywordsPlaceholder')}
            />
          </div>
        </div>

        {/* Analytics & Custom Code */}
        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.analyticsTitle')}</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="trackingId">{t('admin.settings.trackingId')}</label>
            <input
              type="text"
              id="trackingId"
              className="form-input"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              placeholder={t('admin.settings.trackingIdPlaceholder')}
            />
          </div>
        </div>

        <div className="admin-form-section">
          <h3 className="admin-form-title">{t('admin.settings.customCodeTitle')}</h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
            {t('admin.settings.customCodeDescription')}
          </p>
          
          <div className="form-group">
            <label className="form-label" htmlFor="customCss">{t('admin.settings.customCss')}</label>
            <textarea
              id="customCss"
              className="form-input"
              style={{ height: '100px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder={t('admin.settings.customCssPlaceholder')}
            />
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" htmlFor="customJs">{t('admin.settings.customJs')}</label>
            <textarea
              id="customJs"
              className="form-input"
              style={{ height: '100px', padding: '1rem', fontFamily: 'monospace', fontSize: '0.875rem' }}
              value={customJs}
              onChange={(e) => setCustomJs(e.target.value)}
              placeholder={t('admin.settings.customJsPlaceholder')}
            />
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
          <button type="submit" className="admin-btn" disabled={saving}>
            {saving ? t('admin.settings.saving') : t('admin.settings.save')}
          </button>
        </div>
      </form>
    </div>
  );
};