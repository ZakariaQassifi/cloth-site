import React from 'react';
import './Container.css';

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'lg',
  className = '',
  ...props
}) => {
  return (
    <div
      className={`container container--${maxWidth} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
