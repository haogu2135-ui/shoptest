import React, { useMemo } from 'react';
import { ShopIcon, SI } from '../components/ShopIcon';

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import ShopBreadcrumb from '../components/ShopBreadcrumb';
import './LegalPage.css';
import ShopButton from '../components/ShopButton';

type LegalDoc = 'privacy' | 'terms';

const normalizeLegalDoc = (value: string | undefined): LegalDoc => (
  value === 'terms' ? 'terms' : 'privacy'
);

const LegalPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const doc = normalizeLegalDoc(location.pathname.includes('/terms') ? 'terms' : 'privacy');
  const isTerms = doc === 'terms';

  const title = isTerms ? t('pages.legal.termsTitle') : t('pages.legal.privacyTitle');
  const description = isTerms ? t('pages.legal.termsSeoDescription') : t('pages.legal.privacySeoDescription');
  const path = isTerms ? '/terms' : '/privacy';
  const sections = useMemo(() => (
    isTerms
      ? [
          t('pages.legal.termsSection1Title'),
          t('pages.legal.termsSection1Body'),
          t('pages.legal.termsSection2Title'),
          t('pages.legal.termsSection2Body'),
          t('pages.legal.termsSection3Title'),
          t('pages.legal.termsSection3Body'),
          t('pages.legal.termsSection4Title'),
          t('pages.legal.termsSection4Body'),
        ]
      : [
          t('pages.legal.privacySection1Title'),
          t('pages.legal.privacySection1Body'),
          t('pages.legal.privacySection2Title'),
          t('pages.legal.privacySection2Body'),
          t('pages.legal.privacySection3Title'),
          t('pages.legal.privacySection3Body'),
          t('pages.legal.privacySection4Title'),
          t('pages.legal.privacySection4Body'),
        ]
  ), [isTerms, t]);

  usePageTitle(title);
  useDocumentMeta({
    title,
    description,
    path,
    type: 'website',
    siteName: t('common.siteTitle'),
  });

  const pairs: Array<{ heading: string; body: string }> = [];
  for (let i = 0; i + 1 < sections.length; i += 2) {
    pairs.push({ heading: sections[i], body: sections[i + 1] });
  }

  return (
    <main className="legal-page" aria-label={title}>
      <ShopBreadcrumb
        ariaLabel={title}
        items={[
          { key: 'home', label: t('nav.ariaHome'), path: '/' },
          { key: 'legal', label: title },
        ]}
      />
      <section className="legal-page__hero">
        <span className="legal-page__eyebrow">
          <ShopIcon path={SI.safety} aria-hidden />
          {t('pages.legal.eyebrow')}
        </span>
        <h1 className="legal-page__title">{title}</h1>
        <p className="legal-page__text legal-page__paragraph legal-page__text--secondary">{description}</p>
        <span className="legal-page__text legal-page__text--secondary legal-page__updated">
          {t('pages.legal.updatedAt')}
        </span>
      </section>
      <section className="legal-page__content" aria-label={title}>
        {pairs.map((section) => (
          <article key={section.heading} className="legal-page__section">
            <h2 className="legal-page__title">{section.heading}</h2>
            <p className="legal-page__text legal-page__paragraph">{section.body}</p>
          </article>
        ))}
      </section>
      <section className="legal-page__actions" aria-label={t('pages.legal.relatedTitle')}>
        <ShopButton type="primary" icon={<ShopIcon path={SI.shopping} />} onClick={() => navigate('/products')}>
          {t('pages.legal.browseProducts')}
        </ShopButton>
        <ShopButton icon={<ShopIcon path={SI.home} />} onClick={() => navigate('/')}>
          {t('pages.legal.backHome')}
        </ShopButton>
        <Link className="legal-page__crossLink" to={isTerms ? '/privacy' : '/terms'}>
          {isTerms ? t('footer.privacy') : t('footer.terms')}
        </Link>
      </section>
    </main>
  );
};

export default LegalPage;
