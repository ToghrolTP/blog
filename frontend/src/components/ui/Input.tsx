import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full bg-gb-bg-soft border-2 border-gb-fg-dark/20 rounded-none px-3 py-2 text-gb-fg font-mono text-sm focus:outline-none focus:border-gb-orange-light focus:ring-1 focus:ring-gb-orange-light transition-all disabled:opacity-50 ${className}`}
      {...props}
    />
  );
});

Input.displayName = 'Input';
