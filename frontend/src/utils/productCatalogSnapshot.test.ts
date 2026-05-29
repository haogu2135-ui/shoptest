import {
  loadFallbackProductCatalog,
  loadProductCatalogSnapshot,
  normalizeProductForCatalogSnapshot,
  PRODUCT_CATALOG_SNAPSHOT_KEY,
  PRODUCT_CATALOG_SNAPSHOT_TTL_MS,
  saveProductCatalogSnapshot,
} from './productCatalogSnapshot';
import type { Product } from '../types';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  name: 'TrailTails Walking Starter Bundle',
  description: 'Leash, collar and bags',
  price: 399,
  stock: 8,
  categoryId: 2,
  imageUrl: '/uploads/products/walk.jpg',
  ...overrides,
});

describe('productCatalogSnapshot', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores a bounded public product snapshot and reloads valid products', () => {
    const products = Array.from({ length: 30 }, (_, index) => product({
      id: index + 1,
      name: `Product ${index + 1}`,
      specifications: Object.fromEntries(Array.from({ length: 40 }, (_unused, specIndex) => [`spec-${specIndex}`, 'value'])),
      images: Array.from({ length: 10 }, (_unused, imageIndex) => `/image-${imageIndex}.jpg`),
    }));

    saveProductCatalogSnapshot(products, 1_000);

    const snapshot = loadProductCatalogSnapshot(1_000);
    expect(snapshot?.savedAt).toBe(1_000);
    expect(snapshot?.products).toHaveLength(24);
    expect(snapshot?.products[0].images).toHaveLength(6);
    expect(Object.keys(snapshot?.products[0].specifications || {})).toHaveLength(32);
  });

  it('rejects expired, malformed, and invalid product data', () => {
    localStorage.setItem(PRODUCT_CATALOG_SNAPSHOT_KEY, JSON.stringify({
      savedAt: 10,
      products: [
        product({ id: 0 }),
        product({ id: 2, name: '' }),
        product({ id: 3, name: 'Valid product', price: 50 }),
      ],
    }));

    expect(loadProductCatalogSnapshot(10 + PRODUCT_CATALOG_SNAPSHOT_TTL_MS + 1)).toBeNull();

    const freshSnapshot = loadProductCatalogSnapshot(20);
    expect(freshSnapshot?.products.map((item) => item.id)).toEqual([3]);

    localStorage.setItem(PRODUCT_CATALOG_SNAPSHOT_KEY, '{bad-json');
    expect(loadProductCatalogSnapshot(20)).toBeNull();
  });

  it('sanitizes text, options, variants, and unsafe numeric values', () => {
    const normalized = normalizeProductForCatalogSnapshot(product({
      id: 5,
      name: '  Very   long   product  ',
      price: -1,
      effectivePrice: 129,
      stock: -4,
      discount: 240,
      positiveRate: 150,
      sizes: ['Small', 'Small', 'Medium'],
      variants: [
        { sku: ' sku-1 ', options: { Size: 'Small', Color: 'Blue' }, price: 139, stock: 3 },
        { sku: 'bad', options: {}, price: 139 },
      ],
      specifications: {
        ' options.Size ': 'Small, Medium',
        empty: '',
      },
    }));

    expect(normalized).toMatchObject({
      id: 5,
      name: 'Very long product',
      price: 129,
      stock: 0,
      discount: 100,
      positiveRate: 100,
      sizes: ['Small', 'Medium'],
    });
    expect(normalized?.variants).toHaveLength(1);
    expect(normalized?.variants?.[0].sku).toBe('sku-1');
    expect(normalized?.specifications).toEqual({ 'options.Size': 'Small, Medium' });
  });

  it('provides a bounded pet catalog fallback when no live snapshot is available', () => {
    const fallbackProducts = loadFallbackProductCatalog();

    expect(fallbackProducts.length).toBeGreaterThan(0);
    expect(fallbackProducts.every((item) => item.status === 'ACTIVE')).toBe(true);
    expect(fallbackProducts.every((item) => item.name && item.price >= 0 && item.imageUrl)).toBe(true);
  });
});
