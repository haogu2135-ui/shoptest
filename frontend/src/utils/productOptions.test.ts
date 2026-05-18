import { getProductOptionGroups, getProductVariants } from './productOptions';
import type { Product } from '../types';

describe('productOptions', () => {
  it('splits configured options on common delimiters', () => {
    const product = {
      specifications: {
        'options.Size': 'Small\uFF0CMedium\u3001Large\nXL;Orange',
      },
    } as unknown as Partial<Product>;

    expect(getProductOptionGroups(product)).toEqual([
      { name: 'Size', values: ['Small', 'Medium', 'Large', 'XL', 'Orange'] },
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
        { options: { Size: 'S', Meta: { bad: true } }, price: 12, stock: -4 },
        { optionText: 'Size=M\uFF0CColor=Orange', price: 14, stock: 3.8 },
      ]),
    } as unknown as Partial<Product>;

    expect(getProductVariants(product)).toEqual([
      { options: { Size: 'S' }, price: 12, stock: 0, imageUrl: undefined, sku: undefined },
      { options: { Size: 'M', Color: 'Orange' }, price: 14, stock: 3, imageUrl: undefined, sku: undefined },
    ]);
  });
});
