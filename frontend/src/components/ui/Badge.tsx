import React from 'react';

export function Badge({ className = '', children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span 
      className={`inline-flex items-center px-2 py-0.5 bg-gb-bg-soft text-gb-orange-light border border-gb-orange-light/30 rounded-none text-xs font-mono font-bold transition-all hover:border-gb-orange-light hover:bg-gb-orange-light hover:text-gb-bg ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
