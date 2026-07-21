import {
  buildBreadcrumbStructuredData,
  buildItemListStructuredData,
  buildProductStructuredData,
  buildWebsiteStructuredData,
} from './structuredData';

describe('structuredData', () => {
  const origin = 'https://shop.example.com';

  it('builds commercial product JSON-LD with offer and rating', () => {
    const data = buildProductStructuredData({
      id: 2,
      name: 'HydraWhisk Quiet Cat Water Fountain',
      description: 'Low-noise filtered water fountain.',
      imageUrl: 'https://cdn.example.com/fountain.jpg',
      brand: 'HydraWhisk',
      price: 49.9,
      currency: 'MXN',
      stock: 12,
      path: '/products/2',
      averageRating: 4.6,
      reviewCount: 18,
    }, origin);

    expect(data).toMatchObject({
      '@type': 'Product',
      name: 'HydraWhisk Quiet Cat Water Fountain',
      sku: '2',
      brand: { '@type': 'Brand', name: 'HydraWhisk' },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'MXN',
        price: '49.90',
        availability: 'https://schema.org/InStock',
        areaServed: { '@type': 'Country', name: 'MX' },
        availableLanguage: 'es-MX',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.6',
        reviewCount: 18,
      },
    });
  });

  it('marks out-of-stock offers and omits empty product names', () => {
    expect(buildProductStructuredData({ id: 1, name: '   ' }, origin)).toBeNull();
    const data = buildProductStructuredData({
      id: 9,
      name: 'Sold Out Bed',
      price: 20,
      stock: 0,
      path: '/products/9',
    }, origin);
    expect((data?.offers as { availability?: string } | undefined)?.availability)
      .toBe('https://schema.org/OutOfStock');
  });

  it('builds breadcrumb and website commercial schema', () => {
    const crumbs = buildBreadcrumbStructuredData([
      { name: 'Home', path: '/' },
      { name: 'Products', path: '/products' },
      { name: 'Fountain' },
    ], origin);
    expect(crumbs).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Home', item: `${origin}/` },
        { position: 2, name: 'Products', item: `${origin}/products` },
        { position: 3, name: 'Fountain' },
      ],
    });

    const website = buildWebsiteStructuredData({
      name: 'ShopMX Pet Store',
      description: 'Pet supplies for Mexico.',
      path: '/',
      searchPathTemplate: '/products?keyword={search_term_string}',
    }, origin);
    expect(website).toMatchObject({
      '@type': 'WebSite',
      name: 'ShopMX Pet Store',
      url: `${origin}/`,
      inLanguage: 'es-MX',
      publisher: {
        '@type': 'Organization',
        name: 'ShopMX Pet Store',
        url: `${origin}/`,
        areaServed: { '@type': 'Country', name: 'MX' },
      },
    });
    expect((website?.potentialAction as { target?: string } | undefined)?.target)
      .toBe(`${origin}/products?keyword={search_term_string}`);
  });

  it('builds commercial ItemList JSON-LD for storefront catalog pages', () => {
    const data = buildItemListStructuredData({
      name: 'Pet supplies',
      description: 'Browse pet products',
      path: '/products',
      items: [
        { id: 1, name: 'Fountain', path: '/products/1', imageUrl: 'https://cdn.example.com/a.jpg', price: 49.9, currency: 'MXN' },
        { id: 2, name: 'Bed', path: '/products/2', price: 20, currency: 'MXN' },
      ],
    }, origin);

    expect(data).toMatchObject({
      '@type': 'ItemList',
      name: 'Pet supplies',
      numberOfItems: 2,
      url: `${origin}/products`,
    });
    expect((data?.itemListElement as Array<Record<string, unknown>>)[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1,
      name: 'Fountain',
      item: {
        '@type': 'Product',
        name: 'Fountain',
        offers: {
          '@type': 'Offer',
          price: '49.90',
          priceCurrency: 'MXN',
        },
      },
    });
    expect(buildItemListStructuredData({ name: 'Empty', items: [] }, origin)).toBeNull();
  });
});
