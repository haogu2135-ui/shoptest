import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useLanguage } from '../i18n';
import { conversionConfig } from '../utils/conversionConfig';
import './SocialProofToast.css';

const SocialProofToast: React.FC = () => {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const events = useMemo(() => conversionConfig.socialProof.events, []);

  useEffect(() => {
    if (!conversionConfig.socialProof.enabled || events.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % events.length);
    }, conversionConfig.socialProof.rotateMs);
    return () => window.clearInterval(timer);
  }, [events.length]);

  if (!conversionConfig.socialProof.enabled || events.length === 0) return null;

  const event = events[activeIndex];
  return (
    <aside className="social-proof-toast" aria-live="polite">
      <span className="social-proof-toast__icon"><CheckCircleOutlined /></span>
      <span>
        <strong>{t('home.socialProofTitle')}</strong>
        <span>
          {t('home.socialProofMessage', {
            name: event.name,
            city: t(event.cityKey),
            product: t(event.productKey),
            minutes: event.minutesAgo,
          })}
        </span>
      </span>
    </aside>
  );
};

export default SocialProofToast;
