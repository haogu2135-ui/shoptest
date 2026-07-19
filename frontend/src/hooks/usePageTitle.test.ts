import { renderHook } from '@testing-library/react';
import { usePageTitle } from './usePageTitle';

jest.mock('../i18n', () => ({
  useLanguage: () => ({
    t: (key: string) => (key === 'common.siteTitle' ? 'ShopMX Pet Store' : key),
    language: 'en',
  }),
}));

describe('usePageTitle', () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
  });

  it('sets a page-specific commercial title', () => {
    renderHook(() => usePageTitle('Cart'));
    expect(document.title).toBe('Cart | ShopMX Pet Store');
  });

  it('falls back to the site title when page title is empty', () => {
    renderHook(() => usePageTitle(''));
    expect(document.title).toBe('ShopMX Pet Store');
  });

  it('restores the site title on unmount', () => {
    const { unmount } = renderHook(() => usePageTitle('Checkout'));
    expect(document.title).toBe('Checkout | ShopMX Pet Store');
    unmount();
    expect(document.title).toBe('ShopMX Pet Store');
  });
});
