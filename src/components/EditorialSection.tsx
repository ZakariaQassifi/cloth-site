import React from 'react';
import { Button } from './Button';
import { useTranslation } from '../i18n/useI18n';
import './EditorialSection.css';

export interface EditorialSectionProps {
  onExplore?: () => void;
}

export const EditorialSection: React.FC<EditorialSectionProps> = ({
  onExplore,
}) => {
  const { t } = useTranslation();

  return (
    <section className="editorial-section">
      <div className="editorial-container">
        <div className="editorial__image-wrap">
          <img
            src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1600"
            alt={t('editorial.imageAlt')}
            className="editorial__image"
            loading="lazy"
          />
        </div>
        <div className="editorial__content">
          <span className="editorial__label">{t('editorial.label')}</span>
          <h2 className="editorial__title">{t('editorial.title')}</h2>
          <p className="editorial__description">
            {t('editorial.description')}
          </p>
          <div className="editorial__cta">
            <Button
              variant="primary"
              size="lg"
              onClick={onExplore || (() => alert(t('editorial.cta')))}
            >
              {t('editorial.cta')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
