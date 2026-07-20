import React, { useEffect, useRef, useState } from 'react';
import { Button, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { acceptCookieConsent, hasCookieConsent } from '../utils/cookieConsent';
import './CookieConsentBanner.css';

const COOKIE_CONSENT_BODY_CLASS = 'shop-cookie-consent-visible';
const COOKIE_CONSENT_CLEARANCE_VAR = '--shop-cookie-consent-clearance';

const clearCookieConsentLayout = () => {
  document.body.classList.remove(COOKIE_CONSENT_BODY_CLASS);
  document.documentElement.style.removeProperty(COOKIE_CONSENT_CLEARANCE_VAR);
};

const CookieConsentBanner: React.FC = () => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisible(!hasCookieConsent());
  }, []);

  useEffect(() => {
    if (!visible) {
      clearCookieConsentLayout();
      return;
    }

    document.body.classList.add(COOKIE_CONSENT_BODY_CLASS);

    const updateClearance = () => {
      const el = bannerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Keep sticky conversion rails above the visible cookie panel (+ 8px gap).
      const clearance = Math.max(0, Math.ceil(window.innerHeight - rect.top + 8));
      document.documentElement.style.setProperty(COOKIE_CONSENT_CLEARANCE_VAR, `${clearance}px`);
    };

    updateClearance();
    const frame = window.requestAnimationFrame(updateClearance);
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateClearance())
      : null;
    if (bannerRef.current && resizeObserver) {
      resizeObserver.observe(bannerRef.current);
    }
    window.addEventListener('resize', updateClearance);
    window.addEventListener('orientationchange', updateClearance);

    return () => {
      window.cancelAnimationFrame(frame);
      clearCookieConsentLayout();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateClearance);
      window.removeEventListener('orientationchange', updateClearance);
    };
  }, [visible]);

  if (!visible) return null;

  const accept = (essentialOnly: boolean) => {
    acceptCookieConsent({ essentialOnly });
    setVisible(false);
  };

  return (
    <div
      ref={bannerRef}
      className="cookie-consent-banner"
      role="dialog"
      aria-modal="false"
      aria-label={t('cookieConsent.title')}
      aria-describedby="cookie-consent-banner-text"
      data-cookie-consent-visible="true"
    >
      <div className="cookie-consent-banner__inner">
        <div className="cookie-consent-banner__copy">
          <span className="cookie-consent-banner__eyebrow">
            <SafetyCertificateOutlined aria-hidden />
            {t('cookieConsent.title')}
          </span>
          <Typography.Paragraph id="cookie-consent-banner-text" className="cookie-consent-banner__text">
            {t('cookieConsent.body')}{' '}
            <Link to="/privacy" className="cookie-consent-banner__link">
              {t('footer.privacy')}
            </Link>
            {' · '}
            <Link to="/terms" className="cookie-consent-banner__link">
              {t('footer.terms')}
            </Link>
          </Typography.Paragraph>
        </div>
        <div className="cookie-consent-banner__actions">
          <Button
            type="default"
            className="cookie-consent-banner__button"
            onClick={() => accept(true)}
            aria-label={t('cookieConsent.acceptEssential')}
            title={t('cookieConsent.acceptEssential')}
          >
            {t('cookieConsent.acceptEssential')}
          </Button>
          <Button
            type="primary"
            className="cookie-consent-banner__button"
            onClick={() => accept(false)}
            aria-label={t('cookieConsent.acceptAll')}
            title={t('cookieConsent.acceptAll')}
          >
            {t('cookieConsent.acceptAll')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
