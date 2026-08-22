import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../i18n', () => {
  const t = (key: string, params?: Record<string, string | number>) => {
    let label = key;
    Object.entries(params || {}).forEach(([name, value]) => {
      label = label.replace(`{${name}}`, String(value));
    });
    return label;
  };
  return {
    useLanguage: () => ({ language: 'en', t }),
  };
});

jest.mock('../hooks/usePageTitle', () => ({
  usePageTitle: jest.fn(),
}));

jest.mock('../hooks/useDocumentMeta', () => ({
  useDocumentMeta: jest.fn(),
}));

const LegalPage = require('./LegalPage').default as typeof import('./LegalPage').default;
const { useDocumentMeta: mockUseDocumentMeta } = require('../hooks/useDocumentMeta');
const cssSource = fs.readFileSync(path.join(__dirname, 'LegalPage.css'), 'utf8');
const pageSource = fs.readFileSync(path.join(__dirname, 'LegalPage.tsx'), 'utf8');

const renderAt = (route: string) => render(
  <MemoryRouter initialEntries={[route]}>
    <LegalPage />
  </MemoryRouter>,
);

describe('LegalPage document routing', () => {
  it('renders the privacy document with its own sections and SEO path', () => {
    renderAt('/privacy');

    expect(screen.getByRole('heading', { level: 1, name: 'pages.legal.privacyTitle' })).toBeInTheDocument();
    // Each title/body pair becomes one section article, so the four privacy
    // sections must render as four h2 headings.
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(sectionHeadings.map((heading) => heading.textContent)).toEqual([
      'pages.legal.privacySection1Title',
      'pages.legal.privacySection2Title',
      'pages.legal.privacySection3Title',
      'pages.legal.privacySection4Title',
    ]);
    expect(mockUseDocumentMeta).toHaveBeenCalledWith(expect.objectContaining({ path: '/privacy' }));
  });

  it('renders the terms document when the route names it', () => {
    renderAt('/terms');

    expect(screen.getByRole('heading', { level: 1, name: 'pages.legal.termsTitle' })).toBeInTheDocument();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
    expect(sectionHeadings.map((heading) => heading.textContent)).toEqual([
      'pages.legal.termsSection1Title',
      'pages.legal.termsSection2Title',
      'pages.legal.termsSection3Title',
      'pages.legal.termsSection4Title',
    ]);
    expect(mockUseDocumentMeta).toHaveBeenCalledWith(expect.objectContaining({ path: '/terms' }));
  });

  it('cross-links to the opposite document rather than back to itself', () => {
    const { unmount } = renderAt('/privacy');
    expect(screen.getByRole('link', { name: 'footer.terms' })).toHaveAttribute('href', '/terms');
    unmount();

    renderAt('/terms');
    expect(screen.getByRole('link', { name: 'footer.privacy' })).toHaveAttribute('href', '/privacy');
  });
});

describe('LegalPage section heading styling contract', () => {
  it('sizes section headings through the class the JSX actually renders', () => {
    // The section heading rule was keyed to `h2.legal-page__text` while the JSX
    // renders `h2.legal-page__title`, so it matched nothing and the headings fell
    // through to the browser default h2 size.
    expect(pageSource).toContain('<h2 className="legal-page__title">');
    expect(cssSource).toMatch(
      /\.legal-page__section h2\.legal-page__title\s*\{[^}]*font-size:\s*1\.15rem/,
    );
    expect(cssSource).not.toContain('h2.legal-page__text');
  });
});
