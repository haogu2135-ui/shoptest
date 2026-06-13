import React from 'react';
import { Button, Result } from 'antd';
import { HomeOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import './NotFound.css';

const NotFound: React.FC = () => {
  const { t } = useLanguage();
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
        title={<span id={titleId}>{title}</span>}
        subTitle={(
          <span id={subtitleId} role="status" aria-live="polite">
            {subtitle}
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
        ]}
      />
    </main>
  );
};

export default NotFound;
