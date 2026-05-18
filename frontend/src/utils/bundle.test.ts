import { buildBundleSpecs, getBundleInfo } from './bundle';
import type { Product } from '../types';

const product = (specifications: Record<string, string>): Product => ({
  id: 1,
  name: 'Starter Kit',
  price: 20,
  specifications,
} as Product);

describe('bundle helpers', () => {
  it('splits text bundle items on common delimiters', () => {
    const bundle = getBundleInfo(product({
      'bundle.enabled': 'true',
      'bundle.price': '19.99',
      'bundle.items': 'Bowl，Leash、Toy+Treats',
    }));

    expect(bundle?.items.map((item) => item.name)).toEqual(['Bowl', 'Leash', 'Toy', 'Treats']);
  });

  it('normalizes malformed bundle item quantities and product ids', () => {
    const bundle = getBundleInfo(product({
      'bundle.enabled': 'true',
      'bundle.price': '19.99',
      'bundle.items': JSON.stringify([
        { name: 'Bowl', quantity: 500, productId: 2 },
        { name: 'Treats', quantity: -3, productId: -1 },
      ]),
    }));

    expect(bundle?.items).toMatchObject([
      { name: 'Bowl', quantity: 99, productId: 2 },
      { name: 'Treats', quantity: 1, productId: undefined },
    ]);
  });

  it('rejects non-finite bundle prices', () => {
    expect(getBundleInfo(product({
      'bundle.enabled': 'true',
      'bundle.price': 'Infinity',
      'bundle.items': 'Bowl',
    }))).toBeNull();
  });

  it('builds stable bundle specs with normalized item quantities', () => {
    const specs = buildBundleSpecs(product({
      'bundle.enabled': 'true',
      'bundle.price': '19.99',
      'bundle.items': JSON.stringify([{ name: 'Bowl', quantity: 2 }]),
    }), { Size: 'S' }, 'SKU-1');

    expect(specs).toContain('"_purchaseMode":"bundle"');
    expect(specs).toContain('Bowl x2');
    expect(specs).toContain('SKU-1');
  });
});
