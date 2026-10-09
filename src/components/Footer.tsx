import React, { useEffect, useState, useCallback } from 'react';
import { Globe, Mail, Phone, MapPin } from 'lucide-react';
import { fetchSettings } from '../services/catalogService';
import { useTranslation } from '../i18n/useI18n';
import { Container } from './Container';
import './Footer.css';

interface SocialLink {
  platform: string;
  url: string;
}

interface FooterLink {
  label: string;
  href: string;
}

const DEFAULT_SOCIAL: SocialLink[] = [
  { platform: 'facebook', url: '' },
  { platform: 'instagram', url: '' },
  { platform: 'twitter', url: '' },
  { platform: 'youtube', url: '' },
];

const DEFAULT_FOOTER_LINKS: FooterLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Contact', href: '/contact' },
];

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(DEFAULT_SOCIAL);
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>(DEFAULT_FOOTER_LINKS);
  const [storeName, setStoreName] = useState('KINETIC STUDIO');
  const [copyrightText, setCopyrightText] = useState('© 2026 KINETIC STUDIO. All rights reserved.');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetchSettings();
      if (res.success && res.data) {
        const data = res.data;
        setStoreName(data.storeName || 'KINETIC STUDIO');
        setCopyrightText(data.copyrightText || '© 2026 KINETIC STUDIO. All rights reserved.');
        setContactEmail(data.contactEmail || '');
        setContactPhone(data.contactPhone || '');
        setContactAddress(data.contactAddress || '');

        if (data.socialLinks) {
          try {
            const parsed = JSON.parse(data.socialLinks) as SocialLink[];
            setSocialLinks(parsed.length > 0 ? parsed : DEFAULT_SOCIAL);
          } catch {
            setSocialLinks(DEFAULT_SOCIAL);
          }
        }

        if (data.footerLinks) {
          try {
            const parsed = JSON.parse(data.footerLinks) as FooterLink[];
            setFooterLinks(parsed.length > 0 ? parsed : DEFAULT_FOOTER_LINKS);
          } catch {
            setFooterLinks(DEFAULT_FOOTER_LINKS);
          }
        }
      }
    } catch {
      console.warn('Failed to load footer settings');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
  }, [loadSettings]);

  const validSocialLinks = socialLinks.filter(s => s.url);

  return (
    <footer className="site-footer">
      <Container maxWidth="lg">
        <div className="footer-grid">
          {/* Brand Column */}
          <div className="footer-column footer-brand">
            <h3 className="footer-brand__name">{storeName}</h3>
            {copyrightText && (
              <p className="footer-brand__copyright">{copyrightText}</p>
            )}
          </div>

          {/* Footer Navigation Links */}
          {footerLinks.length > 0 && (
            <div className="footer-column footer-nav">
              <h4 className="footer-column__title">{t('footer.navigation')}</h4>
              <nav className="footer-nav__list">
                {footerLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.href}
                    className="footer-nav__link"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          )}

          {/* Contact Information */}
          {(contactEmail || contactPhone || contactAddress) && (
            <div className="footer-column footer-contact">
              <h4 className="footer-column__title">{t('footer.contact')}</h4>
              <address className="footer-contact__info" style={{ fontStyle: 'normal' }}>
                {contactEmail && (
                  <a href={`mailto:${contactEmail}`} className="footer-contact__item">
                    <Mail size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {contactEmail}
                  </a>
                )}
                {contactPhone && (
                  <a href={`tel:${contactPhone}`} className="footer-contact__item">
                    <Phone size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {contactPhone}
                  </a>
                )}
                {contactAddress && (
                  <div className="footer-contact__item">
                    <MapPin size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    {contactAddress}
                  </div>
                )}
              </address>
            </div>
          )}

          {/* Social Media */}
          {validSocialLinks.length > 0 && (
            <div className="footer-column footer-social">
              <h4 className="footer-column__title">{t('footer.followUs')}</h4>
              <div className="footer-social__links">
                {validSocialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social__link"
                    aria-label={social.platform}
                  >
                    <Globe size={20} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-bottom__text">
            {t('home.footerRights')}
          </p>
        </div>
      </Container>
    </footer>
  );
};