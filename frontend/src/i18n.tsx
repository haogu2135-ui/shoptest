import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
// ShopMX Mexico-first: Spanish storefront pack ships with the shell to avoid EN→ES flash.
// Admin Spanish namespaces load with AdminLayout so anonymous LCP stays lighter.
// English is the commercial fallback pack and loads on demand so the initial shell stays lighter.
import esLocale from './locales/es.json';
import { getLocalStorageItem, setLocalStorageItem } from './utils/safeStorage';
import { reportNonBlockingError } from './utils/nonBlockingError';

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

const esMap = esLocale as TranslationMap;

// Spanish is the Mexico-first home pack and is bundled to avoid first-paint English flash.
// English remains the commercial fallback pack but is code-split for shell budget.
// Chinese still loads on demand (after English base is available).
const translations: Record<Language, TranslationMap> = {
  es: esMap,
  en: esMap,
  zh: esMap,
};

const packLoaded: Record<Language, boolean> = {
  es: true,
  en: false,
  zh: false,
};

const packPromises: Partial<Record<Language, Promise<TranslationMap>>> = {};

let adminSpanishPackPromise: Promise<TranslationMap> | null = null;
let adminSpanishPackLoaded = false;

/** Merge deferred Spanish admin page namespaces (admin panel only). */
export const ensureAdminSpanishPack = async (): Promise<TranslationMap> => {
  if (adminSpanishPackLoaded) {
    return translations.es;
  }
  if (!adminSpanishPackPromise) {
    adminSpanishPackPromise = (async () => {
      const module = await import(/* webpackChunkName: "i18n-es-admin" */ './locales/es-admin-pages.json');
      const adminMap = module.default as TranslationMap;
      translations.es = mergeTranslations(translations.es, adminMap);
      // Keep zh/en bases unchanged; admin Spanish is only required for es admin operators.
      adminSpanishPackLoaded = true;
      return translations.es;
    })().catch((error) => {
      adminSpanishPackPromise = null;
      throw error;
    });
  }
  return adminSpanishPackPromise;
};

export const ensureLanguagePack = async (language: Language): Promise<TranslationMap> => {
  if (packLoaded[language]) {
    return translations[language];
  }
  if (!packPromises[language]) {
    packPromises[language] = (async () => {
      if (language === 'es') {
        packLoaded.es = true;
        return translations.es;
      }
      if (language === 'en') {
        const module = await import(/* webpackChunkName: "i18n-en" */ './locales/en.json');
        const enMap = module.default as TranslationMap;
        translations.en = enMap;
        // Fill any missing Spanish keys from English without losing local overrides.
        translations.es = mergeTranslations(enMap, esMap);
        packLoaded.en = true;
        return translations.en;
      }
      if (language === 'zh') {
        await ensureLanguagePack('en');
        const module = await import(/* webpackChunkName: "i18n-zh" */ './locales/zh.json');
        translations.zh = mergeTranslations(translations.en, module.default as TranslationMap);
        packLoaded.zh = true;
        return translations.zh;
      }
      // Exhaustive Language union — keep TypeScript honest if a new language is added.
      const exhaustive: never = language;
      throw new Error(`Unsupported language pack: ${String(exhaustive)}`);
    })().catch((error) => {
      delete packPromises[language];
      throw error;
    });
  }
  return packPromises[language] as Promise<TranslationMap>;
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
  // ShopMX is Mexico-first: Spanish for Mexico TZ and ambiguous non-Chinese locales.
  if (/mexico|monterrey|cancun|tijuana|mazatlan|chihuahua|hermosillo|bahia_banderas/i.test(timezone)) {
    return 'es';
  }
  return 'es';
};

const resolveInitialLanguage = (): Language => {
  const storedLanguage = getLocalStorageItem(STORAGE_KEY);
  if (isLanguage(storedLanguage)) return storedLanguage;
  // Persist home-market language so nav/checkout/support stay aligned across sessions
  // (mirrors MXN currency seed). Keep Chinese when browser/timezone clearly indicates it.
  const detected = detectBrowserLanguage();
  const home: Language = detected === 'zh' ? 'zh' : 'es';
  setLocalStorageItem(STORAGE_KEY, home);
  return home;
};

const scheduleIdle = (work: () => void, timeoutMs: number) => {
  if (typeof window === 'undefined') return;
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(work, { timeout: timeoutMs });
    return;
  }
  window.setTimeout(work, Math.min(timeoutMs, 1500));
};

// Warm the active pack as soon as the language module boots.
if (typeof window !== 'undefined') {
  const initialLanguage = resolveInitialLanguage();
  void ensureLanguagePack(initialLanguage).catch((error) => {
    reportNonBlockingError('i18n.ensureLanguagePack.bootstrap', error);
  });
  // Idle-warm English fallback so rare missing Spanish keys recover without blocking first paint.
  if (initialLanguage === 'es') {
    scheduleIdle(() => {
      void ensureLanguagePack('en').catch((error) => {
        reportNonBlockingError('i18n.ensureLanguagePack.idleWarmEn', error);
      });
    }, 4000);
  }
}

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

const escapeTranslationParamKey = (key: string) =>
  key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const translateForLanguage = (language: Language, key: string, params?: TranslationParams) => {
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
    (result, [paramKey, value]) => result.replace(
      new RegExp(`\\{${escapeTranslationParamKey(paramKey)}\\}`, 'g'),
      () => String(value),
    ),
    template,
  );
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => resolveInitialLanguage());
  const [packRevision, setPackRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Only bump packRevision when a pack actually becomes available for the first time.
    // Re-bumping an already-loaded English pack remints `t` and retriggers storefront fetches.
    const needsRevisionBump = !packLoaded[language];
    ensureLanguagePack(language)
      .then(() => {
        if (!cancelled && needsRevisionBump) {
          setPackRevision((value) => value + 1);
        }
      })
      .catch((error) => {
        reportNonBlockingError('i18n.ensureLanguagePack.provider', error);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLocalStorageItem(STORAGE_KEY, nextLanguage);
    setLanguageState(nextLanguage);
    void ensureLanguagePack(nextLanguage).catch((error) => {
      reportNonBlockingError('i18n.ensureLanguagePack.setLanguage', error);
    });
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      // packRevision intentionally remints `t` after a newly loaded language pack arrives.
      t: (key: string, params?: TranslationParams) => translateForLanguage(language, key, params),
    }),
    [language, packRevision, setLanguage],
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
