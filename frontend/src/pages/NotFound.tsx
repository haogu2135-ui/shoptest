import React from 'react';
import { Button, Result } from 'antd';
import { HomeOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';

const NotFound: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div style={{ padding: '80px 24px', textAlign: 'center' }}>
      <Result
        status="404"
        title={t('notFound.title')}
        subTitle={t('notFound.subtitle')}
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
    </div>
  );
};

export default NotFound;
