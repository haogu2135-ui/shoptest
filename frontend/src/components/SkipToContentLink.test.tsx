import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../i18n';
import SkipToContentLink, { MAIN_CONTENT_ID } from './SkipToContentLink';

describe('SkipToContentLink', () => {
  beforeEach(() => {
    window.localStorage.setItem('shop-language', 'en');
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('links keyboard users directly to the main content region', () => {
    render(
      <LanguageProvider>
        <SkipToContentLink />
      </LanguageProvider>,
    );

    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
    expect(link).toHaveClass('shop-skip-link');
  });
});
