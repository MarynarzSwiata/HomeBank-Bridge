import React from 'react';

interface CardProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'nopadding';
}

export const Card: React.FC<CardProps> = ({
  header,
  children,
  className = '',
  variant = 'default',
}) => {
  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-3xl transition-all duration-500 ${className}`}>
      {header && (
        <div className="px-6 py-4 border-b border-slate-800 bg-white/5">
          {header}
        </div>
      )}
      <div className={variant === 'default' ? 'p-6' : ''}>
        {children}
      </div>
    </div>
  );
};

export const Section: React.FC<CardProps> = Card;
