import {
  applyDocumentMeta,
  applyJsonLd,
  captureDocumentMeta,
  removeJsonLd,
  resolveAbsoluteUrl,
  resolveDefaultSocialImageUrl,
  restoreDocumentMeta,
  serializeJsonLd,
} from './documentMeta';

describe('documentMeta', () => {
  const origin = 'https://shop.example.com';

  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="description" content="Base description" />
      <meta property="og:title" content="Base title" />
      <link rel="canonical" href="https://shop.example.com/" />
    `;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin,
        pathname: '/products/2',
        search: '',
        href: `${origin}/products/2`,
      },
    });
  });

  it('resolves absolute http(s) urls and rejects unsafe schemes', () => {
    expect(resolveAbsoluteUrl('/logo512.png', origin)).toBe(`${origin}/logo512.png`);
    expect(resolveAbsoluteUrl('https://cdn.example.com/a.jpg', origin)).toBe('https://cdn.example.com/a.jpg');
    expect(resolveAbsoluteUrl('javascript:alert(1)', origin)).toBe('');
    expect(resolveAbsoluteUrl('data:text/html,hi', origin)).toBe('');
  });

  it('applies commercial open graph and twitter meta with restore', () => {
    const snapshot = captureDocumentMeta();
    applyDocumentMeta({
      title: 'HydraWhisk Fountain',
      description: 'Quiet cat water fountain with filter.',
      imageUrl: 'https://cdn.example.com/fountain.jpg',
      path: '/products/2',
      type: 'product',
      siteName: 'ShopMX Pet Store',
    }, origin);

    expect(document.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toBe('Quiet cat water fountain with filter.');
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('product');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('HydraWhisk Fountain');
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content'))
      .toBe('https://cdn.example.com/fountain.jpg');
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content'))
      .toBe(`${origin}/products/2`);
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${origin}/products/2`);

    restoreDocumentMeta(snapshot);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Base description');
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Base title');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${origin}/`);
  });

  it('escapes JSON-LD script content and mounts/removes by id', () => {
    const payload = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Safe <script>product</script>',
    };
    expect(serializeJsonLd(payload)).toContain('\\u003cscript>');
    applyJsonLd('product-2', payload);
    const node = document.getElementById('shop-jsonld-product-2') as HTMLScriptElement | null;
    expect(node?.type).toBe('application/ld+json');
    expect(node?.textContent || '').toContain('\\u003cscript>');
    removeJsonLd('product-2');
    expect(document.getElementById('shop-jsonld-product-2')).toBeNull();
  });

  it('falls back to the default social image', () => {
    expect(resolveDefaultSocialImageUrl(origin)).toBe(`${origin}/logo512.png`);
  });
});
