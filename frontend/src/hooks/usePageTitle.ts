import { useEffect } from 'react';
import { useLanguage } from '../i18n';

/**
 * Sets a commercial storefront document title: "Page | ShopMX Pet Store".
 * Restores the site title on unmount so route transitions stay clean.
 */
export const usePageTitle = (pageTitle?: string | null) => {
  const { t } = useLanguage();
  const siteTitle = t('common.siteTitle');
  const normalized = String(pageTitle || '').replace(/\s+/g, ' ').trim();

  useEffect(() => {
    document.title = normalized ? `${normalized} | ${siteTitle}` : siteTitle;
    return () => {
      document.title = siteTitle;
    };
  }, [normalized, siteTitle]);
};

export default usePageTitle;
