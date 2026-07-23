import { render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../i18n';
import SkipToContentLink, { MAIN_CONTENT_ID } from './SkipToContentLink';

describe('SkipToContentLink', () => {
  beforeEach(() => {
    window.localStorage.setItem('shop-language', 'en');
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('links keyboard users directly to the main content region', async () => {
    render(
      <LanguageProvider>
        <SkipToContentLink />
      </LanguageProvider>,
    );

    // English pack is lazy-loaded; wait for commercial EN label after pack hydration.
    const link = await screen.findByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
    expect(link).toHaveClass('shop-skip-link');
    await waitFor(() => {
      expect(link).toHaveTextContent('Skip to main content');
    });
  });

  it('ships Spanish skip label from the Mexico-first shell pack', () => {
    window.localStorage.setItem('shop-language', 'es');
    render(
      <LanguageProvider>
        <SkipToContentLink />
      </LanguageProvider>,
    );
    const link = screen.getByRole('link', { name: 'Saltar al contenido principal' });
    expect(link).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
  });
});
