import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SearchIcon, XIcon, SlidersHorizontalIcon, WrenchIcon } from './components/Icons';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { PostList } from './components/PostList';
import { PostDetail } from './components/PostDetail';
import { AdminPanel } from './components/AdminPanel';
import { Store } from './components/Store';
import { ProductDetail } from './components/ProductDetail';
import { About } from './components/About';
import { TerminalWindowIcon } from './components/Icons';
import { Post } from './types';
import { UpvoteProvider } from './contexts/UpvoteContext';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { SEO } from './components/SEO';
import { Button } from './components/ui/Button';
import { CategoryButton } from './components/ui/CategoryButton';
import { Pagination } from './components/ui/Pagination';
import { FeedbackButton } from './components/FeedbackButton';

function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isBlogMaintenance, setIsBlogMaintenance] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'upvotes'>('newest');
  const [readTimeFilter, setReadTimeFilter] = useState<'all' | 'short' | 'medium' | 'long'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const { language, t } = useLanguage();
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

    fetch('/api/settings')
      .then(res => res.json())
      .then(settings => {
        if (settings.blog_maintenance && !isAdmin) {
          setIsBlogMaintenance(true);
          return;
        }

        fetch('/api/posts', { headers })
          .then(res => {
            if (res.status === 503) {
              setIsBlogMaintenance(true);
              return [];
            }
            return res.json();
          })
          .then(data => setPosts(data))
          .catch(err => console.error("Failed to fetch posts:", err));
      })
      .catch(err => {
        console.error("Failed to fetch settings:", err);
        fetch('/api/posts', { headers })
          .then(res => res.json())
          .then(data => setPosts(data))
          .catch(postErr => console.error("Failed to fetch posts fallback:", postErr));
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTag, selectedType, debouncedQuery, sortBy, readTimeFilter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.hasAttribute('contenteditable')
      )) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const languagePosts = posts.filter(p => p.translations?.some(t => t.language === language));

  const getCategoryCountText = (type: string) => {
    const count = languagePosts.filter((p) => p.type === type).length;
    if (language === 'fa') {
      return `${new Intl.NumberFormat('fa-IR').format(count)} مطلب`;
    }
    return `${count} ${count === 1 ? 'post' : 'posts'}`;
  };

  const filteredByTypePosts = selectedType 
    ? languagePosts.filter(post => post.type === selectedType)
    : languagePosts;

  const tagCounts = filteredByTypePosts.reduce((acc, post) => {
    post.tags.forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const filteredPosts = filteredByTypePosts.filter(post => {
    // 1. Tag filter
    const matchesTag = selectedTag ? post.tags.includes(selectedTag) : true;
    if (!matchesTag) return false;

    // 2. Read Time filter
    if (readTimeFilter !== 'all') {
      const translation = post.translations?.find(t => t.language === language)
        || post.translations?.find(t => t.language === 'en');
      if (!translation) return false;
      
      const rt = translation.readTime;
      if (readTimeFilter === 'short' && rt >= 5) return false;
      if (readTimeFilter === 'medium' && (rt < 5 || rt > 10)) return false;
      if (readTimeFilter === 'long' && rt <= 10) return false;
    }

    // 3. Search query filter
    if (!debouncedQuery.trim()) return true;

    const query = debouncedQuery.toLowerCase().trim();

    const translation = post.translations?.find(t => t.language === language)
      || post.translations?.find(t => t.language === 'en');

    if (!translation) return false;

    const matchesTitle = translation.title.toLowerCase().includes(query);
    const matchesSummary = translation.summary.toLowerCase().includes(query);
    const matchesContent = translation.content.toLowerCase().includes(query);
    const matchesTags = post.tags.some(tag => tag.toLowerCase().includes(query));
    const matchesId = post.id.toLowerCase().includes(query);

    return matchesTitle || matchesSummary || matchesContent || matchesTags || matchesId;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortBy === 'upvotes') {
      return b.upvotes - a.upvotes;
    }
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (sortBy === 'oldest') {
      return timeA - timeB;
    }
    return timeB - timeA;
  });

  const POSTS_PER_PAGE = 6;
  const totalPages = Math.ceil(sortedPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = sortedPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    updateStateWithTransition(() => {
      setCurrentPage(page);
    });
  };

  const descHtml = t('welcome_desc')
    .replace('<1>', '<span class="text-gb-aqua-light">')
    .replace('</1>', '</span>')
    .replace('<2>', '<span class="text-gb-yellow-light">')
    .replace('</2>', '</span>')
    .replace('<3>', '<span class="text-gb-green-light">')
    .replace('</3>', '</span>');

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
          languagePosts
            .filter((p) => !nextType || p.type === nextType)
            .flatMap((p) => p.tags)
        );
        if (!activeTags.has(selectedTag)) {
          setSelectedTag(null);
        }
      }
      if (nextType) {
        setTimeout(() => {
          filterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    });
  };

  if (isBlogMaintenance) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center font-mono animate-in fade-in duration-500">
        <div className="max-w-md w-full border-2 border-gb-red/50 bg-gb-bg-soft/10 p-8 rounded-lg shadow-[4px_4px_0_0_rgba(204,36,29,0.15)] relative overflow-hidden">
          <div className="text-gb-red-light text-5xl mb-6 flex justify-center animate-pixel-float">
            <WrenchIcon size={48} />
          </div>
          
          <h1 className="text-2xl font-bold text-gb-fg mb-4 border-b border-gb-bg-soft pb-4">
            {t("blog_maintenance_title")}
          </h1>
          
          <p className="text-sm text-gb-fg-dark leading-relaxed mb-6">
            {t("blog_maintenance_desc")}
          </p>
          
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => window.location.reload()} className="text-xs border border-gb-bg-soft hover:border-gb-orange-light text-gb-fg-dark hover:text-gb-orange-light font-mono flex items-center gap-2 cursor-pointer transition-all duration-200">
              {language === "fa" ? "تلاش مجدد" : "Retry"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
      <SEO title={`${t('welcome_title') || 'Welcome'} | Log40`}>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${window.location.origin}/#organization`,
            "name": "Log40",
            "url": `${window.location.origin}/`,
            "logo": `${window.location.origin}/favicon.png`,
            "sameAs": [
              "https://github.com/toghrol",
              "https://linkedin.com/in/toghrol"
            ]
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${window.location.origin}/#website`,
            "url": `${window.location.origin}/`,
            "name": "Log40",
            "description": "A personal blog sharing insights on software engineering, web development, and technology.",
            "publisher": {
              "@id": `${window.location.origin}/#organization`
            },
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${window.location.origin}/?q={search_term_string}`
              },
              "query-input": "required name=search_term_string"
            }
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            "@id": `${window.location.origin}/#blog`,
            "name": "Log40 Blog",
            "description": "A personal blog sharing insights on software engineering, web development, and technology.",
            "publisher": {
              "@id": `${window.location.origin}/#organization`
            }
          })}
        </script>
      </SEO>
      <div className="mb-16 font-mono text-gb-fg-dark border-l-4 border-gb-orange-light pl-6 py-2" dir={language === 'fa' ? 'rtl' : 'ltr'}>
        <p className="text-4xl font-bold text-gb-fg mb-4 tracking-tight rtl:tracking-normal">{t('welcome_title')}</p>
        <p className="text-lg leading-relaxed" dangerouslySetInnerHTML={{ __html: descHtml }}></p>
      </div>

      {/* Category Banners Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <CategoryButton
          active={selectedType === 'linux'}
          dimmed={selectedType !== null && selectedType !== 'linux'}
          postCountText={getCategoryCountText('linux')}
          onClick={() => handleTypeToggle('linux')}
          imgSrc="/chatgpt-linux-pixel-art.png"
          imgAlt={t('linux_cat')}
          label={t('linux_cat')}
        />
        <CategoryButton
          active={selectedType === 'cybersecurity'}
          dimmed={selectedType !== null && selectedType !== 'cybersecurity'}
          postCountText={getCategoryCountText('cybersecurity')}
          onClick={() => handleTypeToggle('cybersecurity')}
          imgSrc="/cybersecurity-guy.png"
          imgAlt={t('cybersecurity_cat')}
          label={t('cybersecurity_cat')}
        />
        <CategoryButton
          active={selectedType === 'backend'}
          dimmed={selectedType !== null && selectedType !== 'backend'}
          postCountText={getCategoryCountText('backend')}
          onClick={() => handleTypeToggle('backend')}
          imgSrc="/backend_gear_icon_gruvbox_transparent.png"
          imgAlt={t('backend_cat')}
          label={t('backend_cat')}
        />
        <CategoryButton
          active={selectedType === 'devops'}
          dimmed={selectedType !== null && selectedType !== 'devops'}
          postCountText={getCategoryCountText('devops')}
          onClick={() => handleTypeToggle('devops')}
          imgSrc="/devops_icon_gruvbox.png"
          imgAlt={t('devops_cat')}
          label={t('devops_cat')}
        />
        <CategoryButton
          active={selectedType === 'terminal'}
          dimmed={selectedType !== null && selectedType !== 'terminal'}
          postCountText={getCategoryCountText('terminal')}
          onClick={() => handleTypeToggle('terminal')}
          imgSrc="/terminal_personal_computer_icon_gruvbox.png"
          imgAlt={t('terminal_cat')}
          label={t('terminal_cat')}
        />
        <CategoryButton
          active={selectedType === 'academic'}
          dimmed={selectedType !== null && selectedType !== 'academic'}
          postCountText={getCategoryCountText('academic')}
          onClick={() => handleTypeToggle('academic')}
          imgSrc="/article_icon_gruvbox.png"
          imgAlt={t('academic_cat')}
          label={t('academic_cat')}
        />
      </div>

      {/* Search & Filter Container */}
      <div className="mb-12 flex items-center gap-3 max-w-xl relative" ref={filterRef}>
        <div className="relative flex-1 flex items-center">
          <span className="absolute start-3 text-gb-fg-dark/60">
            <SearchIcon size={18} />
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_posts_placeholder')}
            className="w-full bg-gb-bg-soft/20 text-gb-fg placeholder:text-gb-fg-dark/50 border-2 border-gb-bg-soft focus:border-gb-orange-light focus:outline-none focus:bg-gb-bg-soft/40 rounded px-10 py-3 font-mono text-sm transition-all"
            dir={language === 'fa' ? 'rtl' : 'ltr'}
          />
          <div className="absolute end-3 flex items-center gap-2">
            {searchQuery ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedQuery('');
                }}
                className="text-gb-fg-dark hover:text-gb-red-light transition-colors cursor-pointer"
                title="Clear search"
              >
                <XIcon size={18} />
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
              isFilterOpen || sortBy !== 'newest' || readTimeFilter !== 'all'
                ? 'bg-gb-orange-light text-gb-bg border-gb-orange-light shadow-[0_0_10px_rgba(254,128,25,0.25)] font-bold'
                : 'bg-gb-bg-soft/20 text-gb-fg border-gb-bg-soft hover:border-gb-orange-light/40 hover:bg-gb-bg-soft/30'
            }`}
            title="Filter posts"
          >
            <SlidersHorizontalIcon size={18} />
            <span className="hidden sm:inline">{t('filters')}</span>
            {(sortBy !== 'newest' || readTimeFilter !== 'all') && (
              <span className="w-2.5 h-2.5 rounded-full bg-current border border-gb-bg-soft" />
            )}
          </button>

          {isFilterOpen && (
            <div className={`absolute ${language === 'fa' ? 'left-0 origin-top-left' : 'right-0 origin-top-right'} mt-2 w-64 bg-gb-bg border-2 border-gb-bg-soft shadow-[0_10px_25px_rgba(0,0,0,0.5)] p-4 z-40 font-mono text-xs rounded transition-all animate-in fade-in slide-in-from-top-2 duration-200`}>
              {/* Sort By section */}
              <div className="mb-4">
                <div className="text-gb-orange-light font-bold mb-2 uppercase tracking-wider">{t('sort_by')}</div>
                <div className="flex flex-col gap-1.5">
                  {(['newest', 'oldest', 'upvotes'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setSortBy(option)}
                      className={`text-start w-full px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                        sortBy === option
                          ? 'bg-gb-orange-light/10 text-gb-orange-light font-bold border-l-2 border-gb-orange-light'
                          : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
                      }`}
                      dir={language === 'fa' ? 'rtl' : 'ltr'}
                    >
                      {option === 'newest' && t('newest')}
                      {option === 'oldest' && t('oldest')}
                      {option === 'upvotes' && t('most_upvoted')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Read Time filter section */}
              <div>
                <div className="text-gb-orange-light font-bold mb-2 uppercase tracking-wider">{t('filter_read_time')}</div>
                <div className="flex flex-col gap-1.5">
                  {(['all', 'short', 'medium', 'long'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => setReadTimeFilter(option)}
                      className={`text-start w-full px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                        readTimeFilter === option
                          ? 'bg-gb-orange-light/10 text-gb-orange-light font-bold border-l-2 border-gb-orange-light'
                          : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
                      }`}
                      dir={language === 'fa' ? 'rtl' : 'ltr'}
                    >
                      {option === 'all' && t('all')}
                      {option === 'short' && t('short_read')}
                      {option === 'medium' && t('medium_read')}
                      {option === 'long' && t('long_read')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        <aside className="w-full md:w-56 shrink-0">
          <div className="mb-4 text-lg font-bold text-gb-orange-light border-b border-gb-bg-soft pb-2 font-mono" dir={language === 'fa' ? 'rtl' : 'ltr'}>
            {t('micro_categories')}
          </div>
          {sortedTags.length > 0 ? (
            <ul className="flex md:flex-col gap-3 overflow-x-auto md:overflow-visible pb-4 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {sortedTags.map(([tag, count]) => {
                const isActive = selectedTag === tag;
                return (
                  <li key={tag} className="shrink-0">
                    <button
                      onClick={() => updateStateWithTransition(() => setSelectedTag(isActive ? null : tag))}
                      className={`flex items-center justify-between w-full text-left px-3 py-2 rounded transition-all font-mono text-sm group cursor-pointer ${
                        isActive 
                          ? 'bg-gb-orange-light/10 text-gb-orange-light border-l-2 border-gb-orange-light shadow-[inset_2px_0_0_0_rgba(255,160,102,0.2)]' 
                          : 'hover:bg-gb-bg-soft text-gb-fg-dark hover:text-gb-fg border-l-2 border-transparent'
                      }`}
                      dir={language === 'fa' ? 'rtl' : 'ltr'}
                    >
                      <span className="truncate mr-3 ml-3">#{tag}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${
                        isActive ? 'bg-gb-orange-light/20 text-gb-orange-light' : 'bg-gb-bg border border-gb-bg-soft group-hover:border-gb-fg-dark/30'
                      }`}>
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm font-mono text-gb-fg-dark" dir={language === 'fa' ? 'rtl' : 'ltr'}>{t('no_categories')}</p>
          )}
        </aside>

        <div className="flex-1 min-w-0">
          {selectedTag && (
            <div className="mb-6 flex items-center justify-between bg-gb-bg-soft/50 rounded-lg px-4 py-3 font-mono text-sm border border-gb-bg-soft" dir={language === 'fa' ? 'rtl' : 'ltr'}>
              <span>
                {t('showing_posts_tagged')}<span className="text-gb-orange-light font-bold">#{selectedTag}</span>
              </span>
              <button 
                onClick={() => updateStateWithTransition(() => setSelectedTag(null))}
                className="text-gb-fg-dark hover:text-gb-red-light transition-colors underline decoration-gb-red-light/30 underline-offset-2 cursor-pointer"
              >
                {t('clear_filter')}
              </button>
            </div>
          )}
          {paginatedPosts.length > 0 ? (
            <>
              <PostList posts={paginatedPosts} />
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                language={language}
              />
            </>
          ) : (
            <div className="text-center py-16 border-2 border-dashed border-gb-bg-soft rounded-lg font-mono text-gb-fg-dark" dir={language === 'fa' ? 'rtl' : 'ltr'}>
              <div className="text-gb-orange-light text-lg font-bold mb-2">
                {t('no_posts_found')}
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
                    setSortBy('newest');
                    setReadTimeFilter('all');
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

function AppContent() {
  const [isBooting, setIsBooting] = useState(true);
  const [isSiteMaintenance, setIsSiteMaintenance] = useState(false);
  const { t, language } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 800);

    const adminSecret = localStorage.getItem('adminSecret');
    const isParamAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isAdmin = !!adminSecret || isParamAdmin;
    const isLoginPage = window.location.pathname === '/admin';

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.site_maintenance && !isAdmin && !isLoginPage) {
          setIsSiteMaintenance(true);
        }
      })
      .catch((err) => console.error("Error fetching settings:", err));

    return () => clearTimeout(timer);
  }, []);

  if (isBooting) {
    return (
      <div className="min-h-screen bg-gb-bg flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4 animate-pulse flex justify-center"><TerminalWindowIcon /></div>
        <p className="text-gb-fg-dark font-mono animate-pulse">{t('mounting')}</p>
      </div>
    );
  }

  if (isSiteMaintenance) {
    return (
      <div className="min-h-screen bg-gb-bg text-gb-fg flex flex-col items-center justify-center p-6 text-center font-mono selection:bg-gb-bg-light selection:text-gb-orange-light">
        <div className="max-w-md w-full border-2 border-gb-red/50 bg-gb-bg-soft/10 p-8 rounded-lg shadow-[4px_4px_0_0_rgba(204,36,29,0.15)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-stripes bg-gb-red-light animate-pulse"></div>
          
          <div className="text-gb-red-light text-5xl mb-6 flex justify-center animate-pixel-float">
            <WrenchIcon size={48} />
          </div>
          
          <h1 className="text-2xl font-bold text-gb-fg mb-4 border-b border-gb-bg-soft pb-4">
            {t("site_maintenance_title")}
          </h1>
          
          <p className="text-sm text-gb-fg-dark leading-relaxed mb-6">
            {t("site_maintenance_desc")}
          </p>

          <p className="text-[10px] text-gb-fg-dark/50 uppercase tracking-widest animate-pulse mt-4">
            System Offline
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <UpvoteProvider>
        <div className="min-h-screen bg-gb-bg text-gb-fg p-6 sm:p-8 md:p-12 selection:bg-gb-bg-light selection:text-gb-orange-light">
            <div className="max-w-5xl mx-auto w-full">
              <Header />
              
              <main className="mt-16 min-h-[50vh]">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/store" element={<Store />} />
                  <Route path="/store/product/:id" element={<ProductDetail />} />
                  <Route path="/post/:id" element={<PostDetail />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/fa" element={<Home />} />
                  <Route path="/fa/store" element={<Store />} />
                  <Route path="/fa/store/product/:id" element={<ProductDetail />} />
                  <Route path="/fa/post/:id" element={<PostDetail />} />
                  <Route path="/fa/about" element={<About />} />
                  <Route path="/admin" element={<AdminPanel />} />
                </Routes>
              </main>
              
              <Footer />
              <FeedbackButton />
            </div>
          </div>
      </UpvoteProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </BrowserRouter>
  );
}
