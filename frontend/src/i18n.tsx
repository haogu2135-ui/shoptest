import React, { createContext, useContext, useMemo, useState } from 'react';
import enLocale from './locales/en.json';
import esLocale from './locales/es.json';
import zhLocale from './locales/zh.json';
import { getLocalStorageItem, setLocalStorageItem } from './utils/safeStorage';

export const SUPPORTED_LANGUAGES = ['es', 'zh', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const LANGUAGE_LABELS: Record<Language, string> = {
  es: 'Español',
  zh: '中文',
  en: 'English',
};

type TranslationMap = {
  [key: string]: string | TranslationMap;
};

export type TranslationParams = Record<string, string | number>;
export type TranslateFn = (key: string, params?: TranslationParams) => string;

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
  t: TranslateFn;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const isLanguage = (value: string | null): value is Language =>
  Boolean(value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value));

const detectBrowserLanguage = (): Language => {
  const browserLanguages = typeof navigator === 'undefined'
    ? []
    : [...(navigator.languages || []), navigator.language || ''];
  const locales = browserLanguages.map((value) => value.toLowerCase()).filter(Boolean);
  if (locales.some((locale) => locale.startsWith('zh'))) {
    return 'zh';
  }
  if (locales.some((locale) => locale.startsWith('es'))) {
    return 'es';
  }
  const timezone = typeof Intl === 'undefined'
    ? ''
    : Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (/china|shanghai|hong_kong|hongkong|taipei|macau|chongqing|urumqi/i.test(timezone)) {
    return 'zh';
  }
  return timezone.includes('Mexico') ? 'es' : 'en';
};

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
  const hasDefaultValue = Boolean(params && Object.prototype.hasOwnProperty.call(params, 'defaultValue'));
  const defaultValue = hasDefaultValue ? params?.defaultValue : undefined;
  const template = typeof translated === 'string'
    ? translated
    : typeof fallback === 'string'
      ? fallback
      : hasDefaultValue
        ? String(defaultValue)
        : humanizeKey(key);
  if (!params) return template;
  return Object.entries(params).filter(([paramKey]) => paramKey !== 'defaultValue').reduce(
    (result, [paramKey, value]) => result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value)),
    template,
  );
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const storedLanguage = getLocalStorageItem(STORAGE_KEY);
    if (isLanguage(storedLanguage)) return storedLanguage;
    return detectBrowserLanguage();
  });

  const setLanguage = (nextLanguage: Language) => {
    setLocalStorageItem(STORAGE_KEY, nextLanguage);
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
