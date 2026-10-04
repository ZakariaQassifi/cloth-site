import React from 'react';
import './Section.css';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  background?: 'primary' | 'secondary' | 'inverse';
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  children,
  padding = 'md',
  background = 'primary',
  className = '',
  ...props
}) => {
  return (
    <section
      className={`section section--padding-${padding} section--bg-${background} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
};
