import { renderHook } from '@testing-library/react';
import { useDocumentMeta } from './useDocumentMeta';

describe('useDocumentMeta', () => {
  const origin = 'https://shop.example.com';

  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="description" content="Base description" />
      <meta property="og:title" content="Base title" />
    `;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin,
        pathname: '/products',
        search: '',
        href: `${origin}/products`,
      },
    });
  });

  it('applies route meta while mounted and restores on unmount', () => {
    const { unmount } = renderHook(() => useDocumentMeta({
      title: 'Products',
      description: 'Browse pet supplies.',
      path: '/products',
      type: 'website',
      siteName: 'ShopMX Pet Store',
      jsonLdId: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'ShopMX Pet Store',
      },
    }));

    expect(document.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe('Browse pet supplies.');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Products');
    expect(document.getElementById('shop-jsonld-website')?.textContent).toContain('WebSite');

    unmount();
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Base description');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Base title');
    expect(document.getElementById('shop-jsonld-website')).toBeNull();
  });
});
