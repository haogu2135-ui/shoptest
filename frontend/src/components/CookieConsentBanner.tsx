import React, { useLayoutEffect, useRef, useState } from 'react';
import { ShopIcon, SI } from './ShopIcon';

import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { acceptCookieConsent, hasCookieConsent } from '../utils/cookieConsent';
import './CookieConsentBanner.css';
import ShopButton from './ShopButton';

const COOKIE_CONSENT_BODY_CLASS = 'shop-cookie-consent-visible';
const COOKIE_CONSENT_CLEARANCE_VAR = '--shop-cookie-consent-clearance';

const clearCookieConsentLayout = () => {
  document.body.classList.remove(COOKIE_CONSENT_BODY_CLASS);
  document.documentElement.style.removeProperty(COOKIE_CONSENT_CLEARANCE_VAR);
};

const CookieConsentBanner: React.FC = () => {
  const { t } = useLanguage();
  // Commercial CLS: decide visibility on first paint (not after effect) so bottom nav
  // clearance does not jump from unset → reserved after hydration.
  const [visible, setVisible] = useState(() => {
    try {
      return !hasCookieConsent();
    } catch {
      return true;
    }
  });
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
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

    // Commercial CLS: seed a stable clearance before the first browser paint when possible.
    if (!document.documentElement.style.getPropertyValue(COOKIE_CONSENT_CLEARANCE_VAR)) {
      document.documentElement.style.setProperty(COOKIE_CONSENT_CLEARANCE_VAR, '200px');
    }
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
            <ShopIcon path={SI.safety} aria-hidden />
            {t('cookieConsent.title')}
          </span>
          <p id="cookie-consent-banner-text" className="cookie-consent-banner__text">
            {t('cookieConsent.body')}{' '}
            <Link to="/privacy" className="cookie-consent-banner__link">
              {t('footer.privacy')}
            </Link>
            {' · '}
            <Link to="/terms" className="cookie-consent-banner__link">
              {t('footer.terms')}
            </Link>
          </p>
        </div>
        <div className="cookie-consent-banner__actions">
          <ShopButton
            type="default"
            className="cookie-consent-banner__button"
            onClick={() => accept(true)}
            aria-label={t('cookieConsent.acceptEssential')}
            title={t('cookieConsent.acceptEssential')}
          >
            {t('cookieConsent.acceptEssential')}
          </ShopButton>
          <ShopButton
            type="primary"
            className="cookie-consent-banner__button"
            onClick={() => accept(false)}
            aria-label={t('cookieConsent.acceptAll')}
            title={t('cookieConsent.acceptAll')}
          >
            {t('cookieConsent.acceptAll')}
          </ShopButton>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
