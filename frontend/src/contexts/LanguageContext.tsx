import React, { createContext, useContext, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import en from '../i18n/en.json';
import fa from '../i18n/fa.json';

type Language = 'en' | 'fa';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: keyof typeof en) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries = { en, fa };

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const language: Language = location.pathname.startsWith('/fa') ? 'fa' : 'en';

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    if (language === 'en') {
      navigate('/fa' + (location.pathname === '/' ? '' : location.pathname));
    } else {
      let newPath = location.pathname.replace(/^\/fa/, '');
      if (newPath === '') newPath = '/';
      navigate(newPath);
    }
  };

  const t = (key: keyof typeof en): string => {
    return dictionaries[language][key] || dictionaries['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
