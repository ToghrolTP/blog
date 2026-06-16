import React from 'react';

export interface CategoryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  imgSrc: string;
  imgAlt: string;
  label: string;
  themeColor?: 'orange' | 'aqua';
}

export function CategoryButton({
  active,
  imgSrc,
  imgAlt,
  label,
  className = '',
  themeColor = 'orange',
  disabled,
  ...props
}: CategoryButtonProps) {
  // Theme styling configurations
  const themeStyles = {
    orange: {
      activeBg: 'bg-gb-bg-soft/40',
      activeRing: 'ring-gb-orange-light focus-visible:ring-gb-orange-light',
      activeShadow: 'shadow-[0_0_20px_rgba(254,128,25,0.25)]',
      hoverBorder: 'hover:border-gb-orange-light/40',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(254,128,25,0.12)]',
      hoverText: 'group-hover:text-gb-orange-light',
      radialGlow: 'bg-[radial-gradient(circle_at_center,rgba(254,128,25,0.06)_0%,transparent_70%)]',
    },
    aqua: {
      activeBg: 'bg-gb-bg-soft/40',
      activeRing: 'ring-gb-aqua-light focus-visible:ring-gb-aqua-light',
      activeShadow: 'shadow-[0_0_20px_rgba(142,192,124,0.25)]',
      hoverBorder: 'hover:border-gb-aqua-light/40',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(142,192,124,0.12)]',
      hoverText: 'group-hover:text-gb-aqua-light',
      radialGlow: 'bg-[radial-gradient(circle_at_center,rgba(142,192,124,0.06)_0%,transparent_70%)]',
    },
  };

  const selectedTheme = themeStyles[themeColor] || themeStyles.orange;

  return (
    <button
      type="button"
      className={`group relative overflow-hidden bg-gb-bg-soft/20 rounded-lg p-6 flex flex-col items-center justify-center min-h-[160px] cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gb-bg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:grayscale hover:scale-[1.02] ${
        active
          ? `ring-2 ${selectedTheme.activeRing} ${selectedTheme.activeShadow} ${selectedTheme.activeBg}`
          : `border border-gb-bg-soft ${selectedTheme.hoverBorder} hover:bg-gb-bg-soft/30 ${selectedTheme.hoverShadow}`
      } ${className}`}
      aria-pressed={active}
      disabled={disabled}
      {...props}
    >
      {/* Hover Radial Glow */}
      <div className={`absolute inset-0 ${selectedTheme.radialGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
      
      {/* Floating Wrapper */}
      <div className="w-full z-10 transition-transform duration-500 group-hover:animate-pixel-float flex items-center justify-center">
        <img
          src={imgSrc}
          alt={imgAlt}
          className="max-h-34 w-14 transition-all duration-300 opacity-90 group-hover:opacity-100 scale-100 group-hover:scale-108"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      
      {/* Text Label */}
      <span className={`mt-4 z-10 font-mono font-bold text-sm text-gb-fg ${selectedTheme.hoverText} transition-colors duration-200 select-none`}>
        {label}
      </span>
    </button>
  );
}
