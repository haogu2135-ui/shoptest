import { getLocalizedOptionLabel, isSizeOptionName } from './localizedProductOptions';

describe('localizedProductOptions', () => {
  it('localizes common option names and values for Spanish', () => {
    expect(getLocalizedOptionLabel('Size', 'es')).toBe('Talla');
    expect(getLocalizedOptionLabel('Orange', 'es')).toBe('Naranja');
  });

  it('keeps unknown option values unchanged', () => {
    expect(getLocalizedOptionLabel('Custom fit', 'es')).toBe('Custom fit');
    expect(getLocalizedOptionLabel('Orange', 'en')).toBe('Orange');
  });

  it('recognizes size option groups across localized product data', () => {
    expect(isSizeOptionName('Size')).toBe(true);
    expect(isSizeOptionName('Pet Size')).toBe(true);
    expect(isSizeOptionName('Talla')).toBe(true);
    expect(isSizeOptionName('尺码')).toBe(true);
    expect(isSizeOptionName('Color')).toBe(false);
  });
});
