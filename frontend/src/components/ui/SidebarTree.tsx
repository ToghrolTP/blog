import { useState } from 'react';
import { Category } from '../../types';
import { CaretRightIcon, CaretDownIcon, FolderIcon, FolderOpenIcon } from '../Icons';

import linuxLogoSvg from '../../assets/icons/linux-logo.svg?raw';
import shieldCheckSvg from '../../assets/icons/shield-check.svg?raw';
import terminalSvg from '../../assets/icons/terminal.svg?raw';
import cpuSvg from '../../assets/icons/cpu.svg?raw';
import gearSvg from '../../assets/icons/gear.svg?raw';
import bookOpenSvg from '../../assets/icons/book-open.svg?raw';
import brainSvg from '../../assets/icons/brain.svg?raw';
import bookSvg from '../../assets/icons/book.svg?raw';
import fileTextSvg from '../../assets/icons/file-text.svg?raw';
import codeSvg from '../../assets/icons/code.svg?raw';
import databaseSvg from '../../assets/icons/database.svg?raw';
import globeSvg from '../../assets/icons/globe.svg?raw';
import paintBrushSvg from '../../assets/icons/paint-brush.svg?raw';
import usersSvg from '../../assets/icons/users.svg?raw';
import lightbulbSvg from '../../assets/icons/lightbulb.svg?raw';
import wrenchSvg from '../../assets/icons/wrench.svg?raw';

const iconMap: Record<string, string> = {
  'linux-logo': linuxLogoSvg,
  'linux': linuxLogoSvg,
  'shield-check': shieldCheckSvg,
  'cybersecurity': shieldCheckSvg,
  'terminal': terminalSvg,
  'cpu': cpuSvg,
  'backend': cpuSvg,
  'gear': gearSvg,
  'devops': gearSvg,
  'book-open': bookOpenSvg,
  'academic': bookOpenSvg,
  'brain': brainSvg,
  'ai': brainSvg,
  'book': bookSvg,
  'file-text': fileTextSvg,
  'latex': fileTextSvg,
  'code': codeSvg,
  'database': databaseSvg,
  'globe': globeSvg,
  'paint-brush': paintBrushSvg,
  'users': usersSvg,
  'lightbulb': lightbulbSvg,
  'wrench': wrenchSvg,
  // Emoji-to-SVG mappings for seamless backwards compatibility
  '🐧': linuxLogoSvg,
  '🔒': shieldCheckSvg,
  '💻': terminalSvg,
  '🔌': cpuSvg,
  '⚙️': gearSvg,
  '📚': bookOpenSvg,
  '🧠': brainSvg,
  '📖': bookSvg,
  '📝': fileTextSvg,
};

function getSvgInner(rawSvg: string): string {
  const match = rawSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return match ? match[1] : '';
}

export function CategoryIcon({ iconKey }: { iconKey: string }) {
  if (!iconKey) return null;

  // Handle uploaded SVG markup directly
  if (iconKey.trim().toLowerCase().startsWith('<svg')) {
    return (
      <span 
        className="inline-flex items-center justify-center w-[1.2em] h-[1.2em] [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current"
        dangerouslySetInnerHTML={{ __html: iconKey }}
      />
    );
  }

  const key = iconKey.replace('Phosphor.', '').toLowerCase();
  
  if (iconMap[key]) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1.2em"
        height="1.2em"
        viewBox="0 0 256 256"
        fill="currentColor"
        dangerouslySetInnerHTML={{ __html: getSvgInner(iconMap[key]) }}
      />
    );
  }
  
  // Return emoji/text directly if not in Phosphor map
  return <span className="select-none text-base">{iconKey}</span>;
}

interface SidebarTreeProps {
  categories: Category[];
  selectedType: string | null;
  onSelectType: (type: string | null) => void;
  counts: Record<string, number>;
  metaDomains: string[];
}

export function SidebarTree({
  categories,
  selectedType,
  onSelectType,
  counts,
  metaDomains,
}: SidebarTreeProps) {
  // Store folder expansion states, default to open
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    metaDomains.forEach((domain) => {
      initial[domain] = true;
    });
    return initial;
  });

  const toggleFolder = (domain: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [domain]: !prev[domain],
    }));
  };

  // Group categories by meta-domain
  const groupedCategories = categories.reduce((acc, cat) => {
    const count = counts[cat.id] || 0;
    if (count > 0 && metaDomains.includes(cat.metaDomain)) {
      if (!acc[cat.metaDomain]) {
        acc[cat.metaDomain] = [];
      }
      acc[cat.metaDomain].push(cat);
    }
    return acc;
  }, {} as Record<string, Category[]>);

  return (
    <div className="space-y-4 select-none font-mono text-sm">
      {metaDomains.map((domain) => {
        const domainCats = groupedCategories[domain] || [];
        if (domainCats.length === 0) return null;

        const isOpen = openFolders[domain] !== false;

        return (
          <div key={domain} className="space-y-1">
            {/* Meta-Domain Folder Header */}
            <div 
              onClick={() => toggleFolder(domain)}
              className="flex items-center gap-2 py-1.5 px-2 hover:bg-gb-bg-soft/40 cursor-pointer text-gb-fg-dark hover:text-gb-fg transition-colors duration-200"
            >
              <span className="text-gb-fg-dark/60 text-xs shrink-0">
                {isOpen ? <CaretDownIcon size={14} /> : <CaretRightIcon size={14} />}
              </span>
              <span className="text-gb-yellow-light text-sm shrink-0">
                {isOpen ? <FolderOpenIcon size={16} /> : <FolderIcon size={16} />}
              </span>
              <span className="font-bold text-xs uppercase tracking-wider truncate">
                {domain}
              </span>
            </div>

            {/* Subcategory List (indented & collapsible) */}
            {isOpen && (
              <ul className="pl-6 space-y-0.5 border-l border-gb-bg-light/30 ml-4 mt-0.5">
                {domainCats.map((cat) => {
                  const isActive = selectedType === cat.id;
                  const count = counts[cat.id] || 0;

                  return (
                    <li key={cat.id}>
                      <button
                        onClick={() => onSelectType(isActive ? null : cat.id)}
                        className={`flex items-center justify-between w-full text-left py-1.5 px-3 rounded-none transition-all duration-200 group border-l-2 ${
                          isActive
                            ? 'bg-gb-orange-light/10 text-gb-orange-light border-gb-orange-light'
                            : 'hover:bg-gb-bg-soft/30 text-gb-fg-dark hover:text-gb-fg border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate mr-2">
                          <span className="text-gb-orange-light shrink-0 select-none flex items-center justify-center">
                            <CategoryIcon iconKey={cat.icon} />
                          </span>
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-none font-mono tabular-nums ${
                          isActive
                            ? 'bg-gb-orange-light/20 text-gb-orange-light'
                            : 'bg-gb-bg border border-gb-bg-soft group-hover:border-gb-fg-dark/30 text-gb-fg-dark/60'
                        }`}>
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
