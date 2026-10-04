import React from 'react';
import { useTranslation } from '../i18n/useI18n';
import './CategoryCard.css';

export interface CategoryCardProps {
  title: string;
  image: string;
  hoverImage?: string | null;
  href?: string;
  onClick?: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  title,
  image,
  hoverImage,
  href = '#',
  onClick,
}) => {
  const { t, isRtl } = useTranslation();

  return (
    <a
      href={href}
      className="category-card"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="category-card__image-wrap">
        <img
          src={image}
          alt={title}
          className={`category-card__image ${hoverImage ? 'category-card__image--primary' : ''}`}
          loading="lazy"
        />
        {hoverImage && (
          <img
            src={hoverImage}
            alt={`${title} hover view`}
            className="category-card__image category-card__image--hover"
            loading="lazy"
          />
        )}
        <div className="category-card__overlay" />
      </div>
      <div className="category-card__content">
        <h3 className="category-card__title">{title}</h3>
        <span className="category-card__action">
          {t('home.shopNow')} {isRtl ? '\u2190' : '\u2192'}
        </span>
      </div>
    </a>
  );
};
