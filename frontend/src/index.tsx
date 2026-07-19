import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { LanguageProvider, useLanguage } from './i18n';
import { installGlobalErrorReporting } from './utils/nonBlockingError';
import './index.css';

installGlobalErrorReporting();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const localeMap = {
  es: esES,
  zh: zhCN,
  en: enUS,
};

const LocalizedApp: React.FC = () => {
  const { language, t } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-MX' : 'en-US';
    document.title = t('common.siteTitle');
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute('content', t('common.siteDescription'));
  }, [language, t]);

  return (
    <ConfigProvider
      locale={localeMap[language]}
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
