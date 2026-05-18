import { getLocalizedOptionLabel } from './localizedProductOptions';

describe('localizedProductOptions', () => {
  it('localizes common option names and values for Spanish', () => {
    expect(getLocalizedOptionLabel('Size', 'es')).toBe('Talla');
    expect(getLocalizedOptionLabel('Orange', 'es')).toBe('Naranja');
  });

  it('keeps unknown option values unchanged', () => {
    expect(getLocalizedOptionLabel('Custom fit', 'es')).toBe('Custom fit');
    expect(getLocalizedOptionLabel('Orange', 'en')).toBe('Orange');
  });
});
