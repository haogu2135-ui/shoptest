import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { LanguageProvider, useLanguage } from './i18n';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const localeMap = {
  es: esES,
  zh: zhCN,
  en: enUS,
};

const LocalizedApp: React.FC = () => {
  const { language } = useLanguage();

  return (
    <ConfigProvider locale={localeMap[language]}>
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
