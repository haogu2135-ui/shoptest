import React from 'react';
import { useLanguage } from '../i18n';

export const MAIN_CONTENT_ID = 'shop-main-content';

const SkipToContentLink: React.FC = () => {
  const { t } = useLanguage();

  return (
    <a className="shop-skip-link" href={`#${MAIN_CONTENT_ID}`}>
      {t('common.skipToContent')}
    </a>
  );
};

export default SkipToContentLink;
