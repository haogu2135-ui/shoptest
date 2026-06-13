import fs from 'fs';
import path from 'path';

const cartSource = fs.readFileSync(path.join(__dirname, 'Cart.tsx'), 'utf8');

describe('Cart recent products cache source contract', () => {
  it('keeps recent product data bounded and short-lived', () => {
    expect(cartSource).toContain('const RECENT_PRODUCTS_CACHE_MS = 2 * 60 * 1000;');
    expect(cartSource).toContain('const RECENT_PRODUCTS_CACHE_MAX_ENTRIES = 50;');
    expect(cartSource).toContain('type RecentProductsCacheEntry = { expiresAt: number; products: Product[] };');
    expect(cartSource).toContain('const recentProductsCache = new Map<string, RecentProductsCacheEntry>();');
    expect(cartSource).toContain('if (entry.expiresAt <= now) {');
    expect(cartSource).toContain('while (recentProductsCache.size > RECENT_PRODUCTS_CACHE_MAX_ENTRIES) {');
    expect(cartSource).toContain('recentProductsCache.delete(cacheKey);');
    expect(cartSource).toContain('recentProductsCache.set(cacheKey, cached);');
    expect(cartSource).toContain('expiresAt: now + RECENT_PRODUCTS_CACHE_MS');
  });

  it('clears cached recent products after cart and saved-item mutations', () => {
    const clearCalls = cartSource.match(/clearRecentProductsCache\(\);/g) || [];

    expect(cartSource).toContain('const clearRecentProductsCache = () => {');
    expect(clearCalls.length).toBeGreaterThanOrEqual(6);
    expect(cartSource).toContain('removeGuestCartItems');
    expect(cartSource).toContain('removeSavedForLaterProduct');
    expect(cartSource).toContain('replaceSavedForLaterItems');
    expect(cartSource).toContain('saveCartItemForLater');
  });
});
