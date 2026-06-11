import fs from 'fs';
import path from 'path';

const readSourceFile = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('cart timer cleanup source contracts', () => {
  it('keeps debounced quantity timers cleaned up in the shared hook without rejected background chains', () => {
    const hookSource = readSourceFile('../hooks/useCartQuantitySync.ts');

    expect(hookSource).toContain('const quantityTimersRef = useRef<Record<number, number>>({});');
    expect(hookSource).toContain('Object.values(quantityTimersRef.current).forEach');
    expect(hookSource).toContain('quantityTimersRef.current = {};');
    expect(hookSource).toContain('quantityRequestPromisesRef.current = {};');
    expect(hookSource).toContain('quantityRequestVersionRef.current = {};');
    expect(hookSource).toContain('void syncPromise.catch(() => undefined);');
    expect(hookSource).toContain('void Promise.resolve(onQuantitySyncError(error)).catch(() => undefined);');
  });

  it('uses shared cart quantity normalization instead of page-local copies', () => {
    const cartUiSource = readSourceFile('cartUi.ts');
    const cartSource = readSourceFile('../pages/Cart.tsx');
    const cartDrawerSource = readSourceFile('../components/CartDrawer.tsx');

    expect(cartUiSource).toContain('export const normalizeCartQuantity =');
    expect(cartUiSource).toContain('export const getCartLineQuantity =');
    expect(cartUiSource).toContain('export const getCartQuantityLimit =');
    expect(cartSource).not.toContain('const normalizeCartQuantity =');
    expect(cartSource).not.toContain('const getLineQuantity =');
    expect(cartDrawerSource).not.toContain('const normalizeCartQuantity =');
    expect(cartSource).toContain('normalizeCartQuantity,');
    expect(cartDrawerSource).toContain('normalizeCartQuantity,');
    expect(cartDrawerSource).toContain('max={getCartQuantityLimit(item.stock)}');
  });

  it('keeps quantity normalization helpers domain-specific instead of ambiguous local copies', () => {
    const guestCartSource = readSourceFile('guestCart.ts');
    const saveForLaterSource = readSourceFile('saveForLater.ts');
    const mobileUpdateSource = readSourceFile('mobileUpdate.ts');
    const useAuthSource = readSourceFile('../hooks/useAuth.ts');
    const cartSource = readSourceFile('../pages/Cart.tsx');

    expect(guestCartSource).toContain('const normalizeGuestCartQuantity =');
    expect(saveForLaterSource).toContain('const normalizeSavedItemQuantity =');
    [guestCartSource, saveForLaterSource, mobileUpdateSource, useAuthSource, cartSource].forEach((source) => {
      expect(source).not.toMatch(/const normalizeQuantity\s*=/);
    });
  });

  it('uses the shared cart quantity sync hook instead of component-local timer copies', () => {
    const cartSource = readSourceFile('../pages/Cart.tsx');
    const cartDrawerSource = readSourceFile('../components/CartDrawer.tsx');

    [cartSource, cartDrawerSource].forEach((source) => {
      expect(source).toContain("import { useCartQuantitySync } from '../hooks/useCartQuantitySync';");
      expect(source).toContain('useCartQuantitySync({');
      expect(source).not.toContain('quantityTimersRef');
      expect(source).not.toContain('quantityRequestPromisesRef');
      expect(source).not.toContain('quantityRequestVersionRef');
      expect(source).not.toContain('const clearQuantityTimer');
      expect(source).not.toContain('const flushPendingQuantityUpdates = async');
    });
  });

  it('keeps shared debounced quantity continuations guarded after unmount', () => {
    const hookSource = readSourceFile('../hooks/useCartQuantitySync.ts');

    expect(hookSource).toContain('const disposedRef = useRef(false);');
    expect(hookSource).toContain('!disposedRef.current');
    expect(hookSource).toContain('&& isMounted()');
    expect(hookSource).toContain('quantityRequestVersionRef.current[itemId] === requestVersion');
    expect(hookSource.match(/if \(!isActive\(itemId, requestVersion\)\) return;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(hookSource).toContain('disposedRef.current = true;');
  });

  it('keeps cart async mutation continuations guarded after unmount', () => {
    const cartSource = readSourceFile('../pages/Cart.tsx');
    const cartDrawerSource = readSourceFile('../components/CartDrawer.tsx');

    expect(cartSource).toContain('if (!mountedRef.current) return;');
    expect(cartSource).toContain('if (mountedRef.current) setLoading(false);');
    expect(cartSource).toContain('if (mountedRef.current) setRestoringSaved(false);');
    expect(cartSource).toMatch(/await cartApi\.removeItem\(item\.id\);\s+if \(!mountedRef\.current\) return;\s+setCartItems/);
    expect(cartSource).toMatch(/await cartApi\.removeItems\(normalizedIds\);\s+if \(!mountedRef\.current\) return;\s+setCartItems/);
    expect(cartSource).toMatch(/await cartApi\.getItems\(0\);\s+if \(!mountedRef\.current\) return;\s+const nextItems/);
    expect(cartDrawerSource).toMatch(/await cartApi\.removeItem\(item\.id\);\s+if \(!mountedRef\.current\) return;\s+setItems/);
    expect(cartDrawerSource).toMatch(/await allSettledWithConcurrency\([\s\S]*?\);\s+if \(!mountedRef\.current\) return;\s+const removedIds/);
    expect(cartDrawerSource).toMatch(/await cartApi\.getItems\(0\);\s+if \(!mountedRef\.current\) return;\s+setItems/);
  });

  it('does not refetch cart contents only because the UI language changed', () => {
    const cartSource = readSourceFile('../pages/Cart.tsx');
    const fetchCartItemsBlock = cartSource.match(/const fetchCartItems = useCallback\([\s\S]*?\}, \[([^\]]*)\]\);/);
    const fetchCartItemsDeps = (fetchCartItemsBlock?.[1] || '').split(',').map((dependency) => dependency.trim()).filter(Boolean);

    expect(cartSource).toContain('cartFetchErrorFallbackRef');
    expect(fetchCartItemsDeps).not.toContain('language');
    expect(fetchCartItemsDeps).not.toContain('t');
  });
});
