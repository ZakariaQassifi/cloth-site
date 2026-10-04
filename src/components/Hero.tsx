import React from 'react';
import { Button } from './Button';
import { useTranslation } from '../i18n/useI18n';
import './Hero.css';

export interface HeroProps {
  onShopMen?: () => void;
  onShopWomen?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onShopMen,
  onShopWomen,
}) => {
  const { t } = useTranslation();

  return (
    <section className="hero-section">
      <div className="hero__bg-container">
        <img
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=2000"
          alt={t('hero.imageAlt')}
          className="hero__image"
        />
        <div className="hero__overlay" />
      </div>

      <div className="hero__content">
        <span className="hero__label">{t('hero.label')}</span>
        <h1 className="hero__title">{t('hero.title')}</h1>
        <p className="hero__description">
          {t('hero.description')}
        </p>

        <div className="hero__actions">
          <Button
            variant="primary"
            size="lg"
            onClick={onShopMen || (() => console.log('Shop Men clicked'))}
          >
            {t('hero.shopMen')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onShopWomen || (() => console.log('Shop Women clicked'))}
          >
            {t('hero.shopWomen')}
          </Button>
        </div>
      </div>
    </section>
  );
};
