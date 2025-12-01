'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import enTranslations from '@/i18n/en.json';
import idTranslations from '@/i18n/id.json';

const I18nContext = createContext(null);

const translations = {
  en: enTranslations,
  id: idTranslations,
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('en');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedLang = localStorage.getItem('indusia_lang');
    if (savedLang && (savedLang === 'en' || savedLang === 'id')) {
      setLangState(savedLang);
    }
  }, []);

  const setLang = useCallback((newLang) => {
    if (newLang === 'en' || newLang === 'id') {
      setLangState(newLang);
      if (isClient) {
        localStorage.setItem('indusia_lang', newLang);
      }
    }
  }, [isClient]);

  const t = useCallback(
    (key) => {
      const keys = key.split('.');
      let value = translations[lang];

      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k];
        } else {
          return key;
        }
      }

      return typeof value === 'string' ? value : key;
    },
    [lang]
  );

  const value = {
    lang,
    setLang,
    t,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18nContext() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18nContext must be used within I18nProvider');
  }
  return context;
}
