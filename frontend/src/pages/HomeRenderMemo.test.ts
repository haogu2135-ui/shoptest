import fs from 'fs';
import path from 'path';

const homeSource = fs.readFileSync(path.join(__dirname, 'Home.tsx'), 'utf8');

describe('Home render memoization contracts', () => {
  it('filters storage updates to product-view preference changes only', () => {
    const storageEffectStart = homeSource.indexOf('const handlePreferencesUpdated = (event?: Event) => {');
    const storageEffect = homeSource.slice(storageEffectStart, homeSource.indexOf('};', storageEffectStart));

    expect(homeSource).toContain("import { clearProductViewHistory, loadProductViewPreferences, PRODUCT_VIEW_PREFERENCES_KEY } from '../utils/productViewPreferences';");
    expect(storageEffectStart).toBeGreaterThan(-1);
    expect(storageEffect).toContain('event instanceof StorageEvent && event.key && event.key !== PRODUCT_VIEW_PREFERENCES_KEY');
    expect(storageEffect).toContain('setViewPreferences(loadProductViewPreferences());');
    expect(homeSource).toContain("window.addEventListener('shop:product-view-preferences-updated', handlePreferencesUpdated);");
    expect(homeSource).toContain("window.addEventListener('storage', handlePreferencesUpdated);");
  });

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

  it('keeps local pet gallery fallback media off third-party image hosts', () => {
    expect(homeSource).toContain('const petGalleryImageFallback = imageFallbacks.media;');
    expect(homeSource).toContain('image: petGalleryImageFallback');
    expect(homeSource).not.toContain('images.unsplash.com');
    expect(homeSource).not.toContain('unsplash.com');
  });

  it('keeps the Home loading state populated with accessible skeleton content', () => {
    const loadingStart = homeSource.indexOf('if (loading) {');
    const loadingEnd = homeSource.indexOf('if (loadError) {', loadingStart);
    const loadingSource = homeSource.slice(loadingStart, loadingEnd);

    expect(homeSource).toContain("import { HeroSkeleton, ProductCardSkeleton, StatsStripSkeleton } from '../components/SkeletonLoader';");
    expect(loadingStart).toBeGreaterThan(-1);
    expect(loadingEnd).toBeGreaterThan(loadingStart);
    expect(loadingSource).toContain('aria-busy="true"');
    expect(loadingSource).toContain('role="status"');
    expect(loadingSource).toContain('aria-live="polite"');
    expect(loadingSource).toContain('aria-label={t(\'common.loading\')}');
    expect(loadingSource).toContain('<HeroSkeleton />');
    expect(loadingSource).toContain('<StatsStripSkeleton />');
    expect(loadingSource).toContain('<ProductCardSkeleton count={8} />');
    expect(loadingSource).toContain('className="shopee-hero__asideSkeleton shimmer"');
    expect(loadingSource).toContain('className="shopee-loading-products"');
  });
});
