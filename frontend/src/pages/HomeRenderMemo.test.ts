import fs from 'fs';
import path from 'path';

const homeSource = fs.readFileSync(path.join(__dirname, 'Home.tsx'), 'utf8');

describe('Home render memoization contracts', () => {
  it('keeps expensive and reusable Home derived collections memoized', () => {
    expect(homeSource).not.toContain('EMPTY_OBJECT');
    expect(homeSource).not.toContain('EMPTY_PRODUCT_IDS');
    expect(homeSource).not.toContain('EMPTY_PRODUCT_MAP');
    expect(homeSource).not.toContain('promotionMap');
    expect(homeSource).not.toContain('homeProductIds');

    expect(homeSource).toMatch(/const promoProducts = useMemo\(/);
    expect(homeSource).toMatch(/const bestSellers = useMemo\(/);
    expect(homeSource).toMatch(/const discoveryProducts = useMemo\(/);
    expect(homeSource).toMatch(/const localPersonalizedProducts = useMemo\(/);
    expect(homeSource).toMatch(/const personalizedDisplayProducts = useMemo\(/);
    expect(homeSource).toMatch(/const personalizedReadyProducts = useMemo\(/);
    expect(homeSource).toMatch(/const personalizedDealCount = useMemo\(/);
    expect(homeSource).toMatch(/const visibleDiscoveryProducts = useMemo\(/);
    expect(homeSource).toMatch(/const categoryTiles = useMemo\(/);
    expect(homeSource).toMatch(/const heroCategoryTiles = useMemo\(/);
  });
});
