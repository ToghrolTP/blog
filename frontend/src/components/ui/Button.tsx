import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  className = '', 
  variant = 'primary', 
  size = 'md',
  ...props 
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-mono rounded-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gb-bg disabled:opacity-50 disabled:cursor-not-allowed font-bold uppercase tracking-wider";
  
  const variants = {
    primary: "bg-gb-orange-light text-gb-bg hover:bg-gb-orange hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(254,128,25,0.4)] focus:ring-gb-orange-light border border-gb-orange-light",
    secondary: "bg-transparent text-gb-fg hover:text-gb-bg hover:bg-gb-fg border border-gb-fg/50 hover:border-gb-fg focus:ring-gb-fg",
    ghost: "bg-transparent text-gb-fg-dark hover:text-gb-fg hover:bg-gb-bg-soft focus:ring-gb-fg-dark border border-transparent",
    danger: "bg-gb-red-light text-gb-bg hover:bg-gb-red focus:ring-gb-red-light border border-transparent"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
