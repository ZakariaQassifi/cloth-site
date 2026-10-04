import React from 'react';
import { Container } from './Container';
import { CategoryCard } from './CategoryCard';
import { useCategories } from '../context/useCatalog';
import { FALLBACK_PRODUCT_IMAGE } from '../data/products';
import { useTranslation } from '../i18n/useI18n';
import './CategorySection.css';

export interface CategorySectionProps {
  onSelectCategory?: (category: string) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({ onSelectCategory }) => {
  const { t } = useTranslation();
  const categories = useCategories();

  if (categories.length === 0) return null;

  return (
    <section className="category-section">
      <Container maxWidth="lg">
        <div className="category-section__header">
          <h2 className="category-section__title">{t('home.shopByCategory')}</h2>
          <p className="category-section__subtitle">{t('home.shopByCategorySubtitle')}</p>
        </div>

        <div className="category-section__grid">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              title={cat.name}
              image={cat.imageUrl || FALLBACK_PRODUCT_IMAGE}
              hoverImage={cat.hoverImageUrl || null}
              onClick={() => onSelectCategory?.(cat.name)}
            />
          ))}
        </div>
      </Container>
    </section>
  );
};