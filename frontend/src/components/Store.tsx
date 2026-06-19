import { useState, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { SEO } from "./SEO";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { ShoppingCart, Check, Search, X, SlidersHorizontal, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { Product } from "../types";
import { CategoryButton } from "./ui/CategoryButton";

export function Store() {
  const { language, t } = useLanguage();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'low-high' | 'high-low'>('none');
  const [formatFilter, setFormatFilter] = useState<'all' | 'pdf' | 'latex' | 'zip'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const adminSecret = localStorage.getItem('adminSecret');
    const isParamAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isAdmin = !!adminSecret || isParamAdmin;

    const headers: HeadersInit = {};
    if (adminSecret) {
      headers['Authorization'] = `Bearer ${adminSecret}`;
    }

    fetch("/api/settings")
      .then((res) => res.json())
      .then((settings) => {
        if (settings.store_maintenance && !isAdmin) {
          setIsMaintenance(true);
          setLoading(false);
          return;
        }

        fetch("/api/products", { headers })
          .then((res) => {
            if (res.status === 503) {
              setIsMaintenance(true);
              return [];
            }
            return res.json();
          })
          .then((data) => {
            setProducts(data);
            setLoading(false);
          })
          .catch((err) => {
            console.error("Failed to fetch products:", err);
            setLoading(false);
          });
      })
      .catch((err) => {
        console.error("Failed to fetch settings:", err);
        fetch("/api/products", { headers })
          .then((res) => res.json())
          .then((data) => {
            setProducts(data);
            setLoading(false);
          })
          .catch((prodErr) => {
            console.error("Failed to fetch products fallback:", prodErr);
            setLoading(false);
          });
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.hasAttribute("contenteditable")
      )) {
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const descHtml = t("store_desc")
    .replace("<1>", '<span class="text-gb-aqua-light">')
    .replace("</1>", "</span>")
    .replace("<2>", '<span class="text-gb-yellow-light">')
    .replace("</2>", "</span>")
    .replace("<3>", '<span class="text-gb-green-light">')
    .replace("</3>", "</span>");

  const filteredByTypeProducts = selectedType
    ? products.filter((product) => product.type === selectedType)
    : products;

  const categories = filteredByTypeProducts.reduce(
    (acc, product) => {
      product.tags.forEach((tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>,
  );

  const categoryList = Object.entries(categories)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  const filteredProducts = filteredByTypeProducts.filter((product) => {
    // 1. Tag filter
    const matchTag = selectedTag ? product.tags.includes(selectedTag) : true;
    if (!matchTag) return false;

    // 2. Format filter
    if (formatFilter !== 'all') {
      const format = product.metadata?.format?.toLowerCase();
      if (format !== formatFilter) return false;
    }

    // 3. Search filter
    if (!debouncedQuery.trim()) return true;

    const query = debouncedQuery.toLowerCase().trim();

    const translation = product.translations?.find((t) => t.language === language)
      || product.translations?.find((t) => t.language === "en")
      || { title: "", description: "", features: [] };

    const matchesTitle = (translation.title || "").toLowerCase().includes(query);
    const matchesDescription = (translation.description || "").toLowerCase().includes(query);
    const matchesFeatures = (translation.features || []).some((f) => f.toLowerCase().includes(query));
    const matchesTags = (product.tags || []).some((tag) => tag.toLowerCase().includes(query));
    const matchesId = (product.id || "").toLowerCase().includes(query);

    return matchesTitle || matchesDescription || matchesFeatures || matchesTags || matchesId;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'none') return 0;
    
    const transA = a.translations?.find(t => t.language === language)
      || a.translations?.find(t => t.language === 'en')
      || { price: 0 };
    const transB = b.translations?.find(t => t.language === language)
      || b.translations?.find(t => t.language === 'en')
      || { price: 0 };

    if (sortBy === 'low-high') {
      return transA.price - transB.price;
    }
    return transB.price - transA.price;
  });

  const updateStateWithTransition = (updateFunc: () => void) => {
    if (!document.startViewTransition) {
      updateFunc();
      return;
    }
    document.startViewTransition(() => {
      flushSync(() => {
        updateFunc();
      });
    });
  };

  const handleTypeToggle = (type: string) => {
    updateStateWithTransition(() => {
      const nextType = selectedType === type ? null : type;
      setSelectedType(nextType);
      if (selectedTag) {
        const activeTags = new Set(
          products
            .filter((p) => !nextType || p.type === nextType)
            .flatMap((p) => p.tags)
        );
        if (!activeTags.has(selectedTag)) {
          setSelectedTag(null);
        }
      }
    });
  };

  if (isMaintenance) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center font-mono animate-in fade-in duration-500">
        <div className="max-w-md w-full border-2 border-gb-red/50 bg-gb-bg-soft/10 p-8 rounded-lg shadow-[4px_4px_0_0_rgba(204,36,29,0.15)] relative overflow-hidden">
          <div className="text-gb-red-light text-5xl mb-6 flex justify-center animate-pixel-float">
            <Wrench size={48} />
          </div>
          
          <h1 className="text-2xl font-bold text-gb-fg mb-4 border-b border-gb-bg-soft pb-4">
            {t("store_maintenance_title")}
          </h1>
          
          <p className="text-sm text-gb-fg-dark leading-relaxed mb-6">
            {t("store_maintenance_desc")}
          </p>
          
          <div className="flex justify-center">
            <Link to={language === "fa" ? "/fa" : "/"}>
              <Button variant="ghost" className="text-xs border border-gb-bg-soft hover:border-gb-orange-light text-gb-fg-dark hover:text-gb-orange-light font-mono flex items-center gap-2 cursor-pointer transition-all duration-200">
                &larr; {language === "fa" ? "بازگشت به خانه" : "Back to Home"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
      <SEO title={`${t("store_title")} | Log40`} />

      {/* Hero Section */}
      <div
        className="mb-12 font-mono text-gb-fg-dark border-l-4 border-gb-orange-light pl-6 py-2"
        dir={language === "fa" ? "rtl" : "ltr"}
      >
        <p className="text-4xl font-bold text-gb-fg mb-4 tracking-tight rtl:tracking-normal">
          {t("store_title")}
        </p>
        <p
          className="text-lg leading-relaxed"
          dangerouslySetInnerHTML={{ __html: descHtml }}
        ></p>
      </div>

      {/* Search & Filter Container */}
      <div className="mb-12 flex items-center gap-3 max-w-xl relative" ref={filterRef}>
        <div className="relative flex-1 flex items-center">
          <span className="absolute start-3 text-gb-fg-dark/60">
            <Search size={18} />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search_products_placeholder")}
            className="w-full bg-gb-bg-soft/20 text-gb-fg placeholder:text-gb-fg-dark/50 border-2 border-gb-bg-soft focus:border-gb-orange-light focus:outline-none focus:bg-gb-bg-soft/40 rounded px-10 py-3 font-mono text-sm transition-all"
            dir={language === "fa" ? "rtl" : "ltr"}
          />
          <div className="absolute end-3 flex items-center gap-2">
            {searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedQuery("");
                }}
                className="text-gb-fg-dark hover:text-gb-red-light transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={18} />
              </button>
            ) : (
              <kbd className="border border-gb-fg-dark/30 text-gb-fg-dark/50 px-1.5 py-0.5 rounded text-[10px] bg-gb-bg-soft/40 font-mono select-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Filter popover button */}
        <div className="relative shrink-0">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center gap-2 px-4 py-3 font-mono text-sm border-2 rounded transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-gb-orange-light focus:ring-offset-2 focus:ring-offset-gb-bg ${
              isFilterOpen || sortBy !== 'none' || formatFilter !== 'all'
                ? 'bg-gb-orange-light text-gb-bg border-gb-orange-light shadow-[0_0_10px_rgba(254,128,25,0.25)] font-bold'
                : 'bg-gb-bg-soft/20 text-gb-fg border-gb-bg-soft hover:border-gb-orange-light/40 hover:bg-gb-bg-soft/30'
            }`}
            title="Filter products"
          >
            <SlidersHorizontal size={18} />
            <span className="hidden sm:inline">{t('filters')}</span>
            {(sortBy !== 'none' || formatFilter !== 'all') && (
              <span className="w-2.5 h-2.5 rounded-full bg-current border border-gb-bg-soft" />
            )}
          </button>

          {isFilterOpen && (
            <div className={`absolute ${language === 'fa' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} mt-2 w-64 bg-gb-bg border-2 border-gb-bg-soft shadow-[0_10px_25px_rgba(0,0,0,0.5)] p-4 z-40 font-mono text-xs rounded transition-all animate-in fade-in slide-in-from-top-2 duration-200`}>
              {/* Sort By section */}
              <div className="mb-4">
                <div className="text-gb-orange-light font-bold mb-2 uppercase tracking-wider">{t('sort_by')}</div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setSortBy('none')}
                    className={`text-start w-full px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                      sortBy === 'none'
                        ? 'bg-gb-orange-light/10 text-gb-orange-light font-bold border-l-2 border-gb-orange-light'
                        : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
                    }`}
                    dir={language === 'fa' ? 'rtl' : 'ltr'}
                  >
                    {t('all')}
                  </button>
                  <button
                    onClick={() => setSortBy('low-high')}
                    className={`text-start w-full px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                      sortBy === 'low-high'
                        ? 'bg-gb-orange-light/10 text-gb-orange-light font-bold border-l-2 border-gb-orange-light'
                        : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
                    }`}
                    dir={language === 'fa' ? 'rtl' : 'ltr'}
                  >
                    {t('price_low_high')}
                  </button>
                  <button
                    onClick={() => setSortBy('high-low')}
                    className={`text-start w-full px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                      sortBy === 'high-low'
                        ? 'bg-gb-orange-light/10 text-gb-orange-light font-bold border-l-2 border-gb-orange-light'
                        : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
                    }`}
                    dir={language === 'fa' ? 'rtl' : 'ltr'}
                  >
                    {t('price_high_low')}
                  </button>
                </div>
              </div>

              {/* Format Filter section */}
              <div>
                <div className="text-gb-orange-light font-bold mb-2 uppercase tracking-wider">{t('format')}</div>
                <div className="flex flex-col gap-1.5">
                  {(['all', 'pdf', 'latex', 'zip'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setFormatFilter(option)}
                      className={`text-start w-full px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                        formatFilter === option
                          ? 'bg-gb-orange-light/10 text-gb-orange-light font-bold border-l-2 border-gb-orange-light'
                          : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
                      }`}
                      dir={language === 'fa' ? 'rtl' : 'ltr'}
                    >
                      {option === 'all' && t('all')}
                      {option === 'pdf' && t('pdf_format')}
                      {option === 'latex' && t('latex_format')}
                      {option === 'zip' && t('zip_format')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Banners Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        <CategoryButton
          active={selectedType === 'book'}
          onClick={() => handleTypeToggle('book')}
          disabled={loading}
          imgSrc="/book-pixel-art.svg"
          imgAlt="Book Banner"
          label={t("book_cat")}
          themeColor="orange"
        />
        <CategoryButton
          active={selectedType === 'latex'}
          onClick={() => handleTypeToggle('latex')}
          disabled={loading}
          imgSrc="/latex-pixel-art.svg"
          imgAlt="LaTeX Banner"
          label={t("latex_cat")}
          themeColor="orange"
        />
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        {/* Sidebar */}
        <aside className="w-full md:w-56 shrink-0">
          <div
            className="mb-4 text-lg font-bold text-gb-orange-light border-b border-gb-bg-soft pb-2 font-mono"
            dir={language === "fa" ? "rtl" : "ltr"}
          >
            {t("micro_categories")}
          </div>
          {loading ? (
            <p className="text-gb-fg-dark text-sm animate-pulse">
              Loading tags...
            </p>
          ) : categoryList.length > 0 ? (
            <ul className="flex md:flex-col gap-3 overflow-x-auto md:overflow-visible pb-4 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {categoryList.map(({ tag, count }) => {
                const isActive = selectedTag === tag;
                return (
                  <li key={tag} className="shrink-0">
                    <button
                      onClick={() => updateStateWithTransition(() => setSelectedTag(isActive ? null : tag))}
                      className={`flex items-center justify-between w-full text-left px-3 py-2 rounded transition-all font-mono text-sm group ${
                        isActive
                          ? "bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light shadow-[inset_2px_0_0_0_rgba(255,160,102,0.2)]"
                          : "hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent"
                      }`}
                      dir={language === "fa" ? "rtl" : "ltr"}
                    >
                      <span className="truncate mr-3 ml-3">#{tag}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${
                          isActive
                            ? "bg-gb-orange-light/20 text-gb-orange-light"
                            : "bg-gb-bg border border-gb-bg-soft group-hover:border-gb-fg-dark/30"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm font-mono text-gb-fg-dark" dir={language === "fa" ? "rtl" : "ltr"}>
              {t("no_categories")}
            </p>
          )}
        </aside>

        {/* Product Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-center text-gb-fg-dark py-12 animate-pulse">
              Loading products...
            </div>
          ) : sortedProducts.length > 0 ? (
            <div className="columns-1 xl:columns-2 gap-6 space-y-6 product-list">
              {sortedProducts.map((product) => {
                const translation = product.translations?.find(t => t.language === language) 
                  || product.translations?.find(t => t.language === 'en')
                  || { title: 'Untitled', description: '', features: [], price: 0 };
                return (
                <div key={product.id} className="product-card product-item break-inside-avoid">
                  <Link
                    to={
                      language === "fa"
                        ? `/fa/store/product/${product.id}`
                        : `/store/product/${product.id}`
                    }
                    className="block h-full"
                  >
                    <Card className="relative h-full flex flex-col bg-gb-bg-soft/5 overflow-hidden group/card border-gb-bg-soft/50 hover:border-gb-orange-light/50 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl cursor-pointer !p-0 !md:p-0">
                      {product.thumbnailUrl ? (
                        <div className="relative w-full overflow-hidden shrink-0">
                          <img src={product.thumbnailUrl} alt={translation.title} className="w-full h-auto transition-transform duration-700 group-hover/card:scale-105" />
                        </div>
                      ) : (
                        <div className="relative aspect-video w-full bg-gb-bg-soft/30 flex items-center justify-center overflow-hidden shrink-0">
                          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
                          <span className="text-gb-fg-dark/50 font-mono relative z-10 uppercase tracking-widest">{t('preview')}</span>
                        </div>
                      )}

                      {/* Premium Price Tag */}
                      <div className="absolute top-4 right-4 z-20 transition-transform duration-300 group-hover/card:scale-105 group-hover/card:rotate-2 origin-top-right" dir={language === "fa" ? "rtl" : "ltr"}>
                        <span className="bg-gb-orange-light text-black font-extrabold font-mono px-3 py-1.5 rounded-sm text-sm shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] product-price">
                          {language === "fa" ? `${new Intl.NumberFormat('fa-IR').format(translation.price)} ریال` : `$${translation.price}`}
                        </span>
                      </div>

                      <div
                        className="flex flex-col flex-1 p-6 relative z-20"
                        dir={language === "fa" ? "rtl" : "ltr"}
                      >
                        <h3 className="text-xl font-bold text-gb-fg mb-2 group-hover/card:text-gb-orange-light transition-colors duration-200 product-title">
                          {translation.title}
                        </h3>
                        <p className="text-gb-fg-dark text-sm leading-relaxed mb-6 line-clamp-2 product-description">
                          {translation.description}
                        </p>

                        {/* Scannable Value Props */}
                        <div className="space-y-2 mb-6 flex-1">
                          {translation.features.map((feature, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 px-2 py-1.5 rounded text-sm text-gb-fg-dark group-hover/card:text-gb-fg/80 transition-colors duration-200"
                            >
                              <Check className="w-4 h-4 text-gb-aqua-light shrink-0 opacity-70 group-hover/card:opacity-100 transition-opacity" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                          {product.tags.map((tag) => (
                            <Badge
                              key={tag}
                              className="bg-transparent text-gb-fg-dark/70 border-gb-bg-soft/50 text-xs px-2 py-0.5 rounded-full transition-colors group-hover/card:border-gb-orange-light/30 group-hover/card:text-gb-orange-light/80"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <Button className="w-full mt-auto gap-2 bg-gb-bg-soft/50 text-gb-fg border border-gb-bg-soft group-hover/card:bg-gb-orange-light group-hover/card:text-gb-bg group-hover/card:border-gb-orange-light font-mono font-bold transition-all duration-300 shadow-sm relative overflow-hidden group/btn">
                          {language === 'en' && (
                            <span className="absolute inset-0 w-full h-full -ml-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover/card:animate-[shimmer_1.5s_infinite]" />
                          )}
                          <ShoppingCart className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                          {product.type === 'book' ? t("purchase_book") : t("purchase_template")}
                        </Button>
                      </div>
                    </Card>
                  </Link>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-gb-bg-soft rounded-lg font-mono text-gb-fg-dark" dir={language === 'fa' ? 'rtl' : 'ltr'}>
              <div className="text-gb-orange-light text-lg font-bold mb-2">
                {t('no_products_found')}
              </div>
              <p className="text-sm text-gb-fg-dark mb-6">
                {language === 'fa'
                  ? 'تغییر فیلترها یا عبارت جستجو ممکن است به نتایج بیشتری منجر شود.'
                  : 'Try adjusting your search term or active category filters to get matches.'}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  updateStateWithTransition(() => {
                    setSearchQuery('');
                    setDebouncedQuery('');
                    setSelectedTag(null);
                    setSelectedType(null);
                    setSortBy('none');
                    setFormatFilter('all');
                  });
                }}
                className="cursor-pointer"
              >
                {t('reset_filters_search')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
