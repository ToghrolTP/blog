import React, { useState } from 'react';
import { CaretRightIcon, CaretDownIcon } from './Icons';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
}

export function Accordion({ title, children }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gb-bg-soft hover:border-gb-yellow-light/40 transition-all duration-300 rounded-none mb-4 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gb-bg-soft/10 hover:bg-gb-bg-soft/20 text-gb-fg hover:text-gb-yellow-light transition-all duration-200 cursor-pointer font-mono text-base font-bold text-left"
      >
        <span className="flex-1 min-w-0 pr-4">{title}</span>
        <span className="text-gb-fg-dark/60 shrink-0">
          {isOpen ? <CaretDownIcon size={18} /> : <CaretRightIcon size={18} />}
        </span>
      </button>
      
      {isOpen && (
        <div className="p-5 border-t border-gb-bg-soft/30 bg-gb-bg/50 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="border-l-2 border-gb-yellow-light/20 pl-4 [&_*:last-child]:mb-0">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
