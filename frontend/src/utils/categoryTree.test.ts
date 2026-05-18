import type { Category } from '../types';
import { getDisplayCategoryRoots, getLocalizedCategoryValue } from './categoryTree';

const category = (overrides: Partial<Category> & Pick<Category, 'id' | 'name'>): Category => ({
  localizedContent: null,
  parentId: null,
  ...overrides,
});

describe('getDisplayCategoryRoots', () => {
  it('shows second-level categories when there is only one top-level category', () => {
    const result = getDisplayCategoryRoots([
      category({ id: 1, name: 'Pet Supplies', level: 1 }),
      category({ id: 2, name: 'Dog', parentId: 1, level: 2 }),
      category({ id: 3, name: 'Cat', parentId: 1, level: 2 }),
    ]);

    expect(result.map((item) => item.name)).toEqual(['Dog', 'Cat']);
  });

  it('keeps top-level categories when there are multiple roots', () => {
    const result = getDisplayCategoryRoots([
      category({ id: 1, name: 'Dog', level: 1 }),
      category({ id: 2, name: 'Cat', level: 1 }),
      category({ id: 3, name: 'Treats', parentId: 1, level: 2 }),
    ]);

    expect(result.map((item) => item.name)).toEqual(['Dog', 'Cat']);
  });

  it('keeps a single top-level category when it has no children', () => {
    const result = getDisplayCategoryRoots([
      category({ id: 1, name: 'Pet Supplies', level: 1 }),
    ]);

    expect(result.map((item) => item.name)).toEqual(['Pet Supplies']);
  });

  it('uses storefront fallback translations for common pet category names', () => {
    const petFood = category({ id: 1, name: 'Pet Food' });
    const bowls = category({ id: 2, name: 'Bowls, Feeders & Waterers' });

    expect(getLocalizedCategoryValue(petFood, 'zh', 'name')).toBe('宠物食品');
    expect(getLocalizedCategoryValue(bowls, 'es', 'name')).toBe('Platos, comederos y bebederos');
    expect(getLocalizedCategoryValue(petFood, 'en', 'name')).toBe('Pet Food');
  });
});
