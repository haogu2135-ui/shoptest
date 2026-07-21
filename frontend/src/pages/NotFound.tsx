import React from 'react';
import { Button, Result } from 'antd';
import { FileSearchOutlined, GiftOutlined, HomeOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import './NotFound.css';

const NotFound: React.FC = () => {
  const { t } = useLanguage();
  usePageTitle(t('notFound.title'));
  useDocumentMeta({
    title: t('notFound.title'),
    description: t('common.siteDescription'),
    path: '/404',
    type: 'website',
    noIndex: true,
    siteName: t('common.siteTitle'),
  });
  const navigate = useNavigate();
  const title = t('notFound.title');
  const subtitle = t('notFound.subtitle');
  const titleId = 'not-found-title';
  const subtitleId = 'not-found-subtitle';

  return (
    <main
      className="not-found-page"
      aria-label={title}
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
    >
      <Result
        status="404"
        title={<h1 id={titleId} className="not-found-page__title">{title}</h1>}
        subTitle={(
          <span id={subtitleId} role="status" aria-live="polite" className="not-found-page__status">
            <span className="not-found-page__subtitle">{subtitle}</span>
            <span className="not-found-page__hint">{t('notFound.hint')}</span>
          </span>
        )}
        extra={[
          <Button
            key="home"
            type="primary"
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
          >
            {t('notFound.backHome')}
          </Button>,
          <Button
            key="search"
            icon={<SearchOutlined />}
            onClick={() => navigate('/products')}
          >
            {t('notFound.searchProducts')}
          </Button>,
          <Button
            key="coupons"
            icon={<GiftOutlined />}
            onClick={() => navigate('/coupons')}
          >
            {t('notFound.browseCoupons')}
          </Button>,
          <Button
            key="track"
            icon={<FileSearchOutlined />}
            onClick={() => navigate('/track-order')}
          >
            {t('notFound.trackOrder')}
          </Button>,
        ]}
      />
    </main>
  );
};

export default NotFound;
