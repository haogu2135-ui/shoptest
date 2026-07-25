import fs from 'fs';
import path from 'path';

const cartSource = fs.readFileSync(path.join(__dirname, 'Cart.tsx'), 'utf8');
const cartHelpersSource = fs.readFileSync(path.join(__dirname, 'cartHelpers.ts'), 'utf8');
const cartSessionSource = fs.readFileSync(path.join(__dirname, '../hooks/useCartSessionData.ts'), 'utf8');
const cartMutationsSource = fs.readFileSync(path.join(__dirname, '../hooks/useCartItemMutations.ts'), 'utf8');
const cartRecoverySource = fs.readFileSync(path.join(__dirname, '../hooks/useCartRecoveryAdds.ts'), 'utf8');
const cartSurface = [cartSource, cartHelpersSource, cartSessionSource, cartMutationsSource, cartRecoverySource].join('\n');

describe('Cart recent products cache source contract', () => {
  it('keeps recent product data bounded and short-lived', () => {
    expect(cartHelpersSource).toContain('export const RECENT_PRODUCTS_CACHE_MS = 2 * 60 * 1000;');
    expect(cartHelpersSource).toContain('export const RECENT_PRODUCTS_CACHE_MAX_ENTRIES = 50;');
    expect(cartHelpersSource).toContain('type RecentProductsCacheEntry = { expiresAt: number; products: Product[] };');
    expect(cartHelpersSource).toContain('const recentProductsCache = new Map<string, RecentProductsCacheEntry>();');
    expect(cartHelpersSource).toContain('if (entry.expiresAt <= now) {');
    expect(cartHelpersSource).toContain('while (recentProductsCache.size > RECENT_PRODUCTS_CACHE_MAX_ENTRIES) {');
    expect(cartHelpersSource).toContain('recentProductsCache.delete(cacheKey);');
    expect(cartHelpersSource).toContain('recentProductsCache.set(cacheKey, cached);');
    expect(cartHelpersSource).toContain('expiresAt: now + RECENT_PRODUCTS_CACHE_MS');
  });

  it('clears cached recent products after cart and saved-item mutations', () => {
    const clearCalls = cartSurface.match(/clearRecentProductsCache\(\);/g) || [];

    expect(cartHelpersSource).toContain('export const clearRecentProductsCache = () => {');
    expect(clearCalls.length).toBeGreaterThanOrEqual(6);
    expect(cartSurface).toContain('removeGuestCartItems');
    expect(cartSurface).toContain('removeSavedForLaterProduct');
    expect(cartSurface).toContain('replaceSavedForLaterItems');
    expect(cartSurface).toContain('saveCartItemForLater');
  });
});
