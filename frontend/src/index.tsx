import React, { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import type { Locale } from 'antd/es/locale';
import App from './App';
import { LanguageProvider, useLanguage } from './i18n';
import { installGlobalErrorReporting, reportNonBlockingError } from './utils/nonBlockingError';
import './index.css';

installGlobalErrorReporting();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

type ConfigProviderProps = {
  locale?: Locale;
  theme?: {
    token?: {
      colorTextSecondary?: string;
      colorTextTertiary?: string;
      colorTextDescription?: string;
    };
  };
  children?: ReactNode;
};

const shopTheme: ConfigProviderProps['theme'] = {
  token: {
    // WCAG AA secondary text contrast (>= 4.5:1 on white).
    colorTextSecondary: 'rgba(16, 47, 34, 0.72)',
    colorTextTertiary: 'rgba(16, 47, 34, 0.58)',
    colorTextDescription: 'rgba(16, 47, 34, 0.72)',
  },
};

const loadAntdLocale = async (language: string): Promise<Locale> => {
  if (language === 'zh') {
    const module = await import(/* webpackChunkName: "antd-locale-zh" */ 'antd/locale/zh_CN');
    return module.default;
  }
  if (language === 'es') {
    const module = await import(/* webpackChunkName: "antd-locale-es" */ 'antd/locale/es_ES');
    return module.default;
  }
  const module = await import(/* webpackChunkName: "antd-locale-en" */ 'antd/locale/en_US');
  return module.default;
};

/** ConfigProvider is deferred so anonymous LCP does not pay for the full antd runtime in main. */
const loadConfigProvider = () =>
  import(/* webpackChunkName: "antd-config-provider" */ 'antd/es/config-provider').then((module) => module.default);

/** Ant Design commercial theme overrides load with ConfigProvider, not the shell CSS. */
const loadAntdThemeOverrides = () =>
  import(/* webpackChunkName: "antd-theme-overrides" */ './styles/antd-theme-overrides.css');

const LocalizedApp: React.FC = () => {
  const { language, t } = useLanguage();
  const [antdLocale, setAntdLocale] = useState<Locale | undefined>(undefined);
  const [ConfigProvider, setConfigProvider] = useState<ComponentType<ConfigProviderProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadConfigProvider(), loadAntdThemeOverrides()])
      .then(([provider]) => {
        if (!cancelled) setConfigProvider(() => provider as ComponentType<ConfigProviderProps>);
      })
      .catch((error) => {
        reportNonBlockingError('index.loadConfigProvider', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAntdLocale(language)
      .then((locale) => {
        if (!cancelled) setAntdLocale(locale);
      })
      .catch((error) => {
        reportNonBlockingError('index.loadAntdLocale', error);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
    document.title = t('common.siteTitle');
    const siteTitle = t('common.siteTitle');
    const siteDescription = t('common.siteDescription');
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute('content', siteDescription);
    const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let node = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!node) {
        node = document.createElement('meta');
        node.setAttribute(attr, key);
        document.head.appendChild(node);
      }
      node.setAttribute('content', content);
    };
    upsertMeta('property', 'og:site_name', siteTitle);
    upsertMeta('property', 'og:title', siteTitle);
    upsertMeta('property', 'og:description', siteDescription);
    upsertMeta('name', 'twitter:title', siteTitle);
    upsertMeta('name', 'twitter:description', siteDescription);
  }, [language, t]);

  // First paint without ConfigProvider keeps main free of static antd; theme applies once the chunk lands.
  if (!ConfigProvider) {
    return <App />;
  }

  return (
    <ConfigProvider locale={antdLocale} theme={shopTheme}>
      <App />
    </ConfigProvider>
  );
};

root.render(
  <React.StrictMode>
    <LanguageProvider>
      <LocalizedApp />
    </LanguageProvider>
  </React.StrictMode>
);
