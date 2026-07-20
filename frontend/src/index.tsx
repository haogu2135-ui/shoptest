import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import type { Locale } from 'antd/es/locale';
import enUS from 'antd/locale/en_US';
import App from './App';
import { LanguageProvider, useLanguage } from './i18n';
import { installGlobalErrorReporting, reportNonBlockingError } from './utils/nonBlockingError';
import './index.css';

installGlobalErrorReporting();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

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

const LocalizedApp: React.FC = () => {
  const { language, t } = useLanguage();
  const [antdLocale, setAntdLocale] = useState<Locale>(enUS);

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

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: {
          // WCAG AA secondary text contrast (>= 4.5:1 on white).
          colorTextSecondary: 'rgba(16, 47, 34, 0.72)',
          colorTextTertiary: 'rgba(16, 47, 34, 0.58)',
          colorTextDescription: 'rgba(16, 47, 34, 0.72)',
        },
      }}
    >
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
