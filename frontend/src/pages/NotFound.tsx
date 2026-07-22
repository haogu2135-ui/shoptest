import React from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';
import { Button } from 'antd';
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
      <section className="not-found-page__result not-found-page__result--404" role="status">
        <div className="not-found-page__resultIcon" aria-hidden="true">404</div>
        <h1 id={titleId} className="not-found-page__title">{title}</h1>
        <div id={subtitleId} className="not-found-page__status" role="status" aria-live="polite">
          <span className="not-found-page__subtitle">{subtitle}</span>
          <span className="not-found-page__hint">{t('notFound.hint')}</span>
        </div>
        <div className="not-found-page__resultExtra">
          <Button
            key="home"
            type="primary"
            icon={<ShopIcon path={SI.home} />}
            onClick={() => navigate('/')}
          >
            {t('notFound.backHome')}
          </Button>
          <Button
            key="search"
            icon={<ShopIcon path={SI.search} />}
            onClick={() => navigate('/products')}
          >
            {t('notFound.searchProducts')}
          </Button>
          <Button
            key="coupons"
            icon={<ShopIcon path={SI.gift} />}
            onClick={() => navigate('/coupons')}
          >
            {t('notFound.browseCoupons')}
          </Button>
          <Button
            key="track"
            icon={<ShopIcon path={SI.fileSearch} />}
            onClick={() => navigate('/track-order')}
          >
            {t('notFound.trackOrder')}
          </Button>
        </div>
      </section>
    </main>
  );
};

export default NotFound;
