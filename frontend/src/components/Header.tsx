import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TerminalWindowIcon, GithubLogoIcon, TwitterLogoIcon, EnvelopeSimpleIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';

export function Header() {
  const { user, login, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const [showStoreLink, setShowStoreLink] = useState(true);
  const { settings } = useSettings();

  useEffect(() => {
    const adminSecret = localStorage.getItem('adminSecret');
    const isParamAdmin = new URLSearchParams(window.location.search).get('admin') === 'true';
    const isAdmin = !!adminSecret || isParamAdmin;

    if (settings) {
      if ((settings.store_maintenance || settings.site_maintenance) && !isAdmin) {
        setShowStoreLink(false);
      } else {
        setShowStoreLink(true);
      }
    }
  }, [settings]);
  
  return (
    <header className="border-b border-gb-bg-soft py-3 mt-2 md:py-6 md:mt-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
        <Link to={language === 'fa' ? '/fa' : '/'} className="flex items-center gap-3 md:gap-4 cursor-pointer group hover:no-underline">
          <div className="text-2xl md:text-3xl grayscale group-hover:grayscale-0 transition-all"><TerminalWindowIcon /></div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-mono tracking-tight text-gb-fg flex items-center">
              admin<span className="text-gb-red-light">@</span>log40<span className="text-gb-fg-dark animate-pulse">_</span>
            </h1>
            <p className="text-[10px] md:text-xs font-mono text-gb-fg-dark mt-0.5 md:mt-1">{t('subtitle')}</p>
          </div>
        </Link>
        
        <nav className="flex flex-row flex-wrap justify-center items-center gap-x-4 gap-y-2 md:gap-6 w-full md:w-auto">
          <div className="flex text-lg md:text-xl gap-3 md:gap-6">
            <a href="https://github.com/toghroltp" className="p-1 hover:scale-110 transition-transform rounded" aria-label="GitHub" title="GitHub">
              <GithubLogoIcon />
            </a>
            <a href="https://x.com/ToghrolDecson" className="p-1 hover:scale-110 transition-transform rounded" aria-label="Twitter" title="Twitter">
              <TwitterLogoIcon />
            </a>
            <a href="mailto:toghroltheprogrammer@gmail.com" className="p-1 hover:scale-110 transition-transform rounded" aria-label="Email" title="Email">
              <EnvelopeSimpleIcon />
            </a>
          </div>

          {showStoreLink && (
            <>
              <div className="h-px w-full md:w-px md:h-6 bg-gb-bg-soft hidden md:block"></div>
              <Link 
                to={language === 'fa' ? '/fa/store' : '/store'}
                className="text-sm font-mono font-bold text-gb-fg-dark hover:text-gb-orange-light transition-colors"
              >
                {t('store_nav')}
              </Link>
            </>
          )}

          <div className="h-px w-full md:w-px md:h-6 bg-gb-bg-soft hidden md:block"></div>
          <Link 
            to={language === 'fa' ? '/fa/about' : '/about'}
            className="text-sm font-mono font-bold text-gb-fg-dark hover:text-gb-orange-light transition-colors"
          >
            {language === 'fa' ? 'درباره' : 'About'}
          </Link>

          <div className="h-px w-full md:w-px md:h-6 bg-gb-bg-soft hidden md:block"></div>

          <button 
            onClick={toggleLanguage}
            className="text-xs font-mono font-bold text-gb-fg-dark hover:text-gb-orange-light uppercase transition-colors"
          >
            {language === 'en' ? 'FA' : 'EN'}
          </button>

          <div className="h-px w-full md:w-px md:h-6 bg-gb-bg-soft hidden md:block"></div>

          {user ? (
            <div className="flex items-center gap-3">
              <Link to={language === 'fa' ? '/fa/profile' : '/profile'} className="flex items-center gap-2 hover:opacity-85 transition-opacity" title={user.username}>
                <img src={user.avatar_url} alt={user.username} className="w-6 h-6 rounded-full border border-gb-fg-dark/30" />
              </Link>
              <Button variant="ghost" size="sm" onClick={logout} className="text-xs font-mono text-gb-fg-dark hover:text-gb-orange-light">
                {t('logout')}
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={login} className="text-xs font-mono text-gb-fg-dark hover:text-gb-aqua-light">
              {t('login')}
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
