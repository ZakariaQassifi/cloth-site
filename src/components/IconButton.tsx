import React from 'react';
import './IconButton.css';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  variant = 'ghost',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-btn icon-btn--${variant} icon-btn--${size} ${className}`}
      {...props}
    >
      <span className="icon-btn__inner">{children}</span>
    </button>
  );
};
