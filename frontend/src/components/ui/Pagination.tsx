import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  language: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, language }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('...');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const isRTL = language === 'fa';

  return (
    <nav 
      className="flex items-center justify-center gap-2 mt-12 font-mono text-sm select-none" 
      aria-label="Pagination"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Previous Button (Decrements Page) */}
      <button
        onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 border border-gb-bg-soft bg-gb-bg-soft/10 text-gb-fg-dark hover:text-gb-fg hover:border-gb-fg-dark/50 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none uppercase tracking-wider font-bold"
      >
        {isRTL ? '[ قبلی > ]' : '[ < PREV ]'}
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-1.5">
        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-2 py-1.5 text-gb-fg-dark">
                ...
              </span>
            );
          }

          const isActive = page === currentPage;

          return (
            <button
              key={`page-${page}`}
              onClick={() => onPageChange(page as number)}
              aria-current={isActive ? 'page' : undefined}
              className={`px-3 py-1.5 border transition-all duration-200 cursor-pointer font-bold ${
                isActive
                  ? 'border-gb-orange-light bg-gb-orange-light text-gb-bg'
                  : 'border-gb-bg-soft bg-gb-bg-soft/10 text-gb-fg-dark hover:text-gb-fg hover:border-gb-fg-dark/50'
              }`}
            >
              {page}
            </button>
          );
        })}
      </div>

      {/* Next Button (Increments Page) */}
      <button
        onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 border border-gb-bg-soft bg-gb-bg-soft/10 text-gb-fg-dark hover:text-gb-fg hover:border-gb-fg-dark/50 transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none uppercase tracking-wider font-bold"
      >
        {isRTL ? '[ < بعدی ]' : '[ NEXT > ]'}
      </button>
    </nav>
  );
}
