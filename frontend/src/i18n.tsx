import React, { createContext, useContext, useMemo, useState } from 'react';
import enLocale from './locales/en.json';
import esLocale from './locales/es.json';
import zhLocale from './locales/zh.json';

export type Language = 'es' | 'zh' | 'en';

type TranslationMap = {
  [key: string]: string | TranslationMap;
};

type TranslationParams = Record<string, string | number>;

const STORAGE_KEY = 'shop-language';

const mergeTranslations = (base: TranslationMap, override: TranslationMap): TranslationMap => {
  const result: TranslationMap = { ...base };
  Object.entries(override).forEach(([key, value]) => {
    const baseValue = base[key];
    if (typeof value === 'string' || typeof baseValue === 'string' || !baseValue) {
      result[key] = value;
    } else {
      result[key] = mergeTranslations(baseValue as TranslationMap, value as TranslationMap);
    }
  });
  return result;
};

const translations: Record<Language, TranslationMap> = {
  en: enLocale as TranslationMap,
  es: mergeTranslations(enLocale as TranslationMap, esLocale as TranslationMap),
  zh: mergeTranslations(enLocale as TranslationMap, zhLocale as TranslationMap),
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: TranslationParams) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const isLanguage = (value: string | null): value is Language =>
  value === 'es' || value === 'zh' || value === 'en';

const getNestedValue = (source: TranslationMap, key: string) =>
  key.split('.').reduce<string | TranslationMap | undefined>((current, part) => {
    if (!current || typeof current === 'string') return undefined;
    return current[part];
  }, source);

const humanizeKey = (key: string) => {
  const last = key.split('.').pop() || key;
  return last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
};

const translate = (language: Language, key: string, params?: TranslationParams) => {
  const translated = getNestedValue(translations[language], key);
  const fallback = getNestedValue(translations.en, key);
  const template = typeof translated === 'string'
    ? translated
    : typeof fallback === 'string'
      ? fallback
      : humanizeKey(key);
  if (!params) return template;
  return Object.entries(params).reduce(
    (result, [paramKey, value]) => result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value)),
    template,
  );
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const storedLanguage = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(storedLanguage)) return storedLanguage;
    const locale = navigator.language || '';
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return locale.toLowerCase().includes('mx') || timezone.includes('Mexico') ? 'es' : 'en';
  });

  const setLanguage = (nextLanguage: Language) => {
    localStorage.setItem(STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string, params?: TranslationParams) => translate(language, key, params),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return context;
};
