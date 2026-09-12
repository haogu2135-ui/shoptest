import type { OrderCustomer, ProductPublic as Product } from '../types';
import {
  deriveHistoryInsights,
  filterHistoryProducts,
  orderHistoryProducts,
} from './browsingHistoryHelpers';
import {
  deriveHomeBestSellers,
  deriveHomeDiscoveryProducts,
  deriveHomeLocalPersonalizedProducts,
} from './homeHelpers';
import {
  buildRelatedRecommendations,
  fallbackProductImage,
  findSelectedProductVariant,
  normalizeProductImages,
} from './productDetailHelpers';
import type { ProductVariantLike } from './productDetailHelpers';
import { resolveActiveFilterCount } from './productListHelpers';
import { resolveNextReturnDeadlineLabel } from '../utils/profileHelpers';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 1,
  name: 'Product',
  description: 'A product',
  price: 10,
  stock: 10,
  categoryId: 1,
  imageUrl: '',
  ...overrides,
});

const emptyPreferences = {
  categories: {},
  brands: {},
  tags: {},
  recent: [],
  recentEntries: [],
};

describe('optimization round helper behavior', () => {
  it('keeps history ordering and combines keyword and quick-filter matching', () => {
    const products = [
      product({ id: 1, name: 'Treats', brand: 'Paws', stock: 2 }),
      product({ id: 2, name: 'Bed', brand: 'Cozy', stock: 10 }),
    ];
    expect(orderHistoryProducts(products, [2, 99, 1]).map((item) => item.id)).toEqual([2, 1]);
    expect(filterHistoryProducts({
      historyProducts: products,
      keyword: 'paws',
      quickFilter: 'lowStock',
      viewedAtById: new Map(),
    }).map((item) => item.id)).toEqual([1]);
  });

  it('tracks the first tied top brand while deriving history insights', () => {
    const insights = deriveHistoryInsights([
      product({ id: 1, brand: 'Paws', stock: 10 }),
      product({ id: 2, brand: 'Cozy', stock: 10 }),
    ], new Map());
    expect(insights.topBrand).toBe('Paws');
  });

  it('keeps Home best-seller and personalized rails bounded to their display limits', () => {
    const products = Array.from({ length: 12 }, (_, index) => product({
      id: index + 1,
      reviewCount: 12 - index,
      categoryId: 1,
    }));
    expect(deriveHomeBestSellers(products)).toHaveLength(8);
    expect(deriveHomeBestSellers(products)[0].id).toBe(1);
    expect(deriveHomeLocalPersonalizedProducts({
      products,
      viewPreferences: { ...emptyPreferences, categories: { '1': 1 } },
    })).toHaveLength(8);
  });

  it('preserves Home last-write product deduplication', () => {
    const featured = product({ id: 1, name: 'Featured' });
    const catalog = product({ id: 1, name: 'Catalog' });
    const result = deriveHomeDiscoveryProducts({
      featured: [featured],
      products: [catalog],
      viewPreferences: emptyPreferences,
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Catalog');
  });

  it('normalizes unique detail images and matches exact selected variants', () => {
    const images = normalizeProductImages({
      imageUrl: 'https://cdn.example/a.jpg',
      images: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    });
    expect(images).toEqual(['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg', fallbackProductImage]);
    const variants: ProductVariantLike[] = [
      { sku: 'red-small', options: { color: 'red', size: 'small' } },
      { sku: 'red', options: { color: 'red' } },
    ];
    expect(findSelectedProductVariant(variants, { color: 'red', size: 'small' })?.sku).toBe('red-small');
    expect(findSelectedProductVariant(variants, { color: 'red', size: '' })?.sku).toBe('red');
  });

  it('deduplicates related recommendations without removing stable ranking', () => {
    const result = buildRelatedRecommendations(
      product({ id: 1, categoryId: 2 }),
      [
        product({ id: 1, categoryId: 2 }),
        product({ id: 2, categoryId: 2 }),
        product({ id: 2, categoryId: 2, name: 'Duplicate' }),
      ],
    );
    expect(result.map((item) => item.id)).toEqual([2]);
  });

  it('counts active refinement controls without a temporary boolean array', () => {
    expect(resolveActiveFilterCount(true, ['small'], [], ['blue'])).toBe(3);
    expect(resolveActiveFilterCount(false, [], [], [])).toBe(0);
  });

  it('selects the earliest valid return deadline in one traversal', () => {
    const base = { status: 'COMPLETED', returnable: true, returnDeadline: '2026-08-01T00:00:00Z' } as OrderCustomer;
    const later = { ...base, id: 1, returnDeadline: '2026-09-01T00:00:00Z' };
    const earlier = { ...base, id: 2, returnDeadline: '2026-08-15T00:00:00Z' };
    expect(resolveNextReturnDeadlineLabel([later, earlier], 'en-US')).toBe(
      new Date('2026-08-15T00:00:00Z').toLocaleDateString('en-US'),
    );
  });
});
