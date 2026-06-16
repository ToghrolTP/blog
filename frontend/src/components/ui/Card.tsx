import React from "react";

export function Card({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-gb-bg-soft border-2 border-gb-fg-dark/20 rounded-none p-4 md:p-6 transition-all duration-300 hover:border-gb-orange-light hover:-translate-y-1 hover:shadow-[4px_4px_0_0_rgba(254,128,25,0.3)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
