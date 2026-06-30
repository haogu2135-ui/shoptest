import { getProductOptionGroups, getProductVariants, optionValueIsCompatible } from './productOptions';
import type { Product } from '../types';

describe('productOptions', () => {
  it('keeps option normalization typed without any', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, 'productOptions.ts'), 'utf8') as string;

    expect(source).not.toMatch(/\bany\b/);
    expect(source).not.toMatch(/localStorage|sessionStorage|product-options|expiresAt|ttl/i);
    expect(source).not.toMatch(/specAttributes|spec_attributes|skuData|ColorSelector/);
    expect(source).toContain('const normalizeVariantOptions = (variant: unknown)');
    expect(source).toContain('const normalizeVariants = (items: unknown[])');
  });

  it('splits configured options on common delimiters', () => {
    const product = {
      specifications: {
        'options.Size': 'Small\uFF0CMedium\u3001Large\nXL;Orange\uFF1BTiny',
      },
    } as unknown as Partial<Product>;

    expect(getProductOptionGroups(product)).toEqual([
      { name: 'Size', values: ['Small', 'Medium', 'Large', 'XL', 'Orange', 'Tiny'] },
    ]);
  });

  it('does not split option values on regular letters', () => {
    const product = {
      specifications: {
        'options.Color': 'Orange,Green,Pink',
      },
    } as unknown as Partial<Product>;

    expect(getProductOptionGroups(product)).toEqual([
      { name: 'Color', values: ['Orange', 'Green', 'Pink'] },
    ]);
  });

  it('drops object-valued variant options and clamps negative stock', () => {
    const product = {
      variants: JSON.stringify([
        { options: { Size: 'S', Meta: { bad: true } }, price: 12, stock: -4, imageUrl: 'data:image/png;base64,abc' },
        { optionText: 'Size=M\uFF0CColor=Orange;Coat=Short', price: 14, stock: 3.8 },
        { options: { Size: 'L' }, price: 16, imageUrl: 'uploads/products/variant.jpg' },
      ]),
    } as unknown as Partial<Product>;

    expect(getProductVariants(product)).toEqual([
      { options: { Size: 'S' }, price: 12, stock: 0, imageUrl: undefined, sku: undefined },
      { options: { Size: 'M', Color: 'Orange', Coat: 'Short' }, price: 14, stock: 3, imageUrl: undefined, sku: undefined },
      { options: { Size: 'L' }, price: 16, stock: undefined, imageUrl: '/uploads/products/variant.jpg', sku: undefined },
    ]);
  });

  it('checks option compatibility against the current partial selection', () => {
    const variants = getProductVariants({
      variants: JSON.stringify([
        { options: { Size: 'S', Color: 'Blue' }, price: 12, stock: 2 },
        { options: { Size: 'M', Color: 'Red' }, price: 14, stock: 1 },
      ]),
    } as unknown as Partial<Product>);

    expect(optionValueIsCompatible(variants, { Size: 'S' }, 'Color', 'Blue')).toBe(true);
    expect(optionValueIsCompatible(variants, { Size: 'S' }, 'Color', 'Red')).toBe(false);
  });
});
