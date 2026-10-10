import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchSettings } from '../services/catalogService';
import { useTranslation } from '../i18n/useI18n';
import './Hero.css';

const DEFAULT_HERO_IMAGES = [
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=2000',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=2000',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=2000',
];

export interface HeroProps {
  onShopMen?: () => void;
  onShopWomen?: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onShopMen,
  onShopWomen,
}) => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroImages, setHeroImages] = useState<string[]>(DEFAULT_HERO_IMAGES);
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetchSettings();
      if (res.success && res.data) {
        const data = res.data;
        
        // Parse heroImages if available
        if (data.heroImages) {
          try {
            const parsed = JSON.parse(data.heroImages);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setHeroImages(parsed.filter((img: string) => img && img.trim()));
            }
          } catch {
            // Use defaults on parse error
          }
        }

        // Set dynamic hero title and subtitle with fallbacks
        if (data.heroTitle && data.heroTitle.trim()) {
          setHeroTitle(data.heroTitle);
        }
        if (data.heroSubtitle && data.heroSubtitle.trim()) {
          setHeroSubtitle(data.heroSubtitle);
        }
      }
    } catch {
      console.warn('Failed to load hero settings');
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Auto-advance carousel every 5 seconds
  useEffect(() => {
    if (heroImages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [heroImages.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevSlide, nextSlide]);

  return (
    <section className="hero-section">
      <div className="hero__bg-container">
        {heroImages.length > 0 && (
          <div className="hero__carousel">
            {heroImages.map((imageUrl, index) => (
              <img
                key={index}
                src={imageUrl}
                alt={index === 0 ? t('hero.imageAlt') : ''}
                className={`hero__image ${index === currentSlide ? 'active' : ''}`}
                style={{ opacity: index === currentSlide ? 1 : 0, pointerEvents: index === currentSlide ? 'auto' : 'none' }}
              />
            ))}
          </div>
        )}
        <div className="hero__overlay" />
      </div>

      {/* Carousel Navigation */}
      {heroImages.length > 1 && (
        <>
          <button
            type="button"
            className="hero__nav hero__nav--prev"
            onClick={prevSlide}
            aria-label="Previous slide"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            type="button"
            className="hero__nav hero__nav--next"
            onClick={nextSlide}
            aria-label="Next slide"
          >
            <ChevronRight size={32} />
          </button>
          <div className="hero__indicators" role="tablist" aria-label="Hero slides">
            {heroImages.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`hero__indicator ${index === currentSlide ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
                role="tab"
                aria-selected={index === currentSlide}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}

      <div className="hero__content">
        <span className="hero__label">{t('hero.label')}</span>
        <h1 className="hero__title">{heroTitle || t('hero.title')}</h1>
        <p className="hero__description">
          {heroSubtitle || t('hero.description')}
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
